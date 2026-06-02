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

**Status:** [DRAFT]
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

**Status:** [DRAFT]
**Date:** 2026-05-01
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

**Status:** [DRAFT]
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
