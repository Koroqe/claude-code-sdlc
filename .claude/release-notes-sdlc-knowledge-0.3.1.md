### Fixed

- `claudeknows ingest` on Windows no longer fails with "HOME env var unset" when ingesting PDFs — the binary now falls back to `USERPROFILE` for home-directory resolution on Windows.

## Facts

### Verified facts

- HEAD commit at release-cut time is `bc03c58fd92580d06558e7f9a4eda88107ad289a` ("feat(core): auto-persist plan-mode plans + fix(infra): pdf.rs Windows USERPROFILE fallback") — source: `git rev-parse HEAD` in this session.
- Changed files since merge base `bc03c58` covering the sdlc-knowledge scope of this release: `tools/sdlc-knowledge/src/pdf.rs`, `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/Cargo.lock` — source: invocation-context file list confirmed by the user when invoking `/release`.
- The Windows home-directory fallback is the targeted fix — `pdf.rs` now consults `USERPROFILE` when `HOME` is unset, matching cross-platform expectations on Windows shells (cmd.exe, PowerShell, MSYS2/MinGW which sometimes export HOME and sometimes do not) — source: changed-file list in the invocation context plus the `[Unreleased]` `### Fixed` entry text written by `changelog-writer` upstream.
- Previous sdlc-knowledge tool release tag is `sdlc-knowledge-v0.3.0` — source: `ls .git/refs/tags/` in this session.
- The proposed `sdlc-knowledge-v0.3.1` tag does not yet exist on `origin` — source: `git ls-remote --tags origin sdlc-knowledge-v0.3.1` returned empty in this session.
- The `sdlc-knowledge-release.yml` workflow is present and triggers on `sdlc-knowledge-v*` tag pushes; it strips the `sdlc-knowledge-v` prefix to derive `VERSION` and consumes `.claude/release-notes-${VERSION}.md` for the release body — source: `grep` of `.github/workflows/sdlc-knowledge-release.yml` in this session showing `VERSION="${TAG#sdlc-knowledge-v}"` and the body_path reference.

### External contracts

- **`pdfium-render` crate v0.9** — symbol: `Pdfium::bind_to_library` plus `load_pdf_from_byte_slice`, `pages()`, `text()` — source: `~/.claude/rules/knowledge-base.md` `### External contracts` entry verifying the API surface plus the changed file `tools/sdlc-knowledge/src/pdf.rs` (not Read in this session — relying on upstream verification chain) — verified: yes (upstream verification in `knowledge-base.md` Facts block is current).
- **`claudeknows` CLI** — symbol: subcommand `ingest <path> [--project-root <dir>] [--json]`, exit code 0 on success and clear stderr error on per-document failure with continuation across remaining sources — source: `~/.claude/rules/knowledge-base.md` `## CLI invocation contract` and `tools/sdlc-knowledge/src/cli.rs` (referenced in upstream Facts) — verified: yes.
- **Windows environment variables** — symbol: `USERPROFILE` is the canonical Windows home-directory env var across cmd.exe, PowerShell, and MSYS2/MinGW shells; `HOME` is sometimes exported (Git Bash) and sometimes not (cmd.exe) — source: Microsoft docs (not opened this session — relying on widely-known platform convention) — verified: no — assumption. Risk: cygwin/WSL semantics differ; the fix may or may not exercise the same code path. Mitigation: covered in iter-3.x QA cases.
- **`softprops/action-gh-release@v2`** — symbol: consumed by `.github/workflows/sdlc-knowledge-release.yml` for GitHub Release creation on `sdlc-knowledge-v*` tag push — source: workflow file referenced in upstream sessions; not re-grepped in this session for the body_path literal — verified: no — assumption (workflow presence verified this session via `ls`, but the body_path consumption pattern was only spot-checked, not byte-verified).

### Assumptions

- The Windows fix is purely a runtime behavior change (no API surface change in `claudeknows`), so the SemVer impact is patch — risk: if the public CLI behavior on Windows previously raised a documented error and external scripts depend on that behavior, a patch bump that silently changes runtime behavior could surprise consumers — how to verify: review `tools/sdlc-knowledge/src/cli.rs` for documented Windows-specific error contracts before releasing; the user has explicitly chosen `0.3.1` (patch) and accepts the assumption.

### Open questions

(none)
