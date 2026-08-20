# Hook latency — measured

Measurement for PRD Section 7, AC-10. Reproduce with:

```bash
node tests/hooks/measure-latency.js
```

## Method

Each hook is spawned as a child process with a fixed stdin fixture, the way
Claude Code runs it. Median of **3 trials**; the per-Edit figure averages over
20 calls per trial, the once-per-session and once-per-response figures over 5.
The accumulate hook is measured twice — enabled, and with
`SDLC_HOOKS_ENABLED=0` — so the marginal cost of the hook logic can be
separated from the cost of starting Node at all.

## Results

| Path | Cost | Frequency |
|---|---|---|
| `post:edit:accumulate` | **21.4 ms** per call | every Edit and Write |
| same, hooks disabled | 19.9 ms per call | — |
| `session:start:spine` | 52.0 ms *(re-measured 2026-08-20, post-§12 — see note)* | once per session |
| `stop:typecheck-format` (no command declared) | 23.2 ms | once per response |

**Marginal cost of the accumulate hook: 1.5 ms.** Reference budget was 150 ms
per call; the measured figure is an order of magnitude inside it.

### `session:start:spine` re-measurement (2026-08-20, post-Section-12)

Measured after §12 added the stale project-scope install check: **52.0 ms
median** (best of two runs; first run 54.0 ms), Node v24.12.0, Apple M3. Not
directly comparable to the 21.4 ms row above or the three untouched rows, for
three reasons that all changed at once:

1. **The environment changed.** The same run's hooks-disabled baseline — pure
   Node startup, zero hook logic — measured **48.4 ms** against the original
   19.9 ms. The startup floor itself more than doubled (different Node major,
   same machine class); ~48 of the 52 ms is that floor.
2. **The measurement conditions changed.** The spine measurement now pins
   `HOME` to a seeded temp home carrying a matching stale registry entry, so it
   genuinely exercises the §12 registry read + match + line assembly (and no
   longer reads the developer's real registry, which the QA conventions
   forbid). The original row used the inherited real `HOME`.
3. **The handler does two more reads.** §12 made the plugin-manifest read
   unconditional (it was previously skipped for receipt-less installs) and
   added the registry read — two file reads plus two `JSON.parse` calls per
   session start.

The hook-logic delta attributable to §12 is the spread over the same-run
startup floor: **~3.6 ms**. §12's NFR-2 states a ≤ 30 ms median: that
threshold was set against the 21.4 ms-era floor and is unmeetable under a
~48 ms startup floor regardless of hook logic — recorded here as measured
rather than met, per NFR-2's own fallback; the meaningful engineering bound
(logic cost, not startup) is a few milliseconds and comfortably healthy.

## Reading these numbers honestly

Roughly 20 ms of every figure is Node process startup, not hook logic — that
cost is paid by *any* command hook, whatever it does, and it is the floor for
this design. The logic itself is ~1.5 ms, which is what the 1.5 ms marginal
figure shows: disabling the hook via the kill switch still pays for the process
that reads the switch.

A slice touching 12 files therefore pays about 0.26 s in accumulate hooks,
plus one session-start and one stop invocation. That is the cost this feature
buys down: without batching, those 12 edits would each have triggered a
typecheck.

Two caveats worth stating rather than burying:

1. The `stop:typecheck-format` figure above is the **no-command-declared** path,
   which is this repository's own everyday case since it has no `package.json`.
   In a project that declares a typecheck command *and* is registered in the
   trust registry, the child process dominates completely — a `tsc --noEmit`
   run is seconds, not milliseconds. That is a cost the project already pays;
   the hook only changes when it is paid.
2. This was measured on a machine whose `~/.claude/settings.json` already
   registers other hook entries, several with empty matchers on `PreToolUse`
   and `PostToolUse`. Those run in addition to these in a real session. The
   figures above are this plugin's marginal contribution, not the total hook
   cost of a tool call on that machine.
