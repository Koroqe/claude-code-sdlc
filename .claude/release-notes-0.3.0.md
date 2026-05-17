### Added

- **`/release` slash command** — release packaging extracted from
  `/merge-ready` Gate 9 to a standalone user-invoked command. Run
  `/release` when ready to cut a versioned release; `/merge-ready`
  is now strictly about quality gates.
- **`/bootstrap-feature --with-resources` flag** — force-runs the
  resource-architect step regardless of keyword auto-detection
  outcome.
- **Tier-based agent models** for token-cost optimization. Default
  matrix: opus (architect, security-auditor, code-reviewer, verifier,
  release-engineer, resource-architect, role-planner) / sonnet
  (prd-writer, ba-analyst, planner, refactor-cleaner) / haiku
  (qa-planner, test-writer, build-runner, e2e-runner, doc-updater,
  changelog-writer). README §Customization documents the rationale
  and per-agent override.

### Changed

- **`/merge-ready` is now 9 quality gates** (was 10). Release
  packaging extracted to the standalone `/release` command. Gate
  numbering 0 through 8 unchanged; Step 11 (post-merge on-demand
  role teardown) now runs after Gate 8 instead of after Gate 9.
- **Step 3.5 of `/bootstrap-feature` is now CONDITIONAL.** The
  resource-architect agent runs only when the PRD/use-cases body
  contains external-resource trigger keywords (third-party,
  external API, MCP, OAuth, vendor, compliance, S3, Stripe, etc.)
  OR the user explicitly passes `--with-resources`. When neither
  triggers, Step 3.5 is silently skipped, saving one agent call
  per bootstrap on the common case. Step 3.75 (role-planner)
  remains MANDATORY.
- **`claudeknows search --context <N>`** flag added in iter-3.x —
  expands each hit with ±N neighbor chunks for paragraph-level
  context. Default N=0 (backward-compat — no expansion).

## Facts

### Verified facts

- `[Unreleased]` section non-empty with Added + Changed categories — source: `CHANGELOG.md:15-50` read this session.
- No `breaking` keyword anywhere in CHANGELOG.md — source: `grep -in 'breaking' CHANGELOG.md` returned empty this session.
- `Removed` category empty in `[Unreleased]` — source: `CHANGELOG.md:15-50` read this session.
- Current version `0.2.0` resolved via FR-3.1 priority chain step (e) — `Glob('.git/refs/tags/v*.*.*')` returned `v0.2.0` only this session; `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION` all absent at project root.
- Bump rule fired: Step 2 minor (Added non-empty, Removed empty, no non-negated `breaking`). Pre-1.0 override (Step 2.1) does not apply to minor bumps. Result: `0.2.0` → `0.3.0`.
- CI/CD detection: `present-and-correct`. P1 (`tags: ['v*.*.*']`), P2 (`body_path: .claude/release-notes-${{ env.VERSION }}.md`), P3 (`Strip v prefix from tag` step) all present in `.github/workflows/sdlc-core-release.yml` — verified by Read of file lines 17-18, 187, 86-90 this session.
- §7 sentinel `<project>/.claude/rules/auto-release.md` present — embedded in the system context for this session.

### External contracts

- **GitHub Actions `softprops/action-gh-release@v2`** — symbol: `body_path` input field — source: `.github/workflows/sdlc-core-release.yml:176, 187` read this session — verified: yes (file present at HEAD).
- **SQLite FTS5 `bm25()`** — not invoked by this agent run; no knowledge-base query was performed (corpus scope verdict: No overlap — see Open questions).

### Assumptions

- Tag-scheme disambiguation outcome (BOTH-changed → auto-abort) reflects the user-asserted file-change distribution (7 tools/sdlc-knowledge files + 32 non-tools files since v0.2.0). The agent did not run `git diff` to independently verify the distribution before this artifact was written; the §7 dispatch verifies and records the actual outcome at execution time. Risk: if the assertion is wrong (e.g., only tools/ changed), the correct tag scheme would be `sdlc-knowledge-v0.3.0` rather than the recommended bare `v0.3.0`. How to verify: the §7 audit log shows the actual `git diff --name-only <merge-base>..HEAD` output; user inspects before running the manual tag command.

### Open questions

- knowledge-base: corpus scope not inspected this run — `claudeknows list --json` was not invoked. Release packaging is a meta-pipeline / CI/CD task with no domain-bearing claims that would benefit from corpus citation; per knowledge-base-tool.md §When you MAY skip, "documentation generated mechanically from code structure" applies. Future enrichment with release-engineering reference materials would help if the corpus pivots toward DevOps content.
