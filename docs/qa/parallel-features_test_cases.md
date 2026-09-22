# Test Cases: Parallel Feature Sessions

> Based on [PRD](../PRD.md) — Section 15 and [Use Cases](../use-cases/parallel-features_use_cases.md)

---

## 1. Testing Approach and Test-Kind Classification

This feature ships no UI, no server, no database, and — critically — **invokes no agent as its
own test method**. Every mechanism it adds is either a file/git-state assertion (`.gitignore`,
`.gitattributes`, scratchpad tracking, instinct-store repair, PRD numbering, digest rows, the
trust check, the spine handler) checkable by a script/CI validator with zero LLM invocation, or a
multi-step orchestrated procedure (`/merge-ready`'s Gate 0/Gate 1, a live worktree rehearsal, a
`/bootstrap-feature` run) that must be driven end-to-end to observe. Consequently this document
uses exactly two kinds:

- **STATIC** — a script/CLI/git command or an existing hook-unit-test run against the repository
  or a seeded fixture directory, with zero LLM/agent invocation. This covers the CI validators
  (`validate-instinct-store.js`, `validate-instinct-discipline.js`, `validate-prd-numbering.js`,
  `validate-context-budget.js`), the hermetic `tests/hooks/test-union-merge.js` and
  `tests/hooks/test-git-safe.js` and `tests/hooks/test-guards-cross.js`, `install.sh` sandboxed
  runs, `git check-ignore`/`git check-attr`/`git ls-files` assertions, byte-count/diff checks, and
  `ci.yml` diff-grep constraints.
- **BEHAVIORAL** — driving an orchestrating skill (`/merge-ready`, `/bootstrap-feature`) or a real
  multi-session git-worktree scenario through a live run and observing the aggregate outcome
  (e.g. Gate 0's online/offline sync paths, the Gate 6 live worktree rehearsal, two parallel
  sessions bootstrapping independently). Not automatable in this repository's CI today; specified
  precisely enough (literal strings, exit/degrade states, commit shapes) for a human reviewer to
  execute exactly as written.

**Zero-FIXTURE document, stated per the house convention:** this feature has no `agents/*.md`
invocation anywhere in its own verification path — `design-reviewer` is mentioned only in passing
(FR-8's one added trust-gate sentence, a STATIC grep target, not an invocation this document
tests). No test case below carries the `FIXTURE` kind. This keeps
`scripts/ci/validate-fixture-manifest.js`'s bijection trivially satisfied (zero `FIXTURE` cells ↔
zero fixture-manifest entries required by this document).

The Kind column carries only the bare literal `STATIC` or `BEHAVIORAL` — any qualifier (e.g.
"offline," "negative," "seeded") lives in the Test Case description cell, never appended to the
Kind cell, per the house discipline `validate-fixture-manifest.js`'s `extractFixtureIds` depends
on.

---

## 2. UC-1: Two Sessions Bootstrap Two Features in Two Worktrees — Scratchpads Never Merge

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-1.1 | UC-1 Primary Flow, AC-1 | STATIC | Scratchpad is ignored, never tracked, in this repo | Repo has run FR-1's de-track migration | Run `git check-ignore --no-index .claude/scratchpad.md`; run `git ls-files .claude/scratchpad.md` | `check-ignore` matches (exit 0, prints the path); `ls-files` returns empty output |
| TC-1.2 | UC-1 Primary Flow | BEHAVIORAL | Two parallel sessions in two worktrees each write only their own local scratchpad across a full bootstrap→slice→commit cycle, never staged | Two `git worktree add` checkouts on distinct branches, both against the same shared `.git` | Run `/bootstrap-feature` then one `/implement-slice` iteration in each worktree concurrently; inspect `git status` and each branch's commit history after | Each worktree's `.claude/scratchpad.md` shows as untracked in `git status`; neither branch's commit history contains a scratchpad hunk; the two scratchpad files' contents diverge (`## Feature:`/`## Branch:` per worktree) with no cross-contamination |
| TC-1.3 | UC-1-A1 | STATIC | Absent scratchpad in a fresh worktree produces no spine output, no throw | Third worktree created, no `.claude/scratchpad.md` present, no prior `/bootstrap-feature` run | Trigger `session:start:spine` (via its handler test or a `SessionStart` simulation) in this worktree | No scratchpad-state lines emitted; handler returns normally, no exception |
| TC-1.4 | UC-1-A1 | BEHAVIORAL | `/bootstrap-feature`'s Write path creates the scratchpad fresh in a worktree that had none | Same third worktree as TC-1.3, still no scratchpad file | Run `/bootstrap-feature` | `.claude/scratchpad.md` is created in this worktree, populated with the new feature's state |
| TC-1.5 | UC-1-A1 | STATIC | Fast-tier request in a scratchpad-absent worktree performs no scratchpad write (FR-3.5) | Worktree with no scratchpad file; a request classifiable as `tier: fast` | Classify and dispatch the fast-tier request per Triage; inspect the worktree filesystem after | No `.claude/scratchpad.md` file is created as a side effect of the fast-tier run |
| TC-1.6 | UC-1-A2 | STATIC | Legacy tracked-scratchpad consumer: sync-time conflict resolves via `ours` (singleton rule) | Seeded fixture repo where `.claude/scratchpad.md` is still `git ls-files`-tracked; two branches both modified it since diverging | Simulate the FR-4 sync merge (`git merge origin/<base>`) on the seeded fixture | The scratchpad conflict resolves via `ours` (the merging branch's own content wins, the other side's content is discarded) — verified by the post-merge file content matching the merging branch's pre-merge content exactly |
| TC-1.7 | UC-1-E1 | — | Cross-reference only — see UC-9 (spine parse holes), Section 9 below | — | — | Not duplicated here |
| TC-1.8 | UC-1-EC1 | — | Cross-reference only — see UC-11 (documented-unsupported), Section 12 below | — | — | Not duplicated here |

---

