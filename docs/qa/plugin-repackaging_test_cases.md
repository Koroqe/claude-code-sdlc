# Test Cases: Plugin Repackaging and Harness CI

> Based on [PRD](../PRD.md) — Section 6 and [Use Cases](../use-cases/plugin-repackaging_use_cases.md)

**System context:** `claude-code-sdlc` has no web UI, no database, and no HTTP API. The things under test are: a bash installer (`install.sh`) performing destructive filesystem operations under `$HOME/.claude`; Node.js CI validators (`scripts/ci/validate-*.js`) that run on GitHub Actions only; static asset files (plugin manifests, agent/skill markdown, the file manifest, the install receipt); and the resolution behavior of Claude Code itself when both a plugin and user-level files provide the same agent/skill/command name.

**Two testing paradigms are used in this document:**
1. **Executable checks** (install.sh, CI validators, `claude plugin validate`) — real exit codes, `diff -r` comparisons, file counts, and grep matches against a sandboxed filesystem or scratch directory. These are the majority of test cases and MUST have a mechanically checkable expected result.
2. **Content checks** (skill preflight instructions, documentation sweep) — Claude Code's own runtime resolution of agents/skills/commands (which agent a name resolves to, whether a preflight step actually executes inside a live session) cannot be driven by a QA harness outside Claude Code itself. For these, the test case verifies that the specified instruction text is present and correctly worded in the source file, per the same paradigm used in `changelog-automation_test_cases.md` and `pipeline-hardening_test_cases.md`. Each such test case is explicitly labeled "(content check)".

**Sandboxing requirement (mandatory for every `install.sh` test case in this document):** No test case may set or rely on the developer's real `$HOME`. Convention used throughout:
```
SANDBOX=$(mktemp -d)
HOME="$SANDBOX" bash install.sh [flags]
```
Any test case that requires pre-existing state (personal agent files, a v3.1 layout, hand-edited agent copies, a receipt, a manifest variant, a malicious manifest/receipt entry) seeds it by writing directly into `$SANDBOX/.claude/...` (or a scratch copy of `manifests/owned-files.txt`) before invoking `install.sh`. `install.sh --restore <backup-dir>` test cases likewise pass a `<backup-dir>` located under the sandbox. No test case may point `--restore` or a manifest entry at a path outside the sandbox except deliberately, as the payload under test in the path-traversal test cases (Section 8), where the assertion is precisely that the installer refuses to touch it.

---

## 1. Plugin Manifest and Marketplace (FR-1, AC-1)

### 1.1 Manifest and Marketplace Files

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | FR-1.1 | `.claude-plugin/plugin.json` exists and sets required fields | Implementation complete | Glob for `.claude-plugin/plugin.json`; read and parse as JSON | File exists, is valid JSON, and sets `name`, `version`, `description`, `author`, `license`, and component path fields for `agents` and `skills` |
| 1.1.2 | FR-1.1 | `plugin.json` component paths point at this repo's directories | `.claude-plugin/plugin.json` exists | Read the `agents` and `skills` path fields | Values resolve to `agents/` and `skills/` at the plugin root (relative to `.claude-plugin/`) |
| 1.1.2b | FR-1.1 | `plugin.json` sets NO `hooks` field while this feature ships no `hooks/` directory | `.claude-plugin/plugin.json` exists | Parse the JSON and check for a `hooks` key; confirm no `hooks/` directory exists at the repo root | No `hooks` key is present. Pointing the field at a directory that does not exist risks failing `claude plugin validate .` (AC-1). F2a adds both the directory and the field together |
| 1.1.3 | FR-1.2 | `.claude-plugin/marketplace.json` exists and is self-referencing | Implementation complete | Glob and read `.claude-plugin/marketplace.json`; parse as JSON | File exists, defines a single plugin entry, and that entry's `source` field is `"./"` |
| 1.1.4 | FR-1.3, AC-1 | `claude plugin validate .` exits 0 from repo root | `plugin.json` and `marketplace.json` exist as produced by 1.1.1–1.1.3 | Run `claude plugin validate .` from the repo root | Exit code is `0` |

---

## 2. Asset Relocation — Agents and Skills (FR-2, AC-5)

### 2.1 Agents

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | FR-2.1, AC-5 | Exactly 13 agent files exist at the plugin root | Implementation complete | Run `ls agents/*.md \| wc -l` | Output is `13` |
| 2.1.2 | FR-2.1 | Relocated agent content matches the pre-relocation `src/agents/*.md` byte-for-byte, except version-string changes | Implementation complete; `src/agents/*.md` no longer exists on disk (2.1.3), so the comparison is against git history, not the working tree | For each of the 13 files, `git show <pre-relocation-commit>:src/agents/<name>.md` piped to `diff - agents/<name>.md`, allowing only version-string line differences attributable to FR-6; separately, `git log --follow --diff-filter=R -- agents/<name>.md` confirms git recorded the path as a rename from `src/agents/<name>.md`, not an unrelated add | Every diff is empty, or the only differing lines are version-string lines; `git log --follow` shows a rename relationship for all 13 files |
| 2.1.3 | FR-2.1 | `src/agents/*.md` no longer exists — the relocation was a true move, not a copy | Implementation complete | Glob `src/agents/*.md` | Zero files match (the 13 files were relocated via `git mv` to `agents/*.md`, consistent with 2.2.6's "relocated, not copied" assertion for commands and with PRD FR-2.1) |

### 2.2 Skills

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | FR-2.2, AC-5 | Exactly 5 skill files exist under `skills/*/SKILL.md` | Implementation complete | Run `ls skills/*/SKILL.md \| wc -l` | Output is `5` |
| 2.2.2 | FR-2.2 | Each skill directory name matches the original command's name | Implementation complete | Compare `skills/<name>/` directory names against the 5 original command basenames (`bootstrap-feature`, `develop-feature`, `implement-slice`, `merge-ready`, `context-refresh`) | Set of 5 directory names equals the set of 5 original command basenames exactly |
| 2.2.3 | FR-2.3, AC-5 | Each `SKILL.md` has real YAML frontmatter with all 4 required fields | Implementation complete | Parse the frontmatter block of each of the 5 `SKILL.md` files | Every file's frontmatter contains non-empty `description`, `argument-hint`, `arguments`, and `allowed-tools` fields |
| 2.2.4 | FR-2.4 | `develop-feature` skill documents `$ARGUMENTS` handling | `skills/develop-feature/SKILL.md` exists | Grep for `$ARGUMENTS` in the file body | The literal token `$ARGUMENTS` appears with surrounding text describing how the free-text feature description is captured |
| 2.2.5 | FR-2.4 | `bootstrap-feature` skill documents `$ARGUMENTS` handling | `skills/bootstrap-feature/SKILL.md` exists | Grep for `$ARGUMENTS` in the file body | The literal token `$ARGUMENTS` appears, consistent with the command's free-text-argument acceptance |
| 2.2.6 | FR-2.2 | `src/commands/*.md` no longer exists at its old location after relocation | Implementation complete | Glob for `src/commands/*.md` | Zero files match (the 5 files were relocated, not copied — see the "Relocated Files" table in PRD §6.6) |

---

## 3. Memory Layer Stays on `install.sh` (FR-3, AC-8)

### 3.1 File Placement and Rationale

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | FR-3.1, AC-8 | `src/claude.md` remains at its original path, not relocated into the plugin | Implementation complete | Glob `src/claude.md`; glob `agents/claude.md` and `skills/*/claude.md` | `src/claude.md` exists; no `claude.md` exists anywhere under the plugin's `agents/` or `skills/` trees |
| 3.1.2 | FR-3.2, AC-8 | Every `src/rules/*.md` file remains at its original path | Implementation complete | Glob `src/rules/*.md`; confirm none also appear under the plugin tree | 5 files present under `src/rules/`; none relocated into `agents/` or `skills/` |
| 3.1.3 | FR-3.1, FR-3.2, AC-8 | `install.sh` still copies `claude.md` and all rules into a sandbox `~/.claude` | Sandboxed `HOME`, empty `~/.claude` | Run `HOME="$SANDBOX" bash install.sh`; then `diff "$SANDBOX/.claude/claude.md" src/claude.md`; and for each rule file `diff "$SANDBOX/.claude/rules/<name>.md" "src/rules/<name>.md"` | All diffs are empty |
| 3.1.4 | FR-3.4 (content check) | `README.md` states plugin-only install is insufficient | `README.md` exists | Grep for `install.sh` in the installation-instructions section, near a "plugin install" mention | Text explicitly states that `/plugin install` alone is insufficient and `bash install.sh` remains required for the memory layer |
| 3.1.5 | FR-3.3 (content check) | `README.md` states the rationale (auto-loaded user memory, no plugin equivalent) | `README.md` exists | Grep for "user memory" or "auto-load" near the installation instructions | The rationale sentence is present: Claude Code auto-loads `~/.claude/claude.md` and `~/.claude/rules/*.md` as user memory; plugins have no equivalent component type |

---

## 4. Manifest and Receipt Format (FR-4.1, FR-4.8)

### 4.1 `manifests/owned-files.txt` Structure

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | FR-4.1 | `manifests/owned-files.txt` exists with `owns` and `legacy` section markers | Implementation complete | Read the file; grep for section header lines (`owns`, `legacy`) | Both section markers are present, each followed by a distinct block of path entries |
| 4.1.2 | FR-4.1, FR-4.6 | `owns` section lists exactly `claude.md` + 5 rule paths (6 entries) — agents are NOT in `owns` | `manifests/owned-files.txt` exists | Parse the `owns` block (ignoring `#` comments and blank lines); count non-empty data lines; grep the block for any `agents/` entry | Exactly 6 entries, matching `claude.md` and the 5 rule filenames one-for-one; zero `agents/` entries appear in `owns` (agents ship via the plugin only — FR-2.5, FR-4.11) |
| 4.1.3 | FR-4.1, FR-4.9, FR-4.11 | `legacy` section lists exactly the 5 retired command paths plus the 13 retired agent paths (18 entries) | `manifests/owned-files.txt` exists | Parse the `legacy` block; count non-empty data lines | Exactly 18 entries: `commands/bootstrap-feature.md`, `commands/develop-feature.md`, `commands/implement-slice.md`, `commands/merge-ready.md`, `commands/context-refresh.md`, plus the 13 `agents/<name>.md` paths matching the harness's agent filenames (relative to `~/.claude`) |
| 4.1.4 | FR-4.6 | `owns` section never lists the 3 personal agent files | `manifests/owned-files.txt` exists | Grep the `owns` block for `brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md` | Zero matches for any of the 3 filenames anywhere in the manifest |
| 4.1.5 | FR-4.1 | Comment lines and blank lines are permitted and ignored by the installer's parser | Sandboxed `HOME`; a scratch copy of the manifest with `#`-prefixed comment lines and blank lines interspersed between entries | Run `install.sh --dry-run` (or `--dry-run --uninstall`) against the scratch manifest | The printed preview list matches exactly the non-comment, non-blank data lines; the run does not error on the comment/blank lines |
| 4.1.6 | FR-4.7 | Every manifest entry (both sections) is a relative path with no leading `/` | `manifests/owned-files.txt` exists | Grep the file for any data line starting with `/` | Zero matches — every entry is relative to `~/.claude` |
| 4.1.7 | FR-4.7 | No manifest entry contains a `..` path-traversal segment | `manifests/owned-files.txt` exists | Grep the file for `..` occurring as a path segment in any data line | Zero matches |

### 4.2 `.sdlc-receipt` Format (verified via a real install — see Section 5)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.2.1 | FR-4.8 | Receipt has no `.json` extension and uses the manifest's newline-delimited format | Fresh sandbox install completed (Section 5) | `ls "$SANDBOX/.claude/" \| grep sdlc-receipt`; read the file | Filename is exactly `.sdlc-receipt` (no extension); line 1 is a version string; remaining lines are one relative path per line |
| 4.2.2 | FR-4.8 | Receipt's remaining lines exactly match the files that specific install placed (6 entries, no more, no fewer — no agent paths) | Fresh sandbox install completed | Count lines 2+ of the receipt; compare the set against the manifest's `owns` section; grep the receipt for any `agents/` line | Line count is 6; the set of paths is identical to the `owns` section's 6 entries; zero `agents/` lines appear (install.sh never writes agent files, so none can appear in its own receipt) |

---

## 5. Fresh Install (UC-1)

**Preconditions for this section:** sandboxed `HOME` with no prior `~/.claude/claude.md`, no `~/.claude/rules/`, and no file matching any of the 13 harness agent names.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | UC-1 Primary Flow | Fresh install on an empty sandbox populates the memory-layer owned files, writes a receipt, and never touches `agents/` | Empty `$SANDBOX/.claude` (or nonexistent) | Run `HOME="$SANDBOX" bash install.sh`; then check `$SANDBOX/.claude/agents/`, `$SANDBOX/.claude/claude.md`, `$SANDBOX/.claude/rules/*.md`, `$SANDBOX/.claude/.sdlc-receipt` | `claude.md` present; `ls rules/*.md \| wc -l` = 5; `$SANDBOX/.claude/agents/` is not created (or, if it pre-existed empty, remains empty) — install.sh never writes agent files; `.sdlc-receipt` exists with 6 data lines (per 4.2.2); exit code 0 |
| 5.1.2 | UC-1 Primary Flow, step 9 | `claude plugin validate .` still exits 0 after a fresh `install.sh` run (installer and plugin manifest are independent) | Fresh install completed (5.1.1) | Run `claude plugin validate .` from the repo root | Exit code `0` (cross-ref 1.1.4 — unaffected by `install.sh` having just run) |
| 5.1.3 | UC-1-A1 | `install.sh`'s fresh-install outcome does not depend on any prior plugin-install state | Empty sandbox, no plugin-related preconditions simulated (install.sh has no awareness of Claude Code's plugin registry) | Run `HOME="$SANDBOX" bash install.sh` in isolation, with no other setup step preceding it | Result is identical to 5.1.1 — `install.sh` never reads or depends on plugin registration state |
| 5.1.4 | UC-1-A2, FR-4.6 | Sandbox pre-seeded with an unrelated personal agent file survives a fresh install untouched | `$SANDBOX/.claude/agents/my-custom-agent.md` created with known content/checksum before install | Record checksum; run `HOME="$SANDBOX" bash install.sh`; re-check the file | File still exists, byte-identical to its pre-install checksum; `ls agents/*.md \| wc -l` = 1 (the personal file only — install.sh never writes any of the 13 harness agent files, so the count is not 14) |
| 5.1.5 | UC-1-E2 | Insufficient permissions on `~/.claude` produce a clear, non-zero-exit failure | `$SANDBOX/.claude` created and `chmod 000` applied before install | Run `HOME="$SANDBOX" bash install.sh` | Exit code non-zero; error output names the exact path that failed; no files beyond what was already reachable before the permission wall are created |
| 5.1.6 | UC-1-EC1 | `~/.claude` does not exist at all — installer creates it | `$SANDBOX/.claude` does not exist | Run `HOME="$SANDBOX" bash install.sh` | Exit code 0; `$SANDBOX/.claude` and `$SANDBOX/.claude/rules/` exist post-run with the expected rule-file count (5); `$SANDBOX/.claude/agents/` is not created by this run |
| 5.1.7 | UC-1-EC2 | Re-running `install.sh` immediately with no changes is idempotent | Fresh install completed (5.1.1) | Run `HOME="$SANDBOX" bash install.sh` a second time immediately | Exit code 0 on both runs; file content identical before/after the second run (`diff -r` on `rules/` and `claude.md` empty; no `agents/` directory to diff); a second, distinct timestamped backup directory now exists (`ls "$SANDBOX/.claude" \| grep -c '^backup-'` = 2) |

