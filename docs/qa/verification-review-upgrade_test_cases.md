# Test Cases: Verification & Review Upgrade

> Based on [PRD](../PRD.md) — Section 9 and [Use Cases](../use-cases/verification-review-upgrade_use_cases.md)

---

## 1. Testing Approach and Test-Kind Classification

**System context (unchanged from the use-case document):** this feature has no UI, no server, no database, and — unlike the two prior QA documents this one is modeled on — no runtime code to spawn as a child process either. `hook-infrastructure_test_cases.md` and `blocking-guards_test_cases.md` both drive real Node processes (`hooks/lib/run-hook.js`) through a real harness (`tests/hooks/harness.js`) and assert on real exit codes and real stdout JSON. This feature's artifacts are markdown **agent prompts** (`agents/verifier.md`, `agents/plan-critic.md`, `agents/code-reviewer.md`, `agents/security-auditor.md`, `agents/planner.md`) and markdown **skill prompts** (`skills/merge-ready/SKILL.md`, `skills/bootstrap-feature/SKILL.md`, `skills/develop-feature/SKILL.md`, `skills/implement-slice/SKILL.md`, `src/claude.md`). There is no `package.json`, no test runner for markdown, and no application to boot. This document does not pretend otherwise.

Every test case below is classified into exactly one of three kinds, stated as its own column:

- **STATIC** — assertable by reading a file or running a shell command against the repository, with zero LLM/agent invocations. Examples: grepping `agents/plan-critic.md`'s frontmatter for `Write`; running `node scripts/ci/validate-agents.js` and checking its exit code; reading `skills/merge-ready/SKILL.md`'s prose for a specific rule statement. **STATIC is the only kind runnable in this repository's CI today**, via `scripts/ci/validate-agents.js` and equivalent grep-based checks — it is this feature's test backbone, exactly as it is for `model-tier-optimization_test_cases.md`, the closest prior precedent for a markdown-only feature.
- **FIXTURE** — assertable by invoking exactly **one** named subagent (`verifier`, `plan-critic`, `code-reviewer`, `security-auditor`, or `planner`) against a crafted input file committed under `tests/fixtures/`, and inspecting that single agent's own returned output (its written report, or its FINDINGS/Issues list). Each FIXTURE test case below states what the fixture file contains and what output is expected. **FIXTURE is not automatable in this repository's CI today** — there is no scripted mechanism here to invoke a Claude agent headlessly and capture its output for assertion (no API harness, no eval runner). The fixture files are committed now so that a human reviewer, or a future eval harness, can run the named agent against the described input and check the described output; today, running a FIXTURE test case means a person actually invoking the agent via the `Agent` tool and reading what comes back.
- **BEHAVIORAL** — only observable by driving an orchestrating **skill/slash command** (`/merge-ready`, `/bootstrap-feature`, `/develop-feature`, `/implement-slice`, or the interactive plan-mode flow in `src/claude.md`) through its own multi-step, multi-agent procedure, and observing the aggregate outcome — call ordering, commit existence, zero-`Agent`-calls refusals, cross-file diffs, or scratchpad state across attempts. Every BEHAVIORAL test case below states precisely what is seeded, what is observed, and what the pass condition is, and states plainly that **it requires a manual/observed run and is not automatable in this repository's CI today** — driving a skill means driving the top-level orchestrating model itself through several turns; there is no scripted stand-in for that here.

No test case in this document disguises a BEHAVIORAL or FIXTURE check as if it ran in CI. Where a check would be nice to have but genuinely cannot be built until a future harness exists (an LLM-eval runner, or a scripted skill-driver), that limitation is stated at the test case, not smoothed over.

---

## 2. Reference (Non-Test): Verdicts, Schema, Severity Tiers

Restated from the use-case document only for this document's own readability — not itself a test:

**Four verdicts, fixed precedence (FR-1.2):** `FAILED` (any of L1/L2/L3 FAIL) → `UNCERTAIN` (could not reach a determination for ≥1 level, including L4 itself reporting `SKIPPED`) → `VERIFIED` (L4 confirms ≥1 exercised path) → `PRESENT_BEHAVIOR_UNVERIFIED` (default: present, wired, unexercised).

**`passed`/`human_verification_required` mapping (FR-3.2):** `VERIFIED`→`true`/`[]`; `PRESENT_BEHAVIOR_UNVERIFIED`→`false`/non-empty; `FAILED`→`false`/MAY be `[]`; `UNCERTAIN`→`false`/non-empty.

**Marker severity (FR-4.1):** `TBD`/`FIXME`/`XXX` → BLOCKER unless same-line issue reference, then WARNING. `TODO`/`HACK`/`placeholder` → WARNING unconditional. `stub`/`not implemented`/`throw new Error('Not implemented')`/`raise NotImplementedError`/`pass  # TODO` → BLOCKER unconditional.

---

## 3. UC-1: Gate 6 Verdict Determination — the Four-Verdict Precedence

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-1.1 | UC-1 Primary Flow, AC-1 | FIXTURE | Present + wired + unexercised feature → `PRESENT_BEHAVIOR_UNVERIFIED` | Fixture `tests/fixtures/agents/verifier/present-unverified/`: a route handler → service → data-layer chain, fully wired (imports resolve, route registered, every parameter real, no hardcoded stand-in), Levels 1–3 all clean; zero test file calls the path, no E2E scenario names it | Invoke `verifier` against the fixture, instructing it to write `docs/verification/present-unverified.md` | Written frontmatter: `verdict: PRESENT_BEHAVIOR_UNVERIFIED`, `passed: false`; `gaps` has ≥1 entry at `level: 4` with all four required fields naming the unexercised path; `human_verification_required` non-empty |
| TC-1.2 | UC-1-A1, AC-1 | FIXTURE | Genuinely exercised feature → `VERIFIED` | TC-1.1's fixture plus one added `*.test.ts` file calling the path with non-trivial input and asserting on its output (FR-1.3(a)) | Invoke `verifier` against the augmented fixture | `verdict: VERIFIED`, `passed: true`, `gaps: []`, `human_verification_required: []` |
| TC-1.3 | UC-1-E1, AC-1 | FIXTURE | Missing plan-declared file (or a BLOCKER marker) → `FAILED`, wins over what L3/L4 would otherwise show | Fixture `tests/fixtures/agents/verifier/failed-missing-file/`: the plan declares a file absent from disk; every other file has a passing test (L4 would otherwise be `VERIFIED`-worthy) | Invoke `verifier` | `verdict: FAILED`, `passed: false`; `gaps` names the missing file at `level: 1`; verdict is `FAILED` despite the otherwise-passing L4 evidence |
| TC-1.4 | UC-1-EC1 (Level 1 `SKIPPED`), AC-1 | FIXTURE | No plan/scratchpad locatable → `UNCERTAIN` | Fixture project with no plan file and no `.claude/scratchpad.md` | Invoke `verifier` | `verdict: UNCERTAIN`, `passed: false`, `human_verification_required` non-empty, describing the missing plan |
| TC-1.5 | UC-1-EC1 (Level 3 `SKIPPED`), AC-1 | FIXTURE | Unresolvable dynamic `import()` → `UNCERTAIN` | Fixture with `const mod = await import(computedPath)` where `computedPath` is not statically resolvable | Invoke `verifier` | `verdict: UNCERTAIN`, `passed: false`, `human_verification_required` non-empty, describing the unresolved import |
| TC-1.6 | UC-1-EC1 (Level 4 `SKIPPED` — the FR-1.2 pin), AC-21 | FIXTURE | Every candidate data-flow path is behind a dynamic import, Levels 1–3 PASS, L4 has nothing it can attempt → `UNCERTAIN`, **never** `PRESENT_BEHAVIOR_UNVERIFIED` | Fixture where the only entry into the new code is `await import(runtimeComputedPath)()`; L1–L3 all PASS | Invoke `verifier` | `verdict: UNCERTAIN` (not `PRESENT_BEHAVIOR_UNVERIFIED`); `human_verification_required` non-empty naming the undeterminable path — the specific negative assertion constraint C7 exists to pin down, distinguishing this row from TC-1.1 |
| TC-1.7 | UC-1-EC2, AC-1 | FIXTURE | `FAILED` and `UNCERTAIN` conditions both hold in one run → `FAILED` wins; both findings still individually recorded | Fixture combining TC-1.3's missing file (L1 FAIL) with TC-1.5's unresolvable dynamic import on an unrelated path (L3 `SKIPPED`) | Invoke `verifier` | `verdict: FAILED` (not `UNCERTAIN`); `gaps` contains both the Level 1 and the Level 3 findings as separate entries — proves FR-1.2 is a fixed sequence, not a severity vote |
| TC-1.8 | UC-1 (all flows), FR-1.4, FR-1.5 | STATIC | Gate 6's Status-column template renders the four verdicts verbatim, not `PASS/FAIL/WARN` | `skills/merge-ready/SKILL.md` exists | Read the Gate 6 row/output-table section and its advisory note | Table documents the Status column rendering one of `VERIFIED / PRESENT_BEHAVIOR_UNVERIFIED / FAILED / UNCERTAIN` verbatim; the old "WARN = Level 4 advisory only" note is absent, replaced by wording consistent with Design Decision 1 |
| TC-1.9 | UC-1 Primary Flow (postconditions), AC-1 | BEHAVIORAL | A live `/merge-ready` run against TC-1.1's fixture actually prints `PRESENT_BEHAVIOR_UNVERIFIED` in Gate 6's Status column and `NOT MERGE READY` overall | TC-1.1's fixture project, every other gate passing | Run `/merge-ready` (or `/merge-ready gate-6` alone) against the fixture project; capture the transcript | Transcript's Gate 6 row reads exactly `PRESENT_BEHAVIOR_UNVERIFIED`; the printed overall result line reads exactly `NOT MERGE READY`. Not automatable in this repo's CI today — no scripted driver exists for the `/merge-ready` skill; requires a human-observed session |

