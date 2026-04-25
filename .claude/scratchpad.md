## Feature: Role Planner (Iteration 1: On-Demand Role Expansion)
## Branch: feat/role-planner
## Status: complete — MERGE READY

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: `src/agents/role-planner.md` [new] — `d400e45`
- [x] Slice 2: `install.sh` 15→16 banners — `d09fbb1`

### Wave 2 [COMPLETE]
- [x] Slice 3: `src/commands/bootstrap-feature.md` Step 3.75 + On-Demand Invocation — `3d5edd1`
- [x] Slice 4: `src/agents/planner.md` 4a/4b/4c rewrite — `2c29712`

### Wave 3 [COMPLETE]
- [x] Slice 5: `src/claude.md` Agency Roles + Plan Critic bullet — `4dcdc87`
- [x] Slice 6: `README.md` 15→16 + on-demand section — `810fcea`

### Post-wave fixes
- [x] `092ea59` — align tools array order + Authority Boundary capitalization (Code Review MINOR fixes)

## Quality Gates

| Gate | Status | Notes |
|------|--------|-------|
| 0. Git Hygiene | PASS | 9 commits on branch, clean tree, feat/role-planner |
| 1. Documentation Completeness | PASS | PRD §5 (289 lines / 20 ACs / 11 NFRs / ~40 FRs); use cases (54 scenarios / 1353 lines); QA (136 TCs / 1753 lines) |
| 2. Code Review | PASS | 0 CRIT/MAJOR; 2 MINOR auto-fixed in `092ea59` |
| 3. Security Audit | PASS | 0 CRIT/HIGH/MEDIUM; defense-in-depth: tools allowlist + filename-prefix self-check + slug regex; iteration-1 trust model documented (NFR-11) |
| 4. Build Verification | PASS | install.sh syntax OK; 16/16 agents valid YAML frontmatter |
| 5. E2E Tests | PASS | byte-for-byte static simulation (sandbox blocked direct install.sh); 16 agents in src/agents/, 4 files in templates/rules/ unchanged |
| 6. Goal-Backward Verification | PASS | all 4 levels; frontmatter-extract byte-identical between role-planner.md and bootstrap-feature.md; 16 agent count consistent in 7+ locations |
| 7. Documentation Accuracy | PASS | 0 inconsistencies; all cross-references verified |
| 8. UI/UX | N/A | markdown-only project |

**Overall: MERGE READY**

## Summary

- 9 commits on `feat/role-planner` (1 bootstrap chore + 6 feat slices + 1 post-wave fix + 1 scratchpad chore + 1 fix)
- Files changed: 7 (1 new + 6 edits, plus bootstrap docs)
- New: `src/agents/role-planner.md` (16th core agent), `docs/use-cases/role-planner_use_cases.md`, `docs/qa/role-planner_test_cases.md`
- Agent count 15 → 16 propagated (install.sh 5× banners + README tagline + heading)
- New bootstrap step: Step 3.75 between resource-architect (3.5) and qa-planner (4); both Step 3.5 and Step 5.5 (changelog-writer) preserved
- Planner Process step 4 rewritten as 4a/4b/4c — handles BOTH `.claude/resources-pending.md` (Feature #4) and `.claude/roles-pending.md` (this feature) with independent MUST-deletes
- Authority: suggest-only, 4 tools (Read/Write/Glob/Grep), defense-in-depth via filename-prefix self-check + slug regex `/^[a-z][a-z0-9-]*[a-z0-9]$/`
- General-purpose subagent spawn pattern documented byte-identically in role-planner.md AND bootstrap-feature.md
- Plan Critic recognizes `## Additional Roles` section + flags slug-collision with core 16 names as MAJOR

## Plan Critic summary

- 1 CRITICAL (Wave 1→Wave 2 textual coupling) — addressed via [STRUCTURAL] 9 + Slice 3 diff Verify
- 17 MAJOR — 12 fixed in plan, 5 documented as accepted-risk in Review Notes
- 3 MINOR — documented; 2 additional code-review MINORs auto-fixed in `092ea59`

## Process notes

- **Sandbox blocked subagent commits** — orchestrator committed each slice with pathspec to ensure atomic 1-slice-1-commit isolation
- **Initial wave-isolation hiccup** in Wave 1: Slice 2's commit accidentally pulled Slice 1's staged role-planner.md (parallel sibling). Recovered via `git reset --soft HEAD~1` + restage with `git restore --staged` + 2 separate pathspec commits
- **Git identity**: auto-detect broken (`aleksandra@Mac.(none)`); used inline `git -c user.name=... -c user.email=...` per commit (no global config touch)

## Pre-existing SDLC bootstrap skips

This feature's bootstrap ran on main with Step 3.5 (resource-architect) and Step 5.5 (changelog-writer) in the command, but neither agent is registered as subagent_type in this session. Skipped during meta-bootstrap (same recursion as Features #1, #4 — building the tool you need to use).

## Next steps

User decides:
1. **`git checkout main && git merge --ff-only feat/role-planner`** (same pattern as Features #1, #4 transitions)
2. Iteration 2 of any of #3 (changelog GitHub Releases) / #4 (resource auto-install) / #5 (role-planner reuse + automatic teardown)
3. Push all three accumulated features to remote (`git push -u origin main`)

## Blockers

(none)
