import { describe, expect, test } from 'vitest';
import { buildFold, creases, foldMatrices, posed } from '../../src/lib/origami/hinge';
import { MODEL_IDS, models } from '../../src/lib/origami/models';
import { flatMark, foldedMark, modelFor } from '../../src/lib/origami/marks';

// The checks the teardown rule asks for, on every figure: real numbers from the same geometry the
// marks and the 3D scene draw.
const FLOOR = -1.2;
const STEPS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1];

describe.each(MODEL_IDS)('%s', (id) => {
  const { fold } = models[id];

  test('is one connected sheet: one hinge per facet but the root', () => {
    expect(fold.parent.filter((p) => p < 0)).toHaveLength(1);
    expect(fold.order).toHaveLength(fold.faces.length);
  });

  test('folds rigidly: no edge changes length at any point of the fold', () => {
    for (const u of STEPS) {
      const M = foldMatrices(fold, u, FLOOR);
      fold.faces.forEach((f, i) => {
        const now = posed(fold, M, i);
        const was = f.map((v) => fold.points[v]!);
        for (let k = 0; k < 3; k++)
          expect(now[k]!.distanceTo(now[(k + 1) % 3]!)).toBeCloseTo(was[k]!.distanceTo(was[(k + 1) % 3]!), 9);
      });
    }
  });

  test('starts as the figure and ends flat on the floor', () => {
    const folded = foldMatrices(fold, 0, FLOOR);
    fold.faces.forEach((f, i) =>
      posed(fold, folded, i).forEach((p, k) => expect(p.distanceTo(fold.points[f[k]!]!)).toBeLessThan(1e-9)),
    );
    const flat = foldMatrices(fold, 1, FLOOR);
    fold.faces.forEach((_, i) => posed(fold, flat, i).forEach((p) => expect(p.y).toBeCloseTo(FLOOR, 9)));
  });

  test('every hinge closes: a facet and its parent share their hinge at every pose', () => {
    for (const u of STEPS) {
      const M = foldMatrices(fold, u, FLOOR);
      fold.order.slice(1).forEach((j) => {
        for (const v of fold.hinge[j]!) {
          const mine = fold.points[v]!.clone().applyMatrix4(M[j]!);
          const theirs = fold.points[v]!.clone().applyMatrix4(M[fold.parent[j]!]!);
          expect(mine.distanceTo(theirs)).toBeLessThan(1e-9);
        }
      });
    }
  });

  test('its crease pattern has mountain and valley folds, one per hinge', () => {
    const lines = creases(fold, foldMatrices(fold, 1, FLOOR));
    expect(lines).toHaveLength(fold.faces.length - 1);
    expect(lines.some((l) => l.kind === 'mountain')).toBe(true);
    expect(lines.some((l) => l.kind === 'valley')).toBe(true);
  });

  test('draws flat for SVG inside the view box', () => {
    const folded = foldedMark(id);
    const flat = flatMark(id);
    expect(folded.facets).toHaveLength(fold.faces.length);
    expect(flat.facets).toHaveLength(fold.faces.length);
    const numbers = [...folded.facets.map((f) => f.d), ...flat.facets, flat.mountain, flat.valley]
      .join(' ')
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(48);
  });
});

test('a sheet with a facet that touches nothing fails', () => {
  const points = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [5, 5, 5],
    [6, 5, 5],
    [5, 6, 5],
  ] as const;
  expect(() =>
    buildFold(points, [
      [0, 1, 2],
      [3, 4, 5],
    ]),
  ).toThrow(/isn't connected/);
});

test('each identity shows its figure; Contour lines changes with the time of day', () => {
  expect(modelFor('washi-asagi', false)).toBe('crane');
  expect(modelFor('washi-asagi', true)).toBe('crane');
  expect(modelFor('basalt-glacier', true)).toBe('fox');
  expect(modelFor('contour-lines', false)).toBe('morpho');
  expect(modelFor('contour-lines', true)).toBe('frog');
});
