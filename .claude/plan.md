# Implementation Plan: Resource Manager-Architect — Iteration 2: Auto-Install

## Prerequisites verified

- PRD §7 (lines 1472-1815) — 9 FRs, 20 ACs, 11 NFRs, 11 risks, 7 deps
- Use cases — 14 UCs / 52 scenarios
- QA — 106 TCs / 13 categories
- Architecture review: PASS with 5 [STRUCTURAL] items

## Deliverables checklist
- [x] PRD §7
- [x] Use cases
- [x] Architect review verdict
- [x] QA test cases
- [ ] Implementation slices (this document)

## [STRUCTURAL] decisions pinned

1. **Reconcile iter-1 Authority Boundary with iter-2 side-effect mutations** — direct-Write prohibition preserved; side-effect mutations via whitelisted Bash newly permitted. Mutated paths: `package.json`, `package-lock.json`, `~/.claude/settings.json`, `node_modules/`. Slices 1+3.
2. **Multi-pkg-manager tiebreaker** — most-recent lockfile mtime > `packageManager` field > pnpm > yarn > npm. Audit-logged. Slice 2.
3. **Whitelist character classes WIDENED** — package-name positions use `[a-zA-Z0-9@/._+~-]`. Slice 2.
4. **Forbidden-tier canonical** — option (a) suggest alternative + omit Forbidden when alternative exists; option (b) `Tier: Forbidden` + `manual-action-required` ONLY when no alternative. Slice 1.
5. **Headless detection** — `process.stdin.isTTY === false` → literal `Skipped: non-interactive context — auto-install requires user approval` + bypass. Slice 4.

## Implementation plan (8 slices)

### Slice 1: Install Mode + 4-tier authority + decision table
- **Wave:** 1
- **Use cases:** UC-1, UC-2, UC-5, UC-6, UC-7, UC-13, UC-14
- **Files:** `src/agents/resource-architect.md`
- **Changes:**
  - Update `tools:` frontmatter to `["Read", "Write", "Bash", "Glob", "Grep"]` (5 tools, NO Edit/WebFetch/WebSearch/NotebookEdit)
  - Append `## Install Mode (Iteration 2)` section after iter-1 sections (preserve iter-1 byte-for-byte)
  - `### 4-Tier Authority Gradation` — enumerate Trivial/Moderate/Sensitive/Forbidden with examples
  - `### Tier Classification Decision Table` — markdown table ≥12 rows
  - Default rule "most-restrictive applicable tier" verbatim
  - `Tier:` 7th field per recommendation entry
  - Summary-line extension: append `<N> Trivial; <N> Moderate; <N> Sensitive; <N> Forbidden`
  - Forbidden canonical per [STRUCTURAL] 4: rewrite-as-alternative; OR `Tier: Forbidden` + `user must perform manually outside the SDLC pipeline` literal in Why
  - `### Authority Boundary — Iteration 2 Extension` reconciling iter-1 prohibition with side-effect mutation paths
- **Verify:** `grep -qE '^tools:.*Bash' src/agents/resource-architect.md && [ "$(awk '/^---$/{f++; next} f==1' src/agents/resource-architect.md | grep -oE '"(Read|Write|Bash|Glob|Grep)"' | sort -u | wc -l | tr -d ' ')" = "5" ] && ! awk '/^---$/{f++; next} f==1' src/agents/resource-architect.md | grep -qE '"Edit"|"WebFetch"|"WebSearch"|"NotebookEdit"' && grep -qE '^## Install Mode' src/agents/resource-architect.md && [ "$(grep -cE 'Trivial|Moderate|Sensitive|Forbidden' src/agents/resource-architect.md)" -ge 12 ] && grep -qF 'most-restrictive applicable tier' src/agents/resource-architect.md && grep -qF 'user must perform manually outside the SDLC pipeline' src/agents/resource-architect.md && grep -qE 'side-effect mutations|side-effect mutation paths' src/agents/resource-architect.md && grep -qiF 'MUST NOT modify' src/agents/resource-architect.md`
- **Done when:** All Verify checks pass; Install Mode section exists; tools frontmatter has exactly 5 listed (counted via unique match extraction); Forbidden canonical phrasing present; iter-1 content preserved (verified by grep for representative iter-1 phrases — content-anchored, not line-anchored)
- **Pre-review:** architect + security
- **Satisfies AC:** AC-1 (partial), AC-2, AC-4, AC-13, AC-14

