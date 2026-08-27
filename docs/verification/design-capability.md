---
feature: design-capability
verdict: PRESENT_BEHAVIOR_UNVERIFIED
passed: false
gaps:
  - level: 2
    finding: "Bare TODO scaffold marker (by-design template placeholder per FR-2.2)"
    location: "templates/rules/design.md:3"
    verifies_with: "None required — WARNING-tier only, template is expected to ship with TODO scaffolding; noted for completeness"
  - level: 2
    finding: "Bare TODO scaffold marker (Design System Source of Truth section, by-design per FR-2.2)"
    location: "templates/rules/design.md:12"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (Component Library section, by-design per FR-2.2)"
    location: "templates/rules/design.md:20"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (Typography section, by-design per FR-2.2)"
    location: "templates/rules/design.md:27"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (Motion Tokens section, by-design per FR-2.2)"
    location: "templates/rules/design.md:34"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (Aesthetic Direction section, by-design per FR-2.2)"
    location: "templates/rules/design.md:41"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (Ban-List section, by-design per FR-2.2)"
    location: "templates/rules/design.md:52"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (Preview section, by-design per FR-2.2)"
    location: "templates/rules/design.md:64"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO scaffold marker (AI Interface Patterns section, by-design per FR-2.2)"
    location: "templates/rules/design.md:80"
    verifies_with: "None required — WARNING-tier only, by-design scaffolding"
  - level: 2
    finding: "Bare TODO token in prose documenting the unattended-run placeholder example, e.g. TODO(design-foundation): confirm the primary audience (by-design per FR-3.2's non-blocking clause)"
    location: "skills/design-foundation/SKILL.md:21"
    verifies_with: "None required — WARNING-tier only, documented behavior text, not incomplete implementation"
  - level: 2
    finding: "Bare TODO token in prose instructing the skill to leave a labeled TODO scaffold for undecided fields (by-design per FR-3.2)"
    location: "skills/design-foundation/SKILL.md:57"
    verifies_with: "None required — WARNING-tier only, documented behavior text"
  - level: 2
    finding: "Bare TODO token in prose describing findings left as TODO in the generation report (by-design per FR-3.2)"
    location: "skills/design-foundation/SKILL.md:61"
    verifies_with: "None required — WARNING-tier only, documented behavior text"
  - level: 4
    finding: "design-reviewer's full visual-evidence-chain review behavior (reading design.md, the Preview trust gate, screenshot capture/viewing, Before|After|Why table, PASS/FAIL verdict) has never been exercised by any automated test or recorded run — all 43 corresponding QA test cases (TC-1.1 through TC-16.2) are registered with fixture: null and the note 'design-reviewer fixtures are deferred until an invocation harness exists'"
    location: "tests/fixtures/manifest.json:589-990"
    verifies_with: "Commit the fixture projects each TC note describes (trusted-registry entry, seeded .claude/rules/design.md with a ## Preview section, seeded violations) and run design-reviewer against them, or capture a transcript of a real Gate 8 invocation and record it as discriminating evidence"
  - level: 4
    finding: "design-foundation's actual generation process (subject-grounding, token derivation, self-check pass, write) has never been exercised — every BEHAVIORAL QA case for it (TC-2.2, TC-2.3, TC-2.5, TC-2.6, TC-7.1, TC-7.3, TC-8.6, etc.) is marked 'Not automatable in CI today' with no committed fixture repository"
    location: "docs/qa/design-capability_test_cases.md:70-143"
    verifies_with: "Run /design-foundation against a seeded fixture repository (existing tokens, greenfield repo, agent-facing UI) and capture the generated .claude/rules/design.md plus its self-check report as evidence"
  - level: 4
    finding: "bootstrap-feature's conditional trigger of design-foundation for an unattended, user-facing feature with no existing design.md has never been observed firing — TC-3.3/TC-3.4 are marked 'Not automatable in CI today', and the non-blocking unattended marker described in the trigger line (skills/bootstrap-feature/SKILL.md:36) has no recorded invocation showing design-foundation actually degrading to TODO placeholders without stalling"
    location: "skills/bootstrap-feature/SKILL.md:36"
    verifies_with: "Run /bootstrap-feature for a seeded user-facing feature request against a project with no .claude/rules/design.md and capture the transcript showing design-foundation invoked with the unattended marker and completing without AskUserQuestion stalls"
  - level: 4
    finding: "The live rendering of Gate 8 from a real /merge-ready run (PASS/FAIL with an actual design-reviewer report, SKIPPED (tier: quick), and N/A for a backend-only feature, and their mutual distinctness) has never been captured — TC-9.2, TC-10.1, TC-11.1, TC-11.2, and TC-14.2 are all marked 'Not automatable in CI today'"
    location: "docs/qa/design-capability_test_cases.md:152-201"
    verifies_with: "Run /merge-ready on a real user-facing feature, on a tier: quick request touching UI files, and on a backend-only feature, and capture each transcript's Gate 8 line as recorded evidence that the three renderings are actually distinct in practice"
