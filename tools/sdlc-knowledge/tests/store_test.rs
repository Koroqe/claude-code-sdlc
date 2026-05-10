//! Slice 2 store-layer tests: schema initialization, WAL, FTS5 trigger correctness.
//!
//! Coverage:
//! - schema-init creates 4 tables (documents, chunks, chunks_fts, schema_version)
//! - PRAGMA journal_mode=wal
//! - schema_version row equals 1
//! - FTS5 triggers fire on chunks insert / update / delete
//! - validate_schema PASS on freshly-init DB
//! - validate_schema FAIL when schema_version is dropped

use rusqlite::params;
use sdlc_knowledge::migrations;
use sdlc_knowledge::store;

fn open_temp_db() -> (tempfile::TempDir, std::path::PathBuf, rusqlite::Connection) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let db_path = tmp.path().join("index.db");
    let mut conn = store::open_or_init(&db_path).expect("open_or_init");
    migrations::run_migrations(&mut conn).expect("run_migrations");
    (tmp, db_path, conn)
}

#[test]
fn fresh_db_has_four_tables() {
    let (_tmp, _path, conn) = open_temp_db();

    let mut found = std::collections::HashSet::new();
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','virtual') OR name='chunks_fts'")
        .expect("prepare");
    let rows = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .expect("query");
    for r in rows {
        found.insert(r.expect("row"));
    }

    for required in ["documents", "chunks", "chunks_fts", "schema_version"] {
        assert!(
            found.contains(required),
            "expected table `{required}` to exist; have {:?}",
            found
        );
    }
}

#[test]
fn pragma_journal_mode_is_wal() {
    let (_tmp, _path, conn) = open_temp_db();
    let mode: String = conn
        .query_row("PRAGMA journal_mode", [], |r| r.get(0))
        .expect("pragma journal_mode");
    assert_eq!(mode.to_lowercase(), "wal");
}

#[test]
fn schema_version_is_three_on_fresh_v2_db() {
    // Iter-2 Slice 12: open_or_init_v2 applies SCHEMA_V1 + V2 + V3 deltas
    // and stamps version=3 on a fresh DB (sqlite-vec + page columns + pages
    // table all installed in one shot).
    let tmp = tempfile::tempdir().expect("tempdir");
    let db_path = tmp.path().join("index.db");
    let conn = store::open_or_init_v2(&db_path).expect("open_or_init_v2");
    let v: i64 = conn
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .expect("read schema_version");
    assert_eq!(v, 3);
}

#[test]
fn fts5_triggers_insert_delete_update() {
    let (_tmp, _path, mut conn) = open_temp_db();

    // Insert a doc + chunk, verify FTS5 row queryable.
    let tx = conn.transaction().expect("tx");
    tx.execute(
        "INSERT INTO documents(source_path, mtime, sha256, ingested_at) VALUES (?1, ?2, ?3, ?4)",
        params!["a.md", 1i64, "deadbeef", 100i64],
    )
    .expect("insert doc");
    let doc_id: i64 = tx
        .query_row(
            "SELECT id FROM documents WHERE source_path = ?1",
            params!["a.md"],
            |r| r.get(0),
        )
        .expect("doc id");
    tx.execute(
        "INSERT INTO chunks(doc_id, ord, text) VALUES (?1, ?2, ?3)",
        params![doc_id, 0i64, "the quick brown fox jumps"],
    )
    .expect("insert chunk");
    tx.commit().expect("commit");

    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH ?1",
            params!["fox"],
            |r| r.get(0),
        )
        .expect("fts query");
    assert_eq!(n, 1, "insert trigger should populate chunks_fts");

    // Update the chunk text → FTS5 row updates.
    conn.execute(
        "UPDATE chunks SET text = ?1 WHERE doc_id = ?2",
        params!["a different sentence about cats", doc_id],
    )
    .expect("update");
    let n_old: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH ?1",
            params!["fox"],
            |r| r.get(0),
        )
        .expect("fts old");
    assert_eq!(n_old, 0, "update trigger should drop the old FTS row");
    let n_new: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH ?1",
            params!["cats"],
            |r| r.get(0),
        )
        .expect("fts new");
    assert_eq!(n_new, 1, "update trigger should add the new FTS row");

    // Delete the chunk → FTS5 row removed.
    conn.execute("DELETE FROM chunks WHERE doc_id = ?1", params![doc_id])
        .expect("delete");
    let n_after: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks_fts WHERE chunks_fts MATCH ?1",
            params!["cats"],
            |r| r.get(0),
        )
        .expect("fts after delete");
    assert_eq!(n_after, 0, "delete trigger should drop the FTS row");
}

#[test]
fn validate_schema_accepts_initialized_db() {
    let (_tmp, _path, conn) = open_temp_db();
    store::validate_schema(&conn).expect("validate_schema must accept a freshly-init DB");
}

#[test]
fn validate_schema_rejects_corrupt_db() {
    let (_tmp, _path, conn) = open_temp_db();
    // Drop schema_version to simulate corrupt index.
    conn.execute("DROP TABLE schema_version", [])
        .expect("drop schema_version");
    let err = store::validate_schema(&conn).expect_err("validate_schema must reject");
    let msg = format!("{err}");
    assert!(
        msg.contains("invalid") || msg.contains("Corrupt") || msg.contains("corrupt"),
        "expected IndexError::Corrupt; got: {msg}"
    );
}
