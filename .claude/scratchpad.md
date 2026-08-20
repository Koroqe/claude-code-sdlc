# Scratchpad

## Feature: stale-install-detection

## Tier: full

## Branch: feat/stale-install-detection

## Status: complete

Gates: 9/9 — MERGE READY. Gate 0 PASS; Gate 1 PASS; Gate 2 PASS (no findings above threshold); Gate 3 PASS (all S1/S3 conditions delivered); Gate 4 PASS (16/16 validators, 20/20 suites, 1,079 checks); Gate 5 PASS (198/198 + live probe detected the real 4.1.0 stale install); Gate 6 VERIFIED passed:true (freshness confirmed 2026-08-20 17:17); Gate 7 PASS (use-case fix + digest row); Gate 8 N/A (no UI). Finalization: changelog entry written 17:23 UTC (orchestrator write — isolation-guard refused the delegated write, see docs/findings/live-pipeline-run-2026-08-20.md); instinct store created, Feature counter=1, zero captures (no trigger met threshold).
Gate 4 attempts: 1/3
Gate 6 attempts: 1/3

## Version: 4.5.0 — bumped in Slice 1's commit; /merge-ready Release step: bump already done, do NOT bump again (a re-bump would burn 4.6.0 on an empty delta)

## Plan

Full plan with all fields: `/private/tmp/claude-501/-Users-aleksei-Documents-Projects-nosync-claude-code-sdlc/6b6ca8b6-8dfb-4312-b4e9-71d330eef3d0/scratchpad/plan-stale-install-detection.md`
Feature: PRD §12. Docs: docs/use-cases/stale-install-detection_use_cases.md, docs/qa/stale-install-detection_test_cases.md (42 TCs). Critic: 3 loops, all BLOCKER/WARNING fixed.

Deviation rule fires this feature: rule1=1 rule2=0 rule3=2 rule4=0
(rule3 #2: git-guard refused the release-procedure push — override applied per CLAUDE.md ## Release authority, 1 retry. Tally reached 2 → Trigger 2 instinct captured.)
(rule1: git-guard refused non-conventional "docs" commit type during bootstrap git setup — rewrote to chore, free)
(rule3: NFR-2's 30ms latency threshold unmeetable under Node 24's ~48ms startup floor — recorded actual 52.0ms + 3.6ms logic delta per the fallback clause, 1 retry)
Slice 1 build-runner attempts: 1/3

### Wave 1 [COMPLETE]
- [x] Slice 1 (Tracer): loadedPluginVersion() hoist + staleInstallLine() end-to-end + 4.5.0 bump (4 sources) + PRD FR-2.2/FR-1.4/AC-2 amendments via prd-writer — e26a68d. Verify PASSED: 4 suites green + full sweep 16/16 validators, 934 checks. Tracer gate: SATISFIED.

### Wave 2 [COMPLETE]
- [x] Slice 2: match semantics — 75 checks green (was 34); all 14 new fixture groups passed against Slice 1's implementation (zero handler diff — semantics already correct); QA TC-6.3/6.4 mechanism wording + loaded-version de-hardcode — 34640c4. Verify PASSED, sweep 16/16 + 20/20.
Slice 2 build-runner attempts: 1/3

### Wave 3 [COMPLETE]
- [x] Slice 3: fail-open proofs — 14 SILENT + 2 EMIT + S3-1/2/3 fixtures, 181 checks green, test-only (guards shipped in tracer per S1-1) — 13f7974. Sweep 16/16 + 20/20.
Slice 3 build-runner attempts: 1/3

### Wave 4 [COMPLETE]
- [x] Slice 4: coexistence + structural tests (198 checks), header third-trust-class rewrite (zero "seven", architect must-fix on line-based guarantee delivered, S3-4 semantics note), PRD §11 FR-5.6 supersession — 5f47f55. Sweep 16/16 + 20/20. Sources-frame advisory DELIBERATELY not applied (non-blocking; rewording the frame sentence mid-feature would break its asserted contract — recorded for a future feature).
Slice 4 build-runner attempts: 1/3

### Wave 5 [COMPLETE]
- [x] Slice 5: measure-latency HOME pinning, latency re-measured (52.0ms median, ~48ms startup floor, ~3.6ms logic delta — NFR-2 threshold recorded-not-met per fallback, Rule 3), latency doc + README row, PRD §12 [SHIPPED] + AC-1 de-hardcode — de23e25. Sweep 16/16 + 20/20.
Slice 5 build-runner attempts: 1/3

## Blockers

(none for this feature)

Project-level notes carried over:
- **Compaction schema still uncaptured.** `pre:compact:probe` has never fired (re-confirmed unknown on 2.1.237).
- **Re-measurement follow-ups (docs/findings/remeasurement-2.1.237.md):** (1) install.sh still prints the obsolete "ONE STEP LEFT — required, per project" banner — sensitive path, needs a pipeline run to remove; (2) SubagentStop now carries agent_type → stop:gate-evidence per-gate attribution + wave-record agent-type keying + develop-feature step-1a text update, one coordinated feature.
- **Live-run follow-ups (docs/findings/live-pipeline-run-2026-08-20.md):** isolation-guard vs merge-ready changelog delegation contradiction; read-guard Write-then-Edit false positive; git-guard vs release-procedure push; .claude/debug/ not gitignored; develop-feature stale "land in a later slice" prose; step-1a errored-tool-results tolerance.

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
