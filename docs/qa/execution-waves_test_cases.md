# Test Cases: Execution Waves -- Parallel Slice Implementation

> Based on [PRD](../PRD.md) -- Section 2 and [Use Cases](../use-cases/execution-waves_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, and cross-reference integrity by reading files and checking their contents.

---

## 1. Planner Wave Assignment (UC-1)

### 1.1 Wave Field in Slice Template

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | UC-1 (Primary Flow, Step 8) | `planner.md` Output Format includes `Wave: N` field in per-slice template | `src/agents/planner.md` exists | Read the Output Format section of `src/agents/planner.md` | The per-slice format includes a `Wave:` field alongside `Files:`, `Changes:`, `Verify:`, and `Done when:` (per FR-1.1, FR-1.6) |
| 1.1.2 | UC-1 (Primary Flow, Step 8) | `Wave:` field is specified as a 1-indexed integer | `src/agents/planner.md` exists | Read the `Wave:` field description in the Output Format section | The field description specifies the value as an integer, 1-indexed (e.g., `Wave: 1`, `Wave: 2`) |

### 1.2 Wave Assignment Section

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.2.1 | UC-1 (Primary Flow, Steps 2-10) | `planner.md` has a "Wave Assignment" post-processing section | `src/agents/planner.md` exists | Grep for "Wave Assignment" in `src/agents/planner.md` | A section named "Wave Assignment" (or equivalent) exists that describes the post-processing step after all slices are defined |
| 1.2.2 | UC-1 (Primary Flow, Steps 3-5) | Wave Assignment section documents the file-overlap algorithm | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The section documents the algorithm: (a) collect `Files:` lists from all slices, (b) compute file-set intersection for each pair, (c) group slices with zero intersection and no logical dependency into the same wave (per FR-1.2) |
| 1.2.3 | UC-1 (Primary Flow, Step 9) | Wave Assignment section requires a wave summary table | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The section requires the planner to output a wave summary table showing wave number, slice numbers in that wave, and rationale (per FR-1.4) |

### 1.3 Planner Constraints -- File Exclusivity and Dependency Ordering

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.3.1 | UC-1 (Postconditions) | Planner constrains that no two slices in the same wave share any file | `src/agents/planner.md` exists | Read the "Wave Assignment" section or Constraints section | The instructions explicitly state that slices in the same wave MUST have zero file-set intersection (per FR-1.2, FR-1.3) |
| 1.3.2 | UC-1-E1 | Planner constrains dependency ordering across waves | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The instructions state that slices depending on earlier slices (via `Done when:` references or shared files) MUST be in a later wave (per FR-1.3) |
| 1.3.3 | UC-1 (Primary Flow, Step 7) | Wave 1 contains only slices with no dependencies | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The instructions state that Wave 1 MUST contain only slices with no dependencies on other slices (per FR-1.3) |

### 1.4 Planner Alternative and Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.4.1 | UC-1-A1 | Fully sequential assignment is documented | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The section describes the fully sequential case: when all slices share files, each slice gets its own wave (Slice 1 = Wave 1, ..., Slice N = Wave N), equivalent to sequential execution (per FR-1.5) |
| 1.4.2 | UC-1-A2 | Fully parallel assignment is documented | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The section describes or allows the fully parallel case: when no slices share files and no logical dependencies exist, all slices can be assigned to Wave 1 |
| 1.4.3 | UC-1-EC1 | Wave assignment is optional (can be omitted) | `src/agents/planner.md` exists | Read the "Wave Assignment" section or the Output Format section | The instructions state that `Wave:` fields are optional per NFR-4; plans without wave assignments are valid and fall back to sequential execution |
| 1.4.4 | UC-1-EC2 | Single-slice plan wave assignment is documented | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The section addresses or implicitly covers the trivial single-slice case (sole slice assigned to Wave 1) |
| 1.4.5 | UC-1-EC3 | Transitive dependency chain prevents same-wave grouping | `src/agents/planner.md` exists | Read the "Wave Assignment" section | The algorithm or instructions address that transitive dependencies (A shares files with B, B shares files with C) prevent A and C from being in the same wave even if they have no direct overlap |

---

## 2. develop-feature Wave-Aware Orchestration (UC-2)

### 2.1 Wave Detection and Phase 2 Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | UC-2 (Primary Flow, Step 1) | `develop-feature.md` Phase 2 mentions "Wave-Aware" or wave-based orchestration | `src/commands/develop-feature.md` exists | Grep for "wave" or "Wave" in `src/commands/develop-feature.md` | Phase 2 (Implement All Slices) contains wave-aware orchestration logic that groups slices by `Wave:` field (per FR-2.1) |
| 2.1.2 | UC-2 (Primary Flow, Step 1) | `develop-feature.md` describes reading plan and grouping slices by wave | `src/commands/develop-feature.md` exists | Read the Phase 2 section | The section instructs reading the implementation plan and grouping slices by their `Wave: N` field before starting implementation |

### 2.2 Parallel Spawning via Agent Tool

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | UC-2 (Primary Flow, Steps 4-5) | `develop-feature.md` references Agent tool for parallel subagent spawning | `src/commands/develop-feature.md` exists | Grep for "Agent" (tool name) or "subagent" or "parallel" in the Phase 2 section | The section instructs spawning one parallel Agent subagent per slice when a wave contains multiple slices (per FR-2.3) |
| 2.2.2 | UC-2 (Primary Flow, Step 5) | Subagent spawn prompt includes full slice context | `src/commands/develop-feature.md` exists | Read the parallel spawning instructions | The instructions specify that each subagent receives: slice number, `Files:`, `Changes:`, `Verify:`, `Done when:`, wave number, and sibling slice numbers (per FR-2.7) |
| 2.2.3 | UC-2 (Primary Flow, Step 8) | `develop-feature.md` specifies waiting for all subagents in wave N before starting wave N+1 | `src/commands/develop-feature.md` exists | Read the wave orchestration logic | The instructions explicitly state that all subagents in a wave must complete before the next wave begins (per FR-2.4) |

### 2.3 Orchestrator-Only Scratchpad Updates

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.3.1 | UC-2 (Primary Flow, Steps 6, 10) | `develop-feature.md` specifies orchestrator-only scratchpad writes during parallel waves | `src/commands/develop-feature.md` exists | Read the Phase 2 section | The section explicitly states that subagents do NOT write to `.claude/scratchpad.md` and that the orchestrator is the sole scratchpad writer during parallel waves (per FR-2.5, FR-2.6) |
| 2.3.2 | UC-2 (Primary Flow, Step 6) | Subagent spawn prompt includes scratchpad-skip instruction | `src/commands/develop-feature.md` exists | Read the subagent spawn prompt template or instructions | The spawn prompt includes an explicit instruction telling the subagent to skip scratchpad writes (per FR-2.6) |
| 2.3.3 | UC-2 (Primary Flow, Step 10) | Orchestrator updates scratchpad after each wave completes | `src/commands/develop-feature.md` exists | Read the post-wave logic | The instructions specify that after all subagents in a wave complete, the orchestrator updates the scratchpad with results for every slice in that wave (per FR-2.5) |

### 2.4 Failure Handling

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.4.1 | UC-2-E1 (Steps 4, 6) | `develop-feature.md` describes keeping successful sibling commits on partial wave failure | `src/commands/develop-feature.md` exists | Read the failure handling section | The section states that successful commits from sibling slices are kept (not rolled back) because wave design guarantees file-level isolation (per FR-6.4) |
| 2.4.2 | UC-2-E1 (Step 4) | `develop-feature.md` describes not aborting the wave on a single failure | `src/commands/develop-feature.md` exists | Read the failure handling section | The section states that a failure in one subagent does not abort other subagents in the same wave; the orchestrator waits for all to complete (per FR-6.2) |
| 2.4.3 | UC-2-E1 (Steps 8-9) | `develop-feature.md` describes escalation options after wave failure | `src/commands/develop-feature.md` exists | Read the failure handling section | The section presents three escalation options: (a) retry failed slice(s) only, (b) abort remaining waves, (c) continue and address failures later (per FR-6.5) |

### 2.5 Backward Compatibility

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.5.1 | UC-2-A2 | `develop-feature.md` includes backward compatibility clause for plans without `Wave:` fields | `src/commands/develop-feature.md` exists | Read the wave orchestration section | The section explicitly states that when no `Wave:` fields are present, all slices are treated as sequential (one slice per implicit wave), identical to pre-feature behavior (per FR-2.1) |
| 2.5.2 | UC-2-A1 | `develop-feature.md` handles single-slice waves via existing `/implement-slice` workflow | `src/commands/develop-feature.md` exists | Read the wave orchestration section | The section states that single-slice waves use the existing `/implement-slice` invocation without parallel subagent spawning (per FR-2.2) |

### 2.6 Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.6.1 | UC-2-EC3 | `develop-feature.md` addresses subagent spawn failure | `src/commands/develop-feature.md` exists | Read the failure handling section | The section addresses the case where the Agent tool fails to spawn a subagent: treated as a slice failure, other subagents continue, the failure is included in the post-wave report |
| 2.6.2 | UC-2-E2 | `develop-feature.md` addresses complete wave failure (all subagents fail) | `src/commands/develop-feature.md` exists | Read the failure handling section | The section addresses the case where all subagents in a wave fail: all failures reported together, escalation options presented |

---

## 3. implement-slice Wave Context (UC-3)

### 3.1 Wave Context in Output Format

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | UC-3 (Primary Flow, Step 5) | `implement-slice.md` commit message format includes wave context suffix | `src/commands/implement-slice.md` exists | Grep for "wave" or "sibling" in `src/commands/implement-slice.md` | The file describes a commit message format that includes wave number and sibling slice numbers when running in parallel mode (e.g., `[wave 2, siblings: 2,4]`) (per FR-3.2) |
| 3.1.2 | UC-3 (Primary Flow, Step 1) | `implement-slice.md` accepts wave context from spawn prompt | `src/commands/implement-slice.md` exists | Read the slice identification or input section | The file describes receiving wave number and sibling slice numbers as part of the input context (per FR-3.2) |

### 3.2 Scratchpad Skip in Parallel Mode

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.2.1 | UC-3 (Primary Flow, Step 6) | `implement-slice.md` documents scratchpad write skip when running as subagent | `src/commands/implement-slice.md` exists | Grep for "scratchpad" and "skip" or "do not write" in the file | The file contains a rule that when wave context is present (running as parallel subagent), the slice MUST skip `.claude/scratchpad.md` writes (per FR-3.3) |
| 3.2.2 | UC-3-A1 | `implement-slice.md` preserves standard scratchpad writes when running standalone | `src/commands/implement-slice.md` exists | Read the scratchpad handling section | The file states that when no wave context is present (standalone execution), scratchpad writes proceed as normal -- identical to pre-feature behavior (per FR-3.4) |

### 3.3 Auto-Continue Note

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.3.1 | UC-3 (FR-3.1) | `implement-slice.md` states it remains a single-slice command (wave orchestration is develop-feature's job) | `src/commands/implement-slice.md` exists | Read the file for wave-related scope boundaries | The file explicitly states that `implement-slice` remains a single-slice command; it does not spawn parallel agents or manage waves -- wave orchestration is handled by `develop-feature` (per FR-3.1) |

---

## 4. Scratchpad Wave Format (UC-4)

### 4.1 Wave Subheading Format

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | UC-4 (Primary Flow, Steps 1-4) | `scratchpad.md` rules define `### Wave N` subheading format | `src/rules/scratchpad.md` exists | Grep for "### Wave" or "Wave N" in `src/rules/scratchpad.md` | The file defines a `### Wave N` subheading format for grouping slices under wave headings in the `## Plan` section (per FR-4.1) |
| 4.1.2 | UC-4 (Primary Flow, Step 3) | Wave subheadings include wave-level status values | `src/rules/scratchpad.md` exists | Read the wave format section | The file defines wave-level status values: `pending`, `in progress`, `complete`, `failed` (per FR-4.2) |
| 4.1.3 | UC-4 (Primary Flow, Step 4) | Individual slice statuses are preserved within wave groups | `src/rules/scratchpad.md` exists | Read the wave format section | The file states that within each wave group, slices retain `DONE` / `IN PROGRESS` / `pending` / `FAILED` statuses (per FR-4.3) |
| 4.1.4 | UC-4 (Primary Flow, Step 5) | `## Status:` supports `implementing wave N/M` value | `src/rules/scratchpad.md` exists | Grep for "implementing wave" in `src/rules/scratchpad.md` | The `## Status:` field documentation includes `implementing wave N/M` as a valid status value in addition to the existing `implementing slice N/M` (per FR-4.5) |

### 4.2 Legacy Fallback

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.2.1 | UC-4-A1 | `scratchpad.md` rules define fallback to flat list format when no wave assignments exist | `src/rules/scratchpad.md` exists | Read the wave format section | The file explicitly states that when no wave assignments exist in the plan, the scratchpad uses the current flat list format with no `### Wave N` subheadings (per FR-4.4) |
| 4.2.2 | UC-4-A1 (Step 4) | Legacy fallback uses `implementing slice N/M` status | `src/rules/scratchpad.md` exists | Read the status documentation | The file documents that `implementing slice N/M` remains valid for non-wave plans, preserving backward compatibility |

### 4.3 Archive Rule

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.3.1 | UC-4-E1 | `scratchpad.md` archive rule mentions wave-unit archiving | `src/rules/scratchpad.md` exists | Read the archive section | The file states that completed waves are archived as a unit (the entire `### Wave N (complete)` block with all its slices moves to `## Archive`) (per UC-4-E1) |

### 4.4 Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.4.1 | UC-4-EC1 | Partial wave failure scratchpad format is documented | `src/rules/scratchpad.md` exists | Read the wave format section | The file documents or demonstrates that a wave with mixed results (some DONE, some FAILED) has wave-level status `failed` and remains in `## Plan` (not archived) until resolved |

---

## 5. Plan Critic Wave Validation (UC-5)

### 5.1 Wave Assignment Validation Section

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | UC-5 (Primary Flow, Step 2) | `claude.md` Plan Critic has a "Wave Assignment Validation" section | `src/claude.md` exists | Grep for "Wave Assignment Validation" in `src/claude.md` | The Plan Critic prompt includes a named section called "Wave Assignment Validation" that appears after the existing "Slice Quality" section (per FR-5.5) |

### 5.2 File Overlap Check (CRITICAL)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.2.1 | UC-5-E1 | File overlap within a wave is flagged as CRITICAL | `src/claude.md` exists | Read the "Wave Assignment Validation" section in the Plan Critic prompt | The section instructs the critic to verify that no two slices in the same wave share any file in their `Files:` lists; shared files are a CRITICAL finding (per FR-5.1) |
| 5.2.2 | UC-5-EC2 | File path case sensitivity is addressed | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section addresses or acknowledges case-sensitivity concerns for file overlap checks (per UC-5-EC2) |
| 5.2.3 | UC-5-EC3 | New file `[new]` in one wave, modified in a later wave is valid | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section clarifies that the same file appearing across different (sequential) waves is valid -- overlap only applies within the same wave (per UC-5-EC3) |

### 5.3 Dependency Ordering Check (CRITICAL)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.3.1 | UC-5-E2 | Dependency ordering violation is flagged as CRITICAL | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section instructs the critic to verify that if slice A depends on slice B's output (via `Done when:` references), slice A is in a later wave than slice B; violation is CRITICAL (per FR-5.2) |

### 5.4 Additional Checks (MAJOR)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.4.1 | UC-5-E3 | Non-contiguous wave numbers are flagged as MAJOR | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section instructs checking wave numbers for contiguous 1-indexed integers with no gaps; non-contiguous numbers are a MAJOR finding (per FR-5.3) |
| 5.4.2 | UC-5-E4 | Mixed wave/no-wave plans are flagged as MAJOR | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section instructs checking that every slice has a `Wave:` field if any slice has one; mixed plans are a MAJOR finding (per FR-5.4) |

### 5.5 Legacy Plan Skip

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.5.1 | UC-5-A1 | Wave validation is skipped for plans without `Wave:` fields | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section states that wave validation checks are skipped entirely when no `Wave:` fields are present in any slice (per UC-5-A1) |

### 5.6 Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.6.1 | UC-5-EC1 | Single-slice waves are valid (no finding generated) | `src/claude.md` exists | Read the "Wave Assignment Validation" section | The section does not flag single-slice waves as a finding; they are valid representations of sequential dependencies (per UC-5-EC1) |

---

## 6. Parallel Wave Error Recovery (UC-3-E1, UC-2-E1, FR-6)

### 6.1 Error Recovery Section Existence

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.1.1 | FR-6.6 | `error-recovery.md` has a "Parallel Wave Execution" section | `src/rules/error-recovery.md` exists | Grep for "Parallel Wave Execution" in `src/rules/error-recovery.md` | A section named "Parallel Wave Execution" exists after the existing deviation rules (per FR-6.6) |

### 6.2 Independent Retry Budgets

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.2.1 | UC-3-E1 (Step 3), FR-6.1 | Independent retry budgets per subagent are documented | `src/rules/error-recovery.md` exists | Read the "Parallel Wave Execution" section | The section states that each subagent in a parallel wave has its own independent retry budget (3 retries per slice, not shared across the wave) (per FR-6.1) |

### 6.3 Failure Isolation

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.3.1 | UC-2-E1 (Step 4), FR-6.2 | Failure isolation is documented (no wave-wide abort) | `src/rules/error-recovery.md` exists | Read the "Parallel Wave Execution" section | The section states that when a subagent fails, the orchestrator continues waiting for other subagents in the same wave to complete -- no wave-wide abort on a single failure (per FR-6.2) |
| 6.3.2 | UC-2-E1 (Step 6), FR-6.4 | Successful sibling commits are preserved (not rolled back) | `src/rules/error-recovery.md` exists | Read the "Parallel Wave Execution" section | The section states that successful commits from sibling slices are kept, not rolled back, because wave design guarantees file-level isolation (per FR-6.4) |

### 6.4 Failure Reporting and Escalation

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.4.1 | UC-2-E1 (Step 8), FR-6.3 | Post-wave failure reporting is documented | `src/rules/error-recovery.md` exists | Read the "Parallel Wave Execution" section | The section states that after all subagents complete, failures are reported together with slice numbers, error categories (per deviation rules), and retry counts (per FR-6.3) |
| 6.4.2 | UC-2-E1 (Step 9), FR-6.5 | Escalation options are documented | `src/rules/error-recovery.md` exists | Read the "Parallel Wave Execution" section | The section documents three escalation options: (a) retry failed slice(s) only, (b) abort remaining waves, (c) continue with remaining waves and address failures later (per FR-6.5) |

### 6.5 Error Recovery Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.5.1 | UC-3-E2 | Rule 4 escalation during parallel execution is documented | `src/rules/error-recovery.md` exists | Read the "Parallel Wave Execution" section | The section addresses Rule 4 errors (architectural decisions) during parallel execution: the subagent returns failure to the orchestrator with the Rule 4 context, and the orchestrator presents it during post-wave escalation |
| 6.5.2 | UC-2-EC1 | Retry of failed slice after partial wave success is documented | `src/rules/error-recovery.md` or `src/commands/develop-feature.md` exists | Read the escalation/retry section | The documentation addresses retrying a failed slice with a fresh retry budget while keeping successful siblings' commits intact |

---

## 7. Bootstrap and Context Refresh (UC-4, FR-7, FR-8)

### 7.1 Bootstrap Wave Scratchpad Initialization

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.1.1 | UC-4 (Primary Flow, Steps 1-4), FR-7.1 | `bootstrap-feature.md` initializes wave-grouped scratchpad from planner output | `src/commands/bootstrap-feature.md` exists | Grep for "wave" or "Wave" in `src/commands/bootstrap-feature.md` | The file describes initializing the scratchpad's `## Plan` section with `### Wave N` subheadings when the planner output includes `Wave:` fields (per FR-7.1, FR-7.2) |
| 7.1.2 | UC-4-A1, FR-7.3 | `bootstrap-feature.md` falls back to flat list when no wave assignments | `src/commands/bootstrap-feature.md` exists | Read the scratchpad initialization section | The file states that if the planner output has no `Wave:` fields, the scratchpad is initialized with the existing flat list format (per FR-7.3) |

### 7.2 Context Refresh Wave Support

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.2.1 | UC-4-EC2, FR-8.1 | `context-refresh.md` detects and displays wave-grouped progress | `src/commands/context-refresh.md` exists | Grep for "wave" or "Wave" in `src/commands/context-refresh.md` | The file describes detecting `### Wave N` subheadings in the scratchpad and displaying progress grouped by wave (per FR-8.1, FR-8.2) |
| 7.2.2 | FR-8.3 | `context-refresh.md` falls back to flat display when no wave subheadings | `src/commands/context-refresh.md` exists | Read the progress display section | The file states that if no `### Wave N` subheadings exist, progress is displayed in the existing flat format (per FR-8.3) |

---

## 8. Cross-Cutting Concerns

### 8.1 Cross-Reference Integrity

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.1.1 | AC-1, AC-2, AC-3 | `develop-feature.md` references to `implement-slice` and planner field names are consistent | Implementation complete | Compare field names referenced in `develop-feature.md` wave orchestration with field names in `planner.md` output format and `implement-slice.md` input | Field names match exactly across all three files: `Wave:`, `Files:`, `Changes:`, `Verify:`, `Done when:` |
| 8.1.2 | AC-2, AC-3 | `develop-feature.md` subagent spawn prompt references match `implement-slice.md` accepted context | Implementation complete | Compare the spawn prompt fields listed in `develop-feature.md` with the wave context fields accepted by `implement-slice.md` | Both files reference the same context fields: slice number, `Files:`, `Changes:`, `Verify:`, `Done when:`, wave number, sibling slice numbers, scratchpad-skip instruction |
| 8.1.3 | AC-4 | `scratchpad.md` wave format matches the format used by `develop-feature.md` for scratchpad updates | Implementation complete | Compare the `### Wave N` format in `scratchpad.md` with the scratchpad update logic in `develop-feature.md` | Both files use consistent wave subheading format (`### Wave N`), status values (`pending`, `in progress`, `complete`, `failed`), and slice status values (`DONE`, `IN PROGRESS`, `pending`, `FAILED`) |
| 8.1.4 | AC-5 | `claude.md` wave validation checks reference the same field names used in `planner.md` | Implementation complete | Compare field names in the Plan Critic "Wave Assignment Validation" section with field names in `planner.md` | The Plan Critic references `Wave:`, `Files:`, and `Done when:` fields using the exact same names as the planner output format |

### 8.2 README Documentation

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.2.1 | NFR documentation | `README.md` mentions execution waves or parallel execution | Implementation complete | Grep for "wave" or "parallel" in `README.md` | The README references wave-based parallelism or parallel slice execution in its pipeline or feature description |
| 8.2.2 | NFR documentation | `README.md` Phase 2 description mentions parallel execution capability | Implementation complete | Read the pipeline description or Phase 2 section in `README.md` | The Phase 2 description mentions that independent slices can execute in parallel via waves |

### 8.3 Install Script

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.3.1 | NFR-1 | `install.sh` glob patterns cover all modified files | `install.sh` exists | Read the file copy sections of `install.sh` | The existing glob patterns (`src/agents/*.md`, `src/commands/*.md`, `src/rules/*.md`, etc.) cover all files modified by this feature without requiring explicit additions |

### 8.4 Backward Compatibility

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.4.1 | AC-7, NFR-2 | Plans without `Wave:` fields produce identical behavior to pre-feature pipeline | Implementation complete | Read `develop-feature.md` backward compatibility clause, `scratchpad.md` fallback, and `context-refresh.md` fallback | All three files explicitly define fallback behavior for plans/scratchpads without wave information, resulting in sequential execution identical to pre-feature behavior |
| 8.4.2 | NFR-5 | Agent count remains at 13 (no new agents introduced) | Implementation complete | Glob for `src/agents/*.md` and count results | Exactly 13 files remain -- this feature adds no new agent files |
| 8.4.3 | NFR-2 | No existing files are removed or renamed by this feature | Implementation complete | Glob for all files listed in PRD Section 2.6 "Modified Files" | All files exist at their original paths; changes are augmentations, not replacements |
| 8.4.4 | NFR-2 | Existing error-recovery deviation rules (Rules 1-4) are preserved | Implementation complete | Read `src/rules/error-recovery.md` | The existing 4 deviation rules from Section 1 FR-2 are preserved unchanged; the "Parallel Wave Execution" section is appended after them |
| 8.4.5 | NFR-2 | Existing mid-slice verification section is preserved | Implementation complete | Read `src/rules/error-recovery.md` | The "Mid-Slice Verification" section content is preserved unchanged |

---

## Use Case to Test Case Traceability Matrix

| Use Case | Test Cases |
|----------|------------|
| UC-1 Primary Flow (Wave Assignment) | 1.1.1, 1.1.2, 1.2.1, 1.2.2, 1.2.3, 1.3.1, 1.3.2, 1.3.3 |
| UC-1-A1 (Fully sequential) | 1.4.1 |
| UC-1-A2 (Fully parallel) | 1.4.2 |
| UC-1-E1 (Logical dependency despite no file overlap) | 1.3.2 |
| UC-1-EC1 (Legacy plan without Wave fields) | 1.4.3 |
| UC-1-EC2 (Single-slice plan) | 1.4.4 |
| UC-1-EC3 (Transitive dependency chain) | 1.4.5 |
| UC-2 Primary Flow (Wave-aware orchestration) | 2.1.1, 2.1.2, 2.2.1, 2.2.2, 2.2.3, 2.3.1, 2.3.2, 2.3.3 |
| UC-2-A1 (Single-slice wave) | 2.5.2 |
| UC-2-A2 (No Wave fields -- backward compat) | 2.5.1 |
| UC-2-E1 (Partial wave failure) | 2.4.1, 2.4.2, 2.4.3 |
| UC-2-E2 (Complete wave failure) | 2.6.2 |
| UC-2-EC1 (Retry after partial success) | 6.5.2 |
| UC-2-EC2 (Skip failed, continue) | 2.4.3 |
| UC-2-EC3 (Subagent spawn failure) | 2.6.1 |
| UC-3 Primary Flow (Parallel mode) | 3.1.1, 3.1.2, 3.2.1, 3.3.1 |
| UC-3-A1 (Standalone -- no wave context) | 3.2.2 |
| UC-3-E1 (Verification fails in parallel) | 6.2.1, 6.5.1 |
| UC-3-E2 (Rule 4 in parallel) | 6.5.1 |
| UC-3-EC1 (Concurrent commits) | 3.1.1 |
| UC-3-EC2 (Read-only access to sibling files) | 3.3.1 |
| UC-4 Primary Flow (Wave scratchpad) | 4.1.1, 4.1.2, 4.1.3, 4.1.4, 7.1.1 |
| UC-4-A1 (Legacy flat list) | 4.2.1, 4.2.2, 7.1.2 |
| UC-4-E1 (Archive wave-unit) | 4.3.1 |
| UC-4-EC1 (Partial wave failure scratchpad) | 4.4.1 |
| UC-4-EC2 (Context refresh reads waves) | 7.2.1, 7.2.2 |
| UC-5 Primary Flow (Valid wave assignments) | 5.1.1, 5.2.1, 5.3.1, 5.4.1, 5.4.2 |
| UC-5-A1 (No Wave fields -- skip validation) | 5.5.1 |
| UC-5-E1 (File overlap -- CRITICAL) | 5.2.1, 5.2.2, 5.2.3 |
| UC-5-E2 (Dependency ordering -- CRITICAL) | 5.3.1 |
| UC-5-E3 (Non-contiguous waves -- MAJOR) | 5.4.1 |
| UC-5-E4 (Mixed wave/no-wave -- MAJOR) | 5.4.2 |
| UC-5-EC1 (Single-slice wave valid) | 5.6.1 |
| UC-5-EC2 (Case sensitivity) | 5.2.2 |
| UC-5-EC3 (New file across waves) | 5.2.3 |
| FR-6 (Parallel wave error recovery) | 6.1.1, 6.2.1, 6.3.1, 6.3.2, 6.4.1, 6.4.2, 6.5.1, 6.5.2 |
| FR-7 (Bootstrap wave initialization) | 7.1.1, 7.1.2 |
| FR-8 (Context refresh wave support) | 7.2.1, 7.2.2 |
| AC-7, NFR-2 (Backward compatibility) | 8.4.1, 8.4.2, 8.4.3, 8.4.4, 8.4.5 |
| Cross-references (AC-1 through AC-5) | 8.1.1, 8.1.2, 8.1.3, 8.1.4 |
| README documentation | 8.2.1, 8.2.2 |
| Install script | 8.3.1 |
