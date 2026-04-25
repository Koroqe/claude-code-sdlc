# Test Cases: Cognitive Self-Check Protocol -- Fact/Assumption Discipline for Thinking Agents

> Based on [PRD](../PRD.md) -- Section 9 and [Use Cases](../use-cases/cognitive-self-check_use_cases.md)

## Facts

### Verified facts

- The PRD Section 9 (cognitive-self-check feature) spans `docs/PRD.md` lines 2082-2333 with 7 numbered subsections (9.1 through 9.7) and a terminal `## Facts` block at lines 2309-2333 -- verified by Read of `docs/PRD.md` lines 2082-2333 in the current session.
- The 12 in-scope thinking agents are `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer` -- verified via FR-2.1 (line 2140) and design decision 4 (line 2107).
- The 5 exempt executor agents are `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer` -- verified via FR-3.1 (line 2160) and design decision 5 (line 2108).
- The `## Facts` block has four fixed subsections in literal order: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`; empty subsections use the literal placeholder `(none)` -- verified via FR-1.3 (line 2129) and design decision 6 (line 2109).
- Plan Critic Check (a) severity: missing `## Facts` block = MAJOR; subsection empty without `(none)` = MINOR. Plan Critic Check (b) severity: missing `### External contracts` citation = MAJOR; vague source = MINOR -- verified via FR-4.2 (line 2169) and FR-4.4 (line 2171).
- The Plan Critic enforces the rule on FILE-BASED artifacts only; stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each agent's own prompt -- verified via FR-4.6 (line 2173).
- Backward compatibility per FR-7: pre-existing PRD sections (`Date:` predates merge), pre-existing use-case files, pre-existing plan files NOT being re-edited are EXEMPT; missing/malformed `Date:` falls back to "fail closed" (treat as post-merge) per Risk 7 (line 2297) -- verified via FR-7.1, FR-7.2, FR-7.3 (lines 2200-2203).
- Invariants per FR-6: agent count REMAINS 17; gate count REMAINS 10; `install.sh`, `templates/rules/`, `templates/CLAUDE.md`, and the 5 executor files are BYTE-UNCHANGED -- verified via FR-6.1 through FR-6.7 (lines 2186-2194).
- The use-cases file at `docs/use-cases/cognitive-self-check_use_cases.md` documents 16 primary UCs (UC-1 through UC-16) plus 12 cross-cutting UCs (UC-CC-1 through UC-CC-12) -- verified by Read of the use-cases file in the current session.
- The canonical external-contract test fixture is `Stripe.Charge.status` (UC-2-A1, UC-3-E1, UC-5); the canonical internal-symbol non-trip fixture is `userService.findById()` (UC-1-EC1, UC-5-EC1) -- verified by Read of the use-cases file in the current session.
- The format reference for QA test-case files in this repo is established by `docs/qa/role-planner-reuse-teardown_test_cases.md` and `docs/qa/resource-architect-auto-install_test_cases.md` -- verified by partial Reads of both files (header + initial test cases) in the current session.

### External contracts

(none) -- this test-cases document covers an internal SDLC-pipeline rule. No third-party APIs, SDKs, or libraries are integrated by THIS test plan. The example identifiers `Stripe.Charge.status` and `userService.findById()` appear as test fixtures (synthetic inputs to verify heuristic behavior); they are NOT external dependencies of this document.

### Assumptions

- The Plan Critic anchored-vs-unanchored grep policy for `## Facts` heading detection is implementation-time decision per UC-11-A1; this document treats anchored match (`^## Facts$`) as the conservative reading. Risk: unanchored grep would silently pass `## Facts (verified)` instead of producing a finding; how to verify: read implementation Slice 5 when it lands.
- The severity of subsections-out-of-order per UC-11-E2 is treated as MINOR in this document (block exists, format wrong) consistent with FR-4.2's pattern. Risk: implementation may treat as MAJOR; how to verify: read Slice 5 implementation.
- The release-notes file path used for the release-engineer in TC-15.x is `docs/releases/<version>.md` (per FR-2.14 wording); the actual canonical path will be confirmed against Section 6 release-engineer at implementation time.
- The architect re-review consistency test (TC-AR-1) assumes that re-running the architect agent post-merge against this feature triggers the agent's own `## Cognitive Self-Check (MANDATORY)` section per FR-2.5; manual transcript inspection is the verification surface.
- The merge-date guard's exact comparison format (ISO date string vs YYYY-MM-DD prefix vs full timestamp) is implementation-time decision; tests are written generically and assume any reasonable date comparison.

### Open questions

(none) -- the PRD section, the use-cases file, and the format-reference test-case files provide sufficient specification for QA test-case authoring. Implementation-time decisions (anchored grep, ordering severity, exact merge-date format) are documented as assumptions above; they will be resolved by the planner and the implementing slices.

---

**Note:** This project contains no runtime application code. All agents, commands, and rules are markdown files with YAML frontmatter. "Testing" the cognitive-self-check feature means verifying file existence, structural correctness (heading counts, subsection names, exact order), content presence (literal phrase matches, agent slug enumeration), cross-reference integrity, byte-unchanged invariants (via `git diff` and sha256), and (for Plan Critic enforcement tests) observable findings produced when the critic runs against synthetic input artifacts.

---

## Use Case Coverage

Every UC-N and UC-CC-N from the use-cases file maps to one or more test cases below.

| UC | Scenario | Test Cases |
|----|----------|------------|
| UC-1 | Architect emits `## Facts` to stdout before verdict | TC-1.1 |
| UC-1-A1 | Architect emits `### External contracts: (none)` for purely-internal feature | TC-1.2 |
| UC-1-A2 | Architect's `### Assumptions` later contradicted by planner | TC-1.3 |
| UC-1-E1 | Architect forgets `## Facts` block | TC-1.4 |
| UC-1-EC1 | Internal symbol `userService.findById()` not flagged | TC-1.5 |
| UC-1-EC2 | Architect transitively cites prior agent's `## Facts` | TC-1.6 |
| UC-2 | Planner creates `.claude/plan.md` with `## Facts` block | TC-2.1 |
| UC-2-A1 | Plan integrates third-party SDK with proper citation | TC-2.2 |
| UC-2-A2 | Plan inlines upstream `## Facts` blocks | TC-2.3 |
| UC-2-E1 | Planner omits `## Facts` block entirely | TC-2.4 |
| UC-2-EC1 | Plan re-edited post-merge by appending a slice | TC-2.5 |
| UC-3 | PRD-writer adds new section with `## Facts` block | TC-3.1 |
| UC-3-A1 | PRD section dogfoods rule (Section 9 self-reference) | TC-3.2 |
| UC-3-E1 | PRD-writer mentions Stripe without citation | TC-3.3 |
| UC-3-EC1 | PRD section's `Date:` is malformed or missing | TC-3.4 |
| UC-4 | Plan Critic detects missing `## Facts` (MAJOR) | TC-4.1 |
| UC-4-A1 | Plan Critic flags missing block in PRD section | TC-4.2 |
| UC-4-A2 | Plan Critic flags missing block in use-case file | TC-4.3 |
| UC-4-E1 | Plan Critic spawn fails (orchestrator-level) | TC-4.4 |
| UC-4-EC1 | Subsections present but in wrong order | TC-4.5 |
| UC-5 | Plan Critic detects external API without citation (MAJOR) | TC-5.1 |
| UC-5-A1 | External identifier in narrative prose (no backticks) | TC-5.2 |
| UC-5-A2 | Citation present but vague source (MINOR) | TC-5.3 |
| UC-5-E1 | Critic regex throws on malformed input | TC-5.4 |
| UC-5-EC1 | Internal `userService.findById()` not tripped | TC-5.5 |
| UC-5-EC2 | Identifier inside `### External contracts` not double-scanned | TC-5.6 |
| UC-5-EC3 | Identifier in fenced code block | TC-5.7 |
| UC-6 | Plan Critic detects empty subsection without `(none)` (MINOR) | TC-6.1 |
| UC-6-A1 | All four subsections empty | TC-6.2 |
| UC-6-E1 | Subsection has only whitespace or HTML comment | TC-6.3 |
| UC-6-EC1 | `(none)` followed by clarifying parenthetical | TC-6.4 |
| UC-7 | Agent labels unverified claim under `### Assumptions` | TC-7.1 |
| UC-7-A1 | Agent verifies in-session and promotes to `### Verified facts` | TC-7.2 |
| UC-7-A2 | Agent emits user-decision question under `### Open questions` | TC-7.3 |
| UC-7-E1 | Agent silently treats unverified claim as fact | TC-7.4 |
| UC-7-EC1 | Agent cites "I remember from a similar API" | TC-7.5 |
| UC-8 | Plan Critic does NOT flag pre-existing artifacts | TC-8.1 |
| UC-8-A1 | Pre-existing PRD section re-edited post-merge for typo | TC-8.2 |
| UC-8-A2 | Pre-existing plan file extended post-merge | TC-8.3 |
| UC-8-E1 | PRD `Date:` malformed -> fail closed | TC-8.4 |
| UC-8-EC1 | Inlined historical content in current-cycle plan | TC-8.5 |
| UC-9 | Resource-architect emits `## Facts` in `.claude/resources-pending.md` | TC-9.1 |
| UC-9-A1 | Auto-Install Results absent, fallback placement | TC-9.2 |
| UC-9-A2 | No external resources -> `### External contracts: (none)` | TC-9.3 |
| UC-9-E1 | Bootstrap halts at Step 3.5 | TC-9.4 |
| UC-9-EC1 | Cited MCP registry URL goes stale (404) | TC-9.5 |
| UC-10 | Refactor-cleaner emits `## Facts` to stdout + edits code | TC-10.1 |
| UC-10-A1 | Refactor-cleaner finds no targets | TC-10.2 |
| UC-10-E1 | Refactor-cleaner forgets `## Facts` | TC-10.3 |
| UC-10-EC1 | Refactor based on assumption disproven by typecheck | TC-10.4 |
| UC-11 | Format drift (lowercase / wrong heading) | TC-11.1 |
| UC-11-A1 | Heading suffix `## Facts (verified)` | TC-11.2 |
| UC-11-E1 | `# Facts` (single hash) | TC-11.3 |
| UC-11-E2 | Subsection lowercase `### verified facts` | TC-11.4 |
| UC-11-EC1 | `## Facts` heading inside fenced code block | TC-11.5 |
| UC-12 | Verifier emits `## Facts` during `/implement-slice` | TC-12.1 |
| UC-12-A1 | Verifier reports FAIL per Level 1 | TC-12.2 |
| UC-12-E1 | Verifier omits `## Facts` | TC-12.3 |
| UC-12-EC1 | Verifier transitively cites planner's `## Facts` | TC-12.4 |
| UC-13 | Code-reviewer emits `## Facts` and surfaces stdout gaps | TC-13.1 |
| UC-13-A1 | Reviewer detects unverified claim in planner's `## Facts` | TC-13.2 |
| UC-13-E1 | Reviewer omits `## Facts` itself | TC-13.3 |
| UC-13-EC1 | Reviewer correctly recognizes executor exemption | TC-13.4 |
| UC-14 | Security-auditor emits `## Facts` and cites auth/crypto | TC-14.1 |
| UC-14-A1 | No external auth/crypto in scope | TC-14.2 |
| UC-14-E1 | Auditor cites CVE from memory without WebFetch | TC-14.3 |
| UC-14-EC1 | CVE patched in version newer than project's | TC-14.4 |
| UC-15 | Release-engineer emits `## Facts` in release-notes file | TC-15.1 |
| UC-15-A1 | Release notes for cognitive-self-check feature itself | TC-15.2 |
| UC-15-E1 | Release-engineer emits to stdout instead of file | TC-15.3 |
| UC-15-EC1 | Multiple releases pending in same cycle | TC-15.4 |
| UC-16 | Executor agent does NOT emit `## Facts` | TC-16.1 |
| UC-16-A1 | Changelog-writer mechanical mapping | TC-16.2 |
| UC-16-E1 | Executor prompt accidentally modified | TC-16.3 |
| UC-16-EC1 | Reviewer mistakenly demands `## Facts` from executor | TC-16.4 |
| UC-CC-1 | Backward compat smoke test (AC-18) | TC-CC-1 |
| UC-CC-2 | 17-agent / 10-gate count invariant (AC-12, AC-13) | TC-CC-2 |
| UC-CC-3 | install.sh / templates/ byte-unchanged (AC-14, AC-15, AC-16) | TC-CC-3 |
| UC-CC-4 | Executor files byte-unchanged (AC-8) | TC-CC-4 |
| UC-CC-5 | 12 in-scope agents have `## Cognitive Self-Check (MANDATORY)` (AC-6) | TC-CC-5 |
| UC-CC-6 | Rule file six `##` headings (AC-1) | TC-CC-6 |
| UC-CC-7 | Rule file four `###` subsections (AC-2) | TC-CC-7 |
| UC-CC-8 | Rule file bilingual protocol verbatim (AC-3) | TC-CC-8 |
| UC-CC-9 | Plan Critic two new Completeness checks (AC-9, AC-10) | TC-CC-9 |
| UC-CC-10 | README Hardening table one new row (AC-11) | TC-CC-10 |
| UC-CC-11 | PRD Section 9 dogfoods the rule (AC-19) | TC-CC-11 |
| UC-CC-12 | Cross-reference resolution (AC-20) | TC-CC-12 |

