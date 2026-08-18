# Fixture: verifier / rerun-existing-report  (TC-5.2)

`docs/verification/self-improvement-loop.md` is already present, carrying a **prior** run's verdict.
The case invokes `verifier` a second time for the same feature.

Expected: the same path is overwritten with the current run's verdict. No second file, no `-2` suffix,
no appended section. The report is per-feature and current-run — an append-only report would grow
without bound and make "the verdict" ambiguous, which is the failure this case exists to catch.

The committed copy is a real report rather than a synthetic stub, so an implementation that silently
appends produces a visibly malformed document with two YAML frontmatter blocks.
