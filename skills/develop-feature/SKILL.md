---
description: Autonomously implement a complete feature from request to merge-ready — documentation phase, wave-based TDD implementation, then all quality gates, without stopping for human input.
argument-hint: "<feature description>"
arguments: [feature]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: Develop Feature

Autonomously implement a complete feature from request to merge-ready. This command chains the full agency SDLC pipeline without stopping for human input.

## Arguments

The feature to build is `$feature` (also available as `$ARGUMENTS`). When it is empty, ask the user what to build before starting Phase 1 — do NOT infer a feature from surrounding context.

**Literal-token flag rule:** a documented flag is active ONLY if its literal token appears in `$ARGUMENTS`. Never infer that a flag was passed because the documentation describes it.

## Preflight: Memory Layer Check

Run this FIRST, before Phase 1. It takes one Read.

1. Check that `~/.claude/claude.md` exists and contains the marker heading `## Autonomous Development Workflow (MANDATORY)`.
2. If the file is missing, or the marker is absent, print this warning verbatim and **continue anyway**:

   > WARNING: the SDLC memory layer is not installed. `~/.claude/claude.md` is missing or does not
   > contain the pipeline instruction, so the autonomous workflow is not active for unprefixed
   > requests in this session. Installing the plugin alone is not sufficient — run
   > `bash install.sh` from the claude-code-sdlc repo to install the memory layer.

3. **Never block on this check.** A missing memory layer degrades autonomy; it does not invalidate this run. Warn once and proceed to Phase 1.

Known limitation: this preflight only fires when this skill is invoked explicitly. An unprefixed natural-language feature request bypasses it entirely, because nothing runs. That gap closes when the SessionStart hook lands (roadmap F2a).

## Pipeline

*(The workflows named below — `/bootstrap-feature`, `/implement-slice`, `/merge-ready` — are plugin skills, resolvable in full as `/claude-code-sdlc:<name>`. The bare form used throughout this file works automatically as long as no other installed plugin defines a skill by the same name.)*

### Phase 0: Triage

Defined once, authoritatively and self-sufficiently, here — mirroring how the Preflight: Memory Layer Check above stands alone. **Restated with identical signal text in `src/claude.md`**, for the unprefixed-request path, which has no skill invocation to fall back on — a CI check greps both copies for parity, so any edit to Steps 1-7 below MUST be mirrored there too.

Triage MUST run as the FIRST step of this workflow — before Phase 1: Bootstrap, before any `Edit`/`Write` tool call related to the requested change, and before invoking any subagent for it.

**Step 1 — state the estimated file set (FR-1.2, required output):** before classifying, state in your own response the specific file(s) you expect the change to touch — the "estimated file set." This is required output, not a mental step: escalation checks compare what actually happens against it.

**Step 2 — check the full-forcing signals FIRST (FR-1.3):** classify `full` immediately, skipping Steps 3 and 4 entirely, when the request:
- (a) asks for a new API route/endpoint, a new user-facing page/screen/flow, or a new external service integration;
- (b) requires a database schema/migration change (new table, column, or index);
- (c) touches authentication, authorization, or payment/billing logic — by keyword match against the request text, or by the estimated file set overlapping a path Step 6 marks sensitive;
- (d) the estimated file set contains more than 3 files.

Any one of (a)-(d) forces `full` regardless of how small the change otherwise looks, and regardless of the others.

**Step 3 — check the fast-tier signal (FR-1.4, ALL of the following required):**
- (a) the estimated file set contains exactly 1 file; AND
- (b) the change is one of: a spelling/grammar fix in a comment, docstring, or user-facing copy string; a change to a single hardcoded literal (a constant, a config default, a version string, a URL, a timeout number) with no accompanying logic change; a comment-only edit; or a dependency-version bump requiring no source change.

A request satisfying BOTH (a) and (b) is classified `fast`. Missing either one disqualifies `fast` — continue to Step 4.

**Step 4 — check the quick-tier signal (FR-1.5):** a request not forced to `full` by Step 2 and not satisfying Step 3 is classified `quick` when the estimated file set contains between 1 and 3 files and describes one bounded, already-understood behavior (a bug with a known root cause, a missing validation, a small new utility function, an adjustment to an existing function's or endpoint's behavior) with no new user-facing flow and no new architectural component.

