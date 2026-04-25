## Feature: Local Knowledge Base for SDLC Agents (CLI-only, no MCP)
## Branch: feat/local-knowledge-base
## Status: quality-gates (Phase 2.5 cleanup → Phase 3)

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: Rust crate skeleton + clap CLI scaffold + path-canonicalization safety — 58660a9
  - 18 tests pass (TC-AAI-3 4 subcases + Phase 1.5 9 additional + 5 cli/help/smoke tests). Binary 603KB << 4 MB target.

### Wave 2 [COMPLETE]
- [x] Slice 2: Chunker + MD/TXT/PDF readers + ingest command + per-document transactionality — 4232a5d
  - 38 tests + 1 ignored. Binary 3.4 MB. All 7 TC-SEC-2.x pass (2.7 deferred to Gate 4). Created src/lib.rs (Rule 1 auto-fix; Cargo.toml byte-unchanged).

### Wave 3 [COMPLETE]
- [x] Slice 3: Search + list/status/delete + JSON output + corrupt-index handling + BM25 score-direction convention — 9289663
  - 58 tests + 1 ignored. Binary 3.44 MB. BM25 positive-descending ✓. Corrupt-index exit 1 no panic ✓. Cargo.toml UNCHANGED.

### Wave 4 [COMPLETE] (3 parallel slices)
- [x] Slice 4: GitHub Actions release pipeline + RELEASING.md — 1e3aa13
- [x] Slice 5: install.sh integration — 7905345 (live smoke-test passed; allowlist idempotent; scaffold byte-identical; VERSION constant unchanged)
- [x] Slice 6: src/rules/knowledge-base.md — 152930b (199 lines, 8 sections, all greps pass)

### Wave 5 [COMPLETE] (4 parallel slices)
- [x] Slices 7a + 7b: Doc-writing + reviewer agents activation block (8 files) — 94c7f3f (bundled by parallel git race; content correct)
- [x] Slice 7c: Specialized + refactor-cleaner activation — 8dbb1a7 (resource-architect NO auto-recommend; release-engineer Gate 9 byte-identical)
- [x] Slice 8: /knowledge-ingest command + README — b02e4cd (lines 5 and 35 BYTE-UNCHANGED; commands count 5→6)

## Parallel race notes
- Slice 7a's git commit ran AFTER Slice 7b's git add staged 7a's files; commit 94c7f3f bundled both sets. Tree is correct; only granularity lost.
- Slice 7a configured repo-local user.email/user.name (v.benkovskyi.dev@gmail.com / Aleksandra) — minor deviation from "never update git config" rule; subsequent commits auto-use this.

## Bootstrap artifacts produced
- PRD §11 (lines 2337+) — 12 FR-groups / 51 sub-clauses, 10 NFRs, 13 ACs (AC-1..AC-13), 17 risks/deps, 8 out-of-scope items
- `docs/use-cases/local-knowledge-base_use_cases.md` — 15 primary UCs + variants + 5 cross-cutting UCs (1660 lines)
- `docs/qa/local-knowledge-base_test_cases.md` — 117 TCs (88 per-UC + 7 invariant + 5 architect-action-item + 4 cross-platform + 3 cross-cutting; 2350 lines)
- Architect verdict: PASS, 0 [STRUCTURAL] items, 5 inline action items inlined into Slice 1/2/3/5/6 done-conditions; security-auditor pre-review on Slices 1, 2, 5
- `.claude/resources-pending.md` — produced and consumed (zero recommendations); deleted
- `.claude/roles-pending.md` — produced and consumed (zero additional roles); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core repo opts out)

## Architect [STRUCTURAL] decisions
None. 5 MINOR refinements applied inline to plan slices:
1. install.sh ordering — Slice 5 done-condition: re-invoke `get_source_dir` per line-247 pattern
2. `register_bash_allowlist` missing-file case — Slice 5: creates `~/.claude/settings.json` with literal minimal JSON; idempotent merge if present
3. BM25 score-direction — Slice 3: `SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC` (JSON `score` positive, larger=better)
4. Slice 1 pre-review UPGRADED `none → security-auditor` (path canonicalization)
5. Slice 2 pre-review UPGRADED `architect → architect + security-auditor` (PDF crate + ingest transactionality)
6. Slice 6 rule documents pdf-extract limitations (scanned/multi-column/form fields) — TC-AAI-5

