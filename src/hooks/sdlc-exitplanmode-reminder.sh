#!/usr/bin/env bash
# SDLC pipeline PostToolUse hook — fires AFTER an ExitPlanMode tool call and
# reminds the agent (and the operator) to persist the plan body to
# <project>/.claude/plan.md per the CLAUDE.md mandate. The persistence rule
# (~/.claude/CLAUDE.md § Plan-Mode Persistence) requires:
#
#   1. Resolve project root via `git rev-parse --show-toplevel` (fallback cwd)
#   2. mkdir -p <root>/.claude
#   3. Write <root>/.claude/plan.md with full plan body BEFORE ExitPlanMode
#   4. Only then call ExitPlanMode
#
# A sloppy agent that calls ExitPlanMode without the prior Write silently
# breaks the /bootstrap-feature pipeline (which Step 0-aborts when plan.md
# is missing or empty). This hook is the soft enforcement layer that
# surfaces the omission immediately rather than later in bootstrap.
#
# Wired via ~/.claude/settings.json:
#   hooks.PostToolUse[*].matcher = "ExitPlanMode"
#   hooks.PostToolUse[*].hooks[*].command =
#     ~/.claude/hooks/sdlc-exitplanmode-reminder.sh
#
# Output is a JSON envelope per https://code.claude.com/docs/en/hooks:
#   - `systemMessage` -> operator-visible CLI bubble (only when plan.md is
#     missing / empty / stale; silent on the happy path so we don't spam)
#   - `hookSpecificOutput.additionalContext` -> agent-only reminder, wrapped
#     in a <hook source="sdlc-exitplanmode-reminder" ...> tag for visual
#     parity with other SDLC hooks
#
# Exit code: 0 always (informational; never blocks downstream — the matcher
# is PostToolUse so ExitPlanMode has already completed by the time we run).

set -u

# Read the JSON envelope Claude Code sends on stdin. Best-effort.
hook_payload="$(cat 2>/dev/null || true)"
session_id=""
cwd=""
if command -v jq >/dev/null 2>&1 && [ -n "$hook_payload" ]; then
  session_id="$(printf '%s' "$hook_payload" | jq -r '.session_id // empty' 2>/dev/null || true)"
  cwd="$(printf '%s' "$hook_payload" | jq -r '.cwd // empty' 2>/dev/null || true)"
fi
[ -z "$cwd" ] && cwd="$(pwd 2>/dev/null || echo .)"

# Resolve project root the same way the CLAUDE.md rule mandates the agent do
# it: `git rev-parse --show-toplevel` from cwd, falling back to cwd itself.
project_root="$cwd"
if command -v git >/dev/null 2>&1; then
  resolved="$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$resolved" ] && project_root="$resolved"
fi

plan_file="$project_root/.claude/plan.md"

# Three states drive the message:
#   1. plan.md missing entirely  -> loud reminder
#   2. plan.md exists but empty   -> loud reminder
#   3. plan.md exists, non-empty, mtime <= 300s ago  -> silent OK (happy path)
#   4. plan.md exists, non-empty, mtime > 300s ago   -> soft reminder (stale)
state="ok"
mtime_age=""
if [ ! -f "$plan_file" ]; then
  state="missing"
elif [ ! -s "$plan_file" ]; then
  state="empty"
else
  # mtime age in seconds (now - mtime). BSD stat (macOS) vs GNU stat (Linux).
  now_epoch="$(date +%s 2>/dev/null || echo 0)"
  if stat -f %m "$plan_file" >/dev/null 2>&1; then
    file_epoch="$(stat -f %m "$plan_file" 2>/dev/null || echo 0)"
  else
    file_epoch="$(stat -c %Y "$plan_file" 2>/dev/null || echo 0)"
  fi
  if [ "$now_epoch" -gt 0 ] && [ "$file_epoch" -gt 0 ]; then
    mtime_age=$(( now_epoch - file_epoch ))
    if [ "$mtime_age" -gt 300 ]; then
      state="stale"
    fi
  fi
fi

# Happy path — silent exit with empty JSON so Claude Code knows the hook ran
# but has nothing to add. No systemMessage, no additionalContext.
if [ "$state" = "ok" ]; then
  echo '{}'
  exit 0
fi

# Build reminder content (wrapped in <hook source=...> tag for visual parity).
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo '?')"
short_root="$(basename "$project_root" 2>/dev/null || echo "$project_root")"

# Operator-visible bubble — short, scannable, non-noisy.
case "$state" in
  missing)
    sys_msg="plan.md missing at $short_root/.claude/plan.md — agent should persist the just-approved plan before /bootstrap-feature can consume it"
    ;;
  empty)
    sys_msg="plan.md is empty at $short_root/.claude/plan.md — overwrite with the just-approved plan body"
    ;;
  stale)
    sys_msg="plan.md at $short_root/.claude/plan.md is ${mtime_age}s old — verify it matches the plan you just approved (or overwrite)"
    ;;
esac

# Agent-only context — fuller wording with the mandate citation.
buf="$(mktemp -t sdlc-exitplanmode-reminder.XXXXXX)"
trap 'rm -f "$buf"' EXIT

{
  printf '<hook source="sdlc-exitplanmode-reminder" event="PostToolUse" tool="ExitPlanMode" state="%s" ts="%s"%s>\n' \
    "$state" "$ts" \
    "$([ -n "$session_id" ] && printf ' session_id="%s"' "$session_id")"

  echo "# === Plan persistence reminder (auto-injected by SDLC PostToolUse hook) ==="
  echo ""
  case "$state" in
    missing)
      echo "You just exited plan mode but \`$plan_file\` does NOT exist."
      ;;
    empty)
      echo "You just exited plan mode but \`$plan_file\` exists with ZERO bytes."
      ;;
    stale)
      echo "You just exited plan mode and \`$plan_file\` exists, but its mtime is ${mtime_age}s old —"
      echo "older than this response. Verify the file matches the plan you just approved; overwrite if not."
      ;;
  esac
  echo ""
  echo "The CLAUDE.md \`## Plan-Mode Persistence\` rule requires that BEFORE calling"
  echo "ExitPlanMode you Write the full plan body to \`<project>/.claude/plan.md\`."
  echo "The \`/bootstrap-feature\` Step 0 precondition aborts if that file is missing,"
  echo "empty, or out of date — meaning the just-approved plan would be lost between"
  echo "plan mode and the bootstrap pipeline."
  echo ""
  if [ "$state" != "stale" ]; then
    echo "Fix it now — in your NEXT response:"
    echo ""
    echo "  1. \`Bash mkdir -p $project_root/.claude\`"
    echo "  2. \`Write file_path=$plan_file content=<full plan body>\`"
    echo ""
    echo "Then proceed with your follow-up work (commonly \`/bootstrap-feature\` to"
    echo "consume the plan, or direct implementation if the user opted out of bootstrap)."
  else
    echo "If the file already matches the plan you approved, no action needed."
    echo "If not — overwrite with the current plan body now:"
    echo ""
    echo "  Write file_path=$plan_file content=<full plan body>"
  fi
  echo ""
  echo "</hook>"
} > "$buf"

# Emit JSON envelope: systemMessage (operator) + additionalContext (agent).
if command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg sys "$sys_msg" \
    --rawfile ctx "$buf" \
    '{
      systemMessage: $sys,
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: $ctx
      }
    }'
else
  # No jq — fall back to plain text (agent context only; operator gets nothing
  # because plain stdout cannot populate systemMessage).
  cat "$buf"
fi

exit 0
