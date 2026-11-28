import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { careerFor, places } from '../../src/lib/career';
import { IRAZU_DEM } from '../../src/lib/identity-scenes';
import { RELIEF, heightOf, model, resample, sampled, sheetMask, smooth } from '../../src/lib/relief';

// The career's places as topographic models of cut paper (src/lib/relief.ts), on the real grids.
const bin = (name: string) => {
  const b = readFileSync(join(process.cwd(), 'src/assets/scenes', `${name}-dem.bin`));
  return new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
};
const grids = ['cartago', 'poas', 'turrialba', 'irazu'].map(bin);
const career = places(careerFor('en'));
const models = grids.map(model);

describe('relief grids', () => {
  test('one grid per place of the career, square, in whole metres', () => {
    expect(career.map((p) => p.major)).toEqual([0, 1, 2, 3]);
    expect(grids.slice(0, 3).every((g) => g.length === RELIEF.size ** 2)).toBe(true);
    expect(grids[3]!.length).toBe(IRAZU_DEM.size ** 2);
  });

  test('each volcano model reaches within 250 m of its summit (the grid averages over ~130 m)', () => {
    models.slice(1).forEach((m, i) => expect(career[i + 1]!.elevationM - m.top).toBeLessThan(250));
  });

  test('each model is cut every 100 m between its lowest and highest point, and the climb rises', () => {
    for (const m of models) {
      expect(m.levels.length).toBeGreaterThan(2);
      expect(m.levels[0]).toBeGreaterThanOrEqual(m.low);
      expect(m.levels.at(-1)).toBeLessThan(m.top);
      m.levels.slice(1).forEach((l, k) => expect(l - m.levels[k]!).toBe(RELIEF.step));
    }
    const tops = models.map((m) => m.top);
    expect(tops).toEqual(tops.toSorted((a, b) => a - b));
  });
});

describe('resample and smooth', () => {
  test('resample keeps the corners and the centre', () => {
    const big = Float32Array.from({ length: 161 * 161 }, (_, k) => Math.floor(k / 161) * 10 + (k % 161));
    const small = resample(big, 161, 97);
    expect(small[0]).toBeCloseTo(0);
    expect(small[97 * 97 - 1]).toBeCloseTo(160 * 10 + 160);
    expect(small[48 * 97 + 48]).toBeCloseTo(80 * 10 + 80);
    expect(() => resample(new Float32Array(10), 4, 3)).toThrow(/16 samples/);
  });

  test('smooth keeps a flat grid flat and softens a spike', () => {
    const flat = new Float32Array(25).fill(7);
    expect([...smooth(flat, 5, 2)].every((v) => Math.abs(v - 7) < 1e-6)).toBe(true);
    const spike = new Float32Array(25);
    spike[12] = 90;
    expect(smooth(spike, 5, 1)[12]).toBeCloseTo(10);
  });
});

describe('sheets', () => {
  const m = models[3]!;
  const heights = sampled(m, 64);

  test('a sheet is opaque inside the disc where the ground is high enough, clear outside it', () => {
    const mask = sheetMask(heights, m.low - 10, 64);
    const alpha = (x: number, y: number) => mask[(y * 64 + x) * 4]!;
    expect(alpha(32, 32)).toBe(255); // the centre, above the lowest level
    expect(alpha(0, 0)).toBe(0); // a corner, off the disc
    expect(mask[3]).toBe(255); // RGBA, the alpha channel is unused: the mask is in the colour
  });

  test('higher sheets cover less ground', () => {
    const cover = (level: number) =>
      sheetMask(heights, level, 64).reduce((s, v, i) => (i % 4 ? s : s + v), 0);
    const covers = m.levels.map(cover);
    covers.slice(1).forEach((c, k) => expect(c).toBeLessThanOrEqual(covers[k]!));
  });

  test('heights rise with the metres, from the base', () => {
    expect(heightOf(m.low, m.low)).toBeCloseTo(0.3);
    expect(heightOf(m.top, m.low)).toBeGreaterThan(heightOf(m.levels[0]!, m.low));
  });
});
