## Feature: Adaptive Tier Routing and Model Routing (v4.0 roadmap F4)
## Branch: feat/adaptive-tier-routing
## Status: complete
## Tier: full

## Docs

- PRD `docs/PRD.md` §10 (lines ~1910–2225) — FR-1..FR-13, AC-1..AC-31
- Use cases `docs/use-cases/adaptive-tier-routing_use_cases.md` — UC-1..UC-18
- QA `docs/qa/adaptive-tier-routing_test_cases.md` — 100 TCs (47 STATIC / 10 FIXTURE / 43 BEHAVIORAL)
- Architecture: **PASS** (retry 2 of 2) · Plan critic: 4 BLOCKER + 7 WARNING, all fixed in rev. 2

## Binding constraints C1–C6 — do NOT re-open

- **C1** `## Tier:` quick→full rewrite is the **first tool call** after the escalation trigger.
  `bootstrap-feature` Step 7 affirmatively writes `## Tier:` on every init so it is owned, never stale.
- **C2** `skills/sdlc-fast/SKILL.md` `allowed-tools` **MUST include `Agent`** — the mandated escalation
  needs `planner`/`test-writer`/`build-runner`. No-subagent is instruction-enforced. Never tighten.
- **C3** Quick-tier absence carve-outs live in **delegation prompts, verbatim, before the request**.
  `agents/code-reviewer.md` and `agents/test-writer.md` are NOT modified (beyond `effort:`).
- **C4** Quick tier passes the literal `no-changelog` token; `/merge-ready` Finalization owns the single write.
- **C5** FR-1.7 sensitive paths are **union** — the fixed default is always active, project declarations
  are additive only and structurally cannot narrow it.
- **C6** `install.sh` rewrite: awk fence-bounded, **same-directory** `mktemp`, per-file exactly-one-
  substitution assertion, preflight all 14 → then commit all 14 (preflight failure → **zero** modified),
  receipt only after all 14. Never `sed -i`, never `node`/`jq`.

## CRITICAL execution rule (plan-critic BLOCKER 2)

**Every `install.sh --profile` invocation runs against a throwaway `cp -R` copy with its own fresh
`git init` — NEVER the real checkout.** `install.sh:486` resolves `SCRIPT_DIR` to the real repo, so a
direct run rewrites the live `agents/*.md`. If the real tree is ever touched:
`git checkout -- agents/ && rm -f .sdlc-model-profile`.

## Plan (9 slices, 5 waves)

### Wave 1 [complete]

