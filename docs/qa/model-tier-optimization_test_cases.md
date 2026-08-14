# Test Cases: Agent Model Tier Optimization

> Based on [PRD](../PRD.md) -- Section 3 and [Use Cases](../use-cases/model-tier-optimization_use_cases.md)

> **Status caveat.** PRD Section 3 is marked `[SUPERSEDED]`. None of its functional requirements were implemented as written — the `model:` values in agent frontmatter are the result of a manual edit that happens to match the intended tiers, not of Section 3's mechanism. These test cases still pass, because they assert the tier values actually present in `agents/*.md`, and they are retained for that reason. The replacement mechanism (a profile applied at install time, plus a CI drift check) arrives in roadmap feature F4, which will supersede this document.

**Note:** This project contains no runtime code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" means verifying file existence, structural correctness, content presence, and cross-reference integrity by reading files and checking their contents. The bulk of these tests use `grep -l` and direct file reads to assert tier assignments.

---

## 1. Opus-Tier Agent Preservation (3 Agents)

### 1.1 Architect, Planner, Security-Auditor Stay on Opus

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | UC-1 (Primary Flow, Step 2) | `src/agents/architect.md` frontmatter `model:` field is `opus` | `src/agents/architect.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: opus` exactly once in frontmatter (FR-2.1) |
| 1.1.2 | UC-1 (Primary Flow, Step 2) | `src/agents/planner.md` frontmatter `model:` field is `opus` | `src/agents/planner.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: opus` exactly once in frontmatter (FR-2.2) |
| 1.1.3 | UC-1 (Primary Flow, Step 2) | `src/agents/security-auditor.md` frontmatter `model:` field is `opus` | `src/agents/security-auditor.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: opus` exactly once in frontmatter (FR-2.3) |
| 1.1.4 | UC-1 (Postconditions), AC-1 | Exactly 3 agent files declare `model: opus` -- no more, no fewer | Implementation complete | Run `grep -l "model: opus" src/agents/*.md` and count results; capture the filenames | Exactly 3 file paths returned, equal to: `src/agents/architect.md`, `src/agents/planner.md`, `src/agents/security-auditor.md` |
| 1.1.5 | UC-1-EC7 | The 3-opus list is non-negotiable for this feature -- security-auditor specifically remains on opus | Implementation complete | Read `src/agents/security-auditor.md` frontmatter | `model: opus` is present (any change requires a new PRD section, not this one) |

---

## 2. Sonnet-Tier Agent Conversion (10 Agents)

