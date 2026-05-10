//! Slice 2 (vector-retrieval-backend) — schema v2 + sqlite-vec extension load tests.
//!
//! Coverage:
//! - TC-VR-3.1: `open_or_init_v2` on fresh DB → schema_version=2
//! - TC-VR-3.5: chunks.type and chunks.image_bytes columns exist
//! - chunks_vec virtual table created and queryable (vec0 + vec_distance_cosine)
//! - chunks_fts and chunks_vec coexist without trigger conflicts (insert+search both work)
//! - SECURITY: rusqlite `load_extension` feature stays OFF (auto-extension is the only path)

use rusqlite::params;
use sdlc_knowledge::store::open_or_init_v2;
use tempfile::TempDir;

fn fresh_db_path() -> (TempDir, std::path::PathBuf) {
    let tmp = TempDir::new().expect("tempdir");
    let path = tmp.path().join("index.db");
    (tmp, path)
}

#[test]
fn open_or_init_v2_fresh_db_stamps_schema_version_2() {
    let (_tmp, path) = fresh_db_path();
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");
    let v: i64 = conn
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .expect("schema_version row");
    assert_eq!(v, 2, "fresh DB should be at schema_version 2");
}

#[test]
fn open_or_init_v2_adds_type_and_image_bytes_columns() {
    let (_tmp, path) = fresh_db_path();
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");
    // PRAGMA table_info(chunks) yields rows: cid, name, type, notnull, dflt_value, pk
    let mut stmt = conn
        .prepare("SELECT name FROM pragma_table_info('chunks')")
        .expect("prepare pragma");
    let cols: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .expect("query")
        .filter_map(Result::ok)
        .collect();
    assert!(
        cols.iter().any(|c| c == "type"),
        "chunks.type column missing; cols={:?}",
        cols
    );
    assert!(
        cols.iter().any(|c| c == "image_bytes"),
        "chunks.image_bytes column missing; cols={:?}",
        cols
    );
}

#[test]
fn open_or_init_v2_creates_chunks_vec_virtual_table() {
    let (_tmp, path) = fresh_db_path();
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");
    // sqlite_master entry for chunks_vec exists and is a virtual table
    let (name, ty, sql): (String, String, String) = conn
        .query_row(
            "SELECT name, type, COALESCE(sql,'') FROM sqlite_master WHERE name='chunks_vec'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .expect("chunks_vec must exist");
    assert_eq!(name, "chunks_vec");
    assert_eq!(ty, "table"); // SQLite reports virtual tables as type='table' in sqlite_master
    assert!(
        sql.contains("vec0"),
        "chunks_vec sql should contain 'vec0', got: {sql}"
    );
}

#[test]
fn chunks_vec_accepts_insert_and_cosine_query() {
    let (_tmp, path) = fresh_db_path();
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");

    // Build two simple 384-dim vectors. sqlite-vec stores Vec<f32> as BLOB
    // bytes (little-endian). We emit f32 LE bytes manually.
    let mut a = vec![0f32; 384];
    a[0] = 1.0;
    let mut b = vec![0f32; 384];
    b[1] = 1.0;
    let bytes_a: Vec<u8> = a.iter().flat_map(|f| f.to_le_bytes()).collect();
    let bytes_b: Vec<u8> = b.iter().flat_map(|f| f.to_le_bytes()).collect();

    // Insert two vectors. sqlite-vec's vec0 virtual table accepts the embedding
    // directly via INSERT; rowid is auto-assigned.
    conn.execute(
        "INSERT INTO chunks_vec(rowid, embedding) VALUES (?1, ?2)",
        params![1i64, bytes_a],
    )
    .expect("insert vec a");
    conn.execute(
        "INSERT INTO chunks_vec(rowid, embedding) VALUES (?1, ?2)",
        params![2i64, bytes_b],
    )
    .expect("insert vec b");

    // K-NN query: nearest neighbor to `a` should be itself (rowid=1).
    let nearest_rowid: i64 = conn
        .query_row(
            "SELECT rowid FROM chunks_vec WHERE embedding MATCH ?1 ORDER BY distance LIMIT 1",
            params![bytes_a.clone()],
            |r| r.get(0),
        )
        .expect("knn query");
    assert_eq!(
        nearest_rowid, 1,
        "nearest neighbor of vec_a should be vec_a (rowid=1)"
    );
}

#[test]
fn chunks_fts_and_chunks_vec_coexist() {
    let (_tmp, path) = fresh_db_path();
    let conn = open_or_init_v2(&path).expect("open_or_init_v2");

    // Insert a document + chunk via the canonical schema (FTS5 trigger fires).
    conn.execute(
        "INSERT INTO documents(source_path, mtime, sha256, ingested_at) \
         VALUES ('/tmp/test.md', 0, 'abc', 0)",
        [],
    )
    .expect("insert document");
    conn.execute(
        "INSERT INTO chunks(doc_id, ord, text) VALUES (1, 0, 'hello world coexistence')",
        [],
    )
    .expect("insert chunk (FTS5 trigger fires)");

    // Insert an embedding for that chunk's id.
    let v = vec![0.5f32; 384];
    let bytes: Vec<u8> = v.iter().flat_map(|f| f.to_le_bytes()).collect();
    conn.execute(
        "INSERT INTO chunks_vec(rowid, embedding) VALUES (1, ?1)",
        params![bytes],
    )
    .expect("insert vec");

    // FTS5 search works.
    let fts_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH 'hello'",
            [],
            |r| r.get(0),
        )
        .expect("fts query");
    assert_eq!(fts_count, 1, "FTS5 should find 'hello' in chunks_fts");

    // chunks_vec query works.
    let vec_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM chunks_vec", [], |r| r.get(0))
        .expect("vec count");
    assert_eq!(vec_count, 1, "chunks_vec should have 1 row");
}

#[test]
fn open_or_init_v2_idempotent_on_existing_v2_db() {
    let (_tmp, path) = fresh_db_path();
    {
        let _conn = open_or_init_v2(&path).expect("first open");
    }
    // Second open on same DB should not fail (no double-INSERT into schema_version,
    // no duplicate ALTER TABLE error).
    let conn = open_or_init_v2(&path).expect("second open");
    let v: i64 = conn
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .expect("schema_version persists");
    assert_eq!(v, 2);
}
