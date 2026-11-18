import { z } from 'astro/zod';
import en from '../content/copy/en.json';
import es from '../content/copy/es.json';
import { DEFAULT_LANG, langOf, type Lang } from './i18n';

/**
 * Interface copy, one file per language (M5). Strings never get concatenated in components:
 * dynamic values go through `fill`, so translations can reorder them freely.
 *
 * Validated on import: every leaf must be a non-empty string whose placeholders are well formed
 * (`{name}`), so a stray brace or an emptied string fails the build. Every language must have
 * exactly English's keys, and each string the same placeholders, so a missing or misnamed one
 * fails the build instead of showing English, or nothing, on a Spanish page.
 */
type CopyTree = { [key: string]: string | CopyTree };
export type Copy = typeof en;

const leaf = z
  .string()
  .min(1)
  .refine((s) => !/\{(?!\w+\})|(?<!\{\w+)\}/.test(s), 'placeholders must look like {name}');
const tree: z.ZodType<CopyTree> = z.lazy(() => z.record(z.string(), z.union([leaf, tree])));

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join();

/** Throws at the first key or placeholder `other` doesn't share with `base`. */
export function assertSameShape(base: CopyTree, other: CopyTree, lang: string, path = ''): void {
  const keys = (t: CopyTree) => Object.keys(t).sort().join();
  if (keys(base) !== keys(other))
    throw new Error(`copy/${lang}.json${path || ' (root)'}: keys differ from en.json`);
  for (const [key, value] of Object.entries(base)) {
    const twin = other[key];
    const at = `${path}.${key}`;
    if (typeof value === 'string') {
      if (typeof twin !== 'string') throw new Error(`copy/${lang}.json${at}: must be a string`);
      if (placeholders(value) !== placeholders(twin))
        throw new Error(`copy/${lang}.json${at}: placeholders differ from en.json`);
    } else if (typeof twin === 'string' || twin === undefined)
      throw new Error(`copy/${lang}.json${at}: must be a group`);
    else assertSameShape(value, twin, lang, at);
  }
}

const parsed = { en: tree.parse(en), es: tree.parse(es) };
assertSameShape(parsed.en, parsed.es, 'es');
const byLang: Record<Lang, Copy> = { en: parsed.en as Copy, es: parsed.es as Copy };

/** The copy for a page's language: `copyFor(Astro.currentLocale)`. */
export const copyFor = (locale: string | undefined | null): Copy => byLang[langOf(locale)];

/** English: build-time code that has no page (feeds' fallbacks, scripts). */
export const copy: Copy = byLang[DEFAULT_LANG];

// `fill` lives in ./template so browser scripts can use it without the copy loader.
export { fill } from './template';
