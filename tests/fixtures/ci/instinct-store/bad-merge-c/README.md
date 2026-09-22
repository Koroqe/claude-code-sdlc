# Seeded fixture: bad-merge-c

Falsify control for `scripts/ci/validate-instinct-store.js`'s **class (c)** merge-artifact
detection. The single entry's `Last confirmed at: 14` sits BEYOND the `Feature counter: 12` — the
artifact class (a)'s max-repair leaves behind: the kept counter deliberately undercounts by one per
concurrent feature, so an entry stamped on a discarded branch can sit above it, and every later
decay and retirement computation then reasons from a Finalization that never happened.

`Retires at: 24` keeps the correct `+ 10` offset from the stamp, so the offset check does not also
fire — the beyond-counter stamp is this fixture's only defect.

## Expected result

`node scripts/ci/validate-instinct-store.js --root tests/fixtures/ci/instinct-store/bad-merge-c --min 1`
MUST fail with **exactly one** problem, naming the class (c) merge artifact.
