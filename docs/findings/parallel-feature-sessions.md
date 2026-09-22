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

Performed by the orchestrator at `/merge-ready` Gate 6 (2026-09-22), per the duty carried in the
scratchpad plan record (W10). Real worktrees of this repository at the feature head (`3b7ef2b`),
created with `git worktree add`, removed after; hooks invoked through the shipped
`hooks/lib/run-hook.js` wrapper exactly as Claude Code invokes them. TC-CC.13 and the BEHAVIORAL
worktree arms.

**Arm 1a — spine, fresh worktree, scratchpad ABSENT (TC-9.2/TC-1.3).** A fresh worktree checkout
carries no `.claude/scratchpad.md` (gitignored, untracked — the designed post-de-track state).
`session:start:spine` with `cwd` in the worktree emitted `{"continue":true}` — no scratchpad
lines, no `no parseable state` line. PASS.

**Arm 1b — spine, seeded unparseable scratchpad (TC-9.1).** With the worktree's scratchpad seeded
`## Branch: <<<<<<< HEAD` (the literal a real merge conflict leaves), the spine emitted exactly
`scratchpad: no parseable state` and no state block. The same run demonstrated TC-4.11 live: the
stale-install line fired FROM THE WORKTREE (`stale project-scope install: project-scope 4.9.2,
loaded 4.10.0`) — the worktree-aware matching recognizing a real version skew on the machine —
and the memory-layer drift probe named the 4 delivered files this branch changes. PASS.

**Arm 2 — trust inheritance (TC-4.1, UC-4).** With a registry holding ONLY the main repository
root (via the tmp-scoped `SDLC_TRUST_REGISTRY` test seam) and `stop:typecheck-format` run with
`cwd` in the worktree: `running typecheck: "echo typecheck-REHEARSAL-OK" | typecheck passed` —
the worktree inherited trust through the `--git-common-dir` fallback and executed the declared
command. Control: the same worktree against a registry holding only an unrelated root reported
`declared typecheck command NOT executed (untrusted-project)` — report-only degrade intact. PASS.

**Arm 3 — git-guard judgment from worktrees (UC-9).** From the feature-branch worktree, a
`git commit` PreToolUse probe returned `{"continue":true}` (allowed). From a second worktree with
`main` checked out, the identical probe returned `permissionDecision: "deny"` with the
feature-branch refusal text — the guard judges the WORKTREE'S OWN branch, not the primary
checkout's. PASS.

All four arms PASS. Worktrees and the rehearsal branch removed after the runs; primary tree
untouched throughout (`git status` clean before and after).

The body of this section is written by the **orchestrator during `/merge-ready`'s Gate 6** — the
duty is carried by the scratchpad plan record, not by the merge-ready skill file. The rehearsal's
committed transcript (TC-CC.13: spine on an absent scratchpad, spine on a seeded unparseable one,
trust inheritance from the registered main root, and a git-guard commit judgment, all run from a
real worktree) is appended at this heading when that gate runs. Its absence before then is the
expected state, not a gap.
