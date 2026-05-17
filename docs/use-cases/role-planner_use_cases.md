# Use Cases: Role Planner -- Iteration 1 (On-Demand Role Expansion)

> Based on [PRD](../PRD.md) -- Section 5: Role Planner -- Iteration 1: On-Demand Role Expansion

This document is the blueprint for E2E testing of the new `role-planner` agent and its pipeline integration at Step 3.75 of `/bootstrap-feature`. Every use case is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`) are referenced by QA test cases and E2E tests.

The novel pattern across every scenario is the **spawn-via-general-purpose invocation**: because Claude Code registers subagent types at session start, dynamically-generated `ondemand-<slug>.md` prompt files cannot be invoked as `subagent_type: ondemand-<slug>` in the same session. Instead, the orchestrator reads the on-demand prompt file, extracts the prompt body (skipping the YAML frontmatter), and spawns a subagent with `subagent_type: general-purpose`, passing the extracted body as the `prompt` parameter. This pattern is exercised in UC-8 and referenced by UC-1, UC-2, UC-3, UC-4, UC-6.

---

## UC-1: Feature Needs a Specialized Developer Role (Mobile iOS)

**Actor**: `role-planner` agent, invoked by the `/bootstrap-feature` orchestrator at Step 3.75
**Preconditions**:
- `docs/PRD.md` has been written by `prd-writer` at Step 2 and describes an iOS app feature (e.g., "FR-3.1 requires a native SwiftUI screen with VoiceOver accessibility")
- `docs/use-cases/<feature>_use_cases.md` has been written by `ba-analyst` at Step 2
- The Software Architect at Step 3 has issued a PASS verdict; the architect's verdict text is passed to `role-planner` as context by the bootstrap command (per FR-1.2(c) and FR-3.1)
- `.claude/resources-pending.md` has been written by `resource-architect` at Step 3.5 and is readable (per FR-1.2(d))
- `.claude/roles-pending.md` does not exist yet (clean branch or previous run's temp file deleted by planner)
- The project's `CLAUDE.md` (or equivalent) is readable for tech-stack awareness
- The agent file `src/agents/role-planner.md` is installed at `~/.claude/agents/role-planner.md` (per FR-6.8 / AC-9)
- The agent's `tools` frontmatter field is exactly `["Read", "Write", "Glob", "Grep"]` (per FR-5.7 / AC-14) and excludes `Bash`, `Edit`, `WebFetch`, `WebSearch`, `NotebookEdit`
- `~/.claude/agents/ondemand-mobile-ios-dev.md` does not exist (no prior feature introduced this role)
- `~/.claude/agents/` is writable by the current user

**Trigger**: `/bootstrap-feature` reaches Step 3.75 after a successful Step 3.5 `resource-architect` completion and delegates to `role-planner` with the architect verdict in context

### Primary Flow (Happy Path)

1. The `role-planner` agent starts and reads its inputs in the FR-1.2 order: (a) the PRD section in `docs/PRD.md` for the current feature, (b) `docs/use-cases/<feature>_use_cases.md`, (c) the architect's verdict (passed in as context by the bootstrap command), (d) `.claude/resources-pending.md`, (e) the project's `CLAUDE.md`
2. The agent does NOT read `.claude/scratchpad.md` (per FR-1.2 explicit prohibition)
3. The agent parses the PRD and detects an iOS-specific domain requirement (native SwiftUI + VoiceOver) that is outside the core 16 agents' expertise
4. The agent applies the CORE-VS-ON-DEMAND heuristic (per FR-1.8 and FR-4.2): it enumerates the 16 core agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`), confirms none of them own iOS-native UX review, and proceeds with the recommendation
5. The agent formulates the on-demand role with all five FR-1.4 fields:
   - Role title: `Mobile iOS Developer`
   - Slug: `mobile-ios-dev` (matches `/^[a-z][a-z0-9-]*[a-z0-9]$/`)
   - Why: "PRD FR-3.1 requires a native SwiftUI screen with VoiceOver accessibility -- a dedicated mobile-ios-dev role owns iOS-specific test case authoring and per-slice implementation review during QA and development"
   - Pipeline step to invoke: `Step 6: implementation`
   - Purpose at that step: "Reviews each slice's iOS implementation and authors VoiceOver-specific integration notes alongside the core `test-writer`"
6. The agent produces the FR-1.6 summary: "1 role total; 0 bootstrap-time invocations (Steps 3.75, 4); 1 implementation-time invocation (Steps 5, 6, 7)"
7. The agent writes the temp file `.claude/roles-pending.md` (per FR-2.1 and FR-2.2) containing: (a) the top-level `## Additional Roles` heading, (b) the summary line, (c) the per-role block with all five fields, (d) a `## Role invocation plan` subsection naming `mobile-ios-dev` at Step 6
8. The agent writes the on-demand prompt file at `~/.claude/agents/ondemand-mobile-ios-dev.md` (per FR-2.3 and FR-1.7) with YAML frontmatter (`name: ondemand-mobile-ios-dev`, `description`, `tools: ["Read", "Write", "Grep", "Glob"]`, `model: opus`, `scope: on-demand`) and a role-specific prompt body describing: responsibility, inputs expected at invocation, output format, authority boundaries
9. The agent does NOT write to any other file (per FR-2.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-5.8) -- not `~/.claude/settings.json`, not `~/.claude/agents/code-reviewer.md` (or any core agent), not `src/agents/*.md`, not `.env`, not `docs/PRD.md`, not `.claude/plan.md`, not `.claude/scratchpad.md`
10. The agent does NOT invoke shell commands (per FR-5.7 `tools` frontmatter exclusion of `Bash`), does NOT make any network call (per FR-5.6 / NFR-6), does NOT modify MCP configuration (per FR-5.4)
11. The agent returns control to the bootstrap orchestrator; `/bootstrap-feature` proceeds to Step 4 (QA Lead test cases) (per FR-3.1 ordering)
12. Later at Step 5, the planner reads `.claude/roles-pending.md` and inlines its content verbatim as the `## Additional Roles` top-level section of `.claude/plan.md`, placed immediately after any `## Recommended Resources` section (from Step 3.5) and before `## Prerequisites verified`, then deletes `.claude/roles-pending.md` (per FR-2.6, FR-2.7, FR-3.5; UC-7 covers this handoff in detail)
13. At Step 6 (implementation), the orchestrator consults the `## Role invocation plan` inside `.claude/plan.md` and invokes `ondemand-mobile-ios-dev` via the general-purpose pattern (UC-8 covers the invocation in detail)

**Postconditions**:
- `.claude/roles-pending.md` exists with the `## Additional Roles` heading, summary line, one per-role block (all five fields populated), and a `## Role invocation plan` subsection
- `~/.claude/agents/ondemand-mobile-ios-dev.md` exists with valid frontmatter (`name`, `description`, `tools`, `model`, `scope: on-demand`) and a non-empty prompt body
- No core agent file was touched; no `src/agents/*.md` was modified; no configuration file was modified; no network call occurred
- `/bootstrap-feature` has proceeded to Step 4

**Related FR/AC**: FR-1.2, FR-1.3, FR-1.4, FR-1.6, FR-1.7, FR-1.8, FR-2.1, FR-2.2, FR-2.3, FR-3.1, FR-4.2, FR-5.2, FR-5.4, FR-5.5, FR-5.6, FR-5.7, FR-5.8, FR-6.8 / AC-1, AC-9, AC-12, AC-14, AC-15, AC-16, AC-19

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-1-A1: Role slug collides with a core 16 agent name** -- The agent would naturally reach for a slug like `test-writer` or `code-reviewer` for an iOS test-writing role, but those slugs match core agents. The agent detects the collision and renames
  1. Steps 1-4 proceed as in the primary flow
  2. At step 5 the agent is about to emit slug `test-writer` for an "iOS test writer" role
  3. The agent applies FR-1.8 and FR-4.2 core-agent enumeration and detects that `test-writer` is a core agent
  4. Rather than a filename collision (the `ondemand-` prefix would make the file `ondemand-test-writer.md`, which does not literally collide with `~/.claude/agents/test-writer.md`), the agent detects the SEMANTIC overlap per FR-1.8: `test-writer` is the core TDD agent
  5. The agent renames the slug to one that clearly distinguishes its domain: `mobile-ios-test-author` or similar, where the domain prefix (`mobile-ios-`) makes the role's narrower scope explicit
  6. A warning/annotation is added inside the `## Additional Roles` body noting the near-collision (e.g., "Note: initially considered slug `test-writer` but renamed to `mobile-ios-test-author` to avoid semantic overlap with the core `test-writer` agent")
  7. Steps 6-13 proceed unchanged with the renamed slug
  8. The on-demand prompt file is written at `~/.claude/agents/ondemand-mobile-ios-test-author.md`

**Postconditions (UC-1-A1)**:
- The emitted slug does NOT match any core 16 agent name
- The `## Additional Roles` body contains an annotation noting the rename
- The on-demand prompt file is written at the renamed path

**Related FR/AC**: FR-1.8, FR-4.2

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-1-E1: Write permission denied on `~/.claude/agents/`** -- Step 3.75 runs but the home-directory agents folder is read-only for the current user
  1. The agent reads inputs per FR-1.2 successfully
  2. The agent formulates the `mobile-ios-dev` recommendation and attempts to write the on-demand prompt file at `~/.claude/agents/ondemand-mobile-ios-dev.md`
  3. The write fails with a permission error
  4. The agent records the failure in the `## Additional Roles` body as a prominent warning (e.g., "WARNING: could not write `~/.claude/agents/ondemand-mobile-ios-dev.md` -- permission denied. The recommendation is recorded below but the prompt file was not generated; the developer must create it manually or adjust permissions and re-run `/bootstrap-feature`.")
  5. The agent still writes `.claude/roles-pending.md` with the recommendation text and the warning so the planner, orchestrator, and developer are all aware
  6. The agent returns a structured failure to the bootstrap orchestrator
  7. Per FR-3.3, `/bootstrap-feature` MUST report the failure to the user and MUST NOT proceed to Step 4. Bootstrap halts at Step 3.75

**Postconditions (UC-1-E1)**:
- `.claude/roles-pending.md` exists with the recommendation AND the warning
- `~/.claude/agents/ondemand-mobile-ios-dev.md` does NOT exist
- `/bootstrap-feature` has halted at Step 3.75 with an error message to the user
- Step 4 (QA) did NOT run

**Related FR/AC**: FR-1.7, FR-2.3, FR-3.3, FR-5.8

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-1-EC1: PRD mentions iOS in a deferred/out-of-scope subsection** -- The PRD explicitly marks iOS support as "out of scope for iteration 1"
  1. The agent reads the PRD and detects the iOS mention is within a deferred-scope section
  2. The agent does NOT recommend `ondemand-mobile-ios-dev` (the role is not needed for this iteration)
  3. If no other domain expertise gap exists, the agent emits "No additional roles required" per FR-1.5 and UC-5 handling
  4. If other gaps exist, the agent still skips the mobile-ios-dev recommendation while emitting other role recommendations

**Related FR/AC**: FR-1.5, FR-4.1, FR-4.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, `docs/use-cases/<feature>_use_cases.md`, architect verdict (passed as context), `.claude/resources-pending.md`, `CLAUDE.md`
- **Output**: `.claude/roles-pending.md` (temp file with `## Additional Roles` + `## Role invocation plan`); `~/.claude/agents/ondemand-mobile-ios-dev.md` (persisted on-demand prompt); structured summary returned to the bootstrap orchestrator
- **Side Effects**: Exactly two file writes: one to `.claude/roles-pending.md`, one to `~/.claude/agents/ondemand-mobile-ios-dev.md`. No modification of any core agent file, configuration file, secrets store, MCP config, or project documentation. No network. No Bash.

---

## UC-2: Feature Needs a Compliance Perspective (Healthcare / HIPAA)

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- `docs/PRD.md` describes a healthcare-data feature (e.g., "FR-2.4 requires storing patient-identifiable data subject to HIPAA encryption-at-rest rules")
- The architect's verdict at Step 3 has validated the data-handling approach and is in context
- `.claude/resources-pending.md` has been produced at Step 3.5 (possibly with a cloud-compute or database recommendation) and is readable
- Use-cases file exists and describes patient-data flows
- `.claude/roles-pending.md` does not exist
- `~/.claude/agents/ondemand-compliance-officer.md` does not exist

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a feature whose PRD requires regulated-industry compliance coverage beyond the core `security-auditor`'s generic security scope

