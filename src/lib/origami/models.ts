/**
 * The four origami figures, one per identity (and two for Contour lines: day and night). Each is
 * one connected sheet, written as named points and triangular faces for its left half and
 * mirrored across z = 0; points on that plane belong to both halves and join them.
 *
 * Coordinates: y up, facing +x, the floor at y = -1.2, about 2.6 units across.
 * Tags pick a facet's colour role (src/lib/origami/svg.ts and the 3D scene):
 * - `accent`: the one meaningful colour (the crane's beak, the frog's eyes, the fox's ears);
 * - `wing`: the morpho's structural blue, iridescent in 3D;
 * - `edge`: the dark margin of the morpho's wings, and its body;
 * - none: paper, shaded by the light.
 */
import { buildFold, type Face, type Fold, type Point } from './hinge';

export type Tag = 'accent' | 'wing' | 'edge' | 'paper';
export type ModelId = 'crane' | 'morpho' | 'frog' | 'fox';

export interface Model {
  readonly id: ModelId;
  readonly points: readonly Point[];
  readonly faces: readonly Face[];
  readonly tags: readonly Tag[];
  readonly fold: Fold;
}

type FaceSpec = readonly [string, string, string, Tag?];

const model = (id: ModelId, points: Record<string, Point>, faces: readonly FaceSpec[]): Model => {
  const all: Record<string, Point> = { ...points };
  for (const [name, [x, y, z]] of Object.entries(points))
    if (Math.abs(z) > 1e-9) all[`${name}'`] = [x, y, -z];
  const names = Object.keys(all);
  const index = new Map(names.map((n, i) => [n, i]));
  const at = (n: string) => {
    const i = index.get(n);
    if (i === undefined) throw new Error(`${id}: no point "${n}"`);
    return i;
  };
  const mirror = (n: string) => (all[`${n}'`] ? `${n}'` : n);
  const out: Face[] = [];
  const tags: Tag[] = [];
  for (const [a, b, c, tag = 'paper'] of faces) {
    out.push([at(a), at(b), at(c)]);
    tags.push(tag);
    const [ma, mb, mc] = [mirror(a), mirror(b), mirror(c)];
    if (`${ma}${mb}${mc}` !== `${a}${b}${c}`) {
      out.push([at(ma), at(mc), at(mb)]);
      tags.push(tag);
    }
  }
  const pts = names.map((n) => all[n]!);
  return { id, points: pts, faces: out, tags, fold: buildFold(pts, out, 0) };
};

/** Washi & asagi: the crane, the most iconic origami, in its place of origin. */
const crane = model(
  'crane',
  {
    front: [0.5, 0, 0],
    rear: [-0.5, 0, 0],
    ridge: [0, 0.42, 0],
    keel: [0, -0.5, 0],
    side: [0, 0.02, 0.3],
    wing: [-0.05, 1.42, 1.38],
    neck: [1.06, 0.92, 0.01],
    crown: [1.2, 1.16, 0],
    beak: [1.56, 0.86, 0.01],
    tail: [-1.32, 1.1, 0],
  },
  [
    ['front', 'ridge', 'side'],
    ['ridge', 'rear', 'side'],
    ['rear', 'keel', 'side'],
    ['keel', 'front', 'side'],
    ['front', 'ridge', 'wing'],
    ['ridge', 'rear', 'wing'],
    ['front', 'keel', 'neck'],
    ['front', 'neck', 'crown'],
    ['neck', 'beak', 'crown', 'accent'],
    ['rear', 'tail', 'keel'],
    ['ridge', 'tail', 'rear'],
  ],
);

