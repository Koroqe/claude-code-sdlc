# Use Cases: Robust PDF Extraction via pdfium-render

> Based on [PRD](../PRD.md) — Section 12: Robust PDF Extraction via pdfium-render

This document is the blueprint for E2E and integration testing of the iter-2 PDF extractor replacement introduced in PRD Section 12. The feature is a drop-in replacement of the iter-1 `pdf-extract = "0.7"` crate with `pdfium-render = "0.9"` (a Rust binding to Google's PDFium engine), plus a per-platform PDFium dynamic library download added to `install.sh`, plus a companion `delete --by-id <int>` CLI flag that bypasses path-canonicalization for stale-row cleanup. The "actors" in every use case below are the developer (human user), the maintainer (project owner who cuts release tags), the `install.sh` script, and the `sdlc-knowledge` CLI binary — there are NO new agents and NO new `/merge-ready` gates in iter-2.

Every use case below is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`, `UC-CC-N`) are referenced by QA test cases and E2E tests.

**Common preconditions across all use cases** (stated once here, referenced as "common preconditions" below):

- The iter-1 feature (PRD §11) has shipped — `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists, the FTS5 + WAL schema is live, the 12 thinking agents have the activation block, the citation literal format is in place per §11 FR-7.1, and the four iter-1 platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) are supported per §11 NFR-1.4
- The five `sdlc-knowledge` subcommands (`ingest`, `search`, `list`, `status`, `delete`) plus `--version` remain BYTE-UNCHANGED in their public surface; iter-2 only ADDS the `--by-id <int>` flag on `delete` per FR-9.1
- The `knowledge-base:` citation literal `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` is BYTE-UNCHANGED per FR-9.2
- The `## Knowledge Base (when present)` activation block in the 12 thinking agents is BYTE-UNCHANGED per FR-9.3
- The 17-agent count and 10-gate count are BYTE-UNCHANGED per FR-9.4 (`ls src/agents/*.md | wc -l` returns `17`; `grep -Fxc "10 quality gates" README.md` returns ≥1)
- The cognitive-self-check rule file `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED per FR-9.5
- The five executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) are BYTE-UNCHANGED per FR-9.6
- The FTS5 + WAL schema (`documents`, `chunks`, `chunks_fts`, `schema_version`) is BYTE-UNCHANGED — no migration is required when an iter-1 index is opened by an iter-2 binary per FR-9.7
- Iter-2 supported platforms remain darwin-arm64, darwin-x64, linux-x64, linux-arm64 per NFR-7; Windows remains OUT OF SCOPE per 12.7 item 3
- The 50 MB byte budget (`PDF_BUDGET_BYTES = 50 * 1024 * 1024`) and `check_byte_budget` gate from iter-1 are preserved BYTE-FOR-BYTE per FR-1.5
- The `catch_unwind` panic boundary around all native PDF calls is preserved per FR-1.6 (defense-in-depth around FFI-from-native-code panics)
- The unit-test seam `extract_via_closure_for_test` retains its iter-1 signature so the existing TC-SEC-2.1 synthetic-panic test passes without test-file changes per FR-1.7
- The `IngestError::PdfDecode` variant identity is preserved (only its message string changes to a pdfium-specific reason) per FR-2.4 — `impl Display for IngestError` and per-file error printing in `ingest.rs` is byte-unchanged
- The PDFium dynamic library is downloaded by `install.sh` into `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` (sibling directory to the binary) at the pinned `chromium/<version>` tag per FR-3.2 / FR-3.3
- The `bblanchon/pdfium-binaries` GitHub project is the canonical asset source for the four iter-2 platforms per FR-3.1
- The crate version of `sdlc-knowledge` bumps `0.1.0 → 0.2.0` per NFR-9, but the SDLC-repo-level taglines in `README.md` lines 5 and 35 are BYTE-UNCHANGED per FR-8.4 / FR-9.4

## Actors

| Actor | Description |
|-------|-------------|
| Developer | The human user running `bash install.sh --yes`, `sdlc-knowledge ingest <path>`, `sdlc-knowledge delete --by-id <int>`, or `/knowledge-ingest <path>` |
| Maintainer | The project owner who bumps the pinned `chromium/<version>` PDFium tag in `install.sh` and cuts the next `sdlc-knowledge-v0.2.0` GitHub release tag manually per `tools/sdlc-knowledge/RELEASING.md` |
| `install.sh` script | The bootstrap script in the SDLC repo root. Iter-2 ADDS a per-platform PDFium archive download step that extracts `libpdfium.{dylib|so}` into `~/.claude/tools/sdlc-knowledge/pdfium/lib/` with idempotency, graceful degradation, and the FR-3.6 SCRIPT_DIR re-invocation pattern |
| `sdlc-knowledge` CLI binary | The Rust binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`. Iter-2 rewires PDF extraction to `pdfium-render = "0.9"` (loading the dynamic library at first use), preserves all five subcommands, adds the `delete --by-id <int>` flag, and bumps its crate version to `0.2.0` |
| `pdfium-render` library-path resolver | The Rust crate's runtime library lookup that locates `libpdfium.{dylib|so}` either via `Pdfium::bind_to_system_library()` (env-var-based search of `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` / system library paths) or via `Pdfium::bind_to_library(<path>)` (explicit-path API). The exact resolver mechanism is RESOLVED at architect Step 3 per Open Question #1 below |
| GitHub Actions matrix runner | One of `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` per §11 FR-11.1 (BYTE-UNCHANGED in iter-2 per FR-7.3); iter-2 ADDS PDFium download + calibre fixture ingest smoke steps per FR-7.1 / FR-7.2 |

---

## Use Case Coverage

| UC ID | Scenario | PRD FRs | PRD ACs |
|-------|----------|---------|---------|
| UC-1 | Ingest calibre-converted PDF with composite CID fonts | FR-1.1 through FR-1.7, FR-6.1, FR-6.2, NFR-4 | AC-2, AC-4 |
| UC-1-E1 | Calibre PDF is encrypted (non-empty password) | FR-1.3 | AC-6 (panic-absent semantic) |
| UC-1-E2 | Calibre PDF has 0 pages (edge fixture) | FR-1.4 | AC-2 floor (gracefully zero) |
| UC-2 | Ingest normal PDF (existing iter-1 sample.pdf) — chunk count varies but ≥ baseline floor | FR-1.1 through FR-1.7, R-5 | AC-2 |
| UC-3 | Ingest corrupt PDF (existing iter-1 corrupt.pdf) — per-file error, batch continues | FR-1.6, FR-2.4, NFR-5 | AC-6 |
| UC-3-E1 | Corrupt PDF triggers a native pdfium error (NOT a panic) | FR-1.6, FR-2.4 | AC-6 (panic-absent) |
| UC-4 | First-time install on darwin-arm64 — PDFium binary download succeeds | FR-3.1, FR-3.2, FR-3.4, FR-3.7 | AC-5 |
| UC-4-E1 | bblanchon/pdfium-binaries asset URL returns 404 | FR-3.5, NFR-5 | AC-6 |
| UC-4-E2 | PDFium archive is malformed/truncated | FR-3.5 | AC-6 |
| UC-5 | First-time install on linux-x64 | FR-3.1, FR-3.2 | AC-5 |
| UC-6 | First-time install on darwin-x64 | FR-3.1, FR-3.2 | AC-5 |
| UC-7 | First-time install on linux-arm64 | FR-3.1, FR-3.2 | AC-5 |
| UC-8 | install.sh runs but PDFium download fails — graceful degradation | FR-3.5, NFR-5, FR-5.1 | AC-6 |
| UC-8-EC1 | User has PDFium installed manually outside `~/.claude/tools/sdlc-knowledge/pdfium/` | FR-1.2, FR-3.4 | AC-6 |
| UC-9 | `sdlc-knowledge ingest <pdf>` when PDFium absent — per-file failure with literal error | FR-1.2, FR-5.1, FR-5.2 | AC-6 |
| UC-9-EC1 | Mixed batch (sample.md + sample.pdf) with PDFium absent — md succeeds, pdf fails | FR-5.1 | AC-6 |
| UC-10 | `sdlc-knowledge delete --by-id <int>` removes a stale-source row whose `source_path` is outside project-root | FR-4.1 through FR-4.5 | AC-7 |
| UC-10-E1 | `--by-id` with id where `source_path` is outside project-root | FR-4.3 | AC-7 |
| UC-10-E2 | `--by-id <negative-int>` or non-numeric | FR-4.2 (arg-parse) | AC-7 (arg-parse exit 2) |
| UC-11 | `sdlc-knowledge delete --by-id <int>` for a non-existent id | FR-4.2 | AC-7 |
| UC-12 | Legacy `sdlc-knowledge delete <source-path>` continues to work | FR-9.1 | (§11 AC-6, AC-7 inherited) |
| UC-12-E1 | Legacy path-based delete on path that escapes project-root — still rejected with exit 2 | FR-9.1 (§11 FR-1.5 inherited) | §11 AC-6 |
| UC-13 | Re-ingest of a previously-extracted PDF after pdfium-render replaces pdf-extract — sha256 idempotent no-op | FR-9.7 | AC-3 |
| UC-14 | Re-ingest after `delete --by-id` then re-ingest — fresh extraction with pdfium-render | FR-1.1 through FR-1.7, R-5 | AC-2, AC-3 |
| UC-15 | `sdlc-knowledge --version` continues to exit 0 with `sdlc-knowledge 0.2.0` | NFR-9, FR-9.1 | (§11 AC-1 inherited) |
| UC-16 | `delete --by-id` and `<source-path>` mutual exclusion enforced | FR-4.1 | AC-8 |
| UC-CC-1 | Cross-platform install matrix (darwin-arm64, darwin-x64, linux-x64, linux-arm64) | FR-3.1, FR-3.2, NFR-7, FR-7.1 | AC-5, AC-9 |
| UC-CC-2 | Invariant preservation — 17 agents, 10 gates, 5 executors byte-unchanged, README taglines | FR-9.1 through FR-9.7, FR-8.4 | (no direct AC; inherited from §11 AC-11) |
| UC-CC-3 | Cargo.toml dep swap — pdf-extract removed, pdfium-render added; binary still ≤ 10 MB | FR-2.1, FR-2.2, NFR-1, NFR-2 | AC-1 |
| UC-CC-4 | Citation format / agent activation contract / CLI surface from §11 all UNCHANGED | FR-9.1, FR-9.2, FR-9.3 | (no direct AC; assertion-as-test) |
| UC-CC-5 | Knowledge-base mandate continues to fire correctly (12 thinking agents query before authoring) | FR-9.3, FR-9.5 | (no direct AC; behavioral inheritance from §11) |

---

## UC-1: Ingest a Calibre-Converted PDF with Composite CID Fonts

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The PDFium dynamic library has been installed via `bash install.sh --yes` at the pinned `chromium/<version>` tag and is present at `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` per FR-3.2
- The vendored fixture `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` exists per FR-6.1 (≤ 100 KB, target 30 KB, calibre 3.x or later, public-domain source per FR-6.3)
- The activation sentinel `<project>/.claude/knowledge/index.db` exists (or is created on first ingest invocation per §11 FR-1.3)
- The fixture exhibits the iter-1 failure mode: under iter-1's `pdf-extract = "0.7"`, the same file produced ~2 chunks/MB (whitespace-only chunks); under iter-2's `pdfium-render = "0.9"` it MUST produce ≥ 50 chunks/MB per NFR-4