## 3. UC-2: Feature A Merges First; Feature B's Gate 0 Syncs, Unions, and Folds

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-2.1 | UC-2 Primary Flow, AC-4 | BEHAVIORAL | Full online sync: base resolution → fetch → behind-count → merge-not-rebase remedy → union auto-resolve → preamble → fold → conventional sync commit → Gates 2/3 invalidated | Real worktree, `feat/b` behind `origin/main` by N commits (feature A already merged), `.gitattributes` declares `merge=union` for `CHANGELOG.md`/`.claude/instincts.md`, both files touched on both sides, Gates 2/3 already passed earlier in this run | Run `/merge-ready` for feature B | `git rev-parse --abbrev-ref origin/HEAD` resolves the base; `git fetch origin <base>` succeeds; `git rev-list --count HEAD..origin/<base>` returns N>0; the remedy is `git merge -m "chore(core): sync feat/b with main" origin/main` (never a rebase — verified by absence of any `git rebase` invocation); instincts/changelog auto-resolve with zero conflict markers; the Reconciliation preamble and fold step both run; the post-conflict commit (if any) matches `chore(core): sync feat/b with main` and passes `CONVENTIONAL_RE`; Gate 0 reports PASS; Gates 2 and 3 are shown re-run, not reused from the earlier pass |
| TC-2.2 | UC-2-A1, E2 | BEHAVIORAL | Offline/timeout degrade: fetch failure never blocks Gate 0 | Real or simulated worktree; `git fetch origin main` engineered to fail (network down or bounded-timeout expiry) | Run `/merge-ready` (or invoke Gate 0's sync step directly) | Gate 0 emits the literal line `base sync unavailable (<reason>) — comparing against local <base>`; comparison proceeds against the locally cached `main` ref; Gate 0 does not hard-block solely on the fetch failure; the timeout is bounded (does not hang) |
| TC-2.3 | UC-2-A2 | BEHAVIORAL | Quick-tier Gate 0 runs the identical full FR-4 procedure, unabridged | `tier: quick` slice reaching `/merge-ready`'s reduced gate subset | Run `/merge-ready` under `tier: quick` | Gate 0 still runs base resolution, fetch, behind-count, merge-not-rebase remedy, and singleton conflict rules exactly as under `tier: full`; the offline-degrade line and local-ref comparison logic are identical, not skipped or abridged by the reduced gate subset |
| TC-2.4 | UC-2-A3 | STATIC | Pre-`.gitattributes` worktree's first sync raises raw conflict markers, not a clean union | Seeded fixture: merging-side worktree has no `.gitattributes` at sync time | Simulate the sync merge on `.claude/instincts.md`/`CHANGELOG.md` in the fixture | Raw `<<<<<<<`/`=======`/`>>>>>>>` conflict markers are produced (not a silent clean union); this is the accepted Risk-2 degrade, resolved manually per FR-4's singleton rules |
| TC-2.5 | UC-2-A4 | BEHAVIORAL | Non-singleton file conflict resolved normally by the developer; sync commit shape and Gate 2/3 invalidation still apply | Real worktree where the sync merge conflicts in a source file that is neither scratchpad, instincts, nor changelog | Run the sync merge; resolve the conflict manually; observe the post-conflict commit and Gate 2/3 status | The conflict is resolved through ordinary git means (not a singleton rule); the post-conflict commit still matches `chore(core): sync <branch> with <base>`; Gates 2/3 are marked invalidated and re-run |
| TC-2.6 | UC-2-E1 | STATIC | `origin/HEAD` unset → fallback chain to `main` then `master`, never a crash | Fixture repo with no `origin/HEAD` set and no `main` branch, only `master` | Run Gate 0's base-resolution step | `git rev-parse --abbrev-ref origin/HEAD` fails; falls back to `main` (also absent); falls back to `master` (resolves); no exception/crash at any fallback step |
| TC-2.7 | UC-2-EC1 | STATIC | Branch already up to date — no sync commit, no invalidation | Fixture repo where `git rev-list --count HEAD..origin/<base>` returns 0 | Run Gate 0's sync step | Gate 0 reports the branch current; the merge remedy is skipped entirely; no sync commit is created; Gates 2/3 status is untouched (no invalidation) |
| TC-2.8 | UC-2-EC2 | BEHAVIORAL | Mid-run sync after Gates 2/3 already passed invalidates them per the existing Auto-Fix rule | Real worktree run where the sync merge lands after Gate 2 and Gate 3 already reported PASS in this invocation | Trigger the sync merge mid-run; observe Gate 2/3 status | Gates 2 and 3 are marked invalidated and must re-run before `/merge-ready` can report MERGE READY |

---

## 4. UC-3: Both Features Captured the Same Instinct Slug — Reconciliation Unions Correctly

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-3.1 | UC-3 Primary Flow, AC-2 | STATIC | `tests/hooks/test-union-merge.js` — hermetic two-branch merge asserts zero conflict markers and correct union artifacts | Hermetic two-branch test repo: both branches add a changelog entry, add the same-slug instinct entry, and bump `Feature counter` | Run `tests/hooks/test-union-merge.js` (part of the full sweep) | Merge produces zero conflict markers; union artifacts present per classes (a)-(e); `stop-changelog-guard`'s head check still passes on the union output |
| TC-3.2 | UC-3 Primary Flow (class a) | STATIC | Duplicate `Feature counter:` lines repair to `max`, never a sum | Seeded fixture: two `Feature counter: 19` and `Feature counter: 20` lines present post-merge | Run the Reconciliation preamble's repair logic (or `validate-instinct-store.js` post-repair) against the fixture | Exactly one `Feature counter: 20` line remains — the max, not `21` (sum) — confirming the stated safe-direction (undercount, never premature retirement) |
| TC-3.3 | UC-3 Primary Flow (class b) | STATIC | Duplicate `### <slug>` entries union `(features: ...)`, `Occurrences:` floored at union length, `Confidence:` = min(ceiling, max) | Seeded fixture: `### db-null-check` on side A (`Occurrences: 2 (features: a1, a2)`, `Confidence: 0.7`) and side B (`Occurrences: 2 (features: b1, b2)`, `Confidence: 0.5`) | Run the repair against the fixture; run `validate-instinct-store.js` post-repair | Exactly one `### db-null-check` entry remains with `(features: a1, a2, b1, b2)`; `Occurrences: 4`; `Confidence:` equals `min(formula_ceiling(4), 0.7)` — never reset to the ceiling outright; `validate-instinct-store.js` finds zero remaining class-(a)-(e) artifacts |
| TC-3.4 | UC-3 Primary Flow (class d) | STATIC | Duplicate field lines within one repaired entry collapse to one, keeping the repaired value | Seeded fixture: post-union entry carries two `Last confirmed at:` lines | Run the repair | Exactly one `Last confirmed at:` line remains, holding the correct post-repair value; the duplicate line is dropped |
| TC-3.5 | UC-3-A1 (class e) | STATIC | Duplicated `## Prevention Rules` section headings fold into one before entry-level repair applies | Seeded fixture: two `## Prevention Rules` headings from independent elevations on each branch | Run the repair | A single `## Prevention Rules` heading remains, containing the union of both sides' blocks; classes (a)-(d) are then applied correctly to entries now co-located there |
| TC-3.6 | UC-3-A1 (class b, cross-section) | STATIC | Cross-section duplicate (one elevated, one not) repairs to a single entry placed per the elevation threshold, deleting the other copy | Seeded fixture: one side's `### <slug>` entry lives in `## Prevention Rules` (already elevated, `security` category), the other side's copy lives in `## Instincts Log`; repaired occurrence count meets the `security` threshold (2) | Run the repair; run `validate-instinct-store.js` post-repair | Exactly one entry remains, placed in `## Prevention Rules` (threshold met); the `## Instincts Log` copy is deleted, not left as a second, unplaced duplicate |
| TC-3.7 | UC-3-A2 (class b, ceiling binds) | STATIC | Confidence ceiling is the binding constraint even when the less-decayed side is higher | Seeded fixture where the formula's ceiling at the repaired occurrence count computes to `0.6`, lower than side A's `0.7` | Run the repair | Repaired `Confidence: 0.6`, not `0.7` — the ceiling caps the result unconditionally |
| TC-3.8 | UC-3-E1 | STATIC | `validate-instinct-store.js` fails a fixture with a duplicated `Feature counter:` that the preamble never repaired | Seeded fixture: two `Feature counter:` lines present, no repair applied (simulating a skipped/regressed preamble) | Run `validate-instinct-store.js --root <fixture>` | Validator reports FAIL at its pinned expected-problem count for this artifact class (exact count fixed at implementation time per NFR-4) rather than silently reading only the first match |
| TC-3.9 | UC-3-EC1 (class c) | STATIC | `Last confirmed at` exceeding the repaired counter is clamped and `Retires at` recomputed | Seeded fixture: a duplicated entry's `Last confirmed at: 21`, repaired counter `20` | Run the repair | `Last confirmed at` is clamped to `20`; `Retires at` is recomputed from the clamped value — the entry cannot outlive the counter that produced it |
| TC-3.10 | UC-3-EC2 | STATIC | `validate-instinct-discipline.js` fails a seeded merge-ready copy whose Reconciliation preamble prose omits one of the five class names | Seeded fixture: merge-ready SKILL.md mirror text authored from the plan's canonical class list, with class (d) intentionally omitted | Run `validate-instinct-discipline.js --root <fixture>` | FAIL at the pinned re-pinned expected-problem count for the missing-class assertion |
| TC-3.11 | AC-2, NFR-4 | STATIC | Five `bad-merge-*` fixtures — one per artifact class (a)-(e) — each fails at its own independently pinned count | `tests/fixtures/ci/instinct-store/bad-merge-{a,b,c,d,e}/` each seeded with exactly one artifact class's defect, otherwise clean | Run `validate-instinct-store.js` against each fixture in turn | Each `bad-merge-*` fixture fails at its own pinned expected-problem count (5 independent pins, one per class); an empty/clean template fixture passes with zero problems; `ci.yml` wires a Falsify AND an anti-vacuity step per fixture family |
| TC-3.12 | NFR-4 | STATIC | Two pre-existing `bad-weakened` discipline fixtures re-pinned after the class-name assertion is added | `tests/fixtures/ci/instinct-discipline/bad-weakened/` and `bad-weakened-dedup/`, both gaining the preamble's class markers so each stays "passing except its single defect" | Run `validate-instinct-discipline.js` against both fixtures | Both fail at their re-pinned expected-problem counts (not their pre-feature counts); anti-vacuity holds (requireMinimum returns before content checks, per the plan's stated safety note) |
| TC-3.13 | NFR-4 | STATIC | `ci.yml` diff for the S7 instinct-validator wiring is additive-only (mechanical, in lieu of a security agent pass) | `.github/workflows/ci.yml` diff for this slice | Run `git diff .github/workflows/ci.yml \| grep -E '^\+.*(uses:\|permissions:\|secrets)'` | Empty output — the diff adds only validator invocations, no new `uses:`, `permissions:`, or `secrets` lines |

