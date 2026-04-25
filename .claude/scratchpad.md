## Feature: Robust PDF Extraction via pdfium-render (iter-2 of local-knowledge-base)
## Branch: feat/pdfium-pdf-extraction
## Status: MERGE READY (10 gates; Gate 9 SKIPPED — opt-out; Step 11 REFUSED — branch not merged)

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: Cargo.toml dep swap + pdf.rs rewrite + calibre fixture + 7 tests — ca7c6dd
  - 62 tests + 5 ignored (binary-dependent, await Slice 3). Forbidden-symbol grep clean. Fixture 71974 B < 200 KB, sha256 documented. All 5 security remediations + catch_unwind preserved.

### Wave 2 [COMPLETE]
- [x] Slice 2: delete --by-id flag + mutual exclusion + FR-4.5 JSON shape — 70f63e6
  - 66 tests + 5 ignored. Stderr literals byte-exact. delete_by_id_with_summary wraps BEGIN IMMEDIATE; FK CASCADE handles chunks deletion automatically.

### Wave 3 [COMPLETE] (3 parallel slices; race bundled 3+4)
- [x] Slices 3 + 4 (bundled by parallel git race): install.sh install_pdfium_binary + GHA workflow pdfium download + calibre fixture smoke — 001142b
  - 17 security MUSTs (M1-M17) implemented; KNOWLEDGE_PDFIUM_VERSION=chromium/7802 pinned; live smoke test on darwin-arm64 succeeded (libpdfium.dylib 7062464 B installed at canonical path; .version sentinel; idempotent on re-run)
- [x] Slice 5: docs — 801dd59 (knowledge-base-tool.md + knowledge-base.md + RELEASING.md + README.md; lines 5/35 byte-unchanged)

## Wave 3 race notes
- Slice 4's GHA workflow was pre-staged before Slice 3's commit fired; Slice 3 commit picked up both files. Same race pattern as feat/local-knowledge-base Wave 5 (slices 7a+7b). Content correct; only history granularity lost. Not a merge blocker.

## Bootstrap artifacts produced
- PRD §12 (lines 2693+) — 9 FR groups (45 FRs), 9 NFRs, 9 ACs, 9 risks, 6 out-of-scope items
- `docs/use-cases/pdfium-pdf-extraction_use_cases.md` — 1203 lines, 51 scenarios (16 primary UCs + 5 cross-cutting + variants)
- `docs/qa/pdfium-pdf-extraction_test_cases.md` — 1515 lines, 71 TCs (49 per-UC + 4 cross-cutting + 5 architect-action-item + 9 invariant + 4 cross-platform)
- Architect verdict: PASS, 1 [STRUCTURAL] + 1 MAJOR + 3 MINOR action items inlined into Slices 1, 3, 5; security pre-review on Slices 1 + 3
- `.claude/resources-pending.md` — produced and consumed (1 Trivial Library/Framework: bblanchon/pdfium-binaries; headless auto-install skip); deleted
- `.claude/roles-pending.md` — produced and consumed (No additional roles required); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core opts out)

## Architect [STRUCTURAL] decisions
ONE [STRUCTURAL] item: explicit-path binding `Pdfium::bind_to_library(<absolute-path>)` resolved via `std::env::var("HOME") + canonicalize` → `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}`. FORBIDS `bind_to_system_library` and any env-var resolver fallback. Eliminates R-1 (LD_LIBRARY_PATH/DYLD_LIBRARY_PATH hijack) at API level instead of install.sh discipline. Security test in Slice 1 sets `DYLD_LIBRARY_PATH=/tmp/empty` and confirms canonical-path library still loads.

## Phase 1.5 Pre-Review Findings (all PASS)

### Architect resolution of [MAJOR] action item — pdfium-render API symbols verified
Source: live curl against `crates.io` + `github.com/ajrcarey/pdfium-render` master branch.
Latest stable: pdfium-render **v0.9.0** released 2026-03-30. Caret pin `"0.9"` correct.

**Concrete API symbols (CITED against master sources):**
| Concern | Symbol | Source |
|---|---|---|
| Library binding (explicit-path) | `Pdfium::bind_to_library(impl AsRef<Path>) -> Result<Box<dyn PdfiumLibraryBindings>, PdfiumError>` | `pdfium.rs:143-156` |
| API to FORBID | `Pdfium::bind_to_system_library()` | `pdfium.rs:101,123` |
| Per-platform filename | `Pdfium::pdfium_platform_library_name_at_path(path) -> PathBuf` (yields `libpdfium.dylib`/`libpdfium.so`/`pdfium.dll`) | `pdfium.rs:164-175` |
| Document open from bytes | `Pdfium::load_pdf_from_byte_slice(&self, &[u8], Option<&str>) -> Result<PdfDocument, PdfiumError>` | `pdfium.rs:210-219` |
| Page text extraction | `doc.pages().iter()` + `page.text()?.all()` returns `String` | `examples/text_extract.rs` |
| Library-load failure variant | `PdfiumError::LoadLibraryError(libloading::Error)` (NOT `LibraryNotFound`) | `error.rs:59` |

