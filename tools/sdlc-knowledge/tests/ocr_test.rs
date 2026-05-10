//! Slice 6 (vector-retrieval-backend) — OCR bridge degraded-mode tests.
//!
//! Coverage:
//! - extract_text_from_image always returns ModelMissing in Slice 6
//!   (Slice 6b will replace this with real PP-OCRv4 ONNX inference)
//! - placeholder_text composes the canonical `[image: figure N from <doc>]`
//!   format that the benchmark identifies in qualitative samples
//! - image_chunk_text uses OCR result when non-empty; falls back to
//!   placeholder otherwise

use sdlc_knowledge::ocr::{
    extract_text_from_image, image_chunk_text, placeholder_text, OcrError,
};

#[test]
fn extract_text_from_image_returns_model_missing_in_slice_6() {
    let png_bytes = b"fake png bytes";
    let result = extract_text_from_image(png_bytes);
    assert!(matches!(result, Err(OcrError::ModelMissing)));
}

#[test]
fn placeholder_text_canonical_format() {
    let p = placeholder_text(1, "Building AI Agents.pdf");
    assert_eq!(p, "[image: figure 1 from Building AI Agents.pdf]");
    // Benchmark identifies placeholders by the literal prefix.
    assert!(p.starts_with("[image: figure "));
    // Figure index is 1-based per the plan's done-condition.
    let p7 = placeholder_text(7, "Хаос инжиниринг.pdf");
    assert_eq!(p7, "[image: figure 7 from Хаос инжиниринг.pdf]");
}

#[test]
fn image_chunk_text_falls_back_to_placeholder_when_ocr_unavailable() {
    let png_bytes = b"any bytes - Slice 6 OCR always errors";
    let text = image_chunk_text(png_bytes, 3, "AI engineering.pdf");
    assert_eq!(text, "[image: figure 3 from AI engineering.pdf]");
    // Text is non-empty so the chunk is searchable via dense / BM25.
    assert!(!text.is_empty());
}
