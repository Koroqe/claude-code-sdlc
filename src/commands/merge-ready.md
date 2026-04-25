# Command: Merge Ready

Run a full quality gate before merge. All checks must pass.

## Pre-flight: Changelog Sync (safety net — NOT a gate)

Before Gate 0 runs, delegate to `changelog-writer` with no arguments beyond CWD as a silent safety-net sync (per FR-4.4). This is NOT a new quality gate — it has no pass/fail verdict, does not appear in the Gate count, and does NOT block merge readiness. The gate list (Gate 0 through Gate 9) now includes Gate 9 release packaging per PRD Section 6 / FR-7.1. The pre-flight `changelog-writer` sync still runs before Gate 0 and is NOT itself a gate.

Behavior:
- If the agent returns `no-op: not configured` (SDLC repo) or `no-op: already in sync` (common case — previous hooks kept content in sync), proceed silently to Gate 0 with no extra output.
- If the agent returns `action taken: rewrote` (uncommon — e.g., PRD edited since last sync), surface the diff summary in the merge-ready output before proceeding to Gate 0.
- If the agent fails for any reason, log the error and proceed to Gate 0 per FR-4.5. The pre-flight sync cannot fail `/merge-ready`.

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
Delegate to `verifier` agent:
- [ ] Level 1 — File Existence: all planned files exist on disk
- [ ] Level 2 — No Stubs/Placeholders: no TODO/FIXME/placeholder markers in production code
- [ ] Level 3 — Wiring: exports imported, routes registered, components rendered, middleware applied
- [ ] Level 4 — Data Flow (advisory): real data paths connected end-to-end

Note: Level 4 failures produce WARN, not FAIL — they are advisory and do not block merge.

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

## Gate 9: Release Packaging

Delegate to the `release-engineer` agent. Gate 9 packages the release in suggest-only mode — it never runs `git push`, `git tag`, `gh release create`, `npm publish`, `cargo publish`, or `pypi upload`.

**Invocation order:** Gate 9 runs AFTER the pre-flight `changelog-writer` sync (which precedes Gate 0) AND AFTER all of Gate 0 through Gate 8 have completed. Gate 9 is the LAST gate in the merge-ready sequence.

**6-step sequence performed by `release-engineer`:**

1. **Self-check** — read CHANGELOG.md `[Unreleased]`. If empty across all six Keep a Changelog categories (Added / Changed / Deprecated / Removed / Fixed / Security), return `no-op: no unreleased changes` and report Gate 9 status as **SKIPPED** (per FR-7.2). STOP — do not run steps 2-6.
2. **Version detection** — resolve current version per FR-3.1 priority chain: `package.json` → `pyproject.toml` → `Cargo.toml` → `VERSION` → latest `.git/refs/tags/v*.*.*` (with `.git/packed-refs` fallback) → `0.1.0`. Apply `./CLAUDE.md` then `.claude/CLAUDE.md` `Version source:` overrides.
3. **Semver bump** — compute next version from `[Unreleased]` content per FR-4.1 (Removed → major; Added/Changed → minor; Deprecated/Fixed/Security → patch) with negation skip (`non-breaking`, `not breaking`) and pre-1.0 override (MAJOR=0 demotes major to minor).
4. **CHANGELOG rewrite** — rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, insert a fresh empty `[Unreleased]` block above it, preserve all prior versioned sections byte-for-byte.
5. **Release-notes file** — write the renamed section's body (no heading) to `.claude/release-notes-X.Y.Z.md`. Overwrite if it exists. Do not delete prior release-notes files. Do not commit.
6. **CI/CD provisioning** — detect existing GitHub Actions release workflow via multi-pattern (P1 tag trigger + P2 correct `body_path` + P3 inline extraction). When ABSENT, generate `.github/workflows/release.yml` with the HTML-comment marker, `Strip v prefix from tag` step, two-step `body_path: .claude/release-notes-${{ steps.ver.outputs.version }}.md`, and `softprops/action-gh-release@v2`.
7. **Structured summary** — emit a 10-section labeled summary (per FR-6.1) with a fenced `Commands to run` block (per FR-6.5) listing the exact `git add` / `git commit` / `git tag` / `git push` / `gh release create` commands the user runs themselves.

**Conditional skip:** when step 1 detects an empty `[Unreleased]` (all six Keep a Changelog categories empty), Gate 9 reports **SKIPPED** instead of PASS/FAIL. SKIPPED is not a failure — it does not block merge readiness.

**One-pass-per-merge-ready guarantee:** Gate 9 invokes `release-engineer` exactly once per `/merge-ready` run. Re-running `/merge-ready` after a SKIPPED Gate 9 still invokes the agent once (which will SKIP again until `[Unreleased]` is populated). The agent's self-check makes re-invocation idempotent — empty `[Unreleased]` always returns `no-op: no unreleased changes`.

**Isolation:** a Gate 9 FAIL does NOT cause Gates 0-8 to be re-evaluated. Earlier gates retain their PASS/FAIL/WARN/N/A verdicts from their original runs. Only Gate 9 is re-attempted on retry.

- [ ] `release-engineer` self-check (step 1) executed
- [ ] Version source detected (step 2) or SKIPPED
- [ ] Semver bump computed (step 3) or SKIPPED
- [ ] CHANGELOG rewritten with date stamp (step 4) or SKIPPED
- [ ] `.claude/release-notes-X.Y.Z.md` written (step 5) or SKIPPED
- [ ] `.github/workflows/release.yml` provisioned or detected (step 6) or SKIPPED
- [ ] Structured 10-section summary emitted (step 7) or SKIPPED

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
| Goal-Backward Verification | PASS/FAIL/WARN | WARN = Level 4 advisory only |
| Documentation Accuracy | PASS/FAIL | |
| UI/UX | PASS/FAIL/N/A | |
| Release Packaging | PASS/FAIL/SKIPPED | Empty [Unreleased] -> SKIPPED |

**Overall: MERGE READY / NOT MERGE READY**
```

SKIPPED = Gate 9 reports SKIPPED when the project's CHANGELOG.md [Unreleased] section is empty across all six Keep a Changelog categories per FR-7.2.

If any gate FAILS: list specific fixes needed with file paths and priority.

## Auto-Fix Protocol

If any gate FAILS:
1. Identify the specific issues from the agent's output
2. Fix each issue in the codebase
3. Rerun ONLY the failed gate(s)
4. Repeat until all gates pass OR 3 fix attempts exhausted
5. If still failing after 3 attempts: report as NOT MERGE READY with specific blockers

Do NOT just report failures — attempt to fix them first.
