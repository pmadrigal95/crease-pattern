/**
 * Which figure each identity shows, and the figures drawn flat for SVG (the marks, the hero, the
 * social cards). Built when the site is built, from the same geometry the 3D scene folds, so the
 * flat drawings and the scene can never disagree.
 *
 * - Washi & asagi: the crane. Basalt & glacier: the arctic fox.
 * - Contour lines: the blue morpho by day (light theme), the red-eyed tree frog by night (dark
 *   theme): the morpho flies by day, the frog only comes out after dark.
 */
import { Matrix4, Vector3 } from 'three';
import type { VisualDirection } from '../../config/visual-direction';
import { creases, faceNormal, foldMatrices, posed } from './hinge';
import { models, type ModelId, type Tag } from './models';

export function modelFor(direction: VisualDirection, dark: boolean): ModelId {
  if (direction === 'washi-asagi') return 'crane';
  if (direction === 'basalt-glacier') return 'fox';
  return dark ? 'frog' : 'morpho';
}

/** A facet's colour role in SVG: its tag, or for paper, how much light it catches. */
export type Role = Exclude<Tag, 'paper'> | 'light' | 'mid' | 'shade' | 'deep';

/**
 * How much of the identity's accent each paper role mixes over the surface. src/styles/origami.css
 * says the same in color-mix(), and the 3D scene and the social cards read it from here.
 */
export const ROLE_MIX = { light: 0.1, mid: 0.26, shade: 0.46, deep: 0.68 } as const;
/** The edge role: the accent this far toward ink. */
export const EDGE_MIX = 0.55;
/** The frog's eyes are red: it's in its name. */
export const FROG_EYE = '#c4402f';

/** A facet's role: its tag, or for paper, how much light it catches when folded. */
export function facetRole(id: ModelId, i: number): Role {
  const { fold, tags } = models[id];
  const tag = tags[i]!;
  if (tag !== 'paper') return tag;
  const lit = Math.abs(faceNormal(fold.points, fold.faces[i]!).dot(LIGHT));
  return lit > 0.8 ? 'light' : lit > 0.55 ? 'mid' : lit > 0.3 ? 'shade' : 'deep';
}

export const VIEWBOX = '0 0 48 48';
const SIZE = 48;
const MARGIN = 2.5;
/** Light from the top right, toward the viewer (the 3D scene's key light). */
export const LIGHT = new Vector3(0.45, 0.75, 0.5).normalize();

/** Each figure's best three-quarter view: yaw and pitch, in radians. */
const VIEWS: Record<ModelId, { yaw: number; pitch: number }> = {
  crane: { yaw: -0.65, pitch: 0.22 },
  morpho: { yaw: -0.5, pitch: 0.85 },
  frog: { yaw: -0.55, pitch: 0.42 },
  fox: { yaw: -0.55, pitch: 0.12 },
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const path = (pts: readonly (readonly [number, number])[]) =>
  `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}z`;

/** Fits 2D points into the 48 × 48 view box, centred, y down. */
function fit(points: readonly (readonly [number, number])[]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = (SIZE - 2 * MARGIN) / Math.max(maxX - minX, maxY - minY);
  const ox = (SIZE - (maxX - minX) * scale) / 2;
  const oy = (SIZE - (maxY - minY) * scale) / 2;
  return ([x, y]: readonly [number, number]): [number, number] => [
    ox + (x - minX) * scale,
    oy + (maxY - y) * scale,
  ];
}

export interface FoldedMark {
  /** Back to front, so later facets cover earlier ones. */
  facets: { d: string; role: Role }[];
}

/** The folded figure, seen in three-quarters: what the masthead, the footer and the hero show. */
export function foldedMark(id: ModelId): FoldedMark {
  const { fold } = models[id];
  const { yaw, pitch } = VIEWS[id];
  const view = new Matrix4().makeRotationX(pitch).multiply(new Matrix4().makeRotationY(yaw));
  const seen = fold.points.map((p) => p.clone().applyMatrix4(view));
  const toBox = fit(seen.map((p) => [p.x, p.y] as const));
  const facets = fold.faces.map((f, i) => {
    const corners = f.map((v) => seen[v]!);
    const depth = corners.reduce((sum, p) => sum + p.z, 0) / 3;
    return { d: path(corners.map((p) => toBox([p.x, p.y]))), role: facetRole(id, i), depth };
  });
  facets.sort((a, b) => a.depth - b.depth);
  return { facets: facets.map(({ d, role }) => ({ d, role })) };
}

export interface FlatMark {
  /** The sheet laid open, seen from above. */
  facets: string[];
  mountain: string;
  valley: string;
}

/** The figure unfolded: its crease pattern, mountain folds and valley folds apart. */
export function flatMark(id: ModelId): FlatMark {
  const { fold } = models[id];
  const M = foldMatrices(fold, 1, 0);
  const tris = fold.faces.map((_, i) => posed(fold, M, i));
  const toBox = fit(tris.flat().map((p) => [p.x, -p.z] as const));
  const at = (p: Vector3) => toBox([p.x, -p.z]);
  const lines = creases(fold, M);
  const segs = (kind: 'mountain' | 'valley') =>
    lines
      .filter((l) => l.kind === kind)
      .map(({ a, b }) => {
        const [p, q] = [at(a), at(b)];
        return `M${r2(p[0])} ${r2(p[1])}L${r2(q[0])} ${r2(q[1])}`;
      })
      .join('');
  return { facets: tris.map((t) => path(t.map(at))), mountain: segs('mountain'), valley: segs('valley') };
}
