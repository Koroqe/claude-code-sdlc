## Feature: Adaptive Tier Routing and Model Routing (v4.0 roadmap F4)
## Branch: feat/adaptive-tier-routing
## Status: bootstrapping — architecture review FAIL, PRD revision in flight

## Docs

- PRD: `docs/PRD.md` §10 — FR-1..FR-13, AC-1..AC-22 (revision in flight)
- Use cases: `docs/use-cases/adaptive-tier-routing_use_cases.md` — UC-1..UC-18
- Architecture: **FAIL** — 3 CRITICAL, 5 MAJOR, 4 MINOR (all sent for revision; re-submit after)
- Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F4 of F1–F5)
- PRD §3 is `[SUPERSEDED]` and names F4 as its replacement — F4 must fulfil or explicitly discard each §3 FR

## Architecture objections — must all be closed before implementing

1. **CRITICAL — stale `## Tier: quick` after quick→full escalation.** FR-2.4 never rewrites the field,
   so `/merge-ready` reads `quick` and skips Gates 1/5/6/7/8. `session:start:spine` re-injects the
   stale value after compaction. Verified: `skills/bootstrap-feature/SKILL.md` has **zero** `Tier`
   mentions, so the field is inherited, never owned.
2. **CRITICAL — `/sdlc-fast` tool grant blocks its own mandated escalation.** Denied `Agent`, yet
   required to escalate into a tier needing `planner`/`test-writer`/`build-runner`. *This is the exact
   defect class that shipped twice in F3.* Fix: grant `Agent`, enforce no-subagent by instruction.
3. **CRITICAL — quick tier dead-ends on Gate 2.** Verified `agents/code-reviewer.md:41` requires
   "Test cases documented in `docs/qa/`", which quick tier never creates by design → Auto-Fix cannot
   fix it → 3 attempts → NOT MERGE READY. Same issue softer in `agents/test-writer.md:14`.
4. MAJOR — quick tier writes the changelog **twice** (no `no-changelog` token → slice writes, then
   merge-ready writes). Idempotency guard won't catch it; the names differ.
5. MAJOR — AC-7 arithmetically impossible: quality→budget changes **8** files, not 14.
6. MAJOR — FR-7.2 rewrite idiom unsafe: bare `mktemp` crosses filesystems; `s/^model:` unbounded to
   frontmatter; `sed && mv` succeeds on **zero** substitutions. `install.sh:539,589` already show the
   correct same-directory `mktemp` precedent.
7. MAJOR — quick tier has no mid-run escalation triggers (file count / sensitive path enforced at
   classification time only).
8. MAJOR — `## Sensitive Paths` **replaces** the default list (should union); plugin-propagation of
   `--profile` unverified (does a running session snapshot plugin content?).

MINORs: unreachable FR-13.3 condition; quick slice tracer marker mislabels via the legacy notice;
statusline must be stated zero-dependency; state Read-before-Edit so fast doesn't bounce off the guard.

## Architect rulings to NOT relitigate

- Triage FR-1.3/FR-1.4 signals are genuinely mechanical; FR-1.6's upward tie-break means every
  misjudgement fails toward `full`. A schema migration cannot reach `fast`.
- The statusline degrades visibly by construction; keep FR-13.6's no-reverse-dependency prohibition.
- The `install.sh` POSIX-shell rewrite **is** achievable and `sed -i` is correctly banned.
- §3 supersession is complete — all six §3 FRs have explicit dispositions.

## Budgets

agents 14/16 (F4 adds none) · skills 5→7 of 10 · hooks 10/12 (F4 adds none; statusline needs no hook)

## Next steps

1. Await PRD revision → **re-submit to `architect`** (retry 1 of 2 allowed)
2. On PASS → `qa-planner` → `planner` → plan-critic loop → implement
3. Security pre-reviews required: FR-2 escalation, `install.sh --profile` rewrite,
   FR-1.7 sensitive-path semantics, and the `/merge-ready` Tier Check preamble

## Blockers

- none (the architecture FAIL is an in-flight revision, not a blocker)

## Completed

- F1 (§6) merged 6e0c55e · F2a (§7) merged cbe586d · F2b (§8) merged 9cffb22 · F3 (§9) merged 2c7272d
- Defect fixes merged 19b29ce — falsify steps now assert their own reason (`--expect-failure`),
  fixture manifest links 52 QA cases to committed inputs (51 present, 1 recorded missing)
- All pushed; GitHub CI green, asset job at 39 steps
