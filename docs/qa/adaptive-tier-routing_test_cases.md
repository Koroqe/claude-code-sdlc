# Test Cases: Adaptive Tier Routing and Model Routing

> Based on [PRD](../PRD.md) — Section 10 and [Use Cases](../use-cases/adaptive-tier-routing_use_cases.md)

---

## 1. Testing Approach and Test-Kind Classification

**System context:** this feature has two halves with genuinely different testability. The **triage/escalation/execution half** (FR-1 through FR-6) lives entirely in the orchestrating model's own behavior — restated classification signals in `skills/develop-feature/SKILL.md` and `src/claude.md`, tier-branching prose in `skills/bootstrap-feature/SKILL.md`, `skills/implement-slice/SKILL.md`, `skills/merge-ready/SKILL.md`, and a Quick-Tier Contract mode added to `agents/planner.md`. Observing it requires either invoking one named subagent against a crafted input (FIXTURE) or driving the top-level orchestrating session through a real request-response turn (BEHAVIORAL) — there is no scripted stand-in for either in this repository today, exactly as `verification-review-upgrade_test_cases.md` found for its own agent/skill-prompt subject matter. The **model-routing half** (FR-7 through FR-11, FR-13) is different in kind: `install.sh --profile` is a real, syntax-checkable shell script producing real file diffs; `scripts/ci/validate-model-profile.js` is real, zero-dependency Node following this repo's existing `core.run`/`Validator`/`--expect-failure` pattern (verified present at HEAD in `scripts/ci/lib/validate-core.js`); `templates/statusline.js` is a real Node script that reads stdin JSON and a scratchpad file and prints one line to stdout. All three can be exercised by spawning a real process against a fixture or scratch checkout — zero LLM/agent invocations required. This is why F4's STATIC share is materially higher than a prompt-only feature's: the artifacts under test are not all prose.

Every test case below is classified into exactly one of three kinds, stated as its own column:

