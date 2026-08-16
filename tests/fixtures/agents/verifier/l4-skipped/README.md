# Fixture: l4-skipped

This is the sharpest distinction the feature makes, and the one most likely to be misread, so read
this fixture carefully before touching it.

## The shape

A route `/api/plugins/:name/run` dispatches, at request time, to a plugin module chosen by the
request's own `:name` parameter:

- `src/app.js` — registers the route, statically requires `src/pluginLoader.js`. An actual bootstrap
  (`src/server.js`) calls `createApp().listen(...)`, so the route genuinely has an entrant — this
  fixture is not about a missing caller.
- `src/pluginLoader.js` — statically requires `src/plugins/widgetPlugin.js` at the top of the file,
  eagerly, purely to validate at process startup that the built-in plugin exists. That is an ordinary,
  fully resolvable `require('./plugins/widgetPlugin.js')` call — Level 3 finds it immediately.
  Separately, `dispatch(name, req)` — the function the route handler actually calls to serve a
  request — does `await import('./plugins/' + name + '.js')`, where `name` comes from
  `req.params.name` and is only known at request time.
- `src/plugins/widgetPlugin.js` — the one plugin file that exists in this fixture. Exports `run(req)`.

## Why Levels 1–3 are all PASS here (not SKIPPED)

- **Level 1:** every file the plan declares exists on disk.
- **Level 2:** no stub/placeholder markers anywhere.
- **Level 3:** `widgetPlugin.js` **is** statically required — by the eager validation `require` at
  the top of `pluginLoader.js`, a completely ordinary, literal-path import. Level 3's "dynamic
  import, cannot verify statically" adaptation never triggers, because the wiring check has a real,
  resolvable static import to find. This is what makes Level 3 PASS instead of SKIPPED, and it is
  the entire reason this fixture is not a duplicate of `dynamic-import/`.

## Why Level 4 is SKIPPED (not "traced and found nothing", and not FAILED)

The only feature behavior worth tracing is what happens when the route actually runs:
route handler → `dispatch(name, req)` → **the dynamically imported plugin** → its `run(req)` result.
The first link is traceable with real parameters. But past `dispatch`'s `import(...)` call, `verifier`
cannot determine — from source alone — which file executes for a given request; that depends on a
runtime value. There is no test file and no E2E scenario naming this flow either. Every candidate
data-flow path for this feature is behind that dynamic import, so Level 4 has nothing it can even
attempt to trace — it is not that a trace was attempted and came back empty.

## The distinction this fixture is a control for

- **Not `dynamic-import/`:** there, no static reference to the target module exists anywhere, so
  Level 3 itself is SKIPPED and the verdict routes to `UNCERTAIN` through the Level-3 trigger. Here,
  Level 3 is fully satisfied; only the request-time invocation is dynamic, so it is *Level 4* that
  has nothing to attempt.
- **Not `present-unverified/`:** there, Level 4 traces a complete, real, non-hardcoded chain and
  finds nothing exercising it — a genuine "traced and found nothing" result, verdict
  `PRESENT_BEHAVIOR_UNVERIFIED`. Here, Level 4 cannot even complete a trace, because the target of
  the dynamic call is undeterminable from source. **`SKIPPED` and "traced, unexercised" are
  different findings and MUST produce different verdicts** — that is the one fact this fixture
  exists to pin down.

Expected verdict: `UNCERTAIN` — **never** `PRESENT_BEHAVIOR_UNVERIFIED`. `human_verification_required`
non-empty, describing the request-time plugin dispatch as the undeterminable path.

## Do not "fix" this fixture

- Do not add a test file or E2E scenario for the `/api/plugins/:name/run` route — that gives Level 4
  something to trace via criterion (a)/(b) and turns this into a `VERIFIED` or
  `PRESENT_BEHAVIOR_UNVERIFIED` case, destroying the `UNCERTAIN`-via-Level-4-SKIPPED control.
- Do not remove the eager `require('./plugins/widgetPlugin.js')` from `pluginLoader.js` — without it,
  Level 3 also has nothing to resolve for `widgetPlugin.js`, and this collapses into a second copy of
  `dynamic-import/` instead of proving the distinct Level-4 case.
- Do not add a second plugin file — one plugin, one dynamic dispatch path, is what makes "every
  candidate path is behind a dynamic import" unambiguous. A second, statically-invoked plugin path
  would give Level 4 something else to trace and change the verdict.
