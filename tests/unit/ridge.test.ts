import { describe, expect, test } from 'vitest';
import type { Climb } from '../../src/lib/altitude';
import { careerFor, climbs } from '../../src/lib/career';
import { ridge, type RidgeFrame } from '../../src/lib/ridge';

// The career as a paper ridge (src/lib/ridge.ts). It has to stay right as releases are added,
// so these tests run on the real data and on a made-up v4 higher than the frame's ceiling.
const now = new Date('2026-11-12T00:00:00Z');
const real = climbs(careerFor('en'), now);
const wide: RidgeFrame = { width: 1000, height: 340, baseline: 300, top: 24, floorM: 900, ceilingM: 3600 };
const narrow: RidgeFrame = { width: 400, height: 280, baseline: 244, top: 20, floorM: 900, ceilingM: 3600 };
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

/** The numbers in an SVG path, as [x, y] pairs. */
const points = (d: string) => {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i]!, n[2 * i + 1]!] as const);
};

describe('paper ridge', () => {
  test.each([
    ['real data, wide', real, wide],
    ['real data, phone', real, narrow],
    ['with a v4 above the ceiling, wide', withV4, wide],
  ] as const)('%s: one volcano per release, in order, each summit inside the frame', (_, data, frame) => {
    const r = ridge(data, frame);
    expect(r.peaks.map((p) => p.major)).toEqual(data.map((c) => c.major));
    r.peaks.slice(1).forEach((p, i) => expect(p.summit[0]).toBeGreaterThan(r.peaks[i]!.summit[0]));
    for (const p of r.peaks) {
      expect(p.summit[1]).toBeGreaterThanOrEqual(frame.top - 0.5);
      expect(p.summit[1]).toBeLessThan(frame.baseline);
    }
  });

  test('a higher summit is drawn higher', () => {
    const r = ridge(real, wide);
    const ys = r.peaks.map((p) => p.summit[1]);
    ys.slice(1).forEach((y, i) => expect(y).toBeLessThan(ys[i]!));
  });

  test('base camp is a hill; every volcano has a fold down its ridge', () => {
    const r = ridge(real, wide);
    expect(r.peaks[0]!.fold).toBeNull();
    r.peaks.slice(1).forEach((p) => expect(p.fold).toMatch(/^M/));
  });

  test('a cap on every volcano, a fifth of the way down; ice only above 3,000 m', () => {
    const r = ridge(real, wide);
    expect(r.peaks[0]!.capY).toBeNull();
    r.peaks.slice(1).forEach((p) => {
      expect(p.capY).toBeGreaterThan(p.summit[1]);
      expect(p.capY).toBeLessThan(wide.baseline);
    });
    expect(r.peaks.map((p) => p.high)).toEqual([false, false, true, true]);
  });

  test('a contour every 250 m, under each summit', () => {
    const r = ridge(real, wide);
    const irazu = r.peaks.at(-1)!; // 3,432 m: 1,000 … 3,250 m
    expect(irazu.contours).toHaveLength(10);
    irazu.contours.forEach((y) => expect(y).toBeGreaterThan(irazu.summit[1]));
  });

  test('the route walks left to right, never under the ground, and ends on the last summit', () => {
    const r = ridge(real, wide);
    const route = points(r.route);
    route.slice(1).forEach(([x], i) => expect(x).toBeGreaterThan(route[i]![0]));
    route.forEach(([, y]) => expect(y).toBeLessThan(wide.baseline));
    const [endX, endY] = route.at(-1)!;
    expect(endX).toBeCloseTo(r.routeEnd, 0);
    expect(endX).toBeCloseTo(r.peaks.at(-1)!.summit[0], 0);
    expect(endY).toBeLessThan(r.peaks.at(-1)!.summit[1] + 8);
  });

  test('a height guide every 1,000 m, each at its height', () => {
    const r = ridge(real, wide);
    expect(r.guides.map((g) => g.m)).toEqual([1000, 2000, 3000]);
    const [g1, g2, g3] = r.guides;
    expect(g2!.y - g1!.y).toBeCloseTo(g3!.y - g2!.y, 0);
    expect(g3!.y).toBeLessThan(g1!.y);
  });

  test('the same input always draws the same ridge', () => {
    expect(ridge(real, wide)).toEqual(ridge(real, wide));
  });
});
