# Use Cases: Verification & Review Upgrade

> Based on [PRD](../PRD.md) — Section 9: Verification & Review Upgrade

**System context (do not assume otherwise):** This feature has no UI, no server, and no database — it is a harness for autonomous development, not a user-facing application. Its artifacts are markdown agent/skill prompt files, YAML frontmatter blocks, and the fields passed between agent invocations. The actors below are pipeline roles, not end users:

- **Orchestrator** — the main Claude Code session running `/merge-ready`, `/bootstrap-feature`, or `/develop-feature`, issuing `Agent` tool calls and reading their output.
- **`verifier`, `plan-critic`, `planner`, `code-reviewer`, `security-auditor`** — subagents invoked by the orchestrator at existing pipeline points (Gate 2, Gate 3, Gate 6, `/bootstrap-feature` Step 5).
- **Developer** — a human. In every primary flow documented here, the Developer is **absent** — the entire point of this feature is that the pipeline keeps moving without them. Where a human appears in a flow below, it is because the pipeline deliberately escalated (a Rule 4 condition), never because a step silently required them.

**Autonomy audit (NFR-1), stated once here rather than repeated per use case:** every primary flow's trigger in this document was checked against NFR-1(a) — it must fire from an existing pipeline point (Gate 2, Gate 3, Gate 6, or an existing step of `/bootstrap-feature`/`/develop-feature`/the plan-mode stub), never a new command a human must remember to run. None of the primary flows below has a manual-only trigger. Two places use a pre-existing manual escape hatch (`/merge-ready gate-6`'s single-gate rerun argument, and the interactive plan-mode Plan Critic Pass) — both are documented as **alternative**, not primary, flows, consistent with NFR-1(c)'s "escape hatch only, never the sole path." If a future revision of this document ever needs to add a scenario whose only trigger is a human running something manually, that scenario MUST be flagged explicitly as a violation of the autonomy contract, not documented as if it were ordinary.

**The organizing principle of this document:** this is the blueprint the QA Lead (`qa-planner`) reads next to write `docs/qa/verification-review-upgrade_test_cases.md`. Every flow below ends in a mechanically checkable outcome — a specific file with specific frontmatter, a specific string in a gate's Status column, a specific commit count, or a specific number of `Agent` tool calls (including zero) — never a subjective judgment call.

---

## Reference: Verdicts, Schema, and Severity Tiers (referenced throughout, not restated per use case)

**The four verdicts and their fixed precedence order (FR-1.2, amended — evaluated in this order, first match wins):**
1. **`FAILED`** — any of Level 1, Level 2, or Level 3 reports FAIL.
2. **`UNCERTAIN`** — none of the above, AND `verifier` could not reach a determination for at least one level: no plan/scratchpad for Level 1, an unresolvable dynamic import for Level 3, **Level 4 itself reporting `SKIPPED`** (Levels 1–3 all PASS, but every candidate data-flow path into the new code sits behind a dynamic import, so Level 4 has nothing it can even attempt to trace — a fixed pin added by the amended FR-1.2, distinct from Level 4 running and finding nothing exercised), or a genuinely ambiguous finding.
3. **`VERIFIED`** — none of the above, AND Level 4 confirms at least one real, exercised data path (FR-1.3: an existing automated test, a named E2E scenario, or a fully-real traced chain).
4. **`PRESENT_BEHAVIOR_UNVERIFIED`** — none of the above (Levels 1–3 PASS, no UNCERTAIN condition — including the Level 4 `SKIPPED` condition above), AND Level 4 actually runs and finds no test or trace exercising the behavior. This is the default for present-and-wired-but-unexercised code — it MUST NOT be reported as `VERIFIED`, and it MUST NOT be reported when Level 4 was unable to determine anything at all (that is `UNCERTAIN`, not this).

**`docs/verification/<feature-slug>.md`'s minimum frontmatter (FR-2.4, `generated_at` per amended FR-2.7):**
```yaml
---
feature: <feature-slug>
verdict: VERIFIED | PRESENT_BEHAVIOR_UNVERIFIED | FAILED | UNCERTAIN
passed: true | false
gaps:
  - level: 1 | 2 | 3 | 4
    finding: <one sentence>
    location: <file:line or path>
    verifies_with: <the specific test, trace, or manual step>
human_verification_required:
  - <one sentence per item>
generated_at: <ISO 8601 UTC, verbatim from the value Gate 6 supplied>
# OR, only when no timestamp was supplied:
# generated_at_note: <one sentence explaining the omission>
---
```
`gaps` and `human_verification_required` are always present as arrays — `[]` when empty, never omitted. A `gaps` entry missing any of its four fields is malformed (FR-2.5). `generated_at` is **not** unconditional: `verifier` has no `Bash` tool and cannot obtain a real timestamp itself, so `/merge-ready` Gate 6 runs `date -u` and passes the resulting UTC timestamp and the feature slug verbatim in its delegation prompt; `verifier` writes that value verbatim into `generated_at`. When no timestamp was supplied (e.g. a direct, ad hoc invocation of `verifier` outside Gate 6), `verifier` omits `generated_at` entirely and writes `generated_at_note` instead — it never invents, estimates, or computes a timestamp on its own, per the harness's own never-invent-timestamps rule (see `.claude/rules/changelog.md`'s identical principle applied elsewhere in this harness).

**The `passed`/`human_verification_required` mapping (FR-3.2, MUST hold exactly):**

| Verdict | `passed` | `human_verification_required` |
|---|---|---|
| `VERIFIED` | `true` | `[]` |
| `PRESENT_BEHAVIOR_UNVERIFIED` | `false` | non-empty |
| `FAILED` | `false` | MAY be `[]` |
| `UNCERTAIN` | `false` | non-empty |

**The Level 2 marker severity table (FR-4.1):** `TBD`, `FIXME`, `XXX` → BLOCKER unless an issue reference (`#123`, `JIRA-456`, or an issue/PR URL) is on the same line, then WARNING. `TODO`, `HACK`, `placeholder` → WARNING unconditionally. `stub`, `not implemented`, `throw new Error('Not implemented')`, `raise NotImplementedError`, `pass  # TODO` → BLOCKER unconditionally. BLOCKER contributes to `FAILED`; WARNING never does (FR-4.5).

**BLOCKER/WARNING/INFO ≡ CRITICAL/MAJOR/MINOR (FR-5.4):** `plan-critic`'s finding scale is a literal 1:1 relabeling of the terminology the inlined plan-critic prompt used before this feature; no check's meaning changed.

---

## UC-1: Gate 6 Verdict Determination — the Four-Verdict Precedence

**Actor**: `verifier` agent; orchestrator (`/merge-ready`)
**Preconditions**: A feature's implementation slices are complete and committed; `/merge-ready` is running (or Gate 6 alone is rerun via the documented `$gate` escape hatch, e.g. `/merge-ready gate-6`, per NFR-1(c))
**Trigger**: `/merge-ready` reaches Gate 6 ("Goal-Backward Verification") and delegates to `verifier` — an existing pipeline point (`skills/merge-ready/SKILL.md` Gate 6), never a new command

