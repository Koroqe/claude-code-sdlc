# Transcript fixtures for `subagent:stop:wave-record`

Modelled on a **real** subagent transcript captured from Claude Code 2.1.9, with paths neutralised so
they carry no personal directories. The record shapes — `assistant` records holding `tool_use` blocks,
`user` records holding `tool_result` blocks with an `is_error` flag, and a final `text` block — are
copied from that capture rather than invented.

| Fixture | What it encodes |
|---|---|
| `subagent-verify-pass.jsonl` | The slice ran its `Verify:` command and it passed. Baseline. |
| `subagent-verify-fail.jsonl` | The `Verify:` command **errored**, yet the subagent's own closing summary says "All checks pass". This is the case the whole hook exists for: a self-report cannot catch a subagent misreporting its own result, and the transcript can. |
| `subagent-truncated.jsonl` | A valid prefix followed by a half-written final line, as a crashed subagent leaves behind. Everything before the break must still be recovered. |
