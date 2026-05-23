#!/usr/bin/env bash
# SDLC pipeline SessionStart hook — auto-injects orientation context into
# Claude Code's first model request. Replaces the prior /onboarding slash
# command (which required user invocation).
#
# Wired via ~/.claude/settings.json:
#   hooks.SessionStart[*].hooks[*].command = ~/.claude/hooks/sdlc-onboarding.sh
#
# Per https://code.claude.com/docs/en/hooks the stdout of a SessionStart
# hook is appended as additionalContext to the first model request when
# emitted as plain text (no JSON wrapping required). This script outputs
# plain text only.
#
# Exit codes: 0 always (the hook is informational, never blocks).

# Do NOT set -e — a failed substat or missing file must not break the
# session boot. Silent degradation is the contract.

# Read the JSON envelope CC sends on stdin (hook_event_name + session_id +
# transcript_path + cwd). Best-effort — empty/missing fields just become
# blank attributes on the wrapper tag below.
hook_payload="$(cat 2>/dev/null || true)"
event_name=""
session_id=""
if command -v jq >/dev/null 2>&1 && [ -n "$hook_payload" ]; then
  event_name="$(printf '%s' "$hook_payload" | jq -r '.hook_event_name // .source // empty' 2>/dev/null || true)"
  session_id="$(printf '%s' "$hook_payload" | jq -r '.session_id // empty' 2>/dev/null || true)"
fi
[ -z "$event_name" ] && event_name="session-start"

cwd="$(pwd)"
rules_dir="$HOME/.claude/rules"
project_claude="$cwd/.claude"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '?')"

# Wrapper tag — visually parallel to the `<channel source="..." ...>` tag
# Telegram channel callbacks use. Lets the agent grep `^<hook` for hook
# invocations the same way `^<channel` works for inbound TG events.
printf '<hook source="sdlc-onboarding" event="%s" ts="%s" cwd="%s"%s>\n' \
  "$event_name" "$ts" "$cwd" \
  "$([ -n "$session_id" ] && printf ' session_id="%s"' "$session_id")"

# Header — names the three load-bearing protocols verbatim so the agent
# can't paraphrase them away on first turn.
cat <<'HEADER'
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

HEADER

# List global pipeline rules + mtimes so the agent + operator can spot
# drift since last session.
if [ -d "$rules_dir" ]; then
  echo "## Loaded pipeline rules (~/.claude/rules/)"
  for f in "$rules_dir"/*.md; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    bytes=$(stat -f %z "$f" 2>/dev/null || stat -c %s "$f" 2>/dev/null || echo '?')
    # macOS stat %Sm vs GNU stat %y
    mtime=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null \
            || stat -c "%y" "$f" 2>/dev/null | cut -d' ' -f1 \
            || echo '?')
    echo "- $name ($bytes bytes, $mtime)"
  done
  echo ""
fi

# Per-project rules if the cwd has a .claude/rules/ tree.
if [ -d "$project_claude/rules" ]; then
  echo "## Project rules (./.claude/rules/)"
  for f in "$project_claude/rules"/*.md; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    bytes=$(stat -f %z "$f" 2>/dev/null || stat -c %s "$f" 2>/dev/null || echo '?')
    mtime=$(stat -f "%Sm" -t "%Y-%m-%d" "$f" 2>/dev/null \
            || stat -c "%y" "$f" 2>/dev/null | cut -d' ' -f1 \
            || echo '?')
    echo "- $name ($bytes bytes, $mtime)"
  done
  echo ""
fi

# Scratchpad summary (current feature + branch + status).
if [ -f "$project_claude/scratchpad.md" ]; then
  echo "## Scratchpad summary (./.claude/scratchpad.md)"
  # Pull just the structural sections operators care about. grep with -A
  # for context; cap each section to avoid blowing the hook output.
  for header in '^## Feature:' '^## Branch:' '^## Status:' '^## Blockers'; do
    grep -A 5 "$header" "$project_claude/scratchpad.md" 2>/dev/null \
      | head -6 \
      | sed 's/^/  /'
    echo ""
  done
fi

# Recent session changelog bullets (newest 5) per
# ~/.claude/rules/session-changelog.md convention.
if [ -f "$project_claude/changelog.md" ]; then
  echo "## Recent session bullets (./.claude/changelog.md tail)"
  # Skip the `# Session Changelog` header, take the next 30 lines which
  # comfortably covers the most recent dated section.
  tail -n +2 "$project_claude/changelog.md" 2>/dev/null \
    | head -30 \
    | sed 's/^/  /'
  echo ""
fi

# Git state — branch + recent commits + working tree.
if git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; then
  echo "## Git"
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null)
  [ -n "$branch" ] && echo "- branch: $branch"
  echo "- recent commits:"
  git -C "$cwd" log --oneline -3 2>/dev/null | sed 's/^/    /'
  dirty=$(git -C "$cwd" status --short 2>/dev/null | head -10)
  if [ -n "$dirty" ]; then
    echo "- working tree (truncated to 10 entries):"
    echo "$dirty" | sed 's/^/    /'
  else
    echo "- working tree: clean"
  fi
  echo ""
fi

# Push-back note — keeps the agent honest about Protocol 3 from turn 1.
cat <<'FOOTER'
## Push-back is not failure

If the operator's first prompt contradicts an established pipeline
constraint (asks for code without /bootstrap-feature, asks to commit
on main, asks for a hack labelled as a real fix), surface it under
`### Inbound validation` and refuse to silently execute. Per
`~/.claude/rules/cognitive-self-check.md` Protocol 3, push-back is
the agent doing its job correctly.
FOOTER

echo "</hook>"

exit 0
