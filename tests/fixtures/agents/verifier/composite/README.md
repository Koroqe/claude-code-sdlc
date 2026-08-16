# Fixture: composite

TC-13.1 covers two matrix rows that no other fixture in this corpus exercises. Each lives in its own
subdirectory; invoke `verifier` against them separately.

## `ambiguous/` — Matrix Row 9: `UNCERTAIN` via genuine ambiguity

Levels 1–3 are clean. The Level 4 trace hits one link whose realness cannot be settled by reading
source at all: the service layer calls a function from a third-party SDK package that is a
production dependency but whose implementation is not part of this codebase (no vendored source, no
`node_modules` checked in) — `verifier` is static-analysis-only and has nothing further it could read
to determine whether that call returns real, non-hardcoded data or an internal stub. This is
different from "a broken/incomplete chain" (which is a Level 4 WARN, contributing to
`PRESENT_BEHAVIOR_UNVERIFIED`): here the chain *might* be fully real, but there is no way to tell
statically, which is exactly what "genuinely ambiguous under static analysis" means.

Expected verdict: `UNCERTAIN`, `passed: false`, `human_verification_required` non-empty describing
the ambiguity (which external call cannot be characterized from source).

## `verified-with-warnings/` — Matrix Row 11: `VERIFIED` despite recorded WARNING findings

Reuses `../markers/`'s TC-4.17 shape (three WARNING-tier Level 2 markers — `TODO`, `HACK`,
`PLACEHOLDER` — no BLOCKER anywhere) inside `../exercised/`'s shape (a fully wired route → service →
data chain with a real test calling it and asserting on the output). Both hold in one project at
once, proving WARNING-tier findings are recorded but never elevate the verdict (FR-4.5).

Expected verdict: `VERIFIED`, `passed: true`. `gaps` still contains the 3 WARNING-tier `level: 2`
entries (recorded, not dropped, because PASS at Level 2 does not mean the findings disappear from the
machine-readable report) — but `human_verification_required` is `[]`, because `passed: true` requires
that per FR-3.2/FR-3.1, and none of the WARNING findings themselves demand human verification.

## Do not "fix" either sub-fixture

- `ambiguous/`: do not vendor the SDK's source into this fixture and do not replace the SDK call with
  a directly-traceable local function — either change resolves the ambiguity and destroys the only
  control for Row 9.
- `verified-with-warnings/`: do not remove the WARNING-tier markers (that collapses it into a plain
  `exercised/` duplicate) and do not add a BLOCKER-tier marker (that changes the verdict to `FAILED`
  and destroys the control for Row 11).