### Slice 2: Bash Whitelist + detect-then-install + multi-pkg-manager tiebreaker
- **Wave:** 2
- **Use cases:** UC-1, UC-2, UC-3, UC-4, UC-7-E1, UC-8, UC-9-EC1, UC-12, UC-14
- **Files:** `src/agents/resource-architect.md`
- **Changes:**
  - `### Bash Whitelist` enumerating anchored regex patterns:
    - 13 detection patterns (`^claude mcp list$`, `^npm list --depth=0( --json)?$`, `^cat package\.json$`, etc.)
    - 3 Trivial patterns (`^claude mcp add ...`, `^npx playwright install...`)
    - 6 Moderate patterns with widened class `[a-zA-Z0-9@/._+~-]` per [STRUCTURAL] 3
  - 26-prefix deny-list (rm/mv/cp/curl/wget/ssh/sudo/git push/git tag/npm publish/aws configure/gcloud auth login etc.)
  - Authority Boundary violation literal: `Authority Boundary violation: command \`<cmd>\` does not match any whitelist pattern`
  - POSIX-only fallback literal: `Auto-install requires POSIX shell; current environment unsupported in iteration 2`
  - No-runtime-expansion rule
  - `### Detect-then-Install Pattern` selection table
  - Multi-pkg-manager tiebreaker per [STRUCTURAL] 2: 3 levels with audit-log mandate
  - 3 outcomes: skipped-already-present, aborted-version-conflict (literal warning template), absent→approval
  - Audit-log mandate: command + matched pattern + exit code + truncated stdout/stderr (200 chars + `... [truncated]`)
- **Verify:** `grep -qE '\\[a-zA-Z0-9@/\\._\\+~-\\]' src/agents/resource-architect.md && grep -qF 'Authority Boundary violation: command' src/agents/resource-architect.md && grep -qF 'Auto-install requires POSIX shell' src/agents/resource-architect.md && grep -qE 'most-recent.*lockfile|most-recently-modified lockfile' src/agents/resource-architect.md && grep -qF 'packageManager' src/agents/resource-architect.md && grep -qE 'pnpm > yarn > npm|pnpm.*yarn.*npm' src/agents/resource-architect.md && grep -qF 'manual reconciliation required' src/agents/resource-architect.md && grep -qF '... [truncated]' src/agents/resource-architect.md && for prefix in "rm " "rmdir" "mv " "cp " "curl" "wget" "ssh" "scp" "rsync" "sudo" "su " "runas" "git push" "git tag" "git commit -a" "git rebase" "git reset --hard" "npm publish" "cargo publish" "pypi upload" "gh release create" "docker push" "aws configure" "gcloud auth login"; do grep -qF "$prefix" src/agents/resource-architect.md || { echo "MISSING deny-list prefix: $prefix"; exit 1; }; done`
- **Done when:** All Verify checks pass; widened character class present; tiebreaker 3 levels documented; literals present
- **Pre-review:** security
- **Satisfies AC:** AC-1 (partial), AC-3, AC-5 (groundwork), AC-7

### Slice 3: Approval flow + halt semantics + output extension
- **Wave:** 3
- **Use cases:** UC-1..UC-14 (full coverage of approval/halt scenarios)
- **Files:** `src/agents/resource-architect.md`
- **Changes:**
  - `### Approval Flow` — prompt header literal `Auto-install approval required:`; Trivial section grouped per category; Moderate per-item; footer `Sensitive-tier items (if any) will be presented separately for manual action.`
  - Affirmative tokens (yes/y/approve/ok/agreed/please do/go ahead) + negative (no/n/decline/skip/not now) + ambiguous→default-deny
  - Bulk reply support with worked examples
  - Sequential execution mandate
  - Ephemeral prompt (no file write)
  - `### Halt Semantics`:
    - Trivial fail → `approved-but-failed` + warning + CONTINUE
    - Moderate fail → `approved-but-failed` + remaining `aborted-batch-halted`
    - Sensitive → Rule 4 escalation per-item; agent continues non-Sensitive
    - Forbidden whitelist violation → `aborted-whitelist-violation` + HALT entire phase + Step 3.5 FAILS
    - Detection failure → `aborted-detection-failed` per-item, non-blocking
    - No rollback
  - `### Output Extension — Auto-Install Results`:
    - APPEND `## Auto-Install Results` AFTER `## Recommended Resources` in `.claude/resources-pending.md`
    - 10 status strings: auto-applied, approved-and-applied, approved-but-failed, skipped-already-present, aborted-version-conflict, aborted-sensitive, aborted-whitelist-violation, aborted-batch-halted, aborted-detection-failed, not-approved
    - Literal `agent MUST NOT emit any other status string`
    - `No installable items` literal for zero-installable case
    - `## Recommended Resources` byte-for-byte unchanged after install phase
  - `### Backward Compatibility` — no-to-all preserves iter-1; Sensitive-only path; Tier additive
