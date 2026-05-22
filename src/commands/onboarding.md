# Command: Onboarding

Force the orchestrator (and any subagent invoked via `Agent` tool) to
re-read every load-bearing pipeline rule at session start (or any time
the operator wants to re-anchor). Output a short verification report so
the operator can confirm the agent is properly oriented before real
work begins.

This skill is the agent-side analogue of
`~/.claude/rules/subagent-onboarding.md` — but for the ORCHESTRATOR
(Mira) itself, not for spawned subagents. Run it whenever:

- A fresh session starts and you want to confirm rules are loaded.
- After context-compaction, to verify the cognitive protocols survived.
- Before starting a high-stakes feature (e.g. before `/bootstrap-feature`).
- The operator says "are you oriented?", "do you remember the rules?",
  "load your context", or similar.

## Process

### 1. Read every global pipeline rule

Read each of the files below FULLY (not just headers). For each, note
the file size and last-modified mtime in the verification report so the
operator can see whether anything drifted since last session.

**Mandatory global rules (in `~/.claude/rules/`):**

1. `cognitive-self-check.md` — Protocols 1/2/3 (Facts / Decisions /
   Inbound). The load-bearing failure-prevention mechanism.
2. `subagent-onboarding.md` — the onboarding contract for every
   `Agent`-tool spawn.
3. `tool-limitations.md` — Read 2000-line cap, Bash 50KB truncation,
   grep-is-not-AST gotchas.
4. `scratchpad.md` — persistent memory at `.claude/scratchpad.md`.
5. `git.md` — feature branches, conventional commits, no
   `Co-Authored-By` attribution.
6. `error-recovery.md` — 4 deviation rules, retry budget, deliberate
   mode (post-error slowing).
7. `session-changelog.md` — short-bullet operator-facing changelog
   at `<project>/.claude/changelog.md`. Maintained per session.
8. `knowledge-base.md` (if present) — `claudebase search` CLI contract,
   citation literal format.
9. `knowledge-base-tool.md` (if present) — when to query the books +
   insights corpora.

**Per-project rules (in `<project>/.claude/rules/`):**

10. Every `.md` file under `<project>/.claude/rules/`. Common examples:
    `architecture.md`, `security.md`, `testing.md`, `changelog.md`,
    `auto-release.md`. The set varies per project — read whatever is
    there.

### 2. Read the orchestrator's CLAUDE.md

Read `~/.claude/CLAUDE.md` (and `<project>/.claude/CLAUDE.md` if it
exists). These are the master configs that reference everything else.
Already auto-loaded by Claude Code, but re-read explicitly to confirm
the agent has the current text — context-compaction may have replaced
earlier reads with summaries.

### 3. Verify cognitive-self-check is active

Confirm to the operator that the three protocols are loaded:

- **Protocol 1 (Facts)** — every claim cites file:line / source verified
  THIS session.
- **Protocol 2 (Decisions)** — every non-trivial decision passes 5
  questions: hack? sane? alternatives? symptom or cause? root cause
  tracked?
- **Protocol 3 (Inbound)** — challenge the inbound task BEFORE
  executing; push back if the task is nonsensical or built on an
  upstream error.

State each protocol's name and what it catches. Do NOT paraphrase — the
protocols are precise.

### 4. Read the current project state

Read these to surface "where we left off":

- `<project>/.claude/scratchpad.md` — current feature, branch, status,
  plan, blockers.
- `<project>/.claude/changelog.md` — tail of 5 most recent bullets so
  the agent sees what was logged for the PM last session.
- `git status --short` + `git log --oneline -5` — current working-tree
  state and last commits.

### 5. Output verification report

Emit ONE concise report (under 400 words) covering:

- **Rules loaded** — list each rule file read with byte count + mtime.
  Flag any that are MISSING (file not present on disk) — that is a
  legitimate gap the operator should know about.
- **Cognitive protocols active** — three-line confirmation of P1/P2/P3.
- **Project state** — current feature, branch, last 3 changelog bullets.
- **Open blockers** — anything from scratchpad `## Blockers`.
- **Next step** — based on scratchpad `## Status:`, what would the
  agent do next absent further input.

### 6. Push-back if state is incoherent

If the orchestrator reads a contradictory state (e.g. scratchpad says
"implementing wave 2 slice 3" but git log shows no commits on the
feature branch, OR changelog says "blocker X open" but scratchpad has
no matching entry), surface the contradiction in the report under a
`### Drift observations` section. Do NOT silently resolve it — that's
the named failure mode Protocol 3 prevents.

## Output Format

```
# Onboarding Report — <YYYY-MM-DD HH:MM>

## Rules loaded
- cognitive-self-check.md (12.4 KB, mtime 2026-05-19)
- subagent-onboarding.md (4.1 KB, mtime 2026-05-19)
- tool-limitations.md (1.2 KB, mtime 2026-05-18)
- ...
- session-changelog.md (3.8 KB, mtime 2026-05-20)
- (project) architecture.md (2.3 KB, mtime 2026-05-15)
- (project) testing.md (1.1 KB, mtime 2026-05-14)
MISSING: ~/.claude/rules/knowledge-base.md  ← if applicable

## Cognitive protocols active
- Protocol 1 (Facts) — catches fact-shaped lies (unverified assumptions
  emitted as facts).
- Protocol 2 (Decisions) — catches decision-shaped hacks (unprincipled
  choices shipped as deliberate ones).
- Protocol 3 (Inbound) — catches propagated upstream errors (bad
  decisions amplified by mechanical execution).

## Project state
- Feature: <name from scratchpad, or "idle">
- Branch: <git branch>
- Status: <scratchpad ## Status:>
- Recent bullets (changelog tail):
  - <bullet 1>
  - <bullet 2>
  - <bullet 3>

## Open blockers
- <from scratchpad ## Blockers, or "none">

## Drift observations
- <only if contradictions surfaced, otherwise omit this section>

## Next step
- <one sentence describing what the agent would do next>
```

## When to use

- **Always**: first invocation in a fresh terminal session before
  starting any real work.
- **Recommended**: after context-compaction (the harness compresses
  prior turns; rule-text may have been summarised).
- **Recommended**: before `/bootstrap-feature` or `/develop-feature` —
  catches missing/drifted rules before they corrupt the pipeline.
- **As-needed**: any time the operator says "are you with me?" or
  "have you loaded the rules?" or similar.

## Rules

- The skill READS only. It does NOT write to any rule or config file.
- If a rule file is MISSING from `~/.claude/rules/`, the report flags
  it but the skill does NOT recreate it. The operator decides whether
  to re-run the SDLC installer.
- The report is concise (under 400 words). If the agent feels the urge
  to write more, that's a Protocol 2 (sanity) violation — the operator
  asked for a summary, not an essay.
- Cognitive protocols are NAMED, not paraphrased. Use the precise
  language from `cognitive-self-check.md`.

## Failure modes prevented

- **Stale-rule drift**: the operator updates a rule between sessions,
  but the previous session's compacted context still holds the old
  text. `/onboarding` forces a re-read and surfaces the new mtime.
- **Silent contradiction**: scratchpad and git log diverge but neither
  the operator nor the agent notices. The Drift observations section
  surfaces it.
- **Empty-handed start**: agent begins a feature without recalling
  why the prior session ended. The recent-bullets tail from the
  session changelog re-anchors context.
