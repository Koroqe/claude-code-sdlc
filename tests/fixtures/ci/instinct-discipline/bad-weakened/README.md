# Seeded fixture: bad-weakened

Falsify control for `scripts/ci/validate-instinct-discipline.js` — a passing mirror of every file the
validator opens (`agents/planner.md`, `skills/implement-slice/SKILL.md`, `skills/merge-ready/SKILL.md`)
except one deliberate defect: `agents/planner.md`'s entire FR-6.2a — attach-time validation, binding
paragraph has been removed, as if a later, unrelated edit had quietly trimmed it away six months after
this feature's security pre-review approved it.

## Contents

- `agents/planner.md` — trimmed mirror of the real file's Process section, through step 3, with the
  FR-6.2a paragraph removed. This is the ONE deliberate defect.
- `skills/implement-slice/SKILL.md` — trimmed mirror of the real file's "Capture Instincts" step,
  including the C3/FR-1.5a dedup clause UNCHANGED.
- `skills/merge-ready/SKILL.md` — trimmed mirror of the real file's "Post-Gate Instinct Capture" step,
  including the C3/FR-1.5a dedup clause UNCHANGED.

## Expected result

`node scripts/ci/validate-instinct-discipline.js --root tests/fixtures/ci/instinct-discipline/bad-weakened --min 1`
MUST fail, naming `agents/planner.md` and the missing "FR-6.2a" clause — and MUST NOT report any
finding against either capture surface, proving the failure isolates to the one file with the actual
defect.
