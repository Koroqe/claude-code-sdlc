## Additional Roles
0 additional roles total; 0 new prompt files written; 0 core-agent edits

No additional roles required.

## Role invocation plan
(no roles to invoke)

## Facts

### Verified facts

- PRD §14 (`docs/PRD.md` lines 3462–3617, read this session) is the authoritative source for all FRs and ACs. Date: 2026-05-02 — on or after MERGE_DATE; `## Facts` block is mandatory per cognitive-self-check rule.
- Use cases document (`docs/use-cases/auto-persist-plan-mode_use_cases.md`, read this session) contains 10 primary use cases: UC-1 through UC-10 with sub-scenarios (UC-1-A1, UC-1-E1, UC-2-A1, UC-3-A1, UC-4-E1, UC-4-A1, UC-5-E1, UC-6-A1, UC-7-A1, UC-8-A1, UC-9-A1). 14 scenario rows in the UC Coverage table.
- QA test cases file (`docs/qa/auto-persist-plan-mode_test_cases.md`, read this session) contains 26 total test cases (TC-AP-1.1 through TC-AP-8.3).
- Architect verdict: **PASS** with 5 [STRUCTURAL] decisions resolved (A–E). Source: architect output inlined in roles-pending.md Facts block (read this session) and QA test-cases Facts block line 14.
- `src/claude.md` exists at `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` — 211 lines. Read this session (lines 1–211). The Plan Critic Pass section begins at line 97. `ExitPlanMode` appears at line 211: `"Only call ExitPlanMode after Review Notes are written."`. The block under `### Plan Critic Pass (MANDATORY — before ExitPlanMode)` runs from line 97 to line 211.
- `src/CLAUDE.md` is the SAME inode as `src/claude.md` (inode 6075166) — HFS+ case-insensitive filesystem. They are the same physical file. Both paths resolve to identical content. Verified via `ls -i` command output this session.
- `src/commands/bootstrap-feature.md` exists at 276 lines. Read this session. Step 1 starts at line 7; the current structure is: Step 1 (line 7), Step 2 (line 13), Step 3 (line 21), Step 3.5 (line 37), Step 3.75 (line 110), Step 4 (line 155), Step 5 (line 162), Step 5.5 (line 171), Step 6 (line 174), Step 7 (line 178). Current first step `### Step 1: Product Manager — PRD Documentation` is at line 7. New Step 0 will be inserted before line 7 (between lines 5 and 7).
- `src/agents/planner.md` exists at 146 lines. Read this session. The Process section is at lines 13–30. Step 5 reads "5. Produce an implementation plan with 5-9 concrete slices" at line 31. The planner's Output Format section is at lines 33–60. New FR-AP-3 instruction adds reading `<project>/.claude/plan.md` as Step 0 of the process (before the existing steps) and updates the Output Format section.
- `README.md` exists at 314 lines. Read this session. The Hardening table is at lines 145–164. The existing "Step 0: remove dead code" row is at line 155 — the new row will be added to the same table. A paragraph documenting auto-persist will be added after line 164 (after the `---` separator).
- Knowledge base: `doc_count: 28`, `chunk_count: 51542`. Corpus scope relevance: **No overlap**. Corpus domain: ML/AI + data engineering + SRE + software engineering (Russian/English). Task domain: meta-SDLC agent orchestration, Claude Code plan-mode persistence, markdown prompt-file engineering. No topical queries run — title list is sufficient per corpus-scope-relevance protocol. Source: `claudeknows status --json` and `claudeknows list --json` output this session.
- All 5 affected file paths verified via `ls` this session: `src/claude.md`, `src/CLAUDE.md`, `src/commands/bootstrap-feature.md`, `src/agents/planner.md`, `README.md`. All exist. Zero new files.

### External contracts

