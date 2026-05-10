//! BM25-ranked FTS5 search over the chunks table.
//!
//! ## BM25 score-direction convention (architect action item #3)
//!
//! SQLite's FTS5 `bm25()` function returns NEGATIVE values where a smaller
//! (more negative) value indicates a better match — see the SQLite FTS5 docs.
//! That convention is awkward for downstream JSON consumers (agents reading
//! `--json` output) because "larger = better" is the universal expectation.
//!
//! We therefore SELECT `-bm25(chunks_fts) AS score` and `ORDER BY score DESC`,
//! which flips the sign so:
//!
//!   - the JSON `score` field is always POSITIVE for any matching hit,
//!   - the array is sorted with `score` non-strictly DESCENDING (larger = better).
//!
//! The integration test `tc_aai_2_search_rs_uses_negated_bm25` greps this file
//! for the literal substring `-bm25(chunks_fts)` so a casual "clean-up" of the
//! SQL string will fail CI loudly.
//!
//! ## SQL discipline
//!
//! The SQL is a static `&str` literal; the user query is bound via `?1` and the
//! limit via `?2`. No `format!`/`+` interpolation of user data — Phase 1.5
//! Security MUST #4.

use rusqlite::Connection;
use serde::Serialize;
use thiserror::Error;

/// Maximum number of hits any single search may return (FR-3.2).
pub const MAX_TOP_K: u32 = 100;

/// Hard cap on the `--context` radius — prevents pathological "fetch the
/// whole book around each hit" patterns. With top_k=100 and context=10, a
/// single search bounds to 100×21=2100 chunk reads which is fine for an
/// FTS5-resident database; 10 is the conservative-but-useful ceiling.
pub const MAX_CONTEXT_RADIUS: u32 = 10;

/// One ranked search hit.
#[derive(Debug, Clone, Serialize)]
pub struct SearchHit {
    /// Source path of the document the chunk belongs to.
    pub source: String,
    /// Primary key of the chunk row (= FTS5 rowid).
    pub chunk_id: i64,
    /// Ordinal of the chunk inside the document (0-based).
    pub ord: i64,
    /// Final ranking score for the active mode:
    /// - lexical: NEGATED bm25 (larger = better; always > 0 for actual hits)
    /// - dense: NEGATED L2 distance to query embedding (larger = closer)
    /// - hybrid: RRF fused score (larger = better; range ~[0, 0.033] for k=60)
    pub score: f64,
    /// FTS5-generated snippet around the matching term(s).
    pub snippet: String,
    /// Optional ±N-chunk context window from the same document, populated
    /// only when the search was invoked with `--context N` where N > 0.
    /// Concatenation of `chunks.text` for ord in `[ord-N, ord+N]` joined by
    /// `\n` in ascending ord order. The matching chunk itself is included
    /// (so N=1 → 3 chunks; N=2 → 5 chunks). Omitted from JSON when None.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    /// Search mode that produced this hit (Slice 7 of vector-retrieval-backend).
    /// One of `"lexical" | "dense" | "hybrid"`. Omitted from JSON for legacy
    /// callers that constructed `SearchHit` without setting it (None).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode_used: Option<String>,
    /// Component BM25 score when the active mode is `hybrid`. Populated only
    /// when the chunk was a BM25-ranked hit; otherwise None.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bm25_score: Option<f64>,
    /// Component dense score (NEGATED L2 distance) when the active mode is
    /// `dense` or `hybrid`. Populated only when the chunk was a dense-ranked hit.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dense_score: Option<f64>,
    /// Component RRF score when the active mode is `hybrid`. Always populated
    /// for hybrid hits. Sum of `1/(60 + rank_lex) + 1/(60 + rank_dense)` per
    /// the canonical RRF formula (Cormack et al. 2009, k=60).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rrf_score: Option<f64>,
}

