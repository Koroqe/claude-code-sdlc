# Plan: Robust PDF Extraction via pdfium-render (iter-2)

## Recommended Resources
1 recommendations total; 0 expensive; 0 hard reversibility; 1 Trivial; 0 Moderate; 0 Sensitive; 0 Forbidden

### MCP
(none)

### Cloud/Compute
(none)

### External API
(none)

### Third-party Service
(none)

### Library/Framework

#### bblanchon/pdfium-binaries (PDFium prebuilt dynamic library)

- **Category:** Library/Framework
- **Why:** PRD §12 FR-1.2 / FR-3.1 / FR-3.2 mandate that `pdfium-render = "0.9"` (the Cargo dependency added per FR-2.1) loads the PDFium engine at runtime from a prebuilt platform-specific shared library (`libpdfium.dylib` on darwin, `libpdfium.so` on linux). The community project `bblanchon/pdfium-binaries` (MIT-licensed) is the canonical source for these prebuilt assets — the four iter-2 platforms map to `pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz` per FR-3.1. UC-1 through UC-7 and UC-CC-1 all depend on the dynamic library being present at `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` at the pinned `chromium/<version>` tag. This is a **runtime** resource (downloaded once per machine by `install.sh`), distinct from the `pdfium-render` Cargo crate dependency itself which is fetched at build time and is not a recommended-resource entry per the user task's expectation note.
- **Install/activate:** `bash install.sh --yes` performs an idempotent per-platform download from `https://github.com/bblanchon/pdfium-binaries/releases/download/<chromium/version>/<asset>.tgz`, extracts the archive to `~/.claude/tools/sdlc-knowledge/pdfium/lib/` honoring tar safety flags `--no-same-owner --no-same-permissions` (per architect MINOR action item #5), and sets up the `pdfium-render` library-path resolver via the explicit-path API `Pdfium::bind_to_library(<absolute-path>)` (per architect STRUCTURAL action item #1 — eliminates `LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` hijack attack surface). Re-running on a host where the library exists at the pinned tag is a no-op per FR-3.7. DO NOT auto-execute install.sh from this agent; the actual download is performed by Slice 3 of the implementation plan after security pre-review per architect verdict.
- **Cost/complexity:** low — one-time per-platform download, ~10–15 MB extracted (NFR-2 budget); idempotent re-runs; graceful degradation per FR-3.5 (markdown / plain-text ingest unaffected if download fails).
- **Reversibility:** easy — `rm -rf ~/.claude/tools/sdlc-knowledge/pdfium/` removes the library; PDF ingest fails per-file with `IngestError::PdfDecode("pdfium dynamic library not found ...")` per FR-5.1, but `delete`, `search`, `list`, `status`, and markdown / plain-text ingest continue working unchanged (NFR-5 fault-isolation guarantee).
- **Tier:** Trivial — analogous to `claude mcp add` per the user task: idempotent download to a sibling directory of the `sdlc-knowledge` binary, machine-local, reversible by deleting the directory; no credential material, no organizational trust boundary, no payment-bearing service. The architect's STRUCTURAL action item #1 (explicit-path binding) is the security-load-bearing constraint that keeps this Trivial — env-var-based resolver lookup would have escalated this to Sensitive due to dynamic-library hijack risk per R-1.

### Hardware
(none)

## Auto-Install Results
Skipped: non-interactive context — auto-install requires user approval

## Additional Roles
0 additional roles total; 0 new prompt files written; 0 core-agent edits

No additional roles required.

## Role invocation plan
(no roles to invoke)

## Reuse Decisions
(no reuse decisions)

## Facts

### Verified facts

- PRD §12 lives at `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` lines 2693–2972 — verified by Read of the section in this session. It defines 9 FR groups (FR-1 through FR-9), 9 NFRs, 9 ACs, 9 risks, and an explicit Out-of-Scope list at §12.7.
- `tools/sdlc-knowledge/Cargo.toml` line 16 currently declares `pdf-extract = "0.7"` and line 3 declares crate version `0.1.0` — verified by Read of the file in this session. These are the exact lines Slice 1 must edit per FR-2.1 and NFR-9.
- `tools/sdlc-knowledge/src/pdf.rs` is 70 lines, uses `pdf_extract::extract_text` at line 26 inside a `catch_unwind(AssertUnwindSafe(...))` boundary at line 46, defines `PDF_BUDGET_BYTES = 50 * 1024 * 1024` at line 17, and exposes `extract_via_closure_for_test` at lines 33-39 — verified by Read of the entire file in this session. Slice 1 rewrites this module while preserving the public `pub fn read(p: &Path) -> Result<String, IngestError>` signature (FR-1.1), the panic boundary (FR-1.6), the 50 MB byte budget (FR-1.5), and the test seam (FR-1.7).
- `tools/sdlc-knowledge/src/store.rs` line 266 ALREADY EXPOSES `pub fn delete_by_id(conn: &Connection, id: i64) -> Result<u64, rusqlite::Error>` — verified by Read of lines 260–290 in this session. Slice 2 does NOT need to add this function; it must change the CLI surface (`cli.rs`, `main.rs`) to add the explicit `--by-id <int>` flag, enforce mutual exclusion with the positional `<source-path>`, and return the FR-4.5 JSON shape `{"deleted_id", "source_path", "chunks_removed"}`.
- `tools/sdlc-knowledge/src/main.rs` lines 235–314 currently auto-parse the positional `<source-id>` argument as `i64` first (line 242 `parse::<i64>()`), then fall back to a string-path branch — verified by Read in this session. This auto-parse behavior is INCOMPATIBLE with FR-4.1's explicit-flag requirement; Slice 2 replaces it with explicit `--by-id` vs `<source-path>` mutual-exclusion handling.
- `tools/sdlc-knowledge/src/cli.rs` `DeleteArgs` (lines 106–114) currently has positional `pub source_id: String` plus `--project-root` and `--json` — verified by Read in this session. Slice 2 changes this to optional positional `<source-path>` + new `--by-id <i64>` flag with clap mutual-exclusion enforcement.
- `tools/sdlc-knowledge/tests/fixtures/` currently contains `corrupt.pdf`, `sample.md`, `sample.pdf`, `sample.txt`, `sql-injection-name`, `utf8-edge.md` — verified by `ls` in this session. Slice 1 ADDS `calibre-sample.pdf` (≤ 200 KB per architect action item #4 fixture-budget bump) and `calibre-sample.README.md` per FR-6.3.
- `tools/sdlc-knowledge/tests/` has 9 test files: `cli_help_test.rs`, `cli_ingest_e2e_test.rs`, `cli_search_e2e_test.rs`, `corrupt_index_test.rs`, `ingest_test.rs`, `path_safety_test.rs`, `search_test.rs`, `store_test.rs` plus the `fixtures/` directory — verified by `ls` in this session. New test files for iter-2: `tests/pdfium_test.rs` (Slice 1 — calibre fixture round-trip + env-var hijack security test); existing `tests/cli_search_e2e_test.rs` is extended for `--by-id` mutual-exclusion in Slice 2.
- `.github/workflows/sdlc-knowledge-release.yml` exists at 162 lines and currently contains NO `pdfium` references — verified by `grep -n pdfium` returning no matches in this session. Slice 4 adds two new steps before/after the existing `cargo build`: a pdfium download step and a calibre-fixture ingest smoke step.
- `install.sh` exists at 530 lines and is executable (mode 0755) — verified by `ls -l` in this session. Slice 3 adds an `install_pdfium_binary` function plus a `KNOWLEDGE_PDFIUM_VERSION` constant near the top.
- `src/rules/knowledge-base-tool.md` and `src/rules/knowledge-base.md` both exist — verified by `ls` of `src/rules/` returning both filenames in this session. Slice 5 edits both per FR-8.1 / FR-8.2.
- `tools/sdlc-knowledge/RELEASING.md` exists at 12136 bytes — verified by `ls -l` in this session. Slice 5 adds a "PDFium binary versioning" section per FR-8.3 plus the architect action item #3 caret-semver / major-bump-fence wording.
- `README.md` exists at 26201 bytes; the Hardening table is at line 143 (`grep -n "Hardening"` this session); the protected taglines are at line 5 ("10 quality gates" — `grep -Fxc` returns ≥1) and line 35 (also "10 quality gates" line) — verified by `grep -n` in this session. Slice 5 adds ONE new row to the Hardening table; lines 5 and 35 are byte-unchanged per FR-8.4 / FR-9.4.
- Use-case file `/Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/pdfium-pdf-extraction_use_cases.md` is 1203 lines covering 51 scenarios (UC-1 through UC-15 plus UC-CC-1 through UC-CC-5 and alternative paths) — verified by `wc -l` in this session.
- QA test-case file `/Users/aleksandra/Documents/claude-code-sdlc/docs/qa/pdfium-pdf-extraction_test_cases.md` is 1515 lines covering 71 test cases — verified by `wc -l` in this session.
- Architect Step 3 verdict: PASS with 5 action items (1 STRUCTURAL: explicit-path `bind_to_library` binding; 1 MAJOR: pre-resolve exact pdfium-render API symbols; 3 MINOR: caret-semver wording, fixture size budget bump, tar safety flags) — supplied by orchestrator at spawn time. Slice 1 inlines STRUCTURAL #1, MAJOR #2, and the architect's recommendation to flag Slice 1 for `architect` + `security-auditor` pre-review. Slice 3 inlines MINOR #5 (tar flags) and is flagged for `security-auditor` pre-review. Slice 5 inlines MINOR #3 and #4 (RELEASING.md wording + fixture size note).
- `.claude/resources-pending.md` and `.claude/roles-pending.md` were both Read in this session and inlined verbatim above; both source files will be deleted post-write per Process step 4c.
- Knowledge-base activation: `<project>/.claude/knowledge/index.db` exists; `sdlc-knowledge status --json` returned `{"schema_version":1,"doc_count":8,"chunk_count":17030}` in this session.

### External contracts

- **`pdfium-render` crate v0.9.x** — symbol: `Pdfium::bind_to_library(<absolute-path>)` (explicit-path API selected per architect STRUCTURAL action item #1; FORBID `Pdfium::bind_to_system_library`); `Pdfium::load_pdf_from_byte_slice` for document open (FR-1.3); `PdfDocument::pages().iter()` for page iteration (FR-1.4); per-page text accessor for `\n`-joined concatenation; license MIT OR Apache-2.0; repo `ajrcarey/pdfium-render` — source: PRD §12 External contracts entry at line 2948 (verified yes via crates.io check during PRD authoring) plus architect Step 3 verdict supplied by orchestrator selecting the explicit-path entrypoint — verified: yes (inherited PRD verification PLUS architect verdict). Risk: the EXACT symbol may be `bind_to_library` vs `bind_to_library_at_path` per architect MAJOR action item #2 — RESOLUTION: Slice 1's `architect` pre-review opens the `pdfium-render = "0.9"` rustdoc for the chosen pin and pins the exact symbol BEFORE Slice 1 implementation begins; Slice 1 done-condition includes a source-grep that the chosen symbol is present and that `bind_to_system_library` is NOT used.
- **`bblanchon/pdfium-binaries` GitHub Releases project** — symbol: assets `pdfium-mac-arm64.tgz`, `pdfium-mac-x64.tgz`, `pdfium-linux-x64.tgz`, `pdfium-linux-arm64.tgz`; tag scheme `chromium/<int>`; license MIT — source: PRD §12 External contracts entry at line 2950 — verified: **no — assumption** (PRD §12 itself records `verified: no — assumption` and assigns Slice 3 to verify the actual GitHub Releases page during implementation). Risk: asset filename or tag scheme could differ from the PRD's recollection. Verification path: Slice 3 (install.sh integration) opens the actual GitHub Releases page during implementation and pins exact asset URLs and tag value before Slice 3's done-condition can pass.
- **PDFium upstream (Google)** — symbol: PDFium engine; license BSD-3 — source: PRD §12 External contracts entry at line 2951 — verified: **no — assumption** (widely-cited industry fact not reverified). Risk: license claim is widely-cited but not reverified this session against PDFium's `LICENSE` file. Verification path: code-reviewer pass at the merge-ready gate confirms the LICENSE statement against an upstream copy.
- **GitHub Actions runner labels** — symbol: `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` — source: PRD §11 FR-11.1 plus iter-2 PRD §12 FR-7.3 line 2802 — verified: yes (inherited from §11 which shipped the existing workflow file). Iter-2 does NOT change the matrix shape per FR-7.3.
- **`tar` (GNU/BSD)** — symbol: flags `-xzf <archive> -C <target> --no-same-owner --no-same-permissions` — source: architect MINOR action item #5 supplied by orchestrator — verified: **no — assumption** for portability across macOS BSD tar vs GNU tar; both flag forms are documented in their respective man pages but not opened in this session. Risk: BSD tar may interpret the long-form flags differently. Verification path: Slice 3 done-condition tests the extraction on macOS-14 and ubuntu-latest matrix runners (the FR-7.1 smoke step covers this implicitly).
- **`sdlc-knowledge` CLI v0.1.0** — symbol: `status --json`, `search "<query>" --top-k 5 --json` — source: live invocation in this session per `~/.claude/rules/knowledge-base-tool.md` mandate — verified: yes. Two domain-bearing searches `"pdfium binding rust"` and `"tar extraction security"` each returned `[]` (zero hits; corpus is ML/AI literature; consistent with the resource-architect's and role-planner's identical zero-hit findings — no PDF-internals or distribution-tooling references in the indexed books).

### Assumptions

- **Plan Critic's `Wave:` field interpretation matches this plan's 1-indexed contiguous integer wave assignment.** Risk: if Plan Critic interprets `Wave: 1` differently from this plan's grouping (Wave 1 = Slice 1 alone; Wave 2 = Slice 2 alone; Wave 3 = Slices 3+4+5 in parallel), the wave-summary table mismatch would surface as MAJOR. How to verify: `## Wave summary` table in this plan explicitly enumerates each slice's wave number and rationale; Plan Critic re-reads them.
- **Slice 2 can completely replace the existing main.rs auto-int-parse logic without breaking iter-1 callers.** Risk: any external script that currently invokes `sdlc-knowledge delete <int-as-positional>` will break under the new explicit-flag contract; iter-2 PRD §12 FR-9.1 calls the surface "BYTE-UNCHANGED except --by-id addition" but the iter-1 auto-parse was an undocumented convenience, not a documented contract. How to verify: Slice 2's `Verify:` block runs `cargo test --test cli_search_e2e_test` which now exercises the FR-4.1 mutual-exclusion error and the FR-4.2 missing-id error; existing test passes confirm no regression on the documented surface.
- **The pdfium-render `bind_to_library` symbol accepts a `&Path` or `impl AsRef<Path>` argument.** Risk: the API may take a `String` or `OsString` instead, requiring a `.display().to_string()` or `.as_os_str()` shim. How to verify: Slice 1's `architect` pre-review opens the rustdoc and pins the exact signature before Slice 1 ships.
- **The architect's verdict text faithfully represents the actual `architect` agent's output.** Risk: if the orchestrator paraphrased or omitted an action item, the inlined STRUCTURAL/MAJOR/MINOR items above would drift from what the architect actually said. How to verify: the architect's full review report is normally captured in scratchpad; this plan's `## Review Notes` section is `n/a` per the user task because the architect already issued PASS, so any drift surfaces as a quality-gate finding rather than a plan-critic finding.

### Open questions

- **Knowledge-base searches `"pdfium binding rust"` and `"tar extraction security"` returned zero hits each.** Per the knowledge-base mandate this is a documented negative result, not a silent skip. Action: no corpus addition is required to ship Step 5 of `/bootstrap-feature` for this feature; the gap is informational. The canonical sources for the iter-2 contracts (`pdfium-render` rustdocs, `bblanchon/pdfium-binaries` GitHub Releases page, `tar` man pages) are documented as `### External contracts` entries above and are slated for verification at Slice 1 / Slice 3 implementation respectively.
- **Open Question #1 — Exact `pdfium-render` library-path symbol (`bind_to_library` vs `bind_to_library_at_path` vs feature-gated alternative).** RESOLUTION: architect Step 3 PASSED the explicit-path approach; Slice 1's `architect` pre-review pins the EXACT symbol name and signature BEFORE Slice 1 implementation begins. Slice 1's `**Changes:**` block records the chosen symbol verbatim once architect confirms.
- **Open Question #2 — Calibre fixture content choice.** Pick a Project Gutenberg public-domain text (e.g., a Sherlock Holmes short story excerpt as suggested by the user task), convert via calibre 3.x or later, target ≤ 200 KB per architect MINOR action item #4, document provenance + sha256 in `tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md` per FR-6.3. Resolved during Slice 1 implementation.

## Prerequisites verified

- **PRD section:** `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` §12 (lines 2693–2972) — Read in this session; 9 FR groups, 9 NFRs, 9 ACs, 9 risks, explicit Out-of-Scope list.
- **Use cases:** `/Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/pdfium-pdf-extraction_use_cases.md` — 1203 lines, 51 scenarios (UC-1..UC-15 + UC-CC-1..UC-CC-5 + alternative paths) per `wc -l` this session.
- **QA test cases:** `/Users/aleksandra/Documents/claude-code-sdlc/docs/qa/pdfium-pdf-extraction_test_cases.md` — 1515 lines, 71 test cases per `wc -l` this session.
- **Architecture review:** PASS verdict supplied by orchestrator at spawn time; 5 action items (1 STRUCTURAL, 1 MAJOR, 3 MINOR) inlined into Slices 1, 3, and 5 below.
- **Resource handoff:** `.claude/resources-pending.md` Read this session; 1 Trivial Library/Framework recommendation (`bblanchon/pdfium-binaries`) inlined verbatim under `## Recommended Resources` plus `## Auto-Install Results` (Skipped: non-interactive context); source file scheduled for deletion post-write.
- **Role handoff:** `.claude/roles-pending.md` Read this session; "No additional roles required." inlined verbatim under `## Additional Roles`; source file scheduled for deletion post-write.

## Slices

#### Slice 1: Cargo.toml dep swap + src/pdf.rs rewrite using pdfium-render explicit-path binding (+ calibre fixture)

- **Wave:** 1
- **UC-coverage:** UC-1 (calibre PDF round-trips correctly), UC-2 (existing PDF re-ingest works under new extractor), UC-3 (panic boundary preserved), UC-CC-1 (CID-font fixture proves pypdf-class extraction quality), UC-CC-2 (50 MB byte budget preserved), UC-CC-4 (env-var hijack mitigation security test).
- **TC-coverage:** TC-AAI-1 (Cargo.toml exact-line edit), TC-AAI-2 (cargo tree -p pdf-extract returns exit 1), TC-AAI-3 (cargo tree -p pdfium-render returns 0.9.x single match), TC-AAI-4 (calibre fixture exists ≤ 200 KB), TC-SEC-2.1 (catch_unwind synthetic panic injection retained), TC-SEC-2.2 (env-var hijack security test — bogus DYLD_LIBRARY_PATH/LD_LIBRARY_PATH does not redirect library load), TC-FR-1.1 through TC-FR-1.7 (pdfium-render integration), TC-FR-2.1 through TC-FR-2.4 (pdf-extract removal), TC-FR-6.1 through TC-FR-6.3 (fixture provenance + chunks/MB ≥ 50).
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/Cargo.toml` (Edit — line 16 `pdf-extract = "0.7"` removed; new line `pdfium-render = "0.9"` added in same `[dependencies]` block; line 3 crate version `0.1.0` → `0.2.0` per NFR-9. NO other dependency lines change.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/pdf.rs` (Edit — full rewrite. Public function signature `pub fn read(p: &Path) -> Result<String, IngestError>` BYTE-UNCHANGED per FR-1.1. Replace `pdf_extract::extract_text` body with `Pdfium::bind_to_library(<absolute-path>)` — absolute path resolved via `std::env::var("HOME").unwrap_or_default() + "/.claude/tools/sdlc-knowledge/pdfium/lib/" + platform_libname()` then `std::fs::canonicalize` to defeat symlink-redirect attacks; `platform_libname()` returns `"libpdfium.dylib"` on `cfg(target_os = "macos")` and `"libpdfium.so"` on `cfg(target_os = "linux")`. Open the document via `Pdfium::load_pdf_from_byte_slice` reading the file via `std::fs::read` per FR-1.3. Empty-password attempt first; on failure surface `IngestError::PdfDecode("password-protected; not supported in iter-2")` and continue per FR-1.3. Iterate pages via `PdfDocument::pages().iter()` per FR-1.4; concatenate page text with single `\n` separator. PRESERVE: `PDF_BUDGET_BYTES = 50 * 1024 * 1024` constant byte-unchanged (FR-1.5); `check_byte_budget` function byte-unchanged (FR-1.5); `extract_via_closure` panic-boundary helper (FR-1.6); `extract_via_closure_for_test` test-only entrypoint with UNCHANGED signature (FR-1.7); `check_byte_budget_for_test` test-only re-export. UPDATE: panic-boundary error message from `"panic during pdf_extract::extract_text"` to `"panic during pdfium-render extraction"`. FORBID: `Pdfium::bind_to_system_library`, any environment-variable-based resolver lookup. All `pdf_extract` strings/comments removed per FR-2.3.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/lib.rs` (no change expected — `pub mod pdf;` already re-exports the module; verify after edit.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` [new] (vendored binary blob; ≤ 200 KB per architect MINOR action item #4; calibre 3.x or later converted from a public-domain text source — Project Gutenberg Sherlock Holmes short story excerpt — to reproduce the iter-1 `/Type0` composite CID font failure mode per PRD §12.1.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/calibre-sample.README.md` [new] (provenance documentation: source text public-domain attribution, calibre version used, sha256 of committed fixture per FR-6.3.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/pdfium_test.rs` [new] (integration tests: (a) calibre fixture round-trip producing ≥ `(file_size_kb / 20)` chunks with at least one chunk containing a non-whitespace alphabetic word ≥ 5 characters per FR-6.2 / AC-2; (b) re-ingest is no-op per AC-3; (c) BM25 search round-trip on a phrase from the fixture returns the fixture as top result with positive score per AC-4; (d) **security test for architect STRUCTURAL action item #1**: set `DYLD_LIBRARY_PATH=/tmp/empty-bogus` and `LD_LIBRARY_PATH=/tmp/empty-bogus` for the test process (or for a `Command::new` subprocess invocation), confirm `pdf::read` still loads pdfium from the canonical `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` path and does NOT pick up an attacker-placed library on the env-var path; (e) graceful-degradation test: with library binary deleted from canonical path, confirm `pdf::read` returns `IngestError::PdfDecode("pdfium dynamic library not found ... install via bash install.sh --yes")` rather than panicking.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/ingest_test.rs` (Edit — existing tests on `sample.pdf`, `corrupt.pdf`, `utf8-edge.md` MUST still pass under the new extractor; if `sample.pdf` chunk count differs (per PRD §12 R-5 expected variance), update assertions to use the floor `≥ 1 chunk` rather than an exact count.)
- **Changes:** Critical pre-implementation step (architect MAJOR action item #2) — Slice 1's `architect` pre-review opens the `pdfium-render = "0.9"` rustdoc and pins the EXACT API symbol name (`Pdfium::bind_to_library` vs `Pdfium::bind_to_library_at_path` vs feature-gated alternative). Once architect confirms, this `**Changes:**` line is updated with the verbatim symbol name. The architect MINOR action item #3 (caret-semver wording) is inlined as: `Cargo.toml` uses `pdfium-render = "0.9"` (caret-semver → allows patch-level float across 0.9.x but fences major bumps to 0.10/1.0); the major-bump procedure is documented in `RELEASING.md` under Slice 5.
- **Verify:**
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo build` → exit 0
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo tree -p pdf-extract` → exit 1, stderr contains `did not match any packages`
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo tree -p pdfium-render` → exit 0, stdout contains `pdfium-render v0.9`
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo test --test pdfium_test` → exit 0; all 5 tests pass (round-trip, re-ingest no-op, BM25 round-trip, env-var hijack security test, graceful-degradation test)
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo test --test ingest_test` → exit 0 (no regression on iter-1 fixtures)
  - `grep -F 'bind_to_system_library' /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/pdf.rs` → exit 1, no matches (FORBID per architect STRUCTURAL action item #1)
  - `grep -F 'pdf_extract' /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/pdf.rs` → exit 1, no matches (FR-2.3)
  - `wc -c /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` → ≤ 204800 (200 KB ceiling per architect MINOR action item #4)
- **Done when:**
  - All 8 verify commands above produce the expected exit codes and stdout/stderr matches.
  - Source-grep confirms `bind_to_system_library` is NOT used (architect STRUCTURAL #1 enforcement).
  - Source-grep confirms NO `pdf_extract` string remains in `src/pdf.rs` (FR-2.3 enforcement).
  - Runtime test in `tests/pdfium_test.rs` sets `DYLD_LIBRARY_PATH=/tmp/empty-bogus` AND `LD_LIBRARY_PATH=/tmp/empty-bogus` and confirms pdfium loads from the canonical `~/.claude/tools/sdlc-knowledge/pdfium/lib/<libname>` path — env-var hijack mitigation verified.
  - `cargo tree -p pdfium-render` shows `0.9.x` per TC-AAI-3; `cargo tree -p pdf-extract` returns exit 1 per TC-AAI-2.
  - This slice's `**Changes:**` block names the EXACT pdfium-render API symbol confirmed by architect pre-review (recorded as `Pdfium::bind_to_library` pending architect confirmation; updated verbatim if architect picks `bind_to_library_at_path`).
  - `calibre-sample.pdf` exists at the new fixtures path with byte size ≤ 200 KB; `calibre-sample.README.md` documents source provenance + calibre version + sha256.
  - `cargo test` overall passes — no regression on the 9 pre-existing iter-1 test files.
- **Pre-review:** **architect** (resolves Open Question #1 — exact pdfium-render API symbol — BEFORE implementation begins; verifies caret-semver pin granularity per architect MINOR #3) **AND security-auditor** (verifies architect STRUCTURAL #1 explicit-path binding mitigates `LD_LIBRARY_PATH`/`DYLD_LIBRARY_PATH` hijack per R-1; confirms `catch_unwind` FFI panic boundary preserved per FR-1.6; reviews the test in `tests/pdfium_test.rs` that codifies the env-var hijack mitigation).

#### Slice 2: Add `delete --by-id <int>` flag with mutual exclusion + FR-4.5 JSON shape

- **Wave:** 2
- **UC-coverage:** UC-8 (delete by integer id), UC-9 (mutual exclusion of `--by-id` and `<source-path>`), UC-10 (non-existent id returns FR-4.2 stderr literal), UC-CC-3 (transactional cascade preserved).
- **TC-coverage:** TC-FR-4.1 (mutual exclusion exit 2 with literal stderr `error: --by-id and <source-path> are mutually exclusive`), TC-FR-4.2 (missing id exit 1 with literal stderr `error: no document with id <int>`), TC-FR-4.3 (--by-id bypasses path canonicalization gate; project-root gate at DB-open is sufficient), TC-FR-4.4 (BEGIN IMMEDIATE transaction wraps documents+chunks+chunks_fts cascade), TC-FR-4.5 (JSON shape `{"deleted_id": <int>, "source_path": "<string>", "chunks_removed": <int>}`).
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/cli.rs` (Edit — `DeleteArgs` struct: change `pub source_id: String` to `pub source_path: Option<String>` (positional, optional); add `#[arg(long)] pub by_id: Option<i64>`; preserve `--project-root` and `--json`. Use clap's `#[command(group = ...)]` or manual XOR check in main.rs to enforce FR-4.1 mutual exclusion.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/main.rs` (Edit — `run_delete` function (current lines 235–314) is rewritten: (1) FIRST check both `args.by_id.is_some() && args.source_path.is_some()` → exit 2 with literal stderr `error: --by-id and <source-path> are mutually exclusive` per FR-4.1; (2) check `args.by_id.is_none() && args.source_path.is_none()` → exit 2 with `error: --by-id or <source-path> required`; (3) IF `--by-id` provided: open DB, call `store::delete_by_id_with_summary` (NEW — see store.rs change below) WITHIN a `BEGIN IMMEDIATE` transaction per FR-4.4, return JSON `{"deleted_id": <int>, "source_path": "<stored-string>", "chunks_removed": <count>}` per FR-4.5; non-existent id → exit 1 with literal stderr `error: no document with id <int>` per FR-4.2 and DOES NOT touch DB (transaction rolls back); (4) IF `<source-path>` provided: existing canonicalize-and-prefix-check + `store::delete_by_source_path` flow byte-unchanged per FR-9.1.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/store.rs` (Edit — existing `delete_by_id` (line 266) returns only `u64` row count; FR-4.5 requires returning the source_path AND chunks-removed count too. ADD new `pub fn delete_by_id_with_summary(conn: &mut Connection, id: i64) -> Result<Option<DeleteByIdSummary>, rusqlite::Error>` returning `None` for missing id and `Some(DeleteByIdSummary { deleted_id, source_path, chunks_removed })` on success. Implementation uses `BEGIN IMMEDIATE` transaction per FR-4.4: SELECT source_path FROM documents WHERE id = ?; SELECT COUNT(*) FROM chunks WHERE document_id = ?; DELETE FROM documents WHERE id = ? (cascade fires); COMMIT. ADD `pub struct DeleteByIdSummary { pub deleted_id: i64, pub source_path: String, pub chunks_removed: u64 }` deriving `Serialize`. Existing `delete_by_id` byte-unchanged (Slice 1 cross-slice flag still calls it elsewhere — confirm via grep before deciding to remove).)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/output.rs` (Edit — add `pub fn render_delete_by_id_json(summary: &store::DeleteByIdSummary) -> String` returning the FR-4.5 JSON shape exactly. Confirms existing `delete <source-path>` JSON shape is left byte-unchanged.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/cli_search_e2e_test.rs` (Edit — extend with: (a) `--by-id <existing>` happy path produces JSON matching `{"deleted_id":N,"source_path":"...","chunks_removed":M}` and exits 0; (b) `--by-id <nonexistent>` exits 1 with literal stderr `error: no document with id 99999` and confirms documents row count unchanged before/after; (c) `--by-id 5 some/path.pdf` exits 2 with literal stderr `error: --by-id and <source-path> are mutually exclusive`; (d) existing positional-path tests still pass byte-unchanged.)
- **Changes:** Note that `tools/sdlc-knowledge/src/store.rs` already has a `delete_by_id` function (verified at line 266 in this session — see `## Facts → ### Verified facts`); Slice 2 adds the new `delete_by_id_with_summary` variant rather than mutating the existing function so the iter-1 cross-slice security flag callers are unaffected. The current `main.rs` int-auto-parse branch at lines 242–256 must be REMOVED (it falsely auto-promoted positional `<source-id>` to int-id; iter-2 requires explicit flag per FR-4.1).
- **Verify:**
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo build` → exit 0
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo test --test cli_search_e2e_test` → exit 0; all new and existing delete tests pass
  - `cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge && cargo test --test store_test` → exit 0 (existing store tests unaffected)
  - Manual smoke: `./target/debug/sdlc-knowledge delete --by-id 5 some/path.pdf 2>&1; echo "exit=$?"` → stderr contains `error: --by-id and <source-path> are mutually exclusive`, exit=2
  - Manual smoke: `./target/debug/sdlc-knowledge delete --by-id 99999 --project-root <tmp-with-fresh-db> 2>&1; echo "exit=$?"` → stderr contains `error: no document with id 99999`, exit=1
- **Done when:**
  - All 5 verify commands above produce expected exits and outputs.
  - `cargo test` overall passes — no regression on existing CLI tests.
  - Stderr literals exactly match the PRD's FR-4.1 and FR-4.2 wording (byte-for-byte grep).
  - JSON output for `--by-id` happy path parses as valid JSON with the three FR-4.5 fields (`deleted_id`, `source_path`, `chunks_removed`) and no extra keys.
  - The `BEGIN IMMEDIATE` transaction wraps the cascade (verified by grep of `BEGIN IMMEDIATE` in store.rs's new function).
- **Pre-review:** **none** (architect explicitly stated Slice 2 doesn't need security pre-review per the user task — DB-open path-canonicalize gate is the load-bearing security boundary and is unchanged; `--by-id` operates on the integer primary key which never originated from a user-controlled file path. FR-4.3 codifies this rationale.)

#### Slice 3: install.sh `install_pdfium_binary` function + tar safety + idempotency

- **Wave:** 3
- **UC-coverage:** UC-4 (install.sh per-platform PDFium download), UC-5 (idempotent re-run no-op), UC-6 (graceful degradation on download failure), UC-CC-5 (SCRIPT_DIR re-invocation pattern from §11 Slice 5 honored).
- **TC-coverage:** TC-FR-3.1 (platform detection via `uname -ms` and four asset mappings), TC-FR-3.2 (post-extract layout `pdfium/lib/libpdfium.{dylib|so}`), TC-FR-3.3 (single literal `KNOWLEDGE_PDFIUM_VERSION` constant near top), TC-FR-3.4 (resolver mechanism: explicit-path binding via Slice 1's `Pdfium::bind_to_library` — install.sh's job is only to place the file; no env-var setup), TC-FR-3.5 (graceful degradation log message verbatim), TC-FR-3.6 (SCRIPT_DIR re-invocation), TC-FR-3.7 (idempotent re-run no-op), TC-AAI-5 (architect MINOR action item #5 — tar flags `--no-same-owner --no-same-permissions -xzf -C`).
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/install.sh` (Edit — (a) add constant `KNOWLEDGE_PDFIUM_VERSION="chromium/<int>"` near the top of the file alongside other version constants per FR-3.3 (exact int pinned during implementation by reading the latest stable `bblanchon/pdfium-binaries` release; iter-2 default tag verified via opening the GitHub Releases page during implementation per `### External contracts` verification path); (b) add `install_pdfium_binary()` function that: (i) detects platform via `uname -ms` (Darwin arm64 / Darwin x86_64 / Linux x86_64 / Linux aarch64) and selects asset name per FR-3.1; (ii) checks idempotency — if `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib|so}` already exists AND a sentinel file `~/.claude/tools/sdlc-knowledge/pdfium/.version` matches `${KNOWLEDGE_PDFIUM_VERSION}`, log `pdfium binary already installed (${KNOWLEDGE_PDFIUM_VERSION}); skipping` and return per FR-3.7; (iii) constructs URL from constants only — no env-var override allowed: `https://github.com/bblanchon/pdfium-binaries/releases/download/${KNOWLEDGE_PDFIUM_VERSION}/<asset>`; (iv) `mkdir -p ~/.claude/tools/sdlc-knowledge/pdfium/`; (v) downloads to a temp file via `curl -fL --proto =https --tlsv1.2`; (vi) `tar -xzf "$tmp" -C "$target_dir" --no-same-owner --no-same-permissions` per architect MINOR action item #5; (vii) `chmod 0755` on the extracted library files; (viii) writes `${KNOWLEDGE_PDFIUM_VERSION}` to the sentinel `.version` file; (ix) on any failure (network, asset 404, tar error) log `pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected` per FR-3.5 verbatim and `return 0` (does NOT abort install per FR-3.5 graceful-degradation contract); (c) honor the SCRIPT_DIR re-invocation pattern from §11 Slice 5 — call `get_source_dir` after any `cd` per FR-3.6; (d) wire `install_pdfium_binary` into the main install flow AFTER the `sdlc-knowledge` binary install, BEFORE the final summary print.)
- **Changes:** Architect MINOR action item #5 (tar safety flags) inlined verbatim as the `tar` invocation. URL constructed from constants only — explicit FORBID of any `${PDFIUM_DOWNLOAD_URL_OVERRIDE}` env var indirection (would defeat the version-pin contract). The architect STRUCTURAL action item #1 (explicit-path binding in pdf.rs) means install.sh's job is ONLY to place the file at the canonical absolute path — no `LD_LIBRARY_PATH` or `DYLD_LIBRARY_PATH` mutation.
- **Verify:**
  - `bash -n /Users/aleksandra/Documents/claude-code-sdlc/install.sh` → exit 0 (syntax check)
  - `shellcheck /Users/aleksandra/Documents/claude-code-sdlc/install.sh` → exit 0 (or only pre-existing warnings; no new shellcheck violations introduced by Slice 3)
  - `grep -nE '^KNOWLEDGE_PDFIUM_VERSION="chromium/[0-9]+"' /Users/aleksandra/Documents/claude-code-sdlc/install.sh` → exit 0, exactly 1 match (single-line edit per FR-3.3)
  - `grep -nF 'tar -xzf' /Users/aleksandra/Documents/claude-code-sdlc/install.sh | grep -F -- '--no-same-owner --no-same-permissions'` → exit 0 (architect MINOR #5 enforced)
  - `grep -cF 'bblanchon/pdfium-binaries' /Users/aleksandra/Documents/claude-code-sdlc/install.sh` → ≥ 1 match
  - `grep -F 'pdfium binary unavailable; PDF ingest will fail until pdfium is installed; markdown/text ingest unaffected' /Users/aleksandra/Documents/claude-code-sdlc/install.sh` → exit 0 (FR-3.5 literal log message)
  - Manual smoke 1 (idempotency): `bash install.sh --yes` then `bash install.sh --yes` → second run logs `pdfium binary already installed (${KNOWLEDGE_PDFIUM_VERSION}); skipping`
  - Manual smoke 2 (graceful degradation): override `KNOWLEDGE_PDFIUM_VERSION=chromium/0` (a tag that does not exist), run `bash install.sh --yes` → install completes with exit 0; warning logged; rest of install (sdlc-knowledge binary, agents) installed normally.
- **Done when:**
  - All 8 verify checks pass.
  - `tar` invocation flags are exactly `--no-same-owner --no-same-permissions -xzf <archive> -C <target>` (architect MINOR action item #5).
  - URL constructed from `KNOWLEDGE_PDFIUM_VERSION` constant only — `grep -F '$PDFIUM_DOWNLOAD_URL' install.sh` returns no matches; no env-var indirection.
  - `chmod 0755` is applied to the extracted `libpdfium.{dylib|so}` file (verified by grep `chmod 0755` near the tar invocation).
  - Idempotency check: `.version` sentinel matches → skip; non-match or absent → re-extract.
  - SCRIPT_DIR re-invocation pattern: `get_source_dir` called after every `cd` in the new function per FR-3.6 (grep verifies).
  - Architect MINOR #5 explicitly enforced — flags appear verbatim in the tar invocation line.
- **Pre-review:** **security-auditor** (URL pinning to constant, tar safety flags `--no-same-owner --no-same-permissions`, defense-in-depth on archive extraction per OWASP tar-slip / zip-slip class, idempotency check guarding double-install corruption, graceful-degradation log message that does NOT leak download URL or paths beyond canonical extraction dir; consistent posture with §11 Slice 5 prior security review).

#### Slice 4: GitHub Actions release workflow — pdfium download + calibre fixture ingest smoke

- **Wave:** 3
- **UC-coverage:** UC-7 (matrix CI verifies per-platform PDFium archive download succeeds), UC-11 (matrix CI runs calibre-fixture ingest smoke on each runner), UC-12 (release-engineer Gate 9 unchanged per FR-7.4).
- **TC-coverage:** TC-FR-7.1 (pdfium download step BEFORE cargo build asserts `libpdfium.{dylib|so}` exists non-zero size at expected path on each matrix runner), TC-FR-7.2 (post-build `sdlc-knowledge ingest tests/fixtures/calibre-sample.pdf` exits 0 with ≥ 1 chunk indexed catching dynamic-load regression), TC-FR-7.3 (matrix labels `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` and `sdlc-knowledge-v*` trigger pattern UNCHANGED), TC-FR-7.4 (Gate 9 release-engineer behavior unchanged).
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` (Edit — (a) ADD step `Download pdfium binary` BEFORE the existing `cargo build --release` step on each matrix job: invokes `bash install.sh --yes` (which now includes `install_pdfium_binary`) OR a smaller scoped invocation that only runs the pdfium download path (preferred to keep workflow fast). The step asserts `[ -s ~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.dylib ] || [ -s ~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.so ]` per FR-7.1. (b) ADD step `Verify calibre fixture extraction` AFTER `cargo build --release` and after the existing binary smoke step: runs `./target/release/sdlc-knowledge ingest tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf --project-root "$RUNNER_TEMP/kbtest"` and asserts exit 0 plus stdout contains `succeeded: 1` per FR-7.2. (c) Matrix labels (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) and trigger pattern (`tags: ['sdlc-knowledge-v*']`) UNCHANGED per FR-7.3. (d) NO change to release-asset upload step — Gate 9 release-engineer behavior unchanged per FR-7.4.)
- **Changes:** Two new steps wrapping the existing `cargo build --release` step. Both new steps must execute on every matrix leg (no platform-specific include/exclude) so the matrix-shape-unchanged invariant from FR-7.3 is preserved.
- **Verify:**
  - `actionlint /Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` → exit 0 (no syntax errors; if `actionlint` not in PATH, fall back to `python -c "import yaml; yaml.safe_load(open('...'))"` for YAML parse validation)
  - `grep -nF 'install_pdfium_binary' /Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml || grep -nF 'bash install.sh' /Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` → exit 0, ≥ 1 match (pdfium download step wired)
  - `grep -nF 'calibre-sample.pdf' /Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` → exit 0, exactly 1 match (calibre fixture smoke step wired)
  - `grep -cE 'macos-14|macos-13|ubuntu-latest|ubuntu-22.04-arm' /Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` → ≥ 4 matches (FR-7.3 matrix labels preserved)
  - `grep -F 'sdlc-knowledge-v' /Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` → exit 0 (trigger tag pattern preserved)
  - Final mechanical verification at merge time: pushing a `sdlc-knowledge-v0.2.0-rc.1` test tag triggers the workflow; all four matrix jobs complete with exit 0 on both new smoke steps. (NOTE: This requires Slices 1+3 to land first since the workflow exercises the calibre fixture from Slice 1 and the install.sh function from Slice 3 — wave-3 disjoint files but logical-data dependency on Wave 1 + Wave 2 outputs.)
- **Done when:**
  - All 5 mechanical verify checks pass.
  - actionlint (or YAML-parse fallback) shows no new errors introduced by the edit.
  - The pdfium download step is positioned BEFORE `cargo build --release` (line ordering grep).
  - The calibre fixture smoke step is positioned AFTER `cargo build --release` and AFTER the existing iter-1 `sdlc-knowledge ingest tests/fixtures/sample.pdf` smoke step (so a Slice 1 regression on iter-1 fixtures fails first).
  - Matrix labels and trigger tag pattern grep-verified unchanged per FR-7.3.
  - No release-asset-upload-step changes — `git diff` of the YAML shows only the two new steps and no edits to upload/sign/release-create steps per FR-7.4.
- **Pre-review:** **none** (CI-only — actionlint catches typos; the security boundary lives in install.sh which is already pre-reviewed by `security-auditor` in Slice 3).

#### Slice 5: Documentation updates (knowledge-base-tool.md + knowledge-base.md + RELEASING.md + README.md)

- **Wave:** 3
- **UC-coverage:** UC-13 (rule docs reflect PDFium capabilities + dependency); UC-14 (RELEASING.md documents PDFium version-bump procedure including caret-semver fence); UC-15 (README Hardening table includes iter-2 row); UC-CC-6 (README taglines at lines 5/35 BYTE-UNCHANGED per FR-9.4).
- **TC-coverage:** TC-FR-8.1 (knowledge-base-tool.md "Known limitations of pdf-extract" section REPLACED with "PDF extraction via PDFium" section), TC-FR-8.2 (knowledge-base.md "Known limitations of pdf-extract" section REPLACED with "PDFium availability" section; CLI invocation contract / citation format / activation sentinel / fallback / application scope BYTE-UNCHANGED), TC-FR-8.3 (RELEASING.md "PDFium binary versioning" section added), TC-FR-8.4 (README.md Hardening table gets ONE new row), TC-FR-9.4 (`grep -Fxc "10 quality gates" README.md` ≥ 1; lines 5 and 35 BYTE-UNCHANGED), TC-AAI-3 (architect MINOR #3 — RELEASING.md contains literal phrase `caret semver` AND `major-version bump procedure`), TC-AAI-4 (architect MINOR #4 — fixture-size note in RELEASING.md states `≤ 200 KB`).
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base-tool.md` (Edit — REPLACE the existing "Known limitations of pdf-extract" section with a "PDF extraction via PDFium" section per FR-8.1: (a) PDFium handles CID fonts (`/Type0`, `/CIDFontType0`, `/CIDFontType2`), `/ToUnicode` CMaps, multi-column layouts, password-protected PDFs (empty-password attempted), and form-field/annotation extraction natively; (b) scanned PDFs without an embedded text layer still need OCR pre-processing — limitation is intrinsic to image-only input, not the extractor; (c) PDFium dynamic library availability is required and `bash install.sh --yes` handles per-platform download via the `install_pdfium_binary` function from Slice 3. ALL OTHER SECTIONS BYTE-UNCHANGED.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base.md` (Edit — REPLACE the existing "Known limitations of pdf-extract" section with a "PDFium availability" section per FR-8.2 noting (a) PDF extraction now uses pdfium-render = "0.9" loading PDFium dynamically; (b) install.sh provides the binary; (c) scanned PDFs still need OCR (intrinsic). The CLI invocation contract, citation format, activation sentinel, fallback behavior, and application scope sections remain BYTE-UNCHANGED per FR-8.2.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/RELEASING.md` (Edit — add new section "PDFium binary versioning" per FR-8.3 documenting (a) the `KNOWLEDGE_PDFIUM_VERSION="chromium/<int>"` tag pinning policy and bump procedure (single-line edit in install.sh per FR-3.3); (b) the `bblanchon/pdfium-binaries` source and license (MIT); (c) **architect MINOR action item #3** — explicit literal phrase `caret semver` (the `pdfium-render = "0.9"` Cargo dep allows patch-level float across `0.9.x` per Cargo's caret-semver default for pre-1.0 minor-pinned crates) AND `major-version bump procedure` documenting how to vet a 0.10/1.0 upgrade — must include both literal phrases verbatim for grep verification; (d) **architect MINOR action item #4** — fixture-size note: `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` MUST be ≤ 200 KB (raised from PRD's 100 KB target per architect stress-test calibration); (e) the build-from-source fallback (PDFium upstream via `gn`/`ninja`) is documented as a known iter-3 path per R-4.)
  - `/Users/aleksandra/Documents/claude-code-sdlc/README.md` (Edit — add ONE new row to the existing Hardening table at line 143 referencing iter-2 robust PDF extraction (e.g., `| Robust PDF extraction | pdfium-render = "0.9" with explicit-path binding; calibre-converted ebooks now index correctly per §12 |`). Lines 5 and 35 (the "10 quality gates" taglines) MUST be BYTE-UNCHANGED per FR-8.4 / FR-9.4 — verified by Read of README.md before/after edit.)
- **Changes:** Architect MINOR action items #3 and #4 inlined as RELEASING.md content. The Edit on README.md is targeted to the Hardening table at line 143 only — Edit tool with line-anchored old_string ensures lines 5 and 35 are not even adjacent to the changed region.
- **Verify:**
  - `grep -F 'pdf-extract' /Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base-tool.md` → exit 1 (no matches; old "Known limitations of pdf-extract" section removed per FR-8.1)
  - `grep -F 'pdf-extract' /Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base.md` → exit 1 (FR-8.2)
  - `grep -F 'PDF extraction via PDFium' /Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base-tool.md` → exit 0
  - `grep -F 'PDFium availability' /Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base.md` → exit 0
  - `grep -F 'PDFium binary versioning' /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/RELEASING.md` → exit 0 (FR-8.3)
  - `grep -F 'caret semver' /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/RELEASING.md` → exit 0 (architect MINOR #3 literal phrase enforced)
  - `grep -F 'major-version bump procedure' /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/RELEASING.md` → exit 0 (architect MINOR #3 literal phrase enforced)
  - `grep -F '≤ 200 KB' /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/RELEASING.md` → exit 0 (architect MINOR #4 fixture-size note enforced; OR `<= 200 KB` per ASCII fallback — accept either)
  - `grep -Fxc '- **10 quality gates** — git hygiene, docs completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy, UI/UX' /Users/aleksandra/Documents/claude-code-sdlc/README.md` → ≥ 1 (line 35 byte-unchanged per FR-9.4)
  - `sed -n '5p;35p' /Users/aleksandra/Documents/claude-code-sdlc/README.md` → output matches the byte-for-byte pre-edit content (FR-8.4 BYTE-UNCHANGED enforcement; protected via Read-before-edit + line-anchored old_string in the Edit tool).
  - `grep -nF '| Robust PDF extraction' /Users/aleksandra/Documents/claude-code-sdlc/README.md` → exit 0, exactly 1 match (new Hardening table row added)
- **Done when:**
  - All 11 verify checks pass.
  - `src/rules/knowledge-base-tool.md` no longer contains "Known limitations of pdf-extract"; instead contains "PDF extraction via PDFium" with the three-bullet content per FR-8.1.
  - `src/rules/knowledge-base.md` no longer contains "Known limitations of pdf-extract"; CLI invocation contract / citation format / activation sentinel / fallback / application scope sections byte-unchanged (verified by `diff` of those sections against pre-edit version, or by Read-and-compare of the section headings + intervening byte counts).
  - `RELEASING.md` contains literal phrases `caret semver` AND `major-version bump procedure` verbatim per architect MINOR #3.
  - `RELEASING.md` mentions fixture size `≤ 200 KB` (or ASCII `<= 200 KB`) per architect MINOR #4.
  - `README.md` Hardening table has ONE new row referencing iter-2 robust PDF extraction; taglines at lines 5 and 35 byte-unchanged.
  - Calibre fixture exists at `tests/fixtures/calibre-sample.pdf` with byte size ≤ 200 KB (cross-checked from Slice 1).
- **Pre-review:** **none** (documentation edits; covered by code-reviewer in the standard quality-gate pass).

## Wave summary

| Wave | Slices | Rationale |
|------|--------|-----------|
| 1    | 1      | Slice 1 alone — Cargo.toml + src/pdf.rs + new fixture + new tests; foundation that Slices 2+ depend on (Slice 2 builds on Cargo.lock state; Slice 4 ingests Slice 1's fixture; Slice 5 documents Slice 1's pdfium choice). |
| 2    | 2      | Slice 2 alone — touches `src/cli.rs`, `src/main.rs`, `src/store.rs`, `src/output.rs`, and `tests/cli_search_e2e_test.rs` which would conflict with Slice 1 if run in parallel. Sequential after Slice 1 to inherit clean Cargo.lock. |
| 3    | 3, 4, 5 | Parallel — Slice 3 touches `install.sh` only; Slice 4 touches `.github/workflows/sdlc-knowledge-release.yml` only; Slice 5 touches `src/rules/*.md` + `tools/sdlc-knowledge/RELEASING.md` + `README.md`. Zero file-path intersection. Logical data dependencies on Slice 1 (fixture) and Slice 3 (install.sh function for Slice 4) are honored at runtime — Slice 4 invokes Slice 3's `install_pdfium_binary` only at workflow runtime, not at file-edit time, so editing the YAML in parallel with editing install.sh is safe. |

File-disjointness verification within Wave 3:
- Slice 3 files: `install.sh` — disjoint.
- Slice 4 files: `.github/workflows/sdlc-knowledge-release.yml` — disjoint.
- Slice 5 files: `src/rules/knowledge-base-tool.md`, `src/rules/knowledge-base.md`, `tools/sdlc-knowledge/RELEASING.md`, `README.md` — disjoint from Slices 3 and 4 and from each other.

## Risk assessment

Condensed from PRD §12.6 (9 risks). Architect MINORs #3, #4, #5 are inlined into Slices 5, 5, 3 respectively per the user task; STRUCTURAL #1 and MAJOR #2 are inlined into Slice 1.

1. **R-1: PDFium dynamic-library hijack via env var or symlink.** Mitigation: architect STRUCTURAL action item #1 (explicit-path binding via `Pdfium::bind_to_library(<absolute-path>)`; FORBID `bind_to_system_library`) inlined into Slice 1; security-auditor pre-reviews Slice 1 + Slice 3; install.sh extraction path constrained to canonical absolute path under `~/.claude/tools/sdlc-knowledge/pdfium/`. Slice 1 includes a runtime test setting bogus `DYLD_LIBRARY_PATH` and `LD_LIBRARY_PATH` and confirming canonical-path binding.
2. **R-2: PDFium binary download URL stability.** Mitigation: pin `chromium/<version>` in install.sh per FR-3.3 (single-line edit constant); sha256 verification DEFERRED to iter-3 per §12.7.
3. **R-3: Cross-platform .dylib/.so naming variance.** Mitigation: Slice 1's `pdf.rs` uses `cfg(target_os)`-gated `platform_libname()`; Slice 3's `install_pdfium_binary` uses `uname -ms` mapping; Slice 4's smoke step asserts both filenames per platform.
4. **R-4: bblanchon/pdfium-binaries release cadence / abandonment.** Mitigation: build-from-source fallback documented in `RELEASING.md` per FR-8.3 (Slice 5).
5. **R-5: Existing chunk-count regression on iter-1 corpus.** Mitigation: NFR-4's chunks/MB ≥ 50 floor catches catastrophic regression; existing `tests/ingest_test.rs` assertions on `sample.pdf` are updated to use floor-based thresholds in Slice 1.
6. **R-6: install.sh SCRIPT_DIR cleanup pattern.** Mitigation: Slice 3 honors the `get_source_dir` re-invocation pattern from §11 Slice 5 per FR-3.6; Slice 3 done-condition includes a regression test running `install.sh --yes` from an arbitrary cwd.
7. **R-7: pdfium-render API stability (pre-1.0 SemVer).** Mitigation: minor-version pin `pdfium-render = "0.9"` (caret-semver allows 0.9.x patch float; fences major bumps); architect MINOR #3 inlined into Slice 5's RELEASING.md as the `caret semver` + `major-version bump procedure` documentation.
8. **R-8: Dynamic loading on hardened CI runners.** Mitigation: Slice 4's calibre fixture ingest smoke step on each matrix runner exercises load-on-CI; failure surfaces as a known signature rather than silent zero-chunk PDFs.
9. **R-9: Calibre-fixture license provenance.** Mitigation: FR-6.3 documented in Slice 1's `tests/fixtures/calibre-sample.README.md` (Project Gutenberg public-domain source per the user task); architect MINOR #4 inlined into Slice 5 RELEASING.md fixture-size note.

## Dependencies

Invariants restated from PRD §12.9 (FR-9):

1. The five `sdlc-knowledge` subcommands (`ingest`, `search`, `list`, `status`, `delete`) plus `--version` BYTE-UNCHANGED in public surface, except the additive `--by-id <int>` flag on `delete` (Slice 2; FR-4.1).
2. The `knowledge-base:` citation literal `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` BYTE-UNCHANGED (no slice touches `output.rs`'s search-citation format; Slice 2's edit to `output.rs` adds a new function for delete-by-id, leaves search citation untouched).
3. The `## Knowledge Base (when present)` activation block in 12 thinking agents BYTE-UNCHANGED (no slice edits agent prompts beyond Slice 5's two `src/rules/*.md` files which are RULE files, not agent files).
4. The 17-agent count and 10-gate count BYTE-UNCHANGED. `ls src/agents/*.md | wc -l` returns 17 (no slice adds agents); `grep -Fxc "10 quality gates"` returns ≥ 1 (Slice 5's README edit explicitly preserves lines 5 and 35).
5. The cognitive-self-check rule file `src/rules/cognitive-self-check.md` BYTE-UNCHANGED (no slice edits this file).
6. The five executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) BYTE-UNCHANGED.
7. The FTS5 + WAL schema and `documents`/`chunks`/`chunks_fts`/`schema_version` tables BYTE-UNCHANGED; the `chunks.embedding BLOB` column reservation for iter-3 hybrid search remains intact (no slice touches `migrations.rs` or schema DDL).

External dependencies introduced or modified:
- `pdfium-render = "0.9"` Cargo dep (Slice 1; replaces `pdf-extract = "0.7"`).
- `bblanchon/pdfium-binaries` GitHub Releases assets pinned at `chromium/<version>` (Slice 3).
- PDFium upstream (Google) — runtime PDF engine loaded dynamically.
- `tar` (GNU/BSD) with portability-safe flags `-xzf -C --no-same-owner --no-same-permissions` per architect MINOR #5 (Slice 3).

## Review Notes

n/a — architect Step 3 PASSED with 5 action items, all 5 inlined into the appropriate slices:
- **STRUCTURAL #1** (explicit-path binding) → Slice 1 `**Files:**`, `**Done when:**`, `**Pre-review:** security-auditor`.
- **MAJOR #2** (resolve pdfium-render API symbol pre-Slice-1) → Slice 1 `**Pre-review:** architect`, `**Changes:**`, `**Done when:**`, `### Open questions` Open Question #1.
- **MINOR #3** (caret-semver / major-bump fence) → Slice 5 RELEASING.md edit; literal phrases `caret semver` and `major-version bump procedure` enforced via `**Verify:**` greps.
- **MINOR #4** (fixture-size budget bump 100 KB → 200 KB) → Slice 1 fixture creation `**Done when:**` ≤ 200 KB; Slice 5 RELEASING.md edit documents the bump.
- **MINOR #5** (tar safety flags `--no-same-owner --no-same-permissions`) → Slice 3 install.sh `install_pdfium_binary` `**Done when:**` enforced via `**Verify:**` grep on the tar invocation line.

No critic-pass invocation needed since architect already issued PASS verdict before this plan was authored.
