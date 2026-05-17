# Use Cases: Resource Manager-Architect -- Iteration 1 (Mandatory Pipeline Role)

> Based on [PRD](../PRD.md) -- Section 4: Resource Manager-Architect -- Iteration 1: Mandatory Pipeline Role

This document is the blueprint for E2E testing of the new `resource-architect` agent and its pipeline integration at Step 3.5 of `/bootstrap-feature`. Every use case is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`) are referenced by QA test cases and E2E tests.

---

## UC-1: Feature Requires an MCP Tool (Browser Testing)

**Actor**: `resource-architect` agent, invoked by the `/bootstrap-feature` orchestrator at Step 3.5
**Preconditions**:
- `docs/PRD.md` has been written by `prd-writer` at Step 2 and contains a section that mentions browser-based E2E testing (e.g., "FR-2.3 requires browser-based E2E of the checkout flow")
- `docs/use-cases/<feature>_use_cases.md` has been written by `ba-analyst` at Step 2
- The Software Architect at Step 3 has issued a PASS verdict; the architect's verdict text is passed to `resource-architect` as context by the bootstrap command (per FR-1.2 and FR-3.1)
- `.claude/resources-pending.md` does not exist yet (clean branch or previous run deleted it)
- The project's `CLAUDE.md` (or equivalent context file) is readable for tech-stack awareness
- The agent file `src/agents/resource-architect.md` is installed at `~/.claude/agents/resource-architect.md` (per FR-6.6 / AC-8)
- The agent's `tools` frontmatter field excludes `Bash` (per FR-5.7 / AC-12)

**Trigger**: `/bootstrap-feature` reaches Step 3.5 after a successful Step 3 architect PASS and delegates to `resource-architect` with the architect verdict in context

### Primary Flow (Happy Path)

1. The `resource-architect` agent starts and reads its inputs in the FR-1.2 order: (a) `docs/PRD.md` for the current feature section, (b) `docs/use-cases/<feature>_use_cases.md`, (c) the architect's verdict (passed in as context by the bootstrap command), (d) the project's `CLAUDE.md` for tech-stack awareness
2. The agent does NOT read `.claude/scratchpad.md` (per FR-1.2 explicit prohibition)
3. The agent parses the PRD and notes browser-testing scenarios that map to the `MCP` category (per FR-4.2)
4. For the browser-testing requirement, the agent formulates a recommendation entry with all six fields (per FR-1.4):
   - Category: `MCP`
   - Name: `Playwright MCP server`
   - Why: "FR-2.3 requires browser-based E2E testing -- Playwright MCP enables the `e2e-runner` agent to drive a real browser"
   - Install/activate command: `claude mcp add playwright npx @modelcontextprotocol/server-playwright`
   - Cost/complexity flag: `moderate`
   - Reversibility: `easy`
5. The agent produces a summary line above the per-category lists (per FR-1.6): e.g., "1 recommendation total; 0 `expensive`; 0 `hard` reversibility"
6. The agent emits all six category headings in fixed order (per FR-1.7), with the MCP heading carrying the Playwright entry and the other five categories each showing `(none)` underneath
7. The agent writes the full structured output to `.claude/resources-pending.md` in the project CWD (per FR-2.1), starting with the top-level `## Recommended Resources` heading (per FR-2.2)
8. The agent does NOT write to any other file (per FR-2.1 and FR-5.2) -- not `~/.claude/settings.json`, not `.env`, not `docs/PRD.md`, not `.claude/plan.md`, not `.gitignore`
9. The agent does NOT invoke `claude mcp add`, `npm install`, or any shell command (per FR-5.3, FR-5.5, and the Bash-tool exclusion in FR-5.7). The `claude mcp add playwright ...` text is emitted as a copy-paste snippet only
10. The agent does NOT make any network call (per FR-5.6 / NFR-6)
11. The agent returns control to the bootstrap orchestrator; `/bootstrap-feature` proceeds to Step 4 (QA Lead test cases) (per FR-3.1 ordering)
12. Later at Step 5, the planner inlines the temp file as the top section of `.claude/plan.md` (UC-5 covers this handoff)
13. The developer, reading the final `.claude/plan.md`, sees the `## Recommended Resources` section at the top, copies `claude mcp add playwright npx @modelcontextprotocol/server-playwright`, runs it themselves, and proceeds to implement

**Postconditions**:
- `.claude/resources-pending.md` exists with a `## Recommended Resources` heading, a summary line, and six category subsections (MCP populated; five others showing `(none)`)
- The Playwright MCP entry has all six FR-1.4 fields in the specified value domains
- No file other than `.claude/resources-pending.md` was written by the agent
- No `claude mcp add` was executed; no network call was made; no package was installed
- `/bootstrap-feature` has proceeded to Step 4

**Related FR/AC**: FR-1.2, FR-1.3, FR-1.4, FR-1.6, FR-1.7, FR-2.1, FR-2.2, FR-3.1, FR-4.1, FR-4.2, FR-5.2, FR-5.3, FR-5.5, FR-5.6, FR-5.7, FR-6.6 / AC-1, AC-9, AC-12, AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-1-A1: Playwright MCP already installed in the user's Claude Code config** -- The agent performs a defensive read-only check (per the "never write" authority boundary of FR-5.2) of `~/.claude/settings.json` or equivalent, detects that `playwright` is already listed as a configured MCP, and adjusts the recommendation wording
  1. Steps 1-3 proceed as in the primary flow
  2. The agent performs a read-only open of `~/.claude/settings.json` purely to detect installed MCPs. The agent MUST NOT write to this file (per FR-5.2)
  3. The read succeeds and parses; `playwright` appears under the MCPs list
  4. The recommendation for Playwright still appears in the output, but the Install/activate command field is replaced with "Already installed -- no action needed" and a short note tied to the Why field
  5. The summary line counts this as a recommendation but may optionally note the already-installed status
  6. Steps 7-13 proceed unchanged
  7. Side note: the read-only probe is best-effort -- if `~/.claude/settings.json` is absent, unreadable, or in an unexpected format, the agent falls back to the primary flow wording ("run this command to install")

**Postconditions (UC-1-A1)**:
- `.claude/resources-pending.md` shows the Playwright entry with "Already installed" wording in the Install/activate field
- `~/.claude/settings.json` is NOT modified (read-only access)
- All other primary-flow postconditions hold

**Related FR/AC**: FR-5.2, FR-5.6 (no network -- pure local read)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-1-E1: PRD is empty or unreadable** -- Step 3.5 runs but `docs/PRD.md` cannot be read (file missing, permission denied, or empty file)
  1. The `resource-architect` agent starts and attempts to read `docs/PRD.md`
  2. The read fails or returns empty content
  3. The agent returns a structured error to the orchestrator noting the blocker (no PRD to analyze)
  4. Per FR-3.3, `/bootstrap-feature` MUST report the failure to the user and MUST NOT proceed to Step 4. Bootstrap halts at Step 3.5
  5. No `.claude/resources-pending.md` is written (agent did not produce output)
  6. If in a subsequent retry the user re-runs `/bootstrap-feature` after fixing the PRD, the agent runs cleanly per UC-1 primary flow
  7. Because the temp file does not exist, if the planner were somehow invoked (it should NOT be in this failure mode), it would follow the UC-5-E1 silent-skip branch per FR-2.5

