//! Slice 2 end-to-end CLI ingest tests.
//!
//! Coverage:
//! - (a) ingest sample.md → exit 0; documents=1, chunks=8.
//! - (b) re-ingest sample.md → stdout `unchanged: <path>`; exit 0; no new rows.
//! - (c) ingest mixed-format directory `tests/fixtures/` → succeeded contains md+txt+pdf.
//! - (d) TC-AAI-4 — ingest dir with sample.md + corrupt.pdf → exit 0, sample.md
//!   in `succeeded`, corrupt.pdf in `failed`, post-batch SQLite has sample.md
//!   fully committed and zero rows from corrupt.pdf.
//! - TC-SEC-2.4 — symlink-escape skip (with WARN log).
//! - TC-SEC-2.5 — SQL-injection-shaped source_path survives parameterized writes.
//! - TC-SEC-2.6 — concurrent reader during writer (WAL invariant).
//! - TC-SEC-2.7 — cargo-audit gate is deferred to /merge-ready Gate 4 (#[ignore]).

use assert_cmd::Command;
use rusqlite::params;
use std::fs;
use std::path::{Path, PathBuf};

const FIXTURES_REL: &str = "tests/fixtures";

fn bin() -> Command {
    Command::cargo_bin("sdlc-knowledge").expect("binary built")
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(FIXTURES_REL)
}

/// Set up a tempdir as a project root; copy a fixture into it; return the project tempdir.
fn project_with_fixtures(names: &[&str]) -> tempfile::TempDir {
    let tmp = tempfile::tempdir().expect("tempdir");
    fs::create_dir_all(tmp.path().join(".claude/knowledge")).expect("mkdir .claude/knowledge");
    let dst_dir = tmp.path().join(".claude/knowledge");
    for n in names {
        let src = fixtures_dir().join(n);
        let dst = dst_dir.join(n);
        fs::copy(&src, &dst)
            .unwrap_or_else(|e| panic!("copy {} -> {}: {e}", src.display(), dst.display()));
    }
    tmp
}

fn open_db(db_path: &Path) -> rusqlite::Connection {
    rusqlite::Connection::open(db_path).expect("open db")
}

// ---------------------------------------------------------------------------
// (a) ingest sample.md → exit 0, documents=1, chunks=8.
// ---------------------------------------------------------------------------

#[test]
fn e2e_a_single_md_ingest_produces_eight_chunks() {
    let tmp = project_with_fixtures(&["sample.md"]);

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge/sample.md", "--json"])
        .assert()
        .success();

    let db = tmp.path().join(".claude/knowledge/index.db");
    assert!(db.exists(), "index.db should be created at {}", db.display());

    let conn = open_db(&db);
    let docs: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .expect("documents count");
    let chunks: i64 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))
        .expect("chunks count");
    assert_eq!(docs, 1, "expected 1 document, got {docs}");
    assert_eq!(chunks, 8, "expected 8 chunks, got {chunks}");
}

// ---------------------------------------------------------------------------
// (b) re-ingest unchanged → "unchanged: <path>" log, exit 0.
// ---------------------------------------------------------------------------

#[test]
fn e2e_b_reingest_unchanged_logs_unchanged() {
    let tmp = project_with_fixtures(&["sample.md"]);

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge/sample.md"])
        .assert()
        .success();

    let assert = bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge/sample.md"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    let combined = format!("{stdout}\n{stderr}");
    assert!(
        combined.contains("unchanged:"),
        "expected `unchanged:` log line on re-ingest; got stdout=\n{stdout}\nstderr=\n{stderr}"
    );

    let db = tmp.path().join(".claude/knowledge/index.db");
    let conn = open_db(&db);
    let docs: i64 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .unwrap();
    let chunks: i64 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))
        .unwrap();
    assert_eq!(docs, 1, "still 1 document after no-op re-ingest");
    assert_eq!(chunks, 8, "still 8 chunks after no-op re-ingest");
}

// ---------------------------------------------------------------------------
// (c) ingest mixed-format directory — md + txt + pdf all succeed.
// ---------------------------------------------------------------------------

