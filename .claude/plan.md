# Implementation Plan: Changelog Release Packaging (iter-2 of #3)

## Prerequisites verified

- **PRD:** `docs/PRD.md` §6 (lines 1095-1470)
- **Use cases:** `docs/use-cases/changelog-release-packaging_use_cases.md` (35 scenarios across 16 UCs)
- **QA test cases:** `docs/qa/changelog-release-packaging_test_cases.md` (139 TCs / 13 categories)
- **Architecture review:** PASS — 1 CRITICAL fixed (Gate 10→Gate 9) + 4 [STRUCTURAL] applied to PRD

## Deliverables checklist

- [x] PRD section in `docs/PRD.md` (Section 6)
- [x] Use cases (35 scenarios)
- [x] Architecture review verdict (PASS)
- [x] QA test cases (139 TCs)
- [ ] Implementation slices (this document)

## [STRUCTURAL] decisions pinned

1. **Gate 9 (NOT Gate 10)** — gate count rises 9→10 (10th gate by ordinal)
2. **Two-step body_path** — workflow uses `Strip v prefix from tag` step (`id: ver`) → `body_path: .claude/release-notes-${{ steps.ver.outputs.version }}.md`
3. **breaking negation skip** — `non-breaking` and `not breaking` MUST NOT trigger major (case-insensitive)
4. **Multi-pattern CI/CD detection** — P1 (tags) + P2 (body_path correct) + P3 (inline extraction); resolution: P1+P2 or P1+P3 → present-and-correct; P1 alone → present-but-warning; no P1 → ABSENT
5. **packed-refs MUST** — agent reads `.git/packed-refs` if `.git/refs/tags/v*.*.*` glob fails
6. **./CLAUDE.md precedence** over `.claude/CLAUDE.md` with literal warning text
7. **Gate-Count Propagation** — separate table in PRD §6.6; Plan Critic verifies both agent-count AND gate-count

## Implementation plan (6 slices)

### Slice 1: release-engineer agent (frontmatter + structure, part 1 of 2)
- **Wave:** 1
- **Use cases:** UC-1, UC-1-A1, UC-1-E1, UC-1-EC1, UC-2, UC-3, UC-5, UC-13, UC-16
- **Files:** `src/agents/release-engineer.md` [new]
- **Changes:**
  - YAML frontmatter: `name: release-engineer`, `description:`, `tools: ["Read", "Write", "Edit", "Glob", "Grep"]` (NO Bash/Web/Notebook), `model: opus`
  - `## Role` (one-paragraph identity)
  - `## Inputs` — 6 inputs: (a) CHANGELOG.md `[Unreleased]`, (b) version-source per FR-3.1, (c) ./CLAUDE.md then .claude/CLAUDE.md, (d) `.github/workflows/*.yml`+`*.yaml`, (e) `.git/refs/tags/v*.*.*` (Glob), (f) `.git/packed-refs` (Read fallback)
  - `## Authority Boundary` — WRITE-allowed: CHANGELOG.md, `.claude/release-notes-X.Y.Z.md`, `.github/workflows/release.yml` only when ABSENT. READ-only: package.json, pyproject.toml, Cargo.toml, VERSION, both CLAUDE.md, `.git/refs/tags/`, `.git/packed-refs`
  - `## NEVER List` — never run git push/tag/gh release/npm publish/cargo publish/pypi upload; never modify version-source files; never network. Concrete commands ONLY in fenced code blocks (anti-drift)
  - `## Self-Check (Step 0)` — empty `[Unreleased]` → return EXACT `no-op: no unreleased changes` and STOP
  - `## Output Contract` — 10-section structure outline (full body in Slice 2)
