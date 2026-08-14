#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Claude Code SDLC Installer
# ============================================================================
#
# Installs the memory layer for the Claude Code SDLC harness — the always-on
# pipeline instruction and process rules that Claude Code loads as user memory
# on every session.
#
# The agents and skills do NOT come from here. They ship in the Claude Code
# plugin. Install both:
#
#   bash install.sh                      # this script — memory layer
#   /plugin marketplace add <path|repo>  # in a Claude Code session
#   /plugin install claude-code-sdlc@claude-code-sdlc
#
# Why the split: Claude Code auto-loads ~/.claude/claude.md and
# ~/.claude/rules/*.md as user memory, and plugins have no user-memory
# component type. Conversely, user-level agents take precedence over plugin
# agents and plugin subagents are not namespaced — so installing agents here
# would permanently shadow the plugin's copies and make plugin updates
# ineffective. Each asset class lives in the only channel that can carry it.
#
# Quick install:
#   curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash
#
# Usage:
#   bash install.sh                # Install/upgrade the memory layer
#   bash install.sh --init-project # Also scaffold project template in CWD
#   bash install.sh --yes          # Skip confirmation prompts
#   bash install.sh --local        # Use local checkout (skip git clone)
#   bash install.sh --help         # Show help
#
# This script deliberately depends on nothing but a POSIX shell and git. It
# must never invoke `node` or `jq`: it runs on adopter machines that are not
# required to have either.
# ============================================================================

VERSION="4.0.0"
REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"
PLUGIN_NAME="claude-code-sdlc"
CLAUDE_DIR=""
BACKUP_DIR=""
INIT_PROJECT=false
AUTO_YES=false
LOCAL_MODE=false
SCRIPT_DIR=""
CLONED_TEMP=false

# Populated by load_manifest()
MANIFEST_OWNS=()
MANIFEST_LEGACY=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ----------------------------------------------------------------------------
# Output
#
# Trusted messages may carry colour escapes. Untrusted strings — manifest
# entries, receipt lines, user-supplied paths — must NEVER reach `echo -e`:
# a crafted entry containing raw ESC bytes could rewrite the terminal, hide a
# rejection, or forge an "[OK]" line. Those go through say_untrusted(), which
# strips control characters and uses printf with a literal format.
# ----------------------------------------------------------------------------
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}  [OK]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

say_untrusted() {
  # $1 = label, $2 = untrusted content
  printf '%s%s\n' "$1" "$(printf '%s' "$2" | tr -d '[:cntrl:]')"
}

print_help() {
  cat << HELPEOF
Claude Code SDLC Installer v${VERSION}

Installs the memory layer. Agents and skills ship in the Claude Code plugin.

USAGE:
  bash install.sh [OPTIONS]

OPTIONS:
  --init-project   Scaffold .claude/ template + docs/ in current directory
  --yes            Skip confirmation prompts
  --local          Use local checkout instead of cloning from GitHub
  --help           Show this help message

WHAT GETS INSTALLED (~/.claude/):
  claude.md        Main workflow instructions (loaded as user memory)
  rules/           5 process rules (loaded as user memory)
  .sdlc-receipt    Record of exactly what this install placed

WHAT DOES NOT COME FROM HERE:
  agents/          13 specialized agents — ship in the plugin
  skills/          5 pipeline skills    — ship in the plugin

  Install the plugin from a Claude Code session:
    /plugin marketplace add <path-or-repo>
    /plugin install ${PLUGIN_NAME}@${PLUGIN_NAME}

  Both parts are required. This script alone gives you the pipeline
  instruction and process rules but no specialist agents to delegate to.

UPGRADING FROM v3.x:
  Earlier versions copied agents to ~/.claude/agents/ and commands to
  ~/.claude/commands/. Those copies would shadow their plugin replacements,
  so this installer removes them. Your own agents in ~/.claude/agents/ are
  never touched — removal is scoped to a manifest, never a wildcard.

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

SKILLS AVAILABLE (after installing the plugin):
  Written in full these are /${PLUGIN_NAME}:<name>; the bare form works
  whenever no other installed plugin defines the same skill name.

  /develop-feature    Full autonomous pipeline
  /bootstrap-feature  Documentation phases only
  /implement-slice    Implement next TDD slice
  /merge-ready        Run all quality gates
  /context-refresh    Rebuild session context
HELPEOF
}

