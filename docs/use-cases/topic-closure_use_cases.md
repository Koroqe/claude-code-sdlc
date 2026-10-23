# Use Cases: Topic Closure — Prompted Decisions and a Finished Topic

> Based on [PRD](../PRD.md) — Section 17: Topic Closure — Prompted Decisions and a Finished Topic
>
> Amended 2026-10-22 after architecture review: `### Next` is never prompted (UC-1-E4); cleanup preconditions C0/C2/C3 tightened (UC-4-E12 to E15, EC9 to EC11); pushes are prompt-only (UC-4-A6, A8); own-launch-directory case (UC-4-A9); old-git path hardened (UC-4-A3); own-tracker case (UC-2-A4); delivery details (UC-5, UC-6, UC-7); references to non-plugin rule files removed.

---

**System context (do not assume otherwise):** this feature has no UI, no server and no database. It is one new memory-layer rule, `src/rules/topic-closure.md` (behavioural reference: the hand-made `~/.claude/rules/topic-closure.md`), plus one-line pointers in `src/claude.md`, `skills/merge-ready`, `skills/develop-feature` and `src/rules/error-recovery.md` (four pointer files in all; `skills/implement-slice/SKILL.md` gets NO pointer and stays byte-identical because its `### Next` is exempt), with `AskUserQuestion` added to the `allowed-tools` of `skills/merge-ready` and `skills/develop-feature`, plus delivery wiring (`manifests/owned-files.txt`, `install.sh`, the session-start drift check, release 4.12.0). It adds no agent, skill or hook id (NFR-1). Behaviour is model-followed instructions at the end of a run, so "mechanically checkable" means: a specific tool call made or not made (`AskUserQuestion`), a specific scratchpad section written, a specific git state afterwards, or a specific file/line present or absent.

**Actors**
- **Developer** — the human in an interactive session; answers prompts.
- **Orchestrating session** — the main Claude Code session running `/develop-feature`, `/implement-slice`, `/merge-ready`; the only actor that calls `AskUserQuestion` and performs closure.
- **Subagent** — a wave subagent or any agent launched by the orchestrator; never calls `AskUserQuestion`; returns decisions to the orchestrator.
- **Unattended / scheduled run** — a session with no human present; never calls `AskUserQuestion`; records decisions under `## Blockers`.
- **`install.sh`** — installs, refreshes and uninstalls memory-layer files listed in `manifests/owned-files.txt`.
- **Session-start hook** — `session:start:spine` (Sections 7 and 12), whose content drift check emits the stale-memory-layer warning.

**Relationship to existing behaviour:** Run to Completion (Section 16) is unchanged: prompts happen only after `/merge-ready`'s verdict and its Release step, at the end of a non-pipeline task, or at a Rule 4 block, never as a mid-plan "continue?" (FR-1.2). `/implement-slice`'s `### Next` ("Continuing to Slice N") is a continuation log line and is never prompted. The `## Blockers` + `## Status: blocked` contract (Section 16) carries unattended decisions. The rule wins over "Owed / Needs attention / follow-ups for you" report endings in interactive sessions (FR-4.2); gate tables and failure details still print in full. Closure-time pushing (merge/push to base, remote-branch deletion) is only ever a prompt option, run after the user picks it, with `SDLC_ALLOW_GIT_GUARD=1`, never in an unattended run; the push performed by a project's declared `## Release` procedure inside `/merge-ready` Finalization: Release is unchanged and is not governed by this rule.

**Note on non-plugin files:** `output-shaping.md` and `opos-precedence.md` are user-level rule files that are not part of the plugin; this document does not depend on them. "Non-compressible" below means: blockers, failures and bad news are stated in full, never capped or summarized.

**Reference: closure checks (referenced by UC-4, not restated)**
- **C0 (gate)**: closure removal runs only in an interactive session, only with `## Blockers` empty and no pending decision (decisions live in the gitignored scratchpad, which removal would erase).
- **C1 (on base)**: `git fetch origin <base>` first; then each topic branch is an ancestor of `origin/<base>` (`git merge-base --is-ancestor`), or content reached base via a named release/cherry-pick commit with the tree comparison stated (FR-3.2).
- **C2 (nothing lost)**: `git status --short` empty in the worktree; `git status --short --ignored` lists nothing that cannot be regenerated (build output is fine); `git log <branch> --not --remotes` shows no commit on neither base nor a remote, and `git log HEAD --not --remotes` is also empty (FR-3.3).
- **C-safe (verbatim names, FR-3.10)**: paths and branch names are taken verbatim from git output and quoted in every command; a name containing a quote, `$`, a backtick or a newline is asked about rather than run.
- **C3 (nobody else)**: `lsof -a -d cwd` shows no process inside (`lsof` unavailable = check failed); the session created the worktree or was asked to finish it; it is not this session's own launch directory (else UC-4-A9); no worktree is removed on "merged upstream" alone (FR-3.4). `IN-USE-BY-CLAUDE-SESSION.txt` is a secondary signal only.
- **C4 (branches)**: `-d` normally; `-D` only when `-d` refuses solely because HEAD is elsewhere and the C1 ancestor check is re-run immediately before `-D` and passes; never delete a branch with commits on no base without asking; remote-branch deletion is a prompt option only (FR-3.6).
- **P (pushing)**: merging or pushing to the base and deleting a remote branch are prompt options only; run after the user picks them, with `SDLC_ALLOW_GIT_GUARD=1`; never in an unattended run; closure-time pushes are never forced (no `--force`, no `+` refspec). P governs only closure-time merges, pushes and remote-branch deletions: the push performed by a project's declared `## Release` procedure inside `/merge-ready` Finalization: Release is unchanged.

