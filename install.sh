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
# Installs BOTH layers. The memory layer is copied into ~/.claude directly;
# the plugin layer (agents, skills, hooks) is installed by driving the
# `claude plugin` CLI, so one command does the whole job:
#
#   curl -fsSL <raw-url>/install.sh | bash
#
# Pass --no-plugin to install only the memory layer. If `claude` is not on
# PATH the script still installs the memory layer and prints the two commands
# needed to add the plugin later.
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

# ----------------------------------------------------------------------------
# Model profiles (--profile) — spike finding (FR-7.6)
#
# `install.sh --local --profile <quality|balanced|budget|inherit>` rewrites
# the `model:` frontmatter line of all 16 files under agents/ to a per-role
# value (see model_for_role() below; README.md's "Model Profiles" section
# carries the full table).
#
# Whether an already-running Claude Code session re-reads agents/*.md
# frontmatter live, or instead snapshots agent definitions once at plugin
# load/session start, could NOT be determined from this repository or this
# development environment. Recorded honestly as UNDETERMINED rather than
# assumed, with the evidence gathered and what would settle it:
#   - This plugin's own manifest (.claude-plugin/plugin.json) points
#     `agents:` at a static directory path (./agents/). How, or whether,
#     Claude Code reloads content under that path during an already-running
#     session is the host application's own internal behavior — it is not
#     implemented by, or introspectable from, this repository's code.
#   - This environment has no marketplace-installed copy of this plugin
#     under ~/.claude/plugins/marketplaces/ to diff before/after a rewrite
#     (that directory is empty here), and restarting a live session to
#     observe reload behavior directly was not something this task could do.
#   - What would settle it: install this plugin via `/plugin marketplace add
#     <path>` + `/plugin install`, run `install.sh --local --profile <name>`
#     against that installed checkout, then — WITHOUT restarting the session
#     or reinstalling the plugin — invoke one of the rewritten agents and
#     observe whether the new `model:` value actually took effect.
#
# Until this is settled, treat a new session, or a `/plugin` reinstall, as
# REQUIRED after `--profile` runs for the new `model:` values to take
# effect. That is the safer assumption, and the one consistent with the
# class of drift this feature exists to close (PRD Section 10.1).
# ----------------------------------------------------------------------------

VERSION="4.9.0"
REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"
REPO_SLUG="Koroqe/claude-code-sdlc"
PLUGIN_NAME="claude-code-sdlc"
CLAUDE_DIR=""
BACKUP_DIR=""
INIT_PROJECT=false
AUTO_YES=false
LOCAL_MODE=false
SCRIPT_DIR=""
CLONED_TEMP=false
DO_UNINSTALL=false
DRY_RUN=false
RESTORE_DIR=""
TRUST_PROJECT=""
DO_TRUST=false
PROFILE=""
NO_PLUGIN=false

# Populated by load_manifest()
MANIFEST_OWNS=()
MANIFEST_LEGACY=()

# The 16 agent roles --profile rewrites, in FR-8.1's table order. Populated
# by neither load_manifest() nor any manifest file — model_for_role()'s case
# arms are this feature's own source of truth, deliberately independent of
# the memory-layer manifest, which never mentions agents/ at all.
AGENT_ROLES=(architect plan-critic planner security-auditor design-reviewer ba-analyst build-runner code-reviewer debugger doc-updater e2e-runner prd-writer qa-planner refactor-cleaner test-writer verifier)

