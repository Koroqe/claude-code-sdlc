# Knowledge Base Rule — `claudebase` Agent Activation

This rule governs how SDLC thinking agents query the local `claudebase`
index and cite results. Activation is conditional on a sentinel file; absence
is a silent no-op so the rule ships safely into opt-out projects.

> **See also `~/.claude/rules/knowledge-base-tool.md`** — companion rule that
> describes WHAT the tool is, WHY it exists, and the **mandatory** usage protocol
> agents must follow when the index is present. THIS file documents the CLI
> contract and citation literal-format; the companion documents the mandate.

## When to query

Thinking agents MUST query the local knowledge base BEFORE authoring any
domain-bearing content (functional requirements, use-case scenarios, test cases,
plan slices, architecture verdicts) when the activation sentinel is present.
"Domain-bearing" means content that depends on project-specific terminology,
workflows, or invariants that the agent did not derive from this session's
inputs (PRD, scratchpad, prior fact blocks). The query is part of the
cognitive-self-check protocol — see `~/.claude/rules/cognitive-self-check.md`
for citation discipline.

## CLI invocation contract

The `claudebase` binary lives at `~/.claude/tools/claudebase/claudebase`.
After `bash install.sh --yes` registers the global alias, it is also invokable
as `claudebase` from any directory on PATH (the alias is a symlink in
`/usr/local/bin`, `/opt/homebrew/bin`, or `~/.local/bin` — whichever was the
first writable PATH directory at install time). **Agents SHOULD use the short
alias `claudebase`** in citations and command examples; the absolute path
remains valid as a backward-compat fallback for environments where the alias
was not registered.

Six subcommands — invoke verbatim:

- `claudebase ingest <path> [--project-root <dir>] [--json]`
- `claudebase search <query> [--top-k 5] [--mode lexical|dense|hybrid] [--context N] [--project-root <dir>] [--json]`
- `claudebase list [--project-root <dir>] [--json]`
- `claudebase status [--project-root <dir>] [--json]`
- `claudebase delete <source-id> [--project-root <dir>] [--json]`
- `claudebase page <doc> <N> [--range R] [--project-root <dir>] [--json]`
  where `<doc>` is either an integer `documents.id` (from `list --json`) OR a
  basename matching `documents.source_path`. `--range R` returns `[N-R..N+R]`
  (default 0 = single page; max 20).
- `claudebase reindex-pages [--doc <id-or-name>] [--project-root <dir>] [--json]`
  backfills the `pages` table for already-ingested PDFs without touching
  chunks_fts / chunks_vec — useful after upgrading from a pre-v3 index.

The `--project-root <dir>` flag pins the index location to a specific project;
omitted, the binary resolves the project root relative to the current working
directory via `resolve_project_root` (the single path-from-user-input gate in
`https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/cli.rs`). Agents SHOULD pass `--json` when consuming
output programmatically; humans get human-readable text by default.

Typical agent query (the literal invocation referenced from per-agent
`## Knowledge Base (when present)` activation blocks):

```
claudebase search "<query>" --top-k 5 --json
```

The `--mode` flag (iter-2 vector-retrieval-backend) selects retrieval strategy:

- `--mode lexical` — iter-1 BM25 baseline (FTS5 only); regression-safe for exact-keyword queries
- `--mode dense` — pure semantic K-NN via sqlite-vec over 384-dim e5-multilingual-small embeddings
- `--mode hybrid` — BM25 ⊕ dense fused via Reciprocal Rank Fusion with k=60 (Cormack et al. 2009); the **default mode**

Hybrid is the recommended default — it captures both exact-keyword and semantic recall in a single ranking. Pure-lexical or pure-dense modes are useful for ablation analysis, regression-safety on a v1 corpus, or when one of the two backends is degraded.

**Mode fallback contract.** When the e5 encoder model is unavailable OR the schema is at v1 (no `chunks_vec` virtual table), `--mode hybrid` and `--mode dense` automatically fall back to lexical retrieval with a stderr warning. The fallback is silent on stdout — the `mode_used` JSON field reflects the actual mode that produced each hit so agents can detect degraded-mode runs.

