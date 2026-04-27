# Knowledge Base — Tool Description and Usage Mandate

Companion to `~/.claude/rules/knowledge-base.md` (which documents the CLI contract). This rule explains WHAT the knowledge-base tool is, WHY it exists, and WHEN agents MUST use it.

## What this tool is

A local Rust CLI binary `sdlc-knowledge` installed at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`, ALSO invokable as the short alias `claudeknows` from any directory on PATH (the alias is a symlink registered by `bash install.sh --yes` in the first writable PATH directory among `/usr/local/bin`, `/opt/homebrew/bin`, `~/.local/bin`). **Throughout this rule the agent uses `claudeknows`** as the canonical short form; the absolute path is the backward-compat fallback for environments where the alias was not registered. The binary:

- Reads PDF / Markdown / plain-text documents from `<project>/.claude/knowledge/sources/` (or any path under the project root)
- Splits each document into ~500-character overlapping chunks (UTF-8 boundary safe)
- Stores chunks in a SQLite FTS5 virtual table at `<project>/.claude/knowledge/index.db` (one file per project)
- Serves BM25-ranked full-text queries via `claudeknows search "<query>"`
- Per-document transactional ingest with sha256 + mtime idempotency — re-running is a no-op when sources are unchanged

No vector embeddings — pure lexical retrieval via SQLite's FTS5 `bm25()` function. Deterministic output, ~5-10 ms per query over 17 000-chunk indexes on a 2024 laptop.

## Why this exists

The knowledge base extends agent expertise with **project-specific domain content** — books, regulatory PDFs, internal style guides, architecture references — that is NOT present in pre-trained data and NOT in the codebase. Without it, agents fall back on training-data memory (often outdated, generic, or wrong for specialized domains like finance, healthcare, ML/AI, regulatory compliance, mobile platform conventions, niche frameworks) when authoring PRDs, plans, architecture decisions, and tests.

The base is the `### External contracts` evidence layer that the cognitive-self-check rule depends on for any domain-bearing claim. **A claim sourced "from training data" is an unverified assumption per `cognitive-self-check.md`; a claim cited from the knowledge base IS verified evidence.**

## Mandatory usage protocol

When `<project>/.claude/knowledge/index.db` exists, every in-scope thinking agent (the 12 listed below) MUST follow this protocol on every authoring task:

0. **Corpus scope relevance check (FIRST step, before any topical query).** Inspect the indexed source titles via `claudeknows list --json` and judge whether the task domain plausibly overlaps with the corpus content. See `## Corpus scope relevance protocol` below — this protocol exists to prevent the wasteful pattern of agents running 10+ multilingual queries on a corpus that simply does not cover the task's domain (e.g., a CI/CD release-engineering task against a corpus of ML/AI books) and then filling `### Open questions` with null-result noise that pretends to be corpus gaps when in reality the corpus is correctly scoped to a different domain.
1. **At the start** of the task, run `claudeknows status --json` AND `claudeknows list --json` to know how many docs and chunks are available, AND to detect which languages appear in the corpus (see `## Multilingual corpus protocol` below). This is an explicit acknowledgement that the base exists, not an optional check.
2. **For every domain-bearing concept** in the task, run AT LEAST ONE `claudeknows search "<terms>" --top-k 5 --json` BEFORE writing the first paragraph of output for that concept. **When the corpus contains documents in multiple languages, the agent MUST run the same conceptual query in EACH detected language** (see `## Multilingual corpus protocol`) — FTS5 lexical matching does not bridge translations, so an English-only query silently misses Russian / German / CJK / Arabic / etc. content even when it covers the same concept.
3. **If results are returned and load-bearing**, integrate them into the output AND cite them under `## Facts → ### External contracts` using the literal citation format from `~/.claude/rules/knowledge-base.md`.
4. **If a search returns zero results** for a concept that should plausibly be in the base, document the negative search under `### Open questions` (e.g., `knowledge-base: searched "<query>" → 0 hits; consider adding domain reference for <topic>`). Do NOT silently skip — surfacing gaps is how the user knows what to add to the corpus. **Before logging a zero-result, the agent MUST have tried the same concept in every detected language** — a query that returns 0 in English but ≥1 in Russian is NOT a corpus gap, it is a translation gap in the agent's query phrasing.
5. **NEVER fabricate citations.** Only cite hits that `claudeknows search` actually returned in this session. The cognitive-self-check rule treats fabricated citations as the load-bearing failure mode it was designed to prevent.

