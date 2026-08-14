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

**Single-slice wave (or no `Wave:` fields in plan):**
Follow the `/implement-slice` workflow directly — identical to current sequential behavior. Invoke `/implement-slice` WITH the `no-changelog` suppression flag so that even this direct, no-wave-context path does NOT write a CHANGELOG.md entry — the single feature changelog entry is owned by merge-ready (see Phase 3).

**Multi-slice wave (2+ pending slices in same wave):**
Spawn parallel subagents — one Agent tool call per slice in a single message:

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
