//! Iter-2 page-tracking tests:
//! - v1 → v2 migration adds nullable page columns + the `pages` table without
//!   touching existing chunk rows
//! - `replace_pages` round-trip via `get_page_by_source` / `get_page_by_id`
//! - `page` subcommand mutual-exclusion / out-of-range / non-PDF error paths
//! - search hits expose `page_start` / `page_end` / `doc_id` for PDF-tagged
//!   chunks (synthesized in-place because we cannot drive PDFium in this
//!   test layer — pdfium binding is exercised in `pdfium_test.rs`)

use rusqlite::params;
use sdlc_knowledge::{migrations, search, store};

fn open_temp_v2() -> (tempfile::TempDir, std::path::PathBuf, rusqlite::Connection) {
    let tmp = tempfile::tempdir().expect("tempdir");
    let db_path = tmp.path().join("index.db");
    let mut conn = store::open_or_init(&db_path).expect("open_or_init");
    migrations::run_migrations(&mut conn).expect("run_migrations");
    (tmp, db_path, conn)
}

#[test]
fn v1_to_v2_migration_adds_page_columns_and_pages_table() {
    let (_tmp, _path, conn) = open_temp_v2();

    // Page columns exist on chunks.
    let mut stmt = conn
        .prepare("SELECT 1 FROM pragma_table_info('chunks') WHERE name = ?1")
        .expect("prepare");
    for col in ["page_start", "page_end"] {
        let mut rows = stmt.query(params![col]).expect("query");
        assert!(
            rows.next().expect("row").is_some(),
            "expected chunks.{col} after v2 migration"
        );
    }

    // pages table exists.
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='pages'",
            [],
            |r| r.get(0),
        )
        .expect("query pages table");
    assert_eq!(n, 1, "pages table must be created in v2");

    // schema_version row is 2.
    let v: i64 = conn
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .expect("schema_version");
    assert_eq!(v, 2);
}

#[test]
fn migration_is_idempotent() {
    let (_tmp, db_path, _conn) = open_temp_v2();
    // Re-open and re-run migrations — must not fail or duplicate columns.
    let mut conn2 = store::open_or_init(&db_path).expect("re-open");
    migrations::run_migrations(&mut conn2).expect("re-run migrations");
    let v: i64 = conn2
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .expect("schema_version");
    assert_eq!(v, 2);
}

#[test]
fn replace_pages_then_get_page_round_trip() {
    let (_tmp, _path, conn) = open_temp_v2();

    // Seed a documents row.
    let doc_id = store::upsert_document(&conn, "/tmp/book.pdf", 1, "abc", 100).expect("upsert");
    // Insert three pages.
    let pages = vec![
        (1i64, "Chapter 1 — The widget rises."),
        (2i64, "On page two we discuss widgetron physics."),
        (3i64, "The final page summarizes."),
    ];
    store::replace_pages(&conn, doc_id, &pages).expect("replace_pages");

    // page_count
    assert_eq!(store::page_count(&conn, doc_id).expect("count"), 3);

    // get_page_by_source — happy path
    let rec = store::get_page_by_source(&conn, "/tmp/book.pdf", 2)
        .expect("query")
        .expect("page found");
    assert_eq!(rec.doc_id, doc_id);
    assert_eq!(rec.page_no, 2);
    assert!(rec.text.contains("widgetron"));

    // get_page_by_id — same row by id
    let rec2 = store::get_page_by_id(&conn, doc_id, 2)
        .expect("query")
        .expect("page found");
    assert_eq!(rec2.text, rec.text);

    // Out-of-range page → None
    let oob = store::get_page_by_id(&conn, doc_id, 99).expect("query");
    assert!(oob.is_none(), "page 99 should not exist");

    // Replace overwrites — call again with a different set
    let pages2 = vec![(1i64, "Only page one now.")];
    store::replace_pages(&conn, doc_id, &pages2).expect("replace 2");
    assert_eq!(store::page_count(&conn, doc_id).expect("count"), 1);
    let rec3 = store::get_page_by_id(&conn, doc_id, 1)
        .expect("query")
        .expect("page found");
    assert_eq!(rec3.text, "Only page one now.");
}

