## Feature: Product Changelog Maintenance (Iteration 1: Content Sync)
## Branch: feat/product-changelog
## Status: implementing wave 1 slice 1/8

## Plan

### Wave 1
- [ ] Slice 1: `templates/rules/changelog.md` [new] — downstream-scoped policy + sentinel doc (Keep a Changelog format, audience, inclusion/exclusion rules, sentinel semantics). AC-1.
- [ ] Slice 2: `src/agents/changelog-writer.md` [new] — new agent with self-check, commit-to-PRD mapping (conventional-commit scope → slugified section title), idempotent diff (whitespace-insensitive), markdown structured output (5 `## <token>` headers, 6 canonical action-taken tokens). Pre-review: architect + security. AC-4, AC-5, AC-6, AC-15, AC-16, AC-17(partial).
- [ ] Slice 3: `install.sh` [edit] — add `cp` for `templates/rules/changelog.md` in `scaffold_project()`, update 5 banner strings "13"→"14", static SDLC self-skip verify via awk function-body extraction. Pre-review: architect + security. AC-2, AC-3, AC-13(part).
- [ ] Slice 4: `src/agents/prd-writer.md` [edit] — add `Changelog:` field to Output Format (separate line below Status/Date/Priority/Related block), two pinned value shapes (user-facing description OR `skip — internal`), authoring constraints subsection between Output Format and Constraints. AC-7.
- [ ] Slice 5: 4 command files [edit] — `bootstrap-feature.md` post-Step-5 delegation, `implement-slice.md` Step 5.5 with SKIP-in-parallel-subagent guard, `develop-feature.md` post-wave orchestrator invocation (ALL waves regardless of size), `merge-ready.md` pre-flight sync (NOT a gate). Pre-review: architect. AC-8, AC-9, AC-10, AC-11.
- [ ] Slice 6: `src/claude.md` [edit] — add "Release Scribe | `changelog-writer`" row to Agency Roles; remove any stale "13 agents" references. AC-12.
- [ ] Slice 7: `README.md` [edit] — tagline 13→14, "## The 13 Agents" → "## The 14 Agents", add changelog-writer row, new downstream CHANGELOG feature section explaining SDLC self-skip. AC-13.
- [ ] Slice 8: `templates/CLAUDE.md` [edit] — add `## Project Metadata` subsection with `Version source:` dead-metadata placeholder reserved for iteration 2. AC-14.

All 8 slices are Wave 1 (disjoint files, no runtime dependencies — agent name is a plan-level pinned string, verified via Plan Critic).

## Structural decisions pinned (Plan Critic confirmed)

1. **PRD `Changelog:` placement** — separate line below Status/Date/Priority/Related block (one blank line separation).
2. **Commit → PRD section mapping** — conventional-commit scope (e.g., `feat(changelog):`) matches slugified PRD section title keyword set (whole-token match; tie-break: user-facing > lower section number).
3. **Agent output format** — markdown with 5 headers (`## Self-check`, `## Source counts`, `## Entries per category`, `## Action taken`, `## Warnings`). 6 canonical action-taken tokens.
4. **SDLC self-skip verification** — static awk function-body containment (no destructive `install.sh` run).
5. **install.sh 13→14 scope** — 5 banner strings (header, 2× print_help, 2× install_user_config).
6. **Single-slice wave dispatch** — orchestrator always invokes post-wave regardless of wave size; subagents always SKIP in all waves.

## Plan Critic Findings

- 3 CRITICAL (all Slice 3 verify issues) — all addressed via static-analysis Verify command
- 5 MAJOR — all addressed (Gate regex, line numbers → grep-by-content, Slice 2 kept monolithic with rationale, single-slice dispatch fixed to uniform invocation, case-sensitive filename acknowledged)
- 6 MINOR — fixed where trivial (placement pin, aspirational NFR-8 note, rollback strategy added); remaining documented in Review Notes

## Completed

(bootstrap artifacts staged but not yet committed — commit message: `chore(core): add bootstrap documentation for product-changelog`)

## Blockers

(none)