- [x] **Slice 1 [DONE 63bd950]: `install.sh --profile` — two-phase rewrite, receipt, dry-run, spike, receipt hygiene**
  - **Wave:** 1
  - **Tracer:** yes
  - **Use cases:** UC-10 (+A1–A4, EC1, EC2), UC-12 (+EC1), UC-13 (+A1, EC1), UC-14 (write side, A1);
    AC-7, AC-8, AC-11, AC-13, AC-29, AC-30
  - **Files:** `install.sh`, `README.md`, `.gitignore`, `docs/PRD.md`
  - **Changes:** Step 0 = FR-7.6 spike (does a running session re-read agent frontmatter or snapshot at
    plugin load?) recorded in `install.sh`'s header + README. Add `--profile <quality|balanced|budget|
    inherit>`; REQUIRES `--local`; mutually exclusive with `--uninstall`, `--restore`, `--init-project`,
    `--trust-project`. `model_for_role()` as `case` arms in exactly `<profile>:<role>) echo <model> ;;`
    shape plus one `inherit:*) echo inherit ;;` wildcard (the FR-10.3 contract Slice 8 text-parses).
    C6 idiom verbatim. `--dry-run` prints 14 current/target pairs, modifies nothing. Only the `model:`
    frontmatter line is ever touched — `effort:` excluded by name. `.gitignore` gains
    `.sdlc-model-profile`. README gains the model-profiles section. PRD FR-7.1 amended to name
    `--trust-project`. **Verification runs only against throwaway copies (see CRITICAL rule above).**
  - **Verify:**
    ```
    bash -n install.sh \
    && test -z "$(grep -nE '(^|[^a-zA-Z])(node|jq)([^a-zA-Z]|$)' install.sh | grep -v '^[0-9]*: *#')" \
    && grep -qxF '.sdlc-model-profile' .gitignore \
    && grep -qF -- '--trust-project' docs/PRD.md \
    && node scripts/ci/validate-version-consistency.js && node scripts/ci/validate-verification-upgrade.js \
    && R="$PWD" && T="$(mktemp -d)" && cp -R "$R" "$T/r" && cd "$T/r" && rm -rf .git \
    && git init -q && git -c user.email=t@t -c user.name=t add -A \
    && git -c user.email=t@t -c user.name=t commit -qm base \
    && ! bash install.sh --profile budget \
    && bash install.sh --profile budget 2>&1 | grep -qi -- '--local' \
    && test -z "$(git status --porcelain)" \
    && ! bash install.sh --local --profile budget --uninstall \
    && ! bash install.sh --local --profile budget --trust-project \
    && bash install.sh --local --profile budget --dry-run && test -z "$(git status --porcelain)" \
    && echo "model: sonnet" >> agents/test-writer.md \
    && git -c user.email=t@t -c user.name=t commit -qam body-seed \
    && bash install.sh --local --profile budget \
    && test "$(git diff --name-only | wc -l | tr -d ' ')" = 8 \
    && grep -qF 'model: sonnet' agents/architect.md && grep -qF 'model: haiku' agents/test-writer.md \
    && tail -1 agents/test-writer.md | grep -qxF 'model: sonnet' \
    && grep -qF 'model: opus' agents/security-auditor.md \
    && test "$(cat .sdlc-model-profile)" = budget \
    && git checkout -q -- agents && rm -f .sdlc-model-profile \
    && bash install.sh --local --profile inherit \
    && test "$(grep -l '^model: inherit$' agents/*.md | wc -l | tr -d ' ')" = 14 \
    && git checkout -q -- agents && rm -f .sdlc-model-profile \
    && awk '/^---$/{f++} !(f==1 && /^model: /)' agents/architect.md > a.tmp && mv a.tmp agents/architect.md \
    && git -c user.email=t@t -c user.name=t commit -qam preflight-seed \
    && ! bash install.sh --local --profile budget \
    && test -z "$(git status --porcelain)" && test ! -f .sdlc-model-profile \
    && cd "$R" && rm -rf "$T" \
    && test -z "$(git status --porcelain -- agents/)" && test ! -f "$R/.sdlc-model-profile"
    ```
  - **Done when:** the whole Verify chain exits 0 in one run; the spike finding is in both `install.sh`'s
    header and the README; `.gitignore` ignores the receipt; the real checkout shows zero `agents/`
    modifications and no receipt afterwards.
  - **Pre-review:** security (MANDATORY — first programmatic rewrite of version-controlled files)

### Wave 2 [complete]

- [x] **Slice 2 [DONE 84c964b]: Triage Phase 0 + fast-tier execution + sensitive-path union**
  - **Wave:** 2 · **Use cases:** UC-1..UC-4 + sub-flows; AC-1, AC-2, AC-31
  - **Files:** `skills/develop-feature/SKILL.md`, `src/claude.md`, `templates/rules/security.md`
  - **Changes:** new **Phase 0: Triage** before Phase 1 — FR-1.2 estimated file set stated; FR-1.3(a)–(d)
    full-forcing signals checked FIRST; FR-1.4 fast signals (ALL required); FR-1.5 quick; FR-1.6 upward
    tie-break; FR-1.7 fixed defaults (`auth`, `payment`, `billing`, `secret`, `migration` segments
    case-insensitive; `.github/workflows/`; `install.sh`; `.claude/settings.json`; `docs/PRD.md`) **unioned**
    with an optional project `## Sensitive Paths`, additive only (C5); FR-1.8 reason stated before any
    Edit/Write. Fast branch: Read-before-Edit, direct edits, zero Agent calls, commit, mandatory changelog
    entry, no scratchpad write. Quick branch: dispatch summary. Full: unchanged. `src/claude.md` restates
    triage identically for the unprefixed path. `templates/rules/security.md` gains the additive-only section.
  - **Verify:**
    ```
    grep -qF "Phase 0" skills/develop-feature/SKILL.md \
    && for f in skills/develop-feature/SKILL.md src/claude.md; do \
         for s in auth payment billing secret migration '.github/workflows/' 'install.sh' '.claude/settings.json' 'docs/PRD.md'; do \
           grep -qF -- "$s" "$f" || exit 1; done; \
         grep -qiF "estimated file set" "$f" || exit 1; grep -qF "tier: fast" "$f" || exit 1; done \
    && grep -qF "## Sensitive Paths" templates/rules/security.md \
    && grep -qiE "never (replace|narrow)" templates/rules/security.md \
    && grep -qF "no-changelog" skills/develop-feature/SKILL.md \
    && node scripts/ci/validate-skills.js && node scripts/ci/validate-personal-paths.js \
    && node scripts/ci/validate-unicode-safety.js && node scripts/ci/validate-verification-upgrade.js
    ```
  - **Done when:** both copies carry the complete signal set and all 9 fixed defaults; the fast branch
    states all five FR-3 invariants; union wording present; all four validators exit 0.
  - **Pre-review:** security (MANDATORY — untrusted project input feeds tier classification)

