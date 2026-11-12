# 0006 · Writing Precrease without a CMS, publishing on a schedule

Status: accepted · 2026-11-12

## Context

The plan for Precrease included Keystatic, a git-based CMS, so posts could be written from a phone. Keystatic's
GitHub mode needs a server route on the Worker and a GitHub App with write access to the repository. That turns
a static site into a hybrid one, adds a login surface, widens the Content Security Policy, and adds a dependency
that has to be kept up to date. Posts are MDX files in the repository, and any git editor can already change
them.

Posts also needed a way to go out on a set day without someone merging at that moment.

## Decision

- No CMS. A post is an MDX file in `src/content/precrease/`. From a computer it's written in the editor; from a
  phone, in github.dev or the GitHub app, on a branch. The pull request's preview shows the post before it
  merges.
- A post is published when it is not a draft and its `date` has arrived (`isLive` in
  `src/lib/precrease-tree.ts`). Every page reads posts through `getPosts()`, so a scheduled post stays out of the
  index, the feeds, the sitemap and search until then. `astro dev` shows it with a "Scheduled for" label.
- `deploy.yml` also runs every day at 12:00 UTC (6:00 a.m. in Costa Rica). `scripts/due-today.mjs` checks
  whether a post's date falls in the last three days; if none does, the run stops before building. The
  three-day window means one failed run doesn't leave a post unpublished.

## Consequences

- The site stays fully static, with no login and no write access granted to anything outside GitHub.
- Writing on a phone is plainer than a CMS form. If that turns out to slow down writing, this is the decision to
  revisit; until then, there is nothing to maintain.
- A scheduled post must be merged to `main` before its date. Merged early, it waits in the repository; the
  daily run publishes it.
