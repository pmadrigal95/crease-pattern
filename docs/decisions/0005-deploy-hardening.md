# 0005 · Production deploy bound to main

Status: accepted · 2026-10-25

## Context

A security review found that the stated rule "main is what deploys" (ADR 0004) was not enforced: the deploy
workflow accepted manual runs on any branch, the Cloudflare secrets were repository-wide, and the job that
received the token ran third-party actions from movable tags next to dependency code.

## Decision

- The Cloudflare secrets live in a GitHub environment `production` whose deployment-branch policy admits only
  `main`. Every deploy job also checks `github.ref == 'refs/heads/main'`.
- Deploy is two jobs: `build` has no secrets and uploads `dist`; `deploy` runs in `production`, downloads that
  artifact and publishes it with a pinned `wrangler`. Dependency code never shares a runner with the token.
- Every action in every workflow is pinned to a full commit SHA, with the version in a comment. Dependabot keeps
  the pins current, and the repository setting requires SHA pinning.
- Checkouts do not persist the GitHub token. Node is pinned to an exact release.
- `scripts/check-workflows.mjs` runs in CI and fails if any of these rules regresses.

## Consequences

- A deploy can only publish what `main` built in the same run.
- Updating an action is a reviewed Dependabot PR that changes a SHA, never a silent tag move.
