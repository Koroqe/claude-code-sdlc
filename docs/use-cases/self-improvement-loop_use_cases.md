# Use Cases: Self-Improvement Loop — Cross-Session Lesson Capture

> Based on [PRD](../PRD.md) — Section 4: Self-Improvement Loop

---

## UC-4.1: User Correction Triggers Lesson Capture

**Actor**: Pipeline Agent (any agent executing an implement-slice step) and Developer (human user)
**Preconditions**:
- A slice is actively being implemented (TDD flow in progress or just completed)
- `.claude/lessons.md` exists in the project (existence guard satisfied)
- The agent has just made a code change or taken a technical action the developer is responding to
- The agent is NOT running as a parallel subagent (wave context absent, or this is a single-slice wave)

**Trigger**: The developer sends a message during or immediately after slice implementation that satisfies one or more of the Trigger 1 heuristics defined in FR-1.2

### Primary Flow (Happy Path)

1. The developer reviews the agent's output during or after implement-slice execution
2. The developer sends a message containing explicit rejection language (e.g., "that's wrong", "no, you should", "revert that", "undo that") or provides replacement code directly, or asks to revert to a prior state
3. The agent detects the message matches one or more Trigger 1 heuristics:
   - (a) Explicit rejection — message contains rejection language
   - (b) Replacement code — message contains a code block offering an alternative approach
   - (c) Revert request — message references a prior state or asks to go back
4. The agent accepts and applies the correction
5. The agent reads `.claude/lessons.md` to confirm the file exists
6. The agent writes a new entry to the `## Lessons Log` section using the lesson entry format:
   - Date in `YYYY-MM-DD` format
   - Trigger type: `User Correction`
   - What happened: concrete description of what the agent did and what the developer corrected
   - What to do instead: a prevention heuristic using ALWAYS/NEVER/WHEN phrasing that generalizes beyond this specific instance
7. The agent confirms the lesson is written
8. The agent continues implementing the slice using the corrected approach
9. After the slice commit, Step 7 (scratchpad update) proceeds normally

**Postconditions**:
- A lesson entry is appended to `## Lessons Log` in `.claude/lessons.md`
- The entry contains date, trigger type, description of the correction, and a generalized prevention heuristic
- Implementation continues with the corrected approach
- The developer's correction is reflected in the committed code

### Alternative Flows

- **UC-4.1-A1: Multiple corrections in a single slice** — Developer corrects the agent more than once during the same slice
  1. The agent detects the first Trigger 1 match and writes a lesson entry (steps 1-7 of primary flow)
  2. The agent applies the correction and continues
  3. The developer sends another correcting message matching a Trigger 1 heuristic
  4. The agent detects the second match and writes a second, separate lesson entry to `## Lessons Log`
  5. Each correction produces its own discrete lesson entry with its own date and description
  6. Implementation concludes with the final corrected approach

- **UC-4.1-A2: Correction during post-commit review** — Developer reviews the committed slice and immediately issues a correction before the next slice starts
  1. The slice has already been committed (Step 5 of implement-slice primary flow)
  2. The developer sends a correction message referencing the committed code
  3. The agent detects a Trigger 1 match
  4. The agent writes a lesson entry to `## Lessons Log`
  5. The agent makes a corrective commit (amendment or follow-up commit per git rules)
  6. Scratchpad is updated to reflect the correction

### Error Flows

- **UC-4.1-E1: Ambiguous correction — heuristic not matched** — Developer's message could be a correction but does not satisfy any Trigger 1 heuristic
  1. Developer sends a message such as "hmm, that's an interesting approach" or "could we do this differently?" — no explicit rejection language, no replacement code, no revert request
  2. None of the three Trigger 1 heuristics (explicit rejection, replacement code, revert request) are matched
  3. The agent does NOT write a lesson entry (false positive prevention)
  4. The agent responds to the developer's message in context (asks for clarification if needed)
  5. If the developer clarifies with a concrete correction, that subsequent message is evaluated against the heuristics independently
  6. No lesson is written unless a concrete heuristic match occurs

- **UC-4.1-E2: lessons.md write fails** — The agent cannot write to the file (permissions issue)
  1. The agent detects a Trigger 1 heuristic match and attempts to write to `.claude/lessons.md`
  2. The write fails (e.g., file permission not granted in `templates/settings.json`)
  3. The agent logs the failure in its output but does NOT block slice implementation
  4. The agent continues with the corrected approach
  5. The agent surfaces the write failure as a note to the developer ("Could not write lesson — check Edit/Write permissions for `.claude/lessons.md` in settings.json")

### Edge Cases

- **UC-4.1-EC1**: Developer's message contains both Trigger 1 heuristics simultaneously (explicit rejection AND replacement code). The agent writes a single lesson entry — it does not write one entry per matched heuristic.
- **UC-4.1-EC2**: Developer corrects the agent on a non-code matter (e.g., "that commit message is wrong, use fix not feat"). Trigger 1 applies to any correction during slice implementation, not only code corrections. The agent writes a lesson entry describing the process error and the correct convention.
- **UC-4.1-EC3**: The `## Lessons Log` already has 50 or more entries when a new lesson is to be written. The agent consolidates redundant lessons (merges entries with the same root cause) before adding the new entry, per FR-1.10.

### Data Requirements

- **Input**: Developer message matching one or more Trigger 1 heuristics; the current slice context (files being edited, what was done); current date
- **Output**: One new entry appended to `## Lessons Log` in `.claude/lessons.md`
- **Side Effects**: `.claude/lessons.md` is modified (one entry appended). No other files are changed by the lesson capture step itself.

---

## UC-4.2: Repeated Error Pattern Triggers Lesson Capture

