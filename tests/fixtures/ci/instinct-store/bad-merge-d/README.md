# Seeded fixture: bad-merge-d

Falsify control for `scripts/ci/validate-instinct-store.js`'s **class (d)** merge-artifact
detection. The single entry carries TWO `Confidence:` lines (0.3 and 0.5) — the artifact a
`merge=union` merge leaves when both branches touched the same field of the same entry (one branch
decayed it, the other confirmed it). Before detection existed, `entriesOf` silently kept whichever
line came last, erasing one branch's decay or confirmation without a trace.

Both values are individually legal for this entry (occurrences 2 puts the formula ceiling at 0.5,
and decay may legitimately sit below it), so the duplicated field line is this fixture's only
defect — neither value trips the arithmetic checks.

## Expected result

`node scripts/ci/validate-instinct-store.js --root tests/fixtures/ci/instinct-store/bad-merge-d --min 1`
MUST fail with **exactly one** problem, naming the class (d) merge artifact.