---

## 6. Upgrade Install and Legacy Command Removal (UC-2) — high risk

**Preconditions for this section:** sandbox pre-seeded to represent a v3.1 layout — 13 legacy agent files (content deliberately differing from the repo's `agents/*.md`, e.g. an altered `model:` value) + 3 personal files under `$SANDBOX/.claude/agents/`, 5 legacy rule files and `claude.md` under `$SANDBOX/.claude/`, and the 5 legacy command files under `$SANDBOX/.claude/commands/`. No receipt exists (v3.1 never wrote one).

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.1.1 | UC-2 Primary Flow, FR-4.2–FR-4.5, FR-4.9, FR-4.11 | Upgrade refreshes `claude.md` and 5 rules; removes all 13 legacy agent copies and all 5 legacy commands; leaves personal files untouched | v3.1 sandbox seeded as above | Run `HOME="$SANDBOX" bash install.sh` | Exit 0; `claude.md` and each rule file diff empty against `src/`; `$SANDBOX/.claude/agents/` contains none of the 13 legacy harness agent filenames (install.sh never writes agents — it only removes the legacy copies); `$SANDBOX/.claude/commands/` contains none of the 5 legacy files; the 3 personal files are unchanged (checksum match) |
| 6.1.2 | UC-2 Primary Flow, step 5; AC-3, AC-14 | Legacy commands directory is empty (or absent) post-upgrade | Upgrade run completed (6.1.1) | Run `ls "$SANDBOX/.claude/commands/"*.md 2>/dev/null \| wc -l` | Output is `0` |
| 6.1.3 | UC-2 Primary Flow, step 2 | Pre-upgrade backup captures the `commands/` directory before removal | Upgrade run completed (6.1.1) | Locate the timestamped backup dir created by the upgrade; `diff -r <backup>/commands "$SANDBOX_PRE_UPGRADE_SNAPSHOT/commands"` (snapshot taken before running install.sh) | `diff -r` returns no differences — the backup holds the pre-upgrade `commands/` content exactly |
| 6.1.4 | UC-2-A1 | An upgrade with hand-edited (`model: fable`) agent copies closes the shadowing gap by removing them, not by refreshing them | v3.1 sandbox seeded with `architect.md`, `planner.md`, `security-auditor.md` containing `model: fable` | Run `HOME="$SANDBOX" bash install.sh`; grep `$SANDBOX/.claude/agents/` for `fable`; check the 3 files' existence | Grep returns zero matches; none of the 3 files exist at `$SANDBOX/.claude/agents/` any longer (they were deleted as `legacy` entries, not overwritten with repo content — install.sh has no agent content to write) — resolution now falls through entirely to the plugin's copies (cross-ref Section 13) |
| 6.1.5 | UC-2-E2 (regression/defect scenario) | An `owns` entry missing from the manifest is never refreshed | Scratch copy of the manifest with one rule path (e.g. `rules/git.md`) deliberately removed from `owns`; v3.1 sandbox with a stale `git.md` | Run `install.sh` against the scratch manifest (via a manifest-path override, or by substituting the scratch manifest into a test checkout) | The omitted file's content remains stale (unchanged, still diverging from `src/rules/git.md`); every other `owns` file (`claude.md` + the other 4 rules) is refreshed correctly — demonstrates why 4.1.2's 6-entry completeness check on the *production* manifest's `owns` section is mandatory |
| 6.1.6 | UC-2-E3 | Legacy command surviving an incomplete cleanup shadows the plugin skill undetected | Scratch copy of the manifest with one `legacy` entry (e.g. `commands/develop-feature.md`) deliberately removed; v3.1 sandbox with the 5 legacy command files present | Run `install.sh` against the scratch manifest; then run `claude plugin validate .` | `install.sh` and `claude plugin validate .` both report success (exit 0); `$SANDBOX/.claude/commands/develop-feature.md` still exists on disk and its content differs from `skills/develop-feature/SKILL.md` (`diff` non-empty) — demonstrates the exact silent-shadowing mechanism; the production manifest's 18-entry `legacy` completeness (4.1.3) is what prevents this in the shipped repo |
| 6.1.7 | UC-2-EC1 | Upgrade removes whichever legacy agent files are present, without erroring on the ones already absent | Sandbox pre-seeded with only 10 of the 13 legacy agent files (the other 3 already absent) | Run `HOME="$SANDBOX" bash install.sh` | Exit 0; no error referencing the 3 already-absent legacy agent names; the 10 present legacy agent files are removed; `install.sh` never writes any of the 13 agent files, so no agent file exists at `$SANDBOX/.claude/agents/` post-run other than any pre-existing personal files |
| 6.1.8 | UC-2-EC2 | A retired rule file not in v4.0's `src/rules/*.md` survives the upgrade (documented limitation) | Sandbox pre-seeded with `$SANDBOX/.claude/rules/old-retired-rule.md` (not present in current `src/rules/`) | Run `HOME="$SANDBOX" bash install.sh` | Exit 0; `old-retired-rule.md` still exists post-upgrade — confirms the documented limitation that manifest-scoped refresh does not delete files absent from the source unless explicitly enumerated for removal |
| 6.1.9 | UC-2-EC3 | A hand-edited legacy command file is captured by the backup before removal, and the removal is warned about explicitly | Sandbox pre-seeded with `$SANDBOX/.claude/commands/merge-ready.md` containing custom (non-v3.1-shipped) content | Run `HOME="$SANDBOX" bash install.sh`; capture stdout | Exit 0; `$SANDBOX/.claude/commands/merge-ready.md` no longer exists; the timestamped backup's copy of `commands/merge-ready.md` diffs empty against the pre-upgrade custom content; stdout contains an explicit warning naming `merge-ready.md`, the retirement reason, and the backup path |
| 6.1.10 | FR-4.5 (regression guard) | No glob-based deletion pattern exists in `install.sh`'s legacy-cleanup code | `install.sh` exists | Grep `install.sh` for glob-deletion patterns against `commands` or `agents` (e.g. `rm .*commands/\*`, `rm -rf .*agents/\*`) | Zero matches — removal logic iterates the manifest's `legacy`/`owns` arrays, never a directory glob |

---

## 7. Personal-Agent Preservation (UC-3) — high risk, critical safety scenario

**Preconditions for this section:** sandbox with the 13 legacy harness agent files (v3.1-style remnants, enumerated in the manifest's `legacy` section — install.sh never writes these itself) plus the 3 personal files (`brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md`) in `$SANDBOX/.claude/agents/`, each with a recorded checksum.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.1.1 | UC-3 Primary Flow | `--uninstall` leaves exactly the 3 personal files, byte-identical | 16-file sandbox as above, checksums recorded | Run `HOME="$SANDBOX" bash install.sh --uninstall` | `ls "$SANDBOX/.claude/agents/"*.md \| wc -l` = 3; each of the 3 files' post-run checksum equals its pre-run checksum |
| 7.1.2 | UC-3-A1 | Cross-reference — dry-run preview excludes personal files before the real operation | See Section 9 (9.1.2) | — | — |
| 7.1.3 | UC-3-A2 | Fresh install with no personal agents present writes no agent files at all — install.sh never populates `agents/` | Sandbox with no pre-existing `agents/` content | Run `HOME="$SANDBOX" bash install.sh` | `$SANDBOX/.claude/agents/` is not created (or, if a caller pre-created it empty, remains empty — `ls "$SANDBOX/.claude/agents/"*.md 2>/dev/null \| wc -l` = 0); no unexpected file created |
| 7.1.4 | UC-3-E1 | A stale/incomplete manifest leaves an orphaned legacy file, but never puts personal files at risk | Scratch manifest with one legacy agent path removed from `legacy`; 16-file sandbox | Run `--uninstall` against the scratch manifest | The omitted file survives as an orphan; all 3 personal files are removed-from-scope correctly (never listed in either `owns` or `legacy`) and, since `--uninstall` only acts on manifest entries, remain present and byte-identical |
| 7.1.5 | UC-3-E2 (regression — MUST be caught) | Glob-based cleanup regression guard: functional test plus static grep | 16-file sandbox as above; `install.sh` source | (a) Grep `install.sh` for `rm .*agents/\*` or equivalent glob-deletion pattern against the agents directory; (b) run `--uninstall` and assert file counts | (a) Zero matches for glob-based deletion against `~/.claude/agents`; (b) `ls agents/*.md \| wc -l` = 3 post-uninstall, each byte-identical to its pre-run checksum — this is the build-failing regression test the PRD (Risk 1) requires |
| 7.1.6 | UC-3-E3 | A personal file sharing a harness agent's exact filename is indistinguishable by path (documented limitation) | Sandbox with a personal, non-harness-authored `planner.md` at `$SANDBOX/.claude/agents/planner.md` (differing content from the repo's `agents/planner.md`) | Run `HOME="$SANDBOX" bash install.sh` (upgrade path) | Post-run, `$SANDBOX/.claude/agents/planner.md` no longer exists — the `legacy`-section removal deletes any file at that exact path unconditionally (it does not diff content), so the developer's personal file is destroyed, not overwritten with repo content (there is no repo content to write since install.sh no longer installs agents) — demonstrates the documented path-only-ownership limitation is now a deletion risk, not merely a staleness risk (mitigated by `/agents` verification, Section 13) |
| 7.1.7 | UC-3-EC1 | `--uninstall` run twice in a row is idempotent | 16-file sandbox, first `--uninstall` already run | Run `HOME="$SANDBOX" bash install.sh --uninstall` a second time | Exit 0; stdout reports "0 files removed" (or equivalent already-clean message); the 3 personal files remain present and unchanged after both runs |
| 7.1.8 | UC-3-EC2 | A personal file already deleted before running `install.sh` raises no error | 16-file sandbox with one of the 3 personal files manually deleted first | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit 0; no error referencing the missing personal file; the other 2 personal files and outcome are unaffected |
| 7.1.9 | UC-3-EC3 | `~/.claude/agents/` absent entirely does not fail manifest-scoped logic | `$SANDBOX/.claude/agents/` does not exist; `$SANDBOX/.claude` may or may not exist | Run `HOME="$SANDBOX" bash install.sh` | Exit 0; the directory is created only as needed to write the 13 harness files; no error for the initial absence |

---

## 8. Path-Safety / Traversal Rejection (UC-3-EC4, UC-4-EC2, FR-4.7, AC-10) — high risk, security

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.1.1 | UC-3-EC4, AC-10 | A `..`-traversal manifest entry is rejected before any destructive operation | Scratch manifest with one `legacy` entry set to `../.ssh/id_rsa`; sentinel file placed at `$SANDBOX/.ssh/id_rsa` (i.e., one level above `$SANDBOX/.claude`) with known content; populated sandbox otherwise | Run `HOME="$SANDBOX" bash install.sh --uninstall` against the scratch manifest; capture exit code, stdout, and pre/post `diff -r` of `$SANDBOX/.claude` and the sentinel file's content | Exit code non-zero; stdout names the offending line number and path; `diff -r "$SANDBOX/.claude"` before/after is empty (no file created, modified, or deleted); the sentinel file at `$SANDBOX/.ssh/id_rsa` is byte-identical to its pre-run content |
| 8.1.2 | UC-3-EC4, AC-10 | A leading-`/` (absolute path) manifest entry is rejected identically | Scratch manifest with one entry set to `/etc/passwd` | Run `HOME="$SANDBOX" bash install.sh --uninstall` against the scratch manifest; checksum `/etc/passwd` (or a sandboxed stand-in with equivalent semantics) before and after | Exit code non-zero; rejection message printed; checksum of the referenced outside file is unchanged before/after |
| 8.1.3 | UC-3-EC4, step 4 | Rejection aborts the entire run even when the malformed entry is the LAST line | Scratch manifest with 5 valid entries followed by 1 traversal entry at the end | Run `HOME="$SANDBOX" bash install.sh --uninstall` against the scratch manifest | Exit non-zero; none of the 5 valid entries' files were removed — the run aborts before any destructive action regardless of the bad entry's position |
| 8.1.4 | UC-4-EC2 | `--dry-run` performs full validation before printing anything | Scratch manifest with one traversal entry among otherwise-valid entries | Run `HOME="$SANDBOX" bash install.sh --dry-run --uninstall` against the scratch manifest | Exit non-zero; stdout does NOT print a partial preview of the safe entries — it reports only the rejection, naming the offending entry |
| 8.1.5 | FR-4.7 | Path-safety validation applies uniformly to the install receipt, not only the manifest | Sandbox with a receipt (`$SANDBOX/.claude/.sdlc-receipt`) containing one data line set to `../.ssh/id_rsa` | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit non-zero; rejection message printed; no file under `$SANDBOX/.claude` or outside it is touched — identical behavior to the manifest case (8.1.1) |
| 8.1.6 | FR-4.7 | A rejected entry is refused, not silently skipped | Scratch manifest with 1 traversal entry among 10 valid entries | Run `HOME="$SANDBOX" bash install.sh --uninstall` against the scratch manifest; check exit code specifically | Exit code is non-zero (not `0`) — ruling out an implementation that silently skips the bad line and proceeds with the valid ones |

---

## 9. `--dry-run` Preview (UC-4)

**Preconditions for this section:** sandbox already carrying a full harness footprint (13 legacy agent files + the 3 personal ones under `agents/`, `claude.md`, 5 rules) unless a test case states otherwise — the 13 legacy agent files represent v3.1-era remnants awaiting `legacy`-section cleanup, not files `install.sh` itself wrote.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.1.1 | UC-4 Primary Flow | `--dry-run --uninstall` performs zero writes and exits 0 | Populated sandbox | Snapshot `diff -r` baseline of `$SANDBOX/.claude`; run `HOME="$SANDBOX" bash install.sh --dry-run --uninstall`; `diff -r` again | Exit 0; before/after `diff -r` is empty; stdout lists each manifest entry present on disk prefixed with the action that would occur |
| 9.1.2 | UC-3-A1, UC-4 Primary Flow, step 6 | Dry-run preview excludes all 3 personal files | Populated sandbox | Run `--dry-run --uninstall`; grep stdout for `brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md` | Zero matches for any of the 3 filenames in the printed preview |
| 9.1.3 | UC-4 Primary Flow, postconditions | Printed count exactly equals the manifest's entry count present on disk | Populated sandbox | Run `--dry-run --uninstall`; count printed lines; count manifest entries present on disk | The two counts are equal |
| 9.1.4 | UC-4-A1 | `--dry-run` without `--uninstall` previews a fresh/upgrade install with zero writes | Sandbox in either fresh or upgrade-eligible state | Snapshot baseline; run `HOME="$SANDBOX" bash install.sh --dry-run`; re-snapshot | Exit 0; `diff -r` before/after is empty; stdout lists exactly what would be copied/overwritten |
| 9.1.5 | UC-4-E1 | Invalid flag combination (`--dry-run --restore` with no directory argument) errors cleanly | Populated sandbox | Run `HOME="$SANDBOX" bash install.sh --dry-run --restore` (no path argument) | Exit non-zero; a usage error is printed; `diff -r` on `$SANDBOX/.claude` before/after is empty |
| 9.1.6 | UC-4-EC1 | An empty/corrupted manifest produces a "0 files" preview with an explicit warning | Scratch manifest that is zero-byte, or has a section header with no entries beneath it | Run `--dry-run --uninstall` against the scratch manifest | Stdout reports 0 files to remove AND includes an explicit warning that this is very likely wrong, since a legitimate install always has `claude.md` + rule entries in `owns` |
| 9.1.7 | UC-4-EC3 | `--dry-run` on a machine with no prior install previews a fresh install with no errors | Empty sandbox | Run `HOME="$SANDBOX" bash install.sh --dry-run` | Exit 0; stdout lists exactly the 6 `owns` entries (`claude.md` + 5 rule paths) as what would be created; no agent paths are listed (install.sh never creates them); no error is raised for the absence of prior state |

---

## 10. Receipt-Preferred Uninstall with Manifest Fallback (UC-5) — high risk

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.1.1 | UC-5 Primary Flow (receipt present) | `--uninstall` prefers the receipt for the `owns` footprint (6 entries) and removes `legacy` (18 entries) from the manifest | Sandbox with a valid `.sdlc-receipt` (6 entries: `claude.md` + 5 rules) from a prior v4.0-style install, the 13 legacy agent files, 3 personal files, and the 5 legacy command files present | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit 0; `claude.md` absent; rule files absent; `agents/` contains exactly the 3 personal files (the 13 legacy agent files were removed via the manifest's `legacy` section, not the receipt — the receipt never lists agents); `commands/` contains none of the 5 legacy files; `.sdlc-receipt` no longer exists |
| 10.1.2 | UC-5-A1 | install.sh-only setup (no plugin state assumed) uninstalls identically | Same sandbox as 10.1.1, with no plugin-related state simulated (install.sh has none regardless) | Run `--uninstall` | Identical postconditions to 10.1.1 |
| 10.1.3 | UC-5-A2 | No receipt present — falls back to the manifest's `owns` section (expected v3.1-upgrade case) | Sandbox with the same full footprint as 10.1.1 (13 legacy agents, 3 personal, 5 legacy commands, `claude.md` + 5 rules) but NO `.sdlc-receipt` file | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit 0; same postconditions as 10.1.1 (claude.md/rules/agents/commands all correctly cleaned) — fallback is a fully-supported success path, not a degraded one |
| 10.1.4 | UC-5-A3, AC-11 | `--uninstall` still succeeds from the receipt alone for the `owns` footprint when the manifest is unavailable, but `legacy` cleanup (including the 13 agent files) is skipped in that case | Sandbox with a valid `.sdlc-receipt` (6 entries); the checkout's `manifests/owned-files.txt` renamed to `manifests/owned-files.txt.bak` (or the install.sh invocation pointed at a checkout copy where the manifest is absent) | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit 0; `claude.md` and the 5 rule paths (per the receipt's 6 entries) are all removed; stdout includes an explicit note that `legacy`-section cleanup (5 commands + 13 agents) was skipped because the manifest was unavailable, so any legacy agent/command files present are NOT removed by this run; the 3 personal files remain untouched — directly verifies AC-11 for the `owns` footprint (note: `install.sh`'s `load_manifest()` currently exits non-zero when the manifest file itself cannot be found at all, which is a stricter precondition than "manifest renamed but still resolvable" — this test case's manifest-unavailable setup must use a form `load_manifest()` can still open, e.g. an empty manifest with only section markers, to exercise the AC-11 path without tripping the separate "manifest not found" hard-exit) |
| 10.1.5 | UC-5-E1 | `--uninstall` with nothing installed reports success, not an error | Empty sandbox (no receipt, no manifest-listed path present) | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit 0; stdout reports "nothing to uninstall" (or equivalent) |
| 10.1.6 | UC-5-E2 | Interrupted uninstall — cross-reference | See Section 12 | — | — |
| 10.1.7 | UC-5-E3 (a) | An empty (zero-byte) receipt is treated as untrustworthy and falls back to the manifest | Sandbox with a zero-byte `.sdlc-receipt`, valid manifest, harness files present | Run `--uninstall` | Exit 0; stdout warns the receipt is empty and states removal fell back to the manifest; postconditions match 10.1.1 |
| 10.1.8 | UC-5-E3 (b) | A receipt missing its version line (line 1 is a path, not a version string) falls back to the manifest with a specific warning | Sandbox with a malformed receipt whose first line is a relative path instead of a version | Run `--uninstall` | Exit 0; stdout names the specific problem ("missing version" or equivalent); falls back to the manifest; postconditions match 10.1.1 |
| 10.1.9 | UC-5-E3 (c) | A receipt data line failing path-safety validation is never partially applied | Sandbox with a receipt containing one traversal-violating data line among otherwise-valid lines | Run `--uninstall` | The installer either (i) falls back cleanly to the manifest with a warning, or (ii) aborts non-zero — but in no case does it remove any file using the untrustworthy receipt's valid-looking entries while ignoring only the bad one |
| 10.1.10 | UC-5-E3 (d) | Malformed receipt AND missing manifest together — installer refuses the `owns`-footprint removal | Sandbox with an empty receipt AND `manifests/owned-files.txt` absent from the checkout | Run `--uninstall` | Exit non-zero; no destructive action is taken against any `owns`-scoped file; stdout states no safe removal set is available (legacy-section removal is likewise unavailable and stated as such) |
| 10.1.11 | UC-5-EC1 | `--uninstall` then immediate `bash install.sh` (no `--restore`) produces a valid fresh install | Sandbox post-uninstall (10.1.1) | Run `HOME="$SANDBOX" bash install.sh` | Exit 0; postconditions match Section 5's fresh-install outcome (claude.md, 5 rules, new 6-entry receipt; no agent files written) |
| 10.1.12 | UC-5-EC2 | A receipt-listed file already manually deleted is skipped without error | Sandbox with a valid receipt where one listed rule file (e.g. `rules/git.md`) was deleted manually beforehand | Run `--uninstall` | Exit 0; no error referencing the missing file; all other receipt-listed files are removed normally |
| 10.1.13 | FR-4.8 (security requirement) | A receipt entry naming a file outside the manifest's `owns` section is skipped, not deleted, even though it is a structurally valid relative path | Sandbox with an otherwise-valid receipt (correct version line, the 6 legitimate `owns` entries) with one extra data line appended naming a structurally valid but non-owned path (e.g. `agents/brand-guardian.md` — the user's own agent, which passes path-safety validation but is not in `manifests/owned-files.txt`'s `owns` section); the named file exists on disk with a recorded checksum | Run `HOME="$SANDBOX" bash install.sh --uninstall`; capture stdout; re-check the file | Exit 0; the file at `agents/brand-guardian.md` still exists and is byte-identical to its pre-run checksum (it is intersected out of the removal set by `manifest_owns_contains`, not deleted); stdout contains an explicit "unrecognized receipt entry, skipped" (or equivalent) message naming the rejected entry; the 6 legitimate `owns` entries are still removed normally, proving the narrowing is per-entry, not a fallback that abandons the whole receipt |

---

## 11. `--restore <backup-dir>` Round-Trip (UC-6, NFR-3)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 11.1.1 | UC-6 Primary Flow, NFR-3 | `--restore` returns `~/.claude` to its exact prior state | Populated sandbox; snapshot taken; `--uninstall` run (creates a timestamped backup) | Run `HOME="$SANDBOX" bash install.sh --restore <backup-dir>`; then `diff -r <backup-dir> "$SANDBOX/.claude"` (excluding the backup dir itself and any backup created by the restore operation) | Exit 0; `diff -r` returns zero differences |
| 11.1.2 | UC-6-A1 | `--restore` works after a full reinstall to a different version, not only after `--uninstall` | Populated sandbox with a v3.1-era backup dir; sandbox subsequently upgraded to v4.0 | Run `HOME="$SANDBOX" bash install.sh --restore <v3.1-backup-dir>` | Exit 0; `diff -r` between the backup and restored `~/.claude` is empty, regardless of what changed the current state |
| 11.1.3 | UC-6-E1 | An invalid backup directory (missing expected internal structure) errors cleanly | A directory that does not follow the backup layout (e.g. an empty dir) | Run `HOME="$SANDBOX" bash install.sh --restore <invalid-dir>` | Exit non-zero; clear error printed; `diff -r` on `$SANDBOX/.claude` before/after the attempt is empty |
| 11.1.4 | UC-6-E2 | A nonexistent backup path errors cleanly | Path argument pointing at a directory that does not exist | Run `HOME="$SANDBOX" bash install.sh --restore <nonexistent-path>` | Exit non-zero; message states "backup directory not found: <path>"; `$SANDBOX/.claude` untouched |
| 11.1.5 | UC-6-EC1 | `--restore` with no argument does not auto-select the most recent backup | Sandbox with 3+ timestamped backup directories present | Run `HOME="$SANDBOX" bash install.sh --restore` (no path) | Exit non-zero; usage error; no restore is performed against any of the 3+ candidates |
| 11.1.6 | UC-6-EC2 | `--restore` run twice against the same backup is idempotent | One backup dir; restore already run once | Run `HOME="$SANDBOX" bash install.sh --restore <backup-dir>` a second time | Exit 0 both times; `diff -r` between the backup and `~/.claude` remains empty after either run |
| 11.1.7 | FR-4.3, FR-4.7 | `--restore`'s `<backup-dir>` argument is validated by the same path-safety rules before any restore copy begins | `--restore` argument set to a traversal-violating path (e.g. `../../etc`) | Run `HOME="$SANDBOX" bash install.sh --restore '../../etc'` | Exit non-zero; rejection message printed; no file under `$SANDBOX/.claude` is created, modified, or deleted |
| 11.1.8 | AC-3 (end-to-end) | Full dry-run → real uninstall → restore sequence round-trips cleanly | Populated sandbox, pre-uninstall snapshot taken | (1) `--dry-run --uninstall`, verify list matches manifest `owns`+`legacy` minus the 3 personal files (cross-ref 9.1.1–9.1.3); (2) real `--uninstall`; (3) `--restore <backup-dir>` | Step 1 list correct with zero writes; step 2 exits 0 with expected postconditions (Section 10); step 3's `diff -r` against the pre-uninstall snapshot is empty — satisfies AC-3 in full |
| 11.1.9 | FR-4.3 (security requirement) | `--restore` copies only the allowlisted top-level structure (`claude.md`, `agents`, `commands`, `rules`, `.sdlc-receipt`) and skips anything else present in the backup directory | A valid, correctly-named backup directory (`backup-YYYYMMDD-HHMMSS`) additionally containing an extra top-level entry the backup mechanism itself would never create (e.g. a `hooks.json`, a `.bashrc`, or a stray file placed directly by the test to simulate a tampered/foreign backup) | Run `HOME="$SANDBOX" bash install.sh --restore <backup-dir>`; inspect stdout and `$SANDBOX/.claude` post-run | Exit 0; the 5 allowlisted entries present in the backup are copied into `$SANDBOX/.claude` as normal; the extra, non-allowlisted entry is NOT copied into `$SANDBOX/.claude`; stdout contains an explicit "skipped unexpected entry in backup" (or equivalent) message naming it; a `--dry-run --restore` against the same tampered backup shows the identical skip behavior with zero writes |
| 11.1.10 | FR-4.3 (security requirement, symlink variant) | `--restore` refuses a backup directory containing a symlink anywhere inside it, rather than following it during the copy | A backup directory that is otherwise valid but contains one symlinked entry inside it (e.g. `agents` replaced with a symlink pointing outside the backup) | Run `HOME="$SANDBOX" bash install.sh --restore <backup-dir>` | Exit non-zero; a clear rejection message referencing the symlink is printed; `$SANDBOX/.claude` is left untouched |

---

## 12. Interrupted Install / Uninstall (UC-7)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 12.1.1 | UC-7 Primary Flow | Killing `install.sh` mid-legacy-removal leaves a recoverable mixed state; re-run converges | Sandbox eligible for an upgrade (v3.1-style seeded state per Section 6, including the 13 legacy agent files) | Launch `HOME="$SANDBOX" bash install.sh &`; send `SIGKILL` after a short, controlled delay (or after N of the 13 legacy agent files are observed removed); confirm the process is dead; run `HOME="$SANDBOX" bash install.sh` again to completion | After the kill, `$SANDBOX/.claude` is in a mixed state (some legacy agent files removed, some still present; `claude.md`/rules possibly untouched or partially refreshed); after the re-run, `diff -r` against a known-good, uninterrupted reference install is empty (no legacy agent files remain, `claude.md` and rules match `src/`); final exit code 0 |
| 12.1.2 | UC-7-A1 | Restoring instead of re-running forward is a valid alternate recovery | Post-interruption sandbox from 12.1.1 (before the recovery re-run) | Run `HOME="$SANDBOX" bash install.sh --restore <pre-interruption-backup-dir>` instead of re-running forward | Exit 0; `diff -r` against the pre-interruption snapshot is empty (cross-ref Section 11) |
| 12.1.3 | UC-7-E1, FR-4.10 | Killing `install.sh` during backup creation itself leaves no partial/unusable backup visible | Sandbox with prior installed state; kill signal timed to land during the backup-copy step | Launch install, `SIGKILL` timed at backup-creation; inspect `$SANDBOX/.claude` for any directory matching `backup-*` | No directory matching the expected backup naming pattern exists with an incomplete file count — the atomic (temp-dir + rename) write means either a complete backup is visible or none is |
| 12.1.4 | UC-7-E2 | Killing `install.sh` after old files removed but before new files copied leaves `claude.md` absent until recovery | Sandbox mid-migration; kill signal timed after the removal phase, before the copy phase completes | `SIGKILL` at that point; check for `$SANDBOX/.claude/claude.md`; then re-run `install.sh` to completion; re-check | `claude.md` is absent (or stale) immediately after the kill; after the recovery re-run, `claude.md` is present and diffs empty against `src/claude.md` |
| 12.1.5 | UC-7-EC1 | The 3 personal files are never touched regardless of the interruption point | Sandbox with personal files present; kill signal timed after `planner.md` (a legacy agent file) was removed but before the legacy-cleanup loop finished | `SIGKILL` at that point; check the 3 personal files' checksums | All 3 personal files are byte-identical to their pre-run checksums, independent of when the kill occurred |
| 12.1.6 | UC-7-EC2 | A second interruption during the recovery re-run still converges on the third attempt | Sandbox from 12.1.1's interrupted state | `SIGKILL` the recovery re-run itself partway through; run `install.sh` a third time to completion | Final state (after the third run) matches the fully-installed expected state — `diff -r` against the reference install is empty |

---

## 13. Agent Shadowing — Detection and Resolution (UC-8)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 13.1.1 | UC-8 Primary Flow (Detection) | Structural validity stays green while 3 stale agent copies persist | Sandbox/plugin checkout with `architect.md`, `planner.md`, `security-auditor.md` hand-edited to `model: fable` in `~/.claude/agents/`, differing from the repo's `agents/*.md` | Run `claude plugin validate .`; separately grep the 3 files in `~/.claude/agents/` for `model: fable` | `claude plugin validate .` exits 0; all 3 files still read `model: fable` — demonstrates stale shadow content persists despite a green structural check |
| 13.1.2 | UC-8 Primary Flow (Resolution) | Re-running `install.sh` removes the 3 stale copies entirely (there is no agent content for it to write), leaving personal files untouched | State from 13.1.1 | Run `HOME="$SANDBOX" bash install.sh` (or `--uninstall` + fresh install); grep for `fable` again; check the 3 files' existence | Grep for `fable` returns zero matches; none of the 3 files exist at `~/.claude/agents/` any longer — resolution falls through to the plugin's copies; the 3 unrelated personal files remain byte-identical |
| 13.1.3 | UC-8-A1 | Legacy removal is unconditional and content-independent, not selective — a "clean" (already-matching) legacy copy is removed exactly like a stale one | Sandbox with only `planner.md` stale (`fable`), `architect.md` and `security-auditor.md` already byte-identical to the repo's `agents/*.md` | Run `install.sh`; check existence of all 3 in `~/.claude/agents/` | None of the 3 exist post-run, regardless of which were "clean" beforehand — legacy cleanup does not diff content before removing, per FR-4.5 (cross-ref 13.1.8) |
| 13.1.4 | UC-8-E1 | A manifest missing one stale path leaves it un-removed after a "completed" migration | Scratch manifest with `planner.md`'s `legacy` entry removed; sandbox with stale `planner.md` | Run `install.sh` against the scratch manifest; then `claude plugin validate .` | `planner.md` still reads `model: fable` post-run (it was never removed); `claude plugin validate .` still exits 0 — demonstrates the concrete failure mode; production manifest's `legacy`-section completeness (4.1.3, 18 entries) is the actual mitigation |
| 13.1.5 | UC-8-E2 (content check) | `/agents` verification is documented as a required manual step after install | `README.md` or `CONTRIBUTING.md` exists | Grep for "/agents" combined with "verify" or "after install" | At least one occurrence of guidance instructing the developer to run `/agents` after installing/upgrading, to catch shadowing that no automated check surfaces |
| 13.1.6 | UC-8-E3 | Cross-reference — command-level analog of agent shadowing | See 6.1.6 | — | — |
| 13.1.7 | UC-8-EC1 | A same-named personal agent is deleted as if it were the harness's own legacy copy (documented limitation) | Sandbox with a personal, non-harness-authored `planner.md` (deliberately different content) | Run `install.sh` (upgrade path) | Post-run `planner.md` no longer exists — the `legacy`-section removal deletes any file at that path unconditionally, without checking whether the content is actually the harness's own — confirms the path-only-ownership limitation is real and must be documented, not silently assumed safe (duplicate assertion of 7.1.6, retained here for UC-8 traceability) |
| 13.1.8 | UC-8-EC2 | Uniform removal of all 13 legacy agent copies regardless of individual drift state | Sandbox with all 13 legacy agents present in mixed states (some hand-edited, some already identical to the repo) | Run `install.sh`; check existence of all 13 in `~/.claude/agents/` | None of the 13 exist post-run — removal is unconditional and uniform, not conditional on detecting drift first; install.sh never rewrites agent content since it does not install agents |

---

## 14. Plugin-Only Install and Entry-Point Preflight (UC-9, FR-8)

**Note:** UC-9's core scenario (agents/skills resolve via a live plugin install, memory layer absent) depends on Claude Code's own plugin registry, which cannot be driven from this repo's filesystem sandbox. Test cases 14.1.1–14.1.6 and 14.1.9 are content checks against the skill source files and `README.md`; 14.1.7–14.1.8 verify the filesystem-observable trigger condition (`~/.claude/claude.md` absence/presence) that the preflight instruction is conditioned on.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 14.1.1 | FR-8.1 (content check) | `skills/develop-feature/SKILL.md` opens with a preflight step checking for `~/.claude/claude.md` and its marker | File exists | Read the file's opening section (before the main pipeline steps); grep for "claude.md" and "preflight" (or equivalent) | The preflight step appears near the top of the skill body, before the main pipeline logic, and names both the file path and a marker/heading it checks for |
| 14.1.2 | FR-8.1 (content check) | `skills/bootstrap-feature/SKILL.md` contains the same preflight step | File exists | Same as 14.1.1, applied to this file | Preflight step present with equivalent content |
| 14.1.3 | UC-9-E2, FR-8.2 (content check) | Preflight failure text names `bash install.sh` as the fix | Both skill files exist | Grep the preflight section of each for `bash install.sh` | The literal string `bash install.sh` appears in the warning text of both files |
| 14.1.4 | UC-9-E2, FR-8.2, AC-13 (content check) | Preflight instruction explicitly states the skill continues, never blocks | Both skill files exist | Grep the preflight section for "continue" / "does not block" / "non-blocking" (or equivalent) | Explicit language states the skill proceeds into its normal behavior after emitting the warning — no gate, no dead-end |
| 14.1.5 | UC-9-E3, FR-8.1 (content check) | Preflight checks file CONTENT for a marker, not just file presence | Both skill files exist | Read the preflight instruction wording | Text specifies checking for a recognizable marker string/heading within `claude.md`'s content, not merely `test -f ~/.claude/claude.md` |
| 14.1.6 | UC-9-A2 (content check) | Preflight is silent when both checks pass | Both skill files exist | Grep for language describing the success case (e.g. "no message", "proceed silently") | Text confirms no warning or message is emitted when `claude.md` is present and contains the marker |
| 14.1.7 | UC-9-EC3, FR-8.3 (content check) | The residual unprefixed-request gap is explicitly documented | Both skill files exist (or the PRD risk section) | Grep for "unprefixed" or "session-start" or "F2a" | The file (or the PRD, cross-referenced) states the preflight only fires on explicit skill invocation and names the future F2a session-start hook as the closer for the unprefixed-request path |
| 14.1.8 | UC-9-E2/E3 trigger condition (executable) | The filesystem-observable precondition for the preflight (absence, or marker-less presence, of `claude.md`) is independently producible in a sandbox | Sandbox with `claude.md` absent; then a second sandbox with `claude.md` present but content replaced with unrelated text lacking the harness marker | Check `$SANDBOX/.claude/claude.md` existence and, where present, grep it for the harness's marker string | Case 1: file absent. Case 2: file present, marker grep returns zero matches. Both are the exact two trigger states FR-8.2/FR-8.1's marker check must catch (the skill's own runtime behavior against these states is not independently executable outside Claude Code, hence the content checks above) |
| 14.1.9 | UC-9 Primary Flow, FR-3.4 (content check) | Cross-reference — `README.md` documents the plugin-only-install outcome | See 3.1.4 | — | — |
| 14.1.10 | UC-9-EC1 (executable, filesystem-observable) | An unrelated pre-existing `claude.md` (no harness marker) is left untouched by a plugin-only scenario and is correctly treated as "marker absent" | Sandbox with `$SANDBOX/.claude/claude.md` seeded with unrelated content (no harness marker), no `install.sh` run performed | Grep the seeded file for the harness marker string | Zero matches — confirms this file would trigger the same "marker absent" preflight path documented in 14.1.5, and that `install.sh` (not run in this test) is what would be needed to fix it |
| 14.1.11 | UC-9-EC2 | Cross-reference — legacy v3.1 `claude.md` is a staleness case (UC-2/UC-8), not a half-migration case | See Sections 6 and 13 | — | — |

---

## 15. `install.sh`-Only Install — No Plugin Ever Installed (UC-10)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 15.1.1 | UC-10 Primary Flow | Sandbox running only `install.sh` gets the memory-layer footprint (no agents) including the mandatory pipeline instruction | Empty sandbox | Run `HOME="$SANDBOX" bash install.sh`; grep `$SANDBOX/.claude/claude.md` for a known marker phrase from `src/claude.md` (e.g. "MANDATORY" or "Autonomous Development Workflow") | `claude.md` and 5 rules present, no `agents/` content written (cross-ref Section 5); the marker phrase is present in the installed `claude.md`, confirming the mandatory-workflow instruction is intact |
| 15.1.2 | UC-10-A1 | Cross-reference — later plugin install risks (shadowing) | See Sections 6 and 13 | — | — |
| 15.1.3 | UC-10-E1 (content check) | Docs clarify install.sh-only usage still works via natural-language requests | `README.md` exists | Grep for language distinguishing literal slash-command registration (plugin-only) from natural-language pipeline triggering (memory-layer-only) | Explicit text states that without the plugin, typed slash commands are not registered, but natural-language feature requests still trigger the full pipeline via the memory-layer instruction |
| 15.1.4 | UC-10-EC1 | Cross-reference — personal agents untouched, re-asserted for the install.sh-only flow | See Section 7 | Sandbox with 3 personal agents seeded, `install.sh` run in isolation | Personal files unaffected, consistent with every other install path |
| 15.1.5 | UC-10-EC2 | `--uninstall` on an install.sh-only setup removes the full footprint with no plugin remnants to clean | Sandbox from 15.1.1 | Run `HOME="$SANDBOX" bash install.sh --uninstall` | Exit 0; `claude.md` and 5 rules removed (6 entries, cross-ref Section 10); no agent files existed to remove, since install.sh-only usage never wrote any; no plugin-related state exists to clean because none was ever created |

---

## 16. Skill Invocation — Bare Name, Namespaced Name, Collision (UC-11, FR-7)

**Note:** Claude Code's own slash-command resolution (which skill a bare name resolves to, whether a collision occurs) cannot be executed from this repo's filesystem sandbox. All test cases in this section are content/documentation checks per FR-7's sweep requirement, plus one structural uniqueness check.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 16.1.1 | UC-11 Primary Flow, FR-7.1 (content check) | `README.md` documents both bare and namespaced invocation forms with a collision caveat | `README.md` exists | Grep for `/develop-feature` and a namespaced pattern (e.g. `/<plugin-name>:develop-feature` or the literal resolved form) in the same section; grep for "collision" or "absent" | Both forms are documented together, with an explicit note that bare-name resolution only succeeds when no other installed plugin defines a colliding skill name |
| 16.1.2 | UC-11-A1 (content check) | `skills/develop-feature/SKILL.md` references its own namespaced invocation form at least once | File exists | Grep for the plugin-name-prefixed pattern | At least one occurrence of the namespaced form appears in the file |
| 16.1.3 | UC-11-A2, AC-4 | Cross-reference — full 21-file sweep | See Section 21 | — | — |
| 16.1.4 | UC-11-E1 (content check) | `README.md` documents the collision scenario and the namespaced escape hatch | `README.md` exists | Grep for "another installed plugin" or "collision" combined with the namespaced form | Explicit collision scenario and remedy are documented |
| 16.1.5 | UC-11-EC1 | The 5 skill directory names are pairwise distinct | Implementation complete | Run `ls skills/*/SKILL.md \| xargs -n1 dirname \| xargs -n1 basename \| sort -u \| wc -l` | Output is `5` (no duplicates) |
| 16.1.6 | UC-11-EC2 (content check) | The plugin name used in namespaced documentation examples matches `plugin.json`'s `name` field exactly | `.claude-plugin/plugin.json` and `README.md` exist | Extract `plugin.json`'s `name` value; grep `README.md`'s namespaced examples for the same literal string | The exact string from `plugin.json` appears verbatim in every namespaced documentation example — no abbreviated or differently-cased variant |
| 16.1.7 | UC-11-EC3 | No independent test required — a competing plugin's later uninstallation is outside this repo's control | N/A | N/A | Documented as requiring no additional mitigation beyond 16.1.1/16.1.4 (namespaced-form documentation already covers the recovery path) |

---

## 17. Node/`jq` Boundary in `install.sh` (NFR-1, AC-9)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 17.1.1 | AC-9 | `install.sh` invokes neither `node` nor `jq` anywhere, per the portable AC-9 grep | `install.sh` exists | Run `grep -E '(^|[^a-zA-Z])(node|jq)([^a-zA-Z]|\$)' install.sh` after excluding comment lines (e.g. pipe through `grep -v '^\s*#'` first) | Zero matches |
| 17.1.2 | AC-9 | Comment-line mentions of "node"/"jq" (e.g. explaining the constraint) do not falsely fail the check | `install.sh` contains a comment line mentioning "node" (e.g. explaining why Node is CI-only) | Run the exact AC-9 command sequence used in CI (comment-exclusion first, then the pattern match) | The comment-only mention does not appear in the match output — the exclusion step correctly filters it |
| 17.1.3 | AC-9 | The grep pattern behaves identically under BSD grep (macOS) and GNU grep | `install.sh` exists; both `grep` (BSD, macOS default) and, where available, GNU `grep`/`ggrep` are accessible | Run the AC-9 command with each grep implementation against the same `install.sh` | Both produce the same zero-match result — no reliance on GNU-only `\b` syntax |
| 17.1.4 | NFR-1 | No `node`/`jq` invocation inside command substitution or pipe contexts | `install.sh` exists | Grep for `$(node ` , `` `node `` , `\| jq`, `\| node` patterns specifically | Zero matches, corroborating 17.1.1 with an independent pattern targeting subshell/pipe usage |
| 17.1.5 | NFR-1 | `install.sh` never invokes the CI validators | `install.sh` exists | Grep for `scripts/ci/` | Zero matches |

---

## 18. Harness CI Validators — Falsifiability (UC-12, FR-5) — high risk, anti-vacuity

### 18.1 CI Workflow

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.1.1 | FR-5.1 | `.github/workflows/ci.yml` exists and triggers on push and pull request | Implementation complete | Read the file; check the `on:` block | Both `push` and `pull_request` triggers are declared |
| 18.1.2 | FR-5.1 | Workflow declares least-privilege `permissions: contents: read` with no broader default scope | `.github/workflows/ci.yml` exists | Grep for `permissions:` at workflow or job level; check the value | `contents: read` is declared explicitly; no broader scope (e.g. `write`, `contents: write`) appears at that level |
| 18.1.3 | UC-14, NFR-1 | Workflow includes an explicit Node toolchain setup step, independent of the wrapper's in-script check | `.github/workflows/ci.yml` exists | Grep for `setup-node` (or equivalent) | A dedicated Node setup step exists in the workflow, separate from any validator's own version-check logic |

### 18.2 `validate-agents.js` (FR-5.2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.2.1 | UC-12 Primary Flow, step 3 | Exits 0 against HEAD | `scripts/ci/validate-agents.js` exists; repo at HEAD | Run `node scripts/ci/validate-agents.js` from repo root | Exit code `0` |
| 18.2.2 | UC-12-A1, FR-5.8/AC-2 | Exits non-zero against a seeded bad fixture | A checked-in fixture agent file with `name:` mismatched to its filename (or missing `tools:`) | Run the validator against the fixture directory | Exit code non-zero; output names the fixture file and the specific violated rule |
| 18.2.3 | UC-12-EC1, FR-5.9/AC-12 | Exits non-zero on zero matched files (anti-vacuity) | An empty scratch directory with no files matching `agents/*.md` | Run the validator against the empty scratch directory | Exit code non-zero — not a vacuous pass |
| 18.2.4 | UC-12-EC1 | Correctly validates a count other than 13 (no hardcoded count) | A scratch directory with 14 valid agent-shaped files | Run the validator against the scratch directory | Exit code `0` — confirms no hardcoded expectation of exactly 13 files |

### 18.3 `validate-skills.js` (FR-5.3)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.3.1 | UC-12 Primary Flow, step 4 | Exits 0 against HEAD | `scripts/ci/validate-skills.js` exists; repo at HEAD | Run against `skills/*/SKILL.md` | Exit code `0` |
| 18.3.2 | UC-12-A2, FR-5.8/AC-2 | Exits non-zero against a fixture missing `argument-hint` | A checked-in fixture `SKILL.md` with `argument-hint` omitted | Run the validator against the fixture | Exit code non-zero; output names the missing field |
| 18.3.3 | UC-12-EC1, FR-5.9/AC-12 | Exits non-zero on zero matched files | Empty scratch directory | Run the validator against it | Exit code non-zero |

### 18.4 `validate-hooks.js` (FR-5.4)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.4.1 | UC-12 Primary Flow, step 5 | Exits 0 when `hooks/hooks.json` is absent (this feature ships 0 hooks) | `scripts/ci/validate-hooks.js` exists; `hooks/hooks.json` does not exist at HEAD | Run the validator against HEAD | Exit code `0` ("passes trivially") |
| 18.4.2 | UC-12-A3, FR-5.8/AC-2 | Exits non-zero against a malformed fixture `hooks.json` | A checked-in fixture `hooks.json` with malformed JSON or an entry missing `event`/`command` | Run the validator against the fixture | Exit code non-zero; error names the specific schema violation |
| 18.4.3 | UC-12-EC2 | The trivial pass is proven to come from real parsing, not a hardcoded exit | Same validator invocation used for 18.4.1 and 18.4.2, run in the same test session | Run the validator first against the absent-file case, then against the 18.4.2 fixture | Different outcomes (0 vs non-zero) from the same script prove it is not a stubbed `process.exit(0)` |

### 18.5 `validate-personal-paths.js` (FR-5.5)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.5.1 | UC-12 Primary Flow, step 6 | Exits 0 against HEAD | `scripts/ci/validate-personal-paths.js` exists; repo at HEAD | Run the validator against the repo's shipped files | Exit code `0`; no `/Users/...`-pattern matches |
| 18.5.2 | UC-12-A4, FR-5.8/AC-2 | Exits non-zero against a fixture containing a literal `/Users/someone/project` | A checked-in fixture file with that literal string | Run the validator against the fixture | Exit code non-zero; output names the file and the matched path |
| 18.5.3 | UC-12-EC1, FR-5.9/AC-12 | Exits non-zero on zero matched files | Empty scratch directory | Run the validator against it | Exit code non-zero |
| 18.5.4 | UC-12-EC3 | Documented placeholder paths are allowlisted; the same literal string outside the allowlisted context is still flagged | Two fixtures: (a) a `/Users/yourname/project` example inside a documentation block explicitly marked as a placeholder per the validator's convention; (b) the identical literal string NOT marked as a documented placeholder | Run the validator against fixture (a), then against fixture (b) | (a) exits `0`; (b) exits non-zero — confirms the allowlist is narrowly scoped, not a blanket bypass |

### 18.6 `validate-unicode-safety.js` (FR-5.6)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.6.1 | UC-12 Primary Flow, step 7 | Exits 0 against HEAD | `scripts/ci/validate-unicode-safety.js` exists; repo at HEAD | Run against `agents/*.md`, `skills/*/SKILL.md`, `src/claude.md`, `src/rules/*.md` | Exit code `0` |
| 18.6.2 | UC-12-A5, FR-5.8/AC-2 | Exits non-zero on a zero-width space (U+200B) | A checked-in fixture file containing U+200B | Run the validator against the fixture | Exit code non-zero; output names the file, character position, and codepoint |
| 18.6.3 | UC-12-A5 (variant) | Exits non-zero on a homoglyph substitution | A checked-in fixture file with a Cyrillic "а" (U+0430) substituted for Latin "a" | Run the validator against the fixture | Exit code non-zero; output names the file, position, and codepoint |
| 18.6.4 | UC-12-EC1, FR-5.9/AC-12 | Exits non-zero on zero matched files across all 4 globs | Empty scratch directories for all 4 glob patterns | Run the validator against them | Exit code non-zero |

### 18.7 `validate-version-consistency.js` (FR-5.7)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.7.1 | UC-12 Primary Flow, step 8 | Exits 0 against HEAD | `scripts/ci/validate-version-consistency.js` exists; repo at HEAD | Run the validator against `README.md`, `install.sh`, `.claude-plugin/plugin.json` | Exit code `0` |
| 18.7.2 | UC-12-A6, UC-13-E1, FR-5.8/AC-2 | Exits non-zero when `install.sh`'s VERSION differs from `README.md`'s badge | Fixture set with a deliberately mismatched `install.sh` VERSION | Run the validator against the fixture set | Exit code non-zero; output names the specific mismatched files and values |
| 18.7.3 | UC-13-E2 | Fails loudly (parse error) on an unexpectedly formatted VERSION assignment | Fixture `install.sh` with unusual quoting or a multiline VERSION assignment | Run the validator against the fixture | Exit code non-zero; a parse-error message is printed, not a silent false-positive match |
| 18.7.4 | UC-13-EC1 | A consistent pre-release suffix (`4.0.0-rc1`) across all 3 sources passes | Fixture set with `4.0.0-rc1` applied identically to all 3 files | Run the validator against the fixture set | Exit code `0` |
| 18.7.5 | UC-13-EC1 (variant) | An inconsistent suffix (applied to only 2 of 3 files) fails | Fixture set with `4.0.0-rc1` in 2 files and `4.0.0` in the third | Run the validator against the fixture set | Exit code non-zero — confirms exact string equality, not semantic-version tolerance |
| 18.7.6 | FR-5.9 (adapted — fixed-file anti-vacuity) | The validator actually reads all 3 sources rather than passing vacuously when they're absent | Fixture set where all 3 version sources are missing or empty | Run the validator against the fixture set | Exit code non-zero — it does not report success on "nothing to compare" |

### 18.8 Falsifiability Meta-Checks

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 18.8.1 | UC-12-E1 | Each validator's seeded-bad-fixture check runs as an automated CI step, not a manual/occasional check | `.github/workflows/ci.yml` exists | Grep the workflow for a step per validator that runs it against its fixture path and asserts a non-zero (expected-failure) result | Every one of the 6 validators has a corresponding fixture-check step wired into the workflow itself |
| 18.8.2 | UC-12-E2 | Validators produce structured, readable error output, not a raw stack trace, even on extreme malformed input | Each of the 6 validators; a deliberately extreme malformed input per validator (e.g. a directory where a file is expected) | Run each validator against its extreme-malformed-input case; inspect stdout/stderr | Exit code is non-zero for all 6; none of the 6 outputs begins with a raw Node stack-trace prefix (e.g. `at Object.` / `at Module.`) — each prints a structured error message |
| 18.8.3 | NFR-1 | All 6 validators import the shared wrapper module rather than duplicating parsing/version logic | All 6 `scripts/ci/validate-*.js` files exist | Grep each file for the shared wrapper's import path | All 6 files import the same shared wrapper module |

---

## 19. Version Consistency Reconciliation (UC-13, FR-6.1, AC-6)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 19.1.1 | UC-13 Primary Flow, AC-6 | README badge, `install.sh` VERSION, and `plugin.json` version are the identical string | Implementation complete | Extract the version string from `README.md`'s badge, `install.sh`'s `VERSION=` line, and `.claude-plugin/plugin.json`'s `version` field | All three strings are exactly identical |
| 19.1.2 | UC-13-A1 (process note) | Future version bumps update all 3 files together — regression-guarded by 18.7.2/18.7.5 | See Section 18.7 | — | — |

---

## 20. Node Version Boundary in CI (UC-14, NFR-1)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 20.1.1 | UC-14 Primary Flow | Shared wrapper checks `process.version` against a defined minimum before any validator's parsing logic runs | Shared wrapper module exists | Run any validator under a Node version at/above the asserted minimum | No version-related message is printed; execution proceeds directly into the validator's checks |
| 20.1.2 | UC-14-A1 | A much newer Node LTS still passes (floor check, not exact match) | Node version well above the asserted minimum available | Run a validator under that Node version | Passes identically to 20.1.1; no version-related message |
| 20.1.3 | UC-14-E1 | Node below the minimum fails loudly with a specific message, before any parsing logic runs | A Node version below the asserted minimum available (or `process.version` mocked in a wrapper-level unit test) | Run a validator under the insufficient Node version | Exit code non-zero; message names both the required minimum and the detected version; no cryptic `SyntaxError` is produced |
| 20.1.4 | UC-14-E2 | Missing `node` entirely fails at the shell invocation, not inside the script | A shell environment where `node` is not on `PATH` | Run `node scripts/ci/validate-agents.js` | Shell reports "command not found"; exit code `127`; confirms the workflow's independent Node-setup step (18.1.3) is what guarantees presence |
| 20.1.5 | UC-14-EC1 | A shadowing node binary/alias is still caught by the wrapper's runtime check | `PATH` manipulated so a scratch shim reporting an old `process.version` is found before the real `node` | Run a validator with the shadowed `PATH` | The wrapper still flags the detected (shadowed) version as insufficient — it checks whichever binary actually executed it |
| 20.1.6 | UC-14-EC2 | Every validator file imports the shared wrapper (no validator bypasses the version check) | All `scripts/ci/validate-*.js` files exist | Grep each file for the shared wrapper's import statement | Every validator file contains the import; any future validator lacking it is flagged as a defect by this same grep |

---

## 21. PRD Status Reconciliation and Slash-Command Reference Sweep (FR-6.2–FR-6.5, FR-7)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 21.1.1 | FR-6.2, AC-7 | `docs/PRD.md` Section 2 Status reads `[SHIPPED]` | Implementation complete | Read Section 2's `**Status:**` field | Value is exactly `[SHIPPED]` |
| 21.1.2 | FR-6.3, AC-7 | `docs/PRD.md` Section 5 Status reads `[SHIPPED]` | Implementation complete | Read Section 5's `**Status:**` field | Value is exactly `[SHIPPED]` |
| 21.1.3 | FR-6.4, AC-7 | `docs/PRD.md` Section 3 Status reads `[SUPERSEDED]` with a superseding note | Implementation complete | Read Section 3's `**Status:**` field and surrounding text | Value is exactly `[SUPERSEDED]`; a note references the F4 profile-driven rewrite mechanism and states none of Section 3's FRs are implemented as originally specified |
| 21.1.4 | FR-6.5, AC-7 | `docs/PRD.md` Section 4 Status remains `[DRAFT]` | Implementation complete | Read Section 4's `**Status:**` field | Value is unchanged: `[DRAFT]` |
| 21.1.5 | FR-7.3, AC-4 | No unreviewed bare command reference remains across the 19 scoped files | Implementation complete | Run `grep -rn` for `/develop-feature`, `/bootstrap-feature`, `/implement-slice`, `/merge-ready`, `/context-refresh` across the 19 files listed in PRD FR-7.2 | Every match is either updated to show both namespaced and bare forms, or is annotated/confirmed as a non-plugin-invocation reference (e.g. a heading label) — no match is left unreviewed |
| 21.1.6 | FR-7.2, FR-7.1 | `install.sh`'s 10 bare command references (help text + pre-install banner) are included in the sweep | `install.sh` exists | Grep `install.sh` for the 5 command name patterns; count occurrences and confirm each shows the reviewed/updated form | 10 occurrences total, all updated per FR-7.1 |
| 21.1.7 | FR-7.2 | `templates/CLAUDE.md` correctly contains zero bare command references (excluded from the 19-file scope) | `templates/CLAUDE.md` exists | Grep the file for the 5 command name patterns | Zero matches, corroborating its exclusion from the sweep scope |
| 21.1.8 | FR-7.2 | `CHANGELOG.md` and `.claude/scratchpad.md` are deliberately outside the sweep scope | Both files exist | Confirm neither appears in FR-7.2's file list; confirm both appear in the PRD's Unchanged Files table with a rationale | Neither is in scope. `CHANGELOG.md` entries are past-tense historical records — rewriting a command name inside one would falsify the record. `.claude/scratchpad.md` is transient orchestrator state, rewritten continuously during a run. Bare references surviving in either file are correct, not defects |

---

## 22. Cross-Cutting NFRs

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 22.1.1 | NFR-2 | install.sh-only usage retains full pipeline functionality | See Section 15 | — | — |
| 22.1.2 | NFR-2 | Combined install.sh + plugin usage does not end in conflicting/duplicated resolution | See Sections 6 and 13 (legacy-command and agent-shadowing mitigations) | — | — |
| 22.1.3 | NFR-4 | No skill file inserts the plugin install/uninstall lifecycle as a per-feature pipeline step | All 5 `skills/*/SKILL.md` files exist | Grep each for `/plugin install` or `plugin install` appearing as a required pipeline step (excluding the FR-8 preflight's read-only reference to `bash install.sh` as a suggested remedy) | No skill's main pipeline flow requires a plugin install/uninstall action as a step a human must perform per feature |
| 22.1.4 | NFR-5 | Asset budget: 0 new agents/skills added; hooks reserved but unpopulated | Implementation complete | `ls agents/*.md \| wc -l` (cross-ref 2.1.1); `ls skills/*/SKILL.md \| wc -l` (cross-ref 2.2.1); `ls hooks/ 2>/dev/null \| wc -l` | 13 agents; 5 skills; hooks directory absent or contains 0 files |

---

## Use Case to Test Case Traceability Matrix

| Use Case Scenario | Test Cases |
|---|---|
| UC-1 Primary Flow | 5.1.1, 5.1.2 |
| UC-1-A1 | 5.1.3 |
| UC-1-A2 | 5.1.4 |
| UC-1-E1 | (cross-ref UC-9, see UC-9 rows) |
| UC-1-E2 | 5.1.5 |
| UC-1-EC1 | 5.1.6 |
| UC-1-EC2 | 5.1.7 |
| UC-2 Primary Flow | 6.1.1, 6.1.2, 6.1.3 |
| UC-2-A1 | 6.1.4 |
| UC-2-E1 | (cross-ref UC-7, see Section 12) |
| UC-2-E2 | 6.1.5 |
| UC-2-E3 | 6.1.6, 6.1.10 |
| UC-2-EC1 | 6.1.7 |
| UC-2-EC2 | 6.1.8 |
| UC-2-EC3 | 6.1.9 |
| UC-3 Primary Flow | 7.1.1 |
| UC-3-A1 | 9.1.2 |
| UC-3-A2 | 7.1.3 |
| UC-3-E1 | 7.1.4 |
| UC-3-E2 | 7.1.5 |
| UC-3-E3 | 7.1.6 |
| UC-3-EC1 | 7.1.7 |
| UC-3-EC2 | 7.1.8 |
| UC-3-EC3 | 7.1.9 |
| UC-3-EC4 | 8.1.1, 8.1.2, 8.1.3 |
| UC-4 Primary Flow | 9.1.1, 9.1.2, 9.1.3 |
| UC-4-A1 | 9.1.4 |
| UC-4-E1 | 9.1.5 |
| UC-4-EC1 | 9.1.6 |
| UC-4-EC2 | 8.1.4 |
| UC-4-EC3 | 9.1.7 |
| UC-5 Primary Flow | 10.1.1 |
| UC-5-A1 | 10.1.2 |
| UC-5-A2 | 10.1.3 |
| UC-5-A3 | 10.1.4 |
| UC-5-E1 | 10.1.5 |
| UC-5-E2 | (cross-ref UC-7, see Section 12) |
| UC-5-E3 | 10.1.7, 10.1.8, 10.1.9, 10.1.10 |
| UC-5-EC1 | 10.1.11 |
| UC-5-EC2 | 10.1.12 |
| UC-6 Primary Flow | 11.1.1, 11.1.8 |
| UC-6-A1 | 11.1.2 |
| UC-6-E1 | 11.1.3 |
| UC-6-E2 | 11.1.4 |
| UC-6-EC1 | 11.1.5 |
| UC-6-EC2 | 11.1.6 |
| UC-7 Primary Flow | 12.1.1 |
| UC-7-A1 | 12.1.2 |
| UC-7-E1 | 12.1.3 |
| UC-7-E2 | 12.1.4 |
| UC-7-EC1 | 12.1.5 |
| UC-7-EC2 | 12.1.6 |
| UC-8 Primary Flow | 13.1.1, 13.1.2 |
| UC-8-A1 | 13.1.3 |
| UC-8-E1 | 13.1.4 |
| UC-8-E2 | 13.1.5 |
| UC-8-E3 | 6.1.6 |
| UC-8-EC1 | 13.1.7 |
| UC-8-EC2 | 13.1.8 |
| UC-9 Primary Flow | 14.1.9 |
| UC-9-A1 | (documentation cross-reference; installs completing to UC-1/UC-2 postconditions — see Sections 5–6) |
| UC-9-A2 | 14.1.6, 14.1.8 |
| UC-9-E1 | 13.1.5 (manual `/agents` verification guidance) |
| UC-9-E2 | 14.1.3, 14.1.4, 14.1.8 |
| UC-9-E3 | 14.1.5, 14.1.8 |
| UC-9-EC1 | 14.1.10 |
| UC-9-EC2 | 14.1.11 |
| UC-9-EC3 | 14.1.7 |
| UC-10 Primary Flow | 15.1.1 |
| UC-10-A1 | 15.1.2 |
| UC-10-E1 | 15.1.3 |
| UC-10-EC1 | 15.1.4 |
| UC-10-EC2 | 15.1.5 |
| UC-11 Primary Flow | 16.1.1 |
| UC-11-A1 | 16.1.2 |
| UC-11-A2 | 16.1.3, 21.1.5 |
| UC-11-E1 | 16.1.4 |
| UC-11-EC1 | 16.1.5 |
| UC-11-EC2 | 16.1.6 |
| UC-11-EC3 | 16.1.7 |
| UC-12 Primary Flow | 18.2.1, 18.3.1, 18.4.1, 18.5.1, 18.6.1, 18.7.1 |
| UC-12-A1 | 18.2.2 |
| UC-12-A2 | 18.3.2 |
| UC-12-A3 | 18.4.2 |
| UC-12-A4 | 18.5.2 |
| UC-12-A5 | 18.6.2, 18.6.3 |
| UC-12-A6 | 18.7.2 |
| UC-12-E1 | 18.8.1 |
| UC-12-E2 | 18.8.2 |
| UC-12-E3 | 20.1.4 |
| UC-12-EC1 | 18.2.3, 18.2.4, 18.3.3, 18.5.3, 18.6.4 |
| UC-12-EC2 | 18.4.3 |
| UC-12-EC3 | 18.5.4 |
| UC-13 Primary Flow | 19.1.1 |
| UC-13-A1 | 19.1.2 |
| UC-13-E1 | 18.7.2 |
| UC-13-E2 | 18.7.3 |
| UC-13-EC1 | 18.7.4, 18.7.5 |
| UC-14 Primary Flow | 20.1.1 |
| UC-14-A1 | 20.1.2 |
| UC-14-E1 | 20.1.3 |
| UC-14-E2 | 20.1.4 |
| UC-14-EC1 | 20.1.5 |
| UC-14-EC2 | 20.1.6 |
| FR-1.1–FR-1.3 / AC-1 | 1.1.1–1.1.4 |
| FR-2.1–FR-2.4 / AC-5 | 2.1.1–2.2.6 |
| FR-3.1–FR-3.4 / AC-8 | 3.1.1–3.1.5 |
| FR-4.1 | 4.1.1–4.1.7 |
| FR-4.5 (regression guard) | 6.1.10, 7.1.5 |
| FR-4.6 / AC-10 (personal-file exclusion) | 4.1.4, 7.1.1–7.1.9 |
| FR-4.7 / AC-10 (path safety) | 8.1.1–8.1.6, 11.1.7 |
| FR-4.8 (receipt format) | 4.2.1, 4.2.2, 10.1.13 |
| FR-4.9 / AC-14 (legacy commands dropped) | 6.1.2, 21.1.6 |
| FR-4.10 (atomic backup) | 12.1.3 |
| FR-5.1 | 18.1.1–18.1.3 |
| FR-5.2–FR-5.7 / AC-2 | 18.2.1–18.7.6 |
| FR-5.8 / AC-2 | 18.2.2, 18.3.2, 18.4.2, 18.5.2, 18.6.2, 18.6.3, 18.7.2 |
| FR-5.9 / AC-12 | 18.2.3, 18.2.4, 18.3.3, 18.4.3, 18.5.3, 18.5.4, 18.6.4, 18.7.6 |
| FR-6.1 / AC-6 | 19.1.1 |
| FR-6.2–FR-6.5 / AC-7 | 21.1.1–21.1.4 |
| FR-7.1–FR-7.3 / AC-4 | 16.1.1–16.1.4, 21.1.5–21.1.7 |
| FR-8.1–FR-8.3 / AC-13 | 14.1.1–14.1.8 |
| NFR-1 / AC-9 | 17.1.1–17.1.5, 18.8.3, 20.1.1–20.1.6 |
| NFR-2 | 22.1.1, 22.1.2 |
| NFR-3 / AC-3 | 11.1.1, 11.1.8 |
| FR-4.3 (restore allowlist, security) | 11.1.9, 11.1.10 |
| NFR-4 | 22.1.3 |
| NFR-5 | 22.1.4 |
