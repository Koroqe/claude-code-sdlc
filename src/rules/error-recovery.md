# Error Recovery Rules

## Deviation Rules

When you encounter an error during implementation, classify it before acting. Each rule defines what you can fix autonomously vs. what requires escalation.

### Rule 1 — Auto-Fix (Free)

Typos, import errors, and syntax issues. Fix immediately without counting against retry budget.

**Examples:**
- `Cannot find module './userService'` — wrong path, should be `'./services/userService'`
- `'UserType' is declared but never used` — remove unused import
- Missing semicolons, mismatched brackets, misspelled identifiers
- Wrong casing in import paths on case-sensitive filesystems

**Action:** Fix and continue. No scratchpad note needed. No retry cost.

### Rule 2 — Auto-Add (Free)

Missing validation, error handling, or null checks required for correctness. Add them without counting against retry budget.

**Examples:**
- Code review flags missing input validation on an API endpoint — add the validation
- Security audit flags missing auth middleware on a protected route — add it
- A function can receive null but doesn't handle it — add null check
- Missing try/catch around an async operation that can throw

**Action:** Fix, note what was added in `.claude/scratchpad.md`, continue. No retry cost.

### Rule 3 — Auto-Resolve (Costs 1 Retry)

Dependency conflicts, version mismatches, and configuration issues blocking progress. Resolve autonomously but each attempt costs 1 retry.

**Examples:**
- Package version conflict preventing install — resolve the version
- Missing environment variable causing runtime error — add to .env.example and document
- Config file pointing to wrong path or port — fix the config
- Test fixture using outdated schema — update fixture to match current schema

**Action:** Resolve, document the resolution in `.claude/scratchpad.md`, continue. Costs 1 retry attempt.

### Rule 4 — Escalate (Stop)

Architectural decisions, new dependencies, API contract changes, or schema migrations. Stop and ask the user.

**Examples:**
- Fix requires adding a new npm package or external dependency
- Fix requires changing a public API contract or database schema
- Fix requires restructuring module boundaries or moving files across layers
- Fix requires choosing between multiple valid architectural approaches

**Action:** Stop implementation. Present to user: what decision is needed, what the options are, and the tradeoffs of each. This counts against retry budget.

## Retry Budget

- Maximum **3 retries per slice** (not per verification step)
- Rules 1-2 are free — they do not consume retries
- Rules 3-4 consume 1 retry each
- After 3 retries exhausted: document the blocker in `.claude/scratchpad.md` and report to user

## Error Classification

