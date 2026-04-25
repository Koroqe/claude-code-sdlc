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

---

## 6. Changelog Release Packaging — Iteration 2 of Feature #3

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-25
**Priority:** Medium
**Related:** Section 3 (Product Changelog Maintenance — Iteration 1: Content Sync; this section is iteration 2 of the same feature and the `[Unreleased]` content maintained by `changelog-writer` is the precondition for this section's release packaging), Section 3.8 (Out of Scope for Iteration 1 — items 1 through 7 are addressed here), Section 3.10 (Iteration 2 Scope Preview — the role placement, CI/CD provider matrix, and version-source-of-truth deferred there are decided here), Section 1 (FR-3: Executable Plan Format — slice format inherited unchanged), Section 4 (Resource Manager-Architect — the suggest-only authority pattern and `tools` defense-in-depth restriction are reused here)
**Changelog:** Pipeline now packages releases — bumps version, generates release notes, and provisions GitHub Actions release workflow.

### 6.1 Description

Add a new mandatory agent `release-engineer` ("Release Engineer") to the global pipeline that performs the **release packaging** half of the changelog feature deferred from Section 3 iteration 1. The agent runs once per merge cycle as a new conditional gate (Gate 9) in `/merge-ready`. When the project's `CHANGELOG.md` `[Unreleased]` section (maintained by `changelog-writer` from Section 3) contains entries, `release-engineer` performs the local-half release packaging steps: detect the project's version source, compute a semver bump from the `[Unreleased]` entry categories, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` while inserting a fresh empty `[Unreleased]` heading, write a release-notes file at `.claude/release-notes-X.Y.Z.md` containing the renamed section's body, and provision a `.github/workflows/release.yml` if absent. The agent then emits a structured summary with the exact `git add`, `git commit`, `git tag`, and `git push` commands the developer runs to publish. The agent itself does NOT execute any git, gh, npm publish, or push commands — it is suggest-only on remote-mutating actions and write-only on local files within its declared scope.

**Why:** Section 3 iteration 1 maintains the `[Unreleased]` section content but stops short of release packaging — semver computation, version stamping, release-notes generation, and CI/CD provisioning were deferred (Section 3.8 items 1–7). Without those steps, downstream projects still curate releases manually: hand-decide the version bump, hand-edit the changelog header, hand-paste release notes into the GitHub UI, and hand-author the release-publishing CI/CD workflow if one does not exist. Adding `release-engineer` as a conditional Gate 9 closes the loop end-to-end: from PRD-section authoring to a tag-pushed GitHub Release with `CHANGELOG.md`-derived body. The agent's authority is intentionally bounded (no git/gh/network execution; reads version-source files but never writes them) so that defense-in-depth — both prompt boundary and `tools` declaration — prevents accidental publishes.

**Audience:** The agent's primary audience is the **developer running `/merge-ready` for a feature branch ready to publish**. Its secondary audience is the **CI/CD pipeline of the downstream project** — `release-engineer` writes `.github/workflows/release.yml` on the developer's behalf so that a subsequent `git push origin vX.Y.Z` (run by the developer) triggers an automated GitHub Release whose body is read from the release-notes file the agent wrote. The output structured summary is for the developer; the workflow file is for GitHub Actions.

**Scope boundary:** This section covers **Iteration 2 of Section 3 ONLY: Release Packaging — local CHANGELOG manipulation, version-source detection (read-only), semver bump computation, release-notes file generation, and GitHub Actions CI/CD provisioning**. The following items are explicitly OUT OF SCOPE and are listed in 6.8: multi-package monorepo support, GitLab CI / Bitbucket Pipelines / CircleCI provisioning, automatic version-source-file edits (`package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`), `gh release create` execution by Claude, automatic git tag annotation, release notification (Slack, email, etc.).

**Design decisions:**

1. **Agent name and role title.** The agent file is `src/agents/release-engineer.md`. In the Agency Roles table, the role is titled "Release Engineer" and the agent column is `release-engineer`. The kebab-case name matches the prior `prd-writer`, `changelog-writer`, `resource-architect`, and `role-planner` patterns.

2. **17th mandatory core agent.** `release-engineer` is a permanent member of the global mandatory scope. It is installed by the default `install.sh` glob over `src/agents/*.md` (NOT gated behind `--init-project`) and is invoked in every `/merge-ready` cycle. The total global agent count rises from 16 to 17. Crucially, it runs CONDITIONALLY (per design decision 3) — being mandatory means the gate always exists, not that it always performs work.

3. **Pipeline position: `/merge-ready` Gate 9 — Release Packaging.** The agent is invoked as a new gate at the end of the existing `/merge-ready` gate sequence (post-Gate 8, the last existing gate). Existing gates are zero-indexed Gate 0 through Gate 8 (9 gates total) per `src/commands/merge-ready.md`; the new gate becomes Gate 9 (zero-indexed), bringing the total gate count to 10. The gate is conditional: `release-engineer` reads `CHANGELOG.md`, and if the `[Unreleased]` section is empty (zero entries across all six Keep a Changelog categories), the agent returns the exact string `no-op: no unreleased changes` and the gate is reported as `SKIPPED` in the gate output. The `/merge-ready` gate count rises from 9 to 10 in all documentation. This addresses Section 3.8 item 7 ("Gate 10 Release Packaging in /merge-ready" — note: iteration 1's nomenclature predates the zero-indexed gate convention; the actual gate is Gate 9 zero-indexed) which iteration 1 explicitly deferred.

4. **Suggest-only authority — defense-in-depth via `tools` restriction.** The agent's `tools` frontmatter field MUST be exactly `["Read", "Write", "Edit", "Glob", "Grep"]`. The `Bash` tool MUST NOT be included; `WebFetch`, `WebSearch`, and `NotebookEdit` MUST NOT be included. This is the same defense-in-depth pattern Section 4 FR-5.7 established for `resource-architect`: prompt boundary AND tool boundary both prohibit the disallowed actions. Excluding `Bash` mechanically prevents the agent from invoking `git push`, `git tag`, `gh release create`, `npm publish`, or any package-manager command, even if the prompt were revised to suggest such an action.

5. **Authority — local CHANGELOG operations.** The agent has READ-AND-WRITE authority over `CHANGELOG.md` at the project root for the specific operation of renaming `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` and inserting a fresh empty `[Unreleased]` heading. It has WRITE authority for the new file `.claude/release-notes-X.Y.Z.md` containing the renamed `[X.Y.Z]` section's body. It MUST NOT modify any `[X.Y.Z]` section other than the one freshly renamed from `[Unreleased]` in the current invocation, and MUST NOT delete previously-published `[X.Y.Z]` sections. The agent does NOT commit — the developer/orchestrator handles `git add` / `git commit` / `git push` per the structured summary the agent emits.

6. **Authority — version source detection (read-only).** The agent detects the project's current version by reading the first existing source in this priority order: (a) `package.json` `version` field, (b) `pyproject.toml` `[tool.poetry] version` or `[project] version`, (c) `Cargo.toml` `[package] version`, (d) `VERSION` plain file, (e) latest git tag matching `v*.*.*` (read via `git tag` parsing — but see footnote: the agent itself cannot run `git`; it reads `.git/refs/tags/` directly via the `Glob` tool, or reads a `git tag` output dump if the orchestrator passes one as context). Fallback when none of (a)–(e) is present: `0.1.0`. **Override:** if the project's `CLAUDE.md` contains a `Version source: <path>` line (the placeholder introduced in Section 3 FR-5.5 as iteration-1 dead metadata), the agent MUST use the path on the right-hand side as the version source with priority OVER the auto-detection priority order. The agent reads but NEVER writes any version-source file — version-source-file updates are the developer's responsibility per the project's tooling (`npm version`, `poetry version`, `cargo set-version`, manual edit of `VERSION`, etc.).

7. **Semver bump algorithm — pinned for testability.** Computed deterministically from the `[Unreleased]` section's entry categories under the following rules:
   - If `[Unreleased]` contains entries marked with `breaking` (e.g., `breaking:` prefix in entry text) OR has a non-empty `Removed` category → **major** bump.
   - Else if `[Unreleased]` has a non-empty `Added` or `Changed` category → **minor** bump.
   - Else if `[Unreleased]` has only a non-empty `Fixed` category (and no `Added`, `Changed`, `Removed`) → **patch** bump.
   - **Pre-1.0 override:** if the current version starts with `0.` (e.g., `0.3.7`), the agent MUST NEVER bump major regardless of the rules above. Any rule above that would have produced major MUST instead produce minor. This preserves the SemVer 2.0 convention that pre-1.0 packages may break compatibility within the 0.x series via minor bumps. Patch and minor bumps for pre-1.0 follow the same rules as post-1.0.
   - If `[Unreleased]` is entirely empty across all categories, the agent MUST return `no-op: no unreleased changes` per design decision 3 — the bump algorithm does not execute.

8. **Authority — CI/CD provisioning.** The agent inspects `.github/workflows/` for any file containing a tag-triggered release workflow — specifically a workflow with `on: push: tags:` matching the pattern `v*.*.*` (the same pattern used by the agent's own version detection priority (e). Detection is text-level via `Read` and `Grep` and uses the multi-pattern fallback set defined in FR-5.1. Three outcomes:
   - **ABSENT** (no tag-triggered release workflow found): the agent writes `.github/workflows/release.yml` from a built-in template that includes `on: push: tags: ['v*.*.*']`, uses the `softprops/action-gh-release@v2` action (chosen for popularity, active maintenance, and `body_path` support for `CHANGELOG.md`-derived release notes), and sets `body_path` to `.claude/release-notes-${{ steps.ver.outputs.version }}.md` after a dedicated `Strip v prefix from tag` step strips the `v` prefix from `${GITHUB_REF_NAME}` (per FR-5.2's two-step pattern, since YAML strings do not evaluate shell parameter expansion at action-input time). The generated file MUST start with an HTML comment `<!-- generated by claude-code-sdlc release-engineer at YYYY-MM-DD -->` (today's date) for traceability — re-runs against an already-provisioned project detect this comment and treat the workflow as agent-owned for idempotency purposes.
   - **PRESENT and body source IS `CHANGELOG.md`-derived** (workflow uses `body_path` referencing the release-notes file or extracts directly from `CHANGELOG.md`): the agent reports "present-and-correct" in its output and makes NO changes. Idempotent re-run.
   - **PRESENT but body source is NOT `CHANGELOG.md`-derived** (workflow uses commit log, generic template, or hardcoded text): the agent emits a warning in its output identifying the workflow file and the body source it found, and MUST NOT modify the existing workflow. Respecting an existing CI/CD configuration is more important than enforcing the SDLC's preferred body source.

9. **Output to user — structured markdown summary.** The agent's final output is a structured markdown block containing:
   - **Detected version source** (which file) and **current version** (read value).
   - **Computed bump type** (`major` / `minor` / `patch`) and **new version** `X.Y.Z`.
   - **Path to renamed CHANGELOG section** (`CHANGELOG.md` `[X.Y.Z] - YYYY-MM-DD`) and **path to release-notes file** (`.claude/release-notes-X.Y.Z.md`).
   - **CI/CD status:** one of `provisioned new`, `present-and-correct`, or `present-but-warning: <reason>`.
   - **Commands to run** as a fenced shell block:
     ```
     <update version-source if needed per project tooling>
     git add CHANGELOG.md .claude/release-notes-X.Y.Z.md .github/workflows/release.yml
     git commit -m "chore(core): release X.Y.Z"
     git push
     git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md
     git push origin vX.Y.Z
     ```
   The developer reviews the summary, manually updates the version-source file if needed (per design decision 6), and executes the commands. `release-engineer` itself does NOT run any of these commands.

10. **NEVER list — explicit suggested-prepare contract.** The agent prompt MUST contain an explicit "NEVER" section listing prohibited actions (parallel to Section 4 FR-5.1's Authority Boundary section): never run `git push`, `git tag`, `gh release create`, `npm publish`, `cargo publish`, `pypi upload`, or any other publish/push command; never modify `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`, or any other version-source file (READ ONLY); never make network calls (parallel to Section 3 NFR-7 and Section 4 FR-5.6); never modify `~/.claude/settings.json` or any other Claude Code configuration file; never modify any other agent's prompt file under `src/agents/` or `~/.claude/agents/`.

### 6.2 User Story

As a developer using the Claude Code SDLC pipeline on a downstream project with `changelog-writer` configured, I want `/merge-ready` to handle release packaging at the end — computing the semver bump, stamping the date on the changelog section, generating the release-notes file, provisioning the GitHub Actions release workflow if absent, and giving me the exact commands to publish — so that I can ship a new version with a single review of the agent's summary instead of hand-curating each step, while keeping my hand on the trigger for git push and tag creation.

### 6.3 Functional Requirements

#### FR-1: Release-Engineer Agent Specification

A new global agent that performs conditional release packaging at `/merge-ready` Gate 9.

1. **FR-1.1:** A new file `src/agents/release-engineer.md` MUST exist with frontmatter matching the existing agent format: `name: release-engineer`, `description`, `tools: ["Read", "Write", "Edit", "Glob", "Grep"]` (exactly this set, no others), `model: opus` for consistency with Section 1 NFR-4.
2. **FR-1.2:** The agent's prompt MUST document that it reads, in order: (a) `CHANGELOG.md` at the project root — specifically the `[Unreleased]` section, (b) the project's version source per the priority order in FR-3.1, (c) the project's `CLAUDE.md` for the optional `Version source:` override line per FR-3.2, (d) `.github/workflows/` directory contents for CI/CD provisioning detection per FR-5.1. The agent MUST NOT read `docs/PRD.md`, `.claude/scratchpad.md`, or `git log` — those are inputs to `changelog-writer` (Section 3 FR-2.3), not to `release-engineer`.
3. **FR-1.3:** The agent MUST perform a self-check first step: read `CHANGELOG.md` and parse its `[Unreleased]` section. If the section is missing entirely, OR is present but empty across all six Keep a Changelog categories (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), the agent MUST return the exact string `no-op: no unreleased changes` and MUST NOT perform any writes, MUST NOT compute a semver bump, MUST NOT touch `.github/workflows/`, and MUST NOT fail the caller. This is the conditional-gate behavior referenced in design decision 3 and FR-7.2.
4. **FR-1.4:** The agent MUST NOT depend on `.claude/rules/changelog.md` (Section 3 FR-1) being present — `release-engineer`'s self-check is the `[Unreleased]`-emptiness check in FR-1.3, not the changelog-rule presence check. The two agents are independently configured: `changelog-writer` opts out via missing rule file; `release-engineer` opts out via empty `[Unreleased]`. A project may have a populated `[Unreleased]` (manually maintained) and `release-engineer` will package it even if `changelog-writer` is opted out.
5. **FR-1.5:** When the self-check passes (non-empty `[Unreleased]`), the agent MUST execute the following sequence in this exact order: (a) detect version source per FR-3, (b) compute new version per FR-4, (c) rewrite `CHANGELOG.md` per FR-2, (d) write `.claude/release-notes-X.Y.Z.md` per FR-2.4, (e) inspect and conditionally provision `.github/workflows/release.yml` per FR-5, (f) emit structured summary per FR-6. If any step fails, the agent MUST report the failure and MUST NOT proceed to subsequent steps — partial progress is preserved (e.g., a CHANGELOG rewrite that succeeded before a CI/CD provisioning failure remains on disk).
6. **FR-1.6:** The agent MUST be invoked with no arguments beyond the project CWD context — all inputs are discovered from disk per FR-1.2. This ensures identical behavior at the single Gate 9 invocation point and makes the agent trivially re-runnable.

#### FR-2: CHANGELOG Manipulation Contract

Define the exact local file operations on `CHANGELOG.md` and the release-notes file.

1. **FR-2.1:** When the self-check passes, the agent MUST modify `CHANGELOG.md` exactly as follows: (a) locate the `[Unreleased]` heading line; (b) rename that heading to `[X.Y.Z] - YYYY-MM-DD` where `X.Y.Z` is the new version computed per FR-4 and `YYYY-MM-DD` is today's date in ISO 8601 format; (c) immediately above the renamed heading, insert a fresh empty `[Unreleased]` heading (the heading line only — no category subheadings, no entries). The fresh `[Unreleased]` becomes the destination for the next cycle's `changelog-writer` content sync.
2. **FR-2.2:** The agent MUST NOT modify any `[X.Y.Z]` section other than the one freshly renamed from `[Unreleased]` in the current invocation. Sections for prior released versions (e.g., `[0.3.6]`, `[0.3.5]`) MUST remain byte-for-byte untouched. This parallels Section 3 FR-2.7's preservation guarantee.
3. **FR-2.3:** The agent MUST NOT modify the `CHANGELOG.md` header (title, description paragraph linking to keepachangelog.com, semver note) created by `changelog-writer` per Section 3 FR-2.8. The header is byte-for-byte preserved.
4. **FR-2.4:** The agent MUST write a new file at `.claude/release-notes-X.Y.Z.md` (where `X.Y.Z` is the new version from FR-4) containing the body of the freshly renamed `[X.Y.Z]` section — that is, all category subheadings (`Added`, `Changed`, etc.) and their entries, but NOT the `[X.Y.Z] - YYYY-MM-DD` heading itself. The file's intended use is `git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md` (per FR-6.5) and as the `body_path` source for the GitHub Actions release workflow per FR-5.3.
5. **FR-2.5:** If `.claude/release-notes-X.Y.Z.md` already exists when the agent runs (e.g., a prior aborted run), the agent MUST overwrite it without prompting. Stale content from a prior run MUST NOT be appended to or merged with the new content. This parallels Section 4 FR-2.4 for `resources-pending.md`.
6. **FR-2.6:** The agent MUST NOT delete `.claude/release-notes-X.Y.Z.md` after writing it. Unlike Section 4's `resources-pending.md` (which the planner deletes after inlining), the release-notes file is a durable artifact — it is committed alongside `CHANGELOG.md` per the structured summary in FR-6.5 and serves as the release body source for the GitHub Actions workflow in FR-5.3.
7. **FR-2.7:** The agent MUST NOT commit the modified `CHANGELOG.md` or the new release-notes file. Commit responsibility belongs to the developer (or orchestrator) per the structured summary in FR-6.5. This preserves the suggest-only-on-remote-mutation authority pattern from design decision 4.

#### FR-3: Version Source Detection

Define the priority order and override mechanism for detecting the project's current version.

1. **FR-3.1:** The agent MUST detect the current version by reading the first existing source in this priority order: (a) `package.json` `version` field at the project root; (b) `pyproject.toml` at the project root, reading `[tool.poetry] version` (Poetry projects) or `[project] version` (PEP 621 projects), with the first present value winning; (c) `Cargo.toml` at the project root, reading `[package] version`; (d) `VERSION` plain file at the project root (whitespace-stripped); (e) latest git tag matching `v*.*.*` — the agent MUST read git tags from BOTH on-disk locations because git stores tags in two formats (loose refs and packed refs) depending on repository age and `git gc` history. Specifically: (i) the agent MUST `Glob` over `.git/refs/tags/v*.*.*` and parse the file basenames as candidate tag names; (ii) if `.git/refs/tags/v*.*.*` yields no matches, the agent MUST also `Read` the file `.git/packed-refs` (plain text format with each line shaped as `<sha> refs/tags/<name>`) and parse it for tag names matching `v*.*.*`. Only after BOTH (i) and (ii) yield no matches does priority fall through to fallback `0.1.0` per FR-3.3. The agent MUST NOT skip `.git/packed-refs` parsing — promoting packed-refs from a "MAY include" optimization to a "MUST include" determinism requirement — because in repositories that have been garbage-collected, `.git/refs/tags/` is empty and ALL tags live in `.git/packed-refs`. The agent has no `Bash` tool to invoke `git tag` itself; both Glob and Read of these paths are within the declared `tools` set. If two or more (a)–(d) sources are present, the highest-priority source wins and a warning is emitted in the structured summary noting the multiple sources.
2. **FR-3.2:** If the project's `CLAUDE.md` contains a line matching the regex `^Version source:\s*(.+)$`, the agent MUST use the path on the right-hand side as the version source, OVERRIDING the priority order in FR-3.1. The agent MUST check BOTH `./CLAUDE.md` (project root) and `.claude/CLAUDE.md` (Claude directory) in the project CWD. **Precedence order when both files contain a `Version source:` line:** `./CLAUDE.md` wins over `.claude/CLAUDE.md`. If both files are present and their `Version source:` values disagree, the agent MUST emit a warning in the structured summary with the literal text "multiple Version source: lines detected — using ./CLAUDE.md; recommend reconciling to a single source of truth". If only one of the two files is present, that file's value is used without warning. The override path MUST resolve to an existing file; if it does not, the agent MUST emit a warning and fall back to the priority order in FR-3.1. This is the runtime consumer of the iteration-1 dead-metadata field introduced in Section 3 FR-5.5.
3. **FR-3.3:** If neither FR-3.1 nor FR-3.2 yields a version (no source file present, no override line, and no git tags), the agent MUST use the fallback version `0.1.0`. The fallback case MUST be explicitly noted in the structured summary's "Detected version source" field as `(none — fallback 0.1.0)`.
4. **FR-3.4:** The agent MUST READ the version source file but MUST NOT WRITE to it. Updating the version-source file (e.g., `npm version <new>`, `poetry version <new>`, manual `VERSION` edit) is the developer's responsibility per the project's tooling. The structured summary in FR-6.5 includes the placeholder `<update version-source if needed per project tooling>` as the first line of the commands block to remind the developer.
5. **FR-3.5:** The agent MUST treat the version string as a strict semver `MAJOR.MINOR.PATCH`. Pre-release suffixes (e.g., `0.3.7-beta.1`) and build metadata (e.g., `0.3.7+sha.abc123`) MUST be stripped before bump computation, and the bumped version MUST NOT carry any pre-release or build metadata forward — iteration 2 emits clean `X.Y.Z` releases only. If the source contains a pre-release suffix, the agent MUST emit a warning in the structured summary noting the stripped suffix.

#### FR-4: Semver Bump Algorithm

Pin the bump algorithm with sufficient determinism for testing.

1. **FR-4.1:** The agent MUST compute the new version `X.Y.Z` from the current version (per FR-3) and the `[Unreleased]` content per the rules in design decision 7, restated: (a) if any entry text contains the literal token `breaking` (case-insensitive, word-boundary match) OR the `Removed` category is non-empty → **major**; (b) else if `Added` or `Changed` is non-empty → **minor**; (c) else if only `Fixed` is non-empty → **patch**.

   **Negation skip rule (mandatory):** The `breaking`-token check MUST skip occurrences preceded (after whitespace stripping) by either `non-` (immediately adjacent, hyphenated form) or `not ` (followed by whitespace, separated form). Specifically, before counting a `breaking` token as a major-bump trigger, the agent MUST inspect the up-to-4 characters immediately preceding the token — if the immediately-preceding non-whitespace token is `non-` (with the hyphen attached) OR if the preceding whitespace-stripped sequence ends in `not`, the occurrence MUST NOT trigger a major bump. Examples that MUST NOT trigger major:
   - `non-breaking change to internal API` — `non-` prefix excludes the token
   - `not breaking the existing contract` — preceding `not ` excludes the token
   - `Non-Breaking compatibility fix` — case-insensitive match on the negation prefix
   - `it is not breaking anything` — preceding `not ` excludes the token

   Examples that MUST trigger major:
   - `breaking: removed deprecated flag`
   - `BREAKING change to API surface`
   - `this is breaking and intentional`

   The negation check is the only exception; all other forms of the literal `breaking` token (with or without trailing punctuation, prefix-emphasis like `**breaking**`, or list markers) trigger major per the base rule.
2. **FR-4.2:** The agent MUST apply the **pre-1.0 override**: if the current version's MAJOR is `0` (e.g., `0.3.7`), any rule that would produce **major** MUST instead produce **minor**. Patch and minor bumps for pre-1.0 follow the same rules as post-1.0. The override MUST be noted in the structured summary's bump computation explanation.
3. **FR-4.3:** The agent MUST handle uncategorized entries (entries that appear under no category subheading, or under non-Keep-a-Changelog categories) by treating them as `Changed` for bump purposes — the most conservative non-major default. Uncategorized entries MUST trigger a warning in the structured summary.
4. **FR-4.4:** If `Deprecated` or `Security` is the only non-empty category, the agent MUST treat it as **patch** (deprecation announcements and security fixes are conventionally patch bumps unless they also remove APIs, in which case the `Removed` rule already applies). This is a conservative default; the developer may override by manually editing the version-source file before running the agent.
5. **FR-4.5:** The bump algorithm's input/output MUST be deterministic for testability: given the same `[Unreleased]` content and the same current version, the agent MUST produce the same new version on every invocation. The agent prompt MUST include at least three worked examples (e.g., `0.3.7` + `Fixed`-only → `0.3.8`; `0.3.7` + `Added` → `0.4.0`; `1.2.3` + `Removed` → `2.0.0`; `0.9.9` + `Removed` → `0.10.0` per the pre-1.0 override).

#### FR-5: CI/CD Provisioning

Define the GitHub Actions workflow detection, generation, and idempotency contract.

1. **FR-5.1:** The agent MUST inspect `.github/workflows/` (if present) for any file containing a tag-triggered release workflow. Detection MUST be text-level via `Read` and `Grep` and MUST use a **multi-pattern fallback set** rather than a single fragile regex. The three patterns are:

   1. **Tag-trigger pattern (P1):** the file contains the substring `tags:` followed (within the next 3 non-blank lines) by a line containing `'v*'` or `"v*"` (single-quoted or double-quoted glob), OR an unquoted entry containing `v*.*.*`. This identifies the workflow as tag-triggered.
   2. **Body-path-correct pattern (P2):** the file contains the substring `body_path` whose value (right-hand side of the `:`) contains the substring `release-notes` AND resolves to a path under `.claude/release-notes-*.md` (any version-suffixed filename). This identifies a workflow whose release body comes from the agent's release-notes file.
   3. **Inline-extraction pattern (P3):** the file contains the substring `CHANGELOG.md` AND a `run:` step in the same job (so a script extracts content from `CHANGELOG.md` at workflow run time). This identifies a workflow whose body is `CHANGELOG.md`-derived via shell extraction rather than `body_path`.

   **Outcome resolution:**
   - If P1 matches AND (P2 OR P3) matches → `present-and-correct` (handled by FR-5.3).
   - If P1 matches but neither P2 nor P3 matches → `present-but-warning` (handled by FR-5.4 — tag-triggered workflow exists, but body source is not `CHANGELOG.md`-derived).
   - If P1 does NOT match → ABSENT (proceed to FR-5.2 below — provision new).

   If `.github/workflows/` does not exist, the agent MUST treat it as if no workflow files exist (ABSENT — proceed to FR-5.2) without creating the directory tree manually; the `Write` tool will create parent directories as needed. The agent MUST scan every file under `.github/workflows/` (any extension `.yml` or `.yaml`); pattern matches in ANY single file qualify the entire workflow set.
2. **FR-5.2:** **ABSENT case** — if no tag-triggered release workflow is detected, the agent MUST write `.github/workflows/release.yml` with the following template content (all `<...>` placeholders are filled in at write time):
   ```yaml
   <!-- generated by claude-code-sdlc release-engineer at YYYY-MM-DD -->
   name: Release
   on:
     push:
       tags:
         - 'v*.*.*'
   jobs:
     release:
       runs-on: ubuntu-latest
       permissions:
         contents: write
       steps:
         - uses: actions/checkout@v4
         - name: Strip v prefix from tag
           id: ver
           run: echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"
         - uses: softprops/action-gh-release@v2
           with:
             body_path: .claude/release-notes-${{ steps.ver.outputs.version }}.md
             draft: false
             prerelease: false
   ```
   The HTML comment on line 1 carries today's date in ISO 8601. **Two-step body_path pattern (mandatory):** the template MUST use a dedicated `Strip v prefix from tag` step that runs `echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"` and assigns the stripped value to a step output (`steps.ver.outputs.version`), and the `body_path` MUST reference that step output via `${{ steps.ver.outputs.version }}`. This pattern is required because YAML `body_path:` is an action input evaluated at action-load time and does NOT support shell parameter expansion (`${VAR#prefix}`) inside its string value — putting `${GITHUB_REF_NAME#v}` directly in `body_path:` would be passed to the action as a literal string with the `#v` characters intact, and the action would look for a file whose name contains the literal `#v`, failing with "file not found". The shell expansion MUST happen in a `run:` step (where bash evaluates the expansion) and the result MUST be threaded into the action input via `steps.<id>.outputs.<name>`. The `body_path` after substitution at workflow run time evaluates to `.claude/release-notes-X.Y.Z.md`, matching the path written in FR-2.4.
3. **FR-5.3:** **PRESENT-AND-CORRECT case** — if a tag-triggered release workflow is detected AND its body source is `CHANGELOG.md`-derived (specifically: it references `body_path` pointing at a file under `.claude/release-notes-*.md` OR contains an inline step that extracts a version section from `CHANGELOG.md`), the agent MUST report `present-and-correct` in its structured summary and make NO changes to any workflow file. Idempotent re-run on a project the agent already provisioned MUST always hit this path because the agent's own template (FR-5.2) uses `body_path: .claude/release-notes-...`.
4. **FR-5.4:** **PRESENT-BUT-WARNING case** — if a tag-triggered release workflow is detected but its body source is NOT `CHANGELOG.md`-derived (e.g., it uses `generate_release_notes: true` for commit-log-derived bodies, or has hardcoded body text, or extracts from a different file), the agent MUST emit a warning in its structured summary identifying the workflow file path and the body source it found, and MUST NOT modify the existing workflow. The principle is: an existing CI/CD configuration represents project-level decisions that the agent does not unilaterally override. The developer reads the warning and decides whether to migrate the workflow manually.
5. **FR-5.5:** Idempotency: re-running the agent on a project where it previously provisioned `.github/workflows/release.yml` MUST result in `present-and-correct` per FR-5.3 (no rewrite, no churn). Detection of agent-owned workflows MAY use the HTML comment marker from FR-5.2 (`<!-- generated by claude-code-sdlc release-engineer ... -->`) as a fast path, but the body-source check (FR-5.3) is the authoritative criterion — a hand-edited workflow that retains `body_path: .claude/release-notes-*.md` is also `present-and-correct` regardless of whether the comment marker is preserved.
6. **FR-5.6:** The agent MUST NOT modify `.github/workflows/` files OTHER THAN `release.yml`, and MUST NOT delete any files in `.github/workflows/`. Multiple workflow files for unrelated concerns (CI tests, lint, deploy) coexist with `release.yml` and MUST NOT be touched.
7. **FR-5.7:** The agent MUST NOT add GitHub Actions secrets, repository settings, branch protection rules, or any GitHub-side configuration. Workflow file generation is local-file-only; everything else is the developer's responsibility. The default `GITHUB_TOKEN` provided by GitHub Actions is sufficient for the `permissions: contents: write` granted in the FR-5.2 template — no PAT setup is needed.

#### FR-6: Output Contract — Structured Summary

Define the exact shape of the agent's output that the developer reads to publish.

1. **FR-6.1:** The agent's final output MUST be a structured markdown block with the following labeled sections in this order: (a) Detected version source, (b) Current version, (c) Computed bump type, (d) New version, (e) Path to renamed CHANGELOG section, (f) Path to release-notes file, (g) CI/CD status, (h) Commands to run, (i) Warnings (if any), (j) Bump computation explanation.
2. **FR-6.2:** The "Detected version source" line MUST identify the source file path (e.g., `package.json`) or the override-line origin (e.g., `CLAUDE.md Version source: <path>`) or `(none — fallback 0.1.0)` per FR-3.3.
3. **FR-6.3:** The "CI/CD status" line MUST be exactly one of: `provisioned new` (FR-5.2 case), `present-and-correct` (FR-5.3 case), or `present-but-warning: <reason>` (FR-5.4 case, with the specific reason inline).
4. **FR-6.4:** The "Bump computation explanation" section MUST list which `[Unreleased]` categories were non-empty and which rule from FR-4.1 (or override from FR-4.2) was applied to produce the new version. This is for developer audit — they can confirm the agent computed the bump correctly without re-reading the algorithm.
5. **FR-6.5:** The "Commands to run" section MUST contain a fenced shell block with exactly the following commands (with `X.Y.Z` substituted for the new version):
   ```
   <update version-source if needed per project tooling>
   git add CHANGELOG.md .claude/release-notes-X.Y.Z.md .github/workflows/release.yml
   git commit -m "chore(core): release X.Y.Z"
   git push
   git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md
   git push origin vX.Y.Z
   ```
   When the CI/CD status is `present-and-correct` or `present-but-warning`, the `git add` line MUST omit `.github/workflows/release.yml` (since the agent did not modify it). When the version source did not need an update (the version-source file already reflects `X.Y.Z`), the placeholder line MAY be replaced with `# version source already at X.Y.Z`.
6. **FR-6.6:** The "Warnings" section MUST aggregate all warnings produced during the run: multiple version sources detected (FR-3.1), version source override file missing (FR-3.2 fallback), pre-release suffix stripped (FR-3.5), uncategorized entries (FR-4.3), pre-1.0 major-to-minor coercion (FR-4.2), and the CI/CD `present-but-warning` reason (FR-5.4). If no warnings, the section MUST contain the literal string `(none)`.
7. **FR-6.7:** When the self-check (FR-1.3) returns `no-op: no unreleased changes`, the structured summary MUST be replaced by a single-line output of exactly that string. None of FR-6.1 through FR-6.6 apply in the no-op case — there is no version, no bump, no path.

#### FR-7: Pipeline Integration — `/merge-ready` Gate 9

Wire the agent into `/merge-ready` as a new conditional gate.

1. **FR-7.1:** `src/commands/merge-ready.md` MUST be updated to add a new gate "Gate 9: Release Packaging" at the end of the existing gate sequence (after Gate 8, the last existing gate per the zero-indexed Gate 0–Gate 8 inventory). The gate's checklist MUST reference FR-1.5's six-step sequence (self-check, version detection, bump computation, CHANGELOG rewrite, release-notes file, CI/CD provisioning) and the structured summary output (FR-6).
2. **FR-7.2:** Gate 9 MUST be CONDITIONAL: when `release-engineer` returns `no-op: no unreleased changes` (FR-1.3), the gate MUST be reported as `SKIPPED` in the gate output table (not `PASS`, not `FAIL`). When the agent returns a structured summary, the gate MUST be reported as `PASS` and the summary MUST be surfaced in the gate output. When the agent fails mid-sequence (FR-1.5), the gate MUST be reported as `FAIL` with the failure message.
3. **FR-7.3:** Gate 9 MUST run AFTER all existing gates — including the pre-flight `changelog-writer` sync hook from Section 3 FR-4.4. Specifically, the order at `/merge-ready` start is: (a) pre-flight `changelog-writer` sync (Section 3 FR-4.4 — non-blocking, not a gate); (b) Gate 0 through Gate 8 (existing — 9 gates total); (c) Gate 9 release packaging (new — bringing total to 10 gates). The pre-flight sync ensures `[Unreleased]` is up-to-date with `git log` before Gate 9 reads it.
4. **FR-7.4:** All references to "9 gates" or "Gate 8 is the last gate" in `src/commands/merge-ready.md`, `src/claude.md`, and `README.md` MUST be updated to reflect the new total of 10 gates and the new last-gate identifier "Gate 9". The gate-count table or list MUST include Gate 9 with its name, agent, and the conditional-skip note.
5. **FR-7.5:** Gate 9 MUST be invoked exactly once per `/merge-ready` invocation. Re-running `/merge-ready` after Gate 9 has produced a structured summary (and the developer has executed the commands) MUST result in Gate 9 reporting `SKIPPED` because the `[Unreleased]` section is now empty (the entries were renamed to `[X.Y.Z]` and a fresh empty `[Unreleased]` was inserted per FR-2.1). This is the natural idempotency boundary — re-running between commit-of-CHANGELOG and tag-push remains correctly idempotent.
6. **FR-7.6:** Gate 9 failure MUST NOT silently corrupt prior gate results. Specifically, a Gate 9 FAIL caused by a CHANGELOG parse error or a CI/CD provisioning write failure MUST NOT cause Gates 0–8 to be re-evaluated and MUST NOT cause merge-ready to retroactively report earlier gates as failed.

#### FR-8: Registration and Documentation

Register the new agent and propagate the agent count.

1. **FR-8.1:** `src/claude.md` Agency Roles table MUST be updated to include a new row: Role = "Release Engineer", Agent = `release-engineer`, Responsibility = "Package releases at /merge-ready Gate 9 — version bump, CHANGELOG date stamp, release-notes file, GitHub Actions release workflow provisioning". The row MUST be placed in the table at a position consistent with the pipeline order — at the end of the agency table (Gate 9 is the last gate).
2. **FR-8.2:** All references to "16 agents" / "16 specialized agents" / "16 AI agents" in `src/claude.md` prose MUST be updated to "17 agents" / "17 specialized agents" / "17 AI agents". Agent-count references in `README.md` — the tagline and the `## The 16 Agents` heading (or equivalent current wording) — MUST be updated to "17 specialized AI agents" and `## The 17 Agents` respectively. The current wording MUST be verified via `grep -n "16 specialized\|16 AI agents\|16 agents\|16 Agents" README.md src/claude.md` before editing.
3. **FR-8.3:** `README.md` MUST include a new row for `release-engineer` in its agent table/list alongside the existing 16 agents, placed consistent with the Agency Roles table ordering (last row). The role title in the README table MUST exactly match the title in `src/claude.md` ("Release Engineer").
4. **FR-8.4:** `README.md` MUST add a brief feature section (or update an existing features list) explaining that the pipeline now packages releases at Gate 9 of `/merge-ready`: version bump computation, CHANGELOG date stamping, release-notes file generation, and GitHub Actions workflow provisioning. The section MUST clarify the agent is suggest-only on remote actions (no git push, no gh release create, no version-source-file edits) and that the developer runs the structured summary commands.
5. **FR-8.5:** `install.sh` banner strings MUST be updated from "16" to "17" in all five locations that currently state "16" (same propagation pattern used in Section 1 NFR-5 for 12→13, Section 3 FR-5.2 for 13→14, Section 4 FR-6.5 for 14→15, and Section 5's 15→16). The exact set of banner strings MUST be enumerated by running `grep -n "16 specialized\|16 AI agents\|(16 files" install.sh` before editing — the implementer MUST verify the literal text in each location matches before making the substitution.
6. **FR-8.6:** `install.sh` MUST copy `src/agents/release-engineer.md` into `~/.claude/agents/` as part of the default install path (NOT gated behind `--init-project`). Verification: the installer uses a `src/agents/*.md` glob (per Section 5 design decision 2), so no installer-code change is required beyond verification that the glob covers the new file.
7. **FR-8.7:** `templates/CLAUDE.md` MUST be updated to extend the `Version source:` placeholder documentation introduced in Section 3 FR-5.5. The original iteration-1 documentation described the field as "reserved for future semver automation; in iteration 1 this field is informational only and has no runtime effect". The iteration-2 update MUST replace the "no runtime effect" language with: "consumed by `release-engineer` (Section 6) at /merge-ready Gate 9 to override the version-source priority order. Expected values are absolute or project-relative paths to the version-source file (e.g., `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`). Leave blank to use auto-detection per FR-3.1."
8. **FR-8.8:** The Plan Critic prompt in `src/claude.md` MAY be updated to recognize Gate 9's existence in any merge-ready plan checks, but iteration 2 does NOT require a new critic check for Gate 9-specific concerns. Existing critic checks (file-path verification, scope-reduction detection, wave validation) cover release-engineer's plan format adequately.

### 6.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files only. No runtime code (JavaScript, TypeScript, Python) is introduced. `install.sh` is modified only for banner strings (per FR-8.5) and file-copy verification (per FR-8.6); the shell logic itself is not restructured.
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Projects using SDLC v3.x without a populated `[Unreleased]` MUST continue to function — Gate 9 simply reports `SKIPPED`. Projects without Section 3 iteration 1 deployed (no `changelog-writer` configured) but with a manually-maintained `[Unreleased]` MUST still benefit from Gate 9 — `release-engineer` does not depend on `.claude/rules/changelog.md` per FR-1.4.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). No migration steps beyond re-running the installer. Downstream projects do NOT need to re-run `install.sh --init-project` to benefit from Gate 9 — `release-engineer` is a global agent, not a downstream-project-scoped rule.
4. **NFR-4:** The `release-engineer` agent MUST use the `opus` model consistent with all other agents (per Section 1 NFR-4).
5. **NFR-5:** The total global agent count rises from 16 to 17. All documentation references MUST be updated (per FR-8.2, FR-8.3, FR-8.5).
6. **NFR-6:** The agent MUST NOT access the network (per design decision 10). All inputs are local files. This parallels Section 3 NFR-7 and Section 4 FR-5.6.
7. **NFR-7:** The agent's typical wall-clock runtime SHOULD be under 5 seconds for self-check no-op invocations and under 20 seconds for full-sequence invocations (CHANGELOG rewrite + release-notes file + CI/CD provisioning). This is a soft performance target — Gate 9 runs once per merge-ready, so latency is not on the slice-execution critical path.
8. **NFR-8:** The agent's structured summary MUST be deterministic for the same `[Unreleased]` content, current version, and `.github/workflows/` state — running the agent twice in succession (without intervening developer edits) MUST produce identical summaries except for the `YYYY-MM-DD` date stamp if invocations cross midnight in the runtime timezone.
9. **NFR-9:** The total `/merge-ready` gate count rises from 9 to 10. All references in `src/commands/merge-ready.md`, `src/claude.md`, and `README.md` MUST be updated. The new gate is conditional (per FR-7.2) — its presence does not unconditionally extend merge-ready runtime.

### 6.5 Acceptance Criteria

1. **AC-1:** A file `src/agents/release-engineer.md` exists with valid frontmatter: `name: release-engineer`, `description`, `tools: ["Read", "Write", "Edit", "Glob", "Grep"]` (exactly this set, no `Bash`, no `WebFetch`, no `WebSearch`, no `NotebookEdit`), `model: opus`. Verifiable via `grep -n "tools:" src/agents/release-engineer.md` and inspecting the tool list. (FR-1.1)
2. **AC-2:** The agent prompt's first documented step is the self-check described in FR-1.3 — read `CHANGELOG.md`, parse `[Unreleased]`, return `no-op: no unreleased changes` if empty across all six categories. (FR-1.3)
3. **AC-3:** `src/commands/merge-ready.md` contains a new gate "Gate 9: Release Packaging" placed after Gate 8 in the gate sequence. The gate documentation includes the conditional-skip behavior (FR-7.2), invocation order relative to the pre-flight `changelog-writer` sync (FR-7.3), and references the `release-engineer` agent by exact registered name. (FR-7.1, FR-7.3)
4. **AC-4:** All references to "9 gates" or "Gate 8 is the last gate" in `src/commands/merge-ready.md`, `src/claude.md`, and `README.md` are updated to "10 gates" / "Gate 9 is the last gate" (or the analogous wording in each file). The merge-ready gate-count table includes Gate 9 with its name, agent, and conditional-skip note. (FR-7.4, NFR-9)
5. **AC-5:** When `release-engineer` is invoked in a project where `CHANGELOG.md` is missing or has an empty `[Unreleased]` section, the output is exactly `no-op: no unreleased changes` and no files are created or modified. Verifiable by running the agent in the SDLC repo (which has no `CHANGELOG.md` per Section 3 design decision 1) and observing the no-op output. (FR-1.3, FR-7.2)
6. **AC-6:** When `release-engineer` is invoked in a project with a populated `[Unreleased]` and `package.json` `version: "0.3.7"`, the agent: (a) renames `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` with `X.Y.Z` computed per FR-4 and `YYYY-MM-DD` as today's date; (b) inserts a fresh empty `[Unreleased]` heading above; (c) writes `.claude/release-notes-X.Y.Z.md` containing the renamed section's body; (d) provisions `.github/workflows/release.yml` if absent (or reports `present-and-correct` / `present-but-warning` if present); (e) emits the structured summary per FR-6.1. (FR-1.5, FR-2, FR-5)
7. **AC-7:** The bump algorithm is deterministic and matches the pinned rules in FR-4: (a) `0.3.7` + `Fixed`-only → `0.3.8`; (b) `0.3.7` + `Added` (with no `Removed`, no `breaking`) → `0.4.0`; (c) `1.2.3` + `Removed` → `2.0.0`; (d) `0.9.9` + `Removed` → `0.10.0` (pre-1.0 override, FR-4.2). The agent prompt MUST contain at least these four worked examples. (FR-4.5)
8. **AC-8:** The agent's `tools` frontmatter field does NOT include `Bash`, `WebFetch`, `WebSearch`, or `NotebookEdit`. Verifiable via `grep -n "tools:" src/agents/release-engineer.md`. The prompt's NEVER section explicitly prohibits running `git push`, `git tag`, `gh release create`, `npm publish`, `cargo publish`, network calls, modifications to version-source files, modifications to `~/.claude/settings.json`, and modifications to other agent files. (Design decision 4, FR-1.1, design decision 10)
9. **AC-9:** When the project's `CLAUDE.md` (at `./CLAUDE.md` or `.claude/CLAUDE.md`) contains the line `Version source: pyproject.toml`, the agent reads `pyproject.toml` for the current version EVEN IF `package.json` is also present (the override beats the priority order). Verifiable by setting up a test fixture with both files and confirming the override wins. (FR-3.2)
10. **AC-10:** `.github/workflows/release.yml` generated by the agent in the ABSENT case starts with the HTML comment `<!-- generated by claude-code-sdlc release-engineer at YYYY-MM-DD -->` (today's date), uses `softprops/action-gh-release@v2`, and has `body_path` referencing the release-notes file naming convention from FR-2.4 via the **two-step pattern** required by FR-5.2: a dedicated `Strip v prefix from tag` step (id `ver`) that runs `echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"`, with the `body_path` value reading `.claude/release-notes-${{ steps.ver.outputs.version }}.md`. The template MUST NOT use shell parameter expansion (e.g., `${GITHUB_REF_NAME#v}`) directly inside the `body_path:` value — that form does not evaluate at action-input time and would fail with "file not found" at workflow run time. Re-running the agent on a project with the agent's own provisioned workflow results in `present-and-correct` (no rewrite). (FR-5.2, FR-5.5)
11. **AC-11:** The agent's structured summary contains all ten labeled sections (FR-6.1) in the specified order, with the "Commands to run" fenced shell block matching the form in FR-6.5 with `X.Y.Z` substituted. When the version source did not need an update, the placeholder line is replaced with `# version source already at X.Y.Z` per FR-6.5. (FR-6.1, FR-6.5)
12. **AC-12:** The Agency Roles table in `src/claude.md` has a row for `release-engineer` with Role = "Release Engineer" placed at the end of the table, and all "16 agents" prose references in `src/claude.md` are updated to "17 agents". (FR-8.1, FR-8.2)
13. **AC-13:** `README.md` updates the tagline from "16 specialized AI agents" (or the verified current wording) to "17 specialized AI agents", updates the `## The 16 Agents` heading (or the verified current wording) to `## The 17 Agents`, includes a row for `release-engineer` in the agent table at the end, and adds a feature section describing the release packaging capability. (FR-8.2, FR-8.3, FR-8.4)
14. **AC-14:** `install.sh` has all five banner strings containing "16" updated to "17", matching the propagation pattern used for prior agent-count transitions. The exact locations are enumerated per the table in 6.6. (FR-8.5)
15. **AC-15:** `install.sh` copies `src/agents/release-engineer.md` into `~/.claude/agents/` as part of the default install path. After running `bash install.sh` on a clean machine, the file `~/.claude/agents/release-engineer.md` exists. (FR-8.6)
16. **AC-16:** `templates/CLAUDE.md` `Version source:` placeholder field documentation is updated to describe runtime consumption by `release-engineer` per FR-8.7. The new wording references Section 6 and explains the override-vs-auto-detection priority. (FR-8.7)
17. **AC-17:** Cross-references are valid: the agent registered in `src/claude.md` has a corresponding `src/agents/release-engineer.md` file; `src/commands/merge-ready.md` references the agent by its exact registered name; the release-notes file path used in the structured summary (`.claude/release-notes-X.Y.Z.md`) matches the path used in the GitHub Actions workflow template (`body_path` line). No phantom paths.
18. **AC-18:** Idempotency verified: running `/merge-ready` twice in succession on a project where Gate 9 produced a structured summary the first time (and the developer committed but did NOT yet run `git tag` / `git push`) results in Gate 9 reporting `SKIPPED` on the second run because `[Unreleased]` is now empty (the entries were renamed to `[X.Y.Z]` per FR-2.1). (FR-7.5)

### 6.6 Affected Components

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `src/agents/release-engineer.md` | The release-engineer agent prompt with self-check, version-source detection, semver bump computation, CHANGELOG manipulation, release-notes file write, CI/CD provisioning, structured summary, and explicit NEVER list | FR-1.1 through FR-1.6, FR-2.1 through FR-2.7, FR-3.1 through FR-3.5, FR-4.1 through FR-4.5, FR-5.1 through FR-5.7, FR-6.1 through FR-6.7 |
| `docs/use-cases/changelog-release-packaging_use_cases.md` | Use-case scenarios for the feature (authored by `ba-analyst` during this feature's own bootstrap) | Documentation phase deliverable |
| `docs/qa/changelog-release-packaging_test_cases.md` | QA test cases (authored by `qa-planner` during this feature's own bootstrap) | Documentation phase deliverable |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/commands/merge-ready.md` | Add Gate 9 "Release Packaging" at end of gate sequence (after Gate 8); document conditional-skip on empty `[Unreleased]`; update gate count from 9 to 10 in all references; document invocation order relative to pre-flight `changelog-writer` sync; rewrite the pre-flight comment at line 7; extend the gate-table at lines 80–91; add `SKIPPED` legend | FR-7.1 through FR-7.6, NFR-9 |
| `src/claude.md` | Add `release-engineer` row to Agency Roles table at end; update "16 agents" prose references to "17 agents"; update Plan Critic prompt if applicable for Gate 9 awareness | FR-8.1, FR-8.2, FR-8.8 |
| `README.md` | Update tagline "16" to "17"; update `## The 16 Agents` heading to `## The 17 Agents` (verified wording); add `release-engineer` row to agent table; add feature section describing release packaging + CI/CD provisioning | FR-8.2, FR-8.3, FR-8.4 |
| `install.sh` | Update all five banner strings from "16" to "17" matching the propagation pattern from prior agent-count transitions; verify `src/agents/release-engineer.md` is copied into `~/.claude/agents/` by the default install path | FR-8.5, FR-8.6 |
| `templates/CLAUDE.md` | Extend `Version source:` placeholder documentation: replace "no runtime effect" language with description of runtime consumption by `release-engineer`; document expected values (paths to version-source files); cross-reference Section 6 | FR-8.7 |

#### Agent Count Propagation (enumeration of every 16→17 location)

The agent-count propagation MUST update every one of the following locations. This enumeration exists specifically so the Plan Critic can verify no banner is missed during implementation (same diligence applied in Sections 1, 3, 4, and 5).

| Location | Current Value | Target Value | Related Requirement |
|----------|---------------|--------------|---------------------|
| `install.sh` banner 1 of 5 | "16" | "17" | FR-8.5 |
| `install.sh` banner 2 of 5 | "16" | "17" | FR-8.5 |
| `install.sh` banner 3 of 5 | "16" | "17" | FR-8.5 |
| `install.sh` banner 4 of 5 | "16" | "17" | FR-8.5 |
| `install.sh` banner 5 of 5 | "16" | "17" | FR-8.5 |
| `README.md` tagline | "16 specialized AI agents" (or verified current wording) | "17 specialized AI agents" | FR-8.2 |
| `README.md` section heading | `## The 16 Agents` (or verified current wording) | `## The 17 Agents` | FR-8.2 |
| `src/claude.md` prose references | "16 agents" / "16 specialized agents" (all occurrences) | "17 agents" / "17 specialized agents" | FR-8.2 |

Note: the exact wording of the `README.md` tagline and heading MUST be verified during implementation via `grep -n "16 specialized\|16 AI agents\|16 Agents" README.md src/claude.md install.sh` — the above rows reflect the expected shape based on prior section precedents, but the implementer MUST confirm the literal text before editing. The gate-count propagation is enumerated separately in the Gate-Count Propagation table below.

#### Gate-Count Propagation (enumeration of every 9→10 gate-count location and Gate-9-specific edit)

The gate-count propagation MUST update every one of the following locations. This enumeration exists specifically so the Plan Critic can verify no banner or document is missed during implementation (parallel to the Agent Count Propagation table above; same diligence pattern applied in Sections 1, 3, 4, and 5).

| Location | Current Value | Target Value | Related Requirement |
|----------|---------------|--------------|---------------------|
| `src/commands/merge-ready.md:7` (pre-flight comment) | "The gate list (Gate 0 through Gate 8) is UNCHANGED; no `Gate 10` exists in iteration 1 per PRD 3.8 item 7 and AC-11." | Rewrite to: "The gate list (Gate 0 through Gate 9) now includes Gate 9 release packaging per PRD Section 6 / FR-7.1. The pre-flight `changelog-writer` sync still runs before Gate 0 and is NOT itself a gate." | FR-7.1, FR-7.3 |
| `src/commands/merge-ready.md:80-91` (gate output table) | Gate output table shows 9 rows (Git Hygiene through UI/UX). | Extend with a 10th row for "Release Packaging" with status column accepting `PASS/FAIL/SKIPPED`, and add a `SKIPPED` legend below the table noting that Gate 9 reports `SKIPPED` when `[Unreleased]` is empty per FR-7.2. | FR-7.2, FR-7.4 |
| `src/commands/merge-ready.md` (new section after Gate 8) | (no `## Gate 9` section exists) | Add new `## Gate 9: Release Packaging` section delegating to the `release-engineer` agent, documenting the six-step sequence from FR-1.5, the conditional-skip behavior from FR-7.2, and the structured summary output from FR-6. | FR-7.1 |
| `README.md:35` ("9 quality gates") | "**9 quality gates**" | "**10 quality gates**" | FR-7.4, NFR-9 |
| `README.md:125` ("All 9 quality gates") | "All 9 quality gates" | "All 10 quality gates" | FR-7.4, NFR-9 |
| `README.md:135` ("9 quality gates including...") | "9 quality gates including..." | "10 quality gates including release packaging" | FR-7.4, NFR-9 |
| `src/claude.md` prose references to "9 gates" / "Gate 8 is the last" | (verified current wording) | "10 gates" / "Gate 9 is the last" | FR-7.4, NFR-9 |

Note: the exact text and line numbers for `README.md:35`, `README.md:125`, and `README.md:135` MUST be verified during implementation via `grep -n "9 quality gates\|9 gates\|All 9\|Gate 9\|Gate 8" README.md src/commands/merge-ready.md src/claude.md` — the rows reflect the expected text based on prior section precedents, but the implementer MUST confirm the literal text and line numbers before editing. Likewise, the line-range `src/commands/merge-ready.md:80-91` corresponds to the existing gate output table at the time of PRD authoring; the implementer MUST verify the table's current location before editing.

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Architecture review runs at bootstrap Step 3, before slices and merge-ready. No interaction with release packaging. |
| `src/agents/ba-analyst.md` | Use-case authoring runs at bootstrap Step 2. No interaction. |
| `src/agents/qa-planner.md` | QA test case authoring runs at bootstrap Step 4. No interaction. |
| `src/agents/prd-writer.md` | PRD authoring runs at bootstrap Step 2. No interaction. The `Changelog:` field requirement from Section 3 FR-3 is preserved unchanged — `release-engineer` reads `CHANGELOG.md` (already produced by `changelog-writer` from PRD `Changelog:` fields), not the PRD directly. |
| `src/agents/test-writer.md` | Test writing happens within slices. No interaction. |
| `src/agents/security-auditor.md` | Security review runs in earlier merge-ready gates and pre-slice. No interaction with Gate 9. |
| `src/agents/code-reviewer.md` | Code review runs in earlier merge-ready gates. No interaction. |
| `src/agents/build-runner.md` | Build verification runs in earlier merge-ready gates. No interaction. |
| `src/agents/e2e-runner.md` | E2E tests run in earlier merge-ready gates. No interaction. |
| `src/agents/verifier.md` | Verification runs in earlier merge-ready gates. No interaction. |
| `src/agents/doc-updater.md` | Documentation update runs in earlier merge-ready gates. `CHANGELOG.md` is maintained by `changelog-writer` (Section 3) and `release-engineer` (this section), not by `doc-updater` — same separation as Section 3. |
| `src/agents/refactor-cleaner.md` | Cleanup runs in Phase 2.5. No interaction with Gate 9. |
| `src/agents/changelog-writer.md` | The Section 3 iteration-1 agent. `release-engineer` consumes its output (`[Unreleased]` content) but does not modify `changelog-writer`'s prompt. The pre-flight sync hook from Section 3 FR-4.4 runs BEFORE Gate 9 per FR-7.3 — `changelog-writer` ensures `[Unreleased]` is current; `release-engineer` then packages it. No prompt change to `changelog-writer`. |
| `src/agents/resource-architect.md` | Bootstrap Step 3.5 agent from Section 4. Runs at bootstrap, not at merge-ready. No interaction. |
| `src/agents/role-planner.md` | Bootstrap Step 3.75 agent from Section 5. Runs at bootstrap, not at merge-ready. No interaction. |
| `src/agents/planner.md` | Slice planning runs at bootstrap Step 5. No interaction with Gate 9. The `Changelog:` field and structured-fields format established in prior sections are preserved. |
| `src/rules/git.md` | Git workflow rules unchanged. The structured-summary commands in FR-6.5 follow conventional-commit format (`chore(core): release X.Y.Z`) consistent with the existing rule. The agent does NOT execute git commands per design decision 10. |
| `src/rules/scratchpad.md` | Scratchpad format unchanged. `release-engineer` does NOT read or write the scratchpad — its inputs are `CHANGELOG.md`, version-source file, project `CLAUDE.md`, `.github/workflows/`. |
| `src/rules/error-recovery.md` | Error recovery rules unchanged. A Gate 9 failure follows the standard merge-ready gate failure pattern. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. |
| `src/commands/bootstrap-feature.md` | Bootstrap is unchanged by this section. Gate 9 is a merge-ready concern, not a bootstrap concern. |
| `src/commands/develop-feature.md` | Delegates to `/merge-ready` wholesale, so Gate 9 is inherited automatically. No prompt change required. |
| `src/commands/implement-slice.md` | Slice execution runs before merge-ready. No interaction with Gate 9. |
| `src/commands/context-refresh.md` | Context refresh reads scratchpad. Gate 9 state is not session context — it is per-merge-ready ephemeral output. No change. |
| `templates/rules/changelog.md` | Section 3 iteration-1 downstream-project rule. `release-engineer` does NOT depend on this rule's presence per FR-1.4 — it depends on `[Unreleased]` content, regardless of whether `changelog-writer` is configured. No change. |

### 6.7 UI Changes, Schema Changes, Affected Endpoints

Not applicable on all three counts. The SDLC project is a collection of markdown prompt files with no UI, database, or API — same as prior sections.

### 6.8 Out of Scope for Iteration 2 (further deferred)

The following items are explicitly out of scope for iteration 2 and MUST NOT be implemented as part of this section. They are listed explicitly so the Plan Critic does not flag their absence as a gap during iteration 2 planning.

1. **Multi-package monorepo support.** Iteration 2 assumes a single version source per project. Monorepos with per-package versions (e.g., npm workspaces, Lerna, Nx with per-package `package.json`) are not handled — the agent reads the root-level version source and computes a single bump for the entire repo. Per-package release packaging is deferred to a future iteration.
2. **GitLab CI / Bitbucket Pipelines / CircleCI provisioning.** Iteration 2 covers ONLY GitHub Actions (`.github/workflows/release.yml`). Other CI/CD providers (`.gitlab-ci.yml`, Bitbucket `bitbucket-pipelines.yml`, CircleCI `.circleci/config.yml`, Jenkins, Azure Pipelines, Travis CI) are not detected and not provisioned — the agent leaves them untouched and emits a warning if it detects them without a corresponding `.github/workflows/release.yml`. Multi-provider support is iteration-3 territory.
3. **Automatic version bump in version-source file.** The agent reads `package.json`, `pyproject.toml`, `Cargo.toml`, or `VERSION` but NEVER writes to them per FR-3.4. Updating the version-source file is the developer's responsibility per the project's tooling (`npm version`, `poetry version`, `cargo set-version`, manual `VERSION` edit). Automating this update would require running shell commands or editing structured config files in tool-specific ways, both out of scope for iteration 2's suggest-only authority model.
4. **`gh release create` execution by Claude.** The agent never invokes `gh release create` or any other publish command per design decision 10. The user runs the structured-summary commands. Direct release publishing by the agent would require `Bash` access (excluded by FR-1.1) and network access (excluded by NFR-6).
5. **Automatic git tag annotation.** The agent emits the `git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md` command in its structured summary but does NOT execute it. Tag creation is the user's action.
6. **Release notification (Slack, email, etc.).** Iteration 2 does NOT integrate with notification systems. The GitHub Actions workflow generated in FR-5.2 is intentionally minimal — it creates the GitHub Release but does not post to Slack, email, or any other channel. Notification integrations are iteration-3+ territory.
7. **Pre-release / RC version handling.** Iteration 2 strips pre-release suffixes per FR-3.5 and emits clean `X.Y.Z` releases only. Workflows that publish `X.Y.Z-beta.1`, `X.Y.Z-rc.2`, etc., are not supported. Pre-release support is deferred.
8. **Custom workflow templates beyond `softprops/action-gh-release@v2`.** Iteration 2 hardcodes the action choice in FR-5.2. Allowing developers to customize the workflow template (different action, different `permissions`, additional steps for asset uploads, etc.) is deferred. Developers who need customization can hand-edit the generated `release.yml` after the agent writes it — the agent will report `present-and-correct` on subsequent runs as long as the `body_path` source remains `CHANGELOG.md`-derived per FR-5.3.
9. **Release asset attachments.** The generated workflow does NOT upload binary release assets (compiled artifacts, archives, installers). Asset upload steps require build steps that are project-specific. Iteration 2 generates a body-only release; asset attachment is the developer's responsibility to add manually if needed.
10. **Programmatic detection of breaking changes from code diffs.** Iteration 2 detects breaking changes only via the `breaking` token in `[Unreleased]` entry text or via the `Removed` category being non-empty per FR-4.1. Static analysis of code changes to detect breaking API changes (e.g., comparing exports between two commits) is out of scope.
11. **Automated re-trigger of `changelog-writer` from Gate 9.** Gate 9 runs AFTER the pre-flight `changelog-writer` sync per FR-7.3. If Gate 9's CHANGELOG manipulation introduces drift (e.g., a developer hand-edits `[Unreleased]` between pre-flight sync and Gate 9), the agent does NOT re-invoke `changelog-writer` to re-sync. The pre-flight sync is the only sync hook in merge-ready.

### 6.9 Risks and Dependencies

1. **Risk: Suggest-only authority violated by prompt drift.** Over time, the agent prompt could be revised to grant install or push authority. Mitigation: FR-1.1 restricts the agent's `tools` frontmatter to `["Read", "Write", "Edit", "Glob", "Grep"]` — the absence of `Bash` makes it mechanically impossible for the agent to execute `git push`, `git tag`, `gh release create`, `npm publish`, or any package-manager command, even if the prompt were revised. This is the same defense-in-depth pattern Section 4 FR-5.7 established. Both prompt boundary and tool boundary prohibit the disallowed actions.
2. **Risk: Bump algorithm produces wrong version.** If the agent misclassifies entries (e.g., interprets a `Fixed:` entry as `Added`), the computed version will be incorrect and the developer ships a misleadingly-versioned release. Mitigation: FR-4.5 requires the algorithm to be deterministic with worked examples in the prompt. The structured summary's "Bump computation explanation" section (FR-6.4) shows the developer which categories were observed and which rule was applied — the developer can audit the choice before running the publish commands.
3. **Risk: Pre-1.0 override accidentally suppressed.** If the override in FR-4.2 is forgotten or its check is buggy, a pre-1.0 project might receive a major bump (e.g., `0.9.9` → `1.0.0` from a `Removed` entry that should have produced `0.10.0`). Mitigation: AC-7 requires a worked example specifically for the pre-1.0 override (`0.9.9 + Removed → 0.10.0`), and the structured summary in FR-6.4 must explicitly note pre-1.0 coercion when it occurs. The developer reviews the summary before publishing.
4. **Risk: CI/CD provisioning overwrites a hand-tuned workflow.** If the body-source-detection logic in FR-5.3 has a false negative (detects a correctly-configured workflow as `present-but-warning` and the developer mistakenly authorizes a "fix"), or if the agent is reinvoked after a manual hand-tune that broke `body_path` matching, the workflow could be needlessly overwritten. Mitigation: FR-5.3 specifies the body-source check as the authoritative criterion (not just the HTML comment marker), so hand-tuned workflows that retain `body_path: .claude/release-notes-*.md` are treated as `present-and-correct`. Additionally, FR-5.4 explicitly forbids modification of present-but-warning workflows — the agent never overwrites; it only writes when `release.yml` is absent.
5. **Risk: GitHub Actions tag-name-to-file-name mismatch.** The release-notes file is named `release-notes-X.Y.Z.md` (without the `v` prefix), while the GitHub Actions tag-trigger context exposes the tag name `vX.Y.Z` via `${{ github.ref_name }}` (with the `v` prefix). A naive template that uses `body_path: .claude/release-notes-${{ github.ref_name }}.md` would resolve to `.claude/release-notes-vX.Y.Z.md` and fail with "file not found". An equally-broken alternative is `body_path: .claude/release-notes-${GITHUB_REF_NAME#v}.md` — YAML strings do not evaluate shell parameter expansion at action-input time, so the literal characters `${GITHUB_REF_NAME#v}` would be passed to the action verbatim and produce a file-not-found error of a different shape. Mitigation: FR-5.2 mandates the **two-step pattern** with a dedicated `Strip v prefix from tag` step that runs `echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"` (where bash actually evaluates the expansion) and threads the result via `${{ steps.ver.outputs.version }}` into `body_path`. AC-10 verifies the generated file uses this two-step pattern and rejects both naive forms.
6. **Risk: Version source file missing or unreadable.** If the project has none of `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`, no git tags, AND no `Version source:` line in `CLAUDE.md`, the agent falls back to `0.1.0` per FR-3.3. This is correct for greenfield projects but produces a misleading "current version" for projects that have shipped without a tracked version source. Mitigation: FR-3.3 requires the fallback case to be explicitly noted in the structured summary. The developer sees "(none — fallback 0.1.0)" and can correct by adding a version source before publishing.
7. **Risk: Concurrent Gate 9 executions corrupt CHANGELOG.md.** If the developer runs `/merge-ready` twice in parallel (e.g., in two terminals), both invocations could attempt to rename `[Unreleased]` simultaneously, producing duplicate `[X.Y.Z]` headings or corrupted markdown. Mitigation: iteration 2 assumes single-pipeline-at-a-time (same implicit assumption as Sections 4 and 5). Multi-pipeline concurrency safety is not a concern for iteration 2.
8. **Risk: Agent-count propagation drift (16→17).** The update touches five `install.sh` banners, two `README.md` locations, prose in `src/claude.md`, AND the gate-count update from 9 to 10 in three files. Missing a single location leaves inconsistent documentation. Mitigation: the Agent Count Propagation table in 6.6 enumerates every location, and the gate-count propagation is called out separately in FR-7.4 and NFR-9. The Plan Critic is expected to verify all are addressed before merge — same diligence pattern applied in Sections 1, 3, 4, and 5.
9. **Risk: Empty `[Unreleased]` after release leaves dangling release-notes file.** Per FR-2.6, `release-engineer` does NOT delete `.claude/release-notes-X.Y.Z.md` after writing it. If the developer abandons the release (deletes the new `[X.Y.Z]` heading manually), the release-notes file remains on disk. Mitigation: the file is small and harmless. The developer manually deletes it if undesired. The `.claude/` directory is project-local and developer-controlled.
10. **Risk: GitHub Actions workflow runs unintentionally on tag push for unrelated tags.** The trigger `on: push: tags: ['v*.*.*']` matches any tag starting with `v` followed by three numeric components. If the project uses a different tag convention for non-release purposes (e.g., `v-special` for internal markers), those tags won't match `v*.*.*`. But if the project uses `v1.0.0-internal` for internal markers, the workflow could fire unintentionally. Mitigation: the chosen pattern `v*.*.*` is the conventional release-tag glob; projects with non-standard tag conventions will hand-edit the workflow after the agent writes it (and the agent will then report `present-but-warning` or `present-and-correct` on subsequent runs).
11. **Risk: Race between pre-flight `changelog-writer` sync and Gate 9.** Per FR-7.3, the pre-flight sync runs before Gate 9. If the pre-flight sync fails (per Section 3 FR-4.5 it's non-blocking, so the failure does not halt merge-ready), Gate 9 reads a stale `[Unreleased]` and packages outdated content. Mitigation: this is an acceptable degradation — the developer sees the merge-ready output (including any pre-flight sync failures) and decides whether to abort or proceed. The packaged release reflects the CHANGELOG state at Gate 9 time, which is the standard behavior.
12. **Dependency: Section 3 FR-2 (`changelog-writer` agent and `[Unreleased]` content sync).** Gate 9 reads `CHANGELOG.md` `[Unreleased]` produced by `changelog-writer`. If Section 3 has not shipped, `[Unreleased]` is hand-maintained — `release-engineer` still works (per FR-1.4 it does not depend on Section 3 being deployed, only on `[Unreleased]` being populated), but the typical workflow assumes Section 3 iteration 1 is deployed. Section 3 is [IN DEVELOPMENT] concurrently; iteration 2 of Section 3 (this section) MUST land after iteration 1 ships. The implementer MUST sequence iteration 1 first, then iteration 2.
13. **Dependency: Section 3 FR-5.5 (`Version source:` placeholder in `templates/CLAUDE.md`).** Iteration 1 introduced the field as dead metadata specifically so iteration 2 could consume it without a second migration. Iteration 2 (FR-3.2 and FR-8.7) consumes the field as the override mechanism. Section 3 is [IN DEVELOPMENT]; FR-5.5 must be present in `templates/CLAUDE.md` before iteration 2 ships.
14. **Dependency: Section 3.10 (Iteration 2 Scope Preview).** Section 3.10 explicitly anticipated this section and deferred the role-placement decision (new agent vs. extension of existing role), the CI/CD provider matrix, and the version-source-of-truth choice. This section makes those decisions: new dedicated `release-engineer` agent (design decision 1), GitHub Actions only (design decision 8 and 6.8 item 2), version source detected per FR-3.1 with `Version source:` override per FR-3.2. Section 3.10 is forward-looking and non-binding; this section's decisions are authoritative.
15. **Dependency: Section 4 (Resource Manager-Architect).** Orthogonal — `resource-architect` runs at bootstrap, `release-engineer` runs at merge-ready. The suggest-only authority pattern and `tools` defense-in-depth restriction are reused (design decision 4 explicitly cites Section 4 FR-5.7), but no functional dependency. Section 4 is [IN DEVELOPMENT] concurrently.
16. **Dependency: Section 5 (Role Planner).** Orthogonal — `role-planner` runs at bootstrap, `release-engineer` runs at merge-ready. The 16→17 agent count propagation in this section assumes Section 5's 15→16 propagation has shipped first. Section 5 is [IN DEVELOPMENT] concurrently; the implementer MUST sequence Section 5 before Section 6 to avoid agent-count drift.
17. **Dependency: Section 1 FR-3 (Executable Plan Format).** This section's slices follow the structured-fields pattern (`Files:`, `Changes:`, `Verify:`, `Done when:`, optionally `Wave:`). Section 1 is [SHIPPED], dependency satisfied.
18. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT]; this dependency is satisfied by the prd-writer update in Section 3 FR-3.1. If Section 3 iteration 1 does not ship before this section, the `Changelog:` field is documentation-only — it does not affect Section 6's functional requirements.
19. **Dependency: SDLC repo opts out of changelog maintenance.** Per Section 3 design decision 1, the SDLC repo itself has no `.claude/rules/changelog.md`, so `changelog-writer` self-skips for this PRD section. Likewise, the SDLC repo's own `CHANGELOG.md` is not maintained, so Gate 9 of `/merge-ready` in the SDLC repo's own development MUST report `SKIPPED` per FR-1.3 (the `[Unreleased]` section does not exist in a non-existent CHANGELOG). Expected behavior, not a risk — parallel to Section 4 Dependency 11 and Section 5 Dependency 16.
20. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — Gate 9 runs at merge-ready, after all waves complete. Wave orchestration is unaffected. Listed here only to disclaim the non-relationship, parallel to Section 4 Dependency 12 and Section 5 Dependency 17.

---

## 7. Resource Manager-Architect — Iteration 2: Auto-Install

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-25
**Priority:** Medium
**Related:** Section 4 (Resource Manager-Architect — Iteration 1: Mandatory Pipeline Role; this section EXTENDS the same `resource-architect` agent introduced there and preserves all of its iteration-1 suggest-only behavior as a strict subset of iteration-2 behavior), Section 3 (FR-3: PRD Changelog Field — this section includes the field per that contract), Section 1 (FR-2: Deviation Rules — Sensitive-tier escalation routes through Rule 4), Section 6 (Release Engineer — shares the `tools` defense-in-depth restriction pattern but extends it with a Bash-whitelist jail rather than excluding `Bash` outright)
**Changelog:** resource-architect now auto-installs MCP tools and dev dependencies after your approval — no more manual copy-paste.

### 7.1 Description

Extend the existing `resource-architect` agent (introduced in Section 4) with an **auto-install capability** that follows the suggestion phase. After the iteration-1 suggestion output (`.claude/resources-pending.md`) is produced, the agent emits a single approval-prompt block enumerating all `Trivial` and `Moderate` resources as yes/no items, parses the user's response, and then runs the approved install commands within a tightly-bounded Bash whitelist jail. The agent uses a detect-then-install pattern (skip already-present resources, abort on version conflicts), a 4-tier authority gradation (`Trivial` auto-applied with single category approval, `Moderate` per-item explicit approval, `Sensitive` escalated via Rule 4, `Forbidden` never), and emits a per-item PASS/FAIL/SKIPPED summary appended to `.claude/resources-pending.md` as a new `## Auto-Install Results` section.

**Why:** Section 4 iteration 1 made `resource-architect` mandatory and suggest-only — the agent produces a list of recommended resources and the user copy-pastes the install commands manually. In practice, most recommendations are routine and low-risk (`claude mcp add <pinned-mcp>`, `npm install --save-dev playwright`, `pip install --user pytest`) and the manual copy-paste step adds friction without value. Iteration 2 closes this loop for the safe subset: with explicit user approval, the agent runs the install commands itself — but only commands that match a strict whitelist of patterns, only after detecting that the resource is actually absent, and only at the gradation level the resource warrants. Sensitive operations (cloud creds, paid signups, secrets stores) remain manual via Rule 4 escalation. Forbidden operations (deletes outside CWD, modifying SDLC core files, network calls beyond explicit installs) are never permitted.

**Audience:** Same as Section 4 — the **developer running the SDLC pipeline**. The new approval prompt is rendered in console output during bootstrap Step 3.5 and is the developer's interactive checkpoint between suggestion and execution. The `## Auto-Install Results` section appended to `.claude/resources-pending.md` is for the developer's audit; like the iter-1 suggestion content, it is inlined into `.claude/plan.md` by the planner at Step 5 (preserving Section 4 FR-2.5).

**Scope boundary:** This section covers **Iteration 2: Auto-Install ONLY**. The agent extension does NOT add a new agent (count stays at 17 from Section 6), does NOT add a new bootstrap step (Step 3.5 stays — the suggestion phase is preserved and the new approval+install phase appends to it), does NOT add a new `/merge-ready` gate (gate count stays at 10 from Section 6), and does NOT alter the existing Section 4 suggest-only behavior on its own — iteration-2 behavior is layered on top. Cross-feature install dedup, Sensitive-tier auto-apply, rollback of installed resources on feature abort, multi-OS install variants, and runtime-level tools-frontmatter enforcement are all deferred — see 7.8.

**Design decisions:**

1. **Extend existing agent, do NOT create a new one.** The agent file is `src/agents/resource-architect.md` (same file as Section 4). The iteration-2 changes are additive edits to the prompt — adding an "Install mode" capability section, expanding the `tools` field, documenting the 4-tier authority gradation, defining the Bash whitelist, defining the detect-then-install pattern, defining the approval flow, and extending the output contract. The total global agent count stays at 17 (the value Section 6 brings it to). No new row in the Agency Roles table; instead, the existing `resource-architect` row's "Responsibility" column is extended to mention auto-install with approval.

2. **Pipeline position: bootstrap Step 3.5 (unchanged).** The agent is invoked at the same step as Section 4 FR-3.1 — between Step 3 (Software Architect review) and Step 4 (QA Lead test cases). The suggestion phase from iteration 1 runs first (producing the `## Recommended Resources` body in `.claude/resources-pending.md`); the new approval+install phase runs immediately after within the same agent invocation in the same step. No new step number, no new gate, no change to subsequent steps. The Step 3.75 (`role-planner`, Section 5) and Step 4 (QA, Section 4 FR-3.1) ordering is preserved.

3. **Tools field expansion: add `Bash`.** The agent's `tools` frontmatter field is expanded from the iteration-1 set `["Read", "Write", "Glob", "Grep"]` (Section 4 FR-5.7) to `["Read", "Write", "Bash", "Glob", "Grep"]`. The new `Bash` tool is exclusively for executing install commands that match the FR-2 whitelist patterns. The agent's prompt MUST contain explicit guard logic: every command the agent intends to run is matched against the whitelist regex set; any command not matching is aborted before the `Bash` tool is invoked. This reverses the Section 4 FR-5.7 defense-in-depth posture (which excluded `Bash` to mechanically prevent installs) — iteration 2 deliberately grants `Bash` because installs are now in scope, but adds a stricter prompt-level whitelist jail to bound what `Bash` can execute. The same defense-in-depth philosophy applies, with the boundary moved from "no Bash" to "Bash with whitelist".

4. **4-tier authority gradation (PINNED).** Every recommended resource carries a tier classification consumed by the install phase. The agent prompt MUST classify each resource into exactly one of:
   - **Trivial** — auto-applied with a single yes/no category approval (e.g., one prompt for "all MCP installs", not one per MCP). Examples: `claude mcp add <pinned-mcp>` (project-local install), `npx playwright install` (project tooling browser binaries), creating `.env.example` skeleton files (no secrets, just placeholder keys).
   - **Moderate** — per-item explicit approval (the user reviews each command in turn before the agent runs it). Examples: `npm install --save-dev <package>`, `pip install --user <package>`, `pnpm add -D <package>`, modifying `.gitignore` patterns, creating project-local config files (e.g., `playwright.config.ts`).
   - **Sensitive** — Rule 4 ESCALATE (the agent stops and presents the action to the user; the agent NEVER auto-applies). Examples: cloud credentials setup (AWS/GCP/Azure), API key configuration, paid service signup, any write to `~/.aws/`, `~/.config/gcloud/`, `~/.config/gh/`, or any other secrets store.
   - **Forbidden** — NEVER attempted. The agent's prompt enumerates forbidden patterns explicitly so the agent does not enter the approval flow with them. Examples: `rm`/`rmdir`/`mv` of anything outside `.claude/` and project CWD, modifying SDLC core files (`src/`, `templates/`, `install.sh`, `docs/`, root `CLAUDE.md`), modifying other agents (`~/.claude/agents/*` other than its own iteration-2 self-changes which are out of agent runtime scope and only happen at install-time), `git push`/`git tag`/`git commit -a`, network calls beyond the explicit Trivial-tier `claude mcp add` and `npx playwright install` installs.

5. **Bash whitelist jail.** The agent prompt enumerates exact whitelisted command patterns as regex or exact prefix strings. Before invoking `Bash` for any command, the agent MUST match the candidate command against the whitelist; non-matching commands are ABORTED with a literal violation message ("Authority Boundary violation: command `<cmd>` does not match any whitelist pattern"). The whitelist is conservative and additive only via PRD revisions — runtime expansion is not permitted. Specific whitelist patterns are defined in FR-2.2.

6. **Detect-then-install pattern.** Before any install command runs, the agent runs a detection command (within the same whitelist) to determine if the resource is already present. Three outcomes:
   - **Present + version-compatible** → SKIP (annotate the item in the auto-install results as `skipped-already-present` with the detected version).
   - **Present + version-conflict** → ABORT for this item with a warning ("Found playwright@1.40.0 but iter-1 recommended @1.45.0; manual reconciliation required"). No auto-resolve, no auto-upgrade, no auto-downgrade. The item is annotated as `aborted-version-conflict` and the user is notified in the auto-install results section.
   - **Absent** → proceed to the approval flow (Trivial/Moderate per FR-1's tier classification) or to Sensitive-tier escalation if applicable.
   Detection commands must be in the same whitelist as install commands (e.g., `claude mcp list`, `npm list --depth=0`, `pip list`, `cargo metadata --format-version 1`, `cat package.json`).

7. **Approval flow.** After producing the iter-1 suggestion section (Section 4 FR-2.2 `## Recommended Resources` body in `.claude/resources-pending.md`), the agent emits a single approval-prompt block to the user via console output. The block enumerates all Trivial-tier items (grouped by category for single yes/no per category) and all Moderate-tier items (one yes/no per item). Sensitive-tier items are not in the approval block — they are surfaced via Rule 4 escalation directly. The orchestrator (`/bootstrap-feature`) displays the prompt; the user replies in free-form text (e.g., "yes to playwright MCP, no to additional npm packages, yes to pytest"). The agent parses the reply, runs only the approved items in the order they appear in the suggestion section, and emits the per-item summary. Approval is required — the agent MUST NOT auto-apply any item without explicit approval, and "no response" / ambiguous response is treated as "no" for safety.

8. **Halt semantics.** Failure handling differs by tier and operation:
   - **Trivial install fails** (e.g., `claude mcp add` returns non-zero) → emit a warning to the auto-install results, continue to the next item. Trivial failures are non-blocking.
   - **Moderate install fails** (e.g., `npm install --save-dev foo` returns non-zero) → ABORT remaining Moderate items in the same approval batch, surface to the user, mark all subsequent Moderate items as `aborted-batch-halted`. Moderate failures are batch-blocking because a failed install often signals environment-level issues (missing package manager, network, etc.) that subsequent installs would also hit.
   - **Sensitive detected** → ABORT the entire install phase, escalate to the user (Rule 4 from Section 1). The suggestion section is preserved; the auto-install phase ends with a `aborted-sensitive` annotation. Bootstrap Step 3.5 still SUCCEEDS (the suggestion is the primary deliverable; auto-install is the optional layer), so Step 3.75 and Step 4 proceed normally.
   - **Forbidden command attempted** (whitelist violation) → ABORT immediately, surface as an Authority Boundary violation, mark the offending item as `aborted-whitelist-violation`, halt the auto-install phase. This is a defensive guard — under normal operation the agent's prompt logic should never produce a forbidden command, but the whitelist check is the runtime backstop.

9. **Cross-feature install dedup deferred to iteration 3.** Iteration 2 does NOT track which resources were installed for which prior feature. Re-detection on each invocation (per design decision 6) handles the "already installed" case correctly — if a prior feature installed Playwright MCP and the current feature also recommends it, the detection step finds it present and the item is annotated `skipped-already-present`. Cross-feature install history tracking, deduplication of recommendations across features, and "do not re-recommend if already installed for prior feature X" are all iteration-3 territory.

10. **Output contract extension.** The iter-1 suggestion section (Section 4 FR-2.2 — `## Recommended Resources` body in `.claude/resources-pending.md`) is preserved unchanged. After the approval+install phase, the agent appends a NEW `## Auto-Install Results` section to the SAME temp file `.claude/resources-pending.md`. The auto-install results section enumerates each Trivial/Moderate item with its outcome status from the FR-3 enumeration: `auto-applied`, `approved-and-applied`, `approved-but-failed`, `skipped-already-present`, `aborted-version-conflict`, `aborted-sensitive`, `aborted-whitelist-violation`, `aborted-batch-halted`, `not-approved`. The user-facing approval prompt is embedded in console output (not in the temp file) — only the structured results land on disk.

11. **Backward compatibility — suggest-only mode preserved.** The iter-1 suggest-only behavior is a strict subset of iter-2 behavior. If the user replies "no to all" in the approval prompt, OR if the user has no Trivial/Moderate items to approve (e.g., the feature only has Sensitive-tier resources or the recommendation is "No external resources required" per Section 4 FR-1.5), the agent's runtime behavior is identical to iter-1: the `## Recommended Resources` section is produced, no installs are run, and the `## Auto-Install Results` section either contains the literal string "No installable items" or is omitted entirely. This guarantees that any project that worked under iteration 1 continues to work identically under iteration 2 if the user opts out of installs.

12. **Changelog field value.** The SDLC repo itself has no `.claude/rules/changelog.md` (per Section 3 design decision 1, the SDLC opts out of its own changelog maintenance), so `changelog-writer` will self-skip for this PRD section. The `Changelog:` field is still required per Section 3 FR-3.3 and is authored accordingly.

### 7.2 User Story

As a developer using the Claude Code SDLC pipeline, I want the resource-architect agent — after presenting its recommendation list — to ask me a single approval question per category for trivial installs (like a pinned MCP server) and one approval question per item for moderate installs (like a dev dependency), and then run the approved commands itself within a strict whitelist, skipping resources I already have and aborting cleanly on version conflicts or sensitive operations, so that I do not have to copy-paste five terminal commands at the start of every feature, while still keeping a hand on the trigger for anything that touches credentials, paid services, or my SDLC core files.

### 7.3 Functional Requirements

#### FR-1: Authority Tiers (Trivial / Moderate / Sensitive / Forbidden)

Define the 4-tier authority gradation that drives the approval flow and the install execution. Each recommendation entry produced in the iter-1 suggestion section (Section 4 FR-1.4) MUST be classified by the agent into exactly one tier.

1. **FR-1.1:** The agent prompt MUST extend the iter-1 recommendation entry format (Section 4 FR-1.4's six fields: Category, Name, Why, Install/activate command, Cost/complexity flag, Reversibility) with a new SEVENTH field `Tier:` taking exactly one of the values `Trivial`, `Moderate`, `Sensitive`, `Forbidden`. The `Tier:` field MUST appear immediately after the `Reversibility:` field. Adding the `Tier:` field is purely additive — it does not modify any of the six iter-1 fields. The iter-1 `Cost/complexity flag` (`trivial` / `moderate` / `expensive`) and the new `Tier:` field are independent: a `trivial` cost item could still be `Sensitive` tier (e.g., adding a `.env` value is cost-trivial but tier-sensitive), and an `expensive` cost item could be `Trivial` tier (in principle, though uncommon).
2. **FR-1.2:** **Trivial tier** MUST be assigned to resources whose install command (a) matches the `Bash` whitelist in FR-2.2 with no per-item parameters that vary across users, (b) installs to project-local or user-local scopes only (no system-level mutations), (c) has no credentials or secrets in its arguments, and (d) is reversible by a single inverse command or by deletion of a project-local file. Examples enumerated in the agent prompt MUST include: `claude mcp add <pinned-mcp-name> <pinned-args>` (pinned arguments, no per-user variation), `npx playwright install` (downloads browser binaries to project-local cache), `npx playwright install --with-deps` (same plus OS deps via the underlying tool's installer), creating `.env.example` skeletons (no secret values, just placeholder key names).
3. **FR-1.3:** **Moderate tier** MUST be assigned to resources that mutate project files in non-trivial ways or that pull in arbitrary upstream code. Examples enumerated in the agent prompt MUST include: `npm install --save-dev <package>`, `pnpm add -D <package>`, `yarn add --dev <package>`, `pip install --user <package>`, `poetry add --group dev <package>`, modifying `.gitignore` patterns (adding lines via `Write` tool — Bash command pattern is not used here because it is a file edit, not a shell install; the Moderate tier classification still applies), creating project-local config files (e.g., `playwright.config.ts`, `vitest.config.ts`, `pytest.ini`).
4. **FR-1.4:** **Sensitive tier** MUST be assigned to ANY resource whose install or configuration touches: cloud-provider credentials (AWS/GCP/Azure SDK setup, `aws configure`, `gcloud auth login`), API keys for paid services (OpenAI/Anthropic/Stripe/Twilio key setup), paid service signup (creating accounts on Sentry/Datadog/Auth0/etc. with billing implications), writes to `~/.aws/`, `~/.config/gcloud/`, `~/.config/gh/`, `~/.netrc`, or any other secrets store, or any `.env` file containing real credentials (placeholder `.env.example` files are Trivial per FR-1.2; real `.env` with values is Sensitive). Sensitive items MUST be surfaced via Rule 4 escalation (Section 1 FR-2.4) — the agent stops the auto-install phase, presents the item with its rationale, and the user performs the action manually. Sensitive items MUST NOT appear in the approval prompt block (the prompt is for Trivial/Moderate only).
5. **FR-1.5:** **Forbidden tier** MUST be assigned to ANY operation matching: `rm`/`rmdir`/`mv`/`cp` outside `.claude/` and project CWD, modifying SDLC core files at `src/`, `templates/`, `install.sh`, `docs/`, or root `CLAUDE.md` (the SDLC repo's own files), modifying any agent prompt at `~/.claude/agents/*` (other than the agent's own self-update at install time, which is install.sh's responsibility — not at agent runtime), `git push`, `git tag`, `git commit -a`, `git rebase`, `git reset --hard`, network calls beyond the explicit Trivial-tier installs (no `curl`, `wget`, `http`, `ssh`, no DNS lookups outside the upstream package registries that Trivial-tier installs already use), shell metacharacter chaining (`&&`, `||`, `|`, `;`, `>`, `>>`, `<`, `<<`, backticks, `$()`), `sudo`/`su`/`runas`. Forbidden items MUST NOT appear in the approval prompt block AND MUST NOT be surfaced via Rule 4 — they are simply removed from consideration. The agent's tier classification logic MUST detect Forbidden patterns at suggestion time and EITHER (a) refuse to recommend the resource at all (rewriting the recommendation to an alternative or omitting it), OR (b) recommend the resource but mark its `Tier: Forbidden` and explicitly note "user must perform manually outside the SDLC pipeline" — both are acceptable; the choice depends on whether a non-forbidden alternative exists.
6. **FR-1.6:** Tier classification MUST be reproducible: given the same recommendation entry, the agent MUST always assign the same tier. The agent prompt MUST include a decision-table in plain prose enumerating the tier assignment for each example operation (the FR-1.2 through FR-1.5 examples are the canonical reference). When a recommendation does not match any explicitly-enumerated example, the agent MUST default to the most restrictive applicable tier (`Sensitive` over `Moderate` over `Trivial`) and note the conservative classification in the recommendation entry's `Why` field.
7. **FR-1.7:** The summary line at the top of `.claude/resources-pending.md` (introduced by Section 4 FR-1.6 — total recommendation count, count of `expensive` flags, count of `hard` reversibility flags) MUST be EXTENDED to also include: count of `Trivial` tier items, count of `Moderate` tier items, count of `Sensitive` tier items, count of `Forbidden` tier items. This lets the developer see at a glance how much of the recommendation list is auto-installable, how much requires per-item approval, and how much escalates or is forbidden. The Section 4 FR-1.6 fields (total / expensive / hard) MUST be preserved; the new tier counts are appended to the same summary line.

#### FR-2: Bash Whitelist Jail

Define the exact Bash command patterns the agent is permitted to execute, the runtime check that bounds invocations, and the abort behavior on whitelist violations.

1. **FR-2.1:** The agent prompt MUST contain a section titled "Bash Whitelist" enumerating every permitted command pattern. The agent MUST NOT invoke the `Bash` tool for any command not matching one of the enumerated patterns. Before each Bash invocation, the agent MUST internally match the candidate command string against the whitelist set. A failed match MUST trigger ABORT with the literal violation message "Authority Boundary violation: command `<exact candidate command>` does not match any whitelist pattern". The aborted item is annotated `aborted-whitelist-violation` per FR-3.6.
2. **FR-2.2:** The whitelist patterns are defined as regex anchored at start-of-string and end-of-string (`^` and `$`). The full set is:
   - **Detection patterns (read-only — used by the detect-then-install step in FR-4):**
     - `^claude mcp list$`
     - `^npm list --depth=0( --json)?$`
     - `^pnpm list --depth=0( --json)?$`
     - `^yarn list --depth=0( --json)?$`
     - `^pip list( --format=json)?$`
     - `^pip3 list( --format=json)?$`
     - `^poetry show$`
     - `^cargo metadata --format-version 1$`
     - `^cat package\.json$`
     - `^cat pyproject\.toml$`
     - `^cat Cargo\.toml$`
     - `^which [a-z0-9_-]+$` (e.g., `which playwright`)
     - `^command -v [a-z0-9_-]+$`
   - **Trivial-tier install patterns:**
     - `^claude mcp add [a-z0-9_-]+( [a-z0-9_/.@:=-]+)*$` (pinned MCP, alphanumeric/underscore/dash slug followed by zero or more whitespace-separated arguments containing only safe characters)
     - `^npx playwright install( --with-deps)?$`
     - `^npx playwright install [a-z]+( [a-z]+)*$` (e.g., `npx playwright install chromium firefox`)
   - **Moderate-tier install patterns:**
     - `^npm install --save-dev [a-z0-9@/._-]+( [a-z0-9@/._-]+)*$`
     - `^pnpm add -D [a-z0-9@/._-]+( [a-z0-9@/._-]+)*$`
     - `^yarn add --dev [a-z0-9@/._-]+( [a-z0-9@/._-]+)*$`
     - `^pip install --user [a-zA-Z0-9._-]+( [a-zA-Z0-9._-]+)*$`
     - `^pip3 install --user [a-zA-Z0-9._-]+( [a-zA-Z0-9._-]+)*$`
     - `^poetry add --group dev [a-zA-Z0-9._-]+( [a-zA-Z0-9._-]+)*$`
   The patterns MUST be the verbatim regex set above. The agent MUST NOT execute commands containing shell metacharacters (`&&`, `||`, `|`, `;`, `>`, `>>`, `<`, `<<`, backticks, `$()`, `&`) — the patterns explicitly disallow these by character-class restriction. Any candidate command containing such a metacharacter automatically fails the match check and is aborted.
3. **FR-2.3:** Forbidden command prefixes MUST be enumerated explicitly in the prompt as a deny-list, even though the whitelist's anchored regex form already excludes them by construction. The redundant deny-list is a defense-in-depth measure for prompt readability and audit. The deny-list MUST include: `rm`, `rmdir`, `mv`, `cp` (when used outside `.claude/` and project CWD — the whitelist does not include any `rm`/`mv`/`cp` patterns at all in iteration 2, so the deny-list rule is effectively "no `rm`/`mv`/`cp` ever" in iteration 2), `curl`, `wget`, `http`, `httpie`, `ssh`, `scp`, `rsync`, `sudo`, `su`, `runas`, `git push`, `git tag`, `git commit -a`, `git rebase`, `git reset --hard`, `npm publish`, `cargo publish`, `pypi upload`, `gh release create`, `docker push`, `aws configure`, `gcloud auth login`.
4. **FR-2.4:** The whitelist MUST be platform-scoped to macOS/Linux POSIX shells. Windows PowerShell command equivalents (`Set-ExecutionPolicy`, `Install-Module`, etc.) are NOT in the whitelist. The agent prompt MUST state that iteration 2 assumes a POSIX shell environment; Windows PowerShell support is deferred to a future iteration (per 7.8 item 5). On a non-POSIX environment, the agent's auto-install phase MUST abort with a clear message ("Auto-install requires POSIX shell; current environment unsupported in iteration 2") and fall back to suggest-only mode.
5. **FR-2.5:** The whitelist MUST NOT be expandable at runtime. The agent prompt MUST explicitly state that adding a new pattern requires a PRD revision and a corresponding edit to the agent prompt — the agent MUST NOT accept user-supplied "trust this command" overrides at runtime. This guards against social-engineering of the agent into running arbitrary commands.
6. **FR-2.6:** The agent MUST log every Bash invocation (intent and outcome) into the `## Auto-Install Results` section of `.claude/resources-pending.md` per FR-6. The log MUST include the exact command attempted, the matched whitelist pattern, the exit code, and the truncated stdout/stderr (first 200 chars each, with a `... [truncated]` marker if the output exceeded that). This audit trail lets the developer verify after the fact what the agent actually ran.

#### FR-3: Detection Logic

Define the detect-then-install pattern that runs before any install command and the three outcomes it produces.

1. **FR-3.1:** Before invoking ANY install command (Trivial or Moderate tier), the agent MUST execute a detection command from the FR-2.2 detection patterns to determine whether the resource is already present. The detection command MUST be deterministic and side-effect-free — it reads state without modifying anything. The agent MUST select the detection command appropriate to the resource type:
   - MCP servers → `claude mcp list`
   - npm packages → `npm list --depth=0` or `cat package.json`
   - pnpm packages → `pnpm list --depth=0` or `cat package.json`
   - yarn packages → `yarn list --depth=0` or `cat package.json`
   - pip packages → `pip list` or `pip3 list`
   - Poetry packages → `poetry show` or `cat pyproject.toml`
   - Cargo packages → `cargo metadata --format-version 1` or `cat Cargo.toml`
   - CLI binaries → `which <name>` or `command -v <name>`
2. **FR-3.2:** **Outcome 1 — Present and version-compatible.** If the detection command returns a result indicating the resource is installed AND its version (when applicable) matches the iter-1-recommended version (or no specific version was recommended), the agent MUST SKIP the install. The item is annotated `skipped-already-present` in the auto-install results, including the detected version when applicable. The agent MUST NOT prompt the user for approval for skipped items — they are not in the approval prompt block.
3. **FR-3.3:** **Outcome 2 — Present and version-conflict.** If the detection command returns a result indicating the resource is installed BUT at a version that conflicts with the iter-1 recommendation (e.g., `playwright@1.40.0` is installed but the iter-1 entry recommends `playwright@^1.45.0`), the agent MUST ABORT this item with a structured warning. The warning text MUST follow the form: "Found `<name>@<detected-version>` but iter-1 recommended `<name>@<recommended-version>`; manual reconciliation required." No auto-resolve, no auto-upgrade, no auto-downgrade — version conflicts are intentionally surfaced to the user without remediation. The item is annotated `aborted-version-conflict` and is NOT included in the approval prompt block. The bootstrap pipeline does NOT halt on version conflicts — only the specific item aborts; remaining items continue.
4. **FR-3.4:** **Outcome 3 — Absent.** If the detection command returns a result indicating the resource is NOT installed, the agent MUST proceed to the approval flow (FR-4) for Trivial/Moderate items, OR escalate via Rule 4 for Sensitive items. The item is included in the approval prompt block (Trivial/Moderate) or in the Rule-4 escalation message (Sensitive).
5. **FR-3.5:** Version-compatibility comparison MUST follow semver semantics for ecosystems that use semver (npm, pnpm, yarn, pip, poetry, cargo): the recommended version may be exact (`1.45.0`), caret (`^1.45.0`, allows minor/patch upgrades), tilde (`~1.45.0`, allows patch only), or range (`>=1.45.0 <2.0.0`). The detected version is compatible if it satisfies the recommended specifier. For non-semver resources (e.g., MCP servers without version info, CLI binaries without versions), version compatibility is treated as "any version is compatible" — only presence/absence is checked, and Outcome 2 (version-conflict) cannot occur.
6. **FR-3.6:** Detection failures (the detection command itself errors out — e.g., `npm list` fails because `npm` is not installed) MUST be treated as an INFRASTRUCTURE failure, NOT an "absent" determination. The agent MUST NOT proceed to install — it MUST annotate the item as `aborted-detection-failed` with the detection command's error, and skip to the next item. This guards against the case where detection is broken: the safer assumption is "we don't know if it's installed, so don't install" rather than "we couldn't detect it, therefore install".

#### FR-4: Approval Flow

Define the user-interaction protocol that bridges the suggestion phase and the install phase.

1. **FR-4.1:** After the iter-1 suggestion section is produced (`.claude/resources-pending.md` has its `## Recommended Resources` body per Section 4 FR-2.2) AND after the detection step (FR-3) has classified each item as `present-skip`, `version-conflict-abort`, or `absent-proceed`, the agent MUST emit a single approval-prompt block to the user via console output. The block MUST be plain markdown (not interactive UI — the orchestrator passes the user's free-form text reply back to the agent for parsing). The block MUST contain:
   - A header line "Auto-install approval required:".
   - A grouped Trivial section: one yes/no item per category (e.g., "MCP installs (3 items): yes/no", "npx playwright tooling (1 item): yes/no"). Each item MUST list the underlying commands the user is approving so the user can review before answering.
   - A flat Moderate section: one yes/no item per individual resource (e.g., "Install `playwright@^1.45.0` as dev dependency (`npm install --save-dev playwright@^1.45.0`)? yes/no", "Install `pytest` user-local (`pip install --user pytest`)? yes/no"). The exact command being approved MUST appear in the prompt.
   - A footer noting "Sensitive-tier items (if any) will be presented separately for manual action." If there are zero Sensitive items, the footer MAY be omitted.
2. **FR-4.2:** Approval items MUST be ordered: Trivial items first (grouped by category), Moderate items second (one per item). Within each section, the order MUST match the order of recommendations in the iter-1 suggestion section, so the user reviews the prompt in the same order they read the suggestions.
3. **FR-4.3:** The orchestrator (`/bootstrap-feature` Step 3.5) MUST display the approval prompt to the user and capture the user's free-form text reply. The reply is then passed back to the `resource-architect` agent for parsing. This roundtrip happens within the same Step 3.5 invocation — no new step, no new bootstrap phase. If the orchestrator cannot capture user input (e.g., running in a non-interactive context, see FR-7.4 for the headless-mode contract), the agent's auto-install phase MUST be skipped entirely and the agent MUST fall back to suggest-only mode for that invocation.
4. **FR-4.4:** Reply parsing MUST be permissive but unambiguous: the agent extracts yes/no decisions per item from the user's free-form text. Recognized affirmative tokens are `yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`. Recognized negative tokens are `no`, `n`, `decline`, `skip`, `not now`. Per-item context — which item the yes/no applies to — is determined by the user identifying the item by name, category, or item number (the prompt MUST number items from 1 for unambiguous reference). Replies that do not clearly identify an item OR that contain conflicting tokens for the same item ("yes please... actually no, skip it") are treated as NEGATIVE for safety (per design decision 7's "ambiguous response is treated as no").
5. **FR-4.5:** Bulk replies are supported: "yes to all" or "yes to everything" approves all items in the prompt. "no to all" rejects everything (the agent skips installs and emits a `## Auto-Install Results` section listing every item as `not-approved`). Mixed bulk + per-item replies are also supported: "yes to all MCP installs but no to the npm packages, except yes to playwright" — the agent parses Trivial-section approval ("yes to all MCP"), Moderate-section blanket rejection ("no to npm packages"), and a per-item override ("except yes to playwright"). The override grammar MUST be documented in the agent prompt with at least three worked examples.
6. **FR-4.6:** Items not mentioned in the user's reply MUST be treated as NEGATIVE (default-deny). This guarantees that silence implies skip — the agent never auto-applies an item the user did not explicitly approve. The auto-install results annotate such items as `not-approved`.
7. **FR-4.7:** After parsing the reply, the agent MUST execute approved items in the prompt's order (Trivial first, then Moderate). The agent MUST NOT batch-parallelize installs in iteration 2 — installs run sequentially, one command at a time, with the next command not starting until the previous one's exit code is captured. Sequential execution simplifies error handling (FR-5) and aligns with the conservative posture of iteration 2.
8. **FR-4.8:** The approval prompt MUST be embedded in console output ONLY — it MUST NOT be written to `.claude/resources-pending.md`, `.claude/plan.md`, the scratchpad, or any other file. Only the structured results (FR-6) land on disk; the conversational approval roundtrip is ephemeral.

#### FR-5: Halt Semantics

Define the failure-handling rules that bound auto-install side effects when an install command fails or a Sensitive item appears.

1. **FR-5.1:** **Trivial install failure.** If a Trivial-tier install command returns a non-zero exit code, the agent MUST annotate the item as `approved-but-failed` with the exit code and truncated stderr in the auto-install results, emit a warning to the console, and CONTINUE to the next item. Trivial failures are non-blocking — a failed `claude mcp add` does not halt the auto-install phase. The rationale: Trivial items are independent (one MCP install does not depend on another), so a single failure should not cascade.
2. **FR-5.2:** **Moderate install failure.** If a Moderate-tier install command returns a non-zero exit code, the agent MUST annotate the item as `approved-but-failed`, AND mark all REMAINING Moderate items in the same approval batch as `aborted-batch-halted`, AND surface the failure to the user. The agent MUST NOT execute any further Moderate-tier installs in this invocation. The rationale: Moderate failures often signal environment-level issues (npm registry unreachable, package manager misconfigured, disk full) that subsequent installs would also hit; halting the batch prevents cascading failures and gives the user a clean place to investigate. Already-completed Trivial-tier items are NOT rolled back — they remain installed.
3. **FR-5.3:** **Sensitive item detected.** If, during the recommendation phase or the approval phase, the agent encounters a Sensitive-tier item (per FR-1.4), it MUST escalate via Rule 4 (Section 1 FR-2.4) — the agent halts the auto-install phase, presents the Sensitive item to the user with its rationale, and explicitly states "manual action required outside the SDLC pipeline." The auto-install phase is recorded as `aborted-sensitive` for that item. The agent MUST continue processing OTHER items (non-Sensitive) — the abort is per-item, not phase-wide. If multiple Sensitive items exist, each is individually escalated. The bootstrap pipeline does NOT halt — Step 3.5 still SUCCEEDS (the suggestion is the primary deliverable), and Step 3.75 / Step 4 proceed.
4. **FR-5.4:** **Forbidden command attempted.** If the agent's logic produces a candidate command that fails the FR-2.2 whitelist match (i.e., the agent attempted to issue a Forbidden command), the agent MUST ABORT immediately, annotate the item as `aborted-whitelist-violation` with the literal violation message from FR-2.1, and HALT the entire auto-install phase. Already-completed items in this invocation are NOT rolled back. The rationale: a whitelist violation indicates a logic bug or prompt drift in the agent — continuing with subsequent items risks compounding the issue. The bootstrap pipeline DOES halt at Step 3.5 in this case (treated as a Section 4 FR-3.3 failure), because a whitelist violation suggests the agent itself is misbehaving and downstream steps cannot proceed safely.
5. **FR-5.5:** **Detection failure.** Per FR-3.6, a detection command failure aborts only the specific item (annotated `aborted-detection-failed`) and the agent continues to the next item. The auto-install phase as a whole is NOT halted on detection failures — they are treated like Trivial install failures (per-item, non-blocking).
6. **FR-5.6:** **Idempotency under partial-completion retry.** If the auto-install phase aborts mid-batch (e.g., FR-5.2 batch-halt or FR-5.4 whitelist violation) and the user re-invokes the bootstrap, the agent's detection step (FR-3) will correctly observe that already-installed items are present (annotated `skipped-already-present` on the retry), so re-invocation is safe and does not double-install. This is a natural consequence of FR-3.2 and does not require a separate FR.
7. **FR-5.7:** **No rollback in iteration 2.** When the auto-install phase aborts (any of FR-5.1 through FR-5.5), the agent MUST NOT attempt to undo previously-completed installs in the current invocation. Rollback is deferred to a future iteration (per 7.8 item 3). The agent's auto-install results section MUST list every item with its outcome so the user can manually undo if desired.

#### FR-6: Output Extension

Define the new `## Auto-Install Results` section appended to `.claude/resources-pending.md` after the install phase.

1. **FR-6.1:** After the auto-install phase completes (success, failure, or abort), the agent MUST APPEND a new top-level section `## Auto-Install Results` to `.claude/resources-pending.md`. The append MUST follow the existing iter-1 suggestion section (Section 4 FR-2.2's `## Recommended Resources` body) — the iter-1 section is preserved unchanged, and the new section is added below it in the same file. The temp file's lifecycle is otherwise unchanged from Section 4 FR-2.3 (created at Step 3.5, read and inlined by the planner at Step 5, deleted by the planner after inlining).
2. **FR-6.2:** The `## Auto-Install Results` section MUST contain a one-line summary at the top with counts of each outcome status (e.g., "Total: 7 items — 3 auto-applied, 2 approved-and-applied, 1 skipped-already-present, 1 aborted-version-conflict"), followed by per-item entries enumerating the outcome.
3. **FR-6.3:** Each per-item entry MUST include: the item's Name (from the iter-1 suggestion entry), the Tier classification (FR-1.1), the outcome status (one of the FR-6.4 enumeration values), the exact command attempted (when applicable — `skipped-already-present` items list the detection command instead), the exit code (when applicable), and a one-sentence note explaining the outcome.
4. **FR-6.4:** The outcome status enumeration MUST be EXACTLY one of these literal strings (the agent MUST NOT introduce new statuses without a PRD revision):
   - `auto-applied` — Trivial-tier item that received single-category approval and ran successfully.
   - `approved-and-applied` — Moderate-tier item that received per-item approval and ran successfully.
   - `approved-but-failed` — Trivial or Moderate item that received approval but the install command returned non-zero.
   - `skipped-already-present` — Detection found the resource installed at a compatible version (FR-3.2).
   - `aborted-version-conflict` — Detection found the resource at a conflicting version (FR-3.3).
   - `aborted-sensitive` — Item classified as Sensitive tier and escalated via Rule 4 (FR-5.3).
   - `aborted-whitelist-violation` — Candidate command failed the FR-2.2 whitelist match (FR-5.4).
   - `aborted-batch-halted` — Moderate-tier item not attempted because an earlier Moderate item in the same batch failed (FR-5.2).
   - `aborted-detection-failed` — Detection command itself errored (FR-3.6).
   - `not-approved` — User declined the item in the approval prompt (FR-4.4 / FR-4.6).
5. **FR-6.5:** When the auto-install phase had zero installable items (e.g., the recommendation list contained only Sensitive items, or the user replied "no to all", or there were no recommendations at all per Section 4 FR-1.5's "No external resources required"), the `## Auto-Install Results` section MUST contain the literal string "No installable items" as its body and MUST NOT contain a per-item enumeration. This explicit statement preserves the iter-1 distinction between "considered and none" vs. "agent did not run".
6. **FR-6.6:** The agent MUST NOT modify the iter-1 `## Recommended Resources` section content during the install phase. Even if installs succeed, fail, or skip, the recommendation entries themselves remain byte-for-byte unchanged in `.claude/resources-pending.md`. Outcome-tracking lives exclusively in the new `## Auto-Install Results` section.
7. **FR-6.7:** The planner's iter-1 inlining behavior (Section 4 FR-2.5) MUST be EXTENDED to inline BOTH `## Recommended Resources` AND `## Auto-Install Results` from `.claude/resources-pending.md` into `.claude/plan.md`. The two sections MUST be inlined in the same order they appear in the temp file — `## Recommended Resources` first, `## Auto-Install Results` second — and both MUST appear at the top of `.claude/plan.md` (before `## Additional Roles` from Section 5 FR-2.7 and before `## Prerequisites verified`). After inlining, the planner deletes the temp file (unchanged from Section 4 FR-2.5).
8. **FR-6.8:** The Plan Critic prompt in `src/claude.md` (already updated per Section 4 FR-6.7 to recognize `## Recommended Resources`) MUST be EXTENDED to also recognize `## Auto-Install Results` as a valid top-level plan section. Absence of the section is NOT a critic finding (legacy plans, plans from features where auto-install was skipped, and plans with "No installable items" do not have meaningful results); presence of the section with malformed outcome statuses (values not in the FR-6.4 enumeration) MAY be a MINOR finding.

#### FR-7: Pipeline Integration

Define the bootstrap-feature changes that wire the new approval+install phase into Step 3.5 without altering the step number or downstream steps.

1. **FR-7.1:** `src/commands/bootstrap-feature.md` Step 3.5 MUST be UPDATED to document the approval flow and install execution that follow the iter-1 suggestion phase. The Step 3.5 body, currently documenting only the iter-1 delegation to `resource-architect` and the temp-file hand-off (Section 4 FR-3.1), MUST be extended to document: (a) after the suggestion is produced, the agent emits an approval prompt block to the console; (b) the orchestrator displays the prompt and captures the user's free-form reply; (c) the orchestrator passes the reply back to the agent; (d) the agent runs the approved Trivial/Moderate installs within the FR-2.2 whitelist; (e) the agent appends `## Auto-Install Results` to `.claude/resources-pending.md`. The step number remains 3.5 — no renumbering, no new step.
2. **FR-7.2:** Step 3.5 MUST remain mandatory and non-skippable per Section 4 FR-3.2. The auto-install phase within Step 3.5 is SKIPPABLE BY USER ACTION (replying "no to all" or otherwise declining), but the step itself (suggestion phase) is still mandatory. A user who declines all auto-installs receives the iter-1-equivalent behavior — suggestions only — and that is acceptable per design decision 11.
3. **FR-7.3:** **Step 3.5 failure semantics MUST be unchanged from Section 4 FR-3.3.** The suggestion phase failing halts bootstrap (existing behavior). The new auto-install phase failures (FR-5.1 Trivial, FR-5.2 Moderate, FR-5.3 Sensitive) DO NOT halt bootstrap — they only abort the install phase or specific items, and the suggestion phase's success is sufficient for Step 3.5 to be considered SUCCEEDED. The ONLY new failure mode that DOES halt bootstrap is FR-5.4 (whitelist violation), because that indicates agent logic misbehavior and downstream steps should not proceed.
4. **FR-7.4:** **Headless mode contract.** When the orchestrator runs in a non-interactive context (e.g., the CI/CD pipeline runs `/bootstrap-feature` without a TTY, or the user explicitly passes a `--no-interactive` flag in a future iteration), the auto-install phase MUST be SKIPPED entirely and the agent MUST fall back to suggest-only mode (iter-1 behavior). The `## Auto-Install Results` section MUST contain the literal string "Skipped: non-interactive context — auto-install requires user approval" and the bootstrap MUST proceed with the suggestion-only output. Iteration 2 does NOT add a CLI flag for headless mode — it relies on the orchestrator's existing detection of interactive vs. non-interactive contexts. Adding an explicit flag is deferred (see 7.8 item 7).
5. **FR-7.5:** `src/agents/planner.md` MUST be UPDATED per FR-6.7 to inline BOTH `## Recommended Resources` AND `## Auto-Install Results` from `.claude/resources-pending.md`. The existing Section 4 FR-2.5 inlining instruction (which only mentions `## Recommended Resources`) MUST be extended to mention both sections. The Section 5 FR-2.6 inlining instruction for `## Additional Roles` from `.claude/roles-pending.md` is ORTHOGONAL and remains unchanged — `roles-pending.md` is a separate temp file maintained by `role-planner`, not by `resource-architect`.
6. **FR-7.6:** The `/develop-feature` command MUST continue to invoke `/bootstrap-feature` as a delegated subcommand with no direct change to `/develop-feature`'s own prompt (parallel to Section 4 FR-3.6 and Section 5 FR-3.7). Because `/develop-feature` delegates bootstrap work wholesale, the new approval flow within Step 3.5 is inherited automatically. No update to `src/commands/develop-feature.md` is required.

#### FR-8: Backward Compatibility (Suggest-Only Mode Preserved)

Guarantee that iteration 1 behavior remains a strict subset of iteration 2 behavior.

1. **FR-8.1:** When the user replies "no to all" (or otherwise declines every Trivial/Moderate item) in the approval prompt, the agent's runtime side effects MUST be IDENTICAL to iteration 1: `.claude/resources-pending.md` contains the `## Recommended Resources` section unchanged from Section 4, no Bash commands are executed, no project files are modified by the agent. The only iter-2 addition is the `## Auto-Install Results` section listing every item as `not-approved` (or containing the FR-6.5 literal string when there were no installable items to begin with).
2. **FR-8.2:** When the recommendation list contains only Sensitive items (e.g., a feature whose only external dependency is "configure AWS credentials"), the approval prompt MUST be omitted entirely (no Trivial/Moderate items to approve), and the agent MUST emit only the Rule 4 escalation messages for each Sensitive item. The `## Auto-Install Results` section MUST list each Sensitive item as `aborted-sensitive`. The runtime side effects beyond the suggestion section are zero — same as iteration 1.
3. **FR-8.3:** When the agent runs in a non-interactive context (FR-7.4), the iter-1 behavior is invoked verbatim — suggestion only, no approval prompt, no installs.
4. **FR-8.4:** The `Tier:` field added to recommendation entries (FR-1.1) is purely additive and does NOT alter the iter-1 six-field structure. A consumer that reads only the iter-1 fields (Category, Name, Why, Install/activate, Cost/complexity, Reversibility) MUST continue to function correctly — the `Tier:` field is an additional field, not a replacement.
5. **FR-8.5:** The summary line extension (FR-1.7 — adding tier counts to the existing total/expensive/hard counts) is APPENDIVE — the iter-1 fields appear first, the new tier counts appear after. A consumer that reads only the iter-1 prefix continues to function.
6. **FR-8.6:** Plans produced under iteration 1 (which lack the `## Auto-Install Results` section in their inlined `.claude/plan.md`) MUST continue to be valid under iteration 2 — the Plan Critic per FR-6.8 does NOT flag the absence of the section as a finding. Legacy plans render correctly with only `## Recommended Resources`.
7. **FR-8.7:** If iteration 2 ships and is later reverted (rolled back to iteration 1), the iter-2-produced `.claude/plan.md` files (which contain a `## Auto-Install Results` section) MUST continue to render under iteration 1 — the section is informational text and does not affect iter-1 logic. Forward and backward compatibility is symmetric.

#### FR-9: Registration and Documentation

Update the agency-roles "Responsibility" text and README documentation; agent count is UNCHANGED.

1. **FR-9.1:** `src/claude.md` Agency Roles table's existing `resource-architect` row (introduced by Section 4 FR-6.1) MUST have its "Responsibility" column EXTENDED to mention auto-install with approval. The current text from Section 4 ("Recommend external resources (MCP, cloud, APIs, services, libraries, hardware) at bootstrap time") MUST be updated to: "Recommend external resources at bootstrap time and auto-install Trivial/Moderate items after user approval (MCP, dev dependencies); Sensitive items escalate to user." The Role title ("Resource Manager-Architect") and Agent column (`resource-architect`) MUST remain unchanged.
2. **FR-9.2:** **Agent count is UNCHANGED.** This iteration EXTENDS the existing `resource-architect` agent — it does NOT introduce a new agent. The total global agent count stays at 17 (the value Section 6 FR-8.2 brings it to). NO references to "17 agents" / "17 specialized agents" / "17 AI agents" require updating in `src/claude.md`, `README.md`, or `install.sh`. The implementer MUST NOT mistakenly introduce 17→18 propagation work.
3. **FR-9.3:** **Gate count is UNCHANGED.** This iteration does NOT add a new `/merge-ready` gate — the auto-install phase runs at bootstrap Step 3.5, not at merge-ready. The total gate count stays at 10 (the value Section 6 FR-7.4 brings it to). NO references to "10 gates" require updating.
4. **FR-9.4:** `README.md` MUST be UPDATED in the section describing the resource-architect feature (introduced by Section 4 FR-6.4) to mention the new auto-install capability. The update MUST describe: (a) the 4-tier authority gradation (Trivial / Moderate / Sensitive / Forbidden) at a high level, (b) the approval flow (single yes/no per category for Trivial, per-item for Moderate, Rule 4 escalation for Sensitive), (c) the Bash whitelist as a defense-in-depth bound on what the agent can execute, (d) backward compatibility with iter-1 (a user replying "no to all" preserves iter-1 suggest-only behavior). The update MUST NOT introduce a new top-level feature section — it extends the existing resource-architect section.
5. **FR-9.5:** `templates/CLAUDE.md` MUST be OPTIONALLY extended with a `Resource preferences:` field (no implicit default value) for downstream projects to pin allowed/denied resource categories. The field is OPTIONAL — projects that omit it receive iter-2's default behavior (all four tiers active, whitelist as defined). The field's documented values are an informal subset notation (e.g., `Resource preferences: deny-Moderate`, `Resource preferences: deny-Sensitive`, `Resource preferences: deny-MCP-installs`). Iteration 2 does NOT consume the field at runtime — it is dead metadata for a future iteration (parallel to Section 3 FR-5.5's iter-1 dead-metadata pattern). Consumption is deferred to iteration 3 (per 7.8 item 8).
6. **FR-9.6:** The Plan Critic prompt in `src/claude.md` MUST be UPDATED per FR-6.8 to recognize `## Auto-Install Results` as a valid top-level plan section. The existing Section 4 FR-6.7 bullet for `## Recommended Resources` is preserved. The new bullet for `## Auto-Install Results` is additive — absence is not flagged; presence with malformed outcome statuses MAY be a MINOR finding.
7. **FR-9.7:** `install.sh` requires NO banner-string updates (since agent count is unchanged per FR-9.2 and gate count is unchanged per FR-9.3). The implementer MUST verify with `grep -n "17 specialized\|17 AI agents\|10 quality gates\|10 gates" install.sh README.md src/claude.md` that no inadvertent count drift was introduced — but the expected outcome is zero changes to count strings.

### 7.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files only. No runtime code (JavaScript, TypeScript, Python) is introduced. `install.sh` is NOT modified — agent count and gate count are unchanged per FR-9.2 and FR-9.3, and the existing `src/agents/*.md` glob already covers the (extended) `resource-architect.md` file.
2. **NFR-2:** All changes MUST be backward compatible with the existing pipeline. Projects using SDLC v3.x with Section 4 iteration 1 deployed MUST continue to function — a user who declines all auto-install items receives the iter-1-equivalent behavior per FR-8.1. Plans produced under iteration 1 (lacking the `## Auto-Install Results` section) MUST continue to be valid per FR-8.6.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). No migration steps beyond re-running the installer. Downstream projects do NOT need to re-run `install.sh --init-project` to benefit from iter-2 — `resource-architect` is a global agent, not a downstream-project-scoped rule.
4. **NFR-4:** The `resource-architect` agent MUST continue to use the `opus` model consistent with Section 4 NFR-4 and Section 1 NFR-4. No model change.
5. **NFR-5:** The total global agent count remains at 17 per FR-9.2. No agent-count documentation propagation work is required for this iteration.
6. **NFR-6:** The `/merge-ready` gate count remains at 10 per FR-9.3. No gate-count documentation propagation work is required for this iteration.
7. **NFR-7:** The agent MUST continue to NOT make network calls beyond the explicit Trivial-tier installs that themselves use upstream package registries (npm, PyPI, MCP server registries via `claude mcp add`, browser binaries via `npx playwright install`). The package registries used by Trivial/Moderate installs are an implicit network dependency of the install commands themselves, not direct network calls by the agent — same constraint as iter-1 (Section 4 FR-5.6) with the install commands as the explicit exception.
8. **NFR-8:** The agent's typical wall-clock runtime SHOULD be under 60 seconds per invocation when auto-installs are approved (the additional time over iter-1's 30-second target is the actual install execution time, which depends on package size and network speed). When the user declines all auto-installs (iter-1-equivalent behavior), the runtime SHOULD remain under 30 seconds per Section 4 NFR-7. Soft target — not enforced.
9. **NFR-9:** The agent is one-shot per bootstrap — no re-check in `/merge-ready`, no continuous sync, no re-run on subsequent slices (parallel to Section 4 NFR-9). If the feature's resource needs change mid-implementation, the developer may manually re-invoke the agent, but the pipeline does not do so automatically.
10. **NFR-10:** The Bash whitelist in FR-2.2 MUST be strict — runtime expansion is not permitted (per FR-2.5). New patterns require a PRD revision and a corresponding agent prompt edit. This is a deliberate constraint on agent capability growth: any new install pattern goes through documentation-and-review, not user-supplied trust.
11. **NFR-11:** The detection-then-install pattern MUST be deterministic — given the same project state and the same recommendation list, the agent MUST produce the same `## Auto-Install Results` section on every invocation. Detection results vary with project state (which is the point — re-running after an install correctly observes "already present"), but the LOGIC is deterministic.

### 7.5 Acceptance Criteria

1. **AC-1:** `src/agents/resource-architect.md` is UPDATED with a new "Install mode" capability section documenting the 4-tier authority gradation (FR-1), the Bash whitelist (FR-2 with the verbatim regex set from FR-2.2), the detection-then-install pattern (FR-3), the approval flow (FR-4), the halt semantics (FR-5), and the output extension (FR-6). The iter-1 suggest-only sections (input discovery per Section 4 FR-1.2, structured output per Section 4 FR-1.3 through FR-1.7, temp-file write per Section 4 FR-2.1 through FR-2.4, authority boundary preserved with extensions for the new auto-install scope) are preserved.
2. **AC-2:** The agent's `tools` frontmatter field is updated from `["Read", "Write", "Glob", "Grep"]` (Section 4 FR-5.7) to `["Read", "Write", "Bash", "Glob", "Grep"]` per FR-1's design decision 3 and FR-2's whitelist requirement. Verifiable via `grep -n "tools:" src/agents/resource-architect.md` and inspecting the tool list. The `Bash` tool is the only addition; no other tools are introduced or removed.
3. **AC-3:** The agent prompt's "Bash Whitelist" section enumerates every pattern from FR-2.2 verbatim (detection patterns, Trivial-tier install patterns, Moderate-tier install patterns) AND includes the explicit deny-list from FR-2.3. Each pattern is given as an anchored regex (`^...$`).
4. **AC-4:** The agent prompt's tier classification logic produces reproducible classifications per FR-1.6: given a recommendation entry, the same tier is assigned on every invocation. The prompt includes a decision table mapping each FR-1.2 / FR-1.3 / FR-1.4 / FR-1.5 example operation to its tier.
5. **AC-5:** When invoked in a project where every recommended resource is already installed at compatible versions (the entire detection step returns Outcome 1 per FR-3.2 for every item), the auto-install phase produces a `## Auto-Install Results` section with every item annotated `skipped-already-present`. No Bash install commands are executed; only detection commands run.
6. **AC-6:** When invoked in a project where one Moderate-tier install command returns a non-zero exit code, the agent: (a) annotates the failing item as `approved-but-failed`, (b) annotates all subsequent Moderate items in the same batch as `aborted-batch-halted`, (c) does NOT execute any further Moderate installs in this invocation, (d) DOES continue to execute remaining Trivial items if any are still queued (FR-5.2 specifies Moderate batch halt, not phase halt). Trivial items already completed are NOT rolled back per FR-5.7.
7. **AC-7:** When invoked in a project where the agent's logic produces a candidate command that does NOT match any FR-2.2 whitelist pattern, the agent ABORTS immediately with the literal violation message from FR-2.1 ("Authority Boundary violation: command `<cmd>` does not match any whitelist pattern"), annotates the item as `aborted-whitelist-violation`, halts the entire auto-install phase, and treats Step 3.5 as FAILED per FR-7.3. Bootstrap halts.
8. **AC-8:** When the recommendation list contains a Sensitive-tier item (e.g., AWS credentials setup), the agent does NOT include it in the approval prompt block (per FR-4.1 / FR-1.4), escalates via Rule 4 with a manual-action message, and annotates the item `aborted-sensitive` in the auto-install results. Step 3.5 SUCCEEDS — the agent continues with non-Sensitive items, and downstream bootstrap steps proceed.
9. **AC-9:** When the user replies "no to all" in the approval prompt, the agent's runtime side effects are identical to iter-1 per FR-8.1: no Bash commands are executed, no project files are modified by the agent, the `## Recommended Resources` section is preserved unchanged, and `## Auto-Install Results` lists every Trivial/Moderate item as `not-approved`.
10. **AC-10:** When the orchestrator runs in a non-interactive context (FR-7.4), the auto-install phase is skipped, the `## Auto-Install Results` section contains the literal string "Skipped: non-interactive context — auto-install requires user approval", and bootstrap proceeds with iter-1-equivalent suggestion-only output.
11. **AC-11:** `src/agents/planner.md` is updated per FR-6.7 to inline BOTH `## Recommended Resources` AND `## Auto-Install Results` from `.claude/resources-pending.md` into `.claude/plan.md` in that order. The existing Section 4 FR-2.5 instruction is extended; the Section 5 FR-2.6 instruction for `## Additional Roles` from `.claude/roles-pending.md` is preserved unchanged.
12. **AC-12:** `src/commands/bootstrap-feature.md` Step 3.5 documentation is updated per FR-7.1 to describe the approval flow and install execution that follow the iter-1 suggestion phase. The step number remains 3.5 — no renumbering. The mandatory and non-skippable nature (Section 4 FR-3.2) is preserved per FR-7.2.
13. **AC-13:** The Agency Roles table in `src/claude.md` has its existing `resource-architect` row updated per FR-9.1 — Role title and Agent column unchanged; Responsibility column extended to mention auto-install with approval. NO new row is added.
14. **AC-14:** No "17 agents" or "10 gates" count strings change anywhere in the codebase per FR-9.2 / FR-9.3 / FR-9.7. Verifiable via `grep -n "17 specialized\|17 AI agents\|10 quality gates\|10 gates" install.sh README.md src/claude.md` showing identical results before and after this section's implementation.
15. **AC-15:** `README.md` is updated per FR-9.4 in the existing resource-architect feature section to describe the auto-install capability — 4-tier gradation, approval flow, Bash whitelist, backward compatibility. NO new top-level feature section is introduced.
16. **AC-16:** `templates/CLAUDE.md` optionally adds the `Resource preferences:` placeholder field per FR-9.5, documented as iter-2 dead metadata reserved for iter-3 consumption. The field is OPTIONAL — its absence in a downstream project is not an error.
17. **AC-17:** The Plan Critic prompt in `src/claude.md` recognizes `## Auto-Install Results` as a valid top-level plan section per FR-6.8 / FR-9.6. Its absence is NOT flagged. The existing Section 4 FR-6.7 bullet for `## Recommended Resources` is preserved.
18. **AC-18:** Cross-references are valid: the agent registered in `src/claude.md` (`resource-architect`) has the corresponding `src/agents/resource-architect.md` file extended per AC-1; `src/commands/bootstrap-feature.md` Step 3.5 references the agent by its exact registered name; `src/agents/planner.md` references the exact temp-file path `.claude/resources-pending.md` and the two section names it inlines (`## Recommended Resources`, `## Auto-Install Results`); no phantom paths.
19. **AC-19:** The `## Auto-Install Results` section's outcome status enumeration MUST contain exactly the ten literal strings from FR-6.4 (`auto-applied`, `approved-and-applied`, `approved-but-failed`, `skipped-already-present`, `aborted-version-conflict`, `aborted-sensitive`, `aborted-whitelist-violation`, `aborted-batch-halted`, `aborted-detection-failed`, `not-approved`). The agent MUST NOT emit any other status string. Verifiable by inspecting agent prompt output across multiple invocations and confirming statuses are drawn from this set.
20. **AC-20:** The detect-then-install pattern is sequential and runs detection BEFORE every install per FR-3.1. Verifiable by tracing the agent's Bash invocation log in the `## Auto-Install Results` section's audit trail (FR-2.6) — for each item that is not `skipped-already-present`, the corresponding detection command appears immediately before the install command.

### 7.6 Affected Components

#### New Files

None. This iteration EXTENDS existing files only.

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/agents/resource-architect.md` | MAJOR EDIT: add "Install mode" capability section; expand `tools` frontmatter from `["Read", "Write", "Glob", "Grep"]` to `["Read", "Write", "Bash", "Glob", "Grep"]`; add 4-tier authority gradation (Trivial/Moderate/Sensitive/Forbidden) with example operations per tier; add Bash whitelist section enumerating FR-2.2 patterns verbatim and FR-2.3 deny-list; add detection-then-install pattern logic; add approval flow protocol; add halt semantics for Trivial / Moderate / Sensitive / Forbidden / detection failures; extend output contract to append `## Auto-Install Results` to `.claude/resources-pending.md`; preserve all iter-1 sections (input discovery, structured suggestion output, temp-file write, iter-1 authority boundary subset). | FR-1.1 through FR-1.7, FR-2.1 through FR-2.6, FR-3.1 through FR-3.6, FR-4.1 through FR-4.8, FR-5.1 through FR-5.7, FR-6.1 through FR-6.8 |
| `src/commands/bootstrap-feature.md` | Step 3.5 enhanced to document the approval flow and install execution after the suggestion phase: orchestrator displays approval prompt, captures user reply, passes back to agent, agent runs whitelisted installs, agent appends `## Auto-Install Results`. Step number remains 3.5; mandatory and non-skippable nature (Section 4 FR-3.2) preserved; new failure mode FR-5.4 (whitelist violation) halts bootstrap, other auto-install failures (FR-5.1 / FR-5.2 / FR-5.3) do NOT halt bootstrap. | FR-7.1, FR-7.2, FR-7.3, FR-7.4 |
| `src/agents/planner.md` | Extend the inlining instruction (currently Section 4 FR-2.5: inline `## Recommended Resources` only) to also inline `## Auto-Install Results` from the same temp file. Both sections inlined at the top of `.claude/plan.md` in that order, before `## Additional Roles` (Section 5) and before `## Prerequisites verified`. Temp-file deletion behavior unchanged. | FR-6.7, FR-7.5 |
| `src/claude.md` | Update existing `resource-architect` row in Agency Roles table — Role and Agent columns unchanged; Responsibility column extended to mention auto-install with approval per FR-9.1. Update Plan Critic prompt to recognize `## Auto-Install Results` as a valid plan section per FR-6.8 / FR-9.6. NO agent-count prose updates required (count stays 17 per FR-9.2). NO gate-count prose updates required (count stays 10 per FR-9.3). | FR-6.8, FR-9.1, FR-9.2, FR-9.3, FR-9.6 |
| `README.md` | Update existing resource-architect feature section to describe iter-2 auto-install capability — 4-tier gradation, approval flow, Bash whitelist, backward compatibility per FR-9.4. NO new top-level feature section. NO agent-count tagline/heading updates (count stays 17). NO gate-count updates (count stays 10). | FR-9.4 |
| `templates/CLAUDE.md` | OPTIONAL — add `Resource preferences:` placeholder field per FR-9.5, documented as iter-2 dead metadata reserved for iter-3 consumption. If the implementer chooses to omit this in iter-2, the field is added in iter-3 with no migration impact. The OPTIONAL nature is consistent with Section 3 FR-5.5's iter-1 `Version source:` placeholder pattern. | FR-9.5 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `install.sh` | NO banner-string updates required per FR-9.7. Agent count unchanged (FR-9.2), gate count unchanged (FR-9.3). The existing `src/agents/*.md` glob at install.sh:202 (verified per Section 5 design decision 2) already covers the extended `resource-architect.md` — no file-list changes required. |
| `src/agents/architect.md` | Architect review is bootstrap Step 3, before resource-architect's auto-install phase. No interaction. |
| `src/agents/ba-analyst.md` | Use-case authoring is bootstrap Step 2, before resource-architect. No interaction. |
| `src/agents/qa-planner.md` | QA is bootstrap Step 4, after resource-architect. QA may now assume auto-installable resources are present (when approved), but no prompt change required — the assumption already follows from Step 3.5 having run per Section 4. |
| `src/agents/prd-writer.md` | PRD authoring is bootstrap Step 2, before resource-architect. The `Changelog:` field requirement from Section 3 FR-3 applies to this section's PRD entry but does not require a prd-writer prompt change. |
| `src/agents/role-planner.md` | Role-planner is bootstrap Step 3.75, AFTER resource-architect's Step 3.5 — but role-planner reads `.claude/resources-pending.md` per Section 5 FR-1.2. Now that resource-architect appends `## Auto-Install Results` to the same temp file, role-planner MAY observe the auto-install outcomes when reading the file. This is INFORMATIONAL — role-planner's logic does not need to consume the auto-install results, and Section 5 FR-1.2 specifies role-planner reads the resource recommendations (the `## Recommended Resources` section), not the install outcomes. No role-planner prompt change required in iter-2; if a future iteration wants role-planner to consume auto-install results (e.g., to recommend roles only when their dependencies were actually installed), that is iteration 3 territory. |
| `src/agents/test-writer.md` | Test writing happens within slices, after bootstrap. No interaction with auto-install. |
| `src/agents/security-auditor.md` | Security review runs in earlier merge-ready gates and pre-slice. The Sensitive-tier escalation in FR-1.4 / FR-5.3 is orthogonal — security-auditor reviews code, not resource installs. No prompt change. |
| `src/agents/code-reviewer.md` | Code review runs in merge-ready gates. No interaction with auto-install. |
| `src/agents/build-runner.md` | Build verification runs in merge-ready gates. The auto-install phase may have installed dev dependencies that build-runner relies on (e.g., test runners), but this is a natural prerequisite-satisfaction relationship, not a coupling — build-runner's prompt does not need to know how the dependencies arrived. No change. |
| `src/agents/e2e-runner.md` | E2E tests run in merge-ready gates. Auto-installed Playwright/etc. is a natural prerequisite. No prompt change. |
| `src/agents/verifier.md` | Verification runs in merge-ready gates. No interaction. |
| `src/agents/doc-updater.md` | Documentation update runs in merge-ready gates. No interaction. |
| `src/agents/refactor-cleaner.md` | Cleanup runs in Phase 2.5. No interaction. |
| `src/agents/changelog-writer.md` | Changelog maintenance is independent of resource installs. No interaction. The SDLC repo opts out of changelog maintenance per Section 3 design decision 1, so changelog-writer self-skips for this PRD section per Section 3 FR-2.2. |
| `src/agents/release-engineer.md` | Release packaging runs at merge-ready Gate 9. No interaction with bootstrap-time auto-install. |
| `src/rules/git.md` | Git workflow rules unchanged. The Bash whitelist in FR-2.2 explicitly excludes `git push`, `git tag`, `git commit -a`, `git rebase`, `git reset --hard` (per FR-2.3 deny-list) — git operations are NOT in the auto-install scope. The existing rule that work happens on feature branches and atomic-slice commits is unchanged. |
| `src/rules/scratchpad.md` | Scratchpad format unchanged. resource-architect does NOT read or write the scratchpad (preserved from Section 4 FR-1.2). |
| `src/rules/error-recovery.md` | Error recovery rules unchanged. Sensitive-tier escalation routes through Rule 4 (Section 1 FR-2.4) — the existing rule covers this case verbatim; no rule additions required. The new auto-install failure modes (FR-5.1 Trivial, FR-5.2 Moderate batch-halt, FR-5.4 whitelist violation) are documented in this section's FR-5 and in the agent prompt; they do NOT introduce a new error-recovery rule because they are agent-internal halt semantics, not pipeline-level deviation rules. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. The new `Bash` tool addition to resource-architect's `tools` field is bounded by the FR-2.2 whitelist, not by the general tool-limitations rules (which address truncation and AST limitations). |
| `src/commands/develop-feature.md` | Delegates to /bootstrap-feature wholesale, so the iter-2 changes within Step 3.5 are inherited automatically per FR-7.6. No prompt change. |
| `src/commands/implement-slice.md` | Slice execution runs after bootstrap. The auto-install phase has completed before any slice runs. No interaction with implement-slice in iter-2. |
| `src/commands/merge-ready.md` | Merge-ready does NOT re-check auto-install state and does NOT trigger re-installs (per design decision 9 / NFR-9). Gate count unchanged (FR-9.3). No prompt change. |
| `src/commands/context-refresh.md` | Context refresh reads scratchpad. Auto-install state lives in `.claude/plan.md` (after the planner inlines it from `.claude/resources-pending.md`), not in the scratchpad. No change. |
| `templates/rules/changelog.md` | Section 3 iter-1 downstream-project rule. Independent of auto-install. No change. |

### 7.7 UI Changes, Schema Changes, Affected Endpoints

Not applicable on all three counts. The SDLC project is a collection of markdown prompt files with no UI, database, or API — same as prior sections.

### 7.8 Out of Scope for Iteration 2 (further deferred)

The following items are explicitly out of scope for iteration 2 and MUST NOT be implemented as part of this section. They are listed explicitly so the Plan Critic does not flag their absence as a gap during iteration 2 planning.

1. **Sensitive-tier auto-apply.** Cloud credentials setup, paid-service signup, secrets-store writes, and any operation classified as Sensitive per FR-1.4 are Rule-4-escalated only — the agent NEVER auto-applies them in iteration 2. Auto-applying Sensitive operations (e.g., automated AWS account creation, API key provisioning) is deferred indefinitely; the security tradeoffs of auto-applying credential operations are out of scope for this PRD line.
2. **Cross-feature install dedup tracking.** Iteration 2 does NOT track which resources were installed for which prior feature. Re-detection on each invocation handles the "already installed" case correctly per FR-3.2, but the agent does not maintain a cross-feature install ledger. If feature A installs Playwright and feature B's bootstrap runs later, feature B's detection will correctly find Playwright present (`skipped-already-present`), but the agent will not have recorded "Playwright was installed for feature A". Cross-feature dedup, recommendation history, and "do not re-recommend if already installed for prior feature X" are iteration-3 territory.
3. **Rollback of installed resources on feature abort.** If a feature is aborted (e.g., the developer cancels mid-implementation), the auto-installed dev dependencies, MCP servers, and config files remain on disk. Iteration 2 has no rollback mechanism. The developer manually uninstalls if desired (using the iter-1 reversibility info in each recommendation entry per Section 4 FR-1.4). Automated rollback is iteration-3+ territory.
4. **Tools-frontmatter runtime enforcement at Claude Code runtime.** The `tools: ["Read", "Write", "Bash", "Glob", "Grep"]` field is enforced by Claude Code's tool-permission system at agent invocation. Adding additional runtime checks (e.g., a runtime hook that intercepts Bash invocations and validates them against the FR-2.2 whitelist outside the agent prompt) is out of scope. Iteration 2 relies on (a) Claude Code's tool-permission gating to bound `Bash` access to the agent at all, and (b) the agent prompt's whitelist guard logic to bound which commands the agent issues via `Bash`. Defense-in-depth is two-layer (Claude Code tool perms + agent prompt logic), not three-layer. A third runtime layer would require Claude Code core changes, not SDLC pipeline changes.
5. **Multi-OS install command variants.** Iteration 2 assumes macOS/Linux POSIX shell environments per FR-2.4. Windows PowerShell command equivalents (`Install-Module`, `choco install`, `scoop install`) are not in the whitelist and are deferred. The iter-2 agent's auto-install phase aborts gracefully on non-POSIX environments per FR-2.4 — the suggestion phase still runs.
6. **Windows PowerShell whitelist.** A separate set of whitelist patterns for PowerShell (`^Install-Module ...`, `^choco install ...`, `^winget install ...`) is deferred. When Windows support is needed, a future iteration adds the PowerShell patterns alongside the POSIX ones, and the agent's environment-detection logic selects the right set.
7. **Install verification beyond exit code.** The agent treats an install as succeeded when the install command returns exit code zero. Verifying the installed resource is actually usable (e.g., post-install `claude mcp list` confirming the MCP appears, post-install `npm test` confirming the dev dependency works) is deferred. Exit code is the iter-2 success criterion.
8. **Resource-pinning to specific versions.** Iteration 2 relies on the user's project tooling defaults for version selection — `npm install --save-dev playwright` installs whatever version `npm` resolves (latest tagged release, project's existing semver range, etc.). Pinning the agent's recommendations to specific versions (so feature A and feature B install the SAME version of Playwright regardless of when they run) is iteration-3 territory and would require a recommendation-history mechanism (overlap with item 2).
9. **Headless-mode CLI flag.** FR-7.4 specifies that the orchestrator's existing detection of non-interactive contexts triggers fallback to suggest-only mode. Adding an explicit CLI flag (e.g., `/bootstrap-feature --no-auto-install`) for the user to manually opt out of auto-install in interactive contexts is deferred. The current iter-2 user-controlled opt-out is "reply 'no to all' in the approval prompt" per FR-8.1.
10. **Consumption of `Resource preferences:` field in `templates/CLAUDE.md`.** FR-9.5 introduces the field as iter-2 dead metadata, deliberately so iter-3 can consume it without a second migration (parallel pattern to Section 3 FR-5.5's iter-1 `Version source:` introduction). Iter-2 code MUST NOT read or interpret the field. Consumption is iter-3 work.
11. **Programmatic validation of Bash whitelist patterns.** FR-2.2 specifies the patterns as anchored regex. Iteration 2 does NOT add a meta-test that validates the patterns are well-formed regex or that they correctly exclude shell metacharacters. The patterns are reviewed at PRD-revision time and at agent-prompt-edit time; programmatic validation is deferred.
12. **Approval-prompt grammar formalization.** FR-4.4 / FR-4.5 specify the affirmative/negative tokens and bulk-reply support, but do NOT formalize the grammar with a parser specification. Iter-2 relies on agent prompt logic to interpret free-form replies; ambiguous replies default to negative per design decision 7. A formal grammar with a parser is iteration-3+ territory.

### 7.9 Risks and Dependencies

1. **Risk: Whitelist bypass via prompt injection or user-supplied trust.** A malicious or poorly-worded PRD revision could expand the FR-2.2 whitelist to include dangerous patterns (e.g., adding `^curl .*$` would allow arbitrary URL fetches). Mitigation: FR-2.5 explicitly forbids runtime expansion of the whitelist; expansion requires a PRD revision and a corresponding agent prompt edit, both subject to code review. The Plan Critic and code-reviewer should treat any change to the FR-2.2 patterns as a security-sensitive edit. Additionally, FR-2.3's redundant deny-list provides a defense-in-depth catch for obviously-dangerous patterns even if the whitelist regex were inadvertently weakened.
2. **Risk: Agent misclassifies a Sensitive operation as Trivial/Moderate.** If the agent's tier classification logic (FR-1) has a bug that places a credentials-touching operation in the Trivial or Moderate bucket, the auto-install phase would attempt to run it without the safety gate. Mitigation: FR-1.6's most-restrictive-applicable-tier default rule ensures ambiguous classifications fall into Sensitive (or higher). FR-2.2's whitelist is independent of tier classification — even if the agent mis-tiered an operation, the whitelist excludes any command pattern that touches credentials directly (no `aws`, `gcloud`, `gh auth`, etc., in the whitelist), so a mis-tiered Sensitive operation cannot actually execute. Two-layer defense.
3. **Risk: Whitelist false-positive denies a legitimate install.** A legitimate install command might fail the FR-2.2 whitelist match because of a quoting variation or argument-order edge case. Mitigation: the agent's halt semantics (FR-5.4) abort cleanly with the violation message, and the user can perform the install manually. The auto-install results section records the abort, so the user has a clear audit trail. If a recurring false-positive emerges, a PRD revision adjusts the regex (per FR-2.5).
4. **Risk: Detection step misses an installed resource and double-installs.** If the detection command for a resource is incorrect (e.g., the agent uses `npm list` for a yarn-managed project and yarn's `node_modules/` does not appear in npm's view), the agent might falsely conclude "absent" and proceed to install via npm, polluting the project's package manager state. Mitigation: FR-3.1 specifies multiple detection commands per ecosystem (npm vs. pnpm vs. yarn for JS, pip vs. poetry for Python), and the agent prompt MUST select the detection command appropriate to the project's existing tooling (inferred from `package.json` lockfile presence, `pyproject.toml` content, etc.). The agent prompt MUST document this selection logic explicitly. False detections are still possible in edge cases (mixed package managers in one project) and result in the false-install being annotated `approved-and-applied` — the user audits the results section.
5. **Risk: Approval prompt parsing misinterprets the user's reply.** Free-form text parsing per FR-4.4 / FR-4.5 may misinterpret an ambiguous reply (e.g., "yes, install playwright but skip the others"). Mitigation: FR-4.4's "ambiguous defaults to negative" rule and FR-4.6's "items not mentioned default to negative" rule both bias toward safety — silence and ambiguity result in NO install, never YES. The user can re-invoke `/bootstrap-feature` if their intent was misparsed and items they wanted installed were skipped.
6. **Risk: Network-dependent install command times out or is blocked.** Trivial/Moderate installs depend on package registries (npm, PyPI, MCP server registries). A network failure causes the install command to error (FR-5.1 Trivial: continue; FR-5.2 Moderate: batch-halt). Mitigation: the failure modes are explicitly defined; the user sees the failures in the auto-install results and can investigate network or registry issues. Iter-2 does NOT add retry logic for failed installs (the agent runs each command exactly once); retry-on-network-failure is a candidate for iteration 3.
7. **Risk: Concurrent bootstrap invocations corrupt `.claude/resources-pending.md`.** If the user runs `/bootstrap-feature` twice in parallel (different terminal tabs), both invocations might race on the temp file. Mitigation: iter-2 assumes single-pipeline-at-a-time (same implicit assumption as Sections 4, 5, 6). Multi-pipeline concurrency is not a concern for iter-2.
8. **Risk: Bash invocation succeeds but the agent's outcome reporting is stale.** If a Bash invocation completes but the agent's parsing of the exit code/stdout is buggy, the auto-install results might list `approved-and-applied` for a command that actually failed (or vice versa). Mitigation: FR-2.6 logs the exact command, exit code, and truncated stdout/stderr to the audit trail — the user can reconstruct what actually happened from the log even if the high-level outcome status is wrong. Iteration 2 does not add a separate verification step (per 7.8 item 7).
9. **Risk: User declines a Trivial install whose absence breaks downstream slices.** If a feature's QA test cases assume a Trivial-tier MCP is installed (e.g., Playwright MCP for browser E2E), and the user declines its auto-install, downstream slices may fail because the MCP is absent. Mitigation: this is a developer-responsibility tradeoff — the user explicitly chose to decline, so the consequences are theirs. The auto-install results record `not-approved`, so the failure mode is visible. The QA test cases in iter-1 already assume recommended resources exist (Section 4 FR-3.5 / Section 4.6 unchanged-files note for `qa-planner`), so this risk pre-exists iter-2; iter-2 only changes the mechanism by which the user can opt out.
10. **Risk: Step-3.5 runtime budget exceeded by long-running installs.** NFR-8 sets a soft 60-second target for invocations with auto-installs, but a slow network or a large dev-dependency tree could push individual installs to 30+ seconds each. With multiple Moderate items in a batch, the total Step 3.5 runtime could reach several minutes. Mitigation: this is acceptable for a one-shot per-feature step (the developer is interactively involved via the approval prompt anyway). The orchestrator MUST display per-item progress to the console while installs run, so the user is not staring at a silent terminal. The iter-2 agent prompt MUST document that auto-install runtime depends on package size and network conditions — there is no hard cap.
11. **Risk: Defense-in-depth holes from the `Bash` tool addition.** Section 4 FR-5.7 explicitly excluded `Bash` to mechanically prevent installs even if the prompt was ignored. Iter-2 reverses that — `Bash` IS now included. The defense-in-depth posture has shifted from "no Bash + suggest only" to "Bash + whitelist + 4-tier authority". Mitigation: the FR-2.2 whitelist is conservative (only install/detection patterns, no general-purpose shell access), the FR-2.3 deny-list redundantly excludes dangerous prefixes, the 4-tier authority gradation per FR-1 routes Sensitive operations through Rule 4 escalation, and the FR-2.5 no-runtime-expansion rule prevents social engineering. Three-layer defense (whitelist + deny-list + tier gradation), but the iter-1 mechanical "no Bash" guarantee is gone — this is the unavoidable cost of enabling auto-install. The mitigations listed are the tradeoff that makes this acceptable.
12. **Dependency: Section 4 (Resource Manager-Architect — Iteration 1).** Iter-2 EXTENDS the Section 4 agent file directly (`src/agents/resource-architect.md`). Section 4 is [IN DEVELOPMENT] concurrently. Iter-2 MUST NOT ship before Section 4 iter-1 ships — the iter-1 suggestion phase is a hard prerequisite for iter-2's approval+install phase (the approval prompt enumerates the iter-1 recommendation entries). The implementer MUST sequence iter-1 first, then iter-2. If iter-1 has not yet shipped at the time iter-2 implementation starts, iter-2 implementation MUST wait.
13. **Dependency: Section 1 FR-2 (Deviation Rules).** Sensitive-tier escalation per FR-1.4 / FR-5.3 routes through Rule 4 from Section 1. Section 1 is [SHIPPED], dependency satisfied.
14. **Dependency: Section 6 (Release Engineer).** The agent count (17) used as the no-change baseline for FR-9.2 assumes Section 6 has shipped first (Section 6 brings the count from 16 to 17). Section 6 is [IN DEVELOPMENT] concurrently. The implementer MUST sequence Section 6 before Section 7 to avoid agent-count drift. If Section 6 has not shipped at the time Section 7 implementation starts, the FR-9.2 / NFR-5 claim "count stays at 17" must be re-verified — the actual baseline might be 16, in which case Section 7's no-change-to-count claim still holds (just at a different baseline value). The implementer MUST verify with `grep -n "17 specialized\|16 specialized\|17 AI agents\|16 AI agents" install.sh README.md src/claude.md` what the current baseline is before concluding no count update is needed.
15. **Dependency: Section 5 (Role Planner).** Orthogonal — `role-planner` runs at bootstrap Step 3.75, AFTER `resource-architect`'s Step 3.5. The new auto-install phase within Step 3.5 completes before role-planner runs, so the temp file `.claude/resources-pending.md` available to role-planner per Section 5 FR-1.2 contains BOTH the iter-1 `## Recommended Resources` section AND the new `## Auto-Install Results` section. Role-planner MAY observe the auto-install outcomes when reading the file but is NOT required to consume them in iter-2 (per the Section 5 unchanged-files note above and the role-planner cross-reference in Section 7.6's unchanged-files table).
16. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT]; satisfied by the prd-writer update in Section 3 FR-3.1. If Section 3 iter-1 does not ship before Section 7, the `Changelog:` field is documentation-only — it does not affect Section 7's functional requirements.
17. **Dependency: SDLC repo opts out of changelog maintenance.** Per Section 3 design decision 1, the SDLC repo itself has no `.claude/rules/changelog.md`, so `changelog-writer` self-skips for this PRD section. Expected behavior, not a risk — parallel to Section 4 Dependency 11, Section 5 Dependency 16, Section 6 Dependency 19.
18. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — auto-install runs at bootstrap Step 3.5, before any slice or wave exists. Wave orchestration is unaffected. Listed here only to disclaim the non-relationship, parallel to Section 4 Dependency 12, Section 5 Dependency 17, Section 6 Dependency 20.

---

## 8. Role Planner — Iteration 2: Cross-Feature Reuse + Automatic Teardown

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-25
**Priority:** Medium
**Related:** Section 5 (Role Planner — Iteration 1: On-Demand Role Expansion; this section EXTENDS the same `role-planner` agent introduced there and preserves all of its iteration-1 suggest-only authorship behavior byte-for-byte as a strict subset of iteration-2 behavior), Section 7 (Resource Manager-Architect — Iteration 2: Auto-Install; this section borrows the affirmative/negative approval-token grammar pattern established there for the Stage-2 reuse prompt, but does NOT introduce any Bash whitelist — `role-planner` retains its iteration-1 tool set with no `Bash`), Section 3 (FR-3: PRD Changelog Field — this section includes the field per that contract), Section 6 (Release Engineer — `/merge-ready` Gate count of 10 is preserved; the new Step 11 Post-Merge Teardown is a STEP, NOT a gate)
**Changelog:** Pipeline now reuses on-demand specialized roles across features and removes them automatically once their last feature ships.

### 8.1 Goal

Extend the existing `role-planner` agent (introduced in Section 5) and the `/merge-ready` command (Section 6) with two capabilities that close the lifecycle loop on on-demand role files at `~/.claude/agents/ondemand-<slug>.md`. **Capability 1 — cross-feature reuse:** at bootstrap Step 3.75, `role-planner` MUST first scan the existing on-demand role files and prefer reusing one whose slug matches and whose purpose is consistent with what the current feature would otherwise newly create, appending the current feature name to a per-file `features:` frontmatter manifest array instead of regenerating the file. **Capability 2 — automatic teardown:** after a feature merges to `main`, the orchestrator removes that feature's name from the `features:` array of every on-demand role file; when the array becomes empty, the file is deleted. Teardown runs as a new Step 11 Post-Merge Teardown placed AFTER Gate 9 in `/merge-ready`. Iter-2 preserves the iter-1 authorship contract byte-for-byte (filename prefix, frontmatter shape, slug-collision rule, suggest-only Stage-3 creation behavior), adds NO new agents (count stays at 17), and adds NO new gates (count stays at 10).

### 8.2 Functional Requirements

#### FR-1: Reuse Detection (cross-feature scan, manifest schema, slug-collision rule)

Define how `role-planner` discovers existing on-demand role files at Step 3.75 and how the per-file feature manifest is shaped.

1. **FR-1.1:** At bootstrap Step 3.75, BEFORE any new prompt-file Write, the agent MUST scan `~/.claude/agents/` for files matching the glob `ondemand-*.md`. For each match, the agent MUST Read the file's YAML frontmatter and parse the `features:` field as a JSON-style array of strings. Files lacking a `features:` field are treated under the FR-7 backward-compatibility rule. If the Glob itself fails (permission denied, I/O error, etc.), the agent MUST fall back to Stage-3 create-new behavior for all recommendations and emit a warning to the audit log noting the scan failure. The recommendation set is preserved; only reuse is foreclosed for this invocation. If a per-file YAML parse fails (the file exists but its frontmatter is malformed) AND the recommendation slug coincidentally matches the malformed file's slug, the agent MUST emit the `malformed-yaml-skipped` audit-trail status from FR-8.1 — the agent skips both the existing-file mutation and the new-file Write to avoid silently overwriting a malformed user-edited file, and surfaces a manual-fix request in the audit log.
2. **FR-1.2:** The per-file feature manifest schema MUST be exactly:
   ```yaml
   ---
   name: ondemand-<slug>
   description: <one-line role description>
   tools: ["Read", "Write", ...]
   model: <opus|sonnet>
   scope: on-demand
   features: ["<project-name>:<feature-slug>", "<project-name>:<feature-slug>"]
   ---
   ```
   The `features:` field is a JSON-style array of `<project-name>:<feature-slug>` strings. The `<project-name>:` prefix is REQUIRED to disambiguate across multiple projects sharing the user's global `~/.claude/agents/` directory (e.g., `claude-code-sdlc:role-planner-reuse-teardown` is distinct from `acme-app:role-planner-reuse-teardown` even though the feature slug coincides). All other frontmatter fields (`name`, `description`, `tools`, `model`, `scope`) preserve their iter-1 shape from Section 5 FR-1.7 and FR-2.3 byte-for-byte.
3. **FR-1.3:** The `<project-name>` token in a `features:` entry MUST be derived at orchestrator runtime as `basename "$(git rev-parse --show-toplevel)"`. If the orchestrator is not in a git repository (i.e., `git rev-parse --show-toplevel` errors), the project-name MUST be the literal string `unknown-project`. The orchestrator (NOT the agent — `role-planner` has no `Bash` tool per FR-9.7 / Section 5 FR-5.7) computes the project-name string and passes it to the agent as part of the spawn context.
4. **FR-1.4:** The `<feature-slug>` token in a `features:` entry MUST be derived at orchestrator runtime as the current git branch name with the `feat/` or `fix/` prefix stripped. Examples: `feat/role-planner-reuse-teardown` → `role-planner-reuse-teardown`; `fix/onboarding-typo` → `onboarding-typo`. If the current branch is `main` (or any branch not starting with `feat/` or `fix/`), the orchestrator MUST refuse to compute a feature-slug for the reuse path — the reuse scan still runs, but ANY new `features:` array append is aborted with the error message "Cannot derive feature-slug from non-feature branch `<branch>` — reuse and teardown require a `feat/<slug>` or `fix/<slug>` branch". The teardown path's main-branch refusal is governed by FR-4.2. When the orchestrator is not in a git repository (FR-1.3's `unknown-project` case), the feature-slug derivation also fails — there is no branch from which to derive a slug. The reuse-scan still runs (read-only), but the orchestrator MUST NOT compute a `<project-name>:<feature-slug>` token, MUST NOT pass one to the agent, and the agent MUST NOT append to any `features:` array. The agent falls through to Stage 3 (create new file) for every recommendation, with a manual-slug warning emitted to the audit log. The newly-created files use a placeholder `unknown-project:<placeholder-feature-slug>` only if the orchestrator can compute a stable feature-slug from another source; otherwise the new files have an empty `features: []` array, which is documented technical debt.
5. **FR-1.5:** The agent MUST classify each scanned `ondemand-<existing-slug>.md` file against the recommendation it would otherwise newly produce, using the 3-stage matching algorithm in FR-2.1. Reuse decisions are PER-RECOMMENDATION — for a feature that recommends two roles (e.g., `mobile-dev` and `compliance-officer`), each is classified independently against the existing on-demand role pool.
6. **FR-1.6:** The slug-collision rule from Section 5 (forbidding slugs matching any of the 17 core agent names: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`) MUST be PRESERVED unchanged in iter-2. The reuse scan MUST NOT discover or interact with files at `~/.claude/agents/<core-agent>.md` because those files lack the `ondemand-` prefix and are excluded by the FR-1.1 glob. If the reuse-scan encounters a pre-existing `~/.claude/agents/ondemand-<slug>.md` file whose slug coincidentally collides with a core agent name (i.e., a buggy file from a prior version that bypassed the iter-1 prefix check or was hand-created), the agent MUST treat the file as ineligible for reuse and emit a warning to the audit log requesting manual cleanup. The agent MUST NOT mutate the colliding file's `features:` array even if the current recommendation matches by slug. The recommendation falls through to Stage 3 create-new with a corrected, non-colliding slug, OR is dropped.
7. **FR-1.7:** The filename prefix self-check from Section 5 FR-2.3 (the `ondemand-` MUST-START rule) is PRESERVED unchanged. Reuse decisions affecting an existing file MUST NOT cause the agent to write to any path under `~/.claude/agents/` that does not begin with the literal `ondemand-` prefix. Adding the current feature name to an existing file's `features:` array is an in-place mutation of an existing `ondemand-<slug>.md` file — it does NOT create a new file at a non-`ondemand-` path.
8. **FR-1.8:** The reuse scan MUST be bounded — at most all files under `~/.claude/agents/` matching `ondemand-*.md` are read. The agent MUST NOT recurse into subdirectories of `~/.claude/agents/` (the iter-1 contract from Section 5 puts ondemand prompts at the directory root, not in subdirectories). The agent MUST NOT read or modify any file outside `~/.claude/agents/ondemand-*.md` and `.claude/roles-pending.md` during reuse — same write-target restriction as Section 5 FR-2.1 and FR-5.8.

#### FR-2: Reuse Approval (3-stage matching, affirmative/negative tokens, ambiguous-default-deny)

Define the 3-stage fallback matching algorithm and the user-approval contract for ambiguous reuse decisions.

1. **FR-2.1:** For each role the agent intends to recommend, the agent MUST evaluate three stages of match against the existing on-demand pool, in this exact order, stopping at the first stage that resolves:
   - **Stage 1 — Exact slug match (automatic reuse, no prompt):** the recommended slug equals the slug of an existing `ondemand-<existing-slug>.md` file (filename match after stripping the `ondemand-` prefix and `.md` extension). The agent MUST reuse the existing file (skip Write of a new prompt body) and append the current feature's `<project-name>:<feature-slug>` to that file's `features:` array per FR-5. NO user prompt is shown.
   - **Stage 2 — Slug differs but purpose matches (user prompt, default-deny on ambiguous):** the recommended slug differs from any existing file's slug, BUT the body of an existing file is consistent with the purpose the agent would otherwise write for the new recommendation. "Consistent" means the existing file's prompt body (excluding YAML frontmatter) describes a role whose responsibility, inputs, and outputs would substantively cover the new recommendation's intended responsibility. The agent MUST present the user with the prompt described in FR-2.3 and FR-2.4. Default-deny applies to ambiguous replies per FR-2.4.
   - **Stage 3 — No match (create new — iter-1 behavior):** neither Stage 1 nor Stage 2 resolves. The agent creates a new `ondemand-<slug>.md` file with the recommendation's full body — IDENTICAL to the iter-1 Section 5 FR-1.7 / FR-2.3 authorship contract. The newly-created file's `features:` array is initialized with a single entry, the current `<project-name>:<feature-slug>`.
2. **FR-2.2:** Stage-1 reuse MUST be deterministic: given the same existing on-demand pool and the same recommendation, the agent MUST produce the same Stage-1 reuse decision on every invocation. Stage-1 has no user interaction.
3. **FR-2.3:** Stage-2 reuse MUST present the user with the prompt: `Reuse existing role 'ondemand-<existing-slug>' for current feature, or create new 'ondemand-<new-slug>'? [yes/no]`. The prompt MUST include both slugs verbatim, AND a one-line summary of the existing file's purpose (extracted from its frontmatter `description` field) so the user has enough context to decide. The orchestrator (`/bootstrap-feature` Step 3.75) displays the prompt and captures the user's free-form text reply, then passes the reply back to the `role-planner` agent for parsing — same orchestration pattern as Section 7 FR-4.3.
4. **FR-2.4:** Stage-2 reply parsing MUST mirror Section 7 FR-4.4's affirmative/negative token grammar: recognized affirmative tokens are `yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`. Recognized negative tokens are `no`, `n`, `decline`, `skip`, `not now`. Replies that do not contain any recognized token, that contain conflicting tokens for the same prompt ("yes please... actually no, skip it"), that mention a different slug than the two presented, or that are empty MUST be treated as NEGATIVE for safety — this is the **default-deny on ambiguous** rule. A NEGATIVE Stage-2 outcome MUST result in Stage-3 behavior (create a new file with the original recommended slug).
5. **FR-2.5:** Stage-2 prompts are emitted ONE AT A TIME per ambiguous recommendation — the agent MUST NOT batch multiple Stage-2 prompts into a single user-input round. Sequential prompting lets the user consider each reuse decision in isolation. The order of Stage-2 prompts MUST follow the order of recommendations in the iter-1 `## Additional Roles` body of `.claude/roles-pending.md`.
6. **FR-2.6:** When a Stage-2 prompt resolves AFFIRMATIVELY (reuse approved), the agent MUST: (a) skip the prompt-body Write for the new slug, (b) append the current feature's `<project-name>:<feature-slug>` entry to the existing file's `features:` array per FR-5, (c) update the call-plan entry in `.claude/roles-pending.md` to reference the existing slug (NOT the originally-recommended new slug) so the orchestrator's Section 5 FR-3.4 general-purpose invocation pattern targets the correct file. The `## Additional Roles` body in `.claude/roles-pending.md` MUST also reflect the slug substitution so the inlined plan section is internally consistent.
7. **FR-2.7:** When a Stage-2 prompt resolves NEGATIVELY (or ambiguously per FR-2.4), the agent proceeds with Stage 3 — create a new `ondemand-<new-slug>.md` file with the originally-recommended slug. The existing file with the differing slug remains untouched (its `features:` array is NOT modified). The user has explicitly chosen to keep the two roles separate.
8. **FR-2.8:** A single bootstrap invocation MAY produce a mix of Stage-1, Stage-2-affirmative, Stage-2-negative, and Stage-3 outcomes across multiple recommendations. Each is independent and is recorded in the `## Reuse Decisions` audit subsection of `.claude/roles-pending.md` per FR-8.1.

#### FR-3: Teardown Trigger (post-Gate-9 step, project+feature-slug derivation)

Define the new Step 11 Post-Merge Teardown placed in `/merge-ready` after Gate 9.

1. **FR-3.1:** `src/commands/merge-ready.md` MUST be UPDATED to add a new **Step 11: Post-Merge Teardown** (titled exactly "Step 11: On-Demand Role Teardown" in the body) AFTER Gate 9 (Release Packaging from Section 6 FR-7.1). Step 11 is a STEP, NOT a gate — it does NOT have PASS/FAIL semantics, does NOT contribute to the gate-pass tally, and does NOT block merge-readiness. The total `/merge-ready` gate count REMAINS 10 (the value Section 6 FR-7.4 brings it to). Step 11 runs sequentially after Gate 9 completes (regardless of whether Gate 9 reported PASS, FAIL, or SKIPPED).
2. **FR-3.2:** Step 11 MUST be invoked exactly once per `/merge-ready` cycle. Re-invocation of `/merge-ready` after Step 11 has run MUST be safe — already-removed feature entries from `features:` arrays MUST behave as no-ops on the second invocation per the idempotency requirement in NFR-2.
3. **FR-3.3:** Step 11 is invoked by the orchestrator (the `/merge-ready` command runtime), NOT by the `role-planner` agent. The orchestrator has the standard merge-ready runtime, including the `Bash` tool needed to (a) verify the feature is merged via `git merge-base --is-ancestor` (per FR-4.1), (b) compute the project-name and feature-slug per FR-3.4 / FR-3.5, and (c) delete on-demand role files when their `features:` array becomes empty per FR-3.6. The orchestrator MAY delegate the per-file frontmatter mutation to a helper subagent or perform it inline; both are acceptable. The agent file `src/agents/role-planner.md` itself is NOT invoked at Step 11 — `role-planner` is a bootstrap-only agent, not a merge-time agent.
4. **FR-3.4:** The orchestrator MUST derive the `<project-name>` token at Step 11 entry as `basename "$(git rev-parse --show-toplevel)"`, identical to FR-1.3. If not in a git repo, the literal `unknown-project` is used. The derived project-name MUST match the project-name written by `role-planner` at bootstrap Step 3.75 — both ends of the lifecycle MUST use the same derivation logic, otherwise teardown will fail to find the entries it should remove.
5. **FR-3.5:** The orchestrator MUST derive the `<feature-slug>` token at Step 11 entry as the merged branch's name with the `feat/` or `fix/` prefix stripped, identical to FR-1.4. The merged branch is identified as the head of the most recently merged pull request OR (when run locally without a PR) the branch that the developer just merged via `git merge --no-ff <branch>`. If the orchestrator cannot determine the merged branch (e.g., `/merge-ready` is invoked from `main` directly without context about which feature just merged), Step 11 MUST refuse to run per FR-4.2.
6. **FR-3.6:** For every on-demand role file at `~/.claude/agents/ondemand-*.md` whose `features:` array contains the entry `<project-name>:<feature-slug>` derived in FR-3.4 / FR-3.5, the orchestrator MUST: (a) read the file via Read, (b) parse the YAML frontmatter, (c) remove ALL matching `<project-name>:<feature-slug>` entries from the `features:` array (all-occurrence removal — if the same `<project-name>:<feature-slug>` token appears more than once due to manual editing or prior partial-failure, every matching entry is removed in a single mutation), (d) write the modified file back via Write or Edit (atomic — see FR-5). All-occurrence removal is required for NFR-2 idempotency: re-running teardown on a file that previously had duplicate entries MUST NOT leave one entry behind on the second invocation. When the resulting `features:` array is EMPTY (zero entries), the orchestrator MUST instead delete the file entirely (`rm` via Bash). The deletion is conditional on the array becoming empty — files whose `features:` array still contains other features after the removal MUST remain on disk with the modified array. When the in-memory mutation produces an empty `features:` array (transitioned from non-empty to empty as a result of removal), the orchestrator MUST `rm` the file directly. The orchestrator MUST NOT first write the empty-array version to disk before deleting. If the `rm` operation fails (permission denied, I/O error, file vanished concurrently), the file is left untouched in its prior state with the removed entry still present (because no write was attempted), and the failure is reported in the audit trail with status `failed`. Pre-existing files with `features: []` (already-empty arrays from prior partial-failure or manual editing) are NOT deletion triggers; deletion only triggers when the current invocation's removal operation transitions the array from non-empty to empty.
7. **FR-3.7:** Step 11 MUST emit a one-line summary appended to the `/merge-ready` output table per FR-8.2: `Post-Merge: On-Demand Role Teardown — <N> roles updated, <M> deleted, <K> unchanged`. The three counts MUST be exact: `N` is the count of files whose `features:` array had the matching entry removed AND remained non-empty; `M` is the count of files whose `features:` array became empty and were deleted; `K` is the count of files whose `features:` array did NOT contain the matching entry (untouched). The total scanned is `N + M + K`. If a per-file update fails (Read fails, parse fails, Write fails), the file is counted as a separate audit-trail entry and is NOT included in the N/M/K totals. The summary line MUST append a fourth count when applicable: `; <F> failed (see audit log)`. The orchestrator MUST continue scanning subsequent files after a per-file failure — one file's failure does not abort the entire scan.

#### FR-4: Teardown Safety (branch-merged verification, refuse-from-main rule)

Define the safety conditions the orchestrator MUST verify before performing any teardown action.

1. **FR-4.1:** Before any frontmatter mutation or file deletion, the orchestrator MUST verify that the `<feature-slug>` derived in FR-3.5 corresponds to a branch whose head commit IS reachable from `main` (i.e., the feature has actually been merged). The verification MUST use `git merge-base --is-ancestor <feature-branch-head> main`. If the verification fails (the branch is not yet merged), the orchestrator MUST REFUSE to perform teardown and MUST emit the error message `"Refusing teardown: branch '<feature-slug>' is not yet merged into main"`. Step 11 reports the refusal in the `/merge-ready` output table per FR-8.2 with all three counts at zero.
2. **FR-4.2:** The orchestrator MUST REFUSE to run teardown when invoked from any non-feature branch directly without an explicit feature-slug context. Specifically: if the current branch is not `feat/<slug>` or `fix/<slug>` (i.e., it is `main`, a `release/*` branch, a detached HEAD, or any other branch not matching the `feat/` or `fix/` prefix) AND no merged-PR context is available (no recent merge commit visible in `git log -1 --merges`, OR the developer has not passed a `--feature-slug=<slug>` argument in a future iteration), Step 11 MUST emit the error message `"Refusing teardown from non-feature branch '<branch>' without explicit feature-slug — pass via merged PR context or skip Step 11"` (with `<branch>` substituted with the actual current branch name, e.g., `main`, `release/2026-04`, `HEAD`) and report all three counts as zero in the FR-8.2 summary line. This is the "refuse-from-non-feature-branch" rule (symmetric with FR-1.4's bootstrap-time refusal) and exists because running teardown from any non-feature branch without context risks deleting on-demand roles that belong to in-flight feature branches. The rule is symmetric with FR-1.4: bootstrap refuses to compute a feature-slug from a non-feature branch; teardown refuses to run from a non-feature branch without explicit context.
3. **FR-4.3:** The orchestrator MUST NOT delete any file outside `~/.claude/agents/ondemand-*.md`. The deletion logic in FR-3.6 MUST glob-match the literal path pattern `~/.claude/agents/ondemand-*.md` and MUST refuse to delete anything not matching this pattern. Defense-in-depth against path-traversal or symlink attacks: the orchestrator MUST resolve the file path and verify the resolved path is under `~/.claude/agents/` before deletion.
4. **FR-4.4:** The orchestrator MUST NOT modify the `features:` arrays of files OUTSIDE `~/.claude/agents/ondemand-*.md`. Core agents at `~/.claude/agents/<core-agent>.md` (the 17 core agents from Section 6 FR-8.2) lack the `ondemand-` prefix and MUST be excluded from the FR-3.6 scan. Symmetric to FR-1.6 / FR-1.7 from the bootstrap path.
5. **FR-4.5:** Step 11 MUST NOT delete or modify any file in `~/.claude/agents/` that lacks BOTH the `ondemand-` prefix AND the `scope: on-demand` frontmatter field. The two redundant markers from Section 5 design decision 5 are PRESERVED — files passing only one marker (e.g., a hypothetical `ondemand-foo.md` whose frontmatter says `scope: core`) are TREATED AS CORE for safety and SKIPPED by teardown. The orchestrator emits a warning to the `/merge-ready` output noting the marker-mismatch file path, but does NOT mutate the file.
6. **FR-4.6:** The orchestrator MUST NOT depend on network access to perform teardown — all required information (project-name, feature-slug, merge-ancestry, frontmatter) is local. This preserves the no-network constraint shared across Section 3 NFR-7, Section 4 FR-5.6, and Section 5 FR-5.6.
7. **FR-4.7:** Step 11 MUST log every per-file decision (updated / deleted / unchanged / skipped-marker-mismatch / refused-not-merged / refused-from-main) to the `/merge-ready` output. The audit trail lets the developer verify which files were touched, which were left alone, and why.

#### FR-5: Atomic Frontmatter Mutation

Define the read-modify-write contract for the `features:` array on both the bootstrap reuse path (`role-planner` agent) and the merge-ready teardown path (orchestrator).

1. **FR-5.1:** Every `features:` array mutation — append (reuse path) or remove (teardown path) — MUST be performed as a single atomic read-modify-write transaction PER FILE. Specifically: (a) Read the entire file from disk, (b) parse the YAML frontmatter into an in-memory structure, (c) mutate the `features:` array in memory (append or remove), (d) serialize the YAML frontmatter and full file body back into a complete file content string, (e) Write the entire file in one shot, replacing its prior content.
2. **FR-5.2:** Partial in-place edits (e.g., using `Edit` to replace a single line containing a `features:` value) MUST NOT be used. The serialization in step (d) of FR-5.1 MUST regenerate the entire frontmatter block from the parsed structure to avoid edge cases where a multiline `features:` array spans multiple lines and a partial edit produces malformed YAML.
3. **FR-5.3:** When serializing the `features:` array back into YAML frontmatter, the agent (reuse path) and orchestrator (teardown path) MUST preserve the JSON-style array shape — `features: ["entry-a", "entry-b"]` on a single line if the array is short (≤80 character total line length), OR the equivalent multi-line YAML block-style with one entry per line when the array is longer. Either form is valid YAML; the agent/orchestrator selects the form based on length to avoid producing files with overly-long lines.
4. **FR-5.4:** The agent (reuse path) MUST preserve the byte-for-byte contents of the file body BELOW the closing `---` frontmatter delimiter when performing a reuse-append mutation. ONLY the frontmatter block changes — the prompt body remains identical. This is critical because the prompt body contains the role's instructions, which the agent MUST NOT rewrite during a reuse decision (a reuse decision means "this existing role's purpose is sufficient" — the agent MUST NOT silently mutate the role's behavior).
5. **FR-5.5:** The orchestrator (teardown path) MUST also preserve the byte-for-byte file body when removing an entry from `features:`. The deletion case is the exception — when the array becomes empty and the file is deleted, the body is irrelevant. For the non-deletion case (entry removed but array still non-empty), the body is preserved.
6. **FR-5.6:** Concurrent mutation of the same file from two simultaneous orchestrator invocations is OUT OF SCOPE for iter-2 — see NFR-3 (single-user single-machine assumption). The atomic read-modify-write in FR-5.1 protects against torn-write within a single process but does NOT protect against two processes racing on the same file. If two `/merge-ready` invocations run simultaneously, the developer's last-write-wins shell semantics apply, and the audit trail in FR-4.7 surfaces the disagreement.
7. **FR-5.7:** When the read-modify-write transaction fails mid-step (e.g., the Write step fails due to disk-full), the orchestrator MUST NOT leave the file in a half-modified state on disk. Because Write replaces the file atomically (the standard Claude Code Write tool semantics), the failure mode is either "file unchanged" or "file fully replaced" — not "file partially overwritten". This is a property of the Write tool, not something iter-2 implements separately.

#### FR-6: Headless Contract

Define the agent and orchestrator behavior in non-interactive contexts.

1. **FR-6.1:** When the orchestrator runs in a non-interactive context (e.g., the CI/CD pipeline runs `/bootstrap-feature` without a TTY, or `process.stdin.isTTY === false`), Stage-2 reuse prompts (FR-2.3) MUST be SKIPPED entirely and the agent MUST default to "create new" (Stage-3 behavior) for every recommendation that would otherwise trigger a Stage-2 prompt. The agent MUST NOT auto-reuse without explicit user approval — non-interactive contexts cannot grant approval, so the safe default is to create a new file. Stage-1 (exact slug match, automatic reuse) is unaffected — automatic reuse without prompting is safe in headless contexts.
2. **FR-6.2:** The `## Reuse Decisions` audit subsection (FR-8.1) MUST record headless-mode decisions explicitly. For each Stage-2 candidate that was downgraded to Stage 3 due to non-interactive context, the audit entry MUST include the literal annotation `headless-default-create` so the user can later recognize the decision and re-invoke `/bootstrap-feature` interactively if reuse was actually desired.
3. **FR-6.3:** Teardown (Step 11) MUST run UNAFFECTED in non-interactive contexts — teardown requires no user interaction and is purely deterministic given the project-name, feature-slug, and on-demand role pool. CI/CD pipelines running `/merge-ready` in non-interactive mode MUST observe the same teardown behavior as interactive runs.
4. **FR-6.4:** The orchestrator MUST detect non-interactive contexts via the standard mechanism (`process.stdin.isTTY === false` for Node-based orchestration, or the equivalent shell test `[ -t 0 ]` for shell-based orchestration). The detection logic MUST match the headless-mode detection used by Section 7 FR-7.4 — same orchestration mechanism, same trigger condition, parallel fallback behavior.

#### FR-7: Backward Compatibility (legacy files without `features:`)

Define how iter-2 treats `~/.claude/agents/ondemand-*.md` files that exist on disk from iter-1 (Section 5) but lack the new `features:` frontmatter array.

1. **FR-7.1:** A "legacy on-demand role file" is any file at `~/.claude/agents/ondemand-*.md` whose YAML frontmatter does NOT contain a `features:` field. Such files were created under Section 5 iter-1 before iter-2 introduced the manifest schema in FR-1.2.
2. **FR-7.2:** On first encounter at bootstrap Step 3.75, when the agent's reuse-scan reads a legacy file AND that file matches the current recommendation under Stage 1 or Stage 2 (post-approval), the agent MUST migrate the legacy file by creating a `features:` field initialized as a JSON-style array containing exactly one entry — the current `<project-name>:<feature-slug>`. The migration is in-place via the FR-5 atomic read-modify-write contract. Other frontmatter fields are preserved byte-for-byte. If the legacy file's existing YAML frontmatter cannot be parsed (malformed YAML — e.g., unclosed brackets, invalid indentation, mixed tabs/spaces), migration MUST fail cleanly: the agent MUST NOT attempt to write a partially-repaired frontmatter, MUST NOT create the `features:` field via string-substitution heuristics, and MUST emit the `migration-failed-malformed-yaml` audit-trail status from FR-8.1 with the file's full path so the developer can repair the YAML manually. The recommendation falls through to Stage 3 (create new file with the originally-recommended slug, but only if that slug does not collide with the malformed legacy file's slug — collision triggers `malformed-yaml-skipped` per FR-8.1 instead).
3. **FR-7.3:** Legacy files NOT matching the current recommendation under Stage 1 or Stage 2 are NOT migrated by the bootstrap path — the agent leaves them unchanged. Migration is opportunistic, not universal: a legacy file is migrated only when a current feature would actually use it. This avoids touching legacy files that may belong to abandoned past features.
4. **FR-7.4:** On first encounter at merge-ready Step 11, the orchestrator MUST treat a legacy file (no `features:` field present) as a no-op for teardown — there is no array to remove an entry from, and the legacy file's lack of provenance information means the orchestrator cannot safely conclude that any specific feature owns it. The orchestrator MUST NOT delete legacy files at Step 11. The orchestrator MAY emit an informational note in the FR-8.2 output `("Found <N> legacy on-demand role files without features: arrays — left unchanged. Future bootstrap reuse will migrate them on demand.")` to surface their existence to the developer.
5. **FR-7.5:** The migration described in FR-7.2 means a legacy file's first-ever encounter that triggers Stage-1 reuse adds the current feature to `features:` (size 1). Subsequent merge-ready Step 11 invocations for that feature can then correctly remove the entry, bringing the array to size 0, at which point deletion is allowed per FR-3.6. Without the migration, legacy files would be permanent because their `features:` array would never become empty (it never existed).
6. **FR-7.6:** Iter-2 MUST NOT include a one-shot migration script that retroactively populates `features:` arrays on every legacy file in `~/.claude/agents/`. Migration is purely opportunistic per FR-7.3. A bulk migration is OUT OF SCOPE for iter-2 — see 8.4 (Out of Scope).

#### FR-8: Output Extension (`## Reuse Decisions` and Step 11 summary)

Extend the bootstrap and merge-ready output contracts to surface iter-2 actions.

1. **FR-8.1:** The agent MUST APPEND a new `## Reuse Decisions` subsection to `.claude/roles-pending.md` immediately after the iter-1 `## Role invocation plan` subsection (Section 5 FR-2.2). The new subsection enumerates each recommended role with its reuse outcome from the following 8-status exclusive enum:
   - `stage-1-exact-slug-match` — slug matched an existing file; automatic reuse; current feature appended to `features:`.
   - `stage-2-purpose-match-approved` — slug differed but purpose matched; user approved; existing file's `features:` updated, original recommended slug discarded in favor of existing slug.
   - `stage-2-purpose-match-declined` — slug differed but purpose matched; user declined (or replied ambiguously, default-deny per FR-2.4); new file created with original recommended slug.
   - `stage-3-no-match-created` — no existing file matched; new file created (iter-1 behavior).
   - `headless-default-create` — Stage-2 candidate downgraded to Stage 3 due to non-interactive context per FR-6.1.
   - `legacy-migrated` — legacy file (no `features:` array) was matched at Stage 1 or post-Stage-2 and migrated per FR-7.2.
   - `malformed-yaml-skipped` — existing on-demand file's YAML cannot be parsed AND the recommendation slug matches an existing file (collision); agent skips mutation, skips Write of new file, surfaces manual-fix request to user.
   - `migration-failed-malformed-yaml` — legacy file's YAML cannot be parsed AND it lacks a `features:` array; migration fails (the agent cannot safely add a `features:` field to a file whose existing YAML structure is unparseable); the audit entry surfaces the malformed file path so the developer can manually repair it.
   **Precedence rule:** When both `legacy-migrated` and `stage-2-purpose-match-approved` could apply to the same recommendation (a legacy file matched at Stage 2 post-approval and was migrated), the audit log MUST emit `legacy-migrated` only — it is the more informative status and supersedes `stage-2-purpose-match-approved` for migrations. The 8-status enum stays exclusive; the precedence rule disambiguates which single status is emitted when multiple could otherwise apply. No recommendation produces more than one status entry.
   The planner MUST inline `## Reuse Decisions` into `.claude/plan.md` alongside `## Additional Roles` per Section 5 FR-2.6 — both are sections of the same temp file. The two sections MUST appear in `.claude/plan.md` in the same order they appear in the temp file (`## Additional Roles` first, then `## Role invocation plan`, then `## Reuse Decisions`).
2. **FR-8.2:** `src/commands/merge-ready.md` MUST be UPDATED to add a new row to the gate-output table representing Step 11. The row's columns MUST be: name = `Post-Merge: On-Demand Role Teardown`, status = a free-form text summary (NOT one of the gate `PASS`/`FAIL`/`SKIPPED` enum values — Step 11 is not a gate per FR-3.1), summary = the literal string `<N> roles updated, <M> deleted, <K> unchanged` with `N`, `M`, `K` substituted from FR-3.7. When teardown refuses to run per FR-4.1 or FR-4.2, the summary column instead contains the verbatim refusal message from FR-4.1 / FR-4.2 with `0 roles updated, 0 deleted, 0 unchanged`. When legacy files were observed but left unchanged per FR-7.4, the summary appends `; <L> legacy files left unchanged`.
3. **FR-8.3:** The Plan Critic prompt in `src/claude.md` (which already recognizes `## Recommended Resources`, `## Auto-Install Results`, and `## Additional Roles` per prior sections) MUST be EXTENDED to also recognize `## Reuse Decisions` as a valid top-level plan section. Absence of the section is NOT a critic finding (legacy plans, plans where every recommendation hit Stage 3, and plans with "No additional roles required" do not have meaningful reuse decisions); presence of the section with malformed outcome statuses MAY be a MINOR finding.

#### FR-9: Unchanged-Strings Invariants

Enumerate the specific strings, counts, and structural elements that iter-2 MUST NOT change.

1. **FR-9.1:** The total global agent count MUST remain at 17. NO references to "17 agents" / "17 specialized agents" / "17 specialized AI agents" / "17 AI agents" in `src/claude.md`, `README.md`, or `install.sh` require updating. The implementer MUST verify with `grep -n "17 specialized\|17 agents\|17 AI agents" install.sh README.md src/claude.md` that no inadvertent count drift was introduced.
2. **FR-9.2:** The total `/merge-ready` gate count MUST remain at 10. NO references to "10 gates" / "10 quality gates" require updating. The new Step 11 Post-Merge Teardown is a STEP, NOT a gate per FR-3.1.
3. **FR-9.3:** The bootstrap step numbers MUST remain unchanged. Step 3.75 (Section 5 FR-3.1) is preserved verbatim. The new reuse logic is an EXTENSION of Step 3.75's existing role-planner delegation, not a new step number.
4. **FR-9.4:** `install.sh` MUST NOT be modified. No banner-string updates are required (per FR-9.1 and FR-9.2). The existing `src/agents/*.md` glob from Section 5 design decision 2 already covers the (extended) `role-planner.md` file — no file-list changes required.
5. **FR-9.5:** `templates/CLAUDE.md` MUST NOT be modified. Iter-2 introduces no new template fields. The existing iter-1 fields (Section 3 FR-5.5's `Version source:` and Section 7 FR-9.5's optional `Resource preferences:`) are preserved unchanged.
6. **FR-9.6:** The `src/agents/role-planner.md` filename, the `name: role-planner` frontmatter slug, and the `role-planner` registration in the `src/claude.md` Agency Roles table MUST remain unchanged. The iter-2 changes are additive edits to the prompt body and a "Responsibility" column update per FR-9.8.
7. **FR-9.7:** The `tools` frontmatter field of `src/agents/role-planner.md` MUST remain exactly `["Read", "Write", "Glob", "Grep"]` (Section 5 FR-5.7). NO `Bash` is added — reuse mutations use Write atomically per FR-5.1, and teardown deletions are performed by the orchestrator (which has Bash via standard `/merge-ready` runtime), NOT by the agent. The defense-in-depth posture of Section 5 FR-5.7 — preventing the agent itself from executing arbitrary shell commands — is preserved byte-for-byte. NO `Edit` is added either; reuse mutations use Write (whole-file replacement) per FR-5.2.
8. **FR-9.8:** The `role-planner` row in the `src/claude.md` Agency Roles table MUST have its "Responsibility" column UPDATED to reflect iter-2 capabilities. The current iter-1 text (Section 5 FR-6.1: "Recommend additional on-demand roles (mobile-dev, compliance-officer, etc.) beyond the core 16 when a feature's domain exceeds core scope") MUST be replaced with: `"Recommend project-specific specialized roles at bootstrap Step 3.75 with cross-feature reuse; participate in post-merge teardown of unused on-demand roles."` The Role title ("Role Planner") and Agent column (`role-planner`) MUST remain unchanged. The slug `role-planner` and the agent file `src/agents/role-planner.md` are unchanged in name. The participation in teardown described in the new Responsibility text refers to the agent's iter-2 awareness of the manifest schema (so its bootstrap-time mutations are compatible with the orchestrator's teardown logic) — the AGENT ITSELF is not invoked at Step 11 per FR-3.3.
9. **FR-9.9:** The README.md banners "17 specialized AI agents" and "10 quality gates" (or the verified current wording introduced by Sections 6 and 7) MUST remain byte-unchanged. No tagline edits, no `## The 17 Agents` heading edits.
10. **FR-9.10:** Section 5's iter-1 unchanged-strings (the filename prefix `ondemand-`, the slug-collision rule against the 17 core agent names, the `scope: on-demand` frontmatter field, the `name: ondemand-<slug>` frontmatter convention, the `~/.claude/agents/` write-target restriction, and the absence of network access) are ALL PRESERVED byte-for-byte. Iter-2 extends the manifest schema additively but does NOT alter any of these iter-1 invariants.

### 8.3 Non-Functional Requirements

1. **NFR-1: Performance.** The Step 3.75 reuse-scan MUST complete in ≤ 5 seconds for an on-demand role pool of ≤ 50 files at `~/.claude/agents/ondemand-*.md`. Each file Read is small (typically <2 KB of frontmatter + body), and the scan is a flat directory glob with no recursion. The 5-second target accommodates slow filesystems (e.g., network-mounted home directories) with conservative margin. Pools larger than 50 files are uncommon in iter-2 — if a pool exceeds 100 files, the developer SHOULD manually clean up stale on-demand roles (legacy files that teardown cannot remove per FR-7.4) before continued use.
2. **NFR-2: Idempotency.** Re-running the merge-ready Step 11 teardown MUST be safe — already-removed `<project-name>:<feature-slug>` entries from `features:` arrays MUST be no-ops on the second invocation (the entry is not found, so `K` (unchanged count) increments instead of `N` (updated count)). Files already deleted on a prior run are absent from the FR-1.1 glob and are simply not scanned. Repeated invocation MUST produce IDENTICAL state on disk after the first invocation completes.
3. **NFR-3: Concurrency.** Iter-2 ASSUMES single-user single-machine semantics for `~/.claude/agents/` — there is NO file locking, NO mutex, NO retry logic for concurrent mutation. If two `/merge-ready` invocations run simultaneously and both attempt to mutate the same on-demand role file, the OS's last-write-wins behavior applies. This is consistent with the single-pipeline-at-a-time assumption of Sections 4, 5, 6, and 7. Multi-machine or multi-user concurrency is OUT OF SCOPE.
4. **NFR-4: Visibility.** Step 3.75 reuse decisions MUST be logged in the bootstrap output: each Stage-1 reuse, Stage-2 prompt and outcome, Stage-3 creation, headless-default fallback, and legacy-migration MUST be visible to the developer in the `/bootstrap-feature` console output AND recorded in the `## Reuse Decisions` audit subsection per FR-8.1. Step 11 teardown counts (N updated, M deleted, K unchanged, L legacy left) MUST be visible in the `/merge-ready` output table per FR-8.2. The developer can audit every iter-2 lifecycle decision from these two sources.
5. **NFR-5: Agent count = 17 byte-unchanged.** Per FR-9.1. Repeated for emphasis because the count invariant is a frequent regression risk in agent-count propagation work — iter-2 introduces zero new agents, so the count stays exactly at 17.
6. **NFR-6: Gate count = 10 byte-unchanged.** Per FR-9.2. Repeated for emphasis. The new Step 11 is a STEP, not a gate.
7. **NFR-7: Defense-in-depth tool allowlist preserved.** The `role-planner` agent's `tools` field remains `["Read", "Write", "Glob", "Grep"]` byte-unchanged (FR-9.7). NO `Bash`, NO `Edit`, NO `WebFetch`, NO `WebSearch`, NO `NotebookEdit`. The agent CANNOT execute shell commands, CANNOT make network calls, and CANNOT perform partial in-place edits. Teardown deletions are performed by the orchestrator (with standard merge-ready Bash access), not by the agent — same separation of authorities as Section 7's resource-architect (where the agent's Bash whitelist is internal to a single agent) versus Section 6's release-engineer (where the agent has no Bash and the developer runs git commands manually). Iter-2 follows the release-engineer pattern: agent does its work via Read/Write/Glob/Grep; the orchestrator handles deletions.

### 8.4 Out of Scope

The following items are explicitly out of scope for iter-2 and MUST NOT be implemented as part of this section. They are listed explicitly so the Plan Critic does not flag their absence as a gap during iter-2 planning.

1. **Cross-machine sync of ondemand files.** Iter-2 assumes `~/.claude/agents/` is local to a single machine. Synchronizing on-demand role files across machines (e.g., via dotfiles, git, cloud sync) is an external developer concern and is not addressed by iter-2. If a developer uses cross-machine sync, the `features:` arrays may include feature-slugs from other machines' work, and teardown's FR-4.1 merge-ancestry check will correctly refuse to remove entries for branches that are not yet merged on the current machine — which may produce false negatives (entries linger longer than expected). Cross-machine semantics are an iter-3+ concern.
2. **Role versioning or diffing.** Iter-2 does NOT track multiple versions of an on-demand role's prompt body. When a Stage-1 or Stage-2 reuse occurs, the existing role's body is reused as-is — there is no comparison of "the body that would have been written by the current feature" vs. "the body currently on disk". If the current feature would have produced a substantively different prompt body for the same slug, the user is expected to either (a) accept the existing body via reuse, or (b) decline reuse via Stage-2 and let the agent create a new file with a different slug. Diffing, version pinning, and explicit role updates are deferred.
3. **Role library or registry beyond `~/.claude/agents/`.** Iter-2 does NOT introduce a curated registry of "blessed" on-demand roles (e.g., a canonical `mobile-dev` role published by the SDLC project that all features should reuse). The on-demand role pool is purely the user's local `~/.claude/agents/ondemand-*.md`. A central registry is iter-3+ territory.
4. **Automatic role creation without user awareness.** Iter-2 does NOT silently auto-merge multiple feature recommendations into a single on-demand role without explicit reuse logic. Stage 1 (exact slug match) is automatic but is a precise match; Stage 2 (purpose match) requires user approval. There is no "fuzzy auto-merge" that would, e.g., combine a `mobile-ios-dev` recommendation with an existing `mobile-dev` file without user input.
5. **Bulk migration of legacy files.** Per FR-7.6, iter-2 does NOT include a one-shot script that retroactively populates `features:` arrays on every legacy on-demand role file. Migration is purely opportunistic per FR-7.3. A bulk-migration utility is iter-3+ territory.
6. **Teardown of on-demand role files for branches that were force-pushed or rebased.** FR-4.1's merge-ancestry check uses `git merge-base --is-ancestor` against the current `main`. If a feature branch was rebased after merge (e.g., squash-merged via GitHub UI which discards the original branch tip), the original branch head may not be reachable from `main`. Iter-2 conservatively REFUSES teardown in these cases per FR-4.1 — the developer manually removes the on-demand role files if desired. Robust handling of squash-merges, rebase-merges, and force-pushes is deferred.
7. **Concurrent multi-pipeline support.** Per NFR-3, iter-2 assumes single-user single-machine. Two `/merge-ready` invocations on the same machine racing on the same on-demand role file produces last-write-wins behavior, which may cause one invocation's mutations to be silently lost. Multi-pipeline coordination (locking, conflict detection, retry) is iter-3+ territory.
8. **Manual user editing of `features:` arrays.** Iter-2 reads and writes `features:` arrays via the FR-5 atomic read-modify-write contract, assuming the array is well-formed JSON-style YAML. If the developer manually edits a `features:` array and produces malformed YAML (e.g., unclosed bracket, misquoted string), the agent's parse step (FR-5.1 step b) MUST fail cleanly and report the malformed file in the audit trail — but iter-2 does NOT include a recovery utility that auto-repairs malformed manifests. The developer fixes the YAML manually. Programmatic validation and repair are deferred.
9. **Teardown notifications or audit reports.** Iter-2's teardown emits a one-line summary in the `/merge-ready` output table per FR-8.2. It does NOT generate a separate audit report, send notifications (Slack, email), or write a per-merge teardown ledger to disk. Audit-trail extensions are deferred.
10. **Selective reuse-skip per recommendation.** Iter-2's Stage-2 prompt is per-recommendation per FR-2.5 — the user answers each ambiguous reuse decision in turn. There is no "skip all Stage-2 prompts for this bootstrap" option. The user's only opt-out is to reply NEGATIVE to each prompt (which is already supported via FR-2.4). A blanket-skip flag is deferred.
11. **Automatic detection of role purpose drift.** When a Stage-1 reuse occurs, iter-2 does NOT verify that the existing file's body still matches the current feature's intended use of the role. The slug match is authoritative. If the role's body has drifted (e.g., the role was originally created for one feature and a later feature edited the body for a different purpose), Stage-1 reuse will silently use the drifted body. Drift detection is deferred.
12. **First-class subagent registration of on-demand roles after teardown rebuild.** Per Section 5 design decision 7 / FR-3.4, on-demand roles are invoked via the `subagent_type: general-purpose` pattern rather than as registered subagent types. Iter-2 does NOT change this — even after teardown removes a file, no session-restart is required because no registry entry was ever created. This is an inherited iter-1 invariant, not a deferred item; listed here for completeness.

### 8.5 Acceptance Criteria

1. **AC-1:** The agent file `src/agents/role-planner.md` is UPDATED with a new "Reuse mode" capability section documenting the cross-feature scan (FR-1), the 3-stage matching algorithm (FR-2.1), the affirmative/negative token grammar (FR-2.4), the atomic frontmatter mutation contract (FR-5), the headless-default-create rule (FR-6), and the legacy-file migration rule (FR-7). The iter-1 sections (input discovery per Section 5 FR-1.2, structured output per Section 5 FR-1.3 through FR-1.8, temp-file write per Section 5 FR-2.1 through FR-2.5, on-demand prompt-file write per Section 5 FR-2.3, authority boundary per Section 5 FR-5.1 through FR-5.8) are preserved. (FR-1, FR-2, FR-5, FR-6, FR-7)
2. **AC-2:** The agent's `tools` frontmatter field remains exactly `["Read", "Write", "Glob", "Grep"]` byte-unchanged from Section 5 FR-5.7. NO `Bash`, NO `Edit`, NO `WebFetch`, NO `WebSearch`, NO `NotebookEdit` appear in the field. Verifiable via `grep -n "tools:" src/agents/role-planner.md`. (FR-9.7)
3. **AC-3:** When invoked at Step 3.75 in a project where `~/.claude/agents/ondemand-mobile-dev.md` already exists with `features: ["acme-app:onboarding"]` AND the current feature recommends a `mobile-dev` role, the agent: (a) skips the Write of a new prompt body, (b) appends `claude-code-sdlc:current-feature-slug` to the existing file's `features:` array (atomic read-modify-write per FR-5.1), (c) records the decision as `stage-1-exact-slug-match` in the `## Reuse Decisions` subsection. NO new file is created. (FR-2.1 Stage 1, FR-5.1, FR-8.1)
4. **AC-4:** When invoked at Step 3.75 in a project where the current feature recommends a `mobile-frontend-dev` role AND an existing `ondemand-mobile-dev.md` file's body purpose covers the recommended scope, the agent emits the Stage-2 prompt `Reuse existing role 'ondemand-mobile-dev' for current feature, or create new 'ondemand-mobile-frontend-dev'? [yes/no]` with the existing file's `description` summary. The orchestrator captures the user's reply. If the reply contains `yes`, the agent reuses the existing file (Stage-2 affirmative path per FR-2.6). If the reply contains `no` or is ambiguous (per FR-2.4), the agent creates a new `ondemand-mobile-frontend-dev.md` file. (FR-2.1 Stage 2, FR-2.3, FR-2.4)
5. **AC-5:** When invoked in a non-interactive context (`process.stdin.isTTY === false`), Stage-2 prompts that would have been emitted are SKIPPED entirely; the agent defaults to "create new" (Stage-3 behavior) for each candidate; the `## Reuse Decisions` subsection records each affected decision as `headless-default-create`. Stage-1 (exact slug) reuse is unaffected — it runs without prompting in headless contexts. (FR-6.1, FR-6.2)
6. **AC-6:** When invoked at Step 3.75 against a legacy on-demand file lacking a `features:` frontmatter array, AND the agent matches the legacy file under Stage 1 or post-Stage-2 approval, the agent migrates the legacy file by adding a `features:` field initialized as `["<project-name>:<feature-slug>"]` (single-entry array), preserving all other frontmatter fields and the file body byte-for-byte. The decision is recorded as `legacy-migrated` in the `## Reuse Decisions` subsection. Legacy files NOT matched in the current invocation are LEFT UNCHANGED. (FR-7.2, FR-7.3)
7. **AC-7:** `src/commands/merge-ready.md` is UPDATED with a new Step 11 "On-Demand Role Teardown" placed AFTER Gate 9 in the gate sequence. The Step is documented as a STEP, not a gate — its summary in the gate-output table uses a free-form text summary instead of a `PASS`/`FAIL`/`SKIPPED` enum value per FR-8.2. The total gate count in `src/commands/merge-ready.md`, `src/claude.md`, and `README.md` REMAINS 10 — no count strings change. (FR-3.1, FR-8.2, FR-9.2)
8. **AC-8:** When `/merge-ready` Step 11 runs after a feature branch `feat/role-planner-reuse-teardown` merges to `main`, the orchestrator: (a) verifies merge-ancestry via `git merge-base --is-ancestor` (FR-4.1), (b) derives `<project-name>` as `claude-code-sdlc` and `<feature-slug>` as `role-planner-reuse-teardown` (FR-3.4, FR-3.5), (c) scans `~/.claude/agents/ondemand-*.md`, (d) for each file containing `claude-code-sdlc:role-planner-reuse-teardown` in its `features:` array, removes that entry atomically per FR-5.1, (e) deletes the file if its `features:` array became empty, (f) emits the FR-8.2 summary line with the exact counts. (FR-3.1 through FR-3.7)
9. **AC-9:** Step 11 REFUSES to run when invoked from `main` directly without merged-PR context, emitting the literal error message `"Refusing teardown from main without explicit feature-slug — pass via merged PR context or skip Step 11"` and reporting all three counts as zero in the FR-8.2 summary line. The refusal does NOT block merge-readiness — Step 11 is not a gate. (FR-4.2)
10. **AC-10:** Step 11 REFUSES to run when the `<feature-slug>` derived from a feature branch is not yet merged into `main` (e.g., `git merge-base --is-ancestor` returns non-zero), emitting the literal error message `"Refusing teardown: branch '<feature-slug>' is not yet merged into main"` and reporting all three counts as zero. (FR-4.1)
11. **AC-11:** Step 11 NEVER deletes a file outside `~/.claude/agents/ondemand-*.md`. Defense-in-depth path resolution rejects symlink/path-traversal attempts. NEVER deletes a file under `~/.claude/agents/<core-agent>.md` (lacking `ondemand-` prefix). NEVER deletes a file whose frontmatter `scope` is not `on-demand` even if the filename starts with `ondemand-` (marker-mismatch case per FR-4.5). (FR-4.3, FR-4.4, FR-4.5)
12. **AC-12:** `features:` array mutations (both reuse-append and teardown-remove) follow the FR-5.1 atomic read-modify-write contract — read entire file, parse YAML, mutate array in memory, serialize back, write entire file. NO partial in-place `Edit` operations are used. Verifiable by inspecting the agent prompt and the orchestrator's Step 11 logic for absence of `Edit` tool invocations on the manifest. (FR-5.1, FR-5.2)
13. **AC-13:** When `features:` array mutations occur, the file body BELOW the closing `---` frontmatter delimiter is preserved BYTE-FOR-BYTE. A reuse-append on an existing role does NOT silently rewrite the role's prompt instructions. Verifiable by computing a checksum of the file body before and after a reuse mutation and confirming equality. (FR-5.4, FR-5.5)
14. **AC-14:** The agent's `## Reuse Decisions` subsection in `.claude/roles-pending.md` enumerates each recommended role with one of the eight exact outcome statuses from FR-8.1: `stage-1-exact-slug-match`, `stage-2-purpose-match-approved`, `stage-2-purpose-match-declined`, `stage-3-no-match-created`, `headless-default-create`, `legacy-migrated`, `malformed-yaml-skipped`, `migration-failed-malformed-yaml`. The agent MUST NOT emit any other status string. The FR-8.1 precedence rule applies: when both `legacy-migrated` and `stage-2-purpose-match-approved` could apply to the same recommendation, only `legacy-migrated` is emitted. (FR-8.1)
15. **AC-15:** The Plan Critic prompt in `src/claude.md` recognizes `## Reuse Decisions` as a valid top-level plan section per FR-8.3. Its absence is NOT flagged. The existing recognitions for `## Recommended Resources`, `## Auto-Install Results`, and `## Additional Roles` are preserved. (FR-8.3)
16. **AC-16:** The total agent count remains at 17 byte-unchanged across `install.sh`, `README.md`, and `src/claude.md`. NO count-string updates are made. Verifiable by `grep -n "17 specialized\|17 agents\|17 AI agents" install.sh README.md src/claude.md` showing identical results before and after this section's implementation. (FR-9.1, NFR-5)
17. **AC-17:** The total `/merge-ready` gate count remains at 10 byte-unchanged. NO count-string updates to "10 gates" / "10 quality gates" are made. Verifiable by `grep -n "10 gates\|10 quality gates" install.sh README.md src/claude.md src/commands/merge-ready.md` showing identical results before and after. (FR-9.2, NFR-6)
18. **AC-18:** `install.sh` is BYTE-UNCHANGED. No banner-string updates are introduced; the existing `src/agents/*.md` glob covers the (extended) `role-planner.md` file. Verifiable by `git diff install.sh` showing zero diff hunks. (FR-9.4)
19. **AC-19:** `templates/CLAUDE.md` is BYTE-UNCHANGED. No new template fields are introduced. Verifiable by `git diff templates/CLAUDE.md` showing zero diff hunks. (FR-9.5)
20. **AC-20:** The Agency Roles table in `src/claude.md` has its existing `role-planner` row updated per FR-9.8 — Role title ("Role Planner") and Agent column (`role-planner`) UNCHANGED; Responsibility column REPLACED with the FR-9.8 verbatim text "Recommend project-specific specialized roles at bootstrap Step 3.75 with cross-feature reuse; participate in post-merge teardown of unused on-demand roles." NO new row is added; NO row is removed. (FR-9.8)
21. **AC-21:** Cross-references are valid: the agent registered in `src/claude.md` (`role-planner`) has the corresponding `src/agents/role-planner.md` file extended per AC-1; `src/commands/bootstrap-feature.md` Step 3.75 references the agent by its exact registered name; `src/commands/merge-ready.md` Step 11 documentation references the manifest schema and the orchestrator's teardown logic by exact path patterns; no phantom paths.
22. **AC-22:** The reuse-scan at Step 3.75 completes within 5 seconds for an on-demand role pool of ≤ 50 files per NFR-1. Verifiable by populating `~/.claude/agents/` with 50 dummy `ondemand-*.md` files and timing a Step 3.75 invocation.

### 8.6 Files Affected

#### New Files

None. This iteration EXTENDS existing files only.

#### Modified Files

| File | Change Type | Iter-2 Reason |
|------|-------------|---------------|
| `src/agents/role-planner.md` | extended | Add "Reuse mode" capability section: cross-feature scan (FR-1), 3-stage matching algorithm (FR-2.1), affirmative/negative token grammar (FR-2.4), atomic frontmatter mutation contract (FR-5), headless-default-create rule (FR-6), legacy-file migration rule (FR-7), `## Reuse Decisions` audit subsection emission (FR-8.1). Iter-1 sections (input discovery, structured output, temp-file write, on-demand prompt-file write, authority boundary) preserved byte-for-byte. `tools` field unchanged. (FR-1, FR-2, FR-5, FR-6, FR-7, FR-8.1, FR-9.7) |
| `src/commands/bootstrap-feature.md` | extended | Step 3.75 documentation extended to describe the Stage-2 reuse-prompt orchestration: orchestrator displays the prompt, captures user reply, passes back to agent. Project-name and feature-slug derivation per FR-1.3 / FR-1.4 documented. Headless-mode contract per FR-6.1 documented. Step number REMAINS 3.75 — no renumbering. Mandatory and non-skippable nature (Section 5 FR-3.2) preserved. (FR-1.3, FR-1.4, FR-2.3, FR-6.1) |
| `src/commands/merge-ready.md` | extended | Add new Step 11 "On-Demand Role Teardown" AFTER Gate 9 in the gate sequence. Document the orchestrator's project-name and feature-slug derivation (FR-3.4, FR-3.5), the per-file frontmatter mutation logic (FR-3.6), the conditional file-deletion rule (FR-3.6), the safety refusals from `main` (FR-4.2) and on unmerged branches (FR-4.1), the marker-mismatch skip (FR-4.5), and the FR-8.2 summary-line format. Total gate count REMAINS 10 — Step 11 is a STEP, NOT a gate. (FR-3, FR-4, FR-8.2) |
| `src/claude.md` | extended | Update existing `role-planner` row in Agency Roles table — Role title and Agent column unchanged; Responsibility column REPLACED with the FR-9.8 verbatim text. Update Plan Critic prompt to recognize `## Reuse Decisions` as a valid plan section per FR-8.3. NO agent-count prose updates required (count stays 17 per FR-9.1). NO gate-count prose updates required (count stays 10 per FR-9.2). (FR-8.3, FR-9.8) |
| `README.md` | extended | Update existing role-planner feature section to describe iter-2 cross-feature reuse and automatic teardown — 3-stage matching, default-deny ambiguous Stage-2 replies, post-merge teardown, legacy-file migration. NO new top-level feature section. NO agent-count tagline/heading updates (count stays 17 per FR-9.9). NO gate-count updates (count stays 10 per FR-9.9). (FR-9.9) |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/planner.md` | Inlines `## Additional Roles` (Section 5 FR-2.6) and `## Recommended Resources` / `## Auto-Install Results` (Section 7 FR-6.7) from temp files. `## Reuse Decisions` is a SUBSECTION of `.claude/roles-pending.md` (per FR-8.1), inlined verbatim alongside `## Additional Roles` — no format change to the planner's inlining behavior is required. The planner reads the temp file in whole and inlines its full content; new subsections are picked up automatically without prompt edits. (FR-8.1) |
| `install.sh` | NO banner-string updates (agent count unchanged per FR-9.1, gate count unchanged per FR-9.2). The existing `src/agents/*.md` glob covers the (extended) `role-planner.md`. (FR-9.4) |
| `templates/CLAUDE.md` | NO new template fields introduced. The existing iter-1 fields (Section 3's `Version source:`, Section 7's optional `Resource preferences:`) preserved unchanged. (FR-9.5) |
| `templates/rules/changelog.md` | Section 3 iter-1 downstream-project rule. Independent of role-planner reuse/teardown. No change. |
| `src/agents/architect.md` | Architect review runs at bootstrap Step 3, before Step 3.75. No interaction with reuse logic. No interaction with merge-ready Step 11. |
| `src/agents/ba-analyst.md` | Use-case authoring runs at bootstrap Step 2, before Step 3.75. No interaction. |
| `src/agents/qa-planner.md` | QA test case authoring runs at bootstrap Step 4, after Step 3.75. QA may read `## Additional Roles` from the inlined plan, but the reuse decisions are transparent to QA — Stage-1 reuse uses an existing slug, Stage-3 creation produces the same slug as the recommendation. No prompt change. |
| `src/agents/prd-writer.md` | PRD authoring runs at bootstrap Step 2, before Step 3.75. The `Changelog:` field requirement from Section 3 FR-3 applies to this section's PRD entry but does not require a prd-writer prompt change. |
| `src/agents/test-writer.md` | Test writing runs within slices, after bootstrap. No interaction with reuse logic or teardown. |
| `src/agents/security-auditor.md` | Security review runs in earlier merge-ready gates. Step 11 runs AFTER Gate 9 (after security review has completed). No interaction. |
| `src/agents/code-reviewer.md` | Code review runs in merge-ready gates before Step 11. No interaction. |
| `src/agents/build-runner.md` | Build verification runs in merge-ready gates. No interaction. |
| `src/agents/e2e-runner.md` | E2E tests run in merge-ready gates. No interaction. |
| `src/agents/verifier.md` | Verification runs in merge-ready gates. No interaction. |
| `src/agents/doc-updater.md` | Documentation update runs in merge-ready gates. `~/.claude/agents/` is not under doc-updater's purview. No interaction. |
| `src/agents/refactor-cleaner.md` | Cleanup runs in Phase 2.5. No interaction. |
| `src/agents/changelog-writer.md` | Changelog maintenance is independent of role-planner reuse/teardown. The SDLC repo opts out of changelog maintenance per Section 3 design decision 1. No change. |
| `src/agents/resource-architect.md` | Resource recommendations run at bootstrap Step 3.5, before Step 3.75. Resource-architect's iter-2 (Section 7) is orthogonal — it modifies the resource-architect agent file, not role-planner. No interaction. |
| `src/agents/release-engineer.md` | Release packaging runs at merge-ready Gate 9, BEFORE Step 11. The Gate 9 outcome (PASS/FAIL/SKIPPED) does NOT affect Step 11 behavior — Step 11 runs unconditionally regardless of Gate 9 result per FR-3.1. No interaction. |
| `src/rules/git.md` | Git workflow rules unchanged. The orchestrator's `git merge-base --is-ancestor` invocation in FR-4.1 is read-only (no commits, no pushes, no tag creation) and is consistent with the existing rule. |
| `src/rules/scratchpad.md` | Scratchpad format unchanged. role-planner does NOT read or write the scratchpad (preserved from Section 5 FR-1.2). The orchestrator at Step 11 also does NOT read or write the scratchpad. |
| `src/rules/error-recovery.md` | Error recovery rules unchanged. Stage-2 ambiguous-default-deny is agent-internal logic per FR-2.4, NOT a deviation rule. Refusals from FR-4.1 / FR-4.2 are clean step-skip behaviors with audit-trail logging, NOT failure escalations. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. The reuse-scan at FR-1.1 reads small files (frontmatter + body) and is bounded by NFR-1. |
| `src/commands/develop-feature.md` | Delegates to `/bootstrap-feature` and `/merge-ready` wholesale. The iter-2 changes within Step 3.75 (bootstrap) and Step 11 (merge-ready) are inherited automatically. No prompt change. |
| `src/commands/implement-slice.md` | Slice execution runs after bootstrap, before merge-ready. No interaction with reuse or teardown. |
| `src/commands/context-refresh.md` | Context refresh reads the scratchpad. Reuse decisions and teardown counts live in `.claude/plan.md` (after planner inlines from `.claude/roles-pending.md`) and the `/merge-ready` output table — neither is in the scratchpad. No change. |

### 8.7 Risks and Dependencies

1. **Risk: SDLC repo opts out of changelog.** Per Section 3 design decision 1, the SDLC repo itself has no `.claude/rules/changelog.md`, so `changelog-writer` self-skips for this PRD section per Section 3 FR-2.2. This is the expected behavior — the `Changelog:` field on this section is captured for authoring consistency but does not flow into any `CHANGELOG.md` for the SDLC repo's own development. Parallel to Section 4 Dependency 11, Section 5 Dependency 16, Section 6 Dependency 19, Section 7 Dependency 17. Listed here for completeness; not a runtime risk.
2. **Risk: Cross-project shared `~/.claude/agents/` namespace.** Two unrelated projects on the same machine sharing `~/.claude/agents/` may both generate an `ondemand-mobile-dev.md` file — but with different intended purposes. Mitigation: the `<project-name>:<feature-slug>` prefix in the `features:` array (FR-1.2 / FR-1.3) disambiguates ownership. Project A's teardown of its `mobile-dev` role removes only `project-a:<slug>` entries from the shared file; project B's `project-b:<slug>` entry remains, and the file is not deleted until ALL projects have torn it down. Stage-1 slug-match reuse in project B picks up project A's `mobile-dev` body — IF the body's purpose is consistent across projects (which is likely for a generic role like `mobile-dev`), this is a feature, not a bug. If the bodies should differ, the user declines Stage-2 reuse and creates a project-specific slug.
3. **Risk: Legacy file migration (Section 5 iter-1 files lacking `features:`).** Files created under iter-1 lack the `features:` array. Mitigation: FR-7.2 migrates legacy files opportunistically when they match a current recommendation. Legacy files NOT matched are left untouched per FR-7.4 — they accumulate as silent technical debt until the developer manually removes them. Risk: legacy files may persist indefinitely if no future feature triggers their slug. Acceptable iter-2 tradeoff; bulk migration is 8.4 item 5 (out of scope).
4. **Risk: Teardown executed before all merge work complete.** A developer might run `/merge-ready` Step 11 with a not-yet-merged feature branch (running locally before pushing). Mitigation: FR-4.1 verifies merge-ancestry via `git merge-base --is-ancestor` and refuses teardown if the branch is not yet merged. False negatives (teardown declines when the branch is "morally merged" but the local main hasn't been pulled yet) are possible — the developer simply re-runs `/merge-ready` after `git pull` updates `main`. Idempotency per NFR-2 ensures the re-run is safe.
5. **Risk: Stage-2 reuse false positives (purpose match unreliable).** The "purpose matches" check in Stage-2 (FR-2.1) compares the existing file's body against the agent's intended new role purpose. This is an LLM-judged similarity check, not a deterministic algorithm — it may produce false positives (agent thinks two roles are similar when they are not) or false negatives (agent misses a legitimate reuse opportunity). Mitigation: every Stage-2 candidate is presented to the user via the FR-2.3 prompt — the user is the final arbiter, and ambiguous replies default-deny (create new) per FR-2.4. False positives result in a user-facing prompt the user can decline; false negatives result in extra `ondemand-*.md` files the user can manually clean up.
6. **Risk: Concurrent feature work on same machine (two branches simultaneously).** A developer working on two feature branches in parallel (separate worktrees) may run two bootstrap or merge-ready cycles simultaneously, racing on the shared `~/.claude/agents/ondemand-*.md` namespace. Mitigation: NFR-3 explicitly assumes single-pipeline-at-a-time. The OS's last-write-wins file semantics protect against torn writes within a single transaction (FR-5.1 atomic Write); the audit trail in FR-4.7 / FR-8.1 surfaces inconsistencies if two cycles produce conflicting decisions. Multi-pipeline coordination is 8.4 item 7 (out of scope).
7. **Risk: Manual user editing of `features:` array breaking teardown.** A developer might hand-edit a `features:` array to reorganize entries, fix typos, or experiment — and produce malformed YAML that breaks the FR-5.1 parse step. Mitigation: the FR-5 atomic read-modify-write contract fails cleanly on parse errors, surfacing the malformed file in the audit trail; iter-2 does NOT auto-repair (8.4 item 8 explicitly defers programmatic validation). The developer fixes the YAML manually. Worst case: the entry is not removed from the malformed file and the developer manually deletes the file or fixes the manifest.
8. **Risk: Squash-merge or rebase-merge breaks merge-ancestry check.** GitHub's "Squash and merge" and "Rebase and merge" produce a new commit on `main` whose tree matches the feature branch but whose parent does NOT include the feature branch's tip. `git merge-base --is-ancestor <feature-tip> main` returns non-zero in these cases, and FR-4.1 refuses teardown. Mitigation: the conservative refusal is the safe behavior (the alternative — silently deleting on-demand roles for branches the orchestrator can't trace — is worse). The developer manually removes the on-demand role files after a squash/rebase merge. Robust handling is 8.4 item 6 (out of scope for iter-2).
9. **Risk: Step-11 step-not-gate confusion.** The new "Step 11" is NOT a gate — it does not have PASS/FAIL semantics. Mitigation: FR-3.1 explicitly states this; FR-8.2 specifies the gate-output table row uses a free-form text summary instead of a PASS/FAIL/SKIPPED enum value. The Plan Critic and code-reviewer should treat any change that promotes Step 11 to a gate as a regression — gate count must remain 10 per FR-9.2 / NFR-6.
10. **Risk: Agent-count drift confusion (count stays at 17).** Iter-2 INTRODUCES NO NEW AGENTS — the count remains 17 from Section 6. Mitigation: FR-9.1 / NFR-5 / AC-16 are repeatedly emphasized. The implementer MUST verify with `grep -n "17 specialized\|17 AI agents" install.sh README.md src/claude.md` that no inadvertent count-string changes were introduced. Same diligence pattern applied in Section 7 FR-9.7 for the "no count change" iteration.
11. **Risk: Reuse-scan runtime regression on large pools.** NFR-1 sets a 5-second target for ≤ 50 files. If the on-demand role pool grows beyond 50 (e.g., a developer accumulates many legacy files that teardown cannot remove), the scan slows linearly with file count. Mitigation: the developer manually cleans up. If scan time becomes consistently problematic, an iter-3 capability could add a manifest-cache (e.g., a single `~/.claude/agents/.ondemand-manifest.json` aggregating all `features:` arrays) — but this is iter-3 territory, not iter-2.
12. **Risk: Slug-collision regression (existing core agents at 17 names).** The slug-collision rule from Section 5 forbids on-demand slugs matching any of the 17 core agent names. Mitigation: FR-1.6 explicitly preserves the rule with the full enumeration. The reuse scan filters by `ondemand-` prefix (FR-1.1), so files at `~/.claude/agents/<core-agent>.md` (without the prefix) are not even visible to the scan. Two redundant guards.
13. **Dependency: Section 5 (Role Planner — Iteration 1).** Iter-2 EXTENDS the Section 5 agent file directly (`src/agents/role-planner.md`). Section 5 is [IN DEVELOPMENT] concurrently. Iter-2 MUST NOT ship before Section 5 iter-1 ships — the iter-1 agent prompt and authorship contract are hard prerequisites for iter-2's reuse and teardown extensions. The implementer MUST sequence iter-1 first, then iter-2. If iter-1 has not yet shipped at the time iter-2 implementation starts, iter-2 implementation MUST wait. Required dependency.
14. **Dependency: Section 6 (Release Engineer).** The agent count (17) used as the no-change baseline for FR-9.1 assumes Section 6 has shipped first (Section 6 brings the count from 16 to 17). The gate count (10) used as the no-change baseline for FR-9.2 also assumes Section 6 has shipped first (Section 6 brings the count from 9 to 10). Section 6 is [IN DEVELOPMENT] concurrently. The implementer MUST sequence Section 6 before Section 8 to avoid count drift. If Section 6 has not shipped at the time Section 8 implementation starts, the FR-9.1 / FR-9.2 / NFR-5 / NFR-6 claims must be re-verified against the actual baseline values (16 agents, 9 gates) — Section 8's no-change-to-count claims still hold (just at different baseline values), but the implementer MUST verify via `grep` before concluding no count update is needed.
15. **Dependency: Section 7 (Resource Manager-Architect — Iteration 2).** Section 7 establishes the affirmative/negative token grammar pattern (Section 7 FR-4.4) that iter-2 reuses for Stage-2 reuse approval (FR-2.4). Section 7 is [IN DEVELOPMENT] concurrently. The pattern is reference-only — Section 8's FR-2.4 enumerates the tokens verbatim and does not functionally depend on Section 7 shipping first. If Section 7 has not shipped, Section 8 still defines the token set independently. Soft dependency.
16. **Dependency: Section 1 FR-3 (Executable Plan Format).** The `## Reuse Decisions` subsection (FR-8.1) is inlined into `.claude/plan.md` alongside the planner's slices produced under Section 1 FR-3. Section 1 is [SHIPPED], dependency satisfied.
17. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT] concurrently; satisfied by the prd-writer update in Section 3 FR-3.1. If Section 3 iter-1 does not ship before Section 8, the `Changelog:` field is documentation-only — it does not affect Section 8's functional requirements.
18. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — reuse runs at bootstrap Step 3.75, before any slice or wave exists; teardown runs at merge-ready Step 11, after all waves have completed. Wave orchestration is unaffected. Listed here only to disclaim the non-relationship, parallel to Section 4 Dependency 12, Section 5 Dependency 17, Section 6 Dependency 20, Section 7 Dependency 18.

---

## 9. Cognitive Self-Check Protocol — Fact/Assumption Discipline for Thinking Agents

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-25
**Priority:** High
**Related:** Section 1 (FR-1: Goal-Backward Verification — verifier already addresses runtime wiring; this section addresses upstream cognitive errors during artifact authoring), Section 1 (FR-4: Scope Reduction Detection — same Plan Critic surface gains two new Completeness checks), Section 3 (FR-3: PRD Changelog Field — this section includes the field per that contract), Section 6 (Release Engineer — total agent count remains 17; this section introduces NO new agents), Section 8 (Role Planner — Iteration 2 — total `/merge-ready` gate count remains 10; this section introduces NO new gates and does NOT modify `install.sh` or `templates/rules/`)

Changelog: skip — internal

### 9.1 Description

Introduce a shared cognitive self-check protocol that all "thinking" SDLC agents MUST follow when authoring artifacts. The protocol distinguishes facts from assumptions, mandates a `## Facts` section in agent output documents (PRD entries, use-case docs, plan files, architecture reviews, security audits, code reviews, verifier reports, refactor reports, resource recommendations, role recommendations, release notes), and specifically guards against the most common Claude failure mode: hallucinating external-contract details (API field names, status enums, SDK methods, response schemas, library exports) based on memory of *similar* APIs rather than verification against the actual contract in the current session.

The protocol ships as a new global rule file `src/rules/cognitive-self-check.md` distributed via the existing `src/rules/*` copy logic in `install.sh` (no installer change required). Twelve "thinking" agents (the agents whose primary work is producing analysis, plans, reviews, or recommendations) gain a `## Cognitive Self-Check (MANDATORY)` section in their prompt files referencing the rule and specifying where the `## Facts` block goes in their output. Five "executor" agents whose work is mechanical (running tests, running builds, running E2E, mechanical doc updates, mechanical changelog mapping) are EXEMPT — their output is dictated by tool exit codes, log scraping, or 1:1 mechanical mapping rather than by independent reasoning, so a `## Facts` section would be ceremony without value.

The Plan Critic in `src/claude.md` gains TWO new Completeness checks that mechanically enforce the protocol on file-based artifacts (PRD sections, use-case files, plan files). Stdout-only artifacts (architecture review, security audit, code review, verifier report, refactor report) are enforced by each emitting agent's own prompt — the Plan Critic does not see those, so the enforcement split between "file-based artifacts (Plan Critic enforces mechanically)" and "stdout-only artifacts (each agent enforces in its own prompt)" is explicit and documented per FR-4.

**Why:** Claude's most expensive failure mode is not stub code or wiring gaps (verifier already catches those per Section 1 FR-1) — it is silently producing artifacts whose claims are based on memory of *similar* systems rather than verification against the actual current state. Examples observed in practice: PRD sections citing API field names that do not exist in the actual SDK, plan slices referencing function signatures from an older library version, architecture reviews approving a pattern that the project's existing code does not actually use, security audits assuming a framework's default that the project has overridden. The cognitive failure is not detected by typecheck (the artifact is markdown, not code), not detected by the verifier (the artifact has not yet been implemented), and not detected by code review (code review reads the produced code, not the upstream artifact's reasoning). The fix is to require every thinking agent to surface its sources, mark its assumptions, and cite external contracts before writing — and to give the Plan Critic a mechanical check that fails the artifact when sources are missing.

**Design decisions:**
1. The rule ships as a single file `src/rules/cognitive-self-check.md` and is distributed by the existing `src/rules/*` copy in `install.sh` — no installer changes required, no new installer code paths, no new install-time questions.
2. The rule is GLOBAL (not feature-scoped, not project-scoped, not downstream-only) — it lives under `src/rules/` rather than `templates/rules/` because it applies to the SDLC repo's own internal authoring AND to every downstream project's authoring. Contrast with Section 3's `templates/rules/changelog.md` which is downstream-only.
3. The 4-question protocol is given in BOTH Russian and English ("На чём основано / What is this claim based on?" etc.) because the original failure-mode insight was articulated bilingually and translation loss in either direction would weaken the prompt's force on the agent. Both languages are preserved verbatim in the rule file.
4. Twelve agents are "thinking" agents in scope: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`. Note the count of 12 is the in-scope set, NOT a new agent introduction — the total agent count REMAINS 17.
5. Five agents are "executor" agents and are EXEMPT: `test-writer` (writes tests; correctness verified by running them), `build-runner` (runs build/typecheck/test commands; output is tool-determined), `e2e-runner` (runs Playwright/E2E suites; output is tool-determined), `doc-updater` (mechanical doc edits driven by code changes; correctness verified by reading the diff), `changelog-writer` (mechanical Keep-a-Changelog mapping from PRD `Changelog:` fields and git log; upstream artifacts already carry `## Facts`).
6. The `## Facts` block has FOUR fixed subsections: `### Verified facts` (claims actually checked in the current session), `### External contracts` (API/SDK/library identifiers cited with their verification source), `### Assumptions` (claims NOT yet verified, surfaced explicitly so a reviewer can challenge them), `### Open questions` (decisions that need user input). Empty subsections use the literal placeholder `(none)` so the absence of an `(none)` marker indicates a missing subsection, not an empty one.
7. Plan Critic enforcement is FILE-BASED ONLY. The critic reads PRD sections in `docs/PRD.md`, use-case files at `docs/use-cases/<feature>_use_cases.md`, and plan files at `.claude/plan.md` (or wherever the planner writes). Stdout-only artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are each enforced by their own prompt file's `## Cognitive Self-Check (MANDATORY)` section — the agent emits the `## Facts` block in its stdout output as part of its required structure. The split is explicit (FR-4) so neither the implementer nor a future maintainer is surprised by what the Plan Critic does and does not catch.
8. The rule applies to artifacts produced AFTER this feature merges. Pre-existing PRD sections, use-case files, and plan files are EXEMPT from retroactive enforcement — backward compatibility per FR-7. Plan Critic only flags missing `## Facts` on PRD sections whose `Date:` field is on or after this section's merge date.
9. Cognitive load mitigation: the rule explicitly states "list only facts that load-bear on the decision being made — not every file the agent read". Without this guidance, agents would dump every file path they touched into `### Verified facts`, producing noise that obscures the load-bearing claims.
10. External-contract identifier detection is HEURISTIC and low-recall by design — the Plan Critic uses pattern matching for capitalized identifiers, dotted method names, and quoted enum strings to catch obvious cases. The agent's own prompt is the PRIMARY defense; the Plan Critic is the BACKSTOP. This split avoids brittle parsing of natural-language artifacts.
11. Total agent count REMAINS 17 — this feature introduces NO new agents. Total `/merge-ready` gate count REMAINS 10 — this feature introduces NO new gates. `install.sh` is BYTE-UNCHANGED — the rule auto-distributes via the existing `src/rules/*` copy logic. `templates/rules/` is BYTE-UNCHANGED — the rule is global, not downstream-only.
12. Version bump is minor: v3.1.0 → v3.2.0. The feature is purely additive (new rule, additive prompt sections, additive Plan Critic checks) with no breaking changes to existing agent behavior.

### 9.2 User Story

As a developer using the Claude Code SDLC pipeline, I want every thinking agent to distinguish what it has actually verified in this session from what it is assuming based on training-data memory — and to surface API/SDK/library identifiers with explicit citations to the actual contract — so that PRD sections, use cases, plans, architecture reviews, and security audits do not silently encode hallucinations that propagate downstream into code that compiles, runs, but does not match the real external system.

### 9.3 Functional Requirements

#### FR-1: Cognitive Self-Check Rule File (new global rule)

Create the rule file that defines the 4-question protocol, the `## Facts` block schema, the in-scope and exempt agent lists, the Plan Critic enforcement contract, and the backward-compatibility scope.

1. **FR-1.1:** A new file `src/rules/cognitive-self-check.md` MUST exist with EXACTLY six top-level `##` headings in this order: `## Protocol — Before Each Decision`, `## Mandatory Facts Section`, `## External Contract Verification`, `## Application Scope`, `## Plan Critic Enforcement`, `## Backward Compatibility`. The file MUST contain EXACTLY four `###` subsection names where the `## Mandatory Facts Section` heading defines the `## Facts` block schema: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`.
2. **FR-1.2:** The `## Protocol — Before Each Decision` section MUST enumerate the 4-question self-check protocol VERBATIM in BOTH Russian and English: (1) "На чём основано / What is this claim based on?" with the explicit annotation that "I remember from a similar API / from training data" is NOT a valid source, (2) "Проверил ли я это в текущей сессии / Did I verify against current state this session?" addressing freshness, (3) "Что я предполагаю без доказательств / What am I assuming without proof?" addressing assumption surfacing — especially API/SDK field names, status enums, and method signatures, (4) "Если предположение — помечено ли оно / If it's an assumption, is it labelled?" addressing the audit trail.
3. **FR-1.3:** The `## Mandatory Facts Section` heading MUST specify that every artifact produced by an in-scope agent (FR-3.1) MUST include a `## Facts` block with the four `### Verified facts` / `### External contracts` / `### Assumptions` / `### Open questions` subsections in that exact order. Empty subsections MUST use the literal placeholder string `(none)` — the bare absence of content under a subsection heading is NOT a valid empty marker. The rule MUST also state the cognitive-load constraint: "list only facts that load-bear on the decision being made — not every file the agent read".
4. **FR-1.4:** The `## External Contract Verification` heading MUST specify that any mention of an external API, SDK, library, or framework identifier (e.g., a method name, a status enum value, a field name on a request/response schema, a library export) MUST be accompanied by a citation in the artifact's `### External contracts` subsection. The citation MUST identify the source of verification (e.g., "verified via Read of `node_modules/express/lib/router.js`", "verified via WebFetch of OpenAI API reference page", "verified via running `npm view <pkg> exports` in the current session"). The literal phrase `"I remember from a similar API / from training data"` MUST appear verbatim in this section as an example of a source that is NOT valid.
5. **FR-1.5:** The `## Application Scope` heading MUST list the TWELVE in-scope thinking agents and the FIVE exempt executor agents EXPLICITLY by their registered slugs. In-scope (12): `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`. Exempt (5): `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`. Each exempt agent MUST be listed with a one-line rationale (e.g., "test-writer — output correctness verified by running tests; mechanical TDD execution"; "changelog-writer — mechanical Keep-a-Changelog mapping; upstream artifacts already carry `## Facts`").
6. **FR-1.6:** The `## Plan Critic Enforcement` heading MUST document the file-vs-stdout enforcement split per FR-4: file-based artifacts (PRD sections, use-case files, plan files) are mechanically enforced by the Plan Critic per FR-3.4; stdout-only artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each agent's own prompt section per FR-2. The split MUST be stated explicitly so neither the user nor a future maintainer is surprised by what the Plan Critic does and does not catch.
7. **FR-1.7:** The `## Backward Compatibility` heading MUST state that the rule applies to artifacts produced AFTER this feature merges. PRD sections whose `Date:` predates this section's merge date are EXEMPT — the Plan Critic MUST NOT flag pre-existing artifacts. Use-case files and plan files created before merge are similarly exempt. New artifacts produced AFTER merge are subject to the rule unconditionally.
8. **FR-1.8:** The rule file MUST be self-contained — it MUST NOT cross-reference other `src/rules/*.md` files for the protocol's core content. It MAY reference Section 1 FR-4 (Scope Reduction Detection) as a related Plan Critic check, but the cognitive-self-check protocol is independent: an artifact can pass scope-reduction detection while failing fact/assumption discipline, and vice versa.

#### FR-2: Thinking-Agent Prompt Updates (12 agents in scope)

Each of the twelve thinking agents gains a `## Cognitive Self-Check (MANDATORY)` section in its prompt file referencing the rule and specifying where the `## Facts` block appears in the agent's output.

1. **FR-2.1:** The following twelve agent prompt files MUST be UPDATED with a new `## Cognitive Self-Check (MANDATORY)` section: `src/agents/prd-writer.md`, `src/agents/ba-analyst.md`, `src/agents/architect.md`, `src/agents/qa-planner.md`, `src/agents/planner.md`, `src/agents/security-auditor.md`, `src/agents/code-reviewer.md`, `src/agents/verifier.md`, `src/agents/refactor-cleaner.md`, `src/agents/resource-architect.md`, `src/agents/role-planner.md`, `src/agents/release-engineer.md`.
2. **FR-2.2:** Each `## Cognitive Self-Check (MANDATORY)` section MUST: (a) reference the rule file `src/rules/cognitive-self-check.md` (or `.claude/rules/cognitive-self-check.md` from the agent's runtime perspective post-install), (b) state that the agent MUST run the 4-question protocol BEFORE writing its output, (c) specify the exact location in the agent's output where the `## Facts` block appears (described per-agent in FR-2.3 through FR-2.14).
3. **FR-2.3:** `src/agents/prd-writer.md` — the `## Facts` block appears at the END of the new PRD section, AFTER the existing `Risks and Dependencies` subsection (or equivalent terminal subsection). The agent MUST cite sources for every external API/SDK/library identifier mentioned in the PRD section in the `### External contracts` subsection.
4. **FR-2.4:** `src/agents/ba-analyst.md` — the `## Facts` block appears at the END of the use-case file at `docs/use-cases/<feature>_use_cases.md`, AFTER the last use-case scenario.
5. **FR-2.5:** `src/agents/architect.md` — the architect emits its review to STDOUT. The `## Facts` block MUST appear at the START of the stdout review, BEFORE the verdict (`APPROVED` / `REJECTED` / `APPROVED WITH CONDITIONS`). Cognitive-self-check is, by design, a discipline that runs BEFORE a decision is reached — the block documents the evidence the verdict rests on, so the reader sees the evidence first and the conclusion second. The Plan Critic does NOT mechanically enforce this — the architect's own prompt is the enforcement surface.
6. **FR-2.6:** `src/agents/qa-planner.md` — the `## Facts` block appears at the TOP of the test-cases file at `docs/qa/<feature>_test_cases.md`, AFTER the `# Test Cases: <Feature Name>` title and the `> Based on [PRD](...)` reference line, BEFORE the first numbered functional-area section. Early-document fact blocks are read by every downstream agent before they consume the test cases.
7. **FR-2.7:** `src/agents/planner.md` — the `## Facts` block appears NEAR THE TOP of `.claude/plan.md`, AFTER any of `## Recommended Resources` / `## Auto-Install Results` / `## Additional Roles` / `## Reuse Decisions` that were inlined per the planner's hand-off, and BEFORE `## Prerequisites verified`. The block is positioned immediately above the prerequisites/slices content so every downstream agent reading the plan encounters the fact-cited evidence trail before consuming the slice list. The `## Facts` block from the planner is for the planner's authoring decisions, not for the Plan Critic's findings.
8. **FR-2.8:** `src/agents/security-auditor.md` — the security audit is emitted to STDOUT. The `## Facts` block MUST appear at the START of the stdout audit, BEFORE the verdict. Same as FR-2.5, Plan Critic does NOT mechanically enforce this.
9. **FR-2.9:** `src/agents/code-reviewer.md` — the code review is emitted to STDOUT. The `## Facts` block MUST appear at the START of the stdout review, BEFORE the verdict. Same as FR-2.5.
10. **FR-2.10:** `src/agents/verifier.md` — the verifier report is emitted to STDOUT (the structured PASS/FAIL per level from Section 1 FR-1.5). The `## Facts` block MUST appear at the START of the stdout report, BEFORE the PASS/FAIL output. Same as FR-2.5.
11. **FR-2.11:** `src/agents/refactor-cleaner.md` — the refactor cleanup report is emitted to STDOUT. The `## Facts` block MUST appear at the START of the stdout report, BEFORE the cleanup verdict. Same as FR-2.5.
12. **FR-2.12:** `src/agents/resource-architect.md` — the agent writes `## Recommended Resources` and `## Auto-Install Results` to `.claude/resources-pending.md` (Section 4 FR-2.1, Section 7 FR-6.1). The `## Facts` block MUST appear in `.claude/resources-pending.md` AFTER the `## Auto-Install Results` section (or after `## Recommended Resources` if `## Auto-Install Results` is absent for any reason). The block MUST cite sources for every recommended resource (e.g., the URL of the MCP registry entry, the npm package page) in `### External contracts`.
13. **FR-2.13:** `src/agents/role-planner.md` — the agent writes `## Additional Roles`, `## Role invocation plan`, and `## Reuse Decisions` to `.claude/roles-pending.md` (Section 5 FR-2.1, Section 8 FR-8.1). The `## Facts` block MUST appear in `.claude/roles-pending.md` AFTER the `## Reuse Decisions` subsection (or after the last subsection present in the file).
14. **FR-2.14:** `src/agents/release-engineer.md` — the release engineer authors release notes and version-bump commits per Section 6. The `## Facts` block MUST appear at the END of the release-notes file (`docs/releases/<version>.md` or equivalent per Section 6 FR). When the release engineer also emits stdout summary text, the `## Facts` block appears once in the file (not duplicated to stdout).
15. **FR-2.15:** Each agent's `## Cognitive Self-Check (MANDATORY)` section MUST be ADDITIVE — it MUST NOT delete, replace, or reorder any existing prompt content. The section is appended near the top of the prompt body (after frontmatter and after any existing "Process" / "Output Format" introductions but before the constraint lists) so the agent reads it before producing output. The exact placement MAY vary per agent based on the existing prompt structure, but the section MUST be unmissable on a top-to-bottom read of the prompt.

#### FR-3: Executor-Agent Exemption (5 agents NOT modified)

The five executor agents are exempt from the rule and their prompt files MUST NOT be modified by this section.

1. **FR-3.1:** The following five agent prompt files MUST NOT be modified by this section: `src/agents/test-writer.md`, `src/agents/build-runner.md`, `src/agents/e2e-runner.md`, `src/agents/doc-updater.md`, `src/agents/changelog-writer.md`. Verifiable via `git diff src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md` showing zero diff hunks for this section's commits.
2. **FR-3.2:** The exemption MUST be documented in `src/rules/cognitive-self-check.md` per FR-1.5 with one-line rationales for each exempt agent. The rationales MUST establish that the agent's output is mechanical (tool-determined or 1:1-mapped from upstream artifacts), so a `## Facts` section would be ceremony without value.
3. **FR-3.3:** The `changelog-writer` exemption is justified by its mechanical Keep-a-Changelog mapping from PRD `Changelog:` fields (Section 3 FR-3) and git log to the `[Unreleased]` section. The upstream PRD entries (authored by `prd-writer`, in scope) already carry `## Facts` blocks, so the changelog entries inherit fact-discipline transitively. Adding a `## Facts` block to the changelog itself would be redundant.

#### FR-4: Plan Critic Enforcement (file-based artifacts only)

The Plan Critic in `src/claude.md` gains TWO new Completeness checks that mechanically enforce the cognitive-self-check protocol on file-based artifacts. Stdout-only artifacts are out of Plan Critic scope per the file-vs-stdout split.

1. **FR-4.1:** **Check (a) — Mandatory Facts Section presence.** The Plan Critic MUST verify that every file-based artifact in the current cycle contains a `## Facts` section with the four `### Verified facts` / `### External contracts` / `### Assumptions` / `### Open questions` subsections. "Current cycle artifact" is defined as: a PRD section whose `Date:` field is on or after this feature's merge date; a use-case file at `docs/use-cases/<feature>_use_cases.md` for the feature being planned; the plan file at `.claude/plan.md`. Pre-existing artifacts (Date predates merge, or older `docs/use-cases/*.md` files from prior features) are EXEMPT per FR-7.
2. **FR-4.2:** **Check (a) — finding severity.** Missing `## Facts` block in a current-cycle file-based artifact is a **MAJOR** finding (the artifact lacks fact discipline entirely). Empty subsections lacking the literal `(none)` placeholder is a **MINOR** finding (the artifact has the block but a subsection is improperly marked empty).
3. **FR-4.3:** **Check (b) — External contract identifier without citation.** The Plan Critic MUST scan the artifact body (excluding the `## Facts` block itself) for external API/SDK/library identifiers and verify each is cited in the `### External contracts` subsection. Identifier detection is HEURISTIC — the critic looks for: dotted method names (e.g., `express.Router()`, `axios.post(...)`), quoted enum or status strings (e.g., `"PENDING"`, `"running"`), and capitalized class/type names that match an `^[A-Z][A-Za-z0-9]+$` pattern AND appear in code-formatting backticks. The heuristic is intentionally low-recall (false negatives are acceptable) — the agent's own prompt is the primary defense, the Plan Critic is the backstop.
4. **FR-4.4:** **Check (b) — finding severity.** External API/SDK identifier mentioned in the artifact body without a corresponding `### External contracts` citation is a **MAJOR** finding (the artifact may be hallucinating). A citation present but with a vague source (e.g., `### External contracts` says "documentation" without identifying which documentation) is a **MINOR** finding (the audit trail is weak but the agent acknowledged the external contract).
5. **FR-4.5:** Both new checks MUST appear in the Plan Critic prompt under the existing **Completeness:** category, as new bullet points alongside the existing checks (presence of acceptance criteria, deliverables checklist, slice numbering, etc.). The new bullets MUST be added without disturbing existing checks.
6. **FR-4.6:** The Plan Critic MUST NOT mechanically enforce the protocol on stdout-only artifacts (architect's review, security-auditor's audit, code-reviewer's review, verifier's report, refactor-cleaner's report). Each of those agents enforces the protocol via its own prompt's `## Cognitive Self-Check (MANDATORY)` section per FR-2.5, FR-2.8, FR-2.9, FR-2.10, FR-2.11. The split MUST be stated explicitly in the Plan Critic prompt's preamble: "Cognitive self-check enforcement covers file-based artifacts only. Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt."
7. **FR-4.7:** The two new Completeness checks MUST be documented in the existing Plan Critic prompt structure with the same formatting style as the surrounding checks (bullet points under the Completeness category, severity tagged in line via `**MAJOR**` / `**MINOR**`). No structural reorganization of the Plan Critic prompt is required.

#### FR-5: README.md Hardening Table (one new row)

The README.md Hardening table gains one new row documenting the cognitive-self-check protocol as a hardening mechanism alongside existing entries (Verifier, Deviation Rules, Executable Plans, Scope Reduction Detection, Wave Validation, etc.).

1. **FR-5.1:** `README.md` MUST be UPDATED to add ONE new row to the existing Hardening table. The new row's columns MUST be: Mechanism = `Cognitive Self-Check Protocol`, Description = a one-line summary (e.g., `Thinking agents surface facts, assumptions, and external-contract citations in a Facts block; Plan Critic flags missing or hallucinated entries`), Coverage = `12 thinking agents (5 executor agents exempt)`, Failure Mode Addressed = `Hallucinated API/SDK/library details based on training-data memory of similar systems`. The exact column names depend on the table's existing headers — the row MUST match the table's existing schema.
2. **FR-5.2:** The new row MUST be added at the END of the existing Hardening table (after the last existing row), preserving the table's existing order. NO existing row is reordered, modified, or removed.
3. **FR-5.3:** NO other README.md change is required. The agent count (17), gate count (10), and pipeline diagram are NOT updated — this feature introduces no new agents and no new gates per FR-6.1 / FR-6.2.

#### FR-6: Unchanged-Strings and Unchanged-Files Invariants

Enumerate the specific strings, counts, and files that this section MUST NOT change.

1. **FR-6.1:** The total agent count MUST REMAIN at 17. NO references to "17 agents" / "17 specialized agents" / "17 specialized AI agents" / "17 AI agents" in `src/claude.md`, `README.md`, or `install.sh` require updating. Verifiable via `grep -n "17 specialized\|17 agents\|17 AI agents" install.sh README.md src/claude.md` showing identical results before and after this section.
2. **FR-6.2:** The total `/merge-ready` gate count MUST REMAIN at 10. NO references to "10 gates" / "10 quality gates" require updating.
3. **FR-6.3:** `install.sh` MUST be BYTE-UNCHANGED. The new rule file `src/rules/cognitive-self-check.md` is auto-distributed by the existing `src/rules/*` copy logic in `install.sh` — no banner-string updates required, no file-list additions required, no installer code path additions required. Verifiable via `git diff install.sh` showing zero diff hunks.
4. **FR-6.4:** `templates/rules/` MUST be BYTE-UNCHANGED. The cognitive-self-check rule is global (applies to the SDLC repo's authoring AND to every downstream project's authoring), so it lives under `src/rules/`, not under `templates/rules/`. Contrast with Section 3's `templates/rules/changelog.md` which is downstream-only.
5. **FR-6.5:** `templates/CLAUDE.md` MUST be BYTE-UNCHANGED. This section introduces no new template fields.
6. **FR-6.6:** The five executor agent prompt files (`src/agents/test-writer.md`, `src/agents/build-runner.md`, `src/agents/e2e-runner.md`, `src/agents/doc-updater.md`, `src/agents/changelog-writer.md`) MUST be BYTE-UNCHANGED per FR-3.1.
7. **FR-6.7:** The Agency Roles table in `src/claude.md` MUST be BYTE-UNCHANGED — no role title updates, no responsibility column updates. The cognitive-self-check protocol is a cross-cutting rule, not a role redefinition. Each in-scope agent's responsibility is unchanged; only the *manner* in which it produces output is constrained by the new rule.

#### FR-7: Backward Compatibility

Define how this section treats artifacts created before its merge date.

1. **FR-7.1:** Pre-existing PRD sections (those whose `Date:` field predates this feature's merge date) MUST be EXEMPT from the rule. The Plan Critic MUST NOT flag pre-existing PRD sections for missing `## Facts` blocks. Verifiable by inspecting Plan Critic logic for a date-comparison guard against the merge date.
2. **FR-7.2:** Pre-existing use-case files at `docs/use-cases/*.md` MUST be EXEMPT. The Plan Critic enforces the rule only on use-case files for the CURRENT cycle's feature (i.e., the feature being planned in the current `/bootstrap-feature` or `/develop-feature` invocation).
3. **FR-7.3:** Pre-existing plan files at `.claude/plan.md` MUST be EXEMPT only if they were created before merge AND are not being re-edited in the current cycle. If a plan file is re-edited (a new slice added, a slice's Done-when condition rewritten) AFTER merge, the next save MUST add a `## Facts` block per FR-2.7. The merge-date guard applies to the FILE'S last-modified time, not to per-line history.
4. **FR-7.4:** Existing artifacts modified post-merge SHOULD have a `## Facts` block added on next edit, but the Plan Critic enforces this only when the modification happens in a current cycle. Random one-off edits to historical PRD sections (e.g., fixing a typo) are NOT a Plan Critic trigger and do NOT require adding a `## Facts` block. The intent is: new artifact authoring discipline, not retroactive cleanup.
5. **FR-7.5:** This section's own PRD entry (Section 9) MUST itself include a `## Facts` block per the protocol it introduces — dogfooding. The block appears at the end of Section 9, after `9.7 Risks and Dependencies`.

### 9.4 Non-Functional Requirements

1. **NFR-1: Performance.** The Plan Critic's two new Completeness checks (FR-4.1, FR-4.3) MUST add no more than 5 seconds to a typical critic invocation on a single feature artifact set (one PRD section, one use-case file, one plan file). The checks are pattern-matching over markdown text — bounded by file size, not by external I/O.
2. **NFR-2: Cognitive load on agents.** The 4-question protocol and the `## Facts` block schema MUST be concise enough that agents do NOT produce bloated `### Verified facts` lists. The rule explicitly states "list only facts that load-bear on the decision being made — not every file the agent read" per FR-1.3. Without this guidance, agents would over-document and obscure load-bearing claims.
3. **NFR-3: No new agents.** Per FR-6.1, total agent count REMAINS at 17. This is a behavioral hardening, not a new role.
4. **NFR-4: No new gates.** Per FR-6.2, total `/merge-ready` gate count REMAINS at 10.
5. **NFR-5: Prompt bloat tolerance.** The largest in-scope agent prompts are `resource-architect.md` (≈585 LOC), `role-planner.md` (≈467 LOC), and `release-engineer.md` (≈408 LOC). Adding a ≈20-line `## Cognitive Self-Check (MANDATORY)` section is 3-5% growth — within tolerance for prompt readability and Claude Code context budget.
6. **NFR-6: Heuristic recall is intentionally low.** The Plan Critic's external-contract identifier detection (FR-4.3) is HEURISTIC and MUST NOT attempt high-recall parsing of natural-language artifacts. False negatives (an external API mentioned in prose without code-formatting backticks slips past the heuristic) are acceptable — the agent's own prompt is the primary defense. False positives (a non-external identifier misclassified as external) MAY produce spurious MAJOR findings, which the user can dismiss; the cost of a false-positive MAJOR is low.
7. **NFR-7: Version bump.** This feature triggers a minor version bump v3.1.0 → v3.2.0 — additive, no breaking changes, no behavioral regressions to existing pipeline.
8. **NFR-8: No network access required.** The rule, the agent prompts, and the Plan Critic checks all operate on local files. No network calls are introduced.

### 9.5 Acceptance Criteria

1. **AC-1:** A new file `src/rules/cognitive-self-check.md` exists with EXACTLY six `##` headings in this order: `## Protocol — Before Each Decision`, `## Mandatory Facts Section`, `## External Contract Verification`, `## Application Scope`, `## Plan Critic Enforcement`, `## Backward Compatibility`. Verifiable via `grep -n "^## " src/rules/cognitive-self-check.md` showing exactly six results in the specified order. (FR-1.1)
2. **AC-2:** The rule file contains EXACTLY four `###` subsection names in the `## Mandatory Facts Section` heading: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`. Verifiable via `grep -n "^### " src/rules/cognitive-self-check.md`. (FR-1.1, FR-1.3)
3. **AC-3:** The rule file enumerates the 4-question protocol VERBATIM in BOTH Russian and English per FR-1.2: "На чём основано / What is this claim based on?", "Проверил ли я это в текущей сессии / Did I verify against current state this session?", "Что я предполагаю без доказательств / What am I assuming without proof?", "Если предположение — помечено ли оно / If it's an assumption, is it labelled?". The annotation that "I remember from a similar API / from training data" is NOT a valid source MUST appear verbatim. (FR-1.2)
4. **AC-4:** The rule file's `## Application Scope` heading lists the TWELVE in-scope thinking agents and FIVE exempt executor agents EXPLICITLY by their registered slugs per FR-1.5. Each exempt agent has a one-line rationale. Verifiable via grep for each of the 17 agent slugs in `src/rules/cognitive-self-check.md`. (FR-1.5)
5. **AC-5:** The rule file's `## External Contract Verification` heading contains the literal phrase `"I remember from a similar API / from training data"` verbatim, labelled as not a valid source. (FR-1.4)
6. **AC-6:** All TWELVE in-scope agent prompt files contain a `## Cognitive Self-Check (MANDATORY)` section per FR-2.1 — verifiable via `grep -l "## Cognitive Self-Check (MANDATORY)" src/agents/*.md` returning exactly 12 paths matching the FR-2.1 list. (FR-2.1)
7. **AC-7:** Each in-scope agent's `## Cognitive Self-Check (MANDATORY)` section references the rule file path AND specifies the exact location in the agent's output where the `## Facts` block appears, per FR-2.3 through FR-2.14. Verifiable by reading each prompt file and confirming the location specification matches the FR-2.x clause for that agent. (FR-2.2 through FR-2.14)
8. **AC-8:** The FIVE exempt executor agent prompt files (`src/agents/test-writer.md`, `src/agents/build-runner.md`, `src/agents/e2e-runner.md`, `src/agents/doc-updater.md`, `src/agents/changelog-writer.md`) are BYTE-UNCHANGED for this section's commits. Verifiable via `git diff <pre-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md` showing zero hunks. (FR-3.1)
9. **AC-9:** The Plan Critic prompt in `src/claude.md` contains TWO new Completeness checks per FR-4.1 / FR-4.3: (a) Mandatory Facts Section presence with **MAJOR** for missing block and **MINOR** for empty subsections lacking `(none)`; (b) External contract identifier citation with **MAJOR** for missing citation and **MINOR** for vague source. Verifiable by reading the Plan Critic Completeness section and confirming both checks are present with the FR-4.2 and FR-4.4 severity tags. (FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5)
10. **AC-10:** The Plan Critic prompt's preamble explicitly states the file-vs-stdout enforcement split per FR-4.6: "Cognitive self-check enforcement covers file-based artifacts only. Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt." (FR-4.6)
11. **AC-11:** `README.md` contains ONE new row in the existing Hardening table per FR-5.1, added at the END of the table. The row's content matches FR-5.1 (Mechanism = `Cognitive Self-Check Protocol`; coverage = 12 thinking agents, 5 exempt; failure mode = hallucinated API/SDK details). NO other README change is introduced. (FR-5.1, FR-5.2, FR-5.3)
12. **AC-12:** The total agent count REMAINS at 17 byte-unchanged across `install.sh`, `README.md`, and `src/claude.md`. Verifiable via `grep -n "17 specialized\|17 agents\|17 AI agents" install.sh README.md src/claude.md` showing identical results before and after this section's implementation. (FR-6.1)
13. **AC-13:** The total `/merge-ready` gate count REMAINS at 10 byte-unchanged. Verifiable via `grep -n "10 gates\|10 quality gates" install.sh README.md src/claude.md src/commands/merge-ready.md`. (FR-6.2)
14. **AC-14:** `install.sh` is BYTE-UNCHANGED. Verifiable via `git diff <pre-merge-commit>..HEAD -- install.sh` showing zero hunks. (FR-6.3)
15. **AC-15:** `templates/rules/` is BYTE-UNCHANGED. Verifiable via `git diff <pre-merge-commit>..HEAD -- templates/rules/` showing zero hunks. (FR-6.4)
16. **AC-16:** `templates/CLAUDE.md` is BYTE-UNCHANGED. (FR-6.5)
17. **AC-17:** The Agency Roles table in `src/claude.md` is BYTE-UNCHANGED — no role title updates, no responsibility column updates. Verifiable by inspecting `src/claude.md` and confirming the table is unmodified. (FR-6.7)
18. **AC-18:** The Plan Critic does NOT flag pre-existing PRD sections (those with `Date:` predating this feature's merge date) for missing `## Facts` blocks per FR-7.1. Verifiable by running the Plan Critic against `docs/PRD.md` after this feature merges and confirming Sections 1 through 8 produce no missing-Facts findings.
19. **AC-19:** This PRD Section 9 itself contains a `## Facts` block at the end (after 9.7) per FR-7.5 — dogfooding the rule it introduces. (FR-7.5)
20. **AC-20:** Cross-references are valid: every reference to `src/rules/cognitive-self-check.md` from agent prompts resolves to the actual created file; the rule file's `## Application Scope` section references each in-scope agent by its registered slug, and each registered slug corresponds to an actual `src/agents/<slug>.md` file. No phantom paths. (FR-1.8, FR-2.2)

### 9.6 Affected Components

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `src/rules/cognitive-self-check.md` | The shared cognitive self-check rule with the 4-question protocol, the `## Facts` block schema, in-scope and exempt agent lists, Plan Critic enforcement contract, and backward-compatibility scope. | FR-1.1 through FR-1.8 |

#### Modified Files

| File | Change Type | Iter Reason | Related Requirements |
|------|-------------|-------------|---------------------|
| `src/agents/prd-writer.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block location at end of new PRD sections. | FR-2.1, FR-2.3 |
| `src/agents/ba-analyst.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block location at end of `docs/use-cases/<feature>_use_cases.md`. | FR-2.1, FR-2.4 |
| `src/agents/architect.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at START of stdout review (before verdict). | FR-2.1, FR-2.5 |
| `src/agents/qa-planner.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at TOP of `docs/qa/<feature>_test_cases.md` (after the title and PRD reference, before the first numbered section). | FR-2.1, FR-2.6 |
| `src/agents/planner.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block NEAR THE TOP of `.claude/plan.md` (after any inlined `## Recommended Resources` / `## Auto-Install Results` / `## Additional Roles` / `## Reuse Decisions`, before `## Prerequisites verified`). | FR-2.1, FR-2.7 |
| `src/agents/security-auditor.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at START of stdout audit (before verdict). | FR-2.1, FR-2.8 |
| `src/agents/code-reviewer.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at START of stdout review (before verdict). | FR-2.1, FR-2.9 |
| `src/agents/verifier.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at START of stdout report (before structured PASS/FAIL output). | FR-2.1, FR-2.10 |
| `src/agents/refactor-cleaner.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at START of stdout report (before cleanup verdict). | FR-2.1, FR-2.11 |
| `src/agents/resource-architect.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block in `.claude/resources-pending.md` after `## Auto-Install Results` (or after `## Recommended Resources` if Auto-Install is absent). | FR-2.1, FR-2.12 |
| `src/agents/role-planner.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block in `.claude/roles-pending.md` after `## Reuse Decisions` (or after the last subsection present). | FR-2.1, FR-2.13 |
| `src/agents/release-engineer.md` | additive | Add `## Cognitive Self-Check (MANDATORY)` section. Specify `## Facts` block at end of release-notes file. | FR-2.1, FR-2.14 |
| `src/claude.md` | additive | Add TWO new Completeness checks to the Plan Critic prompt per FR-4.1 / FR-4.3 with FR-4.2 / FR-4.4 severity tags. Add the file-vs-stdout enforcement split statement to the critic's preamble per FR-4.6. NO Agency Roles table changes per FR-6.7. NO agent-count or gate-count prose changes per FR-6.1 / FR-6.2. | FR-4.1 through FR-4.7 |
| `README.md` | additive | Add ONE new row to the existing Hardening table per FR-5.1 at the end of the table. NO agent-count tagline updates per FR-6.1. NO gate-count updates per FR-6.2. NO pipeline diagram changes. | FR-5.1, FR-5.2, FR-5.3 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `install.sh` | The new rule file `src/rules/cognitive-self-check.md` is auto-distributed by the existing `src/rules/*` copy logic. NO banner-string updates required (agent count unchanged per FR-6.1, gate count unchanged per FR-6.2). NO file-list additions required. (FR-6.3) |
| `templates/rules/changelog.md` | The cognitive-self-check rule is global (lives under `src/rules/`, not `templates/rules/`). The downstream-only changelog rule from Section 3 is independent. (FR-6.4) |
| `templates/CLAUDE.md` | NO new template fields introduced by this section. (FR-6.5) |
| `src/agents/test-writer.md` | Executor agent — output correctness verified by running tests; mechanical TDD execution. Per FR-3.1, BYTE-UNCHANGED. (FR-3.1, FR-6.6) |
| `src/agents/build-runner.md` | Executor agent — runs build/typecheck/test commands; output is tool-determined. Per FR-3.1, BYTE-UNCHANGED. (FR-3.1, FR-6.6) |
| `src/agents/e2e-runner.md` | Executor agent — runs Playwright/E2E suites; output is tool-determined. Per FR-3.1, BYTE-UNCHANGED. (FR-3.1, FR-6.6) |
| `src/agents/doc-updater.md` | Executor agent — mechanical doc edits driven by code changes; correctness verified by reading the diff. Per FR-3.1, BYTE-UNCHANGED. (FR-3.1, FR-6.6) |
| `src/agents/changelog-writer.md` | Executor agent — mechanical Keep-a-Changelog mapping from PRD `Changelog:` fields and git log; upstream PRD entries (authored by `prd-writer`, in scope) already carry `## Facts`. Per FR-3.1 and FR-3.3, BYTE-UNCHANGED. (FR-3.1, FR-3.3, FR-6.6) |
| `src/rules/git.md` | Git workflow rules independent of fact/assumption discipline. No interaction. |
| `src/rules/scratchpad.md` | Scratchpad format independent. The scratchpad is engineering progress tracking, not an artifact authored by a thinking agent. No `## Facts` block required. |
| `src/rules/error-recovery.md` | Error recovery rules independent of fact/assumption discipline. No interaction. |
| `src/rules/tool-limitations.md` | Tool-limitation awareness independent. No interaction. |
| `src/commands/bootstrap-feature.md` | The command orchestrates agents that internally enforce the protocol — no command-level changes required. |
| `src/commands/develop-feature.md` | Same as bootstrap-feature — command-level pass-through. |
| `src/commands/implement-slice.md` | Slice execution invokes `test-writer` (exempt per FR-3.1) and references the plan (whose Facts block is enforced at plan creation time). No command-level change required. |
| `src/commands/merge-ready.md` | Quality gates invoke in-scope agents (security-auditor, code-reviewer, verifier, refactor-cleaner) whose own prompts enforce the protocol. No command-level change required. Gate count unchanged per FR-6.2. |
| `src/commands/context-refresh.md` | Context refresh reads scratchpad. No interaction. |

### 9.7 Risks and Dependencies

1. **Risk: Stdout enforcement is split from file-based enforcement.** Stdout-only artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each agent's own prompt; the Plan Critic does NOT see stdout output and cannot mechanically check it. Mitigation: FR-4.6 makes the split explicit in the Plan Critic prompt's preamble. FR-2.5 / FR-2.8 / FR-2.9 / FR-2.10 / FR-2.11 each require the agent's own prompt to enforce. The user is informed of the split via FR-1.6 (rule file) and FR-4.6 (critic preamble) so the limitation is not hidden.
2. **Risk: changelog-writer exemption could be challenged.** A reviewer might argue `changelog-writer` should be in scope because it produces user-facing output. Mitigation: FR-3.3 documents the rationale explicitly — synthesis is mechanical Keep-a-Changelog mapping from PRD `Changelog:` fields (Section 3 FR-3) and git log; upstream PRD entries (in scope) already carry `## Facts`, so changelog entries inherit fact-discipline transitively. The rationale is in the rule file per FR-1.5.
3. **Risk: Prompt bloat in the three large in-scope agents.** `resource-architect.md` (≈585 LOC), `role-planner.md` (≈467 LOC), `release-engineer.md` (≈408 LOC) are already large; adding a ≈20-line `## Cognitive Self-Check (MANDATORY)` section is 3-5% growth. Mitigation: NFR-5 sets the tolerance explicitly. The new section is concise — a reference to the rule file plus a one-paragraph location specification. The full protocol lives in the rule file, not duplicated in each agent prompt.
4. **Risk: Cognitive load on agents (over-documentation).** Without explicit guidance, agents would dump every file path they touched into `### Verified facts`, producing noise that obscures load-bearing claims. Mitigation: FR-1.3 requires the rule to state "list only facts that load-bear on the decision being made — not every file the agent read". This guidance MUST appear in `src/rules/cognitive-self-check.md` and is referenced (not duplicated) by each agent's `## Cognitive Self-Check (MANDATORY)` section.
5. **Risk: External-contract identifier detection has low recall.** The Plan Critic's heuristic for FR-4.3 (dotted method names, quoted enum strings, capitalized class names in backticks) MISSES external API references in plain prose. Mitigation: NFR-6 makes the heuristic's low-recall property explicit. The agent's own prompt is the PRIMARY defense (the agent self-cites in `### External contracts` per FR-1.4); the Plan Critic is the BACKSTOP. The two-layer defense matches the philosophy of Section 1 FR-1 (verifier as backstop to typecheck/tests).
6. **Risk: False-positive MAJOR findings from the heuristic.** A non-external identifier (e.g., a project-internal class `UserService` mentioned in code-formatting backticks) MAY be misclassified as external and flagged as missing a citation. Mitigation: the user can dismiss the false positive in the Review Notes section of the plan; the cost of a spurious MAJOR is low (one user-facing dismissal). Refining the heuristic (e.g., excluding identifiers defined in the project's own source) is iter-2 work, not iter-1.
7. **Risk: Backward compatibility — date-comparison guard subtlety.** FR-7.1 exempts pre-existing PRD sections by `Date:` field comparison. If a PRD section's `Date:` is malformed or missing, the Plan Critic's date guard could fail open (treat as exempt, miss new artifact) or fail closed (treat as non-exempt, false-positive on legacy). Mitigation: the rule MUST treat missing/malformed `Date:` fields as POST-MERGE for safety — this fails closed (false-positive on legacy) which is the safer default and is consistent with the "scope reduction MUST be flagged" philosophy of Section 1 FR-4.
8. **Risk: The rule file itself is large and may not be read.** If `src/rules/cognitive-self-check.md` is verbose, agents may skim and miss key clauses. Mitigation: each in-scope agent's `## Cognitive Self-Check (MANDATORY)` section MUST quote the 4-question protocol verbatim (FR-2.2 implies — agents are asked to RUN the protocol, so the protocol's text must be unmissable). The rule file remains the authoritative source for the schema, scope list, and enforcement split, but the protocol's force comes from each agent prompt's reference, not from the rule file alone.
9. **Risk: Agents producing `(none)` placeholders mechanically without thought.** An agent could shortcut the protocol by writing `### Verified facts: (none)` even when load-bearing facts were used. Mitigation: this is a soft-power problem — no mechanical check can distinguish "thoughtfully empty" from "lazily empty". The rule's force is normative, not mechanical. Reviewers (human or LLM) reading the artifact catch the shortcut.
10. **Risk: Version bump regression.** v3.1.0 → v3.2.0 is additive, but if any in-scope agent prompt is mistakenly re-saved with whitespace-only edits, the per-agent diff may appear larger than intended in code review. Mitigation: implementers SHOULD use targeted Edit operations (not Write) when adding the `## Cognitive Self-Check (MANDATORY)` section to existing agent files, to avoid whitespace churn.
11. **Dependency: Section 1 FR-4 (Scope Reduction Detection).** The Plan Critic prompt structure introduced by Section 1 FR-4.4 is the surface this section's two new Completeness checks attach to. Section 1 is [SHIPPED], dependency satisfied.
12. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT] concurrently. The `Changelog: skip — internal` value used here is appropriate because this feature is purely internal hardening — there is no user-facing capability change. If Section 3 iter-1 has not shipped at the time Section 9 implementation starts, the `Changelog:` field is documentation-only and does not affect Section 9's functional requirements.
13. **Dependency: Section 6 (Release Engineer).** The agent count baseline (17) used by FR-6.1 assumes Section 6 has shipped. If Section 6 has not shipped at the time Section 9 implementation starts, the count baseline is 16, and FR-6.1 / NFR-3 / AC-12's no-count-change claim still holds (just at a different baseline). The implementer MUST verify via `grep` before concluding no count update is needed.
14. **Dependency: Section 8 (Role Planner — Iteration 2).** Orthogonal in scope. Section 8's iter-2 changes to `role-planner.md` are independent of this section's additive `## Cognitive Self-Check (MANDATORY)` insertion in the same file. If Section 8 has not yet merged when Section 9 implementation starts, the implementer adds the cognitive-self-check section to Section 8's iter-1 prompt; if Section 8 has merged, the implementer adds it to the iter-2 prompt. Either way, the addition is additive.
15. **Dependency: Section 4 (Resource Manager-Architect — Iteration 1) / Section 7 (Resource Manager-Architect — Iteration 2).** Orthogonal in scope. The cognitive-self-check section is additive to whichever iteration of `resource-architect.md` is current at implementation time.
16. **Dependency: Section 5 (Role Planner — Iteration 1).** Same orthogonality as Section 8 — additive to whichever iteration of `role-planner.md` is current.
17. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — cognitive self-check is an authoring discipline applied to artifacts, not to orchestration. Wave assignment is unaffected. Listed here only to disclaim the non-relationship.

## Facts

### Verified facts

- The PRD file `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` ends at line 2081 and the last existing section is Section 8 ("Role Planner — Iteration 2") — verified by Read of lines 1700-2081 in the current session.
- The PRD format uses numbered sections with `## N. Title`, a header block (`Status:`, `Date:`, `Priority:`, `Related:`), an optional `Changelog:` line below the header block, then numbered subsections (9.1 Description, 9.2 User Story, etc.) — verified by Read of Section 8 (lines 1819-2080) and Section 1 (lines 7-148) in the current session.
- The `Changelog:` field placement (one blank line below the `Related:` line, on its own line) is established at Section 8 line 1825 — verified by Read of lines 1820-1830 in the current session.
- Section 8's terminal subsection is "8.7 Risks and Dependencies" with numbered dependency entries — verified by Read of lines 2061-2081 in the current session.
- The approved plan at `/Users/aleksandra/.claude/plans/sleepy-exploring-tome.md` defines the cognitive-self-check feature scope, the 4-question protocol (Russian/English bilingual), the 12 in-scope thinking agents and 5 exempt executor agents, the `## Facts` block schema with 4 fixed subsections, the rule file location at `src/rules/cognitive-self-check.md`, the file-vs-stdout enforcement split, and the backward-compatibility scope — referenced via the user's task description in this session.

### External contracts

(none) — this PRD section documents an internal SDLC-pipeline hardening rule. No third-party APIs, SDKs, or libraries are integrated. The only "external" references are to other PRD sections within the same document (Section 1, Section 3, Section 6, Section 8), which are internal cross-references, not external-contract dependencies.

### Assumptions

- Section number 9 is the next available section number — assumed based on the last existing section being Section 8 and the PRD's append-only convention stated at line 3 of the PRD. Not explicitly verified that no other section 9 exists (the PRD is 2081 lines and was not read in full).
- The 12 in-scope and 5 exempt agent slugs are the complete set of SDLC agents at the time of authoring — assumed based on the user's task description; not independently verified by reading `src/claude.md` Agency Roles table or `src/agents/*.md` directory in this session.
- The Plan Critic prompt in `src/claude.md` has a `Completeness:` category section to which the two new checks attach — assumed based on Section 1 FR-4.4 wording and the user's task description; the actual `src/claude.md` content was not read in this session.
- The README.md Hardening table exists with columns for Mechanism / Description / Coverage / Failure Mode (or equivalent) — assumed based on the user's task description; the actual README.md was not read in this session.
- The merge date used by the Plan Critic's date-comparison guard (FR-7.1) will be filled in at implementation time, not at PRD authoring time — assumed because the merge date is unknown until merge happens.

### Open questions

(none) — the plan at `/Users/aleksandra/.claude/plans/sleepy-exploring-tome.md` provides sufficient specification for PRD authoring. Implementation-time decisions (exact Plan Critic preamble wording, exact README Hardening table row text, exact placement of `## Cognitive Self-Check (MANDATORY)` section within each agent prompt) are deferred to architect/planner per the existing SDLC pipeline and do not require user input at PRD-authoring time.

---

## 11. Local Knowledge Base for SDLC Agents

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-25
**Priority:** Medium
**Related:** Section 1 (FR-3: Executable Plan Format — slice fields are unchanged; the new slash command and rule reuse the established format), Section 3 (FR-3: PRD Changelog Field — this section includes the field per that contract), Section 6 (Release Engineer — Gate 9 release-engineer behavior is UNCHANGED in iter-1; the first `sdlc-knowledge-v0.1.0` tag is cut manually by maintainer per `tools/sdlc-knowledge/RELEASING.md`), Section 9 (Cognitive Self-Check Protocol — `knowledge-base:` is an additive citation source convention that slots into `### External contracts`; `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED by this section)

Changelog: Projects can point SDLC agents at a folder of domain books, articles, and PDFs; agents read the relevant material before writing PRDs, plans, and reviews so authored content reflects the project's actual domain instead of generic knowledge.

### 11.1 Description

Add a per-project, file-based knowledge base that the twelve thinking SDLC agents consult before authoring domain-bearing content (PRD requirements, use-case scenarios, architectural decisions, security rationales, plan slices that depend on domain semantics). The retrieval tool — a Rust CLI binary named `sdlc-knowledge` — lives globally under `~/.claude/tools/sdlc-knowledge/` so it is shared across all projects on the developer's machine. The data — a `.claude/knowledge/sources/` folder of user-supplied documents and a single `.claude/knowledge/index.db` SQLite file — lives per-project so each project's domain is isolated and the database never leaves the project directory.

Search uses SQLite FTS5 with BM25 ranking — pure lexical retrieval, NO vector embeddings in iter-1. The binary is invoked via Bash (no MCP server, no daemon) with exactly one allowlist entry registered in `~/.claude/settings.json` by `install.sh`. A new slash command `/knowledge-ingest <path>` raises the SDLC command count from 5 to 6 and gives the developer a one-line entry point for indexing a folder of domain documents.

**Why:** Section 9 (Cognitive Self-Check Protocol) blocks agents from inventing facts, but does nothing to *give* them domain facts. Today the only way to inject domain knowledge is to paste it into chat, which is non-persistent and per-session. Each downstream project should be able to maintain a local, file-based knowledge base from arbitrary domain sources (books, articles, regulatory PDFs) that all twelve thinking agents consult before authoring — making cited domain knowledge as routine as cited code.

**Outcome:** A user runs `bash install.sh` once and gets `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`. They scaffold a project, drop their domain PDFs/MD/TXT into `.claude/knowledge/sources/`, run `/knowledge-ingest .claude/knowledge/sources` once, and from that point every relevant agent in `/bootstrap-feature` and `/develop-feature` queries the knowledge base before writing and cites hits in `## Facts → ### External contracts` per the cognitive-self-check rule.

**Design decisions (locked in this session):**
1. Approach C: Rust binary + SQLite FTS5 (BM25 lexical search). No vector embeddings in iter-1.
2. No MCP server. Plain CLI invoked via Bash. One allowlist entry in `~/.claude/settings.json`.
3. iter-1 input formats: Markdown, plain text, PDF.
4. New slash command `/knowledge-ingest <path>` raises command count 5 → 6.
5. Software lives in global `~/.claude/`; data lives per-project under `<project>/.claude/knowledge/`.
6. Total agent count REMAINS at 17. Total `/merge-ready` gate count REMAINS at 10. README taglines BYTE-UNCHANGED.
7. The cognitive-self-check rule (Section 9) is BYTE-UNCHANGED — the new `knowledge-base:` citation prefix is an additive convention compatible with the existing `### External contracts` schema.

### 11.2 User Stories

1. **As a developer building a feature in a regulated finance project**, I want my project to maintain a local index of regulatory PDFs and internal handbooks so the PRD writer cites real domain rules in my project's PRD sections instead of hallucinating generic finance terminology.

2. **As a maintainer of an SDLC-using project that has no domain library**, I want the pipeline to behave exactly as it does today when no `index.db` exists, so adopting the SDLC does not require setting up a knowledge base on day one.

3. **As a developer working offline or on a fresh clone before the first binary release exists**, I want `install.sh` to fall back to a `cargo build --release` source build when a release binary is unavailable, so I can still get a working `sdlc-knowledge` binary without waiting for a release tag.

### 11.3 Functional Requirements

#### FR-1: `sdlc-knowledge` CLI Surface

A single Rust binary that exposes ingestion, search, and management subcommands. The binary is the only runtime surface — there is no daemon and no MCP server.

1. **FR-1.1:** A new Rust crate MUST exist at `tools/sdlc-knowledge/` (monorepo placement) with `Cargo.toml`, `src/main.rs`, and module files. The compiled artifact MUST be a single executable named `sdlc-knowledge` installed at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`.
2. **FR-1.2:** The CLI MUST expose exactly five subcommands plus `--version`:
   - `sdlc-knowledge ingest <path> [--project-root <dir>] [--json]`
   - `sdlc-knowledge search <query> [--top-k 5] [--project-root <dir>] [--json]`
   - `sdlc-knowledge list [--project-root <dir>] [--json]`
   - `sdlc-knowledge status [--project-root <dir>] [--json]`
   - `sdlc-knowledge delete <source-id> [--project-root <dir>] [--json]`
   - `sdlc-knowledge --version`
3. **FR-1.3:** `--project-root` MUST default to the process's current working directory. The binary MUST ALWAYS read and write under `<project-root>/.claude/knowledge/` and MUST NEVER touch global state outside that path. The binary MUST NOT mutate `~/.claude/` at runtime.
4. **FR-1.4:** `--json` MUST produce machine-readable output for agent consumption. Default output (no `--json`) MUST be human-readable text suitable for terminal use.
5. **FR-1.5:** `--project-root` MUST be canonicalized (symlinks resolved, `..` segments normalized). Paths that resolve OUTSIDE the process's current working directory MUST be rejected with exit code 2 and the literal error message `error: project-root must resolve under current working directory`.
6. **FR-1.6:** Every subcommand reading the index MUST validate the index file's schema before reading rows. A corrupt or truncated `index.db` MUST exit 1 with the literal message `error: index database invalid; re-ingest required`. The binary MUST NOT panic on corrupt input — `panicked at` MUST NOT appear in stderr under any malformed-input scenario.

#### FR-2: Ingestion (Markdown, Plain Text, PDF)

The `ingest` subcommand reads supported file formats, chunks the extracted text, and writes rows to the SQLite index.

1. **FR-2.1:** `sdlc-knowledge ingest <path>` MUST accept either a single file or a directory. When given a directory, the binary MUST recursively process every supported file. Supported extensions in iter-1: `.md`, `.txt`, `.pdf`.
2. **FR-2.2:** Text extraction MUST be format-aware: Markdown and plain text are read as UTF-8; PDF is extracted via the architect-selected PDF crate (default candidate `pdf-extract`; fallback `lopdf` — see Open Question #1 in `## Facts`).
3. **FR-2.3:** Extracted text MUST be split into chunks using a sliding window of ~500 characters with ~100-character overlap. The chunker MUST be deterministic — the same input file MUST produce the same chunk boundaries on every run.
4. **FR-2.4:** Each ingested file MUST produce one row in the `documents` table and one or more rows in the `chunks` table. The `documents` row MUST record `source_path`, `mtime`, `sha256`, and `ingested_at` so re-ingest is idempotent.
5. **FR-2.5:** Re-running `ingest` on a file whose `(source_path, mtime, sha256)` triple is unchanged MUST be a no-op — the binary MUST NOT re-chunk and MUST log `unchanged: <path>`. When `sha256` differs, the binary MUST re-chunk and replace the previous rows transactionally per-document via `BEGIN IMMEDIATE`.
6. **FR-2.6:** Ingestion of a directory MUST be transactional per-document, NOT per-batch. A corrupt or unreadable file (truncated PDF, malformed UTF-8) MUST be reported with a clear per-file error and the binary MUST continue processing remaining files in the batch.
7. **FR-2.7:** SQLite WAL mode MUST be enabled (`PRAGMA journal_mode=WAL`) at index initialization so reads (`search`) can interleave with writes (`ingest`) without blocking.

#### FR-3: Search (BM25 over FTS5)

The `search` subcommand returns the top-K chunks ranked by BM25 lexical similarity.

1. **FR-3.1:** `sdlc-knowledge search <query>` MUST query the FTS5 virtual table `chunks_fts` using `MATCH` and rank results by `bm25(chunks_fts)` descending.
2. **FR-3.2:** `--top-k <N>` MUST default to 5 and MUST be clamped to a reasonable upper bound (≤100) to prevent runaway result sets.
3. **FR-3.3:** `--json` MUST emit a JSON array where each element has the shape `{"source": "<source_path>", "chunk_id": <int>, "ord": <int>, "score": <float>, "snippet": "<string>"}`. The array length MUST be ≤ `--top-k`.
4. **FR-3.4:** When no chunks match the query, the binary MUST exit 0 with an empty JSON array `[]` (or a human-readable "no results" message in default output mode). No-results is NOT an error condition.

#### FR-4: Storage Schema and Migrations

The index uses a single SQLite file with a small, future-extensible schema.

1. **FR-4.1:** The index file MUST be a single SQLite database at `<project-root>/.claude/knowledge/index.db`. WAL sidecar files (`index.db-shm`, `index.db-wal`) are managed by SQLite itself.
2. **FR-4.2:** The schema MUST include exactly these tables in iter-1:
   - `documents(id INTEGER PRIMARY KEY, source_path TEXT UNIQUE, mtime INTEGER, sha256 TEXT, ingested_at INTEGER)`
   - `chunks(id INTEGER PRIMARY KEY, doc_id INTEGER REFERENCES documents(id), ord INTEGER, text TEXT)`
   - `chunks_fts` — FTS5 virtual table with `content='chunks'` and `content_rowid='id'`, plus standard insert/update/delete triggers to keep FTS5 in sync with `chunks`.
   - `schema_version(version INTEGER NOT NULL)` — seeded to `1` at index init.
3. **FR-4.3:** The `chunks` table MUST permit a future `embedding BLOB` column without requiring a destructive migration — iter-2 hybrid (sqlite-vec) is intended to ADD a column, not replace tables.
4. **FR-4.4:** A migration module MUST exist with a single v1 migration in iter-1, structured so iter-2 can append v2 without rewriting v1.

#### FR-5: Agent Activation in 12 Thinking Agents

Each of the twelve thinking agents (the same in-scope set as Section 9) gains a small activation block referencing the knowledge-base CLI.

1. **FR-5.1:** The following twelve agent prompt files MUST be UPDATED with a new `## Knowledge Base (when present)` section, appended at the end of the existing prompt body: `src/agents/prd-writer.md`, `src/agents/ba-analyst.md`, `src/agents/architect.md`, `src/agents/qa-planner.md`, `src/agents/planner.md`, `src/agents/security-auditor.md`, `src/agents/code-reviewer.md`, `src/agents/verifier.md`, `src/agents/refactor-cleaner.md`, `src/agents/resource-architect.md`, `src/agents/role-planner.md`, `src/agents/release-engineer.md`.
2. **FR-5.2:** Each `## Knowledge Base (when present)` section MUST: (a) reference the rule file `~/.claude/rules/knowledge-base.md`, (b) state that the agent MUST query the index BEFORE authoring domain-bearing content WHEN the activation sentinel `<project>/.claude/knowledge/index.db` exists, (c) include the literal CLI invocation `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json`, (d) specify that load-bearing hits MUST be cited in `## Facts → ### External contracts` using the `knowledge-base:` source prefix per FR-7.1.
3. **FR-5.3:** Each activation block MUST be ADDITIVE — it MUST NOT delete, replace, or reorder any existing prompt content (including the `## Cognitive Self-Check (MANDATORY)` section added by Section 9). The block MUST live at the end of the prompt file so its placement is unambiguous and easily diffable.
4. **FR-5.4:** The five executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) MUST NOT be modified by this section. The exemption mirrors Section 9's executor exemption — these agents do not author domain content.
5. **FR-5.5:** When the activation sentinel is ABSENT, the activation block MUST be a no-op — the agent MUST proceed with its existing authoring flow with no behavioral change. When the sentinel is present but the binary is absent, the agent MUST log the literal line `knowledge-base: tool not installed; skipping` and add a corresponding entry to its `### Open questions` subsection (per Section 9 `## Facts` schema).

#### FR-6: Slash Command `/knowledge-ingest`

A new SDLC slash command provides the user-facing entry point for ingestion.

1. **FR-6.1:** A new file `src/commands/knowledge-ingest.md` MUST exist describing a slash command that takes one required argument `<path>` and runs `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest <path> --json`.
2. **FR-6.2:** The command MUST stream the binary's per-file JSON output to chat as ingestion progresses, then emit a final summary line with the chunk count and source count returned by the binary.
3. **FR-6.3:** When the binary is absent, the command MUST report a clear actionable message including the literal text `bash install.sh --yes` and exit without error.
4. **FR-6.4:** After this section ships, `ls src/commands/*.md | wc -l` MUST return 6 (was 5 — `bootstrap-feature`, `context-refresh`, `develop-feature`, `implement-slice`, `merge-ready` plus the new `knowledge-ingest`).

#### FR-7: New Rule File `src/rules/knowledge-base.md`

A new global rule file documents the CLI usage contract, citation format, and fallback semantics for agents.

1. **FR-7.1:** A new file `src/rules/knowledge-base.md` MUST exist with sections covering: `## When to query`, `## CLI invocation contract` (lists all five subcommands verbatim), `## Citation format` (specifies the literal `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` shape), `## Activation sentinel` (defines `<project>/.claude/knowledge/index.db` as the activation sentinel), `## Fallback behavior` (binary absent / index absent / corrupt index handling), `## Application Scope` (enumerates the 12 in-scope agents and the 5 exempt executors verbatim), `## Facts` (per Section 9 schema). The file MUST be ≤ 200 lines to stay readable.
2. **FR-7.2:** The rule MUST be GLOBAL (lives under `src/rules/`, NOT `templates/rules/`) because it applies to the SDLC repo's own internal authoring AND to every downstream project's authoring. It is auto-distributed by the existing `src/rules/*` copy logic in `install.sh`.
3. **FR-7.3:** The rule's `## Citation format` MUST instruct agents to add the citation under `### External contracts` per Section 9's `## Facts` schema. The `knowledge-base:` source prefix is an ADDITIVE convention compatible with Section 9's existing schema — Section 9's rule file `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED.

#### FR-8: `install.sh` Integration

`install.sh` gains binary download, allowlist registration, project scaffold extension, and a cargo source-build fallback. Existing behavior is preserved.

1. **FR-8.1:** `install.sh` MUST detect the host platform via `uname -ms` and download the matching binary release artifact from the project's GitHub Releases. Supported iter-1 platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64. Windows is OUT OF SCOPE for iter-1 (see 11.7).
2. **FR-8.2:** After download, the binary MUST be placed at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` with executable mode (`chmod +x`). Re-running `install.sh` when the binary is already present at the expected version MUST be a no-op (idempotent install).
3. **FR-8.3:** `install.sh` MUST register exactly ONE Bash allowlist entry in `~/.claude/settings.json` whose value is the literal `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *`. The merge MUST be idempotent — re-running install MUST NOT duplicate the entry. Where `jq` is available it SHOULD be used; otherwise a heredoc-merge that preserves existing keys MUST be used.
4. **FR-8.4:** When a release binary is unavailable for the detected platform AND `cargo` is on `PATH`, `install.sh` MUST run `cargo build --release -p sdlc-knowledge` from the local checkout and copy the artifact to the global path. This is the cargo source-build fallback that handles the first-release chicken-and-egg per AC-13.
5. **FR-8.5:** When neither a release binary nor `cargo` is available, `install.sh` MUST log a clear warning of the form `binary unavailable; install cargo or wait for first release` and continue. install.sh MUST NOT abort the rest of the install on this condition (graceful degradation).
6. **FR-8.6:** `install.sh --init-project` MUST extend the project scaffold by copying `templates/knowledge/.gitignore` to `<cwd>/.claude/knowledge/.gitignore` and creating `<cwd>/.claude/knowledge/sources/` with a `.gitkeep` placeholder so the directory exists in the scaffold.
7. **FR-8.7:** The `install.sh` `VERSION` constant MUST remain unchanged in this section's commits. The pre-existing repo divergence between `install.sh` line 22 (`VERSION="2.1.0"`) and the README badge (`version-3.1.0-green.svg`) is independent of this feature; the release-engineer at Gate 9 reconciles version baselines separately.

#### FR-9: New `templates/knowledge/` Directory

A new template directory ships the per-project `.gitignore` for the knowledge folder.

1. **FR-9.1:** A new directory `templates/knowledge/` MUST exist with two files: `.gitignore` and `.gitkeep`. The `.gitignore` MUST contain exactly the lines `sources/`, `index.db`, `index.db-shm`, `index.db-wal` (one per line) so user-supplied source documents and the SQLite database (plus its WAL sidecars) are excluded from version control by default.
2. **FR-9.2:** The four pre-existing template surfaces MUST be UNCHANGED: `templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, and every file under `templates/rules/`. The ONLY template addition is the new `templates/knowledge/` directory.

#### FR-10: Backward Compatibility Sentinels

Define how the activation surface degrades gracefully when the binary or the index is absent.

1. **FR-10.1:** The activation sentinel for agent behavior is the existence of `<project>/.claude/knowledge/index.db`. When the sentinel is ABSENT, every in-scope agent MUST produce output that is BEHAVIORALLY identical to current main — no failed tool calls, no error traces in stdout, no missing-citation Plan Critic findings tied to knowledge-base absence. (The agent prompt files themselves grow by ~25 lines per FR-5.1; that is a prompt-text change, not a behavioral change in authored artifacts.)
2. **FR-10.2:** When the binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is ABSENT (e.g., install.sh has not run, or the user removed the binary), agents that attempt to query MUST log the literal line `knowledge-base: tool not installed; skipping` exactly once and proceed with their existing authoring flow without citations.
3. **FR-10.3:** Section 9's Plan Critic checks for missing `### External contracts` citations MUST NOT fire on knowledge-base absence — the activation sentinel makes the citation conditional, not unconditional. The Plan Critic itself in `src/claude.md` is UNCHANGED by this section (no new bullet); the existing `### External contracts` heuristic continues to operate as Section 9 specified.
4. **FR-10.4:** The cognitive-self-check rule file `src/rules/cognitive-self-check.md` MUST be BYTE-UNCHANGED — the new `knowledge-base:` source prefix is an additive citation convention, not a rule schema change.

#### FR-11: Cross-Platform Release Pipeline

A GitHub Actions workflow builds release binaries for the four supported platforms.

1. **FR-11.1:** A new file `.github/workflows/sdlc-knowledge-release.yml` MUST exist. The workflow MUST trigger on tags matching `sdlc-knowledge-v*` and run a build matrix covering: `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), and `ubuntu-22.04-arm` (linux-arm64).
2. **FR-11.2:** Each matrix job MUST build with `cargo build --release` using release profile flags `strip = true`, `lto = true`, `codegen-units = 1` to meet the binary-size budget (NFR-1.1). Each job MUST upload its produced binary as a release artifact.
3. **FR-11.3:** A new file `tools/sdlc-knowledge/RELEASING.md` MUST document the release process, including the maintainer-only one-time bootstrap that cuts the FIRST `sdlc-knowledge-v0.1.0` tag MANUALLY before the SDLC release that introduces this feature merges. Until that first tag exists, `install.sh` falls back to the cargo source-build path (FR-8.4).

#### FR-12: Invariants — Counts, Taglines, Executor Files

Enumerate strings, counts, and files this section MUST NOT change.

1. **FR-12.1:** Total agent count MUST REMAIN at 17. The README tagline at line 5 (`17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.`) MUST be BYTE-UNCHANGED. Verifiable via `grep -Fxc "17 specialized AI agents." README.md` returning ≥ 1.
2. **FR-12.2:** Total `/merge-ready` gate count MUST REMAIN at 10. The README tagline at line 35 (`10 quality gates`) MUST be BYTE-UNCHANGED.
3. **FR-12.3:** The five executor agent prompt files (`src/agents/test-writer.md`, `src/agents/build-runner.md`, `src/agents/e2e-runner.md`, `src/agents/doc-updater.md`, `src/agents/changelog-writer.md`) MUST be BYTE-UNCHANGED for this section's commits.
4. **FR-12.4:** The release-engineer agent prompt at `src/agents/release-engineer.md` GAINS the `## Knowledge Base (when present)` activation block per FR-5.1 but its Gate 9 release-packaging logic MUST be UNCHANGED in iter-1. Coupling the release-engineer to the binary release pipeline is OUT OF SCOPE for iter-1 (see 11.7).
5. **FR-12.5:** The cognitive-self-check rule file `src/rules/cognitive-self-check.md` MUST be BYTE-UNCHANGED per FR-10.4.

### 11.4 Non-Functional Requirements

1. **NFR-1.1: Binary size.** The compiled `sdlc-knowledge` binary MUST be < 10 MB after `strip = true` and `lto = true` on every supported platform. Estimated breakdown: rusqlite-bundled ~3 MB + chosen PDF crate ~2 MB + clap+serde+sha2 ~1 MB ≈ 6–8 MB total.
2. **NFR-1.2: Search latency.** `sdlc-knowledge search "<query>" --top-k 5 --json` MUST complete in ≤ 500 ms over a 10 000-chunk seeded fixture database on a 2024-class laptop / CI runner. This is the latency budget agents experience at authoring time.
3. **NFR-1.3: Ingest throughput.** `sdlc-knowledge ingest fixture.pdf` for a 5 MB PDF MUST complete in ≤ 60 s on a 2024-class laptop. Larger documents scale roughly linearly; throughput is bounded by the PDF crate's extraction speed.
4. **NFR-1.4: Cross-platform support.** The binary MUST build and run on darwin-arm64, darwin-x64, linux-x64, and linux-arm64. Windows is OUT OF SCOPE for iter-1 (see 11.7).
5. **NFR-1.5: Single-file database constraint.** The index MUST be a single SQLite file (`index.db`) plus the SQLite-managed WAL sidecars. Spreading state across multiple files (e.g., separate vector store, separate metadata file) is forbidden in iter-1 to keep the per-project data model trivial to back up, copy, or delete.
6. **NFR-1.6: WAL mode.** SQLite WAL mode MUST be enabled at index initialization so reads can interleave with writes. This is load-bearing for parallel-wave execution where one slice may ingest while a sibling slice queries.
7. **NFR-1.7: Idempotency on re-ingest.** Re-running `ingest` on unchanged inputs MUST be a no-op (mtime+sha256 check). Re-running on changed inputs MUST replace prior chunks atomically per-document via `BEGIN IMMEDIATE`.
8. **NFR-1.8: No network at runtime.** The `sdlc-knowledge` binary MUST NOT make network calls during `ingest`, `search`, `list`, `status`, or `delete`. All inputs are local files. Network access is restricted to `install.sh`'s one-time release download.
9. **NFR-1.9: Allowlist scope.** The Bash allowlist entry registered by `install.sh` MUST be exactly `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` — no broader wildcards, no other tool paths added. Defense-in-depth: the binary itself enforces project-root canonicalization (FR-1.5) so even an attacker-controlled CLI argument cannot escape the project sandbox.
10. **NFR-1.10: Version bump.** This feature triggers a minor version bump (additive, no breaking changes). Pipeline behavior on projects that do not initialize a knowledge base is unchanged per FR-10.1.

### 11.5 Acceptance Criteria

1. **AC-1: Install on four platforms.** `bash install.sh --yes` on darwin-arm64, darwin-x64, linux-x64, and linux-arm64 produces a working `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0 within 60 seconds (download + chmod).
2. **AC-2: Bash allowlist registered.** After install, `~/.claude/settings.json` has exactly one allow entry matching `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *`. No other paths are added.
3. **AC-3: Project scaffold extension.** `bash install.sh --init-project` creates `<cwd>/.claude/knowledge/.gitignore` containing the literal lines `sources/`, `index.db`, `index.db-shm`, `index.db-wal` (one per line, byte-for-byte matching `templates/knowledge/.gitignore`).
4. **AC-4: Ingest a 5 MB PDF.** `sdlc-knowledge ingest fixture.pdf` completes in ≤ 60 s on a 2024-class laptop, writes ≥ 1 row to `documents` and ≥ 100 rows to `chunks`. Re-running on the same file is a no-op (logs `unchanged: <path>`, exit 0).
5. **AC-5: Search returns ranked results within latency budget.** `sdlc-knowledge search "<query>" --top-k 5 --json` returns a valid JSON array of ≤ 5 chunks ordered by BM25 score descending; latency ≤ 500 ms over a 10 000-chunk database.
6. **AC-6: Path traversal rejected.** `sdlc-knowledge ingest ./books --project-root ../../../etc` exits 2 with the literal stderr message `error: project-root must resolve under current working directory`.
7. **AC-7: Corrupt index handled.** Truncating `index.db` to 100 bytes and running `search` returns exit 1 with the literal stderr message `error: index database invalid; re-ingest required`. The binary MUST NOT panic — `panicked at` MUST NOT appear in stderr.
8. **AC-8: Backward compat without index.** When `<project>/.claude/knowledge/index.db` is absent, all 12 thinking agents produce output behaviorally identical to current main (no failed tool calls, no error traces in stdout). Verifiable by running `/bootstrap-feature` on a synthetic feature with and without the index and diffing the produced PRD/use-case/plan files.
9. **AC-9: Backward compat without binary.** When `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent, agents that attempt to query log the literal line `knowledge-base: tool not installed; skipping` and proceed without citations. The pipeline does NOT abort on the missing binary.
10. **AC-10: Citation format correctness.** When the index IS present, the 12 thinking agents MUST cite at least one `knowledge-base:` source in `### External contracts` for any task that exercises domain semantics. The literal citation shape is `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes`.
11. **AC-11: Invariants preserved.** `ls src/agents/*.md | wc -l` returns 17. README contains the literal line `17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.` at line 5 BYTE-UNCHANGED and the literal phrase `10 quality gates` at line 35 BYTE-UNCHANGED. The five executor agents have ZERO diff vs current main.
12. **AC-12: Commands count.** `ls src/commands/*.md | wc -l` returns 6 (was 5).
13. **AC-13: First-release bootstrap with cargo source-build fallback.** A maintainer-only one-shot bootstrap step documented in `tools/sdlc-knowledge/RELEASING.md` cuts the FIRST `sdlc-knowledge-v0.1.0` tag manually BEFORE the SDLC release that introduces this feature merges, so subsequent users of `install.sh` find a release to download. Until that first tag exists, `install.sh` falls back to `cargo build --release` from the local checkout when `cargo` is on `PATH`; otherwise it emits the literal warning `binary unavailable; install cargo or wait for first release` and continues.

### 11.6 Risks and Dependencies

1. **Risk: Cross-platform Rust build matrix drift.** GitHub Actions runner labels (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) evolve over time; an ARM-Linux label rename could break Slice 4. Mitigation: pin labels at workflow authoring time; `actionlint` in the workflow's done-condition catches label typos. Windows DEFERRED to iter-2 (saves CI cost).
2. **Risk: PDF extraction quality.** `pdf-extract` is the iter-1 default (pure Rust, ~2 MB binary contribution); fallback to `lopdf` if quality is poor on real-world fixtures. System `pdftotext` binding is DEFERRED to iter-2 (avoids external runtime dep). The architect picks one with cited rationale at architect Step 3 (BEFORE Slice 2 ships) per Open Question #1.
3. **Risk: Binary size budget (NFR-1.1 < 10 MB).** rusqlite-bundled ~3 MB + pdf-extract ~2 MB + clap+serde ~1 MB ≈ 6–8 MB after `strip = true` and `lto = true`. Mitigation: verified at the cross-platform release dry-run; if exceeded, switch PDF crate or vendor a smaller SQLite distribution.
4. **Risk: Bash allowlist scope.** Granting `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` allows arbitrary CLI args to the binary. Mitigation: the binary itself enforces project-root canonicalization (FR-1.5 + AC-6); `..` traversal, symlink escapes, and absolute paths outside cwd are rejected with exit 2. Security-auditor pre-reviews the install.sh slice.
5. **Risk: Agent prompt bloat.** The 12 in-scope agents already grew by ~30 lines each with cognitive-self-check (Section 9); +~25 more lines from this feature → ~55 lines of additive prompt per agent. Mitigation: the rule body lives in `src/rules/knowledge-base.md`; per-agent activation block is short and references the rule.
6. **Risk: Plan Critic false positives.** Section 9's `### External contracts` heuristic could flag absent `knowledge-base:` citations when no index exists. Mitigation: FR-10.3 makes citations conditional on the activation sentinel; the Plan Critic in `src/claude.md` is UNCHANGED.
7. **Risk: Version baseline divergence.** Pre-existing repo state — `install.sh` line 22 has `VERSION="2.1.0"` while README badge shows `version-3.1.0-green.svg`. Mitigation: FR-8.7 explicitly leaves `install.sh` `VERSION` unchanged in this section's commits; the release-engineer at Gate 9 reconciles version baselines independently.
8. **Risk: First-run UX & first-release chicken-and-egg.** Without the binary, `/knowledge-ingest` fails with a clear actionable message including `bash install.sh --yes` (FR-6.3). Between merge of this feature and the maintainer cutting the FIRST `sdlc-knowledge-v0.1.0` tag, install.sh's binary download fails; the cargo source-build fallback (FR-8.4) handles this when `cargo` is on PATH; otherwise install.sh warns and skips silently (FR-8.5).
9. **Risk: Idempotency drift on file rename.** Idempotency keys on `(source_path, mtime, sha256)`; renaming an unchanged file forces re-chunking. Acceptable cost in iter-1; iter-2 may switch to content-hash-only keying.
10. **Risk: Concurrent index access in parallel waves.** SQLite WAL mode handles read concurrency; writes (ingest) are serialized via SQLite's lock. Mitigation: ingest holds a write lock per-document via `BEGIN IMMEDIATE`, not per-batch — typical 50-chunk doc < 50 ms allowing search interleaving on long full-corpus ingests.
11. **Risk: Scope creep — vectors / hybrid search.** Adding sqlite-vec-based embeddings is straightforward later but explicitly OUT OF SCOPE in iter-1 (see 11.7). Mitigation: FR-4.3 reserves the `chunks.embedding BLOB` column for future addition without destructive migration.
12. **Risk: First-release tag scheme & release-engineer invariant.** In iter-1, `release-engineer` Gate 9 itself is UNCHANGED. The maintainer manually cuts `sdlc-knowledge-v<X.Y.Z>` tags ad-hoc per `tools/sdlc-knowledge/RELEASING.md`. Automated coupling between the SDLC release-engineer and the binary release pipeline is iter-2 scope (see 11.7).
13. **Risk: macOS case-insensitive filesystem path collisions.** Every path in this section uses lowercase basenames matching on-disk files; no case-collision risk in iter-1.
14. **Dependency: Section 9 (Cognitive Self-Check Protocol).** This section's `### External contracts` citation convention attaches to the `## Facts` block schema introduced by Section 9. Section 9 is [IN DEVELOPMENT] concurrently — if Section 9 has not shipped at the time this section's implementation starts, the implementer MUST sequence Section 9 first.
15. **Dependency: Section 1 FR-3 (Executable Plan Format).** Slice fields are unchanged; the new slash command and rule reuse the established format. Section 1 is [SHIPPED], dependency satisfied.
16. **Dependency: Section 6 (Release Engineer).** The agent count baseline (17) used in FR-12.1 assumes Section 6 has shipped. If Section 6 has not shipped at the time this section's implementation starts, the count baseline shifts and the FR-12.1 / NFR-1.10 / AC-11 no-count-change claims must be re-verified — the claims still hold, just at different baselines.
17. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes a `Changelog:` field per Section 3 FR-3. Section 3 is [IN DEVELOPMENT] concurrently; if it has not shipped, the field is documentation-only and does not affect this section's functional requirements.

### 11.7 Out of Scope (iter-1)

The following items are deferred to a future iter-2 PRD section ("Local Knowledge Base — Iteration 2: Hybrid Search and Automated Release Coupling") and MUST NOT be implemented as part of iter-1:

1. **Vector embeddings (sqlite-vec hybrid search).** iter-1 is BM25-only. iter-2 adds an `embedding BLOB` column to `chunks` and a sqlite-vec extension for hybrid lexical+semantic search.
2. **MCP server interface.** iter-1 invokes the binary via Bash. An MCP server wrapper (if ever needed) is iter-2 scope.
3. **`resource-architect` auto-recommendation.** iter-1 only adds the `## Knowledge Base (when present)` activation block to `resource-architect`. Auto-recommend behavior on detecting domain PDFs in `<project>/.claude/knowledge/sources/` is iter-2 PRD scope.
4. **Windows binary builds.** iter-1 supports darwin-arm64, darwin-x64, linux-x64, linux-arm64. Windows is iter-2.
5. **Changes to `release-engineer` Gate 9.** iter-1 keeps Gate 9 UNCHANGED. The first `sdlc-knowledge-v0.1.0` tag is cut manually by the maintainer per `tools/sdlc-knowledge/RELEASING.md`. Automated coupling between the SDLC release-engineer and the binary release pipeline is iter-2 scope.
6. **Plan Critic edits in `src/claude.md`.** The existing `### External contracts` Plan Critic check from Section 9 covers `knowledge-base:` citations as a valid source format. No new Plan Critic bullet is added in iter-1.
7. **`src/rules/cognitive-self-check.md` edits.** The cognitive-self-check rule file is BYTE-UNCHANGED. The `knowledge-base:` source prefix is an additive citation convention only.
8. **Auto-tuning chunk size.** iter-1 ships fixed ~500-char windows with ~100-char overlap. A configurable flag is iter-2 if real-world retrieval quality demands tuning.

These items are listed explicitly so the Plan Critic does not flag their absence as an iter-1 gap.

### 11.8 Affected Endpoints / Schema / UI

#### Affected Endpoints

Not applicable. This project has no HTTP API. The "endpoints" of this feature are the `sdlc-knowledge` CLI subcommands enumerated in FR-1.2 and the `/knowledge-ingest` slash command in FR-6.

#### Schema Changes

A NEW SQLite database is introduced at `<project-root>/.claude/knowledge/index.db`. The schema is per-project (each project has its own database) and consists of exactly four tables in iter-1 (per FR-4.2):

| Table | Columns | Purpose |
|-------|---------|---------|
| `documents` | `id INTEGER PRIMARY KEY`, `source_path TEXT UNIQUE`, `mtime INTEGER`, `sha256 TEXT`, `ingested_at INTEGER` | One row per ingested file; `(mtime, sha256)` keys idempotency. |
| `chunks` | `id INTEGER PRIMARY KEY`, `doc_id INTEGER REFERENCES documents(id)`, `ord INTEGER`, `text TEXT` | One row per ~500-char chunk; `ord` preserves intra-document order. |
| `chunks_fts` | FTS5 virtual table, `content='chunks'`, `content_rowid='id'` | BM25-ranked full-text index over `chunks.text`. |
| `schema_version` | `version INTEGER NOT NULL` | Seeded to `1` at init; iter-2 will append a v2 migration. |

The `chunks` table reserves room for a future `embedding BLOB` column without destructive migration (FR-4.3). No tables in iter-1 are dropped or altered.

#### UI Changes

Not applicable. This project is a collection of markdown prompt files with no graphical user interface. The user-visible surface is the new `/knowledge-ingest` slash command (FR-6) and the `sdlc-knowledge` CLI's terminal output (FR-1.4).

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `tools/sdlc-knowledge/Cargo.toml` | Rust crate manifest declaring all dependencies. | FR-1.1 |
| `tools/sdlc-knowledge/src/main.rs` | clap-derive entry point wiring the five subcommands. | FR-1.2 |
| `tools/sdlc-knowledge/src/cli.rs` | Subcommand structs and project-root canonicalization. | FR-1.3, FR-1.5 |
| `tools/sdlc-knowledge/src/ingest.rs` | Chunker (~500/100 sliding window) and `SourceReader` trait. | FR-2.1 through FR-2.5 |
| `tools/sdlc-knowledge/src/text.rs` | Markdown and plain-text readers. | FR-2.2 |
| `tools/sdlc-knowledge/src/pdf.rs` | PDF reader using the architect-selected crate. | FR-2.2 |
| `tools/sdlc-knowledge/src/store.rs` | Schema definition, FTS5 triggers, idempotency, `validate_schema()`. | FR-2.4 through FR-2.7, FR-4.1 through FR-4.4 |
| `tools/sdlc-knowledge/src/migrations.rs` | v1 migration; future-extensible for v2 hybrid. | FR-4.4 |
| `tools/sdlc-knowledge/src/search.rs` | FTS5 `MATCH` + `bm25()` ranking. | FR-3.1 through FR-3.4 |
| `tools/sdlc-knowledge/src/output.rs` | Text and JSON serializers. | FR-1.4, FR-3.3 |
| `tools/sdlc-knowledge/tests/...` | Unit and `assert_cmd`-based E2E test suite. | All FR / NFR / AC |
| `tools/sdlc-knowledge/RELEASING.md` | Release process + first-tag bootstrap. | FR-11.3, AC-13 |
| `.github/workflows/sdlc-knowledge-release.yml` | Cross-platform release pipeline. | FR-11.1, FR-11.2 |
| `templates/knowledge/.gitignore` | Per-project scaffold — ignores `sources/` and `index.db*`. | FR-9.1, AC-3 |
| `templates/knowledge/.gitkeep` | Ensures `templates/knowledge/` is tracked. | FR-9.1 |
| `src/rules/knowledge-base.md` | Global rule documenting CLI usage, citation format, fallback, scope. | FR-7.1, FR-7.2, FR-7.3 |
| `src/commands/knowledge-ingest.md` | New slash command spec. | FR-6.1 through FR-6.4 |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `install.sh` | Add binary download function, allowlist registration, scaffold extension, cargo source-build fallback. `VERSION` constant unchanged. | FR-8.1 through FR-8.7 |
| `src/agents/prd-writer.md` | Append `## Knowledge Base (when present)` activation block. | FR-5.1, FR-5.2 |
| `src/agents/ba-analyst.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/architect.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/qa-planner.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/planner.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/security-auditor.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/code-reviewer.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/verifier.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/refactor-cleaner.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/resource-architect.md` | Append activation block ONLY. Auto-recommendation behavior is OUT OF SCOPE per 11.7 item 3. | FR-5.1, FR-5.2 |
| `src/agents/role-planner.md` | Append activation block. | FR-5.1, FR-5.2 |
| `src/agents/release-engineer.md` | Append activation block. Gate 9 release-packaging logic UNCHANGED per FR-12.4. | FR-5.1, FR-5.2, FR-12.4 |
| `README.md` | Add ONE row to the existing Hardening table; add ONE row to the Commands table; add a new top-level `## Local knowledge base` section. README taglines at lines 5 and 35 BYTE-UNCHANGED. | FR-12.1, FR-12.2 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/test-writer.md` | Executor agent — exempt per FR-5.4 and FR-12.3. |
| `src/agents/build-runner.md` | Executor agent — exempt. |
| `src/agents/e2e-runner.md` | Executor agent — exempt. |
| `src/agents/doc-updater.md` | Executor agent — exempt. |
| `src/agents/changelog-writer.md` | Executor agent — exempt. |
| `src/rules/cognitive-self-check.md` | BYTE-UNCHANGED per FR-10.4 / FR-12.5. The `knowledge-base:` source prefix is an additive citation convention. |
| `src/claude.md` | Plan Critic UNCHANGED per FR-10.3. The existing `### External contracts` heuristic covers the new citation format. |
| `templates/CLAUDE.md` | UNCHANGED per FR-9.2. |
| `templates/scratchpad.md` | UNCHANGED per FR-9.2. |
| `templates/settings.json` | UNCHANGED per FR-9.2. The Bash allowlist entry is added to `~/.claude/settings.json` at install time, not to the template. |
| `templates/rules/architecture.md` | UNCHANGED per FR-9.2. |
| `templates/rules/changelog.md` | UNCHANGED per FR-9.2. |
| `templates/rules/security.md` | UNCHANGED per FR-9.2. |
| `templates/rules/testing.md` | UNCHANGED per FR-9.2. |
| `src/rules/git.md` | Git workflow rules independent of knowledge-base feature. |
| `src/rules/scratchpad.md` | Scratchpad format independent. |
| `src/rules/error-recovery.md` | Error recovery rules independent. |
| `src/rules/tool-limitations.md` | Tool-limitation awareness independent. |
| `src/commands/bootstrap-feature.md` | Command orchestrates agents that internally activate the knowledge base; no command-level change required. |
| `src/commands/develop-feature.md` | Same as bootstrap-feature. |
| `src/commands/implement-slice.md` | No command-level change required. |
| `src/commands/merge-ready.md` | Gate 9 release-engineer behavior UNCHANGED per FR-12.4. |
| `src/commands/context-refresh.md` | Context refresh independent of knowledge base. |

## Facts

### Verified facts

- The PRD file `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` ends at line 2334 and the last existing section before this addition is Section 9 ("Cognitive Self-Check Protocol — Fact/Assumption Discipline for Thinking Agents") — verified by Read of the file's final lines in the current session.
- The PRD format uses numbered top-level sections (`## N. Title`), a header block (`Status:`, `Date:`, `Priority:`, `Related:`), a `Changelog:` line one blank line below the `Related:` line, and numbered subsections (`### N.1`, `### N.2`, ...) — verified by Read of Section 1 (lines 7–148), Section 8 (lines 1819-2080), and Section 9 (lines 2084–2333) in the current session.
- `install.sh` line 22 has `VERSION="2.1.0"` and `README.md` line 8 has `version-3.1.0-green.svg` (the pre-existing version-baseline divergence cited in Risk #7) — verified by Read of `install.sh:20-24` and `README.md:1-40` in the current session.
- The README tagline `17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.` is at `README.md` line 5 — verified by Read in the current session. The phrase `10 quality gates` is at `README.md` line 35 (start of the bullet "10 quality gates — git hygiene, docs completeness, ...") — verified by Read in the current session.
- The 12 in-scope thinking agents and 5 exempt executor agents enumerated in FR-5.1 / FR-5.4 match the Section 9 application-scope list verbatim — verified by Read of `docs/PRD.md` Section 9 FR-1.5 (line 2131) in the current session.
- The approved plan at `/Users/aleksandra/.claude/plans/fuzzy-juggling-ocean.md` defines the feature scope, the locked-in Approach C (Rust + SQLite FTS5, no MCP, no vectors), the 13 acceptance criteria, the 8 implementation slices across 5 waves, and the 13 risks and dependencies — verified by Read of the entire plan in the current session.
- The cognitive-self-check rule file `src/rules/cognitive-self-check.md` shipped on or before 2026-04-25 (recent merge commit `9220903 Merge branch 'feat/cognitive-self-check'`) and mandates the four-subsection `## Facts` schema (`### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`) used at the bottom of this section — verified via the system context and via reading Section 9 in the PRD this session.

### External contracts

- **`rusqlite` crate (Rust SQLite binding) — symbol: `rusqlite::Connection::open_with_flags`, `Connection::execute_batch`, `Connection::prepare`; SQLite FTS5 virtual table syntax `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')`; ranking function `bm25(chunks_fts)`** — source: rusqlite docs https://docs.rs/rusqlite/ + SQLite FTS5 docs https://www.sqlite.org/fts5.html — verified: **no — assumption**. Risk: API drift between rusqlite major versions; FTS5 column-weight argument ordering not confirmed. Verification path: architect Step 3 review BEFORE Slice 3 ships (per Open Question #5 in the plan).
- **`pdf-extract` crate — symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>`** — source: https://crates.io/crates/pdf-extract — verified: **no — assumption**. Risk: extraction quality on multi-column / scanned PDFs; default iter-1 choice. Verification path: architect Step 3 picks one (`pdf-extract` vs `lopdf`) with cited rationale BEFORE Slice 2 ships (Open Question #1 in the plan).
- **`clap` crate v4.x — symbols: `clap::Parser` derive macro, `#[command(subcommand)]`, `clap::Subcommand`** — source: https://docs.rs/clap/4 — verified: **no — assumption**. Risk: minor wording drift between 4.x patch versions. Verification path: any `cargo build` failure in Slice 1 reveals API mismatches immediately.
- **GitHub Actions runner labels for the four-platform build matrix — `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), `ubuntu-22.04-arm` (linux-arm64)** — source: https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners — verified: **no — assumption**. Risk: ARM-Linux label rename; runner labels evolve. Verification path: pin labels at Slice 4 implementation; `actionlint` in workflow done-condition catches typos.
- **SQLite `bm25()` ranking function — symbol: `bm25(fts_table_name [, weight1, weight2, ...])`** — source: https://www.sqlite.org/fts5.html#the_bm25_function — verified: **no — assumption**. Risk: column-weight argument ordering not confirmed in this session. Verification path: architect Step 3 review BEFORE Slice 3 ships; Slice 3's done-condition includes a working end-to-end search query.
- **`assert_cmd` and `predicates` test crates — symbols: `assert_cmd::Command`, `predicates::str::contains`** — source: https://docs.rs/assert_cmd / https://docs.rs/predicates — verified: **no — assumption**. Risk: minor; de-facto Rust CLI test idiom. Verification path: caught at first `cargo test`.
- **`actionlint` — invocation `actionlint .github/workflows/*.yml`** — source: https://github.com/rhysd/actionlint — verified: **no — assumption**. Risk: version drift; not yet in repo. Verification path: Slice 4 pins a specific `actionlint` version in the workflow itself or in a `.actionlint` config.

### Assumptions

- **Rust crate placement is monorepo (`tools/sdlc-knowledge/` inside the SDLC repo)** — risk: if architect prefers a separate repository, install.sh's release-download URL changes but the binary surface is identical; verification path: architect Step 3 reviews repo placement.
- **Default chunk size of ~500 characters with ~100-character overlap is reasonable for BM25 retrieval over technical books** — risk: too-small chunks fragment phrasing; too-large chunks dilute BM25 scores; verification path: Slice 2 includes a fixture-based golden test (`sample.md` ~3 KB → exactly 8 chunks); a configurable flag is iter-2 (per 11.7 item 8).
- **The `## Knowledge Base (when present)` activation block (~25 lines) appended at the END of each of the 12 in-scope agent prompt files fits without disturbing existing sections (including the `## Cognitive Self-Check (MANDATORY)` section from Section 9)** — risk: large-prompt agents (`resource-architect.md` ~585 LOC, `role-planner.md` ~467 LOC) hit attention-budget limits; verification path: read each agent file before edit; if rejected, the rule file `src/rules/knowledge-base.md` carries the verbose details and per-agent blocks shrink to a 5-line pointer.
- **Idempotency keying on `(source_path, mtime, sha256)` is sufficient for re-ingest** — risk: files renamed but unchanged are re-chunked unnecessarily; verification path: Slice 2's idempotency test covers the unchanged-file case; renamed-file is acceptable cost in iter-1.
- **The Plan Critic in `src/claude.md` does NOT need a new bullet for `knowledge-base:` citations because the existing Section 9 `### External contracts` heuristic covers the new prefix** — risk: if architect or Plan Critic auditor disagrees, iter-2 PRD adds a soft-MINOR bullet; verification path: architect Step 3 explicit confirmation that no Plan Critic edit is required.
- **Section 11 is the next available top-level section number** — risk: low; based on the last existing section being Section 9 in the file (no Section 10 exists in the PRD body — Section 9's parent says "1 through 8" but the file ends at Section 9, and the user task explicitly directs me to add Section 11). The `Section 10` referenced in the user task may be an off-by-one in the user's mental model; verified at file-end-line 2334 that no Section 10 currently exists. Verification path: re-Read of the PRD's section headings if a Section 10 lands during a concurrent merge.

### Open questions

- **Open Question #1 — Which PDF crate?** `pdf-extract` (pure Rust, simpler, lower-fidelity) vs `lopdf` (lower-level, more code) vs system `pdftotext` binding (best fidelity, external runtime dep). RESOLUTION: architect Step 3 picks ONE with cited rationale; iter-1 default is `pdf-extract` per Risk #2. Decision must land BEFORE Slice 2 ships.
- **Open Question #2 — rusqlite + FTS5 syntax verification.** Five of seven `### External contracts` are `verified: no — assumption`. RESOLUTION: architect Step 3 MUST verify rusqlite's FTS5 virtual-table syntax and `bm25()` argument ordering against current docs BEFORE Slice 3 ships (load-bearing for store + search). Pre-Slice-3 prerequisite.
- **Open Question #3 — `release-engineer` Gate 9 coupling to binary releases.** RESOLVED — out of scope for iter-1 per 11.7 item 5. Iter-1 keeps Gate 9 unchanged; the maintainer manually cuts `sdlc-knowledge-v<X.Y.Z>` tags ad-hoc per `tools/sdlc-knowledge/RELEASING.md`.
- **Open Question #4 — `resource-architect` auto-recommendation behavior.** RESOLVED — out of scope for iter-1 per 11.7 item 3. Iter-1 only adds the `## Knowledge Base (when present)` activation block to `resource-architect`. Auto-recommend behavior on detecting domain PDFs is iter-2 PRD scope.
- **Open Question #5 — Per-project `sources/` directory `.gitignored` by default?** RESOLVED for iter-1: `templates/knowledge/.gitignore` ships with `sources/`, `index.db`, `index.db-shm`, `index.db-wal` excluded by default per FR-9.1. Teams that want to track shared compliance docs in git opt in by removing entries from the per-project `.gitignore`.

---

## 12. Robust PDF Extraction via pdfium-render

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-25
**Priority:** High
**Related:** Section 11 (Local Knowledge Base for SDLC Agents — iter-2 of the same feature; replaces the iter-1 PDF reader implementation while preserving CLI surface, citation format, agent activation contract, schema, and storage layer byte-for-byte), Section 9 (Cognitive Self-Check Protocol — `## Facts` discipline applies to this section's PRD/use-case/plan/review artifacts), Section 3 (FR-3: PRD Changelog Field — this section includes the field per that contract), Section 6 (Release Engineer — Gate 9 release-packaging logic UNCHANGED in iter-2; the matrix CI workflow gains a pdfium availability smoke step but does not change Gate 9 behavior)

Changelog: PDF documents that previously failed to index — including ebooks converted by calibre and other PDFs with composite CID fonts — are now indexed correctly so SDLC agents can cite their content.

### 12.1 Overview

Section 11 (iter-1) shipped a working `sdlc-knowledge` CLI with PDF extraction backed by the pure-Rust `pdf-extract = "0.7"` crate. Live testing on a 9-book ML/AI corpus surfaced two categorical extraction failures that the per-file panic boundary contained but could not repair:

1. **CID-font failures.** Calibre-converted ebooks (calibre 3.32.0 emits PDFs with `/Type0` composite CID fonts and `/ToUnicode` CMaps) yield near-zero usable text from `pdf-extract`. A specific 484 KB / 308-page calibre-PDF produced **27 whitespace-only chunks** under iter-1; the same PDF re-converted to Markdown via `pypdf` produced **1212 well-formed chunks**, and a BM25 round-trip on the phrase `"LSTM 22 ms random forest"` returned chunk_id 17236 with score 30.62 — proving the data is recoverable, just not by `pdf-extract`.
2. **Hard panics.** One book in the corpus triggered an internal panic in `pdf-extract` that was contained by the iter-1 `catch_unwind` boundary but produced zero indexed text from that file.

**Solution.** Replace `pdf-extract = "0.7"` with `pdfium-render = "0.9"` — a Rust binding to Google's PDFium engine. PDFium is the production PDF renderer shipped in Chrome/Chromium to billions of users and handles every weird PDF on the open web (CID fonts, multi-column layouts, encrypted documents with empty passwords, malformed cross-reference tables, mixed-encoding annotations).

**Why pdfium-render specifically.**
- **Correctness.** PDFium parses every font dictionary type (`/Type0`, `/Type1`, `/Type3`, `/TrueType`, `/CIDFontType0`, `/CIDFontType2`) and resolves `/ToUnicode` CMaps natively — the exact failure category that broke iter-1.
- **License compatibility.** `pdfium-render` is dual-licensed MIT OR Apache-2.0 and PDFium upstream is BSD-3 — both fully compatible with this repo's MIT license. The most prominent alternative, the `mupdf` Rust binding, is AGPL-3.0 and would force the entire SDLC repo to AGPL.
- **Distribution shape.** `pdfium-render` dynamically loads a prebuilt PDFium shared library (`libpdfium.dylib` / `libpdfium.so`). The community project `bblanchon/pdfium-binaries` (MIT) publishes signed prebuilt binaries on every PDFium upstream release for the four iter-1 platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) plus several others.
- **Failure isolation.** When the dynamic library cannot be loaded (binary missing, ABI mismatch, sandbox), the failure is scoped to PDF ingest — Markdown and plain-text ingest paths continue working.

**Companion fix.** The iter-1 `delete <source-path>` subcommand canonicalizes the supplied path through `resolve_project_root`, which means a source file whose canonicalization differs from the value stored in `documents.source_path` (e.g., a stale row from a renamed source dir, or a row left behind by an aborted iter-1 ingest) cannot be removed without manual SQL surgery. Iter-2 adds `delete --by-id <int>` that bypasses the path-canonicalization gate and operates directly on the integer primary key — the project-root gate at DB-open time remains the single security boundary.

**Invariants preserved.** The five subcommands (`ingest`, `search`, `list`, `status`, `delete`), the `--project-root` security gate, the JSON output shape, the `knowledge-base:` citation literal, the FTS5 + WAL schema, the agent activation block in 12 thinking agents, the cognitive-self-check rule, the 17-agent count, the 10-gate count, and the README taglines are ALL byte-unchanged in iter-2.

### 12.2 User Stories

1. **As an ML engineer dropping calibre-converted ebooks into `<project>/.claude/knowledge/sources/`**, I want every page of every ebook indexed at full text fidelity so the BM25 search returns the chapter I cited from memory, instead of empty chunks that force me to re-convert the PDF to Markdown by hand.

2. **As an SDLC user testing the corpus**, I want to remove a source by its integer id without fighting path canonicalization rules, so I can clean up rows left behind by aborted ingests or renamed source files in one command.

3. **As a maintainer of an SDLC-using project on a platform where the prebuilt PDFium binary is unavailable or fails to load (sandboxed CI, exotic ARM variant, missing glibc version)**, I want PDF ingest to fail per-file with a clear actionable error while Markdown and plain-text ingest of the same batch continue to succeed, so a single platform-specific failure does not block the rest of the corpus from indexing.

### 12.3 Functional Requirements

#### FR-1: pdfium-render Integration

The PDF reader is replaced with a `pdfium-render`-backed implementation that loads PDFium dynamically, opens documents, iterates pages, and concatenates extracted text.

1. **FR-1.1:** `tools/sdlc-knowledge/src/pdf.rs` MUST be rewritten to use `pdfium-render = "0.9"` (minor-version pinned). The public function signature `pub fn read(p: &Path) -> Result<String, IngestError>` MUST be byte-unchanged so callers in `ingest.rs` are not modified.
2. **FR-1.2:** The new implementation MUST instantiate a single `Pdfium` engine handle per process via `Pdfium::bind_to_system_library()` (or the equivalent path-resolver entrypoint that searches platform-standard library locations). Engine bind failure MUST surface as `IngestError::PdfDecode` with a message of the form `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes`. The binding MUST NOT panic on missing-library errors.
3. **FR-1.3:** Document open MUST use `Pdfium::load_pdf_from_byte_slice` reading the file via `std::fs::read` so the security boundary remains "the binary opens files passed by the canonicalized project-root gate, never via path strings handed directly to native code". Password-protected documents MUST attempt the empty-password path first; on failure, surface `IngestError::PdfDecode` with `password-protected; not supported in iter-2` and continue the batch.
4. **FR-1.4:** Page iteration MUST use the documented `PdfDocument::pages().iter()` API, extracting text per page via the page-text accessor. Per-page text MUST be concatenated with a single `\n` separator into the document-level string.
5. **FR-1.5:** The 50 MB byte budget (`PDF_BUDGET_BYTES`) and the `check_byte_budget` gate MUST be preserved byte-for-byte from iter-1 — the budget applies to the concatenated extracted text, not to the source bytes. Budget violations continue to surface as `IngestError::PdfBudgetExceeded`.
6. **FR-1.6:** The `catch_unwind` panic boundary MUST be retained around all `pdfium-render` calls. Although PDFium is engineered for hostile input, the `catch_unwind` is defense-in-depth for any panic surfacing through FFI from native code.
7. **FR-1.7:** The unit-test seam `extract_via_closure_for_test` MUST be retained with an unchanged signature so existing TC-SEC-2.1 (synthetic panic injection) continues to pass without test-file changes.

#### FR-2: pdf-extract Removal

The `pdf-extract` dependency is removed entirely; no shim, no fallback path, no transitive include via `Cargo.lock`.

1. **FR-2.1:** `tools/sdlc-knowledge/Cargo.toml` MUST replace the line `pdf-extract = "0.7"` with `pdfium-render = "0.9"` (minor-version pinned with no patch-version float across the `0.9.x` range). No other dependency lines change.
2. **FR-2.2:** `cargo tree -p pdf-extract` MUST return exit code 1 (`error: package ID specification 'pdf-extract' did not match any packages`) after this section ships, confirming the dep is fully removed (not just unreferenced).
3. **FR-2.3:** All comments, doc-strings, and module-level prose in `tools/sdlc-knowledge/src/pdf.rs` MUST be updated to reference `pdfium-render` and `pdfium`. Any string `pdf_extract` MUST NOT appear in the file. The comment block at lines 1-8 of iter-1 `pdf.rs` is rewritten verbatim to describe the pdfium-render integration.
4. **FR-2.4:** The `IngestError::PdfDecode` variant message format MAY change to include a pdfium-specific reason string, but the variant identity MUST be preserved so downstream `impl Display for IngestError` and per-file error printing in `ingest.rs` is byte-unchanged.

#### FR-3: install.sh PDFium Binary Download

`install.sh` gains a per-platform PDFium binary download step that places the shared library where `pdfium-render` can find it at runtime.

1. **FR-3.1:** `install.sh` MUST detect the host platform via `uname -ms` and download the matching prebuilt PDFium archive from `bblanchon/pdfium-binaries` GitHub Releases. The four iter-2 platform-to-asset mappings are: darwin-arm64 → `pdfium-mac-arm64.tgz`, darwin-x64 → `pdfium-mac-x64.tgz`, linux-x64 → `pdfium-linux-x64.tgz`, linux-arm64 → `pdfium-linux-arm64.tgz`. Windows remains OUT OF SCOPE per 12.7.
2. **FR-3.2:** The downloaded archive MUST be extracted to `~/.claude/tools/sdlc-knowledge/pdfium/` (sibling directory to the `sdlc-knowledge` binary) with the canonical layout `pdfium/lib/libpdfium.{dylib|so}` per platform. Re-running `install.sh` when the library is already present at the expected version MUST be a no-op (idempotent install).
3. **FR-3.3:** The PDFium release tag pinned by `install.sh` MUST be a single literal version string (e.g., `chromium/6996`) declared in one place at the top of `install.sh` and substituted into the download URL. Updating PDFium versions is a single-line edit.
4. **FR-3.4:** `pdfium-render`'s library-path resolver MUST locate the extracted library. `install.sh` MUST set up the resolver path via the documented mechanism (typically `LD_LIBRARY_PATH` on Linux and `DYLD_LIBRARY_PATH` on macOS, or by extracting directly to the system library directory if the resolver searches there). The chosen mechanism MUST be one that is reversible by removing the `~/.claude/tools/sdlc-knowledge/pdfium/` directory.
5. **FR-3.5:** When the PDFium download fails (network outage, GitHub Releases asset moved, sha256 mismatch in iter-3) `install.sh` MUST log a clear warning of the form `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected` and continue. install.sh MUST NOT abort the rest of the install on this condition (graceful degradation, mirrors §11 FR-8.5).
6. **FR-3.6:** The same `SCRIPT_DIR` cleanup ordering concern documented in §11 Slice 5 applies — `install.sh` MUST re-invoke `get_source_dir` after any `cd` that could shift `SCRIPT_DIR`, before resolving the PDFium archive path. Failure to do so was a source of breakage in §11 iter-1 commits.
7. **FR-3.7:** Re-running `install.sh --yes` on a host where PDFium is already installed and the `chromium/<version>` tag matches MUST be a no-op (no re-download, no re-extract, idempotent).

#### FR-4: `delete --by-id <int>` Subcommand

A companion fix that adds a path-canonicalization-free deletion path keyed by integer primary key.

1. **FR-4.1:** The `delete` subcommand gains a mutually exclusive flag pair: existing `<source-path>` positional argument vs new `--by-id <int>` flag. Exactly one MUST be supplied; supplying both MUST exit 2 with the literal stderr message `error: --by-id and <source-path> are mutually exclusive`.
2. **FR-4.2:** `--by-id <int>` MUST accept any non-negative `i64` and resolve to the row in `documents` whose primary key equals the supplied integer. Non-existent ids MUST exit 1 with the literal stderr message `error: no document with id <int>` and NOT touch the database.
3. **FR-4.3:** `--by-id <int>` MUST NOT pass through `resolve_project_root` for the supplied id — the project-root canonicalization gate at DB-open time (already required for any subcommand) is sufficient because the SQLite database file itself is the security boundary, not the path stored in the `documents.source_path` column.
4. **FR-4.4:** Deletion via `--by-id` MUST be transactional — the `documents` row, all dependent `chunks` rows, and the FTS5 trigger-cascaded `chunks_fts` rows MUST be removed in one `BEGIN IMMEDIATE` … `COMMIT` block.
5. **FR-4.5:** `--json` output MUST include the integer id deleted, the source_path that was stored under that id (for audit), and the count of chunks removed: `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}`.

#### FR-5: Backward Compatibility — pdfium Absent

When the PDFium dynamic library cannot be loaded, PDF ingest fails per-file with a clear error while Markdown and plain-text ingest continue.

1. **FR-5.1:** `sdlc-knowledge ingest <dir>` on a directory containing `.md`, `.txt`, and `.pdf` files when PDFium is absent MUST process the `.md` and `.txt` files normally and emit one `IngestError::PdfDecode("pdfium dynamic library not found ...")` per `.pdf` file. The batch exit code MUST be 0 if at least one file succeeded, mirroring §11 FR-2.6's per-file error boundary.
2. **FR-5.2:** A single `.pdf` file passed directly to `sdlc-knowledge ingest <file>.pdf` when PDFium is absent MUST exit 1 with the same per-file error printed to stderr (no batch context to fall back on).
3. **FR-5.3:** The CLI surface, the `index.db` schema, and the FTS5 + BM25 ranking remain unchanged when PDFium is absent — search and management subcommands work normally over previously-indexed content.

#### FR-6: Test Fixture — Calibre-Sample PDF

A small calibre-converted PDF is vendored into the repo to exercise the CID-font failure mode that broke iter-1.

1. **FR-6.1:** A new fixture at `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` MUST be added. The fixture MUST be a calibre-converted ebook excerpt small enough to vendor in git (≤ 100 KB, target 30 KB), generated by running calibre 3.x or later on a public-domain text source so license compatibility is unambiguous.
2. **FR-6.2:** A new integration test in `tools/sdlc-knowledge/tests/` MUST ingest the fixture and assert:
   - The fixture produces ≥ `(file_size_kb / 2)` chunks (i.e., chunks/MB ratio ≥ 50, per NFR-4 below).
   - At least one chunk contains a non-whitespace alphabetic word ≥ 5 characters (proves CID decoding worked).
   - Re-ingest is a no-op (`unchanged: <path>` per §11 FR-2.5).
3. **FR-6.3:** The fixture MUST be committed alongside a `tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md` documenting (a) the source text's public-domain provenance, (b) the calibre version used to convert, (c) the SHA-256 of the committed file. This is documentation, not enforcement — but it gives the next maintainer the recipe for regenerating the fixture.

#### FR-7: GitHub Actions Release Workflow Update

The cross-platform release pipeline introduced in §11 FR-11 gains a PDFium presence smoke step.

1. **FR-7.1:** `.github/workflows/sdlc-knowledge-release.yml` MUST add a step that runs `install.sh --yes`'s PDFium download path before `cargo build --release` so the matrix CI verifies the per-platform PDFium archive download succeeds. The smoke step's done-condition is that the extracted `libpdfium.{dylib|so}` exists and is non-zero size at the expected path.
2. **FR-7.2:** A second smoke step MUST run `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>` after build and assert exit 0 and ≥ 1 chunk indexed. This catches dynamic-load regressions on the matrix runners.
3. **FR-7.3:** The build matrix labels (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) and the trigger pattern (`sdlc-knowledge-v*` tags) are UNCHANGED from §11 FR-11.1. Iter-2 only adds steps; it does not change the matrix shape.
4. **FR-7.4:** The Gate 9 release-engineer agent's behavior remains UNCHANGED — the maintainer continues to cut tags manually per `tools/sdlc-knowledge/RELEASING.md`. Iter-2 does NOT couple Gate 9 to the binary release pipeline (consistent with §11 FR-12.4).

#### FR-8: Documentation Updates

Four documentation surfaces gain pdfium-aware content.

1. **FR-8.1:** `~/.claude/rules/knowledge-base-tool.md` MUST be UPDATED. The "Known limitations of pdf-extract" section is REPLACED with a "PDF extraction via PDFium" section noting (a) PDFium handles CID fonts, multi-column layouts, password-protected (empty password) PDFs natively; (b) scanned PDFs without a text layer still need OCR pre-processing — that limitation is intrinsic to image-only PDFs, not the extractor; (c) PDFium dynamic library availability is required and install.sh handles per-platform download.
2. **FR-8.2:** `~/.claude/rules/knowledge-base.md` MUST be UPDATED to remove the "Known limitations of pdf-extract" section in favor of a "PDFium availability" section. The CLI invocation contract, citation format, activation sentinel, fallback behavior, and application scope sections remain BYTE-UNCHANGED.
3. **FR-8.3:** `tools/sdlc-knowledge/RELEASING.md` MUST gain a new section "PDFium binary versioning" documenting the `chromium/<version>` tag pinning policy, how to bump the pinned version (single-line edit per FR-3.3), and the `bblanchon/pdfium-binaries` source.
4. **FR-8.4:** `README.md` MUST gain ONE new row in the existing Hardening table referencing the iter-2 robust PDF extraction. The README taglines at lines 5 and 35 MUST be BYTE-UNCHANGED (consistent with §11 FR-12.1 / FR-12.2).

#### FR-9: Invariants Enforced

Iter-2 is a drop-in PDF reader replacement plus one CLI flag and one binary download. Everything else stays put.

1. **FR-9.1:** The five `sdlc-knowledge` subcommands (`ingest`, `search`, `list`, `status`, `delete`) plus `--version` remain BYTE-UNCHANGED in their public surface. Iter-2's only addition is the `--by-id <int>` flag on `delete`; the existing positional-path form is preserved.
2. **FR-9.2:** The `knowledge-base:` citation literal format `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` is BYTE-UNCHANGED.
3. **FR-9.3:** The `## Knowledge Base (when present)` activation block in the 12 thinking agents is BYTE-UNCHANGED.
4. **FR-9.4:** The 17-agent count and 10-gate count are BYTE-UNCHANGED. `ls src/agents/*.md | wc -l` returns 17. `grep -Fxc "10 quality gates" README.md` returns ≥ 1.
5. **FR-9.5:** The cognitive-self-check rule file `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED.
6. **FR-9.6:** The five executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) are BYTE-UNCHANGED — iter-2 makes no agent-prompt edits except the documentation surfaces enumerated in FR-8.
7. **FR-9.7:** The FTS5 + WAL schema is BYTE-UNCHANGED. The `documents`, `chunks`, `chunks_fts`, `schema_version` tables retain their iter-1 column shape; the `chunks.embedding BLOB` column reservation for iter-3 hybrid search remains intact.

### 12.4 Non-Functional Requirements

1. **NFR-1: Binary size budget.** The compiled `sdlc-knowledge` binary MUST remain ≤ 10 MB after `strip = true` and `lto = true` (UNCHANGED from §11 NFR-1.1). `pdfium-render` itself is small — the heavy bytes ship in the separate dynamic library, not the binary.
2. **NFR-2: PDFium dylib budget.** The extracted `libpdfium.{dylib|so}` SHOULD add 10–15 MB sibling to the binary, bringing total per-platform install footprint to ≤ 25 MB across the four supported platforms. This is reported in the install summary.
3. **NFR-3: Extraction latency.** A 5 MB PDF MUST be ingested in ≤ 60 s on a 2024-class laptop (UNCHANGED from §11 AC-4 / NFR-1.3). PDFium is significantly faster than `pdf-extract` on equivalent input, so the budget is conservative.
4. **NFR-4: Chunks-per-MB ratio (empirical quality proxy).** For calibre-converted PDFs, `chunks_count / file_size_mb` MUST be ≥ 50 after iter-2. The same metric on iter-1 averaged ~2 chunks/MB on calibre PDFs (the failure mode); pypdf-as-Markdown achieves ~2500 chunks/MB on the same input. Iter-2 MUST close at least 95% of that gap.
5. **NFR-5: Fault isolation.** PDFium dynamic-load failure MUST be isolated to the PDF subcommand path. Markdown ingest, plain-text ingest, search, list, status, and delete MUST work normally with PDFium absent (per FR-5).
6. **NFR-6: Deterministic page-text concatenation.** Iterating pages and concatenating page-text with `\n` MUST produce byte-identical output across runs on the same input — `pdfium-render`'s page iteration is documented as deterministic. This is load-bearing for the `(source_path, mtime, sha256)` idempotency check from §11 FR-2.5: if extraction were non-deterministic, every re-ingest would re-chunk.
7. **NFR-7: Cross-platform support unchanged.** The four iter-1 platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) remain supported in iter-2. Windows remains OUT OF SCOPE.
8. **NFR-8: License compatibility.** All new and modified dependencies MUST be license-compatible with this repo's MIT license. Specifically: `pdfium-render` is MIT OR Apache-2.0, PDFium upstream is BSD-3, `bblanchon/pdfium-binaries` is MIT. The AGPL-3.0 `mupdf` Rust binding is REJECTED on license-incompatibility grounds.
9. **NFR-9: Version bump.** This feature triggers a minor version bump on the `sdlc-knowledge` crate (0.1.0 → 0.2.0) — replacement of a runtime dependency is additive in the SemVer sense (no breaking changes to the binary's CLI surface). The SDLC repo's tagline version bump is handled separately by the release-engineer at Gate 9.

### 12.5 Acceptance Criteria

1. **AC-1: pdfium-render dependency swap clean.** `cargo tree -p pdfium-render` returns a single matched package at version `0.9.x`. `cargo tree -p pdf-extract` returns exit 1 (`did not match any packages`).
2. **AC-2: Calibre PDF round-trips correctly.** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>` produces ≥ 1 row in `documents` and ≥ `(file_size_kb / 20)` rows in `chunks` (chunks-per-MB ≥ 50 per NFR-4). At least one chunk MUST contain a non-whitespace alphabetic word ≥ 5 characters.
3. **AC-3: Re-ingest is a no-op.** Running the AC-2 invocation a second time logs `unchanged: <path>` and exits 0 with no new rows in `documents` or `chunks` (per §11 FR-2.5, unchanged in iter-2).
4. **AC-4: Search round-trip on calibre fixture.** After AC-2 ingest, `sdlc-knowledge search "<phrase from the fixture>" --top-k 5 --json --project-root <tmpdir>` returns a non-empty JSON array whose first element's `source` field is the fixture path and whose `score` is positive (BM25 larger-is-better convention from §11).
5. **AC-5: install.sh PDFium download per-platform.** `bash install.sh --yes` on each of the four supported platforms produces `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` of non-zero size within 90 s. Re-running `install.sh --yes` on a host where the library is already present at the pinned `chromium/<version>` tag is a no-op (no re-download, exit 0).
6. **AC-6: PDFium absent — graceful degradation.** With PDFium removed (`rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`), `sdlc-knowledge ingest <dir-with-md-and-pdf>` processes `.md` files normally, prints one per-file `pdfium dynamic library not found` error per `.pdf` file, and exits 0 if at least one file succeeded. `panicked at` MUST NOT appear in stderr.
7. **AC-7: `delete --by-id` works.** `sdlc-knowledge delete --by-id <existing-id> --json` returns `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}` with exit 0; the `documents` row, all dependent `chunks` rows, and FTS5 entries are removed. `sdlc-knowledge delete --by-id <nonexistent-id>` exits 1 with `error: no document with id <int>` and DOES NOT touch the database.
8. **AC-8: `delete --by-id` and `<source-path>` mutual exclusion.** `sdlc-knowledge delete --by-id 5 some/path.pdf` exits 2 with `error: --by-id and <source-path> are mutually exclusive`.
9. **AC-9: GitHub Actions matrix smoke passes.** The `.github/workflows/sdlc-knowledge-release.yml` matrix run on a `sdlc-knowledge-v*` tag completes the new PDFium download + calibre fixture ingest smoke steps with exit 0 on all four platform jobs.

### 12.6 Risks and Dependencies

1. **R-1: PDFium dynamic-library hijack via env var or symlink.** `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` are user-controllable, and a malicious shared library named `libpdfium.so` placed earlier on the resolver path could be loaded by `pdfium-render` instead of the install.sh-fetched binary. Mitigation: security-auditor pre-reviews Slice 1 (PDF reader rewrite) and Slice 3 (install.sh changes); the install.sh extraction path is constrained to `~/.claude/tools/sdlc-knowledge/pdfium/` and the resolver mechanism chosen MUST favor explicit-path APIs over environment-variable lookup where `pdfium-render` exposes both.
2. **R-2: PDFium binary download URL stability.** `bblanchon/pdfium-binaries` is a community project. Asset filenames could change between PDFium upstream releases. Mitigation: pin a specific `chromium/<version>` tag in install.sh per FR-3.3; sha256 verification of the downloaded archive is DEFERRED to iter-3 — same posture as the iter-1 `sdlc-knowledge` binary download (which also lacks sha256 verification per §11 FR-8.1, deferred to a later iteration).
3. **R-3: Cross-platform .dylib/.so naming variance.** Darwin uses `libpdfium.dylib`; Linux uses `libpdfium.so`. `pdfium-render`'s path resolver handles both, but the install.sh extraction step MUST verify the correct filename per platform exists post-extract. Mitigation: FR-7.1 smoke step asserts the extracted file exists with the platform-specific name on each matrix runner.
4. **R-4: bblanchon/pdfium-binaries release cadence / abandonment.** If the community project goes dormant, future PDFium upstream versions will not have prebuilt binaries. Fallback path: build PDFium from upstream source via `gn`/`ninja` (Google's build system) — multi-hour build, multi-GB toolchain. OUT OF SCOPE for iter-2; documented as a known fallback in `RELEASING.md` per FR-8.3.
5. **R-5: Existing chunk-count regression.** Re-ingesting currently-working PDFs (the 7 of 9 books that succeeded under iter-1) with PDFium will produce DIFFERENT chunk counts because the extractor differs — page-text concatenation may include or exclude headers/footers, hyphenation handling differs, ligature decoding differs. Mitigation: NFR-4's chunks/MB ≥ 50 floor catches catastrophic regression while allowing normal extractor variance; the iter-2 corpus re-ingest is a one-time event documented in `RELEASING.md`.
6. **R-6: install.sh ordering — SCRIPT_DIR cleanup pattern.** `install.sh` already exhibited a SCRIPT_DIR shift bug in §11 Slice 5 that required `get_source_dir` re-invocation after each `cd`. The PDFium download path adds another `cd` (into `~/.claude/tools/sdlc-knowledge/pdfium/`) and MUST follow the same re-invocation pattern. Mitigation: FR-3.6 documents the constraint; the Slice 3 done-condition includes a regression test that runs `install.sh --yes` from an arbitrary cwd and asserts no SCRIPT_DIR-related errors.
7. **R-7: pdfium-render API stability.** `pdfium-render` is at v0.9.x — pre-1.0, so SemVer guarantees are weaker than for stable crates. Mitigation: pin minor version (`0.9` in `Cargo.toml` per FR-2.1); a major-version bump (0.10, 1.0) requires a follow-up PRD section to vet API changes.
8. **R-8: Dynamic loading on hardened CI runners.** Some CI runners (sandboxed Linux containers, restrictive macOS notarization paths) may refuse to load the PDFium dylib with no clear error. Mitigation: the FR-7.2 smoke step exercises load-on-CI; if a matrix runner fails, the workflow fails fast with a known signature rather than producing silent zero-chunk PDFs.
9. **R-9: Calibre-fixture license provenance.** A vendored `calibre-sample.pdf` MUST be derived from a public-domain or permissively-licensed source. Mitigation: FR-6.3 documents provenance in a sibling README; Project Gutenberg or similar public-domain sources are the canonical pick.
10. **Dependency: Section 11 (Local Knowledge Base for SDLC Agents — iter-1).** This section is iter-2 of §11 and depends on §11 having shipped (binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`, schema at `<project>/.claude/knowledge/index.db`, agent activation blocks in 12 thinking agents). If §11 has not shipped at iter-2 implementation time, iter-2 cannot start.
11. **Dependency: Section 9 (Cognitive Self-Check Protocol).** This PRD section's `## Facts` block schema, the `### External contracts` citation discipline for `pdfium-render` / `bblanchon/pdfium-binaries`, and the Plan Critic enforcement all depend on Section 9 being live. Section 9 shipped on or before 2026-04-25 per the merge commit history.
12. **Dependency: Section 6 (Release Engineer).** Gate 9 release-packaging logic remains UNCHANGED in iter-2 per FR-7.4. The `release-engineer` agent's behavior is unaffected by this section.
13. **Dependency: Section 3 (FR-3 PRD Changelog Field).** This PRD section includes a `Changelog:` field per the contract.

### 12.7 Out of Scope (iter-2)

The following items are explicitly deferred to a future iteration (e.g., iter-3 hybrid search PRD section or a dedicated PDFium-hardening section) and MUST NOT be implemented as part of iter-2:

1. **sha256 verification of the downloaded PDFium archive.** Iter-2 trusts GitHub Releases TLS + the `bblanchon/pdfium-binaries` repository chain; explicit sha256 pinning of each platform asset is iter-3 scope (mirrors §11 iter-1's sdlc-knowledge binary sha256 deferral).
2. **OCR for scanned PDFs.** Image-only PDFs without an embedded text layer still produce empty extraction under PDFium — that limitation is intrinsic to image-only input, not the extractor. OCR pre-processing (e.g., `ocrmypdf`) is a future scope item.
3. **Windows binary support.** `bblanchon/pdfium-binaries` ships Windows assets, but `install.sh` is bash-only and Windows install is OUT OF SCOPE per §11 NFR-1.4.
4. **PDFium build from upstream source.** When `bblanchon/pdfium-binaries` is unavailable for a platform, the fallback is to install PDFium via the host package manager or build from upstream — both are out of scope for iter-2 automation.
5. **Hybrid lexical + semantic search via sqlite-vec.** The iter-1 `chunks.embedding BLOB` column reservation remains intact; vector search is iter-3 scope.
6. **Coupling Gate 9 release-engineer to the binary release pipeline.** Iter-2 keeps Gate 9 unchanged. The maintainer continues to cut `sdlc-knowledge-v<X.Y.Z>` tags manually.

These items are listed explicitly so the Plan Critic does not flag their absence as an iter-2 gap.

### 12.8 Affected Endpoints / Schema / UI

#### Affected Endpoints

Not applicable. This project has no HTTP API. The CLI subcommand surface is UNCHANGED from §11 FR-1.2 except for the addition of the `--by-id <int>` flag on `delete` (FR-4.1).

#### Schema Changes

NONE. The four iter-1 tables (`documents`, `chunks`, `chunks_fts`, `schema_version`) and the FTS5 + WAL configuration are BYTE-UNCHANGED. The `chunks.embedding BLOB` column reservation for iter-3 hybrid search remains intact. No migration is required — iter-1 indexes opened by iter-2 binaries continue to work without conversion.

#### UI Changes

Not applicable. This project is a collection of markdown prompt files and a CLI; no graphical user interface.

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` | Calibre-converted ebook excerpt fixture (≤ 100 KB, ~30 KB target) exercising the iter-1 CID-font failure mode. | FR-6.1, FR-6.2, AC-2 |
| `tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md` | Provenance documentation for the calibre fixture (source text, calibre version, sha256). | FR-6.3 |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `tools/sdlc-knowledge/Cargo.toml` | Replace `pdf-extract = "0.7"` with `pdfium-render = "0.9"`. Bump crate version `0.1.0` → `0.2.0`. | FR-2.1, NFR-9 |
| `tools/sdlc-knowledge/src/pdf.rs` | Rewrite the entire module to use `pdfium-render`; preserve `pub fn read` signature, `PDF_BUDGET_BYTES`, `check_byte_budget`, `extract_via_closure_for_test`, and the `catch_unwind` panic boundary. | FR-1.1 through FR-1.7, FR-2.3, FR-2.4 |
| `tools/sdlc-knowledge/src/cli.rs` | Add the `--by-id <int>` flag on `delete`; enforce mutual exclusion with `<source-path>`. | FR-4.1, FR-4.2 |
| `tools/sdlc-knowledge/src/main.rs` | Wire the new `--by-id` branch into the `delete` subcommand handler. | FR-4.1 through FR-4.5 |
| `tools/sdlc-knowledge/src/store.rs` | Add `delete_by_id(conn, id) -> Result<DeleteByIdSummary, _>` invoked under `BEGIN IMMEDIATE`; existing `delete_by_path` is untouched. | FR-4.4, FR-4.5 |
| `install.sh` | Add per-platform PDFium archive download, extraction to `~/.claude/tools/sdlc-knowledge/pdfium/lib/`, library-resolver path setup, idempotency check, and the `chromium/<version>` pinned tag. Honor the SCRIPT_DIR re-invocation pattern. | FR-3.1 through FR-3.7 |
| `.github/workflows/sdlc-knowledge-release.yml` | Add PDFium download smoke step and calibre-fixture ingest smoke step in the matrix; trigger pattern and matrix labels UNCHANGED. | FR-7.1, FR-7.2, FR-7.3 |
| `tools/sdlc-knowledge/RELEASING.md` | Document `chromium/<version>` tag pinning, PDFium binary versioning policy, and the build-from-source fallback as a known iter-3 path. | FR-8.3, R-4 |
| `~/.claude/rules/knowledge-base-tool.md` | Replace the `## Known limitations of pdf-extract` section with `## PDF extraction via PDFium`. | FR-8.1 |
| `~/.claude/rules/knowledge-base.md` | Replace the `## Known limitations of pdf-extract` section with `## PDFium availability`. CLI invocation contract, citation format, activation sentinel, fallback behavior, and application scope sections BYTE-UNCHANGED. | FR-8.2 |
| `README.md` | Add ONE row to the existing Hardening table for iter-2 robust PDF extraction. README taglines at lines 5 and 35 BYTE-UNCHANGED. | FR-8.4, FR-9.4 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `tools/sdlc-knowledge/src/ingest.rs` | The `pdf::read` signature is preserved (FR-1.1); the chunker, idempotency, and per-file error boundary are unchanged. |
| `tools/sdlc-knowledge/src/text.rs` | Markdown and plain-text readers are unaffected by the PDF reader replacement. |
| `tools/sdlc-knowledge/src/store.rs` schema | Tables and FTS5 triggers are byte-unchanged (FR-9.7). Only the new `delete_by_id` function is added. |
| `tools/sdlc-knowledge/src/migrations.rs` | No new schema version. v1 migration unchanged. |
| `tools/sdlc-knowledge/src/search.rs` | Search behavior is unaffected by the ingest-side reader replacement. |
| `tools/sdlc-knowledge/src/output.rs` | Output formats unchanged except the new `delete --by-id` JSON shape; serialization helpers are reused. |
| All 12 thinking agent prompt files | Activation block is BYTE-UNCHANGED (FR-9.3). |
| All 5 executor agent prompt files | UNCHANGED per FR-9.6. |
| `src/rules/cognitive-self-check.md` | BYTE-UNCHANGED per FR-9.5. |
| `src/rules/git.md`, `src/rules/scratchpad.md`, `src/rules/error-recovery.md`, `src/rules/tool-limitations.md` | Independent rules, unaffected. |
| `templates/knowledge/.gitignore`, `templates/knowledge/.gitkeep` | Per-project scaffold, unaffected. |
| `src/commands/*.md` | All six slash commands unaffected. The `/knowledge-ingest` command continues to invoke the binary with unchanged flags. |
| `src/claude.md` | Plan Critic UNCHANGED. The existing `### External contracts` heuristic continues to cover `pdfium-render` and `bblanchon/pdfium-binaries` citations. |
| `docs/PRD.md` Sections 1-11 | Unchanged. Iter-2 appends Section 12 only. |

## Facts

### Verified facts

- The PRD file `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` ends at line 2692 immediately before Section 12 is appended; the last existing section before this addition is Section 11 ("Local Knowledge Base for SDLC Agents") — verified by `wc -l` and Read of the file's final lines in the current session.
- The current `tools/sdlc-knowledge/src/pdf.rs` module is 70 lines, uses `pdf_extract::extract_text` at line 26, wraps it in `catch_unwind(AssertUnwindSafe(...))` at line 46, enforces a 50 MB byte budget via `PDF_BUDGET_BYTES = 50 * 1024 * 1024` at line 17, and exposes `extract_via_closure_for_test` for synthetic-panic test injection at lines 33-39 — verified by Read of the entire file in the current session.
- The current `tools/sdlc-knowledge/Cargo.toml` declares `pdf-extract = "0.7"` at line 16 and `sdlc-knowledge` crate version `0.1.0` at line 3, with `[profile.release]` flags `strip = true`, `lto = true`, `codegen-units = 1`, `opt-level = 3` at lines 34-38 — verified by Read of the entire file in the current session.
- §11's CLI surface (five subcommands plus `--version`), citation format literal, agent activation block (12 thinking agents), and 17-agent / 10-gate invariants are documented at PRD lines 2380-2386, 2523, 2430-2434, and 2493-2494 respectively — verified by Read of those line ranges in the current session.
- §11 Risk #2 (PDF extraction quality) at PRD line 2531 already flagged `pdf-extract` as the iter-1 default with `lopdf` as a deferred fallback and explicit architect Step 3 picks-one rationale — confirming this iter-2 PRD section's premise is the resolution of that pre-flagged risk; verified by Read of the line in the current session.
- Knowledge-base status at task start: `doc_count: 8`, `chunk_count: 17030`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db` — verified via `sdlc-knowledge status --json` in the current session.

### External contracts

- **`pdfium-render` crate v0.9** — symbol: `pdfium_render::Pdfium::bind_to_system_library`, `pdfium_render::PdfDocument::pages`, page-level text accessor, `Pdfium::load_pdf_from_byte_slice` — license: MIT OR Apache-2.0 — repo: `ajrcarey/pdfium-render` — source: crates.io API response in this session (current latest in 0.9.x line; updated 2026-03-30; 234,919 recent downloads) — verified: yes (license + repo + version line confirmed via crates.io this session). Risk: pre-1.0 SemVer; minor-version pin in Cargo.toml mitigates.
- **`pdf-extract` crate v0.7** — symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>` — source: `tools/sdlc-knowledge/Cargo.toml:16` and `tools/sdlc-knowledge/src/pdf.rs:26` — verified: yes (currently in repo; being removed in iter-2 per FR-2.1 / FR-2.2). The two failure modes documented in 12.1 (CID font / `/Type0` decoding gaps; hard panic on one corpus book) are EMPIRICAL findings from the live 9-book test referenced in the user task, not assumptions about the crate.
- **`bblanchon/pdfium-binaries` GitHub project** — symbol: GitHub Releases assets `pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz`; tag scheme `chromium/<int>` — license: MIT — source: architect's iter-2 recommendation per the user task — verified: **no — assumption**. Risk: asset filename or tag scheme could differ from the architect's recollection. Verification path: Slice 3 (install.sh integration) opens the actual GitHub Releases page during implementation and pins the exact asset URLs and tag value; any mismatch fails Slice 3's done-condition (the FR-3.1 platform mapping must be exact).
- **PDFium upstream (Google)** — symbol: PDFium engine; the production renderer in Chromium — license: BSD-3 — source: well-known industry artifact, NOT opened in this session — verified: **no — assumption**. Risk: license claim in 12.1 is widely-cited industry fact but not reverified this session against PDFium's `LICENSE` file. Verification path: code-reviewer pass at the merge-ready gate confirms the LICENSE statement against an upstream copy when the iter-2 implementation slice lands.
- **`pdfium-render` library-path resolver** — symbol: `Pdfium::bind_to_system_library`, `Pdfium::bind_to_library` (path-explicit variant), platform-specific search behavior on `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` / system library paths — source: `pdfium-render` README/docs (NOT opened in this session) — verified: **no — assumption**. Risk: the resolver mechanism the iter-2 install.sh integrates with could differ from this PRD's description (FR-3.4 mentions both env-var-based and direct-extract options precisely because the exact API has not been verified). Verification path: architect Step 3 (pre-Slice-1) opens `pdfium-render` docs and selects the explicit API; Slice 1 done-condition includes a working PDF round-trip on the dev laptop.
- **GitHub Actions runner labels for the iter-2 release pipeline — `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`** — source: §11 FR-11.1 — verified: yes (inherited from §11 which shipped the workflow file). Iter-2 does not change the matrix shape per FR-7.3.
- **knowledge-base CLI for §12 authoring** — symbol: `sdlc-knowledge status --json`, `sdlc-knowledge search "<query>" --top-k 5 --json` — source: live invocation in this session per the knowledge-base mandate — verified: yes (status returned 8 docs / 17030 chunks; three searches on "PDF parsing crate Rust pdfium", "CID font ToUnicode CMap composite encoding", "calibre ebook PDF text extraction" each returned `[]` — zero hits across all queries; corpus is ML/AI domain with no PDF-internals literature).

### Assumptions

- **`pdfium-render = "0.9"` minor-version pin is the right granularity.** Risk: a 0.9.x → 0.10 bump could land mid-iter-2 with API breakage; if minor-pin is too loose, the build breaks on `cargo update`. How to verify: architect Step 3 selects the exact pin (`0.9` vs `=0.9.x`) before Slice 1 ships; CI catches build breakage early.
- **PDFium dynamic library extracts cleanly to `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` with the right name per platform.** Risk: archive layout from `bblanchon/pdfium-binaries` may differ from this assumed structure. How to verify: Slice 3 done-condition asserts the post-extract path exists with the expected filename per FR-3.2 and FR-3.4.
- **Calibre 3.x or later is available to a SDLC contributor for fixture regeneration.** Risk: the fixture is committed once and re-generated rarely, but if the fixture corrupts or upstream calibre changes its emission, regeneration requires the right calibre version. How to verify: FR-6.3 documents the calibre version used; the next maintainer can install that version on demand.
- **The `mupdf` Rust binding's AGPL-3.0 license is incompatible with this repo's MIT and would force whole-repo AGPL.** Risk: low — AGPL incompatibility with MIT downstream redistribution is well-documented. How to verify: not load-bearing for iter-2 because the decision is to NOT use mupdf; the assertion only justifies the rejection.
- **Iter-2 chunks/MB ≥ 50 floor (NFR-4) is achievable on calibre PDFs without further tuning.** Risk: the empirical baseline (~2 chunks/MB on iter-1 calibre PDFs) and the pypdf-Markdown reference (~2500 chunks/MB) are from a 9-book ML/AI corpus; the 50-floor may be too tight or too loose for other calibre-PDF families. How to verify: AC-2 exercises the floor on the vendored fixture; if real-world calibre PDFs cluster below 50, iter-3 tunes the floor.
- **The `delete --by-id` JSON shape `{"deleted_id", "source_path", "chunks_removed"}` is consistent with §11's existing `delete <path>` JSON output.** Risk: if §11's `delete <path>` already emits a different shape, iter-2 should match it. How to verify: read `tools/sdlc-knowledge/src/output.rs` during Slice 4 (CLI surface) and align field names exactly. NOT verified in this session — Slice 4 must reconcile.

### Open questions

- **Knowledge-base searches on `"PDF parsing crate Rust pdfium"`, `"CID font ToUnicode CMap composite encoding"`, and `"calibre ebook PDF text extraction"` returned zero hits each (corpus is ML/AI literature, not PDF-internals or document-conversion).** Per the knowledge-base mandate this is a documented negative result, not a silent skip. Action: consider adding a PDFium / PDF-internals reference (e.g., the PDF 1.7 specification, the PDFium developer wiki) to the `<project>/.claude/knowledge/sources/` corpus if iter-3 work continues to depend on PDF-format reasoning. No action required for iter-2 — the source-of-truth for iter-2 contracts is `pdfium-render`'s own docs and `bblanchon/pdfium-binaries`'s GitHub Releases page, both of which are external-contracts items above.
- **Open Question #1 — Exact `pdfium-render` library-path API.** `bind_to_system_library` vs `bind_to_library(path: &Path)` vs `bind_to_statically_linked_library` (feature-gated). RESOLUTION: architect Step 3 picks ONE with cited rationale before Slice 1 ships. Iter-2 default (per FR-1.2) is `bind_to_system_library` with install.sh placing `libpdfium.{dylib|so}` on the resolver path; if the architect prefers explicit-path binding, FR-1.2 and FR-3.4 are tightened accordingly during planning.
- **Open Question #2 — Calibre fixture content.** The fixture must reproduce the iter-1 CID-font failure (calibre 3.32.0 emits `/Type0` composite CID fonts) on a small, public-domain text source. RESOLUTION: planner picks a Project Gutenberg excerpt during Slice 6 implementation; FR-6.3 documents the choice. NOT load-bearing for the PRD; load-bearing for the test asset.
- **Open Question #3 — sha256 verification of the PDFium download.** RESOLVED — DEFERRED to iter-3 per 12.7 item 1 (mirrors §11 iter-1's sdlc-knowledge binary sha256 deferral).
- **Open Question #4 — Windows binary support.** RESOLVED — OUT OF SCOPE per 12.7 item 3 (consistent with §11 NFR-1.4).
- **Open Question #5 — Coupling Gate 9 release-engineer to the PDFium binary version bump.** RESOLVED — OUT OF SCOPE per 12.7 item 6 (consistent with §11 FR-12.4).

## 13. Auto-Release Pipeline — Executing-Mode Tagging, Cross-Platform Prebuilt Binaries, and Pre-Push Hooks

**Status:** [IN DEVELOPMENT]
**Date:** 2026-04-26
**Priority:** High
**Related:** Section 11 (Local Knowledge Base for SDLC Agents — iter-1 of `sdlc-knowledge`; this section bootstraps the FIRST `sdlc-knowledge-v0.2.0` release tag that `install.sh` line 368 has been pointing at since §11 shipped, finally closing the chicken-and-egg gap that has been forcing `cargo_source_build_fallback` on every fresh install). Section 12 (Robust PDF Extraction via pdfium-render — iter-2 of the same tool; this section adds Windows to the platform matrix that §12 left at four targets per §12 NFR-7 / 12.7 item 3, and the §12 PDFium binary download in `install.sh:489-613` is the precedent shape for the prebuilt-binary download path of FR-4 below). Section 6 (Changelog Release Packaging — iter-2 of Feature #3; release-engineer Gate 9 is currently SUGGEST-ONLY per the `## NEVER List` at `src/agents/release-engineer.md:67-84` and §6 FR-3.4 / FR-5.6 — this section flips Gate 9 to EXECUTING-MODE under tier-based authority gradation, mirroring resource-architect's iter-2 contract). Section 7 (Resource Manager-Architect — Iteration 2: Auto-Install — the four-tier authority model `Trivial | Moderate | Sensitive | Forbidden` defined at `src/agents/resource-architect.md:185-260` is the SOURCE PATTERN this section adapts for release publication; FR-1 below maps each release operation to one of these four tiers using the same anchored-regex whitelist + headless contract pattern from §7 FR-5). Section 9 (Cognitive Self-Check Protocol — `## Facts` discipline applies; this section's `### External contracts` cite all GitHub Actions identifiers and the `softprops/action-gh-release@v2` action). Section 3 (FR-3 PRD Changelog Field — this section includes the field; this section also dogfoods Section 3 by opting the SDLC core repo INTO the changelog feature it has shipped to downstream projects since iter-1).

Changelog: Users running `bash install.sh` now receive prebuilt `sdlc-knowledge` binaries in seconds on macOS, Linux, and Windows instead of waiting for cargo to compile from source.

### 13.1 Overview

**Problem (evidence from previous iters).** Three intertwined gaps surfaced during iter-1 (§11) and iter-2 (§12) live testing:

1. **First-release chicken-and-egg.** §11 FR-11 shipped a complete cross-platform release workflow at `.github/workflows/sdlc-knowledge-release.yml`, but the workflow only fires on `sdlc-knowledge-v*` tag pushes — and no maintainer has ever pushed that tag. `install.sh:368` therefore hits a 404 on `https://github.com/<owner>/<repo>/releases/download/sdlc-knowledge-v0.1.0/sdlc-knowledge-<platform>` on every install, falls through to `cargo_source_build_fallback` at `install.sh:411`, and silently requires every user to have `cargo` available locally. The iter-1 release infrastructure works in principle but has never executed in production because cutting the first tag is friction the maintainer has not paid.
2. **§12 inherits the gap.** §12 added PDFium binary download alongside the missing `sdlc-knowledge` binary download. `install_pdfium_binary` at `install.sh:489-613` works (the `bblanchon/pdfium-binaries` upstream tag `chromium/7802` is reachable). But the companion `sdlc-knowledge` binary is still missing for the same chicken-and-egg reason — so a fresh install needs cargo AND PDFium, instead of just PDFium.
3. **`install.sh:25` REPO_URL is wrong.** `REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"` was set when the project was scoped to a different GitHub owner; the actual remote is `codefather-labs/claude-code-sdlc.git`. The owner-derivation at `install.sh:367` (`echo "$REPO_URL" | sed 's|^https://github.com/||; s|\.git$||'`) computes `Koroqe/claude-code-sdlc`, which 404s on every release-asset URL. Even after the first tag is cut, `install.sh` would not find the asset at the URL it constructs. This is a pre-existing bug independent of the chicken-and-egg gap and must be fixed in lock-step.

**Solution.** Three coordinated changes that close the loop end-to-end.

1. **Flip Gate 9 release-engineer from suggest-only to executing-mode** under a four-tier authority gradation that mirrors `resource-architect.md:185-260` byte-for-byte in shape. The current `release-engineer.md:67-84` `## NEVER List` enumerates 13 forbidden commands (`git push`, `git tag`, `gh release create`, `npm publish`, `cargo publish`, `pypi upload`, etc.) and refuses to execute any of them. After this section ships, the agent classifies each command into Trivial / Moderate / Sensitive / Forbidden and uses an anchored-regex whitelist plus the same headless-contract pattern as §7 FR-5.4 to either auto-execute (Trivial), execute after per-item user approval (Moderate), require explicit user approval per Rule 4 escalation (Sensitive), or refuse entirely (Forbidden). The four-tier model is THE proven precedent in this codebase — see `src/agents/resource-architect.md:201-220` for the canonical decision table.

2. **Add Windows to the cross-platform matrix and bootstrap the first release tag.** The §11 / §12 release workflow currently builds four platforms (`darwin-arm64` / `darwin-x64` / `linux-x64` / `linux-arm64` per `.github/workflows/sdlc-knowledge-release.yml:64-75`). This section adds `windows-x64` (target `x86_64-pc-windows-msvc` on `windows-latest`), bringing the matrix to FIVE platforms. A one-shot bootstrap pass cuts the FIRST `sdlc-knowledge-v0.2.0` tag (the next version after the §12 NFR-9 bump from 0.1.0 → 0.2.0), uploads all five binaries plus a source tarball to GitHub Releases, and updates `install.sh` to download the prebuilt binary as the PRIMARY path with `cargo_source_build_fallback` demoted to a true fallback (only invoked when the host platform is not in the matrix or the network is unavailable).

3. **Dogfood Section 3 on the SDLC core repo.** The SDLC core ships `templates/rules/changelog.md` to every downstream project (per Section 3 FR-4.4 and `templates/rules/changelog.md:37-39` "the presence of this file at `.claude/rules/changelog.md` is the sole signal the `changelog-writer` agent uses to decide whether to run; absence equals opt-out"). The SDLC core repo itself does NOT have `.claude/rules/changelog.md` — it ships the rule to others without using it. This section opts the SDLC core repo INTO its own feature: install the sentinel into the SDLC core's `.claude/rules/`, add a root `CHANGELOG.md` with `[Unreleased]` and the first dated section for this auto-release feature, and let the dogfooded pipeline produce the SDLC core's own release notes from this point forward.

**Why now.** This is the first iteration where ALL the pieces required to execute a real release exist:

- §11 ships the cross-platform workflow file (just needs a tag to fire).
- §12 ships the PDFium binary download path (just needs the companion `sdlc-knowledge` binary download to be primary).
- §6 (Changelog Release Packaging iter-2) ships the release-engineer agent that knows how to compute version bumps, rename `[Unreleased]`, and provision `release.yml` (just needs to be flipped to executing-mode).
- §7 (Resource Auto-Install iter-2) ships the four-tier authority model that gives release-engineer a known-good template for executing dangerous commands safely (just needs to be lifted into release-engineer's prompt).
- The `templates/rules/changelog.md` opt-in mechanism (Section 3 FR-4.4) ships and is the sole dependency for dogfooding.

Iter-3 connects these existing pieces into a working end-to-end pipeline. No new external dependencies. No new agents. No new gates. The 17-agent / 10-gate / 5-executor invariants are PRESERVED (FR-12 below).

**Two version trains.** This section operates over TWO independent version trains and must not conflate them:

- **`sdlc-knowledge` tool version** — currently `0.1.0` per `tools/sdlc-knowledge/Cargo.toml:3`, bumping to `0.2.0` per §12 NFR-9. Released under the `sdlc-knowledge-v<X.Y.Z>` tag scheme. Targets the `.github/workflows/sdlc-knowledge-release.yml` workflow already in the repo.
- **SDLC core version** — currently `2.1.0` per `install.sh:22`. Released under the bare `v<X.Y.Z>` tag scheme (the §6 release-engineer's default per `release-engineer.md:26` `Glob('.git/refs/tags/v*.*.*')`). Targets a NEW workflow file `.github/workflows/sdlc-core-release.yml` introduced by FR-11.

The two workflows share their trigger pattern, build-and-upload shape, and `softprops/action-gh-release@v2` step, but they fire on disjoint tag prefixes and produce disjoint GitHub Release pages. FR-11 below documents the dual-tag scheme explicitly so the Plan Critic does not flag it as a conflict.

### 13.2 User Stories

1. **As the maintainer of `codefather-labs/claude-code-sdlc` cutting the FIRST `sdlc-knowledge-v0.2.0` release**, I want the release-engineer agent at `/merge-ready` Gate 9 to execute `git tag -a sdlc-knowledge-v0.2.0 -F .claude/release-notes-0.2.0.md` and `git push origin sdlc-knowledge-v0.2.0` for me (after I approve the Sensitive-tier prompt) so the GitHub Actions release workflow at `.github/workflows/sdlc-knowledge-release.yml` finally fires on a real tag and uploads the five-platform binary set to GitHub Releases — closing the chicken-and-egg gap that has been silently blocking every `install.sh` invocation since §11 shipped.

2. **As a downstream developer working on a feature branch**, I want my project's `/merge-ready` Gate 9 to package the release locally (CHANGELOG date-stamp, release-notes file, version-source bump), automatically run a pre-push validation (typecheck + tests + lint), and then execute the actual `git tag` + `git push` for me when the project is opted in via `.claude/rules/auto-release.md` — so I do not have to copy-paste the structured-summary commands block by hand on every release.

3. **As a Linux-x64 user running `bash install.sh --yes` for the first time**, I want the installer to download the prebuilt `sdlc-knowledge-linux-x64` binary in under 60 seconds instead of forcing me to install Rust and wait for cargo to compile the binary from source — and when the prebuilt binary is unavailable for my platform (e.g., I am on a fresh musl-libc Alpine container), I want the cargo source-build fallback to kick in transparently with a clear log line.

4. **As a CI bot running `/merge-ready` in headless mode** (`AUTO_RELEASE=1` env var set, no interactive TTY), I want release-engineer to auto-execute Trivial-tier and Moderate-tier release commands without prompts (CHANGELOG rewrite, version-source bump, local annotated tag creation), but to refuse Sensitive-tier `git push` operations entirely under headless mode — mirroring `resource-architect.md`'s headless contract from §7 FR-5.5 — so an unattended pipeline cannot accidentally publish to a remote.

5. **As a multilingual project releasing a Russian-language `CHANGELOG.md`** (the project's `.claude/rules/changelog.md` is opted in, the changelog body is authored in Russian per the project's locale), I want the release-engineer agent to byte-preserve the Cyrillic content during the `[Unreleased]` → `[X.Y.Z]` rename and the release-notes file write — UTF-8 boundary safety mirrors §11 FR-2.3's chunker invariant, and the structured summary's commands block must not corrupt non-ASCII characters in `git tag -a -F <release-notes-file>`.

### 13.3 Functional Requirements

#### FR-1: Release-Engineer Executing Mode (Tier-Based Authority)

The release-engineer agent at `src/agents/release-engineer.md` is upgraded from suggest-only (current `## NEVER List` posture) to executing-mode under a four-tier authority gradation that mirrors `resource-architect.md:185-260` byte-for-byte in shape.

1. **FR-1.1: Tool allowlist expansion.** The agent's frontmatter `tools:` line MUST gain `Bash` (it currently lists `["Read", "Write", "Edit", "Glob", "Grep"]` per `release-engineer.md:4`). The frontmatter constraint that previously enforced "no Bash, no network" via tool removal is replaced by a prompt-body anchored-regex whitelist plus tier dispatch.

2. **FR-1.2: Four-tier authority gradation — verbatim.** Every release operation MUST be classified into exactly one of `Trivial | Moderate | Sensitive | Forbidden` per the same most-restrictive-applicable-tier rule defined at `resource-architect.md:222`. The release-engineer's tier table is:

   | # | Operation | Tier | Notes |
   |---|-----------|------|-------|
   | 1 | Rewrite `CHANGELOG.md` `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD` and insert fresh empty `[Unreleased]` | Trivial | Already in scope per §6; idempotent file-write |
   | 2 | Write `.claude/release-notes-<X.Y.Z>.md` | Trivial | New file under project CWD; reversible by deletion |
   | 3 | Provision `.github/workflows/release.yml` when ABSENT | Trivial | Already in scope per §6; idempotent file-write |
   | 4 | Bump version-source file (`package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`) | Moderate | Mutates the project's lockfile reference; per-item approval |
   | 5 | `git add CHANGELOG.md release-notes-<X.Y.Z>.md` + `git commit -m "chore(release): <X.Y.Z>"` | Moderate | Local-only mutation; per-item approval |
   | 6 | `git tag -a <prefix>v<X.Y.Z> -F .claude/release-notes-<X.Y.Z>.md` (annotated local tag) | Moderate | Local-only mutation; per-item approval |
   | 7 | `git push origin <branch>` (push current branch) | Sensitive | Remote mutation; explicit user approval; refused under `AUTO_RELEASE=1` headless |
   | 8 | `git push origin <prefix>v<X.Y.Z>` (push tag — fires the GH Actions workflow) | Sensitive | Remote mutation; explicit user approval; refused under `AUTO_RELEASE=1` headless |
   | 9 | `gh release create` (manual GH Release page mutation) | Forbidden | The GH Actions workflow file does this on tag push; manual `gh release create` is redundant and bypasses CI verification — never executed |
   | 10 | `npm publish` / `cargo publish` / `gem push` / `pypi upload` / `twine upload` | Forbidden | Public-registry publication; iter-3 OUT OF SCOPE per 13.7 item 1 |
   | 11 | Force-push (`git push --force` / `git push -f` / `git push +<ref>`) | Forbidden | Destructive remote-state mutation; never executed |
   | 12 | `git push origin main` / `git push origin master` (push to default branch) | Sensitive | Direct-to-default-branch push; explicit user approval; refused under headless mode |

   When a recommendation matches multiple rows, apply the most-restrictive-applicable-tier (verbatim contract from `resource-architect.md:222`).

3. **FR-1.3: Anchored-regex whitelist (defense-in-depth).** Before executing ANY shell command via `Bash`, the agent MUST validate the command against a hardcoded anchored-regex whitelist. The whitelist is a list of `^...$` regexes; commands that do not exactly match an entry are REFUSED with the literal stderr line `error: command not in release-engineer whitelist: <command>` and the run aborts. The eight anchored regexes are: (a) `^git add CHANGELOG\.md( \.claude/release-notes-[0-9]+\.[0-9]+\.[0-9]+\.md)?$`; (b) `^git commit -m "chore\(release\): [0-9]+\.[0-9]+\.[0-9]+"$`; (c) `^git tag -a (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+ -F \.claude/release-notes-[0-9]+\.[0-9]+\.[0-9]+\.md$`; (d) `^git push origin (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+$`; (e) `^git push origin (feat|fix|chore)/[a-z0-9-]+$`; (f) `^npm version (patch|minor|major)$`; (g) `^cargo set-version [0-9]+\.[0-9]+\.[0-9]+$`; (h) `^poetry version (patch|minor|major|[0-9]+\.[0-9]+\.[0-9]+)$`. Any command containing shell metacharacters (`;`, `&&`, `||`, `|`, `` ` ``, `$(`, `>`, `<`) MUST be REFUSED unconditionally — the agent never composes commands; it executes literal patterns from the whitelist.

4. **FR-1.4: Headless contract (`AUTO_RELEASE=1`).** When the environment variable `AUTO_RELEASE=1` is set, the agent operates in headless mode mirroring `resource-architect.md`'s headless contract per §7 FR-5.5:
   - **Trivial** operations execute without prompt.
   - **Moderate** operations execute without prompt (no per-item approval needed; the env var is the implicit batch approval signal).
   - **Sensitive** operations are REFUSED with the literal line `aborted-headless-sensitive: <operation> requires interactive approval; rerun without AUTO_RELEASE=1` and the run exits 0 (NOT 1 — headless skip is not an error per §7 FR-5.5 contract). The structured summary's `Warnings` section records the skipped operation so a human follow-up run can complete it.
   - **Forbidden** operations are REFUSED unconditionally (independent of headless state) with the literal line `aborted-forbidden: <operation> never executed`.

   When `AUTO_RELEASE` is unset or set to any value other than the literal string `1`, the agent operates in interactive mode and prompts on each Sensitive-tier operation.

5. **FR-1.5: Per-tier prompt format (interactive mode).** For each Sensitive-tier operation in interactive mode, the agent MUST emit a labeled prompt of the form:
   ```
   [Sensitive — release-engineer] About to execute: <verbatim-command>
     Tier rationale: <one-line tier table justification from FR-1.2>
     Reversibility: <e.g., "git tag -d <tag> + git push origin --delete <tag>" | "non-reversible without remote support">
   Approve? [y/N]:
   ```
   The exact byte shape mirrors `resource-architect.md`'s per-item approval prompt format (anchored to enable Plan Critic grep). A response other than the literal lowercase `y` followed by newline is treated as DENY and the operation is skipped per FR-1.4 Sensitive-skip semantics.

6. **FR-1.6: Authority Boundary expansion.** The current `release-engineer.md:32-59` `## Authority Boundary` is updated to add a fourth set: EXECUTE-allowed paths (the project CWD's `.git/` for `git tag`/`git push` operations through Bash; the project's version-source file via project-specific bumper commands per FR-1.3 entry (f)/(g)/(h)). The previously WRITE-allowed and READ-only sets are PRESERVED byte-for-byte. The previously FORBIDDEN set EXPANDS to add `npm publish`, `cargo publish`, `gem push`, `pypi upload`, `twine upload`, `gh release create`, force-push variants — these are the FR-1.2 row 9-11 operations.

7. **FR-1.7: NEVER List shrinkage.** The current `release-engineer.md:67-84` `## NEVER List` (13 forbidden commands) is REWRITTEN to enumerate only the FR-1.2 Forbidden-tier operations (rows 9-11): registry publishes, force-pushes, `gh release create`. The other commands (`git push`, `git tag`, `git push origin <tag>`) move from NEVER to Sensitive-tier with explicit-approval semantics. This is the central behavior change of FR-1.

8. **FR-1.8: Output Contract preserved.** The agent's structured 10-section summary contract from `release-engineer.md:118+` is PRESERVED. The `Commands to run` section is no longer purely informational — it now ALSO indicates which commands the agent has executed in the current run vs. which remain for the developer (e.g., for a Sensitive-tier skip under headless mode). A new `Tier breakdown` section is appended after `Warnings` summarizing how many operations fired in each tier this run (`<N> Trivial; <N> Moderate; <N> Sensitive (auto-approved); <N> Sensitive (skipped); <N> Forbidden (refused)`), mirroring the §7 FR-2.5 breakdown line shape.

#### FR-2: CHANGELOG → Tag Annotation → GitHub Release Body Pipeline

The release pipeline is wired end-to-end so the CHANGELOG `[X.Y.Z]` body becomes the tag annotation message AND the GitHub Release page body, with no intermediate hand-editing.

1. **FR-2.1:** When `release-engineer` renames `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD` per §6 FR-2 (UNCHANGED), it MUST also write a new file at `.claude/release-notes-<X.Y.Z>.md` containing the body of the freshly renamed `[X.Y.Z]` section verbatim (category subheadings + entries; NOT the `[X.Y.Z] - YYYY-MM-DD` heading itself). This mirrors the existing §6 contract — UNCHANGED in shape.

2. **FR-2.2:** The annotated tag created via `git tag -a <prefix>v<X.Y.Z> -F .claude/release-notes-<X.Y.Z>.md` (FR-1.2 row 6) MUST consume the release-notes file as the tag message. Per `git-tag(1)` documentation, `-F <file>` reads the message verbatim including UTF-8 multibyte characters; the multilingual user story (§13.2 #5) depends on this UTF-8 preservation.

3. **FR-2.3:** The GitHub Actions release workflow's `softprops/action-gh-release@v2` step MUST set its `body_path:` field to `.claude/release-notes-<X.Y.Z>.md` (relative to the repo root) so the GitHub Release page body is the same byte content as the CHANGELOG `[X.Y.Z]` body and the tag annotation. Per FR-11.1 below, BOTH workflow files (`sdlc-knowledge-release.yml` and `sdlc-core-release.yml`) get this addition.

4. **FR-2.4:** The release-notes file MUST NOT be mutated after tag-creation. Once the tag exists, the file is immutable — re-running `/merge-ready` on an already-released version produces the SKIPPED outcome per §6 FR-7.2 (CHANGELOG `[Unreleased]` is empty after the prior run); the existing file at `.claude/release-notes-<X.Y.Z>.md` is left in place as historical record.

#### FR-3: Cross-Platform Binary Matrix — Add Windows-x64

The §11 FR-11 / §12 FR-7 matrix expands from four platforms to five, adding `windows-x64`.

1. **FR-3.1:** `.github/workflows/sdlc-knowledge-release.yml:62-75` matrix `include:` MUST gain a fifth entry: `platform: windows-x64`, `runs-on: windows-latest`, `target: x86_64-pc-windows-msvc`. The existing four entries are BYTE-UNCHANGED.

2. **FR-3.2:** The `Determine pdfium asset name` step at `sdlc-knowledge-release.yml:91-101` MUST gain a fifth case branch: `windows-x64) echo "asset=pdfium-win-x64.tgz" >> "$GITHUB_OUTPUT" ;;`. The four existing branches are BYTE-UNCHANGED. (The `bblanchon/pdfium-binaries` upstream ships `pdfium-win-x64.tgz` per the same release scheme as the four existing assets — verified: no — assumption per `## Facts` below.)

3. **FR-3.3:** The `Download pdfium dynamic library` step at `sdlc-knowledge-release.yml:103-116` MUST work on Windows runners. The `shell: bash` directive (already on the step per line 107) routes through `bash` even on `windows-latest` (Git for Windows is preinstalled on the runner), so the `curl` + `tar` + `find` + `cp` invocations work without modification. The library extraction target `$HOME/.claude/tools/sdlc-knowledge/pdfium/lib/` MUST resolve to the user's Windows home path (`C:/Users/runneradmin/.claude/...`). The library filename on Windows is `pdfium.dll` (NOT `libpdfium.dll`) — the `find -name 'libpdfium*'` glob at line 115 MUST be widened to `-name 'pdfium*' -name 'libpdfium*'` style alternation to capture both naming conventions.

4. **FR-3.4:** The `Cargo build (release)` step MUST work on `windows-latest` with target `x86_64-pc-windows-msvc`. This requires the MSVC toolchain (`cl.exe` linker) — `dtolnay/rust-toolchain@stable` per `sdlc-knowledge-release.yml:81-83` configures `cargo` for the target but does not install MSVC; the `windows-latest` runner image preinstalls the Visual Studio 2022 Build Tools, so the linker is available without a separate setup step. **Verified: no — assumption** per `## Facts`.

5. **FR-3.5:** The artifact upload at `sdlc-knowledge-release.yml:163-176` MUST stage the Windows binary at `dist/sdlc-knowledge-windows-x64.exe` (NOTE: the `.exe` suffix — Cargo emits the binary with the `.exe` extension on `*-pc-windows-*` targets; the staging copy line at 168 MUST use `cp "$BIN.exe" "dist/sdlc-knowledge-${{ matrix.platform }}.exe"` for the Windows branch, gated by an `if: matrix.platform == 'windows-x64'` step or by inline shell branching).

6. **FR-3.6:** The release job's `files:` list at `sdlc-knowledge-release.yml:208-213` MUST gain a fifth line: `dist/sdlc-knowledge-windows-x64/sdlc-knowledge-windows-x64.exe`. The four existing lines are BYTE-UNCHANGED.

7. **FR-3.7:** The release job MUST ALSO upload a source tarball asset (`sdlc-knowledge-source-<X.Y.Z>.tar.gz`) created by `git archive --format=tar.gz --prefix=sdlc-knowledge-<X.Y.Z>/ -o dist/sdlc-knowledge-source-<X.Y.Z>.tar.gz HEAD` so users on platforms not in the matrix (e.g., FreeBSD, Alpine musl, linux-arm32) can build from source via `cargo install --path .` after extraction. The source tarball is appended to the `files:` list as the sixth asset.

#### FR-4: install.sh Prebuilt-Binary Download Path (Replace Cargo as Primary)

`install.sh:332-406` `install_knowledge_binary` is updated so the prebuilt-binary download is the PRIMARY path (no longer falls through to `cargo_source_build_fallback` on every install) once the first release tag exists.

1. **FR-4.1:** `install.sh:354-363` `case "$(uname -ms)"` MUST gain a fifth branch: `"MINGW64_NT-* x86_64") platform="windows-x64" ;;`. The existing four branches are BYTE-UNCHANGED. (Git Bash on Windows reports `uname -s` as `MINGW64_NT-10.0` or similar — verified: no — assumption per `## Facts`. If the actual `uname -s` shape on Windows runners differs, the architect Step 3 picks the correct allowlist pattern before Slice 4 ships.)

2. **FR-4.2:** The asset URL at `install.sh:368` constructs `https://github.com/${owner_repo}/releases/download/sdlc-knowledge-v${KNOWLEDGE_VERSION}/sdlc-knowledge-${platform}` — UNCHANGED in shape. After FR-5 below fixes `REPO_URL` to `codefather-labs/claude-code-sdlc.git` and FR-6 below cuts the FIRST `sdlc-knowledge-v0.2.0` tag, the URL resolves to a real asset on every fresh install.

3. **FR-4.3:** For the Windows branch, the asset URL MUST append `.exe` to the platform suffix: `sdlc-knowledge-windows-x64.exe`. The existing four platforms append nothing (the binaries are extension-less on Unix). Conditional construction MUST be done with an `if [ "$platform" = "windows-x64" ]; then suffix=".exe"; else suffix=""; fi` block before URL composition.

4. **FR-4.4:** The `cargo_source_build_fallback` at `install.sh:411` is PRESERVED byte-for-byte as the secondary path. It is invoked only when (a) the prebuilt-binary download fails (network outage, asset 404, sha256 mismatch in iter-4), (b) the host platform is not in the FR-4.1 allowlist (e.g., FreeBSD, linux-arm32), or (c) `--version` smoke-test fails on the downloaded binary per `install.sh:396-401`. The fallback's existence is the safety net that lets the prebuilt path be PRIMARY without breaking edge-case platforms.

5. **FR-4.5:** Re-running `bash install.sh --yes` on a host where `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` already returns the `KNOWLEDGE_VERSION` string MUST be a no-op (no re-download, no rebuild) per `install.sh:343-350` (UNCHANGED idempotency check).

6. **FR-4.6:** When the prebuilt binary download succeeds, the install summary at the end of `install.sh` MUST report the platform tag and the resolved release version (e.g., `tools/sdlc-knowledge/sdlc-knowledge (linux-x64 — sdlc-knowledge-v0.2.0 prebuilt)`). When the cargo-source fallback runs, the summary continues to report `tools/sdlc-knowledge/sdlc-knowledge (built from source)` per `install.sh:441` (UNCHANGED).

#### FR-5: install.sh REPO_URL Fix

The pre-existing bug at `install.sh:25` is fixed in lock-step with the auto-release feature so the FR-4 download path resolves to the correct GitHub owner.

1. **FR-5.1:** `install.sh:25` MUST change from `REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"` to `REPO_URL="https://github.com/codefather-labs/claude-code-sdlc.git"`. The change is one line.

2. **FR-5.2:** The Quick install URL in the comment block at `install.sh:12` (`curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash`) MUST be updated to `curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash` for consistency.

3. **FR-5.3:** All other occurrences of the literal string `Koroqe` in the repo MUST be audited. `grep -r 'Koroqe' .` MUST return zero matches after this section ships. (Pre-flight verification: a single `grep` over the repo at section-author time identifies any other occurrences for the implementer to fix in Slice 5.)

4. **FR-5.4:** The fix is BACKWARD-INCOMPATIBLE for any existing checkout that hardcoded the old `REPO_URL` value (e.g., a maintainer's local script that read `REPO_URL` and forwarded it elsewhere). Risk R-3 below documents the migration. A repo-root `MIGRATION.md` SHOULD note "if you forked the repo before <merge-date>, update your local checkout's `install.sh:25` REPO_URL to `codefather-labs/claude-code-sdlc.git`".

5. **FR-5.5:** README.md badges, Quick install instructions, and any other top-level documentation referencing the old GitHub owner MUST be updated. The README taglines at lines 5 and 35 MUST be BYTE-UNCHANGED (consistent with §11 FR-12.1 / FR-12.2 / §12 FR-9.4).

#### FR-6: Bootstrap First Release for sdlc-knowledge Tool

A one-shot bootstrap pass cuts the FIRST `sdlc-knowledge-v0.2.0` tag (resolving R-7 below — the same chicken-and-egg risk that §11 R-2 / §12 R-2 documented but did not action).

1. **FR-6.1:** A new `install.sh` function `bootstrap_first_release` MUST be added (at the end of the install.sh function block, before the `# Main` section). It is invoked ONLY when `--bootstrap-release <X.Y.Z>` is passed as a command-line flag — it is NOT invoked on a normal install. The flag is documented in `print_help` at `install.sh:47-80`.

2. **FR-6.2:** The bootstrap function MUST verify pre-conditions: (a) the current directory is the SDLC core repo (heuristic: `Cargo.toml` exists at `tools/sdlc-knowledge/Cargo.toml` AND `.git` exists at the repo root); (b) the working tree is clean (`git status --porcelain` returns empty); (c) the supplied `<X.Y.Z>` matches the version in `tools/sdlc-knowledge/Cargo.toml:3` (so the tag is consistent with the source tree). Failure on any pre-condition exits 1 with a clear stderr message and DOES NOT mutate state.

3. **FR-6.3:** The bootstrap function MUST execute the FR-1.2 Sensitive-tier sequence: (a) create `.claude/release-notes-<X.Y.Z>.md` from a brief stub summarizing the iter-1 + iter-2 + iter-3 cumulative changes (the maintainer hand-edits this stub before the next step); (b) `git tag -a sdlc-knowledge-v<X.Y.Z> -F .claude/release-notes-<X.Y.Z>.md`; (c) `git push origin sdlc-knowledge-v<X.Y.Z>`. The bootstrap-flag invocation BYPASSES the `release-engineer` agent (the agent is for release-engineer Gate 9 in normal `/merge-ready` runs); the bootstrap is a one-time install.sh operation gated by the `--bootstrap-release` flag.

4. **FR-6.4:** The bootstrap function MUST emit the literal warning `[BOOTSTRAP] this is a one-time first-release operation; subsequent releases use /merge-ready Gate 9 with release-engineer in executing mode (FR-1)` to stderr before executing the tag/push. This signals to the maintainer that the next release flows through release-engineer, not through `--bootstrap-release`.

5. **FR-6.5:** The bootstrap flag MUST NOT push if the user replies anything other than `y` to the literal prompt `[BOOTSTRAP] About to execute: git push origin sdlc-knowledge-v<X.Y.Z> — this fires the GH Actions release workflow at .github/workflows/sdlc-knowledge-release.yml. Approve? [y/N]:`. The prompt format mirrors FR-1.5.

#### FR-7: SDLC Core CHANGELOG Opt-In

The SDLC core repo opts INTO the changelog feature it ships to downstream projects, dogfooding Section 3.

1. **FR-7.1:** The file `.claude/rules/changelog.md` MUST be created at the SDLC core repo root, byte-identical to `templates/rules/changelog.md` (line-by-line copy). This is the activation sentinel per `templates/rules/changelog.md:37-39`.

2. **FR-7.2:** A new file `.claude/rules/auto-release.md` MUST be created at the SDLC core repo root, codifying the executing-mode contract from FR-1 in rule form. Contents: the FR-1.2 tier table, the FR-1.3 anchored-regex whitelist, the FR-1.4 headless contract, and the FR-1.5 prompt format. The file is the runtime source-of-truth for the release-engineer's executing-mode behavior; the agent prompt at `src/agents/release-engineer.md` references it.

3. **FR-7.3:** `templates/rules/auto-release.md` MUST be created as a sibling to `templates/rules/changelog.md`, byte-identical to FR-7.2's `.claude/rules/auto-release.md`. The template is what `install.sh --init-project` installs into downstream projects. Like the changelog rule (Section 3 FR-4.4), the presence of `.claude/rules/auto-release.md` in a downstream project is the OPT-IN sentinel — absence preserves §6's suggest-only behavior byte-for-byte.

4. **FR-7.4:** A new `CHANGELOG.md` MUST be created at the SDLC core repo root with two sections: (a) `## [Unreleased]` (empty); (b) `## [3.0.0] - 2026-04-26 — Auto-Release Pipeline` (per Section 3 Keep-a-Changelog format) summarizing FR-1 through FR-12 of THIS section in user-facing language. The version `3.0.0` reflects the major-version bump from the current `install.sh:22 VERSION="2.1.0"` because executing-mode flips a previously suggest-only contract — this is a breaking authority-boundary change and SemVer demands a major bump.

5. **FR-7.5:** `install.sh:22` MUST be updated from `VERSION="2.1.0"` to `VERSION="3.0.0"` to match FR-7.4. The `print_help` cat-heredoc at `install.sh:48-80` MUST also have its first line updated from `Claude Code SDLC Installer v2.1.0` to `Claude Code SDLC Installer v3.0.0`.

6. **FR-7.6:** The README.md MUST be updated to add ONE row to the existing Hardening table referencing this iter-3 auto-release feature. The README taglines at lines 5 and 35 MUST be BYTE-UNCHANGED (consistent with FR-12 invariants).

#### FR-8: Pre-Push Integration

Gate 9 release-engineer runs as part of `/merge-ready` AND a lightweight pre-push validation runs before any `git push` invocation in downstream projects.

1. **FR-8.1:** A new pre-push validation function `pre_push_validate` MUST be added to the release-engineer's executing-mode flow. It runs IMMEDIATELY before any FR-1.2 row 7 / row 8 (`git push origin <branch>` / `git push origin <tag>`) execution. The validation runs the project's typecheck, test, and lint commands as specified in `./CLAUDE.md` `## Commands` section (the same conventions consumed by `build-runner` at Gate 6).

2. **FR-8.2:** Validation failure MUST abort the push. The agent emits `pre-push validation failed: <command> exited <N>` and skips the push (Sensitive-tier deny semantics per FR-1.4). The CHANGELOG / release-notes / tag artifacts already created in earlier FR-1.2 rows are PRESERVED — they are local mutations and the developer can fix the validation failure and re-run `/merge-ready` (the prior tag is reused; tag creation is idempotent because `git tag -a <name>` exits non-zero if the tag exists, and the release-engineer detects this and reuses the existing tag).

3. **FR-8.3:** Pre-push validation is OPTIONAL for the SDLC core repo itself (no `npm test` / `pytest` / `cargo test` setup at the repo root because the SDLC core ships markdown agent prompts, not application code; the only Rust crate is `tools/sdlc-knowledge/`). When the project root has no `## Commands` block in `./CLAUDE.md`, the validation is SKIPPED with the literal log line `pre-push validation skipped: no Commands block in ./CLAUDE.md`.

4. **FR-8.4:** Pre-push validation MUST NOT make network calls or run E2E tests. Only typecheck + unit-test + lint commands are in scope (the same commands `build-runner` runs at Gate 6). E2E tests (Gate 7) are explicitly OUT OF SCOPE for pre-push because they are slow, often require external services, and Gate 7 has already passed by the time release-engineer runs at Gate 9.

5. **FR-8.5:** Downstream projects SHOULD additionally install a git pre-push hook at `.git/hooks/pre-push` that re-runs the FR-8.1 validation as a defense-in-depth layer (catches manual `git push` invocations that bypass `/merge-ready`). The hook installation is OPTIONAL and is invoked by `install.sh --init-project` when the user is opted INTO auto-release per FR-7.3. The hook script is shipped at `templates/hooks/pre-push` and is a thin wrapper over the project's `npm test` / `pytest` / `cargo test` (same convention as FR-8.1).

#### FR-9: Headless CI Contract

The agent's behavior under CI invocation (`AUTO_RELEASE=1`) is fully specified per FR-1.4 above; this FR consolidates the CI-specific guarantees.

1. **FR-9.1:** A CI bot running `/merge-ready` with `AUTO_RELEASE=1` set MUST be able to complete the entire Gate 9 flow (CHANGELOG rewrite + version bump + commit + local tag) WITHOUT prompts and WITHOUT pushing the tag. The pushed-tag operation is Sensitive and is REFUSED under headless mode per FR-1.4.

2. **FR-9.2:** The structured summary's `Commands to run` section under headless mode MUST list the un-executed Sensitive-tier commands (the `git push` lines) so a downstream human run can pick them up. The summary's `Tier breakdown` section per FR-1.8 reports `<N> Sensitive (skipped)`.

3. **FR-9.3:** Headless mode MUST NOT inject any auto-detection of CI environment variables (no checking for `CI=true` / `GITHUB_ACTIONS=true` / `GITLAB_CI=true`). Activation is GATED EXPLICITLY by `AUTO_RELEASE=1` only. This prevents accidental headless behavior on developer laptops where CI tools occasionally set `CI=true`.

4. **FR-9.4:** When `AUTO_RELEASE=1` is set AND `.claude/rules/auto-release.md` is ABSENT in the project, the agent operates in suggest-only mode (the FR-7.3 sentinel gates the entire executing-mode behavior; absence equals opt-out per Section 3 precedent). The headless contract is layered on top of the opt-in sentinel — both must be present for headless executing-mode.

#### FR-10: Bash Whitelist for Git Tag/Push (Defense-in-Depth)

The `~/.claude/settings.json` Bash allowlist gains explicit entries for the FR-1.3 anchored regexes, mirroring `install.sh:447-484` `register_bash_allowlist` from §11 Slice 5 and `resource-architect.md` FR-5.4.

1. **FR-10.1:** `install.sh` MUST gain a new function `register_release_bash_allowlist` (sibling to `register_bash_allowlist` at line 447) that adds the FR-1.3 whitelist entries to `~/.claude/settings.json`. The eight entries match the FR-1.3 anchored regexes verbatim — `git add CHANGELOG.md *`, `git commit -m "chore(release): *"`, `git tag -a *`, `git push origin v*`, `git push origin sdlc-knowledge-v*`, `git push origin feat/*`, `git push origin fix/*`, `git push origin chore/*` (Claude Code's allowlist syntax uses `*` glob, not regex anchors — the regex anchors are enforced INSIDE the agent's prompt body per FR-1.3, the allowlist is the OUTER defense-in-depth gate).

2. **FR-10.2:** The function MUST be invoked from `# Main` block at `install.sh:619` AFTER `register_bash_allowlist` (line 620) so both knowledge-base and release-engineer allowlists are written. The function is invoked unconditionally on a normal `bash install.sh` run (it only adds entries for the release-engineer; whether the agent uses them is gated by the FR-7.3 sentinel).

3. **FR-10.3:** The function MUST follow the same jq-based atomic merge pattern as `register_bash_allowlist` per `install.sh:463-483` — fail-closed if `jq` is absent, idempotent on re-run via `unique` deduplication. Settings file format (`{"permissions":{"allow":[...]}}`) is BYTE-UNCHANGED.

#### FR-11: Dual-Tag Scheme — sdlc-knowledge-v\* vs v\*

The two version trains (`sdlc-knowledge` tool and SDLC core) MUST each have their own GitHub Actions release workflow firing on disjoint tag prefixes.

1. **FR-11.1:** The existing `.github/workflows/sdlc-knowledge-release.yml` (triggered on `sdlc-knowledge-v*` per line 16) is PRESERVED with FR-3 additions (Windows branch, source tarball). Trigger pattern UNCHANGED.

2. **FR-11.2:** A new workflow file `.github/workflows/sdlc-core-release.yml` MUST be added, triggered on `v*` tag pushes (matching the bare `v<X.Y.Z>` scheme per `release-engineer.md:26`). The workflow's job is simpler than `sdlc-knowledge-release.yml` because the SDLC core ships markdown agent prompts (not Rust binaries):
   - Job 1: actionlint self-check (mirrors `sdlc-knowledge-release.yml:33-43`).
   - Job 2: package the SDLC core as a source tarball: `git archive --format=tar.gz --prefix=claude-code-sdlc-<X.Y.Z>/ -o claude-code-sdlc-<X.Y.Z>.tar.gz HEAD`.
   - Job 3: upload the tarball and `install.sh` (standalone) to GitHub Releases via `softprops/action-gh-release@v2` with `body_path: .claude/release-notes-<X.Y.Z>.md` and `tag_name: ${{ github.ref_name }}`.

3. **FR-11.3:** The two workflows MUST NOT share the `concurrency` group (`sdlc-knowledge-release-${{ github.ref }}` for the tool workflow; `sdlc-core-release-${{ github.ref }}` for the core workflow) so a tool release and a core release in the same time window do not cancel each other.

4. **FR-11.4:** The two workflows have DIFFERENT trigger filters: `sdlc-knowledge-v*` is strictly more specific than `v*`. A `sdlc-knowledge-v0.2.0` tag MUST NOT fire the SDLC-core workflow — `v*` is a glob, but `sdlc-knowledge-v*` does NOT match `v*` (the prefix is not `v`). GitHub Actions tag filters are literal-prefix globs; this disjointness is verified by the GH Actions tag-filter contract.

5. **FR-11.5:** The `release-engineer` agent's tag-prefix detection MUST disambiguate the two trains. When invoked at `/merge-ready` Gate 9 in the SDLC core repo with the version-source pointing at `tools/sdlc-knowledge/Cargo.toml`, the agent MUST emit a Sensitive-tier prompt that explicitly states which workflow will fire (e.g., `tag prefix: sdlc-knowledge-v — will fire .github/workflows/sdlc-knowledge-release.yml`) so the maintainer cannot accidentally cut a tool release expecting a core release.

#### FR-12: Invariants Enforced

Iter-3 is an authority-boundary upgrade plus a binary matrix expansion plus a dogfood opt-in. The agent count, gate count, executor count, and README taglines are PRESERVED.

1. **FR-12.1: 17 agents UNCHANGED.** `ls src/agents/*.md | wc -l` MUST return 17. No agent file is added; no agent file is removed. The release-engineer prompt is REWRITTEN per FR-1 but the file path and frontmatter `name:` field are BYTE-UNCHANGED.

2. **FR-12.2: 10 gates UNCHANGED.** `grep -Fxc "10 quality gates" README.md` MUST return ≥ 1. Gate 9 (Release Packaging) is the only gate this section touches; its semantics change from suggest-only to executing-mode, but it remains a single gate at position 9 in the gate sequence.

3. **FR-12.3: 5 executors UNCHANGED.** The five executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) are BYTE-UNCHANGED. This section makes no edits to executor prompts.

4. **FR-12.4: README taglines UNCHANGED.** README.md lines 5 and 35 (the two taglines) are BYTE-UNCHANGED, consistent with §11 FR-12.1 / §12 FR-9.4.

5. **FR-12.5: TEMPLATES UNCHANGED — INTENTIONAL RELAXATION.** Iter-1 (§11) and iter-2 (§12) preserved the `templates/` directory byte-for-byte except for `templates/rules/changelog.md` which was added by Section 3. THIS section relaxes that invariant by adding `templates/rules/auto-release.md` (FR-7.3) and `templates/hooks/pre-push` (FR-8.5). The relaxation is INTENTIONAL and is the dogfood mechanism that makes auto-release available to downstream projects via `install.sh --init-project`. The Plan Critic SHOULD NOT flag this as a templates-invariant violation; this PRD section is the authoritative scope expansion.

6. **FR-12.6: Cognitive self-check UNCHANGED.** `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED. The in-scope agent list (12 thinking) and exempt list (5 executors) are unchanged. Release-engineer is in the 12-thinking list and continues to emit `## Facts` blocks per Section 9.

7. **FR-12.7: §11 / §12 invariants UNCHANGED.** All §11 FR-9 and §12 FR-9 invariants remain in force: five `sdlc-knowledge` subcommands (`ingest`, `search`, `list`, `status`, `delete`), `--project-root` security gate, JSON output shape, `knowledge-base:` citation literal, FTS5 + WAL schema, agent activation block in 12 thinking agents.

8. **FR-12.8: SDLC core CHANGELOG.md is NEW — INTENTIONAL.** The repo root has no `CHANGELOG.md` today (`ls /Users/aleksandra/Documents/claude-code-sdlc/CHANGELOG.md` returns no such file). FR-7.4 ADDS this file. The Plan Critic SHOULD NOT flag the new file as a "files-not-listed-in-affected-files" gap; it is enumerated explicitly in 13.8 below.

### 13.4 Non-Functional Requirements

1. **NFR-1: Tag-creation latency.** Local tag creation (FR-1.2 row 6) MUST complete in ≤ 30 s on a 2024-class developer laptop. This excludes the upstream CI build time (FR-3 + FR-11) which runs ASYNCHRONOUSLY on GitHub Actions after the tag is pushed and is bounded by NFR-5 below.

2. **NFR-2: install.sh prebuilt-binary download latency.** `bash install.sh --yes` on each of the five supported platforms MUST produce a working `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` binary in ≤ 60 s when the network is reachable and the asset exists at the FR-4.2 URL. (Inherited from §11 AC-3 / NFR-1.4 — the four existing platforms retain their existing budget; Windows-x64 is the new platform.)

3. **NFR-3: Backward compatibility — opt-out preserves suggest-only.** Projects WITHOUT `.claude/rules/auto-release.md` MUST receive the §6 byte-identical suggest-only behavior. The release-engineer's structured 10-section summary, the FORBIDDEN list semantics, the no-Bash posture (well — `Bash` is now in `tools:` per FR-1.1 but the agent self-restricts from invoking it absent the sentinel) all match §6 contracts when the sentinel is absent. This is the headline backward-compat contract and is exercised by AC-8 below.

4. **NFR-4: Tier-based dispatch matches resource-architect contract.** The four-tier model (Trivial / Moderate / Sensitive / Forbidden), the most-restrictive-applicable rule, the anchored-regex whitelist (defense-in-depth), and the headless contract (`AUTO_RELEASE=1`) MUST match the §7 FR-5 shape byte-for-byte where they overlap. The same Plan Critic enforcement that flags `resource-architect` malformed tier strings (§7 FR-5.3 / Section 4 / `src/CLAUDE.md` Plan Critic rules) MUST apply to release-engineer's tier emissions.

5. **NFR-5: Cross-platform CI matrix wall-clock.** The full `.github/workflows/sdlc-knowledge-release.yml` matrix run (5 platform builds + actionlint + release job) on a tagged `sdlc-knowledge-v*` push MUST complete in ≤ 15 min. The four existing platforms currently complete in ~6-10 min on `fail-fast: false` per the iter-1 / iter-2 release procedures; Windows MSVC builds are typically slower due to MSVC link time. The 15 min budget gives headroom for Windows.

6. **NFR-6: Windows binary size.** The Windows binary `sdlc-knowledge-windows-x64.exe` MUST be ≤ 12 MB after `strip = true` and `lto = true` per `tools/sdlc-knowledge/Cargo.toml:34-38` (UNCHANGED profile flags from §11 NFR-1.1 / §12 NFR-1). The 12 MB budget is LOOSER than the 10 MB Linux/macOS budget per `sdlc-knowledge-release.yml:125-137` because Windows MSVC produces larger binaries due to runtime overhead (MSVCRT linkage, COFF section padding). The four existing platforms retain their 10 MB budget BYTE-UNCHANGED.

7. **NFR-7: UTF-8 boundary safety in CHANGELOG / release-notes.** The `[Unreleased]` → `[X.Y.Z]` rename and the release-notes file write MUST preserve UTF-8 multibyte character sequences byte-for-byte. The `git tag -a -F <file>` invocation MUST consume the file as UTF-8 without re-encoding. (Inherited contract from §11 FR-2.3 chunker UTF-8 safety; load-bearing for the multilingual user story 13.2 #5.)

8. **NFR-8: Determinism of tag annotation.** The same `[X.Y.Z]` CHANGELOG body, the same release-notes file, and the same upstream `softprops/action-gh-release@v2` step MUST produce a byte-identical GitHub Release page body across multiple invocations on the same tag. (Tag re-pushes are Forbidden per FR-1.2 row 11 force-push prohibition; this NFR is the contract for the FIRST push.)

9. **NFR-9: SDLC core version bump.** This feature triggers a MAJOR version bump on the SDLC core: `2.1.0` → `3.0.0` per FR-7.5. The major bump is justified because release-engineer flips from suggest-only to executing-mode, which is a breaking authority-boundary change visible to any user who has scripts depending on the agent's prior no-Bash, never-publishes posture.

### 13.5 Acceptance Criteria

1. **AC-1: Local tag creation works under release-engineer executing mode.** On the SDLC core repo with `.claude/rules/auto-release.md` present, running `/merge-ready` Gate 9 with non-empty `[Unreleased]` content produces, in ≤ 30 s, (a) a renamed `[X.Y.Z] - YYYY-MM-DD` CHANGELOG section, (b) a `.claude/release-notes-<X.Y.Z>.md` file, (c) a local annotated git tag `<prefix>v<X.Y.Z>` whose annotation message matches the release-notes file byte-for-byte. Verified via `git cat-file tag <tag-name>`.

2. **AC-2: Tag push fires the GH Actions release workflow.** After the maintainer approves the FR-1.5 Sensitive-tier prompt, `git push origin sdlc-knowledge-v0.2.0` completes successfully and the `.github/workflows/sdlc-knowledge-release.yml` workflow is observed firing within 5 min of the push (verified via `gh run list --workflow=sdlc-knowledge-release.yml`).

3. **AC-3: GitHub Release body matches CHANGELOG body.** The GitHub Release page for `sdlc-knowledge-v0.2.0` MUST display the contents of `.claude/release-notes-0.2.0.md` byte-for-byte (modulo GitHub's markdown rendering — the SOURCE bytes are identical). Verified by `gh release view sdlc-knowledge-v0.2.0 --json body --jq .body`.

4. **AC-4: Five-platform binary matrix produces five binaries plus source tarball.** After AC-2 fires, the `sdlc-knowledge-v0.2.0` GitHub Release page MUST list six release assets: `sdlc-knowledge-darwin-arm64`, `sdlc-knowledge-darwin-x64`, `sdlc-knowledge-linux-x64`, `sdlc-knowledge-linux-arm64`, `sdlc-knowledge-windows-x64.exe`, `sdlc-knowledge-source-0.2.0.tar.gz`. Each binary asset MUST be non-zero size; each platform binary MUST pass `<binary> --version` returning `sdlc-knowledge 0.2.0`.

5. **AC-5: install.sh prebuilt-binary download succeeds on each platform.** `bash install.sh --yes` on each of the five supported platforms produces `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (or `.exe` on Windows) of non-zero size in ≤ 60 s. The install summary MUST report `tools/sdlc-knowledge/sdlc-knowledge (<platform> — sdlc-knowledge-v0.2.0 prebuilt)` per FR-4.6.

6. **AC-6: install.sh fallback works when release is missing.** With network connectivity but the asset URL returning 404 (simulate by pointing `KNOWLEDGE_VERSION` at `99.99.99`), `bash install.sh --yes` MUST log the 404 warning, invoke `cargo_source_build_fallback`, and produce a working binary built from source. Verified by `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` returning `sdlc-knowledge 0.2.0`.

7. **AC-7: Headless CI mode skips Sensitive operations.** Setting `AUTO_RELEASE=1` and running `/merge-ready` Gate 9 with non-empty `[Unreleased]` content MUST produce: (a) the local CHANGELOG / release-notes / annotated-tag artifacts (Trivial + Moderate operations executed), (b) NO `git push` invocation (Sensitive operations refused), (c) the literal stderr line `aborted-headless-sensitive: git push origin <tag> requires interactive approval; rerun without AUTO_RELEASE=1`, (d) exit code 0 (headless skip is not an error), (e) Tier breakdown line `<N> Sensitive (skipped)`.

8. **AC-8: Opt-out backward compatibility.** With `.claude/rules/auto-release.md` ABSENT, running `/merge-ready` Gate 9 MUST produce the §6 byte-identical suggest-only output (structured 10-section summary; no Bash invocation; no tag creation). Compared against a §6 reference run on the same `[Unreleased]` content, the structured-summary OUTPUT bytes (excluding the timestamp) MUST be IDENTICAL. This is the headline backward-compat AC and is verified by a literal `diff` against a captured §6 baseline.

9. **AC-9: REPO_URL fixed end-to-end.** `grep -r 'Koroqe' .` on the SDLC core repo root returns ZERO matches after this section ships. The `bash install.sh --yes` install summary references `codefather-labs/claude-code-sdlc` consistently. The Quick install URL in `install.sh:12` resolves to a real `raw.githubusercontent.com` path returning HTTP 200.

10. **AC-10: SDLC core CHANGELOG.md present and dated.** The file `/Users/aleksandra/Documents/claude-code-sdlc/CHANGELOG.md` exists at the repo root after this section ships. It contains `## [Unreleased]` and `## [3.0.0] - 2026-04-26 — Auto-Release Pipeline` headings per FR-7.4. The `[3.0.0]` body summarizes FR-1 through FR-12 in user-facing language consistent with `templates/rules/changelog.md` audience rules (line 5: product owners and end users).

11. **AC-11: Release-engineer tier dispatch — verified per-tier counts.** A `/merge-ready` run that triggers (a) CHANGELOG rewrite (Trivial), (b) version-source bump (Moderate), (c) `git tag` creation (Moderate), (d) `git push origin <branch>` (Sensitive auto-approved), (e) `git push origin <tag>` (Sensitive auto-approved) MUST produce a Tier breakdown line reporting `1 Trivial; 2 Moderate; 2 Sensitive (auto-approved); 0 Sensitive (skipped); 0 Forbidden (refused)`. The breakdown line MUST be grep-able by Plan Critic per the §7 FR-2.5 / NFR-4 contract.

12. **AC-12: Multilingual CHANGELOG round-trips byte-for-byte.** A `[X.Y.Z]` CHANGELOG body containing Cyrillic characters (e.g., `### Добавлено\n- Поддержка автоматического выпуска релизов`) MUST round-trip byte-for-byte through release-notes-file write + `git tag -a -F` + `softprops/action-gh-release@v2` body. Verified by `gh release view <tag> --json body --jq .body` returning the source Cyrillic bytes verbatim.

13. **AC-13: Invariants preserved.** After this section ships: `ls src/agents/*.md | wc -l` returns 17; `grep -Fxc "10 quality gates" README.md` returns ≥ 1; `diff <(ls src/agents/{test-writer,build-runner,e2e-runner,doc-updater,changelog-writer}.md.pre-iter3) <(ls src/agents/{test-writer,build-runner,e2e-runner,doc-updater,changelog-writer}.md)` returns empty (executor-prompt bytes unchanged). README.md lines 5 and 35 are BYTE-UNCHANGED against a pre-iter3 git-show baseline.

### 13.6 Risks and Dependencies

1. **R-1: `git push` is destructive — wrong tier classification.** A misclassified operation in FR-1.2 (e.g., `git push origin main` accidentally tagged Trivial instead of Sensitive) would lead to unwanted publication. **Mitigation:** the FR-1.2 tier table is hard-coded in `src/agents/release-engineer.md` (not user-editable at runtime); the FR-1.3 anchored-regex whitelist is a defense-in-depth gate that REFUSES any command not exactly matching one of eight regexes; security-auditor pre-reviews the release-engineer rewrite slice; the `AUTO_RELEASE=1` headless contract REFUSES Sensitive operations entirely under unattended runs. Triple defense: tier classification + whitelist + headless deny.

2. **R-2: GitHub Actions release-workflow drift between `sdlc-knowledge-v*` and `v*` tag schemes.** A change to one workflow (e.g., bumping `softprops/action-gh-release@v2` to `@v3`) might silently miss the other. **Mitigation:** both workflows share a common subset (actionlint job, `softprops/action-gh-release` step shape); a repo-root `.github/workflows/_RELEASE_DRIFT_CHECK.md` documents the shared identifiers and is updated lock-step on workflow changes; FR-11.4 documents the trigger disjointness so a human reviewer can spot drift in PR review.

3. **R-3: `install.sh` REPO_URL change breaks pre-fix checkouts.** Anyone who forked the repo or deep-copied `install.sh` before FR-5.1 ships would see their local copy's `REPO_URL` continue to point at the old `Koroqe/...` URL. **Mitigation:** documented in FR-5.4 — repo-root `MIGRATION.md` notes the change; the impact is limited because the old URL was never functional (the Koroqe repo does not exist), so anyone affected was already in a broken state.

4. **R-4: SDLC core CHANGELOG retroactive backfill.** Should we backfill the CHANGELOG with historical sections for Feature 1-12 (which shipped before this opt-in), or start clean from `[3.0.0]` for the auto-release feature itself? **Mitigation:** RESOLVED — start clean from `[3.0.0]` per FR-7.4. Historical PRD sections (1-12) document the prior work; backfilling user-facing CHANGELOG entries for them is out of scope and would be a separate iter-4 pass if requested. The decision is justified because (a) most prior sections are internal infrastructure (cognitive-self-check, role-planner, resource-architect) that would be `skip — internal` per Section 3 audience rules, and (b) the changelog audience is product owners and end users who interact with iter-3 onward.

5. **R-5: Cross-platform binary build failures on uncommon edge cases.** glibc version mismatch on `linux-x64` (the `ubuntu-latest` runner uses glibc 2.35; users on glibc 2.31 fail the dynamic-link check), or MSVC runtime version mismatch on Windows (`vcruntime140.dll` not found). **Mitigation:** `cargo_source_build_fallback` per FR-4.4 is the universal escape hatch — when the prebuilt binary fails any smoke test, install.sh falls through to the source build. The fallback is explicitly tested in AC-6.

6. **R-6: Tag-collision (two parallel `develop-feature` runs both compute `v3.2.1`).** Two engineers running `/merge-ready` simultaneously could both compute the same next-version tag and try to push it. **Mitigation:** `git push origin <tag>` is atomic and the second push fails with `! [rejected] (already exists)`; the FR-8.2 pre-push validation surfaces the failure cleanly; the `concurrency:` group in the workflow file (`sdlc-knowledge-release-${{ github.ref }}`) cancels the second workflow invocation. Recovery is to bump the version-source by one and re-run `/merge-ready`.

7. **R-7: Chicken-and-egg first release.** RESOLVED — the maintainer one-shot bootstrap per FR-6 cuts the FIRST `sdlc-knowledge-v0.2.0` tag explicitly. Subsequent releases flow through `release-engineer` Gate 9 in executing mode. The bootstrap is documented as a one-time operation per FR-6.4.

8. **R-8: Revert/rollback semantics.** What happens if a published `sdlc-knowledge-v0.2.0` release contains a regression that bricks `install.sh`? **Mitigation:** the maintainer cuts a `sdlc-knowledge-v0.2.1` patch release with the fix per the same Gate 9 flow. The broken `0.2.0` release page can be marked as a pre-release via the GitHub UI (manual action; out of scope for the agent). Yanking the GitHub Release entirely is a Forbidden operation (it is a remote-state mutation outside the FR-1.2 whitelist) — the maintainer performs it manually if needed. Auto-revert on regression detection is OUT OF SCOPE per 13.7 item 5.

9. **R-9: Plan Critic false-positive on `templates/` invariant relaxation.** The Plan Critic could flag `templates/rules/auto-release.md` and `templates/hooks/pre-push` as new files that violate a perceived "templates UNCHANGED" invariant (which §11 / §12 informally implied). **Mitigation:** FR-12.5 explicitly relaxes the invariant with rationale; this PRD section is the authoritative scope expansion. The Plan Critic SHOULD treat the explicit FR-12.5 statement as the dispositive source.

10. **R-10: `softprops/action-gh-release@v2` action being yanked or compromised.** The action is community-maintained; a yank or supply-chain attack could break the upload step. **Mitigation:** pin the action by SHA in iter-4 (currently pinned by major-version `@v2` per `sdlc-knowledge-release.yml:202` — UNCHANGED in iter-3); the workflow file is auditable at PR review time; the `softprops/action-gh-release` repo is widely used and well-audited.

11. **Dependency: Section 6 (Changelog Release Packaging — iter-2).** This section's FR-1 / FR-2 build directly on §6's release-engineer agent and Gate 9 wiring. If §6 has not shipped at iter-3 implementation time, iter-3 cannot start. (§6 shipped per the merge commit history before 2026-04-25.)

12. **Dependency: Section 7 (Resource Manager-Architect — Iteration 2: Auto-Install).** This section's FR-1.2 / FR-1.3 / FR-1.4 directly mirror §7's tier model and headless contract. The `most-restrictive-applicable-tier` rule, the anchored-regex whitelist pattern, and the headless contract are all lifted from `src/agents/resource-architect.md:185-260`. If §7 has not shipped, iter-3 cannot reuse the precedent.

13. **Dependency: Section 11 (Local Knowledge Base — iter-1).** The FIRST `sdlc-knowledge-v0.2.0` tag bootstrap (FR-6) presupposes that the §11 / §12 binary at `tools/sdlc-knowledge/` is build-able. The `.github/workflows/sdlc-knowledge-release.yml` workflow file from §11 is the integration point for FR-3.

14. **Dependency: Section 12 (Robust PDF Extraction via pdfium-render — iter-2).** The Cargo.toml version bump to `0.2.0` (per §12 NFR-9) is the version that this section ships. The PDFium binary download path at `install.sh:489-613` is the precedent shape for the FR-4 prebuilt-binary download path.

15. **Dependency: Section 3 (Product Changelog Maintenance — iter-1).** The `templates/rules/changelog.md` sentinel mechanism is the sole dependency for FR-7 (SDLC core opt-in). If §3 had not shipped, FR-7 would have no rule to install.

16. **Dependency: Section 9 (Cognitive Self-Check Protocol).** This section's `## Facts` block, the `### External contracts` citations of `softprops/action-gh-release@v2` / GitHub Actions runners / Cargo cross-compile targets, and the Plan Critic enforcement all depend on §9 being live.

### 13.7 Out of Scope (iter-3)

The following items are explicitly deferred to iter-4 or beyond and MUST NOT be implemented as part of iter-3:

1. **npm / cargo / PyPI / gem registry publishing.** The Forbidden tier (FR-1.2 row 10) refuses these operations. A future iter-4 PRD section would lift specific publishers (e.g., `cargo publish` for the `sdlc-knowledge` crate) into a Sensitive-tier flow with credential management. Iter-3 ships the GitHub Releases pipeline only.

2. **sha256 / sigstore signature verification of binaries.** The §11 iter-1 deferral and §12 iter-2 deferral remain in force — iter-3 trusts GitHub Releases TLS + the GH Actions provenance attestations attached to releases. Signature verification is iter-4 scope.

3. **Additional platform targets — linux-arm32, musl-libc, FreeBSD.** The matrix expands to five platforms in iter-3 (adding Windows). Further platforms are iter-4 scope. The cargo-source-build fallback per FR-4.4 covers users on unsupported platforms in the meantime.

4. **CHANGELOG i18n / auto-translation.** The multilingual user story (13.2 #5) describes BYTE-PRESERVATION of non-ASCII content (UTF-8 round-trip). It does NOT include automatic translation between English and Russian (or any other language pair). Translation infrastructure is out of scope.

5. **Auto-revert on regression detection.** The Risk R-8 mitigation is manual — the maintainer cuts a patch release with the fix. Automatic regression detection (e.g., post-release smoke tests + auto-yank) requires metrics infrastructure and is out of scope for iter-3.

6. **GitHub Releases body rich rendering.** The body is plain Keep-a-Changelog markdown per FR-2.3 / FR-11.2. Rich rendering (release video embeds, custom CSS, contributor avatars) is out of scope.

7. **Coupling auto-release to other gates.** Gate 9 is the only gate this section touches. Gates 0-8 are UNCHANGED. Wiring auto-release into Gate 6 (build-runner) or Gate 7 (e2e-runner) for pre-release smoke validation is iter-4 scope; iter-3's pre-push validation per FR-8.1 is a NARROW addition that runs the same project commands as Gate 6 but is invoked from within Gate 9 — it is not a new gate.

8. **Pre-push hook installation on non-opted-in projects.** The FR-8.5 pre-push hook script ships in `templates/hooks/` and is installed by `install.sh --init-project` only when the project is opted INTO auto-release per FR-7.3. Forcing the hook on opt-out projects is out of scope.

These items are listed explicitly so the Plan Critic does not flag their absence as an iter-3 gap.

### 13.8 Affected Endpoints / Schema / UI

#### Affected Endpoints

Not applicable. This project has no HTTP API. The `sdlc-knowledge` CLI subcommand surface is BYTE-UNCHANGED (per FR-12.7 / §11 FR-9.1 / §12 FR-9.1). The release-engineer agent's structured 10-section output contract is BYTE-UNCHANGED in shape (only the `Commands to run` section content and the new `Tier breakdown` section per FR-1.8 differ in semantics).

#### Schema Changes

NONE in the SQLite database (`<project>/.claude/knowledge/index.db` is BYTE-UNCHANGED in schema per §11 FR-9.7 / §12 FR-9.7). The only schema-like additions are markdown rule files and a CHANGELOG, enumerated in `New Files` below.

#### UI Changes

Not applicable. This project is a collection of markdown agent prompts, a Rust CLI, and a bash installer; no graphical user interface.

#### New Files

| File | Purpose | Related Requirements |
|------|---------|---------------------|
| `.claude/rules/auto-release.md` | Activation sentinel for executing-mode at the SDLC core repo. Contents codify FR-1.2 tier table, FR-1.3 anchored-regex whitelist, FR-1.4 headless contract, FR-1.5 prompt format. | FR-7.2 |
| `.claude/rules/changelog.md` | Activation sentinel for the changelog-writer agent at the SDLC core repo (dogfood opt-in). Byte-identical to `templates/rules/changelog.md`. | FR-7.1 |
| `templates/rules/auto-release.md` | Template installed into downstream projects via `install.sh --init-project`. Byte-identical to `.claude/rules/auto-release.md`. | FR-7.3 |
| `templates/hooks/pre-push` | Pre-push hook script (thin wrapper over project's typecheck/test/lint). Installed by `install.sh --init-project` when auto-release is opted in. | FR-8.5 |
| `CHANGELOG.md` (repo root) | SDLC core CHANGELOG with `[Unreleased]` and `[3.0.0] - 2026-04-26 — Auto-Release Pipeline` sections. | FR-7.4, FR-12.8, AC-10 |
| `.claude/release-notes-3.0.0.md` | Release-notes file for the SDLC core's first auto-release run. Body of the `[3.0.0]` CHANGELOG section. | FR-2.1 |
| `.claude/release-notes-0.2.0.md` | Release-notes file for the FIRST `sdlc-knowledge-v0.2.0` bootstrap. Body summarizes iter-1 + iter-2 + iter-3 cumulative changes. | FR-6.3 |
| `.github/workflows/sdlc-core-release.yml` | New GH Actions workflow triggered on `v*` tags. Mirrors `sdlc-knowledge-release.yml` shape; produces source tarball + install.sh asset; uses `softprops/action-gh-release@v2`. | FR-11.2 |
| `MIGRATION.md` (repo root) | Documents the `Koroqe → codefather-labs` REPO_URL change for users with pre-fix checkouts. | FR-5.4 |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/agents/release-engineer.md` | REWRITE: frontmatter `tools:` gains `Bash`; `## Authority Boundary` gains EXECUTE-allowed set; `## NEVER List` shrinks to FR-1.2 Forbidden-tier rows only; new `## Tier-Based Authority Gradation` section codifying FR-1.2 / FR-1.3 / FR-1.4 / FR-1.5; `## Output Contract` gains `Tier breakdown` section. The agent prompt frontmatter `name:` field is BYTE-UNCHANGED. | FR-1.1 through FR-1.8 |
| `install.sh` | Update `VERSION="2.1.0"` → `"3.0.0"` (line 22); update `REPO_URL` (line 25) Koroqe → codefather-labs; update Quick install URL (line 12); update `print_help` heredoc first line (line 49); add Windows branch to `case "$(uname -ms)"` allowlist (line 354-363); add `.exe` suffix logic to URL composition (line 368); add `register_release_bash_allowlist` function; add `bootstrap_first_release` function; invoke both new functions from `# Main` block. | FR-3 series, FR-4 series, FR-5 series, FR-6 series, FR-7.5, FR-10 series |
| `.github/workflows/sdlc-knowledge-release.yml` | Add Windows-x64 to matrix `include:` list (line 64-75); add Windows case to pdfium asset name step (line 91-101); widen libpdfium glob to capture Windows DLL naming (line 115); add `.exe` suffix to Windows artifact staging (line 168); add Windows binary to release `files:` list (line 208-213); add source tarball asset and upload; add `body_path: .claude/release-notes-${{ github.ref_name }}.md` to `softprops/action-gh-release@v2` step. | FR-3 series, FR-2.3, FR-11.1 |
| `README.md` | Add ONE new row to the Hardening table referencing iter-3 auto-release. Update any Quick install URL referencing `Koroqe`. Lines 5 and 35 (taglines) BYTE-UNCHANGED. | FR-5.5, FR-7.6, FR-12.4 |
| `~/.claude/rules/knowledge-base-tool.md` | UNCHANGED. (This section makes no rule edits to the knowledge-base rule.) | — |
| `~/.claude/rules/knowledge-base.md` | UNCHANGED. | — |
| `~/.claude/rules/cognitive-self-check.md` | UNCHANGED per FR-12.6. | — |
| `tools/sdlc-knowledge/RELEASING.md` | Document the dual-tag scheme (FR-11), the bootstrap procedure (FR-6), the Windows binary addition (FR-3), the install.sh fallback semantics (FR-4.4). | FR-3, FR-4, FR-6, FR-11 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/{prd-writer,ba-analyst,architect,qa-planner,planner,security-auditor,test-writer,code-reviewer,build-runner,e2e-runner,verifier,doc-updater,refactor-cleaner,changelog-writer,resource-architect,role-planner}.md` | The 16 non-release-engineer agents are BYTE-UNCHANGED per FR-12.1. |
| `src/rules/cognitive-self-check.md` | BYTE-UNCHANGED per FR-12.6. |
| `src/rules/git.md`, `src/rules/scratchpad.md`, `src/rules/error-recovery.md`, `src/rules/tool-limitations.md` | Independent rules, unaffected. |
| `tools/sdlc-knowledge/src/*.rs` | BYTE-UNCHANGED — iter-3 makes no Rust code changes (the Cargo.toml version is bumped to `0.2.0` by §12; iter-3 ships the FIRST release of that version). |
| `tools/sdlc-knowledge/Cargo.toml` | BYTE-UNCHANGED — version `0.2.0` already set by §12 NFR-9. |
| `templates/rules/changelog.md` | BYTE-UNCHANGED — already in templates per Section 3 FR-4.4. |
| `templates/rules/architecture.md`, `templates/rules/security.md`, `templates/rules/testing.md` | UNCHANGED — independent templates. |
| `templates/CLAUDE.md` | UNCHANGED. |
| `src/commands/*.md` | All slash commands UNCHANGED. The `/merge-ready` command continues to invoke release-engineer at Gate 9 with the same call shape; the agent's executing-mode behavior is gated by `.claude/rules/auto-release.md` presence per FR-9.4. |
| `src/claude.md` | Plan Critic UNCHANGED. The existing `### External contracts` heuristic continues to cover the GitHub Actions / `softprops/action-gh-release` / Cargo target citations. The FR-12.5 templates relaxation is documented in this PRD section so the Plan Critic does NOT need a rule update. |
| `docs/PRD.md` Sections 1-12 | UNCHANGED. Iter-3 appends Section 13 only. |
| `docs/use-cases/`, `docs/qa/` | Iter-3 will add new feature-specific files via `/bootstrap-feature` (ba-analyst + qa-planner agents); no edits to existing files. |

## Facts

### Verified facts

- The PRD file `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` ends at line 2972 immediately before Section 13 is appended; the last existing section is Section 12 ("Robust PDF Extraction via pdfium-render") starting at line 2696 — verified by `grep -n "^## "` and `wc -l` in the current session.
- `install.sh:22` declares `VERSION="2.1.0"`; `install.sh:23` declares `KNOWLEDGE_VERSION="0.1.0"`; `install.sh:24` declares `KNOWLEDGE_PDFIUM_VERSION="chromium/7802"`; `install.sh:25` declares `REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"` (the bug FR-5.1 fixes) — verified by Read of lines 1-80 in this session.
- `install.sh:332-406` `install_knowledge_binary` constructs the asset URL `https://github.com/${owner_repo}/releases/download/sdlc-knowledge-v${KNOWLEDGE_VERSION}/sdlc-knowledge-${platform}` at line 368, with a four-platform allowlist at lines 354-363 (Darwin arm64 / x86_64, Linux x86_64 / aarch64) and falls through to `cargo_source_build_fallback` at lines 411-442 on download failure — verified by Read in this session.
- `install.sh:489-613` `install_pdfium_binary` is the precedent shape for the new `download_release_binary` function: subshell wrapped with `set +e`, `umask 0022`, mktemp staging, TLS-only `curl`/`wget` fallback, `tar` traversal/setuid checks, version sentinel at `$target_dir/.version` — verified by Read in this session.
- `install.sh:447-484` `register_bash_allowlist` is the precedent shape for `register_release_bash_allowlist` per FR-10.1: jq-based atomic merge with `unique` deduplication; fail-closed when jq absent; missing-file create with literal JSON — verified by Read in this session.
- `src/agents/release-engineer.md:4` was Read in this session and showed `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]` — but the prompt body at lines 12, 16, 30, and 63 contradicts this by explicitly stating "no Bash tool" and asserting the NEVER List is enforced "via tool removal". This is a documented frontmatter-vs-body contract drift in the current `release-engineer.md` file. FR-1.1's behavior depends on the resolution: if `Bash` is already in the frontmatter, FR-1.1 is a documentation-accuracy edit to the prompt body; if `Bash` is absent, FR-1.1 adds it. Either path satisfies the FR contract — see Open Question #1 below.
- `src/agents/release-engineer.md:67-84` enumerates the 13-line NEVER List inside a fenced code block — verified by Read in this session. The list contains: `git push`, `git push origin <anything>`, `git push origin v<anything>`, `git tag`, `git tag -a vX.Y.Z`, `git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md`, `gh release create`, `gh release create vX.Y.Z`, `npm publish`, `yarn publish`, `pnpm publish`, `cargo publish`, `pypi upload`, `twine upload`, `poetry publish`, `gem push`.
- `src/agents/resource-architect.md:185-260` defines the four-tier authority gradation (Trivial / Moderate / Sensitive / Forbidden), the most-restrictive-applicable-tier rule (line 222), the 18-row classification decision table (lines 201-220), the 7th-field `Tier:` requirement (line 224-228), and the Forbidden-tier canonical handling (lines 248-256) — verified by `grep -n "Trivial\|Moderate\|Sensitive\|Forbidden\|Tier" src/agents/resource-architect.md` in this session.
- `templates/rules/changelog.md:37-39` documents the activation sentinel rule: "the presence of this file at `.claude/rules/changelog.md` is the sole signal the `changelog-writer` agent uses to decide whether to run; absence equals opt-out" — verified by Read of the entire 43-line file in this session.
- `.github/workflows/sdlc-knowledge-release.yml:13-16` triggers on `tags: 'sdlc-knowledge-v*'`; lines 64-75 declare the four-platform matrix (`darwin-arm64`/`macos-14`, `darwin-x64`/`macos-13`, `linux-x64`/`ubuntu-latest`, `linux-arm64`/`ubuntu-22.04-arm`); line 202 uses `softprops/action-gh-release@v2`; lines 208-213 list the four binary `files:` paths — verified by Read of the entire 213-line file in this session.
- `.github/workflows/sdlc-knowledge-release.yml:91-101` `Determine pdfium asset name` step has FOUR case branches matching the four matrix platforms; this is the precedent shape FR-3.2 extends with a fifth Windows branch — verified by Read in this session.
- `.github/workflows/sdlc-knowledge-release.yml:103-116` `Download pdfium dynamic library` step uses `shell: bash`, `curl --proto '=https' --tlsv1.2 -fsSL --max-redirs 5 --max-time 120`, `tar --no-same-owner --no-same-permissions -xzf`, and `find ... -name 'libpdfium*' -type f -exec cp {} ...` — the same shape FR-3.3 widens for Windows DLL naming — verified by Read in this session.
- The repo's actual GitHub remote is `codefather-labs/claude-code-sdlc.git` per the user task and the gitStatus environment context; the install.sh value `Koroqe/claude-code-sdlc.git` is incorrect — verified by reconciling the user task description against `install.sh:25`.
- Knowledge-base status at task start: `doc_count: 28`, `chunk_count: 51542`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db` — verified via `sdlc-knowledge status --json` in this session.
- Knowledge-base contains BOTH English and Russian content: live probes returned `the` matching `Building AI Agents With LLMs RAG And Knowledge Graphs.pdf` and `Hands-On Machine Learning with Pytorch.pdf` (both English); `не` matching `dokumen.pub_9785446114610-9781492054788.pdf` and `841031560_Современная_программная_инженерия_2023.pdf` (both Russian) — verified via `sdlc-knowledge search "the" --top-k 2 --json` and `sdlc-knowledge search "не" --top-k 2 --json` in this session.

### External contracts

- **`softprops/action-gh-release@v2` GitHub Action** — symbol: `inputs.tag_name`, `inputs.name`, `inputs.body_path`, `inputs.files`, `inputs.draft`, `inputs.prerelease`, `inputs.fail_on_unmatched_files` — source: `.github/workflows/sdlc-knowledge-release.yml:201-213` (consumed in this repo by the §11 / §12 release workflow) — verified: yes (the input shape is observed in the existing workflow file). Risk: action upgrade `@v2 → @v3` could change the `inputs.body_path` semantics; iter-3 pins `@v2` per FR-2.3 / FR-11.2 unchanged from §11.
- **GitHub Actions runner image `windows-latest`** — symbol: runner-label string used in `runs-on:` field; preinstalls Visual Studio 2022 Build Tools (`cl.exe`), Git for Windows (`git`, `bash`), `curl`, `tar`, `find` — source: GitHub Actions docs (NOT opened in this session) — verified: **no — assumption**. Risk: the `windows-latest` runner image's preinstalled tooling could change between GitHub-managed runner-image releases. Verification path: architect Step 3 verifies the runner image's tooling version against the GitHub-managed-runner-images repo before Slice 4 ships; Slice 4 done-condition includes a Windows matrix run that exercises `cargo build --target x86_64-pc-windows-msvc` AND the bash-shell tar/curl/find pipeline.
- **Cargo cross-compile target `x86_64-pc-windows-msvc`** — symbol: rustup target name; requires MSVC linker (`link.exe`); produces `.exe` suffix on output binaries — source: rustup docs (NOT opened in this session) — verified: **no — assumption**. Risk: target name precision (`x86_64-pc-windows-msvc` vs `x86_64-pc-windows-gnu`); the MSVC variant is correct for `windows-latest` per industry convention. Verification path: architect Step 3 confirms `dtolnay/rust-toolchain@stable` accepts the target; Slice 4 first matrix run verifies on the actual GH runner.
- **`bblanchon/pdfium-binaries` Windows asset filename `pdfium-win-x64.tgz`** — symbol: asset filename in GitHub Releases for the `chromium/<version>` tag scheme — source: §12 PRD assumption (`pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz` are confirmed; the Windows asset name is extrapolated by pattern) — verified: **no — assumption**. Risk: the actual asset name could be `pdfium-windows-x64.tgz` or `pdfium-win-x64.zip` — the upstream project ships ZIPs for Windows in some releases. Verification path: architect Step 3 opens the `bblanchon/pdfium-binaries` releases page for the pinned `chromium/7802` tag and pins the exact asset filename before Slice 4 ships.
- **Windows DLL naming convention `pdfium.dll` (no `lib` prefix)** — symbol: filename of the dynamic library on Windows; differs from `libpdfium.dylib` (macOS) and `libpdfium.so` (Linux) — source: Windows PE convention; `bblanchon/pdfium-binaries` releases — verified: **no — assumption**. Risk: the find-glob in `sdlc-knowledge-release.yml:115` searches `libpdfium*` which may MISS the Windows `pdfium.dll`; FR-3.3 explicitly widens the glob. Verification path: Slice 4 first Windows matrix run logs the post-extract directory listing; the architect inspects to confirm the filename.
- **`uname -s` shape on Git Bash for Windows runners** — symbol: typically `MINGW64_NT-10.0-22631` or similar; the `case` pattern in `install.sh:354-363` matches by exact string per the existing four-platform allowlist — source: Git for Windows documentation (NOT opened in this session) — verified: **no — assumption**. Risk: the actual `uname -ms` shape on the `windows-latest` runner under Git Bash could differ from the FR-4.1 assumption. Verification path: architect Step 3 runs `uname -ms` on a Windows runner; Slice 4 done-condition includes `bash install.sh --yes` on the runner asserting the case branch matches.
- **`git tag -a -F <file>` UTF-8 byte-preservation** — symbol: `git-tag(1)` `-F <file>` flag; the message file is read verbatim as UTF-8 bytes — source: git-tag manpage (NOT opened in this session) — verified: **no — assumption**, but well-documented industry contract. Risk: locale-dependent re-encoding on rare systems. Verification path: AC-12 multilingual round-trip test exercises Cyrillic content end-to-end.
- **GitHub Actions tag-filter glob semantics** — symbol: `on.push.tags` accepts glob patterns where `*` matches any character sequence; `sdlc-knowledge-v*` is a literal-prefix glob that does NOT match plain `v*` — source: GitHub Actions workflow syntax docs (NOT opened in this session) — verified: **no — assumption**, but heavily relied on by the iter-1 release workflow at `sdlc-knowledge-release.yml:13-16`. Risk: tag-filter cross-firing between the two workflows. Verification path: FR-11.4 documents the disjointness; Slice 8 first dual-tag run verifies disjoint firing.
- **`git archive --format=tar.gz --prefix=<name>/ -o <file> HEAD`** — symbol: `git-archive(1)` flags producing a deterministic source tarball — source: git docs (NOT opened in this session) — verified: **no — assumption**, but standard git plumbing. Risk: low. Verification path: Slice 4 done-condition includes the tarball production and `tar -tzf` listing.
- **`knowledge-base` CLI for §13 authoring** — symbol: `sdlc-knowledge status --json`, `sdlc-knowledge list --json`, `sdlc-knowledge search "<query>" --top-k 5 --json` — source: live invocation in this session per the knowledge-base mandate — verified: yes. Multilingual-mandate compliance: status returned 28 docs / 51542 chunks; English probe `the` returned hits in `Building AI Agents With LLMs RAG.pdf` and `Hands-On Machine Learning with Pytorch.pdf`; Russian probe `не` returned hits in `dokumen.pub_9785446114610-9781492054788.pdf` and `841031560_Современная_программная_инженерия_2023.pdf`; English topical probes `release engineering tag push`, `GitHub Actions release workflow`, `semver versioning`, `git tag annotated signed`, `release rollback regression` returned ZERO hits each (corpus is ML/AI + RU SE/SRE/Chaos books, not release-engineering literature); English topical probes `continuous deployment` and `blue green canary` returned hits in `Practical MLOps_ Operationalizing Machine Learning Models.pdf` (chunks 921, 131, 534, 1872, 1875, 1865) and `dokumen_pub_building_applications_with_ai_agents_designing_and_implementing.pdf` (chunks 9186, 9181); Russian topical probes `релиз тегирование`, `выпуск версий релиз`, `канареечный релиз`, `канареечное развертывание`, `развертывание production`, `откат релиза версия`, `версионирование система` returned ZERO hits each; Russian probes `автоматизация развертывания` and `непрерывная интеграция` returned hits in `Хаос_инжиниринг_2021_Кейси_Розенталь,_Нора_Джонс.pdf` (chunks 9962, 11012, 9906) and `841031560_Современная_программная_инженерия_2023.pdf` (chunks 46287, 46286, 45676, 45687, 45529) and `dokumen.pub_9785446114610-9781492054788.pdf` (chunk 16841). Two load-bearing citations follow because they specifically informed the FR-1 / R-8 design (canary/blue-green as deployment-strategy precedent and reversibility/CI-CD as the underlying release-safety pattern):
- knowledge-base: Practical MLOps_ Operationalizing Machine Learning Models.pdf:534 — query: "blue green canary" — BM25: 23.402437612783395 — verified: yes
- knowledge-base: Хаос_инжиниринг_2021_Кейси_Розенталь,_Нора_Джонс.pdf:9906 — query: "непрерывная интеграция" — BM25: 17.24736581105278 — verified: yes

### Assumptions

- **The four-tier authority gradation lifted from `resource-architect.md` is a clean fit for release operations.** Risk: the `resource-architect` tier table targets dependency / MCP / cloud-credential operations; release operations (`git tag`, `git push`, `gh release`) have different blast-radii. The most-restrictive-applicable-tier rule is the same; the ROW SET differs. How to verify: architect Step 3 reviews the FR-1.2 12-row table against `resource-architect.md:201-220` 18-row table and reconciles classification logic before Slice 1 ships.
- **`AUTO_RELEASE=1` is the right env-var name (not `RELEASE_HEADLESS=1` or `CI_RELEASE=1`).** Risk: low — the name is local to this section and consistent with §7 FR-5.5's `AUTO_INSTALL=1` (assumed; confirm). How to verify: architect Step 3 grep-confirms the §7 env-var name and aligns FR-1.4 accordingly.
- **The bootstrap one-shot `bash install.sh --bootstrap-release 0.2.0` is acceptable as a dedicated install.sh code path rather than a separate script (`bootstrap_release.sh`).** Risk: install.sh becomes a kitchen-sink utility. How to verify: architect Step 3 picks one approach with cited rationale; FR-6 documents the choice.
- **Pre-existing `install.sh` cleanup of `Koroqe` is contained — no other scripts in the repo hardcode the value.** Risk: the README, `tools/sdlc-knowledge/RELEASING.md`, or hidden CI files could reference the old owner. How to verify: FR-5.3 mandates `grep -r 'Koroqe' .` returning zero matches before Slice 5 done-condition.
- **The Windows pdfium dynamic library (`pdfium.dll`) is loadable by `pdfium-render` v0.9 from `~/.claude/tools/sdlc-knowledge/pdfium/lib/pdfium.dll` via `Pdfium::bind_to_system_library` plus `PATH` manipulation.** Risk: Windows uses `PATH` for DLL lookup, not `LD_LIBRARY_PATH`/`DYLD_LIBRARY_PATH`; the `pdfium-render` resolver may need a different invocation on Windows. How to verify: §12 Open Question #1 carries forward — architect Step 3 selects `bind_to_library(path: &Path)` with the explicit Windows path if the system-library variant fails on Windows.
- **The `templates/` invariant relaxation (FR-12.5) does not break any downstream consumer that grep's the templates dir for a fixed file count.** Risk: a downstream project's pre-existing CI step `[ "$(ls templates/ | wc -l)" -eq 4 ]` would fail. How to verify: not load-bearing — `templates/` is a one-way scaffold; downstream consumers do not import the templates programmatically.
- **The CHANGELOG `[3.0.0]` body for the SDLC core's first release is authored manually in the bootstrap step.** Risk: a hand-authored stub may drift from the FR-1 through FR-12 list. How to verify: AC-10 verifies presence and date-stamp; the body content is checked manually by the maintainer at Slice 9 done-condition.

### Open questions

- **Knowledge-base direct topical searches on `release engineering tag push`, `GitHub Actions release workflow`, `semver versioning`, `git tag annotated signed`, `release rollback regression` returned ZERO hits each across the 28-book corpus.** Per the knowledge-base multilingual mandate this is a documented negative result. The English MLOps and AI-Agents books cover blue-green/canary deployment patterns generically; the Russian SRE/Chaos/Modern-SE books cover continuous integration / canary releases / version control as reversibility techniques generically; NEITHER side directly covers `git tag` / `gh release create` / `softprops/action-gh-release` semantics. Action: consider adding a release-engineering reference (e.g., the `git-tag(1)` manpage, the GitHub Actions release-management docs, the Keep a Changelog spec) to the `<project>/.claude/knowledge/sources/` corpus if iter-4 work continues. No action required for iter-3 — the source-of-truth is the existing release-engineer agent prompt, the existing workflow file, and the resource-architect tier-model precedent.
- **Open Question #1 — Frontmatter `tools:` of `release-engineer.md` already includes `Bash`?** The `release-engineer.md:4` line was read in this session as `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]` — but the prompt body explicitly states "no Bash tool" and the `## NEVER List` is structurally enforced "via tool removal" per line 63. Resolution: architect Step 3 verifies the actual frontmatter byte content in the working tree before Slice 1 ships. If `Bash` is already present, FR-1.1 is a documentation accuracy fix (rewrite the prompt body claims) rather than a frontmatter modification. If `Bash` is absent, FR-1.1 adds it. Either path satisfies the FR contract; the architect's job is to pick the cleaner edit.
- **Open Question #2 — Exact `bblanchon/pdfium-binaries` Windows asset filename and archive format.** Could be `pdfium-win-x64.tgz`, `pdfium-windows-x64.tgz`, or `pdfium-win-x64.zip` (some platforms ship ZIPs). RESOLUTION: architect Step 3 opens the GitHub Releases page for `chromium/7802` and pins the exact filename and format before Slice 4 ships. If ZIP, the FR-3.3 `tar -xzf` invocation widens to a format-detection branch.
- **Open Question #3 — `softprops/action-gh-release@v2` `body_path` field accepts a release-notes file outside the workflow's checkout dir?** The body_path is relative to the GH Actions workspace; the file `.claude/release-notes-<X.Y.Z>.md` is committed in the repo and present in the checkout, so the path resolves. Edge: if the tag is pushed without the release-notes file being committed (e.g., the file is gitignored by accident), the action fails with a clear error. RESOLUTION: FR-2.3 requires the file to be committed alongside the CHANGELOG rewrite per FR-1.2 row 5 (`git add CHANGELOG.md .claude/release-notes-<X.Y.Z>.md`); a missing file fails Slice 7 done-condition.
- **Open Question #4 — sha256 verification of release binaries.** RESOLVED — DEFERRED to iter-4 per 13.7 item 2 (mirrors §11 iter-1 / §12 iter-2 deferrals).
- **Open Question #5 — Auto-publish to npm/cargo/PyPI.** RESOLVED — OUT OF SCOPE per 13.7 item 1 (Forbidden tier in iter-3).
- **Open Question #6 — Whether to backfill historical CHANGELOG sections for Features 1-12.** RESOLVED per R-4 — start clean from `[3.0.0]`; backfill is deferred to iter-4 if requested.