- **STATIC** — assertable by reading a file or running a shell command against the repository (or a scratch checkout / temp fixture directory derived from it), with zero LLM/agent invocations. This covers both simple greps/file reads (e.g., confirming `skills/sdlc-fast/SKILL.md`'s `allowed-tools` line) **and** real process execution (e.g., running `bash install.sh --local --profile budget` against a scratch checkout and inspecting `git diff --stat`, or running `node scripts/ci/validate-model-profile.js` against a fixture and inspecting its exit code and `--expect-failure` substring match, or piping a fixture stdin JSON into `node templates/statusline.js` and inspecting stdout). **STATIC is runnable in this repository's CI today, once this feature ships** — the validator pattern, the `--expect-failure` convention, and the Node setup step already exist at HEAD; no new harness is required, only the feature's own implementation. Every STATIC test case below carries the implicit precondition "implementation complete," mirroring `model-tier-optimization_test_cases.md`'s own convention for the same reason.
- **FIXTURE** — assertable by invoking exactly **one** named subagent (`planner` under its Quick-Tier Contract or digest-index-consultation mode, `code-reviewer`, `security-auditor`, `test-writer`, or `doc-updater`) against a crafted input, and inspecting that single agent's own returned output or its own tool-call trace for that turn. **FIXTURE is not automatable in this repository's CI today** — there is no scripted mechanism here to invoke a Claude agent headlessly and capture its output for assertion. Fixtures are specified precisely enough (input named, expected output/trace stated) that a human reviewer, or a future eval harness, can run them exactly as written.
- **BEHAVIORAL** — only observable by driving the top-level orchestrating session (`/develop-feature` Phase 0 onward, the unprefixed-request Triage restatement, `/sdlc-fast`/`/sdlc-quick`, or a fresh post-compaction session reading `.claude/scratchpad.md`) through a real multi-step turn and observing the aggregate outcome — the stated tier/reason before any `Edit`/`Write` call, escalation statements, scratchpad field values, gate-table contents, commit/changelog counts. **BEHAVIORAL is not automatable in this repository's CI today** — driving the orchestrator means driving the top-level model itself through several turns; there is no scripted driver for that here. A small subset of BEHAVIORAL cases (flagged individually below) are additionally **one-time investigative spikes** (FR-7.6, FR-13.4) rather than repeatable regression tests — they are run once, by a human, to record a finding in a header comment, not re-run per change.

No test case in this document disguises a BEHAVIORAL or FIXTURE check as if it ran in CI. Where a check is timing-dependent or otherwise cannot be deterministically scripted with the tooling this repository ships (the mid-commit-pass interruption case, UC-14-A1, is the clearest example), that limitation is stated at the test case itself, not smoothed over.

---

## 2. Reference (Non-Test): Tiers, Signals, and the Model Profile Table

Restated from the PRD/use-case documents only for this document's own readability — not itself a test.

**Tiers and direction (FR-1, FR-2):** `fast` → `quick` → `full`, one-way only; `full` is the ceiling (FR-2.5); a tier once assigned is never automatically lowered (FR-2.6).

**FR-1.3 (`full`-forcing, checked first, skips FR-1.4/FR-1.5 entirely):** (a) new endpoint/page/integration; (b) schema/migration change; (c) auth/payment/billing keyword or sensitive-path overlap; (d) estimated file set `>3`.

**FR-1.4 (`fast`):** ALL of — exactly 1 file; AND one of (spelling/grammar fix, single hardcoded literal with no logic change, comment-only edit, dependency-version bump with no source change).

**FR-1.5 (`quick`):** not forced `full`, not `fast`; 1–3 files; one bounded, already-understood behavior (known-cause bug, missing validation, small utility, existing-behavior adjustment); no new flow/component.

**FR-1.6 (tie-break):** anything not cleanly `fast`/`quick`/forced-`full` is `full` — including anything the model cannot confidently place. Ambiguity always resolves upward.

**FR-1.7 (sensitive paths, union):** fixed default (`auth`, `payment`, `billing`, `secret`, `migration` path segments case-insensitive; `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`) is always active; a project's `.claude/rules/security.md` `## Sensitive Paths` section adds to it, never replaces or narrows it.

**FR-8.1 model profile table (exact):**

| Role | `quality` | `balanced` | `budget` | `inherit` |
|---|---|---|---|---|
| architect | opus | opus | sonnet | inherit |
| plan-critic | opus | sonnet | sonnet | inherit |
| planner | opus | opus | sonnet | inherit |
| security-auditor | opus | opus | opus | inherit |
| ba-analyst | sonnet | sonnet | sonnet | inherit |
| build-runner | sonnet | haiku | haiku | inherit |
| code-reviewer | sonnet | sonnet | sonnet | inherit |
| doc-updater | sonnet | haiku | haiku | inherit |
| e2e-runner | sonnet | sonnet | sonnet | inherit |
| prd-writer | sonnet | haiku | haiku | inherit |
| qa-planner | sonnet | sonnet | sonnet | inherit |
| refactor-cleaner | sonnet | sonnet | haiku | inherit |
| test-writer | sonnet | sonnet | haiku | inherit |
| verifier | sonnet | sonnet | sonnet | inherit |

`quality` == shipped baseline (FR-8.2). Under `budget`, 8 of 14 roles change: `architect`, `plan-critic`, `planner` (opus→sonnet); `build-runner`, `doc-updater`, `prd-writer`, `refactor-cleaner`, `test-writer` (sonnet→haiku). The other 6 (`security-auditor`, `ba-analyst`, `code-reviewer`, `e2e-runner`, `qa-planner`, `verifier`) are identical under `budget` and `quality`.

**FR-11.2 `effort:` table (exact, fixed per role, never profile-dependent):** low(3) = `build-runner`, `doc-updater`, `prd-writer`; medium(6) = `ba-analyst`, `code-reviewer`, `e2e-runner`, `qa-planner`, `refactor-cleaner`, `test-writer`; high(5) = `architect`, `planner`, `security-auditor`, `plan-critic`, `verifier`.

---

## 3. UC-1: Fast-Tier Classification

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-1.1 | UC-1 Primary Flow, AC-1 | BEHAVIORAL | Single-file typo fix → `tier: fast`, reason stated before any Edit | A fresh `/develop-feature` Phase 0 (or unprefixed-request Triage) turn against "fix the typo 'recieve' to 'receive' in README.md" | Submit the request; capture the response text preceding the first `Edit`/`Write` tool call | Response states the estimated file set `{README.md}` and the literal string `tier: fast` plus an FR-1.4 reason, both before the `Edit` call; the transcript shows zero `Agent` tool calls for classification itself. Not automatable in CI today — requires a live orchestrator turn |
| TC-1.2 | UC-1-A1 | BEHAVIORAL | Single hardcoded literal, no logic change → `fast` | Request: "bump the retry timeout constant from 3000 to 5000 in `src/config.ts`" | Submit; capture pre-Edit response text | `tier: fast` stated with FR-1.4(b)'s literal-only-change reason. Not automatable in CI today |
| TC-1.3 | UC-1-A2 | BEHAVIORAL | Dependency-version bump requiring no source change → `fast` | Request: "bump `lodash` from 4.17.20 to 4.17.21 in `package.json`" | Submit; capture pre-Edit response text | `tier: fast` stated with FR-1.4(b)'s dependency-bump reason. Not automatable in CI today |
| TC-1.4 | UC-1-EC1 | BEHAVIORAL | A 1-file request with a logic change riding along does NOT qualify `fast` | Request: "fix the typo in the discount calculation, and while you're in there also correct the off-by-one in the loop" | Submit; capture pre-Edit response text | Response does NOT state `tier: fast` — FR-1.4(b)'s "no accompanying logic change" clause fails despite the 1-file count; the request is instead evaluated against FR-1.5/FR-1.6 (cross-reference TC-3.3 for the sibling judgment-clause case). Not automatable in CI today |
| TC-1.5 | FR-1.1 (structural, dual-definition parity) | STATIC | `skills/develop-feature/SKILL.md`'s Phase 0 and `src/claude.md`'s Triage restatement state identical classification signals | Both files exist | Grep both files for the FR-1.3(a)–(d), FR-1.4(a)–(b), FR-1.5, and FR-1.6 signal text | Both files state matching signal text for all four requirements — a hand-drift between the two copies (an accepted, named risk per 10.10 Risk 1's sibling framing, not mechanized by this feature) is at least caught by a direct diff at test-authoring/review time |

---

## 4. UC-2: Full-Tier Classification

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-2.1 | UC-2 Primary Flow, AC-1 | BEHAVIORAL | New API endpoint → `tier: full`, forced immediately | Request: "add a POST `/api/webhooks/stripe` endpoint" | Submit; capture pre-Edit response text | `tier: full — FR-1.3(a)` (or equivalent verbatim reason) stated before any `Edit`/`Write` call; `/bootstrap-feature` is the next invocation, not a direct `Edit`. Not automatable in CI today |
| TC-2.2 | UC-2-A1 | BEHAVIORAL | Schema/migration change → `full` via FR-1.3(b); a schema migration provably cannot reach `fast` regardless of file count | Request: "add a `deleted_at` column to the `users` table" (1-file estimated set) | Submit; capture pre-Edit response text | `tier: full` stated with the FR-1.3(b) reason; the response explicitly shows FR-1.3 was checked and matched BEFORE FR-1.4 was evaluated at all — proving the 1-file count is irrelevant once FR-1.3(b) matches, i.e. a schema migration cannot reach `fast` no matter how small the file set. Not automatable in CI today |
| TC-2.3 | UC-2-A2 | BEHAVIORAL | Sensitive-path overlap forces `full` even on a 1-file, literal-only-looking edit | Request: "update the timeout value in `install.sh`" | Submit; capture pre-Edit response text | `tier: full` stated with the FR-1.3(c)/FR-1.7 sensitive-path reason, despite the request otherwise matching TC-1.2's `fast` shape (1 file, literal-only). Not automatable in CI today |
| TC-2.4 | UC-2-A3 | BEHAVIORAL | Estimated file set `>3` → `full` via FR-1.3(d), absent any other signal | Request: "refactor the widget module: update `src/widgets/service.ts`, `src/widgets/repo.ts`, `src/widgets/types.ts`, `src/widgets/index.ts`" | Submit; capture pre-Edit response text | `tier: full` stated with the FR-1.3(d) file-count reason. Not automatable in CI today |
| TC-2.5 | UC-2-EC1 | BEHAVIORAL | Multiple FR-1.3 signals firing at once still resolve to a single `full` classification | Request that is both a new endpoint AND touches billing logic | Submit; capture pre-Edit response text | `tier: full` stated, citing whichever FR-1.3 subclause the orchestrator identifies first — precedence among subclauses is immaterial since all resolve identically. Not automatable in CI today |
| TC-2.6 | UC-2-EC2, AC-31 | BEHAVIORAL | A trivial declared `## Sensitive Paths` section cannot narrow the fixed default — union semantics | Fixture project: `.claude/rules/security.md` declares `## Sensitive Paths` with only `docs/marketing/**` listed. Request: "update the session-expiry check in `src/auth/login.ts`" | Submit against the fixture project; capture pre-Edit response text | `tier: full` stated, citing FR-1.3(c) via the FIXED DEFAULT's `auth` path-segment match — NOT the project's own (non-matching) declared entry — identical to the outcome had no `## Sensitive Paths` section existed at all. This is the required negative/false-positive proof that a narrow/trivial declaration cannot suppress default protection. Not automatable in CI today |

---

## 5. UC-3: Genuinely Ambiguous Classification — the Tie-Break Rule

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-3.1 | UC-3 Primary Flow | BEHAVIORAL | Root cause not confidently known → `full` via the FR-1.6 upward tie-break | Request: "users occasionally report the dashboard shows stale numbers after a refresh — can you take a look and fix it?" | Submit; capture pre-Edit response text | `tier: full — FR-1.6` (or equivalent) stated, explicitly citing "cannot confidently place in fast or quick" — never a guess at `quick`, never a stall asking which tier to use. Not automatable in CI today |
| TC-3.2 | UC-3-A1 (contrast case) | BEHAVIORAL | Same domain, root cause explicitly stated → `quick`, not `full` | Request: "the dashboard cache TTL is wrong in `dashboardCache.ts` — bump it to 60 seconds" | Submit; capture pre-Edit response text | `tier: quick` stated with an FR-1.5 reason — proves the tie-break fires on ambiguity specifically, not on topic; the presence of a confidently-known root cause is what moves the tier. Not automatable in CI today |
| TC-3.3 | UC-3-EC1 | BEHAVIORAL | A judgment clause disqualifies an otherwise-1-file request from BOTH `fast` and confident `quick` placement, landing on `full` via the tie-break | Request: "bump the retry timeout constant from 3000 to 5000 in a single file, but also double check the retry logic still makes sense" | Submit; capture pre-Edit response text | Response does not state `tier: fast` (FR-1.4(b) fails on the judgment clause) and, if the orchestrator cannot confidently place it in `quick` either, states `tier: full — FR-1.6`. Not automatable in CI today |

---

## 6. UC-4: Fast-Tier Execution

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.1 | UC-4 Primary Flow, AC-2 | BEHAVIORAL | A `fast`-tier single-line config change produces zero documentation, one commit, one changelog entry, and correctly does NOT escalate | A fresh feature branch; a request satisfying TC-1.1's `fast` classification | Run the request to completion; inspect `docs/PRD.md`, `docs/use-cases/*`, `docs/qa/*`, `git log`, `CHANGELOG.md`, `.claude/scratchpad.md` | Zero new/modified files under `docs/PRD.md`/`docs/use-cases/*`/`docs/qa/*`; `git log` shows exactly one new commit on the feature branch; `CHANGELOG.md` gains exactly one new entry under today's date; `.claude/scratchpad.md` is absent or unmodified (no escalation occurred). This is also the required negative/false-positive case: **a `fast` run that correctly does NOT escalate.** Not automatable in CI today |
| TC-4.2 | UC-4-E1 | BEHAVIORAL | Typecheck/build fails after the sole edit, resolved in-place under Rule 1/Rule 3 without touching a second file | A `fast`-tier run whose edit introduces a typo/import error the build catches | Run to completion, allowing the auto-fix protocol to act | The fix is applied within the same single file; the run completes as `fast` tier (TC-4.1's postconditions), never escalating, since no second file was touched. Not automatable in CI today |
| TC-4.3 | UC-4-EC1 | BEHAVIORAL | A build failure whose fix requires touching a second file triggers UC-6's escalation, not a `fast`-tier error path | A `fast`-tier run whose build failure cannot be resolved without editing a second file | Run to completion | The run escalates to `quick` per FR-2.1 mechanics (cross-reference TC-6.1) rather than attempting the second-file edit under `fast`-tier discipline. Not automatable in CI today |

---

## 7. UC-5: Quick-Tier Execution

**Rationale under test (FR-4.8):** Gates 2/3/4 survive the reduction because they review the diff itself or are deterministic, independent of any PRD/use-case/QA artifact — keeping them is what stops `quick` from being a synonym for "unreviewed." The carve-out mechanism (step 7 of the use case) is what lets those three gates run without dead-ending on a documentation absence that is by design.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-5.1 | UC-5 Primary Flow | BEHAVIORAL | Full quick-tier loop end to end: one `planner` call, one plan slice, reduced gate subset, `MERGE READY` | A request classified `quick` (TC-3.2) | Run through `/implement-slice` and `/merge-ready` to completion; capture the full transcript and final gate table | Exactly 1 `Agent` call to `planner` for this feature (transcript-countable); `.claude/scratchpad.md` shows `## Tier: quick`, one un-waved slice with no `**Tracer:** yes` marker and no `Wave:` fields; zero files under `docs/PRD.md`/`docs/use-cases/*`/`docs/qa/*`; `/merge-ready`'s gate table shows Gate 1, 5, 6, 7, 8 = `SKIPPED (tier: quick)` and Gates 0, 2, 3, 4 = PASS; `MERGE READY` is reached. Not automatable in CI today |
| TC-5.2 | FR-4.1 | FIXTURE | `planner`'s Quick-Tier Contract, given a plain description and no PRD/use-cases/QA/architecture-review input, returns exactly one marker-free slice | Direct `planner` invocation with a plain feature/fix description string, no other input supplied | Invoke `planner` under the Quick-Tier Contract mode | Returned output is exactly one slice in the standard `Files:`/`Changes:`/`Verify:`/`Done when:` format; no `**Tracer:** yes` marker anywhere; `planner` issues zero `Write`/`Edit` tool calls (it has none — AC-22) |
| TC-5.3 | UC-5-A1 | BEHAVIORAL | Quick tier reached via fast→quick escalation includes the already-touched file(s) in the single slice as completed work | Continuing from a fast→quick escalation (TC-6.1) | Inspect the resulting `.claude/scratchpad.md` `## Plan` slice | The slice's `Files:`/`Changes:` fields list the already-edited file(s) as already-done work, not re-planned or re-implemented. Not automatable in CI today |
| TC-5.4 | UC-5 Primary Flow step 7, AC-25 | STATIC | Gate 2's and Gate 3's delegation prompts to `code-reviewer`/`security-auditor` state the PRD/use-case/QA-absence carve-out verbatim, and it appears BEFORE the review request itself | `skills/merge-ready/SKILL.md` exists | Read Gate 2's and Gate 3's delegation-prompt template text; confirm ordering | The carve-out sentence ("no `docs/PRD.md` section, `docs/use-cases/*`, or `docs/qa/*` file exists for this change by design and MUST NOT be reported as a finding") is present verbatim and textually precedes the diff/request content in the template |
| TC-5.5 | AC-25 | FIXTURE | `code-reviewer`, given the carve-out plus a `quick`-tier diff, does NOT flag the missing-QA-doc checklist item | Delegation prompt containing TC-5.4's carve-out verbatim, followed by a clean diff, with no `docs/qa/*` file present in the project | Invoke `code-reviewer` with this prompt | Issues list contains no finding referencing missing `docs/qa/`/PRD/use-case documentation |
| TC-5.6 | AC-25 | FIXTURE | `security-auditor`, given the identical carve-out, does NOT flag the same absence | Delegation prompt mirroring TC-5.5 for `security-auditor` | Invoke `security-auditor` with this prompt | Findings list contains no PRD/use-case/QA-absence finding |
| TC-5.7 | UC-5-E1 (defect-proof) | FIXTURE | Absent the carve-out, `code-reviewer` DOES flag the absence, proving the carve-out (TC-5.4/5.5) is load-bearing, not incidental | Delegation prompt identical to TC-5.5's diff, but with the carve-out sentence removed | Invoke `code-reviewer` with this prompt | Issues list contains a finding for the missing `docs/qa/` test cases (`agents/code-reviewer.md`'s existing checklist item firing normally) — demonstrating that without step 7's stated carve-out, this exact failure class (unfixable by the Auto-Fix Protocol, since creating the QA file would violate `quick` tier's own design) would occur |
| TC-5.8 | FR-4.4, AC-26 | STATIC | `/implement-slice` Step 2's delegation to `test-writer` states the QA-file-absence carve-out verbatim for a `quick`-tier run | `skills/implement-slice/SKILL.md` exists | Read Step 2's delegation-prompt template for the `## Tier: quick` branch | The carve-out sentence ("no `docs/qa/<feature>_test_cases.md` file exists for this change by design and MUST NOT be treated as a missing input") is present verbatim |
| TC-5.9 | AC-26 | FIXTURE | `test-writer`, given the carve-out and a slice's `Verify:`/`Done when:` fields but no QA file, derives tests from those fields rather than reporting a missing input | Delegation prompt with TC-5.8's carve-out, a slice with concrete `Verify:`/`Done when:` text, no `docs/qa/*` file in the project | Invoke `test-writer` with this prompt | Written tests operationalize the slice's own `Verify:`/`Done when:` conditions; no report of a missing QA input |
| TC-5.10 | UC-5-EC1, AC-5 | BEHAVIORAL | A `quick`-tier run that in fact touched only 1 file still reports Gates 1/5/6/7/8 SKIPPED — never silently relabeled `fast` | A quick-tier run whose single slice touches exactly 1 file | Run to completion; inspect the `/merge-ready` gate table and `.claude/scratchpad.md`'s `## Tier:` value | `## Tier:` still reads `quick` (unchanged from classification); gate table still shows Gates 1/5/6/7/8 = `SKIPPED (tier: quick)`, regardless of the run's actual simplicity. Not automatable in CI today |
| TC-5.11 | UC-5-EC2, AC-27 | STATIC | `skills/implement-slice/SKILL.md` states the exact tier-aware tracer-gate notice string | `skills/implement-slice/SKILL.md` exists | Read the tracer-gate check section | The exact string `tracer gate inactive — tier: quick, single-slice plan is exempt from the tracer requirement by design.` is present; the legacy "treating as pre-F3 plan" wording is stated as reserved for `## Tier:` absent-or-`full` plans only |
| TC-5.12 | AC-27 | BEHAVIORAL | A live `quick`-tier single-slice plan prints the tier-aware notice, never the legacy pre-F3 wording | A quick-tier plan with no `**Tracer:** yes` marker, `## Tier: quick` | Run `/implement-slice` against it | Output contains TC-5.11's exact tier-aware string; the legacy pre-F3 string does not appear. Not automatable in CI today |
| TC-5.13 | AC-24 | BEHAVIORAL | Exactly one `CHANGELOG.md` entry for a quick-tier feature, never two | A completed quick-tier run | Inspect the transcript for the `/implement-slice` invocation's arguments; inspect `CHANGELOG.md` after `/merge-ready` Finalization | The `/implement-slice` invocation was made with the literal `no-changelog` token; exactly one `CHANGELOG.md` entry exists for the feature, and it is the one `/merge-ready`'s Finalization step wrote (not an earlier, differently-named standalone entry). Not automatable in CI today |
| TC-5.14 | AC-24 (defect-proof) | BEHAVIORAL | Omitting the `no-changelog` token produces two changelog entries under different names, uncaught by the name-keyed idempotency guard | A quick-tier run where `/implement-slice` is (deliberately, for this test) invoked WITHOUT the `no-changelog` token | Run to completion; inspect `CHANGELOG.md` | Two entries exist: one written by `/implement-slice` Step 6 under its own standalone-fix name, one written by `/merge-ready` Finalization under the feature's own name — proving the exactly-once rule is violated precisely because the two names differ and the idempotency guard (keyed on name) cannot catch it. This is the specific defect FR-4.3's mandatory-token language exists to prevent. Not automatable in CI today |
| TC-5.15 | FR-4.8 | STATIC | `skills/merge-ready/SKILL.md` states the rationale for why Gates 2, 3, 4 survive the reduction | `skills/merge-ready/SKILL.md` exists | Read the Tier Check preamble section | Text states Gate 2/Gate 3 review the diff itself (not a documentation artifact) and Gate 4 is deterministic, and that skipping them would make `quick` a synonym for "unreviewed" |

---

## 8. UC-6: Fast → Quick Escalation

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-6.1 | UC-6 Primary Flow, AC-3 | BEHAVIORAL | A second file discovered mid-edit triggers a stated escalation before the second `Edit` call | A `fast`-tier run editing `README.md` (sole estimated file) discovers `docs/glossary.md` also needs the correction | Continue the run to the point the second file's `Edit` would be made; capture the response text immediately preceding that call | The response states, verbatim, that escalation from `fast` to `quick` is occurring and names `docs/glossary.md`, BEFORE that file's `Edit` call is made; `README.md`'s already-made edit remains, unreverted; `.claude/scratchpad.md` afterward shows `## Tier: quick`. Not automatable in CI today |
| TC-6.2 | UC-6-A1 | BEHAVIORAL | A sensitive-path discovery triggers escalation even with file count still at 1 | A `fast`-tier run whose sole estimated file turns out, on inspection, to be `install.sh` | Continue the run to the point of the `Edit` call on `install.sh` | The response states the escalation and names `install.sh` as a fixed-default sensitive path, before the `Edit` call — the file-count clause never grew past 1; the sensitive-path clause alone triggers it. Not automatable in CI today |
| TC-6.3 | UC-6-EC1, FR-2.7 | STATIC | No hook mechanically checks `Edit`/`Write` call counts or target paths against the declared tier — confirming the named enforcement gap is real, not silently closed | `hooks/hooks.json`, `hooks/handlers/*.js` | Grep both for any handler keyed on tier, edit-count, or a per-response path-vs-tier comparison | No such mechanism exists anywhere in the repo — confirms the gap 10.10 Risk 1 names is real and accepted, not mitigated by an undocumented mechanism. This test case's pass condition is confirming the absence, not asserting a guarantee that does not exist (mirrors `verification-review-upgrade_test_cases.md` TC-5.5's precedent) |

