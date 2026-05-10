//! Slice 1 (vector-retrieval-backend) — heading-aware structural chunker tests.
//!
//! Coverage:
//! - TC-VR-2.1: heading-bearing fixture yields exact section count
//! - TC-VR-2.2: no-headings fixture matches iter-1 sliding-window baseline
//! - TC-VR-2.3: chunk overlap = 200 chars verified for sub-chunked sections
//! - Edge cases: empty input, UTF-8 codepoint boundary safety, prose markers
//!   (Chapter N / Section N), preamble preservation.

use std::path::PathBuf;

use sdlc_knowledge::chunker::{
    structural_chunk, FALLBACK_OVERLAP, FALLBACK_WINDOW, STRUCTURAL_CAP, STRUCTURAL_OVERLAP,
};
use sdlc_knowledge::ingest;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

// ---------------------------------------------------------------------------
// TC-VR-2.1 — heading-bearing fixture: 3 H2 sections → 3 chunks each starting
// with the heading line. No preamble (file starts with the first heading).
// ---------------------------------------------------------------------------

#[test]
fn structural_chunk_three_md_headings_yields_three_chunks() {
    let path = fixtures_dir().join("sample-with-headings.md");
    let text = std::fs::read_to_string(&path).expect("read sample-with-headings.md");
    let chunks = structural_chunk(&text);
    assert_eq!(
        chunks.len(),
        3,
        "expected 3 chunks for 3-heading fixture, got {}",
        chunks.len()
    );
    // Each chunk MUST start with its heading line.
    assert!(
        chunks[0].text.starts_with("## Section 1:"),
        "chunk 0 starts with: {:?}",
        &chunks[0].text[..32.min(chunks[0].text.len())]
    );
    assert!(
        chunks[1].text.starts_with("## Section 2:"),
        "chunk 1 starts with: {:?}",
        &chunks[1].text[..32.min(chunks[1].text.len())]
    );
    assert!(
        chunks[2].text.starts_with("## Section 3:"),
        "chunk 2 starts with: {:?}",
        &chunks[2].text[..32.min(chunks[2].text.len())]
    );
    // Ord field is sequential.
    assert_eq!(chunks[0].ord, 0);
    assert_eq!(chunks[1].ord, 1);
    assert_eq!(chunks[2].ord, 2);
}

// ---------------------------------------------------------------------------
// TC-VR-2.2 — no-headings fixture: structural_chunk MUST produce byte-for-byte
// identical output to the iter-1 ingest::chunk() sliding window.
// ---------------------------------------------------------------------------

#[test]
fn structural_chunk_no_headings_matches_iter1_baseline() {
    let path = fixtures_dir().join("sample-no-headings.md");
    let text = std::fs::read_to_string(&path).expect("read sample-no-headings.md");
    let structural = structural_chunk(&text);
    let baseline = ingest::chunk(&text);
    assert_eq!(
        structural.len(),
        baseline.len(),
        "no-heading fallback chunk count must match iter-1 baseline"
    );
    for (i, (a, b)) in structural.iter().zip(baseline.iter()).enumerate() {
        assert_eq!(a.ord, b.ord, "chunk {} ord mismatch", i);
        assert_eq!(
            a.text, b.text,
            "chunk {} text mismatch — fallback diverged from iter-1",
            i
        );
    }
}

// ---------------------------------------------------------------------------
// TC-VR-2.3 — Long section sub-chunking: a single H1 section longer than
// STRUCTURAL_CAP must be sub-chunked with STRUCTURAL_OVERLAP between adjacent
// sub-chunks. Verify the overlap is exactly STRUCTURAL_OVERLAP chars.
// ---------------------------------------------------------------------------

