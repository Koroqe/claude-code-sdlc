# Test Cases: Robust PDF Extraction via pdfium-render

> Based on [PRD](../PRD.md) -- Section 12 and [Use Cases](../use-cases/pdfium-pdf-extraction_use_cases.md)

## Facts

### Verified facts

- The PRD Section 12 (Robust PDF Extraction via pdfium-render) spans `docs/PRD.md` lines 2696-2934 with eight numbered subsections (12.1 through 12.8) plus a terminal `## Facts` block at lines 2935-2972 -- verified by Read of `docs/PRD.md` lines 2693-2934 in the current session.
- The 9 acceptance criteria AC-1 through AC-9 are documented at PRD §12.5 lines 2840-2848 -- verified by Read in the current session.
- The 9 functional-requirement groups FR-1 through FR-9 with 45 sub-clauses are documented at PRD §12.3 lines 2734-2825 -- verified by Read in the current session.
- The 9 non-functional requirements NFR-1 through NFR-9 are documented at PRD §12.4 lines 2828-2836 -- verified by Read in the current session.
- The use-cases file `docs/use-cases/pdfium-pdf-extraction_use_cases.md` documents 16 primary UCs (UC-1 through UC-16) plus 5 cross-cutting UCs (UC-CC-1 through UC-CC-5), each with primary flow / alternative flows / error flows / edge cases / data requirements / mapped FR / mapped AC sections; total 1203 lines including a terminal `## Facts` block -- verified by Read of the use-cases file lines 1-1203 across multiple chunks in the current session.
- The four iter-2 supported platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) and their `bblanchon/pdfium-binaries` asset filenames (`pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz`) are enumerated in FR-3.1 at PRD line 2759 -- verified by Read in the current session.
- The literal install.sh warning per FR-3.5 is `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected` at PRD line 2763 -- verified by Read in the current session.
- The literal pdfium-absent error per FR-1.2 is `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes` at PRD line 2739 -- verified by Read in the current session.
- The literal mutual-exclusion error per FR-4.1 is `error: --by-id and <source-path> are mutually exclusive` at PRD line 2771 -- verified by Read in the current session.
- The literal non-existent-id error per FR-4.2 is `error: no document with id <int>` at PRD line 2772 -- verified by Read in the current session.
- The literal password-protected error component per FR-1.3 is `password-protected; not supported in iter-2` at PRD line 2740 -- verified by Read in the current session.
- The `delete --by-id` JSON output shape per FR-4.5 is `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}` at PRD line 2775 -- verified by Read in the current session.
- The crate version bump `0.1.0 → 0.2.0` per NFR-9 is at PRD line 2836 -- verified by Read in the current session.
- The matrix runner labels (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) are BYTE-UNCHANGED from §11 FR-11.1 per FR-7.3 at PRD line 2802 -- verified by Read in the current session.
- The chunks-per-MB floor for calibre PDFs is ≥ 50 per NFR-4 at PRD line 2831 -- verified by Read in the current session.
- The total install footprint budget is ≤ 25 MB per NFR-2 at PRD line 2829; binary alone ≤ 10 MB per NFR-1 at PRD line 2828 -- verified by Read in the current session.
- The vendored fixture path `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` plus its sibling provenance README `calibre-sample.README.md` are mandated by FR-6.1 / FR-6.3 at PRD lines 2789 and 2794 -- verified by Read in the current session.
- The 50 MB byte budget constant `PDF_BUDGET_BYTES = 50 * 1024 * 1024` is preserved BYTE-FOR-BYTE per FR-1.5 at PRD line 2742 -- verified by Read in the current session.
- The `extract_via_closure_for_test` synthetic-panic test seam is preserved with unchanged signature per FR-1.7 at PRD line 2744 -- verified by Read in the current session.
- The `IngestError::PdfDecode` variant identity is preserved (only the message string changes) per FR-2.4 at PRD line 2753 -- verified by Read in the current session.
- The 12 in-scope thinking agents and 5 exempt executor agents are unchanged from §11 / cognitive-self-check rule per FR-9.3 / FR-9.6 at PRD lines 2820 and 2823 -- verified by Read in the current session.
- The post-extract dylib filenames are platform-specific: darwin → `libpdfium.dylib`, linux → `libpdfium.so` per R-3 at PRD line 2854 -- verified by Read in the current session.
- The pinned PDFium tag scheme is `chromium/<version>` per FR-3.3 at PRD line 2761 -- verified by Read in the current session.
- The format precedent file is `docs/qa/local-knowledge-base_test_cases.md` (2349 lines, 117 TCs, organized as `## Facts` block at top, `## Use Case Coverage` table, `## AC Coverage` table, numbered sections per UC, dedicated `## Invariant Test Cases`, `## Architect Action Item Test Cases`, `## Cross-Platform Matrix`) -- verified by Read of lines 1-400 in the current session.
- This is a NEW QA test-cases file (CREATE, not UPDATE) -- verified because no existing file at `/Users/aleksandra/Documents/claude-code-sdlc/docs/qa/pdfium-pdf-extraction_test_cases.md` exists prior to this slice.
- Knowledge-base status at task start: `schema_version: 1`, `doc_count: 8`, `chunk_count: 17030`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db` -- verified via `~/.claude/tools/sdlc-knowledge/sdlc-knowledge status --json` in the current session.
- The 5 architect action items mandated by the user task each map to a dedicated TC: explicit-path binding `Pdfium::bind_to_library(<absolute-path>)` (TC-AAI-1, security-load-bearing); pdfium-render API symbol resolution pre-Slice-1 (TC-AAI-2); caret semver pin `pdfium-render = "0.9"` (TC-AAI-3); fixture size verification ≤ 200 KB (TC-AAI-4, raised from 100 KB per architect MINOR); install.sh tar-extraction safety flags (TC-AAI-5).

### External contracts

- **`pdfium-render` crate v0.9** -- symbol: `pdfium_render::Pdfium::bind_to_library(path: &Path)` (architect-selected explicit-path entrypoint per the [STRUCTURAL] action item), `pdfium_render::Pdfium::load_pdf_from_byte_slice`, `PdfDocument::pages().iter()`, page-text accessor -- license: MIT OR Apache-2.0 -- repo: `ajrcarey/pdfium-render` -- source: PRD §12 `## Facts → ### External contracts` entry at PRD line 2948 (verified there via crates.io API in the PRD's authoring session); inherited verbatim into this QA file -- verified: yes (PRD-cite chain). Risk: pre-1.0 SemVer; minor-version pin `pdfium-render = "0.9"` (caret default per FR-2.1) accepts 0.9.x but not 0.10.x; mitigated.
- **`pdf-extract` crate v0.7** -- symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>` -- source: existing iter-1 `tools/sdlc-knowledge/src/pdf.rs:26` and `tools/sdlc-knowledge/Cargo.toml:16` (cited by PRD §12 `## Facts` block at PRD line 2949); being REMOVED in iter-2 per FR-2.1 / FR-2.2 -- verified: yes (PRD-cite chain).
- **`bblanchon/pdfium-binaries` GitHub project** -- symbol: GitHub Releases assets `pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz`; tag scheme `chromium/<int>` -- license: MIT -- source: PRD §12 `## Facts` block at PRD line 2950 -- verified: **no -- assumption** (inherited from PRD where it was already labeled `verified: no — assumption`). Risk: asset filename or tag scheme could differ from architect's recollection. Verification path: Slice 3 (install.sh integration) opens the actual GitHub Releases page and pins the exact asset URLs; TC-CP-1 through TC-CP-4 each fail-fast on filename mismatch.
- **PDFium upstream (Google)** -- symbol: PDFium engine; production renderer in Chromium -- license: BSD-3 -- source: PRD §12 `## Facts` block at PRD line 2951 -- verified: **no -- assumption** (inherited from PRD). Risk: license claim is widely-cited industry fact but not reverified this session against PDFium's `LICENSE` file. Verification path: code-reviewer pass at the merge-ready gate.
- **`pdfium-render` library-path resolver** -- symbol: `Pdfium::bind_to_library(path: &Path)` is the architect-selected explicit-path API per the [STRUCTURAL] action item (preferred over `bind_to_system_library` because the latter searches `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` which are user-controllable per R-1) -- source: architect Step 3 verdict described in the user task; PRD §12 `## Facts` block at PRD line 2952 enumerates both APIs as candidates -- verified: **no -- assumption** (the architect's verdict is described in the user task; the actual `pdfium-render` docs entry has not been opened in this session). Risk: the precise method name in `pdfium-render` v0.9 may differ from `bind_to_library` -- TC-AAI-2 is a tracking-only test that gates Slice 1 on `.claude/plan.md` documenting the canonical symbol verbatim. Verification path: planner Slice 1 spec opens the docs and pins the exact symbol; TC-AAI-1 then exercises it at runtime.
- **GitHub Actions runner labels** -- symbol: `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), `ubuntu-22.04-arm` (linux-arm64) -- source: §11 FR-11.1 (BYTE-UNCHANGED in iter-2 per FR-7.3 at PRD line 2802) -- verified: yes (inherited from §11 which shipped the workflow file).
- **SQLite `BEGIN IMMEDIATE` transaction semantics** -- symbol: `BEGIN IMMEDIATE … COMMIT` -- source: §11 FR-4 / `tools/sdlc-knowledge/src/store.rs` (inherited unchanged in iter-2; `delete_by_id` per FR-4.4 uses the same transaction shape as the existing `delete_by_path`) -- verified: yes (PRD-cite chain).
- **SQLite FTS5 trigger cascade for `chunks_fts`** -- symbol: the FTS5 trigger that propagates `DELETE FROM chunks` to `chunks_fts` -- source: §11 FR-4.2 (BYTE-UNCHANGED in iter-2 per FR-9.7 at PRD line 2824) -- verified: yes (PRD-cite chain).
- **`clap` crate v4.x** -- symbols: `clap::Parser` derive macro, mutually-exclusive flag groups, exit-code-2-on-parse-errors -- source: §11 `## Facts → ### External contracts` (inherited; iter-2 adds the `--by-id <int>` flag and the mutual-exclusion group per FR-4.1) -- verified: **no -- assumption** (inherited from §11 where it was already `verified: no — assumption`). Risk: minor wording drift between 4.x patch versions; verification path: `cargo build` at Slice 4.
- **`tar` archive extraction** -- symbol: `tar -xzf <archive> -C <target> --no-same-owner --no-same-permissions` (or platform equivalent) -- source: architect MINOR action item described in the user task (tar-extraction safety in Slice 3) -- verified: **no -- assumption**. Risk: the literal flag wording the slice implementer ships may differ; verification path: TC-AAI-5 is a static grep-the-source test that gates Slice 3 on the exact flags.
- **knowledge-base CLI for §12 QA authoring** -- symbol: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge status --json`, `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json` -- source: live invocation in this session per `~/.claude/rules/knowledge-base-tool.md` -- verified: yes (status returned `{"schema_version":1,"doc_count":8,"chunk_count":17030,...}`; four searches on `"PDF parsing crate Rust pdfium"`, `"CID font ToUnicode CMap composite encoding"`, `"calibre ebook PDF text extraction"`, `"dynamic library loading shared object FFI"` each returned `[]` -- zero hits across all queries; corpus is ML/AI domain with no PDF-internals or document-conversion literature).

### Assumptions

- The architect's [STRUCTURAL] action item mandates the explicit-path binding `Pdfium::bind_to_library(<absolute-path>)` over `bind_to_system_library` because the env-var-based search exposes the R-1 hijack risk. Risk: if the slice implementer falls back to `bind_to_system_library` for convenience, R-1 mitigation lapses; verification: TC-AAI-1 grep-the-source plus runtime DYLD/LD env-poisoning round-trip.
- TC-AAI-2 (pdfium-render API symbol resolution) is a tracking-only test that passes if `.claude/plan.md` Slice 1 spec documents the canonical `pdfium-render` symbol verbatim before the slice ships. Risk: the test cannot independently verify the symbol's correctness; planner-and-architect responsibility. Verification path: code-reviewer at merge-ready greps `.claude/plan.md` for the literal `Pdfium::bind_to_library` (or whichever symbol the architect picks).
- TC-AAI-3's caret semver behavior (`pdfium-render = "0.9"` accepts 0.9.x but not 0.10.x) is the cargo default for pre-1.0 versions. Risk: cargo's caret-rule on pre-1.0 is documented but not reverified this session against `cargo`'s docs; verification: `cargo update -p pdfium-render --dry-run` after a hypothetical 0.10 release would refuse the upgrade.
- TC-AAI-4's fixture size budget is raised from FR-6.1's 100 KB cap to ≤ 200 KB per the architect's MINOR action item. The PRD wording at line 2789 is `≤ 100 KB, target 30 KB`; the architect's MINOR raises the cap to allow a more realistic CID-font fixture. Risk: PRD-vs-test divergence; verification: planner Slice 6 reconciles with a single-line PRD edit OR the test file documents the architect's amendment in Review Notes.
- TC-AAI-5's tar-extraction safety flag set (`--no-same-owner --no-same-permissions`) is the architect's MINOR recommendation. Risk: GNU tar (Linux) and BSD tar (macOS) accept slightly different flag spellings; verification: Slice 3 done-condition exercises both platforms via the matrix runner.
- The `chunks/MB ≥ 50` floor in NFR-4 is enforced via `(chunks_count * 1024 * 1024) / file_size_bytes >= 50`; equivalently `chunks_count >= file_size_bytes / 20480`. Risk: integer-division off-by-one on small fixtures (a 30 KB fixture needs ≥ 1.46 chunks → ≥ 2 with ceil, ≥ 1 with floor); the AC-2 wording at PRD line 2841 uses `≥ (file_size_kb / 20)` which is a floor. Verification: TC-1.1 records the exact computation.
- The `delete --by-id` race-condition resolution (UC-11-EC1) is pending architect Step 3. The TCs below cover both candidate resolutions: TC-11.1 asserts `error: no document with id <int>` and exit 1 for the non-concurrent non-existent-id case; TC-11.2 documents the concurrent-deletion race as either-acceptable per the use-case file's Open Question #2.
- The `delete --by-id` JSON shape (FR-4.5) is mutually exclusive with the iter-1 `delete <source-path>` JSON shape; iter-1's shape is preserved BYTE-UNCHANGED per FR-9.1 but is not reverified in this session against `tools/sdlc-knowledge/src/output.rs`. Risk: TC-12.1 (legacy path-based delete) asserts the output shape matches iter-1's verbatim; if iter-1's shape was different, the test will reveal at first run.
- The `extract_via_closure_for_test` test seam (FR-1.7) is preserved with unchanged signature so TC-SEC-2.1 from §11 (synthetic panic injection) continues to pass. Risk: if the seam is renamed or its signature changes, the iter-1 panic test fails -- TC-3.3 below explicitly re-asserts the seam's identity.
- Re-running `install.sh --yes` after a `chromium/<version>` bump (UC-4-A2) re-downloads and replaces the dylib in-place without manual `rm -rf`. Risk: if a version-marker file is not implemented, every re-run re-downloads (not idempotent per FR-3.7). Verification: TC-4.2 records the FR-3.7 idempotency contract; the slice implementer is responsible for the version-marker.
- The 12 thinking-agent activation block (`## Knowledge Base (when present)`) BYTE-UNCHANGED check (TC-INV-9) verifies the section is present in each agent's prompt file but does not reverify the literal block content against the §11 source-of-truth in this session. Risk: slipped activation-block edits in iter-2; verification: `git diff <pre-iter2-merge-commit>..HEAD -- src/agents/<each>.md` returns empty for the block.

### Open questions

- **Knowledge-base searches on `"PDF parsing crate Rust pdfium"`, `"CID font ToUnicode CMap composite encoding"`, `"calibre ebook PDF text extraction"`, and `"dynamic library loading shared object FFI"` each returned `[]` (zero hits) in the current session.** Per the `~/.claude/rules/knowledge-base-tool.md` mandate this is a documented negative result, not a silent skip. Action: consider adding a PDFium / PDF-internals reference (the PDF 1.7 specification, the PDFium developer wiki, or "Practical Rust FFI") to `<project>/.claude/knowledge/sources/` if iter-3 work continues to depend on PDF-format reasoning. No action required for iter-2 -- the source-of-truth for iter-2 contracts is `pdfium-render`'s own docs and `bblanchon/pdfium-binaries`'s GitHub Releases page (both labeled in `### External contracts` above). Corpus is ML/AI domain (8 docs / 17030 chunks); no PDF-format or document-conversion literature.
- **Open Question #1 -- Exact `pdfium-render` library-path API.** RESOLUTION described by architect: `Pdfium::bind_to_library(<absolute-path>)` per the [STRUCTURAL] action item. Status: documented in `.claude/plan.md` Slice 1 spec as a tracking item gated by TC-AAI-2.
- **Open Question #2 -- UC-11-EC1 race-condition resolution.** Status: pending architect Step 3; TC-11.1 / TC-11.2 cover both candidate resolutions.
- **Open Question #3 -- Calibre fixture content choice (Project Gutenberg excerpt? specific book? specific calibre version?).** Status: pending planner Slice 6; FR-6.3 documents the choice in the sibling README.
- **Open Question #4 -- sha256 verification of PDFium download.** Status: RESOLVED -- DEFERRED to iter-3 per PRD §12.7 item 1.
- **Open Question #5 -- Windows binary support.** Status: RESOLVED -- OUT OF SCOPE per PRD §12.7 item 3.
- **Open Question #6 -- Coupling Gate 9 release-engineer to PDFium binary version bump.** Status: RESOLVED -- OUT OF SCOPE per PRD §12.7 item 6.

---

**Note:** The `sdlc-knowledge` runtime is a Rust CLI binary; iter-2 swaps the PDF reader implementation. "Testing" this feature combines (a) Rust unit / integration / `assert_cmd`-based E2E tests under `tools/sdlc-knowledge/tests/`, (b) shell-level cross-platform install matrix tests, (c) markdown invariant checks (file existence, line counts, byte-unchanged via `git diff` or `sha256`, literal-phrase grep), and (d) static source-grep tests for security-load-bearing flags. Test types are tagged per case (`unit`, `integration`, `E2E`, `cross-platform`, `security`).

---

## Use Case Coverage

Every UC-N (and its variants) and UC-CC-N from `docs/use-cases/pdfium-pdf-extraction_use_cases.md` maps to one or more test cases below.

| UC | Scenario | Test Cases |
|----|----------|------------|
| UC-1 | Ingest calibre-converted PDF with composite CID fonts | TC-1.1, TC-1.2 |
| UC-1-A1 | Calibre fixture extracted text below 50 MB byte-budget gate | TC-1.3 |
| UC-1-A2 | Calibre fixture has multiple `/ToUnicode` CMaps across `/Type0` font dictionaries | TC-1.4 |
| UC-1-E1 | Calibre fixture is encrypted with non-empty password | TC-1.5 |
| UC-1-E2 | Calibre fixture has 0 pages (degenerate) | TC-1.6 |
| UC-1-EC1 | Calibre fixture exceeds 50 MB byte budget after extraction | TC-1.7 |
| UC-2 | Ingest normal PDF (existing iter-1 sample.pdf) -- chunk count varies | TC-2.1 |
| UC-2-A1 | sample.pdf chunk count under iter-2 HIGHER than iter-1 baseline | TC-2.2 |
| UC-2-E1 | sample.pdf chunk count under iter-2 BELOW 50% of iter-1 baseline | TC-2.3 |
| UC-3 | Ingest corrupt PDF (existing iter-1 corrupt.pdf) -- per-file error, batch continues | TC-3.1 |
| UC-3-A1 | corrupt.pdf is the ONLY file in the directory -- exit 1 | TC-3.2 |
| UC-3-E1 | Corrupt PDF triggers a native panic surfacing through FFI | TC-3.3 |
| UC-3-EC1 | corrupt.pdf is structurally valid but has zero extractable text | TC-3.4 |
| UC-4 | First-time install on darwin-arm64 -- PDFium download | TC-CP-1, TC-4.1 |
| UC-4-A1 | Re-running install on host with PDFium already at pinned tag (idempotent) | TC-4.2 |
| UC-4-A2 | Maintainer bumps pinned `chromium/<version>` tag | TC-4.3 |
| UC-4-E1 | bblanchon/pdfium-binaries asset URL returns 404 | TC-4.4 |
| UC-4-E2 | PDFium archive malformed/truncated | TC-4.5 |
| UC-4-E3 | Disk space exhausted during extraction | TC-4.6 |
| UC-4-EC1 | install.sh runs from a working directory other than SDLC repo root | TC-4.7 |
| UC-5 | First-time install on linux-x64 | TC-CP-3 |
| UC-5-E1 | linux-x64 host's `glibc` version below bblanchon binary requirements | TC-5.1 |
| UC-6 | First-time install on darwin-x64 | TC-CP-2 |
| UC-6-E1 | darwin-x64 host's macOS notarization rejects unsigned dylib | TC-6.1 |
| UC-7 | First-time install on linux-arm64 | TC-CP-4 |
| UC-7-E1 | linux-arm64 host's CPU older than bblanchon binary's compiler target | TC-7.1 |
| UC-8 | install.sh runs but PDFium download fails -- graceful degradation | TC-8.1 |
| UC-8-EC1 | User has PDFium installed manually outside `~/.claude/tools/sdlc-knowledge/pdfium/` | TC-8.2 |
| UC-9 | `sdlc-knowledge ingest <pdf>` when PDFium absent -- per-file failure | TC-9.1 |
| UC-9-EC1 | Mixed batch (sample.md + sample.pdf) with PDFium absent | TC-9.2 |
| UC-9-EC2 | Search and management subcommands work normally with PDFium absent | TC-9.3 |
| UC-10 | `sdlc-knowledge delete --by-id <int>` removes stale-source row outside project-root | TC-10.1 |
| UC-10-A1 | `--by-id` without `--json` -- human-readable output | TC-10.2 |
| UC-10-E1 | `--by-id <int>` with id whose `source_path` is OUTSIDE project-root | TC-10.3 |
| UC-10-E2 | `--by-id <negative-int>` or non-numeric -- clap arg-parse failure | TC-10.4 |
| UC-10-E3 | `--by-id <int>` where DB-open fails on corrupt index | TC-10.5 |
| UC-11 | `delete --by-id <int>` for non-existent id | TC-11.1 |
| UC-11-EC1 | Race condition -- id existed at start but concurrently deleted | TC-11.2 |
| UC-12 | Legacy `delete <source-path>` continues to work | TC-12.1 |
| UC-12-E1 | Legacy path-based delete on path that escapes project-root | TC-12.2 |
| UC-12-E2 | Legacy path-based delete with no matching row | TC-12.3 |
| UC-13 | Re-ingest of previously-extracted PDF -- sha256 idempotent no-op | TC-13.1 |
| UC-13-A1 | mtime changed but sha256 did not | TC-13.2 |
| UC-13-EC1 | iter-1 index.db opened by iter-2 binary first time | TC-13.3 |
| UC-14 | Re-ingest after `delete --by-id` then re-ingest -- fresh pdfium-render extraction | TC-14.1 |
| UC-14-A1 | One-time corpus refresh after iter-2 ships | TC-14.2 |
| UC-14-E1 | Re-ingest under iter-2 produces fewer chunks than iter-1 baseline minus 50% floor | TC-14.3 |
| UC-15 | `sdlc-knowledge --version` returns `sdlc-knowledge 0.2.0` | TC-15.1 |
| UC-15-A1 | iter-2 binary built from local source via cargo source-build fallback | TC-15.2 |
| UC-16 | `delete --by-id` and `<source-path>` mutual exclusion enforced | TC-16.1 |
| UC-16-EC1 | Neither `--by-id` nor `<source-path>` supplied | TC-16.2 |
| UC-CC-1 | Cross-platform install matrix (4 platforms) | TC-CP-1 through TC-CP-4 |
| UC-CC-2 | Invariant preservation -- 17 agents, 10 gates, 5 executors, README taglines | TC-INV-1 through TC-INV-9 |
| UC-CC-3 | Cargo.toml dep swap -- pdf-extract removed, pdfium-render added; binary ≤ 10 MB | TC-CC-3.1, TC-CC-3.2, TC-AAI-3 |
| UC-CC-4 | Citation format / agent activation contract / CLI surface from §11 UNCHANGED | TC-CC-4.1 |
| UC-CC-5 | Knowledge-base mandate continues to fire correctly (12 thinking agents) | TC-CC-5.1 |

---

## AC Coverage

Every AC-1 through AC-9 from PRD §12.5 maps to one or more test cases below.

| AC | Description | Test Cases |
|----|-------------|------------|
| AC-1 | pdfium-render dependency swap clean (`cargo tree -p pdfium-render` matches; `cargo tree -p pdf-extract` exit 1) | TC-CC-3.1, TC-CC-3.2, TC-AAI-3 |
| AC-2 | Calibre PDF round-trips correctly with ≥ (file_size_kb / 20) chunks and ≥ 1 alphabetic word ≥ 5 chars | TC-1.1, TC-1.2, TC-1.4, TC-AAI-4, TC-CP-1 through TC-CP-4 |
| AC-3 | Re-ingest is a no-op (`unchanged: <path>`) | TC-13.1, TC-13.2, TC-13.3 |
| AC-4 | Search round-trip on calibre fixture returns positive BM25 score | TC-1.2, TC-CP-1 through TC-CP-4 |
| AC-5 | install.sh PDFium download per-platform within 90 s; idempotent re-run | TC-4.1, TC-4.2, TC-CP-1 through TC-CP-4 |
| AC-6 | PDFium absent -- graceful degradation; `panicked at` MUST NOT appear | TC-3.1, TC-3.3, TC-4.4, TC-4.5, TC-4.6, TC-5.1, TC-6.1, TC-7.1, TC-8.1, TC-8.2, TC-9.1, TC-9.2, TC-9.3 |
| AC-7 | `delete --by-id` works; non-existent id exits 1 with literal message | TC-10.1, TC-10.2, TC-10.3, TC-10.4, TC-10.5, TC-11.1, TC-11.2, TC-14.1 |
| AC-8 | `delete --by-id` and `<source-path>` mutual exclusion -- exit 2 with literal message | TC-16.1, TC-16.2 |
| AC-9 | GitHub Actions matrix smoke passes on all 4 platforms | TC-CP-1, TC-CP-2, TC-CP-3, TC-CP-4 |

---

## 1. UC-1: Ingest a Calibre-Converted PDF with Composite CID Fonts

### TC-1.1: Calibre fixture ingests with ≥ 50 chunks/MB and at least one alphabetic word ≥ 5 chars
- **Category:** Ingest / Happy Path
- **Mapped UC:** UC-1
- **Mapped FR:** FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.6, FR-1.7, FR-6.1, FR-6.2, NFR-4
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` is present (per `bash install.sh --yes` having run); the fixture `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` exists per FR-6.1 (≤ 200 KB per architect MINOR; see TC-AAI-4); `<tmpdir>/.claude/knowledge/index.db` is empty or absent
- **Inputs:** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>`
- **Steps:**
  1. Compute fixture size in bytes: `FILE_BYTES=$(stat --printf=%s tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf)`
  2. Compute expected minimum chunks: `MIN_CHUNKS=$((FILE_BYTES / 20480))` (≥ 50 chunks/MB per NFR-4)
  3. Run the ingest invocation; capture exit code `$?` and stderr
  4. Assert exit code `0`
  5. Open `<tmpdir>/.claude/knowledge/index.db` and run `SELECT COUNT(*) FROM documents WHERE source_path LIKE '%calibre-sample.pdf';` -- expect `1`
  6. Run `SELECT COUNT(*) FROM chunks WHERE doc_id = (SELECT id FROM documents WHERE source_path LIKE '%calibre-sample.pdf');` -- expect `>= MIN_CHUNKS`
  7. Run `SELECT text FROM chunks WHERE doc_id = (SELECT id FROM documents WHERE source_path LIKE '%calibre-sample.pdf') LIMIT 100;` -- assert at least one row contains an alphabetic word of length ≥ 5 (regex `[A-Za-z]{5,}`)
  8. Assert stderr does NOT contain the literal `panicked at`
- **Expected Result:** Exit 0; one `documents` row; chunk count ≥ `(FILE_BYTES / 20480)`; at least one chunk has a 5+ char alphabetic word; no panic in stderr
- **Pass Criteria:** AC-2 chunks-per-MB floor satisfied; FR-6.2 alphabetic-content assertion satisfied

### TC-1.2: Search round-trip on calibre fixture returns positive BM25 score
- **Category:** Ingest+Search / Happy Path
- **Mapped UC:** UC-1
- **Mapped FR:** FR-1.1 through FR-1.7
- **Mapped AC:** AC-2, AC-4
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** TC-1.1 has succeeded; one phrase known to be in the fixture is recorded in the test source (e.g., a noun phrase from the public-domain source text)
- **Inputs:** `sdlc-knowledge search "<known-phrase>" --top-k 5 --json --project-root <tmpdir>`
- **Steps:**
  1. Run the search invocation; capture stdout
  2. Parse JSON; assert array length ≥ 1
  3. Assert the first element's `source` field ends with `calibre-sample.pdf`
  4. Assert the first element's `score` field is `> 0` (positive BM25 per §11 search.rs convention)
- **Expected Result:** JSON array non-empty; first element matches the fixture; score > 0
- **Pass Criteria:** AC-4 satisfied

### TC-1.3: Calibre fixture extracted text below 50 MB budget gate -- happy path
- **Category:** Ingest / Boundary
- **Mapped UC:** UC-1-A1
- **Mapped FR:** FR-1.5
- **Mapped AC:** AC-2
- **Type:** unit
- **Severity:** P2
- **Preconditions:** Test calls `pdf::read` directly on the fixture
- **Inputs:** Direct unit-test invocation
- **Steps:**
  1. Call `pdf::read(<fixture-path>)` and capture the returned `String`
  2. Assert `result.len() < 50 * 1024 * 1024`
  3. Assert no `IngestError::PdfBudgetExceeded` was raised
- **Expected Result:** Extracted string length below 50 MB; no budget error
- **Pass Criteria:** FR-1.5 byte-budget gate passes for the small fixture

### TC-1.4: Calibre fixture with multiple `/Type0` CID fonts -- composite font handling
- **Category:** Ingest / Font Coverage
- **Mapped UC:** UC-1-A2
- **Mapped FR:** FR-1.4, NFR-4
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P1
- **Preconditions:** The vendored fixture is documented per FR-6.3 to contain `/Type0` composite CID fonts with `/ToUnicode` CMaps (per the iter-1 failure mode the fixture is meant to reproduce)
- **Inputs:** Same as TC-1.1
- **Steps:**
  1. Run `sdlc-knowledge ingest <fixture> --project-root <tmpdir>` per TC-1.1
  2. Assert chunks/MB ≥ 50 per NFR-4
  3. Independently run `pdftotext <fixture>` (or `pypdf2` extraction) and capture a reference text length
  4. Assert the iter-2 extracted text is within ±20% of the reference length (proves CID decoding is comparable to a known-good extractor)
- **Expected Result:** chunks/MB ≥ 50; extracted text length within ±20% of reference
- **Pass Criteria:** PDFium correctly decodes CID fonts; iter-1 failure mode is closed

### TC-1.5: Calibre fixture is encrypted with non-empty password
- **Category:** Ingest / Encryption
- **Mapped UC:** UC-1-E1
- **Mapped FR:** FR-1.3, FR-2.4, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P1
- **Preconditions:** A separate fixture `tools/sdlc-knowledge/tests/fixtures/encrypted-sample.pdf` exists with a non-empty password set (test-only fixture)
- **Inputs:** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/encrypted-sample.pdf --project-root <tmpdir>`
- **Steps:**
  1. Run the invocation; capture stderr and exit code
  2. Assert stderr contains the literal substring `password-protected; not supported in iter-2`
  3. Assert stderr does NOT contain `panicked at`
  4. Single-file invocation: assert exit 1
  5. Assert `documents` table has 0 rows for the encrypted fixture
- **Expected Result:** stderr contains the FR-1.3 literal; no panic; exit 1; no DB rows written
- **Pass Criteria:** FR-1.3 password-protected error path verified

### TC-1.6: Calibre fixture has 0 pages (degenerate)
- **Category:** Ingest / Edge
- **Mapped UC:** UC-1-E2
- **Mapped FR:** FR-1.4, FR-1.5
- **Mapped AC:** AC-2 (floor inapplicable)
- **Type:** integration
- **Severity:** P3
- **Preconditions:** A fixture `tools/sdlc-knowledge/tests/fixtures/zero-page.pdf` exists (a structurally valid PDF with zero pages)
- **Inputs:** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/zero-page.pdf --project-root <tmpdir>`
- **Steps:**
  1. Run the invocation; capture exit code
  2. Assert exit `0`
  3. Assert one new row in `documents` for the fixture
  4. Assert `chunks` table has 0 rows for that document id
  5. Assert no `panicked at` in stderr
- **Expected Result:** Exit 0; one documents row; zero chunks; no panic
- **Pass Criteria:** Gracefully-zero outcome documented

### TC-1.7: Calibre fixture extraction exceeds 50 MB byte budget
- **Category:** Ingest / Defense-in-depth
- **Mapped UC:** UC-1-EC1
- **Mapped FR:** FR-1.5
- **Mapped AC:** (no direct AC; defense-in-depth)
- **Type:** unit
- **Severity:** P3
- **Preconditions:** Test injects a hypothetical fixture whose extracted text exceeds 50 MB (mocked via `extract_via_closure_for_test` returning a > 50 MB string)
- **Inputs:** Direct unit-test invocation
- **Steps:**
  1. Inject a closure returning a 51 MB string into `extract_via_closure_for_test`
  2. Call the wrapper that invokes `check_byte_budget`
  3. Assert the returned `Result` is `Err(IngestError::PdfBudgetExceeded)`
  4. Assert no panic
- **Expected Result:** `IngestError::PdfBudgetExceeded` returned; no panic
- **Pass Criteria:** FR-1.5 budget gate fires correctly

---

## 2. UC-2: Ingest Normal PDF (Existing iter-1 sample.pdf) -- Equivalent or Better Than pdf-extract

### TC-2.1: sample.pdf chunk count under iter-2 ≥ 50% of iter-1 baseline
- **Category:** Ingest / Regression Floor
- **Mapped UC:** UC-2
- **Mapped FR:** FR-1.1 through FR-1.7, R-5
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `tools/sdlc-knowledge/tests/fixtures/sample.pdf` exists from §11 Slice 2; an iter-1 baseline chunk count is recorded at `tools/sdlc-knowledge/tests/fixtures/sample.pdf.iter1-baseline.txt` (a single integer, written during the iter-1 implementation)
- **Inputs:** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/sample.pdf --project-root <tmpdir>`
- **Steps:**
  1. Read `BASELINE` from `sample.pdf.iter1-baseline.txt`
  2. Run the ingest invocation; capture exit code
  3. Query `SELECT COUNT(*) FROM chunks WHERE doc_id = (SELECT id FROM documents WHERE source_path LIKE '%sample.pdf');` -- record `ITER2_CHUNKS`
  4. Assert exit `0`
  5. Assert `ITER2_CHUNKS >= BASELINE / 2`
  6. Assert `ITER2_CHUNKS >= 1`
  7. Assert at least one chunk contains an alphabetic word ≥ 5 chars
- **Expected Result:** Exit 0; chunk count ≥ baseline/2; at least one alphabetic chunk
- **Pass Criteria:** R-5 catastrophic-regression floor satisfied

### TC-2.2: sample.pdf chunk count under iter-2 HIGHER than iter-1 baseline
- **Category:** Ingest / Quality Improvement
- **Mapped UC:** UC-2-A1
- **Mapped FR:** FR-1.4, R-5
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Same as TC-2.1
- **Inputs:** Same as TC-2.1
- **Steps:**
  1. Run TC-2.1 procedure
  2. If `ITER2_CHUNKS > BASELINE`, write the new value to `sample.pdf.iter2-baseline.txt` for tracking
  3. Assert no DB integrity errors
- **Expected Result:** chunk count > baseline; new baseline recorded
- **Pass Criteria:** PDFium extracts more text than pdf-extract on the same fixture

### TC-2.3: sample.pdf chunk count BELOW 50% of iter-1 baseline -- catastrophic regression
- **Category:** Ingest / Regression Detection
- **Mapped UC:** UC-2-E1
- **Mapped FR:** R-5
- **Mapped AC:** AC-2 (negative path)
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Same as TC-2.1 but with deliberately mocked PDFium to return short text
- **Inputs:** Same as TC-2.1 with `extract_via_closure_for_test` returning a degraded string
- **Steps:**
  1. Inject a closure returning text 30% the size of the natural extraction
  2. Run the ingest test
  3. Assert the test FAILS with the message `iter2_chunks (<N>) < iter1_baseline (<M>) / 2`
- **Expected Result:** Test fails with explicit regression message
- **Pass Criteria:** Regression-detection guard fires; iter-2 cannot ship until closed

---

## 3. UC-3: Ingest Corrupt PDF -- Per-File Error, Batch Continues

### TC-3.1: Directory batch with corrupt.pdf and valid files -- batch exits 0, corrupt error logged
- **Category:** Ingest / Per-File Error Boundary
- **Mapped UC:** UC-3
- **Mapped FR:** FR-1.6, FR-2.4, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `tools/sdlc-knowledge/tests/fixtures/` contains `corrupt.pdf` (from §11 Slice 2), `sample.md`, `sample.txt`, plus the calibre fixture
- **Inputs:** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/ --project-root <tmpdir>`
- **Steps:**
  1. Run the invocation; capture exit code, stdout, stderr
  2. Assert exit `0` (at least one file succeeded)
  3. Assert stderr contains exactly one line referencing `corrupt.pdf` and a pdfium-derived error reason
  4. Assert stderr does NOT contain `panicked at`
  5. Query `documents`; assert rows for sample.md, sample.txt, calibre-sample.pdf
  6. Assert NO row for corrupt.pdf
- **Expected Result:** Per-file error printed; batch continues; exit 0; valid files indexed
- **Pass Criteria:** §11 FR-2.6 / NFR-5 fault-isolation contract preserved

### TC-3.2: corrupt.pdf is the ONLY file in directory -- exit 1
- **Category:** Ingest / Single-File Failure
- **Mapped UC:** UC-3-A1
- **Mapped FR:** FR-2.4, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P2
- **Preconditions:** A directory containing only `corrupt.pdf`
- **Inputs:** `sdlc-knowledge ingest <dir-with-only-corrupt> --project-root <tmpdir>`
- **Steps:**
  1. Create temp dir containing only `corrupt.pdf`
  2. Run the invocation
  3. Assert exit `1`
  4. Assert stderr contains the per-file error line
  5. Assert stderr does NOT contain `panicked at`
- **Expected Result:** Exit 1; per-file error; no panic
- **Pass Criteria:** Single-file batch exit-code semantics correct

### TC-3.3: Native pdfium panic surfacing through FFI -- catch_unwind contains it
- **Category:** Ingest / Defense-in-depth
- **Mapped UC:** UC-3-E1
- **Mapped FR:** FR-1.6, FR-1.7, FR-2.4
- **Mapped AC:** AC-6
- **Type:** unit / security
- **Severity:** P0
- **Preconditions:** `extract_via_closure_for_test` test seam is preserved per FR-1.7 with the iter-1 signature
- **Inputs:** Direct unit-test invocation injecting a panicking closure
- **Steps:**
  1. Verify `extract_via_closure_for_test` exists in `tools/sdlc-knowledge/src/pdf.rs` with a `pub(crate)` (or test-cfg) signature unchanged from iter-1
  2. Inject a closure that calls `panic!("simulated FFI panic")`
  3. Call the wrapper that invokes `catch_unwind`
  4. Assert the returned `Result` is `Err(IngestError::PdfDecode(...))`
  5. Assert the test process does NOT abort
  6. Run `git log -p -- tools/sdlc-knowledge/src/pdf.rs` and verify the seam signature did NOT change between iter-1 and iter-2
- **Expected Result:** Panic translated into `IngestError::PdfDecode`; test process survives
- **Pass Criteria:** §11 TC-SEC-2.1 inheritance preserved; FR-1.6 / FR-1.7 contract held

### TC-3.4: Structurally-valid PDF with zero extractable text (image-only / no text layer)
- **Category:** Ingest / OCR-Required Edge
- **Mapped UC:** UC-3-EC1
- **Mapped FR:** FR-1.4, 12.7 item 2
- **Mapped AC:** (no direct AC; documented out-of-scope)
- **Type:** integration
- **Severity:** P3
- **Preconditions:** A fixture `tools/sdlc-knowledge/tests/fixtures/scanned-no-text.pdf` exists (image-only PDF with no embedded text layer)
- **Inputs:** `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/scanned-no-text.pdf --project-root <tmpdir>`
- **Steps:**
  1. Run the invocation
  2. Assert exit `0`
  3. Assert one row exists in `documents` for the fixture
  4. Assert 0 rows in `chunks` for that doc_id
  5. Assert no `panicked at` in stderr
- **Expected Result:** Exit 0; one documents row; zero chunks; no panic
- **Pass Criteria:** OCR-required case documented; not an error per §12.7 item 2

---

## 4. UC-4: First-Time Install on darwin-arm64 -- PDFium Binary Download

### TC-4.1: Fresh install on darwin-arm64 places libpdfium.dylib at expected path within 90 s
- **Category:** Install / Happy Path
- **Mapped UC:** UC-4
- **Mapped FR:** FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.6, FR-3.7
- **Mapped AC:** AC-5
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Host is darwin-arm64; `~/.claude/tools/sdlc-knowledge/pdfium/` does NOT exist; network reachable to GitHub Releases; `install.sh` declares the pinned `chromium/<version>` tag at the top
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`
  2. Record start timestamp `T0`
  3. Run `bash install.sh --yes` from the SDLC repo root
  4. Record end timestamp `T1`
  5. Assert `T1 - T0 ≤ 90` seconds
  6. Assert `test -f ~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib`
  7. Assert `stat --printf=%s ~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` returns `> 0`
  8. Assert exit code 0
- **Expected Result:** dylib at expected path; non-zero size; ≤ 90 s; exit 0
- **Pass Criteria:** AC-5 satisfied for darwin-arm64

### TC-4.2: Re-running install.sh with PDFium already at pinned tag -- idempotent no-op
- **Category:** Install / Idempotency
- **Mapped UC:** UC-4-A1
- **Mapped FR:** FR-3.7
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P1
- **Preconditions:** TC-4.1 has succeeded; dylib + version-marker present
- **Inputs:** `bash install.sh --yes` (second run)
- **Steps:**
  1. Compute sha256 of `libpdfium.dylib`; record `H1`
  2. Record file mtime `M1`
  3. Record start timestamp `T0`
  4. Run `bash install.sh --yes`
  5. Record end timestamp `T1`
  6. Compute sha256 again; record `H2`
  7. Record mtime; record `M2`
  8. Assert `H1 == H2`
  9. Assert `M1 == M2` (no re-download)
  10. Assert `T1 - T0 < 30` seconds (well under 90 s -- no network round-trip)
- **Expected Result:** dylib unchanged; mtime unchanged; second run faster than first
- **Pass Criteria:** FR-3.7 idempotent install verified

### TC-4.3: Maintainer bumps pinned `chromium/<version>` tag -- re-download triggers
- **Category:** Install / Version Bump
- **Mapped UC:** UC-4-A2
- **Mapped FR:** FR-3.3, FR-3.7
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P2
- **Preconditions:** TC-4.1 has succeeded; `install.sh` has the `chromium/<int>` tag declared at the top
- **Inputs:** Edited `install.sh` with bumped tag, then `bash install.sh --yes`
- **Steps:**
  1. Read existing version-marker contents `V1`
  2. Edit `install.sh` to use a new (test-fixture) `chromium/<int+100>` tag
  3. Run `bash install.sh --yes`
  4. Read version-marker contents `V2`
  5. Assert `V2 != V1`
  6. Assert `libpdfium.dylib` mtime updated
- **Expected Result:** Re-download triggered; dylib replaced; version-marker updated
- **Pass Criteria:** FR-3.3 single-line bump path verified

### TC-4.4: bblanchon/pdfium-binaries asset URL returns 404 -- graceful degradation
- **Category:** Install / Network Failure
- **Mapped UC:** UC-4-E1
- **Mapped FR:** FR-3.5, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `~/.claude/tools/sdlc-knowledge/pdfium/` does not exist; network is mocked to return 404 on the bblanchon asset URL
- **Inputs:** `bash install.sh --yes` with the network mocked
- **Steps:**
  1. Mock `curl`/`wget` to return 404 on the bblanchon URL
  2. Run `bash install.sh --yes`; capture stdout/stderr
  3. Assert exit 0 (graceful degradation)
  4. Assert transcript contains the literal `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected`
  5. Assert `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` does NOT exist
  6. Assert iter-1 install state is intact (binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`, allowlist registered)
