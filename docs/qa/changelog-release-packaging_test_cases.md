# Test Cases: Changelog Release Packaging -- Iteration 2 of Feature #3

> Based on [PRD](../PRD.md) -- Section 6 and [Use Cases](../use-cases/changelog-release-packaging_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, cross-reference integrity, and (for installer and agent-runtime tests) observable filesystem/process behavior by running shell commands and inspecting outputs.

**Scope:** This suite covers the new `release-engineer` agent (the 17th mandatory core agent), `/merge-ready` Gate 9 (the 10th gate, zero-indexed), the runtime consumer of `templates/CLAUDE.md`'s iteration-1 `Version source:` placeholder, and the agent-count + gate-count propagation across `install.sh`, `README.md`, and `src/claude.md`. Defense-in-depth tool-restriction verification (no `Bash`, no `WebFetch`, no `WebSearch`, no `NotebookEdit`) parallels Section 4 FR-5.7 and Section 5 NFR-6.

**Architect [STRUCTURAL] decisions incorporated:**
1. **Gate 9 (NOT Gate 10).** Total gate count rises 9->10. The new gate is Gate 9 zero-indexed, the 10th gate by ordinal count. Iteration 1's "Gate 10" nomenclature in Section 3.8 item 7 has been swept across the PRD and use-case document. (TC-9.x family)
2. **`breaking` negation skip.** `non-breaking` (hyphenated prefix) and `not breaking` (preceding `not ` token) MUST NOT trigger major. (TC-4.6 -- TC-4.9)
3. **Multi-pattern CI/CD detection (P1+P2+P3).** P1 = tag-trigger; P2 = `body_path` references release-notes; P3 = inline `run:` step extracting from `CHANGELOG.md`. Outcome: P1 AND (P2 OR P3) -> present-and-correct; P1 alone -> present-but-warning; no P1 -> ABSENT. (TC-6.6 -- TC-6.10)
4. **Two-step `body_path` in workflow template.** Generated `release.yml` MUST contain a dedicated `Strip v prefix from tag` step that writes `version=${GITHUB_REF_NAME#v}` to `$GITHUB_OUTPUT`, and `body_path` MUST reference `${{ steps.ver.outputs.version }}` -- never `${GITHUB_REF_NAME#v}` directly inside the YAML string. (TC-6.3, TC-6.4, TC-6.5)
5. **`packed-refs` parsing MUST.** Per FR-3.1(e), if `.git/refs/tags/v*.*.*` Glob returns zero matches, the agent MUST also Read `.git/packed-refs` and parse `<sha> refs/tags/<name>` lines. Promoted from MAY to MUST per architect concern. (TC-3.6, TC-3.7)
6. **`./CLAUDE.md` precedence over `.claude/CLAUDE.md`.** Per FR-3.2, when both files contain a `Version source:` line and the values disagree, `./CLAUDE.md` wins; the agent MUST emit the literal warning text "multiple Version source: lines detected -- using ./CLAUDE.md; recommend reconciling to a single source of truth". (TC-3.4, TC-3.5)
7. **Gate-Count Propagation table.** Separate from agent-count (16->17); Plan Critic verifies BOTH counts. (TC-10.x family)

**Format TBD markers:** Several test cases are flagged `[TBD -- update after planner pins X]` because the PRD leaves one or more details (e.g., exact gate-output table layout, exact wording of warning aggregation in FR-6.6) to the Tech Lead (planner) pinning step. The full list appears in the Ambiguity Flags section at the end.

---

## 1. Installation & Setup

### TC-1.1: `src/agents/release-engineer.md` file exists at the documented path
- **Category:** Installation & Setup
- **Covers:** FR-1.1, AC-1; UC-1 preconditions
- **Type:** Unit
- **Preconditions:** Feature is shipped; SDLC repo checked out at HEAD
- **Test Steps:**
  1. Run `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Exit code 0 (file exists)
- **Edge Cases:** TC-1.2 (frontmatter), TC-1.6 (installer copies)

### TC-1.2: `src/agents/release-engineer.md` frontmatter has required keys
- **Category:** Installation & Setup
- **Covers:** FR-1.1, NFR-4, AC-1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -E "^name: release-engineer" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -E "^description:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  3. `grep -E "^tools:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  4. `grep -E "^model: opus" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** All four greps return >=1 match. `name` is exactly `release-engineer`; `model` is exactly `opus` (per NFR-4).
- **Edge Cases:** TC-1.3 (tools positively restricted), TC-1.4 (Bash/Web/Notebook excluded)

### TC-1.3: Tools list contains EXACTLY `Read`, `Write`, `Edit`, `Glob`, `Grep`
- **Category:** Installation & Setup
- **Covers:** FR-1.1, AC-1, AC-8
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `tools:` line (or multi-line block) from `src/agents/release-engineer.md`
  2. `grep -cE '"?Read"?' (tools value)` -- expect >=1
  3. `grep -cE '"?Write"?' (tools value)` -- expect >=1
  4. `grep -cE '"?Edit"?' (tools value)` -- expect >=1
  5. `grep -cE '"?Glob"?' (tools value)` -- expect >=1
  6. `grep -cE '"?Grep"?' (tools value)` -- expect >=1
  7. Confirm no tool name other than these five appears in the value
- **Expected:** The tools field lists exactly the five allowed tools per FR-1.1's pinned set `["Read", "Write", "Edit", "Glob", "Grep"]`. No additional tools.
- **Edge Cases:** TC-1.4

### TC-1.4: Tools list does NOT include `Bash`, `WebFetch`, `WebSearch`, `NotebookEdit`
- **Category:** Installation & Setup
- **Covers:** FR-1.1, NFR-6, AC-8; design decision 4, design decision 10
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `tools:` value from `src/agents/release-engineer.md`
  2. `grep -cE '"?Bash"?' (tools value)` -- expect 0
  3. `grep -cE '"?WebFetch"?' (tools value)` -- expect 0
  4. `grep -cE '"?WebSearch"?' (tools value)` -- expect 0
  5. `grep -cE '"?NotebookEdit"?' (tools value)` -- expect 0
- **Expected:** None of the four excluded tools appear. This mechanically enforces NFR-6 no-network and the defense-in-depth posture from design decision 4 (parallel to Section 4 FR-5.7 and Section 5 NFR-6). Excluding `Bash` makes it impossible for the agent to invoke `git push`, `git tag`, `gh release create`, `npm publish`, or any package-manager command.
- **Edge Cases:** TC-1.3, TC-2.x (NEVER list)

### TC-1.5: `src/agents/release-engineer.md` body has minimum required sections
- **Category:** Installation & Setup
- **Covers:** FR-1.1, FR-1.2, FR-1.3, AC-2; UC-1 step 1
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract content after the closing `---` frontmatter delimiter
  2. `grep -iE "self-check|first step" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- self-check is documented
  3. `grep -iE "no-op: no unreleased changes" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- exact no-op string is in prompt
  4. `grep -iE "NEVER" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- explicit NEVER section
  5. `grep -iE "Authority|Boundary" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- authority boundary section
- **Expected:** Body is non-empty and contains: a documented self-check first step (FR-1.3), the literal `no-op: no unreleased changes` string (FR-1.3, FR-6.7), an explicit NEVER list (design decision 10), and an Authority Boundary section (parallel to Section 4 FR-5.1 and Section 5).
- **Edge Cases:** TC-2.1 -- TC-2.10 (NEVER list enumeration)

### TC-1.6: `install.sh` default install path copies `release-engineer.md` into `~/.claude/agents/`
- **Category:** Installation & Setup
- **Covers:** FR-8.6, AC-15; UC-1 precondition
- **Type:** Installation
- **Preconditions:** Fresh user-level config; `~/.claude/agents/release-engineer.md` does NOT exist before running installer
- **Test Steps:**
  1. `rm -f $HOME/.claude/agents/release-engineer.md` (clean precondition)
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --yes --local`
  3. `test -f $HOME/.claude/agents/release-engineer.md`
- **Expected:** Step 3 exits 0. The agent file is copied by the default install path via the `src/agents/*.md` glob in install.sh (per FR-8.6, no installer-code change required beyond verification).
- **Edge Cases:** TC-1.7 (total agent count), TC-1.8 (banner strings)

### TC-1.7: Installed core-agent count is 17 after install
- **Category:** Installation & Setup
- **Covers:** NFR-5, FR-8.6
- **Type:** Installation
- **Preconditions:** TC-1.6 passes
- **Test Steps:**
  1. Run `ls -1 $HOME/.claude/agents/*.md | grep -v "^ondemand-" | wc -l | tr -d ' '`
- **Expected:** Output equals `17`. Agent count rose from 16 (post-Section-5) to 17 with the addition of `release-engineer`. On-demand files (prefix `ondemand-`) are excluded since they are NOT counted in the core-agent tally per Section 5 NFR-5.
- **Edge Cases:** TC-1.8 (banner strings), TC-1.9 (--help output)

### TC-1.8: `install.sh` banner strings updated from "16" to "17" -- all five locations
- **Category:** Installation & Setup
- **Covers:** FR-8.5, AC-14
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  2. `grep -c "17 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  3. `grep -c "16 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  4. `grep -c "17 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  5. `grep -cE "\(16 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  6. `grep -cE "\(17 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  7. `grep -cE "(^|[^0-9])16([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/install.sh | tr -d ' '` -- total "16" agent-count references
  8. `grep -cE "(^|[^0-9])17([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/install.sh | tr -d ' '` -- total "17" agent-count references
- **Expected:**
  - Step 1: returns `0` (no stale "16 specialized")
  - Step 2: returns at least `1`
  - Step 3: returns `0` (no stale "16 AI agents")
  - Step 4: returns at least `1`
  - Step 5: returns `0` (no stale `(16 files`)
  - Step 6: returns at least `1`
  - Step 7: returns `0` agent-count "16"s
  - Step 8: returns exactly `5` agent-count "17"s (the five banner locations per PRD 6.6 Agent Count Propagation table)
- **Edge Cases:** TC-1.9 (--help output)

### TC-1.9: `install.sh --help` output reports "17 specialized AI agents"
- **Category:** Installation & Setup
- **Covers:** FR-8.5, AC-14
- **Type:** Installation
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "17"`
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "16 specialized"`
- **Expected:** Step 1 returns at least `2` (the tagline line and the WHAT GETS INSTALLED block both mention "17"); step 2 returns `0`.
- **Edge Cases:** TC-1.8

### TC-1.10: `README.md` "16" references updated to "17"
- **Category:** Installation & Setup
- **Covers:** FR-8.2, FR-8.3, AC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. `grep -c "17 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  3. `grep -c "The 16 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  4. `grep -c "The 17 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  5. `grep -nE "(^|[^0-9])16([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/README.md | wc -l | tr -d ' '` -- agent-count "16"s
  6. `grep -nE "(^|[^0-9])17([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/README.md | wc -l | tr -d ' '` -- agent-count "17"s
- **Expected:**
  - Step 1: returns `0`
  - Step 2: returns at least `1`
  - Step 3: returns `0`
  - Step 4: returns at least `1`
  - Step 5: returns `0` agent-count "16"s
  - Step 6: returns at least `2` agent-count "17"s (tagline + `## The 17 Agents` heading per PRD 6.6 table)
- **Edge Cases:** TC-1.11 (agent table row), TC-1.12 (feature section)

### TC-1.11: `README.md` includes a `release-engineer` row in the agent table
- **Category:** Installation & Setup
- **Covers:** FR-8.3, AC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -n "release-engineer" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. Verify the match appears in the `## The 17 Agents` table at the end (placement consistent with Agency Roles per FR-8.1)
  3. `grep -iE "Release Engineer" /Users/aleksandra/Documents/claude-code-sdlc/README.md` -- the role title matches `src/claude.md`
- **Expected:** `release-engineer` appears in the README agent table at the end of the list with role title "Release Engineer". (FR-8.3 mandates the role title match `src/claude.md` exactly.)

### TC-1.12: `README.md` has a feature section describing release packaging
- **Category:** Installation & Setup
- **Covers:** FR-8.4, AC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "release packaging|Gate 9|release-engineer" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. `grep -iE "version bump|CHANGELOG date|release-notes file|GitHub Actions" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  3. `grep -iE "suggest-only|never (push|tag|publish)|developer (runs|executes)" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Expected:** Each grep returns at least 1 match. The README documents (a) release packaging at Gate 9, (b) the four sub-capabilities (bump, date stamp, release-notes file, workflow provisioning), (c) the suggest-only authority pattern (no git push, no gh release create, no version-source-file edits) per FR-8.4.

### TC-1.13: `templates/CLAUDE.md` `Version source:` documentation updated for runtime consumption
- **Category:** Installation & Setup
- **Covers:** FR-8.7, AC-16
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "no runtime effect" /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md` -- expect 0 (stale iteration-1 wording removed)
  2. `grep -iE "consumed by.*release-engineer|Section 6|Gate 9" /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md`
  3. `grep -iE "package\\.json|pyproject\\.toml|Cargo\\.toml|VERSION" /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md` -- documents expected values
  4. `grep -iE "Leave blank to use auto-detection|FR-3\\.1" /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md`
- **Expected:** Step 1 returns 0; steps 2-4 return >=1 match. The placeholder documentation references the runtime consumer (release-engineer at Gate 9), enumerates expected values (paths to version-source files), and explains the override-vs-auto-detection priority per FR-8.7 and AC-16.

---

## 2. Authority Boundaries (NEVER List + Defense-in-Depth)

### TC-2.1: Agent prompt contains explicit "NEVER" section
- **Category:** Authority Boundaries
- **Covers:** Design decision 10, FR-1.1, AC-8
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "NEVER|MUST NOT" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match; the prompt contains an explicit NEVER section parallel to Section 4 FR-5.1's Authority Boundary section per design decision 10.

### TC-2.2: Prohibition against `git push` / `git tag`
- **Category:** Authority Boundaries
- **Covers:** Design decision 10, AC-8; UC-2 step 13, UC-3 step 12
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*git push|never.*git push" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "MUST NOT.*git tag|never.*git tag" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Both greps return >=1 match. The prompt explicitly prohibits invoking `git push` and `git tag`.

### TC-2.3: Prohibition against `gh release create`
- **Category:** Authority Boundaries
- **Covers:** Design decision 10, 6.8 item 4; UC-7 step 6
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*gh release|never.*gh release" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match; prompt prohibits `gh release create` execution.

### TC-2.4: Prohibition against `npm publish` / `cargo publish` / `pypi upload`
- **Category:** Authority Boundaries
- **Covers:** Design decision 10
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "npm publish|cargo publish|pypi upload" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match for each. The prompt enumerates package-manager publish commands as prohibited.

### TC-2.5: Prohibition against modifying version-source files
- **Category:** Authority Boundaries
- **Covers:** FR-3.4, design decision 10, 6.8 item 3; UC-3 postcondition, UC-15 postcondition
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT (write|modify).*(package\\.json|pyproject\\.toml|Cargo\\.toml|VERSION)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "READ.ONLY.*version.source|READ ONLY" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Both greps return >=1 match. The prompt explicitly enumerates `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION` as READ-ONLY.

### TC-2.6: Prohibition against network calls
- **Category:** Authority Boundaries
- **Covers:** NFR-6, design decision 10; UC-1 step 6
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "no network|MUST NOT.*network|no.*HTTP|no.*fetch" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match; declared at two levels: prompt prohibition AND `tools` excludes `WebFetch`/`WebSearch`/`Bash` (TC-1.4).

### TC-2.7: Prohibition against modifying `~/.claude/settings.json` and other agent files
- **Category:** Authority Boundaries
- **Covers:** Design decision 10
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "settings\\.json" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "MUST NOT (write|modify).*src/agents|other agent" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Both greps return >=1 match; prompt prohibits modifying Claude Code config and other agent prompt files.

### TC-2.8: Prohibition against modifying CHANGELOG.md sections OTHER THAN the freshly renamed one
- **Category:** Authority Boundaries
- **Covers:** FR-2.2, FR-2.3, design decision 5
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT (modify|delete).*\\[X\\.Y\\.Z\\]|prior.*released.*sections" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "header.*preserved|byte-for-byte" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Both greps return >=1 match. Prompt enumerates the CHANGELOG-modification scope: only the freshly-renamed `[X.Y.Z]` section + the fresh `[Unreleased]` heading. Prior `[X.Y.Z]` sections and the Keep a Changelog header are byte-for-byte preserved.

### TC-2.9: Prohibition against modifying `.github/workflows/` files OTHER THAN `release.yml`
- **Category:** Authority Boundaries
- **Covers:** FR-5.6
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT (modify|delete).*\\.github/workflows.*OTHER THAN|only.*release\\.yml" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match. Prompt prohibits modifying any workflow file other than `release.yml`. Parallels FR-5.6.

### TC-2.10: Prohibition against committing
- **Category:** Authority Boundaries
- **Covers:** FR-2.7, design decision 10
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT (commit|run.*git commit)|developer.*commit" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match. Prompt declares commit responsibility belongs to the developer (or orchestrator) per FR-2.7.

### TC-2.11: Prohibition against adding GitHub Actions secrets / repository settings
- **Category:** Authority Boundaries
- **Covers:** FR-5.7
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*(secrets|repository settings|branch protection)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** At least one match per FR-5.7.

### TC-2.12: Defense-in-depth -- agent prompt grep for `git push`/`git tag`/`gh release`/`npm publish` is permitted ONLY in fenced code blocks
- **Category:** Authority Boundaries
- **Covers:** Design decision 10, FR-6.5; defense-in-depth anti-drift check
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. Identify all occurrences of `git push`, `git tag`, `gh release`, `npm publish` in `src/agents/release-engineer.md`
  2. For each occurrence, verify it is contained within a fenced code block (lines surrounded by ` ``` ` markers)
  3. Verify NO occurrence appears in instructional prose (lines outside fenced blocks)
- **Expected:** All occurrences appear inside fenced shell blocks (the FR-6.5 commands-to-run example). Zero occurrences appear in instructional prose suggesting the agent itself execute these commands. This is the anti-drift check: future prompt revisions cannot accidentally instruct the agent to run a publish command without it appearing inside a code block (where it represents user-runnable text, not an agent instruction).
- **Edge Cases:** TC-2.13 (related anti-drift)

### TC-2.13: Anti-drift -- no instruction in prose to "execute", "run", or "invoke" git/gh/publish commands
- **Category:** Authority Boundaries
- **Covers:** Design decision 10; defense-in-depth anti-drift check
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "(execute|run|invoke).*(git push|git tag|gh release|npm publish|cargo publish)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. For each match, verify the surrounding context is a NEGATIVE instruction ("MUST NOT execute...", "never run...", or quoted-as-example inside fenced block)
- **Expected:** Zero positive instructions to execute these commands. All matches are framed as prohibitions per design decision 10.

---

## 3. Version Source Detection

### TC-3.1: Priority order documented in prompt -- (a) package.json, (b) pyproject.toml, (c) Cargo.toml, (d) VERSION, (e) git tags
- **Category:** Version Source Detection
- **Covers:** FR-3.1; UC-2, UC-3, UC-3-A1, UC-3-A2, UC-3-A3, UC-3-A4
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -nE "package\\.json" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -nE "pyproject\\.toml" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  3. `grep -nE "Cargo\\.toml" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  4. `grep -nE "VERSION" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  5. `grep -nE "\\.git/refs/tags|git tag" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  6. Verify the line numbers of (a)-(e) appear in priority order (a < b < c < d < e) in the priority-list documentation
- **Expected:** All five greps return >=1 match. The priority-order documentation is sequential per FR-3.1.

### TC-3.2: Priority short-circuits at first present source
- **Category:** Version Source Detection
- **Covers:** FR-3.1; UC-3 step 2 (priority (a) wins, does NOT continue)
- **Type:** Agent Runtime
- **Preconditions:** Fixture project with both `package.json` (1.4.2) and `VERSION` (2.3.1) present, populated `[Unreleased]`
- **Test Steps:**
  1. Invoke `release-engineer` against the fixture
  2. Verify the structured summary's "Detected version source" = `package.json`
  3. Verify the bump computes from `1.4.2` (priority (a) wins), not from `2.3.1`
- **Expected:** Priority (a) wins; the agent stops at the first present source per FR-3.1. UC-3-EC1 multi-source warning is also expected (TC-3.3).

### TC-3.3: Multi-source warning -- multiple priority sources present
- **Category:** Version Source Detection
- **Covers:** FR-3.1, FR-6.6; UC-3-EC1
- **Type:** Agent Runtime
- **Preconditions:** TC-3.2 fixture (both `package.json` and `VERSION` present)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Inspect the "Warnings" section of the structured summary
  3. `grep -iE "multiple version sources|recommend.*reconcile" <summary>`
- **Expected:** The warnings section includes a multi-source warning naming both files and the priority winner per FR-3.1.

### TC-3.4: `Version source:` override -- `./CLAUDE.md` precedence over `.claude/CLAUDE.md` (architect [STRUCTURAL] 6)
- **Category:** Version Source Detection
- **Covers:** FR-3.2; UC-5; architect [STRUCTURAL] 6
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `./CLAUDE.md` containing `Version source: VERSION-A` AND `.claude/CLAUDE.md` containing `Version source: VERSION-B` (two different override values)
- **Test Steps:**
  1. Place `VERSION-A` and `VERSION-B` files at the project root with distinct semver values
  2. Place `./CLAUDE.md` with line `Version source: VERSION-A`
  3. Place `.claude/CLAUDE.md` with line `Version source: VERSION-B`
  4. Invoke `release-engineer` with populated `[Unreleased]`
  5. Verify "Detected version source" reports the override origin from `./CLAUDE.md` (NOT `.claude/CLAUDE.md`)
  6. Verify the bump computation reads from `VERSION-A` (root CLAUDE.md wins per architect [STRUCTURAL] 6)
- **Expected:** `./CLAUDE.md` wins. The "Warnings" section MUST contain the literal string "multiple Version source: lines detected -- using ./CLAUDE.md; recommend reconciling to a single source of truth" per FR-3.2.
- **Edge Cases:** TC-3.5 (single CLAUDE.md present)

### TC-3.5: `Version source:` override -- only one CLAUDE.md file with override line, no warning
- **Category:** Version Source Detection
- **Covers:** FR-3.2; UC-5
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `.claude/CLAUDE.md` containing `Version source: VERSION` and NO `./CLAUDE.md` (or `./CLAUDE.md` without a `Version source:` line)
- **Test Steps:**
  1. Place `VERSION` file with `2.3.1`
  2. Place `.claude/CLAUDE.md` with `Version source: VERSION`
  3. Verify `./CLAUDE.md` either does not exist OR exists without the override line
  4. Invoke `release-engineer`
  5. Inspect "Warnings" section
- **Expected:** No "multiple Version source:" warning is emitted (only one file has the override). The override is used. Per FR-3.2: "If only one of the two files is present, that file's value is used without warning."

### TC-3.6: Packed-refs parsing MUST run when `.git/refs/tags/v*.*.*` Glob returns zero matches (architect [STRUCTURAL] 5)
- **Category:** Version Source Detection
- **Covers:** FR-3.1(e); UC-13; architect [STRUCTURAL] 5
- **Type:** Agent Runtime
- **Preconditions:** Fixture project where:
  - No `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`, no `Version source:` override
  - `.git/refs/tags/` is empty
  - `.git/packed-refs` contains lines like `<sha> refs/tags/v1.4.2`, `<sha> refs/tags/v1.0.0`
  - Populated `[Unreleased]`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Detected version source" reports the parsed tag (e.g., `git tag v1.4.2`) -- NOT `(none -- fallback 0.1.0)`
  3. Verify the new version is computed from the parsed tag's version (e.g., `1.4.2 + Added -> 1.5.0`)
- **Expected:** The agent successfully parses `.git/packed-refs` and uses the highest semver tag as the current version. Per architect [STRUCTURAL] 5, packed-refs parsing is MUST (not MAY).

### TC-3.7: Prompt explicitly documents packed-refs parsing as MUST
- **Category:** Version Source Detection
- **Covers:** FR-3.1(e); architect [STRUCTURAL] 5
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "packed-refs|\\.git/packed-refs" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "MUST.*packed-refs" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Both greps return >=1 match. The prompt documents the packed-refs fallback as MUST (not MAY). Per architect [STRUCTURAL] 5.

### TC-3.8: Fallback to `0.1.0` when no source AND no override AND no tags
- **Category:** Version Source Detection
- **Covers:** FR-3.3, FR-6.2, FR-6.6; UC-2, UC-3-E1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with populated `[Unreleased]`, no version-source files at all, no `Version source:` line in either CLAUDE.md, no git tags
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Detected version source" = `(none -- fallback 0.1.0)` (exact string per FR-3.3)
  3. Verify "Current version" = `0.1.0`
  4. Verify "Warnings" section includes a fallback notice
- **Expected:** Agent succeeds via fallback (NOT a hard failure). Per FR-3.3 the fallback is degraded mode.

### TC-3.9: Override path resolves to non-existent file -- fall back to FR-3.1 priority
- **Category:** Version Source Detection
- **Covers:** FR-3.2, FR-3.1, FR-6.6; UC-5-A1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `./CLAUDE.md` containing `Version source: VERSION` BUT no `VERSION` file at project root; `package.json` present with `1.0.0`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Detected version source" = `package.json` (fallback to priority order)
  3. Verify "Warnings" includes "Version source: override path 'VERSION' does not exist; falling back to auto-detection"
- **Expected:** Agent succeeds via fallback per FR-3.2; warning surfaces the issue.

### TC-3.10: Override path is unreadable -- emit warning, fall back
- **Category:** Version Source Detection
- **Covers:** FR-3.2; UC-5-E1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with override pointing to a directory or unreadable file
- **Test Steps:**
  1. Place `./CLAUDE.md` with `Version source: somedir/`
  2. Create `somedir/` as a directory
  3. Invoke `release-engineer`
- **Expected:** Agent emits warning "Version source: override path '<path>' is unreadable" and falls back per FR-3.2 / UC-5-E1.

### TC-3.11: Idempotent override -- override matches priority result, no warning
- **Category:** Version Source Detection
- **Covers:** FR-3.2; UC-5-A2
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `./CLAUDE.md` containing `Version source: package.json` AND `package.json` with `1.4.2`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Detected version source" = `CLAUDE.md Version source: package.json`
  3. Verify no priority-disagreement warning is emitted
- **Expected:** The override is honored and surfaced (transparency for audit), but no warning since the result matches what auto-detection would have produced. Per UC-5-A2.

### TC-3.12: Pre-release suffix stripped from version source (FR-3.5)
- **Category:** Version Source Detection
- **Covers:** FR-3.5, FR-6.6; flagged in UC coverage map as needing direct test case
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json` `version: "0.3.7-beta.1"`, populated `[Unreleased]` with `### Added`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Current version" reports `0.3.7` (suffix stripped per FR-3.5)
  3. Verify "Warnings" includes a notice about the stripped suffix (e.g., "stripped pre-release suffix '-beta.1' from version source")
  4. Verify "New version" is `0.4.0` (minor bump from clean `0.3.7`)
- **Expected:** Pre-release suffix is stripped before bump computation; warning surfaces in the structured summary; bumped version carries no pre-release or build metadata forward (iteration 2 emits clean X.Y.Z only) per FR-3.5.

### TC-3.13: Build metadata stripped from version source (FR-3.5)
- **Category:** Version Source Detection
- **Covers:** FR-3.5; FR coverage extension for build metadata
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `VERSION` containing `0.3.7+sha.abc123`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Current version" = `0.3.7` (build metadata stripped)
  3. Verify "Warnings" includes a notice about the stripped metadata
- **Expected:** Build metadata is stripped per FR-3.5. Bumped version does not carry forward.

### TC-3.14: Agent NEVER writes version-source files
- **Category:** Version Source Detection
- **Covers:** FR-3.4, design decision 10, 6.8 item 3; UC-3 postcondition, UC-5 postcondition, UC-15 postcondition
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and populated `[Unreleased]` triggering minor bump
- **Test Steps:**
  1. Take a sha256 hash of `package.json` before invocation
  2. Invoke `release-engineer`
  3. Take a sha256 hash of `package.json` after invocation
  4. Verify hashes are identical (no mutation)
- **Expected:** `package.json` is byte-for-byte unchanged after the agent runs. The structured summary's commands block contains the placeholder `<update version-source if needed per project tooling>` per FR-3.4.

### TC-3.15: `package.json` present but missing `version` field -- fall through priority
- **Category:** Version Source Detection
- **Covers:** FR-3.1, FR-3.3, FR-6.6; UC-2-A1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json` lacking the `version` key, no other version-source files
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Warnings" includes "package.json present but lacks `version` field; falling through to next priority"
  3. Verify "Detected version source" = `(none -- fallback 0.1.0)` (assuming no other priority source present)
- **Expected:** Per UC-2-A1, the agent treats this as no-version-detected and falls through. Warning surfaces.

---

## 4. Semver Bump Algorithm

### TC-4.1: FR-4.5 worked example -- `0.3.7 + Fixed-only -> 0.3.8`
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1(c), FR-4.5, AC-7(a)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 0.3.7` and `[Unreleased]` containing only `### Fixed` entries
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `patch`
  3. Verify "New version" = `0.3.8`
  4. Verify "Bump computation explanation" cites FR-4.1(c)
- **Expected:** Patch bump. Pre-1.0 override does not change the result. Per AC-7(a) PRD-pinned worked example.
- **Edge Cases:** TC-4.5 (worked example AC-7(b)), TC-4.10 (FR-4.4 patch alternative)

### TC-4.2: FR-4.5 worked example -- `0.3.7 + Added -> 0.4.0`
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1(b), FR-4.5, AC-7(b)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 0.3.7` and `[Unreleased]` containing `### Added` entries (no `Removed`, no `breaking` token)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor`
  3. Verify "New version" = `0.4.0`
  4. Verify pre-1.0 override is noted as checked but not coercive (rule was already non-major)
- **Expected:** Minor bump. Per AC-7(b) PRD-pinned worked example.

### TC-4.3: FR-4.5 worked example -- `1.2.3 + Removed -> 2.0.0`
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1(a), FR-4.2, FR-4.5, AC-7(c)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.2.3` (post-1.0) and `[Unreleased]` with `### Removed` entries
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `major`
  3. Verify "New version" = `2.0.0`
  4. Verify pre-1.0 override is documented as not applicable (current MAJOR=1)
- **Expected:** Major bump. Per AC-7(c) PRD-pinned worked example.

### TC-4.4: FR-4.5 worked example -- `0.9.9 + Removed -> 0.10.0` (pre-1.0 override)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1(a), FR-4.2, FR-4.5, AC-7(d); UC-4
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 0.9.9` (pre-1.0) and `[Unreleased]` with `### Removed` entries
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor` (NOT `major`)
  3. Verify "New version" = `0.10.0` (NOT `1.0.0`)
  4. Verify "Bump computation explanation" cites FR-4.1(a) -> would have been major, FR-4.2 coerced to minor
  5. Verify "Warnings" includes pre-1.0 coercion notice per FR-6.6
- **Expected:** Pre-1.0 override coerces major to minor. Per AC-7(d) PRD-pinned worked example.
- **Edge Cases:** TC-4.7 (pre-1.0 with breaking token)

### TC-4.5: All four PRD-pinned worked examples appear in agent prompt
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.5, AC-7
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -E "0\\.3\\.7.*0\\.3\\.8" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- example (a)
  2. `grep -E "0\\.3\\.7.*0\\.4\\.0" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- example (b)
  3. `grep -E "1\\.2\\.3.*2\\.0\\.0" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- example (c)
  4. `grep -E "0\\.9\\.9.*0\\.10\\.0" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md` -- example (d)
- **Expected:** All four greps return >=1 match. Per AC-7 the prompt MUST contain at least these four worked examples.

### TC-4.6: `breaking` token negation skip -- `non-breaking` (architect [STRUCTURAL] 2)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1 negation skip rule; architect [STRUCTURAL] 2
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` `### Added` entry: `non-breaking change to internal API` (no other categories non-empty, no `Removed`)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor` (NOT `major`)
  3. Verify "New version" = `1.5.0` (Added rule, not breaking rule)
  4. Verify "Bump computation explanation" notes the negation skip applied
- **Expected:** `non-breaking` does NOT trigger major. Per FR-4.1 negation skip rule and architect [STRUCTURAL] 2.

### TC-4.7: `breaking` token negation skip -- `not breaking` (architect [STRUCTURAL] 2)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1 negation skip rule; architect [STRUCTURAL] 2
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` `### Added` entry: `not breaking the existing contract`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor` (NOT `major`)
  3. Verify "New version" = `1.5.0`
- **Expected:** Preceding `not ` skips the major trigger. Per FR-4.1 negation skip rule.

### TC-4.8: `breaking` token negation skip -- `Non-Breaking` (case-insensitive)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1 negation skip rule; architect [STRUCTURAL] 2
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `[Unreleased]` `### Changed` entry: `Non-Breaking compatibility fix` (no other relevant categories)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor`
- **Expected:** Case-insensitive negation match per FR-4.1 negation skip rule examples.

### TC-4.9: `breaking` token DOES trigger major when not negated
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1(a), FR-4.5, AC-7(c)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` `### Added` entry: `BREAKING change to API surface` (no negation prefix)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `major`
  3. Verify "New version" = `2.0.0`
- **Expected:** Major bump. The negation check is the ONLY exception per FR-4.1; uppercase BREAKING still triggers (case-insensitive match).
- **Edge Cases:** TC-4.6, TC-4.7, TC-4.8 (negations); TC-4.4 (pre-1.0 coercion); UC-14 word-boundary "breaking news"

### TC-4.10: Uncategorized entries treated as `Changed` (FR-4.3)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.3, FR-6.6; flagged in UC coverage map
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` containing entries directly under the `[Unreleased]` heading with NO `### Added`/`### Changed`/etc. category subheading
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor` (treated as Changed per FR-4.3)
  3. Verify "Warnings" includes uncategorized-entries warning per FR-4.3
- **Expected:** Uncategorized entries are treated as `Changed` (most conservative non-major default). Warning surfaces.

### TC-4.11: `Deprecated` only -> patch (FR-4.4)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.4; flagged in UC coverage map
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` containing only `### Deprecated` entries (no Added, no Changed, no Removed, no Fixed, no Security, no breaking token)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `patch`
  3. Verify "New version" = `1.4.3`
  4. Verify "Bump computation explanation" cites FR-4.4
- **Expected:** Per FR-4.4 deprecation announcements are conventionally patch bumps.

### TC-4.12: `Security` only -> patch (FR-4.4)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.4; flagged in UC coverage map
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` containing only `### Security` entries
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `patch`
  3. Verify "New version" = `1.4.3`
- **Expected:** Per FR-4.4 security fixes are conventionally patch bumps.

### TC-4.13: `Removed` AND `Fixed` together -> major (conservative, not patch)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1, FR-4.2; UC-8-E1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and `[Unreleased]` containing both `### Removed` and `### Fixed` entries
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `major` (rule (a) fires on Removed)
  3. Verify "New version" = `2.0.0`
  4. Verify "Bump computation explanation" notes both categories present and that rule (a) overrides downgrade to patch
- **Expected:** Major bump per UC-8-E1's documented conservative interpretation. Removed dominates; Fixed entries are still recorded but do NOT downgrade the bump.

### TC-4.14: Word-boundary `breaking` token -- `earthbreaking` does NOT trigger
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1; UC-14-EC1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `[Unreleased]` `### Added` entry containing `earthbreaking` (no word boundary before `breaking`)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor` (Added rule, NOT major)
- **Expected:** Word-boundary regex does not match inside a longer word per UC-14-EC1.

### TC-4.15: Word-boundary `breaking` token -- `breaking news` DOES trigger (true positive on word boundary)
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.1; UC-14
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `[Unreleased]` `### Fixed` entry: `Fixed breaking news widget rendering on mobile`
- **Test Steps:**
  1. Invoke `release-engineer` (post-1.0 fixture)
  2. Verify "Computed bump type" = `major`
  3. Verify "Bump computation explanation" surfaces the matched entry text for developer audit
- **Expected:** Per UC-14 the deterministic word-boundary match fires; the agent does NOT attempt natural-language disambiguation. Developer reviews summary; this is a documented corner case.

### TC-4.16: Pre-1.0 override -- coercion is checked even when result is already non-major
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.2, FR-6.4; UC-2 step 6
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 0.1.0` and `[Unreleased]` `### Added`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Computed bump type" = `minor`
  3. Verify "New version" = `0.2.0`
  4. Verify bump-computation explanation notes pre-1.0 override was checked but did not coerce (rule was already minor)
- **Expected:** Per UC-2 step 6 the override is documented even when not coercive (transparency for audit).

### TC-4.17: Determinism -- same input produces same output
- **Category:** Semver Bump Algorithm
- **Covers:** FR-4.5, NFR-8; UC-3 (idempotent computation)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json 1.4.2` and stable `[Unreleased]` content
- **Test Steps:**
  1. Invoke `release-engineer`, capture structured summary -> SUMMARY-A
  2. Reset CHANGELOG and version-source to original state
  3. Invoke `release-engineer` again, capture summary -> SUMMARY-B
  4. Compare SUMMARY-A and SUMMARY-B (excluding the `YYYY-MM-DD` date field if invocations crossed midnight)
- **Expected:** Summaries are identical (modulo date stamp). Per FR-4.5 and NFR-8 the algorithm is deterministic.

---

## 5. CHANGELOG Manipulation

### TC-5.1: Rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.1; UC-2 step 8, UC-3 step 8
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `CHANGELOG.md` having `## [Unreleased]` followed by populated categories
- **Test Steps:**
  1. Invoke `release-engineer`
  2. `grep -nE "^## \\[X\\.Y\\.Z\\] - [0-9]{4}-[0-9]{2}-[0-9]{2}$" CHANGELOG.md` (with `X.Y.Z` resolved to the computed version)
  3. Verify the heading is exactly `## [X.Y.Z] - YYYY-MM-DD` (today's date in ISO 8601 format)
  4. Verify the originally-`[Unreleased]` body content is now under the renamed heading
- **Expected:** The `[Unreleased]` heading is renamed in place per FR-2.1.

### TC-5.2: Fresh empty `[Unreleased]` heading inserted above renamed section
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.1(c); UC-2 step 8, UC-3 step 8
- **Type:** Agent Runtime
- **Preconditions:** TC-5.1 fixture
- **Test Steps:**
  1. Invoke `release-engineer`
  2. `grep -nE "^## \\[Unreleased\\]$" CHANGELOG.md`
  3. Verify the line number of `## [Unreleased]` is LESS than the line number of `## [X.Y.Z] - YYYY-MM-DD`
  4. Verify the body between `## [Unreleased]` and `## [X.Y.Z]...` is empty (no category subheadings, no entries)
- **Expected:** Fresh empty `[Unreleased]` heading is inserted immediately above the renamed heading per FR-2.1(c).

### TC-5.3: Prior `[X.Y.Z]` sections preserved byte-for-byte
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.2; UC-3 (has prior `[1.4.2]`)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `CHANGELOG.md` containing populated `[Unreleased]` AND prior section `## [1.4.2] - 2026-03-15` with body content
- **Test Steps:**
  1. Take a sha256 hash of the body of section `[1.4.2] - 2026-03-15` (extract lines from heading to next `## [`) before invocation
  2. Invoke `release-engineer`
  3. Take a sha256 hash of the same section after invocation
  4. Compare hashes
- **Expected:** Hashes are identical. Prior released sections are byte-for-byte unchanged per FR-2.2.

### TC-5.4: CHANGELOG header preserved byte-for-byte
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.3; UC-3 postcondition
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `CHANGELOG.md` containing the standard Keep a Changelog header (title, description paragraph linking keepachangelog.com, semver note)
- **Test Steps:**
  1. Take a sha256 hash of all content from the file start to the first `## [` heading
  2. Invoke `release-engineer`
  3. Take a sha256 hash of the same range
- **Expected:** Hashes identical. The header is byte-for-byte preserved per FR-2.3 (parallel to Section 3 FR-2.8).

### TC-5.5: Release-notes file written at `.claude/release-notes-X.Y.Z.md`
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.4; UC-2 step 9, UC-3 step 9
- **Type:** Agent Runtime
- **Preconditions:** Fixture computing new version (e.g., 1.5.0) from populated `[Unreleased]`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. `test -f .claude/release-notes-1.5.0.md`
  3. Inspect file content; verify the body matches the renamed `[1.5.0]` section's body (category subheadings + entries)
  4. Verify the file does NOT include the `## [1.5.0] - YYYY-MM-DD` heading itself (only the body)
- **Expected:** File exists at `.claude/release-notes-1.5.0.md` containing only the body per FR-2.4. The intended use is `git tag -a v1.5.0 -F .claude/release-notes-1.5.0.md` per FR-6.5.

### TC-5.6: Release-notes file overwritten without prompting (FR-2.5)
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.5; flagged in UC coverage map (UC-15 partial)
- **Type:** Agent Runtime
- **Preconditions:** Fixture where `.claude/release-notes-1.5.0.md` ALREADY exists from a prior aborted run, containing stale marker `STALE-PRIOR-RUN-MARKER`; populated `[Unreleased]` will produce 1.5.0
- **Test Steps:**
  1. Place stale `.claude/release-notes-1.5.0.md` with the marker
  2. Invoke `release-engineer`
  3. `grep -c "STALE-PRIOR-RUN-MARKER" .claude/release-notes-1.5.0.md` -- expect 0
  4. Verify file content is fresh per the current `[Unreleased]` content
- **Expected:** Stale content is overwritten without prompting per FR-2.5. No appending or merging occurs (parallel to Section 4 FR-2.4 for `resources-pending.md`).

### TC-5.7: Release-notes file NOT deleted after writing (FR-2.6)
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.6; UC-10 (idempotency preserves prior file)
- **Type:** Agent Runtime
- **Preconditions:** TC-5.5 has run; `.claude/release-notes-1.5.0.md` exists
- **Test Steps:**
  1. Verify `.claude/release-notes-1.5.0.md` exists immediately after the agent returns
  2. Re-invoke `release-engineer` (which will return `no-op: no unreleased changes` since `[Unreleased]` is now empty)
  3. Verify `.claude/release-notes-1.5.0.md` STILL exists (the agent does NOT delete it)
- **Expected:** The release-notes file is a durable artifact per FR-2.6 (unlike Section 4's `resources-pending.md` temp file).

### TC-5.8: Agent does NOT commit (FR-2.7)
- **Category:** CHANGELOG Manipulation
- **Covers:** FR-2.7, design decision 10; UC-2 step 13
- **Type:** Agent Runtime
- **Preconditions:** Fixture with populated `[Unreleased]` and a clean working tree
- **Test Steps:**
  1. Verify `git status` shows a clean tree before invocation
  2. Invoke `release-engineer`
  3. After invocation, `git status` shows modified `CHANGELOG.md`, new `.claude/release-notes-X.Y.Z.md`, possibly new `.github/workflows/release.yml` -- but NO commits have been made
  4. `git log -1` shows the same HEAD as before invocation
- **Expected:** Files are written/modified but no commit is created. The agent has no `Bash` tool (TC-1.4) so it cannot invoke `git commit`. Per FR-2.7 commit responsibility is the developer's.

---

## 6. CI/CD Provisioning (GitHub Actions)

### TC-6.1: Multi-pattern detection -- prompt documents P1+P2+P3 (architect [STRUCTURAL] 3)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1; architect [STRUCTURAL] 3
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "P1|tag-trigger pattern" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "P2|body-path-correct" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  3. `grep -iE "P3|inline-extraction" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  4. `grep -iE "multi-pattern|fallback set" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** All four greps return >=1 match. The prompt documents the three-pattern fallback set per FR-5.1 and architect [STRUCTURAL] 3.

### TC-6.2: Outcome resolution documented -- P1 alone -> warning; P1+P2 -> correct; P1+P3 -> correct; no P1 -> ABSENT
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1 outcome resolution
- **Type:** Unit
- **Preconditions:** TC-6.1 passes
- **Test Steps:**
  1. `grep -iE "P1.*AND.*\\(P2.*OR.*P3\\)|P1.*\\+.*\\(P2.*OR.*P3\\)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. `grep -iE "P1.*neither.*P2.*nor.*P3.*present-but-warning" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  3. `grep -iE "P1.*does NOT match.*ABSENT" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** All three outcome rules are documented per FR-5.1.

### TC-6.3: Generated `release.yml` HTML traceability comment (line 1)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.2, AC-10; UC-2 step 11
- **Type:** Agent Runtime
- **Preconditions:** Fixture greenfield project (no `.github/workflows/release.yml`); populated `[Unreleased]`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. `head -1 .github/workflows/release.yml`
  3. Verify line 1 matches `<!-- generated by claude-code-sdlc release-engineer at YYYY-MM-DD -->` (today's date in ISO 8601)
- **Expected:** Line 1 is exactly the agent's traceability comment per FR-5.2 / AC-10.

### TC-6.4: Generated `release.yml` uses two-step `body_path` pattern (architect [STRUCTURAL] 4)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.2, AC-10; architect [STRUCTURAL] 4
- **Type:** Agent Runtime
- **Preconditions:** TC-6.3 has run
- **Test Steps:**
  1. `grep -nE "name: Strip v prefix from tag" .github/workflows/release.yml`
  2. `grep -nE "id: ver" .github/workflows/release.yml`
  3. `grep -nE 'echo "version=\\$\\{GITHUB_REF_NAME#v\\}" >> "\\$GITHUB_OUTPUT"' .github/workflows/release.yml`
  4. `grep -nE 'body_path: \\.claude/release-notes-\\$\\{\\{ steps\\.ver\\.outputs\\.version \\}\\}\\.md' .github/workflows/release.yml`
- **Expected:** All four greps return >=1 match. The generated workflow uses the two-step pattern per architect [STRUCTURAL] 4: dedicated step strips the `v` prefix and threads the result via step output into `body_path`.
- **Edge Cases:** TC-6.5 (negative test -- naive forms must NOT appear)

### TC-6.5: Generated `release.yml` does NOT use naive `${GITHUB_REF_NAME#v}` directly inside `body_path:` (architect [STRUCTURAL] 4 negative)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.2 (the explicit prohibition), AC-10; architect [STRUCTURAL] 4
- **Type:** Agent Runtime
- **Preconditions:** TC-6.3 has run
- **Test Steps:**
  1. `grep -nE 'body_path: .*\\$\\{GITHUB_REF_NAME#v\\}' .github/workflows/release.yml` -- expect 0 matches
  2. `grep -nE 'body_path: .*\\$\\{\\{ github\\.ref_name \\}\\}' .github/workflows/release.yml` -- expect 0 matches (naive github.ref_name with v prefix)
- **Expected:** Both greps return 0. The naive forms (which fail with "file not found" at workflow run time per Risk 5) MUST NOT appear in the generated template.

### TC-6.6: Provision new -- ABSENT case writes `release.yml`
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1 (ABSENT), FR-5.2, AC-10; UC-2 step 10-11
- **Type:** Agent Runtime
- **Preconditions:** Fixture greenfield with no `.github/workflows/`
- **Test Steps:**
  1. Verify `.github/workflows/` does not exist
  2. Invoke `release-engineer`
  3. `test -f .github/workflows/release.yml`
  4. Verify "CI/CD status" in structured summary = `provisioned new`
- **Expected:** File is created. Status = `provisioned new`. The `Write` tool creates parent directory tree as needed per FR-5.1.

### TC-6.7: Provision new -- `.github/workflows/` exists with unrelated workflows only (UC-2-EC1)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1 (ABSENT), FR-5.2, FR-5.6; UC-2-EC1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `.github/workflows/ci.yml` and `.github/workflows/lint.yml` (no tag-triggered release workflow)
- **Test Steps:**
  1. Take sha256 hashes of `ci.yml` and `lint.yml` before invocation
  2. Invoke `release-engineer`
  3. Verify `.github/workflows/release.yml` was created
  4. Take sha256 hashes of `ci.yml` and `lint.yml` after invocation
  5. Verify hashes unchanged
- **Expected:** New `release.yml` created alongside untouched unrelated workflows per FR-5.6.

### TC-6.8: Present-and-correct -- P1 + P2 (FR-5.3)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1, FR-5.3, FR-6.3; UC-3 step 10, UC-6
- **Type:** Agent Runtime
- **Preconditions:** Fixture with existing `.github/workflows/release.yml` containing `on: push: tags: ['v*.*.*']` AND `body_path: .claude/release-notes-${{ steps.ver.outputs.version }}.md`
- **Test Steps:**
  1. Take sha256 hash of `release.yml` before invocation
  2. Invoke `release-engineer`
  3. Take sha256 hash after invocation
  4. Verify hashes are identical
  5. Verify "CI/CD status" = `present-and-correct`
- **Expected:** No changes; status correctly identifies the workflow as agent-compatible per FR-5.3.

### TC-6.9: Present-and-correct -- P1 + P3 (inline extraction)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1 (P3), FR-5.3
- **Type:** Agent Runtime
- **Preconditions:** Fixture with existing `release.yml` containing `on: push: tags:` AND a `run:` step that extracts content from `CHANGELOG.md` directly (P3 pattern)
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "CI/CD status" = `present-and-correct`
  3. Verify `release.yml` is byte-for-byte unchanged
- **Expected:** P3 pattern qualifies as `present-and-correct` per FR-5.1 outcome resolution. Status reported correctly per FR-5.3.

### TC-6.10: Present-but-warning -- P1 alone (no P2, no P3)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1, FR-5.4, FR-6.3, FR-6.6; UC-7
- **Type:** Agent Runtime
- **Preconditions:** Fixture with existing `release.yml` containing `on: push: tags: ['v*.*.*']` AND `generate_release_notes: true` (P1 yes, P2 no, P3 no)
- **Test Steps:**
  1. Take sha256 hash of `release.yml` before invocation
  2. Invoke `release-engineer`
  3. Take sha256 hash after invocation
  4. Verify hashes identical (no modification)
  5. Verify "CI/CD status" includes `present-but-warning:` and identifies the body source it found
  6. Verify "Warnings" section contains the body-source warning
- **Expected:** No modification. Status = `present-but-warning` with explanatory reason per FR-5.4. Per UC-7 ("respecting an existing CI/CD configuration is more important than enforcing the SDLC's preferred body source").

### TC-6.11: Present-but-warning -- deprecated `actions/create-release@v1` (UC-12)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.4, FR-6.6; UC-12
- **Type:** Agent Runtime
- **Preconditions:** Fixture with existing `release.yml` using `actions/create-release@v1` (deprecated August 2022) without `body_path`
- **Test Steps:**
  1. Take sha256 hash before invocation
  2. Invoke `release-engineer`
  3. Take sha256 hash after invocation
  4. Verify hashes identical
  5. Verify "Warnings" includes deprecation notice and migration suggestion
- **Expected:** No modification. Warning surfaces deprecation context per UC-12. Recommended migration text references `softprops/action-gh-release@v2` and the two-step `body_path` pattern.

### TC-6.12: Idempotency -- re-run on agent-provisioned workflow yields `present-and-correct`
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.5, AC-10; UC-6
- **Type:** Agent Runtime
- **Preconditions:** Fixture where TC-6.6 has just run (agent provisioned `release.yml`); a new populated `[Unreleased]` is added (so the agent re-enters the full-sequence path)
- **Test Steps:**
  1. Take sha256 hash of `release.yml` from the prior run
  2. Add a new entry to `[Unreleased]` to drive a new release
  3. Invoke `release-engineer`
  4. Take sha256 hash of `release.yml` after the second run
  5. Verify hashes identical
  6. Verify "CI/CD status" = `present-and-correct` on the second run
- **Expected:** Per FR-5.5 idempotent re-run: agent's own provisioned workflow is detected as `present-and-correct` (the body-source check is authoritative; the HTML comment is a fast-path marker, not the criterion).

### TC-6.13: Workflow file unrelated to release-on-tag at `release.yml` path -- agent does NOT overwrite (UC-7-A1)
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1, FR-5.6, FR-6.3; UC-7-A1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `.github/workflows/release.yml` containing only `on: workflow_dispatch:` (no tag trigger; unrelated to release packaging)
- **Test Steps:**
  1. Take sha256 hash before invocation
  2. Invoke `release-engineer`
  3. Take sha256 hash after invocation
  4. Verify hashes identical
  5. Verify "CI/CD status" includes a warning about the unrelated `release.yml` file (e.g., `present-but-warning: existing release.yml file does not match release-on-tag pattern`)
- **Expected:** Per UC-7-A1 the agent does NOT overwrite. The structured summary surfaces the warning so the developer can rename or migrate.

### TC-6.14: Multi-pattern detection -- single quoted glob `'v*'`
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1 (P1 with single-quoted glob)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `release.yml` containing `tags: ['v*']` (single-quoted) plus `body_path: .claude/release-notes-...md`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify P1 pattern matches the single-quoted form
  3. Verify "CI/CD status" = `present-and-correct`
- **Expected:** P1 detection accepts both `'v*'` and `"v*"` per FR-5.1's pattern definition.

### TC-6.15: Multi-pattern detection -- unquoted `v*.*.*`
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1 (P1 with unquoted entry)
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `release.yml` having an unquoted YAML list entry `v*.*.*` under `tags:`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify P1 pattern matches the unquoted form
- **Expected:** P1 accepts unquoted `v*.*.*` per FR-5.1.

### TC-6.16: Multi-pattern detection scans BOTH `.yml` and `.yaml` extensions
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `.github/workflows/release.yaml` (with `.yaml` extension) containing the correct patterns
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "CI/CD status" = `present-and-correct` (the `.yaml` file is correctly detected)
- **Expected:** Per FR-5.1 both extensions are scanned.

### TC-6.17: Workflow generation uses `softprops/action-gh-release@v2`
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.2, AC-10
- **Type:** Agent Runtime
- **Preconditions:** TC-6.6 has run
- **Test Steps:**
  1. `grep -nE "uses: softprops/action-gh-release@v2" .github/workflows/release.yml`
- **Expected:** Match >=1. Per FR-5.2 the chosen action is `softprops/action-gh-release@v2` (popularity, active maintenance, `body_path` support).

### TC-6.18: Workflow generation includes `permissions: contents: write`
- **Category:** CI/CD Provisioning
- **Covers:** FR-5.2, FR-5.7
- **Type:** Agent Runtime
- **Preconditions:** TC-6.6 has run
- **Test Steps:**
  1. `grep -nE "permissions:" .github/workflows/release.yml`
  2. `grep -nE "contents: write" .github/workflows/release.yml`
- **Expected:** Both match >=1. Per FR-5.2 `permissions: contents: write` is granted (sufficient for the default `GITHUB_TOKEN` per FR-5.7; no PAT setup needed).

---

## 7. Output Contract -- Structured Summary

### TC-7.1: Ten labeled sections in order
- **Category:** Output Contract
- **Covers:** FR-6.1, AC-11; UC-2 step 12
- **Type:** Agent Runtime
- **Preconditions:** Fixture with populated `[Unreleased]` (non-no-op path)
- **Test Steps:**
  1. Invoke `release-engineer`, capture structured summary
  2. Verify the summary contains the following sections in order:
     - (a) Detected version source
     - (b) Current version
     - (c) Computed bump type
     - (d) New version
     - (e) Path to renamed CHANGELOG section
     - (f) Path to release-notes file
     - (g) CI/CD status
     - (h) Commands to run
     - (i) Warnings
     - (j) Bump computation explanation
- **Expected:** All ten sections present in this exact order per FR-6.1 / AC-11.

### TC-7.2: Detected-version-source line formats
- **Category:** Output Contract
- **Covers:** FR-6.2; UC-2, UC-3, UC-5
- **Type:** Agent Runtime
- **Preconditions:** Multiple fixtures
- **Test Steps:**
  1. Fixture A: `package.json` source -> verify "Detected version source" = `package.json`
  2. Fixture B: `Version source:` override -> verify "Detected version source" = `CLAUDE.md Version source: <path>`
  3. Fixture C: no source -> verify "Detected version source" = `(none -- fallback 0.1.0)` (exact string)
- **Expected:** All three formats per FR-6.2.

### TC-7.3: CI/CD status is exactly one of three values
- **Category:** Output Contract
- **Covers:** FR-6.3
- **Type:** Agent Runtime
- **Preconditions:** Three fixtures (ABSENT, present-and-correct, present-but-warning)
- **Test Steps:**
  1. ABSENT fixture -> "CI/CD status" = `provisioned new`
  2. P1+P2 fixture -> "CI/CD status" = `present-and-correct`
  3. P1-only fixture -> "CI/CD status" starts with `present-but-warning:` followed by reason
- **Expected:** All three values match exactly per FR-6.3.

### TC-7.4: Commands block format -- includes version-source placeholder line
- **Category:** Output Contract
- **Covers:** FR-6.5, AC-11
- **Type:** Agent Runtime
- **Preconditions:** Fixture with version source needing manual update
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Inspect "Commands to run" block (fenced shell block)
  3. Verify the first line is `<update version-source if needed per project tooling>`
  4. Verify the block contains `git add CHANGELOG.md .claude/release-notes-X.Y.Z.md .github/workflows/release.yml` (with `X.Y.Z` substituted)
  5. Verify the block contains `git commit -m "chore(core): release X.Y.Z"`
  6. Verify the block contains `git push`
  7. Verify the block contains `git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md`
  8. Verify the block contains `git push origin vX.Y.Z`
- **Expected:** All commands match FR-6.5 verbatim with `X.Y.Z` substituted for the new version.

### TC-7.5: Commands block omits `.github/workflows/release.yml` when status is `present-and-correct`
- **Category:** Output Contract
- **Covers:** FR-6.5; UC-3 step 11, UC-6 step 6
- **Type:** Agent Runtime
- **Preconditions:** Fixture with present-and-correct workflow
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify the `git add` line in commands block does NOT contain `.github/workflows/release.yml`
  3. Verify the `git add` line still contains `CHANGELOG.md` and `.claude/release-notes-X.Y.Z.md`
- **Expected:** Per FR-6.5: when CI/CD status is `present-and-correct` or `present-but-warning`, the `git add` line MUST omit the workflow file (the agent did not modify it).

### TC-7.6: Warnings section aggregates all warnings; `(none)` if no warnings
- **Category:** Output Contract
- **Covers:** FR-6.6
- **Type:** Agent Runtime
- **Preconditions:** Two fixtures (with warnings, without)
- **Test Steps:**
  1. Fixture with warnings (e.g., pre-1.0 coercion + multi-source) -> verify all warnings appear in the section
  2. Fixture without warnings (e.g., clean post-1.0 release with present-and-correct CI) -> verify "Warnings" section contains exactly the literal `(none)`
- **Expected:** Per FR-6.6 warnings are aggregated from FR-3.1, FR-3.2 (override fallback), FR-3.5 (pre-release suffix), FR-4.3 (uncategorized), FR-4.2 (pre-1.0 coercion), FR-5.4 (CI warning). Default `(none)` when no warnings.

### TC-7.7: Bump computation explanation cites observed categories and applied rule
- **Category:** Output Contract
- **Covers:** FR-6.4
- **Type:** Agent Runtime
- **Preconditions:** Multiple fixtures
- **Test Steps:**
  1. Fixture with Added only -> explanation cites Added non-empty + FR-4.1(b) -> minor
  2. Fixture with Removed pre-1.0 -> explanation cites Removed non-empty + FR-4.1(a) -> major + FR-4.2 coerced to minor
  3. Fixture with Fixed only -> explanation cites Fixed non-empty + FR-4.1(c) -> patch
- **Expected:** Per FR-6.4 the explanation lists which categories were non-empty and which rule fired.

### TC-7.8: No-op output is single-line `no-op: no unreleased changes`
- **Category:** Output Contract
- **Covers:** FR-1.3, FR-6.7; UC-1, UC-1-EC1, UC-10, UC-16
- **Type:** Agent Runtime
- **Preconditions:** Fixture with empty `[Unreleased]`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify the agent's output is EXACTLY the single-line string `no-op: no unreleased changes`
  3. Verify NONE of FR-6.1's ten labeled sections appear in the output
- **Expected:** Per FR-6.7 the no-op case bypasses the structured summary entirely. Output is exactly the literal string.

### TC-7.9: Version-source-already-bumped substitution per FR-6.5
- **Category:** Output Contract
- **Covers:** FR-6.5, AC-11; UC-15
- **Type:** Agent Runtime
- **Preconditions:** Fixture where `package.json` already at the computed new version (e.g., user pre-bumped) -- this is a defensive interpretation; the PRD allows the placeholder to be replaced with `# version source already at X.Y.Z`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. If the agent detects the version source already matches `X.Y.Z`, verify the placeholder line is replaced with `# version source already at X.Y.Z` per FR-6.5 / AC-11
  3. Otherwise (no detection), the placeholder remains unchanged -- both behaviors are PRD-permitted; the test verifies whichever is implemented
- **Expected:** Per FR-6.5 the optional substitution is supported. [TBD -- planner pins exact detection criteria]

---

## 8. Pipeline Integration -- `/merge-ready` Gate 9

### TC-8.1: `src/commands/merge-ready.md` adds `Gate 9: Release Packaging` section after Gate 8
- **Category:** Pipeline Integration
- **Covers:** FR-7.1, AC-3
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "Gate 9.*Release Packaging" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
  2. Identify line numbers of `## Gate 8` and `## Gate 9` headings
  3. Verify line(Gate 8) < line(Gate 9)
  4. Verify no `## Gate 10` heading exists (gate count is 10 by ordinal but Gate 9 zero-indexed is the last)
- **Expected:** Gate 9 section exists and is positioned after Gate 8 per FR-7.1 / AC-3. Gate 8 remains unchanged.

### TC-8.2: Gate 9 documentation references `release-engineer` agent by exact name
- **Category:** Pipeline Integration
- **Covers:** FR-7.1, AC-3, AC-17
- **Type:** Unit
- **Preconditions:** TC-8.1 passes
- **Test Steps:**
  1. Within the Gate 9 section of `src/commands/merge-ready.md`, `grep -E "release-engineer"`
  2. `grep -iE "FR-1\\.5|six.step sequence" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
  3. `grep -iE "FR-7\\.2|conditional.skip|SKIPPED" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
  4. `grep -iE "FR-6|structured summary" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
- **Expected:** All four greps return >=1 match within the Gate 9 section. Per FR-7.1 and AC-3.

### TC-8.3: Gate output table extended to 10 rows including Release Packaging
- **Category:** Pipeline Integration
- **Covers:** FR-7.4, NFR-9, AC-4
- **Type:** Unit
- **Preconditions:** TC-8.1 passes
- **Test Steps:**
  1. Locate the gate output table in `src/commands/merge-ready.md` (per PRD 6.6 line range 80-91 -- verify current location)
  2. Count rows in the table (excluding header row)
  3. Verify count = 10
  4. Verify the 10th row has gate name "Release Packaging" with status column accepting `PASS/FAIL/SKIPPED`
  5. `grep -iE "SKIPPED.*\\[Unreleased\\].*empty|SKIPPED legend" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md` -- SKIPPED legend below the table
- **Expected:** Table has 10 rows; 10th is Release Packaging with conditional-skip note. SKIPPED legend present per PRD 6.6 Gate-Count Propagation table.

### TC-8.4: Pre-flight comment at line 7 rewritten (Gate-count propagation)
- **Category:** Pipeline Integration
- **Covers:** FR-7.1, FR-7.3, NFR-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `sed -n '7p' /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md` (verify current line content)
  2. `grep -c "no \\`Gate 10\\` exists in iteration 1" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md` -- expect 0 (stale wording removed)
  3. `grep -iE "Gate 0 through Gate 9 now includes Gate 9|PRD Section 6|FR-7\\.1" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md` -- expect >=1 match (new wording)
  4. `grep -iE "pre-flight.*changelog-writer.*before Gate 0|NOT itself a gate" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
- **Expected:** The pre-flight comment is rewritten per PRD 6.6 Gate-Count Propagation table row 1. The pre-flight `changelog-writer` sync is documented as running before Gate 0 and not itself a gate.

### TC-8.5: README "9 quality gates" -> "10 quality gates" -- three locations
- **Category:** Pipeline Integration
- **Covers:** FR-7.4, NFR-9, AC-4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "9 quality gates" /Users/aleksandra/Documents/claude-code-sdlc/README.md` -- expect 0
  2. `grep -c "10 quality gates" /Users/aleksandra/Documents/claude-code-sdlc/README.md` -- expect at least 3
  3. `grep -nE "All 9 quality gates|All 10 quality gates" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Expected:** All three README locations updated per PRD 6.6 Gate-Count Propagation table.

### TC-8.6: `src/claude.md` "9 gates" / "Gate 8 is the last" updates
- **Category:** Pipeline Integration
- **Covers:** FR-7.4, NFR-9, AC-4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "9 gates" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect 0 (or only matches inside code blocks if any are legitimate)
  2. `grep -c "10 gates" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1
  3. `grep -iE "Gate 8 is the last" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect 0
  4. `grep -iE "Gate 9 is the last" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1
- **Expected:** Stale gate-count references swept; new ones in place per PRD 6.6 Gate-Count Propagation.

### TC-8.7: Gate 9 reports `SKIPPED` on empty `[Unreleased]`
- **Category:** Pipeline Integration
- **Covers:** FR-7.2; UC-1, UC-1-EC1, UC-10, UC-16
- **Type:** E2E
- **Preconditions:** Fixture with empty `[Unreleased]`
- **Test Steps:**
  1. Run `/merge-ready` against the fixture
  2. Inspect gate output table
  3. Verify Gate 9 row status = `SKIPPED` (NOT `PASS`, NOT `FAIL`)
  4. Verify the gate detail surfaces `no-op: no unreleased changes`
- **Expected:** Per FR-7.2 the gate is reported as SKIPPED with the no-op string surfaced.

### TC-8.8: Gate 9 reports `PASS` on populated `[Unreleased]`
- **Category:** Pipeline Integration
- **Covers:** FR-7.2; UC-2, UC-3, UC-4, UC-8, UC-9
- **Type:** E2E
- **Preconditions:** Fixture with populated `[Unreleased]`
- **Test Steps:**
  1. Run `/merge-ready` against the fixture
  2. Verify Gate 9 status = `PASS`
  3. Verify the structured summary is surfaced in the gate output
- **Expected:** Per FR-7.2.

### TC-8.9: Gate 9 reports `FAIL` on parse error
- **Category:** Pipeline Integration
- **Covers:** FR-7.2, FR-7.6; UC-2-E1, UC-11
- **Type:** E2E
- **Preconditions:** Fixture with malformed CHANGELOG (UC-11 duplicate `[Unreleased]` headings)
- **Test Steps:**
  1. Run `/merge-ready`
  2. Verify Gate 9 status = `FAIL` with failure message
  3. Verify earlier Gates 0-8 retain their original PASS/FAIL status (Gate 9 FAIL did NOT retroactively re-evaluate them per FR-7.6)
  4. Verify NO file mutations occurred (CHANGELOG byte-for-byte unchanged; no release-notes file written; no workflow file written)
- **Expected:** Gate 9 FAIL surfaces in gate output with the failure message; earlier gates unaffected per FR-7.6; partial-progress prevention per FR-1.5.

### TC-8.10: Pre-flight `changelog-writer` sync runs BEFORE Gate 9 (FR-7.3)
- **Category:** Pipeline Integration
- **Covers:** FR-7.3, AC-3; all UC preconditions
- **Type:** E2E
- **Preconditions:** Fixture with `.claude/rules/changelog.md` configured (so pre-flight sync runs); populated `[Unreleased]`
- **Test Steps:**
  1. Run `/merge-ready` with verbose tracing
  2. Verify the trace shows: pre-flight `changelog-writer` -> Gate 0 -> ... -> Gate 8 -> Gate 9
  3. Verify the order is preserved per FR-7.3
- **Expected:** Pre-flight sync runs first (non-blocking, not a gate); Gate 0-8 next; Gate 9 last per FR-7.3.

### TC-8.11: Gate 9 invoked exactly once per `/merge-ready` invocation (FR-7.5)
- **Category:** Pipeline Integration
- **Covers:** FR-7.5, AC-18; UC-10
- **Type:** E2E
- **Preconditions:** Fixture with populated `[Unreleased]`
- **Test Steps:**
  1. Run `/merge-ready` -> Gate 9 produces structured summary -> PASS
  2. Without committing, immediately re-run `/merge-ready`
  3. Verify second run reports Gate 9 as `SKIPPED` (because `[Unreleased]` is now empty after first run renamed entries to `[X.Y.Z]`)
- **Expected:** Per FR-7.5 / AC-18 idempotent natural-boundary re-run yields SKIPPED.

### TC-8.12: Gate 9 placement is independent of pre-flight sync result
- **Category:** Pipeline Integration
- **Covers:** FR-7.3, FR-1.4; Risk 11
- **Type:** E2E
- **Preconditions:** Fixture where pre-flight `changelog-writer` returns `no-op: not configured` (no `.claude/rules/changelog.md`); `[Unreleased]` is manually populated
- **Test Steps:**
  1. Run `/merge-ready`
  2. Verify pre-flight sync output shows `no-op: not configured` (non-blocking notice)
  3. Verify Gate 9 still runs and packages the manually-maintained `[Unreleased]`
- **Expected:** Per FR-1.4 / NFR-2: `release-engineer` is independent of `changelog-writer` rule presence. Gate 9 runs even when `changelog-writer` opts out.

---

## 9. Cross-file Consistency

### TC-9.1: Agent count -- `src/claude.md` Agency Roles table has new `release-engineer` row
- **Category:** Cross-file Consistency
- **Covers:** FR-8.1, AC-12, AC-17
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "release-engineer" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. Identify the Agency Roles table in `src/claude.md`
  3. Verify the `release-engineer` row appears at the end of the table
  4. Verify the Role column = "Release Engineer"
  5. Verify the Responsibility column references "Gate 9", "version bump", "CHANGELOG date stamp", "release-notes file", and "GitHub Actions release workflow provisioning"
- **Expected:** Per FR-8.1 / AC-12 the row is present at the end with the documented title and responsibility.

### TC-9.2: `src/claude.md` "16 agents" prose updated to "17 agents"
- **Category:** Cross-file Consistency
- **Covers:** FR-8.2, AC-12
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "16 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect 0
  2. `grep -c "17 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1
  3. `grep -c "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect 0
  4. `grep -c "17 specialized" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1
- **Expected:** All "16" agent-count prose references swept to "17" per FR-8.2.

### TC-9.3: Plan Critic prompt acknowledges Gate 9 (optional per FR-8.8)
- **Category:** Cross-file Consistency
- **Covers:** FR-8.8
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Locate the Plan Critic prompt section in `src/claude.md`
  2. `grep -iE "Gate 9|10 gates|release-engineer" <Plan Critic section>`
- **Expected:** [TBD -- planner pins whether iteration 2 adds Gate 9 awareness to the critic.] Per FR-8.8 the update is MAY (optional). If implemented, the critic notes Gate 9 in any merge-ready plan checks. If not implemented, existing critic checks (file-path verification, scope-reduction detection, wave validation) cover release-engineer's plan format adequately.

### TC-9.4: Cross-reference integrity -- `src/agents/release-engineer.md` exists per `src/claude.md` registration
- **Category:** Cross-file Consistency
- **Covers:** AC-17
- **Type:** Unit
- **Preconditions:** TC-9.1 passes
- **Test Steps:**
  1. The agent is registered in `src/claude.md` (per TC-9.1)
  2. `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** The registered agent's prompt file exists. No phantom path per AC-17.

### TC-9.5: Cross-reference integrity -- `src/commands/merge-ready.md` references `release-engineer` by exact name
- **Category:** Cross-file Consistency
- **Covers:** AC-17, AC-3
- **Type:** Unit
- **Preconditions:** TC-8.1 passes
- **Test Steps:**
  1. `grep -E "release-engineer" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
  2. Verify the match is by exact name (not "ReleaseEngineer" or "release_engineer")
- **Expected:** Exact-name reference per AC-17.

### TC-9.6: Cross-reference integrity -- release-notes file path consistent across structured summary template AND workflow template
- **Category:** Cross-file Consistency
- **Covers:** AC-17
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. In `src/agents/release-engineer.md`, locate the structured summary's "Path to release-notes file" template
  2. Locate the FR-5.2 workflow template in the prompt
  3. Verify both reference `.claude/release-notes-X.Y.Z.md` (structured summary) and `.claude/release-notes-${{ steps.ver.outputs.version }}.md` (workflow), which resolve to the same path at workflow run time
- **Expected:** Paths are consistent per AC-17.

### TC-9.7: README agent-table position -- `release-engineer` after `changelog-writer`/last
- **Category:** Cross-file Consistency
- **Covers:** FR-8.3
- **Type:** Unit
- **Preconditions:** TC-1.11 passes
- **Test Steps:**
  1. Extract the README agent table
  2. Identify line numbers of `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`
  3. Verify `release-engineer` is positioned at the end of the table (consistent with Agency Roles per FR-8.1 ordering)
- **Expected:** Per FR-8.3 placement consistent with Agency Roles table ordering (Gate 9 = last gate -> `release-engineer` at end).

---

## 10. Agent Count and Gate Count Propagation Audit

### TC-10.1: Agent Count Propagation -- enumerate every 16->17 location per PRD 6.6 table
- **Category:** Propagation Audit
- **Covers:** FR-8.2, FR-8.3, FR-8.5, AC-12, AC-13, AC-14
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "16 specialized|16 AI agents|16 agents|16 Agents|\\(16 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh /Users/aleksandra/Documents/claude-code-sdlc/README.md /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. Expect zero matches (all 16 references swept to 17)
  3. `grep -nE "17 specialized|17 AI agents|17 agents|17 Agents|\\(17 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh /Users/aleksandra/Documents/claude-code-sdlc/README.md /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  4. Expect at least the 8 locations enumerated in PRD 6.6 Agent Count Propagation table
- **Expected:** Step 2 returns 0; step 4 returns >=8 (5 install.sh banners + 2 README locations + N src/claude.md locations).

### TC-10.2: Gate Count Propagation -- enumerate every 9->10 location per PRD 6.6 table
- **Category:** Propagation Audit
- **Covers:** FR-7.4, NFR-9, AC-4
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "9 quality gates|9 gates|All 9|Gate 8 is the last" /Users/aleksandra/Documents/claude-code-sdlc/README.md /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. Expect zero matches (all stale gate-count references swept)
  3. `grep -nE "10 quality gates|10 gates|All 10|Gate 9 is the last" <same files>`
  4. Expect at least the 7 locations from PRD 6.6 Gate-Count Propagation table
- **Expected:** Step 2 = 0; step 4 >= 7. Per architect [STRUCTURAL] 7: gate-count propagation is verified separately from agent-count.

### TC-10.3: Plan Critic verifies BOTH agent-count and gate-count (architect [STRUCTURAL] 7)
- **Category:** Propagation Audit
- **Covers:** FR-8.8 (optional); architect [STRUCTURAL] 7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Locate the Plan Critic prompt in `src/claude.md`
  2. Verify the critic prompt references BOTH propagation enumerations (agent-count AND gate-count)
  3. [TBD -- if FR-8.8's optional update is not implemented in iteration 2, the existing critic's file-path-verification check covers this implicitly]
- **Expected:** Per architect [STRUCTURAL] 7 the critic verifies both counts. [TBD -- planner pins.]

### TC-10.4: Total install size -- `(N files copied)` banner reflects 17
- **Category:** Propagation Audit
- **Covers:** FR-8.5, AC-14
- **Type:** Installation
- **Preconditions:** Fresh install
- **Test Steps:**
  1. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --yes --local 2>&1 | tee install.log`
  2. `grep -E "\\(17 files copied|17 files installed" install.log`
- **Expected:** Banner reflects 17. [TBD -- exact banner wording per planner pinning of install.sh edits.]

---

## 11. Error & Edge Cases

### TC-11.1: Missing `CHANGELOG.md` -> `no-op: no unreleased changes` (UC-1-E1, UC-16)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.3, FR-7.2, AC-5; UC-1-E1, UC-16
- **Type:** Agent Runtime
- **Preconditions:** Fixture without `CHANGELOG.md` (e.g., the SDLC repo itself)
- **Test Steps:**
  1. Verify `CHANGELOG.md` does NOT exist
  2. Invoke `release-engineer`
  3. Verify output is exactly `no-op: no unreleased changes`
  4. Verify `CHANGELOG.md` was NOT created (the agent does not create it -- creation is `changelog-writer`'s responsibility per Section 3 FR-2.8)
  5. Verify no `.claude/release-notes-*.md` was created
  6. Verify `.github/workflows/` was not touched (no-op short-circuits before FR-5)
- **Expected:** Per UC-1-E1 / UC-16 / Dependency 19 the agent gracefully self-skips when CHANGELOG is absent.

### TC-11.2: Empty `[Unreleased]` skeleton with all six category headings -> SKIPPED (UC-1-A1)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.3, FR-7.2; UC-1-A1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `[Unreleased]` containing all six category subheadings (`### Added`, `### Changed`, `### Deprecated`, `### Removed`, `### Fixed`, `### Security`) but each followed by zero entries
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify output = `no-op: no unreleased changes`
  3. Verify `CHANGELOG.md` is byte-for-byte unchanged (skeleton headings preserved)
- **Expected:** Per UC-1-A1: presence of empty category subheading is NOT "non-empty"; the agent treats this as semantically empty and skips.

### TC-11.3: Whitespace-only body in `[Unreleased]` -> SKIPPED (UC-1-EC1)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.3; UC-1-EC1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `## [Unreleased]` followed by blank lines + trailing whitespace, then the next `## [` heading
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify output = `no-op: no unreleased changes`
- **Expected:** Whitespace-only is treated as empty per UC-1-EC1.

### TC-11.4: Malformed CHANGELOG -- no closing heading (UC-2-E1)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.5, FR-7.2, FR-7.6; UC-2-E1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `## [Unreleased]` but no subsequent `## [` heading and no end-of-file boundary parsable; OR a heading at unexpected level (e.g., `# [0.1.0]`)
- **Test Steps:**
  1. Take sha256 hash of `CHANGELOG.md` before invocation
  2. Invoke `release-engineer`
  3. Verify the agent emits a structured failure: `Gate 9 FAIL: cannot parse [Unreleased] section -- malformed CHANGELOG.md (no closing heading detected)`
  4. Take sha256 hash after invocation
  5. Verify hashes identical (no mutations)
  6. Verify no `.claude/release-notes-*.md` was written
  7. Verify no `.github/workflows/release.yml` was written
- **Expected:** Per UC-2-E1 the agent fails cleanly with no partial progress per FR-1.5. Gate 9 reports FAIL.

### TC-11.5: Multiple `[Unreleased]` sections -> FAIL (UC-11)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.5, FR-7.2, FR-7.6; UC-11
- **Type:** Agent Runtime
- **Preconditions:** Fixture with TWO `## [Unreleased]` headings (corruption from hand-edit, merge conflict, or buggy upstream tool)
- **Test Steps:**
  1. Take sha256 hash of `CHANGELOG.md` before invocation
  2. Invoke `release-engineer`
  3. Verify failure message: `Gate 9 FAIL: CHANGELOG.md contains multiple [Unreleased] sections (N=2 detected). Manual reconciliation required before release packaging can proceed.`
  4. Take sha256 hash after invocation
  5. Verify hashes identical
- **Expected:** Per UC-11 detection and clean failure with no mutations.

### TC-11.6: Version source unreadable -- override path resolves to directory (UC-5-E1)
- **Category:** Error & Edge Cases
- **Covers:** FR-3.2, FR-3.3; UC-5-E1
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `Version source: somedir/` override AND `somedir/` exists as a directory
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Warnings" includes "Version source: override path '<path>' is unreadable"
  3. Verify the agent falls back to FR-3.1 priority order, then FR-3.3 if needed
- **Expected:** Per UC-5-E1 the agent succeeds via fallback; warning surfaces.

### TC-11.7: Partial Gate 9 failure recovery -- CHANGELOG rewritten before CI/CD provisioning fails
- **Category:** Error & Edge Cases
- **Covers:** FR-1.5; UC postcondition (partial progress preserved)
- **Type:** Agent Runtime
- **Preconditions:** Fixture where `CHANGELOG.md` is writable but `.github/workflows/` write fails (e.g., directory permission denied)
- **Test Steps:**
  1. Take sha256 hashes of `CHANGELOG.md` and `.claude/release-notes-X.Y.Z.md` (before -- non-existent)
  2. Make `.github/workflows/` non-writable via filesystem permission (or simulate)
  3. Invoke `release-engineer`
  4. Verify the agent reports CI/CD provisioning failure
  5. Verify CHANGELOG has been rewritten (FR-2 succeeded)
  6. Verify release-notes file has been written (FR-2.4 succeeded)
  7. Verify `.github/workflows/release.yml` was NOT written
  8. Verify Gate 9 status = FAIL with the failure message
  9. Restore permissions
- **Expected:** Per FR-1.5: "If any step fails, the agent MUST report the failure and MUST NOT proceed to subsequent steps -- partial progress is preserved (e.g., a CHANGELOG rewrite that succeeded before a CI/CD provisioning failure remains on disk)."

### TC-11.8: User pre-bumped version source -- discrepancy detection (UC-15)
- **Category:** Error & Edge Cases
- **Covers:** FR-3.1, FR-4.1, FR-6.4, FR-6.6; UC-15
- **Type:** Agent Runtime
- **Preconditions:** Fixture with `package.json version: "1.5.0"` BUT the most recent CHANGELOG section is `[1.4.2]`; populated `[Unreleased]` with `### Added`
- **Test Steps:**
  1. Invoke `release-engineer`
  2. Verify "Current version" = `1.5.0` (the user's pre-bumped value)
  3. Verify "New version" = `1.6.0` (bump from 1.5.0)
  4. Verify "Warnings" includes a discrepancy notice (e.g., "current version 1.5.0 does not match the most recent CHANGELOG section [1.4.2]") -- [TBD: the PRD documents this as a defensive enhancement; planner pins whether implemented]
- **Expected:** Per UC-15 the agent uses the user-set 1.5.0 and bumps from it (NOT to it). The discrepancy is surfaced if the enhancement is implemented.

---

## 12. Iteration 2 Boundary (Out of Scope per 6.8)

### TC-12.1: No monorepo support -- single root version source assumed (6.8 item 1)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "monorepo|workspaces|lerna|nx|per-package" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. If matches present, verify they are framed as out-of-scope or as future work
- **Expected:** The prompt does NOT include monorepo logic. Per 6.8 item 1 monorepos are out of scope; if mentioned, only as out-of-scope notice.

### TC-12.2: No GitLab/Bitbucket/CircleCI provisioning (6.8 item 2)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 2
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "\\.gitlab-ci\\.yml|bitbucket-pipelines\\.yml|\\.circleci/config\\.yml|jenkins|azure pipelines|travis" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. Verify any matches are in out-of-scope context
- **Expected:** The prompt does not provision non-GitHub CI/CD. Per 6.8 item 2.

### TC-12.3: No automatic version-source bump (6.8 item 3)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 3, FR-3.4
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*Write.*(package\\.json|pyproject\\.toml|Cargo\\.toml|VERSION)|READ ONLY" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Match >=1. The prompt declares version-source files READ-ONLY per FR-3.4 and 6.8 item 3.

### TC-12.4: No `gh release create` execution (6.8 item 4)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 4, design decision 10
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*gh release create|never.*gh release" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
  2. Verify `Bash` tool is excluded (TC-1.4) -- mechanically prevents execution
- **Expected:** Per design decision 10 + 6.8 item 4: prompt prohibits + `tools` excludes `Bash`.

### TC-12.5: No automatic git tag annotation (6.8 item 5)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 5
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*(git tag -a|create.*tag)|never.*(git tag|create.*tag)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Per 6.8 item 5 the agent emits the tag command but does NOT execute it (the developer creates the tag).

### TC-12.6: No release notification (6.8 item 6)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 6
- **Type:** Unit
- **Preconditions:** TC-6.6 has run (workflow generated)
- **Test Steps:**
  1. `grep -iE "slack|email|notify|webhook" .github/workflows/release.yml`
- **Expected:** Zero matches. Per 6.8 item 6 the generated workflow has no notification integrations.

### TC-12.7: Pre-release suffix stripped, no RC support (6.8 item 7, FR-3.5)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 7, FR-3.5
- **Type:** Agent Runtime
- **Preconditions:** Re-uses TC-3.12 fixture
- **Test Steps:**
  1. (See TC-3.12)
- **Expected:** Pre-release suffix stripped per FR-3.5; bumped version is clean `X.Y.Z`. RC workflows out of scope per 6.8 item 7.

### TC-12.8: Hardcoded `softprops/action-gh-release@v2` (6.8 item 8)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 8
- **Type:** Agent Runtime
- **Preconditions:** TC-6.6 has run
- **Test Steps:**
  1. (See TC-6.17 -- verifies the action is hardcoded)
- **Expected:** The action choice is hardcoded; no customization template is offered per 6.8 item 8.

### TC-12.9: No release asset attachments (6.8 item 9)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 9
- **Type:** Agent Runtime
- **Preconditions:** TC-6.6 has run
- **Test Steps:**
  1. `grep -iE "files:|assets:|attach" .github/workflows/release.yml`
- **Expected:** Zero matches for asset-upload steps. Per 6.8 item 9 generated workflow is body-only.

### TC-12.10: No programmatic breaking-change detection from code diffs (6.8 item 10)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 10, FR-4.1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "code diff|static analysis|API.*compar" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Zero matches OR matches only in out-of-scope context. Per 6.8 item 10 detection is text-based on `[Unreleased]` only.

### TC-12.11: No automated `changelog-writer` re-trigger from Gate 9 (6.8 item 11)
- **Category:** Iteration 2 Boundary
- **Covers:** 6.8 item 11
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "re-invoke.*changelog-writer|re-trigger.*sync" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/release-engineer.md`
- **Expected:** Zero positive matches. Per 6.8 item 11 the pre-flight sync is the only sync hook in merge-ready.

---

## 13. PRD-Pinned Defensive Tests

### TC-13.1: SDLC repo self-skip -- Gate 9 reports SKIPPED (UC-16, Dependency 19)
- **Category:** PRD-Pinned Defensive
- **Covers:** Dependency 19; UC-16
- **Type:** E2E
- **Preconditions:** Run `/merge-ready` inside `/Users/aleksandra/Documents/claude-code-sdlc` itself (no `CHANGELOG.md`)
- **Test Steps:**
  1. Verify `/Users/aleksandra/Documents/claude-code-sdlc/CHANGELOG.md` does NOT exist
  2. Verify `/Users/aleksandra/Documents/claude-code-sdlc/.claude/rules/changelog.md` does NOT exist
  3. Run `/merge-ready` (or invoke release-engineer directly)
  4. Verify Gate 9 reports `SKIPPED`
- **Expected:** Per Dependency 19 the SDLC repo self-skips Gate 9 (parallel to Section 4 Dependency 11 and Section 5 Dependency 16).

### TC-13.2: Bundle test -- full ABSENT case end-to-end
- **Category:** PRD-Pinned Defensive
- **Covers:** UC-2 primary flow integration; AC-6, AC-10, AC-11, AC-18
- **Type:** E2E
- **Preconditions:** Greenfield fixture (no version source, no workflows, no prior CHANGELOG sections); populated `[Unreleased]` with `### Added`
- **Test Steps:**
  1. Run `/merge-ready` against the fixture
  2. Verify all 10 expected outcomes per UC-2 primary flow:
     - (a) `CHANGELOG.md` rewritten with `[0.2.0] - YYYY-MM-DD` heading
     - (b) Fresh empty `[Unreleased]` heading inserted above
     - (c) `.claude/release-notes-0.2.0.md` written
     - (d) `.github/workflows/release.yml` written with HTML traceability comment
     - (e) Workflow uses two-step `body_path` pattern
     - (f) Structured summary contains all 10 labeled sections
     - (g) "Detected version source" = `(none -- fallback 0.1.0)`
     - (h) Computed bump = minor; new version = 0.2.0
     - (i) "CI/CD status" = `provisioned new`
     - (j) Warnings include the fallback notice
- **Expected:** UC-2's full primary flow exercised end-to-end. Multiple ACs covered.

### TC-13.3: Bundle test -- full PRESENT-AND-CORRECT case end-to-end
- **Category:** PRD-Pinned Defensive
- **Covers:** UC-3 primary flow integration; AC-6, AC-7, AC-11
- **Type:** E2E
- **Preconditions:** Fixture with `package.json 1.4.2`, prior `[1.4.2]` section in CHANGELOG, populated `[Unreleased]` with Added+Fixed, agent-compatible `release.yml`
- **Test Steps:**
  1. Run `/merge-ready`
  2. Verify all 12 expected outcomes per UC-3 primary flow
- **Expected:** UC-3 primary flow exercised end-to-end.

### TC-13.4: Bundle test -- full PRESENT-BUT-WARNING case end-to-end
- **Category:** PRD-Pinned Defensive
- **Covers:** UC-7 primary flow integration; AC-6
- **Type:** E2E
- **Preconditions:** Fixture with `release.yml` using `generate_release_notes: true` (P1 yes, P2 no, P3 no)
- **Test Steps:**
  1. Run `/merge-ready`
  2. Verify Gate 9 PASS with present-but-warning status
  3. Verify warning surfaces in summary; `git add` line omits the workflow file
- **Expected:** UC-7 primary flow exercised end-to-end.

---

## 14. Cross-cutting Use Case Coverage Map

This section explicitly maps every UC scenario to its primary covering test case(s). The format mirrors the role-planner-test-cases coverage map.

| UC Scenario | Description | Covering TC(s) |
|-------------|-------------|----------------|
| UC-1 (primary) | Empty `[Unreleased]` skips Gate 9 | TC-7.8, TC-8.7, TC-11.2 |
| UC-1-A1 | All-six-categories empty skeleton | TC-11.2 |
| UC-1-E1 | `CHANGELOG.md` does not exist | TC-11.1 |
| UC-1-EC1 | Whitespace-only `[Unreleased]` body | TC-11.3 |
| UC-2 (primary) | First-ever release, greenfield | TC-13.2, TC-3.8 (fallback), TC-4.16 (pre-1.0 noted), TC-5.1, TC-5.2, TC-5.5, TC-6.6, TC-6.3 (HTML comment), TC-6.4 (two-step) |
| UC-2-A1 | `package.json` missing `version` field | TC-3.15 |
| UC-2-E1 | Malformed `[Unreleased]` (no closing heading) | TC-11.4 |
| UC-2-EC1 | Unrelated workflows in `.github/workflows/` | TC-6.7 |
| UC-3 (primary) | Subsequent release with `package.json` | TC-13.3, TC-3.2 (priority short-circuit), TC-5.3 (prior preserved), TC-6.8, TC-7.5 (commands omit workflow) |
| UC-3-A1 | `pyproject.toml` priority | TC-3.1 (priority enumeration), runtime variant of TC-13.3 |
| UC-3-A2 | `Cargo.toml` priority | TC-3.1, runtime variant of TC-13.3 |
| UC-3-A3 | `VERSION` plain file priority | TC-3.1, runtime variant of TC-13.3 |
| UC-3-A4 | git tag priority | TC-3.1, TC-3.6 (packed-refs path) |
| UC-3-E1 | No version source -> fallback 0.1.0 | TC-3.8 |
| UC-3-EC1 | Multiple version sources present | TC-3.3 |
| UC-4 (primary) | Pre-1.0 with `Removed` -> minor (override) | TC-4.4 |
| UC-4-EC1 | Pre-1.0 with `breaking` token | TC-4.4 + TC-4.9 (breaking trigger) + TC-4.16 (override applied) |
| UC-5 (primary) | `Version source:` override active | TC-3.4, TC-3.5 |
| UC-5-A1 | Override path missing | TC-3.9 |
| UC-5-A2 | Idempotent override (matches priority) | TC-3.11 |
| UC-5-E1 | Override path unreadable | TC-3.10, TC-11.6 |
| UC-6 (primary) | CI/CD present-and-correct | TC-6.8, TC-6.12 (idempotency) |
| UC-7 (primary) | CI/CD present-but-warning (auto-generated body) | TC-6.10, TC-13.4 |
| UC-7-A1 | Workflow file present but unrelated purpose | TC-6.13 |
| UC-8 (primary) | Patch bump (Fixed only) | TC-4.1 (PRD-pinned 0.3.7 + Fixed -> 0.3.8) |
| UC-8-E1 | `Removed` AND `Fixed` together -> major | TC-4.13 |
| UC-9 (primary) | Major bump post-1.0 (Removed or breaking) | TC-4.3 (PRD-pinned 1.2.3 + Removed -> 2.0.0), TC-4.9 |
| UC-10 (primary) | Idempotency -- re-run yields SKIPPED | TC-5.7, TC-8.11 |
| UC-11 (primary) | Two `[Unreleased]` sections (corruption) | TC-11.5 |
| UC-12 (primary) | Deprecated `actions/create-release@v1` | TC-6.11 |
| UC-13 (primary) | Project has packed git refs | TC-3.6, TC-3.7 |
| UC-14 (primary) | `breaking` keyword false-positive avoidance (word-boundary on "breaking news") | TC-4.15 |
| UC-14-EC1 | Substring `earthbreaking` -- no match | TC-4.14 |
| UC-15 (primary) | User pre-bumped version source | TC-11.8 |
| UC-16 (primary) | SDLC repo self-skip | TC-13.1 |

**Coverage status:** All 35 UC scenarios listed in `docs/use-cases/changelog-release-packaging_use_cases.md` map to at least one TC. (The user-stated scenario count of 38 may include the cross-cutting AC-12 through AC-17 entries listed in the Cross-Cutting section of the use-cases file -- TC-9.x and TC-10.x cover those.)

---

## 15. Acceptance Criteria Coverage Map

| AC | Description | Covering TC(s) |
|----|-------------|----------------|
| AC-1 | Agent file frontmatter | TC-1.1, TC-1.2, TC-1.3, TC-1.4 |
| AC-2 | Self-check first step | TC-1.5 |
| AC-3 | `merge-ready.md` Gate 9 added | TC-8.1, TC-8.2 |
| AC-4 | "9 gates" -> "10 gates" propagation | TC-8.3, TC-8.5, TC-8.6, TC-10.2 |
| AC-5 | Empty `[Unreleased]` -> no-op, no mutations | TC-7.8, TC-11.1, TC-11.2, TC-11.3, TC-13.1 |
| AC-6 | Populated `[Unreleased]` -> rename + insert + write release-notes + provision + summary | TC-13.2, TC-13.3, TC-13.4, TC-5.1, TC-5.2, TC-5.5, TC-6.6 |
| AC-7 (a) | `0.3.7 + Fixed-only -> 0.3.8` | TC-4.1 |
| AC-7 (b) | `0.3.7 + Added -> 0.4.0` | TC-4.2 |
| AC-7 (c) | `1.2.3 + Removed -> 2.0.0` | TC-4.3 |
| AC-7 (d) | `0.9.9 + Removed -> 0.10.0` (pre-1.0 override) | TC-4.4 |
| AC-7 (worked-examples-in-prompt) | Prompt contains all four worked examples | TC-4.5 |
| AC-8 | `tools` exclusion + NEVER list | TC-1.4, TC-2.1, TC-2.2, TC-2.3, TC-2.4 |
| AC-9 | `Version source:` override beats priority order | TC-3.4, TC-3.5 |
| AC-10 | Generated `release.yml` HTML comment + softprops + two-step body_path | TC-6.3, TC-6.4, TC-6.5, TC-6.17, TC-6.12 (idempotency) |
| AC-11 | Structured summary 10 sections + commands block | TC-7.1, TC-7.4, TC-7.9 |
| AC-12 | `src/claude.md` Agency Roles row + 17 prose | TC-9.1, TC-9.2 |
| AC-13 | README tagline + heading + agent table row + feature section | TC-1.10, TC-1.11, TC-1.12 |
| AC-14 | install.sh five banners | TC-1.8, TC-1.9 |
| AC-15 | install.sh copies `release-engineer.md` | TC-1.6, TC-1.7 |
| AC-16 | `templates/CLAUDE.md` Version source documentation updated | TC-1.13 |
| AC-17 | Cross-references valid (no phantom paths) | TC-9.4, TC-9.5, TC-9.6 |
| AC-18 | Idempotency verified (re-run -> SKIPPED) | TC-5.7, TC-8.11 |

**Coverage status:** All 18 ACs (counting AC-7 multi-part as parts (a)-(d) + worked-examples) have at least one dedicated TC.

---

## Ambiguity Flags

The following test cases are flagged `[TBD -- update after planner pins X]` because the PRD leaves details to the Tech Lead pinning step. The implementer SHOULD update these test cases after planner finalizes the implementation plan:

1. **TC-7.9** -- Exact substitution criterion for "version source already at X.Y.Z" placeholder swap. PRD allows substitution but does not pin the detection trigger; planner pins the heuristic.
2. **TC-9.3** -- Whether the Plan Critic prompt is updated for Gate 9 awareness. Per FR-8.8, this is MAY (optional). If implemented, the critic acknowledges Gate 9 in merge-ready plan checks; if not, existing checks suffice.
3. **TC-10.3** -- Plan Critic verification of BOTH agent-count and gate-count propagation. Architect [STRUCTURAL] 7 mandates; planner pins exact wording in critic prompt update (if any).
4. **TC-10.4** -- Exact `(N files copied)` install banner wording per planner pinning of install.sh edits.
5. **TC-11.8** -- Whether the version-source-vs-CHANGELOG discrepancy detection (UC-15) is implemented as a defensive enhancement. PRD documents this as a defensive consideration; planner pins.

## PRD Ambiguities Requiring Defensive Multi-Interpretation Tests

The following PRD ambiguities have been identified that may require defensive tests covering multiple valid interpretations until the planner pins a single behavior:

1. **`Version source:` override path resolution** -- FR-3.2 says path "MUST resolve to an existing file" but does not specify whether resolution is project-relative or absolute. TC-3.4 / TC-3.5 / TC-3.9 / TC-3.10 cover both cases by using project-root-relative paths. If absolute paths are needed, the planner pins the resolution algorithm and additional tests may be added.
2. **Workflow detection scope** -- FR-5.1 says "scan every file under `.github/workflows/` (any extension `.yml` or `.yaml`)" but does not specify whether subdirectories under `.github/workflows/` are scanned. Default interpretation: only top-level files (matches GitHub Actions execution model). TC-6.16 verifies extension scanning; subdirectory behavior is not currently tested. Planner pins if needed.
3. **Multi-`[Unreleased]` failure detection threshold** -- FR-1.5 + UC-11 require failure on TWO `[Unreleased]` sections. Behavior on three or more is presumed identical (same FAIL message with `N=3 detected`) but the PRD does not exhaustively pin. TC-11.5 covers N=2; planner may add coverage for N>=3.
4. **Pre-release suffix forms beyond `-beta.1` / `+sha.abc123`** -- FR-3.5 mentions these examples but the SemVer 2.0 grammar allows many forms. TC-3.12 (suffix) and TC-3.13 (build metadata) cover the documented patterns; defensive tests for `-rc.1`, `-alpha+exp.sha.5114f85`, etc., may be added by planner.
5. **`Bump computation explanation` exact format** -- FR-6.4 says it MUST list categories and rules but does not pin format (sentence vs. table vs. bullet list). TC-7.7 verifies semantic content but not exact format; planner pins if exact-format verification is needed.

---

## Defense-in-depth Anti-Drift Verification

Per the user-supplied requirement: "grep checks for `git push`/`git tag`/`gh release`/`npm publish` only inside fenced code blocks (user commands), NEVER in instructional prose":

- **TC-2.12** verifies all occurrences of those commands in `src/agents/release-engineer.md` appear inside fenced code blocks (FR-6.5 commands example).
- **TC-2.13** verifies no positive instructions to "execute", "run", or "invoke" those commands appear in instructional prose. All such mentions are framed as prohibitions per design decision 10.

These two TCs together provide the anti-drift mechanism: future prompt revisions cannot accidentally instruct the agent to execute a publish command without it appearing inside a code block (where it represents user-runnable text, not an agent instruction). This is a parallel to Section 4 / Section 5's defense-in-depth pattern, extended for the publish-command surface specific to release packaging.