human_verification_required:
  - "Run design-reviewer against a seeded, trusted fixture project with a declared .claude/rules/design.md ## Preview section and confirm it displays the command verbatim, runs the trust gate, captures/views screenshots, and produces a Before|After|Why table with a PASS/FAIL verdict."
  - "Run /design-foundation against a seeded repository (with and without existing design tokens) and confirm it produces a complete .claude/rules/design.md via the subject-grounding → token-derivation → self-check → write process described in FR-3.2."
  - "Run /bootstrap-feature for a user-facing feature in a project with no .claude/rules/design.md and confirm design-foundation is triggered unattended, completes without stalling on AskUserQuestion, and leaves labeled TODO placeholders for anything it cannot infer."
  - "Run /merge-ready end-to-end on a real user-facing feature, a tier: quick feature touching UI, and a backend-only feature, and confirm Gate 8 renders PASS/FAIL, SKIPPED (tier: quick), and N/A respectively, and that these three outcomes are visibly distinct in the report."
generated_at: 2026-08-27 17:03
---

## Verification Report

### Level 1 — File Existence: PASS
- All 3 planned new files exist: `agents/design-reviewer.md`, `templates/rules/design.md`, `skills/design-foundation/SKILL.md`.
- All 12 planned modified files exist: `skills/merge-ready/SKILL.md`, `skills/implement-slice/SKILL.md`, `skills/bootstrap-feature/SKILL.md`, `hooks/handlers/stop-gate-evidence.js`, `tests/hooks/test-stop-gate-evidence.js`, `scripts/ci/lib/model-profiles.js`, `scripts/ci/validate-model-profile.js`, `scripts/ci/validate-context-budget.js`, `install.sh`, `README.md`, `src/claude.md`, `CLAUDE.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `tests/fixtures/manifest.json`.

### Level 2 — No Stubs/Placeholders: PASS
- 12 WARNING-tier bare `TODO` markers found, all by design and non-blocking:
  - `templates/rules/design.md:3,12,20,27,34,41,52,64,80` — the template's scaffolded sections, matching `templates/CLAUDE.md`'s existing TODO-scaffolding convention per FR-2.2. This is the product, not an unfinished implementation.
  - `skills/design-foundation/SKILL.md:21,57,61` — prose documenting the skill's own non-blocking unattended-run behavior (leaving labeled `TODO` placeholders in a *generated* file when the pipeline runs unattended, per FR-3.2), not incomplete implementation in the skill itself.
- No BLOCKER-tier markers (`TBD`, `FIXME`, `XXX`, `stub`, `not implemented`, `throw new Error('Not implemented')`, `raise NotImplementedError`, `pass  # TODO`) found in any new or modified production file for this feature.
- Two pre-existing, unrelated `TODO` occurrences (`install.sh:1538,1544,1575`, `README.md:353`) belong to the pre-existing `templates/CLAUDE.md` scaffold-generation surface, not this feature's diff, and are not counted here.
- `tests/fixtures/manifest.json`'s BLOCKER/WARNING-tier fixture entries (lines 103-226) are the `verifier` agent's own self-test fixtures for marker classification (a different capability), not design-capability content.

