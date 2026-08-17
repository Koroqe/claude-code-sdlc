# Seeded fixture: bad-unregistered-doc

Falsify control for `scripts/ci/validate-fixture-manifest.js`'s wholesale-unregistered-document check
(FR-9.5, FR-9.8(c), QA TC-21.1/TC-21.3) — the specific defect this generalization exists to close:
`docs/qa/adaptive-tier-routing_test_cases.md` has FIXTURE cases but, at HEAD, zero manifest entries
whose `qaDoc` names it at all (`grep -c adaptive tests/fixtures/manifest.json` returns `0`). This
fixture reproduces that exact shape in miniature.

## Contents

- `docs/qa/verification-review-upgrade_test_cases.md` — one `FIXTURE`-kind case, `TC-1.1`, WITH a
  correctly registered manifest entry — the positive control proving the manifest is not simply empty
  or globally broken, only missing entries for the other document.
- `docs/qa/adaptive-tier-routing_test_cases.md` — one `FIXTURE`-kind case, `TC-2.3`, with **zero**
  manifest entries anywhere pointing at it.
- `agents/verifier.md` — present so the "agent exists" assertion passes cleanly.
- `tests/fixtures/manifest.json` — exactly one entry, for `TC-1.1` only.

## Expected result

`node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-unregistered-doc --min 1`
MUST fail, naming `docs/qa/adaptive-tier-routing_test_cases.md` and stating it has no manifest entry
pointing at it at all — both via the per-document bijection's "missing" finding (naming `TC-2.3`
specifically) and via the dedicated wholesale-unregistered-document finding (QA TC-21.1, TC-21.3).
