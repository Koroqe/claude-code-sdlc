# Plan: Local Knowledge Base for SDLC Agents (CLI-only, no MCP)

## Recommended Resources
0 recommendations total; 0 expensive; 0 hard reversibility; 0 Trivial; 0 Moderate; 0 Sensitive; 0 Forbidden

No external resources required.

### MCP
(none)

### Cloud/Compute
(none)

### External API
(none)

### Third-party Service
(none)

### Library/Framework
(none)

### Hardware
(none)

Auto-install approval required:

(no Trivial-tier items)

(no Moderate-tier items)

Sensitive-tier items (if any) will be presented separately for manual action.

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

- PRD §11 "Local Knowledge Base for SDLC Agents" is at `/Users/aleksandra/Documents/claude-code-sdlc/docs/PRD.md` lines 2337–2693 with `Date: 2026-04-25`, `Status: [IN DEVELOPMENT]`, 12 FR-groups, 51 sub-clauses, 10 NFRs, 13 ACs — verified by Read of `docs/PRD.md` lines 2337–2693 in the current session.
- The 13 acceptance criteria AC-1 through AC-13 are at PRD §11.5 lines 2514–2526 — verified by Read in the current session.
- The literal stderr message for project-root traversal rejection is `error: project-root must resolve under current working directory` per FR-1.5 (PRD line 2389) and AC-6 (PRD line 2519) — verified by Read in the current session.
- The literal stderr message for corrupt-index handling is `error: index database invalid; re-ingest required` per FR-1.6 (PRD line 2390) and AC-7 (PRD line 2520) — verified by Read in the current session.
- The literal skip line emitted by agents when binary is absent is `knowledge-base: tool not installed; skipping` per FR-5.5 (PRD line 2434) / FR-10.2 (PRD line 2477) / AC-9 (PRD line 2522) — verified by Read in the current session.
- The literal install warning when neither release nor cargo is available is `binary unavailable; install cargo or wait for first release` per FR-8.5 (PRD line 2461) and AC-13 (PRD line 2526) — verified by Read in the current session.
- The literal Bash allowlist entry value is `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` per FR-8.3 / NFR-1.9 / AC-2 — verified by Read in the current session.
- The literal citation format per FR-7.1 / AC-10 is `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` — verified by Read of PRD line 2449 in the current session.
- The schema in iter-1 has exactly four tables: `documents`, `chunks`, `chunks_fts` (FTS5 virtual), `schema_version` per FR-4.2 (PRD lines 2418–2422) — verified by Read in the current session.
- `templates/knowledge/.gitignore` MUST contain exactly the lines `sources/`, `index.db`, `index.db-shm`, `index.db-wal` per FR-9.1 (PRD line 2469) and AC-3 (PRD line 2516) — verified by Read in the current session.
- The 12 in-scope thinking-agent prompt files enumerated in FR-5.1 (PRD line 2430) are: `src/agents/{prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, code-reviewer, verifier, refactor-cleaner, resource-architect, role-planner, release-engineer}.md` — verified by Read in the current session.
- The 5 exempt executor agents that MUST be byte-unchanged per FR-5.4 / FR-12.3 (PRD lines 2433, 2495) are: `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer` — verified by Read in the current session.
- `install.sh` line 228 is the SCRIPT_DIR cleanup `if [ "$LOCAL_MODE" = false ] && [ -n "$SCRIPT_DIR" ] && [ "$SCRIPT_DIR" != "/" ]; then rm -rf "$SCRIPT_DIR"; fi`; the established pattern at line 247 within `scaffold_project` re-invokes `get_source_dir` if `$SCRIPT_DIR/templates` is missing — verified by Read of `install.sh` lines 220–254 in the current session. Both architect-action-item options (run BEFORE line 228 OR re-invoke `get_source_dir`) are mechanically supported by this codebase.
- The use-cases file `docs/use-cases/local-knowledge-base_use_cases.md` enumerates 15 primary UCs (UC-1 through UC-15 with E1/E2/E3/E4/EC variants) and 5 cross-cutting UCs (UC-CC-1 through UC-CC-5) — verified by Read of the use-cases file lines 1–100 in the current session.
- The QA file `docs/qa/local-knowledge-base_test_cases.md` includes the 5 architect-action-item TCs (TC-AAI-1 install.sh ordering; TC-AAI-2 BM25 score direction; TC-AAI-3 Slice 1 path canonicalization; TC-AAI-4 Slice 2 PDF transactionality; TC-AAI-5 Slice 6 pdf-extract limitations) per the QA `## Facts → ### Verified facts` line 32 — verified by Read of the QA file lines 1–100 in the current session.
- The architect's Step 3 PASS verdict surfaced 5 inline action items, 0 STRUCTURAL items, with Open Question #1 RESOLVED (`pdf-extract` for iter-1, `lopdf` documented fallback) and Open Question #5 PARTIALLY RESOLVED (FTS5 schema shape approved; literal SQL verified at Slice 3 test time; BM25 score direction = NEGATIVE raw with negation for human-readable JSON output) — taken from the orchestrator-supplied verdict text in this session's task prompt.
- `.claude/resources-pending.md` content reports `0 recommendations total` with no Trivial/Moderate/Sensitive items and a non-interactive auto-install skip — verified by Read of `.claude/resources-pending.md` lines 1–34 in the current session.
- `.claude/roles-pending.md` content reports `0 additional roles total` with `(no roles to invoke)` and `(no reuse decisions)` — verified by Read of `.claude/roles-pending.md` lines 1–11 in the current session.

### External contracts

- **`rusqlite` crate (Rust SQLite binding)** — symbols: `rusqlite::Connection::open_with_flags`, `Connection::execute_batch`, `Connection::prepare`; SQLite FTS5 virtual table `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')` — source: rusqlite docs https://docs.rs/rusqlite/ + SQLite FTS5 docs https://www.sqlite.org/fts5.html — verified: **no — assumption**. Inherited verbatim from PRD §11 `## Facts → ### External contracts` (PRD line 2669). Verification path: architect Step 3 review BEFORE Slice 3 ships (resolved per task prompt; Slice 3 done-condition includes a working end-to-end search query that fails fast on any FTS5 syntax error).
- **`pdf-extract` crate** — symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>` — source: https://crates.io/crates/pdf-extract — verified: **no — assumption**. Inherited from PRD §11 `## Facts` line 2670. Architect Step 3 RESOLVED Open Question #1 by selecting `pdf-extract` for iter-1 with `lopdf` documented fallback. TC-AAI-5 verifies that `src/rules/knowledge-base.md` documents the chosen crate's known limitations (scanned PDFs, multi-column, form fields).
- **`clap` crate v4.x** — symbols: `clap::Parser` derive macro, `#[command(subcommand)]`, `clap::Subcommand` — source: https://docs.rs/clap/4 — verified: **no — assumption**. Inherited from PRD §11 `## Facts` line 2671. Verification path: any `cargo build` failure in Slice 1 reveals API mismatches immediately.
- **GitHub Actions GitHub-hosted runner labels** — symbols: `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), `ubuntu-22.04-arm` (linux-arm64) — source: https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners — verified: **no — assumption**. Inherited from PRD §11 `## Facts` line 2672. Verification path: `actionlint` in Slice 4's done-condition catches typos.
- **SQLite `bm25()` ranking function** — symbol: `bm25(fts_table_name [, weight1, weight2, ...])` returning a NEGATIVE score where smaller (more negative) = better match — source: https://www.sqlite.org/fts5.html#the_bm25_function — verified: **no — assumption**. Inherited from PRD §11 `## Facts` line 2673. Architect Step 3 inline action item #3 RESOLVED the human-readable convention: SQL uses `SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC` so the JSON output's `score` field is positive with larger = better. Slice 3 done-condition (TC-AAI-2) asserts the documented convention and ordering.
- **`assert_cmd` and `predicates` test crates** — symbols: `assert_cmd::Command`, `predicates::str::contains` — source: https://docs.rs/assert_cmd / https://docs.rs/predicates — verified: **no — assumption**. Inherited from PRD §11 `## Facts` line 2674. Verification path: caught at first `cargo test`.
- **`actionlint`** — symbol: invocation `actionlint .github/workflows/*.yml` — source: https://github.com/rhysd/actionlint — verified: **no — assumption**. Inherited from PRD §11 `## Facts` line 2675. Verification path: Slice 4 pins a specific `actionlint` version in the workflow itself or in a `.actionlint` config.

### Assumptions

