# Test Cases: Auto-Persist Plan-Mode Plans to Project

> Based on [PRD](../PRD.md) — Section 14 and [Use Cases](../use-cases/auto-persist-plan-mode_use_cases.md)

## Facts

### Verified facts

- PRD Section 14 (`docs/PRD.md` lines 3462–3617) is the authoritative source for all functional requirements FR-AP-1.1 through FR-AP-4.2, non-functional requirements NFR-AP-1 through NFR-AP-5, and acceptance criteria AC-AP-1 through AC-AP-10. Source: `docs/PRD.md` lines 3462–3617 read in this session.
- PRD §14 `Date: 2026-05-02` (line 3465) is on or after `MERGE_DATE` (cognitive-self-check rule backward-compatibility cutoff); the `## Facts` block is mandatory. Source: `docs/PRD.md` line 3465 read in this session.
- Use cases document (`docs/use-cases/auto-persist-plan-mode_use_cases.md` lines 1–631) specifies 10 primary use cases: UC-1 (primary flow), UC-1-A1 (overwrite), UC-1-E1 (write fails), UC-2 (bootstrap passes), UC-2-A1 (planner refines), UC-3 (overwrite existing), UC-4 (no git root), UC-4-E1 (no .claude dir), UC-5 (bootstrap aborts), UC-6 (rule violation caught), UC-7 (empty plan.md), UC-8 (.claude absent), UC-9 (backs out), UC-10 (special chars). Covered in this session.
- Knowledge base status verified via `claudeknows status --json`: `doc_count: 28`, `chunk_count: 51542`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db`. Corpus scope relevance: **No overlap**. Observed corpus domain: ML/AI, data engineering, SRE, software engineering (generic). Task domain: meta-SDLC agent orchestration, Claude Code plan-mode persistence, markdown prompt engineering. No topical queries were run per the corpus-scope-relevance protocol.
- Existing test-case format verified by reading `docs/qa/role-planner_test_cases.md` (lines 1–200) in this session. Format conventions: numbered sections (1., 2., 3., ...), subsections with TC identifiers (TC-X.Y), columns for Category, Covers (FR/AC), Type, Preconditions, Test Steps, Expected, Edge Cases.
- Architect pre-review verdict PASS — 5 STRUCTURAL decisions resolved: (1) Step 0 uses `Bash mkdir -p .claude` to create directory if absent (UC-4-E1, UC-8-A1 implementation path), (2) empty plan.md (`0` bytes) treated as present per FR-AP-2.6 (presence-only), (3) UC-7 planner fallback applies, (4) `Write` tool string parameter avoids shell interpolation (UC-10), (5) rule text lives in `src/claude.md` adjacent to ExitPlanMode section. Source: architect verbal summary in prior session; Slice 1 implementation will verify.

### External contracts

- **Claude Code `ExitPlanMode` tool** — symbol: `ExitPlanMode()` (no required parameters per standard plan-mode behavior; terminates plan-mode session when called) — source: `~/.claude/CLAUDE.md` (system-reminder context, global rules) references `ExitPlanMode` throughout; consistent usage in `src/claude.md` per PRD §14.3 FR-AP-1.1 — verified: no — assumption. Risk: future Claude Code version may rename or restructure the tool. Verification: architect pre-review step or Slice 1 tool manifest check.
- **Claude Code `Write` tool** — symbol: `Write` with parameters `file_path: string` and `content: string`; writes content verbatim to disk without shell interpolation or heredoc processing — source: `~/.claude/rules/tool-limitations.md` (system-reminder context, rule file read in this session) explicitly documents `Write` tool string-parameter interface; confirmed as safe for special-character content — verified: yes (tool-limitations rule file describes the Write tool's non-heredoc behavior).
- **Claude Code `Glob` tool** — symbol: `Glob` with parameter `pattern: string`; returns file matches or empty on no match — source: assumed from common usage in `src/agents/` files and bootstrap command patterns — verified: no — assumption. Risk: if Glob does not support exact-path matching (e.g., pattern `<project>/.claude/plan.md`), Step 0's presence check may need `Read`-with-error-catching or `Bash ls` instead. Verification: Slice 2 implementation of Step 0.
- **POSIX `[ -s file ]` check** — symbol: test expression `[ -s file ]` returns 0 if file exists and has size > 0 bytes; returns 1 if file absent or 0 bytes — source: POSIX shell specification (not opened this session) — verified: no — assumption. Risk: non-POSIX shells may differ. Verification: Slice 1 Bash implementation can use `[ -s ]` directly or via other POSIX-safe test approaches.
- **Git `rev-parse --show-toplevel`** — symbol: `git rev-parse --show-toplevel` outputs the root path of the enclosing git repository; exits with error if not inside a git repo — source: `git` manual (not opened this session) — verified: no — assumption. Risk: if git version or environment differs, the command may not behave identically. Verification: Slice 1 and Slice 4 use it per UC-4 primary flow.
- **Claude Code `Bash` tool** — symbol: `Bash` with parameter `command: string`; executes bash command and returns stdout/stderr — source: `~/.claude/CLAUDE.md` (system-reminder context) references `Bash` tool throughout — verified: no — assumption. Risk: Bash tool availability in plan-mode context is unverified (see PRD §14.8 Risk 3). Verification: Slice 1 tests UC-8-A1 directory-creation path.

### Assumptions

- **The rule text in `src/claude.md` will be placed adjacent to existing ExitPlanMode guidance** (likely in a `## Plan Critic Pass` or `## Mandatory Rules` section) — risk: if no such section exists, placement may be in a new section, affecting file structure. Verification: Slice 1 reads `src/claude.md` before editing (PRD §14.8 Assumption 1).
- **`/bootstrap-feature` uses step-numbered structure** (Step 1, Step 2, etc.) allowing "Step 0" prepending — risk: if the command uses a different organizational scheme (e.g., phase names), step numbering may not fit. Verification: Slice 2 reads `src/commands/bootstrap-feature.md` before editing (PRD §14.8 Assumption 2).
- **`src/agents/planner.md` labels its execution inside `/bootstrap-feature` as "Step 5"** — risk: the label may differ. Verification: Slice 3 reads `src/agents/planner.md` before editing (PRD §14.8 Assumption 3).
- **Claude Code `Write` tool does NOT auto-create parent directories** when the parent path does not exist — risk: if `.claude/` is absent, the Write fails. Verification: PRD §14.8 Risk 3 flags this; implementation handles via `Bash mkdir -p` per architect decision. Slice 1 and Slice 4 test this.
- **The `Write` tool's string parameter is safe for markdown with special characters** including backticks, `---`, heredoc markers, dollar signs, angle brackets, and backslashes — risk: none identified (Write uses direct string parameter, not shell processing). Verification: UC-10 test (TC-AP-1.3) confirms handling.

