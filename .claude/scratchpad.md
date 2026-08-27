# Scratchpad

## Feature: design-capability — design-engineering capability (design-reviewer agent runs Gate 8, design-foundation skill, templates/rules/design.md)

## Tier: full

## Branch: feat/design-capability

## Status: implementing wave 3 slices 6-7/8

## Plan

Full plan with all fields (verify commands, done-conditions, pre-review flags, revision notes):
`/private/tmp/claude-501/-Users-aleksei-Documents-Projects-nosync-claude-code-sdlc/97b082c8-0eea-45f6-80c0-bd50e6b3014a/scratchpad/design-capability-plan.md`
Research brief (vendored-content source, same dir): `design-capability-research-brief.md`
Feature: PRD §14. Docs: docs/use-cases/design-capability_use_cases.md (21 UCs),
docs/qa/design-capability_test_cases.md (128 TCs). Architecture: PASS with conditions (all folded
into PRD §14 + plan). Critic: 2 loops, 30 findings (8 BLOCKER, 10 WARNING, 12 INFO) — all
BLOCKER/WARNING fixed; loop 2 had zero BLOCKERs. Docs committed: 3c91342.
**AC-9 constraint: no reference to the user's private validation project in any tracked file** —
identifier check run by the orchestrator from session context, identifiers never written down.

### Wave 1 [COMPLETE]
- [x] Slice 1 (Tracer): design-reviewer stub + model-profiles row + install.sh 3 arms + six-source count consistency + 4.9.0 bump + 14000 ceiling + Gate 8 delegation (+179B of 577) — d155273. Verify PASSED: 6 red probes flipped green, model_for_role executed live (opus/opus/opus/inherit), sweep 18/18 validators + 26/26 suites (1409 checks). Architect pre-review: PASS, 5 action items all applied pre-commit (untrusted-data framing line, PRD ceiling/count reconciliation, 8 decorated-FIXTURE rows normalized + registered, plan Slices 6/8 lists corrected). Tracer gate: SATISFIED.
Slice 1 build-runner attempts: 1/3
Slice 1 red-phase: 6 pre-implementation probes → ALL FAILED as expected (see line above Wave 1)

### Wave 2 [COMPLETE — 4 parallel subagents, all PASS, post-wave orchestrator sweep green]
- [x] Slice 2: design-reviewer full evidence chain + FR-1.9 trust gate + vendored audit knowledge — 770446f, 10,431/14,000 B. Red: 4 refusal/registry strings absent pre-implementation (fallback line declared already-present from Slice 1). Security pre-review: 2 rounds (nested spawn) — round 1 FAIL with 3 BLOCKERs (ungated Playwright step, screenshot-command coverage, registry prefix-match bypass), round 2 PASS after fence-escape BLOCKER + fall-through retarget; all 7+3 findings fixed pre-commit. attempts 1/3, deviations (security,10) all rule2 free.
Slice 2 red-phase: refusal-string greps → FAILED (0 matches ×4) before implementation
NOTE for Gate 7/doc-updater: chain step 2 (Playwright) is now trust-gated — an addition vs FR-1.3's bare "Playwright available" wording, mandated by security pre-review under FR-1.9.4's never-unguarded-execution clause; align PRD wording at docs closure.
- [x] Slice 3: GATE_AGENTS fifth entry + test-stop-gate-evidence five-name assertions — 0ef46e1. Red: test-first, 7 five-name assertions failed against unchanged handler. Negative check (TC-S.25) reproduced red in scratch copy. attempts 1/3, deviations none.
Slice 3 red-phase: node tests/hooks/test-stop-gate-evidence.js → FAILED (7 assertions) before handler edit
- [x] Slice 4: templates/rules/design.md (8 sections, Preview trust note) — 0e5d392. Red: heading loop failed on nonexistent file. Security pre-review PASS (nested spawn worked), 3 WARNINGs fixed pre-commit. attempts 1/3, deviations (rule1,1)+(rule2,3).
Slice 4 red-phase: heading verify loop → FAILED (MISSING: Design System Source of Truth) before authoring
- [x] Slice 5: skills/design-foundation/SKILL.md + CEILINGS 6500 (measured 5470 +10% → next 500) in one commit — 85e20a5. Red: 7 skills/no ceiling captured pre-implementation. Architect pre-review PASS (nested spawn), 2 WARNINGs + 3 INFOs fixed pre-commit. attempts 1/3, deviations none. Handoff → Slice 7: bootstrap-feature's trigger line must pass an explicit unattended marker.
Slice 5 red-phase: validate-skills at 7 dirs + absent ceiling grep → captured pre-implementation