### Wave 3 [complete]

- [x] **Slice 3 [DONE 67f88e9]: One-way escalation mechanics + scratchpad tier ownership**
  - **Wave:** 3 · **Use cases:** UC-6, UC-7, UC-8 + sub-flows; AC-3, AC-4, AC-5, AC-23
  - **Files:** `skills/develop-feature/SKILL.md`, `skills/bootstrap-feature/SKILL.md`, `docs/PRD.md`
  - **Changes:** FR-2.1 fast→quick trigger checked BEFORE the triggering call; FR-2.3 mechanics; FR-2.2(a)/(b)
    quick→full triggers incl. the mid-run sensitive-path / >3-file check; **FR-2.4(c) tier rewrite as the
    first tool call, before `/bootstrap-feature` or any gate/agent call (C1)**; FR-2.5 ceiling; FR-2.6 no
    automatic downgrade. **Pinned idiom (W7): every mutation of an EXISTING scratchpad uses Edit, never a
    whole-file Write** — `pre:write:shrink-guard` fires on Write only, threshold `max(floor(old*0.4),40)`,
    and its env escape is unavailable mid-session. `bootstrap-feature` Step 7 affirmatively writes `## Tier:`
    on every init; Step 5 delegation states the PRD section number and title. PRD FR-2.3(c)/2.4(c) amended.
  - **Verify:**
    ```
    grep -qF "## Tier:" skills/bootstrap-feature/SKILL.md \
    && grep -qiE "section number and title" skills/bootstrap-feature/SKILL.md \
    && grep -qiF "before any further gate or agent invocation" skills/develop-feature/SKILL.md \
    && grep -qiE "never .*(lowered|downgrade)" skills/develop-feature/SKILL.md \
    && grep -qiF "Edit, never a whole-file Write" skills/develop-feature/SKILL.md \
    && grep -qiF "Edit, never a whole-file Write" docs/PRD.md \
    && node scripts/ci/validate-skills.js && node scripts/ci/validate-verification-upgrade.js
    ```
  - **Done when:** both triggers stated as pre-call checks; the FR-2.4(c) ordering verbatim; no-downgrade
    and ceiling present; the Edit idiom pinned in both skill and PRD; validators exit 0.
  - **Pre-review:** security (MANDATORY — escalation mechanics)

