/**
 * Where each page lives in each language (M5, decision 1). English at the root, every other
 * language under /<lang>/, page for page: `/about` and `/es/about` are the same page, so a path
 * changes language by adding or dropping its prefix. Posts are the exception: a slug of their
 * own per language, pairs named by `translationOf`.
 *
 * Pure functions over ./config: pages, layouts and browser scripts share them.
 */
import { DEFAULT_LANG, LANGS, isLang, type Lang } from './config';

export { DEFAULT_LANG, LANGS, LOCALES, commandIndexPath, isLang, type Lang } from './config';

/** The prefixed languages, as a pattern: /^\/(es)(?=\/|$)/. */
const PREFIX = new RegExp(`^/(${LANGS.filter((l) => l !== DEFAULT_LANG).join('|')})(?=/|$)`);

/** Astro.currentLocale (or any string) → a language the site has; anything else is the default. */
export const langOf = (locale: string | undefined | null): Lang => (isLang(locale) ? locale : DEFAULT_LANG);

/** The language a site path is in. */
export const langOfPath = (path: string): Lang => langOf(PREFIX.exec(path)?.[1]);

/** A site path without its language prefix: "/es/about" → "/about", "/es" → "/". */
export const unlocalize = (path: string): string => {
  const stripped = path.replace(PREFIX, '');
  return stripped === '' ? '/' : stripped;
};

/** The same site path in `lang`: ("/about", "es") → "/es/about"; ("/", "es") → "/es". */
export const localize = (path: string, lang: Lang): string => {
  const base = unlocalize(path);
  if (lang === DEFAULT_LANG) return base;
  return base === '/' ? `/${lang}` : `/${lang}${base}`;
};

/** The Inspector's words in `lang` (src/pages/[...locale]/inspector-strings.json.ts). */
export const inspectorStringsPath = (lang: Lang): string => localize('/inspector-strings.json', lang);

/**
 * getStaticPaths for a page that exists in every language: `[...locale]` is empty for the default
 * language (the root) and the language's code for the others.
 */
export const localeStaticPaths = () =>
  LANGS.map((lang) => ({ params: { locale: lang === DEFAULT_LANG ? undefined : lang } }));

/** Where a page lives in each language it exists in. */
export type Translations = Partial<Record<Lang, string>>;

/**
 * The languages a page exists in. Pages under src/pages/[...locale]/ exist in all of them, at the
 * same path; any other page only in its own, unless it names its pairs (`own`), as a translated
 * post does.
 */
export const translationsOf = (path: string, routePattern: string, own?: Translations): Translations => {
  if (own) return own;
  if (routePattern.includes('[...locale]'))
    return Object.fromEntries(LANGS.map((lang) => [lang, localize(path, lang)])) as Translations;
  return { [langOfPath(path)]: path };
};

/**
 * Where the language switch leads from a page: its pair, or, when it has none, the closest page
 * that has one (Precrease's index for a post, the home page otherwise).
 */
export const switchTarget = (path: string, translations: Translations, lang: Lang): string => {
  const pair = translations[lang];
  if (pair) return pair;
  return localize(unlocalize(path).startsWith('/precrease') ? '/precrease' : '/', lang);
};

/** The first of the visitor's languages (navigator.languages) the site has, or null. */
export const preferredLang = (languages: readonly string[]): Lang | null => {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return null;
};

/** One entry per language for a page's language switch: where it leads, and whether it's this page. */
export interface LanguageLink {
  lang: Lang;
  href: string;
  current: boolean;
}

/** The language switch for the page at `path` in `current` (masthead, footer, ⌘K). */
export const languageLinks = (path: string, translations: Translations, current: Lang): LanguageLink[] =>
  LANGS.map((lang) => ({
    lang,
    href: lang === current ? path : switchTarget(path, translations, lang),
    current: lang === current,
  }));
