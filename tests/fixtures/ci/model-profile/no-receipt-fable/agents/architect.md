---
name: architect
description: Fixture mirror of agents/architect.md for scripts/ci/validate-model-profile.js's seeded-fixture tests (PRD Section 10, FR-10.4). Never installed, never shipped.
tools: ["Read"]
model: fable
effort: high
---

# Fixture Agent — architect

Seeded defect: hand-edited to `fable` — a recognized alias under validate-agents.js's looser check, but not the `quality:architect` value (`opus`) this stricter validator requires.

This file exists only so scripts/ci/validate-model-profile.js's fixture tests
have something real to check. tests/fixtures/ is excluded from every
shipped-asset scan.
