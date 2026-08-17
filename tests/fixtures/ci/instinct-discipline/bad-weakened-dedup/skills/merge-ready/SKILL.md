---
description: Run all quality gates before merge — git hygiene, documentation completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy and UI/UX — then write the changelog entry.
argument-hint: "[gate name to rerun]"
arguments: [gate]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: Merge Ready (seeded CI fixture — trimmed mirror, NOT the real file)

> This is a trimmed, structurally-identical mirror of `skills/merge-ready/SKILL.md`'s "Post-Gate
> Instinct Capture" step, committed only so `scripts/ci/validate-instinct-discipline.js`'s falsify step
> has a tree to run against. This file carries the C3/FR-1.5a dedup clause UNCHANGED, and must NOT be
> flagged. This fixture's one deliberate defect lives in `skills/implement-slice/SKILL.md`, whose dedup
> scan is relaxed from AND to OR; a run that also trips this file would prove the validator treats the
> two capture surfaces as one instead of isolating to the file that actually carries the defect.

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
