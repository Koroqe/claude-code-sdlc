# Command: QA Cycle

Run a strict QA/Dev iteration loop against the current implementation. The QA Engineer executes the documented QA plan, gathers concrete evidence (Playwright screenshots, console logs, network responses, command output, DB rows), and emits a per-test-case PASS/FAIL/BLOCKED verdict. Any FAIL spawns the implementer with fix directives and the cycle repeats. Any BLOCKED halts the loop and surfaces a fact-grounded argument to the human.

**Run this BEFORE `/merge-ready`.** `/merge-ready` assumes the QA plan has been executed and passed; `/qa-cycle` is what makes that assumption true. `/develop-feature` chains `/qa-cycle` automatically between Phase 2 (implementation) and Phase 3 (quality gates).

## When to invoke

- Manually, after implementing slices that change behavior, before opening the merge-ready gates
- Automatically, as part of `/develop-feature` (chained after the implementation loop, before `/merge-ready`)
- After a `BLOCKED` verdict has been resolved by the human — restart the cycle from iteration 1

## Pre-flight: Playwright availability check

If `docs/qa/<feature>_test_cases.md` contains ANY row with `Verification Class = UI/UX`, the `mcp__plugin_playwright_playwright__browser_*` tools MUST be available before the cycle begins.

Probe via the `ToolSearch` mechanism: query `select:mcp__plugin_playwright_playwright__browser_navigate` and check if the schema loads. If it does not, hard-fail with:

```
qa-cycle: BLOCKED — feature has UI/UX test cases but Playwright MCP plugin is not configured.
Resolution: add the playwright MCP plugin to .mcp.json (or the equivalent client-side config)
and re-run /qa-cycle.
```

Exit 1 without running the qa-engineer. Do NOT silently skip UI/UX cases — the user explicitly chose the "Hard FAIL all UI test cases" policy for missing Playwright.

If the QA plan has zero UI/UX rows (pure backend feature), skip the Playwright check and proceed.

## Cycle protocol

### Iteration N

#### Step 1 — Spawn `qa-engineer`

Pass the agent these inputs (in the prompt):

- The feature slug (used to locate `docs/qa/<feature>_test_cases.md`)
- The iteration number `N` (used by qa-engineer to namespace evidence artifacts under `.claude/qa-evidence/iter-<N>/`)
- The dev server URL (if applicable — discovered from CLAUDE.md or `.env`)
- The DB connection string (if applicable — same source)
- Pointer to prior `BLOCKED` verdicts that have just been resolved (if this is a resumption after human input)

The agent emits a structured verdict per its `## Output format` section. Capture the full structured report — the orchestrator parses it verbatim.

#### Step 2 — Parse the overall verdict

Three branches:

**Overall = PASS**

Every test case passed with evidence. Emit:

```
qa-cycle: PASS — all <N> test cases verified with concrete evidence over <M> iterations.
Evidence retained at .claude/qa-evidence/iter-1/, .claude/qa-evidence/iter-2/, …, .claude/qa-evidence/iter-<M>/
Next: run /merge-ready.
```

Exit 0. `/qa-cycle` is done.

**Overall = FAIL**

At least one test case failed. The qa-engineer's report contains a `### FAIL cases (fix directives)` section. Proceed to Step 3 — spawn implementer.

**Overall = BLOCKED**

At least one case has the BLOCKED verdict with an `exit_argument` and a `human_needs_to` directive. BLOCKED outranks FAIL: if both exist, treat the overall as BLOCKED. Proceed to Step 4 — surface to human.

#### Step 3 — Spawn implementer with fix directives (when overall=FAIL)

For each FAIL case in the qa-engineer report, the report contains:
- The expected vs actual mismatch
- A `fix_directive` pointing at file:line or symptom
- Evidence artifacts (screenshot paths, console logs, network responses)

**Deliberate-mode injection (neuroscience: post-error slowing).** On iteration N+1 after a FAIL — i.e., every implementer spawn EXCEPT the first one — the orchestrator MUST prepend the following directive to the implementer's prompt, in addition to the fix directives:

```
DELIBERATE MODE — this is iteration <N+1> after qa-engineer FAIL on iteration <N>.
The post-error-slowing protocol from `~/.claude/rules/error-recovery.md` applies:

- Read every file you intend to edit BEFORE making the first edit (no working from
  memory of earlier reads; the prior iteration may have invalidated your mental model)
- Target a SMALLER diff than the prior iteration produced — aim ≤ 50% of prior
  iteration's line count; if you cannot, that is a load-bearing signal that the
  fix-directive is mis-scoped and you should surface BLOCKED with that argument
- Run the project's typecheck command BEFORE committing (pre-flight, not post-commit)
- Apply exactly the fix_directives below — do NOT take the opportunity to refactor
  adjacent code, even if it looks like it needs work; scope discipline matters here
- If you find yourself making the same edit you made on the previous iteration to
  the same file lines, STOP and report BLOCKED with the diff history attached —
  this is the sunk-cost detection working
```

