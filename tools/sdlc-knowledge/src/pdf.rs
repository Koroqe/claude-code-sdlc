//! PDF text extraction with two security boundaries:
//!  1. `std::panic::catch_unwind(AssertUnwindSafe(...))` around `pdf_extract::extract_text`,
//!     mapping any panic to `IngestError::PdfDecode("panic during pdf_extract::extract_text")`
//!     so the per-file error boundary contains it (Phase 1.5 Security MUST #1).
//!  2. A 50 MB byte budget on extracted text — over-budget extracts are rejected
//!     before they hit SQLite (Phase 1.5 Security MUST #2).
//!
//! SQL discipline: this module never builds SQL. (Comment retained for grep audit.)

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};

use crate::ingest::IngestError;

/// Per-PDF byte budget for extracted text. Anything beyond this is dropped as
/// `IngestError::PdfBudgetExceeded` to bound memory and downstream chunk count.
pub const PDF_BUDGET_BYTES: usize = 50 * 1024 * 1024;

/// Extract text from a PDF. Wraps `pdf_extract::extract_text` in a panic boundary
/// and a byte-budget gate.
pub fn read(p: &Path) -> Result<String, IngestError> {
    let p_buf = p.to_path_buf();
    extract_via_closure(p_buf, |p| {
        // pdf_extract::extract_text accepts a path; map its error type to a String
        // so the closure return matches the byte-budget signature.
        pdf_extract::extract_text(p).map_err(|e| e.to_string())
    })
}

/// Test-only entrypoint: drive the panic-containment + byte-budget code path
/// with an arbitrary closure. Used by TC-SEC-2.1 in `tests/ingest_test.rs` to
/// inject a synthetic panic without depending on a panicking PDF fixture.
pub fn extract_via_closure_for_test<F>(p: &Path, f: F) -> Result<String, IngestError>
where
    F: FnOnce() -> String + std::panic::UnwindSafe,
{
    let p_buf = p.to_path_buf();
    extract_via_closure(p_buf, |_| Ok(f()))
}

fn extract_via_closure<F>(p_buf: PathBuf, f: F) -> Result<String, IngestError>
where
    F: FnOnce(&Path) -> Result<String, String>,
{
    let p_for_closure = p_buf.clone();
    let result = catch_unwind(AssertUnwindSafe(|| f(&p_for_closure)));
    match result {
        Ok(Ok(text)) => check_byte_budget(p_buf, text),
        Ok(Err(msg)) => Err(IngestError::PdfDecode(p_buf, msg)),
        Err(_) => Err(IngestError::PdfDecode(
            p_buf,
            "panic during pdf_extract::extract_text".to_string(),
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
/// without going through pdf_extract.
pub fn check_byte_budget_for_test(p: PathBuf, text: String) -> Result<String, IngestError> {
    check_byte_budget(p, text)
}
