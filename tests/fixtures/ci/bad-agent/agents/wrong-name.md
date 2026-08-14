---
name: not-the-filename
description: Seeded bad fixture — the frontmatter name deliberately disagrees with the filename, and the tools list contains a tool that does not exist.
tools: ["Read", "Telepathy"]
model: opus
---

# Seeded Bad Agent Fixture

This file exists so `validate-agents.js` can be proven to fail. It is never
installed and never shipped. `tests/fixtures/` is excluded from every
shipped-asset scan.

Expected failures:
  - `name: not-the-filename` does not match `wrong-name.md`
  - `Telepathy` is not a Claude Code tool
