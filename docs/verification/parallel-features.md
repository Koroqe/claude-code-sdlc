---
feature: parallel-features
verdict: VERIFIED
passed: true
gaps: []
human_verification_required: []
generated_at: 2026-09-22 15:04
---

## Verification Report

### Level 1 — File Existence: PASS

All files named in `.claude/tmp/parallel-features-plan.md` §6 ("Files to modify") and in each
slice's `Files:` field were checked with Glob and confirmed present on disk:

- New (14): `.gitattributes`, `templates/.gitattributes`, `hooks/lib/git-safe.js`,
  `tests/hooks/test-git-safe.js`, `tests/hooks/test-union-merge.js`,
  `scripts/ci/validate-prd-numbering.js`, `tests/fixtures/ci/prd-numbering/bad-duplicate-number/`
  and `good-moved-section-gap/` (with `README.md`s), `tests/fixtures/ci/instinct-store/bad-merge-{a,b,c,d,e}/`
  (each with `templates/instincts.md` + `README.md`),
  `tests/fixtures/ci/instinct-discipline/bad-missing-class/skills/merge-ready/SKILL.md` (+ `README.md`),
  `docs/findings/parallel-feature-sessions.md`.
- Modified (spot-checked all 30): `.gitignore`, `templates/.gitignore`, `install.sh`,
  `hooks/handlers/session-start-spine.js`, `hooks/handlers/stop-typecheck-format.js`,
  `skills/merge-ready/SKILL.md`, `scripts/ci/validate-context-budget.js`,
  `scripts/ci/validate-instinct-store.js`, `scripts/ci/validate-instinct-discipline.js`,
  `docs/digest-index.md`, `docs/PRD.md`, `docs/qa/parallel-features_test_cases.md`,
  `docs/use-cases/parallel-features_use_cases.md`, `src/rules/git.md`, `src/rules/changelog.md`,
  `CLAUDE.md`, `.github/workflows/ci.yml`, `.claude/scratchpad.md` (on disk, untracked as designed) —
  all present.
- `CHANGELOG.md` entry: not yet written — correctly so. Per `rules/changelog.md` Trigger Ownership
  and the plan's own §1 table ("written at `/merge-ready` Finalization and owned there"), and the
  scratchpad shows quality-gates still in progress (Gates 3/9 at the time of this run). This is not a
  Level 1 gap; it is a deliverable explicitly deferred to a later step of the same pipeline run.

### Level 2 — No Stubs/Placeholders: PASS

Scanned all new/modified production files (`hooks/lib/git-safe.js`, `hooks/handlers/session-start-spine.js`,
`hooks/handlers/stop-typecheck-format.js`, `scripts/ci/validate-prd-numbering.js`,
`scripts/ci/validate-instinct-store.js`, `scripts/ci/validate-instinct-discipline.js`, `install.sh`,
`skills/merge-ready/SKILL.md`) for `TBD|FIXME|XXX|TODO|HACK|placeholder|PLACEHOLDER|stub|not implemented|NotImplementedError`.

- Zero matches in every hook/validator/skill file.
- `install.sh` matched `mktemp ... XXXXXX` (mktemp's own template suffix, not the marker `XXX` as a
  standalone token) and three `TODO` occurrences at `install.sh:1576`, `:1582`, `:1660`. All three sit
  inside the **pre-existing** `docs/PRD.md` scaffold heredoc and Next-Steps help text that
  `--init-project` writes into a *new consumer's* project (`"TODO: High-level description..."`,
  `"Fill in TODO placeholders in .claude/CLAUDE.md"`) — intentional template content the installer has
  always emitted, not incomplete work in this feature's own implementation, and outside every slice's
  `Files:`/`Changes:` scope. Not classified as a finding.

No BLOCKER or WARNING markers found in this feature's own code.

### Level 3 — Wiring: PASS

- `hooks/lib/git-safe.js` is `require`d by both `hooks/handlers/session-start-spine.js:74` and
  `hooks/handlers/stop-typecheck-format.js:44`, and both consumers call it (`gitSafe.commonDirRoot`,
  `gitSafe.runGit`, `gitSafe.UNKNOWN` at `stop-typecheck-format.js:226-242`). A grep for
  `execFileSync('git'|spawnSync('git'` in `session-start-spine.js` and `stop-typecheck-format.js`
  returned no matches — the direct git spawns were genuinely migrated, not left in parallel with the
  helper.
- `tests/hooks/test-guards-cross.js:182-183` lists both consumers in its one-entry-grown delegation
  array, confirming S5 landed on the accept path as the scratchpad claims.
- `tests/hooks/test-git-safe.js` and `tests/hooks/test-union-merge.js` match `run-tests.js`'s
  `/^test-.*\.js$/` auto-discovery regex with no runner edit required — confirmed by reading
  `tests/hooks/run-tests.js:16-19`.
- `.gitattributes` and `templates/.gitattributes` both declare `merge=union` for `CHANGELOG.md` /
  `/CHANGELOG.md` and `.claude/instincts.md`.
- `.gitignore` and `templates/.gitignore` both carry a `.claude/scratchpad.md` ignore entry.
- `scripts/ci/validate-prd-numbering.js`, `validate-instinct-store.js`, and
  `validate-instinct-discipline.js` are all invoked from `.github/workflows/ci.yml` — bare invocation,
  Falsify steps (one per `bad-merge-{a..e}` fixture and `bad-missing-class`, each pinned), and
  anti-vacuity steps, confirmed by grep against `ci.yml`.
