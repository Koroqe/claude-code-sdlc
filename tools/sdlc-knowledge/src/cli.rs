//! CLI argument structs + `resolve_project_root` security backbone.
//!
//! `resolve_project_root` is the ONLY path-from-user-input gate in this binary.
//! Every subcommand MUST funnel filesystem access through the canonicalized
//! `PathBuf` returned here. Adding any other public function in this module
//! that returns `PathBuf` will break the `test_cli_rs_has_single_pub_pathbuf_fn`
//! invariant in `tests/path_safety_test.rs`.
//!
//! Phase 1.5 Security MUST requirements implemented:
//!   1. Canonicalize BOTH `--project-root` arg AND `current_dir()` (macOS /tmp aliasing).
//!   2. Use `Path::starts_with` on canonicalized `PathBuf`s — never `str::starts_with`.
//!   3. Order: canonicalize → prefix-check (not the reverse).
//!   4. Literal stderr message + exit 2 (handled by caller in `main.rs`).
//!   5. Stay in `Path`/`PathBuf`/`OsStr`; never `to_str().unwrap()` on path bytes.
//!   6. Map ALL `canonicalize` errors uniformly to `EscapesCwd` (no info leak).
//!   7. Callers receive the canonicalized `PathBuf`, never the original arg (TOCTOU discipline).

use clap::{Args, Subcommand};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProjectRootError {
    #[error("project-root must resolve under current working directory")]
    EscapesCwd,
}

/// Resolve a project-root argument under the current working directory.
///
/// Returns the canonicalized `PathBuf` on success. Any path that escapes the
/// canonicalized cwd — via `..` traversal, symlink target, or absolute path —
/// is rejected with `ProjectRootError::EscapesCwd`. All `canonicalize` errors
/// (ENOENT, EACCES, ELOOP, …) are mapped uniformly to the same variant to
/// avoid information leaks.
///
/// When `arg` is `None`, the canonicalized cwd itself is returned.
pub fn resolve_project_root(arg: Option<&Path>) -> Result<PathBuf, ProjectRootError> {
    let cwd = std::env::current_dir().map_err(|_| ProjectRootError::EscapesCwd)?;
    let cwd_canonical = std::fs::canonicalize(&cwd).map_err(|_| ProjectRootError::EscapesCwd)?;

    let target = match arg {
        Some(p) => p.to_path_buf(),
        None => return Ok(cwd_canonical),
    };

    // Resolve relative paths against the original cwd; canonicalize will then
    // walk the symlink chain on the resulting absolute path.
    let resolved = if target.is_absolute() {
        target
    } else {
        cwd.join(target)
    };

    let target_canonical =
        std::fs::canonicalize(&resolved).map_err(|_| ProjectRootError::EscapesCwd)?;

    if !target_canonical.starts_with(&cwd_canonical) {
        return Err(ProjectRootError::EscapesCwd);
    }

    Ok(target_canonical)
}

// ---------------------------------------------------------------------------
// Subcommand argument structs. Each carries `--project-root` and `--json`.
// ---------------------------------------------------------------------------

#[derive(Args, Debug)]
pub struct IngestArgs {
    /// File or directory to ingest.
    pub path: PathBuf,
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct SearchArgs {
    /// Query string.
    pub query: String,
    #[arg(long, default_value_t = 5)]
    pub top_k: usize,
    /// Expand each hit with ±N neighbor chunks from the same document so the
    /// agent gets paragraph-level context around the BM25 match. Default 0
    /// (backward-compat — no expansion). Capped at 10. With N=1 each hit
    /// returns ~1500 chars of context (3 chunks × ~500 chars); N=2 ≈ 2500
    /// chars; N=3 ≈ 3500 chars. The matching chunk's `chunk_id` and `score`
    /// remain unchanged — context is additive in the new `context` JSON
    /// field, omitted when N=0.
    #[arg(long, default_value_t = 0)]
    pub context: usize,
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct ListArgs {
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct StatusArgs {
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct DeleteArgs {
    /// Source path (legacy positional form; mutually exclusive with `--by-id`).
    pub source_path: Option<String>,
    /// Delete by integer document id (mutually exclusive with positional `<source-path>`).
    #[arg(long = "by-id")]
    pub by_id: Option<i64>,
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(Args, Debug)]
pub struct PageArgs {
    /// Source path (positional). Mutually exclusive with `--by-id`. The path
    /// is interpreted exactly as it appears in `documents.source_path` (i.e.
    /// the canonicalized form ingest stored). Use `claudeknows list` to see
    /// the indexed paths.
    pub source_path: Option<String>,
    /// Document id (mutually exclusive with positional `<source-path>`).
    #[arg(long = "by-id")]
    pub by_id: Option<i64>,
    /// 1-indexed page number to fetch.
    #[arg(long)]
    pub page: i64,
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(Subcommand, Debug)]
pub enum Command {
    /// Ingest a file or directory into the knowledge base.
    Ingest(IngestArgs),
    /// Search the knowledge base with a BM25-ranked query.
    Search(SearchArgs),
    /// List ingested sources.
    List(ListArgs),
    /// Show knowledge base status (counts, size, schema version).
    Status(StatusArgs),
    /// Delete a source by ID.
    Delete(DeleteArgs),
    /// Fetch the full extracted text of a single PDF page.
    Page(PageArgs),
}

#[derive(clap::Parser, Debug)]
#[command(
    name = "sdlc-knowledge",
    version,
    about = "Local knowledge base CLI for SDLC agents"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

// ---------------------------------------------------------------------------
// Unit tests for resolve_project_root (TOCTOU discipline + canonical PathBuf).
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_returns_canonical_pathbuf_for_dot() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let prev = std::env::current_dir().expect("cwd");

        // Note: setting cwd in tests is process-global; tests in this `cfg(test)`
        // module are intentionally minimal and run serially per Cargo defaults
        // for the same compilation unit. We restore cwd at the end.
        std::env::set_current_dir(tmp.path()).expect("set cwd");

        let resolved = resolve_project_root(Some(Path::new("."))).expect("resolve `.`");
        let expected = std::fs::canonicalize(tmp.path()).expect("canonicalize tmp");

        assert_eq!(resolved, expected);
        assert!(resolved.is_absolute(), "resolved path must be absolute");

        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[test]
    fn resolve_default_returns_canonical_cwd() {
        let resolved = resolve_project_root(None).expect("resolve default");
        let cwd = std::env::current_dir().expect("cwd");
        let canonical = std::fs::canonicalize(&cwd).expect("canonicalize cwd");
        assert_eq!(resolved, canonical);
    }
}
