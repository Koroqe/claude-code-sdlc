## Feature: Role Planner — Iteration 2: Cross-Feature Reuse + Automatic Teardown
## Branch: feat/role-planner-reuse-teardown
## Status: complete (MERGE READY)

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: `src/agents/role-planner.md` — Authority Boundary 17-agent count + release-engineer + in-place mutation authorization — 9f60c07
- [x] Slice 3: `src/commands/bootstrap-feature.md` — Step 3.75 iter-2 reuse extension — 1873702
- [x] Slice 4: `src/commands/merge-ready.md` — Step 11 On-Demand Role Teardown after Gate 9 — 918e9de
- [x] Slice 5: `src/claude.md` — role-planner Responsibility text + Plan Critic recognition for `## Reuse Decisions` — a050f16
- [x] Slice 6: `README.md` — iter-2 cross-feature reuse + teardown narrative — 3eb84fb

### Wave 2 [COMPLETE]
- [x] Slice 2: `src/agents/role-planner.md` — Reuse mode capability section — 8f83921

### Quality Gates [COMPLETE]
- Gate 0: PASS
- Gate 1: PASS
- Gate 2: PASS (3 MINOR fixed — 6239eca de-stales iter-1 wording)
- Gate 3: PASS (2 MINOR fixed — 3f1db5a tightens symlink defense + adds core-slug mutation guard)
- Gate 4-5: N/A (markdown only)
- Gate 6: PASS (zero findings)
- Gate 7: PASS (3 MINOR fixed — 7a854b0 aligns README phrasing with PRD)
- Gate 8: N/A (no UI)
- Gate 9: SKIPPED (no CHANGELOG.md, SDLC core repo)

## [STRUCTURAL] decisions (architect's 4)

1. 8-status enum: stage-1-exact-slug-match, stage-2-purpose-match-approved, stage-2-purpose-match-declined, stage-3-no-match-created, headless-default-create, legacy-migrated, malformed-yaml-skipped, migration-failed-malformed-yaml. Precedence: legacy-migrated supersedes stage-2-purpose-match-approved.
2. ALL-occurrence removal of `features:` array entries (NOT first-occurrence) — required for NFR-2 idempotency.
3. Refuse teardown from any non-feature branch (not just `main`) — symmetric with bootstrap FR-1.4.
4. Atomic delete-only when `features:` array empties — orchestrator MUST `rm` directly, NO intermediate empty-array Write.

## Plan Critic findings
- 2 CRITICAL — fixed (regex `\\.` escaping; tools-pattern bracket escaping + count)
- 4 MAJOR — fixed (Slice 1 missing line 63/292; Slice 4 tautological "10 gates"; release-engineer line-vs-match count)
- 5 MINOR — documented

## Process notes
- 17 agents stay (no banner change, install.sh + templates/CLAUDE.md untouched)
- 10 gates stay (Step 11 is a STEP not a gate)
- Wave 1: 5 atomic commits on 5 disjoint files
- Wave 2: 1 commit (Slice 2 appended to role-planner.md)
- 3 fix commits applied for review-gate findings

## Completed
- All 6 slices + 3 fix commits + bootstrap commit + 2 scratchpad commits
- Branch ready for merge to main

## Blockers
(none)
