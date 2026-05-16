# Cognitive Self-Check Protocol

This rule houses **three complementary self-check protocols** that every in-scope thinking agent runs around emitting output:

1. **Protocol 3 — Inbound Task Validation (run FIRST, at task-receipt).** 4 questions about the inbound task / upstream context: is it nonsensical, is there an error in the upstream decision, what's the justification, would executing this amplify an upstream error? Output: `### Inbound validation` subsection of the `## Decisions` block. Catches nonsensical tasks the agent would silently execute, upstream errors propagated by mechanical execution, and silent contradiction-resolution between conflicting upstream sources.
2. **Protocol 1 — Fact-vs-Assumption Self-Check (on every claim).** 4 questions about the evidence behind every CLAIM the agent intends to make. Output: mandatory `## Facts` block. Catches hallucinated API fields, fabricated enum values, drifted PRD references, training-data recall masquerading as project knowledge.
3. **Protocol 2 — Decision-Quality Self-Check (on every decision).** 5 questions about the soundness of every non-trivial DECISION or recommendation the agent intends to make. Output: mandatory `## Decisions` block (emitted IMMEDIATELY AFTER `## Facts`). Catches band-aid fixes shipped as proper solutions, symptom-only patches that leave the root cause to compound, decisions made without considering alternatives, and "this feels right" decisions that a senior engineer would call nonsensical.

All three protocols are mandatory for every in-scope artifact. Execution order: Protocol 3 at task-receipt → Protocol 1 + Protocol 2 during authoring (interleaved per claim/decision) → both `## Facts` and `## Decisions` blocks emitted in the final output.

The named failure modes the protocols prevent:

- **Protocol 1 (Facts) prevents:** *fact-shaped lies* — an unverified assumption emitted as fact, breaking downstream consumers who trust it. Example: agent claims a status enum is `"PENDING"` from memory, ships the integration, the actual API returns `"in_progress"`, integration breaks at runtime.
- **Protocol 2 (Decisions) prevents:** *decision-shaped hacks* — an unprincipled choice shipped as a deliberate one, accumulating as technical debt. Example: agent picks SQLite for a multi-tenant system because "it's simpler" without considering the actual concurrency requirements, ships it, scales to 50 users, hits write-lock contention, costs three weeks of urgent migration work.
- **Protocol 3 (Inbound) prevents:** *propagated upstream errors* — a bad decision or contradiction in the input chain that compounds as it passes through more agents. Example: a plan slice instructs the implementer to "catch the exception and log a warning"; the implementer mechanically executes, the underlying race condition stays, three sprints later it surfaces in production as a data-loss bug nobody can trace because the catch-and-log mask hid every clue.

## Protocol 1 — Fact-vs-Assumption Self-Check

