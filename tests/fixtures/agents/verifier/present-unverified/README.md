# Fixture: present-unverified

Levels 1–3 are clean by construction: every planned file exists, there are no stub or placeholder
markers, and the chain `app.js → routes → services → data` resolves with the route registered.

Level 4 finds nothing. Every link carries a real parameter or a real query result, so the chain is
not *broken* — but **no test, spec or E2E scenario anywhere exercises it**. That is the whole point:
this fixture is the shape that a three-verdict scheme rounds up to a pass.

Expected verdict: `PRESENT_BEHAVIOR_UNVERIFIED` with `passed: false` and a non-empty
`human_verification_required`.

Do not add a test file here. Adding one converts this fixture into the `exercised/` case and
silently destroys the only negative control for the `VERIFIED` verdict.

## What the tracer run found (2026-08-15)

The first run against this fixture returned `PRESENT_BEHAVIOR_UNVERIFIED` as intended — but reached
it on a better fact than the one this fixture was built around, and exposed a defect in the agent
prompt while doing so.

Criterion (c) originally counted any parameter-clean traced chain as *exercised*. This fixture's
chain **is** parameter-clean (`req.params.ownerId` flows untouched to `rows.filter`), so (c) as
written would have admitted it — and, worse, would have admitted any real codebase that has a
bootstrap and no tests at all. That is exactly the rounding-up the four-verdict scheme exists to
prevent.

What actually saved the verdict was that `createApp` is exported and **never invoked anywhere** — no
bootstrap, no server, no caller. The route binding never executes, so no request object is ever
constructed and the chain has no entrant.

Criterion (c) now requires a named entrant, not just clean parameters. Keep this fixture's
`createApp` uncalled: it is the negative control for that rule.
