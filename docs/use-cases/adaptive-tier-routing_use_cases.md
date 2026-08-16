# Use Cases: Adaptive Tier Routing and Model Routing

> Based on [PRD](../PRD.md) — Section 10: Adaptive Tier Routing and Model Routing

**System context (do not assume otherwise):** This feature has no UI, no server, and no database — it is a harness for autonomous development, not a user-facing application. Its artifacts are triage decisions stated in the orchestrating model's own response text, markdown agent/skill prompt files, shell frontmatter rewrites, and plain files (`.sdlc-model-profile`, `docs/digest-index.md`). The actors below are pipeline roles, not end users:

- **Orchestrator** — the main Claude Code session running `/develop-feature` (Phase 0 triage onward), `/bootstrap-feature`, `/implement-slice`, or `/merge-ready`, or responding to an unprefixed natural-language request per `src/claude.md`'s Triage restatement.
- **`planner`, `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `plan-critic`, `test-writer`, `build-runner`, `code-reviewer`, `security-auditor`, `doc-updater`** — subagents invoked by the orchestrator at existing pipeline points, exactly as before this feature; this feature changes *which* of them get invoked for a given request (fast tier invokes none; quick tier invokes `planner` once plus a reduced `/merge-ready` gate subset; full tier invokes all of them, unchanged).
- **`install.sh`** — a shell script run by a human at install time. It is itself named directly in NFR-1(a)'s list of sanctioned "existing pipeline points" — not a per-feature workflow step a developer must remember to invoke for the pipeline to work, but a deliberate, occasional configuration action, in the same family as its own pre-existing `--uninstall`/`--restore`/`--dry-run` flags.
- **The CI drift validator** (`scripts/ci/validate-model-profile.js`) — invoked automatically by `.github/workflows/ci.yml` on push/PR, never run manually as part of a feature's flow.
- **The statusline** (`templates/statusline.js`, installed as `.claude/statusline.js`) — invoked automatically by Claude Code's own native statusline mechanism after each response, when configured. It is not a hook and is not dispatched by `hooks/lib/run-hook.js`.
- **Developer** — a human. In every triage/escalation/execution primary flow documented here, the Developer is **absent** — the entire point of this feature is that classification, escalation, and execution proceed without them. Where a human appears, it is one of exactly two sanctioned cases: (1) the pipeline deliberately escalated to a stop-and-ask condition (Rule 4 at the `full` ceiling, FR-2.5), or (2) a human typed a deliberate override or install-time configuration action — `/sdlc-fast`, `/sdlc-quick` (FR-6, explicitly named the sole skill-level exception, NFR-2: "override entry points only — never invoked by the pipeline itself, never required for a run to complete"), or `install.sh --profile` (explicitly named in NFR-1(a)'s own list of sanctioned pipeline points). Neither case is a manual step standing between a request and the pipeline completing on its own.

**Autonomy audit (NFR-1), stated once here rather than repeated per use case:** every primary flow's trigger in this document was checked against NFR-1(a) — it must fire from an existing pipeline point (`/develop-feature` Phase 0, an existing `/merge-ready` gate/preamble, `install.sh`, an existing agent's Process step, Claude Code's own native statusline invocation, or an automatic CI trigger) — never a new command a human must remember to run for the *normal* pipeline to proceed. Four use cases in this document (UC-9, UC-10, UC-12, UC-13) have a human-typed trigger. All four are the harness's own named, sanctioned exceptions — UC-9's `/sdlc-fast`/`/sdlc-quick` per FR-6/NFR-2's explicit "override entry points only" carve-out, and UC-10/UC-12/UC-13's `install.sh --profile` (or its absence) per NFR-1(a) naming `install.sh` directly as a sanctioned pipeline point, and UC-13 specifically being the *pre-existing*, unmodified `install.sh` invocation with no new manual step added by this feature at all. None of the four is documented as a required step standing between a request and pipeline completion — every triage/escalation/execution use case (UC-1 through UC-8, UC-15 through UC-18) runs with zero human involvement in its primary flow. If a future revision of this document ever needs to add a scenario whose only trigger is a human running something manually AND that scenario is not one of these two named exceptions, it MUST be flagged explicitly as a violation of the autonomy contract, not documented as if it were ordinary.

**The organizing principle of this document:** this is the blueprint the QA Lead (`qa-planner`) reads next to write `docs/qa/adaptive-tier-routing_test_cases.md`. Every flow below ends in a mechanically checkable outcome — a specific string stated before a specific tool call, a specific file that exists or does not, a specific `git diff --stat` shape, a specific CI exit code naming a specific file/value pair — never a subjective judgment call.

---

## Reference: Tiers, Escalation Direction, and Fixed Tables (referenced throughout, not restated per use case)

**The three tiers and the one-way escalation direction (FR-1, FR-2):** `fast` → `quick` → `full`. Escalation only ever moves rightward; `full` is the ceiling (FR-2.5) and the only tier with today's unmodified Rule 4 stop-and-ask behavior. A tier, once assigned (by FR-1's classification or by an FR-2 escalation), is never automatically lowered for the remainder of that run (FR-2.6) — the only way to run below what FR-1 would currently assign is an explicit, human-invoked override (FR-6) issued *before* the run starts.

**FR-1.3 — mechanical `full`-forcing signals, checked first, any one forces `full` immediately (skipping FR-1.4/FR-1.5 entirely):** (a) a new API route/endpoint, a new user-facing page/screen/flow, or a new external service integration; (b) a database schema/migration change; (c) touches authentication, authorization, or payment/billing logic — by keyword match against the request text, or by the estimated file set overlapping a path FR-1.7 marks sensitive; (d) the estimated file set contains more than 3 files.

**FR-1.4 — `fast`-tier signal, requires ALL of:** (a) the estimated file set contains exactly 1 file; (b) the change is one of: a spelling/grammar fix in a comment/docstring/user-facing copy string; a change to a single hardcoded literal (constant, config default, version string, URL, timeout number) with **no accompanying logic change**; a comment-only edit; or a dependency-version bump requiring no source change.

**FR-1.5 — `quick`-tier signal:** not forced to `full` by FR-1.3, not satisfying FR-1.4, and the estimated file set contains between 1 and 3 files describing **one bounded, already-understood behavior** (a bug with a **known** root cause, a missing validation, a small new utility function, an adjustment to an existing function's/endpoint's behavior) with no new user-facing flow and no new architectural component.

**FR-1.6 — the tie-break rule, stated verbatim because UC-3 depends on it:** "any request not classified `fast` (FR-1.4) or `quick` (FR-1.5), or forced by FR-1.3, is classified `full` — **including any request the model cannot confidently place in `fast` or `quick`**. `full` is the tier of default safety, never a positive signal of its own." Ambiguity always resolves upward, to `full` — never to a guess at a cheaper tier, and never to a stall asking a human which tier to use.

**FR-1.7 — sensitive paths, fixed default (used when a project's `.claude/rules/security.md` declares no `## Sensitive Paths` section):** any path containing `auth`, `payment`, `billing`, `secret`, or `migration` as a path segment (case-insensitive); any path under `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`.

**FR-1.8 — the stated reason is mandatory:** whichever tier is assigned, the response MUST state the tier and the specific signal that produced it *before any `Edit`/`Write` call for the requested change*. A tier assigned with no stated reason does not satisfy this requirement, regardless of whether the tier itself was correct.

**FR-8.1 — the model profile table, exact:**

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

`quality`'s column equals the shipped baseline exactly (FR-8.2) — this is what lets "no `.sdlc-model-profile` receipt" and "receipt present, reading `quality`" be treated as the identical, validated state (FR-9.3).

---

## UC-1: Fast-Tier Classification — Single-File Copy Edit

