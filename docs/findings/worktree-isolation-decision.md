# Decision: `isolation: worktree` stays deferred, and now for a different reason

## The original deferral has expired

Roadmap Risk 10 deferred git-worktree isolation for parallel waves with a specific expiry:

> GSD's changeset log is a graveyard of worktree bugs (orphan reaping, branches cut from `main` not
> HEAD, a stash list shared across worktrees). Our file-disjointness wave analysis is less elegant but
> currently safer. **Revisit after F2b.**

F2b shipped, so the trigger has fired and this needs a fresh answer rather than an indefinite defer.

## What changed in the meantime

Two things, pulling in opposite directions.

**Toward adopting it:** `isolation: worktree` is a real, documented frontmatter value, and it can also
be passed per-invocation when spawning a subagent. Its failure mode is a hard error rather than a
silent fallback, which is the right shape — a subagent that cannot be isolated should fail loudly.

**Against adopting it:** the wave-safety mechanism it would replace is now **mechanically enforced and
verified**, which it was not when Risk 10 was written. Write-surface disjointness is checked at
dispatch, `pre:agent:isolation-guard` refuses subagent writes to curated state, and the autonomy
regression test replays real tool sequences through every guard on each commit. Worktree isolation
would sit *on top* of that, not replace it.

## The decision

**Still deferred — but as a considered no, not a postponement.**

The concrete reason is that worktrees solve a problem this harness does not currently have. Wave
parallelism here is bounded by declared write surfaces that are checked before dispatch; two slices in
a wave cannot touch the same file, so there is no contention for worktrees to isolate. What worktrees
would add is protection against a subagent writing *outside* its declared surface — and there is now a
cheaper, verified answer to that: `SubagentStop` exposes `agent_transcript_path`, so the orchestrator
can read what a subagent actually did after the fact (see `docs/findings/subagent-stop-payload.md`).

Adopting worktrees would also introduce a class of failure the current design cannot have at all:
branches cut from the wrong ref, orphaned trees surviving a crashed run, and a shared stash list —
every one of which stalls an unattended run, which is what the autonomy contract exists to prevent.

## What would change this

Any of:

- Waves stop being file-disjoint by construction — e.g. slices that must edit the same file in
  sequence within one wave.
- A subagent is observed writing outside its declared write surface in a real run, and transcript
  inspection proves insufficient to catch it.
- The harness starts running multiple *features* concurrently rather than multiple slices, where true
  branch isolation is the only correct answer.

Until one of those happens, the file-disjointness analysis plus the isolation guard is the smaller
mechanism that does the job, and smaller is the right default for something that must not dead-end at
2 a.m.