- **Claude Code `Write` tool** — symbol: `Write` with parameters `file_path: string` and `content: string`; writes content verbatim to disk without shell interpolation or heredoc processing — source: `~/.claude/rules/tool-limitations.md` system-reminder (read this session); also stated in PRD §14 Facts block at `docs/PRD.md` line 3602 and use-cases Facts block at `docs/use-cases/auto-persist-plan-mode_use_cases.md` line 607 — verified: yes.
- **Claude Code `ExitPlanMode` tool** — symbol: `ExitPlanMode` (no required parameters; terminates plan-mode session) — source: `src/claude.md` line 211 (read this session) references `ExitPlanMode` by name; consistent usage throughout codebase — verified: no — assumption. Risk: future Claude Code version may rename or restructure the tool. Verification: architect Step 3 PASS already validates this in the pre-existing architect verdict.
- **POSIX `[ -s file ]` check** — symbol: test expression `[ -s file ]` returns exit 0 if file exists and byte-count > 0; returns exit 1 if file absent or 0 bytes — source: POSIX shell specification (not opened this session); cited in QA test-cases Facts block (`docs/qa/auto-persist-plan-mode_test_cases.md` line 21) as `verified: no — assumption` — verified: no — assumption. Risk: non-POSIX shells may differ. Used in Slice 2 Step 0 check and in the src/claude.md persistence rule. Universally supported on macOS/Linux.
- **Git `rev-parse --show-toplevel`** — symbol: outputs git repository root path; exits with error code if not inside a git repo — source: cited in QA test-cases Facts block (`docs/qa/auto-persist-plan-mode_test_cases.md` line 22) as `verified: no — assumption`. Used in Slice 1's persistence rule text. Standard git subcommand, broadly available.
- **Claude Code `Bash` tool** — symbol: `Bash` with parameter `command: string`; executes bash command — source: `~/.claude/CLAUDE.md` system-reminder references Bash tool throughout — verified: no — assumption. Used in `mkdir -p` directory-creation sequence per architect Decision C. Availability in plan-mode context is the key assumption.

### Assumptions

- **`src/claude.md` line 211 is the correct insertion anchor** for the new `### Plan-Mode Persistence (MANDATORY)` rule. The rule will be inserted BEFORE line 211 (before `"Only call ExitPlanMode after Review Notes are written."`) so it appears adjacent to the ExitPlanMode instruction at the end of the Plan Critic Pass section. Risk: if the file structure changes between now and implementation, the line number may differ. How to verify: Slice 1 implementation reads `src/claude.md` before editing and locates the ExitPlanMode anchor by grep.
- **`src/claude.md` and `src/CLAUDE.md` are the same inode on HFS+** — verified by `ls -i` this session. Any edit to one path automatically updates the other. Only ONE edit operation is needed per slice; both paths update atomically. Risk: if the project is moved to a case-sensitive filesystem (ext4, APFS case-sensitive), the two files become distinct and must be kept in sync manually. How to verify: inode check confirmed via `ls -i` output this session.
- **Step 0 insertion in `src/commands/bootstrap-feature.md` at line 5–7** — the line immediately before `### Step 1:` (line 7) and after the Agency Documentation Pipeline header (line 5) is the correct location. Risk: if surrounding markdown structure changes, exact line numbers shift. How to verify: Slice 2 reads the file before editing and locates `### Step 1:` by grep.
- **`src/agents/planner.md` Process section starts at line 14** with `1. Read the feature documentation...` — the new `.claude/plan.md` read instruction will be added AT THE TOP of the Process step list (new point `0.` or prepended). Risk: step numbering semantics. How to verify: Slice 3 reads the file before editing.
- **`README.md` Hardening table ends at line 164** and the new row will be appended to that table with an additional paragraph after the closing `---` on line 165. Risk: table formatting. How to verify: Slice 4 reads the README before editing.
- **Bash `mkdir -p` is available in plan-mode context** — architect Decision C mandates `Bash mkdir -p <project-root>/.claude` as the directory-creation fallback. The availability of `Bash` in plan-mode context is assumed correct per the architect PASS verdict.

### Open questions

- knowledge-base: corpus is ML/AI + data engineering + SRE + generic software engineering; task is meta-SDLC agent orchestration and Claude Code plan-mode persistence; no overlap. Skipping topical queries — corpus enrichment with Claude Code / agent-orchestration / LLM-pipeline reference materials would help future similar tasks.

## Prerequisites verified

- PRD section: `docs/PRD.md` — §14 (Auto-Persist Plan-Mode Plans to Project, lines 3462–3617) — VERIFIED
- Use cases: `docs/use-cases/auto-persist-plan-mode_use_cases.md` — 10 use cases (UC-1 through UC-10, 14 scenario rows) — VERIFIED
- QA test cases: `docs/qa/auto-persist-plan-mode_test_cases.md` — 26 test cases (TC-AP-1.1 through TC-AP-8.3) — VERIFIED
- Architecture review: **PASS** — 5 [STRUCTURAL] decisions A–E resolved — VERIFIED

## Implementation plan

