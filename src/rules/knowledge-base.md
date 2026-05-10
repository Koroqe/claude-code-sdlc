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

Five subcommands — invoke verbatim:

- `claudeknows ingest <path> [--project-root <dir>] [--json]`
- `claudeknows search <query> [--top-k 5] [--mode lexical|dense|hybrid] [--context N] [--project-root <dir>] [--json]`
- `claudeknows list [--project-root <dir>] [--json]`
- `claudeknows status [--project-root <dir>] [--json]`
- `claudeknows delete <source-id> [--project-root <dir>] [--json]`

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

The `--mode` flag (iter-2 vector-retrieval-backend) selects retrieval strategy:

- `--mode lexical` — iter-1 BM25 baseline (FTS5 only); regression-safe for exact-keyword queries
- `--mode dense` — pure semantic K-NN via sqlite-vec over 384-dim e5-multilingual-small embeddings
- `--mode hybrid` — BM25 ⊕ dense fused via Reciprocal Rank Fusion with k=60 (Cormack et al. 2009); the **default mode**

Hybrid is the recommended default — it captures both exact-keyword and semantic recall in a single ranking. Pure-lexical or pure-dense modes are useful for ablation analysis, regression-safety on a v1 corpus, or when one of the two backends is degraded.

**Mode fallback contract.** When the e5 encoder model is unavailable OR the schema is at v1 (no `chunks_vec` virtual table), `--mode hybrid` and `--mode dense` automatically fall back to lexical retrieval with a stderr warning. The fallback is silent on stdout — the `mode_used` JSON field reflects the actual mode that produced each hit so agents can detect degraded-mode runs.

**Distance metric.** `chunks_vec` uses sqlite-vec's default L2 (Euclidean) distance. Because the e5-multilingual-small encoder produces L2-normalized vectors, L2 ranking is mathematically identical to cosine-similarity ranking — the formula is `cos = 1 − L2² / 2`. The `dense_score` field shows `−L2_distance` (negated so larger=better, matching the BM25 convention); a `dense_score = −0.43` corresponds to cosine similarity ≈ 0.91. Agents reading this field do NOT need to convert; ranking order is what matters and is preserved across the L2/cosine equivalence.

The JSON output for non-lexical modes carries auxiliary score fields (`bm25_score`, `dense_score`, `rrf_score`, `mode_used`) alongside the canonical `score`. Lexical mode emits `score` (negated BM25, larger=better) and omits the dense/RRF fields.

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

### External contracts
- `rusqlite` — symbol: `Connection::prepare`, `params!`, `query_map` — source:
  `tools/sdlc-knowledge/src/search.rs:26, 84-95` — verified: yes (read in this
  session).
- SQLite FTS5 `bm25()` — symbol: `bm25(chunks_fts)` returns NEGATIVE scores
  (smaller = better) — source: SQLite FTS5 docs (referenced from
  `tools/sdlc-knowledge/src/search.rs:5-6`); negation convention verified at
  `tools/sdlc-knowledge/src/search.rs:75` — verified: yes.
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

### Open questions
- (none)