---

## 9. UC-7: Quick → Full Escalation — the Tier-Rewrite-Ordering Assertions

**Why this section is load-bearing:** the architect named the tier-rewrite-before-`/bootstrap-feature` ordering (FR-2.4(c)) and `/sdlc-fast`'s `Agent` tool grant (FR-6.1, Section 11 below) as the two assertions the escalation mechanism's own Critical Findings 1 and 2 fixes exist to protect. A stale `## Tier: quick` surviving an escalation, or re-surfacing after a compaction, silently skips Gates 1, 5, 6, 7, and 8 on a feature this FR explicitly requires to get all nine.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-7.1 | UC-7 Primary Flow, AC-4 | BEHAVIORAL | Rule 4 mid-TDD → escalate to `full`, never stop-and-ask; the tier rewrite happens BEFORE `/bootstrap-feature` is invoked | A `quick`-tier TDD cycle reveals a need for a new npm dependency (a Rule 4 condition) | Continue the run through escalation; capture the transcript's ordering of (a) the `## Tier:` scratchpad write and (b) the `/bootstrap-feature` invocation | The response states, verbatim, escalation to `full` and names the Rule 4 condition — the run does NOT stop and ask; the already-committed quick-tier slice remains; the transcript shows the `.claude/scratchpad.md` `## Tier:` rewrite to `full` STRICTLY BEFORE the `/bootstrap-feature` `Agent`/skill invocation; the resulting plan marks the already-satisfied slice DONE with its existing commit hash; the run concludes through a full 9-gate `/merge-ready` with Gates 1, 5, 6, 7, 8 actually reporting PASS/FAIL, never `SKIPPED (tier: quick)`. Not automatable in CI today |
| TC-7.2 | UC-7-EC2, AC-4 — the compaction-survival proof | BEHAVIORAL | `## Tier: full` survives a context compaction with `session:start:spine` re-injection, immediately after escalation | Immediately following TC-7.1's tier-rewrite step (before any further gate/agent invocation), simulate a context compaction: begin a fresh session with `.claude/scratchpad.md` as the only persisted state (no conversation memory of the escalation having occurred) | Instruct the fresh session to resume; observe what `session:start:spine`'s state re-injection reports for the tier | The fresh session reads `## Tier: full` from the scratchpad — NEVER the pre-escalation `quick` value. This is the specific, named postcondition of FR-2.4(c)/FR-2.8: nothing downstream, including a post-escalation compaction, can observe the pre-escalation tier. Not automatable in CI today — requires a manually simulated compaction boundary |
| TC-7.3 | UC-7-EC2 (regression-proof counterfactual) | BEHAVIORAL | A scratchpad hand-seeded to still read `## Tier: quick` after an escalation was already stated (simulating the ordering defect FR-2.4(c) exists to prevent) causes a live `/merge-ready` run to read `quick` and wrongly report Gates 1/5/6/7/8 SKIPPED | A hand-crafted `.claude/scratchpad.md`: conversation history shows an escalation-to-`full` statement was made, but the file's `## Tier:` field still reads `quick` (simulating step 5 of the mechanics having been skipped or deferred past `/bootstrap-feature`) | Run `/merge-ready` against this fixture project | The Tier Check preamble reads `quick` and the gate table reports Gates 1, 5, 6, 7, 8 as `SKIPPED (tier: quick)` on a feature that was supposed to be `full` — proving this exact regression (the one Critical Finding 1 identified and FR-2.4(c)/FR-2.8 fix) would be caught by this test if the ordering fix were ever reverted. Not automatable in CI today |
| TC-7.4 | UC-7-A1, AC-23 | BEHAVIORAL | FR-2.2(b)'s sensitive-path trigger fires independent of any Rule 4 condition | A `quick`-tier "add a missing validation" run (1-file estimated set) discovers mid-fix the validation must live in auth middleware | Continue the run to the point the `Edit` call on the sensitive path would be made | The response states the escalation, naming the sensitive path (not any Rule 4 category) as the trigger; identical FR-2.4 mechanics apply — `## Tier:` rewritten to `full` before `/bootstrap-feature` runs; run concludes at full 9-gate `/merge-ready`, matching AC-4's postconditions. Not automatable in CI today |
| TC-7.5 | UC-7-A1 (file-count variant) | BEHAVIORAL | FR-2.2(b)'s file-count trigger (touched-file count would exceed 3) fires identically, citing the file-count trigger by name | A `quick`-tier run whose 4th distinct `Edit`/`Write` target is about to be touched | Continue to the point of the 4th file's `Edit` call | The response states the escalation, citing the file-count trigger explicitly (not a path); identical FR-2.4 mechanics as TC-7.4. Not automatable in CI today |
| TC-7.6 | UC-7-EC1 | BEHAVIORAL | Escalation hit before any quick-tier commit exists — FR-2.4(b)/(e) are vacuously satisfied, not skipped | A quick-tier run whose Rule 4 condition (or FR-2.2(b) trigger) fires during the FIRST slice's TDD cycle, before any commit | Continue through escalation | Steps 3 (state escalation), 5 (tier rewrite before `/bootstrap-feature`), 6 (`/bootstrap-feature` invoked), and 8 (full gate run) all still occur; step 7 (mark an already-satisfied slice DONE) has nothing to mark and is correctly a no-op, not a skipped step. Not automatable in CI today |

