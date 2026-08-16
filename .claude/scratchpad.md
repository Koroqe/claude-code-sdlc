## Feature: Adaptive Tier Routing and Model Routing (v4.0 roadmap F4)
## Branch: feat/adaptive-tier-routing
## Status: bootstrapped — plan ready, plan-critic pass NOT yet run, no slice implemented

## Docs (all committed)

- PRD `docs/PRD.md` §10 (lines ~1910–2225) — FR-1..FR-13, AC-1..AC-31
- Use cases `docs/use-cases/adaptive-tier-routing_use_cases.md` — UC-1..UC-18
- QA `docs/qa/adaptive-tier-routing_test_cases.md` — 100 TCs (47 STATIC / 10 FIXTURE / 43 BEHAVIORAL)
- Architecture: **PASS on retry 2 of 2** (first two attempts FAILed)

## Binding constraints C1–C6 — do NOT re-open

- **C1** `## Tier: quick`→`full` rewrite is the **first tool call** after the escalation trigger,
  before `/bootstrap-feature` or any gate/agent call. `bootstrap-feature` Step 7 affirmatively writes
  `## Tier:` on every scratchpad init so the field is owned, never inherited stale.
- **C2** `skills/sdlc-fast/SKILL.md` `allowed-tools` **MUST include `Agent`**. No-subagent is
  instruction-enforced. Tightening this re-creates a dead-end — the mandated escalation needs
  `planner`/`test-writer`/`build-runner`.
- **C3** Quick-tier absence carve-outs live in **delegation prompts, verbatim, before the request**.
  `agents/code-reviewer.md` and `agents/test-writer.md` are **NOT modified**.
- **C4** Quick tier passes the literal `no-changelog` token; `/merge-ready` Finalization owns the
  single write. Exactly one entry (two would slip past the idempotency guard — names differ).
- **C5** FR-1.7 sensitive paths are **union**: the fixed default is always active, a project's
  declaration is additive only and structurally cannot narrow it.
- **C6** `install.sh` rewrite idiom: awk fence-bounded substitution, **same-directory** `mktemp`,
  per-file exactly-one-substitution assertion, two-phase preflight-then-commit across all 14 files
  (preflight failure → **zero** files modified), receipt only after all 14 commit. Never `sed -i`,
  never `node`/`jq` (CI greps).

## Plan (9 slices, 4 waves)

### Wave 1
- [ ] **Slice 1 — Tracer: yes** — Triage Phase 0 + fast-tier execution + sensitive-path union
  - Files: `skills/develop-feature/SKILL.md`, `src/claude.md`, `templates/rules/security.md`
  - FR-1, FR-3, FR-5, FR-1.7 · AC-1, AC-2, AC-31 · Pre-review: **security (MANDATORY)**
  - Tracer rationale: triage→fast is the only tier whose whole path needs no other F4 file

### Wave 2 (3 slices, file-disjoint)
- [ ] Slice 2 — escalation mechanics + scratchpad tier ownership (FR-2, FR-12.5)
  - Files: `skills/develop-feature/SKILL.md`, `skills/bootstrap-feature/SKILL.md`
  - Pre-review: **security (MANDATORY)**. Must reuse Step 7's archive-preserving init (see Finding 2)
- [ ] Slice 3 — planner Quick-Tier Contract + implement-slice tier awareness (FR-4.1/4.4/4.5, FR-12.3/12.4)
  - Files: `agents/planner.md`, `skills/implement-slice/SKILL.md`
- [ ] Slice 4 — merge-ready Tier Check preamble + gate carve-outs + `Gates: N/9` + digest write
  - Files: `skills/merge-ready/SKILL.md`, `docs/digest-index.md` [new] · Pre-review: security (RECOMMENDED)

### Wave 3 (3 slices)
- [ ] Slice 5 — `/sdlc-fast` + `/sdlc-quick` override skills + Pipeline Commands (FR-6)
  - Files: `skills/sdlc-fast/SKILL.md` [new], `skills/sdlc-quick/SKILL.md` [new], `src/claude.md`
- [ ] Slice 6 — `effort:` on all 14 agents + validator support (FR-11) — split must be exactly 3/6/5
  - Files: all `agents/*.md`, `scripts/ci/validate-agents.js`, 2 new bad-effort fixtures
- [ ] Slice 7 — `install.sh --profile` two-phase rewrite + receipt + dry-run + spike + README (FR-7/8/9)
  - Files: `install.sh`, `README.md` · Pre-review: **security (MANDATORY)**
  - **Step 0 = FR-7.6 spike**: does a running session re-read agent frontmatter or snapshot it?

### Wave 4 (2 slices)
- [ ] Slice 8 — CI drift check: shared table, validator, 5 fixtures, CI wiring (FR-10)
  - Files: `scripts/ci/lib/model-profiles.js` [new], `scripts/ci/validate-model-profile.js` [new],
    `tests/fixtures/ci/model-profile/**` [new], `.github/workflows/ci.yml`
- [ ] Slice 9 — statusline: spike, renderer, template wiring, scaffold copy (FR-13)
  - Files: `templates/statusline.js` [new], `templates/settings.json`, `install.sh`, fixtures
  - **Step 0 = FR-13.4 spike**: capture real statusline stdin JSON field names

`install.sh` is in Waves 3 and 4 deliberately (two independent concerns, different waves).
`src/claude.md` Waves 1+3 · `agents/planner.md` Waves 2+3 · `develop-feature` Waves 1+2 — all cross-wave.

## Planner findings still open (hand to plan-critic / Gate 7)

1. **The drift check cannot protect upstream policy, only internal consistency.** `.sdlc-model-profile`
   is never committed, so CI always resolves `quality`. A contributor committing both a rewritten
   `agents/` tree AND a matching receipt produces a tree the validator **approves** — the exact drift
   class F4 exists to catch, CI-blessed. Fix: gitignore the receipt, and/or fail when a non-`quality`
   receipt appears in CI.
2. **FR-2.3(c)/FR-2.4(c) vs the shipped `pre:write:shrink-guard`** — a truncating scratchpad rewrite
   during escalation can be denied mid-escalation, dead-ending the thing NFR-1(b) forbids from
   dead-ending. Slice 2 mandates archive-preserving init; the PRD should say so.
3. FR-13.3 has no specced outcome if the spike finds **no** token-usage fields at all (FR-13.4 covers
   only a missing autocompact reserve). Slice 9 renders without the bar and records it.
4. FR-7.1's mutual-exclusivity list omits `--trust-project`. Slice 7 refuses it by analogy.
5. F3's fixture-manifest discipline does not extend to F4 — `validate-fixture-manifest.js` hardcodes
   the F3 QA doc, so F4's 10 FIXTURE cases have no existence check.
6. `SKIPPED (tier: quick)` must not collide with Gate 5/8's existing conditional status wording.

## Next steps

1. **Run the plan-critic pass** on this plan (mandatory, not yet done)
2. Implement Wave 1 (tracer) → Waves 2/3/4 in parallel per wave
3. `/merge-ready` → changelog → merge → push → verify CI
4. Then **F5** (self-improvement loop; requires PRD §4 revision), then the global reinstall

## Blockers

- none

## Completed

- F1 (§6) 6e0c55e · F2a (§7) cbe586d · F2b (§8) 9cffb22 · F3 (§9) 2c7272d · defect fixes 19b29ce
- All pushed, GitHub CI green (4 jobs, asset job 39 steps)
- F4 docs committed: 449aef4→fa0e3a2 range on this branch
