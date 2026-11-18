/**
 * ⌘K (M4.7): one menu, one shortcut, every page. Loaded with a dynamic import the first time a
 * visitor presses Ctrl/Cmd+K or the commands button (src/components/site/Masthead.astro); its
 * weight has its own budget (commandMenu, src/config/quality.ts). It finds pages, their sections
 * and Precrease posts from /commands.json (scripts/build-command-index.ts), and runs a few
 * actions: inspect the page, switch theme or identity, copy the email address, or hand a query to
 * Precrease's full-text search.
 *
 * A native <dialog> keeps focus inside and closes on Escape; the input is a combobox and the
 * options a listbox, so arrow keys move through them while typing.
 */
import styles from './command-menu.css?inline';
import { rank, type Searchable } from '../../lib/command-match';
import { setDirection, setTheme, type Theme } from '../inspector/identity';
import { allVisualDirections, type VisualDirection } from '../../config/visual-direction';
import { fill } from '../../lib/template';
import { padNumber } from '../../lib/format';
import { langOfPath, localize } from '../../i18n/routing';

export interface CommandStrings {
  label: string;
  placeholder: string;
  groups: { actions: string; pages: string; sections: string; posts: string };
  actions: {
    inspect: string;
    light: string;
    dark: string;
    system: string;
    identity: string;
    copyEmail: string;
    searchPosts: string;
  };
  copied: string;
  empty: string;
  hint: string;
  one: string;
  many: string;
  number: string;
  email: string;
  /** Read this page in each other language, worded in that language. */
  languages: { lang: string; label: string }[];
  /** Each identity's name, in the page's language. */
  identities: Record<VisualDirection, string>;
}

interface Index {
  pages: { title: string; href: string; sections: { title: string; href: string }[] }[];
  posts: { title: string; href: string; number: number; description: string }[];
}

interface Command extends Searchable {
  group: keyof CommandStrings['groups'];
  /** A shortcut or a place, shown at the end of the row. */
  aside?: string;
  run: () => void;
}

let index: Promise<Index> | null = null;
/** Starts (or reuses) the index's download; a failed one is forgotten, so the next open retries. */
function loadIndex(): Promise<Index> {
  index ??= fetch('/commands.json')
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : Promise.reject(new Error(`commands: ${r.status}`))))
    .catch((error: unknown) => {
      index = null;
      throw error;
    });
  return index;
}

let menu: { open: (from: HTMLElement | null) => void } | null = null;

/** Opens the menu, building it the first time; focus goes back to `from` when it closes. */
export function openCommandMenu(strings: CommandStrings, from: HTMLElement | null) {
  menu ??= build(strings);
  menu.open(from);
}

