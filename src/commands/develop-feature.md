# Command: Develop Feature

Autonomously implement a complete feature from request to merge-ready. This command chains the full agency SDLC pipeline without stopping for human input.

## Pipeline

### Phase 1: Bootstrap (Documentation)
Follow the `/bootstrap-feature` workflow for the requested feature.
This produces: PRD section, use-case document, architecture review, QA test cases, implementation plan, feature branch, and initialized scratchpad.

### Phase 1.5: Implementation Review
After the plan is created by the Tech Lead:
- **Architect** reviews slices flagged for architectural complexity — validates technical design for each
- **Security Engineer** (security-auditor) reviews slices touching auth, financial data, or external APIs — flags security requirements
- Incorporate review feedback into slice implementation notes in the scratchpad

### Phase 2: Implement All Slices (Wave-Aware)

Read `.claude/scratchpad.md` to identify the current wave and its pending slices. Process waves in order (Wave 1 → Wave 2 → ... → Wave N).

**Single-slice wave (or no `Wave:` fields in plan):**
Follow the `/implement-slice` workflow directly — identical to current sequential behavior.

**Multi-slice wave (2+ pending slices in same wave):**
Spawn parallel subagents — one Agent tool call per slice in a single message:

```
For each pending slice in the current wave, spawn an Agent with this prompt:

"You are implementing Slice [N]: [description].
Follow the /implement-slice TDD workflow for this slice ONLY.

Slice specification:
- Wave: [W] (sibling slices: [list])
- Files: [files]
- Changes: [changes]
- Verify: [verify command]
- Done when: [condition]

CRITICAL RULES FOR PARALLEL EXECUTION:
1. Do NOT write to .claude/scratchpad.md — the orchestrator handles scratchpad updates
2. Do NOT auto-continue to the next slice — return to the orchestrator after committing
3. Chain git commands: git add <files> && git commit -m '...' (single command to prevent staging conflicts)
4. Read the project's CLAUDE.md at .claude/CLAUDE.md for conventions

Report your result: PASS (with commit hash) or FAIL (with error details)."
```

**Post-wave result collection (applies to BOTH dispatch paths above — single-slice and multi-slice):** after the slice(s) in the current wave have completed via either the Single-slice path (line 21) or the Multi-slice parallel spawn (line 24), run the following four steps before advancing to the next wave.

1. **Collect results** — which slices succeeded (commit hashes), which failed (errors)
2. **Update scratchpad** — mark succeeded slices DONE with commit hashes, mark failed slices with FAILED and reason. Update `## Status:` to reflect current wave progress
3. **Changelog sync (orchestrator-only, once per wave)** — delegate to `changelog-writer` ONCE after all subagents in this wave have completed and the scratchpad is updated, BEFORE proceeding to the next wave. **This applies to ALL waves regardless of size — single-slice waves included.** The agent is idempotent per FR-2.6 and NFR-6, so redundant invocations are cheap (no-op on second call). Uniform dispatch eliminates the dispatch-contradiction risk where a single-slice subagent would receive wave context (causing `implement-slice.md` Step 5.5 to SKIP) while the orchestrator also skipped — leaving the wave without a sync. The agent is invoked with no arguments beyond CWD (per FR-4.6). Subagents within the wave (single or multi-slice) do NOT invoke the agent themselves — this is the structural prevention of the PRD 3.9 Risk 3 double-write race (per FR-4.2). A `no-op: not configured` response inside the SDLC repo is expected and treated as success. If the agent fails, log the error and proceed to the next wave — per FR-4.5 this hook is non-blocking; NFR-6 idempotency ensures the next hook invocation reconciles state.
4. **Handle failures** (per error-recovery parallel wave rules):
   - All succeeded → proceed to next wave
   - Some failed → keep successful sibling commits (independent files), report failures, ask user: retry / continue / abort
   - All failed → report as blocker, stop

**Continue until all waves show complete in the scratchpad.**

**Backward compatibility:** When slices have no `Wave:` fields, treat each slice as its own wave — sequential execution, identical to current behavior.

### Phase 2.5: Code Cleanup (if 4+ slices were implemented)
Delegate to `refactor-cleaner` agent to review the accumulated changes:
- **Step 0**: Remove dead code, unused imports, and debug logs first — verify typecheck passes on the clean baseline before proceeding
- Consolidate duplicated patterns across slices
- Improve type safety where obvious
Then commit cleanup as a single `chore(core): clean up <feature> implementation` commit.

### Phase 2.75: QA Cycle (strict evidence-based execution)

Follow the `/qa-cycle` workflow. The `qa-engineer` agent executes the documented QA plan against the running implementation, gathers concrete evidence per test case (Playwright MCP for UI/UX, Bash for API/DB/CLI), and emits PASS/FAIL/BLOCKED verdicts. FAIL spawns the implementer with fix directives — the cycle repeats until overall PASS or until BLOCKED surfaces a fact-grounded human-needed action.

- If overall PASS → proceed to Phase 3
- If overall BLOCKED → halt `/develop-feature` entirely; the human resolves the surfaced action, then re-runs `/develop-feature` (which restarts at Phase 2.75 with iteration N+1)
- If implementer FAIL → halt `/develop-feature`; surface the implementer's report; the human investigates

**Why this phase exists:** the standard `e2e-runner` pass that lives inside `/merge-ready` Gate 5 is a CODE-AUTHORING check (writes E2E tests, runs the suite). It does NOT examine screenshots visually, does NOT enforce Playwright-MCP-backed evidence per case, does NOT flag visual defects observed but not in the test plan. `/qa-cycle` is the STRICT pass that catches the visual / UX defects that automated E2E typically misses — the user-experienced load-bearing failure mode.

### Phase 3: Quality Gates
Follow the `/merge-ready` workflow to run all quality gates.
- If any gate FAILS: the main agent reads the gate's output and fixes the issues directly, then reruns only the failed gate(s)
- Repeat until all gates pass OR 3 fix attempts exhausted per gate
- Output final MERGE READY / NOT MERGE READY verdict

## Rules

- NEVER stop to ask the user unless truly stuck (3 retries exhausted on a critical blocker)
- NEVER skip PRD, Use Cases, or QA documentation steps
- ALWAYS update scratchpad after each slice (enforced by scratchpad rule)
- ALWAYS commit each slice atomically (1 slice = 1 commit)
- NEVER add "Co-Authored-By" or AI attribution
