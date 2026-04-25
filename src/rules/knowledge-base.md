# Knowledge Base Rule — `sdlc-knowledge` Agent Activation

This rule governs how SDLC thinking agents query the local `sdlc-knowledge`
index and cite results. Activation is conditional on a sentinel file; absence
is a silent no-op so the rule ships safely into opt-out projects.

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

The `sdlc-knowledge` binary lives at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`
and exposes exactly five subcommands. Invoke them verbatim:

- `sdlc-knowledge ingest <path> [--project-root <dir>] [--json]`
- `sdlc-knowledge search <query> [--top-k 5] [--project-root <dir>] [--json]`
- `sdlc-knowledge list [--project-root <dir>] [--json]`
- `sdlc-knowledge status [--project-root <dir>] [--json]`
- `sdlc-knowledge delete <source-id> [--project-root <dir>] [--json]`

The `--project-root <dir>` flag pins the index location to a specific project;
omitted, the binary resolves the project root relative to the current working
directory via `resolve_project_root` (the single path-from-user-input gate in
`tools/sdlc-knowledge/src/cli.rs`). Agents SHOULD pass `--json` when consuming
output programmatically; humans get human-readable text by default.

Typical agent query (the literal invocation referenced from per-agent
`## Knowledge Base (when present)` activation blocks):

```
~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json
```

## Citation format

When a search hit load-bears on a decision (i.e., the agent would have written
something different without it), the agent MUST cite the hit in its fact
block under `### External contracts` using this exact byte shape:

```
knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes
```

`<source-filename>` is the document path returned in the `source` JSON field;
`<chunk-id>` is the integer `chunk_id` field; `<query>` is the literal query
string the agent passed; `<score>` is the JSON `score` field rendered with
fixed-point precision.

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

- **Binary absent** — `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is not
  installed. Agent logs the literal line `knowledge-base: tool not installed; skipping`
  to stderr and proceeds without citation. Not a hard error; downstream gates
  do not flag it.
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

## Known limitations of pdf-extract

The `pdf-extract` crate (used in iter-1 ingestion) has documented limitations
that affect retrieval quality. Per TC-AAI-5, ingestion of the following document
classes is best-effort and SHOULD be flagged to the operator:

- **Scanned PDFs** — image-only PDFs without an embedded text layer yield empty
  or garbage text from `pdf-extract`. There is no embedded character data for
  the crate to extract. Recommend OCR pre-processing (e.g., `ocrmypdf` then
  re-ingest) — OCR is OUT OF SCOPE for iter-1.
- **Multi-column layouts** — academic papers, newspapers, and two-column
  technical specifications often produce reading-order errors: `pdf-extract`
  can interleave text from adjacent columns, breaking sentence continuity and
  degrading BM25 relevance. The chunker cannot recover the original reading
  order from broken extraction.
- **Form fields and annotations** — interactive form values (filled fields)
  and annotation/comment text are NOT extracted. Documents whose semantic
  content lives in form fields will return empty chunks for those regions.
- **Password-protected PDFs** — encrypted PDFs return errors during open;
  `sdlc-knowledge ingest` surfaces the error and skips the document.

**Iter-2 fallbacks** (not active in iter-1): `lopdf` for low-level PDF object
access when `pdf-extract` fails or produces obviously broken output; system
`pdftotext` (poppler-utils) for highest fidelity on multi-column and scanned-
plus-OCR'd PDFs. Until iter-2, affected documents SHOULD be pre-processed
(Pandoc to text, OCR pass, copy-paste into a `.md` file) before ingest.

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

### External contracts
- `rusqlite` — symbol: `Connection::prepare`, `params!`, `query_map` — source:
  `tools/sdlc-knowledge/src/search.rs:26, 84-95` — verified: yes (read in this
  session).
- SQLite FTS5 `bm25()` — symbol: `bm25(chunks_fts)` returns NEGATIVE scores
  (smaller = better) — source: SQLite FTS5 docs (referenced from
  `tools/sdlc-knowledge/src/search.rs:5-6`); negation convention verified at
  `tools/sdlc-knowledge/src/search.rs:75` — verified: yes.
- `pdf-extract` crate — symbol: text-extraction entry points — source: crate
  README (not opened this session) — verified: no — assumption. The four
  limitations enumerated above (scanned PDFs, multi-column layouts, form fields,
  password-protected) are widely documented for the crate but not reverified
  against the specific version pinned in iter-1's `Cargo.toml` during this
  slice. Risk: the version in use may handle some categories differently than
  documented; mitigation: TC-AAI-5 exercises representative inputs.
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

### Open questions
- (none)