- **Verify:** `test -f src/agents/release-engineer.md && grep -qE '^name: release-engineer' src/agents/release-engineer.md && grep -qE '^model: opus' src/agents/release-engineer.md && awk '/^---$/{f++; next} f==1' src/agents/release-engineer.md | grep -q '"Read"' && awk '/^---$/{f++; next} f==1' src/agents/release-engineer.md | grep -q '"Write"' && awk '/^---$/{f++; next} f==1' src/agents/release-engineer.md | grep -q '"Edit"' && awk '/^---$/{f++; next} f==1' src/agents/release-engineer.md | grep -q '"Glob"' && awk '/^---$/{f++; next} f==1' src/agents/release-engineer.md | grep -q '"Grep"' && ! awk '/^---$/{f++; next} f==1' src/agents/release-engineer.md | grep -qE '"Bash"|"WebFetch"|"WebSearch"|"NotebookEdit"' && [ "$(grep -cE '^## (Role|Inputs|Authority Boundary|NEVER List|Self-Check|Output Contract)' src/agents/release-engineer.md)" -ge 6 ] && grep -qF 'no-op: no unreleased changes' src/agents/release-engineer.md`
- **Done when:** File exists with frontmatter (5 allowed tools, 4 banned tools absent in frontmatter scope); 6 structural section headings present; `no-op: no unreleased changes` literal present
- **Pre-review:** architect + security
- **Satisfies AC:** AC-1, AC-2, AC-8 (partial)

### Slice 2: release-engineer content (algorithms + worked examples, part 2 of 2)
- **Wave:** 2
- **Use cases:** UC-2, UC-3, UC-3-A1..A4, UC-3-E1, UC-4, UC-5, UC-5-A1..A2, UC-5-E1, UC-6, UC-7, UC-7-A1, UC-8, UC-8-E1, UC-9, UC-10, UC-11, UC-12, UC-13, UC-14, UC-14-EC1, UC-15
- **Files:** `src/agents/release-engineer.md`
- **Changes:**
  - `## Step 1 — Version Source Detection` with FR-3.1 priority (a-e); explicit packed-refs fallback ("If `Glob('.git/refs/tags/v*.*.*')` returns zero, you MUST `Read('.git/packed-refs')` and parse `<sha> refs/tags/<name>` lines for `v*.*.*`")
  - `## Step 1.5 — Version Source Override` — `./CLAUDE.md` first, then `.claude/CLAUDE.md`; on disagreement emit literal warning `multiple Version source: lines detected — using ./CLAUDE.md; recommend reconciling to a single source of truth`
  - `## Step 2 — Semver Bump Algorithm` with FR-4.1 + **negation skip rule** ("immediately-preceding non-whitespace token `non-` OR preceding whitespace-stripped sequence ending in `not`"). 4 MUST-NOT-trigger examples + 3 MUST-trigger examples
  - `## Step 2.1 — Pre-1.0 Override` — current MAJOR=0 → any major rule produces minor instead
  - `## Step 2.2 — FR-4.3/FR-4.4 Edge Categories` — uncategorized → Changed + warning; only Deprecated/Security → patch
  - `## Step 2.3 — Worked Examples` (4 examples per AC-7): `0.3.7+Fixed→0.3.8`, `0.3.7+Added→0.4.0`, `1.2.3+Removed→2.0.0`, `0.9.9+Removed→0.10.0`
  - `## Step 3 — CHANGELOG Manipulation` — rename `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`, insert fresh empty `[Unreleased]`, preserve prior versioned sections byte-for-byte
  - `## Step 4 — Release Notes File` — write `.claude/release-notes-X.Y.Z.md` with renamed section's BODY (no heading); overwrite if exists; do NOT delete; do NOT commit
  - `## Step 5 — CI/CD Provisioning (Multi-Pattern P1+P2+P3)` with explicit pattern definitions and outcome resolution table
  - `## Step 5.1 — ABSENT case template` — exact YAML with HTML comment + `Strip v prefix from tag` step (`id: ver`, `run: echo "version=${GITHUB_REF_NAME#v}" >> "$GITHUB_OUTPUT"`) + `body_path: .claude/release-notes-${{ steps.ver.outputs.version }}.md` + uses `softprops/action-gh-release@v2`. Explanatory note about why `${GITHUB_REF_NAME#v}` directly in YAML body_path fails
  - `## Step 6 — Structured Summary Output` — 10 labeled sections per FR-6.1, fenced `Commands to run` block per FR-6.5
  - `## Recovery & Failure Modes` — partial-progress preservation, pre-release suffix stripping (FR-3.5), uncategorized warning
  - `## Anti-Drift` paragraph — publish commands ONLY in fenced code blocks