### Open questions

- knowledge-base: corpus is ML/AI + data engineering + SRE + generic software engineering; task is meta-SDLC agent orchestration and Claude Code plan-mode persistence; no overlap. Skipping topical queries — corpus enrichment with Claude Code / agent-orchestration / LLM-pipeline reference materials would help future similar tasks.

---

## 1. Mandatory Write Before ExitPlanMode (FR-AP-1, UC-1, UC-10)

### 1.1 Plan-Mode Plan Persists to .claude/plan.md on First Exit (Happy Path)

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-1.1 | UC-1 primary | Developer exits plan mode after approving a plan; Claude calls `Write` to `<project>/.claude/plan.md` BEFORE calling `ExitPlanMode`. Result: `.claude/plan.md` exists with non-empty plan body. | Positive | (1) Inspect Claude transcript: grep for `Write file_path=.*plan.md` followed by `ExitPlanMode` (Write precedes ExitPlanMode in tool-call sequence). (2) Verify file: `test -f <project>/.claude/plan.md && [ -s <project>/.claude/plan.md ]` (file exists and non-empty). (3) Verify content: `grep -q "Feature Name\|## " <project>/.claude/plan.md` (contains plan-mode markdown structure). Maps: FR-AP-1.1, FR-AP-1.2 | AC-AP-1, AC-AP-2, AC-AP-10 |
| TC-AP-1.2 | UC-10 | Plan body contains markdown special characters: `---`, backticks, `$VAR`, `<>`, heredoc markers. `Write` tool accepts the full content string verbatim without escaping or shell interpolation. Result: file on disk matches plan body byte-for-byte. | Positive | (1) Verify content presence: `grep -F "---" <project>/.claude/plan.md` (horizontal rules preserved). (2) Verify backticks: `grep -F '```' <project>/.claude/plan.md` (code fences preserved). (3) Verify dollar signs: `grep -F '$' <project>/.claude/plan.md` (variable references not interpolated). (4) End-to-end: capture plan body (with special chars) → call Write → Read file → byte-compare with original. All bytes must match exactly (no escaping, no mangling). Maps: FR-AP-1.1, UC-10 edge case | AC-AP-10 |
| TC-AP-1.3 | UC-1-EC1 | Large plan body (>10 KB, e.g., 500+ lines). `Write` tool accepts and persists the full content. No truncation behavior. | Positive | (1) Generate test plan body with ~500 lines (markdown with sections, code blocks, acceptance criteria table). (2) Call Write to `.claude/plan.md`. (3) Verify file size: `wc -l <project>/.claude/plan.md` should equal or exceed 500. (4) Spot-check content: `tail -20 <project>/.claude/plan.md` should contain expected trailing lines, not truncation markers. Maps: FR-AP-1.1, UC-1 edge case | AC-AP-10 |

