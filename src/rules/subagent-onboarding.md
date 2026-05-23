# Sub-agent Onboarding (MANDATORY)

Every spawn of a sub-agent via the `Agent` tool (also called `Task` in the harness, `subagent_type: general-purpose` or any specific agent type) MUST include a minimum onboarding block in the spawn prompt that points the sub-agent at the cross-cutting rules it would otherwise miss.

The named failure mode this rule prevents: a sub-agent spawned with a focused task prompt operates **without** the cognitive-self-check protocols, **without** the knowledge-base discipline, and **without** the insights-corpus retrieval that the parent agent is bound by — producing fact-shaped lies, decision-shaped hacks, and re-discovery of insights that prior sessions already captured. The parent's discipline is local-only unless it propagates to the child.

## Belt-and-suspenders — the SubagentStart hook is the safety net

`install.sh` and `install.ps1` deploy a `SubagentStart` hook at `~/.claude/hooks/sdlc-subagent-onboarding.sh` that auto-injects the 5-point onboarding preamble as `additionalContext` on every `Agent`-tool spawn. The hook fires before the sub-agent processes the task prompt.

This rule remains MANDATORY because the hook is a safety net, not the primary contract:

- The hook covers projects whose `~/.claude/settings.json` wires it; older installs and projects that haven't run `bash install.sh --yes` since the hook landed (CHANGELOG entry on or after `2026-05-20`) won't have it.
- The hook injects the GENERIC preamble. The parent agent often has feature-specific context to add (current `$FEATURE_SLUG`, the inbound `fix_directive` from `/qa-cycle`, references to the upstream `## Decisions` block) that the hook cannot know about.
- A parent that relies on the hook and omits the preamble is making the rule's enforcement invisible to a reader of the parent's prompt — bad for transcript audits.

**Treat the hook as a belt; the explicit preamble in the spawn prompt is the suspenders.** Use both.

## When this rule applies

This rule applies to ANY agent that invokes the `Agent` tool. Primarily this is the orchestrator (Mira) and any agent that delegates a sub-task (e.g., `/qa-cycle` spawning the implementer, `/develop-feature` spawning per-slice implementers in parallel waves, `red-team` consulting domain-specialist on-demand roles).

It does NOT apply to:

- Slash commands (skills) — they execute in the parent's context and inherit parent's rules.
- Mechanical executor agents (test-writer, build-runner, e2e-runner, doc-updater, changelog-writer) when invoked WITHOUT a downstream Agent-tool spawn — they're already covered by their own prompt files which the harness loads.

When in doubt: if your prompt contains an `Agent` tool call, this rule applies.

## Minimum onboarding block

Every spawn prompt MUST begin with this onboarding preamble (verbatim or near-verbatim — wording variations are fine as long as the file references and the three protocols are explicitly named):

```
=== Onboarding (READ FIRST before doing anything) ===

You are a sub-agent spawned by the SDLC pipeline orchestrator. Before
producing any output, you MUST:

1. Read ~/.claude/rules/cognitive-self-check.md and run all three
   protocols on every claim, decision, and inbound task:
     - Protocol 1 (Facts) — every claim cites file:line / source you
       verified THIS session. No "I remember from training data."
     - Protocol 2 (Decisions) — every non-trivial decision passes 5
       questions: hack? sane? alternatives? symptom or cause? root
       cause tracked?
     - Protocol 3 (Inbound) — challenge the inbound task itself BEFORE
       executing. If the task is nonsensical or built on an upstream
       error, surface it under ### Inbound validation; do NOT silently
       execute.

2. Read ~/.claude/rules/knowledge-base.md and
   ~/.claude/rules/knowledge-base-tool.md if they exist. These govern
   how you query the per-project knowledge base (books corpus +
   insights corpus). When the file <project>/.claude/knowledge/
   insights.db exists, you MUST query prior-session agent insights at
   task receipt:
     claudebase insight search "<task-keywords>" --feature "$FEATURE_SLUG" \
         --salience high --top-k 5 --json
   Cite load-bearing hits under `insights-base:` in your ## Facts block.

3. Read ~/.claude/rules/tool-limitations.md — Read 2000-line cap,
   Grep/Bash 50KB truncation, grep-is-not-AST gotchas.

4. Emit `## Facts` and `## Decisions` blocks per the cognitive-self-
   check format. PASS verdicts cite evidence; FAIL verdicts cite
   expected-vs-actual mismatch; BLOCKED verdicts cite fact-grounded
   exit_argument.

