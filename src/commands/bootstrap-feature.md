# Command: Bootstrap Feature

## Agency Documentation Pipeline

Every feature follows this pipeline before any code is written. Each step is performed by a specialized agent role.

### Step 1: Product Manager — PRD Documentation
Delegate to `prd-writer` agent:
- Read `docs/PRD.md` to understand the existing format
- Add a new section documenting the feature's requirements
- Include: feature description, user story, functional/non-functional requirements, acceptance criteria, affected endpoints, schema changes, UI changes

### Step 2: Business Analyst — Use Cases
Delegate to `ba-analyst` agent:
- Read `docs/PRD.md` for the feature requirements just documented
- Create `docs/use-cases/<feature-slug>_use_cases.md`
- Document ALL scenarios: primary flows, alternative flows, error flows, edge cases
- Include actors, preconditions, postconditions, data requirements
- This document becomes the blueprint for E2E testing

### Step 3: Software Architect — Architecture Review
Delegate to `architect` agent:
- Read PRD and use-case documents
- Validate the approach against project structure defined in CLAUDE.md
- Check module boundaries
- Review any schema changes for data integrity
- Verify API design follows REST conventions
- Flag components needing security pre-review during implementation

#### If Architecture Review FAILS:
1. Read the architect's specific objections
2. Revise the approach to address each violation
3. Re-submit to `architect` for review
4. Retry up to 2 times
5. If still rejected: document the architectural concern in scratchpad as a blocker and ask the user

### Step 3.5: Resource Manager-Architect recommendation

Delegate to `resource-architect` agent. This step is **MANDATORY and non-skippable** — it runs on every feature regardless of whether external resources are needed. A feature that requires no external resources produces an explicit `No external resources required` body with all six category headings each showing `(none)`; it MUST NOT be skipped.

The agent reads the following four inputs (in this fixed order):
1. The PRD section just written at Step 2 in `docs/PRD.md`
2. The use-cases file `docs/use-cases/<feature-slug>_use_cases.md` produced at Step 2
3. The architect's PASS verdict text from Step 3 — the orchestrator captures this text and inlines it into the `resource-architect` spawn prompt as context
4. The project `CLAUDE.md`

The agent does **NOT** read `.claude/scratchpad.md`.

**Expected output:** exactly one file at `.claude/resources-pending.md` in the project CWD, formatted as a top-level `## Recommended Resources` section with a summary line and six `### <Category>` subheadings (MCP, Cloud/Compute, External API, Third-party Service, Library/Framework, Hardware) in that fixed order. Empty categories render `(none)` on their own line.

**On failure:** `/bootstrap-feature` MUST report the failure and MUST NOT proceed to Step 4. Bootstrap halts at Step 3.5 and is reported as blocked to the user. The subsequent steps (Step 4 QA Lead, Step 5 Tech Lead) are not executed until the resource-architect failure is resolved.

**Hand-off to Step 5 (Tech Lead — Implementation Planning):** the planner agent reads `.claude/resources-pending.md`, inlines its content verbatim as the first top-level `## Recommended Resources` section of `.claude/plan.md` (placed immediately before `## Prerequisites verified`), and then **MUST delete** `.claude/resources-pending.md`. The temp file is ephemeral per-bootstrap.

### Step 4: QA Lead — Test Case Documentation
Delegate to `qa-planner` agent:
- Read `docs/PRD.md` AND `docs/use-cases/<feature-slug>_use_cases.md`
- Create `docs/qa/<feature-slug>_test_cases.md`
- Map every use-case scenario to test cases (UC-1 → TC-1.1, UC-1-E1 → TC-1.2, etc.)
- Cover: happy path, alternative flows, errors, edge cases, auth boundaries, concurrency

### Step 5: Tech Lead — Implementation Planning
Delegate to `planner` agent:
- Read ALL documentation created above: PRD, use cases, architecture review, test cases
- Read the project's CLAUDE.md for file structure and conventions
- Break the feature into 5-9 testable implementation slices
- Each slice references which use-case scenarios it implements (UC-X.Y)
- Flag slices needing architect or security pre-review
- Reference actual project files discovered during exploration

### Step 5.5: Release Scribe — Initial Changelog Stub
Delegate to `changelog-writer` agent with no arguments beyond the project CWD context (per FR-4.6). This is the first lifecycle hook — it produces an initial `[Unreleased]` stub (or, more commonly, returns `no-op: already in sync` / `no-op: no eligible entries` when the branch has no prior eligible commits). A `no-op: not configured` response is expected when running inside the SDLC repo itself and is treated as success. This hook is non-blocking per FR-4.5: if the agent fails, log the error and continue to Step 6.

### Step 6: Git Setup
- Verify `git status` is clean
- Create feature branch: `feat/<feature-slug>`

### Step 7: Initialize Scratchpad
Update `.claude/scratchpad.md` with the full feature context:
- Feature name and branch
- Status: "implementing wave 1 slice 1/N" (when plan has `Wave:` fields) or "implementing slice 1/N" (when no wave assignments)
- Full plan with slices grouped by wave: each wave as a `### Wave N` subheading with its slices listed as "pending". When plan has no `Wave:` fields, list slices as a flat numbered list under `### Wave 1 (sequential)`
- Empty blockers section

This is CRITICAL for surviving context compaction during long sessions.

## Output Format

```
## PRD
- Section added/updated in docs/PRD.md: [section number and title]

## Use Cases
- Created: docs/use-cases/<feature>_use_cases.md
- Primary flows: [count]
- Alternative flows: [count]
- Error flows: [count]
- Edge cases: [count]

## Architecture Review
- Verdict: PASS/FAIL
- Action items: [list if any]
- Slices flagged for security review: [list if any]

## QA Test Cases
- Created: docs/qa/<feature>_test_cases.md
- Total test cases: [count]
- Use-case coverage: [all UC-X mapped / gaps]

## Plan (5-9 slices across N waves)
### Wave 1
1. [slice description] — covers UC-X.Y
2. [slice description] — covers UC-X.Z

### Wave 2
3. [slice description] — covers UC-X.W
...

## Acceptance Criteria
- [verifiable condition]
- ...

## Files to Modify
- [file paths]

## Git
- Branch: feat/<feature-slug>
- Base: main
```

## Constraints

- NEVER skip the PRD step — every feature gets documented first
- NEVER skip the Use Cases step — all scenarios must be documented
- NEVER skip the QA step — test cases are documented before code
- Steps MUST run in order: PRD → Use Cases → Architecture → QA → Plan
- Follow existing patterns in the codebase
- Read the project's CLAUDE.md for tech stack and architecture
