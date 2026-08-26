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
- `tier:\s*full` did not match `` tier: `full` ``, because `\s` does not span a backtick. A run that
  stated **Step 7 — tier: `full` — FR-1.3(a), new API route/endpoint** — fully compliant, correct
  signal, correct routing — was scored as never having stated a tier at all. The same pattern backed
  the *negative* grader, where the miss is worse: `` tier: `quick` `` would have slipped past "did not
  take a cheap tier" and passed vacuously. Tier patterns now tolerate markdown emphasis
  (`tier:[`*_\s]*full`), and the real transcript is pinned as a unit test.
- `tool_used: Skill` on the full-tier case graded **one path to the rule instead of the rule**. The
  full-tier branch of `src/claude.md` mandates the Phase 1 *deliverables* (`docs/PRD.md`,
  `docs/use-cases/*`) and names the agents that produce them; it never mandates a literal skill
  invocation. The run scored as a routing failure had stated `tier: full` with the correct FR-1.3
  signals and written both documents inline — it complied. Use `any_of` when a rule is satisfiable
  more than one legitimate way.

Running tally: **nine false negatives from this suite, zero true findings from a grader bug.** The
harness was right every time. That is the calibration to carry into reading any failure here.

## Five measured traps, all of which produced false results before being fixed

1. **A sandboxed `HOME` silently destroys the run.** Isolating `HOME` to seed a private memory layer
   also strips the CLI's credentials: every case exits in ~1 s with `Not logged in`, and the suite
   reports a confident `0/4` that is purely an artifact. The runner therefore uses the real `HOME`
   and gates on the freshness check above instead.
2. **A too-tight `maxTurns` manufactures defects.** At `maxTurns: 2`, two cases failed
   `protocol: stated a tier` — not because Triage misfired, but because the run was cut off before it
   spoke. At `maxTurns: 6` both pass. **Before believing a failure, raise the budget and re-run.**

3. **`timeoutSeconds` must be raised whenever `maxTurns` is.** Raising `maxTurns` from 6 to 10 pushed
   a case's runs past the 240 s default timeout. The killed run produced no transcript, so every
   content grader reported "absent" and the case printed two confident behavioural failures whose
   real cause was the `ETIMEDOUT` line underneath them. A killed run is now reported as
   `INCONCLUSIVE — run errored, not graded` and is never graded at all: it cannot pass, and it must
   not pretend to explain itself.
4. **Headless `claude -p` grants the Agent tool inconsistently.** One run stated plainly *"This
   session forbids me from calling the Agent tool"* and produced the full-tier deliverables inline;
   a later run on the same case used `Agent` without trouble. There is no deny rule in
   `~/.claude/settings.json` — availability simply varies per run. A grader that requires an agent to
   be spawned is therefore measuring the sandbox on some runs and the harness on others, which is the
   worst of both. Grade the artifact the agent would have produced.

5. **Headless `-p` denies `Write` to the sandbox project on some runs**, and not on others. A run that
   took the documentation-first path correctly, calling `Write` on `docs/PRD.md` twice, produced no
   file: *"Write access to the project directory isn't granted."* A `file_written` grader sees an
   empty directory and reports non-compliance. **Grade the attempt, not only the effect** — whether
   the sandbox permits a write is the environment's business; which path the harness steered the
   agent onto is the thing under test.

   The same denial makes a `not_contains` effect grader pass **for the wrong reason**: the file is
   absent because the sandbox blocked the write, not because the harness refused it. That is worse
   than a false negative — it is a green that is not evidence. Both negative cases
   (`skill-tracer-gate-refuses`, `triage-fast-copy-fix`) therefore also assert the forbidden write was
   never *attempted*, via `tool_used` with `tool: "Write|Edit"` and `max: 0`.

### Every case needs a positive assertion

Both of the false positives above have the same root: a **negative** grader
(`not_contains`, `max: 0`, `no_edits`) passes when the environment removed the
capability, not only when the harness declined to use it. A case built entirely
from negatives cannot distinguish compliance from a dead run — and it fails in the
reassuring direction, which is worse than failing loudly.

So every case carries at least one **positive** assertion that a degraded run
cannot satisfy, and that rule is mechanized: `tests/hooks/test-eval-graders.js`
audits `evals/cases/*/case.json` on every sweep and fails a case that is all
negatives.

All five traps share a shape worth remembering: the harness under test was fine; the *instrument* was
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
