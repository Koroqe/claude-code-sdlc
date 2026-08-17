# Test Cases: Adaptive Tier Routing (seeded CI fixture)

> This is a minimal, structurally-identical mirror of the real QA document's test-case table shape. It
> documents one `FIXTURE`-kind case, `TC-2.3`, deliberately with ZERO corresponding manifest entries —
> reproducing today's actual HEAD bug (`grep -c adaptive tests/fixtures/manifest.json` returning `0`),
> in miniature, per FR-9.5 / FR-9.8(c) / QA TC-21.1 and TC-21.3.

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-2.3 | UC-2 Primary Flow, AC-3 | FIXTURE | Adaptive-tier escalation decision -> correct tier selected | Fixture `tests/fixtures/agents/planner/quick-tier/` | Invoke `planner` against the fixture | tier escalates as documented |
