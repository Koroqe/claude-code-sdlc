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
# Installs an autonomous SDLC workflow for Claude Code — 18 specialized AI
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

$Version = "3.0.0"
$ClaudebaseVersion = "0.4.0"
$ClaudebasePdfiumVersion = "chromium/7802"
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

Turn Claude Code into a full dev team with 18 specialized AI agents.

USAGE:
  install.bat [OPTIONS]
  powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 [OPTIONS]

OPTIONS:
  -InitProject     Scaffold .claude\ template + docs\ in current directory
  -Yes             Skip confirmation prompts
  -Local           Use local checkout instead of cloning from GitHub
  -Help            Show this help message

WHAT GETS INSTALLED (%USERPROFILE%\.claude\):
  claude.md        Main workflow instructions
  agents\          18 specialized agent prompts
  commands\        8 SDLC pipeline commands
  rules\           4 process rules
  tools\claudebase\claudebase.exe   Knowledge-base CLI binary
  tools\claudebase\pdfium\lib\pdfium.dll   PDFium runtime for PDF ingest

GLOBAL ALIAS (claudebase):
  A claudebase.cmd wrapper is created in %USERPROFILE%\.claude\bin\
  and that directory is added to your User PATH (open a new shell after
  install for the PATH change to take effect).

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
  /develop-feature    Full autonomous pipeline
  /bootstrap-feature  Documentation phases only ([--with-resources] forces resource-architect)
  /implement-slice    Implement next TDD slice
  /qa-cycle           Strict QA/Dev iteration loop — qa-engineer executes the
                      documented QA plan with Playwright MCP for UI/UX evidence;
                      FAIL spawns implementer with fix directives; BLOCKED halts
                      and surfaces a fact-grounded argument to the human. Run
                      BEFORE /merge-ready; /develop-feature chains it automatically.
  /merge-ready        Run all 9 quality gates (assumes /qa-cycle has passed)
  /release            User-invoked release packaging — semver bump + CHANGELOG + GHA workflow
  /knowledge-ingest   Ingest a folder/file into the per-project knowledge base
  /context-refresh    Rebuild session context
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
    Write-Host "  18 AI agents | Documentation-first | TDD"
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

function Install-KnowledgeBinary {
    # Migration cleanup: remove the pre-2026-05-10 sdlc-knowledge install +
    # legacy claudeknows.cmd wrapper. Idempotent — silently no-ops on a fresh
    # install.
    $oldDir = Join-Path $ClaudeDir "tools\sdlc-knowledge"
    if (Test-Path $oldDir) {
        Write-Info "migrating from claudeknows to claudebase: removing old install"
        Remove-Item -Recurse -Force $oldDir -ErrorAction SilentlyContinue
    }
    $oldWrapper = Join-Path $ClaudeDir "bin\claudeknows.cmd"
    if (Test-Path $oldWrapper) {
        Remove-Item -Force $oldWrapper -ErrorAction SilentlyContinue
        Write-Ok "removed legacy claudeknows.cmd wrapper"
    }

    if (-not [Environment]::Is64BitOperatingSystem) {
        Write-Warn "32-bit Windows is not supported by claudebase; skipping binary install"
        return
    }
    $platform = "windows-x64"
    $targetDir = Join-Path $ClaudeDir "tools\claudebase"
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    $targetBin = Join-Path $targetDir "claudebase.exe"

    # Idempotency check
    if (Test-Path $targetBin) {
        try {
            $verLine = & $targetBin --version 2>$null
            $existingVer = ($verLine -split '\s+')[-1]
            if ($existingVer -eq $ClaudebaseVersion) {
                Write-Ok "claudebase already at expected version $ClaudebaseVersion"
                return
            }
        } catch { }
    }

    # claudebase moved to its own repo on 2026-05-10. URL is hard-coded to
    # codefather-labs/claudebase, NOT derived from $RepoOwnerRepo (which still
    # points at the SDLC monorepo for the rest of the install).
    $url = "https://github.com/codefather-labs/claudebase/releases/download/claudebase-v$ClaudebaseVersion/claudebase-$platform.exe"
    $tmp = Join-Path $env:TEMP ("claudebase-" + [guid]::NewGuid().ToString() + ".exe")

    Write-Info "Downloading claudebase.exe v$ClaudebaseVersion..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 120
    } catch {
        Write-Warn "Download failed: $($_.Exception.Message)"
        Remove-Item $tmp -ErrorAction SilentlyContinue
        Invoke-CargoSourceBuildFallback
        return
    }

    # Smoke-test
    try {
        & $tmp --version | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "non-zero exit from --version" }
    } catch {
        Write-Warn "downloaded binary failed --version smoke; falling back to cargo build"
        Remove-Item $tmp -ErrorAction SilentlyContinue
        Invoke-CargoSourceBuildFallback
        return
    }

    Move-Item -Force $tmp $targetBin
    Write-Ok "tools\claudebase\claudebase.exe ($platform)"
}

