# Auto-Release Activation Sentinel

The presence of this file at `<project>/.claude/rules/auto-release.md` is the
sole signal the `release-engineer` agent uses to decide whether to activate
its **§7 Executing Mode** at `/merge-ready` Gate 9. Absence equals opt-out
(suggest-only; the agent emits the structured 10-section summary and the
developer runs the `Commands to run` block themselves — byte-identical to
current main behavior).

When this file exists, `release-engineer` Gate 9 transitions from
suggest-only to executing mode AFTER Steps 0–6 produce the structured
summary. The agent then runs whitelisted git commands itself per the
4-tier authority dispatch:

- **Trivial** (auto-execute, audit log) — `git add`, `git commit -m`,
  `git merge-base HEAD origin/main`, `git diff --name-only`,
  `git ls-remote --tags origin`.
- **Moderate** (auto-execute, audit log) — `git tag -a v<X.Y.Z> -F <file>`
  for SDLC core OR `git tag -a sdlc-knowledge-v<X.Y.Z> -F <file>` for the
  embedded sdlc-knowledge tool. Tag-scheme disambiguation runs on the
  files changed since the merge base (see release-engineer.md §7).
- **Sensitive** (default-deny prompt; auto-confirm with `AUTO_RELEASE=1`) —
  `git push`, `git push origin v<X.Y.Z>`. The prompt is exactly
  `Push tag <tag> to origin? [y/N] `; empty input or anything other than
  literal `y`/`Y` aborts.
- **Forbidden** (refuse always, regardless of `AUTO_RELEASE=1`) —
  `npm publish`, `cargo publish`, `pypi upload`, `gh release create`,
  any `--force` / `--force-with-lease` flag.

Every Bash invocation is filtered through anchored-regex whitelists with
metacharacter pre-rejection (`;`, `&&`, `||`, `|`, `` ` ``, `$(`, `>`,
`<`, `\`, newline are rejected before regex match). See
`src/agents/release-engineer.md` §7 for the full whitelist set and audit-
trail format.

## Headless contract

Setting `AUTO_RELEASE=1` in the environment OR running with `[ -t 0 ]`
returning false (no TTY on stdin) skips the Sensitive-tier prompt and
auto-confirms. Forbidden tier and the tag-scheme both-changed abort are
NEVER bypassed by headless mode.

## How to opt out

Delete this file from `<project>/.claude/rules/auto-release.md`. The
agent reverts to suggest-only mode silently — no warning, no log line,
behavior byte-identical to projects that never opted in.

## How to opt in to AUTO_RELEASE=1 (no prompts)

Add `export AUTO_RELEASE=1` to your shell rc OR set it inline before
running `/merge-ready`. This is a per-session decision; consider it
carefully — Sensitive-tier `git push origin <tag>` becomes auto-confirmed
without user interaction.

## See also

- `~/.claude/agents/release-engineer.md` §7 — the authoritative
  executing-mode specification, tier table, whitelist regexes, tag-scheme
  disambiguation, audit trail, rollback, idempotency.
- `~/.claude/commands/merge-ready.md` Gate 9 — the invocation context.
- `<project>/CHANGELOG.md` — the [Unreleased] section release-engineer
  reads to compute the bump and date-stamp.
- `<project>/.git/hooks/pre-push` — optional advisory hook (template at
  `~/.claude/hooks/pre-push` after install.sh) that warns when
  [Unreleased] is non-empty at push time.