### Primary Flow (Happy Path)

1. The agent reads its five inputs per FR-1.2
2. The agent detects HIPAA compliance as a domain concern distinct from the core `security-auditor`'s generic security review. HIPAA rules (encryption-at-rest, minimum-necessary access, audit logging, BAA alignment) require healthcare-regulation expertise beyond generic security
3. The agent applies the FR-1.8 overlap check: `security-auditor` owns security posture broadly, but does NOT own regulated-industry compliance regimes; the two domains are complementary, not overlapping >50%
4. The agent formulates the `compliance-officer` on-demand role (per FR-1.4):
   - Role title: `Healthcare Compliance Officer`
   - Slug: `compliance-officer`
   - Why: "PRD FR-2.4 requires HIPAA-aligned handling of patient-identifiable data -- the core `security-auditor` covers generic security but not HIPAA-specific rules (BAA, minimum-necessary, audit trails). A compliance-officer authors HIPAA-specific test cases at Step 4 and reviews slices storing PHI"
   - Pipeline step to invoke: `Step 4: qa-planner`
   - Purpose at that step: "Authors HIPAA-specific test cases alongside the core QA test cases, covering encryption-at-rest, minimum-necessary queries, and audit logging coverage"
5. The agent produces the FR-1.6 summary: "1 role total; 1 bootstrap-time invocation (Steps 3.75, 4); 0 implementation-time invocations"
6. The agent writes `.claude/roles-pending.md` with the `## Additional Roles` body, the summary, the compliance-officer per-role block with all five fields, and a `## Role invocation plan` subsection naming `compliance-officer` at Step 4
7. The agent writes `~/.claude/agents/ondemand-compliance-officer.md` with `name: ondemand-compliance-officer`, `description`, `tools: ["Read", "Write", "Grep", "Glob"]`, `model: opus`, `scope: on-demand`, and a prompt body scoped to HIPAA rule coverage, input expectations (PRD + use-cases + schema), output format (additional test-case list), and authority boundaries (read-only on PRD, write-only on a well-scoped compliance-test-cases file within `docs/qa/`)
8. The agent does NOT modify any core agent file (per FR-5.2), any config (per FR-5.3), any MCP settings (per FR-5.4), or any secrets (per FR-5.5); does NOT make network calls (per FR-5.6)
9. The agent returns control; bootstrap proceeds to Step 4
10. At Step 4, the orchestrator consults the `## Role invocation plan` (once inlined at Step 5) and spawns the on-demand compliance-officer via the general-purpose pattern alongside the core `qa-planner`. BUT WAIT: at Step 4 the plan file has not yet been written -- the orchestrator reads the temp file `.claude/roles-pending.md` directly when Step 4 runs, or the orchestrator defers on-demand invocation until after Step 5 planner inlining. See UC-7 for the exact ordering
11. At Step 4 (or immediately after Step 5 if the orchestrator defers), the orchestrator invokes `ondemand-compliance-officer` via the general-purpose pattern (UC-8 covers the mechanics)

**Postconditions**:
- `.claude/roles-pending.md` contains the `compliance-officer` entry with all five fields
- `~/.claude/agents/ondemand-compliance-officer.md` exists with valid frontmatter and a HIPAA-focused prompt body
- Summary line shows 1 bootstrap-time invocation so the developer knows the compliance review participates at QA time
- No PRD, no plan.md, no core agent, no config has been modified

**Related FR/AC**: FR-1.2, FR-1.3, FR-1.4, FR-1.6, FR-1.7, FR-1.8, FR-2.1, FR-2.3, FR-4.1, FR-4.2, FR-5.2 through FR-5.8 / AC-12, AC-15, AC-18

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-2-A1: `compliance-officer` already exists from another project** -- `~/.claude/agents/ondemand-compliance-officer.md` exists from a prior feature (possibly from a different project under the same user) because `~/.claude/agents/` is a global per-user directory
  1. Steps 1-4 proceed as in the primary flow
  2. At step 7 the agent detects via Read/Glob that `~/.claude/agents/ondemand-compliance-officer.md` already exists
  3. Per FR-2.5, the agent overwrites the existing file with the current feature's version. Cross-feature reuse optimization is out of scope for iteration 1 (per 5.8 item 2), so overwriting is the deliberate behavior
  4. The agent MAY optionally note the overwrite in the `## Additional Roles` body (e.g., "Overwrote existing `~/.claude/agents/ondemand-compliance-officer.md` from a prior feature with the current feature's HIPAA-focused version")
  5. Steps 8-11 proceed unchanged

**Postconditions (UC-2-A1)**:
- `~/.claude/agents/ondemand-compliance-officer.md` has been overwritten with the current feature's content (not merged, not appended)
- `.claude/roles-pending.md` MAY contain the optional overwrite annotation

**Related FR/AC**: FR-2.5

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-2-E1: Input `.claude/resources-pending.md` is missing (Section 4 did not ship before Section 5)** -- The PRD Dependency 12 graceful-absence path: `role-planner` is invoked but the resource-architect temp file has not been produced
  1. The agent attempts to read `.claude/resources-pending.md` (FR-1.2 position (d))
  2. The read returns "file does not exist"
  3. Per Dependency 12 the agent falls back to reading PRD + use-cases + architect verdict + CLAUDE.md (positions a, b, c, e) only
  4. The agent's prompt MUST document this graceful-absence path so the agent does NOT treat a missing resources file as a bootstrap failure
  5. The agent proceeds with role recommendation based on the four available inputs; recommendations may be less precise without the resource recommendations, but the pipeline continues
  6. Steps 4-11 of the primary flow proceed normally

**Postconditions (UC-2-E1)**:
- `.claude/roles-pending.md` is written; `~/.claude/agents/ondemand-compliance-officer.md` is written
- The agent did NOT halt the bootstrap even though one of the five FR-1.2 inputs was absent