Before recording any claim, fact, verified statement, or recommendation that REFERENCES external state (code, docs, APIs, prior agents' output), ask yourself these four questions in order:

1. **На чём основано? / What is this claim based on?** (source)

   For internal claims: `file:line` you Read this session, command output you ran, PRD §N you cited, prior commit hash, prior agent's `## Facts` entry.

   For external claims (third-party APIs, SDKs, libraries): docs URL you opened this session, SDK version + symbol path you inspected, OpenAPI/proto file:line, type-stub file you Read, an actual API call you made.

   `"I remember from a similar API / from training data" is NOT a valid source.` Memory of comparable systems is suggestive, not evidential. Treat it as an assumption that requires verification, never as a fact.

2. **Проверил ли я это в текущей сессии? / Did I verify against current state this session?** (freshness)

   For files: did you Read the file in this conversation, or are you relying on memory from earlier turns that may have been compacted? Re-Read before acting on file content.

   For external contracts: did you open the docs / read the SDK source / inspect the type-stubs / call the endpoint *in this session*? Memory of contract details from prior sessions or training data is stale by definition.

3. **Что я предполагаю без доказательств? / What am I assuming without proof?** (assumption surfacing)

   List explicit assumptions before they hide inside conclusions. Especially for any field name, status enum value, error code, response shape, request shape, method signature, default behavior, rate limit, auth scheme, or version-specific behavior of an external system — if you can't cite where you read it *this session*, you are guessing.

4. **Если предположение — помечено ли оно? / If it's an assumption, is it labelled?** (audit trail)

   Decisions built on assumptions go under `### Assumptions` with a risk + verification path. Decisions about external contracts you haven't verified go under `### External contracts` with `verified: no — assumption` so the next agent or human can challenge them. An unlabelled assumption is a fact-shaped lie.

A claim that fails Q1 or Q2 is an **assumption**, not a fact. Reclassify it under the correct subsection of the `## Facts` block before continuing.

## Protocol 2 — Decision-Quality Self-Check

Before committing to any non-trivial decision, recommendation, architectural choice, refactor scope, dependency addition, schema change, mitigation strategy, or proposed-action item, ask yourself these five questions in order:

1. **Не костыль ли это? / Hack check.** (workaround detection)

   Am I solving the problem properly, or am I applying a band-aid that defers the real work? A workaround is *acceptable* IF it is explicitly labelled as such AND a real-fix path is tracked separately (a ticket, an `### Open questions` entry, a `### Symptom-only patches` line in this block). A workaround that pretends to be a real fix is a hack — and a hack shipped as a proper solution is the single most common form of decision-shaped lie.

   Decision examples that trip Q1: adding a `setTimeout(check, 500)` to "fix" a race condition instead of guarding the race; catching `Exception` and logging "shouldn't happen" instead of investigating WHY it happened; copying a problematic chunk of code "just for now" to avoid a refactor that would actually fix it.

2. **Не делаю ли я бред? / Sanity check.** (proportionality + senior-eyeball test)

   Step back. Would a senior engineer reading this in 6 months call it nonsensical? Is the complexity proportional to the problem size — am I solving a tiny problem with a huge solution, or a huge problem with a tiny solution? Am I about to introduce a pattern the project does not already have just to handle a single case? Am I about to use an abstraction (Factory / Builder / Adapter / Strategy) where a 5-line function would do?

   Decision examples that trip Q2: building a plugin system for two known integrations; introducing an event-bus for two services that could just call each other directly; writing a class hierarchy for what is functionally a switch statement; refactoring shared utilities ahead of the second consumer existing.

3. **Самое ли это логичное, доступное, актуальное решение? / Alternative evaluation.**

   Did I consider 2-3 alternatives and pick this one for stated reasons? Is this the most **logical** (right architecture for the problem shape), most **accessible** (most maintainable / readable / debuggable by the team), and most **current** (uses modern patterns and current versions, not legacy ones)? If I picked the first option I thought of, did I at least surface the alternatives I dismissed so a reviewer can challenge the dismissal?

   "I picked it because I remembered it" is NOT a valid reason — same anti-pattern as Q1 of the fact protocol. Memory of how a similar problem was solved elsewhere is suggestive, not evidence of fit.

4. **Лечу проблему или симптом? / Symptom vs cause.**

   Does my decision treat what the user reports / what tests are failing on (the symptom), or what actually causes it (the root cause)? Symptoms are visible by definition — they show up in error messages, failing tests, user complaints. Causes require digging — `git blame`, reading upstream code, talking to the original author. Treating only symptoms guarantees the problem recurs in a slightly different form.

   Decision examples that trip Q4: making a flaky test less flaky by adding retries (treats the symptom; the underlying race remains); silencing a deprecation warning instead of migrating to the new API (the deprecation will become a removal); adding a NULL check to fix a crash without asking why NULL got there.

5. **Решается ли корень проблемы? / Root cause.** (or, if not, is it tracked?)

   If my decision is symptom-only per Q4 — and sometimes that's the right trade-off; a hotfix the night before a demo is symptom-only on purpose — IS the root cause identified and tracked for follow-up? An untracked root cause is technical debt that compounds because nobody remembers it exists.

   Acceptable outcomes: root cause identified and a follow-up ticket / TODO / `### Symptom-only patches` entry is logged. Unacceptable outcomes: symptom-treated and root cause is "I don't know yet" with no investigation path.

A decision that fails Q1 (hack), Q2 (nonsensical), or Q3 (unconsidered alternatives) is a decision to RECONSIDER, not commit. A decision that's symptom-only per Q4 requires Q5 to be satisfied (root cause logged) — otherwise it falls back to Q1 as an unlabelled hack.

## Mandatory Facts Section

Every in-scope artifact MUST contain a `## Facts` block with the four subsections below, in this exact order. Empty subsections MUST use the literal placeholder `(none)` — never omit a subsection header. The literal heading is `## Facts` (capital F, no parentheses, no qualifiers); Plan Critic checks are exact-string greps.

```
## Facts

### Verified facts
- [fact] — source: [file:line | command output | PRD §N | prior commit hash | upstream agent's ## Facts entry] — salience: [high | medium | low]

### External contracts
- [API/SDK/library identifier] — symbol: [exact field/method/enum name] — source: [docs URL | SDK version + symbol path | OpenAPI/proto file:line | type-stub file:line] — verified: [yes | no — assumption] — salience: [high | medium | low]

### Assumptions
- [assumption] — risk: [what breaks if wrong] — how to verify: [next step | next agent | open question] — salience: [high | medium | low]

### Open questions
- [question] — needs: [user decision | architect call | external research | follow-up agent] — salience: [high | medium | low]
```

The `### External contracts` subsection is mandatory whenever the artifact references any third-party API/SDK/library identifier. If the feature has zero external integrations, write `(none)` — but every artifact still emits the heading.

**Salience field (neuroscience: anterior-insula salience-network analogue).** Every fact/assumption/contract/open-question entry carries a `salience:` tag with one of three values:

- **high** — if this fact is wrong / this assumption fails / this contract drifts / this question goes unanswered, the entire artifact's correctness is at risk. Reviewers MUST audit this entry first. Examples: the exact status enum value an external API returns, the assumption that a feature-flag is OFF in production, the open question about which database the feature targets.
- **medium** — affects correctness of a slice or a single decision, but not the whole artifact. Reviewers SHOULD audit this entry. Examples: the assumption that a library's default timeout is acceptable, a fact about adjacent code that informs but doesn't determine the slice scope.
- **low** — context-setting only. Useful to read but not load-bearing. Examples: "the file has 800 lines" or "the PRD has 7 acceptance criteria" — true, but doesn't change any decision if wrong.

Downstream agents (verifier, code-reviewer, security-auditor, consolidator) MUST sort by salience descending and audit **high** entries first when time-boxed. The salience tag mirrors how the brain's salience network gates attention — not all facts are equal; surface the ones that matter most. Default to `medium` when uncertain; explicit `low` is preferred over omission.

**Salience also drives retention in the agent-insights corpus** (`claudebase insight create --salience <tag>`). When the file `<project>/.claude/knowledge/insights.db` exists, agents surface load-bearing cognitive insights into the corpus and the salience tag chosen here is the SAME tag that controls how long the insight survives:

| Salience | Insights-corpus retention | When to use |
|---|---|---|
| `high` | indefinite — never gc'd | Insight whose loss would degrade the entire pipeline. Use sparingly. |
| `medium` | 365 days from ingestion | Insight affecting correctness of a slice or single decision. Default. |
| `low` | 90 days from ingestion | Context-setting / ambient observation only. Cheap to lose. |

`claudebase insight gc` purges rows past their salience-driven TTL. Marking everything `high` defeats the gc — be honest about which insights are truly load-bearing across sessions and which fade after a quarter. See `~/.claude/rules/knowledge-base-tool.md` § Insights corpus for the retrieval + surfacing protocol.

**Cognitive-load constraint:** list only facts that load-bear on the decision being made — not every file the agent read. The point is a navigable evidence trail for the load-bearing claims, not a comprehensive read-log. If a fact can be removed without changing the verdict, it does not belong in `### Verified facts`.

## Mandatory Decisions Section

Every in-scope artifact that contains decisions, recommendations, or proposed actions MUST emit a `## Decisions` block IMMEDIATELY AFTER the `## Facts` block. The literal heading is `## Decisions` (capital D, no parentheses, no qualifiers); Plan Critic checks are exact-string greps. The block has four subsections in this exact order; empty subsections use the literal `(none)` placeholder — never omit a subsection header.

```
## Decisions

### Inbound validation
- [what I was asked to do or what context I was given] — challenged: [yes / no — why] — outcome: [proceeded as-is | pushed back with concrete objection | escalated to user] — salience: [high | medium | low]

### Decisions made
- [what was decided] — alternatives considered and rejected: [...] — Q1-Q5 outcomes: [hack? no | sane? yes | alternatives? listed | symptom-or-cause? cause | root-cause-tracked? n/a] — salience: [high | medium | low]

### Hacks / workarounds acknowledged
- [hack] — why it's a hack: [...] — removal path / follow-up ticket: [...] — salience: [high | medium | low]

### Symptom-only patches (with root-cause links)
- [patch] — symptom it treats: [...] — root cause that remains: [...] — tracked at: [TODO | issue # | follow-up agent | `### Open questions` entry above] — salience: [high | medium | low]
```

The `salience:` tag has the same three-value enum (`high` | `medium` | `low`) and the same usage discipline as the `## Facts` block. Downstream agents (consolidator especially) sort decisions by salience descending — a `high`-salience hack accumulating across slices is the most load-bearing drift signal in the pipeline.

**Per-subsection guidance:**

- `### Inbound validation` — if your input from upstream (the user's prompt OR the prior agent's `## Decisions` block OR the QA test cases OR the PRD requirement) contained a hack, a nonsensical request, or a missing-alternatives gap that YOU would have flagged as Q1-Q3 violations on emit, you MUST flag it on receipt. Don't quietly propagate upstream errors. See Protocol 3 below.
- `### Decisions made` — every load-bearing decision the agent commits to. Include the Q1-Q5 outcome summary as a compact tail. Decisions that passed all five questions cleanly can be written as one line; decisions that needed reasoning under any specific question get the full breakdown.
- `### Hacks acknowledged` — band-aids you deliberately chose to ship. Each entry MUST have a removal path. A hack without a removal path is shipped tech debt, which is its own decision-shaped lie.
- `### Symptom-only patches` — same shape but specifically for symptom-vs-cause trade-offs. The root cause MUST be tracked somewhere reachable; the entry MUST cite where.

**Cognitive-load constraint:** same as `## Facts` — list only load-bearing decisions. A decision that's mechanical (passes all 5 questions trivially because the choice is forced by upstream constraints) doesn't need an entry. A decision where Q1, Q3, or Q4 had ambiguity that the agent resolved deliberately — that's load-bearing and goes in the block.

## Protocol 3 — Inbound Task Validation

The cognitive failure modes that Protocols 1 and 2 prevent are about the agent's OWN output. Protocol 3 is about the agent's INPUT: at task-receipt, the agent MUST validate the upstream task / context before executing, to catch errors propagated from upstream agents (or the user) before they amplify downstream.

Triggering condition: every time the agent receives a new task — whether the input is a user prompt, an upstream agent's `## Decisions` block, a PRD section, a QA test case, a prior plan slice, or a `fix_directive` from `/qa-cycle`. Protocol 3 runs FIRST, before Protocol 1 (which validates the agent's own claims) and Protocol 2 (which validates the agent's own decisions).

The 4-question inbound-validation protocol:

1. **Не бред ли мне предлагают? / Is the inbound task nonsensical?**

   Read the task. Pretend you're a senior engineer evaluating whether this task is sensible at all. Is the goal coherent? Is it proportional to the size of the upstream feature? Does it contradict something else the agent was told in the same context (PRD says X, plan says Y, the user's message says Z)?

   If the task is incoherent or self-contradictory: do NOT execute. Surface it under `### Inbound validation` with a fact-grounded objection, then either escalate to user (via `AskUserQuestion` for interactive agents, via BLOCKED verdict for non-interactive ones) or refuse to proceed.

