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

### Step 3.75: Role Planner recommendation

Delegate to `role-planner` agent. This step is **MANDATORY and non-skippable** — it runs on every feature regardless of whether project-specific specialized roles are needed. A feature that genuinely needs no additional roles produces an explicit `No additional roles required.` body in `.claude/roles-pending.md`; it MUST NOT be skipped.

The agent reads the following five inputs (in this fixed order):
1. The PRD section just written at Step 2 in `docs/PRD.md`
2. The use-cases file `docs/use-cases/<feature-slug>_use_cases.md` produced at Step 2
3. The architect's PASS verdict text from Step 3 — the orchestrator captures this text and inlines it into the `role-planner` spawn prompt as context (the agent does NOT read it from disk)
4. `.claude/resources-pending.md` if it exists (produced by `resource-architect` at Step 3.5) — used as context to avoid duplicating resource-level recommendations as roles
5. The project `CLAUDE.md`

The agent does **NOT** read `.claude/scratchpad.md`.

**Expected outputs:**
- Exactly one temp file at `.claude/roles-pending.md` in the project CWD, formatted as a top-level `## Additional Roles` section with a summary line, zero-or-more `#### <Role Title>` per-role blocks (each with the 5 FR-1.4 fields: Role title, Slug, Why, Pipeline step, Purpose), and a `## Role invocation plan` subsection.
- Zero-or-more on-demand prompt files at `~/.claude/agents/ondemand-<slug>.md` (one per recommended role). These persist after the bootstrap completes — they are the runtime artifacts that future `subagent_type: general-purpose` invocations source.

**On failure:** `/bootstrap-feature` MUST report the failure and **MUST NOT proceed to Step 4**. Bootstrap halts at Step 3.75 with an error and is reported as blocked to the user. The subsequent steps (Step 4 QA Lead, Step 5 Tech Lead) are not executed until the role-planner failure is resolved.

**Hand-off to Step 5 (Tech Lead — Implementation Planning):** the planner agent reads `.claude/roles-pending.md`, inlines its content verbatim as the top-level `## Additional Roles` section of `.claude/plan.md` (placed after `## Recommended Resources` if any and before `## Prerequisites verified`), and then **MUST delete** `.claude/roles-pending.md`. The planner is also responsible for deleting `.claude/resources-pending.md` independently (per Step 3.5 hand-off). Both temp-file deletions are independent: the planner MUST delete each file separately, and a failure to delete one MUST NOT prevent or block the deletion of the other. Each temp file is ephemeral per-bootstrap.

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

### On-Demand Role Invocation

This subsection documents how on-demand roles authored by `role-planner` at Step 3.75 are invoked at runtime. The on-demand prompt files written to `~/.claude/agents/ondemand-<slug>.md` are NOT registered as native subagent types — Claude Code registers subagent types at session start, and dynamically-created prompt files cannot be invoked as direct `subagent_type: ondemand-<slug>` values mid-session. Instead, every on-demand role is invoked through the canonical `subagent_type: general-purpose` pathway by reading the prompt file at invocation time and passing its body verbatim to a general-purpose Agent tool call.

#### Frontmatter-extraction algorithm

This is the canonical algorithm for sourcing an `~/.claude/agents/ondemand-<slug>.md` prompt body at runtime. It is documented here so the on-demand prompt files you author follow a parseable contract, and so the `bootstrap-feature` command can describe the runtime invocation pattern using identical text.

1. Read the file with the Read tool.
2. If the first non-blank line is not the literal `---`, surface a malformed-frontmatter error and abort.
3. Locate the second `---` line; the prompt body is everything after it.
4. Pass the prompt body verbatim as the `prompt` parameter of an Agent tool call with `subagent_type: general-purpose`.

The four steps above are byte-pinned per architecture review `[STRUCTURAL]` decision 1. The text is byte-identical to the same algorithm documented in `src/agents/role-planner.md`. Do not paraphrase, reorder, or extend the steps — drift between the two files is a Plan Critic finding.

#### Closed-vocabulary step labels

The `Pipeline step` field of every per-role block in `.claude/roles-pending.md` MUST use exactly one of the 5 closed-vocabulary labels enumerated VERBATIM below. These are the only valid values; any other label is invalid and the role MUST be dropped or relabeled by the `role-planner` before emission:

- `Step 3.75: role-planner` — for roles invoked at the role-planner step itself (rare; mostly for meta-roles)
- `Step 4: qa-planner` — for roles that augment the QA Lead's test-case authorship
- `Step 5: planner` — for roles that contribute to the implementation plan
- `Step 6: implementation` — for roles invoked during slice implementation (the most common case)
- `Step 7: merge-ready` — for roles invoked during the merge-ready quality gate

#### Failure-mode matrix

The `general-purpose` invocation pathway has three documented failure modes that the orchestrator MUST handle when invoking an on-demand role. Each row pins the surface behavior so failures are visible and not silently swallowed:

| # | Failure mode | Required behavior |
|---|--------------|-------------------|
| 1 | Missing on-demand prompt file at the expected path `~/.claude/agents/ondemand-<slug>.md` (e.g., the file was never written, or was deleted by a human between bootstrap and invocation) | Surface a clear error citing the missing absolute path. Abort that single invocation. Do NOT silently fall through to a default prompt or an unrelated subagent. The pipeline continues with the next role/step; only the failed invocation is aborted. |
| 2 | Malformed frontmatter — the prompt file does not begin with `---` on its first non-blank line, OR there is no closing `---` line, OR the body after the closing fence is empty | Surface a malformed-frontmatter error citing the file path. Do NOT silently spawn a `general-purpose` subagent with a corrupted prompt or a prompt-with-frontmatter-bleed. The frontmatter-extraction algorithm step (2) explicitly aborts on this condition. |
| 3 | The `tools` frontmatter field of the on-demand prompt file is unenforced at runtime — `general-purpose` subagent invocations receive a default tool surface and the `tools` list in the prompt's frontmatter is NOT runtime-enforced. This is a known iteration-1 limitation. | The on-demand prompt body MUST self-restrict by enumerating prohibited actions in the role's `## Authority boundary` section. The orchestrator MUST NOT assume that `tools: ["Read"]` actually limits the subagent to Read; it does not. Defense-in-depth lives entirely in the prompt body until iteration 2 introduces stronger enforcement. |

These three rows are the only failure modes documented for iteration 1. Additional failure modes (e.g., session-time registration failures, cross-project prompt-file collisions) are deferred per the role-planner agent's `## No iteration 2 scope` enumeration.

## Constraints

- NEVER skip the PRD step — every feature gets documented first
- NEVER skip the Use Cases step — all scenarios must be documented
- NEVER skip the QA step — test cases are documented before code
- Steps MUST run in order: PRD → Use Cases → Architecture → QA → Plan
- Follow existing patterns in the codebase
- Read the project's CLAUDE.md for tech stack and architecture
