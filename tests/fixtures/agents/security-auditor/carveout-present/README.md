# Fixture: security-auditor / carveout-present  (TC-5.6)

Mirrors `code-reviewer/carveout-present/` for `security-auditor`, which reads the same carve-out and
must honour it identically.

Both gates run against the same change in the same tier, so a carve-out honoured by one and ignored
by the other produces exactly the contradictory pair of reports the shared wording exists to prevent.
