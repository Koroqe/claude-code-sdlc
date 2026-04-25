## Feature: Cognitive Self-Check Protocol — Fact/Assumption Discipline for Thinking Agents
## Branch: feat/cognitive-self-check
## Status: implementing wave 1 slice 1/6

## Plan

### Wave 1 [pending]
- [ ] Slice 1: Create `src/rules/cognitive-self-check.md` with 6 `##` headings, 4 `###` Facts subsections, 12 in-scope + 5 exempt agents, MERGE_DATE placeholder, bilingual 4-question protocol

### Wave 2 [pending] (parallel — 3 disjoint slice file-sets)
- [ ] Slice 2: Doc-writing agents — append `## Cognitive Self-Check (MANDATORY)` to prd-writer, ba-analyst, qa-planner, planner
- [ ] Slice 3: Stdout reviewer agents — same section + `Emit a \`## Facts\` block to stdout BEFORE your verdict.` line for architect, security-auditor, code-reviewer, verifier
- [ ] Slice 4: Specialized agents + refactor-cleaner — same section for resource-architect, role-planner, release-engineer, refactor-cleaner

### Wave 3 [pending] (parallel — 2 disjoint files)
- [ ] Slice 5: Plan Critic — TWO new `> -` Completeness bullets in `src/claude.md` between `**Completeness:**` and `**Slice Quality:**`, plus file-vs-stdout preamble sentence
- [ ] Slice 6: README — Hardening table row + new `## Cognitive self-check at authoring time` section

## Bootstrap artifacts produced
- PRD §9 (lines 2082–2333) — 7 numbered subsections (9.1–9.7), 7 FRs, 8 NFRs, 20 ACs, 17 risks/deps
- `docs/use-cases/cognitive-self-check_use_cases.md` — 16 primary UCs + 12 cross-cutting UC-CCs
- `docs/qa/cognitive-self-check_test_cases.md` — 110 TCs (per-UC + cross-cutting acceptance)
- Architect verdict: PASS (3 MINOR refinements inlined in Slices 1, 5; zero [STRUCTURAL] items; zero security pre-review)
- `.claude/resources-pending.md` — produced and consumed (zero recommendations); deleted
- `.claude/roles-pending.md` — produced and consumed ("No additional roles required."); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core repo opts out)

## Architect [STRUCTURAL] decisions
None. Three MINOR refinements applied inline:
1. Plan Critic new bullets use literal `> - The …` / `> - Any …` lexical shape
2. Rule file `## Backward Compatibility` includes MERGE_DATE placeholder convention
3. Slice 5 Verify check (c) defensively confirms new bullets have no `^### ` headings

## Invariants (load-bearing)
- 17 core agents — UNCHANGED (no new agents)
- 10 quality gates — UNCHANGED (no new gates)
- `install.sh` — BYTE-UNCHANGED (rule auto-distributes via existing copy logic)
- `templates/rules/` — BYTE-UNCHANGED (rule is global, not project-specific)
- `templates/CLAUDE.md` — BYTE-UNCHANGED
- 5 executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) — NOT MODIFIED
- Agency Roles table at `src/claude.md` lines 11–29 — BYTE-UNCHANGED
- README taglines `17 specialized AI agents` (line 5) and `10 quality gates` (line 35) — BYTE-UNCHANGED

## Completed
- Bootstrap pipeline (Steps 1, 2, 3, 3.5, 3.75, 4, 5, 5.5) — all artifacts produced

## Blockers
(none)
