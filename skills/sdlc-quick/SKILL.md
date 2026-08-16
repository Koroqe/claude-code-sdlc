---
description: Explicit developer override — bypass Phase 0 Triage entirely and run the quick-tier execution path directly against the supplied description: planner's Quick-Tier Contract, one /implement-slice run under the no-changelog token, then /merge-ready's reduced gate subset.
argument-hint: "<description>"
arguments: [feature]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: SDLC Quick (Override)

**This is an override entry point, not the primary path.** The primary, autonomous path is **Phase 0: Triage** inside `skills/develop-feature/SKILL.md` — read it first if you have not already — which classifies every request into `fast`/`quick`/`full` on its own, with no human involvement. `/sdlc-quick` exists only so a developer can explicitly overrule that verdict and assert `quick` tier directly. It is never invoked by the pipeline itself, and no run needs it in order to complete (NFR-2) — it is a human-typed escape hatch, not a step in the normal flow.

## Arguments

The change to make is `$feature` (also available as `$ARGUMENTS`). When it is empty, ask the user what to build before doing anything else — do NOT infer a change from surrounding context.

## Literal-token activation only (FR-6.3)

This skill activates ONLY because it was literally invoked as `/sdlc-quick <description>` — an actually-invoked slash command, the same literal-token discipline already governing `no-changelog` and every other documented flag in this harness. A request's prose containing a word like "quick," "fast," "small," or "trivial," submitted as ordinary conversational text rather than this literal command, does NOT activate this skill and MUST still be classified by Phase 0 Triage in `skills/develop-feature/SKILL.md` unmodified. Nothing in this file infers activation from vocabulary; only the literal token does.

## What this bypasses, and what it does not (FR-6.2)

Invoking this skill skips Phase 0 Triage entirely: no estimated file set is stated as a classification input, no full-forcing/fast-tier/quick-tier signal check runs, and no `tier: ...` reasoning is produced or considered. The human asserts the tier; the pipeline does not compute it. **The override skips classification, never the safety rails** — FR-2.2's quick→full escalation rules still apply once this skill is running (see below).

## Quick Tier Execution (FR-4) — run this directly against `$feature`

1. **The one subagent (FR-4.1):** invoke `planner` exactly once, under its Quick-Tier Contract mode, with the plain description `$feature` — no PRD section, use-cases file, QA file, or architecture review supplied, since none exist for a `quick`-tier change. `planner` returns exactly one slice, in the standard `Files:`/`Changes:`/`Verify:`/`Done when:` format, with no `**Tracer:** yes` marker — a `quick`-tier single slice is exempt from the tracer-first requirement by design.
2. **The one plan file (FR-4.2):** write that one slice into `.claude/scratchpad.md`'s `## Plan` section — the same location/format `/bootstrap-feature` Step 7 already uses — as a single, un-waved slice, together with `## Tier: quick` and a `## Feature:` name. Use `Edit` if the scratchpad already exists, `Write` only if it does not — every mutation of an existing `.claude/scratchpad.md` MUST use `Edit`, never a whole-file `Write`, since `pre:write:shrink-guard` fires on `Write` only and denies a short new file replacing a long pre-existing one (`skills/develop-feature/SKILL.md`'s Escalation section documents this idiom in full).
3. **TDD, and the mandatory `no-changelog` token (FR-4.3):** run `/implement-slice` against this one slice, **passing the literal `no-changelog` token**. This token is mandatory, not optional: without it, `/implement-slice` Step 6 would write a standalone changelog entry under its own name while `/merge-ready`'s Finalization step would separately write a second entry under the feature's own name for the same unit of work — two entries where the exactly-once changelog ownership rule requires one. `test-writer` writes tests first, the model implements, `build-runner` verifies, and the slice commits per `src/rules/git.md` — otherwise unmodified from `/implement-slice`'s documented flow, except that Pre-flight Check 4 (confirm `docs/qa/*`/`docs/use-cases/*` exist) is skipped because `## Tier: quick` is set, and `test-writer`'s delegation states the QA-absence carve-out verbatim.
4. **Reduced quality gates (FR-4.6/FR-4.7):** after the slice commits, run `/merge-ready`. Its Tier Check preamble reads `.claude/scratchpad.md`'s `## Tier: quick` field and runs the reduced gate subset — Gate 0 (Git Hygiene), Gate 2 (Code Review), Gate 3 (Security Audit), Gate 4 (Build Verification) — reporting Gate 1, Gate 5, Gate 6, Gate 7, and Gate 8 as `SKIPPED (tier: quick)`. `/merge-ready` owns the single changelog entry for this change via its own Finalization step, never `/implement-slice` Step 6, which the `no-changelog` token suppressed in step 3 above.

