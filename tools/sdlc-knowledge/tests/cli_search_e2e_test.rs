//! Slice 3 end-to-end CLI tests for `search`, `list`, `status`, `delete`.
//!
//! Coverage:
//! - (a) search "the" --top-k 5 --json → exit 0, valid JSON, len ≤ 5,
//!   all scores > 0, scores non-strictly descending (TC-AAI-2 + TC-7.1).
//! - (b) search "xyznonexistent" --json → exit 0, [] (TC-7.2 / FR-3.4).
//! - (c) list --json → exit 0, array of {source_path, chunk_count, ingested_at} (TC-8.1).
//! - (d) status --json → exit 0, {schema_version:1, doc_count, chunk_count, db_path} (TC-8.2).
//! - (e) delete <source> by string path → exit 0, subsequent search excludes (TC-8.3).
//! - (f) delete <int-id> → exit 0, by id (TC-8.4).
//! - (g) TC-AAI-2 — grep src/search.rs for literal `-bm25(chunks_fts)`.

use assert_cmd::Command;
use std::fs;
use std::path::PathBuf;

const FIXTURES_REL: &str = "tests/fixtures";

fn bin() -> Command {
    Command::cargo_bin("sdlc-knowledge").expect("binary built")
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(FIXTURES_REL)
}

/// Project tempdir with `sample.md` ingested and `index.db` populated.
fn project_with_ingested_sample() -> tempfile::TempDir {
    let tmp = tempfile::tempdir().expect("tempdir");
    let kdir = tmp.path().join(".claude/knowledge");
    fs::create_dir_all(&kdir).expect("mkdir .claude/knowledge");
    let src = fixtures_dir().join("sample.md");
    let dst = kdir.join("sample.md");
    fs::copy(&src, &dst).expect("copy sample.md");

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge/sample.md"])
        .assert()
        .success();

    tmp
}

// ---------------------------------------------------------------------------
// (a) search --json with results: positive descending scores.
// ---------------------------------------------------------------------------

#[test]
fn e2e_a_search_json_returns_positive_descending_scores() {
    let tmp = project_with_ingested_sample();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["search", "the", "--top-k", "5", "--json"])
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let v: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|e| panic!("invalid JSON: {e}\nstdout=\n{stdout}"));
    let arr = v.as_array().expect("JSON must be an array");
    assert!(arr.len() <= 5, "expected ≤ 5 hits, got {}", arr.len());

    // If the term matched at all, assert score direction; with sample.md the term
    // "the" should appear at least once.
    if !arr.is_empty() {
        let mut prev: Option<f64> = None;
        for hit in arr {
            let score = hit
                .get("score")
                .and_then(|s| s.as_f64())
                .expect("score field must be a float");
            assert!(score > 0.0, "score must be positive; got {score}");
            if let Some(p) = prev {
                assert!(
                    p >= score,
                    "scores must be non-strictly descending; {p} then {score}"
                );
            }
            prev = Some(score);

            // Required JSON fields per FR-3.3.
            for field in ["source", "chunk_id", "ord", "score", "snippet"] {
                assert!(
                    hit.get(field).is_some(),
                    "missing field `{field}` in hit: {hit}"
                );
            }
        }
    }
}

// ---------------------------------------------------------------------------
// (b) Empty result: exit 0, JSON `[]`.
// ---------------------------------------------------------------------------

#[test]
fn e2e_b_search_empty_result_exits_zero_with_empty_array() {
    let tmp = project_with_ingested_sample();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["search", "xyznonexistentterm", "--json"])
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let trimmed = stdout.trim();
    assert_eq!(trimmed, "[]", "expected `[]`, got {trimmed:?}");
}

// ---------------------------------------------------------------------------
// (c) list --json: array of DocumentSummary.
// ---------------------------------------------------------------------------

#[test]
fn e2e_c_list_json_returns_document_summaries() {
    let tmp = project_with_ingested_sample();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["list", "--json"])
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let v: serde_json::Value =
        serde_json::from_str(&stdout).unwrap_or_else(|e| panic!("invalid JSON: {e}\n{stdout}"));
    let arr = v.as_array().expect("JSON must be an array");
    assert_eq!(arr.len(), 1, "expected exactly 1 document");

    let doc = &arr[0];
    for field in ["source_path", "chunk_count", "ingested_at"] {
        assert!(doc.get(field).is_some(), "missing field `{field}` in {doc}");
    }
    let chunk_count = doc.get("chunk_count").and_then(|c| c.as_i64()).expect("i64");
    assert_eq!(chunk_count, 8, "sample.md should have 8 chunks");
}