**Actor**: Pipeline Agent executing implement-slice steps within a single feature's implementation
**Preconditions**:
- At least two slices of the same feature have been implemented (or are in progress)
- The same deviation rule category (Rule 1, Rule 2, Rule 3, or Rule 4) has fired during implementation of two or more slices in this feature
- `.claude/lessons.md` exists in the project
- The agent is NOT running as a parallel subagent (this capture happens after a commit in sequential mode, or is handled by the orchestrator in parallel mode — see UC-4.8-P1)

**Trigger**: After the commit step for a slice, the agent checks Trigger 2: has the same deviation rule category fired 2+ times across this feature's slices?

### Primary Flow (Happy Path)

1. The agent completes a slice and reaches Step 6 (Capture Lessons) of implement-slice
2. The agent reviews the deviation rule events that occurred during this feature's implementation (tracked via scratchpad or in-session memory)
3. The agent identifies that the same deviation rule category has fired two or more times:
   - Example: Rule 3 (dependency conflict / config issue) fired in Slice 2 (wrong module path) and again in Slice 4 (same path pattern, different file)
4. The threshold for Trigger 2 is met (same category, 2+ occurrences, same feature)
5. The agent reads `.claude/lessons.md` to confirm the file exists
6. The agent writes a new entry to `## Lessons Log` using the lesson entry format:
   - Date in `YYYY-MM-DD` format
   - Trigger type: `Repeated Error`
   - What happened: the error signature (which deviation rule, what the error was in each occurrence, which slices were affected)
   - What to do instead: the fix applied and a prevention strategy in ALWAYS/NEVER/WHEN phrasing
7. The agent confirms the lesson is written and continues to Step 7 (scratchpad update)

**Postconditions**:
- A lesson entry capturing the repeated error pattern is appended to `## Lessons Log`
- The entry identifies the deviation rule category, the error signature, the fix, and a generalized prevention strategy
- The scratchpad is updated in Step 7 as normal

### Alternative Flows

- **UC-4.2-A1: Error occurs only once in the feature** — A deviation rule fires but only once
  1. After the commit step, the agent checks Trigger 2
  2. The agent finds that the deviation rule category only fired once across all slices of this feature
  3. The threshold is NOT met (fewer than 2 occurrences)
  4. No lesson entry is written for this trigger
  5. Normal slice completion proceeds (scratchpad update)
  6. If the same error category fires again in a subsequent slice of the same feature, the threshold will be met at that point and a lesson will then be captured

- **UC-4.2-A2: Two different deviation rule categories each fire once** — No single category reaches threshold
  1. Rule 1 fires once in Slice 2 and Rule 3 fires once in Slice 4
  2. The agent checks Trigger 2 after Slice 4's commit
  3. No single category has 2+ occurrences; the two firings are different categories
  4. Trigger 2 threshold is not met; no lesson is written for Trigger 2
  5. If Trigger 1 is also not active, Step 6 produces no lesson entry and the agent proceeds to Step 7

### Error Flows

- **UC-4.2-E1: Deviation rule firing records lost** — In-session error tracking context is unavailable (e.g., context was refreshed mid-feature)
  1. After a commit, the agent attempts to check Trigger 2 but cannot determine how many times a given deviation rule category has fired (context was compacted or refreshed)
  2. The agent checks the scratchpad for any notes on previous slice errors in this feature
  3. If no reliable count can be reconstructed, the agent does NOT guess or write a speculative lesson
  4. The agent notes in the output that Trigger 2 check was inconclusive due to context loss
  5. The agent proceeds to Step 7 (scratchpad update) without a Trigger 2 lesson
  6. If the error pattern recurs in a subsequent slice, the recurrence is tracked from that point forward

### Edge Cases

- **UC-4.2-EC1**: The same Rule 3 error fires three times in a feature. A lesson is written after the second occurrence (threshold met). No additional lesson is written for the third occurrence of the same category (one lesson per pattern per feature is sufficient).
- **UC-4.2-EC2**: Two different root causes both classify as Rule 3. The agent writes separate lesson entries distinguishing the two root causes even though they share the same deviation rule category — the category is a threshold trigger, not a de-duplication key. If the underlying errors are genuinely different, two lessons are appropriate.
- **UC-4.2-EC3**: A Rule 4 escalation (architectural decision required) fires twice in the same feature. The threshold is met. The agent writes a lesson recommending that future plans address the architectural constraint explicitly in slice design, rather than discovering it mid-implementation.

### Data Requirements

- **Input**: In-session record of deviation rule firings by category across this feature's slices; current slice context; current date
- **Output**: Zero or one lesson entry appended to `## Lessons Log` (zero if threshold not met, one if threshold met for any category)
- **Side Effects**: `.claude/lessons.md` is modified if threshold is met. No other files are changed by the lesson capture step.

---

## UC-4.3: Quality Gate Failure Triggers Lesson Capture

**Actor**: `merge-ready` command (orchestrator-level, not a subagent)
**Preconditions**:
- All implementation waves are complete (or development is otherwise finished)
- The developer has invoked `/merge-ready`
- All quality gates (code review, security audit, build, E2E, docs, verifier) have been executed to completion
- `.claude/lessons.md` exists in the project (if it does not, the Post-Gate Lesson Capture is a no-op)

**Trigger**: All quality gate executions complete, regardless of the overall MERGE READY / NOT MERGE READY verdict

### Primary Flow (Happy Path) — Gate required auto-fix, now MERGE READY

