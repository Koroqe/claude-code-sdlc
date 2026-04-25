# Knowledge Base — Tool Description and Usage Mandate

Companion to `~/.claude/rules/knowledge-base.md` (which documents the CLI contract). This rule explains WHAT the knowledge-base tool is, WHY it exists, and WHEN agents MUST use it.

## What this tool is

A local Rust CLI binary `sdlc-knowledge` installed at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`. The binary:

- Reads PDF / Markdown / plain-text documents from `<project>/.claude/knowledge/sources/` (or any path under the project root)
- Splits each document into ~500-character overlapping chunks (UTF-8 boundary safe)
- Stores chunks in a SQLite FTS5 virtual table at `<project>/.claude/knowledge/index.db` (one file per project)
- Serves BM25-ranked full-text queries via `sdlc-knowledge search "<query>"`
- Per-document transactional ingest with sha256 + mtime idempotency — re-running is a no-op when sources are unchanged

No vector embeddings — pure lexical retrieval via SQLite's FTS5 `bm25()` function. Deterministic output, ~5-10 ms per query over 17 000-chunk indexes on a 2024 laptop.

## Why this exists

The knowledge base extends agent expertise with **project-specific domain content** — books, regulatory PDFs, internal style guides, architecture references — that is NOT present in pre-trained data and NOT in the codebase. Without it, agents fall back on training-data memory (often outdated, generic, or wrong for specialized domains like finance, healthcare, ML/AI, regulatory compliance, mobile platform conventions, niche frameworks) when authoring PRDs, plans, architecture decisions, and tests.

The base is the `### External contracts` evidence layer that the cognitive-self-check rule depends on for any domain-bearing claim. **A claim sourced "from training data" is an unverified assumption per `cognitive-self-check.md`; a claim cited from the knowledge base IS verified evidence.**

## Mandatory usage protocol

When `<project>/.claude/knowledge/index.db` exists, every in-scope thinking agent (the 12 listed below) MUST follow this protocol on every authoring task:

1. **At the start** of the task, run `sdlc-knowledge status --json` to know how many docs and chunks are available. This is an explicit acknowledgement that the base exists, not an optional check.
2. **For every domain-bearing concept** in the task, run AT LEAST ONE `sdlc-knowledge search "<terms>" --top-k 5 --json` BEFORE writing the first paragraph of output for that concept.
3. **If results are returned and load-bearing**, integrate them into the output AND cite them under `## Facts → ### External contracts` using the literal citation format from `~/.claude/rules/knowledge-base.md`.
4. **If a search returns zero results** for a concept that should plausibly be in the base, document the negative search under `### Open questions` (e.g., `knowledge-base: searched "<query>" → 0 hits; consider adding domain reference for <topic>`). Do NOT silently skip — surfacing gaps is how the user knows what to add to the corpus.
5. **NEVER fabricate citations.** Only cite hits that `sdlc-knowledge search` actually returned in this session. The cognitive-self-check rule treats fabricated citations as the load-bearing failure mode it was designed to prevent.

## Concrete triggers — when you MUST query

You MUST run at least one search before drafting any of the following:

- **PRD Functional Requirements** that reference domain workflows, regulatory regimes, industry-specific standards, financial instruments, healthcare protocols, ML/AI techniques, mobile platform behaviors, or specialized terminology unfamiliar from a general-software-engineering baseline.
- **Use cases** whose Actor / Preconditions / Postconditions involve domain-specific actions (e.g., "the trader settles the trade", "the practitioner records de-identified PHI", "the model performs gradient descent over the loss surface").
- **Architecture decisions** that depend on domain-specific patterns or constraints (e.g., schemas for double-entry accounting, FHIR resource shapes, RAG retrieval architectures, event-sourcing for trade audit trails).
- **QA test cases** whose edge cases come from domain failure modes (regulatory thresholds, industry-specific error categories, model collapse modes, encryption-at-rest requirements).
- **Planner slice scopes** whose done-condition depends on understanding a domain concept (e.g., "implement BM25 ranking" → search for BM25 references; "validate FHIR Observation" → search for FHIR domain).
- **Security audit reasoning** when threat models depend on domain-specific attacker behavior (e.g., front-running in finance, model-extraction attacks in ML, SQL-injection-via-LIKE in CMS).

## When you MAY skip

The mandate covers domain-bearing content. You MAY skip a query when authoring:

- Pure infrastructure code without domain semantics (a logger, a CI pipeline, a build script)
- Documentation generated mechanically from code structure
- Test scaffolding that does not depend on domain knowledge (timing tests, type-check tests, syntax fuzz)
- Refactors that preserve behavior byte-for-byte

If unsure whether a concept is "domain-bearing", default to running the search — the latency cost is ~10 ms.

## Application Scope

In-scope (12 thinking agents — MUST follow the mandate above):

`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`.

Exempt (5 executor agents — deterministic spec-followers, no authoring discretion):

`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`.

This list matches the cognitive-self-check rule's in-scope set verbatim.

## How to populate and maintain

User-driven (agents NEVER mutate the index):

- **Drop documents** into `<project>/.claude/knowledge/sources/` — accepts `.pdf`, `.md`, `.txt`. Sub-directories are recursively walked; symlinks are skipped for security.
- **Run `/knowledge-ingest <path>`** (slash command) or `sdlc-knowledge ingest <path>` from the shell to (re-)index. Idempotent — re-running on unchanged sources logs `unchanged: <path>` and returns exit 0.
- **Re-ingest** after editing or replacing a source. The sha256 fingerprint detects changes.
- **`sdlc-knowledge list --json`** — audit what is currently indexed.
- **`sdlc-knowledge delete <source-id>`** — remove a stale source. The FTS5 trigger cascades chunk deletion.
- **`sdlc-knowledge status --json`** — return `{schema_version, doc_count, chunk_count, db_path}` for quick health check.

