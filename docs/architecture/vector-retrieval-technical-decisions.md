# Vector Retrieval Backend — Technical Decisions Log

> Companion document to the [benchmark report](../benchmarks/2026-05-10-vector-retrieval-backend.md)
> and the [implementation plan](../design/vector-retrieval-backend.md). This file
> captures the load-bearing technical choices made during iter-2 of `claudeknows`,
> with rationale, alternatives considered, and the consequences. Intended for
> future readers (including the Medium-article author) who need to understand
> WHY each decision was made — not just WHAT was implemented.

## Stack at a glance

| Concern | Choice | Alternative considered | Rationale |
|---|---|---|---|
| Lexical retrieval | SQLite FTS5 BM25 | Tantivy, Meilisearch | Already shipping (iter-1); FTS5 is in-process, zero-deploy, deterministic |
| Dense retrieval | `sqlite-vec` v0.1.9 | Qdrant, FAISS, USearch | Co-locates with FTS5 in the SAME `index.db` file → preserves NFR-1.5 single-file invariant |
| Distance metric | L2 (Euclidean) over unit-norm vectors | Explicit cosine via `distance_metric=cosine` | Mathematically equivalent ranking; avoids destructive re-create of chunks_vec |
| Encoder model | `intfloat/multilingual-e5-small` (384 dim) | bge-m3 (1024 dim, 2 GB), OpenAI text-embedding-3-small | Small (~120 MB), runs CPU at ≤50 ms/chunk batch=32, mature multilingual support |
| Encoder runtime | `fastembed-rs = "5"` (uses `ort` ONNX) | Raw `ort` integration, candle-transformers | fastembed handles tokenization + pooling + L2-normalization; saves ~500 LOC |
| Fusion | Reciprocal Rank Fusion k=60 | Weighted-sum of normalized scores, ColBERT late-interaction | RRF doesn't require score normalization between rankers; canonical k=60 from Cormack 2009 |
| PDF extraction | `pdfium-render` v0.9 | poppler, mupdf | Reuses iter-1 backend; handles CID fonts / multi-column / scanned-with-text-layer correctly |
| OCR engine (Slice 6b) | `ocr-rs` v2 (PaddleOCR PP-OCRv4 via MNN) | `paddle-ocr-rs` v0.6 (PaddleOCR via ort) | `paddle-ocr-rs` conflicts with fastembed's ort version; ocr-rs uses MNN runtime → no version conflict |
| Image storage | `chunks.image_bytes BLOB` inside `index.db` | Co-located figure files in `<project>/.claude/knowledge/figures/` | Preserves NFR-1.5 single-file invariant; ~28 MB BLOB overhead per typical book |
| HTTP for model auto-download | Deferred to operator (manual model placement) | `ureq`, `reqwest`, `hf-hub` | Fastembed handles e5 lifecycle transparently; PaddleOCR `.mnn` files lack stable mirror as of 2026-05 |

## Why hybrid retrieval (not dense-only)

Dense retrieval has a known weakness: **out-of-distribution queries**. When
the query contains a rare term, an API name, an error code, or a specific
identifier, the encoder hasn't seen enough training data to produce a
reliable embedding. BM25 handles this trivially (literal token match).

Conversely, BM25 fails on:
- **Cross-lingual queries**: "Russian query → English chunk that covers
  the same concept" cannot match because BM25 tokenizes lexically. We
  observed this concretely on the query "как настроить отказоустойчивость"
  → 0 BM25 results despite 3 dense hits in `Высоконагруженные приложения`.
- **Paraphrase**: "how to authenticate users" → BM25 finds the literal
  phrase but misses semantically equivalent phrasings ("user verification",
  "OAuth flow"). Dense surfaces both.
- **Concept-level queries**: "RAG retrieval architecture" — BM25 ranks
  glossary entries and TOC pages high (the literal terms appear), missing
  actual content chapters. Dense surfaces "5.1.3 The RAG Design Pattern"
  with its definition.

Reciprocal Rank Fusion (Cormack/Clarke/Buttcher 2009) was specifically
designed for this scenario: fuse rankings from heterogeneous rankers
without requiring score normalization. The k=60 smoothing constant lets
positions 5–10 contribute meaningfully (1/65 ≈ 0.015) while preserving
the rank-1 dominance (1/61 ≈ 0.016).