- **Verify:** `grep -qE '^### Approval Flow' src/agents/resource-architect.md && grep -qF 'Auto-install approval required:' src/agents/resource-architect.md && grep -qF 'Sensitive-tier items' src/agents/resource-architect.md && for status in "auto-applied" "approved-and-applied" "approved-but-failed" "skipped-already-present" "aborted-version-conflict" "aborted-sensitive" "aborted-whitelist-violation" "aborted-batch-halted" "aborted-detection-failed" "not-approved"; do grep -qF "$status" src/agents/resource-architect.md || { echo "MISSING status: $status"; exit 1; }; done && grep -qF '## Auto-Install Results' src/agents/resource-architect.md && grep -qF 'No installable items' src/agents/resource-architect.md && grep -qF 'agent MUST NOT emit any other status string' src/agents/resource-architect.md && grep -qE 'Rule 4|escalat' src/agents/resource-architect.md`
- **Done when:** All status strings present; approval/halt semantics documented; output section pinned
- **Pre-review:** architect
- **Satisfies AC:** AC-1 (full), AC-5, AC-6, AC-7, AC-8, AC-9, AC-19

### Slice 4: bootstrap-feature.md Step 3.5 extension + headless detection
- **Wave:** 1
- **Use cases:** UC-1, UC-7, UC-12, UC-13, UC-14
- **Files:** `src/commands/bootstrap-feature.md`
- **Changes:**
  - Locate Step 3.5 (currently iter-1 suggestion delegation); EXTEND body keeping `3.5` numbering
  - Document iter-2 substeps (a)-(e): suggestion → approval prompt → orchestrator captures reply → agent runs Trivial/Moderate sequentially → append `## Auto-Install Results`
  - Headless contract per [STRUCTURAL] 5: `process.stdin.isTTY === false` → orchestrator skips approval, agent writes literal `Skipped: non-interactive context — auto-install requires user approval` body, bypass install execution, proceed to Step 3.75
  - Step 3.5 SUCCEEDS unless (a) iter-1 suggestion fails OR (b) FR-5.4 whitelist violation HALTS
  - Step 3.5 mandatory; auto-install phase WITHIN can skip via "no" or headless
- **Verify:** `grep -qE '### Step 3\\.5|^Step 3\\.5' src/commands/bootstrap-feature.md && [ "$(grep -cE '^### Step 3\\.5(:| )' src/commands/bootstrap-feature.md)" -eq 1 ] && grep -qE 'approval prompt|approval-prompt block' src/commands/bootstrap-feature.md && grep -qF 'Skipped: non-interactive context — auto-install requires user approval' src/commands/bootstrap-feature.md && grep -qE 'process\\.stdin\\.isTTY|isTTY === false|non-interactive' src/commands/bootstrap-feature.md && grep -qE 'whitelist violation.+halt|halt.+whitelist violation|aborted-whitelist-violation.+(halt|FAIL|fails Step)' src/commands/bootstrap-feature.md && [ "$(grep -cE '^### Step 3\\.6|^### Step 3\\.55|^### Step 3\\.51' src/commands/bootstrap-feature.md)" -eq 0 ] && grep -qF '## Auto-Install Results' src/commands/bootstrap-feature.md && git diff --exit-code install.sh && [ "$(git status --porcelain install.sh | wc -l | tr -d ' ')" = "0" ]`
- **Done when:** Step still 3.5 (no renumber); literal headless message present; whitelist FAIL semantics documented
- **Pre-review:** architect
- **Satisfies AC:** AC-10, AC-12, AC-18

### Slice 5: planner.md inlining instruction extended
- **Wave:** 1
- **Use cases:** UC-1, UC-2, UC-7
- **Files:** `src/agents/planner.md`
- **Changes:**
  - Locate iter-1 instruction inlining `## Recommended Resources` from `.claude/resources-pending.md`
  - EXTEND to inline BOTH `## Recommended Resources` AND `## Auto-Install Results` from same temp file
  - Ordering: `## Recommended Resources` first, `## Auto-Install Results` second
  - Both before `## Additional Roles` (Section 5) and `## Prerequisites verified`
  - Absence of `## Auto-Install Results` is NOT an error (legacy/headless/no-installable)
  - Preserve temp-file deletion behavior
