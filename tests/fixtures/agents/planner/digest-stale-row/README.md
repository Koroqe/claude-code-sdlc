# Fixture: planner / digest-stale-row  (TC-15.3)

A nine-row digest where Section 4's Summary still describes the use-cases file **as it existed at Gate 7 time** — referring to the flat `.claude/lessons.md` design that was later superseded. Proves the stale row is detected against the current file rather than trusted.

Paired with `delegation-prompt.md`, which states the current feature's PRD section number and title
explicitly — `planner` no longer discovers that by reading the whole PRD, so the delegation prompt is
the only place that information reaches it.