## Acceptance Criteria Coverage

Every AC-N from PRD Section 9 maps to one or more test cases.

| AC | Description | Test Cases |
|----|-------------|------------|
| AC-1 | Rule file has exactly six `##` headings in order | TC-CC-6, TC-RF-1 |
| AC-2 | Rule file has exactly four `###` subsection names | TC-CC-7, TC-RF-2 |
| AC-3 | 4-question protocol verbatim Russian + English | TC-CC-8, TC-RF-3 |
| AC-4 | Application Scope lists 12 in-scope + 5 exempt slugs | TC-RF-4, TC-RF-5 |
| AC-5 | Literal phrase "I remember from a similar API / from training data" verbatim | TC-RF-6, TC-7.5 |
| AC-6 | All 12 in-scope agent prompt files have `## Cognitive Self-Check (MANDATORY)` | TC-CC-5, TC-AP-1 |
| AC-7 | Each in-scope agent's section references rule file + specifies `## Facts` location | TC-AP-2, TC-AP-3 |
| AC-8 | 5 executor agent prompt files byte-unchanged | TC-CC-4, TC-INV-5 |
| AC-9 | Plan Critic has two new Completeness checks with severity tags | TC-CC-9, TC-4.1, TC-5.1, TC-6.1 |
| AC-10 | Plan Critic preamble states file-vs-stdout split | TC-CC-9, TC-PC-1 |
| AC-11 | README Hardening table has one new row at end | TC-CC-10 |
| AC-12 | 17-agent count remains | TC-CC-2, TC-INV-1 |
| AC-13 | 10-gate count remains | TC-CC-2, TC-INV-2 |
| AC-14 | `install.sh` byte-unchanged | TC-CC-3, TC-INV-3 |
| AC-15 | `templates/rules/` byte-unchanged | TC-CC-3, TC-INV-4 |
| AC-16 | `templates/CLAUDE.md` byte-unchanged | TC-CC-3, TC-INV-6 |
| AC-17 | Agency Roles table byte-unchanged | TC-INV-7 |
| AC-18 | Plan Critic does NOT flag pre-existing PRD sections | TC-CC-1, TC-8.1 |
| AC-19 | PRD Section 9 itself contains `## Facts` block | TC-CC-11, TC-DOG-1 |
| AC-20 | Cross-references valid (no phantom paths) | TC-CC-12, TC-RF-7 |

---

## 1. Architect Stdout-Only Path

### TC-1.1: Architect emits `## Facts` block to stdout BEFORE verdict
- **Category:** Stdout-Only Agent (Architect)
- **Mapped UC:** UC-1
- **Mapped AC:** AC-6, AC-7
- **Type:** Integration (manual transcript inspection)
- **Severity:** P0
- **Preconditions:** `src/agents/architect.md` contains `## Cognitive Self-Check (MANDATORY)` per FR-2.5; bootstrap reaches Step 3
- **Inputs:** Run `/bootstrap-feature` for a synthetic feature with PRD Section authored after merge date
- **Steps:**
  1. Spawn architect via `/bootstrap-feature` Step 3
  2. Capture full stdout transcript
  3. Locate the verdict line (`APPROVED`, `REJECTED`, or `APPROVED WITH CONDITIONS`)
  4. `grep -B 200 "^APPROVED\|^REJECTED\|^APPROVED WITH CONDITIONS" transcript.txt | grep -c "^## Facts$"`
  5. Verify the four subsection headings appear in literal order after `## Facts` and before the verdict line
- **Expected Result:** Stdout contains exactly one `^## Facts$` line BEFORE the verdict line; subsections appear in order: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`
- **Pass Criteria:** All four subsections present before verdict; the block is not enforced by Plan Critic per FR-4.6.

### TC-1.2: Architect emits `### External contracts: (none)` for purely-internal feature
- **Category:** Stdout-Only Agent (Architect)
- **Mapped UC:** UC-1-A1
- **Mapped AC:** AC-2
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** TC-1.1 passes; the feature has no external integrations
- **Inputs:** Run architect on the cognitive-self-check feature itself (purely internal)
- **Steps:**
  1. Run architect; capture stdout
  2. Locate the `### External contracts` subsection within `## Facts`
  3. Confirm body is the literal `(none)` (optionally followed by a clarifying parenthetical phrase)
- **Expected Result:** `### External contracts` body is `(none)` -- not blank, not omitted.
- **Pass Criteria:** Literal `(none)` placeholder present.

### TC-1.3: Architect's `### Assumptions` later contradicted by planner; audit trail intact
- **Category:** Stdout-Only Agent (Architect)
- **Mapped UC:** UC-1-A2
- **Mapped AC:** AC-7
- **Type:** Integration (cross-agent)
- **Severity:** P2
- **Preconditions:** TC-1.1 passes; planner runs after architect in same cycle
- **Inputs:** Run full bootstrap; architect's `### Assumptions` flags a constraint that planner later corrects
- **Steps:**
  1. Capture architect stdout (transcript)
  2. Capture `.claude/plan.md` produced by planner
  3. Diff the architect's `### Assumptions` against the planner's `### Verified facts`
- **Expected Result:** Architect emitted assumption with risk + verification path; planner emitted corrected verified fact citing in-session Read; the discrepancy is visible in the audit trail.
- **Pass Criteria:** Cross-agent discrepancy is auditable; no automated reconciliation runs.

### TC-1.4: Architect omits `## Facts` block; Plan Critic does NOT mechanically catch
- **Category:** Stdout-Only Agent Enforcement Gap
- **Mapped UC:** UC-1-E1
- **Mapped AC:** (gap per Risk 1, PRD §9.7)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic architect run produces stdout WITHOUT `## Facts` block (mock/manual)
- **Inputs:** Stdout transcript with verdict but no `## Facts`
- **Steps:**
  1. Run Plan Critic against `.claude/plan.md` and `docs/PRD.md` (file-based artifacts)
  2. Confirm no Plan Critic finding is raised about the architect stdout
  3. Verify code-reviewer at /merge-ready Gate 2 SHOULD surface the gap (manual transcript inspection)
- **Expected Result:** Plan Critic raises no finding (FR-4.6 file-vs-stdout split); the gap is documented per Risk 1.
- **Pass Criteria:** Stdout enforcement gap is observable but not mechanically caught -- consistent with the documented split.

### TC-1.5: Internal symbol `userService.findById()` not flagged in architect's stdout
- **Category:** External-Contract Heuristic (Negative)
- **Mapped UC:** UC-1-EC1
- **Mapped AC:** AC-9 (negative case)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Architect's stdout review references `userService.findById()` in backticks; no integration prose nearby
- **Inputs:** Synthetic stdout transcript
- **Steps:**
  1. Confirm `userService.findById()` appears in backticks
  2. Confirm `### External contracts` does NOT cite the symbol
  3. Run Plan Critic against any file-based artifacts (Plan Critic does not see stdout)
- **Expected Result:** No false-positive finding; internal symbol is correctly identified by lowercase initial character heuristic.
- **Pass Criteria:** No spurious MAJOR raised; NFR-6 low-recall property holds.

### TC-1.6: Architect's `### Verified facts` transitively cites prd-writer's `## Facts` block
- **Category:** Cross-Agent Citation
- **Mapped UC:** UC-1-EC2
- **Mapped AC:** AC-5
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** prd-writer emitted Section X with its own `## Facts` block; architect Reads that PRD section line range in current session
- **Inputs:** Architect stdout citing "verified per prd-writer's `## Facts` in PRD §X line YYYY"
- **Steps:**
  1. Confirm architect's `### Verified facts` entry references the PRD line range
  2. Confirm the architect Read those lines in current session (Q2 freshness)
  3. Walk the citation chain back to original verification
- **Expected Result:** Transitive citation chain is auditable; if architect did NOT Read the cited range, the claim belongs under `### Assumptions`, not `### Verified facts`.
- **Pass Criteria:** Audit trail integrity preserved.

---

## 2. Planner File-Writing Path

### TC-2.1: Planner emits `## Facts` block NEAR THE TOP of `.claude/plan.md` (after inlined upstream sections, before `## Prerequisites verified`)
- **Category:** File-Writing Agent (Planner)
- **Mapped UC:** UC-2
- **Mapped AC:** AC-6, AC-7, AC-9
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/planner.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.7; bootstrap reaches Step 5
- **Inputs:** `/bootstrap-feature` for synthetic feature
- **Steps:**
  1. Run planner; capture `.claude/plan.md`
  2. `grep -n "^## Reuse Decisions$" .claude/plan.md` -- record line R (or use line of last inlined upstream section if Reuse Decisions absent)
  3. `grep -n "^## Prerequisites verified$" .claude/plan.md` -- record line P
  4. `grep -n "^## Facts$" .claude/plan.md` -- record line F
  5. Verify R < F < P (Facts appears between the last inlined upstream section and Prerequisites verified)
  6. Verify the four subsections appear in literal order after `## Facts`
  7. Run Plan Critic on `.claude/plan.md`; expect no cognitive-self-check findings
- **Expected Result:** `## Facts` block sits near the top of the plan, after the inlined upstream sections and before `## Prerequisites verified`; four subsections in order; Plan Critic Check (a) PASS, Check (b) PASS.
- **Pass Criteria:** Plan satisfies FR-2.7 and FR-4.1.

### TC-2.2: Plan integrates Stripe SDK with proper `### External contracts` citation
- **Category:** External-Contract Citation (Positive)
- **Mapped UC:** UC-2-A1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Synthetic plan body mentions `Stripe.Charge.status === 'succeeded'` in a slice description
- **Inputs:** `.claude/plan.md` with body containing `Stripe.Charge.status` in backticks AND `### External contracts` citing the Stripe contract with URL
- **Steps:**
  1. Confirm body contains `Stripe.Charge.status` in backticks
  2. Confirm `### External contracts` includes:
     ```
     - `Stripe.Charge.status` enum values -- verified via WebFetch of https://docs.stripe.com/api/charges/object#charge_object-status in current session
     ```
  3. Run Plan Critic Check (b)
- **Expected Result:** Critic finds the dotted identifier, locates citation in `### External contracts`, PASSES with no finding.
- **Pass Criteria:** No MAJOR finding raised; citation is sufficient.

### TC-2.3: Plan inlines upstream `## Facts` blocks from resources/roles pending files
- **Category:** Cross-Agent Inlining
- **Mapped UC:** UC-2-A2
- **Mapped AC:** AC-7
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** `.claude/resources-pending.md` and `.claude/roles-pending.md` exist with their own `## Facts` blocks per FR-2.12 / FR-2.13
- **Inputs:** Planner inlines upstream sections into `.claude/plan.md`
- **Steps:**
  1. Verify upstream sections (`## Recommended Resources`, `## Auto-Install Results`, `## Additional Roles`, `## Reuse Decisions`) appear inlined in `.claude/plan.md`
  2. Verify planner's OWN `## Facts` block appears NEAR THE TOP of `.claude/plan.md` (after `## Reuse Decisions`, before `## Prerequisites verified`) per FR-2.7
  3. Confirm planner's `## Facts` covers plan-authoring decisions (not duplicated upstream-agent facts)
