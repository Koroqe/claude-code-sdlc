# Use Cases: Role Planner -- Iteration 2: Cross-Feature Reuse + Automatic Teardown

> Based on [PRD](../PRD.md) -- Section 8: Role Planner -- Iteration 2: Cross-Feature Reuse + Automatic Teardown

This document is the blueprint for E2E testing of the iteration-2 cross-feature reuse and automatic teardown extensions to the existing `role-planner` agent (introduced in PRD Section 5) and the `/merge-ready` command (Section 6). It EXTENDS the iteration-1 use cases for `role-planner` (which cover suggest-only Stage-3 authorship of `~/.claude/agents/ondemand-<slug>.md` files) with new scenarios specific to: the cross-feature reuse-scan at bootstrap Step 3.75, the 3-stage matching algorithm (exact-slug / purpose-match / no-match), the `features:` frontmatter manifest array shape, the affirmative/negative token grammar borrowed from PRD Section 7 FR-4.4, the atomic frontmatter mutation contract, the headless-default-create rule, the legacy-file migration rule, and the new `/merge-ready` Step 11 Post-Merge Teardown placed after Gate 9.

Iter-1 use cases are NOT restated here; they remain valid as a strict subset (preserved per PRD Section 8 FR-9.10 / AC-1). Every use case below is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`, `UC-CC-N`) are referenced by QA test cases and E2E tests.

**Iter-2 numbering** restarts at `UC-1` because this is a separate file. Iter-1 use cases (if a separate file exists) remain referable by their original IDs. Cross-references between files use the form `iter-1 UC-N` or `iter-2 UC-N` for disambiguation.

**Common preconditions across all iter-2 use cases** (stated once here, referenced as "common preconditions" below):

- The `/bootstrap-feature` orchestrator has reached Step 3.75 in its sequence (after Step 3 Software Architect, after Step 3.5 Resource Manager-Architect)
- The `role-planner` agent's frontmatter `tools:` field is exactly `["Read", "Write", "Glob", "Grep"]` byte-unchanged from Section 5 FR-5.7 / Section 8 FR-9.7 (NO `Bash`, NO `Edit`, NO `WebFetch`, NO `WebSearch`, NO `NotebookEdit`)
- The agent file `~/.claude/agents/role-planner.md` is installed (registered via `install.sh` per Section 5 design decision 2; the same file installation covers iter-2 since iter-2 only extends the agent's prompt body)
- The user's home directory `~/.claude/agents/` directory exists and is readable + writable
- The 17 core agents from Section 6 (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`) are installed at `~/.claude/agents/<core-agent>.md` -- their files lack the `ondemand-` prefix and are excluded from the iter-2 reuse scan by FR-1.1 / FR-1.6
- The orchestrator runs in an interactive context (a TTY is attached and user free-form replies can be captured) UNLESS a specific use case explicitly states a non-interactive context
- The project's CWD is on a feature branch (`feat/<slug>` or `fix/<slug>`) per the SDLC repo's git workflow rule, UNLESS a specific use case explicitly states a `main`-branch or non-feature-branch context
- The current git working tree is inside a git repository (so `git rev-parse --show-toplevel` succeeds), UNLESS a specific use case explicitly states a non-git context
- The `.claude/roles-pending.md` temp file format from iter-1 (Section 5 FR-2.1 through FR-2.5) is the substrate that iter-2 extends with the `## Reuse Decisions` audit subsection per FR-8.1

## Actors

| Actor | Description |
|-------|-------------|
| Developer | The human user invoking `/bootstrap-feature` or `/merge-ready`; replies to Stage-2 reuse prompts; reads audit output |
| `role-planner` agent | The bootstrap-only agent extended in iter-2 with reuse-scan, 3-stage matching, atomic frontmatter mutation, and `## Reuse Decisions` audit emission. Does NOT participate in Step 11 teardown -- the agent itself is not invoked at merge-time per FR-3.3 |
| `/bootstrap-feature` orchestrator | The command runtime that drives Step 3.75; relays Stage-2 prompts to the developer and replies back to the agent; computes `<project-name>` and `<feature-slug>` and passes them to the agent in the spawn context per FR-1.3 / FR-1.4 |
| `/merge-ready` orchestrator | The command runtime that runs Step 11 Post-Merge Teardown after Gate 9; has the standard `Bash` tool available (used for `git merge-base --is-ancestor`, `basename "$(git rev-parse --show-toplevel)"`, and `rm` of empty-array files); performs per-file frontmatter mutations directly (or via a delegated subagent) per FR-3.3 |
| `~/.claude/agents/` filesystem | The user's global agent directory containing both core agents (`<core-agent>.md`) and on-demand role files (`ondemand-<slug>.md`); shared across all projects on the same machine per FR-1.2's `<project-name>:<feature-slug>` namespacing |

---

## UC-1: New Feature with No Existing On-Demand Roles -- Stage 3 Create-New (Iter-1 Behavior)

**Actor**: `role-planner` agent, Developer (no interaction required), `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- The current branch is `feat/role-planner-reuse-teardown`; the project root's basename is `claude-code-sdlc`
- `~/.claude/agents/` contains ONLY the 17 core agent files (`prd-writer.md`, ..., `release-engineer.md`); NO `ondemand-*.md` files exist
- The PRD (read at bootstrap Step 3.75) recommends one specialized role: `mobile-dev` (a hypothetical role for a mobile-feature PRD, used here as illustrative -- in practice the SDLC repo's iter-2 PRD does not need extra roles; this example uses a downstream-project shape for clarity)

**Trigger**: Bootstrap Step 3.75 begins; the orchestrator spawns `role-planner` and passes `<project-name>=claude-code-sdlc`, `<feature-slug>=role-planner-reuse-teardown` in the spawn context per FR-1.3 / FR-1.4

### Primary Flow (Happy Path)

1. The agent receives the spawn context and reads the PRD from `docs/PRD.md` plus `.claude/roles-pending.md` (iter-1 Section 5 FR-1.2 input discovery)
2. The agent runs the cross-feature reuse-scan per FR-1.1: it invokes `Glob` with the pattern `~/.claude/agents/ondemand-*.md`. The Glob returns ZERO files
3. Since the on-demand pool is empty, NO existing files exist for any of the 3 stages to match against. Every recommendation goes directly to Stage 3 per FR-2.1
4. The agent classifies the recommendation as `stage-3-no-match-created` and writes a new file per the iter-1 authorship contract (Section 5 FR-1.7 / FR-2.3): the agent uses `Write` to create `~/.claude/agents/ondemand-mobile-dev.md` with the iter-1 frontmatter shape EXTENDED to include the new iter-2 `features:` field per FR-1.2:
   ```yaml
   ---
   name: ondemand-mobile-dev
   description: Mobile-application specialist for iOS/Android domain
   tools: ["Read", "Write", "Glob", "Grep"]
   model: sonnet
   scope: on-demand
   features: ["claude-code-sdlc:role-planner-reuse-teardown"]
   ---
   ```
5. The body of the new file is the agent's iter-1 prompt-body output for `mobile-dev` -- iter-2 does NOT change the body authorship
6. The agent writes the iter-1 `## Additional Roles` and `## Role invocation plan` sections to `.claude/roles-pending.md` per Section 5 FR-2.4 / FR-2.5
7. The agent ALSO writes the new iter-2 `## Reuse Decisions` subsection per FR-8.1, with one entry: `mobile-dev: stage-3-no-match-created`
8. The agent returns control to the orchestrator. Bootstrap Step 3.75 SUCCEEDS. Bootstrap proceeds to Step 4 (`qa-planner`)
9. At Step 5, the planner reads `.claude/roles-pending.md` and inlines all three subsections (`## Additional Roles`, `## Role invocation plan`, `## Reuse Decisions`) into `.claude/plan.md` in that order per Section 5 FR-2.6 / Section 8 FR-8.1

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` exists with the iter-2 frontmatter shape (including `features:` field with one entry)
- `.claude/roles-pending.md` contains `## Additional Roles`, `## Role invocation plan`, AND `## Reuse Decisions` (all three subsections)
- `.claude/plan.md` (after planner inlining at Step 5) contains the same three subsections
- No other on-demand role file exists; the on-demand pool size went from 0 to 1
- Bootstrap Step 3.75 SUCCEEDED

**Failure modes**: None in the happy path. Failure modes covered in error flows below.

**Mapped FR**: FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.7, FR-2.1 (Stage 3), FR-5.1 (atomic write of new file), FR-8.1 (`stage-3-no-match-created`)

**Mapped ACs**: AC-1, AC-21

### Alternative Flows

- **UC-1-A1: Multiple recommendations all hit Stage 3** -- The PRD recommends two roles (`mobile-dev` and `compliance-officer`) and the on-demand pool is empty; both classify as `stage-3-no-match-created`
  1. Steps 1-3 of the primary flow proceed; the Glob returns zero files
  2. Per FR-1.5, classification is per-recommendation -- each is independently classified
  3. The agent creates `~/.claude/agents/ondemand-mobile-dev.md` AND `~/.claude/agents/ondemand-compliance-officer.md`; both have `features: ["claude-code-sdlc:role-planner-reuse-teardown"]`
  4. The `## Reuse Decisions` subsection lists both with `stage-3-no-match-created`
  5. Per FR-2.5, sequential prompting does not apply because there are no Stage-2 prompts; both Stage-3 creations proceed without user interaction

  **Mapped FR**: FR-1.5, FR-2.1 Stage 3
  **Mapped ACs**: AC-1, AC-14