**Trigger**: Developer runs `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>` from the SDLC repo root

### Primary Flow (Happy Path)

1. The binary parses the `--project-root` argument and canonicalizes it through `resolve_project_root` per §11 FR-1.5 (iter-2 unchanged)
2. The binary opens or creates `<tmpdir>/.claude/knowledge/index.db` per §11 FR-1.3
3. The binary calls `pdf::read(<fixture-path>)` per FR-1.1 (signature byte-unchanged from iter-1)
4. `pdf::read` instantiates the per-process `Pdfium` engine handle via the architect-selected library-path resolver (default `Pdfium::bind_to_system_library()` per FR-1.2)
5. The engine loads the PDF document via `Pdfium::load_pdf_from_byte_slice`, reading the file via `std::fs::read` per FR-1.3 (security boundary preserved: native code never touches a path string from user input)
6. The empty-password path is attempted first per FR-1.3 (calibre fixture is unencrypted, so the empty-password attempt succeeds)
7. The binary iterates pages via `PdfDocument::pages().iter()` per FR-1.4, extracting per-page text via the documented page-text accessor
8. Per-page text is concatenated with a single `\n` separator into the document-level string per FR-1.4
9. The 50 MB byte budget gate `check_byte_budget` is applied to the concatenated text per FR-1.5
10. The `catch_unwind` panic boundary wraps every `pdfium-render` call per FR-1.6 (no panic occurs on this happy-path input)
11. The chunker proceeds per §11 FR-2 unchanged — text is split into ~500-character overlapping chunks (UTF-8 boundary safe), and the `(source_path, mtime, sha256)` idempotency key is recorded per §11 FR-2.5
12. The binary writes one `documents` row and ≥ `(file_size_kb / 20)` `chunks` rows per AC-2 (chunks-per-MB ≥ 50 per NFR-4)
13. At least one chunk contains a non-whitespace alphabetic word ≥ 5 characters per FR-6.2 / AC-2 (proves CID decoding worked)
14. The binary exits 0 within 60 s per NFR-3 (UNCHANGED from §11 AC-4)

**Postconditions**:
- `<tmpdir>/.claude/knowledge/index.db` contains exactly one new `documents` row whose `source_path` matches the canonicalized fixture path
- The same `index.db` contains ≥ `(file_size_kb / 20)` new `chunks` rows for the new `documents.id`
- The `chunks_fts` virtual table reflects the new rows via the FTS5 trigger (§11 FR-2 contract)
- A subsequent `sdlc-knowledge search "<phrase from fixture>" --top-k 5 --json --project-root <tmpdir>` returns the fixture in the result set with positive BM25 score per AC-4
- `panicked at` does NOT appear in stderr per AC-6 (panic-absent semantic)

**Mapped FR**: FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.6, FR-1.7, FR-6.1, FR-6.2, NFR-4
**Mapped ACs**: AC-2, AC-4

### Alternative Flows

- **UC-1-A1: Calibre fixture is exactly 0 bytes after the 50 MB byte-budget gate** — Edge of the byte-budget gate
  1. The fixture's extracted text is below the 50 MB budget — gate passes per FR-1.5
  2. Remainder of flow identical to UC-1 primary

  **Mapped FR**: FR-1.5
  **Mapped ACs**: AC-2

- **UC-1-A2: Calibre fixture has multiple `/ToUnicode` CMaps across multiple `/Type0` font dictionaries** — Tests that PDFium resolves all CID font types per 12.1 correctness rationale
  1. PDFium's `/Type0`, `/Type1`, `/Type3`, `/TrueType`, `/CIDFontType0`, `/CIDFontType2` font handling all engage during page-text extraction
  2. The combined extracted text passes the FR-6.2 ≥ 50 chunks/MB and ≥ one alphabetic word ≥ 5 chars assertions
  3. Remainder of flow identical to UC-1 primary

  **Mapped FR**: FR-1.4, NFR-4
  **Mapped ACs**: AC-2

### Error Flows

- **UC-1-E1: Calibre fixture is encrypted with a non-empty password** — `Pdfium::load_pdf_from_byte_slice` empty-password attempt fails
  1. The binary calls the empty-password load path per FR-1.3
  2. PDFium returns an encryption error from the FFI layer
  3. The binary surfaces `IngestError::PdfDecode` with the literal message component `password-protected; not supported in iter-2` per FR-1.3
  4. The batch continues per §11 FR-2.6's per-file error boundary (NFR-5 fault-isolation guarantee)
  5. The binary exits 0 if at least one other file in the batch succeeded, or exit 1 for a single-file invocation
  6. `panicked at` does NOT appear in stderr per AC-6

  **Mapped FR**: FR-1.3, FR-2.4, NFR-5
  **Mapped ACs**: AC-6

- **UC-1-E2: Calibre fixture has 0 pages (degenerate edge fixture)** — `PdfDocument::pages()` returns an empty iterator
  1. The page iteration in step 7 of UC-1 primary completes with zero per-page contributions
  2. The concatenated document-level string is empty (or a single `\n`)
  3. `check_byte_budget` is trivially satisfied (FR-1.5)
  4. The chunker processes the empty/near-empty string and writes 0 chunks
  5. The `documents` row is still written per §11 FR-2.5 (the source was successfully read; absence of chunks is data-driven)
  6. The binary exits 0
  7. NFR-4 floor (≥ 50 chunks/MB) is NOT applicable to a zero-text edge case — this scenario documents the gracefully-zero outcome

  **Mapped FR**: FR-1.4, FR-1.5
  **Mapped ACs**: AC-2 (floor inapplicable to degenerate input)

### Edge Cases

- **UC-1-EC1: Calibre fixture exceeds the 50 MB byte budget after extraction** — `PDF_BUDGET_BYTES` gate triggers
  1. PDFium extracts > 50 MB of text from a large fixture
  2. `check_byte_budget` returns false; the binary surfaces `IngestError::PdfBudgetExceeded` per FR-1.5
  3. The batch continues per §11 FR-2.6 / NFR-5
  4. The 30 KB calibre fixture vendored per FR-6.1 cannot trigger this path — but a hypothetical 100 MB-text PDF would

  **Mapped FR**: FR-1.5
  **Mapped ACs**: (no direct AC; defense-in-depth)

### Data Requirements

- **Input**: `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` (≤ 100 KB, target 30 KB), `--project-root <tmpdir>`
- **Output**: One row in `<tmpdir>/.claude/knowledge/index.db` `documents` table; ≥ `(file_size_kb / 20)` rows in `chunks`
- **Side Effects**: One filesystem read, one SQLite transactional write, no network access (NFR-1.8 from §11 unchanged: network is install.sh-only)

---

## UC-2: Ingest Normal PDF (Existing iter-1 sample.pdf) — Equivalent or Better Than pdf-extract

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The PDFium dynamic library is installed per UC-1 preconditions
- The existing iter-1 fixture `tools/sdlc-knowledge/tests/fixtures/sample.pdf` is present (per §11 Slice 2 done-condition; small 2-page synthetic PDF)
- An iter-1 baseline chunk count for `sample.pdf` is recorded somewhere (e.g., `tools/sdlc-knowledge/tests/fixtures/sample.pdf.iter1-baseline.txt` or in test source) so iter-2 can compare against it per R-5

**Trigger**: Developer runs `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/sample.pdf --project-root <tmpdir>`

### Primary Flow (Happy Path)

1. Same flow as UC-1 primary steps 1-13 over `sample.pdf` instead of the calibre fixture
2. The chunk count for `sample.pdf` under iter-2 (`pdfium-render`) MAY DIFFER from the iter-1 (`pdf-extract`) baseline because the extractor differs per R-5 — page-text concatenation may include or exclude headers/footers, hyphenation handling differs, ligature decoding differs
3. The chunk count under iter-2 MUST be ≥ 50% of the iter-1 baseline per R-5 mitigation (catastrophic-regression floor)
4. At least one chunk contains a non-whitespace alphabetic word ≥ 5 characters (extraction is non-trivially successful)
5. The binary exits 0 within 60 s per NFR-3

**Postconditions**:
- One new `documents` row exists for `sample.pdf`
- Chunk count for `sample.pdf` is ≥ 50% of the recorded iter-1 baseline AND ≥ 1
- Subsequent search returns `sample.pdf` for at least one phrase known to be present in the fixture

**Mapped FR**: FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5, FR-1.6, FR-1.7, R-5
**Mapped ACs**: AC-2

### Alternative Flows

- **UC-2-A1: sample.pdf chunk count under iter-2 is HIGHER than the iter-1 baseline** — PDFium extracts more text per page than pdf-extract (e.g., footnotes that pdf-extract dropped)
  1. The R-5 mitigation floor (≥ 50% of baseline) is exceeded — pass
  2. The new chunk count is recorded as the iter-2 baseline going forward

  **Mapped FR**: FR-1.4, R-5
  **Mapped ACs**: AC-2

### Error Flows

- **UC-2-E1: sample.pdf chunk count under iter-2 is BELOW 50% of the iter-1 baseline** — Catastrophic regression
  1. The Slice integration test asserting `iter2_chunks >= iter1_baseline / 2` fails
  2. The implementation slice is rejected per R-5 mitigation
  3. The architect investigates whether PDFium's reading-order, hyphenation, or page-iteration differs from `pdf-extract` in a fixable way (e.g., a `pdfium-render` config option that includes header/footer text)
  4. Iter-2 does NOT ship until the regression is closed or the baseline is justified

  **Mapped FR**: R-5
  **Mapped ACs**: AC-2 (negative path)

### Data Requirements

- **Input**: `tools/sdlc-knowledge/tests/fixtures/sample.pdf` (small 2-page synthetic), iter-1 baseline chunk count
- **Output**: One row in `documents`, ≥ `iter1_baseline / 2` rows in `chunks`, ≥ 1 chunk
- **Side Effects**: Same as UC-1

---

## UC-3: Ingest Corrupt PDF (Existing iter-1 corrupt.pdf) — Per-File Error, Batch Continues

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The PDFium dynamic library is installed
- The existing iter-1 fixture `tools/sdlc-knowledge/tests/fixtures/corrupt.pdf` is present (per §11 Slice 2 — a deliberately malformed PDF that exercised the iter-1 `catch_unwind` boundary)
- The fixture is in a directory alongside other valid `.pdf`, `.md`, `.txt` files so the batch-continues semantic can be observed

**Trigger**: Developer runs `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/ --project-root <tmpdir>` (directory-mode batch ingest)

### Primary Flow (Happy Path)

