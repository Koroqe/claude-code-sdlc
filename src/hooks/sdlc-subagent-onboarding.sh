#!/usr/bin/env bash
# SDLC pipeline SubagentStart hook — auto-injects the 5-point onboarding
# preamble into every subagent at spawn time.
#
# Wired via ~/.claude/settings.json:
#   hooks.SubagentStart[*].hooks[*].command =
#     ~/.claude/hooks/sdlc-subagent-onboarding.sh
#
# Output is a JSON envelope per https://code.claude.com/docs/en/hooks:
#   - `hookSpecificOutput.additionalContext` -> agent-only context, wrapped
#     in a `<hook source="sdlc-subagent-onboarding" ...>` tag for visual
#     parity with `<channel source="..." ...>` Telegram callbacks
#
# NOTE: this hook deliberately omits `systemMessage` — SubagentStart fires
# on EVERY Agent-tool spawn (potentially dozens per /develop-feature wave),
# so a user-visible bubble per spawn would spam the operator's CLI. Only
# the SessionStart hook (fires once per session boot) surfaces a visible
# bubble.
#
# Exit code: 0 always (informational; never blocks subagent spawn).

# Read the JSON envelope CC sends on stdin. Best-effort.
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

# Build the preamble content into a temp buffer, wrapped in <hook> tag.
buf="$(mktemp -t sdlc-subagent-onboarding.XXXXXX)"
trap 'rm -f "$buf"' EXIT

{
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

  echo '</hook>'
} > "$buf"

# Emit JSON: agent-only additionalContext. No systemMessage (would spam
# operator CLI on every subagent spawn).
if command -v jq >/dev/null 2>&1; then
  jq -n \
    --rawfile ctx "$buf" \
    '{
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: $ctx
      }
    }'
else
  # No jq — fall back to plain text (agent context only).
  cat "$buf"
fi

exit 0
