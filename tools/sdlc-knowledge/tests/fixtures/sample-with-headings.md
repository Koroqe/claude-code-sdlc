## Section 1: Introduction

This is the first section of the heading-aware chunker fixture. It covers the rationale for structural chunking over sliding-window chunking. The text is short by design so the structural chunker emits exactly one chunk per section.

## Section 2: Algorithm

This is the second section. It describes how the chunker walks the document char-by-char and identifies heading boundaries at line-start positions. Each heading begins a new chunk; preceding content (preamble) is preserved as section zero when present.

## Section 3: Edge cases

This is the third section. It covers UTF-8 boundary safety, the soft cap for long sections, and the overlap behavior when a section exceeds the cap. The fixture deliberately keeps each section under the 1500-char soft cap so no sub-chunking occurs.
