# Test Cases: Resource Manager-Architect -- Iteration 1 (Mandatory Pipeline Role)

> Based on [PRD](../PRD.md) -- Section 4 and [Use Cases](../use-cases/resource-architect_use_cases.md)

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, cross-reference integrity, and (for installer and agent-runtime tests) observable filesystem/process behavior by running shell commands and inspecting outputs.

**Format TBD markers:** Several test cases are flagged `[TBD -- update after planner pins X]` because the PRD has not pinned an exact format for one or more details (e.g., the canonical `###`/`####` heading structure for the temp-file output, the exact wording of the "Authority Boundary" section, the exact phrasing of the architect-verdict forwarding snippet in `src/commands/bootstrap-feature.md`). The Tech Lead (planner) must pin these during implementation planning; the TBD tests will be updated or consolidated once pinned. The full list is in the "Ambiguity Flags" summary at the end of this document.

---

## 1. Installation & Setup

### TC-1.1: `src/agents/resource-architect.md` file exists at the documented path
- **Category:** Installation & Setup
- **Covers:** FR-1.1, AC-1, AC-15; UC-1 preconditions
- **Type:** Unit
- **Preconditions:** Feature is shipped; SDLC repo checked out at HEAD
- **Test Steps:**
  1. Run `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** Exit code 0 (file exists)
- **Edge Cases:** TC-1.2 (frontmatter), TC-1.5 (installer copies)

### TC-1.2: `src/agents/resource-architect.md` frontmatter has required keys in correct shape
- **Category:** Installation & Setup
- **Covers:** FR-1.1, NFR-4, AC-1
- **Type:** Unit
- **Preconditions:** TC-1.1 passes
- **Test Steps:**
  1. Read the frontmatter block (between the two leading `---` markers)
  2. `grep -E "^name: resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  3. `grep -E "^description:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  4. `grep -E "^tools:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  5. `grep -E "^model: opus" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** All four greps return at least one match each. `name` is exactly `resource-architect`; `model` is exactly `opus` (per NFR-4).
- **Edge Cases:** TC-1.3 (tools list positively restricted), TC-1.4 (Bash excluded)

### TC-1.3: Tools list contains ONLY `Read`, `Write`, `Glob`, `Grep`
- **Category:** Installation & Setup
- **Covers:** FR-5.7, AC-1, AC-12
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `tools:` line (or multi-line block) from `src/agents/resource-architect.md`
  2. `grep -cE '"?Read"?' (tools value)` -- expect at least 1
  3. `grep -cE '"?Write"?' (tools value)` -- expect at least 1
  4. `grep -cE '"?Glob"?' (tools value)` -- expect at least 1
  5. `grep -cE '"?Grep"?' (tools value)` -- expect at least 1
  6. Confirm no tool name other than those four appears
- **Expected:** The tools field lists exactly the four allowed tools. No additional tools.
- **Edge Cases:** TC-1.4 (Bash explicitly absent)

### TC-1.4: Tools list does NOT include `Bash`, `Edit`, `WebFetch`, `WebSearch`, or any network-capable tool
- **Category:** Installation & Setup
- **Covers:** FR-5.6, FR-5.7, NFR-6, AC-12; UC-7 step 6
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `tools:` value from `src/agents/resource-architect.md`
  2. `grep -cE '"?Bash"?' (tools value)` -- expect 0
  3. `grep -cE '"?Edit"?' (tools value)` -- expect 0
  4. `grep -cE '"?WebFetch"?' (tools value)` -- expect 0
  5. `grep -cE '"?WebSearch"?' (tools value)` -- expect 0
  6. `grep -cE '"?NotebookEdit"?' (tools value)` -- expect 0
- **Expected:** None of `Bash`, `Edit`, `WebFetch`, `WebSearch`, `NotebookEdit` appear in the tools list. This mechanically prevents shell-based installs and network calls even if the prompt were revised (risk 4.9 item 3 defense-in-depth).
- **Edge Cases:** TC-1.3

