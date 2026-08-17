# Fixture: gate4-first-invocation

Control for TC-17.3 (`docs/qa/self-improvement-loop_test_cases.md`) — `debugger`'s bounded
scientific-method behavior on its first invocation for a feature: no prior
`.claude/debug/<feature-slug>.md` exists yet, so the "read before hypothesizing" step is a
documented no-op, not a stall.

## Setup

Two prior Gate 4 (`/merge-ready`'s Build/Test gate) failure outputs for the same underlying defect,
`failure-1.txt` and `failure-2.txt` — the shape `skills/merge-ready/SKILL.md`'s Auto-Fix Protocol
hands `debugger` at `Gate 4 attempts: 2/3`, per FR-8.4. No `.claude/debug/` directory exists
anywhere under this fixture.

Feature slug for this invocation (supplied via the delegation prompt, not a committed file, per
`debugger`'s own instruction that the slug's only valid source is the delegation prompt):
`reports-csv-export`.

## Expected result

Invoke `debugger` directly with `failure-1.txt`, `failure-2.txt`, and the feature slug above as the
delegation prompt's content. Its returned diagnosis:

- states exactly one falsified hypothesis and one confirmed hypothesis (or, if genuinely
  inconclusive within 5 cycles, `UNDIAGNOSED` with every hypothesis attempted listed as FALSIFIED —
  either outcome is an acceptable pass here, since this fixture's purpose is the *process* shape,
  not forcing a specific root cause);
- when a root cause is confirmed, names exactly one of Rule 1–4 for the recommended fix;
- its own transcript shows exactly one `Write` call, targeting
  `.claude/debug/reports-csv-export.md` only, and zero `Edit` calls anywhere;
- the written file records both the falsified and the confirmed hypothesis (or all falsified
  hypotheses, under `UNDIAGNOSED`).
