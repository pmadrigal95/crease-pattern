import { describe, expect, test } from 'vitest';
import { foxFacets } from '../../src/lib/fox';
import {
  FOLD_DEGREES,
  FOLD_ORDER,
  FOLD_WINDOWS,
  INSPECT_WINDOWS,
  cubicBezier,
  inspectPhases,
  pose,
} from '../../src/lib/fold3d';

describe('fox geometry', () => {
  test('each facet path is drawn from its points', () => {
    for (const f of foxFacets) {
      const [x, y] = f.points[0]!;
      expect(f.d.startsWith(`M${x} ${y}`)).toBe(true);
      expect(f.d.endsWith('z')).toBe(true);
      expect(f.d.split('L')).toHaveLength(f.points.length);
    }
  });
});

describe('pose(p): one input folds the fox in order', () => {
  test('flat at 0, the folded fox at 1', () => {
    for (const fold of FOLD_ORDER) {
      expect(pose(0).folds[fold].degrees).toBe(0);
      expect(pose(1).folds[fold].degrees).toBeCloseTo(FOLD_DEGREES[fold], 9);
    }
    expect(pose(0).folded).toBe(0);
    expect(pose(1).folded).toBeCloseTo(1, 9);
  });

  test('the folds start in order: centre, then brow, then inner ear', () => {
    const starts = FOLD_ORDER.map((f) => FOLD_WINDOWS[f][0]);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    // Just after the centre starts, nothing else has moved.
    const early = pose(0.05);
    expect(early.folds.head.degrees).toBeGreaterThan(0);
    expect(early.folds.ear.degrees).toBe(0);
    expect(early.folds.inner.degrees).toBe(0);
    expect(early.lead).toBe('head');
  });

  test('the lead fold is the one most in motion, and none at rest', () => {
    expect(pose(0).lead).toBeNull();
    expect(pose(1).lead).toBeNull();
    expect(pose(0.5).lead).toBe('ear');
    expect(pose(0.95).lead).toBe('inner');
  });

  test('every fold only ever moves toward folded as p grows', () => {
    let previous = pose(0);
    for (let p = 0.01; p <= 1; p += 0.01) {
      const now = pose(p);
      for (const fold of FOLD_ORDER)
        expect(now.folds[fold].amount).toBeGreaterThanOrEqual(previous.folds[fold].amount - 1e-12);
      previous = now;
    }
  });
});

describe('inspectPhases(q)', () => {
  test('layers, then the scene, then its details', () => {
    expect(INSPECT_WINDOWS.layers[0]).toBeLessThan(INSPECT_WINDOWS.rise[0]);
    expect(INSPECT_WINDOWS.rise[0]).toBeLessThan(INSPECT_WINDOWS.detail[0]);
    const s = inspectPhases(0.4);
    expect(s.linear.layers).toBe(1);
    expect(s.linear.rise).toBeGreaterThan(0);
    expect(s.linear.detail).toBe(0);
  });

  test('at rest nothing has started; at 1 everything is complete', () => {
    expect(Object.values(inspectPhases(0).eased)).toEqual([0, 0, 0]);
    expect(Object.values(inspectPhases(1).eased)).toEqual([1, 1, 1]);
  });
});

test('cubicBezier hits its ends and stays inside them', () => {
  const ease = cubicBezier(0.23, 1, 0.32, 1);
  expect(ease(0)).toBe(0);
  expect(ease(1)).toBe(1);
  for (let x = 0; x <= 1; x += 0.05) {
    expect(ease(x)).toBeGreaterThanOrEqual(0);
    expect(ease(x)).toBeLessThanOrEqual(1.0001);
  }
});
