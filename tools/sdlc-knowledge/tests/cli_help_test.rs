//! TDD tests for Slice 1/2/3: CLI help/version + smoke contract.
//!
//! Coverage:
//! - TC-1: `sdlc-knowledge --help` succeeds (exit 0); stdout lists all 5 subcommands.
//! - TC-2: `sdlc-knowledge --version` exits 0; stdout matches `sdlc-knowledge X.Y.Z` semver shape.
//! - TC-3: smoke — `sdlc-knowledge search <q>` against a brand-new project (no ingest yet)
//!   exits 0 with an empty result. As of Slice 3 the placeholder bodies are gone; the
//!   first run on a clean project creates an empty-but-valid DB and the search yields `[]`.

use assert_cmd::Command;

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
fn search_on_fresh_project_returns_empty_array() {
    // As of Slice 3, all 4 read subcommands are implemented and a brand-new
    // project (no ingest yet) returns an empty-but-valid result without
    // tripping the corrupt-index gate. This is the post-Slice-3 replacement
    // for the old "placeholder exits 1" smoke probe.
    let tmp = tempfile::tempdir().expect("tempdir");

    let assert = bin()
        .current_dir(tmp.path())
        .args(["search", "anything", "--json"])
        .assert()
        .success();
    let stdout = String::from_utf8_lossy(&assert.get_output().stdout).to_string();
    assert_eq!(stdout.trim(), "[]");
}