**Sunk-cost circuit breaker (neuroscience: OFC sunk-cost detection).** Before spawning the implementer on iteration N+1, the orchestrator checks the diff-progression signal:

1. Compute the file list + total line count of the implementer's commit from iteration N
2. Compare to iterations N-1 and N-2 if they exist
3. If the last 3 implementer commits all touch the SAME files AND the total line counts are within ±20% of each other (the implementer is making variations on the same edit without converging), trigger the **Sunk Cost Audit** pause

The Sunk Cost Audit:

```
SUNK COST AUDIT — iteration <N+1> would be the 4th consecutive attempt with
non-converging diffs (same files, similar line counts):

  iter <N-2>: files=[...], lines=±M
  iter <N-1>: files=[...], lines=±M (Δ=<%>)
  iter <N>  : files=[...], lines=±M (Δ=<%>)

The implementer appears to be stuck on this slice. Halting before spawning iter <N+1>.
```

Then invoke `AskUserQuestion` with three options:
1. **Continue iterating** — proceed to iter N+1 anyway (user judges the implementer is close)
2. **Pivot to alternative approach** — the human revises the fix_directives with a different angle, then `/qa-cycle` resumes with the revised directives
3. **Kill this slice / escalate** — the slice is abandoned or escalated; `/qa-cycle` halts and returns control

The diff-progression check is ONLY armed after 3 consecutive iterations. The "3" is the minimum signal; fewer iterations may not reflect a stuck state.

Spawn the implementer (the same general-purpose `Agent` invocation used by `/implement-slice` — NOT a separate dedicated agent). Pass it:

```
You are fixing test failures reported by qa-engineer in iteration N.

The fixes MUST satisfy the following directives from the QA verdict. Do not
expand scope — fix exactly these, then exit.

[paste the full ### FAIL cases section here, verbatim]

The evidence artifacts are at:
- .claude/qa-evidence/iter-<N>/

Read them to understand the actual observed failure modes before editing
code. The fix_directive points to a file:line or a symptom; choose the
minimal correct fix.

After your edits:
1. Stage + commit with message "fix(qa): satisfy iter-<N> verdict (TC-X.Y.Z, TC-A.B.C, …)"
2. Report back: PASS (commit hash) | FAIL (why the directive cannot be satisfied) | BLOCKED (human input needed)

CRITICAL: If a fix directive cannot be satisfied without human intervention
(missing external API token, missing design mock, ambiguous requirement),
report BLOCKED with the same shape as qa-engineer's BLOCKED verdict:

```
verdict: BLOCKED
exit_argument: |
  fact 1: <file:line or directive reference>
  fact 2: <...>
  conclusion: <why this directive cannot be satisfied with available facts>
human_needs_to: <single concrete action / decision>
proposed_alternatives: <if any>
```

This is your fact-grounded exit hatch from the cycle. Use it sparingly —
only when concrete facts prevent forward motion.
```

After the implementer returns, route on its verdict:

- **Implementer PASS** → increment N, return to Step 1 (re-run qa-engineer)
- **Implementer FAIL** → escalate to user. The implementer hit a non-BLOCKED problem (e.g., test suite broke after their fix, code change introduced unrelated regression). Surface the implementer's FAIL report to the human via plain output (NOT AskUserQuestion — this is "something went unexpectedly wrong, please look"). Halt the cycle.
- **Implementer BLOCKED** → treat the same as qa-engineer BLOCKED. Proceed to Step 4.

#### Step 4 — Halt and surface BLOCKED (when overall=BLOCKED)

The BLOCKED verdict from EITHER qa-engineer OR implementer contains `exit_argument` (fact-grounded reasoning) and `human_needs_to` (concrete action).

Halt the cycle. Emit to stdout the full BLOCKED context:

```
qa-cycle: BLOCKED at iteration <N>.

<source agent> reported a fact-grounded inability to proceed:

[paste the BLOCKED case(s) verbatim — including exit_argument, human_needs_to, proposed_alternatives]

Evidence captured up to this point: .claude/qa-evidence/iter-1/, …, .claude/qa-evidence/iter-<N>/

Use AskUserQuestion to ask the human:
1. Resolve the BLOCKED case (e.g., provide the missing token, decide on the
   ambiguous requirement, authorize the destructive operation, supply the
   missing design mock)
2. Accept a proposed alternative (if any was offered)
3. Abort the cycle entirely

When the human resolves, restart /qa-cycle from iteration N+1.
```

