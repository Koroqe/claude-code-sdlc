# Test Cases: Local Knowledge Base for SDLC Agents

> Based on [PRD](../PRD.md) -- Section 11 and [Use Cases](../use-cases/local-knowledge-base_use_cases.md)

## Facts

### Verified facts

- The PRD Section 11 (Local Knowledge Base for SDLC Agents) spans `docs/PRD.md` lines 2337-2693 with eight numbered subsections (11.1 through 11.8) and a terminal `## Facts` block at lines 2655-2693 -- verified by Read of `docs/PRD.md` lines 2337-2693 in the current session.
- The 13 acceptance criteria AC-1 through AC-13 are documented at PRD §11.5 lines 2514-2526 -- verified by Read in the current session.
- The 12 functional-requirement groups FR-1 through FR-12 with 51 sub-clauses are documented at PRD §11.3 lines 2374-2497 -- verified by Read in the current session.
- The use-cases file `docs/use-cases/local-knowledge-base_use_cases.md` documents 15 primary UCs (UC-1 through UC-15) plus 5 cross-cutting UCs (UC-CC-1 through UC-CC-5), each with primary flow / alternative flows / error flows / edge cases / data requirements / mapped FR / mapped AC sections -- verified by Read of the use-cases file lines 1-1660 in the current session.
- The 12 in-scope thinking agents enumerated at FR-5.1 (line 2430) are exactly: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer` -- verified by Read in the current session.
- The 5 exempt executor agents enumerated at FR-5.4 (line 2433) are: `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer` -- verified by Read in the current session.
- The activation sentinel for agent behavior is the existence of the file `<project>/.claude/knowledge/index.db` per FR-10.1 (line 2476) -- verified by Read in the current session.
- The literal Bash allowlist entry value is `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` per FR-8.3 / NFR-1.9 / AC-2 -- verified by Read in the current session.
- The literal stderr message for project-root traversal rejection is `error: project-root must resolve under current working directory` per FR-1.5 / AC-6 -- verified by Read in the current session.
- The literal stderr message for corrupt-index handling is `error: index database invalid; re-ingest required` per FR-1.6 / AC-7 -- verified by Read in the current session.
- The literal skip line emitted by agents when binary is absent is `knowledge-base: tool not installed; skipping` per FR-5.5 / AC-9 -- verified by Read in the current session.
- The literal install-warning when neither binary release nor cargo are available is `binary unavailable; install cargo or wait for first release` per FR-8.5 / AC-13 -- verified by Read in the current session.
- The literal citation format per FR-7.1 / AC-10 is `knowledge-base: <source-filename>:<chunk-id> -- query: "<query>" -- BM25: <score> -- verified: yes` -- verified by Read in the current session.
- The four iter-1 supported platforms are darwin-arm64, darwin-x64, linux-x64, linux-arm64; Windows is OUT OF SCOPE per 11.7 item 4 -- verified by Read in the current session.
- The three iter-1 supported file extensions are `.md`, `.txt`, `.pdf` per FR-2.1 -- verified by Read in the current session.
- The schema in iter-1 includes exactly four tables: `documents`, `chunks`, `chunks_fts` (FTS5 virtual), `schema_version` per FR-4.2 -- verified by Read in the current session.
- The cognitive-self-check rule file `src/rules/cognitive-self-check.md` MUST be BYTE-UNCHANGED per FR-10.4 / FR-12.5 -- verified by Read in the current session.
- The 5 executor agent prompt files MUST be BYTE-UNCHANGED for this section's commits per FR-12.3 -- verified by Read in the current session.
- The four pre-existing template surfaces (`templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*`) MUST be UNCHANGED per FR-9.2; the ONLY template addition is the new `templates/knowledge/` directory -- verified by Read in the current session.
- The README tagline at line 5 (`17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.`) and the phrase `10 quality gates` at line 35 MUST be BYTE-UNCHANGED per FR-12.1 / FR-12.2 / AC-11 -- verified by Read in the current session.
- The total agent count remains 17 per FR-12.1 / AC-11; the total `/merge-ready` gate count remains 10 per FR-12.2 / AC-11 -- verified by Read in the current session.
- After this section ships, `ls src/commands/*.md | wc -l` MUST return 6 (was 5) per FR-6.4 / AC-12 -- verified by Read in the current session.
- The format-reference test-case file `docs/qa/cognitive-self-check_test_cases.md` establishes conventions: top-level `## Facts` block with the four-subsection schema, `## Use Case Coverage` table, `## Acceptance Criteria Coverage` table, numbered `## N. <Functional Area>` sections, individual TCs with **Category** / **Mapped UC** / **Mapped AC** / **Type** / **Severity** / **Preconditions** / **Inputs** / **Steps** / **Expected Result** / **Pass Criteria** structure, and dedicated `## Invariant Test Cases` and architect-action-item sections -- verified by Read of the format-reference file lines 1-300 in the current session.
- The 5 architect action items mandated by the user task each map to a dedicated TC: install.sh ordering (TC-AAI-1), BM25 score-direction documentation (TC-AAI-2), Slice 1 path canonicalization (TC-AAI-3), Slice 2 PDF transactionality (TC-AAI-4), Slice 6 rule documents pdf-extract limitations (TC-AAI-5) -- mapping derived from the architect's PASS verdict described in the user task this session.
- `docs/qa/local-knowledge-base_test_cases.md` is a NEW QA test-cases file (CREATE, not UPDATE) -- verified because no existing file in `docs/qa/` covers the local-knowledge-base domain (the directory's pre-existing format reference `cognitive-self-check_test_cases.md` and other prior-feature files do not overlap with this feature).

### External contracts

- **`rusqlite` crate (Rust SQLite binding) -- symbols: `rusqlite::Connection::open_with_flags`, `Connection::execute_batch`, `Connection::prepare`; SQLite FTS5 virtual-table syntax `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')`; ranking function `bm25(chunks_fts)`** -- source: rusqlite docs https://docs.rs/rusqlite/ + SQLite FTS5 docs https://www.sqlite.org/fts5.html -- verified: **no -- assumption** (inherited verbatim from PRD §11 `## Facts` `### External contracts`; this QA document does not independently re-open the docs in this session). Risk: API drift between rusqlite major versions; FTS5 column-weight argument ordering not confirmed. Verification path: architect Step 3 review BEFORE Slice 3 ships per Open Question #2 in the use-cases file's `## Facts`.
- **`pdf-extract` crate -- symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>`** -- source: https://crates.io/crates/pdf-extract -- verified: **no -- assumption** (inherited from PRD §11 `## Facts`). Risk: extraction quality on multi-column / scanned PDFs; default iter-1 choice. Verification path: architect Step 3 picks one (`pdf-extract` vs `lopdf`) with cited rationale BEFORE Slice 2 ships (Open Question #1). TC-AAI-5 verifies that `src/rules/knowledge-base.md` documents the chosen crate's known limitations.
- **`clap` crate v4.x -- symbols: `clap::Parser` derive macro, `#[command(subcommand)]`, `clap::Subcommand`** -- source: https://docs.rs/clap/4 -- verified: **no -- assumption** (inherited from PRD §11 `## Facts`). Risk: minor wording drift between 4.x patch versions. Verification path: any `cargo build` failure in Slice 1 reveals API mismatches immediately.
- **GitHub Actions runner labels for the four-platform build matrix -- `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), `ubuntu-22.04-arm` (linux-arm64)** -- source: https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners -- verified: **no -- assumption** (inherited from PRD §11 `## Facts`). Risk: ARM-Linux label rename. Verification path: pin labels at Slice 4 implementation; `actionlint` in workflow done-condition catches typos.
- **SQLite `bm25()` ranking function -- symbol: `bm25(fts_table_name [, weight1, weight2, ...])`** -- source: https://www.sqlite.org/fts5.html#the_bm25_function -- verified: **no -- assumption** (inherited from PRD §11 `## Facts`). Risk: column-weight argument ordering; convention that lower scores = better matches not verified in current session. Verification path: TC-AAI-2 verifies the implementation orders search results best-first regardless of internal score sign; architect Step 3 confirms convention BEFORE Slice 3 ships.
- **`assert_cmd` and `predicates` test crates -- symbols: `assert_cmd::Command`, `predicates::str::contains`** -- source: https://docs.rs/assert_cmd / https://docs.rs/predicates -- verified: **no -- assumption** (inherited from PRD §11 `## Facts`). Risk: minor; de-facto Rust CLI test idiom. Verification path: caught at first `cargo test`.
- **`actionlint` -- invocation `actionlint .github/workflows/*.yml`** -- source: https://github.com/rhysd/actionlint -- verified: **no -- assumption** (inherited from PRD §11 `## Facts`). Risk: version drift. Verification path: Slice 4 pins a specific `actionlint` version.
- **SQLite `unicode61` tokenizer (default for FTS5) -- symbol: tokenizer name `unicode61`** -- source: https://www.sqlite.org/fts5.html#tokenizers -- verified: **no -- assumption** (referenced by UC-7-EC2 as the default iter-1 tokenizer). Risk: tokenizer behavior on non-ASCII queries. Verification path: architect Step 3 confirms tokenizer choice.

### Assumptions

- The Bash allowlist literal value uses unexpanded `~` per FR-8.3 (rather than the resolved `/Users/.../.claude/tools/...` path); AC-2 / TC-15.1 verify with the literal `~`-prefixed string. Risk: orchestrator's allowlist matcher must perform `~`-expansion at invocation time. Verification path: architect Step 3 confirms.
- The `<chunk-id>` component of the FR-7.1 citation refers to the `chunks.id` integer (auto-increment, may change on re-ingest) rather than the `chunks.ord` value (stable per-document position). Risk: ambiguity across re-ingests. Verification path: TC-12.1 captures the assumption verbatim; architect Step 3 / Slice 6 picks one and the rule file documents the choice.
- The PDF crate selected at architect Step 3 is `pdf-extract` per Open Question #1 default. Risk: if `lopdf` is chosen, TC-AAI-5 still applies (the rule file documents whichever crate's limitations apply). Verification path: architect Step 3 verdict.
- The `unchanged: <path>` log line in TC-9.1 is emitted once per file (not in a summary line). Risk: implementation-time decision per Slice 2. Verification path: Slice 2 done-condition test.
- The `delete <source-id>` semantics in TC-8.3 / TC-8.4 accommodate either an integer `documents.id` or a string `source_path` (Slice 3 implementation-time decision). Risk: tests are written generically. Verification path: Slice 3 picks one.
- The `--top-k` upper-bound clamp behavior (TC-7.4) is silent clamping (no warning emitted) per FR-3.2 wording. Risk: implementation may emit a warning. Verification path: Slice 3 picks one; the test accepts either as long as the result array length is ≤100.
- The "exactly once" wording for the skip line per FR-5.5 (TC-14.1) means once per agent invocation, not once per pipeline run. Risk: per the use-cases file's `## Facts` `### Assumptions` block. Verification path: TC-14.A1 verifies two consecutive agent invocations produce two skip lines.
- TC-AAI-1 (install.sh ordering) assumes the architect's action item describes the line-228 cleanup sequence in the SDLC repo's current `install.sh`; the architect's PASS verdict surfaced this ordering concern. Risk: the actual line number may shift; the test verifies behavioral ordering (binary install precedes cleanup OR `get_source_dir` re-invocation succeeds) rather than asserting line 228 specifically.

### Open questions

(none) -- the PRD section, the use-cases file, the architect's PASS verdict, the format-reference test-case file, and the user task prompt provide sufficient specification for QA test-case authoring. Implementation-time decisions (chunk-id semantics, top-k clamp behavior, delete <source-id> semantics, exact `unchanged:` log line wording) are documented as assumptions above; they will be resolved by the planner and the implementing slices.

---

**Note:** The `sdlc-knowledge` runtime is a Rust CLI binary, not a markdown-only artifact. "Testing" this feature combines (a) Rust unit / integration / `assert_cmd`-based E2E tests under `tools/sdlc-knowledge/tests/`, (b) shell-level cross-platform install matrix tests, (c) markdown invariant checks (file existence, line counts, byte-unchanged via `git diff` or `sha256`, literal-phrase grep), and (d) agent-prompt activation-block presence checks. Test types are tagged per case (`unit`, `integration`, `E2E`, `cross-platform`, `security`).

---

## Use Case Coverage

Every UC-N (and its variants) and UC-CC-N from `docs/use-cases/local-knowledge-base_use_cases.md` maps to one or more test cases below.

| UC | Scenario | Test Cases |
|----|----------|------------|
| UC-1 | First-time install on darwin-arm64 (release binary path) | TC-1.1 |
| UC-1-A1 | Re-running install on host with binary already at expected version (idempotent) | TC-1.2 |
| UC-1-A2 | Install on darwin-x64 / linux-x64 / linux-arm64 | TC-CP-1, TC-CP-2, TC-CP-3 |
| UC-1-E1 | Network failure during binary download → cargo fallback | TC-1.3 |
| UC-1-E2 | `chmod +x` fails (permission denied) | TC-1.4 |
| UC-1-EC1 | Host architecture not in 4-platform matrix → graceful skip | TC-1.5 |
| UC-2 | Cargo source-build fallback (no GitHub release yet) | TC-2.1 |
| UC-2-A1 | Local checkout absent (piped curl install) but cargo on PATH | TC-2.2 |
| UC-2-E1 | `cargo build --release` fails | TC-2.3 |
| UC-2-EC1 | Build succeeds but artifact >10 MB (NFR-1.1 size budget) | TC-2.4 |
| UC-3 | Neither release binary nor cargo available → graceful skip with warning | TC-3.1 |
| UC-3-A1 | Developer installs cargo and re-runs (recovery to UC-2) | TC-3.2 |
| UC-3-A2 | Developer waits for first release tag (recovery to UC-1) | TC-3.3 |
| UC-3-E1 | install.sh aborts on missing binary (regression of FR-8.5) | TC-3.4 |
| UC-3-EC1 | First-release window between SDLC merge and first binary tag | TC-3.5 |
| UC-4 | `bash install.sh --init-project` extends scaffold | TC-4.1 |
| UC-4-A1 | Re-running --init-project on existing `.claude/knowledge/` (idempotent) | TC-4.2 |
| UC-4-A2 | User-customized `.gitignore` not silently clobbered | TC-4.3 |
| UC-4-E1 | Filesystem permission denied | TC-4.4 |
| UC-4-EC1 | Template `.gitignore` line endings (LF) | TC-4.5 |
| UC-4-EC2 | User adds documents to `sources/` BEFORE first ingest | TC-4.6 |
| UC-5 | `/knowledge-ingest <path>` slash command on PDFs | TC-5.1 |
| UC-5-A1 | Single-file ingest | TC-5.2 |
| UC-5-A2 | Mixed-format directory (.md + .txt + .pdf) | TC-5.3 |
| UC-5-A3 | Binary absent at slash-command invocation | TC-5.4 |
| UC-5-E1 | Path does not exist | TC-5.5 |
| UC-5-E2 | Path traversal `--project-root ../../../etc` | TC-5.6 |
| UC-5-E3 | Symlink escape outside project root | TC-5.7 |
| UC-5-E4 | Corrupt PDF in batch → per-file error, batch continues | TC-5.8 |
| UC-5-E5 | Disk space exhausted mid-ingest | TC-5.9 |
| UC-5-EC1 | Empty directory | TC-5.10 |
| UC-5-EC2 | File with unsupported extension `.docx` skipped silently | TC-5.11 |
| UC-5-EC3 | Very large PDF (50 MB) beyond NFR-1.3 benchmark | TC-5.12 |
| UC-5-EC4 | Filename with spaces or non-ASCII characters | TC-5.13 |
| UC-6 | Direct shell invocation `sdlc-knowledge ingest <path>` | TC-6.1 |
| UC-6-A1 | Direct invocation with `--json` | TC-6.2 |
| UC-6-A2 | Explicit `--project-root` pointing to sibling project | TC-6.3 |
| UC-6-E1 | Same error flows as UC-5 (path traversal, corrupt PDF) | TC-6.4 |
| UC-6-EC1 | Direct invocation outside any project (`cwd` is `/tmp`) | TC-6.5 |
| UC-7 | `sdlc-knowledge search <query> --top-k 5 --json` BM25-ranked results | TC-7.1 |
| UC-7-A1 | Default `--top-k` (no flag) defaults to 5 | TC-7.2 |
| UC-7-A2 | Default text output (no `--json`) | TC-7.3 |
| UC-7-A3 | `--top-k 100` (upper-bound) | TC-7.4 |
| UC-7-A4 | `--top-k 500` clamped to 100 | TC-7.5 |
| UC-7-E1 | Corrupt `index.db` (truncated to 100 bytes) | TC-7.6 |
| UC-7-E2 | Empty `index.db` returns `[]` | TC-7.7 |
| UC-7-E3 | FTS5 query syntax error → exit 1, no panic | TC-7.8 |
| UC-7-E4 | Index file absent | TC-7.9 |
| UC-7-EC1 | Multi-word phrase query | TC-7.10 |
| UC-7-EC2 | Non-English language query (unicode61 tokenizer) | TC-7.11 |
| UC-7-EC3 | Two equally-ranked chunks → deterministic tie-break | TC-7.12 |
| UC-8 | `list / status / delete` subcommands | TC-8.1, TC-8.2, TC-8.3 |
| UC-8-A1 | `delete` with non-existent source-id (idempotent) | TC-8.4 |
| UC-8-A2 | Default text output for list / status / delete | TC-8.5 |
| UC-8-E1 | Corrupt `index.db` for list / status | TC-8.6 |
| UC-8-E2 | Database lock contention during delete | TC-8.7 |
| UC-8-EC1 | `status` on empty but valid index | TC-8.8 |
| UC-9 | Re-ingesting unchanged file → idempotent no-op | TC-9.1 |
| UC-9-A1 | Mixed batch: some unchanged, some new | TC-9.2 |
| UC-9-A2 | File renamed (different source_path) → treated as new | TC-9.3 |
| UC-9-E1 | Concurrent ingest + search via WAL | TC-9.4 |
| UC-9-E2 | `mtime` updated by `touch` but content unchanged (sha256 saves) | TC-9.5 |
| UC-9-EC1 | File deleted between two ingests | TC-9.6 |
| UC-10 | Re-ingesting changed file → re-chunk + FTS5 trigger updates | TC-10.1 |
| UC-10-A1 | Re-ingest where chunk count changes (50 → 80) | TC-10.2 |
| UC-10-E1 | Re-chunk fails mid-transaction → rollback, old chunks intact | TC-10.3 |
| UC-10-EC1 | Re-ingest reduces chunk count to zero | TC-10.4 |
| UC-10-EC2 | FTS5 trigger fails to fire (regression detection) | TC-10.5 |
| UC-11 | 12 thinking agents detect activation sentinel and query | TC-11.1 |
| UC-11-A1 | Agent issues multiple distinct queries (multi-query authoring) | TC-11.2 |
| UC-11-A2 | Search returns zero hits → no citation, optional `### Open questions` entry | TC-11.3 |
| UC-11-A3 | Agent queries during /develop-feature slice (mid-pipeline) | TC-11.4 |
| UC-11-E1 | Agent attempts to query but binary path wrong / allowlist missing | TC-11.5 |
| UC-11-E2 | Agent forgets to cite a load-bearing chunk | TC-11.6 |
| UC-11-EC1 | Activation sentinel present but binary absent | TC-11.7 |
| UC-11-EC2 | Activation block accidentally placed BEFORE existing prompt sections | TC-11.8 |
| UC-11-EC3 | Executor agent prompt accidentally modified (FR-5.4 violation) | TC-11.9 |
| UC-12 | Agent cites BM25 hits in `## Facts → ### External contracts` | TC-12.1 |
| UC-12-A1 | Citation alongside non-knowledge-base external contract | TC-12.2 |
| UC-12-A2 | Citation in stdout-only artifact (architect / security-auditor / etc.) | TC-12.3 |
| UC-12-E1 | Agent emits malformed citation (drops `BM25:` field) | TC-12.4 |
| UC-12-E2 | Agent cites a chunk it never read (hallucinated citation) | TC-12.5 |
| UC-12-EC1 | Source filename contains a colon | TC-12.6 |
| UC-12-EC2 | BM25 score is negative or zero | TC-12.7 |
| UC-13 | Backward compat without `index.db` → silent skip, identical output | TC-13.1 |
| UC-13-A1 | All 12 in-scope agents in one bootstrap pass produce identical output | TC-13.2 |
| UC-13-E1 | Activation block invokes CLI even when sentinel absent (regression) | TC-13.3 |
| UC-13-EC1 | Sentinel transitions from absent to present mid-cycle | TC-13.4 |
| UC-14 | Backward compat without binary → log skip line and proceed | TC-14.1 |
| UC-14-A1 | Multiple agents each emit skip line independently | TC-14.2 |
| UC-14-A2 | Binary AND sentinel both absent → silent path (UC-13) wins | TC-14.3 |
| UC-14-E1 | Bash allowlist denies invocation | TC-14.4 |
| UC-14-E2 | Agent fails to log the skip line (regression) | TC-14.5 |
| UC-14-EC1 | Binary present but corrupted (zero bytes) | TC-14.6 |
| UC-14-EC2 | `--version`-probe behavior | TC-14.7 |
| UC-15 | Bash allowlist registered idempotently | TC-15.1 |
| UC-15-A1 | Fresh install, no prior `~/.claude/settings.json` | TC-15.2 |
| UC-15-A2 | `jq` absent, heredoc-merge fallback | TC-15.3 |
| UC-15-E1 | Pre-existing keys preserved (regression detection) | TC-15.4 |
| UC-15-E2 | Malformed JSON refused to overwrite | TC-15.5 |
| UC-15-E3 | Concurrent install.sh runs racing on JSON merge | TC-15.6 |
| UC-15-EC1 | `~`-expansion semantics | TC-15.7 |
| UC-15-EC2 | User-broadened wildcard not reverted | TC-15.8 |
| UC-CC-1 | Cross-platform install verification (4 platforms) | TC-CP-1, TC-CP-2, TC-CP-3, TC-CP-4 |
| UC-CC-2 | Invariant preservation (17 agents, 10 gates, 5 executors, README taglines) | TC-INV-1 through TC-INV-7 |
| UC-CC-3 | Commands count goes from 5 to 6 | TC-INV-2, TC-CC-3 |
| UC-CC-4 | PDF + Markdown + Plain text formats supported | TC-CC-4 |
| UC-CC-5 | First-release maintainer bootstrap (`sdlc-knowledge-v0.1.0`) | TC-CC-5 |

---

## AC Coverage

Every AC-1 through AC-13 from PRD §11.5 maps to one or more test cases below.

| AC | Description | Test Cases |
|----|-------------|------------|
| AC-1 | Install on four platforms; `--version` exit 0 within 60 s | TC-1.1, TC-CP-1, TC-CP-2, TC-CP-3, TC-CP-4 |
| AC-2 | Bash allowlist registered with exactly one entry | TC-1.1, TC-15.1, TC-15.2, TC-15.3, TC-15.4 |
| AC-3 | Project scaffold extension (.gitignore byte-identical) | TC-4.1, TC-4.2, TC-4.5 |
| AC-4 | Ingest a 5 MB PDF in ≤ 60 s; ≥ 1 doc row, ≥ 100 chunk rows | TC-5.1, TC-5.2, TC-5.3, TC-5.8, TC-5.12, TC-9.1, TC-10.1, TC-CC-4 |
| AC-5 | Search returns ranked results within 500 ms latency | TC-7.1, TC-7.2, TC-7.4, TC-7.7, TC-7.12, TC-CP-4 |
| AC-6 | Path traversal rejected (exit 2 with literal message) | TC-5.6, TC-5.7, TC-AAI-3 |
| AC-7 | Corrupt index handled (exit 1 with literal message; no panic) | TC-7.6, TC-7.8, TC-8.6 |
| AC-8 | Backward compat without index | TC-13.1, TC-13.2, TC-13.4 |
| AC-9 | Backward compat without binary (skip line emitted) | TC-1.5, TC-3.1, TC-5.4, TC-11.5, TC-11.7, TC-14.1, TC-14.2, TC-14.4, TC-14.5, TC-14.6 |
| AC-10 | Citation format correctness in `### External contracts` | TC-12.1, TC-12.2, TC-12.3, TC-12.4, TC-12.5 |
| AC-11 | Invariants preserved (17 agents, 10 gates, taglines, executors) | TC-INV-1, TC-INV-3, TC-INV-4, TC-INV-5, TC-INV-6, TC-INV-7 |
| AC-12 | Commands count returns 6 | TC-INV-2 |
| AC-13 | First-release bootstrap with cargo source-build fallback | TC-1.3, TC-2.1, TC-2.2, TC-2.3, TC-3.1, TC-3.2, TC-3.3, TC-CC-5 |

---

## 1. UC-1: First-Time Install on darwin-arm64 (Release Binary Path)

### TC-1.1: Fresh install on darwin-arm64 produces working binary, allowlist entry, and `--version` exit 0 within 60 s
- **Category:** Install / Happy Path
- **Mapped UC:** UC-1
- **Mapped FR:** FR-8.1, FR-8.2, FR-8.3, FR-1.1, NFR-1.9
- **Mapped AC:** AC-1, AC-2
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Host is darwin-arm64; `uname -ms` returns `Darwin arm64`; `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does NOT exist; network connectivity to GitHub Releases is available; the maintainer has cut at least one `sdlc-knowledge-v*` tag with the four-platform artifacts uploaded
- **Inputs:** `bash install.sh --yes` from the SDLC repo root
- **Steps:**
  1. Snapshot `~/.claude/settings.json` content (or note its absence)
  2. Record start timestamp `T0`
  3. Run `bash install.sh --yes`
  4. Record end timestamp `T1`
  5. Verify `test -x ~/.claude/tools/sdlc-knowledge/sdlc-knowledge` returns 0
  6. Run `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` and capture exit code + stdout
  7. Verify the stdout matches the regex `^sdlc-knowledge \d+\.\d+\.\d+\b`
  8. Verify `T1 - T0 ≤ 60 s`
  9. `grep -F "~/.claude/tools/sdlc-knowledge/sdlc-knowledge *" ~/.claude/settings.json | wc -l` returns exactly `1`
  10. Verify no broader wildcard such as `~/.claude/tools/* *` was added
- **Expected Result:** Binary executable; `--version` exit 0; ≤ 60 s elapsed; exactly one allowlist entry matching the literal `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *`; pre-existing settings keys preserved
- **Pass Criteria:** AC-1 and AC-2 satisfied

### TC-1.2: Re-running install on host with binary already at expected version is idempotent no-op
- **Category:** Install / Idempotency
- **Mapped UC:** UC-1-A1
- **Mapped FR:** FR-8.2, FR-8.3
- **Mapped AC:** AC-1, AC-2
- **Type:** integration
- **Severity:** P1
- **Preconditions:** TC-1.1 has succeeded; binary present
- **Inputs:** `bash install.sh --yes` (second run)
- **Steps:**
  1. Compute `sha256` of the existing binary; record `H1`
  2. Snapshot `~/.claude/settings.json`
  3. Run `bash install.sh --yes`
  4. Compute `sha256` of the binary; record `H2`
  5. `grep -Fc "~/.claude/tools/sdlc-knowledge/sdlc-knowledge *" ~/.claude/settings.json`
- **Expected Result:** `H1 == H2`; allowlist entry count remains exactly 1 (no duplicate); pre-existing settings keys unchanged; total elapsed time bounded by version-check + scaffold helpers
- **Pass Criteria:** Idempotent re-run produces no diff

### TC-1.3: Network failure during binary download → cargo fallback path
- **Category:** Install / Error Recovery
- **Mapped UC:** UC-1-E1
- **Mapped FR:** FR-8.4, FR-8.5
- **Mapped AC:** AC-13
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Network is unreachable OR the GitHub Releases URL returns 404; `cargo` is on PATH; local checkout containing `tools/sdlc-knowledge/Cargo.toml` is present
- **Inputs:** `bash install.sh --yes` with the network mocked to fail
- **Steps:**
  1. Block outbound HTTPS to GitHub (e.g., point DNS at a sinkhole, or set environment variable forcing curl 404)
  2. Run `bash install.sh --yes`
  3. Verify the script invoked `cargo build --release -p sdlc-knowledge`
  4. Verify the artifact at `tools/sdlc-knowledge/target/release/sdlc-knowledge` was copied to `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`
  5. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0
- **Expected Result:** Cargo source-build fallback succeeds; binary functional; allowlist registered as in UC-1
- **Pass Criteria:** AC-13 cargo fallback path verified

### TC-1.4: `chmod +x` fails (permission denied)
- **Category:** Install / Permission Failure
- **Mapped UC:** UC-1-E2
- **Mapped FR:** FR-8.2
- **Mapped AC:** AC-1 (negative path)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `~/.claude/tools/sdlc-knowledge/` is read-only (e.g., owned by root with 0500 mode)
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Make `~/.claude/tools/sdlc-knowledge/` read-only via `chmod 0500`
  2. Run `bash install.sh --yes`
  3. Capture stderr
- **Expected Result:** Stderr contains a clear error message about chmod failure with a remediation hint mentioning `~/.claude/tools/sdlc-knowledge/` and permissions; binary file may exist but `test -x` fails
- **Pass Criteria:** Failure surfaced clearly; user can remediate

### TC-1.5: Host architecture not in the four-platform matrix → graceful skip with warning
- **Category:** Install / Unsupported Platform
- **Mapped UC:** UC-1-EC1
- **Mapped FR:** FR-8.5, NFR-1.4
- **Mapped AC:** AC-13, AC-9
- **Type:** integration / cross-platform
- **Severity:** P1
- **Preconditions:** Host returns an `uname -ms` value not in {`Darwin arm64`, `Darwin x86_64`, `Linux x86_64`, `Linux aarch64`} (e.g., FreeBSD, OpenBSD, Linux riscv64)
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Mock `uname -ms` to return `FreeBSD amd64` (or similar unsupported)
  2. Run `bash install.sh --yes`
  3. Capture stdout / stderr
  4. Verify the script exits 0 (continues with config-copy and scaffolding)
  5. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent
  6. `grep -F "binary unavailable; install cargo or wait for first release"` returns 1 line in the install transcript
- **Expected Result:** Install exit 0; literal warning emitted; binary absent; downstream UC-14 skip behavior applies
- **Pass Criteria:** AC-13 graceful-degradation path verified

---

## 2. UC-2: Cargo Source-Build Fallback (No GitHub Release Yet)

### TC-2.1: Fresh install with no GitHub release tag and cargo on PATH → cargo source-build succeeds
- **Category:** Install / Source Build
- **Mapped UC:** UC-2
- **Mapped FR:** FR-8.4
- **Mapped AC:** AC-13
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** No `sdlc-knowledge-v*` tag exists OR the GitHub Releases API returns no matching artifact; `cargo --version` exit 0; local checkout present
- **Inputs:** `bash install.sh --yes` from the cloned repo root
- **Steps:**
  1. Run `bash install.sh --yes`
  2. Verify the install transcript shows `cargo build --release -p sdlc-knowledge` was executed
  3. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0
  4. Verify `stat --format=%s ~/.claude/tools/sdlc-knowledge/sdlc-knowledge` returns ≤ 10485760 (10 MB per NFR-1.1)
  5. Verify allowlist entry registered per FR-8.3
- **Expected Result:** Source-built binary functional; size within budget; allowlist registered
- **Pass Criteria:** AC-13 cargo source-build fallback verified end-to-end

### TC-2.2: Cargo on PATH but local checkout absent (piped curl install) → graceful skip
- **Category:** Install / Missing Source
- **Mapped UC:** UC-2-A1
- **Mapped FR:** FR-8.5
- **Mapped AC:** AC-13
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `cargo` on PATH; install.sh is invoked WITHOUT a sibling `tools/sdlc-knowledge/Cargo.toml` (e.g., script downloaded standalone)
- **Inputs:** Pipe install.sh from a temporary path with no source files
- **Steps:**
  1. Place install.sh in `/tmp/install.sh` with no `tools/` sibling directory
  2. Run `bash /tmp/install.sh --yes`
  3. Capture transcript
- **Expected Result:** Literal warning `binary unavailable; install cargo or wait for first release` emitted; install exit 0; binary absent
- **Pass Criteria:** Flow degrades to UC-3 with the literal warning

### TC-2.3: `cargo build --release` fails (transient compiler error)
- **Category:** Install / Build Failure
- **Mapped UC:** UC-2-E1
- **Mapped FR:** FR-8.4, FR-8.5
- **Mapped AC:** AC-13
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Cargo on PATH; local checkout present; the source is corrupted (e.g., a `src/main.rs` syntax-error injected) OR `cargo` exit non-zero
- **Inputs:** `bash install.sh --yes` with a deliberately broken `tools/sdlc-knowledge/src/main.rs`
- **Steps:**
  1. Inject a syntax error into `tools/sdlc-knowledge/src/main.rs`
  2. Run `bash install.sh --yes`
  3. Capture stderr
- **Expected Result:** Cargo build fails non-zero; install.sh captures stderr and reports the failure; install.sh continues (does NOT abort the rest of the install per FR-8.5); binary absent at the global path
- **Pass Criteria:** Graceful degradation per FR-8.5 even on cargo failure

### TC-2.4: Build succeeds but artifact size exceeds NFR-1.1 (10 MB)
- **Category:** Install / Size Budget
- **Mapped UC:** UC-2-EC1
- **Mapped FR:** FR-8.4, NFR-1.1
- **Mapped AC:** (build-time gate, not user-facing AC)
- **Type:** integration
- **Severity:** P3
- **Preconditions:** A debug-mode build artifact exceeding 10 MB is produced (e.g., release flags accidentally absent)
- **Inputs:** Force a debug build by editing `tools/sdlc-knowledge/Cargo.toml` to remove `strip = true` / `lto = true` and run install.sh
- **Steps:**
  1. Force the build to omit strip/lto
  2. Run `bash install.sh --yes`
  3. Verify `stat --format=%s ~/.claude/tools/sdlc-knowledge/sdlc-knowledge` may exceed 10 MB
  4. Verify install.sh does NOT enforce NFR-1.1 at install time (per UC-2-EC1 wording)
  5. Confirm the size violation surfaces only at the next CI release dry-run, not at user install
- **Expected Result:** Install completes; size budget violation is a CI-time concern, not a user-install gate
- **Pass Criteria:** install.sh does not gate on size; binary functional

---

## 3. UC-3: Neither Release Binary Nor Cargo Available (Graceful Skip)

### TC-3.1: Fresh install with no GitHub release AND no cargo → warning, exit 0, binary absent
- **Category:** Install / Graceful Skip
- **Mapped UC:** UC-3
- **Mapped FR:** FR-8.5
- **Mapped AC:** AC-13
- **Type:** integration
- **Severity:** P0
- **Preconditions:** No `sdlc-knowledge-v*` GitHub release; `command -v cargo` returns non-zero; `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does NOT exist
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Mask cargo (e.g., `PATH=""` or rename `cargo` binary)
  2. Mock GitHub Releases to return 404
  3. Run `bash install.sh --yes`
  4. Capture transcript
  5. `grep -Fc "binary unavailable; install cargo or wait for first release"` returns 1
  6. Verify install.sh exit code 0
  7. Verify pre-existing config-copy steps (rules, agents, commands) ran successfully
- **Expected Result:** Literal warning emitted; install exit 0; allowlist entry idempotently registered (harmless ahead of binary install); downstream UC-14 fallback applies
- **Pass Criteria:** AC-13 graceful skip verified

### TC-3.2: Recovery -- developer installs cargo and re-runs → flow matches UC-2
- **Category:** Install / Recovery
- **Mapped UC:** UC-3-A1
- **Mapped FR:** FR-8.4, FR-8.5
- **Mapped AC:** AC-13
- **Type:** integration
- **Severity:** P2
- **Preconditions:** TC-3.1 has run; binary absent; cargo installed via `rustup` after first install attempt
- **Inputs:** `bash install.sh --yes` (second run)
- **Steps:**
  1. After TC-3.1, install cargo via `rustup install stable`
  2. Re-run `bash install.sh --yes`
  3. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0
- **Expected Result:** Second run hits UC-2 cargo fallback; binary built and installed
- **Pass Criteria:** Recovery path matches AC-13

### TC-3.3: Recovery -- developer waits for maintainer's first release → flow matches UC-1
- **Category:** Install / Recovery
- **Mapped UC:** UC-3-A2
- **Mapped FR:** FR-11.3
- **Mapped AC:** AC-13
- **Type:** integration
- **Severity:** P2
- **Preconditions:** TC-3.1 has run; binary absent; maintainer cuts `sdlc-knowledge-v0.1.0` per UC-CC-5
- **Inputs:** `bash install.sh --yes` after maintainer release
- **Steps:**
  1. After TC-3.1, simulate maintainer cutting `sdlc-knowledge-v0.1.0` and uploading binaries
  2. Re-run `bash install.sh --yes`
  3. Verify download succeeds
- **Expected Result:** Second run hits UC-1 release-binary path; binary downloaded
- **Pass Criteria:** Recovery path matches AC-13

### TC-3.4: install.sh aborts on missing binary (regression of FR-8.5)
- **Category:** Install / Regression Detection
- **Mapped UC:** UC-3-E1
- **Mapped FR:** FR-8.5
- **Mapped AC:** AC-13 (negative)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Same as TC-3.1; QA test simulates a regression where install.sh exits non-zero on binary unavailability
- **Inputs:** `bash install.sh --yes` against a regressed install.sh
- **Steps:**
  1. Inject a regression: replace `continue` with `exit 1` in the binary-unavailable branch
  2. Run `bash install.sh --yes`
  3. Verify exit code is non-zero AND downstream config-copy steps did NOT run
  4. Confirm this regression FAILS the AC-13 verification
- **Expected Result:** Regression caught; AC-13 verification fails; the test prevents this regression from shipping
- **Pass Criteria:** Test catches the regression

### TC-3.5: First-release window between SDLC merge and first binary tag
- **Category:** Install / Documentation
- **Mapped UC:** UC-3-EC1
- **Mapped FR:** FR-11.3
- **Mapped AC:** AC-13
- **Type:** integration / documentation
- **Severity:** P2
- **Preconditions:** SDLC release containing this feature has merged; maintainer has not yet cut `sdlc-knowledge-v0.1.0`
- **Inputs:** Read `tools/sdlc-knowledge/RELEASING.md`
- **Steps:**
  1. Verify `tools/sdlc-knowledge/RELEASING.md` exists per FR-11.3
  2. Verify it documents the manual one-time bootstrap step for cutting `sdlc-knowledge-v0.1.0`
  3. Verify the document mentions the cargo source-build fallback per FR-8.4
- **Expected Result:** RELEASING.md exists and documents the bootstrap correctly
- **Pass Criteria:** AC-13 documentation gate satisfied

---

## 4. UC-4: Project Scaffold Extension (`bash install.sh --init-project`)

### TC-4.1: --init-project creates `.claude/knowledge/.gitignore` byte-identical to template
- **Category:** Scaffold / Happy Path
- **Mapped UC:** UC-4
- **Mapped FR:** FR-8.6, FR-9.1, FR-9.2
- **Mapped AC:** AC-3
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Common preconditions; cwd is a fresh project directory with no `.claude/`
- **Inputs:** `bash install.sh --init-project`
- **Steps:**
  1. From an empty project directory, run `bash install.sh --init-project`
  2. Verify `<cwd>/.claude/knowledge/.gitignore` exists
  3. `diff <cwd>/.claude/knowledge/.gitignore templates/knowledge/.gitignore` returns empty (byte-identical per AC-3)
  4. Verify the literal four lines `sources/`, `index.db`, `index.db-shm`, `index.db-wal` (one per line) appear in the file
  5. Verify `<cwd>/.claude/knowledge/sources/` directory exists with `.gitkeep`
  6. Verify `<cwd>/.claude/knowledge/index.db` does NOT exist
- **Expected Result:** Scaffold tree matches the UC-4 specification; AC-3 byte-identity check passes
- **Pass Criteria:** AC-3 satisfied

### TC-4.2: Re-running --init-project on existing `.claude/knowledge/` is idempotent
- **Category:** Scaffold / Idempotency
- **Mapped UC:** UC-4-A1
- **Mapped FR:** FR-8.6
- **Mapped AC:** AC-3
- **Type:** integration
- **Severity:** P1
- **Preconditions:** TC-4.1 has succeeded
- **Inputs:** `bash install.sh --init-project` (second run); `<cwd>/.claude/knowledge/sources/my.pdf` is present from a prior workflow
- **Steps:**
  1. Add a sample file `<cwd>/.claude/knowledge/sources/my.pdf`
  2. Run `bash install.sh --init-project` again
  3. Verify `<cwd>/.claude/knowledge/sources/my.pdf` is unchanged (sha256 match)
  4. Verify `<cwd>/.claude/knowledge/.gitignore` is byte-identical to template (still passes AC-3)
- **Expected Result:** User-supplied source files preserved; scaffold idempotent
- **Pass Criteria:** No user data lost on re-init

### TC-4.3: User-customized `.gitignore` is not silently clobbered
- **Category:** Scaffold / User Override
- **Mapped UC:** UC-4-A2
- **Mapped FR:** FR-8.6
- **Mapped AC:** AC-3 (with caveat)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** User has edited `<cwd>/.claude/knowledge/.gitignore` to add an extra line
- **Inputs:** `bash install.sh --init-project`
- **Steps:**
  1. Edit `<cwd>/.claude/knowledge/.gitignore` and append a custom line
  2. Re-run `bash install.sh --init-project`
  3. Inspect the resulting file
- **Expected Result:** Per pre-existing template-copy convention, the script SKIPS overwriting modified files OR overwrites them with a warning. Implementation-time decision is acceptable; key constraint is that user edits are not silently lost
- **Pass Criteria:** No silent data loss

### TC-4.4: Filesystem permission denied on `.claude/knowledge/`
- **Category:** Scaffold / Permission Failure
- **Mapped UC:** UC-4-E1
- **Mapped FR:** FR-8.6
- **Mapped AC:** AC-3 (negative)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `<cwd>/.claude/` is read-only (chmod 0500)
- **Inputs:** `bash install.sh --init-project`
- **Steps:**
  1. `chmod 0500 <cwd>/.claude/`
  2. Run `bash install.sh --init-project`
  3. Capture stderr
- **Expected Result:** Clear EPERM error message with remediation hint; downstream scaffold steps continue or abort per pre-existing helper convention
- **Pass Criteria:** Failure surfaced clearly

### TC-4.5: Template `.gitignore` ships with LF line endings (cross-platform discipline)
- **Category:** Scaffold / Line Endings
- **Mapped UC:** UC-4-EC1
- **Mapped FR:** FR-9.1
- **Mapped AC:** AC-3
- **Type:** integration / cross-platform
- **Severity:** P2
- **Preconditions:** N/A
- **Inputs:** `templates/knowledge/.gitignore`
- **Steps:**
  1. Run `file templates/knowledge/.gitignore`
  2. Verify output does NOT contain `with CRLF line terminators`
  3. Run `od -c templates/knowledge/.gitignore | grep -c '\\r'` returns 0
- **Expected Result:** Template uses Unix LF line endings; AC-3 byte-identity check is reliable on all four supported Unix-family platforms
- **Pass Criteria:** No CR characters present

### TC-4.6: User adds documents to `sources/` BEFORE first ingest
- **Category:** Scaffold / First-Run Flow
- **Mapped UC:** UC-4-EC2
- **Mapped FR:** FR-8.6, FR-2.1
- **Mapped AC:** AC-3, AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** TC-4.1 has succeeded
- **Inputs:** Drop PDFs into `<cwd>/.claude/knowledge/sources/` then run UC-5 ingest
- **Steps:**
  1. After --init-project, drop two PDFs into `sources/`
  2. Verify `<cwd>/.claude/knowledge/index.db` does NOT exist (sentinel absent → UC-13 backward-compat applies)
  3. Run `/knowledge-ingest .claude/knowledge/sources` per UC-5
  4. Verify `index.db` is created on first ingest; sentinel becomes present
- **Expected Result:** Pre-ingest state is sentinel-absent; first ingest creates the sentinel
- **Pass Criteria:** First-run flow works; sentinel transition observable

---

## 5. UC-5: `/knowledge-ingest <path>` Slash Command

### TC-5.1: Slash command ingests a folder of PDFs; 5 MB PDF in ≤ 60 s; ≥ 100 chunk rows
- **Category:** Ingest / Happy Path
- **Mapped UC:** UC-5
- **Mapped FR:** FR-6.1, FR-6.2, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-4.1, FR-4.2, FR-4.4, NFR-1.6, NFR-1.7
- **Mapped AC:** AC-4
- **Type:** E2E
- **Severity:** P0
- **Preconditions:** UC-1 succeeded (binary present); UC-4 succeeded (`sources/` exists); a 5 MB synthetic PDF placed at `<cwd>/.claude/knowledge/sources/fixture.pdf`
- **Inputs:** `/knowledge-ingest .claude/knowledge/sources` typed in chat (or executed as `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest .claude/knowledge/sources --json` directly)
- **Steps:**
  1. Record start timestamp `T0`
  2. Run the ingest command
  3. Record end timestamp `T1`
  4. Verify `T1 - T0 ≤ 60 s`
  5. Run `sqlite3 <cwd>/.claude/knowledge/index.db 'SELECT COUNT(*) FROM documents'` returns ≥ 1
  6. Run `sqlite3 <cwd>/.claude/knowledge/index.db 'SELECT COUNT(*) FROM chunks'` returns ≥ 100
  7. Run `sqlite3 <cwd>/.claude/knowledge/index.db 'SELECT COUNT(*) FROM chunks_fts'` returns same as `chunks` count (FTS5 trigger sync)
  8. Run `sqlite3 <cwd>/.claude/knowledge/index.db 'PRAGMA journal_mode'` returns `wal`
  9. Verify the streaming JSON output contains a final summary line with chunk_count and source_count
- **Expected Result:** AC-4 satisfied (≤60 s, ≥1 doc, ≥100 chunks); WAL mode enabled; FTS5 in sync; sentinel now present
- **Pass Criteria:** AC-4 satisfied end-to-end

### TC-5.2: Single-file ingest (path is a file, not a directory)
- **Category:** Ingest / Single File
- **Mapped UC:** UC-5-A1
- **Mapped FR:** FR-2.1
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Binary present; one `.pdf` exists
- **Inputs:** `sdlc-knowledge ingest <path-to-single-file.pdf>`
- **Steps:**
  1. Run ingest with a single file path
  2. Verify exit 0
  3. Verify `documents` count = 1, `chunks` count ≥ 1
- **Expected Result:** Single-file ingest works identically to directory ingest with one file
- **Pass Criteria:** AC-4 satisfied for single-file path

### TC-5.3: Mixed-format directory (.md + .txt + .pdf in one batch)
- **Category:** Ingest / Heterogeneous Batch
- **Mapped UC:** UC-5-A2
- **Mapped FR:** FR-2.1, FR-2.2
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Directory contains at least one `.md`, one `.txt`, one `.pdf`
- **Inputs:** `sdlc-knowledge ingest <dir>`
- **Steps:**
  1. Run ingest on the mixed directory
  2. Verify each format produced rows in `documents` (3 rows total)
  3. Verify FTS5 search returns hits across all three formats for a query that matches all
  4. Verify `documents.source_path` distinguishes files by extension
- **Expected Result:** All three iter-1 formats processed uniformly; AC-4 satisfied
- **Pass Criteria:** UC-CC-4 also satisfied via this case

### TC-5.4: Slash command when binary is absent → actionable message including `bash install.sh --yes`
- **Category:** Slash / Pre-Install
- **Mapped UC:** UC-5-A3
- **Mapped FR:** FR-6.3
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P1
- **Preconditions:** `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent
- **Inputs:** `/knowledge-ingest .claude/knowledge/sources` typed in chat
- **Steps:**
  1. Remove the binary
  2. Invoke the slash command
  3. Capture chat output
- **Expected Result:** Output contains the literal text `bash install.sh --yes`; command exits without error per FR-6.3
- **Pass Criteria:** Actionable remediation surfaced

### TC-5.5: Path does not exist → exit 1 with clear error; no panic
- **Category:** Ingest / Error
- **Mapped UC:** UC-5-E1
- **Mapped FR:** FR-1.6, FR-2.6
- **Mapped AC:** AC-7 (no-panic invariant applies broadly)
- **Type:** integration / security
- **Severity:** P1
- **Preconditions:** Binary present
- **Inputs:** `sdlc-knowledge ingest /nonexistent/path/that/does/not/exist`
- **Steps:**
  1. Run ingest against a non-existent path
  2. Capture exit code
  3. Capture stderr
- **Expected Result:** Exit code 1; stderr contains a clear ENOENT-style message; stderr does NOT contain `panicked at`; `documents` and `chunks` table state unchanged
- **Pass Criteria:** No-panic invariant per FR-1.6

### TC-5.6: Path traversal `--project-root ../../../etc` rejected with literal message and exit 2
- **Category:** Security / Path Canonicalization
- **Mapped UC:** UC-5-E2
- **Mapped FR:** FR-1.5
- **Mapped AC:** AC-6
- **Type:** security / E2E
- **Severity:** P0
- **Preconditions:** Binary present; cwd is a project directory
- **Inputs:** `sdlc-knowledge ingest ./books --project-root ../../../etc`
- **Steps:**
  1. From cwd, run `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest ./books --project-root ../../../etc`
  2. Capture exit code
  3. Capture stderr
- **Expected Result:** Exit code 2; stderr contains the literal `error: project-root must resolve under current working directory`; no filesystem read or write outside cwd; no panic
- **Pass Criteria:** AC-6 satisfied verbatim

### TC-5.7: Symlink escape outside project root rejected
- **Category:** Security / Symlink
- **Mapped UC:** UC-5-E3
- **Mapped FR:** FR-1.5
- **Mapped AC:** AC-6
- **Type:** security
- **Severity:** P0
- **Preconditions:** Binary present
- **Inputs:** Symlink `<cwd>/escape` points to `/etc`; run `sdlc-knowledge ingest ./books --project-root ./escape`
- **Steps:**
  1. `ln -s /etc <cwd>/escape`
  2. Run `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest ./books --project-root ./escape`
  3. Capture exit code
  4. Capture stderr
- **Expected Result:** Exit code 2; stderr contains the literal `error: project-root must resolve under current working directory` (canonicalization resolved the symlink to `/etc` which is outside cwd)
- **Pass Criteria:** AC-6 enforced even on symlink-based escape

### TC-5.8: Corrupt PDF in batch → per-file error, batch continues, transactional per-document
- **Category:** Ingest / Resilience
- **Mapped UC:** UC-5-E4
- **Mapped FR:** FR-2.6, FR-6.2, FR-1.6
- **Mapped AC:** AC-4 (transactional per-document)
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Binary present; batch directory contains 10 PDFs, one of which is truncated (corrupt)
- **Inputs:** `sdlc-knowledge ingest <dir-with-10-pdfs-one-corrupt>`
- **Steps:**
  1. Place 9 valid PDFs and 1 truncated PDF (chmod or `dd if=/dev/null of=corrupt.pdf bs=1 count=100`) in the directory
  2. Run ingest
  3. Capture exit code, stderr, stdout JSON stream
  4. Run `sqlite3 index.db 'SELECT COUNT(*) FROM documents'`
  5. Run `sqlite3 index.db 'SELECT source_path FROM documents'`
  6. Verify `panicked at` does not appear in stderr
- **Expected Result:** 9 valid PDFs ingested (one row each in `documents`, multiple rows in `chunks`); 1 corrupt PDF reported as a per-file error in stderr / JSON stream; the corrupt-PDF transaction was rolled back (per-document `BEGIN IMMEDIATE` boundary); the 9 valid PDFs are NOT poisoned by the corrupt one's failure; final summary reports `9 succeeded, 1 failed`; no panic
- **Pass Criteria:** Per-document transactionality verified; AC-4 transactional-per-document semantics hold; supersedes TC-AAI-4 with broader detail

### TC-5.9: Disk space exhausted mid-ingest → SQLITE_FULL handled, prior commits preserved
- **Category:** Ingest / Resource Exhaustion
- **Mapped UC:** UC-5-E5
- **Mapped FR:** FR-2.6
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** A fixture filesystem with limited space (e.g., a tmpfs mount of 1 MB)
- **Inputs:** `sdlc-knowledge ingest <large-batch>` against the constrained filesystem
- **Steps:**
  1. Mount a 1 MB tmpfs at `<cwd>/.claude/knowledge/`
  2. Place several large PDFs in `sources/`
  3. Run ingest
  4. Capture exit code, stderr
  5. Run `sqlite3 index.db 'SELECT COUNT(*) FROM documents'`
- **Expected Result:** Mid-ingest the binary hits SQLITE_FULL; the in-flight document's transaction rolls back; already-committed prior documents remain in the index; binary exits non-zero with a clear disk-space error; no panic
- **Pass Criteria:** Per-document transactional commit boundary survives disk-space failure

### TC-5.10: Empty directory → 0 files / 0 chunks; exit 0
- **Category:** Ingest / Empty Input
- **Mapped UC:** UC-5-EC1
- **Mapped FR:** FR-2.1
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Empty directory at `<dir>`
- **Inputs:** `sdlc-knowledge ingest <empty-dir>`
- **Steps:**
  1. Create an empty `<dir>`
  2. Run ingest
  3. Capture exit code and summary line
- **Expected Result:** Exit 0; summary line reports 0 files / 0 chunks; `documents` count unchanged
- **Pass Criteria:** Empty input is not an error

### TC-5.11: File with unsupported extension `.docx` skipped silently
- **Category:** Ingest / Format Filter
- **Mapped UC:** UC-5-EC2
- **Mapped FR:** FR-2.1
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Directory contains a `.docx` and a `.md`
- **Inputs:** `sdlc-knowledge ingest <dir>`
- **Steps:**
  1. Place `report.docx` and `notes.md` in `<dir>`
  2. Run ingest
  3. Verify only `notes.md` is reflected in `documents` table
- **Expected Result:** `.docx` skipped (not an error); only the `.md` is processed
- **Pass Criteria:** iter-1 supported-extension list enforced

### TC-5.12: Very large PDF (50 MB) — beyond NFR-1.3 5 MB benchmark
- **Category:** Ingest / Scale
- **Mapped UC:** UC-5-EC3
- **Mapped FR:** FR-2.1, NFR-1.3
- **Mapped AC:** AC-4 (benchmark only)
- **Type:** integration / performance
- **Severity:** P3
- **Preconditions:** A 50 MB PDF fixture
- **Inputs:** `sdlc-knowledge ingest <50mb.pdf>`
- **Steps:**
  1. Run ingest against the 50 MB PDF
  2. Record total elapsed time
  3. Verify completion (exit 0); chunks rows present
- **Expected Result:** Throughput scales roughly linearly per NFR-1.3; total elapsed time exceeds 60 s for 50 MB but is bounded; the benchmark is a 5 MB target, not a hard 50 MB ceiling
- **Pass Criteria:** Large PDFs do not crash or hang indefinitely

### TC-5.13: Filename with spaces or non-ASCII characters
- **Category:** Ingest / UTF-8 Path
- **Mapped UC:** UC-5-EC4
- **Mapped FR:** FR-2.2, FR-2.4
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Files named `Risk Assessment 2026.pdf` and `финансы.md` placed in sources
- **Inputs:** `sdlc-knowledge ingest <dir>`
- **Steps:**
  1. Place files with spaces and non-ASCII filenames
  2. Run ingest
  3. Verify both processed; `documents.source_path` stores the UTF-8 representation correctly
- **Expected Result:** UTF-8 path handling correct
- **Pass Criteria:** Both files ingested without error

---

## 6. UC-6: Direct Shell Invocation `sdlc-knowledge ingest`

### TC-6.1: Direct shell ingest produces human-readable text output by default
- **Category:** Ingest / Direct CLI
- **Mapped UC:** UC-6
- **Mapped FR:** FR-1.2, FR-1.3, FR-1.4
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Binary present; supported file in `sources/`
- **Inputs:** `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest .claude/knowledge/sources`
- **Steps:**
  1. Run direct shell invocation without `--json`
  2. Verify per-file output is human-readable (e.g., `ingested: <path> -- <chunk-count> chunks`)
  3. Verify final summary `total: <source-count> sources, <chunk-count> chunks`
  4. Exit 0
- **Expected Result:** Default text output (FR-1.4); same DB state as UC-5
- **Pass Criteria:** Default output contract verified

### TC-6.2: Direct invocation with `--json` produces machine-readable output
- **Category:** Ingest / JSON Mode
- **Mapped UC:** UC-6-A1
- **Mapped FR:** FR-1.4
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Same as TC-6.1
- **Inputs:** `sdlc-knowledge ingest <path> --json`
- **Steps:**
  1. Run with `--json`
  2. Verify stdout is parseable JSON via `jq .`
  3. Verify per-file JSON record shape
- **Expected Result:** Output is valid JSON
- **Pass Criteria:** JSON mode contract verified

### TC-6.3: Explicit `--project-root` pointing to a sibling project subdirectory
- **Category:** Ingest / Cross-Project
- **Mapped UC:** UC-6-A2
- **Mapped FR:** FR-1.3, FR-1.5
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Binary present; cwd has subdirectory `./other-project/`
- **Inputs:** `sdlc-knowledge ingest ./other-project/sources --project-root ./other-project`
- **Steps:**
  1. Create `./other-project/.claude/knowledge/sources/sample.md`
  2. Run the ingest from cwd parent
  3. Verify `./other-project/.claude/knowledge/index.db` is created (NOT cwd's `.claude/knowledge/index.db`)
- **Expected Result:** Binary writes only under canonical `<project-root>/.claude/knowledge/` per FR-1.3
- **Pass Criteria:** Per-project isolation verified

### TC-6.4: Direct invocation inherits all UC-5 error flows (path traversal, corrupt PDF, etc.)
- **Category:** Ingest / Error Inheritance
- **Mapped UC:** UC-6-E1
- **Mapped FR:** FR-1.5, FR-1.6, FR-2.6
- **Mapped AC:** AC-6, AC-7
- **Type:** integration / security
- **Severity:** P1
- **Preconditions:** Same as UC-5 error preconditions
- **Inputs:** Run TC-5.5, TC-5.6, TC-5.7, TC-5.8 against direct shell invocation
- **Steps:**
  1. Repeat each UC-5 error flow case against direct shell invocation
  2. Verify identical exit codes and literal stderr messages
- **Expected Result:** Direct invocation has identical error handling as slash-command-based invocation
- **Pass Criteria:** AC-6, AC-7 enforcement uniform across invocation paths

### TC-6.5: Direct invocation outside any project (cwd is /tmp)
- **Category:** Ingest / cwd Edge Case
- **Mapped UC:** UC-6-EC1
- **Mapped FR:** FR-1.3
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Binary present; cwd is `/tmp`
- **Inputs:** `cd /tmp && sdlc-knowledge ingest <some-path>`
- **Steps:**
  1. cd to `/tmp`
  2. Run ingest
  3. Verify `/tmp/.claude/knowledge/index.db` is created (binary's contract per FR-1.3)
- **Expected Result:** Binary creates a "project" at `/tmp`; FR-1.3 contract is unconditional
- **Pass Criteria:** Unusual but supported flow works

---

## 7. UC-7: `sdlc-knowledge search` BM25 Search

### TC-7.1: Search returns ranked JSON array within ≤500 ms over 10 000-chunk DB
- **Category:** Search / Happy Path
- **Mapped UC:** UC-7
- **Mapped FR:** FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-1.4, NFR-1.2, NFR-1.6
- **Mapped AC:** AC-5
- **Type:** integration / performance / E2E
- **Severity:** P0
- **Preconditions:** Binary present; `index.db` seeded with 10 000 chunks (fixture from `tools/sdlc-knowledge/tests/fixtures/`)
- **Inputs:** `sdlc-knowledge search "credit risk hedging" --top-k 5 --json`
- **Steps:**
  1. Seed the index with the 10 000-chunk fixture
  2. Record start timestamp `T0`
  3. Run search
  4. Record end timestamp `T1`
  5. Verify `T1 - T0 ≤ 500 ms`
  6. Parse stdout as JSON
  7. Verify the array length is ≤ 5
  8. Verify each element has the literal shape `{"source": <string>, "chunk_id": <int>, "ord": <int>, "score": <number>, "snippet": <string>}`
  9. Verify the array is ordered best-first (ranking convention is verified end-to-end via TC-AAI-2)
  10. Exit 0
- **Expected Result:** AC-5 latency budget met; valid JSON shape; results ordered best-first
- **Pass Criteria:** AC-5 satisfied

### TC-7.2: Default `--top-k` (no flag) returns ≤ 5 results
- **Category:** Search / Default
- **Mapped UC:** UC-7-A1
- **Mapped FR:** FR-3.2
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Same as TC-7.1
- **Inputs:** `sdlc-knowledge search "<query>" --json` (no `--top-k`)
- **Steps:**
  1. Run search without `--top-k`
  2. Parse JSON
  3. Verify array length ≤ 5
- **Expected Result:** Default top-k = 5 per FR-3.2
- **Pass Criteria:** Default contract verified

### TC-7.3: Default text output (no `--json`)
- **Category:** Search / Text Mode
- **Mapped UC:** UC-7-A2
- **Mapped FR:** FR-1.4
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Same as TC-7.1
- **Inputs:** `sdlc-knowledge search "<query>"`
- **Steps:**
  1. Run search without `--json`
  2. Verify stdout is human-readable text (one chunk per stanza with score, source, snippet)
- **Expected Result:** Text-mode output per FR-1.4
- **Pass Criteria:** Default text output verified

### TC-7.4: `--top-k 100` (upper-bound)
- **Category:** Search / Upper Bound
- **Mapped UC:** UC-7-A3
- **Mapped FR:** FR-3.2
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Index has ≥ 100 chunks
- **Inputs:** `sdlc-knowledge search "<query>" --top-k 100 --json`
- **Steps:**
  1. Run search with `--top-k 100`
  2. Verify result array length ≤ 100
- **Expected Result:** Upper bound accepted
- **Pass Criteria:** FR-3.2 upper-bound clamp boundary verified

### TC-7.5: `--top-k 500` clamped to 100
- **Category:** Search / Clamp
- **Mapped UC:** UC-7-A4
- **Mapped FR:** FR-3.2
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Same as TC-7.4
- **Inputs:** `sdlc-knowledge search "<query>" --top-k 500 --json`
- **Steps:**
  1. Run search with `--top-k 500`
  2. Verify result array length ≤ 100 (clamped)
  3. Verify exit 0 (silent clamp per FR-3.2 wording)
- **Expected Result:** Silent clamp to 100; no rejection
- **Pass Criteria:** FR-3.2 clamping verified

### TC-7.6: Corrupt `index.db` (truncated to 100 bytes) → exit 1 with literal message; no panic
- **Category:** Search / Corrupt Index
- **Mapped UC:** UC-7-E1
- **Mapped FR:** FR-1.6
- **Mapped AC:** AC-7
- **Type:** integration / security
- **Severity:** P0
- **Preconditions:** Binary present; valid index exists
- **Inputs:** Truncate `index.db` to 100 bytes; run search
- **Steps:**
  1. `truncate -s 100 <cwd>/.claude/knowledge/index.db`
  2. Run `sdlc-knowledge search "<query>"`
  3. Capture exit code, stderr
- **Expected Result:** Exit code 1; stderr contains the literal `error: index database invalid; re-ingest required`; stderr does NOT contain `panicked at`
- **Pass Criteria:** AC-7 satisfied verbatim

### TC-7.7: Empty `index.db` (no documents ingested) → exit 0 with `[]`
- **Category:** Search / No Results
- **Mapped UC:** UC-7-E2
- **Mapped FR:** FR-3.4
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Index exists but `chunks` table is empty
- **Inputs:** `sdlc-knowledge search "anything" --json`
- **Steps:**
  1. Initialize empty index (run any subcommand to create it, or seed schema only)
  2. Run search
  3. Verify exit 0 and stdout is `[]`
- **Expected Result:** Empty array; exit 0; no-results is not an error
- **Pass Criteria:** FR-3.4 verified

### TC-7.8: FTS5 query syntax error → exit 1 with clear message; no panic
- **Category:** Search / Bad Query
- **Mapped UC:** UC-7-E3
- **Mapped FR:** FR-1.6, FR-3.1
- **Mapped AC:** AC-7 (no-panic invariant)
- **Type:** integration / security
- **Severity:** P1
- **Preconditions:** Index has rows
- **Inputs:** `sdlc-knowledge search '"unbalanced quote' --top-k 5 --json`
- **Steps:**
  1. Run search with malformed FTS5 query
  2. Capture exit code, stderr
- **Expected Result:** Exit 1; stderr contains a clear error of the form `error: invalid search query: <fts5-error>`; no `panicked at` in stderr
- **Pass Criteria:** No-panic invariant per FR-1.6

### TC-7.9: Index file absent → exit 1 with actionable message
- **Category:** Search / Missing Index
- **Mapped UC:** UC-7-E4
- **Mapped FR:** FR-1.6
- **Mapped AC:** AC-5 (negative path)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** `<project>/.claude/knowledge/index.db` does NOT exist
- **Inputs:** `sdlc-knowledge search "<query>"`
- **Steps:**
  1. Ensure no index exists
  2. Run search
- **Expected Result:** Exit 1; stderr contains a clear message of the form `error: index not found at <path>; run sdlc-knowledge ingest <source-dir> first`; no panic
- **Pass Criteria:** Distinct from corrupt-index case; recoverable by ingest

### TC-7.10: Multi-word phrase query (FTS5 default operator)
- **Category:** Search / Multi-Word
- **Mapped UC:** UC-7-EC1
- **Mapped FR:** FR-3.1
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Index has chunks containing both single and multi-word matches
- **Inputs:** `sdlc-knowledge search "credit risk hedging" --top-k 5 --json`
- **Steps:**
  1. Seed index with three docs: one mentioning all three terms, one mentioning two, one mentioning one
  2. Run search
  3. Verify the three-term doc is ranked highest
- **Expected Result:** BM25 ranks chunks with all three terms higher
- **Pass Criteria:** Standard FTS5 behavior verified

### TC-7.11: Non-English language query (unicode61 tokenizer)
- **Category:** Search / Unicode
- **Mapped UC:** UC-7-EC2
- **Mapped FR:** FR-3.1
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Index contains a document with Russian text
- **Inputs:** `sdlc-knowledge search "финансы" --top-k 5 --json`
- **Steps:**
  1. Ingest a Russian-language document
  2. Run search with Russian query
  3. Verify ≥ 1 result
- **Expected Result:** unicode61 tokenizer matches Russian tokens
- **Pass Criteria:** Non-ASCII queries work

### TC-7.12: Two equally-ranked chunks tie-break deterministically
- **Category:** Search / Tie-Breaking
- **Mapped UC:** UC-7-EC3
- **Mapped FR:** FR-3.1
- **Mapped AC:** AC-5
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Index has at least two chunks with identical text producing tied BM25 scores
- **Inputs:** Run the same search twice and compare ordering
- **Steps:**
  1. Seed index with two duplicate chunks
  2. Run `search "<query>" --json` twice
  3. Compare result order
- **Expected Result:** Result order is identical across runs (deterministic secondary key)
- **Pass Criteria:** Reproducible ordering

---

## 8. UC-8: `list / status / delete` Subcommands

### TC-8.1: `list` returns JSON array of `{source_path, chunk_count, ingested_at}`
- **Category:** Subcommand / List
- **Mapped UC:** UC-8 (list)
- **Mapped FR:** FR-1.2, FR-1.4, FR-2.4
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Index has ≥ 1 document
- **Inputs:** `sdlc-knowledge list --json`
- **Steps:**
  1. Run list
  2. Parse JSON
  3. Verify array shape
- **Expected Result:** JSON array; one element per ingested document
- **Pass Criteria:** Slice 3 done-condition for `list` verified

### TC-8.2: `status` returns JSON object `{schema_version, doc_count, chunk_count, db_path}`
- **Category:** Subcommand / Status
- **Mapped UC:** UC-8 (status)
- **Mapped FR:** FR-1.2, FR-1.4, FR-4.2
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Index exists
- **Inputs:** `sdlc-knowledge status --json`
- **Steps:**
  1. Run status
  2. Parse JSON
  3. Verify keys: `schema_version`, `doc_count`, `chunk_count`, `db_path`
  4. Verify `schema_version` = 1 (iter-1)
- **Expected Result:** JSON object with the four keys
- **Pass Criteria:** Slice 3 done-condition for `status` verified

### TC-8.3: `delete <source-id>` removes matching rows; FTS5 sync verified
- **Category:** Subcommand / Delete
- **Mapped UC:** UC-8 (delete)
- **Mapped FR:** FR-1.2, FR-2.4, FR-4.2
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Index has ≥ 1 document with known source-id
- **Inputs:** `sdlc-knowledge delete <source-id>`
- **Steps:**
  1. Capture `documents` and `chunks` row counts before delete
  2. Run delete
  3. Capture row counts after delete
  4. Run `sdlc-knowledge search "<term-from-deleted-doc>" --json` and verify the deleted chunks are not returned
- **Expected Result:** Document row removed; cascading chunks removed; FTS5 sync via trigger; subsequent search excludes deleted chunks
- **Pass Criteria:** Slice 3 done-condition for `delete` verified

### TC-8.4: `delete` with non-existent source-id is idempotent
- **Category:** Subcommand / Delete Idempotency
- **Mapped UC:** UC-8-A1
- **Mapped FR:** FR-1.2
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Index exists; the chosen `<source-id>` is NOT present
- **Inputs:** `sdlc-knowledge delete 99999`
- **Steps:**
  1. Run delete with non-existent source-id
  2. Capture exit code
  3. Verify DB row counts unchanged
- **Expected Result:** Either exit 0 (idempotent) or exit 1 with a clear "not found" message — implementation-time decision per Slice 3 — but DB state unchanged either way
- **Pass Criteria:** No DB corruption regardless of chosen behavior

### TC-8.5: Default text output for list / status / delete
- **Category:** Subcommand / Text Mode
- **Mapped UC:** UC-8-A2
- **Mapped FR:** FR-1.4
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Index exists
- **Inputs:** Run each subcommand without `--json`
- **Steps:**
  1. Run `sdlc-knowledge list`, `status`, `delete <id>` without `--json`
  2. Verify output is human-readable for each
- **Expected Result:** Text-mode output per FR-1.4 for all three subcommands
- **Pass Criteria:** FR-1.4 verified

### TC-8.6: Corrupt `index.db` for list/status → exit 1 with literal message
- **Category:** Subcommand / Corrupt Index
- **Mapped UC:** UC-8-E1
- **Mapped FR:** FR-1.6
- **Mapped AC:** AC-7
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Truncated index.db
- **Inputs:** Run list / status against the corrupt index
- **Steps:**
  1. Truncate index.db
  2. Run `sdlc-knowledge list` and capture exit code + stderr
  3. Run `sdlc-knowledge status` and capture exit code + stderr
- **Expected Result:** Both exit 1 with literal `error: index database invalid; re-ingest required`; no panic
- **Pass Criteria:** AC-7 enforced uniformly across read subcommands

### TC-8.7: Database lock contention during delete → SQLITE_BUSY handled
- **Category:** Subcommand / Concurrency
- **Mapped UC:** UC-8-E2
- **Mapped FR:** FR-2.7, NFR-1.6
- **Mapped AC:** (no direct AC)
- **Type:** integration / concurrency
- **Severity:** P2
- **Preconditions:** Another process holds a write lock
- **Inputs:** Two concurrent `delete` invocations
- **Steps:**
  1. Open a SQLite write transaction in process A and hold it
  2. Run `sdlc-knowledge delete <id>` from process B
  3. Verify B waits up to busy_timeout, then exits 1 with a clear error; no panic
- **Expected Result:** Lock contention surfaces as exit 1 with clear message
- **Pass Criteria:** No deadlock; clear error

### TC-8.8: `status` on empty but valid index
- **Category:** Subcommand / Empty State
- **Mapped UC:** UC-8-EC1
- **Mapped FR:** FR-1.2, FR-4.2
- **Mapped AC:** (no direct AC)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Empty index (schema only, no rows)
- **Inputs:** `sdlc-knowledge status --json`
- **Steps:**
  1. Initialize empty index
  2. Run status
- **Expected Result:** `{"schema_version": 1, "doc_count": 0, "chunk_count": 0, "db_path": "<path>"}`
- **Pass Criteria:** Empty-state status correct

---

## 9. UC-9: Re-Ingesting Unchanged File (Idempotent No-Op)

### TC-9.1: Re-ingest unchanged file logs `unchanged: <path>`; no DB writes
- **Category:** Ingest / Idempotency
- **Mapped UC:** UC-9
- **Mapped FR:** FR-2.4, FR-2.5, NFR-1.7
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Prior ingest succeeded for `<path>`; file unchanged since
- **Inputs:** `sdlc-knowledge ingest <path>` (second run)
- **Steps:**
  1. Capture `documents` row sha256 (entire row serialized) and `chunks` row count before re-ingest
  2. Re-run ingest on the same path
  3. Capture `documents` row sha256 and `chunks` count after
  4. `grep -F "unchanged: " <ingest-stdout>` returns ≥ 1
  5. Verify total elapsed time ≤ 50 ms per document (sha256 + lookup)
- **Expected Result:** DB state unchanged; literal `unchanged: <path>` log line emitted; per NFR-1.7 ≤50 ms per document
- **Pass Criteria:** AC-4 idempotency verified

### TC-9.2: Mixed batch (some unchanged, some new) → per-file decision
- **Category:** Ingest / Mixed Batch
- **Mapped UC:** UC-9-A1
- **Mapped FR:** FR-2.5
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Directory has 5 files; 3 already in index unchanged, 2 brand new
- **Inputs:** `sdlc-knowledge ingest <dir>`
- **Steps:**
  1. Run ingest
  2. Verify 3 `unchanged: <path>` log lines, 2 new ingestion records
  3. Verify final summary reports the breakdown (e.g., 2 ingested, 3 unchanged)
- **Expected Result:** Per-file decision applied correctly
- **Pass Criteria:** Mixed-batch idempotency verified

### TC-9.3: File renamed (different `source_path`) treated as new
- **Category:** Ingest / Rename
- **Mapped UC:** UC-9-A2
- **Mapped FR:** FR-2.4, FR-2.5
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** File ingested as `old.md`; renamed to `new.md` with identical content
- **Inputs:** `sdlc-knowledge ingest <dir-after-rename>`
- **Steps:**
  1. After initial ingest, rename `old.md` → `new.md` (content unchanged)
  2. Re-ingest the directory
  3. Verify `new.md` was treated as a new document (re-chunked); old.md row remains until manually deleted
- **Expected Result:** Rename treated as new file per Risk #9; iter-1 acceptable cost
- **Pass Criteria:** FR-2.4 keying behavior verified

### TC-9.4: Concurrent ingest + search via WAL — both proceed without deadlock
- **Category:** Concurrency / WAL
- **Mapped UC:** UC-9-E1
- **Mapped FR:** FR-2.7, FR-2.6, NFR-1.6
- **Mapped AC:** (no direct AC; covered by Risk #10)
- **Type:** integration / concurrency
- **Severity:** P1
- **Preconditions:** Index seeded; binary present
- **Inputs:** Run `sdlc-knowledge ingest <large-dir>` in process A while running `sdlc-knowledge search "<query>"` repeatedly in process B
- **Steps:**
  1. Start a long-running ingest in process A
  2. While A runs, run search in process B 10 times rapidly
  3. Capture exit codes for B's invocations
- **Expected Result:** All B invocations exit 0; results reflect a consistent snapshot per WAL semantics; no deadlock; no panic in either process
- **Pass Criteria:** WAL concurrency verified per FR-2.7 / NFR-1.6

### TC-9.5: `mtime` updated by `touch` but content unchanged → sha256 saves the day
- **Category:** Ingest / Touch Behavior
- **Mapped UC:** UC-9-E2
- **Mapped FR:** FR-2.5, NFR-1.7
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** File previously ingested
- **Inputs:** `touch <path>` then re-ingest
- **Steps:**
  1. Record original `mtime` of the file
  2. `touch <path>` to update mtime without content change
  3. Re-run ingest
  4. Verify the binary did NOT re-chunk (no new chunk rows)
  5. Verify `documents.mtime` may be updated to the new value but content remains
- **Expected Result:** Per NFR-1.7 spirit (mtime+sha256), unchanged content is no-op even on mtime change
- **Pass Criteria:** sha256 takes precedence over mtime drift

### TC-9.6: File deleted between two ingests → stale row remains until manual delete
- **Category:** Ingest / Stale Row
- **Mapped UC:** UC-9-EC1
- **Mapped FR:** FR-2.5
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** File previously ingested; then deleted from sources
- **Inputs:** Re-run ingest on the directory
- **Steps:**
  1. Delete `<path>` from sources
  2. Re-run ingest
  3. Verify the recursive walk does NOT see the deleted file
  4. Verify the prior `documents` row remains in the index
- **Expected Result:** iter-1 does NOT auto-prune; documented as expected
- **Pass Criteria:** No iter-1 auto-prune behavior

---

## 10. UC-10: Re-Ingesting Changed File (Re-Chunk + FTS5 Sync)

### TC-10.1: Modified file → BEGIN IMMEDIATE → delete old chunks → re-chunk → FTS5 sync
- **Category:** Ingest / Re-Chunk
- **Mapped UC:** UC-10
- **Mapped FR:** FR-2.4, FR-2.5, FR-2.6, FR-4.2, NFR-1.7
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P0
- **Preconditions:** File previously ingested (50 chunks); content modified (sha256 changes)
- **Inputs:** Re-ingest the modified file
- **Steps:**
  1. Capture old `chunks` row count for the document
  2. Modify the file content
  3. Re-ingest
  4. Verify `documents.sha256`, `mtime`, `ingested_at` updated
  5. Verify all old `chunks` rows for this `doc_id` are gone
  6. Verify new `chunks` rows are present
  7. Verify `chunks_fts` row count for this doc matches new `chunks` count (FTS5 trigger fired)
  8. Run `search "<term-only-in-new-content>"` and verify the new chunk is found
- **Expected Result:** Atomic per-document replacement; FTS5 sync via triggers
- **Pass Criteria:** AC-4 re-chunk path verified

### TC-10.2: Re-ingest where chunk count changes (50 → 80)
- **Category:** Ingest / Chunk Count Change
- **Mapped UC:** UC-10-A1
- **Mapped FR:** FR-2.5, FR-4.2
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P2
- **Preconditions:** File previously produced 50 chunks; new content produces 80
- **Inputs:** Re-ingest
- **Steps:**
  1. Verify before: 50 chunks
  2. Modify file to grow content
  3. Re-ingest
  4. Verify after: 80 chunks; FTS5 sync verified
- **Expected Result:** Old 50 deleted, new 80 inserted, all triggers fired
- **Pass Criteria:** Variable chunk count handled correctly

### TC-10.3: Re-chunk fails mid-transaction → rollback; old chunks intact
- **Category:** Ingest / Rollback
- **Mapped UC:** UC-10-E1
- **Mapped FR:** FR-2.6, FR-4.2
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** PDF crate fails on the modified file (e.g., truncated PDF)
- **Inputs:** Re-ingest the now-corrupt file
- **Steps:**
  1. Capture old chunks count
  2. Replace file with a truncated PDF
  3. Re-ingest
  4. Verify per-file error in stderr
  5. Verify old chunks for this doc are STILL intact (rollback succeeded)
  6. Verify other docs in batch are unaffected
- **Expected Result:** `BEGIN IMMEDIATE` rollback preserves old state; batch continues
- **Pass Criteria:** Per-document rollback verified

### TC-10.4: Re-ingest reduces chunk count to zero (file emptied)
- **Category:** Ingest / Zero Chunks
- **Mapped UC:** UC-10-EC1
- **Mapped FR:** FR-2.5
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P3
- **Preconditions:** File previously produced ≥ 1 chunk; content emptied
- **Inputs:** Re-ingest
- **Steps:**
  1. Empty the file (`> file.md`)
  2. Re-ingest
  3. Verify `chunks` count for this doc = 0
  4. Verify `documents` row remains
  5. Verify `search` excludes this document
- **Expected Result:** Zero-chunk state handled; document row remains
- **Pass Criteria:** Edge case handled

### TC-10.5: FTS5 trigger fails to fire (regression detection)
- **Category:** Ingest / Trigger Sync
- **Mapped UC:** UC-10-EC2
- **Mapped FR:** FR-4.2
- **Mapped AC:** AC-4
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Slice 2 done-condition includes a trigger correctness test
- **Inputs:** Insert / update / delete operations against `chunks` table directly
- **Steps:**
  1. Insert a row into `chunks`; verify `chunks_fts` row appears
  2. Update the row's text; verify `chunks_fts` updated
  3. Delete the row; verify `chunks_fts` row removed
  4. Run `search "<text-from-deleted-row>"` and verify zero hits
- **Expected Result:** FTS5 stays in sync with `chunks` via standard insert/update/delete triggers per FR-4.2
- **Pass Criteria:** Schema-integrity invariant verified

---

## 11. UC-11: 12 Thinking Agents Detect Activation Sentinel and Query

### TC-11.1: Each of 12 in-scope agents has `## Knowledge Base (when present)` section appended at end of prompt
- **Category:** Agent Activation
- **Mapped UC:** UC-11
- **Mapped FR:** FR-5.1, FR-5.2, FR-5.3
- **Mapped AC:** AC-10
- **Type:** unit (file structure)
- **Severity:** P0
- **Preconditions:** Common preconditions
- **Inputs:** The 12 agent prompt files
- **Steps:**
  1. For each of `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`:
     a. `grep -Fxc "## Knowledge Base (when present)" src/agents/<agent>.md` returns 1
     b. The section is the LAST `^## ` heading in the file (verify the section appears AFTER `## Cognitive Self-Check (MANDATORY)` if present)
     c. The section body references `~/.claude/rules/knowledge-base.md` per FR-5.2(a)
     d. The section body contains the literal CLI invocation `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json` per FR-5.2(c)
     e. The section body specifies the `## Facts → ### External contracts` location for citations per FR-5.2(d)
     f. The section body references the activation sentinel `<project>/.claude/knowledge/index.db` per FR-5.2(b)
- **Expected Result:** All 12 in-scope agents have correct activation block; positioned at end; references all FR-5.2 components
- **Pass Criteria:** All 12 agents pass the structural check

### TC-11.2: Agent issues multiple distinct queries (multi-query authoring)
- **Category:** Agent Behavior
- **Mapped UC:** UC-11-A1
- **Mapped FR:** FR-5.2(c)
- **Mapped AC:** AC-10
- **Type:** integration / E2E
- **Severity:** P2
- **Preconditions:** Sentinel present; index has cross-domain content
- **Inputs:** `/bootstrap-feature` for a feature that spans multiple domain topics
- **Steps:**
  1. Run bootstrap with a feature whose domain has 2-3 distinct query topics
  2. Capture transcript
  3. `grep -c "sdlc-knowledge search" <transcript>` returns ≥ 2 per agent for that agent
  4. Inspect `### External contracts` for ≥ 2 distinct `knowledge-base:` citations
- **Expected Result:** Multi-query authoring observable in transcript; multiple citations
- **Pass Criteria:** Multi-query path works

### TC-11.3: Search returns zero hits → no citation, optional `### Open questions` entry
- **Category:** Agent Behavior
- **Mapped UC:** UC-11-A2
- **Mapped FR:** FR-5.2, FR-10.3
- **Mapped AC:** AC-10 (citation conditional on relevant content)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Sentinel present but query has no matches
- **Inputs:** Agent issues query with no matching chunks
- **Steps:**
  1. Verify `sdlc-knowledge search "<unmatched-query>"` returns `[]`
  2. Verify the agent's `### External contracts` does NOT contain a `knowledge-base:` citation for this query
  3. Verify no Plan Critic finding fires for the missing citation
  4. Optionally verify `### Open questions` notes the gap
- **Expected Result:** Zero-hit query handled without false-positive Plan Critic finding
- **Pass Criteria:** FR-10.3 verified

### TC-11.4: Agent queries during /develop-feature slice (mid-pipeline)
- **Category:** Agent Behavior
- **Mapped UC:** UC-11-A3
- **Mapped FR:** FR-5.1, FR-5.2
- **Mapped AC:** AC-10
- **Type:** integration / E2E
- **Severity:** P2
- **Preconditions:** Sentinel present; binary present
- **Inputs:** `/develop-feature` reaching slice authoring
- **Steps:**
  1. Run develop-feature
  2. During a Wave with planner/architect activation, capture the agent's activation block invocation
  3. Verify the agent issued a CLI search and added a `knowledge-base:` citation
- **Expected Result:** Mid-pipeline activation works
- **Pass Criteria:** Per-slice activation verified

### TC-11.5: Agent attempts to query but binary path wrong / allowlist missing
- **Category:** Agent Backward Compat
- **Mapped UC:** UC-11-E1
- **Mapped FR:** FR-5.5, FR-10.2
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Sentinel present; binary missing OR allowlist missing
- **Inputs:** Run agent with binary path mis-set
- **Steps:**
  1. Remove or rename the binary
  2. Run an in-scope agent invocation
  3. Capture transcript
  4. `grep -Fxc "knowledge-base: tool not installed; skipping" <transcript>` returns ≥ 1
  5. Verify agent's `### Open questions` contains a corresponding entry per FR-5.5
  6. Verify pipeline does NOT abort
- **Expected Result:** Skip line emitted; pipeline continues
- **Pass Criteria:** AC-9 satisfied

### TC-11.6: Agent forgets to cite a load-bearing chunk (output drift)
- **Category:** Agent / Citation Drift
- **Mapped UC:** UC-11-E2
- **Mapped FR:** FR-7.1, FR-10.3
- **Mapped AC:** AC-10
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Sentinel present; agent reads chunks but does not cite them
- **Inputs:** Synthetic agent transcript missing citations
- **Steps:**
  1. Inspect the agent's authored artifact
  2. Verify Plan Critic does NOT mechanically catch missing knowledge-base citations per FR-10.3
  3. Confirm cognitive-self-check protocol places the responsibility on the agent
- **Expected Result:** iter-1 does not enforce knowledge-base citation completeness mechanically; the agent's prompt is the surface that catches drift
- **Pass Criteria:** FR-10.3 boundary respected

### TC-11.7: Activation sentinel present but binary absent
- **Category:** Agent / State Mismatch
- **Mapped UC:** UC-11-EC1
- **Mapped FR:** FR-5.5, FR-10.2
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P1
- **Preconditions:** index.db exists but binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent
- **Inputs:** Run any in-scope agent
- **Steps:**
  1. Ensure `<cwd>/.claude/knowledge/index.db` exists (touch a valid file or do a tiny ingest first then remove binary)
  2. Remove binary
  3. Run agent
  4. `grep -Fxc "knowledge-base: tool not installed; skipping" <transcript>` returns 1
- **Expected Result:** Agent emits skip line; degrades to UC-14
- **Pass Criteria:** Sentinel-present + binary-absent path verified

### TC-11.8: Activation block accidentally placed BEFORE existing prompt sections
- **Category:** Agent / Block Position
- **Mapped UC:** UC-11-EC2
- **Mapped FR:** FR-5.3
- **Mapped AC:** AC-10
- **Type:** unit (file structure)
- **Severity:** P2
- **Preconditions:** Each of the 12 agent prompts
- **Inputs:** The agent prompt files
- **Steps:**
  1. For each in-scope agent file, verify `## Knowledge Base (when present)` is the LAST `^## ` heading using `awk '/^## / { last = $0 } END { print last }' src/agents/<agent>.md` returns the literal `## Knowledge Base (when present)`
- **Expected Result:** Activation block is the last top-level heading in every in-scope agent prompt
- **Pass Criteria:** FR-5.3 placement verified

### TC-11.9: Executor agent prompt accidentally modified to add the activation block (FR-5.4 violation)
- **Category:** Invariant / Executor Exemption
- **Mapped UC:** UC-11-EC3
- **Mapped FR:** FR-5.4, FR-12.3
- **Mapped AC:** AC-11
- **Type:** unit / regression
- **Severity:** P0
- **Preconditions:** None
- **Inputs:** The 5 executor agent prompt files
- **Steps:**
  1. For each of `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`:
     a. `grep -Fxc "## Knowledge Base (when present)" src/agents/<agent>.md` returns 0
     b. `git diff <pre-merge-commit> -- src/agents/<agent>.md` returns empty
- **Expected Result:** Zero matches and zero diff for each executor file
- **Pass Criteria:** FR-5.4 / FR-12.3 / AC-11 enforced; supersedes by TC-INV-5

---

## 12. UC-12: Citation Format in `## Facts → ### External contracts`

### TC-12.1: Agent emits literal citation `knowledge-base: <file>:<chunk-id> -- query: "<q>" -- BM25: <s> -- verified: yes`
- **Category:** Citation / Format
- **Mapped UC:** UC-12
- **Mapped FR:** FR-7.1, FR-7.3, FR-10.3, FR-10.4, FR-12.5
- **Mapped AC:** AC-10
- **Type:** integration
- **Severity:** P0
- **Preconditions:** UC-11 has executed; load-bearing chunk read
- **Inputs:** Agent's authored artifact with `## Facts → ### External contracts` block
- **Steps:**
  1. Inspect the artifact's `### External contracts` subsection
  2. Find at least one entry matching the regex `knowledge-base: [^:]+:[0-9]+ -- query: "[^"]+" -- BM25: -?[0-9.]+ -- verified: yes`
  3. Verify each component is present: source filename, chunk_id integer, query string, BM25 score (float, may be negative), `verified: yes`
- **Expected Result:** Citation matches FR-7.1 literal format
- **Pass Criteria:** AC-10 satisfied verbatim

### TC-12.2: Citation alongside non-knowledge-base external contract (mixed sources)
- **Category:** Citation / Mixed
- **Mapped UC:** UC-12-A1
- **Mapped FR:** FR-7.1, FR-7.3
- **Mapped AC:** AC-10
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Agent integrates both knowledge-base hit and external SDK
- **Inputs:** Synthetic artifact with both
- **Steps:**
  1. Inspect `### External contracts`
  2. Verify both a `knowledge-base:` entry AND a separate `Stripe...` (or similar) entry exist
  3. Verify Plan Critic accepts both formats
- **Expected Result:** Mixed citations valid
- **Pass Criteria:** No Plan Critic finding

### TC-12.3: Citation in stdout-only artifact (architect / security-auditor / code-reviewer / verifier / refactor-cleaner)
- **Category:** Citation / Stdout
- **Mapped UC:** UC-12-A2
- **Mapped FR:** FR-7.1, Section 9 FR-4.6
- **Mapped AC:** AC-10
- **Type:** integration (manual transcript inspection)
- **Severity:** P2
- **Preconditions:** Stdout-only agent invocation with load-bearing knowledge-base hit
- **Inputs:** Architect / security-auditor / etc. transcript
- **Steps:**
  1. Capture stdout transcript
  2. Locate `## Facts` block before verdict
  3. Verify `### External contracts` contains the `knowledge-base:` citation
  4. Verify Plan Critic does NOT fire on stdout (per Section 9 FR-4.6)
- **Expected Result:** Stdout citation valid; enforcement is the agent's prompt's responsibility
- **Pass Criteria:** Stdout split respected

### TC-12.4: Agent emits malformed citation (drops `BM25:` field)
- **Category:** Citation / Format Drift
- **Mapped UC:** UC-12-E1
- **Mapped FR:** FR-7.1
- **Mapped AC:** AC-10
- **Type:** unit / regression
- **Severity:** P1
- **Preconditions:** Synthetic artifact with truncated citation
- **Inputs:** `### External contracts` containing `knowledge-base: <source>:<chunk-id> -- verified: yes` (missing query: and BM25:)
- **Steps:**
  1. Run a grep test against the artifact: `grep -E "knowledge-base: [^:]+:[0-9]+ -- query: \"[^\"]+\" -- BM25: -?[0-9.]+ -- verified: yes"` returns 0 lines
  2. Confirm the malformed citation surfaces at QA / merge-ready time
- **Expected Result:** Format-drift detection at QA time; iter-1 Plan Critic does NOT mechanically validate component structure
- **Pass Criteria:** Drift detectable via grep regex

### TC-12.5: Agent cites a chunk it never read (hallucinated citation)
- **Category:** Citation / Hallucination
- **Mapped UC:** UC-12-E2
- **Mapped FR:** FR-7.1, Section 9 FR-1.2
- **Mapped AC:** AC-10
- **Type:** integration
- **Severity:** P1
- **Preconditions:** Agent disobeys cognitive-self-check Q2 (freshness)
- **Inputs:** Artifact with citation referencing non-existent chunk_id
- **Steps:**
  1. Cross-check each `knowledge-base:` citation's `<source>:<chunk-id>` against actual `chunks.id` values in the live `index.db`
  2. Any unmatched citation indicates hallucination
- **Expected Result:** All citations resolve to real chunk_ids; the audit trail makes any drift visible to the next reviewer
- **Pass Criteria:** Hallucination detectable via DB cross-check

### TC-12.6: Source filename contains a colon
- **Category:** Citation / Edge Case
- **Mapped UC:** UC-12-EC1
- **Mapped FR:** FR-7.1
- **Mapped AC:** AC-10
- **Type:** unit
- **Severity:** P3
- **Preconditions:** Document with colon in filename (e.g., `a:b.pdf`)
- **Inputs:** Citation referencing this file
- **Steps:**
  1. Ingest a file named `a:b.pdf`
  2. Run search; capture the JSON `source` field
  3. Construct a citation
  4. Verify the rule file `src/rules/knowledge-base.md` documents the chosen escape convention OR documents that filenames with colons are unsupported in iter-1
- **Expected Result:** Either escape convention or documented limitation
- **Pass Criteria:** Rule file is unambiguous

### TC-12.7: BM25 score is negative or zero
- **Category:** Citation / Score Edge
- **Mapped UC:** UC-12-EC2
- **Mapped FR:** FR-7.1
- **Mapped AC:** AC-10
- **Type:** unit
- **Severity:** P3
- **Preconditions:** A search produces a negative or zero BM25 score
- **Inputs:** Citation with `BM25: -1.234` or `BM25: 0.0`
- **Steps:**
  1. Verify the regex from TC-12.1 accepts negative numbers (`-?[0-9.]+`)
  2. Verify the agent emits whatever score appears in the JSON
- **Expected Result:** Negative / zero scores valid
- **Pass Criteria:** Regex and agent output handle negative scores

---

## 13. UC-13: Backward Compat Without `index.db`

### TC-13.1: Without sentinel, agents skip silently and produce behaviorally-identical output
- **Category:** Backward Compat / Sentinel Absent
- **Mapped UC:** UC-13
- **Mapped FR:** FR-5.5, FR-10.1, FR-10.3
- **Mapped AC:** AC-8
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Project has no `<cwd>/.claude/knowledge/index.db`
- **Inputs:** Run `/bootstrap-feature` for a synthetic feature
- **Steps:**
  1. Ensure no index.db exists
  2. Run bootstrap
  3. Capture authored PRD section, use-case file, plan
  4. Verify NO transcript line contains `knowledge-base:`
  5. Verify NO transcript line contains `tool not installed; skipping`
  6. Verify each authored artifact's `### External contracts` does NOT contain a `knowledge-base:` citation
  7. Verify Plan Critic does NOT raise findings about missing knowledge-base citations
- **Expected Result:** Silent no-op path; no log output; no citations; no Plan Critic findings
- **Pass Criteria:** AC-8 satisfied per FR-10.1 / FR-10.3

### TC-13.2: All 12 in-scope agents in one bootstrap pass produce identical output (with vs without index)
- **Category:** Backward Compat / System-Level
- **Mapped UC:** UC-13-A1
- **Mapped FR:** FR-10.1
- **Mapped AC:** AC-8
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Two project directories: one with index, one without
- **Inputs:** Run identical `/bootstrap-feature` against each
- **Steps:**
  1. Set up project A with index.db absent
  2. Set up project B with index.db absent (BOTH baseline-without-index runs)
  3. Run identical `/bootstrap-feature <feature>` against each
  4. Diff produced PRD/use-case/plan files between A and B
  5. Verify the diff is empty (deterministic without-index baseline)
- **Expected Result:** Pre-feature baseline output is reproducible; AC-8 verifiable via diff
- **Pass Criteria:** AC-8 reproducibility verified

### TC-13.3: Activation block invokes CLI even when sentinel absent (regression detection)
- **Category:** Regression / Sentinel Check
- **Mapped UC:** UC-13-E1
- **Mapped FR:** FR-5.2, FR-10.1
- **Mapped AC:** AC-8
- **Type:** integration / regression
- **Severity:** P1
- **Preconditions:** Synthetic regressed activation block that omits the sentinel check
- **Inputs:** Run agent with the regressed prompt
- **Steps:**
  1. Inject a regression in one agent's activation block (omit sentinel check)
  2. Run bootstrap
  3. Verify the agent invokes the CLI even though index.db is absent
  4. Capture and document drift
- **Expected Result:** Regression caught at AC-8 verification (output diff with-vs-without index)
- **Pass Criteria:** Regression detectable

### TC-13.4: Sentinel transitions from absent to present mid-cycle
- **Category:** Backward Compat / Transition
- **Mapped UC:** UC-13-EC1
- **Mapped FR:** FR-10.1
- **Mapped AC:** AC-8
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Bootstrap is mid-flight
- **Inputs:** User runs `/knowledge-ingest` between Step 1 (prd-writer) and Step 2 (ba-analyst)
- **Steps:**
  1. Run Step 1; verify UC-13 silent path
  2. Run `/knowledge-ingest` to create the sentinel
  3. Run Step 2; verify UC-11 query path
  4. Verify each step's behavior is correct given the state at that step
- **Expected Result:** Per-step behavior correct
- **Pass Criteria:** State-dependent behavior correct

---

## 14. UC-14: Backward Compat Without Binary

### TC-14.1: Without binary, agents log the literal skip line exactly once and proceed
- **Category:** Backward Compat / Binary Absent
- **Mapped UC:** UC-14
- **Mapped FR:** FR-5.5, FR-10.2, FR-10.3
- **Mapped AC:** AC-9
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Sentinel `<cwd>/.claude/knowledge/index.db` is present; binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent
- **Inputs:** Run an in-scope agent
- **Steps:**
  1. Ensure sentinel exists
  2. Remove binary
  3. Run an agent (e.g., `prd-writer`) via `/bootstrap-feature` Step 1
  4. Capture transcript
  5. `grep -Fxc "knowledge-base: tool not installed; skipping" <transcript>` returns exactly 1
  6. Verify agent's `### Open questions` contains an entry noting unavailability
  7. Verify pipeline did NOT abort
- **Expected Result:** Skip line emitted exactly once per agent; pipeline continues; AC-9 satisfied
- **Pass Criteria:** AC-9 verified verbatim

### TC-14.2: Multiple agents in one bootstrap each emit their own skip line
- **Category:** Backward Compat / Multi-Agent
- **Mapped UC:** UC-14-A1
- **Mapped FR:** FR-5.5
- **Mapped AC:** AC-9
- **Type:** integration / E2E
- **Severity:** P1
- **Preconditions:** Same as TC-14.1
- **Inputs:** Full `/bootstrap-feature`
- **Steps:**
  1. Run full bootstrap with binary absent
  2. Capture transcript
  3. `grep -Fxc "knowledge-base: tool not installed; skipping" <transcript>` returns N where N = number of in-scope agent invocations
- **Expected Result:** "Exactly once" applies per agent invocation, not per pipeline run
- **Pass Criteria:** Per-agent skip-line accounting verified

### TC-14.3: Binary AND sentinel both absent → silent path (UC-13) wins, NOT skip line
- **Category:** Backward Compat / Both Absent
- **Mapped UC:** UC-14-A2
- **Mapped FR:** FR-5.5, FR-10.1
- **Mapped AC:** AC-8
- **Type:** integration
- **Severity:** P1
- **Preconditions:** No sentinel AND no binary
- **Inputs:** Run agent
- **Steps:**
  1. Ensure both absent
  2. Run agent
  3. Capture transcript
  4. Verify `knowledge-base: tool not installed; skipping` does NOT appear (sentinel-first ordering)
  5. Verify silent UC-13 path applies
- **Expected Result:** Sentinel-first ordering; UC-13 silent path takes precedence over UC-14 skip line
- **Pass Criteria:** Ordering invariant verified

### TC-14.4: Bash allowlist denies invocation (allowlist not registered)
- **Category:** Backward Compat / Permission
- **Mapped UC:** UC-14-E1
- **Mapped FR:** FR-5.5, FR-8.3, NFR-1.9
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P2
- **Preconditions:** Binary present; allowlist entry NOT registered (e.g., `~/.claude/settings.json` deleted)
- **Inputs:** Run agent that attempts CLI invocation
- **Steps:**
  1. Remove allowlist entry from settings.json
  2. Run agent
  3. Verify orchestrator denies the bash call
  4. Verify agent treats the denial as "tool not installed" and emits the skip line
- **Expected Result:** Permission-denied treated equivalently to file-absent; skip line emitted
- **Pass Criteria:** Per FR-5.5 spirit, both failure modes handled

### TC-14.5: Agent fails to log skip line (regression detection)
- **Category:** Regression / Skip Line
- **Mapped UC:** UC-14-E2
- **Mapped FR:** FR-5.5
- **Mapped AC:** AC-9
- **Type:** integration / regression
- **Severity:** P1
- **Preconditions:** Synthetic regression where activation block omits the skip log
- **Inputs:** Run agent with regressed prompt
- **Steps:**
  1. Inject regression in one agent
  2. Run bootstrap with binary absent
  3. `grep -Fxc "knowledge-base: tool not installed; skipping" <transcript>` returns 0 instead of 1
  4. Confirm AC-9 verification fails
- **Expected Result:** Regression caught at AC-9 verification
- **Pass Criteria:** Regression detectable

### TC-14.6: Binary present but corrupted (zero bytes)
- **Category:** Backward Compat / Corrupt Binary
- **Mapped UC:** UC-14-EC1
- **Mapped FR:** FR-5.5
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists but is 0 bytes
- **Inputs:** Run agent
- **Steps:**
  1. `truncate -s 0 ~/.claude/tools/sdlc-knowledge/sdlc-knowledge`
  2. Run agent
  3. Verify the bash invocation fails with "exec format error" or similar
  4. Verify agent treats this as tool-unavailable per FR-5.5 spirit and emits the skip line
- **Expected Result:** Corrupt binary handled equivalently
- **Pass Criteria:** Spirit of FR-5.5 verified

### TC-14.7: Binary present but `--version` returns unexpected error
- **Category:** Backward Compat / Probe
- **Mapped UC:** UC-14-EC2
- **Mapped FR:** FR-5.5
- **Mapped AC:** AC-9
- **Type:** integration
- **Severity:** P3
- **Preconditions:** Binary returns non-zero on `--version`
- **Inputs:** Agent issues a search query directly (no `--version` probe in iter-1)
- **Steps:**
  1. Make binary non-functional
  2. Verify agent does NOT first probe `--version`
  3. Verify search-time errors handled per UC-7 error flows, not UC-14
- **Expected Result:** No `--version` probe in iter-1; UC-7 errors govern
- **Pass Criteria:** iter-1 contract clear

---

## 15. UC-15: Bash Allowlist Idempotent Registration

### TC-15.1: Allowlist registered with exactly one entry; no broader wildcards
- **Category:** Allowlist / Happy Path
- **Mapped UC:** UC-15
- **Mapped FR:** FR-8.3, NFR-1.9
- **Mapped AC:** AC-2
- **Type:** integration / security
- **Severity:** P0
- **Preconditions:** `~/.claude/settings.json` may have prior content
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Snapshot `~/.claude/settings.json`
  2. Run `install.sh --yes`
  3. `jq '.permissions.allow | map(select(. == "~/.claude/tools/sdlc-knowledge/sdlc-knowledge *")) | length' ~/.claude/settings.json` returns `1`
  4. `jq '.permissions.allow | map(select(. == "*" or . == "~/.claude/*")) | length' ~/.claude/settings.json` returns `0` (no broader wildcards)
- **Expected Result:** Exactly one entry; no broader wildcards
- **Pass Criteria:** AC-2 / NFR-1.9 satisfied

### TC-15.2: Fresh install with no prior `~/.claude/settings.json` creates valid JSON
- **Category:** Allowlist / Fresh
- **Mapped UC:** UC-15-A1
- **Mapped FR:** FR-8.3
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P1
- **Preconditions:** `~/.claude/settings.json` does NOT exist
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Remove `~/.claude/settings.json`
  2. Run `install.sh --yes`
  3. Verify file created
  4. `jq . ~/.claude/settings.json` exit 0 (valid JSON)
  5. Verify allowlist entry present
- **Expected Result:** Valid JSON created from scratch
- **Pass Criteria:** AC-2 satisfied on fresh install

### TC-15.3: `jq` absent → heredoc-merge fallback produces equivalent result
- **Category:** Allowlist / Fallback
- **Mapped UC:** UC-15-A2
- **Mapped FR:** FR-8.3
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `jq` not on PATH
- **Inputs:** `bash install.sh --yes` with PATH masked
- **Steps:**
  1. `PATH="" bash install.sh --yes` (or rename `jq`)
  2. Verify the heredoc-merge codepath ran
  3. Verify the resulting JSON contains the allowlist entry
  4. Verify pre-existing keys preserved
- **Expected Result:** Heredoc fallback produces equivalent JSON
- **Pass Criteria:** AC-2 satisfied without jq

### TC-15.4: Pre-existing keys preserved (regression detection)
- **Category:** Allowlist / Preserve Keys
- **Mapped UC:** UC-15-E1
- **Mapped FR:** FR-8.3
- **Mapped AC:** AC-2
- **Type:** integration / security
- **Severity:** P0
- **Preconditions:** `~/.claude/settings.json` has top-level keys `permissions.allow`, `mcp_servers`, `theme`, `model`
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Snapshot pre-install JSON (note keys: `mcp_servers`, `theme`, `model`)
  2. Run install
  3. Diff pre vs post: only `permissions.allow` should have changed (one entry added)
  4. Verify `mcp_servers`, `theme`, `model` byte-identical
- **Expected Result:** Other keys untouched
- **Pass Criteria:** No collateral damage; security-auditor pre-review (Slice 5) catches regressions

### TC-15.5: Malformed JSON refused to overwrite
- **Category:** Allowlist / Defensive
- **Mapped UC:** UC-15-E2
- **Mapped FR:** FR-8.3
- **Mapped AC:** AC-2 (negative path)
- **Type:** integration
- **Severity:** P2
- **Preconditions:** `~/.claude/settings.json` is malformed JSON
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Write malformed JSON to settings.json (e.g., `{ unclosed`)
  2. Run install
  3. Verify install reports parse error
  4. Verify install does NOT overwrite the file
- **Expected Result:** Defensive failure; user data preserved
- **Pass Criteria:** No silent corruption

### TC-15.6: Concurrent install.sh runs racing on JSON merge
- **Category:** Allowlist / Concurrency
- **Mapped UC:** UC-15-E3
- **Mapped FR:** FR-8.3
- **Mapped AC:** AC-2
- **Type:** integration / concurrency
- **Severity:** P3
- **Preconditions:** Two install.sh invocations launched simultaneously
- **Inputs:** Two parallel `bash install.sh --yes`
- **Steps:**
  1. Launch two installs simultaneously
  2. Capture final settings.json state
  3. Verify the allowlist entry is present exactly once (last-write-wins produces equivalent canonical state per idempotency)
- **Expected Result:** Final state has the entry; no corruption
- **Pass Criteria:** Idempotency holds under race

### TC-15.7: `~`-expansion semantics — literal `~` stored
- **Category:** Allowlist / Path Semantics
- **Mapped UC:** UC-15-EC1
- **Mapped FR:** FR-8.3, NFR-1.9
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P1
- **Preconditions:** None
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Run install
  2. `grep -F "~/.claude/tools/sdlc-knowledge/sdlc-knowledge *" ~/.claude/settings.json` returns ≥ 1 line
  3. Verify the literal `~`-prefix is stored (NOT the expanded `/Users/.../`)
- **Expected Result:** Literal `~` per FR-8.3 wording
- **Pass Criteria:** Path matches the literal contract

### TC-15.8: User-broadened wildcard not reverted
- **Category:** Allowlist / User Override
- **Mapped UC:** UC-15-EC2
- **Mapped FR:** NFR-1.9
- **Mapped AC:** AC-2
- **Type:** integration
- **Severity:** P3
- **Preconditions:** User has manually edited the entry to broaden scope (e.g., `~/.claude/tools/* *`)
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. Edit settings.json to use a broader wildcard
  2. Re-run install
  3. Verify install does NOT revert the user's broader wildcard
  4. Confirm the binary's project-root canonicalization (FR-1.5) provides defense-in-depth
- **Expected Result:** User customization preserved; defense-in-depth via FR-1.5
- **Pass Criteria:** No hostile behavior toward user customization

---

## Cross-Cutting Test Cases

### TC-CC-3: Commands count goes from 5 to 6 with `knowledge-ingest.md`
- **Category:** Cross-Cutting / Command Count
- **Mapped UC:** UC-CC-3
- **Mapped FR:** FR-6.1, FR-6.4
- **Mapped AC:** AC-12
- **Type:** unit
- **Severity:** P0
- **Preconditions:** None
- **Inputs:** `src/commands/` directory listing
- **Steps:**
  1. `ls src/commands/*.md | wc -l` returns 6
  2. `ls src/commands/knowledge-ingest.md` exit 0
  3. `grep -Fc "sdlc-knowledge ingest" src/commands/knowledge-ingest.md` returns ≥ 1
  4. The other five command files (`bootstrap-feature.md`, `context-refresh.md`, `develop-feature.md`, `implement-slice.md`, `merge-ready.md`) exist and were not removed
- **Expected Result:** 6 commands; new file present and references the binary; old files preserved
- **Pass Criteria:** AC-12 satisfied (also covered by TC-INV-2)

### TC-CC-4: PDF + Markdown + Plain text formats supported in iter-1
- **Category:** Cross-Cutting / Formats
- **Mapped UC:** UC-CC-4
- **Mapped FR:** FR-2.1, FR-2.2, FR-2.3
- **Mapped AC:** AC-4
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Binary present; fixtures `tools/sdlc-knowledge/tests/fixtures/sample.md` (~3 KB), `sample.txt`, `sample.pdf` exist
- **Inputs:** Ingest each fixture
- **Steps:**
  1. Ingest `sample.md` (3 KB) and verify exactly 8 chunks (Slice 2 golden test)
  2. Ingest `sample.txt` and verify ≥ 1 chunk
  3. Ingest `sample.pdf` (small 2-page synthetic) and verify ≥ 1 chunk
  4. Ingest a directory containing all three; verify aggregate summary
  5. Verify out-of-scope formats (`.docx`, `.html`, `.rst`) are silently skipped
- **Expected Result:** All three iter-1 formats process correctly; chunker is deterministic for sample.md
- **Pass Criteria:** AC-4 across formats; chunker determinism verified

### TC-CC-5: First-release maintainer bootstrap (`sdlc-knowledge-v0.1.0` manual tag)
- **Category:** Cross-Cutting / Release Bootstrap
- **Mapped UC:** UC-CC-5
- **Mapped FR:** FR-11.1, FR-11.2, FR-11.3, FR-12.4
- **Mapped AC:** AC-13
- **Type:** documentation / E2E
- **Severity:** P0
- **Preconditions:** Maintainer has access to repo
- **Inputs:** Manually cut `sdlc-knowledge-v0.1.0`
- **Steps:**
  1. Verify `tools/sdlc-knowledge/RELEASING.md` exists per FR-11.3 and documents the manual one-time bootstrap
  2. Verify `.github/workflows/sdlc-knowledge-release.yml` exists per FR-11.1
  3. Verify the workflow's matrix includes `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm` (use `actionlint` to lint)
  4. After cutting `sdlc-knowledge-v0.1.0` tag, verify GitHub Actions runs and uploads four binary artifacts
  5. Verify subsequent `bash install.sh --yes` finds the release and downloads (UC-1 path)
  6. Verify Gate 9 release-engineer behavior is UNCHANGED in iter-1 per FR-12.4 (read `src/agents/release-engineer.md` Gate 9 section pre vs post diff = empty)
- **Expected Result:** Bootstrap process documented; first tag produces four artifacts; subsequent installs find them
- **Pass Criteria:** AC-13 first-release path verified end-to-end

---

## Cross-Platform Matrix

The following test cases exercise the four-platform install matrix per UC-CC-1 / AC-1.

### TC-CP-1: Install on darwin-arm64 — `--version` exit 0 ≤ 60 s; binary ≤ 10 MB
- **Category:** Cross-Platform / Apple Silicon
- **Mapped UC:** UC-1, UC-CC-1
- **Mapped FR:** FR-8.1, FR-11.1, NFR-1.1, NFR-1.4
- **Mapped AC:** AC-1
- **Type:** cross-platform / E2E
- **Severity:** P0
- **Preconditions:** macOS 14+ on Apple Silicon; runner label `macos-14`
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. From clean state, run install
  2. `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0 within 60 s
  3. `stat -f%z ~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (macOS) ≤ 10485760
  4. Run `sdlc-knowledge ingest <fixture>` and `search <query>`; latency ≤ 500 ms over 10 000-chunk fixture
- **Expected Result:** All AC-1, NFR-1.1, NFR-1.2 budgets met
- **Pass Criteria:** All cross-platform invariants for darwin-arm64

### TC-CP-2: Install on darwin-x64 — same as TC-CP-1 on `macos-13` runner
- **Category:** Cross-Platform / Intel Mac
- **Mapped UC:** UC-1-A2, UC-CC-1
- **Mapped FR:** FR-8.1, FR-11.1, NFR-1.1, NFR-1.4
- **Mapped AC:** AC-1
- **Type:** cross-platform / E2E
- **Severity:** P1
- **Preconditions:** macOS 13 on Intel x86_64; runner `macos-13`
- **Inputs:** `bash install.sh --yes`
- **Steps:** Same as TC-CP-1, replace runner labels
- **Expected Result:** All AC-1, NFR-1.1, NFR-1.2 budgets met
- **Pass Criteria:** Same invariants for darwin-x64

### TC-CP-3: Install on linux-x64 — same on `ubuntu-latest`
- **Category:** Cross-Platform / Ubuntu x86_64
- **Mapped UC:** UC-1-A2, UC-CC-1
- **Mapped FR:** FR-8.1, FR-11.1, NFR-1.1, NFR-1.4
- **Mapped AC:** AC-1
- **Type:** cross-platform / E2E
- **Severity:** P1
- **Preconditions:** Linux x86_64; runner `ubuntu-latest`
- **Inputs:** `bash install.sh --yes`
- **Steps:**
  1. From clean state, run install
  2. `--version` exit 0 ≤ 60 s
  3. `stat --format=%s ~/.claude/tools/sdlc-knowledge/sdlc-knowledge` ≤ 10485760
  4. Search latency ≤ 500 ms over 10 000-chunk fixture
- **Expected Result:** All budgets met
- **Pass Criteria:** Same invariants for linux-x64

### TC-CP-4: Install on linux-arm64 — same on `ubuntu-22.04-arm`
- **Category:** Cross-Platform / Ubuntu ARM
- **Mapped UC:** UC-1-A2, UC-CC-1
- **Mapped FR:** FR-8.1, FR-11.1, NFR-1.1, NFR-1.4
- **Mapped AC:** AC-1, AC-5
- **Type:** cross-platform / E2E
- **Severity:** P1
- **Preconditions:** Linux aarch64; runner `ubuntu-22.04-arm`
- **Inputs:** `bash install.sh --yes`
- **Steps:** Same as TC-CP-3
- **Expected Result:** All budgets met on ARM
- **Pass Criteria:** Cross-platform support verified

---

## Invariant Test Cases

These test the load-bearing constants this feature MUST NOT change.

### TC-INV-1: `ls src/agents/*.md | wc -l` returns 17
- **Category:** Invariant / Agent Count
- **Mapped FR:** FR-12.1
- **Mapped AC:** AC-11
- **Type:** unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/agents/` directory
- **Steps:**
  1. Run `ls src/agents/*.md | wc -l`
- **Expected Result:** Exactly `17`
- **Pass Criteria:** AC-11 agent-count invariant satisfied

### TC-INV-2: `ls src/commands/*.md | wc -l` returns 6
- **Category:** Invariant / Command Count
- **Mapped FR:** FR-6.4
- **Mapped AC:** AC-12
- **Type:** unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/commands/` directory
- **Steps:**
  1. Run `ls src/commands/*.md | wc -l`
- **Expected Result:** Exactly `6`
- **Pass Criteria:** AC-12 command-count satisfied

### TC-INV-3: README line 5 tagline byte-unchanged (`grep -Fxc` returns 1)
- **Category:** Invariant / README Tagline
- **Mapped FR:** FR-12.1
- **Mapped AC:** AC-11
- **Type:** unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `README.md`
- **Steps:**
  1. Run `grep -Fxc "17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations." README.md`
- **Expected Result:** Returns `1`
- **Pass Criteria:** Tagline byte-unchanged at line 5

### TC-INV-4: README phrase `10 quality gates` appears at least 3 times
- **Category:** Invariant / README Gate Count
- **Mapped FR:** FR-12.2
- **Mapped AC:** AC-11
- **Type:** unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `README.md`
- **Steps:**
  1. Run `grep -Fc "10 quality gates" README.md`
- **Expected Result:** Returns ≥ `3`
- **Pass Criteria:** Phrase preserved at line 35 and other documented locations

### TC-INV-5: 5 executor agent prompt files byte-unchanged vs main
- **Category:** Invariant / Executor Files
- **Mapped FR:** FR-12.3
- **Mapped AC:** AC-11
- **Type:** unit / regression
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** Pre-merge commit hash and current main
- **Steps:**
  1. For each of `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`:
     a. `diff <(git show <pre-merge-commit>:src/agents/<agent>.md) src/agents/<agent>.md` returns empty
- **Expected Result:** Each diff is empty (zero bytes changed)
- **Pass Criteria:** AC-11 executor-files invariant satisfied per FR-12.3

### TC-INV-6: `src/rules/cognitive-self-check.md` byte-unchanged vs main
- **Category:** Invariant / Cognitive Rule Byte-Unchanged
- **Mapped FR:** FR-10.4, FR-12.5
- **Mapped AC:** AC-11
- **Type:** unit / regression
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** Pre-merge commit
- **Steps:**
  1. `diff <(git show <pre-merge-commit>:src/rules/cognitive-self-check.md) src/rules/cognitive-self-check.md` returns empty
- **Expected Result:** Empty diff
- **Pass Criteria:** FR-10.4 / FR-12.5 byte-unchanged invariant satisfied; the `knowledge-base:` source prefix is purely additive

### TC-INV-7: Pre-existing template surfaces byte-unchanged
- **Category:** Invariant / Templates Byte-Unchanged
- **Mapped FR:** FR-9.2
- **Mapped AC:** AC-11
- **Type:** unit / regression
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** Pre-merge commit
- **Steps:**
  1. `diff <(git show <pre-merge-commit>:templates/CLAUDE.md) templates/CLAUDE.md` returns empty
  2. `diff <(git show <pre-merge-commit>:templates/scratchpad.md) templates/scratchpad.md` returns empty
  3. `diff <(git show <pre-merge-commit>:templates/settings.json) templates/settings.json` returns empty
  4. For each file in `templates/rules/*`: `diff <(git show <pre-merge-commit>:<file>) <file>` returns empty
  5. Verify the new addition `templates/knowledge/` exists with `.gitignore` (4 lines) and `.gitkeep`
- **Expected Result:** All four pre-existing surfaces unchanged; only addition is `templates/knowledge/`
- **Pass Criteria:** FR-9.2 satisfied

---

## Architect Action Item Test Cases

The architect's PASS verdict surfaced 5 inline action items. Each gets a dedicated TC.

### TC-AAI-1: install.sh ordering — `install_knowledge_binary` runs BEFORE line-228 cleanup OR re-invokes `get_source_dir`
- **Category:** Install / Ordering
- **Mapped FR:** FR-8.1, FR-8.2, FR-8.4
- **Mapped AC:** AC-1, AC-13
- **Type:** integration / regression
- **Severity:** P0
- **Preconditions:** Architect's verdict surfaced this ordering concern about install.sh's existing line-228 cleanup that resets the source-directory variable; the new `install_knowledge_binary` function must run before that cleanup OR call `get_source_dir` again
- **Inputs:** `install.sh` source code; `bash install.sh --yes`
- **Steps:**
  1. `grep -n "install_knowledge_binary" install.sh` -- record line `K`
  2. `grep -n "<line-228 cleanup marker>" install.sh` -- record line `C` (the existing cleanup that unsets the source dir)
  3. EITHER verify `K < C` (binary install runs first) OR verify the binary-install function calls `get_source_dir` itself (independent of pre-cleanup state)
  4. Run a clean install in a fresh checkout
  5. Verify the cargo source-build fallback (UC-2) works (this is the most sensitive path because cargo needs the source directory)
  6. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exit 0
- **Expected Result:** Either ordering invariant or self-contained `get_source_dir` re-invocation; cargo fallback functional
- **Pass Criteria:** Architect action item #1 verified

### TC-AAI-2: BM25 score direction — search results ordered BEST-FIRST regardless of negative bm25() values
- **Category:** Search / Ordering Convention
- **Mapped FR:** FR-3.1, FR-3.3
- **Mapped AC:** AC-5, AC-10
- **Type:** integration
- **Severity:** P0
- **Preconditions:** Index seeded with at least three documents; one has high keyword overlap with query, one moderate, one low
- **Inputs:** `sdlc-knowledge search "<query>" --top-k 5 --json`
- **Steps:**
  1. Seed: doc A contains the query terms 10 times, doc B 3 times, doc C 1 time
  2. Run search
  3. Parse JSON
  4. Verify the result order is A, B, C (best match first) regardless of whether the internal `score` field is positive or negative
  5. SQLite's `bm25()` returns LOWER values for BETTER matches by convention; the implementation must invert ordering OR negate the score so JSON consumers see "best first" without needing to know the convention
  6. Verify `src/rules/knowledge-base.md` documents the ordering convention so agents can interpret the `score` field correctly
- **Expected Result:** JSON array is ordered best-first; rule file documents the convention
- **Pass Criteria:** Architect action item #2 verified

### TC-AAI-3: Slice 1 path canonicalization — security TCs covering `..`-traversal, symlink escape, absolute path outside cwd, cwd-itself-is-symlink
- **Category:** Security / Path Canonicalization
- **Mapped FR:** FR-1.5
- **Mapped AC:** AC-6
- **Type:** security / integration
- **Severity:** P0
- **Preconditions:** Binary present
- **Inputs:** Multiple `--project-root` values
- **Steps:**
  1. **Subcase A (`..`-traversal):** `sdlc-knowledge ingest ./books --project-root ../../../etc` → exit 2, literal stderr message (covers UC-5-E2 / TC-5.6)
  2. **Subcase B (symlink escape):** Create symlink `<cwd>/escape -> /etc`; run `sdlc-knowledge ingest ./books --project-root ./escape` → exit 2, literal stderr message (covers UC-5-E3 / TC-5.7)
  3. **Subcase C (absolute path outside cwd):** `sdlc-knowledge ingest ./books --project-root /etc` → exit 2, literal stderr message (absolute path canonicalizes to itself, which is outside cwd)
  4. **Subcase D (cwd is itself a symlink):** Create `/tmp/realdir`; symlink `/tmp/symdir -> /tmp/realdir`; cd `/tmp/symdir`; run `sdlc-knowledge ingest ./books --project-root /tmp/realdir` → must SUCCEED (project-root canonicalized matches cwd's canonical form). Then run `sdlc-knowledge ingest ./books --project-root /tmp/symdir-other` (where `symdir-other` points elsewhere) → must REJECT
  5. Verify each subcase's exit code (2 for rejections, 0 for the cwd-symlink legitimate case)
  6. Verify each rejection's stderr contains the literal `error: project-root must resolve under current working directory`
  7. Verify no `panicked at` in stderr in any subcase
- **Expected Result:** All four subcases produce the documented behavior; canonicalization handles cwd-itself-is-symlink correctly
- **Pass Criteria:** Architect action item #3 verified; AC-6 reinforced

### TC-AAI-4: Slice 2 PDF crate + ingest transactionality — one corrupt PDF in batch does NOT poison other documents
- **Category:** Ingest / Transactional Per-Document
- **Mapped FR:** FR-2.5, FR-2.6, FR-4.2
- **Mapped AC:** AC-4
- **Type:** integration / E2E
- **Severity:** P0
- **Preconditions:** Binary present; batch dir has 10 PDFs (9 valid, 1 truncated)
- **Inputs:** `sdlc-knowledge ingest <batch-dir>`
- **Steps:**
  1. Place 9 valid PDFs and 1 truncated PDF in the batch
  2. Run ingest
  3. After ingest:
     a. `sqlite3 index.db 'SELECT COUNT(*) FROM documents'` returns 9 (NOT 0, NOT 10 — the corrupt PDF's doc row was rolled back; the 9 valid PDFs are committed)
     b. `sqlite3 index.db 'SELECT source_path FROM documents'` lists the 9 valid PDF paths only
     c. The corrupt PDF's `source_path` is NOT present in `documents`
     d. The corrupt PDF's `chunks` rows do NOT exist
  4. Verify per-file error reported in stderr / JSON stream for the corrupt PDF
  5. Verify the binary continued processing AFTER the corrupt PDF (i.e., later valid PDFs still committed)
  6. Verify `panicked at` does NOT appear in stderr
  7. Verify the architect-selected PDF crate (`pdf-extract` per Open Question #1 default) returned a structured error rather than panicking
- **Expected Result:** Per-document `BEGIN IMMEDIATE` rollback isolates the corrupt PDF's failure; siblings preserved
- **Pass Criteria:** Architect action item #4 verified; AC-4 transactional-per-document semantics enforced

### TC-AAI-5: Slice 6 rule documentation — `src/rules/knowledge-base.md` documents pdf-extract limitations
- **Category:** Documentation / Rule File
- **Mapped FR:** FR-7.1
- **Mapped AC:** AC-10
- **Type:** unit (file content)
- **Severity:** P1
- **Preconditions:** Slice 6 has shipped
- **Inputs:** `src/rules/knowledge-base.md`
- **Steps:**
  1. `grep -Fc "scanned PDF" src/rules/knowledge-base.md` returns ≥ 1 (or equivalent phrase about scanned/image-only PDFs)
  2. `grep -Ec "multi-column|multi column|two-column" src/rules/knowledge-base.md` returns ≥ 1
  3. `grep -Fc "form field" src/rules/knowledge-base.md` returns ≥ 1
  4. Verify the file is ≤ 200 lines per FR-7.1 (`wc -l src/rules/knowledge-base.md`)
  5. Verify the file mentions the chosen PDF crate (`pdf-extract` per Open Question #1) with a short rationale
  6. Verify the file's `## CLI invocation contract` section lists all five subcommands verbatim per FR-7.1
  7. Verify the `## Citation format` section contains the literal citation shape `knowledge-base: <source-filename>:<chunk-id> -- query: "<query>" -- BM25: <score> -- verified: yes`
  8. Verify the `## Application Scope` section enumerates the 12 in-scope agents and 5 exempt executors verbatim
  9. Verify the file ends with a `## Facts` block per Section 9 schema
- **Expected Result:** Rule file documents pdf-extract's known limitations (scanned PDFs, multi-column, form fields), the citation format, the CLI contract, and includes the `## Facts` block
- **Pass Criteria:** Architect action item #5 verified; FR-7.1 satisfied
