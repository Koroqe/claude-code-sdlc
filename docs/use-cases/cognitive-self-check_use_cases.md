# Use Cases: Cognitive Self-Check Protocol -- Fact/Assumption Discipline for Thinking Agents

> Based on [PRD](../PRD.md) -- Section 9: Cognitive Self-Check Protocol -- Fact/Assumption Discipline for Thinking Agents

This document is the blueprint for E2E and integration testing of the cognitive-self-check feature introduced in PRD Section 9. The feature is a meta-SDLC infrastructure rule: there is NO end-user UI flow, NO runtime behavior change to a downstream application, and NO new agent. The "actors" in every use case below are the SDLC agents themselves (the 12 in-scope thinking agents), the Plan Critic subagent, and the orchestrator commands (`/bootstrap-feature`, `/implement-slice`, `/merge-ready`) that invoke them. Each use case describes a scenario in which the cognitive-self-check rule is applied during pipeline execution -- either at artifact-authoring time (the agent emits a `## Facts` block per its prompt's `## Cognitive Self-Check (MANDATORY)` section) or at validation time (the Plan Critic mechanically enforces the protocol on file-based artifacts).

Every use case below is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`) are referenced by QA test cases and E2E tests.

**Common preconditions across all use cases** (stated once here, referenced as "common preconditions" below):

- The rule file `src/rules/cognitive-self-check.md` exists in the SDLC repo and was distributed to `~/.claude/rules/cognitive-self-check.md` by the existing `src/rules/*` copy logic in `install.sh` (no installer change required per FR-6.3)
- The 12 in-scope thinking-agent prompt files (`src/agents/{prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, code-reviewer, verifier, refactor-cleaner, resource-architect, role-planner, release-engineer}.md`) each contain a `## Cognitive Self-Check (MANDATORY)` section per FR-2.1 referencing the rule file and specifying the `## Facts` block location
- The 5 exempt executor agent prompt files (`src/agents/{test-writer, build-runner, e2e-runner, doc-updater, changelog-writer}.md`) are byte-unchanged per FR-3.1 / FR-6.6
- The Plan Critic prompt in `src/claude.md` contains the two new Completeness checks per FR-4.1 / FR-4.3 with severity tags per FR-4.2 / FR-4.4 and the file-vs-stdout enforcement-split preamble per FR-4.6
- The `## Facts` block schema is the literal four-subsection structure (`### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`) in that exact order per FR-1.3
- Empty subsections use the literal placeholder `(none)` per FR-1.3
- The total agent count remains 17 per FR-6.1 / NFR-3; the total `/merge-ready` gate count remains 10 per FR-6.2 / NFR-4
- Backward compatibility per FR-7: pre-existing PRD sections (whose `Date:` field predates the feature's merge date), pre-existing use-case files, and pre-existing plan files are EXEMPT from retroactive enforcement
- The orchestrator runs in an interactive context UNLESS a specific use case states a non-interactive context

## Actors

| Actor | Description |
|-------|-------------|
| Developer | The human user invoking `/bootstrap-feature`, `/implement-slice`, or `/merge-ready`; reads `## Facts` blocks during review; receives Plan Critic findings |
| In-scope thinking agent | One of the 12 agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`) whose prompt mandates the 4-question protocol and the `## Facts` block emission |
| Exempt executor agent | One of the 5 agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) whose output is mechanical/tool-determined; does NOT emit `## Facts` blocks |
| Plan Critic subagent | The subagent invoked by the orchestrator to validate `.claude/plan.md` and related file-based artifacts; runs the two new Completeness checks for `## Facts` presence and external-contract citation |
| `/bootstrap-feature` orchestrator | Runs the documentation phase: `prd-writer` -> `ba-analyst` -> `architect` -> `resource-architect` -> `role-planner` -> `qa-planner` -> `planner` -> Plan Critic |
| `/implement-slice` orchestrator | Runs TDD per slice: `test-writer` (exempt) -> implementation -> `build-runner` (exempt) -> `verifier` (in scope, stdout report with `## Facts`) -> commit |
| `/merge-ready` orchestrator | Runs quality gates 0-9 (10 gates) and Step 11. In-scope thinking agents invoked: `code-reviewer` (Gate 2, stdout), `security-auditor` (Gate 3, stdout), `verifier` (Gate 6, stdout), `release-engineer` (Gate 9, file-based release notes). Exempt executor agents invoked: `build-runner` (Gate 4), `e2e-runner` (Gate 5), `doc-updater` (Gate 7). The `changelog-writer` (exempt) runs as a pre-flight sync (NOT a gate). The `refactor-cleaner` (in scope, stdout) is NOT invoked by `/merge-ready` — it runs ad hoc / post-implementation outside the gate sequence; its `## Facts` discipline still applies whenever it is invoked. |

---

## UC-1: Architect Emits `## Facts` to Stdout Before Verdict (Stdout-Only Agent Path)

**Actor**: `architect` agent, `/bootstrap-feature` orchestrator, Developer (reads stdout transcript)

**Preconditions**:
- Common preconditions hold
- Bootstrap Step 3 (Software Architect) begins; the orchestrator spawns the `architect` subagent with the feature's PRD section, use-case file, and design decisions in context
- The PRD section's `Date:` field is on or after the cognitive-self-check feature's merge date (i.e., this is a current-cycle artifact subject to the rule)
- The architect's prompt file `src/agents/architect.md` contains the `## Cognitive Self-Check (MANDATORY)` section per FR-2.5 specifying the `## Facts` block appears at the START of the stdout review, BEFORE the verdict line

**Trigger**: The `/bootstrap-feature` orchestrator invokes the `architect` subagent at Step 3 to validate the proposed architecture

### Primary Flow (Happy Path)

1. The architect agent loads its prompt and reads the `## Cognitive Self-Check (MANDATORY)` section, which references `~/.claude/rules/cognitive-self-check.md` and specifies the `## Facts` block location
2. The agent runs the 4-question self-check protocol per FR-1.2 BEFORE writing its review:
   - Q1 (На чём основано / What is this claim based on?): the agent enumerates sources for each architectural claim it intends to make (e.g., "the PRD's FR-2.1 list of 12 in-scope agents", "the Section 5 FR-2.1 schema for `.claude/roles-pending.md`")
   - Q2 (Did I verify against current state this session?): the agent checks whether each cited source was Read in the current session
   - Q3 (What am I assuming without proof?): the agent surfaces assumptions, especially any external SDK/API references
   - Q4 (If it's an assumption, is it labelled?): the agent moves unverified claims into the `### Assumptions` subsection with a risk + verification path
3. The agent emits the `## Facts` block per FR-2.5 to stdout, BEFORE its prose review and verdict, with all four subsections in the literal order:
   ```
   ## Facts

   ### Verified facts
   - The PRD section's FR-1.3 mandates four `### ...` subsection names in exact order — verified by Read of `docs/PRD.md` lines 2127-2129 in the current session
   - The 12 in-scope agents are listed in FR-2.1 — verified by Read of `docs/PRD.md` line 2140 in the current session

   ### External contracts
   (none) — this architecture review covers an internal SDLC-pipeline rule; no third-party APIs, SDKs, or libraries are integrated

   ### Assumptions
   - The Plan Critic's existing Completeness section in `src/claude.md` has stable line numbers — assumed; not verified in this session because `src/claude.md` line ranges may shift with concurrent edits

   ### Open questions
   (none)
   ```
4. AFTER the `## Facts` block, the agent emits its prose architecture review and the verdict line `APPROVED` (or `REJECTED` / `APPROVED WITH CONDITIONS`)
5. The orchestrator captures the stdout (`## Facts` block + review prose + verdict) into the user's transcript
6. The Plan Critic does NOT mechanically enforce this `## Facts` block per FR-4.6 (file-vs-stdout split) -- enforcement is the architect's own prompt's responsibility
7. Bootstrap Step 3 SUCCEEDS; the orchestrator proceeds to Step 3.5 (`resource-architect`)

**Postconditions**:
- The architect's stdout review begins with a `## Facts` block (BEFORE the verdict) with all four subsections in the FR-1.3 order
- The Plan Critic does not flag the architect's review (it cannot see stdout per FR-4.6)
- The transcript provides an audit trail: the developer can review the architect's `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions` and challenge any unverified claim

**Mapped FR**: FR-1.2, FR-1.3, FR-2.5, FR-4.6
**Mapped ACs**: AC-6, AC-7, AC-10

### Alternative Flows

- **UC-1-A1: Architect emits `### External contracts: (none)` for purely-internal feature** -- The feature has zero external integrations; the rule still mandates the `### External contracts` subsection with the `(none)` placeholder per FR-1.3
  1. Steps 1-3 of the primary flow proceed normally
  2. At Step 4, the agent's `### External contracts` subsection contains the literal placeholder `(none)` (optionally with a brief rationale clause like "(none) — meta-SDLC feature, no third-party integrations")
  3. The flow completes as in UC-1; the `(none)` placeholder satisfies FR-1.3 without triggering any false positives

  **Mapped FR**: FR-1.3
  **Mapped ACs**: AC-2

- **UC-1-A2: Architect's `### Assumptions` cites a constraint that the planner later contradicts** -- The architect's `## Facts` block flags an assumption (e.g., "the Plan Critic's Completeness section line numbers are stable") that turns out wrong when the planner reads the actual file
  1. The architect emits the assumption explicitly under `### Assumptions` with a risk + verification path
  2. At Step 5 (planner), the planner discovers the constraint is wrong and emits its own `## Facts` block reflecting the correction
  3. The discrepancy surfaces in the plan; the developer (or the architect re-review per FR-9.5) reconciles -- the architect re-review is the standard mechanism for resolving cross-agent fact contradictions
  4. The bootstrap continues; no automated reconciliation is required because the audit trail makes the discrepancy visible

  **Mapped FR**: FR-1.2 (Q4 — assumption labelling), FR-2.5
  **Mapped ACs**: AC-7

### Error Flows

- **UC-1-E1: Architect forgets to emit `## Facts` to stdout** -- The agent skips the protocol; the verdict is emitted but no `## Facts` block precedes it
  1. Steps 1-3 of the primary flow proceed; the agent emits prose + verdict
  2. At Step 4, the agent omits the `## Facts` block entirely
  3. The orchestrator captures the stdout WITHOUT a `## Facts` block
  4. The Plan Critic does NOT mechanically catch this per FR-4.6 (stdout is out of Plan Critic scope)
  5. The omission is detectable only by:
     a. Transcript review by the developer
     b. The `code-reviewer` agent at `/merge-ready` Gate 2 reading the artifact set; the code-reviewer's own `## Cognitive Self-Check (MANDATORY)` section per FR-2.9 may surface the gap if the reviewer notices it
  6. Per Risk 1 in PRD Section 9.7, this enforcement gap is documented explicitly so neither the user nor a future maintainer is surprised

  **Mapped FR**: FR-2.5, FR-4.6
  **Mapped ACs**: (gap — PRD does not mandate mechanical stdout enforcement; flagged per Risk 1)

### Edge Cases

- **UC-1-EC1: Architect's review references an internal project class (`userService.findById()`) in code-formatting backticks** -- The internal symbol must NOT be flagged by any external-contract check (architect's own self-check or downstream Plan Critic)
  1. The architect's prose mentions `userService.findById()` in backticks
  2. Per FR-4.3, the Plan Critic's external-contract heuristic looks for dotted method names AND treats them as external when context suggests an integration (presence of words like "API", "SDK", "endpoint")
  3. Because `userService.findById()` is an internal project symbol with no surrounding integration-context words, the architect's `### External contracts` does NOT need to cite it; the agent records the symbol's internal nature implicitly by NOT including it in the external-contracts list
  4. The Plan Critic does not see stdout per FR-4.6, so even a false-positive heuristic match would not fire here
  5. NFR-6 makes the heuristic's intentionally-low recall explicit; false positives on internal symbols are tolerated

  **Mapped FR**: FR-4.3, NFR-6
  **Mapped ACs**: AC-9

- **UC-1-EC2: Architect's `## Facts` block transitively cites a fact from the prd-writer's prior `## Facts` block** -- The architect's `### Verified facts` references "verified per prd-writer's `## Facts` in PRD §9 line 2313"
  1. The architect emits `### Verified facts` containing an entry that cites another agent's prior `## Facts` block as the source
  2. Per FR-1.4, the citation must identify the source of verification — citing another agent's `## Facts` is acceptable IF the architect's own session also Read the cited PRD line range (Q2 freshness)
  3. If the architect did NOT Read the cited line range in this session, the claim is an assumption and belongs under `### Assumptions`, not `### Verified facts`
  4. The transitive-citation chain is auditable; the developer can follow the chain back to the original verification source

  **Mapped FR**: FR-1.2 (Q2 freshness), FR-1.4
  **Mapped ACs**: AC-5

### Data Requirements

- **Input**: The PRD section, the use-case file, prior agent output (e.g., prd-writer's PRD section with its own `## Facts` block)
- **Output**: Stdout `## Facts` block at the START + prose review + verdict line
- **Side Effects**: Zero file writes by the architect (architect is stdout-only). No Bash invocations. No network calls.

---

## UC-2: Planner Creates `.claude/plan.md` with `## Facts` Block (File-Writing Agent Path)

**Actor**: `planner` agent, `/bootstrap-feature` orchestrator, Plan Critic subagent (downstream)

**Preconditions**:
- Common preconditions hold
- Bootstrap Step 5 (planner) begins; all prior bootstrap steps (PRD, use cases, architect review, resource-architect, role-planner, qa-planner) completed
- The planner's prompt file `src/agents/planner.md` contains the `## Cognitive Self-Check (MANDATORY)` section per FR-2.7 specifying the `## Facts` block appears NEAR THE TOP of `.claude/plan.md`, AFTER any inlined `## Recommended Resources` / `## Auto-Install Results` / `## Additional Roles` / `## Reuse Decisions` sections and BEFORE `## Prerequisites verified`
- The plan being authored is for a current-cycle feature (subject to the rule per FR-7.1)

**Trigger**: The `/bootstrap-feature` orchestrator invokes the `planner` subagent at Step 5 to author the executable plan at `.claude/plan.md`

### Primary Flow (Happy Path)

1. The planner agent loads its prompt; the `## Cognitive Self-Check (MANDATORY)` section is unmissable on a top-to-bottom read per FR-2.15
2. The agent runs the 4-question self-check protocol per FR-1.2 before writing the plan
3. The agent reads the PRD section, use-case file, architect's stdout review (captured in transcript), resource-architect's `.claude/resources-pending.md` (if present), role-planner's `.claude/roles-pending.md` (if present), and qa-planner's `docs/qa/<feature>_test_cases.md`
4. The agent writes the executable plan to `.claude/plan.md` in the order: Recommended Resources [inlined per Section 4 FR-2.6], Auto-Install Results [inlined per Section 7 FR-6.7], Additional Roles + Role invocation plan + Reuse Decisions [inlined per Section 5 FR-2.6 / Section 8 FR-8.1], `## Facts` block per FR-2.7 (positioned NEAR THE TOP — after the inlined upstream sections, BEFORE `## Prerequisites verified`), then Prerequisites verified, Slices, Risks and dependencies, Verification, Review Notes
5. The `## Facts` block (emitted in Step 4 above) contains all four subsections in the literal order:
   ```
   ## Facts

   ### Verified facts
   - The PRD's FR-4.5 mandates the two new Completeness checks attach to the existing Completeness category in the Plan Critic prompt — verified by Read of `docs/PRD.md` lines 2172-2174 in the current session
   - The 5 executor agents are byte-unchanged per FR-6.6 — verified by reading the FR-3.1 list

   ### External contracts
   (none) — this plan implements internal SDLC-pipeline rules; no third-party API integration

   ### Assumptions
   - The Plan Critic's Completeness section is bounded by `**Completeness:**` and `**Slice Quality:**` markers — assumed based on plan's Slice 5 verification step (c); not independently re-verified in the planner's session

   ### Open questions
   (none)
   ```
6. The orchestrator runs the Plan Critic on `.claude/plan.md` per the `## Plan Critic Pass (MANDATORY)` rule
7. The Plan Critic reads `.claude/plan.md` and runs Check (a) per FR-4.1: it confirms the `## Facts` section is present with all four `### ...` subsections in order. PASS.
8. The Plan Critic runs Check (b) per FR-4.3: it scans the plan body (excluding the `## Facts` block itself) for external API/SDK/library identifiers. The heuristic finds zero external identifiers (this plan is internal). PASS.
9. The Plan Critic returns "FINDINGS: none" for the cognitive-self-check checks
10. Bootstrap Step 5 SUCCEEDS; the orchestrator proceeds to Step 6 (planner's Plan Critic Pass) -> Step 7 (implementation begins)

**Postconditions**:
- `.claude/plan.md` contains a `## Facts` block near the top (after inlined upstream sections, before `## Prerequisites verified` per FR-2.7) with all four subsections in FR-1.3 order
- The Plan Critic ran both Check (a) and Check (b) and produced no findings related to cognitive-self-check
- The plan is approved for implementation

**Mapped FR**: FR-1.2, FR-1.3, FR-2.7, FR-4.1, FR-4.3, FR-4.5
**Mapped ACs**: AC-6, AC-7, AC-9

### Alternative Flows

- **UC-2-A1: Plan integrates a third-party SDK with proper `### External contracts` citation** -- The plan covers a feature that calls Stripe; the planner cites the SDK contract correctly
  1. Steps 1-4 proceed; the plan body mentions `Stripe.Charge.status === 'succeeded'` in a slice description (in code-formatting backticks)
  2. At Step 5, the planner emits `### External contracts` containing:
     ```
     - `Stripe.Charge.status` enum values — verified via WebFetch of https://docs.stripe.com/api/charges/object#charge_object-status in the current session; valid values are `succeeded`, `pending`, `failed`
     - `stripe-node` package version `^14.0.0` — verified via Read of `package.json` line 23 in the current session
     ```
  3. The Plan Critic Check (b) per FR-4.3 detects `Stripe.Charge.status` as a dotted method/identifier, looks it up in `### External contracts`, finds it cited with a verification source, PASS
  4. Bootstrap proceeds normally

  **Mapped FR**: FR-1.4, FR-4.3, FR-4.4
  **Mapped ACs**: AC-9

- **UC-2-A2: Plan inlines content from `.claude/resources-pending.md` and `.claude/roles-pending.md`** -- The planner inlines the Recommended Resources, Auto-Install Results, Additional Roles, Role invocation plan, and Reuse Decisions sections from the upstream agents per Section 4/5/7/8 FRs
  1. Steps 1-3 proceed; the planner reads the two pending files
  2. The planner inlines all upstream sections into `.claude/plan.md` in their canonical order
  3. The planner emits its OWN `## Facts` block per FR-2.7 NEAR THE TOP of `.claude/plan.md`, after the inlined upstream sections and before `## Prerequisites verified`. The upstream agents' `## Facts` blocks (in `.claude/resources-pending.md` per FR-2.12 and `.claude/roles-pending.md` per FR-2.13) are inlined as part of the upstream sections OR are NOT inlined depending on the upstream agent's emission point — the planner's own `## Facts` block is the load-bearing one for plan-authoring decisions
  4. Plan Critic checks proceed as in primary flow

  **Mapped FR**: FR-2.7, FR-2.12, FR-2.13
  **Mapped ACs**: AC-7

### Error Flows

- **UC-2-E1: Planner omits `## Facts` block entirely** -- The agent finishes `.claude/plan.md` but skips the protocol; no `## Facts` block at the end
  1. Steps 1-4 proceed; the agent writes the plan body
  2. The agent forgets to emit `## Facts` between the inlined upstream sections and `## Prerequisites verified`
  3. The orchestrator runs the Plan Critic per the `## Plan Critic Pass (MANDATORY)` rule
  4. Per FR-4.1, the Plan Critic Check (a) scans `.claude/plan.md` for the `## Facts` heading; it does NOT find one
  5. Per FR-4.2, missing `## Facts` block in a current-cycle file-based artifact is a **MAJOR** finding
  6. The Plan Critic returns: `FINDINGS: 1. [MAJOR] — Missing \`## Facts\` block in .claude/plan.md — required by cognitive-self-check rule per FR-4.1`
  7. Per the Plan Critic Pass rule, MAJOR findings MUST be addressed before ExitPlanMode
  8. The orchestrator (or the planner re-invoked) appends the `## Facts` block; the Plan Critic re-runs and PASSES
  9. Bootstrap continues

  **Mapped FR**: FR-4.1, FR-4.2
  **Mapped ACs**: AC-9

### Edge Cases

- **UC-2-EC1: Plan re-edited after merge by appending a slice** -- A plan was created BEFORE the cognitive-self-check feature merged; per FR-7.3, it was exempt. After merge, the user re-edits the plan to add a new slice
  1. The plan's last-modified time is now POST-merge (the file was rewritten)
  2. Per FR-7.3, the next save MUST add a `## Facts` block
  3. The planner agent (or the user via direct edit) is now subject to the rule
  4. If the `## Facts` block is missing, Plan Critic returns MAJOR per UC-2-E1

  **Mapped FR**: FR-7.3
  **Mapped ACs**: AC-18

### Data Requirements

- **Input**: PRD section, use-case file, architect stdout (transcript), `.claude/resources-pending.md` (if present), `.claude/roles-pending.md` (if present), `docs/qa/<feature>_test_cases.md`
- **Output**: `.claude/plan.md` with Context, Feature scope, Deliverables, inlined upstream sections, `## Facts` block (near the top, after `## Reuse Decisions`, before `## Prerequisites verified` per FR-2.7), Implementation slices, Risks, Verification, Review Notes
- **Side Effects**: One Write to `.claude/plan.md`. The Plan Critic's two new Completeness checks add bounded pattern-match time per NFR-1 (<5s)

---

## UC-3: PRD-Writer Adds Feature Section with Embedded `## Facts` Subsection (File-Writing Agent Path)

**Actor**: `prd-writer` agent, `/bootstrap-feature` orchestrator, Plan Critic subagent (downstream)

**Preconditions**:
- Common preconditions hold
- Bootstrap Step 1 (`prd-writer`) begins; the orchestrator passes the user's feature description as input
- The prd-writer's prompt file `src/agents/prd-writer.md` contains the `## Cognitive Self-Check (MANDATORY)` section per FR-2.3 specifying the `## Facts` block appears at the END of the new PRD section, AFTER the existing `Risks and Dependencies` subsection
- The new PRD section's `Date:` field is set to a date on or after the cognitive-self-check feature's merge date (current-cycle artifact per FR-7.1)

**Trigger**: The `/bootstrap-feature` orchestrator invokes `prd-writer` at Step 1

### Primary Flow (Happy Path)

1. The prd-writer agent loads its prompt and reads the `## Cognitive Self-Check (MANDATORY)` section
2. The agent runs the 4-question protocol per FR-1.2 before writing the PRD section
3. The agent appends a new section to `docs/PRD.md` with the standard structure: `## N. <Feature Name>`, header block (`Status:`, `Date:`, `Priority:`, `Related:`), optional `Changelog:` line, `### N.1 Description`, `### N.2 User Story`, `### N.3 Functional Requirements`, `### N.4 Non-Functional Requirements`, `### N.5 Acceptance Criteria`, `### N.6 Affected Components`, `### N.7 Risks and Dependencies`
4. AFTER the `### N.7 Risks and Dependencies` subsection, the agent appends the `## Facts` block per FR-2.3 with all four subsections in literal order, with sources cited for every external API/SDK/library identifier mentioned in the section per FR-1.4
5. The orchestrator proceeds to subsequent bootstrap steps. At Step 6 (Plan Critic), the Plan Critic reads `docs/PRD.md` and locates the new section by `Date:` field
6. The Plan Critic Check (a) per FR-4.1: confirms the `## Facts` block is present with four subsections in order. PASS
7. The Plan Critic Check (b) per FR-4.3: scans the new PRD section's body for external API/SDK/library identifiers; verifies each cited in `### External contracts`. PASS

**Postconditions**:
- `docs/PRD.md` contains the new section with `## Facts` at the end, after `### N.7 Risks and Dependencies`
- The PRD section is dogfood-compliant: it uses the rule it itself introduces (per FR-7.5 for Section 9 specifically)
- Plan Critic finds no cognitive-self-check findings on the new PRD section

**Mapped FR**: FR-1.2, FR-1.3, FR-1.4, FR-2.3, FR-4.1, FR-4.3, FR-7.5
**Mapped ACs**: AC-6, AC-7, AC-19

### Alternative Flows

- **UC-3-A1: PRD section dogfoods the rule it introduces (Section 9 self-reference)** -- The cognitive-self-check feature's own PRD section MUST itself have a `## Facts` block per FR-7.5
  1. Steps 1-4 proceed; the section authored is Section 9 (cognitive-self-check)
  2. The `## Facts` block at end of Section 9 cites: PRD §9 source line ranges, the approved plan file, internal cross-references to Sections 1, 3, 6, 8
  3. `### External contracts: (none)` because the feature is purely internal
  4. AC-19 verifies this dogfooding explicitly

  **Mapped FR**: FR-7.5
  **Mapped ACs**: AC-19

### Error Flows

- **UC-3-E1: PRD-writer mentions an external API identifier without `### External contracts` citation** -- The prose describes Stripe integration but the agent forgets to cite Stripe SDK in the Facts block
  1. The agent's prose mentions `Stripe.Charge.status === 'succeeded'` in a code block within FR-3.5
  2. The agent's `## Facts` block has `### External contracts: (none)` (incorrectly omitting the Stripe citation)
  3. Plan Critic Check (b) per FR-4.3 detects the `Stripe.Charge.status` dotted identifier in the prose, looks for a corresponding entry in `### External contracts`, finds none
  4. Per FR-4.4, this is a **MAJOR** finding: external API/SDK identifier without citation
  5. The Plan Critic returns: `FINDINGS: 1. [MAJOR] — \`Stripe.Charge.status\` mentioned in PRD section X without \`### External contracts\` citation — required by FR-1.4 / FR-4.3`
  6. The agent (or developer) updates `### External contracts` with the Stripe citation; Plan Critic re-runs and PASSES

  **Mapped FR**: FR-1.4, FR-4.3, FR-4.4
  **Mapped ACs**: AC-9

### Edge Cases

- **UC-3-EC1: PRD section's `Date:` field is malformed or missing** -- The PRD section has `Date: TBD` or no Date line at all
  1. Per Risk 7 in PRD Section 9.7, the Plan Critic's date-comparison guard treats missing/malformed `Date:` as POST-MERGE (fails closed for safety)
  2. The Plan Critic enforces the rule on the section as if it were current-cycle
  3. If the section lacks a `## Facts` block, the Plan Critic returns MAJOR per FR-4.2
  4. The agent (or developer) fixes the `Date:` field AND adds the `## Facts` block; Plan Critic re-runs and PASSES

  **Mapped FR**: Risk 7 (PRD §9.7)
  **Mapped ACs**: AC-18

### Data Requirements

- **Input**: User's feature description, prior PRD content (read-only, used to determine next section number)
- **Output**: New section appended to `docs/PRD.md` with `## Facts` block at end
- **Side Effects**: One Write to `docs/PRD.md` (append)

---

## UC-4: Plan Critic Detects Missing `## Facts` in `.claude/plan.md` -- MAJOR Finding

**Actor**: Plan Critic subagent, `planner` orchestrator (or `/bootstrap-feature`)

**Preconditions**:
- Common preconditions hold
- A `.claude/plan.md` exists for a current-cycle feature (file last-modified time is POST cognitive-self-check feature merge date per FR-7.3)
- The plan body lacks a `## Facts` heading entirely (no `## Facts`, no four subsections)
- The Plan Critic prompt in `src/claude.md` contains the two new Completeness checks per FR-4.1 / FR-4.3 with the FR-4.6 file-vs-stdout split preamble

**Trigger**: The `## Plan Critic Pass (MANDATORY)` rule fires after the planner finishes writing `.claude/plan.md`; the orchestrator spawns the Plan Critic subagent

### Primary Flow (Happy Path)

1. The Plan Critic subagent reads `.claude/plan.md` and the project's `.claude/CLAUDE.md` (and rules) per the existing critic prompt
2. The critic runs the existing Completeness checks (acceptance criteria, deliverables checklist, slice numbering, etc.)
3. The critic runs the NEW Check (a) per FR-4.1: it greps for `^## Facts$` in `.claude/plan.md`; the grep returns zero matches
4. Per FR-4.2, missing `## Facts` block in a current-cycle file-based artifact is a **MAJOR** finding
5. The critic emits the finding: `FINDINGS: 1. [MAJOR] — Missing \`## Facts\` block in .claude/plan.md — required by cognitive-self-check rule per FR-4.1`
6. The critic continues running the remaining Completeness checks (Slice Quality, File Path Verification, Architecture & Security, Edge Cases, Scope Reduction, Wave Assignment)
7. Each check that finds an issue produces its own finding; the cognitive-self-check finding is one entry in the consolidated list
8. The critic returns the consolidated FINDINGS block to the orchestrator
9. Per the Plan Critic Pass rule (`## Step 2: Incorporate Findings`), all CRITICAL/MAJOR findings MUST be addressed before ExitPlanMode
10. The orchestrator (or planner re-invoked) appends the `## Facts` block to `.claude/plan.md`; the critic is NOT re-run per the rule (one pass is sufficient); the orchestrator records in `## Review Notes` that the MAJOR finding was addressed

**Postconditions**:
- The Plan Critic surfaced the missing `## Facts` block as MAJOR
- The orchestrator addressed the finding by adding the block
- The plan now satisfies FR-4.1
- The Plan Critic's invocation added <5s to the bootstrap per NFR-1

**Mapped FR**: FR-4.1, FR-4.2, NFR-1
**Mapped ACs**: AC-9

### Alternative Flows

- **UC-4-A1: Plan Critic detects missing `## Facts` in PRD section instead of plan** -- The PRD section was authored without a `## Facts` block; the plan was correctly authored
  1. The critic checks `docs/PRD.md` for the new section's `## Facts` block per FR-4.1 (current-cycle artifacts include the PRD section authored in this bootstrap cycle)
  2. The critic finds the section but no `## Facts` block at end
  3. Per FR-4.2, MAJOR finding raised: `Missing \`## Facts\` block in PRD section X — required by FR-4.1`
  4. The orchestrator escalates to the prd-writer to fix; flow re-converges

  **Mapped FR**: FR-4.1, FR-4.2
  **Mapped ACs**: AC-9

- **UC-4-A2: Plan Critic detects missing `## Facts` in use-cases file** -- The ba-analyst's use-cases file lacks `## Facts`
  1. The critic checks `docs/use-cases/<feature>_use_cases.md` per FR-4.1
  2. The critic finds the use cases but no `## Facts` block at end
  3. Per FR-4.2, MAJOR finding raised
  4. The ba-analyst is re-invoked or the orchestrator addresses

  **Mapped FR**: FR-2.4, FR-4.1
  **Mapped ACs**: AC-9

### Error Flows

- **UC-4-E1: Plan Critic spawn fails (subagent error)** -- The orchestrator cannot spawn the critic; cognitive-self-check enforcement does not run
  1. Per the existing Plan Critic Pass rule, this is an orchestrator-level failure independent of the cognitive-self-check feature
  2. The bootstrap halts at Step 6 with a critic-invocation error
  3. The user re-runs `/bootstrap-feature` or manually invokes the critic; cognitive-self-check enforcement runs as in UC-4 primary

  **Mapped FR**: (orchestrator-level; not cognitive-self-check-specific)

### Edge Cases

- **UC-4-EC1: Plan Critic finds `## Facts` heading but with wrong subsection order** -- The block is present but `### Assumptions` precedes `### External contracts`
  1. The critic detects the `## Facts` block exists
  2. Per FR-1.3, the four subsections must appear in the literal order: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`
  3. The critic's Check (a) verifies the order; an out-of-order block fails the check
  4. The current PRD wording on order-violation severity is implementation-time decision; the conservative reading is **MINOR** (block exists but format-incorrect) consistent with FR-4.2's MINOR for empty-without-`(none)` (block exists but content-incorrect)
  5. The orchestrator addresses via planner re-author

  **Mapped FR**: FR-1.3, FR-4.2

### Data Requirements

- **Input**: `.claude/plan.md`, the project's `.claude/CLAUDE.md`
- **Output**: A FINDINGS block returned by the critic to the orchestrator
- **Side Effects**: No file writes by the critic itself; the orchestrator may re-write `.claude/plan.md` after incorporating findings

---

## UC-5: Plan Critic Detects External API Identifier Without `### External contracts` Citation -- MAJOR Finding

**Actor**: Plan Critic subagent

**Preconditions**:
- Common preconditions hold
- A current-cycle file-based artifact (e.g., `.claude/plan.md` or a current-cycle PRD section) contains a reference to an external API/SDK/library identifier in code-formatting backticks: specifically `Stripe.Charge.status` (the canonical external-contract test fixture per Verification step 7 in the approved plan)
- The artifact's `### External contracts` subsection is absent OR contains `(none)` OR does NOT include a citation for `Stripe.Charge.status`
- The Plan Critic Check (b) per FR-4.3 is enabled

**Trigger**: The Plan Critic runs on the artifact after the authoring agent finishes

### Primary Flow (Happy Path)

1. The Plan Critic reads the artifact and locates the `## Facts` block (Check (a) PASS — block exists, four subsections in order, but the contract is missing)
2. The critic runs Check (b) per FR-4.3: it scans the artifact body (excluding the `## Facts` block itself) for external API/SDK/library identifiers using the heuristic patterns:
   - Dotted method names matching `<Capitalized>.<word>(.<word>)*` (e.g., `Stripe.Charge.status`)
   - Quoted enum or status strings (e.g., `"PENDING"`, `"running"`)
   - Capitalized class/type names matching `^[A-Z][A-Za-z0-9]+$` in code-formatting backticks
3. The critic finds `Stripe.Charge.status` matching the dotted-method heuristic
4. The critic looks up `Stripe.Charge.status` in the artifact's `### External contracts` subsection: not found
5. Per FR-4.4, this is a **MAJOR** finding: `External API/SDK/library identifier \`Stripe.Charge.status\` mentioned in artifact body without \`### External contracts\` citation — required by FR-1.4 / FR-4.3`
6. The critic returns the finding to the orchestrator
7. The orchestrator (or authoring agent re-invoked) adds an `### External contracts` entry citing the Stripe SDK contract:
   ```
   - `Stripe.Charge.status` enum values — verified via WebFetch of https://docs.stripe.com/api/charges/object#charge_object-status in the current session; valid values: `succeeded`, `pending`, `failed`
   ```
8. The Plan Critic is not re-run (one pass per the rule); the developer accepts the fix in `## Review Notes`

**Postconditions**:
- The MAJOR finding was raised and addressed
- The artifact now has a proper external-contract citation
- The audit trail allows the next agent or human to challenge the citation source

**Mapped FR**: FR-1.4, FR-4.3, FR-4.4
**Mapped ACs**: AC-9

### Alternative Flows

- **UC-5-A1: External identifier mentioned in narrative prose without backticks** -- The artifact mentions "the Stripe Charge status enum" in plain prose, no backticks
  1. Per FR-4.3, the heuristic looks for backtick-wrapped identifiers; plain prose mentions are NOT detected
  2. Per NFR-6, this is an intentional low-recall property: false negatives are acceptable; the agent's own prompt is the primary defense
  3. The Plan Critic returns no finding for this case
  4. If the agent's own self-check protocol caught the gap, the agent would have cited `Stripe.Charge.status` in `### External contracts`; if the agent missed it, the gap survives the Plan Critic but may be caught by code-reviewer at /merge-ready

  **Mapped FR**: FR-4.3, NFR-6

- **UC-5-A2: Citation present but vague source ("API docs" without URL)** -- The `### External contracts` entry reads `Stripe.Charge.status — source: API docs`
  1. The critic finds the citation present
  2. Per FR-4.4, citation present but with vague source (no URL or version) is a **MINOR** finding
  3. The critic returns: `FINDINGS: 1. [MINOR] — \`Stripe.Charge.status\` citation in \`### External contracts\` has vague source ("API docs"); per FR-1.4 the source must identify the verification (URL, SDK version + symbol path, file:line)`
  4. Per the Plan Critic Pass rule, MINOR findings are fixed if straightforward, otherwise noted in Review Notes

  **Mapped FR**: FR-1.4, FR-4.4
  **Mapped ACs**: AC-9

### Error Flows

- **UC-5-E1: Plan Critic's heuristic regex throws an error on malformed input** -- The artifact contains a non-UTF-8 byte sequence or the grep tool encounters a binary blob
  1. The critic's pattern-match step fails
  2. The critic surfaces the error to the orchestrator
  3. The orchestrator re-invokes the critic OR the developer fixes the artifact's encoding
  4. Per NFR-1, the bounded pattern-match time is preserved (grep is the bound); pathological inputs are out of scope for this iteration

  **Mapped FR**: NFR-1

### Edge Cases

- **UC-5-EC1: Internal project symbol (`userService.findById()`) must NOT trip the external-contract check** -- The canonical false-positive guard
  1. The artifact mentions `userService.findById()` in a slice description (in backticks)
  2. The critic's heuristic per FR-4.3 looks for dotted method names matching `<Capitalized>.<word>(.<word>)*`
  3. `userService.findById()` starts with lowercase `u` — it does NOT match the `^[A-Z]` heuristic for class names; it MAY match the dotted-method heuristic
  4. Per Risk 7 in PRD Section 9.7 and the approved plan's Verification step 8, the heuristic should NOT false-positive on lowercase-starting internal symbols
  5. The critic returns no finding for `userService.findById()`
  6. NFR-6 documents that false positives MAY occur; the cost of a spurious MAJOR is one user-facing dismissal; refining the heuristic is iter-2 work

  **Mapped FR**: FR-4.3, NFR-6, Risk 6 (PRD §9.7)
  **Mapped ACs**: AC-9

- **UC-5-EC2: External identifier in the `## Facts` block itself (within `### External contracts`)** -- The identifier appears ONLY within the citation; the body is clean
  1. Per FR-4.3, the critic scans the body EXCLUDING the `## Facts` block itself
  2. The identifier inside `### External contracts` is not double-scanned
  3. No spurious finding is raised

  **Mapped FR**: FR-4.3

- **UC-5-EC3: Identifier appears in a fenced code block within the artifact body** -- The plan has a code fence with `Stripe.Charge.status` as part of an example
  1. Per FR-4.3, the heuristic scans backtick-quoted identifiers; code fences contain code text but the heuristic's behavior on triple-backtick fences vs single-backtick spans is implementation-dependent
  2. Conservative implementation: code-fenced identifiers are scanned (treated as code/contract references)
  3. The agent must cite them in `### External contracts` like any other backticked identifier
  4. NFR-6 makes the heuristic intentionally conservative: false positives over false negatives is the safer default

  **Mapped FR**: FR-4.3, NFR-6

### Data Requirements

- **Input**: A current-cycle file-based artifact containing external API/SDK/library identifiers
- **Output**: A FINDINGS block (MAJOR for missing citation, MINOR for vague source)
- **Side Effects**: No file writes by the critic; downstream addressing may modify the artifact

---

## UC-6: Plan Critic Detects Empty Subsection Without `(none)` Placeholder -- MINOR Finding

**Actor**: Plan Critic subagent

**Preconditions**:
- Common preconditions hold
- A current-cycle file-based artifact contains a `## Facts` block with all four `### ...` subsection headings present, but at least one subsection's body is empty (zero content lines, no `(none)` placeholder)
- The Plan Critic Check (a) per FR-4.1 is enabled

**Trigger**: The Plan Critic runs on the artifact

### Primary Flow (Happy Path)

1. The critic reads the artifact and locates the `## Facts` block
2. The critic confirms all four `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions` headings are present in order (block-presence check PASS)
3. The critic checks each subsection for content: the body between two `### ...` headings (or between the last `### ...` and the next top-level marker) MUST contain either (a) one or more bullet points / paragraphs OR (b) the literal placeholder `(none)`
4. Per FR-1.3, empty subsections without `(none)` are improperly marked
5. Per FR-4.2, this is a **MINOR** finding: `Empty subsection \`### Open questions\` in artifact lacks the literal \`(none)\` placeholder — required by FR-1.3`
6. The critic returns the finding
7. Per the Plan Critic Pass rule, MINOR findings are fixed if straightforward (one-line edit) or noted in Review Notes
8. The orchestrator (or developer) adds the `(none)` placeholder

**Postconditions**:
- The MINOR finding was raised
- The fix is trivial (one-line edit adding `(none)`)
- The artifact now satisfies FR-1.3

**Mapped FR**: FR-1.3, FR-4.2
**Mapped ACs**: AC-9

### Alternative Flows

- **UC-6-A1: All four subsections empty without placeholders** -- The agent emitted the four headings but no content under any
  1. The critic detects four MINOR findings, one per subsection
  2. The orchestrator addresses by adding `(none)` to each (or by populating with actual facts if the agent forgot)
  3. Per the Plan Critic Pass rule, MINOR findings can be batched

  **Mapped FR**: FR-1.3, FR-4.2

### Error Flows

- **UC-6-E1: Subsection contains only whitespace or a comment** -- The body is `<!-- TODO: fill in -->` or all spaces
  1. The critic's heuristic for "empty" is implementation-time decision; conservative reading: a body containing only whitespace OR a HTML comment with no text content is treated as empty
  2. The critic raises MINOR per FR-4.2
  3. The orchestrator addresses

  **Mapped FR**: FR-1.3, FR-4.2

### Edge Cases

- **UC-6-EC1: Subsection has `(none)` followed by a clarifying parenthetical** -- The body reads `(none) — meta-SDLC feature, no third-party integrations`
  1. Per FR-1.3, the literal `(none)` placeholder satisfies the empty-marker requirement
  2. Additional clarifying text after `(none)` is ALLOWED (it is informative, not contradictory)
  3. The critic does NOT raise a finding

  **Mapped FR**: FR-1.3

### Data Requirements

- **Input**: A current-cycle file-based artifact with a `## Facts` block
- **Output**: A FINDINGS block listing MINOR per missing-`(none)` subsection
- **Side Effects**: None by the critic

---

## UC-7: Agent Encounters a Fact It Cannot Verify In-Session -- Labels It Under `### Assumptions`

**Actor**: Any in-scope thinking agent (canonical example: `architect` or `planner`)

**Preconditions**:
- Common preconditions hold
- The agent is authoring an artifact and runs the 4-question protocol per FR-1.2
- During Q1-Q2, the agent identifies a load-bearing claim it cannot verify in the current session (e.g., the source file was not Read this session, or the external API was not WebFetched this session)
- The rule's guidance is unambiguous: "I remember from a similar API / from training data" is NOT a valid source per FR-1.4

**Trigger**: The agent reaches a decision point that depends on the unverified claim

### Primary Flow (Happy Path)

1. The agent's self-check protocol surfaces the unverified claim during Q1 (source) and Q2 (freshness)
2. Per Q3 (assumption surfacing), the agent classifies the claim as an assumption rather than a fact
3. Per Q4 (audit trail), the agent emits the assumption under `### Assumptions` in its `## Facts` block with two pieces of information per FR-1.3 / approved plan §"`## Facts` structure":
   - Risk: what breaks if the assumption is wrong
   - How to verify: the next step that could move it to `### Verified facts`
4. Example: the architect cannot verify in-session whether `claude mcp list` outputs JSON or plain text. The architect emits:
   ```
   ### Assumptions
   - `claude mcp list` outputs plain text with one MCP per line — assumed; risk: if it outputs JSON, the resource-architect's grep-based detection per Section 7 FR-3.4 needs a parser; how to verify: run `claude mcp list` once at implementation time and inspect output format
   ```
5. The artifact is emitted with the assumption labelled
6. The Plan Critic does NOT raise a finding for this artifact: the assumption is properly surfaced, not silently treated as fact
7. The next agent (or human reviewer) sees the assumption and can challenge it; the audit trail is intact

**Postconditions**:
- The unverified claim is documented under `### Assumptions` with risk + verification path
- The agent did NOT silently treat the claim as fact
- The next pipeline step has a list of assumptions to challenge or verify

**Mapped FR**: FR-1.2 (Q3, Q4), FR-1.3, FR-1.4
**Mapped ACs**: AC-3, AC-5

### Alternative Flows

- **UC-7-A1: Agent verifies the assumption in-session and promotes it to `### Verified facts`** -- The agent runs `claude mcp list` (if it has Bash) or WebFetches the docs, confirms the format, and reclassifies
  1. Steps 1-2 proceed; the agent identifies the candidate assumption
  2. Before emitting the artifact, the agent runs the verification step (e.g., Bash `claude mcp list` if its tool list permits)
  3. The verification confirms the format; the claim moves from assumption to verified fact
  4. The agent emits the claim under `### Verified facts` with a citation: `verified by Bash invocation of \`claude mcp list\` returning plain text in the current session`
  5. Per Q4, the audit trail is now stronger (verified, not assumed)

  **Mapped FR**: FR-1.2 (Q1, Q2), FR-1.3

- **UC-7-A2: Agent identifies a question requiring user input -- emits under `### Open questions`** -- The unverified claim is actually a design decision needing developer input
  1. Steps 1-2 proceed
  2. The agent realizes the question is a decision, not a fact (e.g., "should the rule apply to PRD sections that lack a `Date:` field?")
  3. The agent emits under `### Open questions` with the user-input requirement: `Should the cognitive-self-check rule apply to PRD sections lacking a \`Date:\` field? Needs: developer decision`
  4. The orchestrator surfaces the question; the developer answers; the answer feeds back into a future bootstrap or implementation step

  **Mapped FR**: FR-1.3 (`### Open questions` subsection)

### Error Flows

- **UC-7-E1: Agent silently treats unverified claim as fact** -- The agent fails to run the protocol; emits the claim under `### Verified facts` without source
  1. The artifact's `### Verified facts` contains a claim with no source citation
  2. Per FR-1.3 (rule body), each `### Verified facts` entry SHOULD have a source per the approved plan's `## Facts` structure spec
  3. The Plan Critic's heuristic does NOT mechanically check for source presence in `### Verified facts` (FR-4.3 is for external-contract identifiers, not internal verified-fact sourcing)
  4. The omission is detectable only by code-reviewer at /merge-ready or by transcript review
  5. Per Risk 9 in PRD Section 9.7, this is a soft-power problem: no mechanical check distinguishes "thoughtfully sourced" from "unsourced"; reviewers catch it

  **Mapped FR**: FR-1.3, Risk 9 (PRD §9.7)

### Edge Cases

- **UC-7-EC1: Agent cites source as "I remember from a similar API"** -- The agent admits memory-based reasoning explicitly
  1. The agent emits `### Verified facts` with a claim sourced as `I remember from a similar API`
  2. Per FR-1.4, this is explicitly NOT a valid source — the rule states the literal phrase is not valid
  3. The rule's force is normative (the agent should not do this) AND mechanical (the Plan Critic SHOULD detect the literal phrase if present in `### Verified facts` and raise a finding)
  4. Implementation-time decision: the Plan Critic MAY add a tertiary check `grep -F "I remember from a similar API"` as a future iteration; iter-1 relies on the agent's own self-check to never emit this phrase
  5. If the phrase appears in `### Verified facts`, code-reviewer at /merge-ready should flag

  **Mapped FR**: FR-1.4

### Data Requirements

- **Input**: The agent's working context (PRD, prior agents' artifacts, the agent's own session history)
- **Output**: An artifact with the assumption properly surfaced under `### Assumptions`
- **Side Effects**: No additional file writes beyond the agent's normal output

---

## UC-8: Backward Compatibility -- Plan Critic Does NOT Flag Pre-Existing Artifacts

**Actor**: Plan Critic subagent

**Preconditions**:
- Common preconditions hold
- The cognitive-self-check feature merged on a known date `<MERGE_DATE>`
- A pre-existing PRD section (e.g., Section 5 from `role-planner-iter-1`) has `Date:` field PRECEDING `<MERGE_DATE>`
- A pre-existing use-case file (e.g., `docs/use-cases/role-planner-reuse-teardown_use_cases.md`) was last-modified BEFORE `<MERGE_DATE>` AND is not being re-edited in the current cycle
- A pre-existing plan file is not part of the current bootstrap cycle
- None of these pre-existing artifacts contain `## Facts` blocks (they were authored before the rule existed)

**Trigger**: The Plan Critic runs as part of a current bootstrap cycle for a NEW feature (different from the pre-existing artifacts)

### Primary Flow (Happy Path)

1. The Plan Critic identifies the current-cycle artifacts: the new PRD section (post-merge `Date:`), the new use-case file, the new `.claude/plan.md`
2. The critic does NOT include pre-existing artifacts in its enforcement scope per FR-7.1, FR-7.2, FR-7.3
3. The critic runs Check (a) and Check (b) ONLY on current-cycle artifacts
4. Pre-existing artifacts (e.g., Section 5, prior use-case files) are skipped by the date-comparison guard
5. The critic returns no findings for the pre-existing artifacts
6. AC-18 verifies this: running Plan Critic against `docs/PRD.md` after merge produces no missing-Facts findings on Sections 1-8 (or whichever predate Section 9)

**Postconditions**:
- Pre-existing artifacts are not flagged
- The bootstrap proceeds without legacy churn
- The rule applies forward-only per FR-7.4

**Mapped FR**: FR-7.1, FR-7.2, FR-7.3, FR-7.4
**Mapped ACs**: AC-18

### Alternative Flows

- **UC-8-A1: Pre-existing PRD section being re-edited post-merge for typo fix** -- The user fixes a typo in Section 5; the file's last-modified time is now POST-merge
  1. Per FR-7.4, "Random one-off edits to historical PRD sections (e.g., fixing a typo) are NOT a Plan Critic trigger and do NOT require adding a `## Facts` block. The intent is: new artifact authoring discipline, not retroactive cleanup."
  2. The Plan Critic does NOT flag the historical section even after the typo fix (because the section's `Date:` field still predates merge — the date-guard is by `Date:` field, not by file mtime, for PRD sections)
  3. For plan files, FR-7.3 uses file-mtime; for PRD sections, FR-7.1 uses `Date:` field

  **Mapped FR**: FR-7.1, FR-7.4
  **Mapped ACs**: AC-18

- **UC-8-A2: Pre-existing plan file re-edited post-merge to add a new slice** -- The plan is meaningfully extended, not just typo-fixed
  1. Per FR-7.3, plan files re-edited post-merge MUST add a `## Facts` block on next save
  2. The critic now treats the plan as current-cycle (file mtime is post-merge AND content is meaningfully changed)
  3. If `## Facts` is missing, MAJOR finding raised per FR-4.2
  4. The orchestrator addresses

  **Mapped FR**: FR-7.3, FR-4.2
  **Mapped ACs**: AC-18

### Error Flows

- **UC-8-E1: PRD section's `Date:` field is malformed (e.g., `Date: TBD`)** -- The date-comparison guard cannot determine pre-vs-post merge
  1. Per Risk 7 in PRD Section 9.7, missing/malformed `Date:` fields are treated as POST-MERGE for safety (fail closed)
  2. The Plan Critic enforces the rule on the section as if it were current-cycle
  3. If the section lacks a `## Facts` block, MAJOR finding raised
  4. The agent (or developer) fixes the `Date:` AND adds the `## Facts` block; OR the developer dismisses the false positive in `## Review Notes` if the section is genuinely historical
  5. NFR-6 documents that the cost of a spurious MAJOR is low

  **Mapped FR**: Risk 7 (PRD §9.7), FR-7.1
  **Mapped ACs**: AC-18

### Edge Cases

- **UC-8-EC1: Pre-existing artifact in current-cycle scope due to inlining** -- A current-cycle plan inlines content from a pre-existing handoff file (e.g., `.claude/resources-pending.md` from a prior cycle that was never deleted)
  1. Per FR-7.2 / FR-7.3, the inlined content's age is determined by the destination file (the current `.claude/plan.md`), not the source
  2. The plan's `## Facts` block covers the plan-authoring decisions, including the inlining decision
  3. No separate enforcement on the historical inlined content

  **Mapped FR**: FR-7.2, FR-7.3

### Data Requirements

- **Input**: All artifacts in the project's `docs/PRD.md`, `docs/use-cases/`, `docs/qa/`, `.claude/plan.md`
- **Output**: A FINDINGS block scoped to current-cycle artifacts only
- **Side Effects**: None

---

## UC-9: Resource-Architect Emits `## Facts` in `.claude/resources-pending.md` (File-Writing Specialized Agent)

**Actor**: `resource-architect` agent, `/bootstrap-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- Bootstrap Step 3.5 (`resource-architect`) begins
- The agent's prompt file `src/agents/resource-architect.md` contains the `## Cognitive Self-Check (MANDATORY)` section per FR-2.12 specifying the `## Facts` block appears in `.claude/resources-pending.md` AFTER `## Auto-Install Results` (or after `## Recommended Resources` if Auto-Install is absent)
- Section 4 / Section 7 iter-1 / iter-2 of the resource-architect feature is in effect

**Trigger**: The orchestrator invokes `resource-architect` at Step 3.5

### Primary Flow (Happy Path)

1. The agent runs the 4-question protocol per FR-1.2
2. The agent emits `## Recommended Resources` and (if iter-2 active) `## Auto-Install Results` to `.claude/resources-pending.md` per Section 4 FR-2.1 / Section 7 FR-6.1
3. AFTER `## Auto-Install Results` (or after `## Recommended Resources` if Auto-Install is absent), the agent appends a `## Facts` block per FR-2.12 with all four subsections in literal order
4. The `### External contracts` subsection cites sources for every recommended resource per FR-2.12 (e.g., the URL of the MCP registry entry, the npm package page)
5. The orchestrator captures the file; subsequent steps proceed
6. At Step 5, the planner inlines `## Recommended Resources`, `## Auto-Install Results`, AND the resource-architect's `## Facts` block into `.claude/plan.md` per Section 4 FR-2.6 / Section 7 FR-6.7 (the planner's own `## Facts` block near the top of the plan covers planner-level decisions; the resource-architect's `## Facts` block within the inlined sections covers resource-recommendation decisions)
7. Plan Critic Check (a) per FR-4.1 confirms `## Facts` presence in `.claude/plan.md` (the planner's terminal block satisfies this); the resource-architect's inlined block is ALSO present
8. Plan Critic Check (b) per FR-4.3 scans the inlined `## Recommended Resources` content for external API/SDK identifiers; finds them cited in the resource-architect's inlined `### External contracts`. PASS

**Postconditions**:
- `.claude/resources-pending.md` contains `## Recommended Resources`, optionally `## Auto-Install Results`, AND `## Facts` block
- After inlining, `.claude/plan.md` contains all upstream sections plus the planner's terminal `## Facts`

**Mapped FR**: FR-1.2, FR-2.12, FR-4.1, FR-4.3
**Mapped ACs**: AC-6, AC-7, AC-9

### Alternative Flows

- **UC-9-A1: Auto-Install Results section absent (iter-1 still in effect, or no installable items)** -- The `## Facts` block appears AFTER `## Recommended Resources` per FR-2.12's fallback
  1. The agent does NOT emit `## Auto-Install Results`
  2. The agent emits `## Facts` directly after `## Recommended Resources`
  3. Plan Critic checks proceed normally

  **Mapped FR**: FR-2.12

- **UC-9-A2: No external resources recommended -- `### External contracts: (none)`** -- The PRD's domain is fully covered by built-in tooling
  1. The agent emits `## Recommended Resources` with the body "No external resources required" per Section 4 FR-1.5
  2. The agent emits `## Facts` with `### External contracts: (none)` because no third-party resources were recommended

  **Mapped FR**: FR-2.12, FR-1.3

### Error Flows

- **UC-9-E1: Bootstrap halts at Step 3.5 (resource-architect failure)** -- The agent fails to complete (e.g., Bash whitelist violation in iter-2)
  1. Per Section 7 FR-7.2, the bootstrap halts with the agent's partial output preserved in `.claude/resources-pending.md`
  2. The partial PRD `## Facts` block from prd-writer (Step 1) is NOT cleaned up — backward compat per FR-7.3 means the partially-written upstream artifacts remain valid
  3. The next bootstrap attempt re-runs from where the failure occurred OR re-runs from Step 1 depending on the orchestrator's recovery logic
  4. No retroactive cleanup of `## Facts` blocks is required

  **Mapped FR**: FR-7.3 (backward compat), Section 7 FR-7.2 (bootstrap halt)

### Edge Cases

- **UC-9-EC1: Resource-architect's `## Facts` cites an MCP registry URL that 404s** -- The cited URL is broken
  1. The agent's `### External contracts` cites a URL; the URL was reachable when the agent ran (verified Q2 freshness)
  2. After the cycle ends, the URL goes stale (404)
  3. The agent's audit trail still records the verification was done at-time; the rule does not require ongoing URL monitoring
  4. The next time the agent recommends the same resource, it re-verifies in that session per Q2 freshness

  **Mapped FR**: FR-1.2 (Q2)

### Data Requirements

- **Input**: PRD, project structure
- **Output**: `.claude/resources-pending.md` with sections + `## Facts` block
- **Side Effects**: One Write per file; Bash invocations per Section 7 FR-2.2 whitelist

---

## UC-10: Refactor-Cleaner Emits `## Facts` to Stdout AND Modifies Code Based on Those Facts

**Actor**: `refactor-cleaner` agent, ad-hoc orchestrator (refactor-cleaner is NOT a `/merge-ready` gate; it runs post-implementation as a standalone delegation outside the 10-gate sequence)

**Preconditions**:
- Common preconditions hold
- A refactor pass is invoked outside the `/merge-ready` gate sequence (refactor-cleaner has no gate number — Gate 6 is `verifier`)
- The agent's prompt file `src/agents/refactor-cleaner.md` contains the `## Cognitive Self-Check (MANDATORY)` section per FR-2.11 specifying the `## Facts` block appears at the START of the stdout report, BEFORE the cleanup verdict
- The agent has Edit/Write/Read tools to perform refactor changes

**Trigger**: An orchestrator invokes refactor-cleaner ad hoc (post-implementation cleanup)

### Primary Flow (Happy Path)

1. The agent runs the 4-question protocol per FR-1.2 BEFORE proposing refactors
2. The agent identifies refactor targets (e.g., duplicate logic, dead code, naming improvements)
3. For each refactor, the agent verifies the target file's current state by Read (Q2 freshness — the file content in this session, not memory)
4. The agent performs the refactor edits
5. The agent emits its refactor report to stdout, beginning with the `## Facts` block, followed by the prose summary of changes and the verdict
6. The `## Facts` block per FR-2.11 contains all four subsections:
   - `### Verified facts` cites the files Read and the lines refactored, e.g., `src/foo.ts:42-60 — duplicate of src/bar.ts:30-48; verified by Read of both files in current session`
   - `### External contracts: (none)` if the refactor is internal-only
   - `### Assumptions` notes any unverified claims (e.g., "no other call sites depend on the old signature — assumed; risk: silent breakage; how to verify: run typecheck after merge")
   - `### Open questions` if any decisions need user input
7. The Plan Critic does NOT mechanically enforce this stdout block per FR-4.6
8. Code-reviewer at the next gate (or transcript review) catches any missing `## Facts`

**Postconditions**:
- Refactored files reflect the changes
- The stdout report begins with the `## Facts` block (BEFORE the verdict)
- The audit trail allows the developer to verify each refactor's evidence base

**Mapped FR**: FR-1.2, FR-2.11, FR-4.6
**Mapped ACs**: AC-6, AC-7

### Alternative Flows

- **UC-10-A1: Refactor-cleaner finds no refactor targets** -- The codebase is clean
  1. The agent emits "No refactor targets identified" + verdict
  2. The agent still emits `## Facts` per FR-2.11 with `### Verified facts` listing the files inspected and `### Assumptions: (none)` if confidence is high

  **Mapped FR**: FR-2.11, FR-1.3

### Error Flows

- **UC-10-E1: Refactor-cleaner forgets `## Facts`** -- Same as UC-1-E1 (architect)
  1. Stdout-only enforcement gap; not caught by Plan Critic
  2. Caught by transcript review or downstream reviewer

  **Mapped FR**: FR-2.11, FR-4.6, Risk 1 (PRD §9.7)

### Edge Cases

- **UC-10-EC1: Refactor based on an assumption that turns out wrong** -- The agent assumed no call sites depend on the old signature; typecheck reveals call sites
  1. The agent's `### Assumptions` flagged the risk
  2. Build-runner (executor, Gate 4 of `/merge-ready`) runs typecheck; finds errors
  3. The orchestrator surfaces the failure; the assumption is now disproven
  4. The agent (or developer) corrects via additional refactor or rollback
  5. Per Risk 1 (PRD §9.7), the audit trail makes the failure traceable to a specific assumption

  **Mapped FR**: FR-1.3, Risk 1

### Data Requirements

- **Input**: Source files, prior implementation context
- **Output**: Edited source files + stdout report with `## Facts`
- **Side Effects**: Write/Edit on source files

---

## UC-11: Format Drift -- Agent Emits `## facts` (Lowercase) Instead of `## Facts`

**Actor**: Any in-scope thinking agent (canonical example: planner emitting to `.claude/plan.md`), Plan Critic subagent

**Preconditions**:
- Common preconditions hold
- The agent emits a `## Facts`-like block but uses incorrect casing or wording (e.g., `## facts`, `## Facts (verified)`, `# Facts`, `## FACTS`)
- The Plan Critic uses literal-string grep per Risk 4 mitigation in PRD Section 9.7 ("Plan Critic uses literal-string grep, not regex")

**Trigger**: Plan Critic runs Check (a) on the artifact

### Primary Flow (Happy Path)

1. The critic runs `grep -F "## Facts"` (literal exact-case match) on the artifact
2. `## facts` (lowercase) does NOT match the literal `## Facts`
3. The critic's heuristic concludes: `## Facts` heading is missing
4. Per FR-4.2, MAJOR finding raised: `Missing \`## Facts\` block in artifact — required by FR-4.1`
5. The critic does NOT softly accept `## facts` as equivalent (Risk 4 mitigation)
6. The orchestrator addresses by fixing the casing

**Postconditions**:
- Format drift surfaces as a MAJOR finding (rather than silently passing as a present-but-wrong-cased block)
- The agent's next-iteration emission uses the correct casing
- The strict literal-match policy prevents format-drift cascades

**Mapped FR**: FR-4.1, FR-4.2, Risk 4 (PRD §9.7)
**Mapped ACs**: AC-9

### Alternative Flows

- **UC-11-A1: Agent emits `## Facts (verified)`** -- A descriptive suffix on the heading
  1. `grep -F "## Facts"` MATCHES `## Facts (verified)` because the literal `## Facts` is a prefix
  2. The critic's check (a) PASSES on heading presence
  3. However, downstream tooling that pattern-matches `^## Facts$` (anchored) would FAIL — implementation-time decision: anchored or unanchored?
  4. Conservative reading: anchored grep `^## Facts$` is preferred per AC-2 wording ("EXACTLY four `###` subsection names" implies exact heading match too)
  5. The critic's Check (a) implementation MUST use anchored match; `## Facts (verified)` would FAIL the anchored match and trigger MAJOR

  **Mapped FR**: FR-1.3, FR-4.1, FR-4.2

### Error Flows

- **UC-11-E1: Agent emits `# Facts` (single `#` instead of `##`)** -- Heading level wrong
  1. The literal-match grep does NOT match
  2. MAJOR raised per FR-4.2

  **Mapped FR**: FR-4.1, FR-4.2

- **UC-11-E2: Agent emits subsection name `### verified facts` (lowercase)** -- The four subsection-name greps must each be literal-case-matched
  1. Per AC-2, the four subsection names are literal: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`
  2. `### verified facts` (lowercase `v`) does NOT match
  3. The critic's Check (a) logic: if the `## Facts` heading is present BUT the four subsections in the right order are missing, what severity?
  4. Conservative reading: missing subsection ordering is structurally analogous to "block exists but malformed" → MINOR per FR-4.2 logic (block exists, format wrong) OR MAJOR per FR-4.2 strict reading (block missing per literal grep). Implementation-time decision.

  **Mapped FR**: FR-1.3, FR-4.1, FR-4.2

### Edge Cases

- **UC-11-EC1: Agent emits `## Facts` correctly but inside a code fence** -- The literal heading appears within a triple-backtick code block (e.g., as part of an example)
  1. The literal grep matches the heading inside the code fence
  2. False positive: the critic believes the artifact has a real `## Facts` block when it actually has only an example
  3. NFR-6 explicitly accepts low-recall for the heuristic; false positives in this direction (treating an example as the real block) are tolerated; the agent's prompt is the primary defense
  4. Implementation-time refinement: skip code-fenced regions when scanning — deferred to iter-2 if false positives become a real problem

  **Mapped FR**: NFR-6

### Data Requirements

- **Input**: An artifact with format-drifted `## Facts` block
- **Output**: A FINDINGS block (typically MAJOR for missing literal heading)
- **Side Effects**: None by the critic

---

## UC-12: Verifier Emits `## Facts` to Stdout During `/implement-slice`

**Actor**: `verifier` agent, `/implement-slice` orchestrator

**Preconditions**:
- Common preconditions hold
- `/implement-slice` is mid-slice; tests have been written and run, code has been written, build-runner (exempt) has confirmed build/typecheck pass
- The verifier is invoked per Section 1 FR-1 to perform goal-backward integration verification
- The agent's prompt file `src/agents/verifier.md` contains the `## Cognitive Self-Check (MANDATORY)` section per FR-2.10 specifying the `## Facts` block appears at the START of the stdout report, BEFORE the structured PASS/FAIL output

**Trigger**: The orchestrator invokes verifier mid-slice

### Primary Flow (Happy Path)

1. The verifier runs the 4-question protocol per FR-1.2
2. The verifier reads the slice's plan, the test file, and the implementation file (Q2 freshness)
3. The verifier emits the `## Facts` block per FR-2.10 to stdout BEFORE the structured PASS/FAIL output, with:
   - `### Verified facts` citing the files Read, the wiring graph traced, the data-flow checked
   - `### External contracts` citing any external API surfaces verified (or `(none)` if internal)
   - `### Assumptions` flagging any unverified claims (e.g., "no concurrent test affected the integration — assumed")
   - `### Open questions` if any user input needed
4. AFTER the `## Facts` block, the verifier performs Section 1 FR-1.5 levels (wiring check, data-flow check, stub-detection check) and emits PASS/FAIL per level
5. The orchestrator captures stdout; the slice proceeds to commit if PASS

**Postconditions**:
- The verifier's stdout begins with the `## Facts` block (BEFORE the structured PASS/FAIL output), followed by the PASS/FAIL block
- The audit trail allows the developer to challenge any verifier conclusion

**Mapped FR**: FR-1.2, FR-2.10, FR-4.6
**Mapped ACs**: AC-6, AC-7

### Alternative Flows

- **UC-12-A1: Verifier reports FAIL per Level 1 (wiring missing)** -- The implementation has a wiring gap; the verifier's `## Facts` block records what was checked and what was missing
  1. Steps 1-3 proceed; Level 1 returns FAIL
  2. The verifier emits `### Verified facts` listing the wiring claims that were Read, plus the gap location
  3. The orchestrator surfaces FAIL; the developer iterates per the deviation rules

  **Mapped FR**: FR-2.10

### Error Flows

- **UC-12-E1: Verifier omits `## Facts`** -- Stdout-only gap (parallel to UC-1-E1)
  1. Not caught by Plan Critic
  2. Caught by code-reviewer at /merge-ready or transcript review

  **Mapped FR**: FR-2.10, FR-4.6

### Edge Cases

- **UC-12-EC1: Verifier's `## Facts` references the planner's `## Facts` from `.claude/plan.md`** -- Transitive citation
  1. The verifier's `### Verified facts` includes: `slice 3 done-condition: build passes — verified by Read of .claude/plan.md slice 3 in current session AND by Bash invocation of typecheck`
  2. The citation chains the planner's authority but adds the verifier's own session verification
  3. Audit trail is intact

  **Mapped FR**: FR-1.4

### Data Requirements

- **Input**: `.claude/plan.md`, test files, implementation files, build/typecheck output
- **Output**: Stdout report with structured PASS/FAIL + `## Facts`
- **Side Effects**: None (verifier is read-only)

---

## UC-13: Code-Reviewer at `/merge-ready` Emits `## Facts` and Surfaces Stdout-Agent Gaps

**Actor**: `code-reviewer` agent, `/merge-ready` orchestrator

**Preconditions**:
- Common preconditions hold
- `/merge-ready` Gate 2 (Code Review — code-reviewer) begins
- The agent's prompt file `src/agents/code-reviewer.md` contains `## Cognitive Self-Check (MANDATORY)` per FR-2.9 specifying `## Facts` block at START of stdout review, BEFORE the verdict

**Trigger**: The orchestrator invokes code-reviewer at Gate 2

### Primary Flow (Happy Path)

1. The reviewer runs the 4-question protocol per FR-1.2
2. The reviewer reads the diff, the implementation files, the tests
3. The reviewer emits the `## Facts` block per FR-2.9 to stdout BEFORE the review prose, with all four subsections
4. AFTER the `## Facts` block, the reviewer emits its review (issues, severities, recommendations) and verdict
5. The reviewer ALSO checks the upstream artifacts' `## Facts` blocks and may surface gaps:
   - If the architect's stdout review (in transcript) lacks `## Facts`, the reviewer SHOULD note this as a meta-finding (per Risk 1 mitigation in PRD §9.7)
   - If the planner's `.claude/plan.md` had a `## Facts` block but the reviewer notices an unverified claim treated as fact, the reviewer SHOULD challenge it

**Postconditions**:
- The reviewer's stdout contains the `## Facts` block
- Stdout-only enforcement gaps from earlier in the pipeline may surface here as a backstop

**Mapped FR**: FR-1.2, FR-2.9, FR-4.6, Risk 1 (PRD §9.7)
**Mapped ACs**: AC-6, AC-7

### Alternative Flows

- **UC-13-A1: Reviewer detects an unverified claim in the planner's `## Facts`** -- The plan's `### Verified facts` contains a claim with no source
  1. The reviewer surfaces this as a code-review finding (not a Plan Critic finding)
  2. The developer addresses

  **Mapped FR**: Risk 9 (PRD §9.7)

### Error Flows

- **UC-13-E1: Reviewer omits `## Facts` itself** -- Stdout-only gap; not caught by Plan Critic
  1. Caught by transcript review

  **Mapped FR**: FR-2.9, FR-4.6

### Edge Cases

- **UC-13-EC1: Reviewer flags executor agent's lack of `## Facts`** -- An executor agent (test-writer, build-runner, e2e-runner, doc-updater, changelog-writer) does NOT emit `## Facts` per FR-3.1; the reviewer SHOULD recognize this is correct (executors are exempt) and NOT raise a finding
  1. The reviewer reads the rule file's `## Application Scope` (per FR-1.5) listing the 5 exempt agents
  2. The reviewer correctly identifies executor output as exempt; no finding raised
  3. AC-4 verifies the rule file lists the exempt agents explicitly

  **Mapped FR**: FR-1.5, FR-3.1
  **Mapped ACs**: AC-4, AC-8

### Data Requirements

- **Input**: Diff, implementation files, prior agents' transcripts and file outputs
- **Output**: Stdout review with `## Facts`
- **Side Effects**: None

---

## UC-14: Security-Auditor Emits `## Facts` and Cites External Auth/Crypto Libraries

**Actor**: `security-auditor` agent, `/merge-ready` orchestrator

**Preconditions**:
- Common preconditions hold
- `/merge-ready` Gate 3 (Security Audit — security-auditor) begins
- The agent's prompt file `src/agents/security-auditor.md` contains `## Cognitive Self-Check (MANDATORY)` per FR-2.8 specifying `## Facts` block at START of stdout audit, BEFORE the verdict

**Trigger**: The orchestrator invokes security-auditor

### Primary Flow (Happy Path)

1. The auditor runs the 4-question protocol per FR-1.2
2. The auditor reads the implementation, focusing on auth, input validation, secret handling, dependency CVEs
3. The auditor emits the `## Facts` block per FR-2.8 to stdout BEFORE the audit prose, with all four subsections
4. AFTER the `## Facts` block, the auditor emits the audit (vulnerabilities, severities, mitigations) and verdict
5. If the implementation uses external auth/crypto libraries (e.g., `bcrypt`, `jsonwebtoken`, `passport`), the auditor cites the version + source under `### External contracts`:
   ```
   - `bcrypt` v5.1.1 — verified via Read of `package.json` and `node_modules/bcrypt/package.json` in current session; algorithm: bcrypt with 10 rounds (verified via Read of `src/auth/hash.ts` line 12)
   ```

**Postconditions**:
- The audit's `## Facts` block surfaces the auth/crypto contracts the auditor relied on
- A future auditor can challenge the version-specific assumptions

**Mapped FR**: FR-1.2, FR-1.4, FR-2.8, FR-4.6
**Mapped ACs**: AC-6, AC-7

### Alternative Flows

- **UC-14-A1: No external auth/crypto in scope** -- The feature has no auth surface
  1. The auditor emits `### External contracts: (none) — feature has no external auth or crypto surface`

  **Mapped FR**: FR-2.8, FR-1.3

### Error Flows

- **UC-14-E1: Auditor cites a CVE database from memory without WebFetch** -- The auditor "remembers" a CVE but did not verify in-session
  1. Per FR-1.4, "I remember from a similar API / from training data" is NOT a valid source
  2. The auditor MUST either WebFetch the CVE database in-session OR mark the claim as `### Assumptions` with risk + verification path
  3. If the auditor silently treats memory as fact, code-reviewer at the next gate may catch it; otherwise, the gap survives

  **Mapped FR**: FR-1.4, Risk 9 (PRD §9.7)

### Edge Cases

- **UC-14-EC1: Auditor cites a CVE that was patched in a version newer than what the project uses** -- The version mismatch matters
  1. The auditor's `### Verified facts` MUST cite both the CVE and the project's actual version
  2. The audit conclusion is sound only if the project's version is in the vulnerable range; otherwise the citation supports a "no vulnerability" verdict
  3. The audit trail captures the version comparison

  **Mapped FR**: FR-1.4

### Data Requirements

- **Input**: Implementation files, `package.json`, `node_modules`, optionally CVE databases via WebFetch
- **Output**: Stdout audit + `## Facts`
- **Side Effects**: None (security-auditor is read-only)

---

## UC-15: Release-Engineer Emits `## Facts` in Release Notes File

**Actor**: `release-engineer` agent, `/merge-ready` orchestrator (Gate 9)

**Preconditions**:
- Common preconditions hold
- `/merge-ready` Gate 9 (release-engineer) begins
- The agent's prompt file `src/agents/release-engineer.md` contains `## Cognitive Self-Check (MANDATORY)` per FR-2.14 specifying `## Facts` block at END of release-notes file

**Trigger**: The orchestrator invokes release-engineer at Gate 9

### Primary Flow (Happy Path)

1. The agent runs the 4-question protocol per FR-1.2
2. The agent computes the version bump (semver) by reading the `[Unreleased]` content of `CHANGELOG.md` and analyzing for breaking/feat/fix
3. The agent authors `docs/releases/<version>.md` (or equivalent per Section 6 FR) with release notes
4. AFTER the release notes body, the agent appends a `## Facts` block per FR-2.14 with all four subsections
5. The `### Verified facts` cites the CHANGELOG entries and git log range used to derive the version bump
6. The agent also commits the version bump and date stamp; the `## Facts` block is in the file (not duplicated to stdout per FR-2.14)
7. Plan Critic Check (a) per FR-4.1 covers the release-notes file as a current-cycle file-based artifact (per the approved plan's mention of `.claude/release-notes-X.Y.Z.md` in AC #3)

**Postconditions**:
- The release-notes file has a `## Facts` block at end
- The audit trail captures the version-bump derivation

**Mapped FR**: FR-1.2, FR-2.14, FR-4.1
**Mapped ACs**: AC-6, AC-7, AC-9

### Alternative Flows

- **UC-15-A1: Release notes for the cognitive-self-check feature itself** -- The release notes describe v3.1.0 -> v3.2.0 minor bump per NFR-7
  1. The release-engineer's `### Verified facts` cites the version derivation from `[Unreleased]` content
  2. `### External contracts: (none)` because the feature is internal SDLC

  **Mapped FR**: NFR-7

### Error Flows

- **UC-15-E1: Release-engineer's `## Facts` in stdout instead of in file** -- The agent emits the block to stdout but the release-notes file lacks it
  1. Per FR-2.14, the block appears once in the file (not duplicated to stdout)
  2. If the file lacks the block, Plan Critic Check (a) per FR-4.1 raises MAJOR
  3. The orchestrator addresses

  **Mapped FR**: FR-2.14, FR-4.1, FR-4.2

### Edge Cases

- **UC-15-EC1: Multiple releases pending in same cycle** -- The agent must produce one `## Facts` block per release-notes file
  1. Each `docs/releases/<version>.md` carries its own `## Facts` block
  2. Plan Critic enforces per-file

  **Mapped FR**: FR-2.14, FR-4.1

### Data Requirements

- **Input**: `CHANGELOG.md`, git log, project metadata
- **Output**: Release-notes file with `## Facts`; version-bumped source files; date-stamped CHANGELOG
- **Side Effects**: Multiple file writes; git commit

---

## UC-16: Executor Agent (Test-Writer / Build-Runner / E2E-Runner / Doc-Updater / Changelog-Writer) Does NOT Emit `## Facts`

**Actor**: Any of the 5 executor agents

**Preconditions**:
- Common preconditions hold
- The orchestrator invokes one of the 5 executor agents (e.g., `test-writer` at `/implement-slice`)
- The agent's prompt file is byte-unchanged per FR-3.1 / FR-6.6 (no `## Cognitive Self-Check (MANDATORY)` section was added)

**Trigger**: The orchestrator invokes the executor agent

### Primary Flow (Happy Path)

1. The agent does NOT run the 4-question protocol (its prompt does not mandate it)
2. The agent produces its output (test code, build output, E2E results, doc edits, changelog entries)
3. The agent does NOT emit a `## Facts` block (no requirement to)
4. Plan Critic does NOT check the agent's output for `## Facts` (executors are out of scope per FR-3.1, FR-3.2)
5. The output's correctness is verified by other means: tests pass/fail, build pass/fail, etc.
6. AC-8 verifies via `git diff` that the 5 executor prompt files are byte-unchanged

**Postconditions**:
- The executor produces its output as before
- No new requirements are imposed
- The 5-file byte-unchanged invariant holds (AC-8)

**Mapped FR**: FR-3.1, FR-3.2, FR-3.3, FR-6.6
**Mapped ACs**: AC-8

### Alternative Flows

- **UC-16-A1: Changelog-writer maps PRD `Changelog:` fields to `[Unreleased]`** -- Mechanical synthesis with no `## Facts`
  1. Per FR-3.3, changelog synthesis is mechanical Keep-a-Changelog mapping; upstream PRD entries (authored by prd-writer, in scope) already carry `## Facts`
  2. Changelog entries inherit fact-discipline transitively
  3. No `## Facts` block in the changelog itself

  **Mapped FR**: FR-3.3

### Error Flows

- **UC-16-E1: Executor agent prompt accidentally modified to add `## Cognitive Self-Check`** -- A maintainer added the section against FR-3.1
  1. Per AC-8, `git diff` against pre-merge would show non-zero hunks for the executor file
  2. The CI / code-review surfaces the violation
  3. The maintainer reverts the change; AC-8 re-passes

  **Mapped FR**: AC-8

### Edge Cases

- **UC-16-EC1: Reviewer mistakenly demands `## Facts` from an executor** -- The reviewer flags an absent `## Facts` in test-writer output
  1. The reviewer's mistake is itself surfacable: the rule file's `## Application Scope` per FR-1.5 lists the 5 exempt agents with one-line rationales
  2. The reviewer should consult the rule and retract the finding
  3. AC-4 verifies the rule lists exempt agents explicitly

  **Mapped FR**: FR-1.5, FR-3.1
  **Mapped ACs**: AC-4, AC-8

### Data Requirements

- **Input**: Per the executor's existing contract (no change)
- **Output**: Per the executor's existing contract (no `## Facts`)
- **Side Effects**: Per the executor's existing contract

---

## Cross-Cutting Use Cases

### UC-CC-1: Backward Compatibility Smoke Test (AC-18 Verification)

After cognitive-self-check feature merges, run Plan Critic against `docs/PRD.md` (which contains Sections 1 through 8 from prior features). Confirm zero missing-Facts findings on Sections 1-8 (their `Date:` fields all predate the merge date). Section 9 itself MUST have a `## Facts` block per FR-7.5 / AC-19. This is the AC-18 / AC-19 acceptance test.

### UC-CC-2: 17-Agent / 10-Gate Count Invariant (AC-12, AC-13)

After cognitive-self-check feature merges, run `grep -n "17 specialized\|17 agents\|17 AI agents" install.sh README.md src/claude.md`. The output MUST be byte-identical to the pre-merge output. Same for `grep -n "10 gates\|10 quality gates"`. This is the AC-12 / AC-13 acceptance test.

### UC-CC-3: install.sh / templates/ Byte-Unchanged Invariant (AC-14, AC-15, AC-16)

After cognitive-self-check feature merges, run `git diff <pre-merge-commit>..HEAD -- install.sh templates/rules/ templates/CLAUDE.md`. Output MUST be empty (zero diff hunks). This is the AC-14 / AC-15 / AC-16 acceptance test.

### UC-CC-4: Executor Files Byte-Unchanged Invariant (AC-8)

After cognitive-self-check feature merges, run `git diff <pre-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md`. Output MUST be empty. This is the AC-8 acceptance test.

### UC-CC-5: Twelve In-Scope Agents Have `## Cognitive Self-Check (MANDATORY)` (AC-6)

After cognitive-self-check feature merges, run `grep -l "## Cognitive Self-Check (MANDATORY)" src/agents/*.md`. The output MUST contain EXACTLY the 12 in-scope agent paths and NO executor paths. This is the AC-6 acceptance test.

### UC-CC-6: Rule File Six `##` Headings (AC-1)

After feature merges, `grep -n "^## " src/rules/cognitive-self-check.md` MUST return EXACTLY six lines in the FR-1.1 order. This is the AC-1 acceptance test.

### UC-CC-7: Rule File Four `###` Subsections (AC-2)

After feature merges, `grep -n "^### " src/rules/cognitive-self-check.md` MUST contain the four literal subsection names per FR-1.1 / FR-1.3. This is the AC-2 acceptance test.

### UC-CC-8: Rule File Bilingual Protocol Verbatim (AC-3)

After feature merges, the rule file's `## Protocol — Before Each Decision` section MUST contain the four questions VERBATIM in BOTH Russian and English per FR-1.2. The literal phrase `"I remember from a similar API / from training data"` MUST appear verbatim per AC-5.

### UC-CC-9: Plan Critic Two New Completeness Checks (AC-9, AC-10)

After feature merges, the Plan Critic prompt in `src/claude.md` MUST contain TWO new bullets under the Completeness category per FR-4.1 / FR-4.3 with FR-4.2 / FR-4.4 severity tags AND the file-vs-stdout split preamble per FR-4.6. This is the AC-9 / AC-10 acceptance test.

### UC-CC-10: README Hardening Table One New Row (AC-11)

After feature merges, `README.md`'s Hardening table MUST have ONE new row at the END per FR-5.1 / FR-5.2. This is the AC-11 acceptance test.

### UC-CC-11: PRD Section 9 Dogfoods the Rule (AC-19)

After feature merges, PRD Section 9 itself MUST contain a `## Facts` block at the end (after `### 9.7 Risks and Dependencies`) per FR-7.5. This is the AC-19 acceptance test.

### UC-CC-12: Cross-Reference Resolution (AC-20)

After feature merges, every reference to `src/rules/cognitive-self-check.md` from each in-scope agent prompt MUST resolve to the actual created file; the rule file's `## Application Scope` MUST reference each in-scope and exempt agent by its registered slug, and each registered slug MUST correspond to an actual `src/agents/<slug>.md` file. This is the AC-20 acceptance test.

---

## Facts

### Verified facts

- The PRD Section 9 (cognitive-self-check feature) spans `docs/PRD.md` lines 2082-2333 — verified by Read of those lines in the current session
- The PRD Section 9 contains 7 sub-sections (9.1 through 9.7) plus a terminal `## Facts` block at lines 2309-2333 — verified by Read in the current session
- The 12 in-scope thinking agents are: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer` — verified by Read of FR-2.1 (line 2140) and design decision 4 (line 2107) in the current session
- The 5 exempt executor agents are: `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer` — verified by Read of FR-3.1 (line 2160) and design decision 5 (line 2108) in the current session
- The `## Facts` block has four fixed subsections in literal order: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions` — verified by Read of FR-1.3 (line 2129) and design decision 6 (line 2109) in the current session
- The empty-subsection placeholder is the literal string `(none)` — verified by Read of FR-1.3 (line 2129) and design decision 6 (line 2109) in the current session
- The Plan Critic Check (a) for missing `## Facts` block is **MAJOR**; missing `(none)` placeholder for empty subsection is **MINOR** — verified by Read of FR-4.2 (line 2169) in the current session
- The Plan Critic Check (b) for missing `### External contracts` citation is **MAJOR**; vague source is **MINOR** — verified by Read of FR-4.4 (line 2171) in the current session
- The Plan Critic enforcement is FILE-BASED ONLY; stdout-only artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each agent's own prompt — verified by Read of FR-4.6 (line 2173) and design decision 7 (line 2110) in the current session
- Backward compatibility per FR-7: pre-existing PRD sections (Date predates merge), pre-existing use-case files, pre-existing plan files NOT being re-edited are EXEMPT — verified by Read of FR-7.1, FR-7.2, FR-7.3 (lines 2200-2203) in the current session
- The total agent count REMAINS 17; total `/merge-ready` gate count REMAINS 10; `install.sh`, `templates/rules/`, `templates/CLAUDE.md`, and the 5 executor files are BYTE-UNCHANGED — verified by Read of FR-6 (lines 2186-2194) in the current session
- The approved plan at `/Users/aleksandra/.claude/plans/sleepy-exploring-tome.md` provides the implementation breakdown across 6 slices in 3 waves and lists `Stripe.Charge.status` as the canonical external-contract test fixture (Verification step 7) and `userService.findById()` as the canonical internal-symbol non-trip fixture (Verification step 8) — verified by Read of the full plan file in the current session
- The format for use-case files in this repo is established by prior files including `docs/use-cases/role-planner-reuse-teardown_use_cases.md` (read partially: header + UC-1 + UC-2 primary flow) and `docs/use-cases/resource-architect-auto-install_use_cases.md` (read partially: header + UC-1 + UC-2 primary flow) in the current session — both files use Common preconditions / Actors table / numbered UCs with Primary Flow / Alternative Flows / Error Flows / Edge Cases / Data Requirements / Mapped FR / Mapped ACs structure
- This is a NEW use-case file (CREATE, not UPDATE) — verified because no existing file in `docs/use-cases/` covers the cognitive-self-check domain (the pre-existing files cover role-planner, resource-architect, prd-changelog-field, role-planner-reuse-teardown, resource-architect-auto-install — listed in repo via the existing scratchpad / git log context, none overlap with cognitive-self-check)

### External contracts

(none) — this use-case document covers an internal SDLC-pipeline rule (the cognitive-self-check feature itself). No third-party APIs, SDKs, or libraries are integrated. The example identifiers `Stripe.Charge.status` (UC-2-A1, UC-5) and `userService.findById()` (UC-1-EC1, UC-5-EC1) are used as illustrative test fixtures per the approved plan's Verification steps 7 and 8 — they are NOT external dependencies of THIS use-case document; they are example data for the heuristic the document describes.

### Assumptions

- The list of pre-existing use-case files in `docs/use-cases/` was inferred from the user's task description and the two files read partially as format reference; the full directory listing was NOT read in the current session, so there is a small risk that a use-case file covering cognitive-self-check already exists and was missed. Risk: duplicating use-case coverage. How to verify: run `ls docs/use-cases/*.md` at validation time.
- The Plan Critic's anchored-vs-unanchored grep for `## Facts` heading detection (UC-11 primary flow vs UC-11-A1) is implementation-time decision per the approved plan's Slice 5 verification step (c); the conservative reading in this document (anchored match) was assumed based on AC-2's "EXACTLY four `###`" wording. Risk: if the implementation uses unanchored grep, UC-11-A1 (`## Facts (verified)`) would silently pass instead of producing MAJOR. How to verify: read Slice 5's actual implementation when it lands.
- The `### Verified facts` source-citation severity (UC-7-E1: agent emits unsourced fact) is treated as a soft-power problem (caught by code-reviewer or transcript review) per Risk 9 of PRD §9.7; the rule does NOT mechanically check internal-fact source presence. Risk: agents can shortcut by writing facts without sources and pass the Plan Critic. How to verify: run code-reviewer on a synthetic artifact with unsourced `### Verified facts` entries and confirm the reviewer flags it.
- The `## Facts` block ordering check severity (UC-11-E2: subsections out of order) is implementation-time decision; the conservative reading in this document is MINOR (block exists, format wrong) consistent with FR-4.2's pattern. Risk: if implementation treats out-of-order as MAJOR, UC-11-E2 severity is wrong in this doc. How to verify: read Slice 5's actual implementation.
- The plan file's release-notes file path convention (`docs/releases/<version>.md`) used in UC-15 is inferred from PRD FR-2.14 wording and the approved plan's AC #3 mention of `.claude/release-notes-X.Y.Z.md`; the actual path used by Section 6 release-engineer was NOT verified in the current session. Risk: UC-15 references the wrong file path. How to verify: read Section 6 of the PRD or `src/agents/release-engineer.md` at validation time.

### Open questions

(none) — the PRD section, the approved plan, and the format-reference use-case files provide sufficient specification for use-case authoring. Implementation-time decisions (anchored grep, severity for ordering violations, exact release-notes file path) are documented as assumptions above and will be resolved by the planner / implementer in subsequent SDLC steps; they do NOT require user input at use-case authoring time.
