## Feature: Auto-Release Pipeline (iter-3)
## Branch: feat/auto-release
## Status: implementing wave 1 slice 1/7

## Plan

### Wave 1 (sequential — release-engineer prompt + bash whitelist)
- [ ] Slice 1: release-engineer executing-mode flip + 4-tier authority + bash whitelist + tag-scheme disambiguation
  - Files: src/agents/release-engineer.md
  - Pre-review: architect + security-auditor
  - Inlines architect action items #1 (tag-scheme disambiguation), #2 (FR-12.7 templates wording), #4 (Bash already present in tools — extend authority not add tool)

### Wave 2 (sequential — install.sh foundation)
- [ ] Slice 2: install.sh REPO_URL fix (Koroqe → codefather-labs) + Windows uname branch + version bump 2.1.0 → 3.0.0
  - Files: install.sh
  - Pre-review: security-auditor (URL change migration risk + Windows path detection safety)

### Wave 3 (parallel — workflows; disjoint files)
- [ ] Slice 3: extend sdlc-knowledge-release.yml — windows-x64 matrix + alternation find -o operator + source tarball
  - Files: .github/workflows/sdlc-knowledge-release.yml
  - Pre-review: none (CI-only)
  - Inlines architect action item #3 (find -o syntax)
- [ ] Slice 4: new sdlc-core-release.yml — triggers on bare v* tag, uploads source + CHANGELOG body
  - Files: .github/workflows/sdlc-core-release.yml [new]
  - Pre-review: security-auditor (workflow permissions + tag pattern disjoint from sdlc-knowledge-v*)