- **Verify:** `grep -qF '## Recommended Resources' src/agents/planner.md && grep -qF '## Auto-Install Results' src/agents/planner.md && grep -qF 'resources-pending.md' src/agents/planner.md && grep -qE 'Recommended Resources first|Recommended Resources.*Auto-Install Results' src/agents/planner.md && grep -qE 'roles-pending\\.md|## Additional Roles' src/agents/planner.md`
- **Done when:** Both sections referenced; ordering documented; Section 5 instruction preserved
- **Pre-review:** none
- **Satisfies AC:** AC-11, AC-18

### Slice 6: src/claude.md Agency Roles row text + Plan Critic recognition
- **Wave:** 1
- **Use cases:** UC-13, UC-14
- **Files:** `src/claude.md`
- **Changes:**
  - REPLACE `resource-architect` row Responsibility column from iter-1 text to: "Recommend external resources at bootstrap time and auto-install Trivial/Moderate items after user approval (MCP, dev dependencies); Sensitive items escalate to user."
  - Keep Role title and agent name unchanged
  - Add Plan Critic bullet recognizing `## Auto-Install Results` (parallel to existing `## Recommended Resources` bullet); absence NOT a finding; malformed status strings (not in 10-enum) MAY be MINOR
  - DO NOT touch agent-count or gate-count strings
- **Verify:** `grep -qF 'auto-install Trivial/Moderate items after user approval' src/claude.md && grep -qF '## Auto-Install Results' src/claude.md && grep -qF 'Sensitive items escalate to user' src/claude.md && [ "$(grep -cE '17 specialized|17 AI agents' src/claude.md)" = "$(git show HEAD:src/claude.md | grep -cE '17 specialized|17 AI agents')" ] && [ "$(grep -cE '18 specialized|18 AI agents|11 gates|11 quality gates' src/claude.md)" -eq 0 ]`
- **Done when:** Responsibility text updated; Plan Critic bullet added; counts unchanged
- **Pre-review:** none
- **Satisfies AC:** AC-13, AC-14, AC-17

### Slice 7: README.md feature section extension
- **Wave:** 1
- **Use cases:** UC-13, UC-14
- **Files:** `README.md`
- **Changes:**
  - Locate existing resource-architect feature section (Section 4 introduced)
  - EXTEND with iter-2 description: 4-tier gradation (high-level), approval flow (per-category Trivial / per-item Moderate / Rule 4 Sensitive), Bash whitelist defense-in-depth, backward compat ("no to all" preserves iter-1)
  - DO NOT touch agent-count/gate-count strings
- **Verify:** `grep -qE '4-tier|four-tier|Trivial.*Moderate.*Sensitive.*Forbidden' README.md && grep -qE 'approval flow|approval prompt' README.md && grep -qE 'Bash whitelist|whitelist jail' README.md && grep -qE 'no to all|backward compat|suggest-only' README.md && [ "$(grep -cE '17 specialized|17 AI agents' README.md)" = "$(git show HEAD:README.md | grep -cE '17 specialized|17 AI agents')" ] && [ "$(grep -cE '18 specialized|18 AI agents|11 gates|11 quality gates' README.md)" -eq 0 ]`
- **Done when:** All 4 feature points documented; counts unchanged
- **Pre-review:** none
- **Satisfies AC:** AC-14, AC-15

### Slice 8: templates/CLAUDE.md `Resource preferences:` placeholder (OPTIONAL)
- **Wave:** 1
- **Use cases:** UC-13, UC-14
- **Files:** `templates/CLAUDE.md`
- **Changes:**
  - Add optional `Resource preferences:` field with HTML comment marking dead-metadata reserved for iter-3
  - Permitted informal subset values: `deny-Moderate`, `deny-Sensitive`, `deny-MCP-installs`
  - State OPTIONAL — projects omitting receive iter-2 default behavior
- **Verify:** `grep -qE '^- \\*\\*Resource preferences:|^Resource preferences:' templates/CLAUDE.md && grep -qE 'iter-3|reserved for.*future|dead metadata' templates/CLAUDE.md && grep -qE 'OPTIONAL|optional' templates/CLAUDE.md && grep -qE 'deny-Moderate|deny-Sensitive|deny-MCP' templates/CLAUDE.md`
- **Done when:** Field present; OPTIONAL marker; iter-3 reservation noted
- **Pre-review:** none
- **Satisfies AC:** AC-16

