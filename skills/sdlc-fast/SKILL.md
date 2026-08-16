---
description: Explicit developer override — bypass Phase 0 Triage entirely and run the fast-tier (single trivial edit) execution path directly against the supplied description. FR-2 escalation still applies once running, so Agent is granted deliberately.
argument-hint: "<description>"
arguments: [feature]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent
---

# Command: SDLC Fast (Override)

**This is an override entry point, not the primary path.** The primary, autonomous path is **Phase 0: Triage** inside `skills/develop-feature/SKILL.md` — read it first if you have not already — which classifies every request into `fast`/`quick`/`full` on its own, with no human involvement. `/sdlc-fast` exists only so a developer can explicitly overrule that verdict and assert `fast` tier directly. It is never invoked by the pipeline itself, and no run needs it in order to complete (NFR-2) — it is a human-typed escape hatch, not a step in the normal flow.

## Arguments

The change to make is `$feature` (also available as `$ARGUMENTS`). When it is empty, ask the user what to change before doing anything else — do NOT infer a change from surrounding context.

## Literal-token activation only (FR-6.3)

This skill activates ONLY because it was literally invoked as `/sdlc-fast <description>` — an actually-invoked slash command, the same literal-token discipline already governing `no-changelog` and every other documented flag in this harness. A request's prose containing a word like "quick," "fast," "small," or "trivial," submitted as ordinary conversational text rather than this literal command, does NOT activate this skill and MUST still be classified by Phase 0 Triage in `skills/develop-feature/SKILL.md` unmodified — including being forced to `full` by one of its full-forcing signals if applicable. Nothing in this file infers activation from vocabulary; only the literal token does.

## What this bypasses, and what it does not (FR-6.2)

Invoking this skill skips Phase 0 Triage entirely: no estimated file set is stated as a classification input, no full-forcing/fast-tier/quick-tier signal check runs, and no `tier: ...` reasoning is produced or considered. The human asserts the tier; the pipeline does not compute it. **The override skips classification, never the safety rails** — FR-2's escalation rules (restated in full below, self-sufficiently, so this file never depends on `skills/develop-feature/SKILL.md` being read first for its own execution) still apply once this skill is running.

## Fast Tier Execution (FR-3) — run this directly against `$feature`

1. **State the estimated file set.** Before editing, state in your own response the specific file you expect this change to touch — exactly one file. This is required output: the escalation check below compares what actually happens against it.
2. **Direct edits, no subagents, no documentation (FR-3.1):** make the `Edit`/`Write` call directly to that one file. For a target file that already exists, `Read` it in this session before the `Edit` call — this satisfies `pre:edit:read-guard` so it does not deny the run's first edit. A `Write` creating a brand-new file requires no prior `Read`. Create or modify no `docs/PRD.md`, `docs/use-cases/*`, or `docs/qa/*` file for this change, and write no plan to `.claude/scratchpad.md`'s `## Plan` section.
3. **Verify with the project's own declared command (FR-3.2):** after editing, run the project's declared build/typecheck command directly via a `Bash` call — read the command from the project's CLAUDE.md, and no-op visibly when none is declared.
4. **Commit unchanged (FR-3.3):** follow `src/rules/git.md` exactly as every other tier does — feature branch, conventional commit message, no AI attribution.
5. **Changelog — mandatory, sole owner (FR-3.4):** after a successful commit, write ONE `CHANGELOG.md` entry directly, following the standalone-fix procedure `skills/implement-slice/SKILL.md` Step 6 already defines (real `date -u +'%Y-%m-%d %H:%M'` timestamp, idempotency guard, Summary + Details capped at 500 characters). No `/merge-ready` run occurs for `fast` tier, so this write is never suppressed by a `no-changelog` flag and is owned by nothing downstream — skipping it is not an option.
6. **No scratchpad write (FR-3.5):** a `fast`-tier run that does not escalate does not write to `.claude/scratchpad.md` at all — there is no multi-step state to persist.

## The `Agent` grant is deliberate — the no-subagent rule is instruction-enforced, not structural (C2, binding — never tighten)

`allowed-tools` above grants `Agent`, **deliberately**. This is load-bearing, not an oversight: FR-2.1's mandated `fast` → `quick` escalation requires invoking `planner`, `test-writer`, and `build-runner` — all `Agent` calls. An earlier draft withheld `Agent` to enforce step 2's "no subagent" rule structurally — but that would dead-end the run at the exact moment an `/sdlc-fast` edit needed a second file: there would be no tool left capable of invoking `planner` to escalate, an unrecoverable stall that directly violates the autonomy contract (NFR-1(b)) this override skill must still honor. **Withholding `Agent` is therefore not an option — the grant stays, and it is not a mistake to fix.**

