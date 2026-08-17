# Fixture: two-rules-one-slice

Control for TC-12.3 (`docs/qa/self-improvement-loop_test_cases.md`) — two independent Prevention
Rules whose `Pattern:` both overlap the same planned slice's `Files:` are both attached under one
`Prevention:` field, not only the first match found.

## Setup

`.claude/instincts.md` carries two `## Prevention Rules` entries, both with `Pattern:
src/routes/reports.ts`. `feature-request.md`'s intended Slice 1 is the only slice touching that
file.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. Slice 1's
`Prevention:` field lists **both** rules' `Rule:` text — the pagination guard and the date-range
validation — never only one of the two.
