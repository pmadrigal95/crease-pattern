# Engineering

How code is written in this repository. This file states the rules; lint rules and guard tests
enforce the ones a machine can check. If a rule here and the code disagree, fix one of them in the
same pull request.

## Principles

- **Complexity is the cost.** Every change is judged by whether the system gets easier or harder to
  understand. A module earns its place by hiding more than its interface costs to learn.
- **Deep modules, simple interfaces.** `getPosts()` hides collection loading, draft rules and number
  checks behind one call. Prefer one well-named function over a family of small ones that each leak
  a detail.
- **One place per decision.** How a date reads, what a Crease is called, which color is the accent:
  each lives in exactly one module or token, and everything else asks it.
- **The platform first.** HTML, CSS and browser APIs before JavaScript; small JavaScript before a
  framework. Vue runs only in the Inspector.
- **Strategic, not tactical.** Leave every file you touch a little clearer. Refactoring is part of
  the feature, not a separate project.
- **Clean room.** Names, structure and patterns are this repository's own (see
  [ADR 0002](docs/decisions/0002-clean-room.md)).

### SOLID, translated to this stack

| Principle             | Here it means                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single responsibility | A module answers one question: `format.ts` how values read, `precrease-tree.ts` how topics nest, `thumbnail.ts` how a post's pattern is drawn.                   |
| Open/closed           | New cases are data, not branches: a topic, a format or an identity is added in `src/config` or `tokens/`, and no component changes.                              |
| Liskov                | A component accepts every value its props type allows. No prop that "only works" with some inputs.                                                               |
| Interface segregation | Props ask for what the component uses. `PostThumb` takes a slug and a format, not a whole post.                                                                  |
| Dependency inversion  | Layers depend inward (below). Pure logic in `lib` never imports markup; browser scripts get server data through `data-*` attributes, not by reaching into pages. |

## Layers

```
src/config      data the site is made of: topics, formats, identities      (imports nothing from src)
src/lib         pure logic and browser helpers, unit-tested                  (imports config)
src/components  Astro components, one job each                                (imports lib, config)
src/layouts     page shells                                                   (imports components, lib)
src/pages       routes: fetch, compose, nothing clever                        (imports everything above)
```

ESLint enforces the direction (`eslint.config.js`, `no-restricted-imports`). Content (`src/content`)
and tokens (`tokens/`) are data, read through `lib` and generated CSS.

## Naming

- Files say what they hold: `PostCard.astro`, `precrease-tree.ts`, `format.ts`. Components are
  PascalCase, modules kebab-case.
