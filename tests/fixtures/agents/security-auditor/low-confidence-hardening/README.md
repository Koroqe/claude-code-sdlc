# Fixture: low-confidence-hardening

Control for TC-7.8 (`security-auditor` variant of TC-7.1) — a sub-80%-confidence, non-CRITICAL
hardening *suggestion* that MUST be omitted entirely, not reported as a MEDIUM/LOW finding.

## Setup

`diff.patch` adds a new internal health-check endpoint, `GET /internal/health`, mounted only on a
loopback-bound admin listener that is not reachable from outside the process's own host (per the
surrounding, unchanged bootstrap code this diff does not touch). The endpoint returns a static
`{ status: 'ok' }` body with no request-derived data and no side effects.

One could speculatively argue this endpoint "should" require auth even though nothing it exposes is
sensitive and nothing outside localhost can reach it — a defensible hardening opinion, but not a
finding grounded in an actual reachable vulnerability. A careful auditor's confidence that this is a
*real, actionable* security problem (as opposed to a nice-to-have) should land well under 80%.

## Expected result

Invoke `security-auditor` against `diff.patch`. The Vulnerabilities list MUST NOT contain any entry
for the missing auth on `/internal/health` — it is a speculative hardening suggestion, not a
CRITICAL finding, so FR-6.1's confidence filter applies and the finding is omitted entirely.
