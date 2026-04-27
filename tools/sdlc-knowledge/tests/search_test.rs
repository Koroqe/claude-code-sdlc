//! Slice 3 search-layer tests (lib API, in-memory SQLite).
//!
//! Coverage:
//! - 20-doc fixture, 5 chunks each; a unique term in 3 chunks across 2 docs.
//! - Search returns ≤ top_k hits, scores POSITIVE, array DESCENDING (TC-AAI-2).
//! - Empty-result query returns empty Vec, no error.
//! - FTS5 syntax error mapped to SearchError::FtsSyntax (no panic).
//! - top_k = 1000 clamped to ≤ 100 per FR-3.2.

use rusqlite::params;
use sdlc_knowledge::migrations;
use sdlc_knowledge::search::{self, SearchError};
use sdlc_knowledge::store;

/// Seed an in-memory-style temp DB with `n_docs` docs × `chunks_per_doc` chunks.
/// Chunks contain the literal `lorem ipsum word{ord}` so each chunk has a unique
/// token plus shared filler. Inject `unique_term` into exactly the chunks listed
/// in `unique_chunks` (a slice of `(doc_idx, chunk_ord)` pairs).
fn seed_db(
    n_docs: usize,
    chunks_per_doc: usize,
    unique_term: &str,
    unique_chunks: &[(usize, usize)],
) -> (tempfile::TempDir, rusqlite::Connection) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let db_path = tmp.path().join("index.db");
    let mut conn = store::open_or_init(&db_path).expect("open_or_init");
    migrations::run_migrations(&mut conn).expect("run_migrations");

    for d in 0..n_docs {
        let path = format!("/proj/doc_{d}.md");
        let id = store::upsert_document(&conn, &path, 1_000 + d as i64, "deadbeef", 100i64)
            .expect("upsert doc");

        for ord in 0..chunks_per_doc {
            let mut text = format!("lorem ipsum filler doc{d} word{ord}");
            if unique_chunks.iter().any(|(di, ci)| *di == d && *ci == ord) {
                text.push(' ');
                text.push_str(unique_term);
            }
            // Add boost copies on the chunk that should rank #1: doc 0 chunk 0.
            if d == 0 && ord == 0 && unique_chunks.iter().any(|(di, ci)| *di == d && *ci == ord) {
                for _ in 0..5 {
                    text.push(' ');
                    text.push_str(unique_term);
                }
            }
            conn.execute(
                "INSERT INTO chunks(doc_id, ord, text) VALUES (?1, ?2, ?3)",
                params![id, ord as i64, text],
            )
            .expect("insert chunk");
        }
    }
    (tmp, conn)
}

#[test]
fn search_returns_positive_descending_scores() {
    // 20 docs × 5 chunks; place the unique term `widgetron` in 3 chunks across 2 docs.
    let (_tmp, conn) = seed_db(
        20,
        5,
        "widgetron",
        &[(0, 0), (0, 2), (3, 1)],
    );

    let hits = search::search(&conn, "widgetron", 3, 0).expect("search ok");
    assert_eq!(hits.len(), 3, "expected 3 hits, got {}", hits.len());

    for h in &hits {
        assert!(
            h.score > 0.0,
            "score must be positive (negated bm25); got {}",
            h.score
        );
    }
    for w in hits.windows(2) {
        assert!(
            w[0].score >= w[1].score,
            "scores must be non-strictly descending; got {} then {}",
            w[0].score,
            w[1].score
        );
    }
}

#[test]
fn search_empty_result_returns_empty_vec_no_error() {
    let (_tmp, conn) = seed_db(5, 3, "widgetron", &[(0, 0)]);
    let hits = search::search(&conn, "thiswordnevereverappears", 5, 0).expect("search ok");
    assert!(hits.is_empty(), "expected empty, got {} hits", hits.len());
}

#[test]
fn search_fts5_syntax_error_returns_fts_syntax_variant() {
    let (_tmp, conn) = seed_db(5, 3, "widgetron", &[(0, 0)]);
    // "AND OR" without quoting is invalid FTS5 syntax.
    let err = search::search(&conn, "AND OR", 5, 0).expect_err("must be syntax error");
    match err {
        SearchError::FtsSyntax(_) => {}
        other => panic!("expected FtsSyntax, got: {other:?}"),
    }
}

