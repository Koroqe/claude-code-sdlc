# Use Cases: Vector + Multimodal Retrieval Backend

> Based on [PRD](../PRD.md) — Section 15: Vector + Multimodal Retrieval Backend

This document is the blueprint for E2E testing of the hybrid lexical + dense retrieval backend introduced in PRD §15. The feature replaces the BM25-only FTS5 retrieval pipeline with: (1) a heading-aware structural chunker, (2) schema v2 with a `chunks_vec` virtual table and image BLOB column, (3) Docling-based PDF parsing with pdfium fallback, (4) image extraction and BLOB storage, (5) `intfloat/multilingual-e5-small` embedding via `fastembed-rs`, (6) PaddleOCR OCR bridge for image chunks, (7) three-mode hybrid search with RRF k=60, (8) a benchmark harness, and (9) updated install scripts and rule files.

Every use case below is precise enough for an E2E test to be derived without re-consulting the PRD. Scenario IDs (`UC-VR-N`, `UC-VR-N-AN`, `UC-VR-N-EN`, `UC-VR-EC-N`, `UC-VR-CC-N`) are referenced by QA test cases and E2E tests.

**Common preconditions across all use cases** (stated once here, referenced as "common preconditions" below):

- The `claudeknows` binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is built from the feature branch `feat/vector-retrieval-backend`
- `bash install.sh --yes` has been run and completed successfully on this session's machine
- Unless stated otherwise, the schema is v2 (`schema_version: 2` in `claudeknows status --json`)
- Unless stated otherwise, model files are present: `~/.claude/tools/sdlc-knowledge/models/e5-small/`, `~/.claude/tools/sdlc-knowledge/models/paddleocr/`, and `~/.claude/tools/sdlc-knowledge/models/docling/`
- The project root for all `--project-root` invocations is `/Users/aleksandra/Documents/claude-code-sdlc` unless otherwise noted

---

## Actors

| Actor | Description |
|-------|-------------|
| Developer | The human user who runs `claudeknows` subcommands from a shell |
| `claudeknows` binary | The compiled Rust binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (also invokable as `claudeknows` via the PATH alias) |
| SDLC pipeline | Automated CI or agent-orchestration contexts that invoke `claudeknows` headlessly (stdin is not a TTY; `CLAUDEKNOWS_AUTO_REINGEST=1` may be set) |
| `install.sh` / `install.ps1` | The install scripts that download model bundles and register the `claudeknows` alias |

---

## Use Case Coverage

| UC ID | Scenario | PRD FRs | PRD ACs |
|-------|----------|---------|---------|
| UC-VR-1 | First-time ingest of a books directory — full v2 pipeline | FR-VR-1.1, FR-VR-1.2, FR-VR-2.1–2.4, FR-VR-3.1–3.3, FR-VR-4.1–4.3, FR-VR-5.1–5.3 | AC-VR-1, AC-VR-11, AC-VR-15, AC-VR-16, AC-VR-17 |
| UC-VR-1-A1 | Docling parse failure — pdfium fallback engages | FR-VR-1.1, FR-VR-1.3 | AC-VR-11 |
| UC-VR-1-E1 | e5-small ONNX model absent — degraded mode, BM25-only | FR-VR-4.4 | AC-VR-14 |
| UC-VR-1-E2 | PaddleOCR models absent — image chunks get placeholder text | FR-VR-5.5 | AC-VR-14 |
| UC-VR-1-E3 | Corrupt v1 DB opened with v2 binary — exit 1, no migration | FR-VR-3.5 | AC-VR-12 |
| UC-VR-1-E4 | sqlite-vec extension load fails — exit 1, clear error | FR-VR-3.1 | (none — gap; implementation must exit 1 with clear message) |
| UC-VR-2 | Hybrid search with default and explicit `--mode hybrid` | FR-VR-6.1–6.5, FR-VR-6.7 | AC-VR-4, AC-VR-5, AC-VR-6 |
| UC-VR-2-A1 | Explicit `--mode lexical` — backward-compatible BM25-only path | FR-VR-6.3, NFR-VR-8 | AC-VR-2 |
| UC-VR-3 | Russian query against English corpus — dense path matches | FR-VR-6.1, FR-VR-6.2 | AC-VR-4 |
| UC-VR-4 | Search finds content inside a figure (image chunk) | FR-VR-5.3, FR-VR-6.1 | AC-VR-7 |
| UC-VR-5 | v1 index opened with v2 binary — migration UX (TTY and headless) | FR-VR-3.4 | AC-VR-12, AC-VR-13 |
| UC-VR-6 | Benchmark harness run — produces Markdown report with metrics | FR-VR-7.1–7.5 | AC-VR-8 |
| UC-VR-7 | Fresh install + single-PDF ingest — full end-to-end success | FR-VR-1.1, FR-VR-4.1, FR-VR-5.1, FR-VR-8.1–8.2 | AC-VR-1, AC-VR-17 |
| UC-VR-7-A1 | install.sh runs but model download endpoints unreachable | FR-VR-8.1, FR-VR-4.4, FR-VR-5.5 | AC-VR-14 |
| UC-VR-EC-1 | PDF with 100+ figures — ingest completes within budget | NFR-VR-3 | AC-VR-15 |
| UC-VR-EC-2 | PDF in Chinese with no multilingual PaddleOCR model | FR-VR-5.2, FR-VR-5.3 | AC-VR-7 |
| UC-VR-EC-3 | Mixed RU+EN query — dense path handles both languages | FR-VR-6.1, FR-VR-6.2 | AC-VR-4 |
| UC-VR-EC-4 | Search with `--top-k 1000` — no panic, latency documented | NFR-VR-2 | (none — NFR) |
| UC-VR-EC-5 | Full 40-PDF corpus ingest — wall-clock time documented | NFR-VR-3 | AC-VR-17 |
| UC-VR-CC-1 | `claudeknows --version` after feature lands | (none — version bump via /release) | (none) |
| UC-VR-CC-2 | `claudeknows status --json` on fresh install, no ingest | FR-VR-3.3 | AC-VR-1 |
| UC-VR-CC-3 | v0.3.1 user upgrades via install.sh, opens existing index | FR-VR-3.4 | AC-VR-12, AC-VR-13 |

---

## UC-VR-1: First-Time Ingest of a Books Directory — Full v2 Pipeline

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- `~/.claude/knowledge/index.db` does NOT exist (first-time ingest for this project)
- The books directory at `/Users/aleksandra/Documents/claude-code-sdlc/books/` contains at least one PDF with embedded text and at least one PDF with a figure

**Trigger**: Developer runs `claudeknows ingest /Users/aleksandra/Documents/claude-code-sdlc/books/`

### Primary Flow (Happy Path)

