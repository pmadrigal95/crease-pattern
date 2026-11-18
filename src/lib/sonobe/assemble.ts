/**
 * How the home page's Sonobe star comes together and comes apart (M4.3, decision 24): pure math,
 * no DOM, shared by the SVG and the three.js renderers and by the tests.
 *
 * Two inputs drive it:
 * - `a`, assembly, 0 → 1: units arrive one after another, bottom to top, each from its own
 *   direction, like a model built up on a table. Played once, when the Work section comes into view.
 * - `e`, Inspect, 0 → 1: every unit moves out along its own direction, so the 30 identical units
 *   show as separate pieces while the Inspector is open.
 */
import { assembly, length, type Assembly, type Vec3 } from './geometry';

export const STAR_UNITS = 30;

export const ASSEMBLE = {
  /** Each unit takes this share of the assembly; they start one after another. */
  arrive: 0.3,
  /** How far out a unit starts, along its own direction (model units; the star is about 2.3 across). */
  far: 1.6,
  /** How far Inspect moves each unit out. */
  part: 0.42,
  /** Assembly's length, ms. */
  ms: 2400,
  /** Inspect's length in and out, ms: leaving is quicker than arriving. */
  inspect: { enter: 900, exit: 420 },
  /** The view both renderers use: turned this far around y, then tipped this far toward the viewer. */
  yaw: 0.52,
  pitch: 0.42,
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A cubic-bezier easing, solved by bisection. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (bx(m) < x) lo = m;
      else hi = m;
    }
    return by((lo + hi) / 2);
  };
}
/** Arriving units ease out; Inspect runs state to state. The site's two motion curves. */
const easeOut = cubicBezier(0.23, 1, 0.32, 1);
const stateToState = cubicBezier(0.65, 0, 0.35, 1);

export interface Star {
  model: Assembly;
  /** Each unit's direction: from the centre through the middle of its two facets (over its edge). */
  directions: Vec3[];
  /** Each unit's place in the assembly order, 0 first. */
  rank: number[];
}

/** The 30-unit star with every unit's direction and its turn in the assembly. */
export function star(): Star {
  const model = assembly(STAR_UNITS);
  const sums = Array.from({ length: STAR_UNITS }, () => [0, 0, 0] as [number, number, number]);
  for (const f of model.facets)
    for (const p of f.points) for (let k = 0; k < 3; k++) sums[f.unit]![k]! += p[k]!;
  const directions = sums.map((s) => {
    const l = length(s);
    return [s[0] / l, s[1] / l, s[2] / l] as Vec3;
  });
  // Bottom to top, then left to right: the star builds up like a model on a table.
  const order = directions
    .map((d, unit) => ({ unit, d }))
    .sort((p, q) => p.d[1] - q.d[1] || p.d[0] - q.d[0])
    .map(({ unit }) => unit);
  const rank: number[] = [];
  order.forEach((unit, i) => (rank[unit] = i));
  return { model, directions, rank };
}

/** How far the unit with this rank has arrived, 0 → 1, at assembly a. */
export function arrived(rank: number, a: number): number {
  const start = (rank / (STAR_UNITS - 1)) * (1 - ASSEMBLE.arrive);
  return clamp01((a - start) / ASSEMBLE.arrive);
}

/** How far the unit with this rank sits out along its direction, at assembly a and Inspect e. */
export function unitOffset(rank: number, a: number, e: number): number {
  return ASSEMBLE.far * (1 - easeOut(arrived(rank, a))) + ASSEMBLE.part * stateToState(e);
}

/** A point of the model turned into the shared view: around y by `yaw`, then by `pitch`. */
export function toView([x, y, z]: Vec3, yaw: number = ASSEMBLE.yaw, pitch: number = ASSEMBLE.pitch): Vec3 {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

export interface DrawnFacet {
  /** Index into the model's facets, stable across frames. */
  index: number;
  unit: number;
  /** The facet in the view, y down as in SVG. */
  points: readonly (readonly [number, number])[];
  /** How directly it faces the viewer, 0 → 1: for shading. */
  light: number;
  /** 0 → 1 as its unit arrives. */
  presence: number;
}

/**
 * The star at assembly a and Inspect e, seen in the shared view (orthographic): facets turned away
 * or not yet arrived are dropped, the rest come back far to near, so drawing them in order paints
 * the near ones on top. The build draws the first frame with it, the SVG renderer every frame.
 */
export function drawStar({ model, directions, rank }: Star, a: number, e: number): DrawnFacet[] {
  return model.facets
    .map((f, index) => {
      const d = directions[f.unit]!;
      const r = rank[f.unit]!;
      const o = unitOffset(r, a, e);
      const pts = f.points.map((p) => toView([p[0] + d[0] * o, p[1] + d[1] * o, p[2] + d[2] * o]));
      const u = [pts[1]![0] - pts[0]![0], pts[1]![1] - pts[0]![1], pts[1]![2] - pts[0]![2]];
      const v = [pts[2]![0] - pts[0]![0], pts[2]![1] - pts[0]![1], pts[2]![2] - pts[0]![2]];
      const nz = u[0]! * v[1]! - u[1]! * v[0]!;
      const nl = Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, nz);
      const depth = (pts[0]![2] + pts[1]![2] + pts[2]![2]) / 3;
      return { index, unit: f.unit, pts, light: nz / nl, depth, presence: arrived(r, a) };
    })
    .filter((f) => f.light > 1e-9 && f.presence > 0)
    .sort((p, q) => p.depth - q.depth)
    .map(({ index, unit, pts, light, presence }) => ({
      index,
      unit,
      points: pts.map(([x, y]) => [x, -y] as const),
      light,
      presence,
    }));
}
