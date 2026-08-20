#!/usr/bin/env bash
#
# Sync GitHub's "About" panel from the plugin manifest.
#
# WHY THIS IS A SCRIPT AND NOT A CHECKLIST ITEM
#
# The About description sat at "13 AI agents" for two whole major versions
# while README.md, plugin.json and marketplace.json were all updated to 15. It
# drifted for exactly one reason: it lives outside the repository, so every
# mechanism this project relies on — grep, CI validators, code review, the
# release procedure — is structurally blind to it. Nothing could have caught
# it, and nobody was going to remember it.
#
# So it is not maintained by hand any more. The description is DERIVED from
# `.claude-plugin/plugin.json`, which is already covered by
# validate-version-consistency.js and validate-plugin-manifest.js. Drift
# becomes impossible as long as this runs, because there is no second copy of
# the text to fall out of date — there is one source and a command that
# projects it outward.
#
# Idempotent: running it when nothing changed reports "already current" and
# makes no API call to change anything.
#
# Requires an authenticated `gh`. It is a release-time command, deliberately
# not a CI check: CI has no credentials and no network guarantee, and a check
# that silently skips when its tooling is absent is the vacuity this repo
# refuses everywhere else. Better an explicit step that fails loudly when run
# than a green check that never ran.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST="$ROOT/.claude-plugin/plugin.json"

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

# Topics are a fixed, curated list: they describe what the project IS, which
# changes far more rarely than its agent count, and GitHub caps them at 20.
TOPICS="claude-code claude anthropic ai-agents sdlc tdd developer-tools automation code-review quality-gates plugin devtools"

fail() { printf '\033[0;31m[FAIL]\033[0m %s\n' "$1" >&2; exit 1; }
ok()   { printf '\033[0;32m  [OK]\033[0m %s\n' "$1"; }
info() { printf '\033[0;34m[INFO]\033[0m %s\n' "$1"; }

command -v gh >/dev/null 2>&1 || fail "gh is not installed — cannot sync repository metadata."
gh auth status >/dev/null 2>&1 || fail "gh is not authenticated — run 'gh auth login' first."
[ -f "$MANIFEST" ] || fail "missing $MANIFEST — the description is derived from it."

# node, not jq: this repo already requires node for its validators and does not
# require jq anywhere, so depending on jq here would add a new prerequisite for
# a single field read.
DESCRIPTION="$(node -e '
  const m = require(process.argv[1]);
  if (typeof m.description !== "string" || !m.description.trim()) {
    console.error("plugin.json has no usable description");
    process.exit(1);
  }
  process.stdout.write(m.description.trim());
' "$MANIFEST")" || fail "could not read description from $MANIFEST"

# GitHub rejects descriptions over 350 characters outright, which would surface
# as an opaque API error rather than a fixable message.
if [ "${#DESCRIPTION}" -gt 350 ]; then
  fail "description is ${#DESCRIPTION} characters; GitHub's limit is 350. Shorten it in plugin.json."
fi

CURRENT="$(gh repo view --json description --jq '.description // ""')"

info "derived:  $DESCRIPTION"
info "current:  ${CURRENT:-(empty)}"

if [ "$CURRENT" = "$DESCRIPTION" ]; then
  ok "About description already current — no change needed."
else
  if [ "$DRY_RUN" = true ]; then
    info "--dry-run: would update the About description."
  else
    gh repo edit --description "$DESCRIPTION" >/dev/null
    ok "About description updated from plugin.json."
  fi
fi

if [ "$DRY_RUN" = true ]; then
  info "--dry-run: would ensure topics: $TOPICS"
  exit 0
fi

# `--add-topic` is additive and idempotent; it never removes a topic someone
# added deliberately through the web UI.
TOPIC_ARGS=()
for t in $TOPICS; do TOPIC_ARGS+=(--add-topic "$t"); done
gh repo edit "${TOPIC_ARGS[@]}" >/dev/null
ok "Topics ensured."

HOMEPAGE="$(node -e '
  const m = require(process.argv[1]);
  process.stdout.write(typeof m.homepage === "string" ? m.homepage : "");
' "$MANIFEST")"
if [ -n "$HOMEPAGE" ]; then
  gh repo edit --homepage "$HOMEPAGE" >/dev/null
  ok "Homepage set to $HOMEPAGE"
fi

ok "Repository metadata is in sync with plugin.json."
