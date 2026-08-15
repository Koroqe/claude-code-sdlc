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
4. **NFR-4:** Agent model tiers are right-sized by task complexity. Agents whose output cascades through the pipeline and cannot be caught by deterministic verification (`architect`, `planner`, `security-auditor`) use `model: opus`. All other agents use `model: sonnet`. See Section 3 for full rationale and per-agent assignments. (Supersedes the original uniform-opus policy from Section 1 v1.)
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

## 3. Agent Model Tier Optimization

**Status:** [SUPERSEDED]
**Date:** 2026-05-01
**Superseded by:** Roadmap feature F4 (Adaptive tier routing + model routing). This section's approach — hardcoding `model:` in each agent's frontmatter — is replaced by profile-driven rewriting at install time (`quality` / `balanced` / `budget` / `inherit`) plus a CI drift check. None of this section's functional requirements are implemented as specified; the shipped `model:` fields are the artifact of a manual edit, not of FR-1..FR-3 below.
**Priority:** Medium
**Related:** Section 1 (NFR-4: uniform-opus-tier policy — superseded by this section)

### 3.1 Description

Right-size the model tier of each of the 13 SDLC pipeline agents to the cheapest model that delivers reliable output for its specific task. Currently, every agent declares `model: opus` in its YAML frontmatter, which means Opus (resolving to Opus 4.7) is invoked for every agent call — including purely mechanical tasks where Opus-level reasoning adds no value but incurs full Opus cost.

Under this feature, 10 agents that perform structured/mechanical work move to `model: sonnet`. The 3 agents that make complex decisions cascading through the pipeline (architect, planner, security-auditor) remain on `model: opus`. The uniform-model-tier policy documented in Section 1.4 NFR-4 is replaced with the new tiered policy.

**Why:** Opus and Sonnet are priced very differently. Running every agent on Opus is wasteful for mechanical tasks like running a build command, summarising a diff, generating a structured test plan from existing use cases, or applying a documented edit pattern. Sonnet is sufficient for these tasks. Opus-level reasoning is justified only where a single agent's output cascades through subsequent slices — architecture decisions, slice plans, and security findings.

**Why these three stay on opus:**
1. **architect** — architectural verdicts shape the entire implementation plan. A wrong call here is multiplied across every slice.
2. **planner** — the implementation plan is the contract every other agent reads. Errors in slicing, file paths, or wave assignment propagate to every downstream agent.
3. **security-auditor** — security findings gate merge. Missed vulnerabilities have outsized cost; reasoning depth matters.

**Why the other ten can move to sonnet:**
- They consume an explicit, structured input (a PRD, a plan, a use case file, a code diff) and produce an explicit, structured output (test cases, code changes, a review report, an updated doc). The reasoning is bounded and the output format is constrained.
- Their work is verified by a downstream agent or a deterministic check (typecheck, test run, build). Errors are caught before merge.
- The cost-per-call multiplied by call frequency (every slice for test-writer, code-reviewer, build-runner; every feature for prd-writer, ba-analyst, qa-planner, doc-updater, e2e-runner, verifier, refactor-cleaner) makes them the highest-leverage targets for downgrade.

### 3.2 User Story

As a developer using the Claude Code SDLC pipeline, I want agents that perform structured/mechanical tasks to use Sonnet instead of Opus, so that pipeline cost is significantly reduced without degrading output quality for the tasks where it matters.

### 3.3 Functional Requirements

#### FR-1: Sonnet-Tier Agent Conversion

Convert the 10 agents whose tasks are bounded, structured, and downstream-verified to `model: sonnet`.

1. **FR-1.1:** `src/agents/ba-analyst.md` MUST have `model: sonnet` in its YAML frontmatter.
2. **FR-1.2:** `src/agents/build-runner.md` MUST have `model: sonnet` in its YAML frontmatter.
3. **FR-1.3:** `src/agents/code-reviewer.md` MUST have `model: sonnet` in its YAML frontmatter.
4. **FR-1.4:** `src/agents/doc-updater.md` MUST have `model: sonnet` in its YAML frontmatter.
5. **FR-1.5:** `src/agents/e2e-runner.md` MUST have `model: sonnet` in its YAML frontmatter.
6. **FR-1.6:** `src/agents/prd-writer.md` MUST have `model: sonnet` in its YAML frontmatter.
7. **FR-1.7:** `src/agents/qa-planner.md` MUST have `model: sonnet` in its YAML frontmatter.
8. **FR-1.8:** `src/agents/refactor-cleaner.md` MUST have `model: sonnet` in its YAML frontmatter.
9. **FR-1.9:** `src/agents/test-writer.md` MUST have `model: sonnet` in its YAML frontmatter.
10. **FR-1.10:** `src/agents/verifier.md` MUST have `model: sonnet` in its YAML frontmatter.
11. **FR-1.11:** No other field in the frontmatter (`name`, `description`, `tools`) and no body content of the affected agent files MUST be modified by this feature.

#### FR-2: Opus-Tier Agent Preservation

Preserve `model: opus` for the 3 agents whose output cascades through the pipeline.

1. **FR-2.1:** `src/agents/architect.md` MUST retain `model: opus` in its YAML frontmatter.
2. **FR-2.2:** `src/agents/planner.md` MUST retain `model: opus` in its YAML frontmatter.
3. **FR-2.3:** `src/agents/security-auditor.md` MUST retain `model: opus` in its YAML frontmatter.

#### FR-3: PRD Policy Update (Section 1.4 NFR-4 supersession)

Replace the uniform-model-tier policy in Section 1.4 NFR-4 with the new tiered policy.

1. **FR-3.1:** Section 1.4 NFR-4 of `docs/PRD.md` MUST be rewritten to describe the tiered model policy: 3 agents on opus, 10 agents on sonnet, with the rationale (cost optimization, right-sizing).
2. **FR-3.2:** The rewritten NFR-4 MUST explicitly note that the original Section 1 NFR-4 (uniform opus tier "for consistency") was an architectural decision intentionally revised by this Section 3.
3. **FR-3.3:** The rewritten NFR-4 MUST list the 3 agents on opus by name, and reference Section 3 for the full tier list.

#### FR-4: README Documentation

Document the tiered model policy in the README's Customization section so end users understand which model tier each agent category uses and why.

