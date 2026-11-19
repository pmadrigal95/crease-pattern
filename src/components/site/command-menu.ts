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
const loadIndex = (): Promise<Index> => {
  index ??= fetch('/commands.json')
    .then((r) => (r.ok ? (r.json() as Promise<Index>) : Promise.reject(new Error(`commands: ${r.status}`))))
    .catch((error: unknown) => {
      index = null;
      throw error;
    });
  return index;
};

let menu: { open: (from: HTMLElement | null) => void } | null = null;

/** Opens the menu, building it the first time; focus goes back to `from` when it closes. */
export const openCommandMenu = (strings: CommandStrings, from: HTMLElement | null) => {
  menu ??= build(strings);
  menu.open(from);
};

/** The dialog and its parts, appended to the page once. */
const createDialog = (t: CommandStrings) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styles);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>) => {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    return el;
  };
  const dialog = element('dialog', { class: 'cmdk', 'aria-label': t.label });
  const input = element('input', {
    type: 'text',
    placeholder: t.placeholder,
    autocomplete: 'off',
    spellcheck: 'false',
    role: 'combobox',
    'aria-label': t.label,
    'aria-expanded': 'true',
    'aria-controls': 'cmdk-list',
    'aria-autocomplete': 'list',
  });
  const list = element('div', {
    id: 'cmdk-list',
    class: 'cmdk-list',
    role: 'listbox',
    'aria-label': t.label,
  });
  const status = element('p', { class: 'cmdk-status', role: 'status' });
  const hint = element('p', { class: 'cmdk-hint', 'aria-hidden': 'true' });
  hint.textContent = t.hint;
  dialog.append(input, list, status, hint);
  document.body.append(dialog);
  return { dialog, input, list, status };
};

/** What the menu can do on any page: inspect, theme, identity, language, copy the email address. */
const actionCommands = (t: CommandStrings, status: HTMLElement): Command[] => {
  const center = () => ({ x: innerWidth / 2, y: innerHeight / 2 });
  return [
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
};

const go = (href: string) => () => location.assign(href);

/** Where the menu can go: pages, their sections and posts, from /commands.json. */
const placeCommands = ({ pages, posts }: Index, t: CommandStrings): Command[] => {
  const number = (n: number) => fill(t.number, { number: padNumber(n) });
  return [
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
      context: `${number(p.number)} ${p.description}`,
      aside: number(p.number),
      run: go(p.href),
    })),
  ];
};

/** With a query, the last option hands it to Precrease's full-text search. */
const searchCommand = (query: string, t: CommandStrings): Command => ({
  group: 'posts',
  label: fill(t.actions.searchPosts, { query }),
  run: go(`${localize('/precrease', langOfPath(location.pathname))}?q=${encodeURIComponent(query)}`),
});

const optionId = (i: number) => `cmdk-option-${i}`;

/** The listbox's options, grouped under their headings; `on` hears a pointer moving over or clicking one. */
const renderOptions = (
  list: HTMLElement,
  shown: readonly Command[],
  t: CommandStrings,
  on: (i: number, how: 'move' | 'click') => void,
) => {
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
    const label = document.createElement('span');
    label.textContent = command.label;
    option.append(label);
    if (command.aside) {
      const aside = document.createElement('span');
      aside.className = 'cmdk-aside';
      aside.textContent = command.aside;
      option.append(aside);
    }
    option.addEventListener('pointermove', () => on(i, 'move'));
    option.addEventListener('click', () => on(i, 'click'));
    group.append(option);
  });
};

/** The menu: what's shown for the query, which option is active, and the keys that move it. */
const build = (t: CommandStrings) => {
  const { dialog, input, list, status } = createDialog(t);
  const actions = actionCommands(t, status);
  let places: Command[] = [];
  const indexReady = loadIndex()
    .then((index) => void (places = placeCommands(index, t)))
    .catch(() => undefined); // offline: the actions still work

  let shown: Command[] = [];
  let active = 0;
  const render = () => {
    const query = input.value.trim();
    const matched = rank([...actions, ...places], query);
    // Without a query, sections and posts wait: actions and pages are the starting points.
    shown = query
      ? [...matched, searchCommand(query, t)]
      : matched.filter((c) => c.group === 'actions' || c.group === 'pages');
    active = Math.min(active, Math.max(0, shown.length - 1));
    renderOptions(list, shown, t, (i, how) => (how === 'move' ? select(i) : runAt(i)));
    const count = shown.length;
    status.textContent = count === 0 ? t.empty : fill(count === 1 ? t.one : t.many, { count });
    select(active);
  };
  const select = (i: number) => {
    if (!shown.length) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    active = (i + shown.length) % shown.length;
    for (const option of list.querySelectorAll('[role="option"]'))
      option.setAttribute('aria-selected', String(option.id === optionId(active)));
    input.setAttribute('aria-activedescendant', optionId(active));
    document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  };
  const runAt = (i: number) => {
    const command = shown[i];
    if (!command) return;
    if (command.label !== t.actions.copyEmail) dialog.close();
    command.run();
  };

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
};
