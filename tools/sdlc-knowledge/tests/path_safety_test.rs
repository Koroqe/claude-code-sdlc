//! TDD tests for Slice 1: path-canonicalization safety (the security backbone).
//!
//! Phase 1.5 Security Pre-Review:
//!   - 7 MUST requirements (canonicalize both sides, Path::starts_with, uniform error mapping, …)
//!   - 4 TC-AAI-3 subcases + 9 additional cases.
//!
//! Each test runs the binary under a tempdir cwd to keep resolution scoped and isolated.

use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;
use std::path::PathBuf;

const ESCAPE_MSG: &str = "error: project-root must resolve under current working directory";

fn bin() -> Command {
    Command::cargo_bin("sdlc-knowledge").expect("binary built")
}

// ---------------------------------------------------------------------------
// TC-AAI-3: 4 canonical subcases
// ---------------------------------------------------------------------------

#[test]
fn test_traversal_dotdot() {
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".", "--project-root", "../../../etc"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
#[cfg(unix)]
fn test_symlink_escape() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let link = tmp.path().join("escape");
    std::os::unix::fs::symlink("/etc", &link).expect("symlink to /etc");

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".", "--project-root", "escape"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
fn test_absolute_outside_cwd() {
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".", "--project-root", "/etc"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
#[cfg(target_os = "macos")]
fn test_cwd_is_symlink_no_false_reject() {
    // On macOS, /tmp is a symlink to /private/tmp. If we set cwd to /tmp/<sub>,
    // canonicalization of cwd resolves to /private/tmp/<sub>. A relative
    // --project-root . MUST NOT be rejected just because of that aliasing.
    let tmp_under_var = tempfile::Builder::new()
        .prefix("sdlc-knowledge-symlinkcwd-")
        .tempdir_in("/tmp")
        .expect("tempdir under /tmp");
    // Path through the /tmp alias (not /private/tmp).
    let tmp_path = tmp_under_var.path();

    bin()
        .current_dir(tmp_path)
        .args(["ingest", ".", "--project-root", "."])
        .assert()
        // Placeholder body returns exit 1; this proves the path-resolve gate did NOT reject.
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));
}

// ---------------------------------------------------------------------------
// Phase 1.5 additional 9 cases
// ---------------------------------------------------------------------------

#[test]
#[cfg(unix)]
fn test_non_utf8_path_no_panic() {
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;

    let tmp = tempfile::tempdir().expect("tempdir");
    let bad: &OsStr = OsStr::from_bytes(&[0xff, 0xfe, b'/', b'x']);

    bin()
        .current_dir(tmp.path())
        .arg("ingest")
        .arg(".")
        .arg("--project-root")
        .arg(bad)
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
fn test_trailing_slash_normalization() {
    // `./` and `.` both succeed (resolve to canonicalized cwd).
    let tmp = tempfile::tempdir().expect("tempdir");

    for arg in [".", "./"] {
        bin()
            .current_dir(tmp.path())
            .args(["ingest", ".", "--project-root", arg])
            .assert()
            .code(1)
            .stderr(predicate::str::contains("not yet implemented"));
    }
}

#[test]
#[cfg(unix)]
fn test_symlink_loop() {
    let tmp = tempfile::tempdir().expect("tempdir");
    let loop_path = tmp.path().join("loop");
    // Self-referential symlink: ELOOP on canonicalize.
    std::os::unix::fs::symlink(&loop_path, &loop_path).expect("create loop symlink");

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".", "--project-root", "loop"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
fn test_project_root_equal_to_cwd() {
    // Pass canonicalized cwd as absolute project-root; expect the path-gate
    // accepts it (placeholder still returns exit 1 with "not yet implemented").
    let tmp = tempfile::tempdir().expect("tempdir");
    let canonical = fs::canonicalize(tmp.path()).expect("canonicalize tmp");

    bin()
        .current_dir(tmp.path())
        .arg("ingest")
        .arg(".")
        .arg("--project-root")
        .arg(&canonical)
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));
}

#[test]
fn test_project_root_is_regular_file() {
    // Helper is path-scope only; does not reject a regular file.
    // Subcommands validate dir-ness in their own bodies (deferred to later slices).
    let tmp = tempfile::tempdir().expect("tempdir");
    let file = tmp.path().join("file.txt");
    fs::write(&file, b"hello").expect("write file");

    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".", "--project-root", "file.txt"])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));
}

#[test]
fn test_path_starts_with_boundary() {
    // Critical: ensure Path::starts_with vs str::starts_with — `proj` vs `projx` MUST be rejected.
    let tmp = tempfile::tempdir().expect("tempdir");
    let proj = tmp.path().join("proj");
    let projx = tmp.path().join("projx").join("sub");
    fs::create_dir_all(&proj).expect("create proj");
    fs::create_dir_all(&projx).expect("create projx/sub");

    let projx_canonical = fs::canonicalize(tmp.path().join("projx")).expect("canon projx");

    // cwd is `proj`, project-root is absolute `projx`.
    // Naive str::starts_with would reject ONLY if `proj_canonical` is a substring
    // prefix of `projx_canonical` text. Path::starts_with on canonicalized paths
    // operates on path components, so `/.../proj` is NOT a prefix of `/.../projx`.
    bin()
        .current_dir(&proj)
        .arg("ingest")
        .arg(".")
        .arg("--project-root")
        .arg(&projx_canonical)
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
fn test_no_panic_on_eacces() {
    // Pass a path under /root which typically returns EACCES on canonicalize for non-root users.
    // Even if the runner happens to be root or the OS returns ENOENT, the contract is exit 2 + literal stderr — never panic.
    let tmp = tempfile::tempdir().expect("tempdir");
    bin()
        .current_dir(tmp.path())
        .args(["ingest", ".", "--project-root", "/root/no-such-dir-xyz-9q8w7e"])
        .assert()
        .code(2)
        .stderr(predicate::str::contains(ESCAPE_MSG));
}

#[test]
fn test_placeholder_smoke() {
    // Each placeholder subcommand exits 1 with stderr "not yet implemented".
    let tmp = tempfile::tempdir().expect("tempdir");

    // ingest
    bin()
        .current_dir(tmp.path())
        .args(["ingest", "."])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));

    // search
    bin()
        .current_dir(tmp.path())
        .args(["search", "hello"])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));

    // list
    bin()
        .current_dir(tmp.path())
        .args(["list"])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));

    // status
    bin()
        .current_dir(tmp.path())
        .args(["status"])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));

    // delete (positional source-id required)
    bin()
        .current_dir(tmp.path())
        .args(["delete", "abc123"])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));
}

// ---------------------------------------------------------------------------
// Compile-time-ish discipline: cli.rs has exactly ONE pub fn returning PathBuf
// (resolve_project_root is the only path-from-user-input gate).
// ---------------------------------------------------------------------------

#[test]
fn test_cli_rs_has_single_pub_pathbuf_fn() {
    let cli_rs = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src").join("cli.rs");
    let src = fs::read_to_string(&cli_rs).expect("read cli.rs");

    // Match `pub fn ... -> ... PathBuf` (allow `Result<PathBuf, ...>` etc.). Counted by line.
    let mut count = 0usize;
    for line in src.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("pub fn") && trimmed.contains("PathBuf") {
            count += 1;
        }
    }
    assert_eq!(
        count, 1,
        "cli.rs must expose exactly ONE pub fn returning PathBuf (the security backbone); found {count}"
    );
}
