# Product Requirements Document

This document captures feature requirements for the Claude Code SDLC project. Each feature gets a numbered section. Sections are append-only -- do not remove completed features, mark them as `[SHIPPED]` instead.

---

## 1. Pipeline Hardening — Verification, Deviation Rules, Executable Plans

**Status:** [SHIPPED]
**Date:** 2026-04-08
**Priority:** High

### 1.1 Description

Add four mechanisms to the Claude Code SDLC pipeline that address gaps in verification depth, error handling intelligence, plan precision, and scope integrity in the current v2.1.0 setup.

**Why:** The current pipeline verifies that code compiles and tests pass, but does not verify that features are actually wired together and functional end-to-end. Error recovery is a flat retry loop with no categorization. Implementation plans allow vague slice descriptions that cause interpretation drift. The Plan Critic does not detect scope reduction -- where an implementer silently downgrades a feature from what the PRD specifies.

### 1.2 User Story

As a developer using the Claude Code SDLC pipeline, I want the agents to catch wiring gaps before merge, recover from errors intelligently based on severity, produce unambiguous implementation plans, and flag scope reduction during planning -- so that features ship complete and correct on the first pass.

### 1.3 Functional Requirements

#### FR-1: Goal-Backward Verification (new `verifier` agent)

A new agent (`verifier`) that verifies features actually work by checking four levels of integration, not just compilation and test passage.

1. **FR-1.1:** The `verifier` agent MUST check **Level 1 -- File Existence**: all files referenced in the implementation plan exist on disk.
2. **FR-1.2:** The `verifier` agent MUST check **Level 2 -- No Stubs/Placeholders**: no file contains TODO, FIXME, placeholder, stub, or "not implemented" markers in production code paths (test files excluded).
3. **FR-1.3:** The `verifier` agent MUST check **Level 3 -- Wiring**: exports are imported where expected, routes are registered in the router, components are rendered in their parent, middleware is applied to relevant endpoints.
4. **FR-1.4:** The `verifier` agent MUST check **Level 4 -- Data Flow**: real data paths are connected end-to-end (e.g., a form submission reaches the API handler, the handler calls the service, the service calls the database layer).
5. **FR-1.5:** The `verifier` agent MUST produce a structured report with PASS/FAIL per level and specific findings for each failure.
6. **FR-1.6:** The `verifier` agent MUST be wired into `/merge-ready` as a new gate (Gate 5.5, between E2E Tests and Documentation Accuracy -- or renumbered appropriately).
7. **FR-1.7:** The `verifier` agent prompt MUST be a standalone markdown file at `src/agents/verifier.md` with frontmatter (`name`, `description`, `tools`, `model`) matching the existing agent format.
8. **FR-1.8:** The agent table in `src/claude.md` MUST include the `verifier` agent with its role and responsibility.

#### FR-2: Deviation Rules (augmented error recovery)

Replace the flat "retry 3 times" error recovery strategy with graduated autonomy rules that categorize errors by severity and prescribe specific responses.

1. **FR-2.1:** **Rule 1 -- Auto-fix typos and imports.** When a typecheck or build error is caused by a typo, missing import, wrong import path, or unused import, the agent MUST fix it automatically without counting toward the retry budget.
2. **FR-2.2:** **Rule 2 -- Auto-add missing validation/error handling.** When a code review or security audit flags missing input validation, missing error handling, or missing null checks, the agent MUST add the fix automatically without counting toward the retry budget.
3. **FR-2.3:** **Rule 3 -- Auto-resolve dependency/config issues.** When a build fails due to a missing dependency, wrong version, or misconfigured environment variable, the agent MUST attempt resolution (install dependency, fix config) automatically. This counts as 1 retry attempt.
4. **FR-2.4:** **Rule 4 -- Escalate architectural decisions.** When a failure requires changing module boundaries, altering the public API surface, modifying database schemas beyond what the plan specifies, or making a design tradeoff, the agent MUST stop and escalate to the user with a clear description of the decision needed, the options available, and the tradeoffs of each.
5. **FR-2.5:** The existing mid-slice verification behavior (typecheck after every 3 file edits when a slice touches 4+ files) MUST be preserved unchanged.
6. **FR-2.6:** The retry budget (max 3 retries before escalation) MUST still apply to Rule 3 and Rule 4 categories. Rules 1 and 2 are "free" fixes that do not consume retries.
7. **FR-2.7:** `src/rules/error-recovery.md` MUST contain all four deviation rules with clear error categorization examples for each rule.

#### FR-3: Executable Plan Format (planner output)

Require the planner agent to produce slices with structured, machine-readable fields that eliminate interpretation drift during implementation.

1. **FR-3.1:** Each slice in the planner's output MUST include a `Files:` field listing exact file paths (existing files verified via Glob, new files marked `[new]`).
2. **FR-3.2:** Each slice MUST include a `Changes:` field describing the specific change to make in each listed file (not just "update X" but "add function Y that does Z" or "register route /api/foo in the router").
3. **FR-3.3:** Each slice MUST include a `Verify:` field containing the exact shell command(s) to run for verification (e.g., `npm run typecheck && npm test -- --grep "feature-name"`).
4. **FR-3.4:** Each slice MUST include a `Done when:` field with a testable boolean condition (e.g., "GET /api/users returns 200 with a JSON array" -- not "users endpoint works").
5. **FR-3.5:** The planner agent prompt (`src/agents/planner.md`) MUST be updated to require this format in its Output Format section.
6. **FR-3.6:** The `/implement-slice` command (`src/commands/implement-slice.md`) MUST be updated so that "Identify the Slice" reads the `Files:`, `Changes:`, `Verify:`, and `Done when:` fields directly from the plan instead of restating the slice in prose.

#### FR-4: Scope Reduction Detection (Plan Critic enhancement)

Add a new check to the Plan Critic that detects hedging language indicating the implementer is silently reducing scope below what the PRD specifies.

1. **FR-4.1:** The Plan Critic MUST scan all slice descriptions, done-conditions, and implementation notes for hedging language including but not limited to: "v1", "basic version", "simplified", "placeholder", "for now", "future enhancement", "out of scope for now", "minimal implementation", "stubbed out", "hardcoded for now".
2. **FR-4.2:** When hedging language is found AND the corresponding feature is marked as in-scope in the PRD, the critic MUST flag it as a **MAJOR** finding with the category "Scope Reduction".
3. **FR-4.3:** The finding MUST identify the specific hedging phrase, the slice where it appears, and the PRD requirement it violates.
4. **FR-4.4:** The Plan Critic prompt in `src/claude.md` MUST include the Scope Reduction Detection check as a named section under the critic's checks.

### 1.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files only. There is no runtime code in this project -- no JavaScript, TypeScript, Python, or shell scripts are modified (except `install.sh` if the new agent file needs to be included in the install manifest).
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Projects already using Claude Code SDLC v2.1.0 MUST continue to function after upgrading. No existing agent, command, or rule behavior is removed -- only augmented.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). No migration steps required beyond re-running the installer.
4. **NFR-4:** The `verifier` agent MUST use the `opus` model (consistent with all existing agents including `build-runner`). Architecture review overrode the original `sonnet` proposal — all 13 agents use the same model tier for consistency.
5. **NFR-5:** The total agent count increases from 12 to 13. All references to "12 agents" in `README.md` and `src/claude.md` MUST be updated to 13.

### 1.5 Acceptance Criteria

1. **AC-1:** A file `src/agents/verifier.md` exists with valid frontmatter (`name: verifier`, `description`, `tools`, `model`) and a prompt that implements the 4-level verification described in FR-1.1 through FR-1.4.
2. **AC-2:** `src/commands/merge-ready.md` contains a new gate that delegates to the `verifier` agent. The gate's checklist references all four verification levels. The gate appears in the output format table.
3. **AC-3:** `src/rules/error-recovery.md` contains four numbered deviation rules matching FR-2.1 through FR-2.4. Each rule includes at least two concrete error examples. The mid-slice verification section is preserved verbatim.
4. **AC-4:** `src/agents/planner.md` Output Format section requires `Files:`, `Changes:`, `Verify:`, and `Done when:` fields per slice. The existing constraints section is preserved.
5. **AC-5:** `src/commands/implement-slice.md` "Identify the Slice" step references the executable plan fields (`Files:`, `Changes:`, `Verify:`, `Done when:`) and uses them directly.
6. **AC-6:** The Plan Critic prompt in `src/claude.md` includes a "Scope Reduction Detection" check that scans for hedging language and flags MAJOR findings when in-scope features are reduced.
7. **AC-7:** The agent table in `src/claude.md` includes a row for the `verifier` agent with role "Verification Engineer" and responsibility description.
8. **AC-8:** `README.md` references to "12 agents" are updated to "13 agents". The agent table in the README includes the `verifier` agent. The pipeline diagram in the README shows the verifier gate in the `/merge-ready` section.
9. **AC-9:** All cross-references between agents, commands, and rules are valid -- no agent is referenced that does not have a corresponding `.md` file, no command references a gate that does not exist, no rule references behavior that is not implemented in the relevant agent or command.

### 1.6 Affected Components

#### New Files

