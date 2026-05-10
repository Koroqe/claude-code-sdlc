## Feature: Vector + Multimodal Retrieval Backend
## Branch: feat/vector-retrieval-backend
## Status: Wave 5 DONE — Slices 1..7 committed (4817343, 921c36f, a746c5b, 345efb3, 8e37fe3, 4060d76, 272c817) + bootstrap docs c5c00c8. Wave 6+ (re-ingest, benchmark, install scripts) pending — needs real model download + manual golden-query authoring

## Plan

11 slices across 8 waves. Architect PASS with 5 [STRUCTURAL] action items applied to `.claude/plan.md`.

### Wave 1 (parallel — chunker + sqlite-vec; disjoint files)
- [x] Slice 1: Heading-aware structural chunker — 4817343 (src/chunker.rs [new], lib.rs +pub mod, 2 fixtures, chunker_test.rs 7/7 pass; legacy ingest::chunk() preserved for backward-compat with sample.md 8-chunk regression test)
- [x] Slice 2: sqlite-vec extension + schema v1→v2 + image BLOB column — 921c36f (Cargo.toml +sqlite-vec=0.1.9, store.rs +SCHEMA_V2_DELTA + open_or_init_v2 with auto-extension registration once-per-process, migrations.rs +migrate_v1_to_v2 with destructive drop+recreate + AUTO_REINGEST=1 headless gate, store_v2_test.rs 6/6 pass, migration_test.rs 4/4 pass; chunks.type/image_bytes columns + chunks_vec(vec0 384-dim) + FTS5 coexistence verified; rusqlite load_extension feature stays OFF — security posture preserved)

### Wave 2 (sequential — parser bridge over pdfium)
- [x] Slice 3: Parser bridge — a746c5b (src/parser.rs [new] with `parse(p: &Path) -> Result<ParsedDocument, IngestError>` dispatch by extension; ParsedDocument shape with `images: Vec<ExtractedImage>` always-empty per Slice 3 contract — Slice 4 wires pdf::extract_images. parser_test.rs 5/5 pass. Production ingest NOT yet rewired — happens in Slice 5+ when chunks_vec needs populating.)

### Wave 3 (sequential — image extraction depends on parser)
- [x] Slice 4: Image extraction → BLOB storage — 345efb3 (Cargo +image=0.25, pdf.rs +extract_images() iterating PdfPageObjectsCommon → PdfPageImageObject → PdfBitmap → DynamicImage → PNG bytes; parser.rs PDF branch wires images into ParsedDocument; image_extraction_test.rs 3/3 pass including synth-PNG BLOB roundtrip through v2 chunks(type='image',image_bytes); parser_test PDF-images assertion relaxed)

### Wave 4 (sequential — encoder)
- [x] Slice 5: e5 encoder — 8e37fe3 (Cargo +fastembed=5, src/encoder.rs [new] with TextEmbedding singleton, prefix_passage/prefix_query helpers + encode_passages/encode_query API; cache_dir pinned to ~/.claude/tools/sdlc-knowledge/models/; HOME/USERPROFILE cross-platform; encoder_test.rs 6/6 pass; real_encode test gated behind RUN_REAL_ENCODER=1 to avoid 120MB model download in CI)

### Wave 5 (parallel — OCR + hybrid search; disjoint files)
- [x] Slice 6: OCR bridge stub + placeholder fallback — 272c817 (src/ocr.rs [new] with extract_text_from_image always returning ModelMissing; placeholder_text composes "[image: figure N from <doc>]"; image_chunk_text adapter; ocr_test.rs 3/3 pass. Real PP-OCRv4 ONNX inference deferred to Slice 6b)
- [x] Slice 7: Hybrid search + RRF k=60 — 4060d76 (src/search.rs +dense_search via sqlite-vec K-NN with `WHERE embedding MATCH ? AND k = ?` constraint, +hybrid_search BM25*4 + dense*4 fused via rrf_fuse k=60, +SearchHit fields mode_used/bm25_score/dense_score/rrf_score; rrf_test.rs 5/5 pass with hand-computed expected fusion order verified; search_modes_test.rs 3/3 pass with synthetic one-hot embeddings)

