// Basalt & glacier identity: the tops of basalt columns seen from above, irregular cells with thin
// joints (Gemini prompt P4 was the reference; the site draws its own).
//
// How: a periodic Voronoi diagram. Seeds live in one tile and are copied to the eight around it,
// so every cell near an edge meets its neighbour from the next tile exactly. A few rounds of Lloyd
// relaxation (moving each seed to its cell's centroid) even out the cell sizes the way cooling lava
// does. Each shared edge is drawn once.
import { pathFrom, random, tileSvg } from './shared.mjs';

const TILE = 600;
const SEEDS = 58;
const RELAX = 3;
const SEED = 0xba5a17;
const OFFSETS = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [i * TILE, j * TILE]));

/** Sutherland–Hodgman: keeps the part of `poly` where (p - m) · n <= 0. */
function clip(poly, m, n) {
  const side = ([x, y]) => (x - m[0]) * n[0] + (y - m[1]) * n[1];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if (sa <= 0 !== sb <= 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** The Voronoi cell of `p` among `others` (all seed copies). */
function cell(p, others) {
  const reach = TILE / 2;
  let poly = [
    [p[0] - reach, p[1] - reach],
    [p[0] + reach, p[1] - reach],
    [p[0] + reach, p[1] + reach],
    [p[0] - reach, p[1] + reach],
  ];
  for (const q of others) {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    if ((dx === 0 && dy === 0) || Math.abs(dx) > reach * 1.2 || Math.abs(dy) > reach * 1.2) continue;
    poly = clip(poly, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], [dx, dy]);
  }
  return poly;
}

function centroid(poly) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

const copies = (seeds) => seeds.flatMap(([x, y]) => OFFSETS.map(([ox, oy]) => [x + ox, y + oy]));
const wrap = (v) => ((v % TILE) + TILE) % TILE;

export function basaltTile() {
  const rand = random(SEED);
  let seeds = Array.from({ length: SEEDS }, () => [rand() * TILE, rand() * TILE]);
  for (let round = 0; round < RELAX; round++) {
    const all = copies(seeds);
    seeds = seeds.map((p) => {
      const [x, y] = centroid(cell(p, all));
      return [wrap(x), wrap(y)];
    });
  }

  // Every edge of every cell that touches the tile, each drawn once.
  const all = copies(seeds);
  const seen = new Set();
  const edges = [];
  const key = ([x, y]) => `${Math.round(x * 2)},${Math.round(y * 2)}`;
  for (const p of all) {
    const poly = cell(p, all);
    const xs = poly.map(([x]) => x);
    const ys = poly.map(([, y]) => y);
    if (Math.max(...xs) < 0 || Math.min(...xs) > TILE || Math.max(...ys) < 0 || Math.min(...ys) > TILE)
      continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const id = [key(a), key(b)].sort().join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push([a, b]);
    }
  }
  return {
    svg: tileSvg(TILE, [{ d: pathFrom(edges), width: 1 }]),
    note: `${SEEDS} cells, ${edges.length} joints`,
  };
}
