/**
 * Social preview images for Precrease posts (1200 × 630 PNG, for LinkedIn, X and the rest).
 * Built at build time: satori lays out the card and turns text into paths, resvg rasterizes it.
 * Colors are the default identity's light theme (Contour lines); fonts are the same families the
 * site uses, read as WOFF because satori can't read WOFF2.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { thumbnail, type Family } from './thumbnail';

const COLORS = { bg: '#EFF1EC', surface: '#FAFBF8', ink: '#18211D', mute: '#56605A', accent: '#245F86' };

const font = (pkg: string, file: string) =>
  readFileSync(join(process.cwd(), 'node_modules', pkg, 'files', file));
let fonts: Parameters<typeof satori>[1]['fonts'] | undefined;
const loadFonts = () =>
  (fonts ??= [
    {
      name: 'Newsreader',
      data: font('@fontsource/newsreader', 'newsreader-latin-600-normal.woff'),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Newsreader',
      data: font('@fontsource/newsreader', 'newsreader-latin-300-italic.woff'),
      weight: 300,
      style: 'italic',
    },
    {
      name: 'Schibsted',
      data: font('@fontsource/schibsted-grotesk', 'schibsted-grotesk-latin-500-normal.woff'),
      weight: 500,
      style: 'normal',
    },
  ]);

type Node = {
  type: string;
  props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown };
};
const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
  props: Record<string, unknown> = {},
): Node => ({
  type,
  props: { ...props, style: { display: 'flex', ...style }, children },
});

export interface OgPost {
  slug: string;
  family: Family;
  kicker: string;
  title: string;
}

export async function ogImage({ slug, family, kicker, title }: OgPost): Promise<Buffer> {
  const { viewBox, shapes } = thumbnail(slug, family);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" color="${COLORS.accent}">${shapes}</svg>`;
  const thumb = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const size = title.length > 60 ? 64 : title.length > 36 ? 76 : 92;

  // Satori sizes boxes without their padding, so the layout uses margins and explicit sizes:
  // a 14 px accent band, then a 1056 × 504 body inside 72 px / 56 px margins (1200 × 630 total).
  const card = el('div', { width: 1200, height: 630, flexDirection: 'column', background: COLORS.bg }, [
    el('div', { width: 1200, height: 14, background: COLORS.accent }),
    el('div', { width: 1056, height: 504, margin: '56px 72px', gap: 56 }, [
      el('div', { width: 600, height: 504, flexDirection: 'column', justifyContent: 'space-between' }, [
        el('div', { flexDirection: 'column', gap: 24 }, [
          el('div', { fontFamily: 'Schibsted', fontSize: 26, color: COLORS.mute }, kicker),
          el(
            'div',
            {
              fontFamily: 'Newsreader',
              fontWeight: 600,
              fontSize: size,
              lineHeight: 1.04,
              color: COLORS.ink,
              letterSpacing: -1,
            },
            title,
          ),
        ]),
        el('div', { alignItems: 'baseline', fontSize: 52 }, [
          el(
            'span',
            { fontFamily: 'Newsreader', fontStyle: 'italic', fontWeight: 300, color: COLORS.ink },
            'Pre',
          ),
          el('span', { fontFamily: 'Newsreader', fontWeight: 600, color: COLORS.accent }, 'crease'),
        ]),
      ]),
      el('div', { width: 400, height: 400, alignSelf: 'center', background: COLORS.surface }, [
        el('img', { width: 400, height: 400 }, undefined, { src: thumb, width: 400, height: 400 }),
      ]),
    ]),
  ]);

  const svgCard = await satori(card as never, { width: 1200, height: 630, fonts: loadFonts() });
  return new Resvg(svgCard, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
