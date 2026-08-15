# Fixture: failed-plus-uncertain

Two independent, unrelated conditions hold in this single project at once:

1. **A Level 1 FAIL** — the plan declares `src/middleware/rateLimiter.js` as `[new]`; it does not
   exist on disk. (Same missing-file shape as `failed-missing-file/`.)
2. **A Level 3 SKIPPED / UNCERTAIN-triggering condition** — `src/plugins/reportPlugin.js` is reachable
   only through a runtime-computed `import()` call in `src/services/loader.js`, on a completely
   unrelated feature area (report generation, not widget listing). (Same shape as `dynamic-import/`.)

Per the fixed verdict precedence, `FAILED` is evaluated **first** and wins outright over the
`UNCERTAIN`-triggering condition, even though both are individually satisfied. This is the explicit
precedence-conflict proof (TC-1.7, Matrix Row 10): `FAILED` is a fixed-order rule, not a severity
vote between "wins" — if it were a vote, one could imagine `UNCERTAIN` "trumping" a lesser FAIL, but
the precedence is a strict sequence and `FAILED` is checked before `UNCERTAIN` ever gets evaluated.

Both findings must still be individually present in `gaps` — the Level 1 missing-file entry and the
Level 3 unresolved-import entry — proving the report doesn't collapse to just the first condition it
notices.

Expected verdict: `FAILED` (not `UNCERTAIN`), `passed: false`. `gaps` contains at least one
`level: 1` entry naming `src/middleware/rateLimiter.js` and at least one `level: 3` entry naming the
unresolved `reportPlugin.js` import.

## Do not "fix" this fixture

Do not create `src/middleware/rateLimiter.js`, and do not make `loader.js`'s import path a string
literal. Either change removes one of the two conditions this fixture exists to combine, and this
degenerates into a duplicate of `failed-missing-file/` or `dynamic-import/` instead of proving the
precedence conflict.