- **Ambiguous errors** that don't clearly fit any rule: default to Rule 3 (auto-resolve with retry cost)
- **Cascading errors** (fix introduces a new error): classify the new error independently under its own rule
- **Re-classification**: if a Rule 1 fix reveals a deeper issue (e.g., fixing an import path reveals the module doesn't exist), the deeper issue is classified under its own rule
- **Batch Rule 1 fixes first**: when multiple errors appear, fix all Rule 1 errors before addressing higher-rule errors

## General Principles

- Do NOT stop at the first error — attempt to fix autonomously
- Do NOT just report failures — attempt to fix them first
- If a code review or security audit finds issues: fix them before proceeding (classify each issue under the appropriate rule)

## Deliberate Mode — Post-Error Slowing (neuroscience: anterior cingulate cortex)

In neuroscience, the brain's anterior cingulate cortex (ACC) responds to errors by slowing the next decision — this is **post-error slowing**. The next response after a mistake is measurably more careful: smaller scope, more verification, less reliance on automatic patterns. The agent pipeline implements the analogue explicitly.

**Trigger condition.** Deliberate mode activates on the iteration AFTER any of these signals:

- a `/qa-cycle` iteration ended in FAIL and the implementer is being re-spawned (covered in `src/commands/qa-cycle.md` Step 3)
- a `verifier` Level-3.5 prediction-error FAIL surfaced large delta (covered in `src/agents/verifier.md`)
- a `build-runner` returned non-zero on a slice the implementer just committed
- the implementer's previous slice exhausted ≥ 2 retry attempts before passing

**Deliberate-mode directives** (applied to the next implementer spawn or the next implementation step):

- **Read before edit, always.** Re-read every file you intend to edit. Do NOT rely on memory of earlier reads — the prior iteration may have invalidated your mental model. This is non-negotiable in deliberate mode even for files you read 5 minutes ago.
- **Smaller diff target.** Aim for ≤ 50% of the failed iteration's line count. If you cannot, that is a load-bearing signal that the fix is mis-scoped — surface it under `### Inbound validation` or BLOCKED rather than continuing.
- **Pre-flight typecheck mandatory.** Run the project's typecheck command BEFORE committing, not just after. Catch errors before they enter the iteration history.
- **No adjacent refactors.** Apply exactly the fix directives. Do NOT take the opportunity to refactor adjacent code, even if it looks like it needs work. Scope discipline matters here — adjacent changes mask the actual fix.
- **No new abstractions.** Do not introduce factories / adapters / wrappers / new dependencies / new patterns in deliberate mode. Use the most direct expression of the fix. If a new abstraction is genuinely needed, surface it for the planner's next pass — not for this one.
- **Repeat-edit detection.** If you find yourself making the same edit to the same file lines that the previous iteration made, STOP. Report BLOCKED with the diff history attached. This is the sunk-cost circuit breaker working — `/qa-cycle` will pause and ask the human.

**Why this exists.** Without deliberate mode, the agent's default is to repeat its last approach on the next try — sometimes with a small variation, often producing the same failure. Deliberate mode forces a structural change in how the next iteration is attempted: smaller scope, more verification, less automatic pattern-execution. The neuroscience analogue is exact — humans who skip post-error slowing make the same mistake again at measurably higher rates.

**Deliberate-mode exits** when:

- The deliberately-scoped iteration passes (build / qa-cycle / verifier — whichever triggered).
- The implementer surfaces BLOCKED with structural reasoning (the fix-directive is mis-scoped; the human must reconcile).
- 3 consecutive deliberate-mode iterations on the same slice without convergence — the sunk-cost circuit breaker fires and pauses for human input.

## Mid-Slice Verification

When a slice requires editing 4 or more files:
- Run the project's typecheck command after every 3 file edits before continuing
- If typecheck fails mid-slice: fix the type errors immediately before editing more files
- This prevents cascading errors that are harder to diagnose at end-of-slice verification

For slices touching 3 or fewer files: end-of-slice verification is sufficient.

Deviation rules apply identically to errors found during mid-slice verification.

## Parallel Wave Execution

When multiple slices execute in parallel (same wave, different subagents):

### Independent Retry Budgets
- Each subagent has its own 3-retry budget, tracked independently
- One subagent exhausting its retries does NOT affect siblings
- Deviation rules (1-4) apply identically within each subagent
- Mid-slice verification applies identically within each subagent

### Failure Isolation
- A failing subagent does NOT cause other subagents in the wave to stop — they continue independently
- File conflicts cannot occur because wave assignment guarantees exclusive file ownership per wave
- Each subagent commits only its own files — successful commits from siblings are preserved, never rolled back

### Post-Wave Result Collection
After all subagents in a wave complete, the orchestrator collects results and takes action:

- **All succeeded** → update scratchpad, proceed to next wave
- **Some failed** → report failures with slice numbers, error categories (per deviation rules), and retry counts. Present escalation options:
  1. **Retry** — re-run failed slice(s) only with fresh retry budget
  2. **Continue** — proceed to next wave, address failures later
  3. **Abort** — stop implementation, report as blocker
- **All failed** → report as blocker, stop and ask user

### Rule 4 in Parallel Mode
When a subagent encounters a Rule 4 escalation (architectural decision needed), it returns the escalation context to the orchestrator (decision needed, options, tradeoffs). The orchestrator presents it during post-wave result collection — the decision is not made mid-wave.
