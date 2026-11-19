/**
 * The 404 page's map (design debt phase 4): the Irazú's contours from the same Copernicus grid the
 * 3D scene draws (src/assets/scenes/irazu-dem.bin, see IRAZU_DEM in ./identity-scenes). Pure
 * functions, no DOM; NotFoundMap.astro reads the file at build time and draws the result.
 *
 * The grid is smoothed first (a few passes of a box blur, about 300 m across), so the lines trace
 * the volcano's shape rather than every gully, then traced with the changelog map's marching
 * squares (./terrain).
 */
import { IRAZU, IRAZU_DEM } from './identity-scenes';
import { march, polylines } from './terrain';

export const IRAZU_MAP = {
  /** Map units per grid step: the map is (size − 1) × cell units square. */
  cell: 2,
  /** Box-blur passes and radius, in grid steps (~84 m each). */
  passes: 3,
  radius: 2,
} as const;

export interface ContourLine {
  /** Metres above sea level. */
  level: number;
  /** Every 500 m, drawn stronger. */
  major: boolean;
  d: string;
}

export interface IrazuMap {
  /** The map's width and height, in map units. */
  size: number;
  lines: ContourLine[];
  /** The highest point of the smoothed grid, in map units: where the trail ends. */
  summit: { x: number; y: number };
}

/** The mean of the points within `radius` of (r, c) that are on the grid. */
function neighbourhoodMean(
  field: readonly (readonly number[])[],
  r: number,
  c: number,
  radius: number,
): number {
  let sum = 0;
  let count = 0;
  for (let dr = -radius; dr <= radius; dr++)
    for (let dc = -radius; dc <= radius; dc++) {
      const v = field[r + dr]?.[c + dc];
      if (v === undefined) continue;
      sum += v;
      count++;
    }
  return sum / count;
}

/** Averages each point with its neighbours within `radius`, `passes` times. */
export function smooth(metres: ArrayLike<number>, n: number, passes: number, radius: number): number[][] {
  let field = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => metres[r * n + c]!));
  for (let p = 0; p < passes; p++) {
    const before = field;
    field = before.map((row, r) => row.map((_, c) => neighbourhoodMean(before, r, c, radius)));
  }
  return field;
}

/** The contour map of the Irazú, from the grid's metres (rows north to south). */
export function irazuMap(metres: ArrayLike<number>): IrazuMap {
  const n = IRAZU_DEM.size;
  const field = smooth(metres, n, IRAZU_MAP.passes, IRAZU_MAP.radius);
  let low = Infinity;
  let high = -Infinity;
  let summit = { x: 0, y: 0 };
  field.forEach((row, r) =>
    row.forEach((v, c) => {
      low = Math.min(low, v);
      if (v > high) {
        high = v;
        summit = { x: c * IRAZU_MAP.cell, y: r * IRAZU_MAP.cell };
      }
    }),
  );
  const lines: ContourLine[] = [];
  for (let level = Math.ceil(low / IRAZU.interval) * IRAZU.interval; level < high; level += IRAZU.interval) {
    const d = polylines(march(field, level, IRAZU_MAP.cell));
    if (d) lines.push({ level, major: level % IRAZU.major === 0, d });
  }
  return { size: (n - 1) * IRAZU_MAP.cell, lines, summit };
}
