# Use Cases: Pipeline Hardening

> Based on [PRD](../PRD.md) -- Section 1: Pipeline Hardening

---

## UC-1: Goal-Backward Verification

**Actor**: Developer running `/merge-ready`
**Preconditions**:
- Developer is on a feature branch (not `main`)
- All implementation slices are committed
- An implementation plan exists (in `.claude/scratchpad.md` or plan file) listing expected files and artifacts
- The project has production source files on disk

**Trigger**: Developer runs `/merge-ready`, which invokes the `verifier` agent as a gate between E2E Tests and Documentation Accuracy gates

### Primary Flow (Happy Path)

1. The `/merge-ready` command reaches the Verifier gate (Gate 5.5, after E2E Tests)
2. The `verifier` agent reads the implementation plan to determine expected files, routes, components, and data flow paths
3. **Level 1 -- File Existence**: The verifier checks that every file listed in the plan's `Files:` fields exists on disk. All files exist.
4. **Level 2 -- No Stubs/Placeholders**: The verifier scans all production code files (excluding test files and markdown) for TODO, FIXME, placeholder, stub, and "not implemented" markers. None found.
5. **Level 3 -- Wiring**: The verifier confirms that exports are imported where expected, routes are registered in the router, components are rendered in their parent, and middleware is applied to relevant endpoints. All wiring is correct.
6. **Level 4 -- Data Flow**: The verifier traces real data paths end-to-end (form submission reaches API handler, handler calls service, service calls data layer). All data flows are connected.
7. The verifier produces a structured report with PASS for all four levels
8. The `/merge-ready` command records the Verifier gate as PASS and proceeds to the next gate

**Postconditions**:
- Verifier gate shows PASS in the merge-ready output table
- No verifier findings block the merge

### Alternative Flows

- **UC-1-A1: Level 2 finds stubs or TODOs in production code** -- Level 1 passes, but Level 2 detects issues
  1. Steps 1-3 complete successfully (Level 1 PASS)
  2. Level 2 scan finds TODO, FIXME, placeholder, stub, or "not implemented" markers in production code files
  3. The verifier records each finding with the specific file path, line number, and the marker text found
  4. The verifier marks Level 2 as FAIL
  5. Levels 3 and 4 still execute (all levels run regardless of prior failures)
  6. The verifier produces a structured report with Level 2 FAIL and file:line references for each finding
  7. The `/merge-ready` command records the Verifier gate as FAIL
  8. The auto-fix protocol attempts to remove stubs by implementing the missing logic, then reruns the verifier gate

- **UC-1-A2: Level 3 finds unimported exports or unregistered routes** -- Levels 1-2 pass, but Level 3 detects wiring gaps
  1. Steps 1-4 complete successfully (Levels 1-2 PASS)
  2. Level 3 finds disconnected artifacts: an exported function not imported anywhere, a route handler not registered in the router, a component not rendered in any parent, or middleware not applied to endpoints that need it
  3. The verifier records each finding with the specific export/route/component name and where it should be wired
  4. The verifier marks Level 3 as FAIL with a list of disconnected artifacts
  5. Level 4 still executes
  6. The verifier produces a structured report listing each disconnected artifact
  7. The `/merge-ready` command records the Verifier gate as FAIL
  8. The auto-fix protocol attempts to wire the disconnected artifacts, then reruns the verifier gate

- **UC-1-A3: Level 4 finds hardcoded data where real data flow expected** -- Levels 1-3 pass, but Level 4 finds data flow issues
  1. Steps 1-5 complete successfully (Levels 1-3 PASS)
  2. Level 4 finds hardcoded values, mock data, or disconnected data paths where real end-to-end data flow is expected (e.g., a handler returns a hardcoded array instead of calling the service layer)
  3. The verifier records each finding with the specific file, the hardcoded value, and the expected real data source
  4. The verifier marks Level 4 as FAIL (best-effort, non-blocking)
  5. The verifier produces a structured report noting Level 4 failures are advisory
  6. The `/merge-ready` command records the Verifier gate result. Level 4 failures alone do not block the gate -- the gate reports WARN rather than FAIL when only Level 4 has findings
  7. The merge-ready output table shows the advisory findings for developer review

### Error Flows

