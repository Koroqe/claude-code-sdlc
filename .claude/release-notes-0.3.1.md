### Added

- Plan-mode plans are now automatically saved to `<project>/.claude/plan.md` so they are available to the pipeline without any manual copy-paste step. `/bootstrap-feature` Step 0 verifies the file exists and is non-empty before invoking any agent.

## Facts

### Verified facts

- HEAD commit at release-cut time is `bc03c58fd92580d06558e7f9a4eda88107ad289a` ("feat(core): auto-persist plan-mode plans + fix(infra): pdf.rs Windows USERPROFILE fallback") — source: `git rev-parse HEAD` in this session.
- Changed files since merge base `bc03c58` covering the SDLC core scope of this release: `src/claude.md`, `src/commands/bootstrap-feature.md`, `src/agents/planner.md`, `README.md`, `docs/PRD.md`, `docs/use-cases/auto-persist-plan-mode_use_cases.md`, `docs/qa/auto-persist-plan-mode_test_cases.md`, `.claude/plan.md`, `CHANGELOG.md` — source: invocation-context file list confirmed by the user when invoking `/release`.
- `[Unreleased]` `### Added` category was non-empty and `### Fixed` was non-empty when this release was cut — source: `Read('CHANGELOG.md')` at the start of this session, lines 17–23 of the pre-rewrite content.
- Previous SDLC core release tag is `v0.3.0` — source: `ls .git/refs/tags/` in this session returned `sdlc-knowledge-v0.2.0`, `sdlc-knowledge-v0.3.0`, `v0.2.0`, `v0.3.0`.
- The proposed `v0.3.1` tag does not yet exist on `origin` — source: `git ls-remote --tags origin v0.3.1` returned empty in this session.
- Auto-release executing-mode sentinel `<project>/.claude/rules/auto-release.md` is present — source: `Read` of the file in this session returned the §Headless contract and 4-tier dispatch table.
- The `sdlc-core-release.yml` workflow is present and triggers on `v*.*.*` tag pushes consuming `.claude/release-notes-${VERSION}.md` via `body_path` — source: `grep` of `.github/workflows/sdlc-core-release.yml` in this session.

### External contracts

- **Claude Code `Write` tool** — symbol: `Write(file_path, content)` — source: this agent's frontmatter `tools: Read, Glob, Grep, Write, Edit, Bash` and the `Write` tool description in this session — verified: yes.
- **Claude Code `ExitPlanMode` tool** — symbol: invoked by the orchestrator at plan-approval time to write the in-memory plan to `<project>/.claude/plan.md` — source: `src/commands/bootstrap-feature.md` Step 0 in the changed-files list (not Read in this session) — verified: no — assumption (the integration is described in the changed file but the API surface itself is internal Claude Code tooling).
- **`softprops/action-gh-release@v2`** — symbol: GitHub Action consumed by `.github/workflows/sdlc-core-release.yml` to create the GitHub Release on tag push, reads release body from `body_path: .claude/release-notes-${{ env.VERSION }}.md` — source: `grep` of the workflow in this session showing the `body_path: .claude/release-notes-${{ env.VERSION }}.md` literal — verified: yes (workflow file inspected this session).

### Assumptions

- The user's instruction to use version `0.3.1` (PATCH) overrides the agent's algorithmic computation of `0.4.0` (MINOR — implied by `### Added` non-empty under Step 2 of the bump algorithm). The user's framing treats the auto-persist as quality-of-life polish on top of existing `/bootstrap-feature` rather than a net-new feature surface — risk: future strict-semver tooling could complain that the patch bump suppressed a minor-level feature signal — how to verify: surfaced as a Warning in the structured summary; the user explicitly accepts the trade-off when invoking `/release`.

### Open questions

(none)