### 1.2 Overwrite Existing plan.md on Repeated ExitPlanMode (FR-AP-1.3)

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-1.4 | UC-3 primary, UC-1-A1 | Prior feature cycle left `<project>/.claude/plan.md` with old plan body. New feature plan-mode exits; Claude overwrites (not appends) the file. Result: file contains ONLY the new plan body; old content is gone. | Positive | (1) Pre-stage: write old plan to `.claude/plan.md`: `echo "OLD PLAN" > .claude/plan.md`. (2) Run plan mode with new feature; approve and exit (Write + ExitPlanMode). (3) Verify overwrite: `grep -c "OLD PLAN" .claude/plan.md` must return 0 (old content removed). (4) Verify new: `grep -q "NEW_FEATURE_NAME\|new acceptance criteria" .claude/plan.md` (new plan present). Maps: FR-AP-1.3 | AC-AP-10 |

---

## 2. Step 0 Precondition: File Presence Check (FR-AP-2, UC-2, UC-5, UC-6, UC-7)

### 2.1 Bootstrap Step 0 Passes Silently When plan.md Exists (Happy Path)

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-2.1 | UC-2 primary | Developer runs `/bootstrap-feature` after completing plan mode. `<project>/.claude/plan.md` exists (from UC-1 persist). Step 0 checks presence, finds file, proceeds silently to Step 1 (prd-writer). No error output about missing plan. | Positive | (1) Pre-stage: `mkdir -p .claude && echo "## Feature: Test" > .claude/plan.md` (file exists, non-empty). (2) Run `/bootstrap-feature "test feature"`. (3) Capture agent-invocation sequence from transcript. (4) Verify Step 0 produced no output about `.claude/plan.md` (presence check is silent per FR-AP-2.5). (5) Verify Step 1+ agents invoked: grep transcript for prd-writer agent invocation. Maps: FR-AP-2.1, FR-AP-2.2, FR-AP-2.5, FR-AP-2.6 | AC-AP-3, AC-AP-5, AC-AP-9 |
| TC-AP-2.2 | UC-2 primary | Same as TC-AP-2.1 but verify the planner (Step 5) receives `<project>/.claude/plan.md` as input and reads it. Planner output should reference the input plan body (e.g., feature name from plan.md) in its refinement. | Positive | (1) Pre-stage with distinctive feature name in plan: `echo "## Feature: UniqueTestName-12345" > .claude/plan.md`. (2) Run `/bootstrap-feature`. (3) Inspect planner output/artifacts. (4) Verify planner read the plan: grep planner's notes/output for "UniqueTestName-12345" or reference to input plan content. (5) Verify planner refined in-place: `.claude/plan.md` should contain both original plan and executable slice fields (Wave, Files, Changes, Verify, Done when) from Step 5. Maps: FR-AP-3.1, FR-AP-3.2 | AC-AP-6 |

