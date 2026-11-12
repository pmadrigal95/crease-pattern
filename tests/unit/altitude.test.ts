import { describe, expect, test } from 'vitest';
import { decimalYear, profile, textWidth, type Climb, type Frame } from '../../src/lib/altitude';
import { climbs, currentVersion } from '../../src/lib/career';

// The career drawn as a climb (design debt phase 2). The chart has to stay right as releases
// are added, so these tests run on the real data and on a made-up v4.
const now = new Date('2026-11-12T00:00:00Z');
const wide: Frame = {
  width: 1000,
  height: 360,
  top: 120,
  bottom: 44,
  right: 64,
  floorM: 900,
  ceilingM: 3600,
  axisFont: 13,
};
const narrow: Frame = {
  width: 360,
  height: 300,
  top: 104,
  bottom: 38,
  right: 44,
  floorM: 900,
  ceilingM: 3600,
  axisFont: 11,
};
const real = climbs(now);
const withV4: Climb[] = [
  ...real.map((c, i, all) => (i === all.length - 1 ? { ...c, end: 2028.5 } : c)),
  {
    major: 4,
    codename: 'Chirripó',
    elevationM: 3820,
    theme: 'Engineering leadership',
    start: 2028.5,
    end: 2031,
  },
];

describe('career as climbs', () => {
  test('releases run back to back, oldest first, up to today', () => {
    expect(real.map((c) => c.major)).toEqual([0, 1, 2, 3]);
    real.slice(1).forEach((c, i) => expect(c.start).toBe(real[i]!.end));
    expect(real[0]!.start).toBe(2015);
    expect(real[1]!.start).toBeCloseTo(decimalYear('2019-09'));
    expect(real[real.length - 1]!.end).toBeCloseTo(2026.86, 1);
  });

  test('the current version is the newest entry', () => {
    expect(currentVersion()).toBe('3.2');
  });
});

describe('elevation chart', () => {
  test.each([
    ['real data, wide', real, wide],
    ['real data, phone', real, narrow],
    ['with a v4, wide', withV4, { ...wide, ceilingM: 4000 }],
    ['with a v4, phone', withV4, { ...narrow, ceilingM: 4000 }],
  ] as const)('%s: one stretch per release, back to back, each name fits its stretch', (_, data, frame) => {
    const p = profile(data, frame);
    expect(p.stretches.map((s) => s.major)).toEqual(data.map((c) => c.major));
    p.stretches.slice(1).forEach((s, i) => expect(s.x0).toBe(p.stretches[i]!.x1));
    expect(p.stretches.at(-1)!.x1).toBeLessThanOrEqual(p.plotRight);
    for (const [i, s] of p.stretches.entries()) {
      const label = s.fullName ? data[i]!.codename : `v${data[i]!.major}`;
      expect(textWidth(label, frame.axisFont)).toBeLessThanOrEqual(s.x1 - s.x0);
    }
  });

  test('every real release name fits on a phone', () => {
    expect(profile(real, narrow).stretches.every((s) => s.fullName)).toBe(true);
  });

  test('a higher release draws a higher peak, inside the plot', () => {
    const p = profile(real, wide);
    const ys = p.stretches.map((s) => s.peak.y);
    ys.slice(1).forEach((y, i) => expect(y).toBeLessThan(ys[i]!));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(wide.top);
  });

  test('a guide every 1,000 m, and "you are here" at the end of the line', () => {
    const p = profile(real, wide);
    expect(p.guides.map((g) => g.m)).toEqual([1000, 2000, 3000]);
    expect(p.here.x).toBeCloseTo(p.plotRight, 0);
  });

  test('the same input always draws the same chart', () => {
    expect(profile(real, wide)).toEqual(profile(real, wide));
  });
});