**Postconditions (UC-1-E1)**:
- `/bootstrap-feature` has halted at Step 3.5 with an error message to the user
- `.claude/resources-pending.md` does not exist
- Step 4 (QA) did NOT run

**Related FR/AC**: FR-1.2 (PRD is a required input), FR-3.3

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-1-EC1: PRD mentions browser testing but in a deferred/out-of-scope subsection** -- The PRD explicitly marks browser-testing as "out of scope for iteration 1"
  1. The agent reads the PRD and detects that the browser-testing mention is within a deferred-scope section
  2. The agent does NOT recommend Playwright MCP (the resource is not needed for this iteration)
  3. If no other feature needs exist, the agent emits "No external resources required" per FR-1.5 and UC-4 handling
  4. If other resources are still needed, the MCP category shows `(none)` underneath per FR-1.7

**Related FR/AC**: FR-1.5, FR-1.7, FR-4.2

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, `docs/use-cases/<feature>_use_cases.md`, architect verdict (passed as context), `CLAUDE.md`; optionally `~/.claude/settings.json` as a read-only probe (UC-1-A1)
- **Output**: `.claude/resources-pending.md` with the structured markdown fragment; structured summary returned to the bootstrap orchestrator
- **Side Effects**: Exactly one file write to `.claude/resources-pending.md`. No modification of `~/.claude/settings.json`, `.env`, `.gitignore`, `docs/PRD.md`, `.claude/plan.md`, or any other file. No network. No `Bash` tool invocations (mechanically enforced by FR-5.7 tools-frontmatter exclusion).

---

## UC-2: Feature Requires Cloud Compute (GPU Inference at Scale)

**Actor**: `resource-architect` agent, invoked by `/bootstrap-feature` at Step 3.5
**Preconditions**:
- `docs/PRD.md` describes ML model inference at scale (e.g., "FR-4.2 specifies serving a 70B-parameter model at 500 RPS with <200ms latency")
- The architect's verdict has validated the ML approach at Step 3 and is in context
- Use-cases file exists and describes inference-related scenarios
- `.claude/resources-pending.md` does not exist

**Trigger**: `/bootstrap-feature` reaches Step 3.5 for a feature whose PRD requires GPU-backed cloud compute

### Primary Flow (Happy Path)

1. The agent reads PRD + use cases + architect verdict + project CLAUDE.md per FR-1.2
2. The agent identifies the GPU-inference requirement and formulates a recommendation in the `Cloud/Compute` category (per FR-4.3)
3. Entry fields (per FR-1.4):
   - Category: `Cloud/Compute`
   - Name: `AWS EC2 p3.2xlarge (or equivalent GPU-backed instance)`
   - Why: "FR-4.2 requires serving a 70B-parameter model at 500 RPS; CPU inference cannot meet the <200ms latency target"
   - Install/activate command: a short numbered checklist, e.g., "1. Provision p3.2xlarge in target region, 2. Install CUDA drivers per AWS deep-learning AMI, 3. Configure security group for inference port, 4. Record instance DNS in project secrets store"
   - Cost/complexity flag: `expensive`
   - Reversibility: `hard` (persistent cloud resource, hourly charges, data on attached EBS)
4. The summary line reflects: "1 recommendation total; 1 `expensive`; 1 `hard` reversibility" (per FR-1.6) so the developer sees the commitment shape at a glance before reading details
5. Steps 7-11 proceed as in UC-1 primary flow: write to `.claude/resources-pending.md`, do not execute cloud APIs, do not touch credentials, do not install drivers, return to orchestrator
6. The agent does NOT fetch current pricing information (per FR-5.6 / NFR-6 no-network constraint and NFR-7 rationale -- excessive runtime signals unauthorized research)
7. The agent does NOT touch `~/.aws/credentials`, `.env`, or any secrets store (per FR-5.4)

**Postconditions**:
- `.claude/resources-pending.md` contains the Cloud/Compute entry with all six fields
- Summary line counts show `1 expensive` and `1 hard` so the developer is immediately aware of the commitment
- `~/.aws/credentials` is unchanged; no cloud API call was made

**Related FR/AC**: FR-1.4, FR-1.6, FR-4.3, FR-5.4, FR-5.6, NFR-6, NFR-7 / AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-2-A1: Project has no documented cloud budget constraints** -- The project's `CLAUDE.md` does not mention a cloud budget, cost cap, or cost-sensitivity guidance
  1. The agent reads `CLAUDE.md` and finds no budget constraints section
  2. The agent still recommends the GPU instance (the PRD requires it) but the Why field or a trailing note surfaces the uncertainty: "cost:unknown -- confirm with owner before provisioning"
  3. The Cost/complexity flag remains `expensive` (per FR-1.4 the flag is a fixed enum; the uncertainty is communicated in text, not by altering the flag)
  4. Steps 7-11 proceed unchanged

**Related FR/AC**: FR-1.2 (CLAUDE.md is a required input), FR-1.4

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific to cloud-compute recommendations beyond those captured in UC-1-E1 (PRD unreadable) and the cross-cutting UC-2-E1/UC-3-E1 below.

### Edge Cases

- **UC-2-EC1: PRD describes "use your laptop GPU" for inference** -- The PRD explicitly scopes inference to local-only, developer-laptop GPU
  1. Per FR-4.3, "bare 'use your laptop' does NOT belong in Cloud/Compute"
  2. The agent considers whether this belongs in Hardware (e.g., "16 GB VRAM minimum") per FR-4.7 and emits a Hardware entry accordingly
  3. The Cloud/Compute category shows `(none)` underneath per FR-1.7

**Related FR/AC**: FR-4.3, FR-4.7, FR-1.7

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, use-cases file, architect verdict, `CLAUDE.md`
- **Output**: `.claude/resources-pending.md` with a Cloud/Compute entry and the summary counts
- **Side Effects**: One file write. No cloud API calls. No credential access. No network.

---

## UC-3: Feature Requires an External API (OAuth Login)

**Actor**: `resource-architect` agent, invoked by `/bootstrap-feature` at Step 3.5
**Preconditions**:
- `docs/PRD.md` describes OAuth-based user login (e.g., "FR-1.1 specifies Google and GitHub OAuth providers")
- Architect PASS verdict in context
- Use-cases file describes the login flow and the callback endpoint

**Trigger**: `/bootstrap-feature` reaches Step 3.5 for a feature needing OAuth

### Primary Flow (Happy Path)

