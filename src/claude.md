## Autonomous Development Workflow (MANDATORY)

**EVERY code change — new feature, bug fix, refactor, or improvement — MUST follow this pipeline.** Do NOT write code directly. Always start with documentation, then plan, then implement with tests.

The only exceptions are trivial non-code tasks (updating a comment, fixing a typo in docs).

### Agency Roles

This workflow mirrors a professional software development team:

| Role | Agent | Responsibility |
|------|-------|----------------|
| Product Manager | `prd-writer` | Feature requirements in `docs/PRD.md` |
| Business Analyst | `ba-analyst` | Use cases in `docs/use-cases/<feature>_use_cases.md` |
| Software Architect | `architect` | Architecture review, technical design validation |
| Resource Manager-Architect | `resource-architect` | Recommend external resources (MCP, cloud, APIs, services, libraries, hardware) at bootstrap time |
| QA Lead | `qa-planner` | Test cases in `docs/qa/<feature>_test_cases.md` |
| Tech Lead | `planner` | Implementation plan (5-9 slices) |
| Security Engineer | `security-auditor` | Security review for sensitive slices |
| Developer | `test-writer` | TDD test implementation |
| QA Engineer | `e2e-runner` | E2E tests from use-case scenarios |
| Code Reviewer | `code-reviewer` | Code quality and standards |
| DevOps | `build-runner` | Typecheck, tests, build verification |
| Verification Engineer | `verifier` | Goal-backward integration verification (wiring, data flow, stub detection) |
| Tech Writer | `doc-updater` | Documentation accuracy |
| Senior Developer | `refactor-cleaner` | Post-implementation cleanup |
| Release Scribe | `changelog-writer` | Maintain the `[Unreleased]` section of downstream project `CHANGELOG.md` in sync with PRD, scratchpad, and git log |

### What Every Plan MUST Include

When planning ANY feature — whether in plan mode, responding to a request, or running a command — the plan MUST begin with these documentation phases before any code:

**Phase 1: Documentation (non-negotiable)**
1. PRD update — requirements in `docs/PRD.md` (prd-writer)
2. Use Cases — all scenarios in `docs/use-cases/<feature>_use_cases.md` (ba-analyst)
3. Architecture Review — validate approach (architect)
4. QA Test Cases — from use cases in `docs/qa/<feature>_test_cases.md` (qa-planner)

**Phase 2: Implementation Planning**
5. Tech Lead breaks feature into 5-9 TDD slices (planner)
6. Architect + Security flag slices needing pre-review

**Phase 3: Implementation**
7-N. TDD slices: tests first → implement → verify → commit

**Phase 4: Quality Gates**
N+1. Code review, security audit, build, E2E, docs verification

**A plan without documentation phases is INCOMPLETE. Do not proceed to implementation without them.**

### CRITICAL: After Plan Approval (plan mode or otherwise)

When you exit plan mode OR receive approval to proceed with a feature, you MUST:

1. **Run `/bootstrap-feature` FIRST** — this creates ALL documentation:
   - Product Manager writes PRD section (prd-writer agent)
   - Business Analyst writes use cases (ba-analyst agent)
   - Software Architect reviews architecture (architect agent)
   - QA Lead writes test cases from use cases (qa-planner agent)
   - Tech Lead creates final implementation plan (planner agent)

2. **Loop `/implement-slice`** for each slice — TDD for each:
   - Tests first → implement → verify → commit → scratchpad

3. **Run `/merge-ready`** — all quality gates

**Do NOT skip step 1. Do NOT start writing code before `/bootstrap-feature` completes.**
**Do NOT write PRD, use cases, or test cases yourself — delegate to the specialized agents.**

### Pipeline Commands
- `/develop-feature` — Full autonomous pipeline (steps 1-3 above)
- `/bootstrap-feature` — Documentation phases only (step 1)
- `/implement-slice` — Single TDD slice (step 2, one iteration)
- `/merge-ready` — Quality gates (step 3)
- `/context-refresh` — Rebuild session context from scratchpad

### What Plan Mode Plans MUST Contain

Even though plan mode is read-only and agents don't run during it, the plan file MUST scope the full pipeline:

1. **Feature scope** — what the user wants, why, acceptance criteria
2. **Deliverables checklist** (all mandatory):
   - [ ] PRD section in `docs/PRD.md`
   - [ ] Use cases in `docs/use-cases/<feature>_use_cases.md`
   - [ ] Architecture review verdict
   - [ ] QA test cases in `docs/qa/<feature>_test_cases.md`
3. **Implementation slices** — preliminary breakdown (refined by planner agent in bootstrap)
4. **Files likely affected**
5. **Risks and dependencies**

A plan missing the deliverables checklist is INCOMPLETE.

### Plan Critic Pass (MANDATORY — before ExitPlanMode)

After writing the plan file and before calling ExitPlanMode, you MUST run a critic pass. Do NOT present the plan to the user without completing this step.

#### Step 1: Spawn Plan Critic

Launch a `Plan` subagent with this prompt (substitute the actual plan file path):

