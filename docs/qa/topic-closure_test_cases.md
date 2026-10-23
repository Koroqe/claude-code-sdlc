# Test Cases: Topic Closure — Prompted Decisions and a Finished Topic

> Based on [PRD](../PRD.md) — Section 17 and [Use Cases](../use-cases/topic-closure_use_cases.md)

---

## 1. Testing Approach and Test-Kind Classification

This feature has no UI, no server and no database. It is one memory-layer rule (`src/rules/topic-closure.md`), one-line pointers in four existing files, and delivery wiring (manifest, `install.sh`, the session-start drift check, release 4.12.0). The rule's behaviour is model-followed, so verification splits three ways.

- **STATIC** — hermetic Node execution with zero LLM invocation: the new `scripts/ci/validate-topic-closure.js`, the existing validators, `tests/hooks/test-install-messaging.js` (sandbox `HOME`), `tests/hooks/test-session-start-spine.js` (temp `HOME`, temp project dir). Runs in CI via `node scripts/ci/ci-parity.js` and `node tests/hooks/run-tests.js`.
- **BEHAVIORAL** — a real or headless Claude Code run (`claude -p`, or an interactive session) against a throwaway repository. Costs tokens, runs outside CI, like `scripts/eval/`. Each case carries a procedure that can be executed as written. A green CI run does not establish any of these (UC-8-EC1).
- **LIVE** — needs the maintainer's real client or machine (real `AskUserQuestion`, the real `~/.claude`, the published marketplace). Outside CI.

There is no FIXTURE-labelled case in this document. In this repository FIXTURE means "invoke one named subagent against a committed input and inspect its output" (`scripts/ci/validate-fixture-manifest.js` reads the Kind column, third cell, for the exact token `FIXTURE`). This feature invokes no agent under test, so no row below uses that token and `tests/fixtures/manifest.json` needs no entry for this document (TC-5.8 proves the validator still passes). The two seeded broken inputs of FR-5.8(d) are validator fixtures, a different thing; they are exercised by STATIC cases TC-5.2 and TC-5.3. `validate-red-phase-contract.js` does not constrain QA documents (it was searched for `qa` and `test_cases`; no match).

**Conventions**
- Table shape for every case: `ID | Covers | Kind | Test Case | Expected`. Kind is always the third cell.
- "Rule" means `src/rules/topic-closure.md`. "Validator" means `scripts/ci/validate-topic-closure.js`.
- Use-case ids are written in full class-suffixed form (UC-n, UC-n-An, UC-n-En, UC-n-ECn) everywhere.
- Pinned problem counts are written `N1`, `N2` and are measured by running the validator against the committed seeded fixture and recorded in the CI step; they are not assumed in this document (CLAUDE.md: counts measured, not assumed).
- Throwaway repository for BEHAVIORAL closure cases ("closure rig"): a bare repo as `origin` (base `main`), a clone as the main checkout, and `git worktree add ../wt-<slug> -b feat/<slug>` created by the session under test, with `.claude/scratchpad.md` naming the branch (the durable "created by this session" source). Run `git fetch` against it before each case.
- Old-git cases (git older than 2.17) use a `git` shim earlier in `PATH` that reports `git version 2.16.0` and exits non-zero for `worktree remove`, delegating everything else to the real git. Missing-`lsof` cases use a `PATH` that contains no `lsof`.

---

## 2. Rule Content — Required Literals (STATIC, validator step (a))

