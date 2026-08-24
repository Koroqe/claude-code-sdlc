# Scratchpad

## Feature: post-live-run-reconciliation

## Tier: full

## Branch: feat/post-live-run-reconciliation

## Status: implementing wave 2 slice 2/8

## Version: 4.6.0 — bumped in Slice 1's commit; /merge-ready Release step: bump already done, do NOT bump again (a re-bump would burn 4.7.0 on an empty delta)

## Plan

Full plan with all fields: `/private/tmp/claude-501/-Users-aleksei-Documents-Projects-nosync-claude-code-sdlc/6b6ca8b6-8dfb-4312-b4e9-71d330eef3d0/scratchpad/plan-post-live-run-reconciliation.md`
Feature: PRD §13. Docs: docs/use-cases/post-live-run-reconciliation_use_cases.md (73 scenarios), docs/qa/post-live-run-reconciliation_test_cases.md (99 TCs). Architecture: FAIL→delta-PASS. Critic: 3 loops (36 findings), all BLOCKER/WARNING fixed; two disputes settled by live measurement (docs/findings/remeasurement-2.1.237.md §5). Docs committed: 91d7b3f.

Deviation rule fires this feature: rule1=2 rule2=0 rule3=0 rule4=0
(rule1 #1: git-guard chain-blindness — refused a commit chained after checkout -b; split the commands, free. Third occurrence across features → captured as git-guard-chain-blindness instinct at wave-2 fold.)
(rule1 #2, from Slice 5's report: M12 messaging-only diff gate flagged a deleted blank line — preserved structure with echo "", free.)
Tally reached 2 → Trigger 2 captured (orchestrator write, post-wave fold).

### Wave 1 [COMPLETE]
- [x] Slice 1 (Tracer): hooks.json matcher Read→Read|Write + TC-A2 config assertion (red→green) + TC-A18 negative control + test-wrapper.js semantic matcher fix + 4.6.0 bump — a4eca85. Verify PASSED: guard-read 30 checks, wrapper 104, guards-cross 125, full sweep 16/16 + 20/20. Tracer gate: SATISFIED.
Slice 1 build-runner attempts: 1/3

### Wave 2 [COMPLETE — first genuine parallel wave: 4 subagents, all PASS, all wave-records cross-checked in-surface]
- [x] Slice 2: read-guard residuals — M14/M15 delivered (Write-scoped error check, structural permissive default), 56 checks — 47c86e1. attempts 1/3, errored-tool-results 2 (benign, self-disclosed drafting no-ops).
- [x] Slice 3: wave-record bounding — FIELD_RE, omit-vs-fallback, (b2) non-string hardening reproduced red live, session_id — 646c96b. attempts 1/3, errored 0.
- [x] Slice 4: .gitignore /.claude/debug/ with measured-truth comment + separator-free negative control — 13372b6. attempts 1/3, errored 1 (benign).
- [x] Slice 5: install.sh de-obsolescence — 6 ranges rewritten content-located, M9-M13 all delivered, TC-D6 mock harness green, enable call survives md5-identical — 9ca9bae. attempts 1/3, errored 0, (rule1,1).
Post-wave orchestrator sweep: 16/16 validators + 20/20 suites green.

### Wave 3 [COMPLETE — parallel, both PASS, records cross-checked in-surface]
- [x] Slice 6: gate-evidence advisory systemMessage — M1-M8 all delivered, sole decision-path edit verified as the single non-comment removed line, 66 checks (21 red-first) — b5db531. attempts 1/3, errored 0.
- [x] Slice 7: merge-ready SKILL compose-then-orchestrator-writes + sanctioned release-push override — a35fe27. attempts 1/3, errored 0.
Post-wave orchestrator sweep: 16/16 validators + 20/20 suites green (sweep needed extended timeout — suites grew).

## Status: implementing wave 4 slice 8/8

### Wave 4 [COMPLETE]
- [x] Slice 8: develop-feature + src/claude.md + README stale-text reconciliation — all greps pre-verified unique, parity validator green after each edit, full sweep 16/16 + 20/20 — b8cdf9b. attempts 0/3, no deviations.

## Status: complete

Gates: 9/9 — MERGE READY. Gate 2 PASS ×2 (main diff + replan commits); Gate 6 VERIFIED passed:true gaps:[] on attempt 2 (freshness confirmed 2026-08-20 21:24); Gate 8 N/A (no UI). Finalization: changelog 21:28 UTC written by orchestrator from doc-updater's composed text (the contract this feature shipped, used on itself). Instincts: counter 1→2, new capture manual-verification-must-be-persisted (Gate Auto-Fix from Gate 6), git-guard-chain-blindness re-stamped; no elevation (all general at 1 occurrence), no decay (Prevention Rules empty), no retirement.

Prior gate detail: 7/9 (Gate 0 PASS; Gate 1 PASS; Gate 3 PASS ×2 — main diff (all 15 conditions evidenced file:line; its double-enable observation verified PRE-EXISTING on main) and replan-commit re-audit (install.sh harness containment verified: --local/sandboxed HOME/temp cwd/absolute path/no --profile on all 4 runs, mock quoting safe, repo-untouched guard genuine); Gate 4 PASS — 16/16 + 20/20 (re-swept 22/22 after replan); Gate 5 PASS — both live probes green; Gate 7 PASS. Gates 2-rerun, 6-rerun running. Gate 8 N/A — no UI.)

Follow-up (below reporting bar, from Gate 3 rerun): tests/hooks/test-gitignore-hygiene.js inherits process.env wholesale — GIT_CONFIG_GLOBAL + HOME neutralize the config surfaces, but an exported XDG_CONFIG_HOME still points git at a developer's real ~/.config/git/ignore. Adding XDG_CONFIG_HOME: sandboxHome (and clearing GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE) closes it. Evidence-integrity hardening, not security; deliberately NOT committed mid-gate to avoid invalidating the in-flight Gate 2/3 re-reviews.
Gate 4 attempts: 1/3
Gate 6 attempts: 2/3 (attempt 1: PRESENT_BEHAVIOR_UNVERIFIED — 2 Level-4 gaps, both "ran once manually, not persisted". --gaps replan closed both: R1 a8be3e2 tests/hooks/test-gitignore-hygiene.js (15 checks, seeded-broken → 6 precise failures), R2 1576d70 tests/hooks/test-install-messaging.js (32 checks, 4 sandboxed install.sh runs, seeded-broken → exit 1) + README counts 16/22. Sweep 16/16 + 22/22. Attempt 2 running with Gates 2+3 re-run over the replan commits per the Auto-Fix Protocol.)

## Blockers

(none for this feature)

Project-level notes carried over:
- **Behavioural eval shipped (2026-08-24).** `node scripts/eval/run-evals.js`. Baseline: **4/4 Triage
  cases pass**. Grading logic unit-tested free in the sweep (30 checks, 8 seeded-broken). Read
  `evals/README.md` before believing a failure — two instrument bugs produced confident false results
  before the first true baseline.
- **Evidence-ranked improvement queue** (all measured; `docs/findings/harness-optimization-research.md`):
  (1) red-phase / discriminating-evidence done-condition — a test must be shown to FAIL before the fix
  (23.8% of agent patches carry no discriminating evidence; 31% pass tests without resolving);
  (2) stall detection — step repetition is MAST's largest single failure mode at 17.14%; costs a hook
  id and we are at 12/12, so it requires retiring one;
  (3) `maxTurns` on agent frontmatter — supported, set nowhere, bounds runaway directly;
  (4) confidence signal at plan time (Devin: green ≈ 2× merged-PR likelihood vs red);
  (5) context-tax reduction — ~93k tok of skill text per 8-slice feature — gated behind the eval,
  because no study measures relocating MANDATORY gating rules and Triage Steps 1-7 are exactly that.
- **Documented anti-patterns — do not "improve" into these:** multi-agent debate on the GENERATION
  path (−1.6 to −15.5pp), full-file context (−5.3pp), raw iterative search (worse than no search at
  all), repository-overview prose in instruction files (+20% cost, no success gain).
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

**v4.5.0 — stale-install-detection (2026-08-20).** First live end-to-end pipeline run: PRD §12, 5 slices (e26a68d..de23e25), 9/9 gates MERGE READY, released and delivery-confirmed (user scope 4.4.0→4.5.0, this repo's stale project-scope 4.1.0→4.5.0 fixed with the feature's own command). Feature-level deviation tally closed at rule1=1 rule3=2; Trigger 2 captured `fixed-limits-collide-with-autonomous-runs` (first live instinct). Full observations: docs/findings/live-pipeline-run-2026-08-20.md.

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