- **Expected Result:** Literal warning emitted; install exit 0; iter-1 state intact
- **Pass Criteria:** FR-3.5 graceful-degradation contract verified

### TC-4.5: PDFium archive malformed/truncated -- extraction fails
- **Category:** Install / Archive Corruption
- **Mapped UC:** UC-4-E2
- **Mapped FR:** FR-3.5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Network mocked to return a truncated archive (HTTP 200 with malformed gzip body)
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Mock the download to return a truncated `.tgz` body
  2. Run `bash install.sh --yes`
  3. Assert tar/extraction step returns non-zero
  4. Assert script removes any partial extraction (no orphaned files in `~/.claude/tools/sdlc-knowledge/pdfium/`)
  5. Assert transcript contains the FR-3.5 literal warning
  6. Assert exit 0
- **Expected Result:** Extraction fails; partials cleaned; warning logged; exit 0
- **Pass Criteria:** Archive corruption handled gracefully

### TC-4.6: Disk space exhausted during PDFium archive extraction (ENOSPC)
- **Category:** Install / Resource Failure
- **Mapped UC:** UC-4-E3
- **Mapped FR:** FR-3.5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Mocked filesystem with limited free space (e.g., temp disk image)
- **Inputs:** `bash install.sh --yes` with limited disk
- **Steps:**
  1. Mount a small tmpfs at `~/.claude/tools/sdlc-knowledge/pdfium/`
  2. Run `bash install.sh --yes`
  3. Assert tar extraction fails with ENOSPC
  4. Assert script removes partial extraction
  5. Assert transcript contains the FR-3.5 literal warning enriched with disk-space context