#[test]
fn replace_chunks_persists_page_columns() {
    let (_tmp, _path, conn) = open_temp_v2();
    let doc_id = store::upsert_document(&conn, "/tmp/book.pdf", 1, "abc", 100).expect("upsert");

    let chunks = vec![
        (0usize, "first widget on page 1", Some(1i64), Some(1i64)),
        (1usize, "second widget on page 2", Some(2i64), Some(2i64)),
        (2usize, "third widget on page 2", Some(2i64), Some(2i64)),
    ];
    store::replace_chunks(&conn, doc_id, &chunks).expect("replace_chunks");

    // BM25 search should surface page columns in SearchHit.
    let hits = search::search(&conn, "widget", 10, 0).expect("search");
    assert_eq!(hits.len(), 3);
    for h in &hits {
        assert_eq!(h.doc_id, doc_id, "doc_id must populate");
        assert!(h.page_start.is_some(), "page_start must be present");
        assert!(h.page_end.is_some(), "page_end must be present");
        assert_eq!(h.page_start, h.page_end);
    }
}

#[test]
fn replace_chunks_with_null_pages_for_markdown() {
    let (_tmp, _path, conn) = open_temp_v2();
    let doc_id = store::upsert_document(&conn, "/tmp/notes.md", 1, "abc", 100).expect("upsert");
    let chunks = vec![(0usize, "markdown text about widgetron", None, None)];
    store::replace_chunks(&conn, doc_id, &chunks).expect("replace_chunks");

    let hits = search::search(&conn, "widgetron", 5, 0).expect("search");
    assert_eq!(hits.len(), 1);
    assert!(hits[0].page_start.is_none());
    assert!(hits[0].page_end.is_none());
    assert_eq!(hits[0].doc_id, doc_id);
}

// ---------------------------------------------------------------------------
// CLI-level smoke for the page subcommand: error paths only (a pdfium-backed
// happy path lives in `pdfium_test.rs`).
// ---------------------------------------------------------------------------

use assert_cmd::Command;

fn bin() -> Command {
    Command::cargo_bin("sdlc-knowledge").expect("binary built")
}

#[test]
fn page_mutual_exclusion_exits_2() {
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["page", "/some/path", "--by-id", "1", "--page", "1"])
        .assert()
        .code(2);
}

#[test]
fn page_neither_key_exits_2() {
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["page", "--page", "1"])
        .assert()
        .code(2);
}

#[test]
fn page_zero_index_exits_2() {
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["page", "--by-id", "1", "--page", "0"])
        .assert()
        .code(2);
}

#[test]
fn page_unknown_doc_id_exits_1() {
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["page", "--by-id", "999999", "--page", "1"])
        .assert()
        .code(1);
}

#[test]
fn page_for_markdown_doc_returns_no_pages_error() {
    // Seed a project: ingest a markdown file (no pages), then try to page it.
    let tmp = tempfile::tempdir().expect("tempdir");
    let proj = tmp.path();
    let knowledge = proj.join(".claude").join("knowledge").join("sources");
    std::fs::create_dir_all(&knowledge).expect("mkdir");
    let md = knowledge.join("notes.md");
    std::fs::write(&md, "Some notes about widgetron physics.").expect("write");

    bin()
        .current_dir(proj)
        .args(["ingest", ".claude/knowledge/sources"])
        .assert()
        .success();

    // List to find the canonical source path.
    let list = bin()
        .current_dir(proj)
        .args(["list", "--json"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&list.get_output().stdout).to_string();
    let v: serde_json::Value = serde_json::from_str(&stdout).expect("json");
    let arr = v.as_array().expect("array");
    assert_eq!(arr.len(), 1);
    let src = arr[0]
        .get("source_path")
        .and_then(|s| s.as_str())
        .expect("source_path");

    // Now ask for page 1 — should exit 1 with "no extracted pages" message.
    let out = bin()
        .current_dir(proj)
        .args(["page", src, "--page", "1"])
        .assert()
        .code(1);
    let stderr = String::from_utf8_lossy(&out.get_output().stderr).to_string();
    assert!(
        stderr.contains("no extracted pages"),
        "expected 'no extracted pages' message; got: {stderr}"
    );
}
