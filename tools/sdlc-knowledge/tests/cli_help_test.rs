//! TDD tests for Slice 1: CLI help/version contract.
//!
//! Coverage:
//! - TC-1: `sdlc-knowledge --help` succeeds (exit 0); stdout lists all 5 subcommands.
//! - TC-2: `sdlc-knowledge --version` exits 0; stdout matches `sdlc-knowledge X.Y.Z` semver shape.
//! - TC-3: placeholder smoke — `sdlc-knowledge ingest <path>` exits 1 with `not yet implemented`.

use assert_cmd::Command;
use predicates::prelude::*;

fn bin() -> Command {
    Command::cargo_bin("sdlc-knowledge").expect("binary built")
}

#[test]
fn help_lists_all_five_subcommands() {
    let assert = bin().arg("--help").assert().success();

    let output = assert.get_output();
    let stdout = String::from_utf8_lossy(&output.stdout);

    for sub in ["ingest", "search", "list", "status", "delete"] {
        assert!(
            stdout.contains(sub),
            "expected --help stdout to contain subcommand `{sub}`; got:\n{stdout}"
        );
    }
}

#[test]
fn version_prints_semver_shape() {
    let assert = bin().arg("--version").assert().success();
    let output = assert.get_output();
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Expect `sdlc-knowledge <semver>\n`
    let trimmed = stdout.trim();
    assert!(
        trimmed.starts_with("sdlc-knowledge "),
        "expected version line to start with `sdlc-knowledge `; got: {trimmed}"
    );

    let rest = trimmed.trim_start_matches("sdlc-knowledge ").trim();
    let parts: Vec<&str> = rest.split('.').collect();
    assert_eq!(
        parts.len(),
        3,
        "expected semver MAJOR.MINOR.PATCH; got: {rest}"
    );
    for (i, part) in parts.iter().enumerate() {
        assert!(
            part.chars().all(|c| c.is_ascii_digit()),
            "semver component #{i} `{part}` is not all digits in: {rest}"
        );
    }
}

#[test]
fn placeholder_subcommand_exits_one_with_not_yet_implemented() {
    // We must run from a tempdir so resolve_project_root succeeds for the default case.
    // The subcommand body is the placeholder that stderr-prints "not yet implemented".
    let tmp = tempfile::tempdir().expect("tempdir");

    bin()
        .current_dir(tmp.path())
        .args(["ingest", "."])
        .assert()
        .code(1)
        .stderr(predicate::str::contains("not yet implemented"));
}