---

## UC-1: Interactive End of Feature — Open Items Become Prompts

**Actor**: Orchestrating session; Developer
**Preconditions**:
- Interactive session with a human present and `AskUserQuestion` available
- The planned work is complete (all slices done, `/merge-ready` verdict reached) and at least one open item exists (a follow-up, a decision, a user-only step, an unfiled issue)
**Trigger**: The orchestrator reaches the point where its report would previously have ended with a "Next", "Owed" or "Needs attention" list

### Primary Flow (Happy Path)
1. Orchestrator enumerates every open item and turns each into a decision (FR-2.1).
2. For each item it writes a question of one or two sentences saying what the item is and why it is open, naming the issue, PR, branch or file (FR-2.1).
3. Each question gets concrete-action options; the recommended option is first and its label ends with " (Recommended)" (FR-2.2).
4. Each option description states the consequence: what is deleted, pushed, filed or left behind, and its cost (FR-2.2).
5. Orchestrator calls `AskUserQuestion` with at most 4 questions (FR-2.3).
6. Developer answers.
7. Orchestrator acts on every answer in the same turn (FR-2.3), then continues to topic closure (UC-4).
8. The turn does not end with any "needs your attention / owed / open items / next steps for you" list (FR-2.1).

**Postconditions**: every open item is done, decided by the user, or filed with its link recorded (FR-1.1b); no trailing to-do list exists in the final message; gate tables from `/merge-ready` are still printed in full.

### Alternative Flows
- **UC-1-A1: more than 4 open items** — diverges at step 5. Orchestrator ranks by consequence, asks the 4 most consequential in the first call, acts on those answers, then asks the remainder in a following call (FR-2.3). Repeats until none remain; closure starts only after the last answer is acted on.
- **UC-1-A2: a step only the user can take** (founder approval, credential, console click) — diverges at step 3. The step is still asked as a decision, with options such as "I'll do it now", "Remind me via an issue", "Skip" (FR-2.4). Selecting "Remind me via an issue" files the issue and records its link; "Skip" is recorded as a decision. Issue, comment and tracker text go in files, never inline in the command (e.g. `--body-file <file>`; a title is also read from a file, not typed into the command line), because finding text can quote `$(...)` or backticks (FR-2.11).
- **UC-1-A3: pure information needing no decision** (e.g. an unrelated failure already filed) — diverges at step 1. No question is created; the item appears as one line in the closing summary, or not at all (FR-2.5). If this leaves zero decisions, no `AskUserQuestion` call is made (see UC-1-EC1).
- **UC-1-A4: non-compressible content among the items** — diverges at step 2. A blocker, failure, or bad news is given in full: in the question text, in option descriptions, or in the summary printed immediately before the prompt; never summarized, never capped, never moved to a trailing list (FR-2.6).

### Error Flows
- **UC-1-E1: `AskUserQuestion` unavailable or refused** — at step 5 the tool cannot be invoked or is refused (older client, restricted tool set). Orchestrator takes the unattended path (UC-2): records each decision under `## Blockers` with options and a recommendation, sets `## Status: blocked`, and says once, plainly, in the final message that the decisions are recorded under `## Blockers` and why they could not be prompted. It does not print a trailing to-do list. Destructive cleanup does not run (UC-4-E12).
- **UC-1-E2: developer picks "leave it" / declines an option** — at step 6. Orchestrator honours the choice in the same turn (no filing, no deletion, item left as designed), records the decision where the item's own state lives, and continues. A decline of an item does not by itself block topic closure unless the item is a closure check (see UC-4-E8).
- **UC-1-E3: a skill report ends with Owed/Needs attention/follow-ups-for-you items** — at step 1, `/merge-ready`'s verdict and Release step ("what did not ship") or `/develop-feature`'s final report ends in such items. In an interactive session they are presented as decision prompts instead (FR-4.2); gate tables and failure details are printed unchanged.
- **UC-1-E4: no mid-plan "continue?" prompt is ever produced** — `/implement-slice` ends a slice with its `### Next` line ("Continuing to Slice N"), while slices or gates remain pending. That line is a continuation log line: it is never converted to an `AskUserQuestion`, and no prompt of any kind is issued between slices or before `/merge-ready`'s verdict (FR-1.2). Asserted over a multi-slice run transcript: zero `AskUserQuestion` calls before the verdict, except a Rule 4 block (UC-3).

