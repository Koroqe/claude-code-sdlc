#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Claude Code SDLC Installer
# ============================================================================
#
# Installs an autonomous SDLC workflow for Claude Code — 13 specialized AI
# agents that mirror a professional software development team.
#
# Quick install:
#   curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash
#
# Usage:
#   bash install.sh                # Install user-level config
#   bash install.sh --init-project # Also scaffold project template in CWD
#   bash install.sh --yes          # Skip confirmation prompts
#   bash install.sh --local        # Use local checkout (skip git clone)
#   bash install.sh --help         # Show help
# ============================================================================

VERSION="2.1.0"
REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"
CLAUDE_DIR="$HOME/.claude"
BACKUP_DIR=""
INIT_PROJECT=false
AUTO_YES=false
LOCAL_MODE=false
SCRIPT_DIR=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}  [OK]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_help() {
  cat << 'HELPEOF'
Claude Code SDLC Installer v2.1.0

Turn Claude Code into a full dev team with 13 specialized AI agents.

USAGE:
  bash install.sh [OPTIONS]

OPTIONS:
  --init-project   Scaffold .claude/ template + docs/ in current directory
  --yes            Skip confirmation prompts
  --local          Use local checkout instead of cloning from GitHub
  --help           Show this help message

WHAT GETS INSTALLED (~/.claude/):
  claude.md        Main workflow instructions
  agents/          13 specialized agent prompts
  commands/        5 SDLC pipeline commands
  rules/           5 process rules

WHAT --init-project CREATES (in current directory):
  .claude/CLAUDE.md           Project context template
  .claude/rules/              Architecture, security, testing rules
  .claude/scratchpad.md       Session state persistence
  .claude/settings.json       Permissions config
  docs/PRD.md                 Product requirements document
  docs/qa/                    QA test case directory
  docs/use-cases/             Use case document directory
  CHANGELOG.md                Changelog template (newest first, by UTC date)

AFTER INSTALL:
  Start Claude Code in any project and describe a feature.
  The autonomous pipeline kicks in automatically.

COMMANDS AVAILABLE:
  /develop-feature    Full autonomous pipeline
  /bootstrap-feature  Documentation phases only
  /implement-slice    Implement next TDD slice
  /merge-ready        Run all quality gates
  /context-refresh    Rebuild session context
HELPEOF
}

confirm() {
  if [ "$AUTO_YES" = true ]; then return 0; fi
  echo -e "${YELLOW}$1 [y/N]${NC}"
  read -r response
  case "$response" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --init-project) INIT_PROJECT=true; shift ;;
    --yes) AUTO_YES=true; shift ;;
    --local) LOCAL_MODE=true; shift ;;
    --help|-h) print_help; exit 0 ;;
    *) log_error "Unknown option: $1"; print_help; exit 1 ;;
  esac
done

# ============================================================================
# Get source directory (clone or use local)
# ============================================================================
get_source_dir() {
  if [ "$LOCAL_MODE" = true ]; then
    # Use the directory where this script lives
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ ! -d "$SCRIPT_DIR/src/agents" ]; then
      log_error "Local mode requires running from the claude-code-sdlc repo root"
      exit 1
    fi
  else
    SCRIPT_DIR=$(mktemp -d)
    log_info "Cloning claude-code-sdlc..."
    if ! git clone --depth 1 --quiet "$REPO_URL" "$SCRIPT_DIR" 2>/dev/null; then
      log_error "Failed to clone repository. Check your internet connection."
      rm -rf "$SCRIPT_DIR"
      exit 1
    fi
    log_ok "Repository cloned"
  fi
}

# ============================================================================
# Backup existing config
# ============================================================================
backup_existing() {
  local needs_backup=false

  for dir in agents commands rules; do
    if [ -d "$CLAUDE_DIR/$dir" ] && [ "$(ls -A "$CLAUDE_DIR/$dir" 2>/dev/null)" ]; then
      needs_backup=true
      break
    fi
  done

  if [ -f "$CLAUDE_DIR/claude.md" ]; then
    needs_backup=true
  fi

  if [ "$needs_backup" = true ]; then
    BACKUP_DIR="$CLAUDE_DIR/backup-$(date +%Y%m%d-%H%M%S)"
    log_warn "Existing config found. Backing up to $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"

    if [ -f "$CLAUDE_DIR/claude.md" ]; then
      cp "$CLAUDE_DIR/claude.md" "$BACKUP_DIR/claude.md"
    fi

    for dir in agents commands rules; do
      if [ -d "$CLAUDE_DIR/$dir" ]; then
        cp -r "$CLAUDE_DIR/$dir" "$BACKUP_DIR/$dir"
      fi
    done

    log_ok "Backup created"
  fi
}

