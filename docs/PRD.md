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
