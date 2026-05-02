# Use Cases: Auto-Persist Plan-Mode Plans to Project

> Based on [PRD](../PRD.md) — Section 14: Auto-Persist Plan-Mode Plans to Project

This document is the blueprint for E2E testing of the auto-persist plan-mode feature introduced in PRD Section 14. The feature introduces three targeted behavioral changes to existing markdown prompt files: (1) a mandatory `Write`-before-`ExitPlanMode` rule in `src/claude.md`, (2) a new Step 0 precondition gate in `src/commands/bootstrap-feature.md`, and (3) an updated Step 5 instruction in `src/agents/planner.md` that reads `<project>/.claude/plan.md` as authoritative input and refines it in-place. A documentation update to `README.md` completes the surface.

Every use case below is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-AN`, `UC-N-EN`, `UC-N-ECN`) are referenced by QA test cases and E2E tests.

**Common preconditions across all use cases** (stated once here, referenced as "common preconditions" below):

- The user is running Claude Code with the updated `src/claude.md` (post-feature), `src/commands/bootstrap-feature.md` (post-feature), and `src/agents/planner.md` (post-feature) installed via `bash install.sh`
- The user's `~/.claude/CLAUDE.md` contains the updated rules from `src/claude.md` (install.sh copies `src/claude.md` to `~/.claude/CLAUDE.md`)
- The user is operating inside a git repository (so `git rev-parse --show-toplevel` succeeds), UNLESS a specific use case explicitly states otherwise
- `<project>/.claude/` directory exists in the project root, UNLESS a specific use case explicitly states otherwise

---

## Actors

| Actor | Description |
|-------|-------------|
| Developer | The human user who enters plan mode, approves a plan, and later invokes `/bootstrap-feature` |
| Claude (plan-mode context) | The AI assistant operating under the mandatory `Write`-before-`ExitPlanMode` rule in `src/claude.md`; authoring and persisting the plan |
| `/bootstrap-feature` orchestrator | The command runtime that checks for `<project>/.claude/plan.md` at Step 0 before dispatching any downstream agents |
| `planner` agent | The bootstrap agent at Step 5 that reads `<project>/.claude/plan.md` as authoritative input and refines it in-place with executable slice format |
| `<project>/.claude/` filesystem | The project-local `.claude/` directory that holds `plan.md` as the canonical plan artifact |

---

## Use Case Coverage

| UC ID | Scenario | PRD FRs | PRD ACs |
|-------|----------|---------|---------|
| UC-1 | Developer exits plan mode — Claude writes plan.md then calls ExitPlanMode | FR-AP-1.1, FR-AP-1.2, FR-AP-1.3 | AC-AP-1, AC-AP-2, AC-AP-10 |
| UC-1-A1 | plan.md already exists — overwrite on ExitPlanMode | FR-AP-1.3 | AC-AP-10 |
| UC-1-E1 | Write fails (directory absent) — ExitPlanMode NOT called | FR-AP-1.2 | AC-AP-10 |
| UC-2 | Developer runs /bootstrap-feature after plan mode — Step 0 passes silently | FR-AP-2.1 through FR-AP-2.6 | AC-AP-3, AC-AP-4, AC-AP-5, AC-AP-8, AC-AP-9 |
| UC-2-A1 | Planner agent (Step 5) reads plan.md and refines it in-place | FR-AP-3.1 through FR-AP-3.5 | AC-AP-6 |
| UC-3 | plan.md already exists from prior feature — overwrite on ExitPlanMode | FR-AP-1.3 | AC-AP-10 |
| UC-4 | No git root present — Write falls back to CWD | FR-AP-1.4 | AC-AP-10 |
| UC-4-E1 | .claude/ absent in non-git CWD — Write fails | FR-AP-1.4 | AC-AP-10 |
| UC-5 | /bootstrap-feature with no plan.md — Step 0 aborts with error | FR-AP-2.1 through FR-AP-2.4 | AC-AP-4, AC-AP-8 |
| UC-6 | ExitPlanMode called without prior Write — downstream Step 0 catches omission | FR-AP-1.2, FR-AP-2.3 | AC-AP-8 |
| UC-7 | plan.md exists but is empty — Step 0 treatment | FR-AP-2.2, FR-AP-2.6 | AC-AP-8, AC-AP-9 |
| UC-8 | .claude/ directory absent — Write fails, ExitPlanMode withheld | FR-AP-1.1, FR-AP-1.2 | AC-AP-10 |
| UC-9 | Developer backs out of plan mode without confirming — no Write, plan.md unchanged | FR-AP-1.1 | AC-AP-10 |
| UC-10 | Plan body contains markdown special characters — Write handles correctly | FR-AP-1.1 | AC-AP-10 |

---

## UC-1: Developer Exits Plan Mode — Claude Writes plan.md Then Calls ExitPlanMode

**Actor**: Claude (plan-mode context), Developer

**Preconditions**:
- Common preconditions hold
- The Developer has entered plan mode (e.g., via `/plan`) and Claude has drafted a complete feature plan
- `<project>/.claude/` directory exists
- `<project>/.claude/plan.md` does NOT exist (first-time persistence for this feature)

**Trigger**: Developer reviews and approves the plan; Claude reaches the finalization step where it would normally call `ExitPlanMode`

### Primary Flow (Happy Path)

1. Claude determines the project root by resolving the git repository root (`git rev-parse --show-toplevel`)
2. Claude computes the target path: `<project>/.claude/plan.md`
3. Claude calls the `Write` tool with `file_path = <project>/.claude/plan.md` and `content = <full plan body>` — this call PRECEDES any `ExitPlanMode` call in the same response
4. The `Write` tool completes successfully; `<project>/.claude/plan.md` now exists on disk with the full plan body (non-empty, containing at least the feature name and scope sections)
5. Claude calls `ExitPlanMode` — the plan-mode session terminates
6. The Developer observes that `<project>/.claude/plan.md` exists and contains the plan that was approved in plan mode

**Postconditions**:
- `<project>/.claude/plan.md` exists and is non-empty
- The file contains the complete plan body (feature name, scope, acceptance criteria, preliminary slice breakdown)
- The `Write` tool call occurred before `ExitPlanMode` in Claude's response sequence
- The Developer can immediately run `/bootstrap-feature` without any manual copy-paste step

### Alternative Flows

- **UC-1-A1: plan.md already exists — overwrite on ExitPlanMode** — Applies when the project was used for a prior feature cycle that left a stale `plan.md`
  1. Steps 1–2 of the primary flow proceed; Claude detects that `<project>/.claude/plan.md` exists
  2. Per FR-AP-1.3, Claude MUST overwrite (not append); the `Write` tool is called with the new plan body, replacing all prior content
  3. Steps 4–6 of the primary flow proceed normally
  4. The prior plan content is replaced; the new plan body is the sole content of `<project>/.claude/plan.md`

  **Postconditions**: `<project>/.claude/plan.md` contains ONLY the current plan body; the prior plan is no longer recoverable from the file (it remains in git history under the prior feature's commits per FR-AP-1.3 rationale)

  **Mapped FR**: FR-AP-1.3

### Error Flows

- **UC-1-E1: Write fails (directory absent) — ExitPlanMode NOT called** — Applies when `<project>/.claude/` does not exist or is not writable (covered more thoroughly in UC-8)
  1. Steps 1–2 of the primary flow proceed
  2. Claude calls the `Write` tool; the tool returns an error (e.g., parent directory does not exist, or permission denied)
  3. Per FR-AP-1.2, since the `Write` has NOT completed successfully, Claude MUST NOT call `ExitPlanMode`
  4. Claude surfaces the error to the Developer: reports the exact path that failed and that the plan body remains in conversation context
  5. The Developer can copy-paste the plan body manually as a one-time fallback
  6. `ExitPlanMode` is withheld; plan-mode session remains open (or ends without the Write-then-ExitPlanMode sequence)

  **Postconditions**: `<project>/.claude/plan.md` does NOT exist (or has unchanged prior content); the plan body is still visible in the conversation; no silent data loss

  **Mapped FR**: FR-AP-1.2

### Edge Cases

- **UC-1-EC1: Plan body is very large (e.g., > 200 lines)** — The `Write` tool does not impose a content-length restriction for in-session writes; the full plan body is persisted regardless of size. There is no truncation behavior on the `Write` path for this use case.

### Data Requirements

- **Input**: Complete plan body (markdown string) produced by Claude during plan mode; git repository root path
- **Output**: `<project>/.claude/plan.md` file on disk with the full plan body
- **Side Effects**: If `plan.md` previously existed, its prior content is overwritten

---

## UC-2: Developer Runs /bootstrap-feature After Plan Mode — Step 0 Passes Silently

**Actor**: Developer, `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- The Developer has completed a plan-mode session that resulted in UC-1's primary flow: `<project>/.claude/plan.md` exists and is non-empty
- The Developer invokes `/bootstrap-feature` from the project root

