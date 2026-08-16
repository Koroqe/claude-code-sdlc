---
name: missing-effort
description: Seeded bad fixture — the effort field is omitted entirely, so validate-agents.js must reject it as a missing required field.
tools: ["Read"]
model: sonnet
---

# Seeded Bad Agent Fixture — Missing Effort Field

This file exists so `validate-agents.js` can be proven to fail when
`effort:` is omitted entirely. It is never installed and never shipped.
`tests/fixtures/` is excluded from every shipped-asset scan.

Expected failure:
  - missing or empty required frontmatter field `effort`