---

## 5. UC-4: Worktree Session Inherits Trust from the Registered Main Root

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-4.1 | UC-4 Primary Flow, AC-7 | STATIC | Real worktree of a registered main root resolves trusted via `--git-common-dir` fallback | `tests/hooks/test-stop-typecheck-format.js` seeds: trust registry has only the main root registered; a `git worktree add`-created worktree checked against it | Run `isTrustedProject` (via the hook's test suite) against the worktree path | Exact-path match fails; `hooks/lib/git-safe.js`'s hardened spawn runs `git rev-parse --git-common-dir` (no `--path-format` flag) from the worktree; realpathed result's basename is `.git`; `path.dirname` yields the main root, which matches the registry; the worktree resolves trusted |
| TC-4.2 | UC-4 Primary Flow | BEHAVIORAL | `stop:typecheck-format` runs the real (not report-only) command once trust is inherited | Same registered-main/unregistered-worktree setup as TC-4.1, real worktree | Trigger the `Stop` hook in the worktree | The project's real typecheck/lint command runs (enforced, not report-only) |
| TC-4.3 | UC-4 Primary Flow | BEHAVIORAL | Gate 8's design-reviewer preview is eligible (not refused for being untrusted) in the inheriting worktree | Same setup, `/merge-ready` reaching Gate 8 | Run `/merge-ready` through Gate 8 in the worktree | Gate 8's preview step is not refused on trust grounds |
| TC-4.4 | UC-4-A2, AC-7 | STATIC | Non-worktree project: exact-path match succeeds directly, `--git-common-dir` fallback never invoked, byte-identical to pre-feature | Plain, non-worktree checkout, its own root directly registered | Run `isTrustedProject` against the plain checkout, with a spy/assertion on whether the fallback git call fires | Exact match succeeds on the first check; the `--git-common-dir` fallback is never invoked; behavior matches the pre-feature implementation exactly |
| TC-4.5 | UC-4-E1, NFR-6 | STATIC | `git rev-parse --git-common-dir` failure degrades to untrusted, report-only, never throws | Seeded fixture: corrupted `.git` or permissions failure causing the git child to exit non-zero | Run `isTrustedProject` against the fixture | Returns untrusted; no exception is thrown; report-only fail-open discipline preserved |
| TC-4.6 | UC-4-E2 | STATIC | Submodule-shaped common-dir resolves untrusted, never matched via `path.dirname` | Seeded fixture where `git rev-parse --git-common-dir` (realpathed) resolves to `.../repo/.git/modules/some-submodule` | Run `isTrustedProject` against the fixture | Treated as no-match → untrusted; `path.dirname` is never applied to a non-`.git`-basename path |
| TC-4.7 | UC-4-EC1 | STATIC | Empty/missing trust registry file returns untrusted for every path — unchanged pre-feature behavior | Registry file absent or empty | Run `isTrustedProject` against any path | Returns untrusted for every path, identical to pre-feature behavior; not treated as a new error condition |
| TC-4.8 | UC-4-A1 / UC-11-EC1, AC-7 | STATIC | `tests/hooks/test-git-safe.js`: hostile parent `GIT_CONFIG_COUNT` never reaches the spawned git child | Parent test process env seeded with a hostile `GIT_CONFIG_COUNT` (and separately, `GIT_CONFIG_PARAMETERS`, and an alternate-object-directory variable) | Run `tests/hooks/test-git-safe.js`, invoking `hooks/lib/git-safe.js`'s hardened spawn with the hostile parent env present | The spawned child process never observes the hostile variable(s); the child env matches the fresh allowlist exactly: `{ PATH, LANG, LC_ALL, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' }`; `-c core.fsmonitor=` present on argv; `shell:false`; a bounded `timeout` + `killSignal`; `stdio: ['ignore','pipe','pipe']`; `maxBuffer` cap present |
| TC-4.9 | AC-7 | STATIC | `tests/hooks/test-guards-cross.js`'s split invariant: env-allowlist/`core.fsmonitor` shape asserted at the spawn site, delegation asserted at consumers | `hooks/lib/git-safe.js` (spawn site) and its two consumers (`stop-typecheck-format.js`, `session-start-spine.js`) | Run `tests/hooks/test-guards-cross.js` | The allowlist-env + `core.fsmonitor` structural shape is asserted only inside `hooks/lib/git-safe.js` (path-joined from `REPO_ROOT`, not `HANDLERS`); each of the two consumers is asserted to `require` `git-safe.js` and to contain no direct `spawnSync('git', ...)` call — literal-shape assertions are never duplicated into the consumer files |
| TC-4.10 | AC-7 | STATIC | `gitBranch`'s spawn is migrated onto the hardened helper (was previously unhardened, no env at all) | `hooks/handlers/session-start-spine.js`'s `gitBranch` call | Grep `session-start-spine.js` for a direct unhardened `spawnSync('git'` invocation vs. a `git-safe.js` require/delegation | No direct unhardened git spawn remains in `gitBranch`; it delegates to `hooks/lib/git-safe.js` |
| TC-4.11 | AC-9 | STATIC | Stale-install matching recognizes worktrees via the helper | Seeded worktree scenario where the spine's stale-install check previously mismatched due to exact-path comparison | Trigger the spine's stale-install check in a worktree | The stale-install line is emitted correctly (not silently suppressed) in the worktree, using the same `--git-common-dir` resolution as the trust check |

---

## 6. UC-5: Security Review Rejects Trust Inheritance (Reject Path)

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-5.1 | UC-5 Primary Flow, Risk 4 | STATIC | Reject path: `isTrustedProject` handler diff is empty relative to pre-feature | security-auditor pre-review returns REJECT for `hooks/lib/git-safe.js`'s trust-check consumption | Run `git diff <pre-feature-base> -- hooks/handlers/stop-typecheck-format.js` (the `isTrustedProject` handler) | Diff is empty — handler code is byte-identical to its pre-feature exact-path-match-only behavior; no `git-safe.js` consumption is wired into the trust check |
| TC-5.2 | UC-5 Primary Flow | STATIC | `agents/design-reviewer.md` documents manual per-worktree registration instead of automatic inheritance | Same REJECT precondition | Grep `agents/design-reviewer.md` for the trust-gate sentence | Sentence describes per-worktree manual registration as the supported path, not automatic inheritance |
| TC-5.3 | UC-5 Primary Flow | STATIC | README's trust-behavior paragraph matches the reject-path outcome | Same REJECT precondition | Grep `README.md`'s parallel-operation section | Paragraph describes manual per-worktree registration, not automatic inheritance |
| TC-5.4 | UC-5-A1 | STATIC | Manually registered worktree resolves trusted via the unchanged exact-path match, with the fallback never invoked | Developer adds the worktree's own path as a distinct registry entry, under the reject path | Run `isTrustedProject` against the manually registered worktree path | Exact-path match succeeds directly; no `--git-common-dir` fallback logic runs (none was wired in under the reject path) |

---

## 7. UC-6: PRD Numbering — Duplicate Section Detected and Renumbered Post-Sync

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-6.1 | UC-6 Primary Flow, AC-5 | BEHAVIORAL | Full renumber flow: sync produces duplicate `## 15.`, Gate 1 detects it, the later merger's section is renumbered, all three reference classes updated | Real worktree: feature A's `## 15.` already merged/authoritative; feature B independently allocated `## 15.` before sync; Gate 0 sync has just landed both sections in `docs/PRD.md` | Run `/merge-ready` for feature B through Gate 1 | Gate 1's post-sync uniqueness re-check detects the duplicate `## 15.`; feature B's section (never A's) is renumbered to `## 16.`; `docs/use-cases/<feature-b>_use_cases.md`'s header line, `docs/qa/<feature-b>_test_cases.md`'s header line, and any pending `docs/digest-index.md` row for feature B are all updated from `15` to `16`; feature A's section and cross-references are untouched; Gate 1 re-checks and PASSes with no duplicates remaining |
| TC-6.2 | UC-6-A1 | STATIC | No collision — B's allocation already unique post-sync — Gate 1 PASSes on the first check, no renumbering | Fixture `docs/PRD.md` post-sync with no duplicate `## N.` headings | Run Gate 1's uniqueness re-check | PASS on the first check; no renumbering occurs |
| TC-6.3 | UC-6-E1, NFR-4 | STATIC | `validate-prd-numbering.js` fails a seeded duplicate-heading fixture at a pinned count; passes the real PRD | `tests/fixtures/ci/prd-numbering/` seeded with a deliberately duplicated `## N.` heading; real `docs/PRD.md` in its normal single-writer state | Run `validate-prd-numbering.js --root <fixture>`, then against the real `docs/PRD.md` | Fixture: FAIL at its pinned expected-problem count. Real PRD: PASS with zero problems. `ci.yml` wires a Falsify step AND an anti-vacuity step for this validator |
| TC-6.4 | UC-6-EC1 | STATIC | Renamed/moved section never reuses its original number — allocation is `max + 1`, not "next available gap" | Fixture PRD where an earlier section (e.g. `## 7.`) was renamed/moved, leaving no heading with that literal text | Apply `agents/prd-writer.md`'s allocation rule to compute the next section number | The next allocated number is `max(existing section numbers) + 1`; `7` (or whichever number was vacated) is never reallocated |
| TC-6.5 | NFR-4 | STATIC | `ci.yml` diff for the S8 PRD-numbering wiring is additive-only | `.github/workflows/ci.yml` diff for this slice | Run `git diff .github/workflows/ci.yml \| grep -E '^\+.*(uses:\|permissions:\|secrets)'` | Empty output |

---

## 8. UC-7: Digest Dual-Key — Number Matches, Slug Differs → Collision Detected

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-7.1 | UC-7 Primary Flow, AC-5 | STATIC | Number match + slug mismatch is detected as a collision, routed through the renumber path before any write — no overwrite | `docs/digest-index.md` has an existing row `\| 15 \| feature-a \| ...`; incoming write is `15`/`feature-b` | Run the digest refresh logic against the incoming write | The number/slug comparison detects a mismatch; the write is routed through the FR-5 renumber path (feature B renumbered to `16`) before any digest write occurs; the retried write (keyed `16`/`feature-b`) inserts a **new** row; the existing `\| 15 \| feature-a \|` row is never overwritten at any point in the sequence |
| TC-7.2 | UC-7-A1 | STATIC | Number AND slug both match → ordinary refresh-in-place, unchanged behavior | Existing row `\| 16 \| feature-b \| ...`; a subsequent `/merge-ready` run for feature B itself writes `16`/`feature-b` again | Run the digest refresh logic | The existing row is updated in place; no collision path is triggered |
| TC-7.3 | UC-7-EC1 | STATIC | Slug match, number mismatch — not treated as this collision class; reflects a correctly-completed renumber | Row `\| 16 \| feature-b \|` already present (post-renumber); a retried write for `16`/`feature-b` follows | Run the digest refresh logic | Treated as the expected in-place-refresh shape (per TC-7.2), not misclassified as a fresh collision |
| TC-7.4 | UC-7-E1 | STATIC | Documented-unreachable class: a stale automation cannot blind-overwrite under the dual-key design | N/A — negative/documentation assertion | Attempt a single-key (number-only) overwrite against a mismatched-slug row using the FR-6 dual-key logic | The dual-key check rejects the single-key overwrite path; the collision route (TC-7.1) is the only reachable outcome for a number-match/slug-mismatch input |

---

## 9. UC-8: Release Derives Next Version from `origin/main` After Feature A Already Shipped

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-8.1 | UC-8 Primary Flow, AC-6 | BEHAVIORAL | Stale local memory (`4.9.1`) vs. newer origin-advertised version (`4.10.0`) — release derives from origin, not memory | Session B's working memory holds `4.9.1`; `origin/main`'s `.claude-plugin/marketplace.json` `plugins[0].version` (post feature-A release) reads `4.10.0` | Run the Release procedure for feature B | Session B fetches `origin/main`'s currently advertised version fresh (`4.10.0`), not its memorized `4.9.1`; the next version computed is `4.11.0` (minor bump from origin), never `4.10.0` or `4.9.2`; all four version sources (`marketplace.json`, `plugin.json`, `install.sh`, `README.md` badge) are bumped in agreement to `4.11.0` |
| TC-8.2 | AC-6 | STATIC | `validate-version-consistency.js` and `validate-release-readiness.js` both pass against the origin-derived version | Post-TC-8.1 state, all four sources at `4.11.0` | Run both validators | Both PASS |
| TC-8.3 | UC-8-A1 | BEHAVIORAL | Near-simultaneous release race — documented residual, not eliminated by FR-7 | Both Session A and Session B reach Release before either has pushed; `origin/main` still advertises `4.9.1` at that moment for both | Run both sessions' Release procedures concurrently | Both independently compute the same next version (the race is not eliminated); this is the documented residual — the mitigation is sequential merging (FR-10), not a code fix |
| TC-8.4 | UC-8-E1 | STATIC | Version-derivation fetch failure is caught downstream by existing consistency validators, not a distinct FR-7 offline path | Simulated `origin/main` fetch failure during version derivation, followed by an inconsistent local bump | Run `validate-version-consistency.js` against the inconsistent result | Validator FAILs, catching the inconsistency; FR-7 does not specify a separate offline degrade for this path (by design) |

---

## 10. UC-9: Spine Parse Holes — Unparseable `## Branch:` Suppresses the State Block

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-9.1 | UC-9 Primary Flow, AC-8 | STATIC | Existing-but-unparseable `## Branch:` with a known actual branch suppresses the state block and prints the exact literal line | `.claude/scratchpad.md` exists; `## Branch:` value is the literal token `undefined`; actual current branch resolves successfully via the hardened `gitBranch` call | Trigger `session:start:spine`'s `SessionStart` handler | `additionalContext` contains exactly the literal line `scratchpad: no parseable state`; no `## Feature:`/`## Branch:`/`## Status:` derived lines are injected; handler returns its normal `{ hookEventName: 'SessionStart', additionalContext }` shape, no throw; drift line, stale-install line, and Prevention Rules injection are unaffected |
| TC-9.2 | UC-9-A1 | STATIC | Scratchpad file absent entirely — unchanged silent skip, distinct from the unparseable case | `.claude/scratchpad.md` does not exist in this worktree | Trigger `session:start:spine` | No scratchpad lines at all emitted; the `scratchpad: no parseable state` line does NOT appear (that line is reserved for existing-but-unparseable, never absent) |
| TC-9.3 | UC-9-A2 | STATIC | `## Branch:` parses correctly and matches the actual branch — normal state-block injection, no fix-path line | `.claude/scratchpad.md` exists with a well-formed `## Branch: feat/x` matching the actual current branch | Trigger `session:start:spine` | State block is injected as designed; `scratchpad: no parseable state` does not appear |
| TC-9.4 | UC-9-E1 | STATIC | Actual-branch resolution itself fails (git failure) — orthogonal degrade, unchanged from today | The hardened `gitBranch` call fails | Trigger `session:start:spine` | Degrades exactly as pre-fix for this orthogonal failure mode: report-only, no crash; FR-9's suppression logic is not engaged since the actual branch is not known |
| TC-9.5 | UC-9-EC1 | STATIC | `## Branch:` present but an empty string is treated as unparseable | `.claude/scratchpad.md` exists with `## Branch: ` (empty value) | Trigger `session:start:spine` | Same outcome as TC-9.1: `scratchpad: no parseable state`, no state block |
| TC-9.6 | UC-9-EC2 | STATIC | Post-fix, sibling-session state is never confidently injected when parse fails and the actual branch is known — the C10 collision is closed | `.claude/scratchpad.md` exists with foreign/stale sibling-session content and an unparseable `## Branch:`; actual branch is known | Trigger `session:start:spine` | The suppression is unconditional; no foreign `## Feature:`/`## Branch:` content is ever injected in this state — only `scratchpad: no parseable state` appears |

---

## 11. UC-10: Existing Consumer's Install Run Appends the Scratchpad Ignore Line via a New Independent Idempotency Key

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-10.1 | UC-10 Primary Flow, AC-1, AC-10 | STATIC | Existing `.gitignore` with `.claude/tmp` but no scratchpad line gains the scratchpad line via the new independent key; `.gitattributes` scaffolded fresh | Sandboxed temp HOME + temp cwd, `git init` first; target project's `.gitignore` already contains `.claude/tmp`, not `.claude/scratchpad.md`; no `.gitattributes` present | Run `--local --no-plugin --init-project` against the sandboxed project | `.gitignore` gains the scratchpad ignore line (appended, not skipped, because the new key is checked independently of the pre-existing `.claude/tmp` key); `.gitattributes` is scaffolded fresh with `merge=union` declared for `CHANGELOG.md`/`.claude/instincts.md`; `git check-attr merge -- CHANGELOG.md .claude/instincts.md` reports `union` inside the sandbox |
| TC-10.2 | UC-10 Primary Flow | STATIC | Re-running `--init-project` a second time is idempotent — no duplicate lines, no overwrite | Post-TC-10.1 state | Run `--init-project` again against the same sandboxed project | Both the scratchpad-ignore-line key and the `.gitattributes` presence check find their targets already satisfied; no duplicate lines appended; no file overwritten |
| TC-10.3 | UC-10-A1, AC-1, AC-10 | STATIC | Fresh project with no prior `.gitignore` gets both lines from scratch, plus a fresh `.gitattributes` scaffold | Sandboxed temp HOME + temp cwd, `git init` first, no pre-existing `.gitignore`/`.gitattributes` | Run `--local --no-plugin --init-project` against the fresh sandboxed project | `.gitignore` is created containing both `.claude/tmp` and `.claude/scratchpad.md`; `.gitattributes` is scaffolded fresh; `git check-attr merge -- CHANGELOG.md .claude/instincts.md` reports `union` inside the sandbox |
| TC-10.4 | UC-10-A2 | STATIC | Pre-existing `.gitattributes` (consumer-authored) is left untouched, even if it lacks the union declarations | Sandboxed project already has its own `.gitattributes`, without `merge=union` declarations | Run `--init-project` against the sandboxed project | The existing file is not overwritten; no repair is silently applied — this is documented as the consumer's own responsibility |
| TC-10.5 | UC-10-EC1, NFR-5 | STATIC | Migration-note rendering survives `ci.yml`'s shell-syntax greps | `install.sh`'s rendered `git rm --cached ... on main first` migration note text | Run `ci.yml`'s shell-syntax scanning step (or its equivalent grep) against `install.sh`'s help/migration text | No bare `node`/`jq` invocation outside a `#` comment is detected in the rendered note; the scan does not misidentify it as an executable command |
| TC-10.6 | AC-1 | STATIC | The `WHAT --init-project CREATES` help block names both new artifacts | `install.sh`'s help text | Grep the help block | Both the scratchpad-ignore behavior and the `.gitattributes` scaffold are named in the help block |
| TC-10.7 | Risk 4 (install.sh sensitive path) | STATIC | `install.sh` sits on the Step-6 fixed sensitive-path list; this slice carries a mandatory security pre-review | S3's slice metadata | Confirm S3's Pre-review field | `install.sh`'s slice is marked `Pre-review: security`, isolated so the review surface is this slice alone |

---

## 12. UC-11: Two Sessions in One Checkout (Documented-Unsupported)

| TC ID | UC Scenario | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-11.1 | UC-11 Primary Flow, FR-10 | STATIC | `src/rules/git.md` documents one-session-per-worktree in ≤3 added lines, including the sync-commit shape | `src/rules/git.md` post-feature | Grep/diff the file | ≤3 net new lines document the one-session-per-worktree model and cite the `chore(core): sync <branch> with <base>` commit shape |
| TC-11.2 | UC-11 Primary Flow, FR-10 | STATIC | `README.md` carries a parallel-operation section naming the model, migration order, and trust behavior | `README.md` post-feature | Grep the file for a parallel-operation section | Section names: one session per worktree; migration order (main first, then feature branches); trust behavior per S5's actual outcome (inheritance or reject path) |
| TC-11.3 | UC-11 Primary Flow, FR-10 | STATIC | Findings doc records the measured 1-23 divergence and the fired deferral trigger | `docs/findings/parallel-feature-sessions.md` [new]; `docs/findings/worktree-isolation-decision.md` updated | Grep both files | New findings doc contains the measured 1-23 divergence and the one-time monorepo reconciliation note; `worktree-isolation-decision.md` carries a pointer to the fired trigger (`:50-51`, "multiple features concurrently") |
| TC-11.4 | UC-11 Primary Flow | STATIC | No new locking mechanism is introduced for same-checkout concurrency | Full diff for this feature | Grep the diff for any new lock file, session-id partitioning, or queueing mechanism | None found — C11 is addressed by documentation only, per the stated out-of-scope item |
| TC-11.5 | UC-11-A1 | STATIC | Developer correction to separate worktrees reduces the scenario to UC-1's supported flow | Two same-checkout sessions; developer runs `git worktree add ../repo-feat-b feat/b` and moves Session B there | Re-observe scratchpad behavior in the new worktree | From this point forward the scenario matches UC-1's primary flow (TC-1.1/TC-1.2), not UC-11's — distinct, per-worktree scratchpad, no shared-file collision |
| TC-11.6 | UC-11-EC1, AC-7 | STATIC | Cross-reference to TC-4.8 — hostile parent env never reaches the git child, exercised on the same `git-safe.js` path used throughout | — | See TC-4.8 | Not duplicated here |
| TC-11.7 | UC-11-EC2, AC-7 | STATIC | Non-worktree project sees byte-identical behavior across trust check, spine, and Gate 0 base-sync (beyond the FR-4 procedure itself) | Before/after comparison on a project that has never used `git worktree` | Diff the pre-feature and post-feature behavior of `isTrustedProject`, the spine's stale-install matching, and Gate 0's non-sync-specific paths | Zero behavioral change confirmed for all three, beyond the FR-4 sync procedure applying identically regardless of worktree usage |

---

## 13. Cross-Cutting Mechanical / Structural Assertions

These assertions are not scoped to a single UC's primary flow — they check hygiene, budget, and
CI-wiring invariants that span multiple slices (S1-S10) and multiple UCs. Each still maps to a
named FR/NFR/AC.

| TC ID | Maps To | Kind | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|---|
| TC-CC.1 | FR-1, AC-1 | STATIC | Template-sourced hygiene section: a temp repo seeded from `templates/.gitignore` asserts scratchpad ignored AND instincts NOT ignored | Fresh temp repo seeded solely from `templates/.gitignore`'s content | Run `git check-ignore --no-index .claude/scratchpad.md` and `.claude/instincts.md` in the temp repo | Scratchpad matches (ignored); instincts does not match (still trackable) |
| TC-CC.2 | FR-1 | STATIC | Stale "stay tracked" comment corrected in both `.gitignore` and `templates/.gitignore` | Both files post-S1 | `grep "stay tracked"` across both files | Only instincts-scoped wording remains; no stale scratchpad-scoped "stay tracked" comment survives |
| TC-CC.3 | NFR-5 | STATIC | `tests/hooks/test-install-messaging.js` tolerates the file's absence (de-tracked scratchpad) as well as its presence | Fresh CI checkout with the scratchpad de-tracked; scripted temp-move of the file around a suite invocation | Run the test suite with the file present, then with it scripted-absent | Passes in both arms; the previously-throwing `fs.statSync` snapshot is now absence-tolerant with a sentinel that flips absent→present correctly |
| TC-CC.4 | NFR-1, AC-9 | STATIC | Budget ceilings hold at their existing caps after this feature | Full repo post-feature | Run `node scripts/ci/validate-context-budget.js --report` | Agent count 16/16; hook-id count 12/12; skill count 8/10; `merge-ready` at or under its raised 45,000-byte ceiling with the rationale comment present; `implement-slice` byte-identical to pre-feature |
| TC-CC.5 | NFR-2 | STATIC | `merge-ready`'s per-slice growth caps: S6 ≤ 3,200 B, S10 ≤ 1,300 B, each measured against the pre-slice file size | `skills/merge-ready/SKILL.md` size immediately before S6's commit, and immediately before S10's commit | Diff the file's byte size before/after each of the two commits | S6's net growth ≤ 3,200 bytes; S10's net growth ≤ 1,300 bytes; combined with the pre-existing 39,782 B baseline the file stays ≤ 45,000 B |
| TC-CC.6 | NFR-2 | STATIC | Ceiling-raise rationale comment states the asymmetry against `design-reviewer`'s "overrun = FAILED slice, never a raise" precedent, in the same file | `scripts/ci/validate-context-budget.js`'s `CEILINGS` comment for `merge-ready` | Grep the comment text | Comment explicitly states the asymmetry: `merge-ready`'s growth here is specified-procedure text fixed by the plan, so an overrun raises the ceiling deliberately, unlike `design-reviewer`'s precedent |
| TC-CC.7 | NFR-3 | STATIC | `implement-slice`'s zero-byte-growth constraint, enforced per slice | Each of the 10 slices' verify step | Run `git diff --stat <feature-base> -- skills/implement-slice/SKILL.md` at the end of every slice | Empty diff in every slice |
| TC-CC.8 | NFR-4, Risk 6 | STATIC | Every new/extended validator's fixtures are pinned counts, doubly wired (Falsify + anti-vacuity) into `ci.yml` | `validate-prd-numbering.js`, `validate-instinct-store.js` (merge-artifact classes), `validate-instinct-discipline.js` (class-name assertion) | Run `ci-parity.js --check-coverage` | Green — every validator listed in this feature appears in `ci.yml`'s Falsify AND anti-vacuity steps, at its pinned count |
| TC-CC.9 | NFR-5 | STATIC | Verification for this feature runs through the sweep, not a bare per-validator loop | Any slice's verify step | Run `node scripts/ci/ci-parity.js` | Runs the full seeded-fixture assertion set (not a bare `for v in validate-*.js; do node "$v"` loop) |
| TC-CC.10 | AC-4 | BEHAVIORAL | Gate 0's literal offline-degrade line and sync-commit shape are exact-string checked | Gate 0's offline run (TC-2.2) and online run (TC-2.1) transcripts | Grep the transcripts for the exact strings | `base sync unavailable (<reason>) — comparing against local <base>` present verbatim on offline degrade (not paraphrased); `chore(core): sync <branch> with <base>` present verbatim as the commit message shape on both the `git merge -m` invocation and any post-conflict `git commit -m` |
| TC-CC.11 | FR-3, Risk 2 | STATIC | `stop-changelog-guard`'s head-check still passes after a union-folded changelog | Post-fold `CHANGELOG.md` from TC-2.1/TC-3.1 | Run `stop-changelog-guard`'s head-scan logic against the folded file | Passes — the fold-step output does not trip the existing dirty-tree head-check |
| TC-CC.12 | FR-2/FR-3, AC-10 | STATIC | `git check-attr merge` reports `union` for both files, in this repo AND inside a scaffolded sandbox | This repo's `.gitattributes`; the sandboxed `--init-project` output from TC-10.1/TC-10.3 | Run `git check-attr merge -- CHANGELOG.md .claude/instincts.md` in both locations | Both report `union` in both locations |
| TC-CC.13 | AC-7 | BEHAVIORAL | Gate 6 live worktree rehearsal, persisted as committed evidence | Real worktree of this repo, only the main root registered in the trust registry | Run the Gate 6 rehearsal: spine's output on an absent scratchpad, spine's output on a seeded unparseable one, trust inheritance check, and a git-guard commit judgment — all from the worktree | Spine emits no scratchpad lines on the absent file and `scratchpad: no parseable state` on the seeded unparseable one; the worktree resolves trusted with only the main root registered; git-guard's commit judgment functions correctly from the worktree (per commit 475f1e1/#7); the rehearsal's transcript is committed as evidence in the repo |
| TC-CC.14 | FR-10, PRD §10 | STATIC | Stale "scratchpad stays tracked" security-rationale records corrected in four locations | `skills/merge-ready/SKILL.md:41-44`, `.gitignore`, `templates/.gitignore`, `docs/PRD.md` §10 FR-4.7 (~:1997) and §10 Risk 16 (~:2236) | Grep each location for the stale claim and its correction | All four/five locations reflect the de-tracked world; `docs/PRD.md` §10's two records are corrected and cross-reference §15; `merge-ready`'s stale tracked-scratchpad rationale at :41-44 is rewritten |

---

## 14. Full Traceability — UC-1 .. UC-11 Coverage

| Use Case Scenario | Test Case(s) |
|---|---|
| UC-1 Primary | TC-1.1, TC-1.2 |
| UC-1-A1 | TC-1.3, TC-1.4, TC-1.5 |
| UC-1-A2 | TC-1.6 |
| UC-1-E1 | TC-1.7 → TC-9.x |
| UC-1-EC1 | TC-1.8 → TC-11.x |
| UC-2 Primary | TC-2.1 |
| UC-2-A1 | TC-2.2 |
| UC-2-A2 | TC-2.3 |
| UC-2-A3 | TC-2.4 |
| UC-2-A4 | TC-2.5 |
| UC-2-E1 | TC-2.6 |
| UC-2-E2 | TC-2.2 |
| UC-2-EC1 | TC-2.7 |
| UC-2-EC2 | TC-2.8 |
| UC-3 Primary | TC-3.1, TC-3.2, TC-3.3, TC-3.4 |
| UC-3-A1 | TC-3.5, TC-3.6 |
| UC-3-A2 | TC-3.7 |
| UC-3-E1 | TC-3.8 |
| UC-3-EC1 | TC-3.9 |
| UC-3-EC2 | TC-3.10 |
| UC-4 Primary | TC-4.1, TC-4.2, TC-4.3 |
| UC-4-A1 | TC-4.8 (cross-ref TC-11.6) |
| UC-4-A2 | TC-4.4 |
| UC-4-E1 | TC-4.5 |
| UC-4-E2 | TC-4.6 |
| UC-4-EC1 | TC-4.7 |
| UC-5 Primary | TC-5.1, TC-5.2, TC-5.3 |
| UC-5-A1 | TC-5.4 |
| UC-6 Primary | TC-6.1 |
| UC-6-A1 | TC-6.2 |
| UC-6-E1 | TC-6.3 |
| UC-6-EC1 | TC-6.4 |
| UC-7 Primary | TC-7.1 |
| UC-7-A1 | TC-7.2 |
| UC-7-E1 | TC-7.4 |
| UC-7-EC1 | TC-7.3 |
| UC-8 Primary | TC-8.1, TC-8.2 |
| UC-8-A1 | TC-8.3 |
| UC-8-E1 | TC-8.4 |
| UC-9 Primary | TC-9.1 |
| UC-9-A1 | TC-9.2 |
| UC-9-A2 | TC-9.3 |
| UC-9-E1 | TC-9.4 |
| UC-9-EC1 | TC-9.5 |
| UC-9-EC2 | TC-9.6 |
| UC-10 Primary | TC-10.1, TC-10.6, TC-10.7 |
| UC-10-A1 | TC-10.3 |
| UC-10-A2 | TC-10.4 |
| UC-10-EC1 | TC-10.5 |
| UC-11 Primary | TC-11.1, TC-11.2, TC-11.3, TC-11.4 |
| UC-11-A1 | TC-11.5 |
| UC-11-EC1 | TC-11.6 → TC-4.8 |
| UC-11-EC2 | TC-11.7 |

No gaps: every UC and every documented sub-flow (Alternative/Error/Edge) in
`docs/use-cases/parallel-features_use_cases.md` maps to at least one test case above, either
directly or via a stated cross-reference to its single canonical home (UC-1-E1 ↔ UC-9; UC-1-EC1 ↔
UC-11; UC-4-A1 ↔ UC-11-EC1 ↔ TC-4.8).

---

## 15. Count Summary

| Kind | Count | Automatable share |
|---|---|---|
| STATIC | 74 | 74/88 = 84.1% — runnable in CI today via `node scripts/ci/ci-parity.js` + the hook suite, with zero LLM/agent invocation |
| FIXTURE | 0 | N/A — this feature invokes no agent as its own test method (stated in Section 1); `validate-fixture-manifest.js`'s bijection is trivially satisfied |
| BEHAVIORAL | 14 | 0% automatable in this repository's CI today — require a human-observed live session (`/merge-ready`, `/bootstrap-feature`, or a real two-worktree/live-worktree scenario), but every one is specified as a mechanically checkable literal string, exit/degrade state, or commit shape |
| **Total** | **88** | **84.1% automatable today** (74 of 88 cases run unattended in CI; the remaining 14 are pipeline-orchestration flows the harness's own conventions place outside scripted CI, same as `design-capability_test_cases.md`'s BEHAVIORAL class) |

Per-section BEHAVIORAL count, for reference: UC-1 (TC-1.2, TC-1.4) = 2; UC-2 (TC-2.1, TC-2.2,
TC-2.3, TC-2.5, TC-2.8) = 5; UC-4 (TC-4.2, TC-4.3) = 2; UC-6 (TC-6.1) = 1; UC-8 (TC-8.1, TC-8.3) =
2; Cross-Cutting (TC-CC.10, TC-CC.13) = 2. All other UC sections (UC-3, UC-5, UC-7, UC-9, UC-10,
UC-11) are 100% STATIC. The three cross-reference-only rows (TC-1.7, TC-1.8, TC-11.6) carry no
Kind of their own and are excluded from both tallies, counted once at their canonical home.

Cross-reference-only rows (TC-1.7, TC-1.8, TC-11.6) are counted once, at their canonical home
(TC-9.1-9.6 for UC-1-E1's content; TC-11.x for UC-1-EC1's content; TC-4.8 for UC-11-EC1's content)
— they are not double-counted in the total above.