- **UC-1-A2: Recommendation list is empty -- "No additional roles required"** -- The PRD's domain is fully covered by the 17 core agents; the agent produces no recommendations
  1. Steps 1-3 proceed; the Glob returns zero files but it does not matter -- there are no recommendations to classify
  2. The agent writes the iter-1 `## Additional Roles` section with the body "No additional roles required" per Section 5 FR-1.5 (parallel to Section 4 FR-1.5's "No external resources required")
  3. The `## Reuse Decisions` subsection is written but is empty (or contains the literal "No reuse decisions -- no additional roles recommended") -- per FR-8.3, absence is acceptable, but explicit empty-list emission is preferred for audit consistency

  **Mapped FR**: FR-8.1, FR-8.3
  **Mapped ACs**: AC-15

### Error Flows

- **UC-1-E1: Glob fails with permission denied** -- The user's `~/.claude/agents/` directory exists but is not readable (e.g., chmod 0 from a misconfigured install)
  1. The agent invokes `Glob` with `~/.claude/agents/ondemand-*.md`
  2. The Glob fails with permission-denied error
  3. The agent CANNOT proceed with reuse-scan; per the iter-1 fail-loud contract from Section 5 FR-5.8, the agent emits an error noting the failure path
  4. Per FR-1.1, the reuse-scan is the primary input to the 3-stage classification -- without it, no classification is possible
  5. The agent SHOULD fall back to Stage-3-create-new behavior with a warning emitted to the orchestrator's audit log: "Reuse scan failed: permission denied on ~/.claude/agents/. Falling back to create-new for all recommendations." The agent's recovery is a Rule 1 / Rule 2 auto-fix in spirit -- continue Stage 3 authorship without losing the bootstrap
  6. The audit log records the failure so the developer can fix the directory permissions
  7. Bootstrap Step 3.75 may SUCCEED or FAIL depending on whether Write to `~/.claude/agents/` also fails (covered by UC-EC variants below)

  **Mapped FR**: FR-1.1, FR-1.8
  **Mapped ACs**: (gap -- PRD does not explicitly mandate Glob-failure recovery; flag for architect's review pass)

### Edge Cases

- **UC-1-EC1: First-ever invocation in a fresh installation** -- The user just ran `install.sh` and `~/.claude/agents/` was created by the installer with the 17 core agents. No on-demand pool exists yet
  1. The flow is identical to UC-1 primary flow
  2. The first ondemand file is created at this Step 3.75 invocation; the pool size goes from 0 to N (where N is the number of recommendations)

  **Mapped FR**: FR-1.1, FR-2.1 Stage 3

- **UC-1-EC2: `~/.claude/agents/` directory does not exist at all** -- The installer was never run, or the directory was deleted
  1. The Glob may return zero results OR may fail depending on Claude Code's tool semantics (typically zero results for a non-existent directory)
  2. If zero results: the agent proceeds with Stage-3 create-new; the Write step at FR-1.7 / Section 5 FR-2.3 will fail because the directory does not exist
  3. The agent's Write failure surfaces as a Rule 3 error per the error-recovery rules; the orchestrator escalates to the user: "~/.claude/agents/ does not exist. Run install.sh first."
  4. Bootstrap Step 3.75 FAILS -- the developer must install or restore the directory and re-run

  **Mapped FR**: FR-1.1, FR-1.7

### Data Requirements

- **Input**: PRD body (`docs/PRD.md`), `.claude/roles-pending.md` (if any prior iter-1 sections exist), spawn context with `<project-name>` and `<feature-slug>`
- **Output**: New `~/.claude/agents/ondemand-<slug>.md` files (one per Stage-3 recommendation); extended `.claude/roles-pending.md` with `## Additional Roles`, `## Role invocation plan`, `## Reuse Decisions` subsections
- **Side Effects**: One Glob (read-only). One file Read per existing on-demand file (zero in this UC since pool is empty). One Write per new ondemand file. One Write to `.claude/roles-pending.md`. NO Bash invocations (the agent has no `Bash` tool per FR-9.7)

---

## UC-2: New Feature with Exact Slug Match -- Stage 1 Automatic Reuse (No Prompt)

**Actor**: `role-planner` agent, Developer (no interaction required for Stage 1), `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- The current branch is `feat/checkout-flow-redesign`; the project basename is `acme-app` (a downstream project, not the SDLC repo)
- `~/.claude/agents/ondemand-mobile-dev.md` already exists (created by a prior feature) with frontmatter:
  ```yaml
  ---
  name: ondemand-mobile-dev
  description: Mobile-application specialist for iOS/Android domain
  tools: ["Read", "Write", "Glob", "Grep"]
  model: sonnet
  scope: on-demand
  features: ["acme-app:onboarding"]
  ---
  ```
- The current PRD recommends a `mobile-dev` role (slug-identical to the existing file)

**Trigger**: Bootstrap Step 3.75 begins with `<project-name>=acme-app`, `<feature-slug>=checkout-flow-redesign`

### Primary Flow (Happy Path)

1. The agent receives the spawn context, reads the PRD, and runs the cross-feature reuse-scan per FR-1.1
2. The Glob returns one match: `~/.claude/agents/ondemand-mobile-dev.md`
3. The agent reads the file and parses the YAML frontmatter; the `features:` field is `["acme-app:onboarding"]`, the `description:` is "Mobile-application specialist for iOS/Android domain", the slug stripped from the filename is `mobile-dev`
4. The agent classifies the recommendation against the on-demand pool per FR-2.1:
   - Recommended slug: `mobile-dev`
   - Existing slug: `mobile-dev` (extracted from filename `ondemand-mobile-dev.md`)
   - Slug-equality check: TRUE
   - Classification: Stage 1 -- exact slug match -> automatic reuse, NO user prompt per FR-2.1
5. Per FR-2.2, Stage 1 is deterministic: same pool + same recommendation -> always Stage 1
6. The agent performs the FR-5.1 atomic read-modify-write to append the current feature to the existing file's `features:` array:
   - Reads the entire file from disk (already done in step 3)
   - Parses the YAML frontmatter into an in-memory structure
   - Mutates `features:` in memory: append `"acme-app:checkout-flow-redesign"` -> `["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`
   - Per FR-5.4, the file body BELOW the closing `---` delimiter is preserved byte-for-byte (the role's prompt instructions are not silently rewritten)
   - Per FR-5.3, since the new array has 2 short entries summing to <80 chars on the line, the JSON-style single-line form is used: `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`
   - Serializes the entire file content (frontmatter + body) and Writes it back, atomically replacing the prior content
7. The agent does NOT create a new ondemand file (Stage 1 reuses the existing one)
8. The agent writes the iter-1 `## Additional Roles` section to `.claude/roles-pending.md`; per FR-2.6, the entry references the existing slug `mobile-dev` (which is the same as the recommended slug in this UC, so no slug substitution is needed -- but the principle holds)
9. The `## Role invocation plan` references the existing `ondemand-mobile-dev.md` file and the `subagent_type: general-purpose` invocation pattern from Section 5 FR-3.4
10. The `## Reuse Decisions` subsection records: `mobile-dev: stage-1-exact-slug-match (reused ondemand-mobile-dev; appended acme-app:checkout-flow-redesign)`
11. Bootstrap Step 3.75 SUCCEEDS without any user interaction

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` exists with `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]` (size grew from 1 to 2)
- The file body below the frontmatter is byte-identical to before
- No new file was created
- `.claude/roles-pending.md` contains the three iter-2 subsections including the `stage-1-exact-slug-match` audit entry
- Zero user prompts were emitted; zero Bash invocations
- Bootstrap Step 3.75 SUCCEEDED

**Failure modes**: Atomic Write failure (UC-X-E variants below)

**Mapped FR**: FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-2.1 Stage 1, FR-2.2, FR-5.1, FR-5.3, FR-5.4, FR-8.1 (`stage-1-exact-slug-match`)

**Mapped ACs**: AC-3, AC-12, AC-13, AC-14

### Alternative Flows

- **UC-2-A1: Existing file's `features:` array already contains the current feature** -- The developer re-runs `/bootstrap-feature` for the same feature on the same branch; the entry was added on the prior run
  1. Steps 1-5 proceed identically; Stage 1 match is deterministic
  2. At step 6, the in-memory mutation logic detects that `acme-app:checkout-flow-redesign` is ALREADY in the `features:` array
  3. Per the idempotency principle (NFR-2 for teardown applies symmetrically to bootstrap reuse): the agent SHOULD treat the duplicate-append as a no-op rather than producing `["acme-app:onboarding", "acme-app:checkout-flow-redesign", "acme-app:checkout-flow-redesign"]`
  4. The atomic read-modify-write still runs but produces a byte-identical file (same content) -- this is safe per FR-5.7's "either file unchanged or fully replaced" semantics
  5. The `## Reuse Decisions` audit entry annotation is `stage-1-exact-slug-match` (with optional note "feature already listed; no-op")
  6. Bootstrap Step 3.75 SUCCEEDS

  **Mapped FR**: FR-5.1, FR-8.1

- **UC-2-A2: Existing file has empty `features: []` array** -- A previously-torn-down file remains because some other process recreated it empty (edge case from manual editing)
  1. Steps 1-5 proceed identically; Stage 1 matches on slug regardless of the array state
  2. At step 6, the in-memory mutation appends `acme-app:checkout-flow-redesign` -> `["acme-app:checkout-flow-redesign"]`
  3. The file is now valid (non-empty `features:` array)
  4. The audit entry is `stage-1-exact-slug-match`

  **Mapped FR**: FR-5.1, FR-2.1 Stage 1

### Error Flows

- **UC-2-E1: Atomic Write fails (disk full)** -- The atomic Write at FR-5.1 step (e) fails because the disk is full
  1. Steps 1-5 proceed; Stage 1 classification is correct
  2. Step 6 sub-step (e): Write returns an error (e.g., ENOSPC)
  3. Per FR-5.7, the file is either unchanged on disk OR fully replaced -- the Write tool's atomic semantics prevent half-written state
  4. In the disk-full case, the prior content is preserved on disk
  5. The agent reports the failure to the orchestrator via the audit log; the orchestrator escalates as a Rule 3 error per error-recovery rules
  6. Bootstrap Step 3.75 FAILS; the developer frees disk space and re-runs

  **Mapped FR**: FR-5.1, FR-5.7

- **UC-2-E2: Read fails (permission denied on individual file)** -- The on-demand file exists per Glob but is unreadable (chmod 0 on the individual file)
  1. The Glob returns the file path
  2. The agent's Read invocation fails with permission-denied
  3. The agent cannot parse the frontmatter; classification cannot proceed for this file
  4. Per FR-1.8 / Section 5 FR-5.8 fail-loud principle, the agent emits an error noting the unreadable file
  5. The agent SHOULD treat the unreadable file as if it does not exist for matching purposes (continue with the reuse scan; if no other file matches, proceed to Stage 3 create-new for the recommendation)
  6. The audit log records the unreadable file; the developer fixes permissions after seeing the audit

  **Mapped FR**: FR-1.1, FR-1.8

### Edge Cases

- **UC-2-EC1: Existing file has malformed YAML frontmatter** -- The `features:` field is not valid YAML (e.g., `features: [acme-app:onboarding,]` with trailing comma, or unclosed bracket)
  1. The Glob returns the file
  2. The agent's frontmatter parse step (FR-5.1 step b) fails with a YAML parse error
  3. Per FR-1.1 fall-through: the agent treats the file as if its frontmatter is uninterpretable -- the slug from the filename is still usable for matching, but the `features:` array cannot be safely mutated
  4. Per the safe-default principle: if the agent's recommendation slug matches the filename slug AND the YAML is malformed, the agent MUST NOT attempt the FR-5.1 mutation (cannot construct a valid serialized output without round-tripping through a valid parse)
  5. The agent emits a warning to the audit log: "Malformed YAML in ondemand-mobile-dev.md; skipping reuse-append. Manual reconciliation required."
  6. The agent falls through to Stage 3: create a new file with the recommended slug -- but this would produce a slug collision (a file at the same path already exists)
  7. To avoid collision, the agent SHOULD record the recommendation as `stage-3-no-match-created` BUT skip the Write (the existing malformed file remains on disk) and emit an error to the user requesting manual fix
  8. Audit annotation: `legacy-migrated` is NOT applicable here (legacy means missing `features:` field, not malformed). A new annotation may be needed -- this is a gap; flag for architect review

  **Mapped FR**: FR-1.1, FR-5.1
  **Gap**: PRD does not specify the exact annotation for malformed-existing-file scenarios; the closest is the implicit "fail clean" path under FR-5.1. Flag for architect review.

- **UC-2-EC2: Existing file's slug differs only in case** -- E.g., file at `~/.claude/agents/ondemand-Mobile-Dev.md` and recommendation slug is `mobile-dev`
  1. Per FR-1.1, the Glob is case-sensitive on case-sensitive filesystems (Linux) and case-insensitive on case-insensitive filesystems (macOS default APFS, Windows NTFS)
  2. On case-sensitive FS: `Mobile-Dev` and `mobile-dev` are different slugs; Stage 1 does NOT match; agent falls through to Stage 2 (purpose match) or Stage 3
  3. On case-insensitive FS: the Glob may return both files if both exist; the slug comparison would treat them as equivalent. Stage 1 may match on either
  4. The Plan Critic's wave-assignment validation has a parallel rule about case-sensitive filesystems treating identical paths -- the same principle applies here
  5. Per Section 5 FR-1.7 design intent, slugs are lowercase-with-hyphens; uppercase slugs violate the iter-1 contract and SHOULD be flagged as a code-reviewer finding rather than a runtime error

  **Mapped FR**: FR-1.1, FR-1.6
  **Gap**: Case-sensitivity edge case is not explicitly addressed in PRD Section 8 (it appears in the Plan Critic Wave Assignment Validation rules but not in iter-2 reuse-scan rules). Flag for architect review.

- **UC-2-EC3: Multiple existing files all have slug `mobile-dev` -- impossible by Glob semantics, but documented for completeness** -- A filesystem cannot contain two files at the same path; this case cannot occur
  1. The Glob returns at most one file per slug
  2. Stage 1 matching is unambiguous

  **Mapped FR**: FR-1.1
  (Documented for negative-case completeness; not testable.)

### Data Requirements

- **Input**: PRD body, `.claude/roles-pending.md`, spawn context (`<project-name>=acme-app`, `<feature-slug>=checkout-flow-redesign`), `~/.claude/agents/ondemand-mobile-dev.md`
- **Output**: Mutated `~/.claude/agents/ondemand-mobile-dev.md` (frontmatter `features:` array grew by one entry); `.claude/roles-pending.md` extended with iter-2 subsections
- **Side Effects**: One Glob, one Read of the matched ondemand file, one Write of the mutated ondemand file (FR-5.1), one Write of the temp file. Zero user prompts. Zero new files created. No Bash. No network

---

## UC-3: New Feature with Purpose Match -- Stage 2 User Approves Reuse

**Actor**: `role-planner` agent, Developer (replies to Stage-2 prompt), `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- The current branch is `feat/mobile-frontend-overhaul`; the project basename is `acme-app`
- `~/.claude/agents/ondemand-mobile-dev.md` already exists with frontmatter:
  ```yaml
  ---
  name: ondemand-mobile-dev
  description: Mobile-application specialist for iOS/Android domain
  tools: ["Read", "Write", "Glob", "Grep"]
  model: sonnet
  scope: on-demand
  features: ["acme-app:onboarding"]
  ---
  ```
  with body describing responsibilities, inputs, and outputs around iOS/Android frontend work
- The current PRD recommends a role with slug `mobile-frontend-dev` (slug DIFFERS from `mobile-dev` but the responsibilities -- iOS/Android frontend specialist -- substantially overlap with the existing file's body purpose)

**Trigger**: Bootstrap Step 3.75 begins with `<project-name>=acme-app`, `<feature-slug>=mobile-frontend-overhaul`

### Primary Flow (Happy Path)

1. The agent runs the reuse-scan; Glob returns one match (`ondemand-mobile-dev.md`)
2. The agent reads and parses the file; existing slug is `mobile-dev`, body purpose covers iOS/Android frontend
3. The agent classifies per FR-2.1:
   - Recommended slug: `mobile-frontend-dev`
   - Existing slug: `mobile-dev`
   - Slug-equality check: FALSE -> Stage 1 does not apply
   - Purpose-match check: the agent compares the existing file's body (iOS/Android frontend specialist responsibilities) against the recommendation's intended purpose (also iOS/Android frontend); the agent judges them substantively consistent per FR-2.1 Stage 2 wording
   - Classification: Stage 2 -- slug differs, purpose matches -> EMIT user prompt per FR-2.3
4. The agent emits the FR-2.3 prompt verbatim:
   ```
   Reuse existing role 'ondemand-mobile-dev' for current feature, or create new 'ondemand-mobile-frontend-dev'? [yes/no]
   Existing role purpose: Mobile-application specialist for iOS/Android domain
   ```
5. The orchestrator displays the prompt to the developer per FR-2.3 / FR-2.5; the orchestrator captures the developer's free-form reply
6. Per FR-2.5, prompts are emitted ONE AT A TIME -- the agent does NOT batch multiple Stage-2 prompts
7. The developer replies "yes" (or any FR-2.4 affirmative token: `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`)
8. The orchestrator passes the reply back to the agent
9. Per FR-2.4, the agent parses the reply for affirmative/negative tokens. The reply contains "yes" (recognized affirmative). Stage 2 resolves AFFIRMATIVELY
10. Per FR-2.6 the agent:
    - (a) Skips the prompt-body Write for the new slug `mobile-frontend-dev` -- no new file is created
    - (b) Performs the FR-5.1 atomic read-modify-write to append `acme-app:mobile-frontend-overhaul` to the existing file's `features:` array -> `["acme-app:onboarding", "acme-app:mobile-frontend-overhaul"]`
    - (c) Updates the call-plan entry in `.claude/roles-pending.md` to reference the existing slug (`mobile-dev`) NOT the originally-recommended slug (`mobile-frontend-dev`); this ensures the orchestrator's Section 5 FR-3.4 invocation pattern targets the correct file
    - (d) The `## Additional Roles` body in the temp file ALSO reflects the slug substitution (the inlined plan section is internally consistent)
11. The `## Reuse Decisions` audit subsection records: `mobile-frontend-dev: stage-2-purpose-match-approved (reused ondemand-mobile-dev; appended acme-app:mobile-frontend-overhaul)`
12. Bootstrap Step 3.75 SUCCEEDS

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` has `features: ["acme-app:onboarding", "acme-app:mobile-frontend-overhaul"]`
- NO new file `ondemand-mobile-frontend-dev.md` was created
- The body of `ondemand-mobile-dev.md` is byte-identical to before per FR-5.4
- `.claude/roles-pending.md` references the existing slug `mobile-dev` in the call-plan and in `## Additional Roles`
- `## Reuse Decisions` annotation is `stage-2-purpose-match-approved`
- The Stage-2 prompt was emitted exactly once for this recommendation
- Bootstrap Step 3.75 SUCCEEDED

**Failure modes**: User reply parsing failure (UC-X-E variants), FR-5.1 atomic write failure

**Mapped FR**: FR-1.1, FR-1.2, FR-2.1 Stage 2, FR-2.3, FR-2.4 (affirmative tokens), FR-2.5 (one-at-a-time prompting), FR-2.6 (slug substitution in temp file), FR-5.1, FR-5.4, FR-8.1 (`stage-2-purpose-match-approved`)

**Mapped ACs**: AC-4, AC-12, AC-13, AC-14

### Alternative Flows

- **UC-3-A1: Reply uses alternative affirmative token** -- The developer replies with `approve`, `ok`, `agreed`, `please do`, or `go ahead` per FR-2.4
  1. Steps 1-8 proceed identically
  2. The agent parses the alternative token; per FR-2.4 the parse is positive
  3. The flow completes as in the primary flow

  **Mapped FR**: FR-2.4

- **UC-3-A2: Reply with affirmative + extra text** -- The developer replies "yes please reuse it, the existing one is fine"
  1. Steps 1-8 proceed
  2. Per FR-2.4, the agent extracts the affirmative token "yes" (or "yes please" or "please do" depending on the agent's tokenization order); the rest of the text is informational
  3. Stage 2 resolves AFFIRMATIVELY; the flow completes as in the primary flow

  **Mapped FR**: FR-2.4

### Error Flows

- **UC-3-E1: Reply parsing returns ambiguous result** -- See UC-9 for ambiguity handling. In this UC, an ambiguous reply leads to default-deny per FR-2.4 -> NEGATIVE outcome -> Stage 3 (UC-4 path) -- documented under UC-4 below

  **Mapped FR**: FR-2.4

### Edge Cases

- **UC-3-EC1: Multiple Stage-2 candidates -- prompts emitted one at a time in iter-1-output order** -- The PRD recommends two roles; both have purpose matches against different existing files
  1. Per FR-2.5, prompts are emitted in the order the recommendations appear in the iter-1 `## Additional Roles` body
  2. The agent emits the first prompt; the orchestrator captures reply 1; the agent processes reply 1 and decides Stage 2 outcome 1
  3. ONLY THEN does the agent emit the second prompt; reply 2 is captured; outcome 2 decided
  4. Sequential prompting lets the user consider each decision in isolation per FR-2.5

  **Mapped FR**: FR-2.5

- **UC-3-EC2: Existing file's `description` field is empty or missing** -- The Stage-2 prompt would lack the one-line summary required by FR-2.3
  1. Per FR-2.3, the prompt MUST include a one-line summary of the existing file's purpose extracted from the frontmatter `description`
  2. If the description is missing or empty, the agent SHOULD fall back to using the first non-empty line of the file body as the summary, or emit "(no description available)" if the body is also unparseable
  3. The prompt is still emitted; the user has reduced context but can still answer; ambiguous-default-deny applies if the user is uncertain

  **Mapped FR**: FR-2.3

### Data Requirements

- **Input**: PRD body, `.claude/roles-pending.md`, spawn context, `~/.claude/agents/ondemand-mobile-dev.md`, the user's free-form reply (via orchestrator)
- **Output**: Mutated `~/.claude/agents/ondemand-mobile-dev.md`; `.claude/roles-pending.md` with slug substitution and `stage-2-purpose-match-approved` audit entry
- **Side Effects**: One Glob, one Read, one Write of the existing file, one Write of the temp file, one user prompt round-trip. Zero new files. No Bash. No network

---

## UC-4: New Feature with Purpose Match -- Stage 2 User Declines (Stage 3 Fallback)

**Actor**: `role-planner` agent, Developer (replies negatively to Stage-2 prompt), `/bootstrap-feature` orchestrator

**Preconditions**:
- Same as UC-3
- The developer wants to keep the new role separate from the existing one (e.g., the existing `mobile-dev` body has drifted away from the new feature's needs, or the developer wants project-specific isolation)

**Trigger**: Bootstrap Step 3.75 begins; the agent emits the Stage-2 prompt; the developer replies negatively

### Primary Flow (Happy Path)

1. Steps 1-6 of UC-3 primary flow proceed; the Stage-2 prompt is emitted; the orchestrator captures the developer's reply
2. The developer replies "no" (or any FR-2.4 negative token: `n`, `decline`, `skip`, `not now`)
3. Per FR-2.4, the agent parses the reply; "no" is recognized as NEGATIVE. Stage 2 resolves NEGATIVELY
4. Per FR-2.7, the agent proceeds with Stage 3 -- create a new `ondemand-mobile-frontend-dev.md` file with the originally-recommended slug
5. The existing file `ondemand-mobile-dev.md` is UNTOUCHED -- its `features:` array is NOT modified per FR-2.7
6. The agent's Stage-3 authorship follows iter-1 Section 5 FR-1.7 / FR-2.3:
   - Writes a new file at `~/.claude/agents/ondemand-mobile-frontend-dev.md` with frontmatter:
     ```yaml
     ---
     name: ondemand-mobile-frontend-dev
     description: <agent-generated description for mobile-frontend-dev>
     tools: ["Read", "Write", "Glob", "Grep"]
     model: sonnet
     scope: on-demand
     features: ["acme-app:mobile-frontend-overhaul"]
     ---
     ```
   - Body is the agent's iter-1 prompt-body output for the new slug
7. The `## Additional Roles` and `## Role invocation plan` sections in `.claude/roles-pending.md` reference the new slug `mobile-frontend-dev`
8. The `## Reuse Decisions` subsection records: `mobile-frontend-dev: stage-2-purpose-match-declined (declined reuse of ondemand-mobile-dev; created ondemand-mobile-frontend-dev)`
9. Bootstrap Step 3.75 SUCCEEDS

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` is UNCHANGED (no `features:` mutation)
- `~/.claude/agents/ondemand-mobile-frontend-dev.md` is NEWLY created with `features: ["acme-app:mobile-frontend-overhaul"]`
- The on-demand pool grew by one file
- `## Reuse Decisions` annotation is `stage-2-purpose-match-declined`

**Failure modes**: Same as UC-1 (Stage 3 create-new failure modes apply)

**Mapped FR**: FR-2.1 Stage 2 -> Stage 3 fallback, FR-2.4 (negative tokens), FR-2.7, FR-1.7 (Stage 3 create), FR-8.1 (`stage-2-purpose-match-declined`)

**Mapped ACs**: AC-4, AC-14

### Alternative Flows

- **UC-4-A1: Reply uses alternative negative token** -- Developer replies `n`, `decline`, `skip`, or `not now` per FR-2.4
  1. Same flow; the alternative token is recognized as NEGATIVE
  2. Stage-3 fallback proceeds

  **Mapped FR**: FR-2.4

- **UC-4-A2: Reply contains conflicting tokens (yes + no for same prompt)** -- Per FR-2.4 ambiguity rule
  1. Reply: "yes please... actually no, skip it"
  2. The reply contains BOTH affirmative ("yes please") AND negative ("no", "skip") tokens
  3. Per FR-2.4 the conflicting-token case is treated as NEGATIVE for safety (default-deny)
  4. Stage 2 resolves NEGATIVELY; Stage 3 fallback proceeds
  5. The audit entry records `stage-2-purpose-match-declined` (NOT a separate "ambiguous" status -- per FR-8.1 there are six exact statuses; ambiguity is mapped to `declined`)

  **Mapped FR**: FR-2.4 (ambiguous-default-deny), FR-8.1

- **UC-4-A3: Reply mentions a different slug than the two presented** -- E.g., reply: "no, but use ondemand-android-dev instead"
  1. Per FR-2.4, replies that mention a different slug than the two presented are treated as NEGATIVE for safety
  2. Stage 2 resolves NEGATIVELY; Stage 3 fallback creates the originally-recommended slug
  3. The user's request to use a third slug is IGNORED -- the agent does not have authority to switch to a third file at runtime
  4. Audit annotation: `stage-2-purpose-match-declined`

  **Mapped FR**: FR-2.4

### Error Flows

- **UC-4-E1: Stage-3 Write fails after declined Stage 2** -- The fallback create-new step fails
  1. Steps 1-5 proceed; the user declined; agent attempts to create a new file
  2. Write to `~/.claude/agents/ondemand-mobile-frontend-dev.md` fails (e.g., disk full)
  3. Per FR-5.7, the file is either unchanged or fully replaced -- in disk-full case, no file is created
  4. The agent reports the failure; the orchestrator escalates as a Rule 3 error
  5. Bootstrap Step 3.75 FAILS; the developer fixes disk and re-runs

  **Mapped FR**: FR-5.7

### Edge Cases

- **UC-4-EC1: Reply is empty (whitespace only or no input)** -- Per FR-2.4 ambiguous-default-deny
  1. The orchestrator captures an empty reply or whitespace-only reply
  2. Per FR-2.4, replies that do NOT contain any recognized affirmative or negative token are treated as NEGATIVE for safety
  3. Stage 2 resolves NEGATIVELY; Stage 3 fallback proceeds
  4. The audit entry is `stage-2-purpose-match-declined`

  **Mapped FR**: FR-2.4

- **UC-4-EC2: Reply is a question rather than a yes/no** -- E.g., "what does the existing role do?"
  1. The reply contains no recognized affirmative or negative tokens
  2. Per FR-2.4, treated as NEGATIVE; Stage-3 fallback proceeds
  3. The agent does NOT re-prompt or attempt to disambiguate; one round-trip per Stage-2 prompt is the iter-2 contract per FR-2.5

  **Mapped FR**: FR-2.4, FR-2.5

### Data Requirements

- **Input**: Same as UC-3 plus a negative reply
- **Output**: New `~/.claude/agents/ondemand-mobile-frontend-dev.md`; existing `ondemand-mobile-dev.md` UNTOUCHED; `.claude/roles-pending.md` with `stage-2-purpose-match-declined` audit
- **Side Effects**: One Glob, one Read of existing file, one Write of new file, one Write of temp file, one prompt round-trip. The existing file is NOT mutated

---

## UC-5: Headless Context -- Stage-2 Prompt Skipped, Defaults to Create-New

**Actor**: `role-planner` agent, `/bootstrap-feature` orchestrator (in non-interactive context)

**Preconditions**:
- Same as UC-3 (existing `ondemand-mobile-dev.md`, recommendation `mobile-frontend-dev` triggers Stage-2 candidate)
- The orchestrator runs in a non-interactive context: `process.stdin.isTTY === false` (e.g., CI/CD pipeline) OR equivalent shell test `[ -t 0 ]` returns false per FR-6.4

**Trigger**: Bootstrap Step 3.75 begins in non-interactive mode

### Primary Flow (Happy Path)

1. The orchestrator detects non-interactive context per FR-6.4 (parallel to Section 7 FR-7.4 detection mechanism)
2. The orchestrator passes a "headless mode" flag to the agent in the spawn context (or equivalent runtime signal)
3. The agent runs the reuse-scan; Glob returns `ondemand-mobile-dev.md`
4. The agent classifies per FR-2.1:
   - Stage 1 (slug-equality): FALSE
   - Stage 2 (purpose-match): TRUE (matches purpose-wise)
5. Per FR-6.1, in headless mode the Stage-2 prompt MUST be SKIPPED entirely; the agent MUST default to "create new" (Stage-3 behavior)
6. The agent does NOT emit the Stage-2 prompt to console (no point -- no user can answer)
7. The agent proceeds directly to Stage-3 create-new: writes `~/.claude/agents/ondemand-mobile-frontend-dev.md` with the new slug, body, and `features: ["acme-app:mobile-frontend-overhaul"]`
8. Per FR-6.2, the `## Reuse Decisions` audit subsection records the decision with the literal annotation `headless-default-create` (NOT `stage-2-purpose-match-declined` -- the headless annotation is distinct so the user can later recognize that interactive reuse may have been preferred)
9. Stage 1 (exact-slug) reuse, if it had applied, would still run unaffected per FR-6.1 -- automatic reuse without prompting is safe in headless mode
10. Bootstrap Step 3.75 SUCCEEDS

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` is UNCHANGED
- `~/.claude/agents/ondemand-mobile-frontend-dev.md` is NEWLY created
- `## Reuse Decisions` records `headless-default-create` (not `stage-2-purpose-match-declined`)
- Zero user prompts emitted; the bootstrap completed in non-interactive mode

**Failure modes**: Same as UC-1 / UC-4 Stage-3 failure modes

**Mapped FR**: FR-6.1, FR-6.2, FR-6.4, FR-8.1 (`headless-default-create`)

**Mapped ACs**: AC-5, AC-14

### Alternative Flows

- **UC-5-A1: Headless mode + Stage-1 exact slug match -- automatic reuse runs as in interactive mode** -- The recommendation slug equals an existing slug
  1. Per FR-6.1, Stage 1 is unaffected by headless mode (no user interaction needed)
  2. The flow is identical to UC-2 primary flow
  3. The audit entry is `stage-1-exact-slug-match` (NOT `headless-default-create`)

  **Mapped FR**: FR-6.1, FR-2.1 Stage 1

- **UC-5-A2: Headless mode + recommendation goes to Stage 3 organically (no purpose-match candidate)** -- No Stage-2 candidate exists
  1. The recommendation hits Stage 3 directly (no exact slug, no purpose match)
  2. Stage-3 create-new runs identically in interactive and headless modes
  3. The audit entry is `stage-3-no-match-created` (NOT `headless-default-create` -- the latter is reserved for downgraded Stage-2 candidates)

  **Mapped FR**: FR-2.1 Stage 3, FR-8.1

### Error Flows

- **UC-5-E1: Stage-3 fallback Write fails in headless mode** -- Same as UC-4-E1
  1. The headless-default-create attempt to Write fails
  2. The bootstrap reports the failure; in headless mode the failure is reported to stderr / CI logs
  3. Bootstrap Step 3.75 FAILS

  **Mapped FR**: FR-5.7, FR-6.1

### Edge Cases

- **UC-5-EC1: Mixed Stage-1, Stage-2-downgraded-to-headless, and Stage-3 outcomes in one bootstrap** -- Per FR-2.8, a single bootstrap can have a mix; in headless mode some are Stage-1, some are headless-default-create, some are Stage-3
  1. The agent processes each recommendation independently per FR-1.5
  2. Stage-1 candidates run automatic reuse
  3. Stage-2 candidates are downgraded to `headless-default-create`
  4. Stage-3 candidates run create-new
  5. The audit subsection enumerates each with its specific status per FR-8.1

  **Mapped FR**: FR-2.8, FR-6.1, FR-8.1

### Data Requirements

- **Input**: Same as UC-3 plus headless context flag
- **Output**: Same as UC-4 plus `headless-default-create` audit annotation
- **Side Effects**: Same as UC-4. Zero user prompts even though Stage-2 candidate exists

---

## UC-6: Slug Collision with Core Agent Name -- Reject

**Actor**: `role-planner` agent (recommendation logic), `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- The PRD's domain or the agent's recommendation logic produces a slug that matches one of the 17 core agent names: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`
- (Hypothetical scenario; well-trained agent prompts should not produce these slugs, but the rule is enforced as defense-in-depth)

**Trigger**: The agent's recommendation logic produces a slug that collides with a core agent name

### Primary Flow (Happy Path -- Defense Holds)

1. The agent's recommendation logic produces a candidate slug, e.g., `code-reviewer` (collides with the core agent)
2. Per FR-1.6 / Section 5 FR-1.7 (slug-collision rule preserved unchanged in iter-2), the agent MUST NOT produce a recommendation whose slug equals any of the 17 core names
3. The agent's prompt SHOULD self-check the slug before proceeding to FR-1.1 reuse-scan
4. If the self-check fails (the agent generated a colliding slug), the agent MUST refuse to write the file and refuse to recommend the slug
5. The agent emits an error to the orchestrator: "Slug-collision violation: recommended slug 'code-reviewer' matches core agent name. Refusing to recommend."
6. The agent SHOULD attempt to re-generate the recommendation with a non-colliding slug (e.g., `code-review-specialist`) -- this is a Rule 1 / Rule 2 auto-fix
7. If re-generation produces a valid slug, the recommendation continues with that slug through FR-1.1 reuse-scan and 3-stage matching
8. The audit log records the collision attempt and the resolution

**Postconditions**:
- NO file at `~/.claude/agents/code-reviewer.md` was overwritten or modified (defense held)
- The recommendation either uses a corrected slug (if re-generation succeeded) or is dropped from the recommendation list with a warning
- Bootstrap Step 3.75 SUCCEEDS if a valid alternative slug is produced; FAILS if not

**Failure modes**: Re-generation of the slug fails (the agent cannot produce a non-colliding alternative); the recommendation is dropped or the entire recommendation is escalated to the developer

**Mapped FR**: FR-1.6 (slug-collision rule preserved); Section 5 FR-1.7 (filename prefix MUST start with `ondemand-`, which by definition prevents matching a non-prefixed core agent name)

**Mapped ACs**: AC-1 (iter-1 sections preserved byte-for-byte)

### Alternative Flows

- **UC-6-A1: Slug-collision is detected by FR-1.7 filename-prefix rule rather than name-match** -- The agent attempts to produce a slug like `code-reviewer` but writes the file at `~/.claude/agents/code-reviewer.md` (without the `ondemand-` prefix)
  1. Per FR-1.7 (Section 5 FR-2.3 self-check preserved unchanged), the agent's filename self-check rejects any path under `~/.claude/agents/` that does not begin with `ondemand-`
  2. The agent refuses the Write
  3. NO file at `~/.claude/agents/code-reviewer.md` is overwritten
  4. The collision is caught at the filename layer rather than the slug layer; the defense is redundant (FR-1.6 + FR-1.7 = two layers)

  **Mapped FR**: FR-1.7 (preserved iter-1 contract)

### Error Flows

- **UC-6-E1: Agent produces slug `ondemand-code-reviewer` (with prefix added)** -- A subtle drift where the agent prepends `ondemand-` correctly but the slug AFTER the prefix collides with a core name
  1. The agent's filename is `~/.claude/agents/ondemand-code-reviewer.md` -- this satisfies FR-1.7 prefix rule
  2. But the slug AFTER the prefix is `code-reviewer`, which is a core name
  3. Per FR-1.6, this violates the slug-collision rule (the rule applies to the slug itself, not the file's full path)
  4. The agent's slug-collision self-check should reject this slug
  5. NOTE: PRD Section 8 FR-1.6 wording ("the slug-collision rule from Section 5 forbidding slugs matching any of the 17 core agent names") implies the slug after the `ondemand-` prefix is what gets checked. This means an `ondemand-` prefix alone is NOT sufficient -- the suffix-slug must ALSO be non-colliding
  6. The agent rejects the slug and attempts re-generation

  **Mapped FR**: FR-1.6, FR-1.7

### Edge Cases

- **UC-6-EC1: Slug collision detected only after multi-stage processing** -- The agent recommends `code-reviewer` AND `code-review-specialist` as two separate roles; the first collides
  1. Per FR-1.5, classification is per-recommendation
  2. The first recommendation hits the slug-collision check and is rejected (or auto-corrected)
  3. The second recommendation has a non-colliding slug and proceeds normally through Stages 1-3
  4. The audit log records both decisions independently

  **Mapped FR**: FR-1.5, FR-1.6

- **UC-6-EC2: Existing on-demand file at `~/.claude/agents/ondemand-code-reviewer.md` from a buggy prior version** -- A pre-existing file violates the iter-1 slug-collision rule
  1. The Glob returns this file (it has the `ondemand-` prefix per FR-1.1)
  2. The agent reads its frontmatter; the slug is `code-reviewer` (collides with core agent name)
  3. The agent's reuse logic SHOULD treat this file as invalid for reuse purposes -- it violates FR-1.6
  4. The agent emits a warning to the audit log: "Found ondemand file with slug colliding with core agent name; not eligible for reuse. Manual cleanup required."
  5. The agent does NOT mutate this file's `features:` array even if a recommendation matches
  6. Recommendation falls through to Stage 3 with a corrected slug (or is dropped)

  **Mapped FR**: FR-1.6
  **Gap**: PRD Section 8 does not explicitly specify the agent's behavior on a pre-existing collision-violating file; FR-1.6 forbids new collisions but is silent on existing ones. Flag for architect review.

### Data Requirements

- **Input**: PRD body (as-is)
- **Output**: `## Reuse Decisions` audit log records the collision attempt; recommendation list excludes the colliding slug
- **Side Effects**: NO file at a colliding path is touched. Zero Bash. The defense is enforced at the agent's prompt layer

---

## UC-7: Filename Prefix Self-Check Failure -- Reject

**Actor**: `role-planner` agent (filename self-check), `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- (Hypothetical) the agent's logic produces a filename for a new ondemand role that does not begin with `ondemand-`, e.g., `~/.claude/agents/mobile-dev.md` (missing prefix) or `~/.claude/agents/special/ondemand-mobile-dev.md` (in a subdirectory)

**Trigger**: The agent's Stage-3 create-new path attempts a Write whose target path does not satisfy FR-1.7

### Primary Flow (Happy Path -- Defense Holds)

1. Per FR-1.7 (Section 5 FR-2.3 self-check preserved unchanged), the agent's prompt MUST contain a filename self-check that rejects any path under `~/.claude/agents/` that does not begin with the literal `ondemand-` prefix
2. The agent's logic produces a candidate filename, e.g., `~/.claude/agents/mobile-dev.md` (missing prefix)
3. The self-check runs BEFORE Write: the candidate's basename is `mobile-dev.md`; the basename does NOT start with `ondemand-`; the self-check FAILS
4. The agent ABORTS the Write with the literal violation message: "Filename prefix violation: candidate path '~/.claude/agents/mobile-dev.md' does not begin with 'ondemand-'. Refusing Write."
5. The agent SHOULD auto-correct by prepending the prefix (Rule 1 fix): `~/.claude/agents/ondemand-mobile-dev.md` -- if this corrected path satisfies FR-1.7 AND is not slug-colliding per FR-1.6, the Write proceeds with the corrected path
6. If auto-correction fails (e.g., the path is in a subdirectory like `special/...` -- the agent must NOT recurse per FR-1.8), the recommendation is dropped or escalated
7. The audit log records the violation and resolution

**Postconditions**:
- No file at a non-`ondemand-` path was written under `~/.claude/agents/`
- Either the corrected path was used (Write succeeded) or the recommendation was dropped
- Bootstrap Step 3.75 SUCCEEDS if correction succeeded; FAILS if not

**Failure modes**: Auto-correction fails; the agent cannot produce a valid filename

**Mapped FR**: FR-1.7 (preserved iter-1 contract), FR-1.8 (no subdirectory recursion)

**Mapped ACs**: AC-1 (iter-1 contract preserved)

### Alternative Flows

- **UC-7-A1: Reuse-mutation also respects FR-1.7** -- The agent's reuse-append (Stage 1 or Stage 2 affirmative) targets a file path; that path must also begin with `ondemand-` per FR-1.7
  1. Per FR-1.7, "Adding the current feature name to an existing file's `features:` array is an in-place mutation of an existing `ondemand-<slug>.md` file -- it does NOT create a new file at a non-`ondemand-` path"
  2. The reuse-mutation only targets files returned by the FR-1.1 Glob (which already filters by `ondemand-*` prefix)
  3. Therefore the FR-1.7 self-check is satisfied trivially for reuse-mutations -- the input is already filtered

  **Mapped FR**: FR-1.7, FR-1.1

### Error Flows

- **UC-7-E1: Agent's logic produces a Write to outside `~/.claude/agents/`** -- E.g., to `/tmp/ondemand-mobile-dev.md` or `./ondemand-mobile-dev.md`
  1. Per FR-1.8 / Section 5 FR-5.8 write-target restriction, the agent MUST NOT write outside the allowed directories (`~/.claude/agents/ondemand-*.md` and `.claude/roles-pending.md`)
  2. The agent's path-restriction self-check rejects the Write
  3. NO file outside the allowed paths is created

  **Mapped FR**: FR-1.7, FR-1.8

### Edge Cases

- **UC-7-EC1: Filename has uppercase prefix `Ondemand-` instead of `ondemand-`** -- Case sensitivity
  1. Per FR-1.7, the prefix MUST be the literal `ondemand-` (lowercase)
  2. `Ondemand-` does not match the case-exact prefix
  3. The self-check fails on case-sensitive filesystems; on case-insensitive filesystems, the path resolution may succeed but the rule SHOULD still flag the case-mismatch
  4. The agent auto-corrects to lowercase `ondemand-` per Rule 1

  **Mapped FR**: FR-1.7

- **UC-7-EC2: Filename has trailing whitespace or newline -- e.g., `ondemand-mobile-dev .md`** -- Sanitization edge case
  1. Per FR-1.7, the literal `ondemand-` MUST start the basename; whitespace before or in the slug is invalid
  2. The agent's self-check rejects the malformed filename
  3. Auto-correction strips whitespace

  **Mapped FR**: FR-1.7

### Data Requirements

- **Input**: PRD body (as-is)
- **Output**: Either a corrected file path Write or a dropped recommendation
- **Side Effects**: NO file at a non-`ondemand-` path is touched

---

## UC-8: Legacy On-Demand Role File (No `features:` Field) -- Migration on Match

**Actor**: `role-planner` agent, Developer (no interaction unless Stage 2 triggers), `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- `~/.claude/agents/ondemand-mobile-dev.md` exists from iter-1 (Section 5) and predates iter-2; its frontmatter LACKS the `features:` field:
  ```yaml
  ---
  name: ondemand-mobile-dev
  description: Mobile-application specialist for iOS/Android domain
  tools: ["Read", "Write", "Glob", "Grep"]
  model: sonnet
  scope: on-demand
  ---
  ```
  (No `features:` field)
- The current PRD recommends a `mobile-dev` role (slug-identical for Stage-1 path)

**Trigger**: Bootstrap Step 3.75 begins; the legacy file is encountered in the reuse-scan

### Primary Flow (Happy Path -- Migration on Stage-1 Match)

1. The agent runs the reuse-scan; Glob returns the legacy file
2. The agent reads and parses the frontmatter; per FR-7.1, the file is a "legacy on-demand role file" (lacks `features:` field)
3. The agent classifies the recommendation per FR-2.1; Stage 1 matches (slugs equal)
4. Per FR-7.2, on first encounter at Step 3.75 when the agent matches a legacy file under Stage 1 (or post-Stage-2 approval), the agent MUST migrate the legacy file by creating a `features:` field initialized as a JSON-style array containing exactly one entry -- the current `<project-name>:<feature-slug>`
5. The migration uses the FR-5.1 atomic read-modify-write contract:
   - Read entire file (already done in step 2)
   - Parse frontmatter into in-memory structure (no `features:` key in the parsed object)
   - Add `features:` key with value `["<project-name>:<feature-slug>"]` (single entry)
   - Per FR-1.2 / FR-7.2, all other frontmatter fields (name, description, tools, model, scope) are preserved byte-for-byte
   - Per FR-5.4, the body below the frontmatter is preserved byte-for-byte
   - Serialize the entire file content
   - Write the entire file in one shot
6. The migration is in-place; no new file is created
7. The `## Reuse Decisions` audit subsection records: `mobile-dev: legacy-migrated (added features: array with current feature; existing role body preserved)`
8. Bootstrap Step 3.75 SUCCEEDS

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` now has `features: ["<project-name>:<feature-slug>"]` (size 1)
- All other frontmatter fields preserved
- Body byte-identical to before
- The file is no longer a "legacy" file; future reuse-scans will treat it as a normal iter-2 file
- Audit annotation: `legacy-migrated`

**Failure modes**: FR-5.1 atomic write failure; YAML parse failure (the legacy file's frontmatter is malformed)

**Mapped FR**: FR-7.1, FR-7.2, FR-7.3 (migration is opportunistic), FR-7.5 (post-migration teardown can correctly empty the array), FR-5.1, FR-5.4, FR-8.1 (`legacy-migrated`)

**Mapped ACs**: AC-6, AC-12, AC-13, AC-14

### Alternative Flows

- **UC-8-A1: Legacy file matched under Stage 2 (purpose-match) and user approves -- migrate** -- The slug differs but purpose matches; user approves reuse
  1. Steps 1-3 proceed; Stage 2 candidate is detected (slug differs, purpose matches)
  2. The Stage-2 prompt is emitted; user replies "yes"
  3. Stage 2 resolves AFFIRMATIVELY; per FR-7.2, the legacy file is migrated AND the current feature is appended
  4. Final state: `features: ["<project-name>:<feature-slug>"]` (size 1, since legacy had no entries)
  5. Audit annotation: `legacy-migrated` (the migration takes precedence over `stage-2-purpose-match-approved` in the audit -- per FR-8.1, `legacy-migrated` is its own status; both labels could conceivably apply but FR-8.1 enumerates them as exclusive)

  **Mapped FR**: FR-7.2, FR-2.1 Stage 2, FR-8.1
  **Gap**: PRD FR-8.1 does not explicitly specify whether `legacy-migrated` and `stage-2-purpose-match-approved` can co-occur or which takes precedence in the audit. Flag for architect review.

- **UC-8-A2: Legacy file NOT matched in current invocation -- left unchanged** -- A legacy file exists but the current recommendation does not match it under Stage 1 or Stage 2
  1. The reuse-scan encounters the legacy file
  2. Stage 1 (slug-equality): FALSE
  3. Stage 2 (purpose-match): FALSE
  4. Per FR-7.3, legacy files NOT matching the current recommendation are NOT migrated -- the agent leaves the legacy file unchanged
  5. The legacy file accumulates as silent technical debt until a future feature triggers its slug
  6. The audit log MAY note "Found 1 legacy file (ondemand-mobile-dev.md) not matched by current recommendations; left unchanged" per FR-7.4 (informational, not error)

  **Mapped FR**: FR-7.3, FR-7.4

### Error Flows

- **UC-8-E1: Legacy file's YAML frontmatter is malformed in addition to lacking `features:`** -- Parse step fails
  1. The agent reads the file; YAML parse fails
  2. The agent cannot safely migrate -- the parse must succeed before the in-memory mutation can construct a valid serialization
  3. The agent emits a warning: "Cannot migrate legacy file ondemand-mobile-dev.md: malformed YAML frontmatter. Manual repair required."
  4. The recommendation falls through; if Stage 1 match was intended, the agent SHOULD treat the file as if it does not exist for reuse purposes (similar to UC-2-EC1 handling)
  5. Audit annotation: a new annotation may be needed -- the closest existing one is `legacy-migrated` (NEGATED) but this is not in FR-8.1's enumeration. Flag for architect review.

  **Mapped FR**: FR-5.1, FR-7.2
  **Gap**: PRD does not specify the exact annotation for migration-failed-due-to-malformed-YAML. Flag for architect review.

- **UC-8-E2: Atomic Write fails during migration** -- Write step fails
  1. Steps 1-5 proceed; the in-memory mutation is constructed
  2. Step 5 sub-step Write fails (disk full, permission denied)
  3. Per FR-5.7, the file is either unchanged OR fully replaced; in failure case, unchanged
  4. The legacy file remains a legacy file
  5. Bootstrap Step 3.75 reports the failure

  **Mapped FR**: FR-5.7, FR-7.2

### Edge Cases

- **UC-8-EC1: Legacy file at merge-ready Step 11** -- A legacy file exists at teardown time; per FR-7.4, the orchestrator MUST treat legacy files as no-op
  1. The orchestrator's Step 11 reads the legacy file
  2. The legacy file lacks a `features:` field -- there is no array to remove an entry from
  3. Per FR-7.4, the orchestrator MUST NOT delete legacy files at Step 11 (their lack of provenance information means the orchestrator cannot safely conclude any specific feature owns them)
  4. The orchestrator MAY emit an informational note in the FR-8.2 output: "Found 1 legacy on-demand role file without features: array -- left unchanged. Future bootstrap reuse will migrate it on demand."
  5. The legacy file is NOT counted in `N`, `M`, or `K` of the FR-3.7 summary; it is counted in the optional `L` (legacy) count per FR-8.2

  **Mapped FR**: FR-7.4, FR-7.5, FR-8.2

- **UC-8-EC2: Legacy file with EMPTY `features:` field instead of missing field** -- E.g., `features: []`
  1. Per FR-7.1, "legacy" means the `features:` field is MISSING. An empty `features: []` array is NOT legacy -- it is a normal iter-2 file with zero feature owners
  2. The agent's classification: this is NOT a legacy file
  3. At bootstrap reuse-append, the empty array becomes `["<project-name>:<feature-slug>"]` after append (UC-2-A2 path)
  4. At merge-ready Step 11, an empty array is the deletion trigger per FR-3.6 -- but only if the orchestrator finds the matching entry to remove; if the feature being torn down is not in the array, the file is `K` (unchanged)

  **Mapped FR**: FR-7.1, FR-3.6

### Data Requirements

- **Input**: Legacy file (no `features:` field), PRD recommendation, spawn context
- **Output**: Migrated file (with `features:` field added); `## Reuse Decisions` audit annotation `legacy-migrated`
- **Side Effects**: One Read of legacy file, one Write of migrated file (atomic), one Write of temp file. NO Bash. NO new file created (in-place migration)

---

## UC-9: Cross-Project Sharing -- Same Role Used by Features in Different Projects

**Actor**: `role-planner` agent, Developer

**Preconditions**:
- Common preconditions hold
- `~/.claude/agents/ondemand-mobile-dev.md` already exists with `features: ["acme-app:onboarding", "beta-app:checkout"]` -- two different projects (acme-app and beta-app) on the same machine each have features using this role
- The developer is currently on a third project, `gamma-app`, on branch `feat/payment-integration`; the project basename derived from `git rev-parse --show-toplevel` is `gamma-app`
- The current PRD recommends a `mobile-dev` role (Stage-1 match)

**Trigger**: Bootstrap Step 3.75 begins in `gamma-app`

### Primary Flow (Happy Path)

1. The agent reads the spawn context: `<project-name>=gamma-app`, `<feature-slug>=payment-integration`
2. The reuse-scan returns the existing `ondemand-mobile-dev.md` file
3. The agent reads the frontmatter; `features:` array is `["acme-app:onboarding", "beta-app:checkout"]`
4. The agent classifies: Stage 1 -- slug-equality TRUE
5. Per FR-1.2 / FR-1.3, the `<project-name>:` prefix in `features:` entries is REQUIRED to disambiguate cross-project sharing. The current entry to append is `gamma-app:payment-integration`, which is distinct from any existing entry even though the slug `payment-integration` could conceivably exist in another project
6. The agent performs the FR-5.1 atomic mutation: `features:` becomes `["acme-app:onboarding", "beta-app:checkout", "gamma-app:payment-integration"]` (size 3)
7. Per FR-5.3, the new array's total length may exceed 80 chars -- the agent SHOULD switch to the multi-line YAML block-style:
   ```yaml
   features:
     - "acme-app:onboarding"
     - "beta-app:checkout"
     - "gamma-app:payment-integration"
   ```
   (Either form is valid YAML; the agent selects based on length per FR-5.3)
8. The body of the file is preserved byte-for-byte per FR-5.4 -- the role's prompt body is consistent across all three projects (the role is generic enough to serve all three's mobile-dev needs)
9. Audit annotation: `stage-1-exact-slug-match`
10. Bootstrap Step 3.75 SUCCEEDS

**Postconditions**:
- The shared role file now has 3 feature owners across 3 projects
- The file body is unchanged (the role is shared, not project-specific)
- Future teardown of any one feature only removes that feature's entry; the other two remain

**Failure modes**: Same as UC-2 (atomic write failure)

**Mapped FR**: FR-1.2 (`<project-name>:` namespacing), FR-1.3 (project-name derivation), FR-2.1 Stage 1, FR-5.1, FR-5.3 (multi-line vs single-line), FR-5.4 (body preserved), FR-8.1

**Mapped ACs**: AC-3, AC-12, AC-13

### Alternative Flows

- **UC-9-A1: Different projects' bodies have drifted** -- A future feature in gamma-app declines reuse via Stage 2 because the body's drift means it no longer fits gamma-app's needs
  1. Per Risk 5 in PRD Section 8.7, Stage-2 is the user's safety valve for purpose-mismatch despite slug-match (or vice versa)
  2. The user replies "no" -> Stage 3 fallback creates `ondemand-mobile-dev-gamma.md` (or similar uniquely-slugged file) for project-specific isolation
  3. The shared file remains untouched; gamma-app gets its own file going forward

  **Mapped FR**: FR-2.7, Risk 5

- **UC-9-A2: Project-name resolution returns `unknown-project`** -- The orchestrator is invoked outside a git repo
  1. Per FR-1.3, if `git rev-parse --show-toplevel` errors, the project-name is the literal `unknown-project`
  2. Per FR-1.4, the feature-slug derivation requires a feature branch (`feat/...` or `fix/...`); a non-git directory cannot have a branch, so the feature-slug derivation also fails
  3. Per FR-1.4, "ANY new `features:` array append is aborted with the error message 'Cannot derive feature-slug from non-feature branch ...'" -- this also applies to the non-git case
  4. The reuse-scan still runs (read-only), but no append occurs; the agent SHOULD fall through to Stage 3 with a manual-slug warning to the user
  5. Bootstrap Step 3.75 SUCCEEDS with a warning, OR FAILS if the recommendation cannot proceed without a valid feature-slug

  **Mapped FR**: FR-1.3, FR-1.4
  **Gap**: PRD FR-1.4 wording focuses on non-feature-branch refusal but does not explicitly cover the non-git case for the bootstrap-time append path. The orchestrator-side derivation should error out with a clear message; flag for architect review.

### Error Flows

- **UC-9-E1: Two projects' simultaneous feature work race on the shared file** -- See UC-CC-2 below for the full cross-cutting scenario
  1. Project A's `/bootstrap-feature` reads the file at time T0; project B's `/bootstrap-feature` reads at T0 + epsilon
  2. Both compute their respective in-memory mutations
  3. Whichever's Write finishes last overwrites the earlier Write per NFR-3 last-write-wins
  4. The earlier Write's append is silently lost
  5. Per NFR-3, multi-pipeline coordination is OUT OF SCOPE; the developer's audit trail surfaces the disagreement

  **Mapped FR**: NFR-3 (single-user single-machine assumption, last-write-wins)

### Edge Cases

- **UC-9-EC1: Project-name contains special characters** -- E.g., the directory basename is `My App!` (with space and exclamation)
  1. Per FR-1.3, the project-name is `basename "$(git rev-parse --show-toplevel)"` literal
  2. The literal name `My App!` would be embedded in `features:` as `"My App!:feature-slug"`
  3. JSON-style YAML quoting handles spaces and special characters: `features: ["My App!:feature-slug"]` is valid YAML
  4. The agent's parser MUST round-trip these characters correctly via FR-5.1's parse + serialize steps
  5. NOTE: Project naming with spaces is unusual; most repos use kebab-case or snake_case basenames

  **Mapped FR**: FR-1.2, FR-1.3, FR-5.1

- **UC-9-EC2: Project-name collides with a feature-slug from another project** -- E.g., project `mobile-dev` has feature `mobile-dev:onboarding` while project `acme-app` has feature `acme-app:mobile-dev`
  1. The `<project-name>:<feature-slug>` namespacing is unambiguous because the colon-separator is structural; there is no collision at the entry-string level
  2. Even pathological inputs are disambiguated

  **Mapped FR**: FR-1.2

### Data Requirements

- **Input**: Shared `ondemand-mobile-dev.md` file with multi-project `features:` array; current spawn context
- **Output**: Shared file with one more entry; `.claude/roles-pending.md` with `stage-1-exact-slug-match` audit
- **Side Effects**: One Read, one Write (atomic), one temp-file write. The shared file's body is byte-unchanged

---

## UC-10: Post-Merge Teardown -- Feature Removed, File Kept (Other Features Still Listed)

**Actor**: `/merge-ready` orchestrator, Developer (no interaction required for teardown)

**Preconditions**:
- Common preconditions hold (with the orchestrator being `/merge-ready` instead of `/bootstrap-feature`)
- The current branch is `main` AFTER the developer just merged `feat/checkout-flow-redesign` into `main` (the merge has been performed; `git merge-base --is-ancestor <feat/checkout-flow-redesign-head> main` returns zero)
- The project basename is `acme-app`; the feature-slug derived from the merged branch is `checkout-flow-redesign`
- `~/.claude/agents/ondemand-mobile-dev.md` exists with `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]` -- size 2
- The feature `checkout-flow-redesign` was the only iter-2 reuse decision touching this file; the other entry (`onboarding`) belongs to a previously-shipped feature
- All Gates 1-9 of `/merge-ready` have completed

**Trigger**: `/merge-ready` reaches Step 11 Post-Merge Teardown after Gate 9 completes

### Primary Flow (Happy Path)

1. The orchestrator at Step 11 entry derives `<project-name>` and `<feature-slug>` per FR-3.4 / FR-3.5:
   - `basename "$(git rev-parse --show-toplevel)"` -> `acme-app`
   - The merged branch is identified per FR-3.5 -- e.g., from the most recent merge commit on `main` (`git log -1 --merges` head's branch name) -> `feat/checkout-flow-redesign`
   - `<feature-slug>` = `checkout-flow-redesign` (after stripping `feat/` prefix)
2. The orchestrator verifies merge-ancestry per FR-4.1: `git merge-base --is-ancestor <feature-branch-head> main` returns zero (branch is merged); verification PASSES
3. The orchestrator scans `~/.claude/agents/ondemand-*.md` per FR-3.6:
   - The Glob returns the file
   - The orchestrator Reads the file and parses the frontmatter
   - The `features:` array is `["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`
4. The orchestrator searches for the entry `acme-app:checkout-flow-redesign`; found
5. The orchestrator removes the matching entry: `features:` becomes `["acme-app:onboarding"]` (size 1, non-empty)
6. Since the resulting array is NON-EMPTY, the file is NOT deleted -- per FR-3.6 the file is kept on disk with the modified array
7. The orchestrator performs the FR-5.1 atomic write to update the file:
   - In-memory mutation: remove the entry
   - Per FR-5.3, the new short array stays on a single line: `features: ["acme-app:onboarding"]`
   - Per FR-5.5, the file body below the frontmatter is preserved byte-for-byte
   - Write the entire file
8. Per FR-4.7, the orchestrator logs the per-file decision: `ondemand-mobile-dev.md` -> updated (entry removed, array still non-empty)
9. The orchestrator's FR-8.2 summary line: `Post-Merge: On-Demand Role Teardown -- 1 roles updated, 0 deleted, 0 unchanged`
10. Step 11 SUCCEEDS (it is a STEP, not a gate; it always succeeds in the sense that it reports its outcome to the audit -- per FR-3.1 it does not have PASS/FAIL semantics)

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-dev.md` exists with `features: ["acme-app:onboarding"]` (size went from 2 to 1)
- The file was NOT deleted
- File body byte-unchanged
- The other feature (`onboarding`) still references this role
- `/merge-ready` output table includes the Step 11 row with the FR-8.2 summary line
- `/merge-ready` overall result is determined by Gates 1-9 alone (Step 11 does not affect gate-pass tally per FR-3.1)

**Failure modes**: FR-5.1 atomic write failure (disk full, permission denied); orchestrator detection of merge-ancestry fails (covered by UC-13)

**Mapped FR**: FR-3.1 (Step 11 placement), FR-3.3 (orchestrator does the work, not the agent), FR-3.4, FR-3.5, FR-3.6 (per-file mutation, conditional deletion), FR-3.7 (summary counts), FR-4.1 (merge-ancestry verification), FR-4.7 (per-file audit), FR-5.1, FR-5.5, FR-8.2

**Mapped ACs**: AC-7, AC-8, AC-12, AC-13, AC-17

### Alternative Flows

- **UC-10-A1: Multiple ondemand files updated -- multiple `N` count** -- The merged feature was a user of three different ondemand roles; all three need entry removal
  1. Steps 1-2 proceed
  2. The Glob returns three matching files
  3. For each file, the orchestrator removes the matching entry; for each, the resulting array is non-empty
  4. All three files are `updated` (entry removed, kept on disk)
  5. Summary line: `Post-Merge: On-Demand Role Teardown -- 3 roles updated, 0 deleted, 0 unchanged`

  **Mapped FR**: FR-3.6, FR-3.7

- **UC-10-A2: Mixed outcomes -- some files updated, some deleted, some unchanged** -- The pool has 5 files; 2 contain the feature entry and have other entries (updated), 1 contains the feature entry as the only entry (deleted), 2 don't contain the feature entry (unchanged)
  1. Per file:
     - File 1: `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]` -> removed entry; array now `["acme-app:onboarding"]` -> updated
     - File 2: same shape -> updated
     - File 3: `features: ["acme-app:checkout-flow-redesign"]` -> removed entry; array now `[]` -> DELETED per FR-3.6
     - File 4: `features: ["other-app:somewhere"]` -> entry not found -> unchanged
     - File 5: `features: ["acme-app:other-feature"]` -> entry not found -> unchanged
  2. Summary line: `Post-Merge: On-Demand Role Teardown -- 2 roles updated, 1 deleted, 2 unchanged`

  **Mapped FR**: FR-3.6, FR-3.7

### Error Flows

- **UC-10-E1: Atomic Write fails during entry removal** -- Disk full
  1. The in-memory mutation is constructed
  2. Write fails
  3. Per FR-5.7, file is either unchanged or fully replaced; in failure, unchanged
  4. The orchestrator's per-file audit records the failure for this file: "ondemand-mobile-dev.md: removal failed (disk full)"
  5. The orchestrator continues to the next file (per FR-4.7 per-file audit pattern; one file's failure does not abort the entire scan)
  6. Summary line reflects partial completion; the failed file may be counted as `K` (unchanged) or noted separately. Flag for architect review on exact accounting

  **Mapped FR**: FR-5.7, FR-4.7
  **Gap**: PRD FR-3.7 / FR-8.2 do not explicitly specify how to count failed-update files. Flag for architect review.

- **UC-10-E2: Read fails on individual file** -- Permission denied on a single ondemand file
  1. The Glob returns the file
  2. Read fails
  3. The orchestrator cannot parse the frontmatter; the file's `features:` array cannot be safely mutated
  4. The orchestrator emits a warning to the audit and continues to the next file
  5. The unreadable file is counted as a separate audit entry; not in N/M/K

  **Mapped FR**: FR-4.7

### Edge Cases

- **UC-10-EC1: File's `features:` array contains the entry multiple times** -- A pathological state from manual editing or a bug in iter-1
  1. Per FR-3.6, the orchestrator MUST remove the matching entry; the iteration semantics depend on whether "remove the matching entry" means "remove first occurrence" or "remove all occurrences"
  2. Per the idempotency principle (NFR-2), removing all occurrences is consistent with idempotent behavior on re-run -- but this is not explicit in PRD FR-3.6
  3. The safer interpretation: remove ALL occurrences of the matching entry; this ensures NFR-2 idempotency
  4. After removal, the resulting array's emptiness check determines deletion vs. update per FR-3.6

  **Mapped FR**: FR-3.6, NFR-2
  **Gap**: PRD FR-3.6 does not explicitly specify single-occurrence vs. all-occurrence removal. Flag for architect review.

- **UC-10-EC2: File has only `features:` field with empty array `[]` and the feature is not in the array** -- Edge case from prior partial-failure or manual editing
  1. The orchestrator searches for the entry; not found
  2. The file is `K` (unchanged)
  3. The empty `features: []` array is NOT a deletion trigger by itself -- deletion is conditional on becoming empty AS A RESULT OF the current entry removal per FR-3.6; an already-empty array stays as-is
  4. NOTE: A file with `features: []` will never be deleted by Step 11 unless its array gets a new entry first via bootstrap reuse-append, and then that entry is removed via teardown. As a degenerate state it will accumulate as silent debt

  **Mapped FR**: FR-3.6
  **Gap**: PRD FR-3.6 wording "the resulting `features:` array is EMPTY (zero entries), the orchestrator MUST instead delete the file entirely" implies deletion only triggers from the act of removal making it empty, not finding it pre-empty. Flag for clarification.

### Data Requirements

- **Input**: Spawn context (project-name, feature-slug, merged-branch info), `~/.claude/agents/ondemand-*.md` pool
- **Output**: Updated files (one entry removed each); FR-8.2 summary line in `/merge-ready` output
- **Side Effects**: One Glob, N Reads, N Writes (one per updated file), zero deletions in this UC. One `git merge-base --is-ancestor` invocation per FR-4.1. One `basename ...` invocation per FR-3.4

---

## UC-11: Post-Merge Teardown -- Feature Was Last User, File Deleted

**Actor**: `/merge-ready` orchestrator

**Preconditions**:
- Common preconditions hold
- The merged branch is `feat/role-planner-reuse-teardown`; the project is `claude-code-sdlc`
- `~/.claude/agents/ondemand-some-specialist.md` exists with `features: ["claude-code-sdlc:role-planner-reuse-teardown"]` -- size 1, the merged feature is the only user
- All Gates 1-9 have completed

**Trigger**: `/merge-ready` Step 11 begins

### Primary Flow (Happy Path)

1. The orchestrator derives project-name and feature-slug per FR-3.4 / FR-3.5: `claude-code-sdlc:role-planner-reuse-teardown`
2. Merge-ancestry verification PASSES per FR-4.1
3. The orchestrator scans the on-demand pool; finds `ondemand-some-specialist.md`
4. The orchestrator reads the file; `features:` array is `["claude-code-sdlc:role-planner-reuse-teardown"]`
5. The orchestrator searches for the entry; found
6. In-memory mutation: removes the entry; resulting array is `[]` (EMPTY)
7. Per FR-3.6, when the resulting `features:` array is EMPTY, the orchestrator MUST instead DELETE the file entirely (instead of writing the empty-array version)
8. Per FR-4.3 defense-in-depth, the orchestrator resolves the file path and verifies it is under `~/.claude/agents/` AND begins with the literal `ondemand-` prefix; deletion proceeds via `rm` (Bash)
9. The deletion command is `rm ~/.claude/agents/ondemand-some-specialist.md` (or the resolved absolute path)
10. Per FR-4.4, the deletion is restricted to `~/.claude/agents/ondemand-*.md` paths; core agents (without prefix) are excluded
11. Per FR-4.5, the orchestrator verifies the file's frontmatter `scope` is `on-demand` BEFORE deleting; if `scope` is missing or different, the file is treated as core and SKIPPED with a marker-mismatch warning
12. Deletion succeeds; the file is removed from disk
13. Per FR-4.7, the orchestrator logs: `ondemand-some-specialist.md -> deleted`
14. Summary line: `Post-Merge: On-Demand Role Teardown -- 0 roles updated, 1 deleted, 0 unchanged`

**Postconditions**:
- `~/.claude/agents/ondemand-some-specialist.md` no longer exists
- The on-demand pool size went from 1 to 0
- `/merge-ready` output records the deletion in the FR-8.2 summary

**Failure modes**: `rm` fails (permission denied, file in use, etc.); FR-4.5 marker-mismatch SKIP

**Mapped FR**: FR-3.6 (deletion when array empty), FR-4.3 (path resolution defense-in-depth), FR-4.4 (only ondemand- prefix), FR-4.5 (scope marker check), FR-4.7 (audit), FR-3.7 / FR-8.2 (summary)

**Mapped ACs**: AC-8, AC-11, AC-17

### Alternative Flows

- **UC-11-A1: Multiple files deleted in one Step 11 invocation** -- Several merged-feature-only files
  1. The merged feature was the sole owner of three different ondemand roles
  2. All three files have `features:` arrays of size 1 containing only this feature
  3. All three are deleted in this Step 11
  4. Summary line: `0 roles updated, 3 deleted, 0 unchanged`

  **Mapped FR**: FR-3.6, FR-3.7

- **UC-11-A2: Mixed update + deletion -- the canonical mixed teardown** -- See UC-10-A2

  **Mapped FR**: FR-3.6, FR-3.7

### Error Flows

- **UC-11-E1: `rm` fails (permission denied)** -- The file is owned by a different user or has restricted permissions
  1. The orchestrator invokes `rm ~/.claude/agents/ondemand-some-specialist.md`
  2. `rm` returns non-zero with stderr "Permission denied"
  3. Per FR-4.7, the orchestrator logs the failure for this file
  4. The file remains on disk with the empty-array state... WAIT: per FR-3.6 the orchestrator's intent was to delete (not write empty array). Without the deletion succeeding, the file would either be left in its prior state (entry intact, array non-empty) OR in an empty-array state. The FR-3.6 wording is ambiguous about the intermediate state when deletion fails after the in-memory mutation
  5. Safer interpretation: the orchestrator SHOULD perform the deletion atomically -- if `rm` fails, leave the file in its prior state on disk. Do NOT first write an empty-array version and then try to delete; that produces a worse intermediate state on failure
  6. The audit logs the deletion-failure
  7. Summary counts the file as a separate audit entry; not in N/M/K. Flag for architect review on exact accounting

  **Mapped FR**: FR-3.6, FR-4.7
  **Gap**: PRD does not specify the order of operations (write-then-delete vs. delete-only) when array becomes empty. Flag for architect review.

- **UC-11-E2: FR-4.5 marker-mismatch -- file has `ondemand-` prefix but `scope` is not `on-demand`** -- A file at `~/.claude/agents/ondemand-foo.md` whose frontmatter says `scope: core`
  1. Per FR-4.5, files passing only the prefix marker but not the scope marker are TREATED AS CORE and SKIPPED -- the file is NOT deleted
  2. The orchestrator emits a warning: "Marker mismatch on ondemand-foo.md: scope is 'core', not 'on-demand'. Skipping teardown for this file."
  3. The file is counted in the audit log but NOT in N/M/K of the standard summary
  4. Summary line includes the marker-mismatch count separately if any (e.g., `; 1 skipped-marker-mismatch`)

  **Mapped FR**: FR-4.5, FR-4.7

### Edge Cases

- **UC-11-EC1: File path is a symlink** -- `~/.claude/agents/ondemand-mobile-dev.md` is a symlink pointing to `/etc/passwd` (path-traversal attack)
  1. Per FR-4.3, the orchestrator MUST resolve the file path and verify the resolved path is under `~/.claude/agents/` BEFORE deletion
  2. The path resolution returns `/etc/passwd`, which is NOT under `~/.claude/agents/`
  3. The orchestrator REFUSES the deletion; emits a warning: "Path traversal attempt detected: ondemand-mobile-dev.md resolves to /etc/passwd. Skipping deletion."
  4. The file is left on disk; the developer manually investigates the symlink

  **Mapped FR**: FR-4.3

- **UC-11-EC2: File path contains shell metacharacters** -- A pathological filename like `ondemand-foo;rm -rf ~.md`
  1. Per FR-4.3, defense-in-depth path resolution catches this; the orchestrator's `rm` invocation MUST quote the path properly to prevent shell injection
  2. The Bash whitelist of `/merge-ready`'s standard runtime should restrict `rm` invocations to bounded forms
  3. The pathological filename, even if it exists, cannot escalate via deletion
  4. NOTE: This is a defense-in-depth concern; in practice ondemand filenames produced by `role-planner` follow the `ondemand-<slug>.md` pattern with safe character classes

  **Mapped FR**: FR-4.3

- **UC-11-EC3: File becomes empty due to NFR-2 idempotent re-run** -- The teardown was already run; re-running finds the file already deleted
  1. Per NFR-2, re-running Step 11 is safe -- already-deleted files are absent from the FR-1.1 glob and are simply not scanned
  2. The summary reflects only files that actually exist; the second run produces `0 deleted, 0 updated, K unchanged` for files that have other features still in their arrays

  **Mapped FR**: NFR-2

### Data Requirements

- **Input**: Same as UC-10 plus the file containing only the merged feature
- **Output**: File deleted from disk; summary line records `1 deleted`
- **Side Effects**: One Glob, one Read, one `rm` invocation (Bash). The deletion is atomic at the OS level

---

## UC-12: Post-Merge Teardown -- Refuse to Run from `main` with No Feature-Slug Argument

**Actor**: `/merge-ready` orchestrator (refusing to perform teardown)

**Preconditions**:
- Common preconditions hold
- The current branch is `main`
- There is no recent merge commit visible in `git log -1 --merges`, OR the developer has not passed any explicit `--feature-slug=<slug>` argument (iter-2 does not yet support this argument; future iter-3 may)
- The orchestrator cannot determine which feature just merged

**Trigger**: `/merge-ready` is invoked from `main` directly without merged-PR context; Step 11 is reached

### Primary Flow (Happy Path -- Refusal)

1. The orchestrator at Step 11 entry attempts to derive `<feature-slug>` per FR-3.5
2. Per FR-3.5, "if the orchestrator cannot determine the merged branch (e.g., `/merge-ready` is invoked from `main` directly without context about which feature just merged), Step 11 MUST refuse to run per FR-4.2"
3. Per FR-4.2, the orchestrator REFUSES to run teardown; emits the literal error message:
   ```
   Refusing teardown from main without explicit feature-slug -- pass via merged PR context or skip Step 11
   ```
4. Per FR-8.2, the orchestrator emits the FR-8.2 summary line with all three counts at zero:
   ```
   Post-Merge: On-Demand Role Teardown -- 0 roles updated, 0 deleted, 0 unchanged
   (Refusal: Refusing teardown from main without explicit feature-slug -- pass via merged PR context or skip Step 11)
   ```
5. Per FR-3.1 / FR-4.2, the refusal does NOT block merge-readiness -- Step 11 is a STEP, not a gate
6. Gates 1-9 may have all passed; `/merge-ready` overall result is determined by gates only
7. Step 11 records the refusal but does not affect gate-pass tally

**Postconditions**:
- NO file in `~/.claude/agents/` was scanned, mutated, or deleted
- The on-demand pool is in the same state as before Step 11
- `/merge-ready` output records the refusal in the FR-8.2 row
- `/merge-ready` overall outcome is unaffected (Gates 1-9 determine merge-readiness)

**Failure modes**: None -- refusal is the safe behavior; FR-4.2 explicitly prefers refusal over guessing

**Mapped FR**: FR-3.5, FR-4.2 (refuse-from-main rule), FR-8.2 (summary line with refusal message)

**Mapped ACs**: AC-9

### Alternative Flows

- **UC-12-A1: Developer is on `main` but a recent merge commit IS visible** -- E.g., the developer just merged via `git merge --no-ff feat/foo` locally and is now running `/merge-ready` from `main`
  1. Per FR-3.5, the orchestrator inspects `git log -1 --merges` and finds a recent merge commit
  2. The orchestrator extracts the merged-branch name from the merge commit's message or parents
  3. Feature-slug derivation succeeds; Step 11 proceeds normally per UC-10 / UC-11

  **Mapped FR**: FR-3.5

- **UC-12-A2: Developer is on `main` and has many merges in history -- the orchestrator picks the MOST RECENT** -- A long-lived `main` branch
  1. Per FR-3.5, the most-recent merge commit (via `git log -1 --merges` or equivalent) is the source
  2. Older merges are not retroactively torn down -- iter-2 does not support backfill; teardown is per-merge

  **Mapped FR**: FR-3.5

### Error Flows

- **UC-12-E1: `git log -1 --merges` returns ambiguous output** -- E.g., the merged branch's name cannot be reliably extracted
  1. The orchestrator's parsing of merge commit context fails
  2. Per FR-4.2, when the merged-branch identification cannot be determined, the orchestrator REFUSES per the same rule
  3. Same FR-8.2 refusal output as UC-12 primary flow

  **Mapped FR**: FR-3.5, FR-4.2

### Edge Cases

- **UC-12-EC1: Developer is on `main` but the working tree has uncommitted changes** -- An unusual state
  1. The orchestrator's branch-identification still uses `main`
  2. Per FR-4.2, refusal applies; uncommitted changes do not affect teardown context
  3. The developer SHOULD commit or stash before running `/merge-ready`

  **Mapped FR**: FR-4.2

- **UC-12-EC2: `/merge-ready` invoked from a non-main, non-feature branch** -- E.g., on `develop` or `release/v1.0`
  1. Per FR-1.4 and FR-3.5, the feature-slug derivation requires a `feat/...` or `fix/...` branch
  2. From a non-feature branch like `develop`, the derivation fails
  3. The orchestrator may refuse per the same rule, OR may apply a different non-feature-branch rule
  4. The PRD's FR-4.2 wording focuses on `main` specifically; non-main, non-feature branches are not explicitly covered. Flag for architect review

  **Mapped FR**: FR-4.2
  **Gap**: PRD FR-4.2 specifies refusal from `main` but does not explicitly specify refusal from other non-feature branches like `develop`. Flag for architect review.

### Data Requirements

- **Input**: Current branch context (`main` with no merged-PR info)
- **Output**: FR-8.2 summary line with the literal refusal message and zero counts
- **Side Effects**: ZERO file system mutations. The orchestrator does NOT scan, read, or modify any ondemand file in this scenario

---

## UC-13: Post-Merge Teardown -- Refuse if Branch Not Yet Merged

**Actor**: `/merge-ready` orchestrator

**Preconditions**:
- Common preconditions hold
- The current branch is `feat/role-planner-reuse-teardown` (a feature branch); the developer is running `/merge-ready` LOCALLY before the actual merge to `main`
- The branch has NOT yet been merged into `main` -- `git merge-base --is-ancestor <feature-branch-head> main` returns NON-zero
- The developer is running `/merge-ready` to check whether the feature is ready to merge

**Trigger**: `/merge-ready` Step 11 begins; merge-ancestry check is performed

### Primary Flow (Happy Path -- Refusal)

1. The orchestrator derives `<project-name>=claude-code-sdlc` and `<feature-slug>=role-planner-reuse-teardown` per FR-3.4 / FR-3.5 (the feature branch is identifiable; this is NOT the UC-12 case)
2. Per FR-4.1, the orchestrator verifies merge-ancestry: `git merge-base --is-ancestor <feature-branch-head> main` returns NON-ZERO (the branch is NOT yet merged)
3. The verification FAILS
4. Per FR-4.1, the orchestrator REFUSES to perform teardown; emits the literal error message:
   ```
   Refusing teardown: branch 'role-planner-reuse-teardown' is not yet merged into main
   ```
5. Per FR-8.2, the FR-8.2 summary line is emitted with all three counts at zero:
   ```
   Post-Merge: On-Demand Role Teardown -- 0 roles updated, 0 deleted, 0 unchanged
   (Refusal: Refusing teardown: branch 'role-planner-reuse-teardown' is not yet merged into main)
   ```
6. Per FR-3.1, the refusal does NOT block merge-readiness -- Step 11 is a STEP, not a gate
7. Gates 1-9 determine `/merge-ready` overall result; if they pass, the developer can proceed to actually merge the branch
8. After the developer merges, they re-run `/merge-ready` (or just Step 11 alone in a future iteration) -- now the branch IS merged, and Step 11 runs normally per UC-10 / UC-11

**Postconditions**:
- NO file in `~/.claude/agents/` was scanned or mutated -- the refusal is at Step 11 entry
- The on-demand pool state is unchanged
- `/merge-ready` output records the refusal
- The developer understands they need to merge first, then re-run

**Failure modes**: None -- refusal is the safe behavior

**Mapped FR**: FR-4.1 (merge-ancestry verification), FR-8.2

**Mapped ACs**: AC-10

### Alternative Flows

- **UC-13-A1: Branch is partially merged via squash-merge -- merge-ancestry check returns non-zero** -- Per Section 8.4 item 6, squash-merge is OUT OF SCOPE
  1. The developer used GitHub's "Squash and merge" -- the squashed commit on `main` has a different SHA than the feature branch's tip
  2. `git merge-base --is-ancestor <feature-tip> main` returns NON-ZERO (the original commit is not an ancestor)
  3. Per FR-4.1, refusal applies -- the orchestrator cannot distinguish "actually unmerged" from "squash-merged"
  4. The conservative refusal is the safe behavior; the developer manually removes ondemand role files for squash-merged features
  5. NOTE: Per Risk 8 in PRD Section 8.7, robust handling of squash/rebase is iter-3+ territory

  **Mapped FR**: FR-4.1, Risk 8

- **UC-13-A2: Branch is rebase-merged -- similar to squash-merge** -- Per Section 8.4 item 6
  1. Same outcome as UC-13-A1; refusal applies; manual cleanup required

  **Mapped FR**: FR-4.1

### Error Flows

- **UC-13-E1: `git merge-base` command itself fails** -- E.g., `git` not on PATH or the repo is corrupted
  1. The orchestrator's invocation of `git merge-base --is-ancestor` errors
  2. The verification cannot complete
  3. Per FR-4.1 / FR-4.6 (no-network / fail-clean), the orchestrator MUST refuse teardown rather than guess
  4. Same FR-8.2 refusal output

  **Mapped FR**: FR-4.1, FR-4.6

### Edge Cases

- **UC-13-EC1: Developer manually pulls main BEFORE re-running** -- Idempotency in action
  1. Per Risk 4 in PRD Section 8.7: "False negatives (teardown declines when the branch is 'morally merged' but the local main hasn't been pulled yet) are possible -- the developer simply re-runs `/merge-ready` after `git pull` updates `main`"
  2. After `git pull`, the local `main` includes the merge; merge-ancestry check now PASSES
  3. Step 11 proceeds normally per UC-10 / UC-11
  4. NFR-2 idempotency ensures the re-run is safe

  **Mapped FR**: NFR-2, Risk 4

- **UC-13-EC2: Branch has been pushed to remote AND merged in remote `main`, but local `main` is stale** -- The developer hasn't pulled
  1. The local `git merge-base --is-ancestor` operates on local refs; the local `main` does not include the merge
  2. Refusal applies per FR-4.1
  3. The developer is told to re-run after pulling

  **Mapped FR**: FR-4.1, FR-4.6 (no network, all info local)

### Data Requirements

- **Input**: Current branch context (feature branch, not yet merged)
- **Output**: FR-8.2 summary line with refusal message
- **Side Effects**: One `git merge-base` invocation. ZERO file system mutations on ondemand files

---

## UC-14: Atomic Frontmatter Mutation -- Concurrent Modification Detected via Re-Read

**Actor**: `role-planner` agent (bootstrap path) OR `/merge-ready` orchestrator (teardown path), Developer (concurrent manual editor)

**Preconditions**:
- Common preconditions hold
- `~/.claude/agents/ondemand-mobile-dev.md` exists with `features: ["acme-app:onboarding"]`
- The developer has manually opened the file in an editor and is making changes (e.g., adjusting `description:` or manually appending an entry to `features:`)

**Trigger**: At the same time as the developer's manual edit, the agent (bootstrap path) OR orchestrator (teardown path) is performing an FR-5.1 atomic read-modify-write

### Primary Flow (Happy Path -- Last-Write-Wins per NFR-3)

1. The agent/orchestrator Reads the file at time T0; the in-memory representation reflects state-at-T0: `features: ["acme-app:onboarding"]`
2. The agent/orchestrator constructs the in-memory mutation; e.g., append `acme-app:checkout-flow-redesign` -> `["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`
3. Concurrently, the developer manually edits the file in their editor and saves at time T0 + delta1; the developer's saved state is `features: ["acme-app:onboarding", "manually-added:something"]`
4. The agent/orchestrator's Write at time T0 + delta2 (where delta2 > delta1) replaces the developer's saved state with the agent's in-memory mutation
5. The developer's manual addition is silently lost; the file ends up as `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]` (without the developer's `manually-added:something`)
6. Per NFR-3, this is the documented last-write-wins behavior; iter-2 does NOT include file-locking, mutex, or retry-on-conflict
7. The audit trail in `## Reuse Decisions` (bootstrap) or `/merge-ready` output (teardown) reflects the agent/orchestrator's intended mutation, NOT the developer's manual edit
8. The developer notices the discrepancy when they next open the file; they re-apply their manual edit if still desired

**Postconditions**:
- The file's final state reflects the agent/orchestrator's mutation, NOT the developer's concurrent edit
- The developer's edit is silently lost
- Per NFR-3, this is acceptable iter-2 behavior; multi-pipeline / multi-editor concurrency is OUT OF SCOPE per Section 8.4 item 7

**Failure modes**: None per iter-2 contract -- last-write-wins is the documented behavior

**Mapped FR**: FR-5.1 (atomic read-modify-write), FR-5.6 (concurrent mutation out of scope), NFR-3

**Mapped ACs**: AC-12 (atomic mutation contract)

### Alternative Flows

- **UC-14-A1: Developer's edit is preserved (developer wins)** -- The developer's save happens AFTER the agent/orchestrator's Write
  1. T0: agent reads file
  2. T0 + delta1: agent writes; file now has agent's intended state
  3. T0 + delta2 (delta2 > delta1): developer saves their manual edit; the developer's editor's local copy was the pre-agent-write state, so the developer's save overwrites with the developer's state
  4. The agent's mutation is silently lost
  5. The audit trail records the agent's intent, but the on-disk state reflects the developer's edit
  6. Per NFR-3, this is symmetric last-write-wins behavior

  **Mapped FR**: NFR-3

- **UC-14-A2: Developer fixes inconsistency by re-running bootstrap** -- After noticing the audit-trail vs. on-disk mismatch
  1. The developer re-runs `/bootstrap-feature`; the agent re-scans, finds the file in its current state, and applies the mutation again
  2. Per NFR-2 idempotency, re-running is safe; the entry is appended (or de-duplicated per UC-2-A1)

  **Mapped FR**: NFR-2

### Error Flows

- **UC-14-E1: Developer's manual edit produces malformed YAML** -- The developer's save corrupts the frontmatter (e.g., unclosed bracket)
  1. T0: agent reads file (well-formed)
  2. T0 + delta1: developer saves malformed version
  3. T0 + delta2: agent writes its intended (well-formed) version, OVERWRITING the malformed version -- the agent's atomic Write fixes the developer's malformation as a side effect (because the agent re-serializes from a parsed-then-mutated structure)
  4. The developer's save was silently lost AND the malformation was repaired
  5. Per Risk 7 in PRD Section 8.7, this is the documented behavior; iter-2 does NOT include programmatic repair, but the agent's re-serialization happens to repair in this race ordering

  **Mapped FR**: FR-5.1, FR-5.2 (whole-file replacement)

### Edge Cases

- **UC-14-EC1: Both agent/orchestrator and developer save at same instant** -- Sub-millisecond timing
  1. The OS's file system semantics determine which Write reaches disk last
  2. NFR-3 last-write-wins applies; the loser's data is silently lost
  3. The audit trail surfaces the agent/orchestrator's intent; the developer can compare and reconcile

  **Mapped FR**: NFR-3

- **UC-14-EC2: Two parallel `/bootstrap-feature` invocations on different feature branches race on the same file** -- Two terminals, one developer
  1. Per NFR-3 / Section 8.4 item 7, multi-pipeline coordination is OUT OF SCOPE
  2. Last-write-wins applies; the loser's append is silently lost
  3. The audit trail in each invocation's `## Reuse Decisions` records that invocation's intended mutation; comparing the two audits surfaces the disagreement
  4. The developer manually reconciles by re-running one of the bootstraps after the other completes -- NFR-2 idempotency makes this safe

  **Mapped FR**: NFR-3, NFR-2

### Data Requirements

- **Input**: File at time T0; concurrent developer edit at T0 + delta
- **Output**: Whichever write happens last is preserved
- **Side Effects**: One Read, one Write (atomic). The file's prior state is not preserved across writes (no backup, no version history)

---

## UC-15: Idempotent Teardown -- Re-Running on Already-Torn-Down State is No-Op

**Actor**: `/merge-ready` orchestrator

**Preconditions**:
- Common preconditions hold
- The developer has previously run `/merge-ready` for the feature `claude-code-sdlc:role-planner-reuse-teardown` after merging; Step 11 ran successfully and produced one of: file deleted (UC-11), file updated (UC-10), or no-op (no matching entries)
- The developer re-invokes `/merge-ready` (e.g., to verify a CI pipeline, or because the prior run was interrupted before completing some non-teardown gate, or simply for safety)
- The on-demand pool reflects the post-teardown state -- entries removed, deleted files absent

**Trigger**: `/merge-ready` Step 11 begins on the second invocation

### Primary Flow (Happy Path)

1. The orchestrator derives project-name and feature-slug per FR-3.4 / FR-3.5: same as before
2. Merge-ancestry verification PASSES (the branch was already merged on the prior run; merging once is enough)
3. The orchestrator scans the on-demand pool per FR-3.6
4. For each existing file, the orchestrator searches for the entry `claude-code-sdlc:role-planner-reuse-teardown`; per NFR-2, the entry is no longer found in any file (it was removed on the prior run, or the file was deleted)
5. Each existing file is `K` (unchanged) -- no entry to remove
6. Files deleted on the prior run are absent from the Glob and not scanned
7. Summary line: `Post-Merge: On-Demand Role Teardown -- 0 roles updated, 0 deleted, K unchanged` (where K is the count of remaining ondemand files)
8. Per NFR-2, this re-invocation produces IDENTICAL state on disk to before the re-invocation -- the second run is a no-op
9. Step 11 SUCCEEDS (in the report-outcome sense; per FR-3.1 it has no PASS/FAIL semantics)

**Postconditions**:
- The on-demand pool is in the same state as after the first run
- No file was modified, no file was deleted on this re-invocation
- `/merge-ready` output records `0 roles updated, 0 deleted` -- the no-op signature
- The developer can re-run safely as many times as desired

**Failure modes**: None -- the no-op is the entire flow

**Mapped FR**: NFR-2 (idempotency), FR-3.6, FR-3.7, FR-8.2

**Mapped ACs**: AC-8 (re-runnable per AC-8 implicit), NFR-2 explicit

### Alternative Flows

- **UC-15-A1: Re-run after a different feature was merged in between** -- The developer ran `/merge-ready` for feature A, then merged feature B, then re-runs `/merge-ready` for feature B
  1. The first run for feature A torn down feature A's entries
  2. The merge of feature B happened
  3. The second run for feature B has feature B as the merged-branch context
  4. Step 11 looks for `<project>:<feature-B-slug>` entries
  5. The pool reflects feature B's reuse-time state (entries were appended at feature B's bootstrap)
  6. The teardown for feature B runs normally per UC-10 / UC-11 -- this is NOT idempotent re-run; it is a legitimate new teardown for a different feature

  **Mapped FR**: NFR-2 (per-feature idempotency), FR-3.6

- **UC-15-A2: Re-run produces partial differences due to manual editing between runs** -- The developer manually re-added the feature entry to one file between runs
  1. Run 1 removes the entry from File X (X is now `["acme-app:onboarding"]`)
  2. Developer manually edits X to add back the feature entry: `["acme-app:onboarding", "claude-code-sdlc:role-planner-reuse-teardown"]`
  3. Run 2 finds the entry in X and removes it again
  4. Re-run is NOT a strict no-op in this case -- it actively un-does the developer's manual edit
  5. Per NFR-3, last-write-wins applies; the developer's manual edit is reversed by run 2
  6. Audit trail: run 2 shows `1 roles updated` (X was modified again), reflecting the actual on-disk change

  **Mapped FR**: NFR-2, NFR-3

### Error Flows

- **UC-15-E1: Pool size grew between runs (new ondemand files exist)** -- Between run 1 and run 2, a different feature's bootstrap added a new ondemand file
  1. Run 2's Glob returns more files than run 1
  2. The new file's `features:` array does not contain the merged-feature's entry
  3. The new file is `K` (unchanged) on run 2
  4. NOT an error -- the pool is naturally allowed to grow between teardown runs

  **Mapped FR**: FR-3.6

### Edge Cases

- **UC-15-EC1: Pool is empty on re-run (all ondemand files have been deleted)** -- Every prior teardown emptied a file, so the pool is now empty
  1. Glob returns zero files
  2. Summary line: `0 roles updated, 0 deleted, 0 unchanged`
  3. Re-run is trivially no-op

  **Mapped FR**: FR-3.6, FR-3.7

- **UC-15-EC2: Re-run after `/bootstrap-feature` was run for the SAME feature in between** -- The developer ran teardown, then re-bootstrapped (re-adding the entries), then ran teardown again
  1. Bootstrap re-added the feature's entries to all files that had reuse-decisions (Stage 1 / Stage 2 / Stage 3)
  2. The second teardown removes the entries again
  3. The cycle is: teardown -> bootstrap -> teardown -> ... and is naturally idempotent
  4. Per NFR-2, each teardown's behavior is determined by the pool state at the time of the run, not by prior runs

  **Mapped FR**: NFR-2, FR-3.6

### Data Requirements

- **Input**: Pool state after prior teardown (some files removed, some entries removed)
- **Output**: Same state -- no changes
- **Side Effects**: One Glob, N Reads of remaining files, ZERO Writes, ZERO deletions. The audit trail records the no-op outcome

---

## Cross-Cutting Scenarios

### UC-CC-1: Reuse + Teardown in Same `/develop-feature` Run (Full Lifecycle)

**Actor**: Developer, `role-planner` agent (bootstrap), `/bootstrap-feature` orchestrator, `/merge-ready` orchestrator (full pipeline)

**Preconditions**:
- Common preconditions hold
- The developer is starting a new feature `feat/payment-flow` in project `acme-app`
- An existing `~/.claude/agents/ondemand-payment-specialist.md` exists with `features: ["acme-app:onboarding"]` (a prior feature reused this role)
- The current PRD for `payment-flow` recommends a `payment-specialist` role -- Stage-1 slug match expected

**Trigger**: Developer runs `/develop-feature` (the full pipeline: bootstrap + slices + merge-ready)

### Primary Flow (Happy Path -- Full Lifecycle)

**Phase 1: Bootstrap (`/bootstrap-feature`)**

1. Step 3.75 spawns `role-planner` with `<project-name>=acme-app`, `<feature-slug>=payment-flow`
2. Reuse-scan returns `ondemand-payment-specialist.md`
3. Stage-1 match (slugs equal); per UC-2 primary flow, the agent appends `acme-app:payment-flow` to the existing file
4. File now has `features: ["acme-app:onboarding", "acme-app:payment-flow"]`
5. `## Reuse Decisions` records `payment-specialist: stage-1-exact-slug-match`
6. Bootstrap completes; `.claude/plan.md` includes the audit subsection

**Phase 2: Implementation (slices)**

7. Slice 1, 2, ..., N execute per the planner's plan
8. The on-demand role `payment-specialist` may be invoked via Section 5 FR-3.4's `subagent_type: general-purpose` pattern within slices
9. The on-demand file is read-only during slice execution; no `features:` mutations occur

**Phase 3: Merge-Ready (`/merge-ready`)**

10. The developer commits all slices, merges to `main` (e.g., `git merge --no-ff feat/payment-flow`)
11. The developer runs `/merge-ready` from `main` (or possibly from the merged feature branch before deletion)
12. Gates 1-9 pass
13. Step 11 begins:
    - Project-name: `acme-app`
    - Feature-slug derived from the merged branch: `payment-flow`
    - Merge-ancestry check: PASSES
14. The orchestrator scans the pool; finds `ondemand-payment-specialist.md`
15. The file's `features:` array contains `acme-app:payment-flow`; the orchestrator removes it -> `["acme-app:onboarding"]`
16. The array is non-empty (size 1); the file is NOT deleted; per UC-10 primary flow it is `updated`
17. Summary line: `Post-Merge: On-Demand Role Teardown -- 1 roles updated, 0 deleted, 0 unchanged`

**Postconditions**:
- The full lifecycle was traversed: bootstrap added the feature -> implementation used the role -> merge removed the feature
- `~/.claude/agents/ondemand-payment-specialist.md` is back to its pre-bootstrap state (`features: ["acme-app:onboarding"]`)
- The role file persists for the prior `onboarding` feature still using it
- Pipeline-level audit shows: `stage-1-exact-slug-match` at bootstrap, `1 roles updated` at merge-ready

**Failure modes**: Any individual phase failure mode (UC-1 / UC-2 errors at bootstrap; UC-10 / UC-11 / UC-13 errors at merge-ready); failures in slice execution are orthogonal

**Mapped FR**: FR-1 through FR-8 (full lifecycle), NFR-2 (idempotency), NFR-4 (visibility)

**Mapped ACs**: AC-3, AC-8, AC-12 through AC-14, AC-21

### Alternative Flows

- **UC-CC-1-A1: Lifecycle ends with file deletion** -- The current feature was the last user; teardown deletes the file
  1. Same Phase 1 + Phase 2 as primary
  2. Phase 3: the file's array becomes empty; per UC-11, the file is deleted
  3. Pool size goes from N to N-1

  **Mapped FR**: FR-3.6 (deletion when empty)

- **UC-CC-1-A2: Lifecycle includes Stage 2 reuse + later teardown** -- The bootstrap had a Stage-2 prompt; user approved
  1. Phase 1: UC-3 primary flow (Stage-2 affirmative)
  2. Phase 3: The orchestrator looks for the slug-substituted entry (per FR-2.6, the entry uses the EXISTING slug, not the originally-recommended new slug); the lookup uses the project-name and feature-slug, NOT any slug -- so the entry is `acme-app:<feature-slug>` regardless of which file it was added to
  3. The orchestrator finds and removes the entry from the existing file (the one that was reused)
  4. Standard UC-10 outcome

  **Mapped FR**: FR-2.6, FR-3.6

- **UC-CC-1-A3: Lifecycle includes Stage 3 create + later teardown** -- The bootstrap created a new file; teardown removes the only entry and deletes the file
  1. Phase 1: UC-1 primary flow (Stage 3 create)
  2. Phase 3: The new file's `features:` has only one entry (the current feature); teardown removes it; array empties; file deleted per UC-11
  3. Pool size returns to its pre-bootstrap value

  **Mapped FR**: FR-2.1 Stage 3, FR-3.6

### Error Flows

- **UC-CC-1-E1: Bootstrap succeeds but merge-ready Step 11 refuses (branch not yet merged)** -- The developer prematurely runs `/merge-ready`
  1. Phase 1, 2 succeed
  2. Phase 3: per UC-13, Step 11 refuses; the bootstrap-time entry is NOT removed
  3. The developer's audit trail shows the unmatched bootstrap-then-refusal pair
  4. The developer merges the branch; re-runs `/merge-ready`; Step 11 now proceeds and removes the entry (UC-15 idempotency or UC-10 normal flow)

  **Mapped FR**: FR-4.1

### Edge Cases

- **UC-CC-1-EC1: Lifecycle spans multiple `/develop-feature` runs (e.g., interrupted bootstrap)** -- The developer aborts after Phase 1 and resumes later
  1. Per NFR-2 and UC-2-A1 idempotency, re-running Phase 1 is safe; duplicate-append is a no-op
  2. The developer eventually merges and runs Phase 3; teardown is normal
  3. The full lifecycle completes despite interruption

  **Mapped FR**: NFR-2

### Data Requirements

- **Input**: Initial pool state, PRD, all phases' contexts
- **Output**: Final pool state with the feature's entry removed (or file deleted)
- **Side Effects**: Bootstrap reads + 1 atomic write per matched file; slice execution reads only; merge-ready reads + 1 atomic write OR 1 deletion per matched file

---

### UC-CC-2: Two Parallel Features Started Simultaneously

**Actor**: Developer (running two terminal sessions), two separate `role-planner` instances, two `/bootstrap-feature` orchestrators

**Preconditions**:
- Common preconditions hold
- The developer has two checkouts of the same project (or two worktrees) on different feature branches: `feat/feature-A` and `feat/feature-B`
- The developer runs `/bootstrap-feature` in both terminals NEAR-SIMULTANEOUSLY
- An existing `~/.claude/agents/ondemand-shared-role.md` exists with `features: ["acme-app:prior-feature"]`
- Both feature-A and feature-B's PRDs recommend the `shared-role` -- Stage-1 match for both

**Trigger**: Both bootstraps execute in parallel; both attempt to mutate the same file

### Primary Flow (Happy Path -- Last-Write-Wins per NFR-3)

1. Bootstrap A starts at time T0; reads `ondemand-shared-role.md`; in-memory state: `features: ["acme-app:prior-feature"]`; intends to append `acme-app:feature-A`
2. Bootstrap B starts at time T0 + delta_small; reads the SAME file; in-memory state at B: `features: ["acme-app:prior-feature"]` (it has not seen A's pending mutation)
3. Bootstrap A's atomic Write at time T0 + delta_A: file now has `features: ["acme-app:prior-feature", "acme-app:feature-A"]`
4. Bootstrap B's atomic Write at time T0 + delta_B (delta_B > delta_A): file is OVERWRITTEN with B's intended state: `features: ["acme-app:prior-feature", "acme-app:feature-B"]`
5. Bootstrap A's append is SILENTLY LOST -- the file no longer contains `acme-app:feature-A`
6. Per NFR-3, this is documented last-write-wins behavior; iter-2 does NOT include file locking
7. Both bootstraps' `## Reuse Decisions` audit subsections show `stage-1-exact-slug-match` -- they each believe they appended their entry, but only one actually did
8. The developer notices the discrepancy when comparing the audit trails to the on-disk state, OR when running `/merge-ready` for feature A and finding feature A's entry not in the file (UC-15 K=N count instead of expected K=0, M=0, N=1)

**Postconditions**:
- The shared file ends up with one of the two feature entries, NOT both
- The losing feature's entry is silently lost from the bootstrap
- Per NFR-3, this is acceptable iter-2 behavior; multi-pipeline coordination is OUT OF SCOPE
- The audit trail and the on-disk state will diverge for the losing bootstrap

**Failure modes**: One bootstrap's expected `features:` mutation is lost; both bootstraps' Stage-3 file creations (if any) are independent and do NOT race (different filenames)

**Mapped FR**: FR-5.1 (atomic write), FR-5.6 (concurrent mutation out of scope), NFR-3 (last-write-wins)

**Mapped ACs**: AC-12 (atomic mutation contract -- atomic per file, not across files)

### Alternative Flows

- **UC-CC-2-A1: Both features hit Stage 3 with different slugs -- no race** -- Each feature recommends a uniquely-slugged role
  1. Bootstrap A creates `~/.claude/agents/ondemand-feature-a-role.md`
  2. Bootstrap B creates `~/.claude/agents/ondemand-feature-b-role.md`
  3. The two creations target different paths; no race
  4. Both succeed

  **Mapped FR**: FR-2.1 Stage 3 (independent files)

- **UC-CC-2-A2: Developer manually re-runs the losing bootstrap after noticing** -- Recovery via NFR-2 idempotency
  1. The developer notices the audit-trail mismatch
  2. They re-run the losing bootstrap
  3. The file is read; the developer's entry is appended
  4. Now both entries are present (assuming no further race)
  5. Per NFR-2, re-running is safe

  **Mapped FR**: NFR-2

### Error Flows

- **UC-CC-2-E1: Both `/merge-ready` Step 11 invocations race** -- Both features get merged near-simultaneously and the developer runs `/merge-ready` in both terminals
  1. Symmetric to UC-CC-2 primary flow but at teardown time
  2. One teardown's mutation overwrites the other's; one feature's entry may be left in the file (or the file may be incorrectly left non-deleted when both should have caused deletion)
  3. Per NFR-3, last-write-wins; the audit trails surface the issue
  4. The developer manually reconciles by inspecting the file and re-running one teardown

  **Mapped FR**: NFR-3, FR-3.6

### Edge Cases

- **UC-CC-2-EC1: One bootstrap is in non-interactive mode, one is interactive** -- Asymmetric headless / interactive
  1. Per FR-6.1, the headless bootstrap defaults to create-new for any Stage-2 candidate
  2. The interactive bootstrap may use Stage-1 reuse for the same role
  3. The race is on the file the interactive bootstrap reuses; the headless bootstrap creates a separate new file
  4. No race on the new file (different path); race on the reused file follows UC-CC-2 primary flow

  **Mapped FR**: FR-6.1, NFR-3

- **UC-CC-2-EC2: Both bootstraps use Stage 2 and the user replies in different terminals concurrently** -- Two prompt-rounds in parallel
  1. Per FR-2.5, prompts are emitted ONE AT A TIME within a single bootstrap; but parallel bootstraps each have their own prompt sequence
  2. The developer must answer both prompts (in their respective terminals)
  3. Each bootstrap parses its own reply independently
  4. The race on file mutation follows UC-CC-2 primary flow

  **Mapped FR**: FR-2.5, NFR-3

### Data Requirements

- **Input**: Two parallel bootstrap contexts; shared file
- **Output**: One bootstrap's mutation is preserved; the other's is lost
- **Side Effects**: Two Reads (concurrent), two Writes (last-wins). Both bootstraps complete their other side effects (new file creates, temp file writes) independently

---

## Cross-Cutting Notes

### Manifest Schema Invariant

Across all use cases, FR-1.2 specifies the per-file feature manifest schema MUST be exactly:
```yaml
---
name: ondemand-<slug>
description: <one-line role description>
tools: ["Read", "Write", ...]
model: <opus|sonnet>
scope: on-demand
features: ["<project-name>:<feature-slug>", ...]
---
```
The `features:` field is JSON-style array of `<project-name>:<feature-slug>` strings. The `<project-name>:` prefix is REQUIRED to disambiguate cross-project sharing. All other frontmatter fields preserve iter-1 shape byte-for-byte.

### Affirmative/Negative Token Grammar

Across all Stage-2 prompt scenarios (UC-3, UC-4, UC-5 alternates), the FR-2.4 token grammar is reused verbatim from PRD Section 7 FR-4.4:
- Affirmative tokens: `yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`
- Negative tokens: `no`, `n`, `decline`, `skip`, `not now`
- Default-deny on ambiguous: replies that contain no recognized token, conflicting tokens, mention a different slug, or are empty are treated as NEGATIVE for safety

### Audit-Trail Invariant

Across all use cases, FR-8.1 specifies the agent MUST APPEND a `## Reuse Decisions` subsection to `.claude/roles-pending.md` enumerating each recommended role with one of six exact outcome statuses:
- `stage-1-exact-slug-match`
- `stage-2-purpose-match-approved`
- `stage-2-purpose-match-declined`
- `stage-3-no-match-created`
- `headless-default-create`
- `legacy-migrated`

The agent MUST NOT emit any other status string per AC-14. The planner inlines this subsection into `.claude/plan.md` per FR-8.1 / Section 5 FR-2.6.

### Step-11-Is-Step-Not-Gate Invariant

Per FR-3.1 / FR-9.2 / NFR-6, the new Step 11 Post-Merge Teardown is a STEP, NOT a gate. It does NOT have PASS/FAIL semantics, does NOT contribute to the gate-pass tally, and does NOT block merge-readiness. The total `/merge-ready` gate count REMAINS 10. Refusal cases (UC-12, UC-13) report zero counts but do NOT cause `/merge-ready` to fail. Test cases derived from these use cases SHOULD verify the gate-count invariant holds across all scenarios.

### Atomic Read-Modify-Write Invariant

Per FR-5.1 / FR-5.2 / FR-5.3, every `features:` array mutation MUST be performed as a single atomic read-modify-write transaction PER FILE: Read entire file -> parse YAML -> mutate array in memory -> serialize entire file -> Write entire file. Partial in-place edits using `Edit` are FORBIDDEN per FR-5.2 / FR-9.7 (the agent has no `Edit` tool). The file body below the closing `---` delimiter MUST be preserved byte-for-byte per FR-5.4 / FR-5.5 / AC-13.

### Determinism + Idempotency Invariant

Per FR-2.2 (Stage 1 deterministic) and NFR-2 (teardown idempotent):
- Stage-1 reuse decisions are deterministic given the same pool + recommendation
- Teardown re-runs produce identical state on disk after the first run completes
- UC-2-A1 (duplicate-append no-op) and UC-15 (no-op re-run) are the canonical tests of these invariants

### Defense-in-Depth Tool Allowlist Invariant

Per FR-9.7 / NFR-7 / AC-2, the `role-planner` agent's `tools:` field is exactly `["Read", "Write", "Glob", "Grep"]` byte-unchanged from iter-1. NO `Bash`, NO `Edit`, NO `WebFetch`, NO `WebSearch`, NO `NotebookEdit`. The agent CANNOT execute shell commands, CANNOT make network calls, and CANNOT perform partial in-place edits. Teardown deletions (Step 11) are performed by the orchestrator (which has standard merge-ready Bash access), NOT by the agent -- this is the same separation-of-authorities pattern that PRD Section 8 NFR-7 specifies.

### Agent-Count + Gate-Count Invariants

Per FR-9.1 / FR-9.2 / NFR-5 / NFR-6, iter-2 introduces ZERO new agents and ZERO new gates. The total agent count REMAINS 17. The total `/merge-ready` gate count REMAINS 10. Test cases SHOULD verify via `grep -n "17 specialized\|17 AI agents" install.sh README.md src/claude.md` and `grep -n "10 gates\|10 quality gates" install.sh README.md src/claude.md src/commands/merge-ready.md` that no count-string drift was introduced.

### Backward Compatibility Invariant (Iter-1 Preservation)

Per FR-9.10, all iter-1 unchanged-strings are preserved byte-for-byte: the filename prefix `ondemand-`, the slug-collision rule against the 17 core agent names, the `scope: on-demand` frontmatter field, the `name: ondemand-<slug>` frontmatter convention, the `~/.claude/agents/` write-target restriction, and the absence of network access. UC-1 (Stage-3 create-new) preserves iter-1 authorship contract verbatim; only the addition of the `features:` field is new. Iter-1 plans without `## Reuse Decisions` MUST continue to render under iter-2 per FR-8.3.

### Out-of-Scope Behaviors (Documented for Negative Testing)

Per Section 8.4, the following are explicitly OUT OF SCOPE for iter-2 and should NOT be implemented; tests MAY assert their absence:
1. Cross-machine sync of ondemand files (no special handling)
2. Role versioning or diffing (Stage-1 reuses body as-is, no version comparison)
3. Role library or registry beyond `~/.claude/agents/` (no central registry)
4. Automatic role creation without user awareness (no fuzzy auto-merge)
5. Bulk migration of legacy files (only opportunistic per FR-7.3)
6. Teardown of force-pushed or rebased branches (FR-4.1 conservatively refuses)
7. Concurrent multi-pipeline support (NFR-3 last-write-wins, no locking)
8. Manual user editing recovery (FR-5.1 fails clean on malformed YAML; no auto-repair)
9. Teardown notifications or audit reports (only the FR-8.2 summary line)
10. Selective reuse-skip per recommendation (only per-prompt yes/no per FR-2.5)
11. Automatic detection of role purpose drift (Stage-1 slug-match is authoritative)
12. First-class subagent registration of on-demand roles after teardown rebuild (inherited iter-1 invariant; no session-restart needed)

### PRD Gaps Flagged for Architect Review

The following gaps were identified during use-case authoring and are flagged for the architect's review pass; they are NOT proposed as new functional requirements:

1. **UC-1-E1**: Glob-failure recovery semantics (PRD does not explicitly mandate Stage-3 fallback when reuse-scan fails)
2. **UC-2-EC1**: Annotation for malformed-existing-file scenarios (no FR-8.1 status covers this)
3. **UC-2-EC2**: Case-sensitivity edge case for slug matching on case-insensitive filesystems
4. **UC-6-EC2**: Behavior on a pre-existing collision-violating file (FR-1.6 forbids new collisions but is silent on existing ones)
5. **UC-8-A1**: Whether `legacy-migrated` and `stage-2-purpose-match-approved` can co-occur in the audit
6. **UC-8-E1**: Annotation for migration-failed-due-to-malformed-YAML
7. **UC-9-A2**: Non-git-context behavior for the bootstrap-time append path
8. **UC-10-E1**: How to count failed-update files in the FR-3.7 / FR-8.2 summary
9. **UC-10-EC1**: Single-occurrence vs. all-occurrence removal in `features:` array
10. **UC-10-EC2**: Whether pre-empty `features: []` arrays should be deletion triggers (vs. become-empty-from-removal triggers)
11. **UC-11-E1**: Order of operations (write-then-delete vs. delete-only) when array becomes empty and `rm` fails
12. **UC-12-EC2**: Refusal behavior from non-main, non-feature branches (e.g., `develop`, `release/v1.0`)