1. **FR-4.1:** `README.md` MUST contain a subsection (in or under Customization) that lists each of the 13 agents with its model tier (opus or sonnet) and the rationale for the tier choice.
2. **FR-4.2:** The README MUST explain the general principle: opus for cascading-decision agents, sonnet for structured/mechanical agents.
3. **FR-4.3:** The README MUST tell readers how to override the tier for a specific agent (edit the `model:` field in the agent's frontmatter and re-run `bash install.sh`).

#### FR-5: CONTRIBUTING Template Update

Update the contributor-facing agent template so the default for new agents is `model: sonnet`, with guidance on when to choose opus instead.

1. **FR-5.1:** `CONTRIBUTING.md` MUST contain an agent template (or example frontmatter block) showing `model: sonnet` as the default.
2. **FR-5.2:** The template MUST be accompanied by guidance: choose opus only when the agent's output cascades through multiple downstream agents AND a wrong decision cannot be caught by deterministic verification (typecheck, test, build).
3. **FR-5.3:** The guidance MUST reference Section 3 of the PRD for the full rationale.

#### FR-6: QA Test Case Update

Update the existing pipeline-hardening QA test case that asserts uniform opus tier.

1. **FR-6.1:** Test case 1.1.3 in `docs/qa/pipeline-hardening_test_cases.md` MUST be updated to reflect the tiered policy. The expected outcome MUST assert: exactly 3 agents have `model: opus` (architect, planner, security-auditor) and exactly 10 agents have `model: sonnet`.
2. **FR-6.2:** The updated test case MUST list the specific 10 agent filenames expected to have `model: sonnet`, so any future drift (an agent silently downgraded or upgraded without PRD update) is caught.

### 3.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt and documentation files only. No runtime code is touched.
2. **NFR-2:** The change is backward compatible at the prompt level. No agent's name, description, tools, or behavior contract is modified — only the model tier. Calling code (commands, other agents that delegate via the `Task` tool) does not need to change.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`).
4. **NFR-4:** Output quality regression risk is mitigated by the existing pipeline verification gates: code review, security audit, build, E2E, and verifier all run after agent output and would catch a Sonnet-produced regression on a slice. Any agent that produces unacceptable quality on Sonnet can be reverted to opus by editing one line in its frontmatter (see FR-4.3).
5. **NFR-5:** The total agent count remains at 13. No agents are added or removed. Counts referenced in `README.md` and `src/claude.md` (and per Section 1 NFR-5) remain valid.
6. **NFR-6:** This feature supersedes the consistency rationale of Section 1 NFR-4. Future agents added to the pipeline MUST be tiered per the policy in this section, not per the old uniform policy.

### 3.5 Acceptance Criteria

1. **AC-1:** `grep -l "model: opus" src/agents/*.md` returns exactly 3 files: `src/agents/architect.md`, `src/agents/planner.md`, `src/agents/security-auditor.md`. No more, no fewer.
2. **AC-2:** `grep -l "model: sonnet" src/agents/*.md` returns exactly 10 files: `src/agents/ba-analyst.md`, `src/agents/build-runner.md`, `src/agents/code-reviewer.md`, `src/agents/doc-updater.md`, `src/agents/e2e-runner.md`, `src/agents/prd-writer.md`, `src/agents/qa-planner.md`, `src/agents/refactor-cleaner.md`, `src/agents/test-writer.md`, `src/agents/verifier.md`. No more, no fewer.
3. **AC-3:** Section 1.4 NFR-4 in `docs/PRD.md` describes the tiered model policy (3 opus + 10 sonnet) and references Section 3 for the rationale. The text "all 13 agents use the same model tier for consistency" is no longer present in NFR-4.
4. **AC-4:** `README.md` Customization section documents which model tier each of the 13 agents uses and the override procedure (edit frontmatter, re-run installer).
5. **AC-5:** `CONTRIBUTING.md` agent template shows `model: sonnet` as the default with a comment or accompanying note explaining when opus is appropriate instead.
6. **AC-6:** Test case 1.1.3 in `docs/qa/pipeline-hardening_test_cases.md` asserts the tiered policy (3 opus + 10 sonnet by exact filename) and not the old uniform-opus assertion.
7. **AC-7:** No agent file's `name`, `description`, `tools`, or body content is modified by this feature. The diff for each affected agent file is exactly one line: the `model:` value.
8. **AC-8:** A re-install of the project (`bash install.sh`) followed by a fresh Claude Code session uses the new tiers — verifiable by inspecting the installed copies of the agent files in the user's `.claude/agents/` directory and confirming they match the source `model:` values.

### 3.6 Affected Components

#### New Files

None. This feature modifies existing files only.

#### Modified Files

| File | Change | Related Requirements |
|------|--------|---------------------|
| `src/agents/ba-analyst.md` | `model: opus` -> `model: sonnet` | FR-1.1 |
| `src/agents/build-runner.md` | `model: opus` -> `model: sonnet` | FR-1.2 |
| `src/agents/code-reviewer.md` | `model: opus` -> `model: sonnet` | FR-1.3 |
| `src/agents/doc-updater.md` | `model: opus` -> `model: sonnet` | FR-1.4 |
| `src/agents/e2e-runner.md` | `model: opus` -> `model: sonnet` | FR-1.5 |
| `src/agents/prd-writer.md` | `model: opus` -> `model: sonnet` | FR-1.6 |
| `src/agents/qa-planner.md` | `model: opus` -> `model: sonnet` | FR-1.7 |
| `src/agents/refactor-cleaner.md` | `model: opus` -> `model: sonnet` | FR-1.8 |
| `src/agents/test-writer.md` | `model: opus` -> `model: sonnet` | FR-1.9 |
| `src/agents/verifier.md` | `model: opus` -> `model: sonnet` | FR-1.10 |
| `docs/PRD.md` | Rewrite Section 1.4 NFR-4 to describe tiered policy; reference Section 3 | FR-3.1, FR-3.2, FR-3.3 |
| `docs/qa/pipeline-hardening_test_cases.md` | Update test case 1.1.3 to assert the tiered policy with explicit filename lists | FR-6.1, FR-6.2 |
| `README.md` | Add per-agent tier list and override instructions in Customization section | FR-4.1, FR-4.2, FR-4.3 |
| `CONTRIBUTING.md` | Update agent template to default to `model: sonnet`; add guidance on when to choose opus | FR-5.1, FR-5.2, FR-5.3 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Stays on opus (FR-2.1). Not modified by this feature. |
| `src/agents/planner.md` | Stays on opus (FR-2.2). Not modified by this feature. |
| `src/agents/security-auditor.md` | Stays on opus (FR-2.3). Not modified by this feature. |
| `src/claude.md` | Agent count and Plan Critic logic unchanged. Tier policy is documented in PRD/README, not in claude.md. |
| `src/commands/*.md` | Commands invoke agents by name; the model tier is resolved from each agent's frontmatter. No command needs to change. |
| `src/rules/*.md` | Rules are agent-agnostic. No change. |
| `install.sh` | File copy logic uses globbing for `src/agents/*.md`. No new files added; no manifest change required. |

### 3.7 UI Changes

Not applicable. This project is a collection of markdown prompt files with no user interface.

### 3.8 Schema Changes

Not applicable. This project has no database.

### 3.9 Affected Endpoints

Not applicable. This project has no API.

### 3.10 Risks and Dependencies

1. **Risk: Sonnet output quality regression.** A specific agent may produce lower-quality output on Sonnet than on Opus, degrading the pipeline. Mitigation: every Sonnet-tier agent's output is verified downstream — code-reviewer/security-auditor/build-runner/verifier/e2e-runner all run after slice implementation; ba-analyst/prd-writer/qa-planner output is reviewed by architect (still on opus) before planner consumes it. Reverting any individual agent to opus is a one-line change (FR-4.3).
2. **Risk: Silent drift over time.** Future contributors may add a new agent on opus or change an existing agent's tier without updating the PRD. Mitigation: FR-6.1 hardens test case 1.1.3 with explicit filename lists, so any drift triggers a test failure during the pipeline-hardening QA pass.
3. **Risk: Section 1 NFR-4 contradiction.** The original Section 1 NFR-4 explicitly chose uniform opus "for consistency". Leaving it unchanged would create an internal contradiction in the PRD. Mitigation: FR-3.1 rewrites Section 1.4 NFR-4 as part of this feature's implementation; AC-3 verifies the old text is gone.
4. **Risk: Re-install required.** Users on existing installations will not see the tier change until they re-run `bash install.sh`. Mitigation: NFR-3 documents this; the README override section (FR-4.3) reinforces the install requirement.
5. **Dependency: Claude Code resolves `model: sonnet`.** This feature assumes the Claude Code runtime accepts `sonnet` as a valid value for the agent frontmatter `model:` field and resolves it to a current Sonnet model. This is a property of the Claude Code installation, not of this repository.
6. **Dependency: Section 1 NFR-4 (verifier model tier).** Section 1 NFR-4 specifically requires the verifier on opus "for consistency". Section 3 supersedes that — the verifier moves to sonnet (FR-1.10). The supersession is explicit in FR-3.1 and FR-3.2.

---

## 4. Self-Improvement Loop — Cross-Session Lesson Capture

**Status:** [DRAFT]
**Date:** 2026-05-19
**Priority:** Medium
**Related:** Section 1 (FR-2: Deviation Rules), Section 2 (FR-2.6: orchestrator-only scratchpad writes)

### 4.1 Description

Add a persistent, project-local lesson-capture system that turns user corrections, repeated errors, and quality gate failures into prevention rules. Lessons accumulate in `.claude/lessons.md` inside each project and are read at session start, during planning, and before each slice implementation.

**Why:** The SDLC pipeline catches errors reactively. Deviation rules (Section 1 FR-2) classify errors when they occur; quality gates verify output before merge. But the pipeline never learns from those errors across features or sessions. A mistake corrected in feature A can recur verbatim in feature B because no feedback loop exists between pipeline runs. This feature closes that gap by making the system self-improving: every correction is recorded, recurring patterns become prevention rules, and those rules are injected into the planning and implementation steps where they can prevent the error rather than catch it.

**Design Decisions:**
1. **Separate file from scratchpad** — Scratchpad has a 100-line archival mechanism that moves completed entries to `## Archive` and effectively discards them from active context. Lessons are permanent knowledge that must never be archived or deleted. A separate file enforces that contract.
2. **No new agent** — Lesson capture is a behavioral rule (write it down when corrected), not a task requiring specialized analysis. A rules file is zero-overhead versus spawning a subagent; it also fires at times when spawning an agent is impractical (inline during slice implementation).
3. **Three capture triggers** — (a) User explicitly corrects the agent mid-execution; (b) the same deviation rule fires two or more times within a single feature; (c) a quality gate failure in `/merge-ready` requires auto-fix or exhausts retries. Each trigger is already a natural signal present in the pipeline — no new instrumentation is needed.
4. **Prevention rule elevation** — Individual lessons that recur across features are promoted to prevention rules, which appear in a dedicated section read before every slice. Thresholds are severity-weighted: security and data-integrity lessons elevate at 2 occurrences; general patterns at 3.
5. **Prevention rule retirement** — Rules not confirmed (triggered or prevented) in 10 consecutive features, or rules referencing deleted files or patterns, are archived. This prevents unbounded accumulation.
6. **Orchestrator-only writes in parallel mode** — Matches the scratchpad pattern from Section 2 FR-2.6. Subagents executing slices in parallel must not write to `lessons.md` directly; the orchestrator writes after each wave completes.
7. **Existence guards on all references** — Projects created before this feature have no `.claude/lessons.md`. Every instruction that reads or writes the file must include a conditional (`if it exists`) so the pipeline remains fully functional without it.

### 4.2 User Story

As a developer using the Claude Code SDLC pipeline, I want the system to record corrections I make and errors that repeat, and apply that accumulated knowledge as prevention rules in future planning and implementation steps, so that the same mistakes do not occur across features or sessions.

### 4.3 Functional Requirements

#### FR-1: Lessons Rule File

Create a new global rule file at `src/rules/lessons.md` that defines the lesson-capture system. This file is installed to `~/.claude/rules/lessons.md` and applies to every project.

1. **FR-1.1:** The rule file MUST define a MUST Read protocol: read `.claude/lessons.md` at the start of every session if the file exists.
2. **FR-1.2:** The rule file MUST define Trigger 1 — User Correction. The agent MUST write a lesson immediately when any of the following heuristics are detected: (a) the user explicitly rejects the agent's approach in a message (contains "that's wrong", "no, you should", "revert that", "undo that", or equivalent rejection language); (b) the user provides replacement code or a replacement approach directly in a message; (c) the user reverts or undoes a change (references a prior state or explicitly asks to go back).
3. **FR-1.3:** The rule file MUST define Trigger 2 — Repeated Error Pattern. The agent MUST write a lesson when the same deviation rule category (Rule 1, 2, 3, or 4 from Section 1 FR-2) fires two or more times within a single feature's implementation.
4. **FR-1.4:** The rule file MUST define Trigger 3 — Quality Gate Failure. The `/merge-ready` command MUST write a lesson after quality gate execution completes, covering both resolved failures (auto-fix succeeded) and unresolved failures (retry budget exhausted).
5. **FR-1.5:** The rule file MUST define the lesson entry format: a markdown list item containing (a) date in `YYYY-MM-DD` format, (b) trigger type (`User Correction`, `Repeated Error`, or `Gate Failure`), (c) what happened (concrete description of the error or correction), (d) what to do instead (concrete prevention heuristic in ALWAYS/NEVER/WHEN phrasing).
6. **FR-1.6:** The rule file MUST define prevention rule elevation thresholds: a lesson elevates to a prevention rule when it recurs in 2 or more features for security/data-integrity categories, or 3 or more features for general patterns.
7. **FR-1.7:** The rule file MUST define prevention rule retirement: a prevention rule is archived when it has not been confirmed (triggered or demonstrably prevented a mistake) in 10 consecutive features, or when the file or pattern it references no longer exists in the project.
8. **FR-1.8:** The rule file MUST define the context budget: only the `## Prevention Rules` section (always) and the 5 most recent entries from `## Lessons Log` (selectively) are read during slice pre-flight and context refresh. The full file is NOT read into context unless explicitly debugging the lesson system.
9. **FR-1.9:** The rule file MUST define the parallel subagent skip: subagents executing slices in a parallel wave MUST NOT write to `.claude/lessons.md`. The orchestrator (`develop-feature`) is the sole writer during parallel waves, consistent with Section 2 FR-2.6.
10. **FR-1.10:** The rule file MUST define the 50-entry consolidation: when `## Lessons Log` exceeds 50 entries, the agent MUST consolidate redundant lessons (merge lessons describing the same root cause) before adding a new entry.

#### FR-2: Lessons Template and Install

Create a project-local template file and update the install script to provision it.

1. **FR-2.1:** A new file `templates/lessons.md` MUST exist with the following empty structure: a `## Prevention Rules` section (with a placeholder comment that it starts empty), and a `## Lessons Log` section (with a placeholder comment for the first entry format). No actual lessons are pre-populated.
2. **FR-2.2:** `install.sh` MUST copy `templates/lessons.md` to `.claude/lessons.md` in the target project when run with the `--init-project` flag. The copy MUST be skipped (not overwrite) if `.claude/lessons.md` already exists.
3. **FR-2.3:** `templates/settings.json` MUST be updated to grant Edit and Write permissions for `.claude/lessons.md` so the agent can write to it without a permission prompt.
4. **FR-2.4:** The install banner displayed by `install.sh` MUST update the rule file count from 4 to 5 to reflect the addition of `lessons.md`.
5. **FR-2.5:** The help text output by `install.sh --help` MUST mention `lessons.md` alongside `scratchpad.md` as a project-local file provisioned by `--init-project`.

#### FR-3: Session-Start Reading

Update the scratchpad rule file to instruct agents to read lessons at session start.

1. **FR-3.1:** The `## MUST Read` section of `src/rules/scratchpad.md` MUST gain a bullet point: "Read `.claude/lessons.md` Prevention Rules section at session start (if the file exists). Note any prevention rules relevant to the current feature."
2. **FR-3.2:** The new bullet MUST appear immediately after the existing bullet that instructs reading `.claude/scratchpad.md`.

#### FR-4: Implement-Slice Integration

Update `/implement-slice` to scan prevention rules before each slice and capture lessons after each commit.

1. **FR-4.1:** The pre-flight check list in `src/commands/implement-slice.md` MUST gain a new item (#5): "If `.claude/lessons.md` exists, read the `## Prevention Rules` section. Note any rules relevant to the files or patterns in this slice. If a relevant rule exists, add a note to the slice context before implementing."
2. **FR-4.2:** After the commit step in `src/commands/implement-slice.md`, a new step MUST be added (Step 6 — Capture Lessons): "Check Trigger 1 (did the user correct you during this slice?) and Trigger 2 (did the same deviation rule category fire 2+ times during this feature?). If either trigger is active and `.claude/lessons.md` exists, write a lesson entry to `## Lessons Log` now."
3. **FR-4.3:** The existing scratchpad update step MUST be renumbered to Step 7.
4. **FR-4.4:** When `implement-slice` is executing as a parallel subagent (wave context present, per Section 2 FR-3.3), Steps 6 and 7 MUST both be skipped. The orchestrator handles lesson capture and scratchpad updates for parallel waves.

#### FR-5: Merge-Ready Integration

Update `/merge-ready` to capture quality gate failures as lessons after gate execution.

1. **FR-5.1:** `src/commands/merge-ready.md` MUST gain a "Post-Gate Lesson Capture" section that fires after all gates complete, regardless of the overall outcome (MERGE READY or NOT MERGE READY).
2. **FR-5.2:** When the overall result is MERGE READY but one or more gates required an auto-fix (deviation Rule 1 or 2 resolved an issue inline), the Post-Gate Lesson Capture MUST write a Trigger 3 lesson for each gate that required auto-fixing, describing what the auto-fix corrected and what the pre-implementation check should have caught.
3. **FR-5.3:** When the overall result is NOT MERGE READY because a gate exhausted its retry budget, the Post-Gate Lesson Capture MUST write a Trigger 3 lesson for each failed gate, describing the failure pattern and the slice-level or planning-level action that would have prevented it.
4. **FR-5.4:** The Post-Gate Lesson Capture MUST be skipped (with a note in the output) if `.claude/lessons.md` does not exist.

#### FR-6: Context-Refresh Integration

Update `/context-refresh` to include lessons in the context rebuild.

1. **FR-6.1:** `src/commands/context-refresh.md` MUST gain a new step 1.5 (between reading the scratchpad and reading the plan): "If `.claude/lessons.md` exists, read the `## Prevention Rules` section in full and the 5 most recent entries from `## Lessons Log`. Summarise the relevant rules for the current feature."
2. **FR-6.2:** The context-refresh output format MUST include a "Lessons" line showing the count of prevention rules active and the 5 most recent lesson dates.
3. **FR-6.3:** When `context-refresh` detects that `## Lessons Log` has more than 50 entries, it MUST add a consolidation prompt to its output: "Lessons Log has N entries (>50). Consider running consolidation before the next slice."

#### FR-7: Develop-Feature Integration

Update `/develop-feature` to inject prevention rules into Phase 2 and capture wave-level lessons post-wave.

1. **FR-7.1:** At the start of Phase 2 (implementation), `src/commands/develop-feature.md` MUST instruct the orchestrator: "If `.claude/lessons.md` exists, read the `## Prevention Rules` section and note any rules relevant to the files in this feature's plan before spawning any subagents."
2. **FR-7.2:** After all subagents in a wave complete (the post-wave result collection step, per Section 2 FR-2.5), the orchestrator MUST check Trigger 2 across the entire wave: if the same deviation rule category fired in 2 or more slices within the wave, write a wave-level lesson to `.claude/lessons.md`.
3. **FR-7.3:** For slices that failed (retry budget exhausted), the orchestrator MUST also write a Trigger 3 lesson covering the failed slice's pattern.
4. **FR-7.4:** All lesson writes in FR-7.2 and FR-7.3 MUST be performed by the orchestrator, not by subagents (consistent with FR-1.9 and Section 2 FR-2.6).

#### FR-8: Bootstrap-Feature and Planner Integration

Update `/bootstrap-feature` and the planner agent to consult prevention rules before producing the implementation plan.

1. **FR-8.1:** `src/commands/bootstrap-feature.md` Step 5 (invoke planner) MUST include an instruction: "Before producing the implementation plan, read `.claude/lessons.md` Prevention Rules section if the file exists. Incorporate any relevant prevention rules into slice notes under a `Prevention:` sub-field."
2. **FR-8.2:** `src/agents/planner.md` document reading list MUST include `.claude/lessons.md` (with an existence guard) alongside the plan file, use cases, and PRD sections.
3. **FR-8.3:** The planner's per-slice output format MUST support an optional `Prevention:` sub-field. When one or more prevention rules are relevant to a slice, the planner MUST list them under `Prevention:` so the implementer reads them at slice start. When no rules are relevant, the field is omitted.

#### FR-9: Documentation

Update user-facing documentation to describe the self-improvement loop.

1. **FR-9.1:** `src/claude.md` MUST gain a "Cross-Session Learning" subsection under the pipeline description. It MUST describe: (a) what `.claude/lessons.md` contains, (b) the three capture triggers, (c) the prevention rule elevation and retirement mechanism, and (d) where in the pipeline lessons are read versus written.
2. **FR-9.2:** `README.md` MUST add "Self-Improvement Loop" to the feature list (in the project overview or key features section), with a one-sentence description.
3. **FR-9.3:** `README.md`'s project setup output (the directory listing or setup confirmation text) MUST include `.claude/lessons.md` as one of the files provisioned by `--init-project`, alongside `.claude/scratchpad.md`.
4. **FR-9.4:** `install.sh` version string MUST be bumped to `3.2.0` to reflect this feature addition.

### 4.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files and shell script text only. No JavaScript, TypeScript, Python, or other runtime code is introduced. The install script changes are limited to file copy logic and text string updates (rule count, version, help text).
2. **NFR-2:** The feature is fully backward compatible. Projects without `.claude/lessons.md` are completely unaffected. Every instruction that reads or writes the file includes an existence guard (`if it exists` or `if the file exists`). Existing pipeline behavior for these projects is identical to pre-feature behavior.
3. **NFR-3:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). New projects provisioned with `--init-project` after install get `.claude/lessons.md` automatically. Existing projects that want the feature must run `bash install.sh --init-project` to provision the file (the install must not overwrite an existing file).
4. **NFR-4:** No new agents are added. The total agent count remains at 13. Lesson capture is implemented as behavioral rules in existing command and rule files, not as a new specialized agent. All existing agent counts in `README.md` and `src/claude.md` remain valid.
5. **NFR-5:** The lessons rule file (`src/rules/lessons.md`) is installed to `~/.claude/rules/` (global scope, applies to every project). The lessons data file (`templates/lessons.md`, copied to `.claude/lessons.md`) is project-local scope. This mirrors the scratchpad pattern: global rules in `~/.claude/rules/scratchpad.md`, project data in `.claude/scratchpad.md`.
6. **NFR-6:** Context budget is bounded. The `## Prevention Rules` section is always read in full (expected to remain short — typically 0-10 rules). Only the 5 most recent `## Lessons Log` entries are read during pre-flight and context refresh. The full log is never loaded into context during normal operation.

### 4.5 Acceptance Criteria

1. **AC-1:** `src/rules/lessons.md` exists with structured sections covering: MUST Read protocol, all three capture triggers with concrete detection heuristics (Trigger 1 includes the rejection-language heuristics from FR-1.2), prevention rule elevation thresholds (FR-1.6), prevention rule retirement (FR-1.7), context budget (FR-1.8), parallel subagent skip (FR-1.9), and 50-entry consolidation (FR-1.10).
2. **AC-2:** `templates/lessons.md` exists with an empty `## Prevention Rules` section and an empty `## Lessons Log` section, and no pre-populated lesson entries.
3. **AC-3:** `install.sh` copies `templates/lessons.md` to `.claude/lessons.md` when `--init-project` is specified. If `.claude/lessons.md` already exists, the copy is skipped (existing file is not overwritten). The install banner reports 5 rule files. The version string reads `3.2.0`.
4. **AC-4:** `templates/settings.json` grants Edit and Write permissions for `.claude/lessons.md`.
5. **AC-5:** `src/rules/scratchpad.md` MUST Read section contains a bullet instructing agents to read `.claude/lessons.md` Prevention Rules at session start if the file exists.
6. **AC-6:** `src/commands/implement-slice.md` pre-flight checklist contains item #5 (scan Prevention Rules if file exists). The post-commit section contains Step 6 (Capture Lessons for Triggers 1-2). Step 6 and the scratchpad step are both skipped when running as a parallel subagent.
7. **AC-7:** `src/commands/merge-ready.md` contains a "Post-Gate Lesson Capture" section that fires after all gates complete. The section handles both the MERGE READY path (auto-fix lessons) and the NOT MERGE READY path (failure pattern lessons). It is a no-op when `.claude/lessons.md` does not exist.
8. **AC-8:** `src/commands/context-refresh.md` contains step 1.5 reading Prevention Rules and the 5 most recent Lessons Log entries (existence-guarded). The output format includes a Lessons summary line. A consolidation prompt appears when the log exceeds 50 entries.
9. **AC-9:** `src/commands/develop-feature.md` Phase 2 reads prevention rules before spawning subagents (existence-guarded). Post-wave result collection includes Trigger 2 and Trigger 3 lesson capture performed by the orchestrator only.
10. **AC-10:** `src/commands/bootstrap-feature.md` Step 5 instructs the planner to read prevention rules before producing the plan. `src/agents/planner.md` document reading list includes `.claude/lessons.md` with an existence guard. The planner's per-slice format supports an optional `Prevention:` sub-field.
11. **AC-11:** `src/claude.md` contains a "Cross-Session Learning" subsection describing the four elements in FR-9.1. `README.md` lists "Self-Improvement Loop" in the feature list and includes `.claude/lessons.md` in the project setup output.
12. **AC-12:** No instruction that references `.claude/lessons.md` is missing an existence guard. This is verifiable by searching all modified command and rule files for "lessons.md" and confirming each occurrence is conditioned on file existence.

### 4.6 Affected Components

#### New Files

| File | Purpose | Install Destination |
|------|---------|---------------------|
| `src/rules/lessons.md` | Lesson capture rules — capture triggers, entry format, elevation/retirement, context budget, parallel skip | `~/.claude/rules/lessons.md` (global) |
| `templates/lessons.md` | Empty lessons template with section scaffolding | `.claude/lessons.md` (project-local, via `--init-project`) |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `install.sh` | Add `templates/lessons.md` copy in `--init-project` block (skip if exists); update rule count 4→5 in install banner; update version string to `3.2.0`; update `--help` text to mention `lessons.md` | FR-2.2, FR-2.4, FR-2.5, FR-9.4 |
| `templates/settings.json` | Add Edit and Write permissions for `.claude/lessons.md` | FR-2.3 |
| `src/rules/scratchpad.md` | Add session-start lessons reading bullet to MUST Read section | FR-3.1, FR-3.2 |
| `src/commands/implement-slice.md` | Add pre-flight check #5 (Prevention Rules scan); add Step 6 (Capture Lessons); renumber scratchpad step to Step 7; add parallel subagent skip for Steps 6-7 | FR-4.1, FR-4.2, FR-4.3, FR-4.4 |
| `src/commands/merge-ready.md` | Add Post-Gate Lesson Capture section (Trigger 3, both MERGE READY and NOT MERGE READY paths, existence-guarded) | FR-5.1, FR-5.2, FR-5.3, FR-5.4 |
| `src/commands/context-refresh.md` | Add step 1.5 (Prevention Rules + 5 recent lessons); add Lessons line to output format; add consolidation prompt when log >50 entries | FR-6.1, FR-6.2, FR-6.3 |
| `src/commands/develop-feature.md` | Add Phase 2 prevention rules pre-read; add post-wave Trigger 2 and Trigger 3 lesson capture (orchestrator-only) | FR-7.1, FR-7.2, FR-7.3, FR-7.4 |
| `src/commands/bootstrap-feature.md` | Add planner instruction to read prevention rules before producing plan; add `Prevention:` sub-field mention | FR-8.1 |
| `src/agents/planner.md` | Add `.claude/lessons.md` to document reading list (existence-guarded); add optional `Prevention:` sub-field to per-slice output format | FR-8.2, FR-8.3 |
| `src/claude.md` | Add Cross-Session Learning subsection | FR-9.1 |
| `README.md` | Add Self-Improvement Loop to feature list; add `.claude/lessons.md` to project setup output | FR-9.2, FR-9.3 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Architecture review runs in Phase 1, before slices exist. Prevention rules are a slice-level concern. No change needed. |
| `src/agents/ba-analyst.md` | Use case analysis runs in Phase 1. No lesson capture occurs here. No change needed. |
| `src/agents/qa-planner.md` | Test case generation runs in Phase 1. No lesson capture occurs here. No change needed. |
| `src/agents/prd-writer.md` | PRD writing runs in Phase 1. No lesson capture occurs here. No change needed. |
| `src/agents/test-writer.md` | Test writing happens within individual slices; prevention rules are surfaced to the implementer via the `Prevention:` sub-field in the plan, not by having test-writer read lessons.md directly. |
| `src/agents/security-auditor.md` | Security review runs in Phase 1.5 and Phase 4. Security findings flow into lessons via the merge-ready Post-Gate Lesson Capture (FR-5). No direct lessons.md read required. |
| `src/agents/code-reviewer.md` | Code review runs in Phase 4. Same pattern as security-auditor. No direct lessons.md read required. |
| `src/agents/build-runner.md` | Build verification runs in Phase 4. Gate failures flow into lessons via FR-5. No direct lessons.md read required. |
| `src/agents/e2e-runner.md` | E2E tests run in Phase 4. Gate failures flow into lessons via FR-5. No direct lessons.md read required. |
| `src/agents/doc-updater.md` | Documentation update runs in Phase 4. No lesson capture occurs here. No change needed. |
| `src/agents/refactor-cleaner.md` | Cleanup runs after all waves complete. No lesson capture occurs here. No change needed. |
| `src/agents/verifier.md` | Verification runs in Phase 4. Gate failures flow into lessons via FR-5. No direct lessons.md read required. |
| `src/rules/git.md` | Git workflow rules unchanged. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. |
| `src/rules/error-recovery.md` | Deviation rules (Section 1 FR-2) are the trigger conditions for Trigger 2 lesson capture, but the error recovery rule file itself does not need to reference lessons.md. Trigger 2 capture is defined in `src/rules/lessons.md` and wired into the commands. |
| `docs/qa/pipeline-hardening_test_cases.md` | Agent model tiers were updated by Section 3. No further changes from this feature. |
| `CONTRIBUTING.md` | Agent template guidance (Section 3 FR-5). No lessons-related contributor guidance required beyond what is in the rule file. |

### 4.7 UI Changes

Not applicable. This project is a collection of markdown prompt files with no user interface.

### 4.8 Schema Changes

Not applicable. This project has no database.

### 4.9 Affected Endpoints

Not applicable. This project has no API.

### 4.10 Risks and Dependencies

1. **Risk: Lesson quality depends on agent self-awareness.** The agent must recognize when it is being corrected (Trigger 1). Mitigation: FR-1.2 provides concrete detection heuristics (explicit rejection language, user-provided replacement code, revert requests) rather than relying on vague judgment. If a correction is missed, the quality gate failure path (Trigger 3) provides a second capture opportunity.
2. **Risk: Lessons file growth.** Without bounds, `## Lessons Log` could grow large enough to degrade context budget. Mitigation: FR-1.8 limits reads to 5 recent entries and the Prevention Rules section only. FR-1.10 defines a 50-entry consolidation trigger. FR-1.7 retires stale prevention rules after 10 features.
3. **Risk: Over-specific lessons.** A lesson written for a very specific file path or function name in one project may be irrelevant or misleading in another. Mitigation: FR-1.5 requires the "what to do instead" field to use ALWAYS/NEVER/WHEN phrasing that generalizes beyond the specific instance. Prevention rule retirement (FR-1.7) removes rules referencing deleted files or patterns.
4. **Risk: Race condition in parallel waves.** Multiple subagents writing to `lessons.md` simultaneously would corrupt the file. Mitigation: FR-1.9 explicitly prohibits subagent writes to `lessons.md`; only the orchestrator writes, consistent with Section 2 FR-2.6 for scratchpad. The parallel subagent skip in FR-4.4 enforces this for `implement-slice`.
5. **Risk: Backward compatibility regression.** Commands modified by this feature must not break projects that have no `.claude/lessons.md`. Mitigation: every read/write reference to `lessons.md` in the command files includes an existence guard (FR-2.2, AC-12). The absence of the file is explicitly handled as a no-op in each integration point.
6. **Risk: Stale prevention rules degrading plan quality.** A prevention rule that no longer applies may cause the planner to add unnecessary `Prevention:` notes to slices, adding noise. Mitigation: FR-1.7 defines a retirement mechanism based on non-confirmation over 10 features and reference-validity checks.
7. **Risk: Install script overwrites existing lessons.** A re-install should update global rule files but must not destroy project-local lesson history. Mitigation: FR-2.2 specifies the copy is skipped if `.claude/lessons.md` already exists. This is a hard requirement on the install script implementation.
8. **Dependency: Section 1 FR-2 (Deviation Rules).** Trigger 2 lesson capture uses deviation rule categories (Rule 1-4) as the unit of recurrence. If a project is on a pre-Section 1 pipeline version without deviation rules, Trigger 2 has no rule categories to track. Mitigation: Section 1 is marked [SHIPPED], so this dependency is satisfied for all current users.
9. **Dependency: Section 2 FR-2.6 (orchestrator-only scratchpad writes).** The orchestrator-only write pattern for lessons in parallel mode (FR-1.9, FR-7.4) is an extension of the same pattern established for scratchpad in Section 2. If that pattern is not present in `develop-feature.md`, the lessons write pattern cannot be consistently enforced. Mitigation: Section 2 is marked [DRAFT] but its core orchestrator-only write requirement is already in place.

---

## 5. Changelog Automation

**Status:** [SHIPPED]
**Date:** 2026-06-02
**Priority:** Medium
**Related:** Section 2 (FR-2.6: orchestrator-only writes in parallel mode), Section 4 (FR-5: merge-ready finalization pattern)

### 5.1 Description

Wire a `CHANGELOG.md` instruction into the SDLC framework's global instruction files so that every project using this setup automatically receives a human-readable changelog entry whenever work completes. The entry is written to the project-root `CHANGELOG.md` by the agent (via `doc-updater` in the merge-ready path, or directly in the standalone-fix path) using a real UTC timestamp retrieved via shell command — never hallucinated.

**Why:** The SDLC framework already produces well-structured commits and a detailed PRD, but neither artifact gives a non-technical stakeholder a quick overview of what changed and when. A `CHANGELOG.md` fills that gap. Because the instruction lives in the global framework files, it applies to every project using this setup without per-project configuration.

**Design decisions:**
1. **Two trigger points** — `/merge-ready` (after all gates PASS) and standalone `/implement-slice` (not driven by `/develop-feature`, not a parallel-wave subagent). These are the two natural completion events in the pipeline. `/develop-feature` ends via `/merge-ready`, so it does not write directly.
2. **Suppression flag** — `/develop-feature` passes a `no-changelog` flag to every `/implement-slice` it drives so only merge-ready writes. The flag covers both the single-slice-wave direct path and parallel-wave subagents.
3. **Idempotency guard** — before writing, check whether an entry with the same feature/fix name already exists under today's `## YYYY-MM-DD` heading. If it does, update it rather than appending a duplicate. This is the definitive double-write prevention mechanism, making the system safe even if trigger-ownership heuristics misfire.
4. **No new agent** — changelog writing is a mechanical append operation delegated to the existing `doc-updater` agent (from the merge-ready path) or performed inline (standalone-fix path). No new specialized agent is needed.
5. **New global rule** — `src/rules/changelog.md` is the single authoritative source for the format, procedure, and trigger rules. All commands reference this rule rather than duplicating its content.

### 5.2 User Story

As a developer using the Claude Code SDLC pipeline, I want a `CHANGELOG.md` updated automatically at the project root whenever a feature or fix completes, so that I and my stakeholders can see a concise, human-readable record of what changed and when, without consulting git history.

### 5.3 Functional Requirements

#### FR-1: Changelog Rule File

Create a new global rule at `src/rules/changelog.md` that is the single authoritative source for the changelog format, procedure, and trigger rules.

1. **FR-1.1:** The rule file MUST define the entry format. Each entry MUST contain exactly four fields: (a) **Date + time** — UTC timestamp in `HH:MM UTC` format; (b) **Name** — the feature or fix name; (c) **Summary** — a simple, non-technical one-liner; (d) **Details** — a fuller description capped at 500 characters.
2. **FR-1.2:** The rule file MUST define the file structure: entries are grouped by UTC day under `## YYYY-MM-DD` headings, with the newest day heading first (at the top) and the newest entry first within each day. Individual entries use the heading format `### <name> — <HH:MM> UTC` with `**Summary:**` and `**Details:**` lines below.
3. **FR-1.3:** The rule file MUST define the writer procedure as a numbered sequence: (1) run `date -u +'%Y-%m-%d %H:%M'` via Bash to retrieve the real UTC timestamp — **never invent the date or time**; (2) if `CHANGELOG.md` is absent, create it with the `# Changelog` header block; (3) if a `## <today's date>` heading already exists, insert the new entry as the first entry under it; otherwise insert a new `## <today's date>` block immediately after the header (above older day headings); (4) enforce the 500-character cap on Details, trimming if needed; (5) apply the idempotency guard before writing.
4. **FR-1.4:** The rule file MUST define the UTC timestamp retrieval requirement explicitly: the agent MUST run `date -u` via Bash and use the output. The agent MUST NOT invent or estimate the date or time.
5. **FR-1.5:** The rule file MUST define the 500-character cap on the Details field. If the intended Details text exceeds 500 characters, it MUST be trimmed to fit.
6. **FR-1.6:** The rule file MUST define the idempotency guard: before writing a new entry, check whether an entry with the same feature/fix name already exists under today's `## YYYY-MM-DD` heading. If a matching entry exists, update it in place rather than appending a duplicate.
7. **FR-1.7:** The rule file MUST define the two trigger points and their ownership: (a) `/merge-ready` writes one entry as its finalization step, after all gates PASS — this covers everything taken through quality gates (features and fixes alike); (b) a standalone `/implement-slice` (invoked directly by the user, no `no-changelog` suppression flag, not a parallel-wave subagent) writes one entry at completion.
8. **FR-1.8:** The rule file MUST define the suppression-flag mechanism: when `/develop-feature` drives `/implement-slice` (either the single-slice-wave direct path or as a parallel-wave subagent spawn), it passes a `no-changelog` flag. Any `/implement-slice` receiving this flag MUST skip the changelog step. This ensures exactly one entry per feature — written by merge-ready, not by each slice.
9. **FR-1.9:** The rule file MUST state that parallel-wave subagents MUST NOT write to `CHANGELOG.md`, consistent with Section 2 FR-2.6 (orchestrator-only writes).
10. **FR-1.10:** The rule file MUST define an OPTIONAL `Technical details` field for projects that want an engineering-leadership view. When present it MUST be written at CTO level — user-facing screens, API endpoints (purpose and access level), services/components, and architecture/infrastructure/deployment changes plus data/deployment impact — and MUST NOT include file paths, function/component/symbol names, library mechanics, slice counts, or other low-level minutiae.

#### FR-2: Merge-Ready Finalization Step

Add a changelog finalization step to `/merge-ready` that fires only after all quality gates PASS.

1. **FR-2.1:** `src/commands/merge-ready.md` MUST gain a **"Finalization: Changelog Entry"** section. This section is explicitly NOT a numbered quality gate and is excluded from the gate pass/fail table and the auto-fix rerun loop.
2. **FR-2.2:** The finalization step MUST execute only after all quality gates report PASS. It MUST NOT execute when the overall result is NOT MERGE READY.
3. **FR-2.3:** The finalization step MUST retrieve the UTC timestamp by running `date -u +'%Y-%m-%d %H:%M'` via Bash. The instruction text MUST contain `date -u` explicitly.
4. **FR-2.4:** The finalization step MUST delegate the file write to `doc-updater`, referencing `src/rules/changelog.md` as the format authority.
5. **FR-2.5:** The finalization step MUST apply the idempotency guard (as defined in FR-1.6) before writing.

#### FR-3: Standalone Implement-Slice Changelog Step

Add a conditional changelog step to `/implement-slice` that fires only for standalone use (not pipeline-driven).

1. **FR-3.1:** `src/commands/implement-slice.md` MUST gain a changelog step after the commit step (and before the scratchpad update step).
2. **FR-3.2:** The step MUST include both skip conditions explicitly: (a) skip if running as a parallel-wave subagent; (b) skip if the `no-changelog` suppression flag was passed (i.e., the command was invoked by `/develop-feature`). If either condition holds, the step is a no-op.
3. **FR-3.3:** When neither skip condition holds, the step MUST run `date -u` to retrieve the real UTC timestamp and write one changelog entry per the format in `src/rules/changelog.md`.
4. **FR-3.4:** The step MUST apply the idempotency guard (as defined in FR-1.6) before writing.

#### FR-4: Develop-Feature Suppression Flag

Update `/develop-feature` to pass the `no-changelog` suppression flag to every `/implement-slice` it drives.

1. **FR-4.1:** `src/commands/develop-feature.md` Phase 2 MUST include an instruction to pass the `no-changelog` suppression flag to every `/implement-slice` invocation it drives, covering both the single-slice-wave direct path and the parallel-wave subagent spawn prompt.
2. **FR-4.2:** Phase 3 of `src/commands/develop-feature.md` (or the merge-ready delegation point) MUST note that the single changelog entry for the feature is written by merge-ready, not by any slice.

#### FR-5: Doc-Updater Changelog Responsibility

Update `src/agents/doc-updater.md` to recognise `CHANGELOG.md` as a file it is explicitly responsible for maintaining.

1. **FR-5.1:** `src/agents/doc-updater.md` MUST list `CHANGELOG.md` in its responsibilities.
2. **FR-5.2:** The existing constraint in `doc-updater.md` that prohibits creating new documentation files unless explicitly requested MUST explicitly exempt `CHANGELOG.md` — the agent MAY create or append to `CHANGELOG.md` as part of its normal responsibilities.
3. **FR-5.3:** `src/agents/doc-updater.md` MUST reference `src/rules/changelog.md` as the format authority.

#### FR-6: Global Workflow Documentation (claude.md)

Update `src/claude.md` to surface changelog writing as a pipeline responsibility.

1. **FR-6.1:** The `doc-updater` row in the Agency Roles table in `src/claude.md` MUST include changelog maintenance in its Responsibility column.
2. **FR-6.2:** The Phase 4 quality-gates description in `src/claude.md` MUST reference the changelog finalization step.
3. **FR-6.3:** The deliverables checklist (the items listed under `/bootstrap-feature` or the "What Every Plan MUST Include" section) in `src/claude.md` MUST include a `CHANGELOG.md entry` item.

#### FR-7: Template and Scaffold

Provide a starter `CHANGELOG.md` template that is dropped into new projects by `--init-project`.

1. **FR-7.1:** A new file `templates/CHANGELOG.md` MUST exist containing the `# Changelog` header block only (no entries). It serves as the scaffold for newly initialised projects.
2. **FR-7.2:** `install.sh`'s `scaffold_project()` function MUST contain a `cp` command that copies `templates/CHANGELOG.md` to `CHANGELOG.md` at the project root. This line MUST be present literally (verifiable by grep).
3. **FR-7.3:** The `--help` text and scaffold "What gets created" output of `install.sh` MUST mention `CHANGELOG.md`.
4. **FR-7.4:** `install.sh` MUST pass a syntax check (`bash -n install.sh`) after the scaffold change is applied.

#### FR-8: README Documentation

Document the changelog behavior in `README.md`.

1. **FR-8.1:** `README.md` MUST contain a section or paragraph describing the changelog behavior, naming all four entry fields (Date+time UTC, Name, Summary, Details).
2. **FR-8.2:** The documentation MUST identify both trigger points: merge-ready (after gates PASS) for features and fixes taken through quality gates, and standalone `/implement-slice` for standalone fixes.

### 5.4 Non-Functional Requirements

1. **NFR-1:** All changes are markdown prompt files and shell script text only. No JavaScript, TypeScript, Python, or other runtime code is introduced. The installer changes are limited to a file-copy line and help-text strings.
2. **NFR-2:** Timestamps MUST be real, not hallucinated. Every instruction that writes a timestamp MUST call `date -u` via Bash and use the result. Instructions MUST explicitly forbid inventing or estimating the date or time.
3. **NFR-3:** The feature is fully backward compatible. Projects that have no `CHANGELOG.md` are handled by the writer procedure's "create if absent" logic (FR-1.3). No existing pipeline behavior is removed or changed — only new steps are added at natural completion points.
4. **NFR-4:** Exactly one changelog entry is written per completed unit of work. The combination of trigger-ownership rules (FR-1.7, FR-1.8), the suppression flag (FR-4.1), and the idempotency guard (FR-1.6) enforces this even under failure or re-run scenarios.
5. **NFR-5:** No new agents are added. The total agent count remains at 13. Changelog writing is delegated to the existing `doc-updater` agent (merge-ready path) or performed inline (standalone-fix path). All existing agent counts in `README.md` and `src/claude.md` remain valid.
6. **NFR-6:** Changes take effect on the next Claude Code session after re-install (`bash install.sh`). New projects scaffolded with `--init-project` after install receive a starter `CHANGELOG.md`. Existing projects that have no `CHANGELOG.md` will have one created automatically the first time a changelog write fires.

### 5.5 Acceptance Criteria

1. **AC-1:** `src/rules/changelog.md` exists and contains: the four required entry fields (FR-1.1), the day-grouping structure with newest-day-first ordering (FR-1.2), the five-step writer procedure (FR-1.3), an explicit `date -u` retrieval requirement that forbids inventing the value (FR-1.4), the 500-character cap (FR-1.5), the idempotency guard (FR-1.6), the two trigger-point definitions with ownership rules (FR-1.7), and the suppression-flag mechanism (FR-1.8).
2. **AC-2:** `src/commands/merge-ready.md` contains a "Finalization: Changelog Entry" section. The section text contains `date -u`. The section explicitly states it runs only after all gates PASS and is not a numbered gate. It references the idempotency guard.
3. **AC-3:** `src/commands/implement-slice.md` contains a changelog step after the commit step. The step text contains `date -u`. The step explicitly states both skip conditions (parallel-wave subagent and `no-changelog`/develop-feature suppression). It references the idempotency guard.
4. **AC-4:** `src/commands/develop-feature.md` contains `no-changelog` in its Phase 2 subagent spawn prompt and in its single-slice-wave direct path. Phase 3 (or the merge-ready delegation point) notes that merge-ready writes the entry.
5. **AC-5:** `src/agents/doc-updater.md` lists `CHANGELOG.md` in its responsibilities, explicitly exempts it from the "do not create new files" constraint, and references `src/rules/changelog.md`.
6. **AC-6:** `grep -c "[Cc]hangelog" src/claude.md` returns at least 3 matches. The `doc-updater` role row, the Phase 4 description, and the deliverables checklist each contain a changelog reference (verifiable per anchor).
7. **AC-7:** `templates/CHANGELOG.md` exists and starts with `# Changelog`. `grep -q 'cp "$SCRIPT_DIR/templates/CHANGELOG.md"' install.sh` passes (the literal copy line is present). `bash -n install.sh` passes (syntax valid).
8. **AC-8:** `README.md` names all four entry fields and both trigger points.
9. **AC-9:** No changelog-writing instruction in any modified file is missing the `date -u` retrieval requirement. Verifiable by searching all modified files for the word "changelog" and confirming each write-path occurrence also contains `date -u` or a reference to the rule that mandates it.
10. **AC-10:** An end-to-end smoke test confirms: running `/merge-ready` on a passing feature creates or updates `CHANGELOG.md` at the project root with an entry under the correct `## YYYY-MM-DD` heading, using a real UTC timestamp, with Summary and Details fields, and Details not exceeding 500 characters. Running `/merge-ready` again for the same feature name does not create a duplicate entry.

### 5.6 Affected Components

#### New Files

| File | Purpose | Install Destination |
|------|---------|---------------------|
| `src/rules/changelog.md` | Changelog format, writer procedure, trigger rules, idempotency guard, suppression flag | `~/.claude/rules/changelog.md` (global, via `install.sh` glob) |
| `templates/CHANGELOG.md` | Starter changelog scaffold (header block only) for new projects | `CHANGELOG.md` at project root (via `--init-project`) |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `src/agents/doc-updater.md` | Add CHANGELOG.md to responsibilities; exempt it from the "do not create new files" constraint; reference `src/rules/changelog.md` | FR-5.1, FR-5.2, FR-5.3 |
| `src/commands/merge-ready.md` | Add "Finalization: Changelog Entry" section (non-gate, post-all-gates-PASS, `date -u`, delegates to doc-updater, idempotency guard) | FR-2.1 through FR-2.5 |
| `src/commands/implement-slice.md` | Add changelog step after commit (standalone-fix path only; both skip conditions; `date -u`; idempotency guard) | FR-3.1 through FR-3.4 |
| `src/commands/develop-feature.md` | Add `no-changelog` suppression flag to Phase 2 spawn prompt and single-slice-wave path; note merge-ready owns the entry in Phase 3 | FR-4.1, FR-4.2 |
| `src/claude.md` | Update doc-updater role row; add changelog to Phase 4 description; add CHANGELOG entry item to deliverables checklist | FR-6.1, FR-6.2, FR-6.3 |
| `install.sh` | Add `cp templates/CHANGELOG.md CHANGELOG.md` inside `scaffold_project()`; update `--help` and scaffold output text | FR-7.2, FR-7.3, FR-7.4 |
| `README.md` | Document changelog behavior: four entry fields, two trigger points | FR-8.1, FR-8.2 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/agents/architect.md` | Architecture review runs in Phase 1, before completion events. No changelog writing occurs here. |
| `src/agents/ba-analyst.md` | Use case analysis runs in Phase 1. No changelog writing occurs here. |
| `src/agents/qa-planner.md` | Test case generation runs in Phase 1. No changelog writing occurs here. |
| `src/agents/prd-writer.md` | PRD writing runs in Phase 1. No changelog writing occurs here. |
| `src/agents/planner.md` | Implementation planning runs in Phase 2. No changelog writing occurs here. |
| `src/agents/test-writer.md` | Test writing happens within slices. The merge-ready or standalone-fix trigger covers the completion point. |
| `src/agents/security-auditor.md` | Security review runs in Phase 4 as a quality gate. Changelog entry is written by the finalization step after all gates PASS. |
| `src/agents/code-reviewer.md` | Code review runs in Phase 4. Same pattern as security-auditor. |
| `src/agents/build-runner.md` | Build verification runs in Phase 4. Same pattern. |
| `src/agents/e2e-runner.md` | E2E tests run in Phase 4. Same pattern. |
| `src/agents/verifier.md` | Verification runs in Phase 4. Same pattern. |
| `src/agents/refactor-cleaner.md` | Cleanup runs after waves complete. The merge-ready finalization step covers the completion point. |
| `src/rules/git.md` | Git workflow unchanged. Atomic commits per slice are preserved. |
| `src/rules/scratchpad.md` | Scratchpad rules unchanged. Changelog is a separate file with its own rule. |
| `src/rules/tool-limitations.md` | Tool limitation awareness unchanged. |
| `src/rules/error-recovery.md` | Deviation rules unchanged. The changelog finalization step is post-gates, not an error-recovery concern. |
| `src/commands/bootstrap-feature.md` | Bootstrap runs documentation phases only. No completion event occurs here. |
| `src/commands/context-refresh.md` | Context refresh is a read-only operation. No changelog writing occurs here. |
| `templates/settings.json` | No new file permission is required; `CHANGELOG.md` is a standard project file. |
| `CONTRIBUTING.md` | No contributor template changes needed for changelog; the rule file is the authority. |

### 5.7 UI Changes

Not applicable. This project is a collection of markdown prompt files with no user interface.

### 5.8 Schema Changes

Not applicable. This project has no database.

### 5.9 Affected Endpoints

Not applicable. This project has no API.

### 5.10 Risks and Dependencies

1. **Risk: Hallucinated timestamps.** If the agent invents a date or time instead of running `date -u`, changelog entries will be inaccurate and potentially misleading. Mitigation: FR-1.4 and FR-2.3 and FR-3.3 all require `date -u` to appear explicitly in the instruction text; AC-9 verifies this across all write paths. The QA test cases must assert that the `date -u` retrieval requirement is present in every write-path instruction.
2. **Risk: Duplicate entries from misfire of trigger-ownership.** If both merge-ready and implement-slice fire for the same work unit, two entries would appear under the same day. Mitigation: FR-1.8 (suppression flag) prevents the primary path. FR-1.6 (idempotency guard) catches any residual case — the guard is the definitive safety net regardless of which trigger fires.
3. **Risk: Details field over 500 characters.** Untrimmed Details could break the intended format. Mitigation: FR-1.5 mandates trimming and AC-1 requires the cap to be documented in the rule file.
4. **Risk: install.sh regression.** Editing `scaffold_project()` in `install.sh` could introduce a syntax error. Mitigation: FR-7.4 requires `bash -n install.sh` to pass after the change; AC-7 asserts the syntax check. The existing backup mechanism (`~/.claude/backup-*`) protects the user's current config.
5. **Risk: CHANGELOG.md is absent and the rule's "create if absent" logic is not reached.** If a project has no `CHANGELOG.md` and the agent skips the creation step, no entry is written. Mitigation: FR-1.3 step (2) explicitly requires creation if absent. The template (FR-7) ensures newly scaffolded projects have the file from day one, reducing the frequency of the "create" path.
6. **Risk: Parallel-wave subagent writes to CHANGELOG.md.** Concurrent writes would corrupt or duplicate entries. Mitigation: FR-1.9 explicitly prohibits subagent writes to `CHANGELOG.md`. FR-3.2 includes parallel-wave subagent as an explicit skip condition in the implement-slice changelog step.
7. **Dependency: Section 2 FR-2.6 (orchestrator-only writes).** The suppression-flag pattern and the parallel-subagent skip pattern follow the precedent established for `scratchpad.md` writes in Section 2. Section 2 is marked [DRAFT] but its orchestrator-only write requirement is the reference design.
8. **Dependency: Section 4 FR-5 (merge-ready finalization pattern).** The "Post-Gate Lesson Capture" pattern established in Section 4 (a non-gate step that fires after all gates complete) is the structural precedent for the "Finalization: Changelog Entry" step in FR-2. Both sections modify the same file (`src/commands/merge-ready.md`) and their sections must coexist without conflict.

---

## 6. Plugin Repackaging and Harness CI

**Status:** [DRAFT]
**Date:** 2026-08-14
**Priority:** High
**Related:** Section 3 (status changed to `[SUPERSEDED]` by this feature — see FR-6.4), Section 4 (NFR-1 "no runtime code is introduced" is directly contradicted — see NFR-1 below; the contradiction should also be annotated in Section 4 itself when F5's planned Section 4 revision lands, so it is not discoverable only by reading this section), Section 5 (`src/rules/changelog.md` is one of the files in the slash-command reference sweep, FR-7)

**Architect verdict (PASS):** The hybrid plugin+memory split is APPROVED. JavaScript is APPROVED but scoped: **Node is CI-only — `install.sh` MUST NOT invoke `node` or `jq`.** Structural/major gaps identified in review are closed below: the legacy `~/.claude/commands/` migration gap (FR-4), CI validators that pass vacuously on zero matched files (FR-5.9), a manifest format install.sh can parse without `node`/`jq` (FR-4.1), a per-install receipt for future drift detection (FR-4.8), a loud (non-blocking) preflight warning when the memory layer is missing (FR-8), and a corrected slash-command sweep scope (FR-7.2).

**Post-approval platform fact-check correction (does not reopen the approved architecture):** Claude Code's documented subagent precedence is managed settings > `--agents` flag > project `.claude/agents/` > user `~/.claude/agents/` > **plugin `agents/` (lowest)** — and, critically, plugin agents are **not** namespaced the way plugin skills are (`/plugin-name:skill-name`), so a same-named user-level agent does not coexist with the plugin agent, it fully shadows it; the plugin agent becomes reachable by no name at all. This invalidated the original design's assumption that `install.sh` should keep installing the 13 agents to `~/.claude/agents/` — doing so would have permanently shadowed the plugin's own `agents/` directory from day one. FR-2, FR-4, NFR-2, and the risk/acceptance-criteria entries below are corrected accordingly: `install.sh` no longer installs agents at all, and the manifest's `legacy` cleanup section grows from 5 entries (commands only) to 18 (commands + the 13 retired v3.1 agent copies). **Why this differs from skills, stated once so a future maintainer doesn't try to "fix" the asymmetry:** plugin skills are namespaced and coexist with same-named personal/project skills; plugin agents are not namespaced and are simply shadowed — there is no documented mechanism to make agents behave like skills here.

### 6.1 Description

Repackage the harness's executable assets (agents, commands) as a native Claude Code plugin distributed via `.claude-plugin/`, while keeping the always-on memory layer (`src/claude.md`, `src/rules/*.md`) on the existing `install.sh` mechanism. Add harness CI that validates every shipped asset on every push, reconcile the version and PRD-status drift that has accumulated since v2.1.0/v3.1.0, and sweep the 393 bare slash-command references created by the rename to plugin-namespaced skills.

**Why:** The harness has shipped `curl | bash` into `~/.claude` with no version stamp, no update path, and no uninstall since its first release. Claude Code has since shipped a native plugin system (`/plugin install`, `.claude-plugin/plugin.json`, `skills/`) that gives this harness a real distribution and update mechanism. Foundation work is required before any of the other v4.0 features (hook infrastructure, blocking guards, verification upgrades, tier routing, self-improvement) can land, because they all assume the plugin scaffold, the CI validators, and a manifest-driven installer exist.

**Design Decisions:**
1. **Hybrid plugin + memory installer, not a pure-plugin migration.** Claude Code auto-loads `~/.claude/claude.md` and `~/.claude/rules/*.md` as user memory — the sole channel by which the mandatory autonomous-pipeline instruction reaches every session. Plugins have no user-memory component type. A pure-plugin migration would pass `claude plugin validate`, resolve agents in `/agents`, and silently delete the pipeline instruction while every check stayed green. `src/claude.md` and `src/rules/*.md` therefore stay on `install.sh`; `agents/`, `skills/`, and (in a later feature) `hooks/` move into the plugin **and stay there exclusively** — `install.sh` MUST NOT also place a copy of any agent under `~/.claude/agents/`, because unlike skills, plugin agents are not namespaced and a user-level copy of the same name fully shadows the plugin's (see FR-2.5, FR-4.11).
2. **Commands become skills with real frontmatter, not a lift-and-shift.** All 5 files in `src/commands/*.md` currently ship with zero YAML frontmatter and no `$ARGUMENTS` handling. Converting them to `skills/<name>/SKILL.md` is the point at which they gain `description`, `argument-hint`, `arguments`, and `allowed-tools` — this is a functional upgrade, not a rename.
3. **Manifest-driven install/uninstall, never glob-based — and the manifest covers retired v3.1 paths too, now including the 13 retired agent copies.** `~/.claude/agents/` on the reference machine holds 16 files today; 3 of them (`brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md`) are the user's own agents, unrelated to this harness. A glob-based `rm ~/.claude/agents/*.md` would destroy them. The manifest enumerates exactly what the harness owns (now just `claude.md` and the 5 rule files — 6 entries, since agents no longer install to `~/.claude/agents/` at all), and all removal logic is scoped to that manifest. Critically, the manifest also enumerates v3.1-era paths this feature retires: the `legacy` section grows to 18 entries — the 5 `~/.claude/commands/*.md` files plus the 13 `~/.claude/agents/*.md` files v3.1 installed. The agent case is the more severe instance of the same shadowing failure: a leftover v3.1 agent copy does not merely coexist with the plugin's version (as a namespaced skill would), it takes precedence over it and renders the plugin agent unreachable by any name. A per-install receipt (FR-4.8) records what each specific install actually placed, closing the same ambiguity for all *future* retirements.
4. **CI validators must be falsifiable, including against an empty match set.** A validator that only ever passes on good input proves nothing about whether it actually checks anything — and a validator that silently passes when its glob matches zero files (e.g. run before `agents/`/`skills/` exist) is exactly as vacuous as one that never fails. Every validator added by this feature ships with a deliberately seeded bad fixture it must fail on, and asserts an expected minimum matched-file count rather than trusting an empty glob.
5. **Version and status debt is paid down here, not carried forward.** README badge (`3.1.0`) and `install.sh` `VERSION` (`2.1.0`) have drifted since Section 1 shipped. PRD Sections 2 and 5 are marked `[DRAFT]` despite being shipped; Section 3 is `[DRAFT]` and will never ship as originally specified because F4 (model routing, outside this feature's scope) supersedes it with a profile-driven rewrite mechanism. This feature corrects the drift and marks Section 3 `[SUPERSEDED]` rather than `[SHIPPED]`, since none of Section 3's FRs are implemented by this feature.
6. **JavaScript is introduced deliberately, not incidentally — and scoped to CI only.** This repo has been markdown-and-bash only since inception (Section 1.4 NFR-1, Section 2.4 NFR-1, Section 4.4 NFR-1 all state "no runtime code"). CI validators require a real parser for YAML frontmatter and JSON schemas that bash cannot reasonably provide. This feature explicitly supersedes that constraint for CI tooling only (see NFR-1) and requires an explicit architect verdict before implementation proceeds, per the roadmap's deliverables checklist. The architect's approval is conditional on a hard boundary: **`install.sh` itself MUST NOT invoke `node` or `jq`** — the Node runtime is a CI-time dependency only, never a dependency of the installer a user runs locally. This is why FR-4.1 mandates a manifest format `install.sh` can parse with POSIX shell built-ins alone.

### 6.2 User Story

As a developer using the Claude Code SDLC harness, I want to install and update the pipeline's agents and commands as a native Claude Code plugin — with a safe, reversible installer and CI that catches broken assets before they ship — so that the harness has a real distribution mechanism instead of an unversioned `curl | bash` copy, without losing the always-on pipeline instruction that today only `install.sh` can deliver.

### 6.3 Functional Requirements

#### FR-1: Plugin Packaging

Create the plugin manifest and marketplace descriptor required for `claude plugin validate` and `/plugin install` to work against this repo.

1. **FR-1.1 (corrected at merge-ready — `hooks` field is conditional, not required by this feature):** `.claude-plugin/plugin.json` MUST exist and MUST set, at minimum, the schema-required `name` field. It MUST additionally set `version`, `description`, `author`, and `license`, plus the component path fields `agents` and `skills`, pointing at this repo's `agents/` and `skills/` directories. The `hooks` component path field MUST NOT be set by this feature, because this feature ships no `hooks/` directory — pointing the manifest at a directory that does not exist risks failing `claude plugin validate .` (AC-1). The `hooks` field becomes required once F2a (hook infrastructure, a later roadmap feature) adds a `hooks/` directory to the repo; F2a's implementation is responsible for adding it to `plugin.json` at that time.
2. **FR-1.2:** `.claude-plugin/marketplace.json` MUST exist and MUST define a single, self-referencing plugin entry with `source: "./"`.
3. **FR-1.3:** `claude plugin validate .` run from the repo root MUST exit `0` against the manifest and marketplace files produced by FR-1.1 and FR-1.2.

#### FR-2: Asset Relocation

Move the harness's executable assets into the plugin's expected directory layout, upgrading commands to skills in the process.

1. **FR-2.1:** All 13 files currently in `src/agents/*.md` MUST be relocated to `agents/*.md` at the plugin root, with filenames and frontmatter content preserved byte-for-byte except where FR-6 requires a version-string change.
2. **FR-2.2:** Each of the 5 files currently in `src/commands/*.md` MUST become `skills/<name>/SKILL.md`, where `<name>` is the command's existing name (e.g. `src/commands/develop-feature.md` → `skills/develop-feature/SKILL.md`).
3. **FR-2.3:** Each relocated skill file MUST gain real YAML frontmatter with, at minimum, `description`, `argument-hint`, `arguments`, and `allowed-tools` fields. Today all 5 command files have **no YAML frontmatter at all**.
4. **FR-2.4:** Any skill whose command today accepts a free-text argument (e.g. `/develop-feature <feature description>`) MUST document `$ARGUMENTS` handling in the skill body, consistent with the literal-token flag rule used elsewhere in the pipeline's design.
5. **FR-2.5 (agents ship via the plugin only — platform fact-check correction):** The 13 relocated agent files at `agents/*.md` (FR-2.1) are the **sole distribution mechanism** for agents from this feature forward. This is not a preference: Claude Code's documented subagent precedence ranks user `~/.claude/agents/` above plugin `agents/`, and plugin agents carry no namespacing (unlike skills, which resolve as `/<plugin-name>:<name>` and coexist with same-named user skills). Any copy of an agent left under `~/.claude/agents/` therefore fully shadows the plugin's version of that agent — it becomes unreachable by any name, not merely lower-priority. See FR-4.11 for the corresponding removal of `install.sh`'s legacy agent-copy behavior.

#### FR-3: Memory Layer Stays on install.sh (hard architectural constraint)

Preserve `install.sh` as the sole delivery mechanism for the harness's always-on user memory, because the plugin system has no equivalent component type.

1. **FR-3.1:** `src/claude.md` MUST NOT be relocated into the plugin's directory layout. It MUST continue to be installed to `~/.claude/claude.md` by `install.sh`.
2. **FR-3.2:** `src/rules/*.md` MUST NOT be relocated into the plugin's directory layout. Every file in `src/rules/` MUST continue to be installed to `~/.claude/rules/*.md` by `install.sh`.
3. **FR-3.3:** Every affected doc that describes installation (`README.md`, and any plugin-facing install instructions this feature adds) MUST state the rationale explicitly: Claude Code auto-loads `~/.claude/claude.md` and `~/.claude/rules/*.md` as user memory, and that is the only mechanism by which the mandatory autonomous-pipeline instruction reaches every session. Plugins have no user-memory component type — a pure-plugin migration would pass `claude plugin validate`, resolve agents in `/agents`, and silently delete the pipeline instruction while every check stays green.
4. **FR-3.4:** `README.md` MUST state prominently, in the installation instructions, that installing only the plugin (`/plugin install`) is insufficient on its own — `bash install.sh` remains a required step for the memory layer to load.
5. **FR-3.5 (honest capability disclosure for install.sh-only adopters, platform fact-check correction):** `README.md` MUST state plainly what an `install.sh`-only adopter actually gets and does not get, per the corrected NFR-2: the memory layer loads (the mandatory pipeline instruction and all process rules are active, and Claude follows the documented workflow), but with no plugin installed there are **no specialist subagents** to delegate to — the pipeline phases run inline rather than through `prd-writer`, `architect`, `qa-planner`, and the rest. Installing the plugin is required for the full agency. This MUST NOT be phrased as a minor caveat; it is the primary capability difference between the two install paths.

#### FR-4: Manifest-Driven Install/Uninstall

Give `install.sh` a manifest of exactly what the harness owns in `~/.claude` — including v3.1-era paths this feature retires — plus a per-install receipt, and make all removal operations manifest/receipt-scoped. All of FR-4 MUST be satisfied without `install.sh` invoking `node` or `jq` (see NFR-1). **Platform fact-check correction:** because plugin agents are shadowed (not namespaced) by any same-named user-level agent, `install.sh`'s `owns` footprint no longer includes agents at all (see FR-4.11), and the `legacy` retirement list grows accordingly.

1. **FR-4.1 (manifest format and structure — owns is 6 entries, legacy is 18):** A new file `manifests/owned-files.txt` (or a strictly one-path-per-line JSON string array if JSON is preferred for CI-side tooling — either way, the format MUST be parseable deterministically by POSIX shell built-ins, with no `node`/`jq` dependency) MUST enumerate the harness's `~/.claude` footprint in two labeled sections:
   - **`owns`** — the v4.0 footprint this feature installs and is responsible for, now **6 entries total**: `claude.md` and the 5 rule copies (`~/.claude/rules/*.md`). Agents are explicitly **not** in `owns` — see FR-4.11.
   - **`legacy`** — v3.1-era paths this feature retires and must actively clean up, now **18 entries total**: the 5 files under `~/.claude/commands/*.md`, plus the 13 files under `~/.claude/agents/*.md` that v3.1's installer placed. Both classes are not "installed" by v4.0, but both are loaded by Claude Code at higher precedence than a same-named plugin asset if left behind. The agent case is strictly worse than the command case: a leftover `~/.claude/agents/<name>.md` does not just coexist with a same-named plugin skill the way a stale command would appear to (commands have no namespaced plugin form either, but agents are documented explicitly as fully overridden, not merely resolved-first) — it renders the plugin's `agents/<name>.md` unreachable by any name until the stale copy is removed. This section exists specifically to close both gaps.
   Comment lines (prefixed `#`) and blank lines MUST be permitted and ignored by the parser.
2. **FR-4.2:** `install.sh` MUST gain an `--uninstall` flag that removes every file listed under **both** the `owns` and `legacy` sections of the manifest — all 18 `legacy` entries (5 commands + 13 agents) plus all 6 `owns` entries — (or, when a receipt from FR-4.8 exists, prefers the receipt per FR-4.8's fallback order).
3. **FR-4.3:** `install.sh` MUST gain a `--restore <backup-dir>` flag that restores `~/.claude` from a specified timestamped backup directory produced by the existing backup mechanism. The `<backup-dir>` argument MUST be validated per FR-4.7's path-safety rules before any restore operation touches disk.
4. **FR-4.4:** `install.sh` MUST gain a `--dry-run` flag. When combined with `--uninstall`, it MUST print exactly the files (from the manifest's `owns` and `legacy` sections, or from the receipt if present) that would be removed, without removing anything.
5. **FR-4.5:** All removal logic (uninstall, and any pre-install cleanup of stale copies, including the legacy `commands/` and legacy `agents/` cleanup) MUST operate only on manifest or receipt entries. It MUST NOT use glob-based deletion (e.g. `rm ~/.claude/agents/*.md` or `rm ~/.claude/commands/*.md`) against any directory.
6. **FR-4.6 (blast radius grew from 5 to 18 files — the personal-agent guarantee is restated against the enlarged list):** The manifest's `legacy` agent entries MUST enumerate exactly the 13 harness agent filenames (matching `src/agents/*.md`) and MUST NOT include `brand-guardian.md`, `demo-script-writer.md`, or `social-copywriter.md` — the 3 files in `~/.claude/agents/` (16 total on the reference install) that are the user's own agents, unrelated to this harness. These 3 files MUST survive any `install.sh` install or `--uninstall` run unchanged, even though the enumerated legacy-cleanup blast radius is now more than 3× larger than the original commands-only scope.
7. **FR-4.7 (path-safety validation, security requirement):** Before any manifest or receipt entry is used in a destructive operation (uninstall, restore, or pre-install cleanup), `install.sh` MUST validate that the entry is a relative path, is normalized (no `.` or `..` path segments), and resolves to a location confined under `~/.claude`. An entry that fails this validation (e.g. a crafted `../.ssh/id_rsa`) MUST be rejected and MUST abort the destructive operation for that entry with a visible error, not silently skip it.
8. **FR-4.8 (per-install receipt, same dependency-free format as the manifest, now records 6 paths not 19):** `install.sh` MUST write an install receipt at `~/.claude/.sdlc-receipt` (no `.json` extension — the receipt MUST use the same newline-delimited, POSIX-parseable format as `manifests/owned-files.txt`, not JSON: line 1 is the installed version string, each remaining line is one relative file path that install placed, path-safety-validated per FR-4.7). Because `install.sh` no longer places agents under `~/.claude/agents/` (FR-4.11), the receipt records exactly the 6 `owns` paths (`claude.md` + 5 rule files) that a given install actually wrote — not 19. This mirrors FR-4.1's format choice for the same reason: `install.sh` MUST NOT invoke `node` or `jq` (NFR-1), so the receipt — which `install.sh` itself must read back during `--uninstall` — cannot be JSON parsed by hand-rolled bash any more than the manifest can. `--uninstall` and `--dry-run --uninstall` MUST prefer the receipt when present and fall back to the manifest's `owns`/`legacy` sections when it is absent. Rationale: (a) it removes the "manifest describes v4.0 but disk holds v3.1" ambiguity for all future retirements, since a manifest alone cannot distinguish what a specific past install actually wrote; (b) it doubles as the machine-side version stamp that F2a's session-start drift check will need — today there is no way to detect that the plugin was updated while the memory layer was not. **The receipt cannot replace the manifest for *this* upgrade** — v3.1 wrote no receipt, so the `legacy` section of the manifest (FR-4.1) is the only mechanism available for cleaning up the v3.1 `commands/` and `agents/` footprint on this first v4.0 upgrade.
9. **FR-4.9 (drop the legacy commands install path):** `install.sh` MUST stop copying `src/commands/*.md` to `~/.claude/commands/` — that copy loop (`install.sh:208-211` today) is removed, since commands become plugin skills (FR-2.2). The `commands/ (5 files)` line in the pre-install confirmation banner (`install.sh`, near line 184) and the `commands/ 5 SDLC pipeline commands` line in `--help` output (`install.sh`, near line 63) MUST both be removed, along with the corresponding `mkdir -p ".../commands"` and post-copy count logic.
10. **FR-4.10:** The existing timestamped backup behavior (`~/.claude/backup-*`) MUST be retained unchanged by this feature. Per the mandatory security-auditor pre-review noted in Section 6.10, the backup write itself MUST be atomic (write to a temp directory, then rename into place) rather than an in-place copy, so a failure mid-backup cannot leave a partial, unusable backup.
11. **FR-4.11 (drop the legacy agents install path — platform fact-check correction, STRUCTURAL):** `install.sh` MUST stop copying `src/agents/*.md` to `~/.claude/agents/` — the existing agent-copy loop (`install.sh`'s `for agent in "$SCRIPT_DIR"/src/agents/*.md; do cp "$agent" "$CLAUDE_DIR/agents/"; ... done` block) is removed entirely, mirroring FR-4.9's removal of the commands copy loop. Rationale: Claude Code's documented subagent precedence ranks user `~/.claude/agents/` above plugin `agents/`, and plugin agents are not namespaced the way plugin skills are — so continuing to install agents to `~/.claude/agents/` would permanently shadow the plugin's own `agents/` directory, making every future plugin agent update silently ineffective while `claude plugin validate` and `/agents` both report success. Agents ship via the plugin only, from this feature forward (FR-2.5). The `agents/ (13 files — specialized agent prompts)` line in the pre-install confirmation banner (`install.sh`, near line 183) and the `agents/  13 specialized agent prompts` line in `--help` output (`install.sh`, near line 62) MUST both be removed, along with the corresponding `mkdir -p ".../agents"` and post-copy count logic.

#### FR-5: Harness CI

Add automated CI that validates every shipped agent, skill, and (forward-looking) hook asset, plus repo-hygiene checks, on every push.

1. **FR-5.1:** A new workflow `.github/workflows/ci.yml` MUST run the validators defined below on every push and pull request. The workflow MUST declare least-privilege permissions explicitly — `permissions: contents: read` at the workflow (or job) level, with no broader default token scope. This is the condition the architect set for the CI slice **not** requiring security pre-review (contrast the mandatory `security-auditor` pre-review required for the `install.sh` slice, Section 6.10), so it is stated here as a requirement, not left as an implementation detail.
2. **FR-5.2:** An agent-frontmatter validator MUST check every file in `agents/*.md`: the `name` field matches the filename, all required fields (`name`, `description`, `tools`, `model`) are present, and the `tools` list contains only valid tool names.
3. **FR-5.3:** A skill-frontmatter validator MUST check every `skills/*/SKILL.md` file for the fields required by FR-2.3 (`description`, `argument-hint`, `arguments`, `allowed-tools`).
4. **FR-5.4:** A hook-config validator MUST exist and validate `hooks/hooks.json` schema conformance where present. This is forward-looking for F2 (hook infrastructure, out of this feature's implementation scope) — the validator must exist, run in CI, and pass trivially (no hooks shipped yet) against a seeded fixture that proves it fails on malformed hook config.
5. **FR-5.5:** A personal-path validator MUST scan every shipped file for the pattern `/Users/...` (or equivalent absolute personal paths) and fail CI if any are found.
6. **FR-5.6:** A unicode-safety validator MUST scan every shipped prompt file (`agents/*.md`, `skills/*/SKILL.md`, `src/claude.md`, `src/rules/*.md`) for zero-width characters and homoglyph substitutions and fail CI if any are found.
7. **FR-5.7:** A version-consistency validator MUST check that the version string in `README.md`, `install.sh`, and `.claude-plugin/plugin.json` are identical, and fail CI if they diverge.
8. **FR-5.8:** Each validator added under FR-5.2 through FR-5.7 MUST be proven both ways in CI: it MUST exit `0` against the current `HEAD`, and it MUST exit non-zero when run against a deliberately seeded bad fixture asset checked into the test scaffolding for that validator.
9. **FR-5.9 (validators must not pass vacuously on zero matched files):** Every validator that operates on a glob (`agents/*.md`, `skills/*/SKILL.md`, etc.) MUST assert an expected minimum matched-file count for that glob and MUST exit non-zero if it matches zero files, rather than trusting the glob and reporting success on an empty match set. This closes the gap where a validator run before `agents/` or `skills/` is populated would report a vacuous pass. (Ordering CI so validators run after the assets they check exist is an implementation-planning concern for the slice breakdown; this requirement is what the validator itself must enforce regardless of when it runs.)

#### FR-6: Version and Status Reconciliation

Correct the version-string drift and PRD-status drift that has accumulated since the last release.

1. **FR-6.1:** `README.md`'s version badge (currently `3.1.0` at `README.md:8`) and `install.sh`'s `VERSION` variable (currently `"2.1.0"` at `install.sh:22`) MUST be set to the same value as part of this feature's implementation.
2. **FR-6.2:** `docs/PRD.md` Section 2 (Execution Waves) `**Status:**` field MUST be changed from `[DRAFT]` to `[SHIPPED]` as part of this feature's implementation, reflecting that it is already implemented.
3. **FR-6.3:** `docs/PRD.md` Section 5 (Changelog Automation) `**Status:**` field MUST be changed from `[DRAFT]` to `[SHIPPED]` as part of this feature's implementation, reflecting that it is already implemented.
4. **FR-6.4:** `docs/PRD.md` Section 3 (Agent Model Tier Optimization) `**Status:**` field MUST be changed from `[DRAFT]` to `[SUPERSEDED]` as part of this feature's implementation, with a note that it is superseded by the profile-driven model-routing rewrite mechanism planned for a later roadmap feature (F4), and that none of Section 3's functional requirements are implemented as originally specified.
5. **FR-6.5:** `docs/PRD.md` Section 4 (Self-Improvement Loop) `**Status:**` field MUST remain `[DRAFT]` — it is not implemented by this feature or any shipped feature to date.

#### FR-7: Slash-Command Reference Sweep

Reconcile documentation and prompt files with the fact that plugin skills resolve as `/<plugin-name>:<name>`, with bare-name resolution only succeeding absent a collision.

1. **FR-7.1:** Every reference to a bare command name (e.g. `/develop-feature`) across the files enumerated in FR-7.2 MUST be reviewed. Where the reference documents plugin-invoked usage, it MUST be updated to show both the namespaced form (`/<plugin-name>:<name>`) and the bare form, with a note that bare resolution only succeeds when no other installed plugin defines a colliding skill name.
2. **FR-7.2 (verified scope — 19 files, corrected at merge-ready from 21 after two deliberate exclusions):** The scope was re-verified against the actual repository tree with `grep` before being written here. Two files initially listed are deliberately **excluded**, because sweeping them would be wrong, not merely unnecessary: `CHANGELOG.md` is excluded because its entries are past-tense historical records of what shipped — rewriting command names inside a historical entry would falsify the record of what was true at the time it was written. `.claude/scratchpad.md` is excluded because it is transient orchestrator working state, continuously rewritten during a run and superseded within hours — sweeping a file with no persistent content is meaningless. With both removed, the verified 19-file scope is: `README.md`, `CONTRIBUTING.md`, `docs/PRD.md`, `install.sh`, all 6 files under `docs/use-cases/` (`pipeline-hardening_use_cases.md`, `execution-waves_use_cases.md`, `model-tier-optimization_use_cases.md`, `self-improvement-loop_use_cases.md`, `changelog-automation_use_cases.md`, `plugin-repackaging_use_cases.md`), all 5 files under `docs/qa/` (`pipeline-hardening_test_cases.md`, `execution-waves_test_cases.md`, `model-tier-optimization_test_cases.md`, `self-improvement-loop_test_cases.md`, `changelog-automation_test_cases.md`), `src/claude.md`, `src/rules/changelog.md`, and the two skill files that actually contain bare command references (`skills/develop-feature/SKILL.md` and `skills/merge-ready/SKILL.md`).
3. **FR-7.3:** No file in scope MUST be left with an unreviewed bare command reference. This MUST be verifiable by a targeted `grep -rn` sweep across the 19 files that confirms every remaining bare reference was deliberately reviewed and, where applicable, given its namespaced counterpart — not merely left present by omission.

#### FR-8: Loud, Non-Blocking Missing-Memory-Layer Preflight

Close the silent half-migration failure mode (Risk 3 / UC-9-E1) where all green signals (`claude plugin validate`, `/plugin install`, `/agents`) can be true while the memory layer — and with it the mandatory pipeline instruction — is entirely absent.

1. **FR-8.1:** `skills/develop-feature/SKILL.md` and `skills/bootstrap-feature/SKILL.md` MUST each open with a preflight step that verifies `~/.claude/claude.md` exists and contains the harness's pipeline instruction (a recognizable marker string from the file, e.g. a heading unique to the installed `claude.md`).
2. **FR-8.2:** If the check in FR-8.1 fails (file absent, or present but missing the marker), the skill MUST emit a **visible warning** naming `bash install.sh` as the fix, and then **continue execution** — per the autonomy contract, no new gate introduced by this feature may dead-end an unattended run, so this is a warning, never a block.
3. **FR-8.3:** This preflight explicitly does **not** cover the unprefixed-request case (a feature request made without invoking `/develop-feature` or `/bootstrap-feature` directly) — that path has no natural entry point for this check within this feature's scope. The residual gap is closed by F2a's `session:start:spine` hook (out of scope for this feature), which runs on every session regardless of how the pipeline is entered.

### 6.4 Non-Functional Requirements

1. **NFR-1 (supersedes Section 4.4 NFR-1 for this feature's scope, Node is CI-only):** This feature introduces JavaScript to a repo that has been markdown-and-bash only since inception. The introduction is constrained: Node.js only, **zero runtime dependencies** (no `npm install` step in CI beyond the Node toolchain itself), all CI validators share **one common wrapper module** rather than duplicating parsing logic per validator, and every validator entry point asserts a minimum Node version and fails loudly (not silently) if unmet. This directly contradicts Section 4.4 NFR-1 ("no runtime code is introduced") and Section 1.4/2.4's identical constraint. **This section supersedes those NFR-1 statements for CI tooling only** — agent, skill, and rule prompt files remain markdown-only. **`install.sh` never invokes `node` or `jq`; the Node boundary stays at CI** (enforced by FR-4.1's POSIX-parseable manifest format). Per the roadmap's deliverables checklist, the `architect` review for this feature MUST explicitly rule on introducing JavaScript, not silently wave it through — this review returned a conditional PASS scoping Node to CI-only, which this NFR now states as a hard constraint. **Note:** this contradiction with Section 4.4 NFR-1 should also be annotated directly in Section 4 itself when F5's planned Section 4 revision lands (Section 4 already requires revision for NFR-1/NFR-4/NFR-5/FR-1.5 per the roadmap), so the contradiction is not discoverable only by reading this section.
2. **NFR-2 (backward compatibility — corrected, honest scope, platform fact-check):** There is no documented mechanism to ship a subagent that is authoritative in the plugin yet degrades gracefully when the plugin is absent, so this NFR no longer claims an `install.sh`-only adopter gets a fully working harness — that claim was invalidated by the documented subagent precedence and lack of agent namespacing. The honest, corrected outcome: an **`install.sh`-only adopter** gets the memory layer — the mandatory pipeline instruction and all process rules are active, and Claude follows the documented workflow — but has **no specialist subagents** to delegate to, so pipeline phases run inline rather than through `prd-writer`, `architect`, `qa-planner`, and the rest (FR-3.5). **Installing the plugin is required for the full agency.** A user who does both (installs via `install.sh` and installs the plugin) MUST NOT end up with conflicting or duplicated agent/command resolution — this is the shadowing risk covered in Risks 1, 2, and 4 below (legacy commands, legacy agents, and hand-edited agent copies, respectively), and the manifest-driven cleanup in FR-4 (including FR-4.11's removal of `install.sh`'s agent-copy loop) is the mitigation.
3. **NFR-3 (rollback):** `install.sh --uninstall` followed by `install.sh --restore <backup-dir>` MUST return `~/.claude` to its exact prior state. This MUST be verifiable by `diff -r` between the pre-uninstall state and the post-restore state, returning no differences (excluding the timestamped backup directory itself).
4. **NFR-4 (no autonomy regression):** The harness's defining property is that `/develop-feature` runs to merge-ready without human steering. Nothing introduced by this feature may add a step a human must remember to run manually. CI runs automatically on push; the plugin install/uninstall lifecycle is a one-time human action, not a per-feature pipeline step, and must not be inserted into `/develop-feature`, `/bootstrap-feature`, `/implement-slice`, or `/merge-ready`.
5. **NFR-5 (asset budget):** The v4.0 hard budget is ≤16 agents, ≤10 skills, ≤12 hooks. This feature adds **0 new agents and 0 new skills** — it relocates the existing 13 agents and 5 commands (as skills) without changing their count. Post-feature totals remain 13 agents / 5 skills / 0 hooks, well inside budget.

### 6.5 Acceptance Criteria

1. **AC-1 (corrected at merge-ready):** `claude plugin validate .` run from the repo root exits `0`, against a `.claude-plugin/plugin.json` whose component path fields are `agents` and `skills` only — no `hooks` field, since this feature ships no `hooks/` directory (FR-1.1).
2. **AC-2:** Each CI validator added under FR-5.2 through FR-5.7 exits `0` when run against the repository at `HEAD`, **and** exits non-zero when run against its corresponding deliberately seeded bad fixture asset.
3. **AC-3:** `install.sh --dry-run --uninstall` lists exactly the files enumerated in the manifest's `owns` (6 entries) and `legacy` (18 entries: 5 `~/.claude/commands/*.md` + 13 `~/.claude/agents/*.md`) sections (or the install receipt, if present) — and lists none of the 3 personal agent files (`brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md`). A subsequent real `install.sh --uninstall` (removing all 6 `owns` and all 18 `legacy` entries, including both `~/.claude/commands/` and the 13 legacy `~/.claude/agents/*.md` files) followed by `install.sh --restore <backup-dir>` round-trips `~/.claude` to its prior state, verified by `diff -r` returning no differences.
4. **AC-4 (corrected at merge-ready — 19 files, `CHANGELOG.md` and `.claude/scratchpad.md` deliberately excluded per FR-7.2):** No unreviewed bare command reference remains across the 19 files enumerated in FR-7.2 — verifiable by a `grep -rn` sweep of bare command patterns (`/develop-feature`, `/bootstrap-feature`, `/implement-slice`, `/merge-ready`, `/context-refresh`) across those files, confirming each occurrence has been updated per FR-7.1 or is otherwise not a plugin-invocation reference (e.g. a heading label).
5. **AC-5:** `ls agents/*.md | wc -l` returns `13`; `ls skills/*/SKILL.md | wc -l` returns `5`. Each skill file's frontmatter contains `description` and `argument-hint`.
6. **AC-6:** `grep -c "VERSION=" install.sh` and the version string in `.claude-plugin/plugin.json` and the `README.md` badge all report the identical version value.
7. **AC-7:** `docs/PRD.md` Section 2 and Section 5 `**Status:**` fields read `[SHIPPED]`; Section 3 reads `[SUPERSEDED]`; Section 4 remains `[DRAFT]`.
8. **AC-8:** `src/claude.md` and every file under `src/rules/` remain present at their original paths (not relocated into the plugin) and `install.sh` still copies them to `~/.claude/claude.md` and `~/.claude/rules/*.md` respectively.
9. **AC-9:** `install.sh` invokes neither `node` nor `jq` anywhere in its execution paths — verifiable with a portable (BSD- and GNU-grep-compatible) word-boundary search, e.g. `grep -E '(^|[^a-zA-Z])(node|jq)([^a-zA-Z]|$)' install.sh` (excluding comment lines), returning no matches. (This repo is developed on macOS with BSD grep; GNU-only syntax such as `\b` MUST NOT be assumed by QA test cases derived from this AC.)
10. **AC-10:** A manifest or receipt entry containing a path-traversal payload (e.g. `../.ssh/id_rsa`) is rejected by `install.sh`'s path-safety validation before any destructive operation runs, and the rejection is visible in output, not silent.
11. **AC-11:** `install.sh` writes an install receipt at `~/.claude/.sdlc-receipt` (no `.json` extension) at install time, in the same newline-delimited format as the manifest (version on line 1, one relative file path per remaining line). Running `install.sh --dry-run --uninstall` immediately after a fresh install shows dry-run output sourced from the receipt (verifiable by removing/renaming the manifest and confirming the dry-run output is unchanged).
12. **AC-12:** Each CI validator from FR-5.2 through FR-5.7, when run against a scratch directory containing zero matching files for its glob, exits non-zero rather than reporting a vacuous pass.
13. **AC-13:** Running `skills/develop-feature/SKILL.md`'s preflight against a state where `~/.claude/claude.md` is absent produces a visible warning naming `bash install.sh` and the skill's subsequent steps still execute (the run is not blocked).
14. **AC-14:** `grep -c "commands/" install.sh` (checked at the pre-install banner and `--help` text locations) shows those specific lines removed, and the `src/commands/*.md` → `~/.claude/commands/` copy loop no longer exists in `install.sh`.
15. **AC-15 (platform fact-check correction):** A fresh `install.sh` run does not create or populate `~/.claude/agents/` at all. The `src/agents/*.md` → `~/.claude/agents/` copy loop, its `mkdir -p ".../agents"`, and the `agents/ (13 files — specialized agent prompts)` / `agents/  13 specialized agent prompts` banner and `--help` lines required by FR-4.11 to be removed are absent from `install.sh` — verifiable by inspecting `install.sh` for any reference to copying into `$CLAUDE_DIR/agents`.
16. **AC-16 (platform fact-check correction):** The manifest's `legacy` section contains exactly 18 entries (5 `commands/*.md` + 13 `agents/*.md`) and the `owns` section contains exactly 6 entries (`claude.md` + 5 `rules/*.md`) — verifiable by a line count of each labeled section in `manifests/owned-files.txt`.
17. **AC-17 (platform fact-check correction):** The install receipt written by a fresh install (per FR-4.8) lists exactly 6 file paths, matching the `owns` section, not 19 — verifiable by counting the receipt's path lines (all lines after line 1).

### 6.6 Affected Components

#### New Files

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin manifest — `name`, `version`, `description`, `author`, `license`, component paths `agents` + `skills` only (no `hooks` — added by F2a once `hooks/` exists) (FR-1.1) |
| `.claude-plugin/marketplace.json` | Self-referencing marketplace descriptor, `source: "./"` (FR-1.2) |
| `manifests/owned-files.txt` | POSIX-parseable manifest — `owns` (v4.0 footprint: `claude.md` + 5 rules, 6 entries) and `legacy` (retired v3.1 footprint: 5 `commands/*.md` + 13 `agents/*.md`, 18 entries) sections — no `node`/`jq` dependency (FR-4.1) |
| `~/.claude/.sdlc-receipt` (written at install time, not shipped in the repo; newline-delimited, no `.json` extension — same POSIX-parseable format as the manifest) | Per-install receipt — installed version (line 1) and the 6 `owns` file paths that install actually placed (remaining lines; agents are never in this list, FR-4.11); `--uninstall` prefers this over the manifest when present (FR-4.8) |
| `.github/workflows/ci.yml` | Harness CI workflow — runs all validators on push/PR (FR-5.1) |
| `scripts/ci/validate-agents.js` | Agent frontmatter validator (FR-5.2) |
| `scripts/ci/validate-skills.js` | Skill frontmatter validator (FR-5.3) |
| `scripts/ci/validate-hooks.js` | Hook config validator, forward-looking for F2 (FR-5.4) |
| `scripts/ci/validate-personal-paths.js` | Personal-path (`/Users/...`) scanner (FR-5.5) |
| `scripts/ci/validate-unicode-safety.js` | Zero-width/homoglyph character scanner (FR-5.6) |
| `scripts/ci/validate-version-consistency.js` | Cross-file version-string consistency check (FR-5.7) |

#### Relocated Files

| From | To | Related Requirements |
|------|----|-----------------------|
| `src/agents/*.md` (13 files) | `agents/*.md` | FR-2.1 |
| `src/commands/bootstrap-feature.md` | `skills/bootstrap-feature/SKILL.md` (+ real frontmatter) | FR-2.2, FR-2.3 |
| `src/commands/develop-feature.md` | `skills/develop-feature/SKILL.md` (+ real frontmatter) | FR-2.2, FR-2.3, FR-2.4 |
| `src/commands/implement-slice.md` | `skills/implement-slice/SKILL.md` (+ real frontmatter) | FR-2.2, FR-2.3 |
| `src/commands/merge-ready.md` | `skills/merge-ready/SKILL.md` (+ real frontmatter) | FR-2.2, FR-2.3 |
| `src/commands/context-refresh.md` | `skills/context-refresh/SKILL.md` (+ real frontmatter) | FR-2.2, FR-2.3 |

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `install.sh` | Add `--uninstall`, `--restore <dir>`, `--dry-run`; manifest/receipt-driven removal covering both `owns` (6 entries) and `legacy` (18 entries, incl. `~/.claude/commands/` and `~/.claude/agents/`); path-safety validation; atomic (temp-dir + rename) backup writes; drop the `src/commands/*.md` → `~/.claude/commands/` copy loop and its banner/help-text lines (~184, ~63); drop the `src/agents/*.md` → `~/.claude/agents/` copy loop and its banner/help-text lines (~183, ~62), per the platform fact-check correction — agents ship via the plugin only; write install receipt (6 paths); version bump per FR-6.1; command reference sweep (10 references) | FR-2.5, FR-4.2 through FR-4.11, FR-6.1, FR-7.1, FR-7.2 |
| `README.md` | Version badge fix; plugin install instructions; explicit "plugin alone is not enough" note; command reference sweep | FR-3.4, FR-6.1, FR-7.1 |
| `CONTRIBUTING.md` | Command reference sweep | FR-7.1, FR-7.2 |
| `docs/PRD.md` | This section (new); status field updates to Sections 2, 3, 5 | FR-6.2, FR-6.3, FR-6.4 |
| `docs/use-cases/*.md` (6 files) | Command reference sweep | FR-7.1, FR-7.2 |
| `docs/qa/*.md` (5 files) | Command reference sweep | FR-7.1, FR-7.2 |
| `src/claude.md` | Command reference sweep (memory-layer file — stays in place per FR-3.1) | FR-7.1, FR-7.2 |
| `src/rules/changelog.md` | Command reference sweep (memory-layer file — stays in place per FR-3.2) | FR-7.1, FR-7.2 |
| `skills/develop-feature/SKILL.md` (relocated, see below) | Add missing-memory-layer preflight warning | FR-8.1, FR-8.2, FR-8.3 |
| `skills/bootstrap-feature/SKILL.md` (relocated, see below) | Add missing-memory-layer preflight warning | FR-8.1, FR-8.2, FR-8.3 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `src/rules/git.md` | Not part of the 19-file command-reference sweep; no plugin-related content. |
| `src/rules/tool-limitations.md` | Not part of the 19-file command-reference sweep; no plugin-related content. |
| `src/rules/error-recovery.md` | Not part of the 19-file command-reference sweep; no plugin-related content. |
| `src/rules/scratchpad.md` | Not part of the 19-file command-reference sweep; no plugin-related content. |
| `templates/CLAUDE.md` | Checked with `grep` for bare command references (per FR-7.2 verification) — contains zero; explicitly excluded from the sweep scope. |
| `CHANGELOG.md` (corrected at merge-ready) | Deliberately excluded from FR-7.2's scope — entries are past-tense historical records of what shipped; rewriting command names inside them would falsify the record. |
| `.claude/scratchpad.md` (corrected at merge-ready) | Deliberately excluded from FR-7.2's scope — transient orchestrator working state, continuously rewritten during a run and superseded within hours; sweeping it is meaningless. |
| `templates/*` (other than `CLAUDE.md`) | Project scaffolding templates are unaffected by this feature's plugin/CI scope; out of scope per the approved plan (project scaffold ownership is unchanged). |

### 6.7 UI Changes

None. This is a prompt-and-shell-script harness repo with no web application and no user interface; there is nothing in this feature that adds one.

### 6.8 Schema Changes

None. This project has no database of any kind; nothing in this feature introduces one.

### 6.9 Affected Endpoints

None. This project has no API server; `claude plugin validate`, CI workflows, and `install.sh` are local/CLI operations, not network endpoints.

### 6.10 Risks and Dependencies

1. **Risk (architect V1, STRUCTURAL): legacy `~/.claude/commands/` is an uncovered destructive-migration gap.** `install.sh` today copies the 5 command files to `~/.claude/commands/`. v4.0 stops doing that (commands become plugin skills, FR-2.2). If the manifest only enumerates "files the harness installs" (the v4.0 footprint), the 5 legacy `commands/*.md` copies are never enumerated anywhere and survive both upgrade and uninstall untouched. Claude Code loads `~/.claude/commands/*.md` as user-level slash commands, which participate in command resolution alongside the plugin skill of the same name — so after a "successful" v4.0 upgrade, `/develop-feature` can resolve to the **stale v3.1 command prompt** while `claude plugin validate` passes and `/agents` looks clean. This is the same shadowing failure class Risk 2 describes for agents, and Risk 2's instance is strictly worse. Mitigation: FR-4.1 gives the manifest two sections, `owns` (v4.0 footprint) and `legacy` (v3.1-era retired paths); FR-4.2 and FR-4.9 require upgrade and `--uninstall` to actively remove `legacy` entries and to stop writing to `~/.claude/commands/` at all; AC-3 and AC-14 make this machine-verifiable.
2. **Risk (highest priority — platform fact-check correction, STRUCTURAL): legacy `~/.claude/agents/` shadowing is worse than commands — a shadowed plugin agent is unreachable by any name.** `install.sh` originally continued copying the 13 harness agents to `~/.claude/agents/` under the v4.0 design. Claude Code's documented subagent precedence ranks user `~/.claude/agents/` above plugin `agents/`, and — unlike skills, which are namespaced as `/<plugin-name>:<name>` and coexist with a same-named user skill — plugin agents carry no namespacing at all. A same-named user-level agent does not just resolve first; it is the **only** version reachable, and the plugin's copy of that agent becomes permanently, silently dead weight. Left uncorrected, this would mean every future plugin update to an agent has zero observable effect for any adopter upgrading from v3.1, while `claude plugin validate` passes and `/agents` lists the shadowing (stale) copies as if all were well. Mitigation: FR-2.5 and FR-4.11 stop `install.sh` from installing agents to `~/.claude/agents/` at all, from this feature forward; FR-4.1's `legacy` manifest section grows to 18 entries (5 commands + 13 agents) so upgrade and `--uninstall` actively remove the v3.1 agent copies too; AC-3 and the agent-specific acceptance criteria below make this machine-verifiable.
3. **Risk: Destructive uninstall vs. the user's 3 personal agents — blast radius grew from 5 to 18 files.** `~/.claude/agents/` holds 16 files today; 3 (`brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md`) are the user's own agents, unrelated to this harness. Any glob-based cleanup (`rm ~/.claude/agents/*.md`) would destroy them, and the enumerated `legacy` cleanup list this feature now performs (18 entries, up from the original 5-file commands-only scope) makes this guarantee more load-bearing, not less. Mitigation: FR-4 mandates manifest-driven removal scoped to the `owns`/`legacy` manifest (or the install receipt, FR-4.8), `--dry-run` verification before any destructive run, path-safety validation on every entry before use (FR-4.7), explicit exclusion of the 3 personal filenames from the `legacy` agent list (FR-4.6), and the existing timestamped backup — now written atomically (temp-dir + rename, FR-4.10) — retained as a second line of defense.
4. **Risk: Personal, hand-edited agent copies shadow the plugin agents even after this feature ships.** 3 of the 16 installed copies in `~/.claude/agents/` (`architect.md`, `planner.md`, `security-auditor.md`) were hand-edited on the reference machine to `model: fable`, diverging from the repo. FR-4.1's `legacy` section and FR-4.11's removal of `install.sh`'s agent-copy loop clean up the copies `install.sh` itself placed — but they cannot reach pre-existing, hand-edited copies a user modified in place before upgrading, since those files' content differs from what the manifest expects to remove and are, by construction, files this feature must not touch destructively. If such copies remain, they permanently shadow the plugin's versions per the same precedence fact documented in Risk 2, so the migration looks complete (`claude plugin validate` passes, `/plugin install` succeeds) while actually running stale, hand-edited prompts. Mitigation: FR-4.11's removal of the legacy agent-copy loop is necessary but not sufficient for pre-existing hand-edited copies — verify via `/agents` after install that plugin agents resolve and no stale `~/.claude/agents/*.md` copy shadows them; this check is part of the cross-cutting verification for the whole v4.0 roadmap, not just this feature.
5. **Risk: The memory-layer split means "just install the plugin" is insufficient — and, symmetrically, "just run install.sh" no longer delivers agents at all.** Because `src/claude.md` and `src/rules/*.md` cannot move into the plugin (FR-3), a user who runs `/plugin install` and stops there gets agents and skills but never receives the mandatory autonomous-pipeline instruction — the harness looks installed but is not autonomous, and all three signals (`claude plugin validate`, `/plugin install`, `/agents`) report green while the pipeline instruction is gone (Risk under UC-9-E1). The corrected NFR-2 makes the converse gap explicit too: an `install.sh`-only adopter now gets the memory layer but zero specialist subagents (FR-2.5, FR-4.11) — there is no partial-functionality middle ground for agents the way there is for commands/skills. Mitigation: FR-3.4 and FR-3.5 require `README.md` to state both gaps prominently (documentation-only, insufficient on its own); FR-8 closes the missing-memory-layer half loudly at runtime — `skills/develop-feature/SKILL.md` and `skills/bootstrap-feature/SKILL.md` preflight-check for `~/.claude/claude.md` and warn (never block) if it's missing; this does not cover the unprefixed-request entry path, which is deferred to F2a's `session:start:spine` hook. The corrected NFR-2 states the honest, non-graceful-degradation outcome rather than requiring both install paths to deliver identical functionality.
6. **Risk: JavaScript in a previously markdown-and-bash-only repo, now scoped by the architect to CI only.** This directly contradicts the "no runtime code" NFR-1 stated in Sections 1, 2, and 4. Introducing a new language, toolchain, and dependency surface into a repo that has had none is an architectural change, not a routine addition. Mitigation: NFR-1 constrains the introduction tightly (Node only, zero runtime dependencies, one shared wrapper module, minimum-version assertion), the architect review returned a PASS with a hard boundary — `install.sh` itself MUST NOT invoke `node` or `jq` (AC-9) — and FR-4.1's manifest format is POSIX-parseable specifically so the installer never crosses that boundary.
7. **Risk: 393-reference blast radius, verified scope 19 files (corrected at merge-ready from a 21-file scope that wrongly included `CHANGELOG.md` and `.claude/scratchpad.md`; the original undercount before that was 17).** The slash-command reference sweep (FR-7) touches 393 references across the files spanning documentation, use cases, QA test cases, rule files, and `install.sh`. `CHANGELOG.md` (historical record, not a document to rewrite) and `.claude/scratchpad.md` (transient, continuously-overwritten working state) are deliberately excluded — see FR-7.2. A partial or careless sweep of the remaining files leaves stale bare-command documentation that misleads users once plugin-namespaced resolution is live. Mitigation: FR-7.2 enumerates the verified 19-file scope (6 use-case files, 5 QA files, and `install.sh`'s 10 references were previously missed; `CHANGELOG.md` and the scratchpad were previously wrongly included); FR-7.3 and AC-4 require a machine-verifiable `grep -rn` sweep confirming no file has an unreviewed bare reference, not a best-effort pass.
8. **Dependency: `architect` verdict on NFR-1 (received — PASS).** Per the roadmap's deliverables checklist, this feature's architecture review ruled on introducing JavaScript to the repo: the hybrid plugin+memory split is APPROVED, and JavaScript is APPROVED but scoped to CI-only, with `install.sh` barred from invoking `node` or `jq`. This section states that boundary as a hard requirement (NFR-1, AC-9), not advisory.
9. **Dependency: Foundation for the rest of the v4.0 roadmap.** F2a (hook infrastructure), F2b (blocking guards), F3 (verification upgrade), F4 (tier routing), and F5 (self-improvement loop) all assume the plugin scaffold, CI validators, and manifest-driven installer this feature produces already exist. This feature must land first; the roadmap's stated execution order is F1 → F2a → F2b, with F3/F4 following in either order and F5 last.
10. **Dependency: Mandatory `security-auditor` pre-review for the `install.sh` manifest/uninstall/restore/dry-run slice.** The slice implementing FR-4 (manifest, `--uninstall`, `--restore`, `--dry-run`, path-safety validation, receipt, and the removal of both the legacy commands-copy loop and the legacy agents-copy loop) performs destructive deletion inside `$HOME`, accepts a user-supplied `--restore <backup-dir>` argument that is read and copied from, and must guarantee backup atomicity (temp-dir + rename, never an in-place write that could leave a partial, unusable backup mid-failure). Given this combination — destructive filesystem operations, an attacker-influenceable path argument, and the path-traversal surface described in FR-4.7 — this slice REQUIRES a `security-auditor` review before merge, not just the standard Phase 4 gate; this is called out explicitly here so the implementation plan schedules it as a pre-review, not a post-hoc check.
11. **Dependency: This machine already runs additional hook entries in `~/.claude/settings.json`** from unrelated tooling. This feature does not add hooks (reserved for F2a), but the CI hook-config validator (FR-5.4) must be written against the eventual `hooks/hooks.json` schema without assuming it is the only hook configuration present on a user's machine.
12. **Note: PRD-vs-implementation reconciliation performed at merge-ready, not assumed.** The goal-backward verifier and code reviewer flagged three places where this section's requirement text claimed something the shipped implementation deliberately does not do: FR-1.1 required a `hooks` component path field that would have pointed `plugin.json` at a nonexistent directory (the implementation correctly omits it until F2a adds `hooks/`); FR-7.2 listed `CHANGELOG.md` in the command-reference sweep scope (the implementation correctly left it untouched, since its entries are historical records); and FR-7.2 listed `.claude/scratchpad.md` in the same scope (the implementation correctly left it untouched, since it is transient working state). In each case the implementation's judgment was correct and this PRD section was reworded to match it — recorded here so the next reader sees that PRD-vs-code agreement was actively checked at merge-ready, not assumed to hold because the PRD was written first.

---

## 7. Hook Infrastructure and Non-Blocking Hooks

**Status:** [DRAFT]
**Date:** 2026-08-15
**Priority:** High
**Related:** Section 6 (Plugin Repackaging and Harness CI) — this feature fulfills the `hooks` component-path deferral Section 6 FR-1.1 explicitly left open ("the `hooks` field becomes required once F2a... adds a `hooks/` directory to the repo"); it extends Section 6 NFR-1's Node-is-CI-only scope into a third, distinct Node context (the hook runtime — see NFR-1 below); it consumes Section 6 FR-4.8's per-install receipt (`~/.claude/.sdlc-receipt`) as the drift-check input for FR-5.4; it closes the residual entry-point gap Section 6 FR-8.3 explicitly left open (the skill preflight only fires on explicit `/develop-feature` or `/bootstrap-feature` invocation); and it turns Section 6 FR-5.4's forward-looking, currently-vacuous hook-config validator (`scripts/ci/validate-hooks.js`) into a real check against a populated `hooks/hooks.json` (FR-8.4 below). Section 8 (the roadmap's F2b, blocking guards) is the deliberately separate follow-on feature that gives hooks the ability to `deny` a tool call; nothing in this section ships that capability.

### 7.1 Description

Stand up the plugin's hook runtime — the shared wrapper, configuration file, environment-variable controls, and three hook handlers — so that later features (starting with Section 8) have infrastructure to build blocking guards on top of. This feature itself ships only hooks that **observe or advise**: they read state and inject context, or run a command and report the result. None of them can block a tool call, block the Stop event, or otherwise stop an unattended run.

**Why:** Every invariant this harness currently enforces — never commit on `main`, re-read a file before editing it, subagents never write the scratchpad, run `date -u` for the changelog timestamp, no AI attribution in commits — exists only as prose inside a prompt. Model compliance is the sole enforcement mechanism. That is the core reliability gap identified in the v4.0 roadmap: the pipeline is autonomous, but nothing stops a single missed instruction from silently violating any of those rules while every downstream gate still reports green. Mechanical enforcement requires a hook runtime to exist first. This feature builds that runtime and proves it out with hooks that carry real, useful behavior (session continuity across compaction, batched format/typecheck) but carry zero risk of dead-ending an unattended run, so the runtime itself is validated before Section 8 adds anything that can say no.

**Design Decisions:**
1. **Infrastructure and non-blocking hooks are shipped together, blocking guards are not.** Shipping the wrapper, the fail-open contract, and the runtime controls (FR-2 through FR-4) without any hook that can actually block proves the plumbing works under real, low-stakes conditions before Section 8 adds hooks whose entire purpose is to say no to a tool call. A newly-built blocking mechanism is exactly the kind of thing that should not be validated for the first time by something that can also strand an unattended run.
2. **One shared wrapper, not one bootstrap per hook entry.** A community harness surveyed for the v4.0 roadmap inlines a `node -e "..."` bootstrap in every `hooks.json` entry — duplicated per hook, unreadable in a JSON string, and fragile to edit. This feature rejects that pattern explicitly: every hook entry in `hooks/hooks.json` invokes `hooks/lib/run-hook.js`, passing only a hook id, and the wrapper owns version-assertion, timeout, fail-open, and dispatch logic exactly once.
3. **The fail-open contract is normative, not aspirational.** A hook framework's defining risk is that a hook which malfunctions on every tool call is worse than the prose instruction it replaced — prose degrades gracefully (it's occasionally ignored), a crashing blocking hook does not (it stops every run, every time, until someone notices and disables it). Because this harness's defining property is that its pipeline runs unattended, FR-3 states the fail-open contract as an unconditional requirement of `run-hook.js` itself, not a best-effort behavior left to each hook's own error handling.
4. **`session:start:spine` is this feature's highest-leverage hook.** It is the only mechanism, other than reading the raw scratchpad by hand, by which a resumed or context-compacted session recovers where an autonomous run left off. It also carries the harness drift check (comparing the installed memory-layer version against the plugin version) and closes the unprefixed-request gap Section 6 FR-8 could not reach.
5. **`post:edit:accumulate` → `stop:typecheck-format` batches quality checks at the response boundary, not the edit boundary.** Running format and typecheck after every single `Edit` call, as a naive PostToolUse hook would, multiplies command invocations by edit count for no benefit — the meaningful checkpoint is "the response is about to end," not "one file changed." The accumulator hook and the Stop hook are therefore two cooperating hooks, not one.
6. **The Node boundary now has three distinct zones, not two.** Section 6 NFR-1 drew one line: Node is CI-only, and `install.sh` must never invoke it. This feature adds a third zone that Section 6 did not need to distinguish: the hook runtime, which Claude Code itself spawns directly during a live session (on `SessionStart`, `PostToolUse`, and `Stop`) — never during CI, and never from `install.sh`. All three zones remain disjoint: CI runs the validators, `install.sh` runs neither `node` nor `jq` (unchanged from Section 6), and Claude Code's own hook engine runs `run-hook.js`.
7. **Permissions defaults close a direct autonomy failure, not a convenience gap.** An unattended run that stalls on a permission prompt has, in practice, stopped — there is no one at the keyboard to answer it. `templates/settings.json` shipping real `allow`/`deny` lists is therefore in scope for a feature about reliability, even though it touches no hook file.

### 7.2 User Story

As a developer running the Claude Code SDLC pipeline unattended, I want the harness to observe and advise through hooks — resurfacing exactly where a resumed or compacted session left off, and batching format/typecheck checks once per response instead of once per edit — so that the pipeline recovers its own state without me re-explaining it and code-quality checks happen automatically, without any hook ever being able to stall my run by malfunctioning.

### 7.3 Functional Requirements

#### FR-1: Hook Configuration

Add the plugin-loaded configuration file that makes every current and future hook fire, and close the `hooks` component-path deferral Section 6 explicitly left open.

1. **FR-1.1:** `hooks/hooks.json` MUST exist at the plugin root. It MUST be the file Claude Code loads automatically the moment the plugin is installed — no additional copy into a project's or user's `settings.json` is required or permitted (see FR-7.3).
2. **FR-1.2:** `.claude-plugin/plugin.json` MUST gain a `hooks` component path field set to `"./hooks/"`, alongside the existing `agents` and `skills` fields. This is the field Section 6 FR-1.1 deliberately omitted because no `hooks/` directory existed at that time; FR-1.1 there states in writing that "F2a's implementation is responsible for adding it to `plugin.json`" — this requirement is that follow-through.
3. **FR-1.3:** `claude plugin validate .` run from the repo root MUST continue to exit `0` after both `hooks/hooks.json` and the `plugin.json` `hooks` field are added (Section 6 AC-1 must not regress).
4. **FR-1.4:** `hooks/hooks.json` MUST declare exactly the 3 hook handlers this feature ships (FR-5, FR-6): one `SessionStart` entry, one `PostToolUse` entry matched on `Edit|Write`, and one `Stop` entry — each entry's handler using the `command` type and invoking `hooks/lib/run-hook.js` (FR-2), and each declaring the namespaced `id` required by FR-4.1.

#### FR-2: Shared Wrapper

One wrapper module every hook entry invokes, replacing the per-entry inline-bootstrap pattern rejected in Design Decision 2.

1. **FR-2.1:** Every hook entry in `hooks/hooks.json` MUST invoke handlers exclusively through `hooks/lib/run-hook.js`. No hook entry MUST inline a `node -e ...` (or equivalent) bootstrap script directly in the JSON configuration.
2. **FR-2.2:** `run-hook.js` MUST resolve the plugin's own root directory from the `${CLAUDE_PLUGIN_ROOT}` environment variable Claude Code provides to hook processes, not from a path relative to the current working directory, so hook resolution is stable regardless of which project the hook fires in.
3. **FR-2.3:** `run-hook.js` MUST assert a minimum Node version before dispatching to any handler, and MUST report an unmet version loudly (a one-line `systemMessage`, per FR-3.4) rather than failing silently or producing an opaque stack trace.
4. **FR-2.4:** `run-hook.js` MUST apply a per-hook timeout, independently configurable per hook id, and MUST treat exceeding that timeout as a fail-open exit per FR-3.2.
5. **FR-2.5:** `run-hook.js` MUST dispatch to the correct handler logic by hook id (the ids defined in FR-4.1), so one wrapper module serves all hook entries rather than one wrapper per hook.
6. **FR-2.6 (syntax floor — makes the FR-3 contract reachable):** `hooks/lib/run-hook.js`, and every module it `require`s on the code path that runs before its own minimum-version assertion (FR-2.3) executes, MUST be written in syntax parseable by the oldest plausible Node version this harness may encounter on an adopter's machine. No syntax requiring a newer parser than that floor may appear anywhere on that pre-gate path. Rationale: a `SyntaxError` thrown while Node parses the wrapper itself exits non-zero before any of the wrapper's own code runs — no `systemMessage` is ever emitted for that failure, which makes the fail-open contract (FR-3.4) unfulfillable for exactly the case it exists to cover, unless the version gate is itself reachable under old Node.

#### FR-3: Fail-Open Contract

This is the feature's normative center: a hook may block only by deciding to, never as a side effect of malfunction. A blocking hook that crashes on every tool call is strictly worse than the prose rule it replaces — prose degrades gracefully when occasionally ignored; a crashing blocking hook stops every run, every time, until someone notices and disables it. Because this harness's defining property is that its pipeline runs to merge-ready unattended, every clause below is a hard requirement of `run-hook.js`, not a convention left to individual hook authors.

1. **FR-3.1:** Any hook handler invoked through `run-hook.js` that throws an uncaught exception MUST result in the wrapper process exiting `0`.
2. **FR-3.2:** Any hook handler that exceeds its configured timeout (FR-2.4) MUST result in the wrapper process exiting `0`.
3. **FR-3.3:** If `run-hook.js` cannot spawn or run under a Node runtime satisfying its minimum-version assertion (FR-2.3), the hook MUST be treated as a no-op: the wrapper process MUST exit `0` and the surrounding tool call or session/session-lifecycle event MUST proceed exactly as if no hook were configured at all.
4. **FR-3.4:** Every fail-open exit described in FR-3.1 through FR-3.3 MUST emit a one-line `systemMessage` identifying which hook id failed and why (`exception`, `timeout`, or `node-unavailable`), so the failure is visible without ever becoming blocking.
5. **FR-3.5:** No hook shipped by this feature (FR-5, FR-6) MUST return a `deny` decision or otherwise block a tool call or the `Stop` event under any input or condition — this feature ships observe/advise hooks exclusively. The ability for a hook to deny is deferred to Section 8.
6. **FR-3.6:** A hook's ability to block (once Section 8 introduces it) MUST always be the result of the hook's own deliberate logic evaluating its input, never a fallback behavior of a crash, timeout, or missing runtime — FR-3.1 through FR-3.3 apply identically to every hook this harness ever ships, present or future, not only to the 3 hooks in this feature.
7. **FR-3.7 (fail-open division of labor — binds Section 8):** Fail-open (FR-3.1 through FR-3.6) governs *mechanism* failure — a hook that cannot run — not the underlying invariant it was checking. It is tolerable for a blocking guard to fail open exactly when the invariant it enforces has a named downstream backstop: a `/merge-ready` gate that re-checks the same invariant before merge. Every blocking guard Section 8 introduces MUST name its backstop gate as part of its own requirement text, so a reader can confirm the mechanism-failure gap is actually covered, not merely assumed to be. The fail-**closed** layer for irreversible actions is deliberately NOT a hook at all: it is `permissions.deny` (FR-7), enforced by Claude Code itself before any process is even spawned — a deny decided by the permission system has no fail-open failure mode, because no hook process runs that could crash, hang, or find Node missing. Force-push to shared branches, out-of-tree recursive deletion, and exfiltration-shaped commands belong in `permissions.deny`, never in a PreToolUse hook whose fail-open behavior would let exactly that action through on any mechanism failure.

#### FR-4: Runtime Controls

Namespaced ids, kill switches, and a profile system that gates which hooks run.

1. **FR-4.1:** Every hook entry in `hooks/hooks.json` MUST declare a namespaced id in the form `<scope>:<event>:<name>` — this feature's 3 ids are `session:start:spine`, `post:edit:accumulate`, and `stop:typecheck-format`.
2. **FR-4.2:** Setting the environment variable `SDLC_HOOKS_ENABLED=0` MUST cause `run-hook.js` to exit `0` immediately for every configured hook id, without executing any hook's logic.
3. **FR-4.3:** Setting `SDLC_DISABLED_HOOKS` to a comma-separated list of hook ids MUST cause `run-hook.js` to exit `0` immediately for exactly the listed ids, and MUST leave every other configured hook unaffected.
4. **FR-4.4:** Setting `SDLC_HOOK_PROFILE` to `minimal`, `standard`, or `strict` MUST gate which hooks execute. Each hook this feature ships MUST declare, in its own configuration or handler metadata, which of the 3 profiles it belongs to; `run-hook.js` MUST skip (exit `0` for) a hook whose declared profiles do not include the currently active profile.
5. **FR-4.5:** If `SDLC_HOOK_PROFILE` is set to any value other than `minimal`, `standard`, or `strict`, `run-hook.js` MUST fall back to `standard` rather than failing, blocking, or treating the invalid value as if no hooks were configured.
6. **FR-4.6:** If `SDLC_HOOK_PROFILE` is unset, `run-hook.js` MUST behave as if it were set to `standard`.
7. **FR-4.7:** All 3 hooks shipped by this feature (FR-5, FR-6) MUST declare membership in the `standard` profile at minimum, so a default (unconfigured) installation runs them.

#### FR-5: `session:start:spine`

A SessionStart hook that re-enters the autonomous loop at the correct point after a resume or compaction, and reports harness version drift. **This hook requires mandatory `security-auditor` pre-review before merge (Section 7.10) — it injects content from a project-owned file into model context at the start of every session, in any repository an adopter opens.**

1. **FR-5.1:** `session:start:spine` MUST read `.claude/scratchpad.md` in the current project, when present, and inject the current feature name, branch, wave, and slice into the session via `additionalContext`.
2. **FR-5.2:** The injected context MUST be capped at `SDLC_SESSION_CONTEXT_MAX_CHARS` characters (default `4000`). When the source content exceeds the cap, the hook MUST truncate rather than omit the injection entirely.
3. **FR-5.3:** If `.claude/scratchpad.md` does not exist in the current project, `session:start:spine` MUST no-op with respect to scratchpad injection (no `additionalContext` from this source, no error) — a project with no scratchpad MUST be unaffected by this hook's presence.
4. **FR-5.4:** `session:start:spine` MUST perform a harness drift check: read the installed memory-layer version from `~/.claude/.sdlc-receipt` (the receipt Section 6 FR-4.8 defines, line 1 of that file) and compare it against the plugin's own `version` field in `.claude-plugin/plugin.json`. If the two differ, the hook MUST report the mismatch via `additionalContext` or `systemMessage` at session start.
5. **FR-5.5:** If `~/.claude/.sdlc-receipt` is absent, the drift check MUST no-op silently (no warning, no error) — it MUST NOT report a false mismatch on a machine where the memory layer was never installed via `install.sh` (for example, a plugin-only trial install).
6. **FR-5.6:** `session:start:spine` is the mechanism that closes the residual gap Section 6 FR-8.3 explicitly left open: the entry-point skill preflight (`skills/develop-feature/SKILL.md`, `skills/bootstrap-feature/SKILL.md`) only fires on an explicit `/develop-feature` or `/bootstrap-feature` invocation, so a feature request made without either prefix reaches no preflight check at all. `session:start:spine` runs on every session start regardless of how the pipeline is subsequently entered, and so is not subject to that gap.
7. **FR-5.7:** A session resumed or compacted mid-feature MUST re-enter the autonomous loop at the correct wave and slice using only the `additionalContext` injected by this hook — without the agent needing to ask the user what the current state is.
8. **FR-5.8 (structured extraction over raw pass-through — security requirement):** `session:start:spine` MUST extract structured fields (feature name, branch, wave, slice) from `.claude/scratchpad.md` and inject those fields, rather than passing the file's raw prose through verbatim, wherever a structured field can be identified. This bounds how much of a project-owned file's content reaches the model unmediated.
9. **FR-5.9 (hard cap, not a soft target):** The character cap defined in FR-5.2 (`SDLC_SESSION_CONTEXT_MAX_CHARS`, default `4000`) applies to this hook's entire injected output, including any residual raw content that FR-5.8's structured extraction does not fully replace, and MUST be enforced as a hard boundary that cannot be exceeded, not a target the hook merely aims for.
10. **FR-5.10 (untrusted-data framing — security requirement):** Content sourced from `.claude/scratchpad.md` MUST be framed within `additionalContext` as untrusted, project-reported data (e.g. a label such as "project-reported state, unverified"), never as an instruction to follow. `.claude/scratchpad.md` is a file the repository being opened controls, and this hook runs in every repository an adopter opens — it is a prompt-injection surface by construction, and the framing is the baseline mitigation for that, not a stylistic choice.
11. **FR-5.11 (injected-context content rule — binds all future injectors through this hook, including the roadmap's F5 instinct store):** `additionalContext` injected by `session:start:spine` MUST contain only (a) values read at invocation time from machine-local state — scratchpad fields (FR-5.1, FR-5.8), the install receipt's version (FR-5.4), the plugin's own version (FR-5.4), and, once a later roadmap feature adds it, the instinct store — plus (b) minimal framing labels for those values (FR-5.10). It MUST NOT contain instruction text that would be byte-identical across sessions, projects, or machines. If a sentence would read the same everywhere this hook fires, it belongs in `~/.claude/claude.md` or `src/rules/*.md`, delivered by `install.sh` — not in this hook's output. **Rationale:** without this rule the hook would gradually duplicate the memory layer and drift from it, and — worse — it would paper over exactly the plugin-only gap FR-5.4's drift check exists to surface loudly: an adopter who never ran `install.sh` would see the missing pipeline instruction quietly restated by the hook instead of the drift warning that is supposed to tell them something is missing.

#### FR-6: `post:edit:accumulate` → `stop:typecheck-format`

Two cooperating hooks that batch format and typecheck at the response boundary instead of the edit boundary. **`stop:typecheck-format` requires mandatory `security-auditor` pre-review before merge (Section 7.10) — it is the sharpest surface in this feature: it executes a command the project itself declares, outside Claude Code's permission system entirely.**

1. **FR-6.1 (accumulator location — STRUCTURAL):** The accumulator state `post:edit:accumulate` writes to and `stop:typecheck-format` reads from MUST live in a dedicated, project-local, gitignored subdirectory — `.claude/tmp/` — created on demand if absent. It MUST NOT be `/tmp` (not merely non-portable to Windows, but the same silently-no-oping side-channel pattern the roadmap's Risk 8 criticizes in a surveyed community harness's statusline bridge) and MUST NOT be `$HOME` or any path outside the project. It MUST NOT be `.claude/scratchpad.md` — writing to the pipeline's own scratchpad from a hook would conflict with the orchestrator-only scratchpad-write rule in `src/rules/scratchpad.md`.
2. **FR-6.2 (session identity):** The accumulator file's name MUST be keyed by the `session_id` field Claude Code supplies on stdin to both the `PostToolUse` and `Stop` hook invocations — the only identity value both ends of the pipe share. `session_id` MUST be sanitized to the character class `[A-Za-z0-9_-]` before being interpolated into any filesystem path; it arrives on untrusted stdin and MUST NOT be trusted for path construction without that sanitization.
3. **FR-6.3 (write discipline):** `post:edit:accumulate` MUST append to the accumulator file, never overwrite it, one file path per line, so that parallel-wave subagents editing files within the same session interleave their writes without corrupting each other's entries.
4. **FR-6.4 (cleanup):** The session whose `Stop` hook reads the accumulator file MUST clear (truncate or delete) its own file once format/typecheck has run. In addition, `stop:typecheck-format` MUST perform opportunistic, age-based garbage collection of stale sibling accumulator files left behind by sessions that were killed before their own `Stop` ran. This cleanup MUST be bounded (a capped number of files scanned/removed per invocation) and best-effort: a failure during garbage collection MUST fail open (FR-3) and MUST NOT block the current session's own Stop processing.
5. **FR-6.5 (ignore coverage):** `.claude/tmp/` MUST be gitignored in this repo's own `.gitignore` and MUST be covered by the `--init-project` scaffold's generated project `.gitignore`, so every scaffolded project ignores it too. Because the pipeline commits after every slice, an untracked transient path left off `.gitignore` would eventually be swept into a commit.
6. **FR-6.6 (path resolution):** Both hooks MUST resolve the project root the accumulator directory lives under from the `cwd` field supplied on stdin, not from the hook process's own working directory, so the accumulator resolves to the correct project even if Claude Code invokes the hook process from a different working directory than the one the session is operating in.
7. **FR-6.7:** A Stop hook, id `stop:typecheck-format`, MUST read the paths accumulated by `post:edit:accumulate` for the current `session_id`, run the project's declared format and typecheck commands exactly once for the response that is about to stop, and then clear the accumulator per FR-6.4.
8. **FR-6.8:** Format and typecheck commands MUST run at most once per response, never once per edited file, even when a single response edits multiple files.
9. **FR-6.9:** If the project's `CLAUDE.md` declares no typecheck command, `stop:typecheck-format` MUST no-op with a visible note (a `systemMessage` stating that no typecheck command is configured) and MUST NOT block the `Stop` event.
10. **FR-6.10:** This repository (`claude-code-sdlc` itself) has no `package.json` and declares no typecheck command — it dogfoods its own pipeline on markdown, shell, and CI-only JavaScript. The no-op path defined in FR-6.9 is therefore this repo's default, everyday behavior, not an edge case, and the fixture-driven tests required by FR-8 MUST treat it as the primary scenario for `stop:typecheck-format`, not an afterthought case appended to the suite.
11. **FR-6.11:** `stop:typecheck-format` MUST NOT block the `Stop` event under any outcome — a failing format or typecheck command MUST be reported visibly but MUST NOT prevent the response from completing, consistent with FR-3.5 (this feature ships no blocking hooks).
12. **FR-6.12 (command visibility — security requirement):** Before executing the project's declared format or typecheck command, `stop:typecheck-format` MUST echo the exact command string it is about to run in its `systemMessage`/output, so the command that actually ran is visible without inspecting logs separately.
13. **FR-6.13 (bounded discovery — security requirement):** Command discovery MUST be limited strictly to the declared Commands section of the project's `CLAUDE.md` (the same source FR-6.9 already treats as authoritative for "no typecheck command configured"). `stop:typecheck-format` MUST NOT infer a command from any other source — e.g. scanning `package.json` scripts, guessing from file extensions, or reading any file other than the project's own `CLAUDE.md`.
14. **FR-6.14 (open trust-signal question, deferred to mandatory pre-review — security requirement):** This hook executes a command declared by the project being opened, spawned directly by the hook engine and **not mediated by Claude Code's own permission system** — `permissions.allow`/`permissions.deny` (FR-7) govern tool calls the agent itself makes, not child processes a hook spawns. A hostile or compromised repository's declared "typecheck command" would therefore run automatically at the end of the first response in that repository, with no permission prompt. Whether execution requires an additional trust signal beyond the command's mere presence in `CLAUDE.md` (for example, a one-time per-project confirmation, or an allowlist of previously-approved commands) MUST be resolved by the mandatory `security-auditor` pre-review this slice requires (Section 7.10) before implementation proceeds. This PRD deliberately leaves the specific mechanism open pending that ruling rather than prescribing one prematurely.

#### FR-7: Permissions Defaults

Real `allow`/`deny` lists so unattended runs stop stalling on permission prompts. **This slice requires mandatory `security-auditor` pre-review before merge (Section 7.10) — every scaffolded project inherits this policy, so one overly-broad `allow` entry weakens all of them, not just one.**

1. **FR-7.1:** `templates/settings.json` MUST gain a `permissions.deny` list. It MUST cover, at minimum, destructive commands (e.g. recursive/forced deletion outside a project's own working tree, forced or history-rewriting git operations against shared branches) and exfiltration-shaped commands (e.g. piping a fetched remote script directly into a shell, or transmitting local file contents to an external endpoint).
2. **FR-7.2:** `templates/settings.json`'s `permissions.allow` list MUST be expanded beyond its current 3 entries to cover the routine, low-risk commands the pipeline actually issues during an unattended run (e.g. running the project's own test/build/typecheck commands, reading and writing within the project's own working tree), so that a `/develop-feature` run does not stall on a permission prompt for commands the pipeline itself generates as part of its documented behavior.
3. **FR-7.3:** `hooks/hooks.json` MUST NEVER be copied into `templates/settings.json` or into any project's `.claude/settings.json`. Plugin hooks auto-load directly from the plugin's own `hooks/hooks.json` (FR-1.1); pasting the same hook configuration into `settings.json` causes every hook in it to execute twice per matching event.
4. **FR-7.4:** `templates/settings.json`'s existing `permissions.allow` entries (`Bash(git commit*)`, `Edit(.claude/scratchpad.md)`, `Write(.claude/scratchpad.md)`) MUST be preserved, not replaced, by the expansion in FR-7.2.

#### FR-8: Hook Tests

Fixture-driven tests for every hook, including the fail-open cases, wired into the CI validator already anticipated for this purpose.

1. **FR-8.1:** Every hook shipped by this feature MUST have a fixture-driven test that feeds crafted stdin JSON to the hook (invoked through `run-hook.js`) and asserts both the process exit code and the shape of any stdout JSON produced.
2. **FR-8.2:** Test coverage MUST include, for each hook, at least one negative case where the hook correctly does not fire or does not produce its usual output — for example, `session:start:spine` against a project with no `.claude/scratchpad.md` (FR-5.3), and `stop:typecheck-format` against a project with no typecheck command configured (FR-6.9/FR-6.10) — asserting no output or side effect beyond the documented no-op note.
3. **FR-8.3:** Test coverage MUST include all 3 fail-open cases from FR-3: a hook handler that throws, a hook handler that exceeds its configured timeout, and a simulated Node-unavailable condition — each asserted to exit `0` and each asserted to emit the `systemMessage` required by FR-3.4.
4. **FR-8.4 (resolves a contradiction with UC-1-E2 — the validator's `command` check was previously non-empty-only):** `scripts/ci/validate-hooks.js` MUST be extended to (a) run its existing schema checks (event names, handler `type`, `id` presence — already implemented in anticipation of this feature) against the real `hooks/hooks.json` this feature ships, moving the validator off the vacuous absent-file pass path it currently takes (Section 6 FR-5.4/FR-5.9) onto a genuine check of a populated configuration with 3 handler entries, and (b) assert that every hook entry's `command` field routes through `hooks/lib/run-hook.js` — rejecting any entry whose command invokes Node directly (e.g. an inline `node -e ...` bootstrap, the pattern rejected in Design Decision 2) or names any other script path. Per UC-1-E2, the validator's prior behavior of only checking that `command` is non-empty would silently accept a hook entry that bypasses the shared wrapper — and with it, the fail-open contract (FR-3) and runtime controls (FR-4) `run-hook.js` alone enforces.
5. **FR-8.5:** `.github/workflows/ci.yml` MUST be extended to run the fixture-driven hook tests from FR-8.1 through FR-8.3 as part of the existing `validate-assets` job, alongside the current validator invocations and their falsification/anti-vacuity steps.
6. **FR-8.6:** Test coverage for `post:edit:accumulate` MUST include a crafted, hostile `session_id` on stdin (path-traversal sequences or characters outside `[A-Za-z0-9_-]`), asserting the resulting accumulator file path stays confined to `.claude/tmp/` within the resolved project root (FR-6.2).
7. **FR-8.7:** Test coverage for `stop:typecheck-format` MUST include an assertion that the exact command string appears in the hook's output before or alongside the command's own result (FR-6.12).

### 7.4 Non-Functional Requirements

1. **NFR-1 (extends Section 6 NFR-1 to a third, distinct Node context):** Section 6 NFR-1 scoped this repo's introduction of JavaScript to CI tooling only, with `install.sh` barred from invoking `node` or `jq`. This feature introduces a third context Section 6 did not need: the hook runtime, which Claude Code itself spawns directly on live session and tool-call events (`SessionStart`, `PostToolUse`, `Stop`) — never during CI, and never from `install.sh`. `install.sh` remains barred from invoking `node` or `jq`, unchanged; hooks are not part of the installer's execution path and are never invoked by it. Node code shipped by this feature MUST have **zero npm runtime dependencies** (no `npm install` step required for hooks to run) and MUST share one common wrapper module (`hooks/lib/run-hook.js`, FR-2.1) rather than duplicating version-assertion, timeout, or dispatch logic per hook. See FR-2.6 for the syntax-floor requirement this implies for `run-hook.js` itself — the fail-open contract (FR-3) is only reachable if the wrapper's own syntax parses under old Node.
2. **NFR-2 (backward compatible):** A project with the plugin not installed, or run with `SDLC_HOOKS_ENABLED=0` set, MUST behave identically to a Section-6-only installation with no hooks configured at all — no observable behavior change, no missing functionality beyond the hooks themselves.
3. **NFR-3 (no autonomy regression):** Nothing added by this feature may require a human to remember to run it manually — all 3 hooks fire automatically from existing Claude Code lifecycle events. No hook shipped by this feature may block a tool call, block the `Stop` event, or otherwise require human intervention to let a run proceed (FR-3.5, FR-6.9, FR-6.11).
4. **NFR-4 (asset budget):** This feature adds 3 hooks (`session:start:spine`, `post:edit:accumulate`, `stop:typecheck-format`) against the v4.0 hard budget of ≤12 hooks. Post-feature totals: 13 agents / 5 skills / 3 hooks — agent and skill counts are unchanged from Section 6.

### 7.5 Acceptance Criteria

1. **AC-1:** `claude plugin validate .` run from the repo root exits `0` after `hooks/hooks.json` exists and `.claude-plugin/plugin.json` declares the `hooks` component path field pointing at `./hooks/`.
2. **AC-2:** Every one of the 3 hook ids declared in `hooks/hooks.json` has a corresponding fixture-driven test asserting exit code and stdout JSON shape, including at least one negative case per hook (FR-8.2) and all 3 fail-open cases — throw, timeout, Node-unavailable — each asserted to exit `0` (FR-8.3).
3. **AC-3:** Setting `SDLC_DISABLED_HOOKS=session:start:spine` in the environment for a session start disables exactly `session:start:spine` — verifiable by a fixture test asserting no `additionalContext` is injected from that hook — while `post:edit:accumulate` and `stop:typecheck-format` continue to fire normally in the same run.
4. **AC-4:** Given a `.claude/scratchpad.md` populated with an in-progress wave/slice, `session:start:spine`'s `additionalContext` output contains the correct feature name, branch, wave number, and slice number — verifiable by a fixture test comparing the hook's stdout against the scratchpad fixture's known values.
5. **AC-5:** Running `stop:typecheck-format` against a fixture representing this repo's own configuration (no `package.json`, no typecheck command declared) exits `0`, emits the visible no-op `systemMessage` required by FR-6.9, and does not block the `Stop` event — verified by the fixture test required by FR-6.10/FR-8.2 as the primary (not edge-case) scenario for this hook.
6. **AC-6:** `hooks/hooks.json` contains no reference to, and is never copied into, `templates/settings.json` — verifiable by inspecting `templates/settings.json` and confirming it contains a `permissions` object only, no `hooks` key of any kind.
7. **AC-7:** `templates/settings.json`'s `permissions.deny` list is non-empty and its `permissions.allow` list contains both the 3 pre-existing entries (`Bash(git commit*)`, `Edit(.claude/scratchpad.md)`, `Write(.claude/scratchpad.md)`) and the entries added under FR-7.2.
8. **AC-8:** `node scripts/ci/validate-hooks.js` exits `0` against the real `hooks/hooks.json` shipped by this feature, and exits non-zero against each of the following deliberately seeded bad `hooks/hooks.json` fixtures: missing `id`, unknown handler `type`, a malformed `hooks` array, and a hook entry whose `command` does not route through `hooks/lib/run-hook.js` (FR-8.4, UC-1-E2) — extending the validator's existing anti-vacuity behavior (Section 6 FR-5.9) from a trivial pass on an absent file to a genuine check on a populated one.
9. **AC-9:** `.github/workflows/ci.yml`'s `validate-assets` job runs the hook fixture tests added under FR-8.1 through FR-8.3, and the job fails if any fixture test fails.
10. **AC-10:** Added per-tool-call latency from the 3 hooks is measured (wall-clock delta across a fixed sequence of tool calls, hooks enabled vs. `SDLC_HOOKS_ENABLED=0`) and reported in the implementation record, on top of the baseline of the 14 hook entries already registered in `~/.claude/settings.json` on the reference machine (Risk 2 below) — not merely asserted to be negligible without measurement.
11. **AC-11:** A session started with no `.claude/scratchpad.md` present in the project produces no `additionalContext` injection from `session:start:spine` and no error — verifiable by the fixture test required by FR-8.2.
12. **AC-12:** A session started where `~/.claude/.sdlc-receipt`'s version differs from `.claude-plugin/plugin.json`'s `version` field produces a visible drift report at session start; a session where the two match produces no drift report; a session where the receipt is absent produces no drift report and no error (FR-5.4, FR-5.5) — each verifiable by a dedicated fixture test.
13. **AC-13:** `.claude/tmp/` is listed in this repo's own `.gitignore` and in the `--init-project` scaffold's generated project `.gitignore` — verifiable by inspecting both files — and a `git status` run after a hook populates the accumulator directory shows no untracked file under `.claude/tmp/` pending a commit (FR-6.5).
14. **AC-14:** A crafted `session_id` on stdin containing path-traversal sequences or characters outside `[A-Za-z0-9_-]` (e.g. `../../etc/passwd`) does not cause `post:edit:accumulate` to write outside `.claude/tmp/` within the resolved project root — verified by the fixture test required by FR-8.6, asserting the resolved accumulator path stays confined to that directory.
15. **AC-15:** For a project with a declared typecheck command, `stop:typecheck-format`'s output contains the exact command string before or alongside the command's own result — verified by the fixture test required by FR-8.7/FR-6.12.
16. **AC-16:** `hooks/lib/run-hook.js` parses successfully under the declared minimum-supported Node syntax floor (FR-2.6), verified by a parse/lint step targeting that floor specifically, not merely by running under the CI runner's own (newer) Node version.

### 7.6 Affected Components

#### New Files

| File | Purpose |
|------|---------|
| `hooks/hooks.json` | Plugin-loaded hook configuration declaring the 3 handler entries (`SessionStart`, `PostToolUse` on `Edit\|Write`, `Stop`), each routed through `run-hook.js` (FR-1) |
| `hooks/lib/run-hook.js` | Shared wrapper — `${CLAUDE_PLUGIN_ROOT}` resolution, Node-version assertion, per-hook timeouts, the fail-open contract, and dispatch by hook id (FR-2, FR-3, FR-4) |
| `hooks/handlers/session-start-spine.js` | `session:start:spine` handler logic (FR-5) |
| `hooks/handlers/post-edit-accumulate.js` | `post:edit:accumulate` handler logic (FR-6) |
| `hooks/handlers/stop-typecheck-format.js` | `stop:typecheck-format` handler logic (FR-6) |
| `tests/fixtures/hooks/*` | Crafted stdin fixtures for every hook's positive, negative, and fail-open test cases (FR-8.1 through FR-8.3) |
| `.claude/tmp/` (created at runtime by `post:edit:accumulate`; not shipped in the repo) | Per-session accumulator directory holding edited/written file paths, keyed by a sanitized `session_id` (FR-6.1 through FR-6.6) |
| `templates/.gitignore` | Gitignore template copied into scaffolded projects by `--init-project`, covering `.claude/tmp/` (FR-6.5) |

*(Exact handler filenames under `hooks/handlers/` are illustrative and may be finalized by the planner during `/bootstrap-feature`; `hooks/hooks.json` and `hooks/lib/run-hook.js` are fixed by FR-1.1 and FR-2.1 respectively.)*

#### Modified Files

| File | Changes | Related Requirements |
|------|---------|---------------------|
| `.claude-plugin/plugin.json` | Add `hooks: "./hooks/"` component path field | FR-1.2 |
| `templates/settings.json` | Add `permissions.deny`; expand `permissions.allow` beyond the current 3 entries; preserve existing entries | FR-7.1, FR-7.2, FR-7.4 |
| `scripts/ci/validate-hooks.js` | Gains a check that every hook entry's `command` routes through `hooks/lib/run-hook.js` (resolves the FR-8.4/UC-1-E2 contradiction — the validator previously only checked that `command` was non-empty); its existing schema checks now also run against a real, populated `hooks/hooks.json` instead of the absent-file pass path | FR-8.4 |
| `.github/workflows/ci.yml` | Add hook fixture-test invocation to the `validate-assets` job | FR-8.5 |
| `.gitignore` (repo root) | Add `.claude/tmp/` so this repo's own accumulator runtime directory is never committed | FR-6.5 |
| `install.sh` | `scaffold_project()` gains a step copying `templates/.gitignore` into a scaffolded project as part of `--init-project`, so scaffolded projects ignore `.claude/tmp/` too. This is a shell/text-only change — it introduces no `node` or `jq` invocation, so Section 6 NFR-1's constraint on the installer is unaffected. | FR-6.5 |

#### Unchanged Files (verified no impact)

| File | Reason |
|------|--------|
| `manifests/owned-files.txt` | The manifest enumerates `install.sh`'s `~/.claude` footprint only; hooks ship exclusively through the plugin (FR-1.1) and are never installed by `install.sh`. |
| `agents/*.md` (13 files) | No agent role or prompt changes; this feature is infrastructure and non-blocking hooks only. |
| `skills/*/SKILL.md` (5 files) | No skill changes; the residual entry-point gap this feature closes (FR-5.6) is closed by a hook, not a skill edit. |
| `src/claude.md`, `src/rules/*.md` | The memory layer's content is unaffected; nothing in this feature changes the pipeline instruction or process rules text itself. |

### 7.7 UI Changes

None. This feature adds Node-based hook handlers that run inside Claude Code's own tool-call and session lifecycle; there is no web application, page, or user-facing component. The only observable surface is `additionalContext`/`systemMessage` text injected into the agent's own context window, not a UI.

### 7.8 Schema Changes

None. This project has no database of any kind; nothing in this feature introduces one.

### 7.9 Affected Endpoints

None. This project has no API server; hooks execute as local child processes spawned directly by Claude Code's own hook engine on the developer's machine, not as network endpoints.

### 7.10 Risks and Dependencies

1. **Risk: Hook malfunction becoming policy.** A hook that crashes, hangs, or cannot spawn Node on every tool call would functionally replace this harness's prose-only enforcement with a *worse* mechanism — one that halts every run instead of merely being occasionally ignored. Mitigation: FR-3's fail-open contract makes every malfunction mode (throw, timeout, Node-unavailable) an unconditional exit-`0` at the `run-hook.js` layer, not a per-hook convention; FR-8.3 requires a fixture test proving each of the 3 fail-open cases actually exits `0`.
2. **Risk: This machine already runs 14 hook entries in `~/.claude/settings.json`, several with empty matchers on `PreToolUse`/`PostToolUse`.** This feature's 3 hooks stack on top of that existing configuration on every matching tool call; ordering, cumulative latency, and exit-code interaction between the pre-existing 14 entries and this feature's 3 cannot be assumed negligible — it must be measured. Mitigation: AC-10 requires measured, reported per-tool-call latency (hooks enabled vs. `SDLC_HOOKS_ENABLED=0`) rather than an unverified assertion of negligibility.
3. **Risk: Double execution if `hooks/hooks.json` is pasted into `settings.json`.** Plugin hooks auto-load from the plugin's own `hooks/hooks.json` the moment the plugin is installed; a well-intentioned copy of the same configuration into a project's or user's `settings.json` would register every hook twice, doubling side effects (duplicate `additionalContext` injections, `post:edit:accumulate` recording each path twice) and doubling any measured latency from Risk 2. Mitigation: FR-7.3 states this as a hard requirement, AC-6 makes it machine-verifiable by inspecting `templates/settings.json` for the absence of any `hooks` key, and the risk is called out explicitly in the templates file's own comments (an implementation detail, not a requirement text change).
4. **Risk: Hook stdin does not carry context-window usage — only the statusline JSON does.** A future context-budget monitor cannot be built as a hook on top of this feature's infrastructure alone; it needs the statusline (the roadmap's F4) shipped first, and per the roadmap's Risk 8, a side-channel bridge between the two must degrade visibly (not silently) if the statusline is not running. Mitigation: this feature does not attempt a context monitor — `session:start:spine`'s drift check and scratchpad injection are the only state this feature reads — and the dependency on F4 is recorded here so a future feature does not silently assume stdin carries data it does not.
5. **Dependency: Section 6 (Plugin Repackaging and Harness CI) must exist first.** This feature's plugin manifest field (FR-1.2), CI validator extension (FR-8.4), and drift-check input (FR-5.4, reading Section 6 FR-4.8's install receipt) all assume the plugin scaffold, `scripts/ci/validate-hooks.js`, and the manifest-driven installer Section 6 produces. Per the roadmap's stated execution order (F1 → F2a → F2b), this feature is F2a and lands immediately after Section 6.
6. **Dependency: This feature is a prerequisite for Section 8 (the roadmap's F2b, blocking guards).** Every blocking guard in Section 8 is expected to be implemented as a hook invoked through `hooks/lib/run-hook.js` and subject to the same fail-open contract (FR-3) this feature establishes. Section 8 cannot begin until this feature's wrapper, configuration file, and runtime controls exist.
7. **Dependency: Mandatory `security-auditor` pre-review — permissions defaults (FR-7).** Every project scaffolded by `--init-project` inherits `templates/settings.json`'s `permissions.allow`/`permissions.deny` policy verbatim; a single overly-broad `allow` entry (for example, an insufficiently scoped `Bash(...)` pattern) weakens that policy for every project scaffolded afterward, not just the one it was written for. Given that blast radius, this slice REQUIRES `security-auditor` review before merge, not just the standard Phase 4 gate; this is called out here so the implementation plan schedules it as a pre-review.
8. **Dependency: Mandatory `security-auditor` pre-review — `session:start:spine` (FR-5).** This hook injects project-owned file content (`.claude/scratchpad.md`) into model context at the start of every session, in any repository an adopter opens — a prompt-injection surface by construction, since that file's content is controllable by anyone who can commit to the repository being opened. FR-5.8 (structured-field extraction over raw pass-through), FR-5.9 (a hard character cap), and FR-5.10 (untrusted-data framing) are this PRD's baseline mitigations; this slice REQUIRES `security-auditor` review before merge to confirm those mitigations are sufficient, not merely stated.
9. **Dependency: Mandatory `security-auditor` pre-review — `stop:typecheck-format` (FR-6).** This is the sharpest surface in the feature: it executes a command declared by the project's own `CLAUDE.md`, spawned directly by the hook engine, and therefore **not mediated by Claude Code's permission system at all** — `permissions.allow`/`permissions.deny` (FR-7) govern tool calls the agent itself makes, not child processes a hook spawns. A hostile or compromised repository's declared "typecheck command" would run automatically at the end of the first response in that repository, with no permission prompt. FR-6.12 (echo the exact command before running) and FR-6.13 (discovery strictly limited to the declared Commands section) are this PRD's baseline mitigations; FR-6.14 explicitly defers the open question — whether an additional trust signal should gate first execution in a given project — to this mandatory pre-review rather than prescribing an answer here.
