# Fixture: planner / digest-absent  (TC-15.2)

`docs/` exists but `docs/digest-index.md` deliberately does **not**. This is the freshly-scaffolded-project case: an absent digest is a designed state, not an error, so `planner` must proceed with zero prior-feature context and never stall asking for the file.

Paired with `delegation-prompt.md`, which states the current feature's PRD section number and title
explicitly — `planner` no longer discovers that by reading the whole PRD, so the delegation prompt is
the only place that information reaches it.
