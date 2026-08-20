# SubagentStop: the observed payload

> **Superseded in part on 2026-08-20.** Re-captured on **Claude Code 2.1.237** (temporary
> settings.json hook, headless `claude -p` run): the payload NOW carries **`agent_type`**
> (e.g. `"agent_type": "general-purpose"`), plus `prompt_id` and an `effort` object. The 2.1.9
> capture below stands as the record for that version. Consequence: `stop:gate-evidence` can now
> attribute evidence to specific gate agents, and `subagent:stop:wave-record` no longer needs to
> key on opaque `agent_id` alone — both are recorded as a follow-up feature, not yet implemented.
> Full re-measurement: `remeasurement-2.1.237.md`.

Captured live on **Claude Code 2.1.9** by a temporary plugin hook, then removed. This is measurement,
not documentation-reading — two prior claims about this event turned out to be wrong.

## What the event actually carries

```json
{
  "session_id": "788ae1de-…",
  "transcript_path": "~/.claude/projects/<project>/<session>.jsonl",
  "cwd": "/Users/…/claude-code-sdlc",
  "permission_mode": "default",
  "hook_event_name": "SubagentStop",
  "stop_hook_active": false,
  "agent_id": "abf2eb2",
  "agent_transcript_path": "~/.claude/projects/<project>/<session>/subagents/agent-abf2eb2.jsonl"
}
```

## What is NOT there, despite being documented

- **`agent_type`** — absent. There is no field naming which agent finished. A wave dispatching
  `test-writer` and `code-reviewer` in parallel cannot tell them apart from the payload alone; only
  the opaque `agent_id` distinguishes them.
- **`last_assistant_message`** — absent. The subagent's final text does not arrive in the payload.

Both were stated as present by research against the public docs. They are not. Treat any further
claim about this event as unverified until captured.

## What is there instead, and why it is better

`agent_transcript_path` points at the subagent's **own transcript file**, which exists on disk at the
moment the hook fires. The captured run's file held 6 records — `user`, `assistant` and `progress`
types — so a hook can read what the subagent actually did, not merely what it chose to summarise.

That distinction matters for this harness specifically. Wave execution currently trusts each
subagent's self-reported result: its deviation-rule tally, whether its `Verify:` command genuinely
passed, whether it wrote outside its declared file set. A self-report is exactly the wrong source for
those facts. The transcript is the primary record.

## Design implication for wave-result verification

A future `SubagentStop` mechanism can, without trusting any self-report:

- read `agent_transcript_path` and confirm the slice's `Verify:` command was actually run, and its
  exit status, rather than accepting a claim that it passed;
- extract the real deviation-rule fires for the post-wave tally that feeds Trigger 2 of the instinct
  store, instead of relying on each subagent to report its own `(category, count)` pairs;
- detect writes outside the wave's declared write surface, backstopping
  `pre:agent:isolation-guard` after the fact.

Two constraints the design must respect:

1. **`agent_type` is unavailable**, so any per-role behaviour must be keyed off something else — the
   orchestrator recording which `agent_id` it dispatched for which slice, or content read from the
   transcript itself.
2. **It must not block.** `continue: false` is available on this event, and forcing a subagent to
   continue on a misread transcript would convert a recoverable wave failure into a stuck run — the
   autonomy contract's third rule. Report and let post-wave collection decide.

## Why the probe is not shipped

It captured what it existed to capture. Keeping a permanent hook that only logs would spend the last
slot under the ≤12 hook ceiling for no runtime benefit. The schema is recorded here; the next
increment can register one hook that does real work.
