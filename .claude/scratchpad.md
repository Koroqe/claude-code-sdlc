## Feature: Hook Infrastructure and Non-Blocking Hooks (v4.0 roadmap F2a)
## Branch: feat/hook-infrastructure
## Status: quality-gates

## Plan

Docs: `docs/PRD.md` §7 · `docs/use-cases/hook-infrastructure_use_cases.md` (UC-1..UC-10) ·
`docs/qa/hook-infrastructure_test_cases.md` (~135 TCs, 17 sections) · Architecture: **PASS with constraints**
Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F2a of F1-F5; F1 SHIPPED)

### Wave 1 [complete]
- [x] Slice 1: `hooks/hooks.json` + `hooks/lib/run-hook.js` (ES5 floor) + plugin.json `hooks` + harness — f7f2da8
- [x] Slice 2: `.gitignore` + `templates/.gitignore` + install.sh scaffold step — 385e744
- [x] Slice 3: `templates/settings.json` allow/deny per security ruling — 9700746

### Wave 2 [complete]
- [x] Slice 4: Runtime controls verified (kill switch, disable list, profiles) — 035763f

### Wave 3 [complete]
- [x] Slice 5: `session:start:spine` + `hooks/lib/sanitize.js` — b593feb
- [x] Slice 6: `post:edit:accumulate` + `hooks/lib/accumulator.js` — ef826f0

### Wave 4 [complete]
- [x] Slice 7: `stop:typecheck-format` + trust registry + `install.sh --trust-project` — 3e28bb7

### Wave 5 [complete]
- [x] Slice 8: validator wrapper-routing check + 3 fixtures + 3 CI jobs — 2799d57
- [x] Slice 9: latency measurement + README hooks section — d18ff72

## Security ruling applied (FR-6.14 resolved)

Execution of a project-declared command is gated on THREE conditions, all local
reads, none interactive:
1. `realpath(cwd)` exactly matches a line in `~/.claude/sdlc-trusted-projects`
   (out-of-repo; a project-local marker would be committable by a hostile repo)
2. Command matches an ASCII shape regex; argv[0] has no path separators
3. `SDLC_EXEC_PROJECT_COMMANDS` is not `0`
Any failure → report the command, execute nothing, exit 0. Registry written
only by `install.sh --trust-project`, never by a hook or agent.

## Measured

Hook cost: 21.4 ms/call, of which ~1.5 ms is hook logic (rest is Node startup).
Budget was 150 ms/call. 262 checks across 6 test files.

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