**Note (Rule 4 category parity, not separately counted):** UC-7's Alternative Flow states that any of the four Rule 4 examples (new dependency, API contract change, schema migration, module-boundary restructuring) resolves through identical FR-2.4 mechanics once detected. This is proven once by TC-7.1 and not re-proven per category — a fourth near-duplicate fixture per category would be padding, not new coverage, mirroring `verification-review-upgrade_test_cases.md`'s own Row 5 precedent.

---

## 10. UC-8: Full Feature That Turns Out Simple — Stays Full (No Downgrade)

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-8.1 | UC-8 Primary Flow | BEHAVIORAL | A `full`-tier feature that turns out trivial completes the full pipeline unmodified — the required negative case: **a `full` feature stays `full`** | A request classified `full` at Phase 0 whose implementation turns out to be a single, simple slice | Run the request through completion | `docs/PRD.md`, `docs/use-cases/<feature>_use_cases.md`, and `docs/qa/<feature>_test_cases.md` all exist; `/merge-ready`'s gate table shows no gate `SKIPPED` for tier reasons; `.claude/scratchpad.md` shows `## Tier: full` throughout, never `quick`/`fast` at any point in its history. Not automatable in CI today |
| TC-8.2 | UC-8-A1 | BEHAVIORAL | A Rule 4 condition hit while already at `full` retains today's stop-and-ask behavior — the ceiling, not a redirect | A `full`-tier run's TDD cycle hits a Rule 4 condition | Continue the run to the Rule 4 detection point | The run stops and presents the decision to the user, counting against the retry budget — unlike UC-7's redirect, there is no escalation statement and no tier change, because `full` has nowhere higher to escalate to. Not automatable in CI today |
| TC-8.3 | UC-8-EC1 | BEHAVIORAL | A `full`-tier plan that legitimately produces exactly 1 slice still runs the full pipeline, never the `quick`-tier reduced gate subset | A `full`-tier feature whose tracer slice resolves the entire scope | Run to completion | The slice went through `prd-writer`/`ba-analyst`/`architect`/`qa-planner` first; `/merge-ready` runs all 9 gates unmodified — slice count alone is never evidence of tier; only `## Tier:`'s value is. Not automatable in CI today |
| TC-8.4 | UC-8-EC2, NFR-3 | STATIC | Every tier-aware check states the "absent `## Tier:` treated as `full`" fallback rule | `skills/merge-ready/SKILL.md` (FR-4.7 gate table), `skills/implement-slice/SKILL.md` (FR-4.4 pre-flight bypass, FR-4.5 tracer notice) | Read each file's tier-aware section | Each states explicitly that an absent `## Tier:` field is treated identically to `full` |
| TC-8.5 | UC-8-EC2, NFR-3 | BEHAVIORAL | A live run against a legacy scratchpad with no `## Tier:` field at all runs every check as if `full` | A hand-crafted `.claude/scratchpad.md` with a `## Plan` section but no `## Tier:` line at all | Run `/implement-slice` and `/merge-ready` against it | Pre-flight Check 4 (docs existence) runs unmodified (not bypassed); the tracer-gate notice, if applicable, uses the pre-F3 legacy wording (not the `quick`-tier wording); `/merge-ready` runs all 9 gates. Not automatable in CI today |

---

## 11. UC-9: Explicit Override — `/sdlc-fast`, `/sdlc-quick` — Including the Load-Bearing `Agent` Grant

**Why UC-9-EC2 is prominent here:** the architect named this the second of the two assertions the escalation redesign exists to protect (alongside UC-7-EC2 above). Withholding `Agent` from `/sdlc-fast` would leave the skill unable to invoke `planner` at the exact moment FR-2.1 mandates escalation, dead-ending an unattended run.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-9.1 | UC-9 Primary Flow step 3, UC-9-EC2, AC-28 | STATIC | `skills/sdlc-fast/SKILL.md`'s `allowed-tools` frontmatter includes `Agent`, deliberately, alongside the base fast-tier tool set | `skills/sdlc-fast/SKILL.md` exists | Grep the frontmatter's `allowed-tools` line | Line reads exactly `Read, Glob, Grep, Edit, Write, Bash, Agent` — `Agent` present |
| TC-9.2 | UC-9 Primary Flow, AC-6 | BEHAVIORAL | `/sdlc-fast <description>` bypasses FR-1's classification entirely | `/sdlc-fast "add a POST /api/webhooks/stripe endpoint"` — a request that per UC-2 would otherwise be forced `full` | Invoke the skill; capture the response | FR-3 (fast-tier execution, UC-4) runs directly against the description; no "tier: full — FR-1.3(a)" reasoning is produced or considered anywhere in the response. Not automatable in CI today |
| TC-9.3 | UC-9-A1 | STATIC | `skills/sdlc-quick/SKILL.md`'s `allowed-tools` matches `skills/develop-feature/SKILL.md`'s | Both files exist | Grep both `allowed-tools` frontmatter lines; compare | The two lists are identical (both drive `planner`/`implement-slice`/`merge-ready`) |
| TC-9.4 | UC-9-A1 | BEHAVIORAL | `/sdlc-quick <description>` targets FR-4 (quick-tier execution, UC-5) directly | `/sdlc-quick "fix the dashboard cache TTL"` | Invoke the skill; capture the response | FR-4's quick-tier execution runs directly, no classification reasoning produced. Not automatable in CI today |
| TC-9.5 | UC-9-EC1, AC-6 | BEHAVIORAL | The literal-token rule: prose containing "quick"/"fast"/"small"/"trivial" WITHOUT a literal slash-command invocation is classified normally by FR-1, never inferred as an override | Request: "let's do this quickly: add a POST `/api/webhooks/stripe` endpoint" submitted as ordinary conversational text | Submit; capture pre-Edit response text; search the invoking message for the literal tokens `/sdlc-fast`/`/sdlc-quick` | A transcript search for `/sdlc-fast` or `/sdlc-quick` in the invoking message finds nothing; the stated tier is `tier: full — FR-1.3(a)` (never "override requested") — the two facts together are the mechanically checkable proof the flag did not activate. Not automatable in CI today |
| TC-9.6 | UC-9-EC1 (structural) | STATIC | `src/claude.md`'s unprefixed-request Triage-restatement path has no mechanism to check a literal `/sdlc-fast`/`/sdlc-quick` token against | `src/claude.md` exists | Read the Triage restatement section | No `/sdlc-fast`/`/sdlc-quick` bypass logic exists on the unprefixed-request path — confirming this override is structurally unavailable there, per FR-6.3 |
| TC-9.7 | AC-21, NFR-5 | STATIC | Post-implementation asset counts stay within budget: agents remain 14, skills move to 7, hooks remain 9 | Implementation complete | Run `ls agents/*.md \| wc -l`, `ls skills/*/SKILL.md \| wc -l`, `ls hooks/handlers/*.js \| wc -l` | Results are exactly `14`, `7`, `9` respectively |
| TC-9.8 | UC-9-EC2, AC-28 | BEHAVIORAL | An `/sdlc-fast` run whose edit touches a second file successfully escalates to `quick` by invoking `planner` via the granted `Agent` tool — the escalation path actually completes, not blocked by its own tool grant | An `/sdlc-fast` run editing a file where a second, out-of-set file turns out to also need the change | Continue the run through the escalation point | The run states the escalation (UC-6 mechanics) and successfully invokes `planner` via `Agent` to proceed under `quick` tier — no dead end. Not automatable in CI today |

