/**
 * The walkthrough's and the first-visit tip's words in the page's language
 * (src/pages/[...locale]/walkthrough.json.ts), fetched once when either first needs them.
 */
import type { StopKey } from '../../config/walkthrough';

export interface WalkthroughStrings {
  label: string;
  count: string;
  back: string;
  next: string;
  skip: string;
  finish: string;
  close: string;
  stops: Record<StopKey, { title: string; body: string }>;
  tip: { title: string; keys: string; touch: string; start: string; later: string };
}

/** The language prefix, from the masthead's home link: "" or "/es". */
export const prefix = (): string => {
  const home = document.querySelector('.mast .me')?.getAttribute('href') ?? '/';
  return home === '/' ? '' : home;
};

let words: Promise<WalkthroughStrings> | null = null;
export const walkthroughStrings = (): Promise<WalkthroughStrings> =>
  (words ??= fetch(`${prefix()}/walkthrough.json`).then((r) => r.json() as Promise<WalkthroughStrings>));