- [x] **Slice 4 [DONE 36b0eca]: Quick-tier receiving ends — planner Quick-Tier Contract + implement-slice tier awareness**
  - **Wave:** 3 · **Use cases:** UC-5, UC-15 + sub-flows; AC-22, AC-26, AC-27
  - **Files:** `agents/planner.md`, `skills/implement-slice/SKILL.md`
  - **Changes:** planner gains a third narrow mode — **Quick-Tier Contract**: description in, exactly one
    slice out, no `**Tracer:** yes` marker, doc read skipped. Process step 1's unconditional
    "Read `docs/PRD.md`" becomes a scoped read of the current feature's own section. **Safe degradation (W9):
    when no section number is supplied, Grep for the heading and Read only that section — never the whole
    file, never a stall.** New step: read `docs/digest-index.md` if present, select 2–4 rows, read only those;
    absent index → proceed. `tools:` untouched. implement-slice: Pre-flight Check 4 skipped when
    `## Tier: quick`; `test-writer` delegation states the QA-absence carve-out verbatim before the request
    (C3); the quick tracer notice prints exactly `tracer gate inactive — tier: quick, single-slice plan is
    exempt from the tracer requirement by design.`; legacy wording retained for absent/`full`.
  - **Verify:**
    ```
    ! grep -qF 'Read `docs/PRD.md` — feature requirements' agents/planner.md \
    && grep -qF "Quick-Tier Contract" agents/planner.md && grep -qF "digest-index" agents/planner.md \
    && grep -qiF "does not supply the section number" agents/planner.md \
    && grep -qF 'tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]' agents/planner.md \
    && grep -qF "tracer gate inactive — tier: quick, single-slice plan is exempt from the tracer requirement by design." skills/implement-slice/SKILL.md \
    && grep -qF "treating as pre-F3 plan" skills/implement-slice/SKILL.md \
    && grep -qF "MUST NOT be treated as a missing input" skills/implement-slice/SKILL.md \
    && node scripts/ci/validate-agents.js && node scripts/ci/validate-verification-upgrade.js \
    && node scripts/ci/validate-skills.js
    ```
  - **Done when:** the old unqualified read phrasing is gone; both contracts, the fallback, both exact
    notice strings and the carve-out are present; `validate-verification-upgrade.js` still exits 0.
  - **Pre-review:** none

- [x] **Slice 5 [DONE ad0bbb7]: merge-ready Tier Check preamble + gate carve-outs + `Gates: N/9` + digest write**
  - **Wave:** 3 · **Use cases:** UC-5 (7–8), UC-16 + sub-flows; AC-5, AC-16, AC-25
  - **Files:** `skills/merge-ready/SKILL.md`, `docs/digest-index.md` `[new]`
  - **Changes:** unnumbered **Tier Check** preamble before Gate 0 (no renumbering): `full`/absent → 9 gates
    unchanged; `quick` → run Gates 0,2,3,4 and report 1,5,6,7,8 as `SKIPPED (tier: quick)` with FR-4.8's
    rationale. Gate 2/3 quick delegations state the absence carve-out verbatim before the review request (C3).
    Finalization trigger re-read as "all gates that were not `SKIPPED` report PASS" (Gates 5/8 keep `N/A`).
    Write/refresh `Gates: N/9` in the scratchpad via **Edit** after each terminal gate. Gate 7's `doc-updater`
    delegation, full tier only, appends/refreshes one digest row keyed on section number.
  - **Verify:**
    ```
    grep -qF "SKIPPED (tier: quick)" skills/merge-ready/SKILL.md \
    && grep -qF "MUST NOT be reported as a finding" skills/merge-ready/SKILL.md \
    && grep -qF "Gates: N/9" skills/merge-ready/SKILL.md \
    && grep -qiF "all gates that were not" skills/merge-ready/SKILL.md \
    && grep -qF "digest-index.md" skills/merge-ready/SKILL.md \
    && test -f docs/digest-index.md && grep -qF "| Section | Title | Summary" docs/digest-index.md \
    && node scripts/ci/validate-skills.js && node scripts/ci/validate-verification-upgrade.js
    ```
  - **Done when:** preamble, exact SKIPPED label, verbatim carve-out before the request, `Gates: N/9`
    instruction, re-read trigger and digest duty all present; the digest file exists with its header.
  - **Pre-review:** security (RECOMMENDED — a wrong tier read silently skips 5 gates)

