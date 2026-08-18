Delegate to `build-runner` for slice verification.

**Scope carve-out:** this feature ships no `docs/qa/*` file, deliberately. Do NOT report its absence as a finding — the tier that produced this change does not generate QA documents.

Slice under verification:

- **Verify:** `node scripts/ci/validate-agents.js && node tests/hooks/run-tests.js`
- **Done when:** both commands exit 0 and no agent file reports a frontmatter problem.