### Slice 1: Add Plan-Mode Persistence rule to src/claude.md (and HFS+ companion src/CLAUDE.md)
- **Wave:** 1
- **Use cases:** UC-1 (primary), UC-1-A1, UC-1-E1, UC-3, UC-4, UC-4-E1, UC-8, UC-8-A1, UC-9, UC-10
- **FRs:** FR-AP-1.1, FR-AP-1.2, FR-AP-1.3, FR-AP-1.4, FR-AP-1.5
- **Files:** `src/claude.md` (edits `src/CLAUDE.md` atomically — same inode)
- **Changes:** Insert a new `### Plan-Mode Persistence (MANDATORY)` subsection immediately BEFORE the final line of `src/claude.md` (before `"Only call ExitPlanMode after Review Notes are written."` at current line 211). The subsection text MUST contain the following verbatim obligations:
  1. FR-AP-1.1: Before calling `ExitPlanMode`, Claude MUST call the `Write` tool and write the complete plan body to `<project>/.claude/plan.md`, where `<project>` is the current git repository root (resolved via `Bash git rev-parse --show-toplevel`).
  2. FR-AP-1.2: The `Write` call and the `ExitPlanMode` call are permanently linked: `ExitPlanMode` MUST NOT be called unless the `Write` has already completed successfully in the same response.
  3. FR-AP-1.3: Overwrite policy — if `<project>/.claude/plan.md` already exists, it MUST be overwritten with the current plan body. Appending is not permitted.
  4. FR-AP-1.4: No-git-root fallback — if `git rev-parse --show-toplevel` fails, fall back to the current working directory as project root. The persistence sequence (per architect Decision C) is: (1) `Bash git rev-parse --show-toplevel` (fallback CWD on error), (2) `Bash mkdir -p <project-root>/.claude`, (3) `Write <project-root>/.claude/plan.md` with full plan body, (4) `ExitPlanMode`.
  5. FR-AP-1.5: The rule heading must use the word MANDATORY and all obligations must use MUST language matching the prominence of other mandatory rules in `src/claude.md`.
- **Verify:** `grep -n "Plan-Mode Persistence" src/claude.md | wc -l | grep -q "1" && grep -n "MANDATORY" src/claude.md | grep -i "plan" | wc -l | grep -q "[1-9]" && grep -c "ExitPlanMode" src/claude.md | grep -q "2" && grep -n "mkdir -p" src/claude.md | wc -l | grep -q "[1-9]"`
- **Done when:** `grep -n "Plan-Mode Persistence\|MANDATORY" src/claude.md | grep -i "plan.md\|ExitPlanMode"` returns at least one result AND `grep -c "ExitPlanMode" src/claude.md` returns at least 2 (one in the Plan Critic section title, one in the new rule)
- **Pre-review:** none

### Slice 2: Add Step 0 precondition to src/commands/bootstrap-feature.md
- **Wave:** 1
- **Use cases:** UC-2 (primary), UC-5 (primary), UC-6, UC-7
- **FRs:** FR-AP-2.1, FR-AP-2.2, FR-AP-2.3, FR-AP-2.4, FR-AP-2.5, FR-AP-2.6
- **Files:** `src/commands/bootstrap-feature.md`
- **Changes:** Insert a new `### Step 0: Verify plan exists` block between line 5 (`Every feature follows this pipeline...`) and line 7 (the current `### Step 1: Product Manager — PRD Documentation`). The Step 0 block MUST contain:
  1. FR-AP-2.2: A presence-AND-non-empty check using `[ -s .claude/plan.md ]` (per architect Decision B — `[ -s ]` checks both existence and non-zero size), where `.claude/plan.md` is relative to the project root.
  2. FR-AP-2.3 + FR-AP-2.4: If the check fails, abort immediately with the EXACT error message: `error: .claude/plan.md not found. Enter plan mode first (/plan), complete the plan, and exit plan mode — Claude will automatically save the plan to .claude/plan.md before exiting.`
  3. FR-AP-2.5: If the check passes, proceed silently to Step 1 with no output.
  4. FR-AP-2.6: The check is presence+non-empty ONLY (per architect Decision B which resolved UC-7 empty-file treatment: `[ -s ]` treats empty as missing). No content/structure validation.
