# SDLC pipeline PostToolUse hook (Windows PowerShell) — fires AFTER an
# ExitPlanMode tool call and reminds the agent (and the operator) to persist
# the plan body to <project>\.claude\plan.md per the CLAUDE.md mandate.
#
# Wired via $env:USERPROFILE\.claude\settings.json:
#   hooks.PostToolUse[*].matcher = "ExitPlanMode"
#   hooks.PostToolUse[*].hooks[*].command = powershell -NoProfile -File
#     $env:USERPROFILE\.claude\hooks\sdlc-exitplanmode-reminder.ps1
#
# Output is a JSON envelope per https://code.claude.com/docs/en/hooks:
#   - `systemMessage` -> operator-visible bubble (only when plan.md is
#     missing / empty / stale; silent on the happy path)
#   - `hookSpecificOutput.additionalContext` -> agent-only reminder wrapped
#     in a <hook source="sdlc-exitplanmode-reminder" ...> tag
#
# Exit code: 0 always (informational; never blocks).

$ErrorActionPreference = 'Continue'

# Read CC's JSON envelope from stdin.
$hookPayload = ''
try { $hookPayload = [Console]::In.ReadToEnd() } catch {}
$sessionId = ''
$cwd = ''
if ($hookPayload) {
    try {
        $envelope = $hookPayload | ConvertFrom-Json
        if ($envelope.session_id) { $sessionId = $envelope.session_id }
        if ($envelope.cwd)        { $cwd       = $envelope.cwd }
    } catch {}
}
if (-not $cwd) { $cwd = (Get-Location).Path }

# Resolve project root the same way the CLAUDE.md rule mandates.
$projectRoot = $cwd
try {
    Push-Location $cwd
    $resolved = (& git rev-parse --show-toplevel 2>$null).Trim()
    if ($resolved) { $projectRoot = $resolved }
} catch {} finally { Pop-Location }

$planFile = Join-Path (Join-Path $projectRoot '.claude') 'plan.md'

# Determine state: missing / empty / stale / ok
$state = 'ok'
$mtimeAge = $null
if (-not (Test-Path -LiteralPath $planFile -PathType Leaf)) {
    $state = 'missing'
} else {
    $fi = Get-Item -LiteralPath $planFile
    if ($fi.Length -eq 0) {
        $state = 'empty'
    } else {
        $mtimeAge = [int]((Get-Date) - $fi.LastWriteTime).TotalSeconds
        if ($mtimeAge -gt 300) {
            $state = 'stale'
        }
    }
}

# Happy-path silent exit.
if ($state -eq 'ok') {
    '{}'
    exit 0
}

$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$shortRoot = Split-Path -Path $projectRoot -Leaf
$sessAttr = if ($sessionId) { " session_id=`"$sessionId`"" } else { '' }

# Operator-visible bubble.
switch ($state) {
    'missing' { $sysMsg = "plan.md missing at $shortRoot\.claude\plan.md - agent should persist the just-approved plan before /bootstrap-feature can consume it" }
    'empty'   { $sysMsg = "plan.md is empty at $shortRoot\.claude\plan.md - overwrite with the just-approved plan body" }
    'stale'   { $sysMsg = "plan.md at $shortRoot\.claude\plan.md is ${mtimeAge}s old - verify it matches the plan you just approved (or overwrite)" }
}

# Agent-only reminder content.
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("<hook source=`"sdlc-exitplanmode-reminder`" event=`"PostToolUse`" tool=`"ExitPlanMode`" state=`"$state`" ts=`"$ts`"$sessAttr>")
[void]$sb.AppendLine('# === Plan persistence reminder (auto-injected by SDLC PostToolUse hook) ===')
[void]$sb.AppendLine('')
switch ($state) {
    'missing' { [void]$sb.AppendLine("You just exited plan mode but ``$planFile`` does NOT exist.") }
    'empty'   { [void]$sb.AppendLine("You just exited plan mode but ``$planFile`` exists with ZERO bytes.") }
    'stale'   {
        [void]$sb.AppendLine("You just exited plan mode and ``$planFile`` exists, but its mtime is ${mtimeAge}s old -")
        [void]$sb.AppendLine('older than this response. Verify the file matches the plan you just approved; overwrite if not.')
    }
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine('The CLAUDE.md `## Plan-Mode Persistence` rule requires that BEFORE calling')
[void]$sb.AppendLine('ExitPlanMode you Write the full plan body to `<project>/.claude/plan.md`.')
[void]$sb.AppendLine('The `/bootstrap-feature` Step 0 precondition aborts if that file is missing,')
[void]$sb.AppendLine('empty, or out of date - meaning the just-approved plan would be lost between')
[void]$sb.AppendLine('plan mode and the bootstrap pipeline.')
[void]$sb.AppendLine('')
if ($state -ne 'stale') {
    [void]$sb.AppendLine('Fix it now - in your NEXT response:')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("  1. ``Bash New-Item -ItemType Directory -Path $projectRoot\.claude -Force``")
    [void]$sb.AppendLine("  2. ``Write file_path=$planFile content=<full plan body>``")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('Then proceed with your follow-up work (commonly `/bootstrap-feature` to')
    [void]$sb.AppendLine('consume the plan, or direct implementation if the user opted out of bootstrap).')
} else {
    [void]$sb.AppendLine('If the file already matches the plan you approved, no action needed.')
    [void]$sb.AppendLine('If not - overwrite with the current plan body now:')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine("  Write file_path=$planFile content=<full plan body>")
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine('</hook>')

$payload = [ordered]@{
    systemMessage = $sysMsg
    hookSpecificOutput = [ordered]@{
        hookEventName = 'PostToolUse'
        additionalContext = $sb.ToString()
    }
}
$payload | ConvertTo-Json -Depth 6 -Compress:$false

exit 0
