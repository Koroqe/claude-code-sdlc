#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Claude Code SDLC Installer
# ============================================================================
#
# Installs an autonomous SDLC workflow for Claude Code — 17 specialized AI
# agents that mirror a professional software development team.
#
# Quick install:
#   curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash
#
# Usage:
#   bash install.sh                # Install user-level config
#   bash install.sh --init-project # Also scaffold project template in CWD
#   bash install.sh --yes          # Skip confirmation prompts
#   bash install.sh --local        # Use local checkout (skip git clone)
#   bash install.sh --help         # Show help
# ============================================================================

VERSION="3.0.0"
KNOWLEDGE_VERSION="0.1.0"
KNOWLEDGE_PDFIUM_VERSION="chromium/7802"  # bblanchon/pdfium-binaries tag (verified latest stable as of 2026-04-25)
REPO_URL="https://github.com/codefather-labs/claude-code-sdlc.git"
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
Claude Code SDLC Installer v3.0.0

Turn Claude Code into a full dev team with 17 specialized AI agents.

USAGE:
  bash install.sh [OPTIONS]

OPTIONS:
  --init-project   Scaffold .claude/ template + docs/ in current directory
  --yes            Skip confirmation prompts
  --local          Use local checkout instead of cloning from GitHub
  --help           Show this help message

WHAT GETS INSTALLED (~/.claude/):
  claude.md        Main workflow instructions
  agents/          17 specialized agent prompts
  commands/        5 SDLC pipeline commands
  rules/           4 process rules

WHAT --init-project CREATES (in current directory):
  .claude/CLAUDE.md           Project context template
  .claude/rules/              Architecture, security, testing rules
  .claude/scratchpad.md       Session state persistence
  .claude/settings.json       Permissions config
  docs/PRD.md                 Product requirements document
  docs/qa/                    QA test case directory
  docs/use-cases/             Use case document directory

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
  echo -e "  17 AI agents | Documentation-first | TDD"
  echo ""
  echo "  This will install to $CLAUDE_DIR:"
  echo "    claude.md           (workflow instructions)"
  echo "    agents/  (17 files — specialized agent prompts)"
  echo "    commands/ (5 files — SDLC pipeline commands)"
  echo "    rules/   (4 files — process rules)"
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

  cp "$SCRIPT_DIR/templates/rules/changelog.md" ".claude/rules/changelog.md"
  log_ok ".claude/rules/changelog.md (template)"

  cp "$SCRIPT_DIR/templates/rules/auto-release.md" ".claude/rules/auto-release.md"
  log_ok ".claude/rules/auto-release.md (template — release-engineer Gate 9 executing mode)"

  # Pre-push hook (advisory) — install only if .git/hooks exists.
  # The hook is opt-out per project: `rm .git/hooks/pre-push` after install.
  if [ -d .git/hooks ]; then
    if [ -f .git/hooks/pre-push ]; then
      log_warn ".git/hooks/pre-push already exists — skipping (preserve user's existing hook)"
    else
      cp "$SCRIPT_DIR/templates/hooks/pre-push" ".git/hooks/pre-push"
      chmod +x .git/hooks/pre-push
      log_ok ".git/hooks/pre-push (advisory — warns when CHANGELOG [Unreleased] is non-empty at push)"
    fi
  fi

  cp "$SCRIPT_DIR/templates/scratchpad.md" ".claude/scratchpad.md"
  log_ok ".claude/scratchpad.md"

  cp "$SCRIPT_DIR/templates/settings.json" ".claude/settings.json"
  log_ok ".claude/settings.json"

  # Knowledge-base scaffold (Slice 5 — local-knowledge-base)
  mkdir -p .claude/knowledge/sources
  cp -n "$SCRIPT_DIR/templates/knowledge/.gitignore" ".claude/knowledge/.gitignore" 2>/dev/null || true
  log_ok ".claude/knowledge/.gitignore"
  cp "$SCRIPT_DIR/templates/knowledge/.gitkeep" ".claude/knowledge/sources/.gitkeep"
  log_ok ".claude/knowledge/sources/"

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
  echo "  Auto-release (opt-out):"
  echo "    .claude/rules/auto-release.md activates release-engineer Gate 9"
  echo "    executing mode. Gate 9 will create and push release tags during"
  echo "    /merge-ready (Sensitive-tier prompts default-deny [y/N], or set"
  echo "    AUTO_RELEASE=1 to auto-confirm). To opt out: remove that file."
  echo ""
}

