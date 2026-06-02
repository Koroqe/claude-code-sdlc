# Test Cases: Changelog Automation

> Based on [PRD](../PRD.md) — Section 5 and [Use Cases](../use-cases/changelog-automation_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files. "Testing" means verifying file existence, structural correctness, and content presence by reading files and checking their contents — exactly as documented in the pipeline-hardening test cases.

---

## 1. Changelog Rule File (`src/rules/changelog.md`)

### 1.1 File Existence and Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | UC-1 Primary Flow, UC-2 Primary Flow | `src/rules/changelog.md` exists on disk | Implementation complete | Glob for `src/rules/changelog.md` | File exists and is non-empty |
| 1.1.2 | UC-E3 Primary Flow | Rule file mandates `date -u` retrieval — never hallucinate | `src/rules/changelog.md` exists | Grep for `date -u` in the file | The literal string `date -u` appears in the file; the surrounding text explicitly forbids inventing or estimating the timestamp |
| 1.1.3 | UC-1 Primary Flow step 6, UC-E4 | Rule file documents the four required entry fields | `src/rules/changelog.md` exists | Grep for "Name", "Summary", "Details", and "UTC" (or "Date") in the file | All four field names (Date/time, Name, Summary, Details) are present in the file |
| 1.1.4 | UC-3 Primary Flow, UC-4 Primary Flow | Rule file documents day-grouping under `## YYYY-MM-DD` headings | `src/rules/changelog.md` exists | Grep for `## YYYY-MM-DD` or equivalent heading format description | The file documents the `## YYYY-MM-DD` heading structure for grouping entries by day |
| 1.1.5 | UC-3 Primary Flow, UC-4 Primary Flow | Rule file specifies newest-day-first and newest-entry-first ordering | `src/rules/changelog.md` exists | Grep for "newest" or "first" in the context of day and entry ordering | The file explicitly states that the newest day heading appears first (top of file) and the newest entry appears first within a day |
| 1.1.6 | UC-E4 Primary Flow | Rule file documents the 500-character cap on the Details field | `src/rules/changelog.md` exists | Grep for "500" in the file | The file states the Details field is capped at 500 characters and must be trimmed if exceeded |
| 1.1.7 | UC-E1 Primary Flow | Rule file defines the idempotency guard | `src/rules/changelog.md` exists | Grep for "idempotent" or "duplicate" or "already exists" or "update" in the file | The file defines the guard: before writing, check whether an entry with the same name already exists under today's `## YYYY-MM-DD` heading; if found, update it rather than appending a duplicate |
| 1.1.8 | UC-1 Primary Flow step 2, UC-2 Primary Flow step 3 | Rule file defines both trigger points and their ownership | `src/rules/changelog.md` exists | Grep for "merge-ready" and "implement-slice" in the file | Both trigger points are named: `/merge-ready` (after all gates PASS) and standalone `/implement-slice` (not pipeline-driven, not a parallel-wave subagent) |
| 1.1.9 | UC-E2 Primary Flow, UC-6 Primary Flow | Rule file defines the suppression-flag mechanism | `src/rules/changelog.md` exists | Grep for "no-changelog" or "suppression" or "suppress" in the file | The file documents the `no-changelog` suppression flag: any `/implement-slice` receiving this flag must skip the changelog step; it covers both the single-slice-wave direct path and parallel-wave subagent spawns |
| 1.1.10 | UC-E2-A1, UC-6 Primary Flow | Rule file states parallel-wave subagents must NOT write | `src/rules/changelog.md` exists | Grep for "parallel" or "subagent" in the file | The file explicitly states that parallel-wave subagents must not write to `CHANGELOG.md` |

### 1.2 Writer Procedure Completeness

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.2.1 | UC-E3 Primary Flow | Writer procedure lists `date -u` as step 1 | `src/rules/changelog.md` exists | Read the writer procedure section; check that step 1 is the `date -u` invocation | The numbered writer procedure's first step is: run `date -u +'%Y-%m-%d %H:%M'` via Bash |
| 1.2.2 | UC-7 Primary Flow | Writer procedure includes "create file if absent" step | `src/rules/changelog.md` exists | Read the writer procedure section | A step instructs: if `CHANGELOG.md` is absent, create it with the `# Changelog` header block |
| 1.2.3 | UC-3 Primary Flow, UC-4 Primary Flow | Writer procedure covers both day-heading cases (existing day and new day) | `src/rules/changelog.md` exists | Read the writer procedure section | A step handles both: (a) if a `## <today's date>` heading exists, insert new entry as the first entry under it; (b) otherwise insert a new `## <today's date>` block after the header (above older day headings) |
| 1.2.4 | UC-E4 Primary Flow | Writer procedure includes the 500-char trim step | `src/rules/changelog.md` exists | Read the writer procedure section | A step enforces the 500-character cap on Details, trimming silently if needed |
| 1.2.5 | UC-E1 Primary Flow | Writer procedure includes idempotency guard as a step | `src/rules/changelog.md` exists | Read the writer procedure section | A step applies the idempotency guard before writing (checking for an existing same-name entry under today's heading) |

---

## 2. Merge-Ready Finalization Step

### 2.1 Section Existence and Placement

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | UC-1 Primary Flow step 2 | `src/commands/merge-ready.md` contains a "Finalization: Changelog Entry" section | `src/commands/merge-ready.md` exists | Grep for "Finalization" and "Changelog" in the file | A section named (or equivalent to) "Finalization: Changelog Entry" exists in the file |
| 2.1.2 | UC-1 Primary Flow step 2, UC-1-E1 | Finalization section explicitly states it runs only after all gates PASS | `src/commands/merge-ready.md` exists | Read the finalization section; search for "all gates" or "PASS" or "after all" | The section text explicitly conditions its execution on all quality gates reporting PASS |
| 2.1.3 | UC-1 Primary Flow step 2 | Finalization section is NOT a numbered quality gate | `src/commands/merge-ready.md` exists | Read the file structure; verify the finalization section does not appear as a numbered gate in the gate pass/fail table or the auto-fix protocol loop | The section is labeled as a non-gate finalization step; it does not appear in the gate PASS/FAIL table |
| 2.1.4 | UC-1 Primary Flow step 2 | Finalization section is excluded from the auto-fix rerun loop | `src/commands/merge-ready.md` exists | Read the auto-fix protocol / gate loop section; confirm the changelog finalization step is not listed as a gate subject to rerun | The finalization section cannot be re-triggered by the auto-fix loop |

### 2.2 Finalization Step Content

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | UC-E3 Primary Flow | Finalization section contains `date -u` literally | `src/commands/merge-ready.md` exists | Grep for `date -u` within the finalization section | The literal string `date -u` appears in the finalization section |
| 2.2.2 | UC-1 Primary Flow step 10 | Finalization section delegates to `doc-updater` | `src/commands/merge-ready.md` exists | Grep for "doc-updater" in the finalization section | The section instructs delegating the file write to the `doc-updater` agent |
| 2.2.3 | UC-1 Primary Flow step 10 | Finalization section references `src/rules/changelog.md` as format authority | `src/commands/merge-ready.md` exists | Grep for "changelog.md" or "changelog rule" in the finalization section | The section explicitly references `src/rules/changelog.md` (or the installed rule) as the format authority |
| 2.2.4 | UC-E1 Primary Flow | Finalization section references the idempotency guard | `src/commands/merge-ready.md` exists | Grep for "idempotent" or "duplicate" or "guard" in the finalization section | The section mentions the idempotency guard (check for existing entry before writing) |

---

## 3. Standalone Implement-Slice Changelog Step

### 3.1 Step Existence and Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | UC-2 Primary Flow step 2 | `src/commands/implement-slice.md` contains a changelog step | `src/commands/implement-slice.md` exists | Grep for "changelog" or "Changelog" in the file | A changelog step is present in the file |
| 3.1.2 | UC-2 Primary Flow step 2 | Changelog step appears after the commit step | `src/commands/implement-slice.md` exists | Read the file; verify the changelog step appears after the commit step and before the scratchpad update step | The changelog step is ordered: commit → changelog → scratchpad |
| 3.1.3 | UC-2-E2, UC-E2 Primary Flow | Changelog step explicitly states the parallel-wave subagent skip condition | `src/commands/implement-slice.md` exists | Read the changelog step; grep for "parallel" or "wave" or "subagent" in the section | The step states: skip if running as a parallel-wave subagent |
| 3.1.4 | UC-2-E1, UC-E2 Primary Flow | Changelog step explicitly states the `no-changelog` suppression flag skip condition | `src/commands/implement-slice.md` exists | Read the changelog step; grep for "no-changelog" or "suppression" or "develop-feature" in the section | The step states: skip if the `no-changelog` suppression flag was passed (i.e., driven by `/develop-feature`) |
| 3.1.5 | UC-2 Primary Flow step 3 | BOTH skip conditions appear in the same step | `src/commands/implement-slice.md` exists | Read the changelog step section; confirm both skip conditions (parallel-wave AND no-changelog/develop-feature) are documented | Both conditions are present in the step, not just one |

### 3.2 Changelog Step Content

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.2.1 | UC-E3 Primary Flow | Changelog step contains `date -u` literally | `src/commands/implement-slice.md` exists | Grep for `date -u` in the file | The literal string `date -u` appears in the changelog step |
| 3.2.2 | UC-E1 Primary Flow | Changelog step references the idempotency guard | `src/commands/implement-slice.md` exists | Grep for "idempotent" or "duplicate" or "guard" or "existing entry" in the changelog step | The step mentions the idempotency guard (check for existing same-name entry before writing) |
| 3.2.3 | UC-2 Primary Flow step 9 | Changelog step references `src/rules/changelog.md` or the installed changelog rule | `src/commands/implement-slice.md` exists | Grep for "changelog.md" or "changelog rule" in the changelog step | The step references the changelog rule file as the format authority |

---

## 4. Develop-Feature Suppression Flag

### 4.1 Phase 2 Spawn Prompt Coverage

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | UC-E2 Primary Flow, UC-6 Primary Flow | `src/commands/develop-feature.md` contains `no-changelog` in Phase 2 | `src/commands/develop-feature.md` exists | Grep for "no-changelog" in the file | The literal string `no-changelog` appears at least once in the file |
| 4.1.2 | UC-E2 Primary Flow | Phase 2 spawn prompt for parallel-wave subagents contains `no-changelog` | `src/commands/develop-feature.md` exists | Read the Phase 2 parallel-wave subagent spawn prompt section; verify `no-changelog` or suppression flag instruction is present | The parallel-wave subagent spawn prompt explicitly passes or references the `no-changelog` suppression flag |
| 4.1.3 | UC-E2-EC1, UC-6 Primary Flow | Single-slice-wave direct path also contains `no-changelog` | `src/commands/develop-feature.md` exists | Read the single-slice-wave direct execution path in Phase 2; verify `no-changelog` is present | The single-slice-wave direct path also includes the `no-changelog` suppression flag instruction |
| 4.1.4 | UC-1-A2, UC-6 Primary Flow | Phase 3 (or merge-ready delegation point) notes merge-ready writes the entry | `src/commands/develop-feature.md` exists | Read the Phase 3 / merge-ready delegation section; grep for "changelog" in that section | The text states that the single changelog entry for the feature is written by merge-ready, not by any slice |

---

## 5. Doc-Updater Changelog Responsibility

### 5.1 Responsibilities and Constraint Update

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | UC-1 Primary Flow step 10 | `src/agents/doc-updater.md` lists `CHANGELOG.md` in responsibilities | `src/agents/doc-updater.md` exists | Grep for "CHANGELOG" or "changelog" in the file | The file names `CHANGELOG.md` as a file the agent is responsible for maintaining |
| 5.1.2 | UC-1 Primary Flow step 10 | `doc-updater.md` exempts `CHANGELOG.md` from the "do not create new files" constraint | `src/agents/doc-updater.md` exists | Read the constraint about not creating new documentation files; verify `CHANGELOG.md` is explicitly exempted | The constraint text explicitly states that `CHANGELOG.md` is an exception — the agent MAY create or append to it as part of normal responsibilities |
| 5.1.3 | UC-1 Primary Flow step 10 | `doc-updater.md` references `src/rules/changelog.md` as format authority | `src/agents/doc-updater.md` exists | Grep for "changelog.md" or "changelog rule" in the file | The file references `src/rules/changelog.md` (or its installed path) |

---

## 6. Global Workflow Documentation (`src/claude.md`)

### 6.1 Three Changelog References Required

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.1.1 | UC-1 Primary Flow, UC-2 Primary Flow | `src/claude.md` contains at least 3 changelog references total | `src/claude.md` exists | Run `grep -ic "changelog" src/claude.md` | Count is 3 or greater |
| 6.1.2 | UC-1 Primary Flow step 10 | The `doc-updater` row in the Agency Roles table in `src/claude.md` mentions changelog | `src/claude.md` exists | Read the Agency Roles table; find the `doc-updater` row's Responsibility column | The `doc-updater` responsibility description includes changelog maintenance |
| 6.1.3 | UC-1 Primary Flow | Phase 4 quality-gates description in `src/claude.md` references the changelog finalization step | `src/claude.md` exists | Read the Phase 4 description section | The Phase 4 description includes a reference to the changelog finalization step (e.g., "changelog entry written") |
| 6.1.4 | UC-1 Primary Flow step 11, UC-2 Primary Flow step 10 | Deliverables checklist in `src/claude.md` includes a `CHANGELOG.md entry` item | `src/claude.md` exists | Read the deliverables checklist (the "What Every Plan MUST Include" or `/bootstrap-feature` checklist section) | The checklist contains a `CHANGELOG.md entry` item or equivalent |

---

## 7. Template and Scaffold

### 7.1 Template File

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.1.1 | UC-7-A1 | `templates/CHANGELOG.md` exists on disk | Implementation complete | Glob for `templates/CHANGELOG.md` | File exists and is non-empty |
| 7.1.2 | UC-7-A1, UC-7 Primary Flow | `templates/CHANGELOG.md` starts with `# Changelog` | `templates/CHANGELOG.md` exists | Read the first line of the file | The first line is `# Changelog` |
| 7.1.3 | UC-7-A1 | `templates/CHANGELOG.md` contains no actual entries (scaffold only) | `templates/CHANGELOG.md` exists | Read the full file; confirm no `## YYYY-MM-DD` or `###` entry headings are present | The file contains only the header block (no day headings, no entry headings, no pre-populated content) |

### 7.2 Install Script Integration

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.2.1 | UC-7-A1 | `install.sh` contains the literal `cp "$SCRIPT_DIR/templates/CHANGELOG.md"` line inside `scaffold_project()` | `install.sh` exists | Grep for `cp "$SCRIPT_DIR/templates/CHANGELOG.md"` in `install.sh` | The exact string `cp "$SCRIPT_DIR/templates/CHANGELOG.md"` appears in the file, inside the `scaffold_project()` function |
| 7.2.2 | UC-7-A1 | `bash -n install.sh` passes (syntax check) | `install.sh` exists | Run `bash -n install.sh` | Exit code is 0 (no syntax errors) |
| 7.2.3 | UC-7-A1 | `install.sh` `--help` text or scaffold output mentions `CHANGELOG.md` | `install.sh` exists | Grep for "CHANGELOG" in `install.sh` | At least one occurrence of `CHANGELOG` (case-sensitive) appears in the help or scaffold output text |
| 7.2.4 | UC-7-A1 | Stale "4 rules" count in `install.sh` is updated to 5 to reflect addition of `changelog.md` | `install.sh` exists | Grep for "4 rules" or "4 rule" in `install.sh`; and grep for "5 rules" or "5 rule" | No occurrence of "4 rules" (as a rule count) remains; "5 rules" (or equivalent count including changelog.md) appears |

---

## 8. README Documentation

### 8.1 Changelog Behavior Documented

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.1.1 | UC-1 Primary Flow, UC-2 Primary Flow | `README.md` contains a section or paragraph describing changelog behavior | `README.md` exists | Grep for "changelog" or "Changelog" or "CHANGELOG" in `README.md` | At least one occurrence exists |
| 8.1.2 | UC-1 Primary Flow step 6 | `README.md` names all four entry fields | `README.md` exists | Read the changelog section; verify "Name", "Summary", "Details", and "UTC" (or "time") all appear in proximity | All four field names (or their conceptual equivalents) are described in the changelog documentation |
| 8.1.3 | UC-1 Primary Flow, UC-2 Primary Flow | `README.md` identifies both trigger points | `README.md` exists | Read the changelog section; grep for "merge-ready" and "implement-slice" in `README.md` | Both trigger points are named: merge-ready (after gates PASS) and standalone implement-slice (for standalone fixes) |

---

## 9. Behavioral Smoke Tests (Manual Verification)

### 9.1 Real Timestamp and Entry Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.1.1 | UC-E3 Primary Flow | Running `date -u` via Bash returns a real UTC timestamp in `YYYY-MM-DD HH:MM` format | Bash shell available | Execute `date -u +'%Y-%m-%d %H:%M'` in a terminal | Output is a string matching the pattern `YYYY-MM-DD HH:MM` where the date reflects the real UTC clock, not an invented value |
| 9.1.2 | UC-1 Primary Flow step 6 | A manually constructed entry from the rule matches the format: `### <name> — HH:MM UTC` header, `**Summary:**` line, `**Details:**` line | `src/rules/changelog.md` exists | Read the rule and construct a sample entry following its spec | The resulting entry structure has the three-component `###` heading and the two bold-field lines as specified |
| 9.1.3 | UC-4 Primary Flow | Writing to a project with no prior day heading creates a new `## YYYY-MM-DD` heading above any older headings | A scratch `CHANGELOG.md` with an older day heading (e.g., `## 2025-01-01`) | Follow the writer procedure from the rule; apply to the file | A new `## <today's date>` heading appears between the `# Changelog` header block and the older `## 2025-01-01` heading |
| 9.1.4 | UC-3 Primary Flow | Writing to a project where today's day heading already exists prepends the entry inside that heading | A scratch `CHANGELOG.md` with today's day heading already containing one entry | Follow the writer procedure; apply a second entry | The new entry appears as the first item under today's day heading; the prior entry is shifted down |
| 9.1.5 | UC-5 Primary Flow | After two writes on the same day, the newer entry appears first under today's heading | A scratch `CHANGELOG.md` after two writes with different names | Read the file | The second-written (later-timestamped) entry is the first entry under today's heading; the first-written entry is second |

### 9.2 Details Cap and Idempotency

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.2.1 | UC-E4 Primary Flow | A Details text of 501 characters is trimmed to exactly 500 characters before being written | A 501-character Details string | Apply the rule's trim step to the string | The resulting Details is exactly 500 characters; no error is raised |
| 9.2.2 | UC-E4-A1 | A Details text of exactly 500 characters is written unchanged | A 500-character Details string | Apply the rule's trim step to the string | The resulting Details is 500 characters; no trimming occurs |
| 9.2.3 | UC-E1 Primary Flow | Running the writer twice with the same feature name on the same day updates rather than duplicates the entry | A scratch `CHANGELOG.md` with one entry for "Feature X" under today's heading | Follow the writer procedure again for "Feature X" on the same day | After the second write, exactly one entry for "Feature X" exists under today's heading; the entry reflects the most recent timestamp, Summary, and Details |
| 9.2.4 | UC-E1-A1 | An entry with the same name from a prior day does NOT trigger the idempotency guard | A scratch `CHANGELOG.md` with "Feature X" under yesterday's heading | Follow the writer procedure for "Feature X" on today's date | A new entry for "Feature X" is written under today's heading; the prior-day entry is untouched; two entries for "Feature X" exist across different day headings |

### 9.3 Error and Suppression Behaviors

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.3.1 | UC-1-E1 | When quality gates report FAIL, the finalization section does NOT execute | Review the merge-ready finalization section text | Read the finalization section's condition statement | The section's condition is conditional on all gates PASS — no execution when any gate FAILS |
| 9.3.2 | UC-E3-E1 | The rule and all write-path instructions prohibit inventing a timestamp | `src/rules/changelog.md`, `src/commands/merge-ready.md`, `src/commands/implement-slice.md` | Grep for "never" or "MUST NOT" or "do not invent" or "forbid" near timestamp language in each file | Each write-path file contains explicit prohibition on inventing or estimating the timestamp |
| 9.3.3 | UC-E2-EC2 | The implement-slice changelog step recognises the `no-changelog` flag to suppress writing | `src/commands/implement-slice.md` | Read the changelog step; confirm the instruction explicitly evaluates the flag before proceeding | The instruction checks for the `no-changelog` flag and performs a no-op when it is present |

---

## 10. Cross-Cutting Concerns

### 10.1 Cross-Reference Integrity

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.1.1 | AC-9 | Every write-path instruction that mentions "changelog" also contains `date -u` or references the rule that mandates it | All modified files | Grep all modified files for "changelog" (write-path occurrences); for each, verify `date -u` is also present in that section or the section references `src/rules/changelog.md` | No write-path changelog instruction is missing the `date -u` requirement or a rule reference that carries it |
| 10.1.2 | AC-5 | `src/agents/doc-updater.md` is the only agent referenced in the merge-ready finalization step for writing changelog entries | `src/commands/merge-ready.md` exists | Read the finalization section and identify which agent is delegated the write task | The finalization section delegates to `doc-updater` and no other agent |
| 10.1.3 | NFR-5 | No new agent file is introduced by this feature; total agent count remains 13 | Implementation complete | Glob for `src/agents/*.md` and count results | Exactly 13 files exist (no new agent added) |
| 10.1.4 | NFR-3 | `install.sh` glob pattern for `src/rules/*.md` automatically includes `src/rules/changelog.md` | `install.sh` exists | Read the rule-file copy section of `install.sh`; confirm it uses a glob pattern covering `src/rules/*.md` | The script uses a glob pattern (not an explicit file list) for rules; `changelog.md` is picked up automatically without adding it to a manifest |

### 10.2 Backward Compatibility

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.2.1 | NFR-3 | All existing command files remain present (no commands removed) | Implementation complete | Glob for `src/commands/*.md` | All pre-existing command files still exist at their original paths |
| 10.2.2 | NFR-3 | All existing rule files remain present (no rules removed) | Implementation complete | Glob for `src/rules/*.md` | All pre-existing rule files still exist; `src/rules/changelog.md` is a new addition |
| 10.2.3 | NFR-3 | All existing agent files remain present (no agents removed or renamed) | Implementation complete | Glob for `src/agents/*.md` | All 13 agent files still exist; no agent was removed or renamed |
| 10.2.4 | UC-2-A2 | The changelog step in `implement-slice.md` is gated on a successful commit — if the commit does not happen, neither does the changelog write | `src/commands/implement-slice.md` exists | Read the changelog step's position and condition in the file | The changelog step appears after the commit step and is not reached if the commit step fails or is skipped |

---

## Use Case to Test Case Traceability Matrix

| Use Case | Test Cases |
|----------|------------|
| UC-1 Primary Flow | 1.1.8, 1.2.1, 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.2.1, 2.2.2, 2.2.3, 2.2.4, 5.1.1, 6.1.1, 6.1.2, 6.1.3, 6.1.4, 8.1.1, 8.1.2, 8.1.3, 9.1.2 |
| UC-1-A1 (CHANGELOG.md already exists) | 7.1.1, 7.1.2, 9.1.4 |
| UC-1-A2 (Full develop-feature pipeline) | 4.1.4, 9.3.1 |
| UC-1-E1 (Gates FAIL — no finalization) | 2.1.2, 9.3.1 |
| UC-1-E2 (date -u unavailable) | 1.1.2, 1.2.1, 9.3.2 |
| UC-1-EC1 (doc-updater error — warning not gate) | 2.2.2, 10.1.2 |
| UC-1-EC2 (Feature name with special markdown) | 9.1.2 |
| UC-1-EC3 (Details > 500 chars — trim) | 1.1.6, 1.2.4, 9.2.1 |
| UC-2 Primary Flow | 1.1.8, 3.1.1, 3.1.2, 3.1.5, 3.2.1, 3.2.2, 3.2.3, 6.1.1, 8.1.1, 8.1.3, 10.2.4 |
| UC-2-A1 (Same day, existing entries) | 9.1.4, 9.1.5 |
| UC-2-A2 (Verify fails, commit not made) | 10.2.4 |
| UC-2-E1 (no-changelog flag present) | 3.1.4, 3.1.5, 9.3.3 |
| UC-2-E2 (Parallel-wave subagent) | 3.1.3, 3.1.5, 1.1.10 |
| UC-2-EC1 (Standalone then merge-ready idempotency) | 1.1.7, 1.2.5, 9.2.3 |
| UC-2-EC2 (Session interrupted before changelog step) | 9.2.3 |
| UC-3 Primary Flow | 1.1.4, 1.1.5, 1.2.3, 9.1.4, 9.1.5 |
| UC-3-A1 (Day heading exists, no entries yet) | 9.1.4 |
| UC-3-E1 (Write conflict) | 9.3.2 |
| UC-3-EC1 (Second write same day) | 9.1.4, 9.1.5 |
| UC-3-EC2 (Non-zero-padded existing heading) | 1.2.3, 9.1.3 |
| UC-4 Primary Flow | 1.1.4, 1.1.5, 1.2.3, 9.1.3 |
| UC-4-A1 (Empty CHANGELOG.md) | 7.1.3, 9.1.3 |
| UC-4-A2 (Multiple prior day headings) | 9.1.3 |
| UC-4-E1 (Missing # Changelog header) | 1.2.2 |
| UC-4-EC1 (Commit just before midnight) | 1.2.1, 9.1.1 |
| UC-4-EC2 (Parallel create — prevented by suppression) | 1.1.9, 1.1.10 |
| UC-E1 Primary Flow (Idempotency guard fires) | 1.1.7, 1.2.5, 2.2.4, 3.2.2, 9.2.3 |
| UC-E1-A1 (Same name, different day — guard does not fire) | 9.2.4 |
| UC-E1-E1 (Malformed CHANGELOG.md) | 1.2.2, 1.2.3 |
| UC-E1-EC1 (Merge-ready after standalone, same name same day) | 9.2.3 |
| UC-E1-EC2 (Feature renamed between writes) | 9.2.4 |
| UC-E1-EC3 (Case-insensitive name comparison) | 1.1.7 |
| UC-E2 Primary Flow (Suppression active — no-op) | 1.1.8, 1.1.9, 3.1.4, 3.1.5, 9.3.3 |
| UC-E2-A1 (Parallel-wave subagent skip) | 1.1.10, 3.1.3, 3.1.5 |
| UC-E2-E1 (Suppression flag missing — idempotency saves) | 1.1.7, 9.2.3 |
| UC-E2-EC1 (Single-slice-wave missing flag) | 4.1.3 |
| UC-E2-EC2 (implement-slice missing skip logic) | 3.1.3, 3.1.4, 3.1.5 |
| UC-E3 Primary Flow (Real timestamp via shell) | 1.1.2, 1.2.1, 2.2.1, 3.2.1, 9.1.1 |
| UC-E3-E1 (date -u unavailable) | 9.3.2 |
| UC-E3-E2 (Agent invents timestamp — defect) | 1.1.2, 10.1.1, 9.3.2 |
| UC-E3-EC1 (Non-UTC local timezone) | 9.1.1 |
| UC-E3-EC2 (Timestamp at midnight boundary) | 1.2.1, 9.1.1 |
| UC-E4 Primary Flow (Details trimmed at 500) | 1.1.6, 1.2.4, 9.2.1 |
| UC-E4-A1 (Exactly 500 chars — no trim) | 9.2.2 |
| UC-E4-A2 (Under 500 chars — no action) | 9.2.2 |
| UC-E4-E1 (Empty or non-technical Summary) | 9.1.2 |
| UC-E4-EC1 (Trim cuts mid-word) | 1.1.6, 9.2.1 |
| UC-E4-EC2 (Multi-byte Unicode in Details) | 1.1.6 |
| UC-5 Primary Flow (Two entries same day) | 9.1.4, 9.1.5 |
| UC-5-EC1 (Same-minute timestamps) | 9.1.5 |
| UC-5-EC2 (N entries same day) | 9.1.5 |
| UC-6 Primary Flow (Full develop-feature — exactly one entry) | 1.1.8, 1.1.9, 4.1.1, 4.1.2, 4.1.3, 4.1.4 |
| UC-6-EC1 (8 slices, 1 entry) | 4.1.1, 4.1.2, 4.1.3 |
| UC-6-EC2 (Aborted pipeline — no entry) | 4.1.4, 2.1.2 |
| UC-7 Primary Flow (CHANGELOG.md created on first write) | 1.2.2, 7.1.1, 7.1.2, 7.1.3 |
| UC-7-A1 (Scaffolded with --init-project) | 7.1.1, 7.1.2, 7.1.3, 7.2.1 |
| UC-7-EC1 (File system error on create) | 9.3.2 |
| AC-1 (changelog rule file completeness) | 1.1.1 through 1.2.5 |
| AC-2 (merge-ready finalization section) | 2.1.1 through 2.2.4 |
| AC-3 (implement-slice changelog step) | 3.1.1 through 3.2.3 |
| AC-4 (develop-feature suppression flag) | 4.1.1 through 4.1.4 |
| AC-5 (doc-updater responsibility) | 5.1.1 through 5.1.3 |
| AC-6 (claude.md 3+ changelog refs) | 6.1.1 through 6.1.4 |
| AC-7 (templates/CHANGELOG.md + install.sh) | 7.1.1 through 7.2.4 |
| AC-8 (README four fields + two triggers) | 8.1.1 through 8.1.3 |
| AC-9 (date -u in every write path) | 10.1.1 |
| AC-10 (end-to-end smoke test) | 9.1.1 through 9.3.3 |
| NFR-2 (timestamps never hallucinated) | 1.1.2, 1.2.1, 2.2.1, 3.2.1, 9.3.2, 10.1.1 |
| NFR-3 (backward compatible) | 10.2.1 through 10.2.4 |
| NFR-4 (exactly one entry per unit) | 1.1.7, 1.1.8, 1.1.9, 9.2.3 |
| NFR-5 (no new agents) | 10.1.3 |