**Trigger**: Developer runs `/bootstrap-feature <description>` (or with `--with-resources` flag)

### Primary Flow (Happy Path)

1. The `/bootstrap-feature` orchestrator begins at Step 0: Verify plan exists
2. Step 0 performs a presence check on `<project>/.claude/plan.md` (via Glob or Read — presence only, per FR-AP-2.2 and FR-AP-2.6)
3. `<project>/.claude/plan.md` exists; Step 0 passes silently — no output to the Developer (per FR-AP-2.5)
4. The orchestrator proceeds to Step 1 (prd-writer) without any mention of Step 0 to the Developer
5. prd-writer, ba-analyst, architect, qa-planner agents run in sequence (Steps 1–4) per the existing pipeline
6. At Step 5, the planner agent is invoked; it reads `<project>/.claude/plan.md` as its authoritative high-level input per FR-AP-3.1 (covered in detail in UC-2-A1 below)
7. The bootstrap pipeline completes; `<project>/.claude/plan.md` has been refined in-place by the planner

**Postconditions**:
- The bootstrap pipeline completed all steps without aborting
- Step 0's presence check produced no user-visible output
- `<project>/.claude/plan.md` exists and has been augmented with executable slice format (by planner at Step 5)
- All downstream agents (prd-writer through planner) were invoked

### Alternative Flows

