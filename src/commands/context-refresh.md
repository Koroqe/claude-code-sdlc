# Command: Context Refresh

Rebuild context from scratchpad to maintain clarity during long sessions.

## Process

### 1. Read Scratchpad
Read `.claude/scratchpad.md` and extract:
- Feature name and branch (`## Feature:`, `## Branch:`)
- Current status (`## Status:` — idle/bootstrapping/implementing wave W slice N/M/implementing slice N/M/quality-gates/complete/blocked)
- Plan progress by wave (if `### Wave N` subheadings exist): which waves are complete, which wave is current, per-slice status within the current wave. If no wave subheadings, extract flat slice progress as before
- Any blockers (`## Blockers`)
- Recent work from `## Completed` section

### 2. Verify Accuracy
Check if scratchpad matches current state:
- Are goals still accurate?
- Have new decisions been made?
- Are next steps still relevant?
- Has the git branch changed?

### 3. Update if Needed
If scratchpad is stale:
- Update current goal
- Add new constraints or decisions
- Log recent commits and changes
- Revise next steps based on progress

If scratchpad exceeds 100 lines:
- Move completed waves (all slices DONE) from `## Plan` to `## Archive` as a unit — keep the `### Wave N` block together. If no wave subheadings, move completed slices individually
- Keep only the current wave and next wave in `## Plan`
- Keep only the last 3 entries in `## Completed`
- This prevents the scratchpad itself from consuming excessive context

### 4. Summarize Context
Provide concise summary of where we are.

### 5. Recommend Action
Based on context health:
- **Clean**: Continue with current work
- **Noisy**: Suggest which details can be archived
- **Stale**: Update scratchpad with current state
- **Overwhelming**: Consider starting a fresh session with `claude -c`

## Output Format

```
Context Summary:
- Goal: [current goal]
- Branch: [current git branch]
- Progress: [what's done — e.g., "Wave 1 complete (3/3), Wave 2 in progress (1/2)" or flat "5/8 slices done"]
- Next: [top 3 items]

Status: [Clean/Noisy/Stale/Overwhelming]
Recommendation: [specific action]
```

## When to Use
- Starting a new work session
- After completing a major milestone
- When feeling lost in details
- Before planning a new feature
- When conversation is getting long
