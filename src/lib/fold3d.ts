/**
 * The motion maths the 3D scenes share (decided in the M4 demo derby, 21-m4-plan.md): pure
 * functions, no three.js, so scenes and tests read the same numbers (the teardown rule).
 *
 * - `inspectPhases(q)`: one input q, 0 at rest → 1 inspecting. The figure comes apart first, then
 *   the identity scene rises, then its details trace in (motion B, "orchestrated").
 * - The easings every fold and phase uses.
 *
 * The figures' own folding lives in src/lib/origami/hinge.ts.
 */

/** Inspect's phases inside q: layers, then the scene, then its details. */
export const INSPECT_WINDOWS = {
  layers: [0, 0.35],
  rise: [0.15, 0.75],
  detail: [0.6, 1],
} as const;
export type InspectPhase = keyof typeof INSPECT_WINDOWS;

/** How long q takes to run in each direction: leaving is quicker than arriving. */
export const INSPECT_MS = { enter: 1600, exit: 420 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A cubic-bezier easing, solved by bisection (enough precision for animation). */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): ((x: number) => number) => {
  const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
  const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
  return (x) => {
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
};
/** State to state (each fold). */
export const stateToState = cubicBezier(0.65, 0, 0.35, 1);
/** Entering and leaving (Inspect's phases). */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

const progress = ([a, b]: readonly [number, number], x: number) => clamp01((x - a) / (b - a));

export interface InspectState {
  /** Eased: what the shapes use. */
  eased: Record<InspectPhase, number>;
  /** Linear: what travelling fronts use, so they cross their whole window. */
  linear: Record<InspectPhase, number>;
}

export const inspectPhases = (q: number): InspectState => {
  const eased = {} as Record<InspectPhase, number>;
  const linear = {} as Record<InspectPhase, number>;
  for (const phase of Object.keys(INSPECT_WINDOWS) as InspectPhase[]) {
    linear[phase] = progress(INSPECT_WINDOWS[phase], q);
    eased[phase] = easeOut(linear[phase]);
  }
  return { eased, linear };
};
