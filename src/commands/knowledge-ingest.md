# Command: Knowledge Ingest

Ingest a folder or file of domain sources (books, articles, regulatory PDFs, plain-text docs, markdown) into the per-project local knowledge base. Once ingested, all 12 thinking agents in the SDLC pipeline query the base before authoring domain-bearing content and cite hits in their `## Facts → ### External contracts` block per the cognitive-self-check rule.

## Required argument

```
/knowledge-ingest <path>
```

- `<path>` — required. Either a single file (`.md`, `.txt`, `.pdf`) or a directory. Relative paths are resolved against the current project root; absolute paths are accepted only if they canonicalize inside the current project root (the binary rejects absolute paths outside cwd with exit 2 per the path-canonicalization contract).

If `<path>` is omitted, emit a usage line and exit without error:

```
Usage: /knowledge-ingest <path>   # file or directory inside the current project
```

## Action

The command invokes the global retrieval CLI shipped under `~/.claude/tools/sdlc-knowledge/`:

```
~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest <path> --json
```

The `--json` flag streams one JSON object per file as ingestion progresses, plus a final summary object. The command MUST stream each per-file JSON line to chat as it arrives so the user sees progress on large directories rather than waiting for the entire batch to finish.

### Per-file progress streaming

Each per-file line has the shape:

```
{"file": "<relative path>", "status": "ingested" | "skipped" | "failed", "chunks": <int>, "reason": "<optional string>"}
```

Render each line as a single human-readable progress row. Examples:

```
[ingested] docs/regulations/gdpr-art-5.pdf — 47 chunks
[skipped]  notes/draft.md — already up-to-date (sha256+mtime match)
[failed]   broken/scan.pdf — pdf-extract: encrypted document
```

`skipped` is the idempotency signal: the binary fingerprints each source by sha256 + mtime and re-ingests only when the fingerprint changes. `failed` is non-fatal — the batch continues and individual failures are reported in the final summary.

### Final summary line

After the per-file stream ends, the binary emits one terminal JSON object:

```
{"summary": {"sources": <int>, "chunks": <int>, "skipped": <int>, "failed": <int>, "elapsed_ms": <int>}}
```

Render it as a single human-readable line, for example:

```
Ingest complete: 12 sources, 437 chunks, 3 skipped, 1 failed in 4.2s.
```

## Binary-absent fallback

If the file at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does not exist or is not executable, do NOT attempt to invoke it. Emit the following user-facing message and exit without error (per FR-6.3):

```
sdlc-knowledge binary not found at ~/.claude/tools/sdlc-knowledge/sdlc-knowledge.

The local knowledge base is opt-in and the retrieval tool has not been installed yet.
To install it, re-run the SDLC installer from the cloned repo:

    bash install.sh --yes

The installer will fetch the prebuilt binary for your platform from GitHub Releases,
or fall back to a cargo source-build if cargo is on PATH and no release matches your
platform yet. After installation, retry: /knowledge-ingest <path>
```

The literal phrase `bash install.sh --yes` MUST appear verbatim in the message so the user can copy it directly. Exit code is 0 — a missing binary is a degraded-but-valid state, not an error.

## Behavior contract summary

- The command is a thin wrapper around `sdlc-knowledge ingest <path> --json`. No business logic lives in the slash command itself.
- All ingestion state (sources, chunks, FTS5 index) is per-project under `<project>/.claude/knowledge/`. The CLI binary is global at `~/.claude/tools/sdlc-knowledge/`.
- Ingestion is idempotent: re-running with the same `<path>` re-checks fingerprints and only re-chunks changed files.
- Ingestion is additive: it never deletes existing sources. Use `sdlc-knowledge delete <id>` from the shell to remove a source.
- The command exits non-zero ONLY when the binary itself returns non-zero (e.g., path-canonicalization rejection, corrupt-index unrecoverable, FTS5 schema mismatch). Per-file `failed` rows do NOT cause non-zero exit.

## Reference

The full CLI contract — all 5 subcommands (`ingest`, `search`, `list`, `status`, `delete`), the JSON output schemas, the BM25 ranking convention, the `knowledge-base:` citation prefix the 12 thinking agents use in `## Facts → ### External contracts`, and the known limitations of `pdf-extract` (scanned PDFs, multi-column layouts, form fields) — is documented in `~/.claude/rules/knowledge-base.md`. Read that rule before authoring any agent prompt that consumes the base.
