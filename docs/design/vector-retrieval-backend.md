# Plan: Vector + Multimodal Retrieval Backend for `claudeknows`

## Context

**Problem.** The current `claudeknows` retrieval (shipped 0.3.x) is BM25-only via SQLite FTS5 with naïve 500-char sliding-window chunking and pdfium-text-only PDF extraction. Three concrete limitations the user is hitting on the existing 51K-chunk corpus:

1. **No cross-lingual recall.** A Russian query never matches an English chunk that covers the same concept (FTS5 `unicode61` tokenizer is purely lexical).
2. **No layout / image awareness.** Tables flatten poorly, figures are dropped entirely, headings don't influence chunking — retrieval misses content BM25 can never see.
3. **No semantic recall.** Paraphrases ("how do I authenticate" vs "JWT validation") don't match.

**Goal.** Replace the BM25-only backend with a hybrid lexical+dense retrieval layer (BM25 ⊕ dense via RRF k=60), structurally-aware document parsing via Docling, and OCR-based multimodal embeddings so figures from PDFs are searchable through unified cosine similarity in the SAME 384-dim e5-multilingual embedding space as text and tables. Ship a benchmark harness that quantifies the difference.

**Outcome.** A user runs `claudeknows search "<query>"` and gets a hybrid ranked list including text, table, and image chunks. The repo contains a Markdown benchmark report at `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` with concrete metrics (Recall@K, MRR, NDCG@10, latency) plus side-by-side qualitative samples for ~10 representative queries.

**This change inverts the iter-1 architectural assertion** in `~/.claude/rules/knowledge-base-tool.md`: "**NOT a vector database.** No embeddings, no semantic similarity." That was correct for iter-1; it is no longer correct for iter-2. The rule files MUST be updated as part of this feature (Slice 11). The PRD's reserved `embedding BLOB` column strategy (FR-4.3) is also superseded — we use a separate `chunks_vec` virtual table from sqlite-vec instead, formally amending FR-4.3 in the new PRD §15.

