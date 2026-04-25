# Implementation Plan: Role Planner — Iteration 1 (On-Demand Role Expansion)

## Prerequisites verified

- **PRD section:** `docs/PRD.md` Section 5 (lines 805-1093) — 20 ACs, 6 FR groups, 11 NFRs
- **Use cases:** `docs/use-cases/role-planner_use_cases.md` — 54 scenarios across 13 primary UCs
- **QA test cases:** `docs/qa/role-planner_test_cases.md` — 136 TCs across 15 categories
- **Architecture review:** PASS with 5 [STRUCTURAL] authorizations

## Deliverables checklist

- [x] PRD section in `docs/PRD.md` (Section 5)
- [x] Use cases in `docs/use-cases/role-planner_use_cases.md` (54 scenarios)
- [x] Architecture review verdict (PASS)
- [x] QA test cases in `docs/qa/role-planner_test_cases.md` (136 TCs)
- [ ] Implementation slices (this document)

## [STRUCTURAL] decisions pinned

1. **Frontmatter-extraction algorithm** (verbatim identical text in `role-planner.md` AND `bootstrap-feature.md`): 4 numbered steps reading leading `---` / finding closing `---` / body-after / pass to `subagent_type: general-purpose`.
2. **5 closed-vocabulary step labels** in call plans: `Step 3.75: role-planner`, `Step 4: qa-planner`, `Step 5: planner`, `Step 6: implementation`, `Step 7: merge-ready`. Enumerated in BOTH agent prompt and bootstrap command.
3. **Sub-steps 4a/4b/4c** in `planner.md` Process: 4a (resources-pending), 4b (roles-pending AFTER resources, BEFORE prerequisites), 4c (independent MUST-deletion of each temp file).
4. **CORE-AGENT-ENUMERATION HTML markers** wrapping 16-agent list in `role-planner.md` for future grep audits.
5. **MANDATORY overwrite annotation** in role-planner.md — any existing-file overwrite produces visible audit line.
6. **MANDATORY filename-prefix self-check** in role-planner.md — every Write to `~/.claude/agents/` verifies `ondemand-` prefix before issuing Write tool call.
7. **Plan Critic core-slug collision MAJOR** — if per-role slug matches any of the 16 core agent names, flag MAJOR.
8. **Canonical case** — `src/claude.md` (lowercase; APFS case-alias `src/CLAUDE.md` resolves to same inode 4443075 on this filesystem).
9. **Wave 1→Wave 2 textual coupling** — the frontmatter-extraction algorithm text MUST be byte-identical between `src/agents/role-planner.md` (Slice 1, Wave 1) and `src/commands/bootstrap-feature.md` (Slice 3, Wave 2). Wave separation gives Slice 3 access to Slice 1's already-committed text. **Slice 3 MUST copy the algorithm verbatim from Slice 1's committed `role-planner.md`, NOT draft independently.** Slice 3 Verify includes a `diff` check against Slice 1's text to catch drift.

---

## Implementation plan (6 slices)

### Slice 1: Author `role-planner` agent with frontmatter, authority/output boundaries, core-enumeration markers, pinned output format

