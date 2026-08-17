---
feature: self-improvement-loop
verdict: PRESENT_BEHAVIOR_UNVERIFIED
passed: false
timestamp_utc: 2026-08-17T02:50:00Z
branch: feat/self-improvement-loop-v4
level_1_file_existence: PASS
level_2_no_stubs: PASS
level_3_wiring: PASS_WITH_CAVEATS
level_4_data_flow: WARN
gaps:
  - level: 4
    finding: "Elevation (FR-3.3), the confidence-recompute-on-new-occurrence-only precedence rule (FR-3.4/FR-1.4), decay (FR-3.4) and retirement (FR-4.1/FR-4.2) are specified only as prose in the Consolidate Instincts section. No code executes this arithmetic and no test drives it."
    location: "skills/merge-ready/SKILL.md:466-538"
    verifies_with: "Run a feature through /merge-ready twice with a seeded .claude/instincts.md and confirm by hand that Occurrences, Confidence, Last confirmed at and Retires at move as C2 specifies. No automated driver exists in this repository."
  - level: 4
    finding: "All four capture triggers (FR-2.1-2.3) and FR-2.4's wave-level aggregation are orchestrator prose. The skill files are structurally wired — loaded when their slash command runs — but whether the model performs dedup-before-mint, correct tallying and correct category assignment at runtime is unverified by any executor."
    location: "skills/implement-slice/SKILL.md; skills/merge-ready/SKILL.md:368-439; skills/develop-feature/SKILL.md:201-216"
    verifies_with: "Drive a multi-slice feature that fires the same deviation rule twice and confirm exactly one instinct entry is minted, not two near-duplicate slugs."
  - level: 4
    finding: "FR-6.2a's attach-time D1 validation and FR-6.3's post-return confirmation are prose in planner's prompt. Only the prose ITSELF is mechanically pinned; the model's runtime compliance is not. This is the channel the PRD calls 'strictly worse than injection' — verbatim repo-controlled text flowing into an executed plan — and it has no code-level enforcement analogous to session-start-spine.js's RULE_RE."
    location: "agents/planner.md:37-71; scripts/ci/validate-instinct-discipline.js:75-137"
    verifies_with: "Invoke planner against a store containing a D1-failing Rule: line and confirm the returned plan omits it entirely rather than attaching it raw. FIXTURE-classified (TC-12.1); no CI driver."
  - level: 4
    finding: "debugger's bounded 5-hypothesis-cycle loop, its Read-then-Write persistence discipline (it holds Write without Edit) and its 2-of-3-attempt auto-invocation trigger are agent-prompt behavior with no executable test."
    location: "agents/debugger.md:32-87"
    verifies_with: "Seed a double gate failure and confirm debugger is invoked without a human asking, and that it merges rather than truncates .claude/debug/ state. FIXTURE-classified."
  - level: 2
    finding: "PRD Section 11.3's FR-5 subsection stops at FR-5.7, yet Section 11.1 Design Decision 5 references 'FR-5.8' as a defined subsection. Documentation-numbering defect, not missing behavior: the content FR-5.8 would have specified — the honesty statement that D1's regex constrains characters, not semantics — is implemented verbatim in the hook's threat-model header."
    location: "docs/PRD.md:2261 (reference); docs/PRD.md:2317-2325 (FR-5.1-5.7); hooks/handlers/session-start-spine.js:39-48 (content present)"
    verifies_with: "Either add an FR-5.8 heading to Section 11.3 carrying the honesty statement, or repoint Design Decision 5 and QA TC-11.7 at Design Decision 5 directly. Independently confirmed by the QA document at TC-11.7, which labels it a documented limitation rather than a defect."
---

# Verification Report — F5 Self-Improvement Loop

> **Provenance note.** This gate ran against the stale user-level `verifier` agent, which shadowed the
> plugin copy and carried only `Read`/`Glob`/`Grep` — not the `Write` tool `agents/verifier.md` grants.
> The agent therefore returned its report inline and the orchestrator transcribed it here unaltered in
> substance. This is Risk 3 from the v4.0 roadmap observed in practice, and a seventh instance of the
> recurring class this project keeps finding: a requirement no agent could obey with the tools it
> actually had.

## Verdict scheme and precedence

Four verdicts: `VERIFIED` / `PRESENT_BEHAVIOR_UNVERIFIED` / `FAILED` / `UNCERTAIN`.

- **FAILED** beats every other verdict: any missing file, any wired chain whose head is not entered by
  something that itself runs (dead export, unregistered hook, orphaned validator), or any mechanical
  contradiction between two supposedly-shared definitions — for example D1 diverging between the hook
  and the agent prose.
- **VERIFIED** requires BOTH structural wiring (the artifact is reachable from a real entry point) AND
  a real, executed assertion that would fail if the behavior regressed.
- **PRESENT_BEHAVIOR_UNVERIFIED** applies when the artifact is present, textually correct against the
  PRD, and genuinely loaded by a real orchestrating context — but the behavior it describes is
  performed by the model at runtime with no code executor. Prose in a file nothing ever loads would
  instead be FAILED.
- **UNCERTAIN** applies only where static analysis genuinely cannot resolve which of the above holds.
  Not used in this run.
- Overall verdict is the worst among all in-scope groups: `FAILED` > `UNCERTAIN` >
  `PRESENT_BEHAVIOR_UNVERIFIED` > `VERIFIED`.

## Level 1 — File existence: PASS

