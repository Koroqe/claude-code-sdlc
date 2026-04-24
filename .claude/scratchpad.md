## Feature: Resource Manager-Architect (Iteration 1: Mandatory Pipeline Role)
## Branch: feat/resource-manager-architect
## Status: implementing wave 1 slice 1/6

## Plan

### Wave 1
- [ ] Slice 1: `src/agents/resource-architect.md` [new] — agent with Authority/Output Boundaries, six categories, pinned markdown output format
- [ ] Slice 2: `install.sh` — banner strings 14→15 in all 5 locations

### Wave 2
- [ ] Slice 3: `src/commands/bootstrap-feature.md` — insert Step 3.5 AFTER FAILS subsection, before Step 4
- [ ] Slice 4: `src/agents/planner.md` — read/inline/MUST-delete `.claude/resources-pending.md`

### Wave 3
- [ ] Slice 5: `src/claude.md` — Agency Roles row + Plan Critic bullet (single file; `src/CLAUDE.md` is case-alias to same inode 4432546)
- [ ] Slice 6: `README.md` — tagline 14→15, "## The 15 Agents", agent row, feature section

## Structural decisions pinned

1. Agent name: `resource-architect`; role title "Resource Manager-Architect"
2. Output format: `## Recommended Resources` → summary → 6 `### <Category>` → each as `#### <Name>` with 5 bold-labeled fields. Empty categories show `(none)`
3. MUST-level deletion wording in planner (no "may"/"should")
4. Verdict forwarding: orchestrator inlines architect's PASS verdict into resource-architect spawn prompt
5. Single file edit for Slice 5 (Plan Critic CRITICAL 1 — `src/CLAUDE.md` is case-alias, not mirror)

## Plan Critic findings

- 1 CRITICAL (mirror invariant was phantom — same inode verified) — addressed
- 5 MAJOR (AC-5 traceability, permissive Verify in Slice 6, useless diff in Slice 5, Slice 3 insertion point, loose Slice 2 counts) — addressed
- 4 MINOR (tightness, checklist state, debuggability, TC cross-refs) — 2 fixed, 2 documented in Review Notes

## Completed

(bootstrap artifacts staged but not yet committed — message: `chore(core): add bootstrap documentation for resource-manager-architect`)

## Blockers

(none)