- **UC-2-A1: Planner Agent (Step 5) Reads plan.md and Refines It In-Place** — This is the detailed sub-flow for Step 5 of the primary flow above
  1. At Step 5, the `/bootstrap-feature` orchestrator spawns the `planner` agent
  2. The planner reads `<project>/.claude/plan.md` per FR-AP-3.1; this file is the plan-mode output approved by the Developer
  3. The planner treats the file as the source of the user's intent, feature scope, and acceptance criteria per FR-AP-3.2
  4. The planner identifies the implementation-slice section within `plan.md` (if one exists from plan mode)
  5. **If a recognizable implementation-slice section exists**: the planner replaces or extends the preliminary slice descriptions with the executable slice format required by Section 1 FR-3 (`Files:`, `Changes:`, `Verify:`, `Done when:`) and Section 2 FR-1 (`Wave: N`) per FR-AP-3.3
  6. **If no recognizable implementation-slice section exists**: the planner appends a new `## Implementation Plan` section at the end of `plan.md`, preserving all existing content above it unchanged per FR-AP-3.4
  7. The planner uses `Edit` (or `Write`) to update `<project>/.claude/plan.md` in-place — the file is never replaced wholesale from scratch per FR-AP-3.5
  8. The planner also inlines any `.claude/roles-pending.md` subsections per the existing pipeline convention

  **Postconditions**: `<project>/.claude/plan.md` contains the original plan-mode content PLUS the executable slice format with `Wave:`, `Files:`, `Changes:`, `Verify:`, `Done when:` fields; the feature scope, acceptance criteria, and rationale from plan mode are preserved unchanged

  **Mapped FR**: FR-AP-3.1, FR-AP-3.2, FR-AP-3.3, FR-AP-3.4, FR-AP-3.5

### Error Flows

(none — error paths for Step 0 failing are covered in UC-5)

### Edge Cases

- **UC-2-EC1: plan.md was written in a prior git worktree pointing to the same `.claude/` directory** — The presence check in Step 0 does not validate the plan's origin; it accepts any non-empty file at the path. The planner at Step 5 is responsible for structural validation and will handle any content shape gracefully (per FR-AP-3.4 fallback).

### Data Requirements

- **Input**: `<project>/.claude/plan.md` (existing file from plan-mode session)
- **Output**: `/bootstrap-feature` pipeline completes; `<project>/.claude/plan.md` refined with executable slices by Step 5
- **Side Effects**: prd-writer writes to `docs/PRD.md`; ba-analyst writes to `docs/use-cases/`; qa-planner writes to `docs/qa/`; planner updates `<project>/.claude/plan.md`

---

## UC-3: plan.md Already Exists From Prior Feature — Overwrite on ExitPlanMode

**Actor**: Claude (plan-mode context), Developer

**Preconditions**:
- Common preconditions hold
- The Developer completed a prior feature cycle; `<project>/.claude/plan.md` exists with that prior plan's content
- The Developer has entered plan mode for a NEW feature and Claude has drafted a complete plan for it
- `<project>/.claude/` directory exists

**Trigger**: Developer approves the new feature plan; Claude reaches the finalization step

### Primary Flow (Happy Path)

1. Claude determines the project root (git repository root)
2. Claude computes the target path: `<project>/.claude/plan.md`
3. Per FR-AP-1.3, the overwrite policy applies unconditionally — Claude does NOT check whether the existing content is for a different feature, does NOT prompt the Developer for confirmation, and does NOT append
4. Claude calls the `Write` tool with `file_path = <project>/.claude/plan.md` and `content = <new plan body>`; the prior content is replaced
5. The `Write` tool completes successfully
6. Claude calls `ExitPlanMode`

**Postconditions**:
- `<project>/.claude/plan.md` contains ONLY the new plan body
- The prior feature's plan is no longer in the file; it remains accessible via `git log` under the prior feature's commits
- The Developer can immediately run `/bootstrap-feature` for the new feature

### Alternative Flows

- **UC-3-A1: Developer is multi-tasking on concurrent feature branches sharing `.claude/`** — The overwrite silently discards the other branch's plan. This is the accepted behavior per PRD §14.8 Risk 2. Users with concurrent feature branches should use separate git worktrees.
  1. The primary flow proceeds identically — no special handling for concurrent branches
  2. After `ExitPlanMode`, the other branch's plan is gone from `plan.md`
  3. The Developer must re-enter plan mode on the other branch to regenerate that plan

  **Mapped FR**: FR-AP-1.3 (explicit overwrite policy; concurrent-branch case documented as accepted risk)

### Error Flows

(none beyond UC-1-E1 which applies equally here)

### Edge Cases

- **UC-3-EC1: plan.md from prior cycle has uncommitted changes tracked by git** — The `Write` tool overwrites the filesystem file; git staging area and commits are unaffected. The overwritten content is not auto-staged. The developer's `git diff` will show the change as an unstaged modification.

### Data Requirements

- **Input**: New plan body; existing `<project>/.claude/plan.md` with prior content
- **Output**: `<project>/.claude/plan.md` with new plan body replacing prior content
- **Side Effects**: Prior plan content is overwritten (non-recoverable from the file; recoverable from git history)

---

## UC-4: No Git Root Present — Write Falls Back to CWD

**Actor**: Claude (plan-mode context), Developer

**Preconditions**:
- The user is running Claude Code in a directory that is NOT a git repository (no `.git` ancestor directory)
- The Developer has completed a plan-mode session; Claude has drafted a complete plan
- `.claude/` directory exists in the current working directory (CWD)

**Trigger**: Developer approves the plan; Claude reaches the finalization step

### Primary Flow (Happy Path)

1. Claude attempts to determine the project root via git root detection; detection fails (no `.git` in any ancestor directory)
2. Per FR-AP-1.4, Claude falls back to the current working directory as the project root; the target path becomes `<CWD>/.claude/plan.md`
3. Claude calls the `Write` tool with `file_path = <CWD>/.claude/plan.md` and `content = <full plan body>`
4. The `Write` tool completes successfully
5. Claude calls `ExitPlanMode`

