/**
 * The site's two languages (M5, 22-m5-plan.md). English lives at the root, Spanish under /es/,
 * page for page: `/about` and `/es/about` are the same page (decision 1), so a path changes
 * language by adding or dropping the prefix. Posts are the exception, with a slug of their own
 * per language, and say who their pair is (`translationOf`).
 *
 * Pure functions, no DOM: pages, layouts and browser scripts share them.
 */
export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

/** The value <html lang> and hreflang take for each language. */
export const htmlLang: Record<Lang, string> = { en: 'en', es: 'es' };

/** Astro.currentLocale (or any string) → a language the site has; anything else is English. */
export const langOf = (locale: string | undefined | null): Lang =>
  (LANGS as readonly string[]).includes(locale ?? '') ? (locale as Lang) : DEFAULT_LANG;

/** A site path without its language prefix: "/es/about" → "/about", "/es" → "/". */
export function unlocalize(path: string): string {
  const stripped = path.replace(/^\/es(?=\/|$)/, '');
  return stripped === '' ? '/' : stripped;
}

/** The same site path in `lang`: ("/about", "es") → "/es/about"; ("/", "es") → "/es". */
export function localize(path: string, lang: Lang): string {
  const base = unlocalize(path);
  if (lang === DEFAULT_LANG) return base;
  return base === '/' ? `/${lang}` : `/${lang}${base}`;
}

/** The language a site path is in. */
export const langOfPath = (path: string): Lang => (/^\/es(?=\/|$)/.test(path) ? 'es' : DEFAULT_LANG);

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'es' : 'en');

/**
 * getStaticPaths for a page that exists in every language: `[...locale]` is empty for English
 * (the root) and "es" for Spanish.
 */
export const localeStaticPaths = () =>
  LANGS.map((lang) => ({ params: { locale: lang === DEFAULT_LANG ? undefined : lang } }));

/** Where a page lives in each language it exists in. */
export type Translations = Partial<Record<Lang, string>>;

/**
 * The languages a page exists in. Pages under src/pages/[...locale]/ exist in both, at the same
 * path (decision 1); any other page only in its own, unless it names its pairs (`own`), as a post
 * with a translation does.
 */
export function translationsOf(path: string, routePattern: string, own?: Translations): Translations {
  if (own) return own;
  if (routePattern.includes('[...locale]'))
    return Object.fromEntries(LANGS.map((lang) => [lang, localize(path, lang)])) as Translations;
  return { [langOfPath(path)]: path };
}

/**
 * Where the language switch leads from a page: its pair, or, when it has none, the closest page
 * that has one (Precrease's index for a post, the home page otherwise).
 */
export function switchTarget(path: string, translations: Translations, lang: Lang): string {
  const pair = translations[lang];
  if (pair) return pair;
  return localize(unlocalize(path).startsWith('/precrease') ? '/precrease' : '/', lang);
}

/** The first of the visitor's languages (navigator.languages) the site has, or null. */
export function preferredLang(languages: readonly string[]): Lang | null {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if ((LANGS as readonly string[]).includes(base ?? '')) return base as Lang;
  }
  return null;
}
