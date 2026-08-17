# Fixture: one-rule-two-slices

Control for TC-12.4 (`docs/qa/self-improvement-loop_test_cases.md`) — a single Prevention Rule
whose `Pattern:` matches files in two different planned slices is attached to each slice
independently, not only the first one encountered.

## Setup

`.claude/instincts.md` carries one `## Prevention Rules` entry, `Pattern: src/lib/dateFormat.ts`.
`feature-request.md`'s intended Slice 1 and Slice 3 both touch that file; Slice 2 does not.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. Both
Slice 1 and Slice 3 carry the identical `Prevention:` text; Slice 2 carries no `Prevention:` field
at all. (The orchestrator's own single confirming `Edit` of `Last confirmed at` — not one per
matching slice — is exercised by a different fixture and is not re-tested here.)
