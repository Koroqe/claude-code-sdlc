## Feature: Local Knowledge Base for SDLC Agents (CLI-only, no MCP)
## Branch: feat/local-knowledge-base
## Status: implementing wave 1 slice 1/8

## Plan

### Wave 1
- [ ] Slice 1: Rust crate skeleton + clap CLI scaffold + path-canonicalization safety — UC-1, UC-CC-1; TC-1.x, TC-AAI-3, TC-INV-*
  - Files: tools/sdlc-knowledge/{Cargo.toml, src/main.rs, src/cli.rs}, tests/{cli_help_test.rs, path_safety_test.rs}
  - Pre-review: security-auditor (path canonicalization is the security backbone)

### Wave 2
- [ ] Slice 2: Chunker + MD/TXT/PDF readers + ingest command + per-document transactionality — UC-5/6/9/10; TC-5.x, TC-AAI-4
  - Files: tools/sdlc-knowledge/src/{ingest.rs, text.rs, pdf.rs, store.rs, migrations.rs}, Edit src/main.rs, tests/{ingest,store,cli_ingest_e2e}_test.rs, fixtures/sample.{md,pdf}
  - Pre-review: architect + security-auditor (PDF crate + ingest transactionality)

### Wave 3
- [ ] Slice 3: Search + list/status/delete + JSON output + corrupt-index handling + BM25 score-direction convention — UC-7/8; TC-7.x, TC-AAI-2
  - Files: tools/sdlc-knowledge/src/{search.rs, output.rs}, Edit {main.rs, store.rs}, tests/{search,cli_search_e2e,corrupt_index}_test.rs

### Wave 4 (parallel — disjoint files)
- [ ] Slice 4: Cross-platform release pipeline (GitHub Actions) + RELEASING.md — UC-CC-1, UC-CC-5
  - Files: .github/workflows/sdlc-knowledge-release.yml, tools/sdlc-knowledge/RELEASING.md
- [ ] Slice 5: install.sh integration — binary download + Bash allowlist + project scaffold + cargo source-build fallback — UC-1/2/3/4/15; TC-1.x, TC-AAI-1
  - Files: install.sh, templates/knowledge/{.gitignore, .gitkeep}
  - Pre-review: security-auditor (allowlist scope, JSON-merge safety)
- [ ] Slice 6: New rule `src/rules/knowledge-base.md` — CLI usage docs + pdf-extract limitations — UC-11/12/13/14; TC-AAI-5
  - Files: src/rules/knowledge-base.md
  - Pre-review: architect (rule wording stability)

### Wave 5 (parallel — disjoint files)
- [ ] Slice 7a: Doc-writing thinking agents — append `## Knowledge Base (when present)` activation block — UC-11
  - Files: src/agents/{prd-writer, ba-analyst, qa-planner, planner}.md
- [ ] Slice 7b: Stdout reviewer thinking agents — append activation block — UC-11
  - Files: src/agents/{architect, security-auditor, code-reviewer, verifier}.md
- [ ] Slice 7c: Specialized + refactor-cleaner thinking agents — append activation block — UC-11
  - Files: src/agents/{resource-architect, role-planner, release-engineer, refactor-cleaner}.md
- [ ] Slice 8: `/knowledge-ingest` slash command + README updates — UC-5, UC-CC-2/3
  - Files: src/commands/knowledge-ingest.md [new], README.md

## Bootstrap artifacts produced
- PRD §11 (lines 2337+) — 12 FR-groups / 51 sub-clauses, 10 NFRs, 13 ACs (AC-1..AC-13), 17 risks/deps, 8 out-of-scope items
- `docs/use-cases/local-knowledge-base_use_cases.md` — 15 primary UCs + variants + 5 cross-cutting UCs (1660 lines)
- `docs/qa/local-knowledge-base_test_cases.md` — 117 TCs (88 per-UC + 7 invariant + 5 architect-action-item + 4 cross-platform + 3 cross-cutting; 2350 lines)
- Architect verdict: PASS, 0 [STRUCTURAL] items, 5 inline action items inlined into Slice 1/2/3/5/6 done-conditions; security-auditor pre-review on Slices 1, 2, 5
- `.claude/resources-pending.md` — produced and consumed (zero recommendations); deleted
- `.claude/roles-pending.md` — produced and consumed (zero additional roles); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core repo opts out)

## Architect [STRUCTURAL] decisions
None. 5 MINOR refinements applied inline to plan slices:
1. install.sh ordering — Slice 5 done-condition: re-invoke `get_source_dir` per line-247 pattern
2. `register_bash_allowlist` missing-file case — Slice 5: creates `~/.claude/settings.json` with literal minimal JSON; idempotent merge if present
3. BM25 score-direction — Slice 3: `SELECT -bm25(chunks_fts) AS score ... ORDER BY score DESC` (JSON `score` positive, larger=better)
4. Slice 1 pre-review UPGRADED `none → security-auditor` (path canonicalization)
5. Slice 2 pre-review UPGRADED `architect → architect + security-auditor` (PDF crate + ingest transactionality)
6. Slice 6 rule documents pdf-extract limitations (scanned/multi-column/form fields) — TC-AAI-5

## Open Questions resolved at architect Step 3
- OQ#1 — PDF crate: `pdf-extract` for iter-1 (`lopdf` documented fallback)
- OQ#2 — release-engineer Gate 9 coupling: out-of-scope iter-1 (manual maintainer first-tag bootstrap per RELEASING.md)
- OQ#3 — resource-architect auto-recommendation: out-of-scope iter-1
- OQ#4 — per-project sources/ gitignored by default: yes (templates/knowledge/.gitignore)
- OQ#5 — rusqlite + FTS5 syntax: shape approved; literal SQL verified at Slice 3 first `cargo test`

## Invariants (load-bearing)
- 17 core agents — UNCHANGED (FR-12.1)
- 10 quality gates — UNCHANGED (FR-12.2)
- 5 executor agents (test-writer, build-runner, e2e-runner, doc-updater, changelog-writer) — BYTE-UNCHANGED (FR-12.3)
- README taglines `17 specialized AI agents` (line 5) and `10 quality gates` (line 35) — BYTE-UNCHANGED (AC-11)
- `templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/*` — BYTE-UNCHANGED (only ADDITION is `templates/knowledge/`)
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED (citation source `knowledge-base:` is additive convention) (FR-12.5)
- `src/claude.md` Plan Critic — UNCHANGED (existing `### External contracts` heuristic covers `knowledge-base:` source format)
- release-engineer Gate 9 itself — UNCHANGED iter-1
- Commands count: 5 → 6 (per AC-12, FR-6.4)

## Out of scope iter-1
- Vector embeddings (sqlite-vec hybrid) — iter-2
- MCP server interface — iter-2
- resource-architect auto-recommendation — iter-2 PRD
- Windows binary builds — iter-2 (only darwin-arm64/x64, linux-x64/arm64)
- Automated coupling between SDLC release-engineer and binary release pipeline

## Completed
- Bootstrap pipeline (Steps 1, 2, 3, 3.5, 3.75, 4, 5, 5.5) — bootstrap commit pending

## Blockers
(none)