1. The binary enumerates the directory's `.md`, `.txt`, `.pdf` files per §11 FR-2.1
2. For each file, the binary invokes the appropriate reader (`pdf::read` for `.pdf`, `text::read_md` for `.md`, etc.)
3. For `corrupt.pdf`, `pdf::read` calls `Pdfium::load_pdf_from_byte_slice` which returns a native pdfium error (e.g., "format error", "invalid xref")
4. The binary surfaces `IngestError::PdfDecode` with the pdfium-specific reason string per FR-2.4 — variant identity preserved so `impl Display for IngestError` and per-file error printing are unchanged
5. The error is printed to stderr in the iter-1 per-file format (one line per failed file)
6. The batch CONTINUES per §11 FR-2.6 / NFR-5
7. Other files in the directory (valid PDFs, MD, TXT) are processed normally
8. The batch exit code is 0 if at least one file succeeded per §11 FR-2.6
9. `panicked at` does NOT appear in stderr per AC-6 — the iter-1 panic case for this fixture is now a clean error path under PDFium

**Postconditions**:
- `documents` table contains rows for every valid file in the directory
- `documents` table contains NO row for `corrupt.pdf`
- `chunks` table contains chunks for every valid file
- stderr contains exactly one line referencing `corrupt.pdf` and a pdfium-derived error reason
- The batch exits 0 (assuming at least one valid file)

**Mapped FR**: FR-1.6, FR-2.4, NFR-5
**Mapped ACs**: AC-6

### Alternative Flows

- **UC-3-A1: corrupt.pdf is the ONLY file in the directory** — Single-file batch
  1. Same flow as UC-3 primary except step 7 has no other files to process
  2. The batch exits 1 (no files succeeded)
  3. stderr still contains the per-file error line; `panicked at` is still absent

  **Mapped FR**: FR-2.4, NFR-5
  **Mapped ACs**: AC-6

### Error Flows

- **UC-3-E1: Corrupt PDF triggers a native pdfium panic surfacing through FFI** — Defense-in-depth path
  1. PDFium's native code panics on the malformed input (rare; PDFium is engineered for hostile input but the `catch_unwind` is FR-1.6 defense-in-depth)
  2. The `catch_unwind` wrapper around the `pdfium-render` call catches the panic per FR-1.6
  3. The wrapper translates the panic into `IngestError::PdfDecode` per the iter-1 contract for `extract_via_closure_for_test` (FR-1.7)
  4. Remainder of flow identical to UC-3 primary
  5. `panicked at` MUST NOT propagate to the user-visible stderr — the panic is contained

  **Mapped FR**: FR-1.6, FR-1.7, FR-2.4
  **Mapped ACs**: AC-6 (panic-absent semantic)

### Edge Cases

- **UC-3-EC1: corrupt.pdf is structurally valid PDF but has zero extractable text** — Different from UC-1-E2 (zero pages) — this PDF has pages but they're image-only / no text layer
  1. PDFium opens the document successfully
  2. Page iteration succeeds but per-page text extraction returns empty strings
  3. Concatenated text is empty
  4. The `documents` row is written; the `chunks` table receives 0 rows
  5. This is the OCR-required case per §12.7 item 2 (image-only PDFs are out of scope; OCR pre-processing is iter-3)
  6. The binary exits 0 (the file was successfully read; absence of text is data-driven)

  **Mapped FR**: FR-1.4, 12.7
  **Mapped ACs**: (no direct AC; documented as out-of-scope-but-not-an-error)

### Data Requirements

- **Input**: `tools/sdlc-knowledge/tests/fixtures/corrupt.pdf` plus at least one valid file in the same directory
- **Output**: `documents` rows for valid files only; per-file error line on stderr for `corrupt.pdf`
- **Side Effects**: Same as UC-1; one transactional write per valid file; rolled-back transaction (or skipped write) for `corrupt.pdf`

---

## UC-4: First-Time Install on darwin-arm64 — PDFium Binary Download

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Common preconditions hold (iter-1 has shipped; the host has the iter-1 `sdlc-knowledge` binary already, OR the host is bootstrapping iter-2 from scratch)
- The host machine runs darwin-arm64 (Apple Silicon Mac)
- Network connectivity to `https://github.com/bblanchon/pdfium-binaries/releases/...` is available
- `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` does NOT yet exist
- The `install.sh` script declares the pinned PDFium tag at the top in a single literal string (e.g., `chromium/6996`) per FR-3.3

**Trigger**: Developer runs `bash install.sh --yes` from the SDLC repo root

### Primary Flow (Happy Path)

1. `install.sh` detects the host platform via `uname -ms` per FR-3.1 and identifies the matching PDFium asset (`pdfium-mac-arm64.tgz`)
2. `install.sh` constructs the download URL from the pinned `chromium/<version>` tag plus the asset filename per FR-3.3
3. `install.sh` honors the FR-3.6 SCRIPT_DIR re-invocation pattern — `get_source_dir` is called after any prior `cd` that could shift `SCRIPT_DIR`
4. `install.sh` downloads the archive to a temporary location, then extracts to `~/.claude/tools/sdlc-knowledge/pdfium/` such that `libpdfium.dylib` lands at `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` per FR-3.2
5. `install.sh` sets up the library-resolver path per FR-3.4 (architect-selected mechanism: `DYLD_LIBRARY_PATH` on macOS or extraction directly to a system-default location, or the explicit `Pdfium::bind_to_library(<path>)` API)
6. `install.sh` reports the install summary including the PDFium dylib budget (10–15 MB sibling, ≤ 25 MB total per NFR-2)
7. The remainder of `install.sh` proceeds with iter-1 behavior (config copy, allowlist registration, project scaffolding) — UNCHANGED
8. `bash install.sh --yes` completes within 90 s including the PDFium download per AC-5
9. After install completes, `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>` exits 0 with ≥ 1 chunk indexed per AC-2 + AC-5

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` exists with non-zero size per AC-5
- `pdfium-render`'s library-path resolver locates the file at first use per FR-3.4
- Re-running `install.sh --yes` on a host where the library is already present at the pinned `chromium/<version>` tag is a no-op (no re-download, exit 0) per FR-3.7 / AC-5

**Mapped FR**: FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.6, FR-3.7
**Mapped ACs**: AC-5

### Alternative Flows

- **UC-4-A1: Re-running install on a host with PDFium already at the pinned tag** — Idempotent no-op
  1. Developer runs `bash install.sh --yes` again
  2. `install.sh` detects `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` exists AND a sibling version-marker file matches the pinned `chromium/<version>` tag
  3. The download step is skipped per FR-3.7
  4. Total elapsed time is bounded by version-check + iter-1 install steps, well under 90 s
  5. exit 0

  **Mapped FR**: FR-3.7
  **Mapped ACs**: AC-5

- **UC-4-A2: Maintainer bumps the pinned `chromium/<version>` tag in `install.sh`** — Single-line edit per FR-3.3
  1. Maintainer edits the tag declaration at the top of `install.sh` to a new `chromium/<int>` value
  2. Developer re-runs `bash install.sh --yes`
  3. `install.sh` detects the existing dylib but its version-marker file does NOT match the new tag — re-download triggers
  4. New archive is downloaded, extracted, replacing the old dylib
  5. `RELEASING.md` documents the bump per FR-8.3

  **Mapped FR**: FR-3.3, FR-3.7
  **Mapped ACs**: AC-5

### Error Flows

- **UC-4-E1: bblanchon/pdfium-binaries release URL returns 404** — Asset moved or upstream deleted
  1. `install.sh` attempts the download per FR-3.1
  2. The HTTP response is 404 (or other non-2xx)
  3. `install.sh` logs the literal warning `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected` per FR-3.5
  4. `install.sh` continues with the rest of the install per FR-3.5 graceful-degradation
  5. exit 0 — install.sh did NOT abort
  6. PDF ingest will fail per UC-9 with the literal `pdfium dynamic library not found ...` per FR-1.2 / FR-5.1; MD/TXT ingest works normally per FR-5.1

  **Mapped FR**: FR-3.5, NFR-5
  **Mapped ACs**: AC-6

- **UC-4-E2: PDFium archive is malformed/truncated** — Download returns 200 but the archive is invalid
  1. `install.sh` downloads the archive successfully (HTTP 200)
  2. The archive extraction step fails (`tar -xzf` returns non-zero)
  3. `install.sh` removes the partial extracted contents to avoid leaving a half-extracted state
  4. `install.sh` logs the same FR-3.5 warning and continues
  5. exit 0; subsequent PDF ingest fails per UC-9

  **Mapped FR**: FR-3.5
  **Mapped ACs**: AC-6

- **UC-4-E3: Disk space exhausted during PDFium archive extraction** — ENOSPC
  1. `install.sh` downloads the archive but extraction fails on ENOSPC
  2. `install.sh` removes any partial extraction
  3. `install.sh` logs the FR-3.5 warning enriched with the disk-space context
  4. exit 0 if the iter-1 install already succeeded; exit 1 if the iter-1 install fails too (out of scope of this UC)

  **Mapped FR**: FR-3.5
  **Mapped ACs**: AC-6

### Edge Cases

- **UC-4-EC1: User runs `install.sh --yes` from a working directory other than the SDLC repo root** — SCRIPT_DIR shift hazard per R-6
  1. The FR-3.6 re-invocation pattern ensures `get_source_dir` is called after every `cd` that could shift `SCRIPT_DIR`
  2. PDFium archive extraction targets the absolute `~/.claude/tools/sdlc-knowledge/pdfium/` path (NOT a `SCRIPT_DIR`-relative path)
  3. Install completes correctly regardless of cwd
  4. Slice 3 done-condition includes a regression test running `install.sh --yes` from `/tmp` to verify

  **Mapped FR**: FR-3.6, R-6
  **Mapped ACs**: AC-5

### Data Requirements

- **Input**: Host `uname -ms` output, GitHub release URL for `pdfium-mac-arm64.tgz` at the pinned `chromium/<version>` tag
- **Output**: `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` (10–15 MB per NFR-2)
- **Side Effects**: One network download (≤ ~15 MB), one archive extraction, one filesystem write of the dylib + sibling version-marker file

---

## UC-5: First-Time Install on linux-x64 — PDFium Binary Download

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Same as UC-4 except the host runs linux-x64 (`uname -ms` returns `Linux x86_64`)
- The expected post-extract file is `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.so` (NOT `libpdfium.dylib`) per R-3 cross-platform .so/.dylib variance

**Trigger**: Developer runs `bash install.sh --yes` from the SDLC repo root

### Primary Flow (Happy Path)

1. `install.sh` detects the host platform via `uname -ms` per FR-3.1 and identifies the matching PDFium asset (`pdfium-linux-x64.tgz`)
2. Same as UC-4 primary steps 2-9 except:
   - The asset filename is `pdfium-linux-x64.tgz` per FR-3.1
   - The post-extract filename is `libpdfium.so` per R-3
   - The library-resolver mechanism uses `LD_LIBRARY_PATH` on Linux per FR-3.4 (or the architect-selected explicit-path API)

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.so` exists with non-zero size per AC-5
- Subsequent PDF ingest works per UC-1

**Mapped FR**: FR-3.1, FR-3.2, FR-3.4, FR-3.7, R-3
**Mapped ACs**: AC-5

### Error Flows

