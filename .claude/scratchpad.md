## Feature: Hook Infrastructure and Non-Blocking Hooks (v4.0 roadmap F2a)
## Branch: feat/hook-infrastructure
## Status: implementing wave 1 slice 1/9

## Plan

Docs: `docs/PRD.md` §7 · `docs/use-cases/hook-infrastructure_use_cases.md` (UC-1..UC-10) ·
`docs/qa/hook-infrastructure_test_cases.md` (~135 TCs, 17 sections) · Architecture: **PASS with constraints**
Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F2a of F1-F5; F1 SHIPPED)

### Wave 1
- [ ] Slice 1: `hooks/hooks.json` + `hooks/lib/run-hook.js` + plugin.json `hooks` field + test harness — Pre-review: architect (design already ruled)
- [ ] Slice 2: `.gitignore` + `templates/.gitignore` + install.sh scaffold step for `.claude/tmp/`
- [ ] Slice 3: `templates/settings.json` real allow/deny — **Pre-review: security (MANDATORY)**

### Wave 2
- [ ] Slice 4: Runtime controls — `SDLC_HOOKS_ENABLED`, `SDLC_DISABLED_HOOKS`, `SDLC_HOOK_PROFILE`

### Wave 3
- [ ] Slice 5: `session:start:spine` handler — **Pre-review: security (MANDATORY)**
- [ ] Slice 6: `post:edit:accumulate` handler + `hooks/lib/accumulator.js`

### Wave 4
- [ ] Slice 7: `stop:typecheck-format` handler — **Pre-review: security (MANDATORY)**

### Wave 5
- [ ] Slice 8: CI validator extension + 7 seeded fixtures + workflow wiring + syntax-floor job
- [ ] Slice 9: Latency measurement + README hooks section

## Key design (binding — do not re-litigate)

- **Three Node zones, each with its own failure posture.** CI validators fail-closed; `install.sh`
  uses NO Node (existing CI grep enforces); hooks fail-open. `hooks/lib/` and `scripts/ci/lib/`
  MUST NOT import from each other — CI reads `hooks/hooks.json` as data only.
- **Fail-open contract.** Any hook that throws, times out, or cannot spawn Node exits 0 with a
  one-line `systemMessage`. **No hook in F2a may exit 2 or block.** Blocking is F2b.
- **Fail-open is for mechanism failure ONLY.** It is tolerable when the invariant has a named
  merge-ready backstop. The fail-closed layer for irreversible actions is `permissions.deny`,
  enforced by Claude Code itself — never a PreToolUse hook. F2b must name each guard's backstop.
- **Syntax floor.** `run-hook.js` and anything it requires before the version gate must parse under
  the oldest plausible Node, or the version check is unreachable and fail-open is unfulfillable.
- **Injected-context rule.** `additionalContext` carries only runtime-read machine state plus
  framing labels — never session-invariant instruction text (that belongs in the memory layer).
  Binds F5's instinct injection through the same hook.
- **Accumulator.** `.claude/tmp/<sanitized-session-id>.paths`, project-local, gitignored,
  append-only, Stop clears its own, opportunistic GC, paths resolved from stdin `cwd`.
  `session_id` sanitized to `[A-Za-z0-9_-]` — arrives on stdin, never trusted for path building.
- **Profile system KEPT** (planner's explicit decision against the architect's shed-candidate flag):
  `minimal` = spine only (observe, never execute project-declared commands); the two
  command-adjacent hooks are `standard`/`strict`. Non-vacuous before F2b.

## Security pre-reviews required BEFORE implementing

- **Slice 3** — every scaffolded project inherits the permission policy; one broad allow weakens all.
- **Slice 5** — injects project-owned file content into model context on every session start, in any
  repo the adopter opens. Prompt-injection surface by construction.
- **Slice 7** — executes commands declared by the *project's* CLAUDE.md, spawned by the hook engine
  and therefore NOT mediated by the permission system. Sharpest surface in the feature. FR-6.14's
  trust-signal mechanism is deliberately open pending this ruling; it MUST be non-interactive
  (an unattended run can never wait on a prompt).

## Blockers

- none

## Completed

- F1 (Plugin Repackaging, PRD §6) SHIPPED — merged to main 6e0c55e, pushed, GitHub CI green
  (both jobs, 25 steps: 6 validators + 6 falsify + 5 anti-vacuity + control + shell job).
