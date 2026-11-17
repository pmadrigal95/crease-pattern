import { expect, test } from 'vitest';
import {
  IRAZU,
  TERRAIN,
  WASHI,
  basaltColumns,
  contourFront,
  irazuHeight,
  irazuScale,
  ringProgress,
  seeded,
  sheetProgress,
} from '../../src/lib/identity-scenes';

test('the seeded sequence is the same on every visit', () => {
  const a = seeded(7);
  const b = seeded(7);
  const run = (r: () => number) => Array.from({ length: 5 }, r);
  expect(run(a)).toEqual(run(b));
  expect(run(seeded(7)).every((x) => x > 0 && x < 1)).toBe(true);
});

test('the Irazú model spans its real heights: base at 1,400 m, summit at 3,432 m', () => {
  let hmax = 0;
  const step = TERRAIN.size / 40;
  for (let x = -TERRAIN.size / 2; x <= TERRAIN.size / 2; x += step)
    for (let z = -TERRAIN.size / 2; z <= TERRAIN.size / 2; z += step) {
      const h = irazuHeight(x, z);
      expect(h).toBeGreaterThanOrEqual(0);
      hmax = Math.max(hmax, h);
    }
  const { toMetres, unitsPer } = irazuScale(hmax);
  expect(toMetres(0)).toBe(IRAZU.base);
  expect(toMetres(hmax)).toBeCloseTo(IRAZU.summit);
  expect(unitsPer(IRAZU.summit - IRAZU.base)).toBeCloseTo(hmax);
});

test('the tracing contour walks down from above the summit to below the base', () => {
  const hmax = 1.2;
  expect(contourFront(0, hmax)).toBeGreaterThan(hmax);
  expect(contourFront(1, hmax)).toBeLessThan(0);
  let last = Infinity;
  for (let d = 0.05; d < 1; d += 0.05) {
    const front = contourFront(d, hmax);
    expect(front).toBeLessThanOrEqual(last);
    last = front;
  }
});

test('basalt columns rise ring by ring, centre first, with a few rings at once', () => {
  const columns = basaltColumns();
  const rings = Math.max(...columns.map((c) => c.ring)) + 1;
  expect(columns.length).toBeGreaterThan(100);
  expect(ringProgress(0, 0, rings)).toBe(0);
  expect(ringProgress(1, rings - 1, rings)).toBe(1);
  expect(ringProgress(0.3, 0, rings)).toBeGreaterThan(ringProgress(0.3, rings - 1, rings));
  for (let rise = 0; rise <= 1; rise += 0.05) {
    const moving = Array.from({ length: rings }, (_, r) => ringProgress(rise, r, rings)).filter(
      (k) => k > 0 && k < 1,
    );
    expect(moving.length).toBeLessThanOrEqual(4);
  }
});

test('washi sheets lift from the top of the stack down, and all are up at the end', () => {
  const top = WASHI.sheets - 1;
  expect(sheetProgress(0.2, top)).toBeGreaterThan(sheetProgress(0.2, 0));
  for (let i = 0; i < WASHI.sheets; i++) {
    expect(sheetProgress(0, i)).toBe(0);
    expect(sheetProgress(1, i)).toBe(1);
  }
});
