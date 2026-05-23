# SDLC pipeline SessionStart hook (Windows PowerShell) — auto-injects
# orientation context into Claude Code's first model request.
#
# Wired via $env:USERPROFILE\.claude\settings.json:
#   hooks.SessionStart[*].hooks[*].command = powershell -NoProfile -File
#     $env:USERPROFILE\.claude\hooks\sdlc-onboarding.ps1
#
# Per https://code.claude.com/docs/en/hooks the stdout of a SessionStart
# hook is appended as additionalContext to the first model request when
# emitted as plain text. This script outputs plain text only.

$ErrorActionPreference = 'Continue'

# Drain stdin so Claude Code's IPC doesn't fault.
try { $null = [Console]::In.ReadToEnd() } catch {}

$cwd = (Get-Location).Path
$rulesDir = Join-Path $env:USERPROFILE '.claude\rules'
$projectClaude = Join-Path $cwd '.claude'

# Header — names the three load-bearing protocols verbatim.
@'
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
'@

# Global pipeline rules + mtimes.
if (Test-Path $rulesDir) {
    Write-Output ""
    Write-Output "## Loaded pipeline rules (~/.claude/rules/)"
    Get-ChildItem -Path $rulesDir -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
        $mtime = $_.LastWriteTime.ToString('yyyy-MM-dd')
        Write-Output "- $($_.Name) ($($_.Length) bytes, $mtime)"
    }
    Write-Output ""
}

# Per-project rules.
$projectRules = Join-Path $projectClaude 'rules'
if (Test-Path $projectRules) {
    Write-Output "## Project rules (./.claude/rules/)"
    Get-ChildItem -Path $projectRules -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
        $mtime = $_.LastWriteTime.ToString('yyyy-MM-dd')
        Write-Output "- $($_.Name) ($($_.Length) bytes, $mtime)"
    }
    Write-Output ""
}

# Scratchpad summary.
$scratchpad = Join-Path $projectClaude 'scratchpad.md'
if (Test-Path $scratchpad) {
    Write-Output "## Scratchpad summary (./.claude/scratchpad.md)"
    $content = Get-Content $scratchpad -ErrorAction SilentlyContinue
    foreach ($header in @('^## Feature:', '^## Branch:', '^## Status:', '^## Blockers')) {
        $idx = ($content | Select-String -Pattern $header | Select-Object -First 1).LineNumber
        if ($idx) {
            $slice = $content[($idx - 1)..([Math]::Min($idx + 4, $content.Count - 1))]
            $slice | ForEach-Object { Write-Output "  $_" }
            Write-Output ""
        }
    }
}

# Recent session changelog tail.
$changelog = Join-Path $projectClaude 'changelog.md'
if (Test-Path $changelog) {
    Write-Output "## Recent session bullets (./.claude/changelog.md tail)"
    Get-Content $changelog -ErrorAction SilentlyContinue `
      | Select-Object -Skip 1 -First 30 `
      | ForEach-Object { Write-Output "  $_" }
    Write-Output ""
}

# Git state.
$gitDir = Join-Path $cwd '.git'
if (Test-Path $gitDir) {
    Write-Output "## Git"
    try {
        $branch = (& git -C $cwd branch --show-current 2>$null)
        if ($branch) { Write-Output "- branch: $branch" }
        Write-Output "- recent commits:"
        (& git -C $cwd log --oneline -3 2>$null) | ForEach-Object { Write-Output "    $_" }
        $dirty = (& git -C $cwd status --short 2>$null) | Select-Object -First 10
        if ($dirty) {
            Write-Output "- working tree (truncated to 10 entries):"
            $dirty | ForEach-Object { Write-Output "    $_" }
        } else {
            Write-Output "- working tree: clean"
        }
    } catch {}
    Write-Output ""
}

# Push-back note.
@'
## Push-back is not failure

If the operator's first prompt contradicts an established pipeline
constraint (asks for code without /bootstrap-feature, asks to commit
on main, asks for a hack labelled as a real fix), surface it under
`### Inbound validation` and refuse to silently execute. Per
`~/.claude/rules/cognitive-self-check.md` Protocol 3, push-back is
the agent doing its job correctly.
'@

exit 0
