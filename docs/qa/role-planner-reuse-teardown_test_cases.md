# Test Cases: Role Planner -- Iteration 2: Cross-Feature Reuse + Automatic Teardown

> Based on [PRD](../PRD.md) -- Section 8 and [Use Cases](../use-cases/role-planner-reuse-teardown_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, cross-reference integrity, YAML frontmatter shape, and (for agent-runtime and orchestrator-runtime tests) observable filesystem/process behavior by running shell commands and inspecting outputs.

**Iter-2 scope:** This document covers ONLY the iter-2 cross-feature reuse + automatic teardown extension. The iter-1 suggest-only Stage-3 authorship test cases (in any prior iter-1 file for `role-planner`) remain valid as a strict subset and are NOT restated here. Cross-iteration test references use the form `iter-1 TC-X.Y` or `iter-2 TC-X.Y` for disambiguation.

**Architect [STRUCTURAL] decisions tested explicitly:**
1. Status enum has 8 entries (added `malformed-yaml-skipped` + `migration-failed-malformed-yaml`) -- see Family I (TC-16.x), Family D (TC-8.y, TC-8.z)
2. ALL-occurrence removal of `features:` array entries (NOT first-occurrence) -- see Family F (TC-10.y)
3. Refuse teardown from any non-feature branch (not just `main`) -- see Family G (TC-12.y)
4. Atomic delete-only when `features:` array empties (no intermediate empty-array Write) -- see Family F (TC-11.x)

---

## Use Case Coverage

Every UC-N from the use-cases file maps to one or more test cases below.

| UC | Scenario | Test Cases |
|----|----------|------------|
| UC-1 | New feature, empty pool, Stage-3 create-new | TC-1.1, TC-1.2, TC-2.1, TC-3.1, TC-3.2, TC-17.1 |
| UC-1-A1 | Multiple recommendations all hit Stage 3 | TC-3.2 |
| UC-1-A2 | Recommendation list empty ("No additional roles required") | TC-16.2, TC-16.4 |
| UC-1-E1 | Glob fails with permission denied | TC-1.3 |
| UC-1-EC1 | First-ever invocation, fresh installation | TC-1.4 |
| UC-1-EC2 | `~/.claude/agents/` directory does not exist | TC-1.5 |
| UC-2 | Stage-1 exact slug match, automatic reuse | TC-2.1, TC-2.2, TC-2.3, TC-9.1, TC-14.1, TC-14.2 |
| UC-2-A1 | Existing array already contains current feature (de-dup) | TC-2.4, TC-15.1 |
| UC-2-A2 | Existing file has empty `features: []` array | TC-2.5 |
| UC-2-E1 | Atomic Write fails (disk full) | TC-14.3 |
| UC-2-E2 | Read fails on individual file | TC-1.6 |
| UC-2-EC1 | Existing file has malformed YAML | TC-5.2, TC-16.3 |
| UC-2-EC2 | Slug differs only in case | TC-5.3 |
| UC-2-EC3 | Multiple files with same slug (impossible) | (documented; not testable) |
| UC-3 | Stage-2 purpose match, user approves | TC-3.3, TC-3.4, TC-3.5 |
| UC-3-A1 | Reply uses alternative affirmative token | TC-3.4 |
| UC-3-A2 | Reply with affirmative + extra text | TC-3.4, TC-3.6 |
| UC-3-E1 | Ambiguous reply leads to default-deny | TC-3.6, TC-3.7 |
| UC-3-EC1 | Multiple Stage-2 candidates, sequential prompting | TC-3.8 |
| UC-3-EC2 | Existing file's `description` empty/missing | TC-3.9 |
| UC-4 | Stage-2 user declines, Stage-3 fallback | TC-3.10, TC-3.11 |
| UC-4-A1 | Reply uses alternative negative token | TC-3.5 |
| UC-4-A2 | Conflicting tokens (yes + no) -> deny | TC-3.6 |
| UC-4-A3 | Reply mentions different slug -> deny | TC-3.6 |
| UC-4-E1 | Stage-3 Write fails after declined Stage 2 | TC-14.4 |
| UC-4-EC1 | Reply is empty/whitespace | TC-3.7 |
| UC-4-EC2 | Reply is a question | TC-3.7 |
| UC-5 | Headless context, Stage-2 skipped, default-create | TC-4.1, TC-4.2, TC-4.3, TC-4.4 |
| UC-5-A1 | Headless + Stage-1 -> automatic reuse runs | TC-4.5 |
| UC-5-A2 | Headless + organic Stage 3 (no Stage-2 candidate) | TC-4.6 |
| UC-5-E1 | Stage-3 fallback Write fails in headless | TC-4.7 |
| UC-5-EC1 | Mixed Stage-1 / headless-default / Stage-3 outcomes | TC-4.8 |
| UC-6 | Slug collision with core agent name | TC-5.1, TC-5.5 |
| UC-6-A1 | Filename-prefix rule catches collision | TC-7.1 |
| UC-6-E1 | Slug `ondemand-code-reviewer` (subtle drift) | TC-5.4 |
| UC-6-EC1 | Multi-stage processing collision | TC-5.5 |
| UC-6-EC2 | Pre-existing collision-violating ondemand-* file | TC-5.6 |
| UC-7 | Filename prefix self-check failure | TC-7.1, TC-7.2 |
| UC-7-A1 | Reuse-mutation respects FR-1.7 trivially | TC-7.3 |
| UC-7-E1 | Write to outside `~/.claude/agents/` | TC-7.4 |
| UC-7-EC1 | Uppercase prefix `Ondemand-` | TC-7.5 |
| UC-7-EC2 | Trailing whitespace in filename | TC-7.5 |
| UC-8 | Legacy file migration on Stage-1 match | TC-8.1, TC-8.2, TC-8.5 |
| UC-8-A1 | Legacy + Stage-2 approve, precedence rule | TC-8.3 |
| UC-8-A2 | Legacy file NOT matched, left unchanged | TC-8.4 |
| UC-8-E1 | Legacy malformed YAML -> migration-failed | TC-8.6, TC-16.3 |
| UC-8-E2 | Atomic Write fails during migration | TC-14.5 |
| UC-8-EC1 | Legacy file at merge-ready Step 11 | TC-11.5 |
| UC-8-EC2 | Legacy with empty `features: []` not legacy | TC-2.5, TC-11.6 |
| UC-9 | Cross-project sharing, namespacing | TC-9.1, TC-9.2, TC-9.3 |
| UC-9-A1 | Different projects' bodies drifted, decline reuse | TC-3.10 |
| UC-9-A2 | Project-name resolution returns `unknown-project` | TC-9.4, TC-9.5, TC-9.6 |
| UC-9-E1 | Two projects' simultaneous race | TC-20.3 |
| UC-9-EC1 | Project-name with special characters | TC-9.7 |
| UC-9-EC2 | Project-name collides with feature-slug | TC-9.8 |
| UC-10 | Teardown, feature removed, file kept | TC-10.1, TC-10.2, TC-10.3, TC-10.4 |
| UC-10-A1 | Multiple files updated | TC-10.5 |
| UC-10-A2 | Mixed updated/deleted/unchanged | TC-10.6 |
| UC-10-E1 | Atomic Write fails during entry removal | TC-14.6, TC-15.5 |
| UC-10-E2 | Read fails on individual file | TC-15.6 |
| UC-10-EC1 | File contains entry multiple times | TC-10.7 |
| UC-10-EC2 | File has pre-empty `features: []` | TC-11.6 |
| UC-11 | Teardown, feature was last user, file deleted | TC-11.1, TC-11.2, TC-11.3 |
| UC-11-A1 | Multiple files deleted in one Step 11 | TC-11.4 |
| UC-11-A2 | Mixed update + deletion | TC-10.6 |
| UC-11-E1 | `rm` fails (permission denied) | TC-11.7, TC-11.8 |
| UC-11-E2 | Marker mismatch (scope != on-demand) | TC-13.4 |
| UC-11-EC1 | File path is symlink (path-traversal) | TC-13.5 |
| UC-11-EC2 | File path with shell metacharacters | TC-13.6 |
| UC-11-EC3 | File becomes empty due to NFR-2 idempotent re-run | TC-15.2 |
| UC-12 | Refuse teardown from `main` no feature-slug | TC-12.1, TC-12.2, TC-12.3 |
| UC-12-A1 | Recent merge commit visible from main | TC-12.4 |
| UC-12-A2 | Many merges, picks most-recent | TC-12.5 |
| UC-12-E1 | `git log -1 --merges` ambiguous output | TC-12.6 |
| UC-12-EC1 | Uncommitted changes present | TC-12.7 |
| UC-12-EC2 | Non-main, non-feature branch | TC-12.8, TC-12.9, TC-12.10, TC-12.11 |
| UC-13 | Refuse if branch not yet merged | TC-13.1, TC-13.2 |
| UC-13-A1 | Squash-merge breaks ancestor check | TC-13.3 |
| UC-13-A2 | Rebase-merge breaks ancestor check | TC-13.3 |
| UC-13-E1 | `git merge-base` itself fails | TC-13.7 |
| UC-13-EC1 | Pull main before re-running | TC-13.8 |
| UC-13-EC2 | Remote merged, local stale | TC-13.9 |
| UC-14 | Concurrent modification, last-write-wins | TC-14.7, TC-14.8 |
| UC-14-A1 | Developer's edit preserved (developer wins) | TC-14.7 |
| UC-14-A2 | Re-run bootstrap fixes inconsistency | TC-15.1 |
| UC-14-E1 | Developer's malformed YAML overwritten | TC-14.9 |
| UC-14-EC1 | Both save at same instant | TC-14.7 |
| UC-14-EC2 | Two parallel bootstrap invocations | TC-20.3 |
| UC-15 | Idempotent teardown re-run is no-op | TC-15.2, TC-15.3 |
| UC-15-A1 | Re-run after different feature merged | TC-15.4 |
| UC-15-A2 | Manual editing between runs | TC-15.7 |
| UC-15-E1 | Pool grew between runs | TC-15.8 |
| UC-15-EC1 | Pool empty on re-run | TC-15.9 |
| UC-15-EC2 | Bootstrap-then-teardown cycle | TC-15.10 |
| UC-CC-1 | Full lifecycle: bootstrap reuse + teardown | TC-20.1, TC-20.2 |
| UC-CC-1-A1 | Lifecycle ends with deletion | TC-20.1 |
| UC-CC-1-A2 | Stage 2 reuse + later teardown | TC-20.2 |
| UC-CC-1-A3 | Stage 3 create + later teardown | TC-20.1 |
| UC-CC-1-E1 | Bootstrap succeeds, teardown refused (not merged) | TC-13.1 |
| UC-CC-1-EC1 | Lifecycle spans multiple `/develop-feature` runs | TC-15.1 |
| UC-CC-2 | Two parallel features race on same file | TC-20.3, TC-20.4 |
| UC-CC-2-A1 | Both at Stage 3 with different slugs (no race) | TC-20.5 |
| UC-CC-2-A2 | Manual re-run of losing bootstrap | TC-15.1 |
| UC-CC-2-E1 | Both teardowns race | TC-20.6 |
| UC-CC-2-EC1 | Asymmetric headless / interactive | TC-20.7 |
| UC-CC-2-EC2 | Both Stage 2 prompts answered concurrently | TC-20.8 |

## Acceptance Criteria Coverage

Every AC-N from PRD Section 8 maps to one or more test cases.

| AC | Description | Test Cases |
|----|-------------|------------|
| AC-1 | `role-planner.md` extended with Reuse mode capability section | TC-2.1, TC-3.1, TC-4.1, TC-5.1, TC-7.1, TC-8.1, TC-17.1 |
| AC-2 | `tools` field byte-unchanged `["Read", "Write", "Glob", "Grep"]` | TC-17.1, TC-17.2, TC-17.3 |
| AC-3 | Stage-1 exact slug match -> automatic reuse | TC-2.1, TC-2.2, TC-2.3, TC-9.1, TC-9.2 |
| AC-4 | Stage-2 prompt verbatim format with description summary | TC-3.3, TC-3.4, TC-3.10 |
| AC-5 | Headless context, Stage-2 skipped, `headless-default-create` recorded | TC-4.1, TC-4.2, TC-4.3 |
| AC-6 | Legacy file migration adds `features:` array on match | TC-8.1, TC-8.2, TC-8.5 |
| AC-7 | `merge-ready.md` extended with new Step 11 after Gate 9 | TC-19.1, TC-19.2, TC-19.3, TC-19.4 |
| AC-8 | Step 11 derives project/feature slug, scans pool, removes entry, deletes if empty | TC-10.1, TC-11.1, TC-15.2, TC-20.1 |
| AC-9 | Step 11 refuses from main without context, literal error | TC-12.1, TC-12.2, TC-12.3 |
| AC-10 | Step 11 refuses if branch not yet merged, literal error | TC-13.1, TC-13.2 |
| AC-11 | Step 11 never deletes outside `~/.claude/agents/ondemand-*.md` | TC-13.4, TC-13.5, TC-13.6 |
| AC-12 | Atomic read-modify-write contract, no Edit | TC-14.1, TC-14.2, TC-14.10, TC-17.3 |
| AC-13 | File body byte-for-byte preserved during mutations | TC-14.1, TC-14.2, TC-9.3 |
| AC-14 | `## Reuse Decisions` enumerates 8 exact statuses, exclusive | TC-16.1, TC-16.2, TC-16.3, TC-16.4, TC-16.5 |
| AC-15 | Plan Critic recognizes `## Reuse Decisions` as valid section | TC-16.6, TC-16.7 |
| AC-16 | Agent count remains 17 byte-unchanged | TC-18.1, TC-18.2, TC-18.6 |
| AC-17 | `/merge-ready` gate count remains 10 byte-unchanged | TC-18.3, TC-18.4, TC-19.5, TC-19.6 |
| AC-18 | `install.sh` byte-unchanged | TC-18.5 |
| AC-19 | `templates/CLAUDE.md` byte-unchanged | TC-18.7 |
| AC-20 | Agency Roles `role-planner` row Responsibility updated verbatim | TC-17.4, TC-17.5 |
| AC-21 | Cross-references valid, no phantom paths | TC-17.6 |
| AC-22 | Reuse-scan completes within 5 seconds for <=50 files | TC-1.7 |

---

## Family A: Reuse Detection (FR-1.1 through FR-1.8)

### TC-1.1: Glob scan executes before any Write at Step 3.75
- **Category:** Reuse Detection
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-1, UC-2, UC-3
- **Mapped AC:** AC-1, AC-3
- **Preconditions:** Iter-2 is shipped; `~/.claude/agents/` exists with at least one `ondemand-*.md` file
- **Inputs:** Bootstrap Step 3.75 invocation; PRD recommends one or more roles
- **Steps:**
  1. Instrument the agent runtime to log all tool invocations in chronological order
  2. Invoke `/bootstrap-feature`
  3. Inspect the chronological log
- **Expected output / state:** The first tool invocation against `~/.claude/agents/` MUST be a Glob call with the literal pattern `~/.claude/agents/ondemand-*.md`. No Write to `~/.claude/agents/` precedes the Glob.
- **Pass criteria:** Glob occurs strictly before any Write; verifiable from chronological tool log.

### TC-1.2: Glob pattern matches only `ondemand-*.md` (not core agents)
- **Category:** Reuse Detection
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-1, UC-2
- **Mapped AC:** AC-2, AC-3
- **Preconditions:** `~/.claude/agents/` contains the 17 core files PLUS `ondemand-mobile-dev.md` and `ondemand-compliance-officer.md`
- **Inputs:** Glob with literal pattern `~/.claude/agents/ondemand-*.md`
- **Steps:**
  1. Run the Glob
  2. Compare the result set against the directory contents
- **Expected output / state:** Result set contains EXACTLY 2 entries (`ondemand-mobile-dev.md`, `ondemand-compliance-officer.md`). The 17 core files (`prd-writer.md`, `ba-analyst.md`, ..., `release-engineer.md`) are NOT in the result set.
- **Pass criteria:** Glob filters by `ondemand-` prefix; no core agent file leaks into the reuse-scan input.

### TC-1.3: Glob failure (permission denied) -> fall back to Stage-3 for all recommendations
- **Category:** Reuse Detection
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-1-E1
- **Mapped AC:** (PRD-pinned per architect Edit; recovery semantics)
- **Preconditions:** `~/.claude/agents/` exists but is unreadable (chmod 0)
- **Inputs:** Bootstrap Step 3.75 invocation; PRD recommends one role
- **Steps:**
  1. Set `~/.claude/agents/` mode to 000 (no read permission)
  2. Invoke `/bootstrap-feature`
  3. Inspect the audit log and `## Reuse Decisions` subsection
- **Expected output / state:** The agent emits a warning to the audit log: "Reuse scan failed: permission denied on ~/.claude/agents/. Falling back to create-new for all recommendations." The recommendation is classified as `stage-3-no-match-created`. The agent attempts to Write the new file (which may itself fail under the same permission issue, but reuse fallback is honored regardless).
- **Pass criteria:** Audit log records the Glob failure; classification is `stage-3-no-match-created` (not aborted).

### TC-1.4: First-ever invocation in fresh installation -> empty pool
- **Category:** Reuse Detection
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-1, UC-1-EC1
- **Mapped AC:** AC-1
- **Preconditions:** `~/.claude/agents/` contains ONLY the 17 core files (no `ondemand-*.md`)
- **Inputs:** Bootstrap Step 3.75 invocation; PRD recommends one role
- **Steps:**
  1. Verify directory state: `ls ~/.claude/agents/ondemand-*.md` returns no matches
  2. Invoke `/bootstrap-feature`
  3. Read `~/.claude/agents/` post-invocation
- **Expected output / state:** The Glob returns 0 results. Every recommendation classifies as `stage-3-no-match-created`. The pool size grows from 0 to N (N = number of recommendations).
- **Pass criteria:** Empty-pool case proceeds straight to Stage 3; no errors; new files created.

### TC-1.5: `~/.claude/agents/` directory does not exist -> Write fails, escalation
- **Category:** Reuse Detection
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-1-EC2
- **Mapped AC:** AC-1
- **Preconditions:** `~/.claude/agents/` directory has been deleted (or installer was never run)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Remove the directory: `rm -rf ~/.claude/agents`
  2. Invoke `/bootstrap-feature`
  3. Inspect the failure mode
- **Expected output / state:** Glob returns zero or errors. Stage-3 Write fails because the directory does not exist. The orchestrator escalates as Rule 3: "~/.claude/agents/ does not exist. Run install.sh first." Bootstrap Step 3.75 FAILS.
- **Pass criteria:** Bootstrap fails cleanly with the documented error; no half-written state.

### TC-1.6: Read fails on individual file -> treat as if not present, continue scan
- **Category:** Reuse Detection
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-2-E2
- **Mapped AC:** AC-3
- **Preconditions:** `~/.claude/agents/` contains `ondemand-foo.md` (mode 000) AND `ondemand-bar.md` (mode 644)
- **Inputs:** Bootstrap Step 3.75 invocation; recommendation matches slug `bar`
- **Steps:**
  1. Set `ondemand-foo.md` to mode 000
  2. Invoke `/bootstrap-feature`
- **Expected output / state:** Glob returns both files. Read of `ondemand-foo.md` fails with permission denied; the agent emits a warning to the audit log and continues with `ondemand-bar.md`. Recommendation matches Stage 1 against `bar`. The scan does NOT abort.
- **Pass criteria:** Per-file Read failure is non-blocking for other files; audit log records the unreadable file.

### TC-1.7: Reuse-scan completes within 5 seconds for 50 files
- **Category:** Reuse Detection
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-1, UC-2 (NFR-1)
- **Mapped AC:** AC-22
- **Preconditions:** `~/.claude/agents/` populated with 50 dummy `ondemand-test-N.md` files (N = 1..50), each ~2 KB frontmatter + body
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Populate the directory with 50 well-formed dummy files
  2. Time the Step 3.75 invocation: `start=$(date +%s); ...; end=$(date +%s); echo $((end-start))`
- **Expected output / state:** Total elapsed time is <= 5 seconds.
- **Pass criteria:** Performance meets NFR-1 budget.

---

## Family B: Stage 1 Exact Slug Match (FR-2.1 Stage 1, FR-2.2)

### TC-2.1: Stage-1 deterministic reuse, no user prompt
- **Category:** Stage 1 Reuse
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-1, UC-2
- **Mapped AC:** AC-1, AC-3
- **Preconditions:** `~/.claude/agents/ondemand-mobile-dev.md` exists with `features: ["acme-app:onboarding"]`; current branch `feat/checkout-flow-redesign`; project basename `acme-app`; PRD recommends `mobile-dev`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Capture console output during the invocation
  2. Read `~/.claude/agents/ondemand-mobile-dev.md` after
  3. Read `.claude/roles-pending.md`
- **Expected output / state:** Zero user prompts emitted to console. The file's `features:` array becomes `["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`. `## Reuse Decisions` records `mobile-dev: stage-1-exact-slug-match`. No new file is created at `ondemand-mobile-dev.md` (in-place mutation).
- **Pass criteria:** Stage 1 reuses without prompting; entry appended; audit annotation correct.

### TC-2.2: Stage-1 determinism -- same pool + same recommendation -> same outcome
- **Category:** Stage 1 Reuse
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-2 (FR-2.2)
- **Mapped AC:** AC-3
- **Preconditions:** Same as TC-2.1
- **Inputs:** Run the same bootstrap twice on a clean state
- **Steps:**
  1. Reset to clean state: file with `features: ["acme-app:onboarding"]`
  2. Run invocation 1; record outcome
  3. Reset to clean state again
  4. Run invocation 2; record outcome
- **Expected output / state:** Both invocations produce identical `## Reuse Decisions` entries (`stage-1-exact-slug-match`) and identical post-state files.
- **Pass criteria:** Determinism holds; classification is reproducible.

### TC-2.3: Stage-1 multi-feature `features:` array append
- **Category:** Stage 1 Reuse
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-2, UC-9
- **Mapped AC:** AC-3
- **Preconditions:** `ondemand-mobile-dev.md` already has `features: ["acme-app:onboarding", "acme-app:settings-rev"]`; current feature `acme-app:checkout-flow-redesign`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect the file's frontmatter post-invocation
- **Expected output / state:** `features:` array is `["acme-app:onboarding", "acme-app:settings-rev", "acme-app:checkout-flow-redesign"]` (size 3, in-order append).
- **Pass criteria:** Append preserves prior entries; new entry is added at the end.

### TC-2.4: Stage-1 idempotent re-append (duplicate detected)
- **Category:** Stage 1 Reuse
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-2-A1
- **Mapped AC:** AC-3 (NFR-2)
- **Preconditions:** `ondemand-mobile-dev.md` already has `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`; current feature `acme-app:checkout-flow-redesign` (same as already listed)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect the file post-invocation
- **Expected output / state:** `features:` array is unchanged: `["acme-app:onboarding", "acme-app:checkout-flow-redesign"]` (no duplicate). The atomic write may still execute (producing a byte-identical file). `## Reuse Decisions` records `stage-1-exact-slug-match` (optionally with note "feature already listed; no-op").
- **Pass criteria:** No duplicate entries created; idempotency holds.

### TC-2.5: Stage-1 against existing empty `features: []` array
- **Category:** Stage 1 Reuse
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-2-A2, UC-8-EC2
- **Mapped AC:** AC-3
- **Preconditions:** `ondemand-mobile-dev.md` has `features: []` (empty array, not missing)
- **Inputs:** Bootstrap Step 3.75 invocation; recommendation matches slug `mobile-dev`
- **Steps:**
  1. Run invocation
- **Expected output / state:** `features:` array becomes `["<project-name>:<feature-slug>"]` (size 1). The file is now valid (non-empty). NOT classified as `legacy-migrated` (legacy means MISSING field, not empty array). Annotation: `stage-1-exact-slug-match`.
- **Pass criteria:** Empty-array case is treated as a normal iter-2 file with zero owners; not as legacy.

---

## Family C: Stage 2 Purpose Match + Token Grammar (FR-2.1 Stage 2, FR-2.3, FR-2.4)

### TC-3.1: Stage-2 prompt format verbatim per FR-2.3
- **Category:** Stage 2 Reuse
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-3
- **Mapped AC:** AC-4
- **Preconditions:** `ondemand-mobile-dev.md` exists with description "Mobile-application specialist for iOS/Android domain"; recommendation slug is `mobile-frontend-dev`; purposes overlap (Stage-2 candidate)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Capture the console prompt emitted by the agent
  2. Compare to the FR-2.3 verbatim format
- **Expected output / state:** The prompt is exactly: `Reuse existing role 'ondemand-mobile-dev' for current feature, or create new 'ondemand-mobile-frontend-dev'? [yes/no]` followed on a separate line by `Existing role purpose: Mobile-application specialist for iOS/Android domain` (the `description` field value).
- **Pass criteria:** Prompt includes both slugs verbatim AND the description summary; verbatim string match.

### TC-3.2: Stage-2 vs Stage-1 vs Stage-3 ordering exhaustively
- **Category:** Stage 2 Reuse
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-1-A1, UC-3 (FR-2.1)
- **Mapped AC:** AC-3, AC-4
- **Preconditions:** Pool contains `ondemand-mobile-dev.md` (purpose-match candidate) AND `ondemand-payment-specialist.md` (no match); PRD recommends `mobile-frontend-dev`, `payment-specialist`, AND `unrelated-role`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect classification of each recommendation in `## Reuse Decisions`
- **Expected output / state:** `payment-specialist` -> Stage 1 (slug match) `stage-1-exact-slug-match`. `mobile-frontend-dev` -> Stage 2 (purpose match, prompt emitted). `unrelated-role` -> Stage 3 `stage-3-no-match-created`. Per-recommendation classification per FR-1.5.
- **Pass criteria:** Each recommendation independently classified; mix of all three stages observed.

### TC-3.3: All 7 affirmative tokens recognized
- **Category:** Stage 2 Reuse / Token Grammar
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-3, UC-3-A1
- **Mapped AC:** AC-4
- **Preconditions:** Stage-2 prompt is emitted
- **Inputs:** For each of the 7 affirmative tokens (`yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`)
- **Steps:**
  1. For each token, simulate user reply with that token alone
  2. Verify the parsed outcome
- **Expected output / state:** All 7 replies parse as AFFIRMATIVE. The agent reuses the existing file (Stage-2 affirmative path). Audit annotation: `stage-2-purpose-match-approved`.
- **Pass criteria:** All 7 tokens parse positively; no token is dropped or misclassified.

### TC-3.4: Affirmative tokens with extra surrounding text
- **Category:** Stage 2 Reuse / Token Grammar
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-3-A2
- **Mapped AC:** AC-4
- **Preconditions:** Stage-2 prompt is emitted
- **Inputs:** Replies like `"yes please reuse it"`, `"sure, go ahead"`, `"OK approve"`, `"Yes that works"` (case-insensitive)
- **Steps:**
  1. For each reply, capture the parsed outcome
- **Expected output / state:** All replies parse as AFFIRMATIVE. The presence of recognized tokens is sufficient regardless of surrounding text.
- **Pass criteria:** Extra text does not block recognition.

### TC-3.5: All 5 negative tokens recognized
- **Category:** Stage 2 Reuse / Token Grammar
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-4, UC-4-A1
- **Mapped AC:** AC-4
- **Preconditions:** Stage-2 prompt is emitted
- **Inputs:** For each of the 5 negative tokens (`no`, `n`, `decline`, `skip`, `not now`)
- **Steps:**
  1. For each token, simulate user reply
  2. Verify the parsed outcome
- **Expected output / state:** All 5 replies parse as NEGATIVE. The agent proceeds with Stage 3 (creates new file). Audit annotation: `stage-2-purpose-match-declined`.
- **Pass criteria:** All 5 tokens parse negatively; Stage-3 fallback engages.

### TC-3.6: Conflicting + foreign-slug + ambiguous replies -> default-deny
- **Category:** Stage 2 Reuse / Token Grammar
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-3-A2, UC-4-A2, UC-4-A3
- **Mapped AC:** AC-4
- **Preconditions:** Stage-2 prompt is emitted
- **Inputs:** Replies:
  - "yes please... actually no, skip it" (conflicting)
  - "no, but use ondemand-android-dev instead" (foreign slug)
  - "Hmm, depends..." (ambiguous, no token)
  - "" (empty)
  - "What does this do?" (question, no token)
- **Steps:**
  1. For each reply, capture the parsed outcome
- **Expected output / state:** All replies parse as NEGATIVE per default-deny on ambiguity rule. Stage 3 fallback engages. Audit annotation: `stage-2-purpose-match-declined`. The foreign slug request is IGNORED (the agent does not switch to `ondemand-android-dev`).
- **Pass criteria:** Default-deny on ambiguous/conflicting/empty replies.

### TC-3.7: Empty-reply and whitespace-only reply -> NEGATIVE (default-deny)
- **Category:** Stage 2 Reuse / Token Grammar
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-4-EC1, UC-4-EC2
- **Mapped AC:** AC-4
- **Preconditions:** Stage-2 prompt is emitted
- **Inputs:** Replies: `""`, `"   "` (whitespace only), `"\n\n"` (newlines only)
- **Steps:**
  1. For each reply, capture the parsed outcome
- **Expected output / state:** All parse as NEGATIVE. No re-prompt. Stage 3 engages. Audit: `stage-2-purpose-match-declined`.
- **Pass criteria:** Empty and whitespace-only replies are safely treated as decline.

### TC-3.8: Sequential prompting -- one Stage-2 prompt at a time
- **Category:** Stage 2 Reuse
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-3-EC1
- **Mapped AC:** AC-4
- **Preconditions:** PRD recommends two roles each triggering a Stage-2 candidate (different existing files purpose-match each one)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Capture the chronological order of console prompts
  2. Verify the order matches the iter-1 `## Additional Roles` recommendation order
- **Expected output / state:** Prompt 1 is emitted; the orchestrator captures reply 1; the agent processes reply 1 and proceeds. ONLY THEN is prompt 2 emitted. Prompts are NOT batched.
- **Pass criteria:** Sequential one-at-a-time prompting; order matches recommendation order in temp file.

### TC-3.9: Existing file's `description` empty -> fall back to first body line OR "(no description available)"
- **Category:** Stage 2 Reuse
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-3-EC2
- **Mapped AC:** AC-4
- **Preconditions:** `ondemand-foo.md` exists with `description:` field empty (or missing)
- **Inputs:** Bootstrap Step 3.75 invocation; recommendation triggers Stage-2 against this file
- **Steps:**
  1. Capture the prompt
  2. Verify the description-summary line
- **Expected output / state:** The prompt still includes the slugs. The summary-line uses the first non-empty line of the body OR the literal string "(no description available)" when no usable text exists.
- **Pass criteria:** Prompt is still emitted with a fallback summary; no crash.

### TC-3.10: Stage-2 user declines -> Stage-3 fallback creates new file with original slug
- **Category:** Stage 2 Reuse
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-4, UC-9-A1
- **Mapped AC:** AC-4
- **Preconditions:** Same as TC-3.1; user replies "no"
- **Inputs:** Bootstrap Step 3.75 invocation; user reply "no"
- **Steps:**
  1. Run invocation
  2. Inspect the post-state file system and audit
- **Expected output / state:** `ondemand-mobile-dev.md` is UNTOUCHED (its `features:` array is NOT modified). A new file `ondemand-mobile-frontend-dev.md` is created with `features: ["acme-app:mobile-frontend-overhaul"]`. `## Reuse Decisions` records `mobile-frontend-dev: stage-2-purpose-match-declined`.
- **Pass criteria:** Negative reply leaves existing file untouched; new file created with original slug.

### TC-3.11: Slug substitution on Stage-2 affirmative -- `## Additional Roles` and `## Role invocation plan` reference EXISTING slug
- **Category:** Stage 2 Reuse
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-3 (FR-2.6)
- **Mapped AC:** AC-4
- **Preconditions:** Stage-2 affirmative outcome; recommended slug `mobile-frontend-dev`; existing slug `mobile-dev`
- **Inputs:** Bootstrap Step 3.75 invocation; user reply "yes"
- **Steps:**
  1. Run invocation
  2. Read `.claude/roles-pending.md`
  3. Inspect `## Additional Roles` and `## Role invocation plan`
- **Expected output / state:** Both `## Additional Roles` and `## Role invocation plan` reference the EXISTING slug `mobile-dev`, NOT the originally-recommended `mobile-frontend-dev`. The substitution is internally consistent across both subsections.
- **Pass criteria:** Slug substitution per FR-2.6; orchestrator's general-purpose invocation pattern targets the correct file.

---

## Family D: Headless Context (FR-6)

### TC-4.1: Headless context detected via `process.stdin.isTTY === false`
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-5
- **Mapped AC:** AC-5
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Bootstrap invocation in non-TTY context (e.g., `cat /dev/null | bootstrap-feature` or CI environment)
- **Steps:**
  1. Set up non-interactive context: `process.stdin.isTTY === false` OR shell `[ -t 0 ]` returns false
  2. Invoke `/bootstrap-feature`
- **Expected output / state:** Orchestrator detects non-interactive context per FR-6.4 (parallel to Section 7 FR-7.4 mechanism). Headless flag is passed to the agent.
- **Pass criteria:** Detection mechanism matches the documented `process.stdin.isTTY === false` condition.

### TC-4.2: Headless mode -- Stage-2 prompts SKIPPED entirely
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-5
- **Mapped AC:** AC-5
- **Preconditions:** TC-4.1 setup; Stage-2 candidate would otherwise apply (TC-3.1 setup)
- **Inputs:** Bootstrap invocation in headless mode
- **Steps:**
  1. Capture all console output during the invocation
  2. Inspect for Stage-2 prompts
- **Expected output / state:** ZERO Stage-2 prompts emitted. The agent does NOT pause for input.
- **Pass criteria:** No prompt block appears in console output.

### TC-4.3: Headless mode -- audit annotation `headless-default-create`
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-5
- **Mapped AC:** AC-5, AC-14
- **Preconditions:** TC-4.2 setup
- **Inputs:** Same as TC-4.2
- **Steps:**
  1. Run invocation
  2. Read `.claude/roles-pending.md`
- **Expected output / state:** `## Reuse Decisions` contains the literal annotation `headless-default-create` for the affected recommendation. NOT `stage-2-purpose-match-declined`.
- **Pass criteria:** Distinct annotation surfaces the headless-mode decision so the user can later re-bootstrap interactively if reuse was actually preferred.

### TC-4.4: Headless mode -- new file created (Stage-3 behavior)
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-5
- **Mapped AC:** AC-5
- **Preconditions:** TC-4.2 setup
- **Inputs:** Same as TC-4.2
- **Steps:**
  1. Run invocation
  2. Inspect file system for the new file
- **Expected output / state:** A new `ondemand-mobile-frontend-dev.md` file is created (Stage-3 behavior). The existing `ondemand-mobile-dev.md` is UNTOUCHED.
- **Pass criteria:** Headless mode safely defaults to creating new files instead of auto-reusing without approval.

### TC-4.5: Headless mode + Stage-1 exact slug match -> automatic reuse runs
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-5-A1
- **Mapped AC:** AC-5
- **Preconditions:** TC-4.1 setup; existing `ondemand-mobile-dev.md`; PRD recommends slug `mobile-dev` (exact match)
- **Inputs:** Bootstrap invocation in headless mode
- **Steps:**
  1. Run invocation
  2. Inspect the post-state file
- **Expected output / state:** Stage-1 reuse runs without prompting (no prompt was needed even in interactive mode). The file's `features:` array is appended. Annotation: `stage-1-exact-slug-match` (NOT `headless-default-create`).
- **Pass criteria:** Stage 1 is unaffected by headless mode.

### TC-4.6: Headless mode + organic Stage-3 -> normal create-new
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-5-A2
- **Mapped AC:** AC-5
- **Preconditions:** TC-4.1 setup; pool empty OR no purpose-match for the recommendation
- **Inputs:** Bootstrap invocation in headless mode
- **Steps:**
  1. Run invocation
- **Expected output / state:** Recommendation hits Stage 3 organically. Annotation: `stage-3-no-match-created` (NOT `headless-default-create`). The latter is reserved for downgraded Stage-2 candidates.
- **Pass criteria:** Distinct annotation; `headless-default-create` is not used for organic Stage-3 outcomes.

### TC-4.7: Headless mode -- Stage-3 fallback Write fails -> bootstrap fails
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-5-E1
- **Mapped AC:** AC-5
- **Preconditions:** TC-4.4 setup; disk is full or path unwritable
- **Inputs:** Bootstrap invocation in headless mode
- **Steps:**
  1. Set up disk-full or write-failure scenario
  2. Run invocation
- **Expected output / state:** Stage-3 Write fails. The failure is reported to stderr / CI logs (no interactive escalation). Bootstrap Step 3.75 FAILS.
- **Pass criteria:** Failure is surfaced via CI-friendly stderr; no half-written state.

### TC-4.8: Headless mode -- mixed Stage-1, headless-default-create, Stage-3 outcomes
- **Category:** Headless Mode
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-5-EC1
- **Mapped AC:** AC-5, AC-14
- **Preconditions:** TC-4.1 setup; pool has slug-match for one recommendation, purpose-match for another, no match for a third
- **Inputs:** Three recommendations in one invocation
- **Steps:**
  1. Run invocation
  2. Inspect each annotation in `## Reuse Decisions`
- **Expected output / state:** Recommendation 1 -> `stage-1-exact-slug-match`. Recommendation 2 -> `headless-default-create`. Recommendation 3 -> `stage-3-no-match-created`. Each is independent per FR-1.5.
- **Pass criteria:** All three statuses appear correctly in the audit subsection.

---

## Family E: Slug Collision + Filename Prefix (FR-1.6, FR-1.7)

### TC-5.1: Slug collision against each of 17 core agent names -> reject
- **Category:** Slug Collision
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-6
- **Mapped AC:** AC-1
- **Preconditions:** Iter-2 is shipped
- **Inputs:** For each of 17 core slugs (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`)
- **Steps:**
  1. For each, simulate the agent's recommendation logic producing that slug
  2. Verify the agent's slug-collision self-check rejects it
- **Expected output / state:** The agent emits "Slug-collision violation: recommended slug '<slug>' matches core agent name. Refusing to recommend." for all 17. NO file at `~/.claude/agents/<core-name>.md` is overwritten.
- **Pass criteria:** All 17 collisions rejected; defense holds.

### TC-5.2: Existing malformed-YAML file with collision-slug -> `malformed-yaml-skipped` annotation
- **Category:** Slug Collision
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-2-EC1 (architect [STRUCTURAL] 1)
- **Mapped AC:** AC-14
- **Preconditions:** `ondemand-mobile-dev.md` exists with malformed YAML frontmatter (e.g., unclosed bracket on `features:`); recommendation slug is `mobile-dev` (slug-collision with the existing-but-malformed file)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Read `.claude/roles-pending.md` audit
- **Expected output / state:** Annotation: `malformed-yaml-skipped`. The agent skips both the existing-file mutation AND the new-file Write. A manual-fix request is surfaced in the audit log: "Malformed YAML in ondemand-mobile-dev.md; manual reconciliation required."
- **Pass criteria:** Architect [STRUCTURAL] 1 status enum entry is emitted; no silent overwrite.

### TC-5.3: Slug differs only in case -> behavior depends on filesystem
- **Category:** Slug Collision
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-2-EC2
- **Mapped AC:** AC-1
- **Preconditions:** `ondemand-Mobile-Dev.md` exists; recommendation slug is `mobile-dev`
- **Inputs:** Run on case-sensitive (Linux ext4) and case-insensitive (macOS APFS, Windows NTFS) filesystems
- **Steps:**
  1. On case-sensitive FS: run invocation, inspect outcome
  2. On case-insensitive FS: run invocation, inspect outcome
- **Expected output / state:** Case-sensitive: `Mobile-Dev` and `mobile-dev` differ -> Stage 1 does NOT match -> falls through to Stage 2 or 3. Case-insensitive: Glob may return both files; the slug comparison treats them as equivalent. Either way, the agent's iter-1 lowercase-with-hyphens convention SHOULD flag uppercase as a code-reviewer finding.
- **Pass criteria:** Behavior matches filesystem semantics; no crash.

### TC-5.4: Slug `code-reviewer` (with `ondemand-` prefix added) -> still rejected per FR-1.6
- **Category:** Slug Collision
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-6-E1
- **Mapped AC:** AC-1
- **Preconditions:** Agent recommendation logic produces filename `~/.claude/agents/ondemand-code-reviewer.md` (prefix added but suffix-slug `code-reviewer` collides)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Trigger the slug-collision check
- **Expected output / state:** The agent rejects the slug. The slug AFTER the `ondemand-` prefix MUST be checked against the 17 core names; `code-reviewer` collides. Rejection occurs.
- **Pass criteria:** Two-layer defense holds: prefix MUST start with `ondemand-` AND suffix-slug MUST NOT match a core name.

### TC-5.5: Multiple recommendations -- collision in one does not block others
- **Category:** Slug Collision
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-6, UC-6-EC1
- **Mapped AC:** AC-1
- **Preconditions:** PRD recommendations include `code-reviewer` (collision) AND `code-review-specialist` (no collision)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
- **Expected output / state:** `code-reviewer` is rejected (or auto-corrected to non-colliding alternative). `code-review-specialist` proceeds normally through the 3-stage matching. Both decisions independently recorded in `## Reuse Decisions`.
- **Pass criteria:** Per-recommendation classification per FR-1.5; collision is local to one recommendation.

### TC-5.6: Pre-existing `~/.claude/agents/ondemand-code-reviewer.md` -> ineligible for reuse, manual cleanup warning
- **Category:** Slug Collision
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-6-EC2 (architect Edit 3)
- **Mapped AC:** AC-1
- **Preconditions:** A buggy `ondemand-code-reviewer.md` exists from a prior version that bypassed the iter-1 prefix check; current recommendation matches slug `code-reviewer`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect audit log
- **Expected output / state:** The agent treats the colliding file as INELIGIBLE for reuse. Audit log emits warning: "Found ondemand file with slug colliding with core agent name; not eligible for reuse. Manual cleanup required." The agent does NOT mutate the colliding file's `features:` array even if the slug matches. The recommendation falls through to Stage 3 with a corrected, non-colliding slug, OR is dropped.
- **Pass criteria:** Pre-existing collision-violating file is excluded from reuse; manual-cleanup warning emitted.

---

## Family F: Filename Prefix Self-Check (FR-1.7, FR-1.8)

### TC-7.1: Filename self-check -- candidate path MUST start with `ondemand-`
- **Category:** Filename Prefix
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-7
- **Mapped AC:** AC-1
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Candidate paths:
  - `~/.claude/agents/mobile-dev.md` (missing prefix)
  - `~/.claude/agents/special/ondemand-mobile-dev.md` (in subdirectory)
  - `~/.claude/agents/ondemand-mobile-dev.md` (valid)
  - `~/.claude/agents/ondemand-foo.txt` (wrong extension)
- **Steps:**
  1. For each candidate, run the agent's filename self-check
- **Expected output / state:** Candidates 1, 2, 4 are REJECTED with literal violation message: "Filename prefix violation: candidate path '<path>' does not begin with 'ondemand-'. Refusing Write." Candidate 3 PASSES.
- **Pass criteria:** Self-check enforces the literal `ondemand-` prefix on the basename, rejects subdirectories.

### TC-7.2: Filename self-check fires BEFORE Write
- **Category:** Filename Prefix
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-7
- **Mapped AC:** AC-1
- **Preconditions:** Test scenario triggering the self-check
- **Inputs:** Triggered candidate path failing self-check
- **Steps:**
  1. Inspect the chronological tool log
  2. Verify no Write occurred for the rejected candidate
- **Expected output / state:** No Write tool invocation against the rejected path. The self-check ABORTS before Write.
- **Pass criteria:** Self-check is a pre-flight check, not a post-write verification.

### TC-7.3: Reuse-mutations trivially satisfy FR-1.7 (Glob already filtered)
- **Category:** Filename Prefix
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-7-A1
- **Mapped AC:** AC-1
- **Preconditions:** Stage-1 reuse path
- **Inputs:** Reuse-append targeting the matched file from FR-1.1 Glob
- **Steps:**
  1. Inspect the file path the agent writes to
- **Expected output / state:** The path is exactly what Glob returned (already starts with `ondemand-`). Self-check passes trivially.
- **Pass criteria:** No new check is needed for reuse-mutations; input is pre-filtered.

### TC-7.4: Write outside `~/.claude/agents/` -> rejected by FR-1.8
- **Category:** Filename Prefix
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-7-E1
- **Mapped AC:** AC-1
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Candidate paths: `/tmp/ondemand-foo.md`, `./ondemand-foo.md`, `/etc/ondemand-foo.md`
- **Steps:**
  1. For each, simulate the agent attempting a Write
- **Expected output / state:** All REJECTED. The agent's path-restriction self-check confines writes to `~/.claude/agents/ondemand-*.md` and `.claude/roles-pending.md`.
- **Pass criteria:** Path restriction holds; no writes leak outside the allowed directories.

### TC-7.5: Filename casing and whitespace anomalies -> reject or auto-correct
- **Category:** Filename Prefix
- **Type:** Unit
- **Priority:** P2
- **Mapped UC:** UC-7-EC1, UC-7-EC2
- **Mapped AC:** AC-1
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Filenames: `Ondemand-mobile-dev.md` (uppercase prefix), `ondemand-mobile-dev .md` (space before extension), `ondemand- mobile-dev.md` (space after prefix)
- **Steps:**
  1. For each, run the self-check
- **Expected output / state:** All REJECTED on case-sensitive FS (uppercase prefix violates literal `ondemand-`). Whitespace cases REJECTED. Auto-correction strips whitespace and lowercases (Rule 1 fix) when feasible.
- **Pass criteria:** Defense against case and whitespace anomalies holds.

---

## Family G: Legacy File Migration (FR-7)

### TC-8.1: Legacy file at Stage-1 match -> migrate (add `features:` field)
- **Category:** Legacy Migration
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-8
- **Mapped AC:** AC-6, AC-12
- **Preconditions:** `ondemand-mobile-dev.md` exists from iter-1 with frontmatter lacking `features:` field; PRD recommends `mobile-dev` (slug match); current `<project-name>:<feature-slug>` is `claude-code-sdlc:role-planner-reuse-teardown`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect frontmatter post-invocation
- **Expected output / state:** `features:` field is added with value `["claude-code-sdlc:role-planner-reuse-teardown"]` (single-entry array). Other frontmatter fields (`name`, `description`, `tools`, `model`, `scope`) are preserved byte-for-byte. Body below `---` is byte-identical to before.
- **Pass criteria:** Migration adds the field; all other content is preserved.

### TC-8.2: Migration audit annotation `legacy-migrated`
- **Category:** Legacy Migration
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-8
- **Mapped AC:** AC-6, AC-14
- **Preconditions:** Same as TC-8.1
- **Inputs:** Same
- **Steps:**
  1. Read `.claude/roles-pending.md`
- **Expected output / state:** `## Reuse Decisions` records the entry as `legacy-migrated`.
- **Pass criteria:** Distinct annotation per FR-8.1; not `stage-1-exact-slug-match`.

### TC-8.3: Precedence rule -- `legacy-migrated` supersedes `stage-2-purpose-match-approved` when both apply
- **Category:** Legacy Migration
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-8-A1 (architect-pinned precedence)
- **Mapped AC:** AC-14
- **Preconditions:** Legacy file matched at Stage 2 (slug differs, purpose matches); user approves
- **Inputs:** Bootstrap Step 3.75 invocation; user reply "yes"
- **Steps:**
  1. Run invocation
  2. Inspect annotation
- **Expected output / state:** Annotation is `legacy-migrated` (NOT `stage-2-purpose-match-approved`). The 8-status enum is exclusive; precedence rule disambiguates.
- **Pass criteria:** Architect-pinned precedence rule applied; only one status per recommendation.

### TC-8.4: Legacy file NOT matched -> left unchanged
- **Category:** Legacy Migration
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-8-A2
- **Mapped AC:** AC-6
- **Preconditions:** Legacy `ondemand-old-role.md` exists; current recommendation does NOT match it under Stage 1 or Stage 2
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Capture sha256 of the legacy file before invocation
  2. Run invocation
  3. Capture sha256 after
- **Expected output / state:** sha256 values match. The legacy file is byte-identical (no migration). Optional informational note in audit: "Found 1 legacy file (ondemand-old-role.md) not matched by current recommendations; left unchanged."
- **Pass criteria:** Migration is opportunistic; non-matching legacy files are untouched.

### TC-8.5: Migrated file no longer treated as legacy on subsequent runs
- **Category:** Legacy Migration
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-8 (FR-7.5)
- **Mapped AC:** AC-6
- **Preconditions:** TC-8.1 has run; the previously-legacy file now has `features: ["claude-code-sdlc:role-planner-reuse-teardown"]`
- **Inputs:** A second bootstrap on a different feature branch; recommendation matches slug
- **Steps:**
  1. Run a second invocation
  2. Inspect annotation
- **Expected output / state:** Annotation is `stage-1-exact-slug-match`, NOT `legacy-migrated`. The file now has the iter-2 schema.
- **Pass criteria:** Migration is a one-time operation per file; subsequent reuse is normal Stage-1.

### TC-8.6: Legacy with malformed YAML -> `migration-failed-malformed-yaml` (architect [STRUCTURAL] 1)
- **Category:** Legacy Migration
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-8-E1 (architect [STRUCTURAL] 1)
- **Mapped AC:** AC-14
- **Preconditions:** Legacy file with malformed frontmatter (no `features:` field AND parse fails)
- **Inputs:** Bootstrap Step 3.75 invocation; recommendation matches the slug
- **Steps:**
  1. Run invocation
  2. Inspect annotation and audit log
- **Expected output / state:** Annotation: `migration-failed-malformed-yaml`. The agent does NOT attempt to write a partially-repaired frontmatter; does NOT use string-substitution heuristics. Audit log surfaces the malformed file path. Recommendation falls through to Stage 3 with the originally-recommended slug (provided no slug collision; if collision, `malformed-yaml-skipped` per FR-7.2 wording).
- **Pass criteria:** Architect [STRUCTURAL] 1 status enum entry emitted; no silent attempt to repair YAML.

---

## Family H: Cross-Project Sharing (FR-1.2, FR-1.3, FR-1.4)

### TC-9.1: `<project-name>:<feature-slug>` namespacing per FR-1.2
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-2, UC-9
- **Mapped AC:** AC-3
- **Preconditions:** Current branch `feat/checkout-flow-redesign`; project basename `acme-app`
- **Inputs:** Bootstrap Step 3.75 invocation; recommendation matches existing file
- **Steps:**
  1. Run invocation
  2. Inspect appended entry in `features:`
- **Expected output / state:** Entry is exactly `acme-app:checkout-flow-redesign` (project-name colon feature-slug). The colon is the separator.
- **Pass criteria:** Namespacing format is precisely correct.

### TC-9.2: Same role file referenced by multiple projects
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-9
- **Mapped AC:** AC-3
- **Preconditions:** `ondemand-mobile-dev.md` exists with `features: ["acme-app:onboarding", "beta-app:checkout"]`; current project is `gamma-app`, branch `feat/payment-integration`; PRD recommends `mobile-dev`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect post-state `features:` array
- **Expected output / state:** Array becomes `["acme-app:onboarding", "beta-app:checkout", "gamma-app:payment-integration"]` (size 3, all three projects). Body byte-unchanged.
- **Pass criteria:** Cross-project sharing works; namespacing prevents collision.

### TC-9.3: Single-line vs multi-line YAML serialization based on length
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-9 (FR-5.3)
- **Mapped AC:** AC-12
- **Preconditions:** Two test files: one with short combined `features:` (<80 chars), one with long combined (>80 chars when single-line)
- **Inputs:** Append a new entry to each via Stage-1 reuse
- **Steps:**
  1. For short case: append; verify single-line `features: ["a", "b"]` form
  2. For long case: append; verify multi-line block-style form (one entry per line under `features:`)
- **Expected output / state:** Short case is single-line. Long case uses multi-line block-style. Both are valid YAML.
- **Pass criteria:** Serialization choice matches FR-5.3 length-based rule.

### TC-9.4: Non-git context -> project-name = `unknown-project` (architect Edit 5)
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-9-A2 (architect Edit 5)
- **Mapped AC:** AC-3
- **Preconditions:** CWD is NOT inside a git repo (e.g., `/tmp` outside any repo)
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. cd to a non-git directory
  2. Invoke `/bootstrap-feature`
  3. Inspect orchestrator-derived project-name
- **Expected output / state:** Project-name is the literal string `unknown-project`. The reuse-scan still runs (read-only).
- **Pass criteria:** `unknown-project` placeholder used per FR-1.3 fallback.

### TC-9.5: Non-git context + non-feature branch -> no append, all Stage-3, manual-slug warning
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-9-A2 (architect Edit 5)
- **Mapped AC:** AC-3
- **Preconditions:** Non-git context; orchestrator cannot derive feature-slug
- **Inputs:** Bootstrap Step 3.75 invocation; PRD recommends one role
- **Steps:**
  1. Run invocation
  2. Inspect post-state file and audit
- **Expected output / state:** No `features:` array append occurs. Recommendation falls through to Stage 3. New file's `features: []` is empty (documented technical debt). Audit log emits manual-slug warning: "Cannot derive feature-slug from non-feature branch ..."
- **Pass criteria:** Architect Edit 5: empty `features: []` for new files in non-git context; warning emitted.

### TC-9.6: Non-git context -- read-only scan still happens
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-9-A2
- **Mapped AC:** AC-3
- **Preconditions:** Non-git context; `~/.claude/agents/` has existing `ondemand-*.md` files
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Instrument tool log
  2. Run invocation
- **Expected output / state:** Glob runs and returns existing files. Read of those files runs. No Write to existing `features:` arrays. The scan is read-only despite the inability to compute a feature-slug.
- **Pass criteria:** Scan runs read-only in non-git contexts.

### TC-9.7: Project-name with special characters
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-9-EC1
- **Mapped AC:** AC-3
- **Preconditions:** Project root basename contains a space and exclamation: e.g., `My App!`
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Set up such a directory: `mkdir -p '/tmp/My App!' && cd '/tmp/My App!' && git init`
  2. Invoke
  3. Inspect appended entry
- **Expected output / state:** Entry is `"My App!:feature-slug"` (quoted in JSON-style YAML). Round-trip via parse + serialize preserves the exact characters.
- **Pass criteria:** Special characters survive YAML quoting.

### TC-9.8: Project-name colliding with feature-slug -> still unambiguous via colon separator
- **Category:** Cross-Project Sharing
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-9-EC2
- **Mapped AC:** AC-3
- **Preconditions:** Project name `mobile-dev` with feature `onboarding` (i.e., entry would be `mobile-dev:onboarding`)
- **Inputs:** Bootstrap Step 3.75 invocation; recommendation triggers reuse
- **Steps:**
  1. Run invocation
  2. Inspect entry
- **Expected output / state:** Entry is `mobile-dev:onboarding`. The colon is structural; no collision with another project's feature-slug `mobile-dev`.
- **Pass criteria:** Colon-based namespacing is unambiguous.

---

## Family I: Teardown -- Entry Removal (FR-3.6)

### TC-10.1: Teardown removes entry, file kept (other features remain)
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-10
- **Mapped AC:** AC-7, AC-8
- **Preconditions:** `ondemand-mobile-dev.md` has `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign"]`; current is post-merge of `feat/checkout-flow-redesign`; project `acme-app`
- **Inputs:** `/merge-ready` Step 11 invocation
- **Steps:**
  1. Verify pre-state
  2. Run `/merge-ready`
  3. Inspect post-state
- **Expected output / state:** `features:` array becomes `["acme-app:onboarding"]`. File still exists on disk. Body byte-unchanged. Summary line: `Post-Merge: On-Demand Role Teardown -- 1 roles updated, 0 deleted, 0 unchanged`.
- **Pass criteria:** Entry removed; file kept because array remained non-empty.

### TC-10.2: Removal preserves file body byte-for-byte (FR-5.5)
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-10
- **Mapped AC:** AC-13
- **Preconditions:** Same as TC-10.1
- **Inputs:** `/merge-ready` Step 11 invocation
- **Steps:**
  1. Compute sha256 of body below `---` before
  2. Run Step 11
  3. Compute sha256 of body below `---` after
- **Expected output / state:** sha256 values match. The role's prompt instructions are preserved.
- **Pass criteria:** Body checksum unchanged; only frontmatter mutated.

### TC-10.3: Atomic write on entry removal (FR-5.1, FR-5.2)
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-10
- **Mapped AC:** AC-12
- **Preconditions:** Same as TC-10.1
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Inspect orchestrator's tool log
  2. Verify Read precedes Write; no Edit invocations against the file
- **Expected output / state:** Atomic Read -> parse -> mutate in memory -> serialize -> Write. NO Edit operations. NO partial in-place edits.
- **Pass criteria:** Read-modify-write pattern; no Edit usage.

### TC-10.4: Per-file audit log entry (FR-4.7)
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-10
- **Mapped AC:** AC-7
- **Preconditions:** Same as TC-10.1
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Inspect `/merge-ready` output
- **Expected output / state:** Per-file decision logged as: `ondemand-mobile-dev.md -> updated (entry removed, array still non-empty)`.
- **Pass criteria:** Audit log granularity is per-file.

### TC-10.5: Multiple files updated -- multiple `N` count
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-10-A1
- **Mapped AC:** AC-8
- **Preconditions:** 3 different ondemand files each contain `acme-app:checkout-flow-redesign` AND each has additional entries (so all three remain non-empty after removal)
- **Inputs:** Step 11 invocation post-merge
- **Steps:**
  1. Run Step 11
- **Expected output / state:** All 3 files have the entry removed. All 3 remain on disk. Summary: `3 roles updated, 0 deleted, 0 unchanged`.
- **Pass criteria:** N=3 in summary; all 3 files updated.

### TC-10.6: Mixed outcomes -- update + delete + unchanged
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-10-A2, UC-11-A2
- **Mapped AC:** AC-8
- **Preconditions:** Pool of 5 files: 2 contain entry + others (will update), 1 contains only entry (will delete), 2 don't contain entry (unchanged)
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** Summary: `2 roles updated, 1 deleted, 2 unchanged`. Total scanned = 5 = N + M + K = 2 + 1 + 2.
- **Pass criteria:** Summary counts are exact; total checks out.

### TC-10.7: ALL-occurrence removal (architect [STRUCTURAL] 2)
- **Category:** Teardown Entry Removal
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-10-EC1 (architect [STRUCTURAL] 2)
- **Mapped AC:** AC-8
- **Preconditions:** `ondemand-mobile-dev.md` has `features: ["acme-app:onboarding", "acme-app:checkout-flow-redesign", "acme-app:checkout-flow-redesign", "acme-app:other"]` (entry duplicated due to manual editing or prior bug)
- **Inputs:** Step 11 invocation post-merge of `checkout-flow-redesign`
- **Steps:**
  1. Run Step 11
  2. Inspect post-state array
- **Expected output / state:** Array becomes `["acme-app:onboarding", "acme-app:other"]` (size 2). BOTH duplicate `checkout-flow-redesign` entries are removed in a single mutation -- not just the first occurrence.
- **Pass criteria:** Architect [STRUCTURAL] 2: ALL occurrences removed in one shot; supports NFR-2 idempotency on re-run.

---

## Family J: Teardown -- File Deletion (FR-3.6, FR-4.3, FR-4.5, architect [STRUCTURAL] 4)

### TC-11.1: Empty array after removal -> delete file directly (no intermediate Write)
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-11 (architect [STRUCTURAL] 4)
- **Mapped AC:** AC-8, AC-11
- **Preconditions:** `ondemand-some-specialist.md` has `features: ["claude-code-sdlc:role-planner-reuse-teardown"]` (size 1, only this feature); post-merge of that feature
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Instrument the orchestrator's tool log
  2. Run Step 11
  3. Inspect tool sequence
- **Expected output / state:** After in-memory mutation produces empty array, the orchestrator invokes `rm` (Bash) DIRECTLY. NO intermediate Write of an empty-array version is observed. Tool sequence: Read -> in-memory removal -> Bash `rm`.
- **Pass criteria:** Architect [STRUCTURAL] 4: atomic delete-only; no intermediate empty-array Write hits disk.

### TC-11.2: File path verified under `~/.claude/agents/` before `rm` (FR-4.3)
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-11
- **Mapped AC:** AC-11
- **Preconditions:** Same as TC-11.1
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Inspect path resolution before deletion
- **Expected output / state:** The orchestrator resolves the file path and verifies the resolved path is under `~/.claude/agents/` AND begins with `ondemand-`. Defense-in-depth check passes; deletion proceeds.
- **Pass criteria:** Resolution check executes; path within boundary.

### TC-11.3: Deletion summary count (M) reflects deletion
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-11
- **Mapped AC:** AC-8
- **Preconditions:** Same as TC-11.1
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect summary line
- **Expected output / state:** Summary: `Post-Merge: On-Demand Role Teardown -- 0 roles updated, 1 deleted, 0 unchanged`.
- **Pass criteria:** M=1; deletion counted.

### TC-11.4: Multiple deletions in single Step 11
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-11-A1
- **Mapped AC:** AC-8
- **Preconditions:** 3 ondemand files each have `features:` of size 1 containing only the merged feature
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** All 3 files deleted. Summary: `0 roles updated, 3 deleted, 0 unchanged`.
- **Pass criteria:** Multiple deletions handled in one invocation.

### TC-11.5: Legacy file at Step 11 -> NOT deleted, optional `L` legacy count
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-8-EC1
- **Mapped AC:** AC-7
- **Preconditions:** `ondemand-old-role.md` lacks `features:` field (legacy)
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect output and file system
- **Expected output / state:** The legacy file is NOT deleted; it remains on disk byte-unchanged. Summary may include `; <L> legacy files left unchanged` (e.g., `; 1 legacy files left unchanged`). The legacy file is NOT counted in N/M/K.
- **Pass criteria:** Legacy files survive teardown; optional informational note appended.

### TC-11.6: Pre-empty `features: []` is NOT a deletion trigger
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-10-EC2 (architect-clarified)
- **Mapped AC:** AC-8
- **Preconditions:** `ondemand-foo.md` has `features: []` (already empty from prior partial-failure or manual editing); current feature is `claude-code-sdlc:bar`
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect file system
- **Expected output / state:** The orchestrator searches for `claude-code-sdlc:bar`; not found in the empty array. File is `K` (unchanged). The file is NOT deleted just because the array is empty -- deletion ONLY triggers from a transition from non-empty to empty CAUSED BY THE CURRENT removal.
- **Pass criteria:** Pre-existing empty arrays survive; deletion is conditional on the act of removal.

### TC-11.7: `rm` failure -> file left in prior state, status `failed`
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-11-E1 (architect-clarified)
- **Mapped AC:** AC-8
- **Preconditions:** `ondemand-some-specialist.md` has `features: ["claude-code-sdlc:role-planner-reuse-teardown"]`; the file's permissions or directory permissions cause `rm` to fail
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Set up rm-failure scenario
  2. Run Step 11
  3. Inspect file system
- **Expected output / state:** The file is LEFT IN ITS PRIOR STATE on disk -- entry still present, array still non-empty. NO partial state on disk. The audit trail records status `failed`. Summary line includes `; <F> failed (see audit log)`.
- **Pass criteria:** Architect-clarified delete-only semantics: file is NOT half-mutated; audit captures the failure.

### TC-11.8: Failed-file count `F` appears in summary when applicable (architect Edit 6)
- **Category:** Teardown Deletion
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-10-E1, UC-11-E1 (architect Edit 6)
- **Mapped AC:** AC-8
- **Preconditions:** Mixed scenario: 1 file updated (success), 1 file fails to update (Write fails), 0 deleted, 1 unchanged
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect summary line
- **Expected output / state:** Summary line: `Post-Merge: On-Demand Role Teardown -- 1 roles updated, 0 deleted, 1 unchanged; 1 failed (see audit log)`. The `F` count appears as a fourth field after a semicolon.
- **Pass criteria:** Architect Edit 6: F-count appended when applicable; not present when zero failures.

---

## Family K: Teardown Safety -- Branch Validation (FR-4.1, FR-4.2)

### TC-12.1: Refuse from `main` (no merged-PR context) -- literal error message
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-12
- **Mapped AC:** AC-9
- **Preconditions:** Current branch `main`; no recent merge commit visible; no `--feature-slug` argument
- **Inputs:** `/merge-ready` Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect output
- **Expected output / state:** The orchestrator emits the literal error message: `"Refusing teardown from non-feature branch 'main' without explicit feature-slug -- pass via merged PR context or skip Step 11"`. Summary line: `0 roles updated, 0 deleted, 0 unchanged` plus the verbatim refusal message.
- **Pass criteria:** Verbatim string match; counts all zero.

### TC-12.2: Refuse from main -- no file system mutation
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-12
- **Mapped AC:** AC-9, AC-11
- **Preconditions:** TC-12.1 setup; pool has multiple ondemand files
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Compute sha256 of every file in the pool before
  2. Run Step 11
  3. Compute sha256 after
- **Expected output / state:** Every sha256 is unchanged. ZERO files modified. ZERO deletions. The pool is byte-identical to before.
- **Pass criteria:** Refusal short-circuits before any file write or delete.

### TC-12.3: Refusal does NOT block merge-readiness
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-12
- **Mapped AC:** AC-7, AC-9
- **Preconditions:** TC-12.1 setup; Gates 1-9 all pass
- **Inputs:** `/merge-ready` invocation (full)
- **Steps:**
  1. Run `/merge-ready`
  2. Inspect overall result
- **Expected output / state:** `/merge-ready` overall result is determined by Gates 1-9 alone. Step 11's refusal does NOT change the gate-pass tally.
- **Pass criteria:** Step 11 is a step, not a gate; refusal is informational.

### TC-12.4: Recent merge commit visible from main -> proceed normally
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-12-A1
- **Mapped AC:** AC-7
- **Preconditions:** Branch `main`; `git log -1 --merges` shows the merge commit for `feat/checkout-flow-redesign`
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Verify the merge commit is visible
  2. Run Step 11
- **Expected output / state:** Feature-slug derivation succeeds (parses merge commit message/parents). Step 11 proceeds normally per UC-10 / UC-11.
- **Pass criteria:** When merged-PR context is available from `main`, teardown runs.

### TC-12.5: Many merges in history -> picks most-recent
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-12-A2
- **Mapped AC:** AC-7
- **Preconditions:** `main` has multiple merge commits over time; only the most-recent is consumed
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** The orchestrator inspects only the most-recent merge commit (`git log -1 --merges`); older merges are not retroactively torn down.
- **Pass criteria:** Per-merge teardown; no backfill.

### TC-12.6: Ambiguous merge commit -> refuse
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-12-E1
- **Mapped AC:** AC-9
- **Preconditions:** Merge commit's message and parents do not unambiguously identify the merged branch
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** Refusal applies; same FR-8.2 refusal output as TC-12.1.
- **Pass criteria:** Conservative refusal when context is ambiguous.

### TC-12.7: Uncommitted changes do NOT change refusal behavior
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-12-EC1
- **Mapped AC:** AC-9
- **Preconditions:** On `main` with uncommitted changes; no merged-PR context
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** Refusal applies (same as TC-12.1). Uncommitted changes do not affect teardown.
- **Pass criteria:** Branch-name-based refusal is independent of working tree state.

### TC-12.8: Refuse from `chore/foo` (non-feature, non-main) (architect [STRUCTURAL] 3)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-12-EC2 (architect [STRUCTURAL] 3)
- **Mapped AC:** AC-9
- **Preconditions:** Current branch `chore/foo`; no merged-PR context
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect output
- **Expected output / state:** Refusal applies. Error message names the current branch: `"Refusing teardown from non-feature branch 'chore/foo' without explicit feature-slug -- pass via merged PR context or skip Step 11"`.
- **Pass criteria:** Architect [STRUCTURAL] 3: refusal extends beyond `main`.

### TC-12.9: Refuse from `release/2026-04` (architect [STRUCTURAL] 3)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-12-EC2 (architect [STRUCTURAL] 3)
- **Mapped AC:** AC-9
- **Preconditions:** Current branch `release/2026-04`; no merged-PR context
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** Refusal with branch name `release/2026-04` in the error message.
- **Pass criteria:** Release branches refused per architect [STRUCTURAL] 3.

### TC-12.10: Refuse from `develop` and `staging` (architect [STRUCTURAL] 3)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-12-EC2 (architect [STRUCTURAL] 3)
- **Mapped AC:** AC-9
- **Preconditions:** Test on `develop`, then on `staging`
- **Inputs:** Step 11 invocation in each
- **Steps:**
  1. Run on `develop`; capture refusal
  2. Run on `staging`; capture refusal
- **Expected output / state:** Both runs refused with the respective branch name in the error message.
- **Pass criteria:** All non-feature non-main branches refused.

### TC-12.11: Refuse from detached HEAD (architect [STRUCTURAL] 3)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-12-EC2 (architect [STRUCTURAL] 3)
- **Mapped AC:** AC-9
- **Preconditions:** Detached HEAD state (`git checkout <commit-sha>`); no merged-PR context
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11
- **Expected output / state:** Refusal with branch name `HEAD` (or the literal string used by `git rev-parse --abbrev-ref HEAD` in detached state) in the error message.
- **Pass criteria:** Detached HEAD refused per architect [STRUCTURAL] 3.

---

## Family L: Teardown Safety -- Merge-Ancestry & Path (FR-4.1, FR-4.3, FR-4.4, FR-4.5)

### TC-13.1: Refuse if branch not yet merged -- literal error
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-13, UC-CC-1-E1
- **Mapped AC:** AC-10
- **Preconditions:** On `feat/role-planner-reuse-teardown`; branch NOT yet merged into main; `git merge-base --is-ancestor` returns NON-zero
- **Inputs:** `/merge-ready` Step 11 invocation
- **Steps:**
  1. Run Step 11
  2. Inspect output
- **Expected output / state:** Literal error: `"Refusing teardown: branch 'role-planner-reuse-teardown' is not yet merged into main"`. Summary line: `0 roles updated, 0 deleted, 0 unchanged`.
- **Pass criteria:** Verbatim error string match; zero counts.

### TC-13.2: `git merge-base --is-ancestor` invocation verifies ancestry
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-13
- **Mapped AC:** AC-10
- **Preconditions:** Same as TC-13.1
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Inspect orchestrator's Bash invocations
- **Expected output / state:** `git merge-base --is-ancestor <feature-branch-head> main` is invoked exactly once. Its non-zero exit triggers the refusal.
- **Pass criteria:** Specific git command used; non-zero exit triggers refusal.

### TC-13.3: Squash-merge / rebase-merge correctly fails ancestor check (acknowledged false negative)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-13-A1, UC-13-A2 (architect-acknowledged false-negative)
- **Mapped AC:** AC-10
- **Preconditions:** Feature branch was squash-merged or rebase-merged via GitHub UI; the squashed commit on main has a different SHA than the original tip
- **Inputs:** Step 11 invocation post-squash-merge
- **Steps:**
  1. Run Step 11
- **Expected output / state:** `git merge-base --is-ancestor` returns non-zero (squashed commit is not an ancestor). Refusal applies. The orchestrator does NOT attempt to detect the squash-merge case. The developer manually removes ondemand role files.
- **Pass criteria:** Conservative refusal preferred over guessing; per Section 8.4 item 6.

### TC-13.4: Marker mismatch (`scope: core` on `ondemand-` file) -> SKIP, not delete (FR-4.5)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-11-E2
- **Mapped AC:** AC-11
- **Preconditions:** `ondemand-foo.md` exists with frontmatter `scope: core` (NOT `on-demand`)
- **Inputs:** Step 11 invocation; the file's `features:` would otherwise trigger deletion
- **Steps:**
  1. Run Step 11
  2. Inspect file system
- **Expected output / state:** File is NOT deleted. Warning emitted: "Marker mismatch on ondemand-foo.md: scope is 'core', not 'on-demand'. Skipping teardown for this file." File counted as separate audit entry; not in N/M/K.
- **Pass criteria:** Two-marker defense: BOTH `ondemand-` prefix AND `scope: on-demand` required; only one is insufficient.

### TC-13.5: Symlink path resolution -> refuse deletion (FR-4.3)
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-11-EC1
- **Mapped AC:** AC-11
- **Preconditions:** `~/.claude/agents/ondemand-attack.md` is a symlink pointing to `/etc/passwd`; symlink would otherwise trigger deletion
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Set up the malicious symlink
  2. Run Step 11
  3. Verify `/etc/passwd` is intact
- **Expected output / state:** Path resolution returns `/etc/passwd`; not under `~/.claude/agents/`. Deletion REFUSED. Warning emitted: "Path traversal attempt detected: ondemand-attack.md resolves to /etc/passwd. Skipping deletion." `/etc/passwd` is byte-unchanged.
- **Pass criteria:** Defense-in-depth path resolution; path-traversal blocked.

### TC-13.6: Filename with shell metacharacters -> properly quoted in `rm`
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-11-EC2
- **Mapped AC:** AC-11
- **Preconditions:** A pathological filename like `ondemand-foo;rm -rf ~.md` exists (constructed, not produced by role-planner)
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Set up the file
  2. Run Step 11
  3. Verify no shell injection
- **Expected output / state:** `rm` invocation properly quotes the path. NO `rm -rf ~` shell injection. The file (if it satisfied other safety conditions) is deleted as the literal filename.
- **Pass criteria:** Bash invocation safely quotes paths; defense-in-depth holds.

### TC-13.7: `git merge-base` itself fails -> refuse
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-13-E1
- **Mapped AC:** AC-10
- **Preconditions:** `git` not on PATH OR repo is corrupted
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Set up failure scenario
  2. Run Step 11
- **Expected output / state:** Verification cannot complete; per FR-4.1 / FR-4.6, refusal applies. Same refusal output as TC-13.1.
- **Pass criteria:** Fail-clean: missing tools cause refusal, not crash.

### TC-13.8: Pull main before re-running -> idempotency holds
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-13-EC1
- **Mapped AC:** AC-10
- **Preconditions:** TC-13.1 setup; then `git pull` updates `main`; ancestry check now PASSES
- **Inputs:** Step 11 re-invocation after pull
- **Steps:**
  1. Initial Step 11 -> refused
  2. `git pull`
  3. Re-run Step 11
- **Expected output / state:** Re-run proceeds normally per UC-10 / UC-11. NFR-2 idempotency holds; the entry is removed once.
- **Pass criteria:** Refusal then proceed produces the expected end state.

### TC-13.9: Stale local main (remote merged but local not pulled) -> refuse
- **Category:** Teardown Safety
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-13-EC2
- **Mapped AC:** AC-10
- **Preconditions:** Branch merged on remote `main`, but local `main` has not pulled the merge
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run Step 11 against stale local main
- **Expected output / state:** `git merge-base` against local main returns non-zero. Refusal applies. Operation is local-only (no network).
- **Pass criteria:** No network access required; local refs determine outcome.

---

## Family M: Atomic Frontmatter Mutation (FR-5)

### TC-14.1: Atomic read-modify-write -- whole-file Write, never Edit
- **Category:** Atomic Mutation
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-14
- **Mapped AC:** AC-12
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect `src/agents/role-planner.md` prompt body
- **Steps:**
  1. `grep -n "Edit" src/agents/role-planner.md` (looking for prompt instructions to use Edit on `features:`)
  2. `grep -n "Write" src/agents/role-planner.md`
- **Expected output / state:** No prompt-body instruction directs the agent to use Edit for `features:` mutations. The Write whole-file replacement is the documented contract.
- **Pass criteria:** Agent prompt prescribes Write, not Edit, for `features:` mutations.

### TC-14.2: Frontmatter mutated in memory, then full file Written
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-2, UC-10
- **Mapped AC:** AC-12, AC-13
- **Preconditions:** TC-2.1 setup
- **Inputs:** Bootstrap reuse-append OR teardown remove
- **Steps:**
  1. Instrument tool log
  2. Inspect Read -> (in-memory work) -> Write sequence
  3. Compare body sha256 before and after
- **Expected output / state:** Read of entire file -> in-memory mutation of `features:` -> Write of entire file. Body below `---` byte-identical pre and post.
- **Pass criteria:** Entire file is read and rewritten; body checksum unchanged.

### TC-14.3: Atomic Write fails (disk full) -> file in prior or fully-replaced state, never partial
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-2-E1
- **Mapped AC:** AC-12
- **Preconditions:** Disk-full scenario simulated; Stage-1 reuse path
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Set up disk-full
  2. Run invocation
  3. Inspect file
- **Expected output / state:** File is either byte-identical to pre-state (Write failed) OR fully replaced (Write succeeded). NEVER half-written. Error escalated as Rule 3.
- **Pass criteria:** Atomic Write semantics hold; no torn writes.

### TC-14.4: Stage-3 Write fails after declined Stage-2 -> existing file untouched
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-4-E1
- **Mapped AC:** AC-12
- **Preconditions:** Stage-2 negative reply; new file Write fails
- **Inputs:** Bootstrap with disk full
- **Steps:**
  1. Run invocation
  2. Inspect existing file
- **Expected output / state:** Existing file `ondemand-mobile-dev.md` is byte-unchanged. The new file `ondemand-mobile-frontend-dev.md` was NOT created. Failure surfaced as Rule 3.
- **Pass criteria:** Stage-3 failure does not corrupt existing files.

### TC-14.5: Migration Write fails -> legacy file unchanged
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-8-E2
- **Mapped AC:** AC-12
- **Preconditions:** Legacy file; migration triggered; Write fails
- **Inputs:** Bootstrap invocation with disk full
- **Steps:**
  1. Capture sha256 of legacy file before
  2. Run invocation
  3. Capture sha256 after
- **Expected output / state:** sha256 matches; legacy file unchanged. Failure surfaced.
- **Pass criteria:** Failed migration does not corrupt the legacy file.

### TC-14.6: Teardown atomic Write fails -> file unchanged, F count
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-10-E1
- **Mapped AC:** AC-12
- **Preconditions:** Step 11; per-file Write fails (e.g., disk full)
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Set up failure
  2. Run Step 11
- **Expected output / state:** File unchanged. Audit log records `failed`. Summary includes F count.
- **Pass criteria:** Per-file failure does not corrupt file; audit tracks failure.

### TC-14.7: Concurrent edit -- last-write-wins per NFR-3
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-14, UC-14-A1, UC-14-EC1
- **Mapped AC:** AC-12
- **Preconditions:** Bootstrap reads file at T0; developer edits and saves at T1; bootstrap writes at T2 > T1
- **Inputs:** Concurrent edit scenario
- **Steps:**
  1. Simulate the timing
  2. Inspect final state
- **Expected output / state:** Bootstrap's mutation is on disk; developer's edit is silently lost. NFR-3 last-write-wins. Audit trail shows bootstrap's intent.
- **Pass criteria:** Documented concurrent-edit behavior; no locking; audit captures intent.

### TC-14.8: Re-read on conflict (re-run bootstrap to fix)
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-14-A2
- **Mapped AC:** AC-12
- **Preconditions:** Audit-trail vs on-disk mismatch detected after concurrent edit
- **Inputs:** Re-run `/bootstrap-feature`
- **Steps:**
  1. Re-run
  2. Inspect post-state
- **Expected output / state:** The agent re-scans the current state, applies the mutation. NFR-2 idempotency: append is a no-op if entry already exists.
- **Pass criteria:** Re-run is safe and converges.

### TC-14.9: Developer's malformed YAML overwritten by agent's repair
- **Category:** Atomic Mutation
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-14-E1
- **Mapped AC:** AC-12
- **Preconditions:** Developer saves malformed YAML; agent's atomic Write happens after
- **Inputs:** Race ordering: developer save -> agent write
- **Steps:**
  1. Simulate
  2. Inspect post-state
- **Expected output / state:** The agent's re-serialization (from a parsed-then-mutated structure) overwrites the malformed version. The malformation is repaired as a side effect of the Write.
- **Pass criteria:** Race ordering can repair malformed YAML; documented per Risk 7.

### TC-14.10: No partial in-place edits via sed/awk in orchestrator
- **Category:** Atomic Mutation
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-14
- **Mapped AC:** AC-12
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect `src/commands/merge-ready.md` for Step 11 documentation
- **Steps:**
  1. `grep -n "sed\|awk" src/commands/merge-ready.md` (in Step 11 section)
  2. Verify orchestrator uses Read -> in-memory mutation -> Write pattern, not in-place text manipulation
- **Expected output / state:** No `sed -i` or `awk` invocations against `~/.claude/agents/ondemand-*.md` for `features:` mutation. The orchestrator uses Read + Write per FR-5.1.
- **Pass criteria:** Documented teardown logic uses atomic read-modify-write, not in-place text edits.

---

## Family N: Idempotency (NFR-2, FR-3.6)

### TC-15.1: Re-run bootstrap reuse-append -> no duplicate
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-2-A1, UC-CC-1-EC1, UC-CC-2-A2
- **Mapped AC:** AC-3
- **Preconditions:** Feature already in `features:` array
- **Inputs:** Re-run `/bootstrap-feature`
- **Steps:**
  1. Run twice on identical state
  2. Verify no duplicate entry
- **Expected output / state:** Array unchanged; `## Reuse Decisions` may note "feature already listed; no-op" or simply record `stage-1-exact-slug-match`.
- **Pass criteria:** Idempotent on duplicate-append.

### TC-15.2: Re-run teardown -> no-op (already torn down)
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-15, UC-11-EC3
- **Mapped AC:** AC-8
- **Preconditions:** Step 11 was run; entries removed; some files deleted
- **Inputs:** Re-run `/merge-ready` Step 11
- **Steps:**
  1. Run Step 11 once
  2. Run Step 11 again (same merged feature)
  3. Compare before/after of run 2
- **Expected output / state:** Run 2 is a no-op. Summary: `0 roles updated, 0 deleted, K unchanged`. No file changed; no file deleted.
- **Pass criteria:** Re-run produces identical state on disk.

### TC-15.3: Re-run after deletion -- file absent from glob
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-15
- **Mapped AC:** AC-8
- **Preconditions:** A file was deleted on prior run
- **Inputs:** Re-run Step 11
- **Steps:**
  1. Re-run
- **Expected output / state:** Glob does not return the deleted file; it is not scanned.
- **Pass criteria:** Deleted files are gracefully absent.

### TC-15.4: Re-run after a different feature merged in between
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-15-A1
- **Mapped AC:** AC-8
- **Preconditions:** Run 1 torn down feature A; feature B merged after; run 2 targets feature B
- **Inputs:** Step 11 for feature B
- **Steps:**
  1. Run 2
- **Expected output / state:** Step 11 for feature B is a legitimate teardown (not a no-op). Removes feature B's entries per UC-10/UC-11.
- **Pass criteria:** Idempotency is per-feature, not global.

### TC-15.5: Failed file count appears when applicable
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-10-E1
- **Mapped AC:** AC-8
- **Preconditions:** Mixed run with some failures
- **Inputs:** Step 11
- **Steps:**
  1. Run with mixed outcomes
- **Expected output / state:** Summary includes the `; <F> failed (see audit log)` suffix; absent when F=0.
- **Pass criteria:** F count tracked accurately.

### TC-15.6: Read fails on per-file -> non-blocking, separate audit entry
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-10-E2
- **Mapped AC:** AC-8
- **Preconditions:** One unreadable file; others readable
- **Inputs:** Step 11
- **Steps:**
  1. Run
- **Expected output / state:** Other files processed normally. Unreadable file has separate audit entry (not in N/M/K).
- **Pass criteria:** One file's failure does not abort the scan.

### TC-15.7: Manual re-add between runs -> teardown removes it again (last-write-wins)
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-15-A2
- **Mapped AC:** AC-8
- **Preconditions:** Run 1 removed entry; developer manually re-added entry; run 2 removes again
- **Inputs:** Step 11 re-run
- **Steps:**
  1. Run 1
  2. Manual re-add
  3. Run 2
- **Expected output / state:** Run 2 removes the re-added entry (it actively un-does the manual edit). Audit shows `1 updated`.
- **Pass criteria:** Re-run does not preserve manually-restored entries; last-write-wins.

### TC-15.8: Pool grew between runs -- new file unchanged on run 2
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-15-E1
- **Mapped AC:** AC-8
- **Preconditions:** Between run 1 and run 2, a different feature created a new ondemand file
- **Inputs:** Step 11 run 2
- **Steps:**
  1. Run 2
- **Expected output / state:** Run 2's Glob returns more files. The new file's `features:` does not contain run 2's feature. New file is `K` (unchanged).
- **Pass criteria:** Pool growth does not break idempotency; new files are correctly classified.

### TC-15.9: Pool empty on re-run
- **Category:** Idempotency
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-15-EC1
- **Mapped AC:** AC-8
- **Preconditions:** All ondemand files have been deleted by prior teardowns
- **Inputs:** Step 11 invocation
- **Steps:**
  1. Run
- **Expected output / state:** Glob returns 0 files. Summary: `0 roles updated, 0 deleted, 0 unchanged`. Trivial no-op.
- **Pass criteria:** Empty pool case is handled.

### TC-15.10: Bootstrap-then-teardown cycle is naturally idempotent
- **Category:** Idempotency
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-15-EC2
- **Mapped AC:** AC-3, AC-8
- **Preconditions:** Cycle: teardown -> bootstrap -> teardown -> bootstrap -> ...
- **Inputs:** Repeated cycle
- **Steps:**
  1. Run cycle 5 times
  2. Inspect final state
- **Expected output / state:** Each teardown removes the entries; each bootstrap re-adds them. State after cycle N matches state after cycle N+2. The cycle is naturally idempotent.
- **Pass criteria:** No state drift across multiple cycles.

---

## Family O: `## Reuse Decisions` Audit Subsection (FR-8.1)

### TC-16.1: `## Reuse Decisions` subsection appended to `.claude/roles-pending.md`
- **Category:** Audit Subsection
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-1, UC-2, UC-3
- **Mapped AC:** AC-14
- **Preconditions:** Bootstrap Step 3.75 invocation
- **Inputs:** Run a recommended-roles invocation
- **Steps:**
  1. Run invocation
  2. `grep -n "^## Reuse Decisions$" .claude/roles-pending.md`
  3. Verify the subsection appears AFTER `## Role invocation plan`
- **Expected output / state:** Exactly one occurrence of `## Reuse Decisions`. Appears after `## Additional Roles` and `## Role invocation plan`. The order in the temp file is: `## Additional Roles`, `## Role invocation plan`, `## Reuse Decisions`.
- **Pass criteria:** Subsection present and ordered correctly.

### TC-16.2: 8-status enum exhaustively (each status produced by some scenario)
- **Category:** Audit Subsection
- **Type:** E2E
- **Priority:** P0
- **Mapped UC:** UC-1 through UC-8 (all status outcomes)
- **Mapped AC:** AC-14
- **Preconditions:** Multiple invocations covering different paths
- **Inputs:** 8 distinct scenarios
- **Steps:**
  1. Run scenarios producing: `stage-1-exact-slug-match`, `stage-2-purpose-match-approved`, `stage-2-purpose-match-declined`, `stage-3-no-match-created`, `headless-default-create`, `legacy-migrated`, `malformed-yaml-skipped`, `migration-failed-malformed-yaml`
  2. Aggregate all `## Reuse Decisions` annotations
- **Expected output / state:** Aggregated set is exactly the 8 documented statuses (architect [STRUCTURAL] 1). No other status string appears.
- **Pass criteria:** Architect [STRUCTURAL] 1: 8-entry status enum is exclusive and complete.

### TC-16.3: Status enum contains the architect-added entries (architect [STRUCTURAL] 1)
- **Category:** Audit Subsection
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-2-EC1, UC-8-E1 (architect [STRUCTURAL] 1)
- **Mapped AC:** AC-14
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect `src/agents/role-planner.md` for the status enum documentation
- **Steps:**
  1. `grep -n "malformed-yaml-skipped" src/agents/role-planner.md`
  2. `grep -n "migration-failed-malformed-yaml" src/agents/role-planner.md`
- **Expected output / state:** Both terms appear at least once. The 8-entry enum is fully documented in the agent prompt.
- **Pass criteria:** Architect [STRUCTURAL] 1: both architect-added enum entries are present.

### TC-16.4: "No reuse decisions" / empty-list when no recommendations
- **Category:** Audit Subsection
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-1-A2
- **Mapped AC:** AC-15
- **Preconditions:** PRD recommends no extra roles
- **Inputs:** Bootstrap Step 3.75 invocation
- **Steps:**
  1. Run invocation
  2. Inspect `## Reuse Decisions` body
- **Expected output / state:** Subsection is present with empty body OR literal text "No reuse decisions -- no additional roles recommended". Plan Critic does NOT flag absence.
- **Pass criteria:** Empty case handled gracefully.

### TC-16.5: Precedence rule -- only one status per recommendation
- **Category:** Audit Subsection
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-8-A1
- **Mapped AC:** AC-14
- **Preconditions:** Scenario where both `legacy-migrated` and `stage-2-purpose-match-approved` could apply
- **Inputs:** Bootstrap with that scenario
- **Steps:**
  1. Run
  2. Inspect annotation for the recommendation
- **Expected output / state:** Only ONE status emitted: `legacy-migrated` (precedence per FR-8.1). The recommendation does NOT have two statuses.
- **Pass criteria:** Architect-pinned precedence rule honored; mutually exclusive statuses.

### TC-16.6: Plan Critic recognizes `## Reuse Decisions` as valid section
- **Category:** Audit Subsection
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-3 (FR-8.3)
- **Mapped AC:** AC-15
- **Preconditions:** `.claude/plan.md` contains a well-formed `## Reuse Decisions`
- **Inputs:** Spawn the Plan Critic
- **Steps:**
  1. Run Plan Critic against the plan file
  2. Inspect FINDINGS for any reference to `## Reuse Decisions`
- **Expected output / state:** Zero findings flagging the section as invalid.
- **Pass criteria:** Plan Critic accepts the section.

### TC-16.7: Plan Critic does NOT flag absence of `## Reuse Decisions`
- **Category:** Audit Subsection
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-1-A2 (FR-8.3)
- **Mapped AC:** AC-15
- **Preconditions:** A plan WITHOUT `## Reuse Decisions` (legacy plan, all-Stage-3 plan, "No additional roles" plan)
- **Inputs:** Plan Critic invocation
- **Steps:**
  1. Run Plan Critic
- **Expected output / state:** Zero findings about the absence. Legacy plans and no-roles plans pass cleanly.
- **Pass criteria:** Absence is not a finding.

### TC-16.8: Malformed status string -> MAY be MINOR finding
- **Category:** Audit Subsection
- **Type:** Integration
- **Priority:** P2
- **Mapped UC:** UC-3 (FR-8.3)
- **Mapped AC:** AC-15
- **Preconditions:** A plan with `## Reuse Decisions` containing a status NOT in the 8-enum (e.g., "stage-4-foobar")
- **Inputs:** Plan Critic invocation
- **Steps:**
  1. Run
- **Expected output / state:** A MINOR finding may be raised. Severity is MINOR, not CRITICAL/MAJOR.
- **Pass criteria:** Severity bound at MINOR; no critical/major escalation for unknown statuses.

---

## Family P: Defense-in-Depth Tool Allowlist (FR-9.7, NFR-7)

### TC-17.1: `tools` field is exactly `["Read", "Write", "Glob", "Grep"]`
- **Category:** Tool Allowlist
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-1, UC-2 (NFR-7)
- **Mapped AC:** AC-2
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect `src/agents/role-planner.md` frontmatter
- **Steps:**
  1. `grep -n "^tools:" src/agents/role-planner.md`
  2. Capture the line value
  3. Compare against the iter-1 byte-exact value
- **Expected output / state:** Line is exactly `tools: ["Read", "Write", "Glob", "Grep"]`. Byte-identical to the iter-1 value (no Bash addition, no Edit addition).
- **Pass criteria:** Field value byte-unchanged from iter-1.

### TC-17.2: NO Bash, Edit, WebFetch, WebSearch, NotebookEdit in tools
- **Category:** Tool Allowlist
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-1, UC-2 (NFR-7)
- **Mapped AC:** AC-2
- **Preconditions:** TC-17.1 captured the tools value
- **Inputs:** Tools value
- **Steps:**
  1. `grep -cE '"?Bash"?' (tools value)` -> expect 0
  2. `grep -cE '"?Edit"?' (tools value)` -> expect 0
  3. `grep -cE '"?WebFetch"?' (tools value)` -> expect 0
  4. `grep -cE '"?WebSearch"?' (tools value)` -> expect 0
  5. `grep -cE '"?NotebookEdit"?' (tools value)` -> expect 0
- **Expected output / state:** All five forbidden tools return 0 matches in the tools value.
- **Pass criteria:** Defense-in-depth posture preserved; agent cannot execute shell, edit in-place, or call network.

### TC-17.3: Agent uses Write whole-file (not Edit) for `features:` mutation
- **Category:** Tool Allowlist
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-2 (FR-5.2)
- **Mapped AC:** AC-12
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect agent prompt body for mutation logic instructions
- **Steps:**
  1. Search for instructions describing how to mutate `features:` in the prompt
  2. Verify "Write" is the prescribed tool, NOT "Edit"
- **Expected output / state:** Prompt body documents the FR-5.1 atomic Write contract; instructs use of Write (whole-file replacement). No instruction to use Edit.
- **Pass criteria:** Prompt prescribes Write; no Edit usage.

### TC-17.4: Agency Roles `role-planner` row Responsibility updated verbatim (FR-9.8)
- **Category:** Tool Allowlist / Cross-File
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.8 invariant)
- **Mapped AC:** AC-20
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect Agency Roles table in `src/claude.md`
- **Steps:**
  1. Locate the `role-planner` row
  2. Compare to: "Recommend project-specific specialized roles at bootstrap Step 3.75 with cross-feature reuse; participate in post-merge teardown of unused on-demand roles."
- **Expected output / state:** Verbatim string match. Role title "Role Planner" unchanged. Agent column `role-planner` unchanged.
- **Pass criteria:** FR-9.8 verbatim Responsibility column update.

### TC-17.5: NO new row added to Agency Roles; NO row removed
- **Category:** Tool Allowlist / Cross-File
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.8)
- **Mapped AC:** AC-20
- **Preconditions:** TC-17.4 setup
- **Inputs:** Count of rows in Agency Roles table
- **Steps:**
  1. Count rows before iter-2 implementation
  2. Count rows after
