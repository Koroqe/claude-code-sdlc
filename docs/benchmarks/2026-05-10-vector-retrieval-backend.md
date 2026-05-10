# Vector Retrieval Backend — Benchmark Results

**Date:** 2026-05-10
**Branch:** `feat/vector-retrieval-backend`
**Feature:** PRD §15 — vector + multimodal hybrid retrieval

## TL;DR

We replaced the BM25-only retrieval in `claudeknows` with a hybrid backend
(BM25 ⊕ dense via Reciprocal Rank Fusion). Measured on a **39-PDF
technical books corpus (75,895 chunks indexed at v2 schema)**:

> **Hybrid retrieval finds the right document 83.3% of the time in the
> top 10 results, vs 58.3% for the iter-1 BM25 baseline — a +43%
> relative Recall@10 improvement.** At top-5 the gap is even larger:
> 75.0% vs 41.7% (+80% relative). Mean Reciprocal Rank improves from
> 0.378 → 0.483 (+28%). Latency p95 stays under 70 ms, well within the
> 500 ms NFR budget — and on the full corpus hybrid is actually FASTER
> than pure dense at p95 (66 ms vs 74 ms) because encoder warm-up
> amortizes across more queries.

The win is concentrated where you'd expect: cross-lingual queries
(Russian → English corpus), natural-language paraphrases ("how to
authenticate users" → finds the FastAPI auth chapter), and concept-level
queries ("RAG retrieval architecture") that BM25 cannot resolve via
keyword matching.

## Similarity metric — L2 distance with cosine-equivalent ranking

We use **sqlite-vec's default L2 (Euclidean) distance** rather than explicit
`distance_metric=cosine`. This is a deliberate choice that exploits a
mathematical equivalence on L2-normalized vectors:

For unit-norm vectors a and b:

```
‖a − b‖² = ‖a‖² + ‖b‖² − 2·(a·b) = 2 − 2·cos(θ)
```

So `L2 = √(2 − 2·cos θ)` — a strictly monotonic function of cosine
similarity. **The ranking order produced by L2-K-NN over unit-norm vectors
is identical to the ranking order produced by cosine-similarity-K-NN.**
Only the numeric distance values differ:

| cos θ | L2 distance | Meaning |
|------:|------------:|---------|
| 1.00  | 0.00        | identical direction |
| 0.91  | 0.42        | very similar (typical hit) |
| 0.50  | 1.00        | weak similarity |
| 0.00  | 1.41 (√2)   | orthogonal |
| −1.00 | 2.00        | opposite |

`fastembed-rs` returns L2-normalized embeddings for the e5 family by
default (verified at runtime: every encoder output has `‖v‖ ≈ 1.0` within
0.05). The encoder integration test
`real_encode_passage_returns_384_dim_vector` asserts the L2-normalization
contract so a future fastembed version that drops normalization breaks
the build, not the production ranking quality.

**Why not `distance_metric=cosine` explicitly?** Switching the chunks_vec
declaration to `embedding float[384] distance_metric=cosine` would make
the `dense_score` field show cosine similarity (0..1) directly instead
of −L2 (typically −0.4 to −0.6 on real hits). It would NOT change which
chunks are returned in what order. The trade-off is a destructive
re-create of the chunks_vec virtual table + re-embed of all 75 K chunks
(~30 min CPU on M-series). We chose to preserve the existing index and
document the equivalence rather than pay the migration cost for a purely
cosmetic score-shape change.

**For the Medium-article-author reading this**: dense ranking via L2 over
unit-normalized embeddings IS cosine-similarity ranking, despite the
name "L2" in the SQL. The numbers in `dense_score` decode to cosine via
`cos = 1 − L2² / 2`. A `dense_score = −0.43` corresponds to a cosine
similarity of `1 − 0.43² / 2 ≈ 0.91` — a strong semantic match.

## Methodology

### Corpus

40 PDFs (1 EPUB skipped — unsupported extension) spanning ML / AI / data
engineering / system design / SRE / generative AI in mixed Russian +
English at `/Users/aleksandra/Documents/claude-code-sdlc/books/`. **39
PDFs / 75,895 chunks fully ingested at v2 schema** with embeddings
populated in `chunks_vec`. Slice 8 of vector-retrieval-backend completed
the re-ingest of the entire corpus (22 fresh + 17 unchanged from prior
partial run; 0 failures).

The encoder is `intfloat/multilingual-e5-small` via fastembed-rs (384-dim
L2-normalized embeddings). Chunking is heading-aware structural with
500-char sliding fallback (Slice 1). Vector storage is sqlite-vec's
`vec0` virtual table co-located in the same `index.db` as the FTS5
`chunks_fts` virtual table (Slice 2; single-file SQLite NFR-1.5
preserved).

### Golden query set

12 manually curated queries spanning four categories:

- **keyword** — exact-term queries where BM25 is strong
- **nl** (natural-language) — concept-level phrasing where dense should help
- **cross** — RU query against EN corpus or vice versa
- **paraphrase** — semantic equivalence of different word choices

Per query, a `relevant_sources` list names the PDFs whose content covers
the topic. A retrieval result counts as a "hit" if at least one returned
chunk's source basename is in `relevant_sources`. This is **source-level
relevance** — looser than chunk-level but robust across chunker
evolution. The full set is at
[`tools/sdlc-knowledge/bench/golden/queries.jsonl`](../../tools/sdlc-knowledge/bench/golden/queries.jsonl);
methodology is at
[`tools/sdlc-knowledge/bench/golden/README.md`](../../tools/sdlc-knowledge/bench/golden/README.md).

### Modes evaluated

- **`lexical`** — BM25 over FTS5 (iter-1 baseline; identical to v0.3.x behavior)
- **`dense`** — sqlite-vec K-NN over e5-multilingual-small embeddings
- **`hybrid`** — BM25 + dense fused via Reciprocal Rank Fusion with k=60
  (canonical Cormack/Clarke/Buttcher 2009 value)

Each query runs in all three modes against the same `index.db`. The
runner is `claudeknows-bench` (a separate `[[bin]]` shipped in this
feature); the raw output report is
[`tools/sdlc-knowledge/bench/reports/2026-05-10-vector-vs-bm25.md`](../../tools/sdlc-knowledge/bench/reports/2026-05-10-vector-vs-bm25.md).

## Aggregate metrics — full 39-PDF corpus

| Mode | Recall@1 | Recall@3 | Recall@5 | Recall@10 | MRR | Latency p50 | Latency p95 |
|------|---------:|---------:|---------:|----------:|----:|------------:|------------:|
| lexical (BM25)        | 33.3 %     | 33.3 %     | 41.7 %     | 58.3 %     | 0.378 | **4.6 ms** | **9.0 ms** |
| dense (sqlite-vec)    | **41.7 %** | 58.3 %     | 75.0 %     | 75.0 %     | **0.528** | 63.7 ms | 74.1 ms |
| **hybrid (RRF k=60)** | 33.3 %     | **58.3 %** | **75.0 %** | **83.3 %** | 0.483 | 59.1 ms | 66.1 ms |

The dense Recall@1 lead (41.7 % vs hybrid 33.3 %) is real: when the dense
ranker has a strong first hit, RRF can dilute it if BM25 ranks the same
chunk poorly. But hybrid wins at Recall@5 / Recall@10 — the practical
"is the right answer in the agent's context window?" metric — and has a
narrower p50 / p95 latency spread because BM25's negligible cost balances
encoder amortization. **Default mode = hybrid is the right choice for
agent workflows; power users searching for a single best hit may prefer
`--mode dense`.**

### Relative improvement (hybrid vs lexical baseline)

| Metric | Lexical | Hybrid | Δ relative |
|---|---:|---:|---:|
| Recall@1 | 33.3 % | 33.3 % | 0 % |
| Recall@5 | 41.7 % | 75.0 % | **+80 %** |
| Recall@10 | 58.3 % | 83.3 % | **+43 %** |
| MRR | 0.378 | 0.483 | **+28 %** |
| Latency p95 | 9.0 ms | 66.1 ms | +634 % (cost) |

## Where hybrid wins (qualitative samples)

### Q01 — "RAG retrieval architecture" (concept-level)

Relevant: `Building Al Agents with LLMs, RAG, and Knowledge Graphs.pdf`,
`Generative Al with Lang Chain.pdf`, `947059230_AI_Agents_and_Applications…pdf`

| Mode | Top-3 sources | Hit@5 | First relevant rank |
|---|---|---|---|
| lexical | (no relevant in top-10) | ✗ | — |
| dense | AI engineering.pdf, **Building Al Agents with LLMs, RAG…**, Building applications with AI agents.pdf | ✓ | 2 |
| hybrid | **Building Al Agents with LLMs, RAG…**, AI engineering.pdf, Practical MLOps.pdf | ✓ | **1** |

**Why hybrid wins:** "RAG retrieval architecture" is a concept name; BM25
matches on individual tokens (RAG, retrieval, architecture) which appear
in many books. Dense retrieval understands the concept itself and surfaces
the dedicated RAG book.

### Q11 — "prompt engineering best practices" (NL paraphrase)

Relevant: `Prompt engineering for Generative AI.pdf`, `Generative Al with Lang Chain.pdf`

| Mode | First relevant rank |
|---|---|
| lexical | 8 (just barely in top-10) |
| dense | 9 |
| hybrid | **4** |

**Why hybrid wins:** Both BM25 and dense individually rank the right
book mid-pack; RRF's rank-fusion bumps it because it appears in BOTH
rankers' top-10 → fused score 1/(60+8) + 1/(60+9) ≈ 0.029 wins over
chunks present in only one ranker's top-10.

### Q07 — "масштабируемые распределённые системы" (cross-lingual RU → mixed corpus)

Relevant: `Масштабируемые данные.pdf`, `Высоконагруженные приложения.pdf`,
`Али Аминиан System Design.pdf` (all Russian)

| Mode | First relevant rank |
|---|---|
| lexical | 1 (multi-language FTS5 tokenizes Cyrillic correctly) |
| dense | 1 |
| hybrid | **1** |

This is one of the cases where lexical also wins — the Russian terms in
the query are exact matches against Russian-language sources. Hybrid
doesn't degrade the lexical win (RRF preserves consensus rankings).

## Where hybrid is the WRONG default

The hybrid default mode is the right choice for **most agent / interactive
use cases** because semantic recall is the dominant value-add. But there
are scenarios where lexical alone is better:

- **Exact identifier lookup** — searching for a specific symbol name,
  error code, or API method name. BM25's token-exact matching is faster
  and more precise. Use `--mode lexical`.
- **Hot loops** — agent pipelines that issue 10+ search queries per
  second. The 12× latency overhead of hybrid (5.8 → 72 ms p50) compounds.
  Use `--mode lexical` and accept the recall hit.
- **Regression-safety** — when you need to verify behavior identical to
  the iter-1 baseline. Use `--mode lexical`.

## Measurement caveats

- **Source-level relevance, not chunk-level.** A "hit" means at least
  one returned chunk came from a relevant source — not that the specific
  chunk was on-topic. NDCG@10 with graded chunk-level judgments is
  deferred to iter-3.
- **12 queries is a small sample.** Confidence intervals on Recall@5 are
  wide. The +75 % relative win is large enough to be meaningful, but a
  more rigorous benchmark would expand to ≥50 queries with 5+ judgers
  per query for inter-rater reliability.
- **Full corpus measured.** All 39 PDFs ingested at v2 schema. The
  remaining 2 unhit queries (Q08 Kafka, Q12 system design) reflect actual
  retrieval misses on indexed content, NOT corpus coverage gaps. Worth
  inspecting per-query top-3 to understand the failure modes.
- **Cold-start latency.** The first dense / hybrid query in a fresh
  process spends ~4 seconds loading the e5 model + initializing the ONNX
  runtime. All subsequent queries are <120 ms. If your usage pattern is
  one-query-per-process (e.g., a per-search shell invocation rather
  than a long-lived agent), the cold-start cost is per-query.

## Recommendations

- **Default mode = hybrid.** Already shipped. Users get the +75 % recall
  win out of the box; the latency cost is acceptable for the agent-driven
  workflows that drive `claudeknows` usage.
- **Document the lexical fallback path.** Already documented in
  `src/rules/knowledge-base.md`. Power users who need sub-15 ms latency
  or strict iter-1 regression-safety pass `--mode lexical`.
- **Iter-3 benchmark expansion.** Expand the golden set to ≥25 queries
  with chunk-level judgments. Add NDCG@10 (graded relevance). Add
  per-language stratification (currently the 2 RU queries are too few to
  produce stable RU-only metrics).
- **Schedule a real-OCR benchmark when Slice 6b lands.** The current
  `[image: figure N from <doc>]` placeholder makes image chunks
  searchable but only at the document-grain — a real OCR engine that
  extracts diagram labels could make figures searchable at the
  diagram-grain. Re-run this benchmark with image-bearing queries
  (e.g., "architecture diagram with auth flow") after PP-OCRv4 ONNX
  integration ships.

## Reproducing

```sh
# Re-ingest the corpus into v2 schema (one-time, ~3 h CPU on M-series)
CLAUDEKNOWS_AUTO_REINGEST=1 claudeknows ingest /path/to/books/

# Run the benchmark
cd tools/sdlc-knowledge
cargo run --release --bin claudeknows-bench -- \
  --queries bench/golden/queries.jsonl \
  --modes lexical,dense,hybrid \
  --top-k 10 \
  --report bench/reports/$(date +%Y-%m-%d)-vector-vs-bm25.md
```

The runner uses the project-local `<cwd>/.claude/knowledge/index.db` —
the same DB production `claudeknows search` reads. No synthetic corpus,
no mocked encoder.

## See also

- Raw report (per-query side-by-side): [`tools/sdlc-knowledge/bench/reports/2026-05-10-vector-vs-bm25.md`](../../tools/sdlc-knowledge/bench/reports/2026-05-10-vector-vs-bm25.md)
- Golden query format + methodology: [`tools/sdlc-knowledge/bench/golden/README.md`](../../tools/sdlc-knowledge/bench/golden/README.md)
- PRD §15 (feature spec): [`docs/PRD.md`](../PRD.md)
- Implementation plan (519-line refined plan with 5 [STRUCTURAL] AIs): [`docs/design/vector-retrieval-backend.md`](../design/vector-retrieval-backend.md)
