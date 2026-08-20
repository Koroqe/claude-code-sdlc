---
feature: stale-install-detection
verdict: VERIFIED
passed: true
gaps: []
human_verification_required: []
generated_at: 2026-08-20 17:17
---

## Verification Report

### Level 1 — File Existence: PASS
- `hooks/handlers/session-start-spine.js` — exists, contains `loadedPluginVersion`, `staleInstallLine`, `normalizePath`, `REGISTRY_KEY`, `MAX_REGISTRY_ENTRIES`, `MAX_PROJECT_PATH`, `STALE_FIX_CMD`.
- `tests/hooks/test-session-start-spine.js` — exists, contains the stale-install test block (TC-1.1 through TC-7.4, S3-x, plus coexistence cases).
- `tests/hooks/measure-latency.js` — exists, seeds a temp `HOME` with a matching stale registry entry for the spine measurement (lines 52-71).
- `docs/implementation-records/hook-infrastructure_latency.md` — updated with a 2026-08-20 post-§12 re-measurement (52.0 ms median, ~48 ms startup floor, ~3.6 ms logic delta, NFR-2 fallback recorded).
- `docs/PRD.md` §12 — present, `**Status:** [SHIPPED]`.
- `docs/use-cases/stale-install-detection_use_cases.md` — exists.
- `docs/qa/stale-install-detection_test_cases.md` — exists.
- `README.md` — spine row (line 403) mentions the stale-install warning and fix command; version badge (line 8) reads `4.5.0`.
- `.claude-plugin/marketplace.json` (line 15), `.claude-plugin/plugin.json` (line 3), `install.sh` (line 78) — all `4.5.0`, consistent with the README badge.

### Level 2 — No Stubs/Placeholders: PASS
- Grep for `TBD|TODO|FIXME|XXX|HACK|placeholder|PLACEHOLDER|stub|not implemented|NotImplementedError` against `hooks/handlers/session-start-spine.js` returned no matches.
- No BLOCKER or WARNING markers found in the production handler. (`tests/hooks/test-session-start-spine.js` line 1031-1036 carries a stale comment claiming a header rewrite "SHOULD FAIL right now," left over from an earlier slice — this is a test file, out of Level 2 scope, and the corresponding assertions at lines 1041-1071 in fact pass against the shipped header, so the comment is inaccurate but not a stub/placeholder marker and not production code.)

### Level 3 — Wiring: PASS
- `staleInstallLine` is called exactly once, from `module.exports` (`hooks/handlers/session-start-spine.js:473`), with the computed `pluginVersion` as its third argument: `const stale = (homeDir && pluginVersion) ? staleInstallLine(homeDir, cwd, pluginVersion) : '';`.
- `loadedPluginVersion(pluginRoot)` (line 471) feeds both `driftLine(homeDir, pluginVersion)` (line 472) and `staleInstallLine` (line 473) — confirmed by the source and independently pinned by the test suite's structural check TC-7.1 (`test-session-start-spine.js:1005-1029`), which asserts exactly one `loadedPluginVersion(` call site inside `module.exports` and that `driftLine`'s own body contains no `.claude-plugin` manifest read.
- `stale` is included in the early-return guard: `if (parts.length === 0 && ruleLines.length === 0 && !drift && !stale) return null;` (line 519).
- `stale` is concatenated into `sources` (line 530: `.concat(stale ? ['the project-scope install registry'] : [])`) and into `body` (line 537: `.concat(stale ? [stale] : [])`), after `drift` in both arrays — matching PRD FR-3.5/FR-3.6 and AC-5's ordering requirement, confirmed by test TC-1.2/TC-6.6 (`test-session-start-spine.js:928-953`).
- The handler is registered under `hooks/hooks.json`'s `SessionStart` array as `session:start:spine` → `hooks/handlers/session-start-spine.js`, invoked via `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-hook.js" --hook session:start:spine`.
- `hooks/lib/run-hook.js`'s `HOOKS` map (line 79-81) resolves `session:start:spine` to `handler: 'session-start-spine.js'`, and `require(handlerPath)` (line 468) loads it. No dynamic-import ambiguity — this is a plain `require()`.
- No new hook id was added (AC-6); the existing id's registration is unchanged, satisfying NFR-3.

### Level 4 — Data Flow: PASS
- `tests/hooks/test-session-start-spine.js` TC-1.1 (lines 230-259) spawns the real handler as a child process — `runHook` in `tests/hooks/harness.js` uses `spawnSync(process.execPath, [WRAPPER, '--hook', hookId], ...)` against the real `hooks/lib/run-hook.js`, never an in-process `require` — with a seeded `~/.claude/plugins/installed_plugins.json` registry entry (`homeWithRegistry`/`staleEntryFor`) whose `projectPath` matches the temp project's cwd and whose `version` differs from the loaded plugin's actual `plugin.json` version, and asserts the exact line `stale project-scope install: project-scope 0.0.1, loaded <pluginVersion> — run \`claude plugin update claude-code-sdlc@claude-code-sdlc --scope project\`` appears exactly once in `additionalContext`. This satisfies criterion (a) directly: a real automated test exercising the new code path end-to-end with non-trivial input and an assertion on real output, not merely a wiring trace.
- The chain's head (`SessionStart` → `run-hook.js` → `session-start-spine.js`) is the same real entry point the Claude Code CLI invokes at every session start per `hooks/hooks.json`'s registration — no gap between what the test exercises and what runs in production.
- `tests/hooks/measure-latency.js` independently re-exercises the same path with a seeded stale registry (not a developer's real registry, per project convention) to produce the latency figure recorded in `docs/implementation-records/hook-infrastructure_latency.md`.
- The scratchpad records the full test suite green (198 checks per the delegation prompt's plan summary; Wave 4 commit `5f47f57`/`5f47f74` entry states 198 checks green) and the validator/test sweep passing 16/16 + 20/20 across every wave, consistent with Gate 4 (Build Runner) having already run the suite.
- No hardcoded stand-in data was found on any link of the traced chain: `staleInstallLine` reads the real registry file, compares against the real `pluginVersion` derived from the real `plugin.json`, and only `STALE_FIX_CMD` is a fixed literal — which PRD FR-3.4 explicitly specifies as fixed (the scope flag and plugin identifier never vary per project).

### Overall: VERIFIED
- Levels 1-3 all PASS with no findings. Level 4 confirms an exercised path per criterion (a): `test-session-start-spine.js` TC-1.1 spawns the real handler as a child process through the real `hooks/lib/run-hook.js` wrapper (the same entry point Claude Code's `SessionStart` event invokes) against a seeded registry, and asserts the specific injected warning line naming both versions and the exact fix command. Nothing in this feature is merely wired-and-untested.
