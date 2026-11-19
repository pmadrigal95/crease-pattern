/**
 * The visitor's language (M5, decision 2: suggest, then remember). Nothing here redirects a page:
 *
 * - Choosing a language with a switch (masthead, footer, the suggestion, ⌘K) is remembered in
 *   localStorage as `pm.lang`, and only then; restore-identity.ts reads it to open the home page
 *   in that language. A first visit and a shared link always open the page they point to.
 * - A page with a pair in the browser's preferred language suggests it once, when the visitor
 *   hasn't chosen a language yet. Dismissing it is remembered as `pm.langHint`.
 *
 * Both are declared on /privacy. No cookies.
 */
import { preferredLang } from '../i18n/routing';

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

export const initLanguage = (): void => {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]'))
    link.addEventListener('click', () => rememberLang(link.dataset.langSwitch ?? ''));

  if (read(LANG_KEY) || read(HINT_KEY)) return;
  const preferred = preferredLang(navigator.languages);
  const hint = preferred && document.querySelector<HTMLElement>(`[data-lang-suggest="${preferred}"]`);
  if (!hint) return;
  hint.hidden = false;
  hint.querySelector('[data-lang-dismiss]')?.addEventListener('click', () => {
    write(HINT_KEY, 'dismissed');
    hint.hidden = true;
  });
};