---

## 4. UC-2: The `passed` Invariant and Malformed-Report Handling

UC-2-A1 (the well-formed verdict→`passed`/`human_verification_required` mapping, for all four verdicts) requires no separate fixture: TC-1.1 (`PRESENT_BEHAVIOR_UNVERIFIED`→`false`+non-empty), TC-1.2 (`VERIFIED`→`true`+`[]`), TC-1.3 (`FAILED`→`false`), and TC-1.4/1.5/1.6 (`UNCERTAIN`→`false`+non-empty) already assert the exact FR-3.2 field values for each of the four cases — repeating them here would be a vacuous duplicate fixture, not a new test.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-2.1 | UC-2 Primary Flow, AC-3 | STATIC | `skills/merge-ready/SKILL.md` states Gate 6 reads the report's frontmatter directly (not `verifier`'s prose claim) and treats `passed: true` + non-empty `human_verification_required` identically to `FAILED`, with the exact Status string | `skills/merge-ready/SKILL.md` exists | Read Gate 6's section | Text states the malformed-report rule and the literal Status string `FAILED (malformed report: passed:true with non-empty human_verification_required)` |
| TC-2.2 | UC-2 Primary Flow, AC-3 | BEHAVIORAL | A hand-crafted `docs/verification/<feature>.md` with `passed: true` and a non-empty `human_verification_required` array causes a live Gate 6 rerun to report `FAILED (malformed report...)`, not `PASS`/`VERIFIED` | Hand-crafted file: `verdict: VERIFIED`, `passed: true`, `human_verification_required: ["confirm the webhook fires"]` | Run `/merge-ready gate-6` against the project containing this file | Status column reads exactly `FAILED (malformed report: passed:true with non-empty human_verification_required)`; overall result is `NOT MERGE READY`; no file is modified by the check itself. Not automatable in CI today — requires a live Gate 6 run |
| TC-2.3 | UC-2-E1, NFR-3 | STATIC | `skills/merge-ready/SKILL.md` states that a report with no `verdict:` frontmatter field (pre-feature format) is treated as `UNCERTAIN` and triggers a fresh `verifier` run, never an error and never an inferred verdict from old prose | `skills/merge-ready/SKILL.md` exists | Read Gate 6's section | Text states the NFR-3 backward-compatibility rule explicitly |
| TC-2.4 | UC-2-E1, NFR-3 | BEHAVIORAL | An old-format `docs/verification/<feature>.md` (three-state `PASS/FAIL/WARN`, no YAML frontmatter) causes a live Gate 6 rerun to report `UNCERTAIN` and queue a fresh `verifier` run | Fixture file with the pre-feature prose-only format, no frontmatter at all | Run `/merge-ready gate-6` against it | Status column reads `UNCERTAIN`; no error/exception; a fresh `verifier` invocation is queued through the same Auto-Fix Protocol mechanism as TC-3.2. Not automatable in CI today |
| TC-2.5 | UC-2-EC1, FR-2.5 | STATIC | `skills/merge-ready/SKILL.md` (or `agents/verifier.md`'s own output contract, cross-checked) states that a `gaps` entry missing any of its four required fields (`level`/`finding`/`location`/`verifies_with`) is malformed and handled identically to FR-3.3 | Both files exist | Read the relevant sections | Text states the rule and that the Status column names the specific incomplete entry (by `location`, or array index if `location` is also absent) |
| TC-2.6 | UC-2-EC1, FR-2.5 | BEHAVIORAL | A `docs/verification/<feature>.md` with a `gaps` entry populated on `level`/`finding`/`location` but missing `verifies_with` causes a live Gate 6 rerun to report `FAILED (malformed report...)`, naming the incomplete entry | Hand-crafted file with exactly this shape | Run `/merge-ready gate-6` against it | Status column reads `FAILED (malformed report: ...)`, naming the entry's `location`; overall `NOT MERGE READY`. Not automatable in CI today |

---

## 5. UC-3: Gate 6 `--gaps` Replan Loop — the Autonomy Path

This section is the dedicated coverage for the full `--gaps` autonomy loop: zero-human-involvement replan, the 3-attempt exhaustion boundary, and the C6 compaction-survival requirement for the attempt counter.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-3.1 | UC-3 Primary Flow step 3, FR-10.1, FR-10.2 | FIXTURE | `planner`, given a `gaps` array as input, returns ≥1 replan slice using the standard `Files:`/`Changes:`/`Verify:`/`Done when:` fields, targeting the gap's `verifies_with` action | Fixture `tests/fixtures/agents/planner/gaps-input/gaps.json`: one entry `{level: 4, finding: "no test exercises POST /api/widgets", location: "src/routes/widgets.ts:42", verifies_with: "an integration test posting a non-trivial payload and asserting the 201 response body"}` | Invoke `planner` with this `gaps` array as structured input (not prose) | Returned output contains ≥1 slice with all four standard fields; the `Verify:` condition operationalizes the stated `verifies_with` text; `planner` issues zero `Write`/`Edit` tool calls (it has none) |
| TC-3.2 | UC-3 Primary Flow, AC-2 | BEHAVIORAL | Full loop, zero human involvement: Gate 6 fails with `gaps` → orchestrator feeds `gaps` to `planner` → orchestrator appends returned slice(s) → `/implement-slice` executes them → Gate 6 reruns → `VERIFIED` → `MERGE READY` | Seeded feature reusing TC-1.1's present-unverified fixture (one L4 gap) | Run `/merge-ready`'s Auto-Fix Protocol against the seeded feature end to end; record: (a) plan-file diff before/after append; (b) commit log; (c) rerun verdict; (d) overall result | Plan file's slice count strictly increases; every pre-existing slice is byte-identical before/after (diffable); a new commit exists for the replan slice; `docs/verification/<feature>.md`'s only writes across the whole flow are attributable to `verifier`; Gate 6 rereads `VERIFIED`; overall `MERGE READY`. No human read the report, edited the plan, or approved the replan slice. Not automatable in CI today — full multi-agent loop, human-observed only |
| TC-3.3 | UC-3-A1, FR-10.1 | BEHAVIORAL | `FAILED` (not only `PRESENT_BEHAVIOR_UNVERIFIED`) also feeds the identical loop | Seeded feature with a Level 2 BLOCKER finding instead of an L4 gap | Run the Auto-Fix Protocol | Identical mechanism fires: `planner` consumes `gaps` → replan slice → rerun → resolved. Not automatable in CI today |
| TC-3.4 | UC-3-E1, FR-10.3 | BEHAVIORAL | 3-attempt budget exhausted → escalation, no 4th loop | Seeded gap whose replan slice's own test retains a residual defect, so Gate 6 fails again after each of 3 fix attempts | Run the loop for 3 total attempts | After attempt 3 still fails, the Auto-Fix Protocol reports `NOT MERGE READY`, naming the remaining `gaps` entries individually; `.claude/scratchpad.md` shows `Gate 6 attempts: 3/3`; no 4th `Agent` invocation for Gate 6 occurs. Not automatable in CI today |
| TC-3.5 | UC-3-EC1, FR-3.2 | FIXTURE | A gap whose `verifies_with` names an unautomatable action → `planner` does not fabricate a testable slice for it | Fixture `gaps.json` with one entry: `verifies_with: "manually confirm the third-party webhook fires in the vendor's own dashboard"` | Invoke `planner` with this `gaps` array | Returned output either omits a slice for this entry entirely or explicitly flags it as requiring human verification — no fabricated automated test is produced for an action `planner` cannot express as a testable slice |
| TC-3.6 | AC-20, FR-10.5 | BEHAVIORAL | `.claude/scratchpad.md`'s attempt counter increments after each Gate 6 attempt, read from the file, not memory | Seeded 2-attempt loop (fails once, passes on attempt 2) | After attempt 1, inspect the scratchpad; after attempt 2, inspect again | After attempt 1: `Gate 6 attempts: 1/3`. The value read to decide whether to retry is the one in the file, not a value carried only in conversation state. Not automatable in CI today |
| TC-3.7 | FR-10.5 (constraint C6 — compaction survival) | BEHAVIORAL | A simulated context compaction mid-loop does not reset the attempt counter to zero | `.claude/scratchpad.md` shows `Gate 6 attempts: 2/3` from a prior attempt; a fresh session begins with only the scratchpad as persisted state (no conversation memory of prior attempts) | Instruct the fresh-session orchestrator to resume the Gate 6 retry loop for this feature | The orchestrator reads `2/3` from the scratchpad before deciding whether to retry; if it retries, it records `3/3` — not a restart from `1/3`. Proves the counter survives via durable state, not conversation memory. Not automatable in CI today — requires a manually simulated compaction boundary |
| TC-3.8 | AC-22, FR-10.2 | STATIC | `agents/planner.md`'s `tools:` frontmatter is unchanged (`Read, Glob, Grep, WebSearch, WebFetch`; no `Write`/`Edit`) | `agents/planner.md` exists | Read/grep the frontmatter | Exactly the five listed tools, no `Write`/`Edit` — confirms the plan-file mutation in TC-3.2 is attributable only to the orchestrator's own tool calls, never to `planner` |

**Note (behavioral clarification, UC-3-A2, not separately counted):** the merge-ready fix round that followed this document's initial authoring added a mandatory re-review requirement — once the replan loop above has committed any slice, Gate 2 (Code Review) and Gate 3 (Security Audit) MUST be re-run over those specific commits before a subsequent `VERIFIED` from Gate 6 may permit `MERGE READY` (`skills/merge-ready/SKILL.md`'s Gate 6 specialization section). TC-3.2's BEHAVIORAL primary-flow test case, when actually executed, MUST additionally confirm this re-review fires — a `VERIFIED` verdict reached over unreviewed replan commits does not satisfy TC-3.2's expected result.

