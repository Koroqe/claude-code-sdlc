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
- `## Archive` — completed work moved here when scratchpad exceeds 100 lines

## Re-Read Before Edit (MANDATORY)

- Before editing ANY file, re-read it from disk — do NOT rely on in-memory content from earlier in the conversation
- Context compaction may have silently replaced your earlier file read with a compressed summary
- This is especially critical after long conversations (10+ messages) or when returning to a file you edited earlier in the session

## Context Budget

- Avoid dumping entire large files into context when only a section is needed — use `offset` and `limit` parameters
- Prefer targeted grep searches over reading entire files to locate specific code
- When scratchpad exceeds 100 lines: move completed work from `## Completed` and finished slices from `## Plan` to `## Archive` at the bottom, keeping only active context in the main sections
