# Implementation Plan: Resource Manager-Architect — Iteration 1 (Mandatory Pipeline Role)

## Prerequisites verified

- **PRD section:** `docs/PRD.md` — Section 4 (lines 562-803); 42 FRs, 9 NFRs, 15 ACs
- **Use cases:** `docs/use-cases/resource-architect_use_cases.md` — 31 scenarios across 12 primary UCs
- **QA test cases:** `docs/qa/resource-architect_test_cases.md` — 103 TCs across 13 categories
- **Architecture review:** PASS with 5 [STRUCTURAL] authorizations (agent file boundaries, output-format pinning, MUST deletion, verdict forwarding, mirror commit)

## Deliverables checklist

- [x] PRD section in `docs/PRD.md` (Section 4, lines 562-803)
- [x] Use cases in `docs/use-cases/resource-architect_use_cases.md` (31 scenarios)
- [x] Architecture review verdict (PASS with 5 [STRUCTURAL] items)
- [x] QA test cases in `docs/qa/resource-architect_test_cases.md` (103 test cases)
- [ ] Implementation slices (this document, below)

## Feature scope

Add the `resource-architect` agent as a mandatory pipeline role executed at Step 3.5 of `/bootstrap-feature`. The agent writes `.claude/resources-pending.md` with structured resource recommendations across six categories; the planner inlines and deletes that temp file into `.claude/plan.md` as a top-level `## Recommended Resources` section. The global agent count rises from 14 to 15.

## [STRUCTURAL] decisions pinned by Tech Lead

1. **Agent name:** `resource-architect` (kebab-case, matches `prd-writer`/`changelog-writer` pattern); role title "Resource Manager-Architect"
2. **Output format canonicalized:** `## Recommended Resources` (top-level) → summary line → six `### <Category>` subheadings in fixed order (MCP → Cloud/Compute → External API → Third-party Service → Library/Framework → Hardware) → each resource as `#### <Name>` with five bullet fields: `- **Category:**`, `- **Why:**`, `- **Install/activate:**`, `- **Cost/complexity:**`, `- **Reversibility:**`. Empty categories show literal `(none)` on its own line
3. **Temp file deletion:** MANDATORY — `src/agents/planner.md` uses "MUST delete" wording, never "may" or "should"
4. **Verdict forwarding:** Step 3.5 body of `src/commands/bootstrap-feature.md` explicitly states "the architect's PASS verdict text from Step 3 is inlined into the `resource-architect` spawn prompt as context"
5. **No "mirror" — single physical file:** verified via `ls -lai` that `src/claude.md` and `src/CLAUDE.md` share **inode 4432546** on this macOS APFS case-insensitive filesystem; `git ls-files src/` tracks only `src/claude.md`. They are the SAME file, not a mirror pair. The architect's [STRUCTURAL] #5 "mirror invariant" is trivially satisfied because there's nothing to mirror. Slice 5 edits ONLY `src/claude.md` — editing via the uppercase path would write to the same inode.

---

## Implementation plan (6 slices)

### Slice 1: Create `resource-architect` agent file