---

## 6. UC-4: Level 2 Anti-Pattern Severity Split — Marker Table Full Coverage

This section is the dedicated, row-by-row coverage of FR-4.1's marker table, its issue-reference variants, and the `pass  # TODO` compound exception.

### 6.1 One Test Case per FR-4.1 Marker Row (11 rows)

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.1 | UC-4 Primary Flow, AC-11 | FIXTURE | `TBD`, no issue reference on the same line | Fixture: production file with `TBD` and nothing else on that line | Invoke `verifier`'s Level 2 scan | Level 2 reports **FAIL**; `gaps` has a `level: 2` entry classifying it BLOCKER; overall verdict `FAILED` |
| TC-4.2 | FR-4.1 | FIXTURE | `FIXME`, no issue reference | Fixture: production file with bare `FIXME` | Invoke Level 2 | BLOCKER; Level 2 FAIL |
| TC-4.3 | FR-4.1 | FIXTURE | `XXX`, no issue reference | Fixture: production file with bare `XXX` | Invoke Level 2 | BLOCKER; Level 2 FAIL |
| TC-4.4 | FR-4.1 | FIXTURE | `TODO` (bare), no compound pattern | Fixture: production file with a standalone `// TODO: revisit later` comment on an otherwise-complete function | Invoke Level 2 | WARNING (unconditional); Level 2 still **PASS**; finding mirrored into `gaps` at `level: 2` |
| TC-4.5 | FR-4.1 | FIXTURE | `HACK` | Fixture: production file with `// HACK: temporary workaround` | Invoke Level 2 | WARNING (unconditional); Level 2 PASS |
| TC-4.6 | FR-4.1 | FIXTURE | `PLACEHOLDER` / `placeholder` (case variance) | Fixture: two files, one with `PLACEHOLDER`, one with `placeholder` | Invoke Level 2 against each | Both: WARNING (unconditional); Level 2 PASS |
| TC-4.7 | FR-4.1 | FIXTURE | `stub` | Fixture: production file containing the literal token `stub` describing an incomplete function | Invoke Level 2 | BLOCKER (unconditional); Level 2 FAIL |
| TC-4.8 | FR-4.1 | FIXTURE | `not implemented` | Fixture: production file with the literal phrase `not implemented` | Invoke Level 2 | BLOCKER (unconditional); Level 2 FAIL |
| TC-4.9 | FR-4.1 | FIXTURE | `throw new Error('Not implemented')` | Fixture: a JS/TS function body consisting of this throw | Invoke Level 2 | BLOCKER (unconditional); Level 2 FAIL |
| TC-4.10 | UC-4-E1, FR-4.1 | FIXTURE | `raise NotImplementedError` — unconditional BLOCKER, no issue-reference exception available | Fixture: a Python function body with this raise, and (to prove "unconditional") an issue reference token on the same line | Invoke Level 2 | BLOCKER regardless of the same-line issue reference — unlike `TBD`/`FIXME`/`XXX`, no downgrade path exists; Level 2 FAIL |
| TC-4.11 | UC-4-EC1, FR-4.4, AC-12 | FIXTURE | Compound pattern `pass  # TODO` as a function body → BLOCKER despite containing the bare, WARNING-tier token `TODO` | Fixture: Python function body reading exactly `pass  # TODO` (empty implementation, trailing comment) — not merely a standalone `# TODO` comment inside an otherwise-complete function | Invoke Level 2; `verifier` MUST check the compound pattern before applying the bare-`TODO` rule (FR-4.4) | BLOCKER (unconditional); Level 2 FAIL; overall verdict `FAILED` |

### 6.2 Issue-Reference Variant Coverage (FR-4.2)

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.12 | UC-4-A1, AC-11 | FIXTURE | `TBD(#42)` — bare-digits issue reference form | Fixture: identical file to TC-4.1 except `TBD(#42)` on the same line | Invoke Level 2 | Reclassifies to WARNING; Level 2 reports **PASS**; finding still listed in `gaps` at `level: 2`; does not, by itself, force `FAILED` |
| TC-4.13 | FR-4.2 | FIXTURE | `TBD JIRA-456` — project-key form (`<UPPERCASE>-<digits>`) | Fixture: `TBD` with `JIRA-456` on the same line | Invoke Level 2 | WARNING; Level 2 PASS |
| TC-4.14 | FR-4.2 | FIXTURE | `TBD https://github.com/org/repo/issues/42` — issue/PR URL form | Fixture: `TBD` with an `.../issues/42` URL on the same line | Invoke Level 2 | WARNING; Level 2 PASS |
| TC-4.15 | FR-4.1, FR-4.2 | FIXTURE | `FIXME(#7)` — confirms the identical issue-reference mechanism applies to `FIXME`/`XXX`, not only `TBD` | Fixture: `FIXME` with `#7` on the same line | Invoke Level 2 | WARNING; Level 2 PASS |
| TC-4.16 | FR-4.2 (negative — same-line requirement is literal) | FIXTURE | An issue reference present **elsewhere in the file**, but not on the marker's own line, does not downgrade it | Fixture: `TBD` on line 10 with nothing else on that line; `#42` appears elsewhere on line 50, unrelated | Invoke Level 2 | BLOCKER — no downgrade; per FR-4.2, "a marker with no such token on the same line has no issue reference, regardless of whether one exists elsewhere in the file" |

