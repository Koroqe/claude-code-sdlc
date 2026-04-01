# Command: Implement Slice

Implement only the next smallest slice from the plan using TDD.

## Pre-flight Checks

1. Confirm you are NOT on `main` — must be on a feature branch (`feat/*` or `fix/*`)
2. Confirm `git status` is clean (or explain why not)
3. Confirm these documentation files exist:
   - `docs/qa/<feature>_test_cases.md` — if not, delegate to `qa-planner` first
   - `docs/use-cases/<feature>_use_cases.md` — if not, delegate to `ba-analyst` first

## TDD Implementation Flow

### 1. Identify the Slice
- Restate the next slice in 1 sentence
- List the use-case scenarios this slice covers (UC-X.Y, UC-X-A, etc.)
- Read existing files that will be modified

### 2. Write Tests First
Delegate to `test-writer` agent:
- Reference documented test cases from `docs/qa/`
- Reference use-case scenarios from `docs/use-cases/` for this slice
- Write tests for this slice's behavior using the project's test framework
- Tests should FAIL initially (no implementation yet)

### 3. Implement Code
- Before editing each file: re-read it from disk (do NOT rely on earlier in-context reads — context compaction may have made them stale)
- Make minimal changes to pass the tests
- Follow the project structure as defined in CLAUDE.md
- Keep route handlers thin, business logic in services/data layer
- If this slice edits 4+ files: run the project's typecheck command after every 3 file edits before continuing (per error-recovery rules)

### 4. Verify
Delegate to `build-runner` agent:
- Run the project's typecheck, test, and build commands (from CLAUDE.md)

### 5. Commit
- `git add` specific changed files (not `git add -A`)
- `git commit -m "<type>(<scope>): <slice summary>"`
- Types: `feat`, `fix`, `test`, `chore`
- Scopes: `api | ui | db | auth | core | infra`

### 6. Update Scratchpad
Update `.claude/scratchpad.md` with:
- What changed
- Commit hash + message
- Use cases covered by this slice
- What's next (next slice)

## Rules

- Minimal diff — change only what's necessary for this slice
- 1 slice = 1 commit (atomic)
- No refactors unless required for this slice
- NEVER add "Co-Authored-By" or AI attribution to commits

## Output Format

```
## Slice: [description]

### Use Cases Covered
- UC-X.Y: [scenario name]
- UC-X-A: [alternative flow name]

### Tests Written
- [test file]: [number] test cases

### Implementation
- [files changed with brief description]

### Verification
- Typecheck: PASS/FAIL
- Tests: PASS/FAIL (X passed)
- Build: PASS/FAIL

### Git
- Branch: [branch name]
- Commit: [hash] — [message]

### Next Slice
- [description of next slice]
```

## Auto-Continue

After committing this slice, if there are remaining slices in the plan:
- Immediately proceed to the next slice
- Do NOT wait for user input
- Read `.claude/scratchpad.md` to identify the next slice
- Continue the TDD flow for the next slice
