# Fixture: adjacent-critical

Control for TC-7.5 (UC-7-A4) — the CRITICAL exception to diff-scoping (FR-6.6). Same shape as
`adjacent-medium/`, except the pre-existing, untouched issue one function above the diff is
CRITICAL: an unauthenticated admin endpoint. It MUST still be reported even though it sits outside
the diff's changed hunks.

## Setup

`after.js` has two route handlers. `diff.patch` only touches `getOrderSummary` (adds an input
validation check — the changed hunk itself is clean). The function immediately above it,
`deleteAllUsers`, is untouched by the diff and is a pre-existing, unauthenticated admin endpoint: it
performs a destructive bulk delete with no auth middleware and no role check at all.

## Expected result

Invoke `code-reviewer` against `diff.patch` (with `after.js` as the full file for context). The
Issues list MUST contain a **CRITICAL** entry for `deleteAllUsers`'s missing authentication, even
though that function is outside the diff's changed hunks — FR-6.6's carve-out means diff-scoping
never suppresses a CRITICAL finding, regardless of distance from the changed hunk.