> You are a Plan Critic. Your job is to find problems in this plan, NOT to praise it.
>
> Read the plan file at [plan file path]. Then read the project's CLAUDE.md (in `.claude/CLAUDE.md`) and any rules in `.claude/rules/` to understand project-specific constraints.
>
> Perform ALL of the following checks:
>
> **Completeness:**
> - Feature scope has concrete, testable acceptance criteria (not just "implement X")
> - Deliverables checklist is present: PRD, use cases, architecture review, QA test cases
> - Implementation slices are numbered with: description, files affected, testable done-condition
> - Risks and dependencies section exists and is substantive
> - The `## Recommended Resources` section (if present at the top of the plan, before `## Prerequisites verified`) is a valid top-level section produced by `resource-architect` at bootstrap Step 3.5 — do NOT flag its presence as a finding. Absence is also NOT a finding (legacy plans lack it per backward compat). Malformed recommendation entries missing any of the six fields (Category, Name, Why, Install/activate, Cost/complexity, Reversibility) MAY be raised as MINOR — not CRITICAL, not MAJOR.
>
> **Slice Quality:**
> - No slice is too large (>200 lines of production code) — flag for splitting
> - No vague done-conditions ("works correctly", "is implemented") — must be testable
> - Dependency ordering is correct (no slice requires work from a later slice)
> - Each slice adding API endpoints includes input validation requirements
> - Each slice touching the database mentions the schema change
>
> **File Path Verification (MANDATORY — use Glob and Grep):**
> - Verify every file path in "Files likely affected" exists (or is explicitly marked "new file")
> - Verify referenced functions, components, or exports exist where claimed
> - Flag any phantom paths that don't resolve
>
> **Architecture & Security (from project's CLAUDE.md and .claude/rules/):**
> - No cross-boundary imports violating module separation rules
> - Auth middleware applied where the project requires it
> - Inputs validated per the project's validation approach
> - No secrets exposed to client-side code
> - Hard constraints from project rules are respected
>
> **Edge Cases & Testability:**
> - Error handling addressed for external calls and DB operations
> - Auth boundary cases covered (unauthenticated, wrong role)
> - Race conditions considered for concurrent operations
> - Rollback strategy exists for multi-step operations
>
> **Scope Reduction Detection:**
> - Scan all slice descriptions, done-conditions, and implementation notes for hedging language that silently downgrades scope
> - Hedging terms (non-exhaustive): "v1", "basic version", "simplified", "placeholder", "for now", "future enhancement", "out of scope for now", "minimal implementation", "stubbed out", "hardcoded for now", "bare minimum", "just enough to", "temporary solution", "will revisit"
> - When hedging language is found AND the corresponding feature is marked as in-scope in the PRD, flag as MAJOR with: the verbatim hedging phrase, the slice/field where it appears, and the PRD requirement it violates
> - Do NOT flag hedging in risk assessments, mitigation strategies, or dependency notes — those sections legitimately use cautious language
> - Do NOT flag technical identifiers in file paths (e.g., "v1" in `src/api/v1/routes.ts`)
> - Do NOT flag features that the PRD explicitly marks as phased, deferred, or future scope
>
> **Wave Assignment Validation (if any slices have `Wave:` fields):**
> - Skip entirely if no slices have `Wave:` fields (legacy plan — note in VERIFIED)
> - If ANY slice has a `Wave:` field, ALL slices must have one — mixed is MAJOR
> - Wave numbers must be contiguous 1-indexed integers (1, 2, 3...) with no gaps — non-contiguous is MAJOR
> - For each wave: collect `Files:` lists of all slices in that wave and verify zero intersection. Any shared file within a wave = CRITICAL (parallel execution would cause file conflicts). Include the specific file path and slice numbers in the finding
> - Check dependency ordering: if slice A's `Done when:` references output created by slice B, A must be in a later wave than B — violation is CRITICAL
> - The same file appearing across different waves is valid (sequential execution between waves)
> - Single-slice waves are valid — not every slice can parallelize
> - Note case-sensitivity: on case-insensitive filesystems, `src/Auth.ts` and `src/auth.ts` are the same file
>
> Return ONLY this structure:
>
> FINDINGS:
> 1. [CRITICAL|MAJOR|MINOR] — description — which section/slice is affected
> 2. ...
>
> VERIFIED:
> - List of checks that passed
>
> If zero findings, return "FINDINGS: none" — but be skeptical. Plans almost always have issues.

#### Step 2: Incorporate Findings

1. Read all findings. Do not dismiss CRITICAL or MAJOR findings.
2. Fix the plan file for every CRITICAL and MAJOR finding:
   - Vague done-conditions → rewrite with testable criteria
   - Wrong file paths → verify with Glob/Grep and correct
   - Oversized slices → split into smaller slices
   - Missing edge cases → add to relevant slice
   - Security gaps → add validation/auth requirements
   - Wrong dependency ordering → reorder slices
3. MINOR findings: fix if straightforward, otherwise note in Review Notes.
4. Do NOT re-run the critic. One pass is sufficient.

#### Step 3: Append Review Notes

Add a `## Review Notes` section at the end of the plan file:

```
## Review Notes

### Critic Findings
- **Total**: N findings (X critical, Y major, Z minor)
- **All CRITICAL/MAJOR addressed**: Yes/No

### Changes Made
- [What was changed and why]

### Acknowledged Minor Issues
- [Any MINOR findings not fixed, with justification]
```

Only call ExitPlanMode after Review Notes are written.