## Escalation: Quick → Full still applies (FR-2.2)

FR-2's escalation rules are not bypassed by this override — only Phase 0 Triage's classification is. While executing Quick Tier Execution above, escalate to `full` — overriding whatever default behavior the triggering condition would otherwise have — when EITHER:
- **(a)** a Rule 4 condition (`src/rules/error-recovery.md` — an architectural decision, a new dependency, an API contract change, a schema migration) is encountered during step 3's TDD cycle. Do NOT stop and ask at `quick` tier — redirect to `full` instead; OR
- **(b)** an `Edit`/`Write` call about to be made — checked BEFORE issuing it, never after — would target a path the fixed sensitive-path defaults mark sensitive: any path containing `auth`, `payment`, `billing`, `secret`, or `migration` as a path segment (case-insensitive); any path under `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`; plus any additional glob a project's `.claude/rules/security.md` declares under `## Sensitive Paths` (union, never a replacement) — or would bring the count of distinct files touched by this run's own `Edit`/`Write` calls above 3.

Mechanics, once either condition fires:

1. **State the escalation, verbatim, naming the specific condition that fired.**
2. **Keep the quick-tier commit(s).** Any already-committed `quick`-tier slice commit remains in place, never reverted.
3. **Rewrite the tier field — the very first tool call after the escalation statement.** Use `Edit` (never a whole-file `Write`) to change `.claude/scratchpad.md`'s `## Tier:` field from `quick` to `full`, immediately, before any further gate or agent invocation. This ordering is load-bearing: without it, `/merge-ready`'s Tier Check preamble would read the stale `quick` value and silently run the reduced gate subset — skipping Gates 1, 5, 6, 7, and 8 — on a feature this escalation requires to get all 9 gates.
4. **Invoke `/bootstrap-feature`** for the full, now-larger scope, supplying the already-completed work as context, so `prd-writer`/`ba-analyst`/`architect`/`qa-planner` document it accurately rather than purely prospectively.
5. **`planner` marks the already-satisfied slice DONE** with its existing commit hash in the resulting plan — never re-implemented.
6. **Proceed through the remaining slices and an unmodified, full 9-gate `/merge-ready`** — indistinguishable at completion from a request classified `full` from the start.

### `full` is the escalation ceiling (FR-2.5)

A Rule 4 condition encountered while already at `full` tier retains today's unmodified behavior: stop implementation, present to the user, and count against the retry budget. There is no higher tier to redirect to.

### No automatic downgrade, ever (FR-2.6)

Once escalated to `full`, the run MUST NOT be automatically lowered back to `quick` for the remainder of the run, regardless of what later evaluation of actual scope suggests. A `quick`-tier run that turns out to touch only 1 file still completes at `quick` — never re-triage mid-run, and never report a gate `SKIPPED` for tier reasons on a run that was never actually at that lower tier.

## Rules

- NEVER add "Co-Authored-By" or AI attribution to commits.
- NEVER infer this skill's activation from a request's prose — only the literal `/sdlc-quick` token activates it (FR-6.3).
- ALWAYS pass the literal `no-changelog` token to `/implement-slice` in step 3 — `/merge-ready` is the sole changelog owner for this run.
- ALWAYS state the escalation trigger, verbatim, before making the triggering call — never after.