- `install.sh`'s `scaffold_project()` early return (`:1521-1523`) now gates only the fresh-scaffold
  region; the maintenance region (`.gitignore` keys, `.gitattributes` skip-if-exists,
  `.claude/scratchpad.md` skip-if-exists) sits below it unconditionally (`:1599` onward) — the
  loop-3 BLOCKER (existing consumers never reaching the migration code) is structurally closed, read
  directly from the current file, not inferred from the scratchpad's claim.
- `skills/merge-ready/SKILL.md` Gate 0 (`:78-107`) carries the full sync procedure (base resolution,
  injection guard, fetch/behind-count, offline literal, merge-not-rebase remedy, conflict rules,
  mid-run invalidation); Gate 1 (`:109-126`) carries the post-sync PRD-number uniqueness re-check;
  the Merge Reconciliation preamble (`:530-546`) names all five classes (a)-(e) with the exact
  subject phrases `validate-instinct-discipline.js`'s `RECONCILIATION_CLASSES` array checks for
  (`:208-213`) — a genuine, non-vacuous pairing, not two independently-authored texts that happen to
  agree by coincidence.
- `scripts/ci/validate-context-budget.js:60` raises the `skills/merge-ready/SKILL.md` ceiling to
  `45000` with the asymmetry rationale comment at `:53`.
- `docs/digest-index.md` states the section-number-AND-slug dual key (`:6`).
- `docs/PRD.md` no longer contains the stale `"is a tracked file"` claim (grep: no matches) — the §10
  correction landed.
- `src/rules/git.md` carries exactly 3 added lines (worktree-per-session, merge-not-rebase, sync
  commit shape) and `CLAUDE.md`'s Release section derives the next version from `origin/main`.

No disconnected artifact was found among the deliverables checked.

### Level 4 — Data Flow: PASS

At least one exercised path was found for every major deliverable, satisfying (a) and (c):

- **(a) Real tests with genuine assertions, not simulations.** `tests/hooks/test-union-merge.js`
  performs **real two-branch `git merge`** operations in a hermetic sandboxed-`HOME` temp repo
  (Sections R/A/B/N), asserting the actual measured union-driver output (documented in the file's own
  header comment as measured on git 2.15, not assumed) — including a negative control with
  `.gitattributes` absent, which is the proof the check can fail. `tests/hooks/test-git-safe.js`
  seeds a **hostile parent environment** (`GIT_CONFIG_COUNT`, `GIT_CONFIG_PARAMETERS`, an alternate
  object-dir var) before any helper call and asserts the child process never observes them
  (`:49-86`) — a genuine security-property test, not a shape check.
- **(a), discriminating evidence.** Every slice in `.claude/scratchpad.md`'s `## Plan` carries a
  `Slice N red-phase:` line recording the test/grep observed FAILING before the change (e.g. Slice 1:
  hygiene test 2 assertions failed pre-change, install-messaging ENOENT pre-removal; Slice 4: three
  test files failed 2+9+3 problems pre-implementation; Slice 7: all 6 fixtures passed vacuously
  pre-implementation, proving the detector did not yet exist). None are undeclared `NONE`.
- **(c), a traced chain entered by something that runs.** `hooks/handlers/session-start-spine.js` and
  `stop-typecheck-format.js` are dispatched by Claude Code's own hook runtime
  (`hooks/lib/run-hook.js`) on real `SessionStart`/`Stop` events — not code sitting unreached. The
  committed `## Gate 6 live worktree rehearsal` section in
  `docs/findings/parallel-feature-sessions.md:29-70` records the orchestrator (this pipeline run)
  actually invoking these handlers through the real `hooks/lib/run-hook.js` wrapper from **real**
  `git worktree add` checkouts at commit `3b7ef2b`, with live quoted outputs for all four arms: spine
  on an absent scratchpad (`{"continue":true}`, no state lines), spine on a scratchpad seeded
  `## Branch: <<<<<<< HEAD` (`scratchpad: no parseable state`, plus a live stale-install line and a
  live memory-layer drift line), trust inheritance through `--git-common-dir` (a real declared
  command executing, with an untrusted-registry control degrading correctly), and git-guard judging
  the worktree's own branch (allow on the feature branch, deny with the correct refusal text on a
  `main`-checked-out worktree). This is a real dispatch of the actual artifacts, not merely a trace of
  wired imports — it satisfies (c)'s "actually entered by something that itself runs" requirement
  directly, without relying on inference.
- **Gate 0's sync procedure was exercised for real** in this same pipeline run: the branch was 4
  commits behind `origin/main`, and the procedure specified in `skills/merge-ready/SKILL.md` Gate 0
  was followed to merge, producing sync commit `3b7ef2b` — not a hypothetical description of a
  procedure that has never run.
- `tests/hooks/test-stop-typecheck-format.js` (per the scratchpad, 85 checks including a real
  `git worktree add`) and `tests/hooks/test-guards-cross.js`'s delegation-list arm were read and
  confirmed to assert the genuine consumer/spawn-shape properties described above.

No unexercised chain was found among the deliverables checked — every traced path had either a real
test with discriminating (red-then-green) evidence, or a live dispatch recorded with quoted output
from a real worktree in this same run.

### Overall: VERIFIED

Levels 1-3 all PASS with no findings. Level 4 confirms multiple exercised paths under both (a)
(hermetic tests with hostile-input and negative-control assertions, backed by recorded red-phase
evidence) and (c) (a live worktree rehearsal, performed this run, with quoted real outputs from the
actual shipped hook runtime, plus a real Gate 0 sync merge that produced a real commit). Per
precedence: not FAILED (no Level 1/2/3 failures), not UNCERTAIN (no undeterminable level, no dynamic
import blocking Level 3, Level 4 did not report SKIPPED), and Level 4 confirms exercised paths — so
the verdict is VERIFIED.
