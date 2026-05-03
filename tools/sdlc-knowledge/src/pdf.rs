//! PDF text extraction via the `pdfium-render` Rust binding to the PDFium engine.
//!
//! Iter-2 replacement for the iter-1 `pdf-extract` integration. Architect
//! STRUCTURAL action item #1 mandates the explicit-path entrypoint
//! `Pdfium::bind_to_library(<absolute-canonicalized-path>)` — this eliminates
//! the LD_LIBRARY_PATH / DYLD_LIBRARY_PATH hijack surface that the system-
//! library lookup entrypoint opens. Absolute paths handed to `dlopen` /
//! `LoadLibraryExW` are used verbatim and DO NOT consult the library-search
//! environment variables. The forbidden-symbol grep in `tests/pdfium_test.rs`
//! enforces that the system-lookup and statically-linked binding entrypoints
//! are never referenced anywhere in this file.
//!
//! Security boundaries (preserved from iter-1, plus iter-2 additions):
//!  1. `std::panic::catch_unwind(AssertUnwindSafe(...))` around the C++ FFI
//!     call. Any panic from inside pdfium-render (bug, OOM, malformed PDF
//!     reaching unhandled-edge in upstream PDFium) maps to
//!     `IngestError::PdfDecode("panic during pdfium-render extraction")`
//!     so the per-file boundary contains it (FR-1.6).
//!  2. A 50 MB byte budget on extracted text — over-budget extracts are
//!     rejected before they hit SQLite (FR-1.5).
//!  3. (NEW iter-2) `$HOME` is required, NOT silently coerced to CWD via
//!     `unwrap_or_default()` (security-auditor HIGH remediation #1).
//!  4. (NEW iter-2) The pdfium library directory MUST NOT be world-writable
//!     (security-auditor HIGH remediation #2 — TOCTOU mitigation).
//!  5. (NEW iter-2) After canonicalization, the resolved library path MUST
//!     start with the canonicalized expected directory prefix (security-
//!     auditor MEDIUM remediation #3 — symlink-redirect defense in depth).
//!  6. (NEW iter-2) Canonicalize-failure maps to FR-3.5 literal
//!     "pdfium dynamic library not found ... install via bash install.sh --yes"
//!     (security-auditor MEDIUM remediation #4).
//!
//! SQL discipline: this module never builds SQL. (Comment retained for grep audit.)

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use pdfium_render::prelude::*;

use crate::ingest::IngestError;

/// Process-wide pdfium-render binding cache.
///
/// PDFium has global C++ state — `Pdfium::bind_to_library` MUST be called at
/// most once per process. A second call returns
/// `PdfiumError::PdfiumLibraryBindingsAlreadyInitialized` and the document
/// load that follows fails. Batch ingest of N PDFs without singleton caching
/// would succeed on file 1 and fail on files 2..N with that error.
///
/// The `Mutex<Option<Pdfium>>` shape is `const`-constructible (since Rust
/// 1.63), so this static initializes without a `lazy_static!` macro. The
/// mutex serializes binding initialization and per-call `load_pdf` access —
/// PDFium itself is not safe for concurrent calls, and our CLI is sequential
/// anyway, so holding the mutex across `extract_with_pdfium` is correct.
static PDFIUM: Mutex<Option<Pdfium>> = Mutex::new(None);

/// Per-PDF byte budget for extracted text. Anything beyond this is dropped as
/// `IngestError::PdfBudgetExceeded` to bound memory and downstream chunk count.
pub const PDF_BUDGET_BYTES: usize = 50 * 1024 * 1024;

