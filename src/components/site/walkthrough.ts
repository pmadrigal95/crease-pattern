/**
 * The walkthrough: seven stops that tell the site's thesis across its pages (src/config/walkthrough.ts),
 * started only by the visitor, from the Inspector or the command menu. A card beside each stop
 * (a non-modal dialog: the page stays usable) and a ring around what it points at. The arrow keys
 * or Enter move on, Escape leaves, and focus goes back where it was.
 *
 * Between pages the stop number rides in sessionStorage (pm.walkthrough, /privacy); the masthead's
 * script resumes it on the next page and it's gone when the walkthrough ends or the tab closes.
 * Loaded on demand, with its words (/walkthrough.json per language) and its styles.
 */
import './walkthrough.css';
import { STOPS, type StopKey } from '../../config/walkthrough';
import { fill } from '../../lib/template';

const KEY = 'pm.walkthrough';
type Strings = {
  label: string;
  count: string;
  back: string;
  next: string;
  finish: string;
  close: string;
  stops: Record<StopKey, { title: string; body: string }>;
};

/** The language prefix, from the masthead's home link: "" or "/es". */
const prefix = () => {
  const home = document.querySelector('.mast .me')?.getAttribute('href') ?? '/';
  return home === '/' ? '' : home;
};
/** This page's path without its language prefix or a trailing .html. */
const here = () => location.pathname.replace(/\.html$/, '').slice(prefix().length) || '/';
const save = (i: number | null) => {
  try {
    if (i === null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(i));
  } catch {
    // Storage blocked: the walkthrough still runs on this page.
  }
};
const saved = (): number | null => {
  try {
    const value = sessionStorage.getItem(KEY);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
};

let words: Promise<Strings> | null = null;
const strings = () =>
  (words ??= fetch(`${prefix()}/walkthrough.json`).then((r) => r.json() as Promise<Strings>));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let ui: { card: HTMLElement; ring: HTMLElement; off: () => void } | null = null;
let returnFocus: HTMLElement | null = null;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') => {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
};

const close = () => {
  ui?.off();
  ui?.card.remove();
  ui?.ring.remove();
  ui = null;
  save(null);
  returnFocus?.focus();
  returnFocus = null;
};

/**
 * Puts the ring around the target and the card where it covers nothing: below, above, to the left
 * or to the right of it, in that order; on a target taller than the screen, at its bottom edge.
 */
const place = (target: Element, card: HTMLElement, ring: HTMLElement) => {
  const r = target.getBoundingClientRect();
  const pad = 8;
  const gap = pad + 12;
  Object.assign(ring.style, {
    left: `${r.left - pad}px`,
    top: `${r.top - pad}px`,
    width: `${r.width + pad * 2}px`,
    height: `${r.height + pad * 2}px`,
  });
  const { width: w, height: h } = card.getBoundingClientRect();
  const clampX = (x: number) => Math.min(Math.max(12, x), innerWidth - w - 12);
  const clampY = (y: number) => Math.min(Math.max(72, y), innerHeight - h - 12);
  const spots = [
    { fits: r.bottom + gap + h < innerHeight, x: clampX(r.left), y: r.bottom + gap },
    { fits: r.top - gap - h > 72, x: clampX(r.left), y: r.top - gap - h },
    { fits: r.left - gap - w > 12, x: r.left - gap - w, y: clampY(r.top) },
    { fits: r.right + gap + w < innerWidth, x: r.right + gap, y: clampY(r.top) },
  ];
  const spot = spots.find((s) => s.fits) ?? { x: clampX(r.left), y: innerHeight - h - 12 };
  Object.assign(card.style, { left: `${spot.x}px`, top: `${spot.y}px` });
};

const go = (i: number): void => {
  const stop = STOPS[i];
  if (!stop) return close();
  save(i);
  if (stop.page !== null && here() !== stop.page) {
    location.assign(`${prefix()}${stop.page === '/' ? '' : stop.page}` || '/');
    return;
  }
  void strings().then((t) => show(i, t));
};

const show = (i: number, t: Strings) => {
  const stop = STOPS[i];
  if (!stop) return close();
  const target = document.querySelector(stop.anchor);
  // A stop whose part isn't on this page (hidden at this size, say) is skipped.
  if (!target || !(target as HTMLElement).getClientRects().length) return go(i + 1);
  ui?.off();
  ui?.card.remove();
  ui?.ring.remove();

  const ring = element('div', 'wt-ring');
  ring.setAttribute('aria-hidden', 'true');
  const card = element('div', 'wt-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-labelledby', 'wt-title');
  const label = element('p', 'wt-label', `${t.label} · ${fill(t.count, { n: i + 1, total: STOPS.length })}`);
  const title = element('h2', 'wt-title', t.stops[stop.key].title);
  title.id = 'wt-title';
  title.tabIndex = -1;
  const body = element('p', 'wt-body', t.stops[stop.key].body);
  const actions = element('div', 'wt-actions');
  const last = i === STOPS.length - 1;
  const back = element('button', 'wt-back', t.back);
  back.type = 'button';
  back.hidden = i === 0;
  back.addEventListener('click', () => go(i - 1));
  const next = element('button', 'wt-next', last ? t.finish : t.next);
  next.type = 'button';
  next.addEventListener('click', () => (last ? close() : go(i + 1)));
  const quit = element('button', 'wt-close', '×');
  quit.type = 'button';
  quit.setAttribute('aria-label', t.close);
  quit.addEventListener('click', close);
  actions.append(back, next);
  card.append(quit, label, title, body, actions);
  document.body.append(ring, card);

  target.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
  let frame = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => place(target, card, ring));
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) next.click();
    else if (e.key === 'ArrowLeft' && i > 0 && !(e.target instanceof HTMLInputElement)) go(i - 1);
  };
  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', follow);
  addEventListener('keydown', keys);
  ui = {
    card,
    ring,
    off: () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', follow);
      removeEventListener('resize', follow);
      removeEventListener('keydown', keys);
    },
  };
  place(target, card, ring);
  // After a smooth scroll the target has moved: place again, then hand focus to the card.
  setTimeout(
    () => {
      place(target, card, ring);
      title.focus({ preventScroll: true });
    },
    reduce() ? 0 : 450,
  );
};

/** Starts at the first stop; from the Inspector or the command menu. */
export const startWalkthrough = (): void => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  go(0);
};

/** Picks the walkthrough up on a new page, if one is under way (src/scripts/masthead.ts). */
export const resumeWalkthrough = (): void => {
  const i = saved();
  if (i !== null) go(i);
};
