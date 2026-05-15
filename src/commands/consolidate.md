# Command: Consolidate

Invoke the `consolidator` agent to surface cross-artifact drift, decision divergence, hack accumulation, verdict-vs-reality mismatches, and pattern observations across the current feature's accumulated work.

This is the memory-consolidation pass — the sleep-replay analogue from neuroscience. While task-focused agents (planner, architect, qa-planner, implementer) each look at their own slice, nobody looks across the whole accumulated stack for inconsistencies. `/consolidate` does.

## When to invoke

- **Auto (chained from `/develop-feature`):** between each wave in Phase 2, after the wave's slices commit, before the next wave starts. Catches drift as it accumulates rather than as a single end-of-feature audit.
- **Manual:** when returning to a long-running feature after time away, when something feels off, or before `/qa-cycle` to surface drift before strict QA execution amplifies it.
- **Soft pre-merge check:** as an informational pass in `/merge-ready` Gate 1 (Documentation Completeness). Output is informational; not a hard blocker.

## Inputs

The `consolidator` agent reads, in roughly this order:

1. `.claude/scratchpad.md` (current state + archive of prior waves)
2. `.claude/plan.md` (executable plan)
3. `docs/PRD.md` (current-feature section)
4. `docs/use-cases/<feature>_use_cases.md`
5. `docs/qa/<feature>_test_cases.md`
6. Recent git commits since the feature branch diverged from `main` (commit messages + per-file diffs)
7. Any verdict files: `.claude/resources-pending.md`, `.claude/roles-pending.md`, release-notes files
8. The actual codebase referenced by the plan

## Protocol

### Step 1 — Spawn the `consolidator` agent

Pass it the feature slug (or auto-detect from `.claude/scratchpad.md` `## Feature:` line). The agent runs the six drift-detection passes (PRD↔plan / use-case↔test↔implementation / decision drift across slices / hack accumulation / verdict↔reality / pattern observations) and emits a structured stdout report.

### Step 2 — Parse the drift report

Three branches based on `### Drift summary`:

**Zero drift findings (`no drift detected`):**

Emit:
```
/consolidate: no drift detected across N waves / M slices.
Confidence: <high | medium | low — based on whether the agent found at least pattern observations vs zero output entirely>
Next: proceed with the current wave / merge-ready / whatever the orchestrator was planning to do.
```

A zero-finding outcome with zero pattern observations should be treated with caution — silent "no drift" is suspicious; consolidator was instructed to surface zero-finding outcomes explicitly with confidence.

**M maintenance signals only (no critical, no major):**

Emit the maintenance-signal section verbatim from the report; proceed without halting. Update `.claude/scratchpad.md → ## Drift Observations` (a new section, created lazily) with the dated entry so future invocations can reference it.

**N critical or major findings:**

Halt the calling orchestrator. Surface the critical/major findings as a structured list. Use `AskUserQuestion` to ask the human:

1. Address the findings before continuing (returns control to the user, expects them to revise the plan / fix the drift)
2. Acknowledge findings as accepted technical debt (recorded in scratchpad → `## Acknowledged Drift`, orchestrator proceeds)
3. Abort the calling operation (e.g., `/develop-feature` stops at current wave boundary)

The choice between (1), (2), (3) is the human's — `/consolidate` does not auto-resolve.

## Output (when /consolidate completes)

```markdown
## /consolidate Summary

**Verdict:** clean | maintenance-signals-only | findings-require-resolution
**Drift findings:** N (M critical, K major, J minor)
**Pattern observations:** P

### Drift findings
[verbatim from consolidator's report]

### Pattern observations
[verbatim — these are institutional memory for future features]

### Next step
- If clean: proceed
- If maintenance-only: recorded in scratchpad, proceed
- If findings: surfaced to human via AskUserQuestion; await decision
```

## Rules

The orchestrator (the main agent running `/consolidate`) follows `~/.claude/rules/cognitive-self-check.md` on the cycle-level claims it emits — e.g., "no drift detected" must be backed by consolidator's structured report, not by the orchestrator's reading of "looks fine." The per-finding fact-check is consolidator's responsibility.

## Relation to other commands

- `/develop-feature` — chains `/consolidate` automatically between waves in Phase 2. The auto-chain is non-blocking on maintenance-only findings; halts on critical/major findings per the protocol above.
- `/qa-cycle` — recommend invoking `/consolidate` before `/qa-cycle` if the current feature spans 3+ waves. Drift in the plan / test cases tends to surface as confusing FAIL/BLOCKED verdicts in `/qa-cycle` if left unresolved.
- `/merge-ready` — Gate 1 (Documentation Completeness) optionally invokes `/consolidate` as a soft pass. Informational only; cannot fail merge-readiness.
- `/reflect` — sibling but different. `/reflect` is unstructured DMN mode; `/consolidate` is structured drift detection. See `~/.claude/commands/reflect.md`.
