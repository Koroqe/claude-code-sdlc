# Command: Merge Ready

Run a full quality gate before merge. All checks must pass.

## Pre-requisite: `/qa-cycle` must have passed

Before invoking `/merge-ready`, the user (or `/develop-feature` Phase 2.75) MUST have run `/qa-cycle` to completion with verdict PASS. The qa-engineer agent's strict evidence-gathering pass — Playwright MCP screenshots, console logs, network responses, visual-defect flagging — is the load-bearing UX check. `/merge-ready` Gate 5 (E2E tests via `e2e-runner`) is the code-authoring check; it does NOT inspect screenshots visually and does NOT flag visual defects beyond what its assertions explicitly check.

If `.claude/qa-evidence/iter-<N>/` is missing for the current feature, treat this as a hard pre-requisite failure: `/merge-ready` reports `NOT MERGE READY — run /qa-cycle first` and exits before Gate 0.

## Pre-flight: Changelog Sync (safety net — NOT a gate)

Before Gate 0 runs, delegate to `changelog-writer` with no arguments beyond CWD as a silent safety-net sync (per FR-4.4). This is NOT a quality gate — it has no pass/fail verdict, does not appear in the Gate count, and does NOT block merge readiness. The gate list runs Gate 0 through Gate 8. **Release packaging is no longer a /merge-ready gate** — it has been extracted to the standalone `/release` slash command which the user invokes on-demand when ready to cut a release. The pre-flight `changelog-writer` sync still runs before Gate 0 as a hygiene step (catches CHANGELOG drift relative to PRD content).

Behavior:
- If the agent returns `no-op: not configured` (SDLC repo) or `no-op: already in sync` (common case — previous hooks kept content in sync), proceed silently to Gate 0 with no extra output.
- If the agent returns `action taken: rewrote` (uncommon — e.g., PRD edited since last sync), surface the diff summary in the merge-ready output before proceeding to Gate 0.
- If the agent fails for any reason, log the error and proceed to Gate 0 per FR-4.5. The pre-flight sync cannot fail `/merge-ready`.

## Pre-gate: Corporate Code Style Cycle (conditional on `.codestyle` sentinel)

Before Gate 0 runs, check for the `.codestyle` sentinel in the project root:

```bash
[ -s "<project-root>/.codestyle" ] || skip_corporate_codestyle_cycle
```

The `-s` flag means "exists AND size > 0" — empty files are treated as absent. When the sentinel is absent or empty, this pre-gate is SKIPPED silently (no output, no entry in the gate count). When present, it MUST run to PASS before Gate 0 starts.

**Iteration loop semantics** (parallel to `/qa-cycle`):

1. Spawn the `corporate-code-style-reviewer` agent. It audits the diff between the feature branch and `main` against the rules in `.codestyle`, then emits PASS / FAIL / BLOCKED.
2. **PASS** → proceed to Gate 0.
3. **FAIL** → spawn the implementer with the fix_directives from the reviewer's verdict. After the implementer commits, re-spawn the reviewer (iter N+1).
4. **BLOCKED** → halt `/merge-ready` entirely. Surface `exit_argument` + `human_needs_to` via `AskUserQuestion` (continue / abort).

The cycle has no iteration cap — exit only via PASS, BLOCKED, or implementer FAIL. After 3 consecutive non-converging iterations, the reviewer itself surfaces BLOCKED with `exit_argument: implementer is not addressing the violations`.

This pre-gate is invisible to projects without `.codestyle` — they go straight from changelog-sync to Gate 0 byte-identically to before. Projects WITH `.codestyle` get mandatory corporate-style enforcement before the regular quality gates run. See `src/agents/corporate-code-style-reviewer.md` for the agent contract.

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

## Step 11: On-Demand Role Teardown

Step 11 is a STEP, NOT a gate. It runs AFTER Gate 8 completes. The total `/merge-ready` gate count is **9 quality gates** (Gate 0 through Gate 8); Step 11 is a post-gate cleanup step that performs on-demand role teardown after merge. Release packaging used to occupy a Gate 9 slot but has been extracted to the standalone `/release` slash command — see `~/.claude/commands/release.md`.

### Invocation

Step 11 is invoked exactly once per `/merge-ready` cycle, after Gate 8 completes (regardless of whether earlier gates reported PASS, FAIL, or WARN — Step 11 runs unconditionally per FR-3.1). The `role-planner` AGENT is NOT invoked at Step 11 — `role-planner` is a bootstrap-only agent. The orchestrator (the `/merge-ready` command runtime) performs Step 11 inline OR delegates the per-file frontmatter mutation to a helper subagent. Both modes are acceptable. The standard `/merge-ready` runtime has Bash access required for git ancestry checks and file deletion.

### Project-name and feature-slug derivation (FR-3.4, FR-3.5)

Orchestrator computes `<project-name>` as `basename "$(git rev-parse --show-toplevel)"` (or the literal string `unknown-project` when not in a git repo, identical to bootstrap-time FR-1.3). Orchestrator computes `<feature-slug>` as the merged branch's name with `feat/` or `fix/` prefix stripped (identical to bootstrap-time FR-1.4). Merged-branch identification: the head of the most recently merged PR OR (when run locally without a PR) the branch the developer just merged via `git merge --no-ff <branch>`.

### Refuse-from-non-feature-branch ([STRUCTURAL] decision 3)

If the current branch is NOT `feat/<slug>` or `fix/<slug>` (i.e. `main`, `release/*`, detached HEAD, or any other non-feature branch) AND no merged-PR context is available, Step 11 MUST emit the literal error: `"Refusing teardown from non-feature branch '<branch>' without explicit feature-slug — pass via merged PR context or skip Step 11"` (with `<branch>` substituted with the actual branch name). All three teardown counts (N, M, K) are reported as zero. The refusal does NOT block merge-readiness — Step 11 is not a gate.