#[test]
fn e2e_c_mixed_format_directory_ingest() {
    let tmp = project_with_fixtures(&["sample.md", "sample.txt", "sample.pdf"]);

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge", "--json"])
        .assert()
        .success();

    let db = tmp.path().join(".claude/knowledge/index.db");
    let conn = open_db(&db);

    for name in ["sample.md", "sample.txt", "sample.pdf"] {
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE source_path LIKE ?1",
                params![format!("%{name}")],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(n, 1, "expected 1 row for {name}, got {n}");
    }
}

// ---------------------------------------------------------------------------
// (d) TC-AAI-4 — batch with corrupt PDF: per-document transactionality.
// ---------------------------------------------------------------------------

#[test]
fn e2e_d_batch_with_corrupt_pdf_is_transactional() {
    let tmp = project_with_fixtures(&["sample.md", "corrupt.pdf"]);

    let assert = bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge", "--json"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();

    // succeeded list contains sample.md, failed list contains corrupt.pdf.
    assert!(
        stdout.contains("sample.md") || stderr.contains("sample.md"),
        "expected sample.md in output; stdout=\n{stdout}\nstderr=\n{stderr}"
    );
    assert!(
        stdout.contains("corrupt.pdf") || stderr.contains("corrupt.pdf"),
        "expected corrupt.pdf in output; stdout=\n{stdout}\nstderr=\n{stderr}"
    );

    let db = tmp.path().join(".claude/knowledge/index.db");
    let conn = open_db(&db);

    let md_rows: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE source_path LIKE '%sample.md'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let pdf_rows: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE source_path LIKE '%corrupt.pdf'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(md_rows, 1, "sample.md must be committed");
    assert_eq!(pdf_rows, 0, "corrupt.pdf must leave zero rows (Drop-rollback)");

    let md_chunks: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM chunks c \
             JOIN documents d ON d.id = c.doc_id \
             WHERE d.source_path LIKE '%sample.md'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(md_chunks, 8, "sample.md should yield exactly 8 chunks");
}

// ---------------------------------------------------------------------------
// TC-SEC-2.4 — symlink during dir ingest is skipped with WARN log.
// ---------------------------------------------------------------------------

#[test]
#[cfg(unix)]
fn e2e_sec_2_4_symlink_skipped_with_warn() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let kdir = tmp.path().join(".claude/knowledge");
    fs::create_dir_all(&kdir).expect("mkdir");

    // Real file
    let real_md = kdir.join("real.md");
    fs::write(&real_md, "# Real document\n\nthis is a real file").expect("write real.md");

    // Symlink pointing to /etc/passwd (escape attempt).
    let escape_link = kdir.join("escape.md");
    std::os::unix::fs::symlink("/etc/passwd", &escape_link).expect("symlink");

    let assert = bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge"])
        .assert()
        .success();
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();

    assert!(
        stderr.contains("WARN")
            && (stderr.contains("symlink") || stderr.contains("escapes")),
        "expected WARN log about symlink/escape skip; got stderr:\n{stderr}"
    );

    // DB has only real.md.
    let db = kdir.join("index.db");
    let conn = open_db(&db);
    let n_real: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE source_path LIKE '%real.md'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let n_passwd: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE source_path LIKE '%passwd%'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(n_real, 1);
    assert_eq!(n_passwd, 0, "symlink-escape MUST not land /etc/passwd in DB");
}

// ---------------------------------------------------------------------------
// TC-SEC-2.5 — SQL-injection-shaped filename survives parameterized writes.
// ---------------------------------------------------------------------------