// ---------------------------------------------------------------------------
// (d) status --json: schema_version, doc_count, chunk_count, db_path.
// ---------------------------------------------------------------------------

#[test]
fn e2e_d_status_json_returns_full_summary() {
    let tmp = project_with_ingested_sample();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["status", "--json"])
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let v: serde_json::Value =
        serde_json::from_str(&stdout).unwrap_or_else(|e| panic!("invalid JSON: {e}\n{stdout}"));

    let schema_version = v.get("schema_version").and_then(|s| s.as_i64()).expect("i64");
    let doc_count = v.get("doc_count").and_then(|s| s.as_i64()).expect("i64");
    let chunk_count = v.get("chunk_count").and_then(|s| s.as_i64()).expect("i64");
    let db_path = v.get("db_path").and_then(|s| s.as_str()).expect("str");

    assert_eq!(schema_version, 1);
    assert_eq!(doc_count, 1);
    assert_eq!(chunk_count, 8);
    // Absolute path
    assert!(
        std::path::Path::new(db_path).is_absolute(),
        "db_path must be absolute, got {db_path:?}"
    );
    assert!(db_path.ends_with("index.db"), "db_path must end with index.db");
}

// ---------------------------------------------------------------------------
// (e) delete by string path: subsequent search excludes; list shows N-1.
// ---------------------------------------------------------------------------

#[test]
fn e2e_e_delete_by_string_path_removes_document() {
    let tmp = project_with_ingested_sample();

    // Discover the source_path string from the DB so we pass exactly what's stored.
    let db = tmp.path().join(".claude/knowledge/index.db");
    let conn = rusqlite::Connection::open(&db).expect("open db");
    let path: String = conn
        .query_row("SELECT source_path FROM documents LIMIT 1", [], |r| r.get(0))
        .expect("read path");
    drop(conn);

    bin()
        .current_dir(tmp.path())
        .args(["delete", &path])
        .assert()
        .success();

    // List after delete: empty array.
    let assert = bin()
        .current_dir(tmp.path())
        .args(["list", "--json"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let v: serde_json::Value = serde_json::from_str(&stdout).expect("json");
    assert_eq!(v.as_array().expect("array").len(), 0);

    // Subsequent search excludes the document (returns []).
    let assert = bin()
        .current_dir(tmp.path())
        .args(["search", "the", "--json"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    assert_eq!(stdout.trim(), "[]");
}

// ---------------------------------------------------------------------------
// (f) delete by integer id via explicit --by-id flag (Slice 2 FR-4.1).
// ---------------------------------------------------------------------------

#[test]
fn e2e_f_delete_by_int_id_removes_document() {
    let tmp = project_with_ingested_sample();

    let db = tmp.path().join(".claude/knowledge/index.db");
    let conn = rusqlite::Connection::open(&db).expect("open db");
    let id: i64 = conn
        .query_row("SELECT id FROM documents LIMIT 1", [], |r| r.get(0))
        .expect("read id");
    drop(conn);

    bin()
        .current_dir(tmp.path())
        .args(["delete", "--by-id", &id.to_string()])
        .assert()
        .success();

    // Verify documents table is empty.
    let conn = rusqlite::Connection::open(&db).expect("reopen db");
    let n: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .expect("count");
    assert_eq!(n, 0, "documents table must be empty after delete");
    let nc: i64 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))
        .expect("count chunks");
    assert_eq!(nc, 0, "chunks must cascade-delete");
}

// ---------------------------------------------------------------------------
// Slice 2 — delete --by-id happy path: JSON shape FR-4.5.
// ---------------------------------------------------------------------------

#[test]
fn delete_by_id_happy_path_json_shape() {
    let tmp = project_with_ingested_sample();

    let db = tmp.path().join(".claude/knowledge/index.db");
    let conn = rusqlite::Connection::open(&db).expect("open db");
    let (id, source_path): (i64, String) = conn
        .query_row(
            "SELECT id, source_path FROM documents LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .expect("read id+path");
    let prior_chunk_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks WHERE doc_id = ?1",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .expect("count chunks");
    drop(conn);

    let assert = bin()
        .current_dir(tmp.path())
        .args(["delete", "--by-id", &id.to_string(), "--json"])
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let v: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|e| panic!("invalid JSON: {e}\nstdout=\n{stdout}"));

    // FR-4.5: exactly three fields { deleted_id, source_path, chunks_removed } and no extras.
    let obj = v.as_object().expect("JSON must be an object");
    assert_eq!(
        obj.len(),
        3,
        "JSON must have exactly 3 keys, got {}: {obj:?}",
        obj.len()
    );
    assert_eq!(
        obj.get("deleted_id").and_then(|x| x.as_i64()),
        Some(id),
        "deleted_id must equal {id}"
    );
    assert_eq!(
        obj.get("source_path").and_then(|x| x.as_str()),
        Some(source_path.as_str()),
        "source_path must match"
    );
    assert_eq!(
        obj.get("chunks_removed").and_then(|x| x.as_i64()),
        Some(prior_chunk_count),
        "chunks_removed must equal prior chunk count {prior_chunk_count}"
    );

    // List shows N-1 (was 1, now 0).
    let assert = bin()
        .current_dir(tmp.path())
        .args(["list", "--json"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let v: serde_json::Value = serde_json::from_str(&stdout).expect("json");
    assert_eq!(v.as_array().expect("array").len(), 0);
}

// ---------------------------------------------------------------------------
// Slice 2 — delete --by-id <nonexistent>: exit 1 + literal stderr FR-4.2.
// ---------------------------------------------------------------------------

#[test]
fn delete_by_id_nonexistent_returns_exit_1() {
    let tmp = project_with_ingested_sample();
    let db = tmp.path().join(".claude/knowledge/index.db");

    // Capture prior counts to verify no rows were touched.
    let conn = rusqlite::Connection::open(&db).expect("open db");
    let docs_before: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .expect("count");
    let chunks_before: i64 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))
        .expect("count");
    drop(conn);

    let assert = bin()
        .current_dir(tmp.path())
        .args(["delete", "--by-id", "99999"])
        .assert()
        .code(1);

    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert!(
        stderr.contains("error: no document with id 99999"),
        "stderr must contain literal FR-4.2 message; got: {stderr:?}"
    );

    // Verify documents/chunks unchanged.
    let conn = rusqlite::Connection::open(&db).expect("reopen db");
    let docs_after: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .expect("count");
    let chunks_after: i64 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))
        .expect("count");
    assert_eq!(docs_before, docs_after, "documents row count must not change");
    assert_eq!(
        chunks_before, chunks_after,
        "chunks row count must not change"
    );
}

