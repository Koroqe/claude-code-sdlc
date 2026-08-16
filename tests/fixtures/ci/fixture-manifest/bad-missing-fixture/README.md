# Seeded fixture: bad-missing-fixture

Falsify control for `scripts/ci/validate-fixture-manifest.js`'s core assertion — the one this
validator exists to catch: a manifest entry whose `fixture` path has rotted (renamed, emptied, or
deleted) while the manifest still claims it exists.

## Contents

- `docs/qa/verification-review-upgrade_test_cases.md` — a minimal, structurally-identical mirror of
  the real QA document's test-case table shape (one `TC-1.1` row, `Kind` column `FIXTURE`). Not the
  real document's content — just enough for `extractFixtureIds` to find `TC-1.1` as a documented
  FIXTURE case.
- `tests/fixtures/manifest.json` — one entry for `TC-1.1`, agent `verifier`, pointing at
  `tests/fixtures/agents/verifier/present-unverified/` — a real path in the actual repository, but
  deliberately **not copied into this seeded tree**, so it does not exist relative to this fixture's
  own `--root`.
- `agents/verifier.md` — present so the "agent exists" assertion passes cleanly, isolating the
  failure to the one assertion this fixture targets.

## Expected result

`node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-missing-fixture`
MUST fail, naming `TC-1.1` and stating that its fixture path does not exist.