# Staged temp files for the current --profile preflight pass. Cleared by
# cleanup_profile_tempfiles() on any preflight failure and after a
# successful commit phase.
PROFILE_TEMPFILES=()

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
  --init-project     Scaffold .claude/ template + docs/ in current directory
  --no-plugin        Install only the memory layer; skip the plugin step
  --yes              Skip confirmation prompts
  --local            Use local checkout instead of cloning from GitHub
  --dry-run          Print what would change and exit without touching anything
  --uninstall        Remove the files this harness installed
  --restore <dir>    Restore ~/.claude from one of this installer's backups
  --trust-project [path]
                     Allow the hooks to run this project's CLAUDE.md-declared
                     typecheck/format commands (defaults to the current
                     directory). Untrusted projects only ever get a report.
  --profile <name>   Rewrite agents/*.md model: frontmatter to one of
                     quality | balanced | budget | inherit. Requires --local.
                     See MODEL PROFILES below.
  --help             Show this help message

  --dry-run combines with --uninstall, --restore, and --profile to preview
  them.

  --uninstall removes only what the install receipt and manifest list. Files
  you added yourself — including your own agents in ~/.claude/agents/ — are
  never removed, and a backup is taken before anything is deleted.

MODEL PROFILES (requires --local; see README.md's "Model Profiles" section
for the full quality/balanced/budget/inherit table):
  bash install.sh --local --profile quality    # explicit shipped baseline
  bash install.sh --local --profile balanced   # a middle ground
  bash install.sh --local --profile budget     # cheapest roles with a backstop
  bash install.sh --local --profile inherit    # every agent inherits the host default
  bash install.sh --local --profile budget --dry-run   # preview only

  Rewrites only the model: frontmatter line of all 16 files under agents/ —
  every other line, in every file, is byte-identical before and after.
  Two-phase: all 16 are validated before any of them is written, so a
  malformed file leaves the whole tree unchanged rather than 15-of-16
  rewritten. Writes .sdlc-model-profile at the repo root (gitignored — a
  local artifact, never committed) naming the profile applied, only after
  all 16 files are rewritten. Cannot combine with --uninstall, --restore,
  --init-project, or --trust-project.

  Whether an already-running Claude Code session picks up a rewrite without
  restarting is UNDETERMINED — see this script's own header comment.

WHAT GETS INSTALLED (~/.claude/):
  claude.md        Main workflow instructions (loaded as user memory)
  rules/           5 process rules (loaded as user memory)
  .sdlc-receipt    Record of exactly what this install placed

WHAT DOES NOT COME FROM HERE:
  agents/          16 specialized agents — ship in the plugin
  skills/          8 pipeline skills    — ship in the plugin

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
  .claude/rules/              Architecture, security, design, testing rules
  .claude/rules/design.md     Design declaration template (tokens, motion, preview)
  .claude/scratchpad.md       Session state persistence
  .claude/settings.json       Permissions config (incl. statusLine)
  .claude/statusline.js       Statusline renderer template (copied, not run)
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
  /design-foundation  Generate the project's design declaration
  /sdlc-fast          Override-only: bypass triage, fast-tier edit
  /sdlc-quick         Override-only: bypass triage, quick-tier slice
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

  # `[ -r /dev/tty ]` is NOT sufficient: in a piped or sandboxed shell the node
  # can exist and test readable while the actual open fails with "Device not
  # configured", which leaked a raw bash error and a bare "Aborted." Probe by
  # genuinely opening it, and when that fails say what to do about it.
  # Grouped so the redirection failure itself is suppressed — a bare
  # `exec 3< /dev/tty 2>/dev/null` still leaks bash's own error to stderr.
  if ! { exec 3< /dev/tty; } 2> /dev/null; then
    log_error "No terminal available for confirmation."
    log_info "Re-run non-interactively with --yes:"
    echo "    curl -fsSL https://raw.githubusercontent.com/${REPO_SLUG}/main/install.sh | bash -s -- --yes"
    echo "    # or, from a checkout:  bash install.sh --yes"
    return 1
  fi

  echo -e "${YELLOW}$1 [y/N]${NC}"
  local response=""
  if ! read -r response <&3; then
    exec 3<&-
    log_error "Could not read a response from the terminal. Re-run with --yes."
    return 1
  fi
  exec 3<&-

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
# Trim leading/trailing whitespace only — which does normalise a trailing CR,
# so a CRLF-formatted manifest is read correctly. Everything else, including
# INTERNAL whitespace and internal CR, must reach validate_entry() intact so it
# can be rejected: stripping it here would silently rewrite `rules/a b.md` into
# a valid-looking `rules/ab.md` and quietly act on a path the manifest never
# named.
trim_ws() {
  local s="$1"
  s="${s%"${s##*[![:space:]]}"}"
  s="${s#"${s%%[![:space:]]*}"}"
  printf '%s' "$s"
}

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
  # Depth bound. A `case` glob's `*` matches `/` too, so the structural
  # patterns below would otherwise admit `agents/a/b/c.md`. Reject anything
  # deeper than <dir>/<file> explicitly, so the allowlist enforces the bound
  # its own comment claims rather than leaning on guarded_rm to catch it later.
  case "$entry" in
    */*/*)
      say_untrusted "  rejected entry: " "$entry"
      log_error "$source line $line_no: nested deeper than <directory>/<file>"
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
    entry="$(trim_ws "$line")"
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

# The mirror of guarded_rm for the WRITE path. Removal was given symlink and
# containment checks from the start; writing needs exactly the same defense,
# for the same reason. Without it a pre-existing `~/.claude/rules -> /somewhere`
# symlink silently redirects every installed file out of the tree while the
# installer reports success.
guarded_write_target() {
  local entry="$1"
  local top="${entry%%/*}"

  if [ "$top" != "$entry" ]; then
    if [ -L "$CLAUDE_DIR/$top" ]; then
      say_untrusted "Refusing to install into a symlinked directory: " "$top"
      log_error "$CLAUDE_DIR/$top is a symlink. Move it aside and re-run."
      exit 1
    fi
    if [ -e "$CLAUDE_DIR/$top" ] && [ ! -d "$CLAUDE_DIR/$top" ]; then
      say_untrusted "Refusing to install: expected a directory, found a file: " "$top"
      exit 1
    fi
    mkdir -p -- "$CLAUDE_DIR/$top"
  fi

  if [ -L "$CLAUDE_DIR/$entry" ]; then
    say_untrusted "Refusing to overwrite a symlink: " "$entry"
    log_error "Move it aside and re-run."
    exit 1
  fi

  local parent
  parent="$(cd -- "$(dirname -- "$CLAUDE_DIR/$entry")" 2>/dev/null && pwd -P)" || {
    say_untrusted "Refusing to install: cannot resolve destination for " "$entry"
    exit 1
  }
  case "$parent" in
    "$CLAUDE_DIR"|"$CLAUDE_DIR"/*) ;;
    *)
      say_untrusted "Refusing to install: destination resolves outside $CLAUDE_DIR: " "$entry"
      exit 1 ;;
  esac
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
# Trusted-project registry
#
# The stop:typecheck-format hook runs a command declared by the project's own
# CLAUDE.md. That execution is spawned by the hook engine, so the permission
# system never sees it — which means a freshly cloned hostile repository could
# otherwise run a command of its choosing the moment a response finishes.
#
# So the hook only executes in projects listed here, and this file lives
# OUTSIDE any repository. A marker inside a project would be worthless: a
# hostile repo would simply commit one, and committed consent is not consent.
#
# Only a deliberate adopter action writes this file — this installer, never a
# hook, an agent, or a session.
# ----------------------------------------------------------------------------
trust_project() {
  local target resolved registry

  target="${1:-$(pwd)}"
  resolved="$(cd -- "$target" 2>/dev/null && pwd -P)" || {
    say_untrusted "Not a readable directory: " "$target"
    exit 1
  }

  resolve_claude_dir
  registry="$CLAUDE_DIR/sdlc-trusted-projects"

  if [ -f "$registry" ] && grep -qxF -- "$resolved" "$registry" 2>/dev/null; then
    log_ok "Already trusted: $resolved"
    return 0
  fi

  if [ ! -f "$registry" ]; then
    {
      printf '%s\n' '# Projects whose CLAUDE.md-declared typecheck and format commands the'
      printf '%s\n' '# claude-code-sdlc hooks may execute. One absolute path per line.'
      printf '%s\n' '#'
      printf '%s\n' '# Add a project with: bash install.sh --trust-project [path]'
      printf '%s\n' '# Remove one by deleting its line.'
      printf '%s\n' '#'
      printf '%s\n' '# Only add projects whose code you would run anyway. A listed project can'
      printf '%s\n' '# execute whatever its CLAUDE.md declares.'
    } > "$registry"
  fi

  printf '%s\n' "$resolved" >> "$registry"
  log_ok "Trusted: $resolved"
  log_info "Its declared typecheck/format commands may now run automatically at the end of a response."
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
    if [ -L "$CLAUDE_DIR/$dir" ]; then
      # Not backed up: following it would copy someone else's directory into
      # our backup, and restoring it later would write through the link. Say so
      # rather than skipping in silence.
      log_warn "$CLAUDE_DIR/$dir is a symlink — not backed up, and it will not be written to."
      continue
    fi
    if [ -d "$CLAUDE_DIR/$dir" ]; then
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

  prune_old_backups
}

# Keep the most recent backups and delete the rest.
#
# Every install, uninstall and restore takes a timestamped backup, so a machine
# that has been through a few upgrade cycles accumulates them without bound —
# the original v4.0 audit counted 10 stale `backup-*` directories, and the
# development of this very feature pushed that past 25. Each one is a full copy
# of the memory layer, so the cost is real and the value of the oldest is nil.
#
# Deliberately conservative about what it will delete:
#   - only directories directly under $CLAUDE_DIR,
#   - only those matching this installer's own `backup-YYYYMMDD-HHMMSS` shape,
#     so a directory a user named `backup-notes` is never touched,
#   - never the one just created, which is always the newest.
# Retention is overridable, and setting it to 0 disables pruning entirely.
prune_old_backups() {
  local keep removed d name kept
  keep="${SDLC_KEEP_BACKUPS:-5}"

  case "$keep" in
    ''|*[!0-9]*) return 0 ;;   # non-numeric override: do nothing rather than guess
    0) return 0 ;;             # explicit opt-out
  esac

  # Filter to OUR backups first, then apply the retention count. Counting
  # before filtering was a real bug: a user directory called `backup-notes`
  # matches the `backup-*` glob, consumed a retention slot, and left one fewer
  # real backup than requested. With several such directories it would have
  # pruned every genuine backup while reporting success.
  kept=0
  removed=0
  for d in $(ls -1dt "$CLAUDE_DIR"/backup-* 2>/dev/null); do
    [ -d "$d" ] || continue
    name="$(basename -- "$d")"
    case "$name" in
      backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]|backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9]*)
        : ;;                   # ours
      *) continue ;;           # not ours — never counted, never deleted
    esac
    if [ "$kept" -lt "$keep" ]; then
      kept=$((kept + 1))
      continue
    fi
    rm -rf -- "$d"
    removed=$((removed + 1))
  done

  if [ "$removed" -gt 0 ]; then
    log_info "Pruned $removed old backup(s), keeping the $keep most recent (SDLC_KEEP_BACKUPS to change)."
  fi
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
# Receipt reading
#
# The receipt lives in the user's home directory and drives deletion, so it is
# trusted LESS than the manifest, not more. Its entries are intersected with
# the manifest's `owns` section: a receipt may narrow what gets removed (an
# older version installed fewer files) but must never broaden it.
#
# Without that intersection, path validation alone would not protect the user's
# own agents — `agents/brand-guardian.md` is a perfectly well-formed relative
# path confined to ~/.claude, so a receipt edited to name it would pass every
# structural check and then be deleted.
# ----------------------------------------------------------------------------
manifest_owns_contains() {
  local needle="$1" entry
  for entry in ${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"}; do
    [ "$entry" = "$needle" ] && return 0
  done
  return 1
}

# Populates REMOVAL_SET with (receipt ∩ owns) when a usable receipt exists,
# falling back to the full `owns` list otherwise.
REMOVAL_SET=()
build_removal_set() {
  local receipt="$CLAUDE_DIR/.sdlc-receipt"
  REMOVAL_SET=()

  if [ ! -f "$receipt" ]; then
    log_info "No install receipt found — falling back to the manifest (expected when upgrading from v3.x)."
    REMOVAL_SET=(${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"})
    return 0
  fi

  local line="" entry="" line_no=0 version_seen=false
  local -a candidates=()

  while IFS= read -r line || [ -n "$line" ]; do
    line_no=$((line_no + 1))
    entry="$(trim_ws "$line")"
    [ -z "$entry" ] && continue

    if [ "$version_seen" = false ]; then
      case "$entry" in
        [0-9]*.[0-9]*.[0-9]*) version_seen=true; continue ;;
        *)
          log_warn "Install receipt is malformed (line 1 is not a version) — falling back to the manifest."
          REMOVAL_SET=(${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"})
          return 0 ;;
      esac
    fi

    if ! validate_entry "$entry" "$line_no" "receipt"; then
      log_warn "Install receipt failed validation — falling back to the manifest."
      REMOVAL_SET=(${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"})
      return 0
    fi

    if manifest_owns_contains "$entry"; then
      candidates+=("$entry")
    else
      say_untrusted "  unrecognized receipt entry, skipped: " "$entry"
    fi
  done < "$receipt"

  if [ "$version_seen" = false ]; then
    log_warn "Install receipt is empty — falling back to the manifest."
    REMOVAL_SET=(${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"})
    return 0
  fi

  REMOVAL_SET=(${candidates[@]+"${candidates[@]}"})
}

# ----------------------------------------------------------------------------
# Model profile table (FR-8.1)
#
# One `<profile>:<role>) echo <model> ;;` case arm per profile/role pair,
# plus a single `inherit:*) echo inherit ;;` wildcard standing in for all 16
# inherit rows. This exact shape is a contract, not a style choice: a later
# validator text-parses these arms (never executes this file) and asserts
# they byte-compare against scripts/ci/lib/model-profiles.js's copy of the
# same table (FR-10.3). Reformatting an arm, even harmlessly, would break
# that parse.
# ----------------------------------------------------------------------------
model_for_role() {
  local profile="$1" role="$2"
  case "${profile}:${role}" in
    quality:architect) echo opus ;;
    quality:plan-critic) echo opus ;;
    quality:planner) echo opus ;;
    quality:security-auditor) echo opus ;;
    quality:design-reviewer) echo opus ;;
    quality:ba-analyst) echo sonnet ;;
    quality:build-runner) echo sonnet ;;
    quality:code-reviewer) echo sonnet ;;
    quality:debugger) echo sonnet ;;
    quality:doc-updater) echo sonnet ;;
    quality:e2e-runner) echo sonnet ;;
    quality:prd-writer) echo sonnet ;;
    quality:qa-planner) echo sonnet ;;
    quality:refactor-cleaner) echo sonnet ;;
    quality:test-writer) echo sonnet ;;
    quality:verifier) echo sonnet ;;
    balanced:architect) echo opus ;;
    balanced:plan-critic) echo sonnet ;;
    balanced:planner) echo opus ;;
    balanced:security-auditor) echo opus ;;
    balanced:design-reviewer) echo opus ;;
    balanced:ba-analyst) echo sonnet ;;
    balanced:build-runner) echo haiku ;;
    balanced:code-reviewer) echo sonnet ;;
    balanced:debugger) echo sonnet ;;
    balanced:doc-updater) echo haiku ;;
    balanced:e2e-runner) echo sonnet ;;
    balanced:prd-writer) echo haiku ;;
    balanced:qa-planner) echo sonnet ;;
    balanced:refactor-cleaner) echo sonnet ;;
    balanced:test-writer) echo sonnet ;;
    balanced:verifier) echo sonnet ;;
    budget:architect) echo sonnet ;;
    budget:plan-critic) echo sonnet ;;
    budget:planner) echo sonnet ;;
    budget:security-auditor) echo opus ;;
    budget:design-reviewer) echo opus ;;
    budget:ba-analyst) echo sonnet ;;
    budget:build-runner) echo haiku ;;
    budget:code-reviewer) echo sonnet ;;
    budget:debugger) echo sonnet ;;
    budget:doc-updater) echo haiku ;;
    budget:e2e-runner) echo sonnet ;;
    budget:prd-writer) echo haiku ;;
    budget:qa-planner) echo sonnet ;;
    budget:refactor-cleaner) echo haiku ;;
    budget:test-writer) echo haiku ;;
    budget:verifier) echo sonnet ;;
    inherit:*) echo inherit ;;
    *) return 1 ;;
  esac
}

# ----------------------------------------------------------------------------
# Model profile rewrite (--profile)
#
# Rewrites the `model:` frontmatter line of all 16 agents/*.md files to the
# value model_for_role() assigns that role under the chosen profile.
#
# Two-phase, mirroring install_user_config()'s existing "preflight EVERY
# entry before copying any of them" discipline: every file is preflighted
# into its own same-directory temp file first (mktemp beside its target, the
# write_receipt() precedent, so the later `mv` is a same-filesystem rename
# and therefore atomic); only after all 16 preflights succeed does a second
# pass `mv` any of them into place. A preflight failure removes every temp
# file already staged — never leaking earlier files — and exits non-zero
# with the real tree completely untouched, never N of 16.
# ----------------------------------------------------------------------------
cleanup_profile_tempfiles() {
  local t
  for t in ${PROFILE_TEMPFILES[@]+"${PROFILE_TEMPFILES[@]}"}; do
    rm -f -- "$t"
  done
  PROFILE_TEMPFILES=()
}

# Prints the current `model:` value found within a file's frontmatter
# (strictly between its first and second `---` line), or nothing if absent.
frontmatter_model_of() {
  awk '
    BEGIN { fences = 0 }
    {
      if ($0 == "---") { fences++; next }
      if (fences == 1 && $0 ~ /^model: /) { sub(/^model: /, ""); print; exit }
    }
  ' "$1"
}

# Written only after all 16 rewrites succeed, via the identical
# temp-then-mv pattern write_receipt() already uses for .sdlc-receipt — an
# interrupted or partially-failed rewrite must never leave a receipt
# claiming a profile that was not fully applied.
write_profile_receipt() {
  local tmp
  tmp="$(mktemp "$SCRIPT_DIR/.sdlc-model-profile.XXXXXX")" || {
    log_error "Failed to create temp file for the profile receipt in $SCRIPT_DIR — no receipt was written."
    cleanup_profile_tempfiles
    exit 1
  }
  printf '%s\n' "$PROFILE" > "$tmp"
  mv -- "$tmp" "$SCRIPT_DIR/.sdlc-model-profile"
}

# Refuse to rewrite agents/*.md over uncommitted work.
#
# --profile rewrites the `model:` frontmatter line of all 16 agent files in
# place. On a clean checkout that is trivially reversible with
# `git checkout -- agents/`. Over uncommitted changes it is not: the user's own
# edits to those files are gone, and the two-phase atomic commit below makes it
# MORE certain to complete, not less.
#
# The roadmap already warned about this in prose — "do NOT run install.sh
# --profile against this checkout, it would rewrite the live agents/*.md" —
# which is exactly the kind of instruction this project keeps learning to
# mechanize instead of restate.
#
# Not fatal to an unattended run: --profile is an install-time operation, and
# the remedy (commit or stash) is concrete and one command. Escape sentinel
# matches the convention the blocking hooks already use.
profile_refuse_dirty_tree() {
  [ "${SDLC_ALLOW_DIRTY_PROFILE:-}" = "1" ] && return 0
  command -v git > /dev/null 2>&1 || return 0
  git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree > /dev/null 2>&1 || return 0

  dirty="$(git -C "$SCRIPT_DIR" status --porcelain -- agents 2> /dev/null)"
  [ -z "$dirty" ] && return 0

  log_error "agents/ has uncommitted changes; refusing to rewrite it with --profile."
  echo ""
  echo "  --profile rewrites the model: line of all 16 agent files in place. On a"
  echo "  clean checkout that is reversible with 'git checkout -- agents/'. Over"
  echo "  uncommitted work it is not."
  echo ""
  echo "  Uncommitted under agents/:"
  printf '%s\n' "$dirty" | tr -d '[:cntrl:]' | sed 's/^/    /'
  echo ""
  echo "  Commit or stash first, then rerun. To override deliberately:"
  echo "    SDLC_ALLOW_DIRTY_PROFILE=1 bash install.sh --local --profile ${PROFILE}"
  exit 1
}

do_profile() {
  # Runs for the whole preflight/commit lifecycle below. Guarantees that an
  # unhandled exit (SIGINT, or `set -e` firing on a bare `mktemp` failure)
  # still removes any hidden `.<role>.md.XXXXXX` files already staged under
  # agents/, not just the failure paths that call cleanup_profile_tempfiles()
  # explicitly. Cleared once Phase 2 has committed everything, so a
  # successful run does not re-run cleanup over files it legitimately
  # renamed into place.
  trap cleanup_profile_tempfiles EXIT

  get_source_dir

  # After get_source_dir, because SCRIPT_DIR is what the guard inspects.
  # Skipped for --dry-run, which writes nothing.
  if [ "$DRY_RUN" != true ]; then
    profile_refuse_dirty_tree
  fi

  local role file src target current tmp
  local -a mv_targets=()

  if [ "$DRY_RUN" = true ]; then
    echo ""
    log_info "Dry run — model profile '$PROFILE' in $SCRIPT_DIR/agents:"
    for role in "${AGENT_ROLES[@]}"; do
      src="$SCRIPT_DIR/agents/${role}.md"
      if [ ! -f "$src" ]; then
        say_untrusted "Missing expected agent file: " "agents/${role}.md"
        exit 1
      fi
      target="$(model_for_role "$PROFILE" "$role")" || {
        log_error "No model-profile table entry for ${PROFILE}:${role}"
        exit 1
      }
      current="$(frontmatter_model_of "$src")"
      current="$(printf '%s' "$current" | tr -d '[:cntrl:]')"
      printf '  %-18s current=%-8s target=%s\n' "$role" "${current:-<none>}" "$target"
    done
    echo ""
    log_info "No files were changed."
    return 0
  fi

  # Phase 1 — preflight all 16 into same-directory temp files. Nothing under
  # agents/ is written by this loop.
  for role in "${AGENT_ROLES[@]}"; do
    file="${role}.md"
    src="$SCRIPT_DIR/agents/$file"

    if [ ! -f "$src" ]; then
      log_error "Missing expected agent file: agents/$file"
      cleanup_profile_tempfiles
      exit 1
    fi

    target="$(model_for_role "$PROFILE" "$role")" || {
      log_error "No model-profile table entry for ${PROFILE}:${role}"
      cleanup_profile_tempfiles
      exit 1
    }

    tmp="$(mktemp "$SCRIPT_DIR/agents/.${file}.XXXXXX")" || {
      log_error "Failed to create temp file for agents/$file — no files were modified."
      cleanup_profile_tempfiles
      exit 1
    }

    # Bounded substitution: the frontmatter-fence counter means only a
    # `model: ` line strictly between the first and second `---` is ever
    # touched — never a `model: ` string appearing anywhere in the agent's
    # prompt body by coincidence. A zero- or multiple-match result is a
    # failure, not a silent no-op success, and is named by file.
    if ! awk -v target="model: ${target}" -v fname="agents/${file}" '
      BEGIN { fences = 0; matched = 0 }
      {
        if ($0 == "---") { fences++; print; next }
        if (fences == 1 && $0 ~ /^model: /) { print target; matched++; next }
        print
      }
      END {
        if (matched != 1) {
          print "ERROR: " fname ": expected exactly one model: line in frontmatter, found " matched > "/dev/stderr"
          exit 1
        }
      }
    ' "$src" > "$tmp"; then
      rm -f -- "$tmp"
      log_error "Preflight failed for agents/$file — no files were modified."
      cleanup_profile_tempfiles
      exit 1
    fi

    PROFILE_TEMPFILES+=("$tmp")
    mv_targets+=("$src")
  done

  # Phase 2 — every one of the 16 preflighted cleanly; commit them all. Each
  # `mv` is a same-filesystem rename (the temp file lives beside its
  # target), so this phase cannot itself degrade into a partial, non-atomic
  # copy.
  local i
  for i in "${!mv_targets[@]}"; do
    mv -- "${PROFILE_TEMPFILES[$i]}" "${mv_targets[$i]}"
  done
  PROFILE_TEMPFILES=()

  # Phase 2 fully committed — nothing legitimately staged remains, so clear
  # the trap before it can fire cleanup over files this run intentionally
  # kept (there are none, but a later failure in write_profile_receipt must
  # not be misread as a Phase 1/2 leak).
  trap - EXIT

  write_profile_receipt

  log_ok "Model profile '$PROFILE' applied to ${#mv_targets[@]} agent file(s) in $SCRIPT_DIR/agents"
  log_info "Receipt written to $SCRIPT_DIR/.sdlc-model-profile"
}

# ----------------------------------------------------------------------------
# Uninstall / dry-run / restore
# ----------------------------------------------------------------------------
do_uninstall() {
  resolve_claude_dir
  get_source_dir
  load_manifest
  build_removal_set

  local entry present=0
  local -a targets=()
  for entry in ${REMOVAL_SET[@]+"${REMOVAL_SET[@]}"} ${MANIFEST_LEGACY[@]+"${MANIFEST_LEGACY[@]}"}; do
    if [ -e "$CLAUDE_DIR/$entry" ] || [ -L "$CLAUDE_DIR/$entry" ]; then
      targets+=("$entry")
      present=$((present + 1))
    fi
  done

  if [ "$DRY_RUN" = true ]; then
    echo ""
    log_info "Dry run — the following $present file(s) WOULD be removed from $CLAUDE_DIR:"
    for entry in ${targets[@]+"${targets[@]}"}; do
      say_untrusted "  " "$entry"
    done
    [ -f "$CLAUDE_DIR/.sdlc-receipt" ] && echo "  .sdlc-receipt"
    echo ""
    log_info "No files were changed."
    cleanup_source_dir
    return 0
  fi

  if [ "$present" -eq 0 ]; then
    log_info "Nothing to uninstall — no harness files found in $CLAUDE_DIR."
    cleanup_source_dir
    return 0
  fi

  if ! confirm "Remove $present harness file(s) from $CLAUDE_DIR?"; then
    log_info "Aborted."
    cleanup_source_dir
    return 0
  fi

  sweep_stale_staging
  backup_existing

  local removed=0
  for entry in ${targets[@]+"${targets[@]}"}; do
    guarded_rm "$entry"
    say_untrusted "  removed: " "$entry"
    removed=$((removed + 1))
  done

  # The receipt goes last: if the run is interrupted, a surviving receipt still
  # describes what was installed.
  rm -f -- "$CLAUDE_DIR/.sdlc-receipt"
  prune_empty_dirs

  echo ""
  log_ok "Removed $removed file(s). Your own files in $CLAUDE_DIR were not touched."
  [ -n "$BACKUP_DIR" ] && log_info "Backup of the previous state: $BACKUP_DIR"
  cleanup_source_dir
}

# `--restore` is the sharpest surface in this script: it reads a directory the
# caller names and copies it over ~/.claude. Everything below exists to stop it
# becoming a way to write arbitrary content — a hook config, a shell rc, a
# symlink redirecting later writes — into the user's Claude Code directory.
do_restore() {
  resolve_claude_dir

  local resolved
  resolved="$(cd -- "$RESTORE_DIR" 2>/dev/null && pwd -P)" || {
    say_untrusted "Not a readable directory: " "$RESTORE_DIR"
    exit 1
  }

  if [ -L "$RESTORE_DIR" ]; then
    log_error "Refusing to restore from a symlink."
    exit 1
  fi

  # It must be one of OUR backups: directly inside ~/.claude, named
  # backup-YYYYMMDD-HHMMSS (optionally with a collision suffix).
  local parent base
  parent="$(dirname -- "$resolved")"
  base="$(basename -- "$resolved")"
  if [ "$parent" != "$CLAUDE_DIR" ]; then
    log_error "Refusing to restore: the directory is not inside $CLAUDE_DIR."
    exit 1
  fi
  case "$base" in
    backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]*) ;;
    *)
      say_untrusted "Refusing to restore: not a recognised backup name: " "$base"
      exit 1 ;;
  esac
  # The pattern above pins only the first 22 characters; the trailing `*` would
  # otherwise admit raw ESC bytes in a directory name, which then reach `echo -e`
  # via the confirmation prompt and the success line and can forge output around
  # them. Constrain the whole name to a safe charset.
  case "$base" in
    *[!A-Za-z0-9.-]*)
      say_untrusted "Refusing to restore: backup name contains unexpected characters: " "$base"
      exit 1 ;;
  esac

  # A symlink anywhere inside the backup could redirect a copy out of the tree.
  if [ -n "$(find "$resolved" -type l 2>/dev/null | head -n 1)" ]; then
    log_error "Refusing to restore: the backup contains symlinks."
    exit 1
  fi

  # Copy only the structure a backup is allowed to contain. Anything else is
  # reported and skipped, so restore can never introduce a file name the backup
  # mechanism does not itself create.
  local allowed="claude.md agents commands rules .sdlc-receipt"
  local item name ok
  # Include dotfiles in the scan. The copy loop below is allowlist-driven so a
  # planted `.bashrc` or `.env` could never be written anyway, but reporting is
  # the point: a tampered backup's hidden files should be visible, not ride
  # along unmentioned.
  for item in "$resolved"/* "$resolved"/.[!.]* "$resolved"/..?*; do
    [ -e "$item" ] || continue
    name="$(basename -- "$item")"
    ok=false
    for a in $allowed; do [ "$name" = "$a" ] && ok=true; done
    if [ "$ok" = false ]; then
      say_untrusted "  skipped unexpected entry in backup: " "$name"
    fi
  done

  if [ "$DRY_RUN" = true ]; then
    echo ""
    log_info "Dry run — would restore from $resolved into $CLAUDE_DIR:"
    for a in $allowed; do
      [ -e "$resolved/$a" ] && echo "  $a"
    done
    echo ""
    log_info "No files were changed."
    return 0
  fi

  if ! confirm "Restore $CLAUDE_DIR from $base?"; then
    log_info "Aborted."
    return 0
  fi

  # Restore is itself reversible: snapshot the current state first.
  sweep_stale_staging
  backup_existing

  for a in $allowed; do
    [ -e "$resolved/$a" ] || continue
    rm -rf -- "${CLAUDE_DIR:?}/$a"
    cp -R -P -- "$resolved/$a" "$CLAUDE_DIR/$a"
    log_ok "restored $a"
  done

  # If the backup predates receipts, the restored tree has none — leaving a
  # newer receipt behind would misdescribe what is installed and would drive
  # the next uninstall.
  if [ ! -e "$resolved/.sdlc-receipt" ]; then
    rm -f -- "$CLAUDE_DIR/.sdlc-receipt"
  fi

  echo ""
  log_ok "Restored $CLAUDE_DIR from $base"
  [ -n "$BACKUP_DIR" ] && log_info "The pre-restore state was saved to $BACKUP_DIR"
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

  # Copy exactly what the manifest declares — never a glob. Driving the copy
  # from `owns` is what keeps the installed set and the receipt in lockstep: a
  # glob that drifted from the manifest would either orphan files the
  # uninstaller can never remove, or write a receipt claiming files that were
  # never placed.
  local entry src

  # Preflight EVERY entry — source present and destination safe — before
  # copying any of them. Checking destinations inline in the copy loop would
  # mean a symlink on the third entry aborts with the first two already
  # written; this way a rejected entry leaves nothing installed at all.
  for entry in ${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"}; do
    if [ ! -f "$SCRIPT_DIR/src/$entry" ]; then
      say_untrusted "Manifest declares a file the repo does not provide: " "$entry"
      log_error "Refusing to start an install that cannot complete. Nothing was changed."
      exit 1
    fi
    guarded_write_target "$entry"
  done

  for entry in ${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"}; do
    src="$SCRIPT_DIR/src/$entry"
    cp -- "$src" "$CLAUDE_DIR/$entry"
    log_ok "$entry"
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
# Copy a template into the project, refusing to follow a symlinked destination.
# `cp` writes THROUGH a symlink to whatever it points at, so a hostile repo
# committing `.claude/settings.json -> ~/.ssh/authorized_keys` would have this
# scaffold clobber that target the moment someone ran --init-project inside the
# clone. Refuse and keep going: a skipped template is a visible inconvenience,
# an overwritten file outside the project is not recoverable.
# Pure POSIX test, no node/jq — install.sh's zone of the three-Node-zones rule.
scaffold_cp() {
  scaffold_cp_dst="$2"
  if [ -L "$scaffold_cp_dst" ]; then
    log_warn "$scaffold_cp_dst is a symlink — refusing to write through it (skipped)"
    return 0
  fi
  cp -- "$1" "$scaffold_cp_dst"
  log_ok "$3"
}

# ----------------------------------------------------------------------------
# Plugin layer (the second half of the hybrid split)
#
# The memory layer above and the plugin are two different channels because
# plugins have NO user-memory component type — the manifest schema has no
# `instructions`, `memory`, or `context` field, confirmed against the plugin
# reference. That is a property of Claude Code, not a choice this project made,
# so it cannot be collapsed away. What CAN be collapsed is the number of things
# a person has to run: `claude plugin ...` are ordinary CLI subcommands, so
# this script drives them and the whole install becomes one command.
#
# Strictly fail-open, and deliberately so: this script's contract is that it
# depends on nothing but a POSIX shell and git. If `claude` is not on PATH the
# memory layer is still fully installed and we print the two commands to finish
# by hand, rather than aborting a run that has already succeeded at its own job.
#
# `claude plugin marketplace add` exits 0 even when it fails (observed on
# Claude Code 2.1.9, re-adding an existing marketplace), so success is decided
# by re-reading the marketplace list rather than by exit code.
# ----------------------------------------------------------------------------
PLUGIN_MARKETPLACE="claude-code-sdlc"
PLUGIN_REF="claude-code-sdlc@claude-code-sdlc"

install_plugin() {
  if [ "$NO_PLUGIN" = true ]; then
    return 0
  fi

  echo ""
  log_info "Installing the plugin layer (agents, skills, hooks)"

  if ! command -v claude > /dev/null 2>&1; then
    log_warn "\`claude\` is not on PATH — the memory layer is installed, the plugin is not."
    log_info "Finish from any shell once Claude Code is installed:"
    echo "    claude plugin marketplace add ${REPO_SLUG}"
    echo "    claude plugin install ${PLUGIN_REF}"
    return 0
  fi

  # Source: a local checkout when --local, otherwise the public repo.
  plugin_source="$REPO_SLUG"
  if [ "$LOCAL_MODE" = true ] && [ -n "$SCRIPT_DIR" ]; then
    plugin_source="$SCRIPT_DIR"
  fi

  if claude plugin marketplace list 2>/dev/null | grep -q "$PLUGIN_MARKETPLACE"; then
    claude plugin marketplace update "$PLUGIN_MARKETPLACE" > /dev/null 2>&1 || true
    log_ok "marketplace ${PLUGIN_MARKETPLACE} (already added — updated)"
  else
    claude plugin marketplace add "$plugin_source" > /dev/null 2>&1 || true
    if claude plugin marketplace list 2>/dev/null | grep -q "$PLUGIN_MARKETPLACE"; then
      log_ok "marketplace ${PLUGIN_MARKETPLACE} added"
    else
      log_warn "could not add the marketplace automatically. Run:"
      echo "    claude plugin marketplace add ${plugin_source}"
      echo "    claude plugin install ${PLUGIN_REF}"
      return 0
    fi
  fi

  claude plugin install "$PLUGIN_REF" > /dev/null 2>&1 || true
  # A plugin installs disabled; enabling is what makes the agents resolve.
  claude plugin enable "$PLUGIN_REF" > /dev/null 2>&1 || true

  if claude plugin list 2>/dev/null | grep -q "$PLUGIN_MARKETPLACE"; then
    log_ok "plugin ${PLUGIN_REF} installed (scope: user)"
  else
    log_warn "the plugin did not install. Run it directly to see the reason:"
    echo "    claude plugin install ${PLUGIN_REF}"
    return 0
  fi

  # Re-measured on Claude Code 2.1.237 (docs/findings/remeasurement-2.1.237.md
  # §1): a user-scope enable DOES load the plugin — a fresh directory with no
  # project-scope install resolved all 16 agents and fired hooks under
  # user-scope enablement alone. The enable call below is the normal path.
  # Project-scope install remains available purely as optional version pinning,
  # never as an activation step.
  claude plugin enable "$PLUGIN_REF" > /dev/null 2>&1 || true

  echo ""
  log_info "Optional — pin a specific project to this plugin version:"
  echo "    cd your-project && claude plugin install ${PLUGIN_REF} --scope project"
  log_info "That writes .claude/settings.json, merging with anything already there."
}

# Turn the plugin on for the project being scaffolded. Uses the CLI rather than
# editing JSON by hand: this script must not depend on node or jq, and the CLI
# merges into an existing .claude/settings.json instead of clobbering it.
enable_plugin_for_project() {
  if [ "$NO_PLUGIN" = true ] || ! command -v claude > /dev/null 2>&1; then
    return 0
  fi
  claude plugin install "$PLUGIN_REF" --scope project > /dev/null 2>&1 || true
  if [ -f ".claude/settings.json" ] && grep -q 'enabledPlugins' ".claude/settings.json"; then
    log_ok "plugin enabled for this project (.claude/settings.json)"
  else
    log_warn "could not enable the plugin for this project. Run:"
    echo "    claude plugin install ${PLUGIN_REF} --scope project"
  fi
}

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

  scaffold_cp "$SCRIPT_DIR/templates/CLAUDE.md" ".claude/CLAUDE.md" ".claude/CLAUDE.md (template — fill in your project details)"

  scaffold_cp "$SCRIPT_DIR/templates/rules/architecture.md" ".claude/rules/architecture.md" ".claude/rules/architecture.md (template)"

  scaffold_cp "$SCRIPT_DIR/templates/rules/security.md" ".claude/rules/security.md" ".claude/rules/security.md (template)"

  scaffold_cp "$SCRIPT_DIR/templates/rules/design.md" ".claude/rules/design.md" ".claude/rules/design.md (template)"

  scaffold_cp "$SCRIPT_DIR/templates/rules/testing.md" ".claude/rules/testing.md" ".claude/rules/testing.md (template)"

  scaffold_cp "$SCRIPT_DIR/templates/scratchpad.md" ".claude/scratchpad.md" ".claude/scratchpad.md"

  scaffold_cp "$SCRIPT_DIR/templates/settings.json" ".claude/settings.json" ".claude/settings.json"

  # FR-13.1: a `cp`, never an execution. `.claude/statusline.js` is later
  # invoked directly by Claude Code's own statusLine mechanism (the command
  # templates/settings.json just installed above), never by this installer -
  # this script itself still never invokes `node` or `jq`.
  scaffold_cp "$SCRIPT_DIR/templates/statusline.js" ".claude/statusline.js" ".claude/statusline.js (statusline renderer template)"

  scaffold_cp "$SCRIPT_DIR/templates/CHANGELOG.md" "CHANGELOG.md" "CHANGELOG.md"

  # FR-1.1: skip-if-exists, identical in shape to the CHANGELOG.md/scratchpad.md
  # provisioning above — never overwrites a project's own accumulated instincts.
  if [ -f ".claude/instincts.md" ]; then
    log_ok ".claude/instincts.md (already exists — skipped)"
  else
    scaffold_cp "$SCRIPT_DIR/templates/instincts.md" ".claude/instincts.md" ".claude/instincts.md"
  fi

  if [ -L "docs/PRD.md" ]; then
    log_warn "docs/PRD.md is a symlink — refusing to write through it (skipped)"
  else
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
  fi

  touch docs/qa/.gitkeep
  log_ok "docs/qa/"

  touch docs/use-cases/.gitkeep
  log_ok "docs/use-cases/"

  # Ignore coverage for the hooks' transient state directory. Idempotent: adds
  # the line only when absent, and never overwrites an existing .gitignore.
  if [ ! -f ".gitignore" ]; then
    cp -- "$SCRIPT_DIR/templates/.gitignore" ".gitignore"
    log_ok ".gitignore"
  elif ! grep -q '\.claude/tmp' ".gitignore"; then
    printf '\n# Transient state written by the claude-code-sdlc hooks.\n.claude/tmp/\n' >> ".gitignore"
    log_ok ".gitignore (appended .claude/tmp/)"
  else
    log_ok ".gitignore (already ignores .claude/tmp/)"
  fi

  echo ""
  log_ok "Project template scaffolded"
  echo ""
  echo "  Next steps:"
  echo "    1. Fill in TODO placeholders in .claude/CLAUDE.md"
  echo "    2. Fill in .claude/rules/architecture.md"
  echo "    3. Fill in .claude/rules/security.md"
  echo "    4. Fill in .claude/rules/testing.md"
  echo "    5. Fill in .claude/rules/design.md (or run /design-foundation to generate it)"
  echo "    6. Start a Claude Code session and describe a feature"
  echo ""
}

print_footer() {
  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}  Installation complete!${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo ""
  echo "  Both layers are installed: the memory layer here, and the plugin"
  echo "  (agents, skills, hooks) via the claude plugin CLI."
  echo ""
  echo "  Once activated (see below), describe a feature and the pipeline will:"
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
  echo "    /design-foundation  Generate the project's design declaration"
  echo "    /sdlc-fast          Override-only: bypass triage, fast-tier edit"
  echo "    /sdlc-quick         Override-only: bypass triage, quick-tier slice"
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

  print_next_step
}

# Deliberately the last output of a successful run. Re-measured on Claude
# Code 2.1.237 (docs/findings/remeasurement-2.1.237.md §1): user-scope
# enablement alone loads all 16 agents in a fresh directory, so no
# per-project step remains. This block tells the user how to VERIFY the
# install, and names the project-scope install as optional version pinning.
print_next_step() {
  if [ "$NO_PLUGIN" = true ]; then
    return 0
  fi

  echo ""

  if [ "$INIT_PROJECT" = true ]; then
    echo -e "  ${GREEN}Project scaffolded.${NC} The plugin loads here — and in every"
    echo "  other project — from the user-scope install alone."
  else
    echo "  The plugin is installed and enabled at user scope. It loads in"
    echo "  every project — there is no per-project activation step."
  fi

  echo ""
  echo "  Verify it: open a NEW session and run:"
  echo ""
  echo -e "    ${BOLD}claude plugin list${NC}"
  echo ""
  echo "  Expect the ${PLUGIN_NAME} entry to show Scope: user and ✔ enabled."
  echo ""
  echo "  Optional — pin a specific project to this plugin version:"
  echo ""
  echo -e "    ${BOLD}cd your-project && claude plugin install ${PLUGIN_REF} --scope project${NC}"
  echo ""
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
      --no-plugin) NO_PLUGIN=true; shift ;;
      --yes) AUTO_YES=true; shift ;;
      --local) LOCAL_MODE=true; shift ;;
      --uninstall) DO_UNINSTALL=true; shift ;;
      --dry-run) DRY_RUN=true; shift ;;
      --trust-project)
        DO_TRUST=true
        # Optional argument: an option-looking next token means "use cwd".
        if [ $# -ge 2 ] && [ -n "${2:-}" ]; then
          case "$2" in
            -*) shift ;;
            *) TRUST_PROJECT="$2"; shift 2 ;;
          esac
        else
          shift
        fi
        ;;
      --restore)
        # A missing argument must not silently swallow the next flag as a path.
        if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
          log_error "--restore requires a backup directory argument."
          exit 1
        fi
        case "$2" in
          -*)
            say_untrusted "--restore requires a directory, got an option: " "$2"
            exit 1 ;;
        esac
        RESTORE_DIR="$2"
        shift 2 ;;
      --profile)
        if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
          log_error "--profile requires a value: quality, balanced, budget, or inherit."
          exit 1
        fi
        case "$2" in
          quality|balanced|budget|inherit) PROFILE="$2" ;;
          *)
            say_untrusted "--profile requires quality, balanced, budget, or inherit, got: " "$2"
            exit 1 ;;
        esac
        shift 2 ;;
      --help|-h) print_help; exit 0 ;;
      *)
        say_untrusted "Unknown option: " "$1"
        print_help
        exit 1 ;;
    esac
  done

  # Mutually exclusive modes — refuse rather than guess which one was meant.
  if [ "$DO_UNINSTALL" = true ] && [ -n "$RESTORE_DIR" ]; then
    log_error "--uninstall and --restore cannot be combined."
    exit 1
  fi
  if [ -n "$RESTORE_DIR" ] && [ "$INIT_PROJECT" = true ]; then
    log_error "--restore and --init-project cannot be combined."
    exit 1
  fi
  if [ "$DO_UNINSTALL" = true ] && [ "$INIT_PROJECT" = true ]; then
    log_error "--uninstall and --init-project cannot be combined."
    exit 1
  fi

  if [ -n "$PROFILE" ]; then
    if [ "$LOCAL_MODE" != true ]; then
      log_error "--profile requires --local: the rewrite targets agents/*.md inside the plugin-source checkout that /plugin marketplace add will later point at. A non-local run's source directory is a temporary clone cleanup_source_dir deletes before the process exits, so a rewrite there would be silently discarded."
      exit 1
    fi
    if [ "$DO_UNINSTALL" = true ] || [ -n "$RESTORE_DIR" ] || [ "$INIT_PROJECT" = true ] || [ "$DO_TRUST" = true ]; then
      log_error "--profile cannot be combined with --uninstall, --restore, --init-project, or --trust-project."
      exit 1
    fi
  fi

  if [ -n "$PROFILE" ]; then
    do_profile
    return 0
  fi

  if [ "$DO_TRUST" = true ]; then
    trust_project "$TRUST_PROJECT"
    return 0
  fi

  if [ -n "$RESTORE_DIR" ]; then
    do_restore
    return 0
  fi

  if [ "$DO_UNINSTALL" = true ]; then
    do_uninstall
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    resolve_claude_dir
    get_source_dir
    load_manifest
    echo ""
    log_info "Dry run — the following would be installed into $CLAUDE_DIR:"
    local entry
    for entry in ${MANIFEST_OWNS[@]+"${MANIFEST_OWNS[@]}"}; do
      say_untrusted "  install: " "$entry"
    done
    local legacy_present=0
    for entry in ${MANIFEST_LEGACY[@]+"${MANIFEST_LEGACY[@]}"}; do
      if [ -e "$CLAUDE_DIR/$entry" ] || [ -L "$CLAUDE_DIR/$entry" ]; then
        say_untrusted "  remove (retired v3.x): " "$entry"
        legacy_present=$((legacy_present + 1))
      fi
    done
    echo ""
    log_info "$legacy_present retired file(s) present. No files were changed."
    cleanup_source_dir
    return 0
  fi

  install_user_config
  install_plugin

  if [ "$INIT_PROJECT" = true ]; then
    scaffold_project
    enable_plugin_for_project
  fi

  cleanup_source_dir
  print_footer
}

main "$@"