#[test]
fn e2e_sec_2_5_sql_injection_shaped_filename_intact() {
    let injection_name = "'; DROP TABLE documents; --.md";
    let src = fixtures_dir().join("sql-injection-name").join(injection_name);
    assert!(src.exists(), "SQL-injection fixture missing: {}", src.display());

    let tmp = tempfile::tempdir().expect("tempdir");
    let kdir = tmp.path().join(".claude/knowledge");
    fs::create_dir_all(&kdir).expect("mkdir");
    let dst = kdir.join(injection_name);
    fs::copy(&src, &dst).expect("copy injection-name fixture");

    bin()
        .current_dir(tmp.path())
        .arg("ingest")
        .arg(format!(".claude/knowledge/{injection_name}"))
        .assert()
        .success();

    let db = kdir.join("index.db");
    let conn = open_db(&db);

    // The literal injection string MUST appear in source_path verbatim.
    let n_with_literal: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE source_path LIKE ?1",
            params![format!("%{injection_name}")],
            |r| r.get(0),
        )
        .expect("count by literal name");
    assert_eq!(
        n_with_literal, 1,
        "documents row must hold the literal SQL-injection-shaped filename"
    );

    // All four tables MUST still exist.
    let mut found = std::collections::HashSet::new();
    let mut stmt = conn
        .prepare(
            "SELECT name FROM sqlite_master WHERE type IN ('table','virtual') OR name='chunks_fts'",
        )
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
            "table {required} missing after injection-shaped ingest; have {:?}",
            found
        );
    }
}

// ---------------------------------------------------------------------------
// TC-SEC-2.6 — concurrent reader during writer; WAL invariant.
// ---------------------------------------------------------------------------

#[test]
fn e2e_sec_2_6_concurrent_reader_during_writer_no_busy() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let kdir = tmp.path().join(".claude/knowledge");
    fs::create_dir_all(&kdir).expect("mkdir");

    // Five copies so the batch ingest takes a moment to run.
    for i in 0..5 {
        let p = kdir.join(format!("doc{i}.md"));
        fs::write(&p, format!("# Document {i}\n\n{}", "content text. ".repeat(50)))
            .expect("write");
    }

    // Initialize the DB by running an empty ingest first (to ensure WAL is set
    // before the reader thread connects). We ingest one file synchronously.
    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge/doc0.md"])
        .assert()
        .success();

    let db = kdir.join("index.db");

    let reader_db = db.clone();
    let stop_flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stop_flag_t = stop_flag.clone();

    let reader_handle = std::thread::spawn(move || {
        let conn = rusqlite::Connection::open(&reader_db).expect("reader open");
        // Read mode is fine; WAL allows concurrent reads alongside a writer.
        let mut iters = 0u64;
        let mut errors = 0u64;
        while !stop_flag_t.load(std::sync::atomic::Ordering::SeqCst) {
            let r: rusqlite::Result<i64> =
                conn.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0));
            if let Err(e) = r {
                let msg = format!("{e}");
                if msg.contains("SQLITE_BUSY") || msg.contains("database is locked") {
                    errors += 1;
                }
            }
            iters += 1;
            if iters > 10_000 {
                break;
            }
        }
        (iters, errors)
    });

    // Now run the full directory ingest as the writer.
    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge"])
        .assert()
        .success();

    stop_flag.store(true, std::sync::atomic::Ordering::SeqCst);
    let (iters, errors) = reader_handle.join().expect("reader thread");
    assert!(iters > 0, "reader thread must have executed at least once");
    assert_eq!(errors, 0, "no SQLITE_BUSY allowed during WAL writer");

    // PRAGMA journal_mode == wal.
    let conn = open_db(&db);
    let mode: String = conn
        .query_row("PRAGMA journal_mode", [], |r| r.get(0))
        .expect("pragma");
    assert_eq!(mode.to_lowercase(), "wal");
}

// ---------------------------------------------------------------------------
// TC-SEC-2.7 — cargo-audit gate. Deferred to build-runner Gate 4.
// ---------------------------------------------------------------------------

#[test]
#[ignore = "cargo-audit is enforced at /merge-ready Gate 4 (build-runner); see RUSTSEC tracking"]
fn tc_sec_2_7_cargo_audit_gate_deferred() {
    // This test is intentionally a no-op stub. The actual gate runs `cargo audit`
    // during /merge-ready Gate 4. The presence of this stub documents the test
    // case linkage in the test corpus.
}
