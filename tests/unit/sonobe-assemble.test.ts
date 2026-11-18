import { expect, test } from 'vitest';
import {
  ASSEMBLE,
  STAR_UNITS,
  arrived,
  drawStar,
  star,
  toView,
  unitOffset,
} from '../../src/lib/sonobe/assemble';
import { length } from '../../src/lib/sonobe/geometry';

const { directions, rank, model } = star();

test('the star has 30 units, each with an outward direction and its own turn', () => {
  expect(model.units).toBe(STAR_UNITS);
  expect(directions).toHaveLength(STAR_UNITS);
  for (const d of directions) expect(length(d)).toBeCloseTo(1);
  expect([...rank].sort((a, b) => a - b)).toEqual([...Array(STAR_UNITS).keys()]);
});

test('units arrive bottom to top', () => {
  const byRank = [...directions.keys()].sort((p, q) => rank[p]! - rank[q]!);
  expect(directions[byRank[0]!]![1]).toBeLessThan(directions[byRank[STAR_UNITS - 1]!]![1]);
});

test('every unit starts out, then sits in place once assembled', () => {
  for (let r = 0; r < STAR_UNITS; r++) {
    expect(unitOffset(r, 0, 0)).toBeCloseTo(ASSEMBLE.far);
    expect(unitOffset(r, 1, 0)).toBeCloseTo(0);
    expect(unitOffset(r, 1, 1)).toBeCloseTo(ASSEMBLE.part);
  }
});

test('the first unit is in before the last one starts, and none moves backward', () => {
  expect(arrived(0, 0.5)).toBeGreaterThan(arrived(STAR_UNITS - 1, 0.5));
  for (let r = 0; r < STAR_UNITS; r++) {
    let last = Infinity;
    for (let a = 0; a <= 1.0001; a += 0.02) {
      const o = unitOffset(r, a, 0);
      expect(o).toBeLessThanOrEqual(last + 1e-9);
      last = o;
    }
  }
});

test('the view turns without stretching the model', () => {
  for (const f of model.facets) for (const p of f.points) expect(length(toView(p))).toBeCloseTo(length(p));
});

test('assembled, the drawing shows the near side only, back to front; at a = 0 it is empty', () => {
  const s = star();
  const drawn = drawStar(s, 1, 0);
  expect(drawn.length).toBeGreaterThan(20);
  expect(drawn.length).toBeLessThan(s.model.facets.length);
  expect(drawStar(s, 0, 0)).toEqual([]);
  for (const f of drawn) expect(f.presence).toBe(1);
});