- **Verify:** `grep -n "Step 0" src/commands/bootstrap-feature.md | wc -l | grep -q "[1-9]" && grep -n "plan.md not found" src/commands/bootstrap-feature.md | wc -l | grep -q "[1-9]" && python3 -c "lines=open('src/commands/bootstrap-feature.md').readlines(); s0=[i for i,l in enumerate(lines) if 'Step 0' in l]; s1=[i for i,l in enumerate(lines) if 'Step 1:' in l and 'Product Manager' in l]; exit(0 if s0 and s1 and s0[0] < s1[0] else 1)"`
- **Done when:** `grep -n "Step 0\|plan.md" src/commands/bootstrap-feature.md | wc -l` returns at least 2 AND `grep -n "Step 0" src/commands/bootstrap-feature.md | head -1 | awk '{print $1}' | tr -d ':'` is a line number less than the line number of `grep -n "Step 1.*Product Manager" src/commands/bootstrap-feature.md | head -1`
- **Pre-review:** none

### Slice 3: Update src/agents/planner.md — plan.md as authoritative input + in-place refinement
- **Wave:** 2
- **Use cases:** UC-2-A1
- **FRs:** FR-AP-3.1, FR-AP-3.2, FR-AP-3.3, FR-AP-3.4, FR-AP-3.5
- **Files:** `src/agents/planner.md`
- **Changes:**
  1. Process step list (lines 13–31): Add a new bullet at the TOP of the process step list (before the existing `1. Read the feature documentation...`) specifying: "**0. Read `<project>/.claude/plan.md` as authoritative input** (when it exists): this file is the plan-mode output approved by the user before entering bootstrap. It is the primary source of user intent, feature scope, acceptance criteria, and preliminary slice breakdown. Read it FIRST before reading PRD, use cases, or QA docs." This implements FR-AP-3.1 and FR-AP-3.2.
  2. Output Format section (lines 33–60): Add a new `### plan.md In-Place Refinement` subsection that specifies per architect Decision D and FR-AP-3.3 through FR-AP-3.5:
     - The planner MUST NOT overwrite `<project>/.claude/plan.md` wholesale. The plan-mode body is preserved verbatim at the top.
     - The planner identifies the implementation-slice section and replaces/extends it with the executable format (Wave, Files, Changes, Verify, Done when).
     - If no recognizable implementation-slice section exists, the planner appends `## Implementation Plan` at the end of the file, preserving all existing content above it unchanged (FR-AP-3.4 fallback).
     - The planner uses Edit (or targeted Write with full file content) — never wholesale replacement that loses plan-mode content.
- **Verify:** `grep -n "authoritative\|plan.md\|refine\|in-place\|in place" src/agents/planner.md | wc -l | grep -qE "[2-9]|[1-9][0-9]"` AND `grep -n "plan.md" src/agents/planner.md | wc -l | grep -q "[1-9]"`
- **Done when:** `grep -n "plan.md\|authoritative\|refine\|in-place" src/agents/planner.md` returns at least 2 distinct line matches AND `grep -n "FR-AP-3\|in-place\|append.*Implementation Plan" src/agents/planner.md | wc -l | grep -q "[1-9]"`
- **Pre-review:** none

### Slice 4: Update README.md — document auto-persist behavior in Hardening table and Pipeline section
- **Wave:** 2
- **Use cases:** UC-9 (implicit — user needs to understand when plan mode is required)
- **FRs:** FR-AP-4.1, FR-AP-4.2
- **Files:** `README.md`
- **Changes:**
  1. Hardening table (lines 145–164): Add a new row to the table: `| Plan-mode plans lost to global cache | Auto-persist rule: Claude writes `.claude/plan.md` before `ExitPlanMode`; `/bootstrap-feature` Step 0 aborts if file is missing |`
  2. After the table's closing `---` (line 165): Add a short paragraph (2–4 sentences) explaining: (a) plan-mode plans are auto-saved to `<project>/.claude/plan.md` when exiting plan mode, (b) `/bootstrap-feature` requires this file and will abort with a clear error message if it is missing, (c) the planner agent at Step 5 reads and refines the plan in-place. Reference `src/claude.md`'s `### Plan-Mode Persistence` subsection for the rule text.
- **Verify:** `grep -iE "auto.*save|plan.*mode.*auto|plan\.md.*ExitPlanMode" README.md | wc -l | grep -q "[1-9]"` AND `grep -n "plan.md" README.md | wc -l | grep -q "[1-9]"`
- **Done when:** `grep -iE "auto.*save|plan.*mode|\.claude/plan\.md" README.md` returns at least one match AND `grep -n "Plan-mode plans\|plan-mode plans\|plan mode" README.md | wc -l | grep -q "[1-9]"`
- **Pre-review:** none

