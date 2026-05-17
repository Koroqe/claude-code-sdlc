# Plan: Medium article for `claudebase` — story, evolution, decisions, benchmarks

## Context

The user wants a long-form Medium article telling the story of `claudebase` — a local-first hybrid lexical+dense+RRF retrieval CLI extracted on 2026-05-10 from the SDLC monorepo into its own repo. The article must focus on the RETRIEVAL tool specifically (not the entire SDLC pipeline), cover the idea and the evolution from BM25-only iter-1 to hybrid iter-2, the load-bearing technical decisions made along the way, and the concrete benchmark numbers.

All the source material already exists:
- `claudebase/docs/architecture/technical-decisions.md` — 5-step "How vector search works end-to-end" walkthrough + decision narratives (why hybrid, L2 vs cosine math, why fastembed-rs, why ocr-rs MNN over paddle-ocr-rs ONNX, why placeholder text for image chunks, page-level addressing).
- `claudebase/docs/benchmarks/2026-05-10-baseline.md` — 12-query golden-set numbers: Lexical / Dense / Hybrid Recall@1/3/5/10, MRR, p50/p95 latency; concrete qualitative samples (Q01 RAG, Q11 prompt engineering, Q07 Russian cross-lingual); +75% Recall@5 over BM25 baseline headline.
- `claudebase/docs/article/00-overview.md` — staging directory with a draft outline (kept as-is; the new article goes in a new file alongside).

