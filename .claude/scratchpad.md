## Feature: Self-Improvement Loop (v4.0 roadmap F5)
## Branch: feat/self-improvement-loop-v4
## Status: implementing wave 2 slice 2/11
## Tier: full

## Docs

- PRD `docs/PRD.md` §11 (lines ~2240–2483) — FR-1..FR-10, AC-1..AC-18; §4 revised in place → `[SUPERSEDED]`
- Use cases `docs/use-cases/self-improvement-loop_use_cases.md` — UC-1..UC-22
- QA `docs/qa/self-improvement-loop_test_cases.md` — 119 TCs (52 STATIC / 14 FIXTURE / 53 BEHAVIORAL)
- Architecture: **PASS with 10 binding constraints — all applied to the PRD text**
- Plan critic: 3 BLOCKER + 10 WARNING + 3 INFO — all addressed in plan v2

## Deliverables checklist

- [x] PRD §11 · [x] Use cases · [x] Architecture review · [x] QA test cases
- [ ] Slices 1–11 · [ ] CHANGELOG.md entry — written once at `/merge-ready` Finalization

## D1 — Shared Rule-text validation (ONE definition, both consumers)

A `Rule:` value is valid iff it is a **single physical line, 1–200 characters**, matching the allowlist
`/^[\p{L}\p{N} ._/():+#&',—-]{1,200}$/u` — `FEATURE_RE`'s class extended by exactly `,` and `—`.
Everything else fails, including every character FR-6.2a names (backtick, pipe, `<`, `>`, `;`, `$`)
plus quotes, braces, `=`, `*`, `%`, `!`, `?`, `@`, `[`, `]`.

**Why one definition:** the plan critic found Slice 1 specifying an allowlist and Slice 4 a six-character
denylist. A rule containing a comma would pass `planner`'s looser check and reach an **executed plan**
while the hook silently dropped it — the weaker check guarding the channel FR-6.2a itself calls
"strictly worse than injection". Verified empirically before fixing.
**Why allowlist:** it rejects everything unnamed, not only six named characters.
**Why extended by `,` and `—`:** the QA doc's own canonical rule text (TC-12.1, TC-14.1) contains both;
the unextended class would reject the test suite's own legitimate fixtures.

A failing entry is **excluded entirely** — never truncated into shape, never echoed, never attached raw.
Capture steps (Slices 5, 6) MUST mint `Rule:` lines within this allowlist.

## D2 — Cross-file validator re-run rule

