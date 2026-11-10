import { z } from 'astro/zod';
import raw from '../content/career.json';

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

const monthName = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
const formatPoint = (value: string) => {
  const [y, m] = value.split('-').map(Number);
  return m ? `${monthName.format(new Date(Date.UTC(y ?? 0, m - 1, 1)))} ${y}` : String(y);
};

/** "Sep 2019 – Jul 2022", "Jul 2024 – Present" or "2015 – 2017". */
export function formatRange(start: string, end: string | null | undefined, present: string): string {
  return `${formatPoint(start)} – ${end ? formatPoint(end) : present}`;
}

export const formatElevation = (meters: number) => new Intl.NumberFormat('en').format(meters);