/// Resolve the absolute, canonicalized directory containing the pdfium dynamic
/// library. Reject:
///  - missing or empty `$HOME` / `%USERPROFILE%` (security-auditor HIGH #1)
///  - world-writable lib directory (security-auditor HIGH #2)
///  - any canonicalization failure (mapped to FR-3.5 literal — security-auditor
///    MEDIUM #4)
///
/// Cross-platform home resolution: Unix sets `HOME`, Windows sets
/// `USERPROFILE` (cmd.exe / PowerShell never sets `HOME` by default). Try
/// `HOME` first (covers Unix and any Windows shell that sets it explicitly),
/// then fall back to `USERPROFILE` (the canonical Windows variable).
fn resolve_pdfium_lib_dir() -> Result<PathBuf, String> {
    // M1: REJECT empty/missing home explicitly. unwrap_or_default would coerce
    // to "" and resolve a CWD-relative path.
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| {
            "HOME (Unix) / USERPROFILE (Windows) env var unset; cannot resolve pdfium library path"
                .to_string()
        })?;
    if home.is_empty() {
        return Err(
            "HOME / USERPROFILE env var empty; cannot resolve pdfium library path".to_string(),
        );
    }

    let expected_dir = PathBuf::from(home).join(".claude/tools/sdlc-knowledge/pdfium/lib");
    if !expected_dir.exists() {
        return Err(format!(
            "pdfium dynamic library not found at {}; install via bash install.sh --yes",
            expected_dir.display()
        ));
    }

    // M2: directory-mode safety check (HIGH) — reject world-writable dirs.
    // Unix-only: world-writable bits (`mode & 0o002`) are POSIX semantics.
    // Windows ACLs differ structurally; the equivalent check is a separate
    // concern (DACL inspection via win32 API) and is deferred to a future
    // platform-specific hardening pass. On Windows the existence + canonical-
    // path checks below remain the load-bearing defense.
    #[cfg(unix)]
    {
        let metadata = std::fs::metadata(&expected_dir)
            .map_err(|e| format!("cannot stat pdfium lib dir {}: {e}", expected_dir.display()))?;
        let mode = metadata.permissions().mode();
        if mode & 0o002 != 0 {
            return Err(format!(
                "pdfium library directory {} is world-writable (mode {:o}); refusing to load",
                expected_dir.display(),
                mode
            ));
        }
    }

    // Canonicalize for symlink-safe comparison.
    let canonical_dir = std::fs::canonicalize(&expected_dir).map_err(|e| {
        format!(
            "pdfium dynamic library not found at {}; install via bash install.sh --yes ({e})",
            expected_dir.display()
        )
    })?;
    Ok(canonical_dir)
}

/// Resolve the absolute, canonicalized path to the pdfium dynamic library file
/// (libpdfium.dylib on macOS, libpdfium.so on Linux). Defends against symlink
/// redirection by canonicalizing the resolved file path and asserting it stays
/// under the canonical lib-dir prefix (security-auditor MEDIUM #3).
fn resolve_pdfium_lib_path() -> Result<PathBuf, String> {
    let dir = resolve_pdfium_lib_dir()?;
    let candidate = Pdfium::pdfium_platform_library_name_at_path(&dir);
    let canonical = std::fs::canonicalize(&candidate).map_err(|e| {
        format!(
            "pdfium dynamic library not found at {}; install via bash install.sh --yes ({e})",
            candidate.display()
        )
    })?;
    // M3: prefix-starts-with check (MEDIUM) — defense in depth.
    if !canonical.starts_with(&dir) {
        return Err(format!(
            "pdfium library path {} escapes canonical install prefix {}",
            canonical.display(),
            dir.display()
        ));
    }
    Ok(canonical)
}

/// Extract text from a PDF using pdfium-render — concatenated form retained
/// for callers that don't need per-page tracking. Wraps the C++ FFI call in a
/// panic boundary and a byte-budget gate.
///
/// Implemented as a thin wrapper over `read_pages` (joins page texts with
/// `\n`) so the byte-budget gate and panic boundary apply identically.
pub fn read(p: &Path) -> Result<String, IngestError> {
    let pages = read_pages(p)?;
    Ok(pages.join("\n"))
}

/// Extract text from a PDF as a `Vec<String>` indexed by zero-based page
/// number (so the 1-indexed page label = `index + 1`). Used by the ingest
/// pipeline to populate per-page citations and the `pages` SQLite table.
///
/// Same panic boundary + byte-budget gate as `read` — the budget is applied
/// to the SUM of page-text byte lengths so a 50 MB single-page extract is
/// rejected exactly like a 50 MB concatenated extract was.
pub fn read_pages(p: &Path) -> Result<Vec<String>, IngestError> {
    extract_pages_via_closure(p, extract_pages_with_pdfium)
}

