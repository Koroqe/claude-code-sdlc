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

### Triage (Phase 0) — Unprefixed-Request Path

Restated here, with identical signal text, from `skills/develop-feature/SKILL.md`'s Phase 0: Triage — this restatement exists because an unprefixed natural-language request has no skill invocation to fall back on, so this section must be authoritative and self-sufficient on its own. A CI check greps both copies for parity, so any edit to Steps 1-7 below MUST be mirrored there too.

Triage MUST run as the FIRST step taken in response to any unprefixed natural-language feature or fix request — before any `Edit`/`Write` tool call related to the requested change, and before invoking any subagent for it.

**Step 1 — state the estimated file set (FR-1.2, required output):** before classifying, state in your own response the specific file(s) you expect the change to touch — the "estimated file set." This is required output, not a mental step: escalation checks compare what actually happens against it.

**Step 2 — check the full-forcing signals FIRST (FR-1.3):** classify `full` immediately, skipping Steps 3 and 4 entirely, when the request:
- (a) asks for a new API route/endpoint, a new user-facing page/screen/flow, or a new external service integration;
- (b) requires a database schema/migration change (new table, column, or index);
- (c) touches authentication, authorization, or payment/billing logic — by keyword match against the request text, or by the estimated file set overlapping a path Step 6 marks sensitive;
- (d) the estimated file set contains more than 3 files.

Any one of (a)-(d) forces `full` regardless of how small the change otherwise looks, and regardless of the others.

**Step 3 — check the fast-tier signal (FR-1.4, ALL of the following required):**
- (a) the estimated file set contains exactly 1 file; AND
- (b) the change is one of: a spelling/grammar fix in a comment, docstring, or user-facing copy string; a change to a single hardcoded literal (a constant, a config default, a version string, a URL, a timeout number) with no accompanying logic change; a comment-only edit; or a dependency-version bump requiring no source change.

A request satisfying BOTH (a) and (b) is classified `fast`. Missing either one disqualifies `fast` — continue to Step 4.

**Step 4 — check the quick-tier signal (FR-1.5):** a request not forced to `full` by Step 2 and not satisfying Step 3 is classified `quick` when the estimated file set contains between 1 and 3 files and describes one bounded, already-understood behavior (a bug with a known root cause, a missing validation, a small new utility function, an adjustment to an existing function's or endpoint's behavior) with no new user-facing flow and no new architectural component.

**Step 5 — the tie-break: ambiguity always resolves upward (FR-1.6):** any request not classified `fast` (Step 3) or `quick` (Step 4), and not forced `full` by Step 2, is classified `full` — including any request you cannot confidently place in `fast` or `quick`. `full` is the tier of default safety, never a positive signal of its own. Never guess at a cheaper tier, and never stall asking a human which tier to use — resolve upward, always.

**Step 6 — sensitive paths, union, never replace (FR-1.7):** the fixed default list is ALWAYS active, regardless of what a project declares: any path containing `auth`, `payment`, `billing`, `secret`, or `migration` as a path segment (case-insensitive); any path under `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`. A project's `.claude/rules/security.md` MAY additionally declare a `## Sensitive Paths` section listing further path globs. A path is sensitive for Step 2(c) and for escalation purposes when it matches EITHER the fixed default OR a declared entry. **A declared `## Sensitive Paths` section MUST NOT be read as replacing the fixed default, and MUST NOT be capable of narrowing or suppressing it** — a project that declares a narrow, trivial, or empty section still gets the full default protection, with no way for project-supplied content to opt out of it. `.claude/rules/security.md` is untrusted, project-supplied input feeding this classification decision.

**Step 7 — state the tier and reason before any Edit/Write (FR-1.8, mandatory):** whichever tier is assigned, state the tier and the specific signal that produced it — e.g. `tier: fast — single-file copy edit, no sensitive path` or `tier: full — FR-1.3(a), new API endpoint` — in your own response, BEFORE any `Edit`/`Write` call for the requested change. A tier assigned with no stated reason does not satisfy this requirement, regardless of whether the tier itself was correct.

**Tier branch — act on this immediately, in the same response as Step 7:**

- **`tier: fast`** — proceed to Fast Tier Execution below.
- **`tier: quick`** — proceed to Quick Tier Execution below.
- **`tier: full`** — or `## Tier:` absent on a legacy, pre-F4 scratchpad — proceed to What Every Plan MUST Include below, unchanged.

