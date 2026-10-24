# 0001 · Astro with Vue islands, Three.js on demand

Status: accepted · 2026-10-23

## Context

The site is mostly content (case studies, essays, career), with a few heavy interactive pieces:
the inspector, a WebGL scene, a fluid simulation and a WebAssembly concurrency demo. It must load
fast on mid-range phones and stay maintainable for years by one person.

## Decision

- **Astro** as the site shell with static output. Pages ship HTML and CSS only.
- **Vue 3** islands for interactive UI, hydrated only when needed.
- **Three.js without a wrapper**, imported dynamically when the visitor opens the inspector.
- **C compiled to WebAssembly** for the Threads essay, so the original solver runs with real threads.

## Alternatives considered

- **Next.js + React Three Fiber:** the largest 3D ecosystem, but it ships the React runtime on every
  page, and the 3D here is a layer, not the product.
- **Nuxt (SSG):** familiar, but hydrates the whole app by default.
- **SvelteKit + Threlte:** light and capable, but adds nothing to the author's positioning.

## Consequences

- Initial JavaScript stays near zero; the budget is enforced by Lighthouse CI.
- If the 3D ever grows into a full scene, Astro allows adding an R3F or TresJS island without a rewrite.