2. **Нет ли здесь ошибки? / Is there an error in the upstream decision?**

   Apply the 5 questions of Protocol 2 to the upstream decision — was it a hack? Sane? Did upstream consider alternatives? Symptom or cause? Root cause tracked? If the upstream agent (or the user's prompt) made a Q1-Q4 violation, executing the task as-given would propagate the violation. Don't.

   Example: a prior agent's plan slice says "add `try { ... } catch (Exception) { logger.warn('shouldnt happen'); }` to fix the crash". The current agent (implementer) reads this and asks Q1: "Is this a hack?" Yes. Q4: "Symptom or cause?" Symptom. The implementer should NOT execute this slice as-given. The implementer should push back: "Slice 3 proposes catch-Exception-and-log as a fix; this treats the symptom, not the cause; need to investigate WHY the exception fires before patching."

3. **Чем обусловлено то, что мне предлагают сделать? / What's the justification for this task?**

   Every non-trivial task should have a traceable justification: a PRD requirement, a use-case scenario, a user-reported problem, an architectural decision. If the task arrived without a justification ("just do X" with no "because Y"), the agent is being asked to commit to something blind. Demand the justification before executing.

   The justification check is more permissive than Q1-Q2 — sometimes a user says "just do X" because they have context the agent doesn't, and the right action is to trust the user. But the agent should at least RECORD that the justification is "user instruction, no further context" so a reviewer can challenge it.

4. **Нет ли где-то ошибки в upstream-решении? / Are there errors elsewhere in the upstream chain that this task would amplify?**

   Look at the upstream chain — the PRD section, the use cases, the plan slices, the architect verdict, any prior agent output. If you spot an error, gap, or contradiction THAT YOUR EXECUTION OF THE CURRENT TASK WOULD AMPLIFY (not just any error — only ones in your downstream blast radius), surface it. You're not responsible for fixing every upstream error, but you ARE responsible for not silently propagating them when your task makes them worse.

   Example: the plan slice you're implementing references `docs/use-cases/feature_use_cases.md` UC-3, but UC-3 in that file describes a different feature entirely (drift between PRD and use-cases). Implementing UC-3 as the plan describes would commit code that doesn't match the actual user need. Flag it before implementing.

A task that fails Q1 (nonsensical), Q2 (upstream decision is a hack), or has a clear answer to Q4 (would amplify an upstream error) is a task to PUSH BACK ON, not silently execute. Push-back goes under `### Inbound validation`; if the push-back blocks all forward progress, the agent emits a BLOCKED verdict (for `/qa-cycle`-style strict execution) or asks the user (for interactive flows).

**Push-back is NOT failure.** An agent that pushes back on a nonsensical inbound task is doing its job correctly. An agent that silently executes a nonsensical task and ships the result is the failure mode this protocol exists to prevent. Reviewers and orchestrators should treat push-back as a load-bearing signal — never penalize it.

## External Contract Verification

This is the load-bearing subsection of the rule — it is the reason the rule exists. The named failure mode is: an agent claims a status string is `"PENDING"` based on memory of how similar APIs work, ships the integration, and the actual API returns `"in_progress"` — the integration breaks at runtime, not at typecheck.

When making any claim about a third-party API, SDK, library, framework, or service, you MUST:

- Cite the exact source: docs URL with the version anchor, SDK version + symbol path (e.g., `stripe-node@14.2.0::Stripe.charges.retrieve`), OpenAPI/proto file path with line number, or the type-stub file you Read.
- Record the symbol verbatim — exact field name, exact enum string, exact method signature. If the API uses `snake_case` and you're tempted to write `camelCase` because the rest of your codebase is `camelCase`, that is a hallucination.
- If you have NOT verified the contract in this session, the entry goes under `### External contracts` with `verified: no — assumption` and a note explaining the risk.

`"I remember from a similar API / from training data"` is **not a valid source**. Memory of how Stripe / Twilio / GitHub / OAuth / OpenAI / any other system works — even if the memory is correct for one version of that system — is *evidence-shaped, not evidence*. The contract you are integrating with may have a different version, different conventions, custom extensions, or be a fork that diverged. Always verify against the version you are actually integrating with.

If you cannot verify (no docs available, the integration is undocumented, the API is private), the integration cannot proceed without an explicit assumption label. Surface it as an `### Open questions` entry needing user decision, or as an `### External contracts` entry with `verified: no — assumption` plus the risk and the verification path.

## Application Scope

**In-scope (16 thinking agents — MUST follow this protocol on every output):**

- `prd-writer` — embeds `## Facts` inside the new PRD section
- `ba-analyst` — emits `## Facts` at the end of the use-cases file
- `architect` — prepends `## Facts` to the stdout review report before the verdict
- `qa-planner` — emits `## Facts` at the top of the QA test-cases file
- `planner` — emits `## Facts` near the top of `.claude/plan.md`
- `security-auditor` — prepends `## Facts` to the stdout audit report before the verdict
- `code-reviewer` — prepends `## Facts` to the stdout review report before the verdict
- `verifier` — prepends `## Facts` to the stdout verification report before the PASS/FAIL
- `refactor-cleaner` — prepends `## Facts` to the stdout cleanup summary
- `resource-architect` — emits `## Facts` inside `.claude/resources-pending.md` after `## Auto-Install Results`
- `role-planner` — emits `## Facts` inside `.claude/roles-pending.md` after `## Reuse Decisions`
- `release-engineer` — emits `## Facts` inside the release-notes file (`.claude/release-notes-X.Y.Z.md` or canonical release-notes path)
- `qa-engineer` — prepends `## Facts` to its stdout verdict report; per-test-case PASS verdicts MUST cite the tool invocation that produced the evidence (Playwright MCP screenshot path, command stdout, SQL row output); FAIL verdicts MUST cite the expected-vs-actual mismatch with evidence artifact; BLOCKED verdicts MUST cite fact-grounded reasoning under `exit_argument`. A QA verdict without evidence is fact-shaped lie that the cognitive-self-check protocol is designed to prevent.
- `red-team` — prepends `## Facts` and `## Decisions` to its stdout adversarial-review report; each objection MUST cite the plan line / PRD requirement / use-case scenario it attacks. An objection without evidence is rhetorical noise, not adversarial signal.
- `consolidator` — prepends `## Facts` and `## Decisions` to its stdout drift report; each drift finding MUST cite the two divergent file:line points (the drift's "before" and "after"). A drift finding without two-point evidence is not falsifiable.
- `reflection` — emits `## Facts` and `## Decisions` (typically `(none)` for Decisions) at the top of its stdout observation report; each observation MUST cite the concrete evidence (file:line, commit hash, PRD reference). DMN-mode does NOT exempt from fact discipline — handwaving is not an observation.

**Exempt (5 executor agents — deterministic spec-followers, no fact-checking required):**

- `test-writer` — output correctness verified by running the tests it just wrote; mechanical TDD execution from `docs/qa/<feature>_test_cases.md`
- `build-runner` — runs the project's `typecheck`, `test`, `build` commands; output is pass/fail with no reasoning content
- `e2e-runner` — implements E2E tests directly from `docs/use-cases/<feature>_use_cases.md` scenarios; spec-follower
- `doc-updater` — mechanical sync of docs to code state; if it invents documentation that doesn't match code, that's a hallucination of internal state and is caught by the next code-reviewer pass
- `changelog-writer` — mechanical Keep-a-Changelog mapping (feat→Added, fix→Fixed, etc.) over upstream artifacts; the upstream artifacts (PRD sections, scratchpad slices) already carry `## Facts` blocks under this rule, so changelog entries inherit fact-cited provenance

## Plan Critic Enforcement

Cognitive self-check enforcement covers file-based artifacts only. Stdout artifacts (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) are enforced by each emitting agent's own prompt — Plan Critic cannot read transcript content, so it cannot mechanically verify stdout output.

**File-based artifacts the Plan Critic checks (in the current cycle only):**

- `docs/PRD.md` — the section for the current feature (whose `Date:` is on or after `MERGE_DATE`)
- `docs/use-cases/<feature>_use_cases.md` — the current cycle's use-cases file
- `docs/qa/<feature>_test_cases.md` — the current cycle's QA test-cases file
- `.claude/plan.md` — the current cycle's executable plan
- `.claude/resources-pending.md` — when present (resource-architect handoff)
- `.claude/roles-pending.md` — when present (role-planner handoff)
- The current release-notes file — when present (release-engineer output on user-invoked /release)

**Severities (Fact protocol — `## Facts` block):**

- **MAJOR** — `## Facts` block missing entirely from a current-cycle file-based artifact.
- **MAJOR** — an external API/SDK/library identifier mentioned in a slice/PRD requirement/use case/test case without a matching entry in the artifact's `### External contracts` subsection citing the source.
- **MINOR** — `## Facts` block present but a subsection is empty without the literal `(none)` placeholder.
- **MINOR** — `### External contracts` entry present but the source is vague (e.g., "API docs" without a URL or version).

**Severities (Decision protocol — `## Decisions` block):**

- **MAJOR** — `## Decisions` block missing entirely from a current-cycle file-based artifact that contains decisions, recommendations, or proposed actions (slice descriptions, mitigation strategies, alternatives listed in narrative form, "we chose X" statements).
- **MAJOR** — a decision described in the artifact body but missing from the `## Decisions → Decisions made` subsection. Decisions inline in prose but absent from the structured block are unreviewable.
- **MAJOR** — a hack or workaround described in the artifact body (using language like "for now", "as a quick fix", "TODO: fix properly", "workaround", "band-aid") but missing from the `## Decisions → Hacks acknowledged` subsection without a `removal path` line. Hedging language inline without explicit hack-acknowledgement is the named decision-shaped lie this protocol prevents.
- **MAJOR** — a symptom-only patch described inline but missing from the `## Decisions → Symptom-only patches` subsection. Symptoms treated without root-cause tracking compound.
- **MINOR** — `## Decisions` block present but a subsection is empty without the literal `(none)` placeholder.
- **MINOR** — `### Decisions made` entry present but the Q1-Q5 outcome summary is absent on a load-bearing (non-mechanical) decision.

**Severities (Inbound validation — Protocol 3 push-back signals):**

- **MAJOR** — the artifact's `### Inbound validation` subsection is missing AND the artifact has CONTRADICTORY upstream signals (e.g., references both PRD §N and an upstream agent's `## Decisions` block, but those two sources disagree on a load-bearing choice; the artifact silently picked one). Silent contradiction-resolution is invisible decision-making.
- **MINOR** — `### Inbound validation` subsection contains the literal `(none)` placeholder on an artifact that received non-trivial upstream context. May indicate the agent did not actually run Protocol 3 on inbound.

Pre-existing file-based artifacts (created before `MERGE_DATE`, or files not being re-edited in the current cycle) are EXEMPT — the Plan Critic does not retroactively flag them. See `## Backward Compatibility`.

## Backward Compatibility

`MERGE_DATE: <YYYY-MM-DD — filled in at merge by release-engineer>`

The release-engineer on user-invoked `/release` substitutes the actual merge date for the cognitive-self-check feature into the placeholder above. Until that substitution happens, treat `MERGE_DATE` as the calendar day this rule lands on `main`.

This rule applies to artifacts produced **on or after** `MERGE_DATE`. Pre-existing PRD sections, use-case files, QA test-case files, and plans authored before `MERGE_DATE` are exempt — the Plan Critic does NOT retroactively flag them for missing `## Facts` OR missing `## Decisions` blocks. Same scope for both protocols.

The Decision-protocol (Protocol 2) `## Decisions` block and the Inbound-protocol (Protocol 3) `### Inbound validation` subsection share the **same MERGE_DATE backward-compat window** as the original Fact-protocol `## Facts` block. Operators retrofitting the new protocols into an in-flight feature should: re-emit `## Decisions` blocks on any artifact they re-edit in the current cycle; treat untouched artifacts as exempt.

**Date-guard mechanics:**

- For PRD sections: the Plan Critic compares the section's `Date:` field against `MERGE_DATE`. If the `Date:` is on or after `MERGE_DATE`, the section is in scope. If before, it is exempt.
- For use-case / QA / plan / handoff files: scope is "files being created or re-edited in the current bootstrap cycle". A bootstrap orchestrator passes the current-cycle file paths to the Plan Critic; pre-existing files for prior features are simply not in the input set.
- **Fail-closed default:** if a PRD section's `Date:` field is missing, malformed, or unparseable, treat the section as **post-`MERGE_DATE`** (in scope) rather than skipping the check. The cost of a false-positive Plan Critic finding (a Review Notes acknowledgement) is far lower than the cost of a missed fact-discipline violation slipping through on a malformed-date technicality.

This compatibility window is permanent — there is no plan to retroactively backfill `## Facts` blocks into pre-existing artifacts. Authors editing a pre-existing artifact for a new purpose SHOULD add a `## Facts` block as part of that edit, but the Plan Critic does not block them on it.

---

## TL;DR — three questions, in three voices

If you remember nothing else from this rule, remember to ask yourself these three questions, by name, every time you receive a task or are about to emit output:

**Сбор фактов / Information-gathering (Protocol 1):**

> «Является ли *это* фактом или *это* чьи-то фантазии?»

Before recording any claim about external state — code, docs, APIs, prior agent output — ask whether the claim is grounded in something you actually verified this session, or whether it's a half-remembered impression from training data dressed up as fact. If it's fantasies, label it as an assumption and move on; if it's a fact, cite the source.

**Принятие решений / Decision-making (Protocol 2):**

> «А не делаю ли я бред? А является ли *такое* решение логичным, оптимальным и актуальным?»

Before committing to any non-trivial decision, step out of your own head for a moment and look at the choice as a skeptical senior engineer would. Is the complexity proportional to the problem? Is this the most logical, the most maintainable, and the most current option — or is it the first thing that came to mind? If you can't defend the choice against a "you sure?" challenge, reconsider.

**Когнитивная обработка входных промптов / Inbound task validation (Protocol 3):**

> «А не херню ли мне тут пишут? А не заблуждается ли тот, кто пишет промпт?»

Before executing any inbound task — whether it came from a user, an upstream agent, a plan slice, or a fix-directive — ask whether the task itself makes sense. The person or agent writing the prompt is fallible too. A bad task silently executed compounds; a bad task surfaced under `### Inbound validation` is an agent doing its job. Push-back is not failure — push-back is signal.

These three questions are the entire rule, compressed. Every other section in this file is plumbing for these three.
