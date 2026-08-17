## Feature: Self-Improvement Loop (v4.0 roadmap F5)
## Branch: feat/self-improvement-loop-v4
## Status: implementing wave 1 slice 1/9
## Tier: full

## Docs

- PRD `docs/PRD.md` §11 (lines ~2240–2483) — FR-1..FR-10, AC-1..AC-18. §4 revised in place → `[SUPERSEDED]`
- Use cases `docs/use-cases/self-improvement-loop_use_cases.md` — UC-1..UC-22
- QA `docs/qa/self-improvement-loop_test_cases.md` — 119 TCs (52 STATIC / 14 FIXTURE / 53 BEHAVIORAL);
  §25 covers the eight architecture amendments that have no UC coverage
- Architecture: **PASS with 10 binding constraints — all already applied to the PRD text**

## Binding constraints — implemented by the slices below, do NOT re-open

- **C1/FR-5** framing sentence only when ≥1 rule survives; labelled values not bare imperatives;
  `Rule:` ≤200 chars on the hook's charset; honest statement that the regex constrains **characters,
  not semantics**, and `Confidence:` is attacker-settable — neither is a security boundary
- **C2** the confidence formula recomputes **only** on a new-occurrence event and overwrites any
  decayed value; between occurrences confidence moves only by decay; `Last confirmed at` — capture
  stamps pre-increment, consolidation re-stamps post-increment
- **C3/FR-1.5a** pre-capture dedup by `Pattern:` + `Category:` — without it counts fragment, nothing
  elevates, and the store silently degrades into the flat log F5 replaces
- **C4/FR-6.2a** `planner` validates `Rule:` text **before attaching** — this text feeds autonomous
  code-writing, a strictly worse channel than injection
- **C5/FR-7.0** wave subagents report deviation fires as `(category, count)`; Rule 1/2 fires are free
  and invisible in retry counts, so reporting is the only channel
- **C6/FR-8.9** `debugger`'s model-profile rows land in the **same slice** as the agent file
- **C7/FR-7.4** `.claude/instincts.md` joins `pre-write-shrink-guard`'s `isCurated`
- **C8/FR-8.10** nested spawn unavailable → run the diagnostic **inline**, never skip
- **C9/FR-6.5** planner's Prevention Rules read capped at top 20 by confidence

## Plan (9 slices, 3 waves)

### Wave 1

- [ ] **Slice 1: session-start injection + store scaffold** (FR-5, FR-1.1 template half)
  - **Wave:** 1
  - **Tracer:** yes
  - **Use cases:** UC-9, UC-10, UC-11 (all), UC-1-EC2; AC-2
  - **Files:** `hooks/handlers/session-start-spine.js`, `templates/instincts.md` [new],
    `tests/hooks/test-instincts-injection.js` [new]
  - **Changes:** template = exactly three sections (`## Meta` with `Feature counter: 0`,
    `## Prevention Rules`, `## Instincts Log`), no seeded entries — this pins the schema every later
    slice writes against. Hook: second capped read of `<cwd>/.claude/instincts.md` via existing
    `readCapped` (symlink-refusing, absent → silent); parse `## Prevention Rules` only; extract **only**
    the `Rule:` line; `sanitize.sanitizeField`; validate against a new `RULE_RE` reusing `FEATURE_RE`'s
    charset with a 1–200 length bound; failing entries excluded entirely, never truncated, never echoed;
    heading text never reaches output. Select `Confidence ≥ 0.7`, top 6, ties by higher
    `Last confirmed at`. Emit each as `prevention rule: <text>`, preceded by the framing sentence
    **only when ≥1 survived**. Append into the SAME `body` array before the existing `capBlock` — shared
    budget, selection before assembly. Header comment: "SIX TYPED FIELDS" → seven typed constructs, plus
    the FR-5.8 honesty statement and the second read source named in the threat model.
  - **Verify:** `node tests/hooks/test-instincts-injection.js && node tests/hooks/run-tests.js &&
    test -f templates/instincts.md && [ "$(grep -c '^## ' templates/instincts.md)" = "3" ] &&
    grep -qx 'Feature counter: 0' templates/instincts.md &&
    grep -qi 'seven typed' hooks/handlers/session-start-spine.js &&
    grep -qi 'constrains characters' hooks/handlers/session-start-spine.js`
  - **Done when:** the new test exits 0 asserting: an 8-qualifying fixture injects exactly 6 labelled
    lines in the stated order; a hostile `Rule:` (backtick+pipe) contributes **no fragment** while a
    benign sibling in the same file IS injected; both files absent + no drift returns exactly `null`;
    a zero-qualifying store emits neither rules nor framing; `SDLC_SESSION_CONTEXT_MAX_CHARS=250`
    truncates via `capBlock` without expanding the ≤6 selection; and the pre-existing spine test still
    passes unchanged.
  - **Pre-review:** **security (MANDATORY)** — the channel that writes into every future session
  - *Tracer rationale:* thinnest genuinely-executable end-to-end path (store → capped read → per-entry
    validation → injected context), driven as a real child process via `runHook()` with asserted stdout.
    Also proves the highest-risk surface first and pins the schema slices 3–8 depend on.