---

## 12. UC-10: Model Routing — `install.sh --profile` Rewrite

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-10.1 | UC-10 Primary Flow, AC-7 | STATIC | `install.sh --local --profile budget` changes exactly the 8 files whose target differs from `quality`, one line each | Implementation complete; a scratch git checkout of the repository at a clean commit | `bash -n install.sh` (syntax check); `bash install.sh --local --profile budget` against the scratch checkout; `git diff --stat` | `git diff --stat` shows exactly 8 changed files — `architect.md`, `plan-critic.md`, `planner.md`, `build-runner.md`, `doc-updater.md`, `prd-writer.md`, `refactor-cleaner.md`, `test-writer.md` — one changed line each; the other 6 files (`security-auditor.md`, `ba-analyst.md`, `code-reviewer.md`, `e2e-runner.md`, `qa-planner.md`, `verifier.md`) show zero diff; all 14 files' `model:` values equal FR-8.1's `budget` column; `.sdlc-model-profile` reads exactly `budget` |
| TC-10.2 | UC-10-A1, AC-13 | STATIC | `--profile inherit` rewrites all 14 files to the literal `model: inherit`, never a deleted field | Implementation complete; scratch checkout | `bash install.sh --local --profile inherit`; `git diff --stat`; `node scripts/ci/validate-agents.js` | `git diff --stat` shows all 14 files changed; every file reads `model: inherit` literally; `validate-agents.js`'s `REQUIRED_FIELDS` check exits 0 (field present, `inherit` already a member of `VALID_MODEL_ALIASES`) |
| TC-10.3 | UC-10-A2, NFR-6 | STATIC | `effort:` is untouched by any `--profile` run, orthogonal to `model:` | Implementation complete; scratch checkout | `grep -l "effort: high" agents/*.md` before and after both TC-10.1's `budget` run and TC-10.2's `inherit` run | Identical set of 5 filenames returned in all three cases; `agents/verifier.md` specifically reads `effort: high` combined with `model: sonnet` under every profile — never `model: opus` |
| TC-10.4 | UC-10-A3, AC-8 | STATIC | `--dry-run` prints all 14 current/target pairs and modifies nothing | Implementation complete; scratch checkout | `bash install.sh --local --profile budget --dry-run`; `git status` | Exit code 0; output lists all 14 files' current and target `model:` values (including the 6 that would not change); `git status` shows a clean tree afterward |
| TC-10.5 | UC-10-A4, AC-30 (documentation half) | STATIC | The FR-7.6 spike's finding is recorded in `install.sh`'s header comment and in a README note | Implementation complete | Read `install.sh`'s header comment block and `README.md`'s model-profile subsection | Both state plainly whether a live session re-reads `agents/*.md` frontmatter or snapshots it at load, and whether a new session/`/plugin` reinstall is required after `--profile` for the change to take effect |
| TC-10.6 | UC-10-A4, AC-30 (investigation half) | BEHAVIORAL — one-time spike, not a regression test | Directly observe whether a live Claude Code session re-reads `agents/*.md` frontmatter or snapshots it | A running Claude Code session with the plugin installed | Run `install.sh --local --profile budget` mid-session, without restarting; ask the session's own agents to report their effective model | The observation itself (which behavior actually occurs) is what TC-10.5's documentation must record. Not automatable in CI today — a one-time, human-observed investigation, not a repeatable regression check, mirroring FR-13.4's own precedent |
| TC-10.7 | UC-10-EC1, AC-11 | STATIC | The existing no-node/no-jq CI check continues to pass against the modified `install.sh` | Implementation complete | `grep -nE '(^|[^a-zA-Z])(node|jq)([^a-zA-Z]|$)' install.sh \| grep -v '^[0-9]*: *#'` (the exact existing CI step) | Empty output — FR-7.2's `awk`/shell-`case`-only idiom introduces no `node`/`jq` invocation |
| TC-10.8 | UC-10-EC2, AC-29 | STATIC | Preflight abort on a malformed file leaves zero files modified — a categorically different shape from a mid-commit-pass interruption (TC-14.2) | Implementation complete; scratch checkout with `agents/architect.md`'s `model:` line deleted entirely from its frontmatter | `bash install.sh --local --profile budget` against this scratch checkout | Non-zero exit code, naming `agents/architect.md` as missing its `model:` line; `git status` shows ZERO changed files (no temp files left, no partial commit pass entered); `.sdlc-model-profile` is not created or modified |
| TC-10.9 | FR-7.2(a) | STATIC | The `awk` substitution is bounded to the YAML frontmatter fence — a coincidental `model: ` string in the prompt body is never touched | Implementation complete; a hand-crafted fixture agent file whose prompt body (below the second `---` fence) contains the literal text `model: sonnet` as an example inside a code block or explanatory sentence | Run the rewrite against this fixture with `--profile budget` | Only the frontmatter's `model:` line changes; the coincidental body occurrence is byte-identical before and after — proving the bound is structural (fence-counting), not a whole-file pattern match |
| TC-10.10 | FR-7.4 | STATIC | Only the `model:` line changes on a rewritten file — `name`, `description`, `tools`, `effort:`, and the entire prompt body are byte-identical | Implementation complete; TC-10.1's post-`budget`-run scratch checkout | For each of the 8 changed files, `git diff` | Exactly 1 line removed and 1 line added per file (the `model:` line); every other line is unchanged |

---

## 13. UC-11: CI Drift Check — Hand-Edited `model:` Fails by Name

**Architect correction applied:** FR-10.3's install.sh/CI table-agreement check is keyed to **UC-11-EC1** here, not to UC-14 as the use-case document's own Traceability table previously misattributed.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-11.1 | UC-11 Primary Flow, AC-9, FR-10.4(b) | STATIC | No receipt (implicit `quality`) + one file hand-edited to an unauthorized-but-recognized alias → validator fails by name; `validate-agents.js` still passes | Implementation complete; `tests/fixtures/ci/model-profile/no-receipt-fable/`: no `.sdlc-model-profile`, `agents/architect.md`'s `model:` set to `fable` | `node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/no-receipt-fable --expect-failure "agents/architect.md: model 'fable', expected 'opus'"`; separately, `node scripts/ci/validate-agents.js` against the same fixture | The `--expect-failure` substring match succeeds (naming the specific file, found value, and expected value — not a bare non-zero exit); `validate-agents.js` exits 0 against the identical file, since `fable` remains a recognized alias under its own, separate, looser check |
| TC-11.2 | UC-11-A1, AC-10, FR-10.4(a) | STATIC | Receipt present (`budget`), 13/14 files correctly rewritten, 1 left at its stale `quality` value → validator fails, comparing against the `budget` column | Implementation complete; `tests/fixtures/ci/model-profile/stale-file/`: `.sdlc-model-profile` reads `budget`; `agents/build-runner.md` still reads `model: sonnet` (its stale `quality` value) instead of `haiku` | `node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/stale-file --expect-failure "agents/build-runner.md: model 'sonnet', expected 'haiku'"` | Substring match succeeds — the comparison target correctly shifted to the `budget` column (not `quality`) because the receipt is present |
| TC-11.3 | UC-11-EC1, AC-10, FR-10.3, FR-10.4(c) | STATIC | A hand-edit to `install.sh`'s own case-arm table, diverging from `scripts/ci/lib/model-profiles.js`, is caught by name even when every `agents/*.md` file itself is correct | Implementation complete; `tests/fixtures/ci/model-profile/install-table-mismatch/`: a copy of `install.sh` whose `balanced:plan-critic)` arm echoes `opus` instead of `sonnet`; every `agents/*.md` file correctly matches its declared profile | `node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/install-table-mismatch --expect-failure "balanced:plan-critic"` | Substring match succeeds — the validator parsed `install.sh`'s text (never executed it) and found the extracted triple disagrees with the JS table, failing by the specific `profile:role` pair name, distinct from a per-file `model:` drift finding |
| TC-11.4 | UC-11-EC2 (negative/false-positive, required coverage item), FR-10.3 | STATIC | The `inherit:*)` wildcard arm in `install.sh` correctly satisfies all 14 `inherit` rows — an agent whose `model:` legitimately matches its profile is never flagged as drift | Implementation complete; a fixture where `.sdlc-model-profile` reads `inherit`, all 14 files correctly read `model: inherit`, and `install.sh`'s table contains the single `inherit:*) echo inherit ;;` wildcard (not 14 individual `inherit` arms) | `node scripts/ci/validate-model-profile.js` against this fixture | Exit code 0 — the wildcard match is accepted as satisfying all 14 rows; no false-positive "missing inherit arm" finding for any of the 14 roles |
| TC-11.5 | UC-11-EC2, FR-10.4 (anti-vacuity) | STATIC | Validator fails on an empty/absent `agents/` tree, mirroring every existing validator's anti-vacuity floor | Implementation complete | `node scripts/ci/validate-model-profile.js --root "$(mktemp -d)" --expect-failure "matches too few files"` | Substring match succeeds — the exact anti-vacuity phrasing this repo's other validators already use (verified at HEAD in `.github/workflows/ci.yml`) |
| TC-11.6 | AC-10 (positive baseline) | STATIC | The validator exits 0 against the real repository tree with no `.sdlc-model-profile` present | Implementation complete; the real, un-modified repository checkout (shipped `quality` baseline, no receipt ever written) | `node scripts/ci/validate-model-profile.js` against the repo root | Exit code 0 — valid only because FR-8.2's `quality`-equals-baseline guarantee holds |

---

