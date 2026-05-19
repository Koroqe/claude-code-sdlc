## Feature: Self-Improvement Loop — Cross-Session Lesson Capture
## Branch: feat/self-improvement-loop
## Status: implementing wave 1 slice 1/8

## Plan

### Wave 1
- [ ] Slice 1: Core lessons rule file (`src/rules/lessons.md` [new])
- [ ] Slice 2: Lessons template + install script (`templates/lessons.md` [new], `install.sh`, `templates/settings.json`)
- [ ] Slice 3: Scratchpad rule — session-start lessons reading (`src/rules/scratchpad.md`)

### Wave 2
- [ ] Slice 4: implement-slice — prevention rule check + lesson capture (`src/commands/implement-slice.md`)
- [ ] Slice 5: merge-ready — post-gate lesson capture (`src/commands/merge-ready.md`)
- [ ] Slice 6: context-refresh + develop-feature — lessons integration (`src/commands/context-refresh.md`, `src/commands/develop-feature.md`)
- [ ] Slice 7: bootstrap-feature + planner — prevention rules in planning (`src/commands/bootstrap-feature.md`, `src/agents/planner.md`)

### Wave 3
- [ ] Slice 8: claude.md + README documentation (`src/claude.md`, `README.md`)

## Architecture Review Notes
- CONDITIONAL PASS — 4 action items incorporated into plan
- Archived Rules section added to template and rule file
- Trigger 2 tracking: scan lessons log for current feature matches
- Elevation matching: compare "correct approach" fields
- Spawn prompt: add "Do NOT write to .claude/lessons.md" rule #5
- All references include existence guards for backward compatibility

## Completed

## Blockers
