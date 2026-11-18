import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { IRAZU, IRAZU_DEM } from '../../src/lib/identity-scenes';
import { IRAZU_MAP, irazuMap, smooth } from '../../src/lib/irazu-map';

const file = readFileSync(join(import.meta.dirname, '../../src/assets/scenes/irazu-dem.bin'));
const metres = new Uint16Array(file.buffer, file.byteOffset, file.byteLength / 2);

test('smoothing keeps a flat field flat and never leaves the data range', () => {
  const flat = new Array(25).fill(1500);
  expect(
    smooth(flat, 5, 2, 1)
      .flat()
      .every((v) => v === 1500),
  ).toBe(true);
  const field = smooth(metres, IRAZU_DEM.size, 1, 1).flat();
  expect(Math.min(...field)).toBeGreaterThanOrEqual(Math.min(...metres));
  expect(Math.max(...field)).toBeLessThanOrEqual(Math.max(...metres));
});

test('the map has a contour every 100 m, bold every 500 m, on real altitudes', () => {
  const map = irazuMap(metres);
  expect(map.size).toBe((IRAZU_DEM.size - 1) * IRAZU_MAP.cell);
  expect(map.lines.length).toBeGreaterThan(10);
  for (const line of map.lines) {
    expect(line.level % IRAZU.interval).toBe(0);
    expect(line.major).toBe(line.level % IRAZU.major === 0);
    expect(line.d).toMatch(/^M/);
  }
});

test('the trail ends at the summit, near the middle of the crop', () => {
  const { summit, size } = irazuMap(metres);
  expect(Math.abs(summit.x - size / 2)).toBeLessThan(size * 0.15);
  expect(Math.abs(summit.y - size / 2)).toBeLessThan(size * 0.15);
});