## 14. UC-12: `--profile` Without `--local` — Refusal

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-12.1 | UC-12 Primary Flow, AC-7 | STATIC | `install.sh --profile budget` without `--local` refuses, modifies nothing | Implementation complete; a scratch checkout | `bash install.sh --profile budget` (no `--local`); `git status` | Non-zero exit; error output names the `--local` requirement; `git status` shows no changes |
| TC-12.2 | UC-12-EC1 | STATIC | `--profile budget --uninstall` is refused with a distinct, named mutual-exclusivity error | Implementation complete | `bash install.sh --profile budget --uninstall` | Non-zero exit; error names the `--profile`/`--uninstall` mutual-exclusivity conflict specifically (not merely the `--local` requirement) |

---

## 15. UC-13: Install With No `--profile` At All — Existing Tiers Unchanged

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-13.1 | UC-13 Primary Flow, NFR-3 | STATIC | `bash install.sh` (no `--profile`) — the required negative case: **an install with no `--profile` introduces no drift at all** | Implementation complete; scratch checkout | `bash install.sh` (memory-layer install, no `--profile`); inspect `git status` for any `agents/*.md` change and confirm `.sdlc-model-profile` absence | No `agents/*.md` file is touched (this script does not install them); `.sdlc-model-profile` is not written; behavior identical to pre-feature `install.sh` |
| TC-13.2 | UC-13-A1 | STATIC | `bash install.sh --local` (no `--profile`) — identical outcome | Implementation complete; scratch checkout | `bash install.sh --local` | Identical result to TC-13.1 — `--local` alone changes only the source of the memory-layer files, never whether profile-rewrite logic runs |
| TC-13.3 | UC-13-EC1 | STATIC | A `.sdlc-model-profile` left from a prior `--profile` run is untouched by a subsequent `--profile`-less run | Implementation complete; scratch checkout where `.sdlc-model-profile` already reads `budget` from a prior run | `bash install.sh` (no `--profile`) | `.sdlc-model-profile` still reads `budget`, byte-identical to before this run — a `--profile`-less run has no code path that touches this file at all |

---

## 16. UC-14: Install Receipt — Recording and Reading the Applied Profile

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-14.1 | UC-14 Primary Flow | STATIC | A successful install writes the receipt only after all 14 rewrites succeed, and CI reads it to select the correct comparison column | Implementation complete; scratch checkout | `bash install.sh --local --profile balanced`; inspect `.sdlc-model-profile`; then hand-edit one file to a value that is correct under `balanced` but wrong under `quality` (or vice versa) and run `node scripts/ci/validate-model-profile.js` | `.sdlc-model-profile` contains exactly `balanced` (one line, no trailing content beyond the newline); the validator's comparison target for the hand-edited file is demonstrably the `balanced` column — the seeded value passes against `balanced` and would have failed against `quality`, proving the receipt actually redirected the comparison |
| TC-14.2 | UC-14-A1, FR-9.2 | BEHAVIORAL — honestly not deterministically scriptable with this repo's own tooling | An interrupted rewrite during the commit pass (after all 14 already passed preflight) leaves NO receipt claiming a profile not fully applied | A process running `install.sh --local --profile budget`, killed after some but not all of the 14 `mv`s in the commit pass have completed | Interrupt the process at a controlled point mid-commit-pass; inspect the resulting tree and `.sdlc-model-profile` | Some of the 14 files show the new profile, others the old — a partially-applied tree IS tolerated here (a categorically different shape from TC-10.8's preflight-abort case, which forbids the commit pass from ever starting); `.sdlc-model-profile` is either absent or shows a stale prior value, never a receipt claiming `budget` was fully applied. **Honestly not automatable in this repo's CI today**: reproducing a genuine interruption at a controlled point requires either process-signal timing (not portably deterministic across CI runners) or instrumenting the shipped script with a test-only abort hook (not part of FR-7's actual shipped behavior). This is recorded as a manual/observed test; FR-9.2's design (the receipt write is strictly the last statement, gated on all 14 `mv`s) is the reasoning basis for the expected outcome, not a substitute for observing it |
| TC-14.3 | UC-14-EC1 | STATIC | A hand-edited `.sdlc-model-profile` containing a value outside `{quality, balanced, budget, inherit}` is reported as its own, distinct malformed-receipt failure | Implementation complete; fixture where `.sdlc-model-profile` contains `fable` | `node scripts/ci/validate-model-profile.js --expect-failure ".sdlc-model-profile: unrecognized profile 'fable'"` against this fixture | Substring match succeeds — the failure names the receipt's own bad value, distinct in kind from a per-file `model:` drift finding (mirrors `verification-review-upgrade`'s no-`verdict:`-frontmatter handling: an unreadable control file is its own failure, never silently defaulted past) |

---

## 17. FR-11.4 (No Covering Use-Case Scenario — Derived Directly From the PRD)

The architect noted FR-11.4 (`validate-agents.js` gaining `effort` as a required field plus a valid-values check) has no use-case scenario in the use-case document. Its tests are derived directly from the PRD requirement text rather than padded with an invented UC.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-FR11.4-1 | FR-11.4 (no UC) | STATIC | An invalid `effort:` value is rejected | Implementation complete; fixture agent file with `effort: extreme` | `node scripts/ci/validate-agents.js --root <fixture> --expect-failure "is not a known level"` | Substring match succeeds, mirroring `VALID_MODEL_ALIASES`'s existing error-message convention (`\`effort: extreme\` is not a known level (low, medium, high)`) |
| TC-FR11.4-2 | FR-11.4 (no UC) | STATIC | A missing `effort:` field is rejected as a required field | Implementation complete; fixture agent file with `effort:` omitted entirely | `node scripts/ci/validate-agents.js --root <fixture> --expect-failure "required frontmatter field \`effort\`"` | Substring match succeeds, mirroring the existing `REQUIRED_FIELDS` missing-field message convention |
| TC-FR11.4-3 | FR-11.2, AC-12 | STATIC | The exact 3/6/5 low/medium/high split, by filename | Implementation complete | `grep -l "effort: low" agents/*.md`, `grep -l "effort: medium" agents/*.md`, `grep -l "effort: high" agents/*.md` | Exactly 3, 6, and 5 files respectively, matching FR-11.2's table exactly |

---

## 18. UC-15: Digest Index — Bounded Prior-Feature Context for `planner`

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-15.1 | UC-15 Primary Flow, AC-14 | FIXTURE | A `planner` invocation for a new full-tier feature, with `docs/digest-index.md` holding 9 rows, reads a bounded set — never all 9 | Delegation prompt stating the current (hypothetical Section 11) feature's PRD section number/title; `docs/digest-index.md` fixture with 9 rows | Invoke `planner`; audit its `Read` tool-call trace for this turn | Exactly one `Read` scoped to the current section's boundaries within `docs/PRD.md` (not the whole file); exactly one `Read` of `docs/digest-index.md` in full; between 2 and 4 `Read` calls against prior sections'/use-cases' full content; zero `Read` calls against the remaining 5–7 prior rows' full content |
| TC-15.2 | UC-15-EC1, AC-15 | FIXTURE | First feature in a fresh project (no digest yet) proceeds with 0 prior-feature reads and does not stall — required negative/false-positive case | Delegation prompt for the first full-tier feature in a freshly scaffolded project; `docs/digest-index.md` absent entirely | Invoke `planner` | The current-feature read (FR-12.3) proceeds unconditionally and completes; the prior-feature-context step reads 0 rows and does not stall, retry, or fabricate a digest entry to reach a 2-row minimum |
| TC-15.3 | UC-15-EC2 | FIXTURE | A stale digest Summary can mislead row selection but never substitutes for reading the actual current file once a row is selected | Fixture `docs/digest-index.md` where one row's Summary describes Section 4's use-cases file as it existed at Gate 7 time, but the actual `docs/use-cases/<section-4-slug>_use_cases.md` file has since been hand-edited with new content not reflected in the Summary; the current request is topically related to the NEW content | Invoke `planner` with a request whose relevance overlaps the section's CURRENT (not summarized) content, and confirm whether that row is selected; if selected, inspect what content is actually read | If the stale Summary causes the row to be selected, `planner`'s subsequent `Read` of "that row's referenced documents" pulls the CURRENT on-disk content, not the stale Summary text — the Summary can only mislead which rows get chosen, never what content is read once chosen |
| TC-15.4 | FR-12.3 (structural) | STATIC | `agents/planner.md`'s Process step 1 no longer reads `docs/PRD.md` unqualified | Implementation complete | Grep `agents/planner.md` for `Read \`docs/PRD.md\`` (the old unqualified phrasing) and for a scoped phrasing referencing the delegation-supplied section number/title | The old unqualified phrasing is absent; a scoped-read instruction is present |
| TC-15.5 | FR-12.5 (structural) | STATIC | `skills/bootstrap-feature/SKILL.md` Step 5's delegation prompt states the current feature's PRD section number and title explicitly | Implementation complete | Read Step 5's delegation-prompt template | Text includes an explicit placeholder/instruction for stating the section number and title |
| TC-15.6 | AC-22 | STATIC | `agents/planner.md`'s `tools:` frontmatter remains unchanged — the Quick-Tier Contract and digest-index consultation are read-only additions | Implementation complete | Grep `agents/planner.md`'s `tools:` line | Exactly `Read, Glob, Grep, WebSearch, WebFetch` — no `Write`/`Edit` — attributing every scratchpad/plan-file/digest-index mutation to the orchestrator alone |

---