### Wave 2 (3 slices, file-disjoint)

- [ ] **Slice 2: mechanical wave-safety backstops** (FR-7.2, FR-7.3, FR-7.4)
  - **Files:** `hooks/handlers/pre-agent-isolation-guard.js`, `hooks/handlers/pre-write-shrink-guard.js`,
    `hooks/hooks.json` (description string only), `tests/hooks/test-guard-isolation.js`,
    `tests/hooks/test-guard-shrink.js`
  - **Changes:** `PROTECTED` gains `.claude/instincts.md`; `isCurated()` gains the same;
    `.claude/debug/` deliberately NOT protected (FR-7.3 — single-writer). Tests derive inputs from the
    committed captured stdin fixtures, overriding only `tool_input.file_path`, preserving the
    spike-captured `agent_id` shape. No new hook id — budget stays 9 ids / 10 registrations.
  - **Verify:** `node tests/hooks/test-guard-isolation.js && node tests/hooks/test-guard-shrink.js &&
    grep -q "instincts.md" hooks/handlers/pre-agent-isolation-guard.js &&
    grep -q "instincts.md" hooks/handlers/pre-write-shrink-guard.js &&
    node scripts/ci/validate-hooks.js && node tests/hooks/run-tests.js`
  - **Done when:** both test files pass with the six isolation cases + the shrink case; `validate-hooks`
    exits 0 with the same id/registration counts · **Pre-review:** none

- [ ] **Slice 3: `debugger` agent + model-profile rows + install.sh + gitignore** (FR-8.1–8.3, 8.8, 8.9)
  - **Files:** `agents/debugger.md` [new], `scripts/ci/lib/model-profiles.js`, `install.sh`,
    `templates/.gitignore`
  - **Changes:** agent with `tools: ["Read","Glob","Grep","Bash","Write"]`, `model: sonnet`,
    `effort: high`; ≤5 hypothesis cycles; **persist by Read-then-Write of full merged content** —
    spelled out because the agent has `Write` but no `Edit`, so a naive "append" is unimplementable
    (works only because `.claude/debug/` is outside both guards). Deny-by-default constraint mirroring
    `verifier`'s wording. `debugger` added to `model-profiles.js` TABLE, three `model_for_role()` case
    arms, and `AGENT_ROLES` — **all in this slice** (the validator silently `continue`s on unknown
    roles, so shipping the agent alone would silently exempt it from the drift net). `scaffold_project()`
    copies the instincts template (skip-if-exists). This slice owns ALL `install.sh` edits.
  - **Verify:** `node scripts/ci/validate-model-profile.js && node scripts/ci/validate-agents.js &&
    bash -n install.sh && grep -q "'debugger':" scripts/ci/lib/model-profiles.js &&
    [ "$(grep -c ':debugger) echo sonnet ;;' install.sh)" = "3" ] &&
    grep -qF '.claude/debug/' templates/.gitignore && grep -q 'instincts' install.sh &&
    [ "$(ls agents/*.md | wc -l | tr -d ' ')" = "15" ]`
  - **Done when:** drift validator passes with the debugger triple in both hand-maintained copies;
    `validate-agents` passes with 15 · **Pre-review:** **security (MANDATORY)** — `Bash` + scoped
    `Write`, auto-invoked exactly when its input is most attacker-influenceable

