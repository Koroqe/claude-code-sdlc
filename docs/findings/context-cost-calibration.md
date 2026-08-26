# What the harness charges a session to think — measured

**Measured 2026-08-26, Claude Code 2.1.237, installed plugin 4.7.0.**

## Why this exists

Three budgets in this repo bound how MANY components ship (≤16 agents, ≤10 skills,
≤12 hook ids). Nothing bounded how LARGE they are — and size is the cost that is
actually paid, because a skill's full text enters the context every time it is
invoked.

`claude plugin details` reports a projected per-component token cost, which looks
like the right instrument until you notice **it reads the installed plugin cache,
not the working tree**. It can therefore only score a change after that change has
shipped. That is backwards for a guard, and it is the specific reason the
context-tax item sat in the improvement queue unbuilt: there was no way to see
whether a cut had worked before releasing it.

## The measurement

Working-tree bytes of each component against the CLI's own reported on-invoke cost
for the same installed version:

| component | bytes | CLI-reported | bytes/token |
|---|---|---|---|
| merge-ready | 40,617 | ~14.7k | 2.76 |
| develop-feature | 32,444 | ~11.7k | 2.77 |
| planner | 23,437 | ~8.5k | 2.76 |
| implement-slice | 23,176 | ~8.3k | 2.79 |
| verifier | 17,662 | ~6.4k | 2.76 |
| bootstrap-feature | 13,355 | ~4.8k | 2.78 |
| sdlc-fast | 12,219 | ~4.3k | 2.84 |
| sdlc-quick | 8,672 | ~3k | 2.89 |
| context-refresh | 2,809 | ~920 | 3.05 |

**tokens ≈ bytes / 2.78.** Across the five components that dominate the bill the
ratio is 2.76–2.79; the spread at the small end is the CLI's own rounding of the
numbers it prints. That constant is what `scripts/ci/validate-context-budget.js`
uses, so a cut is now scoreable locally, before shipping, with `--report`.

## The multiplier nobody had counted

Per feature, `merge-ready` is invoked once. `implement-slice` is invoked **once per
slice**, and the pipeline's own range is 5–9 slices. A byte added to
`implement-slice` therefore costs roughly 8× a byte added to `merge-ready`, which
inverts the intuition that the biggest file is the biggest problem:

```
component            ~tok   x/feature   weighted
implement-slice      8,337      8        66,696
merge-ready         14,181      1        14,181
develop-feature     11,671      1        11,671
test-writer            989      8         7,912
```

Weighted total for an 8-slice feature: **~147k tokens of instruction text.**

### A wrong multiplier is worse than no multiplier

The first version of this table listed `verifier` at one run per slice, on the
assumption that per-slice verification would call it. It does not: `verifier` is
invoked only by `merge-ready`'s Gate 6, once per feature. `grep -c verifier
skills/implement-slice/SKILL.md` returns 0.

That single wrong entry inflated the weighted total by ~44k tokens — larger than
every component on the list except `implement-slice` itself. The multipliers in
the validator are now derived by reading which agents each skill actually invokes,
and the correction is recorded here because the plausible-looking version of this
table was wrong in exactly the direction that would have justified cutting the
wrong file.

## A skill's on-invoke cost covers `SKILL.md` only — measured, not read off docs

**Measured 2026-08-26, Claude Code 2.1.237.** Wrote a 20,000-byte sibling file into
the installed cache at
`~/.claude/plugins/cache/claude-code-sdlc/claude-code-sdlc/4.7.0/skills/context-refresh/PROBE.md`
and re-ran `claude plugin details`:

| | always-on | context-refresh on-invoke |
|---|---|---|
| before | ~1,155 tok | ~920 tok |
| with a 20 KB sibling file | ~1,155 tok | ~920 tok |

Neither number moved. The skill directory is not bundled into the invocation; only
`SKILL.md` is. Probe removed afterwards, cache left clean.

**What this unlocks, and what it does not.** It means progressive disclosure is
real on the *cost* side: text moved out of `SKILL.md` into a sibling file stops
being charged on every invocation. The obvious candidate is
`implement-slice`'s `### 6. Capture Instincts` — 7,908 of that file's 23,176 bytes
(34%), paid once per slice (~22.8k tok per 8-slice feature) for a step that
no-ops unless one of its triggers fired.

It does **not** establish the behavioural half: that an agent told to read a
sibling file reliably does so. That is unmeasured, and the failure mode is the bad
kind — instinct capture degrading silently while every surface still reports
success. Any such split must therefore be fail-visible (the step states plainly
that it could not read its procedure) and must be measured with a live eval case
before it ships, not assumed from this result.
