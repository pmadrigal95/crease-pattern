# 0003 · Three visual identities over one semantic layer

Status: accepted · 2026-10-23

## Context

The author liked three palette directions equally. Instead of choosing one, the site demonstrates
what a design system is for: the same components rendered with different primitive tokens.

## Decision

- `VisualDirection` (`src/config/visual-direction.ts`) enumerates the identities with descriptive ids:
  `basalt-glacier`, `washi-asagi`, `contour-lines`.
- Each identity defines only primitive colors, light and dark, in `tokens/directions/<id>.json`.
- Semantic tokens (`--color-ink`, `--color-accent`…) are identical across identities; components only
  read semantic tokens.
- The active identity is the `data-direction` attribute on `<html>`, rendered by the server from
  `site.config.ts` and restored from `localStorage` before first paint.
- The identity switcher is a **public** feature of the inspector.

## Consequences

- Contrast is tested for every identity and theme (`tests/unit/tokens.test.ts`); a palette change that
  breaks WCAG AA fails CI.
- Every screen must be reviewed in six combinations (3 identities × 2 themes); visual and axe tests
  run all six.
