# Use Cases: Parallel Feature Sessions

> Based on [PRD](../PRD.md) — Section 15: Parallel Feature Sessions

---

**System context (do not assume otherwise):** this feature has no UI, no server, and no database (PRD 15.6-15.8). It is a set of coordinated changes across `.gitignore`/`.gitattributes`, `hooks/handlers/session-start-spine.js`, the new `hooks/lib/git-safe.js`, `hooks/handlers/stop-typecheck-format.js`, `skills/merge-ready/SKILL.md`, `agents/prd-writer.md`, `docs/digest-index.md`, `install.sh`, and several CI validators. Every flow below assumes the operating model of PRD 15.1/FR-10: two or three Claude Code sessions ("Session A", "Session B"), each in its own git worktree on its own feature branch, sharing one repository's object store via a common `.git` directory.

**Actors:**
- **Session A / Session B** — parallel orchestrator sessions, each in a distinct worktree, each running the full `/bootstrap-feature` → `/implement-slice` → `/merge-ready` pipeline independently and automatically.
- **Developer** — the human who opened both sessions, resolves any true (non-singleton) merge conflicts Gate 0 surfaces, and reads `session:start:spine`'s injected lines.
- **`session:start:spine`** — the automatic `SessionStart` hook; reads the local scratchpad and instinct store, emits `additionalContext`.
- **`/merge-ready`'s Gate 0 / Gate 1** — the sync-and-uniqueness procedure this feature adds (FR-4, FR-5, FR-6).
- **The trust check** (`isTrustedProject`, consumed by `stop:typecheck-format` and Gate 8) — decides whether a worktree is treated as a trusted project.
- **`hooks/lib/git-safe.js`** — the new shared hardened git-spawn helper (FR-8), consumed by the trust check and the spine, never duplicated.
- **CI validators** — `validate-instinct-store.js`, `validate-instinct-discipline.js`, `validate-prd-numbering.js`, `validate-context-budget.js`, `test-union-merge.js`, `test-git-safe.js`, `test-guards-cross.js`.

**The organizing principle of this document:** every flow ends in a mechanically checkable outcome — a literal emitted line, an exit/degrade state, a specific repaired field value, or a pinned validator problem count — exactly what `docs/qa/parallel-features_test_cases.md` and the harness's test suite are meant to encode.

---

## UC-1: Two Sessions Bootstrap Two Features in Two Worktrees — Scratchpads Never Merge

**Actor**: Session A, Session B, Developer
**Preconditions**: repository has de-tracked `.claude/scratchpad.md` (FR-1); `git ls-files .claude/scratchpad.md` is empty; `.gitignore` contains the scratchpad ignore line
**Trigger**: developer opens Session A in worktree `../repo-feat-a` on branch `feat/a`, and Session B in worktree `../repo-feat-b` on branch `feat/b`, both against the same shared `.git`