## Concrete triggers — when you MUST query

You MUST run at least one search before drafting any of the following:

- **PRD Functional Requirements** that reference domain workflows, regulatory regimes, industry-specific standards, financial instruments, healthcare protocols, ML/AI techniques, mobile platform behaviors, or specialized terminology unfamiliar from a general-software-engineering baseline.
- **Use cases** whose Actor / Preconditions / Postconditions involve domain-specific actions (e.g., "the trader settles the trade", "the practitioner records de-identified PHI", "the model performs gradient descent over the loss surface").
- **Architecture decisions** that depend on domain-specific patterns or constraints (e.g., schemas for double-entry accounting, FHIR resource shapes, RAG retrieval architectures, event-sourcing for trade audit trails).
- **QA test cases** whose edge cases come from domain failure modes (regulatory thresholds, industry-specific error categories, model collapse modes, encryption-at-rest requirements).
- **Planner slice scopes** whose done-condition depends on understanding a domain concept (e.g., "implement BM25 ranking" → search for BM25 references; "validate FHIR Observation" → search for FHIR domain).
- **Security audit reasoning** when threat models depend on domain-specific attacker behavior (e.g., front-running in finance, model-extraction attacks in ML, SQL-injection-via-LIKE in CMS).

## Corpus scope relevance protocol

The corpus is curated by the user and reflects the user's chosen domain. It is not a general-purpose reference. Tasks that fall outside the corpus's curated domain MUST NOT be force-fitted to it via many zero-result queries — that pattern fills `### Open questions` with noise that pretends to be corpus gaps when in reality the corpus is correctly scoped to a different domain.

### Step 0a — Inspect indexed titles before querying

After `claudeknows list --json`, the agent reads every `source_path` basename returned. Filenames carry topic information; the agent uses them to form its own picture of what the corpus contains. The agent decides — no list of expected topics is hardcoded into this rule.

### Step 0b — Three-way scope verdict

The agent renders one of three verdicts about whether the task's primary domain is represented in the indexed titles:

- **Overlap** — the task domain is well-represented in the corpus. Proceed to the multilingual query protocol below with the full query budget.
- **Partial overlap** — the task touches multiple sub-domains; some are represented, some are not. Proceed with reduced budget — query only the sub-domains the corpus covers; log the unfunded sub-domains per Step 0c.
- **No overlap** — the task domain is absent from the corpus. SKIP the topical query phase entirely. Log a single Open Question entry per Step 0c. Do NOT run scattered queries to "confirm" zero hits — the title list is sufficient evidence.

### Step 0c — Single Open Question entry for No-overlap and Partial cases

When the verdict is **No overlap**, log exactly one entry under `### Open questions` (not a query log per concept):

```
knowledge-base: corpus is <observed-domain>; task is <task-domain>; no overlap. Skipping topical queries — corpus enrichment with <task-domain> reference materials would help future similar tasks.
```

When the verdict is **Partial overlap**, log entries only for the unfunded sub-domains:

```
knowledge-base: corpus covers <covered-sub-domains>; <missing-sub-domain> not represented. The covered sub-domains were queried per the multilingual protocol; the missing sub-domain was skipped.
```

The placeholders are written by the agent based on what it observed in `list --json` and the task at hand. This rule does not enumerate which domains the corpus contains — that is the user's curation choice and may change between projects and over time.

### Step 0d — Document the verdict in `## Facts → ### Verified facts`

Whatever the verdict, the agent records it in the artifact's Facts block so reviewers can audit the scope-relevance reasoning:

```
Corpus scope relevance: <Overlap | Partial overlap | No overlap>; observed corpus domain: <observed>; task domain: <task>.
```

### Why this matters

The corpus-scope-relevance check prevents the failure mode where agents run many zero-hit queries on every task regardless of whether the task is in scope. Scope-mismatch becomes a single explicit decision (logged once with reasoning) instead of a noise floor in every artifact.

## Multilingual corpus protocol

The corpus may contain documents in multiple languages — English, Russian, German, Spanish, Chinese, Japanese, Arabic, etc. The user curates the corpus and is free to add any translations or original-language sources they want agents to draw on. **All those languages are first-class** — there is no "primary" language, and agents MUST NOT default to English-only retrieval.

