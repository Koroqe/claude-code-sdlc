# Fixture: no-plan

This directory deliberately has no `docs/plan.md`, no other plan file, and no `.claude/scratchpad.md`
— nothing `verifier` can read to identify "the plan's `Files:` fields." When invoking `verifier`
against this fixture, do not supply a file list in the delegation prompt and do not Glob on its
behalf; the point is to reproduce the case where neither of the two sources in Process step 3 (the
plan/scratchpad, or a file list/Glob supplied by the caller) is available.

Level 1 reports `SKIPPED — cannot determine expected artifacts`. Per the verdict precedence, an
`UNCERTAIN`-triggering condition on any level (here, Level 1) that isn't itself a FAIL still routes
to `UNCERTAIN`, not `FAILED` and not a silent pass.

Expected verdict: `UNCERTAIN`, `passed: false`, `human_verification_required` non-empty describing
the missing plan.

## Do not add a plan file or a scratchpad here

Adding `docs/plan.md` or `.claude/scratchpad.md` gives `verifier` something to read and eliminates
the exact condition this fixture exists to reproduce. The two source files below are real,
plausible-looking production code specifically so a careless reader doesn't "fix" the fixture by
assuming a plan was simply forgotten — it was intentionally omitted.