/// Hot-path extraction body. Initializes pdfium-render singleton on the first
/// call (subsequent calls reuse the cached binding to avoid PDFium's
/// `PdfiumLibraryBindingsAlreadyInitialized` error on batch ingest). Opens the
/// document from the in-memory byte slice and returns per-page text.
fn extract_pages_with_pdfium(bytes: &[u8]) -> Result<Vec<String>, String> {
    let mut guard = PDFIUM
        .lock()
        .map_err(|_| "pdfium singleton mutex poisoned".to_string())?;
    if guard.is_none() {
        let lib_path = resolve_pdfium_lib_path()?;
        let bindings = Pdfium::bind_to_library(&lib_path)
            .map_err(|e| format!("pdfium bind_to_library: {e}"))?;
        *guard = Some(Pdfium::new(bindings));
    }
    let pdfium = guard
        .as_ref()
        .expect("pdfium singleton initialized just above");
    let doc = pdfium
        .load_pdf_from_byte_slice(bytes, None)
        .map_err(|e| format!("pdfium load_pdf: {e}"))?;
    let mut out = Vec::new();
    for (i, page) in doc.pages().iter().enumerate() {
        let text = page
            .text()
            .map_err(|e| format!("page {i} text: {e}"))?
            .all();
        out.push(text);
    }
    Ok(out)
}

/// Test-only entrypoint: drive the panic-containment + byte-budget code path
/// with an arbitrary closure. Used by `tests/pdfium_test.rs` (TC-SEC-2.1) to
/// inject a synthetic panic without depending on a panicking PDF fixture.
///
/// FR-1.7: signature is iter-2-revised (closure receives `&[u8]` matching the
/// real extraction body). The iter-1 signature was `FnOnce() -> String`; this
/// is a Slice 1 deliverable change.
#[doc(hidden)]
pub fn extract_via_closure_for_test<F>(p: &Path, f: F) -> Result<String, IngestError>
where
    F: FnOnce(&[u8]) -> Result<String, String> + std::panic::UnwindSafe,
{
    extract_via_closure(p, f)
}

fn extract_via_closure<F>(p: &Path, f: F) -> Result<String, IngestError>
where
    F: FnOnce(&[u8]) -> Result<String, String> + std::panic::UnwindSafe,
{
    let bytes = std::fs::read(p)
        .map_err(|e| IngestError::PdfDecode(p.to_path_buf(), format!("read: {e}")))?;
    let p_buf = p.to_path_buf();
    let result = catch_unwind(AssertUnwindSafe(|| f(&bytes)));
    match result {
        Ok(Ok(text)) => check_byte_budget(p_buf, text),
        Ok(Err(msg)) => Err(IngestError::PdfDecode(p_buf, msg)),
        Err(_) => Err(IngestError::PdfDecode(
            p_buf,
            "panic during pdfium-render extraction".to_string(),
        )),
    }
}

/// Per-page variant of `extract_via_closure`. Same panic boundary; the byte
/// budget is applied to the SUM of per-page lengths so a multi-page extract
/// over 50 MB is rejected even if no individual page is.
fn extract_pages_via_closure<F>(p: &Path, f: F) -> Result<Vec<String>, IngestError>
where
    F: FnOnce(&[u8]) -> Result<Vec<String>, String> + std::panic::UnwindSafe,
{
    let bytes = std::fs::read(p)
        .map_err(|e| IngestError::PdfDecode(p.to_path_buf(), format!("read: {e}")))?;
    let p_buf = p.to_path_buf();
    let result = catch_unwind(AssertUnwindSafe(|| f(&bytes)));
    match result {
        Ok(Ok(pages)) => {
            let total: usize = pages.iter().map(|s| s.len()).sum();
            if total > PDF_BUDGET_BYTES {
                Err(IngestError::PdfBudgetExceeded(p_buf, total))
            } else {
                Ok(pages)
            }
        }
        Ok(Err(msg)) => Err(IngestError::PdfDecode(p_buf, msg)),
        Err(_) => Err(IngestError::PdfDecode(
            p_buf,
            "panic during pdfium-render extraction".to_string(),
        )),
    }
}

fn check_byte_budget(p: PathBuf, text: String) -> Result<String, IngestError> {
    if text.len() > PDF_BUDGET_BYTES {
        Err(IngestError::PdfBudgetExceeded(p, text.len()))
    } else {
        Ok(text)
    }
}

/// Test-only re-export of the byte-budget probe so unit tests can exercise it
/// without invoking pdfium-render.
pub fn check_byte_budget_for_test(p: PathBuf, text: String) -> Result<String, IngestError> {
    check_byte_budget(p, text)
}