- A component's `data-inspect` id equals its file name; a page section's is `page#section`
  (the Inspector's manifest depends on it).
- Constants that enumerate are const objects with descriptive values (`VisualDirection.ContourLines
= 'contour-lines'`), never `a`/`b`/`c` or numeric enums.
- Functions are verbs or the noun they return: `getPosts`, `formatDate`, `creaseNumber`.

## TypeScript

- Strictest settings, including `exactOptionalPropertyTypes`: an optional prop that may receive
  `undefined` says so (`image?: string | undefined`).
- ES modules, `const` by default, no classes unless something has a lifecycle (the Inspector).
- `satisfies` to check a literal against a type without widening it.
- Validate at the edges (content schemas with Zod, the copy file on import), then trust the types.

## Text, copy and formatting

- Every interface string lives in `src/content/copy/en.json`. Sentences are never concatenated:
  dynamic values go through `fill()` (`src/lib/template.ts`).
- Values become text only in `src/lib/format.ts`: `formatDate`, `formatMonth`, `formatRange`,
  `formatNumber`, `formatList`, `formatCount`, `padNumber`. `creaseNumber` (in `lib/precrease.ts`)
  builds on it. A guard test fails if any other file calls `Intl` or pads a number.
- Format when showing a value, never to store, sort or compare it. Dates are calendar days at UTC
  midnight.

## Voice

Everything the site says, from a button to a post, uses the same voice: calm, warm and senior. Facts come
without adjectives, achievements read as context, learning is treated as ordinary, and the reader is invited
rather than told. Claims stay within what is measured. New copy goes through the `ux-writing` and `humanizer`
skills before it ships; AGENTS.md says the same to coding agents.

## Components

- Astro by default, zero JavaScript by default.
- One job per component, props typed with an `interface Props`, a short header comment saying what
  it is and anything surprising about it.
- Accessibility is part of the component: semantic elements first, ARIA only to fill gaps, no
  interactive element inside another (axe's `nested-interactive`).

## Browser scripts

- Progressive enhancement: the page works without JavaScript; an element that only works with it
  starts `hidden` and the script reveals it.
- Server data reaches a script as JSON in a `data-*` attribute, read with `readJsonData()`
  (`src/lib/dom.ts`). No inline scripts: the CSP allows only hashed ones.
- Scripts that run on every page (the masthead, analytics, the About portrait) stay
  self-contained: with no imports Astro inlines a small script, and a helper shared between two
  scripts becomes its own chunk, requested after them. Three such 400-byte chunks pushed About's
  LCP over its budget. Shared helpers (`src/lib/keyboard.ts`, `template.ts`, `dom.ts`) are for
  scripts that load on their own page or on demand, such as Precrease search. There is no client
  framework outside the Inspector.
- Heavy code loads on first use (`import()` on focus or click), never on page load.

## CSS

- Values come from tokens (`tokens/*.json` → `src/styles/tokens.css`): colors, sizes, spaces,
  radii, strokes, motion, and composite type styles such as `font: var(--type-caption)`. A raw
  number in CSS is either a one-off geometry value or a missing token.
- Global CSS sits in cascade layers, `reset → base → shared → utilities`; component styles are
  unlayered and always win (`src/styles/base.css`).
- Component styles are scoped; `:global()` only for content the component renders but doesn't own
  (MDX, nodes built by a script).
- No `style` attributes: the CSP forbids them. Dynamic values go through custom properties set from
  script (`el.style.setProperty`) or SVG presentation attributes.
- Motion uses tokens, respects `prefers-reduced-motion`, and never animates layout properties.
- Scroll-driven animations set `animation-timeline` where the minifier can't fold it into the
  `animation` shorthand (a separate rule, or the timeline through a custom property): browsers reject
  a shorthand that carries a timeline, and the whole declaration is lost.
- Layout inside a component adapts to its container (container queries) where the component can
  sit in columns of different widths.

## Platform features in use

- Cross-document View Transitions for the page fold (`base.css`).
- Speculation Rules (`public/speculation-rules.json`, sent as a header) prefetch a page when the
  pointer rests on its link. Prefetch only, never prerender, so no script runs ahead of a visit.
- Precrease search keeps its own panel instead of the Popover API: the panel belongs to a search
  field that keeps focus while typing, and a popover's light dismiss would close it on every click
  in the field. Revisit when anchor positioning and `popover="hint"` are in every engine.

## Tests

| Kind    | Where                       | What it proves                                                                                        |
| ------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unit    | `tests/unit`                | `lib` logic, content schemas, token contrast                                                          |
| Guards  | `tests/unit/guards.test.ts` | Rules that break one file at a time: formatting outside `format.ts`, debug code                       |
| E2E     | `tests/e2e`                 | axe in every identity and theme, privacy, the Inspector, no overflow on phones                        |
| Visual  | `tests/visual` (local)      | A refactor changes nothing visible: `npm run test:visual -- --update-snapshots` before, compare after |
| Budgets | `scripts/check-*.mjs`       | JavaScript and file sizes                                                                             |

A guard's header comment says what went wrong without it. A new exception names its reason.

## Before every push

```bash
pnpm format:check && pnpm lint && pnpm check && pnpm test
pnpm build && pnpm check:budgets
pnpm test:e2e     # local too: CI is not the first place a failure should show up
```

Commits use conventional prefixes (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `refactor:`).
