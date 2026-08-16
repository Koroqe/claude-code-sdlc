---
feature: adaptive-tier-routing
verdict: PRESENT_BEHAVIOR_UNVERIFIED
passed: false
gaps:
  - level: 2
    finding: "WARNING-tier `TODO` marker inside the `--init-project` heredoc that emits a scaffold PRD version-history row; intentional template content for the adopter to fill in, and it predates F4."
    location: "install.sh:1283"
    verifies_with: "Confirm the line sits inside the `cat > docs/PRD.md << EOF` heredoc of the scaffold path and is emitted as template text, not executed logic; no code change is expected."
  - level: 2
    finding: "WARNING-tier `TODO` marker inside the same `--init-project` heredoc, as the scaffold PRD overview placeholder line; intentional template content that predates F4."
    location: "install.sh:1289"
    verifies_with: "Confirm the line sits inside the scaffold heredoc and is emitted as template text, not executed logic; no code change is expected."
  - level: 2
    finding: "WARNING-tier `TODO` marker in the `--init-project` next-steps echo instructing the adopter to fill in the scaffolded placeholders; intentional user-facing text that predates F4."
    location: "install.sh:1319"
    verifies_with: "Confirm the string is a next-steps instruction printed after scaffolding, not a deferred-work note on harness code; no code change is expected."
  - level: 4
    finding: "No CI run exists for any F4 implementation commit — origin/feat/adaptive-tier-routing points at af28d6b, the pre-implementation plan commit, whose ci.yml contains zero F4 steps, and all 16 implementation commits are unpushed."
    location: ".github/workflows/ci.yml:65-283"
    verifies_with: "Push feat/adaptive-tier-routing or open its pull request, then confirm the two new pass steps (model-profile drift, triage parity), the seven model-profile falsify/control steps, the triage-parity falsify step, the two effort falsify steps and the two new anti-vacuity steps all report as intended."
  - level: 4
    finding: "The end-to-end behaviour of `install.sh --profile` has no committed repeatable check — CI runs only `bash -n` plus two greps against the file, so the two-phase preflight/commit rewrite, the receipt write and the abort semantics are never re-executed."
    location: "install.sh:807-966"
    verifies_with: "Add a CI job that copies the tree to a scratch checkout and asserts, in one run, that `--local --profile budget` changes exactly 8 files, that a seeded body-line `model: sonnet` survives byte-identical, that `--profile inherit` rewrites all 14, and that a seeded frontmatter defect aborts with zero modified files and no receipt."
  - level: 4
    finding: "`templates/statusline.js` is executed by nothing committed — the four fixture scratchpads and stdin-full.json under tests/fixtures/statusline/ are referenced only by plan prose in .claude/scratchpad.md, no runner exists under tests/, and no ci.yml step names the file."
    location: "templates/statusline.js:1-423"
    verifies_with: "Add a runner or CI step that pipes tests/fixtures/statusline/stdin-full.json into `node templates/statusline.js` from each of the active, no-plan, all-done and corrupt fixture directories and asserts the wave/slice and gates segments, their omission, and the non-empty cost-bearing line on corrupt input."
  - level: 4
    finding: "The statusline stdin contract is unverified and its fixture cannot falsify it — the renderer's own FR-13.4 header records the cost and token/context field names as UNDETERMINED, and the fixture states it is not a captured live payload but is constructed from the renderer's own candidate lists, so a passing run proves only self-consistency."
    location: "tests/fixtures/statusline/stdin-full.json:2"
    verifies_with: "Capture real statusline stdin from a live session using the tee idiom recorded in the renderer header, record the actual cost and token field names, then re-point COST_PATHS, USED_TOKEN_PATHS, MAX_TOKEN_PATHS and RESERVE_TOKEN_PATHS at the captured names and replace the constructed fixture."
  - level: 4
    finding: "FR-7.6 is unresolved: whether an already-running session re-reads agents/*.md frontmatter or snapshots it at plugin load could not be determined, so the rewritten `model:` value has never been observed reaching its consumer."
    location: "install.sh:49-73"
    verifies_with: "Install the plugin via /plugin marketplace add plus /plugin install, run install.sh --local --profile against that installed checkout, then invoke a rewritten agent without restarting the session or reinstalling, and observe whether the new model value took effect."
  - level: 4
    finding: "FR-1 triage classification has never produced a tier decision — validate-triage-parity.js proves the two copies of Steps 1-7 are byte-identical and both enumerate the 9 fixed sensitive-path defaults, but byte parity is not classification behaviour."
    location: "skills/develop-feature/SKILL.md:38-72"
    verifies_with: "Drive the QA document's UC-1 through UC-4 behavioural cases and assert that the stated tier and its specific FR-1.3/1.4/1.5/1.6 signal appear in the response before any Edit or Write call, including the upward tie-break and the sensitive-path union."
  - level: 4
    finding: "FR-2 escalation mechanics have never fired — neither the fast-to-quick trigger, the quick-to-full triggers, the FR-2.4(c) tier rewrite as the first tool call, the ceiling, nor the no-automatic-downgrade rule has been observed."
    location: "skills/develop-feature/SKILL.md:107-133"
    verifies_with: "Drive a fast-tier run whose edit turns out to touch a second file and a quick-tier run that reaches a sensitive path, asserting that the tier rewrite is the first tool call after the escalation statement and that a subsequent /merge-ready reads `## Tier: full`."
  - level: 4
    finding: "FR-4's quick-tier gate subset has never run — the Tier Check preamble, the five `SKIPPED (tier: quick)` rows, the re-read finalization trigger and the `Gates: N/9` progress line are asserted only as literal strings in the skill file."
    location: "skills/merge-ready/SKILL.md:18-71"
    verifies_with: "Run /merge-ready against a scratchpad reading `## Tier: quick` and assert that Gates 0, 2, 3 and 4 execute, that Gates 1, 5, 6, 7 and 8 render as `SKIPPED (tier: quick)`, and that `Gates: N/9` is refreshed by Edit after each terminal gate."
  - level: 4
    finding: "Neither override skill has been invoked, so `/sdlc-fast`'s deliberate `Agent` tool grant has never carried its own mandated escalation and FR-6.3's literal-token-only activation is unobserved."
    location: "skills/sdlc-fast/SKILL.md"
    verifies_with: "Invoke /sdlc-fast on a change that turns out to touch a second file and assert it escalates by calling planner through the Agent tool rather than dead-ending, then issue an unprefixed request whose prose contains the word quickly and assert it is still classified by FR-1."
  - level: 4
    finding: "planner's Quick-Tier Contract and its digest-index consultation are unexercised, and docs/digest-index.md ships with its header and zero data rows — no doc-updater run has appended one and no planner run has selected from one."
    location: "agents/planner.md:27-31"
    verifies_with: "Run QA cases TC-15.1, TC-15.2 and TC-15.3 as single-agent planner invocations against a seeded 9-row digest and against an absent digest, and TC-16.1 and TC-16.2 as doc-updater invocations asserting one appended row and then an in-place refresh."
  - level: 4
    finding: "53 of the 100 documented test cases (10 FIXTURE and 43 BEHAVIORAL) have no executor anywhere in the repository, and the QA document states both classes are not automatable in this repository's CI today."
    location: "docs/qa/adaptive-tier-routing_test_cases.md:457"
    verifies_with: "Execute the 10 FIXTURE cases as single named-agent invocations against their stated inputs and drive the 43 BEHAVIORAL cases through live /develop-feature, /sdlc-fast, /sdlc-quick and /merge-ready runs, recording each outcome, or add a driver that does so."