- **Verify:** `[ "$(grep -cE '^## (Step 1 |Step 1\.5|Step 2 |Step 2\.1|Step 2\.2|Step 2\.3|Step 3 |Step 4 |Step 5 |Step 5\.1|Step 6 |Recovery|Anti-Drift)' src/agents/release-engineer.md)" -ge 13 ] && grep -qF 'packed-refs' src/agents/release-engineer.md && grep -qF 'multiple Version source: lines detected' src/agents/release-engineer.md && grep -qF 'non-breaking' src/agents/release-engineer.md && grep -qF 'not breaking' src/agents/release-engineer.md && grep -qF '0.3.7' src/agents/release-engineer.md && grep -qF '0.4.0' src/agents/release-engineer.md && grep -qF '1.2.3' src/agents/release-engineer.md && grep -qF '2.0.0' src/agents/release-engineer.md && grep -qF '0.9.9' src/agents/release-engineer.md && grep -qF '0.10.0' src/agents/release-engineer.md && grep -qF 'softprops/action-gh-release@v2' src/agents/release-engineer.md && grep -qF 'Strip v prefix from tag' src/agents/release-engineer.md && grep -qF 'steps.ver.outputs.version' src/agents/release-engineer.md && grep -qF 'generated by claude-code-sdlc release-engineer' src/agents/release-engineer.md && grep -qE '^## (Role|NEVER List|Self-Check)' src/agents/release-engineer.md`
- **Done when:** All 13 step/section headings; packed-refs documented; literal warning text present; both negation forms; all 4 worked-example version pairs; CI/CD template tokens present
- **Pre-review:** architect + security
- **Satisfies AC:** AC-2, AC-7 (a-d + worked examples), AC-8 (full), AC-9, AC-10, AC-11

