## Feature: Cognitive Self-Check Protocol — Fact/Assumption Discipline for Thinking Agents
## Branch: feat/cognitive-self-check
## Status: MERGE READY (10 gates clear; Step 11 refused — branch not yet merged into main, expected)

## Plan

### Wave 1 [COMPLETE]
- [x] Slice 1: Create `src/rules/cognitive-self-check.md` with 6 `##` headings, 4 `###` Facts subsections, 12 in-scope + 5 exempt agents, MERGE_DATE placeholder, bilingual 4-question protocol — 16df3b1

### Wave 2 [COMPLETE]
- [x] Slice 2: Doc-writing agents — prd-writer, ba-analyst, qa-planner, planner — e7ab0de
- [x] Slice 3: Stdout reviewer agents — architect, security-auditor, code-reviewer, verifier (with `Emit a \`## Facts\` block to stdout BEFORE your verdict/PASS-FAIL report` literal) — a942899
- [x] Slice 4: Specialized + refactor-cleaner — resource-architect, role-planner, release-engineer, refactor-cleaner — a159f9f

Wave 2 integrity confirmed: 12 thinking agents have `## Cognitive Self-Check (MANDATORY)` section; 5 executors (test-writer, build-runner, e2e-runner, doc-updater, changelog-writer) do NOT (TC-CC-2 PASS).

### Wave 3 [COMPLETE]
- [x] Slice 5: Plan Critic — TWO new `> -` Completeness bullets in `src/claude.md` (lines 120-121) between `**Completeness:**` and `**Slice Quality:**`, plus file-vs-stdout preamble sentence (line 107) — 8242896
- [x] Slice 6: README — Hardening table row (line 158) + new `## Cognitive self-check at authoring time` section (lines 269-282) — 42c34ed

End-to-end verification (TC-CC-1 through TC-CC-11): ALL PASS.
- TC-CC-1: rule file 6 sections (fence-aware), 4 ### subsections, "I remember..." 2x, MERGE_DATE 7x
- TC-CC-2: 12 thinking agents have section, 5 executors have 0
- TC-CC-3: file-vs-stdout preamble present in src/claude.md
- TC-CC-5/6: 2 new bullets in Completeness window, 6 MAJOR/MINOR mentions, 0 ### headings
- TC-CC-7: README new row + new section + rule path 2x
- TC-CC-8/9: 17-agent tagline byte-unchanged, "10 quality gates" appears 3x (line 35, 127, 137)
- TC-CC-10/11: install.sh, templates/rules/, templates/CLAUDE.md, 5 executors — zero diff vs main
- Agency Roles table at src/claude.md lines 11-29 — byte-unchanged (only diff hunks at 104 and 117 from Slice 5)

## Bootstrap artifacts produced
- PRD §9 (lines 2082–2333) — 7 numbered subsections (9.1–9.7), 7 FRs, 8 NFRs, 20 ACs, 17 risks/deps
- `docs/use-cases/cognitive-self-check_use_cases.md` — 16 primary UCs + 12 cross-cutting UC-CCs
- `docs/qa/cognitive-self-check_test_cases.md` — 110 TCs (per-UC + cross-cutting acceptance)
- Architect verdict: PASS (3 MINOR refinements inlined in Slices 1, 5; zero [STRUCTURAL] items; zero security pre-review)
- `.claude/resources-pending.md` — produced and consumed (zero recommendations); deleted
- `.claude/roles-pending.md` — produced and consumed ("No additional roles required."); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core repo opts out)

## Architect [STRUCTURAL] decisions
None. Three MINOR refinements applied inline:
1. Plan Critic new bullets use literal `> - The …` / `> - Any …` lexical shape
2. Rule file `## Backward Compatibility` includes MERGE_DATE placeholder convention
3. Slice 5 Verify check (c) defensively confirms new bullets have no `^### ` headings

## Invariants (load-bearing)
- 17 core agents — UNCHANGED (no new agents)
- 10 quality gates — UNCHANGED (no new gates)
- `install.sh` — BYTE-UNCHANGED (rule auto-distributes via existing copy logic)
- `templates/rules/` — BYTE-UNCHANGED (rule is global, not project-specific)
- `templates/CLAUDE.md` — BYTE-UNCHANGED
- 5 executor agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) — NOT MODIFIED
- Agency Roles table at `src/claude.md` lines 11–29 — BYTE-UNCHANGED
- README taglines `17 specialized AI agents` (line 5) and `10 quality gates` (line 35) — BYTE-UNCHANGED

## Completed
- Bootstrap pipeline (Steps 1, 2, 3, 3.5, 3.75, 4, 5, 5.5) — bootstrap commit 1364595
- Wave 1 Slice 1 — rule file 16df3b1
- Wave 2 Slices 2/3/4 — parallel: e7ab0de + a942899 + a159f9f
- Wave 3 Slices 5/6 — parallel: 8242896 + 42c34ed
- Phase 2.5 cleanup — 098786e (refactor-cleaner harmonization)
- Phase 3 /merge-ready — 4 fix commits driven by Gate 2 BEFORE/AFTER drift sweep (874119a, 7429824, b6cfaec, 71826a0) + 1 fix commit driven by Gate 7 gate-number drift (e16d31a)
- Quality gates verdict:
  - Gate 0 Git Hygiene: PASS
  - Gate 1 Documentation Completeness: PASS
  - Gate 2 Code Review: PASS (after 4 fix attempts to clean up cascading documentation drift)
  - Gate 3 Security Audit: PASS (zero vulns; markdown-only feature)
  - Gate 4 Build Verification: N/A (markdown-only)
  - Gate 5 E2E Tests: N/A (no UI/runtime)
  - Gate 6 Goal-Backward Verification: PASS (all 4 levels)
  - Gate 7 Documentation Accuracy: PASS (after gate-number fix)
  - Gate 8 UI/UX: N/A (no UI)
  - Gate 9 Release Packaging: SKIPPED (SDLC core opts out of CHANGELOG automation)
- Step 11 On-Demand Role Teardown: REFUSED (branch not yet merged into main; FR-4.1 refusal; counts N=0, M=0, K=0; not a merge blocker)

## Blockers
(none)
