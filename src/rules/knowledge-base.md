# Knowledge Base Rule — `sdlc-knowledge` Agent Activation

This rule governs how SDLC thinking agents query the local `sdlc-knowledge`
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

The `sdlc-knowledge` binary lives at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`.
After `bash install.sh --yes` registers the global alias, it is also invokable
as `claudeknows` from any directory on PATH (the alias is a symlink in
`/usr/local/bin`, `/opt/homebrew/bin`, or `~/.local/bin` — whichever was the
first writable PATH directory at install time). **Agents SHOULD use the short
alias `claudeknows`** in citations and command examples; the absolute path
remains valid as a backward-compat fallback for environments where the alias
was not registered.

Six subcommands — invoke verbatim:

- `claudeknows ingest <path> [--project-root <dir>] [--json]`
- `claudeknows search <query> [--top-k 5] [--context N] [--project-root <dir>] [--json]`
- `claudeknows list [--project-root <dir>] [--json]`
- `claudeknows status [--project-root <dir>] [--json]`
- `claudeknows delete <source-id> [--project-root <dir>] [--json]`
- `claudeknows page <source-path> --page <N> [--project-root <dir>] [--json]`
  OR `claudeknows page --by-id <ID> --page <N> [--project-root <dir>] [--json]`

The `--project-root <dir>` flag pins the index location to a specific project;
omitted, the binary resolves the project root relative to the current working
directory via `resolve_project_root` (the single path-from-user-input gate in
`tools/sdlc-knowledge/src/cli.rs`). Agents SHOULD pass `--json` when consuming
output programmatically; humans get human-readable text by default.

Typical agent query (the literal invocation referenced from per-agent
`## Knowledge Base (when present)` activation blocks):

```
claudeknows search "<query>" --top-k 5 --json
```

### Search JSON shape (schema v2)

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
  "context":    "<concatenated ±N neighbor chunks; OPTIONAL>"
}
```

`page_start` / `page_end` are present ONLY for chunks ingested from PDF
sources under schema v2 or later. For markdown / plain-text sources both
fields are omitted (pagination is undefined). For chunks ingested before
schema v2 (legacy index re-using a pre-v2 DB without re-ingesting the
source) both fields are also omitted — agents handle this gracefully by
falling back to a chunk-id citation when `page_start` is absent.

For PDFs the chunker is per-page, so `page_start == page_end`. The pair is
kept open in the schema for a future cross-page chunker.

### `page` subcommand — full-page text retrieval

When a search hit cites a specific PDF page (`page_start: 127`), agents
follow up with `page --by-id <doc_id> --page <page_start>` to fetch the
full extracted text of that page. This is the one-step pivot from "I see a
relevant snippet on page 127" to "show me the full page so I can quote /
analyse the surrounding paragraph."

Two invocation forms (mutually exclusive):

```
claudeknows page --by-id <doc_id> --page <N> --json     # by integer id (preferred — comes verbatim from search hit)
claudeknows page <source-path>     --page <N> --json    # by source path (positional)
```

JSON output shape:

```json
{
  "doc_id": <integer>,
  "source_path": "<string>",
  "page_no": <1-indexed integer>,
  "text": "<full extracted text of the page>"
}
```

Exit codes:

- `0` — page found, JSON / human text written to stdout.
- `1` — document not found, page out of range, OR document has no extracted
  pages (non-PDF source: markdown / plain-text never have `pages` rows).
- `2` — malformed CLI: both `--by-id` and `<source-path>` given, neither
  given, or `--page < 1`.

Agents MUST NOT call `page` with `--page 0` or any negative number — the
schema is 1-indexed and the CLI rejects out-of-range values with exit 2.

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
`claudeknows ingest <path>` on the document to upgrade it to schema v2 and
restore page citations on subsequent searches.

**BM25 score-direction convention (architect action item #3).** SQLite's FTS5
`bm25()` function returns NEGATIVE values where smaller (more negative) indicates
a better match. `tools/sdlc-knowledge/src/search.rs:75` selects
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

- **Binary absent** — neither `claudeknows` (alias) nor
  `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (absolute path) is on PATH.
  Detection: `command -v claudeknows` returns empty AND `[ -x ~/.claude/tools/sdlc-knowledge/sdlc-knowledge ]`
  is false. Agent logs the literal line `knowledge-base: tool not installed; skipping`
  to stderr and proceeds without citation. Not a hard error; downstream gates
  do not flag it.
