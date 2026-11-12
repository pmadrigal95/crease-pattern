# Agents

Instructions for AI coding agents working in this repository.

1. Read [ENGINEERING.md](ENGINEERING.md) first and follow it: layers, naming, formatting, CSS and
   tests. Its rules apply to generated code exactly as to hand-written code.
2. Architecture decisions are in [docs/decisions](docs/decisions). Don't contradict one without
   proposing a new decision.
3. Toolchain: Node 24 (`.node-version`), pnpm through Corepack (`corepack pnpm …`).
4. Before proposing a change as done, run the "Before every push" commands in ENGINEERING.md,
   including the e2e suite.
5. A refactor must not change what visitors see: take visual baselines first
   (`npm run test:visual -- --update-snapshots`) and compare after.
6. Write copy in the site's voice (ENGINEERING.md, "Voice") and run it through the `ux-writing` and
   `humanizer` skills before proposing it.
7. Never invent content: facts, metrics and opinions on the site are the author's. Leave a clear
   placeholder in a draft instead of making one up.
8. Commits and pull requests use conventional prefixes and carry no AI attribution.