Each row is asserted by the Validator against `src/rules/topic-closure.md`. A missing literal is one problem per literal.

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-2.1 | UC-1 | STATIC | Rule text contains `AskUserQuestion`, the `(Recommended)` first-option convention, and the "at most 4 questions per call" statement | All three literals present; validator reports no problem for them |
| TC-2.2 | UC-1-A1, UC-1-EC2 | STATIC | Rule states that more than 4 items are asked 4 at a time, most consequential first, remainder in a following call after answers are acted on | Batching literal present, including the "remainder in a following call" clause |
| TC-2.3 | UC-1-A4 | STATIC | Rule contains the one-line full-disclosure statement: blockers, failures and bad news are given in full, in the question or the summary, never in a trailing list | Statement present verbatim; no reference to a user-level rule file |
| TC-2.4 | UC-1-E1, UC-4-E10 | STATIC | Rule contains the FR-2.9 fallback paragraph: `AskUserQuestion` unavailable or refused falls back to `## Blockers` and `## Status: blocked`, final message says once why it could not prompt, no trailing "owed" list, no cleanup for pending items | Paragraph literals present (`## Blockers`, `## Status: blocked`, the once-and-plainly statement) |
| TC-2.5 | UC-2 | STATIC | Rule states that unattended runs and subagents do not call `AskUserQuestion`, record decisions under `## Blockers` with options and a recommendation, set `## Status: blocked`, and subagents return decisions to the orchestrator | All literals present |
| TC-2.6 | UC-2-A4, UC-4-A5 | STATIC | Rule contains the generic own-tracker clause (a project that forbids the scratchpad or defines its own tracker records decisions there) and names the marker `.claude/agents/company/chief-of-staff.md` as the example, with the steward's permission tiers governing cleanup | Clause present; rule does not name `opos-precedence.md` |
| TC-2.7 | UC-1-E4, UC-1-EC4 | STATIC | Rule states the `### Next` exemption: the "Continuing to Slice N" line is a continuation log line, never prompted, and no prompt is issued before `/merge-ready`'s verdict except at Rule 4 | `### Next` literal and the never-prompted statement present |
| TC-2.8 | UC-1-E3 | STATIC | Rule states that in interactive sessions it turns "Owed / Needs attention / follow-ups for you" endings of `/merge-ready`'s verdict and Release step and of `/develop-feature`'s final report into prompts, while gate tables and failure details still print in full | Precedence statement present |
| TC-2.9 | UC-4-E12, UC-4-EC9 | STATIC | C0 preconditions: closure runs only in an interactive session, only with `## Blockers` empty and no decision pending; never unattended; scratchpad is gitignored and removal deletes it | Interactive-only and Blockers-empty literals present |
| TC-2.10 | UC-4-A1, UC-4-E11, UC-4-EC6 | STATIC | C1: `git fetch` before the check, `merge-base --is-ancestor`, and the release/cherry-pick alternative with the tree comparison stated | `git fetch`, `merge-base --is-ancestor`, tree-comparison literals present |
| TC-2.11 | UC-4-E1, UC-4-E14, UC-4-EC1 | STATIC | C2: `git status --short`, `git status --short --ignored` (build output fine), `git log <branch> --not --remotes` | All three command literals present |
| TC-2.12 | UC-4-E2, UC-4-E4, UC-4-E13, UC-4-EC3 | STATIC | C3: `lsof -a -d cwd`, "lsof unavailable = check failed", session-created-the-worktree-or-asked-to-finish, never removed on "merged upstream" alone | `lsof -a -d cwd`, unavailable-means-failed, created-by-session, merged-upstream literals present |
| TC-2.13 | UC-4-E3 | STATIC | The `IN-USE-BY-CLAUDE-SESSION.txt` marker is stated as a secondary signal only, `lsof` primary | `IN-USE` marker literal present with the secondary-signal wording |
| TC-2.14 | UC-4-E5 | STATIC | `git worktree remove` is stated without `--force`; refusal means stop and ask, no `rm -rf` fallback on the 2.17+ path | `git worktree remove` literal present; `--force` appears only in a "never" context |
| TC-2.15 | UC-4-A3, UC-4-E6, UC-4-EC10, UC-4-EC11 | STATIC | Old-git path: version gate below 2.17, path verbatim from `git worktree list --porcelain` (never the first entry), fresh `lsof +D`, marker check, `rm -rf --` with an absolute path and the no-glob/no-variable/no-trailing-slash/not-a-symlink conditions, never retry harder | `lsof +D`, `rm -rf --`, `--porcelain`, `2.17` and the four-condition literals present |
| TC-2.16 | UC-4-E15, UC-4-EC7 | STATIC | `git worktree prune --dry-run -v` is required on the old-git path only, and prune runs only if it lists just this path | `prune --dry-run -v` literal present, scoped to the old-git path |
| TC-2.17 | UC-4-A2, UC-4-A7, UC-4-E7 | STATIC | Branches: `git branch -d`; `-D` only when `-d` refuses solely because HEAD is elsewhere and the ancestor check is re-run immediately before; a branch with commits on no base is never deleted without asking; per-branch evaluation | `branch -d`, `-D`, re-check, and ask-first literals present |
| TC-2.18 | UC-4-A6, UC-4-A8, UC-4-E9 | STATIC | FR-2.10: merging/pushing to base and deleting a remote branch are prompt-only, run after the pick with `SDLC_ALLOW_GIT_GUARD=1`, never unattended; the Release step's own push is carved out as unchanged | `SDLC_ALLOW_GIT_GUARD=1`, prompt-only, and the `## Release` carve-out literals present |
| TC-2.19 | UC-4-A9, UC-4-EC2 | STATIC | Launch-directory prompt: never removed from inside; options "Remove now with `git -C <main checkout> worktree remove <path>`" and "Leave it for removal from the main checkout"; own-process-tree clause (only ancestors of the current shell may show in `lsof`, any other process still fails C3) | Both option texts and the own-process-tree clause present |
| TC-2.20 | UC-4, UC-4-EC8 | STATIC | Rule states the closure order (leave the worktree, remove, prune where applicable, delete branches, do not ask again) and the closing message as one short paragraph, no leftovers list | Order and one-paragraph literals present |

