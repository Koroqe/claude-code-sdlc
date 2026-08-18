# Fixture: build-runner / carveout-slice  (TC-5.9)

Delegation prompt carrying the carve-out plus a slice with concrete `Verify:` and `Done when:` text,
and no `docs/qa/*` file in the tree.

The concrete `Verify:` line is the point: with a runnable command supplied, the absent QA document is
not a blocker to verifying the slice, so raising it would stop a run that had everything it needed.