- Rust crate placement is monorepo at `tools/sdlc-knowledge/` — risk: if architect prefers a separate repository, install.sh's release-download URL changes but binary surface is identical. Architect Step 3 verdict approved monorepo placement per task-prompt context. Verification path: re-confirmed during Slice 4 release-pipeline review.
- Default chunk size of ~500 characters with ~100-character overlap is reasonable for BM25 retrieval over technical books — risk: too-small chunks fragment phrasing; too-large chunks dilute scores. Verification path: Slice 2 includes a fixture-based golden test (`tests/fixtures/sample.md` ~3 KB → exactly 8 chunks); a configurable flag is iter-2 (per PRD 11.7 item 8).
- The `## Knowledge Base (when present)` activation block (~25 lines) appended at the END of each of the 12 in-scope agent prompt files fits without disturbing existing sections (including `## Cognitive Self-Check (MANDATORY)` from Section 9) — risk: large-prompt agents (`resource-architect.md` ~585 LOC, `role-planner.md` ~467 LOC) hit attention-budget limits. Verification path: read each agent file before edit (Wave 5 slices 7a/7b/7c); architect's Slice 6 review covers the rule wording for all 12 agents.
- Idempotency keying on `(source_path, mtime, sha256)` is sufficient for re-ingest — risk: files renamed but unchanged are re-chunked unnecessarily. Verification path: Slice 2's idempotency test covers the unchanged-file case; renamed-file is acceptable cost in iter-1.
- The Plan Critic in `src/claude.md` does NOT need a new bullet for `knowledge-base:` citations because the existing Section 9 `### External contracts` heuristic covers the new prefix per FR-10.3 — risk: if a Plan Critic auditor disagrees, iter-2 PRD adds a soft-MINOR bullet. Verification path: architect Step 3 explicit confirmation (granted per task-prompt PASS verdict).
- The architect-decided BM25 score-direction convention is implemented as `SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC` so the human-readable JSON `score` is positive with larger = better — risk: misimplementation produces results in worst-first order. Verification path: TC-AAI-2 in `docs/qa/local-knowledge-base_test_cases.md` asserts ordering correctness and the documented convention via `src/rules/knowledge-base.md`.
- The `<chunk-id>` component of the FR-7.1 citation refers to `chunks.id` (auto-increment) — risk: ambiguity across re-ingests. Verification path: TC-12.1 captures the assumption; Slice 6 rule file documents the choice; Slice 3 implementation aligns.

### Open questions

