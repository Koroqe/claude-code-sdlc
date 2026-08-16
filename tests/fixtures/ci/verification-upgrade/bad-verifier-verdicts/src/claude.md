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
| QA Lead | `qa-planner` | Test cases in `docs/qa/<feature>_test_cases.md` |
| Tech Lead | `planner` | Implementation plan (5-9 slices) |
| Security Engineer | `security-auditor` | Security review for sensitive slices |
| Developer | `test-writer` | TDD test implementation |
| QA Engineer | `e2e-runner` | E2E tests from use-case scenarios |
| Code Reviewer | `code-reviewer` | Code quality and standards |
| DevOps | `build-runner` | Typecheck, tests, build verification |
| Verification Engineer | `verifier` | Goal-backward integration verification (wiring, data flow, stub detection) |
| Tech Writer | `doc-updater` | Documentation accuracy + `CHANGELOG.md` maintenance |
| Senior Developer | `refactor-cleaner` | Post-implementation cleanup |
| Plan Critic | `plan-critic` | Adversarial plan review — BLOCKER/WARNING/INFO findings before implementation begins |

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
N+1. Code review, security audit, build, E2E, docs verification, changelog entry

**A plan without documentation phases is INCOMPLETE. Do not proceed to implementation without them.**

### CRITICAL: After Plan Approval (plan mode or otherwise)

When you exit plan mode OR receive approval to proceed with a feature, you MUST:

*(The commands referenced below are plugin skills, resolvable in full as `/claude-code-sdlc:<name>` — e.g. `/claude-code-sdlc:bootstrap-feature`. The bare form used throughout this file works automatically as long as no other installed plugin defines a skill by the same name.)*

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
   - [ ] CHANGELOG.md entry (written at merge-ready / standalone fix)
3. **Implementation slices** — preliminary breakdown (refined by planner agent in bootstrap)
4. **Files likely affected**
5. **Risks and dependencies**

A plan missing the deliverables checklist is INCOMPLETE.

### Plan Critic Pass (MANDATORY — before ExitPlanMode)

After writing the plan file and before calling ExitPlanMode, you MUST run a critic pass. Do NOT present the plan to the user without completing this step.

#### Step 1: Spawn Plan Critic

Invoke the `plan-critic` agent via the `Agent` tool with the plan file path — the same way `prd-writer`, `ba-analyst`, and the other agents in this pipeline are already invoked elsewhere in this workflow.

**Fail-visible fallback:** `plan-critic` ships in the plugin; the memory layer (this file) ships separately via `install.sh`. Someone with only the memory layer installed has no `plan-critic` agent available. If the `Agent` tool cannot resolve `plan-critic`, warn — naming `plan-critic` explicitly as unresolvable — and proceed to `ExitPlanMode` without a critique. Never skip the critic pass silently: a quality gate that vanishes without a word is worse than one that is absent by design.

**Critique-and-fix loop (max 3 loops, then escalate):**
1. Invoke `plan-critic` against the plan file (loop 1).
2. **Fix the plan file for every BLOCKER and every WARNING finding (see Step 2). This fix pass always runs whenever there is at least one BLOCKER or WARNING finding — it is NOT conditional on a BLOCKER being present.** WARNING is where Scope Reduction Detection lands: hedging like "v1", "basic version", "stubbed out" is WARNING-tier, and it is exactly the finding class that must be fixed rather than noted, since its whole effect is to quietly deliver less than the PRD promised.
3. **Re-invoke only if a BLOCKER was found** in the loop just completed — the loop repeats on BLOCKERs, but the fixing covers WARNINGs too. Repeat up to loop 3.
4. If zero BLOCKER findings remain after any loop, proceed — having already applied the step-2 fixes. Any WARNING that was deliberately not fixed is recorded in Review Notes with its justification; do NOT run a further loop.
5. If a BLOCKER finding still remains after loop 3, escalate per Rule 4 (`error-recovery.md`): stop, present the remaining BLOCKER findings verbatim, state the decision needed, and present the options. Do NOT proceed with an unresolved BLOCKER, and do NOT call ExitPlanMode.

`plan-critic` returns findings in this structure:

```
FINDINGS:
1. [BLOCKER|WARNING|INFO] — description — which section/slice is affected
2. ...

VERIFIED:
- List of checks that passed
```

If zero findings, it returns "FINDINGS: none".

#### Step 2: Incorporate Findings

1. Read all findings from the current loop. Do not dismiss BLOCKER or WARNING findings.
2. Fix the plan file for every BLOCKER and WARNING finding:
   - Vague done-conditions → rewrite with testable criteria
   - Wrong file paths → verify with Glob/Grep and correct
   - Oversized slices → split into smaller slices
   - Missing edge cases → add to relevant slice
   - Security gaps → add validation/auth requirements
   - Wrong dependency ordering → reorder slices
3. INFO findings: fix if straightforward, otherwise note in Review Notes.

#### Step 3: Append Review Notes

Once the loop concludes with zero remaining BLOCKER findings, add a `## Review Notes` section at the end of the plan file:

```
## Review Notes

### Critic Findings
- **Total**: N findings across M loop(s) (X blocker, Y warning, Z info)
- **All BLOCKER/WARNING addressed**: Yes/No

### Changes Made
- [What was changed and why]

### Acknowledged Minor Issues
- [Any INFO findings not fixed, with justification]
```

Only call ExitPlanMode after Review Notes are written.