### Level 3 — Wiring: PASS
- Gate 8 delegation: `skills/merge-ready/SKILL.md:207-208` contains `Delegate to \`design-reviewer\`` and the `.claude/rules/design.md` referent.
- `hooks/handlers/stop-gate-evidence.js:88` — `GATE_AGENTS` includes `'design-reviewer'`.
- `tests/hooks/test-stop-gate-evidence.js` — 7 assertions (lines 205-387) reference `design-reviewer` alongside the other four gate agents.
- `scripts/ci/lib/model-profiles.js:30` — `design-reviewer` row present (`quality: opus, balanced: opus, budget: opus, inherit: 'inherit'`); header comment (line 17) lists it among the opus roles.
- `install.sh:105` — `AGENT_ROLES` includes `design-reviewer`; lines 844/860/876 — all three `model_for_role()` case arms present.
- `install.sh:1504` — `scaffold_cp` line copies `templates/rules/design.md` into `.claude/rules/design.md`; lines 218, 240, 1579, 1609 — CREATES listing, Next-steps text, and skills enumeration all reference the new template/skill.
- `skills/bootstrap-feature/SKILL.md:36` — conditional trigger line for `design-foundation`.
- `skills/implement-slice/SKILL.md:103` — UI-slice sentence referencing `.claude/rules/design.md`.
- `README.md:261,275,284,551,566,579` and `src/claude.md:19,135` — both rosters updated with `design-reviewer` and `/design-foundation`.
- No dynamic `import()`/`require()` in this wiring; nothing to mark `SKIPPED` at this level.

### Level 4 — Data Flow: WARN
- **Exercised, with discriminating evidence:**
  - `test-stop-gate-evidence.js`'s `design-reviewer` assertions — red-phase recorded (7 assertions FAILED before the handler edit, per `.claude/scratchpad.md` Slice 3), passing after. This exercises the GATE_AGENTS wiring hop only.
  - `install.sh --init-project`'s `scaffold_cp` copy of `templates/rules/design.md` — a real sandboxed run produced a byte-identical diff (Slice 6). This exercises the first hop of the chain: template → consuming project's `.claude/rules/design.md`.
  - `model_for_role()` for `design-reviewer` executed live in a sandboxed run, returning `opus/opus/opus/inherit` correctly (Slice 1).
- **Traced but not exercised (the second hop and beyond):** no automated test, E2E scenario, or recorded transcript shows `design-reviewer` actually reading a project's `.claude/rules/design.md` at Gate 8 time, running the Preview trust gate, capturing/viewing evidence, or producing its Before|After|Why report — all 43 corresponding QA test cases are registered with `fixture: null` in `tests/fixtures/manifest.json`, explicitly noted as "deferred until an invocation harness exists." The same is true of `design-foundation`'s generation process and `bootstrap-feature`'s unattended trigger of it, and of Gate 8's live PASS/FAIL/SKIPPED/N/A rendering from an actual `/merge-ready` run — every corresponding QA case is marked "Not automatable in CI today."
- This matches the chain named in the delegation prompt: the `install.sh --init-project → .claude/rules/design.md` hop has real evidence; the `design-reviewer reads it at Gate 8` hop does not.

### Overall: PRESENT_BEHAVIOR_UNVERIFIED
- Levels 1-3 all PASS, and nothing is undeterminable (Level 4 was not `SKIPPED` — real chains were traced with real parameters). Level 4 found the feature's central behavior — `design-reviewer` actually reviewing UI, and `design-foundation` actually generating a declaration — structurally wired and correctly parameterized, but with no exercised path per (a)/(b)/(c): no automated test, no E2E scenario, and no recorded transcript demonstrates either agent actually running end-to-end. Per the verdict precedence, this is the honest default: present and correctly wired, nothing demonstrating it runs.
