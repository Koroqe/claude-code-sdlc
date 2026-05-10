# Test Cases: Vector + Multimodal Retrieval Backend

> Based on [PRD](../PRD.md) — Section 15: Vector + Multimodal Retrieval Backend and [Use Cases](../use-cases/vector-retrieval-backend_use_cases.md)

## Facts

### Verified facts

- PRD §15 (`docs/PRD.md` lines 3620–3875) was read in full this session; it is the authoritative source for FR-VR-1.1 through FR-VR-8.5, NFR-VR-1 through NFR-VR-8, and AC-VR-1 through AC-VR-17. Source: `docs/PRD.md` lines 3620–3875 read this session.
- `.claude/plan.md` (lines 1–349) was read in full this session; it is the authoritative source for implementation slice scope, locked technical decisions (11 slices / 8 waves), wave assignments, external contract assumptions, architect OQ resolutions, and open questions. Source: `/Users/aleksandra/Documents/claude-code-sdlc/.claude/plan.md` read this session.
- Use cases file `docs/use-cases/vector-retrieval-backend_use_cases.md` (lines 1–811) was read in full this session; it is the authoritative source for UC-VR-1 through UC-VR-7 (and variants), UC-VR-EC-1 through UC-VR-EC-5, and UC-VR-CC-1 through UC-VR-CC-3. Source: `/Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/vector-retrieval-backend_use_cases.md` read this session.
- PRD §15 Date: 2026-05-09 — on or after MERGE_DATE; the `## Facts` block is mandatory per the cognitive-self-check rule.
- Architect verdict (PASS with 5 [STRUCTURAL] action items) was supplied by the task prompt this session: OQ-1 resolved as "Docling deferred; Slice 3 = pdfium → structural Markdown + image extraction"; OQ-2 resolved as "`sqlite-vec = "0.1"` via `sqlite_vec::load(&db)`"; OQ-3 resolved as "PaddleOCR PP-OCRv4 ml + sha256 sidecar"; OQ-4 resolved as "fastembed-rs v4 + ONNX-boundary prefix test"; `ort = "2"` in load-dynamic mode (mirrors pdfium); model footprint ~250 MB; security pre-review on Slices 5/6/11. Source: task description read this session.
- AC-7 iter-1 contract literal message: `error: index database invalid; re-ingest required` — source: plan.md lines 42 and 117 read this session; PRD §15 FR-VR-3.5 line 3659 read this session.
- sqlite-vec extension load failure literal message: `error: failed to load sqlite-vec extension; re-install via bash install.sh` — source: use-cases file UC-VR-1-E4 line 147 read this session.
- e5 prefix discipline: `"passage: "` for ingest, `"query: "` for search — source: PRD §15 FR-VR-4.2 line 3664 and plan.md External contracts (verified: yes) read this session.
- RRF formula: `score(d) = Σ_i 1/(60 + rank_i(d))` with k=60 — source: PRD §15 FR-VR-6.2 line 3680 and plan.md External contracts (verified: yes) read this session.
- JSON output field names: `mode_used`, `bm25_score`, `dense_score`, `rrf_score` — source: PRD §15 FR-VR-6.4 line 3682 read this session.
- Migration prompt exact text: `Re-ingest required for v2 schema. Proceed? [y/N]` — source: PRD §15 FR-VR-3.4(a) line 3658 read this session; use-cases file UC-VR-5 line 358 read this session.
- Post-migration hint exact text: `Schema migrated to v2. Re-run 'claudeknows ingest <path>' to populate the new schema.` — source: use-cases file UC-VR-5 primary flow step 5, line 361 read this session.
- Encoder degraded status field: `"degraded": "encoder model missing"` — source: PRD §15 FR-VR-4.4 line 3666 and plan.md Slice 5 Changes (line 141) read this session.
- Placeholder text format: `[image: figure N from <doc-basename>]` where N is 1-based — source: plan.md Slice 6 Changes (line 148) and PRD §15 FR-VR-5.2 line 3672 read this session.
- `chunks_vec` virtual table declaration: `CREATE VIRTUAL TABLE chunks_vec USING vec0(embedding float[384])` — source: PRD §15 FR-VR-3.1 line 3655 and plan.md Locked Decision #5 (line 38) read this session.
- Hybrid search default is `--mode hybrid` when no `--mode` flag supplied — source: PRD §15 FR-VR-6.3 line 3681 read this session.
- Benchmark binary name: `claudeknows-bench` declared as `[[bin]]` in `Cargo.toml` — source: PRD §15 FR-VR-7.1 line 3689 and plan.md Slice 9 (line 169) read this session.
- Golden query set path: `tools/sdlc-knowledge/bench/golden/queries.jsonl`, minimum 25 queries — source: PRD §15 FR-VR-7.2 line 3690 read this session.
- Committed benchmark report path: `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` — source: PRD §15 FR-VR-7.4 line 3692 and plan.md Slice 10 (line 178) read this session.
- Model directories: `~/.claude/tools/sdlc-knowledge/models/e5-small/`, `~/.claude/tools/sdlc-knowledge/models/paddleocr/`, `~/.claude/tools/sdlc-knowledge/models/docling/` — source: PRD §15 FR-VR-8.2 line 3698 and use-cases file common preconditions (lines 12–15) read this session.
- NFR-VR-2: hybrid p95 latency < 500ms on 2024 MacBook M1 over 51K-chunk corpus — source: PRD §15 NFR-VR-2 line 3706 read this session.
- NFR-VR-3: full 40-PDF re-ingest < 15 minutes on CPU (M1/M2) — source: PRD §15 NFR-VR-3 line 3707 read this session.
- FR-VR-4.5: cold-start < 3s; hot-path batch=32 < 50ms/chunk on 2024 MacBook M1 — source: PRD §15 FR-VR-4.5 line 3667 read this session.
- FR-VR-5.4: cosine similarity > 0.5 between `"auth service architecture"` query and `diagram-with-text.png` chunk containing "Authentication Service" — source: PRD §15 FR-VR-5.4 line 3674 read this session.
- PNG bomb size limit: decoded > 50 MB → rejected — source: task description (TC-VR-SEC.2 / TC-VR-5.5 requirement) read this session.
- Slice 3 architect resolution (OQ-1): Docling deferred to v2; Slice 3 implemented as pdfium → structural Markdown + image extraction — source: task description architect verdict, confirmed as consistent with plan.md R1 pragmatic fallback (line 242) read this session.
- Existing test-case format conventions verified by reading `docs/qa/local-knowledge-base_test_cases.md` lines 1–120 and `docs/qa/pdfium-pdf-extraction_test_cases.md` lines 1–80 in this session: `## Facts` block at top, UC Coverage table, AC Coverage table, numbered functional sections, TC table format with columns `#`, `Use Case`, `Test Case`, `Expected Result`.
- Corpus scope relevance verdict: **Partial overlap**. Observed corpus domain: ML/AI, data engineering, RAG, vector search, generative AI, LLM agents, system design (RU+EN), SRE. Task domain: vector retrieval backend (hybrid search, structural chunking, OCR, document parsing, install scripts). Covered sub-domains queried in this session: hybrid retrieval (3 English hits in LangChain corpus). Uncovered sub-domains: OCR (PaddleOCR), structural PDF parsing, install script engineering (0 hits in English or Russian). Source: use-cases file `## Facts → ### External contracts` knowledge-base queries, read this session.

### External contracts