human_verification_required:
  - "A human must push this branch or open its pull request so that the F4 CI steps execute for the first time; origin currently carries only the pre-implementation plan commit, so no validator step added by this feature has ever run."
  - "A human must confirm the Slice 1 tracer run described in .claude/scratchpad.md actually occurred as recorded, since no committed artifact preserves it and no committed automation re-runs `install.sh --profile` against a scratch checkout."
  - "A human must capture real statusline stdin from a live Claude Code session to settle FR-13.4, because the committed fixture is constructed from the renderer's own guessed field names and therefore cannot falsify them."
  - "A human must settle FR-7.6 by installing the plugin, running --profile against the installed checkout and invoking a rewritten agent without restarting, to establish whether a running session picks up the new model values."
  - "A human must drive the 43 BEHAVIORAL cases through live pipeline runs, since triage classification, one-way escalation, the quick-tier gate subset and the two override skills are multi-turn orchestration behaviours no static read can confirm."
  - "A human or a future eval harness must run the 10 FIXTURE cases as single-agent invocations, since this repository has no mechanism to invoke a Claude agent headlessly and assert on its output."
generated_at: "2026-08-16 18:05"
---

## Verification Report

### Level 1 — File Existence: PASS

Every path declared in the nine slices' `Files:` fields resolves on disk, including all thirteen
`[new]` artifacts.

