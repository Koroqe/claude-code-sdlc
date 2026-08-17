# Fixture: overlength-rule-excluded

Control for TC-FR6.2a-1 (`docs/qa/self-improvement-loop_test_cases.md`) — FR-6.2a's attach-time
validation (D1) excludes a `Rule:` text over 200 characters silently, never truncating it into
shape.

## Setup

`.claude/instincts.md` carries one `## Prevention Rules` entry whose `Rule:` field is exactly 250
characters (verified: `wc -c` on the `Rule:` value's text alone reads 250), and is otherwise
charset-clean — isolating length as the sole reason for exclusion. Its `Pattern:` matches
`feature-request.md`'s intended Slice 1.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. The
returned plan carries no `Prevention:` field citing this entry anywhere. `planner`'s returned
summary notes the exclusion (naming the entry's heading slug,
`webhook-signature-verification-verbose`). No 200-character-truncated fragment of the rule text
appears anywhere in the returned output — the entry is dropped whole, not shortened.
