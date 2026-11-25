/**
 * The walkthrough: seven stops that tell the site's thesis across its pages
 * (src/config/walkthrough.ts), each a coach mark (coachmark.ts) beside the part it explains.
 * Started by the visitor (the Inspector, the command menu, the first-visit tip), or once on its own
 * on a first visit to the home page (first-tip.ts): then its first stop takes no focus, moves
 * nothing and offers to skip it. The arrow keys or Enter move on, Escape leaves, and focus goes
 * back where it was.
 *
 * Between pages the stop rides in sessionStorage (pm.walkthrough, /privacy); the masthead's script
 * resumes it on the next page, and it's gone when the walkthrough ends or the tab closes. Its words
 * come per language from /walkthrough.json, shared with the first-visit tip.
 */
import { STOPS } from '../../config/walkthrough';
import { fill } from '../../lib/template';
import { openCoachmark, type Coachmark } from './coachmark';
import { walkthroughStrings, prefix, type WalkthroughStrings } from './walkthrough-strings';

const KEY = 'pm.walkthrough';

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
const visible = (el: Element | null): el is Element => el !== null && el.getClientRects().length > 0;

let mark: Coachmark | null = null;
let returnFocus: HTMLElement | null = null;
/** Started on its own: the first stop stays quiet until the visitor moves on. */
let auto = false;
let keys: ((e: KeyboardEvent) => void) | null = null;

const end = () => {
  mark?.close();
  mark = null;
  if (keys) removeEventListener('keydown', keys);
  keys = null;
  save(null);
  auto = false;
  returnFocus?.focus();
  returnFocus = null;
};

const show = (i: number, t: WalkthroughStrings, go: (i: number) => void) => {
  const stop = STOPS[i];
  const target = stop ? document.querySelector(stop.anchor) : null;
  if (!stop) return end();
  // A stop whose part isn't on this page at this size is skipped.
  if (!visible(target)) return go(i + 1);
  mark ??= openCoachmark({ closeLabel: t.close, dim: true, onClose: end });
  const last = i === STOPS.length - 1;
  const quiet = auto && i === 0;
  mark.show(
    target,
    {
      ...t.stops[stop.key],
      progress: {
        at: i,
        total: STOPS.length,
        text: `${t.label}, ${fill(t.count, { n: i + 1, total: STOPS.length })}`,
      },
      actions: [
        ...(i > 0 ? [{ label: t.back, run: () => go(i - 1) }] : []),
        ...(quiet ? [{ label: t.skip, run: end }] : []),
        { label: last ? t.finish : t.next, primary: true, run: () => (last ? end() : go(i + 1)) },
      ],
    },
    quiet,
  );
  if (keys) removeEventListener('keydown', keys);
  keys = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowRight') (last ? end : () => go(i + 1))();
    else if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
  };
  addEventListener('keydown', keys);
};

const go = (i: number): void => {
  const stop = STOPS[i];
  if (!stop) return end();
  if (i > 0) auto = false;
  save(i);
  if (stop.page !== null && here() !== stop.page) {
    location.assign(`${prefix()}${stop.page === '/' ? '' : stop.page}` || '/');
    return;
  }
  void walkthroughStrings().then((t) => show(i, t, go));
};

/** Starts at the first stop; `auto` when the site starts it, on a first visit. */
export const startWalkthrough = (options: { auto?: boolean } = {}): void => {
  auto = options.auto ?? false;
  returnFocus = auto || !(document.activeElement instanceof HTMLElement) ? null : document.activeElement;
  go(0);
};

/** Picks the walkthrough up on a new page, if one is under way (src/scripts/masthead.ts). */
export const resumeWalkthrough = (): void => {
  const i = saved();
  if (i !== null) go(i);
};