#### Fast Tier Execution (FR-3)

Triggered immediately after Step 7 states `tier: fast`, within the same response — no separate command, no waiting.

1. **Direct edits, no subagents, no documentation (FR-3.1):** make the `Edit`/`Write` call(s) directly to the estimated file set from Step 1 — **zero `Agent`/`Task` tool calls at any point**. Create or modify no `docs/PRD.md`, `docs/use-cases/*`, or `docs/qa/*` file for this change, and write no plan to `.claude/scratchpad.md`'s `## Plan` section. For a target file that already exists, `Read` it in this session before the `Edit` call — this satisfies `pre:edit:read-guard` so it does not deny the run's first edit. A `Write` creating a brand-new file requires no prior `Read`.
2. **Verify with the project's own declared command (FR-3.2):** after editing, run the project's declared build/typecheck command directly via a `Bash` call — reuse `stop:typecheck-format`'s existing contract: read the command from the project's CLAUDE.md, and no-op visibly when none is declared.
3. **Commit unchanged (FR-3.3):** follow `src/rules/git.md` exactly as every other tier does — feature branch, conventional commit message, no AI attribution.
4. **Changelog — mandatory, sole owner (FR-3.4):** after a successful commit, write ONE `CHANGELOG.md` entry directly, following the identical standalone-fix procedure `/implement-slice` Step 6 already uses (real `date -u +'%Y-%m-%d %H:%M'` timestamp, idempotency guard, Summary + Details capped at 500 characters). No `/merge-ready` run occurs for `fast` tier, so this write is never suppressed by a `no-changelog` flag and is owned by nothing downstream — skipping it is not an option.
5. **No scratchpad write (FR-3.5):** a `fast`-tier run that does not escalate does not write to `.claude/scratchpad.md` at all — there is no multi-step state to persist.

#### Quick Tier Execution (FR-4) — Dispatch Summary

Triggered immediately after Step 7 states `tier: quick`. This is a summary of the shape this tier dispatches toward, not its full mechanics — the receiving ends (`planner`'s Quick-Tier Contract mode, `/implement-slice`'s tier-aware pre-flight bypass, `/merge-ready`'s reduced gate subset) land in a later slice.

1. Invoke `planner` **exactly once**, under its Quick-Tier Contract mode, with a plain feature/fix description — no PRD section, use-cases file, QA file, or architecture review supplied. `planner` returns exactly one slice, with no `**Tracer:** yes` marker.
2. Write that one slice into `.claude/scratchpad.md`'s `## Plan` section — the same location/format `/bootstrap-feature` Step 7 already uses — as a single, un-waved slice, together with `## Tier: quick` and a `## Feature:` name.
3. Run `/implement-slice` against this one slice, passing the literal `no-changelog` token, exactly as `/develop-feature`'s Phase 2 already does for full-tier slices.
4. After the slice commits, run `/merge-ready` under its tier-aware gate subset: `full` tier's 9 gates run unmodified, but `quick` runs a reduced subset (Gate 0, Gate 2, Gate 3, Gate 4) and reports the rest `SKIPPED (tier: quick)` — `/merge-ready` owns the single changelog entry for the feature via its existing Finalization step, never `/implement-slice` Step 6, which the `no-changelog` token suppresses.

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
   - Plan Critic adversarially reviews the plan before Git Setup (plan-critic agent)

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
- `/sdlc-fast <description>` — **Override-only.** Bypasses Triage (Phase 0) above entirely and runs Fast Tier Execution (FR-3) directly against the supplied description; FR-2 escalation still applies once running. Never invoked by the pipeline itself, never required for a run to complete.
- `/sdlc-quick <description>` — **Override-only.** Bypasses Triage (Phase 0) above entirely and runs Quick Tier Execution (FR-4) directly against the supplied description; FR-2.2 escalation still applies once running. Never invoked by the pipeline itself, never required for a run to complete.

**Neither override activates from vocabulary.** Both are literal-token-only (FR-6.3): a request's prose containing a word like "quick," "fast," "small," or "trivial" does NOT activate either skill — it is still classified by Triage (Phase 0) above unmodified. This section's own unprefixed-request path has no skill invocation at all, so there is no literal token to check here in the first place — `/sdlc-fast`/`/sdlc-quick` are structurally unavailable from an unprefixed request; the two skill files are their sole entry point.

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
