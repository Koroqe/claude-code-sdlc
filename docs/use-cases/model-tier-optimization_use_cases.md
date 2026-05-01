# Use Cases: Agent Model Tier Optimization

> Based on [PRD](../PRD.md) -- Section 3: Agent Model Tier Optimization

---

## UC-1: Right-Size All 13 Agents to the Tiered Model Policy

**Actor**: Developer (or implementing agent during `/develop-feature`) applying the model tier change to the SDLC repository
**Preconditions**:
- The repository contains the 13 SDLC agent files at `src/agents/*.md`, each with `model: opus` on line 5 of its YAML frontmatter
- `docs/PRD.md` Section 3 (this feature) is in `[DRAFT]` status
- `docs/PRD.md` Section 1.4 NFR-4 still asserts the uniform-opus-tier policy
- `docs/qa/pipeline-hardening_test_cases.md` test case 1.1.3 still asserts the uniform-opus-tier policy
- `README.md` does not yet document a tiered model policy
- `CONTRIBUTING.md` (if present) shows an agent template defaulting to `model: opus` (or has no template yet)

**Trigger**: The developer (or implementing agent) executes the implementation plan derived from PRD Section 3

### Primary Flow (Happy Path)

1. The developer opens each of the 10 sonnet-tier agent files and changes line 5 from `model: opus` to `model: sonnet`:
   - `src/agents/ba-analyst.md`
   - `src/agents/build-runner.md`
   - `src/agents/code-reviewer.md`
   - `src/agents/doc-updater.md`
   - `src/agents/e2e-runner.md`
   - `src/agents/prd-writer.md`
   - `src/agents/qa-planner.md`
   - `src/agents/refactor-cleaner.md`
   - `src/agents/test-writer.md`
   - `src/agents/verifier.md`
2. The developer leaves the 3 opus-tier agent files unchanged:
   - `src/agents/architect.md` (still `model: opus`)
   - `src/agents/planner.md` (still `model: opus`)
   - `src/agents/security-auditor.md` (still `model: opus`)