- **Expected output / state:** Same row count. The change is in-place column update only.
- **Pass criteria:** Row count invariant; no add/remove.

### TC-17.6: Cross-references valid (no phantom paths)
- **Category:** Cross-File Consistency
- **Type:** Unit
- **Priority:** P1
- **Mapped UC:** N/A (AC-21)
- **Mapped AC:** AC-21
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Verify the following:
  - `src/agents/role-planner.md` exists
  - `src/commands/bootstrap-feature.md` references `role-planner` by exact name
  - `src/commands/merge-ready.md` Step 11 references `~/.claude/agents/ondemand-*.md` literal pattern
  - No phantom paths
- **Steps:**
  1. `test -f src/agents/role-planner.md`
  2. `grep -nE "role-planner" src/commands/bootstrap-feature.md`
  3. `grep -nE 'ondemand-\*\.md' src/commands/merge-ready.md`
- **Expected output / state:** All assertions pass. No broken cross-references.
- **Pass criteria:** All registered names resolve; no phantom paths.

---

## Family Q: Cross-Cutting Count Invariants (FR-9.1, FR-9.2, FR-9.4, FR-9.5, FR-9.9)

### TC-18.1: README.md "17 specialized AI agents" byte-unchanged
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.9)
- **Mapped AC:** AC-16
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Compare snapshot
- **Steps:**
  1. `grep -c "17 specialized AI agents" README.md`
