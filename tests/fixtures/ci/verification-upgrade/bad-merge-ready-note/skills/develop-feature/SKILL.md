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
- If any gate FAILS: the main agent reads the gate's output and fixes the issues directly, then reruns only the failed gate(s)
- Repeat until all gates pass OR 3 fix attempts exhausted per gate
- Output final MERGE READY / NOT MERGE READY verdict

## Rules

- NEVER stop to ask the user unless truly stuck (3 retries exhausted on a critical blocker)
- NEVER skip PRD, Use Cases, or QA documentation steps
- ALWAYS update scratchpad after each slice (enforced by scratchpad rule)
- ALWAYS commit each slice atomically (1 slice = 1 commit)
- NEVER add "Co-Authored-By" or AI attribution
