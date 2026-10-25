# 0004 · Foundations separate from the concept

Status: accepted · 2026-10-23

## Context

The site concept (inspector, origami fox, identities, Threads) is expected to evolve. Rebuilding
tooling and foundations each time would be wasted work.

## Decision

- `main` holds only concept-independent foundations: tooling, CI, tokens engine, layout, content
  model, licenses. It is what deploys.
- `development` integrates work before it reaches `main`.
- `concept/inspector-identities` holds everything specific to the current concept and merges into
  `development` piece by piece once validated.

## Consequences

- Replacing the concept means starting a new `concept/*` branch from `development`; foundations stay intact.
- Concept code should live in its own folders (`src/components/instrument`, `src/labs`) so it can be
  removed cleanly.