### Edge Cases
- **UC-1-EC1**: zero open items — no `AskUserQuestion` call is made; the orchestrator proceeds straight to closure.
- **UC-1-EC2**: exactly 4 items → one call with 4 questions; exactly 5 items → a call with 4, then a call with 1 (never 5 in one call).
- **UC-1-EC3**: an answer changes what other items mean (e.g. developer selects "close issue and remove worktree" while another item is still pending) — the remaining questions are asked only after the first answers are acted on, so later questions reflect current state.
- **UC-1-EC4**: prompts occur only after `/merge-ready`'s verdict and Release, at the end of a non-pipeline task (a bare fix or question-driven task with no pipeline), or at Rule 4. While slices or gates remain pending and no Rule 4 block exists, no prompt is issued (FR-1.2, see UC-1-E4); `stop:gate-evidence` behaviour is unchanged.

### Data Requirements
- **Input**: list of open items (issue/PR/branch/file references), session state
- **Output**: answers from `AskUserQuestion`; actions taken (issues filed with recorded links, branches/worktrees handled)
- **Side Effects**: possible `gh issue create`; scratchpad `## Blockers` only in UC-1-E1

---

## UC-2: Unattended Run or Subagent — Decisions Recorded, Not Asked

**Actor**: Unattended/scheduled run; Subagent; Orchestrating session
**Preconditions**:
- No human is present (scheduled/headless run), or the actor is a subagent
- At least one open decision exists at end of work
**Trigger**: The run reaches the end of its work or a Rule 4 block

### Primary Flow (Happy Path)
1. Run identifies each open decision.
2. It does NOT call `AskUserQuestion` (FR-2.7).
3. It writes each decision under `## Blockers` in `.claude/scratchpad.md` with its options and a recommendation, and sets `## Status: blocked` (FR-2.7).
4. It reports (full, non-compressible) what is blocked and why, and ends the turn; this is the one legitimate mid-plan stop (Section 16).
5. The next interactive session reads the scratchpad and asks these decisions first (FR-2.7).

**Postconditions**: `## Blockers` is non-empty with options and a recommendation per decision; `## Status: blocked`; no `AskUserQuestion` call occurred; no topic closure removal ran for failed or undecided checks.

### Alternative Flows
- **UC-2-A1: subagent returns decisions to the orchestrator** — diverges at step 3. The subagent does not write the scratchpad (parallel-wave subagents are refused scratchpad writes by `pre:agent:isolation-guard`); it returns each decision, its options and recommendation in its result to the orchestrator (FR-2.7).
- **UC-2-A2: orchestrator is interactive and receives subagent decisions** — after A1, the orchestrator (with a human present) asks them as `AskUserQuestion` prompts per UC-1 (post-wave, as with Rule 4 in parallel mode), acting on answers in the same turn.
- **UC-2-A3: next interactive session picks up recorded Blockers** — step 5. At session start the orchestrator reads `## Blockers`, asks those decisions first (before any new work), acts on answers, clears resolved entries, and resets `## Status`. Options are rebuilt from current git state, never copied from the record, and a record is never consent: a recorded recommendation or earlier "yes" authorizes nothing until the user answers the re-asked prompt.

- **UC-2-A4: project forbids the scratchpad or uses its own tracker** (e.g. an OPOS repo, where work is tracked in GitHub issues and `.claude/scratchpad.md` is not written) — diverges at step 3. Unattended decisions go to that project's tracker (e.g. the task issue) with the same options and recommendation instead of `## Blockers`. Writes to the tracker put their text through a file (e.g. `gh issue comment <n> --body-file <file>`), never inline in the command. The steward's permission tiers govern any cleanup (UC-4-A5). No pipeline state file is created.

### Error Flows
- **UC-2-E1: an unattended run or subagent calls `AskUserQuestion` anyway** — a violation of FR-2.7. Expected behaviour is that it is not called; the QA/E2E check asserts no such call in headless runs and in subagent transcripts.
- **UC-2-E2: scratchpad write refused** (`pre:agent:isolation-guard` for a parallel-wave subagent) — the subagent returns the decisions in its result instead; no decision is lost and none is written to `CHANGELOG.md` or any other file.

### Edge Cases
- **UC-2-EC1**: unattended run with no open decisions — `## Status` is not set to blocked; the run reports normally but runs NO destructive cleanup (no worktree removal, no branch deletion, no push; UC-4-EC9); a closure check that would have failed is recorded as a Blocker.
- **UC-2-EC2**: a Blocker is answered in the next session with "leave it" — the entry is removed from `## Blockers` and the decision recorded; `## Status` is reset only when `## Blockers` is empty.
- **UC-2-EC3**: scheduled run in the main checkout with no worktree — closure removal is skipped (UC-4-A4) and undecided items still go to `## Blockers`.

### Data Requirements
- **Input**: open decisions with options and a recommendation
- **Output**: `## Blockers` entries; `## Status: blocked`; subagent result payload
- **Side Effects**: scratchpad write by the orchestrator/unattended run only

---

## UC-3: Rule 4 Escalation in an Interactive Session

**Actor**: Orchestrating session; Developer
**Preconditions**: interactive session; an architectural decision, new dependency, API contract or schema change that the approved plan did not already make
**Trigger**: error handling classifies an issue as Rule 4 (`error-recovery.md`)