- Slice 1: `install.sh`, `README.md`, `.gitignore`, `docs/PRD.md`.
- Slice 2: `skills/develop-feature/SKILL.md`, `src/claude.md`, `templates/rules/security.md`.
- Slice 3: `skills/bootstrap-feature/SKILL.md` (plus the two above).
- Slice 4: `agents/planner.md`, `skills/implement-slice/SKILL.md`.
- Slice 5: `skills/merge-ready/SKILL.md`, `docs/digest-index.md` [new].
- Slice 6: `skills/sdlc-fast/SKILL.md` [new], `skills/sdlc-quick/SKILL.md` [new] — `skills/` holds
  exactly 7 `SKILL.md` files.
- Slice 7: all 14 `agents/*.md` carry `effort:`, split exactly 3 low / 6 medium / 5 high;
  `scripts/ci/validate-agents.js`; both `tests/fixtures/ci/bad-agent-effort*` fixtures [new].
- Slice 8: `scripts/ci/lib/model-profiles.js` [new], `scripts/ci/validate-model-profile.js` [new],
  all six `tests/fixtures/ci/model-profile/*` trees [new], `.github/workflows/ci.yml`.
- Slice 9: `templates/statusline.js` [new], `templates/settings.json`, all five
  `tests/fixtures/statusline/*` artifacts [new].

**Observation, not a failure:** two committed artifacts appear in no slice's `Files:` field —
`scripts/ci/validate-triage-parity.js` and `tests/fixtures/ci/triage-parity/bad-step4-drift/`, both
added in `6ac6741` after the plan was recorded. They are fully wired (see Level 3), but the plan of
record under-describes the delivered change, so the scratchpad is not a complete expected-artifact
list for this feature.

### Level 2 — No Stubs/Placeholders: PASS

No BLOCKER-tier marker exists in any F4-touched production file.

Three WARNING-tier findings, all in the `--init-project` scaffold path and all predating F4:

- `install.sh:1283` — WARNING (`TODO`), a scaffold PRD version-history row inside a heredoc.
- `install.sh:1289` — WARNING (`TODO`), the scaffold PRD overview placeholder inside the same heredoc.
- `install.sh:1319` — WARNING (`TODO`), a next-steps echo telling the adopter to fill the placeholders in.

Considered and dismissed, with reasons, rather than filed:

- `install.sh:610,660,847,859,911` — the six-character `XXXXXX` in `mktemp` templates is that
  command's required randomisation syntax, not the `XXX` incompleteness marker.
- `scripts/ci/validate-verification-upgrade.js:212-214`, `scripts/ci/validate-personal-paths.js:36-78`
  — the marker vocabulary itself, as string-literal data tables inside the linters that search for it.
- `scripts/ci/validate-verification-upgrade.js:443`, `scripts/ci/validate-hooks.js:8`,
  `templates/statusline.js:246`, `src/claude.md:23` — the words `stub` and `placeholder` inside
  error messages, explanatory comments and a role description.
- `agents/verifier.md:57,63,65,67,76` — this agent's own specification of the marker vocabulary.

Markdown prompt files are excluded from the marker scan by rule. Because markdown is this project's
production artifact, they were scanned anyway; the only hits are the self-referential ones listed above.

### Level 3 — Wiring: PASS

Every new artifact has at least one consumer, and no link rests on a dynamic import.

- `install.sh --profile` → parsed at `install.sh:1410`, validated at `1444` (requires `--local`,
  mutually exclusive with `--uninstall`/`--restore`/`--init-project`/`--trust-project`), dispatched to
  `do_profile` at `1455`; `model_for_role()` at `756` is additionally text-parsed by
  `scripts/ci/validate-model-profile.js:126-167`.
- `.sdlc-model-profile` receipt → written at `install.sh:847-853`, read by
  `validate-model-profile.js:109-118`, anchored in `.gitignore` as `/.sdlc-model-profile`.
- `scripts/ci/lib/model-profiles.js` → `require`d at `validate-model-profile.js:54` (static literal).
- `scripts/ci/validate-model-profile.js` → registered in `ci.yml` as one pass step, seven
  falsify/control steps and one anti-vacuity step.
- `scripts/ci/validate-triage-parity.js` → registered in `ci.yml` as one pass step, one falsify step
  and one anti-vacuity step; reads the real `skills/develop-feature/SKILL.md` and `src/claude.md`.
- `effort:` on 14 agents → consumed by `validate-agents.js:32-33,84-88` via `REQUIRED_FIELDS` and
  `VALID_EFFORT_LEVELS`, with two falsify steps in `ci.yml`.
- `skills/sdlc-fast`, `skills/sdlc-quick` → discovered through `.claude-plugin/plugin.json`'s
  `"skills": "./skills/"`, documented at `src/claude.md:133-136` and `README.md:133,142-143`.