function Invoke-CargoSourceBuildFallback {
    if (-not (Test-Path (Join-Path $Script:ScriptDir "tools\claudebase"))) {
        Get-SourceDir
    }
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Warn "binary unavailable; install cargo (https://rustup.rs) or wait for the release to publish"
        return
    }
    $cargoToml = Join-Path $Script:ScriptDir "tools\claudebase\Cargo.toml"
    if (-not (Test-Path $cargoToml)) {
        Write-Warn "binary unavailable; cannot find tools\claudebase\Cargo.toml"
        return
    }
    Write-Info "Building claudebase from source via cargo (fallback)..."
    & cargo build --release -p claudebase --manifest-path $cargoToml
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "cargo build failed; binary unavailable"
        return
    }
    $built = Join-Path $Script:ScriptDir "tools\claudebase\target\release\claudebase.exe"
    if (-not (Test-Path $built)) {
        Write-Warn "cargo build did not produce expected binary at $built"
        return
    }
    $targetDir = Join-Path $ClaudeDir "tools\claudebase"
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    Copy-Item -Force $built (Join-Path $targetDir "claudebase.exe")
    Write-Ok "tools\claudebase\claudebase.exe (built from source)"
}

function Register-ClaudeknowsAlias {
    $targetBin = Join-Path $ClaudeDir "tools\claudebase\claudebase.exe"
    if (-not (Test-Path $targetBin)) {
        Write-Warn "claudebase alias: target binary not found at $targetBin; skipping"
        return
    }
    $binDir = Join-Path $ClaudeDir "bin"
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null

    $wrapperPath = Join-Path $binDir "claudebase.cmd"
    $wrapperContent = "@echo off`r`n`"$targetBin`" %*`r`n"
    Set-Content -Path $wrapperPath -Value $wrapperContent -Encoding ASCII -NoNewline
    Write-Ok "claudebase alias: $wrapperPath -> $targetBin"

    # Add binDir to user PATH if not already there
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    $pathParts = if ($userPath) { $userPath -split ';' } else { @() }
    if ($pathParts -notcontains $binDir) {
        $newPath = if ($userPath) { "$userPath;$binDir" } else { $binDir }
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Ok "User PATH updated to include $binDir"
        Write-Warn "  NOTE: open a new terminal for the PATH change to take effect"
    } else {
        Write-Ok "User PATH already contains $binDir"
    }
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

function Register-BashAllowlist {
    Update-AllowList -Entries @('~/.claude/tools/claudebase/claudebase *') -SuccessMsg "claudebase allowlist"
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

function Install-PdfiumBinary {
    $targetDir = Join-Path $ClaudeDir "tools\claudebase\pdfium"
    $libDir = Join-Path $targetDir "lib"
    $sentinel = Join-Path $targetDir ".version"

    if (Test-Path $sentinel) {
        $existing = (Get-Content -Raw $sentinel).Trim()
        if ($existing -eq $ClaudebasePdfiumVersion) {
            Write-Ok "pdfium binary already at version $ClaudebasePdfiumVersion"
            return
        }
    }

    if (-not [Environment]::Is64BitOperatingSystem) {
        Write-Warn "32-bit Windows pdfium not supported; skipping PDF support"
        return
    }
    $asset = "pdfium-win-x64.tgz"
    $url = "https://github.com/bblanchon/pdfium-binaries/releases/download/$ClaudebasePdfiumVersion/$asset"

    if (-not (Get-Command tar.exe -ErrorAction SilentlyContinue)) {
        Write-Warn "tar.exe not found (Windows 10 1803+ required); skipping pdfium install"
        return
    }

    $tmpArchive = Join-Path $env:TEMP ("pdfium-" + [guid]::NewGuid().ToString() + ".tgz")
    $staging = Join-Path $env:TEMP ("pdfium-staging-" + [guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $staging -Force | Out-Null

    try {
        Write-Info "Downloading pdfium ($ClaudebasePdfiumVersion)..."
        try {
            Invoke-WebRequest -Uri $url -OutFile $tmpArchive -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 120
        } catch {
            Write-Warn "pdfium download failed: $($_.Exception.Message); skipping PDF support"
            return
        }

        & tar.exe -xzf $tmpArchive -C $staging 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "pdfium archive extraction failed"
            return
        }

        $pdfiumDll = Get-ChildItem -Path $staging -Filter "pdfium.dll" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $pdfiumDll) {
            Write-Warn "no pdfium.dll found in extracted archive"
            return
        }

        New-Item -ItemType Directory -Path $libDir -Force | Out-Null
        Copy-Item -Force $pdfiumDll.FullName (Join-Path $libDir "pdfium.dll")
        Set-Content -Path $sentinel -Value $ClaudebasePdfiumVersion -Encoding ASCII

        if (-not (Test-Path (Join-Path $libDir "pdfium.dll"))) {
            Write-Warn "pdfium post-install integrity check failed; cleaning up"
            Remove-Item -Recurse -Force $targetDir -ErrorAction SilentlyContinue
            return
        }
        Write-Ok "pdfium binary installed: win-x64 (version $ClaudebasePdfiumVersion)"
    } finally {
        Remove-Item -ErrorAction SilentlyContinue $tmpArchive
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $staging
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
# Main
# ============================================================================
if ($Help) { Show-Help; exit 0 }

Install-UserConfig
Install-KnowledgeBinary
Register-ClaudeknowsAlias
Register-BashAllowlist
Register-ReleaseBashAllowlist
Install-PdfiumBinary

# Slice 11 of vector-retrieval-backend: pre-load the e5-multilingual-small
# encoder so the first `claudebase ingest` / `claudebase search --mode hybrid`
# doesn't pay a ~30 s cold-start model-download stall. Idempotent (no-op
# when model is already cached). Network failure is a warning, not a
# fatal error — fastembed will lazy-download on first real use.
$KnowledgeExe = Join-Path $ClaudeDir "tools\claudebase\claudebase.exe"
if (Test-Path $KnowledgeExe) {
    Write-Info "Pre-loading e5-multilingual-small encoder (~120 MB on first run)..."
    try {
        & $KnowledgeExe warmup --quiet 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "encoder ready (cached at $env:USERPROFILE\.claude\tools\claudebase\models\)"
        } else {
            Write-Warn "encoder pre-load failed; fastembed will retry on first ingest"
        }
    } catch {
        Write-Warn "encoder pre-load failed ($($_.Exception.Message)); fastembed will retry on first ingest"
    }
}

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
Write-Host "    /merge-ready        Run all 9 quality gates (assumes /qa-cycle passed)"
Write-Host "    /release            User-invoked release packaging"
Write-Host "    /knowledge-ingest   Ingest into per-project knowledge base"
Write-Host "    /context-refresh    Rebuild session context"
Write-Host ""
Write-Host "  Knowledge base CLI (also invokable as 'claudebase' after a new shell):"
Write-Host "    claudebase ingest <path>"
Write-Host "    claudebase search '<query>' --json     # PDF hits include page citations"
Write-Host "    claudebase page --by-id <id> --page <N>  # Fetch full text of a cited PDF page"
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