### Primary Flow (Happy Path)
1. Orchestrator stops implementation and writes the decision under `## Blockers`, sets `## Status: blocked` (existing Rule 4 contract).
2. It asks the decision as an `AskUserQuestion` prompt carrying the decision, every option and each option's trade-off (FR-2.8).
3. Developer selects an option.
4. Orchestrator clears the blocker, resets status, acts on the answer in the same turn, and resumes the plan.

**Postconditions**: the decision is made by the user; `## Blockers` is `(none)`; work resumes with no further hand-off.

### Alternative Flows
- **UC-3-A1: unattended or subagent Rule 4** — the Rule 4 prompt applies in an interactive session only; here it records only: no prompt; the decision stays under `## Blockers`; subagent returns it to the orchestrator for post-wave presentation (UC-2).
- **UC-3-A2: change already specified by the approved plan** — not Rule 4 (`error-recovery.md`); no prompt; implement.

### Error Flows
- **UC-3-E1: developer's answer contradicts the plan or is "stop"** — orchestrator keeps `## Status: blocked`, records the answer under `## Blockers`, and ends the turn; no retry budget is consumed beyond the Rule 4 cost.

### Edge Cases
- **UC-3-EC1**: more options than a single question can present — every option and its trade-off still appears (in question text/descriptions); none is dropped (non-compressible).
- **UC-3-EC2**: Rule 4 raised by a parallel-wave subagent — presented by the orchestrator during post-wave collection, not mid-wave.

### Data Requirements
- **Input**: decision, options, trade-offs
- **Output**: chosen option acted on
- **Side Effects**: `## Blockers` set then cleared

---

## UC-4: Topic Closure — Merged, Nothing Owed, Cleaned Up

**Actor**: Orchestrating session
**Preconditions**:
- `/merge-ready` Finalization (changelog, instincts) and Finalization: Release (when scope includes production) are complete
- Every UC-1 decision has been answered and acted on
- Interactive session; `## Blockers` is empty and no decision is pending (C0)
- The session created a worktree (`feat/<slug>` or `fix/<slug>`) or was asked to finish one, and it is not the session's own launch directory
**Trigger**: all decisions acted on, same turn (FR-3.1)

### Primary Flow (Happy Path)
1. Orchestrator confirms C0, then runs `git fetch origin <base>` and verifies C1: for each topic branch `git merge-base --is-ancestor <branch> origin/<base>` succeeds.
2. Verifies C2: `git status --short` is empty; `git status --short --ignored` lists only regenerable output; `git log <branch> --not --remotes` shows no unique commit.
3. Verifies C3: `lsof -a -d cwd` shows no process inside the worktree (compared against the resolved `pwd -P` path); this session created the worktree, proven by a durable record of its path in an untracked `.claude/tmp/` file (not a symlink), never by a branch name (FR-3.4).
4. Leaves the worktree (no shell or process of its own stays in it).
5. Runs `git worktree remove <path>` (never `--force`); it succeeds.
6. Runs no `git worktree prune`: `git worktree remove` already cleans its own metadata. Prune runs only on the old-git (<2.17) folder-deletion path, after `git worktree prune --dry-run -v` lists just this worktree (UC-4-A3, UC-4-E15).
7. Deletes each topic local branch with `git branch -d <branch>` (C4).
8. Does not ask again (FR-3.1); removal is part of the goal.
9. Prints the closing message: one short paragraph — what shipped, where it is verified, which issues closed, that the worktree is removed (FR-3.9).

**Postconditions**: worktree path absent and not in `git worktree list`; topic local branches gone; base contains the work; nothing owed; the last message is one paragraph.