- **Expected Result:** Disk-space failure handled; warning logged
- **Pass Criteria:** ENOSPC path documented and graceful

### TC-4.7: install.sh runs from a working directory other than SDLC repo root -- SCRIPT_DIR
- **Category:** Install / cwd Independence
- **Mapped UC:** UC-4-EC1
- **Mapped FR:** FR-3.6, R-6
- **Mapped AC:** AC-5
- **Type:** integration / E2E
- **Severity:** P1
- **Preconditions:** SDLC repo cloned at `/home/<user>/sdlc/`; user runs install.sh from `/tmp`
- **Inputs:** `cd /tmp && bash /home/<user>/sdlc/install.sh --yes`
- **Steps:**
  1. `cd /tmp`
  2. Run `bash /home/<user>/sdlc/install.sh --yes`
  3. Assert exit 0
  4. Assert `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` exists
  5. Assert no `SCRIPT_DIR`-related error in stderr
- **Expected Result:** Install completes correctly regardless of cwd
- **Pass Criteria:** FR-3.6 SCRIPT_DIR re-invocation pattern verified

---

## 5. UC-5: First-Time Install on linux-x64

### TC-5.1: linux-x64 host's glibc version below bblanchon binary requirements
- **Category:** Install / glibc Compatibility
- **Mapped UC:** UC-5-E1
- **Mapped FR:** FR-1.2, R-8
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P2
- **Preconditions:** A linux-x64 host with glibc older than the bblanchon binary's minimum (e.g., RHEL 7 with glibc 2.17)
- **Inputs:** `sdlc-knowledge ingest <pdf> --project-root <tmpdir>` after install on glibc-old host
- **Steps:**
  1. On a glibc-old host, run `bash install.sh --yes` (download succeeds; dylib extracts)
  2. Run `sdlc-knowledge ingest <pdf>`
  3. Assert exit 1
  4. Assert stderr contains the FR-1.2 literal `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes` OR a more specific glibc-incompatibility message
  5. Assert stderr does NOT contain `panicked at`
