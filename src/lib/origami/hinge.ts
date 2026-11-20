/**
 * Hinge folding: how every origami figure on the site folds and unfolds (the marks, the hero, the
 * 3D scene). A figure is one connected sheet of triangular facets that share corners. A spanning
 * tree over the shared edges decides which facet hangs from which, and on which edge (its hinge).
 * Unfolding turns each facet about its hinge until it lies in its parent's plane, tips first; the
 * root lies down on the floor last. Every facet moves rigidly, so no edge ever changes length, and
 * the flat state is the figure's real crease pattern: each hinge a mountain or a valley fold.
 *
 * One input, `u` from 0 (folded) to 1 (flat), poses everything (the teardown rule). three.js only
 * for its math, so pages, the build and the tests read the same numbers as the scene.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';

export type Point = readonly [number, number, number];
export type Face = readonly [number, number, number];

export interface Fold {
  readonly points: readonly Vector3[];
  /** Faces, rewound so every child runs its hinge the other way from its parent. */
  readonly faces: readonly Face[];
  /** Each face's parent in the tree; -1 for the root. */
  readonly parent: readonly number[];
  /** The two corners each face turns about, as its parent runs them; null for the root. */
  readonly hinge: readonly (readonly [number, number] | null)[];
  /** Steps from the root. */
  readonly depth: readonly number[];
  /** The signed turn, in radians, that lays each face into its parent's plane. */
  readonly turn: readonly number[];
  /** Faces in tree order: every parent before its children. */
  readonly order: readonly number[];
  readonly maxDepth: number;
  readonly rootNormal: Vector3;
  readonly rootCentre: Vector3;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const edgesOf = (f: Face): [number, number][] => [
  [f[0], f[1]],
  [f[1], f[2]],
  [f[2], f[0]],
];
const runs = (f: Face, a: number, b: number) => edgesOf(f).some(([p, q]) => p === a && q === b);

/** The unit normal of a face, from its winding. */
export const faceNormal = (points: readonly Vector3[], f: Face): Vector3 => {
  const [a, b, c] = [points[f[0]]!, points[f[1]]!, points[f[2]]!];
  return b.clone().sub(a).cross(c.clone().sub(a)).normalize();
};

/** Builds the fold tree of a sheet; throws if any facet isn't joined to the rest. */
export const buildFold = (points: readonly Point[], faces: readonly Face[], root = 0): Fold => {
  const V = points.map((p) => new Vector3(...p));
  const F: Face[] = faces.map((f) => [f[0], f[1], f[2]]);
  const byEdge = new Map<string, number[]>();
  F.forEach((f, i) => {
    for (const [a, b] of edgesOf(f)) byEdge.set(edgeKey(a, b), [...(byEdge.get(edgeKey(a, b)) ?? []), i]);
  });
  const parent = F.map(() => -1);
  const hinge: ([number, number] | null)[] = F.map(() => null);
  const depth = F.map(() => 0);
  const seen = new Set([root]);
  const order = [root];
  for (let k = 0; k < order.length; k++) {
    const i = order[k]!;
    for (const [a, b] of edgesOf(F[i]!)) {
      for (const j of byEdge.get(edgeKey(a, b)) ?? []) {
        if (seen.has(j)) continue;
        const f = F[j]!;
        if (runs(f, a, b)) F[j] = [f[0], f[2], f[1]];
        seen.add(j);
        parent[j] = i;
        hinge[j] = [a, b];
        depth[j] = depth[i]! + 1;
        order.push(j);
      }
    }
  }
  if (seen.size !== F.length)
    throw new Error(`The sheet isn't connected: ${F.length - seen.size} facets float free`);
  const turn = F.map((f, j) => {
    const h = hinge[j];
    if (!h) return 0;
    const axis = V[h[1]]!.clone().sub(V[h[0]]!).normalize();
    const own = faceNormal(V, f);
    const theirs = faceNormal(V, F[parent[j]!]!);
    return Math.atan2(axis.dot(own.clone().cross(theirs)), own.dot(theirs));
  });
  const r = F[root]!;
  return {
    points: V,
    faces: F,
    parent,
    hinge,
    depth,
    turn,
    order,
    maxDepth: Math.max(...depth),
    rootNormal: faceNormal(V, r),
    rootCentre: V[r[0]]!.clone().add(V[r[1]]!).add(V[r[2]]!).divideScalar(3),
  };
};

const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * How far a facet at `depth` has turned at unfold amount `u`: the tips open in the first quarter of
 * the timeline, each layer closer to the root a little later, the root lies down at the end.
 */
export const share = (fold: Fold, depth: number, u: number): number => {
  const slot = (fold.maxDepth - depth) / (fold.maxDepth + 1);
  return easeInOut(clamp01((u - slot * 0.75) / 0.25 / (1 + 0.75 / (fold.maxDepth + 1))));
};

/** Every facet's matrix at unfold amount `u`; flat, the sheet lies centred on the floor at `floorY`. */
export const foldMatrices = (fold: Fold, u: number, floorY: number): Matrix4[] => {
  const M = fold.faces.map(() => new Matrix4());
  const lay = share(fold, 0, u);
  const toFloor = new Quaternion().setFromUnitVectors(fold.rootNormal, new Vector3(0, 1, 0));
  const turned = new Quaternion().slerp(toFloor, lay);
  const at = fold.rootCentre.clone().lerp(new Vector3(0, floorY, 0), lay);
  const c = fold.rootCentre;
  M[fold.order[0]!]!.compose(at, turned, new Vector3(1, 1, 1)).multiply(
    new Matrix4().makeTranslation(-c.x, -c.y, -c.z),
  );
  for (const j of fold.order.slice(1)) {
    const [a, b] = fold.hinge[j]!;
    const A = fold.points[a]!;
    const axis = fold.points[b]!.clone().sub(A).normalize();
    const local = new Matrix4()
      .makeTranslation(A.x, A.y, A.z)
      .multiply(new Matrix4().makeRotationAxis(axis, fold.turn[j]! * share(fold, fold.depth[j]!, u)))
      .multiply(new Matrix4().makeTranslation(-A.x, -A.y, -A.z));
    M[j]!.multiplyMatrices(M[fold.parent[j]!]!, local);
  }
  return M;
};

/** A facet's three corners at a pose. */
export const posed = (fold: Fold, M: readonly Matrix4[], i: number): [Vector3, Vector3, Vector3] => {
  const [a, b, c] = fold.faces[i]!;
  return [a, b, c].map((v) => fold.points[v]!.clone().applyMatrix4(M[i]!)) as [Vector3, Vector3, Vector3];
};

/** Each hinge at a pose, as a mountain or a valley fold. */
export const creases = (
  fold: Fold,
  M: readonly Matrix4[],
): { kind: 'mountain' | 'valley'; a: Vector3; b: Vector3 }[] => {
  return fold.order.slice(1).map((j) => {
    const [a, b] = fold.hinge[j]!;
    return {
      kind: fold.turn[j]! > 0 ? 'mountain' : 'valley',
      a: fold.points[a]!.clone().applyMatrix4(M[j]!),
      b: fold.points[b]!.clone().applyMatrix4(M[j]!),
    };
  });
};
