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
- `## Status:` — idle / bootstrapping / implementing wave W slice N/M / implementing slice N/M / qa-cycle iter N (PASS=p FAIL=f BLOCKED=b) / quality-gates / complete / blocked
- `## Plan` — slices grouped by wave when wave assignments exist. Each wave is a subheading (`### Wave N`) containing its slices. Wave-level status: pending (no slices started), in progress (at least one started), complete (all DONE), failed (at least one FAILED). Individual slices use DONE/IN PROGRESS/pending/FAILED status. When no wave assignments exist (legacy plans), use a flat numbered list under `### Wave 1 (sequential)`. Example:
  ```
  ### Wave 1
  - [x] Slice 1: description — commit_hash
  - [x] Slice 2: description — commit_hash

  ### Wave 2 [IN PROGRESS]
  - [x] Slice 3: description — commit_hash
  - [ ] Slice 4: description [IN PROGRESS]

  ### Wave 3
  - [ ] Slice 5: description
  ```
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
- When scratchpad exceeds 100 lines: move completed work from `## Completed` and finished waves from `## Plan` to `## Archive` at the bottom, keeping only active context in the main sections. Archive completed `### Wave N` blocks as a unit (move the entire wave with all its slices). Partial-failure waves (status `failed`) remain in `## Plan` until resolved
