import { z } from 'astro/zod';
import raw from '../content/career.json';
import { decimalYear, yearOf, type Climb } from './altitude';

/**
 * The career changelog: releases (one per major version, named after a Costa Rican
 * volcano) and the entries inside them. Validated on import, so a malformed file
 * fails the build. Pages read it only through the helpers below.
 */
const yearMonth = z.string().regex(/^\d{4}(-\d{2})?$/, 'use YYYY or YYYY-MM');
const version = z.string().regex(/^\d+\.\d+\.\d+$/, 'use semantic versions like 1.2.0');

const schema = z.strictObject({
  vueSince: yearMonth,
  releases: z.array(
    z.strictObject({
      major: z.number().int().nonnegative(),
      codename: z.string().min(1),
      place: z.string().min(1),
      elevationM: z.number().int().positive(),
      theme: z.string().min(1),
      /** Where the release's place is: the crater for a volcano, the town for base camp. */
      location: z.strictObject({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
    }),
  ),
  unreleased: z.array(z.string().min(1)),
  entries: z.array(
    z.strictObject({
      version,
      kind: z.enum(['education', 'role', 'assignment', 'contract', 'project']),
      start: yearMonth,
      end: yearMonth.nullable().optional(),
      title: z.string().min(1),
      org: z.string().min(1),
      stack: z.array(z.string().min(1)).optional(),
      added: z.array(z.string().min(1)).optional(),
      changed: z.array(z.string().min(1)).optional(),
    }),
  ),
});

export type Career = z.infer<typeof schema>;
export type CareerEntry = Career['entries'][number];
export type Release = Career['releases'][number] & { entries: CareerEntry[] };

export const career: Career = schema.parse(raw);

const majorOf = (v: string) => Number(v.split('.')[0]);
const compareVersions = (a: string, b: string) => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

/** Releases newest first, each with its entries newest first. */
export function releasesNewestFirst(data: Career = career): Release[] {
  return [...data.releases]
    .sort((a, b) => b.major - a.major)
    .map((r) => ({
      ...r,
      entries: data.entries
        .filter((e) => majorOf(e.version) === r.major)
        .sort((a, b) => compareVersions(b.version, a.version)),
    }));
}

/** Whole years between `since` (YYYY-MM) and `now`. */
export function yearsSince(since: string, now: Date = new Date()): number {
  const [y, m = 1] = since.split('-').map(Number);
  const months = (now.getFullYear() - (y ?? 0)) * 12 + (now.getMonth() + 1 - m);
  return Math.floor(months / 12);
}

/**
 * Each release as a stretch of time, oldest first, for the drawings: it starts with its first
 * entry and runs until the next release starts; the current one runs until `now`.
 */
export function climbs(now: Date = new Date(), data: Career = career): Climb[] {
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
}

/** The newest version shipped, as "3.2": the "you are here" on the profile. */
export function currentVersion(data: Career = career): string {
  const [latest] = [...data.entries].sort((a, b) => compareVersions(b.version, a.version));
  return latest ? latest.version.split('.').slice(0, 2).join('.') : '0.0';
}

/** Each release's place on the map, oldest first. */
export const places = (data: Career = career) =>
  [...data.releases]
    .sort((a, b) => a.major - b.major)
    .map((r) => ({ major: r.major, codename: r.codename, elevationM: r.elevationM, ...r.location }));
