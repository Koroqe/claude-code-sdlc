# Cognitive Self-Check Protocol

The most common Claude failure during SDLC work is **building a verdict on memory of similar systems instead of evidence about the actual system in front of you** — hallucinated API field names, fabricated status enum values, invented method signatures, "remembered" PRD requirements that drifted, file behavior recalled from earlier in the conversation that may have been compacted away.

This rule applies to every "thinking" agent in the SDLC pipeline. It forces each agent to pass every claim through a fact-vs-assumption self-check **before emitting output**, and to record the result in a mandatory `## Facts` block so the next agent (or a human reviewer) can audit the evidence and challenge any assumption that turned out to be wrong.

## Protocol — Before Each Decision

Before recording any decision, recommendation, plan, claim, or verdict, ask yourself these four questions in order:

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

## Mandatory Facts Section

Every in-scope artifact MUST contain a `## Facts` block with the four subsections below, in this exact order. Empty subsections MUST use the literal placeholder `(none)` — never omit a subsection header. The literal heading is `## Facts` (capital F, no parentheses, no qualifiers); Plan Critic checks are exact-string greps.

```
## Facts

### Verified facts
- [fact] — source: [file:line | command output | PRD §N | prior commit hash | upstream agent's ## Facts entry]

### External contracts
- [API/SDK/library identifier] — symbol: [exact field/method/enum name] — source: [docs URL | SDK version + symbol path | OpenAPI/proto file:line | type-stub file:line] — verified: [yes | no — assumption]

### Assumptions
- [assumption] — risk: [what breaks if wrong] — how to verify: [next step | next agent | open question]

### Open questions
- [question] — needs: [user decision | architect call | external research | follow-up agent]
```

The `### External contracts` subsection is mandatory whenever the artifact references any third-party API/SDK/library identifier. If the feature has zero external integrations, write `(none)` — but every artifact still emits the heading.

**Cognitive-load constraint:** list only facts that load-bear on the decision being made — not every file the agent read. The point is a navigable evidence trail for the load-bearing claims, not a comprehensive read-log. If a fact can be removed without changing the verdict, it does not belong in `### Verified facts`.

## External Contract Verification

This is the load-bearing subsection of the rule — it is the reason the rule exists. The named failure mode is: an agent claims a status string is `"PENDING"` based on memory of how similar APIs work, ships the integration, and the actual API returns `"in_progress"` — the integration breaks at runtime, not at typecheck.

When making any claim about a third-party API, SDK, library, framework, or service, you MUST:

- Cite the exact source: docs URL with the version anchor, SDK version + symbol path (e.g., `stripe-node@14.2.0::Stripe.charges.retrieve`), OpenAPI/proto file path with line number, or the type-stub file you Read.
- Record the symbol verbatim — exact field name, exact enum string, exact method signature. If the API uses `snake_case` and you're tempted to write `camelCase` because the rest of your codebase is `camelCase`, that is a hallucination.
- If you have NOT verified the contract in this session, the entry goes under `### External contracts` with `verified: no — assumption` and a note explaining the risk.

`"I remember from a similar API / from training data"` is **not a valid source**. Memory of how Stripe / Twilio / GitHub / OAuth / OpenAI / any other system works — even if the memory is correct for one version of that system — is *evidence-shaped, not evidence*. The contract you are integrating with may have a different version, different conventions, custom extensions, or be a fork that diverged. Always verify against the version you are actually integrating with.

If you cannot verify (no docs available, the integration is undocumented, the API is private), the integration cannot proceed without an explicit assumption label. Surface it as an `### Open questions` entry needing user decision, or as an `### External contracts` entry with `verified: no — assumption` plus the risk and the verification path.

## Application Scope

**In-scope (13 thinking agents — MUST follow this protocol on every output):**

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

**Severities:**

- **MAJOR** — `## Facts` block missing entirely from a current-cycle file-based artifact.
- **MAJOR** — an external API/SDK/library identifier mentioned in a slice/PRD requirement/use case/test case without a matching entry in the artifact's `### External contracts` subsection citing the source.
- **MINOR** — `## Facts` block present but a subsection is empty without the literal `(none)` placeholder.
- **MINOR** — `### External contracts` entry present but the source is vague (e.g., "API docs" without a URL or version).

Pre-existing file-based artifacts (created before `MERGE_DATE`, or files not being re-edited in the current cycle) are EXEMPT — the Plan Critic does not retroactively flag them. See `## Backward Compatibility`.

## Backward Compatibility

`MERGE_DATE: <YYYY-MM-DD — filled in at merge by release-engineer>`

The release-engineer on user-invoked `/release` substitutes the actual merge date for the cognitive-self-check feature into the placeholder above. Until that substitution happens, treat `MERGE_DATE` as the calendar day this rule lands on `main`.

This rule applies to artifacts produced **on or after** `MERGE_DATE`. Pre-existing PRD sections, use-case files, QA test-case files, and plans authored before `MERGE_DATE` are exempt — the Plan Critic does NOT retroactively flag them for missing `## Facts` blocks.

**Date-guard mechanics:**

- For PRD sections: the Plan Critic compares the section's `Date:` field against `MERGE_DATE`. If the `Date:` is on or after `MERGE_DATE`, the section is in scope. If before, it is exempt.
- For use-case / QA / plan / handoff files: scope is "files being created or re-edited in the current bootstrap cycle". A bootstrap orchestrator passes the current-cycle file paths to the Plan Critic; pre-existing files for prior features are simply not in the input set.
- **Fail-closed default:** if a PRD section's `Date:` field is missing, malformed, or unparseable, treat the section as **post-`MERGE_DATE`** (in scope) rather than skipping the check. The cost of a false-positive Plan Critic finding (a Review Notes acknowledgement) is far lower than the cost of a missed fact-discipline violation slipping through on a malformed-date technicality.

This compatibility window is permanent — there is no plan to retroactively backfill `## Facts` blocks into pre-existing artifacts. Authors editing a pre-existing artifact for a new purpose SHOULD add a `## Facts` block as part of that edit, but the Plan Critic does not block them on it.
