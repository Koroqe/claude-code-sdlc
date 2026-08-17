# Seeded fixture: bad-missing-fixture

Falsify control for `scripts/ci/validate-fixture-manifest.js`'s core assertion — the one this
validator exists to catch: a manifest entry whose `fixture` path has rotted (renamed, emptied, or
deleted) while the manifest still claims it exists.

## Contents

- `docs/qa/verification-review-upgrade_test_cases.md` — a minimal, structurally-identical mirror of
  the real QA document's test-case table shape (one `TC-1.1` row, `Kind` column `FIXTURE`). Not the
  real document's content — just enough for `extractFixtureIds` to find `TC-1.1` as a documented
  FIXTURE case.
- `tests/fixtures/manifest.json` — one entry for `TC-1.1`, agent `verifier`, `qaDoc` correctly naming
  the one document committed below, pointing at `tests/fixtures/agents/verifier/present-unverified/` —
  a real path in the actual repository, but deliberately **not copied into this seeded tree**, so it
  does not exist relative to this fixture's own `--root`.
- `agents/verifier.md` — present so the "agent exists" assertion passes cleanly, isolating the
  failure to the one assertion this fixture targets.

**Slice 11 note (generalized, multi-document validator):** `qaDoc` was added to the one entry above so
this root still fails for its **own** original reason under the generalized validator, not for a new
one — without it, the entry would also fail the now-required `qaDoc` field check and the
wholesale-unregistered-document check, muddying the one assertion this fixture exists to isolate. This
root deliberately discovers only one `docs/qa/*_test_cases.md` document (the real tree's floor is 10),
so it MUST be run with `--min 1`.

## Expected result

`node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-missing-fixture --min 1`
MUST fail, naming `TC-1.1` and stating that its fixture path does not exist.