### Refuse-when-not-merged (FR-4.1)

Orchestrator MUST verify merge-ancestry via `git merge-base --is-ancestor <feature-branch-head> main`. If the command exits with non-zero status (branch not yet merged), emit the literal error: `"Refusing teardown: branch '<feature-slug>' is not yet merged into main"` (with `<feature-slug>` substituted). All three teardown counts (N, M, K) are reported as zero.

### Per-file mutation logic (FR-3.6) + ALL-occurrence removal ([STRUCTURAL] decision 2)

For every `~/.claude/agents/ondemand-*.md` whose `features:` array contains the entry `<project-name>:<feature-slug>`, the orchestrator:

(a) Reads the file
(b) Parses the YAML frontmatter
(c) Removes EVERY matching `<project-name>:<feature-slug>` entry from the array — all-occurrence removal, NOT just first-occurrence — required for NFR-2 idempotency on duplicate-entry files
(d) Writes the modified file atomically per FR-5.1

NO partial `Edit` operations are permitted. The file body BELOW the closing `---` of the frontmatter is preserved byte-for-byte (FR-5.5).

### Atomic delete-only when array empties ([STRUCTURAL] decision 4)

When the in-memory mutation transitions `features:` from non-empty to empty, the orchestrator MUST `rm` the file directly. The orchestrator MUST NOT first Write the empty-array version to disk before deleting — there is no intermediate empty-array Write. Pre-existing files with `features: []` (already-empty arrays from prior partial-failure or manual editing) are NOT deletion triggers — deletion only triggers when THIS invocation's removal transitions the array from non-empty to empty. If `rm` fails (permission denied, I/O error, file vanished), the file is left in its prior state with the entry still present (because no Write was attempted) and the failure is recorded as `failed` in the audit trail. Orchestrator MUST continue scanning subsequent files after a per-file failure — one file's failure does not abort the rest of the teardown.

### Defense-in-depth deletion safety (FR-4.3, FR-4.4, FR-4.5)

Orchestrator MUST glob-match the literal path pattern `~/.claude/agents/ondemand-*.md` for every deletion. Canonicalize the file path via `realpath` / `readlink -f` (resolving every symlink in the chain) and verify the canonical absolute path begins with `<HOME>/.claude/agents/` before deletion (defense-in-depth against symlink attacks and path-traversal). Files at `~/.claude/agents/<core-agent>.md` (lacking the `ondemand-` prefix) are NOT visible to the FR-1.1 glob and are excluded by construction. Files matching `ondemand-*.md` whose frontmatter `scope` is NOT `on-demand` (the marker-mismatch case) are SKIPPED — orchestrator emits a warning to the merge-ready output but does NOT mutate the file. The twenty-two core agent slugs (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`, `qa-engineer`, `red-team`, `corporate-code-style-reviewer`, `consolidator`, `reflection`) MUST never be teardown-deletion targets. Additionally, if a file at `~/.claude/agents/ondemand-<slug>.md` has `<slug>` byte-equal to one of these 22 core agent slugs (a buggy or hand-edited file that bypassed the iter-1 prefix self-check), the orchestrator MUST treat the file as ineligible for BOTH `features:` mutation AND deletion; emit a `manual-cleanup` warning naming the absolute path so a human reviewer can investigate.

### Legacy file handling (FR-7.4)

Files lacking a `features:` field are no-ops at Step 11. Orchestrator MUST NOT delete legacy files at teardown. Orchestrator MAY emit the informational note `"Found <L> legacy on-demand role files without features: arrays — left unchanged. Future bootstrap reuse will migrate them on demand."` appended to the FR-8.2 summary line.

### FR-8.2 summary line format

Step 11 emits a single one-line summary appended to the `/merge-ready` output (outside the gate table): `Post-Merge: On-Demand Role Teardown — <N> roles updated, <M> deleted, <K> unchanged`. When teardown refuses to run (FR-4.1 or FR-4.2 / [STRUCTURAL] decision 3), the summary contains the verbatim refusal message with all three counts zero. When per-file failures occur, append `; <F> failed (see audit log)`. When legacy files were observed, append `; <L> legacy files left unchanged`.

### Idempotency (NFR-2)

Re-running Step 11 after teardown is safe. Already-removed entries are not found (the K count increments instead of N). Already-deleted files are absent from the FR-1.1 glob. Repeated invocation produces IDENTICAL state on disk after the first invocation.

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

**Overall: MERGE READY / NOT MERGE READY**
```

Step 11 (On-Demand Role Teardown) appends a separate one-line summary outside the gate table with the format: `Post-Merge: On-Demand Role Teardown — <N> roles updated, <M> deleted, <K> unchanged`. Step 11 is a STEP, not a gate — it does not contribute to the 9-gate tally and does not block MERGE READY.

Release packaging is NOT a gate — it lives in the standalone `/release` slash command. Run `/release` after `/merge-ready` reports MERGE READY when you have decided the project is ready to cut a versioned release.

If any gate FAILS: list specific fixes needed with file paths and priority.

## Auto-Fix Protocol

If any gate FAILS:
1. Identify the specific issues from the agent's output
2. Fix each issue in the codebase
3. Rerun ONLY the failed gate(s)
4. Repeat until all gates pass OR 3 fix attempts exhausted
5. If still failing after 3 attempts: report as NOT MERGE READY with specific blockers

Do NOT just report failures — attempt to fix them first.
