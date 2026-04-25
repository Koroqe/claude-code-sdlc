## Feature: Changelog Release Packaging (Iteration 2 of #3)
## Branch: feat/changelog-release-packaging
## Status: implementing wave 1

## Plan

### Wave 1
- [ ] Slice 1: `src/agents/release-engineer.md` [new] frontmatter+structure
- [ ] Slice 3: `install.sh` 16→17 banners
- [ ] Slice 4: `src/commands/merge-ready.md` Gate 9 + line 7 + table + SKIPPED legend
- [ ] Slice 5: `src/claude.md` Agency Roles row + line 114 list (16→17 names) + Plan Critic Gate-9 awareness
- [ ] Slice 6: `README.md` 16→17 + line 194 + 9→10 + agent row + feature; `templates/CLAUDE.md` Version source: docs

### Wave 2
- [ ] Slice 2: `src/agents/release-engineer.md` algorithms+worked examples (appends to Slice 1)

## Pinned [STRUCTURAL] decisions

1. Gate 9 (NOT Gate 10) — count rises 9→10
2. Two-step body_path (id: ver run step → ${{ steps.ver.outputs.version }})
3. `breaking` negation skip — `non-breaking` and `not breaking` excluded
4. Multi-pattern CI/CD detection (P1+P2+P3)
5. packed-refs MUST (not MAY)
6. ./CLAUDE.md precedence with literal warning text
7. Gate-Count Propagation table separate from agent-count

## Plan Critic findings

- 0 CRITICAL
- 5 MAJOR — all fixed (line 194 README + line 114 src/claude.md slug-list extension + case-insensitive runtime-effect check + FR-8.8 verify clause + prose audit acknowledgement)
- 5 MINOR — 1 fixed (Slice 2 preservation check); 4 documented in Review Notes

## Process notes

- Sandbox blocks subagent commits — orchestrator commits each slice with pathspec
- Inline git identity per established pattern: `git -c user.name='Aleksandra' -c user.email='aleksandra@MacBook-Air-Aleksandra.local'`
- Slice 1+2 share `src/agents/release-engineer.md` — Wave 2 appends to Wave 1 commit

## Pre-existing SDLC bootstrap skips

This feature's bootstrap ran on main with Step 3.5/3.75/5.5 hooks but those agents not registered as subagent_type in this session. Skipped during meta-bootstrap (consistent with prior features).

## Completed

(bootstrap artifacts staged, awaiting commit)

## Blockers

(none)

## Iteration 2 stack queue

After Feature A (release-engineer) merges:
- Feature B: Resource Manager-Architect Iteration 2 (auto-install MCP/cloud after approval)
- Feature C: Role Planner Iteration 2 (cross-feature reuse + automatic teardown)