### Wave 4 [complete]

- [x] **Slice 6 [DONE 800087a]: Override skills `/sdlc-fast` + `/sdlc-quick` + Pipeline Commands + README rows**
  - **Wave:** 4 · **Use cases:** UC-9 + sub-flows; AC-6, AC-21 (skills half), AC-28
  - **Files:** `skills/sdlc-fast/SKILL.md` `[new]`, `skills/sdlc-quick/SKILL.md` `[new]`, `src/claude.md`, `README.md`
  - **Changes:** `sdlc-fast` `allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent` — **`Agent` granted
    deliberately (C2)**; no-subagent enforced by instruction in the body; bypasses FR-1, runs FR-3 directly;
    restates FR-2 escalation; literal-token-only activation. `sdlc-quick` `allowed-tools` byte-identical to
    `develop-feature`'s; runs FR-4 directly with the `no-changelog` token. `src/claude.md` Pipeline Commands
    gains both, marked override-only. README skill count 5→7 plus both rows.
  - **Verify:**
    ```
    test "$(ls skills/*/SKILL.md | wc -l | tr -d ' ')" = 7 \
    && grep -qE '^allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent$' skills/sdlc-fast/SKILL.md \
    && test "$(grep '^allowed-tools:' skills/sdlc-quick/SKILL.md)" = "$(grep '^allowed-tools:' skills/develop-feature/SKILL.md)" \
    && grep -qF "/sdlc-fast" src/claude.md && grep -qF "/sdlc-quick" src/claude.md \
    && grep -qF "no-changelog" skills/sdlc-quick/SKILL.md && grep -qF "/sdlc-quick" README.md \
    && node scripts/ci/validate-skills.js && node scripts/ci/validate-verification-upgrade.js
    ```
  - **Done when:** skill count is exactly 7; `sdlc-fast`'s allowed-tools line matches exactly incl. `Agent`;
    `sdlc-quick`'s matches `develop-feature`'s byte-for-byte; validators exit 0.
  - **Pre-review:** none

- [x] **Slice 7 [DONE 4a6d4c8]: `effort:` across all 14 agents + validator support + falsify fixtures**
  - **Wave:** 4 · **Use cases:** UC-10-A2; AC-12, NFR-6
  - **Files:** all 14 `agents/*.md`, `scripts/ci/validate-agents.js`,
    `tests/fixtures/ci/bad-agent-effort/agents/bad-effort.md` `[new]`,
    `tests/fixtures/ci/bad-agent-effort-missing/agents/missing-effort.md` `[new]`
  - **Changes:** one `effort:` line per agent — **low**: build-runner, doc-updater, prd-writer;
    **medium**: ba-analyst, code-reviewer, e2e-runner, qa-planner, refactor-cleaner, test-writer;
    **high**: architect, planner, security-auditor, plan-critic, verifier. `model:` untouched.
    `validate-agents.js`: `REQUIRED_FIELDS` gains `'effort'`, plus `VALID_EFFORT_LEVELS` = low|medium|high.
    Field lands on all 14 in the same commit as the requirement. CI wiring for the fixtures is Slice 8's.
  - **Verify:**
    ```
    test "$(grep -l '^effort: low$' agents/*.md | wc -l | tr -d ' ')" = 3 \
    && test "$(grep -l '^effort: medium$' agents/*.md | wc -l | tr -d ' ')" = 6 \
    && test "$(grep -l '^effort: high$' agents/*.md | wc -l | tr -d ' ')" = 5 \
    && grep -qF 'effort: high' agents/verifier.md && grep -qF 'model: sonnet' agents/verifier.md \
    && node scripts/ci/validate-agents.js \
    && node scripts/ci/validate-agents.js --root tests/fixtures/ci/bad-agent-effort --min 1 --expect-failure "is not a known level" \
    && node scripts/ci/validate-agents.js --root tests/fixtures/ci/bad-agent-effort-missing --min 1 --expect-failure "effort" \
    && node scripts/ci/validate-agents.js --root tests/fixtures/ci/bad-agent --min 1 --expect-failure "frontmatter fence" \
    && node scripts/ci/validate-verification-upgrade.js
    ```
  - **Done when:** the split is exactly 3/6/5; the validator passes the real tree and fails each fixture on
    its named substring; the pre-existing bad-agent fixture is proven not rotted by the new required field.
  - **Pre-review:** none