# ============================================================================
# Install sdlc-knowledge binary (Slice 5 — local-knowledge-base)
# ============================================================================
install_knowledge_binary() {
  # install.sh ordering option (B): re-acquire source dir if cleanup ran already.
  if [ ! -d "$SCRIPT_DIR/tools/sdlc-knowledge" ]; then
    get_source_dir
  fi

  local target_dir="$CLAUDE_DIR/tools/sdlc-knowledge"
  mkdir -p "$target_dir"

  # Validate uname -ms against fixed allowlist BEFORE URL interpolation.
  # Windows variants (Git Bash / MSYS2 / Cygwin) report uname -s as MINGW64_NT-*,
  # MSYS_NT-*, or CYGWIN_NT-*; arch comes from uname -m. The combined uname -ms
  # therefore starts with one of those prefixes — match the prefix glob, then
  # gate arch separately via uname -m for safety.
  local platform exe_ext=""
  case "$(uname -ms)" in
    "Darwin arm64")  platform="darwin-arm64"  ;;
    "Darwin x86_64") platform="darwin-x64"    ;;
    "Linux x86_64")  platform="linux-x64"     ;;
    "Linux aarch64") platform="linux-arm64"   ;;
    MINGW*|MSYS*|CYGWIN*)
      case "$(uname -m)" in
        x86_64) platform="windows-x64"; exe_ext=".exe" ;;
        *)
          log_warn "unsupported Windows arch: $(uname -m); skipping"
          return 0
          ;;
      esac
      ;;
    *)
      log_warn "binary unavailable; install cargo or wait for first release"
      return 0
      ;;
  esac

  local target_bin="$target_dir/sdlc-knowledge${exe_ext}"

  # Idempotency: skip if already at expected version.
  if [ -x "$target_bin" ]; then
    local existing_ver
    existing_ver="$("$target_bin" --version 2>/dev/null | awk '{print $2}' || true)"
    if [ "$existing_ver" = "$KNOWLEDGE_VERSION" ]; then
      log_ok "sdlc-knowledge already at expected version $KNOWLEDGE_VERSION"
      return 0
    fi
  fi

  # Compute owner/repo from REPO_URL (hard-coded source — no env override).
  local owner_repo
  owner_repo="$(echo "$REPO_URL" | sed 's|^https://github.com/||; s|\.git$||')"
  local url="https://github.com/${owner_repo}/releases/download/sdlc-knowledge-v${KNOWLEDGE_VERSION}/sdlc-knowledge-${platform}${exe_ext}"

  local tmp
  tmp="$(mktemp)"

  # TLS-only download. NEVER -k / --insecure. Try curl first, then wget.
  # Slice 2 security pre-review MEDIUM: --max-redirs 5 / --max-time 120 (curl) and
  # --max-redirect=5 / --timeout=120 / --secure-protocol=TLSv1_2 (wget) for parity
  # with the pdfium download path (install_pdfium_binary lines 545/550). Mitigates
  # redirect-loop DoS and infinite-stall scenarios on attacker-controlled URLs.
  # TODO(iter-2): add sdlc-knowledge-<platform>.sha256 sidecar download + shasum -a 256 -c verification
  if command -v curl >/dev/null 2>&1; then
    if ! curl --proto '=https' --tlsv1.2 -fsSL --max-redirs 5 --max-time 120 "$url" -o "$tmp"; then
      rm -f "$tmp"
      cargo_source_build_fallback
      return $?
    fi
  elif command -v wget >/dev/null 2>&1; then
    if ! wget --https-only --secure-protocol=TLSv1_2 --max-redirect=5 --timeout=120 -q -O "$tmp" "$url"; then
      rm -f "$tmp"
      cargo_source_build_fallback
      return $?
    fi
  else
    rm -f "$tmp"
    log_warn "binary unavailable; install cargo or wait for first release"
    return 0
  fi

  chmod +x "$tmp"

  # Verify --version exits 0 BEFORE writing allowlist entry.
  if ! "$tmp" --version >/dev/null 2>&1; then
    log_warn "downloaded binary failed --version smoke; falling back"
    rm -f "$tmp"
    cargo_source_build_fallback
    return $?
  fi

  mv "$tmp" "$target_bin"
  chmod +x "$target_bin"
  log_ok "tools/sdlc-knowledge/sdlc-knowledge ($platform)"
}

