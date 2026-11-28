import { describe, expect, test } from 'vitest';
import { creaseCells, thumbnail } from '../../src/lib/thumbnail';
import { treemap } from '../../src/lib/treemap';

// Precrease's collection and topic sheet (doc 41).
describe('a crease thumbnail and what the Inspector says it is made of', () => {
  test('every cell the Inspector lists is the fold the thumbnail draws', () => {
    for (const slug of ['one-unit-thirty-shapes', 'when-threads-pay-off', 'the-work-before-the-shape']) {
      const { seed, cells } = creaseCells(slug);
      expect(seed).toMatch(/^[0-9a-f]{8}$/);
      const drawn = [
        ...thumbnail(slug, 'crease').shapes.matchAll(/<path d="M([\d.]+) [\d.]+L([\d.]+) [\d.]+"[^>]*\/>/g),
      ]
        .slice(0, 16)
        .map(([tag, x1, x2]) => ({
          valley: tag.includes('stroke-dasharray'),
          backslash: Number(x2) > Number(x1),
        }));
      expect(drawn).toEqual(cells);
    }
  });
});

describe('the topic sheet', () => {
  const items = [5, 3, 1, 1].map((weight, i) => ({ weight, i }));
  const regions = treemap(items, { x: 0, y: 0, w: 720, h: 520 });

  test('covers the sheet exactly, every region sized by its weight', () => {
    expect(regions).toHaveLength(4);
    const area = regions.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(area).toBeCloseTo(720 * 520, 3);
    for (const r of regions) expect((r.w * r.h) / (720 * 520)).toBeCloseTo(r.item.weight / 10, 3);
  });

  test('no two regions overlap', () => {
    regions.forEach((a, i) =>
      regions.slice(i + 1).forEach((b) => {
        const overlap =
          a.x < b.x + b.w - 1e-6 &&
          b.x < a.x + a.w - 1e-6 &&
          a.y < b.y + b.h - 1e-6 &&
          b.y < a.y + a.h - 1e-6;
        expect(overlap).toBe(false);
      }),
    );
  });
});
