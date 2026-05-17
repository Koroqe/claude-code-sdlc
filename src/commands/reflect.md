# Command: Reflect

Invoke the `reflection` agent — the Default Mode Network analogue. No specific task. The agent reads project state, wanders, and surfaces non-obvious observations: unused exports, duplicated implementations, dead code paths, architectural inconsistencies, PRD requirements that lost their slice, the test suite that grew to 800 cases of which 600 take 30+ seconds.

The named failure mode this command prevents: **focus-induced blindness**. Every task-positive agent (planner, architect, qa-planner, implementer, qa-engineer) sees its slice and only its slice. Things that strike a human in the shower — "wait, didn't we already implement this in feature X six weeks ago?" — never strike the focused agents. Reflection makes that wandering pass explicit.

## When to invoke

- **Manual, when something feels off:** the project is shipping fine but you have a sense things are accumulating. Invoke `/reflect` and see what struck the agent. Often the answer is "nothing"; sometimes it's "you have three duplicate auth implementations."
- **After returning to a project after time away:** a fresh DMN pass is the analogue of "let me take a fresh look around" before resuming work.
- **Operator-scheduled (optional):** the operator may set a cron-style scheduled-skill to invoke `/reflect` daily or weekly as background hygiene. The output is informational; never blocking.
- **NOT auto-chained from other commands.** Unlike `/consolidate` (which `/develop-feature` invokes between waves), `/reflect` is exclusively user-invoked or operator-scheduled. The point is that it runs when nothing else is going on.

## Protocol

### Step 1 — Spawn the `reflection` agent

Pass NO specific task. The agent's prompt instructs it to read recent state and wander. Suggested starting points are baked into the agent prompt (git log, file sizes, TODO inventory, scratchpad archive, PRD vs test-case coverage); the agent is free to deviate.

The agent runs for up to ~10 minutes of sustained reading and thinking. Do NOT rush it; the point of DMN-mode is unhurried wandering.

### Step 2 — Surface the observations

The agent emits a free-form `## Observations` block. The orchestrator (the main agent running `/reflect`) simply relays it to the user verbatim. No re-formatting, no severity-tagging, no orchestrator-side interpretation. The observations are the user's to digest.

If the agent's `## Observations` block reads "I read through X, scanned Y, checked Z. Nothing struck me as worth flagging" — surface that verbatim too. A clean DMN pass is a legitimate output; the user decides if they trust it.

## Output (when /reflect completes)

```markdown
## /reflect Summary

**Invocation:** unstructured DMN pass on the current project
**Read duration:** ~<N> minutes
**Observations:** <count>

[verbatim ## Observations section from the reflection agent]

### Next step
- Read the observations. Decide what (if anything) to act on.
- Observations are NOT findings. No severity, no required follow-up. The agent surfaced what struck it; the human decides what matters.
```

## Rules

The orchestrator follows `~/.claude/rules/cognitive-self-check.md` on its own cycle-level claims. The per-observation fact-check is the reflection agent's responsibility — each observation must cite concrete evidence (file:line, commit hash, PRD reference).

## Relation to other commands

- `/consolidate` — sibling but different. `/consolidate` runs structured drift detection (six fixed passes, severity tags, required output structure). `/reflect` is unstructured (no fixed passes, no severity, free-form prose). The structural difference matters because the brain alternates between structured and unstructured modes for a reason; both produce signal, but different signal.
- `/develop-feature`, `/bootstrap-feature`, `/implement-slice`, `/qa-cycle`, `/merge-ready` — none of these chain `/reflect`. It is a standalone hygiene pass.
- `/release` — `/reflect` MAY be invoked before `/release` as a sanity check that nothing obvious got missed. The release-engineer does not chain it.

## When NOT to invoke

- **Mid-development of a focused feature.** DMN and TPN compete; running `/reflect` mid-`/develop-feature` is like trying to brainstorm while solving a math problem. Wait until you're between features.
- **Immediately after `/consolidate`.** They cover overlapping ground; reflection right after consolidation usually returns either the same findings restated, or a clean pass. Let `/consolidate` settle first.
- **When you're looking for something specific.** Reflection is unfocused by design. If you have a specific concern, use a targeted command (`/qa-cycle` for QA, `/consolidate` for drift, `architect` review for architecture). Reflection is for when you don't have a specific concern but suspect there's something worth surfacing.
