# Use Cases: Execution Waves -- Parallel Slice Implementation

> Based on [PRD](../PRD.md) -- Section 2: Execution Waves

---

## UC-1: Planner Wave Assignment

**Actor**: Planner agent creating an implementation plan during `/bootstrap-feature`
**Preconditions**:
- PRD, use cases, architecture review, and QA test cases all exist
- The planner agent has read the project's CLAUDE.md and explored the codebase
- The planner agent prompt (`src/agents/planner.md`) requires the executable plan format including the `Wave: N` field (Section 1 FR-3 + Section 2 FR-1)
- Each slice already has `Files:`, `Changes:`, `Verify:`, and `Done when:` fields

**Trigger**: The planner agent finishes defining all slices and begins the "Wave Assignment" post-processing step

### Primary Flow (Happy Path)

1. The planner agent completes all slices (5-9 total), each with `Files:`, `Changes:`, `Verify:`, and `Done when:` fields
2. The planner enters the "Wave Assignment" post-processing step
3. The planner collects the `Files:` list from every slice into a set per slice
4. The planner performs file-set intersection analysis: for each pair of slices, it checks whether their file sets share any file path
5. Slices with zero file-set intersection AND no logical dependency (no `Done when:` referencing another slice's output) are grouped into the same wave
6. Slices that depend on earlier slices (via shared files or `Done when:` references) are assigned to a later wave, respecting dependency ordering
7. Wave 1 contains only slices with no dependencies on other slices
8. The planner assigns a `Wave: N` field (1-indexed integer) to each slice
9. The planner outputs a wave summary table showing: wave number, slice numbers in that wave, and the rationale (which files are disjoint, which dependencies are satisfied by prior waves)
10. The planner appends the "Wave Assignment" section to the plan, documenting the algorithm used

**Postconditions**:
- Every slice has a `Wave: N` field
- No two slices in the same wave share any file in their `Files:` lists
- Every slice in wave N+1 has all its dependencies satisfied by slices in waves 1 through N
- Wave numbers are contiguous integers starting at 1 with no gaps
- A wave summary table is present in the plan output

### Alternative Flows

- **UC-1-A1: All slices share files -- fully sequential** -- Every slice touches at least one file that another slice also touches
  1. The planner completes all slices and enters wave assignment
  2. File-set intersection analysis reveals that every pair of slices shares at least one file path
  3. The planner assigns each slice to its own wave: Slice 1 to Wave 1, Slice 2 to Wave 2, ..., Slice N to Wave N
  4. The wave summary table shows N waves, each containing exactly one slice
  5. The rationale column documents the specific file overlaps that prevented grouping
  6. This is equivalent to fully sequential execution (identical to pre-feature behavior)

- **UC-1-A2: All slices are independent -- fully parallel** -- No slice shares any file with any other slice, and no logical dependencies exist
  1. The planner completes all slices and enters wave assignment
  2. File-set intersection analysis reveals zero overlap between all slice pairs
  3. No `Done when:` condition references output from another slice
  4. The planner assigns all slices to Wave 1
  5. The wave summary table shows 1 wave containing all slice numbers
  6. The rationale column documents that all file sets are fully disjoint
  7. During execution, all slices will run in parallel

### Error Flows

- **UC-1-E1: Logical dependency exists despite no file overlap** -- Two slices touch different files but one depends on the other's output
  1. The planner completes file-set intersection analysis and finds two slices (e.g., Slice 2 and Slice 4) have no shared files
  2. However, the planner recognizes a logical dependency: Slice 4's `Done when:` condition references an artifact created by Slice 2 (e.g., Slice 2 creates a type definition in `types.ts` and Slice 4 imports that type in `handler.ts`)
  3. The planner assigns Slice 2 to an earlier wave than Slice 4, even though their `Files:` lists do not overlap
  4. The wave summary table documents the logical dependency as the rationale for the wave separation
  5. The `Done when:` cross-reference is noted explicitly so the Plan Critic can verify it

### Edge Cases

- **UC-1-EC1: Legacy plan without Wave fields** -- A plan was created before the Execution Waves feature existed, or the planner omits wave assignment for a simple feature
  1. The planner produces all slices with `Files:`, `Changes:`, `Verify:`, and `Done when:` fields but does NOT include `Wave: N` fields
  2. No "Wave Assignment" section is present in the plan
  3. This is valid per NFR-4 (wave computation is optional)
  4. The downstream system (`develop-feature`) treats the plan as fully sequential: each slice is implicitly its own wave, executed one at a time
  5. No behavioral change from pre-feature pipeline behavior
  6. The Plan Critic skips wave validation checks (UC-5-A1)

- **UC-1-EC2: Single-slice plan** -- The feature requires only one slice
  1. The planner produces a single slice
  2. Wave assignment is trivial: the sole slice is assigned Wave 1
  3. The wave summary table shows 1 wave with 1 slice
  4. Execution proceeds identically to current behavior (no parallelism possible)

- **UC-1-EC3: Partial file overlap creates a chain** -- Slice A shares files with Slice B, and Slice B shares files with Slice C, but Slice A and Slice C share no files
  1. The planner detects that A and B overlap, and B and C overlap
  2. The planner assigns A to Wave 1, B to Wave 2 (depends on A), C to Wave 3 (depends on B)
  3. Even though A and C have no direct file overlap, the transitive dependency through B prevents them from being in the same wave
  4. The wave summary table documents the dependency chain

### Data Requirements

- **Input**: All slices with their `Files:` lists (verified file paths), `Changes:`, `Verify:`, and `Done when:` fields; the project's file structure
- **Output**: Each slice augmented with a `Wave: N` field; a "Wave Assignment" section with the algorithm documentation and wave summary table
- **Side Effects**: None during planning. The wave assignments are a property of the plan document, consumed by `develop-feature` during Phase 2.

---

## UC-2: develop-feature Wave-Aware Orchestration

**Actor**: `develop-feature` command running Phase 2 (Implement All Slices)
**Preconditions**:
- Phase 1 (Documentation) is complete: PRD, use cases, architecture review, QA test cases all exist
- An implementation plan exists with slices containing `Files:`, `Changes:`, `Verify:`, `Done when:`, and (optionally) `Wave: N` fields
- The developer's feature branch is checked out and clean
- `.claude/scratchpad.md` is initialized with the plan (either wave-grouped or flat format)

**Trigger**: `develop-feature` transitions from Phase 1 to Phase 2 and begins reading the plan to execute slices

### Primary Flow (Happy Path) -- Multi-slice wave detected

1. `develop-feature` reads the implementation plan and groups slices by their `Wave: N` field
2. The plan contains multiple waves (e.g., Wave 1 with Slices 1,3; Wave 2 with Slice 2; Wave 3 with Slices 4,5)
3. `develop-feature` begins with Wave 1
4. Wave 1 contains multiple slices (Slices 1 and 3) -- `develop-feature` spawns one parallel Agent subagent per slice
5. Each subagent receives the full slice context in its spawn prompt: slice number, `Files:`, `Changes:`, `Verify:`, `Done when:`, wave number, and sibling slice numbers in the same wave
6. Each subagent also receives an explicit instruction to skip scratchpad writes (the orchestrator handles scratchpad updates)
7. Both subagents execute their TDD flow simultaneously (tests first, implement, verify, commit)
8. `develop-feature` waits for ALL subagents in Wave 1 to complete
9. Both subagents return success (each committed their slice)
10. `develop-feature` updates `.claude/scratchpad.md` with the results: Slices 1 and 3 marked DONE under `### Wave 1`, wave status set to `complete`
11. `develop-feature` proceeds to Wave 2 (single slice -- Slice 2)
12. Wave 2 has a single slice -- `develop-feature` executes it via the existing `/implement-slice` workflow (no parallelism, standard behavior)
13. After Wave 2 completes, `develop-feature` updates the scratchpad and proceeds to Wave 3
14. Wave 3 has multiple slices -- parallel Agent subagents are spawned again
15. Process repeats until all waves are complete
16. `develop-feature` updates `## Status:` to `implementing wave N/M` as each wave starts (e.g., `implementing wave 2/3`)

**Postconditions**:
- All slices across all waves are committed
- The scratchpad shows all waves as `complete` and all slices as `DONE`
- `## Status:` shows the final state (ready for quality gates)
- Git history contains atomic commits (1 per slice), with parallel-mode commits including wave/sibling info in the commit message
- `develop-feature` proceeds to Phase 3 (quality gates) or Phase 2.5 (refactor cleanup)

### Alternative Flows

- **UC-2-A1: Single-slice wave** -- A wave contains exactly one slice
  1. `develop-feature` reads the plan and finds that a wave (e.g., Wave 2) contains only one slice
  2. `develop-feature` executes this slice via the existing `/implement-slice` workflow directly (no subagent spawning)
  3. Standard behavior applies: TDD flow, scratchpad update, commit
  4. After the slice completes, `develop-feature` updates the scratchpad with the result and proceeds to the next wave

- **UC-2-A2: No Wave fields in plan** -- Legacy plan or planner omitted wave assignment
  1. `develop-feature` reads the plan and finds no `Wave: N` fields on any slice
  2. `develop-feature` treats the plan as fully sequential: each slice is implicitly its own wave (Slice 1 = Wave 1, Slice 2 = Wave 2, ..., Slice N = Wave N)
  3. Execution proceeds identically to the pre-feature behavior: one slice at a time, standard `/implement-slice` invocation, standard scratchpad updates
  4. No parallel Agent subagents are spawned
  5. The scratchpad uses flat list format (no `### Wave N` subheadings) per UC-4-A1

### Error Flows

- **UC-2-E1: One subagent fails, siblings succeed** -- Partial wave failure
  1. `develop-feature` spawns parallel subagents for a multi-slice wave (e.g., Slices 1, 3, 5 in Wave 1)
  2. Subagent for Slice 3 fails after exhausting its retry budget (3 retries, per FR-6.1)
  3. Subagents for Slices 1 and 5 complete successfully and commit their changes
  4. `develop-feature` waits for all subagents to finish (does NOT abort the wave when Slice 3 fails -- per FR-6.2)
  5. After all subagents complete, `develop-feature` collects the results
  6. Successful commits from Slices 1 and 5 are KEPT, not rolled back (per FR-6.4 -- wave design guarantees file-level isolation)
  7. `develop-feature` updates the scratchpad: Slices 1 and 5 marked DONE, Slice 3 marked FAILED with the error details, Wave 1 status set to `failed`
  8. `develop-feature` reports all failures to the user with slice numbers, error categories (per deviation rules), and retry counts
  9. `develop-feature` presents escalation options: (a) retry the failed slice(s) only, (b) abort the remaining waves, or (c) continue with remaining waves and address failures later (per FR-6.5)
  10. `develop-feature` waits for user input

- **UC-2-E2: All subagents in a wave fail** -- Complete wave failure
  1. `develop-feature` spawns parallel subagents for a multi-slice wave
  2. All subagents fail after exhausting their individual retry budgets
  3. No commits are made for this wave
  4. `develop-feature` updates the scratchpad: all slices in the wave marked FAILED, wave status set to `failed`
  5. `develop-feature` reports the failure as a blocker in the scratchpad (per scratchpad rules)
  6. `develop-feature` reports all failures together with their error details
  7. `develop-feature` presents escalation options: (a) retry all failed slices, (b) abort the remaining waves
  8. `develop-feature` waits for user input

### Edge Cases

- **UC-2-EC1: User chooses to retry failed slice after partial wave success** -- Recovery from UC-2-E1
  1. After a partial wave failure (UC-2-E1), the user selects option (a): retry the failed slice(s) only
  2. `develop-feature` spawns a subagent for only the failed slice (Slice 3 in the example)
  3. The retry subagent receives the same slice context as the original attempt
  4. The retry subagent has a fresh retry budget (3 retries)
  5. If the retry succeeds, `develop-feature` updates the scratchpad: Slice 3 marked DONE, Wave 1 status updated to `complete`
  6. `develop-feature` proceeds to the next wave
  7. If the retry fails again, `develop-feature` re-presents the escalation options

- **UC-2-EC2: User chooses to skip failed slice and proceed to next wave** -- Continuing past failure
  1. After a partial wave failure (UC-2-E1), the user selects option (c): continue with remaining waves and address failures later
  2. `develop-feature` leaves the failed slice marked as FAILED in the scratchpad
  3. `develop-feature` proceeds to the next wave
  4. If subsequent waves depend on the failed slice's output (which should not happen if wave assignment is correct, since dependencies are in earlier waves), those slices will also fail
  5. After all remaining waves complete, `develop-feature` reports the outstanding failures before proceeding to quality gates
  6. The user must address failed slices before the feature can pass quality gates

- **UC-2-EC3: Subagent spawn failure** -- Claude Code's Agent tool fails to spawn a subagent
  1. `develop-feature` attempts to spawn a parallel subagent for a slice in a multi-slice wave
  2. The Agent tool fails (context limits, tool error, or infrastructure issue)
  3. `develop-feature` treats this as a slice failure with error category "spawn failure"
  4. Other subagents in the wave continue executing (the failed spawn does not abort siblings)
  5. After the wave completes, `develop-feature` includes the spawn failure in its failure report
  6. The user can retry the failed spawn via escalation option (a)

- **UC-2-EC4: Wave with 5+ slices** -- Large parallel wave
  1. The plan contains a wave with 5 or more slices (all file-independent)
  2. `develop-feature` spawns 5+ parallel subagents simultaneously
  3. All subagents execute concurrently, each with its own retry budget
  4. `develop-feature` waits for all to complete before proceeding
  5. The behavior is identical to a 2-slice wave, just with more subagents

### Data Requirements

- **Input**: Implementation plan with slices grouped by `Wave: N` fields; the project's source code on disk; the initialized scratchpad
- **Output**: Committed code changes for each slice; updated scratchpad with wave-level and slice-level status; escalation prompts for any failures
- **Side Effects**: Git commits (1 per successful slice); scratchpad updates (orchestrator-only during parallel waves); potential user interaction on failure

---

## UC-3: implement-slice in Parallel Mode

**Actor**: `implement-slice` command running as a subagent within a parallel wave
**Preconditions**:
- `develop-feature` has spawned this instance as a parallel Agent subagent
- The spawn prompt includes: slice number, `Files:`, `Changes:`, `Verify:`, `Done when:`, wave number, sibling slice numbers, and an explicit instruction to skip scratchpad writes
- The feature branch is checked out
- No other subagent in this wave touches any file in this slice's `Files:` list (guaranteed by wave assignment)

**Trigger**: The Agent subagent is spawned by `develop-feature` with the full slice context

### Primary Flow (Happy Path) -- Parallel subagent execution

1. `implement-slice` receives the slice context from the spawn prompt, including wave number and sibling slice numbers
2. `implement-slice` identifies the slice: reads `Files:`, `Changes:`, `Verify:`, and `Done when:` fields directly from the spawn prompt (no need to read the plan file)
3. `implement-slice` executes the standard TDD flow:
   a. Test-writer agent writes tests based on the `Done when:` condition
   b. Implementing agent makes the code changes per the `Changes:` field to the files in the `Files:` field
   c. The `Verify:` command is run to confirm the changes work
   d. The `Done when:` condition is checked
4. All verification passes and the `Done when:` condition is met
5. `implement-slice` creates an atomic commit with a message that includes wave/sibling context (e.g., `feat(core): add verifier agent prompt [wave 2, siblings: 2,4]`)
6. `implement-slice` does NOT write to `.claude/scratchpad.md` (the orchestrator handles scratchpad updates)
7. `implement-slice` returns success to the orchestrator with the commit hash and a summary of changes

**Postconditions**:
- The slice's code changes are committed to the feature branch
- The commit message includes wave number and sibling slice numbers
- `.claude/scratchpad.md` is NOT modified by this instance
- The return value to the orchestrator includes success status, commit hash, and change summary

### Alternative Flows

- **UC-3-A1: implement-slice invoked directly (not as subagent)** -- Standalone execution, no wave context
  1. A developer or `develop-feature` invokes `/implement-slice` without wave context in the prompt (no wave number, no sibling slice numbers, no scratchpad-skip instruction)
  2. `implement-slice` detects the absence of wave context
  3. `implement-slice` executes the standard TDD flow identically to pre-feature behavior
  4. The commit message uses the standard format without wave/sibling suffix (e.g., `feat(core): add verifier agent prompt`)
  5. `implement-slice` updates `.claude/scratchpad.md` with the slice result (standard behavior)
  6. `implement-slice` auto-continues to the next slice or reports completion (standard behavior)
  7. No behavioral change from current pipeline

### Error Flows

- **UC-3-E1: Verification fails during parallel execution** -- The `Verify:` command fails
  1. `implement-slice` completes code changes but the `Verify:` command fails
  2. `implement-slice` applies deviation rules (UC-2 from pipeline-hardening use cases) to classify and handle the error
  3. The slice has its own independent retry budget (3 retries, per FR-6.1)
  4. Rule 1 and Rule 2 fixes are applied for free (no retry cost)
  5. Rule 3 fixes consume retries from this slice's budget
  6. If the retry budget is exhausted, `implement-slice` returns failure to the orchestrator with the error details, error category, and retry count
  7. The orchestrator handles the failure per UC-2-E1 or UC-2-E2

- **UC-3-E2: Rule 4 error during parallel execution** -- Architectural decision needed
  1. During parallel execution, `implement-slice` encounters a Rule 4 error (requires changing module boundaries, altering public API, etc.)
  2. `implement-slice` cannot escalate to the user directly (it is a subagent)
  3. `implement-slice` returns failure to the orchestrator with the full Rule 4 context: the decision needed, the options, and the tradeoffs
  4. The orchestrator collects this and presents it to the user during the post-wave escalation (UC-2-E1)

### Edge Cases

- **UC-3-EC1: Two subagents attempt to commit simultaneously** -- Git commit ordering
  1. Two subagents in the same wave finish at approximately the same time
  2. Both attempt to create a git commit
  3. Git handles sequential commit creation (commits are atomic operations)
  4. The commit ordering in git history is non-deterministic for same-wave slices
  5. This is acceptable because same-wave slices are file-independent by design -- commit order does not affect correctness
  6. The wave number and sibling info in commit messages provide traceability

- **UC-3-EC2: Subagent reads a file it does not own** -- Read-only access to shared files
  1. A subagent needs to READ a file that is in another sibling's `Files:` list (e.g., to understand an interface definition)
  2. Reading is safe -- only concurrent WRITES cause conflicts
  3. The subagent reads the file in its pre-modification state (the sibling may or may not have modified it yet, depending on timing)
  4. This is acceptable because wave assignment guarantees the subagent does not WRITE to files in the sibling's `Files:` list
  5. If the subagent needs the sibling's modifications to that file, this indicates a logical dependency that should have been caught during wave assignment (UC-1-E1) or Plan Critic validation (UC-5-E2)

### Data Requirements

- **Input**: Slice context from spawn prompt (slice number, `Files:`, `Changes:`, `Verify:`, `Done when:`, wave number, sibling slice numbers, scratchpad-skip instruction); the project's source code on disk
- **Output**: Success (commit hash, change summary) or failure (error details, error category, retry count) returned to the orchestrator
- **Side Effects**: Git commit (on success); file modifications per the `Changes:` field; NO scratchpad writes in parallel mode

---

## UC-4: Scratchpad Wave Tracking

**Actor**: Orchestrator (`develop-feature` command) managing `.claude/scratchpad.md`
**Preconditions**:
- An implementation plan exists with slices that have `Wave: N` fields (or without, for legacy plans)
- `.claude/scratchpad.md` exists (created during `/bootstrap-feature`)
- The orchestrator is the sole writer to the scratchpad during parallel wave execution

**Trigger**: `/bootstrap-feature` initializes the scratchpad with the plan, or `develop-feature` completes a wave and updates the scratchpad

### Primary Flow (Happy Path) -- Wave-grouped scratchpad initialization and updates

1. `/bootstrap-feature` reads the planner's output and detects `Wave: N` fields on slices
2. `/bootstrap-feature` initializes the `## Plan` section of the scratchpad with `### Wave N` subheadings, grouping slices under their assigned waves
3. Each wave subheading includes a wave-level status: `pending`
4. Within each wave group, slices are listed with their individual status: `pending`
5. `## Status:` is set to `implementing wave 1/M` (where M is the total number of waves)
6. `develop-feature` begins executing waves
7. When Wave 1 starts, the orchestrator updates `### Wave 1` status to `in progress`
8. As each slice in Wave 1 returns success, the orchestrator marks that slice as `DONE`
9. When all slices in Wave 1 are DONE, the orchestrator updates `### Wave 1` status to `complete`
10. The orchestrator updates `## Status:` to `implementing wave 2/M` and proceeds

Example scratchpad format:
```
## Status: implementing wave 2/3

## Plan

### Wave 1 (complete)
1. Slice 1 description — DONE (commit abc123)
3. Slice 3 description — DONE (commit def456)

### Wave 2 (in progress)
2. Slice 2 description — IN PROGRESS

### Wave 3 (pending)
4. Slice 4 description — pending
5. Slice 5 description — pending
```

**Postconditions**:
- The scratchpad reflects the wave-grouped plan structure
- Wave-level statuses accurately track progress (pending, in progress, complete, failed)
- Individual slice statuses are maintained within each wave group
- `## Status:` shows `implementing wave N/M` during execution

### Alternative Flows

- **UC-4-A1: Legacy plan -- flat list under implicit sequential waves** -- Plan has no `Wave: N` fields
  1. `/bootstrap-feature` reads the planner's output and finds no `Wave: N` fields on any slice
  2. `/bootstrap-feature` initializes the scratchpad with the current flat list format (no `### Wave N` subheadings)
  3. Slices are listed sequentially with their individual status: `pending`
  4. `## Status:` uses the existing `implementing slice N/M` format
  5. No behavioral change from pre-feature scratchpad format
  6. `develop-feature` updates slices one at a time using the existing format

### Error Flows

- **UC-4-E1: Scratchpad exceeds 100 lines** -- Completed waves must be archived
  1. During a feature with many waves and slices, the scratchpad grows beyond 100 lines
  2. Per scratchpad rules, the orchestrator must archive completed content
  3. Completed waves are moved to the `## Archive` section as a unit (the entire `### Wave N (complete)` block, including all its slices, is moved)
  4. Only in-progress and pending waves remain in the `## Plan` section
  5. The `## Archive` section preserves the wave structure for historical reference

### Edge Cases

- **UC-4-EC1: Partial wave failure** -- Some slices in a wave succeed, some fail
  1. Wave 1 has Slices 1, 3, and 5
  2. Slices 1 and 5 succeed; Slice 3 fails
  3. The orchestrator updates the scratchpad:
     - Slice 1: `DONE (commit abc123)`
     - Slice 3: `FAILED — [error category]: [brief error description]`
     - Slice 5: `DONE (commit ghi789)`
     - `### Wave 1` status: `failed`
  4. The wave remains in the `## Plan` section (not archived) because it is not fully complete
  5. If the user retries Slice 3 and it succeeds, the orchestrator updates Slice 3 to `DONE` and Wave 1 status to `complete`

- **UC-4-EC2: Context refresh reads wave-grouped scratchpad** -- `context-refresh` extracts wave progress
  1. A developer runs `/context-refresh` mid-feature
  2. `context-refresh` detects `### Wave N` subheadings in the scratchpad
  3. `context-refresh` displays progress grouped by wave: wave number, wave status, N/M slices complete
  4. The developer sees which waves are done, which are in progress, and which are pending

### Data Requirements

- **Input**: Planner output with `Wave: N` fields (or without); subagent results (success/failure per slice); current scratchpad content
- **Output**: Updated `.claude/scratchpad.md` with wave-grouped plan, wave-level statuses, and slice-level statuses
- **Side Effects**: `.claude/scratchpad.md` is modified. During parallel wave execution, ONLY the orchestrator writes to the scratchpad (subagents are prohibited from writing).

---

## UC-5: Plan Critic Wave Validation

**Actor**: Plan Critic (launched as a subagent during the mandatory critic pass before plan approval)
**Preconditions**:
- An implementation plan has been written by the planner agent
- The plan includes `Wave: N` fields on slices (or does not, for legacy plans)
- The Plan Critic prompt in `src/claude.md` includes the "Wave Assignment Validation" section
- The Plan Critic has access to the plan file, the PRD, and the project's CLAUDE.md

**Trigger**: The Plan Critic is spawned to review the implementation plan

### Primary Flow (Happy Path) -- Valid wave assignments

1. The Plan Critic reads the implementation plan and finds `Wave: N` fields on all slices
2. The critic begins the "Wave Assignment Validation" checks (after the existing "Slice Quality" checks)
3. **File overlap check**: For each wave, the critic collects the `Files:` lists of all slices in that wave and verifies zero intersection. No overlaps found.
4. **Dependency ordering check**: For each slice, the critic checks whether its `Done when:` condition references output from another slice. If so, the referencing slice must be in a later wave than the referenced slice. All dependency orderings are correct.
5. **Contiguous wave numbers check**: The critic verifies that wave numbers form a contiguous sequence starting at 1 (1, 2, 3, ...) with no gaps. Wave numbers are contiguous.
6. **Consistent wave fields check**: The critic verifies that every slice has a `Wave:` field (no mixed plans with some slices having waves and some not). All slices have `Wave:` fields.
7. All wave validation checks pass
8. The VERIFIED section of the critic's output includes: "Wave Assignment Validation: file overlap, dependency ordering, contiguous numbering, consistent fields"

**Postconditions**:
- No wave-related findings are generated
- The plan's wave assignments are validated as safe for parallel execution
- The critic proceeds to the remaining checks (scope reduction detection, etc.)

### Alternative Flows

- **UC-5-A1: Legacy plan without Wave fields** -- No wave validation needed
  1. The Plan Critic reads the implementation plan and finds no `Wave: N` fields on any slice
  2. The critic skips the "Wave Assignment Validation" checks entirely
  3. No wave-related findings are generated (neither positive nor negative)
  4. The VERIFIED section notes: "Wave Assignment Validation: skipped (no Wave fields in plan)"
  5. All other critic checks proceed normally

### Error Flows

- **UC-5-E1: File overlap detected in same wave** -- CRITICAL finding
  1. The critic checks file overlap within Wave 2 and finds that Slice 3 and Slice 5 both list `src/routes/api.ts` in their `Files:` fields
  2. The critic generates a CRITICAL finding:
     - Category: "Wave Assignment -- File Overlap"
     - Severity: CRITICAL
     - Description: "Slices 3 and 5 are both in Wave 2 but share file `src/routes/api.ts`. Parallel execution will cause write conflicts."
     - Affected: Wave 2, Slices 3 and 5
     - Recommendation: "Move Slice 5 to Wave 3 (after Slice 3 completes)"
  3. The finding is included in the FINDINGS section of the critic's output
  4. The plan author MUST fix this finding before the plan is approved (CRITICAL findings are non-negotiable)

- **UC-5-E2: Dependency ordering violated** -- CRITICAL finding
  1. The critic checks dependency ordering and finds that Slice 4 (Wave 1) has a `Done when:` condition that references output from Slice 2 (also Wave 1, or Wave 2)
  2. Specifically: Slice 4's `Done when:` says "UserValidator returns correct results" but `UserValidator` is created by Slice 2
  3. The critic generates a CRITICAL finding:
     - Category: "Wave Assignment -- Dependency Ordering"
     - Severity: CRITICAL
     - Description: "Slice 4 (Wave 1) depends on output from Slice 2 (Wave 1/2). Slice 4 must be in a later wave than Slice 2."
     - Affected: Slice 4, Slice 2
     - Recommendation: "Move Slice 4 to a wave after Slice 2's wave"
  4. The plan author MUST fix this finding before the plan is approved

- **UC-5-E3: Non-contiguous wave numbers** -- MAJOR finding
  1. The critic checks wave numbering and finds waves 1, 2, and 4 (wave 3 is missing)
  2. The critic generates a MAJOR finding:
     - Category: "Wave Assignment -- Non-Contiguous Numbering"
     - Severity: MAJOR
     - Description: "Wave numbers are not contiguous: found waves 1, 2, 4. Wave 3 is missing."
     - Recommendation: "Renumber waves to be contiguous: 1, 2, 3"
  3. The plan author should fix this finding (MAJOR findings should be addressed)

- **UC-5-E4: Mixed plan -- some slices have Wave fields, some do not** -- MAJOR finding
  1. The critic checks field consistency and finds that Slices 1, 2, and 3 have `Wave: N` fields but Slices 4 and 5 do not
  2. The critic generates a MAJOR finding:
     - Category: "Wave Assignment -- Inconsistent Fields"
     - Severity: MAJOR
     - Description: "Mixed wave assignments: Slices 1, 2, 3 have Wave fields but Slices 4, 5 do not. All slices must either have Wave fields or none should."
     - Recommendation: "Add Wave fields to Slices 4 and 5, or remove Wave fields from all slices"
  3. The plan author should fix this finding

### Edge Cases

- **UC-5-EC1: Single-slice waves are valid** -- A wave contains exactly one slice
  1. The critic finds that Wave 3 contains only Slice 6
  2. Single-slice waves are valid (they represent sequential dependencies that cannot be parallelized)
  3. No finding is generated for single-slice waves

- **UC-5-EC2: File path case sensitivity** -- `src/Api.ts` vs `src/api.ts`
  1. The critic performs file overlap checks
  2. Two slices list files that differ only in case (e.g., `src/Api.ts` and `src/api.ts`)
  3. On case-insensitive file systems (macOS default), these are the same file
  4. The critic should flag this as a potential overlap with a note about case sensitivity

- **UC-5-EC3: New file marked [new] appears in multiple waves** -- A file is created in one wave and modified in a later wave
  1. Slice 1 (Wave 1) lists `src/types.ts [new]` in its `Files:` field
  2. Slice 4 (Wave 2) lists `src/types.ts` in its `Files:` field (modification of the file created in Wave 1)
  3. This is valid -- the file is created in Wave 1 and modified in Wave 2 (sequential waves)
  4. The critic verifies that Wave 2 is after Wave 1 (dependency ordering is respected)
  5. If both slices were in the same wave, this would be a CRITICAL file overlap finding

### Data Requirements

- **Input**: The implementation plan with all slices and their `Files:`, `Changes:`, `Verify:`, `Done when:`, and `Wave: N` fields; the PRD for scope context
- **Output**: Zero or more findings (CRITICAL or MAJOR) related to wave assignment validation; entries in the VERIFIED section for checks that passed
- **Side Effects**: None -- the critic is read-only. Findings are reported to the plan author who must address CRITICAL and MAJOR findings before plan approval.
