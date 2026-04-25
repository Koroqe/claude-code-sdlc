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
///
/// FTS5 query-syntax errors (e.g. unquoted `AND`/`OR`) are mapped to
/// `SearchError::FtsSyntax` instead of bubbling up the raw rusqlite error so
/// the caller can map them to a non-panicking exit-1 with a friendly stderr.
pub fn search(
    conn: &Connection,
    query: &str,
    top_k: u32,
) -> Result<Vec<SearchHit>, SearchError> {
    let top_k = top_k.min(MAX_TOP_K) as i64;

    // SQL is a static literal; user data is bound via ?N. Negated bm25() — see
    // the module-level docstring for why.
    let sql = "SELECT chunks.id AS chunk_id, \
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
    let rows = stmt
        .query_map(rusqlite::params![query, top_k], |r| {
            Ok(SearchHit {
                chunk_id: r.get("chunk_id")?,
                source: r.get("source")?,
                ord: r.get("ord")?,
                score: r.get("score")?,
                snippet: r.get("snippet")?,
            })
        })
        .map_err(map_fts_syntax)?;

    let mut out = Vec::new();
    for row in rows {
        match row {
            Ok(hit) => out.push(hit),
            Err(e) => return Err(map_fts_syntax(e)),
        }
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