### Wave 5 [complete]

- [x] **Slice 8 [DONE 2face79]: CI drift check — shared table, validator with `--assert-baseline`, fixtures, ALL CI wiring**
  - **Wave:** 5 · **Use cases:** UC-11, UC-14 (read side); AC-9, AC-10
  - **Files:** `scripts/ci/lib/model-profiles.js` `[new]`, `scripts/ci/validate-model-profile.js` `[new]`,
    six `tests/fixtures/ci/model-profile/*` trees `[new]`, `.github/workflows/ci.yml`, `docs/PRD.md`
  - **Changes:** shared zero-dep table module; validator on `core.run` resolving the profile from
    `.sdlc-model-profile` (absent → `quality`; unrecognized → its own named failure, never silently
    defaulted); per-file `model:` comparison reporting file/found/expected; FR-10.3 **text-parse** (never
    execute) of `install.sh`'s case arms, byte-compared to the JS table, run iff `<root>/install.sh` exists.
    **New `--assert-baseline` (B4): any `.sdlc-model-profile` present at the validated root fails by name** —
    this closes the hole where a contributor commits both a rewritten tree and a matching receipt and CI
    blesses it. Six fixtures incl. `committed-receipt` (internally consistent, passes plainly, fails only
    under the flag — proving the guard is load-bearing). `ci.yml` is this slice's sole ownership and wires
    every new step **including Slice 7's two effort falsifies**. PRD FR-9/FR-10 amended.
  - **Verify:**
    ```
    node scripts/ci/validate-model-profile.js && node scripts/ci/validate-model-profile.js --assert-baseline \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/no-receipt-fable --min 1 --expect-failure "agents/architect.md: model 'fable', expected 'opus'" \
    && node scripts/ci/validate-agents.js --root tests/fixtures/ci/model-profile/no-receipt-fable --min 1 \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/stale-file --min 1 --expect-failure "agents/build-runner.md: model 'sonnet', expected 'haiku'" \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/install-table-mismatch --min 1 --expect-failure "balanced:plan-critic" \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/inherit-wildcard --min 1 \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/bad-receipt --min 1 --expect-failure "unrecognized profile 'fable'" \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/committed-receipt --min 1 \
    && node scripts/ci/validate-model-profile.js --root tests/fixtures/ci/model-profile/committed-receipt --min 1 --assert-baseline --expect-failure "must never be committed" \
    && node scripts/ci/validate-model-profile.js --root "$(mktemp -d)" --expect-failure "matches too few files" \
    && grep -qF -- '--assert-baseline' .github/workflows/ci.yml \
    && grep -qF 'bad-agent-effort' .github/workflows/ci.yml \
    && grep -qF -- '--assert-baseline' docs/PRD.md
    ```
  - **Done when:** the validator passes the real receiptless tree both plain and with the flag, fails every
    fixture on its named substring, `committed-receipt` passes plainly but fails under the flag, and CI
    wires all steps including the effort falsifies.
  - **Pre-review:** security (`.github/workflows/` is an FR-1.7 sensitive path)