#[derive(Debug, Error)]
pub enum SearchError {
    #[error("FTS5 query syntax error: {0}")]
    FtsSyntax(String),
    #[error(transparent)]
    Db(#[from] rusqlite::Error),
}

/// Run a BM25-ranked FTS5 query and return up to `top_k` hits, descending by score.
///
/// `top_k` is clamped to `MAX_TOP_K` (= 100) per FR-3.2.
/// `context_radius` is clamped to `MAX_CONTEXT_RADIUS` (= 10).
///
/// When `context_radius > 0`, each hit's `context` field is populated with
/// the concatenated text of chunks `[ord - radius, ord + radius]` from the
/// same document, in ascending ord order, joined by `\n`. Chunks that fall
/// outside the document's actual ord range (e.g. when a hit is at the start
/// or end of a document) are simply omitted — the context is shorter at the
/// boundaries rather than padded.
///
/// FTS5 query-syntax errors (e.g. unquoted `AND`/`OR`) are mapped to
/// `SearchError::FtsSyntax` instead of bubbling up the raw rusqlite error so
/// the caller can map them to a non-panicking exit-1 with a friendly stderr.
pub fn search(
    conn: &Connection,
    query: &str,
    top_k: u32,
    context_radius: u32,
) -> Result<Vec<SearchHit>, SearchError> {
    let top_k = top_k.min(MAX_TOP_K) as i64;
    let context_radius = context_radius.min(MAX_CONTEXT_RADIUS) as i64;

    // SQL is a static literal; user data is bound via ?N. Negated bm25() — see
    // the module-level docstring for why. `chunks.doc_id` is selected for the
    // optional context fetch below but is NOT exposed in `SearchHit` — the
    // public JSON shape stays stable for `--context 0` (default) consumers.
    let sql = "SELECT chunks.id AS chunk_id, \
                      chunks.doc_id AS doc_id, \
                      documents.source_path AS source, \
                      chunks.ord AS ord, \
                      -bm25(chunks_fts) AS score, \
                      snippet(chunks_fts, 0, '', '', '…', 32) AS snippet \
               FROM chunks_fts \
               JOIN chunks ON chunks.id = chunks_fts.rowid \
               JOIN documents ON documents.id = chunks.doc_id \
               WHERE chunks_fts MATCH ?1 \
               ORDER BY score DESC \
               LIMIT ?2";

    let mut stmt = conn.prepare(sql).map_err(map_fts_syntax)?;
    // Collect (hit, doc_id) tuples — doc_id is needed only for context fetch
    // and is dropped before returning.
    let rows = stmt
        .query_map(rusqlite::params![query, top_k], |r| {
            let score: f64 = r.get("score")?;
            let hit = SearchHit {
                chunk_id: r.get("chunk_id")?,
                source: r.get("source")?,
                ord: r.get("ord")?,
                score,
                snippet: r.get("snippet")?,
                context: None,
                mode_used: Some("lexical".to_string()),
                bm25_score: Some(score),
                dense_score: None,
                rrf_score: None,
            };
            let doc_id: i64 = r.get("doc_id")?;
            Ok((hit, doc_id))
        })
        .map_err(map_fts_syntax)?;

    let mut intermediate: Vec<(SearchHit, i64)> = Vec::new();
    for row in rows {
        match row {
            Ok(t) => intermediate.push(t),
            Err(e) => return Err(map_fts_syntax(e)),
        }
    }

    // Backward-compat fast path: no context expansion, drop doc_id and return.
    if context_radius == 0 {
        return Ok(intermediate.into_iter().map(|(h, _)| h).collect());
    }

    // Per-hit context fetch. Static SQL, bound params, prepared once and
    // reused via `prepare_cached`. Per-document N+1 query pattern is
    // acceptable for top_k ≤ 100; a window-function single-query rewrite is
    // possible but the readability win outweighs the perf cost here.
    const CONTEXT_SQL: &str = "SELECT text FROM chunks \
                               WHERE doc_id = ?1 \
                                 AND ord BETWEEN ?2 AND ?3 \
                               ORDER BY ord";

    let mut out = Vec::with_capacity(intermediate.len());
    for (mut hit, doc_id) in intermediate {
        let lo = hit.ord - context_radius;
        let hi = hit.ord + context_radius;
        let mut ctx_stmt = conn.prepare_cached(CONTEXT_SQL)?;
        let texts: Result<Vec<String>, rusqlite::Error> = ctx_stmt
            .query_map(rusqlite::params![doc_id, lo, hi], |r| r.get::<_, String>(0))?
            .collect();
        let texts = texts?;
        if !texts.is_empty() {
            hit.context = Some(texts.join("\n"));
        }
        out.push(hit);
    }
    Ok(out)
}

/// Map a rusqlite error to `SearchError::FtsSyntax` if the message looks like
/// an FTS5 syntax error; otherwise pass through as `Db`.
fn map_fts_syntax(e: rusqlite::Error) -> SearchError {
    let msg = format!("{e}");
    let lower = msg.to_lowercase();
    if lower.contains("fts5") && lower.contains("syntax") {
        return SearchError::FtsSyntax(msg);
    }
    // SQLite raises generic "syntax error near ..." for malformed FTS5 MATCH
    // expressions in some versions; treat any error mentioning the MATCH
    // operator or the FTS query parser as syntax.
    if lower.contains("syntax error") || lower.contains("malformed match") {
        return SearchError::FtsSyntax(msg);
    }
    SearchError::Db(e)
}

// ===========================================================================
// Slice 7 of vector-retrieval-backend — dense + hybrid retrieval.
// ===========================================================================

/// Reciprocal Rank Fusion smoothing constant. Cormack/Clarke/Buttcher 2009
/// canonical value; verified against three independent corpus citations
/// (LangChain in Action, AI Agents and Applications, etc.) during
/// architecture review.
pub const RRF_K: f64 = 60.0;

/// Default per-source candidate inflation for hybrid search. Each ranker
/// (BM25 + dense) returns `top_k * HYBRID_FACTOR` candidates; RRF fuses
/// the union and returns the final `top_k`.
pub const HYBRID_FACTOR: u32 = 4;

/// Run a sqlite-vec K-NN search over the `chunks_vec` virtual table for the
/// given query embedding (typically produced by `crate::encoder::encode_query`).
///
/// `query_embedding` MUST be a `f32` slice of length 384 (matching the
/// e5-multilingual-small output dimension); other lengths produce a SQLite
/// error from sqlite-vec which we surface as `SearchError::Db`.
///
/// Returns up to `top_k` hits ordered by ascending L2 distance (= descending
/// cosine similarity for L2-normalized vectors, which e5 emits). The
/// `score` field is `-distance` (negated so larger = better, matching the
/// BM25 convention for hybrid fusion).
pub fn dense_search(
    conn: &Connection,
    query_embedding: &[f32],
    top_k: u32,
) -> Result<Vec<SearchHit>, SearchError> {
    let top_k = top_k.min(MAX_TOP_K) as i64;
    let bytes: Vec<u8> = query_embedding.iter().flat_map(|f| f.to_le_bytes()).collect();
    // sqlite-vec requires the K-NN count via `k = ?` constraint in the WHERE
    // clause (a parameterized LIMIT alone fails with
    // "A LIMIT or 'k = ?' constraint is required on vec0 knn queries").
    // We bind both `?1` (query embedding bytes) and `?2` (k = top_k) and
    // skip the SQL-level LIMIT clause.
    let sql = "SELECT chunks.id AS chunk_id, \
                      documents.source_path AS source, \
                      chunks.ord AS ord, \
                      chunks.text AS chunk_text, \
                      distance \
               FROM chunks_vec \
               JOIN chunks ON chunks.id = chunks_vec.rowid \
               JOIN documents ON documents.id = chunks.doc_id \
               WHERE chunks_vec.embedding MATCH ?1 AND k = ?2 \
               ORDER BY distance";
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(rusqlite::params![bytes, top_k], |r| {
        let distance: f64 = r.get("distance")?;
        let dense_score = -distance; // larger = closer
        let chunk_text: String = r.get("chunk_text")?;
        // No FTS5 snippet for dense hits — synthesize a short snippet from
        // the first 200 chars of the chunk text.
        let snippet = if chunk_text.chars().count() > 200 {
            let truncated: String = chunk_text.chars().take(200).collect();
            format!("{truncated}…")
        } else {
            chunk_text
        };
        Ok(SearchHit {
            chunk_id: r.get("chunk_id")?,
            source: r.get("source")?,
            ord: r.get("ord")?,
            score: dense_score,
            snippet,
            context: None,
            mode_used: Some("dense".to_string()),
            bm25_score: None,
            dense_score: Some(dense_score),
            rrf_score: None,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Hybrid search: BM25 (FTS5) ⊕ dense (sqlite-vec) fused via Reciprocal Rank
/// Fusion with k=60 (architect-resolved canonical value). Each ranker returns
/// `top_k * HYBRID_FACTOR` candidates; RRF computes a fused score per
/// candidate-chunk-id and the top-`top_k` are returned.
///
/// `query_text` drives the BM25 path; `query_embedding` drives the dense path.
/// Callers (CLI / test harnesses) typically obtain the embedding via
/// `crate::encoder::encode_query(query_text)` so both rankers see semantically
/// aligned inputs.
///
/// The returned `SearchHit.score` is the RRF fused score; component scores
/// are populated in `bm25_score` / `dense_score` / `rrf_score` for telemetry
/// and benchmarking transparency.
pub fn hybrid_search(
    conn: &Connection,
    query_text: &str,
    query_embedding: &[f32],
    top_k: u32,
) -> Result<Vec<SearchHit>, SearchError> {
    let candidate_k = top_k.saturating_mul(HYBRID_FACTOR).min(MAX_TOP_K);
    let lex_hits = search(conn, query_text, candidate_k, 0)?;
    let dense_hits = dense_search(conn, query_embedding, candidate_k)?;
    Ok(rrf_fuse(&lex_hits, &dense_hits, top_k))
}

/// Reciprocal Rank Fusion. Pure function — testable in isolation against
/// known input rankings (architect AI-4 golden test).
///
/// For each candidate chunk_id present in either ranker, computes:
///   score(d) = Σ_i 1/(RRF_K + rank_i(d))
/// where `rank_i` is 1-based rank in ranker `i`. Candidates absent from a
/// ranker contribute 0 from that ranker. Returns top-`top_k` by fused score
/// in descending order, populated with both component scores plus the RRF
/// score for telemetry.
pub fn rrf_fuse(lex: &[SearchHit], dense: &[SearchHit], top_k: u32) -> Vec<SearchHit> {
    use std::collections::HashMap;
    let mut by_id: HashMap<i64, SearchHit> = HashMap::new();
    let mut rrf: HashMap<i64, f64> = HashMap::new();
    let mut bm25: HashMap<i64, f64> = HashMap::new();
    let mut dscore: HashMap<i64, f64> = HashMap::new();

    for (rank0, hit) in lex.iter().enumerate() {
        let rank1 = rank0 as f64 + 1.0;
        *rrf.entry(hit.chunk_id).or_insert(0.0) += 1.0 / (RRF_K + rank1);
        bm25.entry(hit.chunk_id).or_insert(hit.score);
        // Capture full hit metadata from whichever ranker saw it first;
        // dense hits override below if they have richer info.
        by_id.entry(hit.chunk_id).or_insert_with(|| hit.clone());
    }
    for (rank0, hit) in dense.iter().enumerate() {
        let rank1 = rank0 as f64 + 1.0;
        *rrf.entry(hit.chunk_id).or_insert(0.0) += 1.0 / (RRF_K + rank1);
        dscore.entry(hit.chunk_id).or_insert(hit.score);
        by_id.entry(hit.chunk_id).or_insert_with(|| hit.clone());
    }

    let mut fused: Vec<SearchHit> = by_id
        .into_iter()
        .map(|(id, mut hit)| {
            let r = *rrf.get(&id).unwrap_or(&0.0);
            hit.score = r;
            hit.rrf_score = Some(r);
            hit.bm25_score = bm25.get(&id).copied();
            hit.dense_score = dscore.get(&id).copied();
            hit.mode_used = Some("hybrid".to_string());
            hit
        })
        .collect();

    fused.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    fused.truncate(top_k as usize);
    fused
}