3. For each modified agent file, the developer confirms that ONLY the `model:` field on line 5 changed -- the `name`, `description`, `tools` fields and the entire body of the prompt are byte-identical to the previous version
4. The developer rewrites Section 1.4 NFR-4 of `docs/PRD.md` to describe the tiered policy (3 opus + 10 sonnet) and reference Section 3 for the rationale; the phrase "all 13 agents use the same model tier for consistency" is removed
5. The developer leaves Section 2.4 NFR-4 of `docs/PRD.md` unchanged (it is about wave computation being optional, not about model tiers)
6. The developer updates `docs/qa/pipeline-hardening_test_cases.md` test case 1.1.3: the expected outcome now asserts exactly 3 files match `grep -l "model: opus" src/agents/*.md` (architect, planner, security-auditor) and exactly 10 files match `grep -l "model: sonnet" src/agents/*.md` (the 10 sonnet agents listed by exact filename)
7. The developer adds a subsection to `README.md` (under Customization) listing each of the 13 agents with its model tier and rationale, the general principle (opus for cascading-decision agents, sonnet for structured/mechanical agents), and override instructions (edit `model:` in the agent's frontmatter, then re-run `bash install.sh`)
8. The developer updates `CONTRIBUTING.md` so its agent frontmatter template shows `model: sonnet` as the default, with guidance that opus should only be chosen when the agent's output cascades through multiple downstream agents AND a wrong decision cannot be caught by deterministic verification (typecheck, test, build); the guidance references PRD Section 3
9. The developer runs `bash install.sh` to copy the modified agent files into the user's `~/.claude/agents/` directory
10. The developer starts a fresh Claude Code session
11. Subsequent agent invocations resolve to the new tier (sonnet for the 10, opus for the 3) per the installed frontmatter

**Postconditions**:
- `grep -l "model: opus" src/agents/*.md` returns exactly 3 files: `architect.md`, `planner.md`, `security-auditor.md`
- `grep -l "model: sonnet" src/agents/*.md` returns exactly 10 files matching the FR-1.1 through FR-1.10 list
- The diff for each modified agent file is exactly one line (the `model:` value); no `name`, `description`, `tools`, or body content changed
- `docs/PRD.md` Section 1.4 NFR-4 describes the tiered policy and references Section 3
- `docs/PRD.md` Section 2.4 NFR-4 is unchanged (still describes optional wave computation)
- `docs/qa/pipeline-hardening_test_cases.md` test case 1.1.3 reflects the tiered policy with explicit filename lists
- `README.md` Customization section documents the per-agent tiers and override procedure
- `CONTRIBUTING.md` agent template defaults to `model: sonnet` with opus-selection guidance
- The installed agent files in `~/.claude/agents/` match the source `model:` values

### Alternative Flows

- **UC-1-A1: Subset roll-out (developer changes only some agents first)** -- The developer opts to verify Sonnet quality on a small batch before converting all 10
  1. The developer changes `model: opus` to `model: sonnet` in only a subset of the 10 target agents (e.g., starts with `build-runner.md` and `doc-updater.md` -- the most mechanical pair)
  2. The remaining 8 target agents stay on `model: opus` temporarily
  3. The developer runs `bash install.sh` and exercises the pipeline (e.g., runs `/develop-feature` on a small change) to confirm the converted agents produce acceptable output
  4. After confidence is established, the developer converts the remaining 8 agents in subsequent commits and re-installs each time
  5. The PRD/QA/README/CONTRIBUTING updates (steps 4-8 of the primary flow) MUST land in the same commit (or commit series) as the final agent conversion -- the documentation must not lag the code, otherwise AC-1, AC-2, AC-3, AC-6 fail intermediate states
  6. Once all 10 sonnet-tier agents are converted AND the documentation updates are committed, the postconditions of UC-1 are met
  7. **Important**: between the partial-conversion commit(s) and the final commit, the QA test case 1.1.3 will FAIL if it has already been updated to assert "10 sonnet" but only some agents are converted. The developer must coordinate so that the QA test update lands together with the final conversion, not earlier.

- **UC-1-A2: Implementing agent (during `/develop-feature`) applies the change autonomously** -- The change is implemented via the SDLC pipeline rather than by hand
  1. The pipeline reads PRD Section 3 and produces a use-case file (this document), QA test cases, and an implementation plan
  2. The plan groups the 10 frontmatter edits and the 4 documentation edits into slices (likely 1 wave with multiple file-disjoint slices)
  3. The implementing agents (test-writer, code-reviewer, etc.) execute each slice
  4. **Critical**: at the moment the QA test 1.1.3 update lands, the verifier and the `pipeline-hardening` test grep MUST see the new tiered state. If slices are merged out of order (e.g., test update before agent updates), the gate fails
  5. The merge-ready quality gates (build, code review, security audit, verifier, e2e) run on the final state and confirm AC-1 through AC-8

### Error Flows

- **UC-1-E1: Malformed YAML frontmatter on a converted agent file** -- A copy-paste or edit error breaks the agent
  1. The developer (or implementing agent) edits `src/agents/<agent>.md` and accidentally introduces invalid YAML (e.g., removes the leading `---`, breaks the colon-space format, introduces a typo like `modle: sonnet`, or accidentally deletes another field)
  2. `bash install.sh` may still copy the file (the installer is a shell copy, not a YAML parser), so the corruption is not caught at install time
  3. On the next Claude Code session, when the affected agent is invoked, Claude Code fails to parse the frontmatter
  4. The pipeline reports the parse error and the agent does not execute
  5. **Recovery**: the developer reads the file, identifies the YAML syntax error, fixes the frontmatter (correct delimiters, correct key names, correct value), and re-runs `bash install.sh`
  6. AC-7 (only the `model:` value changed, no other field touched) is the structural guard that catches this -- the diff for each modified agent file should be exactly one line. A multi-line diff is a red flag
  7. Per the error-recovery rules, this is a Rule 1 fix (typo / syntax) -- it does not consume retry budget

- **UC-1-E2: Wrong agent moved to the wrong tier** -- The change accidentally promotes one of the 10 sonnet agents to opus or demotes one of the 3 opus agents to sonnet
  1. The developer changes `model: opus` to `model: sonnet` in `src/agents/architect.md` (which MUST stay on opus per FR-2.1) -- or fails to change one of the 10 target agents
  2. The QA test case 1.1.3 fails because:
     - `grep -l "model: opus" src/agents/*.md` returns 2 files instead of 3 (or 4 instead of 3), OR
     - `grep -l "model: sonnet" src/agents/*.md` returns 11 files instead of 10 (or 9 instead of 10), OR
     - The expected exact filenames do not match
  3. The pipeline-hardening QA gate reports the discrepancy with the specific filenames that drifted
  4. **Recovery**: the developer reads the failing assertion, identifies which file is on the wrong tier, corrects the frontmatter, re-runs the QA gate
  5. Per the error-recovery rules, this is a Rule 1 fix (single-character correction)

- **UC-1-E3: Section 1.4 NFR-4 not rewritten or rewritten incompletely** -- The PRD remains internally contradictory
  1. The developer changes the agent frontmatter and updates the QA test case but forgets to rewrite Section 1.4 NFR-4
  2. The PRD now contains contradictory statements: Section 1.4 NFR-4 says all 13 agents use the same tier "for consistency"; Section 3 says 10 are on sonnet
  3. AC-3 fails: the text "all 13 agents use the same model tier for consistency" is still present in NFR-4
  4. The doc-updater agent (in the merge-ready Documentation Accuracy gate) detects the contradiction
  5. **Recovery**: the developer rewrites Section 1.4 NFR-4 per FR-3.1, FR-3.2, FR-3.3 -- the new text describes the tiered policy, explicitly notes that the original NFR-4 was revised by Section 3, lists the 3 opus agents by name, and references Section 3 for the full tier list
  6. Per the error-recovery rules, this is a Rule 2 fix (missing required documentation update)

- **UC-1-E4: Re-install skipped after frontmatter changes** -- The user keeps running an old installed copy of the agents
  1. The developer correctly modifies all source files but does not run `bash install.sh`
  2. The Claude Code runtime continues to read the OLD installed copies of the agents from `~/.claude/agents/`, which still have `model: opus`
  3. The user observes no behavioral change and may incorrectly conclude the feature did not work
  4. **Recovery**: the developer runs `bash install.sh` to refresh the installed copies, then starts a new Claude Code session
  5. NFR-3 documents this requirement; FR-4.3 (README override section) reinforces it
  6. The README override subsection is the canonical reference for "edit frontmatter -> re-run installer -> new session"

### Edge Cases

- **UC-1-EC1: verifier.md was specifically pinned to opus by Section 1 NFR-4 "for consistency"**. Section 3 FR-1.10 supersedes that and moves verifier.md to sonnet. This is intentional, called out in PRD Section 3.10 risk #6 ("Dependency: Section 1 NFR-4 (verifier model tier)"), and verified by AC-2 listing `verifier.md` explicitly in the 10-sonnet set. Test case 1.1.3 in `docs/qa/pipeline-hardening_test_cases.md` MUST be updated -- the old test asserted verifier was on opus; the new test asserts verifier is on sonnet. This edge case is the most likely source of regression because verifier was the most recently added agent (Section 1) and reviewers may default to "leave it as it was".
- **UC-1-EC2: A new agent is added to the pipeline AFTER this feature ships**. Per FR-5.1, the CONTRIBUTING.md template defaults to `model: sonnet`. Per FR-5.2, the contributor MUST justify opus selection (output cascades through downstream agents AND wrong decision is not catchable by deterministic verification). Per NFR-6, the new agent MUST be tiered per Section 3's policy, not per the old uniform policy. Adding a 14th agent on opus without PRD update would also fail the hardened test case 1.1.3 (which asserts exactly 3 opus filenames by name) -- this is a deliberate guard against drift per Section 3.10 risk #2.
- **UC-1-EC3: PRD Section 2.4 NFR-4 is unrelated and MUST NOT be changed**. There are TWO `NFR-4` references in the PRD because each section has its own numbered NFR list. Section 1.4 NFR-4 is about uniform model tier (and is the one rewritten by FR-3.1). Section 2.4 NFR-4 is about wave computation being optional ("Wave computation is optional. The planner MAY omit wave assignments..."). The implementing agent must NOT confuse them. Verification: after the change, Section 2.4 NFR-4 still contains the phrase "Wave computation is optional" and does NOT mention model tiers.
- **UC-1-EC4: The 10-vs-3 split is an exact assertion, not a "roughly"**. AC-1 and AC-2 specify "exactly 3" and "exactly 10". A drift of even 1 file (e.g., a new agent slipped onto opus, or a target agent missed during conversion) fails QA test case 1.1.3. Reviewers must count.
- **UC-1-EC5: The `model:` field appears at line 5 by convention but is not guaranteed to be on a fixed line number**. The PRD-stated "line 5" is a description of the current state. The grep-based AC-1/AC-2 assertions (`grep -l "model: opus" src/agents/*.md`) are line-number-agnostic. Implementing agents should not rely on line numbers when editing -- they should match on the `model:` key.
- **UC-1-EC6: install.sh uses a glob pattern**. Per Section 3.6 "Unchanged Files" table, `install.sh` does not need modification because it copies `src/agents/*.md` via globbing. No new agent files are added by this feature; only existing files have one-line edits. If `install.sh` ever switches to an explicit manifest, this edge case re-opens (and would be tracked as a separate issue).
- **UC-1-EC7: A reviewer pushes back against moving security-auditor to sonnet**. Per FR-2.3, security-auditor stays on opus. The reviewer is correct -- security findings gate merge and missed vulnerabilities have outsized cost. This edge case is included to flag that the 3-opus list (architect, planner, security-auditor) is non-negotiable in this feature; any change requires a new PRD section.
- **UC-1-EC8: A future Claude Code release renames `sonnet` to a different identifier**. Per Section 3.10 dependency #5, this feature assumes `sonnet` is a valid value resolved by the runtime. If Claude Code changes the identifier, all 10 sonnet-tier agents would need re-editing. This is out of scope for the current feature but worth noting.

### Data Requirements

- **Input**:
  - The 13 source agent files at `src/agents/*.md` with their current `model:` values (all `opus` before the change)
  - `docs/PRD.md` Section 1.4 NFR-4 current text and Section 3 policy text
  - `docs/qa/pipeline-hardening_test_cases.md` test case 1.1.3 current assertion
  - `README.md` current Customization section
  - `CONTRIBUTING.md` current agent template (or absence thereof)
- **Output**:
  - 10 modified agent files with `model: sonnet`
  - 3 unchanged agent files with `model: opus`
  - Rewritten Section 1.4 NFR-4 in `docs/PRD.md`
  - Updated test case 1.1.3 in `docs/qa/pipeline-hardening_test_cases.md`
  - New tier-list subsection in `README.md` Customization
  - Updated agent template in `CONTRIBUTING.md` with opus-selection guidance
- **Side Effects**:
  - After `bash install.sh`: the installed copies of the 10 sonnet agents in `~/.claude/agents/` reflect the new tier
  - Subsequent Claude Code sessions invoke Sonnet (instead of Opus) for the 10 converted agents -- this changes per-call cost and per-call latency for those agents
  - No source code (no JS/TS/Python/shell) is modified -- all changes are markdown files
  - No new files are created; no files are deleted
  - The git history records one (or a series of) atomic commits scoped to `chore(core)` or `feat(core)` per the project's conventional-commits convention

---
