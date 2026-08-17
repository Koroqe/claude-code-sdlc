# Test Cases: Verification & Review Upgrade (seeded CI fixture)

> This is a minimal, structurally-identical mirror of the real QA document's test-case table shape,
> committed only so `scripts/ci/validate-fixture-manifest.js`'s falsify step has a real, discovered
> document to cross-check `tests/fixtures/manifest.json` against. It is not the real QA document.
> `TC-1.1` is documented as `FIXTURE` here, and only here — this fixture's deliberate defect is a
> manifest entry that claims `TC-1.1` lives in the OTHER seeded document instead.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-1.1 | UC-1 Primary Flow, AC-1 | FIXTURE | Present + wired + unexercised feature -> PRESENT_BEHAVIOR_UNVERIFIED | Fixture `tests/fixtures/agents/verifier/present-unverified/` | Invoke `verifier` against the fixture | `verdict: PRESENT_BEHAVIOR_UNVERIFIED` |