**Actor**: orchestrator (`/develop-feature` Phase 0, or `src/claude.md`'s Triage restatement for an unprefixed request)
**Preconditions**: a request has just been received; no `Edit`/`Write` call has yet been made for it
**Trigger**: `/develop-feature` reaches the new Phase 0 (before Phase 1: Bootstrap), or — for an unprefixed natural-language request — the orchestrator's own first response step, per `src/claude.md`'s Triage restatement (FR-1.1) — both existing, automatic pipeline points; before any `Edit`/`Write` call related to the change and before invoking any subagent

### Primary Flow (Typo Fix → `fast`, Reason Stated)
1. Request: "fix the typo 'recieve' to 'receive' in README.md."
2. Per FR-1.2, the orchestrator states the estimated file set in its own response: `{README.md}`.
3. FR-1.3 is checked first: not a new endpoint/page/integration; no schema change; no auth/payment/billing keyword match, no sensitive-path overlap; file count is 1, not `>3`. None of (a)–(d) match.
4. FR-1.4 is checked: (a) exactly 1 file — true; (b) a spelling/grammar fix in user-facing copy — true. Both hold.
5. Per FR-1.8, before any `Edit`/`Write` call, the orchestrator states, verbatim: `tier: fast — single-file copy edit, no sensitive path`.
6. Execution proceeds under FR-3 (UC-4).

**Postconditions**: the response text, before any `Edit`/`Write` tool call, contains the literal string `tier: fast` plus the FR-1.4 reason (AC-1); zero `Agent` tool calls were issued for classification itself.

### Alternative Flows
- **UC-1-A1: single hardcoded literal, no logic change** — "bump the retry timeout constant from 3000 to 5000 in `src/config.ts`" — a 1-file, literal-only change with no accompanying logic change satisfies FR-1.4(b)'s second bullet identically.
- **UC-1-A2: dependency-version bump requiring no source change** — "bump `lodash` from 4.17.20 to 4.17.21 in `package.json`" satisfies FR-1.4(b)'s fourth bullet.

### Error Flows
None — classification itself cannot fail; a request that does not cleanly satisfy `fast` falls through to `quick` or `full` (UC-3), never to an error state.

### Edge Cases
- **UC-1-EC1: single file, but a logic change rides along** — "fix the typo in the discount calculation, and while you're in there also correct the off-by-one in the loop" targets 1 file, but the second clause is a logic change, so FR-1.4(b)'s "no accompanying logic change" clause fails even though the file-count half (a) is satisfied. FR-1.4 requires **all** of its conditions — this request does NOT qualify `fast` despite the 1-file count, and is evaluated instead against FR-1.5/FR-1.6 (see UC-3-EC1 for the sibling case).

### Data Requirements
- **Input**: the request text
- **Output**: the stated tier + FR-1.4 reason, appearing before any `Edit`/`Write` call
- **Side Effects**: none at classification time — execution's side effects are UC-4's

---

## UC-2: Full-Tier Classification — New API Endpoint

**Actor**: orchestrator
**Preconditions**: same as UC-1
**Trigger**: same Phase 0 / Triage-restatement point as UC-1

### Primary Flow (New Endpoint → `full`, Forced Immediately, Reason Stated)
1. Request: "add a POST `/api/webhooks/stripe` endpoint."
2. Per FR-1.2, the orchestrator states the estimated file set, e.g. `{src/routes/webhooks.ts [new], src/handlers/stripeWebhook.ts [new]}`.
3. FR-1.3(a) matches ("a new API route/endpoint") — per FR-1.3, this forces `full` **immediately, skipping FR-1.4/FR-1.5 entirely**, regardless of how small the estimated file set is.
4. Per FR-1.8, the orchestrator states, verbatim: `tier: full — FR-1.3(a), new API endpoint`.
5. Execution proceeds under FR-5.1: the existing Phase 1 (Bootstrap) → Phase 1.5 → Phase 2 → Phase 3 pipeline, unmodified beyond the new Phase 0 preceding it.

**Postconditions**: the response states `tier: full` with the FR-1.3(a) reason before any `Edit`/`Write` call (AC-1); `/bootstrap-feature` (existing Phase 1) is invoked next.

### Alternative Flows
- **UC-2-A1: schema/migration change → `full` via FR-1.3(b)** — "add a `deleted_at` column to the `users` table" forces `full` regardless of file count.
- **UC-2-A2: sensitive-path overlap → `full` via FR-1.3(c)** — "update the timeout value in `install.sh`" has an estimated file set of exactly 1 file, and no logic change — it would otherwise look like UC-1's `fast` pattern — but `install.sh` is one of FR-1.7's fixed sensitive-path defaults; FR-1.3(c)'s "or... overlapping a path FR-1.7 marks sensitive" forces `full` regardless of the 1-file count and regardless of whether the change is a literal-only edit. This demonstrates FR-1.3 is checked, and can force `full`, *before* FR-1.4 is even evaluated.
- **UC-2-A3: estimated file set `>3` files → `full` via FR-1.3(d)**, even absent any other full-forcing signal — "refactor the widget module: update `src/widgets/service.ts`, `src/widgets/repo.ts`, `src/widgets/types.ts`, `src/widgets/index.ts`" (4 files) forces `full` on file count alone.

### Error Flows
None.

### Edge Cases
- **UC-2-EC1: multiple FR-1.3 signals apply at once** — a request that is both a new endpoint (a) and touches billing logic (c) is classified `full` identically either way; the orchestrator cites whichever specific subclause it identifies first — precedence among FR-1.3's own subclauses is immaterial, since all of (a)–(d) resolve to the same tier.

### Data Requirements
- **Input**: the request text
- **Output**: the stated `tier: full` + the specific FR-1.3 subclause cited
- **Side Effects**: none at classification time — `/bootstrap-feature`'s side effects are outside this UC's scope (documented in the pipeline's own pre-existing use cases)

---

## UC-3: Genuinely Ambiguous Classification — the Tie-Break Rule

**Actor**: orchestrator
**Preconditions**: same as UC-1
**Trigger**: same Phase 0 / Triage-restatement point as UC-1

### Primary Flow (Root Cause Not Confidently Known → `full`, the Tie-Break Applied)
1. Request: "users occasionally report the dashboard shows stale numbers after a refresh — can you take a look and fix it?" No new endpoint, no schema change, no auth/payment/billing keyword, no sensitive-path overlap.
2. Per FR-1.2, the orchestrator states a *best-guess* estimated file set, e.g. `{src/services/dashboardCache.ts}`, while noting the actual cause is not yet known — a pre-investigation bug report, not a diagnosed one.
3. FR-1.3 is checked: none of (a)–(d) match on the best-guess file set.
4. FR-1.4 is checked: fails — this is not a spelling/literal/comment/dependency-bump change.
5. FR-1.5 is checked: `quick` requires "a bug with a **known** root cause" among its enumerated bounded-behavior descriptions. Because the request is explicitly a "take a look and fix it" report with no stated cause, the orchestrator cannot confidently assert the root cause is already known — FR-1.5's "one bounded, already-understood behavior" condition is not confidently satisfied.
6. Per FR-1.6, "any request the model cannot confidently place in `fast` or `quick`" is classified `full`. This is the tie-break rule stated concretely: ambiguity resolves upward, never to a guess at `quick`, never to a stall asking which tier to use.
7. Per FR-1.8, the orchestrator states, verbatim: `tier: full — FR-1.6, root cause not confidently known, cannot place in fast or quick`.

**Postconditions**: `tier: full` is stated with the FR-1.6 reason before any `Edit`/`Write` call; the ambiguous bug report receives PRD/use-cases/QA documentation before any fix is attempted — the safe-direction outcome the tie-break rule is designed to produce.

### Alternative Flows
- **UC-3-A1: same domain, root cause explicitly stated → `quick`, not `full`** — "the dashboard cache TTL is wrong in `dashboardCache.ts` — bump it to 60 seconds" names a known root cause and a single function in a single file. FR-1.5 is now confidently satisfied (bounded, known cause, ≤3 files) — classified `quick`. Same subject matter as the primary flow; the presence or absence of a confidently-known root cause is what moves the tier, not the topic.

### Error Flows
None — `full` is a completion state, not a failure state, even when reached via ambiguity.

### Edge Cases
- **UC-3-EC1: a request that looks partly like `fast`, but a judgment clause disqualifies it** — "bump the retry timeout constant from 3000 to 5000 in a single file, but also double check the retry logic still makes sense" — the second clause introduces judgment beyond a literal swap, so FR-1.4(b)'s "no accompanying logic change" is not met even though the file-count half, FR-1.4(a), is satisfied. FR-1.4 requires ALL of its conditions, so this does not qualify `fast`. It is instead evaluated against FR-1.5: bounded, 1 file, but "double check... makes sense" is closer to a judgment review than a fully bounded, already-understood behavior — if the orchestrator cannot confidently place it in `quick` either, FR-1.6 classifies it `full`, the same tie-break as the primary flow. This shows `fast` requires *all* of FR-1.4, not merely the file-count clause.

### Data Requirements
- **Input**: the request text, including whether it states a diagnosed cause or only a symptom
- **Output**: `tier: full` (or `tier: quick`, UC-3-A1) with the specific FR-1.5/FR-1.6 reasoning stated
- **Side Effects**: none at classification time

---

## UC-4: Fast-Tier Execution — No Documentation, One Commit, One Changelog Entry

**Actor**: orchestrator (no `Agent`/`Task` tool call at any point — FR-3.1)
**Preconditions**: request already classified `fast` (UC-1), reason stated
**Trigger**: immediately following UC-1's classification, within the same response (FR-3.1)

### Primary Flow (Edit → Verify → Commit → Changelog, Zero Subagents, Zero Documentation)
1. The orchestrator makes the `Edit` call(s) directly to the estimated file set — no `Agent`/`Task` call at any point.
2. No `docs/PRD.md`, `docs/use-cases/*`, or `docs/qa/*` file is created or modified for this change; no plan is written to `.claude/scratchpad.md`'s `## Plan` section (FR-3.1).
3. After editing, the orchestrator runs the project's declared build/typecheck command directly via its own `Bash` call (FR-3.2), reusing `stop:typecheck-format`'s existing "read the command from the project's CLAUDE.md; no-op visibly when none is declared" contract.
4. The orchestrator commits per `src/rules/git.md` unchanged: feature branch, conventional commit message, no AI attribution (FR-3.3).
5. After the successful commit, the orchestrator writes ONE `CHANGELOG.md` entry directly — real `date -u` timestamp, idempotency guard, ≤500-character Details (FR-3.4). No `/merge-ready` run occurs for `fast` tier, so this write is never suppressed by a `no-changelog` flag and is owned by nothing downstream — skipping it is not an option.
6. Since the run did not escalate, `.claude/scratchpad.md` is not written at all (FR-3.5).

**Postconditions (AC-2)**: zero new/modified files under `docs/PRD.md`, `docs/use-cases/*`, `docs/qa/*`; `CHANGELOG.md` gains exactly one new entry under today's date; `git log` shows exactly one new commit on a feature branch; `.claude/scratchpad.md` is absent or unmodified.

### Alternative Flows
None beyond UC-1's classification variants, already covered.

### Error Flows
- **UC-4-E1: typecheck/build fails after the edit** — Rule 1 (auto-fix typo/import) or Rule 3 (auto-resolve dependency/config) from `error-recovery.md` applies unchanged inside `fast`-tier discipline. If the fix requires touching a second file, this is not a `fast`-tier error path proper — it is UC-6's escalation trigger, reached from a verification failure rather than from the initial estimated-file-set plan.

### Edge Cases
- **UC-4-EC1: a fast-tier run whose sole file never changes, but whose build failure cannot be resolved without touching a second file** — this is UC-6's fast→quick trigger, restated to show the escalation can originate from a verification failure mid-execution, not only from a second edit the orchestrator chose to make.

### Data Requirements
- **Input**: the estimated file set (1 file), `tier: fast`
- **Output**: 1 commit, 1 changelog entry
- **Side Effects**: build/typecheck run; git commit; `CHANGELOG.md` write; zero `Agent` tool calls issued (mechanically verifiable from the transcript)

---

## UC-5: Quick-Tier Execution — One Subagent, One Plan File, TDD, No Documentation

**Actor**: orchestrator; `planner` (Quick-Tier Contract mode, no `Write`/`Edit` tool — AC-22); `test-writer`, `build-runner` (via `/implement-slice`); `code-reviewer`, `security-auditor` (via the reduced `/merge-ready` gate subset)
**Preconditions**: request classified `quick` (FR-1.5, UC-3-A1) or arrived via escalation (UC-6)
**Trigger**: the orchestrator's own tier-branch step immediately after triage assigns `quick` — the same Phase 0 branch point that also dispatches `fast`/`full`, an existing point, not a new one

### Primary Flow (Plan → TDD → Reduced Gate Subset, No PRD/Use-Cases/QA)
1. Request classified `quick`, reason stated (e.g. `tier: quick — FR-1.5, bounded bug with known root cause, 1 file`).
2. The orchestrator invokes `planner` **exactly once**, under the new Quick-Tier Contract (FR-4.1): a plain feature/fix description in — no PRD section, use-cases file, QA file, or architecture review supplied, since none exist for a `quick`-tier change. `planner` skips its default Process step 1 documentation-existence read entirely for this mode.
3. `planner` — which has no `Write`/`Edit` tool — returns exactly one slice in the standard `Files:`/`Changes:`/`Verify:`/`Done when:` format.
4. The orchestrator writes the returned slice into `.claude/scratchpad.md`'s `## Plan` section — the same location/format `/bootstrap-feature` Step 7 already uses — as a single, un-waved slice, together with `## Tier: quick` and a `## Feature:` name (FR-4.2). No second, separate plan-file format is introduced.
5. The orchestrator runs `/implement-slice` against this one slice (FR-4.3): Pre-flight Check 4 (confirm `docs/qa/*`/`docs/use-cases/*` exist) is skipped entirely because `## Tier:` reads `quick` (FR-4.4). `test-writer` writes tests first, the orchestrator implements, `build-runner` verifies, the slice commits per `src/rules/git.md`.
6. After the slice commits, the orchestrator runs `/merge-ready` (FR-4.5) under the Tier Check preamble (FR-4.6): it reads `## Tier: quick`, runs Gate 0 (Git Hygiene), Gate 2 (Code Review), Gate 3 (Security Audit), Gate 4 (Build Verification) exactly as today, and reports Gate 1, 5, 6, 7, 8 as `SKIPPED (tier: quick)` in the output table rather than running or silently omitting them.
7. The Finalization trigger condition is read as "all gates that were not `SKIPPED` report PASS" — a `SKIPPED` gate neither blocks finalization nor counts as a FAIL. `/merge-ready` writes the single changelog entry (existing Finalization step, reused unmodified).

**Postconditions**: exactly 1 `Agent` call to `planner` for this feature (mechanically countable in the transcript); `.claude/scratchpad.md` shows `## Tier: quick`, one un-waved slice, no `Wave:` fields; zero files under `docs/PRD.md`/`docs/use-cases/*`/`docs/qa/*` created or modified; `/merge-ready`'s gate table shows Gate 1, 5, 6, 7, 8 = `SKIPPED (tier: quick)` and Gates 0, 2, 3, 4 = PASS/FAIL; `MERGE READY` is reachable with the 4 non-`SKIPPED` gates all PASS.

### Alternative Flows
- **UC-5-A1: quick tier reached via fast→quick escalation (UC-6) rather than direct FR-1.5 classification** — identical from step 2 onward, except the already-touched file(s) are included in the single slice's `Files:`/`Changes:` fields as work already done (FR-2.3(d)).

### Error Flows
- **UC-5-E1: Gate 2 or Gate 3 fails during the reduced gate subset** — handled by the existing Auto-Fix Protocol unchanged (fix, rerun only the failed gate, 3-attempt budget) — no `quick`-tier-specific behavior; this is the identical protocol `full` tier already uses.

### Edge Cases
- **UC-5-EC1: a `quick`-tier run that in fact touched only 1 file — never silently re-labeled `fast` after the fact** — the run still reports Gates 1/5/6/7/8 as `SKIPPED (tier: quick)`, regardless of how simple the actual change turned out to be (FR-2.6, AC-5) — verifiable by inspecting `.claude/scratchpad.md`'s `## Tier:` value, unchanged from the value set at classification (or the one escalation FR-2.1 permits).

### Data Requirements
- **Input**: a plain feature/fix description (no PRD/use-cases/QA)
- **Output**: one plan slice, one commit, a reduced 5-of-9-gate `/merge-ready` table
- **Side Effects**: `.claude/scratchpad.md` write (`## Tier:`, `## Feature:`, `## Plan`); one commit; one changelog entry (via `/merge-ready` Finalization)

---

## UC-6: Fast → Quick Escalation

**Actor**: orchestrator
**Preconditions**: currently operating under `fast` tier per UC-1/UC-4; mid-execution
**Trigger**: an `Edit`/`Write` call about to be made under `fast`-tier discipline would target either (a) a file outside the FR-1.2 estimated file set, or (b) a path FR-1.7 marks sensitive (FR-2.1) — checked at the point of issuing that specific `Edit`/`Write` call, an existing point in FR-3's own execution flow

### Primary Flow (Second File Discovered Mid-Edit → Escalate)
1. A `fast`-tier run editing `README.md` (the sole estimated file) discovers, while fixing the typo, that a second file — `docs/glossary.md` — also needs the same correction for consistency.
2. Before making the `Edit` call to `docs/glossary.md`, the orchestrator recognizes this file is outside the FR-1.2 estimated file set `{README.md}`.
3. Per FR-2.3(a), the orchestrator states, verbatim, that escalation is occurring and names the second file: "Escalating from fast to quick — `docs/glossary.md` is outside the estimated file set `{README.md}`."
4. Per FR-2.3(b), the already-made edit to `README.md` remains in place — never reverted solely because of the escalation.
5. Per FR-2.3(c), `.claude/scratchpad.md` is initialized with `## Tier: quick` and a `## Feature:` name, recording `README.md` as already-completed context.
6. Per FR-2.3(d), the orchestrator proceeds under FR-4 (UC-5) for the remainder of the work, with `README.md` included in the single slice's `Files:`/`Changes:` fields as work already done.

**Postconditions (AC-3)**: the escalation statement, naming `docs/glossary.md`, appears in the response before that file's `Edit` call is made; `.claude/scratchpad.md` afterward shows `## Tier: quick`; `README.md`'s edit remains present, unreverted.

### Alternative Flows
- **UC-6-A1: sensitive-path trigger, regardless of file count** — the `fast`-tier run's sole estimated file (still just 1 file — no file-count growth) turns out, on inspection, to be `install.sh` (one of FR-1.7's fixed defaults). Per FR-2.1's second condition ("or a path FR-1.7 marks sensitive"), this triggers escalation to `quick` even though the file count never exceeded 1 — the sensitive-path clause is independent of, and does not require, the file-count clause. The same FR-2.3 mechanics apply: state the escalation and name the sensitive path, leave the edit in place, initialize `## Tier: quick`.

### Error Flows
None — FR-2 escalation is itself the recovery mechanism, not a failure state.

### Edge Cases
- **UC-6-EC1: the named enforcement gap (FR-2.7, Risk 1)** — this trigger is enforced entirely by the orchestrator's own compliance with FR-1.8/FR-2.1; no hook checks `Edit`/`Write` call counts against the declared tier. A `fast`-tier run that silently makes a second-file edit without stating the escalation is not mechanically blocked by anything this feature adds — a named, accepted gap, not a silent one, per Risk 1's own text.

### Data Requirements
- **Input**: the file about to be targeted, compared against the FR-1.2 estimated set and FR-1.7's sensitive-path list
- **Output**: the escalation statement naming the file/path
- **Side Effects**: `.claude/scratchpad.md` created with `## Tier: quick`

---

## UC-7: Quick → Full Escalation

**Actor**: orchestrator; `planner` (Quick-Tier Contract, already invoked); `prd-writer`/`ba-analyst`/`architect`/`qa-planner` (now invoked for the expanded scope, via `/bootstrap-feature`)
**Preconditions**: currently operating under `quick` tier (UC-5); mid-TDD-cycle
**Trigger**: a Rule 4 condition (`src/rules/error-recovery.md` — architectural decision, new dependency, API contract change, schema migration) is encountered during FR-4's TDD cycle (FR-2.2) — an existing point (Rule 4 detection already happens in every TDD cycle; FR-2.2 only redirects what happens next)

### Primary Flow (Rule 4 Mid-TDD → Redirect to `full`, Never Stop-and-Ask)
1. The quick-tier slice's TDD implementation reveals the fix actually requires adding a new npm dependency — a Rule 4 condition per `error-recovery.md`.
2. Per FR-2.2, the run does **not** follow Rule 4's default "stop implementation, present to user" behavior — it does not stop and ask.
3. Per FR-2.4(a), the orchestrator states, verbatim, that escalation to `full` is occurring and names the Rule 4 condition: "Escalating from quick to full — this fix requires adding a new npm dependency, a Rule 4 condition."
4. Per FR-2.4(b), the already-committed quick-tier slice commit remains in place, never reverted.
5. Per FR-2.4(c), the orchestrator invokes `/bootstrap-feature` for the full, now-larger scope, supplying the already-completed work as context, so `prd-writer`/`ba-analyst`/`architect`/`qa-planner` document it accurately rather than purely prospectively.
6. Per FR-2.4(d), `planner` marks the already-satisfied slice DONE with its existing commit hash in the resulting plan — never re-implemented.
7. Per FR-2.4(e), the run proceeds through the remaining slices and an unmodified, full 9-gate `/merge-ready` — indistinguishable at completion from a request classified `full` from the start.

**Postconditions (AC-4)**: `/bootstrap-feature` runs for the expanded scope; the resulting plan shows the already-committed quick-tier slice as DONE with its existing commit hash; the run concludes through a full 9-gate `/merge-ready` (no gate reported `SKIPPED` for tier reasons).

### Alternative Flows
None beyond the trigger's own Rule 4 variety — any of the four Rule 4 examples (new dependency, API contract change, schema migration, module-boundary restructuring) escalates identically.

### Error Flows
- **UC-7-E1**: none specific to this escalation — this UC IS the error-recovery redirection itself. A Rule 4 condition encountered while already at `full` (not reached via this path) retains today's unmodified stop-and-ask behavior instead (FR-2.5, UC-8-A1's ceiling).