### Alternative Flows
- **UC-4-A1: content reached base via a release/cherry-pick commit** — diverges at step 1. The branch is not an ancestor; the orchestrator compares trees (branch tree vs the base commit's tree for the topic's paths), names the release/cherry-pick commit in its message, and treats C1 as satisfied only when the comparison shows identical content (FR-3.2).
- **UC-4-A2: `git branch -d` refuses only because HEAD is elsewhere** — diverges at step 7. The C1 ancestor check is re-run immediately before `-D`; only if it passes is `git branch -D <branch>` used, for that branch only (FR-3.6). If the re-run fails, `-D` is not used and a prompt follows.
- **UC-4-A3: git older than 2.17 (no `worktree remove`)** — diverges at step 5. The version gate is `git --version` < 2.17. Orchestrator takes the path verbatim from `git worktree list --porcelain` (never its first entry, the main worktree); runs a fresh `lsof +D <path>` (nothing); checks `IN-USE-BY-CLAUDE-SESSION.txt` as a secondary signal (absent); confirms the path is absolute, has no trailing slash, contains no glob or variable, and is not a symlink; then runs a single `rm -rf -- "<absolute path>"`; never `--force`. Then, instead of a blind prune, it runs `git worktree prune --dry-run -v` and prunes only if that lists just this path (FR-3.5; see UC-4-E15).
- **UC-4-A4: session in the main checkout, no worktree created** — steps 3 to 6 skipped; merged topic branches that are not checked out are still deleted with `-d` (FR-3.8). Closing message omits any worktree-removed statement.
- **UC-4-A5: OPOS repo** (`.claude/agents/company/chief-of-staff.md` present) — the steward's permission tiers and never-automate invariants are applied first to every cleanup step; where they forbid a step, it becomes a decision prompt. UC-1 prompting applies unchanged; no Triage or pipeline artifacts are introduced (FR-4.1). Decisions and "owed" tracking use the repo's own tracker (UC-2-A4), not the scratchpad.
- **UC-4-A6: remote topic branch** — after step 7, when a remote topic branch exists, deleting it is offered as a prompt option (recommended when this session pushed it and it is merged). Only after the user picks it does the orchestrator run the delete, with `SDLC_ALLOW_GIT_GUARD=1`. If not picked, the remote branch stays (FR-3.6, P).
- **UC-4-A7: multiple topic branches** (e.g. feature plus its fix branch) — C1 and `-d`/`-D` evaluated per branch; closure of branches that pass proceeds even if a sibling fails, with the failing one raised as a prompt (FR-3.7).
- **UC-4-A8: topic is not yet on the base** — diverges at step 1 (C1 fails because nothing was merged). Merging or pushing to the base is offered as a prompt option ("Merge and push to <base>", recommended when the verdict is MERGE READY; "Leave unmerged"). Only after the user picks it does the orchestrator run it, with `SDLC_ALLOW_GIT_GUARD=1`; then C1 is re-evaluated after `git fetch origin <base>` and closure continues. Never automatic, never in an unattended run (P).
- **UC-4-A9: the worktree is the session's own launch directory** — diverges at step 3/4. It is never removed from inside. The orchestrator asks: "Remove it now with `git -C <main checkout> worktree remove <path>`; this session can do nothing further after that" vs "Leave it for removal from the main checkout". On the first, it runs the command via the main checkout (C1 and C2 must pass; for C3, `lsof -a -d cwd` may show only this session's own process tree, i.e. the ancestors of the current shell, which is expected and does not fail the check; any OTHER process with its cwd inside still fails C3 and becomes a prompt as in UC-4-E2) and then sends the closing message; on the second it deletes nothing and the closing message says the worktree remains and why.

### Error Flows
All closure errors are never forced; each becomes a decision prompt in an interactive session, or a `## Blockers` entry in an unattended run (FR-3.7, NFR-5).
- **UC-4-E1: dirty tree or unpushed unique commits** — C2 fails (`git status --short` non-empty, or `git log <branch> --not --remotes` lists commits). Nothing is removed. Prompt offers e.g. commit and push (push only after the user picks it, P), stash, discard (with its cost stated), or leave the worktree.
- **UC-4-E2: another process has its cwd inside the worktree** — C3 fails (`lsof -a -d cwd`). The worktree is not removed; the process is named in the prompt/blocker.
- **UC-4-E3: `IN-USE-BY-CLAUDE-SESSION.txt` present** — a secondary signal of another live session; combined with or independent of `lsof`, the worktree is not removed and the prompt names the marker. Its absence never proves the worktree is free (`lsof` is primary).
- **UC-4-E4: worktree not created by this session and not asked to finish** — C3 fails; never removed, even when "merged upstream" (FR-3.4).
- **UC-4-E5: `git worktree remove` refuses** (locked, modified, untracked files) — stop and ask; no `--force`, no fallback `rm -rf` (FR-3.5).
- **UC-4-E6: folder reappears or refuses deletion after `rm -rf --`** (git older than 2.17 path) — something is writing to it; stop and ask; never retry harder (FR-3.5, NFR-5).
- **UC-4-E7: a branch carries commits on no base** — never deleted without asking; prompt lists the commits and options (push/PR, keep, delete with cost) (FR-3.6).
- **UC-4-E8: developer declines or selects "leave it" for a failed check** — the item is left as chosen; branches/worktree stay; closing message states what was left and the recorded decision (no "owed" list).
- **UC-4-E9: remote topic branch not pushed by this session, or not merged** — deletion is not recommended; the prompt states the risk; if the user does not pick it, nothing is deleted. Even when picked, it runs only after the pick, with `SDLC_ALLOW_GIT_GUARD=1` (FR-3.6, P).
- **UC-4-E10: `AskUserQuestion` unavailable when a closure check fails** — same as UC-1-E1: the failure is recorded under `## Blockers` with options and a recommendation; nothing is removed.
- **UC-4-E11: C1 fails** — branch neither an ancestor of `origin/<base>` nor content-identical via a named commit (after `git fetch origin <base>`); the work is not on base; nothing is removed; prompt (UC-4-A8) presents merge options.
- **UC-4-E12: decisions are recorded in the gitignored scratchpad (C0 fails)** — `## Blockers` is non-empty or a decision is pending (including after UC-1-E1 or UC-4-E10). Removing the worktree would erase `.claude/scratchpad.md` and with it the recorded decisions, so cleanup is held: the worktree and branches stay, the closing message says the decisions are recorded and cleanup is held until they are answered. Nothing is deleted "to be tidy".
- **UC-4-E13: `lsof` unavailable** — the C3 check has failed (it is not treated as "nobody inside"). Nothing is removed; a prompt follows (e.g. "Leave it", "I confirmed nothing is using it; remove it").
- **UC-4-E14: `git status --short --ignored` lists non-regenerable ignored files** (e.g. a local `.env`, uploaded fixtures, unpushed notes) — C2 fails. Build output (`node_modules`, `.next`, `dist`) is fine; anything else is named in the prompt with options (copy it out, discard with its cost stated, leave the worktree).
- **UC-4-E15: `git worktree prune --dry-run -v` lists other paths** (git older than 2.17 path) — prune drops the metadata of every worktree whose folder is missing, including a sibling's. The orchestrator does NOT prune; it names the other paths in a prompt (leave metadata, or prune after the user confirms).

