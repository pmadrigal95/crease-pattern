import { describe, expect, test } from 'vitest';
import {
  ASSEMBLIES,
  FLAT_UNIT,
  PYRAMID_HEIGHT,
  assembly,
  dot,
  length,
  normal,
  project,
  type UnitCount,
  type Vec3,
} from '../../src/lib/sonobe/geometry';

const counts = Object.keys(ASSEMBLIES).map(Number) as UnitCount[];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const center = (pts: readonly Vec3[]): Vec3 =>
  pts.reduce<Vec3>(
    (s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length],
    [0, 0, 0],
  );

describe('assemblies', () => {
  test.each(counts)('%i units make a model of exactly that many units', (n) => {
    const model = assembly(n);
    expect(model.units).toBe(n);
    expect(new Set(model.facets.map((f) => f.unit)).size).toBe(n);
  });

  test('the cube has one square face per unit; the others two triangles per unit', () => {
    expect(assembly(6).facets.every((f) => f.points.length === 4)).toBe(true);
    for (const n of [12, 30] as const) {
      const model = assembly(n);
      expect(model.facets).toHaveLength(2 * n);
      expect(model.facets.every((f) => f.points.length === 3)).toBe(true);
    }
  });

  test('every facet faces outward', () => {
    for (const n of counts)
      for (const f of assembly(n).facets) expect(dot(normal(f.points), center(f.points))).toBeGreaterThan(0);
  });

  test("each pyramid side has the unit's right angle at its apex, and a base edge of 1", () => {
    expect(PYRAMID_HEIGHT).toBeCloseTo(1 / Math.sqrt(6), 12);
    for (const n of [12, 30] as const)
      for (const { points } of assembly(n).facets) {
        const [a, b, apex] = points as [Vec3, Vec3, Vec3];
        expect(length(sub(a, b))).toBeCloseTo(1, 9);
        expect(dot(sub(a, apex), sub(b, apex))).toBeCloseTo(0, 9);
        expect(length(sub(a, apex))).toBeCloseTo(Math.SQRT1_2, 9);
      }
  });

  test('the two triangles of a unit share its edge', () => {
    for (const n of [12, 30] as const) {
      const byUnit = Map.groupBy(assembly(n).facets, (f) => f.unit);
      for (const [a, b] of byUnit.values()) {
        const key = (p: Vec3) => p.map((x) => x.toFixed(6)).join();
        const edgeA = new Set(a!.points.slice(0, 2).map(key));
        expect(b!.points.slice(0, 2).every((p) => edgeA.has(key(p)))).toBe(true);
      }
    }
  });
});

describe('project', () => {
  test.each(counts)('%i units: only facets facing the viewer, drawn far to near', (n) => {
    const model = assembly(n);
    const drawn = project(model, 0.6, -0.4);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(model.facets.length);
    expect(drawn.every((f) => f.light > 0 && f.light <= 1)).toBe(true);
  });

  test('a cube seen straight on shows only its front face', () => {
    const drawn = project(assembly(6), 0, 0);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.light).toBeCloseTo(1, 9);
  });

  test('turning the model never changes its size', () => {
    const radius = (n: UnitCount, yaw: number) =>
      Math.max(...project(assembly(n), yaw, 0.3).flatMap((f) => f.points.map(([x, y]) => Math.hypot(x, y))));
    for (const n of counts) {
      const max = Math.max(...assembly(n).facets.flatMap((f) => f.points.map((p) => length(p))));
      for (const yaw of [0, 1, 2.5]) expect(radius(n, yaw)).toBeLessThanOrEqual(max + 1e-9);
    }
  });
});

test('the flat unit is a square face between two triangular tabs, three wide and one high', () => {
  const area = (pts: readonly (readonly [number, number])[]) =>
    Math.abs(
      pts.reduce(
        (s, [x, y], i) => s + x * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * y,
        0,
      ),
    ) / 2;
  expect(area(FLAT_UNIT.face)).toBe(1);
  expect(FLAT_UNIT.tabs.map(area)).toEqual([0.5, 0.5]);
  expect(Math.max(...[...FLAT_UNIT.face, ...FLAT_UNIT.tabs.flat()].map(([x]) => x))).toBe(3);
});
