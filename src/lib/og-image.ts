/**
 * Social preview images (1200 × 630 PNG, for LinkedIn, X and the rest): one per Precrease post,
 * and one for each of the site's own pages.
 * Built at build time: satori lays out the card and turns text into paths, resvg rasterizes it.
 * Colors are the default identity's light theme (Contour lines); fonts are the same families the
 * site uses, read as WOFF because satori can't read WOFF2.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { thumbnail, type Family } from './thumbnail';
import { EDGE_MIX, ROLE_MIX, flatMark, foldedMark, modelFor, VIEWBOX, type Role } from './origami/marks';

const COLORS = {
  bg: '#EFF1EC',
  surface: '#FAFBF8',
  ink: '#18211D',
  mute: '#56605A',
  rule: '#D9DED6',
  accent: '#245F86',
  accentUi: '#3B82B0',
};

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

const svgData = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/**
 * The card both kinds of preview share: an accent band, a kicker and a headline on the left, a
 * signature at the foot, and a 400 × 400 picture on the right.
 */
async function card({
  kicker,
  title,
  signature,
  picture,
}: {
  kicker: string;
  title: string;
  signature: Node;
  picture: string;
}) {
  const size = title.length > 60 ? 64 : title.length > 36 ? 76 : 92;
  // Satori sizes boxes without their padding, so the layout uses margins and explicit sizes:
  // a 14 px accent band, then a 1056 × 504 body inside 72 px / 56 px margins (1200 × 630 total).
  const root = el('div', { width: 1200, height: 630, flexDirection: 'column', background: COLORS.bg }, [
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
        signature,
      ]),
      el('div', { width: 400, height: 400, alignSelf: 'center', background: COLORS.surface }, [
        el('img', { width: 400, height: 400 }, undefined, { src: picture, width: 400, height: 400 }),
      ]),
    ]),
  ]);
  const svgCard = await satori(root as never, { width: 1200, height: 630, fonts: loadFonts() });
  return new Resvg(svgCard, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

/** A Precrease post: its kicker, title and generated thumbnail, signed "Precrease". */
export async function ogImage({ slug, family, kicker, title }: OgPost): Promise<Buffer> {
  const { viewBox, shapes } = thumbnail(slug, family);
  return card({
    kicker,
    title,
    picture: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" color="${COLORS.accent}">${shapes}</svg>`,
    ),
    signature: el('div', { alignItems: 'baseline', fontSize: 52 }, [
      el(
        'span',
        { fontFamily: 'Newsreader', fontStyle: 'italic', fontWeight: 300, color: COLORS.ink },
        'Pre',
      ),
      el('span', { fontFamily: 'Newsreader', fontWeight: 600, color: COLORS.accent }, 'crease'),
    ]),
  });
}

/** Mixes two #rrggbb colours: `t` of `b` over `a`. */
const mix = (a: string, b: string, t: number) => {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  // 256 + n, minus its leading 1: two hex digits for any channel, no padding by hand.
  const hex = (n: number) => (256 + Math.round(n)).toString(16).slice(1);
  return `#${[0, 1, 2].map((i) => hex(ch(a, i) + (ch(b, i) - ch(a, i)) * t)).join('')}`;
};
/** The roles of src/styles/origami.css, in the default identity's light theme. */
const ROLE_FILL: Record<Role, string> = {
  light: mix(COLORS.surface, COLORS.accent, ROLE_MIX.light),
  mid: mix(COLORS.surface, COLORS.accent, ROLE_MIX.mid),
  shade: mix(COLORS.surface, COLORS.accent, ROLE_MIX.shade),
  deep: mix(COLORS.surface, COLORS.accent, ROLE_MIX.deep),
  accent: COLORS.accent,
  wing: COLORS.accentUi,
  edge: mix(COLORS.accent, COLORS.ink, EDGE_MIX),
};

/**
 * The site's own pages (home, About, Changelog, Colophon, and the default for the rest): the
 * page's title as the kicker, its description as the headline, signed with the owner's name, and
 * the site's thesis as the picture: the default identity's figure (the blue morpho, Contour lines
 * by day) over the crease pattern it folds from (src/lib/origami, the geometry the hero draws).
 */
export async function ogPageImage({
  kicker,
  title,
  name,
}: {
  kicker: string;
  title: string;
  name: string;
}): Promise<Buffer> {
  const id = modelFor('contour-lines', false);
  const flat = flatMark(id);
  const figure = foldedMark(id)
    .facets.map(
      (f) =>
        `<path d="${f.d}" fill="${ROLE_FILL[f.role]}" stroke="${COLORS.surface}" stroke-width="0.25" stroke-linejoin="round"/>`,
    )
    .join('');
  const pattern = `${flat.facets.map((d) => `<path d="${d}" fill="${COLORS.surface}" stroke="${COLORS.rule}" stroke-width="0.3"/>`).join('')}
    <g fill="none" stroke="${COLORS.accentUi}" stroke-width="0.45" stroke-linecap="round" opacity="0.55">
      <path d="${flat.mountain}"/><path d="${flat.valley}" stroke-dasharray="1.4 1.2"/>
    </g>`;
  // The figure stands on its pattern, a little smaller, so the folds still read around it.
  const standing = `<g transform="translate(24 26) scale(0.62) translate(-24 -24)">${figure}</g>`;
  return card({
    kicker,
    title,
    picture: svgData(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${pattern}${standing}</svg>`,
    ),
    signature: el('div', { alignItems: 'center', gap: 18 }, [
      el('img', { width: 52, height: 52 }, undefined, {
        src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}">${figure}</svg>`),
        width: 52,
        height: 52,
      }),
      el('div', { fontFamily: 'Schibsted', fontSize: 34, color: COLORS.ink }, name),
    ]),
  });
}
