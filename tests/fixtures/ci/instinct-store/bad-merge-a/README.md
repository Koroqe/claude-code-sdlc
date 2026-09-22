# Seeded fixture: bad-merge-a

Falsify control for `scripts/ci/validate-instinct-store.js`'s **class (a)** merge-artifact
detection. `## Meta` carries TWO `Feature counter:` lines (12 and 14) — the artifact a
`merge=union` merge leaves when both branches incremented the counter. Before detection existed,
`sections.Meta.find(...)` silently half-read whichever line came first and every downstream check
reasoned from a counter nobody chose.

The single Prevention Rules entry is deliberately valid under BOTH counter values (retires at 21,
confirmed at 11), so the duplicated counter is this fixture's only defect. Class (e) is seeded in
`bad-merge-e`, separately — a duplicated counter and a duplicated heading cannot be counted
independently in one file.

## Expected result

`node scripts/ci/validate-instinct-store.js --root tests/fixtures/ci/instinct-store/bad-merge-a --min 1`
MUST fail with **exactly one** problem, naming the class (a) merge artifact.
