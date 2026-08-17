# Fixture: no-store-present

Control for TC-12.6 (`docs/qa/self-improvement-loop_test_cases.md`) — the required negative case:
an entirely absent `.claude/instincts.md` during planning is a designed state (FR-6.1), not an
error, and must not stall `planner`.

## Setup

This fixture directory deliberately contains **no** `.claude/instincts.md` file anywhere under it —
that absence is the fixture, not an omission. Only `feature-request.md` is present.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input, with the
target project having no `.claude/instincts.md` on disk. `planner` returns a complete plan with
zero `Prevention:` fields anywhere; no stall, no error, no fabricated rule.

Do not add a `.claude/instincts.md` file here under any circumstances — doing so destroys the only
negative control for FR-6.1's absent-file handling.