1. `/merge-ready` executes all quality gates in sequence
2. One or more gates succeeded only after an auto-fix was applied (deviation Rule 1 or Rule 2 resolved an issue inline during gate execution)
3. The overall verdict is MERGE READY (all gates pass after auto-fix)
4. `/merge-ready` enters the Post-Gate Lesson Capture section
5. For each gate that required an auto-fix:
   a. The agent identifies what the auto-fix corrected (e.g., "build-runner added a missing null check")
   b. The agent identifies what pre-implementation check would have caught this (e.g., "implement-slice should have checked for null return values before committing")
   c. The agent writes a lesson entry to `## Lessons Log`:
      - Date in `YYYY-MM-DD` format
      - Trigger type: `Gate Failure`
      - What happened: the gate that required auto-fix, the nature of the issue, and the auto-fix applied
      - What to do instead: the slice-level or planning-level check that would have prevented the gate from needing to auto-fix
6. The lesson entries are written for all auto-fixed gates
7. `/merge-ready` outputs the MERGE READY verdict to the developer, including a note that N lessons were written to `.claude/lessons.md`

**Postconditions**:
- One lesson entry per auto-fixed gate is appended to `## Lessons Log`
- The overall result is MERGE READY
- The developer is informed how many lessons were captured

### Alternative Flows

- **UC-4.3-A1: All gates pass cleanly — no auto-fix needed** — Ideal outcome, no lessons required
  1. `/merge-ready` executes all quality gates
  2. All gates pass on the first attempt with no auto-fix required (no deviation rules fired during gate execution)
  3. The overall verdict is MERGE READY
  4. The Post-Gate Lesson Capture section has nothing to write (no gate failures, no auto-fixes)
  5. No lesson entries are written
  6. `/merge-ready` outputs MERGE READY; no mention of lessons (nothing to report)

- **UC-4.3-A2: Gate fails, retry budget exhausted — NOT MERGE READY** — Unresolved failure pattern captured
  1. `/merge-ready` executes quality gates
  2. One or more gates fail and exhaust their retry budget (3 retries, no auto-fix succeeded)
  3. The overall verdict is NOT MERGE READY
  4. `/merge-ready` enters the Post-Gate Lesson Capture section
  5. For each gate that exhausted retries:
     a. The agent identifies the failure pattern (what the gate expected, what it found)
     b. The agent identifies the slice-level or planning-level action that would have prevented the failure
     c. The agent writes a lesson entry to `## Lessons Log`:
        - Date in `YYYY-MM-DD` format
        - Trigger type: `Gate Failure`
        - What happened: the gate, the failure pattern, that retries were exhausted
        - What to do instead: the upstream prevention action (slice-level check or planner note)
  6. The lesson entries are written for all failed gates
  7. `/merge-ready` outputs NOT MERGE READY verdict with: gate failure details, retry counts, and a note that lessons were written for each failure

**Postconditions** (for UC-4.3-A2):
- One lesson entry per failed gate (retry budget exhausted) is appended to `## Lessons Log`
- The overall result is NOT MERGE READY
- The developer receives the full failure report and knows lessons were captured

### Error Flows

- **UC-4.3-E1: lessons.md does not exist** — Post-Gate Lesson Capture is skipped
  1. `/merge-ready` completes all gate executions (pass or fail)
  2. The Post-Gate Lesson Capture section checks for `.claude/lessons.md` existence
  3. The file does not exist (project was not provisioned with `--init-project`, or pre-dates this feature)
  4. The Post-Gate Lesson Capture is skipped entirely
  5. `/merge-ready` notes in its output: "Lesson capture skipped — `.claude/lessons.md` not found"
  6. The MERGE READY / NOT MERGE READY verdict is unaffected by the absence of lessons.md
  7. Backward compatibility is preserved; the gate results are reported identically to pre-feature behavior

- **UC-4.3-E2: Gate failure in parallel execution mode** — Lesson capture context is available at merge-ready time
  1. The feature used parallel wave execution (multiple subagents ran simultaneously during development)
  2. `/merge-ready` runs after all waves are complete (single-agent context, no parallelism at gate time)
  3. Gate failures and auto-fixes are evaluated in the merge-ready context, not in subagent context
  4. Lesson capture proceeds normally per the primary flow or UC-4.3-A2
  5. There is no parallelism issue — merge-ready always runs as a single orchestrator

### Edge Cases

- **UC-4.3-EC1**: Multiple gates required auto-fix. Each gate produces its own lesson entry (not consolidated). Different gates catching different issues are separate learning signals.
- **UC-4.3-EC2**: The same gate has both an auto-fixed issue AND a retry-exhausted issue (two separate checks within the same gate, e.g., build succeeded after auto-fix but E2E exhausted retries). Both patterns are captured as separate lesson entries — one Trigger 3 lesson for the auto-fixed check and one for the exhausted check.
- **UC-4.3-EC3**: Post-Gate Lesson Capture triggers the 50-entry consolidation check (Lessons Log already has 50+ entries). The agent consolidates redundant lessons before adding the new gate failure entries.

### Data Requirements

- **Input**: Results of all gate executions (pass/fail/auto-fixed per gate); the auto-fix descriptions and failure patterns; current date
- **Output**: Zero or more lesson entries appended to `## Lessons Log` (one per gate that required auto-fix or exhausted retries)
- **Side Effects**: `.claude/lessons.md` is modified if any gate required auto-fix or failed. The MERGE READY verdict itself is not affected by lesson capture success or failure.

---

## UC-4.4: Prevention Rules Read Before Slice Implementation

**Actor**: Pipeline Agent executing `implement-slice` pre-flight checks
**Preconditions**:
- `implement-slice` has been invoked (directly or via `develop-feature` as a single-slice wave)
- The slice context is available: `Files:`, `Changes:`, `Verify:`, `Done when:` fields
- The agent is in the pre-flight check phase (before TDD execution begins)

**Trigger**: `implement-slice` reaches pre-flight check item #5 in its checklist

### Primary Flow (Happy Path)