### Primary Flow (Happy Path)
1. Session A runs `/bootstrap-feature` for feature A; its `.claude/scratchpad.md` in `../repo-feat-a` is written fresh (bootstrap's Write path) with `## Feature: a`, `## Branch: feat/a`.
2. Session B runs `/bootstrap-feature` for feature B in `../repo-feat-b`; its own scratchpad is written fresh with `## Feature: b`, `## Branch: feat/b`.
3. Both sessions implement slices, each session's `/implement-slice` updating only its own worktree's local scratchpad file after each commit.
4. Neither scratchpad file is ever `git add`ed or committed — `git status` in each worktree shows `.claude/scratchpad.md` untracked-and-ignored, never staged (`git check-ignore --no-index .claude/scratchpad.md` matches, per AC-1).
5. Both sessions eventually commit slice work to their respective branches; neither branch's history contains a scratchpad hunk.

**Postconditions**: Session A's and Session B's scratchpad files remain permanently distinct, on-disk-only, per-worktree state; no git operation in either worktree ever produces a scratchpad merge conflict; `git ls-files .claude/scratchpad.md` returns empty in both worktrees.

### Alternative Flows
- **UC-1-A1: fresh worktree with no scratchpad file at all** — a third worktree is created and a session starts there before any `/bootstrap-feature` run. `session:start:spine` finds the file absent, emits no scratchpad-state lines at all (silent skip, unchanged from pre-feature design), and does not throw. When `/bootstrap-feature` later runs, its Write path creates `.claude/scratchpad.md` fresh in that worktree. A `fast`-tier request classified before bootstrap runs in this worktree performs **no scratchpad write** (Triage FR-3.5) — this remains fail-closed, i.e. no code path treats the absent file as an error condition.
- **UC-1-A2: legacy consumer whose scratchpad is still git-tracked** — a project that has not yet run the FR-1 de-track migration has `.claude/scratchpad.md` present in `git ls-files`. Both Session A's and Session B's scratchpad edits are tracked changes; on Gate 0's FR-4 sync (UC-2), the scratchpad file conflicts like any other tracked file. Per FR-4's singleton conflict rule, this resolves via `ours` (Session B keeps its own scratchpad content, discarding Session A's, since a scratchpad cannot correctly represent two features).

### Error Flows
- **UC-1-E1: scratchpad exists but `## Branch:` is unparseable** — see UC-9 (spine parse holes); documented separately since it is its own FR (FR-9).

### Edge Cases
- **UC-1-EC1: two sessions inside ONE checkout (no worktree separation)** — see UC-11 (documented-unsupported).

### Data Requirements
- **Input**: per-worktree `.claude/scratchpad.md` (local, never shared); `templates/.gitignore` / this repo's `.gitignore` ignore line
- **Output**: no shared state between Session A and Session B's scratchpads, ever
- **Side Effects**: none across worktrees — each worktree's scratchpad write is local-disk only

---

## UC-2: Feature A Merges First; Feature B's Gate 0 Syncs, Unions, and Folds

**Actor**: Session B, Gate 0, Developer
**Preconditions**: feature A has already been merged into `origin/<base>` (e.g. `origin/main`); feature B's branch `feat/b` is behind `origin/main` by N commits; `.gitattributes` in the repo declares `merge=union` for `CHANGELOG.md` and `.claude/instincts.md`
**Trigger**: Session B runs `/merge-ready` for feature B

### Primary Flow (Happy Path — Online Sync)
1. Gate 0 resolves the base: `git rev-parse --abbrev-ref origin/HEAD`, strips `origin/`, yielding `main` (falls back to `main` then `master` if that command fails).
2. Gate 0 runs `git fetch origin main`; the fetch succeeds.
3. Gate 0 runs `git rev-list --count HEAD..origin/main`, returning `N > 0` — the branch is behind.
4. Gate 0 applies the remedy: `git merge -m "chore(core): sync feat/b with main" origin/main` — **never** a rebase.
5. The merge touches `.claude/instincts.md` and `CHANGELOG.md`, both declared `merge=union` in `.gitattributes`: git auto-resolves both with a straight union of lines, zero conflict markers.
6. Because a merge occurred, Gate 0's Merge Reconciliation preamble runs before Consolidate Instincts: it scans `.claude/instincts.md` for the five artifact classes (a)-(e) (see UC-3 for the detailed repair walkthrough) and repairs any it finds.
7. Gate 0's mandatory fold step detects a duplicated `## <today's date>` heading in `CHANGELOG.md` (both A's and B's merge-ready runs wrote today's date) and folds them into one heading, newest-entry-first, in a single edit.
8. The merge, having no true (non-singleton) conflicts, requires no manual developer resolution; Gate 0 commits the sync: `git commit -m "chore(core): sync feat/b with main"` — this message passes `git.md`'s `CONVENTIONAL_RE` guard.
9. Because the sync commit lands after Gates 2 and 3 may have already passed in this run, the existing Auto-Fix rule (`error-recovery.md` Rule 3) marks Gates 2 and 3 invalidated; `/merge-ready` re-runs them.
10. Gate 0 reports PASS; the remaining gates proceed.

**Postconditions**: `feat/b`'s history contains one sync commit matching `chore(core): sync feat/b with main`; `.claude/instincts.md` and `CHANGELOG.md` on `feat/b` contain both features' entries with zero conflict markers and zero duplicated day headings; Gates 2/3 show as re-run in the gate report.

### Alternative Flows
- **UC-2-A1: offline Gate 0 — fetch fails** — `git fetch origin main` fails (network down, DNS failure, auth expired). Gate 0 does not block: it emits the literal line `base sync unavailable (<reason>) — comparing against local <base>`, compares `HEAD` against the locally-cached `main` ref instead, under a bounded timeout. This path applies identically whether the run is `tier: full` or `tier: quick`.
- **UC-2-A2: quick-tier Gate 0 sync** — `/merge-ready` runs under its tier-aware gate subset for a `quick`-tier slice (FR-4 of the tier system). Gate 0 still runs the full FR-4 procedure (base resolution, fetch, behind-count, merge-not-rebase remedy, singleton conflict rules) exactly as under `tier: full` — the offline-degrade line and comparison logic are identical, unabridged by the reduced gate subset.
- **UC-2-A3: pre-`.gitattributes` worktree's first sync** — `feat/b`'s worktree was created before this feature shipped `.gitattributes` (Risk 2), so the merging side has no `merge=union` declaration at sync time. The `.claude/instincts.md`/`CHANGELOG.md` merge produces raw `<<<<<<<`/`=======`/`>>>>>>>` conflict markers instead of a clean union. Gate 0's designed fallback is its own singleton conflict rules from FR-4 (resolve instincts via union-then-preamble semantics, changelog via union-then-fold semantics) applied manually by the developer as the stated remedy for this exact scenario; this is the accepted degrade path per Risk 2, not a defect.
- **UC-2-A4: sync merge conflict in a non-singleton file** — the merge touches a file that is neither scratchpad, instincts, nor changelog (e.g. both features edited the same slice's source file, or both touched `skills/merge-ready/SKILL.md`). This is a normal git conflict, resolved by the developer through ordinary means (not a singleton rule). Once resolved, the post-conflict commit still uses the conventional `chore(core): sync feat/b with main` shape; Gates 2/3 are still invalidated per the Auto-Fix rule and re-run.

### Error Flows
- **UC-2-E1: `git rev-parse --abbrev-ref origin/HEAD` fails entirely** — no `origin/HEAD` is set (e.g. a fresh clone that never ran `git remote set-head`). Gate 0 falls back to `main`; if a `main` branch does not exist either, it falls back to `master`. Gate 0 never crashes on base resolution.
- **UC-2-E2: fetch times out** — the bounded timeout expires before `git fetch` completes. Treated identically to UC-2-A1 (fetch failure) — the offline-degrade line is emitted with a timeout-specific `<reason>`, comparison proceeds against the local ref.

### Edge Cases
- **UC-2-EC1: `HEAD..origin/<base>` count is zero** — the branch is already up to date; Gate 0 reports the branch current, skips the merge remedy entirely, no sync commit is created, Gates 2/3 are untouched (no invalidation, since no sync commit occurred).
- **UC-2-EC2: mid-run sync after gates already passed** — the sync merge lands after Gate 2 (tests) and Gate 3 (build) have already reported PASS earlier in the same `/merge-ready` invocation. Per FR-4's mid-run-sync rule, this is treated exactly like any other post-pass commit under the existing Auto-Fix rule: Gates 2 and 3 are marked invalidated and must re-run before `/merge-ready` can report MERGE READY.

### Data Requirements
- **Input**: `origin/HEAD`, `origin/<base>`'s current commit and file contents, `feat/b`'s local commit history, `.gitattributes`
- **Output**: literal line `base sync unavailable (<reason>) — comparing against local <base>` on offline degrade; a sync commit matching `chore(core): sync <branch> with <base>`; a folded single `## <date>` changelog heading
- **Side Effects**: `feat/b`'s branch gains a merge commit (and, on conflict, a follow-up commit); Gates 2/3 status reset to pending/re-run

---

## UC-3: Both Features Captured the Same Instinct Slug — Reconciliation Unions Correctly

**Actor**: Gate 0's Merge Reconciliation preamble, `validate-instinct-store.js`
**Preconditions**: feature A's `.claude/instincts.md` (pre-merge, on `main`) contains `### db-null-check` with `Occurrences: 2 (features: a1, a2)`, `Confidence: 0.7`; feature B's local copy (pre-sync) independently captured the same instinct and has its own `### db-null-check` with `Occurrences: 2 (features: b1, b2)`, `Confidence: 0.5` (already decayed once); both sides also incremented `Feature counter` independently (A's main copy at `19`, B's local copy at `20`)
**Trigger**: UC-2's sync merge unions both instinct stores, producing duplicate `Feature counter:` lines and a duplicate `### db-null-check` heading; the Reconciliation preamble runs

### Primary Flow (Happy Path)
1. The preamble detects two `Feature counter:` lines (class a) and repairs the counter to `max(19, 20) = 20`.
2. The preamble detects the duplicated `### db-null-check` heading (class b) and unions the `features:` lists: `(features: a1, a2, b1, b2)`.
3. `Occurrences:` is repaired to `max(2, 2) = 2`, then floored at the union-list length (`4`) — final `Occurrences: 4`.
4. `Confidence:` is repaired to `min(formula_ceiling(4), max(0.7, 0.5))` — the formula's ceiling at 4 occurrences is computed, and the repaired confidence is the **lesser** of that ceiling and `0.7` (the less-decayed side). The result is never a reset to the ceiling itself unless the ceiling happens to be ≤ 0.7.
5. Any duplicate field line within the same entry (class d) — e.g. two `Last confirmed at:` lines surviving the union — is repaired by keeping the correct (post-repair) value and dropping the duplicate.
6. `Last confirmed at`, if it now exceeds the repaired counter of `20`, is clamped to `20` and `Retires at` is recomputed from the clamped value (class c) — exercised when applicable, not in this specific scenario since both sides' timestamps predate 20.
7. `validate-instinct-store.js` runs post-repair and finds zero remaining artifacts of classes (a)-(e).

**Postconditions**: `.claude/instincts.md` on `feat/b` post-sync contains exactly one `### db-null-check` entry with `Occurrences: 4 (features: a1, a2, b1, b2)`, `Confidence:` equal to `min(ceiling(4), 0.7)`, exactly one `Feature counter: 20` line, and no duplicate field lines.

### Alternative Flows
- **UC-3-A1: duplicated section headings** — the union merge produces two `## Prevention Rules` headings (class e) because both branches independently elevated different instincts into that section. The preamble folds all blocks under both headings into a single `## Prevention Rules` section before applying classes (a)-(d) to any entries now co-located there.
- **UC-3-A2: confidence ceiling is the binding constraint** — if the formula's ceiling at 4 occurrences computes to `0.6` (lower than A's `0.7`), the repaired `Confidence:` is `0.6`, not `0.7` — the ceiling always caps the result even when the less-decayed side is higher.

### Error Flows
- **UC-3-E1: duplicated Feature counter lines reach the validator undetected** — a seeded fixture where the Reconciliation preamble is skipped (or a repair regresses) leaves two `Feature counter:` lines in the store. `validate-instinct-store.js` fails at its pinned expected-problem count for this artifact class (exact count fixed per fixture, NFR-4) rather than silently reading only the first match.

### Edge Cases
- **UC-3-EC1: `Last confirmed at` exceeds the counter post-merge** — an immortal-entry scenario (the C2/C3 collision this feature targets): a duplicated entry's `Last confirmed at` value is `21`, but the repaired counter is `20`. Class (c) clamps `Last confirmed at` to `20` and recomputes `Retires at` from the clamped value — the entry can no longer outlive the counter that produced it.
- **UC-3-EC2: `validate-instinct-discipline.js` catches a preamble missing a class name** — a seeded merge-ready copy whose Reconciliation preamble prose omits one of the five class names (a)-(e) fails `validate-instinct-discipline.js` at its pinned re-pinned count, proving the mechanical prose-binding holds.

### Data Requirements
- **Input**: two divergent `.claude/instincts.md` copies (main's and the feature branch's pre-sync copy), unioned by the merge driver
- **Output**: a single, repaired `.claude/instincts.md` with no duplicate artifacts of classes (a)-(e)
- **Side Effects**: none beyond the file edit itself, applied as part of the sync commit's follow-up (or as an uncommitted working-tree fix folded into the sync commit before it lands)

---

## UC-4: Worktree Session Inherits Trust from the Registered Main Root

**Actor**: Session B (in worktree `../repo-feat-b`), the trust check (`isTrustedProject`), `hooks/lib/git-safe.js`, `stop:typecheck-format`, Gate 8
**Preconditions**: the trust registry has an entry for the main checkout root (e.g. `/Users/dev/Projects/repo`) only — `../repo-feat-b` is not separately registered; `../repo-feat-b` is a real `git worktree add`-created worktree sharing the main root's `.git`
**Trigger**: Session B's `stop:typecheck-format` hook fires, or Session B reaches Gate 8 of `/merge-ready`

### Primary Flow (Happy Path)
1. `isTrustedProject` checks `../repo-feat-b` against the registry by exact path — no match (the registered entry is the main root, not this worktree path).
2. On exact-match failure, `hooks/lib/git-safe.js`'s hardened spawn runs `git rev-parse --git-common-dir` (no `--path-format` flag) from `../repo-feat-b`.
3. The command returns a relative or absolute path whose realpath resolves to `/Users/dev/Projects/repo/.git`.
4. The realpathed result's basename is `.git` — `isTrustedProject` takes `path.dirname`, yielding `/Users/dev/Projects/repo`, which **does** match the registered main root.
5. `../repo-feat-b` is resolved as trusted.
6. `stop:typecheck-format` runs the project's real typecheck/lint command (not report-only) in `../repo-feat-b`.
7. At Gate 8, design-reviewer's preview is eligible to run in this worktree (not refused for being untrusted).

**Postconditions**: `../repo-feat-b` is treated as trusted with zero manual per-worktree registration; `stop:typecheck-format` enforces (not merely reports) its findings; Gate 8's preview runs.

### Alternative Flows
- **UC-4-A1: hardening — hostile parent environment never reaches the git child** — see UC-11-EC1 (edge case, cross-referenced here since it is exercised on this exact code path).
- **UC-4-A2: non-worktree project** — a plain, non-worktree checkout is checked by `isTrustedProject`: the exact-path match succeeds on the first check (its own root is directly registered), and the `--git-common-dir` fallback path is never invoked. Behavior is byte-identical to the pre-feature implementation.

### Error Flows
- **UC-4-E1: `git rev-parse --git-common-dir` fails** — the git child process exits non-zero (corrupted `.git`, permissions failure, or the path is not a git repo at all). `isTrustedProject` degrades to **untrusted, report-only** — the existing fail-open discipline (NFR-6) — never throws, never hard-blocks.
- **UC-4-E2: submodule-shaped common dir** — the resolved, realpathed common-dir path's basename is not `.git` (e.g. it resolves to `.../repo/.git/modules/some-submodule`, the shape a git submodule produces). `isTrustedProject` treats this as **no match → untrusted**, never attempting a `path.dirname` interpretation of a non-`.git`-basename path.

### Edge Cases
- **UC-4-EC1: empty or missing registry file** — the trust registry file does not exist or is empty. `isTrustedProject` returns untrusted for every path, exactly as it did before this feature — this is existing, preserved behavior, not a new error condition.

### Data Requirements
- **Input**: the trust registry file (main-root entries only); `git rev-parse --git-common-dir` output from the worktree
- **Output**: trusted/untrusted boolean consumed by `stop:typecheck-format` and Gate 8
- **Side Effects**: none — this check is read-only

---

## UC-5: Security Review Rejects Trust Inheritance (Reject Path)

**Actor**: security-auditor, Session B, Developer
**Preconditions**: FR-8's mandatory security-auditor pre-review has run against `hooks/lib/git-safe.js` and its `isTrustedProject` consumer, and the finding is REJECT
**Trigger**: security-auditor returns a REJECT verdict during S5's pre-review gate

### Primary Flow (Reject Path)
1. Security review rejects worktree trust inheritance (e.g. an unresolved risk in the `--git-common-dir` resolution or the allowlist-env construction).
2. `isTrustedProject`'s handler code is left **unchanged** from its pre-feature exact-path-match-only behavior — no `git-safe.js` consumption is wired into the trust check.
3. `agents/design-reviewer.md`'s added sentence instead documents **per-worktree manual registration** as the supported path: a developer wanting a worktree trusted must register that worktree's own path in the registry explicitly.
4. The README paragraph documenting this feature's trust behavior is updated to describe manual per-worktree registration, not automatic inheritance.
5. Done-conditions for this path are: docs present (design-reviewer sentence + README paragraph), handler code untouched (verified by diff), full suite green.

**Postconditions**: `../repo-feat-b` remains untrusted unless manually registered; `hooks/lib/git-safe.js` still exists (created in S4 for the spine's `gitBranch` hardening and stale-install matching, which are unaffected by this reject) but is never consumed by `isTrustedProject`; no handler-code diff exists in `hooks/handlers/stop-typecheck-format.js` relative to pre-feature.

### Alternative Flows
- **UC-5-A1: developer manually registers the worktree** — following the documented per-worktree registration path, the developer adds `../repo-feat-b`'s own path as a distinct registry entry. `isTrustedProject`'s existing exact-path match (unchanged) now succeeds directly for that path, without any `--git-common-dir` fallback logic ever running (since none was wired in under the reject path).

### Data Requirements
- **Input**: security-auditor's REJECT verdict and stated reasoning
- **Output**: documentation naming the manual-registration path; unchanged handler code
- **Side Effects**: none to runtime behavior — this is a documentation-only outcome for the trust check

---

## UC-6: PRD Numbering — Duplicate Section Detected and Renumbered Post-Sync

**Actor**: Session A, Session B, `agents/prd-writer.md`'s allocation rule, `/merge-ready`'s Gate 1, `validate-prd-numbering.js`
**Preconditions**: at bootstrap time, both features' PRDs (each computed independently in its own worktree, pre-sync) show `max(existing section numbers) = 14`; neither session can see the other's not-yet-merged section
**Trigger**: Session A bootstraps feature A first, allocating `## 15.` for feature A. Session B, unaware, also bootstraps feature B in its own worktree and independently allocates `## 15.` (same number — its own worktree's PRD also showed max `14` at that time). Feature A merges to main first (its `## 15.` section is now the merged, authoritative one). Session B runs `/merge-ready` for feature B.

### Primary Flow (Happy Path)
1. Gate 0 syncs `feat/b` with `main` (UC-2); `docs/PRD.md` is a non-singleton file, so the sync merge either auto-merges cleanly (if the two `## 15.` sections landed in non-overlapping hunks) or produces a normal conflict the developer resolves — either way, the merged `docs/PRD.md` on `feat/b` now contains **two** `## 15.` headings: A's (already merged, authoritative) and B's (pending).
2. Gate 1's post-sync uniqueness re-check runs after the sync (FR-5): it scans `docs/PRD.md` for duplicate `## N.` headings.
3. The duplicate `## 15.` is detected.
4. Per FR-5's rule, **the later merger renumbers their own section** — feature B's section — never A's already-merged one. Feature B's section is renumbered to `## 16.` (the next `max(existing) + 1` after the sync, i.e. `max(15) + 1 = 16`, since A's `15` is now the authoritative max).
5. Every reference to B's old `## 15.` number is updated: `docs/use-cases/<feature-b>_use_cases.md`'s `> Based on [PRD](../PRD.md) — Section 15` header line becomes `Section 16`; `docs/qa/<feature-b>_test_cases.md`'s equivalent header is updated; any pending `docs/digest-index.md` row for feature B referencing `15` is updated to `16` (this is the specific pending-row case UC-7 also exercises).
6. Gate 1 re-checks: no duplicate `## N.` headings remain; PASS.

**Postconditions**: `docs/PRD.md` on `main` (after B also merges) contains `## 15.` (feature A, untouched) and `## 16.` (feature B, renumbered); `docs/use-cases/`, `docs/qa/`, and the digest index all reference `16` for feature B; feature A's section number and its own cross-references are never touched.

### Alternative Flows
- **UC-6-A1: no collision — B's allocation happens to be unique post-sync** — B's session bootstrapped after A had already merged (or B's own number was already `> max` at sync time). Gate 1's uniqueness re-check finds no duplicate; no renumbering occurs; Gate 1 PASSes on the first check.

### Error Flows
- **UC-6-E1: `validate-prd-numbering.js` seeded fixture** — a fixture PRD with a deliberately duplicated `## N.` heading is run through the validator; it fails at its pinned expected-problem count (exact count fixed at implementation time, NFR-4). The real `docs/PRD.md` (post-repair, or in its normal single-writer state) passes with zero problems.

### Edge Cases
- **UC-6-EC1: number reused after a section rename/move** — a prior section is renamed or moved; per FR-5, its original number is **never reused** for a new section even though the old heading text no longer exists — the allocation rule is `max(existing section numbers) + 1`, not "next available gap."

### Data Requirements
- **Input**: `docs/PRD.md`'s current set of `## N.` headings (pre- and post-sync); the later-merger's own use-cases/QA/digest files
- **Output**: a unique `## N.` heading per section on `main`; updated cross-references in three file classes
- **Side Effects**: file edits in `docs/PRD.md`, the later merger's own `docs/use-cases/*.md` and `docs/qa/*.md`, and `docs/digest-index.md`

---

## UC-7: Digest Dual-Key — Number Matches, Slug Differs → Collision Detected

**Actor**: `docs/digest-index.md`'s refresh logic, Gate 1
**Preconditions**: the digest index has an existing row for feature A: `| 15 | feature-a | ... |`; feature B (per UC-6) initially also computed `15` before its post-sync renumber to `16`
**Trigger**: feature B's digest-index write attempts to run before (or independently of) the PRD renumbering step — e.g. a digest refresh triggered while B's section number is still `15`, colliding with A's existing row

### Primary Flow (Happy Path — Collision Detected, No Overwrite)
1. The digest refresh logic looks up a row keyed on section number `15`.
2. It finds an existing row: number `15`, slug `feature-a`.
3. It compares the incoming write's slug (`feature-b`) against the existing row's slug (`feature-a`) — **mismatch**.
4. Per FR-6, a number match with a slug mismatch is treated as a **detected collision**, not a refresh-in-place. The write is routed through the FR-5 renumber path (UC-6) **before** any write to the digest index occurs.
5. Feature B's PRD section is renumbered to `16` (per UC-6); the digest write is retried keyed on `16`/`feature-b` — no existing row matches, so a **new** row is inserted rather than any row being overwritten.

**Postconditions**: `docs/digest-index.md` contains both `| 15 | feature-a | ... |` (untouched) and `| 16 | feature-b | ... |` (newly inserted); feature A's row is never overwritten, at no point in the sequence.

### Alternative Flows
- **UC-7-A1: number AND slug both match — refresh-in-place proceeds normally** — a subsequent `/merge-ready` run for feature B itself (after it already has row `16`/`feature-b`) updates that same row in place — this is the ordinary, non-collision refresh path, unchanged by this feature.

### Error Flows
- **UC-7-E1: number matches, slug also matches, but a stale automation attempted a blind overwrite** — not reachable under FR-6's dual-key design; documented as the collision class FR-6 specifically closes (the pre-feature single-key design is what silently destroyed the earlier feature's row, per C5/C6).

### Edge Cases
- **UC-7-EC1: slug match, number mismatch** — not treated as this collision class; FR-6's rule is specifically "number match + slug mismatch." A slug match with a differing number reflects UC-6's renumbering having already happened correctly and is the expected shape of the retried write in the primary flow above (step 5).

### Data Requirements
- **Input**: `docs/digest-index.md`'s existing rows (number + slug pairs); the incoming write's own number + slug
- **Output**: either an in-place refresh (both keys match) or a routed renumber-then-insert (number matches, slug doesn't)
- **Side Effects**: `docs/digest-index.md` gains a new row or updates an existing one in place; never a silent overwrite of a mismatched-slug row

---

## UC-8: Release Derives Next Version from `origin/main` After Feature A Already Shipped

**Actor**: Session B (running the Release procedure in `CLAUDE.md`), Developer
**Preconditions**: before either feature started, both sessions' local memory of the "current version" was `4.9.1`; feature A has since merged and released, bumping `origin/main`'s advertised version (across all four version sources per `CLAUDE.md`'s Release section) to `4.10.0`; Session B's long-running session never re-fetched and still holds `4.9.1` in its own working memory
**Trigger**: Session B reaches the Release procedure for feature B

### Primary Flow (Happy Path)
1. Session B's Release procedure does **not** compute the next version from its own memorized `4.9.1` (branch/session memory).
2. It instead fetches `origin/main`'s currently advertised version fresh — from `.claude-plugin/marketplace.json`'s `plugins[0].version` on `origin/main` — reading `4.10.0`.
3. The next version for feature B is derived as `4.11.0` (a minor bump from the origin-advertised `4.10.0`, per the feature's own version-choice classification), not `4.10.0` or `4.9.2` (either of which would result from stale branch-memory derivation).
4. All four version sources (`marketplace.json`, `plugin.json`, `install.sh`, `README.md` badge) are bumped in agreement to `4.11.0`.

**Postconditions**: feature B's release does not collide with or silently overwrite feature A's already-shipped `4.10.0`; `validate-version-consistency.js` and `validate-release-readiness.js` both pass against `4.11.0`.

### Alternative Flows
- **UC-8-A1: both sessions attempt release near-simultaneously** — if Session A and Session B both reach Release before either has actually pushed, both independently fetch `origin/main`'s currently-advertised version (still `4.9.1` at that moment) and both would compute the same next version — this residual race (two branches releasing in the same narrow window) is not eliminated by FR-7; FR-7 closes the specific C8 collision where a long-running branch memorizes a version and never re-checks origin. The documented mitigation remains sequential merging (FR-10/UC-11).

### Error Flows
- **UC-8-E1: fetching `origin/main`'s version fails** — network failure during the version-derivation fetch. Not separately specified by FR-7 as a distinct offline path (unlike Gate 0's FR-4); the Release procedure's existing verification steps (`validate-version-consistency.js`, `validate-release-readiness.js`) would catch an inconsistent bump downstream regardless of the derivation source.

### Data Requirements
- **Input**: `origin/main`'s `.claude-plugin/marketplace.json` `plugins[0].version`, fetched fresh at release time
- **Output**: a next-version number that never collides with or ignores an already-shipped sibling feature's release
- **Side Effects**: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `install.sh`, `README.md` all bumped in agreement

---

## UC-9: Spine Parse Holes — Unparseable `## Branch:` Suppresses the State Block

**Actor**: `session:start:spine`
**Preconditions**: `.claude/scratchpad.md` **exists** in the current worktree (not absent — the absent case is UC-1-A1, unchanged); the file's `## Branch:` value is `undefined` or otherwise fails to parse as a recognizable branch-name token; the actual current git branch (from `git branch --show-current` or equivalent) **is** known and resolvable
**Trigger**: `SessionStart` fires (session start, `resume`, or `compact`) in this worktree

### Primary Flow (Happy Path — Fix Behavior)
1. `session:start:spine` reads `.claude/scratchpad.md` successfully (the file is present and readable).
2. It resolves the actual current branch successfully via the hardened `git-safe.js`-backed `gitBranch` call.
3. It parses `## Branch:` from the scratchpad content and finds the value is `undefined` (literal token) or otherwise not a parseable branch-name shape.
4. Per FR-9, the spine **suppresses the entire state block** — it does not inject any `## Feature:`/`## Branch:`/`## Status:` derived lines from this scratchpad.
5. It prints exactly the literal line `scratchpad: no parseable state`.
6. `sessionStartSpine()` returns its normal `{ hookEventName: 'SessionStart', additionalContext }` shape — no throw.

**Postconditions**: `additionalContext` contains the literal line `scratchpad: no parseable state` and contains **no** sibling-session state (no foreign `## Feature:`/`## Branch:` content is ever confidently injected); no other part of the spine's output (drift line, stale-install line, Prevention Rules) is altered.

### Alternative Flows
- **UC-9-A1: scratchpad file absent entirely** — unchanged, already-designed silent skip: no scratchpad lines at all, no `no parseable state` line either (that line is specific to an *existing-but-unparseable* file, not an absent one).
- **UC-9-A2: `## Branch:` parses correctly and matches the actual branch** — normal case, unaffected by this fix: the state block is injected as designed, no `no parseable state` line appears.

### Error Flows
- **UC-9-E1: actual branch itself cannot be resolved (git failure)** — if the hardened `gitBranch` call itself fails, the spine degrades exactly as it does today for that failure mode (report-only, no crash); this is orthogonal to FR-9's specific fix, which is scoped to the case where the actual branch **is** known but the scratchpad's value isn't parseable.

### Edge Cases
- **UC-9-EC1: `## Branch:` present but empty string** — treated as unparseable (falls under "otherwise unparseable"), producing the same `scratchpad: no parseable state` outcome.
- **UC-9-EC2: sibling-session state previously injected confidently (the pre-fix C10 collision)** — this is precisely the bug this UC's primary flow closes: before this fix, an unparseable `## Branch:` combined with a known actual branch would fall through to confidently injecting whatever state the file did contain (potentially another session's stale state from before de-tracking, or scratchpad corruption). Post-fix, this path is unreachable — the suppression in step 4 is unconditional whenever the parse fails and the actual branch is known.

### Data Requirements
- **Input**: `.claude/scratchpad.md` content (present, unparseable `## Branch:`); the actual current branch name
- **Output**: literal line `scratchpad: no parseable state`; no state block
- **Side Effects**: none — read-only

---

## UC-10: Existing Consumer's Install Run Appends the Scratchpad Ignore Line via a New Independent Idempotency Key

**Actor**: `install.sh`, Developer running `claude plugin install ... --init-project` (or re-running it) against an existing consumer project
**Preconditions**: the target project already has a `.gitignore` file containing `.claude/tmp` (from a prior install) but **not** `.claude/scratchpad.md`; the target project has no `.gitattributes` file yet
**Trigger**: developer re-runs `--init-project` against this existing project after upgrading to the version shipping this feature

### Primary Flow (Happy Path)
1. `install.sh`'s append-if-present `.gitignore` logic checks its **existing** idempotency key (keyed on `.claude/tmp`) — already present, so historically nothing further would be appended for the scratchpad line under the old single-key design.
2. Per FR-1/S3, a **new, independent** idempotency key specifically for `.claude/scratchpad.md` is checked: the line is absent, so it is appended.
3. Separately, the `.gitattributes` scaffold-into-existing-project logic runs: since no `.gitattributes` exists yet, `templates/.gitattributes` is copied in (skip-if-exists semantics — this run copies, since none exists).
4. Re-running `--init-project` a second time immediately after: both the scratchpad-ignore-line key and the `.gitattributes` presence check now find their targets already satisfied — no duplicate lines are appended, no file is overwritten.

**Postconditions**: the existing project's `.gitignore` contains both `.claude/tmp` (pre-existing) and `.claude/scratchpad.md` (newly appended, this run); `.gitattributes` is present and declares `merge=union` for `CHANGELOG.md` and `.claude/instincts.md`; `git check-attr merge -- CHANGELOG.md .claude/instincts.md` reports `union` in this project; the run is idempotent on repeat.

### Alternative Flows
- **UC-10-A1: fresh project, no prior `.gitignore` at all** — `--init-project` in a brand-new sandboxed project (temp HOME, temp cwd, `git init` first) creates `.gitignore` containing both the `.claude/tmp` and `.claude/scratchpad.md` lines from scratch, and scaffolds `.gitattributes` fresh; `git check-attr merge` reports `union` inside the scaffolded sandbox.
- **UC-10-A2: `.gitattributes` already exists (a consumer authored its own)** — the skip-if-exists rule leaves the existing file untouched; no overwrite occurs, even if the existing file lacks the `union` declarations (this is documented as the consumer's own responsibility, not silently repaired).

### Error Flows
None specified — this is a file-scaffolding operation with no external dependency; a filesystem write failure is handled by `install.sh`'s existing general error handling, unchanged by this feature.

### Edge Cases
- **UC-10-EC1: migration note rendering survives `ci.yml`'s shell-syntax greps** — the `git rm --cached ... on main first` migration note text is rendered in a form (e.g. inside a documentation heredoc or comment block) that contains no bare `node`/`jq` invocation outside a `#` comment, so `ci.yml`'s shell-syntax scanning does not misidentify it as an executable command.

### Data Requirements
- **Input**: the target project's existing `.gitignore` content; presence/absence of `.gitattributes`
- **Output**: `.gitignore` gaining the scratchpad ignore line (idempotently); `.gitattributes` scaffolded (skip-if-exists)
- **Side Effects**: two file writes in the target project, both idempotent on re-run

---

## UC-11: Two Sessions in One Checkout (Documented-Unsupported)

**Actor**: Developer, two sessions sharing a single working directory (no `git worktree add` separation)
**Preconditions**: the developer opens two Claude Code sessions both pointed at the same checkout path (not two worktrees) — e.g. two terminal tabs `cd`'d into the same `/Users/dev/Projects/repo`
**Trigger**: both sessions attempt feature work concurrently in the shared checkout

### Primary Flow (Documented-Unsupported Outcome)
1. Both sessions read and write the **same** `.claude/scratchpad.md` file (since there is only one working directory, hence one scratchpad path, regardless of de-tracking).
2. No coordination mechanism exists — FR-10 introduces no lock, no session-id partitioning, no queueing.
3. Session A's `/implement-slice` writes its scratchpad state; Session B's concurrent `/implement-slice` may overwrite it (last-write-wins on the shared file), or Session B may read a state Session A is mid-write on.
4. This is the C11 collision, explicitly **not** solved by a locking mechanism (Out of scope, PRD 15.9 item 11) — it is addressed purely by documentation: `src/rules/git.md` (≤3 added lines), `README.md`'s parallel-operation section, and the findings doc all state the rule — **one Claude Code session per git worktree** — as the required operating model.

**Postconditions**: no new mechanical safeguard exists for this scenario; the documented remedy is procedural (use separate worktrees), not code; a developer who violates the one-session-per-worktree rule receives no warning from the harness itself.

### Alternative Flows
- **UC-11-A1: developer corrects course to separate worktrees** — the developer creates a second worktree (`git worktree add ../repo-feat-b feat/b`) and moves Session B there; from that point forward, the scenario is UC-1's supported primary flow, not this one.

### Error Flows
None — this is a documented limitation, not an error condition the code detects or reports on.

### Edge Cases
- **UC-11-EC1: hostile parent environment variables never reach a git child process** — orthogonal to the same-checkout scenario but exercised on the same `git-safe.js` code path used throughout this feature: a parent shell environment seeded with a hostile `GIT_CONFIG_COUNT` (or `GIT_CONFIG_PARAMETERS`, or an alternate-object-directory variable) is never inherited by any git child process `git-safe.js` spawns — the child environment is constructed **fresh as an explicit allowlist** (`PATH`, `LANG`, `LC_ALL`, `GIT_CONFIG_GLOBAL: '/dev/null'`, `GIT_CONFIG_SYSTEM: '/dev/null'`, `GIT_CONFIG_NOSYSTEM: '1'`, `GIT_TERMINAL_PROMPT: '0'`, `GIT_OPTIONAL_LOCKS: '0'`), never `Object.assign({}, process.env, ...)`. Verified by `tests/hooks/test-git-safe.js` seeding `GIT_CONFIG_COUNT` in the parent process and asserting the spawned child never observes it.
- **UC-11-EC2: non-worktree project — byte-identical behavior** — a project that has never used `git worktree` at all (the common case for most consumers) sees zero behavioral change from this entire feature on the trust check, the spine, or Gate 0's base-sync logic beyond the FR-4 sync procedure itself (which applies regardless of worktree usage) — confirmed by an explicit before/after comparison in AC-7.

### Data Requirements
- **Input**: none beyond the shared checkout's single scratchpad file
- **Output**: none — no mechanical output distinguishes this scenario from a correctly-separated one
- **Side Effects**: potential scratchpad state corruption between the two sessions (undetected, undocumented-as-safe, explicitly out of scope to prevent mechanically)

---

## Traceability

| Use Case | PRD Requirements |
|---|---|
| UC-1 (Primary) | FR-1, AC-1 |
| UC-1-A1 | FR-1, Triage FR-3.5 |
| UC-1-A2 | FR-1, FR-4 (singleton conflict rules) |
| UC-2 (Primary) | FR-4, AC-4 |
| UC-2-A1 | FR-4 (offline degrade), AC-4 |
| UC-2-A2 | FR-4 (quick-tier), AC-4 |
| UC-2-A3 | FR-2, FR-3, Risk 2 |
| UC-2-A4 | FR-4 (non-singleton conflict), error-recovery Rule 3 |
| UC-2-E1 | FR-4 (base resolution fallback) |
| UC-2-E2 | FR-4 (offline degrade) |
| UC-2-EC1 | FR-4 |
| UC-2-EC2 | FR-4 (mid-run sync), error-recovery Rule 3 |
| UC-3 (Primary) | FR-2, AC-2 |
| UC-3-A1 | FR-2 (class e) |
| UC-3-A2 | FR-2 (class b, confidence ceiling) |
| UC-3-E1 | FR-2, NFR-4, AC-2 |
| UC-3-EC1 | FR-2 (class c) |
| UC-3-EC2 | FR-2 (mechanical prose-binding), AC-2 |
| UC-4 (Primary) | FR-8, AC-7 |
| UC-4-A2 | FR-8 (non-worktree byte-identical), AC-7 |
| UC-4-E1 | FR-8, NFR-6, AC-7 |
| UC-4-E2 | FR-8 (submodule shape), AC-7 |
| UC-4-EC1 | FR-8 (existing preserved behavior) |
| UC-5 (Primary) | FR-8 (reject path), Risk 4 |
| UC-5-A1 | FR-8 (manual registration) |
| UC-6 (Primary) | FR-5, AC-5 |
| UC-6-A1 | FR-5 |
| UC-6-E1 | FR-5, NFR-4, AC-5 |
| UC-6-EC1 | FR-5 (never reuse) |
| UC-7 (Primary) | FR-6, AC-5 |
| UC-7-A1 | FR-6 |
| UC-7-EC1 | FR-6 |
| UC-8 (Primary) | FR-7, AC-6 |
| UC-8-A1 | FR-7 (residual race, documented) |
| UC-8-E1 | FR-7 |
| UC-9 (Primary) | FR-9, AC-8 |
| UC-9-A1 | FR-9, FR-1, AC-8 |
| UC-9-A2 | FR-9 |
| UC-9-E1 | FR-9 (orthogonal git failure) |
| UC-9-EC1 | FR-9 |
| UC-9-EC2 | FR-9 (C10 closed) |
| UC-10 (Primary) | FR-1, FR-2/FR-3 (.gitattributes scaffold), AC-1, AC-10 |
| UC-10-A1 | FR-1, AC-1, AC-10 |
| UC-10-A2 | FR-2/FR-3 (skip-if-exists) |
| UC-10-EC1 | NFR-5 (ci.yml parity) |
| UC-11 (Primary) | FR-10 |
| UC-11-A1 | FR-10 |
| UC-11-EC1 | FR-8 (hardening spec), NFR-6, AC-7 |
| UC-11-EC2 | FR-8, AC-7 |