### Wave 4 (sequential — opt-in + bootstrap; both touch install.sh)
- [ ] Slice 5: SDLC core opt-in — auto-release rule + changelog sentinel + CHANGELOG.md + templates auto-release rule + pre-push hook template
  - Files: .claude/rules/auto-release.md [new], .claude/rules/changelog.md [new copy of templates/rules/changelog.md], CHANGELOG.md [new at repo root], templates/rules/auto-release.md [new], templates/hooks/pre-push [new], install.sh (scaffold_project extension)
  - Pre-review: architect (templates UNCHANGED scope clarification per action item #2)
- [ ] Slice 6: install.sh --bootstrap-release flag for FIRST sdlc-knowledge-v0.2.0 tag + register_release_bash_allowlist
  - Files: install.sh
  - Pre-review: security-auditor (destructive: pushes tag to origin)

### Wave 5 (sequential — docs)
- [ ] Slice 7: Documentation — README + RELEASING.md + MIGRATION.md + CHANGELOG body refinement
  - Files: README.md, tools/sdlc-knowledge/RELEASING.md, MIGRATION.md [new], CHANGELOG.md (body refinement)
  - Pre-review: none

## Bootstrap artifacts produced
- PRD §13 (lines 2974-3459) — 12 FRs, 9 NFRs, 13 ACs, 10 risks, 8 out-of-scope items, 13-row affected-files table
- `docs/use-cases/auto-release_use_cases.md` — 1510 lines, 17 primary UCs + 6 cross-cutting + 11 alt + 13 error + 12 edge = 59 scenarios
- `docs/qa/auto-release_test_cases.md` — 1447 lines, 78 TCs (incl. 5 TC-AAI architect action items + 10 TC-INV invariants + 5 TC-CP cross-platform + 16 TC-SEC across 4 security pre-review groups)
- Architect verdict: PASS, 3 [STRUCTURAL] + 1 MAJOR + 1 MINOR action items inlined into Slices 1, 3, 5; security-auditor pre-review on Slices 1, 2, 4, 6
- `.claude/resources-pending.md` — produced and consumed (zero recommendations); deleted
- `.claude/roles-pending.md` — produced and consumed (zero additional roles); deleted
- changelog-writer Step 5.5 — `no-op: not configured` (SDLC core opts out for now; FR-7 of this feature will flip)

## Knowledge-base scope verdict
**No overlap.** Corpus is ML/AI/MLOps/SRE/AI-agents domain (28 books, 51542 chunks). Iter-3 task is CI/CD release engineering — not represented in corpus. Per `~/.claude/rules/knowledge-base-tool.md` Step 0c: SKIPPED topical query phase, logged single Open Question entry per Step 0d. Verdict documented in plan.md and PRD §13 Facts blocks.

Note: corpus-scope-relevance protocol was added to the rule MID-bootstrap (commit b8d7116), then specific examples removed (commit c8438a1). Earlier bootstrap steps (PRD/use-cases/QA) ran BEFORE the rule update and accumulated some null-result Open Questions; the planner Step 5 ran AFTER and correctly applied No-overlap verdict from the start.

## Architect action items inlined into slices
1. **[STRUCTURAL] tag-scheme disambiguation** → Slice 1 (release-engineer.md Step 5 decision tree: tools/sdlc-knowledge/* changed → sdlc-knowledge-v* scheme; otherwise → bare v*; both → explicit user prompt)
2. **[STRUCTURAL] FR-12.7 templates wording** → Slice 1 + Slice 5 (invariant scope = `templates/rules/*` byte-unchanged source-of-truth files; SDLC core's own `.claude/rules/changelog.md` and `.claude/rules/auto-release.md` are NEW files at repo root, NOT modifications of templates)
3. **[STRUCTURAL] find -o syntax** → Slice 3 (`find /tmp/pdfium-staging -maxdepth 3 \( -name 'libpdfium*' -o -name 'pdfium*' \) -type f` with explicit alternation grouping)
4. **[MAJOR] FR-1.1 Bash already present** → Slice 1 description reconciliation (release-engineer.md:4 already has Bash in tools; iter-3 extends authority via tier dispatch, doesn't add the tool)
5. **[MINOR] KB corpus is ML-domain** → tracked under Open questions; iter-4 candidate for adding GitHub Actions / pdfium / Cargo Windows reference docs to corpus

## Phase 1.5 security pre-review needed (4 slices)
- Slice 1: release-engineer executing-mode + bash whitelist (anchored regex correctness, metacharacter rejection, tier table coverage, no default-allow)
- Slice 2: install.sh REPO_URL change + Windows uname branch (URL hardcoding, redirect bounds, path injection via uname output)
- Slice 4: sdlc-core-release.yml workflow (tag pattern disjoint from sdlc-knowledge-v*, permissions: contents: write scoped, actionlint self-check)
- Slice 6: install.sh --bootstrap-release (one-shot opt-in flag, prompts before push, pre-conditions enforced, [BOOTSTRAP] warning on stderr)

## Invariants (load-bearing — preserved/intentionally relaxed per FR-12)
- 17 core agents — UNCHANGED (FR-12.1)
- 10 quality gates — UNCHANGED (FR-12.2)
- 5 executor agents — BYTE-UNCHANGED (FR-12.3)
- README taglines lines 5 + 35 — BYTE-UNCHANGED
- `templates/rules/{architecture,security,testing,changelog}.md` — BYTE-UNCHANGED (NEW: `templates/rules/auto-release.md` is added — additive, not modification)
- `src/rules/cognitive-self-check.md` — BYTE-UNCHANGED
- `src/rules/knowledge-base.md` — BYTE-UNCHANGED
- `src/rules/knowledge-base-tool.md` — recently updated (multilingual + corpus-scope-relevance + generalization), NOT changed by this feature
- `install.sh` line 22 `VERSION="2.1.0"` — CHANGED to `3.0.0` in iter-3 (FR-7 SDLC core opt-in version major bump per dogfood)
- 12 thinking-agent activation blocks — BYTE-UNCHANGED
- CLI surface of sdlc-knowledge — UNCHANGED (no new subcommands)

## Out of scope iter-3
- npm/cargo/PyPI publishing (Forbidden tier; iter-4)
- sha256/sigstore signature verification of release binaries (iter-4)
- linux-arm32 / musl-libc / FreeBSD targets (iter-4)
- CHANGELOG i18n auto-translation (out of scope permanently)
- Auto-revert on regression detection (iter-4 — needs metrics infra)
- GitHub Releases body rich rendering beyond plain Keep-a-Changelog markdown
- Gate 9 changing its number/position in /merge-ready
- Pre-push hook in opt-out projects (only opt-in via .claude/rules/auto-release.md sentinel)

## Completed
(none — implementation pending)

## Blockers
(none)