- **Wave:** 1
- **Use cases:** UC-1, UC-1-A1, UC-2, UC-3, UC-4, UC-6, UC-7, UC-9, UC-9-EC1
- **Files:** `src/agents/resource-architect.md` [new]
- **Changes:**
  - YAML frontmatter: `name: resource-architect`, `description:` (single sentence), `tools: ["Read", "Write", "Glob", "Grep"]` (exactly four, NO `Bash`/`Edit`/`WebFetch`/`WebSearch`/`NotebookEdit`), `model: opus`
  - `## Inputs (fixed read order)` section enumerating: (1) `docs/PRD.md` current feature section, (2) `docs/use-cases/<feature>_use_cases.md`, (3) architect's PASS verdict (passed as context by bootstrap command at Step 3.5), (4) project `CLAUDE.md`. Explicitly state "MUST NOT read `.claude/scratchpad.md`"
  - `## Authority Boundary` section enumerating prohibitions per FR-5.1 through FR-5.6: no `~/.claude/settings.json` modification; no `claude mcp add`/`remove`; no touching `.env`/`.envrc`/`~/.aws/credentials`/`~/.config/gcloud/`/secrets; no package-manager commands (enumerate ≥6: `npm install`, `pnpm add`, `yarn add`, `pip install`, `poetry add`, `brew install`); no network calls. Include sentence "All inputs are local files"
  - `## Output Boundary` section (architect [STRUCTURAL] #1): MUST NOT recommend new agents, Agency Roles modifications, new pipeline steps, or `role-planner`-like outputs. Cite UC-9 scope discipline
  - `## Read-only settings probe` subsection: best-effort read of `~/.claude/settings.json` to detect already-installed MCPs (UC-1-A1); falls back gracefully if absent/unreadable/malformed
  - `## Output Format` section (architect [STRUCTURAL] #2): (a) first line `## Recommended Resources`; (b) summary line `N recommendations total; X expensive; Y hard reversibility`; (c) six `### <Category>` subheadings in fixed order; (d) each resource as `#### <Name>` with 5 bulleted fields with bold labels; (e) empty categories → `(none)` on its own line; (f) no frontmatter, no meta-commentary
  - `## No-resources case` subsection: when no external resources needed, emit explicit `No external resources required` body AND still render all six `###` headings each with `(none)` (FR-1.5, FR-1.7)
  - `## Write contract` subsection: exactly one write to `.claude/resources-pending.md` in project CWD; overwrites pre-existing without prompting; MUST NOT write to `.claude/plan.md`, `docs/PRD.md`, `~/.claude/settings.json`, `.env`, or any other path
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && grep -cE "^name: resource-architect$" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md | grep -q "^1$" && grep -cE "^model: opus$" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md | grep -q "^1$" && grep -q '"Read"' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && grep -q '"Write"' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && grep -q '"Glob"' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && grep -q '"Grep"' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && ! grep -qE '"Bash"|"Edit"|"WebFetch"|"WebSearch"|"NotebookEdit"' /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && grep -qi "authority.?boundary" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && grep -qi "output.?boundary" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md && [ "$(grep -cE "npm install|pnpm add|yarn add|pip install|poetry add|brew install" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md)" -ge 6 ] && [ "$(grep -cE "^### (MCP|Cloud/Compute|External API|Third-party Service|Library/Framework|Hardware)" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md)" -ge 6 ] && [ "$(grep -cE "\\*\\*Category:\\*\\*|\\*\\*Why:\\*\\*|\\*\\*Install/activate:\\*\\*|\\*\\*Cost/complexity:\\*\\*|\\*\\*Reversibility:\\*\\*" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/resource-architect.md)" -ge 5 ]`
- **Done when:** Agent file exists with frontmatter (name, description, `tools: ["Read","Write","Glob","Grep"]` only, model: opus); zero matches for Bash/Edit/Web/Notebook tools; Authority Boundary + Output Boundary sections present; ≥6 package-manager prohibition patterns; all 6 category headings referenced; all 5 field labels present.
- **Pre-review:** architect + security
- **Satisfies AC:** AC-1, AC-10, AC-12, AC-13, AC-15

---

### Slice 2: `install.sh` — banner strings 14 → 15 in all 5 locations

- **Wave:** 1
- **Use cases:** UC-1 (precondition: agent installed by default path)
- **Files:** `install.sh`
- **Changes:**
  - Note to implementer: use `grep -n "14 specialized\|14 AI agents\|(14 files" install.sh` to locate banners, don't trust fixed line numbers if they've drifted post-Feature-#1 merge
  - Around line 8: `14 specialized AI` → `15 specialized AI`
  - Around line 49: `14 specialized AI agents` → `15 specialized AI agents`
  - Around line 62: `14 specialized agent prompts` → `15 specialized agent prompts`
  - Around line 178: `14 AI agents` → `15 AI agents`
  - Around line 182: `(14 files` → `(15 files`
  - Preserve all other content — `for agent in "$SCRIPT_DIR"/src/agents/*.md` glob at line 202 already picks up the new agent file automatically
- **Verify:** `bash -n /Users/aleksandra/Documents/claude-code-sdlc/install.sh && ! grep -q "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && [ "$(grep -c "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 3 ] && ! grep -q "14 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && [ "$(grep -c "15 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 1 ] && ! grep -qE "\\(14 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && [ "$(grep -cE "\\(15 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh)" -eq 1 ]`
- **Done when:** `bash -n` passes; zero stale "14 specialized"/"14 AI agents"/"(14 files" occurrences; new "15 specialized"/"15 AI agents"/"(15 files" strings all present.
- **Pre-review:** architect + security (trust boundary, banner-only changes per NFR-1)
- **Satisfies AC:** AC-7, AC-8

---

### Slice 3: `src/commands/bootstrap-feature.md` — insert Step 3.5

- **Wave:** 2
- **Use cases:** UC-1, UC-1-E1 (halt on agent failure), UC-4 (mandatory non-skippable), UC-5 (hand-off to planner)
- **Files:** `src/commands/bootstrap-feature.md`
- **Changes:**
  - Insert `### Step 3.5: Resource Manager-Architect recommendation` AFTER the `#### If Architecture Review FAILS:` subsection of Step 3 (which ends around line 35) and BEFORE `### Step 4: QA Lead — Test Case Documentation` (line ~37). Do NOT insert between the main Step 3 body and its FAILS subsection — Step 3's failure-handling must remain attached to its main body. Do NOT renumber subsequent steps — half-step preserves all cross-references.
  - Body content:
    - Delegate to `resource-architect` agent (exact match for agent name frontmatter)
    - Agent reads: (a) PRD section just written at Step 2, (b) use-cases file, (c) architect's PASS verdict text from Step 3 — **the orchestrator captures this text and inlines it into the `resource-architect` spawn prompt as context** (architect [STRUCTURAL] #4), (d) project CLAUDE.md. Explicitly state the agent does NOT read `.claude/scratchpad.md`
    - Expected output: `.claude/resources-pending.md` in project CWD
    - **MANDATORY + non-skippable** — runs on every feature regardless of whether resources are needed; no-resources features produce explicit `No external resources required` output, not a skip
    - **On failure:** `/bootstrap-feature` MUST report failure and MUST NOT proceed to Step 4. Bootstrap halts at Step 3.5.
    - Hand-off to planner at Step 5: planner reads `.claude/resources-pending.md`, inlines as `## Recommended Resources` at top of `.claude/plan.md` before `## Prerequisites verified`, deletes temp file
  - Preserve existing Step 5.5 (changelog-writer from Feature #1) untouched
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -cE "^### Step 3\\.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md | grep -q "^1$" && grep -q "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qE "architect.+verdict|PASS verdict.+context|verdict.+spawn" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -q "\\.claude/resources-pending\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qiE "mandatory|non.?skippable" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -qiE "halt|MUST NOT proceed|not proceed to Step 4" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -cE "^### Step 5\\.5" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md | grep -q "^1$"`
- **Done when:** Exactly 1 `### Step 3.5` heading exists; references `resource-architect`, verdict-forwarding language, temp-file path, MANDATORY/non-skippable wording, halt-on-failure instruction; existing `### Step 5.5` (changelog-writer) remains intact.
- **Pre-review:** architect
- **Satisfies AC:** AC-2, AC-3, AC-9

---

### Slice 4: `src/agents/planner.md` — read/inline/delete temp file

- **Wave:** 2
- **Use cases:** UC-5, UC-5-A1 (silent skip when absent), UC-5-E1 (crash between inline and delete), UC-5-EC1 (malformed content verbatim), UC-11
- **Files:** `src/agents/planner.md`
- **Changes:**
  - Add a new step (or expand existing Step 1) in `## Process`: "Read `.claude/resources-pending.md` if it exists. If present, capture full content verbatim (preserve bullets, code fences, indentation, line breaks). Inline as first top-level section of `.claude/plan.md`, placed immediately before `## Prerequisites verified`. After successful inlining, you **MUST delete** `.claude/resources-pending.md`. If the file does not exist, skip silently — no error, no warning, no `## Recommended Resources` section added."
  - MANDATORY deletion language per architect [STRUCTURAL] #3 — use "MUST delete", never "may", "should", or "optional"
  - Extend `## Output Format` with note: when `.claude/resources-pending.md` was inlined, `## Recommended Resources` appears as top-level heading above `## Prerequisites verified`
  - Do NOT alter: slice breakdown rules (5-9 slices), executable format (`Files:`/`Changes:`/`Verify:`/`Done when:`/`Wave:`/`Use cases:`/`Pre-review:`), wave assignment algorithm, `## Constraints` block — preserve verbatim
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && [ "$(grep -cE "\\.claude/resources-pending\\.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md)" -ge 2 ] && grep -qiE "MUST delete" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && ! grep -qiE "may delete|might delete|should delete.*resources-pending" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qiE "before.+Prerequisites verified|first top-level section|top of .claude/plan.md" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && grep -qiE "silent|skip.+silently|file.+does not exist" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md && [ "$(grep -cE "Wave|wave" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/planner.md)" -ge 6 ]`
- **Done when:** Temp-file path referenced ≥2 times (read + delete contexts); MUST-level deletion present; no permissive "may/should" softening about resources-pending; "before Prerequisites verified" placement documented; silent-skip on absence documented; wave algorithm preserved.
- **Pre-review:** architect (planner is most-referenced agent — must not disturb executable-plan format or wave algorithm)
- **Satisfies AC:** AC-4, AC-11

---

### Slice 5: `src/claude.md` — Agency Roles row + Plan Critic recognition

- **Wave:** 3
- **Use cases:** UC-1, UC-11, UC-11-A1 (absence not flagged), UC-11-EC1 (malformed MAY be MINOR)
- **Files:** `src/claude.md` (single file — `src/CLAUDE.md` is a case-alias to the same inode on macOS APFS; editing either path writes to the same file; verified by `ls -lai` inode match and `git ls-files` tracking only lowercase)
- **Changes:**
  - Agency Roles table: insert new row between `Software Architect | architect` and `QA Lead | qa-planner`. Exact row: `| Resource Manager-Architect | \`resource-architect\` | Recommend external resources (MCP, cloud, APIs, services, libraries, hardware) at bootstrap time |`
  - Plan Critic prompt update: inside `> **Completeness:**` block, append a new bullet: `> - The \`## Recommended Resources\` section (if present at the top of the plan, before \`## Prerequisites verified\`) is a valid top-level section produced by \`resource-architect\` at bootstrap Step 3.5 — do NOT flag its presence as a finding. Absence is also NOT a finding (legacy plans lack it per backward compat). Malformed recommendation entries missing any of the six fields (Category, Name, Why, Install/activate, Cost/complexity, Reversibility) MAY be raised as MINOR — not CRITICAL, not MAJOR.`
  - Do NOT modify any other content.
  - **PRD FR-6.2 no-op note:** PRD requires updating "14 agents" prose to "15 agents" in `src/claude.md`. Grep shows zero matches for "14 agents" as prose (only the Agency Roles table mentions individual agent names, not a count). The requirement is satisfied by construction — the no-op is documented here so the merge-ready AC-5 reviewer sees it intentionally.
- **Verify:** `[ "$(grep -c "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md)" -ge 2 ] && grep -q "Resource Manager-Architect" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -q "Recommended Resources" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && [ "$(grep -c "14 agents" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md)" = "0" ] && grep -n "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md | head -1 | awk -F: '{print $1}' | xargs -I{} sh -c 'arch_line=$(grep -n "| Software Architect" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md | head -1 | cut -d: -f1); qa_line=$(grep -n "| QA Lead" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md | head -1 | cut -d: -f1); [ "$arch_line" -lt "{}" ] && [ "{}" -lt "$qa_line" ]'`
- **Done when:** `src/claude.md` contains `resource-architect` ≥2× (Agency Roles row + Plan Critic bullet); `Resource Manager-Architect` ≥1× (role title); `Recommended Resources` ≥1× (Plan Critic bullet); `14 agents` zero matches (FR-6.2 no-op contract); new Agency Roles row appears AFTER `| Software Architect` line AND BEFORE `| QA Lead` line (ordering invariant).
- **Pre-review:** architect
- **Satisfies AC:** AC-5, AC-14

---

### Slice 6: `README.md` — tagline, heading, agent row, feature paragraph

- **Wave:** 3
- **Use cases:** UC-1 (README reflects agent inventory)
- **Files:** `README.md`
- **Changes:**
  - Use `grep -n "14" README.md` to locate banners defensively — don't trust line numbers
  - Line 5 tagline: `14 specialized AI agents. Documentation-first...` → `15 specialized AI agents. Documentation-first...`
  - Line 95 heading: `## The 14 Agents` → `## The 15 Agents`
  - Agent table: insert new row after `architect` row (around line 101) before `qa-planner`. Exact: `| \`resource-architect\` | Recommends external resources (MCP, cloud, APIs, services, libraries, hardware) at bootstrap Step 3.5 — suggest-only, no installs |`
  - New section `## Resource recommendation at bootstrap` between `## Automated CHANGELOG for downstream projects` and `## Customization`. Body: 3-5 sentences covering the 6 categories, suggest-only boundary (no installs, no `claude mcp add`, no network), Step 3.5 pipeline position. Include phrase "suggest-only" verbatim.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/README.md && ! grep -q "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -q "15 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md && ! grep -q "The 14 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -q "The 15 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -q "resource-architect" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -q "suggest-only" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Done when:** No stale "14 specialized" or "The 14 Agents"; present: "15 specialized", "The 15 Agents", `resource-architect` row, "suggest-only" or "no install" phrase in feature section.
- **Pre-review:** none
- **Satisfies AC:** AC-6

---

## Acceptance criteria (all must pass)

- [ ] **AC-1** — resource-architect.md exists with valid frontmatter and Authority/Output Boundary prose (Slice 1)
- [ ] **AC-2** — bootstrap-feature.md contains Step 3.5 with delegation to resource-architect (Slice 3)
- [ ] **AC-3** — Step 3.5 marked mandatory + halt on failure (Slice 3)
- [ ] **AC-4** — planner reads, inlines, MUST-deletes temp file (Slice 4)
- [ ] **AC-5** — src/claude.md + src/CLAUDE.md both have resource-architect row in Agency Roles (Slice 5)
- [ ] **AC-6** — README has 15 tagline, 15 Agents heading, agent row, feature section (Slice 6)
- [ ] **AC-7** — install.sh 5 banners updated 14→15 (Slice 2)
- [ ] **AC-8** — install.sh glob picks up agent file (Slice 2 — no logic change needed)
- [ ] **AC-9** — End-to-end: /bootstrap-feature with Step 3.5 produces .claude/plan.md with `## Recommended Resources` at top and temp file deleted (Slices 1, 3, 4)
- [ ] **AC-10** — No-resources features still render all 6 `(none)` categories (Slice 1)
- [ ] **AC-11** — Temp file deleted after bootstrap completes (Slice 4)
- [ ] **AC-12** — Bash/Edit/Web/Notebook excluded from agent tools (Slice 1)
- [ ] **AC-13** — Six-field format per resource (Slice 1)
- [ ] **AC-14** — Plan Critic recognizes `## Recommended Resources` as valid (Slice 5)
- [ ] **AC-15** — Cross-references valid: agent name in frontmatter matches all caller references (Slices 1, 3, 4, 5)

## Files to modify

**New files (1):**
- `src/agents/resource-architect.md` (Slice 1)

**Modified files (5):**
- `install.sh` (Slice 2)
- `src/commands/bootstrap-feature.md` (Slice 3)
- `src/agents/planner.md` (Slice 4)
- `src/claude.md` (Slice 5) — note: `src/CLAUDE.md` is a case-alias to the same inode; editing either path modifies this single file
- `README.md` (Slice 6)

## Wave assignment

| Wave | Slices | Files | Rationale |
|------|--------|-------|-----------|
| 1    | 1, 2   | `src/agents/resource-architect.md` [new] ; `install.sh` | Disjoint files. No logical dep: installer glob auto-picks new agent file, no logic change needed. |
| 2    | 3, 4   | `src/commands/bootstrap-feature.md` ; `src/agents/planner.md` | Disjoint files. Both reference `resource-architect` (created by Slice 1) as string literal. |
| 3    | 5, 6   | `src/claude.md` ; `README.md` | Disjoint files. Slice 5 touches single file `src/claude.md` (the `src/CLAUDE.md` case-alias resolves to same inode 4432546 per verified `ls -lai` — architect's mirror-invariant is phantom on this case-insensitive filesystem and trivially satisfied). |

## Risk assessment

- **Data sensitivity:** None — markdown prompts + shell banners only (NFR-1)
- **Auth impact:** None
- **Persistence:** `.claude/resources-pending.md` is ephemeral per-bootstrap, deleted by planner
- **External calls:** Zero (FR-5.6 no-network prohibition)
- **Installer trust boundary:** Slice 2 banner-only edits; architect+security pre-review
- **Agent prompt drift:** Tool exclusion in frontmatter is defense-in-depth — Bash absent means agent cannot shell out even if prompt drifts
- **Mirror drift:** NON-APPLICABLE — `src/claude.md` and `src/CLAUDE.md` share inode 4432546 on macOS APFS case-insensitive filesystem; they are ONE file. Plan Critic CRITICAL finding 1 forced this reclassification. If the repo is ever cloned to a case-sensitive filesystem (Linux, or macOS case-sensitive APFS), the two paths would become distinct and a separate migration would be needed — out of scope for iteration 1.
- **Agent count propagation:** 7 locations (5 install.sh + 2 README). `src/claude.md` has NO "14 agents" prose — the FR-6.2 requirement is a no-op by construction (Agency Roles table lists individual agent names, not a count)
- **Backward compat:** Legacy plans lack `## Recommended Resources` — absence NOT flagged per FR-6.7 and Slice 5 Plan Critic bullet
- **Step 3.5 co-existence with Step 5.5:** Slice 3 Verify explicitly checks existing Step 5.5 (changelog-writer) remains intact
- **Case-sensitivity:** Verified — on THIS macOS APFS case-insensitive filesystem, `src/claude.md` and `src/CLAUDE.md` are the SAME file (inode 4432546). `git ls-files src/` tracks only `src/claude.md`. Slice 5 edits the single tracked file; the uppercase-path reference in documentation is a case-alias, not a separate blob.
- **Rollback:** per-slice atomic commits allow `git revert <commit>` for any slice; all 6 slices touch disjoint files (no slice touches multiple distinct files).

## Dependencies

- **External libraries/services:** None
- **Upstream PRD sections:** Section 1 FR-3 (Executable Plan Format) — SHIPPED; Section 3 (Changelog-Writer) — SHIPPED; this feature is independent of Section 2 (Wave Orchestration)
- **Tooling for Verify:** `grep`, `awk`, `diff`, `bash -n`, `test`, standard POSIX

---

## Return summary

- **Slice count:** 6 (within architect's 6-7 recommended range)
- **Wave assignments:** 3 waves — Wave 1 (new agent + installer), Wave 2 (pipeline hooks), Wave 3 (docs/registration)
- **Structural decisions pinned:** 5 (agent name, output format, MUST-delete wording, verdict forwarding, mirror single-commit)
- **Coverage:** AC 15/15, UC 31/31, TC 103/103 addressed by slice Verify commands or runtime E2E
- **Zero coverage gaps**

---

## Review Notes

### Critic Findings
- **Total:** 10 findings (1 critical, 5 major, 4 minor)
- **All CRITICAL/MAJOR addressed:** Yes

### Changes Made

**CRITICAL 1 — `src/claude.md` and `src/CLAUDE.md` are the same file:** Verified via `ls -lai` (inode 4432546 shared) and `git ls-files src/` (only lowercase tracked). Collapsed Slice 5 to edit only `src/claude.md`; removed dual-file diff Verify; removed architect's "mirror invariant" constraint (trivially satisfied on this filesystem); updated risk assessment, files table, wave assignment rationale, and pinned decision #5.

**MAJOR 2 — AC-5 traceability for FR-6.2 no-op:** Added explicit note in Slice 5 Changes: "PRD requires updating '14 agents' prose in `src/claude.md`. Grep shows zero matches — the requirement is satisfied by construction (the file has no prose agent count; Agency Roles table lists names, not counts). The no-op is documented here so the merge-ready AC-5 reviewer sees it intentionally."

**MAJOR 3 — Slice 6 Verify was permissive with alternation:** Changed `grep -qi "suggest-only\|no install"` to `grep -q "suggest-only"` — the Changes field mandates "suggest-only verbatim"; the Verify now enforces it strictly.

**MAJOR 4 — Slice 5 diff check is useless:** Dropped the `diff <(awk ... src/claude.md) <(awk ... src/CLAUDE.md)` verification (would have compared same bytes against themselves). Replaced with ordering check: new row appears AFTER `| Software Architect` line AND BEFORE `| QA Lead` line in `src/claude.md`.

**MAJOR 5 — Slice 3 insertion point ambiguity:** Clarified the Changes to specify insertion AFTER the `#### If Architecture Review FAILS:` subsection of Step 3 (which ends around line 35) and BEFORE `### Step 4`. Added explicit warning not to split Step 3's FAILS subsection from its main body.

### Minor Fixes Applied

- **MINOR 6 (Slice 2 Verify tightness):** Changed ≥2 match floors to exact `-eq 3`/`-eq 1`/`-eq 1` counts for the three banner-flavor groups — catches if any single edit was missed.
- **MINOR 7 (Slice 4 Wave preservation):** Raised Wave-count floor from ≥3 to ≥6 to better detect accidental deletions of wave-algorithm content in `src/agents/planner.md`.

### Acknowledged Minor Issues (not fixed)

- **MINOR 8 (Deliverables checklist):** The Implementation Slices line is legitimately `[ ]` unchecked — slices are not yet implemented. This is the correct state of a pre-implementation plan. No change.
- **MINOR 9 (Slice 1 Verify debuggability):** The ~900-char single-line Verify is dense but correct. Implementer can break it into separate commands if a failure occurs, identifying the failing assertion. Not worth expanding the plan for.
- **MINOR 10 (TC cross-references in slices):** 103 TCs are mapped in aggregate via "AC/UC/TC mapping completeness" section and slice-to-AC references. Explicit per-slice TC lists would bloat the plan without adding correctness — QA file already has the full coverage matrix. No change.
