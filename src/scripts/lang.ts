/**
 * The visitor's language (M5, decision 2: suggest, then remember). Nothing here redirects a page:
 *
 * - Choosing a language with a switch (masthead, footer, the suggestion, ⌘K) is remembered in
 *   localStorage as `pm.lang`, and only then; restore-identity.ts reads it to open the home page
 *   in that language. A first visit and a shared link always open the page they point to.
 * - A page with a pair in the other language suggests it once, when the browser's languages prefer
 *   it and the visitor hasn't chosen yet. Dismissing it is remembered as `pm.langHint`.
 *
 * Both are declared on /privacy. No cookies.
 */
import { preferredLang } from '../lib/i18n';

export const LANG_KEY = 'pm.lang';
const HINT_KEY = 'pm.langHint';

// Storage can be unavailable (private modes, blocked site data): the switch still navigates.
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* not remembered */
  }
};

/** Remembers an explicit language choice. */
export const rememberLang = (lang: string) => write(LANG_KEY, lang);

export function initLanguage(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]'))
    link.addEventListener('click', () => rememberLang(link.dataset.langSwitch ?? ''));

  const hint = document.querySelector<HTMLElement>('[data-lang-suggest]');
  if (!hint || read(LANG_KEY) || read(HINT_KEY)) return;
  if (preferredLang(navigator.languages) !== hint.dataset.langSuggest) return;
  hint.hidden = false;
  hint.querySelector('[data-lang-dismiss]')?.addEventListener('click', () => {
    write(HINT_KEY, 'dismissed');
    hint.hidden = true;
  });
}