### Edge Cases
- **UC-7-EC1: Rule 4 hit on the very first slice, before any quick-tier commit exists yet** — FR-2.4(b)/(d)'s "already-committed"/"already-satisfied slice" language is vacuously satisfied (nothing to preserve or mark DONE). The escalation still proceeds through steps 3, 5, and 7; step 6 simply has nothing to mark.

### Data Requirements
- **Input**: the Rule 4 condition detected mid-TDD-cycle
- **Output**: the escalation statement; the `/bootstrap-feature` invocation; the revised plan with the DONE slice
- **Side Effects**: new PRD section/use-cases/QA files/architecture review created for the expanded scope; an unmodified full 9-gate `/merge-ready` run

---

## UC-8: Full Feature That Turns Out Simple — Stays Full (No Downgrade)

**Actor**: orchestrator
**Preconditions**: request already classified `full` (via FR-1.3/FR-1.6, or via UC-7's escalation)
**Trigger**: mid-run (any point during Phase 1–3), the orchestrator's own evaluation of actual scope suggests the feature could have been done more cheaply — an existing point in the ongoing run, not a new decision gate

### Primary Flow (Trivial-in-Hindsight Feature — No Automatic Downgrade)
1. A request was classified `full` at Phase 0 (e.g., forced by FR-1.3(a), a new API endpoint).
2. During Phase 2 (`planner`'s plan), it becomes apparent the endpoint's implementation is trivial — `planner` could, in principle, have produced a single-slice plan.
3. Per FR-2.6, since the tier was already assigned by FR-1 (or by an escalation), it MUST NOT be automatically lowered for the remainder of the run, regardless of what later evaluation of actual scope suggests.
4. The run completes the full pipeline unmodified: PRD section, use-cases document, architecture review, QA test cases, the plan (even if it is a single slice), and every applicable `/merge-ready` gate at `full` — exactly as FR-5.1 states, with no re-triage, no silent short-circuit back to `fast`/`quick` discipline, and no gate reported `SKIPPED` for tier reasons.
5. The only way to have run this request below `full` is an explicit, human-invoked override (FR-6, UC-9) issued **before** the run started — never a pipeline decision taken mid-run.

**Postconditions**: `docs/PRD.md`, `docs/use-cases/<feature>_use_cases.md`, and `docs/qa/<feature>_test_cases.md` all exist for this feature regardless of how small the final implementation turned out to be; `/merge-ready`'s gate table shows no gate `SKIPPED` for tier reasons; `.claude/scratchpad.md` carries no `## Tier: quick` or `## Tier: fast` value at any point in this run's history.

### Alternative Flows
- **UC-8-A1: a Rule 4 condition hit while already at `full` — the ceiling, not a redirect** — unlike UC-7's quick→full redirect, a Rule 4 condition encountered while a run is already at `full` retains today's unmodified behavior: stop, present to the user, count against the retry budget (FR-2.5). This is not a new behavior this feature adds — it is the explicit statement that `full` is where Rule 4's original stop-and-ask behavior is preserved, not redirected, which is what makes `full` "the tier of default safety" rather than another escalation target.

### Error Flows
None.

### Edge Cases
- **UC-8-EC1: a full-tier plan that legitimately produces exactly 1 slice** — the tracer slice itself resolves the entire scope. This remains structurally different from `quick` tier: the slice still went through `prd-writer`/`ba-analyst`/`architect`/`qa-planner` first, and `/merge-ready` still runs all 9 gates unmodified (never the FR-4.6 reduced subset), even though the slice count happens to match what a `quick`-tier plan would also produce. Slice count alone is never evidence of tier — only the `## Tier:` value set at classification/escalation time is.
- **UC-8-EC2: legacy scratchpad with no `## Tier:` field at all — treated as `full` (NFR-3)** — a scratchpad written before this feature shipped (or by a run that never went through Phase 0 triage) carries no `## Tier:` field. Per NFR-3, every tier-aware check (FR-4.6's gate subset, FR-4.4's Pre-flight Check 4 bypass, and any other tier-aware check this feature adds) treats an absent `## Tier:` identically to `full` — running all 9 gates unmodified, requiring the full documentation-existence Pre-flight Check 4, exactly as before this feature existed. A project's un-upgraded scratchpad is safe to keep operating against after installing this feature's harness code, with no observable behavior change until Phase 0 triage is actually exercised for a new request.

### Data Requirements
- **Input**: none new — this is the negative case
- **Output**: none new
- **Side Effects**: none — the absence of any tier-lowering write to `.claude/scratchpad.md`'s `## Tier:` is itself the observable outcome

---

## UC-9: Explicit Override — `/sdlc-fast` and `/sdlc-quick`

**Actor**: developer (human) — the sanctioned override case named in the Autonomy Audit above, not a triage decision
**Preconditions**: `skills/sdlc-fast/SKILL.md` and `skills/sdlc-quick/SKILL.md` exist
**Trigger**: literal invocation of `/sdlc-fast <description>` or `/sdlc-quick <description>` as an actually-invoked slash command (FR-6.3) — the pipeline's own escape-hatch entry point (NFR-2: "override entry points only — never invoked by the pipeline itself, never required for a run to complete")

### Primary Flow (`/sdlc-fast` Overriding a Would-Be-`full` Verdict)
1. The developer types `/sdlc-fast "add a POST /api/webhooks/stripe endpoint"` — a request that, per UC-2, FR-1.3(a) would otherwise force `full` classification.
2. Per FR-6.2, `/sdlc-fast` bypasses FR-1's classification entirely and runs FR-3 (fast-tier execution) directly against the supplied description — the human asserts the tier; the pipeline does not compute it. No "`tier: full` — FR-1.3(a)" reasoning is produced or considered.
3. `skills/sdlc-fast/SKILL.md`'s `allowed-tools` is `Read, Glob, Grep, Edit, Write, Bash` — no `Agent` tool — structurally enforcing FR-3.1's "no subagent" constraint, not merely by instruction.
4. FR-2's escalation rules still apply once running: if this `/sdlc-fast` invocation's edit turns out to touch a second file, it still escalates to `quick` per UC-6 — the override skips classification, never the safety rails.

**Postconditions**: the request that UC-2 would classify `full` instead runs the fast-tier flow (UC-4) — zero `docs/PRD.md`/`docs/use-cases/*`/`docs/qa/*` files created, one commit, one changelog entry — unless FR-2's escalation triggers mid-run, in which case UC-6/UC-7 apply exactly as they would for any fast-tier run.

### Alternative Flows
- **UC-9-A1: `/sdlc-quick <description>`** — identical mechanism, targeting FR-4 (quick-tier execution, UC-5) directly; `skills/sdlc-quick/SKILL.md`'s `allowed-tools` matches `develop-feature`'s, since it drives `planner`/`implement-slice`/`merge-ready`.

### Error Flows
None — an override cannot itself fail; only the underlying tier's own execution (UC-4/UC-5) can.

### Edge Cases
- **UC-9-EC1: the literal-token rule — provably does not activate from prose (AC-6)** — a request's prose contains a word like "quick," "fast," "small," or "trivial" — e.g. "let's do this quickly: add a POST `/api/webhooks/stripe` endpoint" — but is submitted as ordinary conversational text, NOT as a literal `/sdlc-fast`/`/sdlc-quick` invocation. Per FR-6.3's literal-token flag rule (the same discipline already governing `no-changelog` and every other documented flag in this harness), the pipeline MUST NOT infer the override from vocabulary. This request is classified by FR-1's normal signals — FR-1.3(a) still forces `full` — and the stated reason cites `tier: full — FR-1.3(a), new API endpoint`, never "override requested." **Proof this is mechanically checkable:** a transcript search for the literal token `/sdlc-fast` or `/sdlc-quick` in the invoking message finds nothing; the response's stated tier is `full`, not `fast` — the two facts together are the observable proof the flag did not activate. Additionally, `src/claude.md`'s unprefixed-request path has no skill invocation to check a literal token against at all, so this override is structurally unavailable there (FR-6.3) — an unprefixed request can never reach `/sdlc-fast`/`-quick`'s bypass, regardless of its prose.

### Data Requirements
- **Input**: the literal slash-command token plus its description argument
- **Output**: FR-3 or FR-4's execution (UC-4/UC-5) with zero classification reasoning produced
- **Side Effects**: identical to UC-4/UC-5's own side effects

---

## UC-10: Model Routing — `install.sh --profile` Rewrite

**Actor**: developer (human, install-time — sanctioned per the Autonomy Audit, NFR-1(a) naming `install.sh` directly)
**Preconditions**: a local checkout of the repository (`--local` required — refusal otherwise is UC-12); all 14 `agents/*.md` files present at their current `model:` values
**Trigger**: `bash install.sh --local --profile budget` run from the repository root

### Primary Flow (`--profile budget` Rewrites Exactly 14 `model:` Lines)
1. `install.sh` parses `--profile budget`, confirms `--local` was also passed (else refuses, UC-12), confirms mutual exclusivity with `--uninstall`/`--restore`/`--init-project`.
2. For each of the 14 `agents/*.md` files, `install.sh` rewrites the `model:` frontmatter line to FR-8.1's `budget`-column value for that filename's role, using write-to-temp-then-`mv` (never `sed -i`) (FR-7.2).
3. Per FR-7.4, only the `model:` line changes — `name`, `description`, `tools`, `effort:`, and every prompt-body line remain byte-identical before and after.
4. After all 14 rewrites succeed, `install.sh` writes `.sdlc-model-profile` at the repository root containing exactly one line: `budget` (FR-9.1, FR-9.2 — atomic write via the same temp-file-then-`mv` pattern `write_receipt()` already uses).

**Postconditions (AC-7)**: `git diff --stat` shows exactly 14 files changed, one changed line each; each changed `agents/*.md`'s `model:` line equals FR-8.1's `budget` value for its role (e.g. `architect: sonnet`, `security-auditor: opus`, `build-runner: haiku`); `.sdlc-model-profile` exists and reads exactly `budget`.

### Alternative Flows
- **UC-10-A1: `--profile inherit`** — every agent's `model:` line is rewritten to the literal string `model: inherit` via the identical idiom; the field is never deleted (FR-7.3, AC-13). `node scripts/ci/validate-agents.js`'s existing `REQUIRED_FIELDS` check continues to pass (`model` present and non-empty) rather than failing on a missing field, because `inherit` is already a member of `VALID_MODEL_ALIASES`.
- **UC-10-A2: `effort:` is orthogonal and untouched** — regardless of which profile is applied (`quality`/`balanced`/`budget`/`inherit`), every agent's `effort:` value (FR-11.1/11.2, fixed per role at authoring time) is left byte-identical by the same FR-7.4 "no other field touched" rule, stated by name in FR-11.3: `install.sh --profile` never rewrites `effort:`, because it describes reasoning depth per role, not the cost/quality tradeoff a profile encodes. `verifier` stays `effort: high` (careful, multi-level static analysis) at every profile while never rising above `model: sonnet` under any profile (FR-8.1) — a role can need careful reasoning without needing the largest model. Mechanically checkable: `grep -l "effort: high" agents/*.md` returns the same 5 filenames before and after any `--profile` run (AC-12).
- **UC-10-A3: `--dry-run`** — `install.sh --local --profile budget --dry-run` prints all 14 current/target value pairs and exits 0 with no file modified; `git status` afterward is clean (FR-7.5, AC-8).

### Error Flows
None at this UC's level — refusal paths are UC-12.

### Edge Cases
- **UC-10-EC1: the existing no-node/no-jq CI check continues to pass** — because FR-7.2's rewrite idiom is `sed`/`awk`/shell `case` only, the existing "Assert `install.sh` invokes neither `node` nor `jq`" CI step's grep continues to produce empty output against the modified `install.sh` (AC-11).

### Data Requirements
- **Input**: `--profile <name>`, FR-8.1's table encoded as `install.sh`'s own shell `case` arms
- **Output**: 14 rewritten `agents/*.md` `model:` lines, one `.sdlc-model-profile` file
- **Side Effects**: 14 file writes plus 1 new/overwritten file, all via temp-file-then-`mv`, none via `sed -i`

---

## UC-11: CI Drift Check — Hand-Edited `model:` Fails by Name

**Actor**: CI (`node scripts/ci/validate-model-profile.js`, invoked by `.github/workflows/ci.yml`'s `validate-assets` job)
**Preconditions**: `.sdlc-model-profile` is absent from the tree (never committed at HEAD — a local, install-time artifact)
**Trigger**: `.github/workflows/ci.yml`'s `validate-assets` job runs `node scripts/ci/validate-model-profile.js` — an existing, automatic CI trigger (push/PR), never a manually-run script

### Primary Flow (No Receipt → `quality` Assumed → Fixture (b): a Recognized-But-Unauthorized Alias)
1. `.sdlc-model-profile` is absent from the repository.
2. Per FR-9.3, the validator treats the tree as `quality` when the receipt is absent — valid only because of FR-8.2's equality guarantee (the `quality` column equals the shipped baseline, role for role).
3. A developer hand-edits `agents/architect.md`'s `model:` line to `fable` directly in the repository — the exact class of drift Section 3's original incident recorded, and the mechanism this feature exists to replace with a rewrite-and-verify flow.
4. The validator reads `.sdlc-model-profile` (absent → `quality`), reads `agents/architect.md`'s `model:` value (`fable`), and compares it against the table's `quality:architect` entry (`opus`).
5. `fable != opus` → the validator reports a failure naming the file (`agents/architect.md`), the value found (`fable`), and the value expected (`opus`) (FR-10.2).
6. `node scripts/ci/validate-model-profile.js` exits non-zero.

**Postconditions (AC-9)**: `node scripts/ci/validate-model-profile.js` exits non-zero, and its output names `agents/architect.md`, `fable`, and `opus` explicitly; `node scripts/ci/validate-agents.js` — run separately — continues to exit 0 against the same file, since `fable` remains a recognized alias under that check's own, looser `VALID_MODEL_ALIASES` purpose (a distinct check from this one, per FR-10.2's own framing).

### Alternative Flows
- **UC-11-A1: fixture (a) — profile receipt present, but one file left at its stale `quality` value** — `.sdlc-model-profile` reads `budget`, and 13 of 14 `agents/*.md` files correctly carry their `budget` values, but one (e.g. `agents/build-runner.md`) was never rewritten and still reads its `quality` value (`sonnet` instead of `budget`'s `haiku`). The comparison target shifts to the `budget` column instead of `quality`, and the mechanism and naming discipline (file, found value, expected value) are identical to the primary flow — this is FR-10.4(a)'s specific seeded-bad fixture, exercising the "receipt present but incompletely applied" shape rather than "no receipt at all."

### Error Flows
None — a validator failure IS the intended, correct behavior here; this UC documents the pass/fail contrast, not a validator malfunction.

### Edge Cases
- **UC-11-EC1: `install.sh`/CI table agreement (FR-10.3, FR-10.4(c))** — a hand-edit to `install.sh`'s own case-arm table (e.g. changing the `balanced:plan-critic` arm's `echo` value) that diverges from `scripts/ci/lib/model-profiles.js`'s table — even with every `agents/*.md` file itself correctly matching its declared profile — is caught by a distinct check within the same validator: it parses `install.sh`'s text (never executes it) and asserts the extracted `(profile, role, model)` triples exactly match the JS table, treating a matched `inherit:*)` wildcard as satisfying all 14 `inherit` rows. This fails by name too, not merely by a generic mismatch count.
- **UC-11-EC2: anti-vacuity** — `node scripts/ci/validate-model-profile.js` run against an empty or absent `agents/` tree fails via `requireMinimum`, mirroring every existing validator's anti-vacuity floor (FR-10.4) — it does not silently report success for a tree it never actually scanned. Together with UC-11's primary flow (fixture b), UC-11-A1 (fixture a), and UC-11-EC1 (fixture c), this satisfies AC-10's requirement that the validator "exits 0 against the real repository tree with no `.sdlc-model-profile` present, and exits non-zero against each of FR-10.4's three seeded-bad fixtures, each failing for the specific reason its fixture encodes."

### Data Requirements
- **Input**: `.sdlc-model-profile` (or its absence), all 14 `agents/*.md` files' `model:` values, `install.sh`'s text
- **Output**: PASS/FAIL exit code plus, on failure, the specific file/found/expected triple
- **Side Effects**: none — a read-only CI check

---

## UC-12: `--profile` Without `--local` — Refusal

**Actor**: developer (human, install-time)
**Preconditions**: none
**Trigger**: `bash install.sh --profile budget` (no `--local`) — the existing `install.sh` flag-parsing step in `main()`

### Primary Flow (Missing `--local` → Refuse, Modify Nothing)
1. `install.sh` parses `--profile budget` without `--local` also present.
2. Per FR-7.1, `--profile` REQUIRES `--local`: the rewrite targets `agents/*.md` inside the plugin-source checkout that `/plugin marketplace add <path>` will later point at; a non-`--local` run's source directory is a `mktemp -d` clone `cleanup_source_dir` deletes before the process exits, so a rewrite there would be silently discarded.
3. `install.sh` refuses with a named error stating the `--local` requirement, mirroring the existing mutual-exclusivity checks already present in `main()` (e.g. the `--uninstall`/`--restore`/`--init-project` pattern).
4. Exit code is non-zero; no file is modified.

**Postconditions (AC-7)**: `install.sh --profile budget` without `--local` exits non-zero, its error output names the `--local` requirement, and modifies no file — `git status` (run against a local checkout) shows no changes.

### Alternative Flows
None — this is a single, deterministic refusal path.

### Error Flows
This UC IS the error flow; there is no success path for `--profile` without `--local`.

### Edge Cases
- **UC-12-EC1: `--profile` combined with a genuinely mutually-exclusive flag** — `--profile budget --uninstall` (or `--restore`/`--init-project`) is refused with a distinct, named error for that combination, mirroring `main()`'s existing mutual-exclusivity checks (e.g. the `DO_UNINSTALL && RESTORE_DIR` check already present) — checked independently of, and in addition to, the `--local` requirement.

### Data Requirements
- **Input**: the parsed flag combination
- **Output**: the named refusal message and non-zero exit
- **Side Effects**: none

---

## UC-13: Install With No `--profile` At All — Existing Tiers Unchanged

**Actor**: developer (human, install-time) — the ordinary, pre-existing `install.sh` invocation; this feature adds no new manual step here at all
**Preconditions**: a repository whose `agents/*.md` files carry their shipped, current `model:` values (the `quality` baseline, per FR-8.2)
**Trigger**: `bash install.sh` (any combination of flags that does NOT include `--profile`) — the ordinary, pre-existing install invocation, unmodified by this feature

### Primary Flow (No `--profile` Flag → No Rewrite, No Receipt)
1. The developer runs `bash install.sh` (memory-layer install, no `--profile`).
2. `install.sh`'s existing `install_user_config()` flow runs exactly as it does today — copying `claude.md` and `rules/*.md` into `~/.claude` — untouched by this feature (FR-7's rewrite logic activates only under the `--profile` flag).
3. No `agents/*.md` file is touched — this script does not install `agents/*.md` into `~/.claude` at all; that is the plugin's job, per `install.sh`'s own header comment ("agents and skills do NOT come from here").
4. No `.sdlc-model-profile` is written.

**Postconditions (NFR-3)**: `install.sh`'s behavior is identical to before this feature shipped for a `--profile`-less run; the repository's own `agents/*.md` files (wherever installed from — the plugin) remain at whatever `model:` values they already carried; `scripts/ci/validate-model-profile.js`, run afterward against this tree, treats the absent `.sdlc-model-profile` as `quality` per FR-9.3 — valid without any observable change having occurred (FR-8.2's equality guarantee is what makes "absent" and "`quality`" indistinguishable outcomes).

### Alternative Flows
- **UC-13-A1: `bash install.sh --local` (no `--profile`)** — identical outcome; `--local` alone changes only where the source files are read from (local checkout vs. a fresh clone), never whether the profile-rewrite logic runs.

### Error Flows
None.

### Edge Cases
- **UC-13-EC1: `.sdlc-model-profile` already exists from a PRIOR `--profile` run, and `install.sh` is re-run WITHOUT `--profile`** — the receipt file is left untouched (FR-7's rewrite logic, and by extension any receipt write, activates only under the `--profile` flag; a `--profile`-less run has no code path that touches `.sdlc-model-profile` at all) — the previously-applied profile remains in effect and is still what UC-14 reads.

### Data Requirements
- **Input**: none (the absence of the flag is itself the input)
- **Output**: none
- **Side Effects**: none to `agents/*.md` or `.sdlc-model-profile`

---

## UC-14: Install Receipt — Recording and Reading the Applied Profile

**Actor**: `install.sh` (writer); `scripts/ci/validate-model-profile.js` (reader)
**Preconditions**: `install.sh --local --profile <name>` has completed all 14 rewrites successfully
**Trigger**: (write side) the final step of a successful `--profile` install run — only after all 14 rewrites succeed (FR-9.2); (read side) every invocation of `scripts/ci/validate-model-profile.js` — an existing, automatic CI trigger

### Primary Flow (Successful Install Writes the Receipt; CI Reads It to Choose the Comparison Column)
1. `install.sh --local --profile balanced` runs; all 14 `agents/*.md` rewrites succeed (UC-10).
2. `install.sh` writes `.sdlc-model-profile` via the same temp-file-then-`mv` pattern `write_receipt()` already uses for `.sdlc-receipt` — atomic: an interrupted or partially-failed rewrite must not leave a receipt claiming a profile that was not fully applied (FR-9.2).
3. The file contains exactly one line: `balanced`.
4. Later, CI runs `node scripts/ci/validate-model-profile.js`. The validator reads `.sdlc-model-profile`, resolves it to `balanced`, and checks every `agents/*.md` file's `model:` value against the table's `balanced` column for that role (FR-10.2) — not `quality`, since the receipt is present and names a different profile.

**Postconditions**: `.sdlc-model-profile` exists at the repository root, containing exactly the string `balanced` (no trailing content beyond the newline); `scripts/ci/validate-model-profile.js`'s comparison target for every file is the `balanced` column, verifiable by seeding a single `balanced`-appropriate value that would fail against `quality` but pass against `balanced`.

### Alternative Flows
- **UC-14-A1: an interrupted rewrite** — the process is killed after 8 of 14 files are rewritten. Per FR-9.2, `.sdlc-model-profile` is written ONLY after all 14 rewrites succeed; an interrupted run therefore leaves NO receipt (or leaves a prior receipt, if one existed, untouched) rather than a receipt claiming a profile 6 files never actually received. A subsequent validator run against this half-rewritten tree either reads no receipt (falls back to `quality`, FR-9.3) or reads a stale prior receipt — in both cases the comparison correctly reports the un-rewritten files as drifted, rather than the receipt lying about what was applied.

### Error Flows
None beyond UC-11's drift-detection outcome, which is this UC's natural downstream consequence when the receipt and the files disagree.

### Edge Cases
- **UC-14-EC1: a hand-edited `.sdlc-model-profile` containing a value outside `{quality, balanced, budget, inherit}`** — e.g. a typo, `fable`. The validator's table lookup for `<malformed-value>:<role>` finds no matching column; this is a malformed-receipt condition the validator must report by name (naming the bad receipt value itself), distinct from a per-file `model:` drift, since here the receipt itself — not any agent file — is the thing that failed validation. (This is the harness's install-receipt analogue of the verification-review-upgrade feature's "no `verdict:` frontmatter" handling: an unreadable control file is reported as its own failure, never silently defaulted past.)

### Data Requirements
- **Input**: the 14 post-rewrite `model:` values, the receipt's one-line content
- **Output**: PASS/FAIL naming file/found/expected (UC-11)
- **Side Effects**: one file write (`install.sh` side), zero (CI validator side — read-only)

---

## UC-15: Digest Index — Bounded Prior-Feature Context for `planner`

**Actor**: `planner` (read-only — no `Write`/`Edit` tool, AC-22); orchestrator (`/bootstrap-feature` Step 5, supplying the current feature's section number/title, FR-12.5)
**Preconditions**: `docs/digest-index.md` exists with 5+ rows, one per previously-finalized full-tier feature
**Trigger**: `/bootstrap-feature` Step 5's existing delegation to `planner` — now stating the current feature's PRD section number and title explicitly (FR-12.5), since `planner` no longer discovers it by reading the whole PRD file

### Primary Flow (Scoped Current-Feature Read + Bounded 2–4-Row Prior Read)
1. A new, full-tier feature (e.g. a hypothetical Section 11) is being planned. `docs/digest-index.md` already holds 9 rows (Sections 1–9, minus any that never reached Gate 7).
2. Per FR-12.3, `planner`'s Process step 1 reads ONLY the current feature's own PRD section (identified by the number/title `/bootstrap-feature`'s Step 5 delegation supplied), its own `docs/use-cases/<feature>_use_cases.md`, architecture review output, and `docs/qa/<feature>_test_cases.md` — all in full, exactly as much as before this feature shipped, but scoped rather than reading all of `docs/PRD.md`.
3. Per FR-12.4, immediately after, `planner` reads `docs/digest-index.md` in full (9 rows) and selects between 2 and 4 rows most relevant to the current feature, by keyword/topic overlap with the current request.
4. `planner` reads only those 2–4 selected rows' referenced documents (their own PRD section — not the whole `docs/PRD.md` — plus their `docs/use-cases/*`) in full.
5. `planner` produces the plan, informed by the current feature's full documentation plus 2–4 prior features' full documentation — never all 9.

**Postconditions (AC-14)**: a transcript/tool-call audit of this `planner` invocation shows: one Read of the current section's boundaries within `docs/PRD.md` only (not the whole file); one Read of `docs/digest-index.md` in full; between 2 and 4 Reads of prior sections'/use-cases' full content; zero Reads of the remaining 5–7 prior sections' full content.

### Alternative Flows
None distinct — every full-tier `planner` invocation after this feature ships follows this same bounded pattern; there is no unbounded variant left to alternate to.

### Error Flows
None.

### Edge Cases
- **UC-15-EC1: first feature in a fresh project — no digest yet (AC-15)** — a project has just been scaffolded (`bash install.sh --init-project`) and is planning its very first full-tier feature. `docs/digest-index.md` is absent entirely — FR-12.1 states it is a new file, and FR-12.2 only ever appends/refreshes it starting at Gate 7 of the FIRST full-tier feature, which has not happened yet. Per FR-12.4's explicit fallback, "when fewer than 2 relevant rows exist — including an early-stage project where the index is empty or absent — `planner` reads however many are actually relevant (0 or 1) and proceeds without inventing relevance to reach 2." `planner`'s Process step 1 (FR-12.3, current-feature docs) is unconditional and proceeds normally; FR-12.4's prior-feature-context step simply has nothing to read and does not stall, retry, or fabricate a digest entry to satisfy a 2-row minimum.
- **UC-15-EC2: a digest gone stale relative to the docs it summarizes** — `docs/digest-index.md`'s row for Section 4 was written when Section 4 shipped, and Section 4's use-cases file has since been hand-edited without a corresponding Gate 7 run to refresh that row's Summary (≤300 characters). `planner`'s keyword/topic-overlap selection (FR-12.4) operates against the (now-stale) Summary text — a summary that no longer reflects the section's current content could cause `planner` to under-select (miss a now-more-relevant row because its stale summary doesn't mention the new content) or over-select (pick a row whose stale summary looked relevant but whose actual current content is not) that row as one of its 2–4. **What does NOT happen:** once a row IS selected, `planner`'s own read of "that row's referenced documents... in full" (FR-12.4) reads the CURRENT file content on disk, not the stale summary — the summary can only mislead which rows get chosen, never what content is read once chosen, since the digest is an index into full documents, not a cache replacing them. This is a documented consequence of FR-12.2's idempotency-guarded refresh being keyed to Gate 7 completions specifically — a hand-edit to a shipped feature's use-cases file outside that trigger point does not itself refresh the index row, and this feature adds no separate staleness check.

### Data Requirements
- **Input**: `docs/PRD.md`'s current section (scoped); `docs/digest-index.md` (bounded, 2–4-row selection)
- **Output**: the implementation plan, now informed by bounded context
- **Side Effects**: none from `planner` itself (read-only, AC-22) — `docs/digest-index.md`'s own write happens only at Gate 7 (UC-16, not exercised by `planner`'s read)

---

## UC-16: Digest Index Write — Gate 7 Appends or Refreshes

**Actor**: `doc-updater`, delegated by `/merge-ready` Gate 7 — an existing pipeline point (Gate 7: Documentation Accuracy), gaining one more duty for full-tier runs only
**Preconditions**: a full-tier feature has reached Gate 7 with a PASS verdict; `docs/PRD.md`'s section for this feature, `docs/use-cases/<slug>_use_cases.md`, and `docs/qa/<slug>_test_cases.md` all exist
**Trigger**: `/merge-ready` Gate 7's existing delegation to `doc-updater`, for full-tier runs only (FR-12.2)

### Primary Flow (First-Time Append for a New Full-Tier Feature)
1. A full-tier feature (Section 11) completes Gate 7 with PASS.
2. Per FR-12.2, `doc-updater`'s existing Gate 7 duties gain one more: append a row to `docs/digest-index.md` — `| Section | Title | Summary (≤300 characters) | Docs |` — with `Docs` listing the PRD section anchor, `docs/use-cases/<slug>_use_cases.md`, and `docs/qa/<slug>_test_cases.md`.
3. Since no row for Section 11 exists yet, this is an append, not a refresh.

**Postconditions (AC-16, first clause)**: `docs/digest-index.md` gains exactly one new row for Section 11.

### Alternative Flows
- **UC-16-A1: re-running Gate 7 for the same feature** — a row for Section 11 already exists (e.g., Gate 7 is being re-run after a fix). `doc-updater` refreshes that row in place — using the same idempotency discipline `src/rules/changelog.md`'s guard already establishes, keyed here on section number instead of entry name — rather than duplicating it (AC-16, second clause).

### Error Flows
None beyond `doc-updater`'s existing Gate 7 failure handling, unchanged by this feature.

### Edge Cases
- **UC-16-EC1: quick-tier completion produces no row (AC-16, third clause)** — a quick-tier feature's `/merge-ready` run reports Gate 7 as `SKIPPED (tier: quick)` per FR-4.6 — Gate 7 never runs, so `doc-updater` is never delegated to for a digest write, and no row is produced (FR-12.6). This is the direct consequence of FR-4.6's gate subset, not a separate suppression rule this feature adds.
- **UC-16-EC2: fast tier never reaches Gate 7 at all** — fast tier has no `/merge-ready` run whatsoever (FR-3.4's note: "no `/merge-ready` run occurs for fast tier") — Gate 7 is not merely `SKIPPED`, it never executes as part of this request's flow, so a digest row is impossible by construction for a fast-tier change, consistent with quick tier's outcome but for a stronger structural reason.

### Data Requirements
- **Input**: the feature's finalized PRD section, use-cases, QA docs
- **Output**: one appended or refreshed `docs/digest-index.md` row
- **Side Effects**: one file write to `docs/digest-index.md`, scoped to Gate 7 of full-tier runs only

---

## UC-17: Statusline — Full Field Rendering

**Actor**: Claude Code's own native statusline renderer (invoked automatically after configuration — not a hook, not dispatched by `hooks/lib/run-hook.js`); `templates/statusline.js` (copied to `.claude/statusline.js` by `install.sh --init-project`)
**Preconditions**: `.claude/settings.json`'s `statusLine` field is configured (`{"type": "command", "command": "node .claude/statusline.js"}`, FR-13.2); a live session has an active full-tier run at wave 2 of 3, slice 1 of 2; `/merge-ready` has completed 4 of 9 gates
**Trigger**: Claude Code's own statusline mechanism invoking `.claude/statusline.js` with its native stdin JSON, after a response — an existing, automatic Claude Code system point, never a hook and never a manually-run script (NFR-4's fourth Node-execution context)

### Primary Flow (All Five Segments, In Order, Matching Live State)
1. Claude Code invokes `node .claude/statusline.js`, piping its native stdin JSON (cost, token-usage fields — exact names pinned by FR-13.4's mandatory spike, recorded in the handler's own header comment).
2. The script reads `.claude/scratchpad.md`: `## Feature:` names the active feature; `## Plan` shows Wave 2, Slice 1 of 2 IN PROGRESS; a `Gates: 4/9` line (written by `/merge-ready` after each gate reaches a terminal state, mirroring the `Gate 6 attempts: N/3` precedent).
3. The script renders all five FR-13.3 segments, in exact order: `<feature> | wave <W> slice <N>/<M> | gates <G>/9 | $<cost> | <usable-context bar>`.
4. The usable-context bar computes `(max_tokens − autocompact_reserve − used_tokens) / (max_tokens − autocompact_reserve)`, floored at 0% — subtracting the autocompact reserve from BOTH the numerator and the denominator, not merely the numerator, so the bar reads 100% only when zero of the genuinely usable budget (excluding the reserve Claude Code itself will not let the context exceed) has been consumed.

**Postconditions (AC-17)**: the rendered line contains `wave 2 slice 1/2` and `gates 4/9`, matching the scratchpad's actual state, plus the feature name, cost, and usable-context bar — all five segments present, in FR-13.3's exact order.

### Alternative Flows
- **UC-17-A1: no active feature, no in-progress `/merge-ready` run (AC-18)** — the status line omits the wave/slice and gates segments entirely — never rendered as a degenerate `0/0` — while still rendering cost and usable-context. This also covers the fast-tier case: wave/slice is omitted entirely when `## Tier: fast` (FR-13.3), since fast tier has no wave/slice concept at all.
- **UC-17-A2: every slice DONE** — identical omission rule — wave/slice is omitted once every slice in the plan is DONE, not rendered as a stale "wave 3 slice 2/2" after the fact.

### Error Flows
None at this UC's level — malformed-input handling is UC-18's fail-open contract.

### Edge Cases
- **UC-17-EC1: the mandatory pre-implementation spike (FR-13.4)** — before this rendering logic can be finalized at all, the implementation MUST invoke a real Claude Code session with the statusline configured, capture the actual stdin JSON, and record the exact field names for cost and context-window usage — including whether an autocompact-reserve value is exposed directly or must be approximated by a documented constant — in the handler's own header comment. A rendering implementation that skips this spike and assumes field names is not a valid implementation of FR-13.3, regardless of whether it happens to work against one tester's session.

### Data Requirements
- **Input**: the statusline's native stdin JSON (cost, token-usage fields); `.claude/scratchpad.md`'s `## Feature:`, `## Plan`, and `Gates: N/9` line
- **Output**: one rendered status-line string
- **Side Effects**: none — a pure read-and-render, no file written

---

## UC-18: Statusline Absent or Malfunctioning — Visible Degradation, No Silent Dependency

**Actor**: `templates/statusline.js` (fail-open boundary); every other capability in this feature (triage, escalation, model routing, digest index) — explicitly NOT dependent on the statusline's output (FR-13.6)
**Preconditions**: (scenario A) `.claude/settings.json` has no `statusLine` field configured at all; (scenario B) `statusLine` IS configured, but `.claude/scratchpad.md` is corrupted (unparseable `## Plan`)
**Trigger (A)**: Claude Code's own native behavior when `statusLine` is unconfigured — no status line renders at all, a fact this feature does not add any pipeline-side check for, since nothing yet depends on it (FR-13.6). **Trigger (B)**: the same automatic per-response statusline invocation as UC-17, now hitting a malformed scratchpad

### Primary Flow (Scenario A — `statusLine` Never Configured, or Removed)
1. A developer removes `.claude/settings.json`'s `statusLine` field (or never configured it — the `templates/settings.json` default from FR-13.2 was reverted, or the project predates this feature).
2. No status line renders in the session — this is Claude Code's own native, unmodified behavior for an unconfigured `statusLine`, not a defect this feature introduces or must handle specially.
3. Every other capability this feature ships — triage (FR-1), escalation (FR-2), fast/quick/full execution (FR-3/4/5), overrides (FR-6), model routing (FR-7–10), the digest index (FR-12) — continues to function identically, because none of them read the statusline's output back into the pipeline (FR-13.6). Risk 8's "hook stdin does not carry context-window usage, only the statusline JSON does" is the reason no other mechanism in this harness could silently depend on it even if it wanted to: the data literally is not delivered anywhere else.

**Postconditions (AC-20)**: removing `statusLine` results in no status line rendering, and no other capability in this section fails, degrades in behavior, or produces different output as a result — a direct comparison of triage/escalation/model-routing/digest-index behavior with and without `statusLine` configured shows zero difference.

### Alternative Flows
- **UC-18-A1 (Scenario B — configured but scratchpad corrupted, AC-19)**: `.claude/scratchpad.md`'s `## Plan` section is corrupted (e.g. truncated mid-edit, unparseable) while `statusLine` IS configured. Per FR-13.5, `templates/statusline.js`'s entire body is wrapped in a top-level error boundary. On this error — a missing or unparseable scratchpad — it does NOT throw, print nothing, or crash the renderer. It still prints a minimal, non-empty status line containing at least the cost and usable-context segments it can still derive from its own stdin (which never depended on the scratchpad) — the wave/slice and gates segments are simply omitted, exactly as UC-17-A1's normal omission case, but now triggered by corruption rather than by a legitimately-absent feature. Postcondition: a deliberately corrupted scratchpad does not crash the statusline or blank it — cost and usable-context still render; the failure is visible (a minimal-but-present line, distinguishable from a fully-populated one) rather than silent (no crash, no blank, no stale cached value).

### Error Flows
None beyond the two scenarios above — this UC's whole content IS the error/degradation handling; there is no further failure mode to describe beneath it.

### Edge Cases
- **UC-18-EC1: the framing risk this whole UC exists to close, stated explicitly** — Roadmap Risk 8 records that hook stdin does not carry context-window usage — only the statusline's own JSON does, delivered to a mechanism separate from `hooks/lib/run-hook.js` entirely. This feature deliberately declines to build a side-channel smuggling that data into the hook system (explicitly not copying GSD's `/tmp` side-channel pattern). The consequence, stated plainly rather than left implicit: no hook, guard, or agent in this harness can ever become silently dependent on statusline data, because none of them receive it through any channel this feature creates — "the statusline is not running" therefore degrades visibly (nothing renders) rather than silently (some other capability quietly malfunctioning because a value it expected never arrived), by construction rather than by a runtime check.

### Data Requirements
- **Input**: (A) none — the absence of configuration itself; (B) the statusline's own stdin JSON, present, plus a corrupted scratchpad
- **Output**: (A) no status line at all, no other observable change; (B) a minimal, non-empty status line
- **Side Effects**: none in either scenario

---

## Traceability

Every UC (including its alternative/error/edge sub-flows) maps to at least one FR from PRD Section 10. This confirms FR-1 through FR-13 are each covered by at least one use case — no FR is left with only thin, invented coverage.

| UC | Title | FR(s) Covered |
|---|---|---|
| UC-1 (+A1, A2, EC1) | Fast-Tier Classification — Single-File Copy Edit | FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.8 |
| UC-2 (+A1–A3, EC1) | Full-Tier Classification — New API Endpoint | FR-1.2, FR-1.3, FR-1.7, FR-1.8, FR-5.1 |
| UC-3 (+A1, EC1) | Genuinely Ambiguous Classification — the Tie-Break Rule | FR-1.2, FR-1.5, FR-1.6, FR-1.8 |
| UC-4 (+E1, EC1) | Fast-Tier Execution | FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5 |
| UC-5 (+A1, E1, EC1) | Quick-Tier Execution | FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6, FR-4.7 |
| UC-6 (+A1, EC1) | Fast → Quick Escalation | FR-2.1, FR-2.3, FR-2.7 |
| UC-7 (+E1, EC1) | Quick → Full Escalation | FR-2.2, FR-2.4 |
| UC-8 (+A1, EC1, EC2) | Full Feature That Turns Out Simple — No Downgrade | FR-2.5, FR-2.6, NFR-3 |
| UC-9 (+A1, EC1) | Explicit Override — `/sdlc-fast`, `/sdlc-quick` | FR-6.1, FR-6.2, FR-6.3, NFR-2 |
| UC-10 (+A1–A3, EC1) | Model Routing — `install.sh --profile` Rewrite | FR-7.1, FR-7.2, FR-7.3, FR-7.4, FR-7.5, FR-8.1, FR-8.2, FR-11.1, FR-11.2, FR-11.3, NFR-4, NFR-6 |
| UC-11 (+A1, EC1, EC2) | CI Drift Check | FR-10.1, FR-10.2, FR-10.4 |
| UC-12 (+EC1) | `--profile` Without `--local` — Refusal | FR-7.1 |
| UC-13 (+A1, EC1) | Install With No `--profile` At All | FR-9.3, NFR-3 |
| UC-14 (+A1, EC1) | Install Receipt — Recording and Reading | FR-9.1, FR-9.2, FR-10.2, FR-10.3 |
| UC-15 (+EC1, EC2) | Digest Index — Bounded Read | FR-12.3, FR-12.4, FR-12.5 |
| UC-16 (+A1, EC1, EC2) | Digest Index Write — Gate 7 | FR-12.1, FR-12.2, FR-12.6 |
| UC-17 (+A1, A2, EC1) | Statusline — Full Field Rendering | FR-13.1, FR-13.2, FR-13.3, FR-13.4 |
| UC-18 (+A1, EC1) | Statusline Absent/Malfunctioning — Visible Degradation | FR-13.5, FR-13.6, FR-13.7 |

**FR coverage check**: FR-1 (UC-1, UC-2, UC-3), FR-2 (UC-6, UC-7, UC-8), FR-3 (UC-4), FR-4 (UC-5), FR-5 (UC-2, UC-8), FR-6 (UC-9), FR-7 (UC-10, UC-12, UC-13), FR-8 (UC-10), FR-9 (UC-13, UC-14), FR-10 (UC-11, UC-14), FR-11 (UC-10-A2), FR-12 (UC-15, UC-16), FR-13 (UC-17, UC-18) — every FR-1 through FR-13 has at least one covering use case.

**Structural requirements with no independent runtime behavior beyond what the UCs above already exercise, noted here rather than given invented scenario coverage:** FR-6.4 (skill count 5→7) and NFR-5 (asset budget: agents remain 14, skills 5→7, hooks remain 9 ids/10 registrations) are file-count facts verified directly against the repository tree (`ls agents/*.md | wc -l`, `ls skills/*/SKILL.md | wc -l`, `ls hooks/handlers/*.js | wc -l`, per AC-21) — a `planner`/`code-reviewer` invocation happening at all under the new skills requires the skill files to exist and be counted correctly, which UC-9's primary flow already exercises structurally. FR-13.7 (statusline consumes zero hook-budget slots) is likewise a structural fact about `hooks/hooks.json` registration counts, not a behavior UC-17/UC-18 could exercise differently. FR-10.5 (CI wiring — the `validate-assets` job invoking the new validator plus its `--expect-failure` steps) is the mechanism BY WHICH UC-11's scenarios run in CI, not a separate behavior of its own.

**NFR coverage note:** NFR-1 (autonomy contract) is addressed once, globally, in the Autonomy Audit paragraph above rather than per-UC, per this document's own stated methodology. NFR-2 (no new mandatory pipeline stage) is UC-9's central point — `/sdlc-fast`/`/sdlc-quick` are named the sole exception. NFR-3 (backward compatibility) is UC-8-EC2 and UC-13. NFR-4 (Node zones) is exercised by UC-10-EC1 (install.sh stays no-node/no-jq), UC-11 (the CI zone), and UC-17/UC-18 (the statusline as the fourth, independent zone). NFR-6 (`effort:` fixed, not profile-dependent) is UC-10-A2.

