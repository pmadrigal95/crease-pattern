import { describe, expect, it } from 'vitest';
import { ogPageImage } from '../../src/lib/og-image';

// Social cards (src/lib/og-image.ts) draw text with the site's fonts. Spanish titles need accents,
// ñ and opening ¿ ¡; a glyph the fonts lack would draw as nothing, so the build fails instead.
describe('social cards', () => {
  it('draw Spanish text: accents, ñ, ¿ and ¡', async () => {
    const png = await ogPageImage({
      kicker: 'Versión en español',
      title: '¿Cuándo valen la pena los hilos? ¡Un año después, ñandú y pingüino!',
      name: 'Pablo Madrigal',
    });
    // A PNG, 1200 × 630.
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it('fail on text the fonts cannot draw, naming it', async () => {
    await expect(
      ogPageImage({ kicker: 'Test', title: 'Origami 折り紙', name: 'Pablo Madrigal' }),
    ).rejects.toThrow(/no font has/);
  });
});
