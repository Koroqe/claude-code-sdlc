# Test Cases: Self-Improvement Loop — Cross-Session Lesson Capture

> Based on [PRD](../PRD.md) — Section 4 and [Use Cases](../use-cases/self-improvement-loop_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files. "Testing" means verifying file existence, structural correctness, and content presence by reading files and using grep to check for required text patterns.

---

## 1. Lessons Rule File (FR-1)

### 1.1 File Existence and Required Sections

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | UC-4.4 (Pre-flight), UC-4.6 (Session Start) | `src/rules/lessons.md` exists | None | `test -f src/rules/lessons.md` | File exists at this path (per FR-1, AC-1) |
| 1.1.2 | UC-4.6 (Primary Flow) | `src/rules/lessons.md` contains a MUST Read protocol section | `src/rules/lessons.md` exists | Grep for "MUST Read" in `src/rules/lessons.md` | A "MUST Read" section exists instructing agents to read `.claude/lessons.md` at session start (per FR-1.1) |
| 1.1.3 | UC-4.1 (Primary Flow), UC-4.2, UC-4.3 | File defines all three capture triggers | `src/rules/lessons.md` exists | Grep for "Trigger 1", "Trigger 2", and "Trigger 3" in `src/rules/lessons.md` | All three trigger labels appear in the file: Trigger 1 (User Correction), Trigger 2 (Repeated Error), Trigger 3 (Gate Failure) (per FR-1.2, FR-1.3, FR-1.4) |
| 1.1.4 | UC-4.1 (Primary Flow, Step 6) | File defines the lesson entry format | `src/rules/lessons.md` exists | Grep for "YYYY-MM-DD" and "ALWAYS\|NEVER\|WHEN" in `src/rules/lessons.md` | The file includes the required lesson entry format: date in `YYYY-MM-DD` format and "what to do instead" using ALWAYS/NEVER/WHEN phrasing (per FR-1.5) |
| 1.1.5 | UC-4.9 (Primary Flow) | File defines prevention rule elevation thresholds | `src/rules/lessons.md` exists | Grep for "elevation" or "elevate" in `src/rules/lessons.md` | The file specifies elevation thresholds: 2 occurrences for security/data-integrity, 3 occurrences for general patterns (per FR-1.6) |
| 1.1.6 | UC-4.10 (Primary Flow) | File defines prevention rule retirement mechanism | `src/rules/lessons.md` exists | Grep for "retirement" or "retire" or "archived" in `src/rules/lessons.md` | The file defines the retirement conditions: 10 consecutive features without confirmation, or the referenced file or pattern no longer exists (per FR-1.7) |
| 1.1.7 | UC-4.4 (Data Requirements), UC-4.6 (Primary Flow) | File defines context budget constraints | `src/rules/lessons.md` exists | Grep for "context budget" or "5 most recent" in `src/rules/lessons.md` | The file specifies that only the `## Prevention Rules` section (always) and the 5 most recent Lessons Log entries (selectively) are read; the full file is not loaded into context during normal operation (per FR-1.8) |
| 1.1.8 | UC-4.8-P1 (Primary Flow) | File defines the parallel subagent skip rule | `src/rules/lessons.md` exists | Grep for "subagent" and "skip\|not write\|do not write" in `src/rules/lessons.md` | The file explicitly states that subagents executing slices in a parallel wave MUST NOT write to `.claude/lessons.md`; only the orchestrator writes (per FR-1.9) |
| 1.1.9 | UC-4.1-EC3, UC-4.3-EC3 | File defines the 50-entry consolidation trigger | `src/rules/lessons.md` exists | Grep for "50" and "consolidat" in `src/rules/lessons.md` | The file states that when `## Lessons Log` exceeds 50 entries, the agent must consolidate redundant lessons before adding a new entry (per FR-1.10) |

### 1.2 Trigger 1 — User Correction Detection Heuristics

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.2.1 | UC-4.1 (Primary Flow, Step 3a) | Trigger 1 includes explicit rejection language heuristic | `src/rules/lessons.md` exists | Grep for "that's wrong\|revert that\|undo that\|no, you should" in `src/rules/lessons.md` | The file lists concrete rejection phrases as heuristics for Trigger 1 detection (per FR-1.2a) |
| 1.2.2 | UC-4.1 (Primary Flow, Step 3b) | Trigger 1 includes replacement code heuristic | `src/rules/lessons.md` exists | Grep for "replacement code\|code block\|alternative approach" in `src/rules/lessons.md` | The file specifies that a user providing replacement code directly in a message triggers Trigger 1 (per FR-1.2b) |
| 1.2.3 | UC-4.1 (Primary Flow, Step 3c) | Trigger 1 includes revert request heuristic | `src/rules/lessons.md` exists | Grep for "revert\|go back\|prior state" in `src/rules/lessons.md` | The file specifies that a user referencing a prior state or asking to go back triggers Trigger 1 (per FR-1.2c) |
| 1.2.4 | UC-4.1-E1 (Ambiguous correction) | Trigger 1 heuristics are concrete enough to prevent false positives | `src/rules/lessons.md` exists | Read the Trigger 1 section | The heuristics require an explicit signal (rejection language, replacement code, or revert request); vague or exploratory messages are not flagged as corrections |

### 1.3 Trigger 2 — Repeated Error Pattern Threshold

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.3.1 | UC-4.2 (Primary Flow, Steps 2-4) | Trigger 2 specifies the 2-or-more threshold | `src/rules/lessons.md` exists | Grep for "2 or more\|two or more\|same.*category.*2\+" in `src/rules/lessons.md` | The file states the Trigger 2 threshold: same deviation rule category firing 2 or more times within a single feature (per FR-1.3) |
| 1.3.2 | UC-4.2 (Primary Flow, Step 3) | Trigger 2 references deviation rule categories (Rule 1-4) | `src/rules/lessons.md` exists | Grep for "Rule 1\|Rule 2\|Rule 3\|Rule 4\|deviation rule category" in `src/rules/lessons.md` | The file identifies the tracking unit as deviation rule categories (Rule 1, 2, 3, or 4) from Section 1 FR-2 (per FR-1.3) |
| 1.3.3 | UC-4.2-EC1 (One lesson per pattern) | Trigger 2 fires at second occurrence but not for each subsequent occurrence | `src/rules/lessons.md` exists | Read the Trigger 2 section | The section implies a lesson is written when the threshold is first met (second occurrence), not again for each additional occurrence of the same category within the same feature |

---

## 2. Template and Install Script (FR-2)

### 2.1 Template File Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | UC-4.1-A-EC1 (Backward compatibility) | `templates/lessons.md` exists | None | `test -f templates/lessons.md` | File exists at this path (per FR-2.1, AC-2) |
| 2.1.2 | UC-4.4-A2 (Empty Prevention Rules) | `templates/lessons.md` has an empty `## Prevention Rules` section | `templates/lessons.md` exists | Grep for "## Prevention Rules" in `templates/lessons.md` | The section header exists with placeholder text only — no actual prevention rules pre-populated (per FR-2.1) |
| 2.1.3 | UC-4.2 (Primary Flow) | `templates/lessons.md` has an empty `## Lessons Log` section | `templates/lessons.md` exists | Grep for "## Lessons Log" in `templates/lessons.md` | The section header exists with placeholder text only — no actual lesson entries pre-populated (per FR-2.1) |
| 2.1.4 | UC-4.10 (Primary Flow) | `templates/lessons.md` structure anticipates `## Archived Rules` section | `templates/lessons.md` exists | Read `templates/lessons.md` in full | The template contains `## Prevention Rules`, `## Lessons Log`, and optionally an `## Archived Rules` section or placeholder. No entries are pre-populated in any section (per FR-2.1, AC-2) |

### 2.2 Install Script Provisioning

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | UC-4.1 (Preconditions — file exists) | `install.sh` copies `templates/lessons.md` during `--init-project` | `install.sh` exists | Grep for "lessons.md" in `install.sh` | The script contains a copy command for `lessons.md` in the `--init-project` block (per FR-2.2, AC-3) |
| 2.2.2 | UC-4.1-A-EC1 (Mid-feature provisioning) | `install.sh` skips the copy if `.claude/lessons.md` already exists | `install.sh` exists | Read the `lessons.md` copy block in `install.sh` | The copy command is conditioned on the target file not already existing (e.g., uses `if [ ! -f ]` guard or `cp -n`); existing project lessons are not overwritten (per FR-2.2, AC-3) |
| 2.2.3 | UC-4.6 (Session Start) | `install.sh` help text mentions `.claude/lessons.md` alongside `.claude/scratchpad.md` | `install.sh` exists | Grep for "lessons.md" in the `--help` output block of `install.sh` | The help text lists `.claude/lessons.md` as a project-local file provisioned by `--init-project` alongside `.claude/scratchpad.md` (per FR-2.5, AC-3) |
| 2.2.4 | UC-4.6 (All references) | `install.sh` install banner reports 5 rule files | `install.sh` exists | Grep for "5.*file\|5.*rule\|rule.*5" in `install.sh` | The install banner or process rules display mentions "5 files" or "5 rules" (updated from the previous count of 4) (per FR-2.4, AC-3) |

### 2.3 Settings.json Permissions

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.3.1 | UC-4.1-E2 (Write fails) | `templates/settings.json` grants Edit permission for `.claude/lessons.md` | `templates/settings.json` exists | Grep for "lessons.md" in `templates/settings.json` | The file includes `.claude/lessons.md` in the permissions list with Edit and Write permissions granted (per FR-2.3, AC-4) |

---

## 3. Session-Start Reading (FR-3)

### 3.1 Scratchpad MUST Read Update

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | UC-4.6 (Primary Flow, Step 2) | `src/rules/scratchpad.md` MUST Read section references lessons.md | `src/rules/scratchpad.md` exists | Grep for "lessons.md" in `src/rules/scratchpad.md` | The `## MUST Read` section contains a bullet instructing agents to read `.claude/lessons.md` Prevention Rules at session start (per FR-3.1, AC-5) |
| 3.1.2 | UC-4.6-A2 (File absent) | The lessons.md MUST Read bullet includes an existence guard | `src/rules/scratchpad.md` exists | Read the MUST Read section in `src/rules/scratchpad.md` | The bullet includes "if it exists" or "if the file exists" so the instruction is skipped when the file is absent (per FR-3.1, NFR-2) |
| 3.1.3 | UC-4.6 (Primary Flow, Step 2) | Lessons MUST Read bullet appears immediately after the scratchpad reading bullet | `src/rules/scratchpad.md` exists | Read the MUST Read section in sequence | The lessons bullet is the second item in the MUST Read section, immediately following the bullet that instructs reading `.claude/scratchpad.md` (per FR-3.2) |

---

## 4. Implement-Slice Integration (FR-4)

### 4.1 Pre-flight Check #5

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | UC-4.4 (Primary Flow, Step 2) | `src/commands/implement-slice.md` pre-flight checklist has item #5 for Prevention Rules | `src/commands/implement-slice.md` exists | Grep for "Prevention Rules" and "pre-flight\|preflight\|checklist" in `src/commands/implement-slice.md` | Pre-flight check #5 exists and instructs reading the `## Prevention Rules` section of `.claude/lessons.md` if the file exists (per FR-4.1, AC-6) |
| 4.1.2 | UC-4.4-A3 (File absent) | Pre-flight check #5 includes an existence guard | `src/commands/implement-slice.md` exists | Read the pre-flight check #5 text | The check includes "if `.claude/lessons.md` exists" or equivalent so that absent files are silently skipped (per FR-4.1, NFR-2) |
| 4.1.3 | UC-4.4 (Data Requirements) | Pre-flight check #5 reads only the Prevention Rules section, not the full Lessons Log | `src/commands/implement-slice.md` exists | Read the pre-flight check #5 text | The instruction limits the read to the `## Prevention Rules` section; it does not instruct reading the full Lessons Log (per FR-1.8, FR-4.1) |

### 4.2 Step 6 — Capture Lessons

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.2.1 | UC-4.1 (Primary Flow, Step 6), UC-4.2 (Primary Flow, Step 6) | `src/commands/implement-slice.md` contains Step 6 — Capture Lessons | `src/commands/implement-slice.md` exists | Grep for "Step 6\|Capture Lessons" in `src/commands/implement-slice.md` | A step labeled "Step 6" or "Capture Lessons" exists in the post-commit section (per FR-4.2, AC-6) |
| 4.2.2 | UC-4.1 (Primary Flow, Step 6) | Step 6 references Trigger 1 check | `src/commands/implement-slice.md` exists | Read Step 6 in `src/commands/implement-slice.md` | Step 6 instructs checking whether the user corrected the agent during this slice (Trigger 1 check) (per FR-4.2) |
| 4.2.3 | UC-4.2 (Primary Flow, Step 6) | Step 6 references Trigger 2 check | `src/commands/implement-slice.md` exists | Read Step 6 in `src/commands/implement-slice.md` | Step 6 instructs checking whether the same deviation rule category has fired 2+ times across this feature (Trigger 2 check) (per FR-4.2) |

### 4.3 Step 7 Renumbering

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.3.1 | UC-4.1 (Primary Flow, Step 9) | The scratchpad update step is numbered Step 7 (not Step 6) | `src/commands/implement-slice.md` exists | Grep for "Step 7\|scratchpad" in `src/commands/implement-slice.md` | The scratchpad update step appears as Step 7 in the post-commit sequence, correctly following the new Step 6 — Capture Lessons (per FR-4.3, AC-6) |

### 4.4 Parallel Subagent Skip

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.4.1 | UC-4.8-P1 (Primary Flow, Steps 5-6) | Steps 6 and 7 are both skipped when running as a parallel subagent | `src/commands/implement-slice.md` exists | Grep for "parallel\|subagent\|skip.*6\|skip.*7\|wave context" in `src/commands/implement-slice.md` | The file states that when wave context is present (running as a parallel subagent), both Step 6 (Capture Lessons) and Step 7 (scratchpad update) are skipped; the orchestrator handles both (per FR-4.4, AC-6) |
| 4.4.2 | UC-4.8-P1-A1 (Subagent Trigger 1) | The parallel subagent skip note covers both steps together | `src/commands/implement-slice.md` exists | Read the parallel skip instruction in `src/commands/implement-slice.md` | A single instruction or note covers both Steps 6 and 7 as jointly skipped in parallel mode, consistent with the pattern established for scratchpad writes (per FR-4.4) |

---

## 5. Merge-Ready Integration (FR-5)

### 5.1 Post-Gate Lesson Capture Section

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | UC-4.3 (Primary Flow, Step 4) | `src/commands/merge-ready.md` contains a "Post-Gate Lesson Capture" section | `src/commands/merge-ready.md` exists | Grep for "Post-Gate Lesson Capture\|post.gate.*lesson" in `src/commands/merge-ready.md` | A section named "Post-Gate Lesson Capture" (or equivalent) exists in `merge-ready.md` (per FR-5.1, AC-7) |
| 5.1.2 | UC-4.3 (Primary Flow, Step 4) | Post-Gate Lesson Capture fires after all gates complete regardless of outcome | `src/commands/merge-ready.md` exists | Read the Post-Gate Lesson Capture section | The section is positioned after all gate executions and is stated to apply regardless of the overall MERGE READY / NOT MERGE READY verdict (per FR-5.1) |

### 5.2 MERGE READY Path (Auto-fix Lessons)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.2.1 | UC-4.3 (Primary Flow, Steps 5-6) | Post-Gate Lesson Capture writes lessons for auto-fixed gates | `src/commands/merge-ready.md` exists | Read the Post-Gate Lesson Capture section | When the overall result is MERGE READY but gates required auto-fix, the section instructs writing a Trigger 3 lesson per auto-fixed gate describing what was corrected and what pre-implementation check would have caught it (per FR-5.2, AC-7) |
| 5.2.2 | UC-4.3-A1 (Clean pass — no lessons) | No lesson is written when all gates pass cleanly | `src/commands/merge-ready.md` exists | Read the Post-Gate Lesson Capture section | The section explicitly handles the case where no gate required auto-fix: no lesson entries are written, and no mention of lessons appears in the output (per UC-4.3-A1) |

### 5.3 NOT MERGE READY Path (Failure Lessons)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.3.1 | UC-4.3-A2 (Retry budget exhausted) | Post-Gate Lesson Capture writes lessons for failed gates (retry budget exhausted) | `src/commands/merge-ready.md` exists | Read the Post-Gate Lesson Capture section | When the overall result is NOT MERGE READY due to exhausted retries, the section instructs writing a Trigger 3 lesson per failed gate describing the failure pattern and the upstream action that would have prevented it (per FR-5.3, AC-7) |

### 5.4 Trigger 3 Format Reference

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.4.1 | UC-4.3 (Primary Flow, Step 5c) | Post-Gate Lesson Capture references "Trigger 3" or "Gate Failure" trigger type | `src/commands/merge-ready.md` exists | Grep for "Trigger 3\|Gate Failure" in `src/commands/merge-ready.md` | The section uses "Trigger 3" or "Gate Failure" as the trigger type label for lessons written from merge-ready (per FR-5.1, UC-4.3 lesson format) |

### 5.5 Existence Guard

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.5.1 | UC-4.3-E1 (File absent — no-op) | Post-Gate Lesson Capture includes an existence guard for `.claude/lessons.md` | `src/commands/merge-ready.md` exists | Read the Post-Gate Lesson Capture section | The section is conditioned on `.claude/lessons.md` existing; when the file is absent, the section is skipped with a note: "Lesson capture skipped — `.claude/lessons.md` not found" (per FR-5.4, AC-7, NFR-2) |

---

## 6. Context-Refresh Integration (FR-6)

### 6.1 Step 1.5 — Prevention Rules and Recent Lessons

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.1.1 | UC-4.6 (Primary Flow, Steps 3-4) | `src/commands/context-refresh.md` contains step 1.5 reading Prevention Rules and recent lessons | `src/commands/context-refresh.md` exists | Grep for "1.5\|lessons.md\|Prevention Rules" in `src/commands/context-refresh.md` | A step numbered 1.5 (between reading the scratchpad and reading the plan) exists and instructs reading the `## Prevention Rules` section in full and the 5 most recent entries from `## Lessons Log` (per FR-6.1, AC-8) |
| 6.1.2 | UC-4.6-A2 (File absent) | Step 1.5 includes an existence guard | `src/commands/context-refresh.md` exists | Read step 1.5 in `src/commands/context-refresh.md` | The step is conditioned on `.claude/lessons.md` existing; absent files are silently skipped (per FR-6.1, NFR-2) |
| 6.1.3 | UC-4.6 (Primary Flow, Step 4) | Step 1.5 limits the Lessons Log read to 5 most recent entries | `src/commands/context-refresh.md` exists | Read step 1.5 in `src/commands/context-refresh.md` | The step reads "5 most recent" entries from `## Lessons Log` — not the full log — enforcing the context budget from FR-1.8 (per FR-6.1) |

### 6.2 Output Format — Lessons Summary Line

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.2.1 | UC-4.6 (Primary Flow, Step 5) | Context-refresh output format includes a "Lessons" summary line | `src/commands/context-refresh.md` exists | Grep for "Lessons" in the output format section of `src/commands/context-refresh.md` | The context-refresh output format includes a "Lessons" line showing the count of active prevention rules and the dates of the 5 most recent lessons (per FR-6.2, AC-8) |

### 6.3 Consolidation Prompt

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.3.1 | UC-4.6-E1 (Log exceeds 50 entries) | Context-refresh adds a consolidation prompt when Lessons Log exceeds 50 entries | `src/commands/context-refresh.md` exists | Grep for "50\|consolidat" in `src/commands/context-refresh.md` | The file states that when `## Lessons Log` has more than 50 entries, a consolidation prompt is added to the output: "Lessons Log has N entries (>50). Consider running consolidation before the next slice." (per FR-6.3, AC-8) |

---

## 7. Develop-Feature Integration (FR-7)

### 7.1 Phase 2 Prevention Rules Pre-read

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.1.1 | UC-4.8-P2 (Primary Flow, Steps 3-4) | `src/commands/develop-feature.md` Phase 2 instructs reading Prevention Rules before spawning subagents | `src/commands/develop-feature.md` exists | Grep for "Prevention Rules\|lessons.md" in `src/commands/develop-feature.md` | Phase 2 (implementation section) instructs the orchestrator to read the `## Prevention Rules` section of `.claude/lessons.md` before spawning any subagents (per FR-7.1, AC-9) |
| 7.1.2 | UC-4.5-A1 (File absent during planning) | Phase 2 prevention rules pre-read includes an existence guard | `src/commands/develop-feature.md` exists | Read the Phase 2 prevention rules instruction | The instruction is conditioned on `.claude/lessons.md` existing; absent files are silently skipped (per FR-7.1, NFR-2) |

### 7.2 Post-Wave Lesson Capture

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.2.1 | UC-4.8-P1 (Primary Flow, Steps 8-10) | `src/commands/develop-feature.md` post-wave result collection includes lesson capture as item 3 | `src/commands/develop-feature.md` exists | Read the post-wave result collection section in `src/commands/develop-feature.md` | The post-wave result collection step includes a lesson capture item (numbered item 3 or equivalent) covering both Trigger 2 (same deviation rule category across 2+ slices in the wave) and Trigger 3 (failed slice) lesson capture (per FR-7.2, FR-7.3, AC-9) |
| 7.2.2 | UC-4.8-P1 (Primary Flow, Step 10) | Post-wave lesson capture covers slices that succeeded after auto-fix | `src/commands/develop-feature.md` exists | Read the post-wave lesson capture instruction | The orchestrator writes Trigger 2 lessons when the same deviation rule category fires in 2 or more slices within the wave (per FR-7.2) |
| 7.2.3 | UC-4.8-P1-EC1 (All subagents hit Rule 3) | Post-wave lesson capture covers failed slices (retry budget exhausted) | `src/commands/develop-feature.md` exists | Read the post-wave lesson capture instruction | The orchestrator writes a Trigger 3 lesson for each slice that failed (retry budget exhausted), describing the failure pattern (per FR-7.3, AC-9) |

### 7.3 Orchestrator-Only Write Constraint

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.3.1 | UC-4.8-P1 (Postconditions) | `src/commands/develop-feature.md` explicitly designates the orchestrator as sole lessons.md writer during parallel waves | `src/commands/develop-feature.md` exists | Grep for "orchestrator.*lesson\|only.*orchestrator.*lesson\|subagent.*not.*lesson" in `src/commands/develop-feature.md` | The file states that all lesson writes during parallel wave execution are performed by the orchestrator, not by subagents (per FR-7.4, AC-9) |
| 7.3.2 | UC-4.8-P1-E1 (Subagent violates rule) | Subagent spawn prompt includes "Do NOT write to `.claude/lessons.md`" instruction | `src/commands/develop-feature.md` exists | Read the subagent spawn prompt template in `src/commands/develop-feature.md` | The spawn prompt passed to each parallel subagent explicitly includes an instruction not to write to `.claude/lessons.md` (per FR-7.4) |

---

## 8. Bootstrap-Feature and Planner Integration (FR-8)

### 8.1 Bootstrap-Feature Step 5

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.1.1 | UC-4.5 (Primary Flow, Steps 2-3) | `src/commands/bootstrap-feature.md` Step 5 instructs reading Prevention Rules before the plan | `src/commands/bootstrap-feature.md` exists | Grep for "Prevention Rules\|lessons.md" in `src/commands/bootstrap-feature.md` | Step 5 (invoke planner) includes an instruction to read `.claude/lessons.md` Prevention Rules section before producing the implementation plan (per FR-8.1, AC-10) |
| 8.1.2 | UC-4.5-A1 (File absent) | Bootstrap Step 5 instruction includes an existence guard | `src/commands/bootstrap-feature.md` exists | Read the Step 5 lessons instruction | The instruction is conditioned on `.claude/lessons.md` existing; absent files are silently skipped (per FR-8.1, NFR-2) |
| 8.1.3 | UC-4.5 (Primary Flow, Step 7) | Bootstrap Step 5 mentions `Prevention:` sub-field | `src/commands/bootstrap-feature.md` exists | Grep for "Prevention:" in `src/commands/bootstrap-feature.md` | Step 5 mentions that relevant prevention rules should be incorporated into slice notes under a `Prevention:` sub-field (per FR-8.1) |

### 8.2 Planner Agent Document Reading List

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.2.1 | UC-4.5 (Primary Flow, Step 1) | `src/agents/planner.md` document reading list includes `.claude/lessons.md` | `src/agents/planner.md` exists | Grep for "lessons.md" in `src/agents/planner.md` | The planner's document reading list includes `.claude/lessons.md` (with an existence guard) alongside the plan file, use cases, and PRD sections (per FR-8.2, AC-10) |
| 8.2.2 | UC-4.5-A1 (File absent during planning) | Planner's lessons.md reference includes an existence guard | `src/agents/planner.md` exists | Read the document reading list in `src/agents/planner.md` | The `.claude/lessons.md` entry is marked with "if it exists" or equivalent so planning proceeds normally when the file is absent (per FR-8.2, NFR-2) |
| 8.2.3 | UC-4.5 (Primary Flow, Steps 6-8) | Planner output format includes an optional `Prevention:` sub-field | `src/agents/planner.md` exists | Grep for "Prevention:" in `src/agents/planner.md` | The per-slice output format supports an optional `Prevention:` sub-field. When prevention rules are relevant, they are listed there; when no rules apply, the field is omitted entirely (per FR-8.3, AC-10) |

---

## 9. Documentation (FR-9)

### 9.1 `src/claude.md` Cross-Session Learning Subsection

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.1.1 | UC-4.6 (Primary Flow) | `src/claude.md` contains a "Cross-Session Learning" subsection | `src/claude.md` exists | Grep for "Cross-Session Learning" in `src/claude.md` | A subsection titled "Cross-Session Learning" exists under the pipeline description (per FR-9.1, AC-11) |
| 9.1.2 | UC-4.1, UC-4.2, UC-4.3 | Cross-Session Learning subsection describes all three capture triggers | `src/claude.md` exists | Read the "Cross-Session Learning" section | The subsection describes all three triggers: (a) User Correction, (b) Repeated Error Pattern, (c) Quality Gate Failure (per FR-9.1) |
| 9.1.3 | UC-4.9 (Elevation) | Cross-Session Learning subsection describes prevention rule elevation | `src/claude.md` exists | Read the "Cross-Session Learning" section | The subsection describes the elevation mechanism and thresholds (2 for security, 3 for general) (per FR-9.1) |
| 9.1.4 | UC-4.10 (Retirement) | Cross-Session Learning subsection describes prevention rule retirement | `src/claude.md` exists | Read the "Cross-Session Learning" section | The subsection describes the retirement mechanism: 10 features without confirmation, or deleted file/pattern references (per FR-9.1) |
| 9.1.5 | UC-4.4, UC-4.6 | Cross-Session Learning subsection describes where lessons are read versus written | `src/claude.md` exists | Read the "Cross-Session Learning" section | The subsection explains where in the pipeline lessons are read (session start, pre-flight, planning, context-refresh) versus written (post-commit, post-gate) (per FR-9.1) |

### 9.2 README Documentation

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.2.1 | UC-4.6 (Session Start context) | `README.md` mentions "Self-Improvement Loop" in the feature list | `README.md` exists | Grep for "Self-Improvement Loop\|self.improvement" in `README.md` | "Self-Improvement Loop" appears in the feature list or project overview with a one-sentence description (per FR-9.2, AC-11) |
| 9.2.2 | UC-4.1 (Preconditions — file provisioned) | `README.md` includes `.claude/lessons.md` in the project setup output | `README.md` exists | Grep for "lessons.md" in `README.md` | The project setup or directory listing section includes `.claude/lessons.md` as a file provisioned by `--init-project`, alongside `.claude/scratchpad.md` (per FR-9.3, AC-11) |

### 9.3 Version Bump

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.3.1 | UC-4.1 (All references) | `install.sh` version string is `3.2.0` | `install.sh` exists | Grep for "3\.2\.0" in `install.sh` | The version string in `install.sh` reads `3.2.0` (per FR-9.4, AC-3) |
| 9.3.2 | UC-4.1 (All references) | `README.md` version badge shows `3.2.0` | `README.md` exists | Grep for "3\.2\.0" in `README.md` | The README version badge or version reference shows `3.2.0` (per FR-9.4) |

---

## 10. Backward Compatibility (NFR-2)

### 10.1 Existence Guard Coverage — All Modified Command Files

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.1.1 | UC-4.1-A (Primary Flow, Step 2) | `src/rules/scratchpad.md` lessons reference has an existence guard | `src/rules/scratchpad.md` exists | Grep for "lessons.md" in `src/rules/scratchpad.md`; verify "if it exists" or "if the file exists" appears nearby (within 5 lines) | The lessons reference in scratchpad.md is conditional on file existence (per AC-12, NFR-2) |
| 10.1.2 | UC-4.4-A3 (File absent) | `src/commands/implement-slice.md` lessons references all have existence guards | `src/commands/implement-slice.md` exists | Grep for "lessons.md" in `src/commands/implement-slice.md`; for each match, verify "if it exists" or "if the file exists" appears nearby | Every occurrence of "lessons.md" in implement-slice.md is conditioned on file existence (per AC-12, NFR-2) |
| 10.1.3 | UC-4.3-E1 (File absent — no-op) | `src/commands/merge-ready.md` lessons references all have existence guards | `src/commands/merge-ready.md` exists | Grep for "lessons.md" in `src/commands/merge-ready.md`; for each match, verify existence guard is nearby | Every occurrence of "lessons.md" in merge-ready.md is conditioned on file existence (per AC-12, NFR-2) |
| 10.1.4 | UC-4.6-A2 (File absent) | `src/commands/context-refresh.md` lessons references all have existence guards | `src/commands/context-refresh.md` exists | Grep for "lessons.md" in `src/commands/context-refresh.md`; for each match, verify existence guard is nearby | Every occurrence of "lessons.md" in context-refresh.md is conditioned on file existence (per AC-12, NFR-2) |
| 10.1.5 | UC-4.5-A1 (File absent during planning) | `src/commands/develop-feature.md` lessons references all have existence guards | `src/commands/develop-feature.md` exists | Grep for "lessons.md" in `src/commands/develop-feature.md`; for each match, verify existence guard is nearby | Every occurrence of "lessons.md" in develop-feature.md is conditioned on file existence (per AC-12, NFR-2) |
| 10.1.6 | UC-4.5-A1 (File absent during planning) | `src/commands/bootstrap-feature.md` lessons references all have existence guards | `src/commands/bootstrap-feature.md` exists | Grep for "lessons.md" in `src/commands/bootstrap-feature.md`; for each match, verify existence guard is nearby | Every occurrence of "lessons.md" in bootstrap-feature.md is conditioned on file existence (per AC-12, NFR-2) |
| 10.1.7 | UC-4.5-A1 (File absent) | `src/agents/planner.md` lessons reference has an existence guard | `src/agents/planner.md` exists | Grep for "lessons.md" in `src/agents/planner.md`; verify existence guard is nearby | The lessons.md entry in the planner's reading list is conditioned on file existence (per AC-12, NFR-2) |

### 10.2 No Agent Count Change

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.2.1 | UC-4.1 (No new agents) | Agent count remains at 13 | None | Glob `src/agents/*.md` and count results | Exactly 13 agent files exist — this feature adds no new agents (per NFR-4) |

### 10.3 Unchanged Files Remain Unchanged

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.3.1 | UC-4.1-A (Backward compat) | Files listed as "Unchanged" in PRD Section 4.6 do not reference lessons.md | All listed unchanged files exist | Grep for "lessons.md" in `src/rules/error-recovery.md`, `src/rules/git.md`, `src/rules/tool-limitations.md` | None of these files reference "lessons.md" — lesson capture is wired into command files and the lessons rule file only, not into unchanged rule files (per PRD Section 4.6) |

---

## 11. Advanced Behaviors and Edge Cases

### 11.1 Prevention Rule Elevation (UC-4.9)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 11.1.1 | UC-4.9 (Primary Flow, Step 6) | Elevation is documented in `src/rules/lessons.md` with format for elevated rules | `src/rules/lessons.md` exists | Read the elevation section in `src/rules/lessons.md` | The file specifies the format for elevated rules in `## Prevention Rules`: rule title, ALWAYS/NEVER/WHEN phrasing, recurrence count, and elevation date note (per FR-1.6) |
| 11.1.2 | UC-4.9-EC1 (Security threshold is 2) | Security and data-integrity threshold is 2 occurrences | `src/rules/lessons.md` exists | Read the elevation threshold section | The file explicitly states security/data-integrity lessons elevate after 2 occurrences across features (not 3), reflecting their higher stakes (per FR-1.6) |
| 11.1.3 | UC-4.9-EC2 (Feature-level counting) | Elevation threshold counts features, not total occurrences | `src/rules/lessons.md` exists | Read the elevation threshold section | The file specifies that the threshold counts distinct features in which the lesson was captured, not the raw occurrence count within a single feature (per UC-4.9-EC2) |

### 11.2 Prevention Rule Retirement (UC-4.10)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 11.2.1 | UC-4.10 (Primary Flow, Step 4) | Retirement moves rules to `## Archived Rules` section | `src/rules/lessons.md` exists | Read the retirement section in `src/rules/lessons.md` | The file specifies that retired rules are moved to an `## Archived Rules` section with a retirement note appended (per FR-1.7) |
| 11.2.2 | UC-4.10-E1 (Cannot determine 10-feature count) | Retirement does not fire on uncertain non-confirmation counts | `src/rules/lessons.md` exists | Read the Condition B retirement instructions | The file states that when the 10-feature window cannot be reliably determined (e.g., scratchpad archive removed history), the rule is retained rather than retired based on an uncertain count (per UC-4.10-E1) |
| 11.2.3 | UC-4.6-E2 (Stale rule during context-refresh) | Context-refresh is identified as a retirement trigger location | `src/commands/context-refresh.md` exists | Grep for "stale\|retire\|archived.*rule" in `src/commands/context-refresh.md` | The context-refresh file references checking for and archiving stale prevention rules (rules referencing deleted files), consistent with UC-4.6-E2 and FR-1.7 (per FR-6.1) |

### 11.3 Parallel Wave Behaviors (UC-4.8-P1, UC-4.8-P2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 11.3.1 | UC-4.8-P2 (Primary Flow) | Concurrent Prevention Rules reads by parallel subagents are safe (read-only) | `src/rules/lessons.md` and `src/commands/implement-slice.md` exist | Read pre-flight check #5 — verify it only reads, never writes during pre-flight | Pre-flight check #5 is a read-only operation; no write to lessons.md occurs during the pre-flight phase of any subagent (per UC-4.8-P2, FR-4.1) |
| 11.3.2 | UC-4.8-P1-A1 (Subagent receives Trigger 1) | Subagents report Trigger 1 events to the orchestrator rather than writing directly | `src/commands/develop-feature.md` exists | Read the parallel wave subagent result report specification in `src/commands/develop-feature.md` | The spawn prompt or result collection instructions specify that subagents include any Trigger 1 correction details in their result report; the orchestrator writes the lesson entry post-wave (per UC-4.8-P1-A1, FR-7.4) |
| 11.3.3 | UC-4.8-P1-EC1 (One lesson per wave, not per subagent) | Post-wave Trigger 2 check produces one wave-level lesson, not one per subagent | `src/commands/develop-feature.md` exists | Read the post-wave Trigger 2 lesson capture instructions | The orchestrator writes a single wave-level lesson when the same deviation rule category fires in 2+ slices within the wave (one lesson captures the whole wave pattern, not individual per-subagent entries) (per UC-4.8-P1-EC1, FR-7.2) |

### 11.4 Multiple Corrections in One Slice (UC-4.1 Alternative Flows)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 11.4.1 | UC-4.1-EC1 (Multiple triggers simultaneously) | A single message matching multiple Trigger 1 heuristics produces one lesson entry | `src/rules/lessons.md` exists | Read the Trigger 1 section for handling multiple simultaneous heuristic matches | The rule specifies that a message matching multiple heuristics (e.g., explicit rejection AND replacement code) produces one lesson entry — not one per matched heuristic (per UC-4.1-EC1) |
| 11.4.2 | UC-4.1-EC2 (Non-code corrections) | Trigger 1 applies to any correction, not only code-level corrections | `src/rules/lessons.md` exists | Read the Trigger 1 section scope description | The file states that Trigger 1 covers any correction during slice implementation, including process or convention corrections (e.g., wrong commit message format) (per UC-4.1-EC2) |

---

## 12. Cross-Reference Integrity

### 12.1 FR-to-Test-Case Coverage

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 12.1.1 | AC-1 through AC-12 | Every Functional Requirement in PRD Section 4.3 has at least one test case | This document is complete | Review the traceability matrix below | All FR-1 through FR-9 sub-requirements map to at least one test case in this document |
| 12.1.2 | AC-12 | Every use case in `self-improvement-loop_use_cases.md` has at least one test case | This document is complete | Review the traceability matrix below | All use cases (UC-4.1 through UC-4.10, UC-4.1-A, UC-4.8-P1, UC-4.8-P2) map to at least one test case |

### 12.2 File Path Integrity

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 12.2.1 | UC-4.1 (All) | All source files listed in PRD Section 4.6 as new files exist | Implementation complete | `test -f src/rules/lessons.md` and `test -f templates/lessons.md` | Both new files exist at their specified paths (per PRD Section 4.6 "New Files") |
| 12.2.2 | UC-4.1 (All) | All source files listed as modified in PRD Section 4.6 still exist at original paths | Implementation complete | Glob for each modified file listed in PRD Section 4.6 "Modified Files" | All 11 modified files exist at their original paths; no files were moved or renamed (per NFR-2) |

---

## Use Case to Test Case Traceability Matrix

| Use Case | Test Cases |
|----------|------------|
| UC-4.1 Primary Flow (User correction) | 1.1.1, 1.1.4, 1.2.1, 1.2.2, 1.2.3, 4.2.1, 4.2.2, 11.4.1, 11.4.2 |
| UC-4.1-A1 (Multiple corrections) | 11.4.1 |
| UC-4.1-A2 (Post-commit correction) | 4.2.1, 4.3.1 |
| UC-4.1-E1 (Ambiguous correction — no heuristic match) | 1.2.4 |
| UC-4.1-E2 (Write fails) | 2.3.1 |
| UC-4.1-EC1 (Multiple heuristics in one message) | 11.4.1 |
| UC-4.1-EC2 (Non-code correction) | 11.4.2 |
| UC-4.1-EC3 (50-entry consolidation on write) | 1.1.9, 6.3.1 |
| UC-4.2 Primary Flow (Repeated error) | 1.1.3, 1.3.1, 1.3.2, 4.2.3 |
| UC-4.2-A1 (Error fires only once) | 1.3.1 |
| UC-4.2-A2 (Two different categories, each once) | 1.3.2 |
| UC-4.2-EC1 (Threshold at second occurrence only) | 1.3.3 |
| UC-4.2-EC2 (Same category, different root causes) | 1.3.2 |
| UC-4.2-EC3 (Rule 4 fires twice) | 1.3.1 |
| UC-4.3 Primary Flow (Gate failure — auto-fix) | 1.1.3, 5.1.1, 5.1.2, 5.2.1, 5.4.1 |
| UC-4.3-A1 (All gates pass cleanly — no lessons) | 5.2.2 |
| UC-4.3-A2 (NOT MERGE READY — retry exhausted) | 5.3.1 |
| UC-4.3-E1 (lessons.md absent — no-op) | 5.5.1 |
| UC-4.3-EC1 (Multiple gates auto-fixed) | 5.1.2 |
| UC-4.3-EC3 (50-entry consolidation at gate time) | 1.1.9 |
| UC-4.4 Primary Flow (Prevention Rules pre-flight) | 4.1.1, 4.1.2, 4.1.3 |
| UC-4.4-A2 (Empty Prevention Rules section) | 2.1.2, 4.1.3 |
| UC-4.4-A3 (lessons.md absent — skip silently) | 4.1.2, 10.1.2 |
| UC-4.4-EC3 (10+ rules, all read in full) | 4.1.3, 1.1.7 |
| UC-4.5 Primary Flow (Prevention Rules inform planning) | 8.1.1, 8.1.2, 8.1.3, 8.2.1, 8.2.2, 8.2.3 |
| UC-4.5-A1 (lessons.md absent during planning) | 8.1.2, 8.2.2, 10.1.6, 10.1.7 |
| UC-4.5-A2 (Empty Prevention Rules during planning) | 8.2.3 |
| UC-4.5-E1 (Stale rule references deleted file) | 11.2.3 |
| UC-4.5-EC1 (Security rule treated as broadly applicable) | 11.1.2 |
| UC-4.6 Primary Flow (Session-start review) | 3.1.1, 3.1.2, 3.1.3, 6.1.1, 6.1.2, 6.1.3, 6.2.1 |
| UC-4.6-A1 (No current feature active) | 3.1.1 |
| UC-4.6-A2 (lessons.md absent) | 3.1.2, 6.1.2, 10.1.1 |
| UC-4.6-E1 (Log exceeds 50 entries) | 6.3.1 |
| UC-4.6-E2 (Stale prevention rule — archived) | 11.2.3 |
| UC-4.1-A (Backward compatibility — file absent) | 10.1.1, 10.1.2, 10.1.3, 10.1.4, 10.1.5, 10.1.6, 10.1.7 |
| UC-4.1-A-EC1 (Mid-feature provisioning) | 2.2.2 |
| UC-4.1-A-EC2 (Missing guard treated as Rule 1 auto-fix) | 10.1.1 through 10.1.7 |
| UC-4.8-P1 Primary Flow (Orchestrator-only writes) | 1.1.8, 4.4.1, 4.4.2, 7.2.1, 7.2.2, 7.2.3, 7.3.1, 7.3.2 |
| UC-4.8-P1-A1 (Subagent Trigger 1 — report to orchestrator) | 11.3.2 |
| UC-4.8-P1-E1 (Subagent violates write prohibition) | 7.3.2 |
| UC-4.8-P1-EC1 (One wave-level lesson for 3 subagent errors) | 11.3.3 |
| UC-4.8-P2 Primary Flow (Concurrent Prevention Rules reads) | 11.3.1, 4.1.1 |
| UC-4.8-P2-EC1 (Two subagents match same rule) | 11.3.1 |
| UC-4.9 Primary Flow (Rule elevation) | 11.1.1, 11.1.2, 11.1.3, 1.1.5 |
| UC-4.9-EC1 (Security 2-occurrence threshold) | 11.1.2 |
| UC-4.9-EC2 (Feature-level counting) | 11.1.3 |
| UC-4.10 Primary Flow (Rule retirement) | 11.2.1, 1.1.6 |
| UC-4.10-E1 (Cannot verify 10-feature window) | 11.2.2 |
| UC-4.10-EC2 (Broad rules retire more slowly) | 11.2.2 |
| FR-2 (Template and Install) | 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.3.1 |
| FR-9 (Documentation) | 9.1.1, 9.1.2, 9.1.3, 9.1.4, 9.1.5, 9.2.1, 9.2.2, 9.3.1, 9.3.2 |
| NFR-2 (Backward compatibility) | 10.1.1 through 10.1.7 |
| NFR-4 (No new agents) | 10.2.1 |
| AC-1 through AC-12 | 12.1.1, 12.1.2 |
| Cross-reference integrity | 12.2.1, 12.2.2 |
