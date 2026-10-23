---
feature: topic-closure
verdict: PRESENT_BEHAVIOR_UNVERIFIED
passed: false
gaps: []
human_verification_required:
  - "Own-process-tree lsof: in a temp repo (git init -b trunk, fetched origin, topic worktree) launch a session with the worktree as launch directory; from inside run `lsof -a -d cwd +D <worktree>` and, in the same Bash call, `ps -o pid,ppid,comm` walked up from the Bash tool shell ($$) to PID 1; confirm every PID lsof reports is in the ancestor chain (decides whether the rule's 'the ancestors of the current shell' clause is true as written). Deferred to Koroqe/claude-code-sdlc#12 by maintainer decision 2026-10-22; fails closed today (an unaccounted process fails check 3 and becomes a prompt). Procedure: docs/findings/topic-closure-live-checks.md section (a)."
  - "Own cwd removal: in a worktree-launched temp session run `git -C <main> worktree remove <its own cwd>`, then make exactly one more tool call; record whether that call errors, whether Stop hooks run or error, whether the process exits and with what status (decides whether 'nothing further runs here' is accurate). Deferred to Koroqe/claude-code-sdlc#12; fails closed today (the rule never removes the launch directory itself, it only offers removal as a prompt option). Procedure: docs/findings/topic-closure-live-checks.md section (b)."
  - "AskUserQuestion-unavailable fallback (TC-10.6): run `claude -p` with `--disallowedTools AskUserQuestion` ending with one open decision; save the stream-json system/init tool list as evidence the tool was absent; confirm the decision is under ## Blockers with options and a recommendation, ## Status: blocked is set, the final message gives one plain sentence on why it could not prompt, there is no trailing owed list, and no worktree or branch was removed. Run setup per #12 (--bare with ANTHROPIC_API_KEY, or setup-token; --max-turns 8, --max-budget-usd 1, at most 5 runs). Deferred to Koroqe/claude-code-sdlc#12; fails closed today (record-only). Procedure: docs/findings/topic-closure-live-checks.md section (c)."
  - "Unattended path (TC-10.14, TC-10.19): in a temp worktree where every closure check would pass, run `claude -p` ending with two open decisions; count AskUserQuestion calls in the stream-json transcript (expected zero), including subagent transcripts; confirm both decisions are under ## Blockers, ## Status: blocked is set, the full report is printed, and the worktree and branches are still present. Deferred to Koroqe/claude-code-sdlc#12; fails closed today (cleanup is gated on interactive-only and an empty ## Blockers). Procedure: docs/findings/topic-closure-live-checks.md section (d)."
  - "TC-11.10 interactive launch-directory prompt: in a REAL interactive Claude Code session whose launch directory is the topic worktree, with every closure check passing, finish a topic and confirm the rule asks via AskUserQuestion with the two options 'remove with git -C <main checkout> worktree remove <path>' and 'Leave it for removal from the main checkout', does not remove the worktree from inside, and runs nothing further after the removal option is chosen. Cannot be driven headless (depends on AskUserQuestion being answered). Tracked by Koroqe/claude-code-sdlc#12; the topic-closure feature session's own closure is a natural first exercise."
generated_at: 2026-10-23 01:35
---

## Verification Report