- **Expected Result:** One `## Facts` block near the top of the plan (the planner's, after `## Reuse Decisions` and before `## Prerequisites verified` per FR-2.7); upstream blocks may also appear inlined.
- **Pass Criteria:** Plan structure satisfies FR-2.7 and FR-4.1.

### TC-2.4: Planner omits `## Facts` block; Plan Critic raises MAJOR
- **Category:** Plan Critic Enforcement (File-Based)
- **Mapped UC:** UC-2-E1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR finding)
- **Preconditions:** Synthetic `.claude/plan.md` exists with full plan body but NO `## Facts` heading
- **Inputs:** `grep -F "^## Facts$"` returns zero matches
- **Steps:**
  1. Construct synthetic `.claude/plan.md` lacking `## Facts`
  2. Run Plan Critic
  3. Inspect FINDINGS output
- **Expected Result:** FINDINGS contains exactly one MAJOR entry: `[MAJOR] -- Missing \`## Facts\` block in .claude/plan.md -- required by cognitive-self-check rule per FR-4.1`
- **Pass Criteria:** MAJOR severity raised; finding text references FR-4.1.

### TC-2.5: Plan re-edited post-merge by appending a slice -> `## Facts` required
- **Category:** Backward Compatibility (Re-Edit)
- **Mapped UC:** UC-2-EC1
- **Mapped AC:** AC-18
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Pre-merge `.claude/plan.md` exists; post-merge user appends a new slice
- **Inputs:** Plan file mtime is now POST-merge
- **Steps:**
  1. Save the pre-merge plan (no `## Facts`)
  2. Touch the file (simulate post-merge edit)
  3. Run Plan Critic
- **Expected Result:** Per FR-7.3, the next save MUST add a `## Facts` block; if missing, MAJOR finding raised.
- **Pass Criteria:** Forward-only enforcement upon meaningful re-edit; aligned with UC-2-E1 severity.

---

## 3. PRD-Writer File-Writing Path

### TC-3.1: PRD-writer appends `## Facts` block AFTER `### N.7 Risks and Dependencies`
- **Category:** File-Writing Agent (PRD-Writer)
- **Mapped UC:** UC-3
- **Mapped AC:** AC-6, AC-7, AC-19
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/prd-writer.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.3; bootstrap Step 1 runs for new feature
- **Inputs:** New PRD section appended to `docs/PRD.md`
- **Steps:**
  1. `grep -n "^### .* Risks and Dependencies$" docs/PRD.md` -- record matched line for new section
  2. `grep -n "^## Facts$" docs/PRD.md` -- record matched line for new section
  3. Verify Facts line > Risks-and-Dependencies line (within same section)
  4. Verify four subsections in order
- **Expected Result:** `## Facts` block immediately follows `### N.7 Risks and Dependencies` for the new section.
- **Pass Criteria:** Section structure satisfies FR-2.3.

### TC-3.2: Section 9 dogfoods the rule (self-reference)
- **Category:** Dogfooding
- **Mapped UC:** UC-3-A1
- **Mapped AC:** AC-19
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** PRD Section 9 (cognitive-self-check) is authored
- **Inputs:** `docs/PRD.md` Section 9 (lines 2082-2333)
- **Steps:**
  1. `grep -n "^## Facts$" docs/PRD.md` and confirm a match within Section 9 line range
  2. Confirm `### External contracts: (none)` (purely internal feature)
  3. Confirm `### Verified facts` cites internal cross-references to Sections 1, 3, 6, 8
- **Expected Result:** Section 9 itself has `## Facts` block at line 2309 per the verified facts above; dogfooding satisfied.
- **Pass Criteria:** AC-19 acceptance test PASSES.

### TC-3.3: PRD-writer mentions Stripe.Charge.status without citation; MAJOR finding
- **Category:** Plan Critic External-Contract Check
- **Mapped UC:** UC-3-E1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Synthetic PRD section body contains `Stripe.Charge.status` in backticks; `### External contracts: (none)` (incorrect)
- **Inputs:** PRD section with the omission
- **Steps:**
  1. Construct synthetic section
  2. Run Plan Critic Check (b) per FR-4.3
  3. Inspect findings
- **Expected Result:** FINDINGS contains MAJOR: `\`Stripe.Charge.status\` mentioned in PRD section X without \`### External contracts\` citation -- required by FR-1.4 / FR-4.3`
- **Pass Criteria:** MAJOR raised; severity tag matches FR-4.4.

### TC-3.4: PRD section's `Date:` field is malformed -> fail closed (treat as post-merge)
- **Category:** Backward Compatibility (Date Guard)
- **Mapped UC:** UC-3-EC1
- **Mapped AC:** AC-18
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic PRD section has `Date: TBD` or no `Date:` line at all
- **Inputs:** Section with malformed Date
- **Steps:**
  1. Run Plan Critic against the section
  2. Per Risk 7 (PRD §9.7), the date guard treats missing/malformed as POST-MERGE
  3. If `## Facts` is missing, expect MAJOR; if present, expect PASS
- **Expected Result:** Critic enforces the rule on the section as if current-cycle; missing `## Facts` produces MAJOR per FR-4.2.
- **Pass Criteria:** Fail-closed default holds.

---

## 4. Plan Critic Check (a): Mandatory Facts Section Presence

### TC-4.1: Missing `## Facts` block in `.claude/plan.md` -> MAJOR
- **Category:** Plan Critic Check (a)
- **Mapped UC:** UC-4
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Synthetic `.claude/plan.md` for current-cycle feature, lacking `## Facts`
- **Inputs:** Plan file with full body but no `## Facts` heading
- **Steps:**
  1. `grep -F "^## Facts$"` returns 0
  2. Run Plan Critic
- **Expected Result:** FINDINGS: `[MAJOR] -- Missing \`## Facts\` block in .claude/plan.md`
- **Pass Criteria:** MAJOR severity per FR-4.2.

### TC-4.2: Missing `## Facts` block in current-cycle PRD section -> MAJOR
- **Category:** Plan Critic Check (a)
- **Mapped UC:** UC-4-A1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Current-cycle PRD section (Date >= merge date) lacking `## Facts`
- **Inputs:** Modified `docs/PRD.md`
- **Steps:**
  1. Run Plan Critic on `docs/PRD.md`
  2. Verify the critic identifies the new section by `Date:` field
  3. Verify finding raised
- **Expected Result:** FINDINGS: `[MAJOR] -- Missing \`## Facts\` block in PRD section X -- required by FR-4.1`
- **Pass Criteria:** PRD-section-level enforcement works identically to plan-file enforcement.

### TC-4.3: Missing `## Facts` block in current-cycle use-cases file -> MAJOR
- **Category:** Plan Critic Check (a)
- **Mapped UC:** UC-4-A2
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** `docs/use-cases/<feature>_use_cases.md` for current cycle lacking `## Facts`
- **Inputs:** Use-cases file without facts block
- **Steps:**
  1. Run Plan Critic
  2. Verify Plan Critic checks use-cases file per FR-4.1
- **Expected Result:** FINDINGS: `[MAJOR] -- Missing \`## Facts\` block in docs/use-cases/<feature>_use_cases.md`
- **Pass Criteria:** Use-case file enforcement works.

### TC-4.4: Plan Critic spawn failure (orchestrator-level)
- **Category:** Plan Critic Failure Mode
- **Mapped UC:** UC-4-E1
- **Mapped AC:** (orchestrator-level)
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Orchestrator simulates a critic-spawn failure
- **Inputs:** Critic invocation aborts before checks run
- **Steps:**
  1. Halt orchestrator at Step 6
  2. Verify the failure is reported as a critic-invocation error (not a cognitive-self-check finding)
  3. Re-run bootstrap; verify enforcement runs normally
- **Expected Result:** Orchestrator-level error is independent of the cognitive-self-check feature.
- **Pass Criteria:** No silent skip of enforcement.

### TC-4.5: `## Facts` block present but subsections in wrong order -> MINOR
- **Category:** Plan Critic Check (a) -- Order
- **Mapped UC:** UC-4-EC1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1 (MINOR per assumption)
- **Preconditions:** Synthetic artifact has `## Facts` with `### Assumptions` BEFORE `### External contracts`
- **Inputs:** Out-of-order subsections
- **Steps:**
  1. Construct synthetic facts block with shuffled subsection order
  2. Run Plan Critic Check (a)
- **Expected Result:** FINDINGS: `[MINOR] -- \`## Facts\` block subsections out of order; required order: \`### Verified facts\`, \`### External contracts\`, \`### Assumptions\`, \`### Open questions\` per FR-1.3`
- **Pass Criteria:** MINOR severity per the conservative reading of FR-4.2 (block exists but format-incorrect). NOTE: Severity is implementation-time decision per Assumptions.

---

## 5. Plan Critic Check (b): External Contract Citation

### TC-5.1: External API identifier without citation -> MAJOR
- **Category:** Plan Critic Check (b)
- **Mapped UC:** UC-5
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Synthetic artifact body contains `Stripe.Charge.status` in backticks; `### External contracts` lacks the citation
- **Inputs:** Artifact with omission
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Confirm heuristic detects `<Capitalized>.<word>(.<word>)*` pattern
  3. Confirm citation lookup in `### External contracts` fails
- **Expected Result:** FINDINGS: `[MAJOR] -- External API/SDK/library identifier \`Stripe.Charge.status\` mentioned in artifact body without \`### External contracts\` citation -- required by FR-1.4 / FR-4.3`
- **Pass Criteria:** MAJOR raised per FR-4.4.

### TC-5.2: External identifier in plain prose (no backticks) -> low recall, no finding
- **Category:** Heuristic Low-Recall
- **Mapped UC:** UC-5-A1
- **Mapped AC:** (NFR-6 documentation)
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Artifact mentions "the Stripe Charge status enum" in plain prose, no backticks
- **Inputs:** Prose mention only
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Verify no finding raised
- **Expected Result:** Heuristic does NOT detect plain-prose mention; agent's own self-check is the primary defense per NFR-6.
- **Pass Criteria:** No false positive; documented low-recall behavior holds.

### TC-5.3: Citation present but vague source ("API docs" without URL) -> MINOR
- **Category:** Plan Critic Check (b) -- Vague Source
- **Mapped UC:** UC-5-A2
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1 (MINOR)
- **Preconditions:** `### External contracts` entry: `- \`Stripe.Charge.status\` -- source: API docs`
- **Inputs:** Vague citation
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Inspect finding severity
- **Expected Result:** FINDINGS: `[MINOR] -- \`Stripe.Charge.status\` citation in \`### External contracts\` has vague source ("API docs"); per FR-1.4 the source must identify the verification (URL, SDK version + symbol path, file:line)`
- **Pass Criteria:** MINOR severity per FR-4.4.

### TC-5.4: Plan Critic regex throws on malformed input
- **Category:** Plan Critic Failure Mode
- **Mapped UC:** UC-5-E1
- **Mapped AC:** (NFR-1 boundedness)
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Artifact contains a non-UTF-8 byte sequence
- **Inputs:** Pathological binary blob in artifact
- **Steps:**
  1. Run Plan Critic
  2. Verify the critic surfaces an error rather than silently skipping
- **Expected Result:** Critic emits an error to orchestrator; pathological inputs are out of scope for iter-1.
- **Pass Criteria:** Bounded pattern-match time per NFR-1; no infinite loop.

### TC-5.5: Internal symbol `userService.findById()` does NOT trip Check (b)
- **Category:** Heuristic False-Positive Guard
- **Mapped UC:** UC-5-EC1
- **Mapped AC:** AC-9 (negative)
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Synthetic plan body mentions `userService.findById()` in backticks; no integration prose nearby
- **Inputs:** Internal symbol only
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Verify lowercase initial character does NOT match `^[A-Z]` heuristic
  3. Confirm no finding raised
