# Fixture: single-low-confidence-match

Control for TC-12.1 (`docs/qa/self-improvement-loop_test_cases.md`) — `planner`'s `Prevention:`
attachment (FR-6.2) is unfiltered by `Confidence:`, unlike session-start injection's `>= 0.7` floor
(FR-5.2). `.claude/instincts.md` carries exactly one `## Prevention Rules` entry at `Confidence: 0.5`
— well below the 0.7 floor — whose `Pattern:` matches `feature-request.md`'s intended Slice 3.

## Setup

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against
`feature-request.md`, with `.claude/instincts.md` present in the target project as committed here.

## Expected result

The returned plan's Slice 3 (the one touching `src/middleware/auth.ts`) carries:

```
Prevention: NEVER swallow a token-refresh error inside auth middleware — surface it as a failed auth, never a silent pass-through.
```

verbatim, despite `Confidence: 0.5` being well below the `0.7` session-start injection floor —
proving FR-6.1's read is genuinely unfiltered by confidence, not merely documented as such.