- **UC-5-E1: linux-x64 host's `glibc` version is below what the bblanchon binary requires** — Binary loads but symbol resolution fails at runtime
  1. The dylib extracts successfully
  2. First `Pdfium::bind_to_system_library()` call fails with a glibc-related dynamic linker error
  3. The error surfaces as `IngestError::PdfDecode` with the FR-1.2 message format `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes` (or a more specific glibc-incompatibility message)
  4. The R-8 mitigation: the FR-7.2 smoke step on the matrix runner exercises load-on-CI; if a runner fails, the workflow fails fast

  **Mapped FR**: FR-1.2, R-8
  **Mapped ACs**: AC-6

### Data Requirements

Same as UC-4 except `pdfium-linux-x64.tgz` and `libpdfium.so`.

---

## UC-6: First-Time Install on darwin-x64 — PDFium Binary Download

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Same as UC-4 except the host runs darwin-x64 (`uname -ms` returns `Darwin x86_64`)
- The asset filename is `pdfium-mac-x64.tgz` per FR-3.1
- The post-extract filename is `libpdfium.dylib` (same as darwin-arm64)

**Trigger**: Developer runs `bash install.sh --yes` from the SDLC repo root

### Primary Flow (Happy Path)

1. Same as UC-4 primary except:
   - `uname -ms` returns `Darwin x86_64`
   - The asset filename is `pdfium-mac-x64.tgz` per FR-3.1
   - All other steps identical

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib` exists per AC-5

**Mapped FR**: FR-3.1, FR-3.2
**Mapped ACs**: AC-5

### Error Flows

- **UC-6-E1: darwin-x64 host's macOS notarization rejects the unsigned dylib** — Hardened runtime path per R-8
  1. The dylib extracts successfully
  2. First `Pdfium::bind_to_system_library()` call fails because Gatekeeper blocks the unsigned binary
  3. The error surfaces as `IngestError::PdfDecode`
  4. Mitigation: bblanchon's binaries may be ad-hoc signed; if not, the user must `xattr -d com.apple.quarantine` the dylib (documented in `RELEASING.md` per FR-8.3 fallback section)

  **Mapped FR**: FR-1.2, R-8
  **Mapped ACs**: AC-6

### Data Requirements

Same as UC-4 except `pdfium-mac-x64.tgz`.

---

## UC-7: First-Time Install on linux-arm64 — PDFium Binary Download

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Same as UC-5 except the host runs linux-arm64 (`uname -ms` returns `Linux aarch64`)
- The asset filename is `pdfium-linux-arm64.tgz` per FR-3.1
- The post-extract filename is `libpdfium.so`

**Trigger**: Developer runs `bash install.sh --yes` from the SDLC repo root

### Primary Flow (Happy Path)

1. Same as UC-5 primary except `uname -ms` returns `Linux aarch64` and the asset filename is `pdfium-linux-arm64.tgz`
2. The matrix runner label `ubuntu-22.04-arm` (per §11 FR-11.1, BYTE-UNCHANGED in iter-2 per FR-7.3) exercises this platform in CI

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.so` exists per AC-5

**Mapped FR**: FR-3.1, FR-3.2, FR-7.3
**Mapped ACs**: AC-5

### Error Flows

- **UC-7-E1: linux-arm64 host's CPU is older than what the bblanchon binary's compiler targets** — ABI mismatch per R-8
  1. The dylib extracts successfully but execution traps on an unsupported instruction
  2. The error surfaces as `IngestError::PdfDecode`; the FR-7.2 smoke step on the matrix runner catches this case

  **Mapped FR**: FR-1.2, R-8
  **Mapped ACs**: AC-6

### Data Requirements

Same as UC-5 except `pdfium-linux-arm64.tgz`.

---

## UC-8: install.sh Runs but PDFium Download Fails — Graceful Degradation

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Common preconditions hold
- The host has the iter-1 `sdlc-knowledge` binary present OR is being upgraded to iter-2
- Network connectivity to GitHub Releases is unavailable (no network, firewall blocks GitHub, the bblanchon repo is temporarily unreachable, etc.)

**Trigger**: Developer runs `bash install.sh --yes` from the SDLC repo root with no PDFium connectivity

### Primary Flow (Happy Path)

