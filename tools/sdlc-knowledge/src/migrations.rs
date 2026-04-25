//! Schema migrations. Iter-1 has a single v1 migration; the structure makes it
//! straightforward to append v2/v3 in iter-2 without rewriting v1 (FR-4.4).
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

/// Apply pending migrations. v1 ensures the row equals 1; future versions will
/// step through subsequent integer versions.
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
    // Future: while current_version(conn) < TARGET { apply_next(conn)?; }
    Ok(())
}
