#Requires -Version 5.1
[CmdletBinding()]
param(
    [switch]$InitProject,
    [switch]$Yes,
    [switch]$Local,
    [switch]$Help
)

# ============================================================================
# Claude Code SDLC Windows Installer (PowerShell)
# ============================================================================
#
# Installs an autonomous SDLC workflow for Claude Code — 20 specialized AI
# agents that mirror a professional software development team.
#
# Quick install (PowerShell, run from any directory after cloning):
#   powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
#
# Or via the cmd.exe wrapper:
#   install.bat
#
# Usage:
#   install.bat                # Install user-level config
#   install.bat -InitProject   # Also scaffold project template in CWD
#   install.bat -Yes           # Skip confirmation prompts
#   install.bat -Local         # Use local checkout (skip git clone)
#   install.bat -Help          # Show help
# ============================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Version = "3.1.0"
$RepoUrl = "https://github.com/codefather-labs/claude-code-sdlc.git"
$RepoOwnerRepo = "codefather-labs/claude-code-sdlc"
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$Script:ScriptDir = $null
$Script:BackupDir = $null

function Write-Info { Write-Host "[INFO]  $($args[0])" -ForegroundColor Blue }
function Write-Ok   { Write-Host "  [OK]  $($args[0])" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN]  $($args[0])" -ForegroundColor Yellow }
function Write-Err  { Write-Host "[ERROR] $($args[0])" -ForegroundColor Red }