### Slice 5: Verify AC compliance and cross-file consistency check
- **Wave:** 3
- **Use cases:** All (AC-AP-1 through AC-AP-10 coverage verification)
- **FRs:** All FR-AP-1 through FR-AP-4 (verification pass)
- **Files:** `src/claude.md`, `src/commands/bootstrap-feature.md`, `src/agents/planner.md`, `README.md`
- **Changes:** No new content changes. This slice runs the acceptance criteria checks from PRD §14.5 as a final integration verification:
  - AC-AP-1: `grep -n "ExitPlanMode" src/claude.md` returns a line whose context (±5) contains "Write" and "plan.md"
  - AC-AP-2: `grep -n "MANDATORY\|MUST" src/claude.md | grep -i "plan.md\|ExitPlanMode"` returns ≥1 match
  - AC-AP-3: `grep -n "Step 0\|plan.md" src/commands/bootstrap-feature.md` returns ≥2 matches
  - AC-AP-4: `grep -n "error.*plan.md\|plan.md.*not found\|abort\|Enter plan mode" src/commands/bootstrap-feature.md` returns ≥1 match
  - AC-AP-5: Step 0 line number < Step 1 line number in bootstrap-feature.md
  - AC-AP-6: `grep -n "plan.md\|authoritative\|refine\|in-place" src/agents/planner.md` returns ≥2 matches
  - AC-AP-7: `grep -iE "auto.*save\|plan.md\|plan mode" README.md` returns ≥1 match
  - AC-AP-8 through AC-AP-10: verified by transcript inspection during implement-slice runs
  - Cross-file parity: `diff <(grep -A 10 "Plan-Mode Persistence" src/claude.md 2>/dev/null) <(grep -A 10 "Plan-Mode Persistence" src/CLAUDE.md 2>/dev/null)` returns no diff (same-inode files are always in sync — this is a no-op verification)
- **Verify:** Run all AC grep commands listed above in sequence; each must return the expected minimum match count
- **Done when:** All 7 grep-based AC checks (AC-AP-1 through AC-AP-7) return non-zero match counts AND no grep returns an unexpected 0 when ≥1 is required
- **Pre-review:** none

## Wave summary table

| Wave | Slices | Rationale |
|------|--------|-----------|
| 1    | 1, 2   | Independent — no shared files. `src/claude.md` and `src/commands/bootstrap-feature.md` are disjoint paths. |
| 2    | 3, 4   | Independent — no shared files. `src/agents/planner.md` and `README.md` are disjoint paths. Wave 2 does not logically depend on Wave 1 content (planner.md changes are a new instruction, not dependent on the persistence rule being written). |
| 3    | 5      | Verification pass — reads all 4 files modified in Waves 1 and 2. Must follow both waves to validate AC-AP-1 through AC-AP-7. |

## Acceptance criteria

- [ ] **AC-AP-1:** `grep -n "ExitPlanMode" src/claude.md` returns ≥1 line whose ±5-line context contains "Write" and "plan.md"
- [ ] **AC-AP-2:** `grep -n "MANDATORY\|MUST" src/claude.md | grep -i "plan.md\|ExitPlanMode"` returns ≥1 match with uppercase MUST
- [ ] **AC-AP-3:** `grep -n "Step 0\|plan.md" src/commands/bootstrap-feature.md` returns ≥2 matches
- [ ] **AC-AP-4:** `grep -n "error.*plan.md\|plan.md.*not found\|Enter plan mode" src/commands/bootstrap-feature.md` returns ≥1 match
- [ ] **AC-AP-5:** The Step 0 block line number is less than the Step 1 (prd-writer) line number in `src/commands/bootstrap-feature.md`
- [ ] **AC-AP-6:** `grep -n "plan.md\|authoritative\|refine\|in-place" src/agents/planner.md` returns ≥2 matches
- [ ] **AC-AP-7:** `grep -iE "auto.*save\|plan.md\|plan mode" README.md` returns ≥1 match
- [ ] **AC-AP-8:** Running `/bootstrap-feature` in a project where `.claude/plan.md` does NOT exist produces the exact error substring `error: .claude/plan.md not found` before any downstream agent is invoked
- [ ] **AC-AP-9:** Running `/bootstrap-feature` in a project where `.claude/plan.md` exists and is non-empty proceeds past Step 0 without any error about the missing plan
- [ ] **AC-AP-10:** After a plan-mode session exits via `ExitPlanMode`, `<project>/.claude/plan.md` exists and is non-empty (verifiable by `test -f <project>/.claude/plan.md && [ -s <project>/.claude/plan.md ]`)

