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
