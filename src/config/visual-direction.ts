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

// Their names, per language, are in the interface copy (src/i18n/locales/<lang>/ui.json, `identities`).
export const allVisualDirections = Object.values(VisualDirection);
