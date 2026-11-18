/**
 * The origami fox, as geometry (decision 44): six flat facets and the crease pattern they fold
 * from, on a 48×48 sheet. The masthead mark and the home hero draw from this one source, so the
 * fox and its pattern can never disagree. M4's 3D scene folds the same facets along the same edges.
 *
 * Facets fold along the edge they share with the head: the head halves along the center line
 * (origin `right`/`left` center), the ears and their inner folds along the brow (origin bottom).
 */
export interface Facet {
  /** Class names: the part (`head`, `ear`, `inner`) and its side. */
  part: 'head' | 'ear' | 'inner';
  side: 'left' | 'right';
  /** The facet's corners on the 48×48 sheet (y down): the source the 2D path and the 3D mesh share. */
  points: readonly (readonly [number, number])[];
  /** The same facet as an SVG path, derived from `points`. */
  d: string;
}

/** The y of the brow, the mountain fold the ears hinge on; the centre line is x = 24. */
export const foxBrowY = 16;
export const foxCentreX = 24;
/** The chin, where the centre valley fold ends. */
export const foxChinY = 44;

const facet = (part: Facet['part'], side: Facet['side'], points: Facet['points']): Facet => ({
  part,
  side,
  points,
  d: `M${points.map(([x, y]) => `${x} ${y}`).join('L')}z`,
});

export const foxViewBox = '0 0 48 48';
export const foxSheet = 'M3 2h42v44H3z';
/** Mountain folds, drawn solid. */
export const foxMountainFolds = 'M6 16h36M6 16l5-13 8 13M29 16l8-13 5 13';
/** Valley folds, drawn dashed. */
export const foxValleyFolds = 'M24 16v28M6 16l18 28M42 16 24 44';

/** Back to front: ears, their inner folds, then the head halves on top. */
export const foxFacets: readonly Facet[] = [
  facet('ear', 'left', [
    [6, 16],
    [11, 3],
    [19, 16],
  ]),
  facet('ear', 'right', [
    [29, 16],
    [37, 3],
    [42, 16],
  ]),
  facet('inner', 'left', [
    [9.5, 16],
    [11.5, 8],
    [16, 16],
  ]),
  facet('inner', 'right', [
    [32, 16],
    [36.5, 8],
    [38.5, 16],
  ]),
  facet('head', 'left', [
    [6, 16],
    [24, 16],
    [24, 44],
  ]),
  facet('head', 'right', [
    [24, 16],
    [42, 16],
    [24, 44],
  ]),
];
