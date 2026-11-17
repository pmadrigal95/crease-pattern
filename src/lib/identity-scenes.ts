/**
 * The math of M4's identity scenes (decided in the demo derby, round 2): what stands behind the
 * fox while inspecting, one scene per visual direction. Pure functions, no three.js, so the scene
 * and the tests read the same numbers. Each scene is posed by Inspect's phases
 * (inspectPhases in src/lib/fold3d.ts): it rises, then its details trace in.
 *
 * - Contour lines: the Irazú volcano, scaled to its real summit, contours every 100 m.
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

/** A seeded random sequence (Park–Miller): the same paper and the same terrain on every visit. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------- Contour lines: the Irazú ----------

/**
 * Real numbers: the Irazú's summit is 3,432 m above sea level. The model's base is set at 1,400 m.
 * The shape is procedural until real elevation data replaces it (Copernicus GLO-30, 21-m4-plan.md).
 */
export const IRAZU = { summit: 3432, base: 1400, interval: 100, major: 500 } as const;

/** The terrain plane: its size in scene units and how many segments each side has. */
export const TERRAIN = { size: 9, segments: 160 } as const;

/**
 * The volcano's height at a point of the terrain plane (scene units, before scaling): a cone with
 * a crater, a side vent and a little noise. Never below 0, the flat ground around it.
 */
export function irazuHeight(x: number, z: number): number {
  const zc = z + 1.2;
  const r = Math.hypot(x * 0.9, zc);
  const cone = Math.max(0, 1.55 - r * 0.62) ** 1.6;
  const crater = -0.28 * Math.exp(-((r - 0.05) ** 2) / 0.05);
  const side = 0.35 * Math.exp(-((x + 1.4) ** 2 + (zc + 0.6) ** 2) / 0.5);
  const noise =
    Math.sin(x * 1.7 + zc * 0.6) * 0.06 +
    Math.sin(zc * 2.3 - x * 1.1) * 0.05 +
    Math.sin((x + zc) * 4.1) * 0.02;
  return Math.max(0, cone + crater + side + noise);
}

/** Model height ↔ metres, given the model's highest point: one source for lines and figures. */
export function irazuScale(hmax: number) {
  const span = IRAZU.summit - IRAZU.base;
  return {
    toMetres: (h: number) => IRAZU.base + (h / hmax) * span,
    unitsPer: (metres: number) => (metres / span) * hmax,
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
