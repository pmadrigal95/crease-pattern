/**
 * The math of M4's identity scenes (decided in the demo derby, round 2): what stands behind the
 * fox while inspecting, one scene per visual direction. Pure functions, no three.js, so the scene
 * and the tests read the same numbers. Each scene is posed by Inspect's phases
 * (inspectPhases in src/lib/fold3d.ts): it rises, then its details trace in.
 *
 * - Contour lines: the Irazú volcano from real elevation data, contours every 100 m.
 * - Basalt & glacier: hexagonal columns rising ring by ring, frosted with ice.
 * - Washi & asagi: a stack of fibred sheets lifting one by one, then an ink stain spreading.
 *
 * In each, the part working right now (the tracing contour, the rising ring, the lifting sheet)
 * carries the accent; nothing else does.
 */
import { stateToState } from './fold3d';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Changing identity while inspecting: the old scene sinks, the new one rises this much later. */
export const EXCHANGE_DELAY_MS = 120;

/** A seeded random sequence (Park–Miller): the same paper on every visit. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------- Contour lines: the Irazú ----------

/**
 * The Irazú from real elevation data: Copernicus GLO-30 (30 m), cropped to 0.12° (about 13.4 km)
 * around the summit and averaged down to a 161 × 161 grid of whole metres
 * (src/assets/scenes/irazu-dem.bin: uint16, little-endian, rows north to south, columns west to
 * east). The summit is 3,432 m; averaging over each ~84 m cell leaves the grid's top a little
 * lower. Contours every 100 m, bold every 500 m, on the grid's real heights.
 */
export const IRAZU = { summit: 3432, interval: 100, major: 500 } as const;
export const IRAZU_DEM = {
  /** Vertices per side. */
  size: 161,
  /** Width of the crop, in metres. */
  across: 13_360,
  /** Heights are drawn this much taller than true scale, so the relief reads at hero size. */
  exaggeration: 2,
} as const;

/** The terrain plane: its size in scene units and how many segments each side has. */
export const TERRAIN = { size: 9, segments: IRAZU_DEM.size - 1 } as const;

export interface IrazuModel {
  /** Model height per vertex (scene units), 0 at the grid's lowest point. */
  heights: Float32Array;
  /** The highest model height. */
  hmax: number;
  /** The grid's lowest and highest points, in metres above sea level. */
  base: number;
  top: number;
  /** Model height ↔ metres above sea level: one source for the lines and any figure. */
  toMetres(h: number): number;
  unitsPer(metres: number): number;
}

/** Turns the grid's metres into model heights, on the plane's scale times the exaggeration. */
export function irazuModel(metres: ArrayLike<number>): IrazuModel {
  let base = Infinity;
  let top = -Infinity;
  for (let i = 0; i < metres.length; i++) {
    base = Math.min(base, metres[i]!);
    top = Math.max(top, metres[i]!);
  }
  const unitsPerMetre = (TERRAIN.size / IRAZU_DEM.across) * IRAZU_DEM.exaggeration;
  const heights = Float32Array.from(metres, (m) => (m - base) * unitsPerMetre);
  return {
    heights,
    hmax: (top - base) * unitsPerMetre,
    base,
    top,
    toMetres: (h) => base + h / unitsPerMetre,
    unitsPer: (m) => m * unitsPerMetre,
  };
}

/**
 * Where the tracing contour is, in model height: it walks down from the summit to the base across
 * the whole detail window (linear progress d), so every line is the working one for a moment.
 * Above the model before it starts, below it once done.
 */
export function contourFront(d: number, hmax: number): number {
  if (d <= 0) return hmax + 1;
  if (d >= 1) return -1;
  return hmax * (1 - stateToState(d));
}

// ---------- Basalt & glacier: columns ----------

/** A column's radius, and how far from the centre columns still stand (scene units). */
export const BASALT = { radius: 0.16, reach: 2.6 } as const;

export interface BasaltColumn {
  x: number;
  z: number;
  /** Full height, scene units. */
  h: number;
  /** Which ring from the centre it stands in, 0 first. */
  ring: number;
  moss: boolean;
}

/** The columns on a hexagonal grid, highest near the back-centre, in rings from the centre. */
export function basaltColumns(): BasaltColumn[] {
  const R = BASALT.radius;
  const columns: BasaltColumn[] = [];
  for (let q = -9; q <= 9; q++)
    for (let r = -9; r <= 9; r++) {
      const x = R * 1.5 * q;
      const z = R * Math.sqrt(3) * (r + q / 2);
      const d = Math.hypot(x, z);
      if (d > BASALT.reach) continue;
      const h =
        0.25 +
        0.9 * Math.max(0, 1 - Math.hypot(x * 0.7, z + 0.6) / BASALT.reach) +
        0.12 * Math.sin(q * 1.9 + r * 1.3);
      columns.push({
        x,
        z,
        h,
        ring: Math.round(d / (R * Math.sqrt(3))),
        moss: Math.sin(q * 7.1 + r * 3.7) > 0.72,
      });
    }
  return columns;
}

/**
 * How far ring `ring` of `rings` has risen, from the rise phase's linear progress. Each ring takes
 * a fifth of the phase, so two or three rings move at once: one working front, centre outward.
 */
export function ringProgress(rise: number, ring: number, rings: number): number {
  return clamp01(rise * 5 - (ring / rings) * 4);
}

// ---------- Washi & asagi: sheets ----------

export const WASHI = { sheets: 5, width: 2.5, height: 1.75 } as const;

/** How far sheet `i` (0 at the bottom of the stack) has lifted: the top sheets lift first. */
export function sheetProgress(rise: number, i: number): number {
  return clamp01(rise * 2 - (WASHI.sheets - 1 - i) * 0.25);
}
