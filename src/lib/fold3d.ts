/**
 * The math of M4's 3D fox (decided in the demo derby, 21-m4-plan.md): pure functions, no three.js,
 * so the scene, the readouts and the tests all read the same numbers (the teardown rule: one input,
 * one source).
 *
 * - `pose(p)`: one input p, 0 a flat sheet → 1 the folded fox. Each fold has its own window inside
 *   p, in order: the centre valley fold, then the brow, then the inner ears. Unfolding (p going
 *   back) reverses the order by itself.
 * - `inspectPhases(q)`: one input q, 0 at rest → 1 inspecting. The fox's layers part first, then
 *   the identity scene rises, then its details trace in (motion B, "orchestrated").
 */

/** The folded fox's angles, in degrees. */
export const FOLD_DEGREES = { head: 36, ear: 30, inner: 16 } as const;
export type Fold = keyof typeof FOLD_DEGREES;
export const FOLD_ORDER: readonly Fold[] = ['head', 'ear', 'inner'];

/** Each fold's window inside p: 0.747 long, 0.126 apart (710 ms each, 120 ms apart over 950 ms). */
export const FOLD_WINDOWS: Record<Fold, readonly [number, number]> = {
  head: [0, 0.747],
  ear: [0.126, 0.874],
  inner: [0.253, 1],
};

/** Inspect's phases inside q: layers, then the scene, then its details. */
export const INSPECT_WINDOWS = {
  layers: [0, 0.35],
  rise: [0.15, 0.75],
  detail: [0.6, 1],
} as const;
export type InspectPhase = keyof typeof INSPECT_WINDOWS;

/** How long q takes to run in each direction: leaving is quicker than arriving. */
export const INSPECT_MS = { enter: 1600, exit: 420 } as const;

/** Separated layers, back to front, along the fox's own depth axis (in sheet widths ÷ 48 × 2). */
export const LAYER_DEPTH: Record<Fold, number> = { ear: -0.24, inner: -0.1, head: 0.14 };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A cubic-bezier easing, solved by bisection (enough precision for animation). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
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
}
/** State to state (each fold). */
export const stateToState = cubicBezier(0.65, 0, 0.35, 1);
/** Entering and leaving (Inspect's phases). */
export const easeOut = cubicBezier(0.23, 1, 0.32, 1);

const progress = ([a, b]: readonly [number, number], x: number) => clamp01((x - a) / (b - a));

export interface FoldState {
  amount: number;
  degrees: number;
  /** 0 → 1 → 0 across the fold's window: how much this fold is the one working right now. */
  working: number;
}
export interface Pose {
  folds: Record<Fold, FoldState>;
  /** The fold most in motion, if any. */
  lead: Fold | null;
  /** 0 flat → 1 folded, averaged over the three folds. */
  folded: number;
}

export function pose(p: number): Pose {
  const folds = {} as Record<Fold, FoldState>;
  for (const fold of FOLD_ORDER) {
    const k = progress(FOLD_WINDOWS[fold], p);
    const amount = stateToState(k);
    folds[fold] = {
      amount,
      degrees: FOLD_DEGREES[fold] * amount,
      working: k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0,
    };
  }
  let lead: Fold | null = null;
  for (const fold of FOLD_ORDER) if (folds[fold].working > (lead ? folds[lead].working : 0.05)) lead = fold;
  const folded = FOLD_ORDER.reduce((sum, fold) => sum + folds[fold].amount, 0) / FOLD_ORDER.length;
  return { folds, lead, folded };
}

export interface InspectState {
  /** Eased: what the shapes use. */
  eased: Record<InspectPhase, number>;
  /** Linear: what travelling fronts use, so they cross their whole window. */
  linear: Record<InspectPhase, number>;
}

export function inspectPhases(q: number): InspectState {
  const eased = {} as Record<InspectPhase, number>;
  const linear = {} as Record<InspectPhase, number>;
  for (const phase of Object.keys(INSPECT_WINDOWS) as InspectPhase[]) {
    linear[phase] = progress(INSPECT_WINDOWS[phase], q);
    eased[phase] = easeOut(linear[phase]);
  }
  return { eased, linear };
}