Every `Files:` entry across all 11 slices exists on disk, checked directly rather than trusted from the
scratchpad: the three hook handlers and `hooks.json`; `templates/instincts.md` (exactly three `## `
headings, `Feature counter: 0`, no seeded entries); the three new hook test files; `agents/debugger.md`
(the `agents/*.md` glob returns exactly 15 files); `scripts/ci/lib/model-profiles.js`, `install.sh` and
`templates/.gitignore` carrying the `debugger` rows; `agents/planner.md` and all four skill files;
`scripts/ci/validate-fixture-manifest.js` and `tests/fixtures/manifest.json`; `README.md`, both
`.claude-plugin/` manifests and `src/claude.md`; and `scripts/ci/validate-instinct-discipline.js` with
its seeded fixture trees. No expected artifact was missing.

`tests/fixtures/ci/instinct-discipline/bad-weakened-dedup/` is not itemized in the scratchpad's Slice 11
file list but is wired into `.github/workflows/ci.yml` — an addition made during the gate pass itself,
not a gap.

## Level 2 — No stubs or placeholders: PASS

All production surfaces were scanned for `TODO|FIXME|XXX|HACK|placeholder|not implemented|stub`. The
only hits were the literal tool name `TodoWrite` in skill frontmatter and the gate-description string
`"Level 2 — No Stubs/Placeholders"` inside merge-ready's own checklist — both false positives. No
genuine stub found.

## Level 3 — Wiring: PASS (with a documented behavioral caveat)

Criterion (c) applied strictly: a chain counts as wired only when its head is entered by something that
itself runs.

**Genuinely code-wired** — `session:start:spine` is registered once in `hooks/hooks.json:26` and
dispatched through `hooks/lib/run-hook.js`'s handler map; the hook budget is unchanged at 9 distinct ids
across 10 registrations. `pre:agent:isolation-guard`'s `PROTECTED` array and `pre:write:shrink-guard`'s
`isCurated()` both contain `.claude/instincts.md`, each exercised by real child-process tests. Both new
validators are invoked from CI, including seeded-bad fixture runs and anti-vacuity `mktemp -d` runs.
`agents/debugger.md` is registered in `scripts/ci/lib/model-profiles.js` and in `install.sh`'s
`AGENT_ROLES` plus all three `model_for_role()` case arms, so it sits inside the drift-detection net
exactly as FR-8.9 requires rather than being silently exempted.

**Prose-wired** — the capture, consolidation, aggregation and attach steps live in skill and agent files
that are genuinely loaded on their respective invocations, satisfying "entered by something that runs"
at the file-loading level. They do not satisfy it at the arithmetic-execution level: nothing in the
repository parses `.claude/instincts.md`, applies the confidence formula, performs the
elevation/decay/retirement sweep, or validates a `Rule:` line against D1 except the hook's `RULE_RE`.

**D1 cross-consistency** — `agents/planner.md` names `RULE_RE` explicitly and restates D1's allowlist,
the 200-character bound and the exclude-silently rule in wording matching the hook verbatim in
substance. `validate-instinct-discipline.js` mechanically confirms the clause has not been weakened.
This is the strongest available evidence the two definitions have not drifted — but it is a
textual-consistency check, not proof that planner rejects a D1-failing line at invocation time.

No disconnected artifact was found; no new agent, skill, hook or validator sits unreferenced.

## Level 4 — Data flow: WARN

The FR-5 injection path is real and traced end to end: store on disk → `readCapped` (symlink-refusing)
→ `extractPreventionRules` (section scope → `Confidence ≥ 0.7` filter → top-6 sort with a
`Last confirmed at` tiebreak, all applied **before** `Rule:`-line extraction) → `RULE_RE` validation →
framing sentence emitted only when a rule survives → `sanitize.capBlock`. Verified against the hook's
own tests including the return-path restructure and the truncation-after-selection ordering.

The gap is the **producer** side: the code that writes `.claude/instincts.md` in the first place does
not exist as code at all. The consumer is verifiably correct against whatever the file contains, but
nothing proves the file's contents are ever produced correctly. This is the single largest data-flow
gap in the feature and the reason the overall verdict is not `VERIFIED`.

The FR-9 fixture-manifest flow is genuinely traced and real. The FR-6 and FR-8 flows cannot be traced
statically past the "agent file is loaded" point.

## Overall: PRESENT_BEHAVIOR_UNVERIFIED

Levels 1-3 pass in the sense that every planned artifact exists, contains no stub markers, and is
reachable from a real entry point — nothing sits orphaned. That would normally support PASS.

PASS is not reported, because a large fraction of this feature's described behavior — the confidence
arithmetic, elevation, retirement, all four capture triggers, the wave-aggregation fold, planner's
attach-time validation actually rejecting a bad `Rule:` line at runtime, and debugger's bounded
hypothesis loop — exists only as instructions inside markdown that a model reads and is expected to
follow. Of the QA document's 119 test cases (52 STATIC / 14 FIXTURE / 53 BEHAVIORAL), only the STATIC 52
run against executed code paths today. `validate-instinct-discipline.js` closes two of these gaps at the
textual level in the higher-risk planner-attachment path — a real, deliberate and well-targeted
backstop, but a backstop against prose *rotting*, not proof that the arithmetic *runs correctly*.

This matches the feature's own stated design: PRD Section 11 Design Decision 1 places capture,
consolidation and application inside pipeline points the orchestrating model already visits, not inside
new deterministic code. The loop is intentionally prose-driven except at its two highest-risk,
most attacker-reachable edges — session-start injection and the two wave-safety guards — both of which
are real code and are genuinely verified. This verdict reflects that split honestly rather than treating
"the prose says the right thing" as equivalent to "the behavior is proven."
