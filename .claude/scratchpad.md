# Scratchpad

## Feature: stale-install-detection

## Tier: full

## Branch: feat/stale-install-detection

## Status: implementing wave 4 slice 4/5

## Version: 4.5.0 — bumped in Slice 1's commit; /merge-ready Release step: bump already done, do NOT bump again (a re-bump would burn 4.6.0 on an empty delta)

## Plan

Full plan with all fields: `/private/tmp/claude-501/-Users-aleksei-Documents-Projects-nosync-claude-code-sdlc/6b6ca8b6-8dfb-4312-b4e9-71d330eef3d0/scratchpad/plan-stale-install-detection.md`
Feature: PRD §12. Docs: docs/use-cases/stale-install-detection_use_cases.md, docs/qa/stale-install-detection_test_cases.md (42 TCs). Critic: 3 loops, all BLOCKER/WARNING fixed.

Deviation rule fires this feature: rule1=1 rule2=0 rule3=0 rule4=0
(rule1: git-guard refused non-conventional "docs" commit type during bootstrap git setup — rewrote to chore, free)
Slice 1 build-runner attempts: 1/3

### Wave 1 [COMPLETE]
- [x] Slice 1 (Tracer): loadedPluginVersion() hoist + staleInstallLine() end-to-end + 4.5.0 bump (4 sources) + PRD FR-2.2/FR-1.4/AC-2 amendments via prd-writer — e26a68d. Verify PASSED: 4 suites green + full sweep 16/16 validators, 934 checks. Tracer gate: SATISFIED.

### Wave 2 [COMPLETE]
- [x] Slice 2: match semantics — 75 checks green (was 34); all 14 new fixture groups passed against Slice 1's implementation (zero handler diff — semantics already correct); QA TC-6.3/6.4 mechanism wording + loaded-version de-hardcode — 34640c4. Verify PASSED, sweep 16/16 + 20/20.
Slice 2 build-runner attempts: 1/3

### Wave 3 [COMPLETE]
- [x] Slice 3: fail-open proofs — 14 SILENT + 2 EMIT + S3-1/2/3 fixtures, 181 checks green, test-only (guards shipped in tracer per S1-1) — 13f7974. Sweep 16/16 + 20/20.
Slice 3 build-runner attempts: 1/3

### Wave 4
- [ ] Slice 4: drift-line coexistence, shared cap, structural helper proof, header third-trust-class rewrite (all three "seven" phrasings) + PRD §11 FR-5.6 supersession via prd-writer. Pre-review: architect. [pending]

### Wave 5
- [ ] Slice 5: measure-latency HOME pinning, latency doc update (with comparability caveat), README spine row, PRD §12 status flip + AC-1 de-hardcode via prd-writer. [pending]

## Blockers

(none for this feature)

Project-level notes carried over:
- **Four behavioural findings were measured on Claude Code 2.1.9 and need re-measuring on 2.1.237.**
  See `docs/findings/compaction-probe.md` §7.
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
