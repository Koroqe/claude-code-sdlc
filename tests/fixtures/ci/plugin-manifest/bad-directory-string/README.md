# Seeded fixture: bad-directory-string

Falsify control for `scripts/ci/validate-plugin-manifest.js`, reproducing the exact defect that
shipped in v4.0.0 and made the plugin **uninstallable for every user**:

    "agents": "./agents/"

Claude Code's plugin schema rejects a directory string for `agents`. `claude plugin install` failed
with `agents: Invalid input` and refused the plugin outright, so all 15 agents, 7 skills and the hook
set were unreachable to anyone who tried to install it.

It shipped because the F1 acceptance criterion — "`claude plugin validate .` exits 0" — is vacuous as
written. Pointed at a directory, that command validates `marketplace.json` and never opens
`plugin.json`. It printed "Validation passed" for a file it had not read, and the criterion was
hand-checked once rather than mechanized, so no CI step ever ran it.

This fixture keeps `"skills": "./skills/"` as a directory string deliberately. Measured against
`claude plugin validate` one key at a time, `skills` accepts both a string and an array while only
`agents` rejects the string form — so the fixture also proves the validator does **not** over-flag a
shape that is genuinely legal.

## Expected result

`node scripts/ci/validate-plugin-manifest.js --root tests/fixtures/ci/plugin-manifest/bad-directory-string --min 1`
MUST fail with **exactly one** problem, naming `agents` and the `Invalid input` failure — and must not
flag `skills`.
