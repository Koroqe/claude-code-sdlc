# Session Changelog Rule

A SHORT-bullet operator-facing changelog the agent maintains at
`<project>/.claude/changelog.md` so the project manager / operator can
quickly see "what happened this session" without reading the full
scratchpad, the git log, or the formal `CHANGELOG.md`.

This is a DIFFERENT file from:

- **`<project>/CHANGELOG.md`** — formal Keep-a-Changelog file maintained by
  `changelog-writer` agent, audience = product owners and END USERS, sourced
  from PRD `Changelog:` fields. Governed by `<project>/.claude/rules/changelog.md`
  (the per-project sentinel).
- **`<project>/.claude/scratchpad.md`** — rich internal state (current
  feature, branch, slice progress, blockers, archive). Audience = the agent
  itself across context-compaction boundaries.

The session-changelog sits between them: human-readable per-session bullets
for a PM glance, not formal user-facing release notes, not internal slice
state.

## File location

`<project>/.claude/changelog.md` — per-project, lives alongside scratchpad.
Always at this path; the agent does NOT relocate it.

If the file does not exist when the agent first needs to write a bullet, it
creates the file with a `# Session Changelog` header on line 1.

## Format

```markdown
# Session Changelog

## 2026-05-20

- short bullet about what was done
- another bullet
- third bullet

## 2026-05-19

- bullet from earlier session
- another bullet from earlier session
```

- Date heading is `## YYYY-MM-DD` (ISO calendar date in operator's local
  timezone). One heading per calendar day, regardless of how many sessions
  ran that day.
- Newest day on top.
- Bullets are one-line, plain language, no nested sub-bullets.
- **Hard cap: one bullet ≤ 100 characters.** If the change needs more
  explanation, the bullet still goes in (≤ 100 chars), and the long
  description lives in the commit message or scratchpad — NOT here.
- No emojis, no scope tags like `feat(...)`, no commit SHAs. The PM does
  not care about scope or hash; they care about WHAT was done.

## When to write

The agent appends a bullet (under the current date heading, creating the
heading if absent) after each of these moments:

- **A commit landed** — one bullet per commit, summarising the user-visible
  effect. NOT the conventional-commit subject; rewrite for PM clarity.
- **A plan was accepted** — one bullet noting which feature plan was
  approved and how many slices it has.
- **A wave / slice completed** in `/develop-feature` — one bullet per
  meaningful milestone (not every internal subagent call).
- **A blocker surfaced** — one bullet noting the blocker so the PM sees
  why progress stalled.
- **A blocker resolved** — one bullet closing the loop on a prior blocker.
- **`/merge-ready` reports MERGE READY or NOT MERGE READY** — one bullet
  with the verdict and a hint of why.
- **A release was cut via `/release`** — one bullet with the version.

The agent does NOT write a bullet for:

- Every file read or grep.
- Every prompt the user typed.
- Internal scratchpad updates.
- Every test run.
- Failed retries that were re-attempted and succeeded (only the final
  outcome matters).

Rule of thumb: if a project manager 3 days later reading 5 bullets from
this session could reconstruct "what happened", the granularity is right.
If they'd have to read 50, the granularity is too fine.

## Audience contract

The PM is non-technical. They read this changelog to answer "is progress
happening, where are we, what's blocked". They do NOT read it to understand
implementation details. Write for them, not for yourself.

Examples of GOOD bullets:

- `Telegram bot pairing flow done — operator can now approve users via /telegram:access pair`
- `Channel surface still broken in Claude Code 2.1.144 — fallback to polling pattern`
- `claudebase v0.5.0 released — adds Whisper voice transcription`

Examples of BAD bullets:

- `commit 6cd3959: align meta shape with official wire format (chat_id i64, message_id str, etc.)`
   — too implementation-flavoured, mentions commit SHA, PM doesn't care
- `Added `build_channel_notification_telegram` helper to chat.rs`
   — internal symbol name, PM doesn't know what chat.rs is
- `Wave 2 of 5 done`
   — meaningless without context; rewrite as "core daemon + UDS server done; Telegram bot next"

## Sentinel

**The presence of this file at `~/.claude/rules/session-changelog.md` is
the sole signal the agent uses to decide whether to maintain a session
changelog.** Absence equals opt-out — downstream projects that do not want
the per-session bullet log simply omit this rule file from their
`~/.claude/rules/` directory, and the agent silently skips all
`<project>/.claude/changelog.md` writes.

## Append discipline

When appending under the current date heading:

1. Read the file (or treat missing as empty).
2. Find the current `## YYYY-MM-DD` heading. If absent, prepend a new
   one immediately after the `# Session Changelog` header.
3. Append the new bullet at the END of that date's bullet list (preserving
   chronological order within a day).
4. Do NOT rewrite or compact past entries. The file grows monotonically.

When the file exceeds 500 lines, the oldest dated section is moved to
`<project>/.claude/changelog-archive.md` (same format). This is a manual
operator action via `/context-refresh` or similar — the agent does NOT
auto-archive.

## Onboarding hook

The `/onboarding` skill (when invoked at session start) reads this file
to show the operator a 5-line tail of the most recent bullets, so the
session starts with concrete context about what happened last time. This
is a READ-only consumption — `/onboarding` never writes here.

## Cognitive Self-Check (MANDATORY)

This rule is in the scope of the cognitive-self-check protocol per
`~/.claude/rules/cognitive-self-check.md`. Specifically:

- **Protocol 3 (Inbound)** — if the agent receives instruction to omit a
  bullet for a meaningful event ("don't log this commit"), the agent
  surfaces the contradiction with the rule's intent under `### Inbound
  validation` before complying. Skipping a bullet to hide work from the
  PM is the named failure mode this rule prevents.
- **Protocol 2 (Decisions)** — choosing which moments warrant a bullet
  passes Q2 (sane?) — if the agent wrote 30 bullets in one session, that
  granularity failed Q2 and the agent should consolidate.

## Application Scope

In-scope: the orchestrator (Mira) and all 17 thinking agents (the
cognitive-self-check rule's in-scope set). Mechanical executor agents
(`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`,
`changelog-writer`) do NOT write to this file — their work surfaces via
the orchestrator's bullet when relevant.