The article is published to `claudebase/docs/article/01-claudebase-story.md` (Medium-ready Markdown, single file, English so Medium's reach is maximized; Russian example queries preserved verbatim to concretely demonstrate the cross-lingual capability).

Target length: ~3500 words, structured for Medium readability (short paragraphs, code blocks with syntax highlighting, tables for benchmark numbers).

## Implementation slices (1 slice / 1 wave)

### Slice 1: Write + commit + publish the article

- **Files**:
  - NEW: `claudebase/docs/article/01-claudebase-story.md` (the article itself)
  - MODIFIED: `claudebase/docs/article/00-overview.md` (one-line update: replace the "Stub status" trailer with a link to `01-claudebase-story.md`)

- **Article structure** (10 sections, Medium-ready):

  1. **Lede** (~200 words) — the hook. A concrete Russian query about scalable distributed systems that BM25 either matches or misses, framing the question: what does it take to make a 39-PDF library readable by an LLM agent that doesn't speak the corpus's language?

  2. **The problem space** (~300 words) — why LLM agents need a per-project knowledge base, why local-first beats hosted vector DBs for this niche, the single-SQLite-file invariant (`index.db` co-locates FTS5 + sqlite-vec + raw chunks + page-text + image BLOBs), how this contrasts with Qdrant/Pinecone deployments.

  3. **Iter-1: BM25 over SQLite FTS5** (~400 words) — the MVP shipped in `sdlc-knowledge v0.3.x`: pdfium-render → 500-char sliding-window chunks → FTS5 `chunks_fts` virtual table → BM25 ranking. What worked (5-10 ms queries, deterministic, zero deploy). The three failure modes that drove iter-2: cross-lingual misses (concrete `как настроить отказоустойчивость` → 0 BM25 hits despite content existing), no semantic recall (paraphrase fail: "how to authenticate" misses "user verification"), concept-level queries that BM25 ranks glossary-pages high for (e.g. "RAG retrieval architecture").

  4. **The pivot: hybrid retrieval** (~500 words) — decision narrative for iter-2. Why not pure dense (BM25 catches OOD tokens / API names / error codes that no encoder can embed reliably). Why fusion. Why Reciprocal Rank Fusion specifically over weighted-sum-of-normalized-scores (no normalization between rankers needed; the k=60 smoothing constant balances rank-1 dominance with rank-5-to-10 contribution). The architectural sketch: BM25 over FTS5 + dense K-NN over sqlite-vec, fused via `score_RRF(d) = Σᵢ 1/(60 + rankᵢ(d))`, all in the same `index.db`.

  5. **The 5-step walkthrough** (~700 words) — the pedagogical core, lifted from `technical-decisions.md` "How vector search works end-to-end" and rewritten for a general technical audience. Step 1: ingest-time encoding (e5-multilingual-small → 384-dim L2-normalized vector → `chunks_vec`). Step 2: query-time encoding + sqlite-vec K-NN (exact scan, 6-7 ms on 75 k vectors). Step 3: the L2 vs cosine math — `L2² = 2 − 2·cos(θ)` for unit-norm vectors means L2 ranking IS cosine ranking (with the cos = 1 − L2²/2 conversion shown). Step 4: the e5 `passage:` / `query:` prefix asymmetry contract and how I enforce it (API design + runtime regression test). Step 5: hybrid via RRF k=60 — the formula, why k=60 is the Cormack 2009 canonical value, what gets fused (top-K·4 from each ranker, return top-K of the fused list). Include code snippets — the actual `dense_search()` SQL, the e5 prefix calls, the RRF Rust loop.

  6. **Decisions made under pressure** (~500 words) — the war stories. The fastembed-rs choice (save 500 LOC of XLM-RoBERTa SentencePiece tokenizer). The paddle-ocr-rs version conflict drama (PaddleOCR via ort + fastembed via ort = 9 compile errors in `ort::value::impl_tensor::create`; switched to `ocr-rs` MNN runtime which has no ort dep at all). The L2-vs-cosine migration-cost call (chose to document the equivalence rather than re-create chunks_vec and re-embed 75 k chunks for purely cosmetic score-shape). The image-as-BLOB choice (preserves single-file invariant, ~28 MB overhead per typical PDF acceptable). The intentional `[image: figure N from <doc>]` placeholder mode for image chunks until OCR model files land (image chunks remain dense+BM25 searchable at document-grain even before real OCR).

  7. **The numbers** (~500 words) — actual benchmark from the golden 12-query set. Three modes side-by-side table (Recall@1/3/5/10, MRR, latency p50/p95). Headline: +75% Recall@5 over BM25 baseline (75.0% vs 41.7%); +43% Recall@10 (83.3% vs 58.3%); +28% MRR (0.483 vs 0.378). The cost: 9 ms → 66 ms p95 (still well under the 500 ms NFR budget). The latency-vs-recall trade-off discussion. Three qualitative samples preserved with their actual chunk ranks: Q01 "RAG retrieval architecture" (lexical: no hit; hybrid: dedicated RAG book at rank 1). Q11 "prompt engineering best practices" (RRF rank-fusion bumps a mid-pack lexical-and-dense match to rank 4). Q07 Russian cross-lingual against Russian-language sources where lexical and dense both win — demonstrating that hybrid doesn't degrade consensus.

  8. **The post-shipping migration** (~300 words) — the day-after story. The Rust crate started as `tools/sdlc-knowledge/` in a monorepo; that turned out to be the wrong default (it's an independent product, not an SDLC harness slice). The 2026-05-10 extraction to `github.com/codefather-labs/claudebase` as a standalone repo. The rename mapping (`sdlc-knowledge` → `claudebase`; `claudeknows` CLI alias → `claudebase`; install path `~/.claude/tools/sdlc-knowledge/` → `~/.claude/tools/claudebase/`). The install.sh auto-migration: detects the old install on next run, removes the old directory + old symlink, downloads the new binary from the new repo's release. Version-continued (sdlc-knowledge-v0.4.0 → claudebase-v0.4.0) so no version regression for users.

  9. **What's next** (~200 words) — honest roadmap. ANN index (HNSW/IVF via sqlite-vec) when corpora exceed ~1M chunks (exhaustive K-NN starts to bite). Real OCR end-to-end (the ocr-rs MNN engine is wired in; the user just hasn't placed model files yet; once they do, image chunks re-embed automatically on next ingest with no schema change). Per-language stratified benchmarks expanded to ≥50 queries with multiple judgers. A potential Tantivy-backed lexical alternative if FTS5 hits scalability ceilings.

  10. **Try it** (~100 words) — install one-liner, first query, link to GitHub repo + docs.

- **Code snippets** to include:
  - The `sqlite-vec` K-NN SQL: `WHERE chunks_vec.embedding MATCH ?1 AND k = ?2 ORDER BY distance`
  - The FTS5 BM25 SQL: `-bm25(chunks_fts) AS score ... ORDER BY score DESC`
  - The e5 prefix discipline in Rust: `encode_passages()` vs `encode_query()`
  - The RRF formula in Rust: the `for hit in ranker { score += 1.0 / (RRF_K + rank) }` loop
  - The L2/cosine equivalence proof + the `cos = 1 − L2²/2` decoder

- **Tables**:
  - Benchmark aggregate (3 modes × 4 Recall@K + MRR + 2 latency columns)
  - Relative improvement (hybrid vs lexical) — 4 metric rows
  - L2-to-cosine decoder (5 row sample)

- **Tone**: First-person singular ("I"), conversational-technical, paragraphs ≤ 4 sentences, no jargon without immediate definition. Russian quoted verbatim where it appears in evidence (Q07 query, the chaos-engineering page snippet). Voice consistent with the existing `technical-decisions.md` "How vector search works end-to-end" walkthrough but rewritten for a Medium audience that doesn't necessarily know the project.

- **Verify**:
  - `wc -w claudebase/docs/article/01-claudebase-story.md` ≥ 2500 (target ~3500)
  - `grep -c "^## " claudebase/docs/article/01-claudebase-story.md` returns 10
  - `grep -c "claudebase" claudebase/docs/article/01-claudebase-story.md` ≥ 20
  - `grep -F "RRF" claudebase/docs/article/01-claudebase-story.md` returns ≥ 5 hits
  - `grep -F "cos = 1 − L2²" claudebase/docs/article/01-claudebase-story.md` returns ≥ 1 hit
  - `grep -F "L2 = √(2 − 2·cos" claudebase/docs/article/01-claudebase-story.md` returns ≥ 1 hit (or the analogous formula text)
  - `grep -F "Cormack" claudebase/docs/article/01-claudebase-story.md` returns ≥ 1 hit
  - Article references benchmark numbers verbatim from `2026-05-10-baseline.md` (75.0% / 83.3% / 0.483 / 66 ms)

- **Done when**: file exists, passes verification greps, reads naturally start-to-finish without bare `TODO`s, all 10 sections present, ready to copy-paste into Medium's editor.

- **Pre-review**: none (long-form writing; the user will edit before publishing)

### Slice 2: Update staging overview + commit + push

- **Files**: `claudebase/docs/article/00-overview.md` — replace the "Stub status" trailer with a one-line pointer at `01-claudebase-story.md` (the staging directory is no longer a stub once the article exists).

- **Changes**:
  - `cd claudebase`
  - `git status` to confirm the diff is the new article + the trailer update
  - `git add docs/article/`
  - `git commit -m "docs(article): first Medium draft — claudebase story, decisions, benchmarks"`
  - `git push origin main` (Sensitive — public commit; user already approved this flow in the previous extraction)

- **Verify**: `git log -1 --oneline` on the claudebase repo shows the new commit; `gh repo view codefather-labs/claudebase --web` (if browsed) shows `docs/article/01-claudebase-story.md` in the file tree.

- **Done when**: claudebase main branch on GitHub holds the article; the user can open it on GitHub or copy-paste the raw Markdown into Medium's editor.

## Files affected

**NEW**:
- `claudebase/docs/article/01-claudebase-story.md` (~3500 words)

**MODIFIED**:
- `claudebase/docs/article/00-overview.md` (one-line replacement of the "Stub status" trailer)

**INTENTIONALLY UNCHANGED**:
- All source material (`technical-decisions.md`, `2026-05-10-baseline.md`) — these are the canonical engineering documents; the article is a derivative work and must NOT diverge from the numbers / claims in those files.
- SDLC repo (`/Users/aleksandra/Documents/claude-code-sdlc/`) — the article lives in the claudebase repo only.

## Risks and dependencies

1. **R1 — Article-vs-source drift**: if the article quotes specific numbers (75.0% Recall@5, 0.483 MRR, etc.) and the underlying benchmark report later changes, the article goes stale. Mitigation: footer line in the article noting "numbers verbatim from `docs/benchmarks/2026-05-10-baseline.md`" and pinning the benchmark date in-text. Risk accepted — the article is a snapshot, not a live document.

2. **R2 — Medium-specific Markdown quirks**: Medium's editor strips some Markdown extensions (tables render but lose alignment; nested code fences need escape). Mitigation: keep tables simple (pipe-delimited, no alignment chars beyond `:---:`), avoid nested fences, use ASCII for the formula blocks rather than Unicode math symbols that Medium may not render.

3. **R3 — First-person voice when there were multiple authors**: the project was built collaboratively (vladcraftcom did the post-extraction page-tracking work; I did the iter-2 hybrid + multimodal). Mitigation: use "I" sparingly for first-person decisions ("I chose RRF k=60") but "we" or passive voice for collaborative work; explicit acknowledgement section at the end if the user wants it.

4. **R4 — Language choice**: the user asks in Russian; the article is in English. The trade-off: Medium English audience is 50–100× larger; Russian readers can use the Q07 cross-lingual evidence as a strong language-mixing demonstration. Decision: English, Russian queries preserved verbatim in evidence. If the user wants a Russian translation later, that's a follow-up.

## Verification (end-to-end)

```bash
cd /Users/aleksandra/Documents/claude-code-sdlc/claudebase

# A. Article exists and is substantial
[ -f docs/article/01-claudebase-story.md ]
words=$(wc -w < docs/article/01-claudebase-story.md)
[ "$words" -ge 2500 ] && echo "word count: $words ✓"

# B. All 10 sections present
sections=$(grep -c "^## " docs/article/01-claudebase-story.md)
[ "$sections" -ge 10 ] && echo "sections: $sections ✓"

# C. Key technical content present
grep -F "cos = 1" docs/article/01-claudebase-story.md   # L2/cosine equivalence
grep -F "RRF" docs/article/01-claudebase-story.md | wc -l   # ≥ 5
grep -F "Cormack" docs/article/01-claudebase-story.md   # RRF citation
grep -F "passage:" docs/article/01-claudebase-story.md  # e5 prefix
grep -F "75" docs/article/01-claudebase-story.md       # +75% Recall@5

# D. Cross-lingual evidence preserved
grep -F "масштабируемые" docs/article/01-claudebase-story.md || \
  grep -F "хаос инжиниринг" docs/article/01-claudebase-story.md

# E. Staging overview updated (no more "Stub status" trailer)
! grep -q "Stub status" docs/article/00-overview.md

# F. Commit landed
git log -1 --oneline | grep -q "Medium\|article"

# G. Pushed
git fetch origin main && \
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]
```

All 7 verification blocks PASS = article shipped and discoverable in the claudebase repo.

## Review Notes

(filled in after Plan Critic pass — this is a writing task, not a code change, so the standard Plan Critic checks for slice quality / dependency ordering / etc. mostly don't apply; the load-bearing review is: does the article accurately reflect the engineering decisions, do the numbers match the benchmark report, is the voice consistent with the rest of the docs.)