**Postconditions**:
- `<CWD>/.claude/plan.md` exists and contains the full plan body
- Plan persistence was NOT skipped due to the absence of a git root
- The Developer can invoke `/bootstrap-feature` from the same CWD to run the pipeline

### Alternative Flows

- **UC-4-A1: `.claude/` directory does not exist in the non-git CWD** — This is covered as an error flow in UC-4-E1 and UC-8

### Error Flows

- **UC-4-E1: `.claude/` absent in non-git CWD — Write fails** — Applies when the user is in a directory without `.git` AND without `.claude/`
  1. Steps 1–2 of the primary flow proceed; the fallback path is `<CWD>/.claude/plan.md`
  2. Claude calls the `Write` tool; the tool returns an error because the parent directory `<CWD>/.claude/` does not exist
  3. Per FR-AP-1.2, since the `Write` has NOT completed successfully, Claude MUST NOT call `ExitPlanMode`
  4. **Architect-decision-pending**: FR-AP-1.4 specifies the fallback path but PRD §14.8 Risk 3 notes that the exact handling of the missing `.claude/` directory (create it via `Bash`, or fall back to `./plan.md` in the CWD as a last resort) is deferred to implementation. The behavior in this step depends on the implementation decision:
     - **Option A (directory creation via Bash)**: Claude issues a `Bash mkdir -p <CWD>/.claude` command before retrying the `Write`; succeeds if `Bash` is available in plan-mode context
     - **Option B (CWD fallback)**: Claude falls back to writing `./plan.md` directly in the CWD as a last resort, and informs the Developer of the fallback path
  5. In either case, Claude reports the situation to the Developer; `ExitPlanMode` is deferred until a successful write completes

  **Mapped FR**: FR-AP-1.4
  **Open edge**: Exact directory-creation behavior is an architect-pending decision (PRD §14.8 Risk 3 / PRD §14.6 Open Question 2)

### Edge Cases

- **UC-4-EC1: CWD is a symlink or a mounted path that resolves differently** — The `Write` tool resolves paths using the OS path resolution; plan.md is written to the resolved path. The use case behavior is identical; the edge is a filesystem-level detail.

### Data Requirements

- **Input**: Complete plan body; CWD as project root (no git root available)
- **Output**: `<CWD>/.claude/plan.md` or `<CWD>/plan.md` (per architect decision on Option A vs B)
- **Side Effects**: Possible creation of `.claude/` directory in CWD (Option A)

---

## UC-5: /bootstrap-feature With No plan.md — Step 0 Aborts With Error

**Actor**: Developer, `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- The Developer has NOT entered plan mode (or did so but `ExitPlanMode` was called without a prior `Write`, per UC-6)
- `<project>/.claude/plan.md` does NOT exist

**Trigger**: Developer runs `/bootstrap-feature <description>` without having completed a plan-mode session that persisted `plan.md`

### Primary Flow (Happy Path = Clean Abort)

1. The `/bootstrap-feature` orchestrator begins at Step 0: Verify plan exists
2. Step 0 performs a presence check on `<project>/.claude/plan.md` (via Glob or Read — presence only, per FR-AP-2.2)
3. `<project>/.claude/plan.md` is NOT found
4. Per FR-AP-2.3, Step 0 aborts the `/bootstrap-feature` run immediately with the error message (per FR-AP-2.4):
   ```
   error: .claude/plan.md not found. Enter plan mode first (/plan), complete the plan, and exit plan mode — Claude will automatically save the plan to .claude/plan.md before exiting.
   ```
5. No downstream agents are invoked — prd-writer, ba-analyst, architect, qa-planner, and planner are NOT started
6. The Developer reads the error, enters plan mode (`/plan`), drafts a plan, and exits plan mode (which triggers UC-1's primary flow to write `plan.md`)
7. The Developer re-runs `/bootstrap-feature`; Step 0 now passes per UC-2's primary flow

**Postconditions**:
- `/bootstrap-feature` exited at Step 0 before any downstream agents were invoked
- The error message contained the exact path checked and the recommended next action (per FR-AP-2.4)
- No PRD section, use-case file, or QA test case was partially created
- The Developer knows exactly what to do next

### Alternative Flows

(none — the abort is deterministic on file absence)

### Error Flows

- **UC-5-E1: plan.md exists but READ permission is denied** — Step 0 uses Glob or Read for presence check; a permission-denied result on Glob could be interpreted as file-absent
  1. Step 0 invokes the presence check; the check returns an error (permission denied)
  2. This edge case is not explicitly specified by FR-AP-2. The safest behavior is to treat a permission-denied result as "file present but unreadable" and abort with a different error message indicating the access issue — rather than proceeding as if absent
  3. **This is an architect-pending edge case**: FR-AP-2.6 says Step 0 does a presence check only; it does not specify how to handle a read-permission error. Flag for architect review.

  **Mapped FR**: FR-AP-2.2, FR-AP-2.3

### Edge Cases

- **UC-5-EC1: Developer passes `--with-resources` flag to /bootstrap-feature with no plan.md** — The flag is irrelevant; Step 0 runs first regardless of flags, and the abort precedes any resource-architect or role-planner invocation.
- **UC-5-EC2: Developer passes a description argument to /bootstrap-feature with no plan.md** — Same as EC1; Step 0 fires unconditionally before any argument processing that would invoke downstream agents.

### Data Requirements

- **Input**: Invocation of `/bootstrap-feature`; absent `<project>/.claude/plan.md`
- **Output**: Error message with exact path and remediation instruction; clean abort
- **Side Effects**: None — no files created, no agents invoked

---

## UC-6: ExitPlanMode Called Without Prior Write — Downstream Step 0 Catches Omission

**Actor**: Claude (plan-mode context), Developer, `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- A plan-mode session occurred but the persistence rule was NOT followed: Claude called `ExitPlanMode` WITHOUT a preceding `Write` to `<project>/.claude/plan.md`
- `<project>/.claude/plan.md` does NOT exist (or has stale content from a prior cycle)

