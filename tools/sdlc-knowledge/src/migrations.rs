//! Schema migrations.
//!
//! v0 → v1: stamp the `schema_version` row at 1 (schema body created by
//!          `store::open_or_init`).
//! v1 → v2: add `chunks.page_start` / `chunks.page_end` (nullable INTEGER) and
//!          create the `pages` table for full-page PDF text. Existing chunks
//!          keep `page_start = page_end = NULL` until the document is
//!          re-ingested — this is fully backward-compatible (search results
//!          for legacy chunks just lack page citations).
//!
//! SQL discipline: ONLY ?N parameterized statements; never format!/+ for user data.

use rusqlite::Connection;

use crate::store::StoreError;

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
    if current_version(conn) < 2 {
        apply_v2(conn)?;
    }
    Ok(())
}

/// v1 → v2 step: add nullable page columns to `chunks` (idempotent via
/// `pragma_table_info` probe), create the `pages` table, bump schema_version.
fn apply_v2(conn: &mut Connection) -> Result<(), StoreError> {
    if !column_exists(conn, "chunks", "page_start")? {
        // Static SQL — no user data interpolated. ALTER TABLE ... ADD COLUMN
        // is the SQLite-supported way to extend an existing table.
        conn.execute("ALTER TABLE chunks ADD COLUMN page_start INTEGER", [])?;
    }
    if !column_exists(conn, "chunks", "page_end")? {
        conn.execute("ALTER TABLE chunks ADD COLUMN page_end INTEGER", [])?;
    }
    conn.execute_batch(crate::store::SCHEMA_V2_PAGES_TABLE)?;
    // Bump schema_version → 2. There's exactly one row in schema_version
    // (FR-1.6 / iter-1 invariant); UPDATE without WHERE is fine.
    conn.execute(
        "UPDATE schema_version SET version = ?1",
        rusqlite::params![2i64],
    )?;
    Ok(())
}

fn column_exists(
    conn: &Connection,
    table: &str,
    column: &str,
) -> Result<bool, rusqlite::Error> {
    // pragma_table_info is itself a virtual table — its name is part of the
    // SQL grammar, not user-controlled, so referencing it via a static literal
    // is correct. The user-controlled `table` and `column` go through `?N`.
    let mut stmt = conn.prepare(
        "SELECT 1 FROM pragma_table_info(?1) WHERE name = ?2",
    )?;
    let mut rows = stmt.query(rusqlite::params![table, column])?;
    Ok(rows.next()?.is_some())
}
