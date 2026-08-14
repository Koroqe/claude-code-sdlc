# Use Cases: Plugin Repackaging and Harness CI

> Based on [PRD](../PRD.md) — Section 6: Plugin Repackaging and Harness CI

**System context (do not assume otherwise):** `claude-code-sdlc` is a universal, multi-project harness distributed as a source repo plus a bash installer (`install.sh`), now also distributed as a native Claude Code plugin (`.claude-plugin/`). There is no web application, no database, and no HTTP API anywhere in this system. Every scenario below is either a local filesystem operation (`install.sh`, `~/.claude/*`), a Claude Code CLI operation (`/plugin install`, `/agents`, skill invocation), or a CI process (`.github/workflows/ci.yml`, `scripts/ci/*.js`). Actors are: the **Harness Maintainer** (works inside this repo), the **Adopting Developer** (installs/uses the harness in their own projects), **Claude Code** itself (loads agents/skills/hooks/memory and resolves names), and **CI** (the GitHub Actions runner).

**Manifest format note:** `manifests/owned-files.txt` is plain newline-delimited text — `#` comments and `owns`/`legacy` section markers are allowed — parseable entirely by POSIX shell tools; `install.sh` is explicitly forbidden from invoking `node` or `jq`. Each data line is **one relative path per line, relative to `~/.claude`** (e.g. `agents/planner.md`, `commands/develop-feature.md`), never an absolute path. `install.sh` resolves every entry as `~/.claude/<entry>` and rejects (does not act on) any entry containing a leading `/` (absolute) or a `..` traversal segment — see UC-3-EC4. The file has two sections: **`owns`** (the v4.0 footprint — the 13 agent paths, `claude.md`, and the 5 rule paths) and **`legacy`** (v3.1-era paths this release retires, currently the 5 command files formerly copied to `~/.claude/commands/` by v3.1's `install.sh:208-211`). Both `owns` and `legacy` entries are removed by `--uninstall`; only `legacy` entries are removed (never refreshed) by an upgrade install, since v4.0 no longer writes anything to `~/.claude/commands/`. A separate, per-machine **install receipt** (`~/.claude/.sdlc-receipt`, same relative-path format, FR-4.8) records exactly what a specific `install.sh` run placed and is `--uninstall`'s preferred removal source, with the manifest as fallback — see UC-1 and UC-5.

---

## UC-1: Fresh Install — Plugin + install.sh on a Clean Machine

**Actor**: Adopting Developer
**Preconditions**:
- The machine has no `~/.claude/claude.md`, no `~/.claude/rules/`, and no `~/.claude/agents/*.md` file matching any of the 13 harness agent names — this is a genuinely first-time install (`~/.claude/agents/` may not exist, may exist empty, or may contain only unrelated personal agent files)
- The developer has a local checkout of `claude-code-sdlc` at the v4.0 release
- Claude Code CLI is installed and on `PATH`

**Trigger**: Developer runs `bash install.sh` from the repo root, and separately runs `/plugin marketplace add <repo-path>` followed by `/plugin install <plugin-name>` inside Claude Code

### Primary Flow (Happy Path)
1. Developer runs `bash install.sh` from the repo root.
2. `install.sh` reads `manifests/owned-files.txt` and finds none of the listed harness-owned paths exist yet under `~/.claude` — the pre-install cleanup pass has nothing to remove.
3. `install.sh` creates a timestamped backup directory per the existing (unchanged) backup behavior, noting there was no prior installation to preserve.
4. `install.sh` copies each of the 13 agent files from the repo's `agents/*.md` into `~/.claude/agents/*.md`.
5. `install.sh` copies `src/claude.md` → `~/.claude/claude.md` and each `src/rules/*.md` → `~/.claude/rules/*.md`.
6. `install.sh` writes an install receipt to `~/.claude/.sdlc-receipt` (FR-4.8) — the same newline-delimited, relative-path format as the manifest: line 1 is the installed version, and each following line is one relative path (relative to `~/.claude`) for a file this specific install operation placed — exactly the 13 agent paths, `claude.md`, and the 5 rule paths.
7. `install.sh` prints a success summary: version installed, file counts, receipt location, backup location.
8. Developer opens Claude Code and runs `/plugin marketplace add <repo-path>`, then `/plugin install <plugin-name>`.
9. `claude plugin validate .` exits `0`.
10. Claude Code registers the plugin's 5 skills (`develop-feature`, `bootstrap-feature`, `implement-slice`, `merge-ready`, `context-refresh`) and makes the plugin's own copies of the 13 agents available.
11. Developer runs `/agents` — all 13 harness agents are listed and resolve without ambiguity (the freshly-written `~/.claude/agents/` copies and the plugin's copies have identical content immediately after a fresh install).

**Postconditions**:
- `~/.claude/agents/` contains the 13 harness agent files (plus any pre-existing personal files, untouched)
- `~/.claude/claude.md` and `~/.claude/rules/*.md` exist and match the repo's `src/claude.md` / `src/rules/*.md`
- `~/.claude/.sdlc-receipt` exists; its first line equals the installed version, and its remaining lines are exactly the relative paths of the files this install placed (13 agent paths + `claude.md` + 5 rule paths) — no more, no fewer
- The plugin's 5 skills are invocable
- `/agents` shows all 13 harness agents resolved with no drift between sources

### Alternative Flows
- **UC-1-A1: Plugin installed before `install.sh`** — order is reversed
  1. Developer runs `/plugin marketplace add` + `/plugin install` first, then `bash install.sh` second
  2. Both operations are idempotent and do not depend on each other's completion; the end state is identical to the primary flow regardless of order
- **UC-1-A2: Machine has unrelated personal agents but no harness footprint**
  1. `~/.claude/agents/` already contains files unrelated to this harness (e.g., a developer's own custom agent)
  2. Those files are absent from `manifests/owned-files.txt` and are never read, modified, or removed by any step of the install

### Error Flows
- **UC-1-E1: Developer installs only the plugin and skips `bash install.sh`** — the half-migration case, fully covered by UC-9; cross-referenced here as the most common way a "fresh install" goes wrong.
- **UC-1-E2: Insufficient filesystem permissions on `~/.claude`**
  1. `bash install.sh` attempts to create or write under `~/.claude` and the operation is denied
  2. `install.sh` reports a clear permission error naming the exact path that failed
  3. `install.sh` exits non-zero
  4. Files not yet reached in the manifest-driven copy loop are simply absent, not partially written (connects to the interrupted-install recovery property in UC-7)

### Edge Cases
- **UC-1-EC1**: `~/.claude` does not exist at all (developer has never used Claude Code before). `install.sh` creates `~/.claude/agents/` and `~/.claude/rules/` as needed before copying into them.
- **UC-1-EC2**: Developer re-runs `bash install.sh` a second time immediately with no changes in between. The run is idempotent — identical content overwrites identical content, the script reports success again, and a new (redundant) timestamped backup directory is created reflecting the already-migrated state.

### Data Requirements
- **Input**: Repo checkout contents (`agents/*.md`, `src/claude.md`, `src/rules/*.md`), `manifests/owned-files.txt`
- **Output**: Populated `~/.claude/agents/`, `~/.claude/claude.md`, `~/.claude/rules/*.md`; a new `~/.claude/.sdlc-receipt`; a plugin registration in Claude Code's plugin state
- **Side Effects**: New directories/files created under `~/.claude`; the install receipt written; a timestamped backup directory created; no network calls beyond `/plugin marketplace add` reading the local repo path

---

## UC-2: Upgrade Install — Existing v3.1 Layout Present

**Actor**: Adopting Developer (or Harness Maintainer on the reference machine)
**Preconditions**:
- `~/.claude/agents/` contains 16 files: 13 legacy harness agent copies (v3.1 content) and 3 personal files (`brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md`)
- `~/.claude/rules/` contains 5 legacy rule files; `~/.claude/claude.md` exists from the v3.1 install
- `~/.claude/commands/` contains the 5 legacy v3.1 command files (`develop-feature.md`, `bootstrap-feature.md`, `implement-slice.md`, `merge-ready.md`, `context-refresh.md`), copied there by v3.1's `install.sh` (`install.sh:208-211` in the pre-v4.0 script)
- No plugin has been installed on this machine yet
- No manifest-based tracking has run on this machine before (v3.1 predates `manifests/owned-files.txt`)

**Trigger**: Developer updates their local checkout to v4.0 and runs `bash install.sh`

### Primary Flow (Happy Path)
1. `install.sh` detects an existing installation (v3.1 `claude.md` and/or agent files matching manifest-known names are present).
2. `install.sh` creates a timestamped backup directory containing a full copy of `~/.claude` in its pre-upgrade state — this backup captures `~/.claude/commands/` as it stood before removal, in addition to agents/rules/claude.md.
3. `install.sh` reads the manifest's `owns` section and, for each of the 13 harness agent paths listed, overwrites the file on disk with the current v4.0 content — refreshing any drift, including hand-edited content if present on this machine (see UC-8).
4. `install.sh` overwrites `~/.claude/claude.md` and each `~/.claude/rules/*.md` with the v4.0 content.
5. `install.sh` reads the manifest's `legacy` section — the 5 v3.1 command paths under `~/.claude/commands/` — and removes each one present on disk. v4.0 no longer installs or refreshes commands via `install.sh`; commands are now plugin skills, and leaving the legacy files in place would let them shadow the plugin's skills of the same name (see UC-2-E3).
6. `install.sh` does not touch the 3 personal agent files — they are absent from both the `owns` and `legacy` sections and are never enumerated.
7. `install.sh` writes (this machine's first) install receipt to `~/.claude/.sdlc-receipt`, per FR-4.8, recording the new version and the relative paths of every file this upgrade run placed (13 agent paths + `claude.md` + 5 rule paths) — v3.1 never wrote one, so this is the point at which the receipt-based removal path (UC-5) becomes available on this machine.
8. `install.sh` prints a summary: version bumped from the old value to the new value, 13 agent files refreshed, 5 legacy command files removed, receipt written, memory layer refreshed, backup location.
9. Developer runs `/plugin marketplace add <repo-path>` + `/plugin install <plugin-name>`.
10. `/agents` shows all 13 harness agents; since the `~/.claude/agents/` copies were just refreshed to match the repo, they are consistent with the plugin's copies.
11. Developer types `/develop-feature <feature description>` — it resolves to the plugin's skill, because no `~/.claude/commands/develop-feature.md` remains on disk to compete in command-name resolution.

**Postconditions**:
- `~/.claude/agents/` contains 16 files: 13 refreshed harness copies + 3 unchanged personal files
- No content drift remains between `~/.claude/agents/*.md` and the repo's `agents/*.md`
- `~/.claude/claude.md` and `~/.claude/rules/*.md` match v4.0
- `~/.claude/.sdlc-receipt` now exists (it did not before this upgrade), listing the version and the files this upgrade placed
- `~/.claude/commands/` is empty or absent — `ls ~/.claude/commands/*.md 2>/dev/null | wc -l` returns `0`
- `/develop-feature` (and the other 4 skill names) resolve to the plugin's skill, not a legacy local command
- A timestamped backup of the pre-upgrade state exists, including the removed `~/.claude/commands/` content

### Alternative Flows
- **UC-2-A1: Upgrade closes an existing shadowing gap as a side effect** — if this machine already has hand-edited agent copies (the `fable`-model scenario in UC-8), a correctly-run upgrade's unconditional overwrite in step 3 refreshes them to the repo's content automatically, closing the gap without any extra developer action. The same is true of legacy commands: a correctly-run upgrade's `legacy`-section removal in step 5 closes the command-shadowing gap covered in UC-2-E3, as a normal side effect of the upgrade rather than a separate remediation step.

### Error Flows
- **UC-2-E1: Upgrade is interrupted mid-way** — see UC-7 for the full interrupted-install scenario and recovery path.
- **UC-2-E2: The manifest's `owns` section is missing one of the 13 agent paths (authoring defect)**
  1. The manifest fails to enumerate one harness agent's path in `owns`
  2. That one file is never refreshed during the upgrade
  3. Its v3.1 (or hand-edited) content survives the upgrade unchanged
  4. `claude plugin validate` and `/plugin install` both still succeed, and this single stale file silently shadows the plugin's equivalent agent — this is the concrete mechanism behind UC-8's failure mode
- **UC-2-E3: Legacy `~/.claude/commands/*.md` files survive the upgrade — command shadowing (structurally identical to UC-8's agent shadowing, applied to commands instead of agents)**
  1. The manifest's `legacy` section is missing one or more of the 5 command paths (an authoring defect), or the upgrade's step-5 removal silently fails (e.g., a permission error is not surfaced)
  2. `bash install.sh` still reports success; `claude plugin validate .` still exits `0`; `/plugin install` still reports success; `/agents` still shows all 13 agents resolved cleanly — every install-time and validate-time signal is green
  3. `~/.claude/commands/develop-feature.md` (the stale v3.1 command file) still exists on disk
  4. Claude Code's command-name resolution includes user-level `~/.claude/commands/*.md` entries alongside the plugin-provided skill of the same name; the stale local command takes precedence over the plugin skill — the same resolution-order pattern as the agent shadowing covered in UC-8
  5. When the developer types `/develop-feature <description>`, it executes the **v3.1 command prompt** — an older, pre-plugin version with no `$ARGUMENTS` handling (FR-2.4) and no skill frontmatter — not the v4.0 plugin skill
  6. **Observable symptom**: every install-time and validate-time check is green, yet `/develop-feature`'s actual behavior (its argument handling, its exact wording, anything added to the skill in v4.0) does not match `skills/develop-feature/SKILL.md`
  7. **Detection**: run `ls ~/.claude/commands/*.md` after a "completed" migration — presence of any of the 5 legacy filenames confirms the defect; diffing the executed prompt's content against the corresponding `skills/<name>/SKILL.md` also reveals the mismatch directly
  8. **Remedy**: remove the surviving file(s) from `~/.claude/commands/` — either manually, or by re-running a corrected `install.sh` whose `legacy` section now lists the missing path — then re-invoke the affected skill and confirm its behavior now matches the plugin skill

### Edge Cases
- **UC-2-EC1**: The legacy install had fewer than 13 agents (e.g., an agent was added to the harness after the developer's last install). The upgrade writes the missing agent file(s) fresh, rather than requiring them to pre-exist.
- **UC-2-EC2**: The legacy install's rules directory has a rule file that no longer exists in v4.0's `src/rules/*.md` (a rule was retired upstream). The manifest-scoped refresh does not delete files no longer present in the source unless the manifest explicitly enumerates their removal — a documented limitation the Harness Maintainer must account for when retiring a rule file (the `legacy`-section mechanism used for the 5 command files is exactly this pattern applied correctly).
- **UC-2-EC3: Developer hand-edited one of the 5 legacy command files** — e.g., customized `~/.claude/commands/merge-ready.md` with project-specific notes or an altered gate list before v4.0 shipped
  1. `install.sh`'s `legacy`-section removal in step 5 is unconditional — it does not diff the file's content against the original v3.1-shipped version before removing it; a hand-edited file is removed exactly like an unmodified one
  2. Because the timestamped backup in step 2 captures the full pre-upgrade `~/.claude` (including `~/.claude/commands/`) before any removal happens, the hand-edited file is preserved there — no separate backup mechanism is needed
  3. `install.sh` prints an explicit warning naming each removed legacy command file and stating it was retired as part of the v3.1-to-v4.0 command-to-skill migration, together with the backup path it can be recovered from
  4. The developer's customization is not silently destroyed — it is recoverable via `--restore <backup-dir>` (UC-6) or by manually copying the single file back out of the backup directory — but it is also not preserved in place, since a stale local command silently shadowing the plugin (UC-2-E3) is judged the worse outcome versus a one-time, clearly-logged, backed-up removal
  5. `install.sh` does not attempt to merge or auto-port the customization into the plugin's `skills/<name>/SKILL.md`; if the developer wants the customization going forward, they must reapply it themselves against the plugin skill

### Data Requirements
- **Input**: Pre-upgrade `~/.claude` state (including `~/.claude/commands/`); v4.0 repo content; `manifests/owned-files.txt` (`owns` and `legacy` sections)
- **Output**: Refreshed `~/.claude/agents/*.md` (13 files), `~/.claude/rules/*.md`, `~/.claude/claude.md`; a new `~/.claude/.sdlc-receipt`; `~/.claude/commands/` emptied of the 5 legacy files
- **Side Effects**: Timestamped backup created (captures the legacy command files before removal); 13 agent files overwritten; 5 legacy command files removed; 3 personal files untouched; a warning printed for any removed file that differed from the original v3.1-shipped content

---

## UC-3: Install/Uninstall Preserves the Developer's Own Unrelated Agents (Critical Safety Scenario)

**Actor**: Adopting Developer running `install.sh` (fresh install, upgrade, or `--uninstall`) on a machine with pre-existing personal agents
**Preconditions**:
- `~/.claude/agents/` contains 16 files: 13 harness-owned agent copies (matching the `owns` section of `manifests/owned-files.txt`) and 3 personal files unrelated to the harness: `brand-guardian.md`, `demo-script-writer.md`, `social-copywriter.md`
- `manifests/owned-files.txt` correctly enumerates exactly the 13 harness agent paths in `owns` (plus the rule and `claude.md` paths), and does **not** list the 3 personal files (FR-4.6)
- Every path in the manifest, in both `owns` and `legacy`, is a relative path (relative to `~/.claude`, per FR-4.7) with no leading `/` and no `..` traversal segments
- The developer has not manually edited the manifest

**Trigger**: Developer runs `bash install.sh` (upgrade path) or `bash install.sh --uninstall`

### Primary Flow (Happy Path)
1. Before making any change, the developer (or a QA test harness) records a checksum of every file currently in `~/.claude/agents/`.
2. `install.sh` reads `manifests/owned-files.txt` and builds its removal/overwrite set exclusively from it — exactly the 13 harness paths.
3. `install.sh` iterates only over the manifest's file list; for each entry present on disk, it removes or overwrites it.
4. `install.sh` never enumerates `~/.claude/agents/` directly and never runs a glob-based deletion (e.g. `rm ~/.claude/agents/*.md`) against that directory.
5. `install.sh` completes; the 3 personal files still exist at their original paths with unchanged content — byte-identical to their pre-install checksum.
6. `ls ~/.claude/agents/*.md | wc -l` immediately after a real `--uninstall` returns `3` — only the personal files. Each of the 3 files passes `diff` against its pre-install snapshot with zero differences.

**Postconditions**:
- Exactly 3 files remain in `~/.claude/agents/` after `--uninstall` (or 16 after a fresh reinstall/upgrade that repopulates the 13 harness files)
- Each of the 3 personal files is byte-identical to its pre-install content
- No file outside the manifest's enumerated set was created, modified, or deleted

### Alternative Flows
- **UC-3-A1: `--dry-run` precedes the real operation** — see UC-4; the dry-run's printed list is verified to exclude all 3 personal files before the developer proceeds.
- **UC-3-A2: Fresh install with no personal agents present** — the manifest-scoped copy writes only the 13 harness files; there is nothing to preserve and no conflict.

### Error Flows
- **UC-3-E1: Manifest is stale/incomplete** — a harness file exists on disk but is missing from `manifests/owned-files.txt` (e.g., a renamed agent). `install.sh` does not know to remove or refresh it; the file survives as an orphan. This does not put the 3 personal files at risk (they are correctly never listed either way) but can leave a stale harness copy — the shadowing risk covered in UC-8, not a personal-file-destruction risk.
- **UC-3-E2 (defect scenario — must never occur in a passing build)**: A regression reintroduces glob-based cleanup (`rm ~/.claude/agents/*.md`) instead of manifest-scoped removal. This would delete all 16 files, including the 3 personal ones. This is explicitly the destructive-uninstall risk named in the PRD (Risk 1). It MUST be caught by a QA test that seeds the 3 personal files, runs `--uninstall`, and asserts their post-condition presence and content — the build fails if this regression is present.
- **UC-3-E3: A personal file shares a filename with a harness-owned agent** — e.g., the developer independently created their own `planner.md` unrelated to the harness. Manifest-scoped removal cannot distinguish "the harness's own copy" from "a same-named personal file" by path alone in this exact collision. This is the shadowing case, covered fully in UC-8; the mitigation is verifying via `/agents` after install, not assuming path-based removal is always semantically safe.

### Edge Cases
- **UC-3-EC1**: `--uninstall` is run twice in a row (idempotent). The second run finds the manifest's file set already removed, reports "0 files removed, already clean," and the 3 personal files remain untouched both times.
- **UC-3-EC2**: One of the 3 personal files was already deleted by the developer for unrelated reasons before running `install.sh`. The manifest still correctly excludes it; the cleanup pass never attempts to touch it and raises no error for its absence.
- **UC-3-EC3**: `~/.claude/agents/` does not exist at all (fresh machine, directory absent). The manifest-scoped logic checks path existence per file before acting and does not fail when the parent directory is missing; it creates the directory only as needed to write harness files into it.
- **UC-3-EC4: Malicious or malformed manifest entry — path traversal or absolute path (mandatory security behavior)**
  1. A manifest entry, in either the `owns` or `legacy` section, violates the relative-path-only format required by FR-4.7 — e.g. a `..` traversal segment (`../.ssh/id_rsa`), or a leading `/` making it an absolute path (`/etc/passwd`) instead of a path relative to `~/.claude`
  2. Before acting on any entry, `install.sh` rejects any entry with a leading `/` outright (the format only ever accepts relative paths) and additionally rejects any entry containing a `..` segment, so that the path resolved as `~/.claude/<entry>` cannot escape `~/.claude` either by being absolute or by traversing upward
  3. On finding such an entry, `install.sh` rejects it and refuses to proceed with **any** operation from that manifest load — not merely skipping the one bad line — and exits non-zero with a message naming the offending line number and path
  4. No file is created, modified, or deleted anywhere under `~/.claude` — the entire run is aborted before any destructive action, regardless of whether the malformed entry appears first or last in the file
  5. This validation applies uniformly to every code path that reads the manifest (or the install receipt — see UC-5): fresh install, upgrade, `--uninstall`, and `--dry-run` (see UC-4-EC2) all perform it before doing anything else with the file's contents

### Data Requirements
- **Input**: `manifests/owned-files.txt` (`owns` and `legacy` sections); current file listing and checksums of `~/.claude/agents/`
- **Output**: Console report of files removed/kept; unchanged personal files; for UC-3-EC4, a rejection message and non-zero exit instead of any file operation
- **Side Effects**: Only manifest-listed files are created, overwritten, or deleted under `~/.claude`; a timestamped backup is written before any destructive action; a manifest containing an out-of-tree path produces zero side effects

---

## UC-4: `--dry-run` Preview Before Any Destructive Operation

**Actor**: Adopting Developer
**Preconditions**: The harness is already installed (upgrade or pre-uninstall state); `manifests/owned-files.txt` exists and is populated

**Trigger**: Developer runs `bash install.sh --dry-run --uninstall` (or `--dry-run` alone for install/upgrade)

### Primary Flow (Happy Path)
1. Developer runs `bash install.sh --dry-run --uninstall`.
2. `install.sh` reads `manifests/owned-files.txt`.
3. For each manifest entry present on disk, `install.sh` prints the path prefixed with the action that would occur ("would remove: ...").
4. `install.sh` performs no filesystem write of any kind — no file is created, modified, or deleted.
5. The command exits `0`.
6. Developer reviews the printed list, confirms it matches the manifest exactly, and confirms it does **not** include `brand-guardian.md`, `demo-script-writer.md`, or `social-copywriter.md`.
7. Developer re-runs `bash install.sh --uninstall` (without `--dry-run`) to perform the real operation.

**Postconditions**:
- `~/.claude`'s filesystem state is byte-identical before and after the dry run — verified by `diff -r` before/after showing zero differences
- The printed file list's count exactly equals the manifest's entry count present on disk

### Alternative Flows
- **UC-4-A1: `--dry-run` without `--uninstall`** — previews a fresh or upgrade install, listing exactly what would be copied or overwritten, without performing any writes.

### Error Flows
- **UC-4-E1: `--dry-run` combined with an invalid or missing flag combination** (e.g., `--dry-run --restore` with no directory argument) — `install.sh` reports a clear usage error and exits non-zero without touching `~/.claude`.

### Edge Cases
- **UC-4-EC1**: The manifest is empty or corrupted (e.g., a zero-byte file, or a section header with no entries beneath it). `--dry-run --uninstall` prints "0 files" and would remove nothing; the developer is warned this is very likely wrong before running the real operation, since a legitimate install always has at least the `claude.md` and rule entries in `owns`.
- **UC-4-EC2**: A manifest entry contains a path-traversal or out-of-tree segment (e.g., `../.ssh/id_rsa`). `--dry-run` still performs full validation before printing anything — it reports the offending entry and refuses to print a preview at all, rather than silently omitting the bad line and previewing only the safe entries. This mirrors the mandatory rejection behavior in UC-3-EC4, applied to the preview path instead of the destructive path.
- **UC-4-EC3**: `--dry-run` is run on a machine with no prior install at all — it prints what a fresh install would create (the 13 agent paths, `claude.md`, 5 rule files) with no errors, since previewing an install does not require a pre-existing state.

### Data Requirements
- **Input**: `manifests/owned-files.txt`; current `~/.claude` filesystem state
- **Output**: A printed list of paths and the actions that would be taken
- **Side Effects**: None — this is the defining property of `--dry-run`

---

## UC-5: `--uninstall` Removes Exactly the Receipt's (or, Failing That, the Manifest's) Files

**Actor**: Adopting Developer
**Preconditions**: The harness is installed via `install.sh` (agents, rules, `claude.md` present per the manifest's `owns` section); the 3 personal agent files are also present in `~/.claude/agents/`; `~/.claude/commands/` may still hold one or more of the 5 `legacy` v3.1 command files if this is the first `install.sh` run on this machine to include manifest-driven legacy cleanup; an install receipt at `~/.claude/.sdlc-receipt` may or may not exist, depending on whether the current installation was placed by v4.0's `install.sh` (receipt present, per UC-1/UC-2 step 6-7) or inherited unchanged from a v3.1 install that predates receipts (receipt absent)

**Trigger**: Developer runs `bash install.sh --uninstall` (a real run, not `--dry-run`)

### Primary Flow (Happy Path — Receipt Present, FR-4.8)
1. `install.sh` creates a timestamped backup directory containing the full pre-uninstall `~/.claude` state, including any legacy command files still present.
2. `install.sh` checks for an install receipt at `~/.claude/.sdlc-receipt` — found.
3. `install.sh` uses the receipt's file list as the authoritative removal set for the harness's own footprint (the 13 agent paths, `claude.md`, the 5 rule paths) — preferring it over the manifest's `owns` section, since the receipt records exactly what *this* install placed rather than the manifest's general description of what v4.0 owns.
4. `install.sh` also reads the manifest's `legacy` section and removes exactly the listed files present on disk (any of the 5 v3.1 command files still under `~/.claude/commands/`) — legacy cleanup always comes from the manifest, since the receipt only ever records what v4.0's own `install.sh` created, never v3.1-era artifacts it didn't place.
5. `install.sh` removes the receipt file itself (`~/.claude/.sdlc-receipt`) as the final step, since it describes an installation that no longer exists.
6. `install.sh` prints a summary: N receipt-driven files removed, M `legacy` files removed, backup location, and confirmation that removal was receipt/manifest-scoped (never a glob).
7. The command exits `0`.
8. Developer confirms: `~/.claude/claude.md` is absent; `~/.claude/rules/` no longer contains the harness's rule files; `~/.claude/agents/` contains only the 3 personal files; `~/.claude/commands/` is empty or absent; `~/.claude/.sdlc-receipt` is absent.

**Postconditions**:
- `~/.claude/claude.md` and the harness's `~/.claude/rules/*.md` files are removed
- `~/.claude/agents/` contains exactly the 3 personal files
- `~/.claude/commands/` contains none of the 5 legacy command files
- `~/.claude/.sdlc-receipt` no longer exists
- A timestamped backup of the pre-uninstall state exists
- Any separately-installed plugin is unaffected — plugin removal is a Claude Code operation (`/plugin uninstall`), outside `install.sh`'s scope

### Alternative Flows
- **UC-5-A1: `--uninstall` on an install.sh-only setup (no plugin ever installed)** — identical result; only the memory layer and receipt/manifest-tracked agent copies are removed, since that is all `install.sh` ever wrote.
- **UC-5-A2: No receipt exists — fallback to the manifest (the expected case for every machine upgrading from v3.1)**
  1. `install.sh` checks for `~/.claude/.sdlc-receipt` — not found (this machine's harness files were placed by v3.1's script and no v4.0 `install.sh` run has happened yet on this machine, or the receipt was manually deleted)
  2. `install.sh` falls back to the manifest's `owns` section as the removal set for the harness's own footprint, exactly as UC-5's primary flow described before receipts existed
  3. Legacy-section removal, backup, and summary proceed identically to the primary flow
  4. The command exits `0` and completes successfully — this fallback is not a degraded or error path; it is the expected, fully-supported day-one behavior on any machine that has never run v4.0's `install.sh`
- **UC-5-A3: AC-11 verification — uninstall still works from the receipt alone when the manifest is unavailable**
  1. The manifest file `manifests/owned-files.txt` is renamed or deleted (this is exactly AC-11's verification setup), while `~/.claude/.sdlc-receipt` remains present from a prior v4.0 install
  2. Developer runs `bash install.sh --uninstall`
  3. `install.sh` checks for the receipt — found — and uses it as the removal set for the 13 agent paths, `claude.md`, and the 5 rule paths, exactly as in the primary flow
  4. `install.sh` attempts to read the manifest's `legacy` section for legacy-command cleanup — the manifest file cannot be found
  5. `install.sh` does not fail the entire uninstall over the missing manifest; it skips legacy-section cleanup, prints an explicit note that legacy cleanup was skipped because the manifest was unavailable, and completes the receipt-driven removal
  6. The command exits `0`; `~/.claude/claude.md`, the rule files, and the 13 agent files (per the receipt) are all removed; the 3 personal files remain untouched, since the receipt — like the manifest — only ever lists harness-owned paths
  7. This directly confirms AC-11: uninstall succeeds from the receipt alone with the manifest absent

### Error Flows
- **UC-5-E1: `--uninstall` run when nothing is installed** — neither the receipt nor any manifest-listed path exists on disk. `install.sh` reports "nothing to uninstall" and exits `0` (not an error condition).
- **UC-5-E2: `--uninstall` interrupted mid-run** — see UC-7 for the full interrupted-operation scenario and recovery path, which applies symmetrically to uninstall as it does to install.
- **UC-5-E3: Receipt exists but is malformed** (e.g., an empty file, a missing version on line 1, or a data line that fails the same relative-path/no-traversal validation as manifest entries — see UC-3-EC4) — `install.sh` treats the receipt as untrustworthy: it prints a warning naming the specific problem (empty file / missing version / invalid entry) and falls back to the manifest's `owns` section for removal, per UC-5-A2, rather than attempting a partial or unsafe removal from a receipt it cannot fully parse. If the manifest is also unavailable in this specific combination (malformed receipt **and** missing manifest), `install.sh` has no safe removal set for the `owns` footprint; it refuses to proceed with that portion of the uninstall and exits non-zero rather than guessing, though legacy-section removal from the manifest is likewise unavailable in that case for the same reason.

### Edge Cases
- **UC-5-EC1**: `--uninstall` is run, then the developer immediately runs `bash install.sh` again (reinstall) without `--restore`. This produces a fresh install per UC-1's primary flow — a valid and supported way to "reset" a corrupted local state.
- **UC-5-EC2**: The receipt lists a file that no longer exists on disk (the developer manually deleted it before running `--uninstall`). Receipt-driven removal skips it without error, exactly as manifest-driven removal already does in UC-3-EC2 — absence of a listed file is not a failure condition.

### Data Requirements
- **Input**: `~/.claude/.sdlc-receipt` if present (preferred); `manifests/owned-files.txt` (`owns` and `legacy` sections) as fallback for the harness footprint, and always for `legacy`; current `~/.claude` state
- **Output**: Console report of files removed (receipt- or manifest-driven) and `legacy` files removed; the 3 personal files reported as untouched (or simply absent from the report, since they were never in scope)
- **Side Effects**: Receipt- or manifest-listed `owns` files removed from `~/.claude`; manifest-listed `legacy` files removed; the receipt file itself removed; a new timestamped backup directory created

---

## UC-6: `--restore <backup-dir>` Reverts `~/.claude` to Its Prior State

**Actor**: Adopting Developer
**Preconditions**: A timestamped backup directory exists from a prior operation (e.g., `~/.claude/backup-20260814-101500/`); the developer has since run `--uninstall` or another operation that altered `~/.claude`

**Trigger**: Developer runs `bash install.sh --restore <backup-dir>`

### Primary Flow (Happy Path)
1. Developer notes the pre-uninstall snapshot exists as `~/.claude/backup-20260814-101500/` (created automatically by the preceding `--uninstall` run, per UC-5).
2. Developer runs `bash install.sh --uninstall`.
3. Developer runs `bash install.sh --restore ~/.claude/backup-20260814-101500`.
4. `install.sh` copies the backup's contents back into `~/.claude`, overwriting current state.
5. The command exits `0` and prints a restore summary.
6. Developer runs `diff -r ~/.claude/backup-20260814-101500 ~/.claude` (excluding the backup directory itself and any newly created backup produced by the restore operation) — returns no differences.

**Postconditions**:
- `~/.claude` is byte-identical to the pre-uninstall snapshot (NFR-3, AC-3)
- `diff -r` between the backup and the restored state shows zero differences

### Alternative Flows
- **UC-6-A1: `--restore` used after a full reinstall to a different version**, not just after `--uninstall` — the mechanism is identical: the backup's content fully overwrites whatever is currently present, regardless of what changed it.

### Error Flows
- **UC-6-E1: `--restore` given a path that is not a valid backup directory** (missing the expected internal structure) — `install.sh` reports a clear error and exits non-zero without touching `~/.claude`.
- **UC-6-E2: `--restore` given a path that does not exist** — `install.sh` reports "backup directory not found: <path>" and exits non-zero without touching `~/.claude`.

### Edge Cases
- **UC-6-EC1**: Multiple backup directories exist from several prior operations over time. `--restore` requires the developer to name the exact directory; `install.sh` does not guess or default to "the most recent" — omitting the argument produces a usage error, not an auto-selected restore.
- **UC-6-EC2**: `--restore` is run twice in a row against the same backup directory. The operation is idempotent: the second restore reproduces the same state, and `diff -r` remains clean after either run.

### Data Requirements
- **Input**: The specified backup directory's contents; current `~/.claude` state
- **Output**: `~/.claude` overwritten to match the backup
- **Side Effects**: Existing `~/.claude` content (post-uninstall or post-reinstall) is replaced; the backup directory itself is not deleted by the restore

---

## UC-7: Partial / Interrupted Install

**Actor**: Adopting Developer whose `install.sh` process is killed mid-operation (Ctrl-C, terminal closed, machine sleep, SIGKILL)
**Preconditions**: `install.sh` is actively copying/removing files per the manifest when the interruption occurs

**Trigger**: The `install.sh` process is terminated before completing its full manifest-driven copy/removal loop

### Primary Flow (Interruption + Recovery)
1. `install.sh` has created the timestamped backup and begun overwriting/removing manifest-listed files.
2. The process is killed after processing, say, 8 of the 13 harness agent entries and before finishing the `claude.md`/rules copy.
3. `~/.claude` is left in a mixed state: some agent files refreshed, some still at prior content, `claude.md` and rules possibly untouched or partially updated.
4. The developer notices the interruption (the shell shows the process was killed, or `/agents` inside Claude Code shows inconsistent results across the 13 agents).
5. The developer re-runs `bash install.sh`.
6. Because every operation is manifest-scoped and unconditional per entry (not "only if previously absent"), the re-run safely converges: files already correctly copied are overwritten again with identical content (a no-op in effect), and files not yet reached are copied now.
7. `install.sh` finishes cleanly on the second run; the resulting state matches a normal, uninterrupted run.

**Postconditions**: After the recovery re-run, `~/.claude` matches the fully-installed expected state; the interruption left no permanent corruption because every operation is safely re-runnable.

### Alternative Flows
- **UC-7-A1: Developer chooses `--restore` instead of re-running forward** — rolls back to the pre-install backup rather than completing the migration; also a valid recovery path (see UC-6).

### Error Flows
- **UC-7-E1: Interruption occurs before the backup step finishes** — a partial backup would not accurately reflect the prior state. `install.sh` must create the backup via an operation that leaves either a complete backup or none visible under the expected name (e.g., write to a temporary path and rename on completion), so `--restore` can never be pointed at an incomplete backup by accident.
- **UC-7-E2: Interruption occurs after harness files are removed but before the new version's files are copied** — `~/.claude` is left with the harness partially or fully absent (e.g., no `claude.md` at all). Until the developer re-runs `install.sh`, the mandatory autonomous-pipeline instruction is not loaded; sessions in this window behave as if the memory layer is entirely uninstalled. The developer must complete the re-run before relying on the harness's automatic pipeline trigger.

### Edge Cases
- **UC-7-EC1**: The interrupted run had already removed/refreshed `~/.claude/agents/planner.md` (a harness file) but had not yet reached the end of the loop. The 3 personal files are never part of the removal/refresh loop regardless of interruption point, since the loop only ever iterates the manifest — so they remain intact irrespective of when the kill occurs.
- **UC-7-EC2**: The developer's retry is also interrupted (killed a second time). The subsequent re-run remains safely idempotent for the same reason: manifest-scoped, unconditional per-entry overwrite/removal has no dependency on how many prior attempts partially completed.

### Data Requirements
- **Input**: The manifest; the partially-modified `~/.claude` state left by the interruption
- **Output**: A fully-converged `~/.claude` state after a successful re-run
- **Side Effects**: None beyond the normal install/uninstall side effects — no additional corruption is introduced by the interruption itself

---

## UC-8: Agent Shadowing — Stale Personal Copy Overrides the Plugin's Agent

**Actor**: Adopting Developer verifying via `/agents`; Claude Code (agent name resolution)
**Preconditions**:
- On the reference machine, `~/.claude/agents/architect.md`, `~/.claude/agents/planner.md`, and `~/.claude/agents/security-auditor.md` are stale copies, each hand-edited to `model: fable` — diverging from the repo's actual frontmatter for these three agents
- The plugin has been installed and provides its own `architect`, `planner`, and `security-auditor` agents (among the 13) with the correct `model:` value
- Cleanup during install/upgrade either did not run, or ran against a manifest that (by defect) failed to include these three paths

**Trigger**: Developer runs `/agents` inside Claude Code after believing the migration to v4.0 is complete

### Primary Flow (Detection)
1. `claude plugin validate .` exits `0` — the plugin manifest itself is structurally valid.
2. `/plugin install` reports success — the plugin's 13 agents, including `planner`, are registered.
3. Developer runs `/agents` to inspect which agent definitions are actually active.
4. `/agents` shows `planner` (and `architect`, `security-auditor`) resolving to `~/.claude/agents/planner.md` — the stale, user-level copy — rather than to the plugin's `agents/planner.md`, because Claude Code's resolution order gives user-level `~/.claude/agents/*.md` precedence over a plugin-provided agent of the same name.
5. The developer inspects `~/.claude/agents/planner.md` and confirms it still reads `model: fable`, not the value the repo's `agents/planner.md` specifies.
6. The developer concludes the plugin's `planner` is shadowed — every `/implement-slice` and `/bootstrap-feature` invocation of `planner` on this machine has been running the stale, hand-edited prompt/model since the "migration."

### Primary Flow (Resolution)
7. The developer runs `bash install.sh` (a normal upgrade re-run, which unconditionally refreshes all 13 manifest-listed agent paths per UC-2) or `bash install.sh --uninstall` followed by a fresh install.
8. The three stale, hand-edited files are overwritten with the repo's current content (or removed entirely, in the uninstall path) — this succeeds without touching the 3 unrelated personal files, per UC-3.
9. The developer re-runs `/agents`.
10. `planner`, `architect`, and `security-auditor` now resolve with content matching the plugin's copies; the resolved `model:` values match the repo's frontmatter, not `fable`.

**Postconditions**:
- `~/.claude/agents/planner.md`, `~/.claude/agents/architect.md`, and `~/.claude/agents/security-auditor.md` either no longer exist or match the repo's current content exactly
- `/agents` resolves all 13 harness agents to non-drifted content
- The 3 personal agents remain present and unaffected

### Alternative Flows
- **UC-8-A1: Only one of the three (say `planner`) is stale** — the other two were already refreshed in a prior partial run. Detection and resolution apply per-agent; `/agents` after cleanup shows the previously-clean two still correct and the newly-cleaned `planner` also correct.

### Error Flows
- **UC-8-E1: The manifest itself is missing one of the three stale paths** (an authoring defect in `manifests/owned-files.txt`) — running the refresh/uninstall does not touch it, and `/agents` after the "completed" migration still shows the stale `fable`-model copy shadowing the plugin. This is the concrete failure mode the PRD names as Risk 2: "the migration will look complete... while actually running stale prompts." Detection requires the explicit `/agents` verification step — `claude plugin validate` and `/plugin install` succeeding are both insufficient on their own.
- **UC-8-E2: The developer never runs `/agents` after migrating** (skips verification) — the shadowing persists silently and indefinitely. There is no automated check inside `/develop-feature` or `/merge-ready` that catches this, because it is a machine-local `~/.claude` state issue, not a repo-state issue. This is a known, accepted gap that the roadmap's cross-cutting verification step exists to close (mandatory `/agents` check after every install).
- **UC-8-E3: See UC-2-E3 for the command-level analog of this same failure** — legacy `~/.claude/commands/*.md` files (rather than `~/.claude/agents/*.md` files) surviving a migration and shadowing the plugin's skills instead of its agents. The detection mechanism (`/agents` here vs. inspecting `~/.claude/commands/` and the skill's executed behavior there) differs because Claude Code resolves agent names and command/skill names through separate namespaces, but the underlying cause — a manifest-scoped cleanup step that didn't run or was incompletely enumerated — is identical.

### Edge Cases
- **UC-8-EC1**: A personal agent happens to be named identically to a harness agent — e.g., the developer independently wrote their own `~/.claude/agents/planner.md` for an unrelated purpose, coincidentally sharing the name. Manifest-scoped removal/refresh would overwrite or delete it as if it were the harness's own copy, because the operation is keyed on path, not on content or provenance. This is a known limitation: the manifest can only track paths it owns; a same-path personal file cannot be distinguished from a stale harness copy by `install.sh`. The PRD's mitigation for this class of risk is `/agents` verification after install, not blind trust in path-based ownership.
- **UC-8-EC2**: All 13 legacy agent copies are present with mixed states — some hand-edited, some byte-identical to the repo. A refresh overwrites all 13 uniformly, since the operation is manifest-driven and unconditional, not conditional on detecting divergence first — this is correct, because any stale copy (edited or not) must not remain once the plugin is authoritative.

### Data Requirements
- **Input**: `/agents` output (agent name → resolved file path); contents of the resolved `~/.claude/agents/*.md` files; `manifests/owned-files.txt`
- **Output**: Confirmation that resolved paths and content match the plugin/repo source, not a stale user-level copy
- **Side Effects**: Refresh or removal of the 3 stale files from `~/.claude/agents/`; no change to the plugin's own files or to the 3 personal agents

---

## UC-9: Plugin-Only Install — Memory Layer Absent (Documented Outcome, Half-Migration Failure Mode, and Entry-Point Preflight Mitigation)

**Actor**: Adopting Developer who runs `/plugin marketplace add` + `/plugin install` and never runs `bash install.sh`; the `develop-feature` and `bootstrap-feature` skills themselves (FR-8 preflight)
**Preconditions**:
- The machine has no prior harness installation of any kind: no `~/.claude/claude.md` and no `~/.claude/rules/*.md` originating from this harness
- The developer has Claude Code installed and can run `/plugin install`

**Trigger**: Developer runs `/plugin marketplace add <repo-path>` then `/plugin install <plugin-name>` and does not separately run `bash install.sh`

### Primary Flow (Documented, Non-Broken Outcome)
1. Developer installs the plugin only.
2. `claude plugin validate .` (if run) exits `0` — the plugin manifest is structurally valid.
3. Claude Code loads the plugin's `agents/*.md` (13 agents) and `skills/*/SKILL.md` (5 skills).
4. `/agents` lists all 13 harness agents, resolving to the plugin.
5. Skills are invocable directly (bare or namespaced — see UC-11) and each agent resolves and runs correctly when invoked.
6. `~/.claude/claude.md` and `~/.claude/rules/*.md` do not exist (or belong to something unrelated) — the mandatory autonomous-pipeline instruction that `src/claude.md` carries is never injected as user memory into any session.
7. Per FR-3.4, this is a documented, expected outcome, not a defect: `README.md` states explicitly that plugin-only installation is insufficient on its own and that `bash install.sh` remains required for the memory layer.

**Postconditions**:
- Plugin functionality is fully usable (13 agents resolve, 5 skills are directly invocable)
- `~/.claude/claude.md` and `~/.claude/rules/*.md` remain absent
- `README.md`'s install instructions explain this exact state and how to complete the migration

### Alternative Flows
- **UC-9-A1: Developer subsequently runs `bash install.sh`** to complete the migration — `~/.claude/claude.md` and `~/.claude/rules/*.md` are installed, closing the gap; the machine now matches UC-1/UC-2's postconditions.
- **UC-9-A2: Entry-point preflight (FR-8) passes silently when the memory layer is present** — the normal, fully-migrated case, not this UC's own precondition
  1. `bash install.sh` has also been run on this machine (UC-1 or UC-2's postconditions hold): `~/.claude/claude.md` exists and contains the harness's autonomous-pipeline instruction
  2. Developer invokes `/develop-feature <description>` or `/bootstrap-feature <description>` directly
  3. The skill's preflight step (FR-8) checks that `~/.claude/claude.md` exists and contains the pipeline instruction — both checks pass
  4. The preflight emits no message of any kind; the skill proceeds directly into its normal behavior with no observable delay or output attributable to the check
  5. This is the expected outcome on the vast majority of correctly-migrated machines

### Error Flows
- **UC-9-E1: Silent half-migration (must be caught explicitly)** — the developer treats `claude plugin validate .` exiting `0` and `/agents` resolving all 13 agents as proof the migration is complete, without separately checking for `~/.claude/claude.md` or `~/.claude/rules/*.md`. No step in `claude plugin validate`, `/plugin install`, or `/agents` surfaces any warning that the memory layer is missing — all three report success. The developer begins working and issues an unprefixed feature request expecting the pipeline to auto-trigger per the mandatory-workflow instruction; nothing in the current session's system prompt contains that instruction, because it was never loaded from `~/.claude/claude.md`. Claude does not automatically invoke `/bootstrap-feature`. Manually invoking a skill still works — only the *automatic* trigger on unprefixed requests is gone — so the regression can go unnoticed for an extended period. **Observable fingerprint**: `~/.claude/claude.md` is absent (or does not contain the harness's autonomous-pipeline instruction) while `claude plugin validate .` exits `0` and `/agents` shows all 13 agents resolved. **Recovery**: run `bash install.sh`.
- **UC-9-E2: Entry-point preflight (FR-8) warns and continues when `~/.claude/claude.md` is absent — the loud-failure mitigation for UC-9-E1**
  1. This UC's precondition holds: plugin-only install, `~/.claude/claude.md` absent
  2. Developer explicitly invokes `/develop-feature <description>` or `/bootstrap-feature <description>` (not an unprefixed natural-language request — see UC-9-EC3 for that case)
  3. The skill's preflight step (FR-8) checks for `~/.claude/claude.md` — not found
  4. The skill emits a visible warning naming `bash install.sh` as the fix, e.g.: "Warning: ~/.claude/claude.md not found — the harness's autonomous-pipeline instruction is not loaded. Run `bash install.sh` to install it."
  5. The skill does **not** block on this warning — it continues executing its normal behavior immediately afterward, per the autonomy contract's rule that no new gate may dead-end an unattended run
  6. **Observable outcome**: the warning text is present in the skill's output; the skill's pipeline behavior proceeds unchanged and is not gated on any developer acknowledgment; the exit code of the underlying operation is unaffected by the warning
- **UC-9-E3: Entry-point preflight (FR-8) warns when `~/.claude/claude.md` exists but does not carry the pipeline instruction**
  1. `~/.claude/claude.md` exists on disk (a file-presence-only check would pass), but its content is the developer's own unrelated memory file, an old pre-instruction version, or was manually edited to remove the instruction
  2. Developer explicitly invokes `/develop-feature` or `/bootstrap-feature`
  3. The skill's preflight step checks not merely for the file's existence but for the pipeline instruction's presence within it (e.g., a marker string or heading that the harness's `src/claude.md` always contains)
  4. The marker is not found in the file's content
  5. The skill emits the same visible warning as UC-9-E2, naming `bash install.sh` as the fix — file presence alone does not satisfy the preflight
  6. The skill continues without blocking, identical in effect to UC-9-E2

### Edge Cases
- **UC-9-EC1**: The developer has an unrelated `~/.claude/claude.md` from a different project or tool (not this harness). Plugin-only install does not touch or overwrite it (FR-3 confines `claude.md` installation to `install.sh`); the pre-existing file is unaffected and does not contain the harness's pipeline instruction, so the half-migration symptom is present but for a different underlying reason (never installed, not overwritten). This is also a concrete instance of UC-9-E3's preflight warning, since the file exists but lacks the marker.
- **UC-9-EC2**: The developer runs `/plugin install` on a machine that has a *legacy* v3.1 install (memory layer already present from before). In this case the memory layer is not absent — it is stale (pre-v4.0). This is a different scenario covered by UC-2 (upgrade) and UC-8 (shadowing), not this half-migration case, which specifically requires no memory layer at all.
- **UC-9-EC3: Known residual gap — the preflight only fires on explicit skill invocation**
  1. The developer never types `/develop-feature` or `/bootstrap-feature` explicitly; instead they issue an unprefixed natural-language feature request, expecting the memory-layer instruction to auto-trigger the pipeline — this is exactly the UC-9-E1 failure mode
  2. Because `~/.claude/claude.md` is absent, there is no memory-layer instruction to auto-trigger anything, and no skill was explicitly invoked — the FR-8 preflight check inside `skills/develop-feature/SKILL.md` never runs, because that file was never loaded
  3. This is a known, explicitly documented limitation, not a defect of this feature: FR-8's preflight protects only the explicit-invocation path. The residual gap for unprefixed natural-language requests remains open after this feature ships and is closed by a later roadmap feature's session-start check (F2a), not by FR-8
  4. Until that later feature ships, the only mitigation for the unprefixed-request case is the manual `/agents`-plus-`claude.md`-presence verification already covered in UC-9-E1 — there is no automatic warning for this specific path

### Data Requirements
- **Input**: Plugin installation state; presence or absence of `~/.claude/claude.md` and `~/.claude/rules/*`; for FR-8, the content of `~/.claude/claude.md` (existence and marker presence) at the moment `develop-feature` or `bootstrap-feature` is invoked
- **Output**: A machine state where agents/skills work but the mandatory pipeline instruction is not ambiently loaded; for FR-8, either no preflight message (marker present) or a visible, non-blocking warning naming `bash install.sh` (marker absent or file absent)
- **Side Effects**: None to any file `install.sh` would have touched — plugin installation does not write to `~/.claude/claude.md` or `~/.claude/rules/`; the FR-8 preflight check is read-only and never blocks or modifies anything

---

## UC-10: `install.sh`-Only Install — No Plugin Ever Installed

**Actor**: Adopting Developer who runs only `bash install.sh` and never installs the plugin
**Preconditions**: The machine has no prior plugin installation of this harness

**Trigger**: `bash install.sh` is run in isolation; the developer never runs `/plugin marketplace add` or `/plugin install`

### Primary Flow (Happy Path — Full Functionality Retained)
1. `install.sh` copies the 13 agent files into `~/.claude/agents/*.md`, `src/claude.md` into `~/.claude/claude.md`, and each `src/rules/*.md` into `~/.claude/rules/*.md` — the same set it always writes, per NFR-2.
2. No plugin skills are registered anywhere on this machine — `/develop-feature` typed as a literal slash command is not a recognized, plugin-registered skill.
3. The developer describes a feature request in plain language (an unprefixed request), rather than typing a slash command.
4. `~/.claude/claude.md`'s mandatory-workflow instruction, loaded as user memory, directs Claude to run the full documentation-and-implementation pipeline for any feature request; Claude invokes the relevant agents (via subagent/Task-tool invocation, which does not require a registered slash command) in the documented order.
5. The pipeline completes to merge-ready using only the 13 agents plus the memory-layer instruction — no plugin skill was ever invoked.

**Postconditions**:
- `~/.claude/agents/` contains the 13 harness agents; `~/.claude/claude.md` and `~/.claude/rules/*.md` are present and loaded
- The full autonomous pipeline is functional via natural-language requests, per NFR-2's "full pipeline functionality" guarantee
- No plugin-registered skill exists on this machine

### Alternative Flows
- **UC-10-A1: Developer later installs the plugin as well** — this transitions the machine to the fully-migrated state (agents + memory + skills all present); see UC-2/UC-8 for what happens if the newly-installed plugin's agents are shadowed by the pre-existing `~/.claude/agents/` copies.

### Error Flows
- **UC-10-E1: Developer types a literal slash command that only exists as a plugin skill** (e.g., types `/develop-feature` expecting it to behave as a registered command) — since no plugin is installed, Claude Code does not recognize it as a formal registered command. The developer must either describe the feature in natural language (triggering the memory-layer instruction per the primary flow) or install the plugin to get literal slash-command registration. This distinction — and the fact that install.sh-only usage still works via natural-language requests — must be documented so the developer does not conclude the harness is broken.

### Edge Cases
- **UC-10-EC1**: The developer's `~/.claude/agents/` directory already has 3 personal agents from before (the same reference-machine scenario as UC-3). `install.sh`-only usage never touches them, exactly as in every other install path.
- **UC-10-EC2**: The developer runs `bash install.sh --uninstall` on this install.sh-only setup. All 13 agent files, `claude.md`, and the 5 rule files are removed (per UC-5); the machine reverts to having no harness functionality at all, with no plugin remnants to clean up since none was ever installed.

### Data Requirements
- **Input**: Repo checkout contents; developer's natural-language feature description
- **Output**: A fully functional pipeline invoked without any plugin skill
- **Side Effects**: Identical filesystem side effects to UC-1/UC-2; no plugin-related state exists

---

## UC-11: Skill Invocation — Bare Name, Namespaced Name, and Collision

**Actor**: Adopting Developer (or Harness Maintainer) invoking a skill inside Claude Code
**Preconditions**: The plugin is installed and provides the skill `develop-feature` (from `skills/develop-feature/SKILL.md`), among the other 4 skills

**Trigger**: Developer types a slash command inside a Claude Code session

### Primary Flow (Bare Name, No Collision)
1. Developer types `/develop-feature <feature description>`.
2. No other installed plugin defines a skill literally named `develop-feature`.
3. Claude Code resolves the bare name unambiguously to this plugin's skill.
4. The skill's `$ARGUMENTS` handling captures `<feature description>` per FR-2.4.
5. The pipeline begins as documented.

**Postconditions**: The skill runs with the correct arguments; the invocation is indistinguishable in effect from a namespaced invocation.

### Alternative Flows
- **UC-11-A1: Namespaced invocation**
  1. Developer types `/<plugin-name>:develop-feature <feature description>` explicitly.
  2. Claude Code resolves directly to this plugin's skill regardless of any other installed plugin, since the namespace disambiguates.
  3. Behavior after resolution is identical to the bare-name invocation.
- **UC-11-A2: Documentation shows both forms**
  1. Per FR-7.1, README, use-case, and QA documentation show both `/develop-feature` and `/<plugin-name>:develop-feature`, with a note that bare-name resolution only succeeds absent a collision.

### Error Flows
- **UC-11-E1: Bare-name collision with another installed plugin**
  1. A second, unrelated installed plugin also defines a skill literally named `develop-feature`.
  2. Developer types the bare `/develop-feature`.
  3. Bare-name resolution is ambiguous — Claude Code cannot deterministically resolve which plugin's skill is intended (or resolves to whichever plugin's skill takes precedence, which is not guaranteed to be this harness's).
  4. The developer's request does not reliably invoke this harness's `develop-feature` skill.
  5. The developer must use the namespaced form `/<plugin-name>:develop-feature` to guarantee resolution to this harness's skill.
  6. Documentation produced under FR-7.1 must already have told the developer this could happen and provided the namespaced escape hatch — this is why AC-4's sweep requires both forms to be documented, not just the bare form.

### Edge Cases
- **UC-11-EC1**: This harness's own 5 skill names never collide with each other (`bootstrap-feature`, `develop-feature`, `implement-slice`, `merge-ready`, `context-refresh` are all distinct) — internal collision is not a concern.
- **UC-11-EC2**: The plugin's own name contains characters that must be reproduced exactly in the namespaced form (e.g., a plugin named `claude-code-sdlc` yields `/claude-code-sdlc:develop-feature`).
- **UC-11-EC3**: The developer later uninstalls the colliding plugin. Bare-name resolution becomes unambiguous again automatically, with no change required to this harness.

### Data Requirements
- **Input**: The typed command string; the set of currently installed plugins and their skill names
- **Output**: A resolved skill invocation, or an ambiguous-resolution outcome
- **Side Effects**: None beyond triggering the pipeline once resolved

---

## UC-12: Harness CI Validates Shipped Assets

**Actor**: CI (GitHub Actions runner), triggered on push/PR; Harness Maintainer authoring a PR
**Preconditions**: `.github/workflows/ci.yml` exists and runs the validators in `scripts/ci/*.js`; each validator has a corresponding, deliberately seeded bad-fixture test asset checked into the test scaffolding

**Trigger**: A push or pull-request event against the repository

### Primary Flow (All Validators Pass on HEAD)
1. CI checks out the repository at `HEAD`.
2. CI asserts the Node runtime meets the minimum version before running any validator (see UC-14).
3. `validate-agents.js` runs against `agents/*.md` — for each of the 13 files, the `name` field matches the filename, all required fields (`name`, `description`, `tools`, `model`) are present, and `tools` lists only valid tool names. Exits `0`.
4. `validate-skills.js` runs against `skills/*/SKILL.md` — for each of the 5 files, `description`, `argument-hint`, `arguments`, and `allowed-tools` are present. Exits `0`.
5. `validate-hooks.js` runs against `hooks/hooks.json`, if present. Since this feature ships no hooks yet, the validator either finds no file (passes trivially, forward-looking for F2) or validates an empty/absent-hooks case. Exits `0`.
6. `validate-personal-paths.js` scans every shipped file for `/Users/...` (or equivalent absolute personal paths) — none found. Exits `0`.
7. `validate-unicode-safety.js` scans `agents/*.md`, `skills/*/SKILL.md`, `src/claude.md`, and `src/rules/*.md` for zero-width characters and homoglyph substitutions — none found. Exits `0`.
8. `validate-version-consistency.js` compares the version string in `README.md`, `install.sh`, and `.claude-plugin/plugin.json` — all identical. Exits `0`.
9. All validators report success; the CI job as a whole exits `0`; the PR shows a green check.

**Postconditions**: CI status is green; every validator individually exited `0`.

### Alternative Flows (Per-Validator Seeded-Bad-Fixture Failure — Falsifiability, FR-5.8/AC-2)
- **UC-12-A1**: `validate-agents.js` run against a seeded bad fixture (e.g., an `agents/`-shaped test file whose `name:` field doesn't match its filename, or missing `tools:`) exits non-zero, naming the file and the violated rule. The fixture is checked into test scaffolding, run separately from the HEAD scan, and does not affect the real `agents/*.md` files.
- **UC-12-A2**: `validate-skills.js` run against a fixture `SKILL.md` missing `argument-hint` exits non-zero, naming the missing field.
- **UC-12-A3**: `validate-hooks.js` run against a fixture `hooks.json` with malformed JSON or a schema violation (e.g., an entry missing `event` or `command`) exits non-zero.
- **UC-12-A4**: `validate-personal-paths.js` run against a fixture file containing a literal `/Users/someone/project` string exits non-zero, reporting the file and the matched path.
- **UC-12-A5**: `validate-unicode-safety.js` run against a fixture file containing a zero-width space (`U+200B`) or a homoglyph-substituted character (e.g., Cyrillic "а" in place of Latin "a") in a prompt string exits non-zero, reporting the file, character position, and codepoint.
- **UC-12-A6**: `validate-version-consistency.js` run against a fixture set where `install.sh`'s `VERSION` differs from `README.md`'s badge exits non-zero, reporting the specific mismatched values.

### Error Flows
- **UC-12-E1: A validator never actually fails on its own seeded bad fixture** (the fixture is broken, or the validator has a bug that makes it pass unconditionally) — this is the exact falsifiability failure the PRD calls out. The bad-fixture check MUST itself run as a CI step (not a manual, occasional check), so a validator that stops being falsifiable fails CI immediately, blocking merge.
- **UC-12-E2: A validator throws an uncaught exception** instead of exiting non-zero cleanly (e.g., a null-pointer-style crash) on either HEAD or the bad fixture — CI still fails (an uncaught exception's exit code is also non-zero), but the failure output is a stack trace rather than a structured error message. This still correctly blocks CI, but QA test cases must assert a clean, readable error message is produced, not merely a non-zero exit code.
- **UC-12-E3: CI runs on a runner where Node is missing or below the minimum version** — see UC-14; the whole CI job fails loudly at the version-assert step before any validator runs, rather than each validator failing independently with confusing syntax errors.

### Edge Cases
- **UC-12-EC1**: A 14th agent file is added later without updating `validate-agents.js`'s expectations. The validator does not hardcode a count of 13; it validates whatever files exist under `agents/*.md` generically, so it continues to work correctly as the asset count changes.
- **UC-12-EC2**: `validate-hooks.js` runs in this feature with zero hooks shipped — it must still "pass trivially" against the real (absent) `hooks/hooks.json`, and it must still fail against a malformed `hooks.json` fixture even though no real file exists yet, proving the validator has real parsing logic rather than being a stub that always passes because it never parses anything.
- **UC-12-EC3**: The personal-path validator's pattern could false-positive on a legitimate placeholder example in documentation (e.g., `/Users/yourname/project` used intentionally as an example path). The validator needs an explicit allowlist/placeholder convention to distinguish documented examples from an actual accidental leak — otherwise CI would be permanently red on legitimate docs. QA test cases must probe this distinction explicitly.

### Data Requirements
- **Input**: Repository file tree at `HEAD`; seeded bad fixtures per validator; the Node runtime
- **Output**: Per-validator exit code (`0` or non-zero) and structured error messages naming file/line/violation
- **Side Effects**: None to the repository — CI is read-only against the checked-out tree; fixture files are part of test scaffolding, not shipped assets

---

## UC-13: Version-String Reconciliation Across README, install.sh, and plugin.json

**Actor**: Harness Maintainer (implementing FR-6.1); CI's `validate-version-consistency.js`
**Preconditions**: `README.md`'s badge currently reads `3.1.0`; `install.sh`'s `VERSION` variable currently reads `"2.1.0"`; `.claude-plugin/plugin.json` is newly created with some initial version value (per FR-1.1)

**Trigger**: The FR-6.1 implementation slice runs, or `validate-version-consistency.js` runs afterward in CI

### Primary Flow (Happy Path)
1. The Harness Maintainer picks a single new version value (e.g., `4.0.0`) for the release.
2. `README.md`'s badge is updated to that value.
3. `install.sh`'s `VERSION` variable is updated to that value.
4. `.claude-plugin/plugin.json`'s `version` field is set to that value.
5. `validate-version-consistency.js` confirms all three strings are identical and exits `0`.
6. `grep -c "VERSION=" install.sh` and the `plugin.json`/`README.md` values are cross-checked per AC-6, confirming a single, identical version value everywhere.

**Postconditions**: All three version strings are identical; CI's version-consistency check is green.

### Alternative Flows
- **UC-13-A1: A future release bumps the version again** — the same three files are updated together in the same commit/slice, never independently, so the invariant established here is never broken by a subsequent release.

### Error Flows
- **UC-13-E1: A future PR updates only `README.md`'s badge** (e.g., an unrelated docs-only edit) without updating `install.sh`/`plugin.json` — `validate-version-consistency.js` fails CI, naming the mismatched file(s) and value(s), blocking merge until reconciled.
- **UC-13-E2: `install.sh`'s `VERSION` variable is defined in a format the validator's parser does not expect** (e.g., unusual quoting, a multiline assignment) — the validator must fail loudly with a parse error rather than silently treating an unparseable value as a false match.

### Edge Cases
- **UC-13-EC1**: A pre-release or suffixed version (e.g., `4.0.0-rc1`) is used. The validator performs exact string equality across all three sources, so any suffix must be applied consistently everywhere or the check fails — this strictness is intentional.

### Data Requirements
- **Input**: Version strings extracted from the 3 files
- **Output**: Pass/fail plus which file(s) diverge
- **Side Effects**: None from the validator (read-only check); the maintainer's edit is the only file mutation, performed manually during implementation, not by the validator

---

## UC-14: Node Missing or Below the Minimum Version

**Actor**: CI runner, or a Harness Maintainer's local machine running a validator directly
**Preconditions**: `scripts/ci/*.js` and the shared wrapper module assert a minimum Node version at entry (NFR-1)

**Trigger**: A validator script (or the shared wrapper) is invoked in an environment where `node` is not on `PATH`, or where the installed Node version is below the asserted minimum

### Primary Flow (Node Present and Sufficient)
1. A validator script starts.
2. The shared wrapper module checks `process.version` against the minimum required version.
3. The installed version meets or exceeds the minimum.
4. Execution proceeds into the validator's actual checks.

**Postconditions**: The validator runs normally; no version-related message is printed.

### Alternative Flows
- **UC-14-A1: Node exceeds the minimum by a wide margin** (e.g., a much newer LTS) — the check passes identically; the assertion is a floor, not an exact-match requirement.

### Error Flows
- **UC-14-E1: Node is present but below the minimum version**
  1. A validator script starts on a runner or local machine with an older Node install.
  2. The shared wrapper module's version check detects `process.version` is below the asserted minimum.
  3. The wrapper fails loudly: it prints a clear message naming the required minimum and the detected version, then exits non-zero immediately — before attempting any parsing logic that might otherwise fail with a confusing syntax error from a newer JS feature.
  4. CI reports the job as failed with this specific, readable message, not a cryptic `SyntaxError: Unexpected token`.
- **UC-14-E2: Node is missing entirely**
  1. The CI workflow step (or a maintainer's local shell) attempts to invoke `node scripts/ci/validate-agents.js` (or similar).
  2. `node` is not found on `PATH` — the shell reports "command not found" (exit code 127) before the wrapper's own version-check code can run at all.
  3. The CI job fails at the invocation step, not inside the script.
  4. This is why `.github/workflows/ci.yml` MUST also declare a Node toolchain setup step of its own, independent of the wrapper's runtime check — the wrapper only protects against a too-old Node, not an absent one; the workflow's setup step is what guarantees presence.

### Edge Cases
- **UC-14-EC1**: A maintainer's local machine uses a Node version manager (e.g., `nvm`) with multiple installed versions, and a stray shell alias or a fixed-path binary (e.g., `/usr/local/bin/node`) shadows the version-manager-selected Node. The wrapper's version check still catches an insufficient version locally the same way it would in CI — it checks whichever `node` binary actually executed it, regardless of why that binary was selected.
- **UC-14-EC2**: A validator is added later without importing the shared wrapper (bypassing the version check). Per NFR-1's "all CI validators share one common wrapper module" requirement, this is a defect — the QA test cases for this feature must check by grepping each validator file for the wrapper import, so a new validator skipping the shared check is caught rather than silently allowed.

### Data Requirements
- **Input**: `process.version` (or the absence of Node entirely); the asserted minimum version constant, defined once in the shared wrapper
- **Output**: Pass-through execution, or a loud, readable failure message and a non-zero exit code
- **Side Effects**: None — this is a pure runtime guard; no files are modified
