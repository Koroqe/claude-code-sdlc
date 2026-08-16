# Security Rules

TODO: Define your project's security requirements:
- How must API inputs be validated?
- What ORM/query builder must be used (no raw SQL)?
- How must auth middleware be applied?
- What must never appear in client-side code?
- How must error responses be formatted?
- What webhook verification is required?
- What must never be committed to source control?

## Sensitive Paths

TODO: list additional path globs this project treats as security-sensitive, one per line. This section is read by the harness's own adaptive-tier-routing Triage (`skills/develop-feature/SKILL.md`'s Phase 0, restated in `src/claude.md`) to decide which requests are forced to the `full` documentation tier.

- <glob-pattern>

**Additive-only union — never replace, never narrow:** the harness's fixed default sensitive-path list — any path containing `auth`, `payment`, `billing`, `secret`, or `migration` as a path segment (case-insensitive); any path under `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md` — is ALWAYS active, no matter what this section does or does not declare. Whatever globs are listed here are UNIONED onto that fixed list; they are never a substitute for it. This section MUST NOT be read as replacing the fixed default, and it is structurally incapable of narrowing or suppressing it: even a trivial, narrow, or completely empty `## Sensitive Paths` section still leaves the full default protection in force for every request — there is no way for project-supplied content in this file to opt out of it.
