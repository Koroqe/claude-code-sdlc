# Seeded Good Fixture — Documented Placeholders Only

This file is the positive control for `validate-personal-paths.js`: it contains
home-directory-shaped strings that are explicitly allowlisted placeholders, so
the validator must PASS on it. If it ever fails here, the allowlist regressed.

Example: put the repo at /Users/you/projects/claude-code-sdlc, or on Linux at
/home/username/projects/claude-code-sdlc.