1. The agent reads PRD + use cases + architect verdict + CLAUDE.md per FR-1.2
2. The agent identifies the OAuth requirement and considers External API vs. Third-party Service (per FR-4.4 vs. FR-4.5 distinction: External API is code-path-coupled, Third-party Service is operational-coupled; a hosted auth provider like Auth0 has code-path coupling through its OAuth flow SDK so it can reasonably appear under either category -- the agent's prompt may choose; the test validates the choice is ONE of the two categories)
3. Entry fields (per FR-1.4):
   - Category: `External API` (or `Third-party Service`)
   - Name: `Auth0 SaaS` (primary recommendation)
   - Why: "FR-1.1 requires Google and GitHub OAuth -- Auth0 centralizes both providers behind a single OAuth flow"
   - Install/activate command: a numbered checklist: "1. Create Auth0 tenant, 2. Configure Google and GitHub social connections, 3. Copy client ID and client secret, 4. Add `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` to `.env`"
   - Cost/complexity flag: `moderate`
   - Reversibility: `moderate` (tenant can be deleted; user data migration may be needed if rolled back after users exist)
4. Steps 5-11 proceed as in UC-1 primary flow
5. The agent emits the copy-paste `.env` text in the recommendation but MUST NOT create or modify any `.env` file (per FR-5.4)

**Postconditions**:
- `.claude/resources-pending.md` shows the Auth0 entry under External API or Third-party Service
- `.env` does NOT exist or is unchanged (agent did not write it)
- Credentials were NOT acquired by the agent -- only the procedure to acquire them was documented

**Related FR/AC**: FR-1.4, FR-4.4, FR-4.5, FR-5.4 / AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-3-A1: Multiple competing OAuth options** -- Several viable OAuth providers exist (Auth0, Supabase Auth, AWS Cognito, Clerk) and no single one dominates
  1. The agent recommends ONE primary choice with full six-field entry (e.g., Auth0)
  2. Immediately below the primary entry, the agent lists alternatives with brief tradeoffs in the Why field or as sub-bullets: "Primary: Auth0; alternatives: Supabase Auth (simpler, less mature), AWS Cognito (cheaper but complex), Clerk (developer-friendly UI but higher per-MAU cost)"
  3. The alternatives are NOT separate recommendation entries -- they do not get their own six-field blocks. The summary count still reflects 1 primary recommendation in this category
  4. Steps 4-11 proceed unchanged
  5. The developer can override by choosing an alternative; the agent's job is to surface the decision, not make it

**Related FR/AC**: FR-1.3 (one primary per need), FR-1.4 (entry structure), risk 4.9 item 1 (conservative recommendations)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-3-E1: Agent attempts a network call to a registry or pricing API** -- The agent's prompt or tool usage is perturbed such that it tries to fetch an MCP registry, cloud pricing API, package registry, or remote URL
  1. Per FR-5.6 and NFR-6, the agent MUST NOT make network calls
  2. Per FR-5.7, the agent's `tools` frontmatter excludes `Bash`, which prevents shell-based curl/wget. The only network-capable vector would be a misconfigured tool allowance
  3. If any tool invocation attempts a remote URL, verification (test harness for AC-13 or Plan Critic observation per FR-6.7) MUST fail the agent's output
  4. The agent's prompt explicitly documents: "All inputs are local files. Recommendations are based on the agent's built-in knowledge of common tools. Do NOT attempt to fetch registries, pricing APIs, MCP directories, or any remote URL."
  5. In correct operation the agent produces recommendations purely from its training-derived knowledge of common tools (Auth0, Supabase Auth, AWS Cognito, etc.) -- no fresh lookup is needed

**Postconditions (UC-3-E1)**:
- No HTTP, DNS, or git-fetch call was initiated during agent runtime
- If a misconfigured build somehow allowed it, the violation is caught by FR-5.7 tool restriction (no Bash), FR-6.7 critic observation (malformed field values), or NFR-7 runtime ceiling (wall-clock > 30s signals unauthorized research)

**Related FR/AC**: FR-5.6, FR-5.7, FR-6.7, NFR-6, NFR-7 / AC-12

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-3-EC1: PRD uses a built-in framework auth library, not an external provider** -- The PRD scopes auth to an in-house `bcrypt` + JWT flow with no external SaaS
  1. The agent emits no External API entry for auth (per FR-4.4, External API covers paid/authenticated HTTP APIs the feature calls -- an in-house bcrypt flow does not match)
  2. If `bcrypt` is a slice-level dependency it belongs to neither Library/Framework (per FR-4.6, individual utility libraries don't count) nor any other category, and so does NOT appear in the output
  3. External API, Third-party Service, and Library/Framework categories may all show `(none)` per FR-1.7
  4. The overall output may still be "No external resources required" per FR-1.5 if no other category has entries

**Related FR/AC**: FR-4.4, FR-4.6, FR-1.5, FR-1.7

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, use-cases file, architect verdict, `CLAUDE.md`
- **Output**: `.claude/resources-pending.md` with an External API (or Third-party Service) entry
- **Side Effects**: One file write. No credential access. No network. No `.env` modification.

---

## UC-4: Feature Requires No External Resources (Pure Refactor)

**Actor**: `resource-architect` agent, invoked by `/bootstrap-feature` at Step 3.5
**Preconditions**:
- `docs/PRD.md` describes a refactor-only change (e.g., "extract the shared validation logic from two controllers into a single service")
- The PRD introduces no new API calls, no new cloud resources, no new MCP needs
- Architect PASS verdict in context
- Use-cases file reflects the refactor

**Trigger**: `/bootstrap-feature` reaches Step 3.5 for a feature with no external dependency needs

### Primary Flow (Happy Path)

1. The agent reads all inputs per FR-1.2
2. The agent evaluates each of the six categories (MCP, Cloud/Compute, External API, Third-party Service, Library/Framework, Hardware) and finds no applicable recommendations in any (per FR-4.1 the six-category set is exhaustive for iteration 1)
3. Per FR-1.5, the agent MUST emit an explicit "No external resources required" statement as the body of the output -- NOT an empty file and NOT a no-op return
4. Per FR-1.7, even in this "no resources" case, all six category headings MUST still appear in the output, each with `(none)` underneath (per AC-10: all six category headings appear with `(none)` even when the explicit "No external resources required" statement is present)
5. The summary line reports zero recommendations: "0 recommendations total; 0 `expensive`; 0 `hard` reversibility" (per FR-1.6)
6. The agent writes the output to `.claude/resources-pending.md` per FR-2.1
7. The distinction between this explicit output and a true no-op is important -- downstream consumers (planner, human reader) must be able to tell "considered and none needed" from "agent did not run" (per FR-1.5 rationale)

**Postconditions**:
- `.claude/resources-pending.md` exists and contains the explicit "No external resources required" statement
- All six category headings are present, each with `(none)`
- The summary line reports 0/0/0 counts
- Step 5 planner will inline this content verbatim into `.claude/plan.md` (UC-5)

**Related FR/AC**: FR-1.3, FR-1.5, FR-1.6, FR-1.7, FR-4.1 / AC-10

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

None -- the no-resources case is explicit and singular.

### Error Flows

None specific to this use case. UC-1-E1 (PRD unreadable) applies cross-cutting.

### Edge Cases

- **UC-4-EC1: Comment-only or typo-fix refactor that is explicitly exempt from the pipeline** -- Per the project's CLAUDE.md ("The only exceptions are trivial non-code tasks (updating a comment, fixing a typo in docs).") the developer may skip the pipeline entirely
  1. This edge case is out of scope for `resource-architect` -- the agent does not run because `/bootstrap-feature` does not run
  2. No `.claude/resources-pending.md` is produced
  3. Not a failure mode; the agent is simply not invoked

**Related FR/AC**: Out of scope (CLAUDE.md pipeline exemption, not a resource-architect concern)

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, use-cases file, architect verdict, `CLAUDE.md`
- **Output**: `.claude/resources-pending.md` with an explicit "No external resources required" body and the six category headings each marked `(none)`
- **Side Effects**: One file write. Nothing else.

---

## UC-5: Planner Reads and Inlines, Orchestrator Deletes Temp File

**Actor**: `planner` agent (at Step 5) and the `/bootstrap-feature` orchestrator
**Preconditions**:
- Step 3.5 has completed successfully and `.claude/resources-pending.md` exists on disk with valid FR-2.2 structure (top-level `## Recommended Resources` heading, summary line, six category subsections)
- Step 4 (QA) has completed and `docs/qa/<feature>_test_cases.md` exists
- The `planner` agent (`src/agents/planner.md`) has been updated per FR-2.5 to know about the temp file

**Trigger**: `/bootstrap-feature` reaches Step 5 and delegates to `planner`

### Primary Flow (Happy Path)

1. The planner starts and reads all documentation from earlier steps (PRD, use cases, architecture review, test cases) per its existing responsibilities
2. Per FR-2.5, the planner additionally reads `.claude/resources-pending.md`
3. The file exists. The planner captures its full content verbatim (preserving all formatting -- bullets, indentation, code fences, line breaks) per FR-2.5
4. The planner drafts `.claude/plan.md` and places the captured `.claude/resources-pending.md` content as the FIRST top-level section of the plan (per FR-2.6), immediately before `## Prerequisites verified` and before the slice list
5. The inlined section retains the `## Recommended Resources` heading, the summary line, and the six category subsections exactly as emitted by `resource-architect`
6. The planner continues its other responsibilities: slice breakdown, wave assignment (from Section 2), executable plan fields (from Section 1 FR-3). These are preserved unchanged per FR-3.4
7. After successful inlining, the planner deletes `.claude/resources-pending.md` per FR-2.5
8. The planner returns control to the orchestrator; `/bootstrap-feature` completes
9. The final `.claude/plan.md` has the layout: `## Recommended Resources` (at top) -> `## Prerequisites verified` -> slice list / wave assignments / other existing sections

**Postconditions**:
- `.claude/plan.md` contains `## Recommended Resources` as the first top-level section, before `## Prerequisites verified`
- The content of `## Recommended Resources` matches what was in `.claude/resources-pending.md` byte-for-byte (modulo whitespace normalization if any)
- `.claude/resources-pending.md` no longer exists on disk
- All other planner responsibilities completed normally

**Related FR/AC**: FR-2.3, FR-2.5, FR-2.6, FR-3.4 / AC-4, AC-9, AC-11

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-5-A1: Planner runs but `.claude/resources-pending.md` is absent** -- Typically because of UC-1-E1 (Step 3.5 failed) or UC-5-E1 (prior incomplete run deleted the file). This is the "silent skip" branch of FR-2.5
  1. The planner attempts to read `.claude/resources-pending.md`
  2. The file is absent
  3. Per FR-2.5, the planner skips the inlining step silently -- no error, no warning, no `## Recommended Resources` section in `.claude/plan.md`
  4. The planner continues with its other responsibilities (slice breakdown, waves, etc.)
  5. The resulting `.claude/plan.md` simply lacks the `## Recommended Resources` section; all other plan content is normal
  6. Per FR-6.7, the Plan Critic does NOT flag the absence as a finding (legacy plans and plans from pre-iteration-1 branches will lack this section)

**Postconditions (UC-5-A1)**:
- `.claude/plan.md` exists without a `## Recommended Resources` section
- Plan Critic does not flag the absence
- Pipeline is not blocked

**Related FR/AC**: FR-2.5 (silent skip), FR-6.7, NFR-2 (backward compat)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-5-E1: Planner reads but fails between inlining and deletion** -- The planner successfully reads `.claude/resources-pending.md` and inlines its content into `.claude/plan.md`, but crashes or is interrupted before the `rm .claude/resources-pending.md` step
  1. Per FR-2.3, if the planner fails before deletion, the temp file remains on disk
  2. The next bootstrap invocation for the same feature will overwrite the temp file (per FR-2.4 / UC-9)
  3. `/merge-ready` does NOT check for the temp file's absence (per FR-2.3 and the design of the temp-file lifecycle), so a persistent temp file does not block merge
  4. Not a blocking error -- the pipeline continues and the developer can proceed with the existing `.claude/plan.md`

**Postconditions (UC-5-E1)**:
- `.claude/plan.md` has the `## Recommended Resources` section (inlining succeeded)
- `.claude/resources-pending.md` still exists (deletion did not occur)
- `/merge-ready` does not block on this

**Related FR/AC**: FR-2.3, FR-2.4

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-5-EC1: Temp file has malformed structure (missing a category heading)** -- The `.claude/resources-pending.md` content violates FR-2.2 schema (e.g., only five category headings appear, or the summary line is missing)
  1. The planner still inlines the content verbatim per FR-2.5 -- the planner's job is a mechanical copy, not a validator
  2. The malformed content becomes part of `.claude/plan.md`
  3. Per FR-6.7, the Plan Critic MAY raise a MINOR finding on malformed category blocks (but absence of the section is NOT flagged)
  4. The developer sees the critic's MINOR note and can ask the `resource-architect` agent to rerun

**Related FR/AC**: FR-2.5, FR-6.7, NFR-8

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `.claude/resources-pending.md` (may or may not exist); the full suite of plan-input documents (PRD, use cases, architecture review, test cases)
- **Output**: `.claude/plan.md` with `## Recommended Resources` as the first top-level section (when temp file exists) or without that section (when temp file absent)
- **Side Effects**: `.claude/resources-pending.md` deleted on success. No other file deleted. No network. No mutation of PRD, use cases, or test cases.

---

## UC-6: Full-Spectrum Feature Touching Multiple Resource Categories

**Actor**: `resource-architect` agent, invoked at Step 3.5
**Preconditions**:
- `docs/PRD.md` describes a feature that simultaneously needs: browser-based E2E (MCP), Stripe payments (External API), and Redis caching (Third-party Service or Cloud/Compute depending on hosting)
- Architect PASS verdict in context
- Use-cases file reflects all three needs

**Trigger**: `/bootstrap-feature` reaches Step 3.5 for a full-spectrum feature

### Primary Flow (Happy Path)

1. The agent reads all inputs per FR-1.2
2. The agent identifies three distinct resource needs and classifies each into its category (per FR-4.1 -- MCP, Cloud/Compute, External API, Third-party Service, Library/Framework, Hardware are the only valid categories)
3. The agent produces three separate entries, each with all six FR-1.4 fields, grouped by category heading:
   - Under `MCP`: Playwright MCP server (as UC-1)
   - Under `External API`: Stripe (with webhook signing procedure as the Install/activate checklist)
   - Under `Third-party Service`: Redis Cloud SaaS (or under `Cloud/Compute` if self-hosted Redis on AWS ElastiCache -- the agent picks the right category per FR-4.3 vs. FR-4.5 distinction)
4. Entries in the same category are listed as separate per-resource blocks under that category's heading; categories with zero entries still appear with `(none)` per FR-1.7
5. The summary line reflects the aggregate: "3 recommendations total; 1 `expensive` (Redis Cloud production tier); 0 `hard` reversibility" (per FR-1.6; exact counts depend on flags chosen)
6. Steps 7-11 proceed as in UC-1 primary flow
7. The developer sees three ordered entries in `.claude/plan.md` after Step 5 inlining

**Postconditions**:
- `.claude/resources-pending.md` contains three entries across three categories plus three `(none)` markers for the unused categories (Cloud/Compute, Library/Framework, Hardware -- or the specific three that are empty in this scenario)
- All six category headings appear in fixed order
- Summary counts reflect the aggregate

**Related FR/AC**: FR-1.3, FR-1.4, FR-1.6, FR-1.7, FR-4.1 through FR-4.7 / AC-13

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-6-A1: Feature touches all six categories simultaneously** -- A hypothetical feature needing MCP (Playwright), Cloud/Compute (GPU), External API (OpenAI), Third-party Service (Sentry), Library/Framework (green-field web framework choice), and Hardware (16 GB RAM minimum)
  1. The agent produces six per-category subsections, each with at least one six-field entry
  2. The output is organized strictly by category heading per FR-1.7
  3. The summary line may show counts spanning multiple flags (e.g., "6 recommendations total; 2 `expensive`; 1 `hard` reversibility")
  4. The developer is expected to read every category heading; the summary line is the visual anchor for cost shape

**Related FR/AC**: FR-4.1 (all six categories are valid), FR-1.6, FR-1.7

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific to full-spectrum features beyond the cross-cutting UC-1-E1 (PRD unreadable), UC-3-E1 (network attempt), and UC-7-E1 (authority violation).

### Edge Cases

- **UC-6-EC1: Two entries conflict in category classification** -- A resource ambiguously fits into two categories (e.g., Supabase provides both auth-as-a-service -- Third-party Service -- and a Postgres API -- External API)
  1. Per FR-4.5 the distinction is: External API is code-path-coupled; Third-party Service is operational-coupled
  2. The agent picks one category based on primary usage in the feature (e.g., if the feature primarily calls Supabase's Postgres REST endpoints, External API; if it primarily relies on Supabase Auth's OAuth redirect flow, Third-party Service)
  3. The agent does NOT duplicate the entry across both categories
  4. The Why field makes the primary-usage rationale explicit

**Related FR/AC**: FR-4.4, FR-4.5

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, use-cases file, architect verdict, `CLAUDE.md`
- **Output**: `.claude/resources-pending.md` with multiple per-category subsections and entries
- **Side Effects**: One file write. No installs. No network. No credentials accessed.

---

## UC-7: Authority Boundary Enforcement (Write-Location Restriction)

**Actor**: `resource-architect` agent; test harness or Plan Critic observing agent output
**Preconditions**:
- The agent has been installed per FR-6.6
- The agent's `tools` frontmatter field has been restricted to the FR-5.7 minimum set (Read, Write, Glob, Grep -- no Bash)
- `/bootstrap-feature` reaches Step 3.5 normally

**Trigger**: Any `resource-architect` invocation; test harness verifies post-run that no prohibited writes occurred

### Primary Flow (Happy Path)

1. The agent runs through any of UC-1 through UC-6 primary flows
2. The agent writes exactly one file: `.claude/resources-pending.md` in the project CWD (per FR-2.1)
3. The agent does NOT write to any of the following (per FR-5.2, FR-5.4, and FR-2.1):
   - `~/.claude/settings.json`
   - `.claude/settings.json` (project-local)
   - `.env`, `.envrc`
   - `~/.aws/credentials`
   - `~/.config/gcloud/`
   - `.gitignore`
   - `docs/PRD.md`
   - `.claude/plan.md` (only the planner writes this; the agent only writes the temp file)
   - Any other file outside `.claude/resources-pending.md`
4. The agent does NOT invoke any of: `claude mcp add`, `claude mcp remove`, `npm install`, `pnpm add`, `yarn add`, `pip install`, `poetry add`, `brew install`, `apt install`, `cargo add` (per FR-5.3, FR-5.5). These commands may only appear as text strings in the recommendation output
5. The agent does NOT make any network call -- HTTP, DNS, git fetch, etc. (per FR-5.6)
6. Post-run, a test harness can verify:
   - Exactly one file modification (to `.claude/resources-pending.md`)
   - No change to `~/.claude/settings.json` mtime or content
   - No change to `.env` existence or content
   - No change to PRD or plan files
   - No shell process was spawned for install commands (mechanically impossible because the agent lacks the `Bash` tool per FR-5.7)

**Postconditions**:
- Only `.claude/resources-pending.md` was created or modified by the agent
- All prohibited files are unchanged

**Related FR/AC**: FR-2.1, FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-5.6, FR-5.7 / AC-12

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-7-E1: Agent attempts to write outside `.claude/resources-pending.md`** -- Per FR-5.1 and FR-2.1, any write to a location other than the temp file is a boundary violation
  1. If a prompt-drift scenario causes the agent to attempt a write to, e.g., `~/.claude/settings.json` to "helpfully install" Playwright
  2. The write would go through the `Write` tool (the only write-capable tool the agent has, since `Bash` is excluded per FR-5.7)
  3. A test harness checks post-run that no writes occurred outside `.claude/resources-pending.md`; any additional write is a verified violation of FR-2.1 and FR-5.2
  4. The test harness MUST fail the agent run -- the agent's own output is not trusted to self-report compliance
  5. If the attempted write targets a file the agent has no permissions to (e.g., protected system paths), the Write tool itself will error; the agent's output still surfaces the attempt in its error-handling, which a critic can flag
  6. The FR-5.7 exclusion of `Bash` is the defense-in-depth measure that mechanically prevents `claude mcp add` execution regardless of prompt drift

**Postconditions (UC-7-E1)**:
- Test harness fails the run
- No merge proceeds based on a boundary-violating agent output

**Related FR/AC**: FR-2.1, FR-5.1, FR-5.2, FR-5.7, risk 4.9 item 3 (prompt-drift defense-in-depth)

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

None -- authority boundary is a hard rule with no permissible exceptions in iteration 1.

### Data Requirements

- **Input**: The inputs from whichever primary flow the agent is running (UC-1..UC-6)
- **Output**: Single write to `.claude/resources-pending.md`; no writes elsewhere
- **Side Effects**: Zero shell commands spawned; zero network calls; zero credential file accesses.

---

## UC-8: Idempotency Across Re-Bootstrapping on the Same Branch

**Actor**: `resource-architect` agent, invoked by a re-run of `/bootstrap-feature`
**Preconditions**:
- The developer ran `/bootstrap-feature` previously on the current feature branch; Step 3.5 produced `.claude/resources-pending.md`; the planner at Step 5 either consumed and deleted the temp file (UC-5 primary flow) OR failed between inlining and deletion (UC-5-E1)
- The developer re-runs `/bootstrap-feature` on the same branch (common scenarios: user aborted the first run mid-way, or wants to refresh after editing the PRD)
- The temp file may or may not exist at the moment of re-run:
  - Case A: absent (planner deleted it successfully in the first run, or the first run never reached step 3.5)
  - Case B: present (planner failed between inlining and deletion in the first run, or the first run was aborted between step 3.5 and step 5)

**Trigger**: `/bootstrap-feature` is re-invoked on the same feature branch

### Primary Flow (Happy Path)

1. `/bootstrap-feature` proceeds through Steps 1-3 normally
2. At Step 3.5, the agent runs as in its UC-1..UC-6 primary flow
3. Per FR-2.4, if `.claude/resources-pending.md` already exists (Case B), the agent MUST overwrite it without prompting
4. Stale content from a previous run MUST NOT be appended to or merged with the new content -- the write is a full replacement (per FR-2.4)
5. If the PRD has not changed between runs, the rewritten temp file content is semantically equivalent to the previous run's content (the agent is deterministic given the same inputs per the no-network, no-randomness design)
6. If the PRD has changed between runs (e.g., the developer edited it between abortions), the rewritten temp file reflects the new PRD
7. Steps 6-11 of whichever primary-flow UC applies run normally; planner at Step 5 inlines and deletes as in UC-5

**Postconditions**:
- The temp file contains the current-run recommendations; no stale content
- The planner deletes the file cleanly

**Related FR/AC**: FR-2.4 (overwrite, no merge), FR-1.2 (fresh inputs on every run), NFR-6 (no network, deterministic)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific to idempotency. Inherited error flows from UC-1..UC-7 apply.

### Edge Cases

- **UC-8-EC1: Re-run mid-Step-3.5 interrupted and re-retried** -- The developer aborts `/bootstrap-feature` during Step 3.5 (agent writing temp file). Partial temp file may exist
  1. On re-run, the agent overwrites the partial temp file per FR-2.4
  2. No merge of stale partial content

**Related FR/AC**: FR-2.4

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: Current PRD, use cases, architect verdict; possibly-existing prior `.claude/resources-pending.md`
- **Output**: Freshly written `.claude/resources-pending.md` replacing any prior content
- **Side Effects**: One file write (overwriting). No append. No merge.

---

## UC-9: Recommendation Scope Does Not Overlap With Agency Roles

**Actor**: `resource-architect` agent
**Preconditions**:
- `docs/PRD.md` describes a feature that includes "test automation" or similar phrasing that might tempt an over-ambitious agent to recommend creating a new agent (e.g., a test-orchestration agent)
- Architect verdict in context
- Use-cases file exists

**Trigger**: `/bootstrap-feature` reaches Step 3.5 for a feature whose PRD wording could, if misread, invite agent-creation recommendations

### Primary Flow (Happy Path)

1. The agent reads inputs per FR-1.2
2. The agent identifies the test-automation needs and classifies them into the six FR-4.1 categories (MCP, Cloud/Compute, External API, Third-party Service, Library/Framework, Hardware)
3. The agent recognizes that "creating a new agent" is NOT one of the six categories -- it belongs to a hypothetical future `role-planner` capability (per PRD 4.8 item 7: feature-specific role generation is explicitly out of scope)
4. The agent stays strictly within its six categories. If test automation needs surface, appropriate recommendations are:
   - MCP: `playwright` MCP for browser testing
   - Library/Framework: a test runner choice for green-field projects
   - Cloud/Compute: CI runners if the project targets a specific CI environment
5. The agent does NOT emit a recommendation such as "create a new `test-orchestration` agent" or "add `qa-automator` to the Agency Roles table"
6. Steps 7-11 of UC-1 primary flow proceed

**Postconditions**:
- Recommendations stay within the six FR-4.1 categories
- No Agency Role suggestions appear in the output
- PRD 4.8 item 7 (feature-specific role generation deferred) is respected

**Related FR/AC**: FR-4.1, PRD 4.8 item 7 (scope discipline)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific to scope discipline beyond cross-cutting UC-7-E1 (authority violation).

### Edge Cases

- **UC-9-EC1: PRD explicitly mentions an agent name** -- The PRD references an existing agent (e.g., "the `e2e-runner` agent will drive Playwright") -- the agent must NOT interpret this as a cue to add new agents
  1. The agent reads the PRD reference as context for understanding WHY a resource is needed (e.g., "because `e2e-runner` needs a browser driver, Playwright MCP is the right MCP")
  2. The agent does NOT suggest modifications to `e2e-runner` itself (that would belong to `doc-updater` or a future `role-planner`, not `resource-architect`)
  3. Recommendations remain category-bounded

**Related FR/AC**: FR-4.1, FR-1.2 (reading PRD for context does not imply editing PRD or agents)

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `docs/PRD.md`, use-cases file, architect verdict, `CLAUDE.md`
- **Output**: `.claude/resources-pending.md` with recommendations strictly from the six categories
- **Side Effects**: One file write. No modifications to Agency Roles, agent files, or command files.

---

## UC-10: Stale Temp File from Previous Incomplete Run

**Actor**: `resource-architect` agent
**Preconditions**:
- A previous `/bootstrap-feature` run was aborted between Step 3.5 (agent wrote temp file) and Step 5 (planner consumes and deletes). The temp file exists from the prior run
- The developer re-runs `/bootstrap-feature` on the same feature branch

**Trigger**: Step 3.5 runs on a branch with a pre-existing `.claude/resources-pending.md`

### Primary Flow (Happy Path)

1. `/bootstrap-feature` reaches Step 3.5
2. The agent runs as in UC-1..UC-6 primary flow
3. When the agent reaches the write step, `.claude/resources-pending.md` already exists on disk from the prior run
4. Per FR-2.4, the agent overwrites the file without prompting
5. Stale content is discarded, not appended or merged (per FR-2.4 explicit language)
6. The new write contains only the current-run recommendations
7. Step 5 planner inlines the new content normally (UC-5)

**Postconditions**:
- `.claude/resources-pending.md` contains only current-run recommendations
- No trace of the stale content remains in the temp file or in `.claude/plan.md`

**Related FR/AC**: FR-2.4

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None.

### Edge Cases

- **UC-10-EC1: Stale temp file is for a different feature branch** -- The developer switched branches without cleaning up; the stale temp file was from a different feature's bootstrap
  1. The agent does not inspect the file's content to distinguish features -- it just overwrites (per FR-2.4)
  2. The new write reflects the current branch's PRD
  3. No cross-feature contamination; stale content is discarded cleanly

**Related FR/AC**: FR-2.4, UC-11 (feature isolation)

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: Current feature inputs; pre-existing temp file on disk (ignored by the agent, overwritten)
- **Output**: Fresh `.claude/resources-pending.md`
- **Side Effects**: One file write (overwriting). No content merge.

---

## UC-11: Plan Critic Runs After Planner With `## Recommended Resources` Present

**Actor**: Plan Critic (spawned per CLAUDE.md "Plan Critic Pass" section), reviewing a just-written `.claude/plan.md`
**Preconditions**:
- `.claude/plan.md` has been written by the planner at Step 5
- The plan's first top-level section is `## Recommended Resources` (inlined from the temp file per UC-5)
- The Plan Critic prompt in `src/claude.md` has been updated per FR-6.7 to recognize `## Recommended Resources` as a valid plan section

**Trigger**: Plan Critic spawned to review the plan before the user exits plan mode (or before bootstrap ends)

### Primary Flow (Happy Path)

1. Plan Critic reads `.claude/plan.md` and sees the `## Recommended Resources` section at the top
2. Per FR-6.7, the critic MUST recognize this as a valid top-level section of `.claude/plan.md` -- not a phantom path, not unexpected content
3. The critic does NOT flag the section's presence as a Finding
4. The critic MAY flag malformed category blocks within the section as a MINOR finding if, e.g., a recommendation entry is missing one of the six FR-1.4 fields (per NFR-8 -- entries missing any field SHOULD be flagged MINOR)
5. Absence of `## Recommended Resources` MUST NOT be flagged as a Finding (legacy plans and plans from pre-iteration-1 branches lack this section -- per FR-6.7)
6. The critic continues with its standard checks (completeness, slice quality, file-path verification, architecture, security, edge cases, scope reduction, wave assignment validation)

**Postconditions**:
- Plan Critic's FINDINGS list is not polluted by presence OR absence of `## Recommended Resources`
- Only malformed entries within the section (missing FR-1.4 fields) may appear as MINOR findings

**Related FR/AC**: FR-6.7, NFR-8 / AC-14

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-11-A1: Plan has no `## Recommended Resources` section** -- Either because the bootstrap was run on a pre-iteration-1 branch, or because UC-5-A1 applied (temp file was absent)
  1. Plan Critic reads the plan and finds no `## Recommended Resources` section
  2. Per FR-6.7, absence is NOT a finding
  3. Plan Critic proceeds with its standard checks unaffected

**Related FR/AC**: FR-6.7, NFR-2 (backward compat)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific. A misconfigured critic that DID flag absence would violate FR-6.7 and AC-14 -- that's a critic-prompt bug, not a `resource-architect` runtime issue.

### Edge Cases

- **UC-11-EC1: Section present but entries missing required fields** -- An entry under `External API` has Category, Name, Why, Install/activate, but is missing Cost/complexity flag and Reversibility (only 4 of 6 FR-1.4 fields)
  1. Per NFR-8 and FR-6.7, the critic MAY raise a MINOR finding on the malformed entry
  2. The finding description cites "entry under External API is missing Cost/complexity flag and Reversibility -- FR-1.4 requires all six fields"
  3. The finding is MINOR, not CRITICAL or MAJOR -- iteration 1 does not enforce field presence programmatically (per PRD 4.8 item 9, programmatic validation is deferred)

**Related FR/AC**: NFR-8, FR-6.7, FR-1.4

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `.claude/plan.md` (read-only for the critic)
- **Output**: FINDINGS list per critic prompt format
- **Side Effects**: None. Plan Critic is read-only.

---

## UC-12: Feature Branch Rebuilt After Merge to Main

**Actor**: `resource-architect` agent on a new feature branch, running fresh after a previous feature was merged
**Preconditions**:
- The previous feature branch has been merged to `main` and deleted
- A new feature branch `feat/<new-feature>` has been created from the current `main`
- The new feature's PRD section has been written and differs from the previous feature's
- Neither `.claude/resources-pending.md` nor the previous feature's `## Recommended Resources` section is expected to persist on the new branch

**Trigger**: `/bootstrap-feature` runs at Step 3.5 for the new feature on the fresh branch

### Primary Flow (Happy Path)

1. The agent reads the new feature's PRD, use cases, and architect verdict per FR-1.2
2. `.claude/plan.md` from the previous feature was likely committed or overwritten at some point -- it has no bearing on the new feature (the plan file is regenerated per-feature by the planner)
3. `.claude/resources-pending.md` does not exist on the new branch (the previous feature's planner deleted it per FR-2.5; even if UC-5-E1 left it on the previous branch, the merge would not have carried it over if it was gitignored, or the new branch would have started from a commit before it appeared)
4. The agent produces `.claude/resources-pending.md` fresh based on the new feature's PRD
5. The planner at Step 5 produces `.claude/plan.md` fresh; previous feature's `## Recommended Resources` content is not carried over because the planner rewrites the plan file each time
6. The new feature's `.claude/plan.md` contains only the new feature's resource recommendations

**Postconditions**:
- `.claude/plan.md` on the new branch reflects only the new feature's recommendations
- Previous feature's recommendations are not present
- `.claude/resources-pending.md` is created fresh and deleted by the planner at Step 5

**Related FR/AC**: FR-2.3 (temp file lifecycle is per-bootstrap), FR-2.4 (overwrite on existing), NFR-9 (one-shot per bootstrap)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific. Cross-cutting errors apply.

### Edge Cases

- **UC-12-EC1: `.claude/` directory not gitignored; previous feature's `.claude/plan.md` persists in the branch history** -- The project commits `.claude/plan.md` to git (unusual but possible)
  1. On the new branch, `.claude/plan.md` exists on disk from the previous feature's final state
  2. The new feature's planner at Step 5 rewrites `.claude/plan.md` from scratch (the planner does not append or merge -- it produces a fresh plan for each bootstrap)
  3. The new plan reflects only the new feature; no leakage from the previous feature

**Related FR/AC**: FR-2.5, FR-2.6, FR-3.4

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: New feature's PRD, use cases, architect verdict, CLAUDE.md; possibly-existing prior `.claude/plan.md` (fully replaced by planner)
- **Output**: Fresh `.claude/resources-pending.md` and fresh `.claude/plan.md`
- **Side Effects**: Standard bootstrap writes; no cross-feature contamination.

---

## Coverage Map: PRD FRs to Use Cases

This table maps every FR and AC in PRD section 4 to at least one use case, per the ba-analyst mandate that no requirement goes uncovered.

| FR/AC | Covered by UCs |
|-------|---------------|
| FR-1.1 (agent file exists with correct frontmatter) | UC-1 preconditions; UC-7 preconditions (tools-frontmatter restriction) |
| FR-1.2 (agent reads PRD + use cases + architect verdict + CLAUDE.md, NOT scratchpad) | UC-1 step 1-2; UC-2 step 1; UC-3 step 1; UC-4 step 1; UC-6 step 1; UC-8 (PRD re-read on each run); UC-9 step 1 |
| FR-1.3 (six categories, empty allowed) | UC-1 step 3; UC-4 step 2; UC-6 step 3; UC-9 step 2 |
| FR-1.4 (six-field entries with exact value domains) | UC-1 step 4; UC-2 step 3; UC-3 step 3; UC-6 step 3; UC-11-EC1 (malformed -> MINOR finding) |
| FR-1.5 (explicit "No external resources required" statement) | UC-4 step 3; UC-1-EC1 (deferred scope); UC-3-EC1 (in-house library) |
| FR-1.6 (summary line with totals, expensive count, hard-reversibility count) | UC-1 step 5; UC-2 step 4; UC-4 step 5; UC-6 step 5; UC-6-A1 step 3 |
| FR-1.7 (all six categories always appear with `(none)` if empty) | UC-1 step 6; UC-4 step 4; UC-6 step 4; UC-1-EC1 step 4 |
| FR-2.1 (write only to `.claude/resources-pending.md`) | UC-1 step 7-8; UC-7 step 2; UC-7-E1 (boundary violation) |
| FR-2.2 (temp file structure: heading + summary + six category subsections) | UC-1 step 7; UC-5 step 5 (inlined structure preserved); UC-5-EC1 (malformed structure) |
| FR-2.3 (temp file lifecycle: created by agent, read+inlined+deleted by planner) | UC-5 primary flow; UC-5-E1 (failure between inline and delete); UC-12 step 3 |
| FR-2.4 (overwrite, no merge, no append on existing temp file) | UC-8 step 3-4; UC-10 step 4-5; UC-8-EC1 |
| FR-2.5 (planner reads, inlines verbatim, deletes) | UC-5 primary flow; UC-5-A1 (silent skip when absent); UC-5-EC1 (inline even if malformed) |
| FR-2.6 (`## Recommended Resources` appears first, before `## Prerequisites verified`) | UC-5 step 4; UC-5 postconditions; UC-11 preconditions |
| FR-3.1 (bootstrap Step 3.5 inserted) | UC-1 trigger; UC-2 trigger; implicit in all UCs |
| FR-3.2 (Step 3.5 mandatory, non-skippable) | UC-4 (feature with zero resources still runs agent and emits explicit "No external resources required" per FR-1.5); UC-1-E1 (halt instead of skip) |
| FR-3.3 (agent failure halts bootstrap) | UC-1-E1 |
| FR-3.4 (planner updated, other responsibilities preserved) | UC-5 step 6 |
| FR-3.5 (Step 4 QA and Step 5 planner preserved; 3.5 inserted without renumbering) | UC-5 preconditions (Step 4 still QA); bootstrap-feature trigger of all UCs |
| FR-3.6 (develop-feature delegates; no change required) | Implicit in UC-1 through UC-12 (any of these could be invoked via `/develop-feature`) |
| FR-4.1 (six categories only; no new categories) | UC-9 step 3-4; UC-6 step 2 |
| FR-4.2 (MCP category) | UC-1 primary flow; UC-6 step 3 |
| FR-4.3 (Cloud/Compute category; excludes "use your laptop") | UC-2 primary flow; UC-2-EC1 |
| FR-4.4 (External API category; code-path-coupled; includes credential procedure) | UC-3 primary flow; UC-3-EC1 |
| FR-4.5 (Third-party Service category; operational-coupled) | UC-3 primary flow; UC-6 step 3; UC-6-EC1 (category disambiguation) |
| FR-4.6 (Library/Framework category; green-field choice; excludes utility libs) | UC-3-EC1 (bcrypt excluded); UC-6-A1 |
| FR-4.7 (Hardware category; non-cloud physical resources) | UC-2-EC1 (laptop GPU as Hardware); UC-6-A1 |
| FR-5.1 (authority boundary section in prompt) | UC-7 primary flow |
| FR-5.2 (no modifications to settings.json) | UC-1-A1 (read-only probe); UC-7 step 3 |
| FR-5.3 (no `claude mcp add` invocation) | UC-1 step 9; UC-7 step 4 |
| FR-5.4 (no credential / .env / secrets modifications) | UC-2 step 7; UC-3 step 5; UC-7 step 3 |
| FR-5.5 (no package-manager invocations) | UC-1 step 9; UC-7 step 4 |
| FR-5.6 (no network calls) | UC-1 step 10; UC-3-E1; UC-7 step 5 |
| FR-5.7 (tools frontmatter excludes Bash) | UC-1 preconditions; UC-7 preconditions and step 6 |
| FR-6.1 (Agency Roles row added in src/claude.md) | Implicit installation prerequisite in UC-1 preconditions |
| FR-6.2 (14 -> 15 agent-count references updated) | Implicit installation prerequisite |
| FR-6.3 (README agent table row added) | Implicit installation prerequisite |
| FR-6.4 (README feature section added) | Implicit installation prerequisite |
| FR-6.5 (install.sh five banner strings 14 -> 15) | Implicit installation prerequisite |
| FR-6.6 (install.sh copies agent to ~/.claude/agents/) | UC-1 preconditions |
| FR-6.7 (Plan Critic recognizes `## Recommended Resources`; absence not flagged; malformed entries MAY be MINOR) | UC-11 primary flow; UC-11-A1; UC-11-EC1 |
| NFR-1 (markdown-only changes) | All UCs -- no runtime code |
| NFR-2 (backward compat; plans without `## Recommended Resources` still parse) | UC-5-A1; UC-11-A1 |
| NFR-3 (effective after `bash install.sh`) | Implicit installation prerequisite |
| NFR-4 (agent uses `opus` model) | UC-1 preconditions |
| NFR-5 (agent count 14 -> 15) | Implicit installation prerequisite |
| NFR-6 (no network) | UC-1 step 10; UC-3-E1; UC-7 step 5 |
| NFR-7 (runtime under 30s; excessive runtime signals unauthorized research) | UC-3-E1 step 6 (runtime ceiling as defense) |
| NFR-8 (strict six-field format; violations SHOULD be MINOR findings) | UC-11-EC1 |
| NFR-9 (one-shot per bootstrap; no re-check in merge-ready) | UC-12 (fresh per feature) |
| AC-1 (file src/agents/resource-architect.md exists with valid spec) | UC-1 preconditions |
| AC-2 (bootstrap-feature Step 3.5 documented) | UC-1 trigger; implicit in all UCs |
| AC-3 (Step 3.5 mandatory; halts on failure) | UC-4 (mandatory on no-resources features); UC-1-E1 (halt on failure) |
| AC-4 (planner inlines and deletes) | UC-5 primary flow |
| AC-5 (Agency Roles table updated; 14 -> 15) | Implicit installation prerequisite |
| AC-6 (README updates) | Implicit installation prerequisite |
| AC-7 (install.sh banners 14 -> 15) | Implicit installation prerequisite |
| AC-8 (`~/.claude/agents/resource-architect.md` exists after install) | UC-1 preconditions |
| AC-9 (end-to-end step sequence: 1 -> 2 -> 3 -> 3.5 -> 4 -> 5) | UC-1 through UC-12 triggers |
| AC-10 (no-resources feature still shows six category headings with `(none)`) | UC-4 step 4 |
| AC-11 (after successful bootstrap, temp file does NOT exist) | UC-5 postconditions |
| AC-12 (tools frontmatter excludes Bash) | UC-1 preconditions; UC-7 preconditions |
| AC-13 (each entry has all six fields in correct value domains) | UC-1 step 4; UC-2 step 3; UC-3 step 3; UC-6 step 3 |
| AC-14 (Plan Critic recognizes section; absence not flagged) | UC-11 primary flow |
| AC-15 (cross-references valid; no phantom paths) | Implicit installation prerequisite; UC-5 step 4 (exact path `.claude/resources-pending.md`) |

Every FR and AC maps to at least one use case. No coverage gaps identified.

---
