/**
 * The three visual identities of the site. Each one swaps only the primitive
 * color tokens (see tokens/directions/<id>.json); components never know which
 * one is active. The id is reused everywhere: the `data-direction` attribute,
 * the token file name, and visual-regression snapshot names.
 */
export const VisualDirection = {
  BasaltGlacier: 'basalt-glacier',
  WashiAsagi: 'washi-asagi',
  ContourLines: 'contour-lines',
} as const;

export type VisualDirection = (typeof VisualDirection)[keyof typeof VisualDirection];

export const visualDirectionLabels: Record<VisualDirection, { label: string; note: string }> = {
  [VisualDirection.BasaltGlacier]: { label: 'Basalt & glacier', note: 'Iceland: basalt, glacier ice, moss' },
  [VisualDirection.WashiAsagi]: { label: 'Washi & asagi', note: 'Japanese paper, sumi ink, walnut' },
  [VisualDirection.ContourLines]: { label: 'Contour lines', note: 'Trail maps, cloud forest, lakes' },
};

export const allVisualDirections = Object.values(VisualDirection);
