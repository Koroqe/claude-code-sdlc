## Feature: Pipeline Hardening — Verification, Deviation Rules, Executable Plans
## Branch: feat/pipeline-hardening
## Status: complete — ready for quality gates

## Plan
1. [x] Slice 1: Create verifier agent (`src/agents/verifier.md`) — a87b903
2. [x] Slice 2: Augment error recovery with deviation rules (`src/rules/error-recovery.md`) — 4271291
3. [x] Slice 3: Update planner with executable plan format (`src/agents/planner.md`) — 596acd2
4. [x] Slice 4: Update implement-slice for executable fields (`src/commands/implement-slice.md`) — ef083ad
5. [x] Slice 5: Add scope reduction detection to Plan Critic (`src/claude.md`) — f4c297f
6. [x] Slice 6: Wire verifier into merge-ready + agent table (`src/commands/merge-ready.md`, `src/claude.md`) — 1759ce4
7. [x] Slice 7: Update README.md (counts, table, diagram) — 221040b
8. [x] Slice 8: Update install.sh agent count references — 6ba367e

## Completed
All 8 slices implemented and committed.

## Blockers
None.