# ============================================================================
# Cargo source-build fallback (Slice 5)
# ============================================================================
cargo_source_build_fallback() {
  # install.sh ordering option (B): re-acquire source dir if cleanup ran already.
  if [ ! -d "$SCRIPT_DIR/tools/sdlc-knowledge" ]; then
    get_source_dir
  fi

  if ! command -v cargo >/dev/null 2>&1; then
    log_warn "binary unavailable; install cargo or wait for first release"
    return 0
  fi
  if [ ! -f "$SCRIPT_DIR/tools/sdlc-knowledge/Cargo.toml" ]; then
    log_warn "binary unavailable; install cargo or wait for first release"
    return 0
  fi

  log_info "Building sdlc-knowledge from source via cargo (fallback)..."
  if ! cargo build --release -p sdlc-knowledge --manifest-path "$SCRIPT_DIR/tools/sdlc-knowledge/Cargo.toml" 2>&1 | tail -5; then
    log_warn "cargo build failed; binary unavailable"
    return 0
  fi

  # Cargo names the artifact sdlc-knowledge.exe on Windows; preserve the
  # extension when copying to the install location.
  local exe_ext=""
  case "$(uname -ms)" in
    MINGW*|MSYS*|CYGWIN*) exe_ext=".exe" ;;
  esac

  local target_dir="$CLAUDE_DIR/tools/sdlc-knowledge"
  local built_bin="$SCRIPT_DIR/tools/sdlc-knowledge/target/release/sdlc-knowledge${exe_ext}"
  mkdir -p "$target_dir"
  if [ ! -x "$built_bin" ]; then
    log_warn "cargo build did not produce expected binary at $built_bin"
    return 0
  fi
  cp "$built_bin" "$target_dir/sdlc-knowledge${exe_ext}"
  chmod +x "$target_dir/sdlc-knowledge${exe_ext}"
  log_ok "tools/sdlc-knowledge/sdlc-knowledge${exe_ext} (built from source)"
}

# ============================================================================
# Register Bash allowlist for sdlc-knowledge in ~/.claude/settings.json (Slice 5)
# ============================================================================
register_bash_allowlist() {
  local settings="$CLAUDE_DIR/settings.json"
  local entry='~/.claude/tools/sdlc-knowledge/sdlc-knowledge *'

  # Missing-file create case: write minimal literal JSON.
  if [ ! -f "$settings" ]; then
    mkdir -p "$CLAUDE_DIR"
    cat > "$settings" <<'EOF'
{"permissions":{"allow":["~/.claude/tools/sdlc-knowledge/sdlc-knowledge *"]}}
EOF
    chmod 0644 "$settings"
    log_ok "settings.json (created with sdlc-knowledge allowlist)"
    return 0
  fi

  # File exists: prefer atomic jq-based merge; fail-closed if jq absent.
  if command -v jq >/dev/null 2>&1; then
    local tmp
    tmp="$(mktemp)"
    if jq --arg e "$entry" \
         '(.permissions //= {}) | (.permissions.allow //= []) | .permissions.allow = ((.permissions.allow + [$e]) | unique)' \
         "$settings" > "$tmp" \
       && jq -e '.' "$tmp" >/dev/null 2>&1; then
      mv "$tmp" "$settings"
      chmod 0644 "$settings"
      log_ok "settings.json (sdlc-knowledge allowlist merged)"
    else
      rm -f "$tmp"
      log_warn "settings.json merge failed; please add manually: $entry"
    fi
  else
    if grep -Fq "$entry" "$settings"; then
      log_ok "settings.json already contains sdlc-knowledge allowlist"
    else
      log_warn "jq required for safe settings.json merge — install jq or merge manually: $entry"
    fi
  fi
}

