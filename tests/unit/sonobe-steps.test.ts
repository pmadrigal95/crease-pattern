import { expect, test } from 'vitest';
import { PAPER, STAGES, area, bounds, reflect } from '../../src/lib/sonobe/steps';

test('reflect puts a folded corner where the fold line sends it', () => {
  expect(reflect([0, 3], [0, 1], [2, 3])).toEqual([2, 1]);
  expect(reflect([4, 1], [2, 1], [4, 3])).toEqual([2, 3]);
  expect(reflect([1, 1], [0, 2], [4, 2])).toEqual([1, 3]);
});

test('the paper starts as a square and the stages keep the right areas', () => {
  expect(STAGES).toHaveLength(5);
  expect(area(STAGES[0]!.outline)).toBe(PAPER * PAPER);
  expect(area(STAGES[1]!.outline)).toBe(PAPER * PAPER);
  // Edges to the middle: the strip shows half the paper, in two layers.
  expect(area(STAGES[2]!.outline)).toBe((PAPER * PAPER) / 2);
  expect(STAGES[2]!.flaps.map(area)).toEqual([4, 4]);
  // Two corners folded in: the outline loses a triangle of area 2 at each end.
  expect(area(STAGES[3]!.outline)).toBe(4);
  expect(STAGES[3]!.flaps.map(area)).toEqual([2, 2]);
});

test('folded corners land inside the paper as it lies', () => {
  const stage = STAGES[3]!;
  const box = bounds(stage);
  for (const flap of stage.flaps)
    for (const [x, y] of flap) {
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.width);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.height);
    }
});

test('the last stage is the unit: three wide, one high, its face marked by two creases', () => {
  const last = STAGES.at(-1)!;
  expect(bounds(last)).toEqual({ x: 0, y: 0, width: 3, height: 1 });
  expect(area(last.outline)).toBe(2);
  expect(last.creases).toHaveLength(2);
});