function Show-Help {
    @"
Claude Code SDLC Installer v$Version (Windows)

Turn Claude Code into a full dev team with 20 specialized AI agents.

USAGE:
  install.bat [OPTIONS]
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [OPTIONS]

OPTIONS:
  -InitProject     Scaffold .claude\ template + docs\ in current directory
  -Yes             Skip confirmation prompts
  -Local           Use local checkout instead of cloning from GitHub
  -Help            Show this help message

WHAT GETS INSTALLED (%USERPROFILE%\.claude\):
  claude.md        Main workflow instructions (includes Mira orchestrator persona)
  agents\          20 specialized agent prompts (SDLC pipeline)
  commands\        7 SDLC pipeline commands
  rules\           6 process rules (cognitive-self-check, subagent-onboarding, error-recovery, scratchpad, git, session-changelog)
  hooks\           3 hooks (SessionStart + SubagentStart + PostToolUse[ExitPlanMode] — auto-fire on session boot, subagent spawn, plan-mode exit)

CLAUDEBASE DEPENDENCY (chained from claudebase repo's installer):
  This installer downloads and runs claudebase's standalone PowerShell
  installer, which additionally installs:
    tools\claudebase\        CLI binary + PDFium + e5 encoder
    rules\                   knowledge-base, knowledge-base-tool, tool-limitations
    commands\                /knowledge-ingest, /reflect, /consolidate
    agents\                  reflection (Drift), consolidator (Mnem)
    bin\claudebase.cmd       Global alias (User PATH appended; open new shell)
    voice deps (best-effort) ffmpeg + whisper-cli via winget/choco/scoop
                             (opt-out: $env:CLAUDEBASE_SKIP_WHISPER='1')
    telegram plugin          downloads server-rs.exe binary into the official
                             Anthropic telegram plugin's cache + patches
                             .mcp.json. Requires `claude` CLI present; opt-out:
                             $env:CLAUDEBASE_SKIP_TELEGRAM='1'
  Plus exposes `claudebase run` to launch Claude Code with the telegram
  plugin preset preloaded in one shot.
  Source: https://github.com/codefather-labs/claudebase

WHAT -InitProject CREATES (in current directory):
  .claude\CLAUDE.md             Project context template
  .claude\rules\                Architecture, security, testing rules
  .claude\scratchpad.md         Session state persistence
  .claude\settings.json         Permissions config
  .claude\knowledge\sources\    Drop PDF/MD/TXT here for /knowledge-ingest
  docs\PRD.md                   Product requirements document
  docs\qa\                      QA test case directory
  docs\use-cases\               Use case document directory

AFTER INSTALL:
  Start Claude Code in any project and describe a feature.
  The autonomous pipeline kicks in automatically.

COMMANDS AVAILABLE:
  SDLC pipeline (this repo):
    /develop-feature    Full autonomous pipeline
    /bootstrap-feature  Documentation phases only ([--with-resources] forces resource-architect)
    /implement-slice    Implement next TDD slice
    /qa-cycle           Strict QA/Dev iteration loop — qa-engineer executes the
                        documented QA plan with Playwright MCP for UI/UX evidence;
                        FAIL spawns implementer with fix directives (deliberate-mode
                        on iter N+1); 3 non-converging iters triggers sunk-cost
                        circuit breaker. BLOCKED halts with fact-grounded argument.
                        Run BEFORE /merge-ready; /develop-feature chains it automatically.
    /merge-ready        Run all 9 quality gates (assumes /qa-cycle has passed)
    /release            User-invoked release packaging — semver bump + CHANGELOG + GHA workflow
    /context-refresh    Rebuild session context

  Memory + observation (from claudebase):
    /knowledge-ingest   Ingest a folder/file into the per-project knowledge base
    /consolidate        Cross-artifact drift detection (auto-chained between waves)
    /reflect            DMN unfocused observation pass — user-invoked only
"@ | Write-Host
}

function Confirm-Action {
    param([string]$Prompt)
    if ($Yes) { return $true }
    Write-Host "$Prompt [y/N]" -ForegroundColor Yellow
    $response = Read-Host
    return $response -match '^[yY]([eE][sS])?$'
}

function Get-SourceDir {
    if ($Local) {
        $Script:ScriptDir = $PSScriptRoot
        if (-not (Test-Path (Join-Path $Script:ScriptDir "src\agents"))) {
            Write-Err "Local mode requires running install.ps1 from the claude-code-sdlc repo root"
            exit 1
        }
    } else {
        $Script:ScriptDir = Join-Path $env:TEMP ("claude-code-sdlc-" + [guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $Script:ScriptDir -Force | Out-Null
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            Write-Err "git is not installed. Install Git for Windows from https://git-scm.com/download/win"
            exit 1
        }
        Write-Info "Cloning claude-code-sdlc..."
        & git clone --depth 1 --quiet $RepoUrl $Script:ScriptDir 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to clone repository. Check your internet connection."
            Remove-Item -Recurse -Force $Script:ScriptDir -ErrorAction SilentlyContinue
            exit 1
        }
        Write-Ok "Repository cloned"
    }
}

function Backup-Existing {
    $needsBackup = $false
    foreach ($d in 'agents', 'commands', 'rules') {
        $p = Join-Path $ClaudeDir $d
        if ((Test-Path $p) -and ((Get-ChildItem -Path $p -Force -ErrorAction SilentlyContinue) | Measure-Object).Count -gt 0) {
            $needsBackup = $true; break
        }
    }
    if (Test-Path (Join-Path $ClaudeDir "claude.md")) { $needsBackup = $true }

    if ($needsBackup) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $Script:BackupDir = Join-Path $ClaudeDir "backup-$stamp"
        Write-Warn "Existing config found. Backing up to $Script:BackupDir"
        New-Item -ItemType Directory -Path $Script:BackupDir -Force | Out-Null
        $claudeMd = Join-Path $ClaudeDir "claude.md"
        if (Test-Path $claudeMd) { Copy-Item $claudeMd $Script:BackupDir }
        foreach ($d in 'agents', 'commands', 'rules') {
            $src = Join-Path $ClaudeDir $d
            if (Test-Path $src) { Copy-Item -Recurse -Force $src $Script:BackupDir }
        }
        Write-Ok "Backup created"
    }
}

