import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import site from '../../site.config';
import { allVisualDirections } from '../../src/config/visual-direction';
import { FALLBACK_DIRECTION } from '../../scripts/tokens-config.mjs';

type Palette = Record<string, { $value: string }>;
const dir = join(process.cwd(), 'tokens/directions');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (id: string) =>
  JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as { light: Palette; dark: Palette };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// WCAG 2.2 AA: 4.5:1 for text, 3:1 for UI components and large text.
const TEXT = ['ink', 'mute', 'accent'] as const;
const UI = ['accentUi', 'second'] as const;
const REQUIRED = ['bg', 'surface', 'ink', 'mute', 'rule', 'accent', 'accentUi', 'second', 'earth'];

describe('visual directions', () => {
  it('has exactly one token file per VisualDirection', () => {
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual([...allVisualDirections].sort());
  });

  it('defaults to a direction that exists, matching the CSS fallback', () => {
    expect(allVisualDirections).toContain(site.visualDirection);
    expect(FALLBACK_DIRECTION).toBe(site.visualDirection);
  });

  for (const id of allVisualDirections) {
    for (const theme of ['light', 'dark'] as const) {
      describe(`${id} · ${theme}`, () => {
        const palette = load(id)[theme];

        it('defines every semantic color', () => {
          expect(Object.keys(palette).sort()).toEqual([...REQUIRED].sort());
        });

        for (const surface of ['bg', 'surface'] as const) {
          for (const role of TEXT) {
            it(`${role} on ${surface} passes 4.5:1`, () => {
              expect(contrast(palette[role]!.$value, palette[surface]!.$value)).toBeGreaterThanOrEqual(4.5);
            });
          }
          for (const role of UI) {
            it(`${role} on ${surface} passes 3:1`, () => {
              expect(contrast(palette[role]!.$value, palette[surface]!.$value)).toBeGreaterThanOrEqual(3);
            });
          }
        }
      });
    }
  }
});