- **`fastembed-rs` (Qdrant, crates.io `fastembed = "4"`)** — symbol: `TextEmbedding::try_new(InitOptions { model_name: EmbeddingModel::MultilingualE5Small, ... })`, `embed(documents: Vec<&str>, batch_size: Option<usize>) -> Vec<Vec<f32>>` — source: https://github.com/Anush008/fastembed-rs (crates.io `fastembed = "4"`) — verified: **no — assumption**. Architect resolved OQ-4 as "fastembed-rs v4 + ONNX-boundary prefix test"; actual supported model list and API shape must be confirmed by Slice 5 architect pre-review. Risk: if `MultilingualE5Small` is not in fastembed v4's model enum, fall back to raw `ort`. Test cases referencing `encode_passages` and `encode_query` assume this API shape.
- **`sqlite-vec` extension (Alex Garcia)** — symbol: `vec0` virtual table; `embedding float[384]` column declaration; `vec_distance_cosine(a, b)` distance function; `sqlite_vec::load(&db)` runtime load call — source: https://github.com/asg017/sqlite-vec; architect OQ-2 resolution: `sqlite-vec = "0.1"` via `sqlite_vec::load(&db)` — verified: **no — assumption**. Runtime-load strategy confirmed by architect; exact `sqlite_vec::load` symbol must be verified against crate v0.1 at Slice 2 implementation. Risk: crate API may differ from assumption; extension load may fail on non-standard Linux.
- **`ort` Rust ONNX Runtime v2.x** — symbol: `ort::Session::builder().commit_from_file(path)`, `Session::run(inputs) -> Result<Outputs>`; loaded in `load-dynamic` mode (mirrors pdfium pattern) — source: https://docs.rs/ort/2; architect verdict: `ort = "2"` in load-dynamic mode — verified: **no — assumption**. Risk: API shape may differ across minor versions; dynamic load requires runtime shared library presence. Verification: Slice 5 architect pre-review pins exact symbols.
- **`intfloat/multilingual-e5-small` model card** — symbol: `"passage: "` prefix for indexed passages, `"query: "` prefix for search queries; 384-dimensional ONNX export; supports Russian and English natively — source: https://huggingface.co/intfloat/multilingual-e5-small — verified: yes (plan.md External contracts entry marked `verified: yes`, read this session).
- **PaddleOCR PP-OCRv4 det+rec ONNX (multilingual variant)** — symbol: multilingual detection model `ml_PP-OCRv4_det_infer.onnx`, recognition model `ml_PP-OCRv4_rec_infer.onnx` + sha256 sidecar files — source: https://github.com/PaddlePaddle/PaddleOCR; architect OQ-3 resolution: "PP-OCRv4 ml + sha256 sidecar" — verified: **no — assumption**. Exact ONNX model filenames and sha256 sidecar convention must be confirmed at Slice 6 implementation. Risk: model filenames may differ; sha256 sidecar format is implementation-defined.
- **Reciprocal Rank Fusion k=60** — symbol: `score(d) = Σ_i 1/(60 + rank_i(d))` summed across BM25 and dense rankers — source: Cormack, Clarke, and Buettcher, "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods," SIGIR 2009 — verified: yes (plan.md External contracts entry marked `verified: yes`, read this session).
- **knowledge-base: 923991015_Generative_AI_With_LangChain_Build_Production_ready_LLM.pdf:26011** — query: "hybrid retrieval BM25 dense vector" — BM25: 32.94944498062141 — verified: yes. Load-bearing for TC-VR-6.x and TC-VR-EC.3: confirms the industry-standard characterization of hybrid retrieval as combining BM25 with dense embeddings.
- **knowledge-base: 934216520_Mastering_LangChain_A_Comprehensive_Guide_to_Building.pdf:37926** — query: "hybrid retrieval BM25 dense vector" — BM25: 31.214891404815894 — verified: yes. Load-bearing for TC-VR-6.7: confirms "Dense Retrieval" terminology used in result field naming.
- **knowledge-base: searched "document parsing PDF structure extraction" / "парсинг документов структура PDF" → 0 hits** in English or Russian; document parsing (pdfium structural Markdown, Docling) concepts not covered in corpus. Uncovered sub-domain documented per partial-overlap verdict.
- **knowledge-base: searched "OCR optical character recognition PaddleOCR" / "OCR распознавание символов" → 0 hits** in English or Russian; OCR concepts not covered in corpus.

### Assumptions

- The `sqlite_vec::load(&db)` symbol is the exact runtime-load call for sqlite-vec v0.1; if the crate uses a different function name (e.g., `sqlite_vec::sqlite3_auto_extension`), TC-VR-3.6 must be updated. Risk: test references wrong symbol; verification path: Slice 2 implementation + store_v2_test.rs.
- `claudeknows status --json` in v2 includes an `embedding_count` field (TC-VR-4.1, TC-VR-EC.5). Exact field name may be `chunks_vec_count` or similar. Source: inferred from FR-VR-4.4 and Slice 2 done-condition (plan.md line 117). Risk: test uses wrong field name; verification: Slice 2 store_v2_test.rs.
- The PNG bomb limit of 50 MB (decoded pixel bytes) is the enforcement threshold for TC-VR-5.5 and TC-VR-SEC.2. This value was supplied in the task description as the design intent; it is not explicitly stated in a PRD FR. Risk: implementation may choose a different threshold. Verification: Slice 6 implementation; ocr_test.rs.
- Image figure indexing is 1-based within a document (placeholder `[image: figure 1 from <doc-basename>]`). Source: plan.md Slice 6 line 148. Risk: implementation may use 0-based indexing. Verification: Slice 6 encoder_prefix_test.rs.
- TC-VR-4.3 (cold-start < 3s) and TC-VR-4.4 (hot-path < 50ms) are anchored to the 2024 MacBook M1 reference machine per FR-VR-4.5. These TCs are expected to fail on significantly slower hardware; they are performance regression tests only on the reference machine.
- TC-VR-6.6 (hybrid p95 < 500ms) is anchored to the 51K-chunk corpus on the 2024 MacBook M1 reference machine per FR-VR-6.7. Latency on smaller corpora or different hardware is not governed by this TC.
- The `--mode dense` encoder-absent exit message is `encoder model missing` (exact substring) per UC-VR-2-E1 (use-cases line 213). The exact format (stderr vs stdout, exit code 1) is confirmed by PRD §15 FR-VR-6.6 and AC-VR-14.
- Slice 3 (pdfium → structural Markdown path) produces structural Markdown that `chunker::structural_chunk()` can parse for headings; the output format of pdfium + heading-detection heuristics is implementation-defined. TC-VR-1.1 references "structural Markdown with section paths" per the architect verdict; exact heading detection is tested by TC-VR-2.1.

### Open questions

- **OQ-1 (Docling integration strategy)** — RESOLVED by architect: Docling deferred to v2; Slice 3 = pdfium → structural Markdown + image extraction. TC-VR-1.x tests reference the pdfium-as-primary-parser path (with structural Markdown output). If Docling ships in a later iteration, TC-VR-1.x will need a new sub-series for the Docling code path.
- **OQ-2 (sqlite-vec linking)** — RESOLVED by architect: runtime-load via `sqlite_vec::load(&db)`. TC-VR-3.6 tests the extension load failure path. TC-VR-3.1 tests the happy-path extension load.
- **OQ-3 (OCR model selection)** — RESOLVED by architect: PaddleOCR PP-OCRv4 ml + sha256 sidecar. TC-VR-5.1 and TC-VR-5.6 reference the PP-OCRv4 multilingual model filenames. Exact filenames are marked as assumptions pending Slice 6 implementation.
- **OQ-4 (Per-language benchmark stratification)** — RESOLVED out-of-scope. TC-VR-7.x does not include per-language metric stratification tests; overall metrics + qualitative side-by-side only per PRD §15 FR-VR-7.5.
- **knowledge-base: corpus covers hybrid retrieval and RAG concepts (English hits); document parsing, OCR, and structural chunking are not represented. Adding Docling documentation, PaddleOCR technical references, or the BEIR benchmark paper would help future retrieval-backend feature authoring.**