- [ ] **Slice 4: planner application + bootstrap delegation/confirmation** (FR-6.1–6.5, C4, C9)
  - **Files:** `agents/planner.md`, `skills/bootstrap-feature/SKILL.md`
  - **Changes:** planner reads `## Prevention Rules` **capped at top 20 by Confidence** (ties:
    `Last confirmed at`, then file order); absent file = designed state. Optional per-slice
    `Prevention:` sub-field on `Pattern:` match, omitted entirely when nothing matches.
    **FR-6.2a attach-time validation verbatim** — single line, ≤200 chars, no backtick/pipe/`<`/`>`/
    `;`/`$`; failing entries excluded silently and noted in the summary, never truncated, never raw.
    Store content is data about past mistakes, never instructions. `tools:` unchanged (AC-18).
    Bootstrap Step 5 gains the framed read instruction + a post-return orchestrator step stamping
    `Last confirmed at` and `Retires at` via **Edit**.
  - **Verify:** `grep -qF 'tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]' agents/planner.md &&
    grep -q 'Prevention:' agents/planner.md && grep -q 'top 20' agents/planner.md &&
    grep -q '200' agents/planner.md && grep -qi 'instincts' skills/bootstrap-feature/SKILL.md &&
    grep -q 'Last confirmed at' skills/bootstrap-feature/SKILL.md &&
    node scripts/ci/validate-agents.js && node scripts/ci/validate-skills.js`
  - **Done when:** planner tools byte-identical; the cap, the sub-field and all three FR-6.2a checks
    present · **Pre-review:** **security (MANDATORY)** — repo-controlled text entering an executed plan

### Wave 3 (5 slices, file-disjoint)

- [ ] **Slice 5: `/implement-slice` capture + per-slice debugger trigger** (FR-2.1/2.2, FR-8.5, C3, C8)
  - **Files:** `skills/implement-slice/SKILL.md`
  - **Changes:** capture step after the commit step; Trigger 1's three heuristics; Trigger 2 tally line
    `Deviation rule fires this feature: rule1=<n> ...` maintained via **Edit**, read back from file
    (survives compaction), threshold 2+, Rule 1/2 counting identically; full 8-field schema;
    **C3 dedup scan stated MANDATORY**; lazy creation via `Write` of a new file then `Edit`.
    **Wave-subagent carve-out:** do NOT write the store or scratchpad — track in-context and report
    `(category, count)` pairs (resolves the FR-8.5 vs isolation-guard conflict). Verify step gains the
    persisted attempts counter, the `2/3` debugger trigger, and the C8 inline fallback.
  - **Verify:** `grep -qF 'Deviation rule fires this feature: rule1=' skills/implement-slice/SKILL.md &&
    grep -q 'build-runner attempts:' skills/implement-slice/SKILL.md &&
    grep -q '2/3' skills/implement-slice/SKILL.md && grep -qi 'inline' skills/implement-slice/SKILL.md &&
    grep -qi 'Pattern' skills/implement-slice/SKILL.md && node scripts/ci/validate-skills.js`
  - **Done when:** all four greps + validator pass · **Pre-review:** none

