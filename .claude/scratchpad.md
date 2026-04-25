## Feature: Role Planner (Iteration 1: On-Demand Role Expansion)
## Branch: feat/role-planner
## Status: implementing wave 1 slice 1/6

## Plan

### Wave 1
- [ ] Slice 1: `src/agents/role-planner.md` [new] — agent with frontmatter, Authority+Output Boundaries, MANDATORY filename-prefix self-check, MANDATORY overwrite annotation, CORE-AGENT-ENUMERATION HTML markers, frontmatter-extraction algorithm, closed-vocabulary 5 step labels, on-demand template, resource-architect boundary
- [ ] Slice 2: `install.sh` banners 15→16 in 5 locations (exact counts: 15 specialized=3, 15 AI agents=1, (15 files=1, all 14-counterparts=0)

### Wave 2
- [ ] Slice 3: `src/commands/bootstrap-feature.md` — insert Step 3.75 between Step 3.5 (resource-architect) and Step 4 (QA); preserve Step 5.5 (changelog-writer); append `### On-Demand Role Invocation` section with verbatim frontmatter-extraction algorithm + 5 closed-vocabulary step labels + 3-row failure-mode matrix
- [ ] Slice 4: `src/agents/planner.md` — rewrite Process step 4 into 4a/4b/4c (4a resources-pending → ## Recommended Resources, 4b roles-pending → ## Additional Roles AFTER 4a BEFORE Prerequisites, 4c MUST delete BOTH temp files independently)

### Wave 3
- [ ] Slice 5: `src/claude.md` — Agency Roles row between resource-architect and qa-planner; Plan Critic bullet IMMEDIATELY AFTER existing ## Recommended Resources bullet, with slug-collision MAJOR clause
- [ ] Slice 6: `README.md` — tagline 15→16, ## The 16 Agents heading, agent table row, new ## On-demand role recommendations at bootstrap section between Feature #4's section and Customization

## Pinned [STRUCTURAL] decisions

1. Frontmatter-extraction algorithm — verbatim identical in role-planner.md AND bootstrap-feature.md (Slice 3 copies from Slice 1's commit)
2. 5 closed-vocabulary step labels in BOTH agent and command file
3. Sub-steps 4a/4b/4c in planner.md
4. CORE-AGENT-ENUMERATION HTML markers in role-planner.md
5. MANDATORY overwrite annotation
6. MANDATORY filename-prefix self-check
7. Plan Critic core-slug collision = MAJOR
8. Canonical case `src/claude.md` (lowercase, APFS case-alias inode 4443075)
9. Slice 3 MUST copy frontmatter-extract algorithm verbatim from Slice 1's committed text

## Plan Critic findings

- 1 CRITICAL (Wave 1→Wave 2 textual coupling) — addressed via [STRUCTURAL] 9 + Slice 3 diff Verify
- 17 MAJOR — 12 fixed, 5 documented as accepted-risk in Review Notes
- 3 MINOR — documented

## Pre-existing SDLC bootstrap skips

This feature's bootstrap ran on main with Step 3.5 (resource-architect) and Step 5.5 (changelog-writer) in the command, but neither agent is registered as a subagent_type in this session. Skipped during this meta-bootstrap (same recursion as Features #1, #4 each bootstrapped without the agent they were building).

## Completed

(bootstrap artifacts staged but not yet committed)

## Blockers

(none)
