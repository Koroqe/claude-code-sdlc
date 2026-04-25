# Project: TODO_PROJECT_NAME

TODO: One-line description of the project.

## Project Metadata

<!-- Iteration 2 (Section 6): consumed by `release-engineer` at /merge-ready Gate 9 to override the version-source priority order. -->

- **Version source:** TODO (path to your version-source file, e.g., `package.json`, `pyproject.toml`, `Cargo.toml`, or `VERSION`. Leave blank to use auto-detection per Section 6 FR-3.1: package.json -> pyproject.toml -> Cargo.toml -> VERSION -> latest git tag matching v*.*.* -> fallback 0.1.0. Both `./CLAUDE.md` and `.claude/CLAUDE.md` are checked; `./CLAUDE.md` takes precedence when both files specify the field with disagreeing values.)

<!-- Iteration 2 (Section 4) dead metadata: this field is reserved for iter-3 of resource-architect and is NOT consumed by iter-2 at runtime. Projects omitting this OPTIONAL field receive iter-2 default behavior (full 4-tier auto-install flow). Reserved for future iter-3 consumption to enable per-project resource preference overrides. -->

- **Resource preferences:** TODO (optional. Reserved for iter-3 of resource-architect. Permitted informal subset values include: `deny-Moderate`, `deny-Sensitive`, `deny-MCP-installs`. Iter-2 does NOT consume this field at runtime. This field is OPTIONAL — projects omitting it receive iter-2 default behavior.)

## Tech Stack

**Frontend:**
- TODO: List frontend technologies (e.g., React 18 + TypeScript, Vue 3, etc.)

**Backend:**
- TODO: List backend technologies (e.g., Express.js + TypeScript, Django, etc.)

**Database:**
- TODO: List database and ORM (e.g., PostgreSQL + Drizzle ORM, MongoDB + Mongoose, etc.)

## Commands

```bash
# TODO: Fill in your project's actual commands
npm run dev      # Start development server
npm run build    # Production build
npm run test     # Run tests
npm run check    # TypeScript type checking (if applicable)
```

## Project Structure

```
# TODO: Document your actual project file structure
/src/
  /routes/       # API endpoints
  /services/     # Business logic
  /models/       # Data models / schema
  /middleware/    # Auth, validation, etc.

/tests/          # Test files

/docs/
  PRD.md         # Product requirements document
  /qa/           # QA test case documentation
  /use-cases/    # Business analyst use case documents
```

## Architecture Overview

TODO: Describe key architectural patterns:
- How is data accessed? (ORM, data access layer, etc.)
- How is authentication handled?
- How are external services integrated?
- What's the request lifecycle?

## Environment Variables

```
# TODO: List required environment variables
DATABASE_URL          # Database connection string
# API_KEY             # External service keys
```

## Design Guidelines

TODO: Describe visual design conventions (if applicable):
- Theme / aesthetic
- Typography
- Component patterns

## Git Commit Rules (MANDATORY)

- NEVER add "Co-Authored-By" lines to commit messages
- NEVER mention Claude, AI, or any AI assistant in commits
- Commit messages should only contain the change description
- No AI attribution in any form

## Working Rules

- Explore code before making changes
- Prefer minimal diffs; no broad refactors unless requested
- Always commit after completing implementation — do NOT push unless explicitly requested