- **Expected output / state:** Returns the same count as before iter-2 (no change).
- **Pass criteria:** Banner string unchanged.

### TC-18.2: README.md "17 AI agents" byte-unchanged
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.9)
- **Mapped AC:** AC-16
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Compare snapshot
- **Steps:**
  1. `grep -c "17 AI agents" README.md`
- **Expected output / state:** Same count as pre-iter-2.
- **Pass criteria:** Tagline unchanged.

### TC-18.3: README.md "10 quality gates" byte-unchanged
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.9)
- **Mapped AC:** AC-17
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Compare snapshot
- **Steps:**
  1. `grep -c "10 quality gates" README.md`
- **Expected output / state:** Same count as pre-iter-2.
- **Pass criteria:** Quality gates count unchanged.

### TC-18.4: "10 gates" byte-unchanged across affected files
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.2)
- **Mapped AC:** AC-17
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Run grep across files
- **Steps:**
  1. `grep -nE "10 gates|10 quality gates" install.sh README.md src/claude.md src/commands/merge-ready.md`
  2. Compare results to pre-iter-2 snapshot
- **Expected output / state:** Identical results before and after iter-2.
- **Pass criteria:** Gate count invariant across all source files.

### TC-18.5: install.sh zero-drift (`git diff` empty)
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.4)
- **Mapped AC:** AC-18
- **Preconditions:** Iter-2 implementation is complete
- **Inputs:** Verify diff
- **Steps:**
  1. `git diff main..HEAD -- install.sh`
