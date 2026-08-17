# Digest Index

Prior-feature summaries for `planner`'s bounded prior-feature context read (PRD §10 FR-12.4). One row
per `full`-tier feature whose documentation has been finalized through `/merge-ready` Gate 7
(FR-12.1/FR-12.2). Gate 7 appends a new row, or refreshes an existing row in place (keyed on section
number), each time a `full`-tier feature passes that gate — the same idempotency discipline
`src/rules/changelog.md`'s guard already establishes, applied here to section number instead of entry
name.

`quick`- and `fast`-tier changes never produce a row: `quick` reports Gate 7 `SKIPPED (tier: quick)` and
never reaches this write; `fast` never runs `/merge-ready` at all (FR-3.4/FR-12.6).

**This file is designed to be absent or empty.** A project with no `full`-tier feature merged yet has
either no `docs/digest-index.md` at all, or one with this header and zero data rows — both are valid,
expected states, not errors or an oversight. `planner`'s FR-12.4 read MUST tolerate either case (0 or 1
relevant rows when fewer than 2 exist) and proceed without inventing relevance to reach a target count.

| Section | Title | Summary (≤300 characters) | Docs |
|---|---|---|---|
| 10 | Adaptive Tier Routing and Model Routing | Adds automatic fast/quick/full triage so trivial fixes cost one response while real features still get full documentation, plus install-time model-tier profiles (quality/balanced/budget/inherit) with a CI check that catches drifted or hand-edited agent models. | [PRD §10](PRD.md#10-adaptive-tier-routing-and-model-routing) · [use cases](use-cases/adaptive-tier-routing_use_cases.md) · [QA](qa/adaptive-tier-routing_test_cases.md) |
| 11 | Self-Improvement Loop | Carries corrections and repeated failures forward across features instead of discarding them: a confidence-scored `.claude/instincts.md` store, captured at existing pipeline points, elevated or retired at merge-ready, injected at session start, and applied by `planner`. Adds a debugger agent. | [PRD §11](PRD.md#11-self-improvement-loop) · [use cases](use-cases/self-improvement-loop_use_cases.md) · [QA](qa/self-improvement-loop_test_cases.md) |
