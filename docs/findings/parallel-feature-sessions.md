# Parallel feature sessions — measured divergence and the worktree operating model

PRD §15 (Parallel Feature Sessions) moved this harness from one-feature-at-a-time per checkout to
**one Claude Code session per git worktree**, with features merged sequentially into a shared base.
This finding records the measurement that motivated it and the one piece of follow-up work the
feature deliberately does not perform.

## The measured instinct-store divergence

Before the de-track and union-merge mechanics shipped, the consuming monorepo
(`getdeal-platform-monorepo`) already ran parallel sessions against tracked singleton state — one
`.claude/instincts.md` carried by every branch. Measured across **16 worktrees** of that monorepo,
the instinct store's `Feature counter` held values ranging **1-23**, with `main` sitting at **19**.
Sixteen checkouts, sixteen histories of the same "singleton" counter — none authoritative, every
merge a coin-flip over whose history survives. This is the concrete failure that tracked, per-branch
singleton state produces under real parallel use, and it is why §15 de-tracks the scratchpad and
gives the instinct store union-merge semantics plus a reconciliation step instead of trusting git's
default merge to get curated state right.

## One-time monorepo reconciliation (post-merge work)

The diverged stores measured above are an existing condition, not something this feature's slices
repair: retroactive automated repair of already-diverged consumer stores is explicitly out of scope
(§15). A **one-time, out-of-band reconciliation of that monorepo's instinct stores** — guided by
`/merge-ready`'s new Merge Reconciliation preamble, which defines exactly the counter-max and
occurrence-union rules such a pass needs — is noted here as post-merge work to be performed in the
consuming monorepo after this feature lands.

## Gate 6 live worktree rehearsal

The body of this section is written by the **orchestrator during `/merge-ready`'s Gate 6** — the
duty is carried by the scratchpad plan record, not by the merge-ready skill file. The rehearsal's
committed transcript (TC-CC.13: spine on an absent scratchpad, spine on a seeded unparseable one,
trust inheritance from the registered main root, and a git-guard commit judgment, all run from a
real worktree) is appended at this heading when that gate runs. Its absence before then is the
expected state, not a gap.