- **Expected output / state:** Returns empty (no diff hunks).
- **Pass criteria:** install.sh byte-unchanged.

### TC-18.6: Agent count drift detection
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.1)
- **Mapped AC:** AC-16
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Detect any `18`-related drift
- **Steps:**
  1. `grep -nE "18 specialized\|18 AI agents\|18 agents" install.sh README.md src/claude.md`
- **Expected output / state:** Returns 0 matches (no drift).
- **Pass criteria:** No inadvertent count increment.

### TC-18.7: templates/CLAUDE.md byte-unchanged
- **Category:** Count Invariants
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.5)
- **Mapped AC:** AC-19
- **Preconditions:** Iter-2 implementation complete
- **Inputs:** Verify diff
- **Steps:**
  1. `git diff main..HEAD -- templates/CLAUDE.md`
- **Expected output / state:** Empty diff.
- **Pass criteria:** Template byte-unchanged.

---

## Family R: Step 11 Is NOT a Gate (FR-3.1, FR-8.2)

### TC-19.1: Step 11 placed AFTER Gate 9
- **Category:** Step 11 Placement
- **Type:** Unit
- **Priority:** P0
- **Mapped UC:** UC-10, UC-CC-1 (FR-3.1)
- **Mapped AC:** AC-7
- **Preconditions:** Iter-2 is shipped
- **Inputs:** Inspect `src/commands/merge-ready.md`
- **Steps:**
  1. Locate Gate 9 (Release Packaging)
  2. Locate Step 11 (On-Demand Role Teardown)
  3. Verify Step 11 appears AFTER Gate 9 in line order