## Why L2 distance with cosine-equivalent ranking

`sqlite-vec`'s default distance is L2 (Euclidean). For L2-normalized
embeddings (which fastembed produces for e5 by default):

```
‖a − b‖² = ‖a‖² + ‖b‖² − 2·(a·b) = 2 − 2·cos(θ)
```

Therefore:
- L2 distance is a strictly monotonic function of cosine similarity
- The K-NN ordering produced by L2 is identical to the K-NN ordering
  produced by cosine for unit-norm vectors
- Only the numeric scale differs: cos ∈ [−1, 1], L2 ∈ [0, 2]

We chose L2 for three reasons:

1. **It's the sqlite-vec default** — no extra `distance_metric=cosine`
   declaration needed
2. **L2-normalization invariant is testable** — `encoder_test.rs:real_encode_*`
   asserts `‖v‖ ≈ 1.0`. As long as that test passes, L2 ranking IS cosine
   ranking. A future encoder change that drops normalization fails the
   test loudly, not silently.
3. **Migration cost** — switching to `distance_metric=cosine` on an
   existing chunks_vec table requires drop+recreate + re-embed of all
   chunks. We have 74 K embedded chunks; the migration cost (~30 min
   CPU) is purely cosmetic — the ranking is unchanged.

The trade-off is reader confusion: `dense_score=-0.43` doesn't intuitively
read as "91% similar". This document and the search.rs module docstring
both call out the equivalence formula `cos = 1 − L2²/2` so the
relationship is discoverable.

## Why fastembed-rs (not raw ort)

Three reasons:

1. **Tokenization is non-trivial.** e5 uses XLM-RoBERTa's SentencePiece
   tokenizer. Implementing that correctly in Rust is ~500 LOC of edge
   cases (BPE merges, byte-level fallbacks, special-token handling).
   fastembed wraps the canonical `tokenizers` crate.
2. **Mean pooling + L2 normalization** is the right post-processing for
   e5 specifically. fastembed handles this per-model. Raw `ort` would
   require us to mirror the per-model post-processing recipes.
3. **HuggingFace cache integration**. fastembed uses the standard
   HF hub directory layout and download protocol. We pin `cache_dir`
   to `~/.claude/tools/sdlc-knowledge/models/`; everything else is
   transparent.

The cost: fastembed v5 pulls in `ort = "2.0.0-rc.12"` transitively,
which constrains other crates (notably `paddle-ocr-rs` for OCR — see
below).

## Why ocr-rs (MNN) instead of paddle-ocr-rs (ONNX)

Both crates ship the SAME PaddleOCR PP-OCRv4 model lineage —
`ch_PP-OCRv4_det_infer` for detection, `ch_PP-OCRv4_rec_infer` for
recognition, `ppocr_keys_v4.txt` for the multilingual character
dictionary. They differ ONLY in the inference engine:

