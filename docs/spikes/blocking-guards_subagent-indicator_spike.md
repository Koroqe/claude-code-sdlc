# Spike: is there a usable subagent indicator on PreToolUse stdin?

PRD Section 8, FR-6.1. This is go/no-go for `pre:agent:isolation-guard`: without a
reliable way to tell a subagent's tool call from the orchestrator's, the guard
cannot decide anything and must fall back to a visible warning.

Run 2026-08-15 against Claude Code on this machine.

## Finding: field agent_id / agent_type — present in subagent context, absent in orchestrator context

## Method

A temporary project-level `PreToolUse` hook on `Edit|Write` was installed to dump
raw stdin to disk. Two writes were then performed with identical tool shape:

1. **Orchestrator** — the main session wrote `/tmp/spike-work/ORCH-probe.txt`.
2. **Subagent** — a `general-purpose` subagent was spawned and instructed to do
   exactly one `Write` to `/tmp/spike-work/SUBAGENT-probe.txt` and nothing else.

The temporary hook was removed immediately afterwards and never committed. The
captured payloads are reproduced below with the session id truncated.

## Captured payloads

Key set, orchestrator:

```
["cwd","effort","hook_event_name","permission_mode","prompt_id",
 "session_id","tool_input","tool_name","tool_use_id","transcript_path"]
```

Key set, subagent — the same, **plus two**:

```
["agent_id","agent_type","cwd","effort","hook_event_name","permission_mode",
 "prompt_id","session_id","tool_input","tool_name","tool_use_id","transcript_path"]
```

| Field | Orchestrator | Subagent |
|---|---|---|
| `hook_event_name` | `"PreToolUse"` | `"PreToolUse"` |
| `tool_name` | `"Write"` | `"Write"` |
| `agent_id` | *absent* | `"a5e9850a15e91ae96"` |
| `agent_type` | *absent* | `"general-purpose"` |
| `session_id` | `10b06ce9-212…` | `10b06ce9-212…` (identical) |
| `permission_mode` | `"bypassPermissions"` | `"bypassPermissions"` |

`session_id` is shared between orchestrator and subagent, so it cannot
distinguish them. `agent_id` and `agent_type` are the only differentiators.

## What this means for the guard

**FR-6.2 branch is viable**: the guard can deny a subagent write to a protected
path, and allow the orchestrator's.

But the indicator is **presence/absence-based**, not a value comparison, and that
shapes the implementation (security pre-review SEC-7.2):

- Treating "no `agent_id`" as "orchestrator, allow" is correct *today*. If a
  future Claude Code release stops sending the field, every subagent write would
  be silently allowed — the guard would look installed, stay green, and enforce
  nothing. That is the exact failure mode this whole feature exists to prevent.
- So **absence must degrade to fail-visible, not to silent allow**: when the
  target is a protected path and no indicator is present, the guard emits a
  warning saying origin could not be determined, rather than passing in silence.

## Honest limits — these belong in the handler header, not just here

1. **The indicator is harness-authored, not attacker-authored.** Neither a
   subagent's prompt nor injected repository content can alter hook stdin; they
   can only make tool calls, which the harness annotates. So a prompt-injected
   subagent cannot suppress `agent_id`. The indicator is exactly as trustworthy
   as `tool_name` is.
2. **Undocumented.** `agent_id` and `agent_type` are not in the public hooks
   input reference. They are observed behaviour on this version, which is why
   absence must be loud rather than silently permissive.
3. **Edit/Write only.** The guard matches those two tools. A subagent that
   appends to the scratchpad through `Bash` bypasses it entirely, by
   construction. The guard must never be described as *enforcing* the isolation
   rule generally — the backstops (the changelog idempotency guard, merge-ready
   Gate 0) remain the real coverage for that path.
4. **`agent_type` is the subagent's type name**, not a trust level. It is
   recorded here because it is useful in a warning message; it must not become
   an allowlist.