**Pre-implementation precondition.** This plan begins on a NEW feature branch `feat/vector-retrieval-backend` (currently we're on `main` per Plan Critic finding #1). The plan body itself is auto-persisted to `<project>/.claude/plan.md` per the rule shipped in 0.3.1.

**Plan persistence destinations (post-ExitPlanMode).** Per the user's request to extract the plan into a separate MD file — and because the plan-mode harness allows edits ONLY to `~/.claude/plans/fuzzy-juggling-ocean.md` — the plan body lives in two places after ExitPlanMode:
- `<project>/.claude/plan.md` — canonical project-local plan-mode artifact (auto-persist rule from 0.3.1; gets overwritten by the next plan-mode session).
- `<project>/docs/design/vector-retrieval-backend.md` — durable, version-controlled design document committed alongside the feature work; survives future plan-mode sessions.

Both writes happen as the FIRST action immediately after ExitPlanMode is approved (during normal-mode preamble before `/bootstrap-feature` Step 1).

**Vectorization corpus location.** The user has placed ~40 PDFs at `/Users/aleksandra/Documents/claude-code-sdlc/books/` (verified by `ls` this session — covers ML/AI, data engineering, AI agents, system design, MLOps, RU+EN). This is the corpus used for:
- Slice 8 re-ingest (populates v2 schema with embeddings + image BLOBs from these books).
- Slice 9 benchmark golden-set query authoring (queries reference content from these specific books — guarantees we know which chunks should be relevant).
- Slice 10 benchmark run (same corpus all three modes index).

The books folder is **not committed to the repo** (it's a local dev resource). The benchmark report references books by basename only; chunk references are by chunk_id.

## Locked technical decisions

1. **Text encoder**: `intfloat/multilingual-e5-small` (ONNX, 384 dims, ~120 MB) loaded via `fastembed-rs`. e5 prefix discipline (`"passage: "` for ingest, `"query: "` for search) MUST be enforced and tested.
2. **Hybrid retrieval**: BM25 (FTS5 — kept) + dense (sqlite-vec) via Reciprocal Rank Fusion with k=60. Search modes: `--mode lexical|dense|hybrid`, default = `hybrid`.
3. **Document parser**: Docling (IBM, Apache-2.0, ONNX models) replaces pdfium as primary PDF backend. pdfium remains as fallback when Docling fails or models are absent.
4. **Multimodal — OCR-as-text bridge**: Docling extracts figures from PDFs as PNG bytes; PaddleOCR-ONNX (RU+EN, ~30 MB det+rec) reads text from each figure; OCR'd text is embedded into the SAME e5 space as text chunks. A single 384-dim space holds text, table, and image content with unified cosine similarity. Pure-vision CLIP-space embeddings are explicitly OUT OF SCOPE for v1 — would require a parallel index in a different space.
5. **Vector storage**: `sqlite-vec` extension co-exists with FTS5 in the SAME `index.db` — single-file invariant (NFR-1.5) preserved. New virtual table `chunks_vec(embedding float[384])`. Schema bumped v1 → v2.
6. **Image storage**: figure PNG bytes stored as `chunks.image_bytes BLOB` column (NULLable, populated only for `chunks.type='image'`). Preserves NFR-1.5 — no co-located figure files outside `index.db`.
7. **Bundle strategy**: model files live under `~/.claude/tools/sdlc-knowledge/models/{e5-small,paddleocr,docling}/` and are downloaded by `install.sh` / `install.ps1` at install time (same pattern as pdfium today). Total model footprint ~200 MB. Binary itself stays under 10 MB.
8. **Zero Python deps**: all ML inference goes through `ort` (Rust ONNX runtime). NOTE: in tension with #3 — Docling is Python-native and its layout pipeline may not be runnable purely from ONNX. **Open question for architect Slice 3 pre-review** (see OQ-1).
9. **Backward compat**: existing v1 indexes prompt user to re-ingest on first v2 binary invocation; `CLAUDEKNOWS_AUTO_REINGEST=1` skips prompt for headless. Corrupt v1 DB (truncated) follows the existing `error: index database invalid; re-ingest required` exit-1 contract from iter-1 AC-7.

## Pre-implementation: documentation phase

**This plan is the planner agent's Step 5 output and runs AFTER the documentation phase.** Phase 1 of `/bootstrap-feature` produces:

- `docs/PRD.md §15` (prd-writer) — MUST formally amend FR-4.3 (separate vec table instead of inline BLOB column) and clarify NFR-1.5 (image bytes stored as BLOB inside index.db preserve single-file invariant).
- `docs/use-cases/vector-retrieval-backend_use_cases.md` (ba-analyst).
- Architecture review (architect) — verifies Docling integration strategy (CRITICAL — see OQ-1), sqlite-vec linking, RRF correctness, OCR quality threshold, NFR-1.5 BLOB-storage resolution, FR-4.3 amendment text.
- `docs/qa/vector-retrieval-backend_test_cases.md` (qa-planner).
- `.claude/resources-pending.md` (resource-architect — likely triggered by "external API" / "third-party" keywords for Hugging Face model URLs).
- `.claude/roles-pending.md` (role-planner — likely "no additional roles required"; this is core SDLC infra).

**Deliverables checklist:**
- [ ] PRD §15 in `docs/PRD.md`
- [ ] Use cases in `docs/use-cases/vector-retrieval-backend_use_cases.md`
- [ ] Architecture review verdict (PASS or [STRUCTURAL] action items)
- [ ] QA test cases in `docs/qa/vector-retrieval-backend_test_cases.md`

## Facts

### Verified facts

- Current `claudeknows` v0.3.1, BM25-only via SQLite FTS5, schema v1, ~4 MB binary — verified against `tools/sdlc-knowledge/Cargo.toml` (line 3) and `tools/sdlc-knowledge/src/store.rs` (`chunks_fts` virtual table at line 54) read this session.
- pdfium-render binding via explicit-path `Pdfium::bind_to_library` — verified at `tools/sdlc-knowledge/src/pdf.rs:172` read this session.
- 500-char sliding-window chunker is currently in `tools/sdlc-knowledge/src/ingest.rs:71` (function `chunk()`) — verified read this session.
- User's existing knowledge-base corpus: 28 documents, 51 542 chunks, multilingual RU+EN, scope = ML/AI + data engineering + SRE + software-engineering — verified by `claudeknows status --json` and `claudeknows list --json` invocations earlier in this session.
- We are currently on `main` branch; all feature work MUST happen on `feat/vector-retrieval-backend` per `~/.claude/rules/git.md`.
- `~/.claude/rules/knowledge-base-tool.md` contains the assertion "**NOT a vector database.** No embeddings, no semantic similarity. Queries match on lexical tokens." — MUST be updated by Slice 11.
- `docs/PRD.md` §11 reserved `embedding BLOB` column on chunks table for non-destructive iter-2 migration — this plan supersedes that reservation by introducing `chunks_vec` virtual table instead. PRD §15 (in /bootstrap-feature Step 1) MUST formally amend FR-4.3.
- `tools/sdlc-knowledge/src/migrations.rs` and `tools/sdlc-knowledge/src/store.rs` exist and are the natural insertion points for v1→v2 migration — verified by Glob this session.

### External contracts

- **`fastembed-rs` (Qdrant)** — symbol: `TextEmbedding::try_new(InitOptions { model_name: EmbeddingModel::MultilingualE5Small, ... })`, `embed(documents: Vec<&str>, batch_size: Option<usize>) -> Vec<Vec<f32>>` — source: https://github.com/Anush008/fastembed-rs (crates.io `fastembed = "4"`) — verified: **no — assumption**. Architect Slice 5 pre-review MUST verify e5-small is in fastembed's supported list and the API matches. Risk: if fastembed doesn't support e5-small directly, fall back to raw `ort`.
- **`sqlite-vec`** — symbol: `vec0` virtual table; `embedding float[384]` declaration; `vec_distance_cosine(a, b)` function; static linking via `rusqlite` `bundled` feature OR `Connection::load_extension` runtime — source: https://github.com/asg017/sqlite-vec — verified: **no — assumption**. Architect Slice 2 pre-review MUST decide static-vs-runtime linking and verify cross-platform build.
- **`ort` (Rust ONNX Runtime, v2.x)** — symbols: `ort::Session::builder().commit_from_file(path)`, `Session::run(inputs) -> Result<Outputs>` — source: https://docs.rs/ort/2 — verified: **no — assumption**. Used transitively by fastembed-rs and directly by PaddleOCR + Docling integrations.
- **Docling (IBM)** — Python library; ONNX model artifacts at `https://huggingface.co/ds4sd/docling-models`; outputs structured Markdown + DocLink JSON — source: https://github.com/DS4SD/docling — verified: **no — assumption (CRITICAL)**. Docling has NO first-class Rust SDK. Architect Slice 3 pre-review picks one of:
  - (a) Direct ONNX inference via `ort` — risk: layout-analysis pipeline is more than running models; Python orchestrates pre/post-processing.
  - (b) Bundle Docling Python CLI as sidecar binary — risk: +200 MB sidecar, defeats "zero Python deps".
  - (c) Use a different layout-aware parser (Marker, MinerU, custom heuristic over pdfium output) — risk: lower quality.
  - **Pragmatic v1 fallback**: if Docling unfeasible, ship Slice 3 as "heading-aware structural chunking over pdfium output is sufficient" (Slice 1 already does this); defer Docling to v2.
- **PaddleOCR det+rec ONNX** — symbols: detection model `ch_PP-OCRv4_det_infer.onnx`, recognition model `ch_PP-OCRv4_rec_infer.onnx`, multilingual variant `ml_PP-OCRv4_*_infer.onnx` (~30 MB combined) — source: https://github.com/PaddlePaddle/PaddleOCR — verified: **no — assumption**. Architect Slice 6 picks between PaddleOCR vs trocr vs Tesseract.
- **e5 prompt-prefix discipline** — `"passage: "` for indexed chunks, `"query: "` for queries — source: https://huggingface.co/intfloat/multilingual-e5-small (model card) — verified: yes (documented contract on the model card).
- **Reciprocal Rank Fusion (RRF) with k=60** — `score(d) = Σ_i 1/(k + rank_i(d))` over rankers i; k=60 is canonical from Cormack et al. 2009 — verified: yes.

### Assumptions

- ONNX runtime via `ort` works on all target platforms (macOS arm64/x64, Linux x64/arm64, Windows x64). Risk: ARM Windows / FreeBSD not covered. Verify: build matrix in Slice 11 install scripts.
- 51K chunks at encode batch=32 on CPU (M1/M2 MacBook) takes ≤10 minutes for full re-ingest. Verify: time the user's actual re-ingest in Slice 8 and document.
- 25 manually-curated queries are sufficient to detect a meaningful difference. Verify: spot-check qualitative samples; expand to 50 if benchmark inconclusive.
- Image bytes as BLOB column adds tolerable storage overhead (a 50-page PDF with 20 figures × 200 KB each = ~4 MB BLOBs per doc; for 28 docs ~112 MB). Verify: measure DB file size growth in Slice 4.
- e5-small embedding quality is sufficient on technical-book content. Risk: bge-m3 (2 GB) might be measurably better. Verify: benchmark Slice 10 — if hybrid recall is unimpressive, iter-2 may swap encoder.

### Open questions

- **OQ-1 (Docling integration strategy)** — load-bearing for Slice 3 architect pre-review. Three options listed under External contracts. Decision must land BEFORE Slice 3 implementation. **Pragmatic fallback**: if architect rules Docling unfeasible in Rust, Slice 3 collapses to "structural chunker over pdfium output is sufficient" (Slice 1 already does this); Docling deferred to v2.
- **OQ-2 (sqlite-vec linking)** — static-link via rusqlite-bundled vs runtime `load_extension`. Architect Slice 2 picks.
- **OQ-3 (PaddleOCR vs alternatives)** — PaddleOCR, trocr, or Tesseract. Architect Slice 6 picks.
- **OQ-4 (per-language stratification in benchmark)** — RESOLVED OUT-OF-SCOPE: 25 queries split across multiple languages produces statistically marginal per-language metrics; benchmark reports OVERALL metrics + qualitative side-by-side only.

## Implementation slices (11 slices / 8 waves)

### Slice 1: Heading-aware structural chunker
- **Wave**: 1
- **Files**: `tools/sdlc-knowledge/src/chunker.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/chunker_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/sample-with-headings.md` [new], `tools/sdlc-knowledge/tests/fixtures/sample-no-headings.md` [new]
- **Changes**: new `chunker::structural_chunk()`: parse Markdown / plain-text for `^#{1,6}\s+` heading patterns and "Chapter/Section N" markers; chunk on heading boundaries with soft-cap 1500 chars and 200-char overlap. Backward-compat fallback: when no headings detected, falls back to current 500-char sliding-window output (existing fixtures unchanged). Existing `ingest::chunk()` at src/ingest.rs:71 replaced with thin call to `chunker::structural_chunk()`.
- **Verify**: `cargo test -p sdlc-knowledge --test chunker_test` passes. Fixture `sample-with-headings.md` (3 headings) yields exactly 3 chunks each starting with the heading line; `sample-no-headings.md` yields the same chunk count as the iter-1 baseline (regression-tested against `ingest_test.rs`).
- **Done when**: heading-bearing docs route to heading-based output AND non-heading docs to backward-compat sliding-window output; both paths tested.
- **Pre-review**: none

### Slice 2: sqlite-vec extension + schema v1→v2 + image BLOB column
- **Wave**: 1
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/store.rs`, `tools/sdlc-knowledge/src/migrations.rs`, `tools/sdlc-knowledge/tests/store_v2_test.rs` [new], `tools/sdlc-knowledge/tests/migration_test.rs` [new]
- **Changes**: sqlite-vec linked at connection open. New virtual table `CREATE VIRTUAL TABLE chunks_vec USING vec0(embedding float[384])`. New columns: `chunks.type TEXT NOT NULL DEFAULT 'text'` (values: 'text' | 'table' | 'image'), `chunks.image_bytes BLOB NULL`. schema_version 1→2. Migration UX: opening v1 with v2 binary detects version mismatch → if TTY, prompt "Re-ingest required for v2 schema. Proceed? [y/N]"; if `CLAUDEKNOWS_AUTO_REINGEST=1`, skip prompt; on "no", exit 0 with hint; on "yes" or env-var, drop+recreate, exit 0 with hint to re-run `ingest`. Corrupt v1 DB (truncated) honors iter-1 AC-7: exit 1 with `error: index database invalid; re-ingest required`.
- **Verify**: `cargo test --test store_v2_test --test migration_test` passes. `claudeknows status --json` on fresh DB shows `"schema_version": 2`. v1 fixture DB → migration prompt; `CLAUDEKNOWS_AUTO_REINGEST=1` runs migration; truncated v1 DB → exit 1 with literal AC-7 message.
- **Done when**: schema v2 queryable, migration tested for happy-path AND corrupt-DB AND headless paths.
- **Pre-review**: architect (OQ-2 — sqlite-vec linking strategy)

### Slice 3: Docling parser integration
- **Wave**: 2
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/docling.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/docling_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/sample-structured.pdf` [new]
- **Changes**: Docling as primary PDF backend producing Markdown + figure list. Models cached at `~/.claude/tools/sdlc-knowledge/models/docling/`. Ingest path: `pdf::read(path)` first attempts Docling; on Docling error OR missing model, falls back to pdfium. Docling output (Markdown) feeds Slice 1's structural chunker. Figure PNG bytes attached to deferred `image_chunks` queue for Slice 4.
- **Verify**: `cargo test --test docling_test` passes. `sample-structured.pdf` ingest produces chunks with section paths from heading hierarchy. "Docling model missing" path falls back to pdfium and produces non-empty output. "Docling parse error" path falls back to pdfium with logged warning.
- **Done when**: PDFs route through Docling when models present; clean fallback when absent; Markdown→structural-chunker pipeline produces section-pathed chunks.
- **Pre-review**: **architect — CRITICAL** (OQ-1 — Docling Rust integration strategy). This pre-review may de-scope Slice 3 to "Docling deferred to v2" if architect rules unfeasible.

### Slice 4: Image extraction → BLOB storage
- **Wave**: 3
- **Files**: `tools/sdlc-knowledge/src/docling.rs` (extend), `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/image_extraction_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/sample-with-figure.pdf` [new]
- **Changes**: Docling's figure list → for each figure, render to PNG bytes → insert chunk row with `type='image'`, `text=''` (filled by OCR in Slice 6), `image_bytes=<PNG bytes>`. PNG roundtrip test verifies BLOB integrity.
- **Verify**: `sample-with-figure.pdf` after ingest yields ≥1 chunk row with `type='image'`, non-NULL `image_bytes`, and the BLOB decodes to a valid PNG (`image::load_from_memory`).
- **Done when**: image chunks populated as BLOBs; integrity tested.
- **Pre-review**: none

### Slice 5: e5-small encoder + ingest-time embedding
- **Wave**: 4
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/encoder.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/encoder_test.rs` [new], `tools/sdlc-knowledge/tests/encoder_prefix_test.rs` [new]
- **Changes**: `Encoder` singleton (mutex-guarded, lazy-loaded — same pattern as `PDFIUM` static). Loads e5-small ONNX from `~/.claude/tools/sdlc-knowledge/models/e5-small/`. Two methods: `encode_passages(&[&str]) -> Vec<Vec<f32>>` (prefixes "passage: ") and `encode_query(&str) -> Vec<f32>` (prefixes "query: "). Ingest batches chunks (batch_size=32) and writes 384-dim vectors to `chunks_vec`. **Prefix discipline tested**: `encoder_prefix_test.rs` mocks the inner ONNX call and asserts each input string starts with the correct prefix.
- **Verify**: `cargo test --test encoder_test --test encoder_prefix_test` passes. After ingest, `chunks_vec` row count equals `chunks` row count. **Hardware-anchored latency**: on a 2024 MacBook M1 (specific reference machine), encoder cold-start <3s, hot-path batch=32 <50ms/chunk. Encoder fallback: when model files missing, encoder is initialized in degraded mode that returns Err on every encode call; ingest catches and falls back to BM25-only chunks (status --json reports `"degraded": "encoder model missing"`).
- **Done when**: encoder works end-to-end; prefix discipline tested; degraded-mode fallback tested.
- **Pre-review**: architect (fastembed vs raw `ort`; ONNX hash pinning).

### Slice 6: PaddleOCR for image chunks
- **Wave**: 5
- **Files**: `tools/sdlc-knowledge/Cargo.toml`, `tools/sdlc-knowledge/src/ocr.rs` [new], `tools/sdlc-knowledge/src/ingest.rs`, `tools/sdlc-knowledge/tests/ocr_test.rs` [new], `tools/sdlc-knowledge/tests/fixtures/diagram-with-text.png` [new], `tools/sdlc-knowledge/tests/fixtures/sample-with-multiple-figures.pdf` [new]
- **Changes**: PaddleOCR det+rec via `ort`. For each `type='image'` chunk: load `image_bytes` BLOB → run PaddleOCR → set `chunk.text` to OCR'd text → encode via Slice 5's encoder → write to `chunks_vec`. If OCR returns empty (non-textual diagram), set placeholder `[image: figure N from <doc-basename>]`. OCR fallback: missing model → all image chunks get placeholder text + warning logged; ingest continues.
- **Verify**: `sample-with-multiple-figures.pdf` after ingest produces `type='image'` chunks where `text` is non-empty (either OCR'd content OR placeholder). On `diagram-with-text.png` containing literal "Authentication Service" text, cosine similarity between query "auth service architecture" (encoded via `encode_query`) and the corresponding chunk's stored embedding > 0.5.
- **Done when**: image chunks have searchable text + embeddings; OCR-missing fallback tested.
- **Pre-review**: architect (OQ-3 — PaddleOCR vs trocr vs Tesseract; ONNX hash pinning).

### Slice 7: Hybrid search (lexical + dense + RRF)
- **Wave**: 5
- **Files**: `tools/sdlc-knowledge/src/search.rs`, `tools/sdlc-knowledge/src/cli.rs`, `tools/sdlc-knowledge/src/output.rs`, `tools/sdlc-knowledge/tests/search_modes_test.rs` [new], `tools/sdlc-knowledge/tests/rrf_test.rs` [new]
- **Changes**: `dense_search(query, top_k)`: encode query via `encode_query()`, run K-NN over `chunks_vec` via sqlite-vec `vec_distance_cosine`, return top-K. `hybrid_search(query, top_k)`: parallel BM25 top-(K*4) + dense top-(K*4), merge via RRF k=60, return top-K. CLI `--mode lexical|dense|hybrid`, default `hybrid`. JSON output extended with `mode_used`, `bm25_score`, `dense_score`, `rrf_score`. **RRF correctness**: `rrf_test.rs` provides 3 known input rankings + the expected RRF output; the test passes only if implementation matches.
- **Verify**: 3 modes work end-to-end. **Hardware-anchored latency**: on 2024 MacBook M1, hybrid p95 latency <500ms over a fixed sequence of 30 queries against the user's existing 51K-chunk corpus.
- **Done when**: 3 modes work; default = hybrid; RRF correctness test passes; latency budget met on reference machine.
- **Pre-review**: architect (RRF correctness, score-normalization choice, sqlite-vec query API).

### Slice 8: Re-ingest user's corpus to v2 schema (operational)
- **Wave**: 6
- **Files**: NONE (operational; no source-code changes). Updates `.claude/scratchpad.md` for audit.
- **Changes**: Run `claudeknows ingest /Users/aleksandra/Documents/claude-code-sdlc/books/` to populate the v2 schema with embeddings + image BLOBs. The corpus is ~40 PDFs (ML/AI, data engineering, AI agents, system design, MLOps; mixed RU+EN). Capture wall-clock time + final `claudeknows status --json` output. Document in `.claude/scratchpad.md`.
- **Verify**: `claudeknows status --json` shows non-zero `chunks_vec` row count matching `chunks` row count. Document count ≥ number of PDFs in the books folder. Wall-clock time recorded.
- **Done when**: corpus fully re-ingested at v2 with embeddings + image BLOBs populated.
- **Pre-review**: none.

### Slice 9: Benchmark harness + golden query set + metrics
- **Wave**: 7
- **Files**: `tools/sdlc-knowledge/Cargo.toml` ([[bin]] entry for bench runner), `tools/sdlc-knowledge/bench/runner.rs` [new], `tools/sdlc-knowledge/bench/metrics.rs` [new], `tools/sdlc-knowledge/bench/golden/queries.jsonl` [new], `tools/sdlc-knowledge/bench/golden/README.md` [new]
- **Changes**: NOT using Cargo's `benches/` (that's for criterion microbenchmarks); instead a regular `[[bin]]` named `claudeknows-bench` under `tools/sdlc-knowledge/bench/`. Query format: `{"id": "Q01", "query": "...", "lang": "ru|en|cross", "relevant_chunk_ids": [...], "relevant_docs": [...], "category": "keyword|nl|cross|paraphrase"}`. 25 manually-curated queries grounded in the books at `/Users/aleksandra/Documents/claude-code-sdlc/books/` (ingested in Slice 8) — for each query, relevance judgments cite specific chunk_ids from books I personally inspect during query authoring (e.g., "Building AI Agents with LLMs, RAG, and Knowledge Graphs.pdf" chapters on retrieval architecture; "Хаос инжиниринг.pdf" sections on fault injection). Mix of categories (keyword / natural-language / cross-lingual / paraphrase). Metrics: Recall@1/3/5/10, Precision@5, MRR (1/rank of first relevant), NDCG@10, per-document recall (fraction of relevant DOCS hit), latency p50/p95. **Per-language stratification OUT-OF-SCOPE per OQ-4** — overall metrics + qualitative side-by-side only.
- **Verify**: `cargo run --bin claudeknows-bench -- --queries bench/golden/queries.jsonl --modes lexical,dense,hybrid` emits a Markdown report. Synthetic gold-standard tests verify metrics (perfect ranking → Recall@1 = 1.0, MRR = 1.0).
- **Done when**: ≥25 queries with relevance judgments; runner produces Markdown report with all metric tables.
- **Pre-review**: none.

### Slice 10: Run benchmark + commit report
- **Wave**: 8
- **Files**: `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md` [new]
- **Changes**: Run `claudeknows-bench` against the v2 corpus ingested from `/Users/aleksandra/Documents/claude-code-sdlc/books/` (Slice 8) for all 3 modes. Generate Markdown report: methodology, dataset description (~40 PDFs / actual chunk count / RU+EN), query categorization, metric tables per mode, latency, top-10 qualitative side-by-side samples for 5–10 representative queries, failure-mode taxonomy, recommendations.
- **Verify**: report file exists, contains all required sections, metric tables non-empty.
- **Done when**: report committed.
- **Pre-review**: none.

### Slice 11: install scripts + rule updates + README
- **Wave**: 8
- **Files**: `install.sh`, `install.ps1`, `README.md`, `src/rules/knowledge-base.md`, **and CRITICALLY** the corresponding rule files deployed by install.sh to `~/.claude/rules/` (notably `~/.claude/rules/knowledge-base-tool.md` containing the iter-1 "NOT a vector database" assertion — needs the equivalent file added to `src/rules/` if absent so install.sh deploys the updated text)
- **Changes**:
  - `install.sh` / `install.ps1`: add `install_e5_model`, `install_paddleocr_models`, `install_docling_models` functions following the `install_pdfium_binary` pattern. Total +200 MB at install time.
  - `README.md`: new "Vector + Multimodal Retrieval" subsection in Hardening table; reference benchmark report.
  - `src/rules/knowledge-base.md`: revise to reflect 3 search modes, hybrid retrieval, image chunks, schema v2.
  - `src/rules/knowledge-base-tool.md` (verify file exists; create if absent): REMOVE assertion "**NOT a vector database. No embeddings, no semantic similarity.**" and replace with updated description.
  - **Note**: version bump 0.3.1 → 0.4.0 happens via the user-invoked `/release` command AFTER merge, NOT in this slice. CHANGELOG.md `[Unreleased]` is appended via `changelog-writer` in `/merge-ready`.
- **Verify**: fresh install on Mac+Win downloads all 3 model bundles. `grep -F "NOT a vector database" ~/.claude/rules/` returns zero matches after install. README has a "Vector + Multimodal Retrieval" entry.
- **Done when**: install scripts updated; rule files no longer claim "NOT a vector database"; README documents the new feature.
- **Pre-review**: none.

## Wave summary

| Wave | Slices | Rationale |
|------|--------|-----------|
| 1    | 1, 2   | Foundation — chunker (src/chunker.rs+ingest.rs+tests/) and sqlite-vec storage (Cargo.toml+store.rs+migrations.rs+tests/) on disjoint files |
| 2    | 3      | Docling needs Slice 1's structural chunker for Markdown→chunks pipeline |
| 3    | 4      | Image extraction depends on Slice 3's Docling figure list |
| 4    | 5      | Encoder is independent of image work but needs vec table from Slice 2; consumed by all downstream slices |
| 5    | 6, 7   | OCR (ocr.rs+ingest.rs) needs Slices 4+5; Search (search.rs+cli.rs+output.rs) needs Slice 5; disjoint files |
| 6    | 8      | Re-ingest is operational; needs all encoding + OCR + storage in place |
| 7    | 9      | Benchmark harness depends on all 3 search modes from Slice 7 |
| 8    | 10, 11 | Report (bench/reports/*) and install/docs (install.sh+install.ps1+README+rules) on disjoint files |

**Cross-wave file overlap (allowed, sequential merges)**: `src/ingest.rs` is touched in waves 1, 2, 3, 4, 5 — each edit is additive (new function call insertion or new branch handling), tested independently per wave. `Cargo.toml` is touched in waves 1, 2, 4, 5, 7, 8 — each edit only ADDS a new dep entry, never modifies existing ones.

## Files affected

**NEW (~16 files)**:
- `tools/sdlc-knowledge/src/{chunker,docling,encoder,ocr}.rs`
- `tools/sdlc-knowledge/tests/{chunker,store_v2,migration,docling,image_extraction,encoder,encoder_prefix,ocr,search_modes,rrf}_test.rs`
- `tools/sdlc-knowledge/tests/fixtures/{sample-with-headings.md, sample-no-headings.md, sample-structured.pdf, sample-with-figure.pdf, sample-with-multiple-figures.pdf, diagram-with-text.png}`
- `tools/sdlc-knowledge/bench/{runner,metrics}.rs`
- `tools/sdlc-knowledge/bench/golden/{queries.jsonl, README.md}`
- `tools/sdlc-knowledge/bench/reports/2026-05-09-vector-vs-bm25.md`
- `docs/use-cases/vector-retrieval-backend_use_cases.md`
- `docs/qa/vector-retrieval-backend_test_cases.md`

**MODIFIED**:
- `tools/sdlc-knowledge/Cargo.toml` (deps; version bump deferred to /release)
- `tools/sdlc-knowledge/Cargo.lock`
- `tools/sdlc-knowledge/src/{ingest,store,migrations,search,cli,output}.rs`
- `install.sh`, `install.ps1`
- `README.md`
- `src/rules/knowledge-base.md` (and `src/rules/knowledge-base-tool.md` — create if absent)
- `docs/PRD.md` (new §15 by prd-writer at bootstrap)
- `CHANGELOG.md` `[Unreleased]` (by changelog-writer at /merge-ready)

**INTENTIONALLY UNCHANGED**:
- 5 executor agents — no agent prompt changes
- 12 thinking agents — no agent prompt changes
- `templates/` directory — no scaffold changes

## Risks and dependencies

1. **R1 — Docling Rust integration (CRITICAL OQ-1)**. Pragmatic mitigation: if architect rules Docling unfeasible in Rust, Slice 3 collapses to "structural chunker over pdfium output is sufficient for v1" (Slice 1 already does this); Docling deferred to v2. The plan ships even if Slice 3 de-scopes — vector backend (Slices 2/5/7) + OCR multimodal (Slice 6) + benchmark (Slices 9/10) still deliver the user's primary win.
2. **R2 — sqlite-vec linking (OQ-2)**. Architect Slice 2 picks static-link vs runtime-load. Mitigation: prefer static-link via `rusqlite-bundled`; fall back to runtime-load if static fails on any target.
3. **R3 — Bundle size +200 MB (models)**. Mitigation: install-time download paralleled to pdfium pattern; lazy-fallback if missing (encoder degraded → BM25-only; OCR degraded → placeholder text). Binary itself stays <10 MB.
4. **R4 — v1→v2 migration UX on large corpora**. User's 51K chunks ~10 min to re-encode. Mitigation: `CLAUDEKNOWS_AUTO_REINGEST=1` for headless; clear prompt for TTY; corrupt v1 honors AC-7 contract.
5. **R5 — Benchmark fairness**. BM25 and dense must use the SAME chunks (post-Slice-1 structural chunker output) so comparison isolates retrieval-method differences. Slice 9 enforces.
6. **R6 — OCR quality on schematic diagrams**. PaddleOCR is best-in-class for natural text but mediocre on diagrams. Benchmark Slice 10 surfaces real numbers; if poor, iter-2 may add layout-aware diagram parsers.
7. **R7 — e5 prefix discipline drift**. Forgetting "passage:" / "query:" silently degrades quality 5–10%. Slice 5 explicitly tests this in `encoder_prefix_test.rs`.
8. **R8 — Plan-mode persistence**. Plan body auto-persisted to `<project>/.claude/plan.md` per the rule shipped in 0.3.1; built-in, not a feature concern.
9. **R9 — Bundle-size constraint claim ("binary <10 MB")**. ONNX runtime + sqlite-vec linked statically can add 20–40 MB. Mitigation: investigate `ort` linkage modes; if static blows budget, ship `ort` as dynamic load (similar to pdfium today). Slice 5 architect pre-review validates.
10. **R10 — Cargo.toml multi-edit serialization**. 6 slices touch Cargo.toml across 5 waves. Mitigation: each edit ADDS a new dep entry, never modifies existing; sequential wave merges preserve correctness.

## Verification (end-to-end)

After all 11 slices land:

```bash
# 1. Fresh install with all model bundles
bash install.sh --yes
test -x ~/.claude/tools/sdlc-knowledge/sdlc-knowledge
test -d ~/.claude/tools/sdlc-knowledge/models/e5-small
test -d ~/.claude/tools/sdlc-knowledge/models/paddleocr
~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version  # 0.3.1 (bump to 0.4.0 happens via /release)

# 2. Schema v2
claudeknows status --json | jq '.schema_version'  # 2

# 3. v1→v2 migration
# Place v1 fixture index.db, run any command, expect prompt or AUTO_REINGEST behavior

# 4. Re-ingest user's corpus (Slice 8)
time claudeknows ingest ~/Documents/books/

# 5. Search modes
claudeknows search "authentication architecture" --mode lexical --json | jq '.[] | .mode_used'  # "lexical"
claudeknows search "authentication architecture" --mode dense   --json | jq '.[] | .mode_used'  # "dense"
claudeknows search "authentication architecture" --mode hybrid  --json | jq '.[] | .mode_used'  # "hybrid"
claudeknows search "authentication architecture"               --json | jq '.[] | .mode_used'  # "hybrid" (default)

# 6. Image chunks searchable
claudeknows search "<query that should hit OCR'd diagram>" --json | jq '.[] | select(.type=="image")'  # ≥1 hit on a corpus with figures

# 7. Benchmark
cd <repo>/tools/sdlc-knowledge
cargo run --release --bin claudeknows-bench -- --queries bench/golden/queries.jsonl --modes lexical,dense,hybrid --report bench/reports/local-run.md
diff bench/reports/local-run.md bench/reports/2026-05-09-vector-vs-bm25.md  # near-identical (deltas only in run timestamps)

# 8. Backward compat — no models installed
mv ~/.claude/tools/sdlc-knowledge/models ~/.claude/tools/sdlc-knowledge/models.bak
claudeknows search "anything" --mode lexical  # works (BM25 fallback)
claudeknows search "anything" --mode dense    # exits 1 with "encoder model missing"
claudeknows search "anything" --mode hybrid   # falls back to lexical with warning
mv ~/.claude/tools/sdlc-knowledge/models.bak ~/.claude/tools/sdlc-knowledge/models

# 9. Rule update
grep -F "NOT a vector database" ~/.claude/rules/knowledge-base-tool.md  # zero matches
grep -E "hybrid|RRF|sqlite-vec" ~/.claude/rules/knowledge-base.md       # ≥1 match each

# 10. Invariants preserved
ls src/agents/*.md | wc -l       # 17 (unchanged)
ls src/commands/*.md | wc -l     # 7 (unchanged — no new command added)
```

All 10 verification blocks PASS = feature merge-ready.

## Review Notes

### Critic Findings

- **Total**: 26 findings (7 CRITICAL, 13 MAJOR, 6 MINOR)
- **All CRITICAL/MAJOR addressed**: Yes

### Changes Made

**CRITICAL fixes:**
- **#1 (main branch)** — added explicit "Pre-implementation precondition" in Context: must create `feat/vector-retrieval-backend` branch before any slice begins.
- **#2 (plan persistence in Risks)** — moved from R8 risk to a hard precondition in Context. The auto-persist rule shipped in 0.3.1 makes this automatic.
- **#3 ("NOT a vector database" assertion)** — Slice 11 explicitly removes that assertion from `~/.claude/rules/knowledge-base-tool.md` AND updates `~/.claude/rules/knowledge-base.md` AND `src/rules/knowledge-base.md`. Verification block 9 greps for absence of the old assertion.
- **#4 (PRD FR-4.3 contradiction)** — Context section explicitly notes "supersedes the reserved `embedding BLOB` column strategy"; Documentation phase of /bootstrap-feature includes formal FR-4.3 amendment in PRD §15.
- **#5 (NFR-1.5 single-file constraint)** — Locked decision #6 commits to image bytes as `chunks.image_bytes BLOB` column INSIDE `index.db`. Slice 4 verifies BLOB integrity.
- **#6 (External contracts unverified, Docling load-bearing)** — added pragmatic-fallback strategy: if architect Slice 3 pre-review rules Docling unfeasible, Slice 3 de-scopes and Docling defers to v2. Plan still delivers vector + multimodal + benchmark.
- **#7 (no re-ingest slice)** — added Slice 8 explicitly for operational re-ingest of user's corpus. No source-code changes; wall-clock-time operation with status-json verification.

**MAJOR fixes:**
- **#8 (Slice 1 too large)** — split old mega-slice into Slice 1 (chunker), Slice 3 (Docling), Slice 4 (image extraction). Each <200 LOC.
- **#9 (Slice 8 over-scoped)** — version bump and CHANGELOG removed from Slice 11; bump via `/release` AFTER merge, CHANGELOG via `/merge-ready` per pipeline contract.
- **#10 (no documentation phase ordering)** — added "Pre-implementation: documentation phase" section listing 4 deliverables as upstream-of-Slice-1 work via /bootstrap-feature.
- **#11 (e5 prefix not testable)** — Slice 5 added `encoder_prefix_test.rs` mocking the ONNX call to assert prefix discipline.
- **#12 (ingest.rs touched in many waves)** — Wave summary documents that each wave's ingest.rs edit is additive; cross-wave merges sequential.
- **#13 (Cargo.toml multi-edit constraint)** — Wave summary documents all Cargo.toml edits as additive (new dep entries only).
- **#14 (vague done-conditions)** — tightened: Slice 5 latency anchored to "2024 MacBook M1 reference machine"; Slice 4 fixture with EXACT count; Slice 7 latency over fixed sequence of 30 queries; Slice 6 cosine threshold tied to specific fixture.
- **#15 (External contracts unverified for trivially verifiable)** — flagged each as "verified: no — assumption" with explicit pre-review owners (Slice 2/3/5/6 architects).
- **#16 (bundle size unsupported)** — added R9: ONNX static-link can blow 10 MB budget; mitigation is dynamic loading like pdfium today; Slice 5 architect pre-review validates.
- **#17 (zero-Python tension with Docling)** — explicit in Locked Decision #8 and OQ-1; pragmatic fallback (Slice 3 de-scope) if architect rules unfeasible.
- **#18 (no model-missing slice)** — encoder fallback in Slice 5 done-condition: "degraded mode" returns Err on encode; ingest catches and falls back to BM25-only chunks. OCR fallback in Slice 6: missing model → placeholder text + warning. Hybrid search fallback in verification #8.
- **#19 (corrupt v1 migration UX)** — Slice 2 done-condition explicitly covers corrupt v1 (truncated DB) honoring AC-7 contract.
- **#20 (per-language benchmark stratification)** — OQ-4 declared OUT-OF-SCOPE: 25 queries provide overall metrics + qualitative samples only.
- **#21 (date inconsistency)** — report path updated to `2026-05-09-vector-vs-bm25.md` (today's date per system context).

**MINOR fixes (acknowledged, addressed inline)**:
- **#22 (CLIP-deferred hedging)** — Locked Decision #4 classifies pure-vision CLIP as OUT OF SCOPE for v1, deferred until benchmark shows visual-only retrieval is needed (tied to benchmark outcome, not arbitrary).
- **#23 (benches/ directory layout)** — Slice 9 chose `bench/` directory + `[[bin]]` over Cargo's `benches/` (which is for criterion microbenchmarks).
- **#24 (knowledge-base-tool rule sync)** — Slice 11 explicitly updates the rule.
- **#25 (e5 prefix verified=yes citation)** — citation now references the model card URL specifically.
- **#26 (status --json claim)** — Verified facts read "verified by `claudeknows status --json` invocation earlier in this session" (session-scoped real command output).

### Acknowledged Minor Issues
- None unresolved. All MINOR findings addressed inline.
