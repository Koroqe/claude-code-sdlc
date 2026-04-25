## Feature: Role Planner — Iteration 2: Cross-Feature Reuse + Automatic Teardown
## Branch: feat/role-planner-reuse-teardown
## Status: implementing wave 1

## Plan

### Wave 1 [PENDING]
- [ ] Slice 1: `src/agents/role-planner.md` — Authority Boundary 17-agent count + release-engineer + in-place mutation authorization
- [ ] Slice 3: `src/commands/bootstrap-feature.md` — Step 3.75 reuse extension (Stage-2 prompt orchestration + headless contract)
- [ ] Slice 4: `src/commands/merge-ready.md` — Step 11 On-Demand Role Teardown after Gate 9
- [ ] Slice 5: `src/claude.md` — role-planner Responsibility text + Plan Critic recognition for `## Reuse Decisions`
- [ ] Slice 6: `README.md` — feature description extension (cross-feature reuse + automatic teardown)

### Wave 2 [PENDING]
- [ ] Slice 2: `src/agents/role-planner.md` — Reuse mode capability section (3-stage matching + atomic mutation + 8-status enum + legacy migration + headless-default-create + collision handling)

## [STRUCTURAL] decisions (architect's 4)

1. 8-status enum: `stage-1-exact-slug-match`, `stage-2-purpose-match-approved`, `stage-2-purpose-match-declined`, `stage-3-no-match-created`, `headless-default-create`, `legacy-migrated`, `malformed-yaml-skipped`, `migration-failed-malformed-yaml`. Precedence: `legacy-migrated` supersedes `stage-2-purpose-match-approved`.
2. ALL-occurrence removal of `features:` array entries (NOT first-occurrence) — required for NFR-2 idempotency.
3. Refuse teardown from any non-feature branch (not just `main`) — symmetric with bootstrap FR-1.4.
4. Atomic delete-only when `features:` array empties — orchestrator MUST `rm` directly, NO intermediate empty-array Write.

## Plan Critic findings
- 2 CRITICAL — fixed (regex `\\.` escaping; `\\[`/`\\]` plus `-eq 1` count → awk-scope frontmatter then `-eq 1`)
- 4 MAJOR — fixed (Slice 1 missing line 63/292 enumerations; Slice 4 tautological "10 gates"; Slice 1 `grep -cE` for release-engineer count; etc.)
- 5 MINOR — documented

## Process notes
- 17 agents stay (no banner change in install.sh, templates/CLAUDE.md untouched)
- 10 gates stay (Step 11 is a STEP not a gate)
- Slice 1 + Slice 2 share `src/agents/role-planner.md` → 2 waves
- Wave 1 has 5 disjoint-file slices (1, 3, 4, 5, 6)
- Wave 2 has Slice 2 (sequential after Slice 1)

## Completed
(bootstrap artifacts staged)

## Blockers
(none)
