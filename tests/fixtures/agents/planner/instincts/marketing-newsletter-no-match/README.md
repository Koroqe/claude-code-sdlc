# Fixture: marketing-newsletter-no-match

Control for TC-13.1 (`docs/qa/self-improvement-loop_test_cases.md`) — Prevention Rules exist in the
store, but none apply to this particular feature; the `Prevention:` field must be omitted entirely
from every slice, never emitted empty, and no confirming `Edit` should occur since nothing was
attached.

## Setup

`.claude/instincts.md` carries two `## Prevention Rules` entries, `Pattern: src/middleware/auth.ts`
and `Pattern: db/migrations/`. `feature-request.md`'s `marketing-newsletter-signup` feature touches
only `src/routes/newsletter.ts` and `src/services/mailingList.ts` — neither pattern.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. Zero
`Prevention:` lines appear anywhere in the plan — never `Prevention: (none)`. Since nothing was
attached, `.claude/instincts.md` is unmodified afterward: no `Last confirmed at` changes.
