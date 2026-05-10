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
use std::sync::Once;

use rusqlite::Connection;
use thiserror::Error;

/// Process-wide once-flag for sqlite-vec extension registration. The crate
/// exposes a C entrypoint `sqlite3_vec_init` and we register it as a SQLite
/// auto-extension via rusqlite's FFI. After registration EVERY new Connection
/// opened in this process automatically loads the vec0 virtual table builtin.
/// This must run BEFORE the first Connection::open in the process.
static SQLITE_VEC_INIT: Once = Once::new();

fn ensure_sqlite_vec_registered() {
    SQLITE_VEC_INIT.call_once(|| {
        // SAFETY: sqlite_vec::sqlite3_vec_init is the C entrypoint exported
        // by libsqlite_vec0. Transmuting to the auto-extension function
        // pointer signature is the documented usage pattern from the
        // sqlite-vec crate's own integration tests (sqlite-vec 0.1.9).
        unsafe {
            rusqlite::ffi::sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }
    });
}

use crate::output::{DocumentSummary, StatusInfo};

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

/// V2 schema delta (Slice 2 of vector-retrieval-backend). Applied on top of
/// `SCHEMA_V1` for fresh DBs. Existing v1 DBs go through
/// `migrations::migrate_v1_to_v2` which is destructive (drop+recreate) per
/// architect OQ-2 resolution.
///
/// Adds two columns to `chunks`:
///   - `type` — 'text' | 'table' | 'image'; defaults to 'text' for legacy rows
///   - `image_bytes` — PNG bytes BLOB for figure chunks (NULL for text)
///
/// Adds `chunks_vec` virtual table backed by sqlite-vec — vec0 with
/// `embedding float[384]` for e5-multilingual-small (Slice 5 populates it).
///
/// SQL discipline: static `&str` literal, no user data interpolation.
const SCHEMA_V2_DELTA: &str = r#"
ALTER TABLE chunks ADD COLUMN type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE chunks ADD COLUMN image_bytes BLOB;
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding float[384]);
"#;

/// Open (or create) the SQLite database at `db_path` with v2 schema enabled.
/// Loads the sqlite-vec extension at connection-open time (architect OQ-2
/// resolution: `sqlite_vec::load(&conn)` registers vec0 without enabling
/// rusqlite's `load_extension` feature, preserving the security posture).
///
/// Migration semantics for existing DBs:
///   - Fresh DB (schema_version absent): apply SCHEMA_V1 + SCHEMA_V2_DELTA, stamp version=2
///   - schema_version=1: caller MUST run `migrations::migrate_v1_to_v2` (destructive re-ingest)
///   - schema_version=2: idempotent no-op (CREATE ... IF NOT EXISTS clauses)
///
/// Returns the connection on success. Caller is responsible for invoking
/// migration if the DB is at v1 and needs upgrading.
pub fn open_or_init_v2(db_path: &Path) -> Result<Connection, StoreError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    // Register sqlite-vec auto-extension once per process BEFORE Connection::open
    // so the new connection picks up vec0 virtual table builtin + vec_distance_cosine
    // SQL function. Per architect OQ-2 this uses sqlite3_auto_extension (NOT
    // rusqlite's `load_extension` feature, which stays OFF — security posture).
    ensure_sqlite_vec_registered();
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.execute_batch(SCHEMA_V1)?;
    // Apply v2 delta only on fresh DBs (no schema_version row) OR when
    // schema_version=2 (idempotent CREATE IF NOT EXISTS for chunks_vec; the
    // ALTER TABLE statements would error on re-run for v2-already DBs, so we
    // gate them via current_version).
    let v: i64 = conn
        .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
        .unwrap_or(0);
    if v == 0 {
        // Fresh DB — apply delta and stamp version=2.
        conn.execute_batch(SCHEMA_V2_DELTA)?;
        conn.execute(
            "INSERT INTO schema_version(version) VALUES (?1)",
            rusqlite::params![2i64],
        )?;
    } else if v == 2 {
        // Already at v2 — only ensure chunks_vec exists (CREATE IF NOT EXISTS).
        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding float[384]);",
        )?;
    }
    // v == 1: caller runs migrate_v1_to_v2 explicitly. We don't auto-migrate
    // here because migration is destructive (architect-resolved).
    Ok(conn)
}

/// Confirm the four expected objects exist, `schema_version` row is in `1..=2`
/// (forward-compat for iter-2), and `chunks_fts` is an FTS5 virtual table.
///
/// Returns `IndexError::Corrupt` on ANY structural mismatch — including raw
/// rusqlite errors raised during the probe (a truncated database file, a file
/// that isn't a SQLite database at all, schema-master corruption, etc.).
/// Mapping all failure modes to a single variant prevents information leak
/// and lets the caller print the literal user-facing message
/// `error: index database invalid; re-ingest required` per FR-1.6 / AC-7.
pub fn validate_schema(conn: &Connection) -> Result<(), IndexError> {
    validate_schema_inner(conn).map_err(|_| IndexError::Corrupt)
}