### 6.3 File-Level PASS Despite WARNING-Only Findings (UC-4-A2)

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.17 | UC-4-A2, FR-4.3, FR-2.4 | FIXTURE | A file with only WARNING-tier markers (`TODO`, `HACK`, `PLACEHOLDER`) and no BLOCKER anywhere still reports Level 2 PASS, and all three findings are individually recorded | Fixture: one production file containing all three WARNING-tier tokens, no BLOCKER-tier token anywhere | Invoke Level 2 | Level 2 reports **PASS**; `gaps` contains 3 separate `level: 2` entries, one per marker — PASS at the level does not mean the findings are dropped from the machine-readable report |

### 6.4 Negative / False-Positive — Legitimate `TODO` Excluded From Scan

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.18 | UC-4 preconditions ("the existing exclusion list") | FIXTURE | A `TODO` appearing only inside a `*.test.ts` test file (per the standing exclusion list: test files, markdown, config, genuinely informational comments) is not scanned or reported at all | Fixture: `widgets.test.ts` containing `// TODO: add a case for the 404 path`, no production file affected | Invoke Level 2 against the fixture project | Level 2 finds zero markers; `gaps` has zero `level: 2` entries for this file — this is the required false-positive-avoidance case: a guard/scan that fired on excluded files would stall unrelated runs |

### 6.5 Structural Check

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.19 | FR-4.1, FR-4.3, FR-4.4 | STATIC | `agents/verifier.md`'s Level 2 section documents the full marker set, its BLOCKER/WARNING split, and the `pass  # TODO` exception | `agents/verifier.md` exists | Read the Level 2 section | Lists all 11 marker forms with tiers matching FR-4.1's table, states the issue-reference downgrade rule, states the `pass  # TODO` exception, and states the existing exclusion list |

---

## 7. UC-5: Verifier's Machine-Readable Report — Scoped Write Target

