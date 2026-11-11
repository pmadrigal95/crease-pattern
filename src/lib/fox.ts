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
  d: string;
}

export const foxViewBox = '0 0 48 48';
export const foxSheet = 'M3 2h42v44H3z';
/** Mountain folds, drawn solid. */
export const foxMountainFolds = 'M6 16h36M6 16l5-13 8 13M29 16l8-13 5 13';
/** Valley folds, drawn dashed. */
export const foxValleyFolds = 'M24 16v28M6 16l18 28M42 16 24 44';

/** Back to front: ears, their inner folds, then the head halves on top. */
export const foxFacets: readonly Facet[] = [
  { part: 'ear', side: 'left', d: 'M6 16 11 3l8 13z' },
  { part: 'ear', side: 'right', d: 'm29 16 8-13 5 13z' },
  { part: 'inner', side: 'left', d: 'm9.5 16 2-8 4.5 8z' },
  { part: 'inner', side: 'right', d: 'm32 16 4.5-8 2 8z' },
  { part: 'head', side: 'left', d: 'M6 16h18v28z' },
  { part: 'head', side: 'right', d: 'M24 16h18L24 44z' },
];