1. `implement-slice` completes pre-flight checks 1-4 (branch check, scratchpad read, plan read, slice identification)
2. `implement-slice` reaches pre-flight check #5: "If `.claude/lessons.md` exists, read the `## Prevention Rules` section"
3. The agent checks for `.claude/lessons.md` — the file exists
4. The agent reads the `## Prevention Rules` section of `.claude/lessons.md` (only this section, not the full Lessons Log)
5. The agent scans the prevention rules for rules relevant to:
   - File paths listed in this slice's `Files:` field
   - Patterns or technologies referenced in `Changes:`
   - Common patterns that apply broadly (e.g., "ALWAYS add null checks before writing to DB")
6. One or more prevention rules are relevant to this slice
7. The agent adds the matching prevention rules as a note to the slice context (in-memory, not written to any file): "Relevant prevention rules for this slice: [rule text]"
8. The agent proceeds to the TDD flow, keeping the relevant prevention rules in context
9. During implementation, when the agent reaches code areas covered by a prevention rule, the rule influences the implementation choices (e.g., the rule "ALWAYS validate input before calling the external service" causes the agent to add validation that it might otherwise have added only after a gate failure)

**Postconditions**:
- Relevant prevention rules are held in active context during slice implementation
- The slice implementation reflects prevention rule guidance
- No files are written during the pre-flight prevention rule read
- The Lessons Log section is NOT read during pre-flight (context budget — only Prevention Rules section)

### Alternative Flows

- **UC-4.4-A1: No matching prevention rules found** — Prevention Rules section has rules, but none are relevant to this slice
  1. The agent reads the `## Prevention Rules` section
  2. The agent scans all rules and finds none that match this slice's files, patterns, or technologies
  3. The agent notes internally: "No relevant prevention rules for this slice"
  4. The agent proceeds to the TDD flow without adding any prevention-rule context
  5. Implementation proceeds as it would have before this feature existed

- **UC-4.4-A2: Prevention Rules section is empty** — No rules have been elevated yet (new project or early in feature development)
  1. The agent reads the `## Prevention Rules` section
  2. The section exists but contains only the placeholder comment (no actual rules)
  3. The agent recognizes there are no active prevention rules
  4. The agent proceeds to the TDD flow immediately
  5. No additional context is added; implementation proceeds normally

- **UC-4.4-A3: lessons.md does not exist** — Backward compatibility path
  1. The agent reaches pre-flight check #5
  2. The agent checks for `.claude/lessons.md` — the file does not exist
  3. The agent skips pre-flight check #5 silently
  4. The agent proceeds to the TDD flow without any prevention rule context
  5. No error is raised; no output note is required (the skip is transparent)
  6. Implementation proceeds identically to pre-feature behavior

### Error Flows

- **UC-4.4-E1: lessons.md exists but Prevention Rules section is missing or malformed** — File structure unexpected
  1. The agent checks for `.claude/lessons.md` — the file exists
  2. The agent attempts to read the `## Prevention Rules` section
  3. The section header is missing or the file structure is malformed (e.g., the template was hand-edited incorrectly)
  4. The agent treats this as equivalent to an empty Prevention Rules section (UC-4.4-A2)
  5. The agent proceeds to the TDD flow without prevention rule context
  6. The agent optionally notes in its output that the Prevention Rules section could not be parsed

### Edge Cases

- **UC-4.4-EC1**: A prevention rule references a specific file path (`src/api/users.ts`) and this slice's `Files:` list contains that exact path. The rule is unambiguously relevant and is included in the slice context.
- **UC-4.4-EC2**: A prevention rule uses broad ALWAYS/NEVER phrasing with no file-specific reference (e.g., "ALWAYS check for null before dereferencing"). This rule is relevant to every slice. The agent includes it in context for all slices, treating broad rules as universally applicable.
- **UC-4.4-EC3**: The `## Prevention Rules` section has 10+ rules. The agent reads all of them (the section is always read in full per FR-1.8) and filters for relevance. Reading 10 rules is well within context budget; the bound is on the Lessons Log (5 recent entries), not on Prevention Rules.

### Data Requirements

- **Input**: `.claude/lessons.md` Prevention Rules section (read-only); this slice's `Files:` and `Changes:` fields
- **Output**: A set of relevant prevention rules held in active context during TDD execution (in-memory only)
- **Side Effects**: None — this is a read-only step. No files are modified during pre-flight prevention rule scanning.

---

## UC-4.5: Prevention Rules Inform Planning

**Actor**: Planner agent (invoked during `/bootstrap-feature` Step 5)
**Preconditions**:
- Phase 1 documentation is complete: PRD, use cases, architecture review, and QA test cases all exist
- `/bootstrap-feature` has invoked the planner agent to produce the implementation plan
- The planner has read the PRD, use cases, architecture review, and QA test cases
- `.claude/lessons.md` may or may not exist in the project

**Trigger**: The planner agent begins producing the implementation plan (after reading all required documents)

### Primary Flow (Happy Path)

1. The planner reads its document reading list: PRD, use cases, architecture review, QA test cases, scratchpad
2. The planner checks for `.claude/lessons.md` (existence guard)
3. The file exists — the planner reads the `## Prevention Rules` section
4. The planner scans all prevention rules for relevance to this feature's scope (files, technologies, patterns mentioned in the PRD and use cases)
5. One or more prevention rules are relevant
6. For each slice the planner defines, the planner checks whether any prevention rule applies to the files or patterns in that slice
7. For slices where a prevention rule is relevant, the planner adds an optional `Prevention:` sub-field to the slice definition listing the applicable rule(s)
8. For slices where no prevention rules are relevant, the `Prevention:` sub-field is omitted entirely
9. The planner produces the complete implementation plan with `Prevention:` sub-fields embedded where applicable
10. The `bootstrap-feature` Step 5 completes; the plan is available for developer review

