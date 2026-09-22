# Git Workflow Rules

- Work on feature branches: `feat/<slug>` or `fix/<slug>` — NEVER work on main
- Conventional commits: `feat(scope): message`, `fix(scope): message`, `test(scope): message`, `chore(scope): message`
- Allowed scopes: `api | ui | db | auth | core | infra`
- NEVER add "Co-Authored-By" or any AI attribution to commit messages
- Commit messages MUST contain only the change description
- Commit after completing work — do NOT push unless explicitly asked
- Keep commits atomic: 1 slice = 1 commit
- One Claude Code session per git worktree — parallel features live in separate worktrees, never two sessions in one checkout
- Sync a branch by merging the base IN — NEVER rebase (rebase rewrites the commit hashes that gates and plan records check)
- Sync commit shape: `chore(core): sync <branch> with <base>`
