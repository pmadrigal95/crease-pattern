# Concept: inspector and identities

This branch holds everything specific to the current site concept. Foundations live on `main`
(see [ADR 0004](../decisions/0004-branching.md)).

## Thesis

> The interface is the folded fox. The architecture is the crease pattern.

The site proves its own quality. Visitors can open an inspector that reveals the page's layers,
tokens, accessibility outline and live performance metrics.

## Pieces

| Piece | Description | Milestone |
| --- | --- | --- |
| Inspector | `Shift`+`I`, the button or the fox open it. The page separates into CSS 3D layers; a panel shows layers, tokens, lowest text contrast per layer, live metrics and the accessibility outline. Keyboard: arrows move, Enter pins, Esc closes | M2 |
| Identity switcher | Public section of the inspector: same components in three identities, with a token diff | M2 |
| Origami fox | Geometric mark that unfolds into its crease pattern when inspecting; real 3D folding in Three.js | M2 (2D) · M4 (3D) |
| 3D scene | Under the exploded layers, per identity: Irazú relief from real elevation data (contour-lines), procedural basalt columns (basalt-glacier), stacked washi sheets (washi-asagi) | M4 |
| Fluid ink | WebGL2 fluid simulation in the hero only, tuned per identity; off for reduced motion, touch and while inspecting | M4 |
| Essay: Parallel code that actually scales | A puzzle solver running with real threads in the browser (C → WebAssembly), Amdahl and Gustafson demos | M3 · M7 |
| Career changelog | Career told as semver releases | M1 |

## Prototype

[`prototype-v2.html`](prototype-v2.html) is the reviewed visual prototype (single file, no build).
Open it in a browser to see the concept: identities, inspector, fox, fluid ink and the essay.

## Rules carried from the design review

- Shortcut is `Shift`+`I` (WCAG 2.1.4); every animation has a pause or a reduced-motion path.
- Accent colors split into UI and text variants so text always passes 4.5:1.
- Inspector metadata is derived at build time, never written by hand.
- Copy leads with competence and verifiable claims; no invented metrics.
