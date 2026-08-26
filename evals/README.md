# Behavioural evals

Everything else in this repo checks **structure** (16 validators) or **hook logic** (22 test files).
Nothing checked that the instructions the harness ships actually *steer a real session*. This does.

```bash
node scripts/eval/run-evals.js            # all cases (COSTS MONEY — real model calls)
node scripts/eval/run-evals.js triage-    # name-prefix filter
node scripts/eval/run-evals.js --dry-run  # show the plan, spend nothing
```

Results land in `evals/results/<timestamp>.json` (gitignored — they are run artifacts, not
knowledge; the durable numbers belong in `docs/findings/`).

## Why this exists

The research behind it is recorded in `docs/findings/harness-optimization-research.md`. The single
finding that drove building it: **every measured win in the agentic-harness literature came from a
deterministic external oracle in the loop, and every negative result came from a model judging
itself.** A harness with no oracle cannot tell an improvement from a regression — it can only argue.

## Design rules, each one paid for

- **Deterministic graders only.** No LLM judge. Costly, flaky, and unnecessary — the behaviours worth
  pinning (did Triage state a tier? which one? did it edit before deciding?) are exactly expressible
  as regex/tool assertions.
- **Two-metric grading**, borrowed from Aider's leaderboard, which reports `percent_cases_well_formed`
  alongside pass rate. Graders are split into `protocol:` (did the agent follow the contract at all)
  and `correctness:` (was the answer right). These fail for different reasons and only the first is
  unambiguously *our* bug.
- **The grading logic is unit-tested for free.** `tests/hooks/test-eval-graders.js` runs in the normal
  sweep with no model calls, and every grader type has a **seeded-broken** case proving it can fail.
  A grader that only ever passes is not evidence.
- **The runner refuses to run against a stale memory layer.** It compares the installed
  `~/.claude/claude.md` against `src/claude.md` and aborts if they differ, because otherwise you are
  measuring the old text and will not know it. This caught a real drift the first time it ran.

## Cases run N times, and a case is green only when every run is

`runs` in `case.json` (default 1; the shipped cases use 2-4). The suite reports `k/N run(s)` and a
case passes only when `k == N` — a gating rule that holds two times in three is not holding.

This was not the original design and it earned its place immediately: `skill-tracer-gate-refuses`
failed on one run and passed on the very next with identical inputs. A single-run suite reports that
as PASS or FAIL by coin flip, which is worse than useless for deciding whether a change helped — the
one question this eval exists to answer. When a case fails, the runner now also saves the failing
run's `assistantText` and `toolUses` into the results JSON, because twice the only way to tell a real
finding from a starved run was to read the transcript.

## Grade the rule as written, not a proxy for it

Every false result this suite has produced came from a grader encoding something subtly different
from the rule:

- `no_edits` on the tracer-gate case failed a run where the model refused **correctly** and then
  recorded the blocker in the scratchpad — behaviour the harness's own scratchpad rule *requires*.
  The rule is "no TDD work on slice 2", so the grader is now `file_written: src/format.js,
  not_contains`.
- Grading merge-ready's final `SKIPPED (tier: quick)` table failed purely on the turn budget: the
  table prints only after every gate finishes. The tier decision is observable much earlier in
  *which agents run*, so the grader now checks that instead.
- `tool_used` with `max: 0` — the must-not-be-used idiom — was unsatisfiable, because `min` defaulted
  to 1 and the grader asked for "1..0". Two cases reported a confident 0/3 from this alone.

Running tally: **five false negatives from this suite, zero true findings from a grader bug.** The
harness was right every time. That is the calibration to carry into reading any failure here.

## Two measured traps, both of which produced false results before being fixed

1. **A sandboxed `HOME` silently destroys the run.** Isolating `HOME` to seed a private memory layer
   also strips the CLI's credentials: every case exits in ~1 s with `Not logged in`, and the suite
   reports a confident `0/4` that is purely an artifact. The runner therefore uses the real `HOME`
   and gates on the freshness check above instead.
2. **A too-tight `maxTurns` manufactures defects.** At `maxTurns: 2`, two cases failed
   `protocol: stated a tier` — not because Triage misfired, but because the run was cut off before it
   spoke. At `maxTurns: 6` both pass. **Before believing a failure, raise the budget and re-run.**

Both traps share a shape worth remembering: the harness under test was fine; the *instrument* was
broken, and it failed in the direction that looks like a real finding.

## Adding a case

`evals/cases/<name>/case.json`:

```json
{
  "prompt": "the request, exactly as a user would type it",
  "maxTurns": 6,
  "seed": { "path/in/temp/project.md": "file contents" },
  "graders": [
    { "name": "protocol: stated a tier", "type": "regex", "pattern": "tier:\\s*(fast|quick|full)" },
    { "name": "correctness: tier is fast", "type": "regex", "pattern": "tier:\\s*fast" }
  ]
}
```

Grader types: `regex` (`target`: `assistant`|`final`|`tools`, `match`: `contains`|`not_contains`),
`tool_used` (`tool`, `input_match`, `min`, `max`), `no_edits`, `file_written`.

Each case runs in a throwaway project directory seeded from `seed`; the real repo is never touched.
