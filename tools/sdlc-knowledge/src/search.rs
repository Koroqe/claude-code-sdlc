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
    /// BM25 score, NEGATED so larger = better match. Always > 0 for actual hits.
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
            let hit = SearchHit {
                chunk_id: r.get("chunk_id")?,
                source: r.get("source")?,
                ord: r.get("ord")?,
                score: r.get("score")?,
                snippet: r.get("snippet")?,
                context: None,
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
