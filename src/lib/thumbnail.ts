/**
 * Precrease thumbnails: a geometric pattern drawn at build time from the post's slug, so the
 * same post always gets the same picture and no image files are needed. The post's format picks
 * the family (src/config/precrease.ts), so the thumbnail tells readers what kind of post it is:
 *
 *   crease   essay        mountain (solid) and valley (dashed) folds on a 4×4 sheet
 *   truchet  note         quarter arcs that link up across cells
 *   corner   dog-ear      quarter circles, half circles and squares, like folded corners
 *   cells    basic-folds  a dot grid that grows from one point
 *
 * Inspired by the pattern families in Book of Shapes (bookofshapes.com) but written from scratch:
 * its licence does not allow building a generator from its patterns.
 *
 * Output is SVG markup drawn in `currentColor`, so the page's color tokens style it.
 */
export type Family = 'crease' | 'truchet' | 'corner' | 'cells';

const SIZE = 120;

/** Deterministic random numbers from a string (cyrb-style hash feeding a xorshift-like mixer). */
export function seeded(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (const c of text) {
    h = Math.imul(h ^ c.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function crease(rand: () => number): string {
  const n = 4;
  const s = SIZE / n;
  let out = `<rect x="1" y="1" width="${SIZE - 2}" height="${SIZE - 2}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const X = x * s;
      const Y = y * s;
      const dash = rand() < 0.5 ? ' stroke-dasharray="4 3"' : '';
      const d = rand() < 0.5 ? `M${X} ${Y}L${X + s} ${Y + s}` : `M${X + s} ${Y}L${X} ${Y + s}`;
      out += `<path d="${d}" stroke="currentColor" stroke-width="1.8"${dash}/>`;
    }
  for (let i = 1; i < n; i++) {
    const dash = rand() < 0.5 ? ' stroke-dasharray="4 3"' : '';
    out += `<path d="M${i * s} 0V${SIZE}M0 ${i * s}H${SIZE}" stroke="currentColor" stroke-width="1" opacity=".55"${dash}/>`;
  }
  return out;
}

function truchet(rand: () => number): string {
  const n = 6;
  const s = SIZE / n;
  const h = s / 2;
  let d = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const X = x * s;
      const Y = y * s;
      d +=
        rand() < 0.5
          ? `M${X + h} ${Y}A${h} ${h} 0 0 1 ${X} ${Y + h}M${X + s} ${Y + h}A${h} ${h} 0 0 0 ${X + h} ${Y + s}`
          : `M${X + h} ${Y}A${h} ${h} 0 0 0 ${X + s} ${Y + h}M${X} ${Y + h}A${h} ${h} 0 0 1 ${X + h} ${Y + s}`;
    }
  return `<path d="${d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`;
}

function corner(rand: () => number): string {
  const n = 4;
  const s = SIZE / n;
  let out = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const X = x * s;
      const Y = y * s;
      const turn = Math.floor(rand() * 4) * 90;
      const pick = rand();
      const rotate = `transform="rotate(${turn} ${X + s / 2} ${Y + s / 2})"`;
      if (pick < 0.45)
        out += `<path d="M${X} ${Y}H${X + s}A${s} ${s} 0 0 1 ${X} ${Y + s}Z" fill="currentColor" ${rotate}/>`;
      else if (pick < 0.65)
        out += `<rect x="${X + 2}" y="${Y + 2}" width="${s - 4}" height="${s - 4}" fill="currentColor"/>`;
      else if (pick < 0.85)
        out += `<path d="M${X} ${Y + s}A${s / 2} ${s / 2} 0 0 1 ${X + s} ${Y + s}Z" fill="currentColor" ${rotate}/>`;
    }
  return out;
}

function cells(rand: () => number): string {
  const n = 9;
  const s = SIZE / n;
  const cx = rand() * SIZE;
  const cy = rand() * SIZE;
  let out = '';
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const px = x * s + s / 2;
      const py = y * s + s / 2;
      const distance = Math.hypot(px - cx, py - cy) / SIZE;
      const radius = Math.max(0.6, (s / 2 - 0.6) * (1 - distance * 1.1));
      out += `<circle cx="${r1(px)}" cy="${r1(py)}" r="${r1(radius)}" fill="currentColor"/>`;
    }
  return out;
}

const draw: Record<Family, (rand: () => number) => string> = { crease, truchet, corner, cells };

/** The viewBox and the shapes for a post's thumbnail. The crease family fills the whole sheet. */
export function thumbnail(slug: string, family: Family): { viewBox: string; shapes: string } {
  const pad = family === 'crease' ? 0 : 10;
  return {
    viewBox: `${-pad} ${-pad} ${SIZE + pad * 2} ${SIZE + pad * 2}`,
    shapes: draw[family](seeded(slug)),
  };
}