- **Expected Result:** No false-positive MAJOR; internal symbol is correctly excluded by heuristic per Risk 6 / NFR-6.
- **Pass Criteria:** Heuristic is robust against the canonical internal-symbol fixture.

### TC-5.6: Identifier inside `### External contracts` is not double-scanned
- **Category:** Heuristic Scope
- **Mapped UC:** UC-5-EC2
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Artifact body is clean; `### External contracts` cites `Stripe.Charge.status` with URL
- **Inputs:** Identifier appears ONLY within citation
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Verify scan EXCLUDES the `## Facts` block per FR-4.3
- **Expected Result:** No spurious finding raised on the citation itself.
- **Pass Criteria:** Body-scan scope correctly excludes facts block.

### TC-5.7: Identifier in fenced code block within artifact body
- **Category:** Heuristic Scope
- **Mapped UC:** UC-5-EC3
- **Mapped AC:** AC-9, NFR-6
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Plan has triple-backtick fence containing `Stripe.Charge.status`
- **Inputs:** Code-fenced identifier
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Conservative implementation: code-fenced identifiers ARE scanned per UC-5-EC3
- **Expected Result:** Conservative critic flags fenced identifiers; agent must cite them in `### External contracts`. Implementation-time refinement deferred to iter-2 per NFR-6.
- **Pass Criteria:** Conservative behavior consistent with documented stance.

---

## 6. Plan Critic Check (a): Empty Subsection Without `(none)`

### TC-6.1: Empty subsection without `(none)` -> MINOR
- **Category:** Plan Critic Check (a) -- Empty Marker
- **Mapped UC:** UC-6
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1 (MINOR)
- **Preconditions:** Synthetic `## Facts` block with all four headings present; `### Open questions` has no body
- **Inputs:** Block with bare-empty subsection
- **Steps:**
  1. Run Plan Critic Check (a)
  2. Verify each subsection has either content OR literal `(none)`
- **Expected Result:** FINDINGS: `[MINOR] -- Empty subsection \`### Open questions\` lacks the literal \`(none)\` placeholder -- required by FR-1.3`
- **Pass Criteria:** MINOR severity per FR-4.2.

### TC-6.2: All four subsections empty without placeholders -> 4 MINOR findings
- **Category:** Plan Critic Check (a)
- **Mapped UC:** UC-6-A1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1 (MINOR x 4)
- **Preconditions:** All four subsections empty
- **Inputs:** Block with four blank subsections
- **Steps:**
  1. Run critic
  2. Count MINOR findings
- **Expected Result:** FINDINGS contains exactly 4 MINOR entries (one per subsection).
- **Pass Criteria:** Per-subsection enforcement works.

### TC-6.3: Subsection contains only whitespace or HTML comment -> MINOR
- **Category:** Plan Critic Check (a) -- Whitespace
- **Mapped UC:** UC-6-E1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1 (MINOR)
- **Preconditions:** Subsection body is `<!-- TODO -->` or all spaces
- **Inputs:** Whitespace-only or comment-only body
- **Steps:**
  1. Run critic; conservative reading treats whitespace + HTML comment as empty
- **Expected Result:** MINOR raised.
- **Pass Criteria:** Heuristic correctly recognizes "thoughtfully empty" requires literal `(none)`.

### TC-6.4: `(none)` followed by clarifying parenthetical -> no finding
- **Category:** Plan Critic Check (a) -- Acceptable Variant
- **Mapped UC:** UC-6-EC1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Subsection body: `(none) -- meta-SDLC feature, no third-party integrations`
- **Inputs:** Placeholder + clarifier
- **Steps:**
  1. Run critic
  2. Verify clarifier after `(none)` is allowed
- **Expected Result:** No finding raised.
- **Pass Criteria:** Variant allowed per FR-1.3 spirit.

---

## 7. Assumption Labelling and Memory-Source Rejection

### TC-7.1: Agent labels unverifiable claim under `### Assumptions` with risk + verification path
- **Category:** Assumption Surfacing
- **Mapped UC:** UC-7
- **Mapped AC:** AC-3, AC-5
- **Type:** Integration (manual transcript inspection)
- **Severity:** P0
- **Preconditions:** Agent encounters a load-bearing claim it cannot verify in-session
- **Inputs:** Agent runs 4-question protocol, identifies unverifiable claim
- **Steps:**
  1. Inspect agent's `### Assumptions` body
  2. Verify each entry contains: claim, risk (what breaks if wrong), how-to-verify (next step)
- **Expected Result:** Each assumption entry has the three-part structure per FR-1.3.
- **Pass Criteria:** Audit trail intact; downstream reviewer can challenge.

### TC-7.2: Agent verifies in-session and promotes from `### Assumptions` to `### Verified facts`
- **Category:** Assumption -> Fact Promotion
- **Mapped UC:** UC-7-A1
- **Mapped AC:** AC-3
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Agent has Bash/Read/WebFetch access; runs verification step
- **Inputs:** Pre-verification: claim under `### Assumptions`. Post-verification: claim should move to `### Verified facts`.
- **Steps:**
  1. Agent runs verification (e.g., `claude mcp list`)
  2. Confirm claim moves to `### Verified facts` with citation
- **Expected Result:** Claim with citation `verified by Bash invocation of \`claude mcp list\` returning plain text in current session` appears under `### Verified facts`.
- **Pass Criteria:** Promotion path satisfies Q1/Q2 per FR-1.2.

### TC-7.3: Agent emits user-decision question under `### Open questions`
- **Category:** Open Question
- **Mapped UC:** UC-7-A2
- **Mapped AC:** AC-2
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Agent identifies a design decision needing user input
- **Inputs:** Agent emits question with "Needs: developer decision" annotation
- **Steps:**
  1. Inspect `### Open questions` body
  2. Verify entry indicates user-input requirement
- **Expected Result:** Question correctly classified under `### Open questions`, not `### Assumptions`.
- **Pass Criteria:** Classification distinguishes assumption from decision per FR-1.3.

### TC-7.4: Agent silently treats unverified claim as fact (soft-power gap)
- **Category:** Soft-Power Gap
- **Mapped UC:** UC-7-E1
- **Mapped AC:** (Risk 9 documentation)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Agent shortcuts protocol; emits unsourced claim under `### Verified facts`
- **Inputs:** `### Verified facts` entry with no source citation
- **Steps:**
  1. Run Plan Critic Check (a)
  2. Verify Plan Critic does NOT mechanically check `### Verified facts` source presence (FR-4.3 covers external-contract identifiers, not internal verified-fact sourcing)
  3. Verify code-reviewer at /merge-ready can surface the gap
- **Expected Result:** Plan Critic does NOT raise a finding; Risk 9 is a soft-power problem; code-reviewer is the backstop.
- **Pass Criteria:** Documented enforcement boundary holds.

### TC-7.5: "I remember from a similar API" cited as source
- **Category:** Memory-Source Rejection
- **Mapped UC:** UC-7-EC1
- **Mapped AC:** AC-5
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Agent emits `### Verified facts` with the literal phrase as citation
- **Inputs:** `- claim X -- source: I remember from a similar API`
- **Steps:**
  1. Run Plan Critic; iter-1 may not mechanically detect the phrase (deferred to iter-2)
  2. Run code-reviewer at /merge-ready manually
  3. Confirm rule file `src/rules/cognitive-self-check.md` contains literal phrase verbatim per FR-1.4 / AC-5
- **Expected Result:** The literal phrase is documented as NOT a valid source in the rule file; iter-1 enforcement is normative (agent self-check); iter-2 may add `grep -F "I remember from a similar API"` mechanical check.
- **Pass Criteria:** Rule's normative force is unambiguous.

---

## 8. Backward Compatibility (Pre-Existing Artifacts)

### TC-8.1: Plan Critic does NOT flag Sections 1-8 of `docs/PRD.md` (pre-merge dates)
- **Category:** Backward Compatibility
- **Mapped UC:** UC-8
- **Mapped AC:** AC-18
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Sections 1-8 have `Date:` predating merge; cognitive-self-check feature has merged
- **Inputs:** `docs/PRD.md` with Sections 1-8 (no `## Facts` blocks) and Section 9 (with `## Facts` per AC-19)
- **Steps:**
  1. Run Plan Critic against `docs/PRD.md`
  2. Confirm no missing-Facts findings on Sections 1-8
  3. Confirm Section 9's `## Facts` block PASSES Check (a)
- **Expected Result:** Date guard correctly exempts pre-existing sections; only Section 9 is in scope.
- **Pass Criteria:** AC-18 acceptance test passes.

### TC-8.2: Pre-existing PRD section re-edited post-merge for typo fix -> NOT flagged
- **Category:** Backward Compatibility (Typo Edit)
- **Mapped UC:** UC-8-A1
- **Mapped AC:** AC-18
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Pre-existing Section 5 (Date predates merge); user fixes a typo
- **Inputs:** File mtime is now post-merge but `Date:` field unchanged
- **Steps:**
  1. Save typo fix
  2. Run Plan Critic
- **Expected Result:** Per FR-7.4, typo fixes do NOT trigger enforcement; date guard uses `Date:` field for PRD sections (NOT mtime).
- **Pass Criteria:** Section's pre-merge `Date:` keeps it exempt.

### TC-8.3: Pre-existing plan file extended post-merge with new slice -> `## Facts` required
- **Category:** Backward Compatibility (Plan Extension)
- **Mapped UC:** UC-8-A2
- **Mapped AC:** AC-18
- **Type:** Integration
- **Severity:** P0 (MAJOR if missing)
- **Preconditions:** Pre-merge `.claude/plan.md` (no `## Facts`); user appends a slice post-merge
- **Inputs:** File mtime is post-merge; content meaningfully changed
- **Steps:**
  1. Append new slice
  2. Run Plan Critic
- **Expected Result:** Per FR-7.3, plan files re-edited post-merge MUST add `## Facts`; missing -> MAJOR.
- **Pass Criteria:** Plan-file mtime guard works (distinct from PRD-section Date guard).

### TC-8.4: PRD section's `Date: TBD` -> fail closed (MAJOR)
- **Category:** Backward Compatibility -- Fail Closed
- **Mapped UC:** UC-8-E1
- **Mapped AC:** AC-18
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic PRD section has `Date: TBD`
- **Inputs:** Malformed `Date:` field
- **Steps:**
  1. Run Plan Critic
  2. Confirm critic treats section as POST-MERGE per Risk 7
  3. Confirm MAJOR raised if `## Facts` missing
- **Expected Result:** Fail-closed default protects against silent skip.
- **Pass Criteria:** Risk 7 mitigation enforced.

### TC-8.5: Inlined historical content in current-cycle plan -> no separate enforcement
- **Category:** Backward Compatibility -- Inlining
- **Mapped UC:** UC-8-EC1
- **Mapped AC:** (FR-7.2, FR-7.3)
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Current-cycle plan inlines content from a stale `.claude/resources-pending.md`
- **Inputs:** Mixed-age content within one current-cycle file
- **Steps:**
  1. Run Plan Critic on the plan
  2. Verify enforcement applies to plan as a whole (not per-inlined-block)
- **Expected Result:** The plan's own `## Facts` block satisfies the rule; no separate check on inlined historical content.
- **Pass Criteria:** Inlining does not trigger spurious findings.

---

## 9. Resource-Architect File-Writing Path

### TC-9.1: Resource-architect emits `## Facts` AFTER `## Auto-Install Results` in `.claude/resources-pending.md`
- **Category:** File-Writing Specialized Agent
- **Mapped UC:** UC-9
- **Mapped AC:** AC-6, AC-7, AC-9
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/resource-architect.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.12
- **Inputs:** Bootstrap Step 3.5 produces `.claude/resources-pending.md`
- **Steps:**
  1. `grep -n "^## Auto-Install Results$" .claude/resources-pending.md`
  2. `grep -n "^## Facts$" .claude/resources-pending.md`
  3. Verify Facts line > Auto-Install Results line
  4. Verify `### External contracts` cites every recommended resource (URL of MCP registry, npm package page, etc.)
