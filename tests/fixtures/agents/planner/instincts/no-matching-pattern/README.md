# Fixture: no-matching-pattern

Control for TC-12.5 (`docs/qa/self-improvement-loop_test_cases.md`) — the required negative/
false-positive case for FR-6.2: when no Prevention Rule's `Pattern:` overlaps any planned slice's
`Files:`, `Prevention:` is omitted entirely from every slice, never emitted as an empty or
placeholder field.

## Setup

`.claude/instincts.md` carries two `## Prevention Rules` entries, `Pattern: src/billing/invoice.ts`
and `Pattern: scripts/deploy.sh`. `feature-request.md`'s planned files
(`src/notifications/templates.ts`, `src/notifications/email.ts`) overlap neither.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. No slice
in the returned plan carries a `Prevention:` field — not `Prevention: (none)`, not an empty line,
simply absent (cross-reference `empty-prevention-section/` for the dedicated
zero-entries variant of this same outcome).
