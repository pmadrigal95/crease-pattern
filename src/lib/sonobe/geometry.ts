/**
 * Sonobe modular origami as geometry, for Crease No. 003 (components as modular origami).
 *
 * A Sonobe unit is a square of paper folded into a parallelogram: a square face in the middle and a
 * triangular tab at each end; the folded edges of the face are its pockets. Units join tab into
 * pocket. Assembled, the classic models are:
 *
 * - **6 units, cube:** one unit per face of a cube.
 * - **12 units** (an octahedron with a pyramid on each face) and **30 units** (the same on an
 *   icosahedron): one unit per edge of the base solid. Each pyramid's sides are right isosceles
 *   triangles, the 90° corner the unit's folds make, so a pyramid on a face of side s rises
 *   s/√6. A unit covers the two pyramid sides that meet over its edge.
 *
 * Pure functions, no DOM: the demos draw the result as SVG, and the tests check it.
 */

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

/** One flat piece of a model: a polygon in 3D and the unit it belongs to. */
export interface Facet {
  unit: number;
  points: readonly Vec3[];
}

export interface Assembly {
  units: number;
  facets: readonly Facet[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
const centroid = (points: readonly Vec3[]): Vec3 =>
  scale(
    points.reduce<Vec3>((s, p) => add(s, p), [0, 0, 0]),
    1 / points.length,
  );

/** A solid made of triangles, edge length 1, centred on the origin, faces wound outward. */
interface Deltahedron {
  vertices: readonly Vec3[];
  faces: readonly (readonly [number, number, number])[];
}

/** Scales to edge length 1 and winds every face outward (counter-clockwise seen from outside). */
function normalize(
  vertices: readonly Vec3[],
  faces: readonly (readonly [number, number, number])[],
): Deltahedron {
  const [a, b] = faces[0]!;
  const k = 1 / length(sub(vertices[a]!, vertices[b]!));
  const v = vertices.map((p) => scale(p, k));
  return {
    vertices: v,
    faces: faces.map(([i, j, l]) => {
      const n = cross(sub(v[j]!, v[i]!), sub(v[l]!, v[i]!));
      return dot(n, centroid([v[i]!, v[j]!, v[l]!])) > 0 ? ([i, j, l] as const) : ([i, l, j] as const);
    }),
  };
}

function octahedron(): Deltahedron {
  const v: Vec3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const faces: [number, number, number][] = [];
  for (const x of [0, 1]) for (const y of [2, 3]) for (const z of [4, 5]) faces.push([x, y, z]);
  return normalize(v, faces);
}

function icosahedron(): Deltahedron {
  const p = (1 + Math.sqrt(5)) / 2;
  const v: Vec3[] = [
    [-1, p, 0],
    [1, p, 0],
    [-1, -p, 0],
    [1, -p, 0],
    [0, -1, p],
    [0, 1, p],
    [0, -1, -p],
    [0, 1, -p],
    [p, 0, -1],
    [p, 0, 1],
    [-p, 0, -1],
    [-p, 0, 1],
  ];
  // Faces are the triples of vertices that are pairwise one edge (length 2) apart.
  const edge = (i: number, j: number) => Math.abs(length(sub(v[i]!, v[j]!)) - 2) < 1e-9;
  const faces: [number, number, number][] = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let l = j + 1; l < 12; l++) if (edge(i, j) && edge(j, l) && edge(i, l)) faces.push([i, j, l]);
  return normalize(v, faces);
}

/** Height of a Sonobe pyramid on an equilateral face of side 1: its sides meet at 90°. */
export const PYRAMID_HEIGHT = 1 / Math.sqrt(6);

/** One unit per edge of the base solid, each covering the two pyramid sides over that edge. */
function stellate(base: Deltahedron): Assembly {
  const { vertices: v, faces } = base;
  const apex = faces.map((f) => {
    const pts = f.map((i) => v[i]!);
    const c = centroid(pts);
    const n = cross(sub(pts[1]!, pts[0]!), sub(pts[2]!, pts[0]!));
    return add(c, scale(n, PYRAMID_HEIGHT / length(n)));
  });
  /** Edge "i-j" (i < j) → the faces on each side and that face's winding of the edge. */
  const edges = new Map<string, { face: number; from: number; to: number }[]>();
  faces.forEach((f, face) => {
    for (let k = 0; k < 3; k++) {
      const from = f[k]!;
      const to = f[(k + 1) % 3]!;
      const key = from < to ? `${from}-${to}` : `${to}-${from}`;
      edges.set(key, [...(edges.get(key) ?? []), { face, from, to }]);
    }
  });
  const facets: Facet[] = [];
  [...edges.values()].forEach((sides, unit) => {
    // Keep each face's outward winding, so a facet's normal points out of the model.
    for (const { face, from, to } of sides) facets.push({ unit, points: [v[from]!, v[to]!, apex[face]!] });
  });
  return { units: edges.size, facets };
}

/** The 6-unit cube: each unit's square face is one face of the cube (edge 1). */
function cube(): Assembly {
  const h = 0.5;
  const faces: Vec3[][] = [
    [
      [h, -h, -h],
      [h, h, -h],
      [h, h, h],
      [h, -h, h],
    ],
    [
      [-h, -h, -h],
      [-h, -h, h],
      [-h, h, h],
      [-h, h, -h],
    ],
    [
      [-h, h, -h],
      [-h, h, h],
      [h, h, h],
      [h, h, -h],
    ],
    [
      [-h, -h, -h],
      [h, -h, -h],
      [h, -h, h],
      [-h, -h, h],
    ],
    [
      [-h, -h, h],
      [h, -h, h],
      [h, h, h],
      [-h, h, h],
    ],
    [
      [-h, -h, -h],
      [-h, h, -h],
      [h, h, -h],
      [h, -h, -h],
    ],
  ];
  return { units: 6, facets: faces.map((points, unit) => ({ unit, points })) };
}

/** The models the essay builds, by how many units they take. */
export const ASSEMBLIES = {
  6: cube,
  12: () => stellate(octahedron()),
  30: () => stellate(icosahedron()),
} as const;
export type UnitCount = keyof typeof ASSEMBLIES;

export const assembly = (units: UnitCount): Assembly => ASSEMBLIES[units]();

/** Outward normal of a facet (unit length). */
export function normal(points: readonly Vec3[]): Vec3 {
  const n = cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!));
  return scale(n, 1 / length(n));
}

