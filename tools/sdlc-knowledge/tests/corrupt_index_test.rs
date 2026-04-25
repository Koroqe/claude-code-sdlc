//! AC-7 / FR-1.6 corrupt-index handling.
//!
//! For each read subcommand (search, list, status, delete):
//! - Set up project, ingest sample.md (creates index.db).
//! - Truncate index.db to 100 bytes.
//! - Run the subcommand → exit 1, stderr contains literal
//!   `error: index database invalid; re-ingest required`,
//!   stderr does NOT contain `panicked at`.

use assert_cmd::Command;
use std::fs::{self, OpenOptions};
use std::path::PathBuf;

const FIXTURES_REL: &str = "tests/fixtures";

fn bin() -> Command {
    Command::cargo_bin("sdlc-knowledge").expect("binary built")
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(FIXTURES_REL)
}

/// Project tempdir with sample.md ingested then index.db truncated to 100 bytes.
fn project_with_truncated_index() -> tempfile::TempDir {
    let tmp = tempfile::tempdir().expect("tempdir");
    let kdir = tmp.path().join(".claude/knowledge");
    fs::create_dir_all(&kdir).expect("mkdir");
    let src = fixtures_dir().join("sample.md");
    let dst = kdir.join("sample.md");
    fs::copy(&src, &dst).expect("copy sample.md");

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".claude/knowledge/sample.md"])
        .assert()
        .success();

    let db = kdir.join("index.db");
    let f = OpenOptions::new()
        .write(true)
        .open(&db)
        .expect("open index.db for truncate");
    f.set_len(100).expect("truncate to 100 bytes");
    drop(f);

    tmp
}

fn assert_corrupt_message(stderr: &str) {
    assert!(
        stderr.contains("error: index database invalid; re-ingest required"),
        "expected literal corrupt-index stderr message; got:\n{stderr}"
    );
    assert!(
        !stderr.contains("panicked at"),
        "stderr must NOT contain `panicked at`; got:\n{stderr}"
    );
}

#[test]
fn corrupt_index_search_exits_1_no_panic() {
    let tmp = project_with_truncated_index();
    let assert = bin()
        .current_dir(tmp.path())
        .args(["search", "x"])
        .assert()
        .failure()
        .code(1);
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert_corrupt_message(&stderr);
}

#[test]
fn corrupt_index_list_exits_1_no_panic() {
    let tmp = project_with_truncated_index();
    let assert = bin()
        .current_dir(tmp.path())
        .args(["list"])
        .assert()
        .failure()
        .code(1);
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert_corrupt_message(&stderr);
}

#[test]
fn corrupt_index_status_exits_1_no_panic() {
    let tmp = project_with_truncated_index();
    let assert = bin()
        .current_dir(tmp.path())
        .args(["status"])
        .assert()
        .failure()
        .code(1);
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert_corrupt_message(&stderr);
}

#[test]
fn corrupt_index_delete_exits_1_no_panic() {
    let tmp = project_with_truncated_index();
    let assert = bin()
        .current_dir(tmp.path())
        .args(["delete", "1"])
        .assert()
        .failure()
        .code(1);
    let stderr = String::from_utf8_lossy(&assert.get_output().stderr).to_string();
    assert_corrupt_message(&stderr);
}
