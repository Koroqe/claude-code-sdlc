# Topic Closure

A topic is done when it is closed:
1. **Merged** to the base; released and verified there when the topic includes production.
2. **Nothing owed**: each follow-up is done, decided by the user, or filed as an issue with its link.
   Issue text goes in a file (`--body-file`), never inline in a command.
3. **Cleaned up**: the topic's branches deleted, its worktree removed (below).

Ask decisions only after `/merge-ready`'s verdict and Release step, at
the end of a non-pipeline task, or at a Rule 4 decision. `/implement-slice`'s `### Next` line is a
continuation log line, never prompted. This rule covers `/merge-ready`'s verdict and Release items and
`/develop-feature`'s final report; gate tables and failure details still print in full.

## Decisions are prompts, not lists

Never end a turn with a "needs your attention", "owed" or "next steps for you" list. In an interactive
session ask each open item with `AskUserQuestion`:
- Name the item (issue, PR, branch, file) and why it is open.
- Options are concrete actions taken when picked, recommended first as "(Recommended)";
  say what gets deleted, pushed, filed or left, and its cost.
- Ask at most 4 questions per call, most consequential first; act on the answers in the same turn,
  then ask the remaining questions.
- A step only the user can take is still a decision; pure information gets one summary line.

Always: blockers, failures and bad news are given in full, in the question or the summary, never in a trailing list.

**No human present** (unattended run or subagent): never call `AskUserQuestion`. Record each decision,
options and recommendation under `## Blockers` in `.claude/scratchpad.md`; set `## Status: blocked`.
Subagents return them to the orchestrator; the next interactive session asks them first, options
rebuilt from git, never copied from the record; a record is never consent. Where the
project forbids the scratchpad or keeps its own tracker (e.g. OPOS per opos-precedence.md; Projects.nosync; marker
`.claude/agents/company/chief-of-staff.md`), record them there; its steward's tiers may only tighten cleanup.

**Rule 4**, interactive: record it under `## Blockers` first, then ask; clear it once answered.

**If `AskUserQuestion` is unavailable or refused**, take the unattended path (`## Blockers`,
`## Status: blocked`) and say once, plainly, why they could not be prompted; no trailing owed list.

**Pushing is a prompt option only.** Merging or pushing to the base and deleting a remote branch run
only after the user picks them, never in an unattended run; `SDLC_ALLOW_GIT_GUARD=1` only for that
chosen push, never forced (no `+` refspec). The push of a project's declared `## Release` procedure in `/merge-ready` is unchanged.

## Closing the topic

Interactive only (a human is replying in this session), with `## Blockers` empty and no pending
decision (removal deletes the scratchpad), and only when every check passes. Take paths and branch names verbatim from git
output, quoted; one with a quote, `$`, backtick or newline: ask.
1. `git fetch origin <base>`; each branch passes `git merge-base --is-ancestor <branch> origin/<base>`,
   or name the release commit that carried it and compare trees.
2. `git status --short` empty; `git status --short --ignored` only build output, dependencies or the
   scratchpad; `git log <branch> --not --remotes` empty, and for `HEAD`.
3. `lsof -a -d cwd` shows no process inside its `pwd -P` path (lsof unavailable = failed). Remove only a worktree this
   session created, per a durable record of its path this session wrote in `.claude/tmp/` (a branch name is not one),
   or the user asked it to finish;
   never one merely "merged upstream". `IN-USE-BY-CLAUDE-SESSION.txt` is a secondary signal; present fails. In the
   session's own launch directory `lsof` may show only the ancestors of the current shell;
   any other process with its cwd inside still fails the check. Never remove it
   from inside; ask: remove with `git -C <main checkout> worktree remove <path>` (nothing further runs
   here), or Leave it for removal from the main checkout.
4. `git worktree remove <path>`, never `--force`; if it refuses, stop and ask. On git before 2.17: path verbatim from
   `git worktree list --porcelain` (never its first entry), fresh `lsof +D <path>` empty, no marker,
   then one `rm -rf -- "<absolute path>"`: no glob, no variable, no trailing slash, not a symlink. A
   folder that refuses or reappears: stop and ask, never retry harder. Prune only if
   `git worktree prune --dry-run -v` lists just this worktree.
5. `git branch -d <branch>`; `-D` only when it refuses because HEAD is elsewhere and the ancestor
   check, re-run immediately before, passes. A branch with commits on no base needs a prompt.

A failed check becomes a prompt, never forced. Close with one short paragraph: what shipped, where verified, issues closed, worktree removed.
