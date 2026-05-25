# Git Workflow Rules

- Work on feature branches: `feat/<slug>` or `fix/<slug>` — NEVER work on main
- Conventional commits: `feat(scope): message`, `fix(scope): message`, `test(scope): message`, `chore(scope): message`
- Allowed scopes: `api | ui | db | auth | core | infra`
- NEVER add "Co-Authored-By" or any AI attribution to commit messages
- Commit messages MUST contain only the change description
- Commit after completing work — do NOT push unless explicitly asked
- Keep commits atomic: 1 slice = 1 commit
- **NEVER use `git rebase`** (interactive or otherwise). Rebase rewrites history — it drops commits, forces pushes, and strands work when a conflict aborts mid-rebase; the environment also blocks the interactive `-i` flag outright. To integrate branches use `git merge`; to undo local work use `git revert` (new commit) or `git reset` on an UNPUSHED branch only. If history genuinely needs rewriting, stop and ask the operator to do it by hand.