- **Expected output / state:** Step 11 is after Gate 9. Title is "Step 11: On-Demand Role Teardown".
- **Pass criteria:** Correct ordering and title.

### TC-19.2: /merge-ready output table has 10 gate rows + 1 step row
- **Category:** Step 11 Placement
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-10, UC-12, UC-13 (FR-8.2)
- **Mapped AC:** AC-7, AC-17
- **Preconditions:** A `/merge-ready` invocation produces the output table
- **Inputs:** Capture the output table from a real or simulated run
- **Steps:**
  1. Count rows
  2. Distinguish gate rows (PASS/FAIL/SKIPPED) from the step row (Post-Merge Teardown free-form text)
- **Expected output / state:** 10 gate rows + 1 step row = 11 rows total. The Post-Merge Teardown row is structurally distinguishable from the gate rows.
- **Pass criteria:** 10 gates + 1 step structure preserved.

### TC-19.3: Step 11 row uses free-form text, NOT PASS/FAIL/SKIPPED enum
- **Category:** Step 11 Placement
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** UC-10, UC-12, UC-13
- **Mapped AC:** AC-7
- **Preconditions:** Step 11 emits a row
- **Inputs:** Read the row's status column
- **Steps:**
  1. Inspect status value
- **Expected output / state:** Status column contains free-form text (e.g., "1 roles updated, 0 deleted, 0 unchanged" or refusal message). NOT one of "PASS", "FAIL", "SKIPPED".
- **Pass criteria:** Step 11 status format is distinct from gate format.

