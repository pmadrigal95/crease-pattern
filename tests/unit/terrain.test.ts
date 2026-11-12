import { describe, expect, test } from 'vitest';
import { places } from '../../src/lib/career';
import { crosses, expeditionMap, overlaps, type MapFrame, type Place } from '../../src/lib/terrain';

// The volcanoes at their real coordinates (design debt phase 2). The map is generated at build
// time and inlined in the page, so it must stay readable as places are added and light enough
// to ship.
const wide: MapFrame = {
  width: 1000,
  height: 520,
  pad: { top: 70, right: 130, bottom: 70, left: 90 },
  cell: 8,
  floorM: 1000,
  intervalM: 250,
};
const narrow: MapFrame = {
  width: 360,
  height: 420,
  pad: { top: 60, right: 104, bottom: 60, left: 36 },
  cell: 6,
  floorM: 1000,
  intervalM: 250,
  compact: true,
};
const real = places();
const withChirripo: Place[] = [
  ...real,
  { major: 4, codename: 'Chirripó', elevationM: 3820, lat: 9.484, lon: -83.489 },
];

describe('expedition map', () => {
  test.each([
    ['real places, wide', real, wide],
    ['real places, phone', real, narrow],
    ['with Chirripó, wide', withChirripo, wide],
    ['with Chirripó, phone', withChirripo, narrow],
  ] as const)('%s: every label inside the frame, clear of labels, pins and the route', (_, data, frame) => {
    const { pins } = expeditionMap(data, frame);
    for (const pin of pins)
      for (const [a, z] of pins.slice(1).map((p, i) => [pins[i]!, p] as const))
        expect(crosses(pin.label.box, a, z)).toBe(false);
    expect(pins.map((p) => p.major)).toEqual(data.map((p) => p.major));
    for (const [i, a] of pins.entries()) {
      const b = a.label.box;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(frame.width);
      expect(b.y + b.height).toBeLessThanOrEqual(frame.height);
      for (const other of pins.slice(i + 1)) expect(overlaps(b, other.label.box)).toBe(false);
      for (const other of pins.filter((_, j) => j !== i))
        expect(overlaps(b, { x: other.x - 8, y: other.y - 8, width: 16, height: 16 })).toBe(false);
    }
  });

  test('places keep their real arrangement: Poás west, Turrialba east, Cartago south', () => {
    const { pins } = expeditionMap(real, wide);
    const at = (major: number) => pins.find((p) => p.major === major)!;
    expect(at(1).x).toBeLessThan(at(3).x);
    expect(at(3).x).toBeLessThan(at(2).x);
    expect(at(0).y).toBeGreaterThan(at(3).y);
    expect(at(1).y).toBeLessThan(at(0).y);
  });

  test('contours every 250 m up to the highest summit, every fourth one an index line', () => {
    const { contours } = expeditionMap(real, wide);
    expect(contours[0]!.m).toBe(1250);
    expect(contours.at(-1)!.m).toBeLessThan(3432);
    expect(contours.filter((c) => c.index).map((c) => c.m)).toEqual([2000, 3000]);
  });

  test('the map stays light enough to inline in the page', () => {
    for (const frame of [wide, narrow]) {
      const { contours, route } = expeditionMap(real, frame);
      const bytes = contours.reduce((n, c) => n + c.d.length, route.length);
      expect(bytes).toBeLessThan(28_000);
    }
  });

  test('the same input always draws the same map', () => {
    expect(expeditionMap(real, wide)).toEqual(expeditionMap(real, wide));
  });
});
