//! Slice 3 (vector-retrieval-backend) — parser bridge dispatch tests.
//!
//! Coverage:
//! - parse() routes .md → MarkdownReader → structural_chunk
//! - parse() routes .txt → PlainTextReader → structural_chunk
//! - parse() routes .pdf → pdfium → structural_chunk
//! - Slice-3 invariant: `images` field always empty (Slice 4 populates it)
//! - Unsupported extension returns IngestError::UnsupportedExt

use std::path::PathBuf;

use sdlc_knowledge::ingest::IngestError;
use sdlc_knowledge::parser::parse;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

#[test]
fn parse_md_with_headings_yields_structural_chunks() {
    let path = fixtures_dir().join("sample-with-headings.md");
    let doc = parse(&path).expect("parse should succeed on sample-with-headings.md");
    // The fixture has 3 H2 headings → 3 structural chunks.
    assert_eq!(doc.chunks.len(), 3, "expected 3 structural chunks");
    assert!(
        doc.chunks[0].text.starts_with("## Section 1"),
        "first chunk should start at section heading"
    );
    assert_eq!(doc.source, path);
    // Slice 3 invariant: images always empty.
    assert!(
        doc.images.is_empty(),
        "Slice 3 contract: images empty until Slice 4"
    );
}

#[test]
fn parse_md_no_headings_yields_fallback_sliding_chunks() {
    let path = fixtures_dir().join("sample-no-headings.md");
    let doc = parse(&path).expect("parse should succeed on sample-no-headings.md");
    // No headings → fallback to 500/100 sliding window. Fixture is ~1500 chars
    // so we expect ≥3 chunks (500 + 400 + 400 = 1300 → at least 3 windows).
    assert!(
        doc.chunks.len() >= 3,
        "no-heading fixture should sub-window; got {}",
        doc.chunks.len()
    );
    assert!(doc.images.is_empty());
}

#[test]
fn parse_txt_dispatches_to_plain_text_reader() {
    let path = fixtures_dir().join("sample.txt");
    let doc = parse(&path).expect("parse should succeed on sample.txt");
    assert!(!doc.chunks.is_empty(), "sample.txt should yield ≥1 chunk");
    assert!(doc.images.is_empty());
}

#[test]
fn parse_pdf_dispatches_to_pdfium_reader() {
    let path = fixtures_dir().join("sample.pdf");
    let result = parse(&path);
    // sample.pdf may produce text or fail with PdfDecode depending on pdfium
    // availability — we just verify the dispatch path runs (structural_chunk
    // is invoked on any non-empty extracted text).
    match result {
        Ok(doc) => {
            // Successful parse: chunks may or may not be empty (depends on PDF
            // text content), but the source should match and images empty.
            assert_eq!(doc.source, path);
            assert!(doc.images.is_empty(), "Slice 3: images empty");
        }
        Err(IngestError::PdfDecode(_, _)) => {
            // Acceptable: pdfium dynamic library may not be installed in CI
            // (the dynamic-link path is a runtime concern, not a Slice 3
            // contract). The parser correctly dispatched to pdf::read.
        }
        Err(e) => panic!("unexpected parse error on sample.pdf: {e}"),
    }
}

#[test]
fn parse_unsupported_extension_returns_error() {
    let path = fixtures_dir().join("README"); // no extension
    let result = parse(&path);
    assert!(
        matches!(result, Err(IngestError::UnsupportedExt(_))),
        "expected UnsupportedExt for no-extension path; got {result:?}"
    );
}
