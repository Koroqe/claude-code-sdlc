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