# ----------------------------------------------------------------------------
# Prompting
#
# Under `curl | bash` stdin IS the script, so a bare `read` would consume
# script text as the answer. Always read from the terminal; when there is no
# terminal and --yes was not given, refuse rather than guess.
# ----------------------------------------------------------------------------
confirm() {
  if [ "$AUTO_YES" = true ]; then return 0; fi
  if [ ! -r /dev/tty ]; then
    log_error "No terminal available for confirmation. Re-run with --yes to proceed non-interactively."
    return 1
  fi
  echo -e "${YELLOW}$1 [y/N]${NC}"
  local response=""
  read -r response < /dev/tty || return 1
  case "$response" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

# ----------------------------------------------------------------------------
# Target directory
#
# Resolve ~/.claude to a physical path once, so every containment check below
# compares against a path with no symlinks in it. A symlinked ~/.claude is a
# legitimate dotfiles setup and is supported; a dangling link or a non-directory
# is not.
# ----------------------------------------------------------------------------
resolve_claude_dir() {
  local target="$HOME/.claude"

  if [ ! -e "$target" ]; then
    mkdir -p -- "$target"
  fi
  if [ ! -d "$target" ]; then
    log_error "$HOME/.claude exists but is not a directory. Move it aside and re-run."
    exit 1
  fi

  CLAUDE_DIR="$(cd -- "$target" 2>/dev/null && pwd -P)" || {
    log_error "Could not resolve $HOME/.claude to a real directory."
    exit 1
  }
}

# ----------------------------------------------------------------------------
# Manifest
#
# Path validation is an ALLOWLIST, not a denylist. A denylist that rejects
# leading "/" and ".." still admits backslashes, CR from a CRLF file, glob
# metacharacters, option-like leading "-", control bytes and empty segments.
# The structural allowlist is the load-bearing control: whatever a forked,
# tampered or truncated manifest contains, the reachable surface is bounded to
# claude.md plus one filename level under three known directories.
#
# Validation runs over the WHOLE file before any destructive action, so a bad
# entry at line 40 cannot leave the first 39 already applied.
# ----------------------------------------------------------------------------
validate_entry() {
  local entry="$1" line_no="$2" source="$3"

  case "$entry" in
    *[!A-Za-z0-9._/-]*)
      say_untrusted "  rejected entry: " "$entry"
      log_error "$source line $line_no: contains a character outside [A-Za-z0-9._/-]"
      return 1 ;;
  esac
  case "$entry" in
    /*|-*|.*)
      say_untrusted "  rejected entry: " "$entry"
      log_error "$source line $line_no: must be a relative path not starting with '-' or '.'"
      return 1 ;;
  esac
  case "$entry" in
    */../*|../*|*/..|..|*/./*|./*|*/.)
      say_untrusted "  rejected entry: " "$entry"
      log_error "$source line $line_no: contains a '.' or '..' path segment"
      return 1 ;;
  esac
  case "$entry" in
    *//*|*/)
      say_untrusted "  rejected entry: " "$entry"
      log_error "$source line $line_no: contains an empty path segment or a trailing slash"
      return 1 ;;
  esac
  case "$entry" in
    claude.md|agents/[A-Za-z0-9]*|rules/[A-Za-z0-9]*|commands/[A-Za-z0-9]*) ;;
    *)
      say_untrusted "  rejected entry: " "$entry"
      log_error "$source line $line_no: outside the allowed structure (claude.md, agents/*, rules/*, commands/*)"
      return 1 ;;
  esac

  return 0
}