- **Expected Result:** `## Facts` block at expected location; external contracts cited per FR-2.12.
- **Pass Criteria:** FR-2.12 satisfied.

### TC-9.2: Auto-Install Results section absent -> `## Facts` after `## Recommended Resources`
- **Category:** Fallback Placement
- **Mapped UC:** UC-9-A1
- **Mapped AC:** AC-7
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Iter-1 in effect OR no installable items (no Auto-Install Results)
- **Inputs:** `.claude/resources-pending.md` without Auto-Install Results
- **Steps:**
  1. Verify `## Facts` appears immediately after `## Recommended Resources`
- **Expected Result:** Fallback placement per FR-2.12 second clause.
- **Pass Criteria:** Both placement variants supported.

### TC-9.3: No external resources recommended -> `### External contracts: (none)`
- **Category:** No-Resource Variant
- **Mapped UC:** UC-9-A2
- **Mapped AC:** AC-2
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** PRD's domain is fully covered by built-in tooling
- **Inputs:** `## Recommended Resources` body: "No external resources required"
- **Steps:**
  1. Verify `### External contracts: (none)` in resource-architect's `## Facts`
- **Expected Result:** Literal `(none)` placeholder satisfies FR-1.3.
- **Pass Criteria:** No spurious finding.

### TC-9.4: Bootstrap halts at Step 3.5 -- partial `## Facts` blocks remain valid
- **Category:** Bootstrap Halt
- **Mapped UC:** UC-9-E1
- **Mapped AC:** (FR-7.3 backward compat)
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Resource-architect fails at Step 3.5 (e.g., Bash whitelist violation)
- **Inputs:** Partial `.claude/resources-pending.md`
- **Steps:**
  1. Halt bootstrap
  2. Verify upstream prd-writer's `## Facts` is preserved
  3. Re-run bootstrap; resource-architect re-runs cleanly
- **Expected Result:** No retroactive cleanup of pre-halt facts blocks.
- **Pass Criteria:** Halt-and-resume preserves audit trail.

### TC-9.5: Cited MCP registry URL goes stale (404) post-cycle
- **Category:** External-Contract Citation Lifecycle
- **Mapped UC:** UC-9-EC1
- **Mapped AC:** AC-7
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Resource-architect cited URL X; URL X is now 404
- **Inputs:** Stale citation
- **Steps:**
  1. Verify `## Facts` records verification time
  2. Verify rule does NOT require ongoing URL monitoring
- **Expected Result:** Audit trail captures verification was done at-time; next agent run re-verifies per Q2.
- **Pass Criteria:** No retroactive invalidation.

---

## 10. Refactor-Cleaner Stdout-Only Path with Code Edits

### TC-10.1: Refactor-cleaner emits `## Facts` to stdout BEFORE verdict
- **Category:** Stdout-Only Agent + Code Edits
- **Mapped UC:** UC-10
- **Mapped AC:** AC-6, AC-7
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/refactor-cleaner.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.11; ad-hoc refactor-cleaner invocation runs (refactor-cleaner has no `/merge-ready` gate — it runs post-implementation outside the gate sequence)
- **Inputs:** Ad-hoc refactor-cleaner invocation
- **Steps:**
  1. Capture stdout
  2. Verify `## Facts` block appears at the start of stdout, before the verdict
  3. Verify `### Verified facts` cites each refactored file:line
  4. Verify any unverified claim under `### Assumptions` with risk + verification path
- **Expected Result:** Stdout block present at start; audit trail records each refactor's evidence base before the verdict line.
- **Pass Criteria:** FR-2.11 satisfied.

### TC-10.2: Refactor-cleaner finds no targets -> still emits `## Facts`
- **Category:** No-Op Variant
- **Mapped UC:** UC-10-A1
- **Mapped AC:** AC-2
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Codebase clean
- **Inputs:** Gate 6
- **Steps:**
  1. Verify "No refactor targets identified" + verdict + `## Facts` block
- **Expected Result:** Block present even with `### Verified facts` listing files inspected and `### Assumptions: (none)`.
- **Pass Criteria:** Block always emitted regardless of verdict.

### TC-10.3: Refactor-cleaner forgets `## Facts` (parallel to UC-1-E1)
- **Category:** Stdout-Only Gap
- **Mapped UC:** UC-10-E1
- **Mapped AC:** (Risk 1)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic stdout without facts block
- **Inputs:** Mock stdout
- **Steps:**
  1. Run Plan Critic; verify no finding (stdout-only)
  2. Confirm caught only by code-reviewer or transcript review
- **Expected Result:** Documented enforcement gap per Risk 1.
- **Pass Criteria:** Boundary held.

### TC-10.4: Refactor based on assumption disproven by typecheck
- **Category:** Assumption Failure Mode
- **Mapped UC:** UC-10-EC1
- **Mapped AC:** (Risk 1)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Refactor-cleaner flagged "no other call sites depend on old signature" under `### Assumptions`
- **Inputs:** build-runner runs typecheck after refactor
- **Steps:**
  1. Verify typecheck FAILS due to dependent call sites
  2. Verify orchestrator surfaces failure traceable to the assumption
- **Expected Result:** Audit trail makes failure traceable to specific assumption per Risk 1.
- **Pass Criteria:** Disproven-assumption recovery path works.

---

## 11. Format Drift (Casing, Heading Level)

### TC-11.1: `## facts` (lowercase) -> MAJOR
- **Category:** Format Drift
- **Mapped UC:** UC-11
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Synthetic artifact has `## facts` (lowercase)
- **Inputs:** Lowercase heading
- **Steps:**
  1. Run Plan Critic with `grep -F "## Facts"` (literal exact-case)
  2. Verify lowercase does NOT match
- **Expected Result:** MAJOR raised: missing `## Facts` per FR-4.2 (Risk 4 mitigation: literal grep).
- **Pass Criteria:** Strict case-sensitive matching.

### TC-11.2: `## Facts (verified)` -> MAJOR (anchored match assumption)
- **Category:** Format Drift -- Suffix
- **Mapped UC:** UC-11-A1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1 (MAJOR per assumption)
- **Preconditions:** Synthetic artifact has heading `## Facts (verified)`
- **Inputs:** Heading with descriptive suffix
- **Steps:**
  1. Run Plan Critic with anchored grep `^## Facts$`
- **Expected Result:** Anchored match FAILS; MAJOR raised. NOTE: Severity depends on anchored vs unanchored implementation choice (see Assumptions).
- **Pass Criteria:** Strict heading match per AC-2 wording.

### TC-11.3: `# Facts` (single hash) -> MAJOR
- **Category:** Format Drift -- Heading Level
- **Mapped UC:** UC-11-E1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Synthetic artifact has `# Facts`
- **Inputs:** H1 instead of H2
- **Steps:**
  1. Run Plan Critic
  2. Verify literal `## Facts` not matched
- **Expected Result:** MAJOR raised; missing block.
- **Pass Criteria:** Strict heading-level matching.

### TC-11.4: Subsection `### verified facts` (lowercase) -> MAJOR or MINOR (impl decision)
- **Category:** Format Drift -- Subsection Casing
- **Mapped UC:** UC-11-E2
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic artifact has `## Facts` present BUT `### verified facts` (lowercase v)
- **Inputs:** Lowercase subsection name
- **Steps:**
  1. Run Plan Critic
  2. Per AC-2, four subsection names are literal
- **Expected Result:** Severity is implementation-time decision (see Assumptions): conservative reading is MINOR (block exists but format wrong) consistent with FR-4.2; strict reading is MAJOR (subsection not literally matched -> count as missing).
- **Pass Criteria:** Whichever severity, finding IS raised; no silent pass.

### TC-11.5: `## Facts` heading inside fenced code block -> false positive accepted
- **Category:** Format Drift -- Code-Fenced Heading
- **Mapped UC:** UC-11-EC1
- **Mapped AC:** NFR-6
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Artifact has only an example `## Facts` inside triple-backticks
- **Inputs:** Code-fenced heading
- **Steps:**
  1. Run Plan Critic literal grep
  2. Per NFR-6, low-recall heuristic accepts false positive (treats example as real)
- **Expected Result:** Critic believes block is present (false positive); deferred to iter-2 to refine.
- **Pass Criteria:** Documented limitation per NFR-6.

---

## 12. Verifier Stdout-Only Path During `/implement-slice`

### TC-12.1: Verifier emits `## Facts` BEFORE structured PASS/FAIL output
- **Category:** Stdout-Only Agent (Verifier)
- **Mapped UC:** UC-12
- **Mapped AC:** AC-6, AC-7
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/verifier.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.10
- **Inputs:** Mid-slice verifier invocation
- **Steps:**
  1. Capture stdout transcript
  2. Verify `## Facts` block appears at the start of stdout
  3. Verify structured PASS/FAIL output follows the `## Facts` block
- **Expected Result:** Both blocks present in correct order: `## Facts` first, PASS/FAIL second.
- **Pass Criteria:** FR-2.10 satisfied.

### TC-12.2: Verifier reports FAIL Level 1 (wiring) -> `## Facts` records gap
- **Category:** Verifier FAIL Path
- **Mapped UC:** UC-12-A1
- **Mapped AC:** AC-7
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Implementation has wiring gap
- **Inputs:** Slice with intentionally missing wire
- **Steps:**
  1. Run verifier
  2. Verify `### Verified facts` lists wiring claims read; `### Assumptions` notes any unverified
- **Expected Result:** FAIL surfaced with audit trail.
- **Pass Criteria:** Failure path includes facts block.

### TC-12.3: Verifier omits `## Facts` (stdout gap)
- **Category:** Stdout-Only Gap
- **Mapped UC:** UC-12-E1
- **Mapped AC:** (Risk 1)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic verifier transcript without facts
- **Inputs:** Mock stdout
- **Steps:**
  1. Run Plan Critic; expect no finding
  2. Code-reviewer at /merge-ready may surface
- **Expected Result:** Documented gap.
- **Pass Criteria:** File-vs-stdout boundary held.

### TC-12.4: Verifier transitively cites planner's `## Facts`
- **Category:** Cross-Agent Citation
- **Mapped UC:** UC-12-EC1
- **Mapped AC:** AC-5
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Verifier's `### Verified facts` includes "verified by Read of .claude/plan.md slice 3 in current session AND by Bash typecheck"
- **Inputs:** Cross-agent citation
- **Steps:**
  1. Confirm citation chains through planner's authority
  2. Confirm verifier's own session verification (Bash typecheck)
- **Expected Result:** Audit trail intact.
- **Pass Criteria:** Transitive citation valid.

---

## 13. Code-Reviewer Stdout-Only Path

### TC-13.1: Code-reviewer emits `## Facts` BEFORE verdict
- **Category:** Stdout-Only Agent (Code-Reviewer)
- **Mapped UC:** UC-13
- **Mapped AC:** AC-6, AC-7
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/code-reviewer.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.9
- **Inputs:** `/merge-ready` Gate 2 (Code Review) invocation
- **Steps:**
  1. Capture stdout
  2. Verify `## Facts` block appears at the start of stdout, before the review prose and verdict
- **Expected Result:** Block present at start of stdout, before review prose and verdict.
- **Pass Criteria:** FR-2.9 satisfied.

### TC-13.2: Reviewer detects unverified claim in planner's `## Facts`
- **Category:** Reviewer as Backstop
- **Mapped UC:** UC-13-A1
- **Mapped AC:** (Risk 9 backstop)
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Planner emitted unsourced fact
- **Inputs:** Plan with unsourced `### Verified facts` entry
- **Steps:**
  1. Reviewer reads plan
  2. Reviewer challenges entry as code-review finding
- **Expected Result:** Reviewer surfaces gap.
- **Pass Criteria:** Soft-power backstop active.

### TC-13.3: Reviewer omits `## Facts` itself (stdout gap)
- **Category:** Stdout-Only Gap
- **Mapped UC:** UC-13-E1
- **Mapped AC:** (Risk 1)
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Mock stdout
- **Inputs:** Reviewer transcript without facts
- **Steps:** As TC-12.3
- **Expected Result:** Plan Critic does not catch; transcript review surfaces.
- **Pass Criteria:** Boundary held.

