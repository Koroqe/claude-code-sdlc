---
description: Seeded bad fixture — this skill deliberately omits `argument-hint`, `arguments` and `allowed-tools`, the three other fields FR-2.3 requires.
---

# Seeded Bad Skill Fixture

This file exists so `validate-skills.js` can be proven to fail. It is never
installed and never shipped.

Expected failures:
  - missing `argument-hint`
  - missing `arguments`
  - missing `allowed-tools`