load_manifest() {
  local manifest="$SCRIPT_DIR/manifests/owned-files.txt"

  if [ ! -f "$manifest" ]; then
    log_error "Manifest not found at manifests/owned-files.txt — refusing to run."
    exit 1
  fi

  MANIFEST_OWNS=()
  MANIFEST_LEGACY=()

  local section="" line="" entry="" line_no=0 failed=false

  # `IFS=` and `-r` keep the line byte-exact; the `|| [ -n "$line" ]` clause
  # means a file with no trailing newline cannot silently drop its last entry.
  while IFS= read -r line || [ -n "$line" ]; do
    line_no=$((line_no + 1))
    case "$line" in
      '#'*) continue ;;
    esac
    entry="$(printf '%s' "$line" | tr -d '[:space:]')"
    [ -z "$entry" ] && continue

    if [ "$entry" = "owns" ]; then section="owns"; continue; fi
    if [ "$entry" = "legacy" ]; then section="legacy"; continue; fi

    if [ -z "$section" ]; then
      log_error "manifest line $line_no: entry appears before any section marker"
      failed=true
      continue
    fi

    if ! validate_entry "$entry" "$line_no" "manifest"; then
      failed=true
      continue
    fi

    if [ "$section" = "owns" ]; then
      MANIFEST_OWNS+=("$entry")
    else
      MANIFEST_LEGACY+=("$entry")
    fi
  done < "$manifest"

  if [ "$failed" = true ]; then
    log_error "Manifest failed validation. No files were changed."
    exit 1
  fi

  if [ "${#MANIFEST_OWNS[@]}" -eq 0 ]; then
    log_error "Manifest declares no owned files — refusing to proceed with a destructive operation."
    exit 1
  fi
}

