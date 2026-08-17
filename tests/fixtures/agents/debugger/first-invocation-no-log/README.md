# Fixture: first-invocation-no-log

Control for TC-19.2 (`docs/qa/self-improvement-loop_test_cases.md`) — the first `debugger`
invocation for a feature, with no existing `.claude/debug/<feature-slug>.md`, treats the read step
as a no-op and creates the file fresh, rather than erroring on a missing file.

## Setup

One prior `build-runner` failure output, `failure.txt` — the shape
`skills/implement-slice/SKILL.md`'s Verify step hands `debugger` at `Slice <N> build-runner
attempts: 2/3`, per FR-8.5. No `.claude/debug/` directory exists anywhere under this fixture.

Feature slug for this invocation (supplied via the delegation prompt, not a committed file):
`widget-csv-import-validation`.

## Expected result

Invoke `debugger` directly with `failure.txt` and the feature slug above as the delegation
prompt's content. The read step (Process step 3, `Read
.claude/debug/widget-csv-import-validation.md`) finds nothing — a no-op, not an error — and the
file is created fresh by this invocation's own Read-then-Write persistence, recording this
invocation's hypothesis cycle(s).
