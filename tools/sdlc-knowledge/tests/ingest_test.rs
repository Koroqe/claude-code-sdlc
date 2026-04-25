//! Slice 2 unit/integration tests for the chunker, readers, and ingest pipeline.
//!
//! Coverage:
//! - TC-5.1 (chunker golden — sample.md → exactly 8 chunks)
//! - TC-5.3 (chunker UTF-8 boundary safety)
//! - TC-SEC-2.1 (PDF panic containment)
//! - TC-SEC-2.2 (PDF byte-budget reject path)
//! - TC-SEC-2.3 (UTF-8 chunker boundary — emoji at byte offsets near 500/1000)
//!
//! All tests are isolated to `tools/sdlc-knowledge/tests/fixtures/` fixtures.

use std::path::PathBuf;

use sdlc_knowledge::ingest::{check_byte_budget_for_test, chunk};
use sdlc_knowledge::pdf::extract_via_closure_for_test;
use sdlc_knowledge::text::{MarkdownReader, PlainTextReader, SourceReader};

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

// ---------------------------------------------------------------------------
// TC-5.1 — chunker golden: sample.md → exactly 8 chunks under 500/100 window.
// ---------------------------------------------------------------------------

#[test]
fn chunker_golden_sample_md_yields_eight_chunks() {
    let path = fixtures_dir().join("sample.md");
    let reader = MarkdownReader;
    let text = reader.read(&path).expect("read sample.md");

    // sample.md is ASCII so chars().count() == text.len().
    let char_count = text.chars().count();
    assert_eq!(
        char_count, 3000,
        "fixture chunk-count rationale: 3000 chars × 500/100 window = exactly 8 chunks. Got {char_count}."
    );

    let chunks = chunk(&text);
    assert_eq!(
        chunks.len(),
        8,
        "expected exactly 8 chunks for sample.md golden fixture; got {}",
        chunks.len()
    );

    // Every chunk text MUST be valid UTF-8 (it is — String guarantees this — but assert anyway as audit).
    for c in &chunks {
        assert!(std::str::from_utf8(c.text.as_bytes()).is_ok());
    }

    // First chunk text length 500, last chunk shorter (200 chars).
    assert_eq!(chunks[0].text.chars().count(), 500);
    assert_eq!(chunks.last().unwrap().text.chars().count(), 200);

    // ord values are 0..8 contiguous.
    for (i, c) in chunks.iter().enumerate() {
        assert_eq!(c.ord, i, "chunk {} should have ord={}", i, i);
    }
}

// ---------------------------------------------------------------------------
// TC-5.3 / TC-SEC-2.3 — UTF-8 chunker boundary safety.
// ---------------------------------------------------------------------------

#[test]
fn chunker_utf8_boundary_no_panic_and_valid_strings() {
    let path = fixtures_dir().join("utf8-edge.md");
    // PlainTextReader reads UTF-8 bytes verbatim.
    let reader = PlainTextReader;
    let text = reader.read(&path).expect("read utf8-edge.md");

    // The fixture has 4-byte emojis straddling byte offsets 497-500 and 999-1002.
    // Naive `&text[..500]` would panic. Our chunker MUST snap to char boundaries.
    let chunks = chunk(&text);
    assert!(!chunks.is_empty(), "must emit at least one chunk");
    for c in &chunks {
        assert!(
            std::str::from_utf8(c.text.as_bytes()).is_ok(),
            "chunk {} text is not valid UTF-8",
            c.ord
        );
    }
}

// ---------------------------------------------------------------------------
// TC-SEC-2.1 — PDF panic containment.
//
// pdf::extract_via_closure_for_test exposes the catch_unwind wrapper for the
// closure-form pdfium-render entrypoint, allowing us to inject a panicking
// closure and assert that it surfaces as IngestError::PdfDecode("panic ...").
//
// Iter-2 update: closure signature is now `FnOnce(&[u8]) -> Result<String, String>`
// and the panic-category message is "panic during pdfium-render extraction"
// per FR-1.6 / FR-1.7. (The seam still exercises the same catch_unwind boundary.)
// ---------------------------------------------------------------------------

#[test]
fn pdf_panic_is_contained_as_pdf_decode_error() {
    // Use an existing fixture so the closure is reached after `std::fs::read`.
    let path = fixtures_dir().join("sample.pdf");
    let result = extract_via_closure_for_test(&path, |_bytes| -> Result<String, String> {
        panic!("simulated panic from inside pdfium-render");
    });

    let err = result.expect_err("panicking closure must yield Err");
    let msg = format!("{err}");
    assert!(
        msg.contains("panic during pdfium-render extraction"),
        "expected PdfDecode with iter-2 panic-category message; got: {msg}"
    );
}

// ---------------------------------------------------------------------------
// TC-SEC-2.2 — PDF byte budget reject path.
// ---------------------------------------------------------------------------

#[test]
fn pdf_byte_budget_rejects_oversize_extracted_text() {
    let path = std::path::PathBuf::from("/tmp/synthetic-oversize.pdf");
    let huge = "A".repeat(50 * 1024 * 1024 + 1);
    let result = check_byte_budget_for_test(path.clone(), huge);

    let err = result.expect_err("oversize text must be rejected");
    let msg = format!("{err}");
    assert!(
        msg.contains("PDF extracted text exceeds budget")
            || msg.contains("budget")
            || msg.contains("PdfBudgetExceeded"),
        "expected PdfBudgetExceeded variant; got: {msg}"
    );
}

#[test]
fn pdf_byte_budget_accepts_under_limit() {
    let path = std::path::PathBuf::from("/tmp/synthetic-small.pdf");
    let text = "small enough text".to_string();
    let result = check_byte_budget_for_test(path, text.clone());
    assert_eq!(result.expect("ok"), text);
}

// ---------------------------------------------------------------------------
// Sanity: chunker emits at least one chunk for empty-after-strip input.
// ---------------------------------------------------------------------------

#[test]
fn chunker_handles_short_input() {
    let chunks = chunk("hello world");
    assert_eq!(chunks.len(), 1);
    assert_eq!(chunks[0].ord, 0);
    assert_eq!(chunks[0].text, "hello world");
}

#[test]
fn chunker_overlap_is_one_hundred_chars() {
    // Build an exactly 600-char string: chunker should emit 2 chunks
    // (start=0 → 0..500, start=400 → 400..600). The overlap is chars 400..500.
    let text: String = (0..600).map(|i| (b'a' + (i % 26) as u8) as char).collect();
    let chunks = chunk(&text);
    assert_eq!(chunks.len(), 2);
    let c0_tail: String = chunks[0].text.chars().skip(400).collect();
    let c1_head: String = chunks[1].text.chars().take(100).collect();
    assert_eq!(c0_tail, c1_head, "100-char overlap window mismatch");
}
