# Fixture: empty-prevention-section

Control for TC-13.2 (`docs/qa/self-improvement-loop_test_cases.md`) — an entirely empty
`## Prevention Rules` section (present, zero entries — distinct from `no-store-present/`'s
altogether-absent-file case) reaches the identical outcome as a fully populated but non-matching
store.

## Setup

`.claude/instincts.md`'s `## Prevention Rules` section is present but contains zero entries; one
un-elevated `## Instincts Log` entry exists (never read by `planner`'s Prevention-Rule matching —
only `## Prevention Rules` is, per FR-6.1) to prove the emptiness is specific to the Prevention
Rules section, not the whole file being empty.

## Expected result

Invoke `planner` under `/bootstrap-feature` Step 5's delegation shape against this input. The
returned plan is shape-identical to one produced before this feature existed at all — zero
`Prevention:` fields anywhere, matching `no-matching-pattern/`'s and
`marketing-newsletter-no-match/`'s outcome despite a structurally different input (empty section
vs. populated-but-non-overlapping).
