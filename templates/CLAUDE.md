# Project: TODO_PROJECT_NAME

TODO: One-line description of the project.

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

## Release

<!-- OPTIONAL. Delete this section entirely if this project publishes nothing.

     /merge-ready reads this section to decide whether to publish after a
     feature passes its gates. With no section here it is a visible no-op and
     never invents a process.

     If you DO publish, the ordering matters more than the commands. Consumers
     receive whatever your distribution channel ADVERTISES — a package version,
     an image tag, a manifest field. Bump that first, verify it landed, then
     publish. Merging is not shipping: a merge that leaves the advertised
     version unchanged reaches nobody while every check stays green.

     Name the field that actually gates delivery — it is often not the one that
     looks canonical — and how to confirm consumers can now receive it.
-->

1. Bump: <the version field consumers' tooling compares against>
2. Verify: <command proving the bump landed in every source>
3. Publish: <command>
4. Confirm: <command showing what consumers now receive>

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
