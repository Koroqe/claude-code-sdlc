//! Heading-aware structural chunker (Slice 1 of vector-retrieval-backend).
//!
//! Iter-1 (currently shipping in v0.3.x) uses a fixed 500-char sliding window
//! with 100-char overlap from `crate::ingest::chunk()`. That window is fast and
//! UTF-8-safe but loses every structural cue the source document carries —
//! heading boundaries, section nesting, and Chapter/Section prose markers
//! never influence the chunk shape.
//!
//! This module adds [`structural_chunk`] which:
//! 1. Detects heading boundaries via Markdown `^#{1,6}\s+` patterns OR
//!    `Chapter N` / `Section N` prose markers at line-start.
//! 2. When zero boundaries detected → falls back BYTE-FOR-BYTE to the iter-1
//!    500/100 sliding window (regression-safe; non-heading inputs produce the
//!    same chunk count as `crate::ingest::chunk()`).
//! 3. Otherwise → splits on heading boundaries; each section becomes one
//!    chunk. Sections exceeding [`STRUCTURAL_CAP`] are sub-chunked with a
//!    sliding window of size [`STRUCTURAL_CAP`] and overlap
//!    [`STRUCTURAL_OVERLAP`] so even a 10K-char chapter produces tractable
//!    BM25 / dense embeddings.
//! 4. Preamble (text before the first detected heading) is preserved as the
//!    first section — critical for PDFs whose copyright / TOC pages precede
//!    Chapter 1.
//!
//! UTF-8 boundary safety is preserved by operating on `Vec<char>` exclusively
//! (Phase 1.5 MUST #5 from the iter-1 architecture). Slicing by char-index
//! never splits a multi-byte codepoint.
//!
//! SQL discipline: this module never builds SQL. (Comment retained for grep audit.)

use crate::ingest::Chunk;

/// Soft cap on chunk size in characters when structural mode is active.
/// Sections at-or-below this size become a single chunk; longer sections are
/// sub-chunked with a sliding window.
pub const STRUCTURAL_CAP: usize = 1500;

/// Sliding-window overlap when a section exceeds [`STRUCTURAL_CAP`].
pub const STRUCTURAL_OVERLAP: usize = 200;

/// Iter-1 baseline window size — used by the no-headings fallback so output
/// is byte-for-byte identical to `crate::ingest::chunk()`.
pub const FALLBACK_WINDOW: usize = 500;

/// Iter-1 baseline overlap.
pub const FALLBACK_OVERLAP: usize = 100;

/// Heading-aware structural chunker. See module docs for the algorithm.
///
/// Operates on `Vec<char>` for UTF-8 boundary safety. Empty input returns
/// an empty `Vec<Chunk>` (matches iter-1 `chunk()` behavior).
pub fn structural_chunk(text: &str) -> Vec<Chunk> {
    let chars: Vec<char> = text.chars().collect();
    if chars.is_empty() {
        return Vec::new();
    }
    let boundaries = detect_heading_boundaries(&chars);
    if boundaries.is_empty() {
        return fallback_sliding(&chars);
    }
    structural_split(&chars, &boundaries)
}

/// Returns char-offsets of heading-start positions within `chars`.
///
/// A position `i` is a heading boundary when:
/// - It is at line-start (`i == 0` OR `chars[i-1] == '\n'`)
/// - AND either:
///   - Markdown ATX heading: 1–6 `#` chars followed by whitespace (not `\n`)
///   - OR prose marker: literal `Chapter ` or `Section ` followed by an ASCII digit
fn detect_heading_boundaries(chars: &[char]) -> Vec<usize> {
    let mut out = Vec::new();
    let n = chars.len();
    let mut i = 0;
    while i < n {
        let at_line_start = i == 0 || chars[i - 1] == '\n';
        if at_line_start && (is_md_heading_at(chars, i) || is_prose_heading_at(chars, i)) {
            out.push(i);
        }
        i += 1;
    }
    out
}

fn is_md_heading_at(chars: &[char], i: usize) -> bool {
    let mut hashes = 0usize;
    let mut j = i;
    while j < chars.len() && chars[j] == '#' && hashes < 6 {
        hashes += 1;
        j += 1;
    }
    if hashes == 0 || j >= chars.len() {
        return false;
    }
    // After the hashes, the next char must be whitespace and NOT a newline.
    chars[j] != '\n' && chars[j].is_whitespace()
}

fn is_prose_heading_at(chars: &[char], i: usize) -> bool {
    // Match "Chapter " or "Section " (case-sensitive ASCII), followed by an
    // ASCII digit. We deliberately avoid case-insensitive matching to prevent
    // false positives like "section: " in body text.
    const PREFIXES: &[&[char]] = &[
        &['C', 'h', 'a', 'p', 't', 'e', 'r', ' '],
        &['S', 'e', 'c', 't', 'i', 'o', 'n', ' '],
    ];
    for prefix in PREFIXES {
        let plen = prefix.len();
        if i + plen >= chars.len() {
            continue;
        }
        if &chars[i..i + plen] == *prefix && chars[i + plen].is_ascii_digit() {
            return true;
        }
    }
    false
}

/// Split `chars` into sections delimited by `boundaries`. Preamble (text
/// before the first boundary) is preserved as section 0 when `boundaries[0] != 0`.
/// Each section either becomes a single chunk (length ≤ [`STRUCTURAL_CAP`])
/// or is sub-chunked with sliding window [`STRUCTURAL_CAP`]/[`STRUCTURAL_OVERLAP`].
fn structural_split(chars: &[char], boundaries: &[usize]) -> Vec<Chunk> {
    let mut effective: Vec<usize> = Vec::with_capacity(boundaries.len() + 1);
    if boundaries.first().copied() != Some(0) {
        effective.push(0);
    }
    effective.extend_from_slice(boundaries);

    let mut out = Vec::new();
    let mut ord = 0usize;
    for w in 0..effective.len() {
        let start = effective[w];
        let end = effective.get(w + 1).copied().unwrap_or(chars.len());
        if start >= end {
            continue;
        }
        let section: &[char] = &chars[start..end];
        if section.len() <= STRUCTURAL_CAP {
            out.push(Chunk { ord, text: section.iter().collect(), page_start: None, page_end: None });
            ord += 1;
        } else {
            let step = STRUCTURAL_CAP - STRUCTURAL_OVERLAP;
            let mut s = 0usize;
            loop {
                let e = (s + STRUCTURAL_CAP).min(section.len());
                out.push(Chunk { ord, text: section[s..e].iter().collect(), page_start: None, page_end: None });
                ord += 1;
                if e == section.len() {
                    break;
                }
                s += step;
            }
        }
    }
    out
}

/// Iter-1 baseline 500/100 sliding window. Output is byte-for-byte identical
/// to `crate::ingest::chunk()` for the same input, by construction.
fn fallback_sliding(chars: &[char]) -> Vec<Chunk> {
    let mut out = Vec::new();
    let step = FALLBACK_WINDOW - FALLBACK_OVERLAP;
    let mut start = 0usize;
    let mut ord = 0usize;
    loop {
        let end = (start + FALLBACK_WINDOW).min(chars.len());
        out.push(Chunk { ord, text: chars[start..end].iter().collect(), page_start: None, page_end: None });
        ord += 1;
        if end == chars.len() {
            break;
        }
        start += step;
    }
    out
}