function Install-UserConfig {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor White
    Write-Host "  Claude Code SDLC Installer v$Version (Windows)" -ForegroundColor White
    Write-Host "============================================" -ForegroundColor White
    Write-Host ""
    Write-Host "  Turn Claude Code into a full dev team" -ForegroundColor Cyan
    Write-Host "  20 AI agents | Documentation-first | TDD"
    Write-Host ""
    Write-Host "  This will install to $ClaudeDir"
    Write-Host ""

    if (-not (Confirm-Action "Proceed with installation?")) {
        Write-Info "Aborted."
        exit 0
    }

    Get-SourceDir
    Backup-Existing

    foreach ($d in 'agents', 'commands', 'rules') {
        New-Item -ItemType Directory -Path (Join-Path $ClaudeDir $d) -Force | Out-Null
    }

    Copy-Item (Join-Path $Script:ScriptDir "src\claude.md") (Join-Path $ClaudeDir "claude.md") -Force
    Write-Ok "claude.md"

    Get-ChildItem (Join-Path $Script:ScriptDir "src\agents\*.md") | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $ClaudeDir "agents") -Force
        Write-Ok "agents\$($_.Name)"
    }
    Get-ChildItem (Join-Path $Script:ScriptDir "src\commands\*.md") | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $ClaudeDir "commands") -Force
        Write-Ok "commands\$($_.Name)"
    }
    Get-ChildItem (Join-Path $Script:ScriptDir "src\rules\*.md") | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $ClaudeDir "rules") -Force
        Write-Ok "rules\$($_.Name)"
    }

    $agentCount = (Get-ChildItem (Join-Path $ClaudeDir "agents\*.md") -ErrorAction SilentlyContinue | Measure-Object).Count
    $cmdCount   = (Get-ChildItem (Join-Path $ClaudeDir "commands\*.md") -ErrorAction SilentlyContinue | Measure-Object).Count
    $ruleCount  = (Get-ChildItem (Join-Path $ClaudeDir "rules\*.md") -ErrorAction SilentlyContinue | Measure-Object).Count
    $total = $agentCount + $cmdCount + $ruleCount + 1

    Write-Host ""
    Write-Ok "User-level config installed ($total files: 1 workflow + $agentCount agents + $cmdCount commands + $ruleCount rules)"
}

function Update-AllowList {
    param(
        [Parameter(Mandatory = $true)] [string[]] $Entries,
        [Parameter(Mandatory = $true)] [string]   $SuccessMsg
    )
    $settings = Join-Path $ClaudeDir "settings.json"

    if (-not (Test-Path $settings)) {
        $obj = [ordered]@{ permissions = [ordered]@{ allow = @($Entries) } }
        $obj | ConvertTo-Json -Depth 5 | Set-Content -Path $settings -Encoding UTF8
        Write-Ok "settings.json (created with allowlist — $($Entries.Count) entries)"
        return
    }

    try {
        $json = Get-Content -Raw $settings | ConvertFrom-Json
        if (-not $json.PSObject.Properties.Name -contains 'permissions') {
            $json | Add-Member -NotePropertyName "permissions" -NotePropertyValue ([pscustomobject]@{ allow = @() }) -Force
        }
        if (-not ($json.permissions.PSObject.Properties.Name -contains 'allow')) {
            $json.permissions | Add-Member -NotePropertyName "allow" -NotePropertyValue @() -Force
        }
        $allow = @($json.permissions.allow)
        $added = 0
        foreach ($e in $Entries) {
            if ($allow -notcontains $e) {
                $allow += $e
                $added++
            }
        }
        $json.permissions.allow = $allow
        $json | ConvertTo-Json -Depth 10 | Set-Content -Path $settings -Encoding UTF8
        if ($added -gt 0) {
            Write-Ok "settings.json ($SuccessMsg — $added new entries)"
        } else {
            Write-Ok "settings.json already contains $SuccessMsg"
        }
    } catch {
        Write-Warn "settings.json merge failed ($($_.Exception.Message)); add manually:"
        foreach ($e in $Entries) { Write-Warn "  $e" }
    }
}

function Register-ReleaseBashAllowlist {
    $entries = @(
        "git add CHANGELOG.md *",
        "git commit -m chore(core): release *",
        "git merge-base HEAD origin/main",
        "git diff --name-only *",
        "git ls-remote --tags origin *",
        "git tag -a v* -F *",
        "git tag -a claudebase-v* -F *",
        "git tag -d v*",
        "git tag -d claudebase-v*",
        "git push origin v*",
        "git push origin claudebase-v*"
    )
    Update-AllowList -Entries $entries -SuccessMsg "release-engineer allowlist"
}