### TC-19.4: Step 11 runs regardless of Gate 9 outcome
- **Category:** Step 11 Placement
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-10 (FR-3.1)
- **Mapped AC:** AC-7
- **Preconditions:** Three scenarios: Gate 9 PASS, Gate 9 FAIL, Gate 9 SKIPPED
- **Inputs:** Three `/merge-ready` invocations
- **Steps:**
  1. Run with Gate 9 PASS; verify Step 11 ran
  2. Run with Gate 9 FAIL; verify Step 11 ran
  3. Run with Gate 9 SKIPPED; verify Step 11 ran
- **Expected output / state:** All three runs execute Step 11 sequentially after Gate 9 completes. Gate 9's outcome does NOT affect whether Step 11 runs.
- **Pass criteria:** Step 11 is unconditional after Gate 9.

### TC-19.5: Gate count remains 10 in summary line
- **Category:** Step 11 Placement
- **Type:** Integration
- **Priority:** P0
- **Mapped UC:** N/A (FR-9.2)
- **Mapped AC:** AC-17
- **Preconditions:** A `/merge-ready` invocation that emits a summary line
- **Inputs:** Capture summary line
- **Steps:**
  1. Locate the `/merge-ready` final summary
  2. Verify it states "10 gates" (or equivalent count)
- **Expected output / state:** Summary still references 10 gates. Step 11 is NOT counted.
- **Pass criteria:** Gate count invariant in summary.

