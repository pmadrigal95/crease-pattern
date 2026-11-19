/**
 * Every origami figure as one SVG file, /origami.svg (src/pages/origami.svg.ts): each figure folded
 * (`origami-<id>`) and laid open as its crease pattern (`origami-<id>-flat`), as symbols the
 * masthead, the footer, the hero and the 404 map place with <use href="/origami.svg#…">.
 *
 * A file, not markup in every page: the browser downloads it once and caches it, and the pages
 * stay as light as before. That mattered: inline, it pushed the About page's HTML past the first
 * round trip of a slow connection (one more round trip, about 75 ms of LCP).
 *
 * The colours live in the file's own stylesheet (an external <use> only takes styles from the
 * file it points into), written with the page's custom properties, which do cross into it: the
 * identity's accent, ink and surface, and --origami-paper and --origami-dark from
 * src/styles/origami.css. Which figure shows is still the page's call (origami.css).
 */
import { createHash } from 'node:crypto';
import { EDGE_MIX, FROG_EYE, ROLE_MIX, VIEWBOX, flatMark, foldedMark } from './marks';
import { MODEL_IDS, type ModelId } from './models';

const pct = (n: number) => `${Math.round(n * 100)}%`;

const STYLE = `
path { stroke: var(--color-surface); stroke-width: 0.1; stroke-linejoin: round; }
.o-light { fill: color-mix(in oklab, var(--color-accent) ${pct(ROLE_MIX.light)}, var(--origami-paper)); }
.o-mid { fill: color-mix(in oklab, var(--color-accent) ${pct(ROLE_MIX.mid)}, var(--origami-paper)); }
.o-shade { fill: color-mix(in oklab, var(--color-accent) ${pct(ROLE_MIX.shade)}, var(--origami-paper)); }
.o-deep { fill: color-mix(in oklab, var(--color-accent) ${pct(ROLE_MIX.deep)}, var(--origami-paper)); }
.o-accent { fill: var(--color-accent); }
.o-wing { fill: var(--color-accent-ui); }
.o-edge { fill: color-mix(in oklab, var(--color-accent) ${pct(1 - EDGE_MIX)}, var(--origami-dark)); }
#origami-frog .o-accent { fill: ${FROG_EYE}; }
.o-sheet { fill: var(--color-surface); stroke: var(--color-rule); stroke-width: 0.3; }
.o-mountain, .o-valley { fill: none; stroke: var(--color-accent-ui); stroke-width: 0.55; stroke-linecap: round; }
.o-valley { stroke-dasharray: 1.4 1.2; }
`
  .trim()
  .replace(/\n/g, '');

const symbols = (id: ModelId): string => {
  const folded = foldedMark(id)
    .facets.map((f) => `<path class="o-${f.role}" d="${f.d}"/>`)
    .join('');
  const flat = flatMark(id);
  const open = [
    ...flat.facets.map((d) => `<path class="o-sheet" d="${d}"/>`),
    `<path class="o-mountain" d="${flat.mountain}"/>`,
    `<path class="o-valley" d="${flat.valley}"/>`,
  ].join('');
  return `<symbol id="origami-${id}" viewBox="${VIEWBOX}">${folded}</symbol><symbol id="origami-${id}-flat" viewBox="${VIEWBOX}">${open}</symbol>`;
};

/** The whole file. */
export const spriteSvg = (): string =>
  `<svg xmlns="http://www.w3.org/2000/svg"><style>${STYLE}</style>${MODEL_IDS.map(symbols).join('')}</svg>`;

/** A short fingerprint of the file, so a changed figure never comes from an old cache. */
const version = createHash('sha256').update(spriteSvg()).digest('hex').slice(0, 10);

/** Where a figure's symbol is: folded, or laid open as its crease pattern. */
export const spriteHref = (id: ModelId, flat = false): string =>
  `/origami.svg?v=${version}#origami-${id}${flat ? '-flat' : ''}`;