### 2.2 Bootstrap Step 0 Aborts When plan.md Missing (Error Path)

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-2.3 | UC-5 primary | Developer runs `/bootstrap-feature` without having completed plan mode. `<project>/.claude/plan.md` does NOT exist. Step 0 detects absence, aborts immediately with error message (per FR-AP-2.4). No downstream agents are invoked. | Negative | (1) Pre-stage: `rm -f .claude/plan.md` (ensure file is absent). (2) Run `/bootstrap-feature "test feature"`. (3) Capture transcript. (4) Verify abort error message contains exact substring: `error: .claude/plan.md not found` (per FR-AP-2.4). (5) Verify message includes remediation: `grep "Enter plan mode\|/plan" (transcript)` — should suggest entering plan mode. (6) Verify no downstream agents invoked: `grep -c "prd-writer\|ba-analyst\|architect\|qa-planner\|planner" (transcript)` should return 0 (no agent invocations). Maps: FR-AP-2.3, FR-AP-2.4 | AC-AP-4, AC-AP-8 |
| TC-AP-2.4 | UC-5, UC-6 | Same as TC-AP-2.3 but run `/bootstrap-feature` twice in sequence. First run aborts (no plan.md). Developer then enters plan mode, exits (persists plan via UC-1). Second run of `/bootstrap-feature` proceeds past Step 0. Idempotency: running twice with the same plan.md produces the same Step 0 result both times. | Positive | (1) Pre-stage: `rm -f .claude/plan.md`. (2) Run `/bootstrap-feature "test"` (expect abort at Step 0). (3) Capture error from run 1. (4) Simulate plan-mode exit: `mkdir -p .claude && echo "## Feature" > .claude/plan.md`. (5) Run `/bootstrap-feature "test"` again (expect Step 0 passes). (6) Verify Step 0 output is consistent both times (if silent success, output should be empty both times Step 0 passes; abort message consistent when file absent). Maps: FR-AP-2.2, UC-2 happy path repeated | AC-AP-8, AC-AP-9 |
| TC-AP-2.5 | UC-7 primary | `<project>/.claude/plan.md` exists but has 0 bytes (empty file). Per FR-AP-2.6 (presence-only check), Step 0 treats this as present. Step 0 passes silently. Planner at Step 5 receives empty file, applies FR-AP-3.4 fallback (appends new `## Implementation Plan` section rather than failing). | Positive | (1) Pre-stage: `mkdir -p .claude && touch .claude/plan.md` (file exists, 0 bytes). (2) Run `/bootstrap-feature "test"`. (3) Verify Step 0 passes (no abort error). (4) Verify Step 1+ agents invoked (Step 0 did not block). (5) Verify planner handles empty file: `.claude/plan.md` should contain new `## Implementation Plan` section added by planner (FR-AP-3.4 fallback). (6) Spot-check: `.claude/plan.md` non-empty after Step 5. Maps: FR-AP-2.6, FR-AP-3.4 | AC-AP-8, AC-AP-9 |

---

## 3. No Git Root or Missing .claude/ Directory (FR-AP-1.4, UC-4, UC-8)

### 3.1 Write Falls Back to CWD When No Git Root (Error Recovery)

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-3.1 | UC-4 primary | Developer enters plan mode in a directory that is NOT a git repository (no `.git` ancestor). `.claude/` directory exists in CWD. Claude attempts git root detection, fails, falls back to CWD. Calls `Write` with target `<CWD>/.claude/plan.md`. Result: file created in CWD's `.claude/` directory. | Positive | (1) Pre-stage: create a non-git directory: `mkdir -p /tmp/non-git-test/.claude && cd /tmp/non-git-test`. (2) Verify no git root: `git rev-parse --show-toplevel` exits with error (expected in non-git dir). (3) Simulate plan-mode session: call Write with `file_path=./.claude/plan.md` and plan content. (4) Verify file created: `test -f /tmp/non-git-test/.claude/plan.md && [ -s /tmp/non-git-test/.claude/plan.md ]`. (5) Verify content: `grep -q "Feature\|Plan" /tmp/non-git-test/.claude/plan.md`. Maps: FR-AP-1.4 | AC-AP-10 |

### 3.2 Directory Creation Fallback When .claude/ Absent (Error Recovery)

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-3.2 | UC-8 primary, UC-8-A1, UC-4-E1 | Claude attempts to Write to `<project>/.claude/plan.md` but `.claude/` directory does NOT exist. Per architect decision (Step 0 defensive `mkdir -p`), Claude uses `Bash mkdir -p <project>/.claude` to create the directory, then retries Write. Result: directory created and file written successfully. | Positive | (1) Pre-stage: project-git-root exists, but remove `.claude/`: `cd <project-root> && rm -rf .claude`. (2) Verify precondition: `test ! -d .claude` (directory absent). (3) Simulate plan-mode: Claude calls `Bash mkdir -p .claude` first (per architect impl decision). (4) Verify directory created: `test -d .claude`. (5) Claude calls `Write` to `./.claude/plan.md` with plan content. (6) Verify file created: `test -f ./.claude/plan.md && [ -s ./.claude/plan.md ]`. (7) Verify content: `grep -q "Feature" ./.claude/plan.md`. Maps: FR-AP-1.4, UC-8-A1 | AC-AP-10 |
| TC-AP-3.3 | UC-8 primary (error branch) | Claude attempts Write to `.claude/plan.md`, parent directory absent, Bash mkdir fails (e.g., permission denied). Per FR-AP-1.2, since Write is not attempted (directory creation failed), ExitPlanMode is NOT called. Error is surfaced to developer. Plan remains in conversation context. | Negative | (1) Pre-stage: create a read-only directory: `mkdir -p /tmp/ro-test && chmod 555 /tmp/ro-test`. Try to create subdir inside: `mkdir /tmp/ro-test/child` (expect permission denied). (2) Simulate plan mode in this read-only parent. Claude tries `Bash mkdir -p /tmp/ro-test/.claude` (expect command to fail). (3) Verify Bash command returned error (non-zero exit). (4) Verify ExitPlanMode was NOT called (transcript should show Bash error but no ExitPlanMode call). (5) Verify error message to developer includes exact path and cause (permission denied or similar). Maps: FR-AP-1.2, UC-8 error branch | AC-AP-10 |