function build(t: CommandStrings) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  const dialog = document.createElement('dialog');
  dialog.className = 'cmdk';
  dialog.setAttribute('aria-label', t.label);
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t.placeholder;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', t.label);
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'cmdk-list');
  input.setAttribute('aria-autocomplete', 'list');
  const list = document.createElement('div');
  list.id = 'cmdk-list';
  list.className = 'cmdk-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', t.label);
  const status = document.createElement('p');
  status.className = 'cmdk-status';
  status.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.className = 'cmdk-hint';
  hint.textContent = t.hint;
  hint.setAttribute('aria-hidden', 'true');
  dialog.append(input, list, status, hint);
  document.body.append(dialog);

  // ---------- The commands: actions first, then places ----------
  const center = () => ({ x: innerWidth / 2, y: innerHeight / 2 });
  const actions: Command[] = [
    {
      group: 'actions',
      label: t.actions.inspect,
      aside: 'Shift I',
      run: () => document.querySelector<HTMLButtonElement>('[data-inspector-toggle]')?.click(),
    },
    ...(['light', 'dark', 'system'] as Theme[]).map((theme) => ({
      group: 'actions' as const,
      label: t.actions[theme],
      context: 'theme',
      run: () => setTheme(theme, center()),
    })),
    ...allVisualDirections.map((id) => ({
      group: 'actions' as const,
      label: fill(t.actions.identity, { name: t.identities[id] }),
      context: 'identity',
      run: () => setDirection(id, center()),
    })),
    ...t.languages.map(({ lang, label }) => ({
      group: 'actions' as const,
      label,
      context: `language idioma ${lang}`,
      // The masthead's switch: it knows this page's pair and remembers the choice.
      run: () => document.querySelector<HTMLAnchorElement>(`.mast [data-lang-switch="${lang}"]`)?.click(),
    })),
    {
      group: 'actions',
      label: t.actions.copyEmail,
      context: 'contact mail',
      run: () => {
        void navigator.clipboard?.writeText(t.email).then(() => (status.textContent = t.copied));
      },
    },
  ];
  let places: Command[] = [];
  const go = (href: string) => () => location.assign(href);
  const indexReady = loadIndex()
    .then(({ pages, posts }) => {
      places = [
        ...pages.map((p) => ({ group: 'pages' as const, label: p.title, aside: p.href, run: go(p.href) })),
        ...pages.flatMap((p) =>
          p.sections.map((s) => ({
            group: 'sections' as const,
            label: s.title,
            context: p.title,
            aside: p.title,
            run: go(s.href),
          })),
        ),
        ...posts.map((p) => ({
          group: 'posts' as const,
          label: p.title,
          context: `${fill(t.number, { number: padNumber(p.number) })} ${p.description}`,
          aside: fill(t.number, { number: padNumber(p.number) }),
          run: go(p.href),
        })),
      ];
    })
    .catch(() => undefined); // offline: the actions still work

  // ---------- Rendering ----------
  let shown: Command[] = [];
  let active = 0;
  const optionId = (i: number) => `cmdk-option-${i}`;
  function render() {
    const query = input.value.trim();
    const matched = rank([...actions, ...places], query);
    // With a query, the last option hands it to Precrease's full-text search.
    const search: Command[] = query
      ? [
          {
            group: 'posts',
            label: fill(t.actions.searchPosts, { query }),
            run: go(
              `${localize('/precrease', langOfPath(location.pathname))}?q=${encodeURIComponent(query)}`,
            ),
          },
        ]
      : [];
    // Without a query, sections and posts wait: actions and pages are the starting points.
    shown = [
      ...(query ? matched : matched.filter((c) => c.group === 'actions' || c.group === 'pages')),
      ...search,
    ];
    active = Math.min(active, Math.max(0, shown.length - 1));
    const groups = new Map<string, HTMLElement>();
    list.replaceChildren();
    shown.forEach((command, i) => {
      let group = groups.get(command.group);
      if (!group) {
        group = document.createElement('div');
        group.setAttribute('role', 'group');
        const heading = document.createElement('p');
        heading.className = 'cmdk-group';
        heading.id = `cmdk-group-${command.group}`;
        heading.textContent = t.groups[command.group];
        group.setAttribute('aria-labelledby', heading.id);
        group.append(heading);
        groups.set(command.group, group);
        list.append(group);
      }
      const option = document.createElement('div');
      option.id = optionId(i);
      option.className = 'cmdk-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(i === active));
      const label = document.createElement('span');
      label.textContent = command.label;
      option.append(label);
      if (command.aside) {
        const aside = document.createElement('span');
        aside.className = 'cmdk-aside';
        aside.textContent = command.aside;
        option.append(aside);
      }
      option.addEventListener('pointermove', () => select(i));
      option.addEventListener('click', () => runAt(i));
      group.append(option);
    });
    const count = shown.length;
    status.textContent = count === 0 ? t.empty : fill(count === 1 ? t.one : t.many, { count });
    select(active);
  }
  function select(i: number) {
    if (!shown.length) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = (i + shown.length) % shown.length;
    for (const option of list.querySelectorAll('[role="option"]'))
      option.setAttribute('aria-selected', String(option.id === optionId(active)));
    input.setAttribute('aria-activedescendant', optionId(active));
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }
  function runAt(i: number) {
    const command = shown[i];
    if (!command) return;
    const keepOpen = command.label === t.actions.copyEmail;
    if (!keepOpen) dialog.close();
    command.run();
  }

  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      select(active + step);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    }
  });
  // A click on the backdrop (the dialog element itself, outside its content) closes it.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  let returnTo: HTMLElement | null = null;
  dialog.addEventListener('close', () => returnTo?.focus());

  return {
    open(from: HTMLElement | null) {
      returnTo = from;
      input.value = '';
      active = 0;
      status.textContent = '';
      render();
      dialog.showModal();
      input.focus();
      void indexReady.then(render);
    },
  };
}
