# Fixture: two-features-no-collision

Control for TC-19.4 (`docs/qa/self-improvement-loop_test_cases.md`) — two different features'
debug files never collide: `debugger` only ever reads/writes the path keyed to the feature slug it
was given.

## Setup

Two independent sub-projects, each with its own prior debug-file content and its own new failure
output:

- `feature-alpha/.claude/debug/feature-alpha.md` (a resolved invoice-rounding diagnosis) +
  `feature-alpha/failure.txt` (a fresh Gate 4 failure for the same feature).
- `feature-beta/.claude/debug/feature-beta.md` (a resolved digest-duplicate-send diagnosis) +
  `feature-beta/failure.txt` (a fresh Gate 5 failure for the same feature).

## Expected result

Invoke `debugger` once with `feature-alpha/failure.txt` and feature slug `feature-alpha`, and once
with `feature-beta/failure.txt` and feature slug `feature-beta` (each against its own sub-project
directory, so each invocation sees only its own prior debug-file content). The `feature-alpha`
invocation's `Write` targets only `.claude/debug/feature-alpha.md`; the `feature-beta`
invocation's targets only `.claude/debug/feature-beta.md`. Neither invocation's returned diagnosis
references the other feature's hypothesis history (the rounding fix and the duplicate-send fix are
unrelated root causes in unrelated files).
