/**
 * Precrease search, browser side. Talks to Pagefind's JavaScript API (not its prebuilt UI, which
 * injects inline styles the CSP forbids) and renders results with DOM nodes only: Pagefind's
 * excerpts arrive as HTML with <mark> tags, so they're rebuilt as text plus <mark>, never parsed
 * into the page.
 */

interface PagefindResult {
  url: string;
  excerpt: string;
  meta: Record<string, string | undefined>;
}
interface Pagefind {
  options(options: Record<string, unknown>): Promise<void>;
  search(
    query: string | null,
    options?: { filters?: Record<string, { any: string[] }> },
  ): Promise<{ results: { data(): Promise<PagefindResult>; id: string }[] } | null>;
}
interface Strings {
  number: string;
  loading: string;
  one: string;
  many: string;
  none: string;
  failed: string;
  formats: Record<string, string>;
}

import { readJsonData } from './dom';
import { formatCount } from './format';
import { isTypingTarget } from './keyboard';
import { fill } from './template';

/** Where scripts/build-search-index.ts writes the bundle. A constant: no input reaches import(). */
const BUNDLE = '/pagefind/pagefind.js';
const MAX_RESULTS = 8;

/**
 * A result's link, or null when the index holds anything but a path on this site. The index is
 * built from our own pages, so this never trips today; it keeps a tampered or broken index from
 * turning a result into a `javascript:` link or a link to another site.
 */
