//! Storage layer: schema initialization, WAL pragma, FTS5 trigger wiring,
//! and `validate_schema` corruption probe.
//!
//! SQL discipline: ONLY ?N parameterized statements; never format!/+ for user data.
//!
//! Phase 1.5 Security MUSTs implemented here:
//!   #4  All SQL is either a static `&str` literal (CREATE/PRAGMA) or a parameterized
//!       statement using `rusqlite::params!`. Never `format!`/`write!`/`+` to build SQL.
//!
//! `open_or_init` opens the SQLite file (creating its parent dirs as needed),
//! flips `journal_mode` to WAL (NFR-1.6 / FR-2.7), and runs the v1 schema.
//! `validate_schema` confirms the four-table shape and `schema_version=1`.

use std::path::Path;

use rusqlite::Connection;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Error)]
pub enum IndexError {
    #[error("index database invalid; re-ingest required")]
    Corrupt,
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

/// V1 schema — kept as a static `&str` literal; no user data interpolated.
const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  source_path TEXT UNIQUE NOT NULL,
  mtime INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  ingested_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text,
  content='chunks',
  content_rowid='id'
);

CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES('delete', old.id, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.id, new.text);
END;
"#;

/// Open (or create) the SQLite database at `db_path`, ensure parent directories exist,
/// flip journal_mode to WAL, and apply the v1 schema. Idempotent — safe to call on
/// an already-initialized database.
pub fn open_or_init(db_path: &Path) -> Result<Connection, StoreError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;
    // WAL is per-database persistent so this only matters first-run, but the call is
    // idempotent and very cheap.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(SCHEMA_V1)?;
    Ok(conn)
}

/// Confirm the four expected tables exist and `schema_version` row equals 1.
/// Returns `IndexError::Corrupt` on any structural mismatch.
pub fn validate_schema(conn: &Connection) -> Result<(), IndexError> {
    // Required objects (table or virtual-table).
    let required = ["documents", "chunks", "chunks_fts", "schema_version"];
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') OR name='chunks_fts'",
    )?;
    let mut names = std::collections::HashSet::new();
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    for r in rows {
        names.insert(r?);
    }
    for n in required {
        if !names.contains(n) {
            return Err(IndexError::Corrupt);
        }
    }

    // schema_version row exists and equals 1.
    let v: Result<i64, rusqlite::Error> =
        conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0));
    match v {
        Ok(1) => Ok(()),
        _ => Err(IndexError::Corrupt),
    }
}

/// Insert or update a documents row; returns the row id.
///
/// SQL discipline: parameterized via `?1..?4`. The literal SQL is a static `&str`.
pub fn upsert_document(
    conn: &Connection,
    source_path: &str,
    mtime: i64,
    sha256: &str,
    ingested_at: i64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO documents(source_path, mtime, sha256, ingested_at) \
         VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(source_path) DO UPDATE SET \
           mtime = excluded.mtime, \
           sha256 = excluded.sha256, \
           ingested_at = excluded.ingested_at",
        rusqlite::params![source_path, mtime, sha256, ingested_at],
    )?;
    let id: i64 = conn.query_row(
        "SELECT id FROM documents WHERE source_path = ?1",
        rusqlite::params![source_path],
        |r| r.get(0),
    )?;
    Ok(id)
}

/// Replace all chunks for a document: delete prior rows then insert the new set.
/// FTS5 triggers fire for each row, so the FTS5 index stays in sync.
pub fn replace_chunks(
    conn: &Connection,
    doc_id: i64,
    chunks: &[(usize, &str)],
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM chunks WHERE doc_id = ?1",
        rusqlite::params![doc_id],
    )?;
    let mut stmt = conn.prepare("INSERT INTO chunks(doc_id, ord, text) VALUES (?1, ?2, ?3)")?;
    for (ord, text) in chunks {
        stmt.execute(rusqlite::params![doc_id, *ord as i64, *text])?;
    }
    Ok(())
}

/// Look up the prior `(mtime, sha256)` for a source path, if any.
pub fn lookup_document(
    conn: &Connection,
    source_path: &str,
) -> Result<Option<(i64, String)>, rusqlite::Error> {
    let row: Result<(i64, String), rusqlite::Error> = conn.query_row(
        "SELECT mtime, sha256 FROM documents WHERE source_path = ?1",
        rusqlite::params![source_path],
        |r| Ok((r.get(0)?, r.get(1)?)),
    );
    match row {
        Ok(t) => Ok(Some(t)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}
