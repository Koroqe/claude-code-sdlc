# Seeded fixture: bad-duplicate-number

Falsify control for `scripts/ci/validate-prd-numbering.js`. One defect: the
section number 3 appears twice (`## 3. Reporting Exports` and
`## 3. Notification Digests`) — the merge artifact produced when two parallel
feature sessions each allocate "next section number" from the same base and
both merges land. Everything else about the file is legal: five numbered
sections, well-formed headings.

The duplicate is by NUMBER, not by title — the two headings deliberately carry
different titles, because that is what the real collision looks like: two
different features, one number.

## Expected result

`node scripts/ci/validate-prd-numbering.js --root tests/fixtures/ci/prd-numbering/bad-duplicate-number --min 1`
MUST fail with **exactly one** problem naming the duplicated section number 3
and both heading line numbers.
