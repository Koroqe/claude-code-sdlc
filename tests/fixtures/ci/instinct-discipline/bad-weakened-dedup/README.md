# Seeded fixture: bad-weakened-dedup

Falsify control for `scripts/ci/validate-instinct-discipline.js` — the sibling of `bad-weakened`,
covering the validator's **other** arm. `bad-weakened` proves the FR-6.2a check fires; nothing proved
the C3/FR-1.5a dedup check fires, so that arm could have rotted into a permanent pass unnoticed. This
fixture closes that hole.

A passing mirror of every file the validator opens (`agents/planner.md`,
`skills/implement-slice/SKILL.md`, `skills/merge-ready/SKILL.md`) except one deliberate defect:
`skills/implement-slice/SKILL.md`'s pre-capture dedup scan matches on `Pattern:` **or** `Category:`
rather than requiring **both**.

The OR form is chosen deliberately over simply deleting the clause. Deletion is the loud failure the
first error arm already catches by absence; an AND silently relaxed to OR still reads as a complete,
well-formed dedup scan to a human skimming the diff, while fragmenting occurrence counts across
near-duplicate headings so that nothing ever elevates or retires. That is the realistic regression.

## Contents

- `skills/implement-slice/SKILL.md` — trimmed mirror of the real file's "Capture Instincts" step, with
  the dedup scan's `Pattern:` **and** `Category:` **both match** relaxed to `Pattern:` **or**
  `Category:` **either matches**. This is the ONE deliberate defect.
- `agents/planner.md` — trimmed mirror of the real file's Process section through step 3, with the
  FR-6.2a paragraph present and UNCHANGED (unlike `bad-weakened`, where its removal is the defect).
- `skills/merge-ready/SKILL.md` — trimmed mirror of the real file's "Post-Gate Instinct Capture" step,
  including the C3/FR-1.5a dedup clause UNCHANGED.

## Expected result

`node scripts/ci/validate-instinct-discipline.js --root tests/fixtures/ci/instinct-discipline/bad-weakened-dedup --min 1`
MUST fail with **exactly one** problem, naming `skills/implement-slice/SKILL.md` and the `both match`
requirement — and MUST NOT report any finding against `agents/planner.md` (proving the restored FR-6.2a
clause passes) or against `skills/merge-ready/SKILL.md` (proving the failure isolates to the one file
that actually carries the defect, rather than tripping every dedup consumer at once).