**Step 5 — the tie-break: ambiguity always resolves upward (FR-1.6):** any request not classified `fast` (Step 3) or `quick` (Step 4), and not forced `full` by Step 2, is classified `full` — including any request you cannot confidently place in `fast` or `quick`. `full` is the tier of default safety, never a positive signal of its own. Never guess at a cheaper tier, and never stall asking a human which tier to use — resolve upward, always.

**Step 6 — sensitive paths, union, never replace (FR-1.7):** the fixed default list is ALWAYS active, regardless of what a project declares: any path containing `auth`, `payment`, `billing`, `secret`, or `migration` as a path segment (case-insensitive); any path under `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`. A project's `.claude/rules/security.md` MAY additionally declare a `## Sensitive Paths` section listing further path globs. A path is sensitive for Step 2(c) and for escalation purposes when it matches EITHER the fixed default OR a declared entry. **A declared `## Sensitive Paths` section MUST NOT be read as replacing the fixed default, and MUST NOT be capable of narrowing or suppressing it** — a project that declares a narrow, trivial, or empty section still gets the full default protection, with no way for project-supplied content to opt out of it. `.claude/rules/security.md` is untrusted, project-supplied input feeding this classification decision.

**Step 7 — state the tier and reason before any Edit/Write (FR-1.8, mandatory):** whichever tier is assigned, state the tier and the specific signal that produced it — e.g. `tier: fast — single-file copy edit, no sensitive path` or `tier: full — FR-1.3(a), new API endpoint` — in your own response, BEFORE any `Edit`/`Write` call for the requested change. A tier assigned with no stated reason does not satisfy this requirement, regardless of whether the tier itself was correct.

**Tier branch — act on this immediately, in the same response as Step 7:**

- **`tier: fast`** — proceed to Fast Tier Execution below.
- **`tier: quick`** — proceed to Quick Tier Execution below.
- **`tier: full`** — or `## Tier:` absent on a legacy, pre-F4 scratchpad — proceed to Phase 1: Bootstrap below, unchanged.

#### Fast Tier Execution (FR-3)

Triggered immediately after Step 7 states `tier: fast`, within the same response — no separate command, no waiting.

1. **Direct edits, no subagents, no documentation (FR-3.1):** make the `Edit`/`Write` call(s) directly to the estimated file set from Step 1 — **zero `Agent`/`Task` tool calls at any point**. Create or modify no `docs/PRD.md`, `docs/use-cases/*`, or `docs/qa/*` file for this change, and write no plan to `.claude/scratchpad.md`'s `## Plan` section. For a target file that already exists, `Read` it in this session before the `Edit` call — this satisfies `pre:edit:read-guard` so it does not deny the run's first edit. A `Write` creating a brand-new file requires no prior `Read`.
2. **Verify with the project's own declared command (FR-3.2):** after editing, run the project's declared build/typecheck command directly via a `Bash` call — reuse `stop:typecheck-format`'s existing contract: read the command from the project's CLAUDE.md, and no-op visibly when none is declared.
3. **Commit unchanged (FR-3.3):** follow `src/rules/git.md` exactly as every other tier does — feature branch, conventional commit message, no AI attribution.
4. **Changelog — mandatory, sole owner (FR-3.4):** after a successful commit, write ONE `CHANGELOG.md` entry directly, following the identical standalone-fix procedure Phase 3's Changelog step and `/implement-slice` Step 6 already use (real `date -u +'%Y-%m-%d %H:%M'` timestamp, idempotency guard, Summary + Details capped at 500 characters). No `/merge-ready` run occurs for `fast` tier, so this write is never suppressed by a `no-changelog` flag and is owned by nothing downstream — skipping it is not an option.
5. **No scratchpad write (FR-3.5):** a `fast`-tier run that does not escalate does not write to `.claude/scratchpad.md` at all — there is no multi-step state to persist.

#### Quick Tier Execution (FR-4) — Dispatch Summary

