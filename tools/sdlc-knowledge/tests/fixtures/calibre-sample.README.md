# calibre-sample.pdf — Provenance and Integrity

Test fixture for the pdfium-render integration (PRD §12, Slice 1 of the
`pdfium-pdf-extraction` feature).

## Purpose

Reproduces the iter-1 PDF-extraction failure mode: a calibre-converted PDF whose
text is encoded with composite Type0 (CID) fonts. The legacy `pdf-extract`
crate emits empty / garbage strings for this font class, while PDFium handles
it correctly. UC-1, UC-CC-1 and AC-2/AC-4 in the iter-2 PRD §12 depend on this
fixture round-tripping through `Pdfium::load_pdf_from_byte_slice` plus the
per-page `text().all()` accessor.

## Source

- **Original document:** `books/building_machine_learning_powered_applications_going_from_idea_to.pdf`
  (an 11 MB calibre-converted ML reference book; original is `.gitignored` and
  not part of the SDLC core distribution).
- **Calibre version used to produce the original:** calibre 3.x or later
  (Producer metadata embedded in the source PDF — verifiable via
  `pdfinfo books/building_machine_learning_powered_applications_going_from_idea_to.pdf`).
- **Slicing tool:** `pypdf` 6.10.2 (Python 3.9 venv at `/tmp/pdftest-venv`).
- **Pages selected:** zero-indexed `[50, 52)` — body pages well past the prelim
  styling so total fixture size stays under the 200 KB ceiling per architect
  MINOR action item #4. Both pages contain `/F0` and `/F1` fonts of subtype
  `/Type0` — verified by reading the PDF objects after extraction.

## Reproduction command

```bash
/tmp/pdftest-venv/bin/python3 -c "
from pypdf import PdfReader, PdfWriter
src = 'books/building_machine_learning_powered_applications_going_from_idea_to.pdf'
dst = 'tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf'
r = PdfReader(src)
w = PdfWriter()
for i in range(50, 52):
    w.add_page(r.pages[i])
with open(dst, 'wb') as f:
    w.write(f)
"
```

## Integrity

- **Size:** 71 974 bytes (well under the 200 KB / 204 800 byte ceiling per FR-6.3
  and architect MINOR action item #4).
- **sha256:** `1a925c7744fde56fb9fccd44c6869f79cc930265b36c13ac0a169c396d3426bf`

CI and reviewers MUST verify this hash with `shasum -a 256 calibre-sample.pdf`
before trusting the fixture; any drift indicates the fixture was regenerated or
tampered with.

## Why this is a good test

- **PDF version 1.4** with embedded composite CID fonts (Type0 / ToUnicode CMaps)
  — the exact representation calibre emits when converting EPUB / DOCX / HTML
  to PDF, which is the iter-1 failure mode (`pdf-extract` returned empty
  strings for this corpus).
- **Calibre Producer metadata** preserved on the sliced output (calibre's PDF
  serializer chain remains identifiable via `pdfinfo` Producer field).
- **Body-text content** — the two pages contain ordinary English prose suitable
  for BM25 round-trip assertions (sentences about ML model latency and project
  planning), not just whitespace or layout artifacts.

## Iter-2 expectation

Under `pdfium-render = "0.9"` (PRD §12 FR-1.1 / FR-1.2) the round-trip test in
`tests/pdfium_test.rs` extracts a non-trivial character count (≥ 1 000 chars)
from this fixture, with at least one alphabetic word ≥ 5 characters per FR-6.2.
The fixture also drives the `cargo test --test cli_ingest_e2e_test` smoke that
asserts `succeeded: 1` on a fresh project root.

## Pdfium binary requirement (Slice 1 / Slice 3 dependency)

The pdfium-render Rust crate dynamically loads `libpdfium.dylib` (macOS) or
`libpdfium.so` (Linux) at runtime from
`~/.claude/tools/sdlc-knowledge/pdfium/lib/`. Slice 3 of the iter-2 plan adds
the `install_pdfium_binary` step to `install.sh`. Before Slice 3 lands, tests
that exercise `pdf::read` against this fixture are gated with `#[ignore]` and
must be run manually after `bash install.sh --yes`.

## Facts

### Verified facts
- File present at `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` —
  size 71 974 bytes, sha256 verified by `shasum -a 256` invocation in the
  Slice 1 implementation session.
- Fonts on each page are subtype `/Type0` with names `/F0` and `/F1` — verified
  by `pypdf.PdfReader` introspection of the resulting fixture in the Slice 1
  implementation session.
- pypdf version 6.10.2 — verified by `python3 -c "import pypdf; print(pypdf.__version__)"`.

### External contracts
- **`pypdf` 6.10.2** — symbol: `PdfReader`, `PdfWriter.add_page`, `PdfWriter.write` —
  source: `python3 -c "import pypdf; print(pypdf.__version__)"` returned
  `6.10.2` in this session — verified: yes (lib invoked successfully to slice
  the fixture).
- **PDF 1.4 / Type0 (composite CID font with ToUnicode CMap)** — symbol:
  `/Type /Font /Subtype /Type0` — source: PDF 1.4 reference §5.6 (not opened
  in this session) — verified: no — assumption that calibre's emitted Type0
  layout matches the spec; iter-1 `pdf-extract` failures on this exact corpus
  empirically confirm the failure mode the fixture exercises.

### Assumptions
- **Calibre version of the source PDF is 3.x or later.** Risk: if the source
  was produced by an older calibre, the iter-1 reproducer claim is weaker.
  How to verify: `pdfinfo books/building_machine_learning_powered_applications_going_from_idea_to.pdf | grep Producer` — calibre Producer string includes the version.
- **The 200 KB ceiling is sufficient to capture the iter-1 failure mode.**
  Risk: a single-page slice may not exhibit some calibre-specific quirk
  visible only across page boundaries. How to verify: Slice 1's BM25 round-trip
  test asserts at least one word ≥ 5 alphabetic characters and ≥ 1 000 total
  characters extracted, which empirically distinguishes pdfium (works) from
  pdf-extract (returns ~empty).

### Open questions
- (none) — fixture is self-contained and the slicing recipe above is the
  reproducible regeneration path.
