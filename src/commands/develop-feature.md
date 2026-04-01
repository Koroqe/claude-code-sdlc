# Command: Develop Feature

Autonomously implement a complete feature from request to merge-ready. This command chains the full agency SDLC pipeline without stopping for human input.

## Pipeline

### Phase 1: Bootstrap (Documentation)
Follow the `/bootstrap-feature` workflow for the requested feature.
This produces: PRD section, use-case document, architecture review, QA test cases, implementation plan, feature branch, and initialized scratchpad.

### Phase 1.5: Implementation Review
After the plan is created by the Tech Lead:
- **Architect** reviews slices flagged for architectural complexity — validates technical design for each
- **Security Engineer** (security-auditor) reviews slices touching auth, financial data, or external APIs — flags security requirements
- Incorporate review feedback into slice implementation notes in the scratchpad

### Phase 2: Implement All Slices
Loop: follow the `/implement-slice` workflow for each slice until all slices are complete.
- Read `.claude/scratchpad.md` between slices to identify the next one
- Each slice follows TDD: tests first → implement → verify → commit → update scratchpad
- Each slice references which use-case scenarios it covers
- Continue looping until all slices show DONE in the scratchpad

### Phase 2.5: Code Cleanup (if 4+ slices were implemented)
Delegate to `refactor-cleaner` agent to review the accumulated changes:
- **Step 0**: Remove dead code, unused imports, and debug logs first — verify typecheck passes on the clean baseline before proceeding
- Consolidate duplicated patterns across slices
- Improve type safety where obvious
Then commit cleanup as a single `chore(core): clean up <feature> implementation` commit.

### Phase 3: Quality Gates
Follow the `/merge-ready` workflow to run all quality gates.
- If any gate FAILS: the main agent reads the gate's output and fixes the issues directly, then reruns only the failed gate(s)
- Repeat until all gates pass OR 3 fix attempts exhausted per gate
- Output final MERGE READY / NOT MERGE READY verdict

## Rules

- NEVER stop to ask the user unless truly stuck (3 retries exhausted on a critical blocker)
- NEVER skip PRD, Use Cases, or QA documentation steps
- ALWAYS update scratchpad after each slice (enforced by scratchpad rule)
- ALWAYS commit each slice atomically (1 slice = 1 commit)
- NEVER add "Co-Authored-By" or AI attribution