### TC-13.4: Reviewer correctly recognizes executor exemption (no false demand)
- **Category:** Executor Exemption Recognition
- **Mapped UC:** UC-13-EC1
- **Mapped AC:** AC-4, AC-8
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Reviewer reads test-writer / build-runner / e2e-runner output (no `## Facts`)
- **Inputs:** Executor output without facts
- **Steps:**
  1. Reviewer consults rule file's `## Application Scope` (FR-1.5)
  2. Reviewer recognizes the 5-agent exemption
  3. Reviewer does NOT raise a finding
- **Expected Result:** Rule file's exempt list is unambiguous; no false-positive demand.
- **Pass Criteria:** AC-4 + AC-8 work in tandem.

---

## 14. Security-Auditor Stdout-Only Path

### TC-14.1: Security-auditor cites external auth/crypto libraries with version
- **Category:** Stdout-Only Agent (Security-Auditor)
- **Mapped UC:** UC-14
- **Mapped AC:** AC-6, AC-7
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/security-auditor.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.8; impl uses `bcrypt` v5.1.1
- **Inputs:** `/merge-ready` Gate 3 (Security Audit) invocation
- **Steps:**
  1. Capture stdout
  2. Verify `### External contracts` cites: `\`bcrypt\` v5.1.1 -- verified via Read of \`package.json\` and \`node_modules/bcrypt/package.json\` in current session`
- **Expected Result:** Auth/crypto contract is cited with version + source.
- **Pass Criteria:** FR-1.4 + FR-2.8 satisfied.

### TC-14.2: No external auth/crypto in scope -> `### External contracts: (none)`
- **Category:** No-Auth Variant
- **Mapped UC:** UC-14-A1
- **Mapped AC:** AC-2
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Feature has no auth surface
- **Inputs:** `/merge-ready` Gate 3 (Security Audit)
- **Steps:**
  1. Verify body: `(none) -- feature has no external auth or crypto surface`
- **Expected Result:** Placeholder satisfies FR-1.3.
- **Pass Criteria:** No spurious finding.

### TC-14.3: Auditor cites CVE from memory without WebFetch -> rejected per FR-1.4
- **Category:** Memory-Source Rejection
- **Mapped UC:** UC-14-E1
- **Mapped AC:** AC-5, Risk 9
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Auditor "remembers" CVE without in-session verification
- **Inputs:** Stdout cites CVE with no source
- **Steps:**
  1. Per FR-1.4, memory is not a valid source
  2. Auditor MUST WebFetch the CVE database OR mark as `### Assumptions`
  3. If silently treated as fact, code-reviewer at next gate surfaces gap
- **Expected Result:** Soft-power backstop catches; iter-2 may add mechanical phrase grep.
- **Pass Criteria:** Audit trail integrity preserved.

### TC-14.4: CVE patched in version newer than project's
- **Category:** Version-Pinned Citation
- **Mapped UC:** UC-14-EC1
- **Mapped AC:** AC-7
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Project pins old version; CVE applies
- **Inputs:** Audit must capture both CVE + version
- **Steps:**
  1. Verify `### Verified facts` cites both CVE id and project version
- **Expected Result:** Audit conclusion sound only when version comparison documented.
- **Pass Criteria:** Citation includes version range.

---

## 15. Release-Engineer File-Writing Path

### TC-15.1: Release-engineer appends `## Facts` to release-notes file
- **Category:** File-Writing Specialized Agent
- **Mapped UC:** UC-15
- **Mapped AC:** AC-6, AC-7, AC-9
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** `src/agents/release-engineer.md` has `## Cognitive Self-Check (MANDATORY)` per FR-2.14
- **Inputs:** Gate 9 invocation
- **Steps:**
  1. `grep -n "^## Facts$" docs/releases/<version>.md` (or canonical path)
  2. Verify block at end of file
  3. Verify `### Verified facts` cites CHANGELOG entries + git log range
- **Expected Result:** Release-notes file has `## Facts` block; not duplicated to stdout.
- **Pass Criteria:** FR-2.14 satisfied.

### TC-15.2: Release notes for cognitive-self-check feature itself (v3.1.0 -> v3.2.0)
- **Category:** Self-Reference (Dogfood)
- **Mapped UC:** UC-15-A1
- **Mapped AC:** NFR-7
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Feature merges; release-engineer authors notes
- **Inputs:** v3.2.0 release notes
- **Steps:**
  1. Verify `### Verified facts` cites version derivation
  2. Verify `### External contracts: (none)` (purely internal)
- **Expected Result:** Self-reference dogfooded.
- **Pass Criteria:** v3.2.0 minor bump per NFR-7 documented in facts.

### TC-15.3: Release-engineer emits `## Facts` to stdout instead of file -> Plan Critic raises MAJOR
- **Category:** Wrong Emission Surface
- **Mapped UC:** UC-15-E1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P0 (MAJOR)
- **Preconditions:** Synthetic release-notes file lacks `## Facts`; agent emitted to stdout instead
- **Inputs:** Wrong-surface emission
- **Steps:**
  1. Run Plan Critic on release-notes file
  2. Verify MAJOR raised
- **Expected Result:** File-based enforcement works.
- **Pass Criteria:** FR-2.14 + FR-4.1 + FR-4.2 satisfied.

### TC-15.4: Multiple releases pending -> one `## Facts` per release-notes file
- **Category:** Multi-Release Variant
- **Mapped UC:** UC-15-EC1
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Multiple `docs/releases/<version>.md` files
- **Inputs:** Two or more pending releases
- **Steps:**
  1. Run Plan Critic on each
  2. Verify per-file enforcement
- **Expected Result:** Each release file has its own block.
- **Pass Criteria:** Per-file scope holds.

---

## 16. Executor Agent Exemption (5 Agents)

### TC-16.1: Executor agent does NOT emit `## Facts` (no requirement)
- **Category:** Executor Exemption
- **Mapped UC:** UC-16
- **Mapped AC:** AC-8
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Test-writer is invoked at /implement-slice
- **Inputs:** Test-writer output (test code)
- **Steps:**
  1. Capture output
  2. Verify NO `## Facts` block
  3. Run Plan Critic on output (if any) -- expect no finding
- **Expected Result:** No requirement; no finding.
- **Pass Criteria:** Per FR-3.1 / FR-3.2.

### TC-16.2: Changelog-writer mechanical mapping inherits fact discipline transitively
- **Category:** Changelog-Writer Exemption
- **Mapped UC:** UC-16-A1
- **Mapped AC:** AC-8
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Upstream prd-writer entries carry `## Facts` per FR-2.3
- **Inputs:** Changelog entries derived from PRD `Changelog:` fields
- **Steps:**
  1. Verify changelog entries have NO `## Facts` block
  2. Verify upstream PRD sections do
- **Expected Result:** Mechanical inheritance per FR-3.3.
- **Pass Criteria:** Transitive discipline preserves audit trail.

### TC-16.3: Executor prompt accidentally modified (regression test)
- **Category:** Executor Byte-Unchanged Invariant
- **Mapped UC:** UC-16-E1
- **Mapped AC:** AC-8
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Pre-merge baseline commit available
- **Inputs:** None (CI-style check)
- **Steps:**
  1. `git diff <pre-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md`
  2. Expect zero diff hunks
- **Expected Result:** Zero hunks; AC-8 holds.
- **Pass Criteria:** Byte-unchanged invariant.

### TC-16.4: Reviewer mistakenly demands `## Facts` from executor
- **Category:** Reviewer Mistake Recovery
- **Mapped UC:** UC-16-EC1
- **Mapped AC:** AC-4, AC-8
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Reviewer flags executor for missing facts
- **Inputs:** Mistaken finding
- **Steps:**
  1. Reviewer consults rule's `## Application Scope`
  2. Recognizes executor exemption per FR-1.5
  3. Retracts finding
- **Expected Result:** Rule file is the disambiguation surface.
- **Pass Criteria:** AC-4 supports correction.

---

## CC: Cross-Cutting Acceptance Tests

### TC-CC-1: Backward compat smoke test (AC-18)
- **Category:** Cross-Cutting (Backward Compat)
- **Mapped UC:** UC-CC-1
- **Mapped AC:** AC-18, AC-19
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Feature merged; PRD has Sections 1-9
- **Inputs:** `docs/PRD.md`
- **Steps:**
  1. Run Plan Critic against `docs/PRD.md`
  2. Confirm zero missing-Facts findings on Sections 1-8
  3. Confirm Section 9 has `## Facts` block per AC-19
- **Expected Result:** Date guard exempts pre-merge sections.
- **Pass Criteria:** AC-18 + AC-19 pass.

### TC-CC-2: 17-agent and 10-gate count invariant (AC-12, AC-13)
- **Category:** Cross-Cutting (Invariant)
- **Mapped UC:** UC-CC-2
- **Mapped AC:** AC-12, AC-13
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** None
- **Steps:**
  1. `grep -n "17 specialized\|17 agents\|17 AI agents" install.sh README.md src/claude.md` -- expect identical to pre-merge
  2. `grep -n "10 gates\|10 quality gates" install.sh README.md src/claude.md src/commands/merge-ready.md` -- expect identical to pre-merge
- **Expected Result:** No drift.
- **Pass Criteria:** AC-12 + AC-13 pass.

### TC-CC-3: install.sh / templates/ byte-unchanged (AC-14, AC-15, AC-16)
- **Category:** Cross-Cutting (Invariant)
- **Mapped UC:** UC-CC-3
- **Mapped AC:** AC-14, AC-15, AC-16
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** None
- **Steps:**
  1. `git diff <pre-merge-commit>..HEAD -- install.sh templates/rules/ templates/CLAUDE.md`
  2. Expect zero diff hunks
- **Expected Result:** Zero hunks across all three paths.
- **Pass Criteria:** All three ACs pass.

### TC-CC-4: Executor files byte-unchanged (AC-8)
- **Category:** Cross-Cutting (Invariant)
- **Mapped UC:** UC-CC-4
- **Mapped AC:** AC-8
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** None
- **Steps:**
  1. `git diff <pre-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md`
  2. Expect zero diff hunks
- **Expected Result:** Zero hunks.
- **Pass Criteria:** AC-8 passes.

