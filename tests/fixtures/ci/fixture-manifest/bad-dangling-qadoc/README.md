# Seeded fixture: bad-dangling-qadoc

Falsify control for `scripts/ci/validate-fixture-manifest.js`'s dangling-`qaDoc` assertion (FR-9.4,
FR-9.8(a), QA TC-22.1) — a manifest entry whose `qaDoc` value does not match any document actually
discovered under `docs/qa/*_test_cases.md` in this seeded root.

## Contents

- `docs/qa/verification-review-upgrade_test_cases.md` — a minimal, structurally-identical mirror of
  the real QA document's test-case table shape (one `TC-1.1` row, `Kind` column `FIXTURE`). Not the
  real document's content — just enough for `extractFixtureIds` to find `TC-1.1` as a documented
  FIXTURE case.
- `agents/verifier.md` — present so the "agent exists" assertion passes cleanly.
- `tests/fixtures/manifest.json` — two entries:
  - `TC-1.1` — correctly registered (`qaDoc` names the one real committed document above), so the
    bijection and wholesale-unregistered-document checks both pass cleanly for it, isolating the
    failure below to the one assertion this fixture targets.
  - `TC-9.9` — the deliberate defect. Its `qaDoc` names `docs/qa/nonexistent-feature_test_cases.md`, a
    path that does not exist anywhere under this seeded root's `docs/qa/`.

## Expected result

`node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-dangling-qadoc --min 1`
MUST fail, naming `TC-9.9` and the dangling `docs/qa/nonexistent-feature_test_cases.md` reference —
distinct from a missing-entry or stale-id finding (QA TC-22.1).