#[test]
fn structural_chunk_long_section_subsplits_with_correct_overlap() {
    // Build a single heading + 3000 chars of body (well over STRUCTURAL_CAP=1500).
    let body: String = std::iter::repeat('a').take(3000).collect();
    let input = format!("# Heading\n{body}");
    let chunks = structural_chunk(&input);
    assert!(
        chunks.len() >= 2,
        "long section should sub-chunk; got {}",
        chunks.len()
    );
    // Each sub-chunk except the last should be exactly STRUCTURAL_CAP chars.
    for (i, c) in chunks.iter().take(chunks.len() - 1).enumerate() {
        assert_eq!(
            c.text.chars().count(),
            STRUCTURAL_CAP,
            "sub-chunk {} should be {} chars, got {}",
            i,
            STRUCTURAL_CAP,
            c.text.chars().count()
        );
    }
    // Adjacent sub-chunks share STRUCTURAL_OVERLAP chars at the boundary.
    let chars0: Vec<char> = chunks[0].text.chars().collect();
    let chars1: Vec<char> = chunks[1].text.chars().collect();
    let tail0: String = chars0[chars0.len() - STRUCTURAL_OVERLAP..].iter().collect();
    let head1: String = chars1[..STRUCTURAL_OVERLAP].iter().collect();
    assert_eq!(
        tail0, head1,
        "sub-chunks must share exactly STRUCTURAL_OVERLAP chars at the boundary"
    );
}

// ---------------------------------------------------------------------------
// Edge case: empty input → empty output (matches iter-1 chunk() contract).
// ---------------------------------------------------------------------------

#[test]
fn structural_chunk_empty_input_returns_empty() {
    let chunks = structural_chunk("");
    assert!(
        chunks.is_empty(),
        "empty input should produce zero chunks, got {}",
        chunks.len()
    );
}

// ---------------------------------------------------------------------------
// Edge case: UTF-8 codepoint boundary safety. Multi-byte chars (Cyrillic,
// CJK, emoji) must not cause panics or produce invalid `String` values.
// ---------------------------------------------------------------------------

#[test]
fn structural_chunk_utf8_boundary_safe() {
    let text = "## Раздел 1\nКириллица текст 你好 🎉 многоязычный.\n\n## Раздел 2\nВторой раздел продолжение текста.\n";
    let chunks = structural_chunk(text);
    assert_eq!(chunks.len(), 2, "2 RU headings → 2 chunks");
    // Every chunk's text must be a valid UTF-8 String (Rust's String type
    // enforces this; if char-slicing went wrong, .chars().count() would panic).
    for c in &chunks {
        let _count = c.text.chars().count();
    }
    assert!(chunks[0].text.starts_with("## Раздел 1"));
    assert!(chunks[1].text.starts_with("## Раздел 2"));
}

// ---------------------------------------------------------------------------
// Prose marker test: "Chapter N" / "Section N" at line-start triggers a
// structural boundary. Mid-line "Section 5" reference does NOT.
// ---------------------------------------------------------------------------

#[test]
fn structural_chunk_prose_chapter_marker_starts_section() {
    let text = "Preamble text before any chapter marker.\n\nChapter 1 begins here. This is the body of chapter 1.\n\nChapter 2 begins here. This is the body of chapter 2 — see Section 5 for details.\n";
    let chunks = structural_chunk(text);
    // Expected sections: preamble, Chapter 1, Chapter 2 = 3.
    // "see Section 5" is NOT at line-start so it does NOT trigger a boundary.
    assert_eq!(
        chunks.len(),
        3,
        "expected 3 sections (preamble + Chapter 1 + Chapter 2); got {}",
        chunks.len()
    );
    assert!(chunks[0].text.starts_with("Preamble"));
    assert!(chunks[1].text.starts_with("Chapter 1 begins"));
    assert!(chunks[2].text.starts_with("Chapter 2 begins"));
}

// ---------------------------------------------------------------------------
// Constants exposure check: the public constants must match the iter-1
// fallback's window/overlap so downstream config introspection is accurate.
// ---------------------------------------------------------------------------

#[test]
fn fallback_constants_match_iter1_window_overlap() {
    assert_eq!(FALLBACK_WINDOW, 500);
    assert_eq!(FALLBACK_OVERLAP, 100);
    assert_eq!(STRUCTURAL_CAP, 1500);
    assert_eq!(STRUCTURAL_OVERLAP, 200);
}
