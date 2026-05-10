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
///
/// V2 additions (page tracking) are applied via `migrations::run_migrations`:
///   - `chunks.page_start` / `chunks.page_end` (nullable INTEGER) — first and
///     last 1-indexed PDF page covered by the chunk text. NULL for non-PDF
///     sources. For PDFs (per-page chunking) `page_start = page_end`.
///   - new `pages` table — one row per (doc_id, page_no) holding the full
///     extracted text of that page. Powers the `page` subcommand which
///     returns the raw page text without re-running PDFium.
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
    // Register sqlite-vec auto-extension here too (Slice 7 CLI-wiring fix):
    // the extension is process-global once registered, and registering on the
    // v1 path means hybrid search on a v2 DB opened via this entry point still
    // sees vec0. v1 DBs simply won't have chunks_vec — vec0 SQL fails cleanly
    // and the search fallback to lexical fires per design.
    ensure_sqlite_vec_registered();
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

/// V3 schema delta — page-level addressing. Additive and non-destructive:
///   - `chunks.page_start` / `page_end` — 1-indexed PDF page each chunk's
///     text was sourced from. NULL for legacy v2 chunks; freshly-ingested
///     PDFs populate them via `chunk_pages` in `ingest.rs`.
///   - `pages(doc_id, page_no, text)` table — raw per-page text exposed
///     to the LLM via `claudeknows page <doc> <page>` so it can navigate
///     the source book the same way a human flips pages.
///
/// Page numbering is **pdfium 1-indexed** — independent of any "printed"
/// page numbering the document might use (Roman for preface, Arabic for
/// body). Out-of-range page lookups exit 1 with the literal stderr line
/// `error: page number out of range`.
///
/// SQL discipline: static `&str` literal, no user-data interpolation.
const SCHEMA_V3_DELTA: &str = r#"
ALTER TABLE chunks ADD COLUMN page_start INTEGER;
ALTER TABLE chunks ADD COLUMN page_end INTEGER;
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL,
  text TEXT NOT NULL,
  UNIQUE(doc_id, page_no)
);
CREATE INDEX IF NOT EXISTS pages_doc_page_idx ON pages(doc_id, page_no);
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
    let mut conn = Connection::open(db_path)?;
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
        // Fresh DB — apply v2 + v3 deltas and stamp version=3.
        conn.execute_batch(SCHEMA_V2_DELTA)?;
        conn.execute_batch(SCHEMA_V3_DELTA)?;
        conn.execute(
            "INSERT INTO schema_version(version) VALUES (?1)",
            rusqlite::params![3i64],
        )?;
    } else if v == 2 {
        // v2 → v3 progression. Additive + non-destructive: ALTER TABLE adds
        // the page columns, CREATE TABLE IF NOT EXISTS adds the pages table.
        // Existing chunks keep NULL page_start/page_end until backfilled
        // (pages table is empty until `claudeknows reindex-pages` runs).
        // Wrap in a transaction so a partially-failed v2→v3 rolls back.
        let tx = conn.transaction()?;
        tx.execute_batch(SCHEMA_V3_DELTA)?;
        tx.execute(
            "UPDATE schema_version SET version = ?1",
            rusqlite::params![3i64],
        )?;
        tx.commit()?;
    } else if v == 3 {
        // Already at v3 — ensure forward-compat objects exist (CREATE IF NOT
        // EXISTS for both vec0 and pages so a corruption-free re-open is
        // idempotent).
        //
        // Legacy v3 shape (Slice 12 first iteration before merge with main):
        // pages had `page_num` column instead of `page_no`. Detect that shape
        // and rename the column in-place — SQLite 3.25+ supports
        // `ALTER TABLE ... RENAME COLUMN`. The data (doc_id, page_text) is
        // schema-equivalent so the rename is a no-data-loss operation.
        let has_page_num: bool = conn
            .query_row(
                "SELECT 1 FROM pragma_table_info('pages') WHERE name = 'page_num'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if has_page_num {
            conn.execute_batch(
                "ALTER TABLE pages RENAME COLUMN page_num TO page_no; \
                 DROP INDEX IF EXISTS idx_pages_doc;",
            )?;
        }
        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding float[384]); \
             CREATE TABLE IF NOT EXISTS pages ( \
               id INTEGER PRIMARY KEY, \
               doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, \
               page_no INTEGER NOT NULL, \
               text TEXT NOT NULL, \
               UNIQUE(doc_id, page_no) \
             ); \
             CREATE INDEX IF NOT EXISTS pages_doc_page_idx ON pages(doc_id, page_no);",
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

    // schema_version row exists and is in 1..=3 (forward-compat through v3
    // page-level addressing — chunks.page_start/page_end + pages table +
    // documents.total_pages).
    let v: i64 = conn.query_row("SELECT version FROM schema_version", [], |r| r.get(0))?;
    if !(1..=3).contains(&v) {
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
///
/// Each chunk carries optional `page_start`/`page_end` (1-indexed PDF page
/// numbers). For non-PDF sources callers pass `None` for both — these columns
/// were added in schema v2 and stay NULL for markdown/txt where pagination is
/// undefined. For PDFs the chunker emits one chunk per page, so
/// `page_start == page_end == page_no`.
pub fn replace_chunks(
    conn: &Connection,
    doc_id: i64,
    chunks: &[(usize, &str, Option<i64>, Option<i64>)],
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM chunks WHERE doc_id = ?1",
        rusqlite::params![doc_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT INTO chunks(doc_id, ord, text, page_start, page_end) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    for (ord, text, page_start, page_end) in chunks {
        stmt.execute(rusqlite::params![
            doc_id,
            *ord as i64,
            *text,
            *page_start,
            *page_end
        ])?;
    }
    Ok(())
}

/// Replace all per-page text rows for a document. PDFs only — markdown/txt
/// callers MUST NOT invoke this (the chunker for those formats emits chunks
/// without page tracking and the `pages` table stays empty for them).
///
/// The unique `(doc_id, page_no)` constraint declared in `SCHEMA_V2_PAGES_TABLE`
/// prevents accidental dupes when re-ingesting; we DELETE first to keep the
/// "replace = atomic refresh" semantics that `replace_chunks` already follows.
pub fn replace_pages(
    conn: &Connection,
    doc_id: i64,
    pages: &[(i64, &str)],
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM pages WHERE doc_id = ?1",
        rusqlite::params![doc_id],
    )?;
    let mut stmt = conn.prepare(
        "INSERT INTO pages(doc_id, page_no, text) VALUES (?1, ?2, ?3)",
    )?;
    for (page_no, text) in pages {
        stmt.execute(rusqlite::params![doc_id, *page_no, *text])?;
    }
    Ok(())
}

/// Fetch the full extracted text of a single page by `(source_path, page_no)`.
/// Returns `Ok(None)` when no row matches — caller decides whether that means
/// "document not found", "page out of range", or "non-PDF source has no
/// pages" and renders the appropriate user-facing error.
pub fn get_page_by_source(
    conn: &Connection,
    source_path: &str,
    page_no: i64,
) -> Result<Option<PageRecord>, rusqlite::Error> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT d.id, d.source_path, p.page_no, p.text \
         FROM pages p JOIN documents d ON d.id = p.doc_id \
         WHERE d.source_path = ?1 AND p.page_no = ?2",
        rusqlite::params![source_path, page_no],
        |r| {
            Ok(PageRecord {
                doc_id: r.get(0)?,
                source_path: r.get(1)?,
                page_no: r.get(2)?,
                text: r.get(3)?,
            })
        },
    )
    .optional()
}