- **UC-1-E1: No plan or scratchpad available to determine expected files** -- The verifier cannot find the implementation plan
  1. The verifier agent attempts to read the implementation plan from `.claude/scratchpad.md` and any plan files
  2. No plan is found, or the plan does not contain `Files:` fields listing expected artifacts
  3. The verifier reports "cannot determine expected artifacts -- skipping Level 1 (File Existence)"
  4. The verifier proceeds with Levels 2-4, which operate on the actual codebase without needing a plan reference
  5. The structured report shows Level 1 as SKIPPED with the reason, and Levels 2-4 with their actual results
  6. The gate result is determined by Levels 2-4 only

- **UC-1-E2: Project has no routes or components (library project)** -- The project is a library with no routing or UI framework
  1. The verifier runs Levels 1 and 2 normally
  2. Level 3 detects that the project has no router configuration, no component framework, and no middleware setup
  3. Level 3 adapts its checks to focus on exports/imports only: every exported symbol from new modules is imported somewhere, and barrel/index files re-export new public APIs
  4. Level 4 adapts to trace function call chains (caller invokes exported function, function processes data, function returns result) rather than HTTP request flows
  5. The structured report reflects the adapted checks and their results

### Edge Cases

- **UC-1-EC1**: Test files contain TODO or FIXME comments. Level 2 must exclude test files (files in `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`) from its scan. These markers are legitimate in test files for planned test expansion.
- **UC-1-EC2**: A file listed in the plan was intentionally deleted during implementation (the plan changed mid-feature). Level 1 flags it as missing. The developer resolves by updating the plan or confirming the deletion was intentional.
- **UC-1-EC3**: A re-export in a barrel file (index.ts) satisfies the "imported somewhere" check for Level 3, even if the barrel file itself is not consumed yet. The verifier must trace through barrel files to the actual consumer.
- **UC-1-EC4**: The project uses dynamic imports (`import()` or `require()`) that cannot be statically traced. Level 3 reports these as SKIPPED items with a note that dynamic imports require manual verification.

### Data Requirements

- **Input**: Implementation plan (from scratchpad or plan file) listing expected files and artifacts; the project's source code on disk
- **Output**: Structured verification report with PASS/FAIL/SKIPPED/WARN per level, and specific findings (file path, line number, description) for each failure
- **Side Effects**: None -- the verifier is read-only. No files are modified. Findings are reported to the `/merge-ready` command which may trigger auto-fix as a separate step.

---

## UC-2: Deviation Rules

**Actor**: Implementing agent (during `/implement-slice`) or quality-gate agent (during `/merge-ready`)
**Preconditions**:
- An implementation slice is in progress (agent is actively editing files, running typecheck, tests, or build)
- The error-recovery rules file (`src/rules/error-recovery.md`) contains the four deviation rules
- The retry budget for the current slice has not been exhausted (fewer than 3 Rule-3/Rule-4 retries consumed)

**Trigger**: A typecheck, test, build, code review, or security audit produces an error or finding during implementation

### Primary Flow (Happy Path) -- Rule 1: Auto-fix typo or import error

1. The agent runs a verification step (typecheck, test, or build) during `/implement-slice`
2. The verification fails with an error
3. The agent classifies the error as Rule 1: the error is a typo, missing import, wrong import path, or unused import
4. The agent fixes the error automatically (corrects the typo, adds the missing import, fixes the path, removes the unused import)
5. The agent does NOT count this fix against the retry budget (Rules 1 fixes are "free")
6. The agent does NOT log this fix in the scratchpad (it is a trivial correction)
7. The agent reruns the verification step
8. The verification passes
9. Implementation continues normally

**Postconditions**:
- The error is resolved
- The retry budget is unchanged
- No scratchpad entry is created for the fix
- Implementation proceeds to the next step

### Alternative Flows

- **UC-2-A1: Error is Rule 2 -- Missing validation or error handling** -- Code review or security audit flags a gap
  1. A code review or security audit finding flags missing input validation, missing error handling, or missing null checks
  2. The agent classifies the finding as Rule 2
  3. The agent adds the missing validation, error handling, or null check automatically
  4. The agent does NOT count this fix against the retry budget (Rule 2 fixes are "free")
  5. The agent notes the addition in `.claude/scratchpad.md` (e.g., "Added input validation for X endpoint per code review finding")
  6. The agent reruns the failed check
  7. The check passes
  8. Implementation continues

