---
description: Seeded bad fixture — an entry-point skill that is missing the FR-8 memory-layer preflight entirely.
argument-hint: "<feature description>"
arguments: [feature]
allowed-tools: Read, Glob, Grep
---

# Seeded Bad Entry-Point Skill Fixture

This file exists so `validate-skills.js` can be proven to catch an entry-point
skill whose FR-8 preflight has been dropped. It is never installed and never
shipped.

Expected failure: no memory-layer preflight, no `bash install.sh` remedy, and
no warn-and-continue statement.