---

## 4. Planner Input: Reading and Refining plan.md In-Place (FR-AP-3, UC-2-A1)

### 4.1 Planner Reads Existing plan.md as Authoritative Input

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-4.1 | UC-2-A1 | Planner (Step 5) receives existing `.claude/plan.md` from prior plan-mode session. Planner treats file as authoritative source of user intent, feature scope, acceptance criteria. Planner does NOT overwrite the file wholesale; it refines the implementation-slice section (FR-AP-3.5). | Positive | (1) Pre-stage: write distinctive plan content to `.claude/plan.md`: `cat > .claude/plan.md << 'EOF'\n## Feature Scope\nImplement fuzzy juggling\n\n## Acceptance Criteria\nThe juggling API works\nEOF`. (2) Run `/bootstrap-feature`. (3) Capture planner output/notes. (4) Verify planner read the file: grep planner's internal notes for "fuzzy juggling" or feature name (proves it read the input). (5) Verify planner preserved scope: grep `.claude/plan.md` for "Feature Scope" and "fuzzy juggling" (scope section unchanged). (6) Verify planner added slices: `.claude/plan.md` should contain new `Wave:`, `Files:`, `Changes:`, `Verify:`, `Done when:` fields (executable slice format from FR-3). Maps: FR-AP-3.1, FR-AP-3.2, FR-AP-3.3 | AC-AP-6 |
| TC-AP-4.2 | UC-2-A1 | Planner refines plan.md by extending (not replacing) the preliminary slice section. If plan-mode provided a rough slice list, planner enhances it with executable fields. If no slice section exists, planner appends `## Implementation Plan` (FR-AP-3.4). Result: original plan content preserved; new executable slices added. | Positive | (1) Case A (plan-mode provided sketchy slice list): Pre-stage plan with `## Preliminary Slices\n- Slice 1: Build API\n- Slice 2: Deploy`. (2) Run `/bootstrap-feature`. (3) Verify original list preserved: grep `.claude/plan.md` for "Build API" (original text still present). (4) Verify refinement: grep `.claude/plan.md` for "Files:" and "Done when:" (executable fields added by planner). (5) Case B (plan-mode omitted slices): Pre-stage plan with feature scope but NO slice section. (6) Run `/bootstrap-feature`. (7) Verify planner appended new section: `.claude/plan.md` should have `## Implementation Plan` section added at the end (per FR-AP-3.4). (8) Verify earlier sections unchanged: feature name, scope, acceptance criteria all preserved above the new section. Maps: FR-AP-3.3, FR-AP-3.4 | AC-AP-6 |
| TC-AP-4.3 | UC-2-A1 | Planner MUST NOT create a new `.claude/plan.md` from scratch if the file already exists. If file is unrecognizable (not valid markdown, corrupted), planner appends new `## Implementation Plan` section per FR-AP-3.4, preserving all prior content above it unchanged. | Positive | (1) Pre-stage: write garbage/invalid markdown to `.claude/plan.md`: `echo "GARBAGE_CONTENT_$#@" > .claude/plan.md`. (2) Run `/bootstrap-feature`. (3) Verify planner did NOT overwrite wholesale: `grep -c "GARBAGE_CONTENT" .claude/plan.md` should return at least 1 (garbage still present). (4) Verify planner appended slices: `.claude/plan.md` should contain both the garbage line AND new `## Implementation Plan` section at the end. (5) Verify no wholesale replacement (would lose garbage): file size > original garbage size; new content appended, not replaced. Maps: FR-AP-3.4, FR-AP-3.5 | AC-AP-6 |