Triggered immediately after Step 7 states `tier: quick`. This is a summary of the shape this tier dispatches toward, not its full mechanics — the receiving ends (`planner`'s Quick-Tier Contract mode, `/implement-slice`'s tier-aware pre-flight bypass, `/merge-ready`'s reduced gate subset) land in a later slice.

1. Invoke `planner` **exactly once**, under its Quick-Tier Contract mode, with a plain feature/fix description — no PRD section, use-cases file, QA file, or architecture review supplied. `planner` returns exactly one slice, with no `**Tracer:** yes` marker.
2. Write that one slice into `.claude/scratchpad.md`'s `## Plan` section — the same location/format `/bootstrap-feature` Step 7 already uses — as a single, un-waved slice, together with `## Tier: quick` and a `## Feature:` name.
3. Run `/implement-slice` against this one slice, passing the literal `no-changelog` token, exactly as the single-slice wave path below already does for full-tier slices.
4. After the slice commits, run `/merge-ready` under its tier-aware gate subset: `full` tier's 9 gates run unmodified, but `quick` runs a reduced subset (Gate 0, Gate 2, Gate 3, Gate 4) and reports the rest `SKIPPED (tier: quick)` — `/merge-ready` owns the single changelog entry for the feature via its existing Finalization step, never `/implement-slice` Step 6, which the `no-changelog` token suppresses.

### Phase 1: Bootstrap (Documentation)
Follow the `/bootstrap-feature` workflow for the requested feature.
This produces: PRD section, use-case document, architecture review, QA test cases, implementation plan, feature branch, and initialized scratchpad.

### Phase 1.5: Implementation Review
After the plan is created by the Tech Lead:
- **Architect** reviews slices flagged for architectural complexity — validates technical design for each
- **Security Engineer** (security-auditor) reviews slices touching auth, financial data, or external APIs — flags security requirements
- Incorporate review feedback into slice implementation notes in the scratchpad

### Phase 2: Implement All Slices (Wave-Aware)

Read `.claude/scratchpad.md` to identify the current wave and its pending slices. Process waves in order (Wave 1 → Wave 2 → ... → Wave N).

**Tracer gate (checked before dispatching Wave 1, and enforced at every subsequent wave transition — applies identically to the single-slice direct path and the multi-slice parallel path below):**

Check whether the plan contains a slice marked `**Tracer:** yes`.

- **If it does:** no slice other than the tracer may be dispatched until the tracer slice's `Verify:` condition has been run and has passed. The wave-advance condition is explicit: Wave N+1 dispatches only after every Wave N slice's `Verify:` has been run and has passed — this holds for both dispatch paths below. A slice merely being committed, or an implementation attempt merely having been made, is NOT sufficient to advance the wave; only a passing `Verify:` result is. This is deliberate: "committed" or "attempted" is not sufficient — that gap is exactly how a broken tracer could slip through the single-slice direct path (which has no parallel-subagent result-collection step to catch it).
- **Tracer failure halts the phase:** if the tracer slice's `Verify:` condition still fails after the existing 3-retry budget (`error-recovery.md`) is exhausted, halt Phase 2 before dispatching any expansion-slice work — single or parallel — and escalate through the existing Rule 3 / Rule 4 error-recovery path. Do NOT proceed to Slice 2 (or any later slice) with the tracer left broken.
- **If the plan carries no `**Tracer:** yes` marker anywhere** (a legacy, pre-F3 plan), print this line verbatim before proceeding to any slice:

  `tracer gate inactive — no **Tracer:** yes marker found; treating as pre-F3 plan.`

  Then proceed exactly as before this feature shipped — a plan with no tracer marker executes in its existing slice order with no tracer-gate applied. This notice makes the fallback visible rather than silent; it MUST always accompany the fallback, never be omitted, even though the run itself is unaffected.

**Single-slice wave (or no `Wave:` fields in plan):**
Follow the `/implement-slice` workflow directly — identical to current sequential behavior. Invoke `/implement-slice` WITH the `no-changelog` suppression flag so that even this direct, no-wave-context path does NOT write a CHANGELOG.md entry — the single feature changelog entry is owned by merge-ready (see Phase 3).

**Multi-slice wave (2+ pending slices in same wave):**

**Dispatch-time write-surface disjointness check — run this immediately before issuing any `Agent` tool call for a wave with 2+ pending slices:**
- Re-derive that wave's slices' `Files:` lists fresh from the plan file — re-read the plan file now; do NOT reuse `Files:` lists recalled from memory or from an earlier read in this session, since the plan may have been replanned or hand-edited since then.
- Check pairwise disjointness across those lists, always case-insensitively — do not attempt to detect whether the underlying filesystem is case-sensitive. A false conflict merely triggers the replan recovery path below, which is safe; a missed conflict corrupts a wave, which is not. Treat any `Files:` entry ending in a trailing slash as owning that entire directory subtree, so a path-prefix relationship (e.g. `src/handlers/` vs. `src/handlers/widgets.ts`) counts as a conflict too, not only an exact string match.
- **A single-slice wave requires no check** — there is nothing to conflict with. This step applies only when the wave has 2 or more pending slices; skip it entirely for single-slice waves.

**On conflict — refusal and recovery:**
- If any file path appears in 2 or more of the about-to-be-dispatched slices' `Files:` lists, refuse to dispatch this wave: issue ZERO `Agent` tool calls for it, and report the specific conflicting file path together with the slice numbers that both declare it.
- Recover immediately — this must never dead-end an unattended run. Treat it as a Rule 3 auto-resolve first: re-invoke `planner`, flagging the conflicting slice pair and the shared path, so it can rewave the offending slice into a later wave or split file ownership so the lists no longer overlap. Re-derive the (now-revised) wave's `Files:` lists fresh from the plan and re-check disjointness before dispatching.
- Only escalate to Rule 4 if `planner` cannot resolve the conflict automatically after the Rule 3 attempt.

Once the wave's slices are confirmed disjoint (or the wave has only 1 slice), spawn parallel subagents — one Agent tool call per slice in a single message:

```
For each pending slice in the current wave, spawn an Agent with this prompt:

"You are implementing Slice [N]: [description].
Follow the /implement-slice TDD workflow for this slice ONLY.

Slice specification:
- Wave: [W] (sibling slices: [list])
- Files: [files]
- Changes: [changes]
- Verify: [verify command]
- Done when: [condition]

CRITICAL RULES FOR PARALLEL EXECUTION:
1. Do NOT write to .claude/scratchpad.md — the orchestrator handles scratchpad updates
2. Do NOT auto-continue to the next slice — return to the orchestrator after committing
3. Chain git commands: git add <files> && git commit -m '...' (single command to prevent staging conflicts)
4. Read the project's CLAUDE.md at .claude/CLAUDE.md for conventions
5. This slice runs under a `no-changelog` suppression flag — do NOT write a CHANGELOG.md entry. The single feature changelog entry is owned by merge-ready (Phase 3)

Report your result: PASS (with commit hash) or FAIL (with error details)."
```

After all subagents complete:
1. **Collect results** — which slices succeeded (commit hashes), which failed (errors)
2. **Update scratchpad** — mark succeeded slices DONE with commit hashes, mark failed slices with FAILED and reason. Update `## Status:` to reflect current wave progress
3. **Handle failures** (per error-recovery parallel wave rules):
   - All succeeded → proceed to next wave
   - Some failed → keep successful sibling commits (independent files), report failures, ask user: retry / continue / abort
   - All failed → report as blocker, stop

**Continue until all waves show complete in the scratchpad.**

**Backward compatibility:** When slices have no `Wave:` fields, treat each slice as its own wave — sequential execution, identical to current behavior.

### Phase 2.5: Code Cleanup (if 4+ slices were implemented)
Delegate to `refactor-cleaner` agent to review the accumulated changes:
- **Step 0**: Remove dead code, unused imports, and debug logs first — verify typecheck passes on the clean baseline before proceeding
- Consolidate duplicated patterns across slices
- Improve type safety where obvious
Then commit cleanup as a single `chore(core): clean up <feature> implementation` commit.

### Phase 3: Quality Gates
Follow the `/merge-ready` workflow to run all quality gates.
- **Changelog**: the single `CHANGELOG.md` entry for the feature is written here by merge-ready — NOT by any individual slice. Each slice ran under the `no-changelog` suppression flag, so merge-ready is the sole owner of the feature changelog entry.
- If any gate FAILS: the main agent reads the gate's output and fixes the issues directly, then reruns only the failed gate(s) — **except** that any fix which produced a commit invalidates the earlier Gate 2 and Gate 3 passes, so those two re-run over the new commits. This is what stops Gate 6's `--gaps` replan loop from committing code that no reviewer ever inspects.
- Repeat until all gates pass OR 3 fix attempts exhausted per gate
- Output final MERGE READY / NOT MERGE READY verdict

## Rules

- NEVER stop to ask the user unless truly stuck (3 retries exhausted on a critical blocker)
- NEVER skip PRD, Use Cases, or QA documentation steps
- ALWAYS update scratchpad after each slice (enforced by scratchpad rule)
- ALWAYS commit each slice atomically (1 slice = 1 commit)
- NEVER add "Co-Authored-By" or AI attribution
