# Fixture: planner / digest-nine-rows  (TC-15.1)

A `docs/digest-index.md` carrying **nine** rows. The case exists to prove `planner` reads a BOUNDED subset — pulling 2-4 in full — rather than all nine. Nine is deliberately above the bound, so a planner that reads everything is visibly wrong rather than coincidentally right.

Paired with `delegation-prompt.md`, which states the current feature's PRD section number and title
explicitly — `planner` no longer discovers that by reading the whole PRD, so the delegation prompt is
the only place that information reaches it.