- `templates/statusline.js` → declared by `templates/settings.json:38-40` as
  `node .claude/statusline.js`, copied by `install.sh:1270` during `--init-project`; it uses only
  static `require('fs')` and `require('path')`.
- `docs/digest-index.md` → written by `skills/merge-ready/SKILL.md:193`, read by `agents/planner.md:27-31`.
- `## Tier:` field → affirmatively written by `skills/bootstrap-feature/SKILL.md:109`, read by
  `skills/develop-feature/SKILL.md:70-72`, `skills/implement-slice/SKILL.md:27-46,69` and
  `skills/merge-ready/SKILL.md:18-71`.

### Level 4 — Data Flow: WARN

The data paths connect end-to-end; the criteria (a)/(b)/(c) were applied to each part separately, and
none is satisfied.

**What is genuinely built to be exercised, and how far that goes.** This feature is materially more
exercisable than its predecessor, and that is worth stating plainly. `install.sh --profile` is a real
shell program with real file outputs. `validate-model-profile.js` (311 lines) and
`validate-triage-parity.js` (275 lines) are real zero-dependency Node that read the actual repository
tree — the actual `agents/*.md` `model:` values, the actual `model_for_role()` case arms, the actual
Steps 1-7 blocks in both triage copies — never hardcoded stand-ins. Each ships seeded-bad fixtures
asserted through `--expect-failure` on a specific substring, so a red run names the assertion that
fired rather than merely reporting a mismatch, and `committed-receipt` passes plainly while failing
under `--assert-baseline`, proving that guard is load-bearing. `templates/statusline.js` (423 lines)
is real Node with four committed fixture scenarios. These are the ingredients of a decisive result.

**Why none of them clears (a), (b) or (c) today.**

- **(a) — an existing automated test that calls the new code path and asserts on its output.** The
  `--expect-failure` steps are exactly such assertions in substance, but they live in
  `.github/workflows/ci.yml`, which is neither a project test directory nor a `*.test.*`/`*.spec.*`
  file. The one real test runner in the repository, `tests/hooks/run-tests.js`, covers hooks only and
  touches no F4 code. Nothing under `tests/` executes `install.sh --profile`, any F4 validator, or
  `templates/statusline.js`. The four statusline fixture directories are referenced only by plan prose
  in `.claude/scratchpad.md` — no committed automation consumes them.
- **(b) — an E2E scenario naming the flow.** `docs/use-cases/adaptive-tier-routing_use_cases.md` names
  all 18 flows, but it is a requirements document authored before implementation, not an executable
  scenario; this project has no application and no E2E suite. Counting it would make every documented
  feature self-verifying.
- **(c) — a traced chain with a named entrant that itself runs.** This is where the decisive fact sits.
  The CI chain is the strongest candidate: `ci.yml` is registered, triggers on `push: ['**']`, and the
  chain from job step to validator to real repository tree carries real data at every link. But
  `origin/feat/adaptive-tier-routing` points at `af28d6b`, `chore(core): add implementation plan for
  adaptive tier routing` — a scratchpad-only commit that contains none of
  `scripts/ci/validate-model-profile.js`, `scripts/ci/validate-triage-parity.js`,
  `templates/statusline.js` or `skills/sdlc-fast/SKILL.md`, and whose `ci.yml` matches zero F4 step
  names. All 16 implementation commits, `d5aa22b` through `6ac6741`, are unpushed. **No CI run exists
  for any commit of this feature.** The chain is registered and has been entered by nobody. Per this
  agent's own rule, a parameter-clean chain with no entrant that has run does not satisfy (c).
  - The installer chain's entrant is a human ad-hoc CLI invocation. `.claude/scratchpad.md` records a
    specific, falsifiable run — 8 files changed under `budget`, a seeded body-line `model: sonnet`
    surviving byte-identical (which would distinguish a fence-bounded `awk` rewrite from a naive
    `s/^model:/`), all 14 rewritten under `inherit`, and zero files modified on a preflight abort.
    That is credible and is not dismissed here. But it is repository prose with no committed artifact,
    it is not reproducible by anything in the tree, and it will not catch a regression.
  - The statusline chain's entrant is Claude Code's own `statusLine` mechanism inside an installed
    adopter project — outside this repository, never observed here. Its fixture additionally cannot
    falsify the thing most in doubt: `tests/fixtures/statusline/stdin-full.json:2` states it is not a
    captured live payload but is modelled on the renderer's own `COST_PATHS`/`USED_TOKEN_PATHS`/
    `MAX_TOKEN_PATHS`/`RESERVE_TOKEN_PATHS` candidate lists, and `templates/statusline.js:41-58`
    records those field names as UNDETERMINED. A passing fixture run demonstrates self-consistency
    with a guess.
  - The routing chains — triage, escalation, the quick-tier gate subset, the two override skills,
    planner's Quick-Tier Contract — are entered only by a live orchestrating session. None has run.
    `validate-triage-parity.js` asserts something real about this prose: that both copies of Steps 1-7
    are byte-identical and that both still enumerate all 9 fixed sensitive-path defaults, checked
    independently of the parity diff so a default dropped from both copies in one edit still fails.
    That is a genuine invariant over real content. It is not classification behaviour.

