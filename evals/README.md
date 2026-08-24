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