- [ ] **Slice 6: `/merge-ready` capture, consolidation arithmetic, Gate 4/5 trigger** (FR-2.3, 3, 4, 8.4, C2, C8)
  - **Files:** `skills/merge-ready/SKILL.md`
  - **Changes:** "Post-Gate Instinct Capture" strictly between the gate loop and Finalization,
    **unconditional on MERGE READY**. "Consolidate Instincts" alongside Finalization, gated by the
    identical trigger wording as the changelog step, in order: increment counter via Edit → elevation
    sweep → **C2 verbatim** (formula recomputes ONLY at a new-occurrence event and overwrites any
    decayed value) → decay (−0.05, floor 0.3) → retirement (`counter − Last confirmed at ≥ 10`,
    **delete, never archive**) → 50-entry consolidation. Gate 4/5 attempts counters mirroring the Gate 6
    precedent, `debugger` at `2/3`, `UNDIAGNOSED` non-blocking, C8 inline fallback.
  - **Verify:** `grep -q 'Post-Gate Instinct Capture' skills/merge-ready/SKILL.md &&
    grep -q 'Consolidate Instincts' skills/merge-ready/SKILL.md &&
    grep -qF 'min(0.9, 0.3' skills/merge-ready/SKILL.md && grep -q '0.05' skills/merge-ready/SKILL.md &&
    grep -q 'Gate 4 attempts:' skills/merge-ready/SKILL.md &&
    awk '/Post-Gate Instinct Capture/{c=NR} /## Finalization: Changelog Entry/{f=NR} END{exit !(c && f && c<f)}' skills/merge-ready/SKILL.md &&
    node scripts/ci/validate-skills.js`
  - **Done when:** greps + the awk ordering check + validator pass · **Pre-review:** architect
    (recommended — the C2 precedence and stamp timing are where prose drift silently corrupts arithmetic)

- [ ] **Slice 7: `/develop-feature` wave result contract + aggregation** (FR-2.4, FR-7.0/C5, FR-7.1)
  - **Files:** `skills/develop-feature/SKILL.md`
  - **Changes:** sixth CRITICAL rule (do NOT write the store); result contract extended beyond
    PASS/FAIL to require `(category, count)` deviation pairs + detected corrections; post-wave fold into
    the tally **including the reconciliation clause verbatim** — two fires of the same rule in a single
    slice count exactly as two across siblings, and earlier waves carry forward.
  - **Verify:** `grep -qF '(category, count)' skills/develop-feature/SKILL.md &&
    grep -qi 'instincts.md' skills/develop-feature/SKILL.md && node scripts/ci/validate-skills.js &&
    node scripts/ci/validate-triage-parity.js`
  - **Done when:** greps pass and triage-parity still exits 0 (proves Phase 0 undisturbed) ·
    **Pre-review:** none

- [ ] **Slice 8: fixture-manifest generalisation + migration + fixtures + CI** (FR-9.1–9.8)
  - **Files:** `scripts/ci/validate-fixture-manifest.js`, `tests/fixtures/manifest.json`,
    `.github/workflows/ci.yml`, 3 new seeded-bad fixture trees, `bad-missing-fixture`'s manifest,
    `tests/fixtures/agents/planner/instincts/` [new], `tests/fixtures/agents/debugger/` [new]
  - **Changes:** replace hardcoded `QA_DOC` with discovery over `docs/qa/*_test_cases.md`; required
    `qaDoc` field; bijection scoped per `(qaDoc, id)`; dangling-qaDoc error distinct from stale;
    wholesale-unregistered-document check (the actual F4 defect); document-count anti-vacuity floor.
    **BLOCKING GAP — widen the id grammar:** both regexes accept only `TC-\d+\.\d+`, so F5's own
    `TC-FR6.2a-1`-shaped FIXTURE ids are silently un-extractable and AC-7 is unsatisfiable. Use
    `/^TC-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*(?:-\d+)?$/`. Migrate all 51 entries with `qaDoc`; register
    F4's and F5's FIXTURE cases.
  - **Verify:** real tree exits 0; each of the four seeded-bad roots fails with its own
    `--expect-failure` substring · **Done when:** AC-7 in full; `grep -c adaptive tests/fixtures/manifest.json`
    no longer 0 · **Pre-review:** security (recommended — `ci.yml` is a sensitive path)

