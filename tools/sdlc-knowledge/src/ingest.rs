//! Ingestion pipeline: chunker, source-reader dispatch, per-document
//! transactional writes, batch directory walker.
//!
//! SQL discipline: ONLY ?N parameterized statements; never format!/+ for user data.
//!
//! Phase 1.5 Security MUSTs implemented here:
//!   #2  Per-document `BEGIN IMMEDIATE` transaction with explicit `tx.commit()`
//!       on success. The `catch_unwind` boundary lives in `crate::pdf` (OUTSIDE
//!       the transaction guard) so a panic during PDF extract triggers
//!       Drop-rollback before any rows are written for that document.
//!   #3  UTF-8 chunker boundary safety: chunker operates on a `Vec<char>` so
//!       indexing is per-codepoint. No raw byte slicing of `&str`.
//!   #4  All SQL is either a static `&str` literal or parameterized via
//!       `rusqlite::params!`. Never `format!`/`write!`/`+`.
//!   #5  Walker uses stdlib `std::fs::read_dir` and explicitly skips entries
//!       whose `file_type()` reports a symlink (`WARN: skipping symlink: ...`).
//!       Recursion depth limited to 32.
//!   #6  Per-file canonicalize + project-root prefix-check: any entry whose
//!       canonical path does not start with the canonical project root is
//!       skipped with `WARN: path escapes project root: ...`.
//!   #7  Idempotency: `(sha256, mtime)` pair drives the `unchanged: <path>`
//!       skip path.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{Connection, TransactionBehavior};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::store;
use crate::text::{MarkdownReader, PlainTextReader, ReaderError, SourceReader};

const CHUNK_WINDOW: usize = 500;
const CHUNK_OVERLAP: usize = 100;
/// Defense-in-depth bound on directory recursion.
const MAX_DEPTH: usize = 32;

#[derive(Debug, Error)]
pub enum IngestError {
    #[error("io error reading {0}: {1}")]
    Io(PathBuf, std::io::Error),
    #[error("reader error: {0}")]
    Reader(#[from] ReaderError),
    #[error("PDF decode error for {0}: {1}")]
    PdfDecode(PathBuf, String),
    #[error("PDF extracted text exceeds budget for {0}: {1} bytes (PdfBudgetExceeded)")]
    PdfBudgetExceeded(PathBuf, usize),
    #[error("unsupported file extension: {0}")]
    UnsupportedExt(PathBuf),
    #[error("database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

#[derive(Debug, Clone)]
pub struct Chunk {
    pub ord: usize,
    pub text: String,
    /// 1-indexed PDF page this chunk's text was sourced from. `None` for
    /// markdown / plain-text where pagination is undefined. PDFs use per-page
    /// chunking so `page_start == page_end`; the field pair is kept open for
    /// future cross-page chunkers.
    pub page_start: Option<i64>,
    pub page_end: Option<i64>,
}

#[derive(Debug, Default)]
pub struct BatchResult {
    pub succeeded: Vec<PathBuf>,
    pub unchanged: Vec<PathBuf>,
    pub failed: Vec<(PathBuf, String)>,
}

/// 500-char sliding window, 100-char overlap.
///
/// Operates on `Vec<char>` so indexing is per-codepoint — Phase 1.5 MUST #5.
/// Page columns are left as `None` — callers that have page provenance
/// (PDF ingest) use `chunk_pages` instead.
pub fn chunk(text: &str) -> Vec<Chunk> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    if chars.is_empty() {
        return out;
    }
    let step = CHUNK_WINDOW - CHUNK_OVERLAP; // 400
    let mut start = 0usize;
    let mut ord = 0usize;
    loop {
        let end = (start + CHUNK_WINDOW).min(chars.len());
        let slice: String = chars[start..end].iter().collect();
        out.push(Chunk {
            ord,
            text: slice,
            page_start: None,
            page_end: None,
        });
        ord += 1;
        if end == chars.len() {
            break;
        }
        start += step;
    }
    out
}

/// Per-page chunker for PDF sources. Each page is chunked independently with
/// the same 500/100 window/overlap as `chunk`, and every emitted `Chunk`
/// carries `page_start = page_end = page_no` (1-indexed). Empty pages
/// contribute zero chunks — common in calibre-converted PDFs that have blank
/// front-matter pages, which we skip silently rather than emit empty rows.
///
/// `ord` is monotonically increasing across the whole document so chunk
/// ordering stays stable for context-window expansion in `search.rs`.
pub fn chunk_pages(pages: &[String]) -> Vec<Chunk> {
    let mut out = Vec::new();
    let mut ord = 0usize;
    for (i, page_text) in pages.iter().enumerate() {
        let page_no = (i + 1) as i64;
        let chars: Vec<char> = page_text.chars().collect();
        if chars.is_empty() {
            continue;
        }
        let step = CHUNK_WINDOW - CHUNK_OVERLAP;
        let mut start = 0usize;
        loop {
            let end = (start + CHUNK_WINDOW).min(chars.len());
            let slice: String = chars[start..end].iter().collect();
            out.push(Chunk {
                ord,
                text: slice,
                page_start: Some(page_no),
                page_end: Some(page_no),
            });
            ord += 1;
            if end == chars.len() {
                break;
            }
            start += step;
        }
    }
    out
}

/// Test-only re-export of the byte-budget probe via `pdf::check_byte_budget`.
pub fn check_byte_budget_for_test(p: PathBuf, text: String) -> Result<String, IngestError> {
    crate::pdf::check_byte_budget_for_test(p, text)
}

fn read_source(p: &Path) -> Result<String, IngestError> {
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase());
    match ext.as_deref() {
        Some("md") | Some("markdown") => MarkdownReader.read(p).map_err(IngestError::from),
        Some("txt") => PlainTextReader.read(p).map_err(IngestError::from),
        Some("pdf") => crate::pdf::read(p),
        _ => Err(IngestError::UnsupportedExt(p.to_path_buf())),
    }
}