### Edge Cases
- **UC-4-EC1**: `.claude/scratchpad.md` is gitignored, so it does not make `git status --short` non-empty; it is however visible in `git status --short --ignored`, where it counts only as regenerable when `## Blockers` is empty (C0/UC-4-E12).
- **UC-4-EC2**: the orchestrator's own cwd is inside the worktree — if the worktree is not the session's launch directory it must leave first (step 4), or its own process makes `worktree remove` fail; if it IS the launch directory it cannot leave, and UC-4-A9 governs.
- **UC-4-EC3**: "merged upstream" alone, for a worktree this session did not create, never authorizes removal (a live session's worktree was once deleted this way).
- **UC-4-EC4**: topic scope includes production but the release is not yet verified — the topic is not closed; closure does not run until release verification is done or decided (FR-1.1a).
- **UC-4-EC5**: an open follow-up that is neither done, decided nor filed — the topic is not closed; it is turned into a prompt first (FR-1.1b).
- **UC-4-EC6**: `origin/<base>` is stale locally — `git fetch origin <base>` runs before the ancestor check, so a merge made on the remote is seen; the ancestor check is also re-run immediately before any `-D`.
- **UC-4-EC7**: `git worktree prune` with other worktrees registered whose folders are missing — prune drops the metadata of EVERY such worktree, so siblings are NOT untouched. On the old-git path `git worktree prune --dry-run -v` must list only this path before prune runs (UC-4-A3, UC-4-E15). On git 2.17+, `git worktree remove` already handles its own metadata and the dry-run requirement does not apply.
- **UC-4-EC8**: closing message content — exactly one short paragraph; no bullet list of leftovers; states issue closures and verification location.
- **UC-4-EC9**: an unattended run never runs destructive cleanup — no `git worktree remove`, no `rm -rf`, no `git branch -d/-D`, no push or remote-branch delete — regardless of whether every check would pass (cleanup needs an interactive session, C0, P). Decisions go to `## Blockers` (or the project's tracker, UC-2-A4); the next interactive session performs closure.
- **UC-4-EC10**: `git worktree list --porcelain` — the first entry is the main worktree; on the old-git path the removal target is the entry matching the topic's path verbatim, never the first entry.
- **UC-4-EC11**: old-git path with a target that is a symlink, has a trailing slash, is relative, or contains a glob or unexpanded variable — the `rm -rf --` is not run; a prompt follows.

### Data Requirements
- **Input**: topic branch names, worktree path, base name, session-created marker, git version
- **Output**: removed worktree, deleted branches, closing paragraph
- **Side Effects**: `git fetch origin <base>`, `git worktree remove/prune`, `git branch -d/-D`; merge/push to base and remote-branch delete only as user-picked prompt options with `SDLC_ALLOW_GIT_GUARD=1`

---

## UC-5: Delivery — install.sh Installs the Rule

**Actor**: `install.sh`; Developer
**Preconditions**: `src/rules/topic-closure.md` exists; `manifests/owned-files.txt` lists `rules/topic-closure.md` under `owns`
**Trigger**: developer runs `install.sh` (into `~/.claude`, or a sandbox `HOME` in tests)

### Primary Flow (Happy Path)
1. Fresh HOME with no prior install.
2. `install.sh` reads the manifest and copies each owned file, including `rules/topic-closure.md`.
3. `~/.claude/rules/topic-closure.md` exists and is byte-identical to `src/rules/topic-closure.md` (AC-2).
4. `install.sh`'s summary reports 6 rules, counted from the manifest's owned rule entries (the five existing rules plus `topic-closure.md`), ignoring any user-owned rule files present in `~/.claude/rules/`.

**Postconditions**: the rule is installed; the memory-layer receipt reflects the install.

### Alternative Flows
- **UC-5-A1: upgrade over a hand-made copy** — `~/.claude/rules/topic-closure.md` exists with different content. `install.sh` backs the hand-made copy up under `backup-*/rules/` and then overwrites it with the plugin's version (installer-owned, FR-5.2; AC-2). The backup holds the pre-overwrite content.
- **UC-5-A2: re-run with an identical copy** — idempotent; the file remains identical, no error.
- **UC-5-A3: upgrade from a prior version that did not own the file** — the file is now in the manifest; first run after upgrade installs it and refreshes it on every later run.
- **UC-5-A4: user-owned rule file present** — `~/.claude/rules/mine.md` (not in the manifest) survives an upgrade untouched and is not counted in the "6 rules" report.

### Error Flows
- **UC-5-E1: manifest lacks the entry** — the manifest validator exits non-zero (seeded-fixture check, AC-1, AC-6, NFR-3).
- **UC-5-E2: `src/rules/topic-closure.md` missing** — the validator/test exits non-zero on the seeded fixture (AC-6); install does not silently succeed with a missing source.
- **UC-5-E3: target `~/.claude/rules/` not writable** — `install.sh` reports the failure for that file; it does not report success.

### Edge Cases
- **UC-5-EC1**: a developer's local edits to the installed copy are overwritten on the next run (accepted: file is installer-owned); the previous content is recoverable from `backup-*/rules/`.
- **UC-5-EC2**: the transition — the hand-made `~/.claude/rules/topic-closure.md` is overwritten (backed up first) once the installer owns it; no duplicate copy remains. Its maintenance note says to delete the hand-made file once the plugin ships the rule, which the overwrite accomplishes.
- **UC-5-EC3**: backup retention. The overwrite in UC-5-A1 creates a `backup-YYYYMMDD-HHMMSS` directory, and old ones are pruned after `SDLC_KEEP_BACKUPS` (default 5) newer ones. One helper, `backup_keep_count`, serves both the pruner and the "replacing a file this installer did not place" notice, so the notice never promises a backup that pruning deleted. Digits only, at most 4 digits, normalised with base 10: `0`, `00` or `000` means never prune (opt-out); a non-numeric or over-long value (including a zero-padded one of 5 or more digits such as `00005`, rejected by the length rule before normalising) also means never prune. The backup just created is never deleted (FR-5.6, MEDIUM-1).

### Data Requirements
- **Input**: manifest, rule source, target HOME
- **Output**: installed rule file
- **Side Effects**: file write under `~/.claude/rules/`

---

## UC-6: Delivery — Session-Start Drift Check Covers the Rule

**Actor**: Session-start hook (`session:start:spine`); Developer
**Preconditions**: memory layer was installed by an earlier `install.sh`; the plugin loaded in the session now ships `rules/topic-closure.md`
**Trigger**: `SessionStart` (start, `resume`, `compact`)

### Primary Flow (Happy Path)
1. Developer updates the plugin (4.12.0) but has not re-run `install.sh`; `~/.claude/rules/topic-closure.md` is missing.
2. The hook's content drift check compares installed memory-layer files against the plugin's owned files.
3. It finds the rule missing and emits the existing stale-memory-layer warning in `additionalContext`, naming `rules/topic-closure.md (missing)` (FR-5.3, AC-3).
4. Developer re-runs `install.sh`; the next session start emits no warning.

**Postconditions**: warning present while stale; absent once current.

### Alternative Flows
- **UC-6-A1: installed copy differs** — file exists with different content (e.g. hand-made); warning emitted, naming `rules/topic-closure.md` as differing (AC-3).
- **UC-6-A2: identical copy** — silent; `additionalContext` carries no stale-memory-layer line from this check (AC-3).
- **UC-6-A3: plugin-only install** (no memory layer, no receipt, `install.sh` never run) — silent; no warning, no error; consistent with existing drift behaviour.

### Error Flows
- **UC-6-E1: installed rules directory unreadable or file malformed/oversized** — the check fails open: no warning, no throw, `SessionStart` is not delayed or blocked (NFR-4).
- **UC-6-E2: plugin's own copy of the rule absent** — nothing to compare; silent, no throw.

### Edge Cases
- **UC-6-EC1**: the rule differs and the existing version-drift or project-scope line also fires — all lines are emitted independently through the shared `capBlock` budget; one does not suppress another.
- **UC-6-EC2**: after `install.sh` re-run the next `compact`/`resume` is also silent (no stale cache of the previous result).

### Data Requirements
- **Input**: installed rule file, plugin rule file, receipt
- **Output**: zero or one warning line
- **Side Effects**: none (read-only)

---

## UC-7: Delivery — Uninstall Removes the Rule

**Actor**: `install.sh` (uninstall mode); Developer
**Preconditions**: `~/.claude/rules/topic-closure.md` installed; manifest lists it
**Trigger**: developer runs the uninstall path

### Primary Flow (Happy Path)
1. `install.sh` uninstall iterates manifest-listed files.
2. It removes `~/.claude/rules/topic-closure.md`.
3. Files not in the manifest (including any user-owned rule file such as `rules/mine.md`) remain.

**Postconditions**: the rule file is absent; other user-owned rules untouched.

### Alternative Flows
- **UC-7-A1: copy was hand-edited or hand-made** — still removed, because removal is scoped to manifest entries, not content.
- **UC-7-A2: only the manifest-listed topic-closure file remains from a partial install** — removed without error.

### Error Flows
- **UC-7-E1: file already absent** — no error; uninstall continues.

### Edge Cases
- **UC-7-EC1**: removal never uses a glob; a user-owned rule file such as `~/.claude/rules/mine.md` (not in the manifest) survives both upgrade and uninstall.

### Data Requirements
- **Input**: manifest
- **Output**: file removed
- **Side Effects**: deletion under `~/.claude/rules/`

---

## UC-8: Release 4.12.0 Delivered via Marketplace Version

**Actor**: Maintainer; Developer (installs)
**Preconditions**: all slices merged; repo `## Release` procedure available
**Trigger**: maintainer releases

### Primary Flow (Happy Path)
1. Version is bumped to 4.12.0 (minor) in all version-bearing files per the `## Release` procedure (FR-5.5).
2. Release consistency validators pass (AC-8).
3. After release, the maintainer's `claude plugin update` followed by `claude plugin list` shows 4.12.0.
4. Next session start, if `install.sh` has not been re-run, shows the stale-memory-layer warning (UC-6); after re-run, silent.

**Postconditions**: 4.12.0 live; delivery confirmed on the maintainer's machine.

### Alternative Flows
- **UC-8-A1: machine not yet updated** — `claude plugin list` still shows the old version; update step is performed; delivery is not declared confirmed until the new version shows.

### Error Flows
- **UC-8-E1: version mismatch across version-bearing files** — release consistency validator exits non-zero; the release does not proceed.
- **UC-8-E2: `claude plugin list` shows an old version after update** — delivery is not confirmed; it is reported in full (non-compressible), not as an owed list.

### Edge Cases
- **UC-8-EC1**: AC-9 (live behavioural check) runs outside CI; CI green does not establish prompt/closure behaviour.

### Data Requirements
- **Input**: version number
- **Output**: tagged/marketplace version 4.12.0
- **Side Effects**: release commit and tag per the repo procedure

---

## UC-9: Context Budget and Pointers

**Actor**: Maintainer; CI (`validate-context-budget.js`, `ci-parity.js`)
**Preconditions**: one-line pointers added to `src/claude.md`, `skills/merge-ready`, `skills/develop-feature` and `src/rules/error-recovery.md` only (FR-5.4); `skills/implement-slice/SKILL.md` is unchanged; `AskUserQuestion` is added to the `allowed-tools` of `skills/merge-ready` and `skills/develop-feature`
**Trigger**: CI or maintainer runs `node scripts/ci/validate-context-budget.js --report`

### Primary Flow (Happy Path)
1. Each pointer is a single line referencing `rules/topic-closure.md`; substance stays in the rule file (Design Decision 1). The `error-recovery.md` pointer states that the Rule 4 prompt applies in an interactive session only; unattended runs and subagents record the decision under `## Blockers` only.
2. The budget report passes with all components at or under their ceilings (AC-4).
3. `ci-parity.js` stays green (NFR-2, AC-5).

**Postconditions**: pointers present in the four files; `skills/implement-slice/SKILL.md` byte-identical to its pre-feature content; `AskUserQuestion` present in `merge-ready` and `develop-feature` `allowed-tools`; budgets pass; parity green.

### Alternative Flows
- **UC-9-A1: a pointer pushes a component over its byte ceiling** — e.g. merge-ready at 44766/45000 or develop-feature at 32875/33000. The report fails. Resolution is either a shorter pointer or a deliberate, recorded ceiling decision with a reason (NFR-1, AC-4); substance is never moved into the skill to compensate.

### Error Flows
- **UC-9-E1: a pointer is missing from one of the four files, or `AskUserQuestion` is missing from `merge-ready` or `develop-feature` `allowed-tools`** — the validator exits non-zero on the seeded fixture (AC-5, AC-6). Without the tool in `allowed-tools` the skill could not issue the prompts UC-1 requires.
- **UC-9-E2: pointer duplicates rule substance** — a review/validator finding; the pointer must stay a one-line reference.

### Edge Cases
- **UC-9-EC1**: `skills/implement-slice/SKILL.md` must stay byte-identical; any edit there (pointer, `allowed-tools`, wording) is a defect, since its `### Next` continuation line is exempt from prompting (UC-1-E4). The check compares it against its pre-feature content and fails on any difference.
- **UC-9-EC2**: the `src/claude.md` pointer must not disturb Phase 0 Triage text, so `develop-feature` parity stays identical (NFR-2).

### Data Requirements
- **Input**: four pointer lines; two `allowed-tools` additions; byte ceilings
- **Output**: budget and parity pass/fail
- **Side Effects**: none

---

## Rule-Content Coverage (AC-7)

A content test must assert that the rule text states: every check C1 to C4 (including the `lsof` cwd, `lsof +D`, marker, `git worktree remove`, `-d`/`-D` conditions), the unattended and subagent exception (`AskUserQuestion` not called, `## Blockers`), the OPOS precedence, the "4 questions per call" batching, and the "(Recommended)" first-option convention. Derived from UC-1, UC-2, UC-4.

## Counts

| Class | Count |
|---|---|
| Primary | 9 (UC-1 to UC-9) |
| Alternative | 30 (UC-1: 4, UC-2: 4, UC-3: 2, UC-4: 9, UC-5: 4, UC-6: 3, UC-7: 2, UC-8: 1, UC-9: 1) |
| Error | 32 (UC-1: 4, UC-2: 2, UC-3: 1, UC-4: 15, UC-5: 3, UC-6: 2, UC-7: 1, UC-8: 2, UC-9: 2) |
| Edge | 29 (UC-1: 4, UC-2: 3, UC-3: 2, UC-4: 11, UC-5: 3, UC-6: 2, UC-7: 1, UC-8: 1, UC-9: 2) |
