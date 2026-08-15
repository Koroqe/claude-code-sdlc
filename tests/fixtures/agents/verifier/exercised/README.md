# Fixture: exercised

This is the `present-unverified/` fixture's exact shape — same plan, same route → service → data
chain, same registered app — **plus one real test file** that calls the route handler directly with
non-trivial input and asserts on its output. That single addition is the difference between
`PRESENT_BEHAVIOR_UNVERIFIED` and `VERIFIED`: criterion (a) of "what exercised means" is now
satisfied (an existing automated test calls the new code path and asserts on its output), so Level 4
reports PASS with an exercised path instead of a gap.

Expected verdict: `VERIFIED`, `passed: true`, `gaps: []`, `human_verification_required: []`.

## Why this is a separate fixture, not an edit to `present-unverified/`

`present-unverified/`'s own README is explicit: adding a test file there would silently convert it
into this fixture and destroy the only negative control for `PRESENT_BEHAVIOR_UNVERIFIED`. This
directory exists so both controls can be inspected side by side. Do not delete the test file below —
that reverts this fixture back into a duplicate of `present-unverified/` and destroys the only
positive control for `VERIFIED` via criterion (a).
