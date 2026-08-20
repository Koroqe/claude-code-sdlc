# Scratchpad

## Feature: none active

## Branch: main

## Status: idle

## Blockers

- **Live end-to-end run has never happened.** Every guard, validator and skill in v4.x is verified by
  unit tests and unverified in a real `/develop-feature` run, because the session this was built in
  predated its own plugin and loaded no hooks or agents at all. Needs a session started *after* the
  plugin was enabled. This is the single largest unverified claim in the project.
- **Compaction schema still unknown.** `pre:compact:probe` has captured nothing. Same root cause as
  above — see `docs/findings/compaction-probe.md` §6.

## Plan

_None active._

## Completed

v4.0 roadmap F1–F5 all shipped and merged. Releases cut: `v4.1.0` (update path), `v4.2.0` (release
discipline), `v4.3.0` (gate evidence). All feature branches merged into `main` and deleted — every
commit lives in `main`'s history.

Current asset budget: **15 agents / 7 skills / 12 hook ids** against ceilings of 16 / 10 / 12.
**Hooks are at the ceiling with no slot left** — a thirteenth must be paid for by retiring one.

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