- `paddle-ocr-rs` v0.6.1 uses `ort` (ONNX runtime)
- `ocr-rs` v2.2.2 uses MNN (Alibaba's mobile-optimized inference framework)

When we tried to add `paddle-ocr-rs` to the project, it pinned a
different `ort` version than the one fastembed v5 transitively depends
on. The result was 9 compile errors in `ort::value::impl_tensor::create`.
Resolving the version mismatch would have required either:
- Patching one of the crates to align ort versions (fragile)
- Forking `paddle-ocr-rs` (maintenance burden)

`ocr-rs` uses MNN, which is statically linked from prebuilt binaries
auto-downloaded by its `build.rs` from the maintainer's
[MNN-Prebuilds](https://github.com/zibo-chen/MNN-Prebuilds) repo. No
ort dependency at all → no conflict.

The architect's original choice (OQ-3 in the implementation plan) was
PaddleOCR PP-OCRv4 ONNX. We implemented the same model lineage via a
different inference engine; the model files are identical, only the
runtime differs. Quality should be equivalent — confirmed once we
benchmark with real OCR'd image chunks.

## Why placeholder text for image chunks (until Slice 6b ships in production)

Slice 6 of the implementation plan ships an OCR API surface
(`ocr::extract_text_from_image`, `ocr::placeholder_text`) but the
PaddleOCR engine returns `OcrError::ModelMissing` until the operator
places the `.mnn` files at `~/.claude/tools/sdlc-knowledge/models/paddleocr/`.

In that degraded state, image chunks get the canonical placeholder text
`[image: figure N from <doc-basename>]`. This text is then embedded by
e5 and stored in chunks_vec just like any other chunk. The result:
**image chunks remain dense+BM25 searchable at low recall** — a query
like "diagram" will surface them via the placeholder, but they won't
match queries about the diagram's CONTENTS.

This is intentional — the placeholder mode IS the safety net. Once the
operator runs `bash install.sh --yes` (or manually downloads the .mnn
files), `extract_text_from_image` returns real OCR output, image chunks
get embedded with real text, and recall on image-content queries
improves automatically without re-ingest (next ingest re-embeds image
chunks with the OCR'd text).

## Page-level addressing (planned, schema v3)

Currently chunks have `ord` (sequential within document) but no page
mapping. The schema v3 migration adds:

- `chunks.page_start INTEGER NULL`
- `chunks.page_end INTEGER NULL`
- `documents.total_pages INTEGER NULL`
- New table `pages(doc_id, page_num, text)` for raw per-page text

Page numbering uses **pdfium 1-indexed convention** — `wallet/getpages`
returns pages 1..N where N is the total page count of the PDF as
reported by PDFium. This is independent of any "printed" page numbers
the document might use (Roman numerals for preface, Arabic for body).
We commit to pdfium's index because it's deterministic and stable
across re-ingests; "printed" page numbers require parsing arbitrary
typography conventions which is out of scope.

Out-of-range page lookups (e.g., `claudeknows page foo.pdf 1000` when
the PDF has 200 pages) return exit code 1 with the literal stderr
message `error: page number out of range`. No silent defaults, no
nearest-page fallback — the LLM caller gets a clean error and can
adjust the request.

## What this enables for the LLM-driven workflow

The motivating use case: an LLM reads a search result, sees "this
chunk is from page 135 of *Mastering LangChain.pdf*", and decides
that the chunk alone doesn't have enough context. It can then call
`claudeknows page "Mastering LangChain.pdf" 135 --range 2` to fetch
the full text of pages 133–137, paging through the book the same way
a human would. This avoids the alternative of brute-force `--top-k 50`
searches that flood the context with marginally-related chunks.

The architectural distinction: **chunks are for retrieval**, **pages
are for navigation**. An LLM uses the embedding-based retrieval to
find a starting point; it uses the page-based navigation to expand
context as needed. Both come out of the same `index.db`.

## Summary of what's stable vs what's still in motion

**Stable (decided, shipped, unlikely to change in iter-3):**

- BM25 + dense + RRF k=60 hybrid retrieval — ranking order is the
  load-bearing contract; specific score values can change
- L2 distance with cosine-equivalent ranking on unit-norm e5 embeddings
- chunks_vec virtual table inside `index.db` (NFR-1.5 single-file)
- `chunks.image_bytes BLOB` for figure storage
- ocr-rs MNN backend for OCR
- pdfium-render for PDF text extraction

**In motion (decided in iter-2, may evolve in iter-3):**

- Page-level addressing (`schema v3`, `pages` table) — schema is locked
  for iter-2 but the LLM-facing API surface (`claudeknows page` flags)
  may grow as usage patterns emerge
- OCR model auto-download — currently manual operator step; iter-3
  may add a stable mirror + sha256-verified install step
- Golden query set — 12 queries is small for stable per-language metrics;
  iter-3 may expand to ≥50 with chunk-level relevance

**Open (deferred to iter-3 or later):**

- Pure-vision CLIP-style multimodal embeddings (currently text-as-bridge
  via OCR placeholder text)
- Cross-encoder re-ranker on top-K hybrid results
- Per-language stratified benchmark metrics
- Migration to explicit `distance_metric=cosine` (cosmetic; deferred
  until a destructive re-embed is independently warranted)