---

## Use Case Coverage

Every UC from `docs/use-cases/vector-retrieval-backend_use_cases.md` maps to at least one test case below.

| UC ID | Scenario | Test Cases |
|-------|----------|------------|
| UC-VR-1 | First-time ingest of books directory — full v2 pipeline | TC-VR-1.1, TC-VR-1.2, TC-VR-1.3, TC-VR-2.1, TC-VR-2.2, TC-VR-2.3, TC-VR-3.1, TC-VR-3.5, TC-VR-4.1, TC-VR-4.2, TC-VR-4.4, TC-VR-5.1, TC-VR-5.2, TC-VR-5.3 |
| UC-VR-1-A1 | Docling parse failure — pdfium fallback engages | TC-VR-1.3 |
| UC-VR-1-E1 | e5-small ONNX model absent — degraded mode, BM25-only | TC-VR-4.5 |
| UC-VR-1-E2 | PaddleOCR models absent — image chunks get placeholder text | TC-VR-5.4 |
| UC-VR-1-E3 | Corrupt v1 DB opened with v2 binary — exit 1, no migration | TC-VR-3.4 |
| UC-VR-1-E4 | sqlite-vec extension load fails — exit 1, clear error | TC-VR-3.6 |
| UC-VR-1-EC1 | Plaintext .md with no headings — 500-char sliding window | TC-VR-2.2 |
| UC-VR-1-EC2 | Plaintext .md with exactly three headings — three chunks | TC-VR-2.1 |
| UC-VR-2 | Hybrid search with default and explicit `--mode hybrid` | TC-VR-6.3, TC-VR-6.4, TC-VR-6.5, TC-VR-6.6 |
| UC-VR-2-A1 | Explicit `--mode lexical` — BM25-only backward-compatible path | TC-VR-6.1 |
| UC-VR-2-E1 | `--mode dense` requested with encoder absent | TC-VR-4.5 |
| UC-VR-2-E2 | `--mode hybrid` requested with encoder absent — falls back to lexical | TC-VR-4.5 |
| UC-VR-2-EC1 | Empty query string — no panic | TC-VR-EC.4 |
| UC-VR-2-EC2 | Zero-vector query — no panic | TC-VR-EC.4 |
| UC-VR-3 | Russian query against English corpus — dense path matches | TC-VR-6.7 |
| UC-VR-3-A1 | Same Russian query with `--mode lexical` — zero results expected | TC-VR-6.7 |
| UC-VR-3-EC1 | Mixed RU+EN query — both language tokens handled | TC-VR-EC.3 |
| UC-VR-4 | Search finds content inside a figure (image chunk) | TC-VR-5.3, TC-VR-6.2 |
| UC-VR-4-A1 | Image chunk has placeholder text — still searchable | TC-VR-5.4 |
| UC-VR-4-EC1 | Corpus has no image chunks — select(.type=="image") returns 0 | TC-VR-5.4 |
| UC-VR-5 | v1 index opened with v2 binary — migration UX (TTY) | TC-VR-3.2 |
| UC-VR-5-A1 | TTY — User refuses migration | TC-VR-3.2 |
| UC-VR-5-A2 | Headless — CLAUDEKNOWS_AUTO_REINGEST=1 | TC-VR-3.3 |
| UC-VR-5-EC1 | CLAUDEKNOWS_AUTO_REINGEST=1 but DB already v2 — no prompt, no drop | TC-VR-3.3 |
| UC-VR-5-EC2 | Migration prompt fires before `list` results | TC-VR-3.2 |
| UC-VR-6 | Benchmark harness run — produces Markdown report | TC-VR-7.1, TC-VR-7.2, TC-VR-7.3, TC-VR-7.4 |
| UC-VR-6-A1 | Single mode run (`--modes lexical`) | TC-VR-7.1 |
| UC-VR-6-E1 | queries.jsonl path does not exist | TC-VR-7.1 |
| UC-VR-6-E2 | Malformed query in queries.jsonl — skipped with warning | TC-VR-7.3 |
| UC-VR-6-EC1 | All queries have empty relevance judgments — no panic | TC-VR-7.2 |
| UC-VR-7 | Fresh install + single-PDF ingest — full end-to-end success | TC-VR-8.1, TC-VR-8.2, TC-VR-8.4 |
| UC-VR-7-A1 | install.sh model download endpoints unreachable | TC-VR-8.1, TC-VR-4.5 |
| UC-VR-7-EC1 | Single PDF is encrypted — 0 chunks, exit 0 with warning | TC-VR-1.3 |
| UC-VR-EC-1 | PDF with 100+ figures — ingest completes, DB size measured | TC-VR-EC.1 |
| UC-VR-EC-2 | Chinese PDF, no multilingual OCR model — placeholder fallback | TC-VR-5.6 |
| UC-VR-EC-3 | Mixed RU+EN query — dense surfaces chunks in both languages | TC-VR-EC.3 |
| UC-VR-EC-4 | `--top-k 1000` — no panic, latency documented | TC-VR-EC.4 |
| UC-VR-EC-5 | Full 40-PDF corpus ingest — wall-clock time documented | TC-VR-EC.5 |
| UC-VR-CC-1 | `claudeknows --version` after feature lands | TC-VR-8.5 |
| UC-VR-CC-2 | `claudeknows status --json` on fresh install, no ingest | TC-VR-3.1 |
| UC-VR-CC-3 | v0.3.1 user upgrades via install.sh, opens existing v1 index | TC-VR-3.2, TC-VR-3.3 |

---

## Acceptance Criteria Coverage

Every AC from PRD §15.5 maps to at least one test case.

| AC ID | Criterion | Test Cases |
|-------|-----------|------------|
| AC-VR-1 | `schema_version: 2` on fresh DB | TC-VR-3.1 |
| AC-VR-2 | `--mode lexical` returns `mode_used: "lexical"` | TC-VR-6.1 |
| AC-VR-3 | `--mode dense` returns `mode_used: "dense"` | TC-VR-6.2 |
| AC-VR-4 | `--mode hybrid` returns `mode_used: "hybrid"` | TC-VR-6.3 |
| AC-VR-5 | Default (no `--mode`) returns `mode_used: "hybrid"` | TC-VR-6.3 |
| AC-VR-6 | `cargo test --test rrf_test -p sdlc-knowledge` exits 0 | TC-VR-6.4 |
| AC-VR-7 | Dense search returns `type="image"` chunk with length > 0 | TC-VR-5.3 |
| AC-VR-8 | Benchmark report file exists | TC-VR-7.1 |
| AC-VR-9 | No stale "NOT a vector database" assertion in rules | TC-VR-8.3 |
| AC-VR-10 | `hybrid\|RRF\|sqlite-vec` present in `knowledge-base.md` | TC-VR-8.4 |
| AC-VR-11 | `cargo test --test chunker_test -p sdlc-knowledge` exits 0 | TC-VR-2.1, TC-VR-2.2 |
| AC-VR-12 | Truncated v1 DB → exit 1, substring `index database invalid` | TC-VR-3.4 |
| AC-VR-13 | `CLAUDEKNOWS_AUTO_REINGEST=1` + v1 DB → exit 0, no prompt | TC-VR-3.3 |
| AC-VR-14 | Model missing: dense exits 1 `encoder model missing`; lexical exits 0 | TC-VR-4.5 |
| AC-VR-15 | `cargo test --test image_extraction_test` exits 0; PNG decoded by `image::load_from_memory` | TC-VR-1.2 |
| AC-VR-16 | `cargo test --test encoder_prefix_test` exits 0 | TC-VR-4.2 |
| AC-VR-17 | `COUNT(*) FROM chunks` == `COUNT(*) FROM chunks_vec` after ingest | TC-VR-4.1 |