/// Fetch the full extracted text of a single page by `(doc_id, page_no)`.
pub fn get_page_by_id(
    conn: &Connection,
    doc_id: i64,
    page_no: i64,
) -> Result<Option<PageRecord>, rusqlite::Error> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT d.id, d.source_path, p.page_no, p.text \
         FROM pages p JOIN documents d ON d.id = p.doc_id \
         WHERE d.id = ?1 AND p.page_no = ?2",
        rusqlite::params![doc_id, page_no],
        |r| {
            Ok(PageRecord {
                doc_id: r.get(0)?,
                source_path: r.get(1)?,
                page_no: r.get(2)?,
                text: r.get(3)?,
            })
        },
    )
    .optional()
}

/// Returned by `get_page_by_source` / `get_page_by_id` — the full text of one
/// extracted PDF page plus identifying metadata, JSON-serializable for the
/// `page --json` output shape.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PageRecord {
    pub doc_id: i64,
    pub source_path: String,
    pub page_no: i64,
    pub text: String,
}

/// Look up a document id by source_path. Used by the `page` subcommand to
/// disambiguate "document not found" from "page out of range" so the user
/// sees the more helpful of the two error messages.
pub fn lookup_doc_id(
    conn: &Connection,
    source_path: &str,
) -> Result<Option<i64>, rusqlite::Error> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT id FROM documents WHERE source_path = ?1",
        rusqlite::params![source_path],
        |r| r.get(0),
    )
    .optional()
}