# ============================================================================
# Deploy SDLC SessionStart + SubagentStart hooks. Mirrors install_sdlc_hooks
# in install.sh. On Windows PowerShell, JSON manipulation goes through
# ConvertFrom-Json / ConvertTo-Json instead of jq.
# ============================================================================
function Install-SdlcHooks {
    $hooksDir = Join-Path $ClaudeDir "hooks"
    $settings = Join-Path $ClaudeDir "settings.json"

    if (-not (Test-Path $hooksDir)) {
        New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
    }

    # Stale-artifact cleanup: prior installs deployed a /onboarding slash
    # command. The hook supersedes it.
    $staleCmd = Join-Path $ClaudeDir "commands\onboarding.md"
    if (Test-Path $staleCmd) {
        Remove-Item -Force $staleCmd
        Write-Ok "removed stale commands/onboarding.md (superseded by SessionStart hook)"
    }

    # We deploy BOTH the .sh and .ps1 variants under ~/.claude/hooks/.
    # Windows users wire to the .ps1 variant; the .sh files don't hurt to
    # have on disk (they just won't be invoked).
    $hookFiles = @(
        "sdlc-onboarding.sh",
        "sdlc-onboarding.ps1",
        "sdlc-subagent-onboarding.sh",
        "sdlc-subagent-onboarding.ps1",
        "sdlc-exitplanmode-reminder.sh",
        "sdlc-exitplanmode-reminder.ps1"
    )
    foreach ($hook in $hookFiles) {
        $src = Join-Path $Script:ScriptDir "src\hooks\$hook"
        $dst = Join-Path $hooksDir $hook
        if (-not (Test-Path $src)) {
            Write-Warn "hooks/$hook missing in source — skipping"
            continue
        }
        Copy-Item -Force $src $dst
        Write-Ok "hooks/$hook"
    }

    # Compute the hook command strings to wire into settings.json. On
    # Windows, prefer .ps1; the command line is `powershell -NoProfile -File <path>`.
    $sessionPs1  = Join-Path $hooksDir "sdlc-onboarding.ps1"
    $subagentPs1 = Join-Path $hooksDir "sdlc-subagent-onboarding.ps1"
    $exitplanPs1 = Join-Path $hooksDir "sdlc-exitplanmode-reminder.ps1"
    $sessionCmd  = "powershell -NoProfile -File `"$sessionPs1`""
    $subagentCmd = "powershell -NoProfile -File `"$subagentPs1`""
    $exitplanCmd = "powershell -NoProfile -File `"$exitplanPs1`""

    if (-not (Test-Path $settings)) {
        $obj = [ordered]@{ permissions = [ordered]@{ allow = @() } }
        $obj | ConvertTo-Json -Depth 5 | Set-Content -Path $settings -Encoding UTF8
    }

    try {
        $json = Get-Content -Raw $settings | ConvertFrom-Json
        if (-not ($json.PSObject.Properties.Name -contains 'hooks')) {
            $json | Add-Member -NotePropertyName "hooks" -NotePropertyValue ([pscustomobject]@{}) -Force
        }

        # Helper — idempotent merge of one hook event.
        $mergeEvent = {
            param($eventName, $matcher, $command)
            if (-not ($json.hooks.PSObject.Properties.Name -contains $eventName)) {
                $json.hooks | Add-Member -NotePropertyName $eventName -NotePropertyValue @() -Force
            }
            $existing = @($json.hooks.$eventName)
            $alreadyHas = $false
            foreach ($entry in $existing) {
                if ($entry.hooks) {
                    foreach ($h in $entry.hooks) {
                        if ($h.command -eq $command) { $alreadyHas = $true; break }
                    }
                }
                if ($alreadyHas) { break }
            }
            if (-not $alreadyHas) {
                $newEntry = [pscustomobject]@{
                    matcher = $matcher
                    hooks   = @(
                        [pscustomobject]@{ type = "command"; command = $command }
                    )
                }
                if (-not $matcher) {
                    $newEntry = [pscustomobject]@{
                        hooks = @(
                            [pscustomobject]@{ type = "command"; command = $command }
                        )
                    }
                }
                $existing += $newEntry
                $json.hooks.$eventName = $existing
            }
        }

        & $mergeEvent "SessionStart"  "startup|resume|compact" $sessionCmd
        & $mergeEvent "SubagentStart" $null                    $subagentCmd
        & $mergeEvent "PostToolUse"   "ExitPlanMode"           $exitplanCmd

        $json | ConvertTo-Json -Depth 12 | Set-Content -Path $settings -Encoding UTF8
        Write-Ok "settings.json (SessionStart + SubagentStart + PostToolUse[ExitPlanMode] hooks wired)"
    } catch {
        Write-Warn "settings.json hook merge failed ($($_.Exception.Message)); add manually:"
        Write-Warn "  hooks.SessionStart[*].hooks[*].command = $sessionCmd"
        Write-Warn "  hooks.SubagentStart[*].hooks[*].command = $subagentCmd"
        Write-Warn "  hooks.PostToolUse[matcher=ExitPlanMode].hooks[*].command = $exitplanCmd"
    }
}

function Initialize-Project {
    Write-Host ""
    Write-Info "Scaffolding project template in $((Get-Location).Path)\.claude\"

    if (Test-Path ".claude\CLAUDE.md") {
        Write-Warn ".claude\CLAUDE.md already exists — skipping project scaffold"
        Write-Info "To force, remove .claude\ and rerun with -InitProject"
        return
    }

    if (-not (Test-Path (Join-Path $Script:ScriptDir "templates"))) {
        Get-SourceDir
    }

    foreach ($d in '.claude\rules', 'docs\qa', 'docs\use-cases', '.claude\knowledge\sources') {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }

    Copy-Item (Join-Path $Script:ScriptDir "templates\CLAUDE.md") ".claude\CLAUDE.md" -Force
    Write-Ok ".claude\CLAUDE.md (template — fill in your project details)"

    foreach ($r in 'architecture', 'security', 'testing', 'changelog', 'auto-release') {
        $src = Join-Path $Script:ScriptDir "templates\rules\$r.md"
        if (Test-Path $src) {
            Copy-Item $src ".claude\rules\$r.md" -Force
            Write-Ok ".claude\rules\$r.md"
        }
    }

    Copy-Item (Join-Path $Script:ScriptDir "templates\scratchpad.md") ".claude\scratchpad.md" -Force
    Write-Ok ".claude\scratchpad.md"

    Copy-Item (Join-Path $Script:ScriptDir "templates\settings.json") ".claude\settings.json" -Force
    Write-Ok ".claude\settings.json"

    $kbGitignore = Join-Path $Script:ScriptDir "templates\knowledge\.gitignore"
    if (Test-Path $kbGitignore) {
        Copy-Item $kbGitignore ".claude\knowledge\.gitignore" -Force
        Write-Ok ".claude\knowledge\.gitignore"
    }
    $kbGitkeep = Join-Path $Script:ScriptDir "templates\knowledge\.gitkeep"
    if (Test-Path $kbGitkeep) {
        Copy-Item $kbGitkeep ".claude\knowledge\sources\.gitkeep" -Force
        Write-Ok ".claude\knowledge\sources\"
    }

    @"
# Product Requirements Document

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1     | TODO | Initial PRD |

---

## 1. Overview

TODO: High-level description of the product.

---

<!-- New feature sections will be appended here by the prd-writer agent -->
"@ | Set-Content -Path "docs\PRD.md" -Encoding UTF8
    Write-Ok "docs\PRD.md (template)"

    New-Item -Path "docs\qa\.gitkeep" -ItemType File -Force | Out-Null
    Write-Ok "docs\qa\"
    New-Item -Path "docs\use-cases\.gitkeep" -ItemType File -Force | Out-Null
    Write-Ok "docs\use-cases\"

    Write-Host ""
    Write-Ok "Project template scaffolded"
    Write-Host ""
    Write-Host "  Next steps:"
    Write-Host "    1. Fill in TODO placeholders in .claude\CLAUDE.md"
    Write-Host "    2. Fill in .claude\rules\architecture.md"
    Write-Host "    3. Fill in .claude\rules\security.md"
    Write-Host "    4. Fill in .claude\rules\testing.md"
    Write-Host "    5. Start a Claude Code session and describe a feature"
    Write-Host ""
}

# ============================================================================
# Chain to the standalone claudebase installer
# ============================================================================
# claudebase lives in its own GitHub repo with its own installer that ships
# the CLI binary, PDFium native library, e5 encoder, plus the agent toolkit
# (3 rules, 3 commands, 2 agents — see https://github.com/codefather-labs/claudebase).
# Calling its installer keeps the boundary clean.
#
# In -Local mode AND with a sibling claudebase\ checkout (the dev path —
# e.g., when working from the SDLC monorepo with a nested claudebase clone),
# run the local installer directly. Otherwise download and invoke from main.
# ============================================================================
function Invoke-ClaudebaseInstaller {
    if ($Local -and (Test-Path (Join-Path $Script:ScriptDir 'claudebase\install.ps1'))) {
        Write-Info "Chaining to local claudebase installer at $($Script:ScriptDir)\claudebase\install.ps1"
        try {
            & (Join-Path $Script:ScriptDir 'claudebase\install.ps1') -Yes -Local
            if ($LASTEXITCODE -eq 0) {
                Write-Ok "claudebase installed (local checkout)"
            } else {
                Write-Warn "claudebase installer exited with $LASTEXITCODE; SDLC will degrade gracefully (no knowledge base)"
            }
        } catch {
            Write-Warn "claudebase installer threw: $($_.Exception.Message); SDLC will degrade gracefully"
        }
        return
    }

    $url = "https://raw.githubusercontent.com/codefather-labs/claudebase/main/install.ps1"
    Write-Info "Chaining to claudebase installer at $url"
    try {
        $script = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 300
        $tmpScript = Join-Path $env:TEMP ("claudebase-installer-" + [guid]::NewGuid().ToString() + ".ps1")
        Set-Content -Path $tmpScript -Value $script.Content -Encoding UTF8
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $tmpScript -Yes
        $rc = $LASTEXITCODE
        Remove-Item -Force $tmpScript -ErrorAction SilentlyContinue
        if ($rc -eq 0) {
            Write-Ok "claudebase installed"
        } else {
            Write-Warn "claudebase installer exited with $rc; SDLC will degrade gracefully (no knowledge base)"
        }
    } catch {
        Write-Warn "claudebase installer failed: $($_.Exception.Message)"
        Write-Warn "  install manually: iwr -useb $url | iex"
    }
}

# ============================================================================
# Main
# ============================================================================
if ($Help) { Show-Help; exit 0 }

Install-UserConfig
Invoke-ClaudebaseInstaller
Register-ReleaseBashAllowlist
Install-SdlcHooks

if ($InitProject) {
    Initialize-Project
}

# Cleanup temp dir if we cloned
if (-not $Local -and $Script:ScriptDir -and (Test-Path $Script:ScriptDir)) {
    Remove-Item -Recurse -Force $Script:ScriptDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "  Installation complete!" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host ""
Write-Host "  The autonomous SDLC workflow is now active."
Write-Host "  Start Claude Code in any project and describe a feature."
Write-Host ""
Write-Host "  Commands:"
Write-Host "    /develop-feature    Full autonomous pipeline"
Write-Host "    /bootstrap-feature  Documentation phases only"
Write-Host "    /implement-slice    Implement next TDD slice"
Write-Host "    /qa-cycle           Strict QA/Dev iteration loop (Playwright + evidence)"
Write-Host "    /consolidate        Cross-artifact drift detection (auto-chained between waves)"
Write-Host "    /reflect            DMN unfocused observation pass — user-invoked only"
Write-Host "    /merge-ready        Run all 9 quality gates (assumes /qa-cycle passed)"
Write-Host "    /release            User-invoked release packaging"
Write-Host "    /knowledge-ingest   Ingest into per-project knowledge base"
Write-Host "    /context-refresh    Rebuild session context"
Write-Host ""
Write-Host "  Knowledge base CLI (also invokable as 'claudebase' after a new shell):"
Write-Host "    claudebase ingest <path>"
Write-Host "    claudebase search '<query>' --json     # PDF hits include page citations"
Write-Host "    claudebase page <doc> <N>  # Fetch full text of a cited PDF page"
Write-Host "    claudebase list  | status | delete"
Write-Host ""
Write-Host "  Tip: re-ingest existing PDFs (claudebase ingest <path>) to upgrade pre-v2"
Write-Host "  indexes to schema v2 — that's what unlocks per-page citations in search hits."
Write-Host ""
if (-not $InitProject) {
    Write-Host "  To scaffold a new project:"
    Write-Host "    install.bat -InitProject"
    Write-Host ""
}
if ($Script:BackupDir) {
    Write-Host "  Backup of previous config: $Script:BackupDir"
    Write-Host ""
}