### 2.1 Each Sonnet-Tier Agent Has `model: sonnet`

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | UC-1 (Primary Flow, Step 1) | `src/agents/ba-analyst.md` frontmatter `model:` field is `sonnet` | `src/agents/ba-analyst.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.1) |
| 2.1.2 | UC-1 (Primary Flow, Step 1) | `src/agents/build-runner.md` frontmatter `model:` field is `sonnet` | `src/agents/build-runner.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.2) |
| 2.1.3 | UC-1 (Primary Flow, Step 1) | `src/agents/code-reviewer.md` frontmatter `model:` field is `sonnet` | `src/agents/code-reviewer.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.3) |
| 2.1.4 | UC-1 (Primary Flow, Step 1) | `src/agents/doc-updater.md` frontmatter `model:` field is `sonnet` | `src/agents/doc-updater.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.4) |
| 2.1.5 | UC-1 (Primary Flow, Step 1) | `src/agents/e2e-runner.md` frontmatter `model:` field is `sonnet` | `src/agents/e2e-runner.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.5) |
| 2.1.6 | UC-1 (Primary Flow, Step 1) | `src/agents/prd-writer.md` frontmatter `model:` field is `sonnet` | `src/agents/prd-writer.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.6) |
| 2.1.7 | UC-1 (Primary Flow, Step 1) | `src/agents/qa-planner.md` frontmatter `model:` field is `sonnet` | `src/agents/qa-planner.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.7) |
| 2.1.8 | UC-1 (Primary Flow, Step 1) | `src/agents/refactor-cleaner.md` frontmatter `model:` field is `sonnet` | `src/agents/refactor-cleaner.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.8) |
| 2.1.9 | UC-1 (Primary Flow, Step 1) | `src/agents/test-writer.md` frontmatter `model:` field is `sonnet` | `src/agents/test-writer.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.9) |
| 2.1.10 | UC-1 (Primary Flow, Step 1), UC-1-EC1 | `src/agents/verifier.md` frontmatter `model:` field is `sonnet` (superseded from opus by Section 3) | `src/agents/verifier.md` exists | Read the YAML frontmatter; locate the `model:` line | The file contains `model: sonnet` exactly once in frontmatter (FR-1.10). This supersedes the original Section 1 NFR-4 pin to opus. |

### 2.2 Sonnet Set Boundary -- Exactly 10, By Filename

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | UC-1 (Postconditions), AC-2 | Exactly 10 agent files declare `model: sonnet` -- no more, no fewer | Implementation complete | Run `grep -l "model: sonnet" src/agents/*.md` and count results; capture the filenames | Exactly 10 file paths returned: `ba-analyst.md`, `build-runner.md`, `code-reviewer.md`, `doc-updater.md`, `e2e-runner.md`, `prd-writer.md`, `qa-planner.md`, `refactor-cleaner.md`, `test-writer.md`, `verifier.md` |
| 2.2.2 | UC-1-EC4 | The 10-vs-3 split is exact, not approximate | Implementation complete | Sum the counts from `grep -l "model: opus"` and `grep -l "model: sonnet"` | Sum equals exactly 13 (3 opus + 10 sonnet); no agent file has any other `model:` value or is missing the field |
| 2.2.3 | UC-1-EC5 | Tier assertions are line-number-agnostic | Implementation complete | Read each agent's frontmatter (line numbers may vary if other fields are reordered in future) | Tier verification matches on the `model:` key, not on a hardcoded line number; tests still pass regardless of the line where `model:` appears |

### 2.3 Diff Discipline -- Only the Model Line Changes (AC-7)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.3.1 | UC-1 (Primary Flow, Step 3), AC-7 | `ba-analyst.md` diff against pre-feature state is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/ba-analyst.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); `name`, `description`, `tools`, and entire body are byte-identical |
| 2.3.2 | UC-1 (Primary Flow, Step 3), AC-7 | `build-runner.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/build-runner.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.3 | UC-1 (Primary Flow, Step 3), AC-7 | `code-reviewer.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/code-reviewer.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.4 | UC-1 (Primary Flow, Step 3), AC-7 | `doc-updater.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/doc-updater.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.5 | UC-1 (Primary Flow, Step 3), AC-7 | `e2e-runner.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/e2e-runner.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.6 | UC-1 (Primary Flow, Step 3), AC-7 | `prd-writer.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/prd-writer.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.7 | UC-1 (Primary Flow, Step 3), AC-7 | `qa-planner.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/qa-planner.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.8 | UC-1 (Primary Flow, Step 3), AC-7 | `refactor-cleaner.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/refactor-cleaner.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.9 | UC-1 (Primary Flow, Step 3), AC-7 | `test-writer.md` diff is exactly one line change | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/test-writer.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); all other content unchanged |
| 2.3.10 | UC-1 (Primary Flow, Step 3), AC-7, UC-1-EC1 | `verifier.md` diff is exactly one line change (the supersession of Section 1 NFR-4) | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/verifier.md` | Exactly one line removed (`model: opus`) and one line added (`model: sonnet`); the verifier body, tools, name, description are byte-identical |

### 2.4 Frontmatter Structural Integrity

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.4.1 | UC-1 (Primary Flow, Step 3), FR-1.11 | All 13 agent files have valid YAML frontmatter | Implementation complete | For each file in `src/agents/*.md`, parse the YAML block between `---` delimiters | Every file has a parseable frontmatter block with `name`, `description`, `tools`, `model` fields |
| 2.4.2 | UC-1-E1 | Each modified agent file still has its `name` field unchanged | Pre-feature git history available | For each of the 10 sonnet-tier agents, compare the `name:` line before and after the change | The `name:` value is byte-identical to the pre-feature value for every file |
| 2.4.3 | UC-1-E1 | Each modified agent file still has its `description` field unchanged | Pre-feature git history available | For each of the 10 sonnet-tier agents, compare the `description:` line before and after the change | The `description:` value is byte-identical to the pre-feature value for every file |
| 2.4.4 | UC-1-E1 | Each modified agent file still has its `tools` field unchanged | Pre-feature git history available | For each of the 10 sonnet-tier agents, compare the `tools:` array before and after the change | The `tools:` array is byte-identical to the pre-feature value for every file |
| 2.4.5 | UC-1-E1 | Each modified agent file body is byte-identical to the pre-feature version | Pre-feature git history available | For each of the 10 sonnet-tier agents, compare the content after the closing `---` frontmatter delimiter | The body is byte-identical to the pre-feature value for every file (no whitespace or content drift) |

---

## 3. PRD Documentation Updates

### 3.1 Section 1.4 NFR-4 Rewritten (Tiered Policy)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | UC-1 (Primary Flow, Step 4), AC-3 | The phrase "all 13 agents use the same model tier for consistency" is removed from Section 1.4 NFR-4 | `docs/PRD.md` exists | Read Section 1.4 NFR-4; grep for the exact phrase | The phrase is absent from Section 1.4 (and absent from the entire file -- no occurrences anywhere) |
| 3.1.2 | UC-1 (Primary Flow, Step 4), FR-3.1 | Section 1.4 NFR-4 describes the tiered policy (3 opus + 10 sonnet) | `docs/PRD.md` exists | Read Section 1.4 NFR-4 | The text describes a tiered policy: 3 agents on opus, 10 agents on sonnet, with a cost-optimization / right-sizing rationale |
| 3.1.3 | UC-1 (Primary Flow, Step 4), FR-3.2 | Section 1.4 NFR-4 explicitly notes that the original uniform policy was revised by Section 3 | `docs/PRD.md` exists | Read Section 1.4 NFR-4 | The text explicitly acknowledges that the original NFR-4 (uniform opus "for consistency") was an architectural decision intentionally revised by Section 3 of the PRD |
| 3.1.4 | UC-1 (Primary Flow, Step 4), FR-3.3 | Section 1.4 NFR-4 lists the 3 opus agents by name and references Section 3 | `docs/PRD.md` exists | Read Section 1.4 NFR-4 | The text lists `architect`, `planner`, `security-auditor` (or their `.md` filenames) as the opus-tier agents and references Section 3 for the full tier list and rationale |
| 3.1.5 | UC-1-E3 | PRD does not contain internal contradictions about tier policy | `docs/PRD.md` exists | Grep the entire PRD for "uniform" and "consistency" near "model tier" or near "13 agents" | No statement remains anywhere in the PRD that asserts a uniform model tier; Section 1.4 NFR-4 and Section 3 are mutually consistent |

### 3.2 Section 2.4 NFR-4 Unchanged (Wave Computation)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.2.1 | UC-1 (Primary Flow, Step 5), UC-1-EC3 | Section 2.4 NFR-4 still describes wave computation as optional (not model tier) | `docs/PRD.md` exists | Read Section 2.4 NFR-4 (around line 262) | The text contains "Wave computation is optional" and describes the planner's optional wave assignment behavior |
| 3.2.2 | UC-1-EC3 | Section 2.4 NFR-4 does NOT mention model tiers | `docs/PRD.md` exists | Grep Section 2.4 NFR-4 (the bullet on line ~262) for "opus", "sonnet", or "model tier" | None of those terms appear in Section 2.4 NFR-4 -- the implementing agent did not confuse the two NFR-4 references |
| 3.2.3 | UC-1-EC3 | Section 2.4 NFR-4 byte-content is unchanged from pre-feature state | Pre-feature git history available | `git diff <pre-feature-sha> -- docs/PRD.md` and inspect the diff hunks | No diff hunks affect Section 2.4 NFR-4; the line that previously read about wave computation is byte-identical |

---

## 4. QA Test Case Update (Pipeline Hardening Test 1.1.3)

### 4.1 Test 1.1.3 Reflects Tiered Policy

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | UC-1 (Primary Flow, Step 6), AC-6, FR-6.1 | `pipeline-hardening_test_cases.md` test 1.1.3 no longer asserts `model: opus` for verifier | `docs/qa/pipeline-hardening_test_cases.md` exists | Read row `1.1.3` in the file | The Expected Result for verifier no longer states `model: opus`; the row now reflects the tiered policy |
| 4.1.2 | UC-1 (Primary Flow, Step 6), FR-6.1 | `pipeline-hardening_test_cases.md` test 1.1.3 asserts exactly 3 opus and exactly 10 sonnet | `docs/qa/pipeline-hardening_test_cases.md` exists | Read row `1.1.3` in the file | The Expected Result asserts `grep -l "model: opus" src/agents/*.md` returns exactly 3 files (architect, planner, security-auditor) AND `grep -l "model: sonnet" src/agents/*.md` returns exactly 10 files |
| 4.1.3 | UC-1 (Primary Flow, Step 6), FR-6.2, UC-1-EC4 | `pipeline-hardening_test_cases.md` test 1.1.3 lists the 10 sonnet filenames explicitly | `docs/qa/pipeline-hardening_test_cases.md` exists | Read row `1.1.3` in the file | The Expected Result enumerates the 10 sonnet filenames by name (`ba-analyst.md`, `build-runner.md`, `code-reviewer.md`, `doc-updater.md`, `e2e-runner.md`, `prd-writer.md`, `qa-planner.md`, `refactor-cleaner.md`, `test-writer.md`, `verifier.md`) so any future drift triggers a test failure |
| 4.1.4 | UC-1-EC1 | `pipeline-hardening_test_cases.md` test 1.1.3 reflects verifier moving from opus to sonnet | `docs/qa/pipeline-hardening_test_cases.md` exists | Compare the previous (pre-feature) text of test 1.1.3 with the updated text | Updated text references verifier on `sonnet` (not `opus`); the test will now pass against the new state and fail against the old state -- this is the intended supersession |
| 4.1.5 | UC-1-EC2, FR-6.2 | Hardened test 1.1.3 catches future drift -- adding a 14th agent on opus would fail | Implementation complete | Read test 1.1.3 expected result | The expected result asserts "exactly 3" and "exactly 10" by filename, so any silent addition (14th opus agent) or silent retier (an existing agent flipped) breaks the test |

### 4.2 Other Pipeline-Hardening Tests Unaffected

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.2.1 | NFR-2 | Tests 1.1.1, 1.1.2, 1.1.4 in `pipeline-hardening_test_cases.md` are unchanged | Pre-feature git history available | `git diff <pre-feature-sha> -- docs/qa/pipeline-hardening_test_cases.md` | Only row 1.1.3 has diff hunks; rows 1.1.1, 1.1.2, 1.1.4 (and all other tests) are byte-identical |
| 4.2.2 | NFR-2 | Test case 5.2.5 (13 agent files in `src/agents/`) still passes | Implementation complete | Run a Glob on `src/agents/*.md` | Returns exactly 13 files -- the count is unaffected by tier changes |

---

## 5. README Customization Documentation

### 5.1 Per-Agent Tier List

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | UC-1 (Primary Flow, Step 7), AC-4, FR-4.1 | `README.md` Customization section contains a per-agent tier list | `README.md` exists | Read the Customization section; locate the tier subsection | A subsection lists each of the 13 agents with its model tier (opus or sonnet) and a brief rationale for the tier choice |
| 5.1.2 | FR-4.1 | The README tier list includes all 3 opus agents with rationale | `README.md` exists | Read the tier subsection | The list includes `architect`, `planner`, `security-auditor` each annotated as `opus` with a rationale (cascading-decision impact) |
| 5.1.3 | FR-4.1 | The README tier list includes all 10 sonnet agents with rationale | `README.md` exists | Read the tier subsection | The list includes `ba-analyst`, `build-runner`, `code-reviewer`, `doc-updater`, `e2e-runner`, `prd-writer`, `qa-planner`, `refactor-cleaner`, `test-writer`, `verifier` each annotated as `sonnet` with a rationale (structured/mechanical work, downstream verification catches errors) |
| 5.1.4 | FR-4.2 | The README explains the general principle for tier selection | `README.md` exists | Read the tier subsection | The text states the principle: opus for cascading-decision agents, sonnet for structured/mechanical agents whose output is verified downstream |

### 5.2 Override Instructions

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.2.1 | UC-1 (Primary Flow, Step 7), AC-4, FR-4.3 | `README.md` documents the override procedure | `README.md` exists | Read the tier subsection in Customization | The text instructs readers how to override: edit the `model:` field in the agent's frontmatter, then re-run `bash install.sh` |
| 5.2.2 | UC-1-E4 | The README override instructions include the re-install + new-session requirement | `README.md` exists | Read the tier subsection | The text reinforces NFR-3: changes take effect on the next Claude Code session after re-running `bash install.sh` |

---

## 6. CONTRIBUTING.md Template Update

### 6.1 Default Model is Sonnet

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.1.1 | UC-1 (Primary Flow, Step 8), AC-5, FR-5.1 | `CONTRIBUTING.md` agent template shows `model: sonnet` | `CONTRIBUTING.md` exists | Read the agent template / example frontmatter block | The template includes `model: sonnet` (not `model: opus`) as the default |
| 6.1.2 | UC-1-EC2 | New agents added by future contributors default to sonnet | `CONTRIBUTING.md` exists | Read the agent template and any accompanying guidance | The template default is sonnet; contributors are guided to choose sonnet unless the opus criteria explicitly apply |

### 6.2 Opus-Selection Guidance

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.2.1 | UC-1 (Primary Flow, Step 8), AC-5, FR-5.2 | `CONTRIBUTING.md` provides opus-selection criteria | `CONTRIBUTING.md` exists | Read the guidance accompanying the agent template | The guidance states opus should be chosen ONLY when (a) the agent's output cascades through multiple downstream agents AND (b) a wrong decision cannot be caught by deterministic verification (typecheck, test, build) |
| 6.2.2 | UC-1 (Primary Flow, Step 8), FR-5.3 | `CONTRIBUTING.md` references PRD Section 3 for full rationale | `CONTRIBUTING.md` exists | Read the guidance section | The guidance references Section 3 of `docs/PRD.md` for the full rationale of the tiered policy |

---

## 7. Cross-Cutting Concerns

### 7.1 Backward Compatibility (NFR-2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.1.1 | NFR-2 | No agent file is added or removed by this feature | Implementation complete | Glob `src/agents/*.md` and count results | Exactly 13 files -- same as pre-feature count |
| 7.1.2 | NFR-2 | No agent's `name`, `description`, or `tools` field changes | Pre-feature git history available | `git diff <pre-feature-sha> -- src/agents/` and inspect every diff hunk | Every diff hunk is exactly the `model:` line; no `name:`, `description:`, `tools:` line appears in any diff |
| 7.1.3 | NFR-2 | No command file is modified by this feature | Pre-feature git history available | `git diff <pre-feature-sha> -- src/commands/` | No diff hunks -- commands invoke agents by name and resolve tier from frontmatter |
| 7.1.4 | NFR-2 | No rule file is modified by this feature | Pre-feature git history available | `git diff <pre-feature-sha> -- src/rules/` | No diff hunks -- rules are agent-agnostic |
| 7.1.5 | NFR-2 | `src/claude.md` is unchanged by this feature | Pre-feature git history available | `git diff <pre-feature-sha> -- src/claude.md` | No diff hunks -- agent count and Plan Critic logic are unaffected |

### 7.2 Install Script (NFR-3)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.2.1 | UC-1 (Primary Flow, Step 9), UC-1-EC6 | `install.sh` requires no modification (uses glob) | `install.sh` exists | Read the agent copy section of `install.sh` | The script copies `src/agents/*.md` via a glob pattern; no explicit file manifest update needed |
| 7.2.2 | UC-1 (Primary Flow, Steps 10-11), AC-8 | After re-install, `~/.claude/agents/` reflects the new tiers | `bash install.sh` has been run | Read the installed copy of each agent in `~/.claude/agents/` | The installed copies have the same `model:` values as the source files: 3 opus, 10 sonnet |
| 7.2.3 | UC-1-E4 | A user who skips re-install does NOT see the new tiers (documented behavior) | Pre-install state in `~/.claude/agents/` | Inspect installed copies before running `bash install.sh` after the source change | Installed copies still have old `model: opus` values -- this is the expected pre-install state, recovery is to run `bash install.sh` |

### 7.3 Agent Count Preservation (NFR-5)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.3.1 | NFR-5 | Total agent count remains 13 | Implementation complete | Glob `src/agents/*.md` and count | Exactly 13 files |
| 7.3.2 | NFR-5 | `README.md` "13 agents" reference remains valid | Implementation complete | Grep `README.md` for "13 agents" and "12 agents" | "13 agents" reference still exists; "12 agents" does not appear |
| 7.3.3 | NFR-5 | `src/claude.md` agent table still has 13 rows | Implementation complete | Count agent rows in the Agency Roles table | Exactly 13 rows (unchanged from pre-feature state) |

---

## 8. Error and Edge Case Coverage

### 8.1 Malformed YAML Recovery (UC-1-E1)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.1.1 | UC-1-E1 | Malformed YAML in any agent file is detectable by frontmatter parsing | `src/agents/*.md` exists | Attempt to YAML-parse the frontmatter block of each file | All 13 files parse without YAML errors; missing `---` delimiters or typos like `modle:` would fail this check |
| 8.1.2 | UC-1-E1 | Diff multi-line drift on a "should-be-one-line" change is a structural red flag | Pre-feature git history available | For each of the 10 sonnet-tier agents, count the number of changed lines in `git diff` | Each file has exactly one line removed and one line added (net change = 1 line); a multi-line diff indicates either a YAML error or accidental field damage |
| 8.1.3 | UC-1-E1 | Each agent file still contains the closing `---` frontmatter delimiter | Implementation complete | Read each agent file; verify the second `---` line still exists | Every file has its closing frontmatter delimiter intact |

### 8.2 Wrong Tier Assignment (UC-1-E2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.2.1 | UC-1-E2 | An accidentally promoted opus agent (e.g., architect.md changed to sonnet) is detected | Implementation complete | Run `grep -l "model: opus" src/agents/*.md` | If the result count is not 3, OR the result list does not equal `{architect, planner, security-auditor}`, the test fails -- catching the wrong-tier drift |
| 8.2.2 | UC-1-E2 | An accidentally demoted sonnet agent (e.g., test-writer.md left on opus) is detected | Implementation complete | Run `grep -l "model: sonnet" src/agents/*.md` | If the result count is not 10, OR any expected sonnet filename is missing, the test fails -- catching the conversion miss |
| 8.2.3 | UC-1-E2 | The intersection of the opus and sonnet sets is empty | Implementation complete | Compare results of the two grep commands | No filename appears in both result sets (no agent has both `model: opus` AND `model: sonnet` lines) |
| 8.2.4 | UC-1-E2 | Every agent file appears in exactly one of the two grep results | Implementation complete | Union the opus and sonnet grep results; compare to Glob `src/agents/*.md` | The union equals the full set of 13 agent files; no agent is missing from both lists |

### 8.3 PRD Internal Consistency (UC-1-E3)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.3.1 | UC-1-E3 | PRD does not contain the old uniform-tier phrase anywhere | `docs/PRD.md` exists | Grep the entire PRD for "all 13 agents use the same model tier" | Zero matches |
| 8.3.2 | UC-1-E3 | Section 1.4 NFR-4 references Section 3 for the new policy | `docs/PRD.md` exists | Read Section 1.4 NFR-4 | The text contains a reference to Section 3 (e.g., "see Section 3" or "superseded by Section 3") |
| 8.3.3 | UC-1-E3 | Section 3 still references Section 1 NFR-4 supersession in its rationale | `docs/PRD.md` exists | Read Section 3 (description, NFR-6, risks/dependencies) | Section 3 documents that it supersedes Section 1 NFR-4's uniform-tier policy |

### 8.4 Re-Install Required (UC-1-E4)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.4.1 | UC-1-E4 | NFR-3 (re-install required) is documented in PRD | `docs/PRD.md` exists | Read Section 3 NFR-3 | The text states changes take effect on the next Claude Code session after `bash install.sh` |
| 8.4.2 | UC-1-E4 | README override section reinforces the re-install requirement | `README.md` exists | Read the README tier subsection | The instructions tell readers to re-run `bash install.sh` after editing frontmatter |

### 8.5 Verifier Supersession Edge Case (UC-1-EC1)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.5.1 | UC-1-EC1 | `src/agents/verifier.md` is in the sonnet set, not the opus set | Implementation complete | Inspect the result lists of both grep commands | `verifier.md` appears in the `model: sonnet` result list and does NOT appear in the `model: opus` result list |
| 8.5.2 | UC-1-EC1 | The pipeline-hardening QA test 1.1.3 has been updated to reflect verifier-on-sonnet | `docs/qa/pipeline-hardening_test_cases.md` exists | Read row 1.1.3 | The Expected Result includes `verifier.md` in the sonnet enumeration; it does NOT assert verifier is on opus |
| 8.5.3 | UC-1-EC1 | Section 3.10 risks/dependencies acknowledges verifier supersession | `docs/PRD.md` exists | Read Section 3.10, dependency #6 ("Section 1 NFR-4 (verifier model tier)") | The dependency note explicitly states that Section 3 supersedes Section 1 NFR-4's verifier-on-opus pin and that verifier moves to sonnet (FR-1.10) |

### 8.6 Two NFR-4 References Distinguished (UC-1-EC3)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.6.1 | UC-1-EC3 | Section 1.4 NFR-4 and Section 2.4 NFR-4 are correctly distinguished | `docs/PRD.md` exists | Read both Section 1.4 NFR-4 (line ~75) and Section 2.4 NFR-4 (line ~262) | Section 1.4 NFR-4 is rewritten to describe the tiered model policy; Section 2.4 NFR-4 still describes optional wave computation -- the implementing agent did not confuse them |
| 8.6.2 | UC-1-EC3 | Section 2.4 NFR-4 contains the phrase "Wave computation is optional" | `docs/PRD.md` exists | Grep around line 262 of `docs/PRD.md` for "Wave computation is optional" | The phrase is present and unmodified |
| 8.6.3 | UC-1-EC3 | Section 1.4 NFR-4 does NOT contain the phrase "Wave computation is optional" | `docs/PRD.md` exists | Grep Section 1.4 NFR-4 for "Wave computation" | No match -- the two sections are not cross-contaminated |

### 8.7 Future-Drift Guard (UC-1-EC2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.7.1 | UC-1-EC2, FR-6.2 | Adding a 14th agent on opus without PRD update would fail QA test 1.1.3 | Implementation complete | Read test 1.1.3 hardened expected result | The expected result asserts "exactly 3" opus and lists the exact 3 filenames; any 4th opus agent fails the test |
| 8.7.2 | UC-1-EC2, NFR-6 | Future agents must be tiered per Section 3 policy (documented in CONTRIBUTING) | `CONTRIBUTING.md` exists | Read the agent template guidance | The guidance points to PRD Section 3 and codifies sonnet as default with opus-justification criteria |

### 8.8 Non-Negotiable Opus Set (UC-1-EC7)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.8.1 | UC-1-EC7 | The 3-opus set is fixed for this feature: architect, planner, security-auditor | Implementation complete | Compare the actual `grep -l "model: opus"` output to the expected set | Result equals exactly `{architect.md, planner.md, security-auditor.md}` -- no more, no fewer; reviewer pushback to move security-auditor would require a new PRD section |

### 8.9 Sonnet Identifier Resolution (UC-1-EC8)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.9.1 | UC-1-EC8 | The string `sonnet` is the chosen tier identifier (matches Claude Code expectations) | Implementation complete | Read the `model:` value of any sonnet-tier agent | Value is the literal string `sonnet` (not `claude-sonnet`, not a fully-qualified model name) |
| 8.9.2 | UC-1-EC8 | The string `opus` is the chosen tier identifier for the 3 opus agents | Implementation complete | Read the `model:` value of any opus-tier agent | Value is the literal string `opus` (consistent with pre-feature state) |

---

## 9. Subset Roll-Out Coordination (UC-1-A1)

### 9.1 Documentation Co-Lands With Final Conversion

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.1.1 | UC-1-A1 (Step 5) | When the final agent is converted to sonnet, all 4 documentation updates land in the same commit (or commit series) | Implementation complete | Inspect git log around the final conversion commit | The PRD update, QA test update, README update, and CONTRIBUTING update are present in commits at or before the final agent conversion -- not lagging |
| 9.1.2 | UC-1-A1 (Step 7) | Intermediate state: QA test 1.1.3 update does NOT land before all 10 agent conversions | Implementation complete | Walk through git history -- check that every commit where test 1.1.3 asserts "10 sonnet" already has all 10 agents on sonnet | No commit exists where test 1.1.3 asserts "10 sonnet" but the agent files still show fewer than 10 sonnet declarations |

### 9.2 Implementing Agent Path (UC-1-A2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.2.1 | UC-1-A2 (Step 4) | Slice ordering does not produce a transient state where test 1.1.3 fails | Implementation complete | Inspect the slice plan for ordering of agent edits vs. QA test update | The plan ensures the QA test update occurs in a slice that runs in a wave at or after all agent edits are complete |
| 9.2.2 | UC-1-A2 (Step 5) | Final merge-ready run confirms AC-1 through AC-8 | Implementation complete | Run `/merge-ready` on the final state | All quality gates pass: build, code review, security audit, verifier, e2e; all 8 acceptance criteria are confirmed |

---

## 10. Acceptance Criteria Mapping

### 10.1 AC Coverage

| # | Acceptance Criterion | Covered By Test Cases |
|---|----------------------|----------------------|
| 10.1.1 | AC-1 (exactly 3 opus) | 1.1.1, 1.1.2, 1.1.3, 1.1.4 |
| 10.1.2 | AC-2 (exactly 10 sonnet by filename) | 2.1.1 -- 2.1.10, 2.2.1, 2.2.2 |
| 10.1.3 | AC-3 (Section 1.4 NFR-4 rewritten) | 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5 |
| 10.1.4 | AC-4 (README documents tiers + override) | 5.1.1 -- 5.1.4, 5.2.1, 5.2.2 |
| 10.1.5 | AC-5 (CONTRIBUTING template + guidance) | 6.1.1, 6.1.2, 6.2.1, 6.2.2 |
| 10.1.6 | AC-6 (test 1.1.3 updated) | 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5 |
| 10.1.7 | AC-7 (only model line changed) | 2.3.1 -- 2.3.10, 2.4.2 -- 2.4.5, 7.1.2 |
| 10.1.8 | AC-8 (re-install reflects new tiers) | 7.2.1, 7.2.2, 7.2.3 |

---

## Use Case to Test Case Traceability Matrix

| Use Case | Test Cases |
|----------|------------|
| UC-1 Primary Flow (Step 1, sonnet conversions) | 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5, 2.1.6, 2.1.7, 2.1.8, 2.1.9, 2.1.10 |
| UC-1 Primary Flow (Step 2, opus preservation) | 1.1.1, 1.1.2, 1.1.3 |
| UC-1 Primary Flow (Step 3, diff discipline) | 2.3.1 -- 2.3.10, 2.4.1 -- 2.4.5 |
| UC-1 Primary Flow (Step 4, PRD rewrite) | 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5 |
| UC-1 Primary Flow (Step 5, Section 2.4 NFR-4 unchanged) | 3.2.1, 3.2.2, 3.2.3 |
| UC-1 Primary Flow (Step 6, QA test update) | 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5 |
| UC-1 Primary Flow (Step 7, README) | 5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.2.1, 5.2.2 |
| UC-1 Primary Flow (Step 8, CONTRIBUTING) | 6.1.1, 6.1.2, 6.2.1, 6.2.2 |
| UC-1 Primary Flow (Steps 9-11, install + session) | 7.2.1, 7.2.2, 7.2.3 |
| UC-1 Postconditions | 1.1.4, 2.2.1, 2.2.2, 3.1.1, 3.2.1 |
| UC-1-A1 (Subset roll-out) | 9.1.1, 9.1.2 |
| UC-1-A2 (Implementing agent path) | 9.2.1, 9.2.2 |
| UC-1-E1 (Malformed YAML) | 8.1.1, 8.1.2, 8.1.3, 2.4.2, 2.4.3, 2.4.4, 2.4.5 |
| UC-1-E2 (Wrong tier assignment) | 8.2.1, 8.2.2, 8.2.3, 8.2.4 |
| UC-1-E3 (Section 1.4 NFR-4 not rewritten) | 8.3.1, 8.3.2, 8.3.3, 3.1.1, 3.1.5 |
| UC-1-E4 (Re-install skipped) | 8.4.1, 8.4.2, 7.2.3, 5.2.2 |
| UC-1-EC1 (Verifier supersession) | 2.1.10, 2.3.10, 4.1.4, 8.5.1, 8.5.2, 8.5.3 |
| UC-1-EC2 (New agent added later) | 6.1.2, 8.7.1, 8.7.2 |
| UC-1-EC3 (Two NFR-4 references) | 3.2.1, 3.2.2, 3.2.3, 8.6.1, 8.6.2, 8.6.3 |
| UC-1-EC4 (Exact 10/3 split, not approximate) | 1.1.4, 2.2.1, 2.2.2, 4.1.5 |
| UC-1-EC5 (Line-number-agnostic assertion) | 2.2.3 |
| UC-1-EC6 (install.sh glob pattern) | 7.2.1 |
| UC-1-EC7 (Non-negotiable opus set) | 1.1.5, 8.8.1 |
| UC-1-EC8 (Sonnet identifier) | 8.9.1, 8.9.2 |
| AC-1 | 1.1.1, 1.1.2, 1.1.3, 1.1.4 |
| AC-2 | 2.1.1 -- 2.1.10, 2.2.1, 2.2.2 |
| AC-3 | 3.1.1, 3.1.2, 3.1.3, 3.1.4, 3.1.5 |
| AC-4 | 5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.2.1, 5.2.2 |
| AC-5 | 6.1.1, 6.1.2, 6.2.1, 6.2.2 |
| AC-6 | 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5 |
| AC-7 | 2.3.1 -- 2.3.10, 2.4.2 -- 2.4.5, 7.1.2 |
| AC-8 | 7.2.1, 7.2.2, 7.2.3 |
| FR-1.1 -- FR-1.10 | 2.1.1 -- 2.1.10 |
| FR-1.11 | 2.4.1 -- 2.4.5, 7.1.2 |
| FR-2.1 -- FR-2.3 | 1.1.1, 1.1.2, 1.1.3 |
| FR-3.1 -- FR-3.3 | 3.1.2, 3.1.3, 3.1.4 |
| FR-4.1 -- FR-4.3 | 5.1.1 -- 5.1.4, 5.2.1, 5.2.2 |
| FR-5.1 -- FR-5.3 | 6.1.1, 6.2.1, 6.2.2 |
| FR-6.1 -- FR-6.2 | 4.1.1, 4.1.2, 4.1.3 |
| NFR-2 (Backward compat) | 4.2.1, 4.2.2, 7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5 |
| NFR-3 (Re-install) | 7.2.1, 7.2.2, 8.4.1 |
| NFR-5 (Agent count remains 13) | 7.3.1, 7.3.2, 7.3.3 |
| NFR-6 (Future tiering policy) | 8.7.2 |
