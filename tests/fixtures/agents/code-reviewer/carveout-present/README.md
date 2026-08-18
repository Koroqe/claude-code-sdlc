# Fixture: code-reviewer / carveout-present  (TC-5.5)

Delegation prompt carrying the scope carve-out **verbatim**, followed by a clean diff, with **no**
`docs/qa/*` file present in the tree.

The carve-out exists because a tier that produces no QA document would otherwise be reported as
having a missing QA document on every single run — a finding that is always true, never actionable,
and trains the operator to ignore the reviewer. Expected: the reviewer does NOT raise the absent QA
file.
