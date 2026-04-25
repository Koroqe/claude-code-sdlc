# Plan: Role Planner — Iteration 2: Cross-Feature Reuse + Automatic Teardown

## Prerequisites verified

- PRD §8 (lines 1819-2080) — 9 FRs, 7 NFRs, 22 ACs, 18 risks/deps, 12 out-of-scope items
- Use cases — `docs/use-cases/role-planner-reuse-teardown_use_cases.md` — 106 scenarios across 17 UC families
- QA test cases — `docs/qa/role-planner-reuse-teardown_test_cases.md` — 146 TCs across 17 families
- Architecture review verdict: FAIL_PASS — 8 PRD edits + 4 [STRUCTURAL] decisions already incorporated

## Deliverables checklist

- [x] PRD section in `docs/PRD.md` (Section 8, lines 1819-2080)
- [x] Use cases in `docs/use-cases/role-planner-reuse-teardown_use_cases.md`
- [x] Architecture review verdict: FAIL_PASS → PRD edits applied
- [x] QA test cases in `docs/qa/role-planner-reuse-teardown_test_cases.md`
- [ ] Implementation slices (this document)

## Feature scope

Extend the iter-1 `role-planner` agent and the `/merge-ready` command with two capabilities that close the lifecycle loop on `~/.claude/agents/ondemand-<slug>.md` files:

1. **Cross-feature reuse at bootstrap Step 3.75** — before any new prompt-file Write, scan `~/.claude/agents/ondemand-*.md`, classify recommendations under a 3-stage matching algorithm (Stage 1: exact slug → automatic reuse; Stage 2: purpose match → user prompt with default-deny on ambiguous; Stage 3: no match → create new), append the current `<project-name>:<feature-slug>` to the existing file's `features:` array via FR-5 atomic read-modify-write, and emit a `## Reuse Decisions` audit subsection with one of 8 exclusive status enum values.
2. **Automatic teardown at /merge-ready Step 11** — after Gate 9 completes, the orchestrator (NOT the agent) verifies merge-ancestry via `git merge-base --is-ancestor`, derives `<project-name>:<feature-slug>`, scans on-demand role files, removes ALL matching entries from `features:` arrays, and atomically deletes the file (without intermediate empty-array Write) when the array empties.

**Concrete, testable acceptance criteria** (verbatim from PRD §8.5 — 22 ACs):
- AC-1 through AC-7 cover the role-planner.md extensions (reuse capability section, 3-stage algorithm, headless contract, legacy migration)
- AC-8 through AC-11 cover the merge-ready.md Step 11 (post-Gate-9 placement, derivation, refusal messages, defense-in-depth)
- AC-12, AC-13 cover atomic frontmatter mutation (no Edit, body byte-preservation)
- AC-14 covers the 8-status enum in `## Reuse Decisions`
- AC-15 covers Plan Critic recognition of `## Reuse Decisions` in `src/claude.md`
- AC-16, AC-17 cover the byte-unchanged invariants on agent count (17) and gate count (10)
- AC-18 covers `git diff --exit-code install.sh` (zero hunks)
- AC-19 covers `git diff --exit-code templates/CLAUDE.md` (zero hunks)
- AC-20 covers the Agency Roles row update in `src/claude.md`
- AC-21 covers cross-reference validity
- AC-22 covers the 5-second NFR-1 reuse-scan budget for ≤50 files

## [STRUCTURAL] decisions pinned (architect's 4; no additions)

1. **8-status enum** — `stage-1-exact-slug-match`, `stage-2-purpose-match-approved`, `stage-2-purpose-match-declined`, `stage-3-no-match-created`, `headless-default-create`, `legacy-migrated`, `malformed-yaml-skipped` (added), `migration-failed-malformed-yaml` (added). Precedence rule: `legacy-migrated` supersedes `stage-2-purpose-match-approved` for the same recommendation. Slices 2, 3.
2. **ALL-occurrence removal** — when removing `<project-name>:<feature-slug>` from a `features:` array, the orchestrator (teardown) and agent (de-dup on append) MUST remove every matching entry, not just the first. Required for NFR-2 idempotency on duplicate-entry files. Slice 4.
3. **Refuse-from-non-feature-branch** — Step 11 refuses to run from any branch not matching `feat/<slug>` or `fix/<slug>` without explicit feature-slug context (not just `main`). Symmetric with bootstrap-time FR-1.4 refusal. Error literal: `"Refusing teardown from non-feature branch '<branch>' without explicit feature-slug — pass via merged PR context or skip Step 11"`. Slice 4.
4. **Atomic delete-only when array empties** — when reuse removal transitions `features:` from non-empty to empty, the orchestrator MUST `rm` the file directly. NO intermediate Write of empty-array version. Slice 4.

## Implementation plan (6 slices across 2 waves)

### Slice 1: role-planner.md Authority Boundary 17-agent count update + release-engineer enumeration + in-place mutation authorization

- **Wave:** 1
- **Use cases:** UC-13, UC-14, UC-2 (Stage-1 reuse), UC-7 (legacy migration), UC-9 (atomic mutation)
- **Files:** `src/agents/role-planner.md`
- **Changes:**
  - Line 30 (`MUST NOT modify any of the 16 core agent prompt files`): change `16` → `17` and add `release-engineer` to the trailing parenthesized enumeration so the list contains all 17 names: `prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, test-writer, code-reviewer, build-runner, e2e-runner, verifier, doc-updater, refactor-cleaner, changelog-writer, resource-architect, role-planner, release-engineer`.
  - Lines 84-103 (`<!-- CORE-AGENT-ENUMERATION-START -->` block): change `The 16 core agents` → `The 17 core agents`; ADD a 17th bullet `- \`release-engineer\` — Release Engineer; packages releases at /merge-ready Gate 9 — version bump, CHANGELOG date stamp, release-notes file, GitHub Actions release workflow provisioning.`
  - Line 173 (CORE-VS-ON-DEMAND heuristic) and any other reference to `16 core slugs` → `17 core slugs`
  - INSERT a new authorization paragraph in the Authority Boundary section IMMEDIATELY AFTER the line currently at 35 (`MUST NOT modify docs/PRD.md, docs/use-cases/, ...`): a single paragraph stating that iter-2 PERMITS the agent to perform in-place mutation of the YAML frontmatter (`features:` array only) of EXISTING files at `~/.claude/agents/ondemand-<slug>.md`, while preserving the file body BELOW the closing `---` byte-for-byte (per FR-5.4). The paragraph MUST cite FR-5.1 (atomic read-modify-write contract) and FR-5.2 (no partial Edit operations) verbatim by reference. The paragraph MUST also reaffirm that creation of NEW `~/.claude/agents/ondemand-<slug>.md` files (Stage 3) preserves iter-1 byte-for-byte.
  - Update the `## No iteration 2 scope` section header (currently at line 284) to `## No iteration 3 scope` and prune items 1, 2, 3, 6 from the enumeration (those were the iter-2 deferrals now LIFTED by this section). Items 4, 5, 7, 8, 9, 10, 11 remain — they are still iter-3+ deferrals. Renumber surviving items contiguously.
- **Verify:**
  ```
  [ "$(grep -oE '17 core agent|17 core slugs' src/agents/role-planner.md | wc -l | tr -d ' ')" -ge 2 ] \
    && grep -qF 'release-engineer' src/agents/role-planner.md \
    && [ "$(grep -oE 'release-engineer' src/agents/role-planner.md | wc -l | tr -d ' ')" -ge 2 ] \
    && [ "$(grep -cE '^- `release-engineer`' src/agents/role-planner.md)" -eq 1 ] \
    && [ "$(grep -oE 'the 16 core agent|the 16 core agents|of the 16 core|any of the 16 core' src/agents/role-planner.md | wc -l | tr -d ' ')" -eq 0 ] \
    && grep -qE 'in-place mutation|in-place frontmatter mutation' src/agents/role-planner.md \
    && grep -qF 'features:' src/agents/role-planner.md \
    && grep -qE 'preserve.*body.*byte-for-byte|byte-for-byte.*body|body BELOW.*closing' src/agents/role-planner.md \
    && grep -qE 'atomic read-modify-write|FR-5.1' src/agents/role-planner.md \
    && grep -qF '## No iteration 3 scope' src/agents/role-planner.md \
    && [ "$(grep -cE '^## No iteration 2 scope$' src/agents/role-planner.md)" -eq 0 ] \
    && [ "$(awk '/^---$/{f++; next} f==1' src/agents/role-planner.md | grep -cF 'tools: [\"Read\", \"Write\", \"Glob\", \"Grep\"]')" -eq 1 ] \
    && [ "$(awk '/^---$/{f++; next} f==1' src/agents/role-planner.md | grep -oE '\"(Bash|Edit|WebFetch|WebSearch|NotebookEdit)\"' | wc -l | tr -d ' ')" = "0" ] \
    && git diff --exit-code install.sh \
    && git diff --exit-code templates/CLAUDE.md
  ```