# ----------------------------------------------------------------------------
# Guarded removal
#
# Parse-time validation is not enough on its own: between validating an entry
# and acting on it, a parent directory could be replaced with a symlink. These
# checks run immediately before each unlink, on the freshly joined path.
#
# `rm -rf` never appears here. Directories are cleared with `rmdir`, which
# fails on a non-empty directory — that failure is exactly what mechanically
# guarantees a user's own agents keep ~/.claude/agents/ alive.
# ----------------------------------------------------------------------------
guarded_rm() {
  local entry="$1"
  local path="$CLAUDE_DIR/$entry"
  local top="${entry%%/*}"

  if [ "$top" != "$entry" ] && [ -L "$CLAUDE_DIR/$top" ]; then
    log_error "Refusing to act: $CLAUDE_DIR/$top is a symlink."
    exit 1
  fi

  [ -e "$path" ] || [ -L "$path" ] || return 0

  if [ -d "$path" ] && [ ! -L "$path" ]; then
    log_error "Refusing to remove $entry: it is a directory, not a file."
    exit 1
  fi

  local parent
  parent="$(cd -- "$(dirname -- "$path")" 2>/dev/null && pwd -P)" || return 0
  case "$parent" in
    "$CLAUDE_DIR"|"$CLAUDE_DIR"/*) ;;
    *)
      log_error "Refusing to remove $entry: resolves outside $CLAUDE_DIR."
      exit 1 ;;
  esac

  rm -f -- "$path"
}

prune_empty_dirs() {
  local dir
  for dir in agents commands rules; do
    [ -d "$CLAUDE_DIR/$dir" ] || continue
    [ -L "$CLAUDE_DIR/$dir" ] && continue
    rmdir -- "$CLAUDE_DIR/$dir" 2>/dev/null || true
  done
}

# ----------------------------------------------------------------------------
# Source directory
# ----------------------------------------------------------------------------
get_source_dir() {
  if [ "$LOCAL_MODE" = true ]; then
    SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
    if [ ! -d "$SCRIPT_DIR/agents" ] || [ ! -f "$SCRIPT_DIR/manifests/owned-files.txt" ]; then
      log_error "Local mode requires running from the claude-code-sdlc repo root"
      exit 1
    fi
  else
    SCRIPT_DIR=$(mktemp -d)
    CLONED_TEMP=true
    log_info "Cloning claude-code-sdlc..."
    if ! git clone --depth 1 --quiet "$REPO_URL" "$SCRIPT_DIR" 2>/dev/null; then
      log_error "Failed to clone repository. Check your internet connection."
      rm -rf "$SCRIPT_DIR"
      exit 1
    fi
    # Sanity-check the clone before anything destructive happens.
    if [ ! -f "$SCRIPT_DIR/manifests/owned-files.txt" ] || [ ! -f "$SCRIPT_DIR/src/claude.md" ]; then
      log_error "Cloned repository is missing expected files — refusing to proceed."
      rm -rf "$SCRIPT_DIR"
      exit 1
    fi
    log_ok "Repository cloned"
  fi
}

cleanup_source_dir() {
  if [ "$CLONED_TEMP" = true ] && [ -n "$SCRIPT_DIR" ] && [ -d "$SCRIPT_DIR" ]; then
    rm -rf "$SCRIPT_DIR"
    CLONED_TEMP=false
  fi
}

# ----------------------------------------------------------------------------
# Backup
#
# Staged inside CLAUDE_DIR so the publishing `mv` is a same-filesystem rename:
# an interrupted run leaves either a complete backup or none, never a partial
# one. A staging directory in $TMPDIR could be on another filesystem, which
# would silently degrade the rename into a non-atomic copy.
# ----------------------------------------------------------------------------
backup_existing() {
  local needs_backup=false dir=""

  for dir in agents commands rules; do
    if [ -d "$CLAUDE_DIR/$dir" ] && [ -n "$(ls -A "$CLAUDE_DIR/$dir" 2>/dev/null)" ]; then
      needs_backup=true
      break
    fi
  done
  [ -f "$CLAUDE_DIR/claude.md" ] && needs_backup=true

  [ "$needs_backup" = false ] && return 0

  local staging
  staging="$(mktemp -d "$CLAUDE_DIR/.backup-staging.XXXXXX")"

  [ -f "$CLAUDE_DIR/claude.md" ] && cp -- "$CLAUDE_DIR/claude.md" "$staging/claude.md"
  for dir in agents commands rules; do
    if [ -d "$CLAUDE_DIR/$dir" ] && [ ! -L "$CLAUDE_DIR/$dir" ]; then
      cp -R -P -- "$CLAUDE_DIR/$dir" "$staging/$dir"
    fi
  done
  if [ -f "$CLAUDE_DIR/.sdlc-receipt" ]; then
    cp -- "$CLAUDE_DIR/.sdlc-receipt" "$staging/.sdlc-receipt"
  fi

  local stamp candidate
  stamp="$(date +%Y%m%d-%H%M%S)"
  candidate="$CLAUDE_DIR/backup-$stamp"
  local suffix=1
  while [ -e "$candidate" ]; do
    candidate="$CLAUDE_DIR/backup-$stamp-$suffix"
    suffix=$((suffix + 1))
  done

  mv -- "$staging" "$candidate"
  BACKUP_DIR="$candidate"
  log_warn "Existing config backed up to $BACKUP_DIR"
}

sweep_stale_staging() {
  local d
  for d in "$CLAUDE_DIR"/.backup-staging.*; do
    [ -d "$d" ] || continue
    rm -rf -- "$d"
  done
}

# ----------------------------------------------------------------------------
# Receipt
#
# Written atomically and only after every file is in place, so an interrupted
# install can never leave a receipt claiming files it did not place. Relative
# paths only — the receipt must not leak a home directory or username.
# ----------------------------------------------------------------------------
write_receipt() {
  local tmp
  tmp="$(mktemp "$CLAUDE_DIR/.sdlc-receipt.XXXXXX")"
  {
    printf '%s\n' "$VERSION"
    local entry
    for entry in ${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"}; do
      printf '%s\n' "$entry"
    done
  } > "$tmp"
  mv -- "$tmp" "$CLAUDE_DIR/.sdlc-receipt"
}

# ----------------------------------------------------------------------------
# Legacy cleanup
# ----------------------------------------------------------------------------
remove_legacy() {
  local entry removed=0
  for entry in ${MANIFEST_LEGACY[@]+"${MANIFEST_LEGACY[@]}"}; do
    if [ -e "$CLAUDE_DIR/$entry" ] || [ -L "$CLAUDE_DIR/$entry" ]; then
      guarded_rm "$entry"
      say_untrusted "  removed retired file: " "$entry"
      removed=$((removed + 1))
    fi
  done
  prune_empty_dirs

  if [ "$removed" -gt 0 ]; then
    log_warn "Removed $removed retired v3.x file(s) that would otherwise shadow their plugin replacements."
    if [ -n "$BACKUP_DIR" ]; then
      log_info "Their contents are preserved in $BACKUP_DIR"
    fi
  fi
}

# ----------------------------------------------------------------------------
# Install
# ----------------------------------------------------------------------------
install_user_config() {
  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}  Claude Code SDLC Installer v${VERSION}${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo -e "  ${CYAN}Turn Claude Code into a full dev team${NC}"
  echo "  Documentation-first | TDD | Quality gates"
  echo ""
  echo "  This installs the memory layer to $HOME/.claude:"
  echo "    claude.md   (workflow instructions)"
  echo "    rules/      (5 files — process rules)"
  echo ""
  echo "  Agents and skills ship in the plugin, not here."
  echo "  Any retired v3.x agent/command copies will be removed."
  echo ""

  if ! confirm "Proceed with installation?"; then
    log_info "Aborted."
    exit 0
  fi

  resolve_claude_dir
  get_source_dir
  load_manifest
  sweep_stale_staging
  backup_existing

  mkdir -p -- "$CLAUDE_DIR/rules"

  cp -- "$SCRIPT_DIR/src/claude.md" "$CLAUDE_DIR/claude.md"
  log_ok "claude.md"

  local rule
  for rule in "$SCRIPT_DIR"/src/rules/*.md; do
    cp -- "$rule" "$CLAUDE_DIR/rules/"
    log_ok "rules/$(basename -- "$rule")"
  done

  remove_legacy
  write_receipt

  local rule_count
  rule_count=$(ls -1 "$CLAUDE_DIR/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')

  echo ""
  log_ok "Memory layer installed (1 workflow file + $rule_count rules)"
  log_info "Receipt written to $CLAUDE_DIR/.sdlc-receipt"
}

# ----------------------------------------------------------------------------
# Project scaffold
# ----------------------------------------------------------------------------
scaffold_project() {
  echo ""
  log_info "Scaffolding project template in $(pwd)/.claude/"

  if [ -f ".claude/CLAUDE.md" ]; then
    log_warn ".claude/CLAUDE.md already exists — skipping project scaffold"
    log_info "To force, remove .claude/ and rerun with --init-project"
    return
  fi

  if [ ! -d "$SCRIPT_DIR/templates" ]; then
    get_source_dir
  fi

  mkdir -p .claude/rules docs/qa docs/use-cases

  cp -- "$SCRIPT_DIR/templates/CLAUDE.md" ".claude/CLAUDE.md"
  log_ok ".claude/CLAUDE.md (template — fill in your project details)"

  cp -- "$SCRIPT_DIR/templates/rules/architecture.md" ".claude/rules/architecture.md"
  log_ok ".claude/rules/architecture.md (template)"

  cp -- "$SCRIPT_DIR/templates/rules/security.md" ".claude/rules/security.md"
  log_ok ".claude/rules/security.md (template)"

  cp -- "$SCRIPT_DIR/templates/rules/testing.md" ".claude/rules/testing.md"
  log_ok ".claude/rules/testing.md (template)"

  cp -- "$SCRIPT_DIR/templates/scratchpad.md" ".claude/scratchpad.md"
  log_ok ".claude/scratchpad.md"

  cp -- "$SCRIPT_DIR/templates/settings.json" ".claude/settings.json"
  log_ok ".claude/settings.json"

  cp -- "$SCRIPT_DIR/templates/CHANGELOG.md" "CHANGELOG.md"
  log_ok "CHANGELOG.md"

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

print_footer() {
  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}  Installation complete!${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo "  The memory layer is installed. To get the agents and skills,"
  echo "  install the plugin from a Claude Code session:"
  echo ""
  echo "    /plugin marketplace add <path-or-repo>"
  echo "    /plugin install ${PLUGIN_NAME}@${PLUGIN_NAME}"
  echo ""
  echo "  Then describe a feature and the pipeline will automatically:"
  echo "    1. Document requirements (PRD)"
  echo "    2. Analyze use cases"
  echo "    3. Run architecture review"
  echo "    4. Document QA test cases"
  echo "    5. Plan implementation (5-9 slices)"
  echo "    6. Implement with TDD (tests first)"
  echo "    7. Run quality gates before merge"
  echo ""
  echo "  Skills (bare form works absent a name collision;"
  echo "  in full they are /${PLUGIN_NAME}:<name>):"
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
}

# ============================================================================
# Main
#
# Everything runs inside main(), invoked on the final line. Under `curl | bash`
# a truncated download then fails to parse instead of executing a prefix — for
# a script that deletes files, that must be structural, not a happy accident of
# layout.
# ============================================================================
main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --init-project) INIT_PROJECT=true; shift ;;
      --yes) AUTO_YES=true; shift ;;
      --local) LOCAL_MODE=true; shift ;;
      --help|-h) print_help; exit 0 ;;
      *)
        say_untrusted "Unknown option: " "$1"
        print_help
        exit 1 ;;
    esac
  done

  install_user_config

  if [ "$INIT_PROJECT" = true ]; then
    scaffold_project
  fi

  cleanup_source_dir
  print_footer
}

main "$@"
