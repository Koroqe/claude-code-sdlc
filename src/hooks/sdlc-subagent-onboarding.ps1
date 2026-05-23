# SDLC pipeline SubagentStart hook (Windows PowerShell) — auto-injects
# the 5-point onboarding preamble into every subagent at spawn time.
#
# Wired via $env:USERPROFILE\.claude\settings.json:
#   hooks.SubagentStart[*].hooks[*].command = powershell -NoProfile -File
#     $env:USERPROFILE\.claude\hooks\sdlc-subagent-onboarding.ps1
#
# Output is a JSON envelope; only `hookSpecificOutput.additionalContext`
# is populated. No `systemMessage` (would spam operator CLI on every
# subagent spawn). Only SessionStart surfaces a visible bubble.

$ErrorActionPreference = 'Continue'

# Read CC's JSON envelope from stdin. Best-effort metadata extraction.
$hookPayload = ''
try { $hookPayload = [Console]::In.ReadToEnd() } catch {}
$eventName = 'agent-spawn'
$sessionId = ''
$agentType = ''
if ($hookPayload) {
    try {
        $envelope = $hookPayload | ConvertFrom-Json
        if ($envelope.hook_event_name) { $eventName = $envelope.hook_event_name }
        if ($envelope.session_id)      { $sessionId = $envelope.session_id }
        if ($envelope.subagent_type)   { $agentType = $envelope.subagent_type }
        elseif ($envelope.agent_type)  { $agentType = $envelope.agent_type }
    } catch {}
}
$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$agentAttr = if ($agentType) { " agent_type=`"$agentType`"" } else { '' }
$sessAttr  = if ($sessionId) { " session_id=`"$sessionId`"" } else { '' }

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("<hook source=`"sdlc-subagent-onboarding`" event=`"$eventName`" ts=`"$ts`"$agentAttr$sessAttr>")

[void]$sb.AppendLine(@'
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
       claudebase insight search "<task-keywords>" `
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
'@)

[void]$sb.AppendLine("</hook>")

$payload = [ordered]@{
    hookSpecificOutput = [ordered]@{
        hookEventName = 'SubagentStart'
        additionalContext = $sb.ToString()
    }
}
$payload | ConvertTo-Json -Depth 6 -Compress:$false

exit 0
