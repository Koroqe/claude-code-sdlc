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

use clap::{Args, Subcommand, ValueEnum};
use std::path::{Path, PathBuf};
use thiserror::Error;

/// Search mode (Slice 7 of vector-retrieval-backend). Default is `hybrid` —
/// best quality when the e5-multilingual-small model is installed; falls
/// back to `lexical` automatically when the encoder model is missing or
/// the schema is at v1 (no chunks_vec virtual table).
#[derive(ValueEnum, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SearchMode {
    /// BM25-only via FTS5 (iter-1 baseline; works on v1 + v2 DBs without encoder)
    Lexical,
    /// Pure dense via sqlite-vec K-NN; requires e5 encoder + v2 schema
    Dense,
    /// BM25 ⊕ dense fused via RRF k=60; default mode (auto-fallback to lexical
    /// when encoder unavailable)
    Hybrid,
}

impl Default for SearchMode {
    fn default() -> Self {
        SearchMode::Hybrid
    }
}

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
    /// Search mode: `lexical` (BM25 FTS5), `dense` (sqlite-vec K-NN), or
    /// `hybrid` (BM25 ⊕ dense via RRF k=60). Default `hybrid` — auto-falls-back
    /// to lexical when the e5 encoder model or chunks_vec virtual table is
    /// unavailable, with a warning printed to stderr.
    #[arg(long, value_enum, default_value_t = SearchMode::Hybrid)]
    pub mode: SearchMode,
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
pub struct WarmupArgs {
    /// Suppress success output; only stderr warnings on failure.
    #[arg(long)]
    pub quiet: bool,
}

/// `claudeknows compare <query>` — A/B-test all 3 search modes side-by-side.
/// Runs the same query through lexical / dense / hybrid and prints the
/// FULL chunk text (not the FTS5 snippet) for each hit so the operator
/// can judge retrieval quality + see exactly what would be sent to an
/// LLM as context-augmentation input.
#[derive(Args, Debug)]
pub struct CompareArgs {
    /// Query string to A/B test across modes.
    pub query: String,
    /// Top-K hits per mode (default 5).
    #[arg(long, default_value_t = 5)]
    pub top_k: usize,
    /// Truncate each chunk's full text to this many chars (0 = no truncation).
    /// Useful when chunks are large and you only want a preview.
    #[arg(long, default_value_t = 0)]
    pub max_chars: usize,
    #[arg(long)]
    pub project_root: Option<PathBuf>,
    /// Emit JSON instead of human-readable side-by-side blocks.
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
    /// Pre-download the e5-multilingual-small encoder model so the first
    /// `ingest` / `search --mode hybrid` doesn't pay a 30-second cold-start
    /// model-download stall. Idempotent: re-runs are no-ops once the
    /// model is cached at `~/.claude/tools/sdlc-knowledge/models/`. Network
    /// failures (offline install, HF rate limit) are warnings, not errors —
    /// fastembed falls back to lazy download on first real use.
    Warmup(WarmupArgs),
    /// A/B-test all three search modes (lexical / dense / hybrid) for the
    /// same query, side-by-side, with FULL chunk text so the operator can
    /// judge retrieval quality + preview exactly what an LLM would receive
    /// as context-augmentation input.
    Compare(CompareArgs),
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
