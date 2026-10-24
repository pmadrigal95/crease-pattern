# crease-pattern

> The interface is the folded fox. The architecture is the crease pattern.

The personal site of **Pablo Madrigal**, Lead Frontend Architect. It's built as an
inspectable design system: press `Shift`+`I` on any page to see its layers, tokens,
accessibility outline and live performance metrics. Every claim the site makes about
quality is measured in your browser, not written in a bio.

The same components render in three visual identities (`basalt-glacier`, `washi-asagi`,
`contour-lines`). Only the primitive color tokens change between them.

## Stack

| Piece         | Choice                                                         | Why                                                             |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| Site          | [Astro](https://astro.build), static output                    | Content ships as HTML with zero framework JavaScript by default |
| Islands       | Vue 3 + TypeScript (strict)                                    | Only the interactive parts (inspector, essays) hydrate          |
| 3D            | Three.js, loaded on demand                                     | The WebGL scene loads only when you inspect the page            |
| Threads essay | C → WebAssembly (Emscripten, pthreads)                         | Real threads running in the browser                             |
| Tokens        | DTCG JSON → `scripts/build-tokens.mjs` → CSS custom properties | One source of truth, shown live in the inspector                |
| Hosting       | Cloudflare Workers (static assets)                             | Per-route headers, global CDN, room for small APIs              |

## Getting started

Requires Node 24 (see `.node-version`) and pnpm via Corepack.

```bash
corepack enable
pnpm install
pnpm dev          # http://localhost:4321
```

## Quality gates

Everything below runs in CI on every push and pull request.

```bash
pnpm format:check # Prettier
pnpm lint         # ESLint (TypeScript, Astro, Vue, jsx-a11y strict)
pnpm check        # astro check (types)
pnpm test         # WCAG AA contrast for 3 identities × 2 themes
pnpm test:e2e     # axe in every identity and theme, no overflow at 375px
pnpm lighthouse   # budgets: LCP < 1.8 s, CLS < 0.05, initial JS < 15 KB
```

## Branches

| Branch                         | Purpose                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`                         | Concept-independent foundations: tooling, tokens, layout, content model, CI. Deploys to production                                                             |
| `dev`                          | Integration. Feature and concept branches merge here first                                                                                                     |
| `concept/inspector-identities` | Everything specific to the current concept (inspector, fox, fluid ink, Threads). Kept separate so the concept can be replaced without touching the foundations |

## Decisions

Architecture decisions are recorded in [`docs/decisions`](docs/decisions).

## License

Code is MIT. Writing is CC BY-NC 4.0. The visual identity is reserved. See [LICENSE.md](LICENSE.md).
