## Feature: Plugin Repackaging and Harness CI (v4.0 roadmap F1)
## Branch: feat/plugin-repackaging
## Status: quality-gates

## Plan

Docs: `docs/PRD.md` §6 · `docs/use-cases/plugin-repackaging_use_cases.md` (UC-1..UC-14) ·
`docs/qa/plugin-repackaging_test_cases.md` (177 TCs, 22 sections) · Architecture: **PASS** (rev 2)
Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F1 of F1–F5)
Bootstrap docs commit: 59222e9

### Wave 1 [complete]
- [x] Slice 1: Relocate `src/agents/` → `agents/` (13 files, all R100 renames) — dccf59a
- [x] Slice 2: Version → 4.0.0 (README:8, install.sh:22, install.sh:47) + PRD §2/§5 SHIPPED, §3 SUPERSEDED, §4 DRAFT — d305e82

### Wave 2 [complete]
- [x] Slice 3: `src/commands/*.md` → `skills/<name>/SKILL.md` + 4 frontmatter fields + `$ARGUMENTS` + FR-8 preflight — 1e95634

### Wave 3 [complete]
- [x] Slice 4: `.claude-plugin/{plugin,marketplace}.json` — `claude plugin validate .` passes clean — c6f4fd5
- [x] Slice 5: `scripts/ci/lib/validate-core.js` + validate-{agents,skills,hooks}.js + fixtures — 67547fb

### Wave 4 [complete]
- [x] Slice 6: validate-{personal-paths,unicode-safety,version-consistency}.js + `.github/workflows/ci.yml` — cfe80ed
- [x] Slice 7: Reference sweep, 19 files (install.sh's 10 refs deferred to Slice 8) — 4319cf6

### Wave 5 [complete]
- [x] Slice 8: Installer core rebuild — manifest, receipt, legacy cleanup, atomic backup — 2bfe515

### Wave 6 [complete]
- [x] Slice 9: `--uninstall`, `--restore`, `--dry-run` with receipt∩manifest intersection — a8a88cf

## CI status (all local, 21/21 green)

6 validators pass on HEAD; each fails on its seeded fixture; each fails on an empty tree
(anti-vacuity); placeholder positive control passes; `bash -n install.sh` passes; AC-9
(no `node`/`jq` in install.sh) passes and was proven falsifiable against a dirtied copy.
Fixture runs use `--min` to lower the anti-vacuity floor so each fixture fails for its own
defect rather than tripping the count check first.

## Deviations from plan (recorded)

- Slice 6 extended `scripts/ci/lib/validate-core.js` (a Slice 5 file) with a `walkFiles` helper and
  a `--min` flag. Safe because waves ran sequentially, not in parallel — no exclusive-ownership
  conflict. Rule 1/2 (free).
- `.gitignore` added out-of-slice (`.DS_Store`, `.vscode/`) so Gate 0's clean-tree check can pass.
- Slice 7 swept 19 files, not 20: `.claude/scratchpad.md` is orchestrator-owned and excluded.

## OPEN QUESTION blocking Slice 8 design

Does `install.sh` still install agents into `~/.claude/agents/`?
- If YES: user-level copies may permanently shadow the plugin's agents, making plugin updates
  ineffective — the plugin's `agents/` becomes dead weight.
- If NO: an install.sh-only adopter (UC-10, NFR-2) has no agents to delegate to.
The manifest `owns` list (19 entries incl. 13 agents) currently assumes YES.
Awaiting authoritative answer on subagent precedence between user-level and plugin sources.

## Key design (binding — do not re-litigate)

- **Node is CI-only.** `scripts/ci/*.js` may use Node (zero npm deps). `install.sh` MUST NEVER invoke
  `node` or `jq` (AC-9). Manifest and receipt are newline-delimited plain text so dependency-free
  bash can parse them.
- **Hybrid split.** Plugin owns `agents/`, `skills/`, (later) `hooks/`. `install.sh` keeps owning
  `~/.claude/claude.md` and `~/.claude/rules/*.md` — plugins have NO user-memory component type.
  `src/claude.md` and `src/rules/*` DO NOT move. A pure-plugin migration would pass every check and
  silently delete the autonomous-pipeline instruction.
- **Manifest** `manifests/owned-files.txt`: `owns` section = 19 entries (13 agents + claude.md +
  5 rules); `legacy` section = 5 entries (`commands/*.md` retired from v3.1). Never lists the user's
  3 personal agents (brand-guardian, demo-script-writer, social-copywriter).
- **Receipt** `~/.claude/.sdlc-receipt`: line 1 = version, then one relative path per line.
  `--uninstall` prefers receipt, falls back to manifest `owns` (the v3.1-upgrade case).
- **Path safety**: reject leading `/` and any `..` segment in manifest OR receipt entries.
  **Abort the whole run**, never skip-one. Applies to `--dry-run` preview too.
- **Removal is manifest/receipt-scoped, never a glob.** `~/.claude/agents/` holds 16 files; 3 are
  the user's own and must survive every install/upgrade/uninstall.
- **Legacy command shadowing**: v3.1 copied 5 commands to `~/.claude/commands/`. If they survive,
  `/develop-feature` silently runs the stale v3.1 prompt while every signal reports green.
- **Autonomy constraint**: no slice may add a step a human must remember to run. FR-8 preflight
  warns and CONTINUES — never blocks.

## Architecture action items (folded in)

- CI-validator slice moved from draft wave 2 → waves 3–4 and split in two (validators before assets
  existed made "exit 0 on HEAD" vacuously true). Exactly one slice owns `ci.yml`.
- Validators must fail on zero matched files (FR-5.9) — anti-vacuity.
- Slices 1 and 3 are both `git mv` and are in separate waves (`.git/index.lock` contention).
- Slice 8's done-condition includes end-to-end sandbox install (`HOME=$SANDBOX bash install.sh
  --local --yes`) — installer is broken on-branch from Slice 1 until Slice 8; must provably end
  before merge. **Do not merge before Wave 5 completes.**
- Sweep scope verified at 21 files (not 17): 6 use-case + 5 QA files, `install.sh`'s 10 refs.
  `templates/CLAUDE.md` verified at 0 matches — OUT of scope.

## Blockers

- none

## Known issues to resolve at merge-ready

- **QA TC 2.1.3 is wrong**: it expects `src/agents/*.md` to still exist after relocation, which
  contradicts PRD FR-2.1 (relocated, not copied), QA 2.2.6, and the mid-branch-breakage premise.
  Plan implements a true `git mv`. Correct the QA doc — do not implement a copy.
- PRD §4 NFR-1 ("no runtime code") is superseded by §6 NFR-1 for CI tooling. Annotate §4 itself when
  F5's planned §4 revision lands.
