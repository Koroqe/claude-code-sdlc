# Test Cases: Pipeline Hardening

> Based on [PRD](../PRD.md) -- Section 1 and [Use Cases](../use-cases/pipeline-hardening_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, and cross-reference integrity by reading files and checking their contents.

---

## 1. Goal-Backward Verification (Verifier Agent)

### 1.1 Verifier Agent File Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | UC-1 | `src/agents/verifier.md` exists on disk | Implementation complete | Glob for `src/agents/verifier.md` | File exists and is non-empty |
| 1.1.2 | UC-1 | `verifier.md` has valid YAML frontmatter with all required fields | `src/agents/verifier.md` exists | Read the file; parse the YAML block between `---` delimiters | Frontmatter contains `name: verifier`, `description:` (non-empty string), `tools:` (array), and `model:` field |
| 1.1.3 | UC-1 | `verifier.md` frontmatter `model` field is set to `sonnet` | `src/agents/verifier.md` exists | Read frontmatter `model` value | `model: sonnet` (per NFR-4: consistent with verification agent cost tier) |
| 1.1.4 | UC-1 | `verifier.md` frontmatter `tools` includes Read, Glob, Grep | `src/agents/verifier.md` exists | Read frontmatter `tools` array | Tools array includes at minimum `Read`, `Glob`, `Grep` (needed for file existence checks, stub scanning, wiring verification) |

### 1.2 Verifier Agent Content -- Four Verification Levels

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.2.1 | UC-1 (Primary Flow, Step 3) | Level 1 -- File Existence check is defined | `src/agents/verifier.md` exists | Grep for "Level 1" or "File Existence" in the file | The file contains a section or instruction for Level 1 File Existence verification with explicit check instructions (verify files from plan exist on disk) |
| 1.2.2 | UC-1 (Primary Flow, Step 4) | Level 2 -- No Stubs/Placeholders check is defined | `src/agents/verifier.md` exists | Grep for "Level 2" or "Stubs" or "Placeholders" in the file | The file contains a section for Level 2 that instructs scanning for TODO, FIXME, placeholder, stub, "not implemented" markers in production code |
| 1.2.3 | UC-1 (Primary Flow, Step 5) | Level 3 -- Wiring check is defined | `src/agents/verifier.md` exists | Grep for "Level 3" or "Wiring" in the file | The file contains a section for Level 3 that checks exports are imported, routes registered, components rendered, middleware applied |
| 1.2.4 | UC-1 (Primary Flow, Step 6) | Level 4 -- Data Flow check is defined | `src/agents/verifier.md` exists | Grep for "Level 4" or "Data Flow" in the file | The file contains a section for Level 4 that traces real data paths end-to-end |
| 1.2.5 | UC-1-A3 | Level 4 is marked best-effort / non-blocking | `src/agents/verifier.md` exists | Grep for "best-effort" or "non-blocking" or "advisory" or "WARN" near the Level 4 section | Level 4 failures produce WARN status, not FAIL; the verifier documents that Level 4 alone does not block the gate |
| 1.2.6 | UC-1 (Primary Flow, Step 7) | Verifier produces structured report with per-level PASS/FAIL | `src/agents/verifier.md` exists | Read the output format section of the file | The agent prompt specifies a structured report format with PASS/FAIL/SKIPPED/WARN per level and specific findings for failures |

### 1.3 Verifier Scope Boundaries

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.3.1 | UC-1 | `verifier.md` contains a "Scope Boundaries" or equivalent section distinguishing it from build-runner and e2e-runner | `src/agents/verifier.md` exists | Read the file; search for text that distinguishes the verifier's role from build-runner (compilation/test passage) and e2e-runner (user flow testing) | The file explicitly states the verifier checks integration/wiring beyond what build-runner and e2e-runner cover, clarifying the boundary of responsibility |

### 1.4 Verifier Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.4.1 | UC-1-EC1 | Level 2 excludes test files from stub/placeholder scan | `src/agents/verifier.md` exists | Grep for exclusion patterns (test files, `__tests__`, `*.test.*`, `*.spec.*`) in Level 2 instructions | The Level 2 instructions explicitly exclude test file patterns from the stub/placeholder scan |
| 1.4.2 | UC-1-EC3 | Level 3 mentions barrel file / re-export tracing | `src/agents/verifier.md` exists | Grep for "barrel" or "re-export" or "index" in Level 3 instructions | The Level 3 instructions mention tracing through barrel files or re-exports to actual consumers |
| 1.4.3 | UC-1-EC4 | Level 3 handles dynamic imports gracefully | `src/agents/verifier.md` exists | Grep for "dynamic import" or "require()" in Level 3 instructions | The file mentions that dynamic imports cannot be statically traced and should be reported as SKIPPED items |
| 1.4.4 | UC-1-E1 | Verifier handles missing plan gracefully | `src/agents/verifier.md` exists | Search for handling of missing plan or unavailable plan | The file instructs that when no plan is found, Level 1 is SKIPPED and Levels 2-4 proceed based on actual codebase |
| 1.4.5 | UC-1-E2 | Verifier adapts to library projects (no routes/components) | `src/agents/verifier.md` exists | Search for library project handling or adapted checks | The file describes adapted checks for projects without routing or UI frameworks (focuses on exports/imports for Level 3, function call chains for Level 4) |

### 1.5 Verifier Gate in merge-ready

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.5.1 | UC-1 (Primary Flow, Steps 1-2) | `merge-ready.md` contains a Verifier gate | `src/commands/merge-ready.md` exists | Grep for "Verifier" or "verifier" in the file | A new gate section exists that delegates to the `verifier` agent |
| 1.5.2 | UC-1 (Primary Flow, Step 1) | Verifier gate appears between E2E Tests and Documentation Accuracy gates | `src/commands/merge-ready.md` exists | Read the file; check that the Verifier gate heading appears after the E2E Tests gate and before the Documentation Accuracy gate | The Verifier gate is positioned between E2E Tests (currently Gate 5) and Documentation Accuracy (currently Gate 6) |
| 1.5.3 | UC-1 (Primary Flow, Step 7) | Verifier gate checklist references all 4 verification levels | `src/commands/merge-ready.md` exists | Read the Verifier gate section | The gate checklist includes items for Level 1 (File Existence), Level 2 (No Stubs), Level 3 (Wiring), and Level 4 (Data Flow) |
| 1.5.4 | UC-1 (Primary Flow, Step 8) | merge-ready output table includes Verifier row | `src/commands/merge-ready.md` exists | Read the Output Format section | The output table includes a "Verifier" or "Goal-Backward Verification" row with PASS/FAIL/WARN status column |
| 1.5.5 | UC-1-A3 | merge-ready output table Verifier row supports WARN status (not just PASS/FAIL) | `src/commands/merge-ready.md` exists | Read the Output Format table | The Verifier row allows PASS/FAIL/WARN (WARN for when only Level 4 has findings) |

### 1.6 Verifier in Agent Table

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.6.1 | UC-1 (FR-1.8) | `claude.md` agent table includes Verifier entry | `src/claude.md` exists | Read the Agency Roles table in `src/claude.md` | Table contains a row with agent name `verifier`, a role description (e.g., "Verification Engineer"), and a responsibility description mentioning goal-backward or integration verification |
| 1.6.2 | UC-1 (FR-1.8) | Verifier role is distinct from build-runner and e2e-runner | `src/claude.md` exists | Compare the verifier row with build-runner and e2e-runner rows | The verifier's responsibility description is distinct from build-runner ("Typecheck, tests, build verification") and e2e-runner ("E2E tests from use-case scenarios") |

---

## 2. Deviation Rules (Error Recovery)

### 2.1 Rule Structure and Content

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | UC-2 (Primary Flow) | `error-recovery.md` contains 4 numbered deviation rules | `src/rules/error-recovery.md` exists | Read the file; count distinct numbered rules | The file contains exactly 4 numbered rules: Rule 1 (typos/imports), Rule 2 (validation/error handling), Rule 3 (dependency/config), Rule 4 (architectural escalation) |
| 2.1.2 | UC-2 (Primary Flow, Step 3) | Rule 1 covers auto-fix of typos and imports | `src/rules/error-recovery.md` exists | Grep for "Rule 1" and read its content | Rule 1 describes auto-fixing typos, missing imports, wrong import paths, and unused imports; includes at least 2 concrete error examples |
| 2.1.3 | UC-2-A1 | Rule 2 covers auto-add of missing validation/error handling | `src/rules/error-recovery.md` exists | Grep for "Rule 2" and read its content | Rule 2 describes auto-adding missing input validation, error handling, and null checks; includes at least 2 concrete error examples |
| 2.1.4 | UC-2-A2 | Rule 3 covers dependency/config resolution | `src/rules/error-recovery.md` exists | Grep for "Rule 3" and read its content | Rule 3 describes resolving missing dependencies, wrong versions, and misconfigured environment variables; includes at least 2 concrete error examples |
| 2.1.5 | UC-2-A3 | Rule 4 covers architectural decision escalation | `src/rules/error-recovery.md` exists | Grep for "Rule 4" and read its content | Rule 4 describes stopping and escalating when module boundaries, public API surface, or database schemas must change; includes escalation format (decision needed, options, tradeoffs) |
| 2.1.6 | UC-2 | Each rule has at least 2 concrete error examples | `src/rules/error-recovery.md` exists | Read each rule section and count example errors | Every rule section contains at least 2 categorized, concrete error examples (not just abstract descriptions) |

### 2.2 Retry Budget Rules

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | UC-2 (Primary Flow, Step 5) | Rules 1 and 2 are "free fixes" (no retry budget cost) | `src/rules/error-recovery.md` exists | Read Rules 1 and 2; search for "free" or "no retry" or "does not count" language | Both Rule 1 and Rule 2 explicitly state they do not consume retry budget |
| 2.2.2 | UC-2-A2 (Step 4) | Rule 3 costs 1 retry attempt | `src/rules/error-recovery.md` exists | Read Rule 3; search for retry budget language | Rule 3 explicitly states it costs 1 retry attempt against the 3-retry budget |
| 2.2.3 | UC-2-A3 (Step 6) | Rule 4 always escalates to user | `src/rules/error-recovery.md` exists | Read Rule 4; search for "escalate" or "stop" | Rule 4 explicitly states the agent must stop and escalate to the user with decision, options, and tradeoffs |
| 2.2.4 | UC-2-EC4 | Retry budget is per-slice, not per-step | `src/rules/error-recovery.md` exists | Read the retry budget section | The file states or implies that the 3-retry budget is tracked per implementation slice, not per individual verification step |
| 2.2.5 | UC-2 (FR-2.6) | Retry-3x mechanism is still present as a fallback | `src/rules/error-recovery.md` exists | Read the file; search for "3 retries" or "retry budget" or "3 attempts" | The file preserves the existing concept of a maximum retry count (3) before escalation, applied to Rule 3 and Rule 4 categories |

### 2.3 Mid-Slice Verification Preserved

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.3.1 | UC-2 (FR-2.5) | Mid-slice verification section is preserved unchanged | `src/rules/error-recovery.md` exists | Read the "Mid-Slice Verification" section | The section contains: "When a slice requires editing 4 or more files:" followed by the rule about typecheck after every 3 file edits, the instruction about fixing type errors immediately, the prevention rationale, and the 3-or-fewer-files exception |
| 2.3.2 | UC-2-EC3 | Deviation rules apply to mid-slice errors | `src/rules/error-recovery.md` exists | Search for text connecting deviation rules to mid-slice verification | The file states or implies that deviation rules govern errors encountered during mid-slice verification (same classification and budget rules apply) |

### 2.4 Error Flow and Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.4.1 | UC-2-E1 | Ambiguous errors default to Rule 3 | `src/rules/error-recovery.md` exists | Search for fallback/default rule guidance | The file provides guidance for ambiguous errors: default to Rule 3 (auto-resolve with retry cost) when classification is unclear |
| 2.4.2 | UC-2-E2 | Cascading errors are classified independently | `src/rules/error-recovery.md` exists | Search for cascading error or chain-of-fixes guidance | The file addresses the scenario where fixing one error introduces another: each new error is classified independently using the same rules |
| 2.4.3 | UC-2-EC1 | Multiple simultaneous errors are handled | `src/rules/error-recovery.md` exists | Search for batch error or simultaneous error guidance | The file addresses multiple errors appearing at once: Rule 1 errors fixed first as a batch (free), then remaining errors addressed by classification |
| 2.4.4 | UC-2-EC2 | Rule re-classification when a fix reveals a deeper issue | `src/rules/error-recovery.md` exists | Search for re-classification guidance | The file addresses the scenario where a Rule 1 fix reveals a deeper Rule 3 issue (the new issue is classified under its own rule) |

---

## 3. Executable Plan Format

### 3.1 Planner Output Format

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | UC-3 (Primary Flow, Step 3) | `planner.md` Output Format requires `Files:` field per slice | `src/agents/planner.md` exists | Read the Output Format section | The section requires each slice to include a `Files:` field listing exact file paths |
| 3.1.2 | UC-3 (Primary Flow, Step 3) | `planner.md` Output Format requires `Changes:` field per slice | `src/agents/planner.md` exists | Read the Output Format section | The section requires each slice to include a `Changes:` field describing specific changes per file |
| 3.1.3 | UC-3 (Primary Flow, Step 3) | `planner.md` Output Format requires `Verify:` field per slice | `src/agents/planner.md` exists | Read the Output Format section | The section requires each slice to include a `Verify:` field with exact shell command(s) for verification |
| 3.1.4 | UC-3 (Primary Flow, Step 3) | `planner.md` Output Format requires `Done when:` field per slice | `src/agents/planner.md` exists | Read the Output Format section | The section requires each slice to include a `Done when:` field with a testable boolean condition |
| 3.1.5 | UC-3-A1 | `planner.md` requires Glob verification for existing file paths | `src/agents/planner.md` exists | Search for Glob or file verification instructions | The planner instructions require verifying existing file paths via Glob during planning |
| 3.1.6 | UC-3-A1 | `planner.md` requires `[new]` marker for new files | `src/agents/planner.md` exists | Search for "[new]" or "new file" marker instructions | The planner instructions require marking new files with `[new]` in the Files field |

### 3.2 Planner Constraints Preserved

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.2.1 | UC-3 (FR-3.5) | `planner.md` Constraints section is preserved | `src/agents/planner.md` exists | Read the Constraints section | The existing constraints are preserved: slices must be small, reference actual project files, consider existing patterns, follow architecture, no code implementation, reference use-case scenarios, flag auth/financial/external slices |
| 3.2.2 | UC-3 (FR-3.4) | `planner.md` Constraints mention testable done-conditions | `src/agents/planner.md` exists | Grep for "testable" in the Constraints section | The Constraints section requires done-conditions to be testable (boolean conditions, not vague descriptions) |

### 3.3 Implement-Slice Integration

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.3.1 | UC-3-A2 (Step 2) | `implement-slice.md` references `Files:` field from plan | `src/commands/implement-slice.md` exists | Read the "Identify the Slice" section | The section instructs reading the `Files:` field from the plan slice |
| 3.3.2 | UC-3-A2 (Step 3) | `implement-slice.md` references `Changes:` field from plan | `src/commands/implement-slice.md` exists | Read the "Identify the Slice" section | The section instructs reading the `Changes:` field from the plan slice |
| 3.3.3 | UC-3-A2 (Step 5) | `implement-slice.md` references `Verify:` field from plan | `src/commands/implement-slice.md` exists | Read the "Verify" section or "Identify the Slice" section | The command instructs running the exact command(s) from the slice's `Verify:` field |
| 3.3.4 | UC-3-A2 (Step 6) | `implement-slice.md` references `Done when:` field from plan | `src/commands/implement-slice.md` exists | Read the relevant section | The command instructs checking the slice's `Done when:` condition to confirm completion |
| 3.3.5 | UC-3-E1 | `implement-slice.md` handles plans without structured fields (backward compatibility) | `src/commands/implement-slice.md` exists | Search for fallback or backward compatibility language | The command includes fallback behavior: when `Files:`, `Changes:`, `Verify:`, `Done when:` fields are absent (older plan format), the agent falls back to prose-based slice interpretation |

### 3.4 Executable Plan Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.4.1 | UC-3-EC1 | Planner handles discovered file path changes during planning | `src/agents/planner.md` exists | Search for handling of moved/deleted files during Glob verification | The planner instructions address the case where a Glob check reveals a file has been deleted or moved: update plan to reflect actual state |
| 3.4.2 | UC-3-EC2 | `Verify:` can reference test files created during implementation | `src/agents/planner.md` or `src/commands/implement-slice.md` exists | Search for guidance on verify commands referencing not-yet-created test files | Acknowledged that Verify commands run AFTER tests are written and implementation is complete; referencing future test files is valid |
| 3.4.3 | UC-3-EC3 | `Done when:` adapts to non-server projects (markdown-only) | `src/agents/planner.md` exists | Search for non-server or markdown or file existence based done-conditions | The planner instructions acknowledge that Done-when conditions can reference file existence, content checks via Grep, or structural validation for non-server projects |

---

## 4. Scope Reduction Detection (Plan Critic)

### 4.1 Hedging Language Scan in Plan Critic

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | UC-4 (Primary Flow, Step 2) | `claude.md` Plan Critic contains a Scope Reduction Detection check | `src/claude.md` exists | Search for "Scope Reduction" in the Plan Critic section | The Plan Critic prompt includes a named section or check called "Scope Reduction Detection" (or equivalent) |
| 4.1.2 | UC-4 (Primary Flow, Step 2) | Plan Critic includes hedging language scan instructions | `src/claude.md` exists | Search for "hedging" in the Plan Critic section | The Plan Critic prompt instructs scanning slice descriptions, done-conditions, and implementation notes for hedging language |
| 4.1.3 | UC-4 (Primary Flow, Step 2) | Hedging terms list includes all required terms | `src/claude.md` exists | Read the hedging language list in the Plan Critic | The list includes at minimum: "v1", "basic version", "simplified", "placeholder", "for now", "future enhancement", "out of scope for now", "minimal implementation", "stubbed out", "hardcoded for now" |
| 4.1.4 | UC-4-EC4 | Hedging terms list acknowledges it is not exhaustive | `src/claude.md` exists | Read the hedging language instructions | The instructions state the list is non-exhaustive and the critic should also flag semantically equivalent phrases (e.g., "bare minimum", "just enough to", "quick and dirty", "temporary solution", "will revisit") |

### 4.2 Scope Reduction Severity and Flagging

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.2.1 | UC-4-A1 (Step 5) | Scope reduction is flagged as MAJOR severity | `src/claude.md` exists | Read the Scope Reduction Detection instructions | Scope reduction findings are categorized as MAJOR (not MINOR, not CRITICAL) |
| 4.2.2 | UC-4-A1 (Step 5) | Finding includes specific hedging phrase, slice location, and PRD reference | `src/claude.md` exists | Read the finding format description | The instructions require each scope reduction finding to identify: the specific hedging phrase found, the slice where it appears, and the PRD requirement it violates |
| 4.2.3 | UC-4-A1 (Step 3) | Critic cross-references hedging with PRD to confirm in-scope | `src/claude.md` exists | Read the Scope Reduction Detection logic | The instructions require the critic to cross-reference the hedged item with PRD requirements to confirm the feature is in-scope before flagging |

### 4.3 Scope Reduction Exclusions

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.3.1 | UC-4-E1 | Risk/mitigation sections are excluded from hedging scan | `src/claude.md` exists | Read the Scope Reduction Detection scope | The instructions explicitly exclude risk assessment, mitigation strategies, and dependency notes from the hedging language scan |
| 4.3.2 | UC-4-A2 | PRD-authorized phased scope is not flagged | `src/claude.md` exists | Read the Scope Reduction Detection logic | The instructions state that hedging language aligned with explicit PRD phase boundaries (features marked as deferred or future scope) should NOT be flagged as scope reduction |
| 4.3.3 | UC-4-EC2 | Technical identifiers in file paths are not flagged | `src/claude.md` exists | Read the Scope Reduction Detection instructions | The instructions distinguish between hedging in natural language descriptions and technical identifiers (e.g., "v1" in `src/api/v1/routes.ts` is not hedging) |

### 4.4 Scope Reduction Edge Cases

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.4.1 | UC-4-EC1 | "Basic validation" flagged when PRD requires comprehensive validation | `src/claude.md` exists | Review the instructions for PRD-vs-plan scope comparison | The instructions cover the case where a done-condition uses hedging language that reduces the scope below the PRD's stated requirement |
| 4.4.2 | UC-4-EC3 | Extension point architecture is not flagged as scope reduction | `src/claude.md` exists | Review the instructions for false positive mitigation | The instructions address that "placeholder for future expansion" referencing an extension mechanism (not a missing feature) requires PRD cross-reference to determine if it is scope reduction |

---

## 5. Cross-Cutting Concerns

### 5.1 Cross-Reference Integrity

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | AC-9 | Every agent referenced in `merge-ready.md` has a corresponding `.md` file | Implementation complete | Read `src/commands/merge-ready.md`; extract all agent names referenced (e.g., "code-reviewer", "security-auditor", "build-runner", "e2e-runner", "doc-updater", "verifier"); Glob for each in `src/agents/` | Every agent name referenced in merge-ready has a matching `src/agents/<name>.md` file |
| 5.1.2 | AC-9 | Every agent in the `claude.md` agent table has a corresponding `.md` file | Implementation complete | Read the agent table in `src/claude.md`; extract all agent names; Glob for each in `src/agents/` | Every agent in the table has a matching `src/agents/<name>.md` file |
| 5.1.3 | AC-9 | The verifier gate in `merge-ready.md` references the verifier agent (not an inline check) | Implementation complete | Read the Verifier gate section in `src/commands/merge-ready.md` | The gate delegates to the `verifier` agent (uses "Delegate to `verifier`" pattern consistent with other gates) |
| 5.1.4 | AC-9 | `implement-slice.md` references to plan fields match `planner.md` output format | Implementation complete | Compare field names in `implement-slice.md` ("Identify the Slice" section) with field names in `planner.md` (Output Format section) | Field names match exactly: `Files:`, `Changes:`, `Verify:`, `Done when:` |

### 5.2 Agent Count Updates

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.2.1 | NFR-5, AC-8 | `claude.md` agent table has exactly 13 rows (excluding header) | Implementation complete | Count agent rows in the Agency Roles table in `src/claude.md` | The table has 13 agent rows (12 existing + 1 verifier) |
| 5.2.2 | NFR-5, AC-8 | `README.md` references updated from "12 agents" to "13 agents" | Implementation complete | Grep for "12 agents" in `README.md` | No occurrences of "12 agents" remain; at least one occurrence of "13 agents" exists |
| 5.2.3 | NFR-5, AC-8 | `README.md` agent table includes verifier row | Implementation complete | Read the agent table in `README.md` | The table includes a row for the verifier agent with role and description |
| 5.2.4 | NFR-5 | `install.sh` references updated from 12 to 13 agents | Implementation complete | Grep for "12" in `install.sh` (in contexts referencing agent count) | All textual references to "12 agents" or "12 AI agents" or "12 specialized" are updated to 13; operational code that dynamically counts files (e.g., `ls -1 | wc -l`) is unchanged |
| 5.2.5 | NFR-5 | `src/agents/` directory contains exactly 13 `.md` files | Implementation complete | Glob for `src/agents/*.md` and count results | Exactly 13 files: the 12 original agents plus `verifier.md` |

### 5.3 README Pipeline Diagram

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.3.1 | AC-8 | `README.md` pipeline diagram shows verifier gate in `/merge-ready` section | Implementation complete | Read the pipeline diagram (ASCII art) in `README.md` | The `/merge-ready` section of the diagram includes a "Verifier" or "Goal-Backward Verification" step |
| 5.3.2 | AC-8 | `README.md` mentions deviation rules / error recovery improvement | Implementation complete | Grep for "deviation" or "error recovery" or "graduated" in `README.md` | The README references the improved error recovery approach (deviation rules) somewhere in its feature description |
| 5.3.3 | AC-8 | `README.md` mentions executable plan format | Implementation complete | Grep for "executable plan" or "Files:" or "Changes:" or "Verify:" or "Done when:" in `README.md` | The README references the structured executable plan format somewhere in its feature description |

### 5.4 Backward Compatibility

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.4.1 | NFR-2 | No existing agent files are removed or renamed | Implementation complete | Glob for all 12 original agent files by name | All 12 original agent files still exist at their original paths under `src/agents/` |
| 5.4.2 | NFR-2 | No existing command files are removed or renamed | Implementation complete | Glob for all 5 original command files by name | All 5 original command files still exist at their original paths under `src/commands/` |
| 5.4.3 | NFR-2 | No existing rule files are removed or renamed | Implementation complete | Glob for all 4 original rule files by name | All 4 original rule files still exist at their original paths under `src/rules/` |
| 5.4.4 | NFR-2 | `error-recovery.md` mid-slice verification section content is preserved verbatim | Implementation complete | Compare the mid-slice verification section in updated `src/rules/error-recovery.md` with original content | The "Mid-Slice Verification" section contains the original text: "When a slice requires editing 4 or more files:" / typecheck after every 3 file edits / fix type errors immediately / "For slices touching 3 or fewer files: end-of-slice verification is sufficient." |
| 5.4.5 | NFR-2, UC-3-A2 | `implement-slice.md` backward compatible with plans lacking structured fields | Implementation complete | Read `src/commands/implement-slice.md` | The file includes fallback logic: if the plan does not have `Files:`, `Changes:`, `Verify:`, `Done when:` fields, the implementing agent falls back to restating the slice in prose (existing behavior preserved) |

### 5.5 Install Script Integration

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.5.1 | NFR-3 | `install.sh` agent copy uses glob pattern (automatically picks up new agents) | `install.sh` exists | Read the agent copy section of `install.sh` | The script uses a glob pattern (`src/agents/*.md` or `"$SCRIPT_DIR"/src/agents/*.md`) to copy agents, meaning `verifier.md` is automatically included without an explicit file list change |
| 5.5.2 | NFR-3 | `install.sh` textual references to agent count are updated | `install.sh` exists | Grep for all hardcoded references to "12" in contexts describing agent count | All prose references to "12 agents", "12 specialized", "12 AI agents", "12 files" (in agents context) are updated to 13 |

---

## Use Case to Test Case Traceability Matrix

| Use Case | Test Cases |
|----------|------------|
| UC-1 Primary Flow | 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.6, 1.5.1, 1.5.2, 1.5.3, 1.5.4, 1.6.1, 1.6.2 |
| UC-1-A1 (Level 2 fails) | 1.2.2, 1.4.1 |
| UC-1-A2 (Level 3 fails) | 1.2.3, 1.4.2, 1.4.3 |
| UC-1-A3 (Level 4 advisory) | 1.2.5, 1.5.5 |
| UC-1-E1 (No plan) | 1.4.4 |
| UC-1-E2 (Library project) | 1.4.5 |
| UC-1-EC1 (Test file exclusion) | 1.4.1 |
| UC-1-EC2 (Intentionally deleted file) | 1.4.4 |
| UC-1-EC3 (Barrel files) | 1.4.2 |
| UC-1-EC4 (Dynamic imports) | 1.4.3 |
| UC-2 Primary Flow (Rule 1) | 2.1.1, 2.1.2, 2.2.1, 2.2.5 |
| UC-2-A1 (Rule 2) | 2.1.3, 2.2.1 |
| UC-2-A2 (Rule 3) | 2.1.4, 2.2.2, 2.2.5 |
| UC-2-A3 (Rule 4) | 2.1.5, 2.2.3 |
| UC-2-E1 (Ambiguous error) | 2.4.1 |
| UC-2-E2 (Cascading error) | 2.4.2 |
| UC-2-EC1 (Multiple errors) | 2.4.3 |
| UC-2-EC2 (Re-classification) | 2.4.4 |
| UC-2-EC3 (Mid-slice deviation) | 2.3.2 |
| UC-2-EC4 (Per-slice budget) | 2.2.4 |
| UC-3 Primary Flow | 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5, 3.1.6 |
| UC-3-A1 (New file marker) | 3.1.6 |
| UC-3-A2 (Implement reads fields) | 3.3.1, 3.3.2, 3.3.3, 3.3.4 |
| UC-3-A3 (Verify fails) | 3.3.3 |
| UC-3-E1 (Manual verification) | 3.4.2 |
| UC-3-EC1 (File moved during planning) | 3.4.1 |
| UC-3-EC2 (Future test files in Verify) | 3.4.2 |
| UC-3-EC3 (Markdown-only done-when) | 3.4.3 |
| UC-4 Primary Flow | 4.1.1, 4.1.2, 4.1.3 |
| UC-4-A1 (Hedging found, in-scope) | 4.2.1, 4.2.2, 4.2.3 |
| UC-4-A2 (Hedging found, PRD-authorized) | 4.3.2 |
| UC-4-E1 (Risk section exclusion) | 4.3.1 |
| UC-4-EC1 (Basic vs comprehensive) | 4.4.1 |
| UC-4-EC2 (v1 in file path) | 4.3.3 |
| UC-4-EC3 (Extension point pattern) | 4.4.2 |
| UC-4-EC4 (Non-exhaustive list) | 4.1.4 |
| FR-1.8, AC-7 (Agent table) | 1.6.1, 1.6.2, 5.2.1 |
| NFR-2 (Backward compat) | 5.4.1, 5.4.2, 5.4.3, 5.4.4, 5.4.5 |
| NFR-5, AC-8 (Agent count) | 5.2.1, 5.2.2, 5.2.3, 5.2.4, 5.2.5 |
| AC-9 (Cross-references) | 5.1.1, 5.1.2, 5.1.3, 5.1.4 |