/// Internal helper: any error here flips to `IndexError::Corrupt` in the public
/// wrapper. Using `anyhow::Error` would pull a runtime dep — instead, we use
/// `rusqlite::Error` plus a sentinel `Corrupt` short-circuit via `?`-on-`Result`.
fn validate_schema_inner(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Required objects (table or virtual-table).
    let required = ["documents", "chunks", "chunks_fts", "schema_version"];

    // A single sqlite_master scan: collect (name, type, sql) triples so we can
    // additionally verify chunks_fts is FTS5 (the CREATE VIRTUAL TABLE sql
    // contains the literal `fts5` token).
    let mut stmt = conn.prepare(
        "SELECT name, type, COALESCE(sql, '') FROM sqlite_master \
         WHERE name IN ('documents','chunks','chunks_fts','schema_version')",
    )?;
    let mut found: std::collections::HashMap<String, (String, String)> =
        std::collections::HashMap::new();
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
        ))
    })?;
    for row in rows {
        let (name, ty, sql) = row?;
        found.insert(name, (ty, sql));
    }
    for n in required {
        if !found.contains_key(n) {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
    }

    // chunks_fts must be a virtual table backed by FTS5.
    let (fts_type, fts_sql) = found
        .get("chunks_fts")
        .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
    if fts_type != "table" {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    if !fts_sql.to_lowercase().contains("fts5") {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    // schema_version row exists and is in 1..=2 (forward-compat for iter-2).
    let v: i64 = conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0))?;
    if !(1..=2).contains(&v) {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
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

/// List every ingested document with its chunk count, ordered by `ingested_at DESC`.
/// Used by `list` subcommand. SQL is a static literal.
pub fn list_documents(conn: &Connection) -> Result<Vec<DocumentSummary>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT d.source_path, \
                COUNT(c.id) AS chunk_count, \
                d.ingested_at \
         FROM documents d \
         LEFT JOIN chunks c ON c.doc_id = d.id \
         GROUP BY d.id \
         ORDER BY d.ingested_at DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(DocumentSummary {
            source_path: r.get(0)?,
            chunk_count: r.get(1)?,
            ingested_at: r.get(2)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Aggregate counts + schema_version + db_path for `status` subcommand.
pub fn status_summary(
    conn: &Connection,
    db_path: &Path,
) -> Result<StatusInfo, rusqlite::Error> {
    let schema_version: i64 =
        conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0))?;
    let doc_count: i64 = conn.query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))?;
    let chunk_count: i64 = conn.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))?;
    Ok(StatusInfo {
        schema_version,
        doc_count,
        chunk_count,
        db_path: db_path.display().to_string(),
    })
}

/// FR-4.5 result shape for `delete --by-id`. Serialized to JSON in `output.rs`
/// as `{"deleted_id": N, "source_path": "...", "chunks_removed": M}`.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DeleteByIdSummary {
    pub deleted_id: i64,
    pub source_path: String,
    pub chunks_removed: u64,
}

/// Delete a documents row by integer primary key, returning a summary of what
/// was removed (id + source_path + chunks_removed) per FR-4.5.
///
/// Wraps the multi-statement cascade in a `BEGIN IMMEDIATE` transaction per
/// FR-4.4 so the SELECT-source_path / SELECT-COUNT-chunks / DELETE-documents
/// triple is atomic against concurrent writers. The chunks rows cascade-delete
/// via the `chunks(doc_id) REFERENCES documents(id) ON DELETE CASCADE`
/// foreign-key constraint declared in `SCHEMA_V1`; FTS5 cleanup happens via
/// the `chunks_ad` AFTER-DELETE trigger on each chunk row removed.
///
/// Returns:
///   - `Ok(Some(summary))` — document existed and was deleted.
///   - `Ok(None)` — no documents row with that id; transaction rolls back
///     (implicit on drop without commit).
///   - `Err(...)` — SQL error during the probe or delete; transaction rolls
///     back.
pub fn delete_by_id_with_summary(
    conn: &mut Connection,
    id: i64,
) -> Result<Option<DeleteByIdSummary>, rusqlite::Error> {
    use rusqlite::OptionalExtension;

    // BEGIN IMMEDIATE per FR-4.4 — same transaction discipline as ingest.
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;

    let source_path: Option<String> = tx
        .query_row(
            "SELECT source_path FROM documents WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .optional()?;
    let source_path = match source_path {
        Some(s) => s,
        None => {
            // No row to delete; rollback is implicit on drop without commit.
            return Ok(None);
        }
    };

    let chunks_removed: u64 = tx.query_row(
        "SELECT COUNT(*) FROM chunks WHERE doc_id = ?1",
        rusqlite::params![id],
        |row| row.get::<_, i64>(0).map(|n| n as u64),
    )?;

    tx.execute(
        "DELETE FROM documents WHERE id = ?1",
        rusqlite::params![id],
    )?;
    // chunks rows cascade-delete via FOREIGN KEY ... ON DELETE CASCADE on
    // chunks.doc_id (declared in SCHEMA_V1); FTS5 stays in sync via the
    // chunks_ad AFTER DELETE trigger on each chunk row removed.

    tx.commit()?;
    Ok(Some(DeleteByIdSummary {
        deleted_id: id,
        source_path,
        chunks_removed,
    }))
}

/// Delete a documents row by exact `source_path` string. Returns rows deleted.
///
/// SECURITY: callers MUST canonicalize-and-prefix-check the `source_path`
/// argument against the project root BEFORE invoking this function — see the
/// Slice 1 cross-slice flag in `.claude/scratchpad.md`. This function does
/// NOT perform that check itself; it is purely a parameterized DELETE.
pub fn delete_by_source_path(
    conn: &Connection,
    source_path: &str,
) -> Result<u64, rusqlite::Error> {
    let n = conn.execute(
        "DELETE FROM documents WHERE source_path = ?1",
        rusqlite::params![source_path],
    )?;
    Ok(n as u64)
}
