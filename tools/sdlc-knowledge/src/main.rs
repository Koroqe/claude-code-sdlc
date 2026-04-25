//! sdlc-knowledge — local knowledge base CLI for SDLC agents.
//!
//! Slice 1 establishes the binary skeleton and the path-canonicalization
//! security backbone. All five subcommands (`ingest`, `search`, `list`,
//! `status`, `delete`) are wired and parse their arguments, but their
//! bodies are intentional placeholders that emit `not yet implemented` and
//! exit 1. Subsequent slices replace each placeholder body without touching
//! the dispatch structure here.

use clap::Parser;

mod cli;

use cli::{Cli, Command};

fn main() -> std::process::ExitCode {
    let cli = Cli::parse();

    // Resolve project_root for ALL subcommands BEFORE any subcommand-specific work.
    // This is the load-bearing FS-access gate (Phase 1.5 Security MUST #3 + #4 + #7).
    let project_root_arg = match &cli.command {
        Command::Ingest(a) => a.project_root.as_deref(),
        Command::Search(a) => a.project_root.as_deref(),
        Command::List(a) => a.project_root.as_deref(),
        Command::Status(a) => a.project_root.as_deref(),
        Command::Delete(a) => a.project_root.as_deref(),
    };

    let _root = match cli::resolve_project_root(project_root_arg) {
        Ok(p) => p,
        Err(_) => {
            // Uniform error mapping: every canonicalize failure prints the same
            // literal stderr and exits 2 (Phase 1.5 Security MUST #4 + #6).
            eprintln!("error: project-root must resolve under current working directory");
            return std::process::ExitCode::from(2);
        }
    };

    // Placeholder subcommand bodies — replaced in subsequent slices.
    match cli.command {
        Command::Ingest(_)
        | Command::Search(_)
        | Command::List(_)
        | Command::Status(_)
        | Command::Delete(_) => {
            eprintln!("error: not yet implemented");
            std::process::ExitCode::from(1)
        }
    }
}