Because of that, the "no subagent" rule for the ordinary, **non-escalated** fast path (step 2 above, FR-3.1) is enforced **by instruction in this file's body, not by the tool grant** — this is explicitly NOT a structural guarantee, the same model-discipline posture the rest of this feature's tier-boundary enforcement already accepts (FR-2.7). Follow it exactly: make zero `Agent`/`Task` tool calls while genuinely operating under `fast`-tier discipline. The only thing permitted to issue an `Agent` call from this skill is the escalation mechanics below, and only once one of their triggers actually fires.

## Escalation: One-Way Tier Changes (FR-2) — restated self-sufficiently

FR-2's escalation rules still apply once this skill is running — the override skips Phase 0 Triage's classification, never these rules. Both transitions below share three properties: every trigger is checked BEFORE the `Edit`/`Write` call that would fire it, never after that call has already been made; escalation moves in exactly one direction, `fast` → `quick` → `full`, never sideways and never back down; and at `full` — the escalation ceiling — the pipeline's existing Rule 4 stop-and-ask behavior from `src/rules/error-recovery.md` is preserved unmodified rather than redirected.

### Fast → Quick (FR-2.1)

Check BEFORE issuing each `Edit`/`Write` call — never after it has already been made — whether that call would target:
- a file outside the estimated file set stated in step 1 above, OR
- a path the sensitive-path defaults mark sensitive: any path containing `auth`, `payment`, `billing`, `secret`, or `migration` as a path segment (case-insensitive); any path under `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`; plus any additional glob a project's `.claude/rules/security.md` declares under a `## Sensitive Paths` section — union, never a replacement of the fixed defaults, and never capable of narrowing them.

If either is true, do NOT make that call under fast-tier discipline. Escalate to `quick` first:

1. **State the escalation, verbatim, naming the second file or the sensitive path.**
2. **Keep the edits already made.** Never revert an already-made edit solely because of the escalation.
3. **Record the done work.** Set `.claude/scratchpad.md`'s `## Tier: quick` and a `## Feature:` name, recording the already-touched file as already-completed context — using `Edit` if the scratchpad already exists, `Write` only if it does not (see the scratchpad-mutation idiom below).
4. **Proceed under Quick Tier Execution (FR-4)** for the remainder of the work: invoke `planner` exactly once under its Quick-Tier Contract mode, write the returned slice into `.claude/scratchpad.md`'s `## Plan` section as a single un-waved slice — with the already-touched file included in its `Files:`/`Changes:` fields as work already done — run `/implement-slice` against it with the literal `no-changelog` token, then run `/merge-ready` under its tier-aware gate subset.

### Quick → Full (FR-2.2)

Once escalated to `quick` above, escalate again to `full` — overriding whatever default behavior the triggering condition would otherwise have — when EITHER:
- **(a)** a Rule 4 condition (`src/rules/error-recovery.md` — an architectural decision, a new dependency, an API contract change, a schema migration) is encountered during the TDD cycle. Do NOT stop and ask at `quick` tier — redirect to `full` instead; OR
- **(b)** an `Edit`/`Write` call about to be made — checked BEFORE issuing it, exactly as the fast→quick trigger above requires — would target a path the sensitive-path defaults above mark sensitive, or would bring the count of distinct files touched by this run's own `Edit`/`Write` calls above 3.

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

Once a tier is assigned — by this skill's own override, or by either escalation above — it MUST NOT be automatically lowered for the remainder of that run, regardless of what later evaluation of actual scope suggests.

### The scratchpad-mutation idiom: Edit, never a whole-file Write

Every mutation of an **existing** `.claude/scratchpad.md` — the fast→quick tier/plan initialization above, the quick→full tier rewrite above, and `planner`'s DONE-with-commit-hash recording — MUST use **Edit, never a whole-file Write**. `pre:write:shrink-guard` fires on `Write` only and denies a short new file replacing a long, pre-existing one, with no mid-session escape (`SDLC_ALLOW_SHRINK=1` is an environment variable, unavailable mid-session). This idiom applies only when `.claude/scratchpad.md` already exists — a genuinely nonexistent scratchpad (the first-ever-feature case) legitimately uses `Write`, since that targets a file that does not yet exist and is therefore outside the guard's scope.

## Rules

- NEVER add "Co-Authored-By" or AI attribution to commits.
- NEVER infer this skill's activation from a request's prose — only the literal `/sdlc-fast` token activates it (FR-6.3).
- NEVER issue an `Agent`/`Task` tool call while genuinely operating under non-escalated `fast`-tier discipline — the grant above exists solely to make the FR-2.1 escalation possible, not to invite subagent use in the ordinary case.
- ALWAYS state the tier's escalation trigger, verbatim, before making the triggering call — never after.