**Postconditions**:
- The implementation plan contains `Prevention:` sub-fields on any slice where prevention rules apply
- Slices with no relevant prevention rules have no `Prevention:` sub-field (the field is optional)
- The planner has not created or modified `.claude/lessons.md` (read-only during planning)
- The plan's `Prevention:` notes are available to `implement-slice` pre-flight (UC-4.4) as additional context

### Alternative Flows

- **UC-4.5-A1: lessons.md does not exist during planning** — Backward compatibility, plan quality unchanged
  1. The planner checks for `.claude/lessons.md`
  2. The file does not exist (pre-dates this feature, or `--init-project` was not run)
  3. The planner skips the prevention rules reading step entirely
  4. The planner produces the implementation plan with no `Prevention:` sub-fields
  5. Plan quality is identical to pre-feature behavior (no degradation, no error)
  6. The developer can still provision `.claude/lessons.md` later with `--init-project`; future plans will include prevention rules

- **UC-4.5-A2: Prevention Rules section is empty** — File exists but no rules have been elevated yet
  1. The planner reads the `## Prevention Rules` section
  2. The section is empty (placeholder only)
  3. The planner finds no rules to consult
  4. All slices are produced without `Prevention:` sub-fields
  5. Plan quality is unchanged from pre-feature behavior

- **UC-4.5-A3: All prevention rules are relevant to all slices** — Broad rules that apply everywhere
  1. The planner reads prevention rules that use broad ALWAYS/NEVER phrasing
  2. The rules apply to all slices (no file-specific filtering needed)
  3. The planner adds the same `Prevention:` sub-field content to every slice
  4. The plan documents these as baseline expectations rather than slice-specific concerns

### Error Flows

- **UC-4.5-E1: Prevention rules reference deleted files or obsolete patterns** — Stale rules in the plan
  1. The planner reads a prevention rule that references a specific file path (e.g., `src/legacy/handler.ts`)
  2. The planner explores the codebase and finds the file no longer exists
  3. The planner does NOT include this stale rule in any slice's `Prevention:` sub-field
  4. The planner notes in its output that a stale prevention rule was encountered (file not found)
  5. This signals to the developer that the rule should be retired (per FR-1.7 retirement mechanism)

### Edge Cases

- **UC-4.5-EC1**: A prevention rule was elevated due to a past security finding (2-occurrence threshold for security). The planner includes this rule in the `Prevention:` sub-field of any slice that touches auth or data-handling code, even if the exact file path differs — security rules are treated as broadly applicable.
- **UC-4.5-EC2**: The plan has 9 slices and 3 prevention rules. The planner maps each rule to slices individually. Only 2 of the 9 slices touch files or patterns covered by the rules — only those 2 slices get `Prevention:` sub-fields.

### Data Requirements

- **Input**: `.claude/lessons.md` Prevention Rules section (read-only); all Phase 1 documents (PRD, use cases, architecture review, QA test cases); the project's file structure
- **Output**: Implementation plan with optional `Prevention:` sub-fields on relevant slices
- **Side Effects**: None — planning is read-only with respect to `.claude/lessons.md`. The plan document is written to the plan file; lessons.md is not modified.

---

## UC-4.6: Session-Start Lessons Review

**Actor**: Any Pipeline Agent starting a new session or running `/context-refresh`
**Preconditions**:
- A new Claude Code session has started (or `/context-refresh` has been invoked)
- The agent is reading the scratchpad per the MUST Read protocol in `src/rules/scratchpad.md`
- `.claude/lessons.md` may or may not exist

**Trigger**: The agent reaches the MUST Read step that instructs reading `.claude/lessons.md` Prevention Rules at session start

### Primary Flow (Happy Path)

1. The agent starts a new session and reads `.claude/scratchpad.md` (MUST Read protocol step 1)
2. The agent proceeds to the lessons MUST Read protocol step 2: "Read `.claude/lessons.md` Prevention Rules section at session start if the file exists"
3. The file exists — the agent reads the `## Prevention Rules` section in full
4. The agent also reads the 5 most recent entries from `## Lessons Log` (per FR-1.8 context budget)
5. The agent summarizes the relevant rules for the current feature context derived from the scratchpad:
   - Which prevention rules apply to the current feature's domain or files (if a current feature is active)
   - Which recent lessons (from the 5 most recent entries) are most relevant
6. The agent notes the relevant rules in its working context (in-memory, not written)
7. The agent proceeds with whatever task was requested, carrying the prevention rules in context

**Postconditions**:
- Prevention rules are active in the agent's context for the session
- The 5 most recent lesson entries have been reviewed
- The session proceeds with lesson-informed context
- `.claude/lessons.md` is not modified by session-start reading

### Alternative Flows

- **UC-4.6-A1: No current feature active** — Idle session with no in-progress feature
  1. The agent reads the scratchpad and finds `## Feature: none active` or `## Status: idle`
  2. The agent reads the `## Prevention Rules` section and 5 most recent lessons
  3. Without a current feature context, no slice-specific filtering is applied
  4. The agent notes the prevention rules generally (they will apply when the next feature starts)
  5. The session proceeds; prevention rules are available if a feature is begun

- **UC-4.6-A2: lessons.md does not exist** — Pre-feature project, backward compatibility
  1. The agent reaches the lessons MUST Read step
  2. The agent checks for `.claude/lessons.md` — the file does not exist
  3. The agent skips the step silently
  4. The session proceeds without prevention rule context
  5. No error is raised; behavior is identical to pre-feature sessions

### Error Flows

- **UC-4.6-E1: Lessons file has more than 50 entries** — Consolidation prompt
  1. During context-refresh (or session-start via `/context-refresh`), the agent reads the `## Lessons Log` section count
  2. The log exceeds 50 entries
  3. The agent still reads only the 5 most recent entries (context budget is not changed by the large log)
  4. The agent adds a consolidation prompt to its output: "Lessons Log has N entries (>50). Consider running consolidation before the next slice."
  5. The agent does NOT automatically consolidate during session-start (consolidation happens when writing a new lesson, per UC-4.1-EC3 and FR-1.10)
  6. The developer is informed so they can choose when to initiate consolidation

