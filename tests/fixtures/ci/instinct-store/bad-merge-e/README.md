# Seeded fixture: bad-merge-e

Falsify control for `scripts/ci/validate-instinct-store.js`'s **class (e)** merge-artifact
detection. The file carries TWO `## Instincts Log` headings, each with one entry — the artifact a
`merge=union` merge leaves when both branches appended a section-tail entry and the union kept both
context runs. Before detection existed, `parseStore` silently appended the second heading's lines
into the first's array, so every downstream check read a folded store shape nobody wrote — which is
exactly why the reconciliation preamble folds duplicated headings FIRST, before any other repair.

Both entries are individually valid and their slugs are distinct, so the duplicated heading is this
fixture's only defect. Class (a) is seeded in `bad-merge-a`, separately — a duplicated counter and
a duplicated heading cannot be counted independently in one file.

## Expected result

`node scripts/ci/validate-instinct-store.js --root tests/fixtures/ci/instinct-store/bad-merge-e --min 1`
MUST fail with **exactly one** problem, naming the class (e) merge artifact.