**Distance metric.** `chunks_vec` uses sqlite-vec's default L2 (Euclidean) distance. Because the e5-multilingual-small encoder produces L2-normalized vectors, L2 ranking is mathematically identical to cosine-similarity ranking — the formula is `cos = 1 − L2² / 2`. The `dense_score` field shows `−L2_distance` (negated so larger=better, matching the BM25 convention); a `dense_score = −0.43` corresponds to cosine similarity ≈ 0.91. Agents reading this field do NOT need to convert; ranking order is what matters and is preserved across the L2/cosine equivalence.

### Search JSON shape (schema v3)

Each hit returned by `search --json` is an object of the form:

```json
{
  "source": "<absolute path to the source document>",
  "doc_id": <integer document id>,
  "chunk_id": <integer chunk row id (= FTS5 rowid)>,
  "ord": <integer chunk ordinal within the document, 0-indexed>,
  "score": <positive float, larger = better match>,
  "snippet": "<FTS5-generated snippet around the matching term>",
  "page_start": <1-indexed PDF page where the chunk text begins; OPTIONAL>,
  "page_end":   <1-indexed PDF page where the chunk text ends;   OPTIONAL>,
  "context":    "<concatenated ±N neighbor chunks; OPTIONAL>",
  "mode_used":  "<lexical | dense | hybrid; OPTIONAL — present when search ran in non-lexical mode>",
  "bm25_score": <float; OPTIONAL — lexical/hybrid only>,
  "dense_score": <float; OPTIONAL — dense/hybrid only>,
  "rrf_score": <float; OPTIONAL — hybrid only>
}
```

`page_start` / `page_end` are present ONLY for chunks ingested from PDF
sources under schema v3 or later. For markdown / plain-text sources both
fields are omitted (pagination is undefined). For chunks ingested before
schema v3 both fields are also omitted — agents handle this gracefully
by falling back to a chunk-id citation when `page_start` is absent.

For PDFs the chunker is per-page, so `page_start == page_end`. The pair
is kept open in the schema for a future cross-page chunker.

### `page` subcommand — full-page text retrieval

When a search hit cites a specific PDF page (`page_start: 127`), agents
follow up with `page <doc_id> 127` (or `page "<basename>.pdf" 127`) to
fetch the full extracted text of that page — the one-step pivot from "I
see a relevant snippet on page 127" to "show me the full page so I can
quote / analyse the surrounding paragraph."

```
claudebase page <doc> <N> [--range R] --json
```