**Critical finding on env-var hijack:** `libloading::Library::new` consults `LD_LIBRARY_PATH`/`DYLD_LIBRARY_PATH` ONLY for plain filenames; **absolute paths are used verbatim** by `dlopen`/`LoadLibraryExW`. Therefore `bind_to_library(<absolute-canonicalized-path>)` is safe by design. STRUCTURAL action item #1 mitigation = `std::fs::canonicalize` BEFORE `bind_to_library`.

**Slice 1 code template (architect-provided):**
```rust
use pdfium_render::prelude::*;
use std::path::{Path, PathBuf};

fn resolve_pdfium_lib(pdfium_lib_dir: &Path) -> Result<PathBuf, IngestError> {
    if !pdfium_lib_dir.is_absolute() {
        return Err(IngestError::PdfDecode(pdfium_lib_dir.into(), "non-absolute pdfium library path".into()));
    }
    let candidate = Pdfium::pdfium_platform_library_name_at_path(pdfium_lib_dir);
    std::fs::canonicalize(&candidate).map_err(|e| IngestError::PdfDecode(candidate, e.to_string()))
}

pub fn read(p: &Path) -> Result<String, IngestError> {
    let bytes = std::fs::read(p).map_err(|e| IngestError::PdfDecode(p.into(), e.to_string()))?;
    let lib_dir = resolve_pdfium_lib_dir()?;  // see HOME handling per M1 below
    let lib_path = resolve_pdfium_lib(&lib_dir)?;
    let bindings = Pdfium::bind_to_library(&lib_path)
        .map_err(|e| IngestError::PdfDecode(p.into(), format!("pdfium bind_to_library: {e}")))?;
    let pdfium = Pdfium::new(bindings);
    let doc = pdfium.load_pdf_from_byte_slice(&bytes, None)
        .map_err(|e| IngestError::PdfDecode(p.into(), format!("pdfium load_pdf: {e}")))?;
    let mut out = String::new();
    for (i, page) in doc.pages().iter().enumerate() {
        let text = page.text().map_err(|e| IngestError::PdfDecode(p.into(), format!("page {i} text: {e}")))?.all();
        out.push_str(&text);
        out.push('\n');
    }
    check_byte_budget(p, out)
}
```
Wrap the whole `read()` body in `catch_unwind(AssertUnwindSafe(...))` per existing pattern.

### Security-auditor Slice 1 — 5 required remediations (HIGH x2, MEDIUM x2, LOW x1)
1. **HIGH:** REJECT empty/missing `$HOME` explicitly (not `.unwrap_or_default()` which silently coerces to CWD-relative). Use `std::env::var("HOME").map_err(|_| IngestError::PdfDecode(p.into(), "HOME unset; cannot resolve pdfium library path".into()))?`.
2. **HIGH:** Directory-mode safety check on `~/.claude/tools/sdlc-knowledge/pdfium/lib/` — reject if world-writable (`mode & 0o002 != 0`). Mitigates TOCTOU swap between canonicalize and dlopen.
3. **MEDIUM:** After canonicalize, assert canonical path `starts_with` canonicalized `$HOME/.claude/tools/sdlc-knowledge/pdfium/lib/` prefix. Defense in depth against symlink redirection at any path component above `lib/`.
4. **MEDIUM:** Map canonicalize-failure to FR-3.5 literal `"pdfium dynamic library not found ... install via bash install.sh --yes"` not raw `io::Error`.
5. **LOW:** TC-SEC-2.2 env-var hijack test runs via `Command::new(...).env_clear().env("DYLD_LIBRARY_PATH", "/tmp/empty-bogus").env(...)` subprocess — robust against macOS SIP env-var stripping.

**Additional security tests to add in Slice 1 (`tests/pdfium_test.rs`):**
- TC-SEC-2.3: HOME unset → IngestError, no panic, no silent CWD-fallback
- TC-SEC-2.4: World-writable pdfium/lib dir → IngestError, refuse to load
- TC-SEC-2.5: Symlink redirect of libpdfium.dylib → canonicalize+prefix-check rejects
- TC-SEC-2.6: Subprocess env-var hijack on macOS SIP — child still loads from canonical path
- TC-SEC-2.7: C++ FFI panic injection on corrupt.pdf → per-document IngestError, not segfault

### Security-auditor Slice 3 — 17 MUSTs (M1-M13 user-supplied + M14-M17 added by reviewer)
- **M1-M13** as documented in Phase 1.5 review prompt (URL hardcoded, TLS only, mktemp staging, tar safety flags, traversal pre-check + post-check, mode bits, idempotency, graceful failure, ordering, no privilege escalation, uname allowlist, sha256 deferral)
- **M14:** `curl --proto '=https' --tlsv1.2 -fsSL` first; `wget --https-only --secure-protocol=TLSv1_2 -O "$tmp"` fallback; if both absent → log_warn + return 0
- **M15:** Add `--max-redirs 5` and `--max-time 120` to bound redirect chains and hang exposure
- **M16:** `umask 0022` at top of `install_pdfium_binary` for deterministic mode bits regardless of caller env
- **M17:** Post-install integrity self-check: `[ -s "$target/lib/libpdfium.{dylib|so}" ]` MUST be true; if false → `rm -rf "$target"` and log_warn (no half-installed state)

