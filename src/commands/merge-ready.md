# Command: Merge Ready

Run a full quality gate before merge. All checks must pass.

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

## Gate 6: Documentation Accuracy
Delegate to `doc-updater` agent:
- [ ] `CLAUDE.md` is accurate if structure/commands/env vars changed
- [ ] PRD section matches implementation
- [ ] Use cases match actual behavior

## Gate 7: UI/UX (if user-facing changes)
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
