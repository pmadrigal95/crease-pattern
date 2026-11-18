/**
 * The site's languages, declared once (R1). Everything else (routes, <html lang>, hreflang, number
 * and date formats, the language switch, the dictionaries' validation) is derived from this table,
 * so adding a language is one entry here plus its folder in ./locales and its pages in
 * src/content/pages; the tests list anything still missing.
 *
 * Client-safe: no dictionaries, no content. Browser scripts import it through ./routing.
 */
export interface LocaleInfo {
  /** The language's name in itself, as the switch shows it: "Español". */
  readonly name: string;
  /** Two letters for tight spaces: "ES". */
  readonly code: string;
  /** <html lang> and hreflang. */
  readonly htmlLang: string;
  /** Open Graph's og:locale. */
  readonly ogLocale: string;
  /** BCP 47 locale for Intl: dates and numbers as written where the site's readers are. */
  readonly intl: string;
}

export const LOCALES = {
  en: { name: 'English', code: 'EN', htmlLang: 'en', ogLocale: 'en_US', intl: 'en' },
  es: { name: 'Español', code: 'ES', htmlLang: 'es', ogLocale: 'es_CR', intl: 'es-CR' },
} as const satisfies Record<string, LocaleInfo>;

export type Lang = keyof typeof LOCALES;

/** English lives at the root of the site; every other language under /<lang>/. */
export const DEFAULT_LANG: Lang = 'en';

export const LANGS = Object.keys(LOCALES) as [Lang, ...Lang[]];

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && Object.hasOwn(LOCALES, value);