**Trigger**: Developer attempts to run `/bootstrap-feature` after the incomplete plan-mode session

### Primary Flow (Rule Violation Caught Downstream)

1. The plan-mode session ends without persisting `plan.md`; there is no immediate runtime error because `ExitPlanMode` and `Write` are independent tool calls (per PRD §14 NFR-AP-4)
2. The Developer runs `/bootstrap-feature`
3. Step 0 of the `/bootstrap-feature` orchestrator performs the presence check on `<project>/.claude/plan.md`
4. The file is absent (or stale); Step 0 fires the abort with the standard error message (per FR-AP-2.3 / FR-AP-2.4, same as UC-5)
5. The Developer enters plan mode again, re-drafts the plan, and exits plan mode — this time Claude follows the persistence rule (UC-1 primary flow)
6. The Developer re-runs `/bootstrap-feature`; Step 0 now passes

**Postconditions**:
- The rule violation (Write omitted before ExitPlanMode) did NOT cause silent data loss in the pipeline — the bootstrap abort at Step 0 surfaced the problem
- The Developer was directed back to plan mode to regenerate the persisted plan
- No downstream agents were invoked on the basis of a missing plan

### Alternative Flows

- **UC-6-A1: plan.md has stale content from a prior feature** — The presence check passes (the stale file exists), and Step 0 silently proceeds. The planner at Step 5 then reads the stale content. **This is a risk**, not an error flow per PRD — FR-AP-2.6 explicitly mandates presence-only checking at Step 0. Structural/content validation is the planner's responsibility. The planner will likely detect the mismatch and raise it to the Developer.
  1. Step 0 passes silently (the stale file exists)
  2. Agents at Steps 1–4 run without access to the plan (since prd-writer reads the PRD, not plan.md directly)
  3. At Step 5, the planner reads the stale `plan.md` as authoritative input; the content describes a prior feature
  4. The planner is expected to flag the mismatch or reconcile it against the PRD section produced at Step 1

  **Mapped FR**: FR-AP-2.6 (presence-only check is explicit; stale-content handling is planner's responsibility)

### Error Flows

(none beyond what is covered in UC-5 — the catch mechanism is Step 0)

### Edge Cases

- **UC-6-EC1: Conversation context compaction caused the rule to be forgotten** — Claude may lose the persistence rule from its active context window during a very long plan-mode session. The two-layer approach (rule in `src/claude.md` + Step 0 precondition) ensures the omission is caught downstream even if context compaction is the cause.

### Data Requirements

- **Input**: Absent `<project>/.claude/plan.md` (rule violation scenario)
- **Output**: Bootstrap abort with error message at Step 0; no side effects
- **Side Effects**: None

---

## UC-7: plan.md Exists But Is Empty — Step 0 Treatment

**Actor**: Developer, `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- `<project>/.claude/plan.md` exists on disk but has 0 bytes (empty file)
- The empty file could result from: a crashed `Write` call that created the file but wrote no content, or a manual `touch .claude/plan.md` by the developer

**Trigger**: Developer runs `/bootstrap-feature`

### Primary Flow (Architect-Pending Decision)

1. The `/bootstrap-feature` orchestrator begins at Step 0
2. Step 0 performs a presence check on `<project>/.claude/plan.md` per FR-AP-2.2
3. The file EXISTS (0 bytes); the presence check returns true
4. **Per FR-AP-2.6**, Step 0 does NOT read or validate the content — it is a presence-only check
5. Step 0 passes silently; the orchestrator proceeds to Step 1 (prd-writer)
6. At Step 5, the planner reads the empty `plan.md`; the planner encounters a file with no recognizable content
7. Per FR-AP-3.4, since no recognizable implementation-slice section exists, the planner appends a new `## Implementation Plan` section at the end of the file (the file being empty, it effectively writes the whole plan content)
8. The planner has no user intent, scope, or acceptance criteria from the file to preserve; it works from the PRD sections produced at Steps 1–4 instead

**Postconditions**:
- Step 0 passes (file exists, presence check passes)
- The planner handles the empty file gracefully via the FR-AP-3.4 fallback
- `<project>/.claude/plan.md` is no longer empty after Step 5

### Alternative Flows

- **UC-7-A1: Empty file treated as missing (alternative interpretation)** — An alternative interpretation of the feature intent is that an empty `plan.md` should be treated the same as an absent `plan.md` — the user has no high-level plan, and the bootstrap should abort. **This is an architect-pending decision**: FR-AP-2.6 mandates presence-only checking, which means the current spec's behavior is Option A (pass the check). Option B (treat empty as absent, abort with error) would require an amendment to FR-AP-2.6 to add a non-empty check.
  1. IF the architect decides for Option B: Step 0 checks that `plan.md` exists AND has non-zero byte count
  2. On empty file: abort with error message analogous to FR-AP-2.4, pointing the Developer to re-enter plan mode
  3. **Flag for architect review**: this decision affects AC-AP-8 and AC-AP-9

  **Mapped FR**: FR-AP-2.2, FR-AP-2.6 (current spec: presence-only = pass; open question: should 0-byte be treated as absent?)

### Error Flows

(none — the current spec passes the check; errors are in the architect-pending alternative above)

### Edge Cases

- **UC-7-EC1: plan.md has only whitespace characters** — Whitespace-only is non-zero bytes; the presence check passes. The planner at Step 5 treats it like the empty case — no recognizable structure; FR-AP-3.4 fallback applies.

### Data Requirements

- **Input**: `<project>/.claude/plan.md` (0 bytes); `/bootstrap-feature` invocation
- **Output**: Step 0 passes; planner writes implementation plan via FR-AP-3.4 fallback
- **Side Effects**: `plan.md` gains content from the planner's FR-AP-3.4 append

---

## UC-8: .claude/ Directory Absent — Write Fails, ExitPlanMode Withheld

**Actor**: Claude (plan-mode context), Developer

**Preconditions**:
- Common preconditions hold EXCEPT: `<project>/.claude/` directory does NOT exist in the project root
- The Developer has completed a plan-mode session; Claude has drafted a complete plan
- The project IS a git repository (git root detection succeeds)
- The git root exists but `<git-root>/.claude/` was never created (e.g., scaffolding was not run, or the directory was deleted)

**Trigger**: Developer approves the plan; Claude reaches the finalization step

### Primary Flow (Error Recovery)

1. Claude determines the project root (git root resolution succeeds)
2. Claude computes the target path: `<project>/.claude/plan.md`
3. Claude calls the `Write` tool with `file_path = <project>/.claude/plan.md` and `content = <full plan body>`
4. The `Write` tool returns an error — the parent directory `<project>/.claude/` does not exist
5. Per FR-AP-1.2, since the `Write` has NOT completed successfully, Claude MUST NOT call `ExitPlanMode`
6. Claude surfaces the error to the Developer:
   - Reports the exact path that failed: `<project>/.claude/plan.md`
   - Reports the cause: `.claude/` directory does not exist
   - States that the plan body remains in the conversation context as a fallback
   - Recommends the Developer run `mkdir -p <project>/.claude` and then re-enter plan mode (or manually copy the plan body)
7. The plan body remains visible in the conversation; no silent data loss

**Postconditions**:
- `<project>/.claude/plan.md` does NOT exist (Write failed)
- `ExitPlanMode` was NOT called
- The Developer has the plan body in the conversation and a clear remediation path
- The plan-mode session is in an incomplete state; the Developer must take manual action

### Alternative Flows

- **UC-8-A1: Claude can use Bash to create the directory** — If the `Bash` tool is available in the plan-mode context AND the implementation decision (see PRD §14.8 Risk 3) allows it, Claude can run `mkdir -p <project>/.claude` before retrying `Write`
  1. Steps 1–4 of the primary flow proceed; the Write fails
  2. Claude runs `Bash` with `mkdir -p <project>/.claude`
  3. Claude retries the `Write` call; it now succeeds
  4. Claude calls `ExitPlanMode`
  5. Primary flow postconditions are achieved

  **Architect-decision-pending**: Whether `Bash` is available in plan-mode context is unverified (see PRD §14.8 Risk 3 open question)

  **Mapped FR**: FR-AP-1.4 (implementation-refinement item)

### Error Flows

(none beyond the primary flow above, which IS the error flow)

### Edge Cases

- **UC-8-EC1: .claude/ directory exists but plan.md's parent sub-path is different** — Not applicable; `plan.md` is always a direct child of `.claude/` per FR-AP-1.1.

### Data Requirements

- **Input**: Complete plan body; `.claude/` absent from project root
- **Output**: Error message to Developer; plan body preserved in conversation context
- **Side Effects**: None (Write failed; no file created)

---

## UC-9: Developer Backs Out of Plan Mode Without Confirming — No Write, plan.md Unchanged

**Actor**: Developer, Claude (plan-mode context)

**Preconditions**:
- Common preconditions hold
- The Developer entered plan mode; Claude may have begun drafting a plan but the Developer decided not to proceed (e.g., the plan was not suitable, the Developer aborted the session, or the session ended without explicit approval)
- The persistence rule fires ONLY on `ExitPlanMode` — it does NOT fire on entering plan mode or on mid-session abandonment

**Trigger**: The plan-mode session ends WITHOUT the Developer approving the plan and WITHOUT Claude calling `ExitPlanMode`

### Primary Flow (Non-Event)

1. The Developer entered plan mode and Claude may have drafted a plan
2. The Developer did NOT approve the plan or the session was abandoned
3. Claude did NOT reach the finalization step; `ExitPlanMode` was never called
4. Per FR-AP-1.1 / FR-AP-1.2, the persistence rule requires `Write` to precede `ExitPlanMode` — if `ExitPlanMode` is never called, there is no trigger for the `Write`
5. `<project>/.claude/plan.md` is unchanged from its pre-session state (either absent or still contains the prior feature's plan)
6. No write occurred; no data was persisted

**Postconditions**:
- `<project>/.claude/plan.md` is unchanged
- No partial or draft plan content was written to disk
- If the Developer later runs `/bootstrap-feature` and `plan.md` was absent before, Step 0 will abort per UC-5

### Alternative Flows

- **UC-9-A1: Developer re-enters plan mode to draft a new plan** — The Developer starts a fresh plan-mode session; the outcome follows UC-1's primary flow when the Developer approves and `ExitPlanMode` is called

### Error Flows

(none — the non-event is the expected behavior)

### Edge Cases

- **UC-9-EC1: Claude partially wrote plan.md before the Developer abandoned the session** — If the `Write` tool was called but `ExitPlanMode` was not reached before the session ended, the partial content may persist on disk. However, a valid Write + ExitPlanMode sequence produces a complete plan body (per UC-1); a Write without ExitPlanMode would be an implementation bug in Claude's behavior, not a specified flow.

### Data Requirements

- **Input**: Plan-mode session that did not produce an approved plan
- **Output**: No change to `<project>/.claude/plan.md`
- **Side Effects**: None

---

## UC-10: Plan Body Contains Markdown Special Characters — Write Handles Correctly

**Actor**: Claude (plan-mode context), Developer

**Preconditions**:
- Common preconditions hold
- The plan body that Claude drafts contains markdown special characters that could break a naive shell heredoc or grep-based processing, including:
  - Horizontal rule separators (`---`)
  - Heredoc markers (`<<EOF`, `<<'EOF'`)
  - Backtick-fenced code blocks (``` ``` ```)
  - Inline backticks
  - Dollar signs and shell variable references (e.g., `$VARIABLE`)
  - Angle brackets (`<`, `>`)
  - Backslashes

**Trigger**: Developer approves the plan; Claude calls the `Write` tool

### Primary Flow (Verified Non-Issue)

1. Claude drafts the plan body containing any combination of the special characters listed above
2. Claude calls the `Write` tool with `file_path = <project>/.claude/plan.md` and `content = <plan body with special characters>`
3. The `Write` tool accepts a string parameter directly — it does NOT use a shell heredoc, subprocess, or shell interpolation to write the content
4. The string content is written verbatim to disk; no special characters are escaped, mangled, or lost
5. The plan body on disk exactly matches what Claude passed to `Write`
6. Claude calls `ExitPlanMode`

**Postconditions**:
- `<project>/.claude/plan.md` contains the exact plan body including all special characters
- `grep`, `cat`, and `Read` tool operations on the file will return the exact characters written

### Alternative Flows

(none — the Write tool's string-parameter design makes this a non-issue by construction)

### Error Flows

(none — the special characters do not affect the Write tool's behavior)

### Edge Cases

- **UC-10-EC1: Plan body contains null bytes or binary content** — Unlikely in plan-mode output (which is always markdown text), but if encountered, the `Write` tool may reject binary content. This is outside the specified feature scope and not a documented failure mode.
- **UC-10-EC2: Plan body is extremely long (many thousand lines)** — The `Write` tool handles large string content; there is no content-length limit documented for in-session writes. The plan body remains fully persisted.

### Data Requirements

- **Input**: Plan body containing markdown special characters; `<project>/.claude/plan.md` target path
- **Output**: `<project>/.claude/plan.md` with verbatim plan body including all special characters
- **Side Effects**: None beyond normal plan persistence

---

## Facts

### Verified facts

- PRD §14 (`docs/PRD.md` lines 3462–3617) was read in this session and is the authoritative source for all functional requirements. Confirmed: FR-AP-1.1 through FR-AP-1.5 (src/claude.md rule), FR-AP-2.1 through FR-AP-2.6 (bootstrap Step 0), FR-AP-3.1 through FR-AP-3.5 (planner Step 5), FR-AP-4.1 through FR-AP-4.2 (README), NFR-AP-1 through NFR-AP-5, AC-AP-1 through AC-AP-10, §14.7 (out of scope), §14.8 (risks). Source: `docs/PRD.md` lines 3462–3617 read in this session.
- PRD §14 `Date: 2026-05-02` — this is on or after `MERGE_DATE` (cognitive-self-check rule's backward-compatibility cutoff); the `## Facts` block is mandatory per the cognitive-self-check rule. Source: `docs/PRD.md` line 3465 read in this session.
- PRD §14 NFR-AP-4 explicitly states: "The plan persistence rule in `src/claude.md` is instructional, not enforced by the Claude Code tool runtime. `ExitPlanMode` and `Write` are independent tool calls; there is no API-level guarantee that the `Write` precedes `ExitPlanMode`." Source: `docs/PRD.md` line 3528 read in this session.
- PRD §14.8 Risk 3 explicitly defers the exact directory-creation fallback behavior for the no-`.claude/`-directory case to implementation (planner agent at Slice 1). Source: `docs/PRD.md` lines 3572–3572 read in this session.
- Knowledge base status: `doc_count: 28`, `chunk_count: 51542`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db`. Verified via `claudeknows status --json` in this session.
- Knowledge base source list inspected via `claudeknows list --json` in this session. Source basenames indicate: ML/AI books (Deep Learning, Generative AI, LangChain, AI Agents), data engineering, SRE (Site Reliability Engineering, Chaos Engineering), system design (Russian), Kafka (Russian), generic software engineering (Russian). No meta-SDLC pipeline, Claude Code plan-mode, or agent-orchestration prompt-engineering content present.
- Corpus scope relevance verdict: **No overlap**. Observed corpus domain: ML/AI, data engineering, SRE, software engineering (generic). Task domain: meta-SDLC agent orchestration, Claude Code plan-mode persistence, markdown prompt engineering. No topical queries were run; the title list is sufficient evidence per the corpus-scope-relevance protocol in `~/.claude/rules/knowledge-base-tool.md`.
- The `Write` tool accepts `file_path` and `content` string parameters and does NOT use shell interpolation — confirmed via `~/.claude/rules/tool-limitations.md` which references the `Write` tool by name and describes its string-parameter interface. Source: `~/.claude/rules/tool-limitations.md` in the system-reminder context for this session.
- Format conventions for use-case files were verified by reading `docs/use-cases/role-planner-reuse-teardown_use_cases.md` lines 1–120 and `docs/use-cases/auto-release_use_cases.md` lines 1–80 in this session.

### External contracts

- **Claude Code `ExitPlanMode` tool call** — symbol: `ExitPlanMode` (invoked by Claude when approved plan is finalized; no parameters per standard plan-mode behavior) — source: `~/.claude/CLAUDE.md` (global rules) references `ExitPlanMode` in the Plan Critic Pass section; consistent with usage across `src/claude.md` per PRD §14.3 FR-AP-1.1 description — verified: no — assumption. Risk: if a future Claude Code version renames the tool or adds required parameters, FR-AP-1.x rules referencing the name would need updating. Verification path: architect Step 3 checks the Claude Code tool manifest or built-in tool docs.
- **Claude Code `Write` tool call** — symbol: `Write` with `file_path: string` and `content: string` parameters; writes content verbatim to disk without shell interpolation — source: `~/.claude/rules/tool-limitations.md` (system-reminder context, read in this session) references `Write` by name and describes its file-writing behavior; also referenced throughout `~/.claude/CLAUDE.md` for commit workflows — verified: yes (tool behavior described in `~/.claude/rules/tool-limitations.md` and confirmed as non-heredoc string parameter in the standard tool description).
- **Claude Code `Glob` tool call** — symbol: `Glob` with `pattern: string` parameter; used in FR-AP-2.2 for `<project>/.claude/plan.md` presence check — source: `~/.claude/CLAUDE.md` (global rules) references `Glob` in agent tool lists throughout the codebase — verified: no — assumption. Risk: if the Glob tool does not support exact-path matching (vs. glob patterns), Step 0's presence check may require a different approach (e.g., `Read` with error-catching or `Bash ls`). Verification path: architect Step 3 or Slice 2 implementation review.

### Assumptions

- **`src/claude.md` has a section on Plan Critic Pass and ExitPlanMode** where the new `### Plan-Mode Persistence (MANDATORY)` rule will be co-located — risk: if no ExitPlanMode guidance section exists, the placement section must be created. How to verify: Slice 1 reads `src/claude.md` before editing. (Source: PRD §14.8 Assumptions section in `docs/PRD.md` lines 3606–3607, read in this session.)
- **`/bootstrap-feature` uses step-numbered structure** (Step 1, Step 2, etc.) that allows prepending "Step 0" — risk: if the command uses a different organizational scheme, the step numbering may not fit. How to verify: Slice 2 reads `src/commands/bootstrap-feature.md` before editing. (Source: PRD §14.8 Assumptions section in `docs/PRD.md` line 3607, read in this session.)
- **`src/agents/planner.md` uses "Step 5"** as the label for its execution step inside `/bootstrap-feature` — risk: the actual step label may differ. How to verify: Slice 3 reads `src/agents/planner.md` before editing. (Source: PRD §14.8 Assumptions section in `docs/PRD.md` lines 3608, read in this session.)
- **Claude Code does NOT auto-create parent directories** when `Write` is called with a path whose parent does not exist — risk: if `.claude/` is absent, the Write fails silently or with an error, causing UC-8 and UC-4-E1 scenarios. How to verify: PRD §14.8 Risk 3 flags this; implementation must include a directory-creation fallback instruction. (Source: PRD §14.8 line 3572, read in this session.)
- **The overwrite policy (FR-AP-1.3)** is correct for single-active-feature workflows; concurrent-branch users will have their prior plan overwritten silently. This is explicitly accepted in PRD §14.8 Risk 2. (Source: PRD §14.8 lines 3570, read in this session.)
- **The planner uses `Edit` or targeted `Write` (not wholesale `Write` replacement)** to refine `plan.md` in-place per FR-AP-3.3 and FR-AP-3.5 — risk: if the planner uses wholesale `Write` it would violate FR-AP-3.5's "never replace wholesale" constraint. How to verify: Slice 3 implementation and code-reviewer gate.

### Open questions

- knowledge-base: corpus is ML/AI + data engineering + SRE + generic software engineering; task is meta-SDLC agent orchestration and Claude Code plan-mode persistence; no overlap. Skipping topical queries — corpus enrichment with Claude Code / agent-orchestration / LLM-pipeline reference materials would help future similar tasks.
- **UC-4-E1 / UC-8-A1 — Bash availability in plan-mode context**: Is the `Bash` tool available to Claude during a plan-mode session? This determines whether the directory-creation fallback (Option A: `mkdir -p`) is viable or whether Option B (fall back to writing `./plan.md` in the CWD) is needed. PRD §14.8 Risk 3 defers this to the Slice 1 implementation. Needs: architect call at Step 3 or Slice 1 investigation.
- **UC-7 — Empty plan.md treatment at Step 0**: Should a 0-byte `plan.md` be treated as present (current FR-AP-2.6 spec: presence-only) or absent (alternative: require non-empty)? If treated as present, the planner at Step 5 falls back to FR-AP-3.4 append behavior with no user intent to preserve. If treated as absent, FR-AP-2.6 must be amended. Needs: architect call at Step 3.
- **UC-5-E1 — Glob permission-denied behavior at Step 0**: FR-AP-2.2 specifies Glob or Read for the presence check but does not specify how permission-denied results are handled. Should the check treat permission-denied as file-absent (abort with the standard error) or emit a distinct access-error message? Needs: architect call at Step 3 or Slice 2 implementation decision.