- **UC-2-A2: Error is Rule 3 -- Dependency conflict or config issue** -- Build fails due to environment or dependency problem
  1. A build or test run fails due to a missing dependency, wrong dependency version, or misconfigured environment variable
  2. The agent classifies the error as Rule 3
  3. The agent attempts resolution: installs the missing dependency, updates the version, or fixes the configuration
  4. This fix counts as 1 retry attempt against the 3-retry budget
  5. The agent documents the resolution in `.claude/scratchpad.md` (e.g., "Installed missing dependency `zod@3.22` -- retry 1/3")
  6. The agent reruns the verification
  7. The verification passes
  8. Implementation continues

- **UC-2-A3: Error is Rule 4 -- Architectural decision required** -- The error requires changing module boundaries or the public API
  1. A failure requires changing module boundaries, altering the public API surface, modifying database schemas beyond plan scope, or making a design tradeoff
  2. The agent classifies the error as Rule 4
  3. The agent STOPS implementation immediately
  4. The agent escalates to the user with:
     - A clear description of the decision needed
     - The options available (at least 2)
     - The tradeoffs of each option
  5. The agent waits for user input before proceeding
  6. This counts as 1 retry attempt against the budget
  7. The user selects an option or provides direction
  8. The agent implements the user's decision and continues

### Error Flows

- **UC-2-E1: Error does not clearly fit any rule** -- The error is ambiguous
  1. A verification step fails with an error that does not clearly match Rule 1 (typo/import), Rule 2 (validation), Rule 3 (dependency/config), or Rule 4 (architectural)
  2. The agent defaults to treating it as Rule 3 (auto-resolve with retry budget)
  3. The agent attempts to fix the root cause
  4. This counts as 1 retry attempt
  5. The agent documents the fix attempt in `.claude/scratchpad.md`
  6. If the fix succeeds, implementation continues
  7. If the fix fails and 3 retries are exhausted, the agent escalates to the user as if it were a Rule 4 situation (full context, options, tradeoffs)

- **UC-2-E2: Auto-fix introduces a new error** -- Fixing one error causes another
  1. The agent applies a Rule 1 or Rule 2 fix
  2. The subsequent verification reveals a NEW error that was not present before the fix
  3. The agent classifies the new error independently using the same deviation rules
  4. If the new error is Rule 1 or Rule 2, the agent fixes it (still "free", no retry cost)
  5. If the new error is Rule 3 or Rule 4, the retry budget applies from this point
  6. If a chain of fixes exceeds 3 total Rule-3/Rule-4 retries, the agent escalates to the user

### Edge Cases

- **UC-2-EC1**: Multiple errors appear simultaneously (e.g., 5 typecheck errors). The agent classifies each error independently. Rule 1 errors are fixed first as a batch (all free). Remaining errors are then addressed by their rule classification.
- **UC-2-EC2**: A Rule 1 fix (import correction) reveals that the imported module does not exist (Rule 3 -- missing dependency). The agent re-classifies and the Rule 3 fix counts against the retry budget.
- **UC-2-EC3**: Mid-slice verification (typecheck after every 3 file edits when 4+ files are touched) triggers an error. The deviation rules apply identically to mid-slice errors -- the same classification and budget rules govern mid-slice failures.
- **UC-2-EC4**: The retry budget is tracked per slice, not per verification step. If a slice consumes 2 retries on a typecheck failure and 1 retry on a test failure, the budget is exhausted (3/3) and the next failure escalates.

### Data Requirements

- **Input**: Error output from typecheck, test, build, code review, or security audit; the current retry count for this slice
- **Output**: Either a fixed codebase (for Rules 1-3) or an escalation message to the user (for Rule 4 or budget exhaustion)
- **Side Effects**: For Rule 2+, scratchpad is updated with what was fixed. For Rule 3, dependencies or config files may be modified. Retry counter is incremented for Rule 3 and Rule 4 fixes.

---

## UC-3: Executable Plan Format

### UC-3 (Plan Creation)

**Actor**: Planner agent creating an implementation plan during `/bootstrap-feature`
**Preconditions**:
- PRD, use cases, architecture review, and QA test cases all exist
- The planner agent has read the project's CLAUDE.md and explored the codebase
- The planner agent prompt (`src/agents/planner.md`) requires the executable plan format

**Trigger**: The planner agent begins producing the implementation plan as the final step of `/bootstrap-feature`

### Primary Flow (Happy Path)