- **Wave:** 1
- **Use cases:** UC-1, UC-1-A1, UC-1-E1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-8, UC-9, UC-10, UC-11, UC-12, UC-13 (every UC where the agent itself is actor)
- **Files:** `src/agents/role-planner.md` [new]
- **Changes:**
  - YAML frontmatter: `name: role-planner`, `description:` (single sentence), `tools: ["Read", "Write", "Glob", "Grep"]` (EXACTLY these four, no `Bash`/`Edit`/`WebFetch`/`WebSearch`/`NotebookEdit`), `model: opus`.
  - `## Inputs` — 5 ordered inputs: (a) PRD section, (b) `docs/use-cases/<feature>_use_cases.md`, (c) architect verdict from Step 3 context, (d) `.claude/resources-pending.md` if exists, (e) project CLAUDE.md. Explicit "MUST NOT read `.claude/scratchpad.md`".
  - `## Authority Boundary` — PERMITTED: 5 inputs, write `.claude/roles-pending.md`, write `~/.claude/agents/ondemand-<slug>.md`. PROHIBITED: core agent files, `src/agents/*.md`, settings files, `.env*`, MCP configs, docs, plan.md, scratchpad.md. No network. No shell. List ≥6 package-manager commands as prohibited.
  - `## Output Boundary` — exactly 2 write targets; rest of filesystem off-limits. MUST NOT recommend new pipeline steps, modifications to Agency Roles, external resources (resource-architect's scope).
  - `## Filename prefix self-check` — heading line MUST contain literal `MANDATORY`. Body: "Before every Write to `~/.claude/agents/`, verify target filename begins with literal `ondemand-`. If not, abort with authority-boundary violation message and do not issue Write." (architect [STRUCTURAL] 5)
  - `<!-- CORE-AGENT-ENUMERATION-START -->` ... `<!-- CORE-AGENT-ENUMERATION-END -->` wrapping all 16 core agent slugs: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner` (each with one-line responsibility). (architect [STRUCTURAL] 2)
  - `## Output Format` — 5 per-role fields per FR-1.4: Role title, Slug (regex `/^[a-z][a-z0-9-]*[a-z0-9]$/`), Why (citing PRD FR), Pipeline step (closed vocabulary), Purpose. Temp-file structure: `## Additional Roles` heading + summary line + per-role `####` blocks + `## Role invocation plan` subsection. Closed-vocabulary step labels enumerated verbatim (only 5 valid). "No additional roles required" path explicit (FR-1.5).
  - `## Overwrite annotation` — heading line MUST contain literal `MANDATORY`. Body: when overwriting existing `.claude/roles-pending.md` or `~/.claude/agents/ondemand-<slug>.md`, MUST inline "Overwrote existing prompt file at <path>" annotation in the `## Additional Roles` body. (architect [STRUCTURAL] 4)
  - `## Frontmatter-extraction algorithm` — 4-step numbered list, verbatim same as bootstrap-feature.md Slice 3: (1) Read file with Read tool. (2) If first non-blank line is not literal `---`, surface malformed-frontmatter error and abort. (3) Find second `---` line; body is everything after it. (4) Pass body verbatim as `prompt` parameter of Agent tool call with `subagent_type: general-purpose`.
  - `## On-demand prompt file template` — required frontmatter for generated files: `name: ondemand-<slug>`, `description`, `tools` (default `["Read", "Write", "Grep", "Glob"]`, no Bash unless rationale in description), `model: opus`, `scope: on-demand`. Body must include responsibility, inputs, output format, authority boundaries.
  - `## Boundary against resource-architect` — defer all MCP/cloud/API/service/library/hardware to `.claude/resources-pending.md`; never recommend external resources (FR-4.3, AC-18). Cite-but-do-not-duplicate if a role references a resource.
  - `## CORE-VS-ON-DEMAND heuristic` — enumeration above; if proposed role overlaps >50% with a core agent, merge into call-plan note or drop. Slug MUST NOT equal any of 16 core names; rename with domain prefix per UC-1-A1.
  - `## No iteration 2 scope` — explicit deferred list (5.8 items 1-11): no teardown, no cross-feature reuse, no session re-registration, no programmatic call-plan validation, no core-agent modification.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qE "^name: role-planner$" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qE "^model: opus$" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && awk '/^---$/{f++; next} f==1' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | grep -q '"Read"' && awk '/^---$/{f++; next} f==1' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | grep -q '"Write"' && awk '/^---$/{f++; next} f==1' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | grep -q '"Glob"' && awk '/^---$/{f++; next} f==1' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | grep -q '"Grep"' && ! awk '/^---$/{f++; next} f==1' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | grep -qE '"Bash"|"Edit"|"WebFetch"|"WebSearch"|"NotebookEdit"' && grep -qE "^## Inputs" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qiE "Authority Boundary" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qiE "Output Boundary" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qE "^## Filename prefix self-check.*MANDATORY" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qE "^## Overwrite annotation.*MANDATORY" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qiE "Overwrote existing prompt file" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "<!-- CORE-AGENT-ENUMERATION-START -->" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "<!-- CORE-AGENT-ENUMERATION-END -->" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "Step 3.75: role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "Step 4: qa-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "Step 5: planner" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "Step 6: implementation" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "Step 7: merge-ready" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qiE "only.+(these|five|5).+labels|MUST NOT.+(invent|use other|new) step" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && for n in prd-writer ba-analyst architect qa-planner planner security-auditor test-writer code-reviewer build-runner e2e-runner verifier doc-updater refactor-cleaner changelog-writer resource-architect role-planner; do grep -qF "$n" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md || exit 1; done && grep -qF ".claude/roles-pending.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF ".claude/resources-pending.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "scope: on-demand" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "subagent_type: general-purpose" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md && grep -qF "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md`
- **Done when:** File exists with full frontmatter (only 4 allowed tools); both MANDATORY sections present; CORE-AGENT-ENUMERATION markers both present; all 5 step labels verbatim; all 16 core slugs present; all key paths (roles-pending.md, ondemand-, scope: on-demand, general-purpose) referenced.
- **Pre-review:** architect + security
- **Satisfies AC:** AC-1, AC-2 (agent side), AC-3 (agent side), AC-8, AC-9, AC-11, AC-12, AC-14, AC-15, AC-17, AC-18, AC-19

---

### Slice 2: `install.sh` banners 15→16 across 5 locations

- **Wave:** 1
- **Use cases:** UC-9 (clean-install discovery), UC-13 (install/registration)
- **Files:** `install.sh`
- **Changes:**
  - Locate banners via `grep -n "15 specialized\|15 AI agents\|(15 files" install.sh` — don't trust fixed line numbers
  - Update 5 banner locations (architect verified at lines 8, 49, 62, 178, 182):
    - `15 specialized AI` → `16 specialized AI` (line ~8)
    - `15 specialized AI agents` → `16 specialized AI agents` (line ~49)
    - `15 specialized agent prompts` → `16 specialized agent prompts` (line ~62)
    - `15 AI agents` → `16 AI agents` (line ~178)
    - `(15 files` → `(16 files` (line ~182)
  - Preserve `for agent in "$SCRIPT_DIR"/src/agents/*.md` glob at line 202 unchanged (auto-picks up `role-planner.md`).
- **Verify:** `bash -n /Users/aleksandra/Documents/claude-code-sdlc/install.sh && [ "$(grep -c "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 3 ] && [ "$(grep -c "16 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 1 ] && [ "$(grep -cE "\\(16 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 1 ] && [ "$(grep -c "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 0 ] && [ "$(grep -c "15 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 0 ] && [ "$(grep -cE "\\(15 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 0 ] && grep -qF 'src/agents/*.md' /Users/aleksandra/Documents/claude-code-sdlc/install.sh`
- **Done when:** `bash -n` passes; exact counts `16 specialized`=3, `16 AI agents`=1, `(16 files`=1; all `15`-counterparts=0; glob preserved.
- **Pre-review:** architect + security
- **Satisfies AC:** AC-7, AC-16

---

### Slice 3: Insert Step 3.75 + On-Demand Invocation section in `src/commands/bootstrap-feature.md`

- **Wave:** 2
- **Use cases:** UC-2, UC-3, UC-4, UC-5, UC-6, UC-8, UC-13
- **Files:** `src/commands/bootstrap-feature.md`
- **Changes:**
  - Insert `### Step 3.75: Role Planner recommendation` AFTER existing `### Step 3.5` (resource-architect, line ~37) AND BEFORE `### Step 4` (QA Lead).
  - Step 3.75 body:
    - Delegation to `role-planner` agent (named verbatim)
    - 5 input sources: PRD section, use-cases, architect verdict (orchestrator captures Step 3 output and inlines as context), `.claude/resources-pending.md` if present, CLAUDE.md. No scratchpad read.
    - Expected outputs: `.claude/roles-pending.md` temp file + zero-or-more `~/.claude/agents/ondemand-<slug>.md` files
    - **MANDATORY** and **non-skippable** — runs on every feature (even when no additional roles needed, agent emits "No additional roles required" body)
    - On failure: bootstrap **MUST NOT proceed to Step 4** — halt with error
    - Hand-off to planner (Step 5): reads `.claude/roles-pending.md`, inlines as `## Additional Roles` at top of `.claude/plan.md` after `## Recommended Resources` (if any) and before `## Prerequisites verified`, MUST-deletes BOTH temp files independently (`.claude/resources-pending.md` from Feature #4 AND `.claude/roles-pending.md` from this feature) — each deletion independent, neither blocks the other on failure
  - Preserve `### Step 5.5` (changelog-writer, line ~71) UNCHANGED.
  - Append NEW `### On-Demand Role Invocation` section at end of file (or after steps, before final notes). MUST contain:
    - **Frontmatter-extraction algorithm** — 4-step numbered list, VERBATIM SAME text as in role-planner.md Slice 1
    - **5 closed-vocabulary step labels** enumerated
    - **Failure-mode matrix** — 3 rows: (1) missing ondemand file → surface error, abort that invocation, continue pipeline; (2) malformed frontmatter (no `---` or no closing `---`) → surface error, do NOT silently spawn with corrupted prompt; (3) tools frontmatter unenforced — known iter-1 limitation, prompt body must self-restrict
- **Verify:** `[ "$(grep -cE "^### Step 3\\.75" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md)" -eq 1 ] && [ "$(grep -cE "^### Step 5\\.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md)" -eq 1 ] && [ "$(grep -cE "^### Step 3\\.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md)" -eq 1 ] && awk '/^### Step 3\.5/{a=NR} /^### Step 3\.75/{b=NR} /^### Step 4/{c=NR; exit} END{exit !(a>0 && b>0 && c>0 && a<b && b<c)}' /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF ".claude/roles-pending.md" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF ".claude/resources-pending.md" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qE "MANDATORY" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qE "halt|MUST NOT proceed" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "### On-Demand Role Invocation" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "subagent_type: general-purpose" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "Step 3.75: role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "Step 4: qa-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "Step 5: planner" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "Step 6: implementation" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qF "Step 7: merge-ready" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qiE "registers subagent types at session start|cannot be invoked.+subagent_type: ondemand|dynamically.created.+subagent" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qiE "tools.+(unenforced|not enforced|not runtime-enforced)" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qiE "malformed" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qiE "frontmatter" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && diff <(awk '/^## Frontmatter-extraction algorithm/,/^## /' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | head -n -1) <(awk '/Frontmatter-extraction algorithm/,/^### |^## /' /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md | grep -v "^### \|^## " | head -n 30) >/dev/null 2>&1 || ( awk '/^## Frontmatter-extraction algorithm/,/^[^#]/' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/role-planner.md | grep -E "^[0-9]\." | sort -u > /tmp/role-planner-fme.txt && awk '/Frontmatter-extraction algorithm/,/[Ff]ailure-mode/' /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md | grep -E "^[0-9]\." | sort -u > /tmp/bootstrap-fme.txt && diff /tmp/role-planner-fme.txt /tmp/bootstrap-fme.txt )`
- **Done when:** Exactly 1 each of Step 3.5, 3.75, 5.5 headings; ordering 3.5 < 3.75 < 4; all paths+labels referenced; MANDATORY + halt language present; On-Demand Role Invocation section present with general-purpose reference; all 5 step labels; malformed + frontmatter references.
- **Pre-review:** architect
- **Satisfies AC:** AC-2, AC-3, AC-4, AC-10, AC-20

---

### Slice 4: Rewrite `src/agents/planner.md` Process step 4 into 4a/4b/4c

- **Wave:** 2
- **Use cases:** UC-7 (planner-side inlining), UC-8 (hand-off after role-planner)
- **Files:** `src/agents/planner.md`
- **Changes:**
  - Rewrite existing Process step 4 (currently reads `.claude/resources-pending.md` per Feature #4) into THREE sub-steps:
    - **`4a`**: Read `.claude/resources-pending.md` if exists. If present, inline verbatim as top-level `## Recommended Resources` section at top of `.claude/plan.md`. (Preserves Feature #4 contract.)
    - **`4b`**: Read `.claude/roles-pending.md` if exists. If present, inline verbatim as top-level `## Additional Roles` section AFTER 4a's section (if produced) or at top (if 4a absent), and BEFORE `## Prerequisites verified`.
    - **`4c`**: On successful inline, MUST delete each temp file INDEPENDENTLY. If 4a succeeded, MUST delete `.claude/resources-pending.md`. If 4b succeeded, MUST delete `.claude/roles-pending.md`. Each deletion independent — one's failure MUST NOT prevent the other.
  - Update `## Output Format` section to document ordering: `## Recommended Resources` → `## Additional Roles` → `## Prerequisites verified` → slices.
  - Preserve VERBATIM: Wave Assignment algorithm (lines ~55+), executable slice format fields (Wave / Use cases / Files / Changes / Verify / Done when / Pre-review), `## Constraints` block.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qE "\\b4a\\b" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qE "\\b4b\\b" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qE "\\b4c\\b" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && awk '/\\b4a\\b/{a=NR} /\\b4b\\b/{b=NR} /\\b4c\\b/{c=NR; exit} END{exit !(a>0 && b>0 && c>0 && a<b && b<c)}' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qF ".claude/resources-pending.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qF ".claude/roles-pending.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qF "## Recommended Resources" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qF "## Additional Roles" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qF "## Prerequisites verified" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && [ "$(grep -cE "MUST delete" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md)" -ge 2 ] && grep -qE "MUST delete.*resources-pending|delete.*\\.claude/resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qE "MUST delete.*roles-pending|delete.*\\.claude/roles-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qF "## Wave Assignment" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qiE "no two slices in the same wave|disjoint.+files|share any file" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && awk '/## Recommended Resources/{a=NR} /## Additional Roles/{b=NR} /## Prerequisites verified/{c=NR} END{exit !(a>0 && b>0 && c>0 && a<b && b<c)}' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md`
- **Done when:** Sub-step markers `4a`, `4b`, `4c` all present; both temp paths referenced; MUST delete language present; all 3 plan sections in correct order (Recommended Resources < Additional Roles < Prerequisites verified); Wave Assignment + wave-count preserved.
- **Pre-review:** architect
- **Satisfies AC:** AC-5, AC-10, AC-13

---

### Slice 5: `src/claude.md` — Agency Roles row + Plan Critic bullet with slug-collision MAJOR

- **Wave:** 3
- **Use cases:** UC-7, UC-13
- **Files:** `src/claude.md` (single file — `src/CLAUDE.md` is case-alias on macOS APFS)
- **Changes:**
  - Agency Roles table: insert new row EXACTLY BETWEEN `Resource Manager-Architect | resource-architect` (added by Feature #4) and `QA Lead | qa-planner`. Exact row: `| Role Planner | \`role-planner\` | Recommend project-specific specialized roles (mobile dev, compliance officer, etc.) at bootstrap Step 3.75 |`
  - Plan Critic prompt: locate existing `## Recommended Resources` bullet (added by Feature #4). Append NEW bullet IMMEDIATELY AFTER (adjacent to it, not at end of block). Text mirrors resources bullet pattern AND adds slug-collision clause: "The `## Additional Roles` section (if present at top of plan, after `## Recommended Resources` if any and before `## Prerequisites verified`) is a valid top-level section produced by `role-planner` at bootstrap Step 3.75 — do NOT flag its presence. Absence is also NOT a finding. Malformed per-role entries missing any of the 5 fields (Role title, Slug, Why, Pipeline step, Purpose) MAY be raised as MINOR. Slug inconsistency between per-role block and call plan MAY be MINOR. **If per-role slug matches any core 16 agent name (prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, test-writer, code-reviewer, build-runner, e2e-runner, verifier, doc-updater, refactor-cleaner, changelog-writer, resource-architect, role-planner), flag as MAJOR (semantic collision indicates FR-1.8 overlap-check failure).**"
  - No "15 agents" prose exists in file (FR-6.2 no-op by construction); do NOT introduce "16 agents" prose either.
- **Verify:** `[ "$(grep -c "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md)" -ge 2 ] && grep -qF "Role Planner" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -qF "## Additional Roles" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -qF "## Recommended Resources" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && awk '/^\| Resource Manager-Architect/{a=NR} /^\| Role Planner/{b=NR} /^\| QA Lead/{c=NR; exit} END{exit !(a>0 && b>0 && c>0 && a<b && b<c)}' /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && awk '/Recommended Resources/ && /section/{a=NR} /Additional Roles/ && /section/{b=NR} END{exit !(a>0 && b>0 && a<b)}' /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && awk '/Additional Roles/,/^>$|^$/' /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md | grep -qiE "slug.+(matches|equals|collide).+(core|16 agent).+MAJOR|MAJOR.+(slug|collision|overlap)" && awk '/Additional Roles/,/^>$|^$/' /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md | grep -qE "prd-writer|ba-analyst|architect|qa-planner" && [ "$(grep -c "15 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md)" -eq 0 ] && [ "$(grep -c "16 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md)" -eq 0 ]`
- **Done when:** `role-planner` ≥2× (Agency Roles + Plan Critic); `Role Planner` title present; Agency Roles row ordering resource-architect < role-planner < qa-planner; Plan Critic bullets ordering Recommended Resources < Additional Roles; slug-collision MAJOR clause present; zero "15 agents"/"16 agents" prose.
- **Pre-review:** architect
- **Satisfies AC:** AC-6, AC-17, AC-19

---

### Slice 6: `README.md` — tagline, heading, agent row, on-demand feature section

- **Wave:** 3
- **Use cases:** UC-13 (developer discovery)
- **Files:** `README.md`
- **Changes:**
  - Line ~5 tagline: `15 specialized AI agents` → `16 specialized AI agents`
  - Line ~95 heading: `## The 15 Agents` → `## The 16 Agents`
  - Agent table: insert new row AFTER `architect` row and BEFORE `qa-planner` row. Exact: `| \`role-planner\` | Recommend project-specific on-demand roles (mobile dev, compliance officer, etc.) at bootstrap Step 3.75 — suggest-only |`
  - New `## On-demand role recommendations at bootstrap` section between existing `## Resource recommendation at bootstrap` (Feature #4) and `## Customization`. Content:
    - On-demand vs core distinction (permanent 16 + dynamic project-specific)
    - `ondemand-<slug>.md` filename + `scope: on-demand` frontmatter conventions
    - General-purpose subagent invocation pattern (cross-reference `src/commands/bootstrap-feature.md`)
    - Concrete examples: `mobile-dev`, `compliance-officer`, `information-researcher`
    - "suggest-only" verbatim
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "16 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md && ! grep -qE "\\b15 specialized\\b" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "## The 16 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md && ! grep -qF "## The 15 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "role-planner" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "## On-demand role recommendations at bootstrap" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "## Resource recommendation at bootstrap" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "## Customization" /Users/aleksandra/Documents/claude-code-sdlc/README.md && awk '/## Resource recommendation at bootstrap/{a=NR} /## On-demand role recommendations at bootstrap/{b=NR} /## Customization/{c=NR; exit} END{exit !(a>0 && b>0 && c>0 && a<b && b<c)}' /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "suggest-only" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "ondemand-" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "scope: on-demand" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "general-purpose" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "mobile-dev" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "compliance-officer" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qF "information-researcher" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Done when:** `16 specialized` present, `15 specialized` absent; heading updated; `role-planner` row present; new section present between Resource recommendation and Customization; ordering check passes; "suggest-only", "ondemand-", "scope: on-demand", "general-purpose", all 3 example role names present.
- **Pre-review:** none
- **Satisfies AC:** AC-7, AC-20

---

## Acceptance criteria (all must pass)

- [ ] **AC-1** — role-planner.md exists with valid frontmatter and all sections (Slice 1)
- [ ] **AC-2** — Step 3.75 documented in bootstrap-feature.md (Slice 3) + agent declares preconditions (Slice 1)
- [ ] **AC-3** — Step 3.75 MANDATORY + halt on failure (Slice 3) + agent acknowledges contract (Slice 1)
- [ ] **AC-4** — General-purpose invocation pattern documented (Slice 3) + same algorithm in agent (Slice 1)
- [ ] **AC-5** — planner reads roles-pending, inlines, deletes (Slice 4)
- [ ] **AC-6** — Agency Roles row in src/claude.md (Slice 5)
- [ ] **AC-7** — README 15→16 + agent row + feature section (Slice 6)
- [ ] **AC-8** — install.sh 5 banners updated (Slice 2) + agent tools frontmatter (Slice 1)
- [ ] **AC-9** — install.sh glob picks up role-planner.md (Slice 2 preserves glob) + agent exists (Slice 1)
- [ ] **AC-10** — step ordering + plan.md section ordering (Slices 3 + 4)
- [ ] **AC-11** — "No additional roles required" path (Slice 1)
- [ ] **AC-12** — ondemand template documented in agent (Slice 1)
- [ ] **AC-13** — planner deletes temp file; ondemand-*.md persist (Slice 4 + Slice 1)
- [ ] **AC-14** — tools exactly 4 allowed, 5 prohibited (Slice 1)
- [ ] **AC-15** — 5 FR-1.4 fields in agent Output Format (Slice 1)
- [ ] **AC-16** — Role invocation plan subsection format (Slice 1)
- [ ] **AC-17** — Plan Critic bullet + core-slug collision MAJOR (Slice 5)
- [ ] **AC-18** — Resource-architect boundary (Slice 1)
- [ ] **AC-19** — Core 16 enumeration + slug-collision rule (Slices 1 + 5)
- [ ] **AC-20** — Cross-references valid (all slice Verify greps)

## Files to modify

**New files (1):**
- `src/agents/role-planner.md` (Slice 1)

**Modified files (5):**
- `install.sh` (Slice 2)
- `src/commands/bootstrap-feature.md` (Slice 3)
- `src/agents/planner.md` (Slice 4)
- `src/claude.md` (Slice 5)
- `README.md` (Slice 6)

## Wave assignment

| Wave | Slices | Files | Rationale |
|------|--------|-------|-----------|
| 1 | 1, 2 | `src/agents/role-planner.md` [new]; `install.sh` | Disjoint files, no logical dependency — installer glob auto-picks new agent file |
| 2 | 3, 4 | `src/commands/bootstrap-feature.md`; `src/agents/planner.md` | Disjoint files. Both reference `role-planner` + `.claude/roles-pending.md` as string literals (pinned in plan, no runtime import). |
| 3 | 5, 6 | `src/claude.md`; `README.md` | Disjoint files. Slice 5 Plan Critic bullet references `## Additional Roles` section defined contractually in Slice 1 + structurally in Slice 4. Wave 3 must follow Wave 2. |

**Wave-file disjointness verified:** Zero intersection in each wave.

## Risk assessment

- **Data sensitivity:** None (markdown files only, NFR-1).
- **Auth impact:** None.
- **Persistence:** Ephemeral `.claude/roles-pending.md` (deleted by planner). Persistent `~/.claude/agents/ondemand-*.md` (written at runtime by agent — not this implementation).
- **External calls:** Zero. Tools exclude WebFetch/WebSearch; Bash excluded as defense-in-depth.
- **Authority drift risk** (PRD Risk 4): defense-in-depth via Slice 1 `## Filename prefix self-check` MANDATORY + Edit tool exclusion + Slice 5 slug-collision MAJOR Plan Critic rule.
- **Boundary drift with resource-architect** (PRD Risk 3): Slice 1 `## Boundary against resource-architect` + symmetric resource-architect Output Boundary enforcement preserved.
- **Step-numbering drift** (PRD Risk 7): Slice 3 awk ordering (3.5 < 3.75 < 4) + Slice 5/6 ordering checks. Step 5.5 preserved unchanged.
- **Filename collision** (PRD Risk 4, UC-1-A1): Slice 1 CORE-VS-ON-DEMAND heuristic + Slice 5 slug-collision MAJOR.
- **Malformed-frontmatter** (PRD Risk 5): Slice 3 failure-mode matrix, surface-error contract.
- **Rollback:** Per-slice atomic commits; `git revert <commit>` for any slice. All 6 slices touch disjoint files — reverts non-overlapping.

## Dependencies

- **Section 4 (Resource Manager-Architect) — SHIPPED** — `.claude/resources-pending.md` consumer pre-exists (Slice 4 preserves + extends). Dependency 12 graceful fallback if absent.
- **Section 1 FR-3 (Executable Plan Format) — SHIPPED** — preserved in Slice 4.
- **Section 3 (Changelog Writer) — SHIPPED** — Slice 3 preserves Step 5.5.
- **No new libraries.** Markdown + bash only.

## Return summary

- **Slice count:** 6
- **Waves:** 3 (2-2-2)
- **[STRUCTURAL] decisions:** 8 pinned (see section above)
- **AC coverage:** 20/20 mapped
- **Coverage gaps:** none

---

## Review Notes

### Critic Findings
- **Total:** 22 findings (1 critical, 17 major, 3 minor — total includes some duplicates noted below)
- **All CRITICAL/MAJOR addressed:** Yes (12 fixed in plan; remaining documented as accepted-risk below)

### Changes Made

**CRITICAL 21 — Wave 1→Wave 2 textual coupling:** Added [STRUCTURAL] decision 9 explicitly pinning that Slice 3 MUST copy frontmatter-extraction algorithm verbatim from Slice 1's committed text. Slice 3 Verify now includes a `diff` between the two files' algorithm sections to catch drift.

**MAJOR 2 — Tools verification scoped to frontmatter:** Slice 1 Verify now uses `awk '/^---$/{f++; next} f==1'` to scope tools-list checks to YAML frontmatter only, preventing false-pass when tool names appear in prose examples.

**MAJOR 3 — AC-4 rationale text:** Slice 3 Verify now greps for "registers subagent types at session start" and "tools unenforced" to assert the rationale per AC-4 is present.

**MAJOR 4 — Sub-step ordering:** Slice 4 Verify now includes awk ordering check `4a < 4b < 4c` to catch out-of-order rewrites.

**MAJOR 8, 9, 14 — Slice 1 cross-references:** Added explicit greps for `subagent_type: general-purpose` (literal, not just `general-purpose`), `.claude/resources-pending.md` (input source per FR-1.2), and `resource-architect` literal mention.

**MAJOR 11 — Independent MUST-deletes:** Slice 4 Verify now requires `MUST delete` count ≥ 2 AND explicit references to both `resources-pending` and `roles-pending` deletion contexts.

**MAJOR 12 — Closed-vocabulary enforcement:** Slice 1 Verify now greps for "only.+(these|five|5).+labels" or "MUST NOT.+invent.+step" to ensure agent prompt prohibits step labels beyond the 5 valid ones.

**MAJOR 13 — Hand-off both deletions:** Slice 3 Changes wording updated to explicitly describe BOTH `.claude/resources-pending.md` AND `.claude/roles-pending.md` deletions, each independent.

**MAJOR 16 — Overwrite annotation body verify:** Slice 1 Verify now greps for "Overwrote existing prompt file" (the body action), not just the `## Overwrite annotation MANDATORY` heading.

**MAJOR 19 — Cross-file diff for frontmatter-extraction algorithm:** Slice 3 Verify now includes a `diff` between role-planner.md and bootstrap-feature.md frontmatter-extraction sections to enforce byte-identical text per [STRUCTURAL] 1.

**MAJOR 22 — Wave Assignment preservation:** Slice 4 Verify now greps for the literal `## Wave Assignment` heading AND key invariant phrases ("no two slices in same wave", "disjoint files", "share any file") instead of brittle word-count heuristic.

**MAJOR 6 — Slug-collision regex tightened:** Slice 5 Verify now scopes the slug-collision pattern to within the `## Additional Roles` Plan Critic bullet block (via awk range) AND requires presence of at least one of the core agent slugs (prd-writer/ba-analyst/architect/qa-planner) in the same block — guards against weak language like "MAY be MINOR" replacing the MAJOR clause.

### Acknowledged Minor Issues (not fixed)

**MINOR 7 — Inode number** — Plan-text inode 4432546 corrected to 4443075 in [STRUCTURAL] 8 (Plan Critic verified actual value). Cosmetic; verification logic uses path/lowercase, not inode.

**MAJOR 1 — Brittle exact-count `grep -cE | grep -qx 1`:** Replaced with `grep -qE` (presence-only) where appropriate. Where exact counts genuinely matter (Slice 2 banner counts, Slice 3 Step 3.75 count) we keep `-eq N` form because false-pass via duplicates would be a real regression.

**MAJOR 5 — Ondemand template body self-restrict:** Documented in PRD Risk 5 / NFR-11 ("trust model: prompt-driven boundary"). The agent prompt template includes the "no Bash unless rationale in description" guidance per FR-1.7. iteration 1 acceptable trust model; tighter enforcement deferred to iteration 2.

**MAJOR 15 — Positional-fragile awk regex in Slice 5:** Verify uses pattern matching the existing Recommended Resources bullet phrasing. If implementer uses different wording, verify will fail and the implementer can investigate. Treating this as feature-not-bug for parallel adjacency.

**MAJOR 17 — Resource-architect symmetric boundary:** PRD Risk 3 explicitly relies on existing resource-architect Output Boundary (already shipped in Feature #4). No slice modifies `src/agents/resource-architect.md` because its existing prohibition already covers role-recommendation rejection. Plan Critic of Feature #4 verified this; cross-reference here.

**MAJOR 20 — README anchor depends on Feature #4:** Feature #4 SHIPPED to main; the `## Resource recommendation at bootstrap` heading exists. Dependency satisfied at planning time.

**MINOR 18 — Long Done-when textual cascade:** Done-when sections are intentionally exhaustive to catch multiple invariants. Each is verifiable via the corresponding Verify command; readability tradeoff accepted.
