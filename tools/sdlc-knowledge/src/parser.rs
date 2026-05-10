//! Parser bridge (Slice 3 of vector-retrieval-backend).
//!
//! Architect OQ-1 resolution: Docling deferred to v2 — Slice 3 collapses to a
//! "PDF→Markdown bridge over pdfium output" plus an image-extraction primitive
//! shape. This module is the canonical entry point that downstream slices
//! (ingest pipeline, encoder, OCR) consume — it routes PDF/MD/TXT inputs
//! through the existing pdfium / text reader and feeds the result into the
//! [`crate::chunker::structural_chunk`] heading-aware chunker.
//!
//! Slice 3 ships the [`ParsedDocument`] shape and the [`parse`] dispatcher
//! with `images: Vec::new()` always-empty. Slice 4 fills in the
//! `ExtractedImage` extraction logic by extending [`crate::pdf`] with an
//! `extract_images` primitive and writing PNG bytes into BLOB chunks. By
//! shipping the shape first, downstream slices (5/6/7) can target the stable
//! `ParsedDocument` interface even before image extraction is wired.
//!
//! SQL discipline: this module never builds SQL.

use std::path::{Path, PathBuf};

use crate::chunker::structural_chunk;
use crate::ingest::{Chunk, IngestError};
use crate::text::{MarkdownReader, PlainTextReader, SourceReader};

/// One extracted figure / diagram from a PDF page. Slice 3 ships the shape;
/// Slice 4 populates `png_bytes` from the pdfium image-object walk.
#[derive(Debug, Clone)]
pub struct ExtractedImage {
    /// Zero-indexed page number where the image was found.
    pub page_idx: usize,
    /// PNG-encoded image bytes. Empty in Slice 3 (always); non-empty in Slice 4.
    pub png_bytes: Vec<u8>,
}

/// A document parsed into structural chunks plus zero-or-more extracted images.
/// This is the canonical handoff shape between the parser and the ingest /
/// encoder / OCR pipelines.
#[derive(Debug, Clone)]
pub struct ParsedDocument {
    /// Source path that produced this parse result.
    pub source: PathBuf,
    /// Heading-aware structural chunks (or sliding-window fallback when no
    /// headings are detected). Always populated from [`structural_chunk`].
    pub chunks: Vec<Chunk>,
    /// Figures extracted from the source. Slice 3 always returns `Vec::new()`;
    /// Slice 4 populates this from the pdfium image-object walk.
    pub images: Vec<ExtractedImage>,
}

/// Dispatch a source path to the right reader, then feed the extracted text
/// through the heading-aware structural chunker. Currently supported:
///   - `.md` / `.markdown` — Markdown reader
///   - `.txt` — plain-text reader
///   - `.pdf` — pdfium-render via `crate::pdf::read`
///
/// Unsupported extensions return `IngestError::UnsupportedExt`.
///
/// In Slice 3 the returned `ParsedDocument.images` is ALWAYS empty; Slice 4
/// extends the PDF branch to populate it via `crate::pdf::extract_images`.
pub fn parse(p: &Path) -> Result<ParsedDocument, IngestError> {
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .ok_or_else(|| IngestError::UnsupportedExt(p.to_path_buf()))?;
    let (text, images) = match ext.as_str() {
        "md" | "markdown" => (MarkdownReader.read(p)?, Vec::new()),
        "txt" => (PlainTextReader.read(p)?, Vec::new()),
        "pdf" => {
            let text = crate::pdf::read(p)?;
            // Slice 4: extract image objects from each PDF page. On extraction
            // failure (corrupt page, pdfium runtime error), fall back to no
            // images so text-only retrieval still works — image extraction is
            // a complementary signal, NOT a precondition for ingest success.
            let images = crate::pdf::extract_images(p)
                .unwrap_or_default()
                .into_iter()
                .map(|(page_idx, png_bytes)| ExtractedImage {
                    page_idx,
                    png_bytes,
                })
                .collect();
            (text, images)
        }
        _ => return Err(IngestError::UnsupportedExt(p.to_path_buf())),
    };
    let chunks = structural_chunk(&text);
    Ok(ParsedDocument {
        source: p.to_path_buf(),
        chunks,
        images,
    })
}
