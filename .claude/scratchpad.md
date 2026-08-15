## Feature: Blocking Guards (v4.0 roadmap F2b)
## Branch: feat/blocking-guards
## Status: quality-gates

## Plan

Docs: `docs/PRD.md` §8 · `docs/use-cases/blocking-guards_use_cases.md` ·
`docs/qa/blocking-guards_test_cases.md` · Spike: `docs/spikes/blocking-guards_subagent-indicator_spike.md`
Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F2b of F1-F5)

### Wave 1 [complete]
- [x] Slice 1: subagent-indicator spike + stdin fixtures — 0d44efb
- [x] Slice 2: wrapper deny channel + register six guards — 0a0458e

### Wave 2 [complete]
- [x] Slice 3: `pre:bash:git-guard` + `hooks/lib/shell-parse.js` — b882430
- [x] Slice 4: `pre:write:shrink-guard` — 567be55

### Wave 3 [complete]
- [x] Slice 5: `pre:edit:read-guard` + `hooks/lib/read-tracker.js` — ae8a22d, 1b8dccd
- [x] Slice 6: `pre:edit:config-protection` — 7bd95be

### Wave 4 [complete]
- [x] Slice 7: `pre:agent:isolation-guard` — 58a208d
- [x] Slice 8: `stop:changelog-guard` — df38708

### Wave 5 [complete]
- [x] Slice 9: cross-guard sweeps + autonomy regression — cc71ee9, 40d3229
- [x] Slice 10: review auto-fix round (2 CRITICAL, 1 HIGH, 4 MAJOR) — 5d4af0f

## Key design (binding — do not re-litigate)

- **Deny is constructed in exactly one place.** A handler returns `{ deny: { reason } }`; only
  `run-hook.js` serialises it, event-aware (`PreToolUse` → `permissionDecision: "deny"`,
  `Stop` → `decision: "block"`, every other event → dropped). Handlers never emit protocol JSON.
- **Exit code 2 is banned harness-wide.** One signalling mechanism, so fail-open stays provable.
- **Fail-open means ALLOW for a guard.** A guard that cannot determine the facts must not refuse.
  `read-tracker.wasRead` is three-way: `'no'` (a state fact) denies, `'unknown'` (mechanism
  failure) allows.
- **Every refusal carries a `[deviation: rule-N — remedy]` token** so the existing recovery tiers
  classify it and an unattended run self-resolves. Reasons are self-sufficient — never "see
  error-recovery.md", which the model cannot open mid-deny.
- **Every guard has an escape sentinel, a `SDLC_DISABLED_HOOKS` entry, and a named merge-ready
  backstop.** Cross-guard test asserts all three for all six, so a new guard cannot skip them.
- **Git subprocesses are hardened against repo config.** `core.fsmonitor` in a cloned repo's
  `.git/config` is code execution; every spawn passes `-c core.fsmonitor=` plus
  `GIT_CONFIG_GLOBAL/SYSTEM=/dev/null`, `shell: false`, timeout, `maxBuffer`.
- **Config-protection excludes `docs/**`, `*.md`, `tests/fixtures/**`** — this repo's own fixtures
  contain `@ts-nocheck` literally, so without the exclusion the guard blocks the pipeline writing
  the very tests that prove it works.
- **Isolation guard: ACCEPTED RESIDUAL.** Absence of `agent_id` = orchestrator = allow. Correct
  today; the rot detector is a test asserting the captured subagent fixture still carries the
  field, not a warning on every orchestrator write (which would be pure noise).

## Verified at merge-ready

769 checks across 16 hook test files · 6 CI validators · 13 falsify/anti-vacuity inversions ·
ES5 parse floor (Node 14) · installer shell syntax + no-node/jq + no-hook-runtime greps.
Autonomy regression: a full slice replayed through all six guards, zero false refusals.

## Blockers

- none

## Completed

- F1 (Plugin Repackaging, PRD §6) SHIPPED — merged 6e0c55e, pushed, CI green
- F2a (Hook Infrastructure, PRD §7) SHIPPED — merged cbe586d, pushed, CI green (4 jobs)
  - Three Node zones: CI validators fail-closed · `install.sh` uses no Node/jq · hooks fail-open
  - Trust registry `~/.claude/sdlc-trusted-projects` read via `os.userInfo().homedir`, out-of-repo
  - Measured hook cost 21.4 ms/call against a 150 ms budget

## Next

- F3 — Verification & review upgrade (`PRESENT_BEHAVIOR_UNVERIFIED`, machine-readable `gaps:`,
  `plan-critic` extracted to a versioned agent, >80% confidence filter, tracer-first planner,
  write-surface lane matrix)
- F4 — Adaptive tier routing + model routing
- F5 — Self-improvement loop (requires PRD §4 revision)