The retrieval engine (SQLite FTS5 with the `unicode61` tokenizer) matches **lexical tokens**. It does not bridge translations. A query in one language does not match a chunk in another language even when both describe the same concept — the tokens differ at the character level. Agents that query in only one language silently miss every other language's content, defeating the purpose of curating multilingual sources.

### Step 1 — Detect languages at task start

After running `claudeknows status --json`, the agent runs `claudeknows list --json` and inspects the `source_path` basenames AND a small text sample from each language candidate. Detection cues the agent applies:

- Cyrillic characters in basenames or chunk text ⇒ Russian present.
- CJK ideographs ⇒ Chinese / Japanese / Korean present.
- Latin script with non-English diacritics (umlauts, tildes, cedillas, etc.) ⇒ disambiguate via probe.
- Latin-only without diacritics ⇒ likely English; confirm via probe.

Confirm presence by running a short common-word probe per language candidate. Use a one-token query in the language's most common stop word; non-empty result confirms presence. The choice of stop word is the agent's responsibility — pick a token that is both very common in the target language and unlikely to be a false-positive in any other language present.

Record the detected language set in your `## Facts → ### Verified facts` block at the start of the artifact (e.g., `Detected corpus languages: en, ru`) so reviewers can audit the multilingual coverage of every domain-bearing claim.

### Step 2 — Multilingual querying for every domain-bearing concept

For every domain-bearing concept the agent investigates, the agent generates one query per detected language. Technical terms are translated using domain-standard equivalents — not word-for-word transliterations. The translation is the agent's responsibility; this rule does not enumerate concept-translation pairs.

Run the queries for each language. Aggregate the hits — a chunk surfaced by any of the language variants is a load-bearing hit. Cite each with its original-language query string verbatim per the citation format.

### Step 3 — Translation discipline

When the agent translates an English term to Russian / German / etc., the translation goes IN THE QUERY STRING and IN THE CITATION's `query` field. The agent does NOT translate the cited chunk text or the snippet — quotations from the corpus stay in their original language.

### Step 4 — Negative-result accounting

Only log a `### Open questions` zero-result entry if **all language queries** for the concept came back empty. Format the entry as:

```
knowledge-base: searched "<en-query>" / "<ru-query>" / "<de-query>" → 0 hits in any language; consider adding domain reference for <topic>
```

This preserves the architect's review signal — when a multilingual gap shows up, it is a real gap (not just a query-phrasing issue).

### Step 5 — Cross-language citation breadth

When citing across languages, prefer balanced citation — if the concept is covered in BOTH English and Russian sources, cite at least one per language so downstream agents see the cross-language coverage. The cognitive-load constraint still applies — only cite chunks that load-bear on the decision.

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
- **Run `/knowledge-ingest <path>`** (slash command) or `claudeknows ingest <path>` from the shell to (re-)index. Idempotent — re-running on unchanged sources logs `unchanged: <path>` and returns exit 0.
- **Re-ingest** after editing or replacing a source. The sha256 fingerprint detects changes.
- **`claudeknows list --json`** — audit what is currently indexed.
- **`claudeknows delete <source-id>`** — remove a stale source. The FTS5 trigger cascades chunk deletion.
- **`claudeknows status --json`** — return `{schema_version, doc_count, chunk_count, db_path}` for quick health check.

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

When neither `claudeknows` (alias) nor `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (absolute path) is invokable — detected via `command -v claudeknows` empty AND the absolute path not executable — agents log `knowledge-base: tool not installed; skipping` once and proceed without citations. The mandate is suspended. The user's remediation path is `bash install.sh --yes` from the SDLC repo checkout. When the alias is absent but the binary is present (older install before the `register_claudeknows_alias` step), agents silently fall back to the absolute path; no log line, no warning.

## See also

- `~/.claude/rules/knowledge-base.md` — CLI invocation contract, citation literal-format, fallback behavior, pdfium-render coverage notes
- `~/.claude/commands/knowledge-ingest.md` — `/knowledge-ingest <path>` slash command spec
- `~/.claude/rules/cognitive-self-check.md` — how `### External contracts` citations are checked; the four-question protocol agents run before each decision

## Facts

### Verified facts

- The `sdlc-knowledge` binary lives at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` after `bash install.sh --yes` — verified by direct `--version` invocation in this session (returned `sdlc-knowledge 0.2.0`). Also invokable as `claudeknows` via the global alias registered by install.sh — verified by `claudeknows --version` returning the same `sdlc-knowledge 0.2.0` literal.
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
