## Feature: Role Planner (Iteration 1: On-Demand Role Expansion)
## Branch: feat/role-planner
## Status: quality-gates

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: `src/agents/role-planner.md` [new] — `d400e45`
- [x] Slice 2: `install.sh` 15→16 banners — `d09fbb1`

### Wave 2 [COMPLETE]
- [x] Slice 3: `src/commands/bootstrap-feature.md` Step 3.75 + On-Demand Invocation — `3d5edd1`
- [x] Slice 4: `src/agents/planner.md` 4a/4b/4c rewrite — `2c29712`

### Wave 3 [COMPLETE]
- [x] Slice 5: `src/claude.md` Agency Roles + Plan Critic bullet — `4dcdc87`
- [x] Slice 6: `README.md` 15→16 + agent row + on-demand section — `810fcea`

## Post-wave verification (orchestrator)

- 7 commits on branch (1 bootstrap + 6 slices)
- Agent count: **16** (was 15 after Feature #4)
- install.sh: 3× "16 specialized", 0× "15 specialized"
- README: 1× "16 specialized", 1× "## The 16 Agents"
- src/claude.md: 2× "role-planner" (Agency Roles + Plan Critic); 17 Agency Roles rows (header + 16 agents)
- bootstrap-feature.md: Step 3.5 + Step 3.75 (new) + Step 5.5 all coexist (1 each)
- planner.md: 2× "MUST delete", 5× "4a"/"4b"/"4c" markers
- Frontmatter-extraction algorithm byte-identical between role-planner.md and bootstrap-feature.md

## Process notes

- **Sandbox blocked subagent commits** — orchestrator commits each slice with pathspec (`-- <file>`) to ensure atomic 1-slice-1-commit.
- **Initial wave-isolation hiccup**: Slice 2's commit accidentally pulled in Slice 1's staged role-planner.md (parallel sibling). Fixed via `git reset --soft HEAD~1` + restage with `git restore --staged` + 2 separate commits with pathspec.
- **Git identity** — auto-detect broken on this machine (`aleksandra@Mac.(none)`); used inline `git -c user.name=... -c user.email=...` for every commit (subagent sandbox blocks this form, orchestrator allows it).

## Plan Critic findings

- 1 CRITICAL (Wave 1→Wave 2 textual coupling) — addressed via Slice 3 diff Verify
- 17 MAJOR — 12 fixed in plan, 5 documented as accepted-risk in Review Notes
- 3 MINOR — documented

## Pre-existing SDLC bootstrap skips

This feature's bootstrap ran on main with Step 3.5 (resource-architect) and Step 5.5 (changelog-writer) in the command, but neither agent is registered as a subagent_type in this session. Skipped during this meta-bootstrap (same recursion as Features #1, #4 each bootstrapped without the agent they were building).

## Completed

7 commits on `feat/role-planner` (`887ef19` bootstrap → `810fcea` README).

## Blockers

(none)

## Next

- `/merge-ready` quality gates: git hygiene, docs, code review, security audit, build, E2E, goal-backward verification, doc accuracy, UI/UX
