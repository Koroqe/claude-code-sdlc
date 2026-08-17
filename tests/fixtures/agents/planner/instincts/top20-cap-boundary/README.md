# Fixture: top20-cap-boundary

Control for TC-FR6.5-1 (`docs/qa/self-improvement-loop_test_cases.md`) — FR-6.5's bounded read caps
`planner`'s `## Prevention Rules` read at the **top 20 entries by `Confidence:`** (ties: `Last
confirmed at`, then file order); a matching rule ranked 21st or lower must never be attached, even
though its `Pattern:` genuinely matches a planned slice's `Files:`.

## Setup

`.claude/instincts.md` carries exactly 25 `## Prevention Rules` entries, `Confidence:` strictly
non-increasing and `Last confirmed at` strictly decreasing down the file, so the (Confidence, Last
confirmed at) ordering is unambiguous rank 1 through 25 with no reliance on the file-order
tie-break:

- Rank 20 — `unbroken-summary-report-cache-key`, `Pattern: src/reports/summary.ts`, `Confidence:
  0.45` — matches `feature-request.md`'s intended Slice 2.
- Rank 23 — `unbatched-reporting-engine-query`, `Pattern: src/lib/reporting.ts`, `Confidence:
  0.35` — matches `feature-request.md`'s intended Slice 1.
- The remaining 23 entries are filler with non-matching `Pattern:` values, present only to
  establish the rank ordering above and below the cutoff.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. Slice 2
(the one touching `src/reports/summary.ts`) DOES carry a `Prevention:` field citing the rank-20
entry. Slice 1 (the one touching `src/lib/reporting.ts`) carries NO `Prevention:` field — the
rank-23 entry's `Pattern:` genuinely matches, but it falls outside the top-20 read and must never
be attached, proving the cap is actually enforced by the read, not merely documented as an
intention.
