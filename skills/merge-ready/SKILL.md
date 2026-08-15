---
description: Run all quality gates before merge — git hygiene, documentation completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy and UI/UX — then write the changelog entry.
argument-hint: "[gate name to rerun]"
arguments: [gate]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: Merge Ready

Run a full quality gate before merge. All checks must pass.

## Arguments

`$gate` (also available as `$ARGUMENTS`) optionally names a single gate to rerun. When empty, run every gate in order.

**Literal-token flag rule:** a documented flag is active ONLY if its literal token appears in `$ARGUMENTS`. Never infer that a flag was passed because the documentation describes it.

## Gate 0: Git Hygiene (must pass before anything else)
- [ ] On feature branch (not `main`)
- [ ] Working tree clean (`git status`)
- [ ] Branch up to date with base
- [ ] All slice commits present

## Gate 1: Documentation Completeness
Verify all agency deliverables exist:
- [ ] `docs/PRD.md` has a section for this feature
- [ ] `docs/use-cases/<feature>_use_cases.md` exists with all scenario types
- [ ] `docs/qa/<feature>_test_cases.md` exists and maps to use-case scenarios
- [ ] All use-case scenarios (UC-X, UC-X-A, UC-X-E1) have corresponding test cases

## Gate 2: Code Review
Delegate to `code-reviewer` agent:
- [ ] Security: inputs validated, no raw queries, no leaked secrets
- [ ] Architecture: project conventions followed (consult CLAUDE.md)
- [ ] Quality: proper types, no dead code, error handling present
- [ ] Test coverage: new behavior has tests

## Gate 3: Security Audit
Delegate to `security-auditor` agent:
- [ ] No hardcoded secrets or tokens in source
- [ ] API routes validate input
- [ ] Protected endpoints use auth middleware
- [ ] Error responses don't leak internals

## Gate 4: Build Verification
Delegate to `build-runner` agent:
- [ ] Typecheck passes
- [ ] All tests pass
- [ ] Build succeeds

## Gate 5: E2E Tests (if user-facing changes)
Delegate to `e2e-runner` agent:
- [ ] E2E tests reference use-case scenarios from `docs/use-cases/`
- [ ] Critical user flows pass (primary flows from use cases)
- [ ] Error flows tested
- [ ] Data flow chains work end-to-end

## Gate 6: Goal-Backward Verification

**Before delegating**, run `date -u +'%Y-%m-%d %H:%M'` and note the result. The `verifier` agent has
no `Bash` tool and therefore no clock — if you do not supply the timestamp, it cannot invent one and
the report will carry `generated_at_note` instead.

Delegate to `verifier`, stating **both** of these verbatim in the prompt:
- the **feature slug** (the one used for `docs/use-cases/<slug>_use_cases.md`)
- `generated_at` — the `date -u` output you just captured

- [ ] Level 1 — File Existence: all planned files exist on disk
- [ ] Level 2 — No Stubs/Placeholders: no BLOCKER-tier markers in production code
- [ ] Level 3 — Wiring: exports imported, routes registered, components rendered, middleware applied
- [ ] Level 4 — Data Flow: at least one real path exercised, not merely wired

`verifier` writes `docs/verification/<feature-slug>.md` and returns one of four verdicts.

**Freshness check — the report must be from this run.** After delegation, re-read the report's
frontmatter and confirm `generated_at` equals, verbatim, the timestamp you supplied a moment ago. If
it differs, is absent, or carries `generated_at_note` when you did supply one, the file on disk is
not this run's output — treat it as `UNCERTAIN` and never as its claimed verdict. This is what stops
a repository from committing its own `docs/verification/<slug>.md` reading
`verdict: VERIFIED, passed: true` and skipping the gate entirely.

Note: a Level 4 gap does not by itself produce `FAILED` — but it is not advisory either. It produces
`PRESENT_BEHAVIOR_UNVERIFIED`, which is **not a pass**: the code is present and correctly wired, and
nothing has demonstrated it runs.

**Gate 6 is `NOT MERGE READY` for any verdict other than `VERIFIED` with `passed: true`** — that
includes `PRESENT_BEHAVIOR_UNVERIFIED`, `FAILED` and `UNCERTAIN`.

## Gate 7: Documentation Accuracy
Delegate to `doc-updater` agent:
- [ ] `CLAUDE.md` is accurate if structure/commands/env vars changed
- [ ] PRD section matches implementation
- [ ] Use cases match actual behavior

## Gate 8: UI/UX (if user-facing changes)
- [ ] Visual consistency with project's design system
- [ ] All component states (loading, error, empty, success)
- [ ] Responsive behavior
- [ ] User feedback for actions (toasts, indicators)

## Output Format

```
## Merge Ready Check

| Gate | Status | Notes |
|------|--------|-------|
| Git Hygiene | PASS/FAIL | |
| Documentation Completeness | PASS/FAIL | |
| Code Review | PASS/FAIL | |
| Security Audit | PASS/FAIL | |
| Build Verification | PASS/FAIL | |
| E2E Tests | PASS/FAIL/N/A | |
| Goal-Backward Verification | VERIFIED/PRESENT_BEHAVIOR_UNVERIFIED/FAILED/UNCERTAIN | only VERIFIED with `passed: true` permits merge |
| Documentation Accuracy | PASS/FAIL | |
| UI/UX | PASS/FAIL/N/A | |

**Overall: MERGE READY / NOT MERGE READY**
```

If any gate FAILS: list specific fixes needed with file paths and priority.

## Auto-Fix Protocol

If any gate FAILS:
1. Identify the specific issues from the agent's output
2. Fix each issue in the codebase
3. Rerun ONLY the failed gate(s)
4. Repeat until all gates pass OR 3 fix attempts exhausted
5. If still failing after 3 attempts: report as NOT MERGE READY with specific blockers

Do NOT just report failures — attempt to fix them first.

## Finalization: Changelog Entry

This step records a changelog entry once the feature is cleared for merge.

**When it runs:**
- Runs ONLY after all gates report PASS and the overall result is **MERGE READY**.
- Does NOT run when the overall result is **NOT MERGE READY**. Skip it entirely in that case.

**What it is NOT:**
- This is explicitly NOT a numbered quality gate. It does NOT appear in the gate PASS/FAIL table.
- It is NOT subject to the Auto-Fix Protocol rerun loop above. There is nothing to "rerun" or "fix to PASS" here — it is a post-success finalization action only.

**Steps:**
1. Retrieve the real UTC timestamp by running the command `date -u +'%Y-%m-%d %H:%M'`. NEVER invent, estimate, or hardcode this value — always use the actual command output.
2. Apply the idempotency guard before writing: if an entry for the same feature name already exists under today's date, update it in place — do NOT create a duplicate entry.
3. Delegate the actual file write to the `doc-updater` agent. It writes one changelog entry following the changelog rule (`changelog.md`) with these fields:
   - **Feature name**
   - **UTC time** (from the `date -u` command above)
   - **Summary** — non-technical, plain-language description for end users
   - **Details** — technical notes, capped at ≤500 characters
   - Entries are day-grouped, newest-first.

**Failure handling:**
- If the `doc-updater` agent fails to write the entry, surface it as a **WARNING**. A changelog write failure does NOT fail the merge — the merge remains MERGE READY.
