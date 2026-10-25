import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { career, releasesNewestFirst, yearsSince, formatRange } from '../../src/lib/career';
import { copy, fill } from '../../src/lib/copy';

describe('career changelog', () => {
  test('every entry belongs to a release', () => {
    const majors = new Set(career.releases.map((r) => r.major));
    for (const e of career.entries) expect(majors).toContain(Number(e.version.split('.')[0]));
  });

  test('versions are unique', () => {
    const versions = career.entries.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  test('each release sits higher than the one before it', () => {
    const byMajor = [...career.releases].sort((a, b) => a.major - b.major);
    byMajor.slice(1).forEach((r, i) => expect(r.elevationM).toBeGreaterThan(byMajor[i]!.elevationM));
  });

  test('releases and entries are listed newest first', () => {
    const releases = releasesNewestFirst();
    expect(releases.map((r) => r.major)).toEqual([...releases.map((r) => r.major)].sort((a, b) => b - a));
    expect(releases[0]?.entries[0]?.version).toBe('3.1.0');
  });

  test('years are whole years since the start date', () => {
    expect(yearsSince('2019-09', new Date(Date.UTC(2026, 9, 25)))).toBe(7);
    expect(yearsSince('2019-09', new Date(Date.UTC(2026, 7, 1)))).toBe(6);
  });

  test('date ranges read naturally', () => {
    expect(formatRange('2019-09', '2022-07', 'Present')).toBe('Sep 2019 – Jul 2022');
    expect(formatRange('2024-07', null, 'Present')).toBe('Jul 2024 – Present');
    expect(formatRange('2015', '2017', 'Present')).toBe('2015 – 2017');
  });
});

describe('copy', () => {
  test('fill replaces placeholders and rejects missing values', () => {
    expect(fill(copy.home.changelog.years, { years: 7 })).toBe('7 years shipping Vue in production');
    expect(() => fill('{years} years', {})).toThrow();
  });
});

describe('published content', () => {
  // Review markers from the private studio must never reach the public repo.
  const markers = /\[(confirm|approve|source)\?\]|\[when built\]|TODO/;
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)],
    );

  test.each(files('src/content'))('%s has no review markers', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(markers);
  });
});
