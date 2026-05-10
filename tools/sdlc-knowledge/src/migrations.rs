//! Schema migrations. Iter-1 has a single v1 migration; iter-2
//! (vector-retrieval-backend Slice 2) adds the v1→v2 destructive re-ingest
//! path per architect OQ-2 resolution. v3 (Slice 12 page-level addressing)
//! is applied additively inside `store::open_or_init_v2` rather than via a
//! separate migration step, since the only structural change is two
//! `ALTER TABLE chunks` columns + a new `pages` table.
//!
//! SQL discipline: ONLY ?N parameterized statements; never format!/+ for user data.

use std::io::{self, BufRead, IsTerminal, Write};

use rusqlite::Connection;

use crate::store::StoreError;

/// Outcome of v1→v2 migration attempt. Communicated to the caller (CLI / tests)
/// so they can print the right hint and exit code.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MigrationOutcome {
    /// DB had no schema_version row (fresh) — caller initializes v2 directly.
    Fresh,
    /// DB is already at v2 — no-op.
    AlreadyV2,
    /// v1 → v2 migration completed (drop+recreate); user must re-ingest.
    Migrated,
    /// v1 detected but user declined or non-TTY without env-var override.
    Declined,
}

/// Read the current `schema_version` row (returns 0 if the row is missing).
pub fn current_version(conn: &Connection) -> u32 {
    let r: Result<i64, rusqlite::Error> =
        conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0));
    r.map(|v| v as u32).unwrap_or(0)
}

/// Apply pending migrations up to the latest version (currently 2).
pub fn run_migrations(conn: &mut Connection) -> Result<(), StoreError> {
    let v = current_version(conn);
    if v == 0 {
        // v0 → v1: schema bodies are already created by `store::open_or_init`.
        // Stamp the version row exactly once, parameterized.
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM schema_version", [], |r| r.get(0))?;
        if n == 0 {
            conn.execute(
                "INSERT INTO schema_version(version) VALUES (?1)",
                rusqlite::params![1i64],
            )?;
        }
    }
    Ok(())
}

/// Migrate a v1 schema DB to v2 (Slice 2 of vector-retrieval-backend).
/// Architect OQ-2 resolution: destructive — drop all tables + recreate via
/// SCHEMA_V1 + SCHEMA_V2_DELTA. User must re-run `claudeknows ingest`
/// afterwards to repopulate chunks + embeddings.
///
/// Confirmation flow:
/// - `CLAUDEKNOWS_AUTO_REINGEST=1` env var → skip prompt, auto-confirm
/// - TTY interactive → prompt `Re-ingest required for v2 schema. Proceed? [y/N] `;
///   only `y` / `yes` (case-insensitive) confirms, default-deny otherwise
/// - non-TTY without env var → default-deny (returns `Declined`)
pub fn migrate_v1_to_v2(conn: &mut Connection) -> Result<MigrationOutcome, StoreError> {
    let v = current_version(conn);
    if v == 0 {
        return Ok(MigrationOutcome::Fresh);
    }
    if v >= 2 {
        return Ok(MigrationOutcome::AlreadyV2);
    }
    // v == 1: needs migration
    if !confirm_destructive_migration() {
        return Ok(MigrationOutcome::Declined);
    }
    // Drop all data tables. chunks_fts triggers cascade-drop with chunks.
    // Drop schema_version last so a partially-failed migration leaves the
    // version row intact for retry.
    conn.execute_batch(
        "DROP TABLE IF EXISTS chunks_fts; \
         DROP TRIGGER IF EXISTS chunks_ai; \
         DROP TRIGGER IF EXISTS chunks_ad; \
         DROP TRIGGER IF EXISTS chunks_au; \
         DROP TABLE IF EXISTS chunks; \
         DROP TABLE IF EXISTS documents;",
    )?;
    // Reset schema_version row so the next open_or_init_v2 sees a fresh DB
    // and applies SCHEMA_V1 + SCHEMA_V2_DELTA + SCHEMA_V3_DELTA and stamps version=3.
    conn.execute("DELETE FROM schema_version", [])?;
    Ok(MigrationOutcome::Migrated)
}

/// User confirmation gate for destructive migration. Honors
/// `CLAUDEKNOWS_AUTO_REINGEST=1` for headless runs.
fn confirm_destructive_migration() -> bool {
    if std::env::var("CLAUDEKNOWS_AUTO_REINGEST").as_deref() == Ok("1") {
        return true;
    }
    let stdin = io::stdin();
    if !stdin.is_terminal() {
        // Headless without env-var override: default-deny per architect spec.
        return false;
    }
    print!("Re-ingest required for v2 schema. Proceed? [y/N] ");
    let _ = io::stdout().flush();
    let mut buf = String::new();
    let mut handle = stdin.lock();
    if handle.read_line(&mut buf).is_err() {
        return false;
    }
    matches!(buf.trim().to_ascii_lowercase().as_str(), "y" | "yes")
}