---

## 1. Parser Path (pdfium → Structural Markdown + Image Extraction)

*Covers: FR-VR-1.1, FR-VR-1.2, FR-VR-1.3, FR-VR-1.4; AC-VR-11, AC-VR-15; UC-VR-1, UC-VR-1-A1, UC-VR-7-EC1*

*Slice 3 architect resolution: Docling deferred to v2; pdfium is the primary parser producing structural Markdown and a figure list.*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-1.1 | UC-VR-1 primary | pdfium-based ingest of `sample-structured.pdf` produces structural Markdown with section paths | positive | UC-VR-1, FR-VR-1.1, FR-VR-1.2 | Chunks contain `section_path` metadata reflecting heading hierarchy from the PDF; at least one chunk starts with a heading string | `cargo test --test docling_test -p sdlc-knowledge -- --test-filter structural_markdown` |
| TC-VR-1.2 | UC-VR-1 primary | `sample-with-figure.pdf` ingest yields ≥1 chunk row with `type='image'`, non-NULL `image_bytes` BLOB, decoding to valid PNG | positive | UC-VR-1, FR-VR-3.2, AC-VR-15 | `cargo test --test image_extraction_test -p sdlc-knowledge` exits 0; test asserts `image::load_from_memory(&row.image_bytes)` is `Ok(...)` | `cargo test --test image_extraction_test -p sdlc-knowledge` |
| TC-VR-1.3 | UC-VR-1-A1, UC-VR-7-EC1 | Corrupt PDF (or Docling/pdfium unable to extract) triggers fallback path with logged warning; ingest continues for other docs in directory | negative | UC-VR-1-A1, FR-VR-1.1, FR-VR-1.3 | Exit code 0; stderr contains substring `warning`; the corrupt PDF contributes 0 chunks; other PDFs in batch are processed normally | `cargo test --test docling_test -p sdlc-knowledge -- --test-filter fallback_warning` |

---

## 2. Structural Chunker

*Covers: FR-VR-2.1, FR-VR-2.2, FR-VR-2.3, FR-VR-2.4; AC-VR-11; UC-VR-1-EC1, UC-VR-1-EC2*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-2.1 | UC-VR-1-EC2 | `sample-with-headings.md` (exactly 3 `##` headings) yields exactly 3 chunks each starting with the heading line | positive | UC-VR-1-EC2, FR-VR-2.1, FR-VR-2.4, AC-VR-11 | `chunker::structural_chunk()` returns a `Vec` of length 3; each element's first line matches the corresponding heading | `cargo test --test chunker_test -p sdlc-knowledge -- --test-filter heading_bearing_three_chunks` |
| TC-VR-2.2 | UC-VR-1-EC1 | `sample-no-headings.md` yields the same chunk count as the iter-1 baseline 500-char sliding-window chunker (regression) | positive | UC-VR-1-EC1, FR-VR-2.2, AC-VR-11 | Chunk count from `structural_chunk()` equals chunk count from the old `ingest::chunk()` at src/ingest.rs:71 for the no-heading fixture | `cargo test --test chunker_test -p sdlc-knowledge -- --test-filter no_heading_regression` |
| TC-VR-2.3 | UC-VR-1 primary | Chunk overlap = 200 characters verified on heading-bearing fixture | positive | UC-VR-1, FR-VR-2.1 | Consecutive chunks from the heading-bearing fixture share exactly 200 characters at their boundary (last 200 chars of chunk N == first 200 chars of chunk N+1) | `cargo test --test chunker_test -p sdlc-knowledge -- --test-filter chunk_overlap_200` |

---

## 3. Schema v2 + Migration

*Covers: FR-VR-3.1, FR-VR-3.2, FR-VR-3.3, FR-VR-3.4, FR-VR-3.5; AC-VR-1, AC-VR-12, AC-VR-13; UC-VR-5, UC-VR-CC-2, UC-VR-CC-3*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-3.1 | UC-VR-CC-2 | `claudeknows status --json` on fresh DB (no prior ingest) returns `schema_version: 2`; sqlite-vec extension loaded; `chunks_vec` virtual table exists | positive | UC-VR-CC-2, FR-VR-3.1, FR-VR-3.3, AC-VR-1 | JSON output contains `"schema_version": 2`; `SELECT count(*) FROM sqlite_master WHERE type='table' AND name='chunks_vec'` returns 1 | `claudeknows status --json --project-root <tmpdir> \| jq '.schema_version'` equals `2`; `cargo test --test store_v2_test -p sdlc-knowledge -- --test-filter schema_v2_fresh` |
| TC-VR-3.2 | UC-VR-5, UC-VR-CC-3 | Valid v1 fixture DB opened with v2 binary (TTY): prompt `Re-ingest required for v2 schema. Proceed? [y/N]` displayed; `y` input → migration runs; exit 0; hint message present; DB now v2 | positive | UC-VR-5, UC-VR-CC-3, FR-VR-3.4(a)(d), AC-VR-12 | Prompt substring `Re-ingest required for v2 schema. Proceed? [y/N]` on stdout; exit code 0 after `y` input; `claudeknows status --json` on migrated DB returns `"schema_version": 2`; prior v1 rows absent | `cargo test --test migration_test -p sdlc-knowledge -- --test-filter tty_approve_migration` |
| TC-VR-3.2 | UC-VR-5-A1 | Valid v1 fixture DB opened with v2 binary (TTY): `n` input → exit 0; DB UNCHANGED (still v1 schema) | negative | UC-VR-5-A1, FR-VR-3.4(c) | Exit code 0; `claudeknows status --json` on DB still returns `"schema_version": 1` | `cargo test --test migration_test -p sdlc-knowledge -- --test-filter tty_refuse_migration` |
| TC-VR-3.3 | UC-VR-5-A2, UC-VR-CC-3 | `CLAUDEKNOWS_AUTO_REINGEST=1` + valid v1 fixture DB → migration runs headlessly; no prompt; exit 0; hint on stdout | positive | UC-VR-5-A2, FR-VR-3.4(b), AC-VR-13 | No prompt substring on stdout; exit code 0; DB schema = v2 after command | `CLAUDEKNOWS_AUTO_REINGEST=1 claudeknows status --json --project-root <tmpdir-with-v1-db>` exits 0; `cargo test --test migration_test -p sdlc-knowledge -- --test-filter headless_auto_reingest` |
| TC-VR-3.3 | UC-VR-5-EC1 | `CLAUDEKNOWS_AUTO_REINGEST=1` but DB already v2 → no migration prompt, no drop/recreate; command proceeds normally | edge | UC-VR-5-EC1, FR-VR-3.4 | Exit code 0; DB unchanged; `schema_version: 2` in status output; no warning about migration | `CLAUDEKNOWS_AUTO_REINGEST=1 claudeknows status --json --project-root <tmpdir-with-v2-db>` exits 0; schema_version still 2 |
| TC-VR-3.4 | UC-VR-1-E3 | Truncated v1 DB (100 bytes) opened with v2 binary → exit 1 with exact literal `error: index database invalid; re-ingest required`; no migration attempted | negative | UC-VR-1-E3, FR-VR-3.5, AC-VR-12 | Exit code 1; stdout or stderr contains exact substring `index database invalid; re-ingest required`; DB file unchanged | `claudeknows status --json --project-root <tmpdir-with-truncated-db>` exits 1 and `grep "index database invalid; re-ingest required"` returns match; `cargo test --test migration_test -p sdlc-knowledge -- --test-filter corrupt_v1_exit1` |
| TC-VR-3.5 | UC-VR-1 primary | `chunks.image_bytes BLOB` column exists in v2 schema and accepts inserts of PNG byte data | positive | UC-VR-1, FR-VR-3.2 | `sqlite3 index.db "SELECT type FROM pragma_table_info('chunks') WHERE name='image_bytes'"` returns `BLOB`; a test INSERT of known PNG bytes succeeds and the SELECT round-trip matches | `cargo test --test store_v2_test -p sdlc-knowledge -- --test-filter image_bytes_blob_column` |
| TC-VR-3.6 | UC-VR-1-E4 | sqlite-vec extension (`sqlite_vec::load(&db)`) fails to load → exit 1 with exact literal `error: failed to load sqlite-vec extension; re-install via bash install.sh` | negative | UC-VR-1-E4, FR-VR-3.1 | Exit code 1; stdout or stderr contains exact substring `failed to load sqlite-vec extension`; no partial `chunks_vec` table created | `cargo test --test store_v2_test -p sdlc-knowledge -- --test-filter sqlite_vec_load_failure` |