fn ext_lower(p: &Path) -> Option<String> {
    p.extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
}

fn supported_ext(p: &Path) -> bool {
    matches!(
        p.extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_ascii_lowercase())
            .as_deref(),
        Some("md") | Some("markdown") | Some("txt") | Some("pdf")
    )
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    let digest = h.finalize();
    let mut s = String::with_capacity(digest.len() * 2);
    for b in digest {
        use std::fmt::Write;
        let _ = write!(s, "{b:02x}");
    }
    s
}

fn file_mtime_secs(p: &Path) -> Result<i64, IngestError> {
    let meta = std::fs::metadata(p).map_err(|e| IngestError::Io(p.to_path_buf(), e))?;
    let mtime = meta
        .modified()
        .map_err(|e| IngestError::Io(p.to_path_buf(), e))?;
    let secs = mtime
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    Ok(secs)
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Outcome of `ingest_path`.
#[derive(Debug)]
pub enum IngestOutcome {
    /// Document was newly written or re-chunked.
    Wrote { chunks: usize },
    /// `(sha256, mtime)` matched a prior row — no-op.
    Unchanged,
}

/// Ingest a single file. Performs:
///  1. read raw bytes, compute sha256
///  2. check `(sha256, mtime)` against documents row → if equal, return Unchanged
///  3. read text via the per-extension SourceReader (catch_unwind boundary lives in pdf.rs)
///  4. chunk
///  5. open `BEGIN IMMEDIATE` transaction, upsert doc row, replace_chunks, commit
pub fn ingest_path(
    _root: &Path,
    p: &Path,
    conn: &mut Connection,
) -> Result<IngestOutcome, IngestError> {
    let bytes = std::fs::read(p).map_err(|e| IngestError::Io(p.to_path_buf(), e))?;
    let sha = sha256_hex(&bytes);
    let mtime = file_mtime_secs(p)?;
    let path_str = p.display().to_string();

    if let Some((prior_mtime, prior_sha)) = store::lookup_document(conn, &path_str)? {
        if prior_mtime == mtime && prior_sha == sha {
            return Ok(IngestOutcome::Unchanged);
        }
    }

    // Read text BEFORE opening the transaction so a panic in pdf_extract is
    // contained outside the tx-guard (Phase 1.5 MUST #2 ordering).
    //
    // PDF dispatch: extract per-page text via `pdf::read_pages` so we can
    // populate the `pages` table AND tag chunks with their page number.
    // Markdown / plain-text dispatch: flat chunking, page columns NULL.
    let ext = ext_lower(p);
    let (chunks, pages_for_table): (Vec<Chunk>, Option<Vec<String>>) =
        if ext.as_deref() == Some("pdf") {
            let pages = crate::pdf::read_pages(p)?;
            let chunks = chunk_pages(&pages);
            (chunks, Some(pages))
        } else {
            let text = read_source(p)?;
            (chunk(&text), None)
        };

    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let doc_id = store::upsert_document(&tx, &path_str, mtime, &sha, now_secs())?;
    let chunk_refs: Vec<(usize, &str, Option<i64>, Option<i64>)> = chunks
        .iter()
        .map(|c| (c.ord, c.text.as_str(), c.page_start, c.page_end))
        .collect();
    store::replace_chunks(&tx, doc_id, &chunk_refs)?;
    if let Some(pages) = &pages_for_table {
        let page_refs: Vec<(i64, &str)> = pages
            .iter()
            .enumerate()
            .map(|(i, t)| ((i + 1) as i64, t.as_str()))
            .collect();
        store::replace_pages(&tx, doc_id, &page_refs)?;
    }
    tx.commit()?;

    // Tech-debt #4: best-effort embedding population for chunks_vec (Slice 5
    // encoder + Slice 2 sqlite-vec virtual table). Runs OUTSIDE the chunks
    // transaction so encoder latency (model load + inference) does NOT hold
    // the write lock. Silent no-op when:
    //   - chunks_vec table is absent (v1 schema)
    //   - encoder model files are missing (degraded mode)
    //   - encoder inference fails (transient error)
    // Orphan vectors from prior re-ingests of the same doc remain in
    // chunks_vec until next vacuum; they don't cause query bugs because the
    // dense_search JOIN with chunks filters non-existent ids out.
    let _ = try_populate_chunks_vec(conn, doc_id, &chunks);

    Ok(IngestOutcome::Wrote {
        chunks: chunks.len(),
    })
}

/// Best-effort embedding write into chunks_vec. Returns Ok on success and
/// Err on any condition that prevents a clean write — no error info leaks
/// to the user since this is a degraded-mode optimization, not a correctness
/// path. Callers ignore the result.
fn try_populate_chunks_vec(
    conn: &mut Connection,
    doc_id: i64,
    chunks: &[Chunk],
) -> Result<(), ()> {
    if chunks.is_empty() {
        return Ok(());
    }
    // Schema gate: chunks_vec only exists on v2 DBs.
    let has_vec: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='chunks_vec'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !has_vec {
        return Err(());
    }

    // Encode all chunks via the e5 singleton. Encoder failure (model missing
    // / runtime error) drops us into degraded mode silently.
    let texts: Vec<&str> = chunks.iter().map(|c| c.text.as_str()).collect();
    let embeddings = match crate::encoder::encode_passages(&texts) {
        Ok(v) => v,
        Err(_) => return Err(()),
    };

    // Fetch the chunk ids assigned by replace_chunks (ord-ordered). The
    // count must match `chunks.len()`; if not, a concurrent writer modified
    // chunks between our commit and this query — bail.
    let ids: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT id FROM chunks WHERE doc_id = ?1 ORDER BY ord")
            .map_err(|_| ())?;
        let rows = stmt
            .query_map(rusqlite::params![doc_id], |r| r.get::<_, i64>(0))
            .map_err(|_| ())?;
        rows.filter_map(Result::ok).collect()
    };
    if ids.len() != embeddings.len() {
        return Err(());
    }

    // Wrap inserts in a small transaction so we don't half-write on a sqlite
    // error mid-batch.
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|_| ())?;
    {
        let mut stmt = tx
            .prepare("INSERT OR REPLACE INTO chunks_vec(rowid, embedding) VALUES (?1, ?2)")
            .map_err(|_| ())?;
        for (id, emb) in ids.iter().zip(embeddings.iter()) {
            let bytes: Vec<u8> = emb.iter().flat_map(|f| f.to_le_bytes()).collect();
            stmt.execute(rusqlite::params![id, bytes]).map_err(|_| ())?;
        }
    }
    tx.commit().map_err(|_| ())?;
    Ok(())
}