5. Push-back is NOT failure. If the task as-given is nonsensical or
   built on an upstream error, surface BLOCKED with reasoning — that
   is the agent doing its job correctly.

=== Task ===

<the actual task starts here>
```

The onboarding block is the LOAD-BEARING contract. The actual task description follows after the `=== Task ===` separator.

## Why a block, not "just reference the rule files"

LLM sub-agents do not deterministically read files referenced in their prompts. A sub-agent given "follow ~/.claude/rules/cognitive-self-check.md" might skip the read, especially under time pressure. The block above is explicit enough that even a sub-agent that does NOT read the referenced files knows:

- Protocols 1, 2, 3 exist and what each catches
- The insights-corpus query is mandatory when insights.db exists
- `## Facts` and `## Decisions` blocks must be emitted
- Push-back is encouraged

Sub-agents that DO read the referenced files get the full protocol. Sub-agents that skim get the load-bearing minimum.

## Cognitive Self-Check (MANDATORY)

The parent agent (the one writing the spawn prompt) MUST verify before the `Agent` tool call:

1. **Inbound check (Protocol 3 on the parent's own intent)** — is the task you're about to delegate sensible? Did the upstream context contradict itself? Don't delegate nonsense.
2. **Onboarding block present** — the spawn prompt begins with the onboarding preamble verbatim or near-verbatim. Plan Critic enforcement: a parent's session that includes Agent tool calls without an onboarding-block grep match is a MAJOR finding.
3. **Feature slug propagated** — if a `$FEATURE_SLUG` is in scope, it's passed in the onboarding block so the sub-agent's insights query is scoped correctly.

## What the parent MUST NOT do

- MUST NOT spawn a sub-agent with a task-only prompt that omits the onboarding block.
- MUST NOT shorten the onboarding block to "follow the project rules" — the explicit naming of Protocols 1/2/3 and the insight-corpus query is load-bearing.
- MUST NOT exempt mechanical executor agents from the onboarding block when delegating to them via `Agent` tool — exemption applies only to direct (non-spawned) invocations.

## What the sub-agent MUST do on receipt

The sub-agent's first action after receiving the spawn prompt is to run Protocol 3 (Inbound Task Validation) on the task itself. If the task fails Q1 (nonsensical) or Q2 (upstream hack), surface BLOCKED with reasoning under `### Inbound validation` rather than executing.

Second action: query the insights corpus for prior load-bearing insights matching the task's feature slug + keywords. Cite any load-bearing hits in `## Facts → ### Verified facts` under `insights-base:` per the cognitive-self-check rule.

Third action: read the relevant rule files (cognitive-self-check, knowledge-base, knowledge-base-tool, tool-limitations) — at minimum skim the section headers so you know where to look during the task.

Fourth action: execute the task with the onboarding-mandated discipline.

## Application Scope

In-scope (the agents that spawn sub-agents in the current pipeline):

- The orchestrator (Mira) — spawns specialists via `Agent` tool throughout `/develop-feature`, `/bootstrap-feature`, `/qa-cycle`, `/merge-ready`
- `red-team` — may spawn on-demand domain specialists for an adversarial pass
- `consolidator` — may spawn the `reflection` agent if a drift finding warrants deeper observation
- `/qa-cycle` orchestrator — spawns the implementer on FAIL iterations
- `/merge-ready` orchestrator — spawns gate agents (security-auditor, code-reviewer, verifier, etc.)
- `corporate-code-style-reviewer` — does NOT spawn sub-agents itself, but the `/merge-ready` orchestrator that spawns IT must include the onboarding block

Out of scope (these run via the harness, not via Agent tool):

- Slash command skill invocations (`/develop-feature`, `/qa-cycle`, etc.) — they inherit parent context
- Direct tool calls (Read, Edit, Bash, Grep, Glob) — no sub-agent involved

## Backward compatibility

This rule applies to spawn prompts issued on or after `MERGE_DATE` (the date the rule lands on `main`). Pre-existing spawn patterns recorded in past sessions are exempt — no retroactive enforcement. Sessions that load this rule via `~/.claude/rules/subagent-onboarding.md` MUST follow it from that point forward.

The first sign that a session is missing this onboarding block: sub-agents return verdicts without `## Facts` blocks, or claim things without file:line citations, or never query the insights corpus. If you (the parent) notice this pattern, the cause is almost always a missing onboarding block in your spawn prompts.