**Tar safety: two-phase verification:**
- Pre-extract: `tar -tzf "$archive" | grep -E '^/|(^|/)\.\.(/|$)'` returns empty (no malicious entries)
- Post-extract: `find "$staging" -path '*..*' -print -quit` returns empty
- Plus `find "$staging" -perm /6000 -print -quit` returns empty (no setuid/setgid bits)

**Hash verification deferral to iter-3 ACCEPTED** with inline `# TODO(iter-3): add pdfium-<arch>.tgz.sha256 sidecar verification` comment.

## Open Questions resolved at architect Step 3
- OQ#1 — pdfium-render API symbols (bind_to_library vs bind_to_library_at_path): RESOLVED — architect Step 3 pre-Slice-1 review will document exact symbol names in plan.md Slice 1 spec (deferred to Slice 1 implementation kickoff).
- OQ#2 — bblanchon/pdfium-binaries asset names: RESOLVED — Slice 3 done-condition opens actual GitHub Releases page for pinned `chromium/<version>` tag; mismatch fails Slice 3.
- OQ#3 — pdfium-render `load_pdf_from_byte_slice` symbol name: RESOLVED — Slice 1 done-condition compiles against real API; mismatch caught at compile time.
- OQ#4 — `mupdf` AGPL rejection: RESOLVED — confirmed from crates.io API call (License: AGPL-3.0); not a fit for our MIT-licensed repo.
- OQ#5 — Calibre fixture size: RESOLVED at architect MINOR — raise budget from 100 KB to 200 KB if Sherlock Holmes excerpt exceeds 100 KB.

## Invariants (load-bearing — preserved from §11)
- 17 core agents — UNCHANGED
- 10 quality gates — UNCHANGED
- 5 executor agents — BYTE-UNCHANGED
- README taglines lines 5 (`17 specialized AI agents`) and 35 (`10 quality gates`) — BYTE-UNCHANGED
- `templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*` — BYTE-UNCHANGED
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED
- `install.sh` line 22 `VERSION="2.1.0"` — UNCHANGED in iter-2
- 12 thinking-agent activation blocks (`## Knowledge Base (when present)`) — BYTE-UNCHANGED (citation contract from §11 preserved)
- CLI surface (5 subcommands) — UNCHANGED; `delete` gains `--by-id` flag (additive, not breaking)
- Citation literal format — UNCHANGED

## Out of scope iter-2
- Subprocess `pdftotext` fallback (deferred — pdfium handles all cases)
- Quality-detection heuristics / fallback chain (no need with pdfium primary)
- Windows binary builds (still iter-3)
- Auto-detecting calibre PDFs by metadata (unnecessary)
- Any change to local-knowledge-base feature contract from §11
- sha256 verification of downloaded pdfium binary (deferred to iter-3)

## Completed
- Bootstrap (Steps 1-7) — 5a64c8f
- Phase 1.5 pre-review (architect API resolution + security-auditor Slices 1+3) — fedb026
- Wave 1 Slice 1 — ca7c6dd (62 tests + 5 ignored, calibre fixture 71974 B, all 5 security remediations)
- Wave 2 Slice 2 — 70f63e6 (66 tests, delete --by-id with FR-4.5 JSON shape, BEGIN IMMEDIATE transaction)
- Wave 3 Slices 3+4 bundled by parallel git race — 001142b (install_pdfium_binary 17 MUSTs + GHA workflow pdfium download + smoke test)
- Wave 3 Slice 5 — 801dd59 (knowledge-base rules + RELEASING.md + README hardening row)
- Phase 2.5 cleanup — d7665f4 (removed legacy delete_by_id, 11 lines, zero call sites)
- Scratchpad — f17fb7b

## Quality gate verdicts
- Gate 0 Git Hygiene: PASS (8 commits ahead of main, working tree clean)
- Gate 1 Documentation Completeness: PASS (PRD §12 + 1203-line UC + 1515-line QA)
- Gate 2 Code Review: PASS (no findings; all invariants hold)
- Gate 3 Security Audit: SECURITY APPROVED (22 MUSTs verified; sha256 deferral acceptable iter-3)
- Gate 4 Build Verification: PASS (cargo build/test/clippy clean; 66/0/5; binary 2.89 MB)
- Gate 5 E2E Tests: PASS (covered by Gate 4 — cli_*_e2e_test.rs)
- Gate 6 Goal-Backward Verification: PASS (Levels 1-4 all PASS)
- Gate 7 Documentation Accuracy: PASS (all 7 doc surfaces accurate)
- Gate 8 UI/UX: N/A (no UI; CLI tool only)
- Gate 9 Release Packaging: SKIPPED (no CHANGELOG.md; SDLC core opts out)
- Step 11 On-Demand Role Teardown: REFUSED (branch not merged; FR-4.1; counts N=0, M=0, K=0; not a merge blocker)

## Blockers
(none)
