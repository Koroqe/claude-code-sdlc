# Scratchpad

## Feature: none active

## Branch: main

## Status: idle

## Blockers

- **Live end-to-end run has never happened.** Every guard, validator and skill in v4.x is verified by
  unit tests and unverified in a real `/develop-feature` run. The session it was all built in
  predated its own plugin and loaded no hooks or agents at all. **This is the single largest
  unverified claim in the project** and is now unblocked — see below.
- **Four behavioural findings were measured on Claude Code 2.1.9 and need re-measuring on 2.1.237.**
  See `docs/findings/compaction-probe.md` §7 for the list and what changes if each is now fixed.
- **Compaction schema still uncaptured.** `pre:compact:probe` has never fired.

## Environment — changed 2026-08-20, read this before trusting old measurements

- CLI was 2.1.9 **x86_64** under Rosetta on an **arm64** machine (Homebrew at the `/usr/local` Intel
  prefix). It emitted `CPU lacks AVX support` on every call, and 2.1.228 **hung outright**.
- Replaced with the official **native arm64 build, 2.1.237**, at `~/.local/bin/claude`. The broken
  cask is uninstalled; `~/.local/bin` was added to `~/.zshrc`
  (backup: `~/.zshrc.bak-20260820-161413`).
- The VS Code extension ships its own bundled binary and was already current — the stale CLI only
  ever affected `claude -p` measurements, not interactive sessions.

## Completed

v4.0 roadmap F1–F5 shipped and merged. Releases: `v4.1.0` update path · `v4.2.0` release discipline ·
`v4.3.0` gate evidence · **`v4.4.0` plugin load failure (critical)**.

**4.0.0–4.3.0 did not load at all on current Claude Code** — `plugin.json` declared
`"hooks": "./hooks/hooks.json"`, which recent versions load by convention and reject as a duplicate,
failing the entire plugin. Same class as the `agents: "./agents/"` defect, one key over. Found only
by upgrading the CLI and running `claude plugin list`; now mechanized in
`validate-plugin-manifest.js`.

All feature branches merged and deleted — every commit is in `main`'s history.

Assets: **15 agents / 7 skills / 12 hook ids / 16 validators / 20 hook test files** against ceilings
of 16 / 10 / 12. **Hooks are AT the ceiling with no slot left.**

## Archive

Durable knowledge from completed features lives in the code and docs, not here:

- **Measured Claude Code behaviour** — `docs/findings/`: compaction, SubagentStop payload, worktree
  isolation decision, and what adopting v4.0 does to a live project.
- **Requirements** — `docs/PRD.md` §6–§11 (F1–F5). §3 superseded by F4, §4 by F5.
- **Release procedure** — `CLAUDE.md`. The advertised version in `.claude-plugin/marketplace.json` is
  what ships; a git tag is documentation. Scopes update independently.
- **What each guard enforces and why** — the header comment of each `hooks/handlers/*.js`, which is
  where the reasoning was written down deliberately rather than in this file.

### Deferred, with reasons recorded

- **Adopting `getdeal-platform-monorepo`** — pre-flight measured four collisions with how that team
  actually works (`docs/findings/adoption-getdeal-monorepo.md`). Three need an owner decision:
  feature branches vs disabling `pre:bash:git-guard`; one changelog format; what happens to a
  2,316-line operational scratchpad. Not blocked on us.
- **Worktree isolation** — deliberately deferred, reasons in
  `docs/findings/worktree-isolation-decision.md`.
- **Instinct arithmetic is prose-enforced** — elevation, decay and retirement live in skill markdown.
  One validator pins the two highest-value clauses; the rest can drift. Judged lower priority than
  gate evidence because it degrades slowly and visibly rather than silently.