- **UC-4.6-E2: Context-refresh detects stale prevention rule** — Rule references a file that no longer exists
  1. During `/context-refresh`, the agent reads the `## Prevention Rules` section
  2. The agent inspects the codebase context (from scratchpad and plan) and notices a prevention rule references `src/legacy/auth.ts`
  3. The agent checks whether `src/legacy/auth.ts` exists in the codebase
  4. The file does not exist (it was deleted in a prior feature)
  5. The agent archives the stale prevention rule: moves it from `## Prevention Rules` to an `## Archived Rules` section within `.claude/lessons.md` with a note: "Archived [date] — referenced file no longer exists"
  6. The agent notes in its context-refresh output: "1 stale prevention rule archived (referenced file deleted)"
  7. The remaining prevention rules continue to apply

### Edge Cases

- **UC-4.6-EC1**: Session starts mid-feature (developer resumes work). The agent reads prevention rules AND the scratchpad to understand the current feature and wave/slice status. Prevention rules are filtered for relevance to the in-progress feature's files and patterns.
- **UC-4.6-EC2**: The 5 most recent lessons are all from the same root cause (the same mistake repeated 5 times). The agent recognizes the recurring pattern and notes it explicitly: "Warning: the 5 most recent lessons share the same root cause — this pattern should already be a prevention rule."

### Data Requirements

- **Input**: `.claude/lessons.md` Prevention Rules section (read in full) and 5 most recent Lessons Log entries; `.claude/scratchpad.md` for current feature context
- **Output**: Active prevention rule context for the session (in-memory); consolidation prompt if log >50 entries; stale rule archival note if a rule references a deleted file
- **Side Effects**: `.claude/lessons.md` may be modified if UC-4.6-E2 applies (stale rule archived). Otherwise, the file is read-only during session start.

---

## UC-4.1-A (Backward Compatibility): lessons.md Does Not Exist

**Actor**: Any Pipeline Agent or command that references `.claude/lessons.md`
**Preconditions**:
- A command or rule references `.claude/lessons.md` (any of: session-start, pre-flight check, post-commit lesson capture, Post-Gate Lesson Capture, context-refresh, planner reading list)
- `.claude/lessons.md` does not exist in the project (project was created before this feature, or `--init-project` was not run)

**Trigger**: The agent reaches any instruction that reads or writes `.claude/lessons.md`

### Primary Flow (Happy Path)

1. The agent reaches an instruction that reads or writes `.claude/lessons.md`
2. The instruction includes an existence guard: "if it exists" or "if the file exists"
3. The agent checks for the file — it does not exist
4. The agent skips the lessons step entirely, with no output note required (the skip is transparent for read steps)
5. For write steps (lesson capture), the agent may optionally note: "Lesson capture skipped — `.claude/lessons.md` not found"
6. The pipeline continues without interruption
7. The overall pipeline behavior is identical to pre-feature behavior: no lesson is captured, no prevention rules are consulted, no error is raised

**Postconditions**:
- The pipeline continues normally
- No error is raised, no lesson is captured
- Backward compatibility is fully preserved for projects without the file

### Edge Cases

- **UC-4.1-A-EC1**: A developer adds `.claude/lessons.md` manually mid-feature (by running `bash install.sh --init-project` during an in-progress feature). From the next slice onward, all lessons references will find the file and operate normally. Previously completed slices are not retroactively processed.
- **UC-4.1-A-EC2**: The existence guard instruction is accidentally omitted from one command file (AC-12 verification failure). The agent attempts to read a non-existent file, receives a "file not found" error, and treats it as equivalent to the existence-guard skip (Rule 1 auto-fix: treat missing file as empty). The pipeline continues; the missing guard is flagged in code review.

### Data Requirements

- **Input**: File system check for `.claude/lessons.md`
- **Output**: None (the step is silently skipped for reads; optionally noted for writes)
- **Side Effects**: None

---

## UC-4.8-P1: Lesson Capture During Parallel Wave (Orchestrator-Only Writes)

**Actor**: Orchestrator (`develop-feature` command) and parallel subagents (implement-slice instances)
**Preconditions**:
- `develop-feature` is executing a multi-slice parallel wave (2+ subagents running simultaneously)
- `.claude/lessons.md` exists in the project
- Subagents have been spawned with explicit instructions to skip Steps 6 and 7 (lesson capture and scratchpad update)

**Trigger**: One or more parallel subagents encounter a Trigger 1 (user correction) or Trigger 2 (repeated error) event during their slice execution, OR the post-wave result collection detects a Trigger 2 pattern across the wave

### Primary Flow (Happy Path) — Trigger 2 detected at wave level

1. `develop-feature` spawns parallel subagents for a multi-slice wave (e.g., 3 subagents for Slices 1, 3, 5)
2. Each subagent executes its TDD flow independently
3. Subagent for Slice 3 encounters a Rule 3 deviation (dependency conflict); it resolves it and continues
4. Subagent for Slice 5 also encounters a Rule 3 deviation (same category, different file); it resolves it and continues
5. Both subagents complete their slices and commit (each skips Steps 6-7 per parallel mode)
6. Subagents return their results to the orchestrator, including:
   - Success/failure status and commit hash
   - Any Trigger 1 corrections reported by the user during the subagent's slice
   - The deviation rule category and count for any Trigger 2 events within the subagent's slice