1. The planner agent reads all prerequisite documents (PRD, use cases, architecture review, QA test cases)
2. The planner agent explores the codebase to identify existing files and patterns
3. For each slice (5-9 total), the planner produces:
   - **Files:** A list of exact file paths. For each path, the planner runs Glob to verify the file exists on disk.
   - **Changes:** Specific description of what changes in each file (e.g., "Add function `validateUserInput` that checks email format and returns `ValidationResult`" -- not "update user validation")
   - **Verify:** The exact shell command(s) to run for verification (e.g., `npm run typecheck && npm test -- --grep "validateUserInput"`)
   - **Done when:** A testable boolean condition (e.g., "`POST /api/users` with invalid email returns 400 with `{ error: 'Invalid email format' }`")
4. All existing file paths are confirmed via Glob. New files are marked with `[new]`.
5. The planner outputs the complete plan with all slices in the executable format

**Postconditions**:
- Every slice has all four fields (Files, Changes, Verify, Done when)
- Every existing file path has been verified via Glob
- New files are explicitly marked `[new]`
- Done-when conditions are testable boolean statements (not vague descriptions)
- The plan is ready for direct consumption by `/implement-slice`

### Alternative Flows

- **UC-3-A1: A file path does not exist yet (new file)** -- The slice creates a new file
  1. The planner determines that a slice requires creating a new file
  2. The planner marks the file path with `[new]` in the Files field (e.g., `src/agents/verifier.md [new]`)
  3. The Changes field describes what the new file should contain
  4. The planner does NOT run Glob for `[new]` files (it would fail)
  5. The plan is valid with `[new]` markers

- **UC-3-A2: Implementing agent reads plan fields directly** -- `/implement-slice` consumes the executable plan
  1. The `/implement-slice` command begins for a specific slice
  2. The implementing agent reads the slice's `Files:` field to know exactly which files to modify or create
  3. The implementing agent reads the `Changes:` field to know exactly what to change in each file
  4. The implementing agent does NOT re-interpret or restate the slice in prose -- it follows the structured fields directly
  5. After implementation, the agent runs the exact command(s) from the `Verify:` field
  6. The agent checks the `Done when:` condition to confirm the slice is complete

- **UC-3-A3: Slice's Verify command fails after implementation** -- Verification reveals issues
  1. The implementing agent completes code changes for a slice
  2. The agent runs the command(s) from the slice's `Verify:` field
  3. The verification command fails (typecheck error, test failure, build error)
  4. The agent applies the deviation rules (UC-2) to classify and handle the error
  5. After fixing, the agent reruns the `Verify:` command
  6. If the verify command passes and the `Done when:` condition is met, the slice is complete

### Error Flows

- **UC-3-E1: Planner cannot determine exact verification command** -- The project setup is unclear or the slice involves manual verification
  1. The planner cannot determine a concrete shell command for a slice's verification (e.g., the slice involves visual UI changes with no automated test)
  2. The planner sets the `Verify:` field to "Manual verification:" followed by specific what-to-check instructions (e.g., "Manual verification: Open `/dashboard` in browser. Confirm the chart renders with sample data and the legend shows all 3 series.")
  3. The `Done when:` field still contains a testable condition, even if verification is manual
  4. During `/implement-slice`, the implementing agent notes that manual verification is required and reports the check instructions to the developer

### Edge Cases

- **UC-3-EC1**: A Glob check during planning reveals that a file the planner expected to exist has been deleted or moved since the codebase was last explored. The planner updates its plan to reflect the actual file location or marks it as `[new]`.
- **UC-3-EC2**: A slice's `Verify:` command references a test file that does not exist yet because it will be created by the `test-writer` agent during implementation. This is valid -- the verify command runs AFTER tests are written and implementation is complete.
- **UC-3-EC3**: The `Done when:` condition involves checking the response of a running server, but the project has no server (e.g., this SDLC project is markdown-only). The planner adapts: `Done when:` conditions for markdown projects reference file existence, content checks via Grep, or structural validation (e.g., "Grep for 'Level 1' in `src/agents/verifier.md` returns at least 1 match").

### Data Requirements

- **Input**: PRD requirements, use-case scenarios, QA test cases, architecture review verdict, project codebase (file system)
- **Output**: Implementation plan with 5-9 slices, each containing Files, Changes, Verify, and Done-when fields
- **Side Effects**: None during planning. The plan is a document consumed by `/implement-slice`. File system is read (via Glob) but not modified.

---

## UC-4: Scope Reduction Detection

**Actor**: Plan Critic (launched as a subagent during plan review)
**Preconditions**:
- An implementation plan has been written by the planner agent
- The PRD (`docs/PRD.md`) exists with clearly defined in-scope requirements
- The Plan Critic prompt in `src/claude.md` includes the Scope Reduction Detection check

