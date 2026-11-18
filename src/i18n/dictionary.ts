/**
 * Every word the site shows, per language (R1): src/i18n/locales/<lang>/<part>.json, one folder
 * per language in ./config, the same files in each. Server-side only; browser scripts get the
 * strings they need from the page (data attributes), never this module.
 *
 * Checked when it loads, so a gap fails the build instead of showing English, or nothing, on
 * another language's page:
 * - every string is non-empty and its placeholders are well formed (`{name}`);
 * - every language has the default language's files, keys, list lengths and placeholders.
 */
import { DEFAULT_LANG, LANGS, langOf, type Lang } from './routing';
import type ui from './locales/en/ui.json';
import type career from './locales/en/career.json';
import type profile from './locales/en/profile.json';
import type taxonomy from './locales/en/taxonomy.json';

export interface Dictionary {
  ui: typeof ui;
  career: typeof career;
  profile: typeof profile;
  taxonomy: typeof taxonomy;
}
type Part = keyof Dictionary;
const PARTS: readonly Part[] = ['ui', 'career', 'profile', 'taxonomy'];

/** Interface copy: the `ui` part. */
export type Copy = Dictionary['ui'];

type Json = string | Json[] | { [key: string]: Json };

const BROKEN_PLACEHOLDER = /\{(?!\w+\})|(?<!\{\w+)\}/;
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join();

/**
 * Throws at the first place `other` doesn't match `base`: a missing or extra key, a list of another
 * length, a string where a group should be, or a string with other placeholders. `where` names the
 * file and path in the error.
 */
export function assertSameShape(base: Json, other: Json, where: string): void {
  if (typeof base === 'string') {
    if (typeof other !== 'string') throw new Error(`${where}: must be a string`);
    if (placeholders(base) !== placeholders(other)) throw new Error(`${where}: placeholders differ`);
    return;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(other) || other.length !== base.length)
      throw new Error(`${where}: must be a list of ${base.length}`);
    base.forEach((item, i) => assertSameShape(item, other[i]!, `${where}[${i}]`));
    return;
  }
  if (typeof other === 'string' || Array.isArray(other)) throw new Error(`${where}: must be a group`);
  const keys = (o: object) => Object.keys(o).sort().join();
  if (keys(base) !== keys(other)) throw new Error(`${where}: keys differ from ${DEFAULT_LANG}`);
  for (const [key, value] of Object.entries(base)) assertSameShape(value, other[key]!, `${where}.${key}`);
}

/** Throws at the first empty string or malformed placeholder. */
export function assertWellFormed(value: Json, where: string): void {
  if (typeof value === 'string') {
    if (value.trim() === '') throw new Error(`${where}: is empty`);
    if (BROKEN_PLACEHOLDER.test(value)) throw new Error(`${where}: placeholders must look like {name}`);
    return;
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [`[${i}]`, v] as const) : Object.entries(value);
  for (const [key, v] of entries) assertWellFormed(v, `${where}${key.startsWith('[') ? '' : '.'}${key}`);
}

const files = import.meta.glob<Json>('./locales/*/*.json', { eager: true, import: 'default' });
const file = (lang: string, part: string) => files[`./locales/${lang}/${part}.json`];

function load(): Record<Lang, Dictionary> {
  const folders = new Set(Object.keys(files).map((path) => path.split('/')[2]));
  for (const folder of folders)
    if (!(LANGS as readonly string[]).includes(folder!))
      throw new Error(`src/i18n/locales/${folder}/ belongs to no language in src/i18n/config.ts`);
  const byLang = {} as Record<Lang, Dictionary>;
  for (const lang of LANGS) {
    const dictionary = {} as Record<Part, Json>;
    for (const part of PARTS) {
      const where = `src/i18n/locales/${lang}/${part}.json`;
      const value = file(lang, part);
      if (value === undefined) throw new Error(`${where} is missing`);
      assertWellFormed(value, where);
      if (lang !== DEFAULT_LANG) assertSameShape(file(DEFAULT_LANG, part)!, value, where);
      dictionary[part] = value;
    }
    byLang[lang] = dictionary as unknown as Dictionary;
  }
  return byLang;
}

const dictionaries = load();

/** Every word a page in `locale` shows: `dictionary(Astro.currentLocale)`. */
export const dictionary = (locale: string | undefined | null): Dictionary => dictionaries[langOf(locale)];

/** The interface copy for a page's language: `copyFor(Astro.currentLocale)`. */
export const copyFor = (locale: string | undefined | null): Copy => dictionary(locale).ui;

// `fill` lives in src/lib/template so browser scripts can use it without the dictionaries.
export { fill } from '../lib/template';