- [x] **Slice 9 [DONE abf3ed7]: Statusline — spike, renderer, template wiring, scaffold copy**
  - **Wave:** 5 · **Use cases:** UC-17, UC-18 + sub-flows; AC-17..AC-20
  - **Files:** `templates/statusline.js` `[new]`, `templates/settings.json`, `install.sh`,
    `tests/fixtures/statusline/{stdin-full.json,active,no-plan,all-done,corrupt}` `[new]`
  - **Changes:** Step 0 = FR-13.4 spike capturing real statusline stdin JSON field names, recorded in the
    renderer's header. Renderer: zero-dependency Node builtins only; five segments
    `<feature> | wave W slice N/M | gates G/9 | $cost | <context bar>`; wave/slice omitted when no plan or
    all slices DONE (**keyed on plan absence, never a tier read** — a non-escalated fast run never writes a
    scratchpad, so `## Tier: fast` never exists); gates omitted without a `Gates: N/9` line; bar =
    `(max − reserve − used)/(max − reserve)` floored at 0, reserve subtracted from BOTH terms; whole body in
    an error boundary that still prints a non-empty line on any failure. Not a hook — no `hooks.json` entry.
    `templates/settings.json` gains the statusLine command; `install.sh --init-project` copies the file
    (a `cp`, never an execution; any `node` mention stays in comments so the CI grep stays empty).
  - **Verify:**
    ```
    node --check templates/statusline.js \
    && (cd tests/fixtures/statusline/active && node ../../../../templates/statusline.js < ../stdin-full.json) | grep -qF "wave 2 slice 1/2" \
    && (cd tests/fixtures/statusline/active && node ../../../../templates/statusline.js < ../stdin-full.json) | grep -qF "gates 4/9" \
    && O="$( (cd tests/fixtures/statusline/no-plan && node ../../../../templates/statusline.js < ../stdin-full.json) )" \
       && test -n "$O" && ! echo "$O" | grep -qE "wave|gates" \
    && O="$( (cd tests/fixtures/statusline/corrupt && node ../../../../templates/statusline.js < ../stdin-full.json) )" \
       && test -n "$O" && echo "$O" | grep -qF '$' \
    && test -z "$(grep -oE "require\('[^']+'\)" templates/statusline.js | grep -vE "'(fs|path|os|process)'")" \
    && grep -qF '"statusLine"' templates/settings.json \
    && grep -qF 'statusline.js' install.sh && bash -n install.sh \
    && test -z "$(grep -nE '(^|[^a-zA-Z])(node|jq)([^a-zA-Z]|$)' install.sh | grep -v '^[0-9]*: *#')" \
    && test -z "$(grep -rF 'statusline' hooks/ skills/ agents/ src/ 2>/dev/null)" \
    && test "$(ls hooks/handlers/*.js | wc -l | tr -d ' ')" = 9
    ```
  - **Done when:** all fixture renders match, omission is never `0/0`, a corrupt scratchpad still yields a
    non-empty cost-bearing line, the spike finding is in the header, and the reverse-dependency grep is empty.
  - **Pre-review:** none

| Wave | Slices | Files (union) — literal | Rationale |
|---|---|---|---|
| 1 | 1 | `install.sh`, `README.md`, `.gitignore`, `docs/PRD.md` | Tracer alone — the one executable end-to-end mechanism, isolated so its copy-confined profile runs cannot race sibling `agents/*.md` edits |
| 2 | 2 | `skills/develop-feature/SKILL.md`, `src/claude.md`, `templates/rules/security.md` | Alone because Slice 3 reopens `develop-feature` next wave |
| 3 | 3,4,5 | `skills/develop-feature/SKILL.md`, `skills/bootstrap-feature/SKILL.md`, `docs/PRD.md`, `agents/planner.md`, `skills/implement-slice/SKILL.md`, `skills/merge-ready/SKILL.md`, `docs/digest-index.md` | Tier-aware receiving ends, pairwise disjoint; S4's fallback dissolves the S3↔S4 ordering hazard |
| 4 | 6,7 | `skills/sdlc-fast/SKILL.md`, `skills/sdlc-quick/SKILL.md`, `src/claude.md`, `README.md`, all 14 `agents/*.md`, `scripts/ci/validate-agents.js`, `tests/fixtures/ci/bad-agent-effort/agents/bad-effort.md`, `tests/fixtures/ci/bad-agent-effort-missing/agents/missing-effort.md` | Overrides need Wave 3's escalation text; `effort:` reopens `agents/planner.md` after S4 |
| 5 | 8,9 | `scripts/ci/lib/model-profiles.js`, `scripts/ci/validate-model-profile.js`, six `tests/fixtures/ci/model-profile/*` trees, `.github/workflows/ci.yml`, `docs/PRD.md`, `templates/statusline.js`, `templates/settings.json`, `install.sh`, five `tests/fixtures/statusline/*` | Validator needs S1's table and S7's `effort:`; statusline reopens `install.sh` in a different wave from S1 |

