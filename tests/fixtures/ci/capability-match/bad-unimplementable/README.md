# Seeded fixture: bad-unimplementable

Falsify control for `scripts/ci/validate-capability-match.js`. Both defects below are faithful
reproductions of instructions that **actually shipped to `main`** and were caught by human review
rather than by any mechanism:

- `agents/verifier.md` — told to stamp its report by running `date -u`, while `tools:` grants no
  `Bash`. Shipped in F3.
- `agents/planner.md` — told to append its finished plan to `.claude/scratchpad.md`, while `tools:`
  grants neither `Write` nor `Edit`. Shipped in F3.

Both fail the same way at runtime, and it is the worst possible way: the agent cannot perform the
step, so it silently does not, and the run reports success. Nothing is logged, because nothing
errored — the instruction was simply unfollowable.

`agents/architect.md` and `skills/develop-feature/SKILL.md` are unmodified copies of the real files
and must NOT be flagged, proving the check isolates to the files carrying the defect instead of
tripping on every agent that merely mentions a tool.

## Expected result

`node scripts/ci/validate-capability-match.js --root tests/fixtures/ci/capability-match/bad-unimplementable --min 1`
MUST fail with **exactly two** problems, naming `agents/verifier.md` (missing `Bash`) and
`agents/planner.md` (missing `Edit`), and no others.