**Related FR/AC**: FR-1.2, Dependency 12

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-2-EC1: PRD mentions HIPAA in a compliance-note appendix but does not actually handle PHI in scope** -- The PRD discusses HIPAA conceptually (e.g., "future features may handle PHI") but the current feature's functional requirements do not touch PHI
  1. The agent reads the PRD and detects the HIPAA mention is descriptive, not binding on the current feature's scope
  2. The agent does NOT recommend `compliance-officer` (the role is not needed for this iteration's PRD scope)
  3. If no other domain gap exists, the agent emits "No additional roles required" per FR-1.5 and UC-5 handling

**Related FR/AC**: FR-1.5, FR-4.1

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: same as UC-1 plus the PRD section defining HIPAA-touching functional requirements
- **Output**: same structure as UC-1 with `compliance-officer` as the recommended slug
- **Side Effects**: Two file writes (`.claude/roles-pending.md` and `~/.claude/agents/ondemand-compliance-officer.md`). No modifications outside those two targets.

---

## UC-3: Feature Needs an Information Researcher Role (Library Migration)

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- `docs/PRD.md` describes a migration from a deprecated library (e.g., "FR-4.2 requires migrating from `crypto-v1` to `crypto-v3` -- migration path is non-trivial and spans 14 call sites")
- The architect's verdict at Step 3 has flagged that migration-path options need research beyond the architect's own design scope
- `.claude/resources-pending.md` exists (possibly with a library recommendation) and is readable
- Use-cases file exists
- `.claude/roles-pending.md` does not exist
- `~/.claude/agents/ondemand-library-researcher.md` does not exist

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a feature whose PRD requires deep research of external library migration options before the architect can finalize the design

### Primary Flow (Happy Path)

1. The agent reads its five inputs per FR-1.2
2. The agent detects a research-heavy dependency in the PRD: the migration requires enumerating compatibility-breaking changes, alternative libraries, and downstream impact across 14 call sites
3. The agent applies the FR-1.8 overlap check: the core `architect` owns technical design decisions; `ba-analyst` owns scenario enumeration; neither owns deep literature/library research. The gap is genuine
4. The agent formulates the `information-researcher` on-demand role (per FR-1.4):
   - Role title: `Information Researcher`
   - Slug: `information-researcher`
   - Why: "PRD FR-4.2 requires migration from `crypto-v1` to `crypto-v3` with 14 affected call sites; the core `architect` needs a researched menu of migration-path options (direct upgrade, adapter layer, staged migration) before finalizing the design. An information-researcher authors that menu at Step 3 (architect) as a pre-read"
   - Pipeline step to invoke: `Step 3: architect` (interpreted as a pre-read the next time the architect is consulted or the next iteration of architect review; because Step 3 has already run in this bootstrap, the call plan explicitly notes that the researcher runs BEFORE a re-invocation of the architect if re-review is triggered, OR at Step 5 planner as an informational attachment if no re-review is needed)
   - Purpose at that step: "Produces a researched menu of migration-path options with tradeoffs, cited from the library's changelog and alternative-library comparison, delivered as a markdown addendum to the architect's verdict"
5. The agent produces the FR-1.6 summary: "1 role total; 1 bootstrap-time invocation (Steps 3.75, 4); 0 implementation-time invocations" (counting Step 3 as bootstrap-time)
6. The agent writes `.claude/roles-pending.md` with the `## Additional Roles` body and the `## Role invocation plan` subsection naming `information-researcher` at Step 3 (or Step 5 fallback per the call-plan note)
7. The agent writes `~/.claude/agents/ondemand-information-researcher.md` with proper frontmatter and a prompt body scoped to migration-path research, input expectations (PRD + deprecated-library name + codebase call-site inventory), output format (markdown addendum with tradeoffs), and authority boundaries. CRITICAL: the on-demand researcher's `tools` field in its own frontmatter MUST NOT include `WebFetch` or `WebSearch` unless the researcher genuinely needs them (per FR-1.7 minimum-tool guidance) -- iteration 1 has no programmatic enforcement (per 5.8 item 11), so the quality of the researcher prompt determines whether it stays local-only or claims web access. The role-planner agent's OWN `tools` exclude web tools (per FR-5.7), but the generated on-demand role's tools are a separate decision
8. The agent does NOT itself fetch library documentation (per FR-5.6 / NFR-6); all research would be performed by the generated role WHEN invoked, not by the planner generating the role
9. Primary flow continues with bootstrap proceeding to Step 4

**Postconditions**:
- `.claude/roles-pending.md` contains the `information-researcher` entry
- `~/.claude/agents/ondemand-information-researcher.md` exists with a migration-research-focused prompt body
- Role-planner itself made no network calls; whether the generated role makes network calls at invocation time depends on its own `tools` frontmatter and its prompt body

**Related FR/AC**: FR-1.2, FR-1.3, FR-1.4, FR-1.6, FR-1.7, FR-4.1, FR-5.6, FR-5.7, NFR-6 / AC-12, AC-15

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-3-A1: Research-role also touches a resource-architect concern (alternative library recommendation)** -- The research surfaces that an alternative library (e.g., `crypto-v4` from a different vendor) might be a better migration target, which is a resource recommendation
  1. Steps 1-4 proceed as in the primary flow
  2. At step 5 the role-planner notices the researcher's scope would overlap with `resource-architect` -- specifically, recommending `crypto-v4` would be a Library/Framework recommendation (Section 4 FR-4)
  3. Per FR-4.3 (strict boundary), `role-planner` MUST NOT recommend the library replacement itself and MUST defer that to `resource-architect`
  4. The agent resolves the boundary: the `information-researcher` role's prompt body is scoped to PRODUCING the migration-path menu (including noting that `crypto-v4` exists as an option) but NOT to activating or installing it. The actual library-recommendation decision is left to a re-invocation of `resource-architect` or the human developer reading the researcher's output
  5. The agent adds a note to the `## Additional Roles` body: "The information-researcher will surface library-alternative options but does NOT make installation recommendations. Any library-replacement decision is deferred to `resource-architect`'s scope per FR-4.3."
  6. Steps 6-9 proceed unchanged

**Postconditions (UC-3-A1)**:
- The generated `ondemand-information-researcher.md` prompt body explicitly disclaims library-installation authority
- The `## Additional Roles` body contains the boundary-deferral annotation

**Related FR/AC**: FR-4.3, FR-4.4

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-3-E1: Architect verdict was not passed as context to the role-planner spawn** -- The bootstrap orchestrator fails to forward the architect's verdict text to the `role-planner` spawn
  1. The agent attempts to read the architect verdict from its spawn context
  2. The context is empty for that input
  3. The agent falls back to what is available (PRD + use-cases + resources-pending + CLAUDE.md) similar to UC-2-E1
  4. The agent notes the missing input in the `## Additional Roles` body (e.g., "Note: architect verdict not available in spawn context; recommendations based on PRD, use-cases, resources, and CLAUDE.md only") so the planner and developer see the partial-input condition
  5. The agent proceeds to emit recommendations; missing input does NOT halt the bootstrap

**Postconditions (UC-3-E1)**:
- Recommendations are still emitted even with the partial inputs
- `.claude/roles-pending.md` contains the annotation about the missing architect-verdict context

**Related FR/AC**: FR-1.2, FR-3.1

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-3-EC1: Migration is listed in a deferred PRD subsection ("future phase")** -- The PRD mentions the deprecated-library migration but marks it "future phase, out of scope for this iteration"
  1. The agent detects the deferred-scope marker
  2. The agent does NOT recommend `information-researcher` for this bootstrap
  3. UC-5 handling applies if no other role needs exist

**Related FR/AC**: FR-1.5, FR-4.1

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: same as UC-1/UC-2
- **Output**: `.claude/roles-pending.md` + `~/.claude/agents/ondemand-information-researcher.md`
- **Side Effects**: Two file writes, no others.

---

## UC-4: Feature Needs Multiple Specialized Roles (Mobile + Cloud-Architect-Reviewer + Compliance)

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- `docs/PRD.md` describes a mobile-app feature with cloud sync that stores financial data. Three distinct domains appear in the PRD: mobile UX, cloud architecture (AWS), and financial compliance (PCI-DSS)
- The architect's verdict at Step 3 has PASSed the overall design
- `.claude/resources-pending.md` from Step 3.5 contains a Cloud/Compute recommendation for AWS (produced by `resource-architect` per Section 4 FR-4.3 -- the cloud INFRASTRUCTURE recommendation)
- Use-cases file exists
- `.claude/roles-pending.md` does not exist
- None of `ondemand-mobile-dev.md`, `ondemand-aws-integration-reviewer.md`, `ondemand-compliance-officer.md` exist yet in `~/.claude/agents/`

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a feature spanning three disjoint domains each requiring specialized expertise

### Primary Flow (Happy Path)

1. The agent reads its five inputs per FR-1.2
2. The agent identifies three distinct domain gaps:
   - Mobile UX (iOS + Android native concerns -- FR-4.6 permits a single `mobile-dev` role covering both platforms rather than two platform-specific roles)
   - Cloud architecture review (AWS-specific design patterns, not infrastructure spin-up -- see UC-10 for the scope split between role-planner and resource-architect)
   - Financial compliance (PCI-DSS rules on cardholder data handling)
3. The agent applies the FR-1.8 overlap check for each:
   - `mobile-dev` does NOT overlap with any core 16 agent
   - `aws-integration-reviewer` does NOT overlap with `architect` (architect reviews technical design at Step 3; the aws-integration-reviewer reviews AWS-SPECIFIC design choices during implementation). CRITICAL BOUNDARY: this role reviews AWS-design, it does NOT provision cloud resources -- that is `resource-architect`'s scope per FR-4.3. See UC-10 for the detailed split
   - `compliance-officer` (specialized for PCI-DSS rather than HIPAA) does NOT overlap with `security-auditor`
4. The agent applies FR-4.6 (at most one role per distinct domain per feature): three distinct domains (mobile, cloud-review, compliance) justify three roles
5. The agent applies FR-4.7 (conservative guidance -- typically 0-3 roles): three roles is at the upper edge of conservative but justified given three genuinely distinct domains
6. The agent formulates three FR-1.4 entries:
   - `mobile-dev` at `Step 6: implementation` (per-slice iOS/Android review alongside `test-writer`)
   - `aws-integration-reviewer` at `Step 6: implementation` (per-slice AWS pattern review -- but explicitly calling out it does NOT touch the cloud resources recommended by `resource-architect`; it REVIEWS the design)
   - `compliance-officer` (PCI-DSS variant) at `Step 4: qa-planner` (PCI-DSS test case authoring)
7. The agent produces the FR-1.6 summary: "3 roles total; 1 bootstrap-time invocation (Step 4); 2 implementation-time invocations (Step 6)"
8. The agent writes `.claude/roles-pending.md` with:
   - The top-level `## Additional Roles` heading
   - The summary line counting 3 roles split across invocation phases
   - Three per-role blocks with all five fields each
   - A `## Role invocation plan` subsection with three entries, each naming the slug, pipeline step, and purpose
9. The agent writes three on-demand prompt files:
   - `~/.claude/agents/ondemand-mobile-dev.md`
   - `~/.claude/agents/ondemand-aws-integration-reviewer.md`
   - `~/.claude/agents/ondemand-compliance-officer.md`
10. Each on-demand prompt has valid frontmatter (`name`, `description`, `tools`, `model: opus`, `scope: on-demand`) and a role-specific prompt body
11. The agent does NOT write to any fourth file, does NOT modify core agents, does NOT modify configs (per FR-5.1 through FR-5.8)
12. The agent does NOT recommend the AWS INFRASTRUCTURE itself -- per FR-4.3 and UC-10, the aws-integration-reviewer ROLE (which reviews AWS design) is role-planner's scope; the AWS RESOURCE (compute, region, AMIs) is resource-architect's scope and was already recommended at Step 3.5
13. The agent returns control; bootstrap proceeds to Step 4

**Postconditions**:
- `.claude/roles-pending.md` contains three per-role blocks and a three-entry call plan
- Three `~/.claude/agents/ondemand-<slug>.md` files exist, each with valid frontmatter and a scoped prompt body
- Summary line shows 1 bootstrap-time + 2 implementation-time invocations so the developer sees the participation shape
- No core agent was touched; no config was modified; no cloud API was called; no network call occurred

**Related FR/AC**: FR-1.2, FR-1.3, FR-1.4, FR-1.6, FR-1.7, FR-4.1, FR-4.3, FR-4.6, FR-4.7, FR-5.1 through FR-5.8 / AC-12, AC-15, AC-16, AC-18

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-4-A1: Role boundary conflict with resource-architect (infrastructure role proposed)** -- The agent is about to recommend an "infrastructure-as-code role" (e.g., `ondemand-iac-author`) which overlaps with resource-architect's Cloud/Compute scope
  1. Steps 1-3 proceed as in the primary flow
  2. At step 4 the agent considers adding a fourth role: `iac-author` who would author Terraform/CDK for the AWS resources
  3. The agent applies FR-4.3 strictly: authoring IaC manifests to SPIN UP AWS resources is infrastructure provisioning. `resource-architect` owns the Cloud/Compute recommendation (naming the resource and the activation command) per Section 4 FR-4.3. Whether that activation command is a Terraform script or a manual AWS console click is still infrastructure, and falls within resource-architect's scope boundary
  4. The agent defers the IaC concern: it does NOT create `ondemand-iac-author`. It annotates the `## Additional Roles` body: "Considered an `iac-author` role but deferred to resource-architect's Cloud/Compute recommendation in `.claude/resources-pending.md` per FR-4.3. The developer applies the activation command produced by resource-architect; role-planner does not override that boundary."
  5. The three-role recommendation (mobile-dev, aws-integration-reviewer, compliance-officer) proceeds unchanged
  6. Steps 8-13 proceed unchanged

**Postconditions (UC-4-A1)**:
- No `ondemand-iac-author.md` file is written
- `.claude/roles-pending.md` contains the annotation about the deferred IaC concern

**Related FR/AC**: FR-4.3, FR-4.4, UC-10 (cross-reference)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-4-E1: Mid-write failure -- two of three on-demand files succeed, third fails** -- `~/.claude/agents/ondemand-mobile-dev.md` and `~/.claude/agents/ondemand-compliance-officer.md` are written successfully but the third write (for `ondemand-aws-integration-reviewer.md`) fails (e.g., disk full, permission flipped mid-run, filesystem error)
  1. The agent writes the first two on-demand files successfully
  2. The third write fails
  3. The agent records the partial-success state in the `## Additional Roles` body as a prominent warning: "WARNING: 2 of 3 on-demand files written successfully. `~/.claude/agents/ondemand-aws-integration-reviewer.md` FAILED to write (error: <reason>). The AWS-integration-reviewer role is recommended but its prompt file was not generated; the developer must create it manually or resolve the filesystem error and re-run `/bootstrap-feature`"
  4. The agent still writes `.claude/roles-pending.md` with all three recommendations AND the warning
  5. The agent returns a structured failure to the bootstrap orchestrator
  6. Per FR-3.3, `/bootstrap-feature` reports the failure and halts at Step 3.75. The partial writes to `~/.claude/agents/` remain on disk (iteration 1 does not roll back partial state; cleanup is the developer's concern if they want to re-run fresh)
  7. If the user re-runs `/bootstrap-feature` after fixing the filesystem error, FR-2.4 (overwrite roles-pending.md) and FR-2.5 (overwrite ondemand files) apply, producing a clean set of three files

**Postconditions (UC-4-E1)**:
- `.claude/roles-pending.md` contains all three recommendations AND the warning about the partial failure
- Two of three `~/.claude/agents/ondemand-<slug>.md` files exist; the third does NOT
- `/bootstrap-feature` has halted at Step 3.75
- Step 4 did NOT run

**Related FR/AC**: FR-2.3, FR-2.4, FR-2.5, FR-3.3, FR-5.8

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-4-EC1: Agent is tempted to recommend a 4th+ role (over-recommendation)** -- The agent's heuristic surfaces a fourth candidate role (e.g., `mobile-qa-engineer` beyond the existing `mobile-dev`)
  1. The agent notes that `mobile-qa-engineer` and `mobile-dev` cover the same domain (mobile)
  2. Per FR-4.6, the agent MUST NOT emit two roles within the same domain. The agent consolidates: `mobile-dev` is expanded to include QA responsibilities, or the second role is dropped
  3. Per FR-4.7 and Risk 1, the agent is conservative: 4+ recommendations signal the feature is too broad. The agent either drops the 4th role or flags the feature as over-broad in the `## Additional Roles` body
  4. The final recommendation remains at 3 roles

**Related FR/AC**: FR-4.6, FR-4.7, Risk 1

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: PRD + use-cases + architect verdict + `.claude/resources-pending.md` + CLAUDE.md
- **Output**: `.claude/roles-pending.md` (with 3 per-role blocks and 3 call-plan entries) plus three `~/.claude/agents/ondemand-<slug>.md` files
- **Side Effects**: Exactly four file writes (one temp + three persisted prompts). No writes outside the two permitted target directories (`.claude/` and `~/.claude/agents/ondemand-*.md`).

---

## UC-5: Feature Needs NO Additional Roles (Pure Refactor)

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- `docs/PRD.md` describes a pure refactor of existing code (e.g., "FR-1.1 extracts shared validation logic into a helper module")
- The architect's verdict has PASSed and is in context
- `.claude/resources-pending.md` exists from Step 3.5 and shows "No external resources required" (per Section 4 FR-1.5)
- Use-cases file exists and covers only internal refactoring scenarios
- `.claude/roles-pending.md` does not exist
- No additional domain expertise is required -- the feature is fully within the core 16 agents' scope

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a feature that is genuinely covered by the core 16 agents without needing specialized roles

### Primary Flow (Happy Path)

1. The agent reads its five inputs per FR-1.2
2. The agent applies the FR-1.8 overlap check: every aspect of the refactor maps to responsibilities already covered by the core 16 (requirements -> prd-writer, tests -> test-writer, code review -> code-reviewer, etc.)
3. The agent identifies NO domain gap -- no mobile, healthcare, accessibility, i18n, data-science, embedded, legal, cryptography, or any other specialized domain applies
4. The agent emits the explicit FR-1.5 statement: "No additional roles required"
5. The agent writes `.claude/roles-pending.md` with:
   - The top-level `## Additional Roles` heading
   - A summary line: "0 roles total; 0 bootstrap-time invocations; 0 implementation-time invocations"
   - The explicit body text "No additional roles required. The feature's scope is fully covered by the core 16 agents."
   - An EMPTY `## Role invocation plan` subsection (the subsection header exists with a "(no on-demand roles scheduled)" placeholder body for output-contract consistency)
6. The agent writes NO `~/.claude/agents/ondemand-*.md` files -- per FR-1.5 the explicit "no roles" statement is the output; no prompt files are generated
7. The agent does NOT write to any other file
8. The agent returns control; bootstrap proceeds to Step 4
9. At Step 5 the planner inlines the `## Additional Roles` section with the explicit statement into `.claude/plan.md` and deletes the temp file per FR-2.6 (UC-7 covers this)
10. At Step 6 and beyond, the orchestrator consults the call plan, sees zero on-demand roles, and proceeds without any general-purpose spawn

**Postconditions**:
- `.claude/roles-pending.md` exists with the explicit "No additional roles required" statement
- NO `~/.claude/agents/ondemand-*.md` files were created by this bootstrap run (pre-existing files from other features are NOT deleted -- iteration 1 has no teardown per 5.8 item 1)
- Bootstrap proceeds normally through Step 4 and Step 5

**Related FR/AC**: FR-1.5, FR-2.1, FR-2.2 / AC-11

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-5-A1: Feature is NEARLY pure-refactor but has a single minor domain touch** -- The refactor touches a single accessibility concern (e.g., renaming an ARIA attribute). The agent considers whether a dedicated `accessibility-reviewer` is warranted
  1. The agent evaluates per FR-4.7 (conservative) and FR-1.8 (overlap check)
  2. A single ARIA rename is within the core `code-reviewer`'s scope; NO dedicated accessibility reviewer is warranted for this scope
  3. The agent emits "No additional roles required" per FR-1.5 same as the primary flow
  4. The agent MAY optionally include an "OBSERVATION:" comment (per FR-4.4) noting that a broader accessibility audit could be valuable for future features, but does NOT generate an on-demand role for this feature

**Postconditions (UC-5-A1)**:
- Same as UC-5 primary flow; no role files created
- `## Additional Roles` body MAY contain an OBSERVATION: comment

**Related FR/AC**: FR-1.5, FR-4.4, FR-4.7

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-5-E1: PRD is empty or unreadable** -- Step 3.75 runs but `docs/PRD.md` cannot be read (file missing, permission denied, or empty file)
  1. The `role-planner` agent starts and attempts to read `docs/PRD.md`
  2. The read fails or returns empty content
  3. The agent returns a structured error to the orchestrator noting the blocker (no PRD to analyze)
  4. Per FR-3.3, `/bootstrap-feature` MUST report the failure to the user and MUST NOT proceed to Step 4. Bootstrap halts at Step 3.75
  5. No `.claude/roles-pending.md` is written (agent did not produce output)
  6. No `~/.claude/agents/ondemand-*.md` files are written
  7. If in a subsequent retry the user re-runs `/bootstrap-feature` after fixing the PRD, the agent runs cleanly per UC-1/UC-2/UC-3/UC-4/UC-5 as appropriate

**Postconditions (UC-5-E1)**:
- `/bootstrap-feature` has halted at Step 3.75 with an error message to the user
- `.claude/roles-pending.md` does not exist
- Step 4 (QA) did NOT run
- The planner, if somehow invoked, would follow the UC-7-E1 silent-skip branch per FR-2.6 (though it should NOT be invoked in this failure mode)

**Related FR/AC**: FR-1.2 (PRD is a required input), FR-3.3

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-5-EC1: PRD explicitly says "feature requires no additional specialized expertise"** -- The PRD includes an explicit note that the feature fits within the core 16 agents
  1. The agent honors the PRD's explicit signal and emits "No additional roles required" without further analysis
  2. Same output as UC-5 primary flow

**Related FR/AC**: FR-1.5

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: PRD + use-cases + architect verdict + resources-pending (may show "No external resources required") + CLAUDE.md
- **Output**: `.claude/roles-pending.md` with explicit "No additional roles required" body; zero on-demand prompt files
- **Side Effects**: Exactly one file write (`.claude/roles-pending.md`). Zero writes to `~/.claude/agents/`. No other modifications.

---

## UC-6: Reuse of On-Demand Role From a Prior Feature

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- A prior feature invocation generated `~/.claude/agents/ondemand-mobile-ios-dev.md` with valid frontmatter and a prompt body; the file is still on disk (no teardown in iteration 1 per 5.8 item 1)
- The current feature's PRD also describes an iOS feature that would benefit from the same role
- The current feature's `.claude/roles-pending.md` does not exist (clean bootstrap)
- All other UC-1 preconditions hold

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a new iOS feature when a prior iOS feature already left an `ondemand-mobile-ios-dev.md` file on disk

### Primary Flow (Happy Path)

1. The agent reads inputs per FR-1.2
2. The agent identifies the iOS domain gap same as UC-1 and formulates the `mobile-ios-dev` recommendation
3. Before writing to `~/.claude/agents/ondemand-mobile-ios-dev.md`, the agent performs a Read/Glob check and detects the file already exists
4. Per FR-2.5, iteration 1's deliberate simplification is: OVERWRITE the existing file with the current feature's version. Cross-feature reuse optimization is out of scope (per 5.8 item 2)
5. The agent writes the on-demand file, overwriting the existing content. The new content reflects the CURRENT feature's PRD and use-cases; any tailoring from the prior feature is lost (this is the iteration-1 trade-off)
6. The agent MAY optionally annotate in the `## Additional Roles` body: "Overwrote existing `~/.claude/agents/ondemand-mobile-ios-dev.md` from a prior feature. Prior content is lost; cross-feature reuse optimization is out of scope for iteration 1."
7. The agent writes `.claude/roles-pending.md` same as UC-1
8. Steps 11-13 of UC-1 proceed unchanged

**Postconditions**:
- `~/.claude/agents/ondemand-mobile-ios-dev.md` now reflects the CURRENT feature's scope (not the prior feature's)
- `.claude/roles-pending.md` MAY contain the overwrite annotation
- The prior feature's completed work (commits, tests, etc.) is unaffected by the on-demand prompt overwrite -- the overwrite only affects future invocations of that on-demand role

**Related FR/AC**: FR-2.5, NFR-10 / AC-12, AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-6-A1: User manually edited the existing on-demand file between features** -- Between the prior feature's completion and the current bootstrap, the developer manually customized `~/.claude/agents/ondemand-mobile-ios-dev.md` (e.g., added project-specific instructions)
  1. The agent detects the file exists (same as primary flow)
  2. Per FR-2.5, the agent overwrites regardless of user edits -- iteration 1 does NOT preserve user customizations across role-planner runs
  3. The user's customizations are lost
  4. This is the iteration-1 trust model: `~/.claude/agents/ondemand-*.md` is pipeline-managed, NOT user-managed, for features that re-surface the same slug. The user's recourse is to (a) rename their custom role to a non-colliding slug, or (b) accept the overwrite, or (c) wait for iteration 2 where cross-feature reuse and preservation are addressed
  5. The agent MAY annotate the overwrite in the `## Additional Roles` body to surface the situation to the developer

**Postconditions (UC-6-A1)**:
- User customizations to the on-demand file are lost
- No warning is raised beyond the optional annotation; iteration 1 does NOT detect that the user edited the file

**Related FR/AC**: FR-2.5, 5.8 item 2

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-6-E1: Existing on-demand file has YAML frontmatter corruption** -- The existing `~/.claude/agents/ondemand-mobile-ios-dev.md` has malformed frontmatter from a previous manual edit
  1. The agent does NOT need to parse the existing frontmatter -- it simply overwrites with fresh content
  2. The overwrite succeeds regardless of the prior corruption
  3. The newly-written file has valid frontmatter per FR-1.7
  4. No error is raised during role-planner's own execution
  5. HOWEVER, if before Step 3.75 ran (e.g., between features) the orchestrator had attempted a general-purpose spawn against the corrupted file, that spawn would have failed (per UC-8-E1). role-planner's fresh write at this bootstrap REPAIRS the corruption for future invocations

**Postconditions (UC-6-E1)**:
- The on-demand file is now valid (overwritten)
- Prior corruption is resolved

**Related FR/AC**: FR-1.7, FR-2.5, Risk 5

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-6-EC1: Prior feature's on-demand role had different slug semantics** -- Prior feature's `ondemand-mobile-ios-dev.md` was authored for a UIKit iOS feature; current feature is pure SwiftUI. Same slug, divergent semantics
  1. The agent overwrites with the SwiftUI-specific prompt body
  2. A SwiftUI-focused prompt is not WRONG for a pipeline entry labeled `mobile-ios-dev`, but loses UIKit specificity
  3. Iteration 1 accepts this coarseness; iteration 2 may address per-feature sub-slug namespacing (per 5.8 item 10)

**Related FR/AC**: FR-2.5, 5.8 item 10

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: Same as UC-1
- **Output**: Overwritten `~/.claude/agents/ondemand-mobile-ios-dev.md`; fresh `.claude/roles-pending.md`
- **Side Effects**: Same two file writes as UC-1. The "overwrite" semantics of `Write` on an existing file is the mechanism; no separate "delete then write" is required.

---

## UC-7: Planner Inlines the Temp File Into `plan.md`

**Actor**: `planner` agent, invoked by `/bootstrap-feature` at Step 5, after `role-planner` has completed at Step 3.75 and `qa-planner` has completed at Step 4
**Preconditions**:
- `.claude/roles-pending.md` exists from Step 3.75 (either with role recommendations per UC-1/UC-2/UC-3/UC-4 or with the explicit "No additional roles required" statement per UC-5)
- `.claude/plan.md` does NOT yet exist (or exists in an incomplete state with only the `## Recommended Resources` section if `resource-architect` ran at Step 3.5)
- `.claude/resources-pending.md` has already been handled by the planner's Section 4 FR-2.5 inlining step (the planner processes resources FIRST, then roles; OR processes both atomically in one pass -- either ordering is valid as long as the two `## Recommended Resources` and `## Additional Roles` sections end up in the correct relative order in the final `.claude/plan.md`)
- The planner agent prompt at `src/agents/planner.md` has been updated per FR-2.6 to include the roles-pending inlining step
- The planner's existing responsibilities (Section 1 FR-3 executable plan fields, Section 2 wave assignment, Section 4 FR-2.5 `## Recommended Resources` inlining) are still in force unchanged

**Trigger**: `/bootstrap-feature` reaches Step 5 and delegates to the `planner` agent

### Primary Flow (Happy Path)

1. The planner begins its ordinary flow: read PRD, use-cases, test cases, architect verdict, CLAUDE.md
2. The planner checks for `.claude/roles-pending.md`
3. The file exists; the planner reads its full content (the `## Additional Roles` heading + summary + per-role blocks + `## Role invocation plan` subsection)
4. The planner reads `.claude/resources-pending.md` if present (Section 4 FR-2.5 behavior) -- assume for this scenario the resources file has already been handled in a prior ordering step, so `## Recommended Resources` is already at the top of the planner's in-progress plan.md content
5. The planner constructs `.claude/plan.md` with top-level sections in this exact order (per FR-2.7, Section 4 FR-2.7):
   - `## Recommended Resources` (if resources exist; placed at the very top)
   - `## Additional Roles` (the verbatim content from `.claude/roles-pending.md`; placed immediately after `## Recommended Resources`, before `## Prerequisites verified`)
   - `## Prerequisites verified`
   - Slices (with Section 2 wave assignment if applicable)
6. The planner inlines the `## Additional Roles` content VERBATIM (preserving all formatting, including the summary line, per-role blocks, `## Role invocation plan` subsection). The planner does NOT re-parse, re-format, or edit the content; it is a pass-through copy
7. The planner deletes `.claude/roles-pending.md` after successful inlining (per FR-2.6)
8. The planner continues with its existing slice-planning responsibilities (Section 1 FR-3, Section 2) unchanged
9. The planner writes the final `.claude/plan.md` and returns control to `/bootstrap-feature`

**Postconditions**:
- `.claude/plan.md` exists and contains (in order from top): `## Recommended Resources` (if applicable), `## Additional Roles`, `## Prerequisites verified`, slices
- `.claude/roles-pending.md` does NOT exist (deleted by the planner per FR-2.6 / AC-13)
- All of the planner's existing responsibilities have been carried out
- The `## Additional Roles` content is identical byte-for-byte to what role-planner wrote at Step 3.75

**Related FR/AC**: FR-2.6, FR-2.7, FR-3.5, NFR-2 / AC-5, AC-10, AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-7-A1: No `## Recommended Resources` section (legacy or no-resource feature)** -- `.claude/resources-pending.md` did not exist (either Section 4 did not ship in this build, or the resource-architect agent's output was absent). Either `.claude/plan.md` has no `## Recommended Resources` at all, or the planner's Section 4 FR-2.5 step correctly no-op'd
  1. Steps 1-4 proceed as in the primary flow with the nuance that `## Recommended Resources` does NOT appear in plan.md
  2. At step 5 the planner places `## Additional Roles` at the very TOP of `.claude/plan.md` (before `## Prerequisites verified`) since no `## Recommended Resources` precedes it, per FR-2.7 "or at the very top if `## Recommended Resources` is absent"
  3. Steps 6-9 proceed unchanged

**Postconditions (UC-7-A1)**:
- `.claude/plan.md` has `## Additional Roles` as the very first top-level section, followed by `## Prerequisites verified`, then slices
- `.claude/roles-pending.md` is deleted

**Related FR/AC**: FR-2.7

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-7-E1: `.claude/roles-pending.md` does not exist (legacy plan path or skipped Step 3.75)** -- The planner runs but the roles-pending file is absent
  1. The planner checks for `.claude/roles-pending.md`
  2. The file does not exist
  3. Per FR-2.6, the planner MUST skip the inlining step silently -- no error, no warning
  4. The planner proceeds with its remaining responsibilities as if no `## Additional Roles` section was expected. `.claude/plan.md` is written without an `## Additional Roles` section. This is the backward-compat path (per NFR-2)
  5. No delete-attempt happens because the file never existed

**Postconditions (UC-7-E1)**:
- `.claude/plan.md` exists without an `## Additional Roles` section
- `.claude/roles-pending.md` does not exist (still absent)
- The planner did NOT fail or halt bootstrap

**Related FR/AC**: FR-2.6, NFR-2 / AC-17

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-7-E2: Planner successfully inlines but fails to delete the temp file** -- The inlining succeeds; the delete step fails (e.g., filesystem error)
  1. The planner inlines the content into `.claude/plan.md` successfully
  2. The planner attempts to delete `.claude/roles-pending.md` but the delete fails
  3. The planner reports the delete failure to the bootstrap orchestrator as a warning (non-blocking)
  4. Bootstrap continues; `.claude/plan.md` has the correct `## Additional Roles` section but the stale temp file persists
  5. Per Risk 6, the persistent temp file does not block anything. The next bootstrap invocation will overwrite the temp file per FR-2.4, cleaning up the stale content

**Postconditions (UC-7-E2)**:
- `.claude/plan.md` is correct
- `.claude/roles-pending.md` persists as a stale file
- Bootstrap completes with a non-fatal warning

**Related FR/AC**: FR-2.4, FR-2.6, Risk 6

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-7-EC1: Plan Critic runs after planner completes** -- After the planner writes `.claude/plan.md`, the plan is submitted to the Plan Critic per the CLAUDE.md Plan Critic Pass rules
  1. The Plan Critic reads `.claude/plan.md` and observes the `## Additional Roles` section
  2. Per FR-6.9 / AC-17, the critic RECOGNIZES `## Additional Roles` as a valid top-level plan section
  3. The critic does NOT flag presence of the section as a finding
  4. The critic does NOT flag absence of the section as a finding (for legacy plans)
  5. The critic MAY flag malformed per-role blocks (e.g., missing one of the five FR-1.4 fields) as MINOR -- not MAJOR, not CRITICAL per NFR-8
  6. The critic MAY flag slug inconsistency between the `## Additional Roles` body and the `## Role invocation plan` subsection as MINOR

**Postconditions (UC-7-EC1)**:
- Plan Critic findings reflect only legitimate issues
- `## Additional Roles` presence/absence is NOT flagged

**Related FR/AC**: FR-6.9, NFR-8 / AC-17

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `.claude/roles-pending.md` (role-planner's output); `.claude/resources-pending.md` (resource-architect's output, if present); all existing planner inputs (PRD, use-cases, test-cases, architect verdict, CLAUDE.md)
- **Output**: `.claude/plan.md` with `## Recommended Resources` (if applicable), `## Additional Roles`, `## Prerequisites verified`, and slices; `.claude/roles-pending.md` DELETED
- **Side Effects**: Write to `.claude/plan.md`; delete `.claude/roles-pending.md`. Delete `.claude/resources-pending.md` per Section 4 FR-2.5 (separate behavior, in force from Section 4).

---

## UC-8: Orchestrator Invokes On-Demand Role via `general-purpose` Subagent Pattern

**Actor**: `/bootstrap-feature` orchestrator (or `/implement-slice` orchestrator, or any pipeline step) -- specifically main Claude running the pipeline and consulting the `## Role invocation plan` at the designated pipeline step
**Preconditions**:
- `.claude/plan.md` exists and contains a `## Additional Roles` top-level section (inlined by planner per UC-7) with a `## Role invocation plan` subsection listing one or more on-demand roles to invoke
- The relevant `~/.claude/agents/ondemand-<slug>.md` file exists on disk with valid YAML frontmatter (delimited by `---` lines) and a non-empty prompt body below the frontmatter
- The orchestrator has reached the pipeline step designated in a call-plan entry (e.g., "Step 4: qa-planner" for `compliance-officer`)
- The orchestrator has the documentation explaining the general-purpose invocation pattern available (from `src/commands/bootstrap-feature.md` per FR-3.4 / AC-4)

**Trigger**: Pipeline reaches a step named in a `## Role invocation plan` call-plan entry -- the orchestrator consults the call plan and needs to invoke an on-demand role at that step

### Primary Flow (Happy Path)

1. The orchestrator reaches the designated step (e.g., Step 4: qa-planner)
2. The orchestrator reads `.claude/plan.md` and locates the `## Role invocation plan` subsection inside `## Additional Roles`
3. The orchestrator iterates the call-plan entries and filters to those scheduled at the current step (here: `ondemand-compliance-officer` at `Step 4: qa-planner`)
4. For each matched entry, the orchestrator resolves the on-demand prompt file path: `~/.claude/agents/ondemand-<slug>.md`
5. The orchestrator reads the on-demand prompt file using the Read tool
6. The orchestrator extracts the prompt BODY by skipping the YAML frontmatter: it locates the opening `---` delimiter and the closing `---` delimiter on subsequent lines, then takes everything AFTER the closing delimiter as the prompt body. The YAML frontmatter (name, description, tools, model, scope) is used only for metadata validation if needed -- it is NOT passed to the spawned subagent
7. The orchestrator spawns a subagent using the Task tool with:
   - `subagent_type`: `general-purpose` (NOT `ondemand-<slug>` -- per FR-3.4 / AC-4 and design decision 7)
   - `prompt`: the extracted prompt body from step 6
   - `description`: a short label such as "invoke ondemand-compliance-officer at Step 4"
8. The spawned subagent runs, performing whatever the on-demand role's prompt body directs (e.g., authoring HIPAA test cases for the compliance-officer role)
9. The subagent returns its output to the orchestrator
10. The orchestrator surfaces the output at the current pipeline step (e.g., concatenates the HIPAA test cases into `docs/qa/<feature>_test_cases.md` alongside the core qa-planner's output, or reports them as a separate addendum depending on the on-demand role's output contract)
11. The orchestrator proceeds to the next pipeline step (or the next call-plan entry at the same step, if multiple)

**Postconditions**:
- The spawned general-purpose subagent produced its output
- The output has been integrated into the pipeline step's results at the designated location
- `~/.claude/agents/ondemand-<slug>.md` has NOT been modified (the orchestrator only READ it)
- The spawned subagent's session is scoped to the on-demand prompt; it did NOT contaminate the main orchestrator's context

**Related FR/AC**: FR-3.4, design decision 7, NFR-11 / AC-2, AC-4

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-8-A1: On-demand role prompt file was manually edited by the user between role-planner run and invocation** -- Between Step 3.75 (role-planner write) and the invocation step (e.g., Step 4 or Step 6), the developer manually edited `~/.claude/agents/ondemand-<slug>.md` (e.g., added project-specific guidance)
  1. The orchestrator reads the file at the invocation step per step 5 of the primary flow
  2. The orchestrator extracts the body AS-IS -- iteration 1 does NOT validate or re-hash the file; it TRUSTS the current on-disk content (per 5.8 item 4)
  3. The spawn proceeds with the user-edited body
  4. The on-demand role produces output reflecting the user's customizations
  5. This is a deliberate iteration-1 trust model (per 5.8 item 4 -- programmatic validation of the call plan is deferred)

**Postconditions (UC-8-A1)**:
- The spawn used the user-edited prompt body
- No error is raised; the user's edits take effect

**Related FR/AC**: FR-3.4, 5.8 item 4

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-8-A2: Call plan designates a pipeline step label the orchestrator does not recognize** -- The call plan entry names a step like "Step 42: nonexistent" because the role-planner emitted an invalid label (prompt drift or bug)
  1. The orchestrator iterates the call plan during each pipeline step
  2. No pipeline step matches "Step 42"
  3. Per 5.8 item 4 (programmatic call-plan validation deferred), the orchestrator silently fails to invoke that role -- no error, no warning, just skip
  4. Downstream the on-demand role is never invoked; its recommended expertise is not applied
  5. The developer reading the plan file may notice the orphan entry but iteration 1 does NOT surface it
  6. Iteration 2 may add schema validation per 5.8 item 4

**Postconditions (UC-8-A2)**:
- The on-demand role is never spawned during this pipeline run
- No error surfaced; the recommendation is effectively lost for this bootstrap

**Related FR/AC**: 5.8 item 4

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-8-E1: On-demand file is missing or corrupted** -- The call plan names `ondemand-compliance-officer` but `~/.claude/agents/ondemand-compliance-officer.md` was deleted (e.g., user manually deleted it) OR the file exists but has malformed YAML frontmatter (missing `---` delimiter, truncated content)
  1. The orchestrator attempts to read `~/.claude/agents/ondemand-compliance-officer.md`
  2. (Missing case) The Read tool returns a file-not-found error; (Corrupted case) the Read succeeds but the frontmatter extraction in step 6 cannot find `---` delimiters or the extracted body is empty
  3. Per Risk 5 and FR-3.4, the orchestrator MUST surface the error (NOT silently continue). The orchestrator logs the error to the developer at the current pipeline step, e.g., "WARNING: could not invoke ondemand-compliance-officer at Step 4 -- prompt file missing or corrupted. Continuing pipeline without this role's input. Regenerate via `/bootstrap-feature` re-run if needed."
  4. The orchestrator does NOT halt the pipeline step; it continues without the on-demand role's output (non-blocking)
  5. The pipeline step completes with a partial result (missing the on-demand role's contribution)
  6. Other on-demand roles scheduled at the same step (if any) are invoked normally

**Postconditions (UC-8-E1)**:
- The error is surfaced to the developer
- The pipeline step completes without the on-demand role's input
- Subsequent pipeline steps proceed

**Related FR/AC**: FR-3.4, Risk 5, 5.8 item 11

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-8-E2: General-purpose spawn fails mid-execution** -- The Task tool spawn succeeds but the general-purpose subagent encounters an error (e.g., tool use failure, context overflow, or self-reported failure)
  1. The orchestrator spawns the general-purpose subagent per the primary flow
  2. The subagent reports failure back to the orchestrator
  3. The orchestrator records the failure at the current pipeline step and surfaces it to the developer
  4. Whether this halts the pipeline depends on the step: for mandatory-to-succeed on-demand roles (e.g., a compliance check that gates merge), the orchestrator may halt; for advisory roles (e.g., an accessibility reviewer whose output enriches but does not gate), the orchestrator continues with a warning
  5. Iteration 1 does NOT formally classify on-demand roles as "gating" vs. "advisory" -- that classification is the on-demand role's own prompt responsibility. The orchestrator treats all on-demand failures as non-blocking by default unless the on-demand role itself signals a hard-stop

**Postconditions (UC-8-E2)**:
- The failure is surfaced
- Pipeline proceeds unless the on-demand role's output explicitly gates

**Related FR/AC**: FR-3.4, Risk 5

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-8-EC1: Multiple on-demand roles at the same pipeline step** -- Two call-plan entries both designate "Step 6: implementation" (e.g., `mobile-dev` and `aws-integration-reviewer` as in UC-4)
  1. The orchestrator iterates the call plan and finds two entries matching the current step
  2. The orchestrator spawns them serially (iteration 1; parallel spawning is orchestrator-implementation-specific and not specified by PRD)
  3. Each spawn follows the general-purpose pattern independently
  4. Failures in one do not halt the other (per UC-8-E2 non-blocking default)
  5. Both outputs are integrated into the step's results

**Related FR/AC**: FR-1.6, FR-3.4

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-8-EC2: On-demand role's own frontmatter `tools` field is respected by the spawn** -- The on-demand prompt file frontmatter declares `tools: ["Read", "Grep"]` (a restricted set)
  1. The orchestrator extracts the prompt body skipping frontmatter
  2. The spawn uses `subagent_type: general-purpose` which has its own tool availability determined by Claude Code's general-purpose contract, NOT by the on-demand role's frontmatter tools field
  3. This is an iteration-1 limitation: the on-demand role's declared tools are documented in its frontmatter for human clarity but are NOT enforced by the general-purpose spawn mechanism. Enforcement would require Claude Code to register the subagent type at session start, which is out of scope per 5.8 item 3
  4. The developer, reading the on-demand prompt, sees the declared tools as the expected scope; if the role's prompt body instructs it to stay within those tools, the subagent's adherence is prompt-driven (not mechanical)
  5. This is a deliberate iteration-1 trade-off

**Related FR/AC**: FR-1.7, FR-3.4, 5.8 item 3, NFR-11

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `.claude/plan.md` (to read the call plan); `~/.claude/agents/ondemand-<slug>.md` (to read the on-demand prompt file)
- **Output**: The output of the spawned general-purpose subagent, integrated into the current pipeline step's results. No direct file writes from the orchestrator in this UC -- the orchestrator only READS and spawns
- **Side Effects**: Task-tool spawn of a general-purpose subagent. No modifications to the on-demand prompt file, no modifications to plan.md from this UC itself (other pipeline steps may write their own files; this UC is solely about the invocation).

---

## UC-9: On-Demand Role Recommendation Would Overlap With Core 16 Agents

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- `docs/PRD.md` describes a feature whose needs map cleanly onto an existing core agent (e.g., "requires thorough code review" maps to `code-reviewer`; "requires test coverage analysis" maps to `test-writer`)
- The agent prompt at `src/agents/role-planner.md` contains an enumeration of the 16 core agents and their responsibilities (per FR-4.2 / AC-19)
- All other UC-1 preconditions hold

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a feature that might tempt a naive planner to generate an ondemand role that duplicates a core agent

### Primary Flow (Happy Path)

1. The agent reads inputs per FR-1.2
2. The agent considers a candidate role (e.g., `test-coverage-analyst`) that would measure test coverage and report gaps
3. The agent applies FR-1.8 CORE-VS-ON-DEMAND heuristic by enumerating the 16 core agents verbatim (per FR-4.2 / AC-19): `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`
4. The agent identifies >50% responsibility overlap with `test-writer` (which owns TDD tests and coverage) and `code-reviewer` (which owns code quality checks including test coverage review in Phase 4)
5. Per FR-1.8, the agent MUST NOT emit a recommendation that duplicates core scope. The agent has two options:
   - Drop the recommendation entirely (typical choice)
   - Merge the concern into the call plan for the existing core agent as a context note (not a new role): e.g., "Note: the PRD emphasizes test-coverage measurement; the core `test-writer` and `code-reviewer` collectively cover this -- no on-demand role is needed"
6. The agent chooses to drop the recommendation and does NOT create `ondemand-test-coverage-analyst.md`
7. The agent proceeds with whatever genuine domain gaps exist (if any). If no genuine gap exists, UC-5 "No additional roles required" path applies

**Postconditions**:
- No `ondemand-<slug>.md` is created for a core-duplicating concern
- `.claude/roles-pending.md` either has the explicit "No additional roles required" (UC-5 path) or contains other genuine recommendations (UC-1/UC-2/UC-3/UC-4 paths) -- but never has a core-duplicating recommendation

**Related FR/AC**: FR-1.8, FR-4.2, FR-4.5 / AC-19

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-9-A1: Borderline overlap (<=50%) -- agent proceeds with the recommendation** -- The candidate role overlaps with a core agent but only partially (e.g., `ios-accessibility-reviewer` overlaps with `code-reviewer` on code quality but has deep iOS-specific accessibility expertise that goes beyond `code-reviewer`'s baseline)
  1. Steps 1-3 proceed as in the primary flow
  2. At step 4 the agent calculates the overlap as ~30% (the iOS-accessibility-specific expertise is additive, not duplicative)
  3. Per FR-1.8 (overlap >50% drops; <=50% may proceed), the agent emits the `ondemand-ios-accessibility-reviewer` recommendation
  4. The `Why` field (FR-1.4) explicitly articulates the non-overlapping portion: "PRD FR-3.2 requires WCAG 2.2 AA iOS VoiceOver compliance -- the core `code-reviewer` handles baseline code quality but does NOT own iOS-specific accessibility patterns (VoiceOver rotors, Dynamic Type, Reduce Motion). The ios-accessibility-reviewer covers the iOS-specific layer, additive to `code-reviewer`"

**Postconditions (UC-9-A1)**:
- The recommendation proceeds
- The Why field explicitly disambiguates overlap

**Related FR/AC**: FR-1.4 (Why field), FR-1.8

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-9-E1: Agent prompt is missing the core-16 enumeration (prompt drift)** -- A future refactor accidentally removes the FR-4.2 / AC-19 enumeration from `src/agents/role-planner.md`
  1. The agent cannot apply FR-1.8 properly without the enumeration
  2. The agent MAY emit an over-recommendation (e.g., `test-coverage-analyst` that duplicates `test-writer`)
  3. This is NOT a runtime error -- the Plan Critic (per FR-6.9) MAY flag malformed or duplicative recommendations as MINOR in a future iteration, but iteration 1 has no programmatic enforcement
  4. AC-19 is a verification point: the agent prompt MUST contain the enumeration; CI/tests MAY assert this via grep

**Postconditions (UC-9-E1)**:
- The pipeline proceeds even if a recommendation is problematic; AC-19 enforcement happens during install/PR review, not at bootstrap time

**Related FR/AC**: FR-4.2 / AC-19, FR-6.9

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-9-EC1: Candidate role is a "helper" or "utility" role aggregating multiple core responsibilities** -- The agent considers a role like `meta-reviewer` that would unify code-reviewer + security-auditor + verifier
  1. Per FR-4.5, the agent MUST NOT emit workflow-structural roles. `meta-reviewer` collapses multiple core agents into one -- prohibited
  2. The agent drops the candidate and proceeds

**Related FR/AC**: FR-4.5

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: Same as UC-1
- **Output**: Usually same as UC-5 (no roles created for this concern), or same as UC-1/UC-2/UC-3/UC-4 if other genuine gaps exist
- **Side Effects**: Zero to N file writes depending on other genuine recommendations. The key property is: no ondemand file is created for a concern that duplicates core scope.

---

## UC-10: On-Demand Role Recommendation at the Resource-Architect Boundary

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75
**Preconditions**:
- `docs/PRD.md` describes a feature requiring AWS expertise (e.g., "FR-5.1 uses AWS Lambda + DynamoDB + SQS")
- `.claude/resources-pending.md` from Step 3.5 contains a Cloud/Compute recommendation for AWS infrastructure (EC2/Lambda/etc.) produced by `resource-architect`
- The agent prompt at `src/agents/role-planner.md` explicitly documents the FR-4.3 boundary (per AC-18): role-planner covers ROLES, resource-architect covers EXTERNAL RESOURCES including cloud infrastructure
- All other UC-1 preconditions hold

**Trigger**: `/bootstrap-feature` reaches Step 3.75 for a feature where the domain is "AWS-adjacent" -- the boundary between role-planner's scope (roles) and resource-architect's scope (resources) must be handled precisely

### Primary Flow (Happy Path)

1. The agent reads inputs per FR-1.2, including the `.claude/resources-pending.md` content (which already contains the AWS infrastructure recommendation)
2. The agent considers what AWS-related ROLE (not resource) is needed. Options:
   - `aws-solutions-architect`: sounds like overlap with `architect`, which is a core agent -- rejected per FR-1.8
   - `aws-integration-reviewer`: reviews AWS-specific design choices (Lambda vs. Fargate, DynamoDB single-table vs. multi-table, SQS FIFO vs. standard) during implementation. Does NOT provision resources. This is role scope, not resource scope
   - `iac-author`: authors Terraform/CDK manifests to SPIN UP the AWS resources. This CROSSES the boundary -- IaC authorship is resource-provisioning wrapped in a script, still resource-architect's concern per FR-4.3
3. The agent applies FR-4.3 strictly:
   - ROLE-PLANNER'S SCOPE: recommending an on-demand role that REVIEWS AWS design choices (`aws-integration-reviewer`). The role reads PRs/slices, notes AWS anti-patterns, suggests improvements -- pure review, no provisioning
   - RESOURCE-ARCHITECT'S SCOPE: recommending the AWS infrastructure itself (already done at Step 3.5, captured in `.claude/resources-pending.md` -- AWS compute resource names, activation commands)
4. The agent emits the `aws-integration-reviewer` recommendation per FR-1.4:
   - Role title: `AWS Integration Reviewer`
   - Slug: `aws-integration-reviewer`
   - Why: "PRD FR-5.1 uses AWS Lambda + DynamoDB + SQS. `resource-architect` at Step 3.5 recommended the AWS resources (see `.claude/resources-pending.md` Cloud/Compute section). This role reviews the DESIGN of AWS integrations during implementation -- NOT the resource provisioning which is resource-architect's scope per FR-4.3"
   - Pipeline step to invoke: `Step 6: implementation`
   - Purpose at that step: "Reviews each slice's AWS-specific design (Lambda sizing, DynamoDB access patterns, SQS message-handling) during implementation, alongside the core `code-reviewer`. Does NOT modify AWS resources; delegates provisioning to developer-applied resource-architect output"
5. The agent does NOT emit `iac-author` (that would cross into resource-architect's scope). If IaC manifest authoring is required, the developer consumes the resource-architect's Install/activate command and applies it manually; a future iteration could extend resource-architect to author IaC manifests but that is out of scope
6. The agent adds an explicit boundary annotation in the `## Additional Roles` body per AC-18: "Boundary note: this role is AWS DESIGN REVIEW. The AWS infrastructure itself is recommended by `resource-architect` in `.claude/resources-pending.md`. The two scopes are disjoint per FR-4.3."
7. The agent writes the on-demand prompt `~/.claude/agents/ondemand-aws-integration-reviewer.md` with a prompt body that EXPLICITLY disclaims resource-provisioning authority in its own authority-boundary section
8. Standard UC-1 steps 9-13 proceed

**Postconditions**:
- `~/.claude/agents/ondemand-aws-integration-reviewer.md` exists with a prompt body whose authority boundary explicitly disclaims AWS resource provisioning
- The `## Additional Roles` body includes the boundary annotation per AC-18
- `.claude/resources-pending.md` is unchanged (role-planner does NOT modify resource-architect's output per FR-5.2 through FR-5.8)

**Related FR/AC**: FR-4.3, FR-4.4, FR-5.2 through FR-5.8, Risk 3 / AC-18

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-10-A1: PRD blurs the line -- describes "AWS solutions architect" as the desired role name** -- The PRD uses vendor terminology that could signal a broader role
  1. The agent reads the PRD wording
  2. The agent detects that "AWS solutions architect" terminology conflates review + provisioning + overall architecture -- the term is too broad
  3. The agent decomposes:
     - Overall architecture review = core `architect` (already covered)
     - AWS provisioning = `resource-architect`'s Cloud/Compute recommendation (already covered at Step 3.5)
     - AWS DESIGN review during implementation = on-demand `aws-integration-reviewer` (the genuine gap)
  4. The agent emits only the `aws-integration-reviewer` role, not a monolithic "solutions architect" role, and documents the decomposition in the Why field

**Postconditions (UC-10-A1)**:
- The emitted role is precise and does not cross scope boundaries

**Related FR/AC**: FR-1.4, FR-1.8, FR-4.3

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-10-E1: `.claude/resources-pending.md` lacks the AWS recommendation even though the PRD requires AWS** -- Either the resource-architect missed the AWS requirement, or the resources file is incomplete
  1. The agent reads `.claude/resources-pending.md` and sees no Cloud/Compute AWS entry
  2. The agent MUST NOT attempt to fill the gap by recommending the AWS infrastructure itself (that would violate FR-4.3)
  3. The agent MAY note the observation in the `## Additional Roles` body with the "OBSERVATION:" prefix per FR-4.4: "OBSERVATION: PRD FR-5.1 requires AWS but `.claude/resources-pending.md` lacks an AWS Cloud/Compute recommendation. This may be an omission by `resource-architect`. Role-planner cannot fill this gap per FR-4.3 -- the developer may need to re-invoke resource-architect or the boundary may need review."
  4. The agent still emits the `aws-integration-reviewer` role recommendation (the role scope is role-planner's regardless of resource-architect's completeness)
  5. The observation surfaces the resource-architect gap to the human developer without role-planner overstepping

**Postconditions (UC-10-E1)**:
- `## Additional Roles` body contains the OBSERVATION annotation
- The on-demand role is still recommended
- No cross-scope violation occurred

**Related FR/AC**: FR-4.3, FR-4.4

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-10-EC1: A role candidate could legitimately produce BOTH role-type AND resource-type outputs** -- E.g., a hypothetical "database-migration-author" that writes both the migration script (resource-adjacent) AND reviews the schema design (role-adjacent)
  1. The agent splits the concern: the SCRIPT AUTHORSHIP is a resource-architect concern (or a core `test-writer` + developer responsibility in the normal slice flow); the SCHEMA REVIEW is a role-adjacent concern
  2. The agent emits at most a review-focused role (e.g., `schema-migration-reviewer`) that reviews migrations, NOT a monolithic role that authors migrations
  3. The boundary is preserved by refusing to emit roles that span both scopes

**Related FR/AC**: FR-4.3, FR-4.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: Same as UC-1; critical additional input is `.claude/resources-pending.md` content
- **Output**: Same as UC-1 with strictly role-scoped recommendations; no resource-provisioning recommendations
- **Side Effects**: Writes limited to `.claude/roles-pending.md` and `~/.claude/agents/ondemand-<slug>.md` files. No modification of `.claude/resources-pending.md`, no direct infrastructure-related file creation.

---

## UC-11: Idempotency Across Re-Bootstrap (User Aborts and Restarts)

**Actor**: `role-planner` agent, invoked by `/bootstrap-feature` at Step 3.75 during a re-run
**Preconditions**:
- A prior invocation of `/bootstrap-feature` for the same feature/branch was aborted or restarted, leaving:
  - `.claude/roles-pending.md` possibly on disk (if the previous run reached Step 3.75 but did not reach the planner's Step 5 inlining step that deletes the temp file)
  - `~/.claude/agents/ondemand-<slug>.md` files possibly on disk from the previous run
- The current bootstrap begins; the git working tree may or may not be clean
- The agent's preconditions from UC-1 hold

**Trigger**: `/bootstrap-feature` is invoked for the same feature on the same branch after a previous aborted/restarted bootstrap

### Primary Flow (Happy Path)

1. `/bootstrap-feature` reaches Step 3.75 and delegates to `role-planner`
2. The agent reads its five inputs per FR-1.2
3. The agent detects `.claude/roles-pending.md` exists with stale content from the previous run
4. Per FR-2.4 (same pattern as Section 4 FR-2.4), the agent OVERWRITES `.claude/roles-pending.md` with fresh content. Stale content is NOT appended, NOT merged, NOT preserved
5. The agent analyzes the current feature's PRD + use-cases + architect verdict + resources + CLAUDE.md (per FR-1.2) and formulates recommendations, which may differ from the prior run's recommendations if the PRD/use-cases/verdict evolved between runs
6. The agent writes on-demand prompt files per FR-2.5 -- existing files are OVERWRITTEN with the current run's content (regardless of prior content or user edits). Files whose slug is no longer recommended in the current run remain on disk (iteration 1 has no orphan-detection -- per 5.8 item 9)
7. The agent writes the fresh `.claude/roles-pending.md`
8. The agent returns control; bootstrap proceeds to Step 4
9. Planner at Step 5 inlines and deletes `.claude/roles-pending.md` per UC-7

**Postconditions**:
- `.claude/roles-pending.md` contains ONLY the current run's recommendations (no leftover content from prior runs)
- `~/.claude/agents/ondemand-<slug>.md` files for currently-recommended slugs are freshly written
- `~/.claude/agents/ondemand-<slug>.md` files for slugs no longer recommended in the current run still exist on disk (not garbage-collected per 5.8 item 9)

**Related FR/AC**: FR-2.4, FR-2.5, NFR-10, 5.8 item 9 / AC-11, AC-12, AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-11-A1: PRD scope narrowed between runs -- some prior roles no longer needed** -- The first run generated `ondemand-mobile-dev.md` and `ondemand-compliance-officer.md`. Between runs the developer narrowed the PRD to remove the compliance-touching requirements. The current run should NOT recommend `compliance-officer`
  1. The agent analyzes the NARROWED PRD
  2. The agent recommends only `mobile-dev` (not compliance-officer)
  3. The agent OVERWRITES `~/.claude/agents/ondemand-mobile-dev.md` with the current run's version
  4. The agent does NOT touch `~/.claude/agents/ondemand-compliance-officer.md` -- that file remains on disk with stale content from the prior run but is not referenced by the current run's call plan
  5. The orphan file does NOT break anything; the orchestrator only invokes roles named in the current plan's `## Role invocation plan` subsection
  6. The developer MAY manually delete the orphan (per 5.8 item 1 -- teardown is manual in iteration 1)

**Postconditions (UC-11-A1)**:
- Current run's roles are correctly written
- Stale orphan files persist but do not affect the current run
- Developer has the option to manually clean up orphans

**Related FR/AC**: FR-2.5, NFR-10, 5.8 items 1, 9

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-11-E1: `.claude/roles-pending.md` exists but is corrupted (not valid markdown or truncated)** -- The prior run was killed mid-write, leaving a partial file
  1. The agent detects the file exists
  2. The agent does NOT need to parse the prior content -- it overwrites per FR-2.4 regardless of validity
  3. The write succeeds with fresh, valid content
  4. No error is raised

**Postconditions (UC-11-E1)**:
- The stale corruption is resolved by overwrite
- Current run's content is valid

**Related FR/AC**: FR-2.4

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-11-EC1: User runs `/bootstrap-feature` twice in quick succession** -- E.g., the user accidentally double-triggers the command
  1. Per Risk 11 (on-demand filename namespace collision), iteration 1 assumes single-pipeline-at-a-time. Concurrent runs could race
  2. Iteration 1 does NOT lock the `.claude/roles-pending.md` or the `~/.claude/agents/ondemand-<slug>.md` files
  3. The behavior is unspecified but typically: whichever run writes last wins for each file
  4. The developer is expected to run one bootstrap at a time; if both bootstraps complete, the second overwrites the first's temp file and prompt files per FR-2.4 and FR-2.5

**Related FR/AC**: FR-2.4, FR-2.5, Risk 11

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: Same as UC-1, plus possibly-stale `.claude/roles-pending.md` and/or prior `~/.claude/agents/ondemand-<slug>.md` files
- **Output**: Fresh `.claude/roles-pending.md`; overwritten `~/.claude/agents/ondemand-<slug>.md` files for currently-recommended slugs
- **Side Effects**: Overwrite semantics for two file targets. Stale orphan files persist (no garbage collection).

---

## UC-12: Plan Critic Recognizes `## Additional Roles` Section

**Actor**: Plan Critic subagent, invoked per the CLAUDE.md Plan Critic Pass rules AFTER `planner` has written `.claude/plan.md`
**Preconditions**:
- `.claude/plan.md` exists with a `## Additional Roles` top-level section (inlined by planner per UC-7) OR without such a section (legacy plans)
- The Plan Critic prompt in `src/claude.md` has been updated per FR-6.9 / AC-17 to recognize `## Additional Roles` as a valid plan section
- The existing Section 4 FR-6.7 bullet for `## Recommended Resources` is preserved

**Trigger**: The user invokes `ExitPlanMode` during plan-mode planning, triggering the mandatory Plan Critic pass; OR a non-plan-mode critic pass is run against a completed plan file

### Primary Flow (Happy Path)

1. The Plan Critic subagent reads `.claude/plan.md`
2. The critic observes the top-level sections in order: `## Recommended Resources` (possibly), `## Additional Roles` (possibly), `## Prerequisites verified`, and slices
3. Per the updated Plan Critic prompt, the critic RECOGNIZES `## Additional Roles` as a valid top-level section produced by `role-planner` at bootstrap Step 3.75
4. The critic does NOT flag the PRESENCE of `## Additional Roles` as a finding (same pattern as `## Recommended Resources` from Section 4 FR-6.7)
5. The critic does NOT flag the ABSENCE of `## Additional Roles` as a finding (legacy plans lack the section per NFR-2 backward compat; plans where role-planner emitted "No additional roles required" are valid)
6. The critic MAY flag MALFORMED per-role blocks missing any of the five FR-1.4 fields as MINOR (per NFR-8) -- not CRITICAL, not MAJOR
7. The critic MAY flag INCONSISTENT slugs between the `## Additional Roles` body and the `## Role invocation plan` subsection as MINOR (orphan slug in one without matching entry in the other)
8. The critic continues its other usual checks (completeness, slice quality, file path verification, architecture, security, edge cases, scope reduction, wave assignment) unrelated to `## Additional Roles`
9. The critic returns findings in the usual FINDINGS/VERIFIED format

**Postconditions**:
- Plan Critic findings are free of false positives about `## Additional Roles` presence or absence
- Any malformed role blocks surface as MINOR findings only
- Existing critic behavior for `## Recommended Resources` is unchanged

**Related FR/AC**: FR-6.9, NFR-8 / AC-17

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-12-A1: Plan has `## Additional Roles` but the inlining misplaced it (appears after `## Prerequisites verified` instead of before)** -- A planner bug caused the section to be inlined in the wrong position
  1. The critic observes the section order: `## Recommended Resources` -> `## Prerequisites verified` -> `## Additional Roles` -> slices
  2. Per FR-2.7 / AC-10 the correct order is: `## Recommended Resources` -> `## Additional Roles` -> `## Prerequisites verified` -> slices
  3. The critic MAY flag the misplacement as MINOR (iteration 1 does not escalate to MAJOR or CRITICAL for section-ordering; that calibration may shift in iteration 2)

**Postconditions (UC-12-A1)**:
- Misplacement is flagged as MINOR

**Related FR/AC**: FR-2.7, FR-6.9 / AC-10

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-12-E1: Plan Critic prompt was NOT updated (FR-6.9 / AC-17 implementation missed)** -- A future refactor forgets to update the critic prompt
  1. The critic reads the plan and observes `## Additional Roles`
  2. Because the critic prompt lacks the recognition bullet, it may flag `## Additional Roles` as an unexpected section (CRITICAL or MAJOR per its usual posture)
  3. This is a false-positive finding caused by missed implementation
  4. AC-17 is a verification point: the critic prompt MUST recognize `## Additional Roles`. CI/tests / installer MAY assert this via grep over `src/claude.md`

**Postconditions (UC-12-E1)**:
- False-positive findings occur until AC-17 is implemented

**Related FR/AC**: FR-6.9 / AC-17

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-12-EC1: Plan has both `## Recommended Resources` and `## Additional Roles`, both with malformed entries** -- Both sections have missing fields
  1. Per Section 4 FR-6.7, malformed `## Recommended Resources` entries are MINOR
  2. Per FR-6.9 and NFR-8, malformed `## Additional Roles` entries are MINOR
  3. The critic emits two separate MINOR findings (one per section); they do NOT compound to MAJOR

**Related FR/AC**: NFR-8, FR-6.9, Section 4 FR-6.7

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `.claude/plan.md`; the updated Plan Critic prompt in `src/claude.md`
- **Output**: Critic findings (FINDINGS/VERIFIED format) with correct classification of `## Additional Roles` observations
- **Side Effects**: None; Plan Critic is a read-only subagent.

---

## UC-13: Developer Manually Deletes On-Demand Files Post-Feature

**Actor**: Developer (SDLC user)
**Preconditions**:
- One or more `~/.claude/agents/ondemand-<slug>.md` files exist from completed or aborted features
- The developer has decided the on-demand roles are no longer useful and wants to clean up
- Iteration 1 has no automatic teardown (per 5.8 item 1) and no garbage collection (per 5.8 item 9)

**Trigger**: The developer manually runs `rm ~/.claude/agents/ondemand-<slug>.md` or uses a file manager to delete the files -- entirely OUTSIDE the SDLC pipeline

### Primary Flow (Happy Path)

1. The developer identifies the on-demand files to delete (e.g., `ondemand-legacy-thing.md`)
2. The developer deletes the files using any method (rm, GUI, etc.)
3. The next feature's `/bootstrap-feature` invocation runs normally
4. If the next feature's `role-planner` does NOT recommend the deleted slugs, the deletion is final and has no downstream effect
5. If the next feature's `role-planner` DOES recommend a previously-deleted slug, it regenerates the file fresh per FR-2.5 (overwrite if exists, create if not -- the "create" path handles the deleted case)
6. The pipeline is unaffected; the developer's manual action is safe

**Postconditions**:
- Deleted files do NOT exist
- Subsequent features work normally; if a deleted slug is re-recommended, the file is regenerated

**Related FR/AC**: FR-2.5, FR-2.8, NFR-10, 5.8 items 1, 9 / AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-13-A1: Developer deletes an on-demand file MID-FEATURE (between Step 3.75 and the invocation step)** -- The developer, perhaps confused about what the file is for, deletes `~/.claude/agents/ondemand-compliance-officer.md` during Step 4
  1. At the invocation step (e.g., Step 4), the orchestrator attempts to read the file and fails (file not found)
  2. Per UC-8-E1, the orchestrator surfaces the error and continues without the on-demand role's input
  3. The pipeline proceeds; the on-demand role's contribution is lost for this feature
  4. If the developer realizes the mistake, they may re-run `/bootstrap-feature` to regenerate the file, but that also restarts bootstrap (not ideal)
  5. Iteration 1 does NOT provide a "regenerate just the missing on-demand files" command; that is out of scope

**Postconditions (UC-13-A1)**:
- Pipeline completes without the on-demand role's output
- Error is surfaced (non-blocking)

**Related FR/AC**: UC-8-E1, Risk 5

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-13-E1: Developer accidentally deletes a CORE agent file (e.g., `~/.claude/agents/code-reviewer.md` without the `ondemand-` prefix)** -- Deletion falls outside role-planner's scope but is worth documenting as a known failure mode
  1. The core agent file is now missing
  2. Any pipeline invocation expecting `code-reviewer` will fail to find the subagent type's registration
  3. The resolution is for the developer to re-run `install.sh`, which re-copies `src/agents/*.md` into `~/.claude/agents/`
  4. role-planner itself is unaffected -- role-planner has no authority to modify core agents per FR-5.2 and would not have caused this. Documentation here is for completeness only

**Postconditions (UC-13-E1)**:
- Pipeline broken until `install.sh` is re-run
- Post `install.sh` re-run: core agents are restored; on-demand files are unaffected (install.sh does not touch `ondemand-*.md`)

**Related FR/AC**: FR-5.2, FR-6.8 / AC-9

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-13-EC1: Developer deletes ALL on-demand files at once** -- The developer clears out `~/.claude/agents/ondemand-*.md` in one operation
  1. All deletions succeed
  2. The next feature bootstraps normally; any recommended on-demand roles are freshly generated
  3. No adverse effect; iteration 1's stateless-per-feature model tolerates this

**Related FR/AC**: FR-2.5, FR-2.8, NFR-10

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: None (developer action outside the pipeline)
- **Output**: None (file deletions are the action)
- **Side Effects**: Filesystem changes at `~/.claude/agents/ondemand-*.md`. Pipeline is NOT invoked as part of this UC; subsequent pipeline runs observe the new state.

---

## Summary of PRD FR Coverage

| Requirement | Covered in |
|-------------|-----------|
| FR-1.1 (agent file exists with correct frontmatter) | UC-1 Precondition, AC-1 / AC-14 |
| FR-1.2 (input reading order, scratchpad exclusion) | UC-1, UC-2, UC-3, UC-4, UC-5 Primary Flow step 1; UC-2-E1 (graceful absence); UC-3-E1 (missing verdict) |
| FR-1.3 (three-artifact output, slug self-consistency) | UC-1, UC-2, UC-4 Primary Flow; AC-16 |
| FR-1.4 (five fields per role) | UC-1, UC-2, UC-3, UC-4 Primary Flow step 4/5; AC-15 |
| FR-1.5 (explicit "No additional roles required") | UC-5; AC-11 |
| FR-1.6 (summary line with counts) | UC-1, UC-2, UC-3, UC-4, UC-5 Primary Flow |
| FR-1.7 (on-demand prompt file structure) | UC-1 Primary Flow step 8; UC-4 Primary Flow step 10 |
| FR-1.8 (CORE-VS-ON-DEMAND heuristic) | UC-1 Primary Flow step 4; UC-9; UC-9-A1; UC-10 |
| FR-2.1 (write target is `.claude/roles-pending.md`) | UC-1, UC-5 Primary Flow |
| FR-2.2 (temp file structure) | UC-1 Primary Flow step 7; UC-5 Primary Flow step 5 |
| FR-2.3 (on-demand prompt write target) | UC-1, UC-2, UC-4 Primary Flow |
| FR-2.4 (overwrite temp file) | UC-11 Primary Flow; UC-11-E1 |
| FR-2.5 (overwrite on-demand files) | UC-6; UC-2-A1; UC-11; UC-11-A1 |
| FR-2.6 (planner inlines and deletes temp file) | UC-7 Primary Flow; UC-7-E1 (silent skip); UC-7-E2 (delete failure); AC-5, AC-13 |
| FR-2.7 (section ordering in plan.md) | UC-7 Primary Flow step 5; UC-7-A1 (no resources); UC-12-A1 (misplacement); AC-10 |
| FR-2.8 (persistence across sessions) | UC-13; AC-13 |
| FR-3.1 (bootstrap-feature Step 3.75 insertion) | UC-1 Primary Flow step 11; UC-8 Precondition; AC-2, AC-10 |
| FR-3.2 (step is mandatory, non-skippable) | UC-5 (still runs when no roles needed); AC-3 |
| FR-3.3 (failure halts bootstrap) | UC-1-E1; UC-4-E1; UC-5-E1; AC-3 |
| FR-3.4 (general-purpose invocation pattern) | UC-8 Primary Flow; UC-8-A1, UC-8-A2, UC-8-E1, UC-8-E2, UC-8-EC2; AC-2, AC-4 |
| FR-3.5 (planner updated per FR-2.6) | UC-7 Precondition and Primary Flow; AC-5 |
| FR-3.6 (step-number consistency) | UC-1 Primary Flow; AC-10 |
| FR-3.7 (develop-feature inherits) | Implicit via UC-1 Trigger; no separate UC needed |
| FR-4.1 (positive-example domains) | UC-1 (mobile), UC-2 (compliance), UC-3 (research) |
| FR-4.2 (core-agent enumeration) | UC-1 Primary Flow step 4; UC-9 Primary Flow step 3; UC-9-E1; AC-19 |
| FR-4.3 (no external resource recommendations) | UC-3-A1; UC-4; UC-4-A1; UC-10; UC-10-A1; UC-10-E1; AC-18 |
| FR-4.4 (no core-agent modifications; OBSERVATION prefix) | UC-5-A1; UC-10-E1 |
| FR-4.5 (no helper/utility/meta roles) | UC-9-EC1 |
| FR-4.6 (one role per distinct domain) | UC-4 Primary Flow step 4; UC-4-EC1 |
| FR-4.7 (conservative 0-3 recommendations) | UC-4 Primary Flow step 5; UC-4-EC1 |
| FR-5.1 (explicit Authority Boundary section) | UC-1 Precondition (agent frontmatter) |
| FR-5.2 (no core-agent file modification) | UC-1 Primary Flow step 9; UC-13-E1 |
| FR-5.3 (no settings.json modification) | UC-1 Primary Flow step 9 |
| FR-5.4 (no MCP config modification) | UC-1 Primary Flow step 10 |
| FR-5.5 (no secrets modification) | UC-1 Primary Flow step 9 |
| FR-5.6 (no network) | UC-1 Primary Flow step 10; UC-3 Primary Flow step 8 |
| FR-5.7 (tools frontmatter excludes Bash/Edit/WebFetch/WebSearch/NotebookEdit) | UC-1 Precondition; AC-14 |
| FR-5.8 (write target restriction) | UC-1 Primary Flow step 9; UC-1-E1; UC-4-E1 |
| FR-6.1 (Agency Roles table updated) | Referenced in Preconditions of all UCs (installation prerequisite); AC-6 |
| FR-6.2 (prose 15->16 update) | Referenced in Preconditions; AC-6 |
| FR-6.3/6.4 (README tagline, heading) | Referenced in Preconditions; AC-7 |
| FR-6.5 (README agent table row) | Referenced in Preconditions; AC-7 |
| FR-6.6 (README feature section) | Referenced in Preconditions; AC-7 |
| FR-6.7 (install.sh banners) | Referenced in Preconditions; AC-8 |
| FR-6.8 (install.sh glob copy) | UC-1 Precondition; AC-9 |
| FR-6.9 (Plan Critic recognition) | UC-7-EC1; UC-12; UC-12-A1; UC-12-E1; UC-12-EC1; AC-17 |
| FR-6.10 (no templates/rules/ addition) | Referenced implicitly via Precondition set |
| NFR-1 (markdown-only, no runtime code) | Implicit across all UCs |
| NFR-2 (backward compat) | UC-7-E1; UC-12 |
| NFR-3 (take effect after install.sh re-run) | UC-1 Precondition |
| NFR-4 (opus model) | UC-1 Precondition; AC-1 |
| NFR-5 (15->16 count) | Referenced in Preconditions |
| NFR-6 (no network) | UC-1 Primary Flow step 10; UC-3 |
| NFR-7 (<30s runtime) | Implicit; no UC-level failure mode but mentioned in Risk 8 |
| NFR-8 (strict five-field format) | UC-12; UC-12-EC1 |
| NFR-9 (one-shot per bootstrap) | UC-11 |
| NFR-10 (persistence, no GC) | UC-6; UC-11; UC-13 |
| NFR-11 (session-safe general-purpose pattern) | UC-8 Primary Flow |
| AC-1 through AC-20 | All referenced in per-UC Related FR/AC lines |

---

## Out-of-Scope Items (explicitly NOT covered per 5.8)

The following items are intentionally NOT covered by any use case because the PRD marks them as out of scope for iteration 1:

1. Automatic teardown of on-demand files after merge (5.8 item 1)
2. Cross-feature reuse optimization (5.8 item 2)
3. Claude Code session re-registration of on-demand subagent types (5.8 item 3)
4. Programmatic validation of the call plan (5.8 item 4) -- UC-8-A2 documents the silent-skip consequence
5. Role-planner recommending changes to core agent prompts (5.8 item 5)
6. Merge-ready re-check of role needs (5.8 item 6)
7. Role-planner -> resource-architect feedback loop (5.8 item 7)
8. On-demand role quality learning (5.8 item 8)
9. Automatic garbage collection of stale on-demand files (5.8 item 9) -- UC-11-A1 and UC-13 document the manual-cleanup consequence
10. Feature-scoped on-demand filename namespacing (5.8 item 10) -- UC-6-EC1 documents the single-namespace consequence
11. Programmatic validation that on-demand prompts do not self-claim Bash (5.8 item 11) -- UC-8-EC2 documents the trust-model consequence