### Primary Flow (Present, Wired, Unexercised → `PRESENT_BEHAVIOR_UNVERIFIED`)
1. A feature slice's code is present on disk (Level 1 PASS), contains no BLOCKER-tier markers (Level 2 PASS, FR-4), and every new export/route/component is imported/registered/rendered by at least one consumer (Level 3 PASS).
2. `verifier` runs Level 4 and finds no existing automated test calling the new code path with non-trivial input and an output assertion, no E2E scenario file naming the specific flow, and no traced chain where every link uses a real parameter or query result — only that the chain is wired (imports resolve, the route is registered), which FR-1.3 states is insufficient. (This is Level 4 actually running and finding nothing exercised — distinct from Level 4 having nothing it can even attempt to trace, which is UC-1-EC1's third sub-case below and maps to `UNCERTAIN` instead.)
3. Per the precedence order: FAILED does not apply (Levels 1–3 all PASS); UNCERTAIN does not apply (no level reports an undetermined result); VERIFIED does not apply (Level 4 found nothing exercised); the evaluation falls through to the default, `PRESENT_BEHAVIOR_UNVERIFIED`.
4. `verifier` writes `docs/verification/<feature-slug>.md` with `verdict: PRESENT_BEHAVIOR_UNVERIFIED`, `passed: false`, a `gaps` entry at `level: 4` naming the unexercised path, and a non-empty `human_verification_required` (per the FR-3.2 mapping).
5. `/merge-ready`'s Gate 6 row renders its Status column as `PRESENT_BEHAVIOR_UNVERIFIED` verbatim (FR-1.4), replacing the prior "WARN = Level 4 advisory only" note (FR-1.5).
6. The overall result line reads `NOT MERGE READY` (FR-10.4) — a Level 4 gap alone is now sufficient to withhold `MERGE READY`, without itself producing `FAILED`.

**Postconditions**: `docs/verification/<feature-slug>.md` exists with `verdict: PRESENT_BEHAVIOR_UNVERIFIED`, `passed: false`, non-empty `gaps` and `human_verification_required` arrays, and an ISO-8601 `generated_at`; the Gate 6 table row's Status column string is exactly `PRESENT_BEHAVIOR_UNVERIFIED`; the printed overall result string is exactly `NOT MERGE READY` (AC-1).

### Alternative Flows
- **UC-1-A1: Genuinely exercised feature → `VERIFIED`** — identical Levels 1–3 PASS, but Level 4 finds an existing `*.test.*` file calling the new code path with non-trivial input and asserting its output (FR-1.3(a)). The precedence reaches `VERIFIED` (third in order). `verifier` writes `verdict: VERIFIED`, `passed: true`, `gaps: []`, `human_verification_required: []`. Gate 6's Status column reads `VERIFIED`; combined with every other gate passing, the overall result reads `MERGE READY`.

### Error Flows
- **UC-1-E1: Missing file or BLOCKER marker → `FAILED`** — Level 1 finds a plan-declared file absent from disk, OR Level 2 finds a BLOCKER-tier marker. Per the precedence order, FAILED is evaluated first and wins regardless of what Levels 3–4 would otherwise have found. `verifier` writes `verdict: FAILED`, `passed: false`; `gaps` lists the missing-file or BLOCKER finding; `human_verification_required` MAY be `[]` (FR-3.2 — a FAILED verdict from a missing file needs no human judgment, it needs UC-3's replan loop). Gate 6 Status reads `FAILED`; overall reads `NOT MERGE READY`.

### Edge Cases
- **UC-1-EC1: No plan/scratchpad, an unresolvable dynamic import, or Level 4 itself reporting `SKIPPED` → `UNCERTAIN`** — three independent sub-cases all resolve to the same verdict: (a) `.claude/scratchpad.md` is absent and no plan file can be located (Level 1 reports `SKIPPED — cannot determine expected artifacts`); (b) Level 3 encounters an `import()`/`require()` call it cannot statically resolve (`SKIPPED — dynamic import`); (c) **Levels 1–3 all PASS, but every candidate data-flow path into the new code sits behind a dynamic import, so Level 4 itself has nothing it can even attempt to trace and reports `SKIPPED — dynamic import, cannot verify statically`** (the identical marker `agents/verifier.md` already emits for Level 3's case, now reached at Level 4). Sub-case (c) is a fixed pin added by the amended FR-1.2, not an inference: without it, "Levels 1–3 PASS, Level 4 `SKIPPED`" would satisfy both `UNCERTAIN`'s and `PRESENT_BEHAVIOR_UNVERIFIED`'s conditions at once. **Rationale**: an *undeterminable* path must not be fed to UC-3's `--gaps` replan loop as though some specific slice could close it — `planner` cannot write a `verifies_with` action for a path it cannot even name; the finding belongs in `human_verification_required`, for a human (or a later automated run with better static-resolution reach) to assess, not in a `gaps` entry implying a slice can fix it. In every sub-case, neither the FAILED branch nor Levels 1–3's normal PASS-through-to-Level-4 path applies; the "could not reach a determination" condition holds, and per the precedence order UNCERTAIN is evaluated before VERIFIED/PRESENT_BEHAVIOR_UNVERIFIED. `verifier` writes `verdict: UNCERTAIN`, `passed: false`, `human_verification_required` non-empty (naming what made the determination impossible). Gate 6 Status reads `UNCERTAIN`; overall reads `NOT MERGE READY`.
- **UC-1-EC2: Precedence order applied when FAILED and UNCERTAIN both hold** — Level 1 finds a missing plan-declared file (a FAILED condition) AND, independently, Level 3 finds an unresolvable dynamic import on an unrelated code path (an UNCERTAIN condition) in the same run. Per the fixed evaluation order, `verifier` MUST NOT report `UNCERTAIN` merely because that condition is also present — FAILED is checked first and is reported. `verdict:` reads `FAILED`, not `UNCERTAIN`; `gaps` still records both the Level 1 and Level 3 findings individually (FR-2.4's "every individual finding" requirement), but the top-line `verdict:` is `FAILED` alone. This is the mechanically checkable proof that FR-1.2's order is a fixed sequence, not a severity vote.

### Data Requirements
- **Input**: The feature's plan/scratchpad (or `git diff main --name-only` when absent); the feature's changed/new files; existing test/E2E-scenario files
- **Output**: `docs/verification/<feature-slug>.md`'s `verdict`/`passed`/`gaps`/`human_verification_required`/`generated_at`; Gate 6's Status column string; the overall `MERGE READY`/`NOT MERGE READY` line
- **Side Effects**: One file write to `docs/verification/<feature-slug>.md` (creating `docs/verification/` on first use); no other file touched

---

## UC-2: The `passed` Invariant and Malformed-Report Handling

**Actor**: orchestrator (`/merge-ready` Gate 6); `verifier` agent (producer of the well-formed case)
**Preconditions**: `docs/verification/<feature-slug>.md` exists (from a prior `verifier` run, or has been altered)
**Trigger**: `/merge-ready` runs Gate 6 (as part of a full run, or via the `$gate` single-gate rerun escape hatch — an existing, documented argument, not a new command) and reads the report's frontmatter directly, not `verifier`'s own prose claim about its verdict (FR-3.3)

### Primary Flow (Malformed Report — `passed: true` With Non-Empty `human_verification_required`)
1. `docs/verification/<feature-slug>.md`'s frontmatter reads `verdict: VERIFIED`, `passed: true`, but `human_verification_required:` contains one non-empty entry — a state a well-formed `verifier` run never produces (the FR-3.2 mapping ties `VERIFIED` to an empty array), but one a `verifier` defect or a manual edit could produce.
2. Gate 6, reading the frontmatter directly, finds `passed: true` AND `human_verification_required` non-empty — the FR-3.1 invariant is violated.
3. Gate 6 treats this identically to `FAILED`: the Status column reads exactly `FAILED (malformed report: passed:true with non-empty human_verification_required)`.
4. The overall result MUST NOT be `MERGE READY` while this condition holds.

**Postconditions**: Gate 6's Status column string is exactly `FAILED (malformed report: passed:true with non-empty human_verification_required)`; overall result is `NOT MERGE READY`; no file is modified by Gate 6's check itself — it is read-only (AC-3).

### Alternative Flows
- **UC-2-A1: Verdict-to-`passed` mapping followed exactly (well-formed case)** — for each of the four verdicts, `verifier` produces the FR-3.2 mapping exactly (see the Reference table above). Gate 6's malformed-report check finds no violation for any of the four combinations and proceeds to read the `verdict:` field normally.

### Error Flows
- **UC-2-E1: Pre-feature verification file — no `verdict:` frontmatter → `UNCERTAIN`, fresh run requested** — `docs/verification/<feature-slug>.md` was written by a `verifier` run that predates this feature (three-state `PASS/FAIL/WARN`, no YAML frontmatter). Gate 6 finds no `verdict:` field. Per NFR-3, Gate 6 MUST treat this as `UNCERTAIN` and request a fresh `verifier` run — it MUST NOT error, and MUST NOT infer a verdict from the old file's prose. Status column reads `UNCERTAIN`; a fresh Gate 6 invocation is queued through the same Auto-Fix Protocol mechanism UC-3 exercises.

### Edge Cases
- **UC-2-EC1: A `gaps` entry missing one of its four required fields** — `docs/verification/<feature-slug>.md`'s `gaps` array contains an entry with `level`, `finding`, and `location` populated but no `verifies_with` key. Per FR-2.5, an entry missing any of the four required fields is malformed, and FR-3.3's handling applies identically: Gate 6's Status column reads `FAILED (malformed report: ...)`, naming the specific incomplete entry (by its `location`, or its array index if `location` is also absent) — a `verifies_with`-less entry gives UC-3's replan loop nothing to act on, so it cannot be silently accepted.

### Data Requirements
- **Input**: `docs/verification/<feature-slug>.md`'s raw YAML frontmatter, read directly by Gate 6
- **Output**: Gate 6's Status column string; the overall `MERGE READY`/`NOT MERGE READY` line
- **Side Effects**: None — Gate 6's read is non-mutating; a fresh `verifier` run (UC-2-E1) is attributable to `verifier`, not to Gate 6's read step

---

## UC-3: Gate 6 `--gaps` Replan Loop — the Autonomy-Critical Path

**Actor**: orchestrator (`/merge-ready`'s Auto-Fix Protocol — reads `planner`'s returned replan slices and is the one that appends them to the plan file); `planner` agent (`agents/planner.md`'s `tools:` frontmatter is `Read, Glob, Grep, WebSearch, WebFetch` — no `Write`, no `Edit`; it returns slices as structured output, it never writes them); `/implement-slice` workflow (executes the replan slices); `verifier` agent (reruns Gate 6)
**Preconditions**: Gate 6 has just reported `FAILED` or `PRESENT_BEHAVIOR_UNVERIFIED` with a non-empty `gaps` array in `docs/verification/<feature-slug>.md`'s frontmatter; the feature's plan file exists
**Trigger**: `/merge-ready`'s existing Auto-Fix Protocol ("If any gate FAILS: fix ... rerun") reaches Gate 6 specifically — an existing pipeline point, never a new command; no human reads the report or edits any file to initiate this flow

### Primary Flow (Gate 6 Fails → Replan → Reruns → Passes, Zero Human Involvement)
1. The Auto-Fix Protocol identifies Gate 6 as the failed gate and reads its `gaps` array — e.g. one entry: `{level: 4, finding: "no test exercises POST /api/widgets", location: "src/routes/widgets.ts:42", verifies_with: "an integration test posting a non-trivial payload and asserting the 201 response body"}`.
2. Per FR-10.1, the orchestrator feeds this `gaps` array directly to `planner` as structured input — not a re-derivation of the report's prose by the orchestrating model itself.
3. `planner` — which has no `Write`/`Edit` tool — produces one or more replan slices targeting the gap's `verifies_with` action, using the standard `Files:`/`Changes:`/`Verify:`/`Done when:` fields, and **returns them as structured output**, exactly as it returns a plan to the orchestrator at the end of `/bootstrap-feature` Step 5. Per amended FR-10.2, the **orchestrator itself appends** these returned slices to the existing plan file — append-only: every pre-existing slice is left byte-identical, and `docs/verification/<feature-slug>.md` is not written during this step at all. This mirrors the existing pattern in `skills/bootstrap-feature/SKILL.md` Step 7, where `planner` returns a plan and the orchestrator (not `planner`) writes the scratchpad.
4. The replan slice(s) execute through the existing `/implement-slice` TDD loop: write the missing test, wire the missing behavior, commit (FR-10.3).
5. Gate 6 reruns; Level 4 now finds the new test exercising the previously-unverified path, and the precedence order reaches `VERIFIED`.
6. `docs/verification/<feature-slug>.md` is rewritten with `verdict: VERIFIED`, `passed: true`, `gaps: []`, `human_verification_required: []`. Gate 6's Status column reads `VERIFIED`; the overall result reads `MERGE READY`.
7. At no point in steps 1–6 did a human read the report, edit the plan file, or approve the replan slices — the loop ran entirely inside the existing Auto-Fix Protocol's retry mechanism.

**Postconditions**: The plan file's slice count strictly increases after this flow (verifiable by diffing the plan file and `git log` before/after, AC-2); every pre-existing slice's text is byte-identical before and after the append — the orchestrator's append-only edit touches only the file's end, never rewriting an existing slice; `docs/verification/<feature-slug>.md` is not written at any point during the append step itself, and its only writes across the whole flow are attributable to `verifier` (its own rerun in step 5); Gate 6's Status column reads `VERIFIED`; overall result reads `MERGE READY`.

### Alternative Flows
- **UC-3-A1: `FAILED` (not only `PRESENT_BEHAVIOR_UNVERIFIED`) also feeds the same loop** — the mechanism is verdict-agnostic: a `FAILED` verdict with a non-empty `gaps` array (e.g., a Level 2 BLOCKER finding) triggers the identical `planner`-consumes-`gaps` → replan-slice → rerun sequence, since FR-10.1's condition is `FAILED` OR `PRESENT_BEHAVIOR_UNVERIFIED`, not the latter alone.
- **UC-3-A2 (post-implementation hardening — mandatory re-review of replan commits):** Because the replan loop is the one place in the pipeline where the harness writes production code downstream of both reviewer gates — Gate 2 (Code Review) and Gate 3 (Security Audit) already ran, earlier, over the pre-replan diff — a `VERIFIED` verdict reached purely by rerunning Gate 6 after step 4's replan commit(s) land would leave the newest, least-reviewed code in the feature unreviewed by either. `skills/merge-ready/SKILL.md`'s Gate 6 specialization therefore requires: once the replan loop has committed any slice, Gate 2 and Gate 3 MUST be re-run over those specific commits before a subsequent `VERIFIED` from Gate 6 may permit `MERGE READY`. A `VERIFIED` verdict reached over unreviewed replan commits is not treated as a pass — this closes a reviewer-gate bypass the primary flow's steps 4–6 do not otherwise mention.

### Error Flows
- **UC-3-E1: 3-attempt budget exhausted → escalation** — the replan loop executes and Gate 6 reruns, but the gap persists (e.g., the new test itself has a defect) across 3 total fix attempts — the same budget `skills/merge-ready/SKILL.md`'s Auto-Fix Protocol already enforces per gate (FR-10.3). After the 3rd attempt still fails, the Auto-Fix Protocol reports `NOT MERGE READY` with specific blockers (the remaining `gaps` entries, named individually) per the existing protocol — it does not loop a 4th time, and does not mark the feature `MERGE READY` despite the unresolved gap.

### Edge Cases
- **UC-3-EC1: A gap whose `verifies_with` cannot be automated** — one `gaps` entry's `verifies_with` names an action `planner` cannot express as a testable slice for this project's stack (e.g., "manually confirm the third-party webhook fires in the vendor's own dashboard"). `planner` does not fabricate an untestable replan slice for this entry; per the FR-3.2 mapping, this gap's description is instead carried into `human_verification_required` rather than resolved by a slice. The overall result remains `NOT MERGE READY` until a human (or a later automated run) confirms the item — the one point in this loop where the pipeline correctly stops short of pretending automation closed a gap it structurally cannot close, without the loop itself hanging (Risk 1's mitigation: it still terminates via the 3-attempt budget).

### Data Requirements
- **Input**: `docs/verification/<feature-slug>.md`'s `gaps` array; the existing plan file
- **Output**: `planner`'s returned replan slices (structured output — it has no `Write`/`Edit` tool and cannot write them itself); the orchestrator's own append of those returned slices to the plan file; new commits from `/implement-slice`; a rewritten `docs/verification/<feature-slug>.md` with an updated verdict
- **Side Effects**: Plan file modified (append-only, by the **orchestrator** — never by `planner`, which issues zero file-mutating tool calls); new commits (by `/implement-slice`); `docs/verification/<feature-slug>.md` rewritten (by `verifier` only, never during the append step); the Auto-Fix Protocol's fix-attempt counter incremented

---

## UC-4: Level 2 Anti-Pattern Severity Split

**Actor**: `verifier` agent
**Preconditions**: The feature's new/modified production code files are being scanned, per the existing exclusion list (test files, markdown, config, genuinely informational comments)
**Trigger**: Gate 6 delegates to `verifier`, which runs its Level 2 scan — an existing pipeline point, unchanged in trigger from before this feature; only the severity classification of what it finds changes

### Primary Flow (BLOCKER — `TBD` With No Issue Reference)
1. A production file contains the literal token `TBD` on a line with no `#<digits>`, `<UPPERCASE>-<digits>`, or issue/PR URL token on the same line (FR-4.2's definition of "no issue reference").
2. Per FR-4.1, `TBD` with no issue reference is BLOCKER-tier.
3. Level 2's PASS/FAIL definition reports **FAIL**, since a BLOCKER-tier marker was found.
4. Per FR-4.5, this BLOCKER-tier finding contributes to the overall `FAILED` verdict.
5. `docs/verification/<feature-slug>.md`'s `gaps` array includes an entry at `level: 2` naming the finding's `file:line`.

**Postconditions**: Level 2 reports FAIL in the prose report body; the overall verdict is `FAILED`; the overall `/merge-ready` result is `NOT MERGE READY` (AC-11).

### Alternative Flows
- **UC-4-A1: `TBD(#42)` — issue reference present → WARNING, does not force `FAILED`** — the identical file, with `TBD(#42)` on the same line. Per FR-4.1 this reclassifies to WARNING-tier. Level 2 reports **PASS** (FR-4.3 — a file containing only WARNING-tier markers still reports Level 2 PASS), with the finding still listed as a non-blocking finding and mirrored into `gaps` at `level: 2`, even though it does not, by itself, force `FAILED` (AC-11's second clause).
- **UC-4-A2: A file with only WARNING-tier markers — Level 2 still PASS, markers still recorded in `gaps`** — a production file contains `TODO`, `HACK`, and `PLACEHOLDER` (all unconditionally WARNING-tier) and no BLOCKER-tier marker anywhere. Level 2 reports **PASS** — WARNING-tier markers alone never fail Level 2. All three findings are still individually listed in `gaps` at `level: 2` (FR-2.4's "every ... WARNING-tier Level 2 marker" requirement) — PASS at the level does not mean the findings are dropped from the machine-readable report.

### Error Flows
- **UC-4-E1: `stub`, `not implemented`, `raise NotImplementedError` — unconditional BLOCKER** — a production file contains `raise NotImplementedError` with no issue-reference exception available; unlike `TBD`/`FIXME`/`XXX`, these markers are BLOCKER "unconditional" per FR-4.1 — an issue reference on the same line does not downgrade them. Level 2 FAILs regardless; the overall verdict is `FAILED`.

### Edge Cases
- **UC-4-EC1: The compound pattern `pass  # TODO` → BLOCKER despite containing the bare WARNING-tier token `TODO`** — a Python function body reads exactly `pass  # TODO` (an empty implementation with a trailing comment). The bare token `TODO` is WARNING-tier per the general rule, but `verifier` MUST check for this specific compound pattern *before* applying the bare-`TODO` rule (FR-4.4). Because the compound pattern denotes an empty implementation (the same class as `stub`/`raise NotImplementedError`), it is BLOCKER-tier unconditionally — the presence of the substring `TODO` inside the matched text does NOT downgrade it. Level 2 FAILs; the overall verdict is `FAILED` (AC-12). A fixture proving this MUST seed exactly `pass  # TODO` as a function body — not merely a standalone `# TODO` comment elsewhere in an otherwise-complete function — and confirm BLOCKER classification.

### Data Requirements
- **Input**: The feature's new/modified production code files' text content
- **Output**: Level 2's PASS/FAIL line; `gaps` entries at `level: 2` for every BLOCKER- and WARNING-tier marker found; contribution (or not) to the overall verdict per FR-4.5
- **Side Effects**: None — a read-only scan; findings are recorded only when `verifier` writes the full report (UC-5)

---

## UC-5: Verifier's Machine-Readable Report — Scoped Write Target

**Actor**: `verifier` agent; orchestrator (`/merge-ready` Gate 6 — supplies the timestamp and slug)
**Preconditions**: `agents/verifier.md`'s `tools:` frontmatter includes `Write` (FR-2.1); its Constraints section states the single scoped exception — `verifier` MAY Write only to `docs/verification/<feature-slug>.md` (FR-2.2); `verifier` has no `Bash` tool, so it cannot obtain a real timestamp itself (FR-2.7)
**Trigger**: The end of every Gate 6 run — an existing pipeline point (Gate 6's own completion), on every verdict including `VERIFIED`, not only on failure (FR-2.3)

### Primary Flow (First Write for a Feature — Directory Does Not Yet Exist, Gate 6 Supplies the Timestamp)
1. Before delegating, `/merge-ready` Gate 6 runs `date -u +'%Y-%m-%d %H:%M'` and passes the resulting UTC timestamp, together with the feature slug, verbatim in its delegation prompt to `verifier` (FR-2.7).
2. `verifier` completes Levels 1–4 and determines the overall verdict per the precedence order (any of the four).
3. `docs/verification/` does not yet exist in the repository (this is the first feature verified under this scheme).
4. `verifier` creates `docs/verification/` and writes `docs/verification/<feature-slug>.md` — the slug matching the one Gate 6 supplied, and the one already used for `docs/use-cases/<feature>_use_cases.md` and `docs/qa/<feature>_test_cases.md`.
5. The file opens with YAML frontmatter containing, at minimum, `feature`, `verdict`, `passed`, `gaps` (array, `[]` if empty — never omitted), `human_verification_required` (array, `[]` if empty — never omitted), and `generated_at` set to the timestamp Gate 6 supplied, verbatim — `verifier` never computes, estimates, or invents this value itself.
6. Below the frontmatter, the body retains the existing prose `### Verification Report` structure (Levels 1–4, `file:line` findings) unchanged in kind (FR-2.6) — the frontmatter is additive, not a replacement.

**Postconditions**: `docs/verification/<feature-slug>.md` exists with `feature`, `verdict`, `passed`, `gaps`, `human_verification_required` present (the latter two always as arrays, never omitted, even when empty), `generated_at` set to the Gate-6-supplied timestamp verbatim, and a prose body below the frontmatter; `docs/verification/` exists as a directory.

### Alternative Flows
- **UC-5-A1: Subsequent write for the same feature (rerun)** — `docs/verification/<feature-slug>.md` already exists from a prior Gate 6 run for this feature (e.g., after UC-3's replan loop). `verifier` overwrites the same path with the current run's verdict — the file is per-feature and current-run, not append-only across runs of the same feature (distinct from `CHANGELOG.md`'s append-across-time model).
- **UC-5-A2: No timestamp supplied — `generated_at` omitted, `generated_at_note` written instead** — `verifier` is invoked directly (a direct, ad hoc invocation outside `/merge-ready` Gate 6, e.g. for manual inspection or a fixture run), and no timestamp is supplied in the prompt. Per FR-2.7, since `verifier` has no `Bash` tool and MUST NOT invent, estimate, or otherwise compute a timestamp on its own, it omits `generated_at` from the frontmatter entirely and writes a `generated_at_note` field instead — a non-empty string explaining that no timestamp was supplied. Every other frontmatter field (`feature`, `verdict`, `passed`, `gaps`, `human_verification_required`) is still written normally.

### Error Flows
None. A well-formed `verifier` run always reaches step 5; a mechanism failure inside `verifier` (a thrown exception, a missing plan) is handled by the existing `UNCERTAIN`/`SKIPPED` branches (UC-1-EC1), not by this write step failing silently — `verifier` still writes the report (with `verdict: UNCERTAIN`) even when it could not reach a full determination.

### Edge Cases
- **UC-5-EC1: The scoped write exception is prompt-enforced, not tool-enforced** — `agents/verifier.md`'s `tools:` frontmatter grants `Write` unconditionally; there is no per-path tool-permission mechanism in this harness restricting *which* path an agent's `Write` calls may target. The restriction to `docs/verification/<feature-slug>.md` only is enforced entirely by the Constraints section's prose instruction, not by a filesystem-level or `permissions.deny`-level restriction. A `verifier` invocation that, through a reasoning defect, issued a `Write` to e.g. `docs/PRD.md` would not be mechanically blocked by anything this feature adds — the same class of limitation already documented for pattern-based guards elsewhere in this harness (`blocking-guards_use_cases.md` UC-9-EC4's precedent). This is exactly why the PRD's Section 9 risk/dependency list requires a mandatory `security-auditor` pre-review of this specific slice, to confirm the Constraints wording is unambiguous — this document records the limitation rather than asserting a mechanical guarantee that does not exist.

### Data Requirements
- **Input**: The verdict, `gaps`, and `human_verification_required` values computed across Levels 1–4; the UTC timestamp and feature slug Gate 6 supplied verbatim in its delegation prompt (or their absence, for UC-5-A2's direct-invocation case)
- **Output**: `docs/verification/<feature-slug>.md`'s full frontmatter (including `generated_at`, or `generated_at_note` when no timestamp was supplied) + prose body
- **Side Effects**: One directory creation (`docs/verification/`, first use only) and one file write per Gate 6 run; no other file is touched by `verifier`

---

## UC-6: Plan Critic — Autonomous and Interactive Invocation

**Actor**: orchestrator (`/bootstrap-feature` Step 5, or the plan-mode delegation stub in `src/claude.md`); `plan-critic` agent; `planner` agent (produces the plan being critiqued)
**Preconditions**: `agents/plan-critic.md` exists with frontmatter `name: plan-critic`, a `tools` list that does NOT include `Write` (FR-5.1); `planner` (which itself has no `Write`/`Edit` tool) has just returned a plan as structured output, and the orchestrator has written it to the plan file
**Trigger**: `/bootstrap-feature` Step 5, immediately after `planner` produces the plan and before Step 6 (Git Setup) — an existing step of an existing skill (FR-5.9); no human has read the plan at this point in this flow

### Primary Flow (Autonomous Path — the Gap This Feature Closes)
1. `/bootstrap-feature` runs entirely as part of a `/develop-feature` invocation, with no interactive plan-mode session involved at any point.
2. `planner` produces the implementation plan and returns it as structured output — it has no `Write`/`Edit` tool and cannot write it itself; the orchestrator writes the returned plan to the plan file.
3. Per FR-5.9, `/bootstrap-feature` Step 5 invokes `plan-critic` against this plan file (loop 1) — before this feature, this exact invocation never happened for an autonomously-produced plan (this is the gap Section 9.1 of the PRD audited and this feature closes).
4. `plan-critic` returns findings at BLOCKER/WARNING/INFO severity, covering Completeness, Slice Quality, File Path Verification, Architecture & Security, Edge Cases & Testability, Scope Reduction Detection, and Wave Assignment Validation (FR-5.2 — every check carried forward from `src/claude.md`'s prior inlined prompt, none dropped).
5. Loop 1 finds one or more BLOCKER findings (e.g., a wave with two slices sharing a file).
6. The orchestrator fixes the plan file for every BLOCKER and WARNING finding (FR-5.5 step 2), then re-invokes `plan-critic` against the revised plan (loop 2).
7. Loop 2 returns zero BLOCKER findings. Per FR-5.5, the orchestrator proceeds immediately — remaining WARNING findings are acceptable and recorded, without a further loop.
8. `/bootstrap-feature` proceeds to Step 6 (Git Setup). Its Output Format gains a "Plan Critique" block reporting the final verdict and BLOCKER/WARNING/INFO counts (FR-5.9), alongside the existing "Architecture Review" block.

**Postconditions**: The plan file used for implementation is the loop-2-revised version, with zero remaining BLOCKER findings; `/bootstrap-feature`'s output includes a "Plan Critique" block naming the final counts; Step 6 (Git Setup) runs only after this; no human read or approved the plan at any point in this flow (AC-13's "before Step 6" ordering, verifiable by reading `skills/bootstrap-feature/SKILL.md` and confirming the invocation precedes Git Setup).

### Alternative Flows
- **UC-6-A1: Interactive path — plan-mode stub delegates to the same agent** — a human is in an interactive plan-mode session (not a `/develop-feature`/`/bootstrap-feature` run); `src/claude.md`'s "Plan Critic Pass" Step 1 (rewritten per FR-5.6 from a 65-line inlined blockquote to a one-line delegation) invokes the same `plan-critic` agent, via the `Agent` tool, against the plan-mode plan file, following the identical FR-5.5 loop mechanism. This is a pre-existing trigger point (plan mode already ran a critic pass before this feature; only the mechanism — agent vs. inlined prompt — changed) and is never the *only* path to a plan critique, since UC-6's primary flow is autonomous — consistent with NFR-1(c)'s "manual invocation ... as an escape hatch only, never the sole path."
- **UC-6-A2: Critic returns zero findings on the first loop** — `plan-critic` returns `FINDINGS: none` on loop 1. Per FR-5.3, the agent's own prompt carries the explicit closing instruction that a zero-finding result MUST be treated with skepticism ("Plans almost always have issues") — this governs how `plan-critic` itself evaluates before returning a result, not a re-run trigger for the orchestrator. Since zero BLOCKER findings remain, the orchestrator proceeds immediately (identical mechanical outcome to loop-2-clean in the primary flow). This is verifiable only indirectly, per AC-4's methodology: seed a plan with an injected defect and confirm `plan-critic` does NOT return zero findings against a known-defective fixture.
- **UC-6-A3 (post-implementation hardening — WARNING-only findings, no BLOCKER): the fix pass still runs, but the loop does not re-invoke.** Loop 1 returns only WARNING-tier findings (e.g., hedging language flagged by Scope Reduction Detection) with zero BLOCKER findings. The fix pass in step 6 is **not** conditional on a BLOCKER being present — the orchestrator fixes the plan file for every WARNING finding returned, exactly as it would fix BLOCKER findings — but because zero BLOCKER findings were present, the orchestrator does **not** re-invoke `plan-critic` for a second loop; it proceeds directly to Step 6 (Git Setup) with the WARNING-driven fixes already applied. This distinguishes what gates the *fix pass* (any BLOCKER-or-WARNING finding at all) from what gates *re-invocation* (a BLOCKER specifically) — a distinction the primary flow's steps 5–7 do not exercise, since loop 1 there already contains a BLOCKER.

### Error Flows
- **UC-6-E1: BLOCKER finding survives loop 3 → Rule 4 escalation** — loop 1 and loop 2 each find and partially address BLOCKER findings, but a BLOCKER finding remains after loop 3 (the maximum, per FR-5.5). The workflow escalates per the existing Rule 4 deviation rule (`src/rules/error-recovery.md`) — the orchestrator stops, presents the remaining BLOCKER findings verbatim, states the decision needed, and lists options, exactly as any other Rule 4 escalation. This applies identically whether the loop was invoked from `/bootstrap-feature` Step 5 (the autonomous path) or the plan-mode stub (UC-6-A1) — this is the one point in this UC where a human is drawn in, and it is a deliberate, documented escalation, not a silent stall or a manual-only primary path.

### Edge Cases
- **UC-6-EC1: `plan-critic` attempting to edit the plan — impossible by construction** — `agents/plan-critic.md`'s `tools:` frontmatter does not include `Write` (FR-5.1, AC-8). Even if `plan-critic`'s own reasoning concluded a fix was needed and attempted to issue an Edit/Write tool call against the plan file, the tool call would be unavailable to it — a hard, mechanically-checkable constraint (verifiable by reading `agents/plan-critic.md`'s `tools:` list directly and confirming the absence of `Write`), not a prompt-level instruction the agent could be talked out of, unlike UC-5-EC1's scoped-write case for `verifier`. This is why Step 2 ("Incorporate Findings") of both the autonomous and interactive loops is performed by the orchestrator itself, never by `plan-critic`.

### Data Requirements
- **Input**: The plan file's current content; the project's CLAUDE.md and `.claude/rules/*.md` for project-specific constraints
- **Output**: `FINDINGS:` (BLOCKER/WARNING/INFO, each naming the affected section/slice) and `VERIFIED:` (checks that passed); the orchestrator's own plan-file edits in response
- **Side Effects**: The plan file is modified by the orchestrator (never by `plan-critic`) between loops; `/bootstrap-feature`'s Output Format gains the "Plan Critique" block

---

## UC-7: Reviewer Confidence Filter and Diff-Scoping — `code-reviewer` and `security-auditor`

**Actor**: `code-reviewer` agent; `security-auditor` agent
**Preconditions**: Gate 2 (Code Review) or Gate 3 (Security Audit) is running against a slice's `git diff`; `agents/code-reviewer.md` has gained CRITICAL/HIGH/MEDIUM/LOW severity tiers (FR-6.3, mirroring `security-auditor`'s existing tiers)
**Trigger**: `/merge-ready` reaches Gate 2 or Gate 3 and delegates to the respective agent — an existing pipeline point, unchanged in trigger from before this feature

### Primary Flow (Sub-80%-Confidence Finding Omitted Entirely)
1. `code-reviewer` (or `security-auditor`) reviews a slice's diff and identifies a possible issue — e.g., a MEDIUM-tier naming-convention inconsistency it assesses at 60% confidence of being real and actionable.
2. Per FR-6.1, since 60% is below the 80% threshold and the finding is not CRITICAL-tier, the finding is omitted from the Output Format's findings list entirely — not merely deprioritized or footnoted.
3. The Output Format's `**Issues found**`/`**Vulnerabilities found**` list does not mention this finding at all.

**Postconditions**: A fixture asserting on the agent's Output Format finds no trace of the sub-80% finding anywhere in the reported output.

### Alternative Flows
- **UC-7-A1: CRITICAL finding at low confidence — still reported (the carve-out)** — the same review identifies a possible SQL-injection vector it assesses at only 55% confidence (genuinely ambiguous). Per FR-6.2, CRITICAL-tier findings MUST be reported regardless of confidence — the 80% threshold MUST NOT apply to CRITICAL-tier findings under any circumstance. The finding appears in the Output Format's list, tagged CRITICAL, unconditionally.
- **UC-7-A2: Consolidation — 5 identical findings across 5 files → 1 entry** — the diff touches 5 files, each missing an identical null-check pattern on a newly-added parameter. Per FR-6.4, this MUST be consolidated into a single reported finding listing all 5 affected locations, not 5 separate entries (AC-10).
- **UC-7-A3: A finding outside the diff — skipped unless CRITICAL** — while reviewing the diff, the agent notices an unrelated, pre-existing MEDIUM-tier issue in a function adjacent to (but not modified by) the current diff's changed hunks. Per FR-6.5, this MUST NOT be reported.
- **UC-7-A4: A pre-existing CRITICAL finding immediately adjacent to a changed hunk — still reported** — the same scenario as UC-7-A3, but the pre-existing issue is CRITICAL-tier (e.g., an unauthenticated admin endpoint one function above the diff's changed hunk). Per FR-6.6, this MUST still be reported — the diff-scoping rule carries the same CRITICAL exception as the confidence filter.

### Error Flows
None specific to this UC beyond FR-6.7's explicitly accepted risk (a real, non-CRITICAL, sub-80%-confidence finding can be suppressed) — a documented design tradeoff, not a malfunction; Gate 6 (`verifier`, confidence-filter-unaffected) is the secondary backstop for wiring-level defects a filtered finding might have caught first.

### Edge Cases
- **UC-7-EC1: A finding at exactly 80% confidence** — FR-6.1's threshold is stated as "greater than 80%"; a finding assessed at exactly 80% does not meet the "greater than" bar and MUST be treated as below-threshold (omitted, unless CRITICAL) — the literal boundary reading, not an inclusive one.
- **UC-7-EC2 (post-implementation hardening — no diff supplied): diff-scoping does not apply at all, and the whole codebase is scanned.** Neither `code-reviewer` nor `security-auditor` has a `Bash` tool, so neither can run `git diff` itself (`security-auditor`'s Process step 2 states this explicitly) — the diff, changed-file list, or branch range must arrive as part of the delegation prompt. When the delegation prompt supplies none of those — an invocation outside Gate 2/Gate 3's normal `git diff`-scoped trigger, such as a slice's `Pre-review: security` pass — the agent has no notion of "changed" at all: FR-6.5's skip-unchanged-code rule does not apply, and the agent scans the entire codebase as it did before this feature, exactly as UC-7's own primary flow behaves when a diff *is* present. This prevents the diff-scoping rule from silently suppressing every non-CRITICAL finding merely because the caller happened not to supply a diff.

### Data Requirements
- **Input**: The slice's `git diff`; the agent's own confidence assessment per finding (an internal judgment, not a field read from any file)
- **Output**: The Output Format's findings list, filtered per FR-6.1/FR-6.2/FR-6.5/FR-6.6 and consolidated per FR-6.4
- **Side Effects**: None — both agents remain read-only

---

## UC-8: Silent-Failure Severity Classification — `code-reviewer`

**Actor**: `code-reviewer` agent
**Preconditions**: `agents/code-reviewer.md`'s Review Checklist has gained a "Silent Failures" category (FR-7.1); Gate 2 is reviewing a diff
**Trigger**: `/merge-ready` Gate 2 delegates to `code-reviewer` — the same trigger as UC-7, isolating the silent-failure-specific classification rule within it

### Primary Flow (Empty Catch in a Data-Mutation Path → CRITICAL)
1. The diff introduces `try { await db.widgets.update(id, payload); } catch {}` inside a route handler that mutates persisted data — an empty catch block with no body (FR-7.1(a)).
2. Per FR-7.2, since the swallowed error occurs in a data-mutation code path, the finding is CRITICAL-tier.
3. Per FR-6.2/FR-7.3, a CRITICAL-tier silent-failure finding is exempt from both the confidence filter and the diff-scoping skip — it is reported unconditionally.
4. The finding appears in the Output Format's Issues list, tagged CRITICAL, naming the empty catch block's `file:line` (AC-9).

**Postconditions**: The Output Format's Issues list contains this finding regardless of the agent's confidence assessment; the overall Gate 2 verdict cannot be `PASS` while an unaddressed CRITICAL finding is present.

### Alternative Flows
- **UC-8-A1: The same pattern outside a data-mutation path → HIGH, not CRITICAL** — an empty `catch {}` block wraps a read-only, non-mutating operation (e.g., an optional analytics-ping call whose failure has no data-integrity consequence). Per FR-7.2, this is HIGH-tier, not CRITICAL — and, unlike the primary flow, IS subject to the normal 80% confidence filter and diff-scoping skip, since only CRITICAL-tier silent-failure findings are exempted (FR-7.3).
- **UC-8-A2: The other three silent-failure shapes** — a `.catch(() => [])`/`.catch(() => null)` handler with no logging/rethrow/user-facing signal (FR-7.1(b)); a caught error whose only action is a logger call with no rethrow/propagation/caller-visible signal (FR-7.1(c)); a promise chain with no `.catch()`/`try`-`catch` at all around an operation that can reject (FR-7.1(d)) — each is classified by the same data-mutation-vs-elsewhere rule as the primary flow, not a separate severity scale per shape.

### Error Flows
None beyond UC-7's general error-flow note (the confidence-filter risk, which does not apply to CRITICAL findings in this UC by construction).

### Edge Cases
- **UC-8-EC1: A silent failure in a financial code path outside the literal "data-mutation" wording** — FR-7.2 names "data-mutation or financial code path" as the CRITICAL trigger; a caught-and-swallowed error in a read-only balance-calculation function (no database write occurs, but the output feeds a financial display or downstream charge) still qualifies as CRITICAL under the "financial" half of the disjunction, independent of whether any mutation occurs — flagged explicitly so a QA fixture does not test only the mutation half of the rule.

### Data Requirements
- **Input**: The diff's changed hunks, scanned for the four FR-7.1 shapes
- **Output**: A CRITICAL or HIGH tagged finding per instance found, subject to FR-7.3's exemption scope
- **Side Effects**: None

---

## UC-9: Tracer-First Decomposition Gate

**Actor**: orchestrator (`/develop-feature` Phase 2, or a standalone `/implement-slice` invocation); `planner` agent (produces the tracer slice)
**Preconditions**: The plan's Slice 1 carries an explicit `**Tracer:** yes` marker (FR-8.2) and occupies Wave 1 alone (FR-8.5); no other slice may share Wave 1 with it, regardless of file disjointness
**Trigger**: `/develop-feature` Phase 2 begins wave-aware dispatch, reads the current wave from `.claude/scratchpad.md`, and finds Wave 1 contains the tracer slice — an existing pipeline point (Phase 2's own wave loop), never a new command

### Primary Flow (Tracer Passes → Expansion Slices Dispatch)
1. `/develop-feature` Phase 2 dispatches Wave 1 — the tracer slice alone, per the wave-1-alone rule.
2. The tracer slice's `/implement-slice` TDD loop runs: write the tracer test first, implement the thinnest end-to-end path across every architectural layer the feature touches, run the slice's `Verify:` command.
3. The `Verify:` condition passes (on the first attempt, or within the existing 3-retry budget).
4. Per FR-8.3, no slice other than the one marked `**Tracer:** yes` may be dispatched until this condition holds — it now holds.
5. `/develop-feature` proceeds to Wave 2 (the first expansion wave), dispatching its slice(s) through the normal wave-aware Phase 2 mechanism (single-slice direct, or multi-slice parallel `Agent` calls, per UC-10's disjointness check).

**Postconditions**: A commit exists for the tracer slice with a passing `Verify:` result; Wave 2's Agent tool calls (or direct `/implement-slice` invocation) are issued only after this point — verifiable from the transcript's own call ordering.

### Alternative Flows
None distinct from the primary flow at this UC's level of detail — expansion-wave dispatch mechanics are UC-10's concern.

### Error Flows
- **UC-9-E1: Tracer fails after 3 retries → phase halts, no expansion-slice commits exist** — the tracer slice's `Verify:` condition still fails after the existing 3-retry budget (`src/rules/error-recovery.md`) is exhausted. Per FR-8.4, `/develop-feature` Phase 2 MUST halt before spawning any expansion-slice work (single or parallel) — it MUST NOT proceed to Slice 2 with the tracer left broken. The blocker is reported via the existing Rule 3/Rule 4 escalation path. **Mechanically checkable outcome**: `git log` shows a commit (or a failed, uncommitted attempt) for the tracer slice only — zero commits exist for any slice beyond it, and zero `Agent` tool calls were issued for Wave 2 (AC-6).

### Edge Cases
- **UC-9-EC1: A legacy plan with no `**Tracer:** yes` marker — no gate applied** — a plan produced before this feature shipped (or by a planner invocation that predates FR-8) carries no slice marked `**Tracer:** yes` anywhere. Per NFR-3's explicit backward-compatibility clause, this plan MUST NOT be retroactively gated — its absence means the plan predates this feature, and `/develop-feature` Phase 2 executes the plan in its existing slice order with no tracer-gate at all, identical to pre-feature behavior. **Mechanically checkable outcome**: Slice 2 dispatches immediately after Slice 1 completes, with no `Verify:`-gating check performed beyond Slice 1's own normal per-slice verification (which happens for every slice regardless, tracer or not).

### Data Requirements
- **Input**: The plan file's `**Tracer:** yes` marker (or its absence); the tracer slice's `Verify:` command and its result
- **Output**: A pass/fail gate on Wave 2+ dispatch; the halted/proceeding state of Phase 2
- **Side Effects**: The tracer slice's own commit (on pass); no expansion-slice commits until the gate clears

---

## UC-10: Dispatch-Time Write-Surface Disjointness Check

**Actor**: orchestrator (`/develop-feature` Phase 2); `planner` agent (re-invoked for the recovery path)
**Preconditions**: `.claude/scratchpad.md` names a wave with 2+ pending slices, about to be dispatched as parallel `Agent` tool calls
**Trigger**: `/develop-feature` Phase 2's multi-slice wave dispatch step, immediately before issuing any `Agent` tool call for the wave — an existing pipeline point (Phase 2's own dispatch step), never a separate script or new command (FR-9.5 — this is orchestrating-model prose, not JavaScript)

### Primary Flow (Conflict Found → Wave Refused Before Any Agent Call)
1. Wave 2 of the plan names 2 pending slices: Slice 3 (`Files: src/handlers/widgets.ts, src/routes/widgets.ts`) and Slice 4 (`Files: src/handlers/widgets.ts, src/schemas/widget.ts`).
2. Immediately before issuing the `Agent` tool calls for this wave, the orchestrator re-derives the `Files:` lists of exactly Slice 3 and Slice 4 fresh from the plan file (not from memory, per FR-9.2) and checks pairwise disjointness.
3. `src/handlers/widgets.ts` appears in both lists.
4. Per FR-9.3, `/develop-feature` refuses to dispatch this wave — issuing zero `Agent` tool calls for it — and reports the specific conflicting path (`src/handlers/widgets.ts`) together with the slice numbers that both declare it (Slice 3, Slice 4).

**Postconditions**: Zero `Agent` tool calls were issued for Wave 2 (verifiable from the transcript); the refusal message names `src/handlers/widgets.ts`, `Slice 3`, and `Slice 4` explicitly (AC-5).

### Alternative Flows
- **UC-10-A1: Case-insensitive collision on a case-insensitive filesystem** — Slice 3 declares `src/Auth.ts`, Slice 4 declares `src/auth.ts` — textually different strings. Per FR-9.4, on a case-insensitive filesystem (e.g. default macOS APFS), the disjointness comparison MUST be performed case-insensitively, so these two paths are correctly treated as the same file and flagged as a conflict, NOT passed as disjoint merely because their literal string values differ. The wave is refused identically to the primary flow, naming both slice numbers and noting the case-variant collision.
- **UC-10-A2: Refused wave → Rule 3 replan → reassignment → successful dispatch (the recovery path)** — following the primary flow's refusal, per FR-9.6 the orchestrator treats this as a Rule 3 auto-resolve: it re-invokes `planner`, flagging the conflicting slice pair (Slice 3, Slice 4) and the specific shared path. `planner` reassigns Slice 4 to Wave 3 (a later wave) — or splits file ownership so each slice's `Files:` list no longer overlaps — and returns the revised plan. The orchestrator re-derives the (now-revised) Wave 2 `Files:` lists, finds no overlap, and dispatches the `Agent` tool calls for the revised Wave 2 successfully. This recovery path never dead-ends the run (NFR-1(b)) — only if `planner` cannot resolve the conflict automatically does the orchestrator fall back to a Rule 4 escalation (FR-9.6's explicit ordering: Rule 3 before Rule 4).

### Error Flows
None beyond UC-10-A2's Rule 4 fallback, which is itself the terminal state only when the Rule 3 replan cannot resolve the conflict (e.g., the two slices' work is genuinely inseparable onto disjoint files) — an explicit, reasoned escalation, not a silent stall.

### Edge Cases
- **UC-10-EC1: A single-slice wave — no check performed** — Wave 3 of the plan names exactly one pending slice. Per FR-9.2's explicit "a single-slice wave requires no check (nothing to conflict with)," the orchestrator performs no disjointness computation at all for this wave — it proceeds directly to dispatch (or, per Phase 2's existing single-slice path, invokes `/implement-slice` directly rather than spawning a parallel `Agent` call). This is not a check that trivially passes — it is skipped entirely, mirroring NFR-3's "degrades to existing single-slice behavior automatically, with no special-casing required."

### Data Requirements
- **Input**: The plan file's `Files:` lists for exactly the slices about to be dispatched in the current wave, re-read fresh (not from memory)
- **Output**: Either the wave's `Agent` tool calls proceed normally, or zero `Agent` calls are issued and a refusal naming the conflicting path and slice numbers is reported
- **Side Effects**: On refusal, none from the check itself; the recovery path's `planner` re-invocation modifies the plan file (wave/file reassignment)

---

## Traceability

Every UC (including its alternative/error/edge sub-flows) maps to at least one FR from PRD Section 9. This confirms FR-1 through FR-10 are each covered by at least one use case — no FR is left with only thin, invented coverage.

| UC | Title | FR(s) Covered |
|---|---|---|
| UC-1 (+A1, E1, EC1, EC2) | Gate 6 Verdict Determination | FR-1.1, FR-1.2 (amended), FR-1.3, FR-1.4, FR-1.5 |
| UC-2 (+A1, E1, EC1) | The `passed` Invariant and Malformed-Report Handling | FR-2.5, FR-3.1, FR-3.2, FR-3.3, NFR-3 |
| UC-3 (+A1, E1, EC1) | Gate 6 `--gaps` Replan Loop | FR-10.1, FR-10.2 (amended), FR-10.3, FR-10.4 |
| UC-4 (+A1, A2, E1, EC1) | Level 2 Anti-Pattern Severity Split | FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5 |
| UC-5 (+A1, A2, EC1) | Verifier's Machine-Readable Report — Scoped Write Target | FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.6, FR-2.7 |
| UC-6 (+A1, A2, E1, EC1) | Plan Critic — Autonomous and Interactive Invocation | FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-5.6, FR-5.9 |
| UC-7 (+A1–A4, EC1) | Reviewer Confidence Filter and Diff-Scoping | FR-6.1, FR-6.2, FR-6.3, FR-6.4, FR-6.5, FR-6.6, FR-6.7 |
| UC-8 (+A1, A2, EC1) | Silent-Failure Severity Classification | FR-7.1, FR-7.2, FR-7.3 |
| UC-9 (+E1, EC1) | Tracer-First Decomposition Gate | FR-8.1, FR-8.2, FR-8.3, FR-8.4, FR-8.5, NFR-3 |
| UC-10 (+A1, A2, EC1) | Dispatch-Time Write-Surface Disjointness Check | FR-9.1, FR-9.2, FR-9.3, FR-9.4, FR-9.5, FR-9.6 |

**FR coverage check**: FR-1 (UC-1), FR-2 (UC-5, UC-2), FR-3 (UC-2), FR-4 (UC-4), FR-5 (UC-6), FR-6 (UC-7), FR-7 (UC-8), FR-8 (UC-9), FR-9 (UC-10), FR-10 (UC-3) — every FR-1 through FR-10 has at least one covering use case. FR-5.7/FR-5.8 (agent count 13→14; the Agency Roles table gaining a `plan-critic` row) are structural/documentation requirements with no independent runtime behavior beyond what UC-6's primary flow already exercises (a `plan-critic` invocation happening at all requires the agent file and its registration to exist) — they are verified by AC-7/AC-8 directly against the files, not by a distinct behavioral use case, and are noted here rather than given invented scenario coverage.

**Post-architecture-review amendments reflected in this document (re-synced against `agents/planner.md` and `agents/verifier.md`'s actual frontmatter):** FR-1.2 (UC-1, via UC-1-EC1's third sub-case) now pins Levels 1–3 PASS with Level 4 `SKIPPED` to `UNCERTAIN`, resolving what would otherwise be a dual match with `PRESENT_BEHAVIOR_UNVERIFIED`. FR-10.2 (UC-3) now has `planner` — which has no `Write`/`Edit` tool — return replan slices as structured output for the orchestrator to append, rather than writing them itself. FR-2.7 (UC-5, new to this document's coverage) has Gate 6 supply the UTC timestamp and feature slug verbatim, since `verifier` has no `Bash` tool and never invents one; `generated_at_note` is the documented fallback when none is supplied.
