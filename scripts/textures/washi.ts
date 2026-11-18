// Washi & asagi identity: the long, thin fibers of handmade washi paper (Gemini prompt P4 was the
// reference; the site draws its own).
//
// How: each fiber is a gentle cubic curve sampled into a short polyline. A fiber that crosses an
// edge is also drawn shifted by one tile, so it continues on the other side and the tile repeats
// without a seam. Two stroke widths give the paper its mix of fine and heavier fibers.
import { pathFrom, random, tileSvg, type Point } from './shared.ts';

const TILE = 600;
const FIBERS = 105;
const SAMPLES = 10;
const SEED = 0x3a5b1;

export function washiTile() {
  const rand = random(SEED);
  const fine: Point[][] = [];
  const heavy: Point[][] = [];
  for (let f = 0; f < FIBERS; f++) {
    const length = 60 + rand() ** 2 * 180;
    // Mostly long diagonals, as kozo fibers settle when the sheet is shaken in the frame.
    const angle = (rand() < 0.7 ? Math.PI / 3 : 0) + rand() * Math.PI;
    const bend = (rand() - 0.5) * length * 0.3;
    const x0 = rand() * TILE;
    const y0 = rand() * TILE;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const p0: Point = [x0, y0];
    const p1: Point = [x0 + dx / 3 + nx * bend, y0 + dy / 3 + ny * bend];
    const p2: Point = [x0 + (2 * dx) / 3 - nx * bend * 0.6, y0 + (2 * dy) / 3 - ny * bend * 0.6];
    const p3: Point = [x0 + dx, y0 + dy];
    const line = Array.from({ length: SAMPLES + 1 }, (_, i): Point => {
      const t = i / SAMPLES;
      const u = 1 - t;
      const along = (k: 0 | 1) =>
        u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k];
      return [along(0), along(1)];
    });
    const target = rand() < 0.25 ? heavy : fine;
    for (const ox of [-TILE, 0, TILE]) {
      for (const oy of [-TILE, 0, TILE]) {
        const moved = line.map(([x, y]): Point => [x + ox, y + oy]);
        const inside = moved.some(([x, y]) => x >= -2 && x <= TILE + 2 && y >= -2 && y <= TILE + 2);
        if (inside) target.push(moved);
      }
    }
  }
  return {
    svg: tileSvg(TILE, [
      { d: pathFrom(fine), width: 0.6 },
      { d: pathFrom(heavy), width: 1.2 },
    ]),
    note: `${FIBERS} fibers`,
  };
}