---

## 4. Encoder (e5-small ONNX via fastembed-rs)

*Covers: FR-VR-4.1, FR-VR-4.2, FR-VR-4.3, FR-VR-4.4, FR-VR-4.5; AC-VR-16, AC-VR-17; UC-VR-1, UC-VR-1-E1, UC-VR-2-E1*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-4.1 | UC-VR-1 primary | After full ingest, `chunks_vec` row count equals `chunks` row count | positive | UC-VR-1, FR-VR-4.3, AC-VR-17 | `sqlite3 ~/.claude/knowledge/index.db "SELECT COUNT(*) FROM chunks"` equals `sqlite3 ~/.claude/knowledge/index.db "SELECT COUNT(*) FROM chunks_vec"` | `sqlite3 <index.db> "SELECT (SELECT COUNT(*) FROM chunks) = (SELECT COUNT(*) FROM chunks_vec)"` returns `1`; `cargo test --test encoder_test -p sdlc-knowledge -- --test-filter chunks_vec_parity` |
| TC-VR-4.2 | UC-VR-1 primary | Prefix discipline: `encode_passages()` prepends exactly one `"passage: "` per passage; `encode_query()` prepends exactly one `"query: "` per query; catches double-prefix and missing-prefix bugs | positive | UC-VR-1, FR-VR-4.2, AC-VR-16 | `cargo test --test encoder_prefix_test -p sdlc-knowledge` exits 0; test mocks the ONNX session input boundary and asserts `input[i].starts_with("passage: ") && !input[i].starts_with("passage: passage: ")` for all passages, and `input.starts_with("query: ") && !input.starts_with("query: query: ")` for every query | `cargo test --test encoder_prefix_test -p sdlc-knowledge` |
| TC-VR-4.3 | UC-VR-1 primary | Encoder cold-start latency < 3 seconds on 2024 MacBook M1 reference machine | positive | UC-VR-1, FR-VR-4.5 | Time from `Encoder::new()` to first encode call completes in < 3 000 ms; measured via `std::time::Instant` in test | `cargo test --test encoder_test -p sdlc-knowledge -- --test-filter cold_start_latency` (reference machine only) |
| TC-VR-4.4 | UC-VR-1 primary | Hot-path batch=32 encode completes in < 50 ms on 2024 MacBook M1 reference machine | positive | UC-VR-1, FR-VR-4.5 | A pre-warmed encoder processes a batch of 32 short passages in < 50 ms; measured via `std::time::Instant` | `cargo test --test encoder_test -p sdlc-knowledge -- --test-filter hot_path_batch_32` (reference machine only) |
| TC-VR-4.5 | UC-VR-1-E1, UC-VR-2-E1, UC-VR-2-E2 | Model files absent — degraded mode behavior across all three modes | negative | UC-VR-1-E1, FR-VR-4.4, FR-VR-6.6, AC-VR-14 | (a) `claudeknows search "anything" --mode dense` exits 1; stderr/stdout contains `encoder model missing`; (b) `claudeknows search "anything" --mode lexical` exits 0 with results; (c) `claudeknows search "anything" --mode hybrid` exits 0 with lexical fallback and warning; (d) `claudeknows status --json` contains `"degraded": "encoder model missing"` | `claudeknows search "anything" --mode dense` exits 1; `claudeknows search "anything" --mode lexical` exits 0; `cargo test --test encoder_test -p sdlc-knowledge -- --test-filter degraded_mode` |

---

## 5. OCR Bridge for Image Chunks (PaddleOCR PP-OCRv4 ml)

*Covers: FR-VR-5.1, FR-VR-5.2, FR-VR-5.3, FR-VR-5.4, FR-VR-5.5; AC-VR-7; UC-VR-4, UC-VR-1-E2, UC-VR-EC-2*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-5.1 | UC-VR-7 primary | PaddleOCR PP-OCRv4 multilingual model loads from `~/.claude/tools/sdlc-knowledge/models/paddleocr/`; det + rec ONNX files present after `bash install.sh --yes` | positive | UC-VR-7, FR-VR-5.1, FR-VR-8.2 | `test -f ~/.claude/tools/sdlc-knowledge/models/paddleocr/ml_PP-OCRv4_det_infer.onnx` exits 0; `test -f ~/.claude/tools/sdlc-knowledge/models/paddleocr/ml_PP-OCRv4_rec_infer.onnx` exits 0 (exact filenames subject to Slice 6 implementation — tracked as assumption) | `test -f ~/.claude/tools/sdlc-knowledge/models/paddleocr/ml_PP-OCRv4_det_infer.onnx && echo OK` |
| TC-VR-5.2 | UC-VR-4 primary | Fixture `diagram-with-text.png` containing text "Authentication Service" → OCR returns non-empty string containing "Authentication Service" | positive | UC-VR-4, FR-VR-5.1 | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter ocr_diagram_text` passes; the raw OCR string from the fixture contains the substring `Authentication Service` | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter ocr_diagram_text` |
| TC-VR-5.3 | UC-VR-4 primary | Cosine similarity between query `"auth service architecture"` (via `encode_query`) and the stored embedding of the OCR'd `diagram-with-text.png` chunk > 0.5 | positive | UC-VR-4, FR-VR-5.4, AC-VR-7 | After ingesting a PDF containing `diagram-with-text.png` as a figure: `claudeknows search "auth service architecture" --mode dense --json \| jq '[.[] \| select(.type=="image")] \| length'` returns value > 0; the matching image chunk's `dense_score` > 0.5 | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter cosine_sim_image_chunk_gt_0_5` |
| TC-VR-5.4 | UC-VR-1-E2, UC-VR-4-A1 | PaddleOCR model absent → all image chunks receive placeholder text `[image: figure N from <doc-basename>]`; ingest continues; exit 0 | negative | UC-VR-1-E2, FR-VR-5.5, FR-VR-5.2 | `type='image'` rows in `chunks` have `text LIKE '[image: figure % from %]'`; no row has NULL `text`; exit code 0; stderr contains a warning about missing OCR model | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter ocr_missing_placeholder` |
| TC-VR-5.5 | Security — PNG bomb | PNG decoded to > 50 MB pixel bytes → OCR rejects with logged warning; ingest continues for other chunks | security | TC-VR-SEC.2, FR-VR-5.1 | The oversized PNG is NOT decoded to a pixel buffer exceeding 50 MB; a warning is logged to stderr; the offending image chunk receives placeholder text; other chunks in the batch are processed normally; no OOM or panic | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter png_bomb_rejection` |
| TC-VR-5.6 | UC-VR-EC-2 | Chinese PDF figure with no multilingual PaddleOCR model (only EN/RU model) → empty/garbled OCR → placeholder text; dense path still surfaces chunk | edge | UC-VR-EC-2, FR-VR-5.2, FR-VR-5.3 | Image chunk has placeholder text `[image: figure N from <doc-basename>]`; `type='image'` chunk is present in `chunks_vec`; Chinese-language dense query MAY still surface the chunk (via encoder's multilingual coverage of placeholder text) | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter chinese_figure_placeholder` |