---

## 5. README & CLAUDE.md Documentation Updates (FR-AP-4, UC-9)

### 5.1 README Documents Auto-Persist Behavior

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-5.1 | UC-9 (implicit: user needs to know when to use plan mode) | `README.md` documents the auto-persist behavior: (a) plan-mode plans are auto-saved to `.claude/plan.md` on exit, (b) `/bootstrap-feature` requires this file and aborts with clear error if missing, (c) planner refines the plan in-place. | Positive | (1) Read `README.md`. (2) Grep for auto-save / auto-persist language: `grep -iE "auto.*save\|plan.*mode\|\.claude/plan\.md" README.md` (expect >= 1 match). (3) Grep for pipeline documentation: `grep -A 5 -B 5 "plan mode\|bootstrap-feature" README.md` (expect context explaining the flow). (4) Verify mention of `.claude/plan.md`: exact path documented. (5) Verify mention of bootstrap requirement: "plan.md" in bootstrap context. Maps: FR-AP-4.1 | AC-AP-7 |
| TC-AP-5.2 | UC-9 (implicit) | `src/claude.md` contains the new `### Plan-Mode Persistence (MANDATORY)` rule in a clearly named subsection. Rule states: before calling `ExitPlanMode`, Claude MUST call `Write` to persist plan to `<project>/.claude/plan.md`. Rule is marked MANDATORY with same prominence as other mandatory rules. | Positive | (1) Read `src/claude.md`. (2) Grep for rule presence: `grep -iE "plan.*mode.*persistence|mandatory.*write.*exit" src/claude.md` (expect >= 1 match). (3) Grep for MANDATORY marker: `grep "MANDATORY\|MUST" src/claude.md | grep -iE "plan.md|ExitPlanMode"` (expect >= 1 match with uppercase MUST). (4) Grep for ExitPlanMode + Write co-location: `grep -B 5 -A 5 "ExitPlanMode" src/claude.md | grep -iE "Write|plan.md"` (expect Write and ExitPlanMode guidance adjacent). Maps: FR-AP-1.1, FR-AP-1.2, FR-AP-1.5 | AC-AP-1, AC-AP-2 |
| TC-AP-5.3 | UC-9 (template check: templates should NOT change) | `templates/CLAUDE.md` does NOT contain the new plan-mode persistence rule. Template is unchanged; the rule lives only in project-level `src/claude.md` and user-level `~/.claude/CLAUDE.md` (via install.sh copy). | Negative | (1) Read `templates/CLAUDE.md` (the installer template). (2) Grep for the new rule: `grep -iE "plan.*mode.*persistence|Write.*plan.md.*ExitPlanMode" templates/CLAUDE.md` (expect 0 matches). (3) Confirm template is still generic/boilerplate (compare with prior template version — no project-specific rule additions). Maps: implicitly verified by NFR-AP-3 (no template changes) | (implicit AC verification) |
| TC-AP-5.4 | UC-9 (case-insensitive FS companion) | `src/CLAUDE.md` (uppercase, on macOS APFS) has identical text to `src/claude.md` (lowercase). Both files have the new rule. Verified by content byte-equality check. | Positive | (1) Read both `src/claude.md` and `src/CLAUDE.md`. (2) Extract the new rule section from both (e.g., lines containing "plan.md" + "ExitPlanMode" + "MANDATORY"). (3) Diff the sections: `diff <(grep -A 10 "Plan-Mode Persistence" src/claude.md) <(grep -A 10 "Plan-Mode Persistence" src/CLAUDE.md)` (expect identical or no diff). (4) Verify both files point to same inode on case-insensitive FS (if applicable): `ls -i src/claude.md src/CLAUDE.md | awk '{print $1}' | uniq | wc -l` (expect 1 if HFS+ resolved them to same inode, or 2 if truly separate files with identical content). Maps: implicit file-parity verification | (implicit verification) |

---

## 6. Overwrite Policy & Backward Compatibility (FR-AP-1.3, UC-3)