### TC-CC-5: 12 in-scope agents have `## Cognitive Self-Check (MANDATORY)` (AC-6)
- **Category:** Cross-Cutting (Agent Prompts)
- **Mapped UC:** UC-CC-5
- **Mapped AC:** AC-6
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/agents/*.md`
- **Steps:**
  1. `grep -l "## Cognitive Self-Check (MANDATORY)" src/agents/*.md`
  2. Expect EXACTLY 12 paths matching the FR-2.1 list
  3. Verify NO executor path appears in the result
- **Expected Result:** Exactly 12 paths: prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, code-reviewer, verifier, refactor-cleaner, resource-architect, role-planner, release-engineer.
- **Pass Criteria:** AC-6 passes.

### TC-CC-6: Rule file six `##` headings in order (AC-1)
- **Category:** Cross-Cutting (Rule File)
- **Mapped UC:** UC-CC-6
- **Mapped AC:** AC-1
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/rules/cognitive-self-check.md`
- **Steps:**
  1. `grep -n "^## " src/rules/cognitive-self-check.md`
  2. Expect EXACTLY 6 lines in order:
     - `## Protocol -- Before Each Decision`
     - `## Mandatory Facts Section`
     - `## External Contract Verification`
     - `## Application Scope`
     - `## Plan Critic Enforcement`
     - `## Backward Compatibility`
- **Expected Result:** Six headings, exact order.
- **Pass Criteria:** AC-1 passes.

### TC-CC-7: Rule file four `###` subsections (AC-2)
- **Category:** Cross-Cutting (Rule File)
- **Mapped UC:** UC-CC-7
- **Mapped AC:** AC-2
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** Rule file
- **Steps:**
  1. `grep -n "^### " src/rules/cognitive-self-check.md`
  2. Expect EXACTLY 4 literal subsection names: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`
- **Expected Result:** Four subsections.
- **Pass Criteria:** AC-2 passes.

### TC-CC-8: Bilingual 4-question protocol verbatim (AC-3)
- **Category:** Cross-Cutting (Rule File Content)
- **Mapped UC:** UC-CC-8
- **Mapped AC:** AC-3, AC-5
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** Rule file
- **Steps:**
  1. `grep -F "На чём основано / What is this claim based on?" src/rules/cognitive-self-check.md`
  2. `grep -F "Проверил ли я это в текущей сессии / Did I verify against current state this session?"`
  3. `grep -F "Что я предполагаю без доказательств / What am I assuming without proof?"`
  4. `grep -F "Если предположение -- помечено ли оно / If it's an assumption, is it labelled?"`
  5. `grep -F "I remember from a similar API / from training data"`
  6. Each MUST return >= 1 match
- **Expected Result:** All four questions verbatim Russian + English; literal not-a-source phrase present.
- **Pass Criteria:** AC-3 + AC-5 pass.

### TC-CC-9: Plan Critic two new Completeness checks present (AC-9, AC-10)
- **Category:** Cross-Cutting (Plan Critic)
- **Mapped UC:** UC-CC-9
- **Mapped AC:** AC-9, AC-10
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/claude.md`
- **Steps:**
  1. Locate `**Completeness:**` section
  2. Verify TWO new bullets exist:
     - Check (a) presence of `## Facts` block with severity `**MAJOR**` (missing) / `**MINOR**` (subsection without `(none)`)
     - Check (b) external-contract identifier citation with severity `**MAJOR**` (missing) / `**MINOR**` (vague)
  3. Verify Plan Critic preamble contains the literal phrase: "Cognitive self-check enforcement covers file-based artifacts only. Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt."
- **Expected Result:** Two new bullets + preamble statement.
- **Pass Criteria:** AC-9 + AC-10 pass.

### TC-CC-10: README Hardening table one new row at end (AC-11)
- **Category:** Cross-Cutting (README)
- **Mapped UC:** UC-CC-10
- **Mapped AC:** AC-11
- **Type:** Unit
- **Severity:** P1
- **Preconditions:** Feature merged
- **Inputs:** `README.md`
- **Steps:**
  1. Locate Hardening table
  2. Verify final row has: Mechanism = `Cognitive Self-Check Protocol`, Coverage = mentions "12 thinking agents (5 executor agents exempt)", Failure Mode = mentions "Hallucinated API/SDK/library details based on training-data memory of similar systems"
  3. Verify NO existing row reordered or removed (compare against pre-merge table)
- **Expected Result:** One row added at end; existing rows unchanged.
- **Pass Criteria:** AC-11 passes.

### TC-CC-11: PRD Section 9 dogfoods the rule (AC-19)
- **Category:** Cross-Cutting (Dogfood)
- **Mapped UC:** UC-CC-11
- **Mapped AC:** AC-19
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `docs/PRD.md` Section 9 (lines 2082-2333 per Verified facts above)
- **Steps:**
  1. `grep -n "^## Facts$" docs/PRD.md` -- confirm match within Section 9 line range
  2. Confirm block appears AFTER `### 9.7 Risks and Dependencies`
  3. Confirm four subsections in literal order
- **Expected Result:** Section 9 itself has `## Facts` block per FR-7.5.
- **Pass Criteria:** AC-19 passes.

### TC-CC-12: Cross-references resolve to actual files (AC-20)
- **Category:** Cross-Cutting (Cross-Reference)
- **Mapped UC:** UC-CC-12
- **Mapped AC:** AC-20
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** All in-scope agent prompts
- **Steps:**
  1. For each in-scope agent prompt: `grep -F "src/rules/cognitive-self-check.md" src/agents/<slug>.md` OR `grep -F ".claude/rules/cognitive-self-check.md"`; expect >= 1 match
  2. For each agent slug listed in rule file's `## Application Scope`: verify `src/agents/<slug>.md` exists
  3. No phantom paths
- **Expected Result:** All cross-references resolve.
- **Pass Criteria:** AC-20 passes.

---

## RF: Rule File Structural Tests

### TC-RF-1: Rule file exists at expected path
- **Category:** Rule File Structure
- **Mapped UC:** UC-CC-6
- **Mapped AC:** AC-1
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** None
- **Steps:** `test -f src/rules/cognitive-self-check.md`
- **Expected Result:** Exit 0.
- **Pass Criteria:** File exists.

### TC-RF-2: Rule file headings count and order (extends TC-CC-6)
- **Category:** Rule File Structure
- **Mapped UC:** UC-CC-6
- **Mapped AC:** AC-1
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-RF-1 passes
- **Inputs:** Rule file
- **Steps:**
  1. `grep -c "^## " src/rules/cognitive-self-check.md` -- expect exactly 6
  2. `grep -c "^### " src/rules/cognitive-self-check.md` -- expect at least 4 (the four facts-block subsection names; may be more if other examples)
- **Expected Result:** Counts match.
- **Pass Criteria:** AC-1 reinforced.

### TC-RF-3: Bilingual 4-question protocol verbatim (extends TC-CC-8)
- **Category:** Rule File Content
- **Mapped UC:** UC-CC-8
- **Mapped AC:** AC-3
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-RF-1 passes
- **Inputs:** Rule file
- **Steps:** Same as TC-CC-8 steps 1-5; require all >= 1
- **Expected Result:** All four questions present in BOTH languages verbatim.
- **Pass Criteria:** AC-3 passes.

### TC-RF-4: Application Scope lists 12 in-scope agents by slug
- **Category:** Rule File Content
- **Mapped UC:** UC-CC-12
- **Mapped AC:** AC-4
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-RF-1 passes
- **Inputs:** Rule file
- **Steps:**
  1. For each of the 12 slugs (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`): `grep -F "<slug>" src/rules/cognitive-self-check.md` -- expect >= 1
  2. Verify each is listed under `## Application Scope`
- **Expected Result:** All 12 slugs present.
- **Pass Criteria:** AC-4 partial pass.

### TC-RF-5: Application Scope lists 5 exempt agents with one-line rationale
- **Category:** Rule File Content
- **Mapped UC:** UC-CC-12
- **Mapped AC:** AC-4
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-RF-1 passes
- **Inputs:** Rule file
- **Steps:**
  1. For each of `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`: grep present
  2. Verify each has a one-line rationale (e.g., `test-writer -- output correctness verified by running tests; mechanical TDD execution`)
- **Expected Result:** All 5 with rationale.
- **Pass Criteria:** AC-4 full pass.

### TC-RF-6: Literal phrase "I remember from a similar API / from training data" verbatim
- **Category:** Rule File Content
- **Mapped UC:** UC-CC-8
- **Mapped AC:** AC-5
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-RF-1 passes
- **Inputs:** Rule file
- **Steps:** `grep -F "I remember from a similar API / from training data" src/rules/cognitive-self-check.md` -- expect >= 1
- **Expected Result:** Literal phrase present.
- **Pass Criteria:** AC-5 passes.

### TC-RF-7: Every slug in Application Scope corresponds to actual agent file
- **Category:** Rule File Cross-Reference
- **Mapped UC:** UC-CC-12
- **Mapped AC:** AC-20
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-RF-1 passes
- **Inputs:** Rule file + `src/agents/`
- **Steps:**
  1. Extract all slugs in `## Application Scope`
  2. For each: `test -f src/agents/<slug>.md`
- **Expected Result:** All slugs resolve.
- **Pass Criteria:** AC-20 partial pass.

---

## AP: Agent Prompt Structural Tests

### TC-AP-1: 12 in-scope agents have `## Cognitive Self-Check (MANDATORY)` (extends TC-CC-5)
- **Category:** Agent Prompt
- **Mapped UC:** UC-CC-5
- **Mapped AC:** AC-6
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/agents/*.md`
- **Steps:**
  1. `grep -l "## Cognitive Self-Check (MANDATORY)" src/agents/*.md | wc -l` -- expect 12
  2. Verify result set EQUALS the 12 in-scope slugs
- **Expected Result:** Exactly 12 agents.
- **Pass Criteria:** AC-6 passes.

### TC-AP-2: Each in-scope agent's section references rule file path
- **Category:** Agent Prompt Cross-Reference
- **Mapped UC:** UC-CC-12
- **Mapped AC:** AC-7
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-AP-1 passes
- **Inputs:** 12 agent prompt files
- **Steps:**
  1. For each: locate `## Cognitive Self-Check (MANDATORY)` section
  2. Within that section: grep for `src/rules/cognitive-self-check.md` OR `.claude/rules/cognitive-self-check.md`
  3. Expect >= 1 match per agent
- **Expected Result:** All 12 reference rule.
- **Pass Criteria:** AC-7 passes (reference clause).

### TC-AP-3: Each agent's section specifies `## Facts` block location per FR-2.x
- **Category:** Agent Prompt Specification
- **Mapped UC:** UC-CC-12
- **Mapped AC:** AC-7
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-AP-1 passes
- **Inputs:** 12 agent prompts
- **Steps:**
  1. prd-writer: section says "end of new PRD section, after Risks and Dependencies" per FR-2.3
  2. ba-analyst: "end of `docs/use-cases/<feature>_use_cases.md`" per FR-2.4
  3. architect: "START of stdout review, BEFORE verdict" per FR-2.5
  4. qa-planner: "TOP of `docs/qa/<feature>_test_cases.md` (after title and PRD reference, before first numbered section)" per FR-2.6
  5. planner: "NEAR THE TOP of `.claude/plan.md` (after any inlined `## Recommended Resources` / `## Auto-Install Results` / `## Additional Roles` / `## Reuse Decisions`, before `## Prerequisites verified`)" per FR-2.7
  6. security-auditor: "START of stdout audit, BEFORE verdict" per FR-2.8
  7. code-reviewer: "START of stdout review, BEFORE verdict" per FR-2.9
  8. verifier: "START of stdout report, BEFORE PASS/FAIL" per FR-2.10
  9. refactor-cleaner: "START of stdout report, BEFORE verdict" per FR-2.11
  10. resource-architect: "in `.claude/resources-pending.md` after `## Auto-Install Results` (or after `## Recommended Resources`)" per FR-2.12
  11. role-planner: "in `.claude/roles-pending.md` after `## Reuse Decisions`" per FR-2.13
  12. release-engineer: "end of release-notes file" per FR-2.14
- **Expected Result:** Each agent's location string matches FR-2.x clause.
- **Pass Criteria:** AC-7 passes (location clause).

### TC-AP-4: 4 stdout-reviewer agents contain literal stdout instruction line
- **Category:** Agent Prompt Specification
- **Mapped UC:** UC-1, UC-12, UC-13, UC-14, UC-10
- **Mapped AC:** AC-7
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** TC-AP-1 passes
- **Inputs:** architect, security-auditor, code-reviewer, verifier, refactor-cleaner agent prompts
- **Steps:**
  1. For each of the 5 stdout-reviewer agents: grep for the literal instruction `Emit a \`## Facts\` block to stdout BEFORE your verdict.` (or near-equivalent confirming stdout placement)
  2. Expect >= 1 match per file
- **Expected Result:** Each stdout-only agent contains the stdout-instruction line.
- **Pass Criteria:** Stdout-only path is documented in each prompt per FR-2.5/2.8/2.9/2.10/2.11.

### TC-AP-5: 5 executor agents do NOT have `## Cognitive Self-Check (MANDATORY)` section
- **Category:** Executor Exemption
- **Mapped UC:** UC-16
- **Mapped AC:** AC-8
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** test-writer, build-runner, e2e-runner, doc-updater, changelog-writer prompts
- **Steps:**
  1. For each: `grep -c "## Cognitive Self-Check (MANDATORY)" src/agents/<slug>.md` -- expect 0
- **Expected Result:** Zero matches per file.
- **Pass Criteria:** AC-8 reinforced.

---

## INV: Invariant Tests

### TC-INV-1: 17-agent count unchanged in `src/claude.md` Agency Roles table
- **Category:** Invariant
- **Mapped UC:** UC-CC-2
- **Mapped AC:** AC-12
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/claude.md`
- **Steps:**
  1. Count rows in Agency Roles table
  2. Verify count = 17 (or whatever pre-merge baseline)
- **Expected Result:** No change.
- **Pass Criteria:** AC-12 passes.

### TC-INV-2: 10-gate count unchanged in `src/commands/merge-ready.md`
- **Category:** Invariant
- **Mapped UC:** UC-CC-2
- **Mapped AC:** AC-13
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/commands/merge-ready.md`
- **Steps:**
  1. `grep -c "Gate [0-9]" src/commands/merge-ready.md`
  2. `grep -nE "10 (gates|quality gates)" src/commands/merge-ready.md` -- expect identical to pre-merge
- **Expected Result:** No drift.
- **Pass Criteria:** AC-13 passes.

### TC-INV-3: `install.sh` byte-unchanged
- **Category:** Invariant
- **Mapped UC:** UC-CC-3
- **Mapped AC:** AC-14
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `install.sh`
- **Steps:**
  1. `git diff <pre-merge-commit>..HEAD -- install.sh`
  2. Optionally: sha256 before vs after
- **Expected Result:** Zero hunks; identical sha256.
- **Pass Criteria:** AC-14 passes.

### TC-INV-4: `templates/rules/` byte-unchanged
- **Category:** Invariant
- **Mapped UC:** UC-CC-3
- **Mapped AC:** AC-15
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `templates/rules/`
- **Steps:** `git diff <pre-merge-commit>..HEAD -- templates/rules/`
- **Expected Result:** Zero hunks.
- **Pass Criteria:** AC-15 passes.

### TC-INV-5: 5 executor files byte-unchanged (extends TC-CC-4)
- **Category:** Invariant
- **Mapped UC:** UC-CC-4
- **Mapped AC:** AC-8
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** 5 executor prompts
- **Steps:** As TC-CC-4 / TC-16.3
- **Expected Result:** Zero hunks across all 5.
- **Pass Criteria:** AC-8 passes.

### TC-INV-6: `templates/CLAUDE.md` byte-unchanged
- **Category:** Invariant
- **Mapped UC:** UC-CC-3
- **Mapped AC:** AC-16
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `templates/CLAUDE.md`
- **Steps:** `git diff <pre-merge-commit>..HEAD -- templates/CLAUDE.md`
- **Expected Result:** Zero hunks.
- **Pass Criteria:** AC-16 passes.

### TC-INV-7: Agency Roles table in `src/claude.md` byte-unchanged
- **Category:** Invariant
- **Mapped UC:** UC-CC-2
- **Mapped AC:** AC-17
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/claude.md`
- **Steps:**
  1. Extract Agency Roles table block
  2. Compare against pre-merge baseline
- **Expected Result:** Identical (no role title or responsibility column changes).
- **Pass Criteria:** AC-17 passes.

---

## EX: External-Contract Heuristic Edge Cases

### TC-EX-1: Internal lowercase-initial dotted method NOT flagged
- **Category:** Heuristic False-Positive Guard
- **Mapped UC:** UC-1-EC1, UC-5-EC1
- **Mapped AC:** AC-9 (negative)
- **Type:** Integration
- **Severity:** P0
- **Preconditions:** Synthetic plan body mentions `userService.findById()` in backticks
- **Inputs:** Internal symbol
- **Steps:**
  1. Run Plan Critic Check (b)
  2. Confirm lowercase initial fails `^[A-Z]` heuristic
- **Expected Result:** No finding.
- **Pass Criteria:** Reinforces TC-5.5.

### TC-EX-2: Branded external name (Stripe, GitHub, AWS) triggers heuristic
- **Category:** Heuristic Positive
- **Mapped UC:** UC-2-A1, UC-3-E1, UC-5
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic plan mentions `Stripe.Charge` in backticks
- **Inputs:** Branded identifier
- **Steps:**
  1. Run Check (b)
  2. Verify match on `<Capitalized>.<word>` pattern
- **Expected Result:** Heuristic detects; if uncited, MAJOR raised.
- **Pass Criteria:** Capitalized-class heuristic active.

### TC-EX-3: SCREAMING_SNAKE enum value flagged near "API"/"endpoint"/"webhook" prose
- **Category:** Heuristic -- Quoted Enum
- **Mapped UC:** UC-5
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P1
- **Preconditions:** Synthetic plan body has prose like "the webhook returns `\"PENDING\"`"
- **Inputs:** Quoted enum near integration prose
- **Steps:**
  1. Run Check (b)
  2. Verify quoted-enum heuristic matches per FR-4.3
- **Expected Result:** Heuristic flags; if uncited, MAJOR.
- **Pass Criteria:** Quoted-enum branch of heuristic works.

### TC-EX-4: camelCase field name in backticks near integration prose flagged
- **Category:** Heuristic -- camelCase Field
- **Mapped UC:** UC-5
- **Mapped AC:** AC-9
- **Type:** Integration
- **Severity:** P2
- **Preconditions:** Synthetic plan body has "the API response includes `chargeStatus`"
- **Inputs:** camelCase field near integration prose
- **Steps:**
  1. Run Check (b)
  2. Implementation-time decision per NFR-6: heuristic may or may not flag camelCase; conservative reading: flag when integration-context words ("API", "endpoint", "webhook", "response") nearby
- **Expected Result:** Conservative critic flags; if uncited, MAJOR.
- **Pass Criteria:** Per-NFR-6, conservative behavior preferred.

---

## DOG: Dogfood Tests

### TC-DOG-1: PRD Section 9 has `## Facts` block (AC-19, FR-7.5)
- **Category:** Dogfood
- **Mapped UC:** UC-CC-11, UC-3-A1
- **Mapped AC:** AC-19
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged; PRD Section 9 present
- **Inputs:** `docs/PRD.md`
- **Steps:**
  1. `grep -n "^## Facts$" docs/PRD.md` -- expect a match within Section 9 line range
  2. Confirm match is at line 2309 (per Verified facts above)
  3. Confirm four subsections in literal order
- **Expected Result:** Section 9 dogfoods.
- **Pass Criteria:** AC-19 passes.

### TC-DOG-2: Use-cases file `cognitive-self-check_use_cases.md` has `## Facts` block
- **Category:** Dogfood
- **Mapped UC:** (FR-2.4, FR-7.5 spirit)
- **Mapped AC:** AC-19 (spirit)
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `docs/use-cases/cognitive-self-check_use_cases.md`
- **Steps:**
  1. `grep -n "^## Facts$" docs/use-cases/cognitive-self-check_use_cases.md` -- expect 1 match (at line 1323 per Verified facts)
  2. Confirm four subsections
- **Expected Result:** Use-cases file dogfoods.
- **Pass Criteria:** ba-analyst's own discipline applied to its authoring of THIS feature's use-cases.

### TC-DOG-3: This test-cases file has `## Facts` block at top
- **Category:** Dogfood
- **Mapped UC:** (FR-2.6 spirit)
- **Mapped AC:** AC-19 (spirit)
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `docs/qa/cognitive-self-check_test_cases.md` (this file)
- **Steps:**
  1. `grep -n "^## Facts$" docs/qa/cognitive-self-check_test_cases.md` -- expect 1 match near top
  2. Confirm four subsections in literal order
- **Expected Result:** This file dogfoods.
- **Pass Criteria:** qa-planner's own discipline applied.

### TC-DOG-4: `.claude/plan.md` for cognitive-self-check feature has `## Facts` block
- **Category:** Dogfood
- **Mapped UC:** UC-2
- **Mapped AC:** AC-19 (spirit)
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Plan file written by planner during this feature's bootstrap
- **Inputs:** `.claude/plan.md`
- **Steps:**
  1. `grep -n "^## Facts$" .claude/plan.md` -- expect 1 match near the top (after `## Reuse Decisions`, before `## Prerequisites verified`)
  2. Confirm four subsections
- **Expected Result:** Plan dogfoods.
- **Pass Criteria:** planner discipline applied to THIS feature.

---

## AR: Architect Re-Review Consistency Test

### TC-AR-1: Architect re-review post-merge contains `## Facts` block
- **Category:** Self-Application
- **Mapped UC:** UC-1, UC-CC-11
- **Mapped AC:** AC-7, AC-19 (spirit)
- **Type:** Integration (manual transcript)
- **Severity:** P1
- **Preconditions:** Feature merged; re-running architect on this feature post-merge as part of audit
- **Inputs:** Architect agent invocation against cognitive-self-check feature artifacts
- **Steps:**
  1. Spawn architect with this feature's PRD (Section 9), use-cases, plan
  2. Capture stdout
  3. Verify `## Facts` block appears at the start of stdout, before the verdict
  4. Verify `### Verified facts` cites Section 9 line ranges
  5. Verify `### External contracts: (none)` (purely internal)
- **Expected Result:** Architect's own self-application of the rule.
- **Pass Criteria:** Rule applies to architect itself when re-running on this feature.

---

## PC: Plan Critic Preamble Tests

### TC-PC-1: Plan Critic preamble states file-vs-stdout enforcement split verbatim
- **Category:** Plan Critic Preamble
- **Mapped UC:** UC-CC-9
- **Mapped AC:** AC-10
- **Type:** Unit
- **Severity:** P0
- **Preconditions:** Feature merged
- **Inputs:** `src/claude.md` Plan Critic prompt
- **Steps:**
  1. `grep -F "Cognitive self-check enforcement covers file-based artifacts only." src/claude.md` -- expect >= 1
  2. `grep -F "Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt." src/claude.md` -- expect >= 1
- **Expected Result:** Both literal phrases present.
- **Pass Criteria:** AC-10 passes.

---

## Test Counts Summary

- **Section 1 (Architect):** 6 (TC-1.1 - TC-1.6)
- **Section 2 (Planner):** 5 (TC-2.1 - TC-2.5)
- **Section 3 (PRD-Writer):** 4 (TC-3.1 - TC-3.4)
- **Section 4 (Plan Critic Check (a)):** 5 (TC-4.1 - TC-4.5)
- **Section 5 (Plan Critic Check (b)):** 7 (TC-5.1 - TC-5.7)
- **Section 6 (Empty Subsection):** 4 (TC-6.1 - TC-6.4)
- **Section 7 (Assumption Labelling):** 5 (TC-7.1 - TC-7.5)
- **Section 8 (Backward Compat):** 5 (TC-8.1 - TC-8.5)
- **Section 9 (Resource-Architect):** 5 (TC-9.1 - TC-9.5)
- **Section 10 (Refactor-Cleaner):** 4 (TC-10.1 - TC-10.4)
- **Section 11 (Format Drift):** 5 (TC-11.1 - TC-11.5)
- **Section 12 (Verifier):** 4 (TC-12.1 - TC-12.4)
- **Section 13 (Code-Reviewer):** 4 (TC-13.1 - TC-13.4)
- **Section 14 (Security-Auditor):** 4 (TC-14.1 - TC-14.4)
- **Section 15 (Release-Engineer):** 4 (TC-15.1 - TC-15.4)
- **Section 16 (Executor Exemption):** 4 (TC-16.1 - TC-16.4)
- **CC (Cross-Cutting):** 12 (TC-CC-1 - TC-CC-12)
- **RF (Rule File):** 7 (TC-RF-1 - TC-RF-7)
- **AP (Agent Prompt):** 5 (TC-AP-1 - TC-AP-5)
- **INV (Invariants):** 7 (TC-INV-1 - TC-INV-7)
- **EX (External-Contract Heuristic):** 4 (TC-EX-1 - TC-EX-4)
- **DOG (Dogfood):** 4 (TC-DOG-1 - TC-DOG-4)
- **AR (Architect Re-Review):** 1 (TC-AR-1)
- **PC (Plan Critic Preamble):** 1 (TC-PC-1)

**Total:** 110 test cases.

**Coverage confirmation:** Every UC-N (UC-1 through UC-16) and every UC-CC-N (UC-CC-1 through UC-CC-12) has at least one mapped TC; every AC (AC-1 through AC-20) has at least one mapped TC.