## 19. UC-16: Digest Index Write — Gate 7 Appends or Refreshes

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-16.1 | UC-16 Primary Flow, AC-16 (first clause) | FIXTURE | Gate 7's delegation to `doc-updater`, for a first-time full-tier feature completion, appends exactly one new row | `doc-updater` invoked with Gate 7's finalized-docs delegation (PRD section, use-cases file, QA file all supplied), against a `docs/digest-index.md` fixture with no existing row for this section | Invoke `doc-updater` | `docs/digest-index.md` gains exactly one new row in the `| Section | Title | Summary (≤300 chars) | Docs |` format, with `Docs` listing the PRD section anchor plus the use-cases and QA file paths |
| TC-16.2 | UC-16-A1, AC-16 (second clause) | FIXTURE | Re-running Gate 7 for the same feature refreshes the existing row in place, not duplicating it | `docs/digest-index.md` fixture already containing a row for this section | Invoke `doc-updater` again with the same section's (possibly updated) finalized docs | The existing row is updated in place (same idempotency discipline as `src/rules/changelog.md`'s guard, keyed on section number); row count is unchanged, not incremented |

**Notes (UC-16-EC1/EC2, not separately counted):** UC-16-EC1 (a `quick`-tier feature's Gate 7 `SKIPPED` produces no digest row) and UC-16-EC2 (a `fast`-tier feature never reaches Gate 7 at all, so a digest row is impossible by construction) are both direct, mechanical consequences of behavior already proven elsewhere — TC-5.1's gate table (Gate 7 = `SKIPPED (tier: quick)`, so `doc-updater` is never delegated to) and TC-4.1's postcondition (`fast` tier has no `/merge-ready` run whatsoever). A dedicated fixture for either would be padding, not new coverage.

---

## 20. UC-17: Statusline — Full Field Rendering

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-17.1 | UC-17 Primary Flow, AC-17 | STATIC | All five FR-13.3 segments render, in order, matching live state | Implementation complete (including FR-13.4's spike having recorded actual field names); a fixture stdin JSON matching the spike-confirmed shape (cost + token-usage fields); a fixture `.claude/scratchpad.md` with `## Feature: Foo`, `## Plan` showing Wave 2 Slice 1 of 2 IN PROGRESS, and a `Gates: 4/9` line | `echo '<fixture-stdin-json>' \| node .claude/statusline.js` (with `.claude/scratchpad.md` set to the fixture path) | stdout is exactly `<feature> \| wave 2 slice 1/2 \| gates 4/9 \| $<cost> \| <usable-context bar>`, all five segments present in this exact order, `wave 2 slice 1/2` and `gates 4/9` matching the fixture's scratchpad values |
| TC-17.2 | FR-13.3 (context-bar arithmetic) | STATIC | The usable-context bar subtracts the autocompact reserve from BOTH the numerator and the denominator | Implementation complete; a fixture stdin with known `max_tokens`, `used_tokens`, and `autocompact_reserve` values (or the spike-confirmed equivalent field names) chosen so that the "subtract from numerator only" bug and the correct formula produce different, distinguishable percentages | `node .claude/statusline.js` against this fixture; compute the expected value by hand using `(max_tokens − autocompact_reserve − used_tokens) / (max_tokens − autocompact_reserve)`, floored at 0% | Rendered percentage matches the correct formula's hand-computed value, not the "numerator-only" incorrect formula's value — directly catching the specific arithmetic defect the PRD calls out by name |
| TC-17.3 | UC-17-A1, AC-18 | STATIC | With no plan present in the scratchpad, wave/slice and gates segments are omitted entirely — never `0/0`. **Architect correction applied: this fixture is a scratchpad with no `## Plan` section at all (or no scratchpad file at all), never a scratchpad reading `## Tier: fast`** — per FR-3.5, a non-escalated fast run never writes a scratchpad, so `## Tier: fast` is a state that never exists for this check to key on | Implementation complete; fixture (a): no `.claude/scratchpad.md` file at all; fixture (b): a scratchpad present but with no `## Plan` section | `node .claude/statusline.js` against each fixture, with a valid stdin JSON | Both fixtures: stdout omits the `wave <W> slice <N>/<M>` and `gates <G>/9` segments entirely — never rendered as `wave 0/0 slice 0/0` or `gates 0/9`; cost and usable-context still render |
| TC-17.4 | UC-17-A2 | STATIC | Once every slice in the plan is DONE, the wave/slice segment is omitted, not rendered stale | Implementation complete; fixture scratchpad whose `## Plan` shows every slice marked DONE | `node .claude/statusline.js` against this fixture | Wave/slice segment omitted; not rendered as a stale "wave 3 slice 2/2" |
| TC-17.5 | UC-17-EC1, FR-13.4 | BEHAVIORAL — one-time spike, not a regression test | The mandatory pre-implementation field-name discovery spike | A live Claude Code session with a `statusLine` configured | Configure `statusLine`; observe one real invocation; capture the actual stdin JSON verbatim | The captured field names for cost and context-window usage (and whether an autocompact-reserve value is exposed directly or must be approximated) are recorded — this observation is what TC-17.1/TC-17.2's fixtures must be built against. Not automatable in CI today — one-time, human-observed, not repeatable per change |
| TC-17.6 | FR-13.4 (documentation) | STATIC | The spike's finding is recorded in `templates/statusline.js`'s own header comment | Implementation complete | Read the file's header comment | States the exact field names used for cost/context-window usage and the autocompact-reserve handling, per FR-13.4's "record the finding before writing the logic" discipline |

---

## 21. UC-18: Statusline Absent or Malfunctioning — Visible Degradation, No Silent Dependency

**Two distinct degradation shapes, not to be conflated:** Scenario A (`statusLine` never configured) is Claude Code's own native, silent-by-design absence — nothing renders, no failure signal, and this feature adds no check for it. Scenario EC2 (`statusLine` configured but no Node runtime present) is a visible, per-response command-spawn failure surfaced by Claude Code itself. The two are recorded as structurally different so an implementation is never tempted to treat them as the same degradation.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-18.1 | UC-18 Primary Flow (Scenario A), AC-20 (structural half), UC-18-EC1 | STATIC | No mechanism anywhere in the repo reads statusline output back into the pipeline — the structural proof underlying "removing `statusLine` changes nothing else" | Implementation complete | Grep the entirety of `hooks/`, `skills/`, `agents/`, `src/` for any reference to `.claude/statusline.js`'s output, a statusline-produced file, or a dependency on `statusLine` being configured | Zero references found anywhere — confirms FR-13.6's "no reverse dependency" claim structurally, not merely by assertion; this is also the direct answer to UC-18-EC1 ("no hook/guard/agent can become silently dependent on statusline data, because none of them receive it through any channel this feature creates") |
| TC-18.2 | UC-18 Primary Flow (Scenario A), AC-20 (behavioral half) | BEHAVIORAL — honestly limited | A direct comparison of triage/escalation/model-routing/digest-index behavior with and without `statusLine` configured shows zero difference | Two otherwise-identical live sessions, one with `statusLine` configured, one without | Run an identical sequence of requests (e.g., TC-1.1, TC-6.1, TC-10.1) against both sessions; diff the observable outcomes | Every observable outcome (stated tier, escalation statements, file diffs, gate tables) is identical between the two sessions. Not automatable in CI today — TC-18.1's structural grep already gives strong static evidence this is impossible to violate; this behavioral case is a confirming, not load-bearing, check |
| TC-18.3 | UC-18-A1 (Scenario B), AC-19 | STATIC | A corrupted scratchpad does not crash the statusline or blank it — fail-open with a minimal, non-empty line | Implementation complete; fixture `.claude/scratchpad.md` with a deliberately truncated/unparseable `## Plan` section; a valid stdin JSON | `node .claude/statusline.js` against this fixture | Exit code 0; stdout is non-empty and contains at least the cost and usable-context segments (derivable purely from stdin, which never depended on the scratchpad); wave/slice and gates segments are omitted (the same omission shape as TC-17.3, now triggered by corruption rather than legitimate absence) — no thrown error, no crash, no blank output |
| TC-18.4 | UC-18-EC2, FR-13.8 (structural half) | STATIC | `templates/statusline.js` has zero npm runtime dependencies | Implementation complete | Grep the file for `require(...)` calls; check for an adjacent `package.json` declaring runtime dependencies for this file | Every `require(...)` target is a Node builtin (e.g., `fs`, `path`); no third-party package dependency exists — confirming there is no *additional* missing-dependency failure layered on top of the "no Node runtime at all" case |
| TC-18.5 | UC-18-EC2, FR-13.8 (behavioral half) | BEHAVIORAL — honestly not automatable here | On a machine with no Node runtime installed, `statusLine` configured, Claude Code itself surfaces a visible, per-response command-spawn failure — distinct from Scenario A's silent absence | A machine with no `node` binary in `PATH`; `.claude/settings.json` configured with `statusLine` pointing at `node .claude/statusline.js` | Start a live session; observe the per-response behavior | A visible spawn-failure signal is surfaced by Claude Code itself, once per response — NOT silence (contrast directly with TC-17.3/TC-18.1, where absence-of-configuration produces silence with zero failure signal). Not automatable in CI today — this is a property of Claude Code's own command-invocation behavior on a specific host environment, not code this repository controls or can script a check for; recorded as a one-time manual observation, explicitly distinguished from Scenario A so the two are never assumed to degrade identically |

---

## 22. Negative / False-Positive Cases (Consolidated Index)

A guard, filter, or classification signal that fires when it should not is what stalls an unattended run — as important as the positive cases.

| # | Negative / False-Positive Case | Covering Test Case(s) |
|---|---|---|
| 1 | A `fast`-tier run that correctly does NOT escalate | TC-4.1 |
| 2 | A trivial declared `## Sensitive Paths` section cannot narrow the fixed default (union semantics) | TC-2.6 |
| 3 | An agent whose `model:` legitimately matches its resolved profile (including via the `inherit:*)` wildcard) is never flagged as drift | TC-11.4 |
| 4 | A legacy scratchpad with no `## Tier:` field is treated as `full`, never as an ambiguous/error state | TC-8.4, TC-8.5 |
| 5 | Prose merely containing "quick"/"fast"/"small"/"trivial" does not activate the literal-token override | TC-9.5 |
| 6 | The Gate 2/3/`test-writer` PRD/use-case/QA-absence carve-outs correctly suppress a checklist item that would otherwise stall a correctly-scoped `quick`-tier run | TC-5.5, TC-5.6, TC-5.9 |
| 7 | A fresh project with no digest index does not stall `planner`'s prior-feature-context step | TC-15.2 |
| 8 | An install with no `--profile` flag introduces zero drift on its own | TC-13.1 |
| 9 | An empty plan/gates state renders as an omission, never a literal `0/0` | TC-17.3 |
| 10 | A `full`-tier feature that turns out trivial is never silently downgraded mid-run | TC-8.1 |

---

## 23. AC → TC Coverage Table

| AC | Test Case(s) |
|---|---|
| AC-1 | TC-1.1, TC-2.1 |
| AC-2 | TC-4.1 |
| AC-3 | TC-6.1 |
| AC-4 | TC-7.1, TC-7.2 |
| AC-5 | TC-5.10 |
| AC-6 | TC-9.5 (+ TC-9.2/TC-9.4 for the positive override half) |
| AC-7 | TC-10.1, TC-12.1 |
| AC-8 | TC-10.4 |
| AC-9 | TC-11.1 |
| AC-10 | TC-11.2, TC-11.3, TC-11.4, TC-11.5, TC-11.6 |
| AC-11 | TC-10.7 |
| AC-12 | TC-FR11.4-3 |
| AC-13 | TC-10.2 |
| AC-14 | TC-15.1 |
| AC-15 | TC-15.2 |
| AC-16 | TC-16.1, TC-16.2 (third clause: cross-referenced to TC-5.1/TC-4.1, see UC-16 notes) |
| AC-17 | TC-17.1 |
| AC-18 | TC-17.3 |
| AC-19 | TC-18.3 |
| AC-20 | TC-18.1, TC-18.2 |
| AC-21 | TC-9.7 |
| AC-22 | TC-15.6 |
| AC-23 | TC-7.4 |
| AC-24 | TC-5.13, TC-5.14 |
| AC-25 | TC-5.4, TC-5.5, TC-5.6, TC-5.7 |
| AC-26 | TC-5.8, TC-5.9 |
| AC-27 | TC-5.11, TC-5.12 |
| AC-28 | TC-9.1, TC-9.8 |
| AC-29 | TC-10.8 |
| AC-30 | TC-10.5, TC-10.6 |
| AC-31 | TC-2.6 |

Every AC-1 through AC-31 is named and covered by at least one test case; none is padded with a vacuous case.

---

## 24. UC → TC Coverage Table

| UC Scenario | Test Case(s) |
|---|---|
| UC-1 Primary Flow | TC-1.1 |
| UC-1-A1 | TC-1.2 |
| UC-1-A2 | TC-1.3 |
| UC-1-EC1 | TC-1.4 |
| UC-2 Primary Flow | TC-2.1 |
| UC-2-A1 | TC-2.2 |
| UC-2-A2 | TC-2.3 |
| UC-2-A3 | TC-2.4 |
| UC-2-EC1 | TC-2.5 |
| UC-2-EC2 | TC-2.6 |
| UC-3 Primary Flow | TC-3.1 |
| UC-3-A1 | TC-3.2 |
| UC-3-EC1 | TC-3.3 |
| UC-4 Primary Flow | TC-4.1 |
| UC-4-E1 | TC-4.2 |
| UC-4-EC1 | TC-4.3 |
| UC-5 Primary Flow | TC-5.1, TC-5.2, TC-5.4, TC-5.8, TC-5.15 |
| UC-5-A1 | TC-5.3 |
| UC-5-E1 | TC-5.7 |
| UC-5-EC1 | TC-5.10 |
| UC-5-EC2 | TC-5.11, TC-5.12 |
| UC-6 Primary Flow | TC-6.1 |
| UC-6-A1 | TC-6.2 |
| UC-6-EC1 | TC-6.3 |
| UC-7 Primary Flow | TC-7.1 |
| UC-7-A1 | TC-7.4, TC-7.5 |
| UC-7-E1 | No dedicated TC — the use-case document states this scenario IS the error-recovery redirection itself, with no separate failure mode; the case it points to (Rule 4 hit while already at `full`) is UC-8-A1, covered by TC-8.2 |
| UC-7-EC1 | TC-7.6 |
| UC-7-EC2 | TC-7.2, TC-7.3 |
| UC-8 Primary Flow | TC-8.1 |
| UC-8-A1 | TC-8.2 |
| UC-8-EC1 | TC-8.3 |
| UC-8-EC2 | TC-8.4, TC-8.5 |
| UC-9 Primary Flow | TC-9.1, TC-9.2 |
| UC-9-A1 | TC-9.3, TC-9.4 |
| UC-9-EC1 | TC-9.5, TC-9.6 |
| UC-9-EC2 | TC-9.1 (cross-ref), TC-9.8 |
| UC-10 Primary Flow | TC-10.1 |
| UC-10-A1 | TC-10.2 |
| UC-10-A2 | TC-10.3 |
| UC-10-A3 | TC-10.4 |
| UC-10-A4 | TC-10.5, TC-10.6 |
| UC-10-EC1 | TC-10.7 |
| UC-10-EC2 | TC-10.8 |
| UC-11 Primary Flow | TC-11.1 |
| UC-11-A1 | TC-11.2 |
| UC-11-EC1 | TC-11.3 |
| UC-11-EC2 | TC-11.4, TC-11.5 |
| UC-12 Primary Flow | TC-12.1 |
| UC-12-EC1 | TC-12.2 |
| UC-13 Primary Flow | TC-13.1 |
| UC-13-A1 | TC-13.2 |
| UC-13-EC1 | TC-13.3 |
| UC-14 Primary Flow | TC-14.1 |
| UC-14-A1 | TC-14.2 |
| UC-14-EC1 | TC-14.3 |
| UC-15 Primary Flow | TC-15.1 |
| UC-15-EC1 | TC-15.2 |
| UC-15-EC2 | TC-15.3 |
| UC-16 Primary Flow | TC-16.1 |
| UC-16-A1 | TC-16.2 |
| UC-16-EC1 | No dedicated TC — direct, mechanical consequence of TC-5.1's proven gate table (Gate 7 `SKIPPED` for `quick` ⇒ `doc-updater` never delegated to); see UC-16 notes |
| UC-16-EC2 | No dedicated TC — direct, mechanical consequence of TC-4.1's proven postcondition (`fast` tier has no `/merge-ready` run at all); see UC-16 notes |
| UC-17 Primary Flow | TC-17.1, TC-17.2 |
| UC-17-A1 | TC-17.3 |
| UC-17-A2 | TC-17.4 |
| UC-17-EC1 | TC-17.5, TC-17.6 |
| UC-18 Primary Flow (Scenario A) | TC-18.1, TC-18.2 |
| UC-18-A1 (Scenario B) | TC-18.3 |
| UC-18-EC1 | No dedicated TC — cross-referenced to TC-18.1's structural grep, which already proves the claim this edge case states |
| UC-18-EC2 | TC-18.4, TC-18.5 |

Every UC-1 through UC-18 primary flow, and every documented `-A`/`-E`/`-EC` sub-flow, is covered by at least one named test case, or its absence is explicitly stated with reasoning (UC-7-E1, UC-16-EC1, UC-16-EC2, UC-18-EC1) rather than padded with an invented, redundant fixture.

---

## 25. Count Summary

| Kind | Count | Automatable in this repo's CI today |
|---|---|---|
| STATIC | 47 | Yes — 47/47, once this feature ships. Runnable via `bash -n install.sh`, `bash install.sh --local --profile <name>` against a scratch checkout, `node scripts/ci/validate-model-profile.js`/`validate-agents.js` with `--expect-failure "<substring>"`, `node templates/statusline.js` fed a fixture stdin, and plain grep/file-read checks — all zero-LLM, using this repository's existing validator infrastructure with no new harness required. Two STATIC-adjacent items (TC-10.6, TC-17.5) are excluded from this count and classified BEHAVIORAL below because they are one-time human-observed spikes, not scriptable checks |
| FIXTURE | 10 | No — 0/10 today. Each requires a live, single-agent invocation (`planner`, `code-reviewer`, `security-auditor`, `test-writer`, or `doc-updater`) against a committed fixture; this repo has no LLM-invocation harness to script that. Fixtures are specified precisely enough that a human, or a future eval harness, can run them exactly as written |
| BEHAVIORAL | 43 | No — 0/43 today. Each requires driving the top-level orchestrating session through a real multi-step turn (or, for TC-10.6/TC-17.5, a one-time human-observed spike investigation) and observing the aggregate outcome; there is no scripted driver for that in this repo. One case (TC-14.2) is additionally flagged as not deterministically scriptable even with future LLM-invocation tooling, since it depends on process-signal timing this repo's own scripts do not expose a hook for |
| **Total** | **100** | **47/100 (47%) automatable in CI today, once implemented** |

This 47% figure is materially higher than a prompt-only feature's ceiling (compare `verification-review-upgrade_test_cases.md`'s 24.5%), and that difference is real, not rounding: F4's model-routing half ships actual executable artifacts — `install.sh`'s `--profile` rewrite, `scripts/ci/validate-model-profile.js`, and `templates/statusline.js` — that a shell/Node process can exercise with zero LLM involvement, exactly as this repository's existing validators already do for its other structural checks. The triage/escalation/quick-tier-execution half, by contrast, is genuinely agent-prompt-and-orchestrator-behavior subject matter with the same ceiling the sibling document already established, and this document does not pretend otherwise. Rounding any FIXTURE or BEHAVIORAL case up to "automated today," or disguising a one-time investigative spike (TC-10.6, TC-17.5) as a repeatable regression test, would be exactly the defect this harness's own QA discipline exists to prevent.
