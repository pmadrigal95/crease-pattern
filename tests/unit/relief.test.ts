import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { careerFor, places } from '../../src/lib/career';
import { IRAZU_DEM } from '../../src/lib/identity-scenes';
import {
  RELIEF,
  heightOf,
  indexAt,
  metresAt,
  pointAt,
  progressAt,
  relief,
  resample,
  routeLength,
  summitOf,
  tileAt,
} from '../../src/lib/relief';

// The career as four paper models of real terrain (src/lib/relief.ts), on the real grids.
const bin = (name: string) => {
  const b = readFileSync(join(process.cwd(), 'src/assets/scenes', `${name}-dem.bin`));
  return new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
};
const files = ['cartago', 'poas', 'turrialba', 'irazu'];
const grids = files.map(bin);
const career = places(careerFor('en'));
const real = relief(career.map((p, i) => ({ major: p.major, grid: grids[i]! })));

describe('relief grids', () => {
  test('one grid per place of the career, square, in whole metres', () => {
    expect(career.map((p) => p.major)).toEqual([0, 1, 2, 3]);
    expect(grids.slice(0, 3).every((g) => g.length === RELIEF.size ** 2)).toBe(true);
    expect(grids[3]!.length).toBe(IRAZU_DEM.size ** 2);
  });

  test('each summit is within 150 m of its real height; base camp is the town at the centre', () => {
    real.tiles.forEach((tile, i) => {
      const [r, c] = tile.summit;
      const m = metresAt(tile, r, c);
      expect(Math.abs(m - career[i]!.elevationM)).toBeLessThan(150);
      if (i === 0) expect(tile.summit).toEqual([48, 48]);
    });
  });

  test('each place is higher than the one before: the climb', () => {
    const heights = real.tiles.map((t) => metresAt(t, ...t.summit));
    expect(heights).toEqual(heights.toSorted((a, b) => a - b));
  });
});

describe('resample', () => {
  test('keeps the corners and the centre of a grid', () => {
    const big = Float32Array.from({ length: 161 * 161 }, (_, k) => Math.floor(k / 161) * 10 + (k % 161));
    const small = resample(big, 161, 97);
    expect(small.length).toBe(97 * 97);
    expect(small[0]).toBeCloseTo(0);
    expect(small[97 * 97 - 1]).toBeCloseTo(160 * 10 + 160);
    expect(small[48 * 97 + 48]).toBeCloseTo(80 * 10 + 80);
  });

  test('refuses a grid of the wrong size', () => {
    expect(() => resample(new Float32Array(10), 4, 3)).toThrow(/16 samples/);
  });
});

describe('summitOf', () => {
  test('finds the highest point away from the edges', () => {
    const g = new Float32Array(97 * 97);
    g[50 * 97 + 40] = 3000;
    g[2 * 97 + 2] = 9000; // a peak at the edge belongs to a neighbour
    expect(summitOf(g, 97, false)).toEqual([50, 40]);
    expect(summitOf(g, 97, true)).toEqual([48, 48]);
  });
});

describe('the route', () => {
  test('runs west to east across every tile and ends on the last summit', () => {
    const n = routeLength(real);
    for (let k = 1; k < n; k++) expect(real.route[k * 3]!).toBeGreaterThan(real.route[(k - 1) * 3]!);
    expect(real.summits.at(-1)).toBe(n - 1);
    expect(pointAt(real, 1)[1]).toBeCloseTo(real.top + RELIEF.lift);
  });

  test('stays above the ground and inside the row', () => {
    real.tiles.forEach((tile, i) => {
      const from = real.starts[i]!;
      const to = real.starts[i + 1] ?? routeLength(real);
      for (let k = from; k < to; k++) {
        expect(real.route[k * 3 + 1]!).toBeGreaterThan(tile.base);
        expect(real.route[k * 3 + 1]!).toBeGreaterThanOrEqual(heightOf(RELIEF.floorM));
      }
    });
  });

  test('progress maps to tiles and back', () => {
    expect(tileAt(real, 0)).toBe(0);
    expect(tileAt(real, 1)).toBe(3);
    real.tiles.forEach((_, i) => {
      expect(tileAt(real, progressAt(real, i))).toBe(i);
      expect(indexAt(real, progressAt(real, i))).toBe(real.summits[i]);
    });
    expect(progressAt(real, 3)).toBe(1);
    expect(progressAt(real, 9)).toBe(1);
  });

  test('the row of tiles is as wide as its tiles and gaps', () => {
    expect(real.width).toBe(4 * RELIEF.tile + 3 * RELIEF.gap);
    expect(real.tiles.map((t) => t.left)).toEqual([0, 31, 62, 93]);
  });
});
