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

In iter-1 the `--json` flag emits one aggregate JSON object after the batch completes, summarising every file the recursive walk processed. The default (text) mode emits one progress line per file as ingestion completes, plus a final `summary:` line.

### iter-1 JSON output shape

```
{
  "succeeded":       ["<path>", ...],
  "failed":          [{"path": "<path>", "error": "<message>"}, ...],
  "unchanged":       ["<path>", ...],
  "succeeded_count": <int>,
  "failed_count":    <int>,
  "unchanged_count": <int>
}
```

`unchanged` is the idempotency signal: the binary fingerprints each source by sha256 + mtime and skips re-chunking when both match. `failed` is non-fatal — the batch continues and per-file errors are surfaced in the `failed` array.

### iter-1 default (text) output

When the slash command runs without `--json`, the binary streams human-readable progress as each file completes plus a single final summary line. Example:

```
ingested: docs/regulations/gdpr-art-5.pdf
unchanged: notes/draft.md
failed: broken/scan.pdf — pdf-extract: encrypted document
summary: 12 succeeded, 3 unchanged, 1 failed
```

iter-2 may move to a streaming line-delimited JSON shape (one object per file, plus a separate terminal `{"summary": ...}` object); the `--json` shape above is iter-1-only and the slash command consumer SHOULD treat the aggregate object as authoritative for iter-1.

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