UC-5 has **no Error Flows** per the use-case document itself ("None. A well-formed `verifier` run always reaches step 5..."). No error-flow test case is added here — cross-reference TC-1.4/1.5/1.6, which already cover the mechanism-failure branches (`UNCERTAIN`) the use-case document points to instead.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-5.1 | UC-5 Primary Flow | FIXTURE | First write for a feature — `docs/verification/` does not yet exist | Fixture project with no `docs/verification/` directory at all | Invoke `verifier` to completion against any well-formed fixture (reuse TC-1.1) | `docs/verification/` is created; `docs/verification/<slug>.md` exists with all 5 minimum frontmatter fields present; `gaps`/`human_verification_required` present as arrays (never omitted, even when empty); body retains the prose `### Verification Report` structure below the frontmatter |
| TC-5.2 | UC-5-A1 | FIXTURE | Subsequent write for the same feature (rerun) overwrites, not appends | `docs/verification/<slug>.md` already exists from a prior run | Invoke `verifier` a second time against the same feature (with an updated fixture state) | The same path is overwritten with the current run's verdict; no second/duplicate file is created; the file remains per-feature, current-run — not append-only across runs (distinct from `CHANGELOG.md`) |
| TC-5.3 | AC-14 | STATIC | `agents/verifier.md`'s `tools:` frontmatter is exactly `Read, Glob, Grep, Write` | `agents/verifier.md` exists | Grep the frontmatter | Exactly these 4 tools; no `Edit`, no `Bash` |
| TC-5.4 | AC-14 | STATIC | Constraints section states the deny-by-default prohibition, not an unqualified read-only line or a scope-grant phrasing | `agents/verifier.md` exists | Read the Constraints section | Text reads as a prohibition ("`verifier` MUST NOT Write to any path other than `docs/verification/<feature-slug>.md`, and MUST NOT Edit any file"), not "MAY Write only to X" and not the old unqualified "Read-only" line |
| TC-5.5 | UC-5-EC1 (documented limitation) | STATIC | No per-path tool-permission mechanism in this harness mechanically restricts *where* `verifier`'s `Write` calls may target — the restriction is prompt-enforced only | `templates/settings.json`, `hooks/` directory | Grep both for any `permissions.deny` entry or hook keyed on `agent_type` that would scope `verifier`'s `Write` calls | No such mechanical restriction exists anywhere in the repo — confirms the gap is real, not closed by this feature (FR-2.2's own Design Decision 11 records this explicitly, and Section 9.10 Dependency 12 requires mandatory `security-auditor` pre-review as the mitigation, not a mechanical guard). This test case's "pass" condition is confirming the absence, not asserting a guarantee that does not exist |
| TC-5.6 | FR-2.7 | STATIC | `skills/merge-ready/SKILL.md` states Gate 6 obtains the UTC timestamp via `date -u +'%Y-%m-%d %H:%M'` before delegating to `verifier`, and states both the feature slug and timestamp verbatim in the delegation prompt | `skills/merge-ready/SKILL.md` exists | Read Gate 6's section | Text states this exact procedure |
| TC-5.7 | AC-15 | FIXTURE | `verifier`, invoked with a supplied timestamp and slug, uses the timestamp verbatim for `generated_at` — never recomputes or estimates it | Delegation prompt states `generated_at: 2026-08-15 14:32` and `feature: verification-review-upgrade` verbatim | Invoke `verifier` with this prompt against any fixture | Output frontmatter's `generated_at` field is byte-identical to `2026-08-15 14:32` |
| TC-5.8 | AC-15 | FIXTURE | `verifier`, invoked with no timestamp supplied (a direct, ad hoc invocation outside `/merge-ready`), omits `generated_at` and includes `generated_at_note` instead — never invents a value | Prompt contains no `generated_at`/timestamp field at all | Invoke `verifier` directly (not via Gate 6) against any fixture | No `generated_at` key present in the output frontmatter; `generated_at_note` is a non-empty string explaining the omission |

---

## 8. UC-6: Plan Critic — Autonomous and Interactive Invocation (+ Regression Protection for the Extraction, AC-4)

### 8.1 Structural Checks

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-6.1 | FR-5.1 | STATIC | `agents/plan-critic.md` exists with frontmatter `name: plan-critic`, non-empty `description`, a `tools` list, and a `model` | Implementation complete | Read the file, parse frontmatter | All fields present and well-formed |
| TC-6.2 | UC-6-EC1, AC-8 | STATIC | `tools:` list does not contain `Write` | `agents/plan-critic.md` exists | Grep the frontmatter's `tools` list | `Write` absent — a hard, mechanically-checkable constraint (not a prompt-level instruction the agent could be talked out of); this is also the answer to UC-6-EC1's "impossible by construction" claim — no separate runtime test is needed since the tool call is structurally unavailable |
| TC-6.3 | AC-7 | STATIC | `node scripts/ci/validate-agents.js` exits 0 against a repo state with 14 files under `agents/`, including well-formed `plan-critic.md` | Implementation complete, `agents/plan-critic.md` present | Run `node scripts/ci/validate-agents.js` | Exit code `0` |
| TC-6.4 | AC-7 (negative) | STATIC | The same command exits non-zero against 3 independently malformed `plan-critic.md` variants | Scratch copies: (a) missing a required frontmatter field, (b) `name:` not matching filename, (c) invalid `model:` value | Run the validator against each variant in turn | Non-zero exit for all 3 |
| TC-6.5 | AC-13, FR-5.9 | STATIC | `skills/bootstrap-feature/SKILL.md` Step 5 invokes `plan-critic` after the planner produces the plan and before Step 6 (Git Setup) | `skills/bootstrap-feature/SKILL.md` exists | Read Step 5's text and confirm ordering relative to Step 6 | The `plan-critic` invocation sub-step textually precedes the Git Setup step; Output Format gains a "Plan Critique" block |
| TC-6.6 | AC-17 | STATIC | `README.md` states the agent count as 14 consistently in its opening description and "Agents" heading, and lists `plan-critic` | `README.md` exists | Read the file | Both locations read 14; `plan-critic` appears in the agent list with a model tier |
| TC-6.16 | FR-5.8 | STATIC | `src/claude.md`'s Agency Roles table gains a `plan-critic` row | `src/claude.md` exists | Read the Agency Roles table | A row reads `| Plan Critic | plan-critic | Adversarial plan review — BLOCKER/WARNING/INFO findings before implementation begins |` (or equivalent wording matching FR-5.8) |

### 8.2 Behavioral Coverage of the Checks Themselves

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-6.7 | UC-6-A2, FR-5.3 | FIXTURE | A hand-reviewed, defect-free "golden" plan produces zero BLOCKER findings on loop 1 | Fixture `tests/fixtures/agents/plan-critic/golden-plan.md`: tracer marker present, Wave 1 occupied by the tracer alone, `Files (union)` columns correct, every `Done when:` testable, no shared files across any wave | Invoke `plan-critic` against the fixture | `FINDINGS: none` (or zero BLOCKER, WARNING/INFO acceptable) — paired with TC-6.8–6.10 below (which prove the agent does NOT return "none" against known-defective input), this is the AC-4-style methodology FR-5.3's "treated with skepticism" instruction implies: a clean result is only trustworthy relative to a fixture independently confirmed defect-free |
| TC-6.8 | AC-18(i), FR-5.10(i) | FIXTURE | Plan fixture with no slice marked `**Tracer:** yes` → BLOCKER | Fixture `tests/fixtures/agents/plan-critic/no-tracer-marker.md` | Invoke `plan-critic` | FINDINGS includes a BLOCKER-tier entry for the missing tracer marker |
| TC-6.9 | AC-18(ii), FR-5.10(ii) | FIXTURE | Waved plan fixture whose Wave 1 contains a non-tracer slice (alongside or instead of the tracer) → BLOCKER | Fixture `tests/fixtures/agents/plan-critic/wave1-non-tracer.md` | Invoke `plan-critic` | FINDINGS includes a BLOCKER-tier entry for the Wave-1 violation |
| TC-6.10 | AC-18(iii), FR-5.10(iii) | FIXTURE | A wave's declared `Files (union)` column omits a file present in one of its own slices' `Files:` lists → BLOCKER | Fixture `tests/fixtures/agents/plan-critic/union-mismatch.md` | Invoke `plan-critic` | FINDINGS includes a BLOCKER-tier entry naming the omitted file and the wave |
| TC-6.11 | UC-6-E1, FR-5.5 | BEHAVIORAL | A BLOCKER finding surviving loop 3 escalates per Rule 4, not a 4th loop | Fixture plan whose defect the orchestrator's own (deliberately incomplete) fixes never fully resolve across 3 loops | Invoke `plan-critic` (loop 1), apply a partial fix, re-invoke (loop 2), apply a partial fix, re-invoke (loop 3), confirm a BLOCKER remains | The workflow escalates per Rule 4: stops, presents the remaining BLOCKER findings verbatim, states the decision needed and options — no loop 4 occurs. Not automatable in CI today — requires 3 live sequential agent invocations interleaved with orchestrator decisions |
| TC-6.13 | AC-23, FR-5.6 | STATIC | `src/claude.md`'s Plan Critic Pass Step 1 states the visible-warning fallback when `plan-critic` is unresolvable | `src/claude.md` exists | Read Step 1's text for the fallback wording | Step 1 states — warn, naming `plan-critic` as unresolvable, and proceed to `ExitPlanMode` without a critique; it must not silently skip with no notice |
| TC-6.17 | AC-23, FR-5.6 | BEHAVIORAL | The simulated fallback in TC-6.13 actually fires during a live session | A scratch checkout with `agents/plan-critic.md` renamed/hidden (simulating a memory-layer-only install with no plugin agents present) | Run the interactive plan-mode flow up to the Plan Critic Pass step against the scratch checkout | A visible warning naming `plan-critic` unresolvable is printed, and `ExitPlanMode` is still reached without blocking — it does not skip the critique step with no notice at all. Not automatable in CI today — manual/observed only |
| TC-6.15 | UC-6-A1, FR-5.6 | BEHAVIORAL | Interactive path: a human in plan-mode triggers the identical `plan-critic` agent via the same FR-5.5 loop, not a different mechanism | Interactive plan-mode session (not a `/develop-feature`/`/bootstrap-feature` run) with a plan file ready for critique | Reach the "Plan Critic Pass" step in `src/claude.md`'s stub; observe the invocation | `plan-critic` is invoked via the `Agent` tool, following the identical FR-5.5 loop mechanism as the autonomous path (TC-6.7–6.11) — confirms this is a pre-existing trigger point with a swapped mechanism, never the *only* path to a critique. Not automatable in CI today — requires a human-observed interactive session |

**Note (behavioral clarification, UC-6-A3, not separately counted):** the merge-ready fix round clarified that the fix pass (step 2 of the FR-5.5 loop) is gated on *any* BLOCKER-or-WARNING finding, not on a BLOCKER specifically — only *re-invocation* (loop 2/3) is gated on a BLOCKER having been found. None of TC-6.7–6.11 exercises a loop-1-returns-WARNING-only-zero-BLOCKER input; a fixture doing so would need to confirm the orchestrator still applies the WARNING fixes before proceeding directly to Step 6, without a second `plan-critic` invocation.

### 8.3 Regression Protection for the Extraction (AC-4)

`src/claude.md` lines 102–166 (the 65-line inlined Plan Critic prompt) are **deleted** by this feature's migration slice. AC-4 requires proving `agents/plan-critic.md` matches or beats that prompt on identical input — which is only possible if the pre-migration text is captured **before** it is deleted.

**Mandatory capture procedure (must run as part of the migration slice itself, before the deleting commit lands):** immediately before the slice that removes `src/claude.md` lines 102–166 makes its commit, copy the blockquote's exact text verbatim — via `git show <pre-migration-commit-sha>:src/claude.md` against the last commit that still contains it, or a direct copy while the lines still exist on disk — into a permanent, committed fixture file, `tests/fixtures/plan-critic/pre-migration-prompt.md`. This is a one-time capture: once committed, the fixture is permanent and the deleted source is never needed again for this comparison.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-6.14 | AC-4, FR-5.2 | FIXTURE | `agents/plan-critic.md` matches or beats the captured pre-migration prompt on an identical injected-defect fixture | (1) `tests/fixtures/plan-critic/pre-migration-prompt.md` exists per the capture procedure above. (2) `tests/fixtures/plan-critic/defective-plan.md`: a plan with one deliberately injected defect — a wave with two slices sharing a file (the AC-4 example) | (1) Run the captured pre-migration prompt as a one-off `Agent`-tool invocation, using its captured text verbatim as the instruction (mirroring how it was originally invoked: "launch a `Plan` subagent with this prompt"), against `defective-plan.md`; record its `FINDINGS:` output. (2) Run `agents/plan-critic.md` against the identical `defective-plan.md`; record its `FINDINGS:` output. (3) Diff the two outputs for the specific injected defect | `agents/plan-critic.md`'s FINDINGS list reports the injected file-sharing-wave defect at BLOCKER severity, at the same or better count/detail as the pre-migration prompt's CRITICAL-severity finding for the identical defect — the migration did not silently drop or weaken the check. Not automatable in CI today (two separate live agent-style invocations required); additionally depends on the one-time historical capture step above having already run before this test can exist at all |

---

## 9. UC-7: Reviewer Confidence Filter and Diff-Scoping

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-7.1 | UC-7 Primary Flow | FIXTURE | A sub-80%-confidence, non-CRITICAL finding is omitted entirely, not footnoted | Fixture `tests/fixtures/agents/code-reviewer/low-confidence-naming/`: a diff with a genuinely debatable, mildly-inconsistent naming choice — not clearly wrong | Invoke `code-reviewer` against the diff | The Issues list contains no entry referencing this location at all — not deprioritized, not footnoted, simply absent |
| TC-7.2 | UC-7-A1, AC-9 | FIXTURE | A CRITICAL finding at low self-assessed confidence is still reported (the carve-out) | Fixture: a diff with a dynamic-query-construction pattern that is SQL-injection-shaped but genuinely ambiguous (might be parameterized elsewhere) | Invoke `code-reviewer` | Findings list contains an entry tagged CRITICAL for this location, unconditionally — the 80% threshold does not apply to CRITICAL-tier findings under any circumstance |
| TC-7.3 | UC-7-A2, AC-10 | FIXTURE | 5 structurally identical missing-null-check findings across 5 files consolidate into exactly 1 entry | Fixture: a diff touching 5 files, each missing an identical null-check pattern on a newly-added parameter | Invoke `code-reviewer` | Exactly 1 consolidated finding listing all 5 affected locations, not 5 separate entries |
| TC-7.4 | UC-7-A3 | FIXTURE | An unrelated, pre-existing MEDIUM-tier issue adjacent to (not inside) the diff's changed hunks is not reported | Fixture: a diff whose changed hunks are clean, but an adjacent, untouched function has a pre-existing MEDIUM issue | Invoke `code-reviewer` | The pre-existing issue does not appear anywhere in the Issues list |
| TC-7.5 | UC-7-A4 | FIXTURE | The identical adjacent-but-outside-diff scenario, but CRITICAL-tier, is still reported | Fixture: same as TC-7.4, except the pre-existing issue is an unauthenticated admin endpoint one function above the diff | Invoke `code-reviewer` | The CRITICAL finding is reported — diff-scoping carries the same CRITICAL exception as the confidence filter |
| TC-7.6 | UC-7-EC1 | FIXTURE | A finding assessed at exactly 80% confidence is treated as below-threshold (the literal `>` reading, not `≥`) — best-effort verification, see caveat | Fixture engineered to be maximally boundary-ambiguous (neither clearly real nor clearly speculative) | Invoke `code-reviewer` | The finding is omitted (not reported) — **caveat**: an agent's self-reported confidence number cannot be forced to output exactly `80` by test-author construction; this fixture documents the intended boundary reading and is recorded as best-effort verification, not a hard numeric guarantee, consistent with FR-6.1's own text ("this threshold MUST be verified behaviorally, not numerically") |
| TC-7.7 | FR-6.3 | STATIC | `agents/code-reviewer.md` gains CRITICAL/HIGH/MEDIUM/LOW severity tiers in its Output Format, mirroring `security-auditor`'s existing tiers | `agents/code-reviewer.md` exists | Read the Output Format section | Four-tier severity prefix present per issue |
| TC-7.8 | FR-6.1, FR-6.2 (security-auditor variant) | FIXTURE | `security-auditor` applies the identical sub-80%-omission and CRITICAL-carve-out rules as `code-reviewer` | Fixture pair mirroring TC-7.1/TC-7.2, built for `security-auditor`'s domain (e.g. a low-confidence hardening suggestion vs. a low-confidence but plausible auth bypass) | Invoke `security-auditor` against each fixture | Low-confidence, non-CRITICAL: omitted. CRITICAL at any confidence: reported |
| TC-7.9 | Negative/false-positive (required coverage item) | FIXTURE | Explicit "correctly suppressed" framing: a plausible-sounding but genuinely low-confidence finding does not stall an unattended run by appearing as a blocking Issue | Same fixture and result as TC-7.1 | Cross-reference TC-7.1 | Recorded here under the negative/false-positive index as the canonical "false positive avoided" case (see Section 14) |

**Note (behavioral clarification, UC-7-EC2, not separately counted):** neither reviewer agent has a `Bash` tool, so neither can derive a `git diff` itself. TC-7.1–TC-7.9 above all assume the delegation prompt supplies a diff (Gate 2/Gate 3's normal trigger). When an invocation supplies none — e.g. a slice's `Pre-review: security` pass outside the normal Gate 2/3 trigger — FR-6.5's diff-scoping skip does not apply at all, and the agent scans the whole codebase as it did before this feature. A fixture proving this would omit the diff/changed-file-list from the delegation prompt entirely and confirm a non-CRITICAL, out-of-any-diff finding is still reported rather than silently skipped.

---

## 10. UC-8: Silent-Failure Severity Classification

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-8.1 | UC-8 Primary Flow, AC-9 | FIXTURE | Empty `catch {}` in a data-mutation route handler → CRITICAL, exempt from both the confidence filter and diff-scoping | Fixture: diff introducing `try { await db.widgets.update(id, payload); } catch {}` inside a mutating route handler | Invoke `code-reviewer` | Issues list contains this finding, tagged CRITICAL, naming the empty catch block's `file:line`, unconditionally |
| TC-8.2 | UC-8-A1 | FIXTURE | The identical empty-`catch{}` pattern wrapping a read-only, non-mutating operation → HIGH, not CRITICAL, and IS subject to the normal filter/diff-scoping | Fixture: `catch {}` wrapping an optional analytics-ping call with no data-integrity consequence | Invoke `code-reviewer` | Finding tagged HIGH; if it were also low-confidence or outside the diff, it could legitimately be omitted (unlike TC-8.1) |
| TC-8.3 | UC-8-A2 shape (b) | FIXTURE | `.catch(() => [])` / `.catch(() => null)` with no logging/rethrow/user-facing signal | Fixture: a promise chain coercing a rejection into a benign default with no side signal | Invoke `code-reviewer` | Finding reported, severity per the same data-mutation-vs-elsewhere rule as TC-8.1/8.2 |
| TC-8.4 | UC-8-A2 shape (c) | FIXTURE | A caught error whose only action is a logger call, with no rethrow/propagation/caller-visible signal | Fixture: `catch (e) { logger.error(e); }` with no further action | Invoke `code-reviewer` | Finding reported, severity per the same rule |
| TC-8.5 | UC-8-A2 shape (d) | FIXTURE | A promise chain with no `.catch()`/`try`-`catch` at all around a rejectable operation | Fixture: an `await` on a rejectable call, no surrounding error handling of any kind | Invoke `code-reviewer` | Finding reported, severity per the same rule |
| TC-8.6 | UC-8-EC1, FR-7.2 | FIXTURE | A caught-and-swallowed error in a read-only balance-calculation function feeding a financial display (no DB write) still qualifies CRITICAL under the "financial" half of the disjunction | Fixture: a function computing a balance for downstream display/charge, with a swallowed error and no mutation anywhere | Invoke `code-reviewer` | Finding tagged CRITICAL — proves the rule is satisfied by "financial" independent of "data-mutation," not only tested via the mutation half |

---

## 11. UC-9: Tracer-First Decomposition Gate

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-9.1 | FR-8.1, FR-8.2 | STATIC | `agents/planner.md`'s Output Format requires Slice 1 to be a vertical tracer with an explicit `**Tracer:** yes` marker and a real `Verify:` condition | `agents/planner.md` exists | Read the Output Format section | Text states the tracer requirement and the marker syntax |
| TC-9.2 | UC-9 Primary Flow | BEHAVIORAL | A passing tracer slice gates Wave 2's dispatch — no expansion-slice `Agent` calls before it | Seeded plan: Wave 1 = tracer slice alone; Wave 2 = one expansion slice; tracer's `Verify:` is engineered to pass | Run `/develop-feature` Phase 2 against the seeded plan | A commit exists for the tracer slice with a passing `Verify:` result; Wave 2's `Agent` call(s) are issued only after that commit — verifiable from the transcript's own call ordering. Not automatable in CI today |
| TC-9.3 | UC-9-E1, AC-6 | BEHAVIORAL | Tracer's `Verify:` still fails after the existing 3-retry budget → Phase 2 halts before any expansion-slice work | Seeded plan with a tracer whose `Verify:` command is engineered to always fail | Run `/develop-feature` Phase 2 | `git log` shows zero commits for any slice beyond the tracer; zero `Agent` tool calls issued for Wave 2; the blocker is reported via the existing Rule 3/Rule 4 escalation path. Not automatable in CI today |
| TC-9.4 | UC-9-EC1, AC-19, NFR-3 | BEHAVIORAL | A legacy plan with no `**Tracer:** yes` marker anywhere applies no gate, and prints the exact fallback notice before proceeding | Seeded plan (simulating a pre-F3 plan) with no tracer marker on any slice | Run `/develop-feature` Phase 2 | Slice 2 dispatches immediately after Slice 1 completes, with no `Verify:`-gating check beyond Slice 1's own normal per-slice verification; the exact string `tracer gate inactive — no **Tracer:** yes marker found; treating as pre-F3 plan.` is printed before Phase 2 proceeds to any slice. Not automatable in CI today |
| TC-9.5 | FR-8.6 | STATIC | `skills/develop-feature/SKILL.md` states the exact fallback notice string and the NFR-3 legacy-plan rule | `skills/develop-feature/SKILL.md` exists | Read Phase 2's section | The exact notice string and the NFR-3 fallback rule are both present verbatim |
| TC-9.6 | AC-16, FR-8.3 | BEHAVIORAL | A direct `/implement-slice` invocation targeting a non-tracer slice refuses when the plan's tracer has not yet passed its `Verify:` condition | Seeded plan whose tracer has NOT yet been run; direct invocation targets Slice 2 | Invoke `/implement-slice` on Slice 2 | The skill refuses before any test-writer/implementation work begins; its output names the tracer slice as the prerequisite and instructs running it first. Not automatable in CI today |
| TC-9.7 | FR-8.3 | STATIC | `skills/implement-slice/SKILL.md` states the pre-flight tracer-gating check | `skills/implement-slice/SKILL.md` exists | Read the file | A pre-flight check section states the refusal rule described in FR-8.3 |
| TC-9.8 | Negative/false-positive (required coverage item) | BEHAVIORAL | Explicit framing: "a plan legitimately lacking a tracer marker because it predates F3" is not retroactively gated — cross-reference, same fixture/result as TC-9.4 | Same fixture as TC-9.4 | Cross-reference TC-9.4 | Recorded here under the negative/false-positive index (Section 14) — a legacy plan's absence of the marker must never be treated as an authoring defect after the fact, only a freshly-critiqued plan is caught (FR-5.10) |

---

## 12. UC-10: Dispatch-Time Write-Surface Disjointness Check

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-10.1 | UC-10 Primary Flow, AC-5 | BEHAVIORAL | A wave with 2 slices sharing a file path is refused before any `Agent` tool call, naming the path and both slice numbers | Seeded plan: Wave 2 = Slice 3 (`Files: src/handlers/widgets.ts, src/routes/widgets.ts`), Slice 4 (`Files: src/handlers/widgets.ts, src/schemas/widget.ts`) | Run `/develop-feature` Phase 2 up to this wave's dispatch step | Zero `Agent` tool calls issued for Wave 2; the refusal message names `src/handlers/widgets.ts`, Slice 3, and Slice 4 explicitly. Not automatable in CI today |
| TC-10.2 | UC-10-A1, FR-9.4 | BEHAVIORAL | A case-insensitive collision (`src/Auth.ts` vs. `src/auth.ts` — textually different strings) is still flagged, always, regardless of the underlying filesystem | Seeded plan: Slice 3 declares `src/Auth.ts`; Slice 4 declares `src/auth.ts` | Run Phase 2's dispatch step | The wave is refused identically to TC-10.1, naming both slice numbers and the case-variant collision — the comparison is always case-insensitive, not conditional on filesystem detection. Not automatable in CI today |
| TC-10.3 | UC-10-A2, FR-9.6 | BEHAVIORAL | A refused wave recovers via Rule 3: `planner` reassigns the conflicting slice, the orchestrator re-derives and successfully dispatches | Continuing from TC-10.1's refusal | Orchestrator re-invokes `planner`, flagging Slice 3/Slice 4 and the shared path; `planner` reassigns Slice 4 to Wave 3 (or splits ownership); orchestrator re-derives Wave 2's `Files:` lists and re-attempts dispatch | No overlap remains; `Agent` tool calls for the revised Wave 2 are issued successfully — the run never dead-ends (NFR-1(b)). Not automatable in CI today |
| TC-10.4 | UC-10-A2 (planner-only slice of TC-10.3) | FIXTURE | `planner`, given a flagged conflicting slice pair and shared path, returns a revised wave assignment with no remaining overlap | Fixture input: `{conflict: {sliceA: 3, sliceB: 4, path: "src/handlers/widgets.ts"}}` | Invoke `planner` with this flagged-conflict input | Returned plan revision reassigns one of the two slices to a later wave, or splits file ownership, such that no `Files:` overlap remains between them |
| TC-10.5 | UC-10-EC1, FR-9.2 (negative/false-positive, required coverage item) | BEHAVIORAL | A single-slice wave performs no disjointness computation at all — dispatch proceeds directly; documented limitation, see caveat | Seeded plan: Wave 3 names exactly one pending slice | Run Phase 2's dispatch step for Wave 3 | Dispatch proceeds with no refusal — **documented limitation**: this runtime-observable outcome (no refusal) is identical whether the check was correctly skipped or trivially computed-and-passed; this test can only assert the observable half, not that the computation itself never ran. The procedural "skipped, not computed" claim is verified only via TC-10.6's static check, mirroring the honest-limitation precedent set by `blocking-guards_test_cases.md`'s UC-9-EC4 |
| TC-10.6 | UC-10-EC1, FR-9.2 | STATIC | `skills/develop-feature/SKILL.md` states the single-slice-wave-requires-no-check rule explicitly | `skills/develop-feature/SKILL.md` exists | Read Phase 2's dispatch section | Text states "a single-slice wave requires no check (nothing to conflict with)" or equivalent |
| TC-10.7 | FR-9.5, NFR-5 | STATIC | The disjointness check is orchestrator prose, not a separate script — no new `.js` file is introduced for this purpose | Implementation complete | Grep `scripts/` and `hooks/` for any new file related to wave-file disjointness | No new script exists; the check lives entirely in `skills/develop-feature/SKILL.md`'s prose, consistent with NFR-5 (markdown-only) |
| TC-10.8 | UC-10 Error Flows note, FR-9.6 | BEHAVIORAL | A Rule 3 replan that genuinely cannot resolve the conflict (inseparable work) falls back to Rule 4 escalation, not a silent stall or infinite retry | Seeded plan where the two conflicting slices' work is, by construction, inseparable onto disjoint files | Run TC-10.3's recovery path against this fixture | After one Rule 3 attempt fails to resolve it, the orchestrator escalates per Rule 4 (stops, presents the conflict, states options) — it does not retry Rule 3 indefinitely. Not automatable in CI today |

---

## 13. Verdict Matrix (Cross-Cutting)

Every reachable combination of Level 1–4 outcomes and the single verdict it must produce, per FR-1.2's fixed precedence order. `L1`/`L2`/`L3` outcomes are `PASS`/`FAIL`/`SKIPPED`; `L4` outcomes are `EXERCISED` (VERIFIED-worthy), `NOT-EXERCISED`, `SKIPPED` (nothing to attempt), or `AMBIGUOUS` (a genuinely ambiguous static-analysis finding).

| Row | L1 | L2 | L3 | L4 | Verdict | Precedence Rule Applied | Covering Test Case(s) |
|---|---|---|---|---|---|---|---|
| 1 | PASS | PASS (no BLOCKER) | PASS | EXERCISED | `VERIFIED` | 3rd in order — none of FAILED/UNCERTAIN apply | TC-1.2 |
| 2 | PASS | PASS | PASS | NOT-EXERCISED | `PRESENT_BEHAVIOR_UNVERIFIED` | 4th/default — nothing else applies | TC-1.1 |
| 3 | FAIL | (any) | (any) | (any, incl. would-be EXERCISED) | `FAILED` | 1st, always wins — L1 FAIL dominates regardless of L3/L4 evidence | TC-1.3 |
| 4 | PASS | FAIL (BLOCKER present) | (any) | (any) | `FAILED` | 1st — L2 BLOCKER dominates | TC-4.1, TC-4.7–TC-4.11 |
| 5 | PASS | PASS | FAIL | (any) | `FAILED` | 1st — L3 FAIL dominates | (mechanically identical to Row 3/4; no dedicated fixture beyond the general FAILED-precedence proof in TC-1.7) |
| 6 | SKIPPED (no plan/scratchpad) | PASS | PASS | — (not reached) | `UNCERTAIN` | 2nd — "could not reach a determination" | TC-1.4 |
| 7 | PASS | PASS | SKIPPED (unresolvable dynamic import) | — (not reached) | `UNCERTAIN` | 2nd | TC-1.5 |
| 8 | PASS | PASS | PASS | SKIPPED (every path behind a dynamic import) | `UNCERTAIN` — **never** `PRESENT_BEHAVIOR_UNVERIFIED` | 2nd, the FR-1.2/constraint-C7 pin — distinguishes this row from Row 2 | TC-1.6, AC-21 |
| 9 | PASS | PASS | PASS | AMBIGUOUS (genuinely ambiguous finding under static-analysis-only scope) | `UNCERTAIN` | 2nd | TC-13.1 |
| 10 | FAIL | (any) | SKIPPED | (any) | `FAILED` — **not** `UNCERTAIN`, despite an UNCERTAIN condition also holding | 1st beats 2nd — the explicit precedence-conflict proof | TC-1.7 |
| 11 | PASS | PASS (WARNING-tier markers present, no BLOCKER) | PASS | EXERCISED | `VERIFIED` — WARNING findings recorded in `gaps` but never elevate the verdict | 3rd — WARNING never contributes to FAILED (FR-4.5) | TC-13.1 |

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-13.1 | Matrix Row 9 (`UNCERTAIN` via genuine ambiguity) and Row 11 (`VERIFIED` despite recorded WARNING findings) | FIXTURE | Two composite fixtures proving the two matrix rows not otherwise covered by an existing TC | (a) Fixture with L1–L3 PASS and one L4 finding `verifier` itself assesses as genuinely ambiguous under its static-analysis-only scope (e.g. a traced chain where one link's realness is undecidable from source alone). (b) Fixture combining TC-4.17's WARNING-only Level 2 result with TC-1.2's exercised L4 path in one project | Invoke `verifier` against (a), then separately against (b) | (a): `verdict: UNCERTAIN`, `human_verification_required` non-empty describing the ambiguity. (b): `verdict: VERIFIED`, `passed: true`, `gaps` still contains the 3 WARNING-tier `level: 2` entries from TC-4.17 (recorded, not dropped), and `human_verification_required: []` |

Row 5 is asserted as mechanically identical to Rows 3–4 rather than given its own fixture — the FAILED-precedence mechanism is proven once (TC-1.7, Row 10) and does not need re-proving for every individual Level that can trigger it; adding a fourth near-duplicate fixture here would be padding, not new coverage.

---

## 14. Negative / False-Positive Cases (Consolidated Index)

A guard, filter, or gate that fires when it should not is what stalls an unattended run — as important as the positive cases. All required items, plus related ones surfaced while drafting the sections above:

| # | Negative / False-Positive Case | Covering Test Case(s) |
|---|---|---|
| 1 | A legitimate `TODO` in a test file is excluded from the Level 2 scan entirely | TC-4.18 |
| 2 | A plan legitimately lacking a tracer marker because it predates F3 is not retroactively gated | TC-9.4, TC-9.8 |
| 3 | A single-slice wave requires no disjointness check at all | TC-10.5, TC-10.6 |
| 4 | A reviewer finding correctly suppressed as sub-80%-confidence does not stall the pipeline | TC-7.1, TC-7.9 |
| 5 | A `TBD`/`FIXME`/`XXX` marker with an issue reference present *elsewhere in the file* but not on the same line is **not** downgraded — the same-line requirement is literal | TC-4.16 |
| 6 | An unrelated, pre-existing non-CRITICAL finding adjacent to (but outside) a diff's changed hunks is not reported | TC-7.4 |
| 7 | `verifier`'s scoped-write restriction has no mechanical enforcement — recorded as a known, accepted gap (not silently claimed as closed) | TC-5.5 |

---

## 15. AC → TC Coverage Table

| AC | Test Case(s) |
|---|---|
| AC-1 | TC-1.1, TC-1.9 |
| AC-2 | TC-3.2 |
| AC-3 | TC-2.1, TC-2.2 |
| AC-4 | TC-6.14 |
| AC-5 | TC-10.1 |
| AC-6 | TC-9.3 |
| AC-7 | TC-6.3, TC-6.4 |
| AC-8 | TC-6.2 |
| AC-9 | TC-7.2, TC-8.1 |
| AC-10 | TC-7.3 |
| AC-11 | TC-4.1, TC-4.12 |
| AC-12 | TC-4.11 |
| AC-13 | TC-6.5 |
| AC-14 | TC-5.3, TC-5.4 |
| AC-15 | TC-5.7, TC-5.8 |
| AC-16 | TC-9.6 |
| AC-17 | TC-6.6 |
| AC-18 | TC-6.8, TC-6.9, TC-6.10 |
| AC-19 | TC-9.4 |
| AC-20 | TC-3.6 |
| AC-21 | TC-1.6 |
| AC-22 | TC-3.8 |
| AC-23 | TC-6.13, TC-6.17 |

Every AC-1 through AC-23 is named and covered by at least one test case above; none is padded with a vacuous case.

---

## 16. UC → TC Coverage Table

| UC Scenario | Test Case(s) |
|---|---|
| UC-1 Primary Flow | TC-1.1, TC-1.9 |
| UC-1-A1 | TC-1.2 |
| UC-1-E1 | TC-1.3 |
| UC-1-EC1 | TC-1.4, TC-1.5, TC-1.6 |
| UC-1-EC2 | TC-1.7 |
| UC-2 Primary Flow | TC-2.1, TC-2.2 |
| UC-2-A1 | (no dedicated fixture — demonstrated by TC-1.1–TC-1.6's field values; see Section 4 note) |
| UC-2-E1 | TC-2.3, TC-2.4 |
| UC-2-EC1 | TC-2.5, TC-2.6 |
| UC-3 Primary Flow | TC-3.1, TC-3.2 |
| UC-3-A1 | TC-3.3 |
| UC-3-E1 | TC-3.4 |
| UC-3-EC1 | TC-3.5 |
| UC-4 Primary Flow | TC-4.1 |
| UC-4-A1 | TC-4.12, TC-4.13, TC-4.14, TC-4.15 |
| UC-4-A2 | TC-4.17 |
| UC-4-E1 | TC-4.10 |
| UC-4-EC1 | TC-4.11 |
| UC-5 Primary Flow | TC-5.1 |
| UC-5-A1 | TC-5.2 |
| UC-5 Error Flows | None documented in the use-case source itself ("None. A well-formed `verifier` run always reaches step 5..."); no test case added — see Section 7 note |
| UC-5-EC1 | TC-5.5 |
| UC-6 Primary Flow | TC-6.5, TC-6.7, TC-6.14 |
| UC-6-A1 | TC-6.15 |
| UC-6-A2 | TC-6.7 |
| UC-6-E1 | TC-6.11 |
| UC-6-EC1 | TC-6.2 |
| UC-7 Primary Flow | TC-7.1 |
| UC-7-A1 | TC-7.2 |
| UC-7-A2 | TC-7.3 |
| UC-7-A3 | TC-7.4 |
| UC-7-A4 | TC-7.5 |
| UC-7-EC1 | TC-7.6 |
| UC-8 Primary Flow | TC-8.1 |
| UC-8-A1 | TC-8.2 |
| UC-8-A2 | TC-8.3, TC-8.4, TC-8.5 |
| UC-8-EC1 | TC-8.6 |
| UC-9 Primary Flow | TC-9.2 |
| UC-9-E1 | TC-9.3 |
| UC-9-EC1 | TC-9.4, TC-9.8 |
| UC-10 Primary Flow | TC-10.1 |
| UC-10-A1 | TC-10.2 |
| UC-10-A2 | TC-10.3, TC-10.4 |
| UC-10-EC1 | TC-10.5, TC-10.6 |

Every UC-1 through UC-10 primary flow, and every documented `-A`/`-E`/`-EC` sub-flow, is covered by at least one named test case, or its absence is explicitly stated with the use-case document's own reasoning (UC-2-A1, UC-5 Error Flows) rather than padded.

---

## 17. Count Summary

| Kind | Count | Automatable in this repo's CI today |
|---|---|---|
| STATIC | 24 | Yes — 24/24. Runnable via `node scripts/ci/validate-agents.js` and equivalent grep/file-read checks, with zero agent invocations |
| FIXTURE | 52 | No — 0/52 today. Each requires a live, single-agent invocation against a committed fixture; this repo has no LLM-invocation harness to script that. Fixtures are committed under `tests/fixtures/` so a human, or a future eval harness, can run them |
| BEHAVIORAL | 22 | No — 0/22 today. Each requires driving an orchestrating skill (`/merge-ready`, `/bootstrap-feature`, `/develop-feature`, `/implement-slice`, or the plan-mode flow) through a real multi-step, multi-agent run and observing the aggregate outcome; there is no scripted driver for that in this repo |
| **Total** | **98** | **24/98 (≈24.5%) automatable in CI today** |

This ≈24.5% figure is not a shortfall to apologize for — it is the honest ceiling for a feature whose subject matter is agent prompts and orchestrating skills rather than executable code, and it is exactly the distinction this feature's own PRD draws between mechanically-verifiable and judgment-dependent checks. The remaining ≈75.5% that is FIXTURE or BEHAVIORAL is not untested; it is specified precisely enough (fixture contents named, expected outputs stated as exact strings/field values wherever possible) that a human reviewer — or a future LLM-eval harness, should one be built — can execute every one of these test cases exactly as written, with no further design work. Rounding any of them up to "automated" today would be the exact defect this feature exists to stop the pipeline from committing.
