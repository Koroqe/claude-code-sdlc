# Command: Knowledge Ingest

Ingest a folder or file of domain sources (books, articles, regulatory PDFs, plain-text docs, markdown) into the per-project local knowledge base. Once ingested, all 13 thinking agents in the SDLC pipeline query the base before authoring domain-bearing content and cite hits in their `## Facts → ### External contracts` block per the cognitive-self-check rule.

## Required argument

```
/knowledge-ingest <path>
```

- `<path>` — required. Either a single file (`.md`, `.txt`, `.pdf`) or a directory. Relative paths are resolved against the current project root; absolute paths are accepted only if they canonicalize inside the current project root (the binary rejects absolute paths outside the project root with exit 2 per the path-canonicalization contract, surfacing the literal stderr line `WARN: path escapes project root: <path>`).

If `<path>` is omitted, emit a usage line and exit without error:

```
Usage: /knowledge-ingest <path>   # file or directory inside the current project
```

## Action

The command invokes the global retrieval CLI. After `bash install.sh --yes`
registers the global alias, the canonical short form is `claudebase`
(symlink in the first writable PATH directory among `/usr/local/bin`,
`/opt/homebrew/bin`, `~/.local/bin`). The absolute path
`~/.claude/tools/claudebase/claudebase` remains the backward-compat
fallback when the alias was not registered.

```
claudebase ingest <path> --json
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
failed: broken/scan.pdf — pdfium: encrypted document
summary: 12 succeeded, 3 unchanged, 1 failed
```

iter-2 may move to a streaming line-delimited JSON shape (one object per file, plus a separate terminal `{"summary": ...}` object); the `--json` shape above is iter-1-only and the slash command consumer SHOULD treat the aggregate object as authoritative for iter-1.

## Binary-absent fallback

If neither `claudebase` (alias) nor `~/.claude/tools/claudebase/claudebase`
(absolute path) is invokable — detection: `command -v claudebase` empty AND
the absolute path not executable — do NOT attempt to invoke. Emit the
following user-facing message and exit without error (per FR-6.3):

```
claudebase binary not found.
  alias 'claudebase' on PATH:                       absent
  absolute path ~/.claude/tools/claudebase/...:     absent

The local knowledge base is opt-in and the retrieval tool has not been installed yet.
To install it, re-run the SDLC installer from the cloned repo:

    bash install.sh --yes

The installer will fetch the prebuilt binary for your platform from GitHub Releases,
or fall back to a cargo source-build if cargo is on PATH and no release matches your
platform yet. install.sh also registers the `claudebase` alias automatically and, on
upgrade from a pre-2026-05-10 install, removes the legacy `claudeknows` symlink and
`~/.claude/tools/sdlc-knowledge/` directory.
After installation, retry: /knowledge-ingest <path>
```

When the alias is absent but the absolute path IS executable (older install
before the `register_claudebase_alias` step landed), silently fall back to
the absolute path — no warning, no degradation. Re-running `bash install.sh
--yes` registers the alias.

### Legacy `claudeknows` migration note

Prior to 2026-05-10 the binary was named `claudeknows` and installed at
`~/.claude/tools/sdlc-knowledge/sdlc-knowledge`. install.sh's
`install_claudebase` step migrates pre-existing installs by deleting the
old directory and removing the legacy `claudeknows` PATH symlink — this is
idempotent and silent on a fresh install. The slash command itself never
invokes the legacy name; users on stale installs should re-run
`bash install.sh --yes` to migrate.

The literal phrase `bash install.sh --yes` MUST appear verbatim in the message so the user can copy it directly. Exit code is 0 — a missing binary is a degraded-but-valid state, not an error.

## Behavior contract summary

- The command is a thin wrapper around `claudebase ingest <path> --json`. No business logic lives in the slash command itself.
- All ingestion state (sources, chunks, FTS5 index) is per-project under `<project>/.claude/knowledge/`. The CLI binary is global at `~/.claude/tools/claudebase/` (also invokable as `claudebase` via the install.sh-registered PATH symlink).
- Ingestion is idempotent: re-running with the same `<path>` re-checks fingerprints and only re-chunks changed files.
- Ingestion is additive: it never deletes existing sources. Use `claudebase delete <id>` from the shell to remove a source.
- The command exits non-zero ONLY when the binary itself returns non-zero (e.g., path-canonicalization rejection, corrupt-index unrecoverable, FTS5 schema mismatch). Per-file `failed` rows do NOT cause non-zero exit.

## Reference

The full CLI contract — all 6 subcommands (`ingest`, `search`, `list`, `status`, `delete`, `page`), the JSON output schemas, the BM25 ranking convention, the `knowledge-base:` citation prefix the 13 thinking agents use in `## Facts → ### External contracts`, and the pdfium-render PDF backend coverage (CID fonts, calibre-converted PDFs, multi-column layouts, scanned PDFs with an embedded text layer) — is documented in `~/.claude/rules/knowledge-base.md`. Read that rule before authoring any agent prompt that consumes the base.