/// Reverse of `lookup_doc_id`: id → source_path. The `page --by-id` path
/// uses this to render the source path in error messages without an extra
/// JOIN inside `get_page_by_id`.
pub fn lookup_document_by_id(
    conn: &Connection,
    id: i64,
) -> Result<Option<String>, rusqlite::Error> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT source_path FROM documents WHERE id = ?1",
        rusqlite::params![id],
        |r| r.get(0),
    )
    .optional()
}

/// Count how many `pages` rows exist for a doc — used to render
/// "page X of Y" errors. Returns 0 for non-PDF docs (they store no pages).
pub fn page_count(conn: &Connection, doc_id: i64) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM pages WHERE doc_id = ?1",
        rusqlite::params![doc_id],
        |r| r.get(0),
    )
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

// ===========================================================================
// Schema v3 — page-range fetch helpers (Slice 12 of vector-retrieval-backend).
// Built on top of the `pages` table populated by `replace_pages` (above) which
// is the canonical insert path; these helpers only READ.
// ===========================================================================

/// One page of raw extracted text from a source document. `page_no` is
/// 1-indexed per the pdfium convention (pages numbered 1..N where N is the
/// PDF's reported page count, independent of any "printed" numbering like
/// Roman numerals for preface).
#[derive(Debug, Clone)]
pub struct PageRow {
    pub page_no: i64,
    pub text: String,
}

/// Resolve a user-facing doc identifier to `(documents.id, source_path,
/// total_pages)`. Accepts either an integer id (parsed as `documents.id`
/// directly) or a basename string matched against `documents.source_path` so
/// the LLM can request pages from a specific book by its printed filename.
/// `total_pages` is derived via `MAX(page_no) FROM pages` since the schema
/// keeps it on the pages table rather than denormalizing onto `documents`.
pub fn resolve_doc_id(
    conn: &Connection,
    identifier: &str,
) -> Result<Option<(i64, String, Option<i64>)>, rusqlite::Error> {
    use rusqlite::OptionalExtension;
    let row: Option<(i64, String)> = if let Ok(id) = identifier.parse::<i64>() {
        conn.query_row(
            "SELECT id, source_path FROM documents WHERE id = ?1",
            rusqlite::params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
    } else {
        conn.query_row(
            "SELECT id, source_path FROM documents \
             WHERE source_path = ?1 OR source_path LIKE ?2 \
             ORDER BY ingested_at DESC LIMIT 1",
            rusqlite::params![identifier, format!("%/{identifier}")],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
    };
    if let Some((doc_id, source_path)) = row {
        let total: Option<i64> = conn
            .query_row(
                "SELECT MAX(page_no) FROM pages WHERE doc_id = ?1",
                rusqlite::params![doc_id],
                |r| r.get::<_, Option<i64>>(0),
            )
            .optional()?
            .flatten();
        Ok(Some((doc_id, source_path, total)))
    } else {
        Ok(None)
    }
}

/// Fetch a page range `[lo..=hi]` (1-indexed, inclusive). Empty result means
/// no page in that range has been populated for the document (either the
/// range is out of bounds OR the document has no `pages` rows yet — caller
/// disambiguates via `resolve_doc_id`'s `total_pages`).
pub fn fetch_page_range(
    conn: &Connection,
    doc_id: i64,
    lo: i64,
    hi: i64,
) -> Result<Vec<PageRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT page_no, text FROM pages \
         WHERE doc_id = ?1 AND page_no BETWEEN ?2 AND ?3 \
         ORDER BY page_no",
    )?;
    let rows = stmt.query_map(rusqlite::params![doc_id, lo, hi], |r| {
        Ok(PageRow {
            page_no: r.get(0)?,
            text: r.get(1)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
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