#[test]
fn search_top_k_clamped_to_one_hundred() {
    // Seed enough chunks that the term can match >100 chunks.
    let mut unique = Vec::new();
    for d in 0..30 {
        for c in 0..5 {
            unique.push((d, c));
        }
    }
    let (_tmp, conn) = seed_db(30, 5, "ubiquitous", &unique);

    // Request 1000; FR-3.2 clamps to ≤ 100.
    let hits = search::search(&conn, "ubiquitous", 1000, 0).expect("search ok");
    assert!(
        hits.len() <= 100,
        "top_k must be clamped to ≤ 100 per FR-3.2; got {}",
        hits.len()
    );
}

#[test]
fn search_includes_snippet_field() {
    let (_tmp, conn) = seed_db(5, 3, "widgetron", &[(0, 0), (1, 1)]);
    let hits = search::search(&conn, "widgetron", 5, 0).expect("search ok");
    assert!(!hits.is_empty(), "expected at least one hit");
    for h in &hits {
        assert!(!h.source.is_empty(), "source path should not be empty");
        assert!(h.chunk_id > 0, "chunk_id should be a positive row id");
        assert!(h.ord >= 0, "ord must be non-negative");
        // Snippet may legitimately be empty for very short text after FTS5
        // truncates, but for our seed it must contain SOMETHING.
        assert!(!h.snippet.is_empty(), "snippet should not be empty");
        // Default (radius=0) MUST omit the context field.
        assert!(h.context.is_none(), "context must be None when radius=0");
    }
}

#[test]
fn search_context_zero_keeps_context_none() {
    let (_tmp, conn) = seed_db(2, 5, "widgetron", &[(0, 2)]);
    let hits = search::search(&conn, "widgetron", 5, 0).expect("search ok");
    for h in &hits {
        assert!(h.context.is_none(), "context must be None when radius=0");
    }
}

#[test]
fn search_context_one_returns_three_chunks_concatenated() {
    // doc 0 has 5 chunks (ord 0..=4). Place `widgetron` in chunk ord=2 (middle).
    // With radius=1 we expect context = chunks ord=[1,2,3] joined by '\n'.
    let (_tmp, conn) = seed_db(1, 5, "widgetron", &[(0, 2)]);
    let hits = search::search(&conn, "widgetron", 5, 1).expect("search ok");
    assert_eq!(hits.len(), 1, "exactly one hit expected");
    let h = &hits[0];
    let ctx = h.context.as_ref().expect("context must be populated when radius>0");
    // Context lines should reference word1, word2, word3 (one per chunk).
    assert!(ctx.contains("word1"), "context must include preceding chunk text: {ctx}");
    assert!(ctx.contains("word2"), "context must include matching chunk text: {ctx}");
    assert!(ctx.contains("word3"), "context must include following chunk text: {ctx}");
    // Two newlines split 3 chunks.
    assert_eq!(ctx.matches('\n').count(), 2, "expected 2 newline separators (3 chunks): {ctx}");
}

#[test]
fn search_context_at_document_start_truncates() {
    // Hit at ord=0 — there is NO chunk at ord=-1, so radius=2 should return
    // only chunks 0,1,2 (3 chunks, not 5).
    let (_tmp, conn) = seed_db(1, 5, "widgetron", &[(0, 0)]);
    let hits = search::search(&conn, "widgetron", 5, 2).expect("search ok");
    assert_eq!(hits.len(), 1);
    let ctx = hits[0].context.as_ref().expect("context must be present");
    assert_eq!(ctx.matches('\n').count(), 2, "boundary-truncated context: {ctx}");
}

#[test]
fn search_context_radius_is_clamped_to_max() {
    // Pass an absurdly large radius — the clamp to MAX_CONTEXT_RADIUS (=10)
    // means the BETWEEN range stays bounded; for a 5-chunk doc, we get the
    // whole document (5 chunks → 4 newlines), not a panic or runaway query.
    let (_tmp, conn) = seed_db(1, 5, "widgetron", &[(0, 2)]);
    let hits = search::search(&conn, "widgetron", 5, 10_000).expect("search ok");
    assert_eq!(hits.len(), 1);
    let ctx = hits[0].context.as_ref().expect("context must be present");
    assert_eq!(ctx.matches('\n').count(), 4, "5-chunk doc → 4 separators: {ctx}");
}