The QA document's own accounting agrees: it classifies 47 of 100 cases STATIC and describes them as
runnable in CI today, but "runnable" is not "run" — only the validator subset is wired into `ci.yml`,
and that subset has not executed. The remaining 53 cases (10 FIXTURE, 43 BEHAVIORAL) have no executor
anywhere in the repository, which the document states directly.

### Overall: PRESENT_BEHAVIOR_UNVERIFIED

Reached by precedence condition 4, after the first three were tested and did not match:

1. **Not FAILED** — Level 1 PASS (every declared artifact exists), Level 2 PASS (zero BLOCKER-tier
   markers; three WARNING-tier `TODO`s in pre-existing scaffold text), Level 3 PASS (every new
   artifact has a consumer).
2. **Not UNCERTAIN** — Level 1 was determinable from the plan in `.claude/scratchpad.md`, Level 3
   resolved every `require` as a static literal with no dynamic import to skip, Level 4 was not
   SKIPPED (there were paths to trace and they were traced), and no finding is ambiguous under static
   analysis: each gap names the specific step that would close it.
3. **Not VERIFIED** — Level 4 confirms no exercised path under (a), (b) or (c). The decisive fact is
   that origin carries only the pre-implementation plan commit, so the CI machinery this feature
   builds against — the one candidate whose entrant is automatic rather than human — has never run for
   any of this code.
4. **PRESENT_BEHAVIOR_UNVERIFIED** — Levels 1-3 pass, nothing is undeterminable, and Level 4 traced
   every path and found none demonstrating that the feature runs.

This verdict is about evidence, not quality. The gap between this feature and `VERIFIED` is narrower
than for any prior feature in this repository, and most of it closes with one push: the ten CI
validators, the eleven new seeded-bad falsify assertions and the two new anti-vacuity steps would
report for the first time, converting gap 1 and much of gap 14 into recorded results. What would still
remain is the deliberately unautomated remainder — the installer's end-to-end profile run, the
statusline renderer and its unverified stdin contract, the two open spikes (FR-7.6, FR-13.4), and the
routing behaviour itself, which only a live pipeline run can show.

## Amendments after generation

**Gap 4 is closed.** At generation time `origin/feat/adaptive-tier-routing` pointed at `af28d6b` — the
pre-implementation plan commit — so no CI run existed for any F4 commit, and criterion (c)'s
named-entrant requirement correctly refused to count the validators as exercised. The branch has since
been pushed at `cd3994f`. GitHub Actions run 31961651378 completed **success** across all four jobs,
with **54 steps** in `Validate harness assets` (up from 39 before F4). Every step this feature added
executed for the first time: both new pass steps, the seven model-profile falsify and control steps,
the triage-parity falsify step, the two effort falsify steps, and the two new anti-vacuity steps.

This also converts much of gap 14: the 53 STATIC cases now run on every push rather than only locally.

**The verdict is unchanged.** `PRESENT_BEHAVIOR_UNVERIFIED` still stands, and the substantive gaps
remain exactly as recorded: the installer's end-to-end `--profile` behaviour has no committed
repeatable check (CI runs only `bash -n` plus two greps); `templates/statusline.js` is executed by
nothing committed and its stdin contract is unverified by construction, since the fixture is built
from the renderer's own guessed field names; both spikes (FR-7.6 plugin-snapshot semantics, FR-13.4
stdin field names) remain open and honestly recorded as such; and the routing behaviour itself —
triage classification, one-way escalation, the quick-tier gate subset, both override skills — is
multi-turn orchestration that no static read and no CI step can confirm.

**A correction worth recording.** The delegation prompt for this Gate 6 run asserted "Ten CI validators
run on every push." That was false at the time, and the verifier checked rather than accepting it.
Being wrong in the safe direction — refusing to credit an unentered chain — is the behaviour the
four-verdict scheme exists to produce.
