# Seeded fixture: bad-missing-class

Falsify control for `scripts/ci/validate-instinct-discipline.js`'s Merge Reconciliation class
assertion (parallel-features S7). Extending the validator to require that
`skills/merge-ready/SKILL.md`'s preamble names all five reconciliation classes (a)-(e) is a check
with no proof it can fail until a fixture omits one — the house rule this repo enforces on every
validator.

## Contents

- `skills/merge-ready/SKILL.md` — a trimmed mirror authored from the implementation plan's
  canonical class list (never copied from the real file — that independence is what keeps the S6
  prose and the S7 check free of a circular dependency). It passes every pre-existing discipline
  check — the C3/FR-1.5a dedup clause is present and UNCHANGED — and its Merge Reconciliation
  preamble names classes (a), (b), (c) and (e). The ONE deliberate defect: the class (d) bullet
  (duplicate field lines within one entry → keep the repaired value, drop duplicates) has been
  removed, and nothing else is changed.

The other two discipline files (`agents/planner.md`, `skills/implement-slice/SKILL.md`) are
deliberately absent; the falsify step runs with `--min 1`, so the assertion under test is the
merge-ready class check alone.

## Expected result

`node scripts/ci/validate-instinct-discipline.js --root tests/fixtures/ci/instinct-discipline/bad-missing-class --min 1`
MUST fail with **exactly one** problem, naming `skills/merge-ready/SKILL.md` and class (d) — and
MUST NOT report the dedup clause or any other class, proving the failure isolates to the one
dropped bullet.