---

## 6. Hybrid Search — Three Modes with RRF

*Covers: FR-VR-6.1, FR-VR-6.2, FR-VR-6.3, FR-VR-6.4, FR-VR-6.5, FR-VR-6.6, FR-VR-6.7; AC-VR-2, AC-VR-3, AC-VR-4, AC-VR-5, AC-VR-6; UC-VR-2, UC-VR-2-A1, UC-VR-3*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-6.1 | UC-VR-2-A1 | `--mode lexical` returns BM25-only ranking; `mode_used: "lexical"` in all results; `dense_score` null or absent | positive | UC-VR-2-A1, FR-VR-6.3, FR-VR-6.4, AC-VR-2 | `claudeknows search "authentication architecture" --mode lexical --json \| jq '.[0].mode_used'` returns `"lexical"`; no `dense_score` value present (or null); encoder NOT invoked | `claudeknows search "authentication architecture" --mode lexical --json \| jq '.[0].mode_used'` equals `"lexical"` |
| TC-VR-6.2 | UC-VR-4 primary | `--mode dense` returns sqlite-vec K-NN ranking; `mode_used: "dense"` in all results; image chunks are surfaced when relevant | positive | UC-VR-4, FR-VR-6.1, FR-VR-6.4, AC-VR-3 | `claudeknows search "authentication architecture" --mode dense --json \| jq '.[0].mode_used'` returns `"dense"`; `dense_score` is a positive float for every result | `claudeknows search "authentication architecture" --mode dense --json \| jq '.[0].mode_used'` equals `"dense"` |
| TC-VR-6.3 | UC-VR-2 primary | `--mode hybrid` (explicit) and no `--mode` flag (default) both return `mode_used: "hybrid"` in all results; `bm25_score`, `dense_score`, `rrf_score` all non-null | positive | UC-VR-2, FR-VR-6.3, FR-VR-6.4, AC-VR-4, AC-VR-5 | Both `claudeknows search "auth" --mode hybrid --json \| jq '.[0].mode_used'` and `claudeknows search "auth" --json \| jq '.[0].mode_used'` return `"hybrid"`; first result's `rrf_score` ≥ last result's `rrf_score` (descending order) | `claudeknows search "authentication architecture" --json \| jq '.[0].mode_used'` equals `"hybrid"`; `claudeknows search "authentication architecture" --mode hybrid --json \| jq '.[0].mode_used'` equals `"hybrid"` |
| TC-VR-6.4 | UC-VR-2 primary | RRF correctness golden test: 3 known input rankings produce exact expected fusion output | positive | UC-VR-2, FR-VR-6.2, FR-VR-6.5, AC-VR-6 | `cargo test --test rrf_test -p sdlc-knowledge` exits 0; the test provides 3 pre-computed input rank lists (with known chunk IDs at known positions) and asserts the RRF output matches the hand-computed expected ranking using `score(d) = 1/(60+rank_BM25) + 1/(60+rank_dense)` | `cargo test --test rrf_test -p sdlc-knowledge` |
| TC-VR-6.5 | UC-VR-2 primary | JSON output includes all four required fields: `mode_used`, `bm25_score`, `dense_score`, `rrf_score` across all three modes | positive | UC-VR-2, FR-VR-6.4 | For each mode: JSON array elements contain all four fields; `mode_used` matches the requested mode; for lexical mode `dense_score` and `rrf_score` may be null; for dense mode `bm25_score` and `rrf_score` may be null; for hybrid all four are non-null | `claudeknows search "test" --mode hybrid --json \| jq '.[0] \| has("mode_used") and has("bm25_score") and has("dense_score") and has("rrf_score")'` returns `true` |
| TC-VR-6.6 | UC-VR-2 primary | Hybrid p95 latency < 500 ms over 30 fixed queries on 51K-chunk corpus on 2024 MacBook M1 reference machine | positive | UC-VR-2, FR-VR-6.7, NFR-VR-2 | Running 30 hybrid queries from a fixed query list, the 95th-percentile wall-clock latency per query is < 500 ms on the reference machine | `cargo test --test search_modes_test -p sdlc-knowledge -- --test-filter hybrid_p95_latency` (reference machine only) |
| TC-VR-6.7 | UC-VR-3, UC-VR-3-A1 | Cross-lingual: Russian query `"аутентификация архитектура"` against English-only corpus returns ≥1 hit in dense and hybrid modes; returns 0 hits in lexical mode (BM25) | positive | UC-VR-3, FR-VR-6.1, FR-VR-6.2 | `claudeknows search "аутентификация архитектура" --mode lexical --json \| jq 'length'` returns `0`; `claudeknows search "аутентификация архитектура" --mode dense --json \| jq 'length'` returns ≥ 1; `claudeknows search "аутентификация архитектура" --mode hybrid --json \| jq 'length'` returns ≥ 1 | `cargo test --test search_modes_test -p sdlc-knowledge -- --test-filter cross_lingual_russian_query` |

---

## 7. Benchmark Harness