7. The orchestrator collects results from all subagents in the wave
8. The orchestrator performs post-wave Trigger 2 check: "Did the same deviation rule category fire in 2+ slices within this wave?"
9. Rule 3 fired in both Slice 3 and Slice 5 — the threshold is met at the wave level
10. The orchestrator writes a wave-level lesson to `## Lessons Log`:
    - Date in `YYYY-MM-DD` format
    - Trigger type: `Repeated Error`
    - What happened: Rule 3 fired in Slices 3 and 5, both involving dependency resolution in different files of the same module
    - What to do instead: the generalized prevention strategy
11. The orchestrator updates the scratchpad with wave results
12. The orchestrator proceeds to the next wave

**Postconditions**:
- Lesson entries written by the orchestrator after wave completion
- No subagent has written to `.claude/lessons.md` (subagent writes are explicitly prohibited)
- No file corruption from concurrent writes (only one writer at a time: the orchestrator post-wave)
- The scratchpad is updated by the orchestrator in the same post-wave step

### Alternative Flows

- **UC-4.8-P1-A1: Subagent receives a user correction during parallel execution** — Trigger 1 in a subagent context
  1. While subagents are executing in parallel, the user sends a correction message to one subagent (Slice 3)
  2. The subagent recognizes the Trigger 1 heuristic match
  3. The subagent does NOT write to `.claude/lessons.md` (parallel mode prohibits subagent writes)
  4. The subagent records the correction details internally and includes them in its result report to the orchestrator
  5. After the wave completes, the orchestrator reads the Trigger 1 report from the subagent's result
  6. The orchestrator writes the lesson entry to `.claude/lessons.md`
  7. The lesson is captured without any risk of concurrent file writes

### Error Flows