`<doc>` accepts either an integer `documents.id` (verbatim from a search
hit's `doc_id`) OR a string matching `documents.source_path` by basename.
`--range R` widens the response to `[N-R..N+R]` (max R=20) so the model
can read a small page-spread without issuing R+1 separate calls.

JSON output shape:

```json
{
  "doc_id": <integer>,
  "source_path": "<string>",
  "total_pages": <integer or null — derived from MAX(page_no) over the pages table>,
  "requested_page": <1-indexed integer>,
  "range": <non-negative integer>,
  "pages": [
    { "page_no": <1-indexed integer>, "text": "<full extracted text of the page>" },
    …
  ]
}
```

Exit codes:

- `0` — page found, JSON / human text written to stdout.
- `1` — document not found, page out of range, OR pages table not yet
  backfilled (run `claudebase reindex-pages --doc <id-or-name>` to fix).

Agents MUST NOT call `page` with `<N>` ≤ 0 — the schema is 1-indexed and
the CLI rejects out-of-range values with the literal stderr line
`error: page number out of range`.

## `insight` subcommand — the agent-written cognitive corpus

Companion to the books-corpus subcommands above. The `insight` tree
operates against `<project>/.claude/knowledge/insights.db` exclusively
(opt-in per project; created on first `insight create`). The full
WHEN / WHAT / HOW protocol lives in
`~/.claude/rules/knowledge-base-tool.md` § Insights corpus — this section
documents the CLI contract only.

Seven subcommands:

- `claudebase insight create "<body>" --type <kind> --agent <agent> [--session ID] [--feature SLUG] [--salience high|medium|low] [--source-artifact REF] [--json]`
  - Persists one insight. Body via positional, `-`, or piped stdin (TTY refused).
  - Exact-sha dedup: same `(agent, sha256)` within 30 days → `status: deduped`.
  - Semantic dedup: cosine > 0.92 paraphrase from same agent within 30 days → `status: near-duplicate`.
  - Cross-agent agreement on same body is intentionally NOT deduped (load-bearing signal).
- `claudebase insight search "<query>" [--mode hybrid|dense|lexical] [--top-k N] [--type T] [--agent A] [--salience S] [--feature F] [--since <Nd|Nh|Nm|Nw>] [--json]`
  - Hybrid retrieval against `insights.db`. Default mode `hybrid` (BM25 ⊕ dense RRF k=60).
  - Metadata filters apply after ranking (over-fetch x4, capped at 100).
  - `--since` format: `<integer><unit>` where unit ∈ {s,m,h,d,w}.
- `claudebase insight list [--offset N] [--page-size N] [filters] [--json]` — newest-first paginated summaries; default page size 10.
- `claudebase insight random [filters] [--json]` — uniform-sample one insight; exit 1 on empty corpus / no match.
- `claudebase insight get <ident> [--json]` — integer `documents.id` OR hex sha prefix (≥4 chars, matched as `LIKE 'prefix%'`).
- `claudebase insight gc [--dry-run] [--json]` — TTL purge (high=∞ / medium=365d / low=90d) + VACUUM. Reports `{medium_deleted, low_deleted, chunks_vec_orphans_cleared, freed_bytes}`.
- `claudebase insight delete <id> [--json]` — single-row delete with chunks + chunks_vec cascade. Refuses non-insight rows (books-corpus protection).

Exit codes are uniform across the family:

- `0` — success (including `deduped` and `near-duplicate` statuses on `create`).
- `1` — runtime error (DB open failure, query failure, unknown id, empty corpus on `random`, etc.).
- `2` — usage error (empty body, TTY without body, malformed `--since`, sha prefix < 4 chars, non-hex ident on `get`, attempt to `delete` a books-corpus row).

Path-canonicalization: same `cli::resolve_project_root` gate as the books corpus subcommands. The corpus file selector for the `insight` family is hardcoded to `insights.db` — `--db-name` is accepted on subcommands for test/admin overrides but agents SHOULD always use the default.

JSON shape for `insight search` hits is identical to books-corpus `search` hits (`SearchHit` struct) — same `chunk_id / doc_id / score / snippet` fields. Citation format for load-bearing hits is `insights-base: doc#<id> sha=<prefix> agent=<author> type=<kind> — query: "<q>" — verified: yes` (see `knowledge-base-tool.md` for the full protocol).

## Citation format

When a search hit load-bears on a decision (i.e., the agent would have written
something different without it), the agent MUST cite the hit in its fact
block under `### External contracts` using one of these two exact byte
shapes — pick the one matching the hit's source format:

**(a) PDF source with page citation (schema v2 — `page_start` present in the JSON):**

```
knowledge-base: <source-filename>:p<page>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes
```

`<page>` is the integer `page_start` field from the JSON. When `page_start`
and `page_end` differ (future cross-page chunkers), use the form
`p<page_start>-<page_end>` instead of `p<page>`.

**(b) Non-PDF source OR pre-v2 legacy chunk (`page_start` absent from the JSON):**

```
knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes
```

In both forms `<source-filename>` is the document path returned in the
`source` JSON field, `<chunk-id>` is the integer `chunk_id` field, `<query>`
is the literal query string the agent passed, and `<score>` is the JSON
`score` field rendered with fixed-point precision. The agent decides between
(a) and (b) by inspecting the JSON: if the hit object contains a
`page_start` field, use form (a); otherwise use form (b). Both forms are
greppable for reviewer audits — `knowledge-base:` is the load-bearing
prefix.

**Reviewer note:** when an agent quotes prose from a cited PDF, the page
citation in form (a) is the load-bearing breadcrumb that lets a human open
the source document and verify the quote in seconds. Pre-v2 legacy chunks
(form b on a PDF source) are a known degraded case — the user can re-run
`claudebase ingest <path>` on the document to upgrade it to schema v2 and
restore page citations on subsequent searches.

**BM25 score-direction convention (architect action item #3).** SQLite's FTS5
`bm25()` function returns NEGATIVE values where smaller (more negative) indicates
a better match. `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/search.rs:75` selects
`-bm25(chunks_fts) AS score` and orders by `score DESC` — flipping the sign so
the JSON `score` field is always POSITIVE with larger-is-better. Agents cite the
positive form verbatim from the JSON output. Do NOT re-negate, do NOT wrap, do
NOT reformat — the score string in the citation matches the JSON byte-for-byte
so reviewers can grep for it.

## Activation sentinel

The activation sentinel is the file `<project>/.claude/knowledge/index.db`.

- Sentinel exists ⇒ the knowledge base is ACTIVATED for this project. Agents
  MUST query before authoring domain-bearing content and MUST cite hits.
- Sentinel absent ⇒ the knowledge base is NOT activated. Agents MUST proceed
  without the query step — no log line, no error, no `### Open questions`
  entry. This is a silent no-op so the rule ships safely into projects that
  have not opted in.

The citation discipline that governs how `### External contracts` entries are
shaped is documented in `~/.claude/rules/cognitive-self-check.md` (the rule
this file extends with the `knowledge-base:` source prefix).

## Fallback behavior

Three failure modes are pre-classified so agents handle them deterministically:

- **Binary absent** — neither `claudebase` (alias) nor
  `~/.claude/tools/claudebase/claudebase` (absolute path) is on PATH.
  Detection: `command -v claudebase` returns empty AND `[ -x ~/.claude/tools/claudebase/claudebase ]`
  is false. Agent logs the literal line `knowledge-base: tool not installed; skipping`
  to stderr and proceeds without citation. Not a hard error; downstream gates
  do not flag it.
- **Alias absent but binary present** (older install before the
  `register_claudebase_alias` step landed) — `command -v claudebase`
  returns empty but `~/.claude/tools/claudebase/claudebase` IS
  executable. Agent silently falls back to the absolute path; no log line.
  This is a backward-compat path; re-running `bash install.sh --yes`
  registers the alias.
- **Index absent** — the binary is installed but `<project>/.claude/knowledge/index.db`
  does not exist. Silent no-op (no log line) per the activation-sentinel rule
  above. The project simply has not opted in.
- **Corrupt index** — the binary is installed AND the sentinel exists, but the
  database fails to open or schema-validate. The binary exits 1 with the literal
  stderr line `error: index database invalid; re-ingest required`. The agent
  surfaces this under `### Open questions` in its fact block (needs: user
  decision — re-ingest or disable knowledge base for this run).

## Application Scope

The 13 in-scope thinking agents — same set as the cognitive-self-check protocol
(`~/.claude/rules/cognitive-self-check.md` `## Application Scope`) — MUST query
the index before authoring domain-bearing content when the sentinel is present:

- `prd-writer`
- `ba-analyst`
- `architect`
- `qa-planner`
- `planner`
- `security-auditor`
- `code-reviewer`
- `verifier`
- `refactor-cleaner`
- `resource-architect`
- `role-planner`
- `release-engineer`
- `qa-engineer`

The 5 exempt executor agents are deterministic spec-followers and do NOT query
the knowledge base — their inputs are already fact-cited by upstream thinking
agents:

- `test-writer`
- `build-runner`
- `e2e-runner`
- `doc-updater`
- `changelog-writer`

## Known limitations

PDF text extraction in iter-2 uses `pdfium-render` v0.9 (a Rust binding to
Chrome's PDFium engine). PDFium correctly handles document classes that the
iter-1 `pdf-extract` backend struggled with:

- **CID fonts** — Chinese/Japanese/Korean and other CID-keyed font encodings
  extract correctly.
- **Calibre-converted PDFs** — PDFs produced by Calibre's e-book conversion
  (with embedded subset fonts) extract correctly.
- **Multi-column layouts** — academic papers, newspapers, and two-column
  technical specifications extract in correct reading order.
- **Scanned PDFs with an embedded text layer** — PDFs that were scanned and
  then OCR'd (so the text layer is embedded) extract correctly. PDFs that are
  image-only with no text layer at all still yield empty chunks; OCR
  pre-processing (e.g., `ocrmypdf`) remains the operator's responsibility.

The pdfium dynamic library (`libpdfium.dylib` / `libpdfium.so` /
`libpdfium.dll`) is loaded at runtime via `Pdfium::bind_to_library` against
the explicit path `~/.claude/tools/claudebase/pdfium/lib/libpdfium.{dylib,so}`.
The library is downloaded and placed there by `bash install.sh --yes`. If the
library is absent at PDF ingest time, the per-document load fails with the
literal log line `pdfium dynamic library not found ... install via bash
install.sh --yes` and the ingest continues with the remaining sources —
markdown and plain-text ingest are unaffected.

**Encrypted / password-protected PDFs** — pdfium returns a clear error during
open; `claudebase ingest` surfaces the error and skips the document.

## Facts

### Verified facts
- The 8 sections of this rule and the activation sentinel path
  `<project>/.claude/knowledge/index.db` are mandated by PRD §11 line 2449 FR-7.1.
- The `resolve_project_root` security backbone is the only path-from-user-input
  gate in the binary — source: `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/cli.rs:1-3, 37`.
- The BM25 score-direction convention (positive larger-is-better in JSON;
  `-bm25(chunks_fts) AS score` with `ORDER BY score DESC` in SQL) is
  implemented at `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/search.rs:1-18, 70-82`.
- The 12-agent / 5-executor split mirrors the cognitive-self-check rule —
  source: `~/.claude/rules/cognitive-self-check.md` `## Application Scope`.
- Schema v2 adds nullable `chunks.page_start` / `chunks.page_end` columns and
  a `pages(doc_id, page_no, text)` table; PDF ingest tags every chunk with
  its 1-indexed page number and stores per-page extracted text — source:
  `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/store.rs` (`SCHEMA_V2_PAGES_TABLE`,
  `replace_pages`, `get_page_by_id`), `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/migrations.rs`
  (`apply_v2`), and `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/ingest.rs` (`chunk_pages`).
- The `page` subcommand returns `{doc_id, source_path, page_no, text}` JSON
  with exit 0/1/2 semantics defined in `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/main.rs`
  (`run_page`).

### External contracts
- `rusqlite` — symbol: `Connection::prepare`, `params!`, `query_map` — source:
  `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/search.rs:26, 84-95` — verified: yes (read in this
  session).
- SQLite FTS5 `bm25()` — symbol: `bm25(chunks_fts)` returns NEGATIVE scores
  (smaller = better) — source: SQLite FTS5 docs (referenced from
  `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/search.rs:5-6`); negation convention verified at
  `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/search.rs:75` — verified: yes.
- SQLite `ALTER TABLE ... ADD COLUMN` — symbol: schema migration primitive
  used by `apply_v2` to add nullable `page_start` / `page_end` to `chunks`
  without rewriting the table — source: `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/migrations.rs`
  (idempotent via `pragma_table_info` probe) — verified: yes (live migration
  exercised by `tests/page_test.rs::v1_to_v2_migration_adds_page_columns_and_pages_table`
  and `migration_is_idempotent`).
- `pdfium-render` crate v0.9 — symbol: `Pdfium::bind_to_library`,
  `load_pdf_from_byte_slice`, `pages()`, `text()` — source: pdfium-render
  rustdoc (referenced via Slice 1 architect pre-review of pdfium-pdf-extraction)
  and `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/src/pdf.rs` (Slice 1 implementation) — verified:
  yes (Slice 1 of pdfium-pdf-extraction reverified the API symbols; the calibre
  fixture in `https://github.com/codefather-labs/claudebase/blob/claudebase-v0.4.0/tests/fixtures/calibre-sample.pdf` exercises
  multi-column and CID-font extraction successfully per TC-AAI-5).
- GitHub Actions runner images — symbol: `ubuntu-latest`, `macos-latest`,
  `windows-latest` — source: GitHub Actions docs (not opened this session) —
  verified: no — assumption. Used by Slice 4's release pipeline, not by this
  rule directly.

### Assumptions
- `<chunk-id>` in the citation format is the integer `chunk_id` field from the
  search JSON — risk: if downstream consumers expect a string ord-within-doc
  identifier, the citation will not round-trip — how to verify: Slice 7a/7b
  agent prompts will exercise the citation in real queries; mismatch surfaces
  as failed integration test.
- The citation-format expansion shape (single-line, em-dash separators) is
  parseable by reviewers grepping for `knowledge-base:` — risk: multi-line
  citations or differently-quoted queries could break grep-based audits — how
  to verify: code-reviewer pass at the merge-ready gate.
- Pre-v2 legacy chunks (PDF chunks ingested before the page-tracking
  migration) appear in search results without `page_start` and are cited
  in citation form (b) — risk: agents may not realise the source IS a PDF
  and miss an opportunity to follow up with `page <doc> <N>` after a
  re-ingest — how to verify: when an agent cites form (b) for a `.pdf`
  source path, surface a hint suggesting `claudebase ingest <path>` to
  upgrade the document to v2.

### Open questions
- (none)