### TC-1.5: `install.sh` default install path copies `resource-architect.md` into `~/.claude/agents/`
- **Category:** Installation & Setup
- **Covers:** FR-6.6, AC-8; UC-1 preconditions
- **Type:** Installation
- **Preconditions:** Fresh user-level config; `~/.claude/agents/resource-architect.md` does NOT exist before running installer
- **Test Steps:**
  1. `rm -f $HOME/.claude/agents/resource-architect.md` (clean precondition)
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --yes --local`
  3. `test -f $HOME/.claude/agents/resource-architect.md`
- **Expected:** Step 3 exits 0 -- the agent file is copied by the default install path (not gated behind `--init-project`, per FR-6.6).
- **Edge Cases:** TC-1.6

### TC-1.6: Installed agent count is 15 after install
- **Category:** Installation & Setup
- **Covers:** NFR-5, FR-6.2, AC-5, AC-6
- **Type:** Installation
- **Preconditions:** TC-1.5 passes
- **Test Steps:**
  1. Run `ls -1 $HOME/.claude/agents/*.md | wc -l | tr -d ' '`
- **Expected:** Output equals `15`. Agent count rose from 14 to 15 with the addition of `resource-architect`.

### TC-1.7: `install.sh` banner strings updated from "14" to "15" -- all five locations
- **Category:** Installation & Setup
- **Covers:** FR-6.5, AC-7; architect finding (PRD item 5) on install.sh "14" locations
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  2. `grep -c "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  3. `grep -c "14 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  4. `grep -c "15 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  5. `grep -cE "\(14 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  6. `grep -cE "\(15 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
  7. `grep -c "14" /Users/aleksandra/Documents/claude-code-sdlc/install.sh` -- total "14" references that are the agent count (exclude any that are unrelated, e.g., port numbers)
  8. `grep -c "15" /Users/aleksandra/Documents/claude-code-sdlc/install.sh` -- should match step 7's value from pre-feature state
- **Expected:**
  - Step 1: returns `0` (no stale "14 specialized")
  - Step 2: returns at least `1` (new tagline)
  - Step 3: returns `0` (no stale "14 AI agents")
  - Step 4: returns at least `1`
  - Step 5: returns `0` (no stale `(14 files`)
  - Step 6: returns at least `1`
  - Steps 7-8: the integer-count "14" agent-count total is `0`; the "15" agent-count total is exactly `5` (the five banner locations enumerated in PRD 4.6 Agent Count Propagation table).
- **Edge Cases:** TC-1.8 (`--help` output)

### TC-1.8: `install.sh --help` output reports "15 specialized AI agents"
- **Category:** Installation & Setup
- **Covers:** FR-6.5 deepening; AC-7
- **Type:** Installation
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "15"`
  2. `bash /Users/aleksandra/Documents/claude-code-sdlc/install.sh --help | grep -c "14 specialized"`
- **Expected:** Step 1 returns at least `2` (the tagline line and the `WHAT GETS INSTALLED` block line both mention "15"); step 2 returns `0`.

### TC-1.9: `README.md` "14" references updated to "15" -- exactly 2 locations
- **Category:** Installation & Setup
- **Covers:** FR-6.2, FR-6.3, AC-6; architect finding (PRD item 5) on README exactly-2 locations
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. `grep -c "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  3. `grep -c "The 14 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  4. `grep -c "The 15 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  5. `grep -nE "(^|[^0-9])14([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/README.md | grep -v "\-14-" | wc -l | tr -d ' '` -- total standalone "14" count
  6. `grep -nE "(^|[^0-9])15([^0-9]|$)" /Users/aleksandra/Documents/claude-code-sdlc/README.md | grep -v "\-15-" | wc -l | tr -d ' '` -- total standalone "15" count
- **Expected:**
  - Step 1: returns `0` (no stale "14 specialized")
  - Step 2: returns at least `1`
  - Step 3: returns `0`
  - Step 4: returns at least `1`
  - Step 5 and 6 together: step 5 returns `0` agent-count references; step 6 returns exactly `2` agent-count references (the tagline at line 5 and the `## The 15 Agents` heading at line 95 per PRD item 5)
- **Edge Cases:** TC-1.10 (README agent table row); TC-1.11 (README feature section)

### TC-1.10: `README.md` includes a `resource-architect` row in the agent table
- **Category:** Installation & Setup
- **Covers:** FR-6.3, AC-6
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -n "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
  2. Verify the match appears between the `architect` row and the `qa-planner` row in the agent table (same ordering as Agency Roles table per FR-6.3)
- **Expected:** `resource-architect` appears in the `## The 15 Agents` table with a short role description, positioned after `architect` and before `qa-planner`.

### TC-1.11: `README.md` has a feature section describing resource recommendation
- **Category:** Installation & Setup
- **Covers:** FR-6.4, AC-6
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -nE "resource|Resource" /Users/aleksandra/Documents/claude-code-sdlc/README.md | grep -iE "(recommend|MCP|cloud|API|third-party|library|hardware)"`
  2. `grep -iE "suggest-only|no install|read-only|does not install" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Expected:** A section (or prominent paragraph) describes the resource-recommendation capability, mentions the six categories, and states the agent is suggest-only (no installs). At least one match from step 2 confirms the suggest-only boundary is documented.

### TC-1.12: `src/claude.md` Agency Roles table has `resource-architect` row between `architect` and `qa-planner`
- **Category:** Installation & Setup
- **Covers:** FR-6.1, AC-5
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Read lines around the Agency Roles table in `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. `grep -n "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  3. `grep -n "Resource Manager-Architect" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  4. Verify the order of table rows: `architect` row appears BEFORE `resource-architect` row; `resource-architect` row appears BEFORE `qa-planner` row (per FR-6.1)
- **Expected:** The Agency Roles table contains a row with Role = "Resource Manager-Architect", Agent = `resource-architect`, Responsibility mentioning "external resources", "MCP", "cloud", "APIs", "services", "libraries", "hardware" or equivalent. Row ordering matches FR-6.1.
- **Edge Cases:** TC-1.13 (src/CLAUDE.md mirror), TC-1.14 (prose "14 agents" references)

### TC-1.13: `src/CLAUDE.md` Agency Roles table mirrors `src/claude.md` -- identical state
- **Category:** Installation & Setup
- **Covers:** FR-6.1, AC-5; architect finding (item 5 -- `src/CLAUDE.md` mirror MUST be updated in same slice)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -n "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/CLAUDE.md`
  2. `grep -n "Resource Manager-Architect" /Users/aleksandra/Documents/claude-code-sdlc/src/CLAUDE.md`
  3. Extract the Agency Roles table block from BOTH `src/claude.md` and `src/CLAUDE.md`
  4. Compare the two table blocks line-by-line (e.g., `diff <(sed -n '/^| Role/,/^$/p' src/claude.md) <(sed -n '/^| Role/,/^$/p' src/CLAUDE.md)`)
- **Expected:** Steps 1-2 return at least one match each. Step 4 shows no differences between the two tables (both contain the new `resource-architect` row in identical position with identical cell contents).
- **Edge Cases:** This is the architect's structural requirement -- the mirror is load-bearing; if `src/claude.md` is updated but `src/CLAUDE.md` is not, downstream agents using the mirror will see the stale 14-agent table.

### TC-1.14: `src/claude.md` prose contains no "14 agents" reference (PRD inaccuracy no-op verification)
- **Category:** Installation & Setup
- **Covers:** FR-6.2 (as no-op); architect finding (PRD inaccuracy item 1 -- "14 agents in src/claude.md prose" does not exist)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -c "14 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. `grep -c "15 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
- **Expected:** Step 1 returns `0` (both before and after this feature -- the prose never contained "14 agents" to update, contrary to FR-6.2's claim). Step 2 returns `0` (no prose added gratuitously either). This test documents that FR-6.2's `src/claude.md` prose update is a no-op; the actual propagation happens via the Agency Roles table row (TC-1.12), README (TC-1.9, TC-1.10), and install.sh (TC-1.7).
- **Edge Cases:** Also verify the same for `src/CLAUDE.md` mirror: `grep -c "14 agents" src/CLAUDE.md` returns 0.

### TC-1.15: `src/commands/bootstrap-feature.md` has `Step 3.5: Resource Manager-Architect recommendation` between Step 3 and Step 4
- **Category:** Installation & Setup
- **Covers:** FR-3.1, FR-3.5, AC-2, AC-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -n "Step 3.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  2. `grep -n "Resource Manager-Architect" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  3. `grep -n "^### Step" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
- **Expected:** Step 3.5 appears as a section heading (e.g., `### Step 3.5: Resource Manager-Architect recommendation`); listed step order is ... Step 3 -> Step 3.5 -> Step 4 -> Step 5 -> Step 5.5 -> Step 6 -> Step 7 (Step 4 still QA; Step 5 still planner per FR-3.5).

### TC-1.16: `src/agents/planner.md` contains `.claude/resources-pending.md` read-and-delete instructions
- **Category:** Installation & Setup
- **Covers:** FR-2.5, FR-3.4, AC-4, AC-11
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -n "\.claude/resources-pending\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md`
  2. `grep -iE "inline|copy|include" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md | grep -iE "resources-pending|Recommended Resources"`
  3. `grep -iE "delete|remove|rm" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md | grep -i "resources-pending"`
  4. `grep -iE "before.+Prerequisites verified|first top-level section|top of .claude/plan.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md`
- **Expected:** Steps 1-4 each return at least one match. The planner prompt describes reading the temp file, inlining content before `## Prerequisites verified`, and deleting the temp file.
- **Edge Cases:** TC-1.17 (MUST language for deletion)

### TC-1.17: `src/agents/planner.md` uses MANDATORY language ("MUST delete") for temp-file cleanup
- **Category:** Installation & Setup
- **Covers:** FR-2.5, NFR-9, AC-11; architect finding (item 3 -- MUST delete, not "may delete")
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Locate the planner prompt section that references `.claude/resources-pending.md`
  2. Grep for "MUST delete" or "MUST remove" or "delete it" in a mandatory construction; confirm the wording is prescriptive (MUST/DELETE), not permissive (may/should)
  3. `grep -iE "may delete|might delete|should delete|optional" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md | grep -i "resources-pending"`
- **Expected:** Step 2 finds a MUST-level requirement for deletion. Step 3 returns `0` -- no permissive language softens the requirement.

---

## 2. Agent Frontmatter & Basic Structure

### TC-2.1: Agent prompt documents the four-input read order (PRD, use cases, architect verdict, CLAUDE.md)
- **Category:** Agent Frontmatter & Basic Structure
- **Covers:** FR-1.2, AC-1; UC-1 step 1
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "docs/PRD\.md|current feature section" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. `grep -iE "docs/use-cases|use.cases file|<feature>_use_cases" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  3. `grep -iE "architect.+verdict|architect.+review|verdict.+context" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  4. `grep -iE "CLAUDE\.md|project.+context" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** All four greps return at least one match each. The agent prompt instructs the agent to read all four inputs.

### TC-2.2: Agent prompt EXPLICITLY PROHIBITS reading `.claude/scratchpad.md`
- **Category:** Agent Frontmatter & Basic Structure
- **Covers:** FR-1.2 explicit prohibition; UC-1 step 2
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "scratchpad|\.claude/scratchpad" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Verify the match is in a prohibition context (e.g., "MUST NOT read", "do not read", "does not read")
- **Expected:** Step 1 returns a match; step 2 confirms the prohibition context. The agent MUST NOT read the scratchpad.

### TC-2.3: Agent prompt documents the `opus` model choice
- **Category:** Agent Frontmatter & Basic Structure
- **Covers:** NFR-4
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. `grep -cE "^model: opus$" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** Returns exactly `1`.

### TC-2.4: Agent `description` frontmatter field is non-empty and describes the agent's role
- **Category:** Agent Frontmatter & Basic Structure
- **Covers:** FR-1.1
- **Type:** Unit
- **Preconditions:** TC-1.2 passes
- **Test Steps:**
  1. Extract the `description:` line and verify non-empty value
  2. `grep -iE "^description:.*(recommend|resource|MCP|cloud|bootstrap)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** `description:` is present with a non-empty value that references the agent's core function (recommending resources).

---

## 3. Self-check & Authority Boundaries

### TC-3.1: Agent prompt has an explicit "Authority Boundary" section listing prohibited actions
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.1; UC-7 primary flow
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -inE "authority.?boundary|prohibited.+actions|must not" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Confirm at least one section heading contains "Authority" or equivalent
- **Expected:** The agent prompt contains an explicit Authority Boundary section with a list of prohibited actions.

### TC-3.2: Agent prompt prohibits modifying `~/.claude/settings.json` and project-local `.claude/settings.json`
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.2; UC-1-A1 (read-only probe), UC-7 step 3
- **Type:** Unit
- **Preconditions:** TC-3.1 passes
- **Test Steps:**
  1. `grep -iE "settings\.json" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Verify context of the match is prohibition on WRITES (not prohibition on READS)
- **Expected:** The prompt explicitly prohibits writes to settings.json (both user-level and project-local). Reads are permitted for the UC-1-A1 "already installed" probe.

### TC-3.3: Agent prompt prohibits invoking `claude mcp add` or any `claude` configuration-mutating subcommand
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.3; UC-1 step 9, UC-7 step 4
- **Type:** Unit
- **Preconditions:** TC-3.1 passes
- **Test Steps:**
  1. `grep -iE "claude mcp add|claude mcp remove|claude.+subcommand" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Verify the match is in a prohibition context ("MUST NOT invoke", "do not run")
- **Expected:** Explicit prohibition on invoking configuration-mutating `claude` subcommands. Emitting these as copy-paste text snippets is allowed.

### TC-3.4: Agent prompt prohibits touching credentials (`.env`, `~/.aws/credentials`, `~/.config/gcloud/`)
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.4; UC-2 step 7, UC-3 step 5, UC-7 step 3
- **Type:** Unit
- **Preconditions:** TC-3.1 passes
- **Test Steps:**
  1. `grep -iE "\.env|\.envrc|\.aws/credentials|config/gcloud|secrets" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Verify at least three distinct credential-store paths are named as prohibited
- **Expected:** `.env`, `.envrc`, `~/.aws/credentials`, and `~/.config/gcloud/` (or equivalent credential locations) are enumerated in prohibitions.

### TC-3.5: Agent prompt prohibits package-manager invocations (`npm install`, `pip install`, `brew install`, etc.)
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.5; UC-1 step 9, UC-7 step 4
- **Type:** Unit
- **Preconditions:** TC-3.1 passes
- **Test Steps:**
  1. `grep -iE "npm install|pnpm add|yarn add|pip install|poetry add|brew install|apt install|cargo add" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Verify at least six of those package-manager patterns are enumerated as prohibited
- **Expected:** The prompt enumerates at least six common package-manager commands as prohibited invocations. Emitting them as copy-paste text is allowed.

### TC-3.6: Agent prompt prohibits network calls (HTTP, DNS, git fetch, URL retrieval)
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.6, NFR-6; UC-1 step 10, UC-3-E1, UC-7 step 5
- **Type:** Unit
- **Preconditions:** TC-3.1 passes
- **Test Steps:**
  1. `grep -iE "network|HTTP|DNS|fetch|URL|registry|remote" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. Verify the match is in a prohibition context
- **Expected:** The prompt explicitly prohibits network calls and documents that all inputs are local files. The phrase "All inputs are local files" (or equivalent) should be present per UC-3-E1 step 4.

### TC-3.7: Agent prompt contains "Output Boundary" prose forbidding new-agent / agency-role / pipeline-step recommendations
- **Category:** Self-check & Authority Boundaries
- **Covers:** PRD 4.8 item 7, FR-4.1; architect finding (item 1 -- Output Boundary prohibition)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "output.?boundary|scope discipline|stay within" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  2. `grep -iE "new agent|new role|agency role|pipeline step|new step" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
  3. Verify the match from step 2 is in a prohibition context ("MUST NOT recommend", "do not suggest")
- **Expected:** The prompt contains prose explicitly forbidding the agent from recommending new agents, modifications to the Agency Roles table, or new pipeline steps. This enforces UC-9 scope discipline at the prompt level.

### TC-3.8: Agent writes EXACTLY one file -- `.claude/resources-pending.md` -- verified post-run
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-2.1, FR-5.2, FR-5.4; UC-7 step 2 and postconditions
- **Type:** E2E
- **Preconditions:** Install completed per TC-1.5; a test feature exists in `docs/PRD.md`; `.claude/resources-pending.md` does not pre-exist; a reference snapshot of all files' mtime/content exists before the agent runs
- **Test Steps:**
  1. Capture snapshot: `find $PROJECT_ROOT -type f -newer /dev/null -printf '%p %T@\n' > /tmp/before.txt`
  2. Invoke `resource-architect` agent against the test feature
  3. Capture snapshot: `find $PROJECT_ROOT -type f -newer /dev/null -printf '%p %T@\n' > /tmp/after.txt`
  4. `diff /tmp/before.txt /tmp/after.txt`
  5. Verify: exactly one file created/modified; that file is `.claude/resources-pending.md`
  6. Verify: `~/.claude/settings.json` mtime and content unchanged
  7. Verify: `.env` and `.envrc` do not exist (or are unchanged if pre-existing)
  8. Verify: `docs/PRD.md`, `docs/use-cases/*.md`, `.claude/plan.md`, `.gitignore` unchanged
- **Expected:** The only file written by the agent is `.claude/resources-pending.md`. All other files -- especially settings, credentials, PRD, and plan -- are byte-untouched.
- **Edge Cases:** TC-3.9 (no shell process spawned)

### TC-3.9: No shell process spawned during agent run (Bash tool mechanically excluded)
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.7, NFR-6; UC-7 step 6
- **Type:** E2E
- **Preconditions:** TC-1.4 passes (Bash excluded from tools frontmatter)
- **Test Steps:**
  1. Invoke `resource-architect` agent against a test feature
  2. Observe the agent's tool-invocation trace (Claude Code's tool-use logs)
  3. `grep -c "Bash" <tool-use log>` -- expect 0
- **Expected:** The tool-use trace contains zero `Bash` invocations. Any attempt to invoke `Bash` would fail tool authorization because the agent's frontmatter excludes it.
- **Edge Cases:** TC-3.10 (no network attempts)

### TC-3.10: No network call initiated during agent runtime
- **Category:** Self-check & Authority Boundaries
- **Covers:** FR-5.6, NFR-6; UC-3-E1
- **Type:** E2E
- **Preconditions:** Test run in a sandboxed environment or with network monitoring
- **Test Steps:**
  1. Start a network monitor (e.g., `tcpdump`, `lsof -i`, or a firewall egress log) before invocation
  2. Invoke `resource-architect` agent against a test feature
  3. Inspect monitor output for HTTP, DNS lookups, git remote fetches, URL retrievals
- **Expected:** Zero network egress during the agent's runtime. Per NFR-7, if runtime exceeds 30 seconds, the test harness flags this as a signal that the agent may be attempting unauthorized research.

---

## 4. Output Format Canonicalization

### TC-4.1: Temp file has top-level `## Recommended Resources` heading
- **Category:** Output Format Canonicalization
- **Covers:** FR-2.2, FR-2.6; UC-1 step 7, UC-5 step 5
- **Type:** Integration
- **Preconditions:** Agent was invoked on a test feature with at least one resource need
- **Test Steps:**
  1. `head -n 3 .claude/resources-pending.md`
  2. `grep -cE "^## Recommended Resources$" .claude/resources-pending.md`
- **Expected:** Step 2 returns exactly `1`. The first top-level heading is `## Recommended Resources` (no frontmatter, no leading commentary).

### TC-4.2: Temp file contains a summary line reporting total count, expensive count, hard-reversibility count
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.6; UC-1 step 5, UC-2 step 4, UC-4 step 5, UC-6 step 5
- **Type:** Integration
- **Preconditions:** Agent has run on a test feature
- **Test Steps:**
  1. Read the line(s) immediately following the `## Recommended Resources` heading (and before the first category heading)
  2. `grep -iE "recommendation.+total|total.+recommendations" .claude/resources-pending.md`
  3. `grep -cE "expensive" .claude/resources-pending.md`
  4. `grep -cE "hard" .claude/resources-pending.md`
- **Expected:** The summary line is present above the category headings. It reports an integer total, a count of `expensive` flags, and a count of `hard` reversibility flags (shape per PRD: "N recommendations total; X `expensive`; Y `hard` reversibility").

### TC-4.3: Temp file contains six `###` category headings in fixed order [TBD -- update after planner pins `###` vs. `##` for categories]
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.7, FR-4.1; UC-1 step 6, UC-4 step 4, UC-6 step 4; architect finding (item 2 -- canonical `###` for category headings)
- **Type:** Integration
- **Preconditions:** Agent has run on a test feature
- **Test Steps:**
  1. `grep -nE "^### MCP$" .claude/resources-pending.md`
  2. `grep -nE "^### Cloud/Compute$" .claude/resources-pending.md`
  3. `grep -nE "^### External API$" .claude/resources-pending.md`
  4. `grep -nE "^### Third-party Service$" .claude/resources-pending.md`
  5. `grep -nE "^### Library/Framework$" .claude/resources-pending.md`
  6. `grep -nE "^### Hardware$" .claude/resources-pending.md`
  7. Verify the six headings appear in the above order (line numbers monotonically increasing)
- **Expected:** All six greps return exactly `1` each. Line numbers are in the order: MCP < Cloud/Compute < External API < Third-party Service < Library/Framework < Hardware.
- **Note:** Pinned to `###` per architect finding item 2. If the planner pins a different heading level during implementation, this test must be updated.

### TC-4.4: Each resource entry under a category has a `####` resource-name heading [TBD -- update after planner pins `####` level]
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.4, FR-2.2; UC-1 step 4, UC-2 step 3, UC-6 step 3; architect finding (item 2 -- `####` for resource names)
- **Type:** Integration
- **Preconditions:** Test feature has at least one MCP recommendation
- **Test Steps:**
  1. Locate the `### MCP` heading and its immediate following lines
  2. `grep -nE "^#### " .claude/resources-pending.md`
  3. Verify each non-`(none)` category contains at least one `####` heading (the resource name)
- **Expected:** Each resource entry is introduced by a `#### <resource name>` heading. For example: `#### Playwright MCP server`.
- **Note:** Pinned to `####` per architect finding item 2.

### TC-4.5: Each resource entry has exactly five bulleted fields with bold labels
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.4 (six fields; the Name field is the `####` heading, leaving five fields as bullets), NFR-8; architect finding (item 2 -- bulleted fields with bold labels)
- **Type:** Integration
- **Preconditions:** At least one `####` resource entry is present
- **Test Steps:**
  1. Under each `####` entry, look for the five bullet lines
  2. `grep -cE "^- \*\*Category:\*\*" .claude/resources-pending.md`
  3. `grep -cE "^- \*\*Why:\*\*" .claude/resources-pending.md`
  4. `grep -cE "^- \*\*Install/activate:\*\*" .claude/resources-pending.md`
  5. `grep -cE "^- \*\*Cost/complexity:\*\*" .claude/resources-pending.md`
  6. `grep -cE "^- \*\*Reversibility:\*\*" .claude/resources-pending.md`
  7. All five counts must equal the number of `####` resource entries
- **Expected:** For every `####` entry, each of the five fields (Category, Why, Install/activate, Cost/complexity, Reversibility) appears as a bulleted line with bold label (per architect finding item 2). Count invariant: sum of bullet-field occurrences equals 5 x (number of resource entries).

### TC-4.6: Category field value is exactly one of the six allowed tokens
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.4 Category value domain
- **Type:** Integration
- **Preconditions:** TC-4.5 passes
- **Test Steps:**
  1. Extract all `- **Category:**` lines
  2. For each line, verify the value is exactly one of: `MCP`, `Cloud/Compute`, `External API`, `Third-party Service`, `Library/Framework`, `Hardware`
- **Expected:** Every Category field matches exactly one of the six allowed tokens. No typos, no additional tokens.

### TC-4.7: Cost/complexity field value is exactly one of `trivial`, `moderate`, `expensive`
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.4 Cost/complexity value domain
- **Type:** Integration
- **Preconditions:** TC-4.5 passes
- **Test Steps:**
  1. Extract all `- **Cost/complexity:**` lines
  2. For each line, verify the value matches one of `trivial`, `moderate`, `expensive`
- **Expected:** Every Cost/complexity field is one of the three allowed tokens.

### TC-4.8: Reversibility field value is exactly one of `easy`, `moderate`, `hard`
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.4 Reversibility value domain
- **Type:** Integration
- **Preconditions:** TC-4.5 passes
- **Test Steps:**
  1. Extract all `- **Reversibility:**` lines
  2. For each line, verify the value matches one of `easy`, `moderate`, `hard`
- **Expected:** Every Reversibility field is one of the three allowed tokens.

### TC-4.9: Why field references a PRD requirement (FR-N or AC-N) where applicable
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.4 Why-field content (PRD-requirement citation per risk 4.9 item 1 mitigation)
- **Type:** Integration
- **Preconditions:** Test feature's PRD has numbered FRs that drive resource needs
- **Test Steps:**
  1. Extract all `- **Why:**` lines
  2. `grep -cE "FR-[0-9]|AC-[0-9]|Section [0-9]" .claude/resources-pending.md`
- **Expected:** At least one Why field cites a PRD requirement (FR-N, AC-N, or Section N) as the rationale -- risk 4.9 item 1 mitigation against over-recommendation.

### TC-4.10: Empty categories show literal `(none)` per FR-1.7
- **Category:** Output Format Canonicalization
- **Covers:** FR-1.7, AC-10; UC-1 step 6, UC-4 step 4
- **Type:** Integration
- **Preconditions:** Agent ran on a feature where at least one category has no recommendations
- **Test Steps:**
  1. Identify categories with no `####` entries
  2. Verify each such category has a literal `(none)` marker underneath its `###` heading
  3. `grep -cE "^\(none\)$" .claude/resources-pending.md`
- **Expected:** Every empty category has `(none)` underneath. Count of `(none)` markers equals number of empty categories.

### TC-4.11: Structured output has no frontmatter, no "end of output" markers, no agent-meta commentary
- **Category:** Output Format Canonicalization
- **Covers:** FR-2.2
- **Type:** Integration
- **Preconditions:** Agent ran on a test feature
- **Test Steps:**
  1. `head -n 1 .claude/resources-pending.md` -- should be `## Recommended Resources`, NOT `---`
  2. `tail -n 1 .claude/resources-pending.md` -- should NOT match "end of output", "EOF", "--- end ---"
  3. `grep -iE "^I am|^As the resource-architect|^my job is" .claude/resources-pending.md`
- **Expected:**
  - Step 1: first line is the main heading, not a frontmatter fence
  - Step 2: no trailing end-of-output marker
  - Step 3: returns `0` -- no agent-meta commentary leaks into the output

---

## 5. Scope & Category Boundaries

### TC-5.1: MCP recommendation includes exact `claude mcp add ...` command
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.2; UC-1 step 4
- **Type:** Integration
- **Preconditions:** Test feature needs a browser MCP (e.g., Playwright)
- **Test Steps:**
  1. Under `### MCP`, find the Playwright `####` entry
  2. Read the Install/activate field
  3. `grep -cE "claude mcp add" .claude/resources-pending.md`
- **Expected:** The Install/activate field contains the exact `claude mcp add playwright ...` (or equivalent) shell-command string. At least one MCP entry has a copy-paste `claude mcp add` snippet.

### TC-5.2: Cloud/Compute recommendation includes provisioning checklist, NOT "use your laptop"
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.3; UC-2 primary flow, UC-2-EC1
- **Type:** Integration
- **Preconditions:** Test feature requires GPU-backed compute
- **Test Steps:**
  1. Under `### Cloud/Compute`, find the GPU-instance `####` entry
  2. Read Install/activate field -- should be a numbered checklist (provision, install drivers, configure security group, record DNS)
  3. `grep -iE "use your laptop|your own machine" .claude/resources-pending.md` -- expect 0
- **Expected:** Cloud/Compute entries describe remote or deliberate-setup compute (cloud VMs, serverless, containers). The phrase "use your laptop" does NOT appear in any Cloud/Compute entry (per FR-4.3 explicit exclusion).

### TC-5.3: External API recommendation includes credential-acquisition procedure
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.4; UC-3 primary flow
- **Type:** Integration
- **Preconditions:** Test feature requires a paid HTTP API (e.g., OAuth provider)
- **Test Steps:**
  1. Under `### External API`, find the Auth0 (or equivalent) `####` entry
  2. Read Install/activate field -- should be a numbered checklist ending with adding env vars
  3. Verify: no env var is actually written to disk during the agent run (per FR-5.4)
- **Expected:** External API entry describes credential acquisition as a numbered procedure. The agent itself does not acquire credentials or write env vars.

### TC-5.4: Third-party Service recommendation is operational-coupled, distinct from External API
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.5; UC-3 primary flow, UC-6 step 3, UC-6-EC1
- **Type:** Integration
- **Preconditions:** Test feature needs an operational service (e.g., Sentry)
- **Test Steps:**
  1. Under `### Third-party Service`, verify entries are operational/augmenting the running system (not called directly in feature code)
  2. Verify the distinction is documented in the Why field
- **Expected:** Third-party Service entries (Sentry, Datadog, CDN, Auth0-as-service, etc.) are distinct from External API entries by the "code-path-coupled vs. operational-coupled" distinction.

### TC-5.5: Library/Framework recommendation only covers architectural choices, not utility libraries
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.6; UC-3-EC1, UC-6-A1
- **Type:** Integration
- **Preconditions:** Test feature has green-field framework decision or uses only in-house utility libs
- **Test Steps:**
  1. Under `### Library/Framework`, confirm entries are framework-level (Express, Prisma, Vitest, etc.)
  2. `grep -iE "bcrypt|lodash|date-fns|moment" .claude/resources-pending.md` -- expect 0 under Library/Framework if the feature only uses utility libs
- **Expected:** Utility libraries do not appear in Library/Framework per FR-4.6. Only framework-level choices appear.

### TC-5.6: Hardware recommendation covers non-cloud physical constraints
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.7; UC-2-EC1, UC-6-A1
- **Type:** Integration
- **Preconditions:** Test feature has RAM/disk constraints beyond 8 GB / 100 GB, or special hardware
- **Test Steps:**
  1. Under `### Hardware`, confirm entries describe RAM minimums, special hardware, or host-OS constraints
  2. Verify cloud-backed GPUs appear under Cloud/Compute, not Hardware
- **Expected:** Hardware entries are non-cloud physical resource requirements.

### TC-5.7: Agent does NOT introduce new categories beyond the six FR-4.1 categories
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.1
- **Type:** Integration
- **Preconditions:** Agent ran on a diverse test feature
- **Test Steps:**
  1. Extract all `### ` headings from `.claude/resources-pending.md`
  2. Verify the set equals exactly: `{MCP, Cloud/Compute, External API, Third-party Service, Library/Framework, Hardware}`
  3. `grep -nE "^### (Database|Message Queue|Developer Tooling|IDE|CI)$" .claude/resources-pending.md` -- expect 0 matches
- **Expected:** No additional categories appear. The six FR-4.1 categories are exhaustive.

### TC-5.8: Agent does NOT recommend new agents, Agency Role changes, or pipeline-step additions
- **Category:** Scope & Category Boundaries
- **Covers:** FR-4.1, PRD 4.8 item 7; UC-9 primary flow, UC-9-EC1; architect finding (item 1 -- Output Boundary)
- **Type:** Integration
- **Preconditions:** Test feature mentions an existing agent by name (e.g., "the e2e-runner agent will drive Playwright")
- **Test Steps:**
  1. Invoke the agent on the test feature
  2. `grep -iE "create.+agent|new agent|add.+agent|role-planner|qa-automator" .claude/resources-pending.md` -- expect 0
  3. `grep -iE "agency role|pipeline step|Step [0-9]" .claude/resources-pending.md` -- expect 0
  4. Verify the recommendation list contains only FR-4.1-category entries
- **Expected:** Zero matches for agent-creation or pipeline-modification language. All recommendations are category-bounded.

---

## 6. Temp-file Lifecycle

### TC-6.1: Temp file is created at `.claude/resources-pending.md` in project CWD
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.1, FR-2.2; UC-1 step 7
- **Type:** Integration
- **Preconditions:** `.claude/resources-pending.md` does not pre-exist; agent is invoked
- **Test Steps:**
  1. `test ! -f .claude/resources-pending.md` (precondition)
  2. Invoke `resource-architect` on a test feature
  3. `test -f .claude/resources-pending.md`
- **Expected:** File exists at the exact path `.claude/resources-pending.md` relative to project CWD. Not in `~/.claude/`, not `docs/`, not `.claude/plan.md`.

### TC-6.2: Agent OVERWRITES a pre-existing temp file without prompting
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.4, NFR-8; UC-8 step 3-4, UC-10 step 4-5
- **Type:** Integration
- **Preconditions:** `.claude/resources-pending.md` exists from a prior incomplete run with stale content
- **Test Steps:**
  1. Pre-populate: `echo "stale content from prior run" > .claude/resources-pending.md`
  2. Invoke `resource-architect` on the current test feature
  3. Read `.claude/resources-pending.md`
- **Expected:** The file content is the current-run output only. No "stale content from prior run" substring appears. No merge markers, no append markers. The write is a full replacement.
- **Edge Cases:** TC-6.3 (overwrite is idempotent given same inputs)

### TC-6.3: Overwrite is idempotent given the same inputs (no-network determinism)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.4, NFR-6; UC-8 step 5
- **Type:** Integration
- **Preconditions:** Agent ran once, producing `.claude/resources-pending.md` with content A; inputs have not changed
- **Test Steps:**
  1. Save content of `.claude/resources-pending.md` to `/tmp/output1.md`
  2. Invoke `resource-architect` again on the same feature without modifying PRD, use cases, or architect verdict
  3. `diff /tmp/output1.md .claude/resources-pending.md`
- **Expected:** The diff shows zero semantic differences between runs (allowing for whitespace normalization). The agent is deterministic given the same inputs (no-network design).
- **Note:** This is a soft assertion -- the agent's LLM-backed nature may introduce stylistic variance. Test assertion: the structural elements (six category headings, same number of entries per category, same six field values per entry) match across runs.

### TC-6.4: Planner deletes `.claude/resources-pending.md` after successful inlining
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.3, FR-2.5, AC-11; UC-5 step 7; architect finding (item 3 -- MANDATORY deletion)
- **Type:** E2E
- **Preconditions:** Step 3.5 completed successfully (`.claude/resources-pending.md` exists); `/bootstrap-feature` proceeds to Step 5
- **Test Steps:**
  1. `test -f .claude/resources-pending.md` (precondition)
  2. Invoke the planner (or complete `/bootstrap-feature` end-to-end)
  3. `test ! -f .claude/resources-pending.md`
- **Expected:** After successful planner run, `.claude/resources-pending.md` DOES NOT EXIST. This is the canonical AC-11 assertion: after `/bootstrap-feature` completes, the temp file MUST NOT exist (per architect finding item 3 -- "MANDATORY deletion, not 'may delete' or 'should delete'").

### TC-6.5: Planner inlines temp-file content VERBATIM as first top-level section before `## Prerequisites verified`
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.5, FR-2.6, AC-9; UC-5 primary flow steps 3-5
- **Type:** E2E
- **Preconditions:** `.claude/resources-pending.md` exists with valid content `$RESOURCES`; planner runs
- **Test Steps:**
  1. Capture the content of `.claude/resources-pending.md` into `/tmp/resources.md` before planner runs
  2. Run the planner as part of `/bootstrap-feature`
  3. Read the first portion of `.claude/plan.md`
  4. `head -n $(wc -l < /tmp/resources.md) .claude/plan.md` -- compare to `/tmp/resources.md`
  5. Verify `grep -n "## Prerequisites verified" .claude/plan.md` line is AFTER the `## Recommended Resources` section
  6. Verify `grep -n "## Recommended Resources" .claude/plan.md` returns line 1 (or first line after optional plan header)
- **Expected:**
  - `.claude/plan.md` begins with `## Recommended Resources` as the first top-level heading
  - Content byte-for-byte (modulo whitespace normalization) matches the captured `.claude/resources-pending.md` content
  - `## Prerequisites verified` appears LATER in the file than `## Recommended Resources`
- **Edge Cases:** TC-6.6 (silent skip when temp file absent)

### TC-6.6: Planner skips silently when `.claude/resources-pending.md` is absent (UC-5-A1)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.5 (silent-skip branch), NFR-2; UC-5-A1
- **Type:** E2E
- **Preconditions:** `.claude/resources-pending.md` does NOT exist when planner is invoked (e.g., Step 3.5 failed and did not produce one, or file was manually removed)
- **Test Steps:**
  1. `test ! -f .claude/resources-pending.md` (precondition)
  2. Invoke the planner
  3. Inspect planner's output/log for errors
  4. Read `.claude/plan.md`
- **Expected:**
  - No error raised by planner
  - `.claude/plan.md` does NOT contain a `## Recommended Resources` section
  - Other planner responsibilities (Prerequisites verified, slice breakdown, wave assignment) completed normally
- **Edge Cases:** TC-6.7 (malformed temp file inlined verbatim)

### TC-6.7: Malformed temp file is inlined verbatim (planner is a mechanical copy, not a validator)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.5, FR-6.7, NFR-8; UC-5-EC1
- **Type:** E2E
- **Preconditions:** `.claude/resources-pending.md` is present but malformed (e.g., only 5 of 6 category headings)
- **Test Steps:**
  1. Construct malformed temp file: `cat > .claude/resources-pending.md <<EOF` ... (only 5 categories)
  2. Invoke the planner
  3. Read `.claude/plan.md`
- **Expected:** The malformed content appears verbatim in `.claude/plan.md` under `## Recommended Resources`. The planner does NOT attempt to fix or reject the content. (Malformed content is Plan Critic's concern per TC-11.4.)

### TC-6.8: Planner failure between inlining and deletion leaves temp file on disk (UC-5-E1)
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.3, FR-2.4; UC-5-E1
- **Type:** Integration
- **Preconditions:** Simulate planner crash after writing `.claude/plan.md` but before `rm .claude/resources-pending.md`
- **Test Steps:**
  1. Invoke planner; at the mid-point (after plan.md write, before temp-file delete), inject a simulated failure
  2. `test -f .claude/resources-pending.md` -- expect 0 (file still exists)
  3. `test -f .claude/plan.md` -- expect 0
  4. `grep -c "## Recommended Resources" .claude/plan.md` -- expect at least 1
- **Expected:** After partial failure, `.claude/plan.md` has the inlined section but `.claude/resources-pending.md` persists. This is the documented UC-5-E1 state. The next bootstrap run will overwrite the stale temp file (TC-6.2).

### TC-6.9: `/merge-ready` does NOT check for `.claude/resources-pending.md` absence
- **Category:** Temp-file Lifecycle
- **Covers:** FR-2.3, NFR-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
- **Expected:** Returns `0`. `/merge-ready` neither references nor verifies the temp file, so a persistent temp file (UC-5-E1) does not block merge.

---

## 7. Pipeline Integration

### TC-7.1: `src/commands/bootstrap-feature.md` Step 3.5 is positioned between Step 3 and Step 4
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, FR-3.5, AC-2, AC-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Extract the list of `### Step N:` headings from `src/commands/bootstrap-feature.md`, in document order
  2. Verify sequence includes `Step 3`, then `Step 3.5`, then `Step 4`
- **Expected:** Exact sequence: `Step 1` -> `Step 2` -> `Step 3` -> `Step 3.5` -> `Step 4` -> `Step 5` -> `Step 5.5` -> `Step 6` -> `Step 7`. Step 4 is still QA Lead; Step 5 is still planner (per FR-3.5 -- the half-step is inserted, not renumbered).

### TC-7.2: Step 3.5 body explicitly delegates to `resource-architect` agent
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, AC-2
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. Locate the Step 3.5 body in `src/commands/bootstrap-feature.md`
  2. `grep -E "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  3. Verify the agent name appears in the delegation language (e.g., "Delegate to `resource-architect` agent")
- **Expected:** The Step 3.5 body explicitly names `resource-architect` as the delegated agent.

### TC-7.3: Step 3.5 body documents the architect-verdict forwarding as agent context
- **Category:** Pipeline Integration
- **Covers:** FR-1.2, FR-3.1; architect finding (item 4 -- verdict-forwarding prose)
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. Locate the Step 3.5 body in `src/commands/bootstrap-feature.md`
  2. `grep -iE "architect.+verdict|PASS verdict|architect.+(pass|output).+context" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
  3. Verify that the Step 3.5 prose explicitly states the architect's PASS verdict text (from Step 3) is inlined into the resource-architect spawn prompt
- **Expected:** The Step 3.5 body explicitly describes: the architect's verdict text from Step 3 is forwarded to `resource-architect` as context in the spawn prompt. Per architect finding item 4, this prose MUST be present.
- **Note:** Architect finding item 4 is pivotal; if the verdict is not forwarded, the agent falls back to PRD+use-cases only per risk 4.9 item 8, which silently weakens recommendation quality.

### TC-7.4: Step 3.5 body documents the temp-file output contract (`.claude/resources-pending.md`)
- **Category:** Pipeline Integration
- **Covers:** FR-3.1 (output file documented), FR-2.1, AC-2
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. `grep -n "\.claude/resources-pending\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
- **Expected:** The Step 3.5 body references the exact file path `.claude/resources-pending.md` as the expected agent output.

### TC-7.5: Step 3.5 body documents the hand-off contract to the planner at Step 5
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, FR-2.5
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. Locate Step 3.5 body
  2. `grep -iE "Step 5|planner.+inline|hand.?off" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md`
- **Expected:** Step 3.5 body documents that the planner at Step 5 reads the temp file and inlines it into `.claude/plan.md`.

### TC-7.6: Step 3.5 body explicitly marks the step as MANDATORY and non-skippable
- **Category:** Pipeline Integration
- **Covers:** FR-3.2, AC-3; UC-4 (no-skip even when no resources needed)
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. `grep -iE "mandatory|non.?skippable|cannot skip|always run" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md | grep -B1 -A3 "Step 3.5"` -- or locate the Step 3.5 body and grep within it
- **Expected:** The Step 3.5 body contains the word "mandatory" or "non-skippable" or equivalent, stating the step runs on every feature regardless of whether resources are needed.

### TC-7.7: Step 3.5 failure behavior halts bootstrap (does NOT proceed to Step 4)
- **Category:** Pipeline Integration
- **Covers:** FR-3.3, AC-3; UC-1-E1
- **Type:** Unit
- **Preconditions:** TC-7.1 passes
- **Test Steps:**
  1. Locate Step 3.5 body
  2. `grep -iE "halt|stop|does not proceed|block|fail" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md | grep -iE "resource|3\.5"`
- **Expected:** The Step 3.5 body documents that a `resource-architect` failure halts bootstrap. Step 4 MUST NOT run if Step 3.5 failed (distinct from `changelog-writer`'s non-blocking behavior in Section 3 FR-4.5).

### TC-7.8: Step 3.5 E2E failure -- bootstrap halts when agent returns error
- **Category:** Pipeline Integration
- **Covers:** FR-3.3; UC-1-E1 postconditions
- **Type:** E2E
- **Preconditions:** Simulate a `resource-architect` failure (e.g., PRD is empty)
- **Test Steps:**
  1. Remove or empty `docs/PRD.md`
  2. Invoke `/bootstrap-feature`
  3. Observe: does the command proceed past Step 3.5?
- **Expected:**
  - `/bootstrap-feature` reports the failure to the user
  - Step 4 (QA) does NOT run
  - `.claude/resources-pending.md` does NOT exist (agent did not produce output)

### TC-7.9: `/develop-feature` delegates to `/bootstrap-feature` without direct modification
- **Category:** Pipeline Integration
- **Covers:** FR-3.6
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "bootstrap|/bootstrap-feature" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md`
  2. `grep -iE "resource-architect|resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md`
- **Expected:** Step 1: `/develop-feature` references `/bootstrap-feature` as a delegated subcommand. Step 2: Returns 0 -- `/develop-feature` has no direct reference to `resource-architect` or the temp file (inheritance is automatic per FR-3.6).

### TC-7.10: End-to-end sequence `/bootstrap-feature` produces expected state
- **Category:** Pipeline Integration
- **Covers:** FR-3.1, FR-3.5, AC-9, AC-11; UC-1 through UC-6 triggers
- **Type:** E2E
- **Preconditions:** A fresh feature branch; test PRD with known resource needs (e.g., Playwright MCP); `.claude/resources-pending.md` and `.claude/plan.md` do not pre-exist
- **Test Steps:**
  1. Invoke `/bootstrap-feature` with a test feature
  2. Wait for completion
  3. Verify `docs/PRD.md` has the new section
  4. Verify `docs/use-cases/<feature>_use_cases.md` exists
  5. Verify `docs/qa/<feature>_test_cases.md` exists
  6. Verify `.claude/plan.md` exists
  7. Verify first top-level heading of `.claude/plan.md` is `## Recommended Resources`
  8. Verify `## Prerequisites verified` appears below `## Recommended Resources`
  9. `test ! -f .claude/resources-pending.md` (AC-11: temp file deleted after successful bootstrap)
- **Expected:** All assertions pass. Step sequence 1 -> 2 -> 3 -> 3.5 -> 4 -> 5 -> 5.5 -> 6 -> 7 completed; final plan has Recommended Resources at top; temp file is deleted.

---

## 8. Read-only Probes

### TC-8.1: Agent performs a READ-ONLY probe of `~/.claude/settings.json` when checking MCP install status
- **Category:** Read-only Probes
- **Covers:** FR-5.2, FR-5.6; UC-1-A1
- **Type:** Integration
- **Preconditions:** Playwright MCP is already configured in `~/.claude/settings.json`
- **Test Steps:**
  1. Capture mtime and sha256 of `~/.claude/settings.json` before agent run
  2. Invoke `resource-architect` on a feature needing Playwright
  3. Capture mtime and sha256 after
  4. Compare -- must be byte-identical
  5. Read `.claude/resources-pending.md` and verify the Install/activate field for Playwright reflects "Already installed"
- **Expected:**
  - `~/.claude/settings.json` mtime and hash unchanged
  - The Playwright entry's Install/activate field is adjusted (per UC-1-A1 step 4) to indicate already-installed status

### TC-8.2: Agent falls back to normal "run this command" wording when `~/.claude/settings.json` is absent
- **Category:** Read-only Probes
- **Covers:** FR-5.2, FR-5.6; UC-1-A1 step 7 (fallback)
- **Type:** Integration
- **Preconditions:** `~/.claude/settings.json` does not exist
- **Test Steps:**
  1. `mv $HOME/.claude/settings.json $HOME/.claude/settings.json.bak` (if present)
  2. Invoke `resource-architect` on a Playwright-needing feature
  3. Read the Install/activate field for Playwright
  4. Restore: `mv $HOME/.claude/settings.json.bak $HOME/.claude/settings.json`
- **Expected:** Install/activate field contains the normal `claude mcp add playwright ...` copy-paste command. No error raised by the agent.

### TC-8.3: Agent falls back gracefully when `~/.claude/settings.json` is unreadable (permission denied)
- **Category:** Read-only Probes
- **Covers:** FR-5.2; UC-1-A1 fallback
- **Type:** Integration
- **Preconditions:** `~/.claude/settings.json` exists but is `chmod 000`
- **Test Steps:**
  1. `chmod 000 $HOME/.claude/settings.json`
  2. Invoke `resource-architect`
  3. Read `.claude/resources-pending.md`
  4. Restore permissions: `chmod 644 $HOME/.claude/settings.json`
- **Expected:** Agent completes without error. Install/activate field defaults to normal "run this command" wording (per UC-1-A1 step 7).

### TC-8.4: Agent falls back gracefully when `~/.claude/settings.json` is malformed JSON
- **Category:** Read-only Probes
- **Covers:** FR-5.2; UC-1-A1 fallback (unexpected format)
- **Type:** Integration
- **Preconditions:** `~/.claude/settings.json` contains invalid JSON
- **Test Steps:**
  1. Backup original, then: `echo "not-json {{{" > $HOME/.claude/settings.json`
  2. Invoke `resource-architect`
  3. Restore original file
- **Expected:** Agent completes without error. Normal wording is used. No exception leaks to the user. The probe is best-effort.

---

## 9. Error & Edge Cases

### TC-9.1: Empty PRD halts bootstrap at Step 3.5 (UC-1-E1)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.2, FR-3.3; UC-1-E1
- **Type:** E2E
- **Preconditions:** `docs/PRD.md` is empty or unreadable
- **Test Steps:**
  1. `echo "" > docs/PRD.md`
  2. Invoke `/bootstrap-feature`
  3. Observe agent output and bootstrap exit state
- **Expected:** Agent returns structured error (no PRD to analyze). `/bootstrap-feature` halts at Step 3.5; Step 4 (QA) does NOT run. `.claude/resources-pending.md` does NOT exist.

### TC-9.2: Missing `docs/PRD.md` halts bootstrap at Step 3.5
- **Category:** Error & Edge Cases
- **Covers:** FR-1.2, FR-3.3; UC-1-E1 variant (missing file)
- **Type:** E2E
- **Preconditions:** `docs/PRD.md` does not exist
- **Test Steps:**
  1. `rm -f docs/PRD.md`
  2. Invoke `/bootstrap-feature`
- **Expected:** Agent surfaces missing-file error. Bootstrap halts at Step 3.5.

### TC-9.3: Missing `.claude/resources-pending.md` at Step 5 triggers silent skip, not error (UC-5-A1)
- **Category:** Error & Edge Cases
- **Covers:** FR-2.5 silent-skip; UC-5-A1
- **Type:** E2E
- **Preconditions:** Plan file does not have the section; `.claude/resources-pending.md` does not exist
- **Test Steps:**
  1. `rm -f .claude/resources-pending.md`
  2. Invoke planner agent directly (bypassing Step 3.5)
  3. Read resulting `.claude/plan.md`
- **Expected:** No error raised. `.claude/plan.md` lacks the `## Recommended Resources` section but otherwise valid. Pipeline is not blocked.

### TC-9.4: Feature with NO external resources emits explicit "No external resources required" (UC-4)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.5, AC-10; UC-4 primary flow
- **Type:** Integration
- **Preconditions:** Test feature is a pure refactor (extracting shared logic, no new APIs)
- **Test Steps:**
  1. Invoke `resource-architect` on the pure-refactor feature
  2. Read `.claude/resources-pending.md`
  3. `grep -cE "No external resources required" .claude/resources-pending.md`
  4. Verify all six category headings are present with `(none)` underneath (per AC-10)
  5. Verify summary line reports "0 recommendations total; 0 `expensive`; 0 `hard`"
- **Expected:** All six assertions pass. The file is not empty, not a no-op return -- it contains the explicit statement AND the six `(none)`-marked category headings.

### TC-9.5: Comment-only refactor skipped entirely per CLAUDE.md pipeline exemption (UC-4-EC1)
- **Category:** Error & Edge Cases
- **Covers:** CLAUDE.md pipeline exemption (out of scope for resource-architect); UC-4-EC1
- **Type:** Unit
- **Preconditions:** Feature is a trivial comment-only or typo fix
- **Test Steps:**
  1. Verify: the developer does not invoke `/bootstrap-feature` (per CLAUDE.md exemption)
  2. `test ! -f .claude/resources-pending.md`
- **Expected:** `resource-architect` does not run. `.claude/resources-pending.md` does not exist. Not a failure mode -- the agent is simply not invoked.

### TC-9.6: PRD explicitly mentioning deferred/out-of-scope browser testing produces no MCP recommendation (UC-1-EC1)
- **Category:** Error & Edge Cases
- **Covers:** FR-1.5, FR-1.7, FR-4.2; UC-1-EC1
- **Type:** Integration
- **Preconditions:** Test PRD contains a subsection marked "out of scope for iteration 1" that mentions browser testing
- **Test Steps:**
  1. Invoke `resource-architect`
  2. Read `.claude/resources-pending.md`
  3. `grep -cE "Playwright" .claude/resources-pending.md` (under `### MCP`)
- **Expected:** Playwright MCP is NOT recommended (deferred-scope requirement). MCP category shows `(none)` if no other MCP is needed. If no other categories have entries, the body also emits "No external resources required."

### TC-9.7: Stale temp file from different feature branch is overwritten cleanly (UC-10-EC1)
- **Category:** Error & Edge Cases
- **Covers:** FR-2.4; UC-10-EC1
- **Type:** Integration
- **Preconditions:** `.claude/resources-pending.md` exists containing content from a different feature (e.g., an abandoned branch's output)
- **Test Steps:**
  1. Pre-populate: `cat > .claude/resources-pending.md <<EOF ... (different feature's recommendations) EOF`
  2. Checkout current feature branch
  3. Invoke `resource-architect`
  4. Read `.claude/resources-pending.md`
  5. Grep for any content fragment from the old feature
- **Expected:** The overwritten temp file contains only current-branch recommendations. No cross-feature contamination.

### TC-9.8: Re-run of `/bootstrap-feature` on the same branch produces clean idempotent output (UC-8)
- **Category:** Error & Edge Cases
- **Covers:** FR-2.4; UC-8 primary flow
- **Type:** E2E
- **Preconditions:** First run completed; developer re-runs `/bootstrap-feature` on the same feature branch (common: aborted mid-run, or editing PRD and re-running)
- **Test Steps:**
  1. Complete run 1 of `/bootstrap-feature`; capture `.claude/plan.md` content
  2. (Optionally) edit PRD slightly
  3. Complete run 2 of `/bootstrap-feature`
  4. Compare run-2 plan's `## Recommended Resources` to the first run
- **Expected:** Run 2 produces fresh `.claude/plan.md` reflecting current PRD. No stale content from run 1 persists in either the temp file or the plan file.

### TC-9.9: Aborted Step 3.5 leaves partial temp file; re-run overwrites cleanly (UC-8-EC1)
- **Category:** Error & Edge Cases
- **Covers:** FR-2.4; UC-8-EC1
- **Type:** Integration
- **Preconditions:** Previous run aborted DURING the agent's write to `.claude/resources-pending.md`, leaving partial content
- **Test Steps:**
  1. Simulate partial write: `echo "## Recommended Resources\n(incomplete" > .claude/resources-pending.md`
  2. Invoke `resource-architect` fresh
  3. Read final `.claude/resources-pending.md`
- **Expected:** Partial content replaced entirely. Final content is structurally valid (six category headings, summary line, etc.) and no "(incomplete" fragment appears.

---

## 10. Cross-file Consistency

### TC-10.1: `src/claude.md` and `src/CLAUDE.md` Agency Roles tables are character-identical in all shared rows
- **Category:** Cross-file Consistency
- **Covers:** FR-6.1; architect finding (item 5 -- `src/CLAUDE.md` mirror)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Extract the Agency Roles table block from `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  2. Extract the Agency Roles table block from `/Users/aleksandra/Documents/claude-code-sdlc/src/CLAUDE.md`
  3. `diff <(awk '/^| Role/,/^$/' src/claude.md) <(awk '/^| Role/,/^$/' src/CLAUDE.md)`
- **Expected:** Zero differences in the Agency Roles table between the two files. Both contain the new `resource-architect` row in the same position.

### TC-10.2: Plan Critic prompt in `src/claude.md` recognizes `## Recommended Resources` as valid section
- **Category:** Cross-file Consistency
- **Covers:** FR-6.7, AC-14; UC-11 primary flow
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Locate the Plan Critic prompt block in `src/claude.md`
  2. `grep -iE "Recommended Resources|resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
  3. Verify the critic prompt either (a) explicitly lists `## Recommended Resources` as a valid plan section, OR (b) explicitly states that absence of the section MUST NOT be flagged (per FR-6.7)
- **Expected:** At least one match. Content establishes the critic recognizes the section.

### TC-10.3: Plan Critic prompt in `src/CLAUDE.md` matches `src/claude.md` for the new section recognition
- **Category:** Cross-file Consistency
- **Covers:** FR-6.7, AC-14; architect finding (item 5 -- critic prompt mirror)
- **Type:** Unit
- **Preconditions:** TC-10.2 passes
- **Test Steps:**
  1. Locate Plan Critic prompt in `src/CLAUDE.md`
  2. `grep -iE "Recommended Resources|resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/CLAUDE.md`
  3. Compare matches to `src/claude.md` critic prompt (TC-10.2)
- **Expected:** Both files contain identical critic-prompt updates regarding `## Recommended Resources`. No divergence between the two.

### TC-10.4: All "15 agents" references are in sync across install.sh, README, and both CLAUDE files
- **Category:** Cross-file Consistency
- **Covers:** FR-6.2, FR-6.5, NFR-5
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Collect all "14" and "15" agent-count occurrences from: `install.sh`, `README.md`, `src/claude.md`, `src/CLAUDE.md`
  2. Verify zero remaining "14" agent-count references exist
  3. Verify all "15" agent-count references are consistent
- **Expected:** No stale "14" remain in any of the five files. Counts of "15" agent-count references match the enumeration in PRD section 4.6 Agent Count Propagation table: exactly 2 in README, exactly 5 in install.sh, 0 in src/claude.md prose (per TC-1.14 no-op), 0 in src/CLAUDE.md prose.

### TC-10.5: Cross-references between agent file, command file, and planner file are valid (no phantom paths)
- **Category:** Cross-file Consistency
- **Covers:** FR-2.1, FR-2.5, AC-15
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Verify `src/commands/bootstrap-feature.md` references `resource-architect` (exact name from agent's frontmatter)
  2. Verify `src/commands/bootstrap-feature.md` references `.claude/resources-pending.md` (exact path)
  3. Verify `src/agents/planner.md` references `.claude/resources-pending.md` (exact path, same spelling)
  4. Verify `src/claude.md` Agency Roles row references `resource-architect` (same name)
  5. Verify `src/agents/resource-architect.md` internally references its own agent name
  6. `test -f src/agents/resource-architect.md` (the referenced file exists)
- **Expected:** All cross-references resolve. No path or name divergence.

### TC-10.6: Unchanged-file manifest files (per PRD 4.6 "Unchanged Files" table) are byte-unchanged
- **Category:** Cross-file Consistency
- **Covers:** PRD 4.6 Unchanged Files table; AC-15 (no phantom modifications)
- **Type:** Unit
- **Preconditions:** Before-feature snapshot exists for each file in the Unchanged Files table
- **Test Steps:**
  1. For each file in the PRD 4.6 "Unchanged Files" table: compute sha256 of the file before and after this feature's changes
  2. Verify all sha256 values match
  3. Specifically verify: `src/agents/architect.md`, `src/agents/ba-analyst.md`, `src/agents/qa-planner.md`, `src/agents/prd-writer.md`, `src/agents/changelog-writer.md`, `src/commands/develop-feature.md`, `src/commands/merge-ready.md`, `src/commands/implement-slice.md`, `src/commands/context-refresh.md`, `src/rules/*.md`
- **Expected:** All files in the Unchanged Files table have identical pre- and post-feature sha256.

---

## 11. Iteration 1 Boundary

### TC-11.1: Agent does NOT install anything (no `claude mcp add` invocation observed)
- **Category:** Iteration 1 Boundary
- **Covers:** FR-5.1, FR-5.3, FR-5.5, PRD 4.8 item 1; UC-7 step 4
- **Type:** E2E
- **Preconditions:** Agent runs on a feature needing multiple resources
- **Test Steps:**
  1. Invoke `resource-architect` against a test feature
  2. Inspect tool-use trace for any `Bash`-tool invocations (should be 0 per TC-3.9)
  3. Verify `~/.claude/settings.json` is unchanged post-run (TC-8.1 pattern)
  4. Verify no package was installed (check `node_modules/`, `~/.local/lib/python`, etc.)
- **Expected:** Zero install operations. The agent's output contains the commands as text only.

### TC-11.2: `/merge-ready` does NOT re-check resource recommendations
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 2, NFR-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "resource-architect|resources-pending|Recommended Resources" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
- **Expected:** Returns `0`. `/merge-ready` has no reference to the resource-recommendation step. No re-check logic.

### TC-11.3: Cross-feature cost tracking is NOT implemented
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 3
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -rE "aggregate.+expensive|cross-feature cost|expensive.+budget" /Users/aleksandra/Documents/claude-code-sdlc/src/`
- **Expected:** Returns 0 hits. Cross-feature aggregation is deferred.

### TC-11.4: No cloud-provider SDK integration (no AWS/GCP/Azure API calls)
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 4, NFR-6
- **Type:** E2E
- **Preconditions:** Network monitor in place during agent run
- **Test Steps:**
  1. Invoke agent on cloud-needing feature (UC-2)
  2. Monitor network egress
  3. `grep -iE "aws\.amazon\.com|googleapis\.com|azure\.com" <network-monitor log>`
- **Expected:** Zero cloud-provider API calls.

### TC-11.5: No teardown recommendations when feature is reverted
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 5
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "teardown|uninstall.+recommendation|reverted.+resource" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** Reversibility is captured per-resource at bootstrap time (TC-4.8) for developer reasoning, but no teardown step is triggered by revert.

### TC-11.6: No cross-feature resource conflict detection
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 6
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "conflict detection|cross-feature conflict|resource collision" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** Returns 0. Conflict detection is deferred.

### TC-11.7: No post-hoc mid-implementation re-invocation
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 8, NFR-9
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "resource-architect|resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md`
  2. `grep -iE "resource-architect|resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/context-refresh.md`
- **Expected:** Both return 0. Slice-level implementation does not re-invoke the agent.

### TC-11.8: No programmatic validation of six-field format in iteration 1
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 9, NFR-8
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -rE "validate.+six.?field|field validator|schema validation" /Users/aleksandra/Documents/claude-code-sdlc/src/`
- **Expected:** Returns 0. Validation is via prompt guidance + Plan Critic MINOR findings only (per TC-11.9).

### TC-11.9: Recommendation quality is prompt-driven, not learned
- **Category:** Iteration 1 Boundary
- **Covers:** PRD 4.8 item 10
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. `grep -iE "feedback|learning|history|past recommendations" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md`
- **Expected:** Returns 0. No feedback loop; recommendations are entirely prompt-driven per iteration 1.

---

## 12. Plan Critic Integration

### TC-12.1: Plan Critic does NOT flag presence of `## Recommended Resources` as a finding
- **Category:** Plan Critic Integration
- **Covers:** FR-6.7, AC-14; UC-11 primary flow
- **Type:** Integration
- **Preconditions:** `.claude/plan.md` contains a well-formed `## Recommended Resources` section; Plan Critic is spawned
- **Test Steps:**
  1. Run Plan Critic per the `src/claude.md` Plan Critic prompt
  2. Inspect FINDINGS output
  3. Verify no finding references `## Recommended Resources` as invalid or unrecognized
- **Expected:** Zero FINDINGS mention the section as a problem. It is treated as a valid top-level plan section.

### TC-12.2: Plan Critic does NOT flag ABSENCE of `## Recommended Resources` as a finding
- **Category:** Plan Critic Integration
- **Covers:** FR-6.7, AC-14, NFR-2; UC-11-A1
- **Type:** Integration
- **Preconditions:** `.claude/plan.md` lacks the section (e.g., legacy plan or UC-5-A1 silent-skip scenario); Plan Critic is spawned
- **Test Steps:**
  1. Construct a plan file without `## Recommended Resources`
  2. Run Plan Critic
  3. Inspect FINDINGS
- **Expected:** No finding flags the absence of `## Recommended Resources`. Legacy plans continue to pass critic checks.

### TC-12.3: Plan Critic MAY flag malformed recommendation entries as MINOR finding
- **Category:** Plan Critic Integration
- **Covers:** FR-6.7, NFR-8; UC-11-EC1
- **Type:** Integration
- **Preconditions:** `.claude/plan.md` has a `## Recommended Resources` section with an entry missing one or more of the six FR-1.4 fields
- **Test Steps:**
  1. Construct a plan with a malformed entry (e.g., missing Reversibility)
  2. Run Plan Critic
  3. Inspect FINDINGS for a MINOR finding referencing the malformed entry
- **Expected:** A MINOR finding is raised. It cites the missing field(s) and references FR-1.4. The finding is MINOR (not CRITICAL or MAJOR -- iteration 1 does not enforce programmatically).

### TC-12.4: Plan Critic prompt update is identical in `src/claude.md` and `src/CLAUDE.md`
- **Category:** Plan Critic Integration
- **Covers:** FR-6.7; architect finding (item 5 -- mirror)
- **Type:** Unit
- **Preconditions:** Feature is shipped
- **Test Steps:**
  1. Extract Plan Critic block from `src/claude.md` (between `### Plan Critic Pass` and the next `###` heading)
  2. Extract same block from `src/CLAUDE.md`
  3. `diff <block_from_src> <block_from_src/CLAUDE>`
- **Expected:** Both blocks are identical. Any update to the critic prompt in one file is mirrored in the other.

---

## 13. Defensive Tests for Multiple Interpretations

These tests cover PRD or use-case ambiguity where the planner must pin ONE canonical interpretation during implementation. Each test exercises BOTH valid alternatives so coverage is preserved either way.

### TC-13.1: Auth0 entry appears under EITHER `External API` OR `Third-party Service`, not both
- **Category:** Defensive Tests
- **Covers:** FR-4.4, FR-4.5; UC-3 step 2 ambiguity
- **Type:** Integration
- **Preconditions:** Test feature needs OAuth via Auth0
- **Test Steps:**
  1. Invoke `resource-architect`
  2. Count Auth0 occurrences as `####` entries: `grep -cE "^#### Auth0" .claude/resources-pending.md`
  3. Verify Auth0 appears under exactly ONE of `### External API` or `### Third-party Service`
- **Expected:** Auth0 entry count is exactly 1. Duplicate entries across categories are prohibited per UC-3 step 2 explicit "test validates the choice is ONE of the two categories".

### TC-13.2: Empty-category representation is `(none)` [TBD -- update after planner pins exact string]
- **Category:** Defensive Tests
- **Covers:** FR-1.7; UC-1 step 6 format ambiguity
- **Type:** Integration
- **Preconditions:** Test feature leaves at least one category empty
- **Test Steps:**
  1. Invoke `resource-architect` on a partial-spectrum feature
  2. Verify empty categories have `(none)` underneath the `###` heading, on its own line
  3. Do NOT accept: empty line, "N/A", "None", `- (none)`, italic `*(none)*`
- **Expected:** Exactly the literal string `(none)` on its own line. Any alternative representation is rejected.
- **Note:** TBD -- if planner pins an alternative (e.g., bold or italicized), update to match.

---

## Summary

### Use Case Coverage

All 31 scenarios across 12 UCs mapped to test cases:

| UC | Scenarios | Test Cases |
|----|-----------|------------|
| UC-1 | Primary flow | TC-5.1, TC-4.1, TC-4.3, TC-4.4, TC-4.5, TC-7.10, TC-8.1 |
| UC-1-A1 | Playwright already installed | TC-8.1 |
| UC-1-E1 | PRD unreadable | TC-7.8, TC-9.1, TC-9.2 |
| UC-1-EC1 | Deferred browser-testing scope | TC-9.6 |
| UC-2 | Primary flow | TC-5.2 |
| UC-2-A1 | No documented budget | TC-4.9 (Why field cites PRD) |
| UC-2-EC1 | Laptop GPU as Hardware | TC-5.6 |
| UC-3 | Primary flow | TC-5.3, TC-5.4, TC-13.1 |
| UC-3-A1 | Multiple competing OAuth | TC-13.1 |
| UC-3-E1 | Network attempt | TC-3.10, TC-11.4 |
| UC-3-EC1 | In-house auth; bcrypt excluded | TC-5.5, TC-9.4 |
| UC-4 | Primary flow | TC-9.4, TC-4.2, TC-4.10 |
| UC-4-EC1 | Comment-only refactor exempt | TC-9.5 |
| UC-5 | Primary flow | TC-6.4, TC-6.5, TC-7.10 |
| UC-5-A1 | Planner silent skip | TC-6.6, TC-9.3, TC-12.2 |
| UC-5-E1 | Planner crash between inline and delete | TC-6.8, TC-6.9 |
| UC-5-EC1 | Malformed temp file inlined verbatim | TC-6.7, TC-12.3 |
| UC-6 | Full-spectrum feature | TC-5.1, TC-5.2, TC-5.3, TC-5.4, TC-5.7 |
| UC-6-A1 | All six categories | TC-4.3, TC-4.5 |
| UC-6-EC1 | Ambiguous category classification | TC-13.1 |
| UC-7 | Authority boundary enforcement | TC-3.1, TC-3.8, TC-3.9 |
| UC-7-E1 | Write-location violation | TC-3.8 |
| UC-8 | Idempotency on re-run | TC-6.2, TC-6.3, TC-9.8 |
| UC-8-EC1 | Aborted mid-Step-3.5 | TC-9.9 |
| UC-9 | Scope discipline (no agent recommendations) | TC-3.7, TC-5.8 |
| UC-9-EC1 | PRD mentions existing agent name | TC-5.8 |
| UC-10 | Stale temp file overwrite | TC-6.2, TC-9.7 |
| UC-10-EC1 | Stale from different branch | TC-9.7 |
| UC-11 | Plan Critic recognizes section | TC-12.1 |
| UC-11-A1 | Plan without section | TC-12.2 |
| UC-11-EC1 | Malformed entries flagged MINOR | TC-12.3 |
| UC-12 | Feature branch rebuilt after merge | TC-6.4, TC-10.6 |
| UC-12-EC1 | `.claude/` committed to git | TC-6.4 (planner fully replaces plan file) |

**Coverage:** 31/31 scenarios mapped.

### Acceptance Criteria Coverage

| AC | Test Case(s) |
|----|--------------|
| AC-1 | TC-1.1, TC-1.2, TC-1.3, TC-1.4 |
| AC-2 | TC-1.15, TC-7.1, TC-7.2, TC-7.3, TC-7.4, TC-7.5 |
| AC-3 | TC-7.6, TC-7.7, TC-7.8, TC-9.1, TC-9.2 |
| AC-4 | TC-1.16, TC-1.17, TC-6.5 |
| AC-5 | TC-1.6, TC-1.12, TC-1.13 |
| AC-6 | TC-1.6, TC-1.9, TC-1.10, TC-1.11 |
| AC-7 | TC-1.7, TC-1.8 |
| AC-8 | TC-1.5 |
| AC-9 | TC-7.1, TC-7.10, TC-6.5 |
| AC-10 | TC-4.10, TC-9.4 |
| AC-11 | TC-6.4, TC-7.10 |
| AC-12 | TC-1.3, TC-1.4, TC-3.9 |
| AC-13 | TC-4.5, TC-4.6, TC-4.7, TC-4.8 |
| AC-14 | TC-10.2, TC-10.3, TC-12.1, TC-12.2 |
| AC-15 | TC-10.5, TC-10.6 |

**Coverage:** 15/15 acceptance criteria mapped.

### Functional Requirement Coverage (runtime-observable)

| FR | Test Case(s) | Notes |
|----|--------------|-------|
| FR-1.1 | TC-1.1, TC-1.2, TC-2.4 | Agent file exists with valid frontmatter |
| FR-1.2 | TC-2.1, TC-2.2, TC-7.3 | Four inputs read; scratchpad prohibited; architect verdict forwarded |
| FR-1.3 | TC-4.3, TC-5.7 | Six categories, exhaustive |
| FR-1.4 | TC-4.5, TC-4.6, TC-4.7, TC-4.8, TC-4.9 | Six-field entry schema |
| FR-1.5 | TC-9.4, TC-9.6 | Explicit "No external resources required" |
| FR-1.6 | TC-4.2 | Summary line with counts |
| FR-1.7 | TC-4.3, TC-4.10 | Six categories always appear with `(none)` |
| FR-2.1 | TC-3.8, TC-6.1 | Write only to temp-file path |
| FR-2.2 | TC-4.1, TC-4.11 | Temp-file structure (heading + summary + six subsections) |
| FR-2.3 | TC-6.4, TC-6.8, TC-6.9 | Temp-file lifecycle |
| FR-2.4 | TC-6.2, TC-6.3, TC-9.7, TC-9.9 | Overwrite, no merge |
| FR-2.5 | TC-1.16, TC-1.17, TC-6.5, TC-6.6, TC-6.7, TC-9.3 | Planner inline-and-delete |
| FR-2.6 | TC-6.5, TC-7.10 | `## Recommended Resources` at top of plan |
| FR-3.1 | TC-1.15, TC-7.1, TC-7.2, TC-7.3, TC-7.4, TC-7.5 | Step 3.5 inserted with all required body elements |
| FR-3.2 | TC-7.6, TC-9.4 | Step 3.5 mandatory, non-skippable |
| FR-3.3 | TC-7.7, TC-7.8, TC-9.1, TC-9.2 | Failure halts bootstrap |
| FR-3.4 | TC-1.16 | Planner updated; other responsibilities preserved |
| FR-3.5 | TC-7.1 | Half-step insertion without renumbering |
| FR-3.6 | TC-7.9 | `/develop-feature` delegates without direct change |
| FR-4.1 | TC-5.7, TC-5.8 | Six categories only |
| FR-4.2 | TC-5.1, TC-9.6 | MCP category |
| FR-4.3 | TC-5.2 | Cloud/Compute excludes "laptop" |
| FR-4.4 | TC-5.3, TC-13.1 | External API code-path-coupled |
| FR-4.5 | TC-5.4, TC-13.1 | Third-party Service operational-coupled |
| FR-4.6 | TC-5.5 | Library/Framework excludes utilities |
| FR-4.7 | TC-5.6 | Hardware non-cloud |
| FR-5.1 | TC-3.1, TC-3.7 | Authority Boundary + Output Boundary |
| FR-5.2 | TC-3.2, TC-3.8, TC-8.1 | No writes to settings.json |
| FR-5.3 | TC-3.3, TC-11.1 | No claude mcp add invocation |
| FR-5.4 | TC-3.4, TC-3.8 | No credential/env modifications |
| FR-5.5 | TC-3.5, TC-11.1 | No package-manager invocations |
| FR-5.6 | TC-3.6, TC-3.10, TC-11.4 | No network calls |
| FR-5.7 | TC-1.3, TC-1.4, TC-3.9 | Bash tool excluded |
| FR-6.1 | TC-1.12, TC-1.13, TC-10.1 | Agency Roles row |
| FR-6.2 | TC-1.7, TC-1.9, TC-1.14 | 14 -> 15 references (no-op in src/claude.md prose) |
| FR-6.3 | TC-1.10 | README agent table row |
| FR-6.4 | TC-1.11 | README feature section |
| FR-6.5 | TC-1.7, TC-1.8 | install.sh 5 banner updates |
| FR-6.6 | TC-1.5 | install.sh copies agent |
| FR-6.7 | TC-10.2, TC-10.3, TC-12.1, TC-12.2, TC-12.3 | Plan Critic recognition |

**Coverage:** all runtime-observable FRs have at least one positive test.

### NFR Coverage (measurable only)

| NFR | Test Case(s) |
|-----|--------------|
| NFR-1 (markdown-only) | TC-1.1, TC-1.2 (implicit from file-only mutations) |
| NFR-2 (backward compat) | TC-6.6, TC-12.2 |
| NFR-4 (opus model) | TC-1.2, TC-2.3 |
| NFR-5 (15 agents total) | TC-1.6, TC-10.4 |
| NFR-6 (no network) | TC-3.6, TC-3.10, TC-11.4 |
| NFR-7 (< 30s runtime) | TC-3.10 (if observed) |
| NFR-8 (strict 6-field format) | TC-4.5, TC-4.6, TC-4.7, TC-4.8, TC-12.3 |
| NFR-9 (one-shot per bootstrap) | TC-6.9, TC-11.2, TC-11.7 |

NFR-3 (installer-driven activation) is verified by TC-1.5 through TC-1.8.

---

## Ambiguity Flags -- TBD Test Cases

The following test cases are marked `[TBD -- update after planner pins X]` because the PRD is ambiguous on at least one dimension. The Tech Lead (planner) must pin ONE canonical interpretation during implementation planning; these tests will be updated or consolidated once pinned.

| TBD Marker | Source Ambiguity | Resolution Needed |
|------------|------------------|-------------------|
| TC-4.3 | `###` vs. `##` for category headings | Architect finding item 2 pins `###` for categories, but the planner must confirm in the agent prompt |
| TC-4.4 | `####` vs. `###` for individual resource names | Architect finding item 2 pins `####` for resources; the planner must confirm |
| TC-13.2 | Exact literal for empty-category marker | PRD says `(none)`; planner must confirm whether this is plain, bulleted, or formatted differently |
| (implicit) | Exact wording of Authority Boundary section | TC-3.1 through TC-3.7 test for presence; if the planner pins specific headings (e.g., "### Authority Boundary" vs. "### Prohibited Actions"), these tests should be updated to match the pinned heading |
| (implicit) | Exact phrasing of architect-verdict forwarding | TC-7.3 tests for the semantic requirement (verdict-in-context); the planner may choose specific wording that these tests should then match |
| (implicit) | Exact wording of MANDATORY deletion in planner.md | TC-1.17 tests for MUST-level language; planner must choose the specific verb |

---

## Defensive Tests for Multiple Interpretations

Where the PRD did not pin an interpretation, the following tests were written to cover BOTH valid alternatives (so coverage is not lost if the planner chooses either direction):

1. **TC-13.1** -- Auth0 classification under External API vs. Third-party Service. The test asserts the agent picks ONE (not both) but does not favor which.

2. **TC-4.4 / TC-4.5 heading hierarchy** -- The architect finding pinned `###` for categories and `####` for resources, but the planner may update based on implementation details. Tests are strict on the exact markdown levels but flagged TBD.

3. **TC-12.3 (Plan Critic MINOR finding)** -- The PRD says the critic MAY raise a MINOR finding on malformed entries. Tests assert BOTH (a) the critic CAN raise MINOR findings and (b) the finding stays MINOR (not CRITICAL/MAJOR) since iteration 1 does not enforce programmatically.

4. **TC-1.14 (no-op verification for `src/claude.md` "14 agents" prose)** -- Per the architect's PRD inaccuracy flag, the prose never contained "14 agents" so the FR-6.2 update is a no-op in that file. The test asserts that both before and after this feature, `grep -c "14 agents" src/claude.md` returns 0.
