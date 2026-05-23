# SDLC pipeline SessionStart hook (Windows PowerShell) — auto-injects
# orientation context for the agent AND surfaces a brief visible line to
# the operator in the CLI.
#
# Wired via $env:USERPROFILE\.claude\settings.json:
#   hooks.SessionStart[*].hooks[*].command = powershell -NoProfile -File
#     $env:USERPROFILE\.claude\hooks\sdlc-onboarding.ps1
#
# Output is a JSON envelope per https://code.claude.com/docs/en/hooks:
#   - `systemMessage` -> visible to the OPERATOR in the CLI (short summary)
#   - `hookSpecificOutput.additionalContext` -> agent-only context, wrapped
#     in a `<hook source="sdlc-onboarding" ...>` tag for visual parity with
#     the `<channel source="...">` tags Telegram channel callbacks use

$ErrorActionPreference = 'Continue'

# Read CC's JSON envelope from stdin. Best-effort.
$hookPayload = ''
try { $hookPayload = [Console]::In.ReadToEnd() } catch {}
$eventName = 'session-start'
$sessionId = ''
if ($hookPayload) {
    try {
        $envelope = $hookPayload | ConvertFrom-Json
        if ($envelope.hook_event_name) { $eventName = $envelope.hook_event_name }
        if ($envelope.session_id)      { $sessionId = $envelope.session_id }
    } catch {}
}

$cwd = (Get-Location).Path
$rulesDir = Join-Path $env:USERPROFILE '.claude\rules'
$projectClaude = Join-Path $cwd '.claude'
$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Build orientation content into a string buffer.
$sb = New-Object System.Text.StringBuilder

$sessAttr = if ($sessionId) { " session_id=`"$sessionId`"" } else { '' }
[void]$sb.AppendLine("<hook source=`"sdlc-onboarding`" event=`"$eventName`" ts=`"$ts`" cwd=`"$cwd`"$sessAttr>")

[void]$sb.AppendLine(@'
# SDLC Pipeline — Session Onboarding

You are Mira, the orchestrator of this SDLC pipeline. Three cognitive-
self-check protocols are MANDATORY on every artifact you emit:

- **Protocol 1 (Facts)** — every claim cites file:line / source verified
  THIS session. Training-data recall is NOT evidence. Output: mandatory
  `## Facts` block with `### Verified facts`, `### External contracts`,
  `### Assumptions`, `### Open questions` subsections.
- **Protocol 2 (Decisions)** — every non-trivial decision passes 5
  questions: hack? sane? alternatives? symptom or cause? root cause
  tracked? Output: mandatory `## Decisions` block immediately after
  `## Facts`, with `### Inbound validation`, `### Decisions made`,
  `### Hacks acknowledged`, `### Symptom-only patches` subsections.
- **Protocol 3 (Inbound)** — challenge the inbound task BEFORE
  executing. Push-back is NOT failure; silently executing nonsense is.

Full protocol: `~/.claude/rules/cognitive-self-check.md`.
Subagent contract: `~/.claude/rules/subagent-onboarding.md` (every
Agent-tool spawn prompt MUST begin with the onboarding preamble).
'@)

if (Test-Path $rulesDir) {
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("## Loaded pipeline rules (~/.claude/rules/)")
    Get-ChildItem -Path $rulesDir -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
        $mtime = $_.LastWriteTime.ToString('yyyy-MM-dd')
        [void]$sb.AppendLine("- $($_.Name) ($($_.Length) bytes, $mtime)")
    }
    [void]$sb.AppendLine("")
}

$projectRules = Join-Path $projectClaude 'rules'
if (Test-Path $projectRules) {
    [void]$sb.AppendLine("## Project rules (./.claude/rules/)")
    Get-ChildItem -Path $projectRules -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
        $mtime = $_.LastWriteTime.ToString('yyyy-MM-dd')
        [void]$sb.AppendLine("- $($_.Name) ($($_.Length) bytes, $mtime)")
    }
    [void]$sb.AppendLine("")
}

$scratchpad = Join-Path $projectClaude 'scratchpad.md'
if (Test-Path $scratchpad) {
    [void]$sb.AppendLine("## Scratchpad summary (./.claude/scratchpad.md)")
    $content = Get-Content $scratchpad -ErrorAction SilentlyContinue
    foreach ($header in @('^## Feature:', '^## Branch:', '^## Status:', '^## Blockers')) {
        $idx = ($content | Select-String -Pattern $header | Select-Object -First 1).LineNumber
        if ($idx) {
            $slice = $content[($idx - 1)..([Math]::Min($idx + 4, $content.Count - 1))]
            $slice | ForEach-Object { [void]$sb.AppendLine("  $_") }
            [void]$sb.AppendLine("")
        }
    }
}

$changelog = Join-Path $projectClaude 'changelog.md'
if (Test-Path $changelog) {
    [void]$sb.AppendLine("## Recent session bullets (./.claude/changelog.md tail)")
    Get-Content $changelog -ErrorAction SilentlyContinue `
      | Select-Object -Skip 1 -First 30 `
      | ForEach-Object { [void]$sb.AppendLine("  $_") }
    [void]$sb.AppendLine("")
}

$gitDir = Join-Path $cwd '.git'
if (Test-Path $gitDir) {
    [void]$sb.AppendLine("## Git")
    try {
        $branch = (& git -C $cwd branch --show-current 2>$null)
        if ($branch) { [void]$sb.AppendLine("- branch: $branch") }
        [void]$sb.AppendLine("- recent commits:")
        (& git -C $cwd log --oneline -3 2>$null) | ForEach-Object { [void]$sb.AppendLine("    $_") }
        $dirty = (& git -C $cwd status --short 2>$null) | Select-Object -First 10
        if ($dirty) {
            [void]$sb.AppendLine("- working tree (truncated to 10 entries):")
            $dirty | ForEach-Object { [void]$sb.AppendLine("    $_") }
        } else {
            [void]$sb.AppendLine("- working tree: clean")
        }
    } catch {}
    [void]$sb.AppendLine("")
}

[void]$sb.AppendLine(@'
## Push-back is not failure

If the operator's first prompt contradicts an established pipeline
constraint (asks for code without /bootstrap-feature, asks to commit
on main, asks for a hack labelled as a real fix), surface it under
`### Inbound validation` and refuse to silently execute. Per
`~/.claude/rules/cognitive-self-check.md` Protocol 3, push-back is
the agent doing its job correctly.
'@)

[void]$sb.AppendLine("</hook>")

$additionalContext = $sb.ToString()
$projectLabel = Split-Path -Leaf $cwd
$systemMessage = "[hook] SDLC SessionStart — event=$eventName project=$projectLabel"

# Emit JSON: operator sees systemMessage, agent gets additionalContext.
$payload = [ordered]@{
    systemMessage = $systemMessage
    hookSpecificOutput = [ordered]@{
        hookEventName = 'SessionStart'
        additionalContext = $additionalContext
    }
}
$payload | ConvertTo-Json -Depth 6 -Compress:$false

exit 0
