import { describe, expect, test } from 'vitest';
import { careerFor } from '../../src/lib/career';
import { howLong, monthIndex, monthsOf, timeline, yearsAndMonths } from '../../src/lib/earlier-timeline';

// The earlier roles as a timeline (src/lib/earlier-timeline.ts), on the real career.
const earlier = careerFor('en').entries.filter(
  (e) => ['role', 'assignment', 'contract'].includes(e.kind) && e.end && e.org !== 'Buo',
) as { version: string; start: string; end: string; client?: string }[];

describe('months', () => {
  test('count both ends', () => {
    expect(monthsOf({ start: '2017-05', end: '2017-07' })).toBe(3);
    expect(monthsOf({ start: '2019-09', end: '2022-07' })).toBe(35);
    expect(yearsAndMonths(35)).toEqual({ years: 2, months: 11 });
    expect(monthIndex('2019-09') - monthIndex('2019-01')).toBe(8);
  });
});

describe('timeline', () => {
  const t = timeline(earlier);

  test('the ruler starts in January of the first year and runs a year past the last role', () => {
    expect(t.years[0]?.year).toBe(2017);
    expect(t.years.at(-1)?.year).toBe(2023);
    expect(t.at(t.first)).toBe(0);
  });

  test('NICE Actimize, an assignment inside MDG, gets a lane of its own', () => {
    const nice = t.ribbons.find((r) => r.role.client === 'NICE Actimize')!;
    const mdg = t.ribbons.find((r) => r.role.version === '1.0.0')!;
    expect(nice.lane).not.toBe(mdg.lane);
    expect(nice.from).toBeGreaterThan(mdg.from);
    expect(nice.to).toBeCloseTo(mdg.to);
  });

  test('short ribbons name themselves outside, and nothing on their lane runs into the name', () => {
    for (const r of t.ribbons) {
      expect(r.to).toBeGreaterThan(r.from);
      if (!r.outside) continue;
      const next = t.ribbons.find((o) => o.lane === r.lane && o.from > r.from);
      if (next) expect(next.from - r.to).toBeGreaterThan(0.12);
    }
    expect(t.ribbons.filter((r) => r.outside).map((r) => r.role.version)).toEqual(['0.1.0', '0.2.0']);
  });
});

describe('howLong', () => {
  const en = {
    year: '1 year',
    years: '{n} years',
    month: '1 month',
    months: '{n} months',
    and: '{years} and {months}',
  };
  test('says a length the way people do', () => {
    expect(howLong(3, en)).toBe('3 months');
    expect(howLong(12, en)).toBe('1 year');
    expect(howLong(13, en)).toBe('1 year and 1 month');
    expect(howLong(35, en)).toBe('2 years and 11 months');
  });
});
