## Feature: Robust PDF Extraction via pdfium-render (iter-2 of local-knowledge-base)
## Branch: feat/pdfium-pdf-extraction
## Status: implementing wave 1 slice 1/5

## Plan

### Wave 1 (sequential — Rust crate dep + core PDF reader)
- [ ] Slice 1: Cargo.toml dep swap (pdf-extract → pdfium-render = "0.9") + src/pdf.rs rewrite using `Pdfium::bind_to_library(<absolute-path>)` + calibre-sample.pdf fixture (≤200 KB) + new tests/pdfium_test.rs with env-var-hijack mitigation test
  - Files: tools/sdlc-knowledge/{Cargo.toml, src/pdf.rs, src/lib.rs, tests/pdfium_test.rs [new], tests/fixtures/calibre-sample.{pdf, README.md} [new], tests/ingest_test.rs}
  - Pre-review: architect (resolve pdfium-render API symbol pre-implementation per [MAJOR] action item) + security-auditor ([STRUCTURAL] env-var hijack mitigation)
  - Inlines architect action items #1, #2, #3, #4

### Wave 2 (sequential — depends on Wave 1's main.rs/cli.rs/store.rs edits)
- [ ] Slice 2: Add `delete --by-id <int>` subcommand + mutual-exclusion logic with positional path arg + FR-4.5 JSON shape
  - Files: tools/sdlc-knowledge/{src/cli.rs, src/main.rs, src/store.rs, src/output.rs, tests/cli_search_e2e_test.rs}
  - Pre-review: none (architect: DB-open path-canonicalize gate is sufficient security)

### Wave 3 (parallel — disjoint files)
- [ ] Slice 3: install.sh `install_pdfium_binary` function — download from bblanchon/pdfium-binaries, tar `--no-same-owner --no-same-permissions`, idempotency
  - Files: install.sh
  - Pre-review: security-auditor (URL pinning, tar safety, archive extraction, idempotent skip)
  - Inlines architect action item #5
- [ ] Slice 4: GitHub Actions release workflow — pdfium download + post-build calibre fixture ingest smoke test
  - Files: .github/workflows/sdlc-knowledge-release.yml
  - Pre-review: none (CI-only; actionlint catches typos)
- [ ] Slice 5: Documentation updates — knowledge-base-tool.md (replace pdf-extract limitations) + knowledge-base.md (small clarification) + RELEASING.md (caret-semver fence + fixture stress note) + README.md (Hardening row update; lines 5/35 BYTE-UNCHANGED)
  - Files: src/rules/{knowledge-base-tool, knowledge-base}.md, tools/sdlc-knowledge/RELEASING.md, README.md
  - Pre-review: none
  - Inlines architect action items #3, #4

## Bootstrap artifacts produced
- PRD §12 (lines 2693+) — 9 FR groups (45 FRs), 9 NFRs, 9 ACs, 9 risks, 6 out-of-scope items
- `docs/use-cases/pdfium-pdf-extraction_use_cases.md` — 1203 lines, 51 scenarios (16 primary UCs + 5 cross-cutting + variants)
- `docs/qa/pdfium-pdf-extraction_test_cases.md` — 1515 lines, 71 TCs (49 per-UC + 4 cross-cutting + 5 architect-action-item + 9 invariant + 4 cross-platform)
- Architect verdict: PASS, 1 [STRUCTURAL] + 1 MAJOR + 3 MINOR action items inlined into Slices 1, 3, 5; security pre-review on Slices 1 + 3
- `.claude/resources-pending.md` — produced and consumed (1 Trivial Library/Framework: bblanchon/pdfium-binaries; headless auto-install skip); deleted
- `.claude/roles-pending.md` — produced and consumed (No additional roles required); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core opts out)

## Architect [STRUCTURAL] decisions
ONE [STRUCTURAL] item: explicit-path binding `Pdfium::bind_to_library(<absolute-path>)` resolved via `std::env::var("HOME") + canonicalize` → `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}`. FORBIDS `bind_to_system_library` and any env-var resolver fallback. Eliminates R-1 (LD_LIBRARY_PATH/DYLD_LIBRARY_PATH hijack) at API level instead of install.sh discipline. Security test in Slice 1 sets `DYLD_LIBRARY_PATH=/tmp/empty` and confirms canonical-path library still loads.

## Open Questions resolved at architect Step 3
- OQ#1 — pdfium-render API symbols (bind_to_library vs bind_to_library_at_path): RESOLVED — architect Step 3 pre-Slice-1 review will document exact symbol names in plan.md Slice 1 spec (deferred to Slice 1 implementation kickoff).
- OQ#2 — bblanchon/pdfium-binaries asset names: RESOLVED — Slice 3 done-condition opens actual GitHub Releases page for pinned `chromium/<version>` tag; mismatch fails Slice 3.
- OQ#3 — pdfium-render `load_pdf_from_byte_slice` symbol name: RESOLVED — Slice 1 done-condition compiles against real API; mismatch caught at compile time.
- OQ#4 — `mupdf` AGPL rejection: RESOLVED — confirmed from crates.io API call (License: AGPL-3.0); not a fit for our MIT-licensed repo.
- OQ#5 — Calibre fixture size: RESOLVED at architect MINOR — raise budget from 100 KB to 200 KB if Sherlock Holmes excerpt exceeds 100 KB.

## Invariants (load-bearing — preserved from §11)
- 17 core agents — UNCHANGED
- 10 quality gates — UNCHANGED
- 5 executor agents — BYTE-UNCHANGED
- README taglines lines 5 (`17 specialized AI agents`) and 35 (`10 quality gates`) — BYTE-UNCHANGED
- `templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*` — BYTE-UNCHANGED
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED
- `install.sh` line 22 `VERSION="2.1.0"` — UNCHANGED in iter-2
- 12 thinking-agent activation blocks (`## Knowledge Base (when present)`) — BYTE-UNCHANGED (citation contract from §11 preserved)
- CLI surface (5 subcommands) — UNCHANGED; `delete` gains `--by-id` flag (additive, not breaking)
- Citation literal format — UNCHANGED

## Out of scope iter-2
- Subprocess `pdftotext` fallback (deferred — pdfium handles all cases)
- Quality-detection heuristics / fallback chain (no need with pdfium primary)
- Windows binary builds (still iter-3)
- Auto-detecting calibre PDFs by metadata (unnecessary)
- Any change to local-knowledge-base feature contract from §11
- sha256 verification of downloaded pdfium binary (deferred to iter-3)

## Completed
(none — implementation pending)

## Blockers
(none)