### TC-19.6: Step 11 refusal does not affect overall merge-readiness
- **Category:** Step 11 Placement
- **Type:** Integration
- **Priority:** P1
- **Mapped UC:** UC-12, UC-13 (FR-3.1)
- **Mapped AC:** AC-9, AC-10, AC-17
- **Preconditions:** Gates 1-9 PASS; Step 11 refuses (UC-12 or UC-13)
- **Inputs:** `/merge-ready` invocation
- **Steps:**
  1. Run
  2. Inspect overall merge-ready outcome
- **Expected output / state:** Overall outcome is determined by Gates 1-9 alone. The refusal does NOT cause `/merge-ready` to fail.
- **Pass criteria:** Step 11 refusal is informational, not blocking.

---

## Family S: End-to-End Lifecycle (UC-CC-1, UC-CC-2)

### TC-20.1: Full lifecycle -- Stage-3 create -> work -> Step 11 deletes (last user)
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P0
- **Mapped UC:** UC-CC-1, UC-CC-1-A1, UC-CC-1-A3
- **Mapped AC:** AC-3, AC-8
- **Preconditions:** Empty pool; PRD recommends a unique role; current branch `feat/test-feature`; project `test-project`
- **Inputs:** Full `/develop-feature` (or simulated bootstrap + slices + merge-ready)
- **Steps:**
  1. Phase 1 bootstrap: file `ondemand-test-role.md` created with `features: ["test-project:test-feature"]`
  2. Phase 2 slices: file is read-only
  3. Merge to main
  4. Phase 3 `/merge-ready`: Step 11 finds the entry, removes it, array empty, file deleted
  5. Verify final pool state