# ============================================================================
# Install user-level config
# ============================================================================
install_user_config() {
  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}  Claude Code SDLC Installer v${VERSION}${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo -e "  ${CYAN}Turn Claude Code into a full dev team${NC}"
  echo -e "  13 AI agents | Documentation-first | TDD"
  echo ""
  echo "  This will install to $CLAUDE_DIR:"
  echo "    claude.md           (workflow instructions)"
  echo "    agents/  (13 files — specialized agent prompts)"
  echo "    commands/ (5 files — SDLC pipeline commands)"
  echo "    rules/   (5 files — process rules)"
  echo ""

  if ! confirm "Proceed with installation?"; then
    log_info "Aborted."
    exit 0
  fi

  get_source_dir
  backup_existing

  # Create directories
  mkdir -p "$CLAUDE_DIR/agents" "$CLAUDE_DIR/commands" "$CLAUDE_DIR/rules"

  # Copy source files
  cp "$SCRIPT_DIR/src/claude.md" "$CLAUDE_DIR/claude.md"
  log_ok "claude.md"

  for agent in "$SCRIPT_DIR"/src/agents/*.md; do
    cp "$agent" "$CLAUDE_DIR/agents/"
    log_ok "agents/$(basename "$agent")"
  done

  for cmd in "$SCRIPT_DIR"/src/commands/*.md; do
    cp "$cmd" "$CLAUDE_DIR/commands/"
    log_ok "commands/$(basename "$cmd")"
  done

  for rule in "$SCRIPT_DIR"/src/rules/*.md; do
    cp "$rule" "$CLAUDE_DIR/rules/"
    log_ok "rules/$(basename "$rule")"
  done

  # Count installed files
  local agent_count cmd_count rule_count total
  agent_count=$(ls -1 "$CLAUDE_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
  cmd_count=$(ls -1 "$CLAUDE_DIR/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
  rule_count=$(ls -1 "$CLAUDE_DIR/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')
  total=$((agent_count + cmd_count + rule_count + 1))

  echo ""
  log_ok "User-level config installed ($total files: 1 workflow + $agent_count agents + $cmd_count commands + $rule_count rules)"

  # Cleanup temp dir if we cloned
  if [ "$LOCAL_MODE" = false ] && [ -n "$SCRIPT_DIR" ] && [ "$SCRIPT_DIR" != "/" ]; then
    rm -rf "$SCRIPT_DIR"
  fi
}

# ============================================================================
# Scaffold project template
# ============================================================================
scaffold_project() {
  echo ""
  log_info "Scaffolding project template in $(pwd)/.claude/"

  if [ -f ".claude/CLAUDE.md" ]; then
    log_warn ".claude/CLAUDE.md already exists — skipping project scaffold"
    log_info "To force, remove .claude/ and rerun with --init-project"
    return
  fi

  # Re-get source dir if needed (may have been cleaned up)
  if [ ! -d "$SCRIPT_DIR/templates" ]; then
    get_source_dir
  fi

  mkdir -p .claude/rules docs/qa docs/use-cases

  # Copy templates
  cp "$SCRIPT_DIR/templates/CLAUDE.md" ".claude/CLAUDE.md"
  log_ok ".claude/CLAUDE.md (template — fill in your project details)"

  cp "$SCRIPT_DIR/templates/rules/architecture.md" ".claude/rules/architecture.md"
  log_ok ".claude/rules/architecture.md (template)"

  cp "$SCRIPT_DIR/templates/rules/security.md" ".claude/rules/security.md"
  log_ok ".claude/rules/security.md (template)"

  cp "$SCRIPT_DIR/templates/rules/testing.md" ".claude/rules/testing.md"
  log_ok ".claude/rules/testing.md (template)"

  cp "$SCRIPT_DIR/templates/scratchpad.md" ".claude/scratchpad.md"
  log_ok ".claude/scratchpad.md"

  cp "$SCRIPT_DIR/templates/settings.json" ".claude/settings.json"
  log_ok ".claude/settings.json"

  cp "$SCRIPT_DIR/templates/CHANGELOG.md" "CHANGELOG.md"
  log_ok "CHANGELOG.md"

  # Create docs structure
  cat > "docs/PRD.md" << 'EOF'
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
EOF
  log_ok "docs/PRD.md (template)"

  touch docs/qa/.gitkeep
  log_ok "docs/qa/"

  touch docs/use-cases/.gitkeep
  log_ok "docs/use-cases/"

  # Cleanup temp dir if we cloned for scaffolding
  if [ "$LOCAL_MODE" = false ] && [ -n "$SCRIPT_DIR" ] && [ "$SCRIPT_DIR" != "/" ]; then
    rm -rf "$SCRIPT_DIR"
  fi

  echo ""
  log_ok "Project template scaffolded"
  echo ""
  echo "  Next steps:"
  echo "    1. Fill in TODO placeholders in .claude/CLAUDE.md"
  echo "    2. Fill in .claude/rules/architecture.md"
  echo "    3. Fill in .claude/rules/security.md"
  echo "    4. Fill in .claude/rules/testing.md"
  echo "    5. Start a Claude Code session and describe a feature"
  echo ""
}

# ============================================================================
# Main
# ============================================================================
install_user_config

if [ "$INIT_PROJECT" = true ]; then
  scaffold_project
fi

echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}  Installation complete!${NC}"
echo -e "${BOLD}============================================${NC}"
echo ""
echo "  The autonomous SDLC workflow is now active."
echo "  Start Claude Code in any project and describe a feature."
echo ""
echo "  The pipeline will automatically:"
echo "    1. Document requirements (PRD)"
echo "    2. Analyze use cases"
echo "    3. Run architecture review"
echo "    4. Document QA test cases"
echo "    5. Plan implementation (5-9 slices)"
echo "    6. Implement with TDD (tests first)"
echo "    7. Run quality gates before merge"
echo ""
echo "  Commands:"
echo "    /develop-feature    Full autonomous pipeline"
echo "    /bootstrap-feature  Documentation phases only"
echo "    /implement-slice    Implement next TDD slice"
echo "    /merge-ready        Run all quality gates"
echo "    /context-refresh    Rebuild session context"
echo ""

if [ "$INIT_PROJECT" = false ]; then
  echo "  To scaffold a new project:"
  echo "    bash install.sh --init-project"
  echo ""
fi

if [ -n "$BACKUP_DIR" ]; then
  echo "  Backup of previous config: $BACKUP_DIR"
  echo ""
fi
