# Error Recovery Rules

When typecheck, tests, or build fail during implementation:
1. Read the error output carefully
2. Fix the root cause in the relevant file(s)
3. Rerun the failed step
4. Retry up to 3 times
5. If still failing after 3 retries: document the blocker in `.claude/scratchpad.md` and report to user

- Do NOT stop at the first error — attempt to fix autonomously
- Do NOT just report failures — attempt to fix them first
- If a code review or security audit finds issues: fix them before proceeding

## Mid-Slice Verification

When a slice requires editing 4 or more files:
- Run the project's typecheck command after every 3 file edits before continuing
- If typecheck fails mid-slice: fix the type errors immediately before editing more files
- This prevents cascading errors that are harder to diagnose at end-of-slice verification

For slices touching 3 or fewer files: end-of-slice verification is sufficient.
