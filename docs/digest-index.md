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
| 12 | Stale Project-Scope Plugin Install Detection | Extends the existing `session:start:spine` version-drift check to also read `~/.claude/plugins/installed_plugins.json` and warn when this project's own project-scope install has drifted from the loaded plugin, with the exact fix command. Read-only, no new hook id, fail-open at the output level. | [PRD §12](PRD.md#12-stale-project-scope-plugin-install-detection) · [use cases](use-cases/stale-install-detection_use_cases.md) · [QA](qa/stale-install-detection_test_cases.md) |
| 13 | Post-Live-Run Reconciliation | Six coordinated fixes reconciling the harness's own code/docs with what the first live end-to-end run measured: de-obsoletes install.sh's per-project banner, ignores `.claude/debug/`, widens the read-guard matcher to accept same-session Writes, records `agent_type`/bounded `agent_id`/`session_id` on wave-records, adds an advisory (non-blocking) per-gate attribution message to `stop:gate-evidence`, and corrects four stale skill-text claims. No new hook id; version 4.6.0. | [PRD §13](PRD.md#13-post-live-run-reconciliation) · [use cases](use-cases/post-live-run-reconciliation_use_cases.md) · [QA](qa/post-live-run-reconciliation_test_cases.md) |
| 14 | Design-Engineering Capability | Adds a 16th agent, `design-reviewer`, that runs Gate 8 (UI/UX) by delegation and can see rendered UI via a trust-gated preview/Playwright evidence chain, falling back fail-visibly to code-level review; ships a project design-declaration template and an 8th skill, `design-foundation`, that generates it. No new hook id; version 4.9.0. | [PRD §14](PRD.md#14-design-engineering-capability) · [use cases](use-cases/design-capability_use_cases.md) · [QA](qa/design-capability_test_cases.md) |
