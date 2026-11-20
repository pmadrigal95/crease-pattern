/**
 * Case studies (M6), ready for pages: src/content/cases/<lang>/<slug>.md, newest first. Every case
 * exists in every language with the same slug; a missing translation fails the build instead of
 * showing a case in another language.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGS, localize, type Lang } from '../i18n/routing';

export type Case = CollectionEntry<'cases'>;

/** "es/buo" → "buo". */
export const caseSlug = (entry: Case): string => entry.id.split('/').at(-1) ?? entry.id;

export const caseHref = (slug: string, lang: Lang): string => localize(`/work/${slug}`, lang);

/** The cases in `lang`, newest first; throws if any language is missing one. */
export const getCases = async (lang: Lang): Promise<Case[]> => {
  const all = await getCollection('cases');
  const slugsIn = (l: Lang) =>
    all
      .filter((c) => c.id.startsWith(`${l}/`))
      .map(caseSlug)
      .toSorted();
  const expected = slugsIn(lang).join(',');
  for (const other of LANGS) {
    if (slugsIn(other).join(',') !== expected)
      throw new Error(
        `Case studies differ between languages: ${lang} has [${expected}], ${other} has [${slugsIn(other).join(',')}]`,
      );
  }
  return all
    .filter((c) => c.id.startsWith(`${lang}/`))
    .toSorted((a, b) => b.data.start.valueOf() - a.data.start.valueOf());
};
