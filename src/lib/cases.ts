/**
 * Case studies (M6), ready for pages: src/content/cases/<lang>/<slug>.md, jobs first, then Pablo's
 * own projects, each group newest first. Every case exists in every language with the same slug; a
 * missing translation fails the build instead of showing a case in another language.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { fill } from './template';
import { LANGS, localize, type Lang } from '../i18n/routing';

export type Case = CollectionEntry<'cases'>;

/** "es/buo" → "buo". */
export const caseSlug = (entry: Case): string => entry.id.split('/').at(-1) ?? entry.id;

export const caseHref = (slug: string, lang: Lang): string => localize(`/work/${slug}`, lang);

/** The card's line above the title: "Lead Frontend Architect · since 2021", "Personal project · 2026". */
export const caseMeta = ({ data }: Case, t: { since: string; project: string }): string => {
  const year = data.start.getUTCFullYear();
  return data.kind === 'project' ? fill(t.project, { year }) : `${data.role} · ${fill(t.since, { year })}`;
};

/** The cases in `lang`, jobs first, newest first within each; throws if any language is missing one. */
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
  const jobsFirst = (c: Case) => (c.data.kind === 'role' ? 0 : 1);
  return all
    .filter((c) => c.id.startsWith(`${lang}/`))
    .toSorted((a, b) => jobsFirst(a) - jobsFirst(b) || b.data.start.valueOf() - a.data.start.valueOf());
};