1. `claudeknows ingest` resolves the project root and the target directory path
2. For each PDF file in the directory, the ingest pipeline attempts Docling as the primary PDF backend (FR-VR-1.1): Docling extracts structured Markdown and a figure list from the PDF
3. The Docling Markdown output is fed to `chunker::structural_chunk()` (FR-VR-2.1): the chunker detects `^#{1,6}\s+` heading patterns and "Chapter/Section N" markers; it chunks on heading boundaries with a soft cap of 1 500 characters and 200-character overlap, preserving the section hierarchy in chunk metadata
4. For Markdown input without detectable headings, the chunker falls back to the 500-character sliding-window (FR-VR-2.2)
5. Text chunks are written to the `chunks` table with `type = 'text'` (FR-VR-3.2)
6. Figure PNG bytes from Docling's figure list are written to the `chunks` table with `type = 'image'` and the PNG bytes stored in `image_bytes BLOB` (FR-VR-3.2)
7. The e5-small `Encoder` singleton is initialized (cold-start completes in under 3 seconds on the 2024 MacBook M1 reference machine — FR-VR-4.5)
8. Text and table chunks are encoded in batches of 32 via `encode_passages()`, which prepends `"passage: "` to each input (FR-VR-4.2); 384-dimensional float vectors are written to `chunks_vec`
9. For each `type = 'image'` chunk, PaddleOCR det+rec runs on the `image_bytes` BLOB and produces the OCR'd text (FR-VR-5.1); the OCR text is set as `chunk.text`
10. If OCR returns empty output (non-textual diagram), `chunk.text` is set to `[image: figure N from <doc-basename>]` (FR-VR-5.2)
11. Image chunk text (OCR'd or placeholder) is encoded via `encode_passages()` and written to `chunks_vec` (FR-VR-5.3)
12. After all files are processed, `claudeknows status --json` reports `schema_version: 2`, non-zero `doc_count` and `chunk_count`, and `embedding_count` equal to `chunk_count`
13. The row count in `chunks_vec` equals the row count in `chunks` (FR-VR-4.3, AC-VR-17)

**Postconditions**:
- `~/.claude/knowledge/index.db` exists with schema v2 (FR-VR-3.1, FR-VR-3.3)
- `chunks` table contains rows with `type IN ('text', 'table', 'image')` (FR-VR-3.2)
- All `type = 'image'` rows have non-NULL `image_bytes` BLOB (FR-VR-3.2, AC-VR-15)
- `chunks_vec` row count equals `chunks` row count (AC-VR-17)
- e5 prefix discipline: every passage submitted to the encoder started with `"passage: "` (AC-VR-16)
- `claudeknows status --json` returns `"schema_version": 2` (AC-VR-1)

### Alternative Flows

- **UC-VR-1-A1: Docling parse failure — pdfium fallback engages** — Applies when a specific PDF is corrupt, has an encrypted structure Docling cannot handle, or Docling models are absent (FR-VR-1.1, FR-VR-1.3)
  1. Steps 1–2 of the primary flow proceed; Docling returns an error for a specific PDF (or models are absent)
  2. The ingest pipeline logs a warning identifying the PDF and the Docling error
  3. The pdfium backend is invoked as fallback; pdfium extracts plain text from the PDF (FR-VR-1.1 fallback, FR-VR-1.3)
  4. The pdfium plain-text output is fed to `chunker::structural_chunk()` (FR-VR-1.2 fallback path)
  5. The pipeline continues with steps 5–13 of the primary flow, treating the pdfium-derived chunks as text chunks
  6. No figure PNG bytes are produced for this PDF (pdfium does not extract figures); the PDF contributes only text chunks to `chunks_vec`
  7. Ingest completes without hard failure; the warning is visible in stderr

  **Postconditions**: Ingest completes; the affected PDF is represented by text chunks only; pdfium fallback is logged; no hard error exit code

  **Mapped FR**: FR-VR-1.1, FR-VR-1.3

### Error Flows

- **UC-VR-1-E1: e5-small ONNX model absent — degraded mode, BM25-only** — Applies when `~/.claude/tools/sdlc-knowledge/models/e5-small/` is absent or the ONNX model file cannot be loaded (FR-VR-4.4)
  1. `claudeknows ingest` starts; the `Encoder::new()` call returns `Err` because the model file is missing
  2. Ingest catches the error and continues in degraded mode: text chunks are written to `chunks` and to the FTS5 index, but NO rows are written to `chunks_vec`
  3. Ingest completes with exit code 0 but logs a warning identifying the model path and the degraded mode
  4. `claudeknows status --json` reports `"degraded": "encoder model missing"` (FR-VR-4.4)
  5. Dense and hybrid search modes are unavailable; lexical mode still works (NFR-VR-8)

  **Postconditions**: `chunks` table is populated; `chunks_vec` is empty; status reports degraded mode; exit code 0 (degraded, not failed)

  **Mapped FR**: FR-VR-4.4; **AC**: AC-VR-14

- **UC-VR-1-E2: PaddleOCR models absent — image chunks get placeholder text** — Applies when `~/.claude/tools/sdlc-knowledge/models/paddleocr/` is absent or OCR model files cannot be loaded (FR-VR-5.5)
  1. Ingest reaches step 9 of the primary flow for a `type = 'image'` chunk
  2. The OCR model load fails; a warning is logged identifying the missing model files
  3. All `type = 'image'` chunks receive placeholder text `[image: figure N from <doc-basename>]` (FR-VR-5.2)
  4. The placeholder text is encoded via the e5 encoder (assuming the encoder IS present) and written to `chunks_vec`
  5. Ingest continues without hard failure; all non-image chunks proceed normally
  6. Image chunks remain searchable via their placeholder text embeddings

  **Postconditions**: `chunks_vec` is populated for all chunk types; image chunks have placeholder text; no hard error exit code; OCR warning visible in stderr

  **Mapped FR**: FR-VR-5.5; **AC**: none directly — but satisfies the "no hard failure" requirement

- **UC-VR-1-E3: Corrupt v1 DB opened with v2 binary — exit 1, no migration** — Applies when `index.db` is truncated, has corrupted SQLite pages, or fails to open (FR-VR-3.5, AC-7 contract from iter-1)
  1. The v2 binary attempts to open `index.db`; SQLite reports an error (database disk image is malformed, or the file is too short to be a valid SQLite file)
  2. The binary classifies this as a corrupt database, NOT a v1 schema database requiring migration
  3. The binary exits with code 1 and emits the exact literal message: `error: index database invalid; re-ingest required` (FR-VR-3.5)
  4. No migration is attempted; no schema changes are made to the corrupt file

  **Postconditions**: Process exits 1; the literal error string is present in stdout or stderr; `index.db` is unchanged; the Developer must delete `index.db` and re-run `ingest`

  **Mapped FR**: FR-VR-3.5; **AC**: AC-VR-12

- **UC-VR-1-E4: sqlite-vec extension load fails — exit 1, clear error** — Applies on a non-standard Linux distribution where the system shared libraries required by the sqlite-vec extension are absent (FR-VR-3.1)
  1. The v2 binary attempts to load the sqlite-vec extension at connection-open time
  2. The extension load fails (missing system shared library, incompatible ABI, or the extension binary itself is absent from the install)
  3. The binary exits with code 1 and emits a message matching: `error: failed to load sqlite-vec extension; re-install via bash install.sh`
  4. No partial schema migration is performed; no `chunks_vec` virtual table is created

  **Postconditions**: Process exits 1; no schema changes; the Developer is directed to re-run `bash install.sh --yes` to obtain the required shared libraries

  **Mapped FR**: FR-VR-3.1 (implicit — sqlite-vec must be linked at connection-open time; failure must not produce a half-migrated DB)

### Edge Cases

- **UC-VR-1-EC1**: Input directory contains a plaintext `.md` file with no headings — `structural_chunk()` falls back to 500-char sliding-window output; the chunk count and content match the iter-1 baseline for that document (FR-VR-2.2, AC-VR-11)
- **UC-VR-1-EC2**: Input directory contains a plaintext `.md` file with exactly three `##` headings — `structural_chunk()` produces exactly three chunks, each starting with the heading line (FR-VR-2.4, AC-VR-11)

### Data Requirements

- **Input**: Directory path containing PDFs and Markdown files
- **Output**: Populated `~/.claude/knowledge/index.db` with schema v2; `chunks` and `chunks_vec` tables populated
- **Side Effects**: `index.db` created or overwritten; model files read from `~/.claude/tools/sdlc-knowledge/models/`; wall-clock time documented in scratchpad (Slice 8 operational step)

---

## UC-VR-2: Hybrid Search with Default and Explicit `--mode hybrid`

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- `index.db` exists with v2 schema and at least 100 chunks ingested, with `chunks_vec` populated (embeddings present)
- The encoder model is present and loaded

**Trigger**: Developer runs `claudeknows search "authentication architecture" --json` (no `--mode` flag) or `claudeknows search "authentication architecture" --mode hybrid --json`

### Primary Flow (Happy Path)

1. The CLI parses `--mode hybrid` (or defaults to `hybrid` when `--mode` is absent — FR-VR-6.3)
2. The query string `"authentication architecture"` is encoded via `encode_query()`, which prepends `"query: "` and produces a 384-dimensional float vector (FR-VR-4.2)
3. Parallel execution:
   a. BM25 top-(K×4) results are retrieved from the FTS5 index using the lexical tokenizer
   b. Dense top-(K×4) results are retrieved from `chunks_vec` using the sqlite-vec K-NN distance function (FR-VR-6.1)
4. The two result sets are merged via Reciprocal Rank Fusion with k=60: `score(d) = Σ_i 1/(60 + rank_i(d))` summed across both rankers (FR-VR-6.2)
5. The top-K fused results are returned as JSON, with each result containing: `text`, `source`, `type`, `mode_used: "hybrid"`, `bm25_score`, `dense_score`, `rrf_score` (FR-VR-6.4)
6. All K results have `mode_used = "hybrid"` (AC-VR-4, AC-VR-5)
7. The p95 latency over a fixed sequence of 30 hybrid queries against the 51 K-chunk corpus is below 500 ms on the 2024 MacBook M1 reference machine (FR-VR-6.7, NFR-VR-2)

**Postconditions**:
- JSON output is valid and contains at least 1 result (assuming matching chunks exist)
- Every result has `mode_used = "hybrid"` (AC-VR-4, AC-VR-5)
- Every result has non-null `bm25_score`, `dense_score`, and `rrf_score` fields (FR-VR-6.4)
- The first result's `rrf_score` is greater than or equal to the last result's `rrf_score` (results are sorted descending by RRF score)

### Alternative Flows

- **UC-VR-2-A1: Explicit `--mode lexical` — backward-compatible BM25-only path** — Applies when the Developer explicitly requests lexical-only search (FR-VR-6.3, NFR-VR-8)
  1. The CLI parses `--mode lexical`
  2. Only the FTS5 BM25 index is queried; the encoder is NOT invoked; `chunks_vec` is NOT queried
  3. Results are returned with `mode_used: "lexical"`, `bm25_score` populated, `dense_score: null`, `rrf_score: null` (or omitted)
  4. The behavior is identical to the iter-1 (v0.3.x) search path (NFR-VR-8)
  5. This mode works even when all model files are absent (AC-VR-14)

  **Postconditions**: Results returned with `mode_used = "lexical"`; no encoder invoked; no dependency on `chunks_vec`

  **Mapped FR**: FR-VR-6.3, NFR-VR-8; **AC**: AC-VR-2

### Error Flows

- **UC-VR-2-E1: `--mode dense` requested with encoder absent** — FR-VR-6.6
  1. The CLI parses `--mode dense`
  2. The encoder model is absent; `encode_query()` returns `Err`
  3. The CLI exits with code 1 and emits the message `encoder model missing`
  4. No results are returned

  **Postconditions**: Exit code 1; literal `encoder model missing` in stderr; **AC**: AC-VR-14

- **UC-VR-2-E2: `--mode hybrid` requested with encoder absent** — FR-VR-6.6
  1. The CLI parses `--mode hybrid`
  2. The encoder model is absent
  3. The CLI falls back to lexical mode and prints a warning to stderr: the warning identifies that hybrid mode is unavailable due to missing encoder model and that lexical mode is being used
  4. Results are returned with `mode_used: "lexical"` and a warning in stderr

  **Postconditions**: Exit code 0; results returned in lexical mode with a warning; **AC**: AC-VR-14 (lexical still works)

### Edge Cases

- **UC-VR-2-EC1**: Query string is empty (`""`) — the CLI returns an empty result set or a usage error (exact behavior is an implementation detail; must not panic)
- **UC-VR-2-EC2**: Query produces a zero-vector (pathological edge) — the dense search still completes; results may be semantically meaningless but no panic occurs

### Data Requirements

- **Input**: Query string; optional `--mode` flag; optional `--top-k` flag
- **Output**: JSON array of result objects with `mode_used`, `bm25_score`, `dense_score`, `rrf_score`, `text`, `source`, `type`
- **Side Effects**: Read-only; no mutations to `index.db`

---

## UC-VR-3: Russian Query Against English Corpus — Dense Path Matches Semantically

**Actor**: Developer or SDLC pipeline

**Preconditions**:
- Common preconditions hold
- The ingested corpus contains English-language chunks about a concept that can be semantically matched by a Russian query (e.g., "аутентификация" matches English chunks about "authentication")
- The encoder model is present and `chunks_vec` is populated

**Trigger**: Developer runs `claudeknows search "аутентификация архитектура" --mode hybrid --json`

### Primary Flow (Happy Path)

1. The CLI parses `--mode hybrid` and the Russian query string
2. `encode_query()` tokenizes the Russian query with the `intfloat/multilingual-e5-small` model, which supports both Russian and English natively (verified: model card, see Facts)
3. The dense retrieval path (step 3b of UC-VR-2) queries `chunks_vec`; the multilingual embedding space places the Russian query vector near the corresponding English "authentication" concept vectors
4. The BM25 lexical path (step 3a of UC-VR-2) matches no English chunks (because FTS5 `unicode61` tokenizer is purely lexical — Russian tokens do not match English tokens)
5. RRF merges the two result sets; because BM25 contributes no hits, the hybrid result is dominated by the dense results
6. The top-K results contain English-language chunks about authentication and architecture
7. Each result has `mode_used: "hybrid"`, a non-null `dense_score`, and `bm25_score: 0` (or null) for the English chunks

**Postconditions**:
- At least one result is returned despite the query language (Russian) not matching the chunk language (English)
- The dense path surfaces cross-lingual matches
- `mode_used = "hybrid"` in all results

**Mapped FR**: FR-VR-6.1, FR-VR-6.2; encoder multilingual property — source: `intfloat/multilingual-e5-small` model card (verified: yes per PRD §15 Facts)

### Alternative Flows

- **UC-VR-3-A1: Same Russian query with `--mode lexical`** — The BM25 path finds no English matches; zero results are returned (this is the expected iter-1 limitation that the dense path is designed to overcome)
  1. BM25 queries FTS5 with the Russian tokenized terms
  2. No English chunks match the Russian tokens
  3. Empty result set returned with `mode_used: "lexical"`

  **Postconditions**: Empty result set for lexical mode; this confirms the regression being fixed

  **Mapped FR**: NFR-VR-8 (lexical backward-compat — still works, just returns no cross-lingual results)

### Error Flows

(none beyond what is covered in UC-VR-2 error flows)

### Edge Cases

- **UC-VR-3-EC1**: Query contains both Russian and English tokens ("RAG архитектура") — the encoder handles mixed-language input; the dense path surfaces chunks in either language; BM25 matches only the English "RAG" token in English chunks (UC-VR-EC-3 covers this in detail)

### Data Requirements

- **Input**: Russian-language query string; hybrid mode
- **Output**: JSON results including English-language chunks matched semantically
- **Side Effects**: Read-only

---

## UC-VR-4: Search Finds Content Inside a Figure (Image Chunk)

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- At least one PDF in the ingested corpus contained a figure with extractable text (e.g., a diagram labeled "Authentication Service")
- OCR ran successfully on that figure during ingest and set `chunk.text` to the OCR'd text
- The image chunk's text was encoded and written to `chunks_vec`

**Trigger**: Developer runs `claudeknows search "auth service architecture" --mode dense --json`

### Primary Flow (Happy Path)

1. The CLI parses `--mode dense`
2. `encode_query()` encodes `"query: auth service architecture"` into a 384-dimensional vector
3. sqlite-vec K-NN query over `chunks_vec` returns the top-K results sorted by cosine similarity
4. Among the results is the image chunk whose OCR'd text included "Authentication Service" — its stored vector's cosine similarity with the query vector is above 0.5 (FR-VR-5.4)
5. The result is returned as JSON with `type: "image"`, `text: "<OCR'd content>"`, `source: "<doc-basename>"`, `mode_used: "dense"`, and non-null `dense_score`

**Postconditions**:
- At least one result with `type = "image"` is present in the result set
- The image chunk's `dense_score` is above 0.5 (FR-VR-5.4)
- `claudeknows search "figure diagram" --mode dense --json | jq '[.[] | select(.type=="image")] | length'` returns a value greater than 0 (AC-VR-7)

**Mapped FR**: FR-VR-5.3, FR-VR-5.4, FR-VR-6.1; **AC**: AC-VR-7

### Alternative Flows

- **UC-VR-4-A1: Image chunk has placeholder text (OCR returned empty)** — The image chunk's text is `[image: figure N from <doc-basename>]`; this placeholder is still encoded and stored in `chunks_vec`; the chunk may surface in dense search results but its similarity score to content-specific queries will be low; for generic "figure" queries it may surface

### Error Flows

(none specific — search path errors covered in UC-VR-2 error flows)

### Edge Cases

- **UC-VR-4-EC1**: The corpus has no `type = 'image'` chunks (all PDFs were text-only or Docling was in fallback mode) — `select(.type=="image") | length` returns 0; this is not an error but indicates the corpus has no searchable figure content

### Data Requirements

- **Input**: Query string; `--mode dense` flag
- **Output**: JSON results including `type = "image"` chunks when relevant figures exist
- **Side Effects**: Read-only

---

## UC-VR-5: v1 Index Opened with v2 Binary — Migration UX (TTY and Headless)

**Actor**: Developer (TTY) or SDLC pipeline (headless)

**Preconditions**:
- The v2 binary is installed
- `~/.claude/knowledge/index.db` exists and has `schema_version = 1` (a valid, non-corrupt v1 database)
- For the TTY sub-flow: stdin is a TTY (interactive terminal)
- For the headless sub-flow: `CLAUDEKNOWS_AUTO_REINGEST=1` is set in the environment, OR stdin is not a TTY

**Trigger**: Developer (or SDLC pipeline) runs any `claudeknows` command that opens the database (e.g., `claudeknows status --json`, `claudeknows search "..."`, `claudeknows list --json`)

### Primary Flow (TTY — User Approves)

1. The v2 binary opens `index.db` and reads `schema_version`; it detects `schema_version = 1` (FR-VR-3.4)
2. A version mismatch is detected; the binary pauses and prints to stdout (TTY): `Re-ingest required for v2 schema. Proceed? [y/N]`
3. The Developer types `y` and presses Enter
4. The binary drops the existing `chunks`, `chunks_fts`, and any other v1 tables; recreates them with v2 schema including `chunks.type`, `chunks.image_bytes`, and the `chunks_vec` virtual table (FR-VR-3.4d)
5. The binary exits with code 0 and prints a hint message: `Schema migrated to v2. Re-run 'claudeknows ingest <path>' to populate the new schema.`
6. The Developer re-runs `claudeknows ingest <path>` to populate the v2 schema (covered by UC-VR-1)

**Postconditions**:
- `index.db` has schema v2 (empty — all prior v1 data dropped)
- Process exits 0 with the hint message
- The Developer knows to re-run ingest

### Alternative Flows

- **UC-VR-5-A1: TTY — User Refuses Migration**
  1. Steps 1–2 of the primary flow proceed; the prompt is displayed
  2. The Developer types `n` (or presses Enter without input, which defaults to N per the `[y/N]` convention)
  3. The binary exits with code 0 and prints a hint: `Re-ingest required for v2 schema. To proceed, re-run this command and confirm.` (FR-VR-3.4c)
  4. `index.db` is UNCHANGED — v1 schema is preserved as-is

  **Postconditions**: Exit code 0; `index.db` still has v1 schema; the Developer must explicitly approve to migrate

  **Mapped FR**: FR-VR-3.4c

- **UC-VR-5-A2: Headless — `CLAUDEKNOWS_AUTO_REINGEST=1` set** — Applies when running in CI or agent-orchestration context (FR-VR-3.4b)
  1. The v2 binary opens `index.db` and detects `schema_version = 1`
  2. `CLAUDEKNOWS_AUTO_REINGEST=1` is present in the environment (or stdin is not a TTY); the prompt is SKIPPED
  3. The binary immediately drops v1 tables and recreates v2 schema (same as primary flow steps 4–5)
  4. The binary exits 0 with the same hint message printed to stdout

  **Postconditions**: Exit code 0; v2 schema created; no interactive prompt; the pipeline is expected to follow with an `ingest` command

  **Mapped FR**: FR-VR-3.4b; **AC**: AC-VR-13

### Error Flows

- **UC-VR-5-E1: v1 DB is corrupt (truncated) — NOT treated as migration candidate** — Covered by UC-VR-1-E3; the binary distinguishes between a valid v1 DB (schema_version=1) and a corrupt file; only valid v1 triggers the migration UX; corrupt files trigger the AC-7 exit-1 contract

### Edge Cases

- **UC-VR-5-EC1**: The environment has `CLAUDEKNOWS_AUTO_REINGEST=1` but the database is already schema v2 — no migration prompt, no drop/recreate; the binary opens normally and the command proceeds
- **UC-VR-5-EC2**: The v2 binary opens the database for `claudeknows list --json`; the migration prompt fires before the list results — after approval and schema recreation, the list returns empty (no documents ingested yet); the user must re-ingest

### Data Requirements

- **Input**: `index.db` with v1 schema; TTY or headless context
- **Output**: (TTY) Migration prompt on stdout; (headless) silent migration; in both cases: `index.db` recreated as empty v2 schema on acceptance; hint message on stdout
- **Side Effects**: All v1 data in `index.db` is destroyed on acceptance; this is irreversible (v1 data is not backed up by the binary — user is responsible for any needed backup)

---

## UC-VR-6: Benchmark Harness Run — Produces Markdown Report with Metrics

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- The `claudeknows-bench` binary is built: `cargo build --release --bin claudeknows-bench`
- The `index.db` at the project root contains the v2-ingested corpus from Slice 8 (at least 51 K chunks with embeddings)
- The golden query set exists at `tools/sdlc-knowledge/bench/golden/queries.jsonl` with at least 25 queries (FR-VR-7.2)
- All three search modes are operational (lexical, dense, hybrid)

**Trigger**: Developer runs `cargo run --bin claudeknows-bench -- --queries bench/golden/queries.jsonl --modes lexical,dense,hybrid`

### Primary Flow (Happy Path)

1. `claudeknows-bench` reads `--queries bench/golden/queries.jsonl` and parses each JSONL line as a query object with fields: `id`, `query`, `lang` (one of `ru`, `en`, `cross`), `relevant_chunk_ids`, `relevant_docs`, `category` (one of `keyword`, `nl`, `cross`, `paraphrase`) (FR-VR-7.2)
2. For each mode in `--modes` (`lexical`, `dense`, `hybrid`), the harness runs each query against the live `index.db` and records results
3. For each (query, mode) pair, the harness computes:
   - Recall@1, Recall@3, Recall@5, Recall@10
   - Precision@5
   - MRR (1 / rank of first relevant result)
   - NDCG@10
   - Per-document recall (fraction of relevant documents hit)
   - Latency (p50 and p95 across all queries in this mode) (FR-VR-7.3)
4. The harness aggregates metrics per mode and emits a Markdown report containing:
   - Methodology section
   - Dataset description (~40 PDFs, actual chunk count, RU+EN)
   - Query categorization summary (counts per `category` and `lang`)
   - Metric tables per mode (one table per mode, all metrics in columns)
   - Latency table (p50/p95 per mode)
   - Top-10 qualitative side-by-side samples for 5–10 representative queries (showing query + top-3 results per mode)
   - Failure-mode taxonomy (query categories where a mode performed worst)
   - Recommendations (FR-VR-7.4)
5. The report is written to the path specified by `--report` (or the default path `bench/reports/<date>-vector-vs-bm25.md`)

**Postconditions**:
- A Markdown report file exists at the specified path (AC-VR-8)
- The report contains all required sections (methodology, dataset, metric tables, latency, qualitative samples, recommendations)
- Metric tables are non-empty (at least 25 query rows contributed to each metric)
- Per-language metric stratification is NOT present (OQ-4 resolved: out of scope — FR-VR-7.5)

**Mapped FR**: FR-VR-7.1–7.5; **AC**: AC-VR-8

### Alternative Flows

- **UC-VR-6-A1: Single mode run** — Developer passes `--modes lexical` — the harness runs only the lexical mode and produces a report for that mode only; no errors

### Error Flows

- **UC-VR-6-E1: queries.jsonl path does not exist** — The harness exits 1 with an error identifying the missing file path; no partial report is written
- **UC-VR-6-E2: A query in queries.jsonl is malformed (missing required field)** — The harness skips the malformed query with a warning and continues; the report notes the number of skipped queries

### Edge Cases

- **UC-VR-6-EC1**: All 25 queries have `relevant_chunk_ids: []` (empty relevance judgments) — Recall@K, MRR, and NDCG@10 are all 0 for every mode; the harness does not panic; the report indicates zero relevant judgments

### Data Requirements

- **Input**: `queries.jsonl` with at least 25 queries; live `index.db` at v2 schema with embeddings
- **Output**: Markdown report file at `bench/reports/<date>-vector-vs-bm25.md`
- **Side Effects**: Report file written to disk; `index.db` is read-only during benchmark; latency measurements may be sensitive to system load

---

## UC-VR-7: Fresh Install + Single-PDF Ingest — Full End-to-End Success

**Actor**: Developer

**Preconditions**:
- The Developer has a clean machine (no prior `claudeknows` install)
- Internet access is available
- `bash install.sh --yes` has NOT yet been run

**Trigger**: Developer runs `bash install.sh --yes` followed by `claudeknows ingest <single-pdf-path>`

### Primary Flow (Happy Path)

1. Developer runs `bash install.sh --yes` (FR-VR-8.1)
2. `install.sh` downloads and installs the `claudeknows` binary and registers the `claudeknows` alias
3. `install.sh` calls `install_e5_model`: downloads e5-small ONNX to `~/.claude/tools/sdlc-knowledge/models/e5-small/` (FR-VR-8.1)
4. `install.sh` calls `install_paddleocr_models`: downloads PaddleOCR det+rec ONNX models to `~/.claude/tools/sdlc-knowledge/models/paddleocr/` (FR-VR-8.1)
5. `install.sh` calls `install_docling_models`: downloads Docling ONNX models to `~/.claude/tools/sdlc-knowledge/models/docling/` (FR-VR-8.1)
6. Install completes; the following directories exist (FR-VR-8.2):
   - `~/.claude/tools/sdlc-knowledge/models/e5-small/`
   - `~/.claude/tools/sdlc-knowledge/models/paddleocr/`
   - `~/.claude/tools/sdlc-knowledge/models/docling/`
7. Developer runs `claudeknows ingest <single-pdf-path>`
8. The ingest pipeline runs the full UC-VR-1 primary flow for a single PDF
9. `claudeknows status --json` returns: `schema_version: 2`, `doc_count: 1`, `chunk_count: N` (N > 0), `embedding_count: N`
10. `SELECT COUNT(*) FROM chunks` equals `SELECT COUNT(*) FROM chunks_vec` (AC-VR-17)

**Postconditions**:
- All model directories exist (FR-VR-8.2)
- `index.db` exists with v2 schema
- `chunks_vec` row count equals `chunks` row count (AC-VR-17)
- No Python dependencies were required during install or ingest (NFR-VR-5)
- `claudeknows search "<query-from-pdf>" --mode hybrid --json` returns at least one result

**Mapped FR**: FR-VR-1.1, FR-VR-4.1, FR-VR-5.1, FR-VR-8.1–8.2; **AC**: AC-VR-1, AC-VR-17

### Alternative Flows

- **UC-VR-7-A1: install.sh runs but model download endpoints are unreachable** — Applies when Hugging Face, PaddleOCR CDN, or Docling release endpoint is unavailable (FR-VR-4.4, FR-VR-5.5)
  1. `install.sh` starts normally; binary installation succeeds
  2. `install_e5_model` (or one of the other model download functions) fails because the endpoint is unreachable
  3. `install.sh` prints a warning to stderr: `model download failed; ingest will run in degraded mode` (or similar — exact wording is implementation-defined)
  4. `install.sh` continues and completes with exit code 0 (model download failure is non-fatal for the install)
  5. The affected model directory may be absent or empty
  6. Developer runs `claudeknows ingest <single-pdf-path>`
  7. The encoder load fails at ingest time; the ingest falls back to BM25-only degraded mode (UC-VR-1-E1)
  8. `claudeknows status --json` reports `"degraded": "encoder model missing"` (FR-VR-4.4)
  9. Developer re-runs `bash install.sh --yes` when connectivity is restored; the model is downloaded on the retry

  **Postconditions**: Install completed without hard failure; ingest completed in degraded mode; Developer directed to re-run install when connectivity returns

  **Mapped FR**: FR-VR-4.4, FR-VR-5.5, FR-VR-8.1

### Error Flows

(none beyond UC-VR-7-A1 — install failure scenarios are within A1)

### Edge Cases

- **UC-VR-7-EC1**: The single PDF is encrypted and both Docling and pdfium cannot extract text — ingest produces 0 chunks for that document; exit code 0 with a warning; `chunks_vec` is empty

### Data Requirements

- **Input**: Single PDF file path; clean install environment
- **Output**: `~/.claude/knowledge/index.db` with v2 schema; model directories present
- **Side Effects**: ~200 MB downloaded to `~/.claude/tools/sdlc-knowledge/models/`; `index.db` created

---

## UC-VR-EC-1: PDF with 100+ Figures — Ingest Completes Within Budget

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- A PDF with 100 or more figures is available for ingest

**Trigger**: Developer runs `claudeknows ingest <pdf-with-many-figures.pdf>`

### Primary Flow

1. The ingest pipeline processes the PDF via UC-VR-1 primary flow
2. Docling extracts 100+ figure PNG bytes and creates 100+ `type = 'image'` chunk rows in `chunks`
3. The `image_bytes` BLOB column grows significantly; for a 50-page PDF with 20 figures averaging 200 KB each, the BLOB storage adds approximately 4 MB per document
4. OCR runs on each image chunk; placeholder text is used for non-textual figures
5. All image chunks are encoded and written to `chunks_vec`
6. Ingest completes within the NFR-VR-3 budget: the full re-ingest of approximately 40 PDFs completes within 15 minutes on CPU (M1/M2 MacBook)
7. The `index.db` file size growth from BLOB storage is measured and documented

**Postconditions**:
- Ingest completes; no panic or OOM on 100+ figures
- DB file size growth is documented (expected: ~4 MB per 50-page PDF with 20 figures)
- `chunks_vec` row count equals `chunks` row count (AC-VR-17)

**Mapped FR**: NFR-VR-3; reference assumption: image BLOB overhead from plan.md Assumptions section (verified: no — assumption; documented in Facts)

---

## UC-VR-EC-2: PDF in Chinese with No Multilingual PaddleOCR Model

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- A PDF with Chinese-language text in figures is being ingested
- Only the English/Russian PaddleOCR model variant is installed (the multilingual `ml_PP-OCRv4_*` variant is absent)

**Trigger**: Developer runs `claudeknows ingest <chinese-pdf-with-figures.pdf>`

### Primary Flow

1. Ingest processes the PDF via UC-VR-1 primary flow
2. PaddleOCR runs on figure PNG bytes; the English/Russian model cannot recognize Chinese characters; it returns empty output or garbled text
3. Because OCR returns empty (or below-quality threshold), `chunk.text` is set to the placeholder `[image: figure N from <doc-basename>]` (FR-VR-5.2)
4. The placeholder text is encoded via the e5 encoder (e5-small supports Chinese semantics in multilingual mode); the embedding is written to `chunks_vec`
5. The Chinese-text chunks remain discoverable via dense search using Chinese-language queries (the encoder's multilingual coverage compensates for the OCR gap)
6. Ingest completes without hard failure

**Postconditions**:
- Image chunks for the Chinese PDF have placeholder text; ingest does not fail
- Dense search with Chinese-language queries may still surface these chunks (via placeholder embedding)

**Mapped FR**: FR-VR-5.2, FR-VR-5.3

---

## UC-VR-EC-3: Mixed RU+EN Query — Dense Path Handles Both Languages

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- The corpus contains documents in both Russian and English
- `chunks_vec` is populated with embeddings for chunks in both languages

**Trigger**: Developer runs `claudeknows search "RAG архитектура" --mode hybrid --json`

### Primary Flow

1. The CLI parses `--mode hybrid` and the mixed-language query `"RAG архитектура"`
2. `encode_query()` tokenizes both the English "RAG" and Russian "архитектура" tokens using the multilingual e5-small model; the 384-dimensional query vector captures both language semantics
3. Dense K-NN query over `chunks_vec` returns chunks in either language that are semantically close to the query vector
4. BM25 matches chunks containing the exact token "RAG" (English chunks that mention RAG) and potentially Russian chunks containing "RAG" as a loanword
5. RRF merges both result sets; chunks in either language that are relevant to "RAG architecture" surface in the top-K results
6. Results with `mode_used: "hybrid"` are returned

**Postconditions**:
- Results include chunks from both English and Russian documents (if both cover the topic)
- `mode_used = "hybrid"` in all results
- No panic or encoding error from mixed-language input

**Mapped FR**: FR-VR-6.1, FR-VR-6.2

---

## UC-VR-EC-4: Search with `--top-k 1000` — No Panic, Latency Documented

**Actor**: Developer or SDLC pipeline

**Preconditions**:
- Common preconditions hold
- The corpus has at least 1 000 chunks in both `chunks` and `chunks_vec`

**Trigger**: Developer runs `claudeknows search "machine learning" --mode hybrid --top-k 1000 --json`

### Primary Flow

1. The CLI parses `--top-k 1000` and `--mode hybrid`
2. BM25 retrieves top-(1000×4) = 4 000 candidate results from FTS5
3. Dense K-NN retrieves top-(1000×4) = 4 000 candidate results from `chunks_vec`
4. RRF merges 8 000 candidates (with deduplication) and returns the top-1 000 results
5. The operation completes without panic or memory error
6. Latency may exceed 500 ms (the NFR-VR-2 budget applies to `--top-k` at the default value; large K values are expected to be slower); the trade-off is documented

**Postconditions**:
- 1 000 results returned (or fewer if the corpus has fewer than 1 000 matching chunks)
- No panic, OOM, or undefined behavior
- Latency is documented (implementation trade-off note, not an AC)

**Mapped FR**: NFR-VR-2 (applies at default K; large K is a documented trade-off)

---

## UC-VR-EC-5: Full 40-PDF Corpus Ingest — Wall-Clock Time Documented

**Actor**: Developer

**Preconditions**:
- Common preconditions hold
- All 40 PDFs are present at `/Users/aleksandra/Documents/claude-code-sdlc/books/`
- `index.db` does NOT exist (fresh ingest)

**Trigger**: Developer runs `time claudeknows ingest /Users/aleksandra/Documents/claude-code-sdlc/books/`

### Primary Flow

1. The ingest pipeline processes all 40 PDFs via UC-VR-1 primary flow
2. Each PDF goes through Docling parsing (or pdfium fallback), structural chunking, OCR (for figures), encoding, and vector write
3. Encoding batches of 32 chunks run sequentially; the encoder hot-path processes 32 chunks in under 50 ms on the 2024 MacBook M1 reference machine (FR-VR-4.5)
4. Progress is logged to stderr periodically (e.g., per-document or per-N-chunks) so the Developer can observe progress
5. Ingest completes within 15 minutes (NFR-VR-3 budget) on CPU (M1/M2 MacBook)
6. Wall-clock time is recorded in `.claude/scratchpad.md` (Slice 8 operational requirement)
7. `claudeknows status --json` shows `doc_count >= 40`, `chunk_count >= 51542`, `embedding_count = chunk_count`

**Postconditions**:
- All 40 PDFs ingested within budget
- `chunks_vec` row count equals `chunks` row count (AC-VR-17)
- Wall-clock time documented in scratchpad

**Mapped FR**: NFR-VR-3; **AC**: AC-VR-17

---

## UC-VR-CC-1: `claudeknows --version` After Feature Lands

**Actor**: Developer

**Preconditions**:
- The v2 binary is installed but the `/release` command has NOT yet been invoked to bump the version

**Trigger**: Developer runs `claudeknows --version`

### Primary Flow

1. The binary prints the current version string from `Cargo.toml`; the version is `0.3.1` (the version bump to `0.4.0` happens via the user-invoked `/release` command AFTER merge, NOT in any implementation slice — §15.7 Out of Scope item 4)
2. No error; exit code 0

**Postconditions**:
- Version string printed; the string is `0.3.1` during development; `0.4.0` after `/release` is invoked

**Mapped FR**: (none — version bump is explicitly out of scope per §15.7)

---

## UC-VR-CC-2: `claudeknows status --json` on Fresh Install with No Ingest

**Actor**: Developer or SDLC pipeline

**Preconditions**:
- Common preconditions hold
- `bash install.sh --yes` has been run
- `claudeknows ingest` has NOT been run; `index.db` does NOT exist (or is newly initialized with v2 schema)

**Trigger**: Developer runs `claudeknows status --json`

### Primary Flow

1. The binary initializes the v2 database if not present (creates schema v2 tables including `chunks_vec`)
2. The binary reads the schema version, document count, and chunk count
3. The binary returns a JSON object including at minimum: `schema_version: 2`, `doc_count: 0`, `chunk_count: 0`, `embedding_count: 0`
4. Exit code 0

**Postconditions**:
- JSON output contains `"schema_version": 2` (FR-VR-3.3, AC-VR-1)
- `doc_count: 0`, `chunk_count: 0`, `embedding_count: 0` (no documents ingested yet)

**Mapped FR**: FR-VR-3.3; **AC**: AC-VR-1

---

## UC-VR-CC-3: v0.3.1 User Upgrades via install.sh, Opens Existing Index

**Actor**: Developer

**Preconditions**:
- The Developer has `claudeknows` v0.3.1 installed with an existing v1 corpus (51 K chunks)
- The Developer runs `bash install.sh --yes` to upgrade to the v2 binary
- After upgrade, the Developer runs any `claudeknows` command on the existing `index.db` (which still has schema v1)

**Trigger**: Developer runs `claudeknows status --json` (or any other command) after upgrade

### Primary Flow

1. The new v2 binary is installed; it replaces the v0.3.1 binary
2. The Developer runs `claudeknows status --json`; the v2 binary opens the existing v1 `index.db`
3. The v2 binary detects `schema_version = 1`; the migration UX in UC-VR-5 is triggered
4. If TTY: the prompt `Re-ingest required for v2 schema. Proceed? [y/N]` is displayed; the Developer approves
5. If headless or `CLAUDEKNOWS_AUTO_REINGEST=1`: migration proceeds automatically (UC-VR-5-A2)
6. v1 schema is dropped; v2 schema is created (empty); the binary exits 0 with a hint to re-run `ingest`
7. The Developer re-runs `claudeknows ingest <books-dir>` to populate the v2 schema (UC-VR-1 / UC-VR-EC-5)

**Postconditions**:
- `index.db` has v2 schema after migration
- The prior v1 data is gone; the corpus must be re-ingested
- `claudeknows status --json` returns `schema_version: 2` after migration

**Mapped FR**: FR-VR-3.4; **AC**: AC-VR-12, AC-VR-13

---

## Facts

### Verified facts

- PRD §15 (`docs/PRD.md` lines 3620–3875) was read in full this session; it is the authoritative source for FR-VR-1.1 through FR-VR-8.5, NFR-VR-1 through NFR-VR-8, and AC-VR-1 through AC-VR-17. Source: `docs/PRD.md` lines 3620–3875 read this session.
- `.claude/plan.md` (lines 1–349) was read in full this session; it is the authoritative source for implementation slice scope, locked technical decisions, wave assignments, external contract assumptions, and open questions. Source: `/Users/aleksandra/Documents/claude-code-sdlc/.claude/plan.md` read this session.
- PRD §15 `Date: 2026-05-09` — this is on or after `MERGE_DATE`; the `## Facts` block is mandatory per the cognitive-self-check rule.
- `claudeknows status --json` returned `{"schema_version":1,"doc_count":28,"chunk_count":51542,"db_path":"/Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db"}` in this session — confirming 28 documents and 51 542 chunks.
- `claudeknows list --json` returned 28 source entries including Russian-language filenames (`Али_Аминиан_и_другие_System_Design_Подготовка_к_сложному_интервью.pdf`, `Хаос_инжиниринг_2021_Кейси_Розенталь,_Нора_Джонс.pdf`) and English-language filenames (`908530342_Building_AI_Agents_With_LLMs_RAG_And_Knowledge_Graphs.pdf`, `Deep_Learning_by_Ian_Goodfellow,_Yoshua_Bengio,_Aaron_Courville.pdf`). Detected corpus languages: English and Russian. Source: `claudeknows list --json` output this session.
- Corpus scope relevance verdict: **Partial overlap**. Observed corpus domain: ML/AI, data engineering, RAG, vector search, generative AI, LLM agents, system design (RU+EN), SRE. Task domain: vector retrieval backend (hybrid search, chunking, OCR, document parsing, install scripts). Covered sub-domains: hybrid retrieval, dense embeddings, RAG chunking (queried; 3 English hits returned). Uncovered sub-domains: document parsing (Docling/pdfium), OCR (PaddleOCR), install script engineering (no hits in English or Russian). Source: queries run this session (see External contracts below).
- e5 prefix discipline (`"passage: "` for ingest, `"query: "` for search) is documented on the `intfloat/multilingual-e5-small` model card — verified: yes (plan.md External contracts, marked `verified: yes`). Source: plan.md line 85–86 read this session.
- RRF formula `score(d) = Σ_i 1/(60 + rank_i(d))` with k=60 from Cormack et al. 2009 — verified: yes. Source: plan.md line 86 read this session.
- AC-7 iter-1 contract: `error: index database invalid; re-ingest required` is the literal exit-1 message for corrupt databases — verified via plan.md line 42 (Locked Decision #9) and Slice 2 done-condition at plan.md line 117. Source: plan.md lines 42 and 117 read this session.
- The existing use-case format was verified by reading `docs/use-cases/auto-persist-plan-mode_use_cases.md` in full this session; format conventions (Actors table, UC Coverage table, Primary/Alternative/Error/Edge flows, Postconditions, Mapped FR) are mirrored from that file. Source: `/Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/auto-persist-plan-mode_use_cases.md` read this session.
- This is a new file — no existing use-case file covers the `claudeknows` vector retrieval backend domain. Fourteen existing use-case files were listed; none covers this domain. Source: `ls /Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/` output this session.

### External contracts

- knowledge-base: 923991015_Generative_AI_With_LangChain_Build_Production_ready_LLM.pdf:26011 — query: "hybrid retrieval BM25 dense vector" — BM25: 32.94944498062141 — verified: yes. Load-bearing for UC-VR-2 and UC-VR-3: the corpus confirms the industry-standard characterization of hybrid retrieval as combining BM25 (sparse/lexical) with dense embeddings.
- knowledge-base: 934216520_Mastering_LangChain_A_Comprehensive_Guide_to_Building.pdf:37926 — query: "hybrid retrieval BM25 dense vector" — BM25: 31.214891404815894 — verified: yes. Load-bearing for UC-VR-2: confirms the terminology "Dense Retrieval" and "Sparse Retrieval" used in result field naming and scenario descriptions.
- knowledge-base: 923991015_Generative_AI_With_LangChain_Build_Production_ready_LLM.pdf:26083 — query: "hybrid retrieval BM25 dense vector" — BM25: 29.947850074367587 — verified: yes. Load-bearing for UC-VR-2: confirms that hybrid retrieval "balances keyword precision with semantic understanding" — corroborating the cross-lingual and paraphrase-matching motivation for UC-VR-3.
- knowledge-base: searched "гибридный поиск BM25 векторный" → 0 hits; no Russian-language coverage of hybrid retrieval in the corpus. The English hits above are sufficient for the hybrid-retrieval scenarios.
- knowledge-base: searched "document parsing PDF structure extraction" / "парсинг документов структура PDF извлечение" → 0 hits in English or Russian; document parsing (Docling/pdfium) concepts are not covered in the corpus. Corpus enrichment with Docling documentation or a PDF processing reference would help future feature authoring.
- knowledge-base: searched "OCR optical character recognition text extraction" / "OCR распознавание символов текст" → 0 hits in English or Russian; OCR concepts are not covered in the corpus.
- knowledge-base: searched "chunking text splitting embedding index" / "разбиение текста чанки векторное представление" → 0 hits in English or Russian; structural chunking specifics are not covered in the corpus.
- knowledge-base: searched "multimodal image embedding figure RAG" → 0 hits; multimodal embedding concepts are not covered in the corpus.
- **`intfloat/multilingual-e5-small` model card** — symbol: `"passage: "` prefix for indexed passages, `"query: "` prefix for search queries; 384-dimensional ONNX export; supports Russian and English natively — source: https://huggingface.co/intfloat/multilingual-e5-small — verified: yes (plan.md External contracts entry, read this session).
- **Reciprocal Rank Fusion k=60** — symbol: `score(d) = Σ_i 1/(60 + rank_i(d))` summed across BM25 and dense rankers — source: Cormack, Clarke, and Buettcher, "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods," SIGIR 2009 — verified: yes (plan.md External contracts, read this session).
- **`fastembed-rs` (Qdrant, crates.io `fastembed = "4"`)** — symbol: `TextEmbedding::try_new(InitOptions { model_name: EmbeddingModel::MultilingualE5Small, ... })`, `embed(documents: Vec<&str>, batch_size: Option<usize>) -> Vec<Vec<f32>>` — source: https://github.com/Anush008/fastembed-rs — verified: **no — assumption**. Architect Slice 5 pre-review MUST verify e5-small is in fastembed's supported model list and the API shape matches. Risk: if fastembed does not support e5-small, fall back to raw `ort`.
- **`sqlite-vec` extension** — symbol: `vec0` virtual table; `embedding float[384]` column declaration; `vec_distance_cosine(a, b)` distance function — source: https://github.com/asg017/sqlite-vec — verified: **no — assumption**. Architect Slice 2 pre-review MUST decide static-vs-runtime linking. Risk: cross-platform static linking may not be available on all targets.
- **`ort` Rust ONNX Runtime v2.x** — symbol: `ort::Session::builder().commit_from_file(path)`, `Session::run(inputs) -> Result<Outputs>` — source: https://docs.rs/ort/2 — verified: **no — assumption**. Used transitively by fastembed-rs and directly by PaddleOCR and Docling integrations. Risk: API shape may differ across minor versions.
- **Docling (IBM, Apache-2.0)** — ONNX model artifacts at `https://huggingface.co/ds4sd/docling-models`; outputs structured Markdown + DocLink JSON — source: https://github.com/DS4SD/docling — verified: **no — assumption (CRITICAL)**. Docling has no first-class Rust SDK. Architect Slice 3 pre-review picks the integration strategy. Pragmatic fallback (FR-VR-1.4): if Docling is unfeasible, Slice 3 de-scopes to "structural chunker over pdfium output"; Docling deferred to v2.
- **PaddleOCR det+rec ONNX** — symbols: detection model `ch_PP-OCRv4_det_infer.onnx`, recognition model `ch_PP-OCRv4_rec_infer.onnx`, multilingual variant `ml_PP-OCRv4_*_infer.onnx` (~30 MB combined) — source: https://github.com/PaddlePaddle/PaddleOCR — verified: **no — assumption**. Architect Slice 6 picks between PaddleOCR, trocr, and Tesseract. Model filenames and ONNX export format may differ from this assumption.
- **Corpus scope relevance verdict**: Partial overlap. Observed corpus domain: ML/AI, data engineering, RAG, vector search, generative AI, LLM agents, system design (RU+EN), SRE. Task domain: vector retrieval backend. Covered sub-domain queried: hybrid retrieval (3 English hits). Uncovered sub-domains: document parsing, OCR, install script engineering (0 hits in both languages).

### Assumptions

- ONNX runtime via `ort` works on all target platforms (macOS arm64/x64, Linux x64/arm64, Windows x64). ARM Windows and FreeBSD are not covered. Source: plan.md Assumptions section, read this session. Risk: platform-specific ABI or shared-library issues may cause build or runtime failures. How to verify: build matrix in Slice 11 install scripts.
- 51 K chunks at encode batch=32 on CPU (M1/M2 MacBook) takes ≤10 minutes for full re-ingest (15 minutes per NFR-VR-3). Source: plan.md Assumptions section. Risk: actual wall-clock time may exceed budget if PDF parsing is slow. How to verify: Slice 8 operational step measures actual time.
- Image bytes as BLOB column adds approximately 4 MB per 50-page PDF with 20 figures (~200 KB per figure). Source: plan.md Assumptions section. Risk: PDFs with many large figures (e.g., high-res scans) may produce much larger BLOBs. How to verify: Slice 4 measures DB file size growth.
- The `chunks_vec` row count equaling the `chunks` row count after a complete ingest is a sufficient integrity check for UC-VR-CC-2 and AC-VR-17. Source: plan.md Assumptions section. Risk: rows could be inserted out of sync if a batch write fails partway. How to verify: Slice 5 tests include a mid-batch failure injection.
- The placeholder text `[image: figure N from <doc-basename>]` is the exact format; `N` is the 1-based figure index within the document. Source: plan.md Slice 6 Changes section (line 148). Risk: the actual format may differ (e.g., 0-based indexing). How to verify: Slice 6 implementation and encoder_prefix_test.rs.
- `claudeknows status --json` includes an `embedding_count` field in v2 output (referenced in UC-VR-CC-2 and UC-VR-1 Postconditions). Source: inferred from FR-VR-4.4 (`status --json` reports degraded mode) and Slice 2 done-condition. Risk: the exact field name may be `chunks_vec_count` or similar. How to verify: Slice 2 implementation and store_v2_test.rs.

### Open questions

- **OQ-1 (Docling integration strategy)** — load-bearing for UC-VR-1 Docling branch. Three options: direct ONNX, Python sidecar, or alternative parser. Architect Slice 3 pre-review decides. If Docling is ruled unfeasible, UC-VR-1 Docling branch collapses to pdfium-only; UC-VR-1-A1 (Docling fallback) becomes the only path. Needs: architect decision before Slice 3 implementation.
- **OQ-2 (sqlite-vec linking)** — static-link vs runtime `load_extension`. Affects UC-VR-1-E4 (extension load failure scenario). Architect Slice 2 pre-review decides.
- **OQ-3 (OCR model selection)** — PaddleOCR, trocr, or Tesseract. Affects UC-VR-4 fixture `diagram-with-text.png` and the cosine similarity threshold of 0.5 (FR-VR-5.4). Architect Slice 6 pre-review decides and pins exact ONNX model filenames.
- knowledge-base: corpus covers hybrid retrieval and RAG concepts (English hits); document parsing, OCR, and structural chunking are not represented in the corpus. Adding Docling documentation, PaddleOCR technical references, or the BEIR benchmark paper would help future retrieval-backend feature authoring.