/** Contour lines by day: the blue morpho, wings laid out from above and raised in a shallow V. */
const Y = -0.15;
const wing = (x: number, z: number): Point => [x, Y + 0.3 * z, z];
const morpho = model(
  'morpho',
  {
    head: [0.62, Y + 0.02, 0],
    thorax: [0.16, Y, 0],
    tail: [-0.74, Y - 0.06, 0],
    belly: [-0.02, Y - 0.14, 0.07],
    lead: wing(0.6, 0.62),
    apexIn: wing(0.62, 1.36),
    apex: wing(0.8, 1.58),
    outerIn: wing(0.24, 1.6),
    outer: wing(0.28, 1.86),
    back: wing(-0.04, 1.05),
    notch: wing(-0.02, 0.52),
    h1: wing(-0.3, 1.5),
    h1o: wing(-0.52, 1.66),
    h2: wing(-0.84, 1.34),
    h2o: wing(-1.08, 1.1),
    h3: wing(-1.0, 0.78),
  },
  [
    ['head', 'thorax', 'belly', 'edge'],
    ['thorax', 'tail', 'belly', 'edge'],
    ['thorax', 'head', 'lead', 'wing'],
    ['thorax', 'lead', 'apexIn', 'wing'],
    ['thorax', 'apexIn', 'outerIn', 'wing'],
    ['thorax', 'outerIn', 'back', 'wing'],
    ['thorax', 'back', 'notch', 'wing'],
    ['lead', 'apex', 'apexIn', 'edge'],
    ['apexIn', 'apex', 'outer', 'edge'],
    ['apexIn', 'outer', 'outerIn', 'edge'],
    ['outerIn', 'outer', 'back', 'edge'],
    ['thorax', 'notch', 'h1', 'wing'],
    ['thorax', 'h1', 'h2', 'wing'],
    ['thorax', 'h2', 'h3', 'wing'],
    ['thorax', 'h3', 'tail', 'wing'],
    ['h1', 'h1o', 'h2', 'edge'],
    ['h2', 'h2o', 'h3', 'edge'],
  ],
);

/** Contour lines by night: the red-eyed tree frog, as the jumping frog. */
const frog = model(
  'frog',
  {
    nose: [1.4, -0.98, 0],
    head: [0.72, -0.55, 0],
    back: [-0.55, -0.5, 0],
    rear: [-1.25, -0.98, 0],
    brow: [0.95, -0.7, 0.2],
    eye: [0.74, -0.36, 0.3],
    shoulder: [0.42, -1.02, 0.62],
    hip: [-0.72, -1.02, 0.78],
    wrist: [0.8, -1.17, 0.78],
    hand: [1.42, -1.17, 1.06],
    knee: [-0.1, -0.72, 1.08],
    heel: [-1.02, -1.16, 1.28],
    toe: [0.42, -1.17, 1.32],
  },
  [
    ['head', 'back', 'shoulder'],
    ['nose', 'brow', 'shoulder'],
    ['brow', 'head', 'shoulder'],
    ['brow', 'head', 'eye', 'accent'],
    ['back', 'hip', 'shoulder'],
    ['back', 'rear', 'hip'],
    ['nose', 'shoulder', 'wrist'],
    ['nose', 'wrist', 'hand'],
    ['hip', 'shoulder', 'knee'],
    ['hip', 'knee', 'heel'],
    ['knee', 'toe', 'heel'],
  ],
);

/** Basalt & glacier: the arctic fox, sitting, its tail curled around its feet. */
const fox = model(
  'fox',
  {
    neck: [0.18, 0.28, 0],
    back: [-0.42, -0.05, 0],
    chest: [0.42, -0.4, 0],
    haunch: [-0.62, -1.15, 0.34],
    paw: [0.32, -1.15, 0.22],
    nape: [0.02, 0.62, 0],
    snout: [1.08, 0.38, 0],
    jaw: [0.42, 0.18, 0],
    cheek: [0.32, 0.52, 0.24],
    ear: [-0.1, 1.2, 0.2],
    tailRoot: [-0.62, -0.75, 0],
    tailMid: [-0.88, -1.12, 0.58],
    tailTip: [0.55, -1.15, 0.62],
  },
  [
    ['neck', 'back', 'haunch'],
    ['neck', 'haunch', 'paw'],
    ['neck', 'paw', 'chest'],
    ['neck', 'jaw', 'chest'],
    ['neck', 'cheek', 'jaw'],
    ['neck', 'nape', 'cheek'],
    ['cheek', 'snout', 'nape'],
    ['cheek', 'jaw', 'snout'],
    ['nape', 'cheek', 'ear', 'accent'],
    ['back', 'tailRoot', 'haunch'],
    ['tailRoot', 'tailMid', 'haunch'],
    ['haunch', 'tailMid', 'tailTip'],
  ],
);

export const models: Record<ModelId, Model> = { crane, morpho, frog, fox };
export const MODEL_IDS = Object.keys(models) as ModelId[];