### Wave 6 (operational — re-ingest user's books folder)
- [ ] Slice 8: Re-ingest /Users/aleksandra/Documents/claude-code-sdlc/books/ to v2 schema (no source code changes; updates this scratchpad with wall-clock time)

### Wave 7 (sequential — benchmark harness)
- [ ] Slice 9: Benchmark harness + 25 golden queries + metrics (bench/runner.rs [new], bench/metrics.rs [new], bench/golden/queries.jsonl [new], Cargo.toml [[bin]])

### Wave 8 (parallel — report + install scripts; disjoint files)
- [ ] Slice 10: Run benchmark + commit report (bench/reports/2026-05-09-vector-vs-bm25.md [new])
- [ ] Slice 11: install scripts + rule updates + README (install.sh, install.ps1, README.md, src/rules/knowledge-base.md, src/rules/knowledge-base-tool.md); security-auditor pre-review of install scripts (TLS, sha256, supply-chain) [pending]

## Documentation produced (Phase 1 complete)

- PRD §15 in docs/PRD.md (lines 3620–3875): 40 FRs / 8 NFRs / 17 ACs / 10 risks / 12 KB citations
- Use cases at docs/use-cases/vector-retrieval-backend_use_cases.md: 7 primary + 8 alt + 8 error + 5 edge + 3 cross-cutting = 31 UCs
- Architect verdict: PASS with 5 [STRUCTURAL] action items (all applied to plan.md by planner)
- QA test cases at docs/qa/vector-retrieval-backend_test_cases.md: 52 TCs covering all 31 UCs and all 17 ACs
- Plan at .claude/plan.md (519 lines, 11 slices/8 waves, 9 resources inlined, 0 roles)

## Key locked decisions

1. Text encoder: `intfloat/multilingual-e5-small` ONNX (~120 MB) via `fastembed-rs = "4"`
2. Hybrid retrieval: BM25 (FTS5 kept) + dense (sqlite-vec) via RRF k=60; `--mode lexical|dense|hybrid`, default=hybrid
3. Document parser: pdfium-only with structural Markdown bridge (Docling deferred to v2 per architect OQ-1)
4. Multimodal: OCR-as-text via PaddleOCR-ONNX (PP-OCRv4 ml, ~30 MB) → e5 384-dim space
5. Vector storage: `sqlite-vec = "0.1"` via `sqlite_vec::load(&db)` helper (NOT bundled, NOT load_extension)
6. Image storage: `chunks.image_bytes BLOB` column inside same `index.db` (preserves NFR-1.5 single-file)
7. Bundle: `ort = "2"` in load-dynamic mode (mirrors pdfium); ~250 MB total install footprint via install.sh
8. Zero Python deps; all ML via `ort` ONNX runtime
9. Backward compat: v1 → re-ingest prompt; `CLAUDEKNOWS_AUTO_REINGEST=1` for headless

## Vectorization corpus

`/Users/aleksandra/Documents/claude-code-sdlc/books/` — ~40 PDFs (ML/AI, data engineering, AI agents, system design, MLOps, RU+EN). Used for Slice 8 re-ingest, Slice 9 golden query authoring, Slice 10 benchmark run.

## Blockers

(none)

## Notes

- Plan persisted to `<project>/.claude/plan.md` (canonical) and `<project>/docs/design/vector-retrieval-backend.md` (durable design doc)
- changelog-writer post-bootstrap hook ran successfully — added entry to CHANGELOG.md `[Unreleased]`
- Pre-existing untracked `codefather.dev/` and `tools/sdlc-knowledge/.cargo/` directories left as-is

## Archive

### Auto-Release Pipeline (iter-3) — feat/auto-release — COMPLETE

All 5 waves + cleanup + Gate 2 fix landed; merge-ready. Shipped via release v0.3.0 on 2026-04-30. See git log for commit details (4d2f47b, b53a475, 0be97d0, ab666b4, ...).