- **Expected Result:** Load failure surfaces as `IngestError::PdfDecode`; no panic
- **Pass Criteria:** R-8 hardened-runtime path documented

---

## 6. UC-6: First-Time Install on darwin-x64

### TC-6.1: darwin-x64 macOS notarization rejects unsigned dylib (Gatekeeper)
- **Category:** Install / macOS Notarization
- **Mapped UC:** UC-6-E1
- **Mapped FR:** FR-1.2, R-8
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P2
- **Preconditions:** darwin-x64 host with strict Gatekeeper; bblanchon binary not signed by a Apple-trusted authority
- **Inputs:** `sdlc-knowledge ingest <pdf> --project-root <tmpdir>` after install
- **Steps:**
  1. After `bash install.sh --yes`, attempt `sdlc-knowledge ingest <pdf>`
  2. If Gatekeeper blocks the dylib, assert stderr contains the FR-1.2 literal load-failure message
  3. Assert no `panicked at`
  4. Documented remediation per FR-8.3: `xattr -d com.apple.quarantine ~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib`
- **Expected Result:** Gatekeeper-block surfaces as `IngestError::PdfDecode`; remediation documented
- **Pass Criteria:** R-8 macOS path documented

---

## 7. UC-7: First-Time Install on linux-arm64

### TC-7.1: linux-arm64 host CPU older than bblanchon binary's compiler target
- **Category:** Install / ABI Mismatch
- **Mapped UC:** UC-7-E1
- **Mapped FR:** FR-1.2, R-8
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P3
- **Preconditions:** A linux-arm64 host with an older ARM CPU (e.g., ARMv7 vs the binary's ARMv8 target)
- **Inputs:** `sdlc-knowledge ingest <pdf>` after install
- **Steps:**
  1. After install, attempt `sdlc-knowledge ingest <pdf>`
  2. CPU instruction trap surfaces as `IngestError::PdfDecode`
  3. Assert stderr contains FR-1.2 literal
  4. Assert no `panicked at`
- **Expected Result:** ABI mismatch surfaces as load failure; no panic
- **Pass Criteria:** R-8 ARM path documented

---

## 8. UC-8: install.sh Runs but PDFium Download Fails -- Graceful Degradation

### TC-8.1: Network unreachable during install -- iter-1 state intact, MD/TXT ingest works
- **Category:** Install / Graceful Degradation
- **Mapped UC:** UC-8
- **Mapped FR:** FR-3.5, NFR-5, FR-5.1
- **Mapped AC:** AC-6
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Network blocked entirely (firewall rule)
- **Inputs:** `bash install.sh --yes` with no network
- **Steps:**
  1. Block outbound network
  2. Run `bash install.sh --yes`; capture transcript and exit code
  3. Assert exit 0
  4. Assert transcript contains the FR-3.5 literal warning
  5. Assert `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` does NOT exist
  6. Run `sdlc-knowledge ingest <some.md> --project-root <tmpdir>`; assert exit 0 and one chunks row
  7. Run `sdlc-knowledge ingest <some.pdf>`; assert exit 1 with FR-1.2 literal
- **Expected Result:** Install graceful; MD ingest works; PDF ingest fails per UC-9
- **Pass Criteria:** NFR-5 fault-isolation verified

### TC-8.2: User has PDFium installed manually outside `~/.claude/tools/sdlc-knowledge/pdfium/`
- **Category:** Install / System-Wide PDFium
- **Mapped UC:** UC-8-EC1
- **Mapped FR:** FR-1.2, FR-3.4
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P3
- **Preconditions:** PDFium dylib installed via `brew install pdfium` (or equivalent) at `/usr/local/lib/libpdfium.dylib`; `~/.claude/tools/sdlc-knowledge/pdfium/` does NOT exist
- **Inputs:** `sdlc-knowledge ingest <pdf> --project-root <tmpdir>`
- **Steps:**
  1. Verify `/usr/local/lib/libpdfium.dylib` exists
  2. Verify `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` does NOT exist
  3. Run `sdlc-knowledge ingest <pdf>`
  4. **Per architect [STRUCTURAL] action item**, the binary uses `Pdfium::bind_to_library(<absolute-path>)` pointing only at `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` -- the system-wide install is intentionally NOT discovered (R-1 mitigation)
  5. Assert exit 1 with FR-1.2 literal
- **Expected Result:** System-wide PDFium NOT used (per [STRUCTURAL] explicit-path binding); FR-1.2 error surfaces
- **Pass Criteria:** R-1 dynamic-library-hijack mitigation verified -- only the install.sh-fetched binary is used

---

## 9. UC-9: `sdlc-knowledge ingest <pdf>` When PDFium Absent

### TC-9.1: Single-file PDF ingest with PDFium absent -- exit 1, FR-1.2 literal
- **Category:** Ingest / PDFium Absent
- **Mapped UC:** UC-9
- **Mapped FR:** FR-1.2, FR-5.1, FR-5.2, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `~/.claude/tools/sdlc-knowledge/pdfium/` is removed; iter-2 binary installed; one PDF file at `<pdf-path>`
- **Inputs:** `sdlc-knowledge ingest <pdf-path> --project-root <tmpdir>`
- **Steps:**
  1. `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`
  2. Run the invocation; capture exit code and stderr
  3. Assert exit 1
  4. Assert stderr contains the literal `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes`
  5. Assert stderr does NOT contain `panicked at`
  6. Assert `documents` table has 0 rows for the PDF
- **Expected Result:** Exit 1; literal error; no panic; no DB rows
- **Pass Criteria:** FR-1.2 / FR-5.2 contract verified

### TC-9.2: Mixed batch (sample.md + sample.pdf) with PDFium absent -- batch exit 0
- **Category:** Ingest / Mixed Batch / PDFium Absent
- **Mapped UC:** UC-9-EC1
- **Mapped FR:** FR-5.1, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P0
- **Preconditions:** PDFium removed; directory contains `sample.md` and `sample.pdf`
- **Inputs:** `sdlc-knowledge ingest <dir> --project-root <tmpdir>`
- **Steps:**
  1. `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`
  2. Create dir with `sample.md` and `sample.pdf`
  3. Run the invocation; capture exit and stderr
  4. Assert exit 0 (md succeeded)
  5. Assert stderr contains exactly one `pdfium dynamic library not found ...` line for `sample.pdf`
  6. Assert stderr does NOT contain `panicked at`
  7. Query `documents`; assert one row for `sample.md`, zero for `sample.pdf`
  8. Query `chunks`; assert ≥ 1 chunk for `sample.md`
- **Expected Result:** MD ingested; PDF fails per-file; batch exits 0
- **Pass Criteria:** NFR-5 fault-isolation per-file boundary verified

### TC-9.3: Search and management subcommands work normally with PDFium absent
- **Category:** Read-Side Fault Isolation
- **Mapped UC:** UC-9-EC2
- **Mapped FR:** FR-5.3, NFR-5
- **Mapped AC:** AC-6
- **Type:** integration
- **Severity:** P1
- **Preconditions:** PDFium removed; `index.db` contains previously-indexed content (e.g., from TC-9.2 leftover MD)
- **Inputs:** `sdlc-knowledge search "<query>" --top-k 5 --json --project-root <tmpdir>`; `list`; `status`; `delete`
- **Steps:**
  1. `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`
  2. Run `sdlc-knowledge search "<known-phrase>" --top-k 5 --json --project-root <tmpdir>`; assert exit 0 and non-empty JSON array
  3. Run `sdlc-knowledge list --json`; assert exit 0
  4. Run `sdlc-knowledge status --json`; assert exit 0
  5. Run `sdlc-knowledge delete --by-id <some-id> --json`; assert exit 0
- **Expected Result:** All four subcommands work without PDFium
- **Pass Criteria:** FR-5.3 / NFR-5 read-side isolation verified

---

## 10. UC-10: `sdlc-knowledge delete --by-id <int>` Removes a Stale-Source Row

### TC-10.1: `--by-id <int>` removes documents row plus dependent chunks transactionally
- **Category:** Delete / Happy Path
- **Mapped UC:** UC-10
- **Mapped FR:** FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5
- **Mapped AC:** AC-7
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `index.db` contains a row in `documents` with id `<N>` and 50 dependent chunks
- **Inputs:** `sdlc-knowledge delete --by-id <N> --json --project-root <tmpdir>`
- **Steps:**
  1. Query: `SELECT id, source_path FROM documents;` record id `<N>` and source_path `<P>`
  2. Query: `SELECT COUNT(*) FROM chunks WHERE doc_id = <N>;` record `<C>`
  3. Run the delete invocation; capture stdout
  4. Parse JSON; assert it equals `{"deleted_id": <N>, "source_path": "<P>", "chunks_removed": <C>}`
  5. Assert exit 0
  6. Query: `SELECT COUNT(*) FROM documents WHERE id = <N>;` -- expect 0
  7. Query: `SELECT COUNT(*) FROM chunks WHERE doc_id = <N>;` -- expect 0
  8. Query: `SELECT COUNT(*) FROM chunks_fts WHERE rowid IN (SELECT id FROM chunks WHERE doc_id = <N>);` -- expect 0
- **Expected Result:** JSON shape matches FR-4.5; all rows removed; FTS5 trigger cascaded
- **Pass Criteria:** AC-7 happy path verified

### TC-10.2: `--by-id` without `--json` -- human-readable output
- **Category:** Delete / Output Format
- **Mapped UC:** UC-10-A1
- **Mapped FR:** FR-4.5
- **Mapped AC:** AC-7
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Same as TC-10.1
- **Inputs:** `sdlc-knowledge delete --by-id <N> --project-root <tmpdir>` (no `--json`)
- **Steps:**
  1. Run the invocation; capture stdout
  2. Assert exit 0
  3. Assert stdout matches a human-readable format like `deleted document <N> at <P> (<C> chunks)` per the iter-1 text-output convention
- **Expected Result:** Human-readable line; exit 0
- **Pass Criteria:** AC-7 text-output path

### TC-10.3: `--by-id <int>` with id whose source_path is OUTSIDE project-root
- **Category:** Delete / Stale-Row Cleanup
- **Mapped UC:** UC-10-E1
- **Mapped FR:** FR-4.3
- **Mapped AC:** AC-7
- **Type:** integration / security
- **Severity:** P0
- **Preconditions:** `index.db` contains a row whose `source_path` does NOT canonicalize under the current project-root (e.g., `/some/old/path/file.pdf` from a renamed source dir)
- **Inputs:** `sdlc-knowledge delete --by-id <N> --json --project-root <tmpdir>`
- **Steps:**
  1. Insert a `documents` row with `source_path = '/etc/passwd'` (any path outside project-root) and an associated chunks row, for test purposes
  2. Run `sdlc-knowledge delete --by-id <that-id> --json --project-root <tmpdir>`
  3. Assert exit 0
  4. Assert JSON output contains `"source_path": "/etc/passwd"` (the stored value, not canonicalized)
  5. Assert the row is removed
  6. **Security note**: this passes BECAUSE FR-4.3 explicitly allows it -- the project-root gate at DB-open is the security boundary, not the path stored in the row. Path-traversal protection of the iter-1 path-based delete is preserved by §11 FR-1.5 inheritance (verified separately by TC-12.2).
- **Expected Result:** Row removed; JSON contains the out-of-tree source_path
- **Pass Criteria:** FR-4.3 stale-row cleanup verified; security boundary preserved at DB-open

### TC-10.4: `--by-id <negative-int>` or non-numeric -- clap arg-parse failure exit 2
- **Category:** Delete / Arg Validation
- **Mapped UC:** UC-10-E2
- **Mapped FR:** FR-4.2
- **Mapped AC:** AC-7
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Iter-2 binary
- **Inputs:** `sdlc-knowledge delete --by-id -5 --project-root <tmpdir>`; `sdlc-knowledge delete --by-id abc --project-root <tmpdir>`
- **Steps:**
  1. Run with `-5`; assert exit 2
  2. Assert stderr contains a clap-driven arg-parse error referencing `--by-id`
  3. Run with `abc`; assert exit 2
  4. Assert no DB mutation occurred (sha256 of `index.db` unchanged across both invocations)
- **Expected Result:** clap rejects negative + non-numeric; exit 2; no DB write
- **Pass Criteria:** FR-4.2 i64-non-negative contract enforced

### TC-10.5: `--by-id <int>` with corrupt index -- §11 FR-1.6 inherited
- **Category:** Delete / Corrupt Index Inheritance
- **Mapped UC:** UC-10-E3
- **Mapped FR:** §11 FR-1.6 inherited
- **Mapped AC:** §11 AC-7 inherited
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `index.db` is truncated to 100 bytes (corrupt)
- **Inputs:** `sdlc-knowledge delete --by-id 5 --project-root <tmpdir>`
- **Steps:**
  1. Truncate `<tmpdir>/.claude/knowledge/index.db` to 100 bytes
  2. Run the invocation
  3. Assert exit 1
  4. Assert stderr contains the literal `error: index database invalid; re-ingest required`
  5. Assert no `panicked at`
- **Expected Result:** Corrupt-index path inherited from §11 FR-1.6
- **Pass Criteria:** §11 corrupt-index handling preserved in iter-2

---

## 11. UC-11: `delete --by-id <int>` for Non-Existent ID

### TC-11.1: Non-existent id -- exit 1 with literal stderr
- **Category:** Delete / Non-Existent
- **Mapped UC:** UC-11
- **Mapped FR:** FR-4.2
- **Mapped AC:** AC-7
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `index.db` contains documents but none with id `999999`
- **Inputs:** `sdlc-knowledge delete --by-id 999999 --project-root <tmpdir>`
- **Steps:**
  1. Capture sha256 of `index.db` as `H1`
  2. Run the invocation; capture exit and stderr
  3. Assert exit 1
  4. Assert stderr contains the literal `error: no document with id 999999`
  5. Capture sha256 again as `H2`
  6. Assert `H1 == H2` (DB byte-identical)
- **Expected Result:** Exit 1; literal message; DB unchanged
- **Pass Criteria:** AC-7 negative path verified; FR-4.2 "NOT touch the database" honored

### TC-11.2: Race condition -- id existed at start, concurrently deleted mid-flight
- **Category:** Delete / Concurrency
- **Mapped UC:** UC-11-EC1
- **Mapped FR:** FR-4.2, FR-4.4
- **Mapped AC:** AC-7
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Test injects a concurrent delete via a second process between the existence check and the DELETE statement
- **Inputs:** Two concurrent invocations: `sdlc-knowledge delete --by-id <N> ...` from process A and process B
- **Steps:**
  1. Process A begins `delete --by-id <N>`
  2. Process B completes `delete --by-id <N>` first
  3. Process A's DELETE affects 0 rows
  4. Per architect Step 3 resolution (Open Question #2 in use-cases file), accept EITHER:
     - (a) Process A exits 0 with `chunks_removed: 0` (idempotent success)
     - (b) Process A exits 1 with `error: no document with id <N>`
  5. Assert no `panicked at` in either process
  6. Assert no DB corruption
- **Expected Result:** One of the two acceptable resolutions; no panic; DB consistent
- **Pass Criteria:** Race-condition path documented; either resolution acceptable per architect

---

## 12. UC-12: Legacy `delete <source-path>` Continues to Work

### TC-12.1: Legacy path-based delete on a path under project-root -- iter-1 behavior unchanged
- **Category:** Delete / Backward Compat
- **Mapped UC:** UC-12
- **Mapped FR:** FR-9.1, FR-4.1 (mutual-exclusion)
- **Mapped AC:** §11 AC-6, AC-7 inherited
- **Type:** integration
- **Severity:** P0
- **Preconditions:** `index.db` contains a row whose `source_path` resolves UNDER project-root
- **Inputs:** `sdlc-knowledge delete <relative-source-path> --project-root <tmpdir>`
- **Steps:**
  1. Identify a row with source_path = `<P>` where `<P>` canonicalizes under project-root
  2. Run the invocation
  3. Assert exit 0
  4. Assert row removed
  5. Assert dependent chunks removed
  6. Assert output shape matches iter-1's exact JSON or text format (BYTE-UNCHANGED per FR-9.1)
- **Expected Result:** iter-1 path-based delete works identically in iter-2
- **Pass Criteria:** FR-9.1 iter-1 BYTE-UNCHANGED contract preserved

### TC-12.2: Legacy path-based delete with path-traversal -- exit 2
- **Category:** Delete / Path-Traversal Defense
- **Mapped UC:** UC-12-E1
- **Mapped FR:** §11 FR-1.5 inherited, FR-4.3 (rationale)
- **Mapped AC:** §11 AC-6
- **Type:** integration / security
- **Severity:** P0
- **Preconditions:** Iter-2 binary
- **Inputs:** `sdlc-knowledge delete ../../../etc/passwd --project-root <tmpdir>`
- **Steps:**
  1. Run the invocation
  2. Assert exit 2
  3. Assert stderr contains literal `error: project-root must resolve under current working directory`
  4. Assert no DB mutation (sha256 of `index.db` unchanged)
- **Expected Result:** §11 path-traversal defense intact; exit 2
- **Pass Criteria:** §11 FR-1.5 / AC-6 inheritance preserved

### TC-12.3: Legacy path-based delete with no matching row -- iter-1 behavior
- **Category:** Delete / No Match
- **Mapped UC:** UC-12-E2
- **Mapped FR:** FR-9.1
- **Mapped AC:** §11 AC-7 inherited
- **Type:** integration
- **Severity:** P2
- **Preconditions:** No row exists with source_path = `<P>`; `<P>` canonicalizes under project-root
- **Inputs:** `sdlc-knowledge delete <P> --project-root <tmpdir>`
- **Steps:**
  1. Run the invocation
  2. Assert iter-1's literal error message (UNCHANGED in iter-2 per FR-9.1) appears in stderr
  3. Assert exit code matches iter-1 (typically 1)
- **Expected Result:** iter-1 contract preserved
- **Pass Criteria:** FR-9.1 byte-unchanged

---

## 13. UC-13: Re-Ingest of Previously-Extracted PDF -- Idempotent No-Op

### TC-13.1: Re-ingesting a PDF written by iter-1 -- `unchanged: <path>` log line
- **Category:** Ingest / Idempotency
- **Mapped UC:** UC-13
- **Mapped FR:** FR-9.7
- **Mapped AC:** AC-3
- **Type:** integration
- **Severity:** P0
- **Preconditions:** A row exists in `documents` for `<pdf-path>` whose `(source_path, mtime, sha256)` tuple matches the on-disk file
- **Inputs:** `sdlc-knowledge ingest <pdf-path> --project-root <tmpdir>` (second time)
- **Steps:**
  1. Capture pre-invocation `documents` and `chunks` row counts as `D1`, `C1`
  2. Capture sha256 of `index.db` as `H1`
  3. Run the invocation; capture stdout/stderr
  4. Capture post-invocation row counts `D2`, `C2`; sha256 `H2`
  5. Assert `D1 == D2` and `C1 == C2`
  6. Assert stdout/stderr contains `unchanged: <pdf-path>`
  7. Assert exit 0
- **Expected Result:** No DB mutation (modulo possible `ingested_at` touch); `unchanged: <path>` logged
- **Pass Criteria:** AC-3 satisfied; FR-9.7 idempotency preserved

### TC-13.2: mtime updated by `touch` but sha256 unchanged
- **Category:** Ingest / Idempotency / mtime
- **Mapped UC:** UC-13-A1
- **Mapped FR:** FR-9.7
- **Mapped AC:** AC-3
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Same as TC-13.1
- **Inputs:** `touch <pdf-path>; sdlc-knowledge ingest <pdf-path> --project-root <tmpdir>`
- **Steps:**
  1. `touch <pdf-path>` (mtime changes; content unchanged)
  2. Run ingest invocation
  3. **Per §11 FR-2.5 wording -- tuple-based identity inherits unchanged** -- the mtime change DOES trigger re-extract
  4. Assert exit 0
  5. Assert chunks may be re-written (depending on §11 implementation); document the choice in test source per the use-case file's Open Question #3
- **Expected Result:** Re-extract triggered (or not, depending on §11 inheritance); test documents the chosen behavior
- **Pass Criteria:** FR-9.7 contract inherited correctly

### TC-13.3: iter-1 index.db opened by iter-2 binary first time -- no migration
- **Category:** Ingest / Cross-Iteration
- **Mapped UC:** UC-13-EC1
- **Mapped FR:** FR-9.7
- **Mapped AC:** AC-3
- **Type:** integration
- **Severity:** P1
- **Preconditions:** A test fixture `index.db` written by an iter-1 (`0.1.0`) binary is committed; iter-2 binary is installed
- **Inputs:** Run iter-2 `sdlc-knowledge status --json --project-root <fixture-dir>` then ingest a PDF
- **Steps:**
  1. Place iter-1-produced `index.db` at `<fixture-dir>/.claude/knowledge/index.db`
  2. Run `sdlc-knowledge status --json --project-root <fixture-dir>`; assert exit 0 and `schema_version: 1`
  3. Re-run `sdlc-knowledge ingest <pdf-path> --project-root <fixture-dir>` for a PDF whose tuple matches an iter-1 row; assert `unchanged: <path>`
  4. Assert no migration script ran
- **Expected Result:** iter-2 reads iter-1 DB unchanged; no migration
- **Pass Criteria:** FR-9.7 schema BYTE-UNCHANGED contract

---

## 14. UC-14: Re-Ingest After `delete --by-id` Then Re-Ingest -- Fresh pdfium-render Extraction

### TC-14.1: Delete iter-1 row + re-ingest -- new chunks meet NFR-4 floor
- **Category:** Ingest / Refresh
- **Mapped UC:** UC-14
- **Mapped FR:** FR-1.1 through FR-1.7, FR-4.1 through FR-4.5, NFR-4, R-5
- **Mapped AC:** AC-2, AC-3, AC-7
- **Type:** integration
- **Severity:** P0
- **Preconditions:** iter-1-extracted row exists for the calibre fixture (with ~2 chunks/MB)
- **Inputs:** `sdlc-knowledge delete --by-id <N>` then `sdlc-knowledge ingest <calibre-fixture>`
- **Steps:**
  1. Identify the iter-1 row's id `<N>` for the calibre fixture
  2. Record iter-1 chunk count as `C_old`
  3. Run `sdlc-knowledge delete --by-id <N> --project-root <tmpdir>`; assert exit 0
  4. Run `sdlc-knowledge ingest <calibre-fixture> --project-root <tmpdir>`; assert exit 0
  5. Query new chunk count as `C_new`
  6. Assert `C_new >= (file_size_bytes / 20480)` per NFR-4
  7. Assert `C_new > C_old` (iter-2 produces more chunks than iter-1 on calibre)
- **Expected Result:** New chunks meet NFR-4 floor and exceed iter-1 baseline
- **Pass Criteria:** AC-2 + R-5 corpus-refresh path verified

### TC-14.2: One-time corpus refresh procedure (RELEASING.md)
- **Category:** Maintenance / Refresh
- **Mapped UC:** UC-14-A1
- **Mapped FR:** FR-8.3, R-5
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P3
- **Preconditions:** `tools/sdlc-knowledge/RELEASING.md` exists with a "Corpus refresh after iter-2" section
- **Inputs:** Static check on RELEASING.md
- **Steps:**
  1. Run `grep -F "delete --by-id" tools/sdlc-knowledge/RELEASING.md` -- assert ≥ 1 line
  2. Run `grep -F "Corpus refresh" tools/sdlc-knowledge/RELEASING.md` -- assert ≥ 1 line
- **Expected Result:** Refresh procedure documented in RELEASING.md
- **Pass Criteria:** FR-8.3 documentation contract met

### TC-14.3: Re-ingest produces fewer chunks than iter-1 baseline minus 50% floor
- **Category:** Ingest / Regression Detection
- **Mapped UC:** UC-14-E1
- **Mapped FR:** R-5
- **Mapped AC:** AC-2 (negative path)
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Test injects a degraded PDFium extraction
- **Inputs:** Same as TC-14.1 but with mocked PDFium returning short text
- **Steps:**
  1. Inject mocked PDFium returning 30% of natural extraction
  2. Run TC-14.1 procedure
  3. Assert the regression-floor test FAILS with explicit message identifying the affected fixture
- **Expected Result:** Regression detected; iter-2 cannot ship until closed
- **Pass Criteria:** R-5 mitigation enforced

---

## 15. UC-15: `sdlc-knowledge --version` Returns Bumped Version

### TC-15.1: --version returns `sdlc-knowledge 0.2.0` exit 0
- **Category:** Version
- **Mapped UC:** UC-15
- **Mapped FR:** NFR-9, FR-9.1, FR-2.1
- **Mapped AC:** §11 AC-1 inherited
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Iter-2 binary installed
- **Inputs:** `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version`
- **Steps:**
  1. Run the invocation
  2. Assert exit 0
  3. Assert stdout matches the literal `sdlc-knowledge 0.2.0\n`
- **Expected Result:** Bumped version string; exit 0
- **Pass Criteria:** NFR-9 version bump verified

### TC-15.2: cargo source-built iter-2 binary returns 0.2.0
- **Category:** Version / Source Build
- **Mapped UC:** UC-15-A1
- **Mapped FR:** NFR-9, FR-2.1
- **Mapped AC:** §11 AC-1 inherited
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Local source checkout; cargo on PATH
- **Inputs:** `cargo build --release -p sdlc-knowledge` then run binary
- **Steps:**
  1. `cargo build --release --manifest-path tools/sdlc-knowledge/Cargo.toml`
  2. Run `tools/sdlc-knowledge/target/release/sdlc-knowledge --version`
  3. Assert stdout = `sdlc-knowledge 0.2.0\n`
- **Expected Result:** Source-built binary reports 0.2.0
- **Pass Criteria:** Cargo.toml version line bumped correctly

---

## 16. UC-16: `delete --by-id` and `<source-path>` Mutual Exclusion

### TC-16.1: Both forms supplied -- exit 2 with literal mutual-exclusion error
- **Category:** Delete / Mutual Exclusion
- **Mapped UC:** UC-16
- **Mapped FR:** FR-4.1
- **Mapped AC:** AC-8
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Iter-2 binary
- **Inputs:** `sdlc-knowledge delete --by-id 5 some/path.pdf --project-root <tmpdir>`
- **Steps:**
  1. Capture sha256 of `index.db` as `H1`
  2. Run the invocation
  3. Assert exit 2
  4. Assert stderr contains the literal `error: --by-id and <source-path> are mutually exclusive`
  5. Capture sha256 as `H2`; assert `H1 == H2`
- **Expected Result:** Exit 2; literal message; no DB mutation
- **Pass Criteria:** AC-8 verified

### TC-16.2: Neither form supplied -- clap "argument required" error
- **Category:** Delete / Argument Required
- **Mapped UC:** UC-16-EC1
- **Mapped FR:** FR-4.1 (mutual-exclusion contract)
- **Mapped AC:** (no direct AC; clap-driven)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Iter-2 binary
- **Inputs:** `sdlc-knowledge delete --project-root <tmpdir>` (no args)
- **Steps:**
  1. Run the invocation
  2. Assert exit 2
  3. Assert stderr contains a clap-driven argument-required error
  4. Assert no DB mutation
- **Expected Result:** clap "argument required" surfaces; exit 2
- **Pass Criteria:** Iter-1 inherited behavior preserved

---

## 17. Cross-Cutting Use Cases

### TC-CC-3.1: `cargo tree -p pdfium-render` matches single 0.9.x package; pdf-extract removed
- **Category:** Dep Swap / Build Verification
- **Mapped UC:** UC-CC-3
- **Mapped FR:** FR-2.1, FR-2.2
- **Mapped AC:** AC-1
- **Type:** integration / build
- **Severity:** P0
- **Preconditions:** Local source checkout post-iter-2 merge
- **Inputs:** `cargo tree -p pdfium-render --manifest-path tools/sdlc-knowledge/Cargo.toml`; `cargo tree -p pdf-extract --manifest-path tools/sdlc-knowledge/Cargo.toml`
- **Steps:**
  1. Run `cargo tree -p pdfium-render --manifest-path tools/sdlc-knowledge/Cargo.toml`
  2. Assert exit 0
  3. Assert stdout's first line matches regex `^pdfium-render v0\.9\.[0-9]+`
  4. Run `cargo tree -p pdf-extract --manifest-path tools/sdlc-knowledge/Cargo.toml`
  5. Assert exit 1
  6. Assert stderr contains `error: package ID specification 'pdf-extract' did not match any packages`
- **Expected Result:** pdfium-render at 0.9.x matches; pdf-extract removed
- **Pass Criteria:** AC-1 dependency swap clean

### TC-CC-3.2: Compiled binary ≤ 10 MB; no `pdf_extract` string in pdf.rs
- **Category:** Dep Swap / Size + Cleanup
- **Mapped UC:** UC-CC-3
- **Mapped FR:** FR-2.3, NFR-1
- **Mapped AC:** (build-time gate)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** `cargo build --release` has run
- **Inputs:** `stat`; `grep`
- **Steps:**
  1. Run `cargo build --release --manifest-path tools/sdlc-knowledge/Cargo.toml`
  2. Run `stat --printf=%s tools/sdlc-knowledge/target/release/sdlc-knowledge`; assert `≤ 10485760` (10 MB)
  3. Run `grep -rn "pdf_extract" tools/sdlc-knowledge/src/`; assert empty (zero output)
  4. Run `grep -rn "pdf-extract" tools/sdlc-knowledge/Cargo.toml`; assert empty
- **Expected Result:** Binary ≤ 10 MB; pdf_extract absent in src; pdf-extract absent in Cargo.toml
- **Pass Criteria:** NFR-1 / FR-2.3 verified

### TC-CC-4.1: §11 contract surfaces (citation, activation, CLI, JSON shape) BYTE-UNCHANGED
- **Category:** Backward Compat / Contract Preservation
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-9.1, FR-9.2, FR-9.3
- **Mapped AC:** (assertion-as-test)
- **Type:** unit / static
- **Severity:** P0
- **Preconditions:** iter-2 merged
- **Inputs:** Static greps + `git diff`
- **Steps:**
  1. Assert `grep -F "knowledge-base: <source-filename>:<chunk-id>" src/rules/knowledge-base.md` returns ≥ 1 (FR-9.2 literal preserved)
  2. Assert `git diff <pre-iter2-merge-commit>..HEAD -- src/agents/{prd-writer,ba-analyst,architect,qa-planner,planner,security-auditor,code-reviewer,verifier,refactor-cleaner,resource-architect,role-planner,release-engineer}.md` shows zero changes inside the `## Knowledge Base (when present)` section (FR-9.3)
  3. Assert iter-2 `sdlc-knowledge --help` lists the five subcommands `ingest, search, list, status, delete` and only the new `--by-id` flag on `delete` (FR-9.1)
  4. Assert iter-1's JSON output shapes for `ingest`, `search`, `list`, `status` match iter-2's (BYTE-UNCHANGED per FR-9.1)
- **Expected Result:** All four invariants pass
- **Pass Criteria:** FR-9.1, FR-9.2, FR-9.3 byte-unchanged

### TC-CC-5.1: Knowledge-base mandate fires correctly (12 thinking agents query before authoring)
- **Category:** Mandate Behavior
- **Mapped UC:** UC-CC-5
- **Mapped FR:** FR-9.3, FR-9.5, FR-9.6
- **Mapped AC:** (behavioral inheritance from §11)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** iter-2 binary installed; `<project>/.claude/knowledge/index.db` present
- **Inputs:** Synthetic agent invocation observed via test harness
- **Steps:**
  1. Spawn `prd-writer` agent in test mode on a domain-bearing feature
  2. Capture the agent's invocation log
  3. Assert the agent ran `sdlc-knowledge status --json` once at task start
  4. Assert the agent ran at least one `sdlc-knowledge search "<query>" --top-k 5 --json`
  5. Assert any load-bearing hits are cited under `## Facts → ### External contracts` using the FR-9.2 literal format
  6. Assert the agent's `## Facts` block exists with the four mandatory subsections
- **Expected Result:** Mandate fired; citation format preserved
- **Pass Criteria:** §11 mandate behavior inherited unchanged

---

## Architect Action Item Test Cases

### TC-AAI-1: Slice 1 uses `Pdfium::bind_to_library(<absolute-path>)` (security-load-bearing)
- **Category:** Security / Explicit-Path Binding
- **Mapped UC:** UC-1, UC-8-EC1, UC-9 (R-1 mitigation)
- **Mapped FR:** FR-1.2, R-1
- **Mapped AC:** AC-6
- **Type:** unit / security / integration
- **Severity:** P0
- **Preconditions:** Slice 1 has been implemented; `tools/sdlc-knowledge/src/pdf.rs` contains the pdfium-render integration; iter-2 binary built and dylib installed
- **Inputs:** Two checks -- (a) static source grep, (b) runtime DYLD/LD env-poisoning round-trip
- **Steps:**
  1. **Static check (a):** Run `grep -F "bind_to_library" tools/sdlc-knowledge/src/pdf.rs`; assert ≥ 1 match
  2. **Static check (a):** Run `grep -F "bind_to_system_library" tools/sdlc-knowledge/src/pdf.rs`; assert exactly `0` matches
  3. **Static check (a):** Verify the argument to `bind_to_library` is constructed as an absolute path (e.g., `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` resolved at runtime) and NOT a relative path; assert presence of the `~/.claude/tools/sdlc-knowledge/pdfium/` substring (or its absolute-path equivalent) on the same code line as `bind_to_library`
  4. **Runtime check (b) -- macOS:** `DYLD_LIBRARY_PATH=/tmp/empty/ sdlc-knowledge ingest <calibre-fixture> --project-root <tmpdir>`; assert exit 0 and chunk count ≥ NFR-4 floor (proves the binary loads pdfium from the canonical install path, NOT from `DYLD_LIBRARY_PATH`)
  5. **Runtime check (b) -- linux:** `LD_LIBRARY_PATH=/tmp/empty/ sdlc-knowledge ingest <calibre-fixture> --project-root <tmpdir>`; assert exit 0 and chunk count ≥ NFR-4 floor
  6. **Adversarial check:** Place a malicious `libpdfium.so` (or `.dylib`) in `/tmp/evil/` that prints `HIJACKED` to stderr at load; run `LD_LIBRARY_PATH=/tmp/evil/ sdlc-knowledge ingest <fixture>` (or `DYLD_LIBRARY_PATH=...`); assert stderr does NOT contain `HIJACKED`
- **Expected Result:** Source uses explicit-path API only; runtime env-var poisoning does not redirect dylib loading
- **Pass Criteria:** R-1 dynamic-library-hijack mitigation fully verified at both source and runtime

### TC-AAI-2: pdfium-render API symbol resolved pre-Slice-1 in `.claude/plan.md`
- **Category:** Tracking / Plan Documentation
- **Mapped UC:** (planning-time gate before UC-1 implementation)
- **Mapped FR:** FR-1.2, FR-1.4
- **Mapped AC:** (process gate, not user-facing AC)
- **Type:** static / process
- **Severity:** P1
- **Preconditions:** `.claude/plan.md` exists post-bootstrap with Slice 1 specified
- **Inputs:** `grep` over `.claude/plan.md`
- **Steps:**
  1. Run `grep -F "pdfium-render" .claude/plan.md` in Slice 1 spec context; assert ≥ 1 line
  2. Run `grep -F "bind_to_library" .claude/plan.md`; assert ≥ 1 line (architect-selected canonical symbol)
  3. Run `grep -E "load_pdf_from_byte_slice|PdfDocument::pages" .claude/plan.md`; assert ≥ 1 line (page-iteration symbol present)
  4. **Tracking-only**: this test passes if the plan documents the canonical symbols verbatim. Independent verification of correctness is performed by TC-AAI-1 (runtime round-trip).
- **Expected Result:** Slice 1 spec documents the exact pdfium-render symbols
- **Pass Criteria:** Plan documentation gate satisfied

### TC-AAI-3: Cargo.toml uses caret semver `pdfium-render = "0.9"`; cargo-tree resolves to 0.9.x
- **Category:** Dependency Pin / Semver
- **Mapped UC:** UC-CC-3
- **Mapped FR:** FR-2.1, R-7
- **Mapped AC:** AC-1
- **Type:** integration / build
- **Severity:** P1
- **Preconditions:** Iter-2 Cargo.toml in place
- **Inputs:** `grep` + `cargo tree`
- **Steps:**
  1. Run `grep -E '^pdfium-render = "0\.9"$' tools/sdlc-knowledge/Cargo.toml`; assert exactly `1` matching line (caret default per FR-2.1; not `=0.9.x`, not `^0.9`, not `0.9.0`)
  2. Run `cargo tree -p pdfium-render --manifest-path tools/sdlc-knowledge/Cargo.toml`; capture first line
  3. Assert first line matches regex `^pdfium-render v0\.9\.[0-9]+`
  4. Run `grep -F "Major version bump" tools/sdlc-knowledge/RELEASING.md`; assert ≥ 1 line documenting the major-bump-fence procedure (per architect MINOR action item)
  5. Run `grep -F "pdfium-render 0.10" tools/sdlc-knowledge/RELEASING.md`; OR `grep -F "pdfium-render 1.0" RELEASING.md`; assert ≥ 1 line documenting the upgrade procedure (per architect's caret-semver-fence MINOR)
- **Expected Result:** Caret semver pin in place; resolved version is 0.9.x; RELEASING.md documents major-bump fence
- **Pass Criteria:** AC-1 + R-7 mitigation verified

### TC-AAI-4: Calibre fixture exists, ≤ 200 KB, contains real CID-font text, ≥ 50 chunks/MB
- **Category:** Fixture Validation
- **Mapped UC:** UC-1
- **Mapped FR:** FR-6.1, FR-6.2, FR-6.3, NFR-4
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Slice 6 has vendored the fixture; sibling provenance README exists
- **Inputs:** `stat`, `file`, ingest invocation
- **Steps:**
  1. Assert `test -f tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf`
  2. Run `stat --printf=%s tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf`; record `S`
  3. Assert `S <= 204800` (≤ 200 KB per architect MINOR raised from PRD §12.6.1's 100 KB cap)
  4. Assert `test -f tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md`
  5. Run `grep -E "(public domain|Project Gutenberg|public-domain)" tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md`; assert ≥ 1 match (provenance per FR-6.3)
  6. Run `grep -E "calibre [0-9]" tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md`; assert ≥ 1 match (calibre version per FR-6.3)
  7. Run `grep -E "[a-f0-9]{64}" tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md`; assert ≥ 1 match (sha256 per FR-6.3)
  8. **CID-font content check:** Run a third-party tool (e.g., `pdffonts`) on the fixture; assert at least one font of `/Type 0` appears in the output
  9. **Ingest round-trip:** Run TC-1.1's ingest procedure; assert `chunks_count >= (S * 50 / (1024 * 1024))` (NFR-4 floor)
  10. **Alphabetic content check:** assert at least one chunk contains a 5+ char alphabetic word
- **Expected Result:** Fixture exists; ≤ 200 KB; provenance documented; CID fonts present; ≥ 50 chunks/MB; alphabetic content
- **Pass Criteria:** All four FR-6.1 / FR-6.2 / FR-6.3 / NFR-4 contracts verified

### TC-AAI-5: install.sh uses `tar -xzf <archive> -C <target> --no-same-owner --no-same-permissions`
- **Category:** Security / Tar-Extraction Hardening
- **Mapped UC:** UC-4 (install path)
- **Mapped FR:** FR-3.2
- **Mapped AC:** AC-5
- **Type:** static / security
- **Severity:** P1
- **Preconditions:** Slice 3 has implemented the install.sh PDFium download/extract flow
- **Inputs:** `grep` over `install.sh`
- **Steps:**
  1. Run `grep -F "tar" install.sh | grep -F "pdfium"`; capture matching lines
  2. Assert at least one matching line contains `--no-same-owner`
  3. Assert at least one matching line contains `--no-same-permissions`
  4. Assert the matching line uses `-xzf` (or `-xJf` for `.tar.xz` if applicable; the bblanchon assets are `.tgz` so `-xzf` is expected)
  5. Assert the matching line uses `-C ~/.claude/tools/sdlc-knowledge/pdfium/` (or its expanded absolute equivalent) to constrain extraction
  6. Assert the matching line does NOT use `--preserve-permissions` or `-p` (which would conflict with hardening)
- **Expected Result:** Tar invocation includes the safety flags; extraction destination constrained
- **Pass Criteria:** Architect MINOR (tar-extraction safety) verified

---

## Invariant Test Cases

### TC-INV-1: `ls src/agents/*.md | wc -l` returns 17
- **Category:** Invariant
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.4
- **Mapped AC:** (inherited from §11 AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged on main
- **Inputs:** Shell command
- **Steps:**
  1. Run `ls src/agents/*.md | wc -l`
  2. Assert output is exactly `17`
- **Expected Result:** 17 agent files
- **Pass Criteria:** FR-9.4 verified

### TC-INV-2: `ls src/commands/*.md | wc -l` returns 6
- **Category:** Invariant
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.5 (commands count from §11 AC-12 unchanged)
- **Mapped AC:** (inherited from §11 AC-12)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged
- **Inputs:** Shell command
- **Steps:**
  1. Run `ls src/commands/*.md | wc -l`
  2. Assert output is exactly `6`
- **Expected Result:** 6 command files
- **Pass Criteria:** Commands count unchanged

### TC-INV-3: README line 5 = `17 specialized AI agents...` BYTE-UNCHANGED
- **Category:** Invariant / Tagline
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.1, FR-8.4
- **Mapped AC:** (inherited from §11 AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged
- **Inputs:** `sed`/`awk` over README.md
- **Steps:**
  1. Run `sed -n '5p' README.md`
  2. Assert output equals exactly `17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.`
  3. Run `git diff <pre-iter2-merge-commit>..HEAD -- README.md`; assert line 5 is NOT in the diff
- **Expected Result:** Line 5 byte-unchanged
- **Pass Criteria:** FR-9.1 / FR-8.4 tagline preserved

### TC-INV-4: README line 35 contains `10 quality gates` BYTE-UNCHANGED
- **Category:** Invariant / Tagline
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.2, FR-8.4
- **Mapped AC:** (inherited from §11 AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged
- **Inputs:** `sed`/`grep`
- **Steps:**
  1. Run `sed -n '35p' README.md`
  2. Assert output contains the substring `10 quality gates`
  3. Run `grep -Fxc "10 quality gates" README.md`; assert ≥ 1
  4. Run `git diff <pre-iter2-merge-commit>..HEAD -- README.md` and verify line 35 byte-unchanged
- **Expected Result:** "10 quality gates" line preserved
- **Pass Criteria:** FR-9.2 verified

### TC-INV-5: 5 executor agent prompt files BYTE-UNCHANGED vs main
- **Category:** Invariant / Executor Agents
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.3 (5 executors), FR-9.6 (cognitive-self-check rule unchanged)
- **Mapped AC:** (inherited from §11 AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged; `<pre-iter2-merge-commit>` SHA recorded
- **Inputs:** `git diff`
- **Steps:**
  1. Run `git diff <pre-iter2-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md`
  2. Assert output is empty (zero changes)
- **Expected Result:** All five executor files byte-unchanged
- **Pass Criteria:** FR-9.6 verified

### TC-INV-6: `src/rules/cognitive-self-check.md` BYTE-UNCHANGED
- **Category:** Invariant / Cognitive Self-Check Rule
- **Mapped UC:** UC-CC-2, UC-CC-5
- **Mapped FR:** FR-9.5 (cognitive-self-check.md unchanged in iter-2)
- **Mapped AC:** (inherited from §11 AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged
- **Inputs:** `git diff`
- **Steps:**
  1. Run `git diff <pre-iter2-merge-commit>..HEAD -- src/rules/cognitive-self-check.md`
  2. Assert output is empty
- **Expected Result:** Rule file byte-unchanged
- **Pass Criteria:** FR-9.5 verified

### TC-INV-7: `templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*` BYTE-UNCHANGED
- **Category:** Invariant / Templates
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.7 (template surfaces inherit §11 FR-9.2 unchanged)
- **Mapped AC:** (inherited from §11 AC-3 / AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged
- **Inputs:** `git diff`
- **Steps:**
  1. Run `git diff <pre-iter2-merge-commit>..HEAD -- templates/CLAUDE.md templates/scratchpad.md templates/settings.json templates/rules/`
  2. Assert output is empty
- **Expected Result:** All four template surfaces byte-unchanged
- **Pass Criteria:** Template invariant preserved

### TC-INV-8: `install.sh` line 22 `VERSION="2.1.0"` BYTE-UNCHANGED in this iter
- **Category:** Invariant / Install Version
- **Mapped UC:** UC-CC-2
- **Mapped FR:** FR-9.8 (release-engineer Gate 9 reconciles)
- **Mapped AC:** (process gate)
- **Type:** static
- **Severity:** P1
- **Preconditions:** Iter-2 merged BEFORE the release-engineer Gate 9 ran
- **Inputs:** `sed`
- **Steps:**
  1. Run `sed -n '22p' install.sh`
  2. Assert output equals exactly `VERSION="2.1.0"`
  3. **Note**: release-engineer at /merge-ready Gate 9 may bump this line; the test asserts the intermediate-state invariant during slice implementation (the implementing slices MUST NOT bump VERSION; only Gate 9 reconciles)
- **Expected Result:** install.sh VERSION unchanged in implementation slices
- **Pass Criteria:** FR-9.8 verified

### TC-INV-9: 12 thinking-agent activation blocks (`## Knowledge Base (when present)`) BYTE-UNCHANGED
- **Category:** Invariant / Activation Block
- **Mapped UC:** UC-CC-2, UC-CC-5
- **Mapped FR:** FR-9.9 (citation contract from §11 preserved), FR-9.3
- **Mapped AC:** (inherited from §11 AC-11)
- **Type:** static
- **Severity:** P0
- **Preconditions:** Iter-2 merged
- **Inputs:** `git diff` + section grep
- **Steps:**
  1. For each of the 12 thinking agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`):
     - Run `git diff <pre-iter2-merge-commit>..HEAD -- src/agents/<name>.md`
     - If output is non-empty, extract the diff lines that fall within the `## Knowledge Base (when present)` section
     - Assert those diff lines are empty (zero changes inside the activation block)
  2. Assert each agent's prompt file contains the literal string `## Knowledge Base (when present)`
- **Expected Result:** Activation block byte-unchanged in all 12 agents
- **Pass Criteria:** FR-9.9 / FR-9.3 verified; §11 citation contract preserved

---

## Cross-Platform Matrix

The four iter-2 supported platforms each get a dedicated test case run on the matching `.github/workflows/sdlc-knowledge-release.yml` matrix runner. UC-CC-1 / FR-7.1 / FR-7.2 / FR-7.3.

### TC-CP-1: darwin-arm64 (`macos-14`) -- pdfium binary downloaded, calibre fixture ingest succeeds
- **Category:** Cross-Platform
- **Mapped UC:** UC-CC-1, UC-4
- **Mapped FR:** FR-3.1, FR-3.2, FR-7.1, FR-7.2, NFR-7
- **Mapped AC:** AC-2, AC-5, AC-9
- **Type:** cross-platform / E2E
- **Severity:** P0
- **Preconditions:** GitHub Actions runner `macos-14`; clean state
- **Inputs:** GitHub Actions matrix job
- **Steps:**
  1. On `macos-14` runner, `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`
  2. Run `bash install.sh --yes`
  3. Assert `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` exists with non-zero size
  4. Assert total install footprint ≤ 25 MB per NFR-2
  5. Run `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>`; assert exit 0 and chunks ≥ NFR-4 floor
  6. Run `sdlc-knowledge search "<phrase>" --top-k 5 --json --project-root <tmpdir>`; assert positive BM25 score
- **Expected Result:** All steps succeed within 90 s
- **Pass Criteria:** AC-5 + AC-9 + AC-2 + AC-4 satisfied for darwin-arm64

### TC-CP-2: darwin-x64 (`macos-13`) -- pdfium binary downloaded, calibre fixture ingest succeeds
- **Category:** Cross-Platform
- **Mapped UC:** UC-CC-1, UC-6
- **Mapped FR:** FR-3.1, FR-3.2, FR-7.1, FR-7.2, NFR-7
- **Mapped AC:** AC-2, AC-5, AC-9
- **Type:** cross-platform / E2E
- **Severity:** P0
- **Preconditions:** `macos-13` runner; clean state
- **Inputs:** GitHub Actions matrix job
- **Steps:**
  1. Same as TC-CP-1 but on `macos-13`
  2. Asset `pdfium-mac-x64.tgz`; post-extract filename `libpdfium.dylib`
- **Expected Result:** Same as TC-CP-1
- **Pass Criteria:** AC-5 + AC-9 + AC-2 + AC-4 for darwin-x64

### TC-CP-3: linux-x64 (`ubuntu-latest`) -- pdfium binary downloaded, calibre fixture ingest succeeds
- **Category:** Cross-Platform
- **Mapped UC:** UC-CC-1, UC-5
- **Mapped FR:** FR-3.1, FR-3.2, FR-7.1, FR-7.2, NFR-7
- **Mapped AC:** AC-2, AC-5, AC-9
- **Type:** cross-platform / E2E
- **Severity:** P0
- **Preconditions:** `ubuntu-latest` runner
- **Inputs:** GitHub Actions matrix job
- **Steps:**
  1. Same as TC-CP-1 but on `ubuntu-latest`
  2. Asset `pdfium-linux-x64.tgz`; post-extract filename `libpdfium.so`
- **Expected Result:** Same as TC-CP-1 with `.so` filename
- **Pass Criteria:** AC-5 + AC-9 + AC-2 + AC-4 for linux-x64

### TC-CP-4: linux-arm64 (`ubuntu-22.04-arm`) -- pdfium binary downloaded, calibre fixture ingest succeeds
- **Category:** Cross-Platform
- **Mapped UC:** UC-CC-1, UC-7
- **Mapped FR:** FR-3.1, FR-3.2, FR-7.1, FR-7.2, NFR-7
- **Mapped AC:** AC-2, AC-5, AC-9
- **Type:** cross-platform / E2E
- **Severity:** P0
- **Preconditions:** `ubuntu-22.04-arm` runner
- **Inputs:** GitHub Actions matrix job
- **Steps:**
  1. Same as TC-CP-1 but on `ubuntu-22.04-arm`
  2. Asset `pdfium-linux-arm64.tgz`; post-extract filename `libpdfium.so`
- **Expected Result:** Same as TC-CP-1 with arm64 + `.so`
- **Pass Criteria:** AC-5 + AC-9 + AC-2 + AC-4 for linux-arm64

---

**End of Test Cases**

Total: 16 primary UCs + 5 cross-cutting UCs + 5 architect action items + 9 invariants + 4 cross-platform = 39 unique TC entries. Including alternative / error / edge variants under primary UCs the total is 60+ TCs documented above (counting individual `### TC-N.M` and `### TC-AAI-N` and `### TC-INV-N` and `### TC-CP-N` headings).

Windows remains OUT OF SCOPE per PRD §12.7 item 3 -- no Windows test cases are documented.
