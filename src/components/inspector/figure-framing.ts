/**
 * Where the 3D figure stands and how it is turned, frame by frame (scene3d.ts draws it):
 *
 * - In the hero it rests at its SVG's own view (src/lib/origami/marks.ts, VIEWS) and fills the
 *   square as the SVG does, so the SVG hands over to it unchanged; unfolding, it turns toward the
 *   view from above, as the SVG draws the crease pattern; the visitor's drag turns it on top.
 * - Inspecting, it moves into Inspect's fixed 3/4 view in front of its identity's scene, as it has
 *   been since M4.
 *
 * Pure placement: no rendering, no DOM beyond the canvas mask.
 */
import { Euler, Quaternion, Vector3, type Group } from 'three';
import { inspectPhases } from '../../lib/fold3d';
import { LIGHT, VIEWS } from '../../lib/origami/marks';
import type { ModelId } from '../../lib/origami/models';
import type { FoldControl, Orbit } from './hero-motion';
import type { Figure } from './origami-figure3d';

/** The camera looks slightly down on the figure, with the scene behind and below it. */
export const CAMERA = { fov: 32, y: 0.25, z: 5.2, lookY: -0.25 } as const;
/**
 * Where the figure stands in the hero, in world units at its depth: its size (the larger of its
 * width and height on screen) and its centre, so it fills the square as the SVG does.
 */
const HERO = { size: 1.95, y: -0.19 } as const;
/** Inspecting: smaller, in a 3/4 view, in front of its identity's scene. */
const INSPECT = { scale: 0.55, y: 0.2, yaw: -0.55, pitch: 0.12 } as const;
/** The camera looks down a little; the figure's pitch gives that back, to rest at the SVG's view. */
const TILT = Math.atan2(CAMERA.y - CAMERA.lookY, CAMERA.z);

/** The hero framing carried between frames, eased toward each frame's target. */
export interface Framed {
  scale: number;
  x: number;
  y: number;
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (x: number) => x * x * (3 - 2 * x);

const rests = new Map<ModelId, { pitch: number; yaw: number; light: Vector3 }>();
/** The figure's resting view, and the SVG's light seen from there (it stays put as the figure turns). */
const restOf = (id: ModelId) => {
  const known = rests.get(id);
  if (known) return known;
  const { pitch, yaw } = VIEWS[id];
  const rest = new Quaternion().setFromEuler(new Euler(pitch - TILT, yaw, 0));
  const view = { pitch: pitch - TILT, yaw, light: LIGHT.clone().applyQuaternion(rest) };
  rests.set(id, view);
  return view;
};

/**
 * The hero's view of the figure: at rest, the SVG's own; as it unfolds (u), toward the view from
 * above; plus the visitor's drag, which fades out as it opens. Also the light in the figure's frame
 * at that view, for its tones.
 */
const heroView = (id: ModelId, u: number, turn: { yaw: number; pitch: number }) => {
  const rest = restOf(id);
  const e = smooth(Math.min(1, Math.max(0, u)));
  const euler = new Euler(
    mix(rest.pitch, Math.PI / 2 - TILT, e) + turn.pitch * (1 - e),
    mix(rest.yaw, 0, e) + turn.yaw * (1 - e),
    0,
  );
  const turned = new Quaternion().setFromEuler(euler);
  return { euler, turned, light: rest.light.clone().applyQuaternion(turned.clone().invert()) };
};

const seen = new Vector3();
/**
 * The hero's framing for the figure as posed and turned: the scale and offset that fill the square,
 * folded, open flat or anything between.
 */
const heroFit = (figure: Figure, turned: Quaternion): Framed => {
  const p = figure.positions();
  let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < p.count; i++) {
    seen.fromBufferAttribute(p, i).applyQuaternion(turned);
    [minX, maxX] = [Math.min(minX, seen.x), Math.max(maxX, seen.x)];
    [minY, maxY] = [Math.min(minY, seen.y), Math.max(maxY, seen.y)];
  }
  const scale = HERO.size / Math.max(maxX - minX, maxY - minY);
  return { scale, x: -scale * ((minX + maxX) / 2), y: HERO.y - scale * ((minY + maxY) / 2) };
};

/** Places the figure: the hero's view and eased framing, blended by k into Inspect's (k = 1). */
const place = (holder: Group, euler: Euler, eased: Framed, k: number) => {
  holder.rotation.set(mix(euler.x, INSPECT.pitch, k), mix(euler.y, INSPECT.yaw, k), 0);
  holder.scale.setScalar(mix(eased.scale, INSPECT.scale, k));
  holder.position.x = mix(eased.x, 0, k);
  holder.position.y = mix(eased.y, INSPECT.y, k);
};

/**
 * One frame of the figure. Its fold is one value: changing figure (refold), or the hero's slider,
 * which gives way as Inspect's progress q rises. So does the hero's look (the SVG's) to Inspect's:
 * lit paper, taken apart. `framed` holds the hero framing between frames, eased by `ease` (1 snaps).
 */
export const drawFigure = (
  holder: Group,
  figure: Figure,
  framed: Framed,
  f: { id: ModelId; q: number; refold: number; hands: { fold: FoldControl; orbit: Orbit }; ease: number },
) => {
  const k = smooth(f.q);
  const u = Math.max(f.refold, f.hands.fold.value * (1 - k));
  const view = heroView(f.id, u, f.hands.orbit);
  figure.setFlat(1 - k);
  figure.pose(u, view.light.lerp(LIGHT, k).normalize(), inspectPhases(f.q).eased.layers);
  const target = heroFit(figure, view.turned);
  framed.scale = mix(framed.scale, target.scale, f.ease);
  framed.x = mix(framed.x, target.x, f.ease);
  framed.y = mix(framed.y, target.y, f.ease);
  place(holder, view.euler, framed, k);
};

/**
 * The scene fades into the page at the square's edges (a mask) only while inspecting; the figure
 * alone needs no edge. The opaque core grows past the corners (141% of closest-side) as q goes to
 * 0, so the mask comes and goes without a visible step.
 */
export const mask = (canvas: HTMLCanvasElement, q: number) => {
  const k = smooth(q);
  const edge =
    q < 0.001
      ? 'none'
      : `radial-gradient(closest-side, #000 ${mix(150, 70, k)}%, transparent ${mix(180, 100, k)}%)`;
  if (canvas.style.maskImage !== edge) {
    canvas.style.maskImage = edge;
  }
};