- **Expected output / state:** Final pool: `ondemand-test-role.md` does not exist. Pool size returned to its pre-bootstrap value (0). `## Reuse Decisions` recorded `stage-3-no-match-created`. Step 11 summary: `0 roles updated, 1 deleted, 0 unchanged`.
- **Pass criteria:** Full lifecycle traversed; file deleted at end.

### TC-20.2: Full lifecycle -- Stage-1 reuse -> work -> Step 11 keeps file (other features remain)
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P0
- **Mapped UC:** UC-CC-1, UC-CC-1-A2
- **Mapped AC:** AC-3, AC-8
- **Preconditions:** Pool contains `ondemand-test-role.md` with `features: ["test-project:other-feature"]`; PRD recommends `test-role` (Stage-1 match)
- **Inputs:** Full `/develop-feature`
- **Steps:**
  1. Phase 1: file's `features:` becomes `["test-project:other-feature", "test-project:test-feature"]`
  2. Phase 3 Step 11: feature entry removed; file kept (other-feature still present)
  3. Verify final state
- **Expected output / state:** Final file's `features: ["test-project:other-feature"]` (size 1, back to pre-bootstrap state). Body byte-unchanged. Step 11 summary: `1 roles updated, 0 deleted, 0 unchanged`.
- **Pass criteria:** File preserved when other features still reference it.

### TC-20.3: Two parallel features -- last-write-wins per NFR-3
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-CC-2, UC-9-E1, UC-14-EC2
- **Mapped AC:** AC-12 (atomic per file)
- **Preconditions:** Two checkouts on different feature branches; `ondemand-shared-role.md` exists; both PRDs recommend `shared-role` (Stage-1 match)
- **Inputs:** Two near-simultaneous bootstrap invocations
- **Steps:**
  1. Capture initial state
  2. Bootstrap A starts at T0; bootstrap B at T0 + delta_small
  3. Both perform Stage-1 reuse-append concurrently
  4. Inspect final file state
- **Expected output / state:** Final file contains ONE of the two new entries (the last-written one), NOT both. The losing append is silently lost. Both invocations' `## Reuse Decisions` show `stage-1-exact-slug-match`. The audit-trail vs. on-disk discrepancy is observable.
- **Pass criteria:** NFR-3 last-write-wins behavior; documented (not silent corruption).

### TC-20.4: Recovery via re-running losing bootstrap
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-CC-2, UC-CC-2-A2
- **Mapped AC:** AC-3
- **Preconditions:** TC-20.3 ran; one feature's entry is missing from the file
- **Inputs:** Re-run the losing bootstrap
- **Steps:**
  1. Re-run the bootstrap that lost
  2. Inspect file post-re-run
- **Expected output / state:** Re-run reads current state; appends the missing entry; final file has both entries.
- **Pass criteria:** Recovery path works; NFR-2 idempotency-friendly.

### TC-20.5: Two parallel features at Stage 3 with different slugs -- no race
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-CC-2-A1
- **Mapped AC:** AC-3
- **Preconditions:** Two parallel bootstraps recommend uniquely-slugged roles
- **Inputs:** Two simultaneous invocations
- **Steps:**
  1. Run both
  2. Inspect file system
- **Expected output / state:** Two new files created at distinct paths. NO race. Both bootstraps succeed.
- **Pass criteria:** Stage-3 creates with different filenames are independent.

### TC-20.6: Two parallel teardowns race -- last-write-wins
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-CC-2-E1
- **Mapped AC:** AC-8
- **Preconditions:** Two features merged near-simultaneously; two `/merge-ready` Step 11 invocations
- **Inputs:** Two simultaneous Step 11 invocations
- **Steps:**
  1. Set up timing
  2. Run both
- **Expected output / state:** One teardown's mutation overwrites the other. One feature's entry may be left in the file when both should have been removed (or file may be incorrectly retained when both should have caused deletion). Audit trails surface the issue.
- **Pass criteria:** NFR-3 last-write-wins; documented behavior.

### TC-20.7: Asymmetric headless / interactive parallel
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-CC-2-EC1
- **Mapped AC:** AC-5
- **Preconditions:** One bootstrap interactive, the other headless; both target the same Stage-2 candidate file
- **Inputs:** Two bootstraps
- **Steps:**
  1. Run interactive bootstrap (user approves Stage-2 reuse)
  2. Concurrently run headless bootstrap (defaults to create-new)
- **Expected output / state:** Interactive bootstrap mutates the existing file. Headless bootstrap creates a new file with the originally-recommended slug. The two work on different paths (no race on the new file).
- **Pass criteria:** Headless and interactive paths produce different file targets; no cross-interference.

### TC-20.8: Two Stage-2 prompts answered concurrently in different terminals
- **Category:** End-to-End
- **Type:** E2E
- **Priority:** P2
- **Mapped UC:** UC-CC-2-EC2
- **Mapped AC:** AC-4
- **Preconditions:** Two parallel bootstraps; each emits its own Stage-2 prompt
- **Inputs:** Developer answers each in respective terminal
- **Steps:**
  1. Run both
  2. Each agent parses its own reply
- **Expected output / state:** Each bootstrap independently parses its reply. The race (if any) is on file mutation; reply parsing is per-bootstrap. Per FR-2.5, prompts are sequential within a bootstrap; parallel bootstraps each have their own sequence.
- **Pass criteria:** Reply isolation per bootstrap; no cross-bootstrap reply leakage.

---

## Summary of Coverage

- **Total test cases**: 145 (across 19 families A-S)
- **P0 (blocker)**: 50
- **P1 (major)**: 49
- **P2 (minor)**: 46
- **Architect [STRUCTURAL] decisions tested**: all 4
- **PRD ACs mapped**: all 22 (AC-1 through AC-22)
- **Use-case scenarios mapped**: all 106 (UC-1 through UC-15 + UC-CC-1, UC-CC-2 with all alternative/error/edge variants)

### Test Distribution by Family

| Family | Subject | Test Cases |
|--------|---------|------------|
| A | Reuse Detection | TC-1.1 -- TC-1.7 (7) |
| B | Stage 1 Exact Slug Match | TC-2.1 -- TC-2.5 (5) |
| C | Stage 2 + Token Grammar | TC-3.1 -- TC-3.11 (11) |
| D | Headless Context | TC-4.1 -- TC-4.8 (8) |
| E | Slug Collision | TC-5.1 -- TC-5.6 (6) |
| F | Filename Prefix | TC-7.1 -- TC-7.5 (5) |
| G | Legacy File Migration | TC-8.1 -- TC-8.6 (6) |
| H | Cross-Project Sharing | TC-9.1 -- TC-9.8 (8) |
| I | Teardown Entry Removal | TC-10.1 -- TC-10.7 (7) |
| J | Teardown File Deletion | TC-11.1 -- TC-11.8 (8) |
| K | Teardown Branch Validation | TC-12.1 -- TC-12.11 (11) |
| L | Teardown Path/Marker | TC-13.1 -- TC-13.9 (9) |
| M | Atomic Frontmatter Mutation | TC-14.1 -- TC-14.10 (10) |
| N | Idempotency | TC-15.1 -- TC-15.10 (10) |
| O | `## Reuse Decisions` Audit | TC-16.1 -- TC-16.8 (8) |
| P | Tool Allowlist | TC-17.1 -- TC-17.6 (6) |
| Q | Count Invariants | TC-18.1 -- TC-18.7 (7) |
| R | Step 11 Is NOT a Gate | TC-19.1 -- TC-19.6 (6) |
| S | End-to-End Lifecycle | TC-20.1 -- TC-20.8 (8) |

### Categorization Notes

- **Unit tests**: structural verification of frontmatter, prompt body, file paths, count strings (TC-1.2, TC-2.x, TC-5.x prompt-level, TC-7.1, TC-7.4, TC-7.5, TC-10.3, TC-14.1, TC-14.10, TC-16.3, TC-17.x, TC-18.x, TC-19.1)
- **Integration tests**: behavior verification via simulated agent/orchestrator runtime (majority of test cases)
- **E2E tests**: full pipeline traversal across bootstrap + slice + merge-ready (TC-20.x family)
- **All tests**: written objectively with verifiable pass criteria (no "works correctly" language); each test traces to at least one UC and at least one AC.
