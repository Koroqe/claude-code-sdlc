## Feature: Role Planner — Iteration 2: Cross-Feature Reuse + Automatic Teardown
## Branch: feat/role-planner-reuse-teardown
## Status: quality-gates

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: `src/agents/role-planner.md` — Authority Boundary 17-agent count + release-engineer + in-place mutation authorization — 9f60c07
- [x] Slice 3: `src/commands/bootstrap-feature.md` — Step 3.75 iter-2 reuse extension — 1873702
- [x] Slice 4: `src/commands/merge-ready.md` — Step 11 On-Demand Role Teardown after Gate 9 — 918e9de
- [x] Slice 5: `src/claude.md` — role-planner Responsibility text + Plan Critic recognition for `## Reuse Decisions` — a050f16
- [x] Slice 6: `README.md` — iter-2 cross-feature reuse + teardown narrative — 3eb84fb

### Wave 2 [COMPLETE]
- [x] Slice 2: `src/agents/role-planner.md` — Reuse mode capability section (3-stage + atomic mutation + 8-status enum + legacy migration + headless + collision handling) — 8f83921

## [STRUCTURAL] decisions (architect's 4)

1. 8-status enum: `stage-1-exact-slug-match`, `stage-2-purpose-match-approved`, `stage-2-purpose-match-declined`, `stage-3-no-match-created`, `headless-default-create`, `legacy-migrated`, `malformed-yaml-skipped`, `migration-failed-malformed-yaml`. Precedence: `legacy-migrated` supersedes `stage-2-purpose-match-approved`.
2. ALL-occurrence removal of `features:` array entries (NOT first-occurrence) — required for NFR-2 idempotency.
3. Refuse teardown from any non-feature branch (not just `main`) — symmetric with bootstrap FR-1.4.
4. Atomic delete-only when `features:` array empties — orchestrator MUST `rm` directly, NO intermediate empty-array Write.

## Plan Critic findings
- 2 CRITICAL — fixed (regex `\\.` escaping; tools-pattern bracket escaping + count)
- 4 MAJOR — fixed (Slice 1 missing line 63/292; Slice 4 tautological "10 gates"; release-engineer line-vs-match count)
- 5 MINOR — documented

## Process notes
- 17 agents stay (no banner change in install.sh, templates/CLAUDE.md untouched)
- 10 gates stay (Step 11 is a STEP not a gate)
- Wave 1: 5 atomic commits on 5 disjoint files
- Wave 2: 1 commit (Slice 2 appended to role-planner.md)
- Slice 4 used "seventeen" (spelled out) instead of "17 core agent slugs" to preserve byte-equivalence with HEAD (HEAD merge-ready.md doesn't contain "17 core")

## Completed
- All 6 slices committed (6 atomic commits + bootstrap commit)
- Implementation complete; ready for merge-ready

## Blockers
(none)