- [ ] **Slice 9: agent-count and documentation surface** (FR-10.1–10.4)
  - **Files:** `README.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `src/claude.md`
  - **Changes:** 14 → 15 in every **live** location incl. the two Model-Profiles count statements;
    `debugger` row in the agent table; Agency Roles row + "Cross-Session Learning" subsection in
    `src/claude.md`. **README's historical v3.x-upgrade statement stays untouched.**
    `scripts/ci/validate-agents.js` untouched (floor of 13).
  - **Verify:** `[ "$(ls agents/*.md|wc -l|tr -d ' ')" = "15" ] && grep -q '15 specialized' README.md &&
    grep -q '## The 15 Agents' README.md && grep -q '15 specialized' .claude-plugin/plugin.json &&
    grep -q '15 specialized' .claude-plugin/marketplace.json && grep -q '| Debugger | ' src/claude.md &&
    ! grep -q '14 specialized' README.md && node scripts/ci/validate-version-consistency.js &&
    node scripts/ci/validate-triage-parity.js`
  - **Done when:** 15 everywhere live, historical statements untouched · **Pre-review:** none

| Wave | Slices | Files (union) — literal | Rationale |
|---|---|---|---|
| 1 | 1 | `hooks/handlers/session-start-spine.js`, `templates/instincts.md`, `tests/hooks/test-instincts-injection.js` | Tracer alone; pins the schema and proves the hook path end-to-end |
| 2 | 2,3,4 | isolation-guard, shrink-guard, `hooks/hooks.json`, the two guard tests; `agents/debugger.md`, `scripts/ci/lib/model-profiles.js`, `install.sh`, `templates/.gitignore`; `agents/planner.md`, `skills/bootstrap-feature/SKILL.md` | Disjoint; each depends only on Wave 1's template |
| 3 | 5,6,7,8,9 | implement-slice; merge-ready; develop-feature; `scripts/ci/validate-fixture-manifest.js`, `tests/fixtures/manifest.json`, `.github/workflows/ci.yml`, 3 new ci fixture trees, 2 new agent fixture dirs; `README.md`, both `.claude-plugin/*.json`, `src/claude.md` | Disjoint; all reference the `debugger` agent or the 15-count from Wave 2 |

## PRD gaps found by the planner (8) — handle at Gate 7 unless noted

1. **BLOCKING, resolved in Slice 8** — fixture-manifest id grammar cannot match `TC-FR*` ids
2. **Resolved in Slice 5** — FR-8.5's counter vs the isolation guard (subagents can't write scratchpad)
3. Recorded — mid-wave corrections can't reach a running subagent; two BEHAVIORAL cases unexercisable
4. **Resolved in Slice 3** — FR-8.2's "append" is impossible with Write-and-no-Edit; Read-then-Write
5. Decided in Slice 3 — `debugger` profile values `sonnet/sonnet/sonnet/inherit`, confirm at pre-review
6. §11.6's row calling the QA doc "still a Section 4 artifact" is now stale — one-line doc-updater fix
7. AC-15 already satisfied at HEAD — no slice needed
8. `hooks.json` isolation-guard description under-describes the new PROTECTED set — folded into Slice 2

## Blockers

- none

## Completed (v4.0 roadmap)

- F1 (§6) `6e0c55e` · F2a (§7) `cbe586d` · F2b (§8) `9cffb22` · F3 (§9) `2c7272d` ·
  defect fixes `19b29ce` · F4 (§10) `9172301` — all merged, pushed, CI green (54 asset steps, 10 validators)
