# Fixture: disallowed-charset-rule-excluded

Control for TC-FR6.2a-2 (`docs/qa/self-improvement-loop_test_cases.md`) — FR-6.2a's attach-time
validation (D1) excludes a `Rule:` text containing a disallowed character (here, backticks), never
attaching it raw with the disallowed characters intact.

## Setup

`.claude/instincts.md` carries one `## Prevention Rules` entry whose `Rule:` field reads
`` ALWAYS validate `user.role` before granting access. `` — backtick-wrapped, otherwise well under
the 200-character cap. Its `Pattern:` matches `feature-request.md`'s intended Slice 1.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. No
`Prevention:` field cites this entry anywhere in the returned plan. The exclusion is noted in
`planner`'s returned summary (naming the entry's heading slug,
`missing-role-check-before-grant`), never attached raw with the backticks intact.
