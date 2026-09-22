# Seeded fixture: good-moved-section-gap

Positive control for `scripts/ci/validate-prd-numbering.js`, proving the
`max + 1` half of `agents/prd-writer.md`'s allocation rule. The seeded state:
section 7 was renamed and moved into section 4, vacating its number — the file
runs 1-6, 8, 9 with a gap at 7.

Two things this fixture proves:

1. **A gap is legal.** The validator MUST pass this file. A vacated number is
   the designed trace of a rename, not a defect: flagging it would force
   gap-refill, which is exactly the behaviour the allocation rule forbids,
   because cross-references (use-case headers, QA headers, digest rows) key on
   section numbers and refilling a vacated one silently repoints them.
2. **Allocation is `max + 1`, never gap-refill.** Applying the rule to this
   file, the next section number is `max(1..6, 8, 9) + 1 = 10` — the vacated
   7 is never reallocated.

This control goes red if the validator ever starts demanding contiguous
numbering.

## Expected result

`node scripts/ci/validate-prd-numbering.js --root tests/fixtures/ci/prd-numbering/good-moved-section-gap --min 1`
MUST pass: 8 numbered headings, zero problems, the gap at 7 unflagged.
