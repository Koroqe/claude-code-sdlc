# Seeded fixture: bad-cross-doc-mismatch

Falsify control for `scripts/ci/validate-fixture-manifest.js`'s per-`(qaDoc, id)`-pair bijection (FR-9.3,
FR-9.8(b), QA TC-21.2) — a manifest entry whose `id` is a real, documented FIXTURE case, but whose
`qaDoc` names a different, real, but WRONG document for that id.

## Contents

- `docs/qa/verification-review-upgrade_test_cases.md` — a minimal mirror documenting `TC-1.1` as
  `Kind: FIXTURE`.
- `docs/qa/adaptive-tier-routing_test_cases.md` — a second minimal, real, discovered document with no
  `FIXTURE`-kind rows of its own; its only role is to be the real-but-wrong document the bad entry
  points at.
- `agents/verifier.md` — present so the "agent exists" assertion passes cleanly.
- `tests/fixtures/manifest.json` — one entry: `id: "TC-1.1"`, `qaDoc:
  "docs/qa/adaptive-tier-routing_test_cases.md"` — wrong; `TC-1.1` actually belongs to
  `verification-review-upgrade_test_cases.md`.

## Expected result

`node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-cross-doc-mismatch --min 1`
MUST fail. An `id`-only bijection would wrongly treat this entry as satisfying
`verification-review-upgrade_test_cases.md`'s own `TC-1.1` requirement; scoped by the `(qaDoc, id)`
pair instead, that document correctly reports `TC-1.1` as having no manifest entry ("... have no
manifest entry: TC-1.1"), and `adaptive-tier-routing_test_cases.md` correctly reports the entry as
stale (referencing an id it never documented as `FIXTURE`) — QA TC-21.2's exact scenario.
