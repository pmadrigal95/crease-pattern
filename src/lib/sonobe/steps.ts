/**
 * The stages of folding one Sonobe unit, as the first act of Crease No. 003 draws them. Stages, not
 * full instructions: each is a shape whose geometry the tests check (areas, where the flaps land).
 *
 * The paper is a square 4 × 4, y pointing down as in SVG. Each stage has the outline of the paper
 * as it now lies, the creases made so far that are still visible, and the flaps folded on top.
 * The last stage is the finished unit (geometry.ts, FLAT_UNIT): a square face between two tabs.
 */
import { FLAT_UNIT, type Vec2 } from './geometry';

export interface FoldStage {
  /** The paper's outline as it lies now. */
  outline: readonly Vec2[];
  /** Folds made so far that still show, as segments. */
  creases: readonly (readonly [Vec2, Vec2])[];
  /** Layers folded over on top, drawn a shade darker. */
  flaps: readonly (readonly Vec2[])[];
}

export const PAPER = 4;

/** Reflects point p across the line through a and b: where a corner lands when folded on that line. */
export function reflect(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const foot: Vec2 = [a[0] + t * dx, a[1] + t * dy];
  return [2 * foot[0] - p[0], 2 * foot[1] - p[1]];
}

// Stage 3: the strip runs from y = 1 to y = 3. The bottom-left corner folds up on the line through
// (0, 1) and (2, 3), the top-right corner down on the line through (2, 1) and (4, 3).
const leftFold: [Vec2, Vec2] = [
  [0, 1],
  [2, 3],
];
const rightFold: [Vec2, Vec2] = [
  [2, 1],
  [4, 3],
];

export const STAGES: readonly FoldStage[] = [
  // 1. A square of paper.
  {
    outline: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    creases: [],
    flaps: [],
  },
  // 2. Folded in half and opened: one crease across the middle.
  {
    outline: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    creases: [
      [
        [0, 2],
        [4, 2],
      ],
    ],
    flaps: [],
  },
  // 3. Both long edges folded to that crease: a strip half as tall, two flaps meeting in the middle.
  {
    outline: [
      [0, 1],
      [4, 1],
      [4, 3],
      [0, 3],
    ],
    creases: [
      [
        [0, 2],
        [4, 2],
      ],
    ],
    flaps: [
      [
        [0, 1],
        [4, 1],
        [4, 2],
        [0, 2],
      ],
      [
        [0, 2],
        [4, 2],
        [4, 3],
        [0, 3],
      ],
    ],
  },
  // 4. Two opposite corners folded in: a parallelogram, the two triangles on top.
  {
    outline: [leftFold[0], rightFold[0], rightFold[1], leftFold[1]],
    creases: [leftFold, rightFold],
    flaps: [
      [leftFold[0], leftFold[1], reflect([0, 3], ...leftFold)],
      [rightFold[0], rightFold[1], reflect([4, 1], ...rightFold)],
    ],
  },
  // 5. The finished unit: a square face between two tabs (drawn from FLAT_UNIT).
  {
    outline: [FLAT_UNIT.tabs[0][0], FLAT_UNIT.tabs[0][2], FLAT_UNIT.tabs[1][1], FLAT_UNIT.tabs[1][0]],
    creases: [
      [FLAT_UNIT.face[0], FLAT_UNIT.face[3]],
      [FLAT_UNIT.face[1], FLAT_UNIT.face[2]],
    ],
    flaps: [],
  },
];

/** Area of a simple polygon (shoelace). */
export const area = (points: readonly Vec2[]): number =>
  Math.abs(
    points.reduce((sum, [x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length]!;
      return sum + x * ny - nx * y;
    }, 0),
  ) / 2;

/** The smallest box around a stage, for its SVG viewBox. */
export function bounds(stage: FoldStage): { x: number; y: number; width: number; height: number } {
  const xs = stage.outline.map(([x]) => x);
  const ys = stage.outline.map(([, y]) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
