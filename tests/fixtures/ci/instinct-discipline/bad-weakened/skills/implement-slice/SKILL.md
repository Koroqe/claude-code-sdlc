---
description: Implement the next smallest slice from the current plan using TDD — tests first, then code, then verification, then an atomic commit. Reads the plan from the scratchpad.
argument-hint: "[slice number] [no-changelog]"
arguments: [slice]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: Implement Slice (seeded CI fixture — trimmed mirror, NOT the real file)

> This is a trimmed, structurally-identical mirror of `skills/implement-slice/SKILL.md`'s "Capture
> Instincts" step, committed only so `scripts/ci/validate-instinct-discipline.js`'s falsify step has a
> tree to run against. This file carries the C3/FR-1.5a dedup clause UNCHANGED — the deliberate defect
> in this fixture lives only in `agents/planner.md`, isolating the failure to the FR-6.2a assertion.

### 6. Capture Instincts

**Entry schema — the full 8 fields (FR-1.4), minted within D1's allowlist.** Every captured or updated
entry is a `### <slug>` heading (kebab-case, ≤60 characters — the mechanical dedup key) followed by:

- `Confidence:` — `min(0.9, 0.3 + 0.2 × (occurrences − 1))`, recomputed ONLY at a new-occurrence event.
- `Category:` — see the FR-1.7 rules below.
- `Pattern:` — the file path or glob the instinct concerns.
- `Rule:` — a single-line ALWAYS/NEVER/WHEN prevention heuristic, minted within D1's allowlist.
- `Trigger:` — `User Correction` or `Repeated Deviation Rule`.
- `Occurrences:` — an integer, followed by `(features: <slug1>, <slug2>, ...)`.
- `Last confirmed at:` — the `## Meta` `Feature counter` value, stamped per the dedup rule below.
- `Retires at:` — `Last confirmed at` + 10.

**C3/FR-1.5a pre-capture dedup scan — MANDATORY.** Before minting any new `### <slug>` heading, scan
**both** `## Prevention Rules` and `## Instincts Log` for an existing entry whose `Pattern:` **and**
`Category:` both match the pattern about to be captured (case-insensitive). A match is a **recapture of
that existing heading — never a new one**: update the matched entry in place instead of minting a new
slug.
- A recapture within the **same feature** does **NOT** increment `Occurrences:` a second time.
- **This scan is not optional.** Skipping it lets a model-minted slug fragment the same pattern across
  near-duplicate headings — occurrence counts never converge, nothing reaches the elevation threshold,
  nothing ever retires.