- **Alias absent but binary present** (older install before the
  `register_claudeknows_alias` step landed) — `command -v claudeknows`
  returns empty but `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` IS
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

The 12 in-scope thinking agents — same set as the cognitive-self-check protocol
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
the explicit path `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib,so}`.
The library is downloaded and placed there by `bash install.sh --yes`. If the
library is absent at PDF ingest time, the per-document load fails with the
literal log line `pdfium dynamic library not found ... install via bash
install.sh --yes` and the ingest continues with the remaining sources —
markdown and plain-text ingest are unaffected.

**Encrypted / password-protected PDFs** — pdfium returns a clear error during
open; `claudeknows ingest` surfaces the error and skips the document.

## Facts

### Verified facts
- The 8 sections of this rule and the activation sentinel path
  `<project>/.claude/knowledge/index.db` are mandated by PRD §11 line 2449 FR-7.1.
- The `resolve_project_root` security backbone is the only path-from-user-input
  gate in the binary — source: `tools/sdlc-knowledge/src/cli.rs:1-3, 37`.
- The BM25 score-direction convention (positive larger-is-better in JSON;
  `-bm25(chunks_fts) AS score` with `ORDER BY score DESC` in SQL) is
  implemented at `tools/sdlc-knowledge/src/search.rs:1-18, 70-82`.
- The 12-agent / 5-executor split mirrors the cognitive-self-check rule —
  source: `~/.claude/rules/cognitive-self-check.md` `## Application Scope`.
- Schema v2 adds nullable `chunks.page_start` / `chunks.page_end` columns and
  a `pages(doc_id, page_no, text)` table; PDF ingest tags every chunk with
  its 1-indexed page number and stores per-page extracted text — source:
  `tools/sdlc-knowledge/src/store.rs` (`SCHEMA_V2_PAGES_TABLE`,
  `replace_pages`, `get_page_by_id`), `tools/sdlc-knowledge/src/migrations.rs`
  (`apply_v2`), and `tools/sdlc-knowledge/src/ingest.rs` (`chunk_pages`).
- The `page` subcommand returns `{doc_id, source_path, page_no, text}` JSON
  with exit 0/1/2 semantics defined in `tools/sdlc-knowledge/src/main.rs`
  (`run_page`).

### External contracts
- `rusqlite` — symbol: `Connection::prepare`, `params!`, `query_map` — source:
  `tools/sdlc-knowledge/src/search.rs:26, 84-95` — verified: yes (read in this
  session).
- SQLite FTS5 `bm25()` — symbol: `bm25(chunks_fts)` returns NEGATIVE scores
  (smaller = better) — source: SQLite FTS5 docs (referenced from
  `tools/sdlc-knowledge/src/search.rs:5-6`); negation convention verified at
  `tools/sdlc-knowledge/src/search.rs:75` — verified: yes.
- SQLite `ALTER TABLE ... ADD COLUMN` — symbol: schema migration primitive
  used by `apply_v2` to add nullable `page_start` / `page_end` to `chunks`
  without rewriting the table — source: `tools/sdlc-knowledge/src/migrations.rs`
  (idempotent via `pragma_table_info` probe) — verified: yes (live migration
  exercised by `tests/page_test.rs::v1_to_v2_migration_adds_page_columns_and_pages_table`
  and `migration_is_idempotent`).
- `pdfium-render` crate v0.9 — symbol: `Pdfium::bind_to_library`,
  `load_pdf_from_byte_slice`, `pages()`, `text()` — source: pdfium-render
  rustdoc (referenced via Slice 1 architect pre-review of pdfium-pdf-extraction)
  and `tools/sdlc-knowledge/src/pdf.rs` (Slice 1 implementation) — verified:
  yes (Slice 1 of pdfium-pdf-extraction reverified the API symbols; the calibre
  fixture in `tools/sdlc-knowledge/tests/fixtures/calibre-sample.pdf` exercises
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
  and miss an opportunity to follow up with `page --by-id` after a
  re-ingest — how to verify: when an agent cites form (b) for a `.pdf`
  source path, surface a hint suggesting `claudeknows ingest <path>` to
  upgrade the document to v2.

### Open questions
- (none)
