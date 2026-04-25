## Feature: Resource Manager-Architect — Iteration 2: Auto-Install
## Branch: feat/resource-architect-auto-install
## Status: implementing wave 2 slice 2/3

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: `src/agents/resource-architect.md` — frontmatter (Bash added) + Install Mode + 4-tier authority + decision table — f08bd02
- [x] Slice 4: `src/commands/bootstrap-feature.md` — Step 3.5 extension + headless detection + install.sh zero-drift verify — 122b548
- [x] Slice 5: `src/agents/planner.md` — inline both Recommended Resources AND Auto-Install Results — 3bff595
- [x] Slice 6: `src/claude.md` — resource-architect Responsibility text update + Plan Critic recognition for `## Auto-Install Results` — 746910a
- [x] Slice 7: `README.md` — feature section extension (4-tier, approval, whitelist, backward compat) — 19a3fd1
- [x] Slice 8: `templates/CLAUDE.md` — `Resource preferences:` placeholder (OPTIONAL) — b38f0ab

### Wave 2 [IN PROGRESS]
- [ ] Slice 2: `src/agents/resource-architect.md` — Bash whitelist + detect-then-install + multi-pkg-manager tiebreaker (appends to Slice 1) [IN PROGRESS]

### Wave 3
- [ ] Slice 3: `src/agents/resource-architect.md` — Approval flow + halt semantics + output extension `## Auto-Install Results` (appends to Slice 2)

## [STRUCTURAL] decisions

1. Reconcile iter-1 Authority Boundary write-prohibition with iter-2 side-effect mutations (package.json/lockfiles/~/.claude/settings.json/node_modules/)
2. Multi-pkg-mgr tiebreaker: most-recent lockfile mtime > packageManager field > pnpm > yarn > npm
3. Whitelist character class `[a-zA-Z0-9@/._+~-]` (uppercase scoped + semver tilde/build)
4. Forbidden-tier canonical: option (a) suggest alternative + omit when alt exists; option (b) Tier: Forbidden ONLY when no alt
5. Headless detection `process.stdin.isTTY === false` → literal "Skipped: non-interactive context — auto-install requires user approval"

## Plan Critic findings
- 1 CRITICAL (Slice 1 grep -cE -eq 5 broken) — fixed
- 7 MAJOR — all addressed via verify-tightening
- 4 MINOR — documented

## Process notes
- Sandbox blocks subagent commits; orchestrator commits with pathspec
- Wave 1 done: 6 atomic commits f08bd02→b38f0ab
- Waves 2 + 3 sequential on `src/agents/resource-architect.md`
- 17 agents stay (no banner change in install.sh)

## Completed
- Wave 1 all 6 slices on disjoint files

## Blockers
(none)
