## Feature: Execution Waves — Parallel Slice Implementation
## Branch: feat/execution-waves
## Status: implementing wave 1 slice 1/9

## Plan

### Wave 1
1. [ ] Slice 1: Planner — Wave field + Wave Assignment algorithm (`src/agents/planner.md`)
2. [ ] Slice 2: Scratchpad rules — wave-grouped format (`src/rules/scratchpad.md`)
3. [ ] Slice 3: Error recovery — Parallel Wave Execution section (`src/rules/error-recovery.md`)

### Wave 2
4. [ ] Slice 4: develop-feature — Wave-Aware Phase 2 orchestration (`src/commands/develop-feature.md`) [architect pre-review]
5. [ ] Slice 5: implement-slice — wave context + auto-continue suppression (`src/commands/implement-slice.md`)

### Wave 3
6. [ ] Slice 6: bootstrap-feature — wave-grouped scratchpad init (`src/commands/bootstrap-feature.md`)
7. [ ] Slice 7: Plan Critic — Wave Assignment Validation (`src/claude.md`)
8. [ ] Slice 8: context-refresh — wave-grouped progress (`src/commands/context-refresh.md`)

### Wave 4
9. [ ] Slice 9: README + install.sh — documentation updates

## Architecture Review Notes
- Auto-Continue must be suppressed in parallel subagent mode
- develop-feature Phase 2 is highest-risk slice — needs architect pre-review
- Git: subagents must chain `git add && git commit` as single command
- Scratchpad: orchestrator-only writes during parallel waves
- Wave computation: Plan Critic validates as safety net

## Completed

## Blockers
