@echo off
setlocal
REM ============================================================================
REM Claude Code SDLC Windows Installer (cmd.exe wrapper)
REM ============================================================================
REM
REM This is a thin wrapper around install.ps1 for users who prefer running
REM the installer from cmd.exe via double-click. It locates install.ps1 in
REM the same directory and forwards all arguments unchanged.
REM
REM Usage:
REM   install.bat                Install user-level config
REM   install.bat -InitProject   Also scaffold project template in CWD
REM   install.bat -Yes           Skip confirmation prompts
REM   install.bat -Local         Use local checkout (skip git clone)
REM   install.bat -Help          Show help
REM ============================================================================

set "SCRIPT_DIR=%~dp0"

where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PowerShell is required but was not found on PATH.
    echo         Install PowerShell 5.1+ from https://aka.ms/powershell
    exit /b 1
)

if not exist "%SCRIPT_DIR%install.ps1" (
    echo [ERROR] install.ps1 not found next to install.bat
    echo         Expected: %SCRIPT_DIR%install.ps1
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1" %*
exit /b %ERRORLEVEL%
