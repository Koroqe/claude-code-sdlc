## Feature: Verification & Review Upgrade (v4.0 roadmap F3)
## Branch: feat/verification-review-upgrade
## Status: implementing wave 3 slice 7/11

## Docs

- PRD: `docs/PRD.md` §9 — FR-1..FR-11, NFR-1..NFR-6, AC-1..AC-24
- Use cases: `docs/use-cases/verification-review-upgrade_use_cases.md` (UC-1..UC-10, re-synced post-review)
- QA: `docs/qa/verification-review-upgrade_test_cases.md` — 98 TCs (24 STATIC / 52 FIXTURE / 22 BEHAVIORAL)
- Architecture: **PASS with binding corrections** (PRD §9.10.13)
- Plan critic: 17 findings (2 CRITICAL, 8 MAJOR, 7 MINOR) — all addressed in plan rev. 2
- Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F3 of F1–F5)

## Deliverables checklist

- [x] PRD §9 · [x] Use cases · [x] Architecture review · [x] QA test cases
- [ ] CHANGELOG.md entry — written once by `/merge-ready` finalization (no slice writes it)

## Binding rulings — do not re-litigate

- `verifier`: `tools:` exactly `["Read","Glob","Grep","Write"]`. **No `Edit`, no `Bash`.**
  Constraints deny-by-default: "MUST NOT Write to any path other than `docs/verification/<slug>.md`".
- `verifier` has no clock. **Gate 6 runs `date -u`** and passes timestamp + slug verbatim.
  No timestamp supplied → omit `generated_at`, write `generated_at_note`. Never invent one.
- `planner` stays **read-only** — it *returns* replan slices; the **orchestrator** appends,
  append-only, pre-existing slices byte-identical.
- Disjointness check is **orchestrator prose**, not a script (NFR-5). Always case-insensitive.
- Tracer gate must fail **visibly** when no `**Tracer:** yes` marker — silent gate-vanish is the
  anti-pattern §8 forbids.
- Gate 6 attempt counter persisted **in this file**, read back from disk, not conversation memory.
- NFR-5's markdown-only rule governs the agent/skill/memory layer only. `scripts/ci/` is the
  fail-closed CI zone where zero-dependency Node is expected (§7 three-zone rule).

## MUST NOT TOUCH (historical facts — changing them breaks the installer)

- `README.md` line 280 — "the 13 agent files … older versions installed" (FR-5.11 exception)
- `manifests/owned-files.txt` lines 32/36 + 37–49 — v3.x **removal** manifest. Adding `plan-critic`
  makes the installer delete a file v3.x never installed; changing "13" is historically false.

## Self-application (F3 upgrades the harness mid-run)

Slice 6 rewrites `skills/develop-feature/SKILL.md` — the procedure dispatching this very run. Safe
under both re-read behaviours: the plan carries a literal `**Tracer:** yes` on Slice 1 (Wave 1
alone), so by the time any new gate could enforce (Wave 3+) the tracer has passed; every multi-slice
wave has a literal disjoint `Files (union)`; Waves 4–5 are single-slice (exempt).

## Plan (11 slices, 5 waves) — 11 is a declared exception to 5–9, see plan rev. 2 §3

### Wave 1 [complete]
- [x] Slice 1 — **Tracer: yes** — four-verdict verifier + machine-readable report — 91c0e9a
  - Files: `agents/verifier.md`, `skills/merge-ready/SKILL.md`,
    `tests/fixtures/agents/verifier/present-unverified/` [new]
  - Changes: FR-1.1/1.2 (incl. **L4-`SKIPPED`→UNCERTAIN** pin), FR-1.3–1.5, FR-2.1–2.7,
    FR-3.1/3.2, FR-10.4. Gate 6 runs `date -u`, states slug+timestamp verbatim.
  - Verify: static greps **plus a real tracer run** — invoke `verifier` on the fixture, assert
    `docs/verification/present-unverified.md` has `verdict: PRESENT_BEHAVIOR_UNVERIFIED`,
    `passed: false`, a four-field `gaps` entry, non-empty `human_verification_required`,
    `generated_at` byte-equal to the supplied `$TS`; then Gate 6 read → `NOT MERGE READY`
  - Done when: AC-14, AC-15, AC-1 (mechanical), AC-21 (textual); tracer run passed
  - Pre-review: **security** (first-ever verifier write grant)

### Wave 2 [complete]
- [x] Slice 2 — Level 2 anti-pattern severity split + verifier fixture corpus — c7e22c8
  - Files: `agents/verifier.md`, `tests/fixtures/agents/verifier/{exercised,failed-missing-file,no-plan,dynamic-import,l4-skipped,failed-plus-uncertain,markers,composite}/` [new]
  - Changes: FR-4.1 marker→tier table, FR-4.2 same-line issue ref, FR-4.3 new PASS/FAIL,
    FR-4.4 `pass  # TODO` checked **before** bare-`TODO`, FR-4.5
  - Verify: greps for `TBD`, `pass  # TODO`, BLOCKER/WARNING, "issue reference", "same line";
    all 8 fixture dirs exist; `validate-agents.js`
  - Done when: TC-4.19 in full; AC-11, AC-12 fixture inputs committed · Pre-review: none
