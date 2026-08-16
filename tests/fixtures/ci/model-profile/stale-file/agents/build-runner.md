---
name: build-runner
description: Fixture mirror of agents/build-runner.md for scripts/ci/validate-model-profile.js's seeded-fixture tests (PRD Section 10, FR-10.4). Never installed, never shipped.
tools: ["Read"]
model: sonnet
effort: low
---

# Fixture Agent — build-runner

Seeded defect: still at its `quality` value (`sonnet`) after the `.sdlc-model-profile` receipt claims `budget` (which expects `haiku`).

This file exists only so scripts/ci/validate-model-profile.js's fixture tests
have something real to check. tests/fixtures/ is excluded from every
shipped-asset scan.
