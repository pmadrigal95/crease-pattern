# 0007 · Reader counts on a Worker, comments on request

Status: accepted · 2026-11-12

## Context

Precrease posts show how many people opened them, read them to the end and found them useful, and the
numbers are public from the first post (decision 49). The site is static and promises no cookies, no
profiles and no stored IP addresses (decision 37, `/privacy`). Comments were planned through giscus, which
loads from a third party.

## Decision

- **A Worker for `/api/*` only.** `worker/index.ts` runs first for `/api/*` (`assets.run_worker_first`);
  every other request is served from the static assets without touching it. It has no npm dependencies, so
  the deploy job bundles it without installing anything next to the Cloudflare token.
- **Totals per post in D1, nothing else.** One row per post: `views`, `reads`, `helped`
  (`worker/migrations`). No visitor, session, IP or per-event timestamp is stored. The API is
  `GET /api/stats/<slug>` (cached for a minute) and `POST /api/stats/<slug>/<view|read|helped>`.
- **Abuse control without storing IPs.** Cloudflare's rate-limiting binding allows 30 events per visitor and
  post per minute. Its key holds the IP only in memory. Requests must come from this site's own pages
  (`Sec-Fetch-Site`, `Origin`), and only published posts count (the Worker checks the page exists).
- **Privacy signals win.** With Global Privacy Control or Do Not Track, the page doesn't send the view or
  the read. "This helped" is an explicit action, so it counts, once per browser (`pm.helped` in local
  storage).
- **Sharing without widgets.** Copy link, the system share sheet where there is one, and plain links to
  LinkedIn, X and Bluesky.
- **Comments on request.** giscus loads only after the reader presses "Show comments", and only then does
  the page's CSP allow `giscus.app`. Off until `site.config.ts` has its ids.

The logic lives in `worker/stats.ts` against two small interfaces, so `tests/unit/reader-stats.test.ts` runs
it without Cloudflare; the page's behaviour is tested with a simulated API in
`tests/e2e/precrease-readers.spec.ts`.

## Setup (once, by the site owner)

Run with your own Cloudflare login; no token goes into the repository or CI.

1. `pnpm exec wrangler d1 create crease-pattern-readers`, then put the printed `database_id` in
   `wrangler.jsonc`. The id is not a secret. Deploys refuse to run while the placeholder is there.
2. `pnpm exec wrangler d1 migrations apply crease-pattern-readers --remote`
3. For comments: enable Discussions on the repository, create a "Precrease" category (announcement type),
   install the giscus app on the repository, copy the ids from https://giscus.app into `comments` in
   `site.config.ts`, and add a "Comments" paragraph to `/privacy` in the same change.

## Consequences

- The site is no longer assets only: a bug in the Worker can only affect `/api/*`, and the page hides the
  counts quietly if the API fails.
- Public numbers can be small for a long time. That's accepted (decision 49): they are real.
- Deleting the D1 database resets the counts; nothing else depends on it.
- giscus needs its script, its iframe and one stylesheet, so posts add `giscus.app` to `script-src`,
  `frame-src` and `style-src`. `astro.config.mjs` declares `'self'` for styles explicitly: Astro's
  `insertStyleResource()` replaces the default list instead of extending it, and without that a post loses
  its own CSS.
