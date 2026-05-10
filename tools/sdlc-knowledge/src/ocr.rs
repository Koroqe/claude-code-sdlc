//! OCR bridge for image chunks (Slice 6 of vector-retrieval-backend).
//!
//! **Architect OQ-3 resolution**: PaddleOCR PP-OCRv4 (ml variant, ~30 MB
//! det+rec ONNX models) is the canonical OCR backend. Slice 6 ships the
//! API surface and the degraded-mode fallback path — the full PP-OCRv4
//! ONNX inference pipeline is deferred to Slice 6b once the architect
//! finalizes the ONNX-via-`ort` direct-inference shape (model loading,
//! detection bbox post-processing, recognition CTC decoding).
//!
//! Until Slice 6b lands, [`extract_text_from_image`] always returns
//! `OcrError::ModelMissing` — the contract that the ingest pipeline catches
//! and replaces with the literal placeholder text:
//! `[image: figure N from <doc-basename>]`. This guarantees that:
//! - Image chunks are STILL written to the DB with non-empty `text`
//! - The placeholder is embeddable via the e5 encoder (Slice 5)
//! - Search via BM25 / dense / hybrid still surfaces image chunks via the
//!   placeholder text (low recall — exactly the failure mode the benchmark
//!   in Slice 10 will measure)
//!
//! Once Slice 6b ships, [`extract_text_from_image`] returns the OCR'd text
//! and the placeholder fallback only fires on genuinely textless figures.
//!
//! Security note (architect security pre-review for Slice 6): the OCR
//! pipeline processes untrusted PNG bytes. The PNG-bomb DoS gate
//! (`image::load_from_memory` rejection on decoded > 50 MB pixels) lands
//! in Slice 6b alongside the real OCR engine.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum OcrError {
    #[error("OCR model missing — Slice 6b PP-OCRv4 ONNX integration deferred")]
    ModelMissing,
    #[error("OCR engine error: {0}")]
    Engine(String),
}

/// Extract text from a PNG-encoded image. Slice 6 returns
/// `OcrError::ModelMissing` always; Slice 6b will wire the real PaddleOCR
/// PP-OCRv4 inference path.
///
/// Callers (ingest pipeline, integration tests) MUST handle the error by
/// substituting the canonical placeholder text:
/// `[image: figure N from <doc-basename>]`
/// where N is a 1-based figure index within the document and
/// <doc-basename> is the source file's basename. The placeholder is
/// embedded by the e5 encoder so image chunks remain dense-searchable
/// at low recall until Slice 6b restores high-fidelity OCR.
pub fn extract_text_from_image(_png_bytes: &[u8]) -> Result<String, OcrError> {
    Err(OcrError::ModelMissing)
}

/// Compose the canonical placeholder text for an image chunk when OCR is
/// unavailable or returns empty. The exact byte shape is contract per the
/// plan's Slice 6 done-condition — the benchmark in Slice 10 greps for
/// the literal `[image: figure ` prefix to identify placeholder-derived
/// hits in qualitative samples.
pub fn placeholder_text(figure_idx: usize, doc_basename: &str) -> String {
    format!("[image: figure {figure_idx} from {doc_basename}]")
}

/// Compose the chunk text for an image chunk: prefer OCR'd text if
/// non-empty, otherwise fall back to the canonical placeholder. This is
/// the canonical adapter callers use to populate `chunks.text` for
/// `type='image'` rows.
pub fn image_chunk_text(
    png_bytes: &[u8],
    figure_idx: usize,
    doc_basename: &str,
) -> String {
    match extract_text_from_image(png_bytes) {
        Ok(t) if !t.trim().is_empty() => t,
        _ => placeholder_text(figure_idx, doc_basename),
    }
}
