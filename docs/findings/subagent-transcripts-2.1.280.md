# Subagent transcripts on Claude Code 2.1.280: the `isSidechain` signal is gone

Measured live, Windows, Claude Code 2.1.280, a real `/merge-ready`-shaped run (27 subagents
dispatched across roles including `prd-writer` … `verifier`, 9/9 gates, 226/226 tests, a genuine
MERGE READY verdict).

## What was measured

- The **main session transcript** (`transcript_path` from the `Stop` hook payload) contained
  **zero** records with `isSidechain: true`, despite 27 subagent invocations in the same session.
  `subagent-stop-payload.md` and `remeasurement-2.1.237.md` both document `isSidechain: true` as
  the signal `stop:gate-evidence` relied on through 2.1.237 — that signal is not present in this
  build's main transcript at all.
- Subagent transcripts are instead written to **separate files**, one per subagent, at
  `<transcript path with the .jsonl suffix removed>/subagents/agent-<id>.jsonl`, each paired with
  an `agent-<id>.meta.json` sibling. This matches the `agent_transcript_path` field already
  recorded in `subagent-stop-payload.md`'s 2.1.9 capture
  (`…/<session>/subagents/agent-abf2eb2.jsonl`) — the location was already known; what changed is
  that the main transcript no longer independently flags the same fact via `isSidechain`.
- In the MAIN transcript, each subagent dispatch is an assistant `tool_use` block with
  `name: "Agent"` (`"Task"` on older builds), and the harness writes the matching `type: "user"`
  record with a `tool_result` content block carrying the same `tool_use_id`, plus a **top-level**
  `toolUseResult` object. Its keys, as measured: `status`, `prompt`, `agentId`, `agentType`,
  `harnessNoteCount`, `harnessTailCount`, `harnessSectionHash`, `content`, `resolvedModel`,
  `totalDurationMs`, `totalTokens`, `totalToolUseCount`, `usage`, `toolStats`. This record is
  written by the harness onto the transcript as a byproduct of the dispatch completing — the
  model's own text cannot produce it — so a non-empty string `agentId` there is evidence in the
  same sense `isSidechain: true` was.

## Consequence

`hooks/handlers/stop-gate-evidence.js`'s `scan()` detected subagent activity ONLY via
`isSidechain: true`. On 2.1.280 that source is empty for every session, so every genuine MERGE
READY verdict — however many subagents actually ran — was refused with "no subagent ran at any
point in this session." The guard was measured blocking the run described above (27 subagents,
9/9 gates, 226/226 tests) on exactly that false premise.

## The fix

`scan()` now treats subagent evidence as the union of three independently-measured sources, any
one of which is sufficient:

1. `isSidechain: true` on a transcript record (2.1.237 and earlier).
2. A transcript record's top-level `toolUseResult` carrying a non-empty string `agentId`
   (2.1.280, own-property / type-checked read only).
3. The sibling `<transcript path minus .jsonl>/subagents/` directory containing at least one
   `agent-*.jsonl` file (lstat-checked: real directory, real file, not a symlink; bounded scan).

All three fail open to "no evidence from this source" on any error — none of them can turn a
filesystem hiccup into either a false allow or a spurious block. The existing behavior — denying a
claimed MERGE READY verdict when none of the sources found anything — is unchanged.