# ============================================================================
# Install pdfium dynamic library (Slice 3 — pdfium-pdf-extraction)
# ============================================================================
install_pdfium_binary() {
  # M9: graceful failure — wrap in subshell to insulate from set -e
  (
    set +e

    # M10: ordering — re-invoke get_source_dir if SCRIPT_DIR was cleaned up
    if [ ! -d "$SCRIPT_DIR/templates" ]; then
      get_source_dir
    fi

    # M16: deterministic mode bits
    umask 0022

    local target_dir="$CLAUDE_DIR/tools/sdlc-knowledge/pdfium"
    local lib_dir="$target_dir/lib"
    local sentinel="$target_dir/.version"

    # M8: idempotency — skip if existing version matches
    if [ -f "$sentinel" ]; then
      local existing
      existing=$(cat "$sentinel" 2>/dev/null)
      if [ "$existing" = "$KNOWLEDGE_PDFIUM_VERSION" ]; then
        log_ok "pdfium binary already at version $KNOWLEDGE_PDFIUM_VERSION"
        return 0
      fi
    fi

    # M12: uname allowlist — fail closed before URL interpolation
    local platform asset
    case "$(uname -s)/$(uname -m)" in
      Darwin/arm64)   platform=darwin-arm64;  asset=pdfium-mac-arm64.tgz   ;;
      Darwin/x86_64)  platform=darwin-x64;    asset=pdfium-mac-x64.tgz     ;;
      Linux/x86_64)   platform=linux-x64;     asset=pdfium-linux-x64.tgz   ;;
      Linux/aarch64)  platform=linux-arm64;   asset=pdfium-linux-arm64.tgz ;;
      *)
        log_warn "unsupported platform for pdfium binary: $(uname -s)/$(uname -m); skipping"
        return 0
        ;;
    esac

    # M1: URL hardcoded from constants
    local url="https://github.com/bblanchon/pdfium-binaries/releases/download/${KNOWLEDGE_PDFIUM_VERSION}/${asset}"

    # M3: download to mktemp
    local tmp_archive
    tmp_archive=$(mktemp -t pdfium.XXXXXX) || { log_warn "mktemp failed"; return 0; }

    # M4: extract to mktemp -d staging
    local staging
    staging=$(mktemp -d -t pdfium.XXXXXX) || { log_warn "mktemp -d failed"; rm -f "$tmp_archive"; return 0; }

    # cleanup trap
    trap 'rm -f "$tmp_archive"; rm -rf "$staging" 2>/dev/null' EXIT

    # M2 + M14 + M15: TLS-only download with redirect/timeout bounds; curl primary + wget fallback
    if command -v curl >/dev/null 2>&1; then
      if ! curl --proto '=https' --tlsv1.2 -fsSL --max-redirs 5 --max-time 120 "$url" -o "$tmp_archive"; then
        log_warn "pdfium download failed (curl); skipping PDF support"
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      if ! wget --https-only --secure-protocol=TLSv1_2 --max-redirect=5 --timeout=120 -q -O "$tmp_archive" "$url"; then
        log_warn "pdfium download failed (wget); skipping PDF support"
        return 0
      fi
    else
      log_warn "neither curl nor wget available; skipping pdfium install"
      return 0
    fi

    # M6 pre-extract: reject malicious tar entries (path traversal or absolute paths)
    if tar -tzf "$tmp_archive" 2>/dev/null | grep -E '^/|(^|/)\.\.(/|$)' >/dev/null; then
      log_warn "pdfium archive contains traversal entries; refusing to extract"
      return 0
    fi

    # M5: tar safety flags
    if ! tar --no-same-owner --no-same-permissions -xzf "$tmp_archive" -C "$staging" 2>/dev/null; then
      log_warn "pdfium archive extraction failed"
      return 0
    fi

    # M6 post-extract: re-check for traversal artifacts
    if find "$staging" -path '*..*' -print -quit 2>/dev/null | grep -q .; then
      log_warn "pdfium archive produced traversal paths post-extract; refusing"
      return 0
    fi

    # M7: reject suid/sgid bits
    if find "$staging" -perm /6000 -print -quit 2>/dev/null | grep -q .; then
      log_warn "pdfium archive contains setuid/setgid files; refusing"
      return 0
    fi

    # bblanchon archive layout: lib/libpdfium.{dylib|so} at top level
    local extracted_lib
    extracted_lib=$(find "$staging" -maxdepth 3 -name "libpdfium*" -type f -print -quit 2>/dev/null)
    if [ -z "$extracted_lib" ]; then
      log_warn "no libpdfium found in extracted archive"
      return 0
    fi

    # Move to canonical location
    mkdir -p "$lib_dir"
    cp "$extracted_lib" "$lib_dir/"
    chmod 0755 "$lib_dir"/libpdfium*

    # Write version sentinel
    echo "$KNOWLEDGE_PDFIUM_VERSION" > "$sentinel"
    chmod 0644 "$sentinel"

    # M17: post-install integrity check
    if ! [ -s "$lib_dir/libpdfium.dylib" ] && ! [ -s "$lib_dir/libpdfium.so" ]; then
      log_warn "pdfium post-install integrity check failed; cleaning up"
      rm -rf "$target_dir"
      return 0
    fi

    log_ok "pdfium binary installed: ${platform} (version ${KNOWLEDGE_PDFIUM_VERSION})"
    # M13: hash verification deferral
    # TODO(iter-3): add pdfium-<arch>.tgz.sha256 sidecar verification
    return 0
  )
  return 0  # always succeed (FR-3.5 graceful degradation)
}

# ============================================================================
# Main
# ============================================================================
install_user_config
install_knowledge_binary
register_bash_allowlist
install_pdfium_binary

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
