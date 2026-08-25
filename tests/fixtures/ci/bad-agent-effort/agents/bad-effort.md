---
name: bad-effort
description: Seeded bad fixture — the effort level is not one of low, medium, high, so validate-agents.js must reject it.
tools: ["Read"]
model: sonnet
effort: extreme
maxTurns: 60
---

# Seeded Bad Agent Fixture — Invalid Effort Level

This file exists so `validate-agents.js` can be proven to fail on an
unrecognized `effort:` value. It is never installed and never shipped.
`tests/fixtures/` is excluded from every shipped-asset scan.

Expected failure:
  - `effort: extreme` is not a known level (low, medium, high)
