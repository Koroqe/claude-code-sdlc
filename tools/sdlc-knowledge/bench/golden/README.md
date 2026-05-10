# Golden query set — vector-retrieval-backend benchmark

Manual relevance set for measuring retrieval quality across the three search
modes (`lexical` / `dense` / `hybrid`) on the user's curated 40-PDF corpus
at `/Users/aleksandra/Documents/claude-code-sdlc/books/`.

## Format

JSONL — one query per line. Schema:

```json
{
  "id": "Q01",
  "query": "free-text query string",
  "lang": "en | ru | cross",
  "category": "keyword | nl | cross | paraphrase",
  "relevant_sources": ["basename1.pdf", "basename2.pdf"]
}
```

## Relevance methodology

**Source-level relevance**, not chunk-level. For each query, the
`relevant_sources` list names the PDFs whose content covers the query's
topic. A retrieval result is considered "hit" if at least one returned
chunk's source basename matches a name in `relevant_sources`.

### Why source-level

Iter-2 implements heading-aware structural chunking (Slice 1) PLUS legacy
500-char sliding fallback. Chunk boundaries — and therefore chunk_ids —
are not stable across re-ingests with different chunker params. Pinning
relevance to source basenames keeps the golden set robust across chunker
evolution and avoids the manual per-re-ingest re-judging cost.

The trade-off: a "hit" by source means at least one returned chunk came
from a relevant source, NOT that the specific chunk was on-topic. This is
a slightly looser measure than chunk-level — but it's the right granularity
for "did the retriever find the right document?" which is what the
benchmark cares about.

## Categories

- `keyword` — exact-term queries (BM25 strong baseline)
- `nl` — natural-language phrasing (where dense should help)
- `cross` — cross-lingual (RU query against EN corpus or vice versa)
- `paraphrase` — semantic equivalence of different word choices

## Curation notes

12 queries spanning the four categories. Cross-lingual coverage: 2 RU queries
(Q05, Q07) against a corpus mixing RU + EN sources. Relevance was assigned
by inspecting source basenames against query topics — no per-chunk reading.
This is the "simple is enough" tier the user explicitly approved during
plan negotiation; expanding to ≥25 queries with chunk-level judgments is
deferred to iter-3 if the simple-tier benchmark identifies meaningful
recall gaps.

## How to run

```sh
cd tools/sdlc-knowledge
cargo run --release --bin claudeknows-bench -- \
  --queries bench/golden/queries.jsonl \
  --modes lexical,dense,hybrid \
  --top-k 10 \
  --report bench/reports/$(date +%Y-%m-%d)-vector-vs-bm25.md
```

The runner uses the same project-local index at
`<cwd>/.claude/knowledge/index.db` that production `claudeknows search`
uses. Slice 8 of vector-retrieval-backend re-ingests the books folder
into the v2 schema before the benchmark runs.