- [x] Slice 3 — Gate 6 malformed-report handling, `--gaps` loop, attempt counter — 27a89fc
  - Files: `skills/merge-ready/SKILL.md`
  - Changes: FR-3.3 exact Status string, NFR-3 no-`verdict:`→UNCERTAIN, FR-10.1–10.3
    (planner returns / orchestrator appends, AC-2's three conditions verbatim), FR-10.5 counter
  - Verify: greps for the literal malformed string, `Gate 6 attempts:`, `verifies_with`,
    `append-only`, `byte-identical`, `UNCERTAIN`
  - Done when: TC-2.1/2.3/2.5; owns AC-2, AC-3, AC-20 · Pre-review: **security**
- [x] Slice 4 — `agents/plan-critic.md` extraction + pre-migration capture — 8f72dd0
  - Files: `agents/plan-critic.md` [new], `tests/fixtures/plan-critic/{pre-migration-prompt,defective-plan}.md` [new], `tests/fixtures/agents/plan-critic/{golden-plan,no-tracer-marker,wave1-non-tracer,union-mismatch}.md` [new]
  - Changes: **capture `src/claude.md` 102–166 verbatim FIRST**; agent with `tools:["Read","Glob","Grep"]`,
    `model: opus`; all checks carried forward (FR-5.2), CRITICAL/MAJOR/MINOR→BLOCKER/WARNING/INFO
    (FR-5.4), FORCE stance (FR-5.3), + 3 FR-5.10 BLOCKER checks. Generalize the hardcoded
    `.claude/rules/` paths (recorded, non-weakening — AC-4 compares finding coverage, not literals)
  - Verify: `diff <(sed -n '102,166p' src/claude.md) <capture>`; no `"Write"`/`"Edit"`;
    both AC-7 arms (validate-agents 0 with 14; non-zero on a malformed scratch copy)
  - Done when: AC-7, AC-8; owns AC-4, AC-18 · Pre-review: none
- [x] Slice 5 — reviewer confidence filter + silent-failure hunting — bc992cd
  - Files: `agents/code-reviewer.md`, `agents/security-auditor.md`,
    `tests/fixtures/agents/code-reviewer/{low-confidence-naming,ambiguous-sql-critical,five-null-checks,adjacent-medium,adjacent-critical,boundary-80,silent-failures}/` [new],
    `tests/fixtures/agents/security-auditor/{low-confidence-hardening,plausible-auth-bypass}/` [new]
  - Changes: FR-6.1–6.6 (>80% filter, CRITICAL never filtered, consolidation, diff-scoping),
    FR-6.3 four tiers on code-reviewer, FR-7.1–7.3 Silent Failures (CRITICAL in data-mutation
    **or financial** paths, HIGH otherwise)
  - Verify: greps for CRITICAL/LOW/`Silent Failures`/`80%`/consolidat/financial; 9 fixture dirs
  - Done when: TC-7.7; owns AC-9, AC-10 · Pre-review: **security** (edits the security gate's own
    suppression rules)
- [x] Slice 6 — orchestration gates: tracer gate + dispatch disjointness — a685621
  - Files: `skills/develop-feature/SKILL.md`, `skills/implement-slice/SKILL.md`
  - Changes: FR-8.3/8.4/8.6 (exact notice `tracer gate inactive — no **Tracer:** yes marker found;
    treating as pre-F3 plan.`), FR-9.2–9.6 (re-derive fresh, case-insensitive incl. prefix
    containment, refuse with **zero** Agent calls naming path + both slice numbers, Rule 3→Rule 4);
    implement-slice pre-flight refusal (AC-16)
  - Verify: greps for the exact notice, `case-insensitive`, `single-slice wave requires no check`,
    `**Tracer:** yes` in implement-slice; `validate-skills.js`
  - Done when: TC-9.5/9.7/10.6; owns AC-5, AC-6, AC-16, AC-19 · Pre-review: architect

### Wave 3 [in progress]
- [ ] Slice 7 — planner: tracer-first, `Files (union)` column, returns-replan-slices contract
  - Files: `agents/planner.md`, `tests/fixtures/agents/planner/gaps-input/{gaps,gaps-unautomatable,flagged-conflict}.json` [new]
  - Changes: FR-8.1/8.2/8.5, FR-9.1 (`Files (union)` = **literal union**), FR-10.2 return contract,
    FR-9.6 flagged-conflict rewave contract. `tools:` unchanged.
  - Verify: greps for `**Tracer:** yes`, `Files (union)`, exact tools line, no `"Write"`/`"Edit"`,
    `verifies_with`; 3 fixtures
  - Done when: TC-9.1, AC-22; co-owns AC-2 · Pre-review: **security** (consumer half of `--gaps`,
    reviewed with Slice 3's diff) + architect
- [ ] Slice 8 — wire `plan-critic` into both triggers: `src/claude.md` stub + bootstrap Step 5
  - Files: `src/claude.md`, `skills/bootstrap-feature/SKILL.md`
  - Changes: delete inlined 65-line blockquote (captured in Slice 4); FR-5.5 loop (max 3 →
    Rule 4), FR-5.6 fail-visible fallback when `plan-critic` unresolvable, FR-5.8 Agency Roles row
    verbatim, FR-5.9 bootstrap Step 5 + "Plan Critique" output block
  - Verify: inlined prompt absent; Agency Roles row present; `awk` proves invocation precedes
    Step 6 Git Setup; `validate-skills.js`
  - Done when: AC-13, TC-6.16, TC-6.13; owns AC-23 · Pre-review: **security**
- [ ] Slice 9 — agent-count consistency sweep (FR-5.11)
  - Files: `README.md`, `install.sh`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
  - Changes: 13→14 in all five live locations + `plan-critic` row with model tier.
    **README line 280 and `manifests/owned-files.txt` stay at 13.**
  - Verify: greps for `14 specialized`/`## The 14 Agents`/`plan-critic`; assert README `13 agent
    files` still present; assert `owned-files.txt` still says 13 and has no `plan-critic`;
    `bash -n install.sh`; `validate-version-consistency.js`
  - Done when: AC-17 in full · Pre-review: none

### Wave 4
- [ ] Slice 10 — CI validator for the 24 STATIC TCs + 5 seeded-bad fixtures (FR-11.1–11.4)
  - Files: `scripts/ci/validate-verification-upgrade.js` [new],
    `tests/fixtures/ci/verification-upgrade/bad-{plan-critic-write,verifier-tools,verifier-verdicts,merge-ready-note,agent-count}/` [new]
  - Changes: zero-dep Node on `scripts/ci/lib/validate-core.js`; asserts all 24 STATIC TCs; agent
    count cross-checked against actual `agents/*.md` count. Each bad fixture is a **complete passing
    mirror except one seeded defect**, so the falsify run proves that assertion fires
  - Verify: exits 0 real tree; non-zero on each of 5 fixtures; non-zero on `$(mktemp -d)`
  - Done when: AC-24 · Pre-review: none

### Wave 5
- [ ] Slice 11 — CI workflow wiring (FR-11.5)
  - Files: `.github/workflows/ci.yml`
  - Changes: 1 pass step + **5** falsify steps + 1 anti-vacuity step, matching existing conventions
  - Verify: grep count of `verification-upgrade/bad-` == 5; all 7 validators + `run-tests.js` pass
  - Done when: FR-11.5 · Pre-review: none

| Wave | Slices | Files (union) — literal | Rationale |
|---|---|---|---|
| 1 | 1 | `agents/verifier.md`, `skills/merge-ready/SKILL.md`, `tests/fixtures/agents/verifier/present-unverified/` | Tracer alone (FR-8.5), executed not asserted |
| 2 | 2,3,4,5,6 | verifier + 8 fixture dirs; merge-ready; plan-critic + 6 fixtures; code-reviewer, security-auditor + 9 fixture dirs; develop-feature, implement-slice | Pairwise disjoint; Slice 4's capture needs `src/claude.md` intact until Wave 3 |
| 3 | 7,8,9 | planner + 3 fixtures; `src/claude.md`, bootstrap-feature; README, install.sh, both `.claude-plugin/*.json` | S7←S3 contract; S8←S4 agent+capture; S9←S4 count |
| 4 | 10 | `scripts/ci/validate-verification-upgrade.js`, 5 ci fixture dirs | Asserts strings from Waves 1–3 |
| 5 | 11 | `.github/workflows/ci.yml` | Invokes the Wave-4 validator |

## AC ownership

AC-1,14,15,21→S1 · AC-11,12→S2 · AC-2,3,20→S3(+S7) · AC-4,7,8,18→S4 · AC-9,10→S5 ·
AC-5,6,16,19→S6 · AC-22→S7 · AC-13,23→S8 · AC-17→S9 · AC-24→S10+S11

## Hand to Gate 7 (doc-updater)

- FR-5.11's exception list omits `manifests/owned-files.txt` — Slice 9 treats it as untouchable
- Slice 4's path generalization is an intentional, non-weakening FR-5.2 deviation — note beside AC-4
- FR-6.1's >80% threshold is permanently non-mechanical (PRD concedes this)
- `plan-critic` model `opus` is a planner judgment call — revisit at F4

## Blockers

- none

## Completed

- F1 (§6) SHIPPED — merged 6e0c55e · F2a (§7) SHIPPED — merged cbe586d · F2b (§8) SHIPPED — merged 9cffb22
- All three pushed, GitHub CI green (4 jobs). 769 hook checks, 6 validators, 13 falsify/anti-vacuity.
- F3 docs committed 449aef4