## 3. Rule Content — Forbidden Literals and Size (STATIC, validator step (b))

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-3.1 | UC-5-EC2 | STATIC | Rule contains none of `this Mac`, `~/Documents`, `Projects.nosync`, `Deliberately NOT listed`, `delete this file` (the hand-made file's maintenance note must not ship, so the installer overwrite leaves no stale instruction) | Zero occurrences of each; one problem per occurrence if seeded |
| TC-3.2 | UC-5-EC2 | STATIC | Rule contains no `/Users/` path and no reference to `output-shaping.md` or `opos-precedence.md` | Zero matches |
| TC-3.3 | UC-9-A1 | STATIC | `wc -c src/rules/topic-closure.md` | At most 4800 bytes (FR-5.1); the 5000 ceiling is TC-6.2 |

## 4. Wiring and Pointers (STATIC, validator step (c))

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-4.1 | UC-5-E1 | STATIC | `manifests/owned-files.txt` lists `rules/topic-closure.md` under `owns` (not under `legacy`). There is no `validate-manifest.js`: the manifest check is `validate-topic-closure.js`'s FR-5.2 arm plus `install.sh` `load_manifest` | Entry present in `owns`; `node scripts/ci/validate-topic-closure.js` exit 0 |
| TC-4.2 | UC-5-E2 | STATIC | `src/rules/topic-closure.md` exists and is non-empty | File present; Validator reports no missing-source problem |
| TC-4.3 | UC-9 | STATIC | `src/claude.md` carries one pointer to `rules/topic-closure.md` in the Run to Completion section, as a bullet | Exactly one bullet naming the rule, inside that section |
| TC-4.4 | UC-3 | STATIC | `src/rules/error-recovery.md` Rule 4 carries the pointer "record it first, then ask with AskUserQuestion" | Pointer present in the Rule 4 section; existing Rule 4 text otherwise unchanged |
| TC-4.5 | UC-1-E3 | STATIC | `skills/merge-ready/SKILL.md` carries the pointer immediately after the "Finalization: Release" section | Pointer present at that position |
| TC-4.6 | UC-1-E3 | STATIC | `skills/develop-feature/SKILL.md` carries the pointer on the final-verdict line | Pointer present on that line; Phase 0 Triage text unchanged |
| TC-4.7 | UC-1-E4 | STATIC | `git diff --exit-code origin/main -- skills/implement-slice` | Empty diff: byte-identical (its `### Next` line stays exempt) |
| TC-4.8 | UC-9-E2 | STATIC | Each pointer is a single line that names the rule and restates none of its substance (no `lsof`, `rm -rf`, `branch -D` literals in any pointer) | One line per file; none of the substance literals appear outside the rule |
| TC-4.9 | UC-9-EC2 | STATIC | `node scripts/ci/validate-triage-parity.js` | Exit 0: `src/claude.md` and `develop-feature` Phase 0 text still identical |

## 5. Validator Behaviour and Seeded Failures (STATIC, validator step (d), NFR-3)

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-5.1 | UC-9 | STATIC | `node scripts/ci/validate-topic-closure.js` against the real repository | Exit 0, no problems, output states how many literals and wiring points were checked |
| TC-5.2 | UC-1-E1 | STATIC | `validate-topic-closure.js --root tests/fixtures/topic-closure/bad-missing-fallback --expect-failure --expect-problems N1` (fixture is a copy with the FR-2.9 paragraph removed) | Exit 0 only because the failure was expected; exactly N1 problems, N1 measured by running it, naming the missing fallback literals |
| TC-5.3 | UC-5-E1, UC-9-E1 | STATIC | `... bad-unwired --expect-failure --expect-problems N2` (fixture has the manifest entry removed and a pointer removed) | Exactly N2 problems: one for the manifest entry, one per missing pointer; a changed count fails the run |
| TC-5.4 | UC-5-E2 | STATIC | Throwaway root (temp copy, not committed) with `src/rules/topic-closure.md` deleted | Non-zero exit with a missing-source problem; no crash or silent pass |
| TC-5.5 | UC-9 | STATIC | Anti-vacuity: run against an empty root, and against a rule file that is empty | Non-zero exit in both; a validator that checks zero literals does not pass |
| TC-5.6 | UC-9 | STATIC | The Validator is invoked by a step in `.github/workflows/ci.yml` and both seeded fixtures run there with `--expect-failure --expect-problems`; `node scripts/ci/ci-parity.js --check-coverage`. Falsification: remove the new ci.yml steps locally, run `--check-coverage`, then restore the file | Coverage passes (20 validators). Falsified at implementation: with the steps removed it exited 1 with `validate-topic-closure.js is never referenced in .github/workflows/ci.yml`; with the file restored it passed again. (Restore from a backup copy: `git checkout -- .github/workflows/ci.yml` reverts to HEAD and also drops uncommitted step additions.) |
| TC-5.7 | UC-9 | STATIC | `node scripts/ci/ci-parity.js` (the sweep, not a bare validator loop) | Exit 0 |
| TC-5.8 | UC-9 | STATIC | `node scripts/ci/validate-fixture-manifest.js` | Exit 0; this document contributes zero FIXTURE ids and needs no manifest entry; the doc-count floor still met (11 documents) |

## 6. Context Budget (STATIC)

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-6.1 | UC-9 | STATIC | `node scripts/ci/validate-context-budget.js --report` | Exit 0; every component at or under its ceiling |
| TC-6.2 | UC-9-A1 | STATIC | Temp copy with the rule padded past 5000 bytes | Budget validator exits non-zero naming the rule's ceiling (5000 B) |
| TC-6.3 | UC-9-A1 | STATIC | Temp copy with `src/claude.md` padded past 23500 bytes | Budget validator exits non-zero naming the 23500 B ceiling |
| TC-6.4 | UC-9-EC1 | STATIC | Report line for `skills/implement-slice` against baseline 23460/23500; merge-ready against 44766/45000; develop-feature against 32875/33000 | implement-slice unchanged at 23460; merge-ready growth about 152 B and still at or under 45000; develop-feature growth about 51 B and still at or under 33000 |
| TC-6.5 | UC-9 | STATIC | `hooks/hooks.json` id count, `agents/` and `skills/` counts; `tests/hooks/test-guards-cross.js` | 12 hook ids, 16 agents, 8 skills: no new id (NFR-1) |
| TC-6.6 | UC-9-A1 | STATIC | `git diff origin/main -- scripts/ci/validate-context-budget.js` | Only the two new ceilings (rule 5000, `src/claude.md` 23500) changed, each with a reason comment; no other ceiling raised |

## 7. Installer Sandbox (STATIC, `tests/hooks/test-install-messaging.js` harness)

Every case runs `install.sh` with a temp `HOME`; nothing touches the real `~/.claude`.

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-7.1 | UC-5 | STATIC | Fresh HOME, run `install.sh` | `$HOME/.claude/rules/topic-closure.md` exists and `cmp`s byte-identical to `src/rules/topic-closure.md`; the receipt records it among installed files |
| TC-7.2 | UC-5, UC-5-A4 | STATIC | Fresh HOME with a user-owned `rules/mine.md` already present, run install | Summary reads "1 workflow file + 6 rules" (count from the manifest's owned rules, not `ls`), so `mine.md` is not counted |
| TC-7.3 | UC-5-A1, UC-5-EC1, UC-5-EC2 | STATIC | HOME with a different hand-made `rules/topic-closure.md`, run install | File overwritten with the plugin's version; `backup-*/rules/topic-closure.md` holds the pre-overwrite content byte for byte; exactly one copy remains; the output carries the notice "replacing a file this installer did not place" naming `rules/topic-closure.md` (security MEDIUM-7) |
| TC-7.4 | UC-5-A2 | STATIC | Run install twice | Second run exits 0; file still identical; no error |
| TC-7.5 | UC-5-A3 | STATIC | Seed a prior-version install (five rules, receipt from the previous version, no topic-closure file), run install | File now installed; summary reports 6 |
| TC-7.6 | UC-5-A4, UC-7-EC1 | STATIC | `rules/mine.md` with known content, run install | `mine.md` byte-identical afterwards (`backup_existing` copies `rules/` wholesale by design, so a backup may hold it) |
| TC-7.7 | UC-5-E3 | STATIC | `$HOME/.claude/rules` made non-writable (skipped where the runner is root), run install | Failure reported for that file; the run does not print success for it |
| TC-7.8 | UC-7 | STATIC | After TC-7.1 with `mine.md` present, run `install.sh --uninstall` | `rules/topic-closure.md` gone; `mine.md` still present |
| TC-7.9 | UC-7-A1 | STATIC | Hand-edit the installed rule, run uninstall | Still removed (removal is manifest-scoped, not content-scoped) |
| TC-7.10 | UC-7-A2 | STATIC | Partial install: only `rules/topic-closure.md` exists under `rules/` | Removed without error |
| TC-7.11 | UC-7-E1 | STATIC | Uninstall when the rule file is already absent | Exit 0; uninstall continues with the remaining files |
| TC-7.12 | UC-7-EC1 | STATIC | Uninstall with `mine.md` and an unrelated `rules/other.md` present | Both survive; static check that the uninstall path iterates manifest entries and never globs `rules/*` |
| TC-7.13 | UC-5 | STATIC | Grep `install.sh` and `README.md` for the message and count wording | `rule_count` is derived from `MANIFEST_OWNS` (no `ls ... rules/*.md` count). The help text and the banner necessarily hard-code 6, because the banner prints before `load_manifest`; every message reads six, none reads five (AC-12) |

## 8. Session-Start Drift Check (STATIC, `tests/hooks/test-session-start-spine.js`)

The test's OWNED list is derived from `manifests/owned-files.txt` (TC-8.9). Temp `HOME` with a seeded `.sdlc-receipt`; plugin root is the repository.

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-8.1 | UC-6 | STATIC | Installed memory layer current except `rules/topic-closure.md` deleted | `additionalContext` carries the stale-memory-layer warning naming `rules/topic-closure.md (missing)` |
| TC-8.2 | UC-6-A1 | STATIC | Installed `rules/topic-closure.md` has different content | Warning names `rules/topic-closure.md` as differing |
| TC-8.3 | UC-6-A2 | STATIC | Every owned file identical to the plugin's | No stale-memory-layer line from this check |
| TC-8.4 | UC-6-A3 | STATIC | Plugin-only install: no receipt, no `~/.claude/rules`, `install.sh` never run | Silent; no warning, no throw |
| TC-8.5 | UC-6-E1 | STATIC | Rules directory unreadable; separately, an oversized or binary installed rule file | Fail-open: exit 0, no throw, rest of the spine intact (NFR-4). A drift line is allowed for an unreadable or oversized installed file; it is not required |
| TC-8.6 | UC-6-E2 | STATIC | Plugin's own `rules/topic-closure.md` absent (temp plugin root) | Silent, no throw |
| TC-8.7 | UC-6-EC1 | STATIC | Rule differs while the version-drift line and the project-scope stale-install line also fire | All lines present independently through the shared `capBlock` budget; none suppresses another |
| TC-8.8 | UC-6-EC2 | STATIC | Warn, then copy the file in place (simulating `install.sh`), then a second invocation with the `compact` and `resume` sources | Second and third invocations are silent; no cached result |
| TC-8.9 | UC-6 | STATIC | Add a throwaway `owns` entry to a temp manifest copy and point the test at it | OWNED follows the manifest, the new missing entry is named; a hardcoded list would not notice |
| TC-8.10 | UC-6 | STATIC | `node tests/hooks/measure-latency.js` after the change | `session:start:spine` median still at or under 30 ms |

## 9. README, Doc Counts and Release (STATIC)

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-9.1 | UC-9 | STATIC | `node scripts/ci/validate-doc-commands.js` (`checkAssetCounts`) | Exit 0: README validator count and hook-test count match the repository after adding `validate-topic-closure.js` and any new test |
| TC-9.2 | UC-5 | STATIC | Grep README for "five rules" and "six rules" | The README says six; no stale "five" |
| TC-9.3 | UC-8 | STATIC | `node scripts/ci/validate-version-consistency.js` | Exit 0: `marketplace.json`, `plugin.json`, `install.sh` `VERSION` and the README badge agree |
| TC-9.4 | UC-8-E1 | STATIC | Temp copy with one of the four sources at a different version | Version-consistency validator exits non-zero; the release does not proceed |
| TC-9.5 | UC-8 | STATIC | `node scripts/ci/validate-release-readiness.js` at the derived version | Exit 0 for the target version; CHANGELOG entry for it present |
| TC-9.6 | UC-8 | STATIC | `git fetch origin main`, read `plugins[0].version` from `origin/main:.claude-plugin/marketplace.json`, compute the minor bump, compare with the repository's version | Equals 4.12.0 while origin/main advertises 4.11.2; if origin/main has moved, the derived number differs and all four sources are bumped to that number instead |
| TC-9.7 | UC-8 | STATIC | `node scripts/ci/ci-parity.js` after the version bump | Exit 0 |

---

## 10. BEHAVIORAL — Prompting, Unattended Paths and Rule 4

Setup common to this section: a throwaway project with the updated plugin loaded and the rule installed under `~/.claude/rules/` (or a sandbox `HOME`). "Prompt" means a recorded `AskUserQuestion` tool call in the transcript JSONL. Transcript assertions are done by scanning the session JSONL for `tool_use` blocks named `AskUserQuestion`.

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-10.1 | UC-1 | LIVE | Interactive session finishes a small `/develop-feature` with three open items (a follow-up issue, a user-only decision, an unfiled bug). Developer answers each | One `AskUserQuestion` call with 3 questions; each names its issue, PR or file; first option labelled `... (Recommended)`; option descriptions state consequences; answers acted on in the same turn; final message has no owed or needs-attention list (AC-9) |
| TC-10.2 | UC-1-A1 | BEHAVIORAL | Seed 6 open items of differing consequence | First call has 4 (the most consequential), answers acted on, second call has 2; never 6 or 5 in one call |
| TC-10.3 | UC-1-A2 | BEHAVIORAL | One open item is a credential only the user can supply | It is still asked, with options "I'll do it now", "Remind me via an issue", "Skip"; picking the issue option creates an issue and records its link; skip is recorded as a decision |
| TC-10.4 | UC-1-A3 | BEHAVIORAL | One unrelated failure already filed, nothing else open | No question for it; one line in the closing summary or nothing; no `AskUserQuestion` call at all |
| TC-10.5 | UC-1-A4 | BEHAVIORAL | A failing gate plus a follow-up | The failure text is given in full in the question text, option descriptions or the summary printed just before the prompt; never summarized, capped or moved to a trailing list |
| TC-10.6 | UC-1-E1 | LIVE | Run the same session with `AskUserQuestion` disallowed (`claude --disallowedTools AskUserQuestion`, or a client without the tool) and one open decision | Decision written under `## Blockers` with options and a recommendation; `## Status: blocked`; final message says once, plainly, why it could not prompt; no owed list; no worktree or branch removed (AC-10) |
| TC-10.7 | UC-1-E2 | BEHAVIORAL | Developer picks "leave it" for a follow-up | Honoured in the same turn: nothing filed or deleted; decision recorded where the item's state lives; run continues |
| TC-10.8 | UC-1-E3 | BEHAVIORAL | Run `/merge-ready` on a branch whose Release step reports one thing that did not ship, in an interactive session | The gate table and failure details print in full; the "did not ship" item arrives as a prompt, not as an Owed list |
| TC-10.9 | UC-1-E4 | BEHAVIORAL | Headless multi-slice run (`claude -p` driving `/develop-feature` on a plan of at least 4 slices) and scan the transcript | Zero `AskUserQuestion` calls before `/merge-ready`'s verdict (except a seeded Rule 4); every `### Next` line "Continuing to Slice N" is followed by the next slice, not a question |
| TC-10.10 | UC-1-EC1 | BEHAVIORAL | Complete topic with zero open items | No `AskUserQuestion` call; goes straight to closure |
| TC-10.11 | UC-1-EC2 | BEHAVIORAL | Exactly 4 open items, then exactly 5 | 4 items: one call with 4. 5 items: a call with 4 then a call with 1 |
| TC-10.12 | UC-1-EC3 | BEHAVIORAL | Two items where answering the first ("close issue and remove worktree") changes what the second means | Second question is asked only after the first answer is acted on and reflects the new state |
| TC-10.13 | UC-1-EC4 | BEHAVIORAL | (a) A bare one-file fix with no pipeline and one open item; (b) a multi-slice run mid-plan with no Rule 4 | (a) prompt appears at the end of the task. (b) no prompt of any kind while slices or gates remain pending; `stop:gate-evidence` behaviour unchanged |
| TC-10.14 | UC-2 | BEHAVIORAL | `claude -p` headless run ending with two open decisions | Zero `AskUserQuestion` calls; both decisions under `## Blockers` with options and a recommendation; `## Status: blocked`; full report; no cleanup performed |
| TC-10.15 | UC-2-A1 | BEHAVIORAL | A parallel-wave subagent hits a decision | Subagent does not write the scratchpad and does not prompt; its result carries the decision, options and recommendation to the orchestrator |
| TC-10.16 | UC-2-A2 | BEHAVIORAL | Interactive orchestrator receives the subagent decision from TC-10.15 | Asks it post-wave via `AskUserQuestion`, acts on the answer in the same turn |
| TC-10.17 | UC-2-A3 | BEHAVIORAL | New interactive session starts with `## Blockers` non-empty from TC-10.14 | Blockers are asked first, before any new work; answered entries cleared; `## Status` reset when `## Blockers` is empty |
| TC-10.18 | UC-2-A4 | BEHAVIORAL | Repo containing `.claude/agents/company/chief-of-staff.md` and a rule that forbids `.claude/scratchpad.md`; unattended run with a decision | Decision goes to the project's tracker (task issue) with options and a recommendation; no `.claude/scratchpad.md` created; no Triage or pipeline artifacts created |
| TC-10.19 | UC-2-E1 | BEHAVIORAL | Scan the transcripts of TC-10.14 and of subagents in TC-10.15 | Zero `AskUserQuestion` calls in either |
| TC-10.20 | UC-2-E2 | BEHAVIORAL | A parallel-wave subagent's scratchpad write is refused by `pre:agent:isolation-guard` | Subagent returns the decisions in its result; nothing written to `CHANGELOG.md` or any other file; no decision lost |
| TC-10.21 | UC-2-EC1 | BEHAVIORAL | Unattended run finishing with no open decision, in a worktree where every closure check would pass | `## Status` not blocked; no `git worktree remove`, no `rm -rf`, no `git branch -d/-D`, no push |
| TC-10.22 | UC-2-EC2 | BEHAVIORAL | Next session answers one of two blockers with "leave it" | That entry removed and the decision recorded; `## Status` stays blocked until `## Blockers` is empty |
| TC-10.23 | UC-2-EC3 | BEHAVIORAL | Scheduled run in the main checkout with an open decision | Closure removal skipped; the decision goes to `## Blockers` |
| TC-10.24 | UC-3 | BEHAVIORAL | Interactive run forced into Rule 4 (a slice that needs an unplanned dependency) | Decision first written under `## Blockers` with `## Status: blocked`, then asked via `AskUserQuestion` with every option and trade-off; after the answer the blocker is cleared, status reset, plan resumes in the same turn |
| TC-10.25 | UC-3-A1 | BEHAVIORAL | Same Rule 4 unattended, and in a subagent | No prompt; decision stays under `## Blockers`; subagent returns it for post-wave presentation |
| TC-10.26 | UC-3-A2 | BEHAVIORAL | Plan already specifies the dependency in a slice's `Changes:` | Not Rule 4: no prompt, implemented |
| TC-10.27 | UC-3-E1 | BEHAVIORAL | Developer answers "stop" (or an answer contradicting the plan) | `## Status: blocked` kept; answer recorded under `## Blockers`; turn ends; no retry beyond the Rule 4 cost |
| TC-10.28 | UC-3-EC1 | BEHAVIORAL | A Rule 4 with 6 options | Every option and its trade-off appears in question text or descriptions; none dropped |
| TC-10.29 | UC-3-EC2 | BEHAVIORAL | Rule 4 raised by a parallel-wave subagent | Presented by the orchestrator during post-wave collection, not mid-wave |

## 11. BEHAVIORAL — Topic Closure on a Real Worktree

Run each case in the closure rig (Section 1). Unless the case says otherwise: interactive session, `## Blockers` is `(none)`, decisions answered, `/merge-ready` Finalization and Release done, the worktree created by the session, git 2.17 or newer. Assertions use `git worktree list`, `git branch --list`, `ls`, and the session transcript.

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-11.1 | UC-4 | BEHAVIORAL | Topic merged to `origin/main`, tree clean, nobody inside | Order observed in the transcript: `git fetch origin main`, `merge-base --is-ancestor`, the C2 commands, `lsof -a -d cwd`, leave the worktree, `git worktree remove <path>` (no `--force`), `git branch -d`; the worktree path is gone and absent from `git worktree list`; no further question; closing message follows |
| TC-11.2 | UC-4-A1 | BEHAVIORAL | Content reached `main` through a release cherry-pick commit, so the branch is not an ancestor | Tree comparison performed and the commit named in the message; closure proceeds only because the trees are identical; with one differing path in the tree, closure does not proceed |
| TC-11.3 | UC-4-A2 | BEHAVIORAL | Branch is merged but `git branch -d` refuses only because HEAD is elsewhere | `merge-base --is-ancestor` re-run immediately before `git branch -D <branch>`, used for that branch only; with the re-run forced to fail, `-D` is not used and a prompt follows |
| TC-11.4 | UC-4-A3 | BEHAVIORAL | `git` shim reporting 2.16.0, failing `worktree remove` | Target taken verbatim from `git worktree list --porcelain`; fresh `lsof +D` empty; marker absent; path absolute, no trailing slash, no glob, not a symlink; one `rm -rf -- "<absolute path>"`; `git worktree prune --dry-run -v` run and prune executed only because it listed just this path |
| TC-11.5 | UC-4-A4 | BEHAVIORAL | Session in the main checkout, no worktree created, a merged local branch not checked out | Worktree steps skipped; the branch deleted with `-d`; closing message has no worktree-removed statement |
| TC-11.6 | UC-4-A5 | BEHAVIORAL | OPOS-marker repo whose steward forbids deleting branches without approval | The forbidden step becomes a decision prompt; prompting otherwise unchanged; no Triage or pipeline artifacts; tracking uses the project's tracker |
| TC-11.7 | UC-4-A6 | BEHAVIORAL | A remote topic branch exists, pushed by this session, merged | Deleting it is offered as an option with "(Recommended)" first; nothing is deleted before a pick; after the pick the delete runs with `SDLC_ALLOW_GIT_GUARD=1`; if declined, the remote branch remains |
| TC-11.8 | UC-4-A7 | BEHAVIORAL | Two topic branches, one merged, one with unique unmerged commits | The merged branch is closed (`-d`); the other is raised as a prompt; the sibling's failure does not block the first |
| TC-11.9 | UC-4-A8 | BEHAVIORAL | Topic not on the base; verdict MERGE READY | "Merge and push to main" offered, recommended; no merge or push before a pick; after the pick it runs with `SDLC_ALLOW_GIT_GUARD=1`, then `git fetch origin main`, C1 re-evaluated, closure continues; never in an unattended run |
| TC-11.10 | UC-4-A9 | LIVE | Launch the session with its launch directory inside the topic worktree, run to the closure point | Worktree is not removed from inside; prompt offers "Remove now with `git -C <main checkout> worktree remove <path>`; this session can do nothing further" and "Leave it". On the first, removal runs via the main checkout with `lsof` showing only the session's own process tree, then the closing message; with a second process whose cwd is inside, C3 fails and a prompt follows. Record the observed behaviour in the QA run notes: the PRD marks this as unmeasured and it must be measured before being relied on |
| TC-11.11 | UC-4-E1 | BEHAVIORAL | (a) An uncommitted tracked change; (b) a commit present on no base and on no remote | Nothing removed; prompt offers commit and push (push only after the pick), stash, discard with its cost, or leave |
| TC-11.12 | UC-4-E2 | BEHAVIORAL | A second shell with its cwd in the worktree | `lsof -a -d cwd` names it; worktree not removed; the process is named in the prompt |
| TC-11.13 | UC-4-E3 | BEHAVIORAL | Create `IN-USE-BY-CLAUDE-SESSION.txt` in the worktree with nothing running inside | Not removed; prompt names the marker. Conversely, with no marker but a live cwd process, still not removed |
| TC-11.14 | UC-4-E4 | BEHAVIORAL | A worktree the session did not create, branch merged upstream | Never removed; "merged upstream" does not authorize it |
| TC-11.15 | UC-4-E5 | BEHAVIORAL | `git worktree lock` the worktree | `git worktree remove` refuses; session stops and asks; no `--force`, no `rm -rf` fallback |
| TC-11.16 | UC-4-E6 | BEHAVIORAL | Old-git shim; a background process re-creates the directory after `rm -rf --` | Session stops and asks; no second, harder removal attempt |
| TC-11.17 | UC-4-E7 | BEHAVIORAL | Topic branch has 2 commits on no base | Never deleted without asking; the prompt lists the commits and offers push or PR, keep, delete with its cost |
| TC-11.18 | UC-4-E8 | BEHAVIORAL | Developer answers "leave it" for a failed check | Branches and worktree stay; closing message states what was left and the recorded decision; no owed list |
| TC-11.19 | UC-4-E9 | BEHAVIORAL | Remote topic branch pushed by someone else, or not merged | Deletion not recommended; prompt states the risk; with no pick nothing is deleted; when picked it still runs only after the pick with `SDLC_ALLOW_GIT_GUARD=1` |
| TC-11.20 | UC-4-E10 | BEHAVIORAL | `AskUserQuestion` disallowed and a closure check fails (dirty tree) | Failure recorded under `## Blockers` with options and a recommendation; nothing removed |
| TC-11.21 | UC-4-E11 | BEHAVIORAL | Branch neither an ancestor of `origin/main` nor content-identical | Nothing removed; the TC-11.9 merge prompt appears |
| TC-11.22 | UC-4-E12 | BEHAVIORAL | `## Blockers` non-empty (or a decision pending) with all other checks passing | Cleanup held: worktree and branches stay; closing message says decisions are recorded and cleanup is held until they are answered; `.claude/scratchpad.md` still exists afterwards |
| TC-11.23 | UC-4-E13 | BEHAVIORAL | Run with a `PATH` containing no `lsof` | C3 counted as failed; nothing removed; prompt offers "Leave it" and "I confirmed nothing is using it; remove it" |
| TC-11.24 | UC-4-E14 | BEHAVIORAL | Worktree holds an ignored local `.env` and an ignored `uploads/` file besides `node_modules` and `dist` | `git status --short --ignored` lists them; `node_modules` and `dist` are accepted; `.env` and `uploads/` are named in a prompt with copy out, discard with cost, leave; not removed |
| TC-11.25 | UC-4-E15 | BEHAVIORAL | Old-git shim, a second worktree registered whose folder is missing | `git worktree prune --dry-run -v` lists the other path; prune is not run; the other path is named in a prompt |
| TC-11.26 | UC-4-EC1 | BEHAVIORAL | Only `.claude/scratchpad.md` ignored in the worktree, once with `## Blockers` empty and once non-empty | Does not make `git status --short` non-empty; counts as regenerable only while `## Blockers` is empty (second case follows TC-11.22) |
| TC-11.27 | UC-4-EC2 | BEHAVIORAL | The session's shell is cd'd inside the worktree it created (not its launch directory) | It leaves first, then removes; a removal attempted from inside would fail, so none is attempted |
| TC-11.28 | UC-4-EC3 | BEHAVIORAL | Same as TC-11.14 with the branch demonstrably merged | Still not removed (a live session's worktree was once deleted this way) |
| TC-11.29 | UC-4-EC4 | BEHAVIORAL | Topic scope includes production, release not yet verified | Closure does not run until verification is done or decided |
| TC-11.30 | UC-4-EC5 | BEHAVIORAL | A follow-up neither done, decided nor filed | Turned into a prompt first; closure waits |
| TC-11.31 | UC-4-EC6 | BEHAVIORAL | Merge made on the remote only, local `origin/main` stale | `git fetch origin main` runs before the ancestor check so the merge is seen; the ancestor check is re-run immediately before any `-D` |
| TC-11.32 | UC-4-EC7 | BEHAVIORAL | (a) git 2.17+, a sibling worktree with a missing folder; (b) old-git shim, same sibling | (a) `git worktree remove` used; no standalone prune requirement; the sibling's metadata untouched. (b) prune does not run (TC-11.25) |
| TC-11.33 | UC-4-EC8 | BEHAVIORAL | Count the closing message | Exactly one short paragraph; no bullet list; states issue closures and where it was verified |
| TC-11.34 | UC-4-EC9 | BEHAVIORAL | Unattended run, every check passes | None of `git worktree remove`, `rm -rf`, `git branch -d/-D`, `git push` is executed; decisions in `## Blockers` (or the project's tracker); the next interactive session performs closure |
| TC-11.35 | UC-4-EC10 | BEHAVIORAL | Old-git shim, main checkout listed first, topic worktree listed second | Removal target is the entry matching the topic's path verbatim, never the first entry |
| TC-11.36 | UC-4-EC11 | BEHAVIORAL | Old-git shim; the target is (a) a symlink, (b) given with a trailing slash, (c) relative, (d) containing `*` or an unexpanded `$VAR` | `rm -rf --` is not run in any of the four; a prompt follows |

## 12. LIVE — Delivery on the Maintainer Machine (outside CI)

Run after the release commit is pushed to `main`. Record the command output in the release notes of the working session; a CI pass does not confirm any of these.

| ID | Covers | Kind | Test Case | Expected |
|---|---|---|---|---|
| TC-12.1 | UC-8 | LIVE | `claude plugin marketplace update`, `claude plugin update claude-code-sdlc@claude-code-sdlc`, `claude plugin list` | List shows the derived version (4.12.0 if origin/main advertised 4.11.2 at release time) |
| TC-12.2 | UC-8-A1 | LIVE | Run `claude plugin list` before the update on a machine still on the old version | Old version shown; update performed; delivery not declared confirmed until the new version shows |
| TC-12.3 | UC-8-E2 | LIVE | If `claude plugin list` still shows the old version after update | Reported in full (command, output, scope), not as an owed list; delivery stays unconfirmed |
| TC-12.4 | UC-8-EC1 | LIVE | Run TC-10.1 and TC-10.6 on the released plugin and attach the transcripts | AC-9 and AC-10 recorded as passed from live evidence; CI status is not cited as evidence for them |
| TC-12.5 | UC-5-EC2, UC-6-EC2 | LIVE | Before `install.sh`: `diff ~/.claude/rules/topic-closure.md` against the plugin copy (the hand-made file); start a session; then run `install.sh` and start another | First session shows the stale-memory-layer warning naming the differing rule; after the refresh the installed file equals the plugin copy, the hand-made version is in `backup-*/rules/`, and the next session start is silent |
| TC-12.6 | UC-8 | LIVE | Repeat TC-12.1 for each scope in use (user and project scopes update independently) | Each scope's entry shows the new version |
| TC-12.7 | UC-8 | LIVE | Between the plugin update and the `install.sh` re-run, check that the session-start context carries the warning, and after re-run that it does not | Warning present while stale, absent once current (UC-8 step 4) |

---

## 13. Coverage Table (use-case id → test cases)

| Use case | Test cases |
|---|---|
| UC-1 | TC-2.1, TC-10.1, TC-11.1 |
| UC-1-A1 | TC-2.2, TC-10.2 |
| UC-1-A2 | TC-10.3 |
| UC-1-A3 | TC-10.4 |
| UC-1-A4 | TC-2.3, TC-10.5 |
| UC-1-E1 | TC-2.4, TC-5.2, TC-10.6 |
| UC-1-E2 | TC-10.7 |
| UC-1-E3 | TC-2.8, TC-4.5, TC-4.6, TC-10.8 |
| UC-1-E4 | TC-2.7, TC-4.7, TC-10.9 |
| UC-1-EC1 | TC-10.10 |
| UC-1-EC2 | TC-2.2, TC-10.11 |
| UC-1-EC3 | TC-10.12 |
| UC-1-EC4 | TC-2.7, TC-10.13 |
| UC-2 | TC-2.5, TC-10.14 |
| UC-2-A1 | TC-10.15 |
| UC-2-A2 | TC-10.16 |
| UC-2-A3 | TC-10.17 |
| UC-2-A4 | TC-2.6, TC-10.18 |
| UC-2-E1 | TC-10.19 |
| UC-2-E2 | TC-10.20 |
| UC-2-EC1 | TC-10.21 |
| UC-2-EC2 | TC-10.22 |
| UC-2-EC3 | TC-10.23 |
| UC-3 | TC-4.4, TC-10.24 |
| UC-3-A1 | TC-10.25 |
| UC-3-A2 | TC-10.26 |
| UC-3-E1 | TC-10.27 |
| UC-3-EC1 | TC-10.28 |
| UC-3-EC2 | TC-10.29 |
| UC-4 | TC-2.20, TC-11.1 |
| UC-4-A1 | TC-2.10, TC-11.2 |
| UC-4-A2 | TC-2.17, TC-11.3 |
| UC-4-A3 | TC-2.15, TC-11.4 |
| UC-4-A4 | TC-11.5 |
| UC-4-A5 | TC-2.6, TC-11.6 |
| UC-4-A6 | TC-2.18, TC-11.7 |
| UC-4-A7 | TC-2.17, TC-11.8 |
| UC-4-A8 | TC-2.18, TC-11.9 |
| UC-4-A9 | TC-2.19, TC-11.10 |
| UC-4-E1 | TC-2.11, TC-11.11 |
| UC-4-E2 | TC-2.12, TC-11.12 |
| UC-4-E3 | TC-2.13, TC-11.13 |
| UC-4-E4 | TC-2.12, TC-11.14 |
| UC-4-E5 | TC-2.14, TC-11.15 |
| UC-4-E6 | TC-2.15, TC-11.16 |
| UC-4-E7 | TC-2.17, TC-11.17 |
| UC-4-E8 | TC-11.18 |
| UC-4-E9 | TC-2.18, TC-11.19 |
| UC-4-E10 | TC-2.4, TC-11.20 |
| UC-4-E11 | TC-2.10, TC-11.21 |
| UC-4-E12 | TC-2.9, TC-11.22 |
| UC-4-E13 | TC-2.12, TC-11.23 |
| UC-4-E14 | TC-2.11, TC-11.24 |
| UC-4-E15 | TC-2.16, TC-11.25 |
| UC-4-EC1 | TC-2.11, TC-11.26 |
| UC-4-EC2 | TC-2.19, TC-11.27 |
| UC-4-EC3 | TC-2.12, TC-11.28 |
| UC-4-EC4 | TC-11.29 |
| UC-4-EC5 | TC-11.30 |
| UC-4-EC6 | TC-2.10, TC-11.31 |
| UC-4-EC7 | TC-2.16, TC-11.32 |
| UC-4-EC8 | TC-2.20, TC-11.33 |
| UC-4-EC9 | TC-2.9, TC-11.34 |
| UC-4-EC10 | TC-2.15, TC-11.35 |
| UC-4-EC11 | TC-2.15, TC-11.36 |
| UC-5 | TC-7.1, TC-7.2, TC-7.13 |
| UC-5-A1 | TC-7.3 |
| UC-5-A2 | TC-7.4 |
| UC-5-A3 | TC-7.5 |
| UC-5-A4 | TC-7.2, TC-7.6 |
| UC-5-E1 | TC-4.1, TC-5.3 |
| UC-5-E2 | TC-4.2, TC-5.4 |
| UC-5-E3 | TC-7.7 |
| UC-5-EC1 | TC-7.3 |
| UC-5-EC2 | TC-3.1, TC-3.2, TC-7.3, TC-12.5 |
| UC-6 | TC-8.1 |
| UC-6-A1 | TC-8.2 |
| UC-6-A2 | TC-8.3 |
| UC-6-A3 | TC-8.4 |
| UC-6-E1 | TC-8.5 |
| UC-6-E2 | TC-8.6 |
| UC-6-EC1 | TC-8.7 |
| UC-6-EC2 | TC-8.8, TC-12.5 |
| UC-7 | TC-7.8 |
| UC-7-A1 | TC-7.9 |
| UC-7-A2 | TC-7.10 |
| UC-7-E1 | TC-7.11 |
| UC-7-EC1 | TC-7.6, TC-7.12 |
| UC-8 | TC-9.3, TC-9.5, TC-9.6, TC-12.1, TC-12.6, TC-12.7 |
| UC-8-A1 | TC-12.2 |
| UC-8-E1 | TC-9.4 |
| UC-8-E2 | TC-12.3 |
| UC-8-EC1 | TC-12.4 |
| UC-9 | TC-4.3, TC-5.1, TC-5.5, TC-5.6, TC-5.7, TC-6.1 |
| UC-9-A1 | TC-3.3, TC-6.2, TC-6.3, TC-6.6 |
| UC-9-E1 | TC-5.3 |
| UC-9-E2 | TC-4.8 |
| UC-9-EC1 | TC-6.4 |
| UC-9-EC2 | TC-4.9 |

Cases that map to requirements rather than a single use-case id (AC and NFR coverage): TC-5.8 and TC-6.5 (NFR-1, no new ids), TC-8.9 and TC-8.10 (AC-12, NFR-2), TC-9.1, TC-9.2 and TC-9.7 (FR-5.6, FR-5.9 doc counts), TC-7.13 (AC-12).

Use-case ids with no test case: none. Every one of the 9 primary, 30 alternative, 32 error and 28 edge ids appears above.

## 14. Totals

| Kind | Count | Where |
|---|---|---|
| STATIC | 76 | Sections 2 to 9 (20 + 3 + 9 + 8 + 6 + 13 + 10 + 7) |
| BEHAVIORAL | 62 | Sections 10 and 11 (29 + 36 = 65, less the 3 LIVE cases below) |
| LIVE | 10 | TC-10.1, TC-10.6, TC-11.10, TC-12.1 to TC-12.7 |
| FIXTURE | 0 | No agent is invoked as the thing under test |
| **Total** | **148** | |

Open measurements owed at implementation: N1 and N2 (seeded-fixture problem counts, TC-5.2 and TC-5.3); the launch-directory behaviour (TC-11.10, unmeasured per PRD 17.9 item 8); the real names of the manifest and doc validators cited in TC-4.1, to be confirmed against `ci-parity.js` when the test-writer implements it.
