#!/usr/bin/env bash
# SDLC pipeline SessionStart hook — auto-injects orientation context for the
# agent AND surfaces a brief visible line to the operator in the CLI.
#
# Wired via ~/.claude/settings.json:
#   hooks.SessionStart[*].hooks[*].command = ~/.claude/hooks/sdlc-onboarding.sh
#
# Output is a JSON envelope per https://code.claude.com/docs/en/hooks:
#   - `systemMessage` -> visible to the OPERATOR in the CLI (short summary)
#   - `hookSpecificOutput.additionalContext` -> agent-only context, wrapped
#     in a `<hook source="sdlc-onboarding" ...>` tag for visual parity with
#     the `<channel source="...">` tags Telegram channel callbacks use
#
# Plain-stdout fallback (when jq is unavailable) preserves the
# additionalContext but drops the operator-visible systemMessage.
#
# Exit code: 0 always (informational; never blocks session boot).

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

# Build the full orientation content into a temp buffer. Wrap in `<hook
# source="sdlc-onboarding" ...>` tag (visual parity with `<channel ...>`).
buf="$(mktemp -t sdlc-onboarding.XXXXXX)"
trap 'rm -f "$buf"' EXIT

{
  printf '<hook source="sdlc-onboarding" event="%s" ts="%s" cwd="%s"%s>\n' \
    "$event_name" "$ts" "$cwd" \
    "$([ -n "$session_id" ] && printf ' session_id="%s"' "$session_id")"

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

  if [ -d "$rules_dir" ]; then
    echo "## Loaded pipeline rules (~/.claude/rules/)"
    for f in "$rules_dir"/*.md; do
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

  if [ -f "$project_claude/scratchpad.md" ]; then
    echo "## Scratchpad summary (./.claude/scratchpad.md)"
    for header in '^## Feature:' '^## Branch:' '^## Status:' '^## Blockers'; do
      grep -A 5 "$header" "$project_claude/scratchpad.md" 2>/dev/null \
        | head -6 \
        | sed 's/^/  /'
      echo ""
    done
  fi

  if [ -f "$project_claude/changelog.md" ]; then
    echo "## Recent session bullets (./.claude/changelog.md tail)"
    tail -n +2 "$project_claude/changelog.md" 2>/dev/null \
      | head -30 \
      | sed 's/^/  /'
    echo ""
  fi

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

  cat <<'FOOTER'
## Push-back is not failure

If the operator's first prompt contradicts an established pipeline
constraint (asks for code without /bootstrap-feature, asks to commit
on main, asks for a hack labelled as a real fix), surface it under
`### Inbound validation` and refuse to silently execute. Per
`~/.claude/rules/cognitive-self-check.md` Protocol 3, push-back is
the agent doing its job correctly.
FOOTER

  echo '</hook>'
} > "$buf"

# Operator-visible one-liner (shows in CLI on session start).
project_label="$(basename "$cwd")"
sys_msg="🪝 SDLC SessionStart hook — event=${event_name} project=${project_label}"

# Emit JSON: user sees systemMessage, agent gets full additionalContext.
# jq -n --rawfile loads $buf verbatim, JSON-escaping it correctly.
if command -v jq >/dev/null 2>&1; then
  jq -n \
    --rawfile ctx "$buf" \
    --arg sm "$sys_msg" \
    '{
      systemMessage: $sm,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $ctx
      }
    }'
else
  # No jq — fall back to plain text. Operator sees nothing extra; agent
  # still gets the orientation context.
  cat "$buf"
fi

exit 0