*Covers: FR-VR-7.1, FR-VR-7.2, FR-VR-7.3, FR-VR-7.4, FR-VR-7.5; AC-VR-8; UC-VR-6*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-7.1 | UC-VR-6 primary, UC-VR-6-A1, UC-VR-6-E1 | `cargo run --bin claudeknows-bench` produces a Markdown report; single-mode run works; missing queries.jsonl exits 1 | positive/negative | UC-VR-6, FR-VR-7.1, AC-VR-8 | (a) Full run: `test -f tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md && echo EXISTS` prints `EXISTS`; (b) Single-mode: `--modes lexical` produces a partial report; (c) Missing path: exits 1 with error identifying the missing file | `test -f tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md && echo EXISTS` |
| TC-VR-7.2 | UC-VR-6 primary, UC-VR-6-EC1 | Metric implementations verified on synthetic gold standard: perfect ranking → Recall@1 = 1.0, MRR = 1.0; all-empty relevance judgments → no panic | positive/edge | UC-VR-6, UC-VR-6-EC1, FR-VR-7.3 | `cargo test --bin claudeknows-bench -p sdlc-knowledge -- --test-filter metrics_perfect_ranking` exits 0 with Recall@1 == 1.0 and MRR == 1.0; `cargo test ... --test-filter metrics_empty_judgments` exits 0 with 0.0 for all metrics | `cargo test --bin claudeknows-bench -p sdlc-knowledge -- --test-filter metrics_perfect_ranking` |
| TC-VR-7.3 | UC-VR-6 primary, UC-VR-6-E2 | 25 golden queries cover all 4 categories (keyword, nl, cross, paraphrase); malformed query in JSONL is skipped with a warning | positive/negative | UC-VR-6, UC-VR-6-E2, FR-VR-7.2 | `jq '[.category] \| unique \| sort' tools/sdlc-knowledge/bench/golden/queries.jsonl` contains `["cross","keyword","nl","paraphrase"]`; `jq 'length' < queries.jsonl` ≥ 25; malformed-query test: harness skips the malformed entry and continues | `jq -s '[.[].category] \| unique \| sort' tools/sdlc-knowledge/bench/golden/queries.jsonl` returns all 4 category values |
| TC-VR-7.4 | UC-VR-6 primary | Committed benchmark report `2026-05-09-vector-vs-bm25.md` contains all required sections | positive | UC-VR-6, FR-VR-7.4, AC-VR-8 | `grep -c "## Methodology\|## Dataset\|## Metrics\|## Latency\|## Qualitative\|## Failure\|## Recommendations" tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` returns ≥ 7; metric tables are non-empty (at least 25 query rows) | `grep -c "## Methodology\|## Dataset\|## Metrics\|## Latency\|## Qualitative\|## Failure\|## Recommendations" tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` |

---

## 8. Install Scripts + Rule Updates

*Covers: FR-VR-8.1, FR-VR-8.2, FR-VR-8.3, FR-VR-8.4, FR-VR-8.5; AC-VR-9, AC-VR-10; UC-VR-7*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-8.1 | UC-VR-7 primary, UC-VR-7-A1 | Fresh `bash install.sh --yes` downloads e5-small, PaddleOCR, and docling model bundles; all three model directories exist after install; model download failure is non-fatal (exit 0 with warning) | positive/negative | UC-VR-7, FR-VR-8.1, FR-VR-8.2 | (a) Success: `test -d ~/.claude/tools/sdlc-knowledge/models/e5-small && test -d ~/.claude/tools/sdlc-knowledge/models/paddleocr && test -d ~/.claude/tools/sdlc-knowledge/models/docling && echo ALL_PRESENT` prints `ALL_PRESENT`; (b) Network failure: install exits 0 with warning substring in stderr | `test -d ~/.claude/tools/sdlc-knowledge/models/e5-small && test -d ~/.claude/tools/sdlc-knowledge/models/paddleocr && test -d ~/.claude/tools/sdlc-knowledge/models/docling && echo ALL_PRESENT` |
| TC-VR-8.2 | UC-VR-7 primary | sha256 sidecar verification rejects tampered model archives at install time | security | UC-VR-7, FR-VR-8.1, TC-VR-SEC.3 | When a model archive's sha256 does not match its sidecar, `install.sh` prints an error and skips extraction; no partial model files are left in the target directory | `bash install.sh --yes` with a tampered archive exits non-zero or skips the tampered model with error in stderr; the model directory either does not exist or is empty |
| TC-VR-8.3 | AC-VR-9 | After fresh `bash install.sh --yes`, `grep -rF "NOT a vector database" ~/.claude/rules/` returns zero matches | positive | FR-VR-8.3, AC-VR-9 | `grep -rF "NOT a vector database" ~/.claude/rules/` exits non-zero (no matches); the deprecated assertion is completely removed | `grep -rF "NOT a vector database" ~/.claude/rules/` returns no output |
| TC-VR-8.4 | AC-VR-10 | After fresh install, `~/.claude/rules/knowledge-base.md` contains at least one line matching `hybrid`, `RRF`, and `sqlite-vec` respectively | positive | FR-VR-8.4, AC-VR-10 | `grep -E "hybrid" ~/.claude/rules/knowledge-base.md \| wc -l` ≥ 1; `grep -E "RRF" ~/.claude/rules/knowledge-base.md \| wc -l` ≥ 1; `grep -E "sqlite-vec" ~/.claude/rules/knowledge-base.md \| wc -l` ≥ 1 | `grep -E "hybrid\|RRF\|sqlite-vec" ~/.claude/rules/knowledge-base.md \| wc -l` returns ≥ 3 |
| TC-VR-8.5 | UC-VR-CC-1 | `claudeknows --version` reports `0.3.1` during development (version bump to 0.4.0 deferred to `/release` after merge) | positive | UC-VR-CC-1, PRD §15.7 Out of Scope item 4 | `claudeknows --version` exits 0; output contains `0.3.1` | `claudeknows --version \| grep "0.3.1"` |

---

## 9. Security Tests