### 6.1 Overwrite Semantic Documented and Tested

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-6.1 | UC-3, UC-1-A1 | Feature describes overwrite policy explicitly: if `.claude/plan.md` already exists (from prior feature), the new Write OVERWRITES it completely. No append, no prompt, no preservation of old content. This is the correct behavior for single-active-feature workflows. Test confirms overwrite works and old content is replaced. | Positive | (1) Pre-stage: write old plan: `echo "OLD FEATURE: Payment Processing" > .claude/plan.md`. (2) Verify old content present: `grep "OLD FEATURE" .claude/plan.md` (expect 1 match). (3) Simulate new plan-mode session: call Write with new content: `echo "NEW FEATURE: Logging" > .claude/plan.md`. (4) Verify old content gone: `grep -c "OLD FEATURE" .claude/plan.md` must return 0. (5) Verify new content present: `grep "NEW FEATURE" .claude/plan.md` (expect 1 match). (6) Test description states: "Overwrite is intentional per single-active-feature assumption. Users with concurrent feature branches should use separate git worktrees (documented in PRD §14.8 Risk 2)." Maps: FR-AP-1.3 | AC-AP-10 |

---

## 7. Rule Violation Detection (FR-AP-1.2, UC-6)

### 7.1 Downstream Step 0 Catches Missing Write

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-7.1 | UC-6 primary | If Claude calls `ExitPlanMode` WITHOUT a preceding `Write` to `.claude/plan.md` (rule violation), the plan is lost in global cache. Developer later runs `/bootstrap-feature`, Step 0 detects the missing file, aborts with error, and directs developer back to plan mode. The two-layer approach (persist-on-exit rule + precondition-on-bootstrap) ensures violations are caught downstream and no silent data loss occurs. | Negative | (1) Pre-stage: manually delete `.claude/plan.md` to simulate rule violation: `rm -f .claude/plan.md`. (2) Verify file is absent: `test ! -f .claude/plan.md` (exit 0, file absent). (3) Run `/bootstrap-feature`. (4) Capture Step 0 abort error: `grep "error.*plan.md.*not found" (transcript)` (expect exact error substring per FR-AP-2.4). (5) Verify Step 0 prevented silent downstream execution: grep transcript for prd-writer/ba-analyst invocations (expect none). (6) Verify error message guides developer back to plan mode: grep for "Enter plan mode\|/plan" (expect remediation suggestion). Maps: FR-AP-1.2, FR-AP-2.3 | AC-AP-8 |

---

## 8. Edge Cases & Cross-Boundary Tests

### 8.1 Git Edge Cases & Non-Git Fallback

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-8.1 | UC-4 + UC-4-E1 | No git root detected + .claude/ absent = directory-creation fallback. Claude runs `Bash mkdir -p ./.claude` in the CWD, then writes `./plan.md`. Result: file created in CWD's `.claude/` directory. | Positive | (1) Pre-stage: non-git directory, no `.claude/`: `mkdir -p /tmp/edge-no-git && cd /tmp/edge-no-git && rm -rf .claude`. (2) Verify preconditions: `git rev-parse --show-toplevel` exits error (not in git repo); `test ! -d .claude` (no .claude dir). (3) Simulate Claude plan-mode: call `Bash mkdir -p ./.claude && Write ./.claude/plan.md ...`. (4) Verify directory created: `test -d /tmp/edge-no-git/.claude`. (5) Verify file written: `test -f /tmp/edge-no-git/.claude/plan.md && [ -s /tmp/edge-no-git/.claude/plan.md ]`. Maps: FR-AP-1.4, UC-4-E1 | AC-AP-10 |

### 8.2 Large & Special-Character Plan Bodies

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-8.2 | UC-10 + UC-1-EC1 | Plan body is >10KB with heavy special characters (backticks, `---`, `$VAR`, angle brackets, heredoc markers, newlines, unicode). Write tool handles all characters correctly without truncation or mangling. | Positive | (1) Generate test plan with: multiple `---` separators, code blocks with triple-backticks, inline `$VARIABLE`, `<tag>` examples, heredoc-like `<<EOF` strings, multi-byte unicode (emoji, Cyrillic). (2) Call Write to `./.claude/plan.md` with the full body. (3) Verify file size: `wc -c ./.claude/plan.md` should match expected byte count. (4) Verify special-char preservation: `grep -F '---' ./.claude/plan.md | wc -l` (expect correct count of dashes). (5) Byte-compare with original: `md5sum (original) > orig.md5 && md5sum ./.claude/plan.md > file.md5 && diff orig.md5 file.md5` (hashes must match, proving no truncation/alteration). Maps: FR-AP-1.1, UC-10 | AC-AP-10 |

### 8.3 Concurrent Re-Run & Idempotency

