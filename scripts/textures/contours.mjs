// Contour lines identity: topographic contour lines (design debt fix 4; Gemini prompt P4 was the
// reference, and "the AI explores, the SVG decides").
//
// How: a height field made of sines with whole-number frequencies repeats exactly every TILE
// units, so the lines meet themselves at the edges. Marching squares traces each contour level
// on a grid that wraps around, then the segments are joined into polylines to keep the file small.
import { pathFrom, random, tileSvg } from './shared.mjs';

const TILE = 600; // SVG units; the CSS draws one tile per 600 CSS pixels
const GRID = 150; // samples per side
const LEVELS = 16;
const SEED = 0x0c0ffee;

export function contourTile() {
  const rand = random(SEED);
  // Low frequencies give broad hills; a few higher ones add the wobble of real terrain.
  const waves = Array.from({ length: 9 }, (_, k) => {
    const max = k < 4 ? 2 : 4;
    let i = 0;
    let j = 0;
    while (i === 0 && j === 0) {
      i = Math.floor(rand() * (2 * max + 1)) - max;
      j = Math.floor(rand() * (2 * max + 1)) - max;
    }
    return { i, j, amp: 1 / (1 + Math.hypot(i, j)) ** 1.1, phase: rand() * Math.PI * 2 };
  });
  const height = (u, v) =>
    waves.reduce((sum, w) => sum + w.amp * Math.sin(2 * Math.PI * (w.i * u + w.j * v) + w.phase), 0);

  // Sample the field on a wrapping grid.
  const field = [];
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const h = height(x / GRID, y / GRID);
      field.push(h);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  }
  const at = (x, y) => field[((y + GRID) % GRID) * GRID + ((x + GRID) % GRID)];
  const step = TILE / GRID;
  const r = (n) => Math.round(n * 10) / 10;

  // Marching squares: for each level, collect segments as pairs of points.
  const segments = [];
  for (let l = 1; l <= LEVELS; l++) {
    const level = min + ((max - min) * l) / (LEVELS + 1);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const c = [at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)];
        const corners = [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ];
        const cross = [];
        for (let e = 0; e < 4; e++) {
          const a = c[e];
          const b = c[(e + 1) % 4];
          if (a < level !== b < level) {
            const t = (level - a) / (b - a);
            const [ax, ay] = corners[e];
            const [bx, by] = corners[(e + 1) % 4];
            cross.push([r((ax + (bx - ax) * t) * step), r((ay + (by - ay) * t) * step)]);
          }
        }
        if (cross.length === 2) segments.push(cross);
        if (cross.length === 4) segments.push([cross[0], cross[1]], [cross[2], cross[3]]);
      }
    }
  }

  // Join segments that share an end into polylines.
  const key = ([x, y]) => `${x},${y}`;
  const byEnd = new Map();
  segments.forEach((s, n) => {
    for (const p of s) byEnd.set(key(p), [...(byEnd.get(key(p)) ?? []), n]);
  });
  const used = new Set();
  const lines = [];
  segments.forEach((seg, n) => {
    if (used.has(n)) return;
    used.add(n);
    const line = [...seg];
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? line[line.length - 1] : line[0];
        const next = (byEnd.get(key(tip)) ?? []).find((m) => !used.has(m));
        if (next === undefined) break;
        used.add(next);
        const [a, b] = segments[next];
        const other = key(tip) === key(a) ? b : a;
        if (atEnd) line.push(other);
        else line.unshift(other);
      }
    }
    lines.push(line);
  });

  const d = pathFrom(lines.filter((line) => line.length > 2));
  return { svg: tileSvg(TILE, [{ d, width: 1 }]), note: `${lines.length} contour lines` };
}
