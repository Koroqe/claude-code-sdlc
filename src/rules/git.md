# Git Workflow Rules

- Work on feature branches: `feat/<slug>` or `fix/<slug>` — NEVER work on main
- Conventional commits: `feat(scope): message`, `fix(scope): message`, `test(scope): message`, `chore(scope): message`
- Allowed scopes: `api | ui | db | auth | core | infra`
- NEVER add "Co-Authored-By" or any AI attribution to commit messages
- Commit messages MUST contain only the change description
- Commit after completing work — do NOT push unless explicitly asked
- Keep commits atomic: 1 slice = 1 commit