- **UC-4.8-P1-E1: Subagent attempts to write lessons.md despite parallel mode skip instruction** — Rule violation detected
  1. A subagent (incorrectly or due to a rule file bug) attempts to write to `.claude/lessons.md` during parallel execution
  2. The orchestrator's spawn prompt explicitly instructs: "Skip Steps 6 and 7 — do NOT write to lessons.md or scratchpad"
  3. If the write occurs anyway, the orchestrator detects a potential conflict during post-wave result collection (the file's modification time changed unexpectedly)
  4. The orchestrator notes the anomaly in its output but does not roll back the write (the lesson content itself is valid)
  5. The orchestrator proceeds to write its own post-wave lessons, taking care not to duplicate entries
  6. This is a process violation, not a data corruption event (the write itself does not corrupt the file — it may create a duplicate entry)

### Edge Cases

- **UC-4.8-P1-EC1**: All 3 subagents in a wave encounter Rule 3 deviations. The orchestrator writes a single wave-level lesson covering the pattern (not 3 individual lessons). One lesson per pattern per wave.
- **UC-4.8-P1-EC2**: A wave has 5 subagents; 2 report Trigger 1 corrections and 1 triggers Trigger 2 (same Rule category as a prior slice in this feature but from a different wave). The orchestrator writes separate lessons for the 2 Trigger 1 events and checks whether the Trigger 2 threshold is met across the entire feature (not just this wave).

### Data Requirements

- **Input**: Subagent result reports (success/failure, deviation rule events, user correction reports); current state of `.claude/lessons.md`; current date
- **Output**: Zero or more lesson entries written to `## Lessons Log` by the orchestrator post-wave
- **Side Effects**: `.claude/lessons.md` is written by the orchestrator (and only the orchestrator) after all subagents in the wave complete. No concurrent writes occur.

---

## UC-4.8-P2: Prevention Rule Reading During Parallel Wave (Read-Only, No Conflict)

**Actor**: Multiple parallel subagent instances of `implement-slice`
**Preconditions**:
- `develop-feature` is executing a multi-slice parallel wave
- `.claude/lessons.md` exists and has a populated `## Prevention Rules` section
- Each subagent has been spawned with the slice context and a skip instruction for writes (Steps 6-7)

**Trigger**: Each subagent begins its pre-flight checks and reaches check #5 (Prevention Rules scan)

### Primary Flow (Happy Path)

1. Three subagents are spawned simultaneously for Slices 1, 3, and 5
2. Each subagent independently begins its pre-flight checklist
3. Each subagent reaches pre-flight check #5 at approximately the same time
4. Each subagent independently reads the `## Prevention Rules` section of `.claude/lessons.md`
5. All three reads are concurrent — this is safe because reading is a non-destructive, non-exclusive operation
6. Each subagent filters the prevention rules for relevance to its own slice's `Files:` and `Changes:` fields
7. Each subagent holds its relevant prevention rules in its own independent context (no shared memory between subagents)
8. Each subagent proceeds to its TDD flow with its own prevention rule context
9. No write conflicts occur (all three reads are independent; no writes happen during pre-flight)

**Postconditions**:
- Each subagent carries relevant prevention rules in its own context
- `.claude/lessons.md` is not modified by any subagent during pre-flight
- Concurrent reads do not affect each other
- Prevention rule guidance influences each subagent's implementation independently

### Alternative Flows

- **UC-4.8-P2-A1: No prevention rules exist or no rules match any subagent's slice** — All subagents skip cleanly
  1. Each subagent reads the `## Prevention Rules` section
  2. The section is empty or no rules match any subagent's files/patterns
  3. All subagents proceed to TDD without prevention rule context
  4. Implementation proceeds identically to pre-feature behavior for all three slices

### Edge Cases

- **UC-4.8-P2-EC1**: Two subagents' slices both match the same prevention rule. Each subagent independently adds the same rule to its own context. This is correct behavior — each subagent independently applies the rule within its own slice scope.
- **UC-4.8-P2-EC2**: One subagent's slice has 3 matching prevention rules; another subagent's slice has 0. Each subagent uses only its own filtered rules. There is no rule-sharing mechanism between subagents; context isolation is maintained.

### Data Requirements

- **Input**: `.claude/lessons.md` Prevention Rules section (read-only, accessed concurrently by multiple subagents); each subagent's slice `Files:` and `Changes:` fields
- **Output**: Each subagent independently holds a filtered set of relevant prevention rules in its own context (in-memory only)
- **Side Effects**: None — concurrent reads of `.claude/lessons.md` are safe and leave the file unmodified.

---

## UC-4.9: Prevention Rule Elevation

**Actor**: Pipeline Agent (when writing lesson entries and assessing recurrence)
**Preconditions**:
- `.claude/lessons.md` exists with a populated `## Lessons Log`
- A lesson is about to be written (any trigger), and the agent reviews existing lessons to check for recurrence
- OR context-refresh is running and assessing which lessons should be elevated

**Trigger**: A new lesson is written, or context-refresh scans the log and identifies recurring patterns

### Primary Flow (Happy Path)

1. A new lesson entry is being added to `## Lessons Log`
2. Before writing the new entry, the agent scans existing lessons for the same root cause
3. The agent finds prior lesson entries describing the same error or correction pattern
4. The agent determines the recurrence count and the category of the lesson:
   - Security or data-integrity category: elevation threshold is 2 occurrences across features
   - General pattern: elevation threshold is 3 occurrences across features
5. The threshold is met (e.g., 3rd occurrence of a general pattern across 3 different features)
6. The agent creates a new entry in the `## Prevention Rules` section:
   - A concise rule title
   - The prevention heuristic in ALWAYS/NEVER/WHEN phrasing
   - A note of the recurrence count and date of elevation (e.g., "Elevated after 3 occurrences — 2026-05-19")
7. The agent writes the new lesson entry to `## Lessons Log` as usual
8. The elevated prevention rule is now available for future pre-flight reads (UC-4.4) and planning (UC-4.5)

**Postconditions**:
- A new prevention rule is present in the `## Prevention Rules` section
- The rule will be consulted in all future slice pre-flights and planning steps
- The recurrence pattern is captured at both the lesson level (individual entries in the log) and the prevention rule level (elevated rule in the rules section)

### Edge Cases

- **UC-4.9-EC1**: A security lesson recurs for the first time in a second feature (2 occurrences). It immediately elevates to a prevention rule — the lower threshold (2 vs. 3) for security and data-integrity lessons reflects their higher stakes.
- **UC-4.9-EC2**: A general pattern lesson recurs 3 times within a single feature (not across 3 features). The elevation threshold counts features, not total occurrences. Three occurrences within one feature count as 1 feature for elevation purposes (the lesson was already captured once for this feature in UC-4.2).

### Data Requirements

- **Input**: All existing lesson entries in `## Lessons Log`; the new lesson being added; recurrence categories (security/data-integrity vs. general)
- **Output**: A new entry in `## Prevention Rules` (if threshold met)
- **Side Effects**: `## Prevention Rules` section of `.claude/lessons.md` is modified when a rule is elevated.

---

## UC-4.10: Prevention Rule Retirement

**Actor**: Pipeline Agent running `/context-refresh` (or implicitly when writing a lesson and checking for stale rules)
**Preconditions**:
- `.claude/lessons.md` exists with one or more prevention rules in `## Prevention Rules`
- Either context-refresh is running, or the planner has noted stale rule references during planning (UC-4.5-E1)

**Trigger**: The agent scans prevention rules for retirement conditions during context-refresh (UC-4.6-E2) or as a planner side-note (UC-4.5-E1)

### Primary Flow (Happy Path)

1. The agent reads the `## Prevention Rules` section
2. For each prevention rule, the agent checks retirement conditions:
   - **Condition A**: The rule references a specific file or pattern that no longer exists in the project codebase
   - **Condition B**: The rule has not been triggered or demonstrably prevented a mistake in the last 10 consecutive features (based on lesson log dates and feature boundaries in the scratchpad)
3. A rule is found that satisfies Condition A (file deleted in a prior feature)
4. The agent moves the rule from `## Prevention Rules` to an `## Archived Rules` section at the bottom of `.claude/lessons.md`:
   - The rule text is preserved verbatim
   - A retirement note is appended: "Archived [date] — [reason: file no longer exists / 10 features without confirmation]"
5. The retirement is noted in the agent's context-refresh output or planning output

**Postconditions**:
- The retired rule is removed from `## Prevention Rules` and moved to `## Archived Rules`
- The rule is no longer consulted during pre-flight or planning
- The rule text is preserved in `## Archived Rules` for historical reference
- The `## Prevention Rules` section is shorter and more relevant

### Error Flows

- **UC-4.10-E1: Cannot determine 10-feature non-confirmation** — Scratchpad archive removed feature boundary history
  1. The agent attempts to check Condition B (10 features without confirmation)
  2. The scratchpad archive has removed historical feature entries; the 10-feature window cannot be reliably counted
  3. The agent does NOT retire the rule based on an uncertain count
  4. The rule remains in `## Prevention Rules`
  5. The agent notes in its output: "Could not verify 10-feature retirement condition for [rule] — rule retained"

### Edge Cases

- **UC-4.10-EC1**: A retired rule's file is recreated in a future feature. The agent does NOT automatically restore the archived rule. Restoration requires developer judgment (the developer can manually move the rule back if warranted).
- **UC-4.10-EC2**: A prevention rule is very broad (no file reference, ALWAYS/NEVER phrasing only). Condition A never applies (no file to check). Condition B applies only after 10 features. Broad rules retire more slowly than file-specific rules.

### Data Requirements

- **Input**: `## Prevention Rules` entries with their file/pattern references; current codebase file structure; lesson log dates and feature boundaries from scratchpad
- **Output**: Zero or more rules moved from `## Prevention Rules` to `## Archived Rules`
- **Side Effects**: `.claude/lessons.md` is modified when rules are retired (moved between sections within the file).