Then immediately invoke `AskUserQuestion` with a question composed from `exit_argument` + `human_needs_to`. The options must include the proposed alternatives (if any) AND "Abort the cycle." Do NOT auto-resolve — the BLOCKED-with-arguments escape is the safety mechanism the user explicitly designed into this flow.

### No iteration cap

Per user spec: the cycle has NO maximum iteration count. The legitimate exit paths are:

- **Overall = PASS** — all cases verified, cycle done, proceed to /merge-ready
- **Overall = BLOCKED** — fact-grounded inability to proceed, human intervention required, cycle halted
- **Implementer FAIL** — implementer broke something unexpectedly; surface to human as an incident

A cycle that keeps emitting FAIL → fix → FAIL → fix is NOT automatically halted. The implementer's BLOCKED hatch is the relief valve — when a fix attempt reveals the directive cannot be satisfied without human input, the implementer is expected to call it. If the implementer DOESN'T call it and keeps trying, that is a bug in the implementer's discipline, not in /qa-cycle's design.

If the user observes a long-running cycle and wants to stop it manually, Ctrl-C interrupts and the orchestrator surfaces the current iteration's evidence.

## Output (when /qa-cycle completes)

```markdown
## /qa-cycle Summary

**Verdict:** PASS | BLOCKED | (terminated)
**Iterations:** <N>
**Total test cases:** <T>
**Final tallies (iteration N):** PASS=<p>, FAIL=<f>, BLOCKED=<b>

### Per-iteration progression
| Iter | PASS | FAIL | BLOCKED | Outcome |
|------|------|------|---------|---------|
| 1    | 24   | 6    | 0       | implementer fixed all 6 |
| 2    | 29   | 1    | 0       | implementer fixed last 1 |
| 3    | 30   | 0    | 0       | PASS — cycle complete |

### Evidence artifacts
All screenshots, console captures, network logs, SQL outputs, and command outputs preserved under `.claude/qa-evidence/iter-<N>/`. Review these BEFORE running /merge-ready to spot-check the QA Engineer's verdicts.

### Next step
- If PASS: run /merge-ready
- If BLOCKED: resolve the surfaced human-needs-to action, then re-run /qa-cycle
- If terminated unexpectedly: investigate the implementer's FAIL report
```

## Scratchpad updates

The orchestrator (the main agent running `/qa-cycle`) updates `.claude/scratchpad.md` at each iteration boundary. The qa-engineer subagent and the implementer subagent MUST NOT write to scratchpad themselves — same discipline as the parallel-wave implementer rules in `/develop-feature` (single-writer invariant). After each iteration the orchestrator writes:

```
## Status: qa-cycle iter <N> (PASS=<p> FAIL=<f> BLOCKED=<b>)
```

When overall verdict is reached, the orchestrator updates to `## Status: quality-gates` (proceeding to `/merge-ready`) or `## Status: blocked` (awaiting human input on a BLOCKED case). Iteration history accumulates under a `## QA Cycle History` heading so future agents reading scratchpad see the full chain of evidence and verdicts.

## Rules

- The cycle ALWAYS starts with qa-engineer, even if you just finished implementation — don't trust "looks ok"
- The qa-engineer NEVER modifies code — its job is verdicts + evidence
- The implementer NEVER emits a PASS without a commit hash — re-running qa-engineer is what produces PASS
- Both agents can emit BLOCKED with fact-grounded `exit_argument` — this is the explicit exit hatch designed into the protocol
- Evidence artifacts under `.claude/qa-evidence/iter-<N>/` are NEVER auto-deleted between iterations — they form the audit trail for the cycle
- Playwright MCP missing + any UI test case = hard fail before the cycle starts (the operator must configure MCP, no silent skip)

## Relation to other commands

- `/develop-feature` — chains `/qa-cycle` automatically between Phase 2 (implement) and Phase 3 (`/merge-ready`)
- `/implement-slice` — focused on a SINGLE slice's TDD loop; does NOT include `/qa-cycle`. After all slices are implemented, the orchestrator calls `/qa-cycle` once to verdict the whole feature
- `/merge-ready` — its 9 gates ASSUME `/qa-cycle` has run and passed. Gate 5 (E2E) still runs its own e2e-runner pass — that's the LOWER-stringency code-authoring check; `/qa-cycle` is the HIGHER-stringency evidence-gathering pass that catches the visual / UX defects that automated E2E typically misses

## Cognitive Self-Check

The orchestrator (`/qa-cycle` itself, executed by the main agent) follows `~/.claude/rules/cognitive-self-check.md` on the cycle-level claims it emits — e.g., "all cases passed" must be backed by the qa-engineer's structured report, not by the orchestrator's reading of "yeah, looks like it." The per-case fact-check is the qa-engineer's responsibility (see its own `## Cognitive Self-Check (MANDATORY — STRICTER…)` section).
