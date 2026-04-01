# Command: Context Refresh

Rebuild context from scratchpad to maintain clarity during long sessions.

## Process

### 1. Read Scratchpad
Read `.claude/scratchpad.md` and extract:
- Feature name and branch (`## Feature:`, `## Branch:`)
- Current status (`## Status:` — idle/bootstrapping/implementing/quality-gates/complete/blocked)
- Plan progress (which slices are DONE vs IN PROGRESS vs pending)
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
- Move completed slices from `## Plan` to `## Archive` (section at the bottom)
- Keep only the current and next 2 slices in `## Plan`
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
- Progress: [what's done]
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
