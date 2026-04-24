# Test Cases: Product Changelog Maintenance -- Iteration 1 (Content Sync)

> Based on [PRD](../PRD.md) -- Section 3 and [Use Cases](../use-cases/product-changelog_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, cross-reference integrity, and (for installer and agent-runtime tests) observable filesystem/process behavior by running shell commands and inspecting outputs.

**Format TBD markers:** Several test cases were marked `[TBD -- update after planner pins X]`. Post-planner resolutions have been applied to TC-2.6 (field placement), TC-7.3/TC-7.4 (commit-to-PRD mapping), and TC-11.1 (output format). Remaining unresolved TBDs (TC-4.5, TC-6.5, TC-7.9, TC-11.3) are listed in the "Ambiguity Flags" summary at the end of this document.

---

## 1. Installation & Setup

### TC-1.1: `templates/rules/changelog.md` file exists at the documented path
- **Category:** Installation & Setup
- **Covers:** FR-1.1, AC-1
- **Type:** Unit
- **Preconditions:** Feature is shipped; SDLC repo checked out at HEAD
- **Test Steps:**
  1. Run `test -f /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md`
- **Expected:** Exit code 0 (file exists at `templates/rules/`, not `src/rules/`, per FR-1.2)
- **Edge Cases:** TC-1.2, TC-3.1

### TC-1.2: `templates/rules/changelog.md` contains the required policy sections
- **Category:** Installation & Setup
- **Covers:** FR-1.1, AC-1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. Grep the file for the phrases "product owners", "end users", "NOT developers"
  2. Grep for all six Keep a Changelog categories: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
  3. Grep for "[Unreleased]"
  4. Grep for the inclusion rule referencing PRD `Changelog:` field
  5. Grep for the exclusion rule referencing internal work (refactors, tests, type cleanup, logging, metrics, CI)
- **Expected:** All five greps return non-zero match counts (content present); the audience statement, six categories, `[Unreleased]` convention, inclusion rule, and exclusion rule are all documented
- **Edge Cases:** TC-1.3 (sentinel documentation)

### TC-1.3: `templates/rules/changelog.md` documents the presence-as-opt-in sentinel
- **Category:** Installation & Setup
- **Covers:** FR-1.4, AC-1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. Grep the file for language equivalent to "presence of this file" AND "sentinel" OR "opt-in" OR "self-check"
- **Expected:** The rule file explicitly states that its presence at `.claude/rules/changelog.md` is the sole signal the agent uses to decide whether to run, and that absence equals opt-out

### TC-1.4: `install.sh --init-project` copies the rule file into a downstream directory
- **Category:** Installation & Setup
- **Covers:** UC-1 (precondition), FR-1.3, AC-3
- **Type:** Installation
- **Preconditions:** Fresh empty temp directory; SDLC repo checked out locally
- **Test Steps:**
  1. `TMPDIR=$(mktemp -d)`
  2. `cd $TMPDIR`
  3. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --init-project --yes --local`
  4. `test -f $TMPDIR/.claude/rules/changelog.md`
- **Expected:** Exit code 0 on step 4 (file was installed into the downstream project)
- **Edge Cases:** TC-1.5

### TC-1.5: `install.sh` without `--init-project` does NOT install the rule file in the SDLC repo
- **Category:** Installation & Setup
- **Covers:** UC-5, FR-1.2, AC-2
- **Type:** Installation
- **Preconditions:** Fresh user-level config; SDLC repo at HEAD; any pre-existing `.claude/rules/changelog.md` in the SDLC repo root MUST be removed before this test
- **Test Steps:**
  1. `cd /Users/aleksandra/Documents/claude-code-sdlc`
  2. `rm -f ./.claude/rules/changelog.md` (safety precondition -- must not exist before running installer)
  3. `bash ./install.sh --yes --local` (default install path, no `--init-project`)
  4. `test ! -f ./.claude/rules/changelog.md`
- **Expected:** Exit code 0 on step 4 -- the rule file was NOT installed into the SDLC repo itself (verifies self-skip per AC-2). This is the concrete post-install negative assertion flagged by the architect (item 4).
- **Edge Cases:** TC-5.1 verifies the runtime self-skip behavior this install-time check enables

### TC-1.6: `install.sh --init-project` copies `src/agents/changelog-writer.md` to user-level agents directory
- **Category:** Installation & Setup
- **Covers:** FR-1.3 installer coverage, AC-4
- **Type:** Installation
- **Preconditions:** Fresh user-level config; `~/.claude/agents/` is empty or backed up
- **Test Steps:**
  1. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --yes --local`
  2. `test -f $HOME/.claude/agents/changelog-writer.md`
- **Expected:** The global agent file is copied by the default install path (user-level install copies all agents via the `for agent in "$SCRIPT_DIR"/src/agents/*.md` loop in `install.sh`)
- **Edge Cases:** TC-1.7 (agent count incremented)

### TC-1.7: Installed agent count is 14 after install
- **Category:** Installation & Setup
- **Covers:** FR-5.2, NFR-5, AC-12, AC-13
- **Type:** Installation
- **Preconditions:** TC-1.6 passes
- **Test Steps:**
  1. Run `ls -1 $HOME/.claude/agents/*.md | wc -l | tr -d ' '`
- **Expected:** Output equals `14`. This asserts the agent count rose from 13 to 14 with the new `changelog-writer`.

### TC-1.8: `install.sh` banner / help strings updated from "13" to "14" (architect item 1)
- **Category:** Installation & Setup
- **Covers:** FR-5.2, AC-13 (and the architect's structural item 1 that the PRD omitted)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  2. `grep -c "13 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  3. `grep -c "14 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  4. `grep -c "13 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  5. `grep -nE "\(14 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh` (the `agents/` banner line inside `install_user_config`)
  6. `grep -nE "\(13 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
- **Expected:**
  - Step 1: returns at least `1` (the top-of-file comment banner line 8 area)
  - Step 2: returns `0` (no stale "13 specialized" references)
  - Step 3: returns at least `1` (the `--init-project` banner line 178 area)
  - Step 4: returns `0` (no stale "13 AI agents" references)
  - Step 5: returns at least `1` (the `agents/ (14 files ...)` banner line 182 area)
  - Step 6: returns `0` (no stale `(13 files` line)
- **Edge Cases:** TC-1.9 asserts the `print_help` content specifically

### TC-1.9: `install.sh` `print_help` function lists 14 agents
- **Category:** Installation & Setup
- **Covers:** FR-5.2 (architect item 1 deepened)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Run `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "14"`
  2. Run `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "13 specialized"`
- **Expected:** Step 1 returns at least 2 (one for the tagline "14 specialized AI agents" around the original line 49, one for the `WHAT GETS INSTALLED` block around original line 62); step 2 returns 0.

### TC-1.10: `README.md` "13 agents" references updated to "14 agents"
- **Category:** Installation & Setup
- **Covers:** FR-5.2, FR-5.3, AC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. `grep -c "13 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  3. `grep -c "14 AI agents\|14 agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  4. `grep -c "13 AI agents\|13 agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Expected:** Steps 1 and 3 return a positive integer; steps 2 and 4 return `0`.

### TC-1.11: `src/claude.md` Agency Roles table "13" references updated to "14"
- **Category:** Installation & Setup
- **Covers:** FR-5.1, FR-5.2, AC-12
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "13 agents\|13 specialized" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. `grep -c "14 agents\|14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
- **Expected:** Step 1 returns `0`; step 2 returns a positive integer.

---

## 2. PRD Authoring (`prd-writer` updates)

### TC-2.1: `src/agents/prd-writer.md` Output Format documents the `Changelog:` field
- **Category:** PRD Authoring
- **Covers:** FR-3.1, FR-3.3, AC-7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md` for "Changelog:" in the Output Format section
- **Expected:** The Output Format section instructs the agent to emit a `Changelog:` field in every new PRD section.

### TC-2.2: `prd-writer.md` documents both valid `Changelog:` value shapes with examples
- **Category:** PRD Authoring
- **Covers:** FR-3.2, FR-3.3, AC-7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read the Output Format section of `src/agents/prd-writer.md`
  2. Confirm presence of at least one example of shape (a) -- a non-empty user-facing description (e.g., `Changelog: Users can sign in with Google OAuth`)
  3. Confirm presence of at least one example of shape (b) -- the literal `Changelog: skip -- internal`
- **Expected:** Both value shapes are documented with at least one example each (per FR-3.3).

### TC-2.3: `prd-writer.md` Constraints section states that missing `Changelog:` is an authoring error
- **Category:** PRD Authoring
- **Covers:** FR-3.3
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read the Constraints section of `src/agents/prd-writer.md`
  2. Grep for language equivalent to "missing Changelog: field is an authoring error" or "critic will flag missing Changelog:"
- **Expected:** The Constraints section explicitly states the critic is responsible for catching missing `Changelog:` fields.

### TC-2.4: `prd-writer.md` prohibits internal jargon in `Changelog:` values
- **Category:** PRD Authoring
- **Covers:** FR-3.4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `src/agents/prd-writer.md` for at least one of: "no internal jargon", "avoid refactor", "avoid slice", "avoid wave", "avoid agent", "no implementation detail"
- **Expected:** The agent prompt explicitly warns against internal jargon, implementation details, file paths, function names, version numbers, and dates in the `Changelog:` field value.

### TC-2.5: `prd-writer.md` requires `skip -- internal` for purely internal work
- **Category:** PRD Authoring
- **Covers:** FR-3.5
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `src/agents/prd-writer.md` for language stating `skip -- internal` MUST be used for purely internal work (refactors, test infra, CI, typecheck cleanup, logging, metrics)
  2. Grep for language stating `skip -- internal` MUST NOT be used as a lazy default for user-facing features
- **Expected:** Both instructions are present.

### TC-2.6: `Changelog:` field placement in PRD header block -- canonical (own line below header) parses, inline placement rejected
- **Category:** PRD Authoring
- **Covers:** FR-3.1 (placement pinned -- separate line below header block)
- **Type:** Integration
- **Preconditions:** A test PRD file can be constructed with a four-key header plus `Changelog:`
- **Test Steps:**
  1. Construct PRD variant CANONICAL: `Status:`, `Date:`, `Priority:`, `Related:` as the header block, then a blank line, then `Changelog:` on its own line before the subsection body (pinned placement per `src/agents/changelog-writer.md` Step 4 and `src/agents/prd-writer.md` Output Format)
  2. Construct PRD variant REJECTED: `Status:`, `Date:`, `Priority:`, `Related:`, `Changelog:` all in one contiguous header block with no blank line separation (inline-with-block -- now invalid)
  3. Invoke `changelog-writer` against the CANONICAL variant in a configured downstream project
  4. Invoke `changelog-writer` against the REJECTED variant in the same configured downstream project
- **Expected:**
  - Step 3: the agent's `## Source counts` output correctly reports the parsed `Changelog:` value from the CANONICAL variant and maps commits to it
  - Step 4: the agent does NOT parse the inline-with-block `Changelog:` value (because Step 4 of the agent spec probes only the line below the header block, not arbitrary positions). The PRD section is treated as missing a `Changelog:` field per Step 4 case (c), triggering the "missing Changelog field -- treating as skip" warning in the `## Warnings` output
- **Edge Cases:** Pinned decision; no further ambiguity.

### TC-2.7: `prd-writer.md` enforces user-facing phrasing in `Changelog:` values
- **Category:** PRD Authoring
- **Covers:** FR-3.4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read the Output Format/Constraints section of `src/agents/prd-writer.md`
  2. Confirm: no version numbers (e.g., `v1.2.3`) appear in example `Changelog:` values
  3. Confirm: no dates appear in example `Changelog:` values
  4. Confirm: examples are phrased in end-user language (mentions actions a user can take, not implementation detail)
- **Expected:** All three constraints are documented and reflected in the examples.

---

## 3. Self-Check Sentinel

### TC-3.1: Agent returns `no-op: not configured` when rule file is absent (SDLC repo self-skip)
- **Category:** Self-Check Sentinel
- **Covers:** UC-5, FR-2.2, AC-2, AC-5
- **Type:** Integration
- **Preconditions:** CWD is the SDLC repo; `.claude/rules/changelog.md` does NOT exist in the SDLC repo (verified by TC-1.5)
- **Test Steps:**
  1. `cd /Users/aleksandra/Documents/claude-code-sdlc`
  2. `test ! -f ./.claude/rules/changelog.md` (precondition check)
  3. Invoke the `changelog-writer` agent with no arguments beyond CWD context
  4. Capture the agent's return output
  5. Run `test ! -f ./CHANGELOG.md`
- **Expected:**
  - Step 4: the agent's output contains the exact string `no-op: not configured` (per FR-2.2 literal-string requirement)
  - Step 5: no `CHANGELOG.md` was created
  - The agent exits successfully (does NOT fail the caller)
- **Edge Cases:** TC-3.2, TC-3.3, TC-5.1

### TC-3.2: Agent proceeds when rule file is present at CWD (downstream project opt-in)
- **Category:** Self-Check Sentinel
- **Covers:** UC-1 (precondition), FR-1.4, FR-2.2
- **Type:** Integration
- **Preconditions:** A configured downstream directory exists with `.claude/rules/changelog.md` present
- **Test Steps:**
  1. `TMPDIR=$(mktemp -d); cd $TMPDIR`
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --init-project --yes --local`
  3. Verify `test -f .claude/rules/changelog.md`
  4. Invoke `changelog-writer` (state may be "not-yet-initialized" but the self-check itself must pass)
- **Expected:** The agent does NOT return `no-op: not configured`. Instead it proceeds to the input-read phase (it may still return `no-op: already in sync` or `no-op: no eligible entries` for downstream reasons, but the self-check passes).
- **Edge Cases:** TC-3.3

### TC-3.3: Agent treats an empty rule file as valid opt-in (UC-5-EC1)
- **Category:** Self-Check Sentinel
- **Covers:** UC-5-EC1, FR-1.4, FR-2.2
- **Type:** Integration
- **Preconditions:** A configured downstream directory; the rule file has zero bytes
- **Test Steps:**
  1. Set up a configured downstream directory via installer
  2. `truncate -s 0 .claude/rules/changelog.md` (make it empty)
  3. Invoke `changelog-writer`
- **Expected:** The agent's self-check passes (presence is the only sentinel per FR-1.4); the agent does NOT return `no-op: not configured`. The agent proceeds to normal input-read flow.

### TC-3.4: Agent treats an unreadable rule file (permission error) as absent
- **Category:** Self-Check Sentinel
- **Covers:** UC-5 Error Flows
- **Type:** Integration
- **Preconditions:** A configured downstream directory with the rule file present but `chmod 000`
- **Test Steps:**
  1. Set up a configured downstream directory
  2. `chmod 000 .claude/rules/changelog.md`
  3. Invoke `changelog-writer`
  4. Restore permissions: `chmod 644 .claude/rules/changelog.md`
- **Expected:** The agent treats the unreadable file as absent (safest default for a presence-sentinel) and returns `no-op: not configured`. No file writes; no caller failure.

### TC-3.5: `src/agents/changelog-writer.md` first documented step is the self-check
- **Category:** Self-Check Sentinel
- **Covers:** FR-2.2, AC-4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md`
  2. Verify YAML frontmatter contains `name: changelog-writer`, `model: opus`, valid `description`, `tools`
  3. Verify the prompt body's first numbered step or first bold Step heading is the self-check (read `.claude/rules/changelog.md`)
- **Expected:** All three verifications pass. The self-check is explicitly documented as the very first runtime action per FR-2.2.

---

## 4. Initial Create (first-ever CHANGELOG.md)

### TC-4.1: First-ever run creates `CHANGELOG.md` with Keep a Changelog header and `[Unreleased]` entries
- **Category:** Initial Create
- **Covers:** UC-1, FR-2.8, AC-15
- **Type:** E2E
- **Preconditions:** Configured downstream project; `CHANGELOG.md` does NOT exist; PRD has at least one section with a non-skip `Changelog:` value; at least one commit on the branch maps to that PRD section
- **Test Steps:**
  1. Set up configured downstream via `install.sh --init-project`
  2. Populate `docs/PRD.md` with a section marked `Changelog: Users can sign in with Google OAuth` and `Status: [IN DEVELOPMENT]`
  3. Create a feature branch and make a commit whose subject references the PRD section (mapping mechanism per architect item 3)
  4. Initialize `.claude/scratchpad.md` with feature / branch / plan
  5. Verify `test ! -f CHANGELOG.md`
  6. Invoke `changelog-writer`
  7. Read `CHANGELOG.md`
- **Expected:**
  - Exit is success; agent summary records `action taken: created`
  - `CHANGELOG.md` file exists
  - File begins with `# Changelog` heading
  - File contains a paragraph linking to `keepachangelog.com`
  - File contains a semver note
  - File contains `## [Unreleased]` heading
  - Under `[Unreleased]` there is at least one `### Added` / `### Changed` / one of the six categories with an entry derived from the PRD `Changelog:` value
- **Edge Cases:** TC-4.2, TC-4.3, TC-4.4, TC-4.5

### TC-4.2: First-ever run with NO eligible commits does NOT create `CHANGELOG.md` (no empty file)
- **Category:** Initial Create
- **Covers:** UC-1-EC1, FR-2.8
- **Type:** E2E
- **Preconditions:** Configured downstream; `CHANGELOG.md` does NOT exist; all PRD sections are `Changelog: skip -- internal`; commits exist only for those internal sections
- **Test Steps:**
  1. Set up configured downstream
  2. Populate PRD with all sections marked `Changelog: skip -- internal`
  3. Make one or more commits mapping to those internal sections
  4. Invoke `changelog-writer`
  5. Run `test ! -f CHANGELOG.md`
- **Expected:** Exit code 0 on step 5 -- `CHANGELOG.md` was NOT created (per FR-2.8). Agent summary records `action taken: no-op (no eligible entries)` or equivalent.

### TC-4.3: First-ever run populates all six Keep a Changelog categories when entries span them
- **Category:** Initial Create
- **Covers:** UC-1 step 7, FR-2.5
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD contains 6 sections each of a distinct nature (new feature, modification, deprecation, removal, bug fix, security fix), each with a non-skip `Changelog:` value; one commit per section exists on the branch
- **Test Steps:**
  1. Set up downstream with PRD containing sections tagged as: new feature, modification, deprecation, removal, bug fix, security fix
  2. Commit each in turn
  3. Invoke `changelog-writer`
- **Expected:** `CHANGELOG.md` is created with `## [Unreleased]` containing all six category subheadings (`### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`, `### Security`) each with at least one entry. Agent summary lists computed entries per category.

### TC-4.4: Category defaults to `Added` for new features and `Changed` for modifications (ambiguous case)
- **Category:** Initial Create
- **Covers:** FR-2.5 (default behavior)
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD has a section whose nature is ambiguous (could be "new" or "modified") but is a new feature
- **Test Steps:**
  1. Set up downstream with PRD section where the PRD text describes new behavior but also mentions existing features being extended
  2. Commit the work
  3. Invoke `changelog-writer`
- **Expected:** Entry appears under `### Added`. Agent summary's "ambiguous category choices with justification" list includes this entry with the choice recorded.

### TC-4.5: Created `CHANGELOG.md` uses a persistent `[Unreleased]` convention (design decision 7)
- **Category:** Initial Create
- **Covers:** FR-2.8 (header style), design decision 7
- **Type:** Unit
- **Preconditions:** TC-4.1 passes (CHANGELOG.md was created)
- **Test Steps:**
  1. Grep `CHANGELOG.md` for the heading pattern `## [Unreleased]` (exact syntax may be `## [Unreleased]` or `## [Unreleased] - ...`)
  2. Verify the heading appears exactly once
  3. Verify it is the first `##` heading after the file header paragraphs
- **Expected:** All three checks pass. `[TBD -- update after planner pins [Unreleased] heading canonical form]` -- the Tech Lead should decide whether the default heading is `## [Unreleased]` or `## [Unreleased] - TBD` or similar. This test updates once pinned.

---

## 5. Continuous Sync (four lifecycle hooks)

### TC-5.1: Hook 1 -- `/bootstrap-feature` post-Step-5 invokes `changelog-writer`
- **Category:** Continuous Sync
- **Covers:** UC-2 Hook 1, FR-4.1, AC-8
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  2. Grep for a Step numbered 5 that performs Tech Lead Implementation Planning
  3. Grep for an explicit post-Step-5 delegation to `changelog-writer`
- **Expected:** The file contains a documented delegation to `changelog-writer` immediately after Step 5 completes (per FR-4.1).

### TC-5.2: Hook 1 runtime -- post-bootstrap invocation returns `no-op: already in sync` when no prior commits
- **Category:** Continuous Sync
- **Covers:** UC-2 Primary Flow step 4, FR-2.6, FR-4.1
- **Type:** E2E
- **Preconditions:** Configured downstream; feature branch just created; no commits yet on branch
- **Test Steps:**
  1. Run `/bootstrap-feature` in a configured downstream
  2. Capture the `changelog-writer` invocation output after Step 5
- **Expected:** The agent returns either `no-op: already in sync` (if CHANGELOG.md already exists) or `no-op: no eligible entries` (if it does not exist and no prior commits qualify). `CHANGELOG.md` state is unchanged.

### TC-5.3: Hook 2 -- `/implement-slice` Step 5 post-commit invokes `changelog-writer` in standalone mode
- **Category:** Continuous Sync
- **Covers:** UC-11, FR-4.2 standalone branch, AC-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md`
  2. Grep for Step 5 (Commit)
  3. Grep for a post-commit delegation to `changelog-writer`
  4. Grep for an explicit standalone-mode check guarding the delegation (e.g., "if no wave context")
  5. Grep for an explicit skip instruction when wave context IS present
- **Expected:** All four greps return matches. The file clearly documents that the delegation runs only in standalone mode, and that parallel-subagent mode skips the delegation (per FR-4.2 / AC-9).

### TC-5.4: Hook 2 runtime -- standalone `/implement-slice` post-commit rewrites `[Unreleased]`
- **Category:** Continuous Sync
- **Covers:** UC-11 Primary Flow, FR-4.2 standalone, FR-2.6
- **Type:** E2E
- **Preconditions:** Configured downstream; existing `CHANGELOG.md` with `[Unreleased]`; a pending slice whose commit will land
- **Test Steps:**
  1. Run `/implement-slice` for a single-slice wave (no wave context in the spawn prompt)
  2. After the commit succeeds, capture the `changelog-writer` output
  3. Read `CHANGELOG.md`
- **Expected:** `changelog-writer` was invoked post-commit. The agent returns either `action taken: rewrote` (if the new commit introduced an eligible entry) or `no-op: already in sync`. Prior versioned sections are byte-identical (verified by comparing before/after hashes of non-`[Unreleased]` sections).

### TC-5.5: Hook 3 -- `/develop-feature` orchestrator delegates to `changelog-writer` after each wave
- **Category:** Continuous Sync
- **Covers:** UC-3, FR-4.3, AC-10
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md`
  2. Grep for a post-wave delegation to `changelog-writer` in the orchestrator wave loop
  3. Confirm the delegation is at the orchestrator level (not inside the subagent spawn prompt)
  4. Confirm it fires once per wave after all subagents return
- **Expected:** All four checks pass. Orchestrator-only invocation is documented per FR-4.3.

### TC-5.6: Hook 4 -- `/merge-ready` pre-flight sync before Gate 0
- **Category:** Continuous Sync
- **Covers:** UC-2 Hook 4, FR-4.4, FR-4.5, AC-11
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
  2. Grep for a pre-flight delegation to `changelog-writer` BEFORE Gate 0
  3. Grep for explicit language "not a gate" or "non-blocking" or "safety net"
  4. Count the number of documented gates (should be unchanged vs. before feature); verify NO `Gate 10` exists
- **Expected:** All four checks pass. The pre-flight sync is documented, labeled non-blocking, and the gate count is unchanged (per AC-11 and PRD 3.8 item 7).

### TC-5.7: Hook 4 runtime -- `/merge-ready` surfaces diff summary when pre-flight sync rewrote the file
- **Category:** Continuous Sync
- **Covers:** UC-2 Hook 4 step 11, UC-4-A1, FR-4.4
- **Type:** E2E
- **Preconditions:** Configured downstream; developer edited PRD mid-branch causing drift
- **Test Steps:**
  1. Edit PRD `Changelog:` field on a section that has shipped commits (simulates UC-4-A1)
  2. Run `/merge-ready`
  3. Capture the pre-flight output
- **Expected:** `/merge-ready` output includes a diff summary from the pre-flight sync before proceeding to Gate 0. The gate verdict count is unchanged (no `Gate 10 -- Changelog` exists in the output).

### TC-5.8: All four hook points pass the agent NO arguments beyond the CWD context
- **Category:** Continuous Sync
- **Covers:** FR-4.6, UC-2-A1 step 3
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. For each of `bootstrap-feature.md`, `implement-slice.md`, `develop-feature.md`, `merge-ready.md`: locate the `changelog-writer` invocation line
  2. Confirm the invocation documentation does NOT pass feature-specific, slice-specific, or wave-specific arguments to the agent
- **Expected:** All four hook points invoke the agent identically -- "no arguments beyond CWD" (per FR-4.6). Inputs are discovered from disk, ensuring uniform behavior across hooks.

### TC-5.9: Hook failure does NOT block the pipeline (non-blocking guarantee)
- **Category:** Continuous Sync
- **Covers:** UC-11-E1, UC-3-E1, UC-6-E1, FR-4.5
- **Type:** Integration
- **Preconditions:** Configured downstream; agent is mocked to crash (simulate failure)
- **Test Steps:**
  1. Mock `changelog-writer` to raise an error at invocation time
  2. Run `/implement-slice` for a single-slice wave
  3. Confirm the slice commit landed
  4. Confirm `/implement-slice` logged the error and continued
  5. Run a subsequent pipeline command (e.g., another `/implement-slice`)
- **Expected:** Step 3: slice commit exists. Step 4: error is logged but the command exits successfully. Step 5: the subsequent command proceeds normally; the "failed" sync is caught up on the next hook invocation (eventual-consistency per UC-3-E1 and NFR-6).

### TC-5.10: Hook 2 standalone re-read is fresh from disk on every invocation (UC-2-A1 mid-feature PRD edit)
- **Category:** Continuous Sync
- **Covers:** UC-2-A1, FR-2.3, FR-4.6
- **Type:** E2E
- **Preconditions:** Configured downstream with at least one shipped commit and current CHANGELOG.md in sync
- **Test Steps:**
  1. Capture CHANGELOG.md state (snapshot A)
  2. Edit `docs/PRD.md` -- change the `Changelog:` value on a section whose commits have shipped
  3. Without making a new commit, invoke `changelog-writer` (e.g., via `/merge-ready` pre-flight)
  4. Capture CHANGELOG.md state (snapshot B)
- **Expected:** Snapshot B differs from snapshot A in the `[Unreleased]` section only. Prior versioned sections are byte-identical. Agent summary records `action taken: rewrote` with a diff summary.

### TC-5.11: Scope flip from `skip -- internal` to user-facing surfaces previously hidden commits (UC-2-A2)
- **Category:** Continuous Sync
- **Covers:** UC-2-A2, FR-2.3, FR-2.4, FR-4.6
- **Type:** E2E
- **Preconditions:** Configured downstream; a PRD section is currently `Changelog: skip -- internal`; 2+ commits have shipped for that section; no entry for those commits in `[Unreleased]`
- **Test Steps:**
  1. Capture CHANGELOG.md state A
  2. Edit the PRD section's `Changelog:` to a user-facing description (e.g., `Changelog: Users can export reports to PDF`)
  3. Invoke `changelog-writer`
  4. Capture CHANGELOG.md state B
- **Expected:** State B `[Unreleased]` now contains an entry for the previously-excluded commits, placed in the appropriate category (per FR-2.4 re-read). Prior versioned sections unchanged.

### TC-5.12: Scope flip from user-facing to `skip -- internal` removes entries from `[Unreleased]` (UC-2-A3)
- **Category:** Continuous Sync
- **Covers:** UC-2-A3, FR-2.4, FR-2.7, FR-4.6
- **Type:** E2E
- **Preconditions:** Configured downstream; a PRD section is user-facing; commits have shipped and appear in `[Unreleased]`
- **Test Steps:**
  1. Capture CHANGELOG.md state A
  2. Edit the PRD section's `Changelog:` field to `skip -- internal`
  3. Invoke `changelog-writer`
  4. Capture CHANGELOG.md state B
- **Expected:** State B's `[Unreleased]` no longer contains the entries for that PRD section. Prior versioned sections byte-identical. Agent summary records diff with removal.

### TC-5.13: `CHANGELOG.md` with existing prior versioned sections -- only `[Unreleased]` is rewritten (UC-1-A1)
- **Category:** Continuous Sync
- **Covers:** UC-1-A1, FR-2.6, FR-2.7
- **Type:** E2E
- **Preconditions:** Configured downstream; `CHANGELOG.md` has `[Unreleased]` plus `[1.2.0]` and `[1.1.0]` sections from prior releases; new commits on the branch cause drift in `[Unreleased]`
- **Test Steps:**
  1. Compute byte hash of `[1.2.0]` section content (via a markdown section extractor or sed)
  2. Compute byte hash of `[1.1.0]` section content
  3. Invoke `changelog-writer` with drifted state
  4. Recompute byte hashes of `[1.2.0]` and `[1.1.0]` sections
- **Expected:** `[1.2.0]` and `[1.1.0]` byte hashes are IDENTICAL before and after. Only `[Unreleased]` changed. Agent summary records `action taken: rewrote`.

---

## 6. Parallel Wave Safety

### TC-6.1: Subagent-mode `/implement-slice` skips `changelog-writer` invocation (UC-3)
- **Category:** Parallel Wave Safety
- **Covers:** UC-3 Primary Flow step 2-4, FR-4.2 subagent-skip, AC-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md`
  2. Grep for "wave context" or equivalent marker signaling parallel mode
  3. Grep for the explicit "SKIP" instruction for the changelog delegation when wave context is present
- **Expected:** The file documents an explicit skip-the-changelog-delegation branch when wave context is provided in the spawn prompt (per FR-4.2 / AC-9). This is the structural prevention of the PRD 3.9 Risk 3 double-write race.

### TC-6.2: Orchestrator-only invocation per wave (UC-3)
- **Category:** Parallel Wave Safety
- **Covers:** UC-3 Primary Flow steps 5-6, FR-4.3, AC-10
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `src/commands/develop-feature.md`
  2. Grep for the post-wave delegation sequence: "wait for all subagents" -> "delegate to changelog-writer" -> "proceed to next wave"
- **Expected:** The documented flow is exactly: (a) spawn all subagents in wave N; (b) wait for all to complete; (c) delegate to `changelog-writer` ONCE; (d) proceed to wave N+1 (per FR-4.3).

### TC-6.3: No double-write race in a parallel wave (runtime verification)
- **Category:** Parallel Wave Safety
- **Covers:** UC-3 Primary Flow, PRD 3.9 Risk 3, FR-4.2, FR-4.3
- **Type:** E2E
- **Preconditions:** Configured downstream with a 3-slice parallel wave
- **Test Steps:**
  1. Run `/develop-feature` through a wave with 3 parallel slices
  2. Instrument `CHANGELOG.md` with filesystem-watch (`fsevents` / `inotify`) to log all write events
  3. Capture write events during wave execution + post-wave sync
- **Expected:** Exactly ZERO write events during the parallel-subagent phase. Exactly ONE write event during the orchestrator's post-wave invocation (or zero if the wave was all-internal and result is no-op). No two processes write the file concurrently.

### TC-6.4: Mixed-eligibility wave (UC-3-A1) -- only user-facing entries appear
- **Category:** Parallel Wave Safety
- **Covers:** UC-3-A1, FR-2.4, FR-4.3
- **Type:** E2E
- **Preconditions:** Configured downstream; wave has 3 slices where 1 maps to a non-skip PRD section and 2 map to `skip -- internal` PRD sections
- **Test Steps:**
  1. Execute the 3-slice wave via `/develop-feature`
  2. After post-wave orchestrator sync, read `CHANGELOG.md`
  3. Check agent summary's source count
- **Expected:** `[Unreleased]` contains exactly ONE new entry (for the user-facing slice). The two internal-slice commits are NOT represented. Agent summary reports something like "3 commits read, 1 eligible, 2 skipped as internal".

### TC-6.5: Single-slice wave via `/develop-feature` path (UC-3-A2)
- **Category:** Parallel Wave Safety
- **Covers:** UC-3-A2, NFR-6 idempotency, FR-4.2, FR-4.3
- **Type:** Integration
- **Preconditions:** Configured downstream; a wave with exactly one slice
- **Test Steps:**
  1. Read `src/commands/develop-feature.md` to see how single-slice waves are dispatched
  2. Run the single-slice wave
  3. Capture the number of `changelog-writer` invocations and the final `CHANGELOG.md` state
- **Expected:** The agent is invoked either once (orchestrator-only path OR standalone-via-implement-slice, never both) OR potentially twice (idempotent re-run where the second is `no-op: already in sync`). Either way, final `CHANGELOG.md` is identical and no corruption occurs.
- **Edge Cases:** `[TBD -- update after planner pins single-slice-wave dispatch]` -- the plan must state whether single-slice waves use the standalone `/implement-slice` path (which invokes the agent) OR the orchestrator-only path (orchestrator invokes the agent once after the subagent completes). Either is valid per UC-3-A2; the plan must pin ONE to avoid wasted no-op invocations.

### TC-6.6: Post-wave sync crash preserves subagent commits and reconciles on next hook (UC-3-E1)
- **Category:** Parallel Wave Safety
- **Covers:** UC-3-E1, FR-4.5, FR-4.6, NFR-6
- **Type:** E2E
- **Preconditions:** Configured downstream; mock agent to crash on first post-wave invocation, succeed on second
- **Test Steps:**
  1. Run a 3-slice wave that completes successfully (commits land)
  2. Orchestrator's post-wave `changelog-writer` crashes (mocked)
  3. Confirm all 3 wave commits are preserved in `git log`
  4. Confirm the orchestrator proceeds to the next wave (does NOT block)
  5. Next hook fires at the end of wave N+1; capture output
- **Expected:** Step 3: 3 commits present. Step 4: orchestrator continues. Step 5: the next hook's `changelog-writer` invocation catches up -- it sees all commits from wave N AND wave N+1, computes the correct `[Unreleased]`, and writes once. Eventual consistency per NFR-6.

### TC-6.7: All-wave-fail scenario still fires post-wave sync as a no-op (UC-3-EC1)
- **Category:** Parallel Wave Safety
- **Covers:** UC-3-EC1, FR-2.6, FR-4.3
- **Type:** Integration
- **Preconditions:** Configured downstream; all 3 subagents in a wave fail to produce commits
- **Test Steps:**
  1. Run wave; all subagents fail
  2. Orchestrator's post-wave `changelog-writer` still fires
- **Expected:** The agent sees no new commits, computes `[Unreleased]` = current state, returns `no-op: already in sync`. The failed wave's escalation options are unaffected by the changelog hook.

---

## 7. Commit Eligibility (source-of-truth priority)

### TC-7.1: Only commits with a corresponding non-skip PRD section are eligible (UC-4)
- **Category:** Commit Eligibility
- **Covers:** UC-4, FR-2.4, AC-16
- **Type:** E2E
- **Preconditions:** Configured downstream; PRD section marked `Changelog: skip -- internal`; 3 commits on the branch mapped to it; 1 commit on the branch mapped to a separate non-skip section
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Read `CHANGELOG.md`
- **Expected:** `[Unreleased]` contains exactly ONE entry (for the non-skip commit). The 3 internal commits are NOT represented anywhere in `CHANGELOG.md` (per AC-16). Agent summary reports "4 commits read, 1 eligible, 3 skipped as internal".

### TC-7.2: Source-of-truth priority -- commits override scratchpad intent (FR-2.4)
- **Category:** Commit Eligibility
- **Covers:** UC-2-EC1, FR-2.4, NFR-6
- **Type:** Integration
- **Preconditions:** Scratchpad says slice 2 is DONE but `git log` has no commit for it (simulating a scratchpad/commit mismatch)
- **Test Steps:**
  1. Manually set scratchpad to show slice 2 DONE
  2. Ensure no commit exists for slice 2 work
  3. Invoke `changelog-writer`
- **Expected:** `[Unreleased]` does NOT include an entry for slice 2 (commits are the source of truth per FR-2.4; scratchpad informs context but not eligibility).

### TC-7.3: Commit-to-PRD-section mapping via conventional-commit scope (pinned mechanism)
- **Category:** Commit Eligibility
- **Covers:** FR-2.4 (pinned mapping mechanism per `src/agents/changelog-writer.md` Step 5)
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD section whose slugified title keyword set contains a commit scope as a whole token (e.g., PRD section "Changelog Maintenance" + commit `feat(changelog): add agent`)
- **Test Steps:**
  1. Make a commit with subject `feat(changelog): add new agent`
  2. Ensure PRD has a section whose title contains "Changelog" (so "changelog" appears as a whole token in the slugified keyword set)
  3. Invoke `changelog-writer`
- **Expected:** The agent maps the commit to the "Changelog" PRD section via conventional-commit scope match (per Step 5 of the agent spec) and includes that PRD section's user-facing `Changelog:` value verbatim in `[Unreleased]`. Pinned mechanism -- no alternative path.

### TC-7.4: Commit trailer mechanism is NOT supported (negative assertion; rejected alternative)
- **Category:** Commit Eligibility
- **Covers:** FR-2.4 (negative -- rejected alternative mapping mechanism)
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD section identified by a section number (e.g., section 3); commit uses a trailer with NO scope that would match via conventional-commit scope
- **Test Steps:**
  1. Make a commit with subject `feat: implement new work` (NO scope) and body containing `PRD-Section: 3` trailer
  2. Ensure PRD section 3 has a non-skip `Changelog:` value AND a title whose slugified keyword set does NOT include any word that could match the (empty) scope
  3. Invoke `changelog-writer`
- **Expected:** The agent does NOT parse or honor the `PRD-Section: 3` trailer (trailer mechanism rejected in favor of conventional-commit scope per agent spec Step 5). Because the commit has no scope, it is reported in the `## Source counts` output as "unmapped" and is NOT added to `[Unreleased]`. The trailer is ignored entirely.

### TC-7.5: PRD section flagged `skip -- internal` excludes ALL of its commits even after shipping (AC-16)
- **Category:** Commit Eligibility
- **Covers:** UC-4 primary flow, AC-16
- **Type:** E2E
- **Preconditions:** Configured downstream; a PRD section whose `Changelog:` value is EXACTLY the literal `skip -- internal`; 5 commits have landed for that section
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Inspect `CHANGELOG.md`
  3. Grep for any content that appears in the internal PRD section's body
- **Expected:** Zero matches from step 3 -- no content from the internal PRD section leaks into `CHANGELOG.md` (per AC-16).

### TC-7.6: Entire-branch-internal -- `CHANGELOG.md` remains uncreated (UC-4-EC1)
- **Category:** Commit Eligibility
- **Covers:** UC-4-EC1, FR-2.8
- **Type:** E2E
- **Preconditions:** Configured downstream with no pre-existing `CHANGELOG.md`; branch contains ONLY `skip -- internal` PRD sections; multiple commits shipped
- **Test Steps:**
  1. Run a full feature lifecycle (bootstrap, slices, merge-ready) on an all-internal branch
  2. `test ! -f CHANGELOG.md`
- **Expected:** Exit code 0 on step 2 -- `CHANGELOG.md` was never created.

### TC-7.7: Existing `CHANGELOG.md` with all-internal branch has empty `[Unreleased]` (UC-9)
- **Category:** Commit Eligibility
- **Covers:** UC-9, FR-2.7, FR-2.8
- **Type:** E2E
- **Preconditions:** Configured downstream; `CHANGELOG.md` exists with prior versions `[1.2.0]`, `[1.1.0]`; current branch is all-internal
- **Test Steps:**
  1. Capture byte hashes of `[1.2.0]` and `[1.1.0]` sections
  2. Invoke `changelog-writer`
  3. Read `[Unreleased]` section content
  4. Recompute byte hashes of `[1.2.0]` and `[1.1.0]`
- **Expected:** `[Unreleased]` is present but empty (idiomatic Keep a Changelog empty state per UC-9). Prior versions' byte hashes unchanged. Agent summary records one of `no-op: already in sync`, `action taken: rewrote (emptied stale entries)`, or `action taken: inserted empty [Unreleased]`.

### TC-7.8: UC-6-EC1 empty `Changelog:` value treated as `skip -- internal` with warning
- **Category:** Commit Eligibility
- **Covers:** UC-6-EC1, NFR-2, FR-3.2
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD section has `Changelog: ` (empty value); commits have shipped for that section
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Read agent summary
  3. Check if entries appear for this section in `[Unreleased]`
- **Expected:** Agent summary distinguishes "field empty" from "field missing" and emits a warning for the former. `[Unreleased]` does NOT contain entries for this section (treated as skip per NFR-2 backward compatibility).

### TC-7.9: UC-6-EC2 non-literal `Changelog:` value (e.g., `TODO`) treated conservatively as user-facing
- **Category:** Commit Eligibility
- **Covers:** UC-6-EC2, FR-3.2
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD section has `Changelog: TODO`; commits have shipped
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Read `CHANGELOG.md`
  3. Read agent summary
- **Expected:** Per UC-6-EC2 conservative behavior: the agent treats the value as shape (a) -- a user-facing description -- and includes `TODO` as an entry in `[Unreleased]`. The agent summary flags the value as suspicious (looks like a placeholder). This surfaces authoring errors where a product owner will notice them. `[TBD -- confirm with prd-writer whether this matches intended design]` -- this is an iteration-1 BA discovery documented in the use-case coverage summary; qa-planner asks prd-writer to confirm.

---

## 8. Edge Cases

### TC-8.1: Agent is idempotent on double invocation (UC-7, AC-6)
- **Category:** Edge Cases
- **Covers:** UC-7, FR-2.6, NFR-6, AC-6
- **Type:** E2E
- **Preconditions:** Configured downstream; `CHANGELOG.md` exists and is in sync; no intervening changes
- **Test Steps:**
  1. Invoke `changelog-writer` -- capture output O1 and file byte hash H1
  2. Invoke `changelog-writer` again -- capture output O2 and file byte hash H2
- **Expected:** O1 is `no-op: already in sync` OR `action taken: rewrote` (depending on prior state). O2 is `no-op: already in sync`. H1 == H2 (byte-identical). File mtime unchanged between invocations (no second write occurred).

### TC-8.2: Whitespace-only difference is not a rewrite trigger (UC-7-A1)
- **Category:** Edge Cases
- **Covers:** UC-7-A1, FR-2.6, PRD 3.9 Risk 2
- **Type:** Integration
- **Preconditions:** Configured downstream; `CHANGELOG.md` exists in sync; manually add trailing whitespace to several lines
- **Test Steps:**
  1. Snapshot file state A (with trailing whitespace edits)
  2. Invoke `changelog-writer`
  3. Snapshot file state B
- **Expected:** State B == State A (byte-identical). Agent returns `no-op: already in sync`. The trailing whitespace is preserved -- the agent does not "fix" it (would violate idempotency).

### TC-8.3: Manual `[Unreleased]` rename to `[X.Y.Z]` causes agent to insert fresh empty `[Unreleased]` (UC-8)
- **Category:** Edge Cases
- **Covers:** UC-8, FR-2.7, FR-2.8, PRD 3.8 item 2 (deferred)
- **Type:** E2E
- **Preconditions:** Configured downstream; `CHANGELOG.md` has `[Unreleased]` with entries; developer manually renames it to `[1.3.0] - 2026-05-01`
- **Test Steps:**
  1. Capture byte hash of renamed `[1.3.0]` content (the former `[Unreleased]` content)
  2. Invoke `changelog-writer`
  3. Read `CHANGELOG.md`
  4. Recompute byte hash of `[1.3.0]` section
- **Expected:**
  - `[Unreleased]` is present above `[1.3.0]`, empty (no new commits since rename)
  - `[1.3.0]` byte hash unchanged (prior versioned section untouched per FR-2.7)
  - Agent summary records `action taken: inserted empty [Unreleased]`
  - The agent did NOT perform any version rename (iteration-2 concern per PRD 3.8 item 2)

### TC-8.4: Manual rename with pre-created empty `[Unreleased]` is a no-op (UC-8-A1)
- **Category:** Edge Cases
- **Covers:** UC-8-A1, FR-2.6, FR-2.7
- **Type:** Integration
- **Preconditions:** Configured downstream; developer renamed `[Unreleased]` to `[1.3.0]` AND created an empty `[Unreleased]` above it
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Confirm file unchanged
- **Expected:** Agent returns `no-op: already in sync`. File byte-identical.

### TC-8.5: UC-8-EC1 commit double-listing when branch continues after manual release rename
- **Category:** Edge Cases
- **Covers:** UC-8-EC1, PRD 3.8 items 2-6 (deferred iteration-2 concerns)
- **Type:** Integration
- **Preconditions:** Configured downstream; developer renamed `[Unreleased]` -> `[1.3.0]` and then made a new commit on the same branch
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Check `[Unreleased]` and `[1.3.0]` for the commit's representation
  3. Read agent summary
- **Expected:** Known iteration-1 limitation per UC-8-EC1: the new commit may appear in BOTH `[1.3.0]` (manually set by developer) AND `[Unreleased]` (computed by agent from `<merge-base>..HEAD`). Agent summary flags the potential duplication. Mitigation (per UC-8-EC1) is the standard Git Flow "fresh branch after release" pattern; full deduplication is deferred to iteration 2.

### TC-8.6: Malformed `CHANGELOG.md` (missing `[Unreleased]`) -- agent inserts it without touching prior sections (UC-2-E2)
- **Category:** Edge Cases
- **Covers:** UC-2-E2, FR-2.7, FR-4.5
- **Type:** Integration
- **Preconditions:** Configured downstream; `CHANGELOG.md` exists but has `[1.2.0]` directly under the header (no `[Unreleased]`)
- **Test Steps:**
  1. Capture byte hashes of `[1.2.0]` and `[1.1.0]` sections
  2. Invoke `changelog-writer`
  3. Verify `[Unreleased]` is now present directly under the header, ABOVE `[1.2.0]`
  4. Recompute byte hashes of `[1.2.0]` and `[1.1.0]`
- **Expected:** `[Unreleased]` inserted. `[1.2.0]` and `[1.1.0]` byte hashes unchanged (prior sections byte-for-byte untouched per FR-2.7). Agent summary annotates the malformed-markup observation.

### TC-8.7: `git merge-base main HEAD` failure triggers degraded mode with annotation (UC-2-E1)
- **Category:** Edge Cases
- **Covers:** UC-2-E1, PRD 3.9 Risk 8, FR-2.3, FR-4.5
- **Type:** Integration
- **Preconditions:** Configured downstream; branch has no shared ancestor with `main` (e.g., orphan branch) OR `main` does not exist
- **Test Steps:**
  1. Set up an orphan branch: `git checkout --orphan test-orphan; git rm -rf .; git commit -m "init" --allow-empty`
  2. Invoke `changelog-writer`
  3. Read agent summary
- **Expected:** Agent does NOT fail. Agent output contains annotation like `degraded mode: merge-base unresolved; using full branch log`. Agent still computes `[Unreleased]` from the full branch log. Pipeline not blocked (per FR-4.5).

### TC-8.8: Large git log triggers chunked read (UC-10)
- **Category:** Edge Cases
- **Covers:** UC-10, UC-10-E1, tool-limitations rule
- **Type:** Integration
- **Preconditions:** Configured downstream; branch has 200+ commits with verbose commit messages pushing `git log` output past ~50,000 characters
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Read agent summary for commit-count field
  3. Independently compute `git rev-list --count <merge-base>..HEAD`
- **Expected:** Agent's reported commit count matches the independent count. Agent does NOT silently report incomplete findings (per tool-limitations rule). Agent may annotate that it used chunked reads or a compact-format (`--pretty=format:'%H|%s'`) log.

### TC-8.9: Very large log with compact format fallback (UC-10-EC1)
- **Category:** Edge Cases
- **Covers:** UC-10-EC1, NFR-8
- **Type:** Integration
- **Preconditions:** Configured downstream; branch has 1000+ commits
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Measure wall-clock time
  3. Read agent summary
- **Expected:** Agent completes within soft NFR-8 envelope (under 15s for rewrites). If full-message reads would exceed envelope, agent falls back to compact `--pretty=format:'%H %s'` form. Agent summary notes the format choice.

### TC-8.10: UC-6 runtime tolerance -- missing `Changelog:` field does NOT fail the caller
- **Category:** Edge Cases
- **Covers:** UC-6, NFR-2, FR-2.4, FR-4.5
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD section does NOT contain a `Changelog:` field at all; commits for that section exist
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Read agent output
  3. Check `[Unreleased]` for entries from the offending section
- **Expected:** Agent does NOT fail. Agent summary includes a warning like `warning: PRD section "X" is missing a Changelog: field -- treated as skip -- internal`. Commits for that section are excluded from `[Unreleased]` per NFR-2.

### TC-8.11: UC-7-EC1 rapid successive invocations -- at most one write total
- **Category:** Edge Cases
- **Covers:** UC-7-EC1, NFR-6, NFR-8
- **Type:** Integration
- **Preconditions:** Configured downstream; all four hook points fire in quick succession with no intervening edits
- **Test Steps:**
  1. Run `/bootstrap-feature` immediately followed by `/merge-ready` with no slices in between
  2. Count total write events on `CHANGELOG.md` via fsevents/inotify
- **Expected:** At most ONE write event across all four hook invocations. Cumulative agent latency is small (each no-op under NFR-8's 5s envelope).

### TC-8.12: UC-5-A1 SDLC repo with misinstalled rule file -- agent proceeds (misconfiguration, not bug)
- **Category:** Edge Cases
- **Covers:** UC-5-A1, FR-1.2, AC-2 (documenting misconfig)
- **Type:** Integration
- **Preconditions:** SDLC repo at HEAD; a developer manually copies `templates/rules/changelog.md` to `.claude/rules/changelog.md` (violating FR-1.2)
- **Test Steps:**
  1. Manually copy the rule file into the SDLC repo's `.claude/rules/`
  2. Invoke `changelog-writer`
  3. Clean up: remove the file
  4. Invoke `changelog-writer` again
- **Expected:** Step 2: agent proceeds (self-check sees the file); may create `CHANGELOG.md` in the SDLC repo (misconfiguration behavior). Step 4: agent returns `no-op: not configured` again (stateless recovery). AC-2 verifies a correctly-installed SDLC repo doesn't have this file; the agent is not responsible for detecting installer bugs.

### TC-8.13: Agent does NOT access the network (NFR-7)
- **Category:** Edge Cases
- **Covers:** UC-1 postcondition, UC-5 postcondition, NFR-7
- **Type:** Integration
- **Preconditions:** Configured downstream; test harness runs in offline/no-network sandbox OR with network monitoring
- **Test Steps:**
  1. Instrument the test environment to fail on any outgoing network connection
  2. Invoke `changelog-writer` in several scenarios (create, rewrite, no-op)
- **Expected:** No outgoing network connections made. All inputs are local files and local `git` invocations.

### TC-8.14: NFR-8 performance envelope -- no-op invocation under 5 seconds
- **Category:** Edge Cases
- **Covers:** NFR-8 (measurable)
- **Type:** Integration
- **Preconditions:** Configured downstream; `CHANGELOG.md` in sync (agent will return no-op)
- **Test Steps:**
  1. Time wall-clock duration of 5 consecutive `changelog-writer` invocations
  2. Confirm each individual invocation < 5 seconds
- **Expected:** All 5 invocations complete in under 5 seconds each (soft target). Median is significantly lower.

### TC-8.15: NFR-8 performance envelope -- rewrite invocation under 15 seconds
- **Category:** Edge Cases
- **Covers:** NFR-8 (measurable)
- **Type:** Integration
- **Preconditions:** Configured downstream; `CHANGELOG.md` drifted (rewrite expected); branch has a normal ~20-commit history
- **Test Steps:**
  1. Time wall-clock duration of a `changelog-writer` invocation that rewrites the file
- **Expected:** Invocation completes in under 15 seconds (soft target per NFR-8).

---

## 9. Cross-Reference Consistency

### TC-9.1: `changelog-writer` is registered in `src/claude.md` Agency Roles table (AC-12)
- **Category:** Cross-Reference Consistency
- **Covers:** FR-5.1, AC-12, AC-17
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` for a table row containing `changelog-writer`
  2. Verify the row has three populated fields: Role, Agent, Responsibility
  3. Confirm the Role is a product-facing title (e.g., "Release Scribe" or equivalent per FR-5.1)
  4. Confirm the Responsibility text references `CHANGELOG.md`, `[Unreleased]`, and "downstream project"
- **Expected:** All four checks pass.

### TC-9.2: All four command files reference `changelog-writer` by exact registered name (AC-17)
- **Category:** Cross-Reference Consistency
- **Covers:** FR-4.1 through FR-4.4, AC-17
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep each of `bootstrap-feature.md`, `implement-slice.md`, `develop-feature.md`, `merge-ready.md` for the exact string `changelog-writer`
- **Expected:** All four files contain at least one reference to the exact name `changelog-writer` (not `changelog_writer`, `ChangelogWriter`, or similar variants). No phantom paths.

### TC-9.3: `src/agents/changelog-writer.md` has valid frontmatter (AC-4)
- **Category:** Cross-Reference Consistency
- **Covers:** FR-2.1, AC-4, NFR-4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read the first ~20 lines of `src/agents/changelog-writer.md`
  2. Parse YAML frontmatter
  3. Confirm: `name: changelog-writer` (exact match)
  4. Confirm: `description:` is a non-empty string
  5. Confirm: `tools:` is a list containing file-read and bash capabilities (for PRD/scratchpad/git-log reads)
  6. Confirm: `model: opus`
- **Expected:** All five checks pass (per FR-2.1 and NFR-4).

### TC-9.4: `templates/CLAUDE.md` contains optional `Version source:` placeholder (AC-14)
- **Category:** Cross-Reference Consistency
- **Covers:** FR-5.5, AC-14
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `/Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md` for "Version source:"
  2. Grep for documentation stating the field is "reserved for iteration 2" or "informational only" or "no runtime effect"
- **Expected:** Both greps find matches. The field is present with a documentation comment indicating it is dead metadata in iteration 1.

### TC-9.5: `README.md` documents downstream CHANGELOG maintenance feature (FR-5.4)
- **Category:** Cross-Reference Consistency
- **Covers:** FR-5.4, AC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `README.md` for "CHANGELOG" or "changelog"
  2. Verify the section or feature list explains that downstream projects get automated `CHANGELOG.md` maintenance via `install.sh --init-project`
  3. Verify the explanation mentions the SDLC repo opts out automatically
- **Expected:** All three checks pass.

### TC-9.6: `README.md` agent list includes `changelog-writer` (AC-13)
- **Category:** Cross-Reference Consistency
- **Covers:** FR-5.3, AC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `README.md` for a table or list entry containing `changelog-writer`
- **Expected:** Match found. `changelog-writer` is documented alongside the other 13 agents for a total of 14.

### TC-9.7: No phantom paths -- all file references in modified files resolve (AC-17)
- **Category:** Cross-Reference Consistency
- **Covers:** AC-17
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. For each path mentioned in `bootstrap-feature.md`, `implement-slice.md`, `develop-feature.md`, `merge-ready.md`, `claude.md`, `changelog-writer.md`, `prd-writer.md`, `templates/rules/changelog.md`: extract the path
  2. For each extracted path, run `test -f <path>` or `test -d <path>`
- **Expected:** All paths resolve. No phantom references.

### TC-9.8: Agent's self-reported name matches file name (AC-17 strict)
- **Category:** Cross-Reference Consistency
- **Covers:** AC-17
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read frontmatter `name:` from `src/agents/changelog-writer.md`
  2. Verify it equals `changelog-writer` (matches filename stem)
  3. Grep `src/claude.md` for the same string in the Agency Roles table
- **Expected:** All three values match exactly.

---

## 10. Iteration 1 Boundary (negative assertions vs. iteration 2)

### TC-10.1: No automatic semver bump in iteration 1 (PRD 3.8 item 1)
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 3.8 item 1
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `src/agents/changelog-writer.md` for any logic computing semver versions
  2. Grep `src/commands/merge-ready.md` for version-bump logic
- **Expected:** Zero matches. No semver computation in iteration 1.

### TC-10.2: No `[Unreleased]` to `[X.Y.Z]` rename in iteration 1 (PRD 3.8 item 2)
- **Category:** Iteration 1 Boundary
- **Covers:** UC-8 (documenting deferral), PRD 3.8 item 2
- **Type:** E2E
- **Preconditions:** Configured downstream; branch has user-facing commits ready to release
- **Test Steps:**
  1. Invoke `changelog-writer` through any hook
  2. Verify `[Unreleased]` heading remains `[Unreleased]` (not renamed)
- **Expected:** Heading is exactly `## [Unreleased]` (or equivalent). No automatic rename. The agent does NOT convert `[Unreleased]` to `[X.Y.Z]`.

### TC-10.3: No release notes file created (PRD 3.8 item 3)
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 3.8 item 3
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `src/agents/changelog-writer.md` for logic creating `.claude/release-notes-*.md`
  2. Inspect modified command files for similar
  3. Run a full pipeline in a downstream; verify no `.claude/release-notes-*.md` is created
- **Expected:** No release-notes-file logic anywhere. No such file created at runtime.

### TC-10.4: No release commit auto-created (PRD 3.8 item 4)
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 3.8 item 4, FR-2.10
- **Type:** Integration
- **Preconditions:** Configured downstream
- **Test Steps:**
  1. Invoke `changelog-writer` in a scenario where it rewrites `CHANGELOG.md`
  2. Run `git log HEAD..HEAD` (should be empty -- no new commits)
  3. Run `git status` -- the CHANGELOG.md change should be unstaged/untracked (depending on workflow)
- **Expected:** The agent does NOT create a release commit. It writes to `CHANGELOG.md` but leaves git-commit responsibility to the surrounding slice commit (piggyback pattern per PRD 3.6 Unchanged Files note on `src/rules/git.md`).

### TC-10.5: No `git tag` invocation (PRD 3.8 item 5)
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 3.8 item 5
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `src/agents/changelog-writer.md` for `git tag`
  2. Grep modified command files for `git tag`
- **Expected:** Zero matches.

### TC-10.6: No `gh release create` invocation (PRD 3.8 item 6)
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 3.8 item 6
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep `src/agents/changelog-writer.md` for `gh release`
  2. Grep modified command files for `gh release`
- **Expected:** Zero matches.

### TC-10.7: No Gate 10 added to `/merge-ready` (PRD 3.8 item 7, AC-11)
- **Category:** Iteration 1 Boundary
- **Covers:** UC-2 step 12, FR-4.5, AC-11, PRD 3.8 item 7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read `src/commands/merge-ready.md`
  2. Count the number of Gate N headings (`Gate 0`, `Gate 1`, ..., `Gate 9`)
  3. Grep for `Gate 10`
- **Expected:** Gate count is unchanged vs. pre-feature state. Zero matches for `Gate 10`. AC-11 verified.

### TC-10.8: `Version source:` field in `templates/CLAUDE.md` is NOT consumed at runtime (PRD 3.8 item 8)
- **Category:** Iteration 1 Boundary
- **Covers:** FR-5.5, PRD 3.8 item 8
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Grep the `changelog-writer.md` agent body for any logic that reads `Version source:` from `.claude/CLAUDE.md`
  2. Grep all modified command files similarly
- **Expected:** Zero matches. The field exists (per TC-9.4) but is not consumed anywhere in iteration 1.

---

## 11. Agent Structured Output (FR-2.9)

### TC-11.1: Agent output contains all 5 required markdown headers in canonical order
- **Category:** Self-Check Sentinel / Continuous Sync (output contract)
- **Covers:** FR-2.9 (pinned markdown schema per `src/agents/changelog-writer.md` Step 11)
- **Type:** Integration
- **Preconditions:** Configured downstream; agent invoked in a scenario that exercises all fields
- **Test Steps:**
  1. Invoke `changelog-writer`
  2. Capture the agent's return output
  3. Verify presence of each of the 5 required top-level markdown headers in this exact order:
     - (a) `## Self-check` with body `configured` or `not-configured`
     - (b) `## Source counts` with bullets for `commits read`, `commits eligible`, `commits skipped as internal`, `commits unmapped`, and `PRD sections read`
     - (c) `## Entries per category` with bullets for `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`
     - (d) `## Action taken` with exactly one of the six canonical tokens per TC-11.3
     - (e) `## Warnings` with one bullet per warning or the literal `none`
- **Expected:** All 5 markdown headers appear in the return output in the canonical order. Output format is pinned to markdown (not JSON or YAML) per agent spec Step 11. A regex/grep matcher can verify each header and its body shape.
- **Edge Cases:** TC-11.2

### TC-11.2: Structured output includes warnings when encountered (UC-6, UC-6-EC1, UC-6-EC2)
- **Category:** Continuous Sync (output contract)
- **Covers:** FR-2.9, NFR-2, UC-6, UC-6-EC1, UC-6-EC2
- **Type:** Integration
- **Preconditions:** Configured downstream; PRD section has missing / empty / TODO-placeholder `Changelog:`
- **Test Steps:**
  1. Invoke `changelog-writer` against each scenario
  2. Verify the output's ambiguous-choices field includes the warning
- **Expected:** For each scenario, the output documents the authoring issue (missing field / empty value / suspicious placeholder) so the developer can diagnose.

### TC-11.3: Action-taken field uses canonical tokens
- **Category:** Self-Check Sentinel / Continuous Sync (output contract)
- **Covers:** FR-2.2, FR-2.6, FR-2.8, FR-2.9
- **Type:** Unit
- **Preconditions:** TC-3.1, TC-4.1, TC-5.13, TC-8.1 pass
- **Test Steps:**
  1. For each scenario (self-check fail, first-create, rewrite, idempotent no-op): capture the action-taken value
- **Expected:** Action-taken tokens match the canonical set:
  - Self-check fail: `no-op: not configured` (exact string per FR-2.2)
  - First create: `action taken: created`
  - Rewrite: `action taken: rewrote`
  - Idempotent no-op: `no-op: already in sync`
  - No eligible entries: `no-op: no eligible entries` (or equivalent; confirm canonical form with planner)
- **Edge Cases:** `[TBD -- confirm canonical strings with planner]`

---

## Coverage Summary

### Use Case Coverage -- 42/42

| Use Case | Primary Test(s) | Alternative/Error/Edge Tests |
|----------|-----------------|------------------------------|
| UC-1 | TC-4.1 | -- |
| UC-1-A1 | TC-5.13 | -- |
| UC-1-EC1 | TC-4.2 | -- |
| UC-2 | TC-5.2, TC-5.4, TC-5.7 | -- |
| UC-2-A1 | TC-5.10 | -- |
| UC-2-A2 | TC-5.11 | -- |
| UC-2-A3 | TC-5.12 | -- |
| UC-2-E1 | TC-8.7 | -- |
| UC-2-E2 | TC-8.6 | -- |
| UC-2-EC1 | TC-7.2 | -- |
| UC-3 | TC-6.1, TC-6.2, TC-6.3 | -- |
| UC-3-A1 | TC-6.4 | -- |
| UC-3-A2 | TC-6.5 | -- |
| UC-3-E1 | TC-6.6 | -- |
| UC-3-EC1 | TC-6.7 | -- |
| UC-4 | TC-7.1, TC-7.5 | -- |
| UC-4-A1 | TC-5.7 | (also exercises merge-ready pre-flight) |
| UC-4-EC1 | TC-7.6 | -- |
| UC-5 | TC-3.1, TC-1.5 | -- |
| UC-5-A1 | TC-8.12 | -- |
| UC-5-EC1 | TC-3.3 | -- |
| UC-6 | TC-8.10 | -- |
| UC-6-E1 | TC-5.9 | -- |
| UC-6-EC1 | TC-7.8 | -- |
| UC-6-EC2 | TC-7.9 | -- |
| UC-7 | TC-8.1 | -- |
| UC-7-A1 | TC-8.2 | -- |
| UC-7-EC1 | TC-8.11 | -- |
| UC-8 | TC-8.3 | -- |
| UC-8-A1 | TC-8.4 | -- |
| UC-8-EC1 | TC-8.5 | -- |
| UC-9 | TC-7.7 | -- |
| UC-9-EC1 | TC-7.7 (implicit -- whitespace/structural equivalence) | `[TBD -- add dedicated TC-9.9 once planner pins standardization behavior]` |
| UC-10 | TC-8.8 | -- |
| UC-10-A1 | TC-8.8 (subsumed by main path) | -- |
| UC-10-E1 | TC-8.8 (subsumed) | -- |
| UC-10-EC1 | TC-8.9 | -- |
| UC-11 | TC-5.3, TC-5.4 | -- |
| UC-11-A1 | TC-7.1 (exercises internal-skip post-commit) | -- |
| UC-11-E1 | TC-5.9 | -- |
| UC-11-EC1 | TC-3.1 (exercises SDLC-repo self-skip from /implement-slice path) | -- |

**Coverage:** 42/42 use cases mapped. UC-9-EC1 is partially covered by TC-7.7 but flagged for a dedicated test case once the planner pins the six-category-subheading standardization behavior.

### Acceptance Criteria Coverage -- 17/17

| AC | Test Case(s) |
|----|--------------|
| AC-1 | TC-1.1, TC-1.2, TC-1.3 |
| AC-2 | TC-1.5, TC-3.1 |
| AC-3 | TC-1.4 |
| AC-4 | TC-3.5, TC-9.3 |
| AC-5 | TC-3.1 |
| AC-6 | TC-8.1 |
| AC-7 | TC-2.1, TC-2.2 |
| AC-8 | TC-5.1 |
| AC-9 | TC-5.3, TC-6.1 |
| AC-10 | TC-5.5, TC-6.2 |
| AC-11 | TC-5.6, TC-10.7 |
| AC-12 | TC-1.11, TC-9.1 |
| AC-13 | TC-1.10, TC-9.5, TC-9.6 |
| AC-14 | TC-9.4 |
| AC-15 | TC-4.1 |
| AC-16 | TC-7.5 |
| AC-17 | TC-9.2, TC-9.7, TC-9.8 |

**Coverage:** 17/17 acceptance criteria mapped.

### Functional Requirement Coverage (runtime-observable)

| FR | Test Case(s) | Notes |
|----|--------------|-------|
| FR-1.1 | TC-1.1, TC-1.2 | File exists with required policy content |
| FR-1.2 | TC-1.5 | Placement under `templates/` and SDLC-repo non-installation |
| FR-1.3 | TC-1.4, TC-1.6 | `--init-project` copies rule file; default install copies agent |
| FR-1.4 | TC-1.3, TC-3.2, TC-3.3 | Presence-as-opt-in sentinel |
| FR-2.1 | TC-3.5, TC-9.3 | Agent file with valid frontmatter |
| FR-2.2 | TC-3.1, TC-3.4, TC-3.5 | Self-check with literal `no-op: not configured` |
| FR-2.3 | TC-5.10, TC-8.7 | Input order; fresh reads from disk |
| FR-2.4 | TC-7.1, TC-7.2, TC-7.3, TC-7.4, TC-7.5 | Source-of-truth priority; skip exclusion; commit-to-PRD mapping |
| FR-2.5 | TC-4.3, TC-4.4 | Category mapping with ambiguous-defaults behavior |
| FR-2.6 | TC-5.13, TC-8.1, TC-8.2 | Whitespace-insensitive idempotent diff |
| FR-2.7 | TC-5.13, TC-8.3, TC-8.6 | Prior versioned sections byte-untouched |
| FR-2.8 | TC-4.1, TC-4.2, TC-7.6 | First-create logic; no empty-file creation |
| FR-2.9 | TC-11.1, TC-11.2, TC-11.3 | Structured output summary |
| FR-2.10 | TC-4.1 (asserts PRD/scratchpad unchanged), TC-10.4 | No mutation of non-CHANGELOG files |
| FR-3.1 | TC-2.1, TC-2.6 | prd-writer emits `Changelog:` field |
| FR-3.2 | TC-2.2, TC-7.8, TC-7.9 | Two valid value shapes |
| FR-3.3 | TC-2.1, TC-2.3 | Output format and constraints documentation |
| FR-3.4 | TC-2.4, TC-2.7 | User-facing phrasing required |
| FR-3.5 | TC-2.5 | `skip -- internal` usage guidance |
| FR-4.1 | TC-5.1, TC-5.2 | Post-bootstrap hook |
| FR-4.2 | TC-5.3, TC-6.1 | Standalone vs. subagent branches |
| FR-4.3 | TC-5.5, TC-6.2 | Orchestrator-only post-wave invocation |
| FR-4.4 | TC-5.6, TC-5.7 | Merge-ready pre-flight hook |
| FR-4.5 | TC-5.9, TC-6.6, TC-8.7 | Non-blocking guarantee |
| FR-4.6 | TC-5.8, TC-5.10, TC-5.11 | Invoked with no arguments; inputs from disk |
| FR-5.1 | TC-9.1 | Agency Roles row |
| FR-5.2 | TC-1.8, TC-1.9, TC-1.10, TC-1.11 | "13" -> "14" references |
| FR-5.3 | TC-9.6 | README agent list |
| FR-5.4 | TC-9.5 | README feature docs |
| FR-5.5 | TC-9.4, TC-10.8 | `Version source:` placeholder |

**Coverage:** all runtime-observable FRs have at least one positive test.

### NFR Coverage (measurable only)

| NFR | Test Case(s) |
|-----|--------------|
| NFR-2 | TC-7.8, TC-8.10 |
| NFR-5 | TC-1.7 |
| NFR-6 | TC-8.1, TC-8.2, TC-8.11, TC-6.6 |
| NFR-7 | TC-8.13 |
| NFR-8 | TC-8.14 (no-op under 5s), TC-8.15 (rewrite under 15s), TC-8.11 (cumulative envelope) |

NFR-1 (no runtime code), NFR-3 (installer-driven activation), NFR-4 (opus model) are deployment-time/architectural and are verified by the existing `changelog-writer.md` frontmatter check (TC-9.3) and install-script checks (TC-1.4 through TC-1.11).

---

## Ambiguity Flags -- TBD Test Cases

The following test cases are marked `[TBD -- update after planner pins X]` because the PRD is ambiguous on at least one dimension. The Tech Lead (planner) must pin ONE canonical interpretation during implementation planning; these tests will be updated or consolidated once pinned.

| TBD Marker | Source Ambiguity | Resolution |
|------------|------------------|------------|
| TC-2.6 | Architect item 2 -- `Changelog:` field placement in PRD header block | RESOLVED: pinned to separate line below the header block (after one blank line following `Related:`). Inline-with-block placement is invalid and produces a "missing Changelog field" warning. See `src/agents/changelog-writer.md` Step 4 and `src/agents/prd-writer.md` Output Format. |
| TC-4.5 | PRD -- canonical form of the `[Unreleased]` heading in a newly created file | Is it `## [Unreleased]` alone, or `## [Unreleased] - <placeholder>`? |
| TC-6.5 | UC-3-A2 -- single-slice wave dispatch path | Does `/develop-feature` dispatch single-slice waves via standalone `/implement-slice` (agent invoked by slice) or via subagent spawn (agent invoked by orchestrator post-wave)? Both are valid per UC-3-A2 but wastes a no-op if the wrong choice is made |
| TC-7.3, TC-7.4 | Architect item 3 -- commit-to-PRD-section mapping mechanism | RESOLVED: pinned to conventional-commit scope matching the slugified PRD section title keyword set. TC-7.4 trailer mechanism (e.g., `PRD-Section: 3`) is rejected and now serves as a negative assertion. See `src/agents/changelog-writer.md` Step 5. |
| TC-7.9 | UC-6-EC2 -- conservative behavior for non-literal `Changelog:` values | Is `Changelog: TODO` included in `[Unreleased]` as a user-facing entry (with a warning) or excluded like `skip -- internal`? The use-case authors propose "include + warn"; prd-writer must confirm |
| TC-11.1 | Architect item 5 -- structured output format | RESOLVED: pinned to markdown with exactly five top-level headers (`## Self-check`, `## Source counts`, `## Entries per category`, `## Action taken`, `## Warnings`) in that order. See `src/agents/changelog-writer.md` Step 11. |
| TC-11.3 | Canonical action-taken tokens | Exact strings for each action state (`no-op: not configured`, `no-op: already in sync`, `action taken: created`, `action taken: rewrote`, `no-op: no eligible entries` — is "no eligible entries" the canonical form?) |

---

## Defensive Tests for Multiple Interpretations

Where the PRD did not pin an interpretation, the following tests were written to cover BOTH valid alternatives (so coverage is not lost if the planner chooses either direction):

1. **TC-2.6** (RESOLVED) -- now asserts the pinned own-line-below placement parses and the inline-with-block placement is treated as missing field (negative assertion on the rejected alternative).
2. **TC-7.3 & TC-7.4** (RESOLVED) -- TC-7.3 asserts the pinned conventional-commit scope mechanism. TC-7.4 asserts the rejected trailer mechanism is ignored (commits with no matching scope are "unmapped" regardless of trailer content).
3. **TC-6.5** -- exercises BOTH single-slice-wave dispatch paths (standalone `/implement-slice` invocation OR orchestrator-only post-wave invocation); asserts final state is equivalent either way via idempotency
4. **TC-7.9** -- tests the conservative "include + warn" behavior for malformed `Changelog:` values, flagging that prd-writer should confirm

Remaining unresolved ambiguities (TC-4.5, TC-6.5, TC-7.9, TC-11.3) keep their defensive-pair test shape until the planner pins their canonical choice.
