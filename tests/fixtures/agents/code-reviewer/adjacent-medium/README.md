# Fixture: adjacent-medium

Control for TC-7.4 (UC-7-A3) — diff-scoping (FR-6.5). The diff's own changed hunk is clean; a
pre-existing MEDIUM-tier issue sits in an adjacent, untouched function in the same file and MUST NOT
be reported.

## Setup

`after.js` has three functions. `diff.patch` only touches `formatOrderSummary` (adds a new,
correctly-implemented `currency` parameter — no issues in the changed hunk itself). The function
immediately above it, `formatLegacyReceipt`, is untouched by the diff and has a pre-existing
MEDIUM-tier issue: it silently truncates `total` to two decimal places using string slicing instead
of proper rounding (`String(total).slice(0, total_str.indexOf('.') + 3)`), which can misformat values
like `9.995` — a real but non-critical formatting bug that predates this diff.

## Expected result

Invoke `code-reviewer` against `diff.patch` (with `after.js` as the full file for context). The
Issues list MUST NOT contain any entry for `formatLegacyReceipt`'s truncation bug — it is outside
the diff's changed hunks and is not CRITICAL severity, so FR-6.5's skip applies.