### Wave 3
- [ ] Slice 6: install.sh scaffold_cp for design.md + remaining count claims (sandboxed --local --no-plugin verify)
- [ ] Slice 7: bootstrap-feature conditional line (≤645B) + implement-slice one sentence (≤324B)

### Wave 4
- [ ] Slice 8: README/src/claude.md/CLAUDE.md budgets line/QA-row documentation closure

Deviation rule fires this feature: rule1=2 rule2=15 rule3=1 rule4=0
(rule2 #6-#15, from Slice 2's report: 10 security-review auto-adds on the trust gate — ungated-Playwright gating, per-command gate coverage, exact whole-line registry match, outcome splitting, fenced+labeled display, fence-escape closure, fall-through retarget, timeout bound, named targets, singular alignment. All free; rule2 instinct already captured this feature — same-feature recapture, no increment.)
(rule1 #2, from Slice 4's report: template first draft omitted the Aesthetic Direction heading — own verify loop caught it, free. rule1 threshold 2 reached → folded as a same-feature recapture of consumer-contract-check-before-review: both rule1 fires are the same author-against-literal-contract miss that instinct already records; no occurrence increment within one feature, no new slug minted.)
(rule2 #3-#5, from Slice 4's report: security-auditor WARNINGs on the template — grant-shaped implicature removed, trust/shape note rescoped to all declared commands, additive-only ban-list guard added; all free auto-adds pre-commit.)
(rule1 #1: orchestrator's own instinct capture wrote a 212-char Rule: line breaching D1's 200-char allowlist — caught by Slice 3's subagent sweep, regenerated at 192 chars, free.)
(rule2 #1: architect pre-review flagged the tracer stub reads project-supplied design.md with a Bash grant and no untrusted-data framing before Slice 2's trust gate — one guard sentence added, free.)
(rule2 #2: architect pre-review flagged 8 decorated-Kind QA rows ("FIXTURE (negative)" etc.) invisible to validate-fixture-manifest's literal Kind match — normalized to bare FIXTURE + 8 manifest entries added, free. rule2 threshold 2 reached → Trigger 2 instinct capture due at step 6.)
(rule3 #1: bootstrap docs commit 3c91342 broke validate-fixture-manifest — 55 FIXTURE TCs in the new QA doc unregistered; 12 of them misclassified (they invoke the design-foundation SKILL, reclassified→BEHAVIORAL by qa-planner), remaining 43 registered in tests/fixtures/manifest.json with fixture:null+note, folded into Slice 1's commit because the validator requires agents/design-reviewer.md to exist. 1 retry cost against Slice 1.)
Slice 1 red-phase: 6 probes (model_for_role arm, TABLE row, agent file, Gate 8 delegation grep, design.md referent grep, ceiling entry) → ALL FAILED as expected; sweep baseline green except the pre-existing fixture-manifest failure above.

## Version: last shipped **4.8.0** (2026-08-26, delivery-confirmed); this branch bumps to 4.9.0 in Slice 1 (bumped-not-tagged is the documented mid-development state).

**Install state, verified against the full `claude plugin list` (not inferred):** user 4.8.0, this
repo's project scope 4.8.0, `Restaba` 4.6.0 — live and one release behind, updatable with
`cd Restaba && claude plugin update claude-code-sdlc@claude-code-sdlc --scope project` (not done here:
outside this session's working directories). The five remaining `4.0.0` project rows are registry
entries for directories that no longer exist (`booka` plus four `/private/tmp` test projects); they
cannot be updated and are harmless — do not chase them ([[claude-cli-environment]]).
An earlier draft of this note called Restaba a broken 4.0.0 install. That was wrong: it was read off
the row count rather than the listing, which is the same mistake the eval instrument kept making.

## Blockers

(none for this feature)

## Plan (last completed feature — post-live-run-reconciliation, shipped as 4.6.0)

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

(historical: was "implementing wave 4 slice 8/8" at this point)

### Wave 4 [COMPLETE]
- [x] Slice 8: develop-feature + src/claude.md + README stale-text reconciliation — all greps pre-verified unique, parity validator green after each edit, full sweep 16/16 + 20/20 — b8cdf9b. attempts 0/3, no deviations.

(historical: feature reached "complete" here)

Gates: 9/9 — MERGE READY. Gate 2 PASS ×2 (main diff + replan commits); Gate 6 VERIFIED passed:true gaps:[] on attempt 2 (freshness confirmed 2026-08-20 21:24); Gate 8 N/A (no UI). Finalization: changelog 21:28 UTC written by orchestrator from doc-updater's composed text (the contract this feature shipped, used on itself). Instincts: counter 1→2, new capture manual-verification-must-be-persisted (Gate Auto-Fix from Gate 6), git-guard-chain-blindness re-stamped; no elevation (all general at 1 occurrence), no decay (Prevention Rules empty), no retirement.

Prior gate detail: 7/9 (Gate 0 PASS; Gate 1 PASS; Gate 3 PASS ×2 — main diff (all 15 conditions evidenced file:line; its double-enable observation verified PRE-EXISTING on main) and replan-commit re-audit (install.sh harness containment verified: --local/sandboxed HOME/temp cwd/absolute path/no --profile on all 4 runs, mock quoting safe, repo-untouched guard genuine); Gate 4 PASS — 16/16 + 20/20 (re-swept 22/22 after replan); Gate 5 PASS — both live probes green; Gate 7 PASS. Gates 2-rerun, 6-rerun running. Gate 8 N/A — no UI.)

Follow-up (below reporting bar, from Gate 3 rerun): tests/hooks/test-gitignore-hygiene.js inherits process.env wholesale — GIT_CONFIG_GLOBAL + HOME neutralize the config surfaces, but an exported XDG_CONFIG_HOME still points git at a developer's real ~/.config/git/ignore. Adding XDG_CONFIG_HOME: sandboxHome (and clearing GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE) closes it. Evidence-integrity hardening, not security; deliberately NOT committed mid-gate to avoid invalidating the in-flight Gate 2/3 re-reviews.
Gate 4 attempts: 1/3
Gate 6 attempts: 2/3 (attempt 1: PRESENT_BEHAVIOR_UNVERIFIED — 2 Level-4 gaps, both "ran once manually, not persisted". --gaps replan closed both: R1 a8be3e2 tests/hooks/test-gitignore-hygiene.js (15 checks, seeded-broken → 6 precise failures), R2 1576d70 tests/hooks/test-install-messaging.js (32 checks, 4 sandboxed install.sh runs, seeded-broken → exit 1) + README counts 16/22. Sweep 16/16 + 22/22. Attempt 2 running with Gates 2+3 re-run over the replan commits per the Auto-Fix Protocol.)

## Round 3 — what landed on this branch (all measured)

- **Context budget is now a hard cap** (`scripts/ci/validate-context-budget.js`, `--report`), the
  fourth budget alongside agents/skills/hooks. Ceilings are in BYTES because `claude plugin details`
  scores the INSTALLED cache, not the working tree — it cannot score a cut until after that cut has
  shipped, which is why this item sat unbuilt in the queue. Conversion measured across 9 components:
  **tokens ≈ bytes / 2.78** (`docs/findings/context-cost-calibration.md`). 12 checks, seeded-broken
  trees pinned to exact problem counts (1 and 3).
- **The multiplier nobody had counted.** `implement-slice` is paid once PER SLICE, so a byte there
  costs ~8x a byte in `merge-ready`. Weighted total for an 8-slice feature: **~147k tok** of
  instruction text. The first version of that table wrongly listed `verifier` as per-slice (it is
  Gate 6 only, once per feature) and overstated the total by ~44k — corrected by reading which agents
  each skill actually invokes, and the error is recorded rather than quietly fixed.
- **Progressive disclosure: BOTH halves now measured.** Cost — a 20 KB sibling file moved neither the
  always-on (~1,155) nor the on-invoke (~920) number; only `SKILL.md` is charged. Behaviour — an agent
  told to read a sibling file did so **3/3** (`scratchpad/probe-sibling-read.sh`; cache restored and
  verified byte-identical). This makes `implement-slice`'s `### 6. Capture Instincts` (7,908 of 23,176
  bytes, 34%, ~22.8k tok/feature for a step that usually no-ops) the **top queued item**.
  **Still deliberately not shipped:** the probe asked an idle agent to echo a token, not a mid-slice
  agent to follow a 7.9 KB procedure after a commit under load. Ship it fail-visible (the step says
  plainly it could not read its procedure) with the trigger tests kept inline, as its own change with
  its own verification.
- **merge-ready cut by 1,190 bytes** — a war story already told in CLAUDE.md, a third copy of a
  residual-risk record already in PRD FR-4.7, one C2 meta-justification, and 3 of 4 restatements of
  the shrink-guard rationale (the imperative survives verbatim at every point of use).
- **Eval instrument: two more traps found, both fixed.** (3) A killed run is now
  `INCONCLUSIVE — run errored, not graded`: a 240s timeout under `maxTurns: 10` had produced two
  confident behavioural failures whose real cause was the ETIMEDOUT line beneath them. `timeoutSeconds`
  must be raised whenever `maxTurns` is. (4) **Headless `claude -p` has no Agent tool** — a run said so
  outright and produced the full-tier deliverables inline. No deny rule exists in settings; it is a
  property of the mode. Any grader expecting a spawned agent measures the sandbox.
- **New `any_of` grader combinator.** The full-tier branch mandates the Phase 1 DELIVERABLES and names
  the agents that produce them — it never mandates a literal skill invocation. The run scored as a
  routing failure had complied. 41 grader checks, mutation-tested (forcing `pass: true` trips the
  seeded-broken check).

- **Eval baseline: 15/15 runs green across all 6 cases** under the current graders
  (`node scripts/eval/history.js`, which reports the current grader fingerprint only and refuses to
  average across versions — 34 earlier results excluded on that basis). Recorded in `evals/README.md`
  because `evals/results/` is gitignored.
- **Instrument fixes this round:** killed runs are INCONCLUSIVE, not graded; `any_of` combinator for
  rules satisfiable more than one way; refusals assert the forbidden write was never ATTEMPTED (a
  `not_contains` grader passed vacuously whenever the sandbox denied the write — a green that was not
  evidence); tier patterns tolerate markdown emphasis; the quick-tier decision is graded by effects,
  not narration; near-miss diagnostics print `⚠ NEAR MISS` when a relaxed grader would have passed;
  every case is audited for a positive assertion so none can pass on a dead run.

**Running tally: ten false negatives from the eval, zero true findings from a grader bug.** The
harness has been right every time. Carry that calibration into reading any eval failure.

## Project-level notes carried over
- **Behavioural eval shipped (2026-08-24).** `node scripts/eval/run-evals.js`. Baseline: **4/4 Triage
  cases pass**. Grading logic unit-tested free in the sweep (30 checks, 8 seeded-broken). Read
  `evals/README.md` before believing a failure — two instrument bugs produced confident false results
  before the first true baseline.
- **Round 2 shipped (2026-08-26, 4.7.0):** (1) discriminating-evidence contract — a test must be
  observed FAILING before the change, or the green first run must be DECLARED; pinned by
  `validate-red-phase-contract.js` + seeded fixture (3 problems). (2) `maxTurns` backstops on all 15
  agents (100 heavy / 60 producers), sized from the 85-record corpus (median 19, p90 53, max 81);
  `validate-agents` now requires it and rejects < 40 — measured: a too-tight bound yields a confident
  preamble with zero work done. (3) step-repetition detection in `hooks/lib/repetition.js` (free
  against the 12-handler ceiling), surfaced in wave records and read by develop-feature step 1a as
  check (d); 23 paired unit checks + end-to-end hook run.
- **Evidence-ranked improvement queue** (all measured; `docs/findings/harness-optimization-research.md`):
  (4) confidence signal at plan time (Devin: green ≈ 2× merged-PR likelihood vs red) — NOT built;
  (5) context-tax reduction — NOT built, still gated: the section map found ~3.2k tok of movable
  rationale in merge-ready and ~2.6k in develop-feature, but EVERY eval case grades Triage only, so
  a cut there is invisible to the instrument (~93k tok of skill text per 8-slice feature is the prize).
  Extend eval coverage to the gate surfaces FIRST, then cut, then re-measure with `claude plugin details`.
- **Documented anti-patterns — do not "improve" into these:** multi-agent debate on the GENERATION
  path (−1.6 to −15.5pp), full-file context (−5.3pp), raw iterative search (worse than no search at
  all), repository-overview prose in instruction files (+20% cost, no success gain).
- **Compaction schema still uncaptured.** `pre:compact:probe` has never fired (re-confirmed unknown on 2.1.237).

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
