# Fixture: failed-missing-file

The plan declares five files. Four exist, are wired end to end, and are covered by a real test that
calls the route handler and asserts on its output — Level 4 would, on its own, be `VERIFIED`-worthy.
The fifth, `src/middleware/rateLimiter.js`, is declared `[new]` in the plan but was never created.

Level 1 FAILs on the missing file. Per the fixed verdict precedence, `FAILED` is evaluated first and
wins outright — the otherwise-clean Levels 3/4 evidence does not soften it, downgrade it, or get
averaged against it. This fixture exists to prove that specific precedence rule (TC-1.3), not to
exercise a "everything is broken" scenario — everything **except the missing file** is intentionally
as clean as `exercised/`.

Expected verdict: `FAILED`, `passed: false`. `gaps` names `src/middleware/rateLimiter.js` at
`level: 1`.

## Do not "fix" this fixture

Do not create `src/middleware/rateLimiter.js`. Its absence is the entire point — creating it turns
this into a duplicate of `exercised/` and destroys the only control for Level 1 FAIL taking
precedence over an otherwise-passing Level 4.