Cross-wave repeats are sequential: `install.sh` W1→W5 · `README.md` W1→W4 · `docs/PRD.md` W1→W3→W5 ·
`src/claude.md` W2→W4 · `develop-feature` W2→W3 · `agents/planner.md` W3→W4.
**Actual-write audit:** the only `Verify:` that mutates files is Slice 1's, confined to a throwaway copy.

## Named deferral

`scripts/ci/validate-fixture-manifest.js` hardcodes the F3 QA doc and enforces a bijection, so F4's 10
FIXTURE TCs can neither be registered nor left registered-but-unchecked without generalizing it to
multiple QA docs — cross-feature infrastructure no F4 requirement schedules. **Deferred to F5.** Nothing
CI-automatable in F4 depends on it.

## Implementation notes

- **Tracer executed for real** — `install.sh --profile budget` against a throwaway copy changed exactly
  8 files, and a deliberately seeded `model: sonnet` line in a file *body* survived byte-identical,
  proving the awk fence-counter is frontmatter-bounded rather than a naive `s/^model:/`.
- Two spikes reported honestly as **UNDETERMINED** rather than invented: FR-7.6 (does a running session
  re-read agent frontmatter or snapshot it?) and FR-13.4 (statusline stdin token-usage field names).
  Both record what would settle them. The statusline degrades to `ctx: unknown`, never a fabricated bar.
- **Defect found and fixed:** `.gitignore`'s `.sdlc-model-profile` had no path anchor, so it silently
  ignored that filename at any depth — including fixture roots that need it as content. Caught by
  re-verifying from a clean `git clone` rather than local disk state. Now anchored to `/`.

## Merge-ready gate results

Gate 0 PASS · Gate 1 PASS · Gate 2 code review **PASS** (1 MAJOR + 2 MINOR fixed) ·
Gate 3 security **PASS** (1 MEDIUM + 3 LOW fixed) · Gate 4 PASS (54 CI steps, 16 hook test files) ·
Gate 5 N/A · **Gate 6 `PRESENT_BEHAVIOR_UNVERIFIED`** (14 gaps) · Gate 7 PASS · Gate 8 N/A

**Gate 6's decisive finding:** the branch had never been pushed, so no CI run existed for any F4
commit — criterion (c)'s named-entrant rule correctly refused to credit validators nothing had
entered. It also corrected a false premise in its own delegation prompt. Pushing closed that gap
(run 31961651378, 54 asset steps, all four jobs green); the verdict stands because the substantive
gaps remain: no committed repeatable check for `install.sh --profile` end-to-end, the statusline
executed by nothing committed with an unverified stdin contract, both spikes open, and the routing
behaviour itself only observable in a live multi-turn run.

**Defects caught at merge-ready and fixed:** both triage copies claimed a CI parity check that did
not exist (now built — `validate-triage-parity.js`); the model-table drift check silently skipped
unparseable case arms, so a reformatted arm could diverge while CI stayed green (proven real, then
closed bidirectionally); unguarded `mktemp` under `set -e` could bypass temp cleanup; `## Tier:` had
no branch for an unrecognized value (now fails closed to all 9 gates).

## Blockers

- none

## Completed

- F1 (§6) 6e0c55e · F2a (§7) cbe586d · F2b (§8) 9cffb22 · F3 (§9) 2c7272d · defect fixes 19b29ce
- All pushed, GitHub CI green (4 jobs, asset job 39 steps)
