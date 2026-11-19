import { z } from 'astro/zod';
import raw from '../content/career.json';
import { dictionary } from '../i18n/dictionary';
import { LANGS, type Lang } from '../i18n/routing';
import { decimalYear, yearOf, type Climb } from './altitude';

/**
 * The career changelog: releases (one per major version, named after a Costa Rican volcano) and
 * the entries inside them. Two halves, joined here per language:
 * - src/content/career.json, the facts: versions, dates, kinds, stacks, elevations and where each
 *   volcano is on the map, written once;
 * - src/i18n/locales/<lang>/career.json, the words: each release's name and theme and each entry's
 *   title, organization and lines, keyed by major and by version.
 * Validated on import: a malformed file, or a release or entry without words, fails the build.
 * Pages read it only through `careerFor` and the helpers below.
 */
const yearMonth = z.string().regex(/^\d{4}(-\d{2})?$/, 'use YYYY or YYYY-MM');
const version = z.string().regex(/^\d+\.\d+\.\d+$/, 'use semantic versions like 1.2.0');
const text = z.string().min(1);
const lines = z.array(text);

const factsSchema = z.strictObject({
  vueSince: yearMonth,
  releases: z.array(
    z.strictObject({
      major: z.number().int().nonnegative(),
      elevationM: z.number().int().positive(),
      /** Where the release's place is: the crater for a volcano, the town for base camp. */
      location: z.strictObject({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
    }),
  ),
  entries: z.array(
    z.strictObject({
      version,
      kind: z.enum(['education', 'role', 'assignment', 'contract', 'project']),
      start: yearMonth,
      end: yearMonth.nullable().optional(),
      stack: z.array(text).optional(),
    }),
  ),
});

const wordsSchema = z.strictObject({
  releases: z.record(z.string(), z.strictObject({ codename: text, place: text, theme: text })),
  unreleased: lines,
  entries: z.record(
    z.string(),
    z.strictObject({ title: text, org: text, added: lines.optional(), changed: lines.optional() }),
  ),
});

type Facts = z.infer<typeof factsSchema>;
type Words = z.infer<typeof wordsSchema>;

export type Career = Omit<Facts, 'releases' | 'entries'> & {
  releases: (Facts['releases'][number] & Words['releases'][string])[];
  unreleased: string[];
  entries: (Facts['entries'][number] & Words['entries'][string])[];
};
export type CareerEntry = Career['entries'][number];
export type Release = Career['releases'][number] & { entries: CareerEntry[] };

/** The facts with one language's words; throws at the first release or entry without words. */
export const joinCareer = (facts: Facts, words: Words, where: string): Career => {
  const own = <T>(table: Record<string, T>, key: string, what: string): T => {
    const found = table[key];
    if (!found) throw new Error(`${where}: ${what} ${key} has no words`);
    return found;
  };
  const extra = (table: object, known: string[], what: string) => {
    const unknown = Object.keys(table).filter((key) => !known.includes(key));
    if (unknown.length) throw new Error(`${where}: ${what} ${unknown.join(', ')} not in career.json`);
  };
  extra(
    words.releases,
    facts.releases.map((r) => String(r.major)),
    'release',
  );
  extra(
    words.entries,
    facts.entries.map((e) => e.version),
    'entry',
  );
  return {
    ...facts,
    releases: facts.releases.map((r) => ({ ...r, ...own(words.releases, String(r.major), 'release') })),
    unreleased: words.unreleased,
    entries: facts.entries.map((e) => ({ ...e, ...own(words.entries, e.version, 'entry') })),
  };
};

const facts = factsSchema.parse(raw);
const careers = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    joinCareer(facts, wordsSchema.parse(dictionary(lang).career), `src/i18n/locales/${lang}/career.json`),
  ]),
) as Record<Lang, Career>;

/** The career in a page's language: `careerFor(lang)`. */
export const careerFor = (lang: Lang): Career => careers[lang];

const majorOf = (v: string) => Number(v.split('.')[0]);
const compareVersions = (a: string, b: string) => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/** Releases newest first, each with its entries newest first. */
export const releasesNewestFirst = (data: Career): Release[] => {
  return [...data.releases]
    .sort((a, b) => b.major - a.major)
    .map((r) => ({
      ...r,
      entries: data.entries
        .filter((e) => majorOf(e.version) === r.major)
        .sort((a, b) => compareVersions(b.version, a.version)),
    }));
};

/** Whole years between `since` (YYYY-MM) and `now`. */
export const yearsSince = (since: string, now: Date = new Date()): number => {
  const [y, m = 1] = since.split('-').map(Number);
  const months = (now.getFullYear() - (y ?? 0)) * 12 + (now.getMonth() + 1 - m);
  return Math.floor(months / 12);
};

/**
 * Each release as a stretch of time, oldest first, for the drawings: it starts with its first
 * entry and runs until the next release starts; the current one runs until `now`.
 */
export const climbs = (data: Career, now: Date = new Date()): Climb[] => {
  const starts = data.releases.map((r) => {
    const own = data.entries.filter((e) => majorOf(e.version) === r.major);
    if (own.length === 0) throw new Error(`Release v${r.major} has no entries`);
    return { r, start: Math.min(...own.map((e) => decimalYear(e.start))) };
  });
  starts.sort((a, b) => a.start - b.start);
  return starts.map(({ r, start }, i) => ({
    major: r.major,
    codename: r.codename,
    elevationM: r.elevationM,
    theme: r.theme,
    start,
    end: starts[i + 1]?.start ?? yearOf(now),
  }));
};

/** The newest version shipped, as "3.2": the "you are here" on the profile. */
export const currentVersion = (data: Career): string => {
  const [latest] = [...data.entries].sort((a, b) => compareVersions(b.version, a.version));
  return latest ? latest.version.split('.').slice(0, 2).join('.') : '0.0';
};

/** Each release's place on the map, oldest first. */
export const places = (data: Career) =>
  [...data.releases]
    .sort((a, b) => a.major - b.major)
    .map((r) => ({ major: r.major, codename: r.codename, elevationM: r.elevationM, ...r.location }));