**Trigger**: The Plan Critic is spawned to review the implementation plan (during the mandatory critic pass before plan approval)

### Primary Flow (Happy Path)

1. The Plan Critic reads the implementation plan (all slice descriptions, done-conditions, and implementation notes)
2. The critic scans for hedging language: "v1", "basic version", "simplified", "placeholder", "for now", "future enhancement", "out of scope for now", "minimal implementation", "stubbed out", "hardcoded for now"
3. No hedging language is found in any slice description, done-condition, or implementation note
4. The critic produces no Scope Reduction findings
5. The FINDINGS section of the critic's output does not contain any "Scope Reduction" category items

**Postconditions**:
- The plan passes the Scope Reduction Detection check
- No MAJOR findings with category "Scope Reduction" are generated
- The plan proceeds through the rest of the critic's checks

### Alternative Flows

- **UC-4-A1: Hedging language found for an in-scope PRD requirement** -- The plan silently reduces scope
  1. The critic scans slice descriptions, done-conditions, and implementation notes
  2. The critic finds hedging language (e.g., "basic version of the notification system" or "hardcoded for now, will add dynamic lookup later")
  3. The critic cross-references the hedged item with the PRD requirements
  4. The PRD marks the feature as in-scope (it is not deferred, not phased, not marked as a future enhancement)
  5. The critic generates a MAJOR finding with:
     - Category: "Scope Reduction"
     - The specific hedging phrase found (verbatim quote)
     - The slice number and field where it appears
     - The PRD requirement it violates (with requirement ID or section reference)
  6. The finding is included in the FINDINGS section of the critic's output
  7. The plan author must address the finding: either implement the full scope or get PRD approval to reduce scope

- **UC-4-A2: Hedging language found but PRD explicitly marks it as phased** -- Intentional scope boundary
  1. The critic finds hedging language in a slice (e.g., "v1 of the reporting module")
  2. The critic cross-references with the PRD
  3. The PRD explicitly marks this feature as phased, deferred, or out-of-scope for the current iteration (e.g., "Phase 2: Advanced reporting -- not in scope for this release")
  4. The critic does NOT generate a Scope Reduction finding -- the hedging is intentional and PRD-aligned
  5. The critic may optionally note in VERIFIED that scope boundaries match the PRD

### Error Flows

- **UC-4-E1: Hedging language appears in risk/mitigation sections** -- Appropriate context for cautious language
  1. The critic finds hedging-like language in the plan's risk assessment, mitigation strategies, or dependency notes (e.g., "If the external API is unavailable, a simplified fallback will be used")
  2. The critic recognizes that risk/mitigation sections legitimately use cautious language to describe contingency plans
  3. The critic does NOT generate a Scope Reduction finding for hedging language in risk, mitigation, or dependency sections
  4. Only slice descriptions, done-conditions, and implementation notes are subject to scope reduction scanning

### Edge Cases

- **UC-4-EC1**: A slice's done-condition says "basic validation is in place" but the PRD requires comprehensive validation. This is a scope reduction. The critic flags it as MAJOR even though "basic" might seem like a reasonable implementation choice -- the PRD defines the expected scope, not the implementer.
- **UC-4-EC2**: The phrase "v1" appears in a file path (e.g., `src/api/v1/routes.ts`). This is NOT hedging language -- it is a versioned API path. The critic must distinguish between hedging phrases in natural language descriptions and technical identifiers in file paths or code references.
- **UC-4-EC3**: A slice says "placeholder for future expansion" but refers to an extension point architecture pattern (e.g., plugin hooks), not a missing implementation. The critic cross-references with the PRD: if the PRD only asks for the extension mechanism (not the extensions themselves), this is not scope reduction.
- **UC-4-EC4**: The hedging language list is not exhaustive. The critic must also flag semantically equivalent phrases not on the list, such as "bare minimum", "just enough to", "quick and dirty", "temporary solution", or "will revisit" -- if they appear in slice descriptions or done-conditions and reduce in-scope PRD requirements.

### Data Requirements

- **Input**: The implementation plan (all slices with descriptions, done-conditions, and notes); the PRD (`docs/PRD.md`) with in-scope requirement definitions
- **Output**: Zero or more MAJOR findings with category "Scope Reduction", each containing the hedging phrase, slice location, and violated PRD requirement
- **Side Effects**: None -- the critic is read-only. Findings are reported to the plan author who must address them before the plan is approved.
