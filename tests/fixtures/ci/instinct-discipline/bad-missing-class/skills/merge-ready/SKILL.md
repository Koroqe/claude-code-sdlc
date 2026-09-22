---
description: Run all quality gates before merge — git hygiene, documentation completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy and UI/UX — then write the changelog entry.
argument-hint: "[gate name to rerun]"
arguments: [gate]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: Merge Ready (seeded CI fixture — trimmed mirror, NOT the real file)

> This is a trimmed, structurally-identical mirror of `skills/merge-ready/SKILL.md`'s instinct
> steps, committed only so `scripts/ci/validate-instinct-discipline.js`'s falsify step has a tree
> to run against. This file carries the C3/FR-1.5a dedup clause UNCHANGED and MUST pass every
> pre-existing discipline check. Its ONE deliberate defect: the Merge Reconciliation preamble's
> class (d) bullet has been removed — as if a later, unrelated edit quietly trimmed one repair
> class away — and nothing else is changed, proving the five-class assertion fires by name and
> isolates to the dropped class rather than only ever passing on the real file.

## Post-Gate Instinct Capture

**What fires it.** For every gate, across this entire `/merge-ready` run, whose Auto-Fix Protocol needed
at least one fix, capture exactly **one** instinct entry.

**FR-1.5a pre-capture dedup scan — MANDATORY, restated here because capture fires in this file too, not
only in `/implement-slice`.** Before minting a new `### <slug>` heading, scan every existing entry in
BOTH `## Prevention Rules` and `## Instincts Log` for one whose `Pattern:` and `Category:` both match
the pattern about to be captured. On a match, this is a recapture of that existing entry: update it in
place — this feature's slug is added to `(features: ...)` only if not already present there. Only when
no existing entry's `Pattern:` and `Category:` both match may a new slug be minted. Skipping this scan
is exactly what fragments occurrence counts across near-duplicate headings until nothing ever elevates
or retires.

## Consolidate Instincts

**Merge Reconciliation preamble — runs whenever the store shows merge artifacts** (a union merge
kept both branches' lines). Repair the five canonical classes, (e) first:

- **(a)** duplicate `Feature counter:` lines → keep the max. Safe direction: max undercounts by
  one per concurrent feature, so it only ever delays retirement, never triggers it early; a
  sum-of-deltas is not computable without the merge base and must never replace it.
- **(b)** duplicate `### <slug>` entries → union their `(features: ...)` lists; `Occurrences:` is
  the max of the two sides, floored at the union length; `Confidence:` is min(formula ceiling at
  the repaired count, max of the two confidences) — the formula is an upper bound, never an
  equality. Section placement: a cross-section duplicate repairs to a single entry, placed in
  `## Prevention Rules` only when the repaired count meets its category threshold, else
  `## Instincts Log`, deleting the other copy.
- **(c)** `Last confirmed at` above the counter → clamp it to the counter and recompute
  `Retires at`.
- **(e)** duplicated section headings → fold each section's blocks into one before the other
  repair classes are applied — the store parser silently appends a duplicate heading's lines into
  the first, so the earlier repairs would mis-read an unfolded store.