## Files to modify

1. `src/claude.md` **[MODIFIED]** — new `### Plan-Mode Persistence (MANDATORY)` subsection added before line 211 (before `"Only call ExitPlanMode after Review Notes are written."`). Also modifies `src/CLAUDE.md` atomically (same inode — HFS+ case-insensitive; single edit operation).
2. `src/commands/bootstrap-feature.md` **[MODIFIED]** — new `### Step 0: Verify plan exists` block inserted between lines 5 and 7.
3. `src/agents/planner.md` **[MODIFIED]** — new bullet at top of Process step list (read plan.md as authoritative input); new `### plan.md In-Place Refinement` subsection in Output Format section.
4. `README.md` **[MODIFIED]** — new row added to Hardening table (lines 145–164); new paragraph documenting auto-persist behavior after the table.

Zero new files. No template changes. No `install.sh` changes (per architect Decision A and E).

## Risk assessment

1. **Risk: Claude forgets to Write before ExitPlanMode (rule is instructional, not enforced).** The `Write` and `ExitPlanMode` are independent tool calls with no API-level enforcement ordering. A context-compressed session or model regression could call `ExitPlanMode` first. **Mitigation:** The new rule in `src/claude.md` is MANDATORY with MUST language. The `/bootstrap-feature` Step 0 abort serves as the downstream catch — if plan.md is absent, the pipeline aborts with a clear error before any agent is invoked. Two-layer protection (persist-on-exit + precondition-on-bootstrap).
2. **Risk: `<project>/.claude/plan.md` already exists from a prior feature cycle (overwrite).** FR-AP-1.3 mandates overwrite — the file is always replaced with the current plan. Multi-branch users with shared `.claude/` directories will have their prior feature's plan silently discarded. **Mitigation:** Overwrite policy is explicitly documented in FR-AP-1.3 and in the `### Plan-Mode Persistence` rule text. Users with concurrent feature branches should use separate git worktrees (documented in PRD §14.8 Risk 2).
3. **Risk: No git root present when ExitPlanMode fires.** If `git rev-parse --show-toplevel` fails, the fallback is CWD. If `.claude/` does not exist in the CWD, the `Write` tool will fail because Claude Code does not auto-create parent directories. **Mitigation:** The persistence rule (Slice 1) includes the `Bash mkdir -p <project-root>/.claude` directory-creation step (architect Decision C) as Step 2 of the 4-step persistence sequence, executed before the `Write`. If `mkdir -p` itself fails (e.g., permission denied), FR-AP-1.2 mandates withholding `ExitPlanMode` and reporting the error to the developer.

## Dependencies

No external libraries, APIs, SDKs, or services required. All changes are markdown prompt-file edits to existing files within `src/`. No `install.sh` changes. No new npm packages, Rust crates, or Python packages. No schema changes. No HTTP API changes. The feature takes effect on the next Claude Code session after `bash install.sh` re-runs to copy `src/claude.md` to `~/.claude/CLAUDE.md` (per NFR-AP-3).

## Review Notes

### Critic Findings

- **Total**: 2 findings (0 critical, 0 major, 2 minor)
- **All CRITICAL/MAJOR addressed**: Yes (none found)

### Changes Made

- No CRITICAL or MAJOR findings required changes to the plan body.

### Acknowledged Minor Issues

1. **MINOR — Slice 5 `Files:` includes all 4 modified files but makes no changes.** Slice 5 is a read-only verification pass (grep-based AC compliance check). Its `Files:` list includes all 4 modified files in Wave 3 — which is correct (cross-wave file overlap is valid per wave assignment rules). The slice is intentionally a consolidation step that verifies all AC-AP-1 through AC-AP-7 greps pass after Waves 1 and 2 complete. No fix needed — the pattern is valid for a markdown-only project where "does the text exist" is the primary correctness criterion.

2. **MINOR — Slice 3 `Done when:` references `"FR-AP-3"` as a grep target in `src/agents/planner.md`.** The string `FR-AP-3` is a PRD reference that does not need to literally appear in the file; the more load-bearing grep targets are `"in-place"` and `"append.*Implementation Plan"`. The `Done when:` condition uses `|` alternation — if `"FR-AP-3"` returns 0 hits, `"in-place"` or `"append.*Implementation Plan"` must return hits. The `wc -l | grep -q "[1-9]"` check ensures at least one match exists. Low-risk to leave as-is since the other terms are the real gate.