| File | Purpose |
|------|---------|
| `src/agents/verifier.md` | Goal-backward verification agent prompt (FR-1) |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/commands/merge-ready.md` | Add verifier gate between E2E Tests and Documentation Accuracy gates; update output format table | FR-1.6 |
| `src/commands/implement-slice.md` | Update "Identify the Slice" to read executable plan fields directly | FR-3.6 |
| `src/agents/planner.md` | Add `Files:`, `Changes:`, `Verify:`, `Done when:` to Output Format; update slice format requirements | FR-3.1 through FR-3.5 |
| `src/rules/error-recovery.md` | Replace flat retry with 4 deviation rules; preserve mid-slice verification | FR-2.1 through FR-2.7 |
| `src/claude.md` | Add verifier to agent table; add Scope Reduction Detection to Plan Critic prompt | FR-1.8, FR-4.4, NFR-5 |
| `README.md` | Update agent count (12 to 13); add verifier to agent table; update pipeline diagram | NFR-5, AC-8 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | No changes to architecture review process |
| `src/agents/ba-analyst.md` | No changes to use case analysis |
| `src/agents/qa-planner.md` | No changes to QA test case generation |
| `src/agents/test-writer.md` | No changes to TDD test writing |
| `src/agents/security-auditor.md` | No changes to security audit process |
| `src/agents/code-reviewer.md` | No changes to code review process |
| `src/agents/build-runner.md` | No changes -- verifier is a separate gate, not an extension of build |
| `src/agents/e2e-runner.md` | No changes to E2E test process |
| `src/agents/doc-updater.md` | No changes to documentation update process |
| `src/agents/refactor-cleaner.md` | No changes to refactor cleanup process |
| `src/rules/git.md` | No changes to git workflow |
| `src/rules/scratchpad.md` | No changes to scratchpad rules |
| `src/rules/tool-limitations.md` | No changes to tool limitation awareness |
| `src/commands/bootstrap-feature.md` | No changes to bootstrap process |
| `src/commands/develop-feature.md` | No changes -- it delegates to merge-ready which will pick up the new gate |
| `src/commands/context-refresh.md` | No changes to context refresh |

### 1.7 UI Changes

Not applicable. This project is a collection of markdown prompt files with no user interface.

### 1.8 Schema Changes

Not applicable. This project has no database.

### 1.9 Affected Endpoints

Not applicable. This project has no API.

### 1.10 Risks and Dependencies

1. **Risk: Verifier false positives.** The Level 2 check (no stubs/placeholders) may flag legitimate uses of TODO in documentation or comments. Mitigation: scope the check to production code paths only, exclude test files and markdown documentation.
2. **Risk: Hedging language false positives.** Terms like "v1" or "basic" may appear in legitimate PRD descriptions of intentionally scoped features. Mitigation: the critic only flags hedging language as MAJOR when the PRD explicitly marks the feature as in-scope and the plan is reducing it.
3. **Risk: Executable plan format verbosity.** Requiring `Files:`, `Changes:`, `Verify:`, `Done when:` per slice increases planner output length. Mitigation: the planner already produces detailed slices; this structures existing content rather than adding new content.
4. **Risk: install.sh manifest.** The new `src/agents/verifier.md` file must be included in the install script's file copy list. If `install.sh` uses a glob pattern for `src/agents/*.md`, no change is needed. If it has an explicit file list, it must be updated.
5. **Dependency: No external dependencies.** All changes are self-contained within the project's markdown files.

---

## 2. Execution Waves — Parallel Slice Implementation

**Status:** [SHIPPED]
**Date:** 2026-04-08
**Priority:** Medium
**Related:** Section 1 (FR-3: Executable Plan Format, FR-2: Deviation Rules)

### 2.1 Description

Add wave-based parallelism to the implementation pipeline. Currently, implementation slices execute strictly sequentially (slice 1 completes before slice 2 starts). This feature allows the planner to assign slices to numbered waves based on file dependencies. Slices within the same wave touch completely disjoint sets of files and can therefore execute simultaneously via parallel subagent spawning. Wave N+1 starts only after every slice in wave N has completed.

**Why:** Features with 5-9 slices frequently contain 2-4 slices that are completely independent (e.g., adding a new API endpoint in one file while adding a new UI component in another). Sequential execution wastes time when these slices share no files. Wave-based parallelism preserves the safety guarantees of the current pipeline (no concurrent writes to the same file) while reducing wall-clock time for parallelizable work.

**Design Decisions:**
1. The planner assigns waves as a post-processing step -- it outputs all slices first (with existing `Files:`, `Changes:`, `Verify:`, `Done when:` fields from Section 1 FR-3), then assigns `Wave: N` to each slice based on file overlap analysis.
2. The `develop-feature` command orchestrates waves (spawning parallel Agent calls per wave). The `implement-slice` command remains single-slice -- it does not know about parallelism.
3. Scratchpad writes during parallel execution are orchestrator-only. Subagents do NOT update the scratchpad directly, preventing race conditions on the shared file.
4. On failure within a wave, successful sibling commits are kept. Because slices in the same wave touch disjoint files by design, a failure in one slice cannot corrupt another's committed work.
5. The feature is fully backward compatible. Plans without `Wave:` fields execute sequentially, identical to current behavior.

### 2.2 User Story

As a developer using the SDLC pipeline, I want independent slices to execute in parallel so that features with parallelizable work complete faster without sacrificing the safety guarantees of sequential file-level isolation.

### 2.3 Functional Requirements

#### FR-1: Planner Wave Assignment (planner output extension)

Extend the planner agent's output to include wave assignment as a post-processing step after all slices are defined.

1. **FR-1.1:** Each slice in the planner's output MUST include a `Wave: N` field (integer, 1-indexed) indicating which execution wave the slice belongs to.
2. **FR-1.2:** The planner MUST add a "Wave Assignment" section after the slice list that documents the assignment algorithm: (a) collect all `Files:` lists, (b) group slices whose file sets have zero intersection into the same wave, (c) slices that depend on earlier slices (via `Done when:` references or shared files) MUST be in a later wave.
3. **FR-1.3:** Wave 1 MUST contain only slices with no dependencies on other slices. Each subsequent wave MUST contain only slices whose dependencies are fully satisfied by earlier waves.
4. **FR-1.4:** The planner MUST output a wave summary table showing wave number, slice numbers in that wave, and the rationale (which files are disjoint).
5. **FR-1.5:** If all slices have file dependencies on each other (fully sequential), the planner MUST assign each slice to its own wave (Wave 1 through Wave N), which is equivalent to sequential execution.
6. **FR-1.6:** The `Wave:` field is added to the existing executable plan format alongside `Files:`, `Changes:`, `Verify:`, and `Done when:` (see Section 1 FR-3).

#### FR-2: Wave-Aware Orchestration (develop-feature Phase 2)

Modify the `develop-feature` command's Phase 2 (Implement All Slices) to detect and execute multi-slice waves in parallel.

1. **FR-2.1:** Before starting implementation, `develop-feature` MUST read the plan and group slices by their `Wave:` field. If no `Wave:` fields are present, all slices are treated as sequential (Wave 1, Wave 2, ..., Wave N -- one slice per wave).
2. **FR-2.2:** For each wave, if the wave contains a single slice, `develop-feature` MUST execute it via the existing `/implement-slice` workflow (no change from current behavior).
3. **FR-2.3:** For each wave, if the wave contains multiple slices, `develop-feature` MUST spawn one parallel Agent subagent per slice. All subagents in the wave execute simultaneously.
4. **FR-2.4:** `develop-feature` MUST wait for all subagents in wave N to complete before starting wave N+1.
5. **FR-2.5:** After all subagents in a wave complete, the orchestrator (`develop-feature`) MUST update the scratchpad with the results of every slice in that wave before proceeding to the next wave.
6. **FR-2.6:** Subagents spawned for parallel execution MUST NOT write to `.claude/scratchpad.md`. The orchestrator is the sole writer during parallel waves.
7. **FR-2.7:** Each parallel subagent MUST receive the full slice context (slice number, `Files:`, `Changes:`, `Verify:`, `Done when:`, wave number, sibling slice numbers in the same wave) in its spawn prompt.

#### FR-3: Implement-Slice Wave Context (implement-slice update)

Update `implement-slice` to accept and surface wave context without changing its single-slice execution model.

1. **FR-3.1:** `implement-slice` MUST remain a single-slice command. It does not spawn parallel agents or manage waves.
2. **FR-3.2:** When executed as a parallel subagent (wave context provided in spawn prompt), `implement-slice` MUST include the wave number and sibling slice numbers in its commit message suffix (e.g., `feat(core): slice 3 [wave 2, siblings: 2,4]`).
3. **FR-3.3:** When executed as a parallel subagent, `implement-slice` MUST skip scratchpad writes (the orchestrator handles scratchpad updates per FR-2.6).
4. **FR-3.4:** When executed standalone (no wave context), `implement-slice` MUST behave exactly as it does today, including scratchpad writes.

#### FR-4: Scratchpad Wave Format (scratchpad rules update)

Update scratchpad format to group slices under wave subheadings with wave-level status tracking.

1. **FR-4.1:** The `## Plan` section of the scratchpad MUST group slices under `### Wave N` subheadings when the plan includes wave assignments.
2. **FR-4.2:** Each wave subheading MUST include a wave-level status: `pending` (no slices started), `in progress` (at least one slice started), `complete` (all slices DONE), or `failed` (at least one slice failed).
3. **FR-4.3:** Within each wave group, individual slices retain their existing format (`DONE` / `IN PROGRESS` / `pending` / `FAILED`).
4. **FR-4.4:** When no wave assignments exist in the plan, the scratchpad MUST use the current flat list format (no `### Wave N` subheadings). This preserves backward compatibility.
5. **FR-4.5:** The `## Status:` field MUST support a new value: `implementing wave N/M` (e.g., `implementing wave 2/3`) in addition to the existing `implementing slice N/M`.

#### FR-5: Plan Critic Wave Validation (Plan Critic enhancement)

Add wave assignment validation to the Plan Critic's check suite.

1. **FR-5.1:** The Plan Critic MUST verify that no two slices in the same wave share any files in their `Files:` lists. Shared files within a wave is a **CRITICAL** finding (parallel writes to the same file will cause conflicts).
2. **FR-5.2:** The Plan Critic MUST verify that dependency ordering is respected across waves: if slice A's `Done when:` condition references output from slice B, then slice A MUST be in a later wave than slice B. Violation is a **CRITICAL** finding.
3. **FR-5.3:** The Plan Critic MUST verify that wave numbers are contiguous integers starting at 1 with no gaps. Non-contiguous wave numbers (e.g., Wave 1, Wave 3 with no Wave 2) is a **MAJOR** finding.
4. **FR-5.4:** The Plan Critic MUST verify that every slice has a `Wave:` field if any slice has one. Mixed plans (some slices with `Wave:`, some without) is a **MAJOR** finding.
5. **FR-5.5:** The wave validation checks MUST appear under a new "Wave Assignment Validation" section in the Plan Critic prompt, after the existing "Slice Quality" section.

#### FR-6: Parallel Wave Error Recovery (error recovery extension)

Extend error recovery rules to address failure scenarios specific to parallel wave execution.

1. **FR-6.1:** Each subagent in a parallel wave MUST have its own independent retry budget (3 retries per slice, not shared across the wave).
2. **FR-6.2:** When a subagent fails and exhausts its retry budget, the orchestrator MUST collect the failure details and continue waiting for other subagents in the same wave to complete (do not abort the entire wave on a single failure).
3. **FR-6.3:** After all subagents in a wave complete, if any failed, the orchestrator MUST report all failures together with their slice numbers, error categories (per Section 1 FR-2 deviation rules), and retry counts.
4. **FR-6.4:** Successful commits from sibling slices in the same wave MUST be kept, not rolled back. The wave design guarantees file-level isolation between siblings.
5. **FR-6.5:** The orchestrator MUST escalate to the user when any slice in a wave fails after retries, presenting the option to: (a) retry the failed slice(s) only, (b) abort the remaining waves, or (c) continue with remaining waves and address failures later.
6. **FR-6.6:** The error recovery rules MUST appear under a new "Parallel Wave Execution" section in `src/rules/error-recovery.md`, after the existing deviation rules.

#### FR-7: Bootstrap Wave Scratchpad Initialization (bootstrap-feature update)

Update `bootstrap-feature` to initialize the scratchpad with wave-grouped format when the planner outputs wave assignments.

1. **FR-7.1:** After the planner produces the implementation plan, `bootstrap-feature` MUST read the wave assignments and initialize the scratchpad's `## Plan` section with `### Wave N` subheadings.
2. **FR-7.2:** Each slice MUST be listed under its assigned wave with initial status `pending`.
3. **FR-7.3:** If the planner output has no `Wave:` fields, `bootstrap-feature` MUST initialize the scratchpad with the existing flat list format.

#### FR-8: Context Refresh Wave Support (context-refresh update)

Update `context-refresh` to extract and display wave-grouped progress.

1. **FR-8.1:** `context-refresh` MUST detect `### Wave N` subheadings in the scratchpad and display progress grouped by wave.
2. **FR-8.2:** Wave-level progress MUST show: wave number, wave status, number of slices complete vs. total in the wave.
3. **FR-8.3:** If no `### Wave N` subheadings exist, `context-refresh` MUST display progress in the existing flat format.

### 2.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files only. There is no runtime code in this project -- no JavaScript, TypeScript, Python, or shell scripts are modified (except `install.sh` if file copy logic needs updating and `README.md` for documentation accuracy).
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Plans without `Wave:` fields MUST execute sequentially, identical to pre-feature behavior. Scratchpads without `### Wave N` subheadings MUST render correctly. No existing behavior is removed -- only augmented.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). No migration steps required beyond re-running the installer.
4. **NFR-4:** Wave computation is optional. The planner MAY omit wave assignments (e.g., for very simple features where sequential execution is clearer). The system falls back gracefully to sequential execution.
5. **NFR-5:** The total agent count remains at 13. No new agents are introduced by this feature. The parallelism is orchestration-level (how existing agents are invoked), not agent-level.
6. **NFR-6:** Parallel subagent spawning relies on Claude Code's existing `Agent` tool capability. No new tooling or infrastructure is required.

### 2.5 Acceptance Criteria

1. **AC-1:** `src/agents/planner.md` Output Format section includes a `Wave: N` field in the per-slice format and a "Wave Assignment" post-processing section that documents the file-overlap algorithm and outputs a wave summary table.
2. **AC-2:** `src/commands/develop-feature.md` Phase 2 contains wave-aware orchestration logic: grouping slices by `Wave:` field, spawning parallel Agent subagents for multi-slice waves, waiting for wave completion before proceeding, and orchestrator-only scratchpad writes.
3. **AC-3:** `src/commands/implement-slice.md` includes wave context handling: commit message suffix with wave/sibling info when in parallel mode, scratchpad write skip when in parallel mode, and unchanged behavior when run standalone.
4. **AC-4:** `src/rules/scratchpad.md` defines the `### Wave N` subheading format with wave-level status tracking and explicitly states the fallback to flat list format when no wave assignments exist.
5. **AC-5:** The Plan Critic prompt in `src/claude.md` includes a "Wave Assignment Validation" section with CRITICAL-severity checks for file overlap within waves and dependency ordering across waves, and MAJOR-severity checks for non-contiguous wave numbers and mixed wave/no-wave plans.
6. **AC-6:** `src/rules/error-recovery.md` includes a "Parallel Wave Execution" section with independent retry budgets, failure isolation (no wave-wide abort), result collection, commit preservation for successful siblings, and escalation options.
7. **AC-7:** Plans without `Wave:` fields execute sequentially with no behavioral change from current pipeline. Scratchpads without `### Wave N` subheadings render in the existing flat format. This is verifiable by running the pipeline with a plan that has no wave assignments and confirming identical behavior.
8. **AC-8:** Subagents spawned during parallel wave execution do NOT write to `.claude/scratchpad.md`. The orchestrator (`develop-feature`) is the sole scratchpad writer during parallel waves. This is verifiable by inspecting the subagent spawn prompt for the scratchpad-skip instruction and the orchestrator logic for the post-wave scratchpad update.
9. **AC-9:** `src/commands/bootstrap-feature.md` initializes wave-grouped scratchpad format from planner output when wave assignments are present, and falls back to flat list format when they are not.
10. **AC-10:** `src/commands/context-refresh.md` extracts and displays wave-grouped progress when `### Wave N` subheadings exist, and falls back to flat display when they do not.

### 2.6 Affected Components

#### New Files

None. This feature modifies existing prompt files only.

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/agents/planner.md` | Add `Wave: N` field to per-slice output format; add "Wave Assignment" post-processing section with file-overlap algorithm and wave summary table | FR-1.1 through FR-1.6 |
| `src/commands/develop-feature.md` | Rewrite Phase 2 to group slices by wave, spawn parallel Agent subagents for multi-slice waves, enforce orchestrator-only scratchpad writes | FR-2.1 through FR-2.7 |
| `src/commands/implement-slice.md` | Add wave context handling: commit message suffix for parallel mode, scratchpad write skip for parallel mode | FR-3.1 through FR-3.4 |
| `src/rules/scratchpad.md` | Add `### Wave N` subheading format, wave-level status values, `implementing wave N/M` status, legacy fallback documentation | FR-4.1 through FR-4.5 |
| `src/rules/error-recovery.md` | Add "Parallel Wave Execution" section with independent retry budgets, failure isolation, commit preservation, escalation options | FR-6.1 through FR-6.6 |
| `src/claude.md` | Add "Wave Assignment Validation" section to Plan Critic prompt | FR-5.1 through FR-5.5 |
| `src/commands/bootstrap-feature.md` | Add wave-grouped scratchpad initialization after planner output | FR-7.1 through FR-7.3 |
| `src/commands/context-refresh.md` | Add wave-grouped progress extraction and display | FR-8.1 through FR-8.3 |
| `README.md` | Document wave-based parallelism in pipeline description; update Phase 2 description to mention parallel execution | NFR documentation |
| `install.sh` | No file additions, but verify existing glob patterns still cover all modified files | NFR-3 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/verifier.md` | Verification runs in Phase 4 (quality gates), after all waves complete. No wave awareness needed. |
| `src/agents/architect.md` | Architecture review runs in Phase 1 (documentation), before waves exist. No change. |
| `src/agents/ba-analyst.md` | Use case analysis runs in Phase 1. No change. |
| `src/agents/qa-planner.md` | QA test case generation runs in Phase 1. No change. |
| `src/agents/prd-writer.md` | PRD writing runs in Phase 1. No change. |
| `src/agents/test-writer.md` | Test writing happens within individual slices, which are wave-unaware. No change. |
| `src/agents/security-auditor.md` | Security review runs in Phase 1.5 and Phase 4. No wave awareness needed. |
| `src/agents/code-reviewer.md` | Code review runs in Phase 4. No change. |
| `src/agents/build-runner.md` | Build verification runs in Phase 4. No change. |
| `src/agents/e2e-runner.md` | E2E tests run in Phase 4. No change. |
| `src/agents/doc-updater.md` | Documentation update runs in Phase 4. No change. |
| `src/agents/refactor-cleaner.md` | Cleanup runs in Phase 2.5, after all waves complete. No wave awareness needed. |
| `src/rules/git.md` | Git workflow rules unchanged. Atomic commits per slice are preserved. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. |
| `src/commands/merge-ready.md` | Quality gates run after all implementation is complete. No wave awareness needed. |

### 2.7 UI Changes

Not applicable. This project is a collection of markdown prompt files with no user interface.

### 2.8 Schema Changes

Not applicable. This project has no database.

### 2.9 Affected Endpoints

Not applicable. This project has no API.

### 2.10 Risks and Dependencies

1. **Risk: Scratchpad race condition.** If subagents write to the scratchpad concurrently, content will be lost or corrupted. Mitigation: FR-2.6 and FR-3.3 explicitly prohibit subagent scratchpad writes; the orchestrator is the sole writer (FR-2.5). The subagent spawn prompt must include an explicit instruction to skip scratchpad writes.
2. **Risk: Incorrect wave assignment (file overlap missed).** If the planner assigns two slices with overlapping files to the same wave, parallel execution will cause file conflicts. Mitigation: FR-5.1 adds a CRITICAL-severity Plan Critic check that verifies zero file overlap within each wave. The planner algorithm in FR-1.2 explicitly checks file set intersection.
3. **Risk: Implicit dependencies not captured by file overlap.** Two slices may touch different files but have a logical dependency (e.g., slice A creates a type that slice B imports). File-level overlap analysis would miss this. Mitigation: FR-1.3 requires the planner to consider `Done when:` references and dependency ordering, not just file overlap. FR-5.2 adds a CRITICAL-severity check for dependency ordering across waves. The planner's wave assignment section (FR-1.2) must document rationale.
4. **Risk: Backward compatibility regression.** Existing plans without `Wave:` fields could break if the new orchestration logic does not handle the absence correctly. Mitigation: FR-2.1 explicitly defines the fallback (no `Wave:` field = one slice per wave = sequential). AC-7 requires verification of identical behavior with wave-less plans.
5. **Risk: Subagent spawn failure.** Claude Code's Agent tool may fail to spawn a subagent due to context limits or tool errors. Mitigation: FR-6.2 requires the orchestrator to handle individual subagent failures without aborting the entire wave. FR-6.5 provides escalation options.
6. **Risk: Commit ordering ambiguity.** Parallel commits within a wave have no guaranteed ordering in git history. Mitigation: This is acceptable because wave-sibling slices are independent by design. The wave number and sibling info in commit messages (FR-3.2) provide traceability.
7. **Dependency: Section 1 FR-3 (Executable Plan Format).** Wave assignment depends on each slice having a `Files:` field to compute file overlap. If Section 1 FR-3 is not implemented, wave assignment cannot work. Section 1 is marked [SHIPPED], so this dependency is satisfied.
8. **Dependency: Claude Code Agent tool.** Parallel subagent spawning relies on Claude Code's built-in `Agent` tool for parallel execution. No external tooling is required.

---

## 3. Product Changelog Maintenance — Iteration 1: Content Sync

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-24
**Priority:** Medium
**Related:** Section 1 (FR-3: Executable Plan Format — the `Changelog:` field extends this), Section 2 (FR-2: Wave-Aware Orchestration — post-wave hook)

### 3.1 Description

Add automated maintenance of a user-facing `CHANGELOG.md` in downstream projects that install the Claude Code SDLC via `install.sh --init-project`. A new `changelog-writer` agent continuously syncs the `[Unreleased]` section of `CHANGELOG.md` with the actual state of the feature branch by reading the PRD, scratchpad, and `git log` and rewriting the section only when content has drifted. A new `Changelog:` field in every PRD section captures the intended user-facing message (or explicit opt-out).

**Why:** Downstream projects built with the SDLC ship features, but the product-facing release narrative is hand-written after the fact, goes stale, and frequently misses features that were planned but silently deferred, or includes internal refactors that product owners should not see. Automating the content of `[Unreleased]` as a side-effect of the existing pipeline removes manual curation, keeps the changelog truthful against `git log`, and gives product owners a live preview of what is shipping in the next release.

**Audience boundary:** `CHANGELOG.md` is for **product owners and end users** of downstream projects, NOT for developers of those projects. Only alpha/beta-level product features and product-level fixes are recorded. Internal work (refactors, test infrastructure, type cleanup, logging, metrics, CI tweaks) is excluded via the explicit `Changelog: skip — internal` opt-out on the PRD section.

**Scope boundary:** This section covers **Iteration 1: Content Maintenance ONLY**. Release packaging (version bump, tag, GitHub release) is deferred to a future iteration-2 PRD section. See section 3.8 "Out of Scope for Iteration 1".

**Design decisions:**
1. The changelog rule ships as `templates/rules/changelog.md`, copied into downstream projects only by `install.sh --init-project`. The SDLC repo itself does NOT maintain a `CHANGELOG.md` — placement under `templates/` (not `src/rules/`) scopes the rule to downstream projects.
2. The `changelog-writer` agent is installed globally (in `src/agents/`) and has a **self-check first step**: it reads `.claude/rules/changelog.md` in the project CWD; if absent, it returns "no-op: not configured" and performs no file writes. This is how the SDLC repo opts out automatically.
3. The `prd-writer` agent is updated to emit a `Changelog:` field in every PRD section with exactly two valid values: (a) a one-line user-facing description that becomes a changelog entry, or (b) the literal string `skip — internal` for explicit opt-out.
4. Sync is **continuous, not one-shot**. `changelog-writer` runs at four lifecycle points: after `/bootstrap-feature` step 5 (initial stub), after each `/implement-slice` commit (step 5, when running standalone — skipped in parallel subagent mode), after each wave completes in `/develop-feature` (orchestrator responsibility), and as a pre-flight safety-net sync at the start of `/merge-ready`.
5. Sync logic is **idempotent**. The agent reads PRD + `.claude/scratchpad.md` + `git log <branch-start>..HEAD` + current `CHANGELOG.md`, computes what `[Unreleased]` should be right now, diffs against the current file, and rewrites only if changed. Most invocations are no-ops.
6. **Source-of-truth priority**: commits (`git log`) → scratchpad → PRD. Commits are the only reliable truth about what actually shipped; the PRD states intent (which may have been deferred); the scratchpad states progress.
7. Format is **Keep a Changelog** ([keepachangelog.com](https://keepachangelog.com/)) with a persistent `[Unreleased]` section at the top and the standard categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
8. If `CHANGELOG.md` does not exist in the project CWD and the rule is present, the agent creates it with a Keep a Changelog header on its first non-skip invocation.
9. Total agent count rises from 13 to 14. References to "13 agents" in `README.md` and `src/claude.md` are updated.
10. `templates/CLAUDE.md` receives an optional `Version source:` placeholder field, documented as dead metadata in iteration 1 and consumed in iteration 2 for semver bumping. Kept in iteration 1 to avoid a second migration in downstream projects when iteration 2 ships.

### 3.2 User Story

As a product owner of a downstream project using the Claude Code SDLC, I want the `[Unreleased]` section of `CHANGELOG.md` to reflect the actual user-facing features on the current branch without manual curation, so that I can preview what the next release will deliver to end users at any time, without digging through commits or scratchpads, and without having to strip out internal engineering work that end users do not care about.

### 3.3 Functional Requirements

#### FR-1: Changelog Rule File (downstream-project scoped)

A new rule file installed only into downstream projects (via `install.sh --init-project`) that documents the changelog policy and serves as the self-check sentinel.

1. **FR-1.1:** A new file `templates/rules/changelog.md` MUST exist in the SDLC repo, containing: (a) the target audience statement (product owners and end users, NOT developers), (b) the Keep a Changelog format specification with the six standard categories (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), (c) the `[Unreleased]` section convention, (d) the inclusion rule (only PRD sections with a user-facing `Changelog:` value), and (e) the exclusion rule (internal work — refactors, tests, type cleanup, logging, metrics, CI — is never recorded).
2. **FR-1.2:** The file MUST be placed under `templates/rules/` (NOT `src/rules/`) so that `install.sh --init-project` is the only installer path that copies it into a downstream project. The SDLC repo itself MUST NOT install this rule into its own `.claude/rules/` directory.
3. **FR-1.3:** `install.sh --init-project` MUST copy `templates/rules/changelog.md` into the downstream project at `.claude/rules/changelog.md`. If the installer uses an explicit file list, it MUST be updated; if it uses a glob over `templates/rules/`, no installer code change is required but the glob coverage MUST be verified.
4. **FR-1.4:** The rule file MUST state that the presence of the file at `.claude/rules/changelog.md` is the sole signal the `changelog-writer` agent uses to decide whether to run. Absence = opt-out.

#### FR-2: Changelog-Writer Agent

A new agent that performs idempotent sync of the `[Unreleased]` section of `CHANGELOG.md` from the authoritative sources.

1. **FR-2.1:** A new file `src/agents/changelog-writer.md` MUST exist with frontmatter matching the existing agent format (`name: changelog-writer`, `description`, `tools`, `model: opus` for consistency with NFR-4 in section 1).
2. **FR-2.2:** The agent's first step MUST be a self-check: read `.claude/rules/changelog.md` in the project CWD. If the file does not exist, the agent MUST return the exact string `no-op: not configured` and MUST NOT perform any writes, MUST NOT create `CHANGELOG.md`, and MUST NOT fail the caller.
3. **FR-2.3:** When the rule file is present, the agent MUST read the following inputs in order: (a) `docs/PRD.md` (all in-development and recently-shipped sections and their `Changelog:` fields), (b) `.claude/scratchpad.md` (current feature, branch, slice progress), (c) `git log <branch-start>..HEAD` where `<branch-start>` is the merge-base of the current branch with `main`, (d) the current `CHANGELOG.md` if it exists.
4. **FR-2.4:** The agent MUST compute the intended `[Unreleased]` section using the source-of-truth priority: commits (git log) → scratchpad → PRD. Only work that has a corresponding commit is eligible for inclusion. PRD sections with `Changelog: skip — internal` MUST be excluded even if they have shipped commits.
5. **FR-2.5:** The agent MUST map each eligible entry to one of the six Keep a Changelog categories (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) using the PRD section's nature (new feature → `Added`, modified behavior → `Changed`, bug fix → `Fixed`, removal → `Removed`, deprecation → `Deprecated`, security fix → `Security`). When category is ambiguous, the agent MUST default to `Added` for new features and `Changed` for modifications and note the choice in its output.
6. **FR-2.6:** The agent MUST diff the computed `[Unreleased]` against the current `CHANGELOG.md`. If they are equivalent (ignoring whitespace-only differences), the agent MUST return `no-op: already in sync` and MUST NOT rewrite the file.
7. **FR-2.7:** When content has changed, the agent MUST rewrite ONLY the `[Unreleased]` section. Sections for prior released versions (e.g., `[1.2.0]`, `[1.1.0]`) MUST remain byte-for-byte untouched.
8. **FR-2.8:** If `CHANGELOG.md` does not exist in the project CWD and the rule file is present, on the first invocation where at least one eligible entry is computed, the agent MUST create `CHANGELOG.md` with the Keep a Changelog header (title, description paragraph linking to keepachangelog.com, semver note) followed by an `[Unreleased]` section containing the computed entries. If no eligible entries are computed, the agent MUST NOT create the file (no empty changelog).
9. **FR-2.9:** The agent MUST output a structured summary: (a) self-check result (configured / not-configured), (b) source counts (commits read, PRD sections read), (c) computed entries per category, (d) action taken (no-op / created / rewrote), (e) any ambiguous category choices with justification.
10. **FR-2.10:** The agent MUST NOT modify `docs/PRD.md`, `.claude/scratchpad.md`, or any file other than `CHANGELOG.md` at the project root.

#### FR-3: PRD Changelog Field (prd-writer update)

Extend every PRD section with a required `Changelog:` field that captures the user-facing changelog entry or explicit internal opt-out.

1. **FR-3.1:** The `prd-writer` agent prompt at `src/agents/prd-writer.md` MUST be updated to require a `Changelog:` field in every new PRD section, placed in or immediately after the section header block (alongside `Status:`, `Date:`, `Priority:`).
2. **FR-3.2:** The `Changelog:` field MUST accept exactly two valid value shapes: (a) a single-line user-facing description phrased for end users (e.g., `Changelog: Users can sign in with Google OAuth`), OR (b) the exact literal string `skip — internal` for explicit opt-out (e.g., `Changelog: skip — internal`).
3. **FR-3.3:** The `prd-writer` Output Format section MUST document both shapes with at least one example of each. The Constraints section MUST state that omitting the field is a PRD authoring error (the critic will flag missing fields).
4. **FR-3.4:** User-facing descriptions in the `Changelog:` field MUST be phrased for product owners and end users: no internal jargon ("refactor", "agent", "slice", "wave"), no implementation details (file paths, function names), no version numbers or dates (those are added during release packaging in iteration 2).
5. **FR-3.5:** The `skip — internal` form MUST be used for PRD sections documenting purely internal work (refactors, test infrastructure, CI changes, typecheck cleanup, logging, metrics) and MUST NOT be used as a lazy default for user-facing features. The changelog rule file (FR-1.1) MUST state this constraint.

#### FR-4: Pipeline Hooks (command updates)

Integrate `changelog-writer` invocations at four lifecycle points in the pipeline, preserving idempotency and parallel-execution safety.

1. **FR-4.1:** `src/commands/bootstrap-feature.md` MUST be updated so that immediately after Step 5 (Tech Lead Implementation Planning) completes, the command delegates to the `changelog-writer` agent to produce an initial `[Unreleased]` stub from the newly-written PRD section. This is the feature's first eligible sync point, even before any commits exist — the agent will correctly compute `no-op: already in sync` (or create a stub if no `CHANGELOG.md` exists yet AND at least one prior eligible commit exists on the branch; first-ever invocation on a branch with no eligible commits is a no-op per FR-2.8).
2. **FR-4.2:** `src/commands/implement-slice.md` Step 5 (Commit) MUST be updated to delegate to `changelog-writer` immediately after the commit succeeds, BUT ONLY when running standalone (no wave context). When running as a parallel subagent within a wave (wave context provided in spawn prompt), the slice MUST skip the `changelog-writer` invocation — the orchestrator handles post-wave sync per FR-4.3. This preserves the parallel-execution safety guarantee from section 2 FR-2.6 (subagents do not write shared files during waves).
3. **FR-4.3:** `src/commands/develop-feature.md` MUST be updated so that after each wave completes (all subagents in the wave have returned) and before the orchestrator proceeds to the next wave, the orchestrator delegates to `changelog-writer` once. This is an orchestrator-only invocation — the wave's subagents do not invoke it individually (per FR-4.2).
4. **FR-4.4:** `src/commands/merge-ready.md` MUST be updated with a pre-flight sync hook: before Gate 0 (Git Hygiene) runs, the command MUST delegate to `changelog-writer` once as a safety net. This MUST NOT be a new quality gate — it does not have a pass/fail verdict tied to merge readiness. It is a silent sync. If the agent returns `no-op: not configured` or `no-op: already in sync`, the command proceeds to Gate 0 with no output. If the agent rewrote `CHANGELOG.md`, the command MUST surface the diff summary in its output and proceed to Gate 0.
5. **FR-4.5:** None of the four hook points (FR-4.1 through FR-4.4) MUST create a new gate, a new quality check, or a new blocking condition. A failure of `changelog-writer` (e.g., the agent crashes) MUST NOT block pipeline progression — the error MUST be logged and the pipeline MUST continue.
6. **FR-4.6:** The `changelog-writer` agent MUST be invoked with no arguments beyond the project CWD context — all inputs are discovered from disk (PRD, scratchpad, git log, CHANGELOG.md). This ensures identical behavior across all four hook points.

#### FR-5: Registration and Documentation

Register the new agent in the agency table, update agent counts, and document the feature in the README.

1. **FR-5.1:** `src/claude.md` Agency Roles table MUST be updated to include a new row: Role = "Release Scribe" (or equivalent product-facing title), Agent = `changelog-writer`, Responsibility = "Maintain the `[Unreleased]` section of downstream project `CHANGELOG.md` in sync with PRD, scratchpad, and git log".
2. **FR-5.2:** All references to "13 agents" in `src/claude.md` and `README.md` MUST be updated to "14 agents".
3. **FR-5.3:** `README.md` MUST include `changelog-writer` in any agent table/list alongside the existing 13 agents.
4. **FR-5.4:** `README.md` MUST add a brief section (or update the existing features list) explaining that downstream projects get automated `CHANGELOG.md` maintenance via `install.sh --init-project`, and that the SDLC repo itself opts out by virtue of not installing the rule file on itself.
5. **FR-5.5:** `templates/CLAUDE.md` MUST be updated to add an optional `Version source:` placeholder field in the project-metadata area, documented as "reserved for future semver automation (iteration 2); in iteration 1 this field is informational only and has no runtime effect". This placement ensures downstream projects initialized during iteration 1 will not need a second migration when iteration 2 ships.

### 3.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt and rule files only. No runtime code (JavaScript, TypeScript, Python, shell) is introduced. `install.sh` is modified only if its file-copy logic requires an explicit entry for `templates/rules/changelog.md`; if glob patterns cover the directory, no shell code change is required.
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Projects using SDLC v3.1.0 that upgrade to the iteration-1 release MUST continue to function identically if they do not re-run `install.sh --init-project` — `changelog-writer` will simply return `no-op: not configured` at every hook point. Existing PRD sections without a `Changelog:` field MUST NOT cause the agent to fail; it MUST treat missing fields as `skip — internal` for backward compatibility and note the missing field in its output.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh` for the global agent; `bash install.sh --init-project` for the downstream-project rule). No migration steps beyond re-running the installer.
4. **NFR-4:** The `changelog-writer` agent MUST use the `opus` model consistent with all other agents (per section 1 NFR-4).
5. **NFR-5:** The total agent count increases from 13 to 14. All documentation references MUST be updated (per FR-5.2).
6. **NFR-6:** Idempotency is mandatory. The agent MUST be safe to call an arbitrary number of times in succession with no side effects beyond the single intended `CHANGELOG.md` rewrite (if any). Calling the agent twice in a row with no changes in between MUST produce `no-op: already in sync` on the second call.
7. **NFR-7:** The agent MUST NOT access the network. All inputs are local files and `git log` output. This keeps the agent fast, deterministic, and safe in restricted environments.
8. **NFR-8:** The agent's typical wall-clock runtime SHOULD be under 5 seconds for no-op invocations (the common case) and under 15 seconds for rewrite invocations. This is a soft performance target to ensure the four-hook-point invocation pattern does not meaningfully slow the pipeline.

### 3.5 Acceptance Criteria

1. **AC-1:** A file `templates/rules/changelog.md` exists in the SDLC repo containing the Keep a Changelog format spec, the six standard categories, the audience statement (product owners/end users, NOT developers), the inclusion rule, and the exclusion rule (per FR-1.1).
2. **AC-2:** The file `.claude/rules/changelog.md` does NOT exist in the SDLC repo itself after running `bash install.sh` (but not `--init-project`). This verifies the SDLC repo opts out automatically (per FR-1.2 and FR-2.2).
3. **AC-3:** After running `install.sh --init-project` in a fresh downstream directory, the file `.claude/rules/changelog.md` exists in that directory (per FR-1.3).
4. **AC-4:** A file `src/agents/changelog-writer.md` exists with valid frontmatter (`name: changelog-writer`, `description`, `tools`, `model: opus`) and a prompt whose first documented step is the self-check described in FR-2.2.
5. **AC-5:** When `changelog-writer` is invoked in the SDLC repo's own working directory, its output is the exact string `no-op: not configured` and `CHANGELOG.md` is not created (per FR-2.2 and AC-2).
6. **AC-6:** When `changelog-writer` is invoked twice in succession in a configured downstream project with no intervening changes, the second invocation returns `no-op: already in sync` and `CHANGELOG.md` is unchanged (per FR-2.6, NFR-6).
7. **AC-7:** `src/agents/prd-writer.md` Output Format section documents the `Changelog:` field with both valid value shapes and at least one example of each (per FR-3.1 and FR-3.3).
8. **AC-8:** `src/commands/bootstrap-feature.md` contains an explicit post-Step-5 delegation to `changelog-writer` (per FR-4.1).
9. **AC-9:** `src/commands/implement-slice.md` Step 5 contains a post-commit delegation to `changelog-writer` guarded by a standalone-mode check, with explicit instructions to skip the delegation when running as a parallel subagent (per FR-4.2).
10. **AC-10:** `src/commands/develop-feature.md` contains a post-wave delegation to `changelog-writer` at the orchestrator level (per FR-4.3).
11. **AC-11:** `src/commands/merge-ready.md` contains a pre-flight sync hook before Gate 0 that is explicitly documented as non-blocking and NOT a gate (per FR-4.4 and FR-4.5). The `/merge-ready` gate list is unchanged in count — no Gate 10 is added.
12. **AC-12:** The Agency Roles table in `src/claude.md` has a row for `changelog-writer` and all "13 agents" references are updated to "14 agents" (per FR-5.1 and FR-5.2).
13. **AC-13:** `README.md` includes `changelog-writer` in the agent table/list and updates the "13 specialized AI agents" tagline to "14 specialized AI agents" (per FR-5.2 and FR-5.3).
14. **AC-14:** `templates/CLAUDE.md` contains an optional `Version source:` placeholder field documented as reserved for iteration 2 (per FR-5.5).
15. **AC-15:** When `changelog-writer` is invoked in a configured downstream project with no existing `CHANGELOG.md` and at least one eligible commit on the branch, the agent creates `CHANGELOG.md` with a Keep a Changelog header and an `[Unreleased]` section containing the eligible entries (per FR-2.8).
16. **AC-16:** When a PRD section has `Changelog: skip — internal`, its corresponding commits are NOT represented in `[Unreleased]` even after those commits ship (per FR-2.4).
17. **AC-17:** Cross-references are valid: the agent registered in `src/claude.md` has a corresponding `src/agents/changelog-writer.md` file; all four command files reference the agent by its exact registered name; no phantom paths.

### 3.6 Affected Components

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `templates/rules/changelog.md` | Downstream-project-scoped changelog policy rule; presence is the agent's self-check sentinel | FR-1.1 through FR-1.4 |
| `src/agents/changelog-writer.md` | The changelog-writer agent prompt with self-check, input discovery, idempotent sync, structured output | FR-2.1 through FR-2.10 |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/agents/prd-writer.md` | Add `Changelog:` field requirement to Output Format; document both valid value shapes with examples; add authoring constraints | FR-3.1 through FR-3.5 |
| `src/commands/bootstrap-feature.md` | Add post-Step-5 delegation to `changelog-writer` | FR-4.1 |
| `src/commands/implement-slice.md` | Add post-commit delegation to `changelog-writer` in Step 5 guarded by standalone-mode check | FR-4.2 |
| `src/commands/develop-feature.md` | Add post-wave orchestrator delegation to `changelog-writer` | FR-4.3 |
| `src/commands/merge-ready.md` | Add pre-flight sync hook before Gate 0 (non-blocking, no new gate) | FR-4.4, FR-4.5 |
| `src/claude.md` | Add `changelog-writer` row to Agency Roles table; update "13 agents" references to "14 agents" | FR-5.1, FR-5.2 |
| `README.md` | Update agent count (13 to 14); add `changelog-writer` to agent table; document downstream CHANGELOG maintenance feature | FR-5.2, FR-5.3, FR-5.4 |
| `templates/CLAUDE.md` | Add optional `Version source:` placeholder field documented as reserved for iteration 2 | FR-5.5 |
| `install.sh` | Verify (or add) that `templates/rules/changelog.md` is copied into downstream projects by `--init-project`; verify `src/agents/changelog-writer.md` is copied by the global install path | FR-1.3, NFR-1 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Architecture review is independent of changelog content |
| `src/agents/ba-analyst.md` | Use case documentation is not a changelog input |
| `src/agents/qa-planner.md` | QA test cases are not a changelog input |
| `src/agents/planner.md` | Plan format is unchanged; the `Changelog:` field lives in the PRD, not the plan |
| `src/agents/test-writer.md` | Test writing is internal work and is never user-facing |
| `src/agents/security-auditor.md` | Security findings are product-level only when they reach a PRD section with a non-skip `Changelog:` |
| `src/agents/code-reviewer.md` | Code review is independent of changelog content |
| `src/agents/build-runner.md` | Build verification does not touch `CHANGELOG.md` |
| `src/agents/e2e-runner.md` | E2E tests do not touch `CHANGELOG.md` |
| `src/agents/verifier.md` | Verification does not touch `CHANGELOG.md` |
| `src/agents/doc-updater.md` | `CHANGELOG.md` is maintained exclusively by `changelog-writer`, not by `doc-updater` |
| `src/agents/refactor-cleaner.md` | Cleanup is internal work and is never user-facing |
| `src/rules/git.md` | Git workflow unchanged; `CHANGELOG.md` updates piggyback on existing slice commits |
| `src/rules/scratchpad.md` | Scratchpad format unchanged; changelog-writer reads the scratchpad but does not modify it |
| `src/rules/error-recovery.md` | Error recovery rules unchanged; a `changelog-writer` failure is non-blocking per FR-4.5 |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged |
| `src/commands/context-refresh.md` | Context refresh reads scratchpad only; changelog state is not session context |

### 3.7 UI Changes, Schema Changes, Affected Endpoints

Not applicable on all three counts. The SDLC project is a collection of markdown prompt files with no UI, database, or API.

### 3.8 Out of Scope for Iteration 1

The following items are deferred to a future iteration-2 PRD section ("Product Changelog — Release Packaging") and MUST NOT be implemented as part of iteration 1:

1. **Automatic semver bump computation** from the nature of entries in `[Unreleased]` (major/minor/patch).
2. **Renaming `[Unreleased]` to `[X.Y.Z]` with a date stamp** at release time.
3. **Release notes file generation** (`.claude/release-notes-X.Y.Z.md`) for GitHub release bodies.
4. **Automated release commit** (`chore(core): release X.Y.Z`) creation.
5. **`git tag` invocation** for the new release version.
6. **`gh release create` integration** for publishing GitHub releases.
7. **Gate 10 "Release Packaging" in `/merge-ready`** — iteration 1 adds ONLY a pre-flight sync hook (FR-4.4), NOT a new gate. The `/merge-ready` gate count is unchanged.
8. **Consumption of the `Version source:` field in `templates/CLAUDE.md`** — iteration 1 introduces the field as dead metadata (FR-5.5) specifically so iteration 2 can consume it without a second migration; iteration 1 code MUST NOT read or interpret the field.

These items are listed explicitly so the Plan Critic does not flag their absence as a gap during iteration 1 planning.

### 3.9 Risks and Dependencies

1. **Risk: SDLC repo accidentally installs the changelog rule on itself.** If the installer's glob over `templates/` is too broad, the SDLC repo could end up with `.claude/rules/changelog.md` and start maintaining its own `CHANGELOG.md`, contradicting design decision 1. Mitigation: FR-1.2 and FR-1.3 explicitly require `templates/rules/changelog.md` to be installed ONLY by the `--init-project` flag, never by the default `install.sh` path. AC-2 verifies this post-install.
2. **Risk: Idempotency bugs cause repeated spurious rewrites.** If the diff logic (FR-2.6) is sensitive to whitespace, ordering, or quoting differences that do not represent content changes, the agent would rewrite `CHANGELOG.md` on every invocation, producing noisy commits. Mitigation: FR-2.6 explicitly requires whitespace-insensitive equivalence. AC-6 verifies idempotency via a double-invocation test.
3. **Risk: Parallel wave double-write race.** If `implement-slice` subagents each invoke `changelog-writer` in a parallel wave, two subagents could attempt to rewrite `CHANGELOG.md` simultaneously, corrupting the file. Mitigation: FR-4.2 explicitly prohibits subagent-level invocation in parallel mode; the orchestrator handles post-wave sync per FR-4.3. This is the same safety pattern as section 2 FR-2.6 for scratchpad writes.
4. **Risk: Internal work leaks into `CHANGELOG.md`.** If a PRD section is written without a `Changelog:` field, the agent's default behavior must not be to invent a user-facing description. Mitigation: NFR-2 specifies that missing `Changelog:` fields are treated as `skip — internal` for backward compatibility. FR-3.3 requires the `prd-writer` Constraints section to state that omitting the field is an authoring error so new PRD sections get an explicit value.
5. **Risk: `Changelog:` field written in developer-speak.** Authors may write entries with internal jargon (e.g., `Changelog: Refactored auth middleware into a guard`). Mitigation: FR-3.4 explicitly prohibits internal jargon in the field value and lists examples of forbidden content. The `prd-writer` agent is updated accordingly. (No automated enforcement in iteration 1; relies on agent prompt guidance.)
6. **Risk: `Version source:` placeholder is dead weight if iteration 2 is never built.** Design decision 10 accepts this tradeoff explicitly to avoid a second migration. Mitigation: FR-5.5 documents the field as informational only with no runtime effect, so it costs at most one line in `templates/CLAUDE.md`.
7. **Risk: Hook invocation slows the pipeline.** Four hook points per feature, each invoking an agent, could add noticeable latency. Mitigation: NFR-6 requires idempotency (most invocations are no-ops) and NFR-8 sets soft performance targets (under 5s for no-ops, under 15s for rewrites).
8. **Risk: Branch-start merge-base detection fails for new repos or unusual workflows.** FR-2.3 depends on `git merge-base` against `main` to scope the `git log` range. Mitigation: the agent MUST fall back gracefully — if merge-base cannot be determined, read the full `git log` on the current branch and annotate its output to flag the degraded mode. (Note: falls under error-recovery Rule 2 — auto-add; documented here as a known edge case.)
9. **Dependency: Section 1 FR-3 (Executable Plan Format).** The `Changelog:` field follows the same structured-field pattern established by `Files:`, `Changes:`, `Verify:`, `Done when:`. Section 1 is [SHIPPED], so this dependency is satisfied.
10. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** The parallel-execution safety pattern (orchestrator-only scratchpad writes) is the blueprint for orchestrator-only `CHANGELOG.md` writes in FR-4.2 and FR-4.3. Section 2 is [DRAFT] but the pattern is established in the pipeline rules; this feature must land after or alongside section 2.
11. **Dependency: Downstream projects re-run `install.sh --init-project`.** Existing downstream projects already initialized under SDLC v3.1.0 will NOT automatically receive `templates/rules/changelog.md`; they must re-run `install.sh --init-project` (or the installer must be extended with an idempotent update path). This is a documentation concern for the release notes when iteration 1 ships. Mitigation: NFR-2 guarantees backward compatibility — projects that do NOT re-run the init script continue to work without changelog maintenance.

### 3.10 Iteration 2 Scope Preview

This subsection is a **non-binding forward reference** describing what iteration 2 ("Product Changelog — Release Packaging") will cover. It is recorded here so that iteration 1's scope boundary is explicit and the Plan Critic does not flag iteration-2 concerns as iteration-1 gaps. No functional requirements, acceptance criteria, or non-functional requirements are added to section #3 by this preview — those will be authored in the dedicated iteration 2 PRD section when it is written. The items listed in section 3.8 "Out of Scope for Iteration 1" remain the authoritative deferral list; this subsection expands on the remote-automation half of item 6 ("`gh release create` integration") and introduces related role and CI/CD responsibilities that were not fully captured there.

Iteration 2 will, at minimum, cover the following areas:

1. **Dedicated role for GitHub Releases automation.** A role — either a new agent (candidate name `release-engineer`) or an extension of an existing merge-related role (for example `build-runner`, the `/merge-ready` workflow, or a new sibling agent) — will be responsible for ensuring the end-to-end release publishing flow works. The exact placement (new agent vs. extending an existing one) is explicitly deferred to iteration 2 planning and is NOT decided here.

2. **CI/CD pipeline inspection responsibility.** The role will inspect the downstream project's existing CI/CD configuration — including but not limited to `.github/workflows/`, `.gitlab-ci.yml`, CircleCI configuration, and equivalent provider formats — and verify whether the pipeline already supports automatic GitHub Release creation on push of a version tag matching `v*.*.*`. The verification includes confirming that the release body is populated from the corresponding `CHANGELOG.md` version section, not from a generic template or commit log.

3. **CI/CD pipeline implementation responsibility when absent.** When no such workflow exists in the downstream project, the role will create one. A typical implementation on GitHub is a `.github/workflows/release.yml` file that triggers on `push: tags: ['v*.*.*']`, extracts the `[X.Y.Z]` section from `CHANGELOG.md`, and invokes `gh release create` (or an equivalent action such as `actions/create-release` or `softprops/action-gh-release`). The generated workflow must be idempotent and safe to run on a re-pushed tag — re-publishing an existing release must not corrupt its body or create duplicates.

4. **End-state goal for iteration 2.** A developer working on a downstream project pushes a version tag generated by iteration 2's local Gate 10 release packaging flow, and GitHub automatically creates a new Release whose body is the `[X.Y.Z]` section of the project's `CHANGELOG.md`. No manual `gh release create` invocation is required by the developer, and no manual copy-paste of release notes into the GitHub UI is required.

5. **Separation of concerns across the local and remote halves.** Iteration 2 splits cleanly into two halves: (a) the **local half**, performed by the pipeline at Gate 10 during `/merge-ready`, which computes the semver bump, renames `[Unreleased]` to `[X.Y.Z]` with a date stamp, creates the release-notes file, commits the result, and outputs the `git tag` and `git push` commands for the developer to run; and (b) the **remote half**, performed by the CI/CD workflow that the new role ensures exists, which fires on the tag push and creates the GitHub Release with the correct body. Iteration 1 does neither half — it only maintains `[Unreleased]` content sync.

The exact role placement (new agent versus extension of an existing role), the CI/CD provider support matrix (GitHub Actions is the primary target for iteration 2; GitLab CI, CircleCI, and others are **TBD** and may be deferred to a later iteration), and the semver source-of-truth (whether to read from `templates/CLAUDE.md` `Version source:`, from `package.json`, from an explicit input, or from another location) are all explicitly deferred to iteration 2 planning and are NOT decided in iteration 1.

---

## 4. Resource Manager-Architect — Iteration 1: Mandatory Pipeline Role

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-24
**Priority:** Medium
**Related:** Section 1 (FR-3: Executable Plan Format — recommendations are inlined into `.claude/plan.md`), Section 3 (FR-3: PRD Changelog Field — this section includes the field per that contract)
**Changelog:** Pipeline now recommends MCP tools, cloud resources, external APIs, third-party services, libraries, and hardware considerations at the start of each feature so setup needs are surfaced before implementation begins.

### 4.1 Description

Add a new mandatory agent `resource-architect` ("Resource Manager-Architect") to the global pipeline. The agent runs once per feature during `/bootstrap-feature` — immediately after the architecture review and before QA test case authoring — and produces a recommendation-only list of external resources the feature will likely need: MCP tools, cloud/compute, external APIs, third-party services, libraries/frameworks, and hardware. The agent writes its output to a temp file `.claude/resources-pending.md`; the `planner` agent then inlines that content as a top-level `## Recommended Resources` section at the top of `.claude/plan.md` (before `## Prerequisites verified`) and deletes the temp file.

**Why:** The current pipeline assumes all external dependencies are already configured on the developer's machine. When a feature implicitly requires a new MCP server (e.g., Playwright for browser E2E), a cloud GPU (e.g., for model fine-tuning), or a third-party service (e.g., Sentry for error tracking), those needs surface ad-hoc during implementation — often mid-slice — and cause retries, context switches, or silent scope reduction. Adding a dedicated resource-recommendation step between architecture review and test planning puts the full list of external dependencies in front of the developer before any code is written, lets the architect's validated approach inform what resources to recommend, and lets the QA lead assume those resources exist when authoring test cases.

**Audience:** The audience of the `## Recommended Resources` section in `.claude/plan.md` is the **developer running the SDLC pipeline** (internal developer-facing content). This is distinct from Section 3's `CHANGELOG.md`, which targets product owners and end users. The resource list is a working document that the developer reads once at bootstrap time and copies commands from; it is not preserved across features and is not surfaced to downstream users.

**Scope boundary:** This section covers **Iteration 1: Mandatory Pipeline Role ONLY**. The agent is suggest-only — it does NOT install, configure, or modify any resource. Automatic installation, merge-ready re-check, cross-feature cost tracking, cloud-provider SDK integration, teardown recommendations, and cross-feature resource conflict detection are deferred. See section 4.8 "Out of Scope for Iteration 1".

**Design decisions:**
1. **Agent name and role title.** The agent file is `src/agents/resource-architect.md`. In the Agency Roles table, the role is titled "Resource Manager-Architect" and the agent column is `resource-architect`. The kebab-case name matches the existing `prd-writer` and `changelog-writer` pattern.
2. **Permanent member of the global mandatory scope.** Unlike a future `role-planner` agent (which would generate optional feature-specific agents), `resource-architect` itself is a core pipeline agent installed by the default `install.sh` path and invoked in every bootstrap cycle for every feature. It is NOT feature-opt-in and NOT downstream-project-scoped. The total global agent count rises from 14 to 15.
3. **Pipeline position: Step 3.5 of `/bootstrap-feature`.** The agent is invoked between Step 3 (Software Architect review) and Step 4 (QA Lead test cases). Architect first validates the technical approach; `resource-architect` then recommends resources informed by the architect's verdict; QA then writes test cases that can legitimately assume those resources exist (e.g., a browser-E2E test case can assume the Playwright MCP is available because it was recommended).
4. **One-shot timing.** One invocation per bootstrap per feature. No re-check in `/merge-ready`, no continuous sync like `changelog-writer`, no re-run on subsequent slices. If the feature's resource needs change mid-implementation, that is out of scope for iteration 1 and is handled by the developer manually re-running the agent if desired.
5. **Full resource scope, six categories.** The agent recommends across: (a) **MCP tools** (e.g., `playwright` for browser testing, `filesystem` for file ops, project-specific MCPs), (b) **Cloud/Compute** (AWS/GCP/Azure instances, GPUs for ML workloads, local dev containers, serverless runtimes), (c) **External APIs** (OpenAI, Anthropic, Stripe, third-party SaaS integrations), (d) **Third-party Services** (error tracking like Sentry, monitoring like Datadog, CDN, auth providers like Auth0), (e) **Libraries/Frameworks** (for green-field projects: choice of web framework, ORM, test runner, etc.), (f) **Hardware** (RAM/disk requirements, special hardware like USB debuggers for embedded work).
6. **Suggest-only authority.** The agent's output is pure recommendation text — command snippets the user can copy-paste, rationale for each resource, cost/complexity flags. The user decides what to install. The agent MUST NOT modify `~/.claude/settings.json` or any Claude Code configuration, MUST NOT install MCP servers via `claude mcp add`, MUST NOT touch cloud credentials or `.env` files or any secrets store, MUST NOT run `npm install`/`pip install`/`brew install` or any package-manager command, and MUST NOT make network calls (same no-network constraint established by `changelog-writer` in Section 3 NFR-7).
7. **Temp-file handoff to planner.** The agent writes to `.claude/resources-pending.md` at Step 3.5. At Step 5, the planner reads `.claude/resources-pending.md` (if present), inlines its content as a top-level `## Recommended Resources` section at the top of `.claude/plan.md` (before `## Prerequisites verified`), and deletes the temp file. This pattern keeps the agent stateless and lets the planner own final placement of the content in the plan.
8. **Structured recommendation format.** Each recommendation includes six fields — Category, Name, Why, Install/Activate command or procedure, Cost/complexity flag (`trivial` / `moderate` / `expensive`), Reversibility (`easy` / `moderate` / `hard`). This is the internal developer's equivalent of the structured-field pattern established by Section 1 FR-3 for slices.
9. **No self-check opt-out.** Unlike `changelog-writer` (which self-skips when `.claude/rules/changelog.md` is absent), `resource-architect` is globally mandatory and has no opt-out sentinel. It runs on every feature regardless of project configuration. Features with zero external resource needs receive an empty recommendation list with an explicit "no external resources required" note (not a no-op return).
10. **Changelog field value.** The SDLC repo itself has no `.claude/rules/changelog.md` (per Section 3 design decision 1, the SDLC opts out of its own changelog maintenance), so `changelog-writer` will self-skip for this PRD section. The `Changelog:` field is still required per Section 3 FR-3.3 and is authored accordingly.

### 4.2 User Story

As a developer using the Claude Code SDLC pipeline, I want the pipeline to present a complete list of external resources my feature will need — MCP tools, cloud/compute, external APIs, third-party services, libraries, and hardware — along with install commands and cost/reversibility flags, before any code is written, so that I can provision everything once at the start of the feature instead of discovering missing dependencies mid-slice and retrying or silently descoping.

### 4.3 Functional Requirements

#### FR-1: Resource-Architect Agent Specification

A new global agent that produces structured resource recommendations during bootstrap.

1. **FR-1.1:** A new file `src/agents/resource-architect.md` MUST exist with frontmatter matching the existing agent format (`name: resource-architect`, `description`, `tools`, `model: opus` for consistency with Section 1 NFR-4).
2. **FR-1.2:** The agent's prompt MUST document that it reads the following inputs in order: (a) the newly-written PRD section in `docs/PRD.md` for the current feature, (b) the use-cases file in `docs/use-cases/<feature>_use_cases.md`, (c) the architect's verdict (passed to the agent by `/bootstrap-feature` as context from Step 3), (d) the project's `CLAUDE.md` or equivalent context file for tech-stack awareness. The agent MUST NOT read `.claude/scratchpad.md` — at Step 3.5 the scratchpad's feature context is already known and the agent does not need implementation progress.
3. **FR-1.3:** The agent MUST produce a structured recommendation list covering the six categories defined in FR-4.1. For each recommended resource, the output MUST include the six fields defined in FR-1.4. The agent MAY produce an empty list within a category when no resources from that category are needed (e.g., a pure-refactor feature may have empty Cloud/Compute and External API lists).
4. **FR-1.4:** Each recommendation entry MUST include all six of the following fields:
   - **Category:** exactly one of `MCP`, `Cloud/Compute`, `External API`, `Third-party Service`, `Library/Framework`, `Hardware`.
   - **Name:** a concrete identifier (e.g., `Playwright MCP server`, `AWS EC2 t3.medium`, `Sentry SaaS`, `pytest`, `16 GB RAM minimum`).
   - **Why:** a one-sentence rationale tied to a specific use case or PRD requirement, ideally referencing the PRD section and FR number (e.g., "FR-2.3 requires browser-based E2E — Playwright MCP enables the `e2e-runner` agent to drive a real browser").
   - **Install/activate command or procedure:** the exact shell command when applicable (e.g., `claude mcp add playwright ...`); for credentials or manual steps, a short numbered checklist (e.g., "1. Create Sentry project, 2. Copy DSN, 3. Add `SENTRY_DSN` to `.env`").
   - **Cost/complexity flag:** exactly one of `trivial` (free and no configuration), `moderate` (setup required, possibly small paid tier or local daemon), `expensive` (non-trivial dollars or operational burden).
   - **Reversibility:** exactly one of `easy` (uninstall in one command, no persistent state), `moderate` (uninstall requires multiple steps but no external commitments), `hard` (persistent cloud resources, contracts, data migrations, domain names, etc.).
5. **FR-1.5:** When the feature has NO external resource needs (e.g., a pure internal refactor that touches only existing files), the agent MUST emit an explicit "No external resources required" statement as the body of the output, NOT an empty file and NOT a no-op return. The explicit statement is required so downstream consumers (planner, human reader) can distinguish "considered and none needed" from "agent did not run".
6. **FR-1.6:** The agent MUST output a short top-level summary above the per-category lists: total count of recommendations, count of `expensive` flags, count of `hard` reversibility flags. This lets the developer see the cost/commitment shape at a glance before reading the details.
7. **FR-1.7:** When a category has zero recommendations but the feature is not a pure-internal refactor (i.e., other categories DO have recommendations), the agent MUST still list the category with the literal string `(none)` underneath. Omitting empty categories entirely is prohibited — the six categories always appear in the output for consistent human scanning.

#### FR-2: Output File Contract (temp-file handoff)

Define the contract for `.claude/resources-pending.md` — the temp file that carries the agent's output from Step 3.5 to Step 5.

1. **FR-2.1:** The agent MUST write its structured output to `.claude/resources-pending.md` in the project CWD. The agent MUST NOT write to any other location, MUST NOT write directly to `.claude/plan.md`, and MUST NOT modify `docs/PRD.md` or any other file.
2. **FR-2.2:** The temp file's content MUST be a self-contained markdown fragment starting with a top-level `## Recommended Resources` heading, followed by the summary line (per FR-1.6), followed by six subsection headings — one per category — each with its recommendations as per-resource blocks matching the FR-1.4 field schema. No frontmatter, no agent-meta commentary, no trailing "end of output" markers.
3. **FR-2.3:** The temp file's lifecycle is: created by `resource-architect` at Step 3.5, read and inlined by `planner` at Step 5, deleted by `planner` after successful inlining. If the planner fails before deletion, the temp file remains on disk — the next bootstrap invocation for the same feature overwrites it, and `/merge-ready` does not check for its absence.
4. **FR-2.4:** If `.claude/resources-pending.md` already exists when `resource-architect` runs (e.g., leftover from a previous aborted bootstrap), the agent MUST overwrite it without prompting. Stale content from a previous run MUST NOT be appended to or merged with the new content.
5. **FR-2.5:** The `planner` agent prompt (`src/agents/planner.md`) MUST be updated to include a new step in its Process or Output Format section: "Read `.claude/resources-pending.md` if it exists. Inline its content verbatim (preserving all formatting) as the first top-level section of `.claude/plan.md`, placed immediately before `## Prerequisites verified`. After successful inlining, delete `.claude/resources-pending.md`. If the file does not exist, skip this step silently."
6. **FR-2.6:** The inlined `## Recommended Resources` section in `.claude/plan.md` MUST appear at the very top of the plan file, before `## Prerequisites verified` and before the slice list. This places the resource list where the developer sees it first when opening the plan.

#### FR-3: Pipeline Integration (bootstrap-feature Step 3.5 and planner update)

Integrate the agent as a mandatory, non-skippable step of `/bootstrap-feature` and wire the planner to consume its output.

1. **FR-3.1:** `src/commands/bootstrap-feature.md` MUST be updated to insert a new Step 3.5 between the existing Step 3 (Software Architect review) and Step 4 (QA Lead test cases). The step's title MUST be "Resource Manager-Architect recommendation" and its body MUST document: the delegation to the `resource-architect` agent, the inputs the agent will read (per FR-1.2), the expected output file (`.claude/resources-pending.md`, per FR-2.1), and the hand-off contract to the planner at Step 5 (per FR-2.5).
2. **FR-3.2:** Step 3.5 MUST be a mandatory, non-skippable step. `/bootstrap-feature` MUST NOT offer a flag or heuristic to skip resource recommendation. Features with no external resource needs are handled by the agent producing an explicit "No external resources required" output per FR-1.5, not by skipping the step.
3. **FR-3.3:** If the `resource-architect` agent fails (e.g., the agent crashes or returns an error), `/bootstrap-feature` MUST report the failure to the user and MUST NOT proceed to Step 4. This differs from `changelog-writer`'s non-blocking behavior (Section 3 FR-4.5) because resource recommendations are a prerequisite for informed QA test case authoring.
4. **FR-3.4:** `src/agents/planner.md` MUST be updated per FR-2.5 to read `.claude/resources-pending.md`, inline its content at the top of `.claude/plan.md`, and delete the temp file. The planner's other existing responsibilities (slice breakdown, wave assignment from Section 2, executable plan fields from Section 1 FR-3) MUST be preserved unchanged.
5. **FR-3.5:** The step-number change in `/bootstrap-feature` (Step 3 → Step 3.5 → Step 4 → Step 5) MUST be reflected consistently across all cross-referencing command files. Any existing references to "Step 4" that mean the QA step MUST remain accurate (QA is still Step 4); any existing references to "Step 5" that mean the planner MUST remain accurate (planner is still Step 5). The new Step 3.5 is inserted without renumbering the subsequent steps.
6. **FR-3.6:** The `/develop-feature` command MUST continue to invoke `/bootstrap-feature` as a delegated subcommand with no direct change to `/develop-feature`'s own prompt. Because `/develop-feature` delegates bootstrap work wholesale, the new Step 3.5 is inherited automatically. No update to `src/commands/develop-feature.md` is required for resource recommendation wiring.

#### FR-4: Scope Boundaries (resource categories)

Define precisely which resource categories are in and out of scope for the agent's recommendations.

1. **FR-4.1:** The agent MUST recommend across exactly the six categories listed in FR-1.4 and design decision 5: `MCP`, `Cloud/Compute`, `External API`, `Third-party Service`, `Library/Framework`, `Hardware`. The agent MUST NOT introduce additional categories in iteration 1 (e.g., "Database", "Message Queue", "Developer Tooling") — those concerns are either subsumed by existing categories or explicitly deferred.
2. **FR-4.2:** **MCP category** MUST cover Model Context Protocol servers — both official (e.g., `filesystem`, `git`, `github`, `playwright`) and project-specific custom MCPs the feature would benefit from. Recommendations MUST include the exact `claude mcp add ...` command when applicable.
3. **FR-4.3:** **Cloud/Compute category** MUST cover remote compute resources (AWS/GCP/Azure VMs, serverless runtimes like Lambda/Cloud Run, GPUs for ML workloads), as well as local compute where it represents a deliberate setup step (Docker containers, devcontainers, local Kubernetes). Bare "use your laptop" does NOT belong in this category.
4. **FR-4.4:** **External API category** MUST cover paid or authenticated HTTP APIs the feature's code will call (OpenAI, Anthropic, Stripe, Twilio, etc.). Recommendations MUST include the credential-acquisition procedure as the install/activate field.
5. **FR-4.5:** **Third-party Service category** MUST cover operational SaaS that augments the running system but is not directly called in feature code paths: error tracking (Sentry, Rollbar), monitoring (Datadog, New Relic), CDN (Cloudflare, Fastly), auth providers (Auth0, Clerk), analytics (PostHog, Amplitude). The distinction from External API is: External API is code-path-coupled; Third-party Service is operational-coupled.
6. **FR-4.6:** **Library/Framework category** MUST cover package-manager dependencies that represent a deliberate framework choice, primarily for green-field features: web framework (Express vs. Fastify vs. Hono), ORM (Prisma vs. Drizzle vs. Kysely), test runner (Vitest vs. Jest), etc. For established projects where the framework is already chosen, this category is typically `(none)`. Individual utility libraries (`lodash`, `date-fns`) do NOT belong here — those are routine slice-level `npm install` calls, not architectural decisions.
7. **FR-4.7:** **Hardware category** MUST cover non-cloud physical resource requirements that exceed typical developer-laptop defaults: RAM/disk minimums beyond 8 GB / 100 GB, special hardware (USB debuggers for embedded work, FPGA boards, GPUs local to the dev machine, peripherals for hardware-in-the-loop testing), or host OS constraints (macOS-only, Linux-only, specific kernel versions).

#### FR-5: Authority Boundaries (suggest-only, no installs)

Enforce the suggest-only authority boundary with explicit prohibitions in the agent prompt.

1. **FR-5.1:** The agent prompt MUST contain an explicit "Authority Boundary" section listing prohibited actions. The section MUST state that the agent's output is pure recommendation text and that the user decides what to install.
2. **FR-5.2:** The agent MUST NOT modify `~/.claude/settings.json`, any project-local `.claude/settings.json`, or any Claude Code configuration file.
3. **FR-5.3:** The agent MUST NOT invoke `claude mcp add`, `claude mcp remove`, or any other `claude` subcommand that mutates configuration. The agent MAY include these commands as copy-paste snippets in its recommendation text — emitting a command into text output is not the same as executing it.
4. **FR-5.4:** The agent MUST NOT touch cloud credentials, `.env` files, `.envrc` files, `~/.aws/credentials`, `~/.config/gcloud/`, or any secrets store. The agent MAY describe credential-acquisition procedures in text for the user to perform manually.
5. **FR-5.5:** The agent MUST NOT run `npm install`, `pnpm add`, `yarn add`, `pip install`, `poetry add`, `brew install`, `apt install`, `cargo add`, or any package-manager command. The agent MAY include these commands as copy-paste snippets in its recommendation text.
6. **FR-5.6:** The agent MUST NOT make network calls (HTTP, DNS, git fetch, etc.). All inputs are local files (PRD, use cases, project `CLAUDE.md`) and agent-context (architect verdict passed by the bootstrap command). This matches the no-network constraint established for `changelog-writer` in Section 3 NFR-7.
7. **FR-5.7:** The agent's `tools` frontmatter field MUST be restricted to the minimum set required for local file reads and the single write to `.claude/resources-pending.md` (e.g., `Read`, `Write`, `Glob`, `Grep`). The `Bash` tool MUST NOT be included — excluding Bash at the tool-declaration level is a defense-in-depth measure that mechanically prevents accidental `npm install` or `claude mcp add` invocations even if the prompt instructions were ignored.

#### FR-6: Registration and Documentation (Agency Roles, README, install.sh)

Register the new agent in the agency table, update all agent-count references from 14 to 15, and document the feature in the README.

1. **FR-6.1:** `src/claude.md` Agency Roles table MUST be updated to include a new row: Role = "Resource Manager-Architect", Agent = `resource-architect`, Responsibility = "Recommend external resources (MCP, cloud, APIs, services, libraries, hardware) at bootstrap time". The row MUST be placed in the table at a position consistent with the pipeline order — after "Software Architect" and before "QA Lead".
2. **FR-6.2:** All references to "14 agents" in `src/claude.md` prose MUST be updated to "15 agents". Agent-count references in `README.md` — both the tagline and the `## The 14 Agents` heading — MUST be updated to "15 agents" and `## The 15 Agents` respectively.
3. **FR-6.3:** `README.md` MUST include a new row for `resource-architect` in its agent table/list alongside the existing 14 agents, placed consistent with the Agency Roles table ordering (after `architect`, before `qa-planner`).
4. **FR-6.4:** `README.md` MUST add a brief feature section (or update an existing features list) explaining that the pipeline now recommends external resources at the start of each feature, describing the six categories, and noting that the agent is suggest-only (no installs).
5. **FR-6.5:** `install.sh` banner strings MUST be updated from "14" to "15" in all five locations that currently state "14" (same propagation pattern used in Section 1 NFR-5 for the 12→13 transition and in Section 3 FR-5.2 for the 13→14 transition). The exact set of banner strings is enumerated in the Agent Count Propagation subsection of 4.6.
6. **FR-6.6:** `install.sh` MUST copy `src/agents/resource-architect.md` into `~/.claude/agents/` as part of the default install path (NOT gated behind `--init-project`). Verification: if the installer uses a glob over `src/agents/*.md`, no code change is required beyond verification; if it uses an explicit file list, the list MUST be extended.
7. **FR-6.7:** The Plan Critic prompt in `src/claude.md` MUST be updated to recognize `## Recommended Resources` as a valid top-level section of `.claude/plan.md`. Absence of the section is NOT a critic finding (legacy plans and plans from pre-iteration-1 branches will lack the section); presence of the section with malformed category blocks MAY be a MINOR finding.

### 4.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files only. No runtime code (JavaScript, TypeScript, Python) is introduced. `install.sh` is modified only for banner strings (per FR-6.5) and file-copy verification (per FR-6.6); the shell logic itself is not restructured.
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Projects using SDLC v3.1.0 or the iteration-1 version of Section 3 MUST continue to function after upgrading. Existing `.claude/plan.md` files without a `## Recommended Resources` section MUST continue to parse correctly (the planner's inlining step is a no-op if `.claude/resources-pending.md` does not exist, per FR-2.5).
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). No migration steps beyond re-running the installer.
4. **NFR-4:** The `resource-architect` agent MUST use the `opus` model consistent with all other agents (per Section 1 NFR-4).
5. **NFR-5:** The total global agent count rises from 14 to 15. All documentation references MUST be updated (per FR-6.2, FR-6.3, FR-6.5).
6. **NFR-6:** The agent MUST NOT access the network (per FR-5.6). All inputs are local files and context passed by the bootstrap command. This keeps the agent fast, deterministic, and safe in restricted environments.
7. **NFR-7:** The agent's typical wall-clock runtime SHOULD be under 30 seconds per invocation. This is a soft performance target. Because the agent runs once per feature at bootstrap time (not per slice, not per wave), runtime is not latency-critical, but excessively long runtimes would signal the agent is doing research it should not be doing (e.g., trying to fetch current pricing information, which is out of scope).
8. **NFR-8:** The structured recommendation format (six fields per entry per FR-1.4) MUST be strict. Entries missing any of the six fields are malformed and SHOULD be flagged by the Plan Critic as a MINOR finding (per FR-6.7). Iteration 1 does not enforce format strictness programmatically — enforcement is via agent prompt guidance and critic observation.
9. **NFR-9:** The agent is one-shot per bootstrap — no re-check in `/merge-ready`, no continuous sync, no re-run on subsequent slices (per design decision 4). If the feature's resource needs change mid-implementation, the developer may manually re-invoke the agent, but the pipeline does not do so automatically.

### 4.5 Acceptance Criteria

1. **AC-1:** A file `src/agents/resource-architect.md` exists with valid frontmatter (`name: resource-architect`, `description`, `tools` restricted per FR-5.7 with no `Bash` tool, `model: opus`) and a prompt that implements the input-reading (FR-1.2), structured output (FR-1.3 through FR-1.7), temp-file write (FR-2.1 through FR-2.4), and authority boundary (FR-5.1 through FR-5.6) specifications.
2. **AC-2:** `src/commands/bootstrap-feature.md` contains an explicit Step 3.5 "Resource Manager-Architect recommendation" between Step 3 (architect) and Step 4 (QA), delegating to `resource-architect` and documenting the temp-file hand-off (per FR-3.1, FR-3.2).
3. **AC-3:** `src/commands/bootstrap-feature.md` explicitly states that Step 3.5 is mandatory and non-skippable, and that a `resource-architect` failure halts bootstrap at Step 3.5 (per FR-3.2, FR-3.3).
4. **AC-4:** `src/agents/planner.md` includes an explicit instruction to read `.claude/resources-pending.md` (if present), inline its content verbatim as the first top-level section of `.claude/plan.md` before `## Prerequisites verified`, and delete the temp file after inlining (per FR-2.5, FR-2.6).
5. **AC-5:** The Agency Roles table in `src/claude.md` has a row for `resource-architect` with Role = "Resource Manager-Architect" placed between "Software Architect" and "QA Lead", and all "14 agents" references in `src/claude.md` are updated to "15 agents" (per FR-6.1, FR-6.2).
6. **AC-6:** `README.md` updates the tagline from "14 specialized AI agents" (or equivalent) to "15 specialized AI agents", updates the `## The 14 Agents` heading to `## The 15 Agents`, includes a row for `resource-architect` in the agent table, and adds a feature section describing the resource-recommendation capability (per FR-6.2, FR-6.3, FR-6.4).
7. **AC-7:** `install.sh` has all five banner strings containing "14" updated to "15", matching the propagation pattern used for the 13→14 transition in Section 3 (per FR-6.5).
8. **AC-8:** `install.sh` copies `src/agents/resource-architect.md` into `~/.claude/agents/` as part of the default install path. After running `bash install.sh` on a clean machine, the file `~/.claude/agents/resource-architect.md` exists (per FR-6.6).
9. **AC-9:** When `/bootstrap-feature` is invoked end-to-end for a new feature, the sequence of steps is: 1 (user intent) → 2 (PRD) → 3 (architect) → 3.5 (resource-architect) → 4 (QA) → 5 (planner), and the resulting `.claude/plan.md` contains a `## Recommended Resources` top-level section at the very top, before `## Prerequisites verified` (per FR-3.1, FR-2.6).
10. **AC-10:** When `/bootstrap-feature` is invoked for a feature with no external resource needs, the `## Recommended Resources` section contains the explicit statement "No external resources required" (per FR-1.5), and all six category headings still appear with `(none)` underneath (per FR-1.7).
11. **AC-11:** After a successful bootstrap, the file `.claude/resources-pending.md` does NOT exist (the planner has inlined and deleted it per FR-2.5).
12. **AC-12:** The agent's `tools` frontmatter field does NOT include `Bash` (per FR-5.7). Verifiable via `grep -n "tools:" src/agents/resource-architect.md` and inspecting the tool list.
13. **AC-13:** Each recommendation entry in the agent's output includes all six fields (Category, Name, Why, Install/activate, Cost/complexity flag, Reversibility) in the specified value domains (per FR-1.4). Verifiable by running the agent on a sample feature and inspecting the output.
14. **AC-14:** The Plan Critic prompt in `src/claude.md` recognizes `## Recommended Resources` as a valid top-level plan section; its absence is NOT flagged (per FR-6.7).
15. **AC-15:** Cross-references are valid: the agent registered in `src/claude.md` has a corresponding `src/agents/resource-architect.md` file; `src/commands/bootstrap-feature.md` references the agent by its exact registered name; `src/agents/planner.md` references the exact temp-file path `.claude/resources-pending.md`; no phantom paths.

### 4.6 Affected Components

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `src/agents/resource-architect.md` | The resource-architect agent prompt with input discovery, structured output, temp-file write, and explicit authority boundary | FR-1.1 through FR-1.7, FR-2.1 through FR-2.4, FR-5.1 through FR-5.7 |
| `docs/use-cases/resource-architect_use_cases.md` | Use-case scenarios for the feature (authored by `ba-analyst` during this feature's own bootstrap) | Documentation phase deliverable |
| `docs/qa/resource-architect_test_cases.md` | QA test cases (authored by `qa-planner` during this feature's own bootstrap) | Documentation phase deliverable |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/commands/bootstrap-feature.md` | Insert Step 3.5 "Resource Manager-Architect recommendation" between Step 3 and Step 4; document temp-file hand-off; mark step mandatory and non-skippable; document failure behavior halting bootstrap | FR-3.1, FR-3.2, FR-3.3, FR-3.5 |
| `src/agents/planner.md` | Add step to read `.claude/resources-pending.md`, inline content as `## Recommended Resources` top section of `.claude/plan.md` before `## Prerequisites verified`, delete temp file after inlining | FR-2.5, FR-2.6, FR-3.4 |
| `src/claude.md` | Add `resource-architect` row to Agency Roles table between "Software Architect" and "QA Lead"; update "14 agents" prose references to "15 agents"; update Plan Critic prompt to recognize `## Recommended Resources` as valid plan section | FR-6.1, FR-6.2, FR-6.7 |
| `README.md` | Update tagline "14" to "15"; update `## The 14 Agents` heading to `## The 15 Agents`; add `resource-architect` row to agent table; add feature section describing resource-recommendation capability | FR-6.2, FR-6.3, FR-6.4 |
| `install.sh` | Update all five banner strings from "14" to "15" matching the 13→14 propagation pattern from Section 3; verify `src/agents/resource-architect.md` is copied into `~/.claude/agents/` by the default install path | FR-6.5, FR-6.6 |

#### Agent Count Propagation (enumeration of every 14→15 location)

The agent-count propagation MUST update every one of the following locations. This enumeration exists specifically so the Plan Critic can verify no banner is missed during implementation (same diligence applied in Section 1 NFR-5 and Section 3 FR-5.2).

| Location | Current Value | Target Value | Related Requirement |
|----------|---------------|--------------|---------------------|
| `install.sh` banner 1 of 5 | "14" | "15" | FR-6.5 |
| `install.sh` banner 2 of 5 | "14" | "15" | FR-6.5 |
| `install.sh` banner 3 of 5 | "14" | "15" | FR-6.5 |
| `install.sh` banner 4 of 5 | "14" | "15" | FR-6.5 |
| `install.sh` banner 5 of 5 | "14" | "15" | FR-6.5 |
| `README.md` tagline | "14 specialized AI agents" (or equivalent) | "15 specialized AI agents" | FR-6.2 |
| `README.md` section heading | `## The 14 Agents` | `## The 15 Agents` | FR-6.2 |
| `src/claude.md` prose references | "14 agents" (all occurrences) | "15 agents" | FR-6.2 |

Note: the exact wording of the `README.md` tagline and heading MUST be verified during implementation via `grep -n "14" README.md` — the above rows reflect the expected shape based on the Section 3 precedent, but the implementer MUST confirm the literal text before editing.

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Architect review runs at Step 3, before `resource-architect` is invoked. The architect passes its verdict to the bootstrap command as context, not as a direct call to `resource-architect`. No change to the architect prompt itself. |
| `src/agents/ba-analyst.md` | Use-case authoring is not a resource-recommendation input. The agent reads use cases produced by `ba-analyst` at Step 2. |
| `src/agents/qa-planner.md` | QA is Step 4, after `resource-architect`. `qa-planner` MAY optionally read the `## Recommended Resources` section of `.claude/plan.md` when it is produced, but no change to the `qa-planner` prompt is required in iteration 1 — assuming recommended resources exist is a natural consequence of Step 3.5 having run. |
| `src/agents/prd-writer.md` | PRD authoring is Step 2, before `resource-architect`. No change. |
| `src/agents/test-writer.md` | Test writing happens within slices after bootstrap completes. No change. |
| `src/agents/security-auditor.md` | Security review is a pre-slice and post-implementation concern, not a bootstrap-time concern. No change. |
| `src/agents/code-reviewer.md` | Code review runs in Phase 4 quality gates. No change. |
| `src/agents/build-runner.md` | Build verification runs in Phase 4. No change. |
| `src/agents/e2e-runner.md` | E2E tests run in Phase 4. `e2e-runner` MAY benefit from the recommended-resources list (e.g., knowing Playwright MCP is available), but reading the plan's resource section is already implicit in `e2e-runner`'s plan-reading behavior. No prompt change required. |
| `src/agents/verifier.md` | Verification runs in Phase 4. No change. |
| `src/agents/doc-updater.md` | Documentation update runs in Phase 4. No change. |
| `src/agents/refactor-cleaner.md` | Cleanup runs in Phase 2.5. No change. |
| `src/agents/changelog-writer.md` | Shipped in Section 3. `resource-architect` and `changelog-writer` are independent — their outputs go to different files (`.claude/resources-pending.md` vs. `CHANGELOG.md`) and their invocation points are different (bootstrap Step 3.5 vs. four lifecycle hooks). No change to `changelog-writer`. |
| `src/rules/git.md` | Git workflow unchanged. |
| `src/rules/scratchpad.md` | Scratchpad format unchanged. `resource-architect` does NOT read or write the scratchpad (per FR-1.2). |
| `src/rules/error-recovery.md` | Error recovery rules unchanged. A `resource-architect` failure halts bootstrap per FR-3.3 — this is an error-escalation (Rule 4) by design, not a deviation rule change. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. |
| `src/commands/develop-feature.md` | Delegates to `/bootstrap-feature` wholesale, so Step 3.5 is inherited automatically. No prompt change required (per FR-3.6). |
| `src/commands/implement-slice.md` | Slice execution reads `.claude/plan.md` which will contain the `## Recommended Resources` section at the top, but slice implementation itself does not consume the resource list directly. No prompt change. |
| `src/commands/merge-ready.md` | Merge-ready does NOT re-check resource recommendations (per design decision 4 and NFR-9). No change. |
| `src/commands/context-refresh.md` | Context refresh reads scratchpad, not `.claude/plan.md` directly. No change. |
| `templates/rules/changelog.md` | Downstream-project-scoped changelog rule from Section 3. Independent of resource recommendation. No change. |
| `templates/CLAUDE.md` | Downstream-project template from Section 3. Independent of resource recommendation. No change. |

### 4.7 UI Changes, Schema Changes, Affected Endpoints

Not applicable on all three counts. The SDLC project is a collection of markdown prompt files with no UI, database, or API.

### 4.8 Out of Scope for Iteration 1

The following items are explicitly out of scope for iteration 1 and MUST NOT be implemented as part of this section. They are listed explicitly so the Plan Critic does not flag their absence as a gap during iteration 1 planning.

1. **Automatic installation of any recommended resource.** The agent is strictly suggest-only (FR-5.1 through FR-5.7). Automating `claude mcp add`, `npm install`, or cloud-provisioning calls is deferred to a future iteration 2 (if ever).
2. **Merge-ready re-check.** Iteration 1 invokes `resource-architect` exactly once per feature at bootstrap Step 3.5 (NFR-9). Re-checking resource needs at merge-ready — e.g., to detect resources that were recommended but never used, or resources needed but never recommended — is deferred.
3. **Resource cost tracking across features.** Aggregating `expensive` flags across features (e.g., "this sprint commits to 3 `expensive` cloud resources") is deferred. Iteration 1 reports cost/complexity flags per feature only, not aggregated.
4. **Integration with specific cloud-provider SDKs.** The agent produces text recommendations; it does not call AWS, GCP, or Azure APIs to check quotas, estimate costs, or verify credentials. Provider-specific integrations are deferred.
5. **Teardown recommendations when a feature is reverted.** If a feature is merged and later reverted, the agent does not produce a "resources to uninstall" list. Reversibility is captured per-resource at bootstrap time (FR-1.4) so the developer can reason about teardown manually.
6. **Resource conflict detection between features.** If two features in flight both require different versions of the same MCP or library, the agent does not detect the conflict. Cross-feature conflict detection is deferred.
7. **Feature-specific role generation (`role-planner`).** A future agent that would generate optional, feature-specific agents on demand is an unrelated future capability. `resource-architect` is permanent, global, and mandatory (design decision 2); it is NOT the same concept as a hypothetical `role-planner`.
8. **Post-hoc mid-implementation re-invocation.** If a feature's resource needs change during implementation (e.g., a slice reveals a new API dependency), the pipeline does not automatically re-run `resource-architect`. The developer may manually re-invoke it, but the pipeline does not trigger a re-run.
9. **Programmatic validation of the six-field format.** FR-1.4 and NFR-8 specify strict field requirements, but iteration 1 does not add a schema-validation step. Enforcement is via agent prompt guidance and Plan Critic MINOR findings (FR-6.7). A dedicated validator is deferred.
10. **Recommendation quality learning.** The agent does not learn from which of its past recommendations were actually installed versus ignored. Recommendation quality is entirely prompt-driven in iteration 1.

### 4.9 Risks and Dependencies

1. **Risk: Agent over-recommends, flooding the plan with trivial or irrelevant resources.** If the agent is too aggressive, every feature acquires a 30-item resource list and the developer learns to ignore the section entirely. Mitigation: the agent prompt MUST instruct conservative recommendations — only resources the PRD and use cases actually require, with `Why` field explicitly citing the PRD requirement that drives the recommendation (FR-1.4). The summary line (FR-1.6) surfaces `expensive` and `hard` counts at the top so the developer sees cost-commitment shape at a glance.
2. **Risk: Agent under-recommends, missing resources the feature actually needs.** Conversely, overly-conservative recommendations cause mid-slice surprises — the exact problem this feature exists to prevent. Mitigation: the agent prompt MUST include positive-example checklists per category (e.g., "if the PRD mentions browser testing, consider Playwright MCP"). Iteration 1 accepts that this is prompt-quality-dependent and does not attempt automated coverage guarantees.
3. **Risk: Suggest-only authority violated by prompt drift.** Over time, the agent prompt could be revised to make the agent more capable, inadvertently granting it install authority. Mitigation: FR-5.7 restricts the agent's `tools` frontmatter field to exclude `Bash`, making it mechanically impossible for the agent to execute install commands even if the prompt were revised. This is a defense-in-depth measure — the prompt boundary AND the tool boundary both prohibit installs.
4. **Risk: Temp file not cleaned up.** If the planner fails between reading `.claude/resources-pending.md` and deleting it, the temp file persists. Mitigation: FR-2.4 specifies the next bootstrap invocation for the same feature overwrites the file, so stale content cannot be silently merged with new content. `/merge-ready` does not check for the temp file's presence, so a persistent temp file does not block merge.
5. **Risk: Step-number confusion (3.5 vs. 4).** Inserting a half-step between Step 3 and Step 4 deviates from the pattern of integer step numbers used elsewhere in bootstrap. Mitigation: FR-3.5 explicitly preserves Step 4 as QA and Step 5 as planner. The half-step notation is unambiguous. An alternative of renumbering all subsequent steps (Step 4 QA → Step 5 QA, Step 5 planner → Step 6 planner) was considered and rejected because it would churn every cross-reference for no semantic gain.
6. **Risk: Resource-architect blocks bootstrap on trivial failures.** FR-3.3 halts bootstrap if the agent fails, which could block the developer on a transient failure (e.g., the agent crashes on an unusual PRD format). Mitigation: the agent is deterministic and has no network dependencies (FR-5.6), so failure modes are limited. A retry is not automated in iteration 1 — the developer re-invokes `/bootstrap-feature`. If this proves frequent, a future iteration may soften the halt to a warning.
7. **Risk: Agent-count propagation drift.** The 14→15 update touches five `install.sh` banners, two `README.md` locations, and prose in `src/claude.md`. Missing a single location leaves inconsistent documentation. Mitigation: the Agent Count Propagation table in section 4.6 enumerates every location, and the Plan Critic is expected to verify all are addressed before merge (same diligence pattern applied in Section 1 NFR-5 and Section 3 FR-5.2).
8. **Risk: Architect verdict not available to the agent.** FR-1.2 specifies the architect's verdict as an input passed by the bootstrap command. If the bootstrap command's prompt does not actually forward the verdict to the agent, the agent falls back to reading PRD + use cases only. Mitigation: FR-3.1 requires the bootstrap command to document the architect-verdict-as-context hand-off explicitly. Acceptance criterion AC-2 verifies the Step 3.5 documentation in `src/commands/bootstrap-feature.md`.
9. **Dependency: Section 1 FR-3 (Executable Plan Format).** The recommendation structured-field format (FR-1.4) follows the same pattern as the slice structured fields (`Files:`, `Changes:`, `Verify:`, `Done when:`). Section 1 is [SHIPPED], so this dependency is satisfied.
10. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section itself includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT] concurrently; this dependency is satisfied by the prd-writer update in Section 3 FR-3.1. If Section 3 does not ship before Section 4, the `Changelog:` field is documentation-only — it does not affect Section 4's functional requirements.
11. **Dependency: SDLC repo opts out of changelog maintenance.** Per Section 3 design decision 1, the SDLC repo itself has no `.claude/rules/changelog.md`, so `changelog-writer` self-skips for this PRD section (per Section 3 FR-2.2). This is the expected behavior and is NOT a risk — the `Changelog:` field on this section is captured for authoring consistency but does not flow into any `CHANGELOG.md`.
12. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — `resource-architect` runs at bootstrap time, before any slice or wave exists. Wave orchestration is unaffected and is not a dependency in either direction. Listed here only to disclaim the non-relationship.

---

## 5. Role Planner — Iteration 1: On-Demand Role Expansion

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-24
**Priority:** Medium
**Related:** Section 4 (Resource Manager-Architect — shares the bootstrap temp-file-to-planner hand-off pattern and the suggest-only authority model, but covers a strictly disjoint concern: roles vs. external resources), Section 3 (Changelog Writer — shares the pipeline-hook + temp-file + planner-inline pattern; this section includes the `Changelog:` field per Section 3 FR-3), Section 1 (FR-3: Executable Plan Format — the `## Additional Roles` section is inlined into the same `.claude/plan.md` the planner produces)
**Changelog:** Pipeline can now scaffold project-specific roles like mobile-dev or compliance-officer when the core agents aren't enough.

### 5.1 Description

Add a new mandatory agent `role-planner` ("Role Planner") to the global pipeline. The agent runs once per feature during `/bootstrap-feature` — immediately after the resource-architect recommendation (Section 4) and before QA test-case authoring — and recommends ADDITIONAL specialized roles beyond the core 16-agent set when the feature's scope exceeds what the core agents cover. Example triggers: a mobile-app feature needs a "mobile-dev" perspective; a healthcare feature needs a "compliance-officer" perspective; a research-heavy feature needs an "information-researcher". For each recommended role, the agent writes a standalone prompt file at `~/.claude/agents/ondemand-<slug>.md` with `scope: on-demand` frontmatter, and emits a short "call plan" telling the orchestrator at which pipeline step each role should be invoked.

**Why:** The core 16 agents cover the general-purpose SDLC workflow (product, analysis, architecture, QA, planning, TDD, review, build, verification, docs, refactor, changelog, resource architecture, role planning). Some features require domain expertise the core set does not carry — mobile-specific UX review, regulated-industry compliance audit, deep literature research, embedded/hardware signal-integrity review, accessibility audit beyond the code reviewer's scope, localization/i18n review, data-science modeling review. Without a pipeline hook to generate these roles on demand, specialized perspectives are silently absent and the implementer improvises or descopes. A dedicated role-recommendation step — placed between resource architecture and test planning — lets the planner generate feature-specific agent prompts that can then be explicitly invoked by the orchestrator at the right pipeline step, while keeping the core 16 agents unchanged and the generated roles strictly optional and per-feature.

**Audience:** The audience of the `## Additional Roles` section in `.claude/plan.md` is the **orchestrator (main Claude) running the feature's pipeline**, and secondarily the developer reading the plan. The section tells the orchestrator which on-demand roles exist for this feature and at which pipeline step to invoke each.

**Scope boundary:** This section covers **Iteration 1: On-Demand Role Expansion ONLY**. The agent is suggest-plus-prompt-write only — it recommends roles, writes the agent prompt files, and emits a call plan. It does NOT invoke the generated roles itself, does NOT modify core agent prompts, does NOT run shell commands, and does NOT touch external resources (that is resource-architect's scope per Section 4). Automatic teardown of on-demand roles after merge, cross-feature reuse optimization, Claude Code session re-registration, programmatic call-plan validation, and role-planner recommending changes to core agents are all deferred — see 5.8.

**Design decisions:**
1. **Agent name and role title.** The agent file is `src/agents/role-planner.md`. In the Agency Roles table, the role is titled "Role Planner" and the agent column is `role-planner`. The kebab-case name matches the existing `prd-writer`, `changelog-writer`, and `resource-architect` patterns.
2. **Permanent member of the global mandatory scope.** Like `resource-architect` (Section 4 design decision 2), `role-planner` itself is a core pipeline agent installed by the default `install.sh` path (via the `src/agents/*.md` glob at install.sh:202) and invoked in every bootstrap cycle for every feature. The total global agent count rises from 15 to 16. Crucially, `role-planner` is the core agent; the ROLES it GENERATES are on-demand, NOT core — they are optional, per-feature, and live in a different filename space (`ondemand-<slug>.md`) from the core agents.
3. **Pipeline position: Step 3.75 of `/bootstrap-feature`.** The agent is invoked between Step 3.5 (Resource Manager-Architect from Section 4) and Step 4 (QA Lead test cases). The ordering is deliberate: architect validates approach (Step 3), resource-architect recommends EXTERNAL resources informed by the architect's verdict (Step 3.5), role-planner recommends ADDITIONAL INTERNAL roles informed by PRD + use-cases + architect verdict + resource recommendations (Step 3.75), QA then writes test cases that can assume both the resources AND the specialized roles are available (Step 4). The ".75" notation is chosen to avoid renumbering subsequent steps — same pattern as Section 4 design decision 3's ".5" notation.
4. **On-demand scope — generated roles do NOT auto-participate.** Generated `ondemand-<slug>.md` roles are OPTIONAL, one-off, and per-feature. They do NOT automatically run on every feature the way core agents do. They are invoked only when `role-planner` includes them in the feature's call plan, and only at the pipeline step the call plan designates. This is the KEY distinction from core agents and is enforced by two redundant markers (design decision 5).
5. **Distinguishing core vs. on-demand agents — two redundant markers (defense-in-depth).**
   - **Filename prefix:** generated roles live at `~/.claude/agents/ondemand-<slug>.md` (e.g., `ondemand-mobile-dev.md`, `ondemand-compliance-officer.md`, `ondemand-information-researcher.md`). Core agents live at `~/.claude/agents/<name>.md` without the `ondemand-` prefix.
   - **Frontmatter field:** generated roles have `scope: on-demand` in their YAML frontmatter. Core agents either omit the `scope` field or use `scope: core`.
   - The two markers are redundant by design so that missing one (e.g., a future refactor that normalizes filenames) still leaves the other to distinguish scope.
6. **Output contract — temp file plus prompt files plus call plan.**
   - **Temp file:** `.claude/roles-pending.md` — follows the same pattern as `resource-architect`'s `.claude/resources-pending.md` (Section 4 FR-2). At Step 5 the planner inlines its content as a top-level `## Additional Roles` section at the top of `.claude/plan.md` (after `## Recommended Resources` if present, before `## Prerequisites verified`), then MUST delete the temp file.
   - **Prompt files:** `~/.claude/agents/ondemand-<slug>.md` — the actual agent prompts. Written directly to the user's global Claude Code agents directory so they persist across sessions (unlike the temp file).
   - **Call plan:** a `## Role invocation plan` subsection inside `.claude/roles-pending.md` listing, for each recommended role: role name, slug, pipeline step where it should be invoked (e.g., "Step 4: qa-planner", "Step 6: implementation"), and purpose.
7. **Invocation mechanism — spawn via `general-purpose` subagent, no session restart.**
   - Claude Code subagent types are registered at session start. Dynamically-created `ondemand-<slug>.md` files cannot be invoked as `subagent_type: ondemand-<slug>` in the current session because the registry is fixed at startup.
   - **Pattern:** when the orchestrator (main Claude) reaches a call-plan step, it reads `~/.claude/agents/ondemand-<slug>.md`, extracts the prompt body (skipping the YAML frontmatter), and spawns a subagent with `subagent_type: general-purpose`, passing the extracted prompt body as the `prompt` parameter. This works in-session without re-registration.
   - The pattern MUST be documented in the `role-planner` agent prompt itself (so the planner emits correct call-plan entries) AND in the updated `src/commands/bootstrap-feature.md` (so the orchestrator follows the pattern when the call plan is consulted).
8. **Suggest-plus-prompt-write authority — narrower than core agents.**
   - Tools: exactly `["Read", "Write", "Glob", "Grep"]`. NO `Bash`, NO `Edit`, NO `WebFetch`, NO `WebSearch`, NO `NotebookEdit`.
   - Write target: EXCLUSIVELY `~/.claude/agents/ondemand-<slug>.md` files AND the temp file `.claude/roles-pending.md`. The agent MUST NOT write to core agent files (`~/.claude/agents/<name>.md` without the `ondemand-` prefix), `src/agents/*.md`, `settings.json`, `.env` files, MCP configs, `docs/PRD.md`, `docs/use-cases/*`, `docs/qa/*`, `.claude/plan.md`, `.claude/scratchpad.md`, or any other project file outside `.claude/`.
   - No network (same no-network contract as `resource-architect` per Section 4 NFR-6 and `changelog-writer` per Section 3 NFR-7).
   - No shell execution (no `Bash` tool — defense-in-depth same as Section 4 FR-5.7).
9. **Boundary against resource-architect (strictly disjoint).**
   - `resource-architect` recommends EXTERNAL resources: MCP tools, cloud/compute, external APIs, third-party services, libraries/frameworks, hardware (Section 4 FR-4).
   - `role-planner` recommends ADDITIONAL ROLES: new agent prompts that extend the internal pipeline's domain coverage for one feature.
   - The two agents do NOT overlap. `role-planner` MUST NOT recommend adding MCP tools, cloud compute, external services, libraries, or hardware — that is `resource-architect`'s scope. `resource-architect` MUST NOT recommend adding new agents or roles (already enforced in Section 4 FR-5.1 through FR-5.7, which restrict `resource-architect` to suggest-only text about external resources).
   - Cross-reference enforcement: the `role-planner` prompt MUST call out the boundary explicitly and instruct the agent to defer any MCP/cloud/API/service/library/hardware observation to the resource-architect output already present in `.claude/resources-pending.md`.
10. **Agent count propagation (15→16).**
    - `install.sh` — 5 banner locations (current values reflecting "15" from Section 4 FR-6.5; implementer MUST verify with `grep -n "15 specialized\|15 AI agents\|(15 files" install.sh` before editing).
    - `README.md` — 2 locations (tagline currently stating "15"; heading currently stating `## The 15 Agents`).
    - `src/claude.md` — Agency Roles table gets one new row for "Role Planner" after "Resource Manager-Architect" and before "QA Lead"; no "15 agents" prose exists in `src/claude.md` (FR-6.2 pattern from Section 4 held as a no-op for the prose-reference portion, verified by that section's implementation; the no-op holds here as well).
11. **Out of Scope for Iteration 1 — automatic teardown, cross-feature reuse, session re-registration, call-plan validation, core-agent changes.** Enumerated in full in 5.8.
12. **Changelog field value.** The SDLC repo itself has no `.claude/rules/changelog.md` (per Section 3 design decision 1), so `changelog-writer` self-skips for this PRD section. The `Changelog:` field is still required per Section 3 FR-3.3 and is authored accordingly.

### 5.2 User Story

As a developer using the Claude Code SDLC pipeline on a feature whose domain exceeds the core 16-agent scope (e.g., mobile, healthcare compliance, academic research, embedded hardware, accessibility, localization, data science), I want the pipeline to automatically recognize the gap, generate specialized on-demand agent prompts under `~/.claude/agents/ondemand-<slug>.md`, and tell the orchestrator exactly when in the pipeline to invoke each new role — so that domain-specific perspectives are applied at the right moment without permanently bloating the core agent set and without me having to hand-author one-off agent prompts mid-feature.

### 5.3 Functional Requirements

#### FR-1: Role-Planner Agent Specification

A new global agent that recommends feature-specific on-demand roles, writes their prompt files, and emits a call plan during bootstrap.

1. **FR-1.1:** A new file `src/agents/role-planner.md` MUST exist with frontmatter matching the existing agent format (`name: role-planner`, `description`, `tools`, `model: opus` for consistency with Section 1 NFR-4). The `tools` field MUST be exactly `["Read", "Write", "Glob", "Grep"]` per design decision 8 and FR-5.7.
2. **FR-1.2:** The agent's prompt MUST document that it reads the following inputs in order: (a) the newly-written PRD section in `docs/PRD.md` for the current feature, (b) the use-cases file in `docs/use-cases/<feature>_use_cases.md`, (c) the architect's verdict (passed to the agent by `/bootstrap-feature` as context from Step 3), (d) the resource recommendations in `.claude/resources-pending.md` produced by Step 3.5 (so the agent sees which external resources are being introduced and can factor that into role recommendations — e.g., if Playwright MCP is recommended, a dedicated mobile-browser-compat-tester role MIGHT be warranted), (e) the project's `CLAUDE.md` or equivalent context file for tech-stack awareness. The agent MUST NOT read `.claude/scratchpad.md` (matching Section 4 FR-1.2's scratchpad exclusion).
3. **FR-1.3:** The agent MUST produce, for each recommended on-demand role, all three of the following artifacts: (a) an entry in the `## Additional Roles` body of `.claude/roles-pending.md` (per FR-2), (b) a prompt file at `~/.claude/agents/ondemand-<slug>.md` (per FR-2), (c) a call-plan entry in the `## Role invocation plan` subsection of `.claude/roles-pending.md` (per FR-2). The three artifacts MUST be self-consistent: the slug used in the filename MUST match the slug referenced in the call-plan entry MUST match the slug in the body of the `## Additional Roles` section.
4. **FR-1.4:** Each recommended role entry in `## Additional Roles` MUST include all five of the following fields:
    - **Role title:** human-readable name (e.g., "Mobile UX Developer", "Healthcare Compliance Officer", "Information Researcher").
    - **Slug:** kebab-case identifier used in the prompt filename (e.g., `mobile-dev`, `compliance-officer`, `information-researcher`). MUST match `/^[a-z][a-z0-9-]*[a-z0-9]$/`.
    - **Why:** a one-sentence rationale tied to specific PRD requirements and/or use-case scenarios, citing the PRD section and FR number where applicable (e.g., "PRD Section 7 FR-2.3 requires iOS accessibility compliance — a dedicated mobile-dev role owns VoiceOver test case authoring during QA").
    - **Pipeline step to invoke:** exactly one of the known bootstrap or implementation step labels (e.g., "Step 4: qa-planner" for pre-QA invocation, "Step 6: implementation" for per-slice invocation, "Step 7: merge-ready" for post-implementation review). The call plan MUST name the step the orchestrator will recognize.
    - **Purpose at that step:** a one-sentence description of what the on-demand role produces at the named step (e.g., "Authors mobile-specific test cases alongside the core QA test cases", "Reviews each slice's accessibility posture during implementation").
5. **FR-1.5:** When the feature has NO additional-role needs (e.g., a routine backend refactor that is fully covered by the core 16 agents), the agent MUST emit an explicit "No additional roles required" statement as the body of the output, NOT an empty file and NOT a no-op return. The explicit statement is required so downstream consumers (planner, orchestrator, human reader) can distinguish "considered and none needed" from "agent did not run" — same pattern as Section 4 FR-1.5.
6. **FR-1.6:** The agent MUST output a short top-level summary above the per-role details: total count of recommended roles, count of roles invoked at bootstrap-time steps (Steps 3.75, 4), count of roles invoked at implementation-time steps (Steps 5, 6, 7). This lets the developer see the rough shape of additional-role participation before reading details.
7. **FR-1.7:** The agent MUST write the on-demand prompt file for each recommended role at `~/.claude/agents/ondemand-<slug>.md`. Each on-demand prompt file MUST contain:
    - YAML frontmatter with fields: `name: ondemand-<slug>`, `description` (a one-sentence role description), `tools` (restricted to the minimum set the role needs — typically `["Read", "Write", "Grep", "Glob"]`; never includes `Bash` unless the role genuinely requires shell execution and the rationale is documented in the `description`), `model: opus` for consistency with other agents, `scope: on-demand` (REQUIRED per design decision 5).
    - A prompt body specific to the role, including: the role's responsibility, the inputs it expects when invoked, the output format, and any authority boundaries.
    - The prompt body MUST NOT instruct the role to modify core agent files, install dependencies, or exceed the tools declared in its own frontmatter.
8. **FR-1.8:** When recommending roles, the agent MUST apply the CORE-VS-ON-DEMAND heuristic: the agent MUST NOT recommend a role whose responsibility is already covered by a core 16 agent. If the proposed role's scope overlaps >50% with an existing core agent (e.g., "code-quality-reviewer" overlaps with `code-reviewer`), the agent MUST either merge the concern into the call plan for the existing core agent (as a context note, not a new role), or drop the recommendation. The agent prompt MUST enumerate the 16 core agents by name and responsibility to support this heuristic.

#### FR-2: Output File Contract (temp-file + on-demand prompt files + call plan)

Define the contract for `.claude/roles-pending.md` (the temp file handed to the planner) and `~/.claude/agents/ondemand-<slug>.md` (the persisted agent prompts).

1. **FR-2.1:** The agent MUST write its structured output to `.claude/roles-pending.md` in the project CWD. The agent MUST NOT write this temp file to any other location, MUST NOT write directly to `.claude/plan.md`, and MUST NOT modify `docs/PRD.md`, `docs/use-cases/*`, `docs/qa/*`, or any other non-temp project file.
2. **FR-2.2:** The temp file's content MUST be a self-contained markdown fragment starting with a top-level `## Additional Roles` heading, followed by the summary line (per FR-1.6), followed by per-role blocks with the five FR-1.4 fields, followed by a `## Role invocation plan` subsection enumerating each role's invocation target. No frontmatter, no agent-meta commentary, no trailing "end of output" markers.
3. **FR-2.3:** The agent MUST write each recommended role's full prompt to `~/.claude/agents/ondemand-<slug>.md` (tilde expanded to the user's home directory). The agent MUST create the file with the `ondemand-` filename prefix, `name: ondemand-<slug>` frontmatter, and `scope: on-demand` frontmatter per design decision 5. The agent MUST NOT write to any path in `~/.claude/agents/` that does NOT begin with the literal `ondemand-` prefix — writing to, for example, `~/.claude/agents/code-reviewer.md` is strictly prohibited.
4. **FR-2.4:** If `.claude/roles-pending.md` already exists when `role-planner` runs (e.g., leftover from a previous aborted bootstrap), the agent MUST overwrite it without prompting. Stale content from a previous run MUST NOT be appended to or merged with the new content — same contract as Section 4 FR-2.4.
5. **FR-2.5:** If an `~/.claude/agents/ondemand-<slug>.md` file already exists with a slug the agent wants to re-use (e.g., a previous feature generated `ondemand-mobile-dev.md`), the agent MUST overwrite it with the current feature's version. Cross-feature reuse optimization is out of scope for iteration 1 (per 5.8) — overwriting is safe because prompt files are regenerated per feature.
6. **FR-2.6:** The `planner` agent prompt (`src/agents/planner.md`) MUST be updated to include a new step in its Process or Output Format section: "Read `.claude/roles-pending.md` if it exists. Inline its content verbatim (preserving all formatting) as a top-level `## Additional Roles` section in `.claude/plan.md`, placed immediately after any `## Recommended Resources` section produced by `resource-architect` (or at the very top if `## Recommended Resources` is absent), and before `## Prerequisites verified`. After successful inlining, delete `.claude/roles-pending.md`. If the file does not exist, skip this step silently."
7. **FR-2.7:** The inlined `## Additional Roles` section in `.claude/plan.md` MUST appear near the top of the plan file — after `## Recommended Resources` (if present) and before `## Prerequisites verified`. The existing `## Recommended Resources` inlining behavior from Section 4 FR-2.6 MUST be preserved unchanged; the new section is inserted at the location between that and `## Prerequisites verified`.
8. **FR-2.8:** The on-demand prompt files at `~/.claude/agents/ondemand-<slug>.md` MUST persist across sessions — they are NOT deleted by the planner, NOT deleted by `/merge-ready`, and NOT deleted by any pipeline command in iteration 1. Teardown is the developer's manual concern (per 5.8 item 1).

#### FR-3: Pipeline Integration (bootstrap-feature Step 3.75 + planner update + general-purpose invocation pattern)

Integrate the agent as a mandatory, non-skippable step of `/bootstrap-feature`, wire the planner to consume the temp file, and document the general-purpose subagent invocation pattern for on-demand roles.

1. **FR-3.1:** `src/commands/bootstrap-feature.md` MUST be updated to insert a new Step 3.75 between the existing Step 3.5 (Resource Manager-Architect, from Section 4 FR-3.1) and Step 4 (QA Lead test cases). The step's title MUST be "Role Planner recommendation" and its body MUST document: the delegation to the `role-planner` agent, the inputs the agent will read (per FR-1.2), the expected outputs (`.claude/roles-pending.md` temp file AND zero-or-more `~/.claude/agents/ondemand-<slug>.md` prompt files), the hand-off contract to the planner at Step 5 (per FR-2.6), and the general-purpose invocation pattern for on-demand roles (per FR-3.4).
2. **FR-3.2:** Step 3.75 MUST be a mandatory, non-skippable step. `/bootstrap-feature` MUST NOT offer a flag or heuristic to skip role planning. Features with no additional-role needs are handled by the agent producing an explicit "No additional roles required" output per FR-1.5, not by skipping the step.
3. **FR-3.3:** If the `role-planner` agent fails (e.g., crashes or returns an error), `/bootstrap-feature` MUST report the failure to the user and MUST NOT proceed to Step 4. This mirrors Section 4 FR-3.3 for `resource-architect`.
4. **FR-3.4:** `src/commands/bootstrap-feature.md` MUST document the general-purpose invocation pattern for on-demand roles. The documentation MUST explain: (a) why dynamically-created `ondemand-<slug>.md` files cannot be used as `subagent_type: ondemand-<slug>` (subagent types are registered at session start, per design decision 7), (b) the workaround: the orchestrator reads `~/.claude/agents/ondemand-<slug>.md`, extracts the prompt body (skipping YAML frontmatter), and spawns `subagent_type: general-purpose` with the extracted prompt as the `prompt` parameter, (c) at which pipeline steps the orchestrator consults the `## Role invocation plan` subsection to determine which on-demand roles to spawn.
5. **FR-3.5:** `src/agents/planner.md` MUST be updated per FR-2.6 to read `.claude/roles-pending.md`, inline its content at the correct position in `.claude/plan.md` (after `## Recommended Resources` if present, before `## Prerequisites verified`), and delete the temp file. The planner's other existing responsibilities — Section 1 FR-3 executable plan fields, Section 2 wave assignment, Section 4 FR-2.5 `## Recommended Resources` inlining — MUST be preserved unchanged. The new inlining step for `## Additional Roles` is ADDITIVE to the existing `## Recommended Resources` inlining step.
6. **FR-3.6:** The step-number change in `/bootstrap-feature` (Step 3 → Step 3.5 → Step 3.75 → Step 4 → Step 5) MUST be reflected consistently across all cross-referencing command files. Any existing references to "Step 4" that mean the QA step MUST remain accurate (QA is still Step 4); any existing references to "Step 5" that mean the planner MUST remain accurate (planner is still Step 5). The new Step 3.75 is inserted without renumbering the subsequent steps — same pattern as Section 4 FR-3.5.
7. **FR-3.7:** The `/develop-feature` command MUST continue to invoke `/bootstrap-feature` as a delegated subcommand with no direct change to `/develop-feature`'s own prompt — same pattern as Section 4 FR-3.6. Because `/develop-feature` delegates bootstrap work wholesale, the new Step 3.75 is inherited automatically. No update to `src/commands/develop-feature.md` is required for role planning wiring.

#### FR-4: Scope Boundaries (what role-planner may and may not recommend)

Define precisely which role categories are in and out of scope, and enforce the boundary against resource-architect's external-resource scope.

1. **FR-4.1:** The agent MAY recommend roles covering domain expertise the core 16 agents do not carry. Examples the prompt MUST enumerate as positive cases: mobile-app development (iOS/Android UX, native framework specifics), healthcare compliance (HIPAA, HL7/FHIR), financial compliance (PCI-DSS, SOX), accessibility audit beyond baseline code review (WCAG 2.2 AA/AAA), localization/internationalization, data-science/ML modeling, embedded/hardware signal-integrity review, academic/literature research, legal review, UX research, SEO audit, cryptography review. These categories are NON-EXHAUSTIVE — the agent MAY recommend any domain role whose expertise is genuinely absent from the core 16.
2. **FR-4.2:** The agent MUST NOT recommend roles that overlap with core 16 agent responsibilities (per FR-1.8). The agent prompt MUST enumerate the 16 core agents' responsibilities inline to support the overlap check: `prd-writer` (requirements), `ba-analyst` (use cases), `architect` (technical design), `qa-planner` (test cases), `planner` (implementation plan), `security-auditor` (security review), `test-writer` (TDD tests), `code-reviewer` (code quality), `build-runner` (build/typecheck), `e2e-runner` (E2E tests), `verifier` (wiring and data flow), `doc-updater` (docs accuracy), `refactor-cleaner` (post-implementation cleanup), `changelog-writer` (changelog maintenance), `resource-architect` (external resources), `role-planner` (itself — self-reference included for completeness).
3. **FR-4.3:** The agent MUST NOT recommend adding MCP tools, cloud compute, external APIs, third-party services, libraries/frameworks, or hardware. That is strictly `resource-architect`'s scope (Section 4 FR-4). The `role-planner` prompt MUST call out this boundary explicitly and instruct the agent to defer any external-resource observation to the `.claude/resources-pending.md` file already produced at Step 3.5. Symmetrically, `resource-architect` MUST NOT recommend adding new agents or roles (already enforced by Section 4 FR-5.1 through FR-5.7, which restrict `resource-architect`'s authority to suggest-only text about external resources); `role-planner` relies on that existing enforcement and does not duplicate it.
4. **FR-4.4:** The agent MUST NOT recommend modifying core agent prompts. Core agents (`src/agents/*.md` without the `ondemand-` prefix) are outside `role-planner`'s authority. If the agent observes that a core agent's scope is genuinely insufficient for a broad class of features, it MAY note this as a comment in the `## Additional Roles` body (flagged as "OBSERVATION:" prefix) but MUST NOT generate an `ondemand-<slug>.md` file that overrides a core agent and MUST NOT write to `src/agents/*.md` or `~/.claude/agents/<non-ondemand-name>.md`.
5. **FR-4.5:** The agent MUST NOT recommend generic "helper" or "utility" roles whose purpose is to collapse multiple core-agent responsibilities into one. The agent's recommendations MUST be domain-specific (mobile, healthcare, accessibility, etc.), NOT workflow-structural (e.g., "meta-reviewer", "everything-checker" are prohibited).
6. **FR-4.6:** The agent MUST recommend roles at most one per clearly distinct domain per feature. If a feature spans multiple domains (e.g., mobile AND compliance), the agent MAY recommend one role per domain (so two roles total), but MUST NOT recommend multiple roles within the same domain (e.g., "mobile-ios-dev" plus "mobile-android-dev" — should be a single `mobile-dev` with both platforms in scope).
7. **FR-4.7:** The total number of roles recommended per feature SHOULD be conservative — typically 0 to 3. A recommendation of 4+ roles signals the feature is too broad and should be split, or the agent is over-recommending (the same risk posture applies here as Section 4 NFR-7 for `resource-architect`). The agent prompt MUST include this conservative guidance.

#### FR-5: Authority Boundaries (suggest + write ondemand-*.md + write roles-pending.md only)

Enforce the narrow authority boundary with explicit prohibitions in the agent prompt.

1. **FR-5.1:** The agent prompt MUST contain an explicit "Authority Boundary" section listing both PERMITTED actions and PROHIBITED actions. PERMITTED actions: read the five input sources in FR-1.2, write to `.claude/roles-pending.md`, write to `~/.claude/agents/ondemand-<slug>.md` files. PROHIBITED actions per the rest of FR-5.
2. **FR-5.2:** The agent MUST NOT modify core agent prompts — neither `src/agents/*.md` (project source) nor `~/.claude/agents/<name>.md` without the `ondemand-` prefix (user-installed). Writing to, e.g., `~/.claude/agents/code-reviewer.md` or `src/agents/planner.md` is strictly prohibited.
3. **FR-5.3:** The agent MUST NOT modify `~/.claude/settings.json`, any project-local `.claude/settings.json`, or any Claude Code configuration file — same contract as Section 4 FR-5.2 for `resource-architect`.
4. **FR-5.4:** The agent MUST NOT modify MCP configuration (e.g., `~/.claude/mcp.json` or equivalent), MUST NOT invoke `claude mcp add`/`claude mcp remove`, and MUST NOT recommend MCP configuration changes (that is `resource-architect`'s scope per FR-4.3 and Section 4 FR-4.2).
5. **FR-5.5:** The agent MUST NOT modify `.env`, `.envrc`, or any secrets store — same contract as Section 4 FR-5.4.
6. **FR-5.6:** The agent MUST NOT make network calls (HTTP, DNS, git fetch, etc.) — same no-network contract as Section 4 FR-5.6 and Section 3 NFR-7. All inputs are local files.
7. **FR-5.7:** The agent's `tools` frontmatter field MUST be exactly `["Read", "Write", "Glob", "Grep"]`. The `Bash` tool MUST NOT be included — excluding Bash at the tool-declaration level is a defense-in-depth measure mechanically preventing accidental `npm install`, `claude mcp add`, or any shell invocation, same pattern as Section 4 FR-5.7. The `Edit`, `WebFetch`, `WebSearch`, and `NotebookEdit` tools MUST NOT be included either — the agent creates new files (Write) rather than editing existing ones, has no web-research needs (all inputs are local), and has no notebook needs.
8. **FR-5.8:** The agent MUST NOT write to any file outside the two permitted target directories: `.claude/` in the project CWD (specifically the `.claude/roles-pending.md` temp file) and `~/.claude/agents/` in the user's home (specifically files matching `ondemand-*.md`). Any attempt to write outside these locations MUST be surfaced as an agent self-check failure in its prompt.

#### FR-6: Registration and Documentation (Agency Roles, README, install.sh)

Register the new agent in the agency table, update all agent-count references from 15 to 16, and document the feature in the README.

1. **FR-6.1:** `src/claude.md` Agency Roles table MUST be updated to include a new row: Role = "Role Planner", Agent = `role-planner`, Responsibility = "Recommend additional on-demand roles (mobile-dev, compliance-officer, etc.) beyond the core 16 when a feature's domain exceeds core scope". The row MUST be placed in the table at a position consistent with pipeline order — after "Resource Manager-Architect" (Step 3.5) and before "QA Lead" (Step 4).
2. **FR-6.2:** `src/claude.md` currently contains NO "15 agents" prose references (verified during Section 4 implementation — the `src/claude.md` prose update held as a no-op for FR-6.2 of Section 4). No prose update is required in `src/claude.md` for this section either; however, the implementer MUST re-verify with `grep -n "15 agents\|15 specialized" src/claude.md` before proceeding. If Section 4 implementation introduced any "15 agents" prose (contrary to its own FR-6.2 no-op), those references MUST be updated to "16 agents".
3. **FR-6.3:** `README.md` MUST have its tagline updated from "15 specialized AI agents" (or equivalent wording introduced by Section 4 FR-6.2) to "16 specialized AI agents". The tagline line number is approximately 5 (same location updated by Section 4); the implementer MUST verify with `grep -n "15 specialized\|15 AI agents" README.md` before editing.
4. **FR-6.4:** `README.md` MUST have its agents-section heading updated from `## The 15 Agents` (introduced by Section 4 FR-6.2) to `## The 16 Agents`. The heading line number is approximately 95; the implementer MUST verify the exact line and wording before editing.
5. **FR-6.5:** `README.md` MUST include a new row for `role-planner` in its agent table/list alongside the existing 15 agents, placed consistent with the Agency Roles table ordering (after `resource-architect`, before `qa-planner`).
6. **FR-6.6:** `README.md` MUST add a feature section (or update an existing features list) explaining that the pipeline now generates on-demand specialized agents when a feature's domain exceeds the core 16 agents' scope. The section MUST describe: (a) the on-demand-vs-core distinction, (b) the `ondemand-<slug>.md` filename and `scope: on-demand` frontmatter conventions, (c) the general-purpose subagent invocation pattern (per design decision 7 and FR-3.4), (d) concrete examples (mobile-dev, compliance-officer, information-researcher).
7. **FR-6.7:** `install.sh` banner strings MUST be updated from "15" to "16" in all five banner locations updated by Section 4 FR-6.5. The implementer MUST verify the banner strings still exist with "15" using `grep -n "15 specialized\|15 AI agents\|(15 files" install.sh` before editing. The enumeration is in the Agent Count Propagation subsection of 5.6.
8. **FR-6.8:** `install.sh` MUST copy `src/agents/role-planner.md` into `~/.claude/agents/` as part of the default install path (NOT gated behind `--init-project`), same pattern as Section 4 FR-6.6. The install.sh already uses a glob over `src/agents/*.md` at line 202 (verified per Feature #4 implementation); no explicit file list extension is required — the new file is picked up automatically by the existing glob. Implementer MUST verify this assumption holds before concluding no change is needed.
9. **FR-6.9:** The Plan Critic prompt in `src/claude.md` MUST be updated to recognize `## Additional Roles` as a valid top-level section of `.claude/plan.md`. The update MUST mirror the `## Recommended Resources` bullet added by Section 4 FR-6.7: absence of the `## Additional Roles` section is NOT a critic finding (legacy plans and plans from pre-iteration-1 branches will lack the section); presence of the section with malformed role blocks or inconsistent slug references MAY be a MINOR finding.
10. **FR-6.10:** `templates/rules/` MUST NOT be modified. `role-planner` does NOT add a new rule template — same rationale as Section 4 (the agent is a global pipeline addition, not a per-project opt-in). The absence of a `templates/rules/role-planner.md` file is intentional and MUST NOT be flagged by the Plan Critic as a gap.

### 5.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files only. No runtime code (JavaScript, TypeScript, Python) is introduced. `install.sh` is modified only for banner strings (per FR-6.7) and file-copy verification (per FR-6.8); the shell logic itself is not restructured.
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Projects using SDLC v3.1.0 or the iteration-1 version of Sections 3 and 4 MUST continue to function after upgrading. Existing `.claude/plan.md` files without `## Additional Roles` sections MUST continue to parse correctly (the planner's inlining step is a no-op if `.claude/roles-pending.md` does not exist, per FR-2.6).
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). No migration steps beyond re-running the installer.
4. **NFR-4:** The `role-planner` agent MUST use the `opus` model consistent with all other agents (per Section 1 NFR-4).
5. **NFR-5:** The total global agent count rises from 15 to 16. All documentation references MUST be updated (per FR-6.3, FR-6.4, FR-6.5, FR-6.7). Note: the 16-agent count refers to the CORE agents. On-demand roles generated by `role-planner` are NOT counted in the "16 agents" tally — they are per-feature, optional, and explicitly distinguished by filename prefix and frontmatter (per design decision 5).
6. **NFR-6:** The agent MUST NOT access the network (per FR-5.6). All inputs are local files.
7. **NFR-7:** The agent's typical wall-clock runtime SHOULD be under 30 seconds per invocation — same soft target as Section 4 NFR-7. Because the agent runs once per feature at bootstrap time (Step 3.75, not per slice, not per wave), runtime is not latency-critical.
8. **NFR-8:** The structured recommendation format (five fields per role per FR-1.4) MUST be strict. Role entries missing any of the five fields are malformed and SHOULD be flagged by the Plan Critic as a MINOR finding (per FR-6.9). Iteration 1 does not enforce format strictness programmatically.
9. **NFR-9:** The agent is one-shot per bootstrap — no re-check in `/merge-ready`, no continuous sync, no re-run on subsequent slices (parallel to Section 4 NFR-9). If the feature's role needs change mid-implementation, the developer may manually re-invoke the agent, but the pipeline does not do so automatically.
10. **NFR-10:** Generated on-demand prompt files at `~/.claude/agents/ondemand-<slug>.md` persist across sessions and across features. The pipeline does NOT garbage-collect stale on-demand roles from previous features in iteration 1 — teardown is the developer's manual concern (per 5.8 item 1). This is a deliberate simplification; cross-feature reuse and teardown are deferred to iteration 2.
11. **NFR-11:** On-demand role invocation via `subagent_type: general-purpose` is a session-safe pattern (per design decision 7). It works in the same Claude Code session where the role was generated, without requiring a session restart or re-registration. This is verified by construction — `general-purpose` is a always-registered subagent type in Claude Code, and passing a custom prompt to it does not require registry mutation.

### 5.5 Acceptance Criteria

1. **AC-1:** A file `src/agents/role-planner.md` exists with valid frontmatter (`name: role-planner`, `description`, `tools: ["Read", "Write", "Glob", "Grep"]` per FR-5.7 with no `Bash`/`Edit`/`WebFetch`/`WebSearch`/`NotebookEdit`, `model: opus`) and a prompt that implements the input-reading (FR-1.2), structured output (FR-1.3 through FR-1.8), temp-file write (FR-2.1, FR-2.2, FR-2.4), on-demand prompt-file write (FR-2.3, FR-2.5, FR-2.8), and authority boundary (FR-5.1 through FR-5.8) specifications.
2. **AC-2:** `src/commands/bootstrap-feature.md` contains an explicit Step 3.75 "Role Planner recommendation" between Step 3.5 (resource-architect) and Step 4 (QA), delegating to `role-planner` and documenting the temp-file hand-off AND the general-purpose invocation pattern (per FR-3.1, FR-3.4).
3. **AC-3:** `src/commands/bootstrap-feature.md` explicitly states that Step 3.75 is mandatory and non-skippable, and that a `role-planner` failure halts bootstrap at Step 3.75 (per FR-3.2, FR-3.3).
4. **AC-4:** `src/commands/bootstrap-feature.md` explains the general-purpose invocation pattern for on-demand roles: the orchestrator reads `~/.claude/agents/ondemand-<slug>.md`, extracts the prompt body, and spawns `subagent_type: general-purpose` with the prompt as the `prompt` parameter (per FR-3.4). The explanation MUST include the rationale — that dynamically-created subagent types cannot be invoked directly as `subagent_type: ondemand-<slug>` because Claude Code registers subagent types at session start.
5. **AC-5:** `src/agents/planner.md` includes an explicit instruction to read `.claude/roles-pending.md` (if present), inline its content verbatim as a `## Additional Roles` section in `.claude/plan.md` placed after any `## Recommended Resources` section (and before `## Prerequisites verified`), and delete the temp file after inlining (per FR-2.6, FR-2.7). The existing `## Recommended Resources` inlining behavior from Section 4 FR-2.5 is preserved (per FR-3.5).
6. **AC-6:** The Agency Roles table in `src/claude.md` has a row for `role-planner` with Role = "Role Planner" placed between "Resource Manager-Architect" and "QA Lead" (per FR-6.1). If any "15 agents" prose is present in `src/claude.md`, it is updated to "16 agents" (per FR-6.2).
7. **AC-7:** `README.md` updates the tagline from "15 specialized AI agents" (or equivalent) to "16 specialized AI agents" (per FR-6.3), updates the `## The 15 Agents` heading to `## The 16 Agents` (per FR-6.4), includes a row for `role-planner` in the agent table (per FR-6.5), and adds a feature section describing on-demand role expansion including the general-purpose invocation pattern (per FR-6.6).
8. **AC-8:** `install.sh` has all five banner strings containing "15" updated to "16", matching the propagation pattern used for the 14→15 transition in Section 4 (per FR-6.7).
9. **AC-9:** `install.sh` copies `src/agents/role-planner.md` into `~/.claude/agents/` as part of the default install path. After running `bash install.sh` on a clean machine, the file `~/.claude/agents/role-planner.md` exists (per FR-6.8). Verified by confirming the existing `src/agents/*.md` glob at install.sh:202 picks up the new file without explicit changes.
10. **AC-10:** When `/bootstrap-feature` is invoked end-to-end for a new feature, the sequence of steps is: 1 (user intent) → 2 (PRD) → 3 (architect) → 3.5 (resource-architect) → 3.75 (role-planner) → 4 (QA) → 5 (planner), and the resulting `.claude/plan.md` contains the sections in the order `## Recommended Resources` (if any resources recommended) → `## Additional Roles` (if any roles recommended) → `## Prerequisites verified` → slices (per FR-2.7, FR-3.1).
11. **AC-11:** When `/bootstrap-feature` is invoked for a feature with no additional-role needs (e.g., a routine backend refactor fully covered by the core 16 agents), the `## Additional Roles` section contains the explicit statement "No additional roles required" (per FR-1.5), and no `ondemand-<slug>.md` files are created during that bootstrap.
12. **AC-12:** When `/bootstrap-feature` is invoked for a feature with additional-role needs (e.g., a mobile-app feature), the `role-planner` creates one or more `~/.claude/agents/ondemand-<slug>.md` files. Each generated file has `name: ondemand-<slug>` frontmatter, `scope: on-demand` frontmatter, a `tools` field restricted per FR-1.7, and a non-empty prompt body (per FR-1.7, FR-2.3).
13. **AC-13:** After a successful bootstrap, the file `.claude/roles-pending.md` does NOT exist (the planner has inlined and deleted it per FR-2.6). The `ondemand-<slug>.md` files in `~/.claude/agents/` persist (per FR-2.8).
14. **AC-14:** The agent's `tools` frontmatter field is exactly `["Read", "Write", "Glob", "Grep"]` and does NOT include `Bash`, `Edit`, `WebFetch`, `WebSearch`, or `NotebookEdit` (per FR-5.7). Verifiable via `grep -n "tools:" src/agents/role-planner.md`.
15. **AC-15:** Each on-demand role entry in the agent's `## Additional Roles` output includes all five fields (Role title, Slug, Why, Pipeline step to invoke, Purpose at that step) in the specified value domains (per FR-1.4). Verifiable by running the agent on a sample feature and inspecting the output.
16. **AC-16:** The `## Role invocation plan` subsection inside `.claude/roles-pending.md` enumerates each recommended role with its slug, pipeline step, and purpose — and every listed slug corresponds to a `~/.claude/agents/ondemand-<slug>.md` file actually written by the agent (per FR-1.3). No orphan slugs, no orphan prompt files.
17. **AC-17:** The Plan Critic prompt in `src/claude.md` recognizes `## Additional Roles` as a valid top-level plan section (per FR-6.9). Its absence is NOT flagged. The existing Section 4 FR-6.7 bullet for `## Recommended Resources` is preserved.
18. **AC-18:** The agent prompt explicitly documents the resource-architect boundary (FR-4.3) — it defers all MCP/cloud/API/service/library/hardware recommendations to `resource-architect` and does NOT produce such recommendations itself.
19. **AC-19:** The agent prompt enumerates the 16 core agents by name and responsibility (per FR-4.2) to support the CORE-VS-ON-DEMAND overlap check (per FR-1.8). The enumeration is present verbatim and matches the Agency Roles table in `src/claude.md`.
20. **AC-20:** Cross-references are valid: the agent registered in `src/claude.md` has a corresponding `src/agents/role-planner.md` file; `src/commands/bootstrap-feature.md` references the agent by its exact registered name; `src/agents/planner.md` references the exact temp-file path `.claude/roles-pending.md`; no phantom paths. Verifiable by Glob/Grep over each referenced path.

### 5.6 Affected Components

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `src/agents/role-planner.md` | The role-planner agent prompt with input discovery, structured output, temp-file write, on-demand prompt-file write, and explicit authority boundary | FR-1.1 through FR-1.8, FR-2.1 through FR-2.5, FR-5.1 through FR-5.8 |
| `docs/use-cases/role-planner_use_cases.md` | Use-case scenarios for the feature (authored by `ba-analyst` during this feature's own bootstrap) | Documentation phase deliverable |
| `docs/qa/role-planner_test_cases.md` | QA test cases (authored by `qa-planner` during this feature's own bootstrap) | Documentation phase deliverable |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/commands/bootstrap-feature.md` | Insert Step 3.75 "Role Planner recommendation" between Step 3.5 and Step 4; document temp-file hand-off; document general-purpose subagent invocation pattern for on-demand roles; mark step mandatory and non-skippable; document failure behavior halting bootstrap | FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.6 |
| `src/agents/planner.md` | Add step to read `.claude/roles-pending.md`, inline content as `## Additional Roles` top section of `.claude/plan.md` placed after any `## Recommended Resources` section, delete temp file after inlining. Preserve existing `## Recommended Resources` inlining from Section 4 FR-2.5. | FR-2.6, FR-2.7, FR-3.5 |
| `src/claude.md` | Add `role-planner` row to Agency Roles table between "Resource Manager-Architect" and "QA Lead"; update any "15 agents" prose references to "16 agents" (verify via grep — may be a no-op); update Plan Critic prompt to recognize `## Additional Roles` as a valid plan section (mirroring the `## Recommended Resources` bullet from Section 4 FR-6.7) | FR-6.1, FR-6.2, FR-6.9 |
| `README.md` | Update tagline "15" to "16"; update `## The 15 Agents` heading to `## The 16 Agents`; add `role-planner` row to agent table; add feature section describing on-demand role expansion including the general-purpose invocation pattern | FR-6.3, FR-6.4, FR-6.5, FR-6.6 |
| `install.sh` | Update all five banner strings from "15" to "16" matching the 14→15 propagation pattern from Section 4; verify `src/agents/role-planner.md` is copied into `~/.claude/agents/` by the default install path's `src/agents/*.md` glob at install.sh:202 | FR-6.7, FR-6.8 |

#### Agent Count Propagation (enumeration of every 15→16 location)

The agent-count propagation MUST update every one of the following locations. This enumeration exists specifically so the Plan Critic can verify no banner is missed during implementation — same diligence applied in Section 1 NFR-5, Section 3 FR-5.2, and Section 4 FR-6.5.

| Location | Current Value | Target Value | Related Requirement |
|----------|---------------|--------------|---------------------|
| `install.sh` banner 1 of 5 | "15" | "16" | FR-6.7 |
| `install.sh` banner 2 of 5 | "15" | "16" | FR-6.7 |
| `install.sh` banner 3 of 5 | "15" | "16" | FR-6.7 |
| `install.sh` banner 4 of 5 | "15" | "16" | FR-6.7 |
| `install.sh` banner 5 of 5 | "15" | "16" | FR-6.7 |
| `README.md` tagline | "15 specialized AI agents" (or equivalent from Section 4) | "16 specialized AI agents" | FR-6.3 |
| `README.md` section heading | `## The 15 Agents` | `## The 16 Agents` | FR-6.4 |
| `src/claude.md` prose references | "15 agents" (all occurrences — may be zero; verify with grep) | "16 agents" | FR-6.2 |

Note: the exact wording of the `README.md` tagline and heading MUST be verified during implementation via `grep -n "15" README.md` — the above rows reflect the expected shape based on the Section 4 precedent, but the implementer MUST confirm the literal text before editing.

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Architect review runs at Step 3, before `role-planner` is invoked. The architect passes its verdict to the bootstrap command as context, not as a direct call to `role-planner`. No change to the architect prompt itself. |
| `src/agents/ba-analyst.md` | Use-case authoring is a role-planner input (per FR-1.2) but `ba-analyst` itself does not need to know about role-planner. No prompt change. |
| `src/agents/qa-planner.md` | QA is Step 4, after `role-planner`. `qa-planner` MAY optionally be aware that on-demand roles (e.g., mobile-dev) may author additional test cases at Step 4 alongside the core QA test cases, but no change to the `qa-planner` prompt is required in iteration 1 — assuming on-demand test-case authors exist is a natural consequence of Step 3.75 having run. |
| `src/agents/prd-writer.md` | PRD authoring is Step 2, before `role-planner`. No change. |
| `src/agents/test-writer.md` | Test writing happens within slices after bootstrap completes. On-demand roles invoked at implementation-time (e.g., an "accessibility-reviewer" invoked per slice) do not require `test-writer` changes — the orchestrator invokes the on-demand role alongside `test-writer`, not as a modification to it. No change. |
| `src/agents/security-auditor.md` | Security review is a pre-slice and post-implementation concern. On-demand security-adjacent roles (e.g., "healthcare-compliance-officer") are separate concerns, invoked alongside the core security auditor, not in place of it. No change. |
| `src/agents/code-reviewer.md` | Code review runs in Phase 4 quality gates. On-demand reviewers (e.g., "accessibility-reviewer") are invoked in addition to the core `code-reviewer`, not in place of it. No change. |
| `src/agents/build-runner.md` | Build verification runs in Phase 4. No change. |
| `src/agents/e2e-runner.md` | E2E tests run in Phase 4. On-demand E2E roles (e.g., "mobile-e2e-runner") are invoked alongside, not in place of. No change. |
| `src/agents/verifier.md` | Verification runs in Phase 4. No change. |
| `src/agents/doc-updater.md` | Documentation update runs in Phase 4. No change. |
| `src/agents/refactor-cleaner.md` | Cleanup runs in Phase 2.5. No change. |
| `src/agents/changelog-writer.md` | Shipped in Section 3. `role-planner` and `changelog-writer` are independent — their outputs go to different files (`.claude/roles-pending.md` + `~/.claude/agents/ondemand-*.md` vs. `CHANGELOG.md`) and their invocation points differ (bootstrap Step 3.75 vs. four lifecycle hooks). No change to `changelog-writer`. |
| `src/agents/resource-architect.md` | Introduced in Section 4. `role-planner` reads the output of `resource-architect` (`.claude/resources-pending.md`) per FR-1.2 but does not invoke or modify the `resource-architect` agent itself. The boundary in FR-4.3 is enforced on the `role-planner` side, not by modifying `resource-architect`. No change to `resource-architect` is required for Section 5; the existing Section 4 FR-5.1 through FR-5.7 already prohibit `resource-architect` from recommending roles. |
| `src/rules/git.md` | Git workflow unchanged. |
| `src/rules/scratchpad.md` | Scratchpad format unchanged. `role-planner` does NOT read or write the scratchpad (per FR-1.2's exclusion list). |
| `src/rules/error-recovery.md` | Error recovery rules unchanged. A `role-planner` failure halts bootstrap per FR-3.3 — this is an error-escalation (Rule 4) by design, not a deviation rule change. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. |
| `src/commands/develop-feature.md` | Delegates to `/bootstrap-feature` wholesale, so Step 3.75 is inherited automatically. No prompt change required (per FR-3.7). |
| `src/commands/implement-slice.md` | Slice execution reads `.claude/plan.md` which will contain the `## Additional Roles` section near the top, and the orchestrator may consult the `## Role invocation plan` to spawn on-demand roles at implementation-time steps. The slice template itself does not change — any on-demand invocation follows the general-purpose pattern documented in `src/commands/bootstrap-feature.md` per FR-3.4. No prompt change to `implement-slice.md` in iteration 1. |
| `src/commands/merge-ready.md` | Merge-ready does NOT re-check role recommendations and does NOT tear down `ondemand-<slug>.md` files (per design decision 11 and 5.8 item 1). Merge-ready MAY consult the `## Role invocation plan` for any roles designated to run at merge-ready time, using the general-purpose invocation pattern, but this is an orchestrator behavior driven by the plan contents — no prompt change to `merge-ready.md` is required in iteration 1. |
| `src/commands/context-refresh.md` | Context refresh reads scratchpad, not `.claude/plan.md` directly. No change. |
| `templates/rules/changelog.md` | Downstream-project-scoped changelog rule from Section 3. Independent of role planning. No change. |
| `templates/CLAUDE.md` | Downstream-project template from Section 3. Independent of role planning. No change. |
| `templates/rules/` (directory) | No new rule template. `role-planner` is a global pipeline addition, not a per-project opt-in — same rationale as `resource-architect` in Section 4 (no `templates/rules/resource-architect.md` was added there either). Per FR-6.10. |

### 5.7 UI Changes, Schema Changes, Affected Endpoints

Not applicable on all three counts. The SDLC project is a collection of markdown prompt files with no UI, database, or API — same as Section 4 section 4.7.

### 5.8 Out of Scope for Iteration 1

The following items are explicitly out of scope for iteration 1 and MUST NOT be implemented as part of this section. They are listed explicitly so the Plan Critic does not flag their absence as a gap during iteration 1 planning.

1. **Automatic teardown of on-demand prompt files after merge.** Generated `~/.claude/agents/ondemand-<slug>.md` files persist across sessions and across features. Iteration 1 does NOT have a `/merge-ready` or post-merge hook that deletes on-demand roles whose feature has shipped. The developer manually deletes unwanted on-demand roles from `~/.claude/agents/` as desired. Automated teardown is iteration 2 territory.
2. **Cross-feature reuse optimization.** If feature A generated `ondemand-mobile-dev.md` and feature B would benefit from the same role, iteration 1 does NOT detect the overlap or reuse the existing file — `role-planner` for feature B regenerates the file (FR-2.5 overwrite behavior). Smart reuse is iteration 2 territory.
3. **Claude Code session re-registration of dynamically-generated subagent types.** Iteration 1 uses the `subagent_type: general-purpose` pattern (design decision 7, FR-3.4) to invoke on-demand roles in-session without requiring a restart. Extending Claude Code to register `ondemand-<slug>` as first-class subagent types during the session is out of scope — it would require changes to Claude Code itself, not to the SDLC pipeline.
4. **Programmatic validation of the call plan by the orchestrator.** Iteration 1 trusts `role-planner`'s call plan — the orchestrator follows the plan's pipeline-step labels without verifying them against a known step list. If `role-planner` emits an invalid step label (e.g., "Step 42: nonexistent"), the orchestrator silently fails to invoke that role. Programmatic validation (schema-check the step labels, reject unknown steps) is deferred.
5. **Role-planner recommending changes to core agent prompts.** Per FR-4.4, `role-planner` MAY note observations about core-agent insufficiency as "OBSERVATION:" comments in the `## Additional Roles` body but MUST NOT generate recommendations that override core agents. Letting `role-planner` rewrite core agent prompts would be a dramatic authority expansion and is strictly out of scope.
6. **Merge-ready re-check of role needs.** Parallel to Section 4 NFR-9, iteration 1 invokes `role-planner` exactly once per feature at bootstrap Step 3.75. Re-checking at merge-ready — to detect on-demand roles that were recommended but never invoked, or roles that should have been recommended but were not — is deferred.
7. **Role-planner-to-resource-architect feedback loop.** If `role-planner` observes that a recommended role would require a specific MCP tool (e.g., a "mobile-e2e-reviewer" would need Playwright with mobile emulator support), iteration 1 does NOT feed that observation back to `resource-architect` mid-pipeline. The FR-4.3 boundary enforces separation; a coordinated bidirectional workflow where role-planner's outputs inform resource-architect's recommendations is iteration 2 territory.
8. **On-demand role quality learning.** The agent does not learn from which of its past role recommendations were actually invoked vs. ignored. Recommendation quality is entirely prompt-driven in iteration 1.
9. **Automatic garbage collection of stale on-demand files.** If `~/.claude/agents/ondemand-legacy-thing.md` has not been referenced by any feature's call plan in the last N features, iteration 1 does NOT delete it. Manual cleanup only.
10. **Feature-scoped on-demand roles (per-feature filename namespacing).** Iteration 1 uses a global `ondemand-<slug>.md` namespace — two features that both need a `mobile-dev` role share the same filename and the second feature overwrites the first (per FR-2.5). Per-feature namespacing (e.g., `ondemand-<feature>-<slug>.md`) is deferred.
11. **Validation that generated on-demand prompts do not self-claim `Bash` tool access.** Per FR-1.7, the agent's own prompt guidance restricts on-demand prompts to minimal tool sets without `Bash` unless the role genuinely requires shell execution. Iteration 1 does NOT programmatically validate this — no static analysis of generated prompt frontmatter. Enforcement is prompt-driven. Programmatic validation is deferred.

### 5.9 Risks and Dependencies

1. **Risk: Agent over-recommends, producing 5+ on-demand roles per feature and diluting the core 16's clarity.** If the agent is too aggressive, the pipeline acquires an ever-growing `~/.claude/agents/ondemand-*.md` directory and the developer loses confidence in the 16-agent core. Mitigation: FR-4.7 guidance ("typically 0 to 3 roles") and FR-1.8's overlap check. The summary line (FR-1.6) surfaces total count at the top so over-recommendation is visible at a glance. The Plan Critic is also expected to flag 4+ role recommendations as a MINOR finding in iteration 2 (not iteration 1 — out of scope).
2. **Risk: Agent under-recommends, missing specialized domains and causing mid-implementation gaps.** Conversely, overly-conservative recommendations cause the exact problem this feature exists to prevent. Mitigation: FR-4.1 enumerates positive-example domains (mobile, healthcare, accessibility, etc.) and the prompt MUST instruct the agent to surface any domain where the core 16 are clearly outside their expertise. Iteration 1 accepts prompt-quality dependency and does not attempt automated coverage guarantees — same trade-off as Section 4 Risk 2 for `resource-architect`.
3. **Risk: Boundary with resource-architect violated by prompt drift.** Over time, `role-planner`'s prompt could be revised to recommend MCP tools or cloud resources (which is `resource-architect`'s scope per FR-4.3 and Section 4 FR-4.2). Mitigation: FR-4.3 requires the prompt to explicitly call out the boundary. Symmetrically, `resource-architect` is already constrained by Section 4 FR-5.1 through FR-5.7. The two-sided prompt-level enforcement is the mitigation. Iteration 1 does NOT add a programmatic check; the Plan Critic MAY flag boundary violations as MAJOR in a future iteration.
4. **Risk: On-demand prompt file written outside the permitted `~/.claude/agents/ondemand-*.md` namespace.** If a prompt bug causes the agent to write to `~/.claude/agents/code-reviewer.md` (overwriting a core agent), the core pipeline is corrupted. Mitigation: FR-5.2 explicitly prohibits writing to core agent files, and FR-5.8 restricts writes to the two permitted directories. The agent's tool set excludes `Edit` (FR-5.7) so the agent can only `Write` new files, not edit existing ones — minor defense-in-depth. Defense-in-depth is not perfect; the ultimate enforcement is the prompt boundary. Iteration 1 accepts this risk.
5. **Risk: General-purpose invocation pattern breaks if the on-demand prompt file has YAML frontmatter bugs.** If the orchestrator fails to correctly extract the prompt body from a malformed `~/.claude/agents/ondemand-<slug>.md` (e.g., missing `---` delimiter, unescaped YAML), spawning `general-purpose` with a corrupted prompt causes silent failure. Mitigation: FR-1.7 requires valid YAML frontmatter with specific fields; the agent's prompt MUST include an example of a well-formed on-demand prompt file. Iteration 1 does NOT add programmatic YAML validation — that is deferred. If the orchestrator encounters a malformed on-demand prompt file, it MUST surface the error rather than silently continuing; this fallback is documented in `src/commands/bootstrap-feature.md` per FR-3.4.
6. **Risk: Temp file not cleaned up.** If the planner fails between reading `.claude/roles-pending.md` and deleting it, the temp file persists. Mitigation: FR-2.4 specifies the next bootstrap invocation for the same feature overwrites the file — parallel to Section 4 Risk 4. `/merge-ready` does not check for the temp file's presence, so a persistent temp file does not block merge.
7. **Risk: Step-number confusion (3 → 3.5 → 3.75).** Inserting two half-steps between Step 3 and Step 4 deviates from the pattern of integer step numbers used earlier in bootstrap. Mitigation: FR-3.6 explicitly preserves Step 4 as QA and Step 5 as planner. The ".75" notation is unambiguous given the existing ".5" from Section 4. An alternative of renumbering all subsequent steps was considered and rejected for the same reason given in Section 4 Risk 5 — it would churn every cross-reference for no semantic gain.
8. **Risk: Role-planner blocks bootstrap on trivial failures.** FR-3.3 halts bootstrap if the agent fails, which could block the developer on a transient failure. Mitigation: the agent is deterministic and has no network dependencies (FR-5.6), so failure modes are limited — same mitigation as Section 4 Risk 6. A retry is not automated; the developer re-invokes `/bootstrap-feature`.
9. **Risk: Agent-count propagation drift (15→16).** The update touches five `install.sh` banners, two `README.md` locations, and possibly zero or more `src/claude.md` prose references. Missing a single location leaves inconsistent documentation. Mitigation: the Agent Count Propagation table in section 5.6 enumerates every location; the Plan Critic is expected to verify all are addressed before merge — same diligence pattern applied in Sections 1, 3, and 4.
10. **Risk: On-demand role invocation pattern not understood by the orchestrator.** If the orchestrator does not recognize the general-purpose invocation pattern, it will try to spawn `subagent_type: ondemand-<slug>` directly and fail with "unknown subagent type". Mitigation: FR-3.4 requires `src/commands/bootstrap-feature.md` to document the pattern explicitly, and FR-6.6 requires the `README.md` to also explain it. The `role-planner` prompt itself also documents the pattern (per FR-1.1's prompt content and design decision 7).
11. **Risk: On-demand filename namespace collision.** Two concurrent features both generating an `ondemand-mobile-dev.md` (per FR-2.5 overwrite behavior) could cause race conditions if both pipelines run simultaneously. Mitigation: iteration 1 assumes single-pipeline-at-a-time (same implicit assumption as Section 4 and all earlier sections). Multi-pipeline safety is not a concern for iteration 1. Per-feature namespacing is in 5.8 item 10 as out-of-scope.
12. **Dependency: Section 4 (Resource Manager-Architect).** `role-planner` reads `.claude/resources-pending.md` per FR-1.2 and runs at Step 3.75 immediately after Section 4's Step 3.5. Section 4 is [IN DEVELOPMENT] concurrently with this section. If Section 4 does not ship before Section 5, the FR-1.2 input at position (d) (resource recommendations) is simply absent — `role-planner` falls back to reading PRD + use-cases + architect verdict + CLAUDE.md (positions a, b, c, e). This graceful-absence path MUST be documented in the agent prompt. The pipeline ordering (3 → 3.5 → 3.75 → 4 → 5) requires Section 4 to define Step 3.5; the implementer MUST sequence Section 4 and Section 5 carefully: Section 4 bootstrap first, Section 5 bootstrap next, or ship them together with coordinated cross-references.
13. **Dependency: Section 1 FR-3 (Executable Plan Format).** The `## Additional Roles` section is inlined into `.claude/plan.md` alongside the planner's slices produced under Section 1 FR-3. Section 1 is [SHIPPED], dependency satisfied.
14. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT] concurrently; this dependency is satisfied by the prd-writer update in Section 3 FR-3.1. If Section 3 does not ship before Section 5, the `Changelog:` field is documentation-only.
15. **Dependency: Section 3 (Changelog Writer pipeline-hook pattern).** The temp-file-to-planner-inline pattern (`.claude/roles-pending.md` → `## Additional Roles` in `.claude/plan.md`, then delete temp) mirrors Section 4's `.claude/resources-pending.md` → `## Recommended Resources` pattern, which itself mirrors Section 3's lifecycle-hook pattern. Section 3 is [IN DEVELOPMENT]; Section 4 is [IN DEVELOPMENT]. The pattern is reference-only — Section 5's implementation does not functionally depend on Section 3 shipping first.
16. **Dependency: SDLC repo opts out of changelog maintenance.** Per Section 3 design decision 1, the SDLC repo itself has no `.claude/rules/changelog.md`, so `changelog-writer` self-skips for this PRD section (per Section 3 FR-2.2). Expected behavior, not a risk — parallel to Section 4 Dependency 11.
17. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — `role-planner` runs at bootstrap time, before any slice or wave exists. Wave orchestration is unaffected — listed here only to disclaim the non-relationship, parallel to Section 4 Dependency 12.
