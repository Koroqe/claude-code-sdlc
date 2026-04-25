//! sdlc-knowledge library crate — exposes internal modules for integration tests
//! and (later) other consumers. The `main.rs` binary wires the CLI on top.
//!
//! Cargo auto-detects this `src/lib.rs` and produces both a `bin` and `lib`
//! target without any Cargo.toml edits (architect-approved invariant for
//! Slice 2).

pub mod cli;
pub mod ingest;
pub mod migrations;
pub mod output;
pub mod pdf;
pub mod search;
pub mod store;
pub mod text;