- **Done when:** Authority Boundary count text says `17 core agent` (≥2 occurrences); `release-engineer` appears as a top-level enumeration bullet exactly once; literal `the 16 core agent` text is fully removed; in-place mutation paragraph present and references FR-5.1; `## No iteration 3 scope` header replaces `## No iteration 2 scope`; tools frontmatter remains exactly `["Read", "Write", "Glob", "Grep"]` (zero `Bash|Edit|WebFetch|WebSearch|NotebookEdit` occurrences in frontmatter); `install.sh` and `templates/CLAUDE.md` are byte-unchanged.
- **Pre-review:** architect (verifies the `## No iteration 3 scope` retention/pruning correctly mirrors the architect's [STRUCTURAL] 1 enum and that no iter-1 Authority Boundary protections were inadvertently relaxed)
- **Satisfies AC:** AC-2 (partial — tools field unchanged), AC-16, AC-18, AC-19, AC-21 (partial — agent registration consistency)

---

### Slice 2: role-planner.md Reuse Mode capability section — 3-stage matching, atomic mutation contract, 8-status enum, legacy migration, headless-default-create, collision handling

- **Wave:** 2
- **Use cases:** UC-1 (empty pool, Stage 3), UC-2 (Stage 1 exact slug), UC-3 (Stage 2 approved), UC-4 (Stage 2 declined), UC-5 (headless), UC-6 (single feature multi-recommendation mix), UC-7 (legacy migration), UC-8 (malformed YAML), UC-9 (atomic mutation), UC-10 (idempotent re-encounter), UC-15 (de-dup), UC-16 (audit trail), UC-17 (NFR-1 perf)
- **Files:** `src/agents/role-planner.md`
- **Changes:**
  - APPEND a new top-level section titled `## Reuse mode (Iteration 2)` AFTER the existing iter-1 `## On-demand prompt file template` section (currently around line 145) and BEFORE `## Boundary against resource-architect`. The section MUST include the following subsections in this fixed order:
    - `### Reuse-scan input` — the orchestrator (NOT the agent) computes `<project-name>` as `basename "$(git rev-parse --show-toplevel)"` (or literal `unknown-project` when not in a git repo per FR-1.3) and `<feature-slug>` from current branch with `feat/`/`fix/` prefix stripped (per FR-1.4) and passes both to the agent in the spawn context. The agent itself has no Bash. Document the non-feature-branch refusal — agent MUST NOT append to `features:` array if the orchestrator did not pass a valid `<feature-slug>` token.
    - `### Reuse-scan algorithm (FR-1.1)` — agent MUST `Glob` `~/.claude/agents/ondemand-*.md`, then for each matched file `Read` and parse YAML frontmatter `features:` field as JSON-style array of strings. Glob failure → fall through to Stage-3 create-new for all recommendations + emit warning to audit log (`scan-failed-permission-denied` annotation).
    - `### 3-stage matching algorithm (FR-2.1)` — verbatim Stage 1 / Stage 2 / Stage 3 definitions with exact-slug match, purpose-match-with-prompt, no-match-create-new behaviors. Stage-2 prompt format: `Reuse existing role 'ondemand-<existing-slug>' for current feature, or create new 'ondemand-<new-slug>'? [yes/no]` — both slugs verbatim plus one-line summary from existing file's `description` frontmatter field.
    - `### Affirmative/negative token grammar (FR-2.4)` — affirmative: `yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`. Negative: `no`, `n`, `decline`, `skip`, `not now`. **Default-deny on ambiguous**: empty replies, replies without recognized tokens, conflicting tokens (e.g. "yes... actually no"), replies mentioning a different slug than the two presented → treated as NEGATIVE. Stage-2 prompts emitted ONE AT A TIME per FR-2.5; ordering follows the order of recommendations in the iter-1 `## Additional Roles` body.
    - `### Atomic frontmatter mutation contract (FR-5.1, FR-5.2, FR-5.4)` — single Read → parse YAML → mutate `features:` in memory (append or remove all-occurrence) → serialize full frontmatter block → Write entire file in one shot. NO partial `Edit` invocations. File body BELOW closing `---` preserved byte-for-byte. JSON-style array shape preserved per FR-5.3 (single-line if ≤80 chars total, multi-line block style otherwise).
    - `### Manifest schema (FR-1.2, FR-1.3, FR-1.4)` — verbatim YAML frontmatter shape with `features: ["<project-name>:<feature-slug>", ...]` and the explicit project-name + feature-slug derivation rules.
    - `### Headless-default-create rule (FR-6.1, FR-6.2)` — when orchestrator detects non-interactive context (`process.stdin.isTTY === false` or shell `[ -t 0 ]`), Stage-2 prompts SKIPPED entirely; agent defaults to Stage 3 (create new) for every Stage-2 candidate; audit entry recorded as `headless-default-create`. Stage-1 (exact slug) reuse UNAFFECTED — automatic reuse without prompting is safe in headless contexts.
    - `### Legacy file migration (FR-7.1, FR-7.2, FR-7.3)` — files at `~/.claude/agents/ondemand-*.md` lacking a `features:` field are "legacy". On first encounter at Stage 1 or post-Stage-2 approval, agent migrates by adding `features: ["<project-name>:<feature-slug>"]` (single-entry array). All other frontmatter fields and full body preserved. Migration is opportunistic (only when matched, NOT bulk). Malformed YAML in legacy file → migration FAILS cleanly with `migration-failed-malformed-yaml` audit status; agent MUST NOT attempt partial repair via string substitution.
    - `### Slug-collision and core-agent ineligibility (FR-1.6)` — reuse-scan filters by `ondemand-` prefix (FR-1.1), so files at `~/.claude/agents/<core-agent>.md` are not visible. If a buggy/hand-edited `~/.claude/agents/ondemand-<slug>.md` exists where `<slug>` collides with one of the 17 core agent names (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`), the agent MUST treat the file as ineligible for reuse, MUST NOT mutate its `features:` array, and MUST emit a manual-cleanup warning to the audit log. The recommendation falls through to Stage 3 with a corrected non-colliding slug or is dropped.
    - `### De-duplication on append (NFR-2)` — when appending to a `features:` array that already contains the current `<project-name>:<feature-slug>` token (e.g. due to re-bootstrap of the same feature), the agent MUST NOT add a duplicate entry. The append is a no-op; the audit entry still records `stage-1-exact-slug-match` (the file was eligible; the array was already correct).
    - `### Output extension — \`## Reuse Decisions\` subsection (FR-8.1, AC-14)` — agent MUST APPEND `## Reuse Decisions` to `.claude/roles-pending.md` IMMEDIATELY AFTER the iter-1 `## Role invocation plan` subsection. Each recommendation receives one entry with one of the 8 exact status strings: `stage-1-exact-slug-match`, `stage-2-purpose-match-approved`, `stage-2-purpose-match-declined`, `stage-3-no-match-created`, `headless-default-create`, `legacy-migrated`, `malformed-yaml-skipped`, `migration-failed-malformed-yaml`. **Precedence rule** (FR-8.1 [STRUCTURAL] decision 1): when both `legacy-migrated` and `stage-2-purpose-match-approved` could apply to the same recommendation, the audit log emits `legacy-migrated` ONLY. The agent MUST NOT emit any status string outside this 8-entry enum.
- **Verify:**
  ```
  grep -qF '## Reuse mode (Iteration 2)' src/agents/role-planner.md \
    && grep -qF '### 3-stage matching algorithm' src/agents/role-planner.md \
    && grep -qE 'Stage 1.*[Ee]xact slug|exact slug match' src/agents/role-planner.md \
    && grep -qE 'Stage 2.*[Pp]urpose|purpose match' src/agents/role-planner.md \
    && grep -qE 'Stage 3.*[Cc]reate new|no match.*create' src/agents/role-planner.md \
    && grep -qF "Reuse existing role 'ondemand-" src/agents/role-planner.md \
    && grep -qF "create new 'ondemand-" src/agents/role-planner.md \
    && grep -qF '[yes/no]' src/agents/role-planner.md \
    && for tok in "yes" "approve" "ok" "agreed" "please do" "go ahead" "no" "decline" "skip" "not now"; do grep -qF "$tok" src/agents/role-planner.md || { echo "MISSING token: $tok"; exit 1; }; done \
    && grep -qE 'default-deny|default deny' src/agents/role-planner.md \
    && grep -qE 'atomic read-modify-write|FR-5\.1' src/agents/role-planner.md \
    && grep -qE 'process\.stdin\.isTTY|isTTY === false|non-interactive' src/agents/role-planner.md \
    && grep -qF 'headless-default-create' src/agents/role-planner.md \
    && grep -qF 'legacy-migrated' src/agents/role-planner.md \
    && grep -qF 'malformed-yaml-skipped' src/agents/role-planner.md \
    && grep -qF 'migration-failed-malformed-yaml' src/agents/role-planner.md \
    && grep -qF 'stage-1-exact-slug-match' src/agents/role-planner.md \
    && grep -qF 'stage-2-purpose-match-approved' src/agents/role-planner.md \
    && grep -qF 'stage-2-purpose-match-declined' src/agents/role-planner.md \
    && grep -qF 'stage-3-no-match-created' src/agents/role-planner.md \
    && [ "$(grep -oE 'stage-1-exact-slug-match|stage-2-purpose-match-approved|stage-2-purpose-match-declined|stage-3-no-match-created|headless-default-create|legacy-migrated|malformed-yaml-skipped|migration-failed-malformed-yaml' src/agents/role-planner.md | sort -u | wc -l | tr -d ' ')" = "8" ] \
    && grep -qF '## Reuse Decisions' src/agents/role-planner.md \
    && grep -qE 'features:' src/agents/role-planner.md \
    && grep -qE '<project-name>:<feature-slug>' src/agents/role-planner.md \
    && grep -qE 'git rev-parse --show-toplevel|basename.*git rev-parse' src/agents/role-planner.md \
    && grep -qF 'unknown-project' src/agents/role-planner.md \
    && grep -qE 'feat/|fix/' src/agents/role-planner.md \
    && grep -qE 'precedence|legacy-migrated.*supersede|emit `legacy-migrated` only' src/agents/role-planner.md \
    && grep -qE 'all-occurrence|all occurrence|every matching entry' src/agents/role-planner.md \
    && grep -qE 'de-dup|duplicate entry|already contains' src/agents/role-planner.md \
    && grep -qF 'release-engineer' src/agents/role-planner.md \
    && [ "$(awk '/^---$/{f++; next} f==1' src/agents/role-planner.md | grep -cF 'tools: [\"Read\", \"Write\", \"Glob\", \"Grep\"]')" -eq 1 ] \
    && [ "$(awk '/^---$/{f++; next} f==1' src/agents/role-planner.md | grep -oE '\"(Bash|Edit|WebFetch|WebSearch|NotebookEdit)\"' | wc -l | tr -d ' ')" = "0" ] \
    && git diff --exit-code install.sh \
    && git diff --exit-code templates/CLAUDE.md
  ```
- **Done when:** `## Reuse mode (Iteration 2)` section present with all 10 named subsections; all 10 affirmative/negative tokens present; all 8 enum statuses present (counted via `sort -u | wc -l = 8`); precedence rule documented; all-occurrence rule documented; de-dup rule documented; tools frontmatter unchanged (zero `Bash|Edit|WebFetch|WebSearch|NotebookEdit` in frontmatter block); `install.sh` and `templates/CLAUDE.md` byte-unchanged.
- **Pre-review:** architect (verifies 3-stage ordering, atomic mutation contract, headless contract correctness, and 8-status enum exhaustiveness)
- **Satisfies AC:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-12, AC-13, AC-14, AC-21 (partial — manifest cross-reference)

---

### Slice 3: bootstrap-feature.md Step 3.75 extension — Stage-2 reuse-prompt orchestration, project-name/feature-slug derivation, headless detection, non-git-context fallback

- **Wave:** 1
- **Use cases:** UC-3 (Stage-2 approved), UC-4 (Stage-2 declined), UC-5 (headless), UC-13 (orchestration handoff), UC-14 (non-git project)
- **Files:** `src/commands/bootstrap-feature.md`
- **Changes:**
  - Locate the existing `### Step 3.75: Role Planner recommendation` section (currently at lines 75-94). EXTEND the body — DO NOT change the step number (still `3.75`).
  - INSERT a new subsection `#### Iteration-2 reuse extension (Stage-2 prompt orchestration + derivation + headless contract)` AFTER the existing "Hand-off to Step 5" paragraph and BEFORE the next `### Step 4` heading. The subsection MUST include:
    - **Project-name derivation (FR-1.3)** — orchestrator computes `<project-name>` as `basename "$(git rev-parse --show-toplevel)"`. If `git rev-parse --show-toplevel` errors (not in a git repo), the orchestrator passes the literal `unknown-project` to the agent as the project-name token. The orchestrator (NOT the agent — `role-planner` has no Bash) performs this Bash invocation BEFORE spawning the agent.
    - **Feature-slug derivation (FR-1.4)** — orchestrator computes `<feature-slug>` from current branch name with `feat/` or `fix/` prefix stripped. If current branch is not `feat/<slug>` or `fix/<slug>` (e.g. `main`, `release/*`, detached HEAD), the orchestrator MUST refuse to compute a feature-slug for the reuse path. The reuse-scan still runs (read-only), but the agent receives no `<feature-slug>` token and falls through to Stage 3 (create new) for all recommendations, with a manual-slug warning emitted to the audit log. Newly-created files in this case have an empty `features: []` array (documented technical debt).
    - **Stage-2 reuse-prompt orchestration (FR-2.3)** — when the agent emits a Stage-2 prompt of the form `Reuse existing role 'ondemand-<existing-slug>' for current feature, or create new 'ondemand-<new-slug>'? [yes/no]`, the `/bootstrap-feature` orchestrator MUST: (1) display the prompt verbatim to the user with the existing file's `description` frontmatter field appended as a one-line summary, (2) capture the user's free-form text reply, (3) pass the reply back to the `role-planner` agent via the spawn-context channel for parsing under the FR-2.4 affirmative/negative token grammar with default-deny on ambiguous. Same orchestration pattern as Section 7 FR-4.3 (resource-architect approval prompt).
    - **Sequential prompting (FR-2.5)** — orchestrator MUST emit Stage-2 prompts ONE AT A TIME per ambiguous recommendation. NO batching. The order of prompts follows the order of recommendations in the agent's iter-1 `## Additional Roles` body of `.claude/roles-pending.md`.
    - **Headless contract (FR-6.1, FR-6.4)** — orchestrator detects non-interactive context via `process.stdin.isTTY === false` (or shell `[ -t 0 ]`). Detection mechanism MUST match Section 7 FR-7.4 (resource-architect headless detection). When non-interactive: orchestrator MUST SKIP all Stage-2 prompts entirely; agent MUST default to Stage 3 (create new) for every Stage-2 candidate; audit entries recorded as `headless-default-create`. Stage 1 (exact slug, automatic reuse) UNAFFECTED — runs without prompting safely in headless contexts.
    - **Hand-off addendum** — the orchestrator's prior Step 3.75 hand-off (planner inlines `.claude/roles-pending.md` into `.claude/plan.md`, then deletes the temp file) IS PRESERVED unchanged. The new `## Reuse Decisions` subsection added by FR-8.1 is a SUBSECTION of `.claude/roles-pending.md` and is inlined transparently — no planner prompt change required (handled by the planner's existing whole-file inline behavior).
    - **Step 3.75 SUCCESS / FAILURE semantics** — Step 3.75 SUCCEEDS unless the agent's reuse-scan or any Stage-1/Stage-2/Stage-3 path produces an unrecoverable I/O failure. Stage-2 ambiguous-default-deny outcomes, headless-default-create outcomes, legacy-migration outcomes, and malformed-yaml-skipped outcomes are NOT failures — they are recorded in the audit trail and Step 3.75 SUCCEEDS. The mandatory-and-non-skippable nature from Section 5 FR-3.2 is PRESERVED. Step number REMAINS `3.75` — no renumbering to `3.76` or `3.751`.
- **Verify:**
  ```
  [ "$(grep -cE '^### Step 3\.75:' src/commands/bootstrap-feature.md)" -eq 1 ] \
    && [ "$(grep -cE '^### Step 3\.76|^### Step 3\.751|^### Step 3\.755' src/commands/bootstrap-feature.md)" -eq 0 ] \
    && grep -qF 'Iteration-2 reuse extension' src/commands/bootstrap-feature.md \
    && grep -qE 'basename.*git rev-parse --show-toplevel' src/commands/bootstrap-feature.md \
    && grep -qF 'unknown-project' src/commands/bootstrap-feature.md \
    && grep -qE 'feat/|fix/' src/commands/bootstrap-feature.md \
    && grep -qF "Reuse existing role 'ondemand-" src/commands/bootstrap-feature.md \
    && grep -qF "create new 'ondemand-" src/commands/bootstrap-feature.md \
    && grep -qF '[yes/no]' src/commands/bootstrap-feature.md \
    && grep -qE 'one at a time|sequential|ONE AT A TIME' src/commands/bootstrap-feature.md \
    && grep -qE 'process\.stdin\.isTTY|isTTY === false|non-interactive' src/commands/bootstrap-feature.md \
    && grep -qF 'headless-default-create' src/commands/bootstrap-feature.md \
    && grep -qE 'Stage 1.*unaffected|Stage 1.*automatic|Stage-1.*safe' src/commands/bootstrap-feature.md \
    && grep -qE 'mandatory and non-skippable|MANDATORY and non-skippable' src/commands/bootstrap-feature.md \
    && grep -qF '## Reuse Decisions' src/commands/bootstrap-feature.md \
    && grep -qF '.claude/roles-pending.md' src/commands/bootstrap-feature.md \
    && [ "$(grep -cE '17 specialized|17 AI agents|17 agents' src/commands/bootstrap-feature.md)" = "$(git show HEAD:src/commands/bootstrap-feature.md | grep -cE '17 specialized|17 AI agents|17 agents')" ] \
    && [ "$(grep -cE '18 specialized|18 AI agents|18 agents|11 gates|11 quality gates' src/commands/bootstrap-feature.md)" -eq 0 ] \
    && git diff --exit-code install.sh \
    && git diff --exit-code templates/CLAUDE.md
  ```
- **Done when:** Exactly one `### Step 3.75:` heading; zero `### Step 3.76`/`### Step 3.751`/`### Step 3.755` (no renumbering); Iter-2 reuse extension subsection present; both project-name and feature-slug derivation documented; Stage-2 prompt format byte-correct; sequential-prompting clause present; headless-detection mechanism cited and `Stage 1.*unaffected` clause present; agent-count strings byte-equivalent to HEAD via `grep -cE` comparison; no spurious `18`/`11` count drift; `install.sh` and `templates/CLAUDE.md` byte-unchanged.
- **Pre-review:** architect (verifies derivation symmetry with FR-3.4/FR-3.5 in Slice 4, headless-mechanism alignment with Section 7 FR-7.4, sequential-prompting wording)
- **Satisfies AC:** AC-4, AC-5, AC-21 (cross-reference validity)

---

### Slice 4: merge-ready.md Step 11 — On-Demand Role Teardown after Gate 9 (orchestrator-side, with all 4 [STRUCTURAL] decisions)

- **Wave:** 1
- **Use cases:** UC-8 (post-merge teardown happy path), UC-9 (multi-feature shared file), UC-10 (idempotency), UC-11 (ALL-occurrence removal), UC-12 (refuse-from-non-feature-branch), UC-13 (defense-in-depth path resolution), UC-15 (legacy file no-op)
- **Files:** `src/commands/merge-ready.md`
- **Changes:**
  - INSERT a new top-level section `## Step 11: On-Demand Role Teardown` AFTER the existing `## Gate 9: Release Packaging` section (currently lines 75-103) and BEFORE the existing `## Output Format` heading (currently line 105). Step 11 is a STEP, NOT a gate — the body MUST explicitly state this AND state that the total `/merge-ready` gate count REMAINS 10 (it does NOT increment to 11).
  - The Step 11 body MUST include the following subsections in this fixed order:
    - **Invocation** — Step 11 invoked exactly once per `/merge-ready` cycle, after Gate 9 completes (regardless of whether Gate 9 reported PASS, FAIL, or SKIPPED — Step 11 runs unconditionally per FR-3.1). The `role-planner` AGENT is NOT invoked at Step 11 — it is a bootstrap-only agent. The orchestrator (the `/merge-ready` command runtime) performs Step 11 inline OR delegates the per-file frontmatter mutation to a helper subagent. Both are acceptable. The standard `/merge-ready` runtime has Bash access required for git ancestry checks and file deletion.
    - **Project-name and feature-slug derivation (FR-3.4, FR-3.5)** — orchestrator computes `<project-name>` as `basename "$(git rev-parse --show-toplevel)"` (or literal `unknown-project` when not in a git repo, identical to bootstrap-time FR-1.3). Orchestrator computes `<feature-slug>` as the merged branch's name with `feat/`/`fix/` prefix stripped, identical to bootstrap-time FR-1.4. Merged-branch identification: the head of the most recently merged PR OR (when run locally without a PR) the branch the developer just merged via `git merge --no-ff <branch>`.
    - **Refuse-from-non-feature-branch ([STRUCTURAL] decision 3)** — if the current branch is NOT `feat/<slug>` or `fix/<slug>` (i.e. `main`, `release/*`, detached HEAD, or any other non-feature branch) AND no merged-PR context is available, Step 11 MUST emit the literal error `"Refusing teardown from non-feature branch '<branch>' without explicit feature-slug — pass via merged PR context or skip Step 11"` (with `<branch>` substituted). All three teardown counts reported as zero. The refusal does NOT block merge-readiness — Step 11 is not a gate.
    - **Refuse-when-not-merged (FR-4.1)** — orchestrator MUST verify merge-ancestry via `git merge-base --is-ancestor <feature-branch-head> main`. If non-zero exit (branch not yet merged), emit literal error `"Refusing teardown: branch '<feature-slug>' is not yet merged into main"` and report all three counts zero.
    - **Per-file mutation logic (FR-3.6) + ALL-occurrence removal ([STRUCTURAL] decision 2)** — for every `~/.claude/agents/ondemand-*.md` whose `features:` array contains the entry `<project-name>:<feature-slug>`, the orchestrator: (a) Reads file, (b) parses YAML frontmatter, (c) removes EVERY matching `<project-name>:<feature-slug>` entry from the array (all-occurrence — NOT just first-occurrence — required for NFR-2 idempotency on duplicate-entry files), (d) Writes the modified file atomically per FR-5.1. NO partial `Edit` operations. File body BELOW closing `---` preserved byte-for-byte (FR-5.5).
    - **Atomic delete-only when array empties ([STRUCTURAL] decision 4)** — when the in-memory mutation transitions `features:` from non-empty to empty, the orchestrator MUST `rm` the file directly. The orchestrator MUST NOT first Write the empty-array version to disk before deleting. Pre-existing files with `features: []` (already-empty arrays from prior partial-failure or manual editing) are NOT deletion triggers — deletion only triggers when THIS invocation's removal transitions the array from non-empty to empty. If `rm` fails (permission, I/O, file vanished), the file is left in its prior state with the entry still present (because no Write was attempted) and the failure recorded as `failed` in the audit trail. Orchestrator MUST continue scanning subsequent files after a per-file failure.
    - **Defense-in-depth deletion safety (FR-4.3, FR-4.4, FR-4.5)** — orchestrator MUST glob-match the literal path pattern `~/.claude/agents/ondemand-*.md` for every deletion. Resolve the file path and verify the resolved path is under `~/.claude/agents/` before deletion (defense against symlink/path-traversal). Files at `~/.claude/agents/<core-agent>.md` (lacking `ondemand-` prefix) are NOT visible to the FR-1.1 glob and are excluded. Files matching `ondemand-*.md` whose frontmatter `scope` is NOT `on-demand` (marker-mismatch case) are SKIPPED — orchestrator emits a warning to the merge-ready output but does NOT mutate the file. The 17 core agent slugs (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`) MUST never be teardown-deletion targets.
    - **Legacy file handling (FR-7.4)** — files lacking a `features:` field are no-ops at Step 11. Orchestrator MUST NOT delete legacy files at teardown. Orchestrator MAY emit informational note `"Found <L> legacy on-demand role files without features: arrays — left unchanged. Future bootstrap reuse will migrate them on demand."` appended to the FR-8.2 summary line.
    - **FR-8.2 summary line format** — Step 11 emits a single one-line summary appended to the `/merge-ready` output table: `Post-Merge: On-Demand Role Teardown — <N> roles updated, <M> deleted, <K> unchanged`. When teardown refuses to run (FR-4.1 or FR-4.2 / [STRUCTURAL] 3), the summary contains the verbatim refusal message with all three counts zero. When per-file failures occur, append `; <F> failed (see audit log)`. When legacy files were observed, append `; <L> legacy files left unchanged`.
    - **Idempotency (NFR-2)** — re-running Step 11 after teardown is safe. Already-removed entries are not found (K count increments instead of N). Already-deleted files are absent from the FR-1.1 glob. Repeated invocation produces IDENTICAL state on disk after the first.
  - UPDATE the `## Output Format` table (currently line 110-122) — DO NOT change the gate count or add a row to the GATE table. Instead, INSERT below the gate table a new sentence: `Step 11 (On-Demand Role Teardown) appends a separate one-line summary outside the gate table with the format: \`Post-Merge: On-Demand Role Teardown — <N> roles updated, <M> deleted, <K> unchanged\`. Step 11 is a STEP, not a gate — it does not contribute to the 10-gate tally and does not block MERGE READY.`
  - VERIFY the existing `## Gate 9: Release Packaging` heading and "Gate 9 is the LAST gate" wording from line 79 still reads correctly. Update that wording — it is no longer the last item in the merge-ready sequence (Step 11 follows), but it is still the LAST GATE. Reword from `Gate 9 is the LAST gate in the merge-ready sequence.` → `Gate 9 is the LAST gate in the merge-ready sequence; Step 11 (On-Demand Role Teardown) follows Gate 9 as a step (not a gate), see below.`
  - DO NOT change the "Gate 0 through Gate 9" enumeration. DO NOT change the gate count "10" anywhere.
- **Verify:**
  ```
  grep -qF '## Step 11: On-Demand Role Teardown' src/commands/merge-ready.md \
    && grep -qE '## Step 11.*Teardown|^## Step 11:' src/commands/merge-ready.md \
    && [ "$(grep -cE '^## Gate (0|1|2|3|4|5|6|7|8|9):' src/commands/merge-ready.md)" -eq 10 ] \
    && [ "$(grep -cE '^## Gate 10:|^## Gate 11:' src/commands/merge-ready.md)" -eq 0 ] \
    && grep -qE 'STEP, NOT a gate|step, not a gate|step \(not a gate\)' src/commands/merge-ready.md \
    && grep -qE 'gate count.*10|10 gates|10 quality gates|Gate 0 through Gate 9' src/commands/merge-ready.md \
    && grep -qE 'after Gate 9|AFTER Gate 9' src/commands/merge-ready.md \
    && grep -qE 'basename.*git rev-parse --show-toplevel' src/commands/merge-ready.md \
    && grep -qF 'unknown-project' src/commands/merge-ready.md \
    && grep -qF 'git merge-base --is-ancestor' src/commands/merge-ready.md \
    && grep -qF "Refusing teardown from non-feature branch" src/commands/merge-ready.md \
    && grep -qF "Refusing teardown: branch" src/commands/merge-ready.md \
    && grep -qF "is not yet merged into main" src/commands/merge-ready.md \
    && grep -qE 'all-occurrence|all occurrence|every matching entry|EVERY matching' src/commands/merge-ready.md \
    && grep -qE 'rm.*directly|rm the file directly|MUST `rm`' src/commands/merge-ready.md \
    && grep -qE 'MUST NOT.*Write.*empty-array|MUST NOT first Write|no intermediate empty-array Write' src/commands/merge-ready.md \
    && grep -qF 'Post-Merge: On-Demand Role Teardown' src/commands/merge-ready.md \
    && grep -qE '<N> roles updated, <M> deleted, <K> unchanged|N roles updated, M deleted, K unchanged' src/commands/merge-ready.md \
    && grep -qE 'symlink|path-traversal|defense-in-depth|defense in depth' src/commands/merge-ready.md \
    && grep -qE 'scope: on-demand|marker-mismatch' src/commands/merge-ready.md \
    && grep -qF 'release-engineer' src/commands/merge-ready.md \
    && [ "$(grep -cE '17 specialized|17 AI agents|17 agents|17 core' src/commands/merge-ready.md)" = "$(git show HEAD:src/commands/merge-ready.md | grep -cE '17 specialized|17 AI agents|17 agents|17 core')" ] \
    && [ "$(grep -cE '^## Gate (0|1|2|3|4|5|6|7|8|9):' src/commands/merge-ready.md)" -eq 10 ] \
    && [ "$(grep -cE '^## Gate 10:|^## Gate 11:' src/commands/merge-ready.md)" -eq 0 ] \
    && [ "$(grep -cE '11 gates|11 quality gates|18 specialized|18 AI agents' src/commands/merge-ready.md)" -eq 0 ] \
    && git diff --exit-code install.sh \
    && git diff --exit-code templates/CLAUDE.md
  ```
- **Done when:** `## Step 11: On-Demand Role Teardown` heading present exactly once; gate-count headings remain at exactly 10 (`## Gate 0:` through `## Gate 9:`); zero `## Gate 10:` or `## Gate 11:`; "step, not a gate" wording present; both refusal literal messages byte-correct; ALL-occurrence rule documented; "MUST `rm` the file directly" + "MUST NOT first Write" wording present (no intermediate empty-array Write); FR-8.2 summary format documented; defense-in-depth path-resolution clause present; gate-count strings byte-equivalent to HEAD; zero `11 gates`/`18 agents` drift; `install.sh` and `templates/CLAUDE.md` byte-unchanged.
- **Pre-review:** architect AND security (architect: gate-count invariance, refusal-message exactness, all-occurrence semantics; security: defense-in-depth path resolution, symlink-safety, marker-mismatch skip, core-agent exclusion correctness)
- **Satisfies AC:** AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-17, AC-21

---

### Slice 5: src/claude.md — role-planner Agency Roles row text + Plan Critic recognition for `## Reuse Decisions`

- **Wave:** 1
- **Use cases:** UC-13, UC-14, UC-16 (audit subsection recognition)
- **Files:** `src/claude.md`
- **Changes:**
  - REPLACE the `role-planner` row in the Agency Roles table (currently line 17): `| Role Planner | \`role-planner\` | Recommend project-specific specialized roles (mobile dev, compliance officer, etc.) at bootstrap Step 3.75 |` → `| Role Planner | \`role-planner\` | Recommend project-specific specialized roles at bootstrap Step 3.75 with cross-feature reuse; participate in post-merge teardown of unused on-demand roles. |`. Role title and Agent column UNCHANGED. Only the Responsibility column is replaced (per FR-9.8 verbatim text).
  - ADD a new Plan Critic recognition bullet to the existing Plan Critic prompt (currently around line 116). The new bullet appears AFTER the existing `## Additional Roles` recognition bullet and reads: `> - The \`## Reuse Decisions\` subsection (if present in \`.claude/plan.md\` after \`## Additional Roles\` and \`## Role invocation plan\`) is a valid plan subsection produced by \`role-planner\` at bootstrap Step 3.75 reuse mode — do NOT flag its presence as a finding. Absence is also NOT a finding (legacy plans, plans where every recommendation hit Stage 3, and plans with "No additional roles required" do not have meaningful reuse decisions). Status strings outside the 8-enum (\`stage-1-exact-slug-match\`, \`stage-2-purpose-match-approved\`, \`stage-2-purpose-match-declined\`, \`stage-3-no-match-created\`, \`headless-default-create\`, \`legacy-migrated\`, \`malformed-yaml-skipped\`, \`migration-failed-malformed-yaml\`) MAY be raised as MINOR — not CRITICAL, not MAJOR.`
  - DO NOT change the agent-count strings or gate-count strings. The `release-engineer` row already exists at line 29 and remains.
  - DO NOT add a new row. DO NOT remove a row.
- **Verify:**
  ```
  grep -qF 'Recommend project-specific specialized roles at bootstrap Step 3.75 with cross-feature reuse; participate in post-merge teardown of unused on-demand roles.' src/claude.md \
    && grep -qF '| Role Planner | `role-planner` |' src/claude.md \
    && [ "$(grep -cE '^\\| Role Planner \\| `role-planner`' src/claude.md)" -eq 1 ] \
    && grep -qF '## Reuse Decisions' src/claude.md \
    && grep -qF 'stage-1-exact-slug-match' src/claude.md \
    && grep -qF 'stage-2-purpose-match-approved' src/claude.md \
    && grep -qF 'stage-2-purpose-match-declined' src/claude.md \
    && grep -qF 'stage-3-no-match-created' src/claude.md \
    && grep -qF 'headless-default-create' src/claude.md \
    && grep -qF 'legacy-migrated' src/claude.md \
    && grep -qF 'malformed-yaml-skipped' src/claude.md \
    && grep -qF 'migration-failed-malformed-yaml' src/claude.md \
    && [ "$(grep -oE 'stage-1-exact-slug-match|stage-2-purpose-match-approved|stage-2-purpose-match-declined|stage-3-no-match-created|headless-default-create|legacy-migrated|malformed-yaml-skipped|migration-failed-malformed-yaml' src/claude.md | sort -u | wc -l | tr -d ' ')" = "8" ] \
    && [ "$(grep -cE '17 specialized|17 AI agents|17 agents' src/claude.md)" = "$(git show HEAD:src/claude.md | grep -cE '17 specialized|17 AI agents|17 agents')" ] \
    && [ "$(grep -cE '10 gates|10 quality gates' src/claude.md)" = "$(git show HEAD:src/claude.md | grep -cE '10 gates|10 quality gates')" ] \
    && [ "$(grep -cE '18 specialized|18 AI agents|18 agents|11 gates|11 quality gates' src/claude.md)" -eq 0 ] \
    && grep -qF 'release-engineer' src/claude.md \
    && [ "$(grep -cE '^\\|.*\\|.*`release-engineer`' src/claude.md)" -ge 1 ] \
    && git diff --exit-code install.sh \
    && git diff --exit-code templates/CLAUDE.md
  ```
- **Done when:** Verbatim FR-9.8 Responsibility text present; exactly one `Role Planner` table row; `## Reuse Decisions` recognition added to Plan Critic; all 8 enum statuses present in src/claude.md (counted via `sort -u | wc -l = 8`); agent-count and gate-count strings byte-equivalent to HEAD; zero count drift to 18/11; `release-engineer` row preserved; `install.sh` and `templates/CLAUDE.md` byte-unchanged.
- **Pre-review:** none
- **Satisfies AC:** AC-15, AC-16, AC-17, AC-20, AC-21

---

### Slice 6: README.md — role-planner feature section extension (cross-feature reuse + automatic teardown narrative)

- **Wave:** 1
- **Use cases:** UC-13, UC-14
- **Files:** `README.md`
- **Changes:**
  - Locate the existing `## On-demand role recommendations at bootstrap` section (currently around lines 204-218). EXTEND with a new paragraph or subsection describing the iter-2 capabilities while preserving the iter-1 narrative byte-for-byte.
  - Add a subsection or paragraph titled (suggested heading) `### Iteration 2: cross-feature reuse and automatic teardown` that describes:
    - **3-stage matching at bootstrap** — Stage 1 exact-slug → automatic reuse; Stage 2 purpose match → user prompt with default-deny on ambiguous; Stage 3 no match → create new (iter-1 behavior).
    - **Affirmative/negative token grammar with default-deny** — explicit list of affirmative (`yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`) and negative (`no`, `n`, `decline`, `skip`, `not now`) tokens; ambiguous replies treated as NEGATIVE.
    - **Per-file `features:` manifest** — `features: ["<project-name>:<feature-slug>", ...]` array tracks which features own each on-demand role; the `<project-name>` prefix disambiguates across multiple projects sharing the user's global `~/.claude/agents/`.
    - **Post-merge teardown at /merge-ready Step 11** — after Gate 9, the orchestrator removes the merged feature's entry from every on-demand role's `features:` array; deletes the file when the array empties. Refuses teardown from non-feature branches and from un-merged feature branches (defense-in-depth via `git merge-base --is-ancestor`). NEVER deletes core-agent files (lacking `ondemand-` prefix) or files outside `~/.claude/agents/ondemand-*.md`.
    - **Legacy file migration** — files created under iter-1 (lacking the `features:` array) are migrated opportunistically when matched by a current feature's recommendation; legacy files NOT matched are left unchanged.
    - **Headless-default-create** — non-interactive contexts (CI/CD without TTY) skip Stage-2 prompts and default to creating new files; Stage-1 automatic reuse still runs (no user input required).
    - **No new agents, no new gates** — iter-2 ADDS NO new agents (count stays at 17) and ADDS NO new gates (count stays at 10). Step 11 is a STEP, not a gate.
  - DO NOT change the `17 specialized AI agents` banner string (line 5). DO NOT change the `10 quality gates` text (line 35). DO NOT change `## The 17 Agents` heading (line 96). DO NOT change the `release-engineer` table row (line 116). DO NOT change the agent count anywhere.
- **Verify:**
  ```
  grep -qE 'cross-feature reuse|cross feature reuse' README.md \
    && grep -qE 'automatic teardown|post-merge teardown' README.md \
    && grep -qE '3-stage|three-stage|Stage 1.*Stage 2.*Stage 3' README.md \
    && grep -qE 'default-deny|default deny|ambiguous' README.md \
    && grep -qE 'features:' README.md \
    && grep -qE '<project-name>|project-name' README.md \
    && grep -qE 'legacy|migration|migrated' README.md \
    && grep -qE 'Step 11|step 11' README.md \
    && grep -qE 'headless|non-interactive|isTTY' README.md \
    && grep -qE 'git merge-base --is-ancestor|merge-ancestry|merge ancestry' README.md \
    && [ "$(grep -cE '17 specialized AI agents' README.md)" = "$(git show HEAD:README.md | grep -cE '17 specialized AI agents')" ] \
    && [ "$(grep -cE '10 quality gates' README.md)" = "$(git show HEAD:README.md | grep -cE '10 quality gates')" ] \
    && [ "$(grep -cE '## The 17 Agents' README.md)" = "$(git show HEAD:README.md | grep -cE '## The 17 Agents')" ] \
    && [ "$(grep -cE '18 specialized|18 AI agents|11 gates|11 quality gates|## The 18 Agents' README.md)" -eq 0 ] \
    && grep -qF 'release-engineer' README.md \
    && git diff --exit-code install.sh \
    && git diff --exit-code templates/CLAUDE.md
  ```
- **Done when:** All 10 narrative content checks pass (cross-feature reuse, automatic teardown, 3-stage, default-deny, features: array, project-name prefix, legacy migration, Step 11, headless, merge-ancestry); banner strings byte-equivalent to HEAD via `grep -cE` comparison; zero drift to `18 agents`/`11 gates`/`## The 18 Agents`; `release-engineer` row preserved; `install.sh` and `templates/CLAUDE.md` byte-unchanged.
- **Pre-review:** none
- **Satisfies AC:** AC-16, AC-17, AC-21

---

## Wave summary table

| Wave | Slices | Files (disjoint within wave) | Rationale |
|------|--------|------------------------------|-----------|
| 1 | 1, 3, 4, 5, 6 | `src/agents/role-planner.md` (slice 1) ∥ `src/commands/bootstrap-feature.md` (slice 3) ∥ `src/commands/merge-ready.md` (slice 4) ∥ `src/claude.md` (slice 5) ∥ `README.md` (slice 6) | Five independent, file-disjoint slices touching five distinct files. Slice 1 (Authority Boundary 17-count + release-engineer + in-place-mutation authorization) is foundational for Slice 2's Reuse Mode capability section but does NOT logically depend on Slices 3-6 (orchestration/audit/narrative). Slices 3-6 do NOT depend on Slice 1's content because they reference role-planner.md only by NAME, not by line content. |
| 2 | 2 | `src/agents/role-planner.md` (sequential after Slice 1) | Slice 2 (Reuse Mode capability section — 10 subsections including 3-stage algorithm, atomic mutation contract, 8-status enum, legacy migration, headless-default-create, collision handling, de-dup) APPENDS to `src/agents/role-planner.md` after Slice 1's Authority Boundary updates have landed. File-shared with Slice 1, so MUST be in a later wave. |

**Total: 6 slices across 2 waves.**

**Wave 1 file ownership** (mutually exclusive, no overlap):
- Slice 1 → `src/agents/role-planner.md`
- Slice 3 → `src/commands/bootstrap-feature.md`
- Slice 4 → `src/commands/merge-ready.md`
- Slice 5 → `src/claude.md`
- Slice 6 → `README.md`

**Wave 2 file ownership**:
- Slice 2 → `src/agents/role-planner.md` (sequential after Wave 1's Slice 1)

**Logical-dependency note**: Slice 2's "Reuse mode (Iteration 2)" section content references the FR-1.6 17-core-agent enumeration and the in-place mutation authorization established by Slice 1. Therefore Slice 2 is correctly placed in Wave 2 (after Slice 1) — even though they share `src/agents/role-planner.md` (which would force sequential execution anyway), the logical dependency is independently confirmed.

## Acceptance criteria mapping (22/22 ACs covered)

- **AC-1** (role-planner.md updated with Reuse mode capability section) → Slice 2
- **AC-2** (`tools` frontmatter unchanged byte-for-byte) → Slices 1+2 (both verify)
- **AC-3** (Stage-1 exact slug match behavior) → Slice 2
- **AC-4** (Stage-2 prompt format and approval handling) → Slices 2+3
- **AC-5** (headless context default-create) → Slices 2+3
- **AC-6** (legacy file migration) → Slice 2
- **AC-7** (merge-ready.md Step 11 added after Gate 9) → Slice 4
- **AC-8** (Step 11 derivation and per-file mutation) → Slice 4
- **AC-9** (refuse-from-non-feature-branch) → Slice 4
- **AC-10** (refuse-when-not-merged) → Slice 4
- **AC-11** (defense-in-depth deletion safety) → Slice 4
- **AC-12** (atomic frontmatter mutation, no Edit) → Slices 2+4
- **AC-13** (file body byte-preservation) → Slices 2+4
- **AC-14** (8-status enum exhaustive) → Slices 2+5 (slice 2 emits, slice 5 recognizes)
- **AC-15** (Plan Critic recognizes `## Reuse Decisions`) → Slice 5
- **AC-16** (agent count 17 byte-unchanged) → Slices 1+3+4+5+6 (every slice verifies)
- **AC-17** (gate count 10 byte-unchanged) → Slices 4+5+6 (verified at every touch-point)
- **AC-18** (`install.sh` byte-unchanged) → All 6 slices verify `git diff --exit-code install.sh`
- **AC-19** (`templates/CLAUDE.md` byte-unchanged) → All 6 slices verify `git diff --exit-code templates/CLAUDE.md`
- **AC-20** (Agency Roles row updated in src/claude.md) → Slice 5
- **AC-21** (cross-references valid) → Slices 1+2+3+4+5+6
- **AC-22** (NFR-1 5-second budget for ≤50 files) → Slice 2 (documents the bounded-scan algorithm; runtime measurement deferred to E2E)

## Files to modify (no new files)

- `src/agents/role-planner.md` — Slices 1 (Wave 1) + 2 (Wave 2). Sequential.
- `src/commands/bootstrap-feature.md` — Slice 3 (Wave 1)
- `src/commands/merge-ready.md` — Slice 4 (Wave 1)
- `src/claude.md` — Slice 5 (Wave 1)
- `README.md` — Slice 6 (Wave 1)

**`install.sh` MUST NOT be modified.** Every slice verifies `git diff --exit-code install.sh` (per AC-18).

**`templates/CLAUDE.md` MUST NOT be modified.** Every slice verifies `git diff --exit-code templates/CLAUDE.md` (per AC-19).

**`src/agents/planner.md` MUST NOT be modified.** The planner inlines `## Additional Roles` (and now `## Reuse Decisions` as its subsection) from `.claude/roles-pending.md` via its existing whole-file inline behavior — no prompt change required (per PRD §8.6 unchanged-files table).

## Risk assessment

**Data sensitivity**: None. All operations on local markdown agent prompt files under `~/.claude/agents/`. No PII, no credentials, no financial data.

**Auth impact**: None. No authentication boundaries modified. The `role-planner` agent's Authority Boundary is EXTENDED (in-place `features:` array mutation permitted) but the `tools` frontmatter remains exactly `["Read", "Write", "Glob", "Grep"]` (no Bash, no Edit) — defense-in-depth tool allowlist preserved (FR-9.7 / NFR-7).

**Persistence changes**: Iter-2 introduces a new persistent YAML field `features:` on `~/.claude/agents/ondemand-<slug>.md` files. The field is opportunistically migrated for legacy files (FR-7.2). No database schema. No production data store.

**External calls**: None. All inputs are local files. The orchestrator's `git rev-parse --show-toplevel`, `git merge-base --is-ancestor`, and `basename` are local Bash invocations under the standard `/bootstrap-feature` and `/merge-ready` runtimes — NOT performed by the `role-planner` agent (which has no Bash). No HTTP, no DNS, no GitHub API queries (FR-4.6 / NFR-7).

**Concurrency**: NFR-3 explicitly assumes single-user single-machine. NO file locking. Two simultaneous `/merge-ready` invocations on the same machine racing on the same on-demand role file produce OS last-write-wins behavior. Out-of-scope item 7 (8.4) defers multi-pipeline coordination.

**Defense-in-depth boundaries**: 
- Filename-prefix self-check (`ondemand-` MUST-START rule from Section 5 FR-2.3) PRESERVED unchanged.
- Tool allowlist `["Read", "Write", "Glob", "Grep"]` PRESERVED — no `Bash`, `Edit`, `WebFetch`, `WebSearch`, `NotebookEdit`.
- Slug-collision rule against 17 core agent names PRESERVED with `release-engineer` ADDED to the enumeration.
- Step 11 deletion logic glob-matches the literal pattern `~/.claude/agents/ondemand-*.md` and resolves paths to defend against symlink/path-traversal.
- Marker-mismatch files (filename `ondemand-*` but `scope: <not-on-demand>`) are SKIPPED, not mutated.

## Dependencies

1. **Risk: SDLC repo opts out of changelog.** Per Section 3 design decision 1, the SDLC repo itself has no `.claude/rules/changelog.md`, so `changelog-writer` self-skips for this PRD section. Expected behavior — `Changelog:` field captured for authoring consistency but no `CHANGELOG.md` flow. Not a runtime risk.
2. **Risk: Cross-project shared `~/.claude/agents/` namespace.** Two unrelated projects on the same machine sharing `~/.claude/agents/` may both generate an `ondemand-mobile-dev.md` file — but with different intended purposes. Mitigation: the `<project-name>:` prefix in `features:` (FR-1.2 / FR-1.3) disambiguates ownership. Project A's teardown only removes `project-a:<slug>` entries; project B's `project-b:<slug>` entry remains, file is not deleted until ALL projects have torn it down. Stage-1 slug-match reuse picks up cross-project bodies — feature, not bug, when bodies are consistent.
3. **Risk: Legacy file migration (Section 5 iter-1 files lacking `features:`).** Files created under iter-1 lack the `features:` array. Mitigation: FR-7.2 migrates opportunistically when matched. Legacy files NOT matched are left untouched per FR-7.4 — they accumulate as silent technical debt until manual cleanup. Acceptable iter-2 tradeoff; bulk migration is out-of-scope item 5.
4. **Risk: Teardown executed before all merge work complete.** A developer might run `/merge-ready` Step 11 with a not-yet-merged feature branch. Mitigation: FR-4.1 verifies merge-ancestry via `git merge-base --is-ancestor` and refuses if not yet merged. False negatives possible (developer simply re-runs after `git pull` updates `main`). Idempotency per NFR-2 ensures re-run is safe.
5. **Risk: Stage-2 reuse false positives (purpose match unreliable).** "Purpose matches" check is LLM-judged similarity, not deterministic. Mitigation: every Stage-2 candidate presented to user via FR-2.3 prompt; ambiguous replies default-deny per FR-2.4. False positives → user-facing prompt user can decline. False negatives → extra `ondemand-*.md` files user can manually clean up.
6. **Risk: Concurrent feature work on same machine (two branches simultaneously).** Developer working on two feature branches in parallel may run two pipelines simultaneously. Mitigation: NFR-3 explicitly assumes single-pipeline-at-a-time. OS last-write-wins protects torn writes; audit trail surfaces inconsistencies. Multi-pipeline is out-of-scope item 7.
7. **Risk: Manual user editing of `features:` array breaking teardown.** Developer hand-edit might produce malformed YAML. Mitigation: FR-5.1 atomic read-modify-write fails cleanly on parse errors; iter-2 does NOT auto-repair (out-of-scope item 8). Developer fixes YAML manually. Worst case: entry not removed; developer manually deletes file.
8. **Risk: Squash-merge or rebase-merge breaks merge-ancestry check.** GitHub "Squash and merge" / "Rebase and merge" produce a new commit on `main` whose parent does NOT include feature branch tip. `git merge-base --is-ancestor <feature-tip> main` returns non-zero. Mitigation: FR-4.1 conservatively refuses (safe behavior). Developer manually removes on-demand role files. Robust handling out-of-scope item 6.
9. **Risk: Step-11 step-not-gate confusion.** New "Step 11" is NOT a gate — no PASS/FAIL semantics. Mitigation: FR-3.1 explicit; FR-8.2 specifies free-form summary. Plan Critic and code-reviewer should treat any change promoting Step 11 to a gate as a regression — gate count must remain 10 per FR-9.2 / NFR-6.
10. **Risk: Agent-count drift confusion (count stays at 17).** Iter-2 introduces NO new agents — count remains 17 from Section 6. Mitigation: FR-9.1 / NFR-5 / AC-16 emphasized; every slice verifies via `git show HEAD:file.md | grep -cE` byte-equivalence comparison.
11. **Risk: Reuse-scan runtime regression on large pools.** NFR-1 sets 5-second target for ≤50 files. If pool grows beyond 50, scan slows linearly. Mitigation: developer manually cleans up. Iter-3 capability could add manifest-cache.
12. **Risk: Slug-collision regression (existing core agents at 17 names).** Slug-collision rule from Section 5 forbids on-demand slugs matching any of 17 core agents. Mitigation: FR-1.6 explicitly preserves rule with full enumeration including `release-engineer`. Reuse scan filters by `ondemand-` prefix (FR-1.1), so `~/.claude/agents/<core-agent>.md` files are not visible. Two redundant guards.
13. **Dependency: Section 5 (Role Planner — Iteration 1).** Iter-2 EXTENDS the Section 5 agent file directly. Section 5 is [IN DEVELOPMENT] concurrently. Iter-2 MUST NOT ship before Section 5 ships — iter-1 agent prompt and authorship contract are hard prerequisites. Sequence iter-1 first, then iter-2. Required dependency.
14. **Dependency: Section 6 (Release Engineer).** Agent count (17) baseline assumes Section 6 has shipped first (16 → 17). Gate count (10) baseline also assumes Section 6 (9 → 10). Section 6 [IN DEVELOPMENT] concurrently. Sequence Section 6 before Section 8 to avoid count drift. If Section 6 has not shipped at iter-2 implementation time, FR-9.1 / FR-9.2 / NFR-5 / NFR-6 claims must be re-verified against actual baseline (16, 9) — the no-change-to-count claims still hold (just at different baselines), but verify via `grep` before concluding.
15. **Dependency: Section 7 (Resource Manager-Architect — Iteration 2).** Section 7 establishes affirmative/negative token grammar pattern (Section 7 FR-4.4) reused for Stage-2 reuse approval (FR-2.4). Section 7 [IN DEVELOPMENT] concurrently. Pattern is reference-only — Section 8 enumerates tokens verbatim and does not functionally depend on Section 7 shipping first. Soft dependency.
16. **Dependency: Section 1 FR-3 (Executable Plan Format).** `## Reuse Decisions` subsection (FR-8.1) inlined into `.claude/plan.md` alongside planner's slices produced under Section 1 FR-3. Section 1 [SHIPPED]. Satisfied.
17. **Dependency: Section 3 FR-3 (PRD Changelog Field).** This PRD section includes `Changelog:` field per Section 3 FR-3. Section 3 [IN DEVELOPMENT] concurrently; satisfied by prd-writer update. If Section 3 iter-1 does not ship first, `Changelog:` is documentation-only.
18. **Dependency: Section 2 FR-2 (Wave-Aware Orchestration).** Orthogonal — reuse runs at bootstrap Step 3.75 (before any slice/wave); teardown runs at merge-ready Step 11 (after all waves). Wave orchestration unaffected. Listed for completeness.

## Pre-review flags

- Slice 1: **architect** (FR-9.1/9.2/9.7/9.8 invariance, no inadvertent Authority Boundary relaxation)
- Slice 2: **architect** (3-stage ordering, atomic mutation contract correctness, 8-status enum exhaustiveness, FR-8.1 precedence rule)
- Slice 3: **architect** (orchestrator-side derivation symmetry between bootstrap (Step 3.75) and teardown (Step 11), headless-detection alignment with Section 7 FR-7.4)
- Slice 4: **architect** AND **security** (architect: gate-count invariance, refusal-message exactness, all-occurrence semantics; security: defense-in-depth path resolution, symlink-safety, marker-mismatch skip, core-agent exclusion correctness)
- Slice 5: **none**
- Slice 6: **none**

## Constraints honored

- **6 slices total** (within 5-9 range)
- **Each slice ≤ 200 lines of markdown changes** — Slice 2 is the largest (Reuse Mode capability section with 10 named subsections); the prose-density of `src/agents/role-planner.md` keeps it within 200 lines via concise pinned wording referencing FR-numbers rather than restating full algorithms.
- **All file pathspecs exact** — no glob patterns
- **Files disjoint within each wave** — Wave 1 has 5 distinct files (one per slice); Wave 2 has 1 file (sequential after Slice 1's same-file mutation)
- **17-agent and 10-gate counts verified byte-equivalent** — every slice that touches user-facing strings verifies `[ "$(grep -cE 'pattern' file.md)" = "$(git show HEAD:file.md | grep -cE 'pattern')" ]`
- **`install.sh` byte-unchanged** — every slice verifies `git diff --exit-code install.sh`
- **`templates/CLAUDE.md` byte-unchanged** — every slice verifies `git diff --exit-code templates/CLAUDE.md`
- **All Verify commands** use `grep -qF` for literal strings; `grep -oE | sort -u | wc -l = N` for unique-count assertions; `for prefix in ...; do grep -qF ...; done` for enumerations; `git diff --exit-code <file>` for zero-drift; `[ "$(grep -cE ...)" = "$(git show HEAD:... | grep -cE ...)" ]` for byte-equivalence on counts.

## Review Notes

### Critic Findings
- **Total**: 11 findings (2 critical, 4 major, 5 minor)
- **All CRITICAL/MAJOR addressed**: Yes

### Changes Made
- **CRITICAL #1 (Slice 3 `\\.` regex escaping)**: replaced `grep -cE '^### Step 3\\.75:'` with `grep -cE '^### Step 3\.75:'` (single backslash for ERE literal period). Same fix applied to Slice 3's negative-presence pattern `^### Step 3\.76|^### Step 3\.751|^### Step 3\.755`.
- **CRITICAL #2 (Slices 1+2 `\\[` and `\\]` plus `-eq 1` count wrong)**: replaced `grep -cE 'tools: \\[\"...\"\\]'` literal-bracket pattern + `-eq 1` with `awk '/^---$/{f++; next} f==1' file.md | grep -cF 'tools: ["Read", "Write", "Glob", "Grep"]' -eq 1`. The awk filter scopes the count to the FRONTMATTER block only (between the first two `---` lines), and `grep -cF` uses fixed-string matching so backslash escaping is moot. The `-eq 1` is correct AFTER scoping (the body's on-demand prompt template at line 124 is excluded by the awk filter).
- **MAJOR #3 (Slice 1 missed lines 63 and 292 with "16 core agents")**: extended Slice 1 verify negative-presence pattern from `'the 16 core agent|the 16 core agents|of the 16 core'` to `'the 16 core agent|the 16 core agents|of the 16 core|any of the 16 core'` to catch the additional phrasings at lines 63 and 292.
- **MAJOR #4 (Slice 1+2 tools count `-eq 1` wrong because file has 2 occurrences)**: addressed by the same awk-scoping fix as CRITICAL #2 — count is now `-eq 1` correctly because the count is scoped to the frontmatter block.
- **MAJOR #5 (Slice 4 tautological "10 gates" byte-equivalence on absent literal)**: replaced `[ "$(grep -cE '10 gates|10 quality gates' file)" = "$(git show HEAD:file | grep -cE '10 gates|10 quality gates')" ]` with the structural assertion `[ "$(grep -cE '^## Gate (0|1|2|3|4|5|6|7|8|9):' src/commands/merge-ready.md)" -eq 10 ] && [ "$(grep -cE '^## Gate 10:|^## Gate 11:' src/commands/merge-ready.md)" -eq 0 ]`. This counts the actual `## Gate N:` headings in the file and asserts exactly 10 gates exist with no Gate 10/11 — a substantive invariant rather than a tautology on a missing literal.
- **MAJOR #6 (`grep -cE` line-count vs match-count for release-engineer + 17 core)**: replaced `grep -cE 'foo' file.md` with `grep -oE 'foo' file.md | wc -l | tr -d ' '` to count occurrences not lines. Applied to Slice 1's `release-engineer` ≥ 2 check and `17 core agent|17 core slugs` ≥ 2 check.

### Acknowledged Minor Issues
- MINOR #7 (line numbers off by 1-2 lines): plan uses "currently around line N" loose wording — implementer will adapt.
- MINOR #8 (Slice 5 backticks in single-quoted shell pattern): works correctly in bash/zsh; not a practical issue.
- MINOR #9 (Slice 1 "after line 35" vague): implementer should insert authorization paragraph AFTER the forbidden-actions bullet block ends, not mid-list. Documented here for clarity.
- MINOR #10 (Slice 4 backticks in single-quoted pattern `'MUST `rm`'`): works correctly in bash/zsh single quotes; not a practical issue.
- MINOR #11 (Slice 6 `grep -qE 'features:'` too broad): acceptable for narrative-prose verification; the surrounding checks (`<project-name>`, `legacy`, etc.) ensure substantive content is present.