### Slice 3: install.sh banners 16→17
- **Wave:** 1
- **Use cases:** UC-16 (registration prerequisite)
- **Files:** `install.sh`
- **Changes:** Locate via `grep -n "16 specialized\|16 AI agents\|(16 files" install.sh` (do NOT trust line numbers). Update 5 banners: `16 specialized AI` → `17 specialized AI` (line ~8); `16 specialized AI agents.` → `17 specialized AI agents.` (line ~49); `16 specialized agent prompts` → `17 specialized agent prompts` (line ~62); `16 AI agents` → `17 AI agents` (line ~178); `(16 files` → `(17 files` (line ~182). Glob at line 202 already covers `release-engineer.md`
- **Verify:** `bash -n install.sh && [ "$(grep -c '17 specialized' install.sh)" -eq 3 ] && [ "$(grep -c '17 AI agents' install.sh)" -eq 1 ] && [ "$(grep -cE '\(17 files' install.sh)" -eq 1 ] && [ "$(grep -c '16 specialized' install.sh)" -eq 0 ] && [ "$(grep -c '16 AI agents' install.sh)" -eq 0 ] && [ "$(grep -cE '\(16 files' install.sh)" -eq 0 ] && grep -qF 'src/agents/*.md' install.sh`
- **Done when:** bash syntax valid; exact counts 17 specialized=3, 17 AI agents=1, (17 files=1; all 16-counterparts=0; glob preserved
- **Pre-review:** architect + security
- **Satisfies AC:** AC-14, AC-15

### Slice 4: merge-ready.md — Gate 9 + line 7 rewrite + table extension + SKIPPED legend
- **Wave:** 1
- **Use cases:** UC-1, UC-1-A1, UC-1-E1, UC-1-EC1, UC-2, UC-3, UC-6, UC-7, UC-10, UC-16
- **Files:** `src/commands/merge-ready.md`
- **Changes:**
  - **Line 7** — replace `The gate list (Gate 0 through Gate 8) is UNCHANGED; no \`Gate 10\` exists in iteration 1 per PRD 3.8 item 7 and AC-11.` with `The gate list (Gate 0 through Gate 9) now includes Gate 9 release packaging per PRD Section 6 / FR-7.1. The pre-flight \`changelog-writer\` sync still runs before Gate 0 and is NOT itself a gate.`
  - **After Gate 8 section** — insert new `## Gate 9: Release Packaging` section delegating to `release-engineer`. MUST document: 6-step sequence (self-check → version detect → bump → CHANGELOG rewrite → release-notes → CI/CD provision → structured summary), conditional skip on empty `[Unreleased]` → SKIPPED, invocation order after pre-flight + Gate 0-8, one-pass-per-merge-ready guarantee, isolation (Gate 9 failure does NOT re-evaluate Gates 0-8)
  - **Gate-output table (lines 80-91)** — add 10th row: `| Release Packaging | PASS/FAIL/SKIPPED | Empty [Unreleased] -> SKIPPED |`
  - **Below table** — add SKIPPED legend: `SKIPPED = Gate 9 reports SKIPPED when the project's CHANGELOG.md [Unreleased] section is empty across all six Keep a Changelog categories per FR-7.2.`
- **Verify:** `grep -qF 'Gate 0 through Gate 9' src/commands/merge-ready.md && grep -qF 'pre-flight \`changelog-writer\` sync still runs before Gate 0 and is NOT itself a gate' src/commands/merge-ready.md && ! grep -qF 'no \`Gate 10\` exists in iteration 1' src/commands/merge-ready.md && grep -qE '^## Gate 9: Release Packaging' src/commands/merge-ready.md && grep -qF 'release-engineer' src/commands/merge-ready.md && grep -qF 'Release Packaging | PASS/FAIL/SKIPPED' src/commands/merge-ready.md && grep -qF 'SKIPPED = Gate 9' src/commands/merge-ready.md`
- **Done when:** Pre-flight comment rewritten with `Gate 0 through Gate 9` and "still runs before Gate 0"; old `no Gate 10 exists in iteration 1` absent; new `## Gate 9: Release Packaging` heading; `Release Packaging | PASS/FAIL/SKIPPED` table row; SKIPPED legend; release-engineer referenced by exact name
- **Pre-review:** architect
- **Satisfies AC:** AC-3, AC-4, AC-17 (cross-ref), AC-18

### Slice 5: src/claude.md — Agency Roles + 16→17 prose + 9→10 prose + Plan Critic Gate-9 awareness
- **Wave:** 1
- **Use cases:** UC-16
- **Files:** `src/claude.md` (canonical lowercase; APFS case-alias inode shared with `src/CLAUDE.md`)
- **Changes:**
  - **Agency Roles table** — append new row at END after `Release Scribe | changelog-writer`: `| Release Engineer | \`release-engineer\` | Package releases at /merge-ready Gate 9 — version bump, CHANGELOG date stamp, release-notes file, GitHub Actions release workflow provisioning |`
  - **Plan Critic line 114 — extend slug-collision verbatim list** (Plan Critic MAJOR 2): currently enumerates 16 core slugs (`prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, test-writer, code-reviewer, build-runner, e2e-runner, verifier, doc-updater, refactor-cleaner, changelog-writer, resource-architect, role-planner`) — append `, release-engineer` (17th). Update the phrase "core 16 agent name" → "core 17 agent name".
  - **Prose audit (no-op pattern from FR-6.2)** — `grep -nE '\b16 (agents|specialized agents|AI agents|Agents)\b' src/claude.md` for prose count references; expected zero matches per prior features' FR-6.2 pattern; document as no-op
  - **Gate-count audit (no-op)** — `grep -nE '\b9 (gates|quality gates)\b|Gate 8 is the last' src/claude.md`; expected zero matches; document as no-op
  - **Plan Critic — optional Gate 9 awareness (FR-8.8 MAY)** — append literal line at end of wave-validation block: `> - For merge-ready-touching plans: verify any reference to "Gate 9" matches the gate count "10" — flag mismatch as MAJOR.`
- **Verify:** `grep -qF '| Release Engineer | \`release-engineer\` |' src/claude.md && grep -qF 'core 17 agent name' src/claude.md && [ "$(grep -c 'core 16 agent name' src/claude.md)" -eq 0 ] && [ "$(grep -cE '\b16 (agents|specialized agents|AI agents)\b' src/claude.md)" -eq 0 ] && [ "$(grep -cE '\b9 (gates|quality gates)\b|Gate 8 is the last' src/claude.md)" -eq 0 ] && grep -qF 'release-engineer' src/claude.md && grep -qF 'Package releases at /merge-ready Gate 9' src/claude.md && grep -qF 'For merge-ready-touching plans: verify any reference to "Gate 9"' src/claude.md`
- **Done when:** Agency Roles row matches literal pattern; zero `16 agents` / `16 specialized agents` / `16 AI agents`; zero `9 gates` / `9 quality gates` / `Gate 8 is the last`; literal `Gate 9` present
- **Pre-review:** architect
- **Satisfies AC:** AC-12, AC-17

### Slice 6: README.md + templates/CLAUDE.md
- **Wave:** 1
- **Use cases:** UC-2, UC-3, UC-5, UC-6, UC-7
- **Files:** `README.md`, `templates/CLAUDE.md`
- **Changes:**
  - **README line 5:** `16 specialized AI agents` → `17 specialized AI agents`
  - **README line 35:** `**9 quality gates**` → `**10 quality gates**`
  - **README line 95:** `## The 16 Agents` → `## The 17 Agents`
  - **README — append agent table row** after `changelog-writer` row: `| \`release-engineer\` | Packages releases at \`/merge-ready\` Gate 9 — semver bump, CHANGELOG date-stamp, release-notes file, GitHub Actions workflow provisioning. Suggest-only: never runs \`git push\` / \`git tag\` / \`gh release create\` / \`npm publish\`. |`
  - **README line 194 (Plan Critic MAJOR 1):** `The 16 agents shipped by this repo` → `The 17 agents shipped by this repo`. Same paragraph references "core 16" — update to "core 17" (count phrasing).
  - **README line 125:** `All 9 quality gates` → `All 10 quality gates`
  - **README line 135:** `9 quality gates including goal-backward verification` → `10 quality gates including release packaging`
  - **README — add feature bullet** under `## What This Fixes`: `- **Release packaging** — Gate 9 of \`/merge-ready\` computes the semver bump from \`[Unreleased]\` content, date-stamps the CHANGELOG section, writes a release-notes file, and provisions the GitHub Actions release workflow. Suggest-only: emits the exact \`git add\` / \`git commit\` / \`git tag\` / \`git push\` commands you run yourself; never executes them.`
  - **templates/CLAUDE.md — replace iteration-1 dead-metadata language**:
    ```
    <!-- Iteration 2 (Section 6): consumed by `release-engineer` at /merge-ready Gate 9 to override the version-source priority order. -->

    - **Version source:** TODO (path to your version-source file, e.g., `package.json`, `pyproject.toml`, `Cargo.toml`, or `VERSION`. Leave blank to use auto-detection per Section 6 FR-3.1: package.json -> pyproject.toml -> Cargo.toml -> VERSION -> latest git tag matching v*.*.* -> fallback 0.1.0. Both `./CLAUDE.md` and `.claude/CLAUDE.md` are checked; `./CLAUDE.md` takes precedence when both files specify the field with disagreeing values.)
    ```
- **Verify:** `grep -qF '17 specialized AI agents' README.md && grep -qF '## The 17 Agents' README.md && grep -qF '**10 quality gates**' README.md && grep -qF 'All 10 quality gates' README.md && grep -qF '10 quality gates including release packaging' README.md && grep -qF '| \`release-engineer\` |' README.md && grep -qF 'Release packaging' README.md && grep -qF 'The 17 agents shipped by this repo' README.md && [ "$(grep -c 'The 16 agents shipped by this repo' README.md)" -eq 0 ] && [ "$(grep -cE '\b16 specialized AI agents\b|## The 16 Agents|\*\*9 quality gates\*\*|All 9 quality gates' README.md)" -eq 0 ] && grep -qF 'consumed by \`release-engineer\`' templates/CLAUDE.md && grep -qF '/merge-ready Gate 9' templates/CLAUDE.md && grep -qF '\`./CLAUDE.md\` takes precedence' templates/CLAUDE.md && ! grep -qiF 'no runtime effect' templates/CLAUDE.md`
- **Done when:** All 5 README substitutions; `release-engineer` agent-table row; `Release packaging` feature bullet; zero residual 16-counterparts; templates/CLAUDE.md updated with all required literal strings; old `no runtime effect` removed
- **Pre-review:** none
- **Satisfies AC:** AC-4, AC-13, AC-16, AC-17

## Acceptance criteria (18/18)

- [ ] AC-1 — agent file with frontmatter (Slice 1)
- [ ] AC-2 — self-check first (Slice 1)
- [ ] AC-3 — Gate 9 added to merge-ready (Slice 4)
- [ ] AC-4 — 9→10 propagation (Slices 4, 5, 6)
- [ ] AC-5 — empty Unreleased no-op (Slice 1)
- [ ] AC-6 — populated flow (Slice 2)
- [ ] AC-7 a-d + worked examples (Slice 2)
- [ ] AC-8 — tools exclusion + NEVER list (Slices 1, 2)
- [ ] AC-9 — Version source: override (Slice 2)
- [ ] AC-10 — generated release.yml (HTML comment + softprops + two-step body_path) (Slice 2)
- [ ] AC-11 — structured summary 10 sections (Slice 2)
- [ ] AC-12 — src/claude.md row + 17 prose (Slice 5)
- [ ] AC-13 — README updates (Slice 6)
- [ ] AC-14 — install.sh 5 banners (Slice 3)
- [ ] AC-15 — install.sh glob picks up agent (Slice 3)
- [ ] AC-16 — templates/CLAUDE.md docs (Slice 6)
- [ ] AC-17 — cross-references valid (Slices 1, 2, 4, 5, 6)
- [ ] AC-18 — idempotency / SKIPPED on re-run (Slices 1, 4)

## Files to modify

**New (1):**
- `src/agents/release-engineer.md` (Slices 1+2)

**Modified (5):**
- `install.sh` (Slice 3)
- `src/commands/merge-ready.md` (Slice 4)
- `src/claude.md` (Slice 5)
- `README.md` (Slice 6)
- `templates/CLAUDE.md` (Slice 6)

## Wave assignment

| Wave | Slices | Files | Rationale |
|------|--------|-------|-----------|
| 1 | 1, 3, 4, 5, 6 | release-engineer.md [new] + install.sh + merge-ready.md + claude.md + README.md/templates/CLAUDE.md | Disjoint files; full parallel |
| 2 | 2 | release-engineer.md (extends Slice 1 output) | Same file as Slice 1 — sequential |

**Wave-validation:** all `Wave:` fields present; contiguous {1, 2}; Wave 1 file-pairs all disjoint; Wave 2 (Slice 2) depends on Slice 1 (Wave 1) — correct ordering; same file across different waves is valid.

## Risk assessment

- **Auth/financial impact:** None — agent never runs publish commands (Bash absent; `tools` defense-in-depth)
- **Persistence:** Local writes only; idempotent via empty-Unreleased self-check + HTML-comment marker
- **Concurrency:** Single-pipeline-at-a-time assumption (parallel to Sections 4, 5)
- **Bump algorithm correctness:** Negation skip + pre-1.0 are highest-risk surfaces; 4 worked examples + TC-4.6-4.9 (negation) + TC-4.4/4.16 (pre-1.0) provide deterministic verification
- **Slice 1+2 split:** Same file, sequential — Wave 2 reads Wave 1's commit
- **Case-sensitivity:** `./CLAUDE.md` exact lowercase `.claude/` + uppercase `CLAUDE.md`; `src/claude.md` lowercase canonical
- **Rollback:** per-slice atomic commits; `git revert <commit>` non-overlapping (only Slice 1+2 share a file — both commits would be reverted as a pair)

## Dependencies

- **PRD §3 (changelog-writer)** — SHIPPED. Provides `[Unreleased]` content. Independence: release-engineer does NOT require changelog-writer to be configured.
- **PRD §3 FR-5.5 (Version source: placeholder)** — SHIPPED in `templates/CLAUDE.md`. Iteration 2 consumes + extends docs (Slice 6).
- **PRD §4, §5** — orthogonal; reuse suggest-only-via-tools-restriction pattern.
- **No new libraries.** Markdown + bash only.
- **No new external services.** `softprops/action-gh-release@v2` referenced in template content only — no Claude-side runtime fetch.

## Return summary

- **Slice count:** 6
- **Waves:** 2 (5 in parallel, 1 sequential)
- **[STRUCTURAL] decisions:** 7 pinned (see section above)
- **AC coverage:** 18/18
- **Coverage gaps:** none

---

## Review Notes

### Critic Findings
- **Total:** 10 findings (0 critical, 5 major, 5 minor)
- **All CRITICAL/MAJOR addressed:** Yes

### Changes Made

**MAJOR 1 — Slice 6 missed README line 194:** Extended Slice 6 Changes to update "The 16 agents shipped by this repo" → "The 17 agents shipped by this repo" + "core 16" → "core 17". Verify now greps for "The 17 agents shipped" presence + "The 16 agents shipped" absence.

**MAJOR 2 — Slice 5 missed `src/claude.md` line 114 slug-collision list:** Extended Slice 5 Changes to add `release-engineer` to the verbatim 16-name list AND update "core 16 agent name" → "core 17 agent name". Verify now greps for "core 17 agent name" presence + "core 16 agent name" absence.

**MAJOR 3 — Slice 5 trivially-passing prose audit:** Acknowledged FR-6.2 no-op pattern in Slice 5 description; the real prose change is at line 114 (handled by MAJOR 2). Verify is now non-trivial.

**MAJOR 4 — Slice 6 case-sensitive `no runtime effect` check:** Verify now uses `! grep -qiF 'no runtime effect'` (case-insensitive) — catches both lowercase "no" and uppercase "NO" in current text.

**MAJOR 5 — Slice 5 missing FR-8.8 Plan Critic verify clause:** Added `grep -qF 'For merge-ready-touching plans: verify any reference to "Gate 9"'` to Slice 5 Verify — ensures the optional Plan Critic awareness line is actually inserted.

### Acknowledged Minor Issues

**MINOR 6 — Inode discrepancy (4443075 vs actual 4463570):** Cosmetic; verification logic uses paths, not inode. Update inode reference in scratchpad post-completion.

**MINOR 7 — Slice 2 doesn't preserve-check Slice 1 content:** Added `grep -qE '^## (Role|NEVER List|Self-Check)' src/agents/release-engineer.md` to Slice 2 Verify so it confirms Slice 1's headings persist after the append.

**MINOR 8 — Slice 3 glob check is static-only:** AC-15 runtime install verification deferred to Gate 5 (E2E install.sh simulation) per established Feature #1/4/5 pattern.

**MINOR 9 — Slice 1 awk frontmatter edge case:** Acceptable risk; missing frontmatter would be caught by `grep -qE '^name: release-engineer'` requiring the format.

**MINOR 10 — Slice 6 templates/CLAUDE.md heredoc parens:** Verify uses substring fragments robust to surrounding parentheses.
