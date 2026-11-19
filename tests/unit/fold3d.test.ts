import { describe, expect, test } from 'vitest';
import { INSPECT_WINDOWS, cubicBezier, inspectPhases } from '../../src/lib/fold3d';

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
