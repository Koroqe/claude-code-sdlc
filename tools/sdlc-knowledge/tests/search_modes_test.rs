//! Slice 7 (vector-retrieval-backend) — dense_search + hybrid_search end-to-end tests.
//!
//! Coverage:
//! - dense_search returns hits ordered by ascending L2 distance (= descending
//!   cosine similarity for unit-norm e5 vectors)
//! - hybrid_search produces RRF-fused results when both rankers contribute
//! - mode_used field correctly populated per mode
//! - synthetic embeddings (no real model required) — verifies SQL+wiring,
//!   not e5 quality

use rusqlite::params;
use sdlc_knowledge::search::{dense_search, hybrid_search};
use sdlc_knowledge::store::open_or_init_v2;
use tempfile::TempDir;

fn fresh_v2_db_with_data() -> (TempDir, std::path::PathBuf) {
    let tmp = TempDir::new().expect("tempdir");
    let path = tmp.path().join("index.db");
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");

    // Seed: 1 document, 3 chunks with distinct text + distinct embeddings.
    conn.execute(
        "INSERT INTO documents(source_path, mtime, sha256, ingested_at) \
         VALUES ('/tmp/doc.md', 0, 'abc', 0)",
        [],
    )
    .expect("insert document");
    let chunk_texts = [
        "authentication and authorization architecture",
        "image bytes BLOB storage in SQLite",
        "BM25 ranking via FTS5 in SQLite",
    ];
    for (i, text) in chunk_texts.iter().enumerate() {
        conn.execute(
            "INSERT INTO chunks(doc_id, ord, text) VALUES (1, ?1, ?2)",
            params![i as i64, text],
        )
        .expect("insert chunk");
    }
    // Synthetic 384-dim embeddings — each one-hot at a distinct dim.
    for i in 1..=3i64 {
        let mut v = vec![0f32; 384];
        v[(i - 1) as usize] = 1.0;
        let bytes: Vec<u8> = v.iter().flat_map(|f| f.to_le_bytes()).collect();
        conn.execute(
            "INSERT INTO chunks_vec(rowid, embedding) VALUES (?1, ?2)",
            params![i, bytes],
        )
        .expect("insert embedding");
    }
    drop(conn);
    (tmp, path)
}

#[test]
fn dense_search_returns_nearest_neighbor() {
    let (_tmp, path) = fresh_v2_db_with_data();
    let conn = open_or_init_v2(&path).expect("re-open");

    // Query embedding identical to chunk 1's embedding: (1.0 at dim 0, rest 0)
    let mut q = vec![0f32; 384];
    q[0] = 1.0;
    let hits = dense_search(&conn, &q, 5).expect("dense_search");
    assert!(!hits.is_empty(), "should find at least 1 hit");
    assert_eq!(
        hits[0].chunk_id, 1,
        "nearest neighbor of (1,0,...) should be chunk 1 with same embedding"
    );
    assert_eq!(hits[0].mode_used.as_deref(), Some("dense"));
    assert!(hits[0].dense_score.is_some());
    assert!(hits[0].bm25_score.is_none());
}

#[test]
fn hybrid_search_fuses_bm25_and_dense() {
    let (_tmp, path) = fresh_v2_db_with_data();
    let conn = open_or_init_v2(&path).expect("re-open");

    // BM25 query "BM25" matches chunk 3's text.
    // Dense query embedding (one-hot dim 0) matches chunk 1.
    // Hybrid should surface BOTH chunks 1 and 3 in the top results.
    let mut q_emb = vec![0f32; 384];
    q_emb[0] = 1.0;
    let hits = hybrid_search(&conn, "BM25 ranking", &q_emb, 5).expect("hybrid_search");
    assert!(!hits.is_empty(), "hybrid should return ≥1 hit");
    let ids: Vec<i64> = hits.iter().map(|h| h.chunk_id).collect();
    // Chunk 3 (BM25 winner for "BM25 ranking") AND chunk 1 (dense winner)
    // should both be present.
    assert!(
        ids.contains(&3),
        "hybrid should include BM25 winner chunk 3; got {ids:?}"
    );
    assert!(
        ids.contains(&1),
        "hybrid should include dense winner chunk 1; got {ids:?}"
    );
    // Mode + RRF score populated.
    for hit in &hits {
        assert_eq!(hit.mode_used.as_deref(), Some("hybrid"));
        assert!(hit.rrf_score.is_some(), "RRF score must be populated");
    }
}

#[test]
fn dense_search_top_k_limits_results() {
    let (_tmp, path) = fresh_v2_db_with_data();
    let conn = open_or_init_v2(&path).expect("re-open");
    let mut q = vec![0f32; 384];
    q[0] = 1.0;
    let hits = dense_search(&conn, &q, 2).expect("dense_search top_k=2");
    assert_eq!(hits.len(), 2, "top_k=2 limits to 2 results");
}
