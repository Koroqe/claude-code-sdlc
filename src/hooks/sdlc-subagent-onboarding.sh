#!/usr/bin/env bash
# SDLC pipeline SubagentStart hook — auto-injects the onboarding preamble
# from ~/.claude/rules/subagent-onboarding.md into EVERY subagent at
# session start. Replaces the prior orchestrator-side contract requiring
# Mira to manually include the preamble in every spawn prompt.
#
# Wired via ~/.claude/settings.json:
#   hooks.SubagentStart[*].hooks[*].command =
#     ~/.claude/hooks/sdlc-subagent-onboarding.sh
#
# Per https://code.claude.com/docs/en/hooks the stdout of a SubagentStart
# hook is appended as additionalContext to the subagent's first model
# request when emitted as plain text.
#
# Exit codes: 0 always (informational, never blocks).

# Read the JSON envelope CC sends on stdin (event metadata). Best-effort.
hook_payload="$(cat 2>/dev/null || true)"
event_name=""
session_id=""
agent_type=""
if command -v jq >/dev/null 2>&1 && [ -n "$hook_payload" ]; then
  event_name="$(printf '%s' "$hook_payload" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
  session_id="$(printf '%s' "$hook_payload" | jq -r '.session_id // empty' 2>/dev/null || true)"
  agent_type="$(printf '%s' "$hook_payload" | jq -r '.subagent_type // .agent_type // empty' 2>/dev/null || true)"
fi
[ -z "$event_name" ] && event_name="agent-spawn"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '?')"

# Wrapper tag — visually parallel to `<channel source="..." ...>` from
# Telegram. Lets the agent grep `^<hook` for hook invocations.
printf '<hook source="sdlc-subagent-onboarding" event="%s" ts="%s"%s%s>\n' \
  "$event_name" "$ts" \
  "$([ -n "$agent_type" ] && printf ' agent_type="%s"' "$agent_type")" \
  "$([ -n "$session_id" ] && printf ' session_id="%s"' "$session_id")"

cat <<'PREAMBLE'
# === Subagent Onboarding (auto-injected by SDLC SubagentStart hook) ===

You are a sub-agent spawned by the SDLC pipeline orchestrator. Before
producing any output, you MUST:

1. Run the three cognitive-self-check protocols from
   `~/.claude/rules/cognitive-self-check.md` on every claim, decision,
   and inbound task:
     - **Protocol 1 (Facts)** — every claim cites file:line / source
       you verified THIS session. No "I remember from training data."
     - **Protocol 2 (Decisions)** — every non-trivial decision passes
       5 questions: hack? sane? alternatives? symptom or cause? root
       cause tracked?
     - **Protocol 3 (Inbound)** — challenge the inbound task itself
       BEFORE executing. If the task is nonsensical or built on an
       upstream error, surface it under `### Inbound validation`; do
       NOT silently execute.

2. Read `~/.claude/rules/knowledge-base.md` and
   `~/.claude/rules/knowledge-base-tool.md` if they exist. These govern
   how you query the per-project knowledge base (books corpus + insights
   corpus). When `<project>/.claude/knowledge/insights.db` exists, you
   MUST query prior-session agent insights at task receipt:
       claudebase insight search "<task-keywords>" \
           --feature "$FEATURE_SLUG" --salience high --top-k 5 --json
   Cite load-bearing hits under `insights-base:` in your `## Facts`
   block.

3. Read `~/.claude/rules/tool-limitations.md` — Read 2000-line cap,
   Grep/Bash 50KB truncation, grep-is-not-AST gotchas.

4. Emit `## Facts` and `## Decisions` blocks per the cognitive-self-
   check format. PASS verdicts cite evidence; FAIL verdicts cite
   expected-vs-actual mismatch; BLOCKED verdicts cite fact-grounded
   `exit_argument`.

5. **Push-back is NOT failure.** If the task as-given is nonsensical or
   built on an upstream error, surface BLOCKED with reasoning — that
   is the agent doing its job correctly.

The task body from the orchestrator follows in the user prompt below.

PREAMBLE

echo "</hook>"

exit 0