export const resultHref = (url: string): string | null => {
  // A path on this site: one leading slash, and no backslash (browsers read "/\host" as "//host").
  if (!/^\/(?!\/)/.test(url) || url.includes('\\')) return null;
  const clean = url.replace(/(?:\/index)?\.html(?=$|[?#])/, '');
  return clean === '' ? '/' : clean;
};

/** Selected chips → Pagefind filters, leaving out groups with nothing selected. */
export const toFilters = (selected: Record<string, Set<string>>): Record<string, { any: string[] }> => {
  const filters: Record<string, { any: string[] }> = {};
  for (const [group, values] of Object.entries(selected)) {
    if (values.size > 0) filters[group] = { any: [...values].sort() };
  }
  return filters;
};

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", amp: '&' };

/**
 * Splits a Pagefind excerpt into plain and highlighted runs. The excerpt is HTML with `<mark>`
 * around matches; this walks it once, keeps `<mark>` as the only meaning a tag can have, skips
 * every other tag, and decodes entities in a single pass (so `&amp;lt;` stays the text `&lt;`).
 * The runs are rendered as text nodes, never parsed as HTML.
 */
export const excerptRuns = (excerpt: string): { text: string; marked: boolean }[] => {
  const decode = (text: string) =>
    text.replace(/&(lt|gt|quot|#39|#x27|amp);/g, (_, name: string) => ENTITIES[name] ?? '');
  const runs: { text: string; marked: boolean }[] = [];
  let marked = false;
  let pending = '';
  const flush = () => {
    if (pending) runs.push({ text: decode(pending), marked });
    pending = '';
  };
  for (let i = 0; i < excerpt.length;) {
    // A tag starts with `<` followed by a letter or `/`; any other `<` is text.
    const opensTag = excerpt[i] === '<' && /[a-z/]/i.test(excerpt[i + 1] ?? '');
    const end = opensTag ? excerpt.indexOf('>', i) : -1;
    if (end === -1) {
      pending += excerpt[i];
      i += 1;
      continue;
    }
    const tag = excerpt
      .slice(i + 1, end)
      .trim()
      .toLowerCase();
    if (tag === 'mark' || tag === '/mark') {
      flush();
      marked = tag === 'mark';
    }
    i = end + 1;
  }
  flush();
  return runs;
};

let pagefind: Promise<Pagefind> | null = null;
/** Pagefind's engine, downloaded the first time the box is used. */
const loadPagefind = (): Promise<Pagefind> => {
  pagefind ??= import(/* @vite-ignore */ BUNDLE).then(async (module: Pagefind) => {
    await module.options({ excerptLength: 24 });
    return module;
  });
  return pagefind;
};

/** One result: its Crease number and format, its title, and the excerpt with its matches marked. */
const renderResult = (result: PagefindResult, href: string, strings: Strings): HTMLLIElement => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = href;
  const kicker = document.createElement('span');
  kicker.className = 'r-kicker';
  kicker.textContent = [
    result.meta.number ? fill(strings.number, { number: result.meta.number }) : '',
    result.meta.format ? (strings.formats[result.meta.format] ?? '') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const title = document.createElement('span');
  title.className = 'r-title';
  title.textContent = result.meta.title ?? a.href;
  const excerpt = document.createElement('span');
  excerpt.className = 'r-excerpt';
  excerpt.append(
    ...excerptRuns(result.excerpt).map((run) => {
      if (!run.marked) return document.createTextNode(run.text);
      const mark = document.createElement('mark');
      mark.textContent = run.text;
      return mark;
    }),
  );
  a.append(kicker, title, excerpt);
  li.append(a);
  return li;
};

/** The search box's parts, or null when the page doesn't have them all. */
const parts = (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>('input[type="search"]');
  const panel = root.querySelector<HTMLElement>('.panel');
  const status = root.querySelector<HTMLElement>('.status');
  const list = root.querySelector<HTMLOListElement>('.results');
  const clear = root.querySelector<HTMLButtonElement>('[data-clear]');
  const form = root.querySelector('form');
  const strings = readJsonData<Strings | null>(root, 'strings', null);
  if (!input || !panel || !status || !list || !clear || !form || !strings) return null;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  return { input, panel, status, list, clear, form, strings, chips };
};
type Parts = NonNullable<ReturnType<typeof parts>>;

/** Runs the query and the chosen filters; a newer search always wins over a slower older one. */
const searcher = ({ input, status, list, clear, strings }: Parts, selected: Record<string, Set<string>>) => {
  let run = 0;
  return async () => {
    const query = input.value.trim();
    const filters = toFilters(selected);
    const filtering = Object.keys(filters).length > 0;
    clear.hidden = !filtering;
    if (!query && !filtering) {
      status.textContent = '';
      list.replaceChildren();
      return;
    }
    const current = ++run;
    status.textContent = strings.loading;
    try {
      const api = await loadPagefind();
      const found = await api.search(query || null, { filters });
      if (!found || current !== run) return;
      const data = await Promise.all(found.results.slice(0, MAX_RESULTS).map((r) => r.data()));
      if (current !== run) return;
      status.textContent = formatCount(found.results.length, {
        zero: strings.none,
        one: strings.one,
        many: strings.many,
      });
      list.replaceChildren(
        ...data.flatMap((result) => {
          const href = resultHref(result.url);
          return href ? [renderResult(result, href, strings)] : [];
        }),
      );
    } catch (error) {
      if (current !== run) return;
      console.error('Precrease search failed to load', error);
      status.textContent = strings.failed;
      list.replaceChildren();
    }
  };
};

/** The panel closes on Escape, when focus leaves the box, or on a click anywhere else. */
const closeWhenLeft = (root: HTMLElement, { input, panel }: Parts) => {
  const close = () => (panel.hidden = true);
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || panel.hidden) return;
    e.preventDefault();
    close();
    input.focus();
  });
  root.addEventListener('focusout', (e) => {
    if (!(e.relatedTarget instanceof Node) || !root.contains(e.relatedTarget)) close();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target instanceof Node && !root.contains(e.target)) close();
  });
};

export const initPrecreaseSearch = (): void => {
  const root = document.querySelector<HTMLElement>('[data-precrease-search]');
  const found = root && parts(root);
  if (!root || !found) return;
  const { input, panel, list, clear, form, chips } = found;
  const selected: Record<string, Set<string>> = { format: new Set(), topic: new Set() };
  const update = searcher(found, selected);
  const open = () => (panel.hidden = false);
  root.hidden = false;

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    open();
    clearTimeout(timer);
    timer = setTimeout(() => void update(), 120);
  });
  input.addEventListener('focus', () => {
    open();
    void loadPagefind().catch(() => undefined);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    list.querySelector('a')?.focus();
  });
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const name = chip.dataset.filter ?? '';
      // Own keys only: a chip named "constructor" must not reach Object's prototype.
      const group = Object.hasOwn(selected, name) ? selected[name] : undefined;
      const value = chip.dataset.value ?? '';
      if (!group) return;
      const on = !group.has(value);
      if (on) group.add(value);
      else group.delete(value);
      chip.setAttribute('aria-pressed', String(on));
      open();
      void update();
    });
  }
  clear.addEventListener('click', () => {
    for (const group of Object.values(selected)) group.clear();
    for (const chip of chips) chip.setAttribute('aria-pressed', 'false');
    open();
    input.focus();
    void update();
  });
  closeWhenLeft(root, found);
  // "/" focuses the box. Ctrl/Cmd+K belongs to the site's command menu (M4.7), which hands its
  // query over as ?q= when the visitor asks it to search the posts.
  addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
  const handed = new URLSearchParams(location.search).get('q')?.slice(0, 120);
  if (handed) {
    input.value = handed;
    input.focus();
    open();
    void update();
  }
};