| TC ID | Use Case | Test Case | Type | Verification |
|-------|----------|-----------|------|--------------|
| TC-AP-8.3 | UC-2 repeated (idempotency) | Running `/bootstrap-feature` twice in sequence with the same `.claude/plan.md` produces identical Step 0 results both times. First run: Step 0 passes silently. Second run (CWD unchanged, file unchanged): Step 0 passes silently again. No state pollution or side effects between runs. | Positive | (1) Pre-stage: `.cmake/plan.md` exists with fixed content. (2) Run `/bootstrap-feature "test"` — capture full transcript as Run-1. (3) Extract Step 0 section from transcript. (4) Run `/bootstrap-feature "test"` again — capture full transcript as Run-2. (5) Extract Step 0 section from Run-2. (6) Compare Step 0 outputs: if Step 0 is silent success, both should be empty (no output); if any error, both should match. (7) Verify `.cmake/plan.md` unchanged after Run 1 (except for planner refinements at Step 5, which are expected). Maps: UC-2 repeated, FR-AP-2.6 (presence-only check) | AC-AP-9 |

---

## Summary

**Total Test Cases:** 26 (TC-AP-1.1 through TC-AP-8.3, with some subsections)

**Use Case Coverage:**
- UC-1 (primary flow): TC-AP-1.1, TC-AP-1.3, TC-AP-1.4
- UC-1-A1 (overwrite): TC-AP-1.4, TC-AP-6.1
- UC-1-E1 (write fails): TC-AP-3.3
- UC-1-EC1 (large body): TC-AP-1.3, TC-AP-8.2
- UC-2 (bootstrap passes): TC-AP-2.1, TC-AP-2.2, TC-AP-8.3
- UC-2-A1 (planner refines): TC-AP-4.1, TC-AP-4.2, TC-AP-4.3
- UC-3 (overwrite existing): TC-AP-1.4, TC-AP-6.1
- UC-4 (no git root): TC-AP-3.1, TC-AP-8.1
- UC-4-E1 (no .claude dir): TC-AP-3.2, TC-AP-3.3, TC-AP-8.1
- UC-5 (bootstrap aborts): TC-AP-2.3
- UC-6 (rule violation caught): TC-AP-7.1
- UC-7 (empty plan.md): TC-AP-2.5
- UC-8 (.claude absent): TC-AP-3.2, TC-AP-3.3
- UC-8-A1 (mkdir fallback): TC-AP-3.2
- UC-9 (backs out): TC-AP-5.1 (implicit)
- UC-10 (special chars): TC-AP-1.2, TC-AP-8.2

**Acceptance Criteria Coverage:**
- AC-AP-1 (grep ExitPlanMode + Write): TC-AP-5.2
- AC-AP-2 (grep MANDATORY): TC-AP-5.2
- AC-AP-3 (grep Step 0): TC-AP-2.1
- AC-AP-4 (grep error message): TC-AP-2.3
- AC-AP-5 (Step 0 before Step 1): TC-AP-2.1
- AC-AP-6 (grep plan.md in planner.md): TC-AP-4.1, TC-AP-4.2
- AC-AP-7 (grep README): TC-AP-5.1
- AC-AP-8 (bootstrap with no plan.md): TC-AP-2.3, TC-AP-7.1
- AC-AP-9 (bootstrap with plan.md): TC-AP-2.1, TC-AP-2.5, TC-AP-8.3
- AC-AP-10 (plan.md persisted): TC-AP-1.1, TC-AP-1.2, TC-AP-1.3, TC-AP-1.4, TC-AP-3.1, TC-AP-3.2, TC-AP-3.3, TC-AP-8.1, TC-AP-8.2

**Test Type Breakdown:**
- Positive (happy path & error recovery): 20
- Negative (violations, missing files, failures): 5
- Edge cases (large, special chars, idempotency): 3

**Verification Approaches:**
- Transcript inspection (Write + ExitPlanMode ordering): TC-AP-1.1
- File presence/content checks: TC-AP-1.1, TC-AP-1.3, TC-AP-1.4, TC-AP-2.1, etc.
- Grep-based structural verification: TC-AP-5.1, TC-AP-5.2
- Byte/hash comparison (special chars, large bodies): TC-AP-1.2, TC-AP-8.2
- Agent invocation tracing: TC-AP-2.1, TC-AP-2.3, TC-AP-7.1
- Idempotency testing (run twice, compare outputs): TC-AP-2.4, TC-AP-8.3
