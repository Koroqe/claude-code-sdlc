## Feature: Plugin Repackaging and Harness CI (v4.0 roadmap F1)
## Branch: feat/plugin-repackaging
## Status: implementing wave 1 slice 1/9

## Plan

Docs: `docs/PRD.md` §6 · `docs/use-cases/plugin-repackaging_use_cases.md` (UC-1..UC-14) ·
`docs/qa/plugin-repackaging_test_cases.md` (177 TCs, 22 sections) · Architecture: **PASS** (rev 2)
Roadmap: `/Users/aleksei/.claude/plans/alright-there-s-a-lot-merry-minsky.md` (F1 of F1–F5)
Bootstrap docs commit: 59222e9

### Wave 1
- [ ] Slice 1: Relocate `src/agents/` → `agents/` (git mv, 13 files, no content edits)
- [ ] Slice 2: Version reconciliation → 4.0.0 (`README.md:8`, `install.sh:22`, `install.sh:47`) + PRD status (§2/§5 SHIPPED, §3 SUPERSEDED, §4 DRAFT)

### Wave 2
- [ ] Slice 3: `src/commands/*.md` → `skills/<name>/SKILL.md` + frontmatter (description, argument-hint, arguments, allowed-tools) + `$ARGUMENTS` + FR-8 preflight in develop-feature/bootstrap-feature

### Wave 3
- [ ] Slice 4: `.claude-plugin/plugin.json` + `marketplace.json` (name `claude-code-sdlc`, version 4.0.0)
- [ ] Slice 5: CI validators batch 1 — `scripts/ci/lib/validate-core.js` + validate-{agents,skills,hooks}.js + fixtures

### Wave 4
- [ ] Slice 6: CI validators batch 2 — validate-{personal-paths,unicode-safety,version-consistency}.js + `.github/workflows/ci.yml` (sole owner; `permissions: contents: read`)
- [ ] Slice 7: Slash-command reference sweep — 20 of 21 scoped files (install.sh's 10 refs belong to Slice 8)

### Wave 5
- [ ] Slice 8: Installer core rebuild — `manifests/owned-files.txt`, receipt, legacy cleanup, atomic backup, plugin-layout sources — **Pre-review: security (MANDATORY)**

### Wave 6
- [ ] Slice 9: Installer lifecycle flags — `--uninstall`, `--restore`, `--dry-run` — **Pre-review: security (MANDATORY)**

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