## Acceptance criteria (20/20)
- AC-1: Slices 1+2+3
- AC-2: Slice 1
- AC-3: Slice 2
- AC-4: Slice 1
- AC-5: Slices 2+3
- AC-6: Slice 3
- AC-7: Slices 2+3+4
- AC-8: Slices 1+3
- AC-9: Slice 3
- AC-10: Slice 4
- AC-11: Slice 5
- AC-12: Slice 4
- AC-13: Slice 6
- AC-14: Slices 6+7
- AC-15: Slice 7
- AC-16: Slice 8
- AC-17: Slice 6
- AC-18: Slices 4+5
- AC-19: Slice 3
- AC-20: Slice 2

## Files to modify (no new files)
- `src/agents/resource-architect.md` — Slices 1, 2, 3 (sequential)
- `src/commands/bootstrap-feature.md` — Slice 4
- `src/agents/planner.md` — Slice 5
- `src/claude.md` — Slice 6
- `README.md` — Slice 7
- `templates/CLAUDE.md` — Slice 8

`install.sh` is NOT modified.

## Wave assignment

| Wave | Slices | Rationale |
|------|--------|-----------|
| 1 | 1, 4, 5, 6, 7, 8 | 6 disjoint files; full parallel; Slice 4 references PRD-pinned contracts (file/section names) not Slice 1 content |
| 2 | 2 | Appends to Slice 1's file — sequential |
| 3 | 3 | Appends to Slice 2's file — sequential |

**Wave 1 file disjointness verified:** `src/agents/resource-architect.md` (Slice 1) ∩ `src/commands/bootstrap-feature.md` (Slice 4) ∩ `src/agents/planner.md` (Slice 5) ∩ `src/claude.md` (Slice 6) ∩ `README.md` (Slice 7) ∩ `templates/CLAUDE.md` (Slice 8) = ∅

## Risk assessment

- Data sensitivity: low (no PII; user-local env mutations only)
- Auth impact: none directly; Sensitive escalates to user (Rule 4)
- Persistence: new section `## Auto-Install Results` in `.claude/resources-pending.md`; planner inlines into `.claude/plan.md`
- External calls: only whitelisted package-manager installs; no curl/wget/ssh/http
- Defense-in-depth: 3 layers — tools allowlist + anchored whitelist regex + redundant deny-list
- Idempotency: detect-then-install pattern; re-run skips installed
- Rollback: per-slice atomic commits

## Dependencies

- Section 4 (iter-1) — SHIPPED; iter-2 EXTENDS, does not replace
- Section 1 FR-2 (Deviation Rules) — SHIPPED; Rule 4 used for Sensitive
- Section 6 (release-engineer) — SHIPPED; agent count baseline 17 preserved
- No new libraries

## Return summary

- **Slice count:** 8
- **Waves:** 3 (6+1+1)
- **[STRUCTURAL] decisions:** 5 pinned
- **AC coverage:** 20/20
- **Coverage gaps:** none

---

## Review Notes

### Critic Findings
- **Total:** 12 findings (1 CRITICAL, 7 MAJOR, 4 MINOR)
- **All CRITICAL/MAJOR addressed:** Yes

### Changes Made

**CRITICAL — Slice 1 grep -cE counts lines not matches:** Fixed via `grep -oE '"(Read|Write|Bash|Glob|Grep)"' | sort -u | wc -l` for unique-match counting.

**MAJOR — Slice 1 line-range Done-when:** Replaced with content-anchored greps.

**MAJOR — Slice 2 deny-list spot-check:** Replaced with for-loop over all 24 prefixes; missing any → exit 1.

**MAJOR — Slice 3 status-string line count:** Replaced with for-loop over 10 status strings.

**MAJOR — Slice 4 whitelist-halt weak match:** Tightened pattern requires "halt"+"violation" semantic together.

**MAJOR — Slice 4 anti-renumber incomplete:** Added `grep -cE '^### Step 3\.5(:| )' = 1` to ensure exactly one Step 3.5 remains.

**MAJOR — install.sh zero-drift not verified:** Added `git diff --exit-code install.sh` to Slice 4 Verify.

### Acknowledged Minor Issues

**MINOR — Slice 8 OPTIONAL marker:** Per PRD AC-16; preserved for traceability.

**MINOR — NFR-8 60s soft target not tested:** No hard cap; acceptance via runtime per PRD.

**MINOR — Slice 1 banned-tools `-q` mute:** `grep -qE` is presence-only; no fix needed.

**MINOR — Slice 6 baseline timing:** Simplified to negative-grep-only approach.
