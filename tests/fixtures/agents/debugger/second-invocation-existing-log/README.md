# Fixture: second-invocation-existing-log

Control for TC-19.1 (`docs/qa/self-improvement-loop_test_cases.md`) — a second `debugger`
invocation within the same feature reads the existing `.claude/debug/<feature-slug>.md` before
hypothesizing, and does not re-test an already-falsified hypothesis.

## Setup

`.claude/debug/some-feature.md` already records Invocation 1 (a prior Gate 4 failure), with
Hypothesis 1 ("the export job's timestamp comparison is timezone-dependent") explicitly marked
FALSIFIED and Hypothesis 2 CONFIRMED with a recommended fix. `gate5-failure.txt` is a new, related
Gate 5 failure on the same feature (a double-run defect in the same nightly-export scheduler) —
the shape `skills/merge-ready/SKILL.md`'s Auto-Fix Protocol hands `debugger` at `Gate 5 attempts:
2/3`.

Feature slug for this invocation (supplied via the delegation prompt, not a committed file, and
matching the existing log's own filename): `some-feature`.

## Expected result

Invoke `debugger` directly with `gate5-failure.txt` and the feature slug `some-feature` as the
delegation prompt's content, with `.claude/debug/some-feature.md` present in the target project as
committed here. Its first tool call for this invocation is a `Read` of
`.claude/debug/some-feature.md`. Its own returned hypothesis for this invocation is not a
re-statement of the already-falsified timezone hypothesis. The file, after this invocation
completes, contains BOTH invocations' hypothesis/result pairs — Invocation 1's Gate 4 records
unchanged, plus Invocation 2's new Gate 5 records — never only the most recent one.