Feature: topic-closure (PRD section 17, Koroqe/claude-code-sdlc#11). Worktree `/Users/aleksei/Documents/Projects.nosync/claude-code-sdlc-worktrees/topic-closure`, branch `feat/topic-closure`. Static analysis only; no command was run.

### Level 1 - File Existence: PASS
- `src/rules/topic-closure.md`, `scripts/ci/validate-topic-closure.js`, `docs/findings/topic-closure-live-checks.md`, `docs/use-cases/topic-closure_use_cases.md`, `docs/qa/topic-closure_test_cases.md` all exist.
- Fixtures: 18 files under `tests/fixtures/ci/topic-closure/`, 6 in each of `bad-missing-fallback`, `bad-unwired`, `bad-forbidden-literal` (manifest, `src/claude.md`, `src/rules/error-recovery.md`, `src/rules/topic-closure.md`, `skills/merge-ready/SKILL.md`, `skills/develop-feature/SKILL.md`). Counted from Glob: 18.
- Manifest entry: `manifests/owned-files.txt:30` `rules/topic-closure.md`, under `owns` (line 23 `owns`, `legacy` begins line 32).
- Pointers: `src/claude.md:136`, `skills/merge-ready/SKILL.md:658`, `skills/develop-feature/SKILL.md:240`, `src/rules/error-recovery.md:55` (Rule 4 Action).
- Version 4.12.0 in all four sources: `.claude-plugin/plugin.json:3`, `.claude-plugin/marketplace.json:15`, `README.md:8` (badge), `install.sh:78`. No 4.11.2 remains in those four files.
- README states `20 CI validators` (`README.md:570`); `scripts/ci/validate-*.js` Glob returns 20 files.

### Level 2 - No Stubs/Placeholders: PASS
- No marker in `src/rules/topic-closure.md`, `scripts/ci/validate-topic-closure.js`, `manifests/owned-files.txt`, `src/rules/error-recovery.md`, or the topic-closure pointer lines.
- The only hit in `src/claude.md` is `src/claude.md:24`, the verifier role description ("stub detection"), which is documentation text and not a marker.
- `install.sh` hits (`:661`, `:775`, `:968`, `:1018`, `:1076` mktemp templates `XXXXXX`; `:1604`, `:1610`, `:1688` scaffold-template TODO text written into an adopter's new PRD) are pre-existing and unrelated to this change. No BLOCKER and no WARNING.

### Level 3 - Wiring: PASS
- Manifest `owns` lists `rules/topic-closure.md` (`manifests/owned-files.txt:30`). The validator asserts this via `ownsEntries()` (`validate-topic-closure.js:158-168`, `:219-221`).
- `install.sh` copies the manifest's owned files: preflight loop `:1368-1375`, copy loop `:1390-1394`, `rule_count` derived from `MANIFEST_OWNS` (`:1399-1408`), foreign-file notice `:1382-1388`. No `ls` of `rules/`.
- `hooks/handlers/session-start-spine.js` `ownedFiles()` (`:271-289`) reads `manifests/owned-files.txt` and keeps only `owns` entries; `driftLine()` (`:291-324`) iterates them and reports `<rel> (missing)` for an absent installed file. The new rule is covered with no hook change.
- CI: `.github/workflows/ci.yml:97-98` bare step in the "Validators must PASS" block; seeded fixtures at `:494-501` (pinned 4 / 2 / 2); two `run: |` mktemp steps `:506-524` (missing file, empty file, 1 problem each); anti-vacuity `:526-527`. The memory-layer ceilings are in `scripts/ci/validate-context-budget.js:80,83` (5000 and 23500).
- Pointers: `src/claude.md:136` (one bullet), `skills/merge-ready/SKILL.md:658` (after Finalization: Release), `skills/develop-feature/SKILL.md:240` (the final-verdict line) reference `rules/topic-closure.md`. `src/rules/error-recovery.md:55` is the fourth pointer and by design carries the Rule 4 wording (`record it first, then ask with AskUserQuestion`, `in an interactive session`, `record only`) and not the filename. The validator checks it by those three literals (`:40-44`, `:269-277`).
- `AskUserQuestion` is in `allowed-tools` at `skills/merge-ready/SKILL.md:5` and `skills/develop-feature/SKILL.md:5`; the validator enforces it (`:290-295`).
- Dynamic imports: none involved.

### Level 4 - Data Flow: PASS (delivery path exercised); rule behaviour unexercised
Exercised (criterion (a), tests that call the code and assert on output, with recorded red phases in `.claude/scratchpad.md`):
- Install path, `tests/hooks/test-install-messaging.js`. This runs the real `install.sh --local --yes --init-project` into a sandbox HOME (`:100`).
  - `:127-130` `TC-7.1` installed `rules/topic-closure.md` exists and `Buffer.equals` the `src` copy.
  - `:133` `TC-7.1` the `.sdlc-receipt` lines contain `rules/topic-closure.md`.
  - `:186` the summary reads `1 workflow file + 6 rules` with an extra `mine.md` present.
  - `:207-216` a differing hand-made copy is overwritten, a backup holds the hand-made bytes, and there is exactly one installed copy.
  - `:217-219` the MEDIUM-7 foreign-file notice names `rules/topic-closure.md`.
  - `:265-267` upgrade from a seeded 4.11.2 install installs the rule.
  - `:281-283` a read-only `rules/` exits non-zero with no success line.
  - `:298-302` uninstall removes the hand-edited rule and keeps `mine.md` and `other.md`.
  - `:312-313` uninstall with no receipt removes the rule via the manifest fallback.
  - Red phase: Slice 1 failed 3 assertions (TC-7.1, three checks). Slice 4 failed 10 (the count `6` against the old `ls`-derived 7, the MEDIUM-7 notice, and TC-7.13 wording). Both are recorded in the scratchpad.
- Drift path, `tests/hooks/test-session-start-spine.js` runs the real hook.
  - `:1440` `TC-8.1` asserts `rules/topic-closure.md (missing)`. Red phase: failed on the first run (1 failure, Slice 1).
  - `:1477-1491` `TC-8.9` in a self-contained temp plugin root: a manifest-only throwaway entry is named `(missing)`, a differing file warns (positive control), and an identical layer is silent.
  - `:1508-1512` `TC-8.2` a differing installed rule is named, not reported as missing, and its content is not echoed.
  - `:1515-1601` TC-8.4 through TC-8.8 cover plugin-only silence, an unreadable `rules/`, a 2 MB rule, a plugin root without the rule (with its control in a separate root), and compact/resume silence after the copy.
  - Declared characterizations with no red: TC-8.9 in Slice 1 and TC-8.2/8.4-8.8 in Slice 4. Both are declared with a reason in the scratchpad: the spine already reads the manifest generically, and these cases assert that warnings appear, so they discriminate.
- Ceilings, `tests/hooks/test-context-budget.js`: `:75` asserts the 5000 ceiling; `:77-83` seeded 5001 B and 23501 B trees each give exactly 1 problem. Red phase: failed with 6 assertions (Slice 3).
- Falsifiability: the validator fails at pinned counts on the three fixtures (4 / 2 / 2, `ci.yml:495,498,501`) and on the mktemp deleted-file and empty-file steps (1 problem each). Slice 6 red phase: each fixture was run without `--expect-problems` and the N1=4, N2=2, N3=2 counts were measured before being pinned.
- Gate 5 sandbox E2E (install, upgrade, drift, uninstall, read-only error flow): recorded only as a scratchpad line ("Gate 5 PASS 1/3"). There is no separate E2E artifact in the repo. Its flows are the ones in the two test files above, so the claim is consistent with the in-repo assertions. I did not re-run it.
- Criterion (c) also holds for the install and drift chain: `install.sh` reads the manifest, the manifest drives the copy and the receipt, and `session-start-spine` `driftLine` reads the same manifest, so the chain is entered by a real hook and a real installer.

Not exercised by anything:
- The rule's behaviour inside a live model session: AskUserQuestion prompts, the fallback when the tool is unavailable, the unattended record-only path, the own-process-tree lsof claim, own-cwd removal, and the TC-11.10 launch-directory prompt. These are the 10 LIVE QA cases and the BEHAVIORAL TC-10.x rows. Four are deferred to Koroqe/claude-code-sdlc#12 by maintainer decision, and `docs/findings/topic-closure-live-checks.md` records no result for any of them. TC-11.10 needs a real interactive session. As instructed, these are carried in `human_verification_required` and not as gaps that automation could close.
- The validator guards the presence of the instructing text (68 REQUIRED literals, FR-2.9 literals scoped to their paragraph), not compliance by the model.

Process notes (not defects in the shipped code):
- The scratchpad shows the Gate 3 auto-fix commit 7000e72 (rule v5 at 4,942 B against the DD-1b cap of 4,950, `## Release` push guard in `CLAUDE.md`, PRD amendment) followed by "Next: re-run Gates 2+3 over the fix commit". Whether that re-run has happened is not recorded. I read the post-fix tree: the validator `MAX_BYTES = 4950` and the rule text are consistent with it.
- `docs/findings/topic-closure-live-checks.md:35` still says "within its 4,800 B cap", while the validator cap is now 4,950. This is a stale number in a docs file, not a wiring defect; the corrected cap is DD-1b in the PRD.

### Overall: PRESENT_BEHAVIOR_UNVERIFIED
Levels 1-3 pass, no stubs or BLOCKER markers, and nothing is undeterminable. The delivery and drift paths are exercised by tests with recorded red phases. The rule's runtime behaviour in a live session (AC-9, AC-10 and the launch-directory prompt) has never been observed, and five items remain open (four deferred to #12 plus TC-11.10), so by the verdict table `VERIFIED` and `passed: true` are not available. `gaps` is intentionally empty: per the delegation these are human or later-run checks, not slices a replan should add.