## PDF extraction backend

PDF text extraction uses the `pdfium-render` v0.9 Rust crate (a binding to Chrome's PDFium engine). Unlike the iter-1 `pdf-extract` backend, `pdfium-render` correctly handles CID fonts, calibre-converted PDFs, multi-column layouts, and scanned PDFs with an embedded text layer — these are no longer best-effort failure modes.

The pdfium dynamic library (`libpdfium.dylib` / `libpdfium.so` / `libpdfium.dll`) is loaded at runtime; it is NOT statically linked. The library is installed by `bash install.sh --yes` at `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib,so}`. If the library is absent at PDF ingest time, the per-document load fails gracefully with a clear error and the ingest continues with the remaining sources — markdown and plain-text ingest are unaffected. Encrypted/password-protected PDFs return clear errors and are skipped.

## What this tool is NOT

- **NOT a vector database.** No embeddings, no semantic similarity. Queries match on lexical tokens. If a search returns weak results, reformulate with different terminology rather than trusting fuzzy semantic intent.
- **NOT shared across projects.** Every project has its own isolated `<project>/.claude/knowledge/` directory, source folder, and index. There is no global corpus.
- **NOT a replacement for reading the codebase.** Agents MUST still ground claims about THIS codebase by reading files via the Read tool. The knowledge base supplements with EXTERNAL domain knowledge.
- **NOT a validation oracle.** Citation hits are evidence of what the source says, not proof the source is correct. The corpus quality is the user's responsibility — agents cite what is there, the user curates what gets indexed.

## Backward compatibility

When `<project>/.claude/knowledge/index.db` does NOT exist, the mandate above is fully bypassed and agent behavior is byte-identical to a project that never adopted the knowledge base. The activation sentinel is the index-file existence; absence equals opt-out.

When the binary `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is missing or not executable, agents log `knowledge-base: tool not installed; skipping` once and proceed without citations. The mandate is suspended. The user's remediation path is `bash install.sh --yes` from the SDLC repo checkout.

## See also

- `~/.claude/rules/knowledge-base.md` — CLI invocation contract, citation literal-format, fallback behavior, pdfium-render coverage notes
- `~/.claude/commands/knowledge-ingest.md` — `/knowledge-ingest <path>` slash command spec
- `~/.claude/rules/cognitive-self-check.md` — how `### External contracts` citations are checked; the four-question protocol agents run before each decision

## Facts

### Verified facts

- The `sdlc-knowledge` binary lives at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` after `bash install.sh --yes` — verified by direct `--version` invocation in this session (returned `sdlc-knowledge 0.1.0`).
- The activation sentinel is the existence of the file `<project>/.claude/knowledge/index.db` — verified against `tools/sdlc-knowledge/src/main.rs` opening `root.join(".claude/knowledge/index.db")` and against the existing `~/.claude/rules/knowledge-base.md` `## Activation sentinel` section.
- The 12 in-scope thinking agents and 5 exempt executors enumerated above match the `~/.claude/rules/cognitive-self-check.md` `## Application Scope` list verbatim — these two rules MUST stay in sync.
- BM25 ranking via SQLite FTS5 `-bm25(chunks_fts) AS score ... ORDER BY score DESC` — positive score, larger = better match — verified against `tools/sdlc-knowledge/src/search.rs` and against a 17 030-chunk live test in this session that returned positive descending scores in 6-7 ms.

### External contracts

- **`sdlc-knowledge` binary v0.1.0** — symbol: subcommands `ingest / search / list / status / delete`; CLI flags `--project-root <PATH>`, `--top-k <N>`, `--json`; security backbone `cli::resolve_project_root` rejects path-traversal with exit 2 and literal stderr — verified: yes (live-tested in this session over the books corpus).
- **SQLite FTS5 + `bm25()` function** — symbol: `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')`; ranking via `bm25(chunks_fts)` (returns negative-better, code negates to positive-better) — verified: yes (live queries returned positive descending scores).
- **`pdfium-render` crate v0.9** — symbol: `Pdfium::bind_to_library` plus `load_pdf_from_byte_slice`, `pages()`, `text()` — verified: yes (Slice 1 of pdfium-pdf-extraction wires the binding via explicit-path load against `~/.claude/tools/sdlc-knowledge/pdfium/lib/libpdfium.{dylib,so}`; CID fonts, calibre-converted PDFs, multi-column layouts, and scanned PDFs with embedded text layer all extract correctly per TC-AAI-5 reverification).

### Assumptions

- The `<project>/.claude/knowledge/sources/` convention for raw documents is recommended but not enforced by the binary — users may store sources anywhere under the project root and pass an explicit path to `ingest`. Risk: future cross-tool integrations that expect the convention will need to be tolerant. How to verify: convention is documented here AND in `knowledge-base.md`; cross-tool integrations will be flagged in their own PRDs.
- The mandate's "domain-bearing" judgment is delegated to each in-scope agent's reasoning. Risk: an agent under-classifies a concept as non-domain-bearing and skips a search that would have surfaced relevant content. How to verify: cognitive-self-check Plan Critic flags claims without `### External contracts` citations on PRD/plan/use-case files; missing citations on domain-bearing concepts surface during code review.

### Open questions

(none) — the rule is self-contained; the existing `knowledge-base.md` covers the CLI contract and this rule covers the usage mandate. Future extensions (auto-ingestion, cross-project corpus, vector hybrid search) live in iter-2 PRDs.
