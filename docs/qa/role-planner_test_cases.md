# Test Cases: Role Planner -- Iteration 1 (On-Demand Role Expansion)

> Based on [PRD](../PRD.md) -- Section 5 and [Use Cases](../use-cases/role-planner_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, cross-reference integrity, and (for installer and agent-runtime tests) observable filesystem/process behavior by running shell commands and inspecting outputs.

**Canonical path casing:** The file `src/claude.md` is treated as the canonical casing per the architect's concern 6. On macOS APFS, `src/CLAUDE.md` resolves to the same inode. TCs use `src/claude.md` consistently.

**Architect findings incorporated (5 STRUCTURAL authorizations + 7 planner concerns):**
1. Frontmatter-extraction algorithm wording must appear identically in BOTH `src/agents/role-planner.md` AND `src/commands/bootstrap-feature.md` (Ruling 1a; TC-7.8)
2. Closed-vocabulary step labels: exactly 5 labels are valid: `Step 3.75: role-planner`, `Step 4: qa-planner`, `Step 5: planner`, `Step 6: implementation`, `Step 7: merge-ready` (Ruling 7; TC-4.10, TC-7.9)
3. Planner Process step 4 rewrite with sub-steps 4a (resources), 4b (roles), 4c (deletion of both temp files) (STRUCTURAL 1; TC-5.4, TC-5.5, TC-5.6)
4. Core-agent-enumeration markers `<!-- CORE-AGENT-ENUMERATION-START -->` + `<!-- CORE-AGENT-ENUMERATION-END -->` wrap the 16-agent list in `role-planner.md` (STRUCTURAL 2; TC-8.2)
5. Plan Critic core-slug collision MAJOR check in `src/claude.md` (STRUCTURAL 3; TC-12.3)
6. Overwrite annotation MANDATORY in `role-planner.md` (STRUCTURAL 4; TC-6.6)
7. Filename-prefix self-check MANDATORY in `role-planner.md` (STRUCTURAL 5; TC-2.9)

**Format TBD markers:** Several test cases are flagged `[TBD -- update after planner pins X]` because the PRD leaves one or more details to the Tech Lead (planner) pinning step. The full list appears in the Ambiguity Flags section at the end.

---

## 1. Installation & Setup

### TC-1.1: `src/agents/role-planner.md` file exists at the documented path
- **Category:** Installation & Setup
- **Covers:** FR-1.1, AC-1; UC-1 preconditions
- **Type:** Unit
- **Preconditions:** Feature is shipped; SDLC repo checked out at HEAD
- **Test Steps:**
  1. Run `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** Exit code 0 (file exists)
- **Edge Cases:** TC-1.2 (frontmatter), TC-1.5 (installer copies)

### TC-1.2: `src/agents/role-planner.md` frontmatter has required keys in correct shape
- **Category:** Installation & Setup
- **Covers:** FR-1.1, NFR-4, AC-1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. Read the frontmatter block (between the two leading `---` markers)
  2. `grep -E "^name: role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  3. `grep -E "^description:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  4. `grep -E "^tools:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  5. `grep -E "^model: opus" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** All four greps return at least one match each. `name` is exactly `role-planner`; `model` is exactly `opus` (per NFR-4).
- **Edge Cases:** TC-1.3 (tools list positively restricted), TC-1.4 (Bash excluded)

### TC-1.3: Tools list contains ONLY `Read`, `Write`, `Glob`, `Grep`
- **Category:** Installation & Setup
- **Covers:** FR-1.1, FR-5.7, AC-1, AC-14
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `tools:` line (or multi-line block) from `src/agents/role-planner.md`
  2. `grep -cE '"?Read"?' (tools value)` -- expect at least 1
  3. `grep -cE '"?Write"?' (tools value)` -- expect at least 1
  4. `grep -cE '"?Glob"?' (tools value)` -- expect at least 1
  5. `grep -cE '"?Grep"?' (tools value)` -- expect at least 1
  6. Confirm no tool name other than those four appears
- **Expected:** The tools field lists exactly the four allowed tools. No additional tools.
- **Edge Cases:** TC-1.4 (Bash/Edit/Web explicitly absent)

### TC-1.4: Tools list does NOT include `Bash`, `Edit`, `WebFetch`, `WebSearch`, `NotebookEdit`
- **Category:** Installation & Setup
- **Covers:** FR-5.6, FR-5.7, NFR-6, AC-14; UC-1 step 10
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `tools:` value from `src/agents/role-planner.md`
  2. `grep -cE '"?Bash"?' (tools value)` -- expect 0
  3. `grep -cE '"?Edit"?' (tools value)` -- expect 0
  4. `grep -cE '"?WebFetch"?' (tools value)` -- expect 0
  5. `grep -cE '"?WebSearch"?' (tools value)` -- expect 0
  6. `grep -cE '"?NotebookEdit"?' (tools value)` -- expect 0
- **Expected:** None of the five excluded tools appear. This mechanically enforces NFR-6 no-network and the defense-in-depth posture of FR-5.7.
- **Edge Cases:** TC-1.3

### TC-1.5: `install.sh` default install path copies `role-planner.md` into `~/.claude/agents/`
- **Category:** Installation & Setup
- **Covers:** FR-6.8, AC-9; UC-1 precondition
- **Type:** Installation
- **Preconditions:** Fresh user-level config; `~/.claude/agents/role-planner.md` does NOT exist before running installer
- **Test Steps:**
  1. `rm -f $HOME/.claude/agents/role-planner.md` (clean precondition)
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --yes --local`
  3. `test -f $HOME/.claude/agents/role-planner.md`
- **Expected:** Step 3 exits 0 -- the agent file is copied by the default install path via the `src/agents/*.md` glob at install.sh:202 (per FR-6.8).
- **Edge Cases:** TC-1.6 (total agent count), TC-1.7 (install.sh banners)

### TC-1.6: Installed agent count is 16 after install
- **Category:** Installation & Setup
- **Covers:** NFR-5, FR-6.8
- **Type:** Installation
- **Preconditions:** TC-1.5 passes
- **Test Steps:**
  1. Run `ls -1 $HOME/.claude/agents/*.md | grep -v "^ondemand-" | wc -l | tr -d ' '`
- **Expected:** Output equals `16`. Agent count rose from 15 (post-Section-4) to 16 with the addition of `role-planner`. On-demand files (prefix `ondemand-`) are excluded since they are NOT counted in the 16-core tally per NFR-5.
- **Edge Cases:** TC-1.7 (banners), TC-1.11 (ondemand files excluded from counts)

### TC-1.7: `install.sh` banner strings updated from "15" to "16" -- all five locations
- **Category:** Installation & Setup
- **Covers:** FR-6.7, AC-8
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  2. `grep -c "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  3. `grep -c "15 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  4. `grep -c "16 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  5. `grep -cE "\(15 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  6. `grep -cE "\(16 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  7. `grep -cE "(^|[^0-9])15([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/install.sh | tr -d ' '` -- total "15" agent-count references
  8. `grep -cE "(^|[^0-9])16([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/install.sh | tr -d ' '` -- total "16" agent-count references
- **Expected:**
  - Step 1: returns `0` (no stale "15 specialized")
  - Step 2: returns at least `1` (new tagline)
  - Step 3: returns `0` (no stale "15 AI agents")
  - Step 4: returns at least `1`
  - Step 5: returns `0` (no stale `(15 files`)
  - Step 6: returns at least `1`
  - Step 7: returns `0` for agent-count "15"s
  - Step 8: returns exactly `5` agent-count "16"s (the five banner locations per PRD 5.6 Agent Count Propagation table)
- **Edge Cases:** TC-1.8 (`--help` output)

### TC-1.8: `install.sh --help` output reports "16 specialized AI agents"
- **Category:** Installation & Setup
- **Covers:** FR-6.7, AC-8
- **Type:** Installation
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "16"`
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "15 specialized"`
- **Expected:** Step 1 returns at least `2` (the tagline line and the `WHAT GETS INSTALLED` block line both mention "16"); step 2 returns `0`.
- **Edge Cases:** TC-1.7

### TC-1.9: `README.md` "15" references updated to "16" -- exactly 2 locations
- **Category:** Installation & Setup
- **Covers:** FR-6.3, FR-6.4, AC-7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. `grep -c "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  3. `grep -c "The 15 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  4. `grep -c "The 16 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  5. `grep -nE "(^|[^0-9])15([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/README.md | wc -l | tr -d ' '` -- total standalone "15"
  6. `grep -nE "(^|[^0-9])16([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/README.md | wc -l | tr -d ' '` -- total standalone "16"
- **Expected:**
  - Step 1: returns `0` (no stale "15 specialized")
  - Step 2: returns at least `1`
  - Step 3: returns `0`
  - Step 4: returns at least `1`
  - Step 5: returns `0` agent-count "15"s; step 6 returns at least `2` agent-count "16"s (tagline and `## The 16 Agents` heading per PRD 5.6 table)
- **Edge Cases:** TC-1.10 (README agent table row), TC-1.11 (README feature section)

### TC-1.10: `README.md` includes a `role-planner` row in the agent table
- **Category:** Installation & Setup
- **Covers:** FR-6.5, AC-7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -n "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. Verify the match appears between the `resource-architect` row and the `qa-planner` row in the agent table
- **Expected:** `role-planner` appears in the `## The 16 Agents` table with a short role description, positioned after `resource-architect` and before `qa-planner` (pipeline order).

### TC-1.11: `README.md` has a feature section describing on-demand role expansion
- **Category:** Installation & Setup
- **Covers:** FR-6.6, AC-7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "on-demand|ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. `grep -iE "general-purpose" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  3. `grep -iE "mobile-dev|compliance-officer|information-researcher" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  4. `grep -iE "scope: on-demand" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Expected:** Each step returns at least 1 match. The feature section describes (a) the on-demand-vs-core distinction, (b) `ondemand-<slug>.md` + `scope: on-demand` conventions, (c) general-purpose subagent invocation pattern, (d) concrete examples.

### TC-1.12: `templates/rules/role-planner.md` does NOT exist
- **Category:** Installation & Setup
- **Covers:** FR-6.10; Plan-Critic-no-gap-flag
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `test ! -f /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/role-planner.md`
- **Expected:** Exit code 0 (file does NOT exist). `role-planner` is a global pipeline addition, not a per-project opt-in (same as resource-architect in Section 4).

---

## 2. Authority Boundaries

### TC-2.1: Agent prompt contains explicit "Authority Boundary" section
- **Category:** Authority Boundaries
- **Covers:** FR-5.1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "authority.boundary|PERMITTED|PROHIBITED" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** At least one match; the prompt contains an explicit Authority Boundary section with PERMITTED and PROHIBITED enumeration per FR-5.1.

### TC-2.2: Prohibition against writing to core agent files
- **Category:** Authority Boundaries
- **Covers:** FR-5.2; UC-1 step 9, UC-13-E1
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT (write|modify).*(~/.claude/agents|src/agents/\\*)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "without the.*ondemand-.*prefix" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt enumerates the core-agent-modification prohibition and explicitly mentions the `ondemand-` prefix distinction.

### TC-2.3: Prohibition against modifying settings.json
- **Category:** Authority Boundaries
- **Covers:** FR-5.3
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "settings\\.json" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** At least one match; prompt contains explicit prohibition on modifying `settings.json`.

### TC-2.4: Prohibition against modifying MCP configuration
- **Category:** Authority Boundaries
- **Covers:** FR-5.4
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "mcp\\.json|mcp add|mcp remove|claude mcp" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** At least one match; prompt contains explicit prohibition on modifying MCP configuration.

### TC-2.5: Prohibition against modifying secrets
- **Category:** Authority Boundaries
- **Covers:** FR-5.5
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "\\.env|envrc|secrets" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** At least one match; prompt contains explicit prohibition on modifying secrets.

### TC-2.6: Prohibition against network calls
- **Category:** Authority Boundaries
- **Covers:** FR-5.6, NFR-6; UC-1 step 10
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "no network|must not (make )?network|no.*HTTP|no.*fetch" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** At least one match; prompt declares no-network contract. Enforced at two levels: explicit prompt prohibition AND `tools` excluding `WebFetch`/`WebSearch`/`Bash`.

### TC-2.7: Prohibition against writing outside the two permitted directories
- **Category:** Authority Boundaries
- **Covers:** FR-5.8
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "\\.claude/roles-pending\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "~/\\.claude/agents/ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  3. `grep -iE "MUST NOT write.*outside" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt lists both permitted write targets (`.claude/roles-pending.md` and `~/.claude/agents/ondemand-<slug>.md`) and declares writes outside those targets are prohibited.

### TC-2.8: Prohibition against reading the scratchpad
- **Category:** Authority Boundaries
- **Covers:** FR-1.2 (scratchpad exclusion); UC-1 step 2
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "scratchpad" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. Verify any matches are in the context of NOT reading the scratchpad (e.g., "MUST NOT read `.claude/scratchpad.md`")
- **Expected:** At least one match and the context is a prohibition (NOT an instruction to read it), matching Section 4 FR-1.2's exclusion.

### TC-2.9: Filename-prefix self-check MANDATORY (architect STRUCTURAL 5)
- **Category:** Authority Boundaries
- **Covers:** FR-5.2, FR-5.8, FR-2.3; architect STRUCTURAL 5
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. `grep -iE "before every Write to.*~/\\.claude/agents/" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "filename.*begins with.*ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  3. `grep -iE "abort.*authority.boundary violation|authority-boundary violation" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt contains an explicit self-check instruction: "Before every Write to `~/.claude/agents/`, verify filename begins with `ondemand-`. If not, abort with authority-boundary violation." All three greps return at least 1. This is the architect STRUCTURAL 5 authorization.

### TC-2.10: Eight enumerated prohibitions all present in prompt
- **Category:** Authority Boundaries
- **Covers:** FR-5.1 through FR-5.8 consolidated
- **Type:** Unit
- **Preconditions:** TC-2.1 passes
- **Test Steps:**
  1. Verify presence of prohibitions addressing: (1) core-agent files, (2) `src/agents/*.md`, (3) `settings.json`, (4) MCP config, (5) `.env`/secrets, (6) `docs/PRD.md`, (7) `docs/use-cases/*`, (8) `docs/qa/*` / `.claude/plan.md` / `.claude/scratchpad.md`
  2. For each of the eight categories, `grep -iE <category-pattern> src/agents/role-planner.md` returns at least 1
- **Expected:** All eight prohibitions appear. The prompt MUST enumerate each target category (not combine into a single catch-all) so future revisions cannot accidentally collapse a specific prohibition into an ambiguous one.

### TC-2.11: Core-agent-overwrite prevention at filename level
- **Category:** Authority Boundaries
- **Covers:** FR-5.2, FR-2.3; UC-1-A1, UC-9
- **Type:** Unit
- **Preconditions:** TC-2.9 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT write.*~/\\.claude/agents/<non-ondemand|without.*ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "code-reviewer\\.md|planner\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt provides negative examples (e.g., "writing to `~/.claude/agents/code-reviewer.md` is strictly prohibited") so the agent cannot over-rely on pure string patterns.

---

## 3. Output Boundaries

### TC-3.1: Output boundary -- only roles, no external resources
- **Category:** Output Boundaries
- **Covers:** FR-4.3, AC-18; UC-3-A1, UC-4-A1, UC-10
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT recommend.*(MCP|cloud|API|third-party|library|framework|hardware)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "resource-architect.*scope|Section 4.*FR-4" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  3. `grep -iE "defer.*resources-pending\\.md|defer.*resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt explicitly enumerates the six external-resource categories as out-of-scope for role-planner AND explicitly defers them to resource-architect per FR-4.3.

### TC-3.2: Output boundary -- no new pipeline steps introduced
- **Category:** Output Boundaries
- **Covers:** FR-4.3, FR-4.4, architect Ruling 7
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*new pipeline step|MUST NOT.*introduce.*step" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. Verify that call-plan step labels are from the closed vocabulary (TC-4.10)
- **Expected:** The agent is limited to the existing 5-step vocabulary; it cannot invent a new "Step N" label.

### TC-3.3: Output boundary -- no core-agent modification
- **Category:** Output Boundaries
- **Covers:** FR-4.4, FR-5.2
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT recommend modifying core agent" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "OBSERVATION:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- permitted commentary form
- **Expected:** The prompt prohibits generating an `ondemand-<slug>.md` that overrides a core agent. OBSERVATION: prefix is documented as the permitted way to surface core-agent insufficiency observations (per FR-4.4).

### TC-3.4: Output boundary -- no helper/utility/meta roles
- **Category:** Output Boundaries
- **Covers:** FR-4.5; UC-9-EC1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MUST NOT.*helper|utility|meta-reviewer|everything-checker|workflow-structural" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** At least one match; the prompt prohibits workflow-structural roles (e.g., `meta-reviewer`, `everything-checker`) and insists recommendations be domain-specific.

### TC-3.5: Output boundary -- one role per distinct domain max
- **Category:** Output Boundaries
- **Covers:** FR-4.6; UC-4-EC1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "one role per.*domain|at most one role per" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "mobile-ios.*mobile-android|two platform-specific" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- should show as a negative example
- **Expected:** The prompt enforces FR-4.6 and provides the mobile-ios+mobile-android negative example.

### TC-3.6: Output boundary -- conservative count guidance (0-3)
- **Category:** Output Boundaries
- **Covers:** FR-4.7; UC-4 step 5
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "typically 0 to 3|0-3 roles|conservative" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "4\\+|four or more|over-recommend" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt contains conservative guidance ("typically 0 to 3 roles") and flags 4+ recommendations as signaling over-broad features.

### TC-3.7: Positive-example domains enumerated in prompt
- **Category:** Output Boundaries
- **Covers:** FR-4.1; UC-1 (mobile), UC-2 (compliance), UC-3 (research)
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -ciE "mobile|ios|android" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  2. `grep -ciE "HIPAA|compliance|regulated" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  3. `grep -ciE "accessibility|WCAG|VoiceOver" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  4. `grep -ciE "localization|i18n|internationalization" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  5. `grep -ciE "data.science|ML|modeling" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  6. `grep -ciE "embedded|hardware|signal.integrity" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  7. `grep -ciE "research|literature|academic" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  8. `grep -ciE "SEO|cryptography|legal" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1 for at least one
- **Expected:** The prompt enumerates the FR-4.1 positive-example domains so the agent has concrete templates when recognizing gaps in core coverage.

---

## 4. Output Format Canonicalization

### TC-4.1: `## Additional Roles` top-level heading in temp file
- **Category:** Output Format
- **Covers:** FR-2.2, AC-15; UC-1 step 7, UC-5 step 5
- **Type:** Agent Runtime
- **Preconditions:** A sample feature requiring at least one on-demand role is set up as fixture
- **Test Steps:**
  1. Invoke `role-planner` against the fixture via `/bootstrap-feature`-style context
  2. `head -1 .claude/roles-pending.md` -- verify first line is `## Additional Roles`
- **Expected:** First non-blank line is exactly `## Additional Roles`. No frontmatter, no meta-commentary above it.

### TC-4.2: Per-role block uses `####` heading
- **Category:** Output Format
- **Covers:** FR-2.2, AC-15 [TBD -- planner pins exact heading level]
- **Type:** Agent Runtime
- **Preconditions:** TC-4.1 produces a roles-pending file with at least one role
- **Test Steps:**
  1. `grep -cE "^####" .claude/roles-pending.md` -- count of per-role blocks
  2. `grep -cE "^### Role invocation plan$" .claude/roles-pending.md` -- subsection header uses `###`
- **Expected:** Per-role blocks use `####` heading (one level below the `### Role invocation plan` subsection, two levels below the `## Additional Roles` top section). Count equals the number of recommended roles. [TBD: if planner pins a different heading structure during implementation planning, update this TC accordingly; cross-ref TC in resource-architect suite for the same pattern.]

### TC-4.3: Five bold-labeled fields per role
- **Category:** Output Format
- **Covers:** FR-1.4, AC-15; UC-1 step 5
- **Type:** Agent Runtime
- **Preconditions:** TC-4.1 produces a roles-pending file with at least one role
- **Test Steps:**
  1. `grep -cE "\\*\\*Role title:\\*\\*" .claude/roles-pending.md` -- expect >=1 per role
  2. `grep -cE "\\*\\*Slug:\\*\\*" .claude/roles-pending.md`
  3. `grep -cE "\\*\\*Why:\\*\\*" .claude/roles-pending.md`
  4. `grep -cE "\\*\\*Pipeline step to invoke:\\*\\*" .claude/roles-pending.md`
  5. `grep -cE "\\*\\*Purpose at that step:\\*\\*" .claude/roles-pending.md`
- **Expected:** All five field labels appear at least once per recommended role. Counts are equal across the five (one set per role).

### TC-4.4: Slug matches `/^[a-z][a-z0-9-]*[a-z0-9]$/`
- **Category:** Output Format
- **Covers:** FR-1.4 (Slug field regex)
- **Type:** Agent Runtime
- **Preconditions:** TC-4.3 passes
- **Test Steps:**
  1. Extract each `**Slug:** <value>` line from `.claude/roles-pending.md`
  2. For each slug, verify it matches the regex `^[a-z][a-z0-9-]*[a-z0-9]$` (starts lowercase letter, contains lowercase/digits/hyphens, ends lowercase/digit)
- **Expected:** All emitted slugs pass the regex. Invalid slugs (e.g., `Mobile-Dev`, `_researcher`, `mobile-`) are rejected.

### TC-4.5: Summary line with count decomposition
- **Category:** Output Format
- **Covers:** FR-1.6; UC-1 step 6, UC-4 step 7, UC-5 step 5
- **Type:** Agent Runtime
- **Preconditions:** TC-4.1 passes
- **Test Steps:**
  1. `grep -nE "[0-9]+ roles? total" .claude/roles-pending.md` -- expect exactly 1
  2. `grep -nE "bootstrap-time invocation" .claude/roles-pending.md` -- expect exactly 1
  3. `grep -nE "implementation-time invocation" .claude/roles-pending.md` -- expect exactly 1
- **Expected:** One summary line near the top of the file reporting total count, bootstrap-time count (Steps 3.75, 4), and implementation-time count (Steps 5, 6, 7).

### TC-4.6: `## Role invocation plan` subsection exists
- **Category:** Output Format
- **Covers:** FR-2.2, AC-16; UC-1 step 7
- **Type:** Agent Runtime
- **Preconditions:** TC-4.1 passes
- **Test Steps:**
  1. `grep -cE "^### Role invocation plan$" .claude/roles-pending.md` -- expect exactly 1
- **Expected:** Exactly one `### Role invocation plan` subsection exists inside `## Additional Roles`. [TBD: if planner pins heading level as `##` or `####` during implementation, update the regex accordingly.]

### TC-4.7: Call plan entry per recommended role
- **Category:** Output Format
- **Covers:** FR-1.3, AC-16; UC-1 step 7
- **Type:** Agent Runtime
- **Preconditions:** TC-4.3 passes; `.claude/roles-pending.md` has N recommended roles
- **Test Steps:**
  1. Count per-role blocks (per TC-4.3)
  2. Count entries in the `## Role invocation plan` subsection
  3. Verify counts are equal
  4. Verify every slug in the body appears in the call plan
  5. Verify every slug in the call plan appears in the body
- **Expected:** No orphan slugs. Every recommended role has a call-plan entry; every call-plan entry has a body block.

### TC-4.8: Empty-roles case -- explicit "No additional roles required" body
- **Category:** Output Format
- **Covers:** FR-1.5, AC-11; UC-5
- **Type:** Agent Runtime
- **Preconditions:** Fixture is a pure-refactor feature with no domain gaps
- **Test Steps:**
  1. Invoke `role-planner`
  2. `grep -E "No additional roles required" .claude/roles-pending.md`
  3. `ls -1 $HOME/.claude/agents/ondemand-*.md 2>/dev/null | wc -l` -- count of ondemand files this bootstrap CREATED (compare pre/post)
  4. `grep -E "\\(no on-demand roles scheduled\\)" .claude/roles-pending.md` -- placeholder body for invocation plan per UC-5 step 5
- **Expected:** The file contains the explicit "No additional roles required" text; zero new `ondemand-*.md` files were created by this invocation; `## Role invocation plan` subsection exists with a placeholder.

### TC-4.9: Summary shows 0/0/0 when no roles recommended
- **Category:** Output Format
- **Covers:** FR-1.5, FR-1.6; UC-5 step 5
- **Type:** Agent Runtime
- **Preconditions:** TC-4.8 passes
- **Test Steps:**
  1. `grep -nE "0 roles total" .claude/roles-pending.md`
  2. `grep -nE "0 bootstrap-time invocation" .claude/roles-pending.md`
  3. `grep -nE "0 implementation-time invocation" .claude/roles-pending.md`
- **Expected:** All three greps return at least 1 match.

### TC-4.10: Closed-vocabulary step labels enumerated (architect Ruling 7)
- **Category:** Output Format
- **Covers:** FR-1.4 (Pipeline step field); architect Ruling 7
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -cE "Step 3\\.75: role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  2. `grep -cE "Step 4: qa-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  3. `grep -cE "Step 5: planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  4. `grep -cE "Step 6: implementation" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  5. `grep -cE "Step 7: merge-ready" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect >=1
  6. Verify the prompt explicitly labels this enumeration as the closed vocabulary (e.g., "Valid pipeline step labels are EXACTLY these 5")
- **Expected:** Exactly these five step labels are enumerated. The prompt declares this set closed; emitting a sixth label (e.g., "Step 42: nonexistent") is an authoring error. (Per architect Ruling 7 and UC-8-A2 silent-skip consequence.)

### TC-4.11: Emitted call plan uses only closed-vocabulary step labels
- **Category:** Output Format
- **Covers:** FR-1.4; architect Ruling 7 runtime enforcement
- **Type:** Agent Runtime
- **Preconditions:** TC-4.1 produces a roles-pending file with at least one role
- **Test Steps:**
  1. Extract all `**Pipeline step to invoke:**` values from `.claude/roles-pending.md`
  2. Verify every value is one of the 5 permitted labels (per TC-4.10)
  3. No value matches a "Step 42" or "Step 3: architect" (Step 3 is before role-planner; architect is not in the closed vocabulary)
- **Expected:** All emitted values are within the closed vocabulary. An extra-vocabulary label in the output is a regression.

### TC-4.12: No frontmatter, no agent-meta commentary in temp file
- **Category:** Output Format
- **Covers:** FR-2.2; UC-1 step 7
- **Type:** Agent Runtime
- **Preconditions:** TC-4.1 passes
- **Test Steps:**
  1. `head -1 .claude/roles-pending.md` -- first line is `## Additional Roles`, NOT `---`
  2. `tail -1 .claude/roles-pending.md` -- no "end of output" marker
  3. `grep -iE "end of output|agent complete|finished processing" .claude/roles-pending.md` -- expect 0
- **Expected:** File is a clean markdown fragment with no YAML frontmatter, no meta markers, no trailing signal.

---

## 5. Temp-file Lifecycle

### TC-5.1: `.claude/roles-pending.md` created at Step 3.75
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.1, AC-10; UC-1 step 7
- **Type:** Agent Runtime
- **Preconditions:** Clean project; invoke `/bootstrap-feature` from Step 3.75 context
- **Test Steps:**
  1. `test ! -f .claude/roles-pending.md` (precondition)
  2. Invoke `role-planner`
  3. `test -f .claude/roles-pending.md`
- **Expected:** Step 3 exits 0. File is created at the correct path.

### TC-5.2: Overwrite of stale `.claude/roles-pending.md`
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.4; UC-11, UC-11-E1
- **Type:** Agent Runtime
- **Preconditions:** `.claude/roles-pending.md` exists with stale content from a prior run
- **Test Steps:**
  1. Place stale content (e.g., `## Old Roles\nSTALE`) into `.claude/roles-pending.md`
  2. Invoke `role-planner`
  3. `grep -c "STALE" .claude/roles-pending.md` -- expect 0
  4. `head -1 .claude/roles-pending.md` -- expect `## Additional Roles`
- **Expected:** Stale content is fully overwritten. Not appended, not merged.

### TC-5.3: Corrupted stale `.claude/roles-pending.md` is cleanly overwritten
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.4; UC-11-E1
- **Type:** Agent Runtime
- **Preconditions:** `.claude/roles-pending.md` contains malformed/truncated content (e.g., partial YAML, unclosed markdown)
- **Test Steps:**
  1. Place truncated content: `\x00\x00broken`
  2. Invoke `role-planner`
  3. Verify the file now has valid `## Additional Roles` structure per TC-4.1 - TC-4.7
- **Expected:** Overwrite succeeds regardless of prior content validity. No parse or validation of prior content is required (per FR-2.4).

### TC-5.4: Planner Process step 4a reads resources-pending and inlines first (STRUCTURAL 1)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.6, FR-2.7, AC-5, AC-10; architect STRUCTURAL 1; UC-7
- **Type:** Unit
- **Preconditions:** `src/agents/planner.md` has been updated per FR-3.5
- **Test Steps:**
  1. `grep -nE "^[[:space:]]*-?[[:space:]]*4a[.):]|\\*\\*4a\\*\\*" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1 (sub-step 4a marker)
  2. `grep -iE "4a.*read.*\\.claude/resources-pending\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
  3. `grep -iE "Recommended Resources.*at the top|top of.*plan\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
- **Expected:** Sub-step 4a is explicitly labeled, reads `.claude/resources-pending.md`, and places the content as `## Recommended Resources` at the top of `.claude/plan.md`. Per architect STRUCTURAL 1.

### TC-5.5: Planner Process step 4b reads roles-pending AFTER resources (STRUCTURAL 1)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.6, FR-2.7, AC-5, AC-10; architect STRUCTURAL 1; UC-7, UC-7-A1
- **Type:** Unit
- **Preconditions:** TC-5.4 passes
- **Test Steps:**
  1. `grep -nE "^[[:space:]]*-?[[:space:]]*4b[.):]|\\*\\*4b\\*\\*" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1 (sub-step 4b marker)
  2. `grep -iE "4b.*read.*\\.claude/roles-pending\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
  3. `grep -iE "Additional Roles.*after.*Recommended Resources|after.*Recommended Resources.*Additional Roles" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
  4. `grep -iE "Additional Roles.*at the top|top of.*plan\\.md.*absent" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1 (absent fallback)
  5. `grep -iE "before.*Prerequisites verified" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
- **Expected:** Sub-step 4b reads `.claude/roles-pending.md`, places content as `## Additional Roles` AFTER `## Recommended Resources` (if present) or at the top (if absent), and BEFORE `## Prerequisites verified`. Per architect STRUCTURAL 1.

### TC-5.6: Planner Process step 4c mandates deletion of BOTH temp files on successful inline (STRUCTURAL 1)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.6, AC-13, NFR-9; architect STRUCTURAL 1; UC-7 step 7, UC-7-E2
- **Type:** Unit
- **Preconditions:** TC-5.5 passes
- **Test Steps:**
  1. `grep -nE "^[[:space:]]*-?[[:space:]]*4c[.):]|\\*\\*4c\\*\\*" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1 (sub-step 4c marker)
  2. `grep -iE "4c.*delete|mandatory deletion|MUST delete" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
  3. `grep -iE "delete.*resources-pending.*roles-pending|delete.*both" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md` -- expect >=1
- **Expected:** Sub-step 4c is explicit about deleting BOTH `.claude/resources-pending.md` AND `.claude/roles-pending.md` on successful inline. Per architect STRUCTURAL 1.

### TC-5.7: After a successful bootstrap, `.claude/roles-pending.md` does NOT exist
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.6, AC-13; UC-7 step 7
- **Type:** E2E
- **Preconditions:** A full bootstrap cycle runs through Step 5 (planner inline)
- **Test Steps:**
  1. Run `/bootstrap-feature` end-to-end on a fixture feature
  2. `test ! -f .claude/roles-pending.md`
- **Expected:** Exit code 0 on step 2. The planner has inlined and deleted the temp file per FR-2.6.

### TC-5.8: Legacy plan path -- planner silently skips when temp file is absent
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.6, NFR-2; UC-7-E1
- **Type:** Agent Runtime
- **Preconditions:** `.claude/roles-pending.md` does NOT exist; planner is invoked
- **Test Steps:**
  1. `test ! -f .claude/roles-pending.md`
  2. Invoke `planner` agent
  3. `grep -c "## Additional Roles" .claude/plan.md` -- expect 0
  4. Verify planner did NOT halt or report a warning for missing file
- **Expected:** Planner writes a plan without `## Additional Roles` section. No error. This is the backward-compat path per NFR-2.

### TC-5.9: Delete failure is non-blocking warning (UC-7-E2)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.4, FR-2.6, Risk 6; UC-7-E2
- **Type:** Agent Runtime
- **Preconditions:** `.claude/roles-pending.md` exists; filesystem simulated to reject delete
- **Test Steps:**
  1. Create `.claude/roles-pending.md` with valid role content
  2. Make directory `.claude/` temporarily disallow delete (chmod -w or equivalent -- implementation-specific setup)
  3. Invoke planner
  4. Verify `.claude/plan.md` contains valid `## Additional Roles` section
  5. Verify planner logged a warning about the delete failure
  6. Restore permissions
- **Expected:** Inline succeeds, delete fails with a warning (NOT an error halting bootstrap). Stale file persists until next overwrite (per FR-2.4).

---

## 6. On-demand Prompt Files

### TC-6.1: `~/.claude/agents/ondemand-<slug>.md` is written per recommended role
- **Category:** On-demand Prompt Files
- **Covers:** FR-1.7, FR-2.3, AC-12; UC-1 step 8, UC-4 step 9
- **Type:** Agent Runtime
- **Preconditions:** Fixture feature requires at least one on-demand role (e.g., UC-1 iOS fixture)
- **Test Steps:**
  1. `rm -f $HOME/.claude/agents/ondemand-*.md` (clean precondition for this fixture)
  2. Invoke `role-planner` on the fixture
  3. `ls -1 $HOME/.claude/agents/ondemand-*.md | wc -l` -- expect N matching the count of recommended roles
  4. For each emitted slug, verify `test -f $HOME/.claude/agents/ondemand-<slug>.md`
- **Expected:** One file per recommended slug. Filename prefix is `ondemand-`.

### TC-6.2: On-demand prompt file frontmatter has all required fields
- **Category:** On-demand Prompt Files
- **Covers:** FR-1.7, FR-2.3, AC-12; UC-1 step 8
- **Type:** Agent Runtime
- **Preconditions:** TC-6.1 passes
- **Test Steps:**
  1. For each generated `~/.claude/agents/ondemand-<slug>.md`:
  2. `grep -E "^name: ondemand-<slug>" <file>`
  3. `grep -E "^description:" <file>`
  4. `grep -E "^tools:" <file>`
  5. `grep -E "^model: opus" <file>`
  6. `grep -E "^scope: on-demand" <file>`
- **Expected:** All five frontmatter fields are present in every on-demand prompt file. `name` starts with `ondemand-`, `model` is `opus`, `scope` is `on-demand`.

### TC-6.3: On-demand prompt body is non-empty
- **Category:** On-demand Prompt Files
- **Covers:** FR-1.7, AC-12; UC-1 step 8, UC-8 precondition
- **Type:** Agent Runtime
- **Preconditions:** TC-6.1 passes
- **Test Steps:**
  1. For each on-demand prompt file, extract content AFTER the closing `---` frontmatter delimiter
  2. Verify body is non-empty and contains at least the sections: responsibility, inputs expected, output format, authority boundaries
- **Expected:** Body is non-empty. The minimum sections are present.

### TC-6.4: On-demand prompt tools do NOT include `Bash` by default
- **Category:** On-demand Prompt Files
- **Covers:** FR-1.7 minimum-tool guidance; UC-1 step 8
- **Type:** Agent Runtime
- **Preconditions:** TC-6.2 passes
- **Test Steps:**
  1. For each on-demand prompt file, extract `tools:` value
  2. `grep -cE '"?Bash"?' <tools-value>` -- expect 0 unless the role genuinely needs shell execution
  3. If `Bash` IS present, verify the frontmatter `description` documents the rationale
- **Expected:** Generated on-demand prompts default to `Read`, `Write`, `Grep`, `Glob`. `Bash` is permitted only with documented rationale in `description` (per FR-1.7). Note: iteration 1 is prompt-driven, not programmatically enforced (per 5.8 item 11).

### TC-6.5: Overwrite existing `ondemand-<slug>.md` is idempotent
- **Category:** On-demand Prompt Files
- **Covers:** FR-2.5, NFR-8 (idempotent overwrite); UC-6, UC-2-A1, UC-11
- **Type:** Agent Runtime
- **Preconditions:** `~/.claude/agents/ondemand-mobile-ios-dev.md` exists with prior content
- **Test Steps:**
  1. Place `~/.claude/agents/ondemand-mobile-ios-dev.md` with prior content containing marker `PRIOR-MARKER-XYZ`
  2. Invoke `role-planner` on an iOS-feature fixture
  3. `grep -c "PRIOR-MARKER-XYZ" ~/.claude/agents/ondemand-mobile-ios-dev.md` -- expect 0
  4. Verify file has fresh content per the current feature
- **Expected:** File is overwritten; no prior marker remains. FR-2.5 overwrite semantics hold. Iteration 1 does not preserve cross-feature customizations (per 5.8 item 2).

### TC-6.6: Overwrite annotation MANDATORY in body (architect STRUCTURAL 4)
- **Category:** On-demand Prompt Files
- **Covers:** FR-2.5; architect STRUCTURAL 4; UC-2-A1 step 4, UC-6 step 6
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MANDATORY.*Overwrote|Overwrote.*MANDATORY|if.*overwritten.*MUST.*annotate" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "Overwrote existing.*at <path>|Overwrote existing prompt file" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The prompt declares that if an existing `ondemand-<slug>.md` was overwritten, the `## Additional Roles` body MUST include an "Overwrote existing prompt file at <path>" annotation. Per architect STRUCTURAL 4: "MANDATORY" wording is required (not MAY / optional).

### TC-6.7: Overwrite annotation present in runtime output when overwriting
- **Category:** On-demand Prompt Files
- **Covers:** FR-2.5; architect STRUCTURAL 4 runtime enforcement; UC-2-A1
- **Type:** Agent Runtime
- **Preconditions:** `~/.claude/agents/ondemand-compliance-officer.md` already exists
- **Test Steps:**
  1. Prepopulate the file with placeholder content
  2. Invoke `role-planner` on a HIPAA fixture that will recommend `compliance-officer`
  3. `grep -iE "Overwrote existing.*ondemand-compliance-officer\\.md" .claude/roles-pending.md`
- **Expected:** The annotation appears in `.claude/roles-pending.md` per architect STRUCTURAL 4.

### TC-6.8: Persistence across sessions -- on-demand files are NOT deleted by planner
- **Category:** On-demand Prompt Files
- **Covers:** FR-2.8, NFR-10, AC-13; UC-7 step 7, UC-13
- **Type:** E2E
- **Preconditions:** A feature bootstrap creates `~/.claude/agents/ondemand-mobile-ios-dev.md`
- **Test Steps:**
  1. Run full `/bootstrap-feature` to completion (including planner inline)
  2. `test -f ~/.claude/agents/ondemand-mobile-ios-dev.md` -- expect exit 0
  3. `test ! -f .claude/roles-pending.md` -- expect exit 0 (temp file is deleted per FR-2.6)
- **Expected:** On-demand prompt files persist; temp file is deleted. Key contrast: temp file is transient, on-demand files are persistent.

### TC-6.9: Persistence across `/merge-ready`
- **Category:** On-demand Prompt Files
- **Covers:** FR-2.8, NFR-10; UC-13, 5.8 item 1
- **Type:** E2E
- **Preconditions:** TC-6.8 passes; feature has completed all slices
- **Test Steps:**
  1. Run `/merge-ready` on the feature branch
  2. `test -f ~/.claude/agents/ondemand-mobile-ios-dev.md` -- still exists
- **Expected:** On-demand files survive `/merge-ready`. No automatic teardown in iteration 1 (per 5.8 item 1).

### TC-6.10: Manual deletion is safe
- **Category:** On-demand Prompt Files
- **Covers:** FR-2.5, FR-2.8, NFR-10; UC-13
- **Type:** E2E
- **Preconditions:** An on-demand file exists
- **Test Steps:**
  1. `rm ~/.claude/agents/ondemand-<slug>.md`
  2. Start a new feature whose bootstrap will NOT recommend that slug
  3. Verify `/bootstrap-feature` succeeds and no errors surface
  4. Start a new feature whose bootstrap DOES recommend that slug
  5. Verify the file is regenerated (per FR-2.5 "create" path)
- **Expected:** Manual deletion is safe. The pipeline treats deletion and overwrite symmetrically.

---

## 7. Pipeline Integration

### TC-7.1: `src/commands/bootstrap-feature.md` contains Step 3.75
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, AC-2; UC-1 precondition
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "Step 3\\.75" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  2. `grep -iE "Role Planner recommendation" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
- **Expected:** Both greps return >=1 match. The step title is exactly "Role Planner recommendation".

### TC-7.2: Step 3.75 positioned between Step 3.5 and Step 4
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, FR-3.6, AC-2, AC-10
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. Extract line numbers of `Step 3.5`, `Step 3.75`, `Step 4` headings from `src/commands/bootstrap-feature.md`
  2. Verify `line(3.5) < line(3.75) < line(4)`
- **Expected:** Step 3.75 is textually positioned after Step 3.5 (resource-architect) and before Step 4 (qa-planner).

### TC-7.3: Step 3.75 is mandatory and non-skippable
- **Category:** Pipeline Integration
- **Covers:** FR-3.2, AC-3
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. `grep -iE "mandatory|non-skippable|MUST NOT skip|cannot.*skip" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  2. Verify context of the match is the Step 3.75 body
  3. `grep -iE "flag.*skip|heuristic.*skip" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` -- verify no skip-flag is offered
- **Expected:** Step 3.75 is declared mandatory. No skip flag documented.

### TC-7.4: Failure halts bootstrap at Step 3.75
- **Category:** Pipeline Integration
- **Covers:** FR-3.3, AC-3; UC-1-E1, UC-4-E1, UC-5-E1
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. `grep -iE "halt|MUST NOT proceed|bootstrap halts|report.*failure" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  2. Verify context is Step 3.75 failure handling
- **Expected:** The bootstrap command documents that a `role-planner` failure halts bootstrap; Step 4 MUST NOT run.

### TC-7.5: Step 3.5 preserved; Step 5.5 preserved
- **Category:** Pipeline Integration
- **Covers:** FR-3.5, FR-3.6, AC-10
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. `grep -cE "Step 3\\.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` -- expect >=1 (preserved from Section 4)
  2. `grep -iE "Resource Manager-Architect|resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  3. `grep -cE "Step 5\\.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` -- if present from prior iterations, MUST still be present
  4. `grep -cE "Step 4: QA|QA Lead" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` -- Step 4 is still QA
  5. `grep -cE "Step 5: planner|Step 5.*Tech Lead" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` -- Step 5 is still planner
- **Expected:** All prior steps and sub-steps are preserved. No renumbering occurred.

### TC-7.6: General-purpose invocation pattern documented in bootstrap-feature.md
- **Category:** Pipeline Integration
- **Covers:** FR-3.4, AC-4; UC-8
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. `grep -iE "subagent_type: general-purpose" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  2. `grep -iE "registered at session start|session start|cannot be invoked as.*ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  3. `grep -iE "extract.*prompt body|skip.*YAML frontmatter|skipping.*frontmatter" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
- **Expected:** All three greps match. The bootstrap-feature file documents: (a) why `subagent_type: ondemand-<slug>` cannot be used, (b) workaround with `subagent_type: general-purpose`, (c) frontmatter-extraction requirement.

### TC-7.7: Rationale for general-purpose pattern explicit in docs
- **Category:** Pipeline Integration
- **Covers:** FR-3.4, AC-4; UC-8 precondition
- **Type:** Unit
- **Preconditions:** TC-7.6 passes
- **Test Steps:**
  1. `grep -iE "registry.*fixed|subagent.*types.*registered.*startup|in-session.*without.*re-registration" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
- **Expected:** The rationale is documented (not just the mechanics). The developer reading bootstrap-feature.md understands WHY this pattern is required.

### TC-7.8: Frontmatter-extraction algorithm identical in two files (architect Ruling 1a)
- **Category:** Pipeline Integration
- **Covers:** FR-3.4, AC-4; architect Ruling 1a (STRUCTURAL)
- **Type:** Unit
- **Preconditions:** TC-1.1 and TC-7.6 pass
- **Test Steps:**
  1. Extract the frontmatter-extraction algorithm text from `src/agents/role-planner.md`:
     ```
     sed -n '/frontmatter-extraction algorithm/,/end of frontmatter-extraction algorithm/p' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md
     ```
     (or similar sentinel markers the implementer pins)
  2. Extract the same algorithm text from `src/commands/bootstrap-feature.md`
  3. Run `diff <(sed ...role-planner.md) <(sed ...bootstrap-feature.md)`
- **Expected:** `diff` produces zero output (empty). The algorithm text is BYTE-IDENTICAL across both files. Per architect Ruling 1a, any divergence is a CRITICAL finding. [TBD -- implementer pins the sentinel markers wrapping the algorithm block; update grep/sed patterns accordingly.]

### TC-7.9: Closed-vocabulary step labels appear in both role-planner.md AND bootstrap-feature.md (architect concern 1+2)
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, FR-3.4; architect Ruling 7 plus concerns 1-2
- **Type:** Unit
- **Preconditions:** TC-4.10 and TC-7.1 pass
- **Test Steps:**
  1. For each of the 5 closed-vocabulary step labels (TC-4.10), verify presence in `src/commands/bootstrap-feature.md`:
     - `grep -cE "Step 3\\.75: role-planner" src/commands/bootstrap-feature.md` -- expect >=1
     - `grep -cE "Step 4: qa-planner" src/commands/bootstrap-feature.md` -- expect >=1
     - `grep -cE "Step 5: planner" src/commands/bootstrap-feature.md` -- expect >=1
     - `grep -cE "Step 6: implementation" src/commands/bootstrap-feature.md` -- expect >=1
     - `grep -cE "Step 7: merge-ready" src/commands/bootstrap-feature.md` -- expect >=1
- **Expected:** The same closed vocabulary appears on both the output-specification side (`role-planner.md`) and the orchestrator-side contract (`bootstrap-feature.md` Step 3.75 body). Divergence is an authoring error.

### TC-7.10: `/develop-feature` is unchanged
- **Category:** Pipeline Integration
- **Covers:** FR-3.7
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `git log --oneline src/commands/develop-feature.md` -- no commits in this feature's branch modify it
  2. Or: `grep -c "role-planner" src/commands/develop-feature.md` -- expect 0 (no direct reference)
- **Expected:** `develop-feature.md` is untouched by this feature's implementation. Step 3.75 is inherited via the delegation to `/bootstrap-feature`.

### TC-7.11: End-to-end bootstrap produces plan.md with correct section ordering
- **Category:** Pipeline Integration
- **Covers:** FR-2.7, AC-10; UC-1 step 12, UC-7
- **Type:** E2E
- **Preconditions:** Fixture feature with both external resources AND on-demand roles (e.g., healthcare PRD with AWS resource recommendation)
- **Test Steps:**
  1. Run `/bootstrap-feature` end-to-end
  2. Extract line numbers of `## Recommended Resources`, `## Additional Roles`, `## Prerequisites verified` from `.claude/plan.md`
  3. Verify ordering: `line(Recommended Resources) < line(Additional Roles) < line(Prerequisites verified)`
- **Expected:** Section ordering in `.claude/plan.md` matches FR-2.7 and AC-10.

### TC-7.12: Plan.md section ordering when no resources (UC-7-A1 path)
- **Category:** Pipeline Integration
- **Covers:** FR-2.7; UC-7-A1
- **Type:** E2E
- **Preconditions:** Fixture feature with on-demand roles but NO external resources recommended
- **Test Steps:**
  1. Run `/bootstrap-feature` end-to-end
  2. `grep -c "## Recommended Resources" .claude/plan.md` -- expect 0 OR the section header with "No external resources required" body
  3. Extract line numbers of `## Additional Roles`, `## Prerequisites verified`
  4. Verify `## Additional Roles` appears BEFORE `## Prerequisites verified`
  5. If `## Recommended Resources` is absent (not even as a header), verify `## Additional Roles` is at the very top of plan.md
- **Expected:** Correct fallback positioning when resources are absent (per FR-2.7 "or at the very top").

---

## 8. Scope and Category Boundaries

### TC-8.1: Core-agent enumeration is present
- **Category:** Scope & Boundary
- **Covers:** FR-4.2, AC-19; UC-1 step 4, UC-9
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. For each of the 16 core agents, grep the name in `src/agents/role-planner.md`:
     - `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`
  2. `grep -c "<name>" src/agents/role-planner.md` -- expect >=1 for each
- **Expected:** All 16 core-agent names appear at least once. The enumeration is complete.

### TC-8.2: Core-agent-enumeration markers present (architect STRUCTURAL 2)
- **Category:** Scope & Boundary
- **Covers:** FR-4.2, AC-19; architect STRUCTURAL 2
- **Type:** Unit
- **Preconditions:** TC-8.1 passes
- **Test Steps:**
  1. `grep -cF "<!-- CORE-AGENT-ENUMERATION-START -->" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect exactly 1
  2. `grep -cF "<!-- CORE-AGENT-ENUMERATION-END -->" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect exactly 1
  3. Extract content between markers and verify all 16 agent names are present
  4. Verify the markers appear in order (START before END)
- **Expected:** Both sentinel markers are present exactly once and wrap the 16-agent list. Per architect STRUCTURAL 2, these markers enable automated verification that the enumeration is not drifted by future refactors.

### TC-8.3: Each core agent enumeration includes a responsibility description
- **Category:** Scope & Boundary
- **Covers:** FR-4.2, AC-19
- **Type:** Unit
- **Preconditions:** TC-8.2 passes
- **Test Steps:**
  1. Inside the sentinel-wrapped enumeration, verify each agent line matches pattern `<agent-name>.*<responsibility text>`
  2. Spot-check: `prd-writer.*requirements`, `test-writer.*TDD|tests`, `resource-architect.*external resources`, `role-planner.*itself.*on-demand`
- **Expected:** Each agent has a short responsibility description inline, supporting the CORE-VS-ON-DEMAND heuristic per FR-1.8.

### TC-8.4: No overlap with resource-architect's 6 resource categories
- **Category:** Scope & Boundary
- **Covers:** FR-4.3, AC-18; UC-3-A1, UC-4-A1, UC-10
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "MCP tool|cloud|external API|third-party|library|framework|hardware" src/agents/role-planner.md` -- verify matches are in the context of PROHIBITION (not recommendation)
  2. `grep -iE "MUST NOT recommend" src/agents/role-planner.md` -- expect >=1 and context covers all 6 categories
- **Expected:** The prompt explicitly prohibits recommending external resources in any of the 6 categories (MCP, cloud/compute, APIs, third-party services, libraries/frameworks, hardware). Per FR-4.3 and UC-10.

### TC-8.5: No duplication of core-16 agent responsibilities (overlap >50% drop rule)
- **Category:** Scope & Boundary
- **Covers:** FR-1.8, FR-4.2; UC-9
- **Type:** Unit
- **Preconditions:** TC-8.1 passes
- **Test Steps:**
  1. `grep -iE "overlap.*50|>50%|>=50|drop the recommendation" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `grep -iE "merge the concern.*context note|drop.*recommendation" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Expected:** The FR-1.8 overlap rule is documented in the prompt: >50% overlap requires DROP or MERGE (not new role).

### TC-8.6: Runtime check -- no emitted role duplicates a core agent responsibility
- **Category:** Scope & Boundary
- **Covers:** FR-1.8, FR-4.2; UC-9 runtime
- **Type:** Agent Runtime
- **Preconditions:** Fixture feature that tempts a duplicative recommendation (e.g., PRD says "needs thorough code review")
- **Test Steps:**
  1. Invoke `role-planner` on the fixture
  2. Verify no role in `.claude/roles-pending.md` has a slug that semantically duplicates a core agent (e.g., `test-coverage-analyst` duplicating `test-writer`, `meta-reviewer` collapsing multiple core agents)
  3. Slug collision check: verify no emitted slug literally matches a core-agent name
- **Expected:** No duplicative slug. The fixture case results in either UC-5 ("No additional roles required") or a domain-specific slug that complements core agents.

---

## 9. Orchestrator Invocation Pattern

### TC-9.1: Orchestrator reads `.claude/plan.md` and locates `## Role invocation plan`
- **Category:** Orchestrator Invocation
- **Covers:** FR-3.4, AC-4; UC-8 step 2
- **Type:** E2E
- **Preconditions:** `.claude/plan.md` exists with `## Additional Roles` + `## Role invocation plan`
- **Test Steps:**
  1. Simulate orchestrator at Step 4
  2. Verify orchestrator correctly extracts slugs at the current step from the call plan
- **Expected:** Orchestrator correctly identifies slugs scheduled at Step 4.

### TC-9.2: Orchestrator extracts prompt body skipping frontmatter
- **Category:** Orchestrator Invocation
- **Covers:** FR-3.4, AC-4; UC-8 step 6
- **Type:** E2E
- **Preconditions:** `~/.claude/agents/ondemand-<slug>.md` exists with valid frontmatter + body
- **Test Steps:**
  1. Simulate orchestrator reading the file
  2. Verify extracted body is content AFTER the closing `---` delimiter
  3. Verify frontmatter fields (name, description, tools, model, scope) are NOT in the extracted prompt
- **Expected:** Body-only extraction works correctly per the frontmatter-extraction algorithm (per TC-7.8).

### TC-9.3: Orchestrator spawns `subagent_type: general-purpose` (not ondemand-<slug>)
- **Category:** Orchestrator Invocation
- **Covers:** FR-3.4, AC-4, NFR-11; UC-8 step 7
- **Type:** E2E
- **Preconditions:** TC-9.2 passes
- **Test Steps:**
  1. Simulate orchestrator spawn
  2. Verify Task-tool invocation uses `subagent_type: general-purpose`
  3. Verify `prompt` parameter contains the extracted body
  4. Verify the spawn does NOT use `subagent_type: ondemand-<slug>`
- **Expected:** Spawn uses general-purpose type. Attempting `ondemand-<slug>` would fail with "unknown subagent type" per design decision 7.

### TC-9.4: Failure mode -- missing on-demand file surfaces warning (UC-8-E1 missing case)
- **Category:** Orchestrator Invocation
- **Covers:** FR-3.4, Risk 5; UC-8-E1 missing case
- **Type:** E2E
- **Preconditions:** Call plan references `ondemand-compliance-officer` but file was manually deleted
- **Test Steps:**
  1. `rm ~/.claude/agents/ondemand-compliance-officer.md`
  2. Simulate orchestrator at the invocation step
  3. Verify an error/warning is surfaced (NOT silently continued)
  4. Verify pipeline continues (non-blocking default per UC-8-E1)
- **Expected:** Warning surfaces; pipeline continues with the role's contribution missing.

### TC-9.5: Failure mode -- malformed frontmatter surfaces warning (UC-8-E1 corrupted case)
- **Category:** Orchestrator Invocation
- **Covers:** FR-3.4, Risk 5; UC-8-E1 corrupted case
- **Type:** E2E
- **Preconditions:** `~/.claude/agents/ondemand-compliance-officer.md` exists with malformed YAML
- **Test Steps:**
  1. Corrupt the file: remove the closing `---` delimiter
  2. Simulate orchestrator at the invocation step
  3. Verify warning surfaces about frontmatter extraction failure
  4. Verify pipeline continues
- **Expected:** Frontmatter-extraction failure is surfaced. Pipeline non-blocking.

### TC-9.6: On-demand tools unenforced at spawn time (UC-8-EC2)
- **Category:** Orchestrator Invocation
- **Covers:** FR-1.7, NFR-11, 5.8 item 3; UC-8-EC2
- **Type:** E2E
- **Preconditions:** `ondemand-<slug>.md` declares `tools: ["Read", "Grep"]` (restricted)
- **Test Steps:**
  1. Simulate orchestrator spawn
  2. Verify general-purpose subagent is spawned with its own tool set (NOT restricted by the on-demand's declared tools)
  3. Iteration 1 trust model: on-demand role's tools are documentation, not enforcement
- **Expected:** The on-demand role's `tools` field is documented but not mechanically enforced at the general-purpose spawn level. This is the iteration-1 trade-off per 5.8 item 3 and NFR-11.

### TC-9.7: Multiple on-demand roles at the same step are invoked serially (UC-8-EC1)
- **Category:** Orchestrator Invocation
- **Covers:** FR-1.6, FR-3.4; UC-8-EC1
- **Type:** E2E
- **Preconditions:** Call plan has two entries both at `Step 6: implementation`
- **Test Steps:**
  1. Simulate orchestrator at Step 6
  2. Verify both on-demand roles are spawned (serially in iteration 1)
  3. Verify failures in one do not halt the other
- **Expected:** Both spawns occur; non-blocking between them.

### TC-9.8: Call plan with unknown step label -- silent skip (UC-8-A2)
- **Category:** Orchestrator Invocation
- **Covers:** 5.8 item 4; UC-8-A2
- **Type:** E2E
- **Preconditions:** Call plan entry uses an invalid step label (e.g., "Step 42: nonexistent")
- **Test Steps:**
  1. Construct a plan.md with an entry `Step 42: nonexistent`
  2. Run the pipeline
  3. Verify no pipeline step matches Step 42
  4. Verify the on-demand role is never spawned
  5. Verify no error is raised (silent skip per iteration 1)
- **Expected:** Silent skip. Iteration 2 may add schema validation per 5.8 item 4.

---

## 10. Cross-file Consistency

### TC-10.1: Agent name match across files
- **Category:** Cross-file Consistency
- **Covers:** AC-20; FR-6.1
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -E "^name: role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md` -- expect 1
  2. `grep -nE "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1 (Agency Roles row)
  3. `grep -nE "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` -- expect >=1
  4. `grep -nE "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/README.md` -- expect >=1
- **Expected:** The exact name `role-planner` (no variants like `role_planner`, `Role-Planner`, `RolePlanner`) appears consistently.

### TC-10.2: Agency Roles table row ordered between resource-architect and qa-planner
- **Category:** Cross-file Consistency
- **Covers:** FR-6.1, AC-6
- **Type:** Unit
- **Preconditions:** TC-10.1 passes
- **Test Steps:**
  1. Extract line numbers of the `resource-architect` row, `role-planner` row, `qa-planner` row from `src/claude.md` Agency Roles table
  2. Verify `line(resource-architect) < line(role-planner) < line(qa-planner)`
- **Expected:** Correct ordering matches pipeline order (Step 3.5 → 3.75 → 4).

### TC-10.3: Closed-vocabulary step labels identical across files (architect concerns 1+2)
- **Category:** Cross-file Consistency
- **Covers:** architect Ruling 7 applied at the file-pair level; UC-8, UC-8-A2
- **Type:** Unit
- **Preconditions:** TC-4.10 and TC-7.9 pass
- **Test Steps:**
  1. Extract the 5 closed-vocabulary step labels from `src/agents/role-planner.md`
  2. Extract the same 5 labels from `src/commands/bootstrap-feature.md`
  3. Verify set equality: both files enumerate EXACTLY these 5 labels, same wording
- **Expected:** Label text is byte-identical across the two files. A 6th label in either file (e.g., invented "Step 8: deployment") signals drift.

### TC-10.4: Plan Critic bullet mirrors resource-architect pattern
- **Category:** Cross-file Consistency
- **Covers:** FR-6.9, AC-17; UC-7-EC1, UC-12
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "## Recommended Resources" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- Plan Critic section (should already exist per Section 4 FR-6.7)
  2. `grep -nE "## Additional Roles" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- Plan Critic section (new per FR-6.9)
  3. Verify both bullets appear within the Plan Critic prompt section of `src/claude.md`
  4. Verify the shape mirrors: "absence NOT a finding; malformed entries MAY be MINOR"
- **Expected:** The Plan Critic has both bullets, mirrored in wording and posture.

### TC-10.5: Agent count consistency across documentation (15→16 propagation)
- **Category:** Cross-file Consistency
- **Covers:** FR-6.2, FR-6.3, FR-6.4, FR-6.7, NFR-5
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Total "15" agent-count references across `install.sh`, `README.md`, `src/claude.md`: should be 0
  2. Total "16" agent-count references: install.sh: 5; README: 2; src/claude.md: depends on prose content
  3. `grep -c "15 agents\|15 AI\|15 specialized\|The 15 Agents" install.sh README.md src/claude.md` -- expect 0
  4. `grep -c "16 agents\|16 AI\|16 specialized\|The 16 Agents" install.sh README.md src/claude.md` -- expect >=7
- **Expected:** No stale "15" references; all locations updated to "16".

### TC-10.6: Cross-references valid (no phantom paths)
- **Category:** Cross-file Consistency
- **Covers:** AC-20
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
  2. `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  3. `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md`
  4. `grep -oE "\\.claude/roles-pending\\.md" src/agents/role-planner.md` -- consistent path
  5. `grep -oE "\\.claude/roles-pending\\.md" src/agents/planner.md` -- same path
  6. `grep -oE "\\.claude/roles-pending\\.md" src/commands/bootstrap-feature.md` -- same path
- **Expected:** All referenced paths exist (no phantom files); the temp-file path string is byte-identical across the three files.

---

## 11. Iteration 1 Boundary

### TC-11.1: No automatic teardown of on-demand files in any command
- **Category:** Iteration 1 Boundary
- **Covers:** FR-2.8, NFR-10, 5.8 item 1; UC-13
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "rm.*ondemand-|delete.*ondemand-|teardown.*role" src/commands/merge-ready.md` -- expect 0
  2. `grep -iE "rm.*ondemand-|delete.*ondemand-|teardown.*role" src/commands/implement-slice.md` -- expect 0
  3. `grep -iE "rm.*ondemand-|delete.*ondemand-|teardown.*role" src/commands/bootstrap-feature.md` -- expect 0
  4. `grep -iE "rm.*ondemand-|delete.*ondemand-|teardown.*role" src/agents/planner.md` -- expect 0
- **Expected:** No command or agent deletes on-demand files. Manual cleanup only (per 5.8 item 1).

### TC-11.2: No cross-feature reuse optimization in role-planner.md
- **Category:** Iteration 1 Boundary
- **Covers:** 5.8 item 2, FR-2.5
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. `grep -iE "cross-feature reuse|skip.*if.*already exists|reuse.*prior feature" src/agents/role-planner.md` -- expect the phrase appears ONLY in the context of "OUT OF SCOPE" / "deferred"
  2. Verify overwrite semantics (FR-2.5) are documented, not reuse detection
- **Expected:** Prompt explicitly marks reuse optimization as out of scope; overwrite is the deliberate iteration-1 behavior.

### TC-11.3: No session re-registration logic in any file
- **Category:** Iteration 1 Boundary
- **Covers:** 5.8 item 3, NFR-11
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "re-register|session.restart|registry.*mutation" src/agents/role-planner.md src/commands/bootstrap-feature.md` -- matches appear ONLY as negative examples
  2. Verify the general-purpose pattern (not re-registration) is the declared mechanism
- **Expected:** Session re-registration is disclaimed. General-purpose spawning is used (per NFR-11).

### TC-11.4: No call-plan programmatic validation
- **Category:** Iteration 1 Boundary
- **Covers:** 5.8 item 4; UC-8-A2
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "validate.*call plan|schema.check.*step labels|reject.*unknown step" src/commands/bootstrap-feature.md` -- matches appear ONLY in "OUT OF SCOPE" context
  2. `grep -iE "silently fails|silent skip" src/commands/bootstrap-feature.md` -- documents the iteration-1 behavior
- **Expected:** Programmatic validation explicitly deferred. Silent-skip is the documented iteration-1 behavior.

### TC-11.5: `/merge-ready` does not re-check role needs
- **Category:** Iteration 1 Boundary
- **Covers:** 5.8 item 6, NFR-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "role-planner|roles-pending" src/commands/merge-ready.md` -- expect 0 (no re-check)
- **Expected:** `merge-ready` does not invoke role-planner. One-shot per bootstrap (per NFR-9).

---

## 12. Plan Critic Integration

### TC-12.1: Plan Critic recognizes `## Additional Roles` presence
- **Category:** Plan Critic Integration
- **Covers:** FR-6.9, AC-17; UC-7-EC1, UC-12
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "## Additional Roles" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1 in the Plan Critic section
  2. Verify context: the bullet says presence is NOT a finding (i.e., "do NOT flag presence" or equivalent)
- **Expected:** Plan Critic prompt has the recognition bullet. Per AC-17.

### TC-12.2: Plan Critic does not flag absence of `## Additional Roles` for legacy plans
- **Category:** Plan Critic Integration
- **Covers:** FR-6.9, NFR-2; UC-7-EC1, UC-12
- **Type:** Unit
- **Preconditions:** TC-12.1 passes
- **Test Steps:**
  1. `grep -iE "absence.*not.*finding|absence.*NOT.*finding|legacy plans" src/claude.md` -- in Plan Critic section; expect >=1
- **Expected:** Plan Critic prompt explicitly states absence is not a finding (for backward compat per NFR-2).

### TC-12.3: Core-slug collision MAJOR check (architect STRUCTURAL 3)
- **Category:** Plan Critic Integration
- **Covers:** FR-1.8, FR-4.2, FR-6.9; architect STRUCTURAL 3; UC-1-A1, UC-9
- **Type:** Unit
- **Preconditions:** TC-12.1 passes
- **Test Steps:**
  1. `grep -iE "per-role slug.*core 16|per-role slug.*matches.*core" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- expect >=1
  2. `grep -iE "flag MAJOR|MAJOR finding" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` -- verify context is the Additional Roles bullet
  3. Combined grep: `grep -iE "## Additional Roles.*MAJOR|MAJOR.*## Additional Roles|slug.*core.*MAJOR" src/claude.md`
- **Expected:** The Plan Critic `## Additional Roles` bullet contains a clause: "If per-role slug matches core 16 agent name -- flag MAJOR". Per architect STRUCTURAL 3. Verifies via grep for "If per-role slug matches core 16 agent name" wording.

### TC-12.4: Malformed per-role blocks flagged MINOR (not MAJOR, not CRITICAL)
- **Category:** Plan Critic Integration
- **Covers:** NFR-8, FR-6.9; UC-7-EC1, UC-12-EC1
- **Type:** Unit
- **Preconditions:** TC-12.1 passes
- **Test Steps:**
  1. `grep -iE "malformed.*role blocks?|missing.*of.*five.*fields" src/claude.md` -- Plan Critic section
  2. Verify context: classification is MINOR (per NFR-8)
- **Expected:** Plan Critic prompt: malformed blocks are MINOR. Per NFR-8.

### TC-12.5: Slug inconsistency between body and call plan flagged MINOR
- **Category:** Plan Critic Integration
- **Covers:** FR-6.9, AC-16; UC-7-EC1
- **Type:** Unit
- **Preconditions:** TC-12.1 passes
- **Test Steps:**
  1. `grep -iE "inconsistent.*slug|orphan slug" src/claude.md` -- Plan Critic section
  2. Verify classification is MINOR
- **Expected:** Plan Critic prompt declares orphan-slug inconsistency as MINOR.

### TC-12.6: Plan Critic recognition mirrors the `## Recommended Resources` pattern (regression guard)
- **Category:** Plan Critic Integration
- **Covers:** FR-6.9 "mirror" clause
- **Type:** Unit
- **Preconditions:** TC-12.1 passes
- **Test Steps:**
  1. Extract the `## Recommended Resources` Plan Critic bullet from `src/claude.md`
  2. Extract the `## Additional Roles` Plan Critic bullet
  3. Compare structural shape: both have "absence NOT flagged", "malformed MAY be MINOR" clauses
- **Expected:** Structural mirror is preserved. A future refactor removing or re-shaping the `## Recommended Resources` bullet would need to preserve the `## Additional Roles` counterpart shape.

---

## 13. Error and Edge Cases (Use-Case-Direct)

### TC-13.1: UC-1-E1 -- Write permission denied on `~/.claude/agents/`
- **Category:** Error Cases
- **Covers:** FR-1.7, FR-2.3, FR-3.3, FR-5.8; UC-1-E1
- **Type:** Agent Runtime
- **Preconditions:** `~/.claude/agents/` is read-only for current user
- **Test Steps:**
  1. `chmod u-w $HOME/.claude/agents` (or equivalent)
  2. Invoke `role-planner` on an iOS fixture
  3. Verify `.claude/roles-pending.md` contains the recommendation AND a prominent `WARNING:` annotation about the failed write
  4. Verify `~/.claude/agents/ondemand-mobile-ios-dev.md` does NOT exist
  5. Verify `/bootstrap-feature` halts at Step 3.75 per FR-3.3
  6. Restore permissions
- **Expected:** Graceful failure. Recommendation still recorded in temp file; prompt file missing; bootstrap halts; Step 4 does not run.

### TC-13.2: UC-2-E1 -- Missing `.claude/resources-pending.md` (Section 4 not shipped)
- **Category:** Error Cases
- **Covers:** FR-1.2, Dependency 12; UC-2-E1
- **Type:** Agent Runtime
- **Preconditions:** `.claude/resources-pending.md` does NOT exist
- **Test Steps:**
  1. `test ! -f .claude/resources-pending.md`
  2. Invoke `role-planner` on a HIPAA fixture
  3. Verify `.claude/roles-pending.md` is written with recommendations based on the 4 available inputs
  4. Verify no halt or error occurred
- **Expected:** Graceful-absence path. Fall back to reading PRD + use-cases + architect verdict + CLAUDE.md only.

### TC-13.3: UC-3-E1 -- Architect verdict not in context
- **Category:** Error Cases
- **Covers:** FR-1.2; UC-3-E1
- **Type:** Agent Runtime
- **Preconditions:** Bootstrap orchestrator fails to forward architect verdict
- **Test Steps:**
  1. Simulate spawn without architect verdict context
  2. Verify agent proceeds with available 4 inputs (PRD, use-cases, resources-pending, CLAUDE.md)
  3. Verify `.claude/roles-pending.md` includes a note about the missing architect-verdict context
- **Expected:** Partial-input mode handled gracefully; annotation surfaces the degraded input.

### TC-13.4: UC-4-E1 -- Mid-write failure for multi-role feature
- **Category:** Error Cases
- **Covers:** FR-2.3, FR-2.4, FR-2.5, FR-3.3, FR-5.8; UC-4-E1
- **Type:** Agent Runtime
- **Preconditions:** 3-role fixture; simulate filesystem error on 3rd write (e.g., `chmod` trick on 3rd slug)
- **Test Steps:**
  1. Simulate partial-success (2 of 3 ondemand files written, 3rd fails)
  2. Verify `.claude/roles-pending.md` has all 3 recommendations AND a warning about the partial failure
  3. Verify only 2 of 3 `ondemand-<slug>.md` files exist
  4. Verify `/bootstrap-feature` halts per FR-3.3
  5. Re-run bootstrap after fixing the filesystem; verify FR-2.4 and FR-2.5 overwrite produce a clean set
- **Expected:** Partial-state is surfaced; pipeline halts; retry produces clean state via overwrite.

### TC-13.5: UC-5-E1 -- Empty or unreadable PRD
- **Category:** Error Cases
- **Covers:** FR-1.2, FR-3.3; UC-5-E1
- **Type:** Agent Runtime
- **Preconditions:** `docs/PRD.md` is empty or unreadable
- **Test Steps:**
  1. Truncate `docs/PRD.md` to zero bytes (or remove read permission)
  2. Invoke `role-planner`
  3. Verify agent returns structured error
  4. Verify `/bootstrap-feature` halts per FR-3.3
  5. Verify `.claude/roles-pending.md` is NOT written (no output)
  6. Verify no `ondemand-<slug>.md` files are written
- **Expected:** Hard halt when PRD input is missing/empty.

### TC-13.6: UC-6-E1 -- Existing on-demand file has YAML corruption
- **Category:** Error Cases
- **Covers:** FR-1.7, FR-2.5, Risk 5; UC-6-E1
- **Type:** Agent Runtime
- **Preconditions:** `~/.claude/agents/ondemand-mobile-ios-dev.md` has malformed frontmatter
- **Test Steps:**
  1. Create the file with corrupted YAML (missing `---` delimiter)
  2. Invoke `role-planner` on iOS fixture
  3. Verify the file is overwritten with valid frontmatter per FR-1.7
  4. Verify no error during role-planner's own execution (overwrite doesn't parse prior content)
- **Expected:** Overwrite succeeds regardless of prior corruption. Role-planner does not require parsing stale frontmatter.

### TC-13.7: UC-11-EC1 -- Concurrent bootstrap invocations
- **Category:** Error Cases
- **Covers:** FR-2.4, FR-2.5, Risk 11; UC-11-EC1
- **Type:** Agent Runtime
- **Preconditions:** User triggers `/bootstrap-feature` twice simultaneously
- **Test Steps:**
  1. Document the unspecified behavior (race condition)
  2. Verify iteration 1 does NOT lock files
  3. Verify the last-writer-wins outcome (per Risk 11)
- **Expected:** Iteration 1 documents this as a known limitation; no lock enforcement. Per 5.8 item 10, per-feature namespacing deferred.

### TC-13.8: UC-1-EC1 -- PRD mentions iOS in deferred subsection
- **Category:** Edge Cases
- **Covers:** FR-1.5, FR-4.1, FR-4.6; UC-1-EC1
- **Type:** Agent Runtime
- **Preconditions:** PRD has iOS mention explicitly marked "out of scope for iteration 1"
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify no `ondemand-mobile-ios-dev.md` is created
  3. If no other domain gaps, verify "No additional roles required" per UC-5
- **Expected:** Deferred-scope detection prevents unnecessary role creation.

### TC-13.9: UC-2-EC1 -- HIPAA in descriptive-only PRD appendix
- **Category:** Edge Cases
- **Covers:** FR-1.5, FR-4.1; UC-2-EC1
- **Type:** Agent Runtime
- **Preconditions:** PRD mentions HIPAA conceptually but not in binding functional requirements
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify no `ondemand-compliance-officer.md` created
  3. Verify "No additional roles required" if no other gaps
- **Expected:** Descriptive mentions don't trigger recommendations.

### TC-13.10: UC-3-EC1 -- Migration in deferred PRD subsection
- **Category:** Edge Cases
- **Covers:** FR-1.5, FR-4.1; UC-3-EC1
- **Type:** Agent Runtime
- **Preconditions:** PRD mentions migration but marks "future phase"
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify no `ondemand-information-researcher.md` created
- **Expected:** Deferred-scope detection works for research roles too.

### TC-13.11: UC-4-EC1 -- Over-recommendation consolidation
- **Category:** Edge Cases
- **Covers:** FR-4.6, FR-4.7, Risk 1; UC-4-EC1
- **Type:** Agent Runtime
- **Preconditions:** Fixture where the heuristic surfaces a 4th candidate role in the same domain
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify final recommendation is <=3 roles (or single role per domain)
  3. Verify the agent consolidated OR dropped the 4th candidate
- **Expected:** FR-4.6 enforcement (1 per domain) and FR-4.7 conservative guidance hold.

### TC-13.12: UC-5-A1 -- Near-pure-refactor with single minor domain touch
- **Category:** Edge Cases
- **Covers:** FR-1.5, FR-4.4, FR-4.7; UC-5-A1
- **Type:** Agent Runtime
- **Preconditions:** Refactor fixture with a single ARIA rename
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify "No additional roles required" emitted
  3. Verify optional OBSERVATION: comment may be present noting broader accessibility-audit opportunity
- **Expected:** Single minor touch is absorbed by core `code-reviewer` scope; no accessibility role created.

### TC-13.13: UC-5-EC1 -- PRD explicitly declares no additional expertise needed
- **Category:** Edge Cases
- **Covers:** FR-1.5; UC-5-EC1
- **Type:** Agent Runtime
- **Preconditions:** PRD has an explicit "no additional specialized expertise" note
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify "No additional roles required" emitted without overthinking
- **Expected:** Explicit signal honored; agent output matches UC-5 primary flow.

### TC-13.14: UC-6-EC1 -- Same slug, divergent semantics (UIKit → SwiftUI)
- **Category:** Edge Cases
- **Covers:** FR-2.5, 5.8 item 10; UC-6-EC1
- **Type:** Agent Runtime
- **Preconditions:** Prior `ondemand-mobile-ios-dev.md` was UIKit-focused; current feature is SwiftUI
- **Test Steps:**
  1. Create prior UIKit-flavored `ondemand-mobile-ios-dev.md`
  2. Invoke `role-planner` on SwiftUI fixture
  3. Verify file overwritten with SwiftUI content
  4. Note: iteration 1 accepts this coarseness (5.8 item 10)
- **Expected:** Overwrite occurs. Per-feature namespacing deferred to iteration 2.

### TC-13.15: UC-8-A1 -- User manually edited on-demand between write and invocation
- **Category:** Edge Cases
- **Covers:** FR-3.4, 5.8 item 4; UC-8-A1
- **Type:** E2E
- **Preconditions:** User edits `~/.claude/agents/ondemand-<slug>.md` after Step 3.75 write, before invocation
- **Test Steps:**
  1. Let role-planner write the file
  2. Manually edit the body to add custom instruction
  3. Proceed to invocation step
  4. Verify orchestrator uses the user-edited body (no re-hash or validation)
- **Expected:** Trust model holds. Per 5.8 item 4, no programmatic validation.

### TC-13.16: UC-10-E1 -- `.claude/resources-pending.md` missing required AWS entry
- **Category:** Edge Cases
- **Covers:** FR-4.3, FR-4.4; UC-10-E1
- **Type:** Agent Runtime
- **Preconditions:** PRD requires AWS; resources-pending.md lacks AWS Cloud/Compute entry
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify agent does NOT fill the resource gap itself (FR-4.3 boundary held)
  3. Verify `.claude/roles-pending.md` may contain OBSERVATION: comment about resource-architect gap
  4. Verify `aws-integration-reviewer` role IS still recommended (role scope is role-planner's regardless of resource gap)
- **Expected:** Boundary held; observation surfaces gap to developer; role scope unaffected.

### TC-13.17: UC-9-A1 -- Borderline overlap (<=50%) proceeds with disambiguation
- **Category:** Edge Cases
- **Covers:** FR-1.4 (Why field), FR-1.8; UC-9-A1
- **Type:** Agent Runtime
- **Preconditions:** Fixture where candidate role has ~30% overlap (iOS-accessibility vs code-reviewer baseline)
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify role IS emitted
  3. Verify `**Why:**` field explicitly disambiguates non-overlapping portion
- **Expected:** Borderline overlap proceeds with explicit disambiguation in Why field.

### TC-13.18: UC-9-EC1 -- Workflow-structural "meta-reviewer" dropped
- **Category:** Edge Cases
- **Covers:** FR-4.5; UC-9-EC1
- **Type:** Agent Runtime
- **Preconditions:** Fixture that tempts a meta/helper role
- **Test Steps:**
  1. Invoke `role-planner`
  2. Verify no slug like `meta-reviewer`, `everything-checker`, or `helper-*` is emitted
- **Expected:** Workflow-structural roles blocked per FR-4.5.

### TC-13.19: UC-12-A1 -- Plan with misplaced `## Additional Roles` flagged MINOR
- **Category:** Edge Cases
- **Covers:** FR-2.7, FR-6.9, AC-10; UC-12-A1
- **Type:** Unit
- **Preconditions:** Hand-crafted plan with `## Additional Roles` after `## Prerequisites verified`
- **Test Steps:**
  1. Run Plan Critic on the misordered plan
  2. Verify finding classification is MINOR (not CRITICAL, not MAJOR)
- **Expected:** Iteration-1 calibration: misplacement is MINOR per NFR-8.

### TC-13.20: UC-13-A1 -- Mid-feature deletion handled like UC-8-E1
- **Category:** Edge Cases
- **Covers:** FR-2.8, UC-8-E1; UC-13-A1
- **Type:** E2E
- **Preconditions:** Between Step 3.75 and the invocation step, developer deletes the ondemand file
- **Test Steps:**
  1. Let role-planner write `ondemand-compliance-officer.md`
  2. Delete the file mid-feature
  3. Proceed to Step 4 invocation
  4. Verify orchestrator surfaces warning; pipeline continues without the role's output
- **Expected:** Graceful degradation; non-blocking warning.

### TC-13.21: UC-13-E1 -- Core agent file accidentally deleted
- **Category:** Edge Cases
- **Covers:** FR-5.2, FR-6.8; UC-13-E1
- **Type:** E2E
- **Preconditions:** Developer deletes `~/.claude/agents/code-reviewer.md`
- **Test Steps:**
  1. Delete the core agent file
  2. Run `/bootstrap-feature` -- expect pipeline failure (unknown subagent type)
  3. Run `bash install.sh` to re-copy core agents
  4. Verify pipeline now works
- **Expected:** Resolution via install.sh re-run. Role-planner is not the cause and cannot repair core agents (per FR-5.2). Confirms that core agents and on-demand files are in different filename spaces.

### TC-13.22: UC-13-EC1 -- Delete all on-demand files at once
- **Category:** Edge Cases
- **Covers:** FR-2.5, FR-2.8, NFR-10; UC-13-EC1
- **Type:** E2E
- **Preconditions:** Multiple ondemand files exist
- **Test Steps:**
  1. `rm ~/.claude/agents/ondemand-*.md`
  2. Run next feature's `/bootstrap-feature`
  3. Verify any recommended roles regenerate fresh
- **Expected:** Stateless-per-feature model holds; full deletion is safe.

---

## 14. Data Integrity and Idempotency

### TC-14.1: Idempotency -- two successive bootstraps of same feature produce identical output
- **Category:** Data Integrity
- **Covers:** FR-2.4, FR-2.5, NFR-8 (idempotent overwrite); UC-11
- **Type:** Agent Runtime
- **Preconditions:** Clean project; first bootstrap just completed
- **Test Steps:**
  1. Capture checksum of `.claude/plan.md` after first run: `md5 .claude/plan.md`
  2. Capture checksums of all `~/.claude/agents/ondemand-*.md` after first run
  3. Run `/bootstrap-feature` again on same PRD/use-cases
  4. Re-capture checksums
  5. Compare: content should be identical (modulo any timestamp/nonce fields in plan.md)
- **Expected:** Role-planner output is deterministic across runs with identical inputs. This validates NFR-8's idempotency contract.

### TC-14.2: Slug self-consistency across three artifacts (body, call plan, filename)
- **Category:** Data Integrity
- **Covers:** FR-1.3, AC-16; UC-1 postcondition
- **Type:** Agent Runtime
- **Preconditions:** TC-6.1 passes
- **Test Steps:**
  1. Extract slugs from `## Additional Roles` body
  2. Extract slugs from `## Role invocation plan` subsection
  3. Extract slugs from `~/.claude/agents/ondemand-*.md` file names
  4. Verify the three sets are equal
- **Expected:** Identical slug sets. No orphan body entry, no orphan call-plan entry, no orphan prompt file.

### TC-14.3: Sum of bootstrap-time + implementation-time counts equals total count
- **Category:** Data Integrity
- **Covers:** FR-1.6; UC-1 step 6
- **Type:** Agent Runtime
- **Preconditions:** TC-4.5 passes
- **Test Steps:**
  1. Extract the three counts from the summary line
  2. Verify `bootstrap_count + implementation_count == total_count`
- **Expected:** Summary counts are consistent.

### TC-14.4: Orphan ondemand files persist (no garbage collection)
- **Category:** Data Integrity
- **Covers:** FR-2.5, NFR-10, 5.8 item 9; UC-11-A1
- **Type:** E2E
- **Preconditions:** Prior feature generated `ondemand-compliance-officer.md`; current PRD narrowed to NOT need it
- **Test Steps:**
  1. Pre-populate `~/.claude/agents/ondemand-compliance-officer.md`
  2. Run `/bootstrap-feature` for current feature
  3. Verify current `.claude/plan.md` does NOT reference `compliance-officer`
  4. Verify `~/.claude/agents/ondemand-compliance-officer.md` still exists (orphaned but not GC'd)
- **Expected:** Orphan persists. No garbage collection in iteration 1. Per 5.8 item 9.

### TC-14.5: On-demand file content reflects current feature, not prior
- **Category:** Data Integrity
- **Covers:** FR-2.5; UC-6, UC-11
- **Type:** Agent Runtime
- **Preconditions:** Prior feature wrote `ondemand-mobile-ios-dev.md` with iOS-A content; current feature wants iOS-B content
- **Test Steps:**
  1. Pre-populate with iOS-A content
  2. Invoke `role-planner` for iOS-B feature
  3. Verify file content reflects iOS-B (not iOS-A, not merged)
- **Expected:** Fresh overwrite semantics. No content preservation across features.

---

## 15. Authentication/Auth-Boundary (Trust Model)

Note: The SDLC project has no runtime authentication. This category covers the general-purpose safe-by-construction trust model (NFR-11).

### TC-15.1: Agent has no Bash → cannot install packages
- **Category:** Trust Model
- **Covers:** FR-5.7, NFR-6; defense-in-depth
- **Type:** Unit
- **Preconditions:** TC-1.4 passes
- **Test Steps:**
  1. Confirm `Bash` is NOT in the agent's tools list
  2. Confirm agent prompt does not instruct shell-style commands (e.g., `npm install`, `pip install`)
- **Expected:** No Bash tool. Even if the prompt were revised to say "run npm install", the agent cannot execute it. Defense-in-depth.

### TC-15.2: Agent has no Edit → cannot modify existing files
- **Category:** Trust Model
- **Covers:** FR-5.7; UC-1 step 9
- **Type:** Unit
- **Preconditions:** TC-1.3 passes
- **Test Steps:**
  1. Confirm `Edit` is NOT in tools list
  2. Agent can only `Write` (create or overwrite), not edit-in-place
- **Expected:** Edit is absent. Modifications to core files are mechanically impossible.

### TC-15.3: Agent has no WebFetch/WebSearch → no network
- **Category:** Trust Model
- **Covers:** FR-5.6, NFR-6
- **Type:** Unit
- **Preconditions:** TC-1.4 passes
- **Test Steps:**
  1. Confirm `WebFetch`, `WebSearch` NOT in tools list
- **Expected:** Network-capable tools absent. Per NFR-6.

### TC-15.4: General-purpose spawn is session-safe (NFR-11)
- **Category:** Trust Model
- **Covers:** NFR-11; UC-8 primary flow
- **Type:** E2E
- **Preconditions:** On-demand file exists; call plan references it
- **Test Steps:**
  1. Spawn via `subagent_type: general-purpose`
  2. Verify spawn succeeds in the same Claude Code session where the role was generated
  3. Verify no session restart was needed
- **Expected:** General-purpose is always-registered; session-safe invocation works by construction.

### TC-15.5: Filename-prefix self-check prevents core-agent overwrite
- **Category:** Trust Model
- **Covers:** FR-5.2, FR-5.8; architect STRUCTURAL 5
- **Type:** Agent Runtime
- **Preconditions:** TC-2.9 passes
- **Test Steps:**
  1. Simulate role-planner attempting to write `~/.claude/agents/code-reviewer.md` (no ondemand- prefix)
  2. Verify the agent aborts with "authority-boundary violation"
- **Expected:** Self-check fires. Agent refuses to write. Defense-in-depth for Risk 4 ("on-demand prompt file written outside the permitted namespace").

---

## Summary

### TC Count by Category

| Category | TC Count |
|----------|---------|
| 1. Installation & Setup | 12 |
| 2. Authority Boundaries | 11 |
| 3. Output Boundaries | 7 |
| 4. Output Format Canonicalization | 12 |
| 5. Temp-file Lifecycle | 9 |
| 6. On-demand Prompt Files | 10 |
| 7. Pipeline Integration | 12 |
| 8. Scope & Category Boundaries | 6 |
| 9. Orchestrator Invocation Pattern | 8 |
| 10. Cross-file Consistency | 6 |
| 11. Iteration 1 Boundary | 5 |
| 12. Plan Critic Integration | 6 |
| 13. Error and Edge Cases (UC-Direct) | 22 |
| 14. Data Integrity & Idempotency | 5 |
| 15. Auth-Boundary (Trust Model) | 5 |
| **Total** | **136** |

### Use-Case Coverage (54 scenarios)

| UC | Primary | Alternatives | Errors | Edge | Total TCs | Covered in |
|----|---------|--------------|--------|------|-----------|-----------|
| UC-1 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-4.3, TC-6.1, TC-4.5 (primary); TC-2.9+TC-2.11+TC-15.5 (A1 slug-collision); TC-13.1 (E1); TC-13.8 (EC1) |
| UC-2 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-6.1+TC-4.3 (primary); TC-6.7 (A1 overwrite); TC-13.2 (E1); TC-13.9 (EC1) |
| UC-3 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-6.1 (primary); TC-3.1 (A1 boundary); TC-13.3 (E1); TC-13.10 (EC1) |
| UC-4 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-6.1 (primary multi); TC-3.1+TC-8.4 (A1 IaC deferral); TC-13.4 (E1); TC-13.11 (EC1) |
| UC-5 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-4.8+TC-4.9 (primary); TC-13.12 (A1); TC-13.5 (E1); TC-13.13 (EC1) |
| UC-6 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-6.5+TC-6.7 (primary); TC-6.5 (A1 user-edit); TC-13.6 (E1); TC-13.14 (EC1) |
| UC-7 | 1 | 1 (A1) | 2 (E1, E2) | 1 (EC1) | 5 | TC-5.4+TC-5.5+TC-5.6 (primary); TC-7.12 (A1); TC-5.8 (E1); TC-5.9 (E2); TC-12.1 (EC1) |
| UC-8 | 1 | 2 (A1, A2) | 2 (E1, E2) | 2 (EC1, EC2) | 7 | TC-9.1-9.3 (primary); TC-13.15 (A1); TC-9.8 (A2); TC-9.4+TC-9.5 (E1); TC-9.4 (E2); TC-9.7 (EC1); TC-9.6 (EC2) |
| UC-9 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-8.5+TC-8.6 (primary); TC-13.17 (A1); TC-8.1+TC-8.2 (E1 enumeration); TC-13.18 (EC1) |
| UC-10 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-8.4 (primary); TC-3.1 (A1); TC-13.16 (E1); TC-8.4 (EC1) |
| UC-11 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-5.2+TC-14.1 (primary); TC-14.4 (A1 orphan); TC-5.3 (E1 corrupt); TC-13.7 (EC1) |
| UC-12 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-12.1+TC-12.4+TC-12.5 (primary); TC-13.19 (A1); TC-12.1 (E1 regression); TC-12.4 (EC1) |
| UC-13 | 1 | 1 (A1) | 1 (E1) | 1 (EC1) | 4 | TC-6.10 (primary); TC-13.20 (A1); TC-13.21 (E1); TC-13.22 (EC1) |
| **Total** | **13** | **15** | **16** | **10** | **54 / 54** | |

**Coverage: 54/54 UC scenarios mapped.**

### AC Coverage (20 ACs)

| AC | Primary TC(s) |
|----|---------------|
| AC-1 | TC-1.1, TC-1.2, TC-1.3, TC-1.4 |
| AC-2 | TC-7.1, TC-7.6 |
| AC-3 | TC-7.3, TC-7.4 |
| AC-4 | TC-7.6, TC-7.7, TC-7.8, TC-9.1-9.3 |
| AC-5 | TC-5.4, TC-5.5, TC-5.6 |
| AC-6 | TC-10.1, TC-10.2, TC-10.5 |
| AC-7 | TC-1.9, TC-1.10, TC-1.11 |
| AC-8 | TC-1.7, TC-1.8 |
| AC-9 | TC-1.5, TC-1.6 |
| AC-10 | TC-7.11, TC-7.12 |
| AC-11 | TC-4.8, TC-4.9 |
| AC-12 | TC-6.1, TC-6.2, TC-6.3 |
| AC-13 | TC-5.7, TC-6.8 |
| AC-14 | TC-1.3, TC-1.4 |
| AC-15 | TC-4.1, TC-4.3 |
| AC-16 | TC-4.6, TC-4.7, TC-14.2 |
| AC-17 | TC-12.1, TC-12.2, TC-12.6 |
| AC-18 | TC-3.1, TC-8.4 |
| AC-19 | TC-8.1, TC-8.2, TC-8.3 |
| AC-20 | TC-10.1, TC-10.6 |

**Coverage: 20/20 ACs covered.**

### FR Coverage (Runtime-observable FRs)

| FR Category | FRs | TCs |
|-------------|-----|-----|
| FR-1 (Agent Spec) | 1.1-1.8 | TC-1.1-1.4, TC-4.1-4.12, TC-2.1-2.11, TC-8.1-8.3 |
| FR-2 (Output Contract) | 2.1-2.8 | TC-4.1, TC-5.1-5.9, TC-6.1-6.10, TC-7.11 |
| FR-3 (Pipeline Integration) | 3.1-3.7 | TC-7.1-7.12, TC-9.1-9.8 |
| FR-4 (Scope Boundaries) | 4.1-4.7 | TC-3.1-3.7, TC-8.4-8.6, TC-13.16-13.18 |
| FR-5 (Authority Boundaries) | 5.1-5.8 | TC-2.1-2.11, TC-15.1-15.5 |
| FR-6 (Registration) | 6.1-6.10 | TC-1.5-1.12, TC-10.1-10.6, TC-12.1-12.6 |

### NFR Coverage (measurable NFRs from prompt requirement)

| NFR | TCs |
|-----|-----|
| NFR-6 (no network) | TC-1.4, TC-2.6, TC-15.3 |
| NFR-8 (idempotent overwrite -- write contract) | TC-5.2, TC-5.3, TC-6.5, TC-14.1, TC-14.5 |
| NFR-9 (temp-file cleanup after inline / one-shot per bootstrap) | TC-5.6, TC-5.7, TC-11.5 |
| NFR-10 (persistence, no GC) | TC-6.8, TC-6.9, TC-6.10, TC-11.1, TC-14.4 |
| NFR-11 (general-purpose safe-by-construction trust model) | TC-9.3, TC-9.6, TC-11.3, TC-15.4 |

### Architect-Finding Coverage

| Architect Item | TC(s) |
|----------------|-------|
| Ruling 1a (frontmatter-extraction algorithm in 2 files) | TC-7.8 |
| Ruling 7 (closed vocabulary 5 step labels) | TC-4.10, TC-4.11, TC-7.9, TC-10.3 |
| STRUCTURAL 1 (Planner 4a/4b/4c) | TC-5.4, TC-5.5, TC-5.6 |
| STRUCTURAL 2 (core-agent enumeration markers) | TC-8.2 |
| STRUCTURAL 3 (Plan Critic core-slug collision MAJOR) | TC-12.3 |
| STRUCTURAL 4 (overwrite annotation MANDATORY) | TC-6.6, TC-6.7 |
| STRUCTURAL 5 (filename-prefix self-check MANDATORY) | TC-2.9, TC-15.5 |
| Concern 1+2 (labels in both role-planner.md and bootstrap-feature.md) | TC-7.9, TC-10.3 |
| Concern 6 (canonical `src/claude.md` casing) | Applied globally (document header note) |

---

## TBD Markers and Ambiguity Flags

The following TCs are flagged `[TBD -- update after planner pins X]`:

1. **TC-4.2** (per-role `####` heading level): PRD says "structured markdown" but does not literally pin `####`. The implementer (planner) MUST pin the exact heading shape during Tech Lead implementation-plan review. Update the regex accordingly.

2. **TC-4.6** (`## Role invocation plan` heading level): Same consideration -- `###` vs `####` vs `##` subsection level not pinned by PRD. Update regex after planner pins.

3. **TC-7.8** (frontmatter-extraction algorithm sentinel markers): The exact sentinel markers wrapping the algorithm block (e.g., `<!-- FRONTMATTER-EXTRACTION-START -->`) are not pre-declared in the PRD; implementer pins them and the TC's `sed`/`diff` commands adapt accordingly.

### PRD Ambiguity Requiring Defensive Multi-Interpretation

1. **Section ordering when resource-architect emits "No external resources required":** FR-2.7 says "after `## Recommended Resources` (if present) or at the very top (if absent)". The ambiguity: if resource-architect writes an EXPLICIT "No external resources required" body but still includes the `## Recommended Resources` heading, is that "present" (section header exists) or "absent" (body empty)? TC-7.12 defensively tests both interpretations: grep `## Recommended Resources` count 0 (truly absent) OR with explicit-no body; either way, `## Additional Roles` appears before `## Prerequisites verified`.

2. **Whether `/merge-ready` MAY consult the call plan:** PRD Unchanged Files note says "Merge-ready MAY consult the `## Role invocation plan` for any roles designated to run at merge-ready time". TC-7.9 verifies the closed-vocabulary includes `Step 7: merge-ready` as a valid label, making this consultation behavior well-defined. But `/merge-ready.md` itself is Unchanged per PRD. The ambiguity is whether "MAY consult" means there's orchestrator-wide logic or just a theoretical possibility. Current TCs treat it as "defined label exists, actual invocation is orchestrator-agnostic".

3. **Step 5.5 existence:** TC-7.5 checks for preservation of Step 5.5 IF it exists in the pre-feature codebase. Feature-level implementers MUST verify `grep Step 5.5 src/commands/bootstrap-feature.md` before editing to decide if this check applies.

---

## Implementation Notes for Test Writer (not test cases)

- Agent-runtime TCs (in categories 4, 5, 6, 9, 13, 14) require a fixture harness: a small set of sample PRDs + use-cases directory under `docs/PRD.md` plus `docs/use-cases/<feature>_use_cases.md`, with pre-written architect verdicts and pre-written `.claude/resources-pending.md`. Consider reusing fixtures from the resource-architect test suite.
- E2E TCs require the full `/bootstrap-feature` pipeline to be runnable in a test shell with the `role-planner` agent installed at `~/.claude/agents/role-planner.md`.
- For TCs that depend on ENOUGH of Section 4 to be shipped (resource-architect): if Section 4 ships concurrently, coordinate the sequencing per PRD Dependency 12.