*Covers architect-flagged slices: Slice 5 (path traversal), Slice 6 (PNG bomb), Slice 11 (supply-chain); TC-VR-SEC.1 through TC-VR-SEC.3*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-SEC.1 | Slice 5 path traversal | Symlink-escape attempt in model directory: `~/.claude/tools/sdlc-knowledge/models/e5-small/` set up with a symlink pointing outside the expected canonical path → encoder load rejects with canonical-path mismatch error; no path traversal | security | FR-VR-4.1, NFR-VR-5 | `Encoder::new()` returns `Err` when the resolved model path does not match the expected canonical prefix `~/.claude/tools/sdlc-knowledge/models/`; no file outside that directory is read | `cargo test --test encoder_test -p sdlc-knowledge -- --test-filter model_path_traversal_rejected` |
| TC-VR-SEC.2 | UC-VR-EC-1, Slice 6 PNG bomb | PNG image decoded to > 50 MB pixels → OCR subsystem rejects it with a logged warning; ingest continues for all other chunks | security | FR-VR-5.1, NFR-VR-3 | The large PNG is detected before or during decode; a warning is emitted to stderr; the image chunk receives placeholder text `[image: figure N from <doc-basename>]`; process does not OOM or panic; no chunk is silently dropped | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter png_bomb_rejection` (identical to TC-VR-5.5) |
| TC-VR-SEC.3 | UC-VR-7 primary, Slice 11 supply-chain | Tampered model archive (sha256 mismatch) → `install.sh` rejects at install time; no extraction; no half-installed model state | security | FR-VR-8.1 | `bash install.sh --yes` (with a tampered model archive) exits with non-zero exit code or skips the archive with an error; the target model directory does NOT contain any extracted files from the tampered archive; original (or no) model state is preserved | `bash install.sh --yes` with a tampered e5-small tar.gz; `test ! -f ~/.claude/tools/sdlc-knowledge/models/e5-small/model.onnx` exits 0 |

---

## 10. Edge Cases

*Covers: UC-VR-EC-1 through UC-VR-EC-5; NFR-VR-2, NFR-VR-3; TC-VR-EC.1 through TC-VR-EC.5*

| # | Use Case | Test Case | Type | UC / FR | Expected Result | Verification Command |
|---|----------|-----------|------|---------|-----------------|----------------------|
| TC-VR-EC.1 | UC-VR-EC-1 | PDF with 100 figures → ingest completes; DB file size growth measured; no panic or OOM | edge | UC-VR-EC-1, NFR-VR-3 | Ingest exits 0; `claudeknows status --json` shows ≥ 100 `type='image'` rows; DB file size recorded and documented (expected: ~4 MB BLOB overhead per 50-page/20-figure PDF per plan.md Assumption); `chunks_vec` count equals `chunks` count | `claudeknows ingest <100-figure-pdf>` exits 0; `ls -la ~/.claude/knowledge/index.db` |
| TC-VR-EC.2 | UC-VR-EC-2 | Chinese PDF with only EN/RU PaddleOCR model → OCR returns empty or garbled → placeholder text applied; dense path still has a vector for the chunk | edge | UC-VR-EC-2, FR-VR-5.2, FR-VR-5.3 | Image chunks from the Chinese PDF have `text LIKE '[image: figure % from %]'`; those chunks exist in `chunks_vec` with a valid 384-dim embedding; ingest exits 0 | `cargo test --test ocr_test -p sdlc-knowledge -- --test-filter chinese_figure_placeholder` (identical to TC-VR-5.6) |
| TC-VR-EC.3 | UC-VR-EC-3, UC-VR-3-EC1 | Mixed RU+EN query `"RAG архитектура"` → both language tokens tokenized by e5-small; hybrid mode surfaces relevant chunks in both languages | edge | UC-VR-EC-3, FR-VR-6.1, FR-VR-6.2 | `claudeknows search "RAG архитектура" --mode hybrid --json` returns ≥ 1 result; no panic or encoding error; if corpus contains both RU and EN documents about RAG, results may include chunks from both; `mode_used: "hybrid"` in all results | `claudeknows search "RAG архитектура" --mode hybrid --json \| jq 'length'` ≥ 1 and exits 0 |
| TC-VR-EC.4 | UC-VR-EC-4, UC-VR-2-EC1, UC-VR-2-EC2 | `--top-k 1000` with hybrid mode → no panic; result count ≤ 1000; empty query string → no panic | edge | UC-VR-EC-4, NFR-VR-2 | `claudeknows search "machine learning" --mode hybrid --top-k 1000 --json` exits 0; `jq 'length'` ≤ 1000; `claudeknows search "" --mode hybrid --json` exits 0 (or exits with usage error — must not panic or segfault) | `claudeknows search "machine learning" --mode hybrid --top-k 1000 --json \| jq 'length'` exits 0; `claudeknows search "" --json` exits 0 or 1 without panic |
| TC-VR-EC.5 | UC-VR-EC-5 | Full 40-PDF books corpus ingest → wall-clock time recorded; no panic; `chunks_vec` row count equals `chunks` row count; completion within 15 minutes | edge | UC-VR-EC-5, NFR-VR-3, AC-VR-17 | `time claudeknows ingest /Users/aleksandra/Documents/claude-code-sdlc/books/` exits 0; wall-clock time ≤ 900 seconds on M1/M2 MacBook; `claudeknows status --json` shows `doc_count ≥ 40`, `chunk_count ≥ 51542`; `chunks_vec` count == `chunks` count | `time claudeknows ingest /Users/aleksandra/Documents/claude-code-sdlc/books/` exits 0; `sqlite3 ~/.claude/knowledge/index.db "SELECT (SELECT COUNT(*) FROM chunks) = (SELECT COUNT(*) FROM chunks_vec)"` returns `1` |

---

## 11. Invariant Tests

*Tests that verify cross-cutting invariants that must hold regardless of which slice caused a regression.*

| # | Invariant | Test Case | Type | Expected Result | Verification Command |
|---|-----------|-----------|------|-----------------|----------------------|
| TC-VR-INV.1 | Single-file invariant (NFR-VR-4) | No co-located figure files or vector store files exist outside `index.db` after ingest | positive | After ingest of a PDF with figures: `ls ~/.claude/knowledge/` shows only `index.db`; no `.png`, `.onnx`, `.vec`, or `.npy` files | `ls ~/.claude/knowledge/ \| grep -v "^index.db$"` returns no output |
| TC-VR-INV.2 | Zero-Python invariant (NFR-VR-5) | No Python process is spawned during `claudeknows ingest` or `claudeknows search` | positive | `claudeknows ingest <pdf>` completes without forking any `python` or `python3` process | `strace -e trace=execve claudeknows ingest <pdf> 2>&1 \| grep -E "python[23]?"` returns no output (Linux); or `sudo dtruss -n claudeknows ingest <pdf> 2>&1 \| grep -i python` (macOS) |
| TC-VR-INV.3 | Binary size (NFR-VR-1) | The compiled `claudeknows` binary remains below 10 MB | positive | `ls -la ~/.claude/tools/sdlc-knowledge/sdlc-knowledge \| awk '{print $5}'` returns a value < 10 485 760 (10 × 1024 × 1024 bytes) | `ls -la ~/.claude/tools/sdlc-knowledge/sdlc-knowledge \| awk '{print ($5 < 10485760) ? "OK" : "FAIL"}'` returns `OK` |
| TC-VR-INV.4 | Model footprint (NFR-VR-6) | Total model bundle size at install time does not exceed ~250 MB (architect revised estimate) | positive | `du -sh ~/.claude/tools/sdlc-knowledge/models/` output is ≤ 300 MB (10% tolerance over 250 MB architect estimate) | `du -sk ~/.claude/tools/sdlc-knowledge/models/ \| awk '{print ($1 < 307200) ? "OK" : "FAIL"}'` returns `OK` |
| TC-VR-INV.5 | Agent prompt files unchanged (NFR-VR-7) | No agent prompt files are modified by the feature branch | positive | `git diff main -- src/agents/*.md` returns empty; 17 agent files unchanged | `git diff main -- src/agents/*.md \| wc -l` returns `0` |
| TC-VR-INV.6 | Lexical mode backward compat (NFR-VR-8) | `--mode lexical` with all models absent produces identical results to iter-1 (v0.3.x) BM25 search on the same corpus | positive | With model files removed, `claudeknows search "authentication" --mode lexical --json` returns the same top-3 chunk IDs as the v0.3.x baseline (captured in a golden fixture) | `cargo test --test search_modes_test -p sdlc-knowledge -- --test-filter lexical_backward_compat` |

---

## 12. NFR Coverage

*Non-functional requirements that are not fully captured by functional TCs above.*

| NFR | Requirement | Covered By |
|-----|-------------|------------|
| NFR-VR-1 | Binary < 10 MB | TC-VR-INV.3 |
| NFR-VR-2 | Hybrid p95 < 500ms on M1 / 51K-chunk corpus | TC-VR-6.6 |
| NFR-VR-3 | 40-PDF re-ingest < 15 min on CPU | TC-VR-EC.5 |
| NFR-VR-4 | Single-file invariant — no files outside index.db | TC-VR-INV.1 |
| NFR-VR-5 | Zero Python dependencies | TC-VR-INV.2 |
| NFR-VR-6 | Model footprint ≤ ~250 MB | TC-VR-INV.4 |
| NFR-VR-7 | Agent prompt files unchanged | TC-VR-INV.5 |
| NFR-VR-8 | Lexical mode backward compat with models absent | TC-VR-4.5, TC-VR-INV.6 |
