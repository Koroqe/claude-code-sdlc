# Seeded fixture: bad-merge-b

Falsify control for `scripts/ci/validate-instinct-store.js`'s **class (b)** merge-artifact
detection. `## Instincts Log` carries TWO `### duplicate-capture` entries — the artifact a
`merge=union` merge leaves when both branches captured the same instinct (same slug, different
`(features: ...)` list). Before detection existed, `entriesOf` emitted them as two independent,
individually valid entries and nothing reported the split: occurrence counts stay fragmented
across the twins, so the pattern never elevates and never retires.

Each twin is individually valid (confidence at its formula ceiling, correct `Retires at` offset,
below the general elevation threshold), so the duplicated slug is this fixture's only defect.

## Expected result

`node scripts/ci/validate-instinct-store.js --root tests/fixtures/ci/instinct-store/bad-merge-b --min 1`
MUST fail with **exactly one** problem, naming the class (b) merge artifact.
