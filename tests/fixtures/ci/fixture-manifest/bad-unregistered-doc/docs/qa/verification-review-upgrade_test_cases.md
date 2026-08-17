# Test Cases: Verification & Review Upgrade (seeded CI fixture)

> This is a minimal, structurally-identical mirror of the real QA document's test-case table shape,
> committed only so `scripts/ci/validate-fixture-manifest.js`'s falsify step has a correctly-registered
> document alongside the deliberately-unregistered one below — proving the wholesale-unregistered
> finding isolates to the one document that actually has the defect.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-1.1 | UC-1 Primary Flow, AC-1 | FIXTURE | Present + wired + unexercised feature -> PRESENT_BEHAVIOR_UNVERIFIED | Fixture `tests/fixtures/agents/verifier/present-unverified/` | Invoke `verifier` against the fixture | `verdict: PRESENT_BEHAVIOR_UNVERIFIED` |