1. `install.sh` reaches the PDFium download step per FR-3.1
2. The `curl`/`wget` call returns non-zero (connection refused, timeout, DNS failure, TLS error, etc.)
3. `install.sh` logs the literal warning `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected` per FR-3.5
4. `install.sh` continues with iter-1's existing config-copy, allowlist registration, project scaffolding per FR-3.5
5. `install.sh` exits 0 — the rest of the install completes per FR-3.5 graceful-degradation
6. Subsequent `sdlc-knowledge ingest <md-file>` works normally per FR-5.1 / NFR-5
7. Subsequent `sdlc-knowledge ingest <pdf-file>` fails per-file with the literal error per UC-9

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` does NOT exist
- The rest of the iter-1 install state (binary, allowlist, scaffolding) is intact
- MD and TXT ingestion continue to work
- PDF ingestion fails per UC-9 contract

**Mapped FR**: FR-3.5, NFR-5, FR-5.1
**Mapped ACs**: AC-6

### Edge Cases

- **UC-8-EC1: User has PDFium installed manually outside `~/.claude/tools/sdlc-knowledge/pdfium/`** — System-wide PDFium present (e.g., installed via `brew install pdfium` or extracted into `/usr/local/lib/`)
  1. `install.sh` attempts to download to `~/.claude/tools/sdlc-knowledge/pdfium/lib/`; if the download fails, FR-3.5 graceful degradation applies
  2. At runtime, `pdfium-render`'s `Pdfium::bind_to_system_library()` searches the platform's standard library locations (`/usr/local/lib/`, `/usr/lib/`, `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` paths) per FR-3.4 mechanism
  3. If the user's manually-installed PDFium is on the resolver's search path, PDFium loads successfully and PDF ingest works per UC-1
  4. If the user's manually-installed PDFium is NOT on the resolver's search path, PDF ingest fails per UC-9
  5. **Expected behavior**: iter-2 does NOT actively suppress system-wide PDFium installations; the FR-3.4 resolver mechanism determines whether the manual install is found. RESOLUTION pending architect Step 3 (Open Question #1 below)

  **Mapped FR**: FR-1.2, FR-3.4
  **Mapped ACs**: AC-6 (graceful semantic; not an error if found)

### Data Requirements

- **Input**: Same as UC-4 but with no PDFium connectivity
- **Output**: Same iter-1 install state as before; PDFium dylib absent
- **Side Effects**: One failed network attempt (the warning is logged); the rest of install.sh executes normally

---

## UC-9: `sdlc-knowledge ingest <pdf>` When PDFium Absent — Per-File Failure

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The iter-2 `sdlc-knowledge` binary at version 0.2.0 is installed
- The PDFium dynamic library is NOT installed (e.g., UC-8 occurred, or user did `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/`)
- A PDF file exists at the path passed to `ingest`

**Trigger**: Developer runs `sdlc-knowledge ingest <pdf-file>.pdf --project-root <tmpdir>`

### Primary Flow (Happy Path)

1. The binary parses arguments and canonicalizes `--project-root` per §11 FR-1.5
2. The binary opens or creates `<tmpdir>/.claude/knowledge/index.db`
3. The binary calls `pdf::read(<pdf-file>)`
4. `pdf::read` attempts to instantiate the per-process `Pdfium` engine via the architect-selected library-path resolver (default `Pdfium::bind_to_system_library()` per FR-1.2)
5. The library-path resolver fails — no `libpdfium.{dylib|so}` is found at the expected location
6. The binding returns a load-failure error (it MUST NOT panic per FR-1.2)
7. `pdf::read` translates the load-failure into `IngestError::PdfDecode` with the literal message `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes` per FR-1.2
8. The binary prints the per-file error to stderr per §11 FR-2.6 inherited
9. For a single-file invocation, the binary exits 1 per FR-5.2
10. `panicked at` does NOT appear in stderr per AC-6

**Postconditions**:
- `documents` table is unchanged (no new row for the failed PDF)
- `chunks` table is unchanged
- stderr contains the literal `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes`
- exit 1

**Mapped FR**: FR-1.2, FR-5.1, FR-5.2, NFR-5
**Mapped ACs**: AC-6

### Edge Cases

- **UC-9-EC1: Mixed batch (sample.md + sample.pdf) with PDFium absent — md succeeds, pdf fails, batch exits 0**
  1. Developer runs `sdlc-knowledge ingest <dir>` where the directory contains `.md` and `.pdf` files
  2. The `.md` files are read via `text::read_md` (PDFium-independent) per §11 FR-2.2 — they succeed
  3. The `.pdf` files trigger the FR-1.2 load-failure path per UC-9 primary
  4. The batch CONTINUES per §11 FR-2.6's per-file error boundary
  5. `documents` and `chunks` tables receive rows for the `.md` files only
  6. stderr contains one `pdfium dynamic library not found ...` line per `.pdf` file
  7. The batch exits 0 because at least one file (the MD) succeeded per §11 FR-2.6 / FR-5.1
  8. NFR-5 fault-isolation contract: PDFium absence does NOT break MD/TXT ingest, search, list, status, or delete

  **Mapped FR**: FR-5.1, NFR-5
  **Mapped ACs**: AC-6

- **UC-9-EC2: Search and management subcommands work normally with PDFium absent** — Read-side fault isolation per FR-5.3
  1. With PDFium absent, the developer runs `sdlc-knowledge search "<query>" --top-k 5 --json --project-root <tmpdir>`
  2. The search subcommand opens `index.db` and runs the FTS5 query per §11 FR-3.1 — PDFium is NOT loaded for read paths
  3. The query returns previously-indexed content normally per FR-5.3
  4. Same applies to `list`, `status`, and `delete` per FR-5.3

  **Mapped FR**: FR-5.3, NFR-5
  **Mapped ACs**: AC-6

### Data Requirements

- **Input**: A `.pdf` file passed to `ingest`; absence of `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}`
- **Output**: stderr error line; exit 1 (single-file) or exit 0 (mixed batch with at least one success)
- **Side Effects**: No DB write for the failed PDF; full DB write for any non-PDF in the same batch

---

## UC-10: `sdlc-knowledge delete --by-id <int>` Removes a Stale-Source Row

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- An iter-2 binary at version 0.2.0 is in use
- The `documents` table contains at least one row whose `source_path` value is OUTSIDE the current `--project-root` (e.g., a stale row from a renamed source dir, or a row left behind by an aborted iter-1 ingest, or the §11-test-discovered case where the canonicalized path differs from the stored path)
- The integer `documents.id` of that row is known to the developer (via `sdlc-knowledge list --json` or direct DB inspection)

**Trigger**: Developer runs `sdlc-knowledge delete --by-id <int> --json --project-root <tmpdir>`

### Primary Flow (Happy Path)

1. The binary parses the `--by-id <int>` flag per FR-4.1
2. The mutual-exclusion check confirms `--by-id` was supplied without a positional `<source-path>` per FR-4.1
3. The integer is parsed as a non-negative `i64` per FR-4.2
4. The binary canonicalizes `--project-root` per §11 FR-1.5 — the project-root gate at DB-open time is the security boundary per FR-4.3
5. The binary opens `<tmpdir>/.claude/knowledge/index.db`
6. The binary does NOT pass the supplied id through `resolve_project_root` per FR-4.3 — the integer primary key is the address, not a path
7. The binary executes a transactional delete via `delete_by_id(conn, id)` per FR-4.4 — `BEGIN IMMEDIATE`, delete the `documents` row, allow the FTS5 trigger to cascade `chunks_fts` deletions, delete dependent `chunks` rows (cascade), `COMMIT`
8. The binary emits JSON output per FR-4.5: `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}`
9. exit 0 per AC-7

**Postconditions**:
- The `documents` row with the supplied id is removed
- All dependent `chunks` rows are removed
- The FTS5 `chunks_fts` rows for those chunks are removed via the trigger cascade
- The DB is left in a consistent state (the `BEGIN IMMEDIATE` transaction either fully applied or fully rolled back)
- stdout contains the literal JSON shape `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}`

**Mapped FR**: FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5
**Mapped ACs**: AC-7

### Alternative Flows

- **UC-10-A1: `--by-id` without `--json`** — Human-readable text output mode
  1. Same as UC-10 primary except step 8 emits a human-readable line: `deleted document <int> at <source-path> (<chunks-removed> chunks)` per the iter-1 text-output convention
  2. exit 0

  **Mapped FR**: FR-4.5
  **Mapped ACs**: AC-7

### Error Flows

- **UC-10-E1: `--by-id <int>` with id that exists but `documents.source_path` is OUTSIDE the canonicalized project-root** — The exact case that motivated this feature per 12.1 companion fix
  1. Same as UC-10 primary — the deletion succeeds because FR-4.3 explicitly allows this
  2. The DB-open gate at step 5 is the only project-root canonicalization check; the supplied id is not subject to path canonicalization per FR-4.3
  3. This is the design rationale per 12.1: the iter-1 path-based delete CANNOT remove this row, but the iter-2 `--by-id` form CAN

  **Mapped FR**: FR-4.3
  **Mapped ACs**: AC-7

- **UC-10-E2: `--by-id <negative-int>` or non-numeric value** — `clap` arg-parse failure
  1. The binary's argument parser rejects the negative or non-numeric value at parse time
  2. `clap` prints an arg-parse error to stderr and exits 2 (clap's standard arg-parse exit code)
  3. The DB is not opened; no transaction begins; no rows touched
  4. **Note**: the FR-4.2 wording requires "non-negative `i64`"; the literal stderr message format is clap-driven, not a custom literal

  **Mapped FR**: FR-4.2
  **Mapped ACs**: AC-7 (negative path)

- **UC-10-E3: `--by-id <int>` where DB-open fails (e.g., index.db is corrupt)** — Existing iter-1 corrupt-index path inherited
  1. The binary canonicalizes `--project-root` successfully
  2. DB-open at step 5 fails per §11 FR-1.6 with the literal stderr `error: index database invalid; re-ingest required`
  3. exit 1
  4. No DB mutation
  5. This path is iter-1 behavior, INHERITED unchanged in iter-2

  **Mapped FR**: §11 FR-1.6 inherited
  **Mapped ACs**: §11 AC-7 inherited

### Data Requirements

- **Input**: An integer id that exists in `documents`; `--project-root <tmpdir>`
- **Output**: JSON `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}`; exit 0
- **Side Effects**: One `BEGIN IMMEDIATE` transaction; row deletions in `documents`, `chunks`, `chunks_fts` (via trigger)

---

## UC-11: `sdlc-knowledge delete --by-id <int>` for a Non-Existent ID

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The `documents` table does NOT contain a row with the supplied id

**Trigger**: Developer runs `sdlc-knowledge delete --by-id <nonexistent-int> --project-root <tmpdir>`

### Primary Flow (Happy Path)

1. Same as UC-10 primary steps 1-6
2. The `delete_by_id(conn, id)` call queries for the row; the row does not exist
3. The binary surfaces the literal stderr message `error: no document with id <int>` per FR-4.2
4. The transaction is rolled back (or never begun, depending on implementation order); no DB mutation occurs per FR-4.2
5. exit 1 per FR-4.2

**Postconditions**:
- `documents`, `chunks`, `chunks_fts` are byte-identical to pre-invocation per FR-4.2
- stderr contains the literal `error: no document with id <int>`
- exit 1

**Mapped FR**: FR-4.2
**Mapped ACs**: AC-7

### Edge Cases

- **UC-11-EC1: Race condition — id existed at invocation start but was deleted by a concurrent process** — WAL concurrency
  1. The first query (id-existence check) sees the row
  2. Before the DELETE statement executes, a concurrent invocation (UC-10 from another process) deletes the row
  3. The DELETE statement affects 0 rows
  4. **Two acceptable resolutions** (architect Step 3 picks one):
     - (a) Treat 0-affected-rows as success (idempotent delete) → exit 0 with `chunks_removed: 0`
     - (b) Treat 0-affected-rows as `error: no document with id <int>` → exit 1
  5. RESOLUTION pending: documented as Open Question #2 below

  **Mapped FR**: FR-4.2, FR-4.4
  **Mapped ACs**: AC-7

### Data Requirements

- **Input**: An integer id that does NOT exist in `documents`
- **Output**: stderr `error: no document with id <int>`; exit 1
- **Side Effects**: No DB mutation per FR-4.2 (`NOT touch the database`)

---

## UC-12: Legacy `sdlc-knowledge delete <source-path>` Continues to Work (Backward Compat)

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- An iter-2 binary at version 0.2.0 is in use
- The `documents` table contains a row whose `source_path` resolves UNDER the canonicalized project-root (i.e., the row is reachable via the iter-1 path-based delete)

**Trigger**: Developer runs `sdlc-knowledge delete <source-path> --project-root <tmpdir>` (no `--by-id`, positional path argument as in iter-1)

### Primary Flow (Happy Path)

1. The binary parses arguments — the positional `<source-path>` is supplied without `--by-id` per FR-9.1 (existing positional form preserved)
2. The mutual-exclusion check confirms only ONE of the two forms was supplied per FR-4.1
3. The binary canonicalizes the supplied path through `resolve_project_root` per §11 FR-1.5 (the iter-1 path-canonicalization gate)
4. The canonicalized path resolves UNDER the project-root → the gate passes
5. The binary executes the iter-1 `delete_by_path(conn, canonicalized_path)` codepath UNCHANGED
6. The matching `documents` row, dependent `chunks` rows, and `chunks_fts` rows are removed transactionally
7. The binary emits the iter-1 output shape (text or JSON depending on `--json` flag) — UNCHANGED in iter-2 per FR-9.1
8. exit 0

**Postconditions**:
- The `documents` row matching the canonicalized path is removed
- Dependent `chunks` and `chunks_fts` rows are removed
- iter-1's CLI-and-output contract for path-based delete is preserved BYTE-FOR-BYTE per FR-9.1

**Mapped FR**: FR-9.1, FR-4.1 (mutual-exclusion path)
**Mapped ACs**: (no direct AC; §11 AC-6 / AC-7 inherited as-is)

### Error Flows

- **UC-12-E1: Legacy path-based delete on a path that escapes project-root — still rejected with exit 2 (existing AC-6 from §11)** — Path-traversal defense unchanged
  1. The supplied `<source-path>` canonicalizes outside the project-root
  2. The §11 FR-1.5 gate rejects the path with the literal stderr `error: project-root must resolve under current working directory`
  3. exit 2
  4. **This is exactly why FR-4.3 introduces `--by-id` for stale-row cleanup** — the path-based form CANNOT delete rows whose stored `source_path` is outside the project-root

  **Mapped FR**: §11 FR-1.5 inherited, FR-4.3 (rationale)
  **Mapped ACs**: §11 AC-6

- **UC-12-E2: Legacy path-based delete with a path that has no matching row in `documents`** — iter-1 behavior unchanged
  1. The path canonicalizes successfully under project-root
  2. The `delete_by_path` query finds no matching row
  3. The binary surfaces the iter-1 literal error message (from §11) — UNCHANGED

  **Mapped FR**: FR-9.1
  **Mapped ACs**: §11 AC-7 inherited

### Data Requirements

- **Input**: A path that resolves under the canonicalized `--project-root`
- **Output**: Same as iter-1 (text or JSON per `--json` flag); exit 0
- **Side Effects**: Same as iter-1 (one transactional delete)

---

## UC-13: Re-Ingest of a Previously-Extracted PDF After pdfium-render Replaces pdf-extract — Idempotent No-Op

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The iter-2 binary at version 0.2.0 is in use
- The PDFium dynamic library is installed
- The `documents` table contains a row for `<pdf-path>` written under iter-1 (or under iter-2 from a prior ingest); the row's `(source_path, mtime, sha256)` matches the on-disk file
- The `chunks` table contains the iter-1-extracted (or prior-iter-2-extracted) chunks for that document

**Trigger**: Developer runs `sdlc-knowledge ingest <pdf-path> --project-root <tmpdir>` a second time

### Primary Flow (Happy Path)

1. The binary computes `(source_path, mtime, sha256)` for the on-disk file per §11 FR-2.5
2. The binary queries `documents` for an existing row matching the tuple
3. The query finds an existing row whose tuple matches → idempotent no-op per §11 FR-2.5
4. The binary emits the literal log line `unchanged: <path>` per §11 FR-2.5 / FR-9.7
5. NO new chunks are written
6. NO chunks are deleted; the iter-1-extracted chunks remain in the table even though iter-2's pdfium-render WOULD produce different chunks if re-extraction occurred
7. exit 0

**Postconditions**:
- `documents` table is byte-identical to pre-invocation
- `chunks` table is byte-identical to pre-invocation
- The `documents.ingested_at` value MAY OR MAY NOT be updated — this is the §11-Slice-2 idempotency assumption (UC-9 in the §11 use cases inherited)
- stderr/stdout contains `unchanged: <path>`
- **Critical**: this means iter-2 does NOT automatically re-extract previously-ingested PDFs even though the new extractor is better. The maintainer must explicitly `delete --by-id <int>` (UC-10) then re-ingest (UC-14) to refresh — documented in `RELEASING.md` per FR-8.3 / R-5

**Mapped FR**: FR-9.7
**Mapped ACs**: AC-3

### Alternative Flows

- **UC-13-A1: The on-disk file's `mtime` changed but the `sha256` did not** — Touch-without-edit
  1. The mtime in the tuple key differs from the stored value
  2. **Two acceptable resolutions** (per §11 FR-2.5 wording — re-verify during architect review):
     - (a) The tuple is treated as a key, so any component change triggers re-extract → not idempotent
     - (b) sha256 is the dominant identity check; mtime drift is ignored → idempotent
  3. iter-1 default per §11 FR-2.5 wording is treat-as-tuple (a); iter-2 inherits this UNCHANGED per FR-9.7

  **Mapped FR**: FR-9.7
  **Mapped ACs**: AC-3

### Edge Cases

- **UC-13-EC1: An iter-1 index.db is opened by an iter-2 binary for the FIRST time** — Cross-iteration boundary
  1. iter-2 binary at version 0.2.0 opens an `index.db` written by iter-1 at version 0.1.0
  2. The schema_version row reads `1` (iter-1's value) — UNCHANGED per FR-9.7
  3. No migration is required per FR-9.7 — iter-1 indexes opened by iter-2 binaries continue to work
  4. Re-ingesting any PDF that was indexed under iter-1 is an idempotent no-op per UC-13 primary
  5. The iter-1-extracted chunks remain in the table even though iter-2's extractor would produce different (better) chunks

  **Mapped FR**: FR-9.7
  **Mapped ACs**: AC-3

### Data Requirements

- **Input**: A `<pdf-path>` whose `(source_path, mtime, sha256)` matches an existing `documents` row
- **Output**: `unchanged: <path>` log line; exit 0
- **Side Effects**: NO DB mutation (or at most an `ingested_at` touch — assumption per §11)

---

## UC-14: Re-Ingest After `delete --by-id` Then Re-Ingest — Fresh Extraction with pdfium-render

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The iter-2 binary at version 0.2.0 is in use; PDFium is installed
- The `documents` table contains an iter-1-extracted row for `<pdf-path>` with iter-1-style chunks (e.g., the calibre PDF that produced ~2 chunks/MB under iter-1)
- The developer wants to refresh the extraction with pdfium-render to get the better chunk count per NFR-4

**Trigger**: Developer runs (a) `sdlc-knowledge delete --by-id <int> --project-root <tmpdir>` then (b) `sdlc-knowledge ingest <pdf-path> --project-root <tmpdir>`

### Primary Flow (Happy Path)

1. **Step (a) — delete**: Per UC-10 primary — the iter-1 row is removed; dependent chunks and FTS5 entries cascade-delete
2. **Step (b) — re-ingest**: Per UC-1 primary — pdfium-render extracts the PDF freshly; new chunks are written
3. The new chunk count under iter-2 differs from the iter-1 baseline per R-5
4. For calibre-converted PDFs, the chunk count MUST be ≥ 50 chunks/MB per NFR-4 / AC-2 — closing at least 95% of the gap between iter-1's ~2 chunks/MB and pypdf-as-Markdown's ~2500 chunks/MB per 12.1 / NFR-4
5. For non-calibre PDFs (the 7-of-9 books that succeeded under iter-1), the chunk count MUST be ≥ 50% of the iter-1 baseline per UC-2 / R-5
6. exit 0 on both invocations

**Postconditions**:
- `documents` table contains a NEW row for `<pdf-path>` (different `id` than the deleted one — the integer primary key is auto-increment per §11 FR-4.2 inherited)
- `chunks` table contains pdfium-extracted chunks
- `chunks_fts` reflects the new chunks via the FTS5 trigger
- A subsequent search for a phrase known to be in the PDF returns the new chunks per AC-4

**Mapped FR**: FR-1.1 through FR-1.7, FR-4.1 through FR-4.5, NFR-4, R-5
**Mapped ACs**: AC-2, AC-3, AC-7

### Alternative Flows

- **UC-14-A1: One-time corpus refresh after iter-2 ships** — Maintainer documents the procedure in `RELEASING.md`
  1. After iter-2 ships, the maintainer runs `sdlc-knowledge list --json` to enumerate all iter-1-extracted documents
  2. For each, `delete --by-id <int>` then re-ingest per UC-14 primary
  3. The total corpus is refreshed with pdfium-render extraction
  4. This is a one-time event documented in `RELEASING.md` per R-5 mitigation / FR-8.3

  **Mapped FR**: FR-8.3, R-5
  **Mapped ACs**: AC-2

### Error Flows

- **UC-14-E1: Re-ingest under iter-2 produces FEWER chunks than the iter-1 baseline minus the R-5 50% floor** — Catastrophic regression on a non-calibre PDF
  1. UC-2-E1 path applies — the regression test fails
  2. The user-facing impact is degraded BM25 recall on that PDF compared to iter-1
  3. Resolution: the maintainer either (a) restores the iter-1 row from a DB backup or (b) accepts the new baseline if extraction quality differences are explainable

  **Mapped FR**: R-5
  **Mapped ACs**: AC-2 (negative path)

### Data Requirements

- **Input**: An iter-1-extracted `<pdf-path>` and its `documents.id`
- **Output**: New `documents` row + new chunks; exit 0
- **Side Effects**: One delete transaction + one ingest transaction = two DB writes total

---

## UC-15: `sdlc-knowledge --version` Continues to Exit 0 with Bumped Version String

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The iter-2 binary is installed at the path `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`

**Trigger**: Developer runs `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version`

### Primary Flow (Happy Path)

1. The binary's clap-derived `--version` flag returns the crate version per `tools/sdlc-knowledge/Cargo.toml` per FR-2.1
2. The version string is `sdlc-knowledge 0.2.0` (NOT `sdlc-knowledge 0.1.0` — bumped per NFR-9)
3. exit 0 per §11 AC-1 inherited
4. Total elapsed time is well under 60 s (no I/O beyond reading the embedded version constant)

**Postconditions**:
- stdout contains the literal `sdlc-knowledge 0.2.0`
- exit 0

**Mapped FR**: NFR-9, FR-9.1, FR-2.1
**Mapped ACs**: §11 AC-1 inherited

### Alternative Flows

- **UC-15-A1: Iter-2 binary built from local source via the §11 cargo source-build fallback** — Same version bump
  1. `Cargo.toml` declares `version = "0.2.0"` per NFR-9
  2. `cargo build --release -p sdlc-knowledge` produces a binary whose `--version` returns `sdlc-knowledge 0.2.0`
  3. Same outcome as UC-15 primary

  **Mapped FR**: NFR-9, FR-2.1
  **Mapped ACs**: §11 AC-1 inherited

### Data Requirements

- **Input**: None (no flags beyond `--version`)
- **Output**: stdout `sdlc-knowledge 0.2.0`; exit 0
- **Side Effects**: None

---

## UC-16: `delete --by-id` and `<source-path>` Mutual Exclusion Enforced

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The iter-2 binary is in use

**Trigger**: Developer runs `sdlc-knowledge delete --by-id 5 some/path.pdf --project-root <tmpdir>` (BOTH forms supplied — illegal)

### Primary Flow (Happy Path)

1. The binary's clap-derived argument parser detects both `--by-id` and the positional `<source-path>` per FR-4.1
2. The mutual-exclusion check rejects the invocation per FR-4.1
3. The binary prints the literal stderr `error: --by-id and <source-path> are mutually exclusive` per FR-4.1 / AC-8
4. exit 2 per FR-4.1 (clap's standard arg-parse exit code)
5. No DB open; no DB mutation

**Postconditions**:
- DB is byte-identical to pre-invocation
- stderr contains the literal `error: --by-id and <source-path> are mutually exclusive`
- exit 2

**Mapped FR**: FR-4.1
**Mapped ACs**: AC-8

### Edge Cases

- **UC-16-EC1: Neither `--by-id` nor `<source-path>` supplied** — Argument required
  1. clap detects that the `delete` subcommand was invoked with no arguments
  2. clap emits its standard "argument required" error
  3. exit 2
  4. **Note**: the literal stderr wording is clap-driven, not a custom literal. FR-4.1 specifies behavior only when BOTH are supplied; the no-arguments case is iter-1-inherited

  **Mapped FR**: FR-4.1 (mutual-exclusion contract; no-args is iter-1)
  **Mapped ACs**: (no direct AC)

### Data Requirements

- **Input**: Both `--by-id <int>` and a positional path argument
- **Output**: stderr literal; exit 2
- **Side Effects**: None

---

## Cross-Cutting Use Cases

### UC-CC-1: Cross-Platform Install Matrix (4 Platforms)

**Scenario**: Verify `bash install.sh --yes` succeeds AND PDF ingest works on darwin-arm64, darwin-x64, linux-x64, and linux-arm64; Windows is OUT OF SCOPE per 12.7 item 3.

1. On each of the four supported platforms, run `bash install.sh --yes` from a clean state (no prior `~/.claude/tools/sdlc-knowledge/pdfium/`)
2. Verify the platform-specific PDFium dylib exists at the expected path within 90 s per AC-5:
   - darwin-arm64 → `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib`
   - darwin-x64 → `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib`
   - linux-x64 → `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.so`
   - linux-arm64 → `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.so`
3. Verify the dylib size is non-zero AND ≤ 25 MB total per-platform install footprint per NFR-2
4. Run `sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root <tmpdir>` and assert exit 0 with ≥ 1 chunk per AC-2 + AC-5
5. Verify search round-trip per AC-4 — `sdlc-knowledge search "<phrase>" --top-k 5 --json` returns the fixture with positive BM25 score
6. The GitHub Actions matrix at `.github/workflows/sdlc-knowledge-release.yml` per FR-7.1 / FR-7.2 / FR-7.3 verifies steps 1-4 on each matrix runner (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) on every `sdlc-knowledge-v*` tag
7. The matrix labels are BYTE-UNCHANGED from §11 FR-11.1 per FR-7.3

**Mapped FR**: FR-3.1, FR-3.2, NFR-7, FR-7.1, FR-7.2, FR-7.3
**Mapped ACs**: AC-5, AC-9

### UC-CC-2: Invariant Preservation — 17 Agents, 10 Gates, 5 Executors Byte-Unchanged, README Taglines

**Scenario**: After iter-2 merges, verify all invariants per FR-9.1 through FR-9.7 / FR-8.4 hold.

1. `ls src/agents/*.md | wc -l` returns exactly `17` per FR-9.4
2. `grep -Fxc "10 quality gates" README.md` returns ≥ 1 per FR-9.4 (line 35 BYTE-UNCHANGED per FR-8.4)
3. README contains the literal line `17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.` at line 5 BYTE-UNCHANGED per FR-8.4 / FR-9.4
4. The 5 executor agent prompt files have ZERO diff vs pre-iter-2 main per FR-9.6:
   - `git diff <pre-iter2-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md` returns empty
5. The 12 thinking-agent activation block (`## Knowledge Base (when present)` section) is BYTE-UNCHANGED in iter-2 per FR-9.3 — verifiable via `git diff <pre-iter2-merge-commit>..HEAD -- src/agents/{prd-writer,ba-analyst,architect,qa-planner,planner,security-auditor,code-reviewer,verifier,refactor-cleaner,resource-architect,role-planner,release-engineer}.md` showing only docs-related edits, no activation-block edits
6. The cognitive-self-check rule file `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED per FR-9.5 — verifiable via `git diff` returning empty
7. The FTS5 + WAL schema is BYTE-UNCHANGED per FR-9.7 — `documents`, `chunks`, `chunks_fts`, `schema_version` retain their iter-1 column shape; the `chunks.embedding BLOB` column reservation for iter-3 hybrid search remains intact
8. The five `sdlc-knowledge` subcommands plus `--version` are BYTE-UNCHANGED in their public surface per FR-9.1 — only ADDITION is the `--by-id <int>` flag on `delete` (per FR-4.1)
9. The `knowledge-base:` citation literal is BYTE-UNCHANGED per FR-9.2

**Mapped FR**: FR-9.1, FR-9.2, FR-9.3, FR-9.4, FR-9.5, FR-9.6, FR-9.7, FR-8.4
**Mapped ACs**: (no direct AC; inherited from §11 AC-11)

### UC-CC-3: Cargo.toml Dep Swap — pdf-extract Removed, pdfium-render Added; Binary Still ≤ 10 MB

**Scenario**: After iter-2 merges, verify the dependency swap is clean per FR-2.1, FR-2.2 and the binary size budget holds per NFR-1 / NFR-2 / AC-1.

1. `tools/sdlc-knowledge/Cargo.toml` declares `pdfium-render = "0.9"` per FR-2.1; `pdf-extract = "0.7"` is removed per FR-2.1
2. `cargo tree -p pdfium-render --manifest-path tools/sdlc-knowledge/Cargo.toml` returns a single matched package at version `0.9.x` per AC-1
3. `cargo tree -p pdf-extract --manifest-path tools/sdlc-knowledge/Cargo.toml` returns exit code 1 with `error: package ID specification 'pdf-extract' did not match any packages` per FR-2.2 / AC-1 (confirms the dep is fully removed, not merely unreferenced)
4. The compiled `sdlc-knowledge` binary at `tools/sdlc-knowledge/target/release/sdlc-knowledge` after `cargo build --release` (with `strip = true`, `lto = true`, `codegen-units = 1`, `opt-level = 3` per the existing `[profile.release]` block) has size ≤ 10 MB per NFR-1 (UNCHANGED from §11 NFR-1.1)
5. The PDFium dynamic library sibling adds 10–15 MB per NFR-2; total per-platform install footprint is ≤ 25 MB
6. No string `pdf_extract` appears in `tools/sdlc-knowledge/src/pdf.rs` per FR-2.3 — verifiable via `grep -rn "pdf_extract" tools/sdlc-knowledge/src/` returning empty
7. The crate version line at `tools/sdlc-knowledge/Cargo.toml` is bumped `0.1.0 → 0.2.0` per NFR-9

**Mapped FR**: FR-2.1, FR-2.2, FR-2.3, NFR-1, NFR-2, NFR-9
**Mapped ACs**: AC-1

### UC-CC-4: Citation Format / Agent Activation Contract / CLI Surface from §11 All UNCHANGED

**Scenario**: iter-2 is a pure replacement of the PDF reader implementation plus one CLI flag and one binary download. The §11 contract surfaces are BYTE-UNCHANGED per FR-9.1 / FR-9.2 / FR-9.3.

1. **Citation literal** per FR-9.2 — the literal byte string `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` is unchanged. Verifiable via `grep -F "knowledge-base: <source-filename>:<chunk-id>" src/rules/knowledge-base.md` returning a match
2. **Agent activation block** per FR-9.3 — the `## Knowledge Base (when present)` section in each of the 12 thinking agents is unchanged. The 12 agents are: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`
3. **CLI surface** per FR-9.1 — five subcommands `ingest / search / list / status / delete` plus `--version` are byte-unchanged in their public flags. iter-2's only addition is the `--by-id <int>` flag on `delete`
4. **JSON output shape** per §11 FR-1.4 inherited — the `--json` output of `ingest`, `search`, `list`, `status` is byte-unchanged. iter-2's only addition is the new `delete --by-id` JSON shape `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}` per FR-4.5
5. **Activation sentinel** per §11 FR-10.1 inherited — the existence of `<project>/.claude/knowledge/index.db` triggers agent activation; absence is silent no-op. iter-2 does not change this
6. **Path-traversal defense** per §11 FR-1.5 inherited — `resolve_project_root` rejects out-of-tree paths with the literal `error: project-root must resolve under current working directory` and exit 2. iter-2 inherits unchanged

**Mapped FR**: FR-9.1, FR-9.2, FR-9.3
**Mapped ACs**: (no direct AC; assertion-as-test of the BYTE-UNCHANGED contracts)

### UC-CC-5: Knowledge-Base Mandate Continues to Fire Correctly (12 Thinking Agents Query Before Authoring)

**Scenario**: The cognitive-self-check protocol per `~/.claude/rules/cognitive-self-check.md` and the knowledge-base mandate per `~/.claude/rules/knowledge-base-tool.md` continue to operate identically in iter-2 — no behavioral change.

1. When a thinking agent (e.g., `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, etc.) is invoked on a feature in a project with `<project>/.claude/knowledge/index.db` present, the agent runs `~/.claude/tools/sdlc-knowledge/sdlc-knowledge status --json` per the mandate
2. The agent then runs `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json` for each domain-bearing concept BEFORE drafting the corresponding section
3. Load-bearing hits are cited under `## Facts → ### External contracts` using the BYTE-UNCHANGED literal format per FR-9.2
4. Zero-hit searches on plausibly-in-corpus concepts are documented under `### Open questions` per the mandate
5. The 5 exempt executors (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) do NOT query the knowledge base — UNCHANGED per FR-9.6
6. The Plan Critic's `## Facts` enforcement remains UNCHANGED per FR-9.5 — the cognitive-self-check rule file is BYTE-UNCHANGED
7. The agent activation block in the 12 thinking agents is BYTE-UNCHANGED per FR-9.3

**Mapped FR**: FR-9.3, FR-9.5, FR-9.6
**Mapped ACs**: (no direct AC; behavioral inheritance from §11)

---

## Facts

### Verified facts

- The PRD Section 12 spans `docs/PRD.md` lines 2696-2934 — verified by Read of those lines in the current session (the section header is at line 2696; the trailing `## Facts` block ends at line 2972 in the PRD)
- PRD Section 12 contains 8 sub-sections (12.1 through 12.8) plus the `## Facts` block — verified by Read in the current session
- The 9 functional requirement groups (FR-1 through FR-9), 9 non-functional requirements (NFR-1 through NFR-9), 9 acceptance criteria (AC-1 through AC-9), and 9 risks/dependencies (R-1 through R-9 plus 4 Dependency entries) are at PRD §12.3-§12.6 lines 2734-2865 — verified by Read in the current session
- The four iter-2 supported platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) and their bblanchon asset filenames (`pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz`) are enumerated in FR-3.1 at PRD line 2759 — verified by Read in the current session
- The literal install.sh warning string per FR-3.5 is `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected` at PRD line 2763 — verified by Read in the current session
- The literal pdfium-absent error string per FR-1.2 is `pdfium dynamic library not found at <searched paths>; install via bash install.sh --yes` at PRD line 2739 — verified by Read in the current session
- The literal mutual-exclusion error string per FR-4.1 is `error: --by-id and <source-path> are mutually exclusive` at PRD line 2771 — verified by Read in the current session
- The literal non-existent-id error string per FR-4.2 is `error: no document with id <int>` at PRD line 2772 — verified by Read in the current session
- The literal password-protected error message component per FR-1.3 is `password-protected; not supported in iter-2` at PRD line 2740 — verified by Read in the current session
- The `delete --by-id` JSON output shape per FR-4.5 is `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}` at PRD line 2775 — verified by Read in the current session
- The 50 MB byte budget constant `PDF_BUDGET_BYTES = 50 * 1024 * 1024` is preserved BYTE-FOR-BYTE per FR-1.5 — verified by Read of FR-1.5 (PRD line 2742) and the iter-1 `tools/sdlc-knowledge/src/pdf.rs:17` claim from the §12 PRD's `## Facts` block in the current session
- The 12 thinking agents and 5 executor agents enumerated in §11 / cognitive-self-check rule are BYTE-UNCHANGED in iter-2 per FR-9.3 / FR-9.6 — verified by Read of FR-9 (PRD lines 2818-2825) and the `~/.claude/rules/cognitive-self-check.md` Application Scope block in the current session
- The post-extract dylib filenames are platform-specific: darwin → `libpdfium.dylib`, linux → `libpdfium.so` per R-3 at PRD line 2854 — verified by Read in the current session
- The pinned PDFium tag scheme is `chromium/<version>` per FR-3.3 at PRD line 2761 — verified by Read in the current session
- The crate version bump `0.1.0 → 0.2.0` per NFR-9 at PRD line 2836 — verified by Read in the current session
- The matrix runner labels (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) are BYTE-UNCHANGED from §11 FR-11.1 per FR-7.3 at PRD line 2802 — verified by Read in the current session
- The chunks-per-MB floor for calibre PDFs is ≥ 50 per NFR-4 at PRD line 2831 — verified by Read in the current session
- The total install footprint budget is ≤ 25 MB per NFR-2 at PRD line 2829 — verified by Read in the current session
- The vendored fixture path `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` and the sibling provenance README `calibre-sample.README.md` are mandated by FR-6.1 / FR-6.3 at PRD lines 2789, 2794 — verified by Read in the current session
- The `IngestError::PdfDecode` variant identity is preserved (only its message string changes) per FR-2.4 at PRD line 2753 — verified by Read in the current session
- The `extract_via_closure_for_test` test seam is preserved with unchanged signature per FR-1.7 at PRD line 2744 — verified by Read in the current session
- This is a NEW use-case file (CREATE, not UPDATE) — verified via `ls /Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/` in the current session: no `pdfium-pdf-extraction_use_cases.md` exists; the existing `local-knowledge-base_use_cases.md` covers iter-1 and explicitly stops at the iter-1 contract surface
- The format precedent file is `docs/use-cases/local-knowledge-base_use_cases.md` (1659 lines, 15 primary UCs + 5 cross-cutting + terminal `## Facts` block) — verified by Read of header, mid-section, and Cross-Cutting + Facts sections in the current session
- Knowledge-base status at task start: `doc_count: 8`, `chunk_count: 17030`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db` — verified via `sdlc-knowledge status --json` in the current session

### External contracts

- **`pdfium-render` crate v0.9** — symbol: `pdfium_render::Pdfium::bind_to_system_library()`, `pdfium_render::Pdfium::load_pdf_from_byte_slice`, `PdfDocument::pages().iter()`, page-text accessor — license: MIT OR Apache-2.0 — repo: `ajrcarey/pdfium-render` — source: PRD §12 `## Facts → ### External contracts` entry at PRD line 2948 (verified there via crates.io API in the PRD's authoring session); inherited verbatim into this use-case file — verified: yes (PRD-cite chain). Risk: pre-1.0 SemVer; minor-version pin in Cargo.toml mitigates per FR-2.1.
- **`pdf-extract` crate v0.7** — symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>` — source: PRD §12 `## Facts` block at PRD line 2949 (verified there via the existing iter-1 source `tools/sdlc-knowledge/src/pdf.rs:26` and `Cargo.toml:16`); inherited into this use-case file as the iter-1 baseline being replaced — verified: yes (PRD-cite chain).
- **`bblanchon/pdfium-binaries` GitHub project** — symbol: GitHub Releases assets `pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz`; tag scheme `chromium/<int>` — license: MIT — source: PRD §12 `## Facts` block at PRD line 2950 — verified: **no — assumption** (inherited from PRD where it was already labeled `verified: no — assumption`). Risk: asset filename or tag scheme could differ from the architect's recollection; verification path is Slice 3 (install.sh integration) opens the actual GitHub Releases page and pins the exact asset URLs and tag value.
- **PDFium upstream (Google)** — symbol: PDFium engine; production renderer in Chromium — license: BSD-3 — source: PRD §12 `## Facts` block at PRD line 2951 — verified: **no — assumption** (inherited from PRD). Risk: license claim is widely-cited industry fact but not reverified this session against PDFium's `LICENSE` file; verification path is code-reviewer pass at the merge-ready gate.
- **`pdfium-render` library-path resolver** — symbol: `Pdfium::bind_to_system_library`, `Pdfium::bind_to_library` (path-explicit variant), platform-specific search behavior on `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` / system library paths — source: PRD §12 `## Facts` block at PRD line 2952 — verified: **no — assumption** (inherited from PRD; the resolver mechanism the iter-2 install.sh integrates with is RESOLVED at architect Step 3 per Open Question #1 below). Risk: the chosen mechanism could differ from this use-case file's flow descriptions; verification path is architect Step 3 + Slice 1 done-condition (working PDF round-trip on dev laptop).
- **GitHub Actions runner labels** — symbol: `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` — source: §11 FR-11.1 (BYTE-UNCHANGED in iter-2 per FR-7.3 at PRD line 2802) — verified: yes (inherited from §11 which shipped the workflow file).
- **SQLite `BEGIN IMMEDIATE` transaction semantics** — symbol: `BEGIN IMMEDIATE … COMMIT` — source: §11 FR-4 / store.rs (inherited unchanged in iter-2; `delete_by_id` per FR-4.4 uses the same transaction shape as the existing `delete_by_path`) — verified: yes (PRD-cite chain).
- **SQLite FTS5 trigger cascade for `chunks_fts`** — symbol: the FTS5 trigger that propagates `DELETE FROM chunks` to `chunks_fts` — source: §11 FR-4.2 (BYTE-UNCHANGED in iter-2 per FR-9.7 at PRD line 2824) — verified: yes (PRD-cite chain).
- **`clap` crate v4.x argument parsing — exit code 2 on parse errors, derive macro `#[command(...)]`, mutually-exclusive flag groups** — source: §11 `## Facts → ### External contracts` (inherited; iter-2 adds the `--by-id <int>` flag and the mutual-exclusion group per FR-4.1) — verified: **no — assumption** (inherited from §11 where it was already `verified: no — assumption`). Risk: minor wording drift between 4.x patch versions; verification path is `cargo build` at Slice 4 (CLI surface).
- **knowledge-base CLI for §12 use-case authoring** — symbol: `sdlc-knowledge status --json`, `sdlc-knowledge search "<query>" --top-k 5 --json` — source: live invocation in this session per the knowledge-base mandate at `~/.claude/rules/knowledge-base-tool.md` — verified: yes (status returned 8 docs / 17030 chunks; four searches on `"pdfium PDF extraction Rust"`, `"calibre ebook conversion CID font"`, `"Rust dynamic library load shared object"`, `"PDF text reader extraction"` each returned `[]` — zero hits across all queries; corpus is ML/AI domain with no PDF-internals or document-conversion literature).

### Assumptions

- **The architect Step 3 will RESOLVE Open Question #1 (exact `pdfium-render` library-path API: `bind_to_system_library` vs `bind_to_library(path)` vs feature-gated `bind_to_statically_linked_library`) before Slice 1 ships.** The use-case flows above default to `bind_to_system_library` per FR-1.2 default; if the architect picks the explicit-path API, UC-1 step 4, UC-9 step 4, and UC-8-EC1 are tightened accordingly. Risk: the UC flow descriptions and the implementation could diverge if the resolution lands later; how to verify: planner reads this Open Question and gates Slice 1 on architect resolution.
- **The dylib version-marker file used by `install.sh --yes` for idempotency (FR-3.7) is implementation-time decision (e.g., `~/.claude/tools/sdlc-knowledge/pdfium/VERSION` containing the literal `chromium/<int>` value).** Risk: if no version-marker is present, every re-run would re-download (not idempotent per FR-3.7); how to verify: Slice 3 done-condition asserts re-run is no-op via timing or file-mtime check.
- **The race-condition resolution for UC-11-EC1 (concurrent delete of an id between query and DELETE) is decided at architect Step 3.** The two acceptable resolutions (treat-as-success vs `error: no document with id <int>`) are equally valid; FR-4.2's wording does not mandate one. Risk: behavior divergence between iter-2 and any iter-3 follow-on; how to verify: architect picks one; the unit test in Slice 4 enforces it.
- **The iter-1 baseline chunk count for `tools/sdlc-knowledge/tests/fixtures/sample.pdf` is recorded somewhere reachable by the iter-2 regression test (e.g., a sibling `.iter1-baseline.txt` file or a constant in the test source).** Risk: if no baseline exists, the R-5 ≥ 50% floor cannot be tested mechanically; how to verify: planner Slice 2 done-condition asserts the baseline is recorded with provenance.
- **The `documents.ingested_at` column update behavior on idempotent no-op re-ingest (UC-13 primary step 6 and `## Facts` of §11 UC-9) is INHERITED unchanged from iter-1 — iter-2 does NOT alter this behavior.** Risk: if the iter-1 implementation was non-deterministic on `ingested_at`, iter-2 inherits the non-determinism; how to verify: architect Step 3 confirms by reading `tools/sdlc-knowledge/src/store.rs` from iter-1 main.
- **The literal byte string of the install.sh warning per FR-3.5 (`pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected`) is byte-stable across iter-2 — the slice implementer copies the FR-3.5 wording verbatim into the script.** Risk: drift between FR-3.5 wording and shipped script wording; how to verify: code-reviewer pass at the merge-ready gate greps for the literal string in `install.sh`.
- **The PDFium download in install.sh uses `curl -fsSL --retry 3 ...` (or equivalent `wget`) with retry-on-network-error built-in, matching the iter-1 binary download style.** Risk: if no retries are added, transient network errors would falsely trigger UC-4-E1 graceful-degradation; how to verify: planner Slice 3 done-condition includes retry behavior; security-auditor reviews download flags.
- **Re-running `install.sh --yes` after the maintainer bumps the pinned `chromium/<version>` (UC-4-A2) re-downloads the dylib AND replaces the old one in-place (no manual `rm -rf` required).** Risk: if the upgrade path requires a manual step, the FR-3.7 idempotency claim weakens; how to verify: Slice 3 done-condition includes a mid-flight version-bump regression test.
- **The vendored `calibre-sample.pdf` fixture per FR-6.1 will be sourced from Project Gutenberg (or equivalent public-domain text source) per FR-6.3.** Risk: license incompatibility if the fixture inadvertently includes copyrighted material; how to verify: FR-6.3 documents provenance in the sibling README; code-reviewer reviews provenance at merge-ready.
- **iter-2 chunks/MB ≥ 50 floor (NFR-4) is achievable on the specific calibre fixture vendored per FR-6.1.** Risk: the empirical baseline (~2 chunks/MB on iter-1 calibre PDFs, ~2500 chunks/MB on pypdf-as-Markdown reference per 12.1) was measured on a 9-book ML/AI corpus; the 50-floor may not generalize; how to verify: AC-2 exercises the floor on the vendored fixture during the iter-2 integration test.
- **The list of pre-existing use-case files in `docs/use-cases/` was enumerated via `ls` in the current session — no existing file covers the pdfium-pdf-extraction domain, confirming this is a CREATE (not UPDATE).** Risk: a future overlap could emerge if a separate "robust ingestion" feature lands; how to verify: any future feature touching PDF extraction reads this file first per the user-task convention.
- **The `<source-filename>` component of the FR-9.2 citation literal continues to refer to the basename or relative-to-`sources/` path (NOT the full canonicalized absolute path) per the §11 assumption inherited unchanged.** Risk: ambiguity if two source files share a basename; how to verify: BYTE-UNCHANGED claim per FR-9.2 means iter-2 does not alter this convention; iter-3 may choose to disambiguate.

### Open questions

- **Knowledge-base searches on `"pdfium PDF extraction Rust"`, `"calibre ebook conversion CID font"`, `"Rust dynamic library load shared object"`, and `"PDF text reader extraction"` each returned `[]` (zero hits) in the current session.** Per the `~/.claude/rules/knowledge-base-tool.md` mandate this is a documented negative result, not a silent skip. Action: consider adding a PDFium / PDF-internals reference (the PDF 1.7 specification, the PDFium developer wiki, or a "Practical Rust FFI" reference) to the `<project>/.claude/knowledge/sources/` corpus if iter-3 work continues to depend on PDF-format reasoning. No action required for iter-2 — the source-of-truth for iter-2 contracts is `pdfium-render`'s own docs and `bblanchon/pdfium-binaries`'s GitHub Releases page, both of which are external-contracts items above. The corpus is ML/AI domain (8 docs / 17030 chunks) and has no PDF-format or document-conversion literature.
- **Open Question #1 — Exact `pdfium-render` library-path API.** `bind_to_system_library()` vs `bind_to_library(path: &Path)` vs feature-gated `bind_to_statically_linked_library`. RESOLUTION: architect Step 3 picks ONE with cited rationale before Slice 1 ships. The use-case flows above default to `bind_to_system_library` per FR-1.2 default; if the architect picks the explicit-path API, UC-1 step 4, UC-8-EC1, UC-9 step 4 are tightened accordingly during planning. RESOLUTION needed by: planner Slice 1 done-condition.
- **Open Question #2 — UC-11-EC1 race-condition resolution.** Should `delete --by-id <int>` treat 0-affected-rows after a passing existence check (because a concurrent invocation deleted the row mid-flight) as (a) idempotent success or (b) `error: no document with id <int>`? RESOLUTION: architect Step 3 picks one; the unit test in Slice 4 enforces it.
- **Open Question #3 — UC-13-A1 mtime-only-changed identity check.** Does iter-2 inherit iter-1's tuple-based `(source_path, mtime, sha256)` identity (which treats mtime drift as a re-extract trigger) or is sha256 the dominant identity? RESOLUTION: §11 FR-2.5 wording is "tuple-based"; iter-2 inherits unchanged per FR-9.7. Confirmed but listed as an open-question-needing-confirmation because the §11 use-case file documented it as an assumption.
- **Open Question #4 — Whether `documents.ingested_at` is updated on idempotent no-op re-ingest** — INHERITED unchanged from §11 UC-9 assumption; resolution is at architect Step 3 reading `tools/sdlc-knowledge/src/store.rs` from iter-1 main and confirming. Not load-bearing for iter-2.
- **Open Question #5 — The vendored `calibre-sample.pdf` content choice (Project Gutenberg excerpt? specific book? specific calibre version?).** RESOLUTION: planner picks during Slice 6 (test fixture authoring); FR-6.3 documents the choice. NOT load-bearing for the use-case file; load-bearing for the test asset.
- **Open Question #6 — sha256 verification of the PDFium download.** RESOLVED — DEFERRED to iter-3 per PRD §12.7 item 1 (mirrors §11 iter-1's sdlc-knowledge binary sha256 deferral). NOT a blocker for iter-2.
- **Open Question #7 — Windows binary support.** RESOLVED — OUT OF SCOPE per PRD §12.7 item 3 (consistent with §11 NFR-1.4). NOT a blocker for iter-2.
- **Open Question #8 — Coupling Gate 9 release-engineer to the PDFium binary version bump.** RESOLVED — OUT OF SCOPE per PRD §12.7 item 6 (consistent with §11 FR-12.4). The maintainer continues to cut `sdlc-knowledge-v<X.Y.Z>` tags manually per `tools/sdlc-knowledge/RELEASING.md`.
