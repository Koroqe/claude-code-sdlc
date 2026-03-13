# Scratchpad Rules

`.claude/scratchpad.md` is persistent memory that survives context compaction.

## MUST Read
- Read `.claude/scratchpad.md` at the START of every session or after context compaction
- Use it to restore context about current feature, branch, and progress

## MUST Write
- Update scratchpad AFTER every commit with: what changed, commit hash, what's next
- Update scratchpad when starting a new feature: feature name, branch, plan, status
- Update scratchpad when blocked: document the blocker

## Format
Use structured format with these sections:
- `## Feature:` — current feature name (or "none active")
- `## Branch:` — current git branch
- `## Status:` — idle / bootstrapping / implementing slice N/M / quality-gates / complete / blocked
- `## Plan` — numbered list of slices with DONE/IN PROGRESS/pending status
- `## Completed` — history of completed work
- `## Blockers` — any unresolved issues
