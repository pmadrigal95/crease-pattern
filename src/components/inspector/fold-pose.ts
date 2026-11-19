/**
 * The folded page's geometry (fold.ts): one sheet, one panel per section, each turning on the
 * hinge it shares with the next, like the figures' facets (src/lib/origami/hinge.ts) in one
 * dimension. Pure: positions from the page's layout at rest and the visitor's shape.
 */

/** A section's place on the page at rest. */
export interface Box {
  top: number;
  h: number;
  w: number;
}

/** What the visitor can change: how compact the fold is, how far it is turned, which creases open. */
export interface Shape {
  /** 0 flat … 1 as compact as paper allows. */
  squeeze: number;
  /** Turned left or right, in degrees, around the page's vertical axis. */
  yaw: number;
  /** One per crease between sections: true when the visitor opened it flat. */
  open: boolean[];
}

/** The fold at squeeze 1, in degrees from the sheet's plane: never edge-on, never past it. */
const MAX = 76;
const DEG = Math.PI / 180;
/** Where a visit starts: folded enough to read as an accordion, open enough to read each panel. */
export const REST_SQUEEZE = 0.66;

export const restShape = (sections: number): Shape => ({
  squeeze: REST_SQUEEZE,
  yaw: 0,
  open: new Array(Math.max(0, sections - 1)).fill(false),
});

/** A crease as drawn: mountain (solid), valley (dashed), or opened flat. */
export type Crease = 'mountain' | 'valley' | 'open';

/**
 * Each panel's transform, and each crease's kind. Every closed crease turns the next panel back
 * toward the other side, so the page zigzags and never folds past itself; an opened crease leaves
 * the next panel in the same plane.
 */
export const foldPoses = (layout: Box[], shape: Shape) => {
  const a = shape.squeeze * MAX;
  const transforms: string[] = [];
  const creases: Crease[] = [];
  let angle = a;
  let y = 0;
  let z = 0;
  layout.forEach((l, i) => {
    transforms.push(`translate3d(0px, ${y - l.top}px, ${z}px) rotateX(${angle}deg)`);
    y += l.h * Math.cos(angle * DEG);
    z += l.h * Math.sin(angle * DEG);
    if (i === layout.length - 1) return;
    if (shape.open[i]) {
      creases.push('open');
      return;
    }
    creases.push(angle > 0 ? 'mountain' : 'valley');
    angle = angle > 0 ? -a : a;
  });
  return { transforms, creases };
};

/** The whole fold's turn: a little from above, and the visitor's yaw. */
export const modelTurn = (shape: Shape) => `rotateX(-6deg) rotateY(${-30 + shape.yaw}deg)`;