/**
 * The same model with one unit pushed `distance` out along each of its facets' normals: a unit
 * that no longer sits where the others expect it, so the model doesn't close (act 5).
 */
export function displace(model: Assembly, unit: number, distance: number): Assembly {
  return {
    units: model.units,
    facets: model.facets.map((f) => {
      if (f.unit !== unit) return f;
      const offset = scale(normal(f.points), distance);
      return { unit: f.unit, points: f.points.map((p) => add(p, offset)) };
    }),
  };
}

export interface Projected {
  unit: number;
  points: readonly Vec2[];
  /** How directly the facet faces the viewer, 0 to 1: for shading. */
  light: number;
}

/**
 * Turns a model by `yaw` then `pitch` (radians) and draws it seen from the front (orthographic):
 * facets turned away are dropped, the rest come back far to near, so drawing them in order
 * paints the near ones on top. y points down, as in SVG.
 */
export function project(model: Assembly, yaw: number, pitch: number): Projected[] {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  const turn = ([x, y, z]: Vec3): Vec3 => {
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  return model.facets
    .map((f) => {
      const pts = f.points.map(turn);
      return { unit: f.unit, pts, n: normal(pts), depth: centroid(pts)[2] };
    })
    .filter((f) => f.n[2] > 1e-9)
    .sort((a, b) => a.depth - b.depth)
    .map((f) => ({ unit: f.unit, points: f.pts.map(([x, y]) => [x, -y] as const), light: f.n[2] }));
}

/**
 * The flat unit, as the essay draws it: a parallelogram one high, with the square face in the
 * middle and a triangular tab at each end. The face's top and bottom edges are the pockets.
 */
export const FLAT_UNIT = {
  tabs: [
    [
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    [
      [2, 1],
      [3, 0],
      [2, 0],
    ],
  ] as const satisfies readonly (readonly Vec2[])[],
  face: [
    [1, 1],
    [2, 1],
    [2, 0],
    [1, 0],
  ] as const satisfies readonly Vec2[],
  pockets: [
    [
      [1, 0],
      [2, 0],
    ],
    [
      [1, 1],
      [2, 1],
    ],
  ] as const satisfies readonly (readonly Vec2[])[],
};