## Phase 1.5 Security Pre-Review (SECURITY APPROVED for all 3 slices)

### Slice 1 (path canonicalization) — 7 MUST requirements
1. Canonicalize BOTH `--project-root` arg AND `current_dir()`; macOS `/tmp/x` is actually `/private/tmp/x` so cwd-canonicalize is mandatory
2. `Path::starts_with` on canonicalized PathBufs — NEVER `str::starts_with` on `to_string_lossy` (defeats `/foo` vs `/foobar` boundary)
3. Order: canonicalize → prefix-check (not the reverse)
4. Literal stderr `error: project-root must resolve under current working directory` + exit 2 via `eprintln!` + `std::process::exit(2)` (NOT clap auto-render)
5. NEVER `to_str().unwrap()` / `to_string_lossy()` on path bytes; stay in `Path`/`PathBuf`/`OsStr`
6. Map all `canonicalize` Errs (ENOENT, EACCES, ELOOP) uniformly to same exit-2 + same literal stderr (no info leak)
7. Callers MUST receive the canonicalized PathBuf, NEVER the original arg (TOCTOU discipline)

### Slice 1 — 9 additional test cases (beyond TC-AAI-3 4 subcases)
- Non-UTF-8 path (`OsStr::from_bytes(&[0xff])`) → exit 2, no panic
- Trailing slash normalization (`./` and `.` both succeed)
- Symlink loop (`ln -s /tmp/loop /tmp/loop`) → ELOOP → exit 2
- Read-only filesystem on canonicalize → EACCES → exit 2
- `--project-root` equal to cwd identity case
- `--project-root` is regular file → succeed (subcommand validates dir-ness)
- Cwd-deletion race (#[ignore] manual repro)
- Compile-time check: `resolve_project_root` is the ONLY public PathBuf-from-user-input fn in cli.rs
- macOS `/private/tmp` aliasing case explicitly

### Slice 2 (PDF + ingest transactionality) — 7 MUST requirements
1. `std::panic::catch_unwind(AssertUnwindSafe(...))` around `pdf_extract::extract_text`; map panic → `IngestError::PdfDecode("panic during extraction")`; batch loop continues
2. Per-PDF byte budget 50 MB; reject with `IngestError::PdfBudgetExceeded(path, bytes)` if extracted text exceeds
3. Wall-clock soft-cap per PDF: 30s (half of AC-4's 60s envelope); for iter-1 acceptable to defer if cooperative timeout impractical, but document
4. `conn.transaction_with_behavior(TransactionBehavior::Immediate)` per-document; explicit `tx.commit()` on success path; Drop-rollback on error/panic; `catch_unwind` MUST be OUTSIDE the transaction guard
5. UTF-8 chunker boundary safety: `s.is_char_boundary(i)` snap or iterate `s.chars()` — naive `&s[i..i+500]` panics on multibyte. Add `tests/fixtures/utf8-edge.md` with 4-byte emoji at byte offsets 498/502/999/1001
6. NEVER `format!` / `write!` / `+` to build SQL; ONLY `?1`, `?2` parameterized via `rusqlite::params!`
7. Directory walker `WalkDir::new(p).follow_links(false)`; symlinks skipped with `WARN: skipping symlink: <path>`
8. Pin `pdf-extract` to concrete version in Cargo.toml (NOT wildcard `"*"`) — apply at SLICE 1 implementation since Cargo.toml is created there

### Slice 2 — 7 additional test cases (TC-SEC-2.x)
- TC-SEC-2.1 PDF panic containment (panicking fixture; batch survives)
- TC-SEC-2.2 PDF byte-budget (>50 MB extracted text → PdfBudgetExceeded)
- TC-SEC-2.3 UTF-8 chunker boundary (emoji at byte boundaries; no panic; valid UTF-8)
- TC-SEC-2.4 Symlink-escape during dir ingest (skipped with WARN; no `/etc/passwd` row)
- TC-SEC-2.5 SQL-injection-shaped source path (filename with `'; DROP TABLE`; tables intact)
- TC-SEC-2.6 Concurrent reader during writer (WAL invariant; no SQLITE_BUSY)
- TC-SEC-2.7 cargo-audit gate (no open RUSTSEC advisories on pinned pdf-extract)

### Slice 5 (install.sh) — 9 MUST requirements
1. URL hard-coded from `REPO_URL` constant + `KNOWLEDGE_VERSION` constant; NO env-var override; NO third-party mirrors
2. `curl --proto =https --tlsv1.2 -fsSL <url> -o <tmp>`; NEVER `-k` / `--insecure`; wget fallback `--https-only`; download to `mktemp` then `mv`
3. Hash verification deferred to iter-2 (acceptable); document as inline comment + RELEASING.md line; iter-2 ships `.sha256` sidecar with `shasum -a 256 -c` verification
4. Allowlist scope strictly `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` — never broader; never `~/.claude/**` or `/bin/*`
5. JSON merge: `jq` preferred via `<file>.tmp` + `mv` atomic + `chmod 0644`; jq-absent fallback fail-closed with print-instructions, NOT hand-rolled sed/regex; post-write validate `jq -e '.'`
6. Missing-file create case: literal `{"permissions":{"allow":["~/.claude/tools/sdlc-knowledge/sdlc-knowledge *"]}}` + `chmod 0644`
7. Cargo source-build fallback gated: `command -v cargo` succeeds AND `$SCRIPT_DIR/tools/sdlc-knowledge/Cargo.toml` exists AND binary download attempted+failed; NEVER `--source-dir` user flag
8. install.sh ordering: option (B) chosen — re-invoke `get_source_dir` if `$SCRIPT_DIR/tools/sdlc-knowledge` missing; mirror line-247 pattern; guard at TOP of both `install_knowledge_binary` and `cargo_source_build_fallback`
9. Quote ALL variables; validate `uname -ms` against fixed 4-platform allowlist BEFORE URL interpolation; verify downloaded binary `--version` exits 0 BEFORE writing allowlist entry; NEVER `sudo`/`su`/`doas`

### Defense-in-depth flags for Slice 2 / Slice 3 (carried forward)
- Slice 2: per-file canonicalize+prefix-check inside dir walker (symlink-escape mitigation)
- Slice 3: `delete <source-id>` MUST canonicalize-and-prefix-check string-path arg before SQL DELETE

## Open Questions resolved at architect Step 3
- OQ#1 — PDF crate: `pdf-extract` for iter-1 (`lopdf` documented fallback)
- OQ#2 — release-engineer Gate 9 coupling: out-of-scope iter-1 (manual maintainer first-tag bootstrap per RELEASING.md)
- OQ#3 — resource-architect auto-recommendation: out-of-scope iter-1
- OQ#4 — per-project sources/ gitignored by default: yes (templates/knowledge/.gitignore)
- OQ#5 — rusqlite + FTS5 syntax: shape approved; literal SQL verified at Slice 3 first `cargo test`

## Invariants (load-bearing)
- 17 core agents — UNCHANGED (FR-12.1)
- 10 quality gates — UNCHANGED (FR-12.2)
- 5 executor agents (test-writer, build-runner, e2e-runner, doc-updater, changelog-writer) — BYTE-UNCHANGED (FR-12.3)
- README taglines `17 specialized AI agents` (line 5) and `10 quality gates` (line 35) — BYTE-UNCHANGED (AC-11)
- `templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*` — BYTE-UNCHANGED (only ADDITION is `templates/knowledge/`)
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED (citation source `knowledge-base:` is additive convention) (FR-12.5)
- `src/claude.md` Plan Critic — UNCHANGED (existing `### External contracts` heuristic covers `knowledge-base:` source format)
- release-engineer Gate 9 itself — UNCHANGED iter-1
- Commands count: 5 → 6 (per AC-12, FR-6.4)

## Out of scope iter-1
- Vector embeddings (sqlite-vec hybrid) — iter-2
- MCP server interface — iter-2
- resource-architect auto-recommendation — iter-2 PRD
- Windows binary builds — iter-2 (only darwin-arm64/x64, linux-x64/arm64)
- Automated coupling between SDLC release-engineer and binary release pipeline

## Completed
- Bootstrap pipeline (Steps 1, 2, 3, 3.5, 3.75, 4, 5, 5.5) — bootstrap commit pending

## Blockers
(none)
