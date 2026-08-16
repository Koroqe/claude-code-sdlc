# Fixture: dynamic-import

`src/plugins/reportPlugin.js` is a new production file. Nothing in this project statically imports
or requires it — literally nothing, not even a re-export barrel. The only reference to it at all is
inside `src/services/loader.js`, which builds a module path at runtime from a value read out of a
config file (`config/pluginName.json`) and passes that computed value to `import()`:

```js
const computedPath = '../plugins/' + config.pluginName + '.js';
const mod = await import(computedPath);
```

`computedPath` is not a string literal — Grep can find the `import(` call, but nothing in the source
tells `verifier` which file it actually resolves to without running the code. Per Level 3's
"Dynamic imports" adaptation, this is reported `SKIPPED — dynamic import, cannot verify statically`,
which is one of the explicit Level-3 triggers for the `UNCERTAIN` verdict.

Expected verdict: `UNCERTAIN`, `passed: false`, `human_verification_required` non-empty describing
the unresolved import.

## What this fixture is a control for, and what it is not

This fixture proves the **Level 3** SKIPPED path (TC-1.5) — the wiring check itself cannot determine
whether `reportPlugin.js` is connected to anything. Contrast this with `l4-skipped/`, which is a
different fixture entirely: there, Level 3 is fully satisfied (a separate, ordinary static import
resolves the target module), and only the runtime *invocation* — the piece Level 4 needs to trace —
is dynamic. Do not merge these two fixtures or add a static import of `reportPlugin.js` here; doing
so collapses this into `l4-skipped/`'s scenario and destroys the control for the Level-3-specific
trigger.

## Do not resolve the dynamic path

Do not change `computedPath` to a string literal, and do not add any static `require`/`import` of
`reportPlugin.js` anywhere in this fixture. Either change makes the import statically resolvable and
destroys the only control for TC-1.5.
