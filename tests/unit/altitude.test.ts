import { describe, expect, test } from 'vitest';
import { decimalYear } from '../../src/lib/altitude';
import { careerFor, climbs, currentVersion } from '../../src/lib/career';

// The career as climbs, the input of the home page's paper ridge (tests/unit/ridge.test.ts).
const now = new Date('2026-11-12T00:00:00Z');
const real = climbs(careerFor('en'), now);

describe('career as climbs', () => {
  test('releases run back to back, oldest first, up to today', () => {
    expect(real.map((c) => c.major)).toEqual([0, 1, 2, 3]);
    real.slice(1).forEach((c, i) => expect(c.start).toBe(real[i]!.end));
    expect(real[0]!.start).toBe(2015);
    expect(real[1]!.start).toBeCloseTo(decimalYear('2019-09'));
    expect(real[real.length - 1]!.end).toBeCloseTo(2026.86, 1);
  });

  test('the current version is the newest entry', () => {
    expect(currentVersion(careerFor('en'))).toBe('3.2');
  });
});