Any `Verify:` command reading files outside its slice's `Files:` (`validate-agents.js`,
`validate-skills.js`, `validate-triage-parity.js`, `validate-hooks.js`, `validate-model-profile.js`,
`run-tests.js`) may FAIL on a same-wave sibling's in-flight state. On such a failure: re-run once after
all wave siblings commit; only a second failure counts against the slice (free — harness coupling, not
a slice defect). The post-wave collection step re-runs the wave's union of these, and that run is
authoritative. Coupled pairs: 3↔4 (`agents/`), 5/6/7 (`skills/`), 7↔9 (triage-parity's two CORE_FILES).

## Binding constraints C1–C10 — already in the PRD, implemented by the slices

C1 injection hardening · C2 confidence recomputes only on a new occurrence, decay persists, stamp
timing pinned · C3/FR-1.5a pre-capture dedup by `Pattern:`+`Category:` · C4/FR-6.2a attach-time
validation · C5/FR-7.0 wave fires reported as `(category, count)` · C6/FR-8.9 debugger profile rows in
the same slice as the agent · C7/FR-7.4 store joins `isCurated` · C8/FR-8.10 inline diagnostic
fallback · C9/FR-6.5 planner read capped at top 20

**Slice count 11** — past the 9 ceiling deliberately: the critic mandated splitting the oversized
fixture-manifest slice into three, and adding a prose-discipline validator. Any further merge either
recreates the oversized slice or breaks same-wave disjointness.

## Plan (11 slices, 4 waves)

### Wave 1 [complete]

- [x] **Slice 1 [DONE 4360e87]: session-start injection + store scaffold** (FR-5, FR-1.1 template half)
  - **Wave:** 1
  - **Tracer:** yes
  - **Use cases:** UC-9, UC-10, UC-11, UC-1-EC2; AC-2
  - **Files:** `hooks/handlers/session-start-spine.js`, `templates/instincts.md` [new],
    `tests/hooks/test-instincts-injection.js` [new]
  - **Changes:** template = exactly three sections (`## Meta` with `Feature counter: 0`,
    `## Prevention Rules`, `## Instincts Log`), no seeded entries. Hook: second capped read of
    `<cwd>/.claude/instincts.md` via existing `readCapped` (symlink-refusing, absent → silent); parse
    `## Prevention Rules` only; extract only the `Rule:` line; `sanitize.sanitizeField`; validate
    against **D1**; failures excluded entirely; heading text never reaches output. Select
    `Confidence ≥ 0.7`, top 6, ties by higher `Last confirmed at`. Emit `prevention rule: <text>`;
    framing sentence **only when ≥1 survives**. **Return-path restructure (critic W9):** the current
    early returns at `:183` and `:199` fire *before* the body is assembled, so a tracked store with no
    scratchpad — a fresh clone — would inject nothing. Compute scratchpad parts, prevention lines and
    drift independently; return `null` only when all three are empty (preserving byte-identical
    TC-10.3); otherwise assemble one body through the existing shared `capBlock`. Header: "SIX TYPED
    FIELDS" → seven typed constructs; threat model names the second read source; honesty statement that
    the regex constrains **characters, not semantics**.
  - **Verify:** `node tests/hooks/test-instincts-injection.js && node tests/hooks/run-tests.js &&
    test -f templates/instincts.md && [ "$(grep -c '^## ' templates/instincts.md)" = "3" ] &&
    grep -qx 'Feature counter: 0' templates/instincts.md &&
    grep -qi 'seven typed' hooks/handlers/session-start-spine.js &&
    grep -qi 'constrains characters' hooks/handlers/session-start-spine.js`
  - **Done when:** the new test exits 0 asserting: (a) an 8-qualifying fixture injects exactly 6 lines
    in order; (b) a hostile `Rule:` contributes **no fragment** while a benign sibling IS injected;
    (c) both files absent + no drift → exactly `null`; (d) zero-qualifying → neither rules nor framing;
    (e) `SDLC_SESSION_CONTEXT_MAX_CHARS=250` truncates via `capBlock` without expanding the ≤6
    selection; **(f) qualifying rules with NO scratchpad still inject**; and the pre-existing spine test
    passes unchanged.
  - **Pre-review:** **security (MANDATORY)**
  - *Tracer rationale:* thinnest genuinely-executable end-to-end path — store → capped read → D1 →
    injected context — run as a real child process via `runHook()` with a caller-supplied `cwd`.
    Proves the highest-risk self-reinforcing surface first and pins the schema later slices use.

### Wave 2 (3 slices, disjoint)

- [ ] **Slice 2: mechanical wave-safety backstops** (FR-7.2/7.3/7.4)
  - **Wave:** 2 · **Use cases:** UC-16; AC-6
  - **Files:** `hooks/handlers/pre-agent-isolation-guard.js`, `hooks/handlers/pre-write-shrink-guard.js`,
    `hooks/hooks.json`, `tests/hooks/test-guard-isolation.js`, `tests/hooks/test-guard-shrink.js`
  - **Changes:** `PROTECTED` gains `.claude/instincts.md`; `isCurated()` gains the same; `.claude/debug/`
    in neither (single-writer, FR-7.3). `hooks.json` description → "scratchpad, changelog or instinct
    store" (no id/registration change; budget stays 9/10). Tests derive inputs from the committed
    captured stdin fixtures, overriding only `tool_input.file_path` to preserve the `agent_id` shape.
  - **Verify:** `node tests/hooks/test-guard-isolation.js && node tests/hooks/test-guard-shrink.js &&
    grep -q "instincts.md" hooks/handlers/pre-agent-isolation-guard.js &&
    grep -q "instincts.md" hooks/handlers/pre-write-shrink-guard.js &&
    grep -qi 'instinct' hooks/hooks.json && node scripts/ci/validate-hooks.js &&
    node tests/hooks/run-tests.js`
  - **Done when:** both test files pass all seven new cases; the `hooks.json` grep passes;
    `validate-hooks` exits 0 at 9 ids / 10 registrations · **Pre-review:** none

- [ ] **Slice 3: `debugger` agent + profile rows + install.sh + gitignore** (FR-8.1–8.3, 8.8, 8.9, FR-1.1 install half, FR-10.1's install strings)
  - **Wave:** 2 · **Use cases:** UC-17, UC-19; AC-13 (install surface), AC-17
  - **Files:** `agents/debugger.md` [new], `scripts/ci/lib/model-profiles.js`, `install.sh`,
    `templates/.gitignore`
  - **Changes:** agent `tools: ["Read","Glob","Grep","Bash","Write"]`, `model: sonnet`, `effort: high`;
    ≤5 hypothesis cycles; **persist via Read-then-Write of full merged content** — spelled out because
    it holds `Write` but no `Edit`, so a naive "append" is unimplementable (viable only because
    `.claude/debug/` is outside both guards). Deny-by-default constraint in kind to `verifier`'s.
    `model-profiles.js` TABLE gains `debugger: sonnet/sonnet/sonnet/inherit`; header "10 sonnet roles"
    → 11. `install.sh`: three `:debugger) echo sonnet ;;` arms, `AGENT_ROLES`, **banner line 193
    `14 specialized agents` → 15 (critic BLOCKER 1)**, "all 14" comments → 15, `scaffold_project()`
    copies the instincts template skip-if-exists. This slice owns ALL `install.sh` edits.
    `templates/.gitignore` gains `.claude/debug/`.
  - **Verify:** `node scripts/ci/validate-model-profile.js && node scripts/ci/validate-agents.js &&
    bash -n install.sh && grep -q "'debugger':" scripts/ci/lib/model-profiles.js &&
    [ "$(grep -c ':debugger) echo sonnet ;;' install.sh)" = "3" ] &&
    grep -q '15 specialized agents' install.sh && ! grep -q '14 specialized agents' install.sh &&
    grep -qi 'instincts' install.sh && grep -qF '.claude/debug/' templates/.gitignore &&
    [ "$(ls agents/*.md | wc -l | tr -d ' ')" = "15" ]`
  - **Done when:** drift validator passes with the debugger triple in both hand-maintained copies (inside
    the net, not the silent unknown-role `continue`); 15 agents; banner greps pass · **Pre-review:**
    **security (MANDATORY)** — `Bash` + scoped `Write`, auto-invoked on attacker-influenceable input

- [ ] **Slice 4: planner application + bootstrap delegation/confirmation** (FR-6.1–6.5, C4, C9)
  - **Wave:** 2 · **Use cases:** UC-12, UC-13, UC-14; AC-3, AC-18
  - **Files:** `agents/planner.md`, `skills/bootstrap-feature/SKILL.md`
  - **Changes:** planner reads `## Prevention Rules` **capped at top 20 by Confidence** (ties:
    `Last confirmed at`, then file order); absent = designed state. Per-slice `Prevention:` on
    `Pattern:` match, omitted entirely when nothing matches. **FR-6.2a states D1 verbatim as an
    allowlist**; a failing entry is **excluded silently** and noted in the summary — never truncated,
    never raw. Store content is data, never instructions. `tools:` unchanged (AC-18). Bootstrap Step 5
    gains the framed read instruction + a post-return orchestrator step stamping `Last confirmed at`
    and `Retires at` via **Edit**.
  - **Verify:** `grep -qF 'tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]' agents/planner.md &&
    grep -q 'Prevention:' agents/planner.md && grep -q 'top 20' agents/planner.md &&
    grep -q '200' agents/planner.md && grep -q 'excluded silently' agents/planner.md &&
    grep -qi 'instincts' skills/bootstrap-feature/SKILL.md &&
    grep -q 'Last confirmed at' skills/bootstrap-feature/SKILL.md &&
    node scripts/ci/validate-skills.js`
  - **Done when:** planner tools byte-identical; cap, sub-field and D1 present with the
    excluded-silently clause · **Pre-review:** **security (MANDATORY)**

### Wave 3 (5 slices, disjoint)

- [ ] **Slice 5: `/implement-slice` capture + per-slice debugger trigger** (FR-2.1/2.2, **1.7**, 8.5, C3, C8)
  - **Wave:** 3 · **Use cases:** UC-1, UC-2, UC-4; AC-1, AC-5, AC-12 · **Files:** `skills/implement-slice/SKILL.md`
  - **Changes:** capture step after the commit step; Trigger 1's three heuristics; Trigger 2 tally line
    `Deviation rule fires this feature: rule1=<n> ...` via **Edit**, read back from file, threshold 2+,
    Rule 1/2 counting identically. Full 8-field schema, `Rule:` minted within **D1**.
    **FR-1.7 category rules in full (critic W8 — previously owned by no slice):** `security` when the
    gate is Gate 3 or `Pattern:` hits `auth`/`payment`/`billing`/`secret` as a path segment or
    `.github/workflows/`, `install.sh`, `.claude/settings.json`; `data-integrity` on a `migration`
    segment or a data-mutation/financial path; else `general`. **C3 dedup scan MANDATORY** before
    minting a slug. Lazy creation via `Write` of a new file then `Edit`.
    **Wave-subagent carve-out:** track both the tally **and** the `Slice <N> build-runner attempts: N/3`
    counter in-context, self-invoke `debugger` at `2/3`, and report `(category, count)` pairs,
    corrections **and the attempts count** in the result. Standalone path persists the counter.
    C8 inline fallback when nested spawn is unavailable.
  - **Verify:** `grep -qF 'Deviation rule fires this feature: rule1=' skills/implement-slice/SKILL.md &&
    grep -q 'build-runner attempts:' skills/implement-slice/SKILL.md &&
    grep -q '2/3' skills/implement-slice/SKILL.md && grep -qi 'inline' skills/implement-slice/SKILL.md &&
    grep -q 'data-integrity' skills/implement-slice/SKILL.md &&
    grep -q 'migration' skills/implement-slice/SKILL.md && node scripts/ci/validate-skills.js`
  - **Done when:** all greps pass and the carve-out names both counters · **Pre-review:** none

- [ ] **Slice 6: `/merge-ready` capture, consolidation arithmetic, Gate 4/5 trigger** (FR-2.3, 3, 4, 1.6, **1.7**, 8.4, C2, C8)
  - **Wave:** 3 · **Use cases:** UC-3, 5, 6, 7, 8, 17, 18; AC-4, AC-8–11 · **Files:** `skills/merge-ready/SKILL.md`
  - **Changes:** "Post-Gate Instinct Capture" strictly between the gate loop and Finalization,
    **unconditional on outcome**; FR-1.5a dedup and FR-1.7 categories restated (capture fires here too).
    "Consolidate Instincts" alongside Finalization, gated by wording identical to the changelog step,
    in order: counter +1 via Edit → elevation (≥2 security/data-integrity, ≥3 general) → **C2 verbatim**
    (formula recomputes ONLY at a new-occurrence event and overwrites any decayed value) → confirming
    re-stamp after the increment → decay (−0.05, floor 0.3) → retirement (`counter − Last confirmed at
    ≥ 10` → **delete, never archive**) → 50-entry merge. Gate 4/5 attempts counters, `debugger` at
    `2/3`, `UNDIAGNOSED` non-blocking, C8 inline fallback.
  - **Verify:** `grep -q 'Post-Gate Instinct Capture' skills/merge-ready/SKILL.md &&
    grep -q 'Consolidate Instincts' skills/merge-ready/SKILL.md &&
    grep -qF 'min(0.9, 0.3' skills/merge-ready/SKILL.md && grep -q '0.05' skills/merge-ready/SKILL.md &&
    grep -q 'Gate 4 attempts:' skills/merge-ready/SKILL.md &&
    grep -q 'Gate 5 attempts:' skills/merge-ready/SKILL.md &&
    grep -qi 'inline' skills/merge-ready/SKILL.md && grep -q 'data-integrity' skills/merge-ready/SKILL.md &&
    awk '/Post-Gate Instinct Capture/{c=NR} /## Finalization: Changelog Entry/{f=NR} END{exit !(c && f && c<f)}' skills/merge-ready/SKILL.md &&
    node scripts/ci/validate-skills.js`
  - **Done when:** all greps + the awk ordering check pass · **Pre-review:** architect (recommended —
    C2 precedence and stamp timing are where prose drift silently corrupts the arithmetic)

- [ ] **Slice 7: `/develop-feature` wave result contract + aggregation** (FR-2.4, 7.0/C5, 7.1)
  - **Wave:** 3 · **Use cases:** UC-15, UC-16; AC-6 · **Files:** `skills/develop-feature/SKILL.md`
  - **Changes:** sixth CRITICAL rule (do NOT write the store). Result contract extended beyond
    PASS/FAIL to require `(category, count)` deviation pairs, detected corrections, **and the final
    `Slice <N> build-runner attempts: N/3` count** (critic W10 — otherwise AC-5's trigger has no durable
    input on the parallel path). Post-wave fold into the tally **including the reconciliation clause
    verbatim** — two fires of the same rule in one slice count exactly as two across siblings, and
    earlier waves carry forward; persist each reported attempts count.
  - **Verify:** `grep -qF '(category, count)' skills/develop-feature/SKILL.md &&
    grep -q 'build-runner attempts' skills/develop-feature/SKILL.md &&
    grep -qi 'instincts.md' skills/develop-feature/SKILL.md && node scripts/ci/validate-skills.js &&
    node scripts/ci/validate-triage-parity.js`
  - **Done when:** greps pass; triage-parity still exits 0 · **Pre-review:** none

- [ ] **Slice 8: fixture-manifest validator generalisation + 51-entry migration** (FR-9.1–9.4, 9.6, 9.7, id-grammar fix)
  - **Wave:** 3 · **Use cases:** UC-20, UC-22; AC-7 (mechanism)
  - **Files:** `scripts/ci/validate-fixture-manifest.js`, `tests/fixtures/manifest.json`
  - **Changes:** replace hardcoded `QA_DOC` with discovery over `docs/qa/*_test_cases.md`; required
    `qaDoc` field; bijection scoped per `(qaDoc, id)`; dangling-qaDoc its own error; wholesale-
    unregistered-document check; document-count floor of 10, `--min`-adjustable.
    **BLOCKING id-grammar fix — verified empirically:** `/^TC-\d+\.\d+$/` matches `TC-12.1` but **not**
    `TC-FR6.2a-1`, so F5's own three `TC-FR*` FIXTURE cases are invisible and AC-7 unsatisfiable. Use
    `/^TC-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*(?:-\d+)?$/` in both the extraction and format checks.
    Migrate all 51 entries with `qaDoc`; `_source_qa_doc` → `_source_qa_docs`. Registration of the two
    new documents is Slice 10 — so this slice's honest end state is "the validator now detects the gap".
  - **Verify:** `node scripts/ci/validate-fixture-manifest.js --expect-failure "adaptive-tier-routing" &&
    [ "$(grep -c '"qaDoc"' tests/fixtures/manifest.json)" = "51" ] &&
    grep -q '"_source_qa_docs"' tests/fixtures/manifest.json &&
    ! grep -q '"_source_qa_doc":' tests/fixtures/manifest.json`
  - **Done when:** the real-tree run fails **by document name** on today's actual gap — the defect FR-9
    exists to close — and the migration greps pass · **Pre-review:** none

- [ ] **Slice 9: agent-count and documentation surface** (FR-10.1–10.4)
  - **Wave:** 3 · **Use cases:** none dedicated; AC-13, AC-14
  - **Files:** `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `src/claude.md`
  - **Changes:** README line 5 → 15; "## The 14 Agents" → 15 + `debugger` row; **all four further live
    model-profile counts (critic INFO 15)** at ~307/338(×2)/340 → 15 / "14-of-15"; Self-Improvement
    description updated. Both `.claude-plugin/*.json` descriptions → 15. `src/claude.md` gains the
    Agency Roles `| Debugger |` row and a "Cross-Session Learning" subsection.
    **README's historical v3.x-upgrade note stays untouched.** `validate-agents.js` untouched (floor 13).
  - **Verify:** `[ "$(ls agents/*.md|wc -l|tr -d ' ')" = "15" ] && grep -q '15 specialized' README.md &&
    grep -q '## The 15 Agents' README.md && ! grep -q '14 specialized' README.md &&
    ! grep -q 'all 14' README.md && ! grep -q '13-of-14' README.md &&
    grep -q '15 specialized' .claude-plugin/plugin.json &&
    grep -q '15 specialized' .claude-plugin/marketplace.json &&
    grep -qF '| Debugger | ' src/claude.md && grep -qi 'Cross-Session Learning' src/claude.md &&
    node scripts/ci/validate-version-consistency.js && node scripts/ci/validate-triage-parity.js`
  - **Done when:** the negative greps prove no live "14"/"all 14"/"13-of-14" survives · **Pre-review:** none

### Wave 4 (2 slices, disjoint)

- [ ] **Slice 10: manifest registration + committed fixture inputs** (FR-9.5 real-tree closure, 9.7 completion)
  - **Wave:** 4 · **Use cases:** UC-20, UC-21; AC-7 (positive half)
  - **Files:** `tests/fixtures/manifest.json`, `tests/fixtures/agents/planner/instincts/` [new],
    `tests/fixtures/agents/debugger/` [new]
  - **Changes:** register every FIXTURE case in `adaptive-tier-routing` (10) and `self-improvement-loop`
    (14: TC-12.1, 12.3–12.6, 13.1, 13.2, 17.3, 19.1, 19.2, 19.4, FR6.2a-1, FR6.2a-2, FR6.5-1) with
    `qaDoc`; commit the fixture inputs; `fixture: null` + `note` only where an input genuinely cannot
    exist yet. Update per-document `_counts`.
  - **Verify:** `node scripts/ci/validate-fixture-manifest.js &&
    [ "$(grep -c 'adaptive-tier-routing' tests/fixtures/manifest.json)" -ge 10 ] &&
    grep -q 'self-improvement-loop_test_cases.md' tests/fixtures/manifest.json`
  - **Done when:** AC-7's positive half — validator exits 0 with all 10 documents discovered and every
    FIXTURE case registered; `grep -c adaptive` no longer 0 · **Pre-review:** none

- [ ] **Slice 11: seeded-bad fixtures + prose-discipline validator + CI wiring** (FR-9.8, critic W11, gap 8)
  - **Wave:** 4 · **Use cases:** UC-21, UC-22; AC-7 (negative half)
  - **Files:** three new `tests/fixtures/ci/fixture-manifest/bad-*` trees,
    `bad-missing-fixture`'s manifest, `scripts/ci/validate-instinct-discipline.js` [new],
    `tests/fixtures/ci/instinct-discipline/bad-weakened/` [new], `.github/workflows/ci.yml`
  - **Changes:** seeded-bad fixtures — dangling `qaDoc`, cross-document mismatch, wholesale-unregistered
    document (the reproduced HEAD bug); add `qaDoc` to `bad-missing-fixture` so it still fails for its
    own reason. **New `validate-instinct-discipline.js` — the mechanical check on the higher-risk prose
    path (critic W11):** asserts `agents/planner.md` carries the FR-6.2a clause unweakened (D1's
    allowlist, the 200 limit, "single line", "excluded silently"), and that **both** capture surfaces
    carry the C3 dedup clause; failure names the file and the missing clause. Rationale: every other
    mechanical control sits on the *lower*-risk path; a security pre-review reads prose once and cannot
    stop it rotting later. CI: `--min 1` on the existing `bad-missing-fixture` run (single-doc root vs
    the new 10-doc floor), the three new seeded runs, and the discipline validator's three runs.
  - **Verify:** `node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-missing-fixture --min 1 --expect-failure "fixture path does not exist" &&
    node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-dangling-qadoc --min 1 --expect-failure "nonexistent-feature_test_cases.md" &&
    node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-cross-doc-mismatch --min 1 --expect-failure "have no manifest entry" &&
    node scripts/ci/validate-fixture-manifest.js --root tests/fixtures/ci/fixture-manifest/bad-unregistered-doc --min 1 --expect-failure "no manifest entry" &&
    node scripts/ci/validate-instinct-discipline.js &&
    node scripts/ci/validate-instinct-discipline.js --root tests/fixtures/ci/instinct-discipline/bad-weakened --min 1 --expect-failure "FR-6.2a" &&
    grep -q 'validate-instinct-discipline' .github/workflows/ci.yml &&
    grep -q 'bad-dangling-qadoc' .github/workflows/ci.yml`
  - **Done when:** every seeded root fails by name; the discipline validator passes the real tree and
    fails `bad-weakened`; CI greps pass · **Pre-review:** security (recommended — `ci.yml` is a
    sensitive path; validator-run additions only)

| Wave | Slices | Files (union) — literal | Rationale |
|---|---|---|---|
| 1 | 1 | `hooks/handlers/session-start-spine.js`, `templates/instincts.md`, `tests/hooks/test-instincts-injection.js` | Tracer alone; executable end-to-end; pins the schema |
| 2 | 2,3,4 | isolation-guard, shrink-guard, `hooks/hooks.json`, the two guard tests; `agents/debugger.md`, `scripts/ci/lib/model-profiles.js`, `install.sh`, `templates/.gitignore`; `agents/planner.md`, `skills/bootstrap-feature/SKILL.md` | Disjoint; depend only on Wave 1's template. D2 covers the 3↔4 `validate-agents` coupling |
| 3 | 5,6,7,8,9 | `skills/implement-slice/SKILL.md`; `skills/merge-ready/SKILL.md`; `skills/develop-feature/SKILL.md`; `scripts/ci/validate-fixture-manifest.js`, `tests/fixtures/manifest.json`; `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `src/claude.md` | Disjoint; 5/6 reference `debugger`, 9 needs 15 agents. D2 covers skills (5/6/7) and triage-parity (7/9) |
| 4 | 10,11 | `tests/fixtures/manifest.json`, `tests/fixtures/agents/planner/instincts/`, `tests/fixtures/agents/debugger/`; `tests/fixtures/ci/fixture-manifest/bad-dangling-qadoc/`, `.../bad-cross-doc-mismatch/`, `.../bad-unregistered-doc/`, `.../bad-missing-fixture/tests/fixtures/manifest.json`, `scripts/ci/validate-instinct-discipline.js`, `tests/fixtures/ci/instinct-discipline/bad-weakened/`, `.github/workflows/ci.yml` | Disjoint; 10 needs Slice 8's validator, 11 needs its error wording and Slices 4/5/6's clause text |

`tests/fixtures/manifest.json` appears in Waves 3 and 4 — sequential, valid. No same-wave slice pair
shares a file. Every dependency points to an earlier wave.

## Risks

- **Self-reinforcing loop** — store → every session's context → model behaviour → captures back.
  Mechanical mitigations are hook-side (6 entries, ≥0.7, D1, shared cap, conditional framing), the two
  guards, and now Slice 11's discipline validator. Honest residual: D1 constrains characters, not
  semantics; `Confidence:` is attacker-settable; neither is a security boundary.
- **Repository-controlled store, two channels** — injection (Slice 1) and the strictly-worse planner
  attachment (Slice 4), both mandatory security pre-review.
- **`debugger`** — `Bash` + single-path `Write`, auto-invoked on attacker-influenceable failure output.
- **Sensitive paths** — `install.sh` (Slice 3), `.github/workflows/ci.yml` (Slice 11).
- **Prose-enforced arithmetic** remains prose by PRD design; STATIC greps pin the numbers and Slice 11
  pins the two highest-value clauses.

## PRD gaps (9) — resolved or recorded

1. id-grammar rejects `TC-FR*` — **resolved Slice 8** · 2. FR-8.5 counter vs PROTECTED scratchpad —
**resolved Slices 5+7** · 3. mid-wave corrections cannot reach a subagent — recorded, 2 TCs
unexercisable · 4. FR-8.2 "append" with no `Edit` — **resolved Slice 3** · 5. debugger profile values —
decided in-plan, pre-review verifies · 6. §11.6's stale QA-doc row — one-line Gate 7 fix · 7. AC-15
already satisfied at HEAD · 8. `hooks.json` description — **resolved Slice 2 with a grep** ·
9. FR-5.8 is a dangling number (§11's FR-5 stops at 5.7) — content is real and binding; Slice 1
implements it citing Design Decision 5

## Blockers

- none

## Completed (v4.0 roadmap)

- F1 (§6) `6e0c55e` · F2a (§7) `cbe586d` · F2b (§8) `9cffb22` · F3 (§9) `2c7272d` ·
  defect fixes `19b29ce` · F4 (§10) `9172301` — all merged, pushed, CI green (54 asset steps, 10 validators)