- (none) — All five PRD `## Facts` open questions are RESOLVED at architect Step 3 (Open Questions #1, #2 for the iter-1 cycle) or are documented as iter-2 scope per PRD §11.7 (Open Questions #3, #4, #5). Architect's 5 inline action items are inlined into Slice 1, 2, 3, 5, 6 done-conditions below.

## Prerequisites verified

- PRD section: `docs/PRD.md` §11 (lines 2337–2693) — 12 FR-groups, 51 sub-clauses, 10 NFRs, 13 ACs, 8 subsections (11.1–11.8) — VERIFIED.
- Use cases: `docs/use-cases/local-knowledge-base_use_cases.md` — 15 primary UCs + variants + 5 cross-cutting UCs — VERIFIED.
- QA test cases: `docs/qa/local-knowledge-base_test_cases.md` — 117 TCs (88 per-UC + 7 invariants + 5 architect-action-item TCs + cross-platform variants) — VERIFIED.
- Architecture review: PASS verdict — 5 inline action items (install.sh ordering; allowlist missing-file handling; BM25 score direction; Slice 1 security pre-review upgrade; Slice 2 security pre-review upgrade; Slice 6 pdf-extract limitations) — 0 STRUCTURAL items. All 5 action items inlined into the slices below.
- Resource handoff: `.claude/resources-pending.md` — 0 recommendations, 0 Trivial/Moderate/Sensitive items, non-interactive auto-install skip — VERIFIED.
- Role handoff: `.claude/roles-pending.md` — 0 additional roles, `(no roles to invoke)`, `(no reuse decisions)` — VERIFIED.

## Slices

#### Slice 1: Rust crate skeleton + clap CLI scaffold + path-canonicalization safety
- **Wave:** 1
- **UC-coverage:** UC-5-E2, UC-5-E3, UC-CC-3 (preparation only — command count remains 5 until Slice 8 ships /knowledge-ingest)
- **TC-coverage:** TC-1.1 partial (binary `--version` exit 0 contract), TC-5.6 (path traversal), TC-5.7 (symlink escape), TC-AAI-3 (path canonicalization 4 subcases)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/Cargo.toml` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/main.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/cli.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/cli_help_test.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/path_safety_test.rs` `[new]`
- **Changes:**
  - `Cargo.toml`: declare ALL deps upfront so subsequent slices Edit-only `main.rs`. Dependencies: `clap = { version = "4", features = ["derive"] }`, `rusqlite = { version = "*", features = ["bundled", "vtab"] }`, `pdf-extract = "*"` (architect-selected per Open Question #1; `lopdf` is the documented fallback), `serde`, `serde_json`, `sha2`. Dev-dependencies: `assert_cmd`, `predicates`. Release profile: `strip = true`, `lto = true`, `codegen-units = 1` per NFR-1.1 / FR-11.2.
  - `src/main.rs`: `#[derive(clap::Parser)]` entry with all 5 subcommands wired (`Ingest`, `Search`, `List`, `Status`, `Delete`) plus `--version`. Each subcommand body returns `Err(anyhow!("not yet implemented"))` placeholder. Subsequent Wave 2 / Wave 3 slices replace per-command bodies WITHOUT touching main.rs structure.
  - `src/cli.rs`: subcommand structs (`IngestArgs`, `SearchArgs`, `ListArgs`, `StatusArgs`, `DeleteArgs`) each with `--project-root <PathBuf>` and `--json bool` flags. Public helper `pub fn resolve_project_root(arg: Option<&Path>) -> Result<PathBuf, ProjectRootError>` that: (a) defaults to `std::env::current_dir()` when `arg` is `None`; (b) `std::fs::canonicalize` the input AND the cwd; (c) returns `ProjectRootError::EscapesCwd` (mapped to exit code 2 with literal stderr `error: project-root must resolve under current working directory`) if canonicalized input does not start with canonicalized cwd. Reject (i) `..`-traversal, (ii) symlink-escape outside cwd, (iii) absolute paths outside cwd, (iv) non-existent paths under cwd are NOT rejected at this layer (the subcommand validates path existence separately). Special case: when cwd itself is a symlink, both sides are canonicalized first so the comparison is on resolved paths.
  - `tests/cli_help_test.rs`: assert `sdlc-knowledge --help` lists exactly 5 subcommands plus `--version`; assert `sdlc-knowledge --version` exits 0 with semver-shaped string.
  - `tests/path_safety_test.rs`: 4 subcase tests for `resolve_project_root`: (1) `..`-traversal `--project-root ../../../etc` exits 2 with literal stderr; (2) symlink escape (create `/tmp/sym -> /etc`) → rejected; (3) absolute path outside cwd `/etc` rejected; (4) cwd-itself-is-symlink: when cwd is `/private/tmp/x` accessed via `/tmp/x`, both sides canonicalize and a relative project-root resolves correctly without false-positive rejection. Plus subcommand placeholder smoke test: `sdlc-knowledge ingest /tmp/x` exits 1 with stderr containing `not yet implemented`.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge
  cargo build --release 2>&1 | tail -20
  cargo test 2>&1 | tail -30
  ./target/release/sdlc-knowledge --help | grep -E "ingest|search|list|status|delete" | wc -l   # expect 5
  ./target/release/sdlc-knowledge --version                                                     # expect "sdlc-knowledge 0.1.0" exit 0
  ./target/release/sdlc-knowledge ingest /tmp/x --project-root ../../../etc 2>&1                # exit 2; literal "error: project-root must resolve under current working directory"
  echo "exit=$?"                                                                                # 2
  ```
- **Done when:**
  - `cargo build --release -p sdlc-knowledge` exits 0; binary path `tools/sdlc-knowledge/target/release/sdlc-knowledge` exists and is executable.
  - `cargo test -p sdlc-knowledge` PASS for `cli_help_test.rs` (3 assertions: 5 subcommands listed, --version exit 0, semver shape) and `path_safety_test.rs` (5 assertions: 4 traversal subcases + placeholder smoke).
  - `sdlc-knowledge --help` lists all 5 subcommands (`grep -c` ≥ 5).
  - **Path-canonicalization 4 subcases per TC-AAI-3:** (a) `..`-traversal `--project-root ../../../etc` exits 2 with literal stderr `error: project-root must resolve under current working directory`; (b) symlink escape (test fixture creates `/tmp/sdlc-test-sym -> /etc` and passes `--project-root /tmp/sdlc-test-sym`) exits 2 with same message; (c) absolute path outside cwd `/etc` exits 2 with same message; (d) cwd-itself-is-symlink case (test fixture uses `/private/tmp/...` vs `/tmp/...` macOS aliasing) does NOT false-reject a valid relative project-root.
  - Each placeholder subcommand exits 1 with stderr containing `not yet implemented`.
  - Binary size after `strip + lto` ≤ 4 MB (headroom against NFR-1.1 10 MB budget; later slices add more code).
- **Pre-review:** **security-auditor** (UPGRADED from `none` per architect action item #4 — `resolve_project_root` is the security backbone; verifies (i) canonicalization happens BEFORE any FS read, (ii) stderr message is the literal string for AC-6 grep, (iii) no panic path on non-UTF-8 paths, (iv) cwd-symlink subcase does not regress.)

#### Slice 2: Chunker + MD/TXT/PDF readers + ingest command + per-document transactionality
- **Wave:** 2
- **UC-coverage:** UC-5, UC-5-A1, UC-5-A2, UC-5-E4 (corrupt PDF in batch), UC-6, UC-9, UC-9-E1 (concurrent ingest+search via WAL), UC-10, UC-CC-4 (PDF + Markdown + plain text formats)
- **TC-coverage:** TC-5.1, TC-5.2, TC-5.3, TC-9.1, TC-9.2, TC-10.1, TC-CP-4, TC-AAI-4 (batch-with-corrupt-PDF transactionality)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/ingest.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/text.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/pdf.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/store.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/migrations.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/main.rs` (Edit — replace `Ingest` placeholder body only; do NOT touch other subcommand placeholders or `Cargo.toml`)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/ingest_test.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/store_test.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/cli_ingest_e2e_test.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/sample.md` `[new]` (~3 KB synthetic Markdown)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/sample.txt` `[new]` (~1 KB plain text)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/sample.pdf` `[new]` (small 2-page synthetic PDF, ≤ 200 KB; generated via a committed `printpdf`-driven test helper or vendored as a static fixture)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/corrupt.pdf` `[new]` (truncated PDF — first 100 bytes of `sample.pdf`)
- **Changes:**
  - `src/ingest.rs`: `pub trait SourceReader { fn read(&self, p: &Path) -> Result<String>; }`. `pub fn chunk(text: &str) -> Vec<Chunk>` — deterministic 500-char sliding window with 100-char overlap; chunks struct `{ ord: usize, text: String }`. Dispatcher `ingest_path(root: &Path, p: &Path, conn: &mut rusqlite::Connection) -> IngestResult` reads extension, picks reader, computes sha256+mtime, checks idempotency, opens `BEGIN IMMEDIATE` per-document, writes documents row, deletes prior chunks for this `doc_id`, inserts new chunks (FTS5 triggers fire), COMMITs. Public batch entry `ingest(root: &Path, target: &Path, conn: &mut rusqlite::Connection) -> BatchResult` walks directories recursively (only `.md`/`.txt`/`.pdf` extensions per FR-2.1). On per-file failure: log error, continue with remaining files. Return BatchResult `{ succeeded: Vec<PathBuf>, failed: Vec<(PathBuf, String)> }`. Skip with `unchanged: <path>` log line when sha256+mtime match prior row.
  - `src/text.rs`: `MarkdownReader`, `PlainTextReader` — both read UTF-8 from disk; MarkdownReader strips `# ` headers and code-fence backticks lightly so search snippets are clean text.
  - `src/pdf.rs`: `PdfReader` — `pub fn read(p: &Path) -> Result<String>` calls `pdf_extract::extract_text(p)`. On `pdf_extract` error, return `IngestError::PdfDecode(path, msg)` so the batch loop logs and continues.
  - `src/store.rs`: schema init `pub fn open_or_init(db_path: &Path) -> Result<Connection>`. CREATE TABLE statements EXACTLY per FR-4.2 (`documents(id INTEGER PRIMARY KEY, source_path TEXT UNIQUE, mtime INTEGER, sha256 TEXT, ingested_at INTEGER)`, `chunks(id INTEGER PRIMARY KEY, doc_id INTEGER REFERENCES documents(id), ord INTEGER, text TEXT)`, FTS5 virtual `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')`, plus the three standard insert/update/delete triggers per SQLite FTS5 docs, `schema_version(version INTEGER NOT NULL)` seeded `INSERT INTO schema_version VALUES (1)`). At init: `PRAGMA journal_mode=WAL` per FR-2.7 / NFR-1.6. Public `pub fn validate_schema(conn: &Connection) -> Result<(), IndexError>` reads `schema_version` and checks the four expected tables exist with expected columns; mapped to exit 1 with literal stderr `error: index database invalid; re-ingest required` per FR-1.6. Helper `pub fn upsert_document(...)` and `pub fn replace_chunks(...)` use prepared statements wrapped in `BEGIN IMMEDIATE`/`COMMIT`.
  - `src/migrations.rs`: `pub fn current_version(conn: &Connection) -> u32` and `pub fn run_migrations(conn: &mut Connection) -> Result<()>` with a single v1 migration registered; structured so iter-2 appends v2 without rewriting v1 (per FR-4.4). Empty DB → run v1 migration, set schema_version = 1.
  - `src/main.rs`: replace `Ingest` placeholder body with: call `cli::resolve_project_root(args.project_root.as_deref())?` → `db_path = root.join(".claude/knowledge/index.db")`; `let mut conn = store::open_or_init(&db_path)?`; `migrations::run_migrations(&mut conn)?`; `let result = ingest::ingest(&root, &args.path, &mut conn)?`; emit human-readable summary (or JSON when `--json`). Other subcommand placeholders (`Search`, `List`, `Status`, `Delete`) UNCHANGED — they still return `not yet implemented`.
  - `tests/ingest_test.rs`: golden chunker test — `chunk(read sample.md)` MUST produce exactly 8 chunks (compile-time fixture-derived constant verified and pinned).
  - `tests/store_test.rs`: schema tests — open empty DB, assert four tables exist; assert `PRAGMA journal_mode` returns `wal`; assert `schema_version` row equals 1; FTS5 trigger correctness (insert into chunks, query via chunks_fts, delete chunks → FTS5 row gone).
  - `tests/cli_ingest_e2e_test.rs`: using `assert_cmd` — (a) ingest sample.md → exit 0, JSON shows ≥1 doc and 8 chunks; (b) re-ingest sample.md → exit 0, stdout contains `unchanged: <path>`; (c) ingest mixed-format directory `tests/fixtures/` → exit 0, succeeded list contains sample.md + sample.txt + sample.pdf, failed list empty; (d) **TC-AAI-4 batch-with-corrupt-PDF transactionality**: ingest a directory containing sample.md + corrupt.pdf — exit 0 (NOT exit 1; batch continues), succeeded list contains sample.md, failed list contains corrupt.pdf with a clear per-file error message, AND the post-batch SQLite state shows sample.md fully committed (its chunks queryable via chunks_fts) AND zero rows from corrupt.pdf; the per-document `BEGIN IMMEDIATE` transaction ensures the corrupt-PDF aborted txn does NOT leave half-written rows.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge
  cargo test 2>&1 | tail -40
  # End-to-end ingest demo (in /tmp scratch project)
  mkdir -p /tmp/sdlc-test/.claude/knowledge && cd /tmp/sdlc-test
  cp /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/fixtures/sample.md .claude/knowledge/
  /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/target/release/sdlc-knowledge ingest .claude/knowledge/sample.md --json
  sqlite3 .claude/knowledge/index.db "SELECT COUNT(*) FROM documents; SELECT COUNT(*) FROM chunks;"   # expect 1, 8
  /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/target/release/sdlc-knowledge ingest .claude/knowledge/sample.md   # expect "unchanged:" log line, exit 0
  ```
- **Done when:**
  - `cargo test -p sdlc-knowledge` PASS for all new tests (chunker golden, store schema, FTS5 triggers, CLI E2E paths a-d).
  - Ingesting `sample.md` produces exactly 8 chunks (golden); ingesting `sample.txt` produces ≥1 chunk; ingesting `sample.pdf` produces ≥1 chunk.
  - `documents.sha256` populated; re-running ingest with unchanged sha256 + mtime is a no-op (exit 0, stdout `unchanged: <path>`).
  - `documents.sha256` differs from prior run → re-chunks transactionally; FTS5 triggers update so search returns NEW snippets and ZERO old snippets.
  - `index.db` is created at `<cwd>/.claude/knowledge/index.db`; `PRAGMA journal_mode` returns `wal`.
  - **TC-AAI-4 batch-with-corrupt-PDF transactionality:** ingest of `tests/fixtures/` (containing sample.md + corrupt.pdf) returns exit 0 (batch continues per FR-2.6), batch result shows sample.md in succeeded and corrupt.pdf in failed, post-batch SQLite has sample.md's 8 chunks committed AND zero rows from corrupt.pdf (`SELECT COUNT(*) FROM documents WHERE source_path LIKE '%corrupt.pdf'` returns 0).
  - AC-4 5 MB-PDF latency budget ≤ 60 s satisfied on the test runner (verified by timing assertion in `cli_ingest_e2e_test.rs`).
- **Pre-review:** **architect + security-auditor** (UPGRADED from `architect` per architect action item #5). Architect verifies: FTS5 trigger correctness; per-document `BEGIN IMMEDIATE` transactionality; idempotency invariant; PDF crate selection (`pdf-extract` confirmed). Security-auditor verifies: PDF crate's exposure to malformed-input panics is contained (no panic propagates past the per-file error boundary); UTF-8 boundary handling on the chunker (no panic on multi-byte boundary slicing); the per-document transaction reliably rolls back on `pdf_extract` errors so partial state never leaks.

#### Slice 3: Search + list/status/delete + JSON output + corrupt-index handling + BM25 score-direction convention
- **Wave:** 3
- **UC-coverage:** UC-7, UC-7-E1 (corrupt index), UC-7-E2 (empty DB), UC-7-E3 (FTS5 query syntax error), UC-8 (list/status/delete)
- **TC-coverage:** TC-7.1, TC-7.2, TC-7.3, TC-7.4, TC-7.5, TC-7.6, TC-8.1, TC-8.2, TC-8.3, TC-8.4, TC-AAI-2 (BM25 score-direction)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/search.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/output.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/main.rs` (Edit — replace `Search`, `List`, `Status`, `Delete` placeholder bodies)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/src/store.rs` (Edit — extend `validate_schema()` to be called on every read path)
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/search_test.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/cli_search_e2e_test.rs` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/tests/corrupt_index_test.rs` `[new]`
- **Changes:**
  - `src/search.rs`: `pub fn search(conn: &Connection, query: &str, top_k: u32) -> Result<Vec<SearchHit>, SearchError>`. SQL: `SELECT chunks.id AS chunk_id, documents.source_path AS source, chunks.ord AS ord, -bm25(chunks_fts) AS score, snippet(chunks_fts, 0, '', '', '…', 32) AS snippet FROM chunks_fts JOIN chunks ON chunks.id = chunks_fts.rowid JOIN documents ON documents.id = chunks.doc_id WHERE chunks_fts MATCH ?1 ORDER BY score DESC LIMIT ?2`. **Per architect action item #3:** the SQL negates raw `bm25()` (which returns NEGATIVE values where smaller-more-negative = better match per SQLite FTS5 docs) so the `score` field exposed to JSON is POSITIVE with larger = better. `top_k` clamped to ≤ 100 per FR-3.2. FTS5 query-syntax errors (e.g., `chunks_fts MATCH "AND OR"`) are caught and returned as `SearchError::FtsSyntax` mapped to exit 1 (no panic).
  - `src/output.rs`: `pub fn render_search_human(hits: &[SearchHit])`, `pub fn render_search_json(hits: &[SearchHit]) -> String`. JSON shape per FR-3.3: `{"source": <string>, "chunk_id": <int>, "ord": <int>, "score": <float>, "snippet": <string>}`. Empty results: `[]` (exit 0 per FR-3.4). Mirror serializers for list/status outputs.
  - `src/main.rs`: replace 4 placeholder bodies. All 4 read paths call `store::validate_schema(&conn)` first; on `IndexError::Corrupt` print stderr `error: index database invalid; re-ingest required` and `std::process::exit(1)` per FR-1.6 / AC-7. `Search`: `cli::resolve_project_root → open → validate_schema → search::search → render`. `List`: query `documents` ordered by `ingested_at DESC`. `Status`: `{schema_version, doc_count, chunk_count, db_path}`. `Delete`: accepts argument as either integer `documents.id` or string `documents.source_path` — Slice 3 implementation chooses integer-first with string-fallback (documented under Assumptions and TC-8.3 / TC-8.4 cover both).
  - `src/store.rs`: `validate_schema()` now also explicitly verifies (a) the four tables exist, (b) `schema_version` row exists and is in `1..=2` (forward-compat for iter-2), (c) `chunks_fts` is a valid FTS5 vtable. Any failure → `IndexError::Corrupt` (no panic). Used by every read entry-point.
  - `tests/search_test.rs`: seed a 20-document fixture, run search for a known unique term that appears in exactly 3 chunks across 2 docs → assert top-3 ordered with the chunk having the most term occurrences first, scores POSITIVE and DESCENDING. Empty-result query → empty Vec, exit 0.
  - `tests/cli_search_e2e_test.rs`: (a) `sdlc-knowledge search "auth middleware" --top-k 5 --json` returns valid JSON array length ≤ 5 with documented shape; (b) JSON `score` field is positive (> 0) AND values are non-strictly-descending; (c) `sdlc-knowledge list --json` returns array of `{source_path, chunk_count, ingested_at}`; (d) `sdlc-knowledge status --json` returns `{schema_version: 1, doc_count: N, chunk_count: M, db_path: <abs path>}`; (e) `sdlc-knowledge delete <source>` removes both `documents` row and all `chunks` rows; subsequent search excludes them.
  - `tests/corrupt_index_test.rs`: per AC-7 — open valid DB, ingest one doc, close, truncate `index.db` to 100 bytes, run `search "anything"` → exit 1 with literal stderr `error: index database invalid; re-ingest required` AND stderr does NOT contain `panicked at`.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge
  cargo test 2>&1 | tail -40
  # End-to-end search demo
  cd /tmp/sdlc-test   # has Slice 2 ingested data
  /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/target/release/sdlc-knowledge search "the" --top-k 3 --json | jq 'length, .[].score, (.[].score | . > 0)'
  # Corrupt-index test (per AC-7)
  cp .claude/knowledge/index.db .claude/knowledge/index.db.bak
  truncate -s 100 .claude/knowledge/index.db
  /Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/target/release/sdlc-knowledge search "x" 2>&1 | grep -F "index database invalid; re-ingest required"
  echo "exit=$?"   # 0 (the grep matched). The binary exit was 1 by AC-7.
  mv .claude/knowledge/index.db.bak .claude/knowledge/index.db
  ```
- **Done when:**
  - `cargo test -p sdlc-knowledge` PASS for all new tests.
  - `sdlc-knowledge search "<query>" --top-k 5 --json` returns valid JSON array length ≤ 5; latency ≤ 500 ms over the 10 000-chunk seeded fixture DB on CI per AC-5 / NFR-1.2.
  - `sdlc-knowledge list --json` returns `[{source_path, chunk_count, ingested_at}, …]`.
  - `sdlc-knowledge status --json` returns `{schema_version: 1, doc_count, chunk_count, db_path}`.
  - `sdlc-knowledge delete <source-id>` removes documents+chunks rows; FTS5 trigger fires; subsequent search excludes them.
  - **TC-AAI-2 BM25 score-direction:** JSON `score` field on every search hit is POSITIVE (`score > 0` for all hits), and the array is sorted with `score` non-strictly DESCENDING (larger = better); the documented convention (`SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC`) is asserted directly via the integration test reading the SQL string from `src/search.rs` AND via observing the JSON output. The convention will be re-stated in `src/rules/knowledge-base.md` (Slice 6) so agents read positive-score citations.
  - Truncating `index.db` to 100 bytes and running any read subcommand → exit 1, literal stderr `error: index database invalid; re-ingest required`, AND stderr free of `panicked at` per AC-7 / FR-1.6.
  - Empty-result query exits 0 with `[]` (or human-readable "no results") per FR-3.4.
- **Pre-review:** architect (rusqlite + FTS5 syntax verification per Open Question #5; BM25 score direction convention review per architect action item #3)

#### Slice 4: Cross-platform release pipeline (GitHub Actions) + RELEASING.md
- **Wave:** 4
- **UC-coverage:** UC-CC-1, UC-CC-5
- **TC-coverage:** TC-1.1, TC-CP-1, TC-CP-2, TC-CP-3, TC-3.5, TC-INV-7
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/.github/workflows/sdlc-knowledge-release.yml` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/tools/sdlc-knowledge/RELEASING.md` `[new]`
- **Changes:**
  - `.github/workflows/sdlc-knowledge-release.yml`: trigger on tag `sdlc-knowledge-v*`. Build matrix: `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), `ubuntu-22.04-arm` (linux-arm64). Steps per matrix job: checkout → rustup toolchain stable → `cargo build --release -p sdlc-knowledge` (with release profile flags `strip = true`, `lto = true`, `codegen-units = 1` already in Slice 1's `Cargo.toml`) → assert binary size ≤ 10 MB (per NFR-1.1) → upload artifact named `sdlc-knowledge-<platform>` to the release. `actionlint` job runs first and gates the matrix.
  - `RELEASING.md`: documents (a) tag scheme `sdlc-knowledge-v<X.Y.Z>` (independent from SDLC release tags); (b) **maintainer-only one-time bootstrap** procedure: cut the FIRST `sdlc-knowledge-v0.1.0` tag MANUALLY before the SDLC release that introduces this feature merges, so subsequent users of `install.sh` find a release to download (per FR-11.3 / AC-13); (c) version-bump rules (semver — minor for additive features, patch for bug-fixes); (d) artifact verification steps (sha256, size budget, smoke test `sdlc-knowledge --version`); (e) explicit note: this process is INDEPENDENT of `release-engineer` Gate 9 — Gate 9 is UNCHANGED in iter-1 per FR-12.4 / PRD §11.7 item 5.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  actionlint .github/workflows/sdlc-knowledge-release.yml   # expect 0 findings
  yamllint -d "{rules: {line-length: disable}}" .github/workflows/sdlc-knowledge-release.yml   # expect clean
  test -f tools/sdlc-knowledge/RELEASING.md
  grep -F "sdlc-knowledge-v0.1.0" tools/sdlc-knowledge/RELEASING.md   # ≥ 1
  grep -F "Gate 9 is UNCHANGED" tools/sdlc-knowledge/RELEASING.md     # ≥ 1
  ```
- **Done when:**
  - `actionlint .github/workflows/sdlc-knowledge-release.yml` PASS (0 findings).
  - Workflow file is syntactically valid YAML and uses the four pinned runner labels `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` verbatim.
  - Workflow declares the size assertion ≤ 10 MB per NFR-1.1 (grep for `10485760` or equivalent in workflow steps).
  - `RELEASING.md` documents (a) tag scheme, (b) one-time bootstrap of v0.1.0, (c) version-bump rules, (d) artifact verification, (e) Gate 9 invariance note (`grep -F "Gate 9"` returns ≥ 1 with `UNCHANGED` qualifier).
  - Slice contains zero touch of `install.sh`, `src/`, `templates/`, `README.md`, `docs/` (verified by `git diff --name-only` in the slice's commit being a subset of the two declared files).
- **Pre-review:** none (CI-only; build-runner verifies on push)

#### Slice 5: install.sh integration — binary download + Bash allowlist + project scaffold + cargo source-build fallback
- **Wave:** 4
- **UC-coverage:** UC-1, UC-1-A1, UC-1-E1, UC-1-E2, UC-1-EC1, UC-2, UC-2-A1, UC-2-E1, UC-3, UC-3-A1, UC-3-A2, UC-3-EC1, UC-4, UC-4-A1, UC-4-A2, UC-4-E1, UC-4-EC1, UC-15, UC-15-E1
- **TC-coverage:** TC-1.1, TC-1.2, TC-1.3, TC-1.4, TC-1.5, TC-2.1, TC-2.2, TC-2.3, TC-3.1, TC-3.2, TC-3.3, TC-3.4, TC-4.1, TC-4.2, TC-4.3, TC-4.5, TC-15.1, TC-15.2, TC-CP-1..4, TC-AAI-1 (install.sh ordering)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/install.sh` (Edit — add 3 functions, extend `scaffold_project`)
  - `/Users/aleksandra/Documents/claude-code-sdlc/templates/knowledge/.gitignore` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/templates/knowledge/.gitkeep` `[new]`
- **Changes:**
  - `install.sh` new function `install_knowledge_binary()`: detect `uname -ms`; map to one of `darwin-arm64`/`darwin-x64`/`linux-x64`/`linux-arm64` (else → log_warn graceful skip per FR-8.5 / TC-1.5). curl the matching artifact from `https://github.com/<owner>/<repo>/releases/download/sdlc-knowledge-v<latest>/sdlc-knowledge-<platform>`. mkdir `~/.claude/tools/sdlc-knowledge/`. Move artifact to `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`, `chmod +x`. Idempotent: if file exists and `--version` matches expected, return early (TC-1.2). On curl failure (404 — no release yet, or network failure): invoke `cargo_source_build_fallback` (FR-8.4).
  - `install.sh` new function `cargo_source_build_fallback()`: if `command -v cargo` succeeds AND the local checkout contains `tools/sdlc-knowledge/Cargo.toml`: run `cargo build --release -p sdlc-knowledge --manifest-path "$SCRIPT_DIR/tools/sdlc-knowledge/Cargo.toml"`; copy `$SCRIPT_DIR/tools/sdlc-knowledge/target/release/sdlc-knowledge` to `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`; `chmod +x`. Else (cargo absent OR no local checkout — piped curl install with no GH release yet): `log_warn "binary unavailable; install cargo or wait for first release"` and continue per FR-8.5 / AC-13 / TC-3.1.
  - `install.sh` new function `register_bash_allowlist()`: target file `~/.claude/settings.json`. **Per architect action item #2 — missing-file case:** if the file does NOT exist, CREATE it with content `{"permissions":{"allow":["~/.claude/tools/sdlc-knowledge/sdlc-knowledge *"]}}` and exit. If it exists: when `jq` is available, merge idempotently with `jq '.permissions.allow |= ((. // []) + ["~/.claude/tools/sdlc-knowledge/sdlc-knowledge *"] | unique)'` (preserves all other keys including pre-existing `enabledPlugins`/`theme`). When `jq` is absent, fall back to a heredoc-merge that reads existing JSON, parses with a minimal POSIX shell-safe approach, and writes back without duplicate entries (idempotent re-run). Per FR-8.3 / NFR-1.9 / AC-2 / TC-15.1 / TC-15.2 / UC-15-E1.
  - `install.sh` `scaffold_project` extension: copy `templates/knowledge/.gitignore` → `<cwd>/.claude/knowledge/.gitignore` via `cp` (consistent with line 254 pattern); mkdir `<cwd>/.claude/knowledge/sources`; copy `templates/knowledge/.gitkeep` → `<cwd>/.claude/knowledge/sources/.gitkeep`. Idempotent: if `.claude/knowledge/.gitignore` already exists with byte-identical content, no-op (TC-4.2); if user-modified, do NOT clobber (TC-4.3 — `cp -n` no-clobber semantics).
  - **CRITICAL — architect action item #1 — install.sh ordering:** Both `install_knowledge_binary` and `cargo_source_build_fallback` access `$SCRIPT_DIR/tools/sdlc-knowledge/` (the cargo fallback reads `Cargo.toml` from the local checkout). The pre-existing line-228 cleanup `rm -rf "$SCRIPT_DIR"` runs at the end of `install_user_config`. Implementation MUST satisfy ONE of: **(A)** invoke `install_knowledge_binary` (and its cargo fallback) BEFORE line 228 — i.e., from inside `install_user_config` before the cleanup block, OR **(B)** mirror the line-247 pattern from `scaffold_project`: at the top of `install_knowledge_binary`, check `if [ ! -d "$SCRIPT_DIR/tools/sdlc-knowledge" ]; then get_source_dir; fi` so the function recovers if `$SCRIPT_DIR` was already cleaned. Decision: **adopt option (B)** (re-invoke `get_source_dir`) — strictly additive change, no risk of disturbing the existing line-228 cleanup ordering.
  - `templates/knowledge/.gitignore`: literal content `sources/\nindex.db\nindex.db-shm\nindex.db-wal\n` (one entry per line, trailing newline) per FR-9.1 / AC-3.
  - `templates/knowledge/.gitkeep`: empty file (placeholder so the `sources/` directory exists in the scaffold even when no documents are present).
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  shellcheck install.sh   # expect no new SC errors introduced
  bash -n install.sh      # syntax check
  # Dry-run on a clean target
  rm -rf /tmp/sdlc-knowledge-target ~/.claude/tools/sdlc-knowledge.test
  HOME=/tmp/sdlc-test-home bash install.sh --yes --local 2>&1 | tee /tmp/install-log.txt
  test -x /tmp/sdlc-test-home/.claude/tools/sdlc-knowledge/sdlc-knowledge   # OR cargo fallback OR log_warn
  jq '.permissions.allow[]' /tmp/sdlc-test-home/.claude/settings.json | grep -F "sdlc-knowledge"   # AC-2
  # Re-run is idempotent
  HOME=/tmp/sdlc-test-home bash install.sh --yes --local 2>&1 | grep -F "already at expected version"
  jq '.permissions.allow | length' /tmp/sdlc-test-home/.claude/settings.json   # ≥ 1, no duplicate
  # Project scaffold
  cd /tmp && rm -rf p1 && mkdir p1 && cd p1
  bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --init-project --yes
  test -f .claude/knowledge/.gitignore && diff .claude/knowledge/.gitignore /Users/aleksandra/Documents/claude-code-sdlc/templates/knowledge/.gitignore   # byte-identical
  test -d .claude/knowledge/sources
  ```
- **Done when:**
  - `bash install.sh --yes` on a clean machine produces `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0 within 60 s when a release artifact exists (AC-1) OR cargo-source-built artifact when `cargo` is on PATH and no release exists (FR-8.4 / AC-13 fallback) OR a literal `log_warn "binary unavailable; install cargo or wait for first release"` when neither applies (FR-8.5).
  - **Architect action item #1 ordering:** `install_knowledge_binary` re-invokes `get_source_dir` if `$SCRIPT_DIR/tools/sdlc-knowledge` is missing (mirror of the line-247 `scaffold_project` pattern) — verified by reading the function body and confirming the guard appears BEFORE any access to `$SCRIPT_DIR/tools/sdlc-knowledge/`. The line-228 cleanup is NOT moved.
  - **Architect action item #2 missing-file case:** when `~/.claude/settings.json` does NOT exist, `register_bash_allowlist` CREATES it with literal content `{"permissions":{"allow":["~/.claude/tools/sdlc-knowledge/sdlc-knowledge *"]}}` (verified by integration test that `rm`s the file and re-runs install). When the file exists, the merge is idempotent: re-running install MUST NOT duplicate the entry — `jq '.permissions.allow | map(select(. == "~/.claude/tools/sdlc-knowledge/sdlc-knowledge *")) | length'` returns exactly 1 after N re-runs. Pre-existing keys (`enabledPlugins`, `theme`) are preserved (`jq '.enabledPlugins' ` returns the same array before and after).
  - **Cargo source-build fallback:** the function detects `command -v cargo` AND `$SCRIPT_DIR/tools/sdlc-knowledge/Cargo.toml` existence; on success, builds and copies to global path; produced binary `--version` exits 0. Failure paths log clear messages and proceed.
  - `bash install.sh --init-project` creates `<cwd>/.claude/knowledge/.gitignore` byte-identical to `templates/knowledge/.gitignore` (verified by `diff` exit 0) and `<cwd>/.claude/knowledge/sources/.gitkeep` (per AC-3 / TC-4.1). Re-running on existing scaffold is a no-op (TC-4.2).
  - `install.sh` `VERSION` constant on line 22 is UNCHANGED in this slice's commit (`git diff install.sh | grep -E '^[-+]VERSION='` returns empty per FR-8.7).
- **Pre-review:** **security-auditor** (Bash allowlist scope is the literal binary path; download URL points only to the project's GitHub releases; JSON-merge does not corrupt unrelated keys; cargo fallback executes only when explicitly opted-in or release-download fails; missing-file case creates JSON with safe minimal content; no shell injection via `uname -ms` or curl-fetched filenames; verified literal stderr message `binary unavailable; install cargo or wait for first release`)

#### Slice 6: New rule `src/rules/knowledge-base.md` — CLI usage docs + pdf-extract limitations
- **Wave:** 4
- **UC-coverage:** UC-7, UC-7-EC2 (default tokenizer), UC-11, UC-11-E1, UC-12, UC-13, UC-14
- **TC-coverage:** TC-INV-1, TC-INV-2, TC-12.1, TC-AAI-5 (pdf-extract limitations: scanned PDFs, multi-column, form fields)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/rules/knowledge-base.md` `[new]`
- **Changes:**
  - File ≤ 200 lines (per FR-7.1) with the following 7 sections in order:
    1. `## When to query` — invoke BEFORE authoring domain-bearing content.
    2. `## CLI invocation contract` — lists ALL 5 subcommands verbatim with sample invocations: `sdlc-knowledge ingest <path> [--project-root <dir>] [--json]`, `sdlc-knowledge search <query> [--top-k 5] [--project-root <dir>] [--json]`, `sdlc-knowledge list [--project-root <dir>] [--json]`, `sdlc-knowledge status [--project-root <dir>] [--json]`, `sdlc-knowledge delete <source-id> [--project-root <dir>] [--json]`.
    3. `## Citation format` — literal `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes`. Documents the BM25 score-direction convention per architect action item #3: the JSON `score` field is positive with larger-is-better; agents cite the positive form.
    4. `## Activation sentinel` — `<project>/.claude/knowledge/index.db` exists ⇒ activated. Absent ⇒ no-op.
    5. `## Fallback behavior` — three fallback paths: (a) binary absent → log `knowledge-base: tool not installed; skipping` and proceed without citation; (b) index absent → no-op (no log); (c) corrupt index → exit 1 with `error: index database invalid; re-ingest required`; agent surfaces as Open Question.
    6. `## Application Scope` — explicit list of 12 in-scope agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`) and 5 exempt executors (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`).
    7. **`## Known limitations of `pdf-extract` (architect action item #6)** — per architect action item #6 / TC-AAI-5: explicitly enumerate and document the pdf-extract crate's known limitations: (i) scanned PDFs (image-only PDFs without an embedded text layer) yield empty or garbage text — recommend OCR pre-processing as out-of-scope; (ii) multi-column layouts may produce text in reading-order errors; (iii) form fields and annotations are not extracted; (iv) password-protected PDFs return errors. Document the iter-2 fallback (`lopdf` for low-level access; system `pdftotext` for highest fidelity); state that affected documents should be pre-processed (Pandoc to text, OCR, copy-paste) before ingest.
    8. `## Facts` — per cognitive-self-check rule schema: `### Verified facts` (citing PRD §11 / FR-7 line numbers); `### External contracts` (rusqlite, pdf-extract, FTS5 bm25 with negation convention — each `verified: no — assumption` with verification path); `### Assumptions` (chunk-id semantics, citation format expansion); `### Open questions` `(none)`.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  test -f src/rules/knowledge-base.md
  wc -l src/rules/knowledge-base.md   # ≤ 200
  grep -Ec "^## " src/rules/knowledge-base.md   # 8 (When/CLI/Citation/Sentinel/Fallback/Scope/Limitations/Facts)
  grep -Fc "sdlc-knowledge ingest" src/rules/knowledge-base.md   # ≥ 1
  grep -Fc "sdlc-knowledge search" src/rules/knowledge-base.md   # ≥ 1
  grep -Fc "sdlc-knowledge list" src/rules/knowledge-base.md     # ≥ 1
  grep -Fc "sdlc-knowledge status" src/rules/knowledge-base.md   # ≥ 1
  grep -Fc "sdlc-knowledge delete" src/rules/knowledge-base.md   # ≥ 1
  for ag in prd-writer ba-analyst architect qa-planner planner security-auditor code-reviewer verifier refactor-cleaner resource-architect role-planner release-engineer; do
    grep -Fq "$ag" src/rules/knowledge-base.md || echo "MISSING $ag"
  done
  for ex in test-writer build-runner e2e-runner doc-updater changelog-writer; do
    grep -Fq "$ex" src/rules/knowledge-base.md || echo "MISSING $ex"
  done
  grep -Fc "scanned" src/rules/knowledge-base.md       # ≥ 1 (TC-AAI-5)
  grep -Fc "multi-column" src/rules/knowledge-base.md  # ≥ 1 (TC-AAI-5)
  grep -Fc "form fields" src/rules/knowledge-base.md   # ≥ 1 (TC-AAI-5)
  grep -Fc "## Facts" src/rules/knowledge-base.md      # 1
  ```
- **Done when:**
  - File exists, ≤ 200 lines, contains the 8 listed `##` sections (one of which is the architect-action-item #6 Known-limitations section).
  - All 5 CLI subcommands appear verbatim (each `grep -F "sdlc-knowledge <subcmd>"` returns ≥ 1).
  - 12 in-scope agent slugs and 5 exempt executor slugs ALL present (per-slug `grep -F` returns ≥ 1).
  - The literal citation-format string `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` appears at least once verbatim.
  - **TC-AAI-5 pdf-extract limitations:** the file explicitly mentions all 3 categories — scanned PDFs (`grep -Fc scanned ≥ 1`), multi-column (`grep -Fc multi-column ≥ 1`), form fields (`grep -Fc "form fields" ≥ 1`) — with at least 2 lines of context per category.
  - `## Facts` block has all 4 subsections (`### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`), each populated with content or the literal `(none)` placeholder.
  - The cognitive-self-check rule reference path `~/.claude/rules/cognitive-self-check.md` is referenced at least once.
- **Pre-review:** architect (rule wording stability — quoted by 12 agent prompts in Wave 5; ensures the Citation format and BM25 score-direction convention exposed to agents are correct)

#### Slice 7a: Doc-writing thinking agents — append `## Knowledge Base (when present)` activation block
- **Wave:** 5
- **UC-coverage:** UC-11, UC-11-E1, UC-12, UC-13, UC-14
- **TC-coverage:** TC-11.1, TC-11.2, TC-12.1, TC-13.1, TC-14.1, TC-INV-3, TC-INV-4
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/ba-analyst.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/qa-planner.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` (Edit — append section)
- **Changes:** Edit-only (preserves existing whitespace and frontmatter). Append a new `## Knowledge Base (when present)` section at end of each file (~25 lines). Per FR-5.2, each section: (a) references rule path `~/.claude/rules/knowledge-base.md`, (b) states query-before-author rule when `<project>/.claude/knowledge/index.db` exists, (c) includes literal CLI invocation `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json`, (d) specifies citation lands under `## Facts → ### External contracts` with `knowledge-base:` source prefix per FR-7.1. Per-agent specialization:
  - `prd-writer` — query before authoring Functional Requirements that touch domain semantics.
  - `ba-analyst` — query before authoring use-case scenarios that depend on domain workflows.
  - `qa-planner` — query before authoring test cases that depend on domain edge cases.
  - `planner` — query before assigning slice scope when the slice depends on domain decisions.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  for f in src/agents/{prd-writer,ba-analyst,qa-planner,planner}.md; do
    grep -Fxc "## Knowledge Base (when present)" "$f"            # 1
    grep -Fc "~/.claude/rules/knowledge-base.md" "$f"             # ≥ 1
    grep -Fc "~/.claude/tools/sdlc-knowledge/sdlc-knowledge search" "$f"   # ≥ 1
    grep -Fc "knowledge-base:" "$f"                               # ≥ 1
  done
  ls src/agents/*.md | wc -l   # 17 (invariant)
  ```
- **Done when:**
  - All 4 files have exactly 1 `## Knowledge Base (when present)` heading (`grep -Fxc` = 1 each).
  - All 4 files reference the rule path `~/.claude/rules/knowledge-base.md` (≥ 1 each).
  - All 4 files include the literal CLI invocation string `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search` (≥ 1 each).
  - All 4 files include the `knowledge-base:` citation prefix string (≥ 1 each).
  - `ls src/agents/*.md | wc -l` is still 17 per FR-12.1 / AC-11.
  - The 5 executor agent files are byte-unchanged this slice (slice's `git diff --name-only` is exactly the 4 files above).
- **Pre-review:** none

#### Slice 7b: Stdout reviewer thinking agents — append activation block
- **Wave:** 5
- **UC-coverage:** UC-11, UC-12, UC-13, UC-14
- **TC-coverage:** TC-11.1, TC-12.1, TC-INV-3, TC-INV-4
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/architect.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/security-auditor.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/code-reviewer.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/verifier.md` (Edit — append section)
- **Changes:** Same shape as Slice 7a. Per-agent specialization: each instructs querying knowledge base BEFORE rendering the verdict; citations land in stdout `## Facts → ### External contracts` block (these agents emit `## Facts` to stdout per cognitive-self-check rule).
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  for f in src/agents/{architect,security-auditor,code-reviewer,verifier}.md; do
    grep -Fxc "## Knowledge Base (when present)" "$f"            # 1
    grep -Fc "~/.claude/rules/knowledge-base.md" "$f"             # ≥ 1
    grep -Fc "~/.claude/tools/sdlc-knowledge/sdlc-knowledge search" "$f"   # ≥ 1
  done
  ```
- **Done when:** Same as Slice 7a — 4 files, 1 section each, 12 grep checks pass.
- **Pre-review:** none

#### Slice 7c: Specialized + refactor-cleaner thinking agents — append activation block
- **Wave:** 5
- **UC-coverage:** UC-11, UC-12, UC-13, UC-14
- **TC-coverage:** TC-11.1, TC-12.1, TC-INV-3, TC-INV-4, TC-INV-5 (resource-architect auto-recommend OUT OF SCOPE in iter-1)
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` (Edit — append section)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` (Edit — append section; Gate 9 logic UNCHANGED per FR-12.4)
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/refactor-cleaner.md` (Edit — append section)
- **Changes:** Same shape as Slice 7a/7b. **Iter-1 scope:** activation block ONLY. `resource-architect` auto-recommend behavior on detecting domain PDFs is OUT OF SCOPE per PRD §11.7 item 3 — verified by grep that no new "auto-recommend" or "knowledge ingest detection" logic is added to `resource-architect.md`. `release-engineer.md` Gate 9 logic UNCHANGED per FR-12.4 — verified by grepping the file's Gate-9 section is byte-equivalent before and after the slice except for the appended activation block.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  for f in src/agents/{resource-architect,role-planner,release-engineer,refactor-cleaner}.md; do
    grep -Fxc "## Knowledge Base (when present)" "$f"            # 1
    grep -Fc "~/.claude/rules/knowledge-base.md" "$f"             # ≥ 1
    grep -Fc "~/.claude/tools/sdlc-knowledge/sdlc-knowledge search" "$f"   # ≥ 1
  done
  # Resource-architect auto-recommend MUST NOT be added in iter-1
  grep -Ec "auto[- ]recommend.*knowledge" src/agents/resource-architect.md   # 0 (no new logic)
  # Release-engineer Gate 9 logic must remain present and unchanged in shape
  grep -Fc "Gate 9" src/agents/release-engineer.md   # ≥ 1 (Gate 9 still referenced)
  ```
- **Done when:**
  - All 4 files have exactly 1 `## Knowledge Base (when present)` heading; rule-path and CLI invocation references present (12 grep checks pass).
  - `resource-architect.md` has NO new "auto-recommend" logic (`grep -Ec "auto[- ]recommend.*knowledge"` returns 0). The activation block is the ONLY change.
  - `release-engineer.md` Gate 9 release-packaging logic is unchanged (the section's pre-existing content is preserved verbatim; only the activation block is appended).
- **Pre-review:** none

#### Slice 8: `/knowledge-ingest` slash command + README updates
- **Wave:** 5
- **UC-coverage:** UC-5, UC-5-A1, UC-5-A2, UC-5-A3 (binary absent), UC-5-E1, UC-CC-3 (commands count 5 → 6)
- **TC-coverage:** TC-5.1, TC-5.2, TC-5.3, TC-5.4, TC-5.5, TC-INV-6 (commands count = 6), TC-CC-3
- **Files:**
  - `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/knowledge-ingest.md` `[new]`
  - `/Users/aleksandra/Documents/claude-code-sdlc/README.md` (Edit — Hardening table row, Commands table row, new top-level section)
- **Changes:**
  - `src/commands/knowledge-ingest.md`: slash command spec — required argument `<path>` (file or directory). Action: run `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest <path> --json`; stream per-file JSON output to chat as ingestion progresses; final summary line with chunk count and source count parsed from binary output. When binary is absent (file at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does not exist or is not executable): emit literal user-facing message containing `bash install.sh --yes` and exit without error per FR-6.3.
  - `README.md` Hardening table: append ONE new row at the end of the existing table (before the closing `---`): `| Agents lack project-specific domain knowledge | Local FTS5 knowledge base via \`sdlc-knowledge\` CLI; agents query before authoring; cite hits in \`## Facts\` |`.
  - `README.md` Commands table: append ONE new row: `| /knowledge-ingest | Ingest a folder/file into the per-project knowledge base |`.
  - `README.md` new top-level `## Local knowledge base` section: place AFTER the `## Cognitive self-check at authoring time` section (or equivalent existing section) and BEFORE the next major section. 2–3 paragraphs explaining (a) global tool location `~/.claude/tools/sdlc-knowledge/`, (b) per-project data location `<project>/.claude/knowledge/`, (c) CLI subcommands and the `/knowledge-ingest` slash entry point, (d) activation contract (sentinel = `index.db` existence), (e) integration with cognitive-self-check (`knowledge-base:` citations slot into `### External contracts`).
  - **Invariants enforced this slice:** README line 5 (`17 specialized AI agents.` tagline) BYTE-UNCHANGED; README line 35 (`10 quality gates`) BYTE-UNCHANGED per FR-12.1 / FR-12.2 / AC-11. Verified by `git diff README.md` showing zero changes on lines 5 and 35.
- **Verify:**
  ```bash
  cd /Users/aleksandra/Documents/claude-code-sdlc
  test -f src/commands/knowledge-ingest.md
  ls src/commands/*.md | wc -l   # 6 per AC-12
  grep -Fc "sdlc-knowledge ingest" src/commands/knowledge-ingest.md          # ≥ 1
  grep -Fc "bash install.sh --yes" src/commands/knowledge-ingest.md         # ≥ 1 per FR-6.3
  grep -Fxc "## Local knowledge base" README.md                              # 1
  grep -Ec "^\| /knowledge-ingest \|" README.md                              # 1 (new commands row)
  grep -Ec "^\| Agents lack project-specific domain knowledge \|" README.md  # 1 (new hardening row)
  # Invariants: lines 5 and 35 BYTE-UNCHANGED
  diff <(git show HEAD:README.md | sed -n '5p') <(sed -n '5p' README.md)     # empty diff
  diff <(git show HEAD:README.md | sed -n '35p') <(sed -n '35p' README.md)   # empty diff
  ```
- **Done when:**
  - `src/commands/knowledge-ingest.md` exists and contains the literal `sdlc-knowledge ingest` and the FR-6.3 binary-absent message including `bash install.sh --yes`.
  - `ls src/commands/*.md | wc -l` returns 6 per AC-12 / FR-6.4.
  - README contains the literal section header `## Local knowledge base` (`grep -Fxc` = 1).
  - README new Hardening row matches `^\| Agents lack project-specific domain knowledge \|` and new Commands row matches `^\| /knowledge-ingest \|`.
  - README line 5 (`17 specialized AI agents.` tagline) and line 35 (`10 quality gates`) are BYTE-UNCHANGED vs `git show HEAD:README.md` (`diff` empty for both lines per AC-11 / FR-12.1 / FR-12.2).
- **Pre-review:** none

## Wave summary

| Wave | Slices | Files (count) | Rationale |
|------|--------|---------------|-----------|
| 1    | 1      | 5  | Sequential foundation — Cargo.toml + main.rs + cli.rs + tests establish the full subcommand surface so Waves 2/3 can Edit-only main.rs without collisions. Path-canonicalization is the security backbone every later slice depends on. |
| 2    | 2      | 12 | Sequential — depends on Wave 1's CLI scaffolding. Adds chunker, format readers, store schema, and replaces the `Ingest` placeholder body in main.rs. |
| 3    | 3      | 7  | Sequential — depends on Wave 2's store. Adds search/list/status/delete and corrupt-index handling; replaces the 4 remaining placeholder bodies in main.rs. |
| 4    | 4, 5, 6 | 2 + 3 + 1 = 6 | Parallel — Slice 4 (CI workflow + RELEASING.md) and Slice 5 (install.sh + templates/knowledge/.gitignore + .gitkeep) and Slice 6 (src/rules/knowledge-base.md) touch DISJOINT files: zero intersection across `{.github/workflows/sdlc-knowledge-release.yml, tools/sdlc-knowledge/RELEASING.md}` ∩ `{install.sh, templates/knowledge/.gitignore, templates/knowledge/.gitkeep}` ∩ `{src/rules/knowledge-base.md}` = ∅. |
| 5    | 7a, 7b, 7c, 8 | 4 + 4 + 4 + 2 = 14 | Parallel — Slice 7a (4 doc-writing agents), Slice 7b (4 reviewer agents), Slice 7c (4 specialized agents) — all 12 agent files DISJOINT, plus Slice 8 (src/commands/knowledge-ingest.md + README.md) DISJOINT from all 12 agent files. Zero in-wave intersection. |

**Wave-disjointness audit (mechanical check):** Wave 4 file lists `{`.github/workflows/sdlc-knowledge-release.yml`, `tools/sdlc-knowledge/RELEASING.md`} ∪ {`install.sh`, `templates/knowledge/.gitignore`, `templates/knowledge/.gitkeep`} ∪ {`src/rules/knowledge-base.md`} have pairwise empty intersection — confirmed. Wave 5 the 12 distinct `src/agents/<slug>.md` files plus `src/commands/knowledge-ingest.md` and `README.md` have pairwise empty intersection — confirmed (no slice writes to two of these from different sub-slice pieces).

## Risk assessment

(Condensed from the design plan's 13 risks; the 3 architect MINOR refinements are now inlined into Slice 5 done-conditions per the architect's PASS verdict.)

1. **Cross-platform Rust builds** — `macos-14`/`macos-13`/`ubuntu-latest`/`ubuntu-22.04-arm` GA on GHA as of 2026-04. Mitigation: pin labels in Slice 4; `actionlint` catches typos. Windows DEFERRED to iter-2.
2. **PDF extraction quality** — `pdf-extract` (pure Rust, ~2 MB) selected for iter-1 per architect verdict; `lopdf` documented fallback. Slice 6 enumerates pdf-extract limitations (scanned, multi-column, form fields) per architect action item #6 / TC-AAI-5.
3. **Binary size budget (NFR-1.1 < 10 MB)** — rusqlite-bundled ~3 MB + pdf-extract ~2 MB + clap+serde+sha2 ~1 MB ≈ 6–8 MB after `strip + lto + codegen-units = 1`. Verified at Slice 4 release dry-run.
4. **Bash allowlist scope** — single literal entry `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *`; binary itself enforces project-root canonicalization (Slice 1 + AC-6); `..`/symlink/absolute-outside-cwd rejected with exit 2. Security-auditor pre-reviews Slice 1 AND Slice 5.
5. **Agent prompt bloat** — 12 agents grow ~25 lines each; rule body lives in `src/rules/knowledge-base.md` so per-agent activation block stays a short pointer.
6. **Plan Critic interaction** — `knowledge-base:` is an additive convention; existing `### External contracts` heuristic covers it; FR-10.3 keeps Plan Critic in `src/claude.md` UNCHANGED.
7. **Version baseline divergence** — pre-existing `install.sh` line 22 `VERSION="2.1.0"` vs README badge `version-3.1.0`. FR-8.7 keeps `install.sh` `VERSION` UNCHANGED in this section's commits; release-engineer Gate 9 reconciles separately.
8. **First-release chicken-and-egg** — Slice 5's cargo source-build fallback (FR-8.4) handles the period between merge and the maintainer's first `sdlc-knowledge-v0.1.0` tag (FR-11.3 / AC-13). When neither release nor cargo: literal `binary unavailable; install cargo or wait for first release` warning and graceful skip.
9. **Re-indexing on file changes** — sha256+mtime idempotency in Slice 2; renamed-file re-chunk is acceptable iter-1 cost.
10. **Concurrent index access** — SQLite WAL (NFR-1.6); per-document `BEGIN IMMEDIATE` in Slice 2 (≤ 50 ms per 50-chunk doc) allows search interleaving on long full-corpus ingests.
11. **Scope creep** — vectors/MCP/auto-recommendation/Windows/release-engineer-coupling explicitly OUT OF SCOPE per PRD §11.7. FR-4.3 reserves `chunks.embedding BLOB` for iter-2 hybrid without destructive migration.
12. **First-release tag scheme & release-engineer invariant** — Gate 9 UNCHANGED iter-1; maintainer cuts `sdlc-knowledge-v<X.Y.Z>` ad-hoc per Slice 4's `RELEASING.md`.
13. **Wave file disjointness** — verified above in Wave summary; macOS case-insensitive filesystem: every path uses lowercase basenames, no case-collision risk.

**Architect MINOR refinements inlined:** (a) Slice 5 ordering uses re-invoked `get_source_dir` pattern (architect action item #1); (b) Slice 5 missing-file allowlist creation handles the `~/.claude/settings.json` non-existent case (architect action item #2); (c) Slice 5 cargo source-build fallback verified end-to-end with `cargo` on PATH (architect action item, plus FR-8.4 / AC-13).

## Dependencies

Invariants restated (Plan Critic load-bearing):
- 17 core agents — UNCHANGED (no new agent).
- 10 quality gates — UNCHANGED (no new gate).
- Commands count: 5 → 6 (`knowledge-ingest` added).
- 5 executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) — BYTE-UNCHANGED (zero diff vs main per FR-5.4 / FR-12.3 / AC-11).
- 4 pre-existing template surfaces (`templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*`) — BYTE-UNCHANGED. Only template addition: `templates/knowledge/`.
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED (FR-10.4 / FR-12.5). The `knowledge-base:` source prefix is an additive citation convention.
- `src/claude.md` Plan Critic — UNCHANGED (FR-10.3). Existing `### External contracts` heuristic covers the new prefix.
- README lines 5 (`17 specialized AI agents.`) and 35 (`10 quality gates`) — BYTE-UNCHANGED (FR-12.1 / FR-12.2 / AC-11).

External-contract verification dependencies (from `## Facts → ### External contracts`):
- rusqlite + FTS5 syntax: architect Step 3 RESOLVED before Slice 3 ships.
- `pdf-extract` selection: architect Step 3 RESOLVED before Slice 2 ships (`pdf-extract` chosen, `lopdf` documented fallback).
- BM25 score-direction convention: architect action item #3 RESOLVED — implementation uses `SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC` so JSON `score` is positive larger-better; documented in Slice 6 rule.
- GitHub Actions runner labels (`macos-14`/`macos-13`/`ubuntu-latest`/`ubuntu-22.04-arm`): pinned at Slice 4; `actionlint` gates the workflow.
- `actionlint`, `assert_cmd`, `predicates`, `clap` v4.x: caught at first `cargo build` / `cargo test` / `actionlint` invocation.

## Review Notes

### Critic Findings
- **Total**: 0 findings — n/a (the design plan at `~/.claude/plans/fuzzy-juggling-ocean.md` was already cleaned by Plan Critic; this is the executable refinement that inlines the architect's 5 PASS-verdict action items into the slice done-conditions).

### Changes Made
- Inlined architect action item #1 (install.sh ordering — re-invoke `get_source_dir` pattern) into Slice 5 changes and done-conditions.
- Inlined architect action item #2 (`register_bash_allowlist` missing-file case creates `~/.claude/settings.json` with literal minimal JSON `{"permissions":{"allow":["~/.claude/tools/sdlc-knowledge/sdlc-knowledge *"]}}`; idempotent merge when present) into Slice 5.
- Inlined architect action item #3 (BM25 score-direction = `SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC` so JSON `score` is positive larger-better) into Slice 3 SQL implementation and done-condition with TC-AAI-2 assertion; documented in Slice 6 rule.
- Inlined architect action item #4 (UPGRADE Slice 1 Pre-review from `none` to `security-auditor`) — `resolve_project_root` is the security backbone.
- Inlined architect action item #5 (UPGRADE Slice 2 Pre-review from `architect` to `architect + security-auditor`) — PDF crate selection + per-document transactionality both load-bearing.
- Inlined architect action item #6 (Slice 6 rule explicitly documents `pdf-extract` limitations: scanned PDFs, multi-column, form fields) — added a dedicated `## Known limitations of pdf-extract` section to `src/rules/knowledge-base.md` and 3 grep-asserted keywords in the done-condition matching TC-AAI-5.
- Inlined Slice 1's path-canonicalization 4 subcases (`..`-traversal, symlink escape, absolute path outside cwd, cwd-itself-is-symlink) per TC-AAI-3 into the done-condition.
- Inlined Slice 2's batch-with-corrupt-PDF transactionality test per TC-AAI-4 into the done-condition.

### Acknowledged Minor Issues
- None outstanding. All 5 architect action items addressed; all done-conditions are mechanically testable; all file paths verified via Read/Glob this session.