/// Walk `target` (file or dir), ingest every supported file. Per-file errors are
/// logged to stderr and added to `BatchResult::failed`; the batch never aborts.
pub fn ingest(
    root: &Path,
    target: &Path,
    conn: &mut Connection,
) -> Result<BatchResult, IngestError> {
    let mut out = BatchResult::default();

    let canonical_root = std::fs::canonicalize(root)
        .map_err(|e| IngestError::Io(root.to_path_buf(), e))?;
    let canonical_target = std::fs::canonicalize(target)
        .map_err(|e| IngestError::Io(target.to_path_buf(), e))?;
    if !canonical_target.starts_with(&canonical_root) {
        eprintln!(
            "WARN: path escapes project root: {}",
            target.display()
        );
        return Ok(out);
    }

    let meta = std::fs::metadata(&canonical_target)
        .map_err(|e| IngestError::Io(canonical_target.clone(), e))?;
    if meta.is_file() {
        ingest_one(&canonical_root, &canonical_target, conn, &mut out);
        return Ok(out);
    }
    if meta.is_dir() {
        walk(&canonical_root, &canonical_target, 0, conn, &mut out);
        return Ok(out);
    }
    eprintln!("WARN: not a file or directory: {}", canonical_target.display());
    Ok(out)
}

fn walk(
    root: &Path,
    dir: &Path,
    depth: usize,
    conn: &mut Connection,
    out: &mut BatchResult,
) {
    if depth >= MAX_DEPTH {
        eprintln!(
            "WARN: max recursion depth ({MAX_DEPTH}) reached at {}",
            dir.display()
        );
        return;
    }
    let iter = match std::fs::read_dir(dir) {
        Ok(it) => it,
        Err(e) => {
            eprintln!("WARN: cannot read directory {}: {e}", dir.display());
            return;
        }
    };
    for entry in iter {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("WARN: bad dir entry under {}: {e}", dir.display());
                continue;
            }
        };
        let entry_path = entry.path();
        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(e) => {
                eprintln!(
                    "WARN: cannot stat dir entry {}: {e}",
                    entry_path.display()
                );
                continue;
            }
        };
        if ft.is_symlink() {
            eprintln!("WARN: skipping symlink: {}", entry_path.display());
            continue;
        }
        if ft.is_dir() {
            walk(root, &entry_path, depth + 1, conn, out);
            continue;
        }
        if !ft.is_file() {
            continue;
        }
        if !supported_ext(&entry_path) {
            continue;
        }

        // Per-file canonicalize + prefix-check (Phase 1.5 MUST #6).
        let canonical = match std::fs::canonicalize(&entry_path) {
            Ok(p) => p,
            Err(e) => {
                eprintln!(
                    "WARN: cannot canonicalize {}: {e}",
                    entry_path.display()
                );
                continue;
            }
        };
        if !canonical.starts_with(root) {
            eprintln!("WARN: path escapes project root: {}", entry_path.display());
            continue;
        }

        ingest_one(root, &canonical, conn, out);
    }
}

fn ingest_one(root: &Path, file: &Path, conn: &mut Connection, out: &mut BatchResult) {
    match ingest_path(root, file, conn) {
        Ok(IngestOutcome::Wrote { chunks: _ }) => out.succeeded.push(file.to_path_buf()),
        Ok(IngestOutcome::Unchanged) => {
            // Note: the per-file `unchanged: <path>` log line is emitted by the
            // CLI summary in main.rs (and the JSON summary in --json mode), so
            // we do not duplicate it here.
            out.unchanged.push(file.to_path_buf());
        }
        Err(e) => {
            let msg = format!("{e}");
            eprintln!("error: {} — {}", file.display(), msg);
            out.failed.push((file.to_path_buf(), msg));
        }
    }
}
