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

/** Where scripts/build-search-index.mjs writes the bundle. */
import { readJsonData } from './dom';
import { formatCount } from './format';
import { isTypingTarget } from './keyboard';
import { fill } from './template';

const BUNDLE = '/pagefind/pagefind.js';
const MAX_RESULTS = 8;

/** Pagefind reports file URLs (`/precrease/slug.html`); the site serves them without `.html`. */
export function resultHref(url: string): string {
  const clean = url.replace(/(?:\/index)?\.html(?=$|[?#])/, '');
  return clean === '' ? '/' : clean;
}

/** Selected chips → Pagefind filters, leaving out groups with nothing selected. */
export function toFilters(selected: Record<string, Set<string>>): Record<string, { any: string[] }> {
  const filters: Record<string, { any: string[] }> = {};
  for (const [group, values] of Object.entries(selected)) {
    if (values.size > 0) filters[group] = { any: [...values].sort() };
  }
  return filters;
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", amp: '&' };

/**
 * Splits a Pagefind excerpt into plain and highlighted runs. The excerpt is HTML with `<mark>`
 * around matches; this walks it once, keeps `<mark>` as the only meaning a tag can have, skips
 * every other tag, and decodes entities in a single pass (so `&amp;lt;` stays the text `&lt;`).
 * The runs are rendered as text nodes, never parsed as HTML.
 */
export function excerptRuns(excerpt: string): { text: string; marked: boolean }[] {
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
}

export function initPrecreaseSearch(): void {
  const root = document.querySelector<HTMLElement>('[data-precrease-search]');
  if (!root) return;
  const input = root.querySelector<HTMLInputElement>('input[type="search"]');
  const panel = root.querySelector<HTMLElement>('.panel');
  const status = root.querySelector<HTMLElement>('.status');
  const list = root.querySelector<HTMLOListElement>('.results');
  const clear = root.querySelector<HTMLButtonElement>('[data-clear]');
  const form = root.querySelector('form');
  if (!input || !panel || !status || !list || !clear || !form) return;
  const data = readJsonData<Strings | null>(root, 'strings', null);
  if (!data) return;
  const strings: Strings = data;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const selected: Record<string, Set<string>> = { format: new Set(), topic: new Set() };

  root.hidden = false;

  let pagefind: Promise<Pagefind> | null = null;
  const load = () => {
    pagefind ??= import(/* @vite-ignore */ BUNDLE).then(async (module: Pagefind) => {
      await module.options({ excerptLength: 24 });
      return module;
    });
    return pagefind;
  };

  const open = () => {
    panel.hidden = false;
  };
  const close = () => {
    panel.hidden = true;
  };

  let run = 0;
  async function update() {
    const query = input!.value.trim();
    const filters = toFilters(selected);
    const filtering = Object.keys(filters).length > 0;
    clear!.hidden = !filtering;
    if (!query && !filtering) {
      status!.textContent = '';
      list!.replaceChildren();
      return;
    }
    const current = ++run;
    status!.textContent = strings.loading;
    try {
      const api = await load();
      const found = await api.search(query || null, { filters });
      if (!found || current !== run) return;
      const data = await Promise.all(found.results.slice(0, MAX_RESULTS).map((r) => r.data()));
      if (current !== run) return;
      const total = found.results.length;
      status!.textContent = formatCount(total, { zero: strings.none, one: strings.one, many: strings.many });
      list!.replaceChildren(...data.map(renderResult));
    } catch (error) {
      if (current !== run) return;
      console.error('Precrease search failed to load', error);
      status!.textContent = strings.failed;
      list!.replaceChildren();
    }
  }

  function renderResult(result: PagefindResult): HTMLLIElement {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = resultHref(result.url);
    const kicker = document.createElement('span');
    kicker.className = 'r-kicker';
    const parts = [
      result.meta.number ? fill(strings.number, { number: result.meta.number }) : '',
      result.meta.format ? (strings.formats[result.meta.format] ?? '') : '',
    ].filter(Boolean);
    kicker.textContent = parts.join(' · ');
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
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    open();
    clearTimeout(timer);
    timer = setTimeout(() => void update(), 120);
  });
  input.addEventListener('focus', () => {
    open();
    void load().catch(() => undefined);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    list.querySelector('a')?.focus();
  });
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const group = selected[chip.dataset.filter ?? ''];
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
  addEventListener('keydown', (e) => {
    const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;
    const commandK = e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey;
    if ((!slash && !commandK) || (slash && isTypingTarget(e.target))) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
}