// ---------------------------------------------------------------------------
// Slice 2 — mutual exclusion: --by-id + positional path → exit 2 (FR-4.1).
// ---------------------------------------------------------------------------

#[test]
fn delete_mutual_exclusion_exit_2() {
    let tmp = project_with_ingested_sample();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["delete", "--by-id", "5", "some/path.pdf"])
        .assert()
        .code(2);

    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert!(
        stderr.contains("error: --by-id and <source-path> are mutually exclusive"),
        "stderr must contain literal FR-4.1 mutual-exclusion message; got: {stderr:?}"
    );
}

// ---------------------------------------------------------------------------
// Slice 2 — neither flag nor positional argument: exit 2.
// ---------------------------------------------------------------------------

#[test]
fn delete_neither_required_exit_2() {
    let tmp = project_with_ingested_sample();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["delete"])
        .assert()
        .code(2);

    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert!(
        stderr.contains("error: --by-id or <source-path> required"),
        "stderr must contain literal `error: --by-id or <source-path> required`; got: {stderr:?}"
    );
}

// ---------------------------------------------------------------------------
// (g) TC-AAI-2 — search.rs SQL contains literal `-bm25(chunks_fts)`.
// ---------------------------------------------------------------------------

#[test]
fn tc_aai_2_search_rs_uses_negated_bm25() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src/search.rs");
    let content = fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    assert!(
        content.contains("-bm25(chunks_fts)"),
        "src/search.rs must contain literal `-bm25(chunks_fts)` per architect action item #3"
    );
    assert!(
        content.contains("ORDER BY score DESC"),
        "src/search.rs must contain literal `ORDER BY score DESC`"
    );
}
