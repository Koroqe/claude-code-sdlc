# Use Cases: Auto-Release Pipeline — Executing-Mode Tagging, Cross-Platform Prebuilt Binaries, and Pre-Push Hooks

> Based on [PRD](../PRD.md) — Section 13: Auto-Release Pipeline

This document is the blueprint for E2E and integration testing of the iter-3 auto-release feature introduced in PRD Section 13. The feature flips the `release-engineer` agent from suggest-only to executing-mode under a four-tier authority gradation lifted from `resource-architect.md:185-260`, expands the `sdlc-knowledge` cross-platform binary matrix from four to five platforms (adding `windows-x64`), bootstraps the FIRST `sdlc-knowledge-v0.2.0` GitHub release (closing the iter-1 chicken-and-egg gap), fixes the `install.sh` `Koroqe → codefather-labs` `REPO_URL` bug, and dogfoods Section 3 by opting the SDLC core repo INTO the changelog feature it has been shipping to downstream projects since iter-1. There is NO new agent, NO new gate, and the 17-agent / 10-gate / 5-executor invariants are PRESERVED per FR-12.

Every use case below is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`, `UC-CC-N`) are referenced by QA test cases and E2E tests.

**Common preconditions across all use cases** (stated once here, referenced as "common preconditions" below):

- The iter-1 (§11) and iter-2 (§12) features have shipped — the `sdlc-knowledge` Rust binary at `tools/sdlc-knowledge/` builds clean, the FTS5 + WAL schema is live, the `pdfium-render` integration ships at crate version `0.2.0` per §12 NFR-9
- The four iter-1/iter-2 platforms (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`) are operational; iter-3 ADDS `windows-x64` as the fifth platform per FR-3
- The `release-engineer` agent prompt at `src/agents/release-engineer.md` is REWRITTEN per FR-1.1 through FR-1.8: frontmatter `tools:` includes `Bash`, the `## NEVER List` is shrunk to FR-1.2 Forbidden-tier rows only, the `## Tier-Based Authority Gradation` section codifies the FR-1.2 12-row table, the FR-1.3 anchored-regex whitelist, the FR-1.4 headless contract, and the FR-1.5 prompt format
- The 12-row tier table from FR-1.2 maps each release operation to exactly one of `Trivial | Moderate | Sensitive | Forbidden` per the most-restrictive-applicable-tier rule lifted verbatim from `resource-architect.md:222`
- The eight-entry FR-1.3 anchored-regex whitelist is hardcoded in `release-engineer.md` and gates every `Bash` invocation; commands containing shell metacharacters (`;`, `&&`, `||`, `|`, backtick, `$(`, `>`, `<`) are REFUSED unconditionally
- The activation sentinel that gates the entire executing-mode behavior is the file `<project>/.claude/rules/auto-release.md` per FR-7.3 / FR-9.4; absence equals byte-identical opt-out per NFR-3 / AC-8
- The headless contract (`AUTO_RELEASE=1`) is layered on top of the opt-in sentinel: BOTH must be present for headless executing-mode per FR-9.4. `AUTO_RELEASE=1` REFUSES Sensitive-tier operations with literal stderr `aborted-headless-sensitive: <operation> requires interactive approval; rerun without AUTO_RELEASE=1` and exits 0 (NOT 1; headless skip is not an error per FR-1.4)
- The interactive Sensitive-tier prompt format is byte-stable per FR-1.5 with five literal lines (`[Sensitive — release-engineer] About to execute: <verbatim-command>` / `Tier rationale: ...` / `Reversibility: ...` / `Approve? [y/N]:`) anchored for Plan Critic grep; only the literal lowercase `y` followed by newline is treated as APPROVE, anything else is DENY
- The release-notes file pipeline writes `.claude/release-notes-<X.Y.Z>.md` containing the body of the freshly renamed `[X.Y.Z]` CHANGELOG section verbatim (category subheadings + entries; NOT the `[X.Y.Z] - YYYY-MM-DD` heading itself) per FR-2.1; the same file is consumed by `git tag -a -F <file>` per FR-2.2 AND by `softprops/action-gh-release@v2` `body_path:` per FR-2.3, producing byte-identical content across CHANGELOG → tag annotation → GitHub Release page
- The `softprops/action-gh-release@v2` action is pinned by major-version `@v2` per `sdlc-knowledge-release.yml:202` (BYTE-UNCHANGED in iter-3 per R-10 mitigation)
- Both workflow files (`.github/workflows/sdlc-knowledge-release.yml` and the new `.github/workflows/sdlc-core-release.yml` per FR-11.2) MUST set `body_path: .claude/release-notes-<X.Y.Z>.md` per FR-2.3 so the GitHub Release body matches the tag annotation byte-for-byte
- The dual-tag scheme is enforced by GitHub Actions tag-filter glob semantics: `sdlc-knowledge-v*` (tool train) and `v*` (SDLC core train) fire DISJOINT workflows per FR-11.4 — a `sdlc-knowledge-v0.2.0` push fires ONLY the `sdlc-knowledge-release.yml` workflow; the prefix is not `v` so the `v*` filter does not match
- The two workflows have DIFFERENT `concurrency:` groups (`sdlc-knowledge-release-${{ github.ref }}` vs `sdlc-core-release-${{ github.ref }}`) per FR-11.3 so a tool release and a core release in the same time window do not cancel each other
- `install.sh:25` `REPO_URL` is updated from `https://github.com/Koroqe/claude-code-sdlc.git` to `https://github.com/codefather-labs/claude-code-sdlc.git` per FR-5.1; `install.sh:12` Quick-install URL is updated in lock-step per FR-5.2; `grep -r 'Koroqe' .` returns ZERO matches per FR-5.3 / AC-9
- `install.sh:22` `VERSION="2.1.0"` is updated to `VERSION="3.0.0"` per FR-7.5 reflecting the MAJOR bump triggered by the executing-mode authority-boundary change per NFR-9
- The `install.sh` prebuilt-binary download path at lines 332-406 is the PRIMARY path once the FIRST `sdlc-knowledge-v0.2.0` tag exists (FR-6) and the `REPO_URL` fix ships (FR-5); the `cargo_source_build_fallback` at line 411 is PRESERVED byte-for-byte as the secondary path per FR-4.4 and is invoked when (a) the prebuilt-binary download fails, (b) the host platform is not in the FR-4.1 five-platform allowlist, or (c) the `--version` smoke-test fails on the downloaded binary
- The five-platform `case "$(uname -ms)"` allowlist at `install.sh:354-363` gains the fifth Windows branch per FR-4.1: `"MINGW64_NT-* x86_64") platform="windows-x64" ;;`; the four existing branches are BYTE-UNCHANGED
- For the Windows branch only, the asset URL appends `.exe` to the platform suffix per FR-4.3: `sdlc-knowledge-windows-x64.exe`; the four existing platforms append nothing
- The `.github/workflows/sdlc-knowledge-release.yml` matrix `include:` list at lines 64-75 gains the fifth entry `platform: windows-x64`, `runs-on: windows-latest`, `target: x86_64-pc-windows-msvc` per FR-3.1; the four existing entries are BYTE-UNCHANGED
- The `Determine pdfium asset name` step at `sdlc-knowledge-release.yml:91-101` gains a fifth case branch `windows-x64) echo "asset=pdfium-win-x64.tgz" >> "$GITHUB_OUTPUT" ;;` per FR-3.2 (assumption; see Open Question #2)
- The `Download pdfium dynamic library` step at `sdlc-knowledge-release.yml:103-116` widens the `find -name 'libpdfium*'` glob per FR-3.3 to capture both `libpdfium*` (macOS/Linux) and `pdfium*.dll` (Windows) naming conventions
- The Windows binary stages at `dist/sdlc-knowledge-windows-x64/sdlc-knowledge-windows-x64.exe` per FR-3.5 (note the `.exe` suffix); the release job's `files:` list at `sdlc-knowledge-release.yml:208-213` gains a fifth line per FR-3.6 plus a sixth line for the source tarball per FR-3.7
- The source tarball asset `sdlc-knowledge-source-<X.Y.Z>.tar.gz` is produced by `git archive --format=tar.gz --prefix=sdlc-knowledge-<X.Y.Z>/ -o dist/sdlc-knowledge-source-<X.Y.Z>.tar.gz HEAD` per FR-3.7 so users on platforms not in the matrix (FreeBSD, musl-libc Alpine, linux-arm32) can build from source via `cargo install --path .` after extraction
- The `bootstrap_first_release` install.sh function (FR-6) is invoked ONLY when `--bootstrap-release <X.Y.Z>` is passed as a CLI flag — NOT on a normal install — and verifies pre-conditions: (a) repo-root heuristic (`Cargo.toml` at `tools/sdlc-knowledge/Cargo.toml` AND `.git` at repo root); (b) clean working tree (`git status --porcelain` empty); (c) version match between flag and `tools/sdlc-knowledge/Cargo.toml:3`
- The bootstrap function emits the literal warning `[BOOTSTRAP] this is a one-time first-release operation; subsequent releases use /merge-ready Gate 9 with release-engineer in executing mode (FR-1)` to stderr per FR-6.4 before executing the tag/push
- The bootstrap function gates the push behind the literal prompt `[BOOTSTRAP] About to execute: git push origin sdlc-knowledge-v<X.Y.Z> — this fires the GH Actions release workflow at .github/workflows/sdlc-knowledge-release.yml. Approve? [y/N]:` per FR-6.5; only literal lowercase `y` + newline is APPROVE
- The SDLC core repo opts INTO the changelog feature: `.claude/rules/changelog.md` is created byte-identical to `templates/rules/changelog.md` per FR-7.1; `.claude/rules/auto-release.md` is created codifying FR-1.2 / FR-1.3 / FR-1.4 / FR-1.5 per FR-7.2; `templates/rules/auto-release.md` is created byte-identical to `.claude/rules/auto-release.md` per FR-7.3 (the dogfood ship-to-downstream artifact)
- A new `CHANGELOG.md` is created at the SDLC core repo root with `## [Unreleased]` (empty) and `## [3.0.0] - 2026-04-26 — Auto-Release Pipeline` per FR-7.4 / AC-10
- The pre-push validation function `pre_push_validate` (FR-8) runs IMMEDIATELY before any FR-1.2 row 7 / row 8 (`git push origin <branch>` / `git push origin <tag>`) execution, invokes the project's typecheck + test + lint commands per `./CLAUDE.md` `## Commands` block (same conventions as `build-runner` Gate 6), and ABORTS the push on validation failure per FR-8.2 (Sensitive-tier deny semantics; the local CHANGELOG / release-notes / annotated-tag artifacts already created in earlier FR-1.2 rows are PRESERVED so the developer can fix the validation failure and re-run `/merge-ready`)
- Pre-push validation is OPTIONAL for the SDLC core repo itself (no `## Commands` block in the SDLC repo's `./CLAUDE.md`) and is SKIPPED with the literal log line `pre-push validation skipped: no Commands block in ./CLAUDE.md` per FR-8.3; pre-push validation MUST NOT make network calls or run E2E tests per FR-8.4
- The `register_release_bash_allowlist` install.sh function adds the FR-10.1 eight glob entries (matching the FR-1.3 anchored regexes verbatim under Claude Code's allowlist `*` glob syntax) to `~/.claude/settings.json` via the same `jq`-atomic-merge / `unique`-deduplication / fail-closed-when-`jq`-absent shape as `register_bash_allowlist` per FR-10.3; idempotent on re-run
- The 17-agent count, 10-gate count, 5-executor count, and README taglines (lines 5 and 35) are BYTE-UNCHANGED per FR-12.1 / FR-12.2 / FR-12.3 / FR-12.4 / AC-13. The `templates/` invariant relaxation per FR-12.5 is INTENTIONAL: `templates/rules/auto-release.md` and `templates/hooks/pre-push` are NEW files that ship the auto-release feature to downstream projects via `install.sh --init-project`
- The cognitive-self-check rule (`src/rules/cognitive-self-check.md`) is BYTE-UNCHANGED per FR-12.6; the `release-engineer` agent remains in the 12-thinking in-scope list and continues to emit `## Facts` blocks per Section 9
- All §11 / §12 invariants from FR-12.7 remain in force: the five `sdlc-knowledge` subcommands, the `--project-root` security gate, the JSON output shape, the `knowledge-base:` citation literal, the FTS5 + WAL schema, the `## Knowledge Base (when present)` activation block in 12 thinking agents

## Actors

| Actor | Description |
|-------|-------------|
| Maintainer | The owner of `codefather-labs/claude-code-sdlc` who cuts the FIRST `sdlc-knowledge-v0.2.0` tag via `bash install.sh --bootstrap-release 0.2.0` (one-shot) per FR-6 AND the FIRST SDLC-core `v3.0.0` tag via `/merge-ready` Gate 9 with `.claude/rules/auto-release.md` opted-in per FR-7. The Maintainer is the actor who APPROVES Sensitive-tier prompts in interactive mode |
| Downstream Developer | The end user of the SDLC pipeline who runs `/merge-ready` on their feature branch in their own project; sees Gate 9 release-engineer in executing-mode IFF their project has `.claude/rules/auto-release.md` opted-in per FR-7.3 / FR-9.4 |
| `install.sh` user | A human invoking `bash install.sh --yes` on their host machine; benefits from the FR-4 prebuilt-binary primary path on the five supported platforms; falls back to `cargo_source_build_fallback` per FR-4.4 on unsupported platforms or network failure |
| CI bot | A non-interactive runner (GitHub Actions, GitLab CI, Jenkins) that invokes `/merge-ready` with `AUTO_RELEASE=1` set per FR-1.4 / FR-9.1; auto-executes Trivial + Moderate, refuses Sensitive with `aborted-headless-sensitive` exit-0 skip semantics |
| `release-engineer` agent | The agent at `src/agents/release-engineer.md` invoked at `/merge-ready` Gate 9. After this section ships, the agent operates in executing-mode (Bash tool available; tier dispatch + anchored-regex whitelist + headless contract) when the activation sentinel is present per FR-9.4; falls back to byte-identical §6 suggest-only behavior when the sentinel is absent per NFR-3 / AC-8 |
| GitHub Actions runner | One of `macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`, `windows-latest` per the FR-3.1 five-platform matrix. The `windows-latest` runner is NEW in iter-3 and preinstalls Visual Studio 2022 Build Tools (`cl.exe`), Git for Windows (`git`, `bash`, `curl`, `tar`, `find`), and the MSVC toolchain for the `x86_64-pc-windows-msvc` Cargo target (FR-3.4 — verified: no — assumption; see External Contracts) |
| GitHub Releases service | The remote that receives `git push origin <tag>` and triggers `softprops/action-gh-release@v2` to create the Release page with the binary assets and the `body_path:` source-of-truth from `.claude/release-notes-<X.Y.Z>.md` |
| `softprops/action-gh-release@v2` | The community-maintained GitHub Action pinned by major-version `@v2` per `sdlc-knowledge-release.yml:202`; consumes `inputs.tag_name`, `inputs.body_path`, `inputs.files`, `inputs.fail_on_unmatched_files`; produces the Release page with assets and body |

---

## Use Case Coverage

| UC ID | Scenario | PRD FRs | PRD ACs |
|-------|----------|---------|---------|
| UC-1 | Maintainer cuts FIRST `sdlc-knowledge-v0.2.0` release via one-shot `bash install.sh --bootstrap-release 0.2.0` | FR-6.1 through FR-6.5 | AC-2, AC-3, AC-4 |
| UC-1-A1 | Bootstrap re-run when tag already exists at remote | FR-6.2 (clean working tree precondition) | (no direct AC; idempotent abort) |
| UC-1-E1 | Bootstrap pre-condition failure: dirty working tree | FR-6.2 (b) | (no direct AC; clean exit 1) |
| UC-1-E2 | Bootstrap pre-condition failure: version mismatch with `tools/sdlc-knowledge/Cargo.toml:3` | FR-6.2 (c) | (no direct AC; clean exit 1) |
| UC-1-E3 | Bootstrap user declines the FR-6.5 push prompt | FR-6.5 | (no direct AC; preserves local tag, skips push) |
| UC-2 | Maintainer cuts FIRST SDLC core `v3.0.0` tag via `/merge-ready` Gate 9 with `.claude/rules/auto-release.md` opted-in | FR-1.1 through FR-1.8, FR-7.1 through FR-7.6, FR-11.2 | AC-1, AC-10, AC-11 |
| UC-2-A1 | First-run `.claude/rules/auto-release.md` not yet present — release-engineer falls back to suggest-only | FR-7.3, FR-9.4, NFR-3 | AC-8 |
| UC-2-E1 | Pre-push validation fails (typecheck / unit-test exit non-zero) | FR-8.1, FR-8.2 | (no direct AC; preserves local artifacts) |
| UC-3 | Downstream Developer pushes feature branch → `/merge-ready` → Gate 9 executes → tag → push → workflow → GitHub Release auto-created with CHANGELOG body | FR-1.1 through FR-1.8, FR-2.1 through FR-2.4, FR-7.3, FR-8.1 | AC-1, AC-2, AC-3, AC-11 |
| UC-3-A1 | CHANGELOG `[Unreleased]` only has `Removed` entries → version bump = MAJOR (vs default minor) | FR-1.2 (Trivial CHANGELOG rewrite), §6 FR-2 inherited | AC-1 |
| UC-3-A2 | Pre-1.0 override (`Cargo.toml` major=0) → MAJOR bump demoted to MINOR per §6 FR-2.x | FR-1.2 (Moderate version-source bump) | AC-1 |
| UC-3-E1 | `gh` CLI not installed — release-engineer logs warning, falls back to suggest-only | FR-1.4, NFR-3 | AC-8 (graceful degradation) |
| UC-3-E2 | GitHub authentication missing — `git push` fails with auth error → revert local tag + suggest-only | FR-1.2 (Sensitive-tier reversibility), FR-8.2 | (no direct AC; recovery path) |
| UC-3-EC1 | Tag-format collision: project also uses `v*` for non-semver dates — release-engineer detects and refuses | FR-1.3 (anchored-regex whitelist), FR-11.4 | (no direct AC; refusal contract) |
| UC-4 | CI bot runs `/merge-ready` with `AUTO_RELEASE=1` (headless mode) | FR-1.4, FR-9.1 through FR-9.4 | AC-7 |
| UC-4-EC1 | Headless mode invoked when `.claude/rules/auto-release.md` is ABSENT | FR-9.4 | AC-8 |
| UC-5 | `install.sh` on darwin-arm64 downloads prebuilt binary (replaces cargo source-build path) | FR-4.1, FR-4.2, FR-4.6, FR-5.1 | AC-5, AC-9 |
| UC-6 | `install.sh` on linux-x64 downloads prebuilt binary | FR-4.1, FR-4.2, FR-4.6 | AC-5 |
| UC-7 | `install.sh` on linux-arm64 downloads prebuilt binary | FR-4.1, FR-4.2, FR-4.6 | AC-5 |
| UC-8 | `install.sh` on darwin-x64 downloads prebuilt binary | FR-4.1, FR-4.2, FR-4.6 | AC-5 |
| UC-9 | `install.sh` on windows-x64 (NEW iter-3 platform) downloads prebuilt binary | FR-3.1, FR-3.5, FR-3.6, FR-4.1, FR-4.3, FR-4.6 | AC-4, AC-5 |
| UC-9-E1 | `windows-latest` runner timeout (>15 min) — workflow fails; CI matrix marks windows-x64 unavailable | NFR-5 | (no direct AC; budget violation) |
| UC-10 | `install.sh` on unsupported platform (FreeBSD) — falls back to `cargo_source_build_fallback` (preserves iter-1 contract) | FR-4.4 | AC-6 |
| UC-11 | `install.sh` when GH Releases unreachable — falls back to cargo build (network failure graceful degradation) | FR-4.4, R-5 | AC-6 |
| UC-12 | Maintainer fixes `install.sh:25` `REPO_URL` Koroqe → codefather-labs; existing users running OLD install.sh hit 404 + cargo fallback | FR-5.1 through FR-5.5, FR-4.4 | AC-9 |
| UC-13 | Multilingual project: Russian-language CHANGELOG → release-engineer reads Russian section → tag annotation in Russian → GH Release body in Russian (UTF-8 byte-perfect roundtrip) | FR-2.2, FR-2.3, NFR-7 | AC-12 |
| UC-13-E1 | CHANGELOG with mixed languages (some Russian, some English) — release-engineer copies verbatim into release body (no translation, just UTF-8 preservation) | NFR-7 | AC-12 (byte-preservation) |
| UC-14 | Tier-based authority: release-engineer encounters Sensitive `git push origin main` → halts, prompts user, executes only on affirmative `y` | FR-1.2 (row 12), FR-1.4, FR-1.5 | AC-11 |
| UC-14-E1 | User declines Sensitive operation — release-engineer reports `aborted-sensitive` per FR-1.4; preserves local tag but skips push | FR-1.4, FR-1.5 | AC-11 (Sensitive-skipped count) |
| UC-15 | Forbidden tier blocks `npm publish` / `cargo publish` / `gh release create` (out of scope iter-3 — deferred but agent emits clear error pointing to iter-4) | FR-1.2 (rows 9-11), FR-1.7, 13.7 item 1 | AC-11 (Forbidden-refused count) |
| UC-16 | Backward compat: project with NO `.claude/rules/auto-release.md` — release-engineer Gate 9 reports SKIPPED (suggest-only behavior preserved byte-for-byte from §6 / iter-1) | FR-7.3, FR-9.4, NFR-3 | AC-8 |
| UC-17 | Concurrent `/merge-ready` in two repo clones → tag-collision (both compute v3.2.1) → second push fails with "tag already exists"; release-engineer detects via dry-run before pushing | R-6 | (no direct AC; race condition recovery) |
| UC-17-E1 | Tag collision after retry — escalate to user with specific resolution path | R-6 | (no direct AC) |
| UC-CC-1 | Tier-based authority dispatch matches resource-architect iter-2 contract verbatim (4 tiers, anchored regex whitelist, headless contract, most-restrictive-applicable rule) | FR-1.2, FR-1.3, FR-1.4, NFR-4 | AC-11 |
| UC-CC-2 | Multilingual CHANGELOG roundtrip (UTF-8 preserved through CHANGELOG → release-notes → tag annotation → GH Release body, no translation) | FR-2.1, FR-2.2, FR-2.3, NFR-7 | AC-12 |
| UC-CC-3 | Cross-platform install matrix (5 platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, windows-x64; Windows added in iter-3) | FR-3.1 through FR-3.7, FR-4.1, NFR-5 | AC-4, AC-5 |
| UC-CC-4 | Invariants — 17 agents UNCHANGED, 10 gates UNCHANGED, 5 executors UNCHANGED, README taglines UNCHANGED | FR-12.1 through FR-12.4, FR-12.6, FR-12.7 | AC-13 |
| UC-CC-5 | SDLC core dogfooding — `.claude/rules/changelog.md` ADDED, `.claude/rules/auto-release.md` ADDED, `CHANGELOG.md` ADDED at root, intentional `templates UNCHANGED` invariant relaxation per FR-12.5 | FR-7.1, FR-7.2, FR-7.4, FR-7.5, FR-12.5, FR-12.8 | AC-10 |
| UC-CC-6 | Backward compat — opt-out byte-for-byte preservation (downstream project without sentinel rule has zero behavioral change relative to §6 baseline) | FR-7.3, FR-9.4, NFR-3 | AC-8 |

---

## UC-1: Maintainer Cuts FIRST `sdlc-knowledge-v0.2.0` Release via One-Shot Bootstrap

**Actor**: Maintainer, `install.sh` script, GitHub Actions runner, GitHub Releases service

**Preconditions**:
- Common preconditions hold
- The Maintainer is on the SDLC core repo working tree, on a clean `main` branch (or release branch) checked out from `codefather-labs/claude-code-sdlc`
- `tools/sdlc-knowledge/Cargo.toml:3` declares `version = "0.2.0"` per §12 NFR-9 (already on main when iter-3 lands)
- The git remote `origin` is configured and authenticated (`gh auth status` returns logged-in OR a valid SSH key is present for `git@github.com:codefather-labs/claude-code-sdlc.git`)
- No `sdlc-knowledge-v0.2.0` tag exists locally OR remotely (`git tag -l 'sdlc-knowledge-v0.2.0'` empty AND `git ls-remote --tags origin 'sdlc-knowledge-v0.2.0'` empty)
- The `.github/workflows/sdlc-knowledge-release.yml` workflow file is present on the branch being tagged (otherwise the workflow does not fire on tag push)
- `install.sh` has FR-5 (REPO_URL fix), FR-3 (Windows matrix entry), FR-4 (prebuilt-binary download path), and FR-6 (`bootstrap_first_release` function) all merged

**Trigger**: Maintainer runs `bash install.sh --bootstrap-release 0.2.0` from the SDLC core repo root

### Primary Flow (Happy Path)

1. `install.sh` parses the `--bootstrap-release 0.2.0` flag and dispatches into the `bootstrap_first_release` function per FR-6.1; normal install steps are SKIPPED (the bootstrap is a dedicated one-shot path)
2. The function verifies pre-condition (a): `tools/sdlc-knowledge/Cargo.toml` exists at the SDLC core repo path AND `.git` exists at the repo root per FR-6.2; both pass
3. The function verifies pre-condition (b): `git status --porcelain` returns empty (clean working tree) per FR-6.2; passes
4. The function verifies pre-condition (c): the `0.2.0` flag value matches the version in `tools/sdlc-knowledge/Cargo.toml:3` per FR-6.2; passes
5. The function emits the literal warning `[BOOTSTRAP] this is a one-time first-release operation; subsequent releases use /merge-ready Gate 9 with release-engineer in executing mode (FR-1)` to stderr per FR-6.4
6. The function creates `.claude/release-notes-0.2.0.md` containing a brief stub summarizing the iter-1 + iter-2 + iter-3 cumulative changes per FR-6.3 (a)
7. (Maintainer hand-edits the stub per FR-6.3 if desired — the bootstrap pauses for the maintainer to inspect the file before continuing; in CI / automated context the stub is accepted as-is)
8. The function executes `git tag -a sdlc-knowledge-v0.2.0 -F .claude/release-notes-0.2.0.md` per FR-6.3 (b); creates the local annotated tag with the release-notes file as the message
9. The function emits the literal prompt `[BOOTSTRAP] About to execute: git push origin sdlc-knowledge-v0.2.0 — this fires the GH Actions release workflow at .github/workflows/sdlc-knowledge-release.yml. Approve? [y/N]:` per FR-6.5
10. Maintainer responds with the literal lowercase `y` followed by newline; the function executes `git push origin sdlc-knowledge-v0.2.0` per FR-6.3 (c)
11. The push lands at GitHub; GitHub Actions detects the matching tag-filter glob `sdlc-knowledge-v*` per FR-11.4 and fires `.github/workflows/sdlc-knowledge-release.yml`
12. The workflow runs the actionlint job, then five matrix builds in parallel (`macos-14` darwin-arm64, `macos-13` darwin-x64, `ubuntu-latest` linux-x64, `ubuntu-22.04-arm` linux-arm64, `windows-latest` windows-x64); each downloads PDFium per FR-3.2 / FR-3.3, runs `cargo build --release --target <target>` per FR-3.4, stages the binary at `dist/sdlc-knowledge-<platform>(.exe)` per FR-3.5
13. After all five matrix builds succeed, the release job runs: `git archive` produces the source tarball per FR-3.7, then `softprops/action-gh-release@v2` consumes `tag_name: sdlc-knowledge-v0.2.0`, `body_path: .claude/release-notes-0.2.0.md` per FR-2.3, `files:` listing all five binaries plus the source tarball per FR-3.6 / FR-3.7
14. The action publishes the GitHub Release page at `https://github.com/codefather-labs/claude-code-sdlc/releases/tag/sdlc-knowledge-v0.2.0` with six assets (`sdlc-knowledge-darwin-arm64`, `sdlc-knowledge-darwin-x64`, `sdlc-knowledge-linux-x64`, `sdlc-knowledge-linux-arm64`, `sdlc-knowledge-windows-x64.exe`, `sdlc-knowledge-source-0.2.0.tar.gz`) within ≤ 15 min total wall-clock time per NFR-5
15. The Release page body matches `.claude/release-notes-0.2.0.md` byte-for-byte (modulo GitHub's markdown rendering) per AC-3
16. From this point onward, `bash install.sh --yes` on any of the five supported platforms downloads the prebuilt binary at this Release URL within ≤ 60 s per FR-4.6 / NFR-2 / AC-5; the chicken-and-egg gap that has been forcing `cargo_source_build_fallback` on every install since §11 shipped is CLOSED

**Postconditions**:
- A new annotated git tag `sdlc-knowledge-v0.2.0` exists locally AND at `origin` (`git tag -l 'sdlc-knowledge-v0.2.0'` non-empty; `git ls-remote --tags origin` shows the tag)
- The annotated tag's message matches `.claude/release-notes-0.2.0.md` byte-for-byte (verified via `git cat-file tag sdlc-knowledge-v0.2.0` per AC-1)
- A GitHub Release at `sdlc-knowledge-v0.2.0` exists with six assets (five platform binaries + one source tarball) per AC-4
- Each platform binary asset is non-zero size; each binary passes `<binary> --version` returning `sdlc-knowledge 0.2.0` per AC-4
- The Release body matches the tag annotation byte-for-byte per AC-3 (NFR-8 determinism contract)
- The file `.claude/release-notes-0.2.0.md` is committed (or stays as untracked if the maintainer chose not to commit; the bootstrap does not commit on the maintainer's behalf — only `/merge-ready` Gate 9 in normal mode does that per FR-1.2 row 5)

**Mapped FR**: FR-6.1, FR-6.2, FR-6.3, FR-6.4, FR-6.5, FR-3.1 through FR-3.7, FR-2.1, FR-2.2, FR-2.3, FR-11.4
**Mapped ACs**: AC-2, AC-3, AC-4

### Alternative Flows

- **UC-1-A1: Bootstrap re-run when tag already exists at remote** — FR-6.2 clean-tree precondition still passes, but `git tag -a sdlc-knowledge-v0.2.0` exits non-zero with `fatal: tag 'sdlc-knowledge-v0.2.0' already exists`
  1. Maintainer runs `bash install.sh --bootstrap-release 0.2.0` again after a successful first run
  2. Pre-conditions (a), (b), (c) all pass per FR-6.2
  3. Step 8 attempts `git tag -a sdlc-knowledge-v0.2.0 -F .claude/release-notes-0.2.0.md` and exits non-zero
  4. The function emits a clear stderr message (`tag already exists; subsequent releases use /merge-ready, not --bootstrap-release`) and exits 1
  5. No mutation occurs

  **Mapped FR**: FR-6.2, FR-6.4 (the warning text encourages /merge-ready for next release)

### Error Flows

- **UC-1-E1: Bootstrap pre-condition failure — dirty working tree**
  1. Maintainer runs `bash install.sh --bootstrap-release 0.2.0` with `git status --porcelain` returning non-empty
  2. Pre-condition (a) passes
  3. Pre-condition (b) FAILS per FR-6.2; the function emits a clear stderr message identifying the offending paths and exits 1
  4. No mutation occurs (no tag created, no file written)

  **Mapped FR**: FR-6.2 (b)

- **UC-1-E2: Bootstrap pre-condition failure — version mismatch with `tools/sdlc-knowledge/Cargo.toml:3`**
  1. Maintainer runs `bash install.sh --bootstrap-release 9.9.9` with `Cargo.toml:3` declaring `version = "0.2.0"`
  2. Pre-conditions (a) and (b) pass
  3. Pre-condition (c) FAILS per FR-6.2; the function emits a clear stderr message identifying the version mismatch and exits 1
  4. No mutation occurs

  **Mapped FR**: FR-6.2 (c)

- **UC-1-E3: Bootstrap user declines the FR-6.5 push prompt**
  1. Maintainer runs `bash install.sh --bootstrap-release 0.2.0`; flow proceeds through step 8 (local tag created)
  2. At step 9 the function prompts; Maintainer responds with `n` or empty newline
  3. The function emits a stderr message (`bootstrap aborted by user; local tag preserved at sdlc-knowledge-v0.2.0; push manually with: git push origin sdlc-knowledge-v0.2.0`) and exits 0 (NOT 1 — user declination is not an error per the FR-1.5 deny semantics inherited)
  4. The local tag is preserved; remote is unmodified

  **Mapped FR**: FR-6.5

### Edge Cases

- **UC-1-EC1: Bootstrap on a branch other than `main`** — The pre-condition (a) heuristic only checks for `Cargo.toml` and `.git`; the bootstrap proceeds and tags `HEAD` of whatever branch the Maintainer is on. **Expected behavior**: the maintainer is responsible for being on the correct branch; the bootstrap does NOT enforce branch identity. The annotated tag points at the branch's current commit; the workflow fires regardless of branch.

### Data Requirements

- **Input**: `--bootstrap-release <X.Y.Z>` flag value (literal `0.2.0`); contents of `tools/sdlc-knowledge/Cargo.toml:3`; clean working tree state; git remote `origin` configured + authenticated
- **Output**: New file `.claude/release-notes-0.2.0.md`; new local annotated tag `sdlc-knowledge-v0.2.0`; new remote tag at `origin`; new GitHub Release at `sdlc-knowledge-v0.2.0`
- **Side Effects**: GitHub Actions workflow `sdlc-knowledge-release.yml` fires; six assets uploaded to Release page; `install.sh` future invocations switch from `cargo_source_build_fallback` to prebuilt-binary primary path on five platforms

---

## UC-2: Maintainer Cuts FIRST SDLC Core `v3.0.0` Release via `/merge-ready` Gate 9

**Actor**: Maintainer, `release-engineer` agent, `install.sh` script (transitively for setup), GitHub Actions runner

**Preconditions**:
- Common preconditions hold
- The Maintainer is on the SDLC core repo, on a feature branch (e.g., `feat/auto-release-pipeline`) ready to merge to main
- `.claude/rules/auto-release.md` exists at the SDLC core repo root per FR-7.2 (codifies the FR-1.2 tier table, FR-1.3 anchored-regex whitelist, FR-1.4 headless contract, FR-1.5 prompt format)
- `.claude/rules/changelog.md` exists at the SDLC core repo root per FR-7.1 (byte-identical to `templates/rules/changelog.md`; activates the changelog-writer agent)
- `CHANGELOG.md` at the SDLC core repo root has `## [Unreleased]` populated with iter-3 auto-release feature entries per FR-7.4 (the bootstrap of UC-2 IS the iter-3 feature being shipped)
- `install.sh:22` declares `VERSION="3.0.0"` per FR-7.5 (already updated as part of the iter-3 feature)
- `install.sh:48` `print_help` heredoc first line declares `Claude Code SDLC Installer v3.0.0` per FR-7.5
- The `.github/workflows/sdlc-core-release.yml` workflow file exists per FR-11.2 and triggers on `v*` tag pushes
- `AUTO_RELEASE` is UNSET (interactive mode) per FR-1.4
- The Maintainer has run all prior `/merge-ready` gates (Gates 0-8) successfully

**Trigger**: Maintainer runs `/merge-ready` from the SDLC core repo root; the orchestrator dispatches Gate 9 to the `release-engineer` agent

### Primary Flow (Happy Path)

1. `release-engineer` reads `.claude/rules/auto-release.md` and detects executing-mode is ENABLED per FR-9.4
2. The agent reads `.claude/rules/changelog.md` and detects changelog-mode is ENABLED per FR-7.1 (transitively required for the CHANGELOG rewrite operation)
3. The agent computes the version bump from `[Unreleased]` content per §6 FR-2: detects `Added` entries → MINOR bump candidate; reconciles with the FR-7.4 MAJOR override (executing-mode flip is a breaking authority-boundary change per NFR-9) → final bump = MAJOR `2.1.0 → 3.0.0`
4. **Trivial-tier operation 1** (FR-1.2 row 1): rewrite `CHANGELOG.md` `[Unreleased]` → `[3.0.0] - 2026-04-26 — Auto-Release Pipeline` and insert fresh empty `[Unreleased]`; auto-executes without prompt
5. **Trivial-tier operation 2** (FR-1.2 row 2): write `.claude/release-notes-3.0.0.md` containing the body of the freshly renamed `[3.0.0]` section verbatim per FR-2.1; auto-executes
6. **Trivial-tier operation 3** (FR-1.2 row 3): provision `.github/workflows/sdlc-core-release.yml` if ABSENT per FR-11.2; if present (which it is in this UC), this step is a no-op
7. **Moderate-tier operation 1** (FR-1.2 row 4): bump `install.sh:22` `VERSION="2.1.0"` → `VERSION="3.0.0"` per FR-7.5. The agent emits the FR-1.5 Sensitive-tier prompt format adapted for Moderate (`[Moderate — release-engineer] About to execute: <verbatim-edit>` ... `Approve? [y/N]:`); Maintainer responds `y`; agent applies the edit
8. **Moderate-tier operation 2** (FR-1.2 row 5): `git add CHANGELOG.md .claude/release-notes-3.0.0.md install.sh` + `git commit -m "chore(release): 3.0.0"`; per-item Moderate prompt; Maintainer approves; commit lands
9. **Moderate-tier operation 3** (FR-1.2 row 6): `git tag -a v3.0.0 -F .claude/release-notes-3.0.0.md`; per-item Moderate prompt; Maintainer approves; local annotated tag created with release-notes file as message
10. **Pre-push validation** runs per FR-8.1: the agent attempts to invoke the project's typecheck + test + lint commands per `./CLAUDE.md` `## Commands` block. Per FR-8.3, the SDLC core repo has no `## Commands` block in the root `./CLAUDE.md`; validation is SKIPPED with the literal log line `pre-push validation skipped: no Commands block in ./CLAUDE.md`
11. **Sensitive-tier operation 1** (FR-1.2 row 7): `git push origin <branch>` (push current branch); the agent emits the FR-1.5 prompt with full `[Sensitive — release-engineer]` shape (verbatim command + tier rationale + reversibility note + `Approve? [y/N]:`); Maintainer approves; push lands
12. **Sensitive-tier operation 2** (FR-1.2 row 8 + FR-11.5 disambiguation): `git push origin v3.0.0` (push tag — fires the GH Actions workflow). The agent emits the FR-1.5 Sensitive prompt explicitly stating which workflow will fire per FR-11.5: `tag prefix: v — will fire .github/workflows/sdlc-core-release.yml`; Maintainer approves; tag push lands
13. The push triggers `.github/workflows/sdlc-core-release.yml` per FR-11.4 (the `v*` tag-filter glob matches `v3.0.0`); the workflow runs actionlint, packages the SDLC core as `claude-code-sdlc-3.0.0.tar.gz` via `git archive`, then `softprops/action-gh-release@v2` publishes the Release page with the source tarball + `install.sh` standalone, `body_path: .claude/release-notes-3.0.0.md`, `tag_name: v3.0.0` per FR-11.2
14. The agent emits the structured 10-section summary per FR-1.8 with the new `Tier breakdown` section reporting `3 Trivial; 3 Moderate; 2 Sensitive (auto-approved); 0 Sensitive (skipped); 0 Forbidden (refused)`

**Postconditions**:
- A new annotated git tag `v3.0.0` exists at `origin`; the tag annotation matches `.claude/release-notes-3.0.0.md` byte-for-byte per AC-1
- A GitHub Release at `v3.0.0` exists with two assets (source tarball + `install.sh`) per FR-11.2
- The Release body matches the tag annotation per AC-3
- `CHANGELOG.md` at the repo root contains `## [Unreleased]` (empty) and `## [3.0.0] - 2026-04-26 — Auto-Release Pipeline` per AC-10
- The `Tier breakdown` line is grep-able for Plan Critic per AC-11 / NFR-4

**Mapped FR**: FR-1.1 through FR-1.8, FR-2.1, FR-2.2, FR-2.3, FR-7.1, FR-7.2, FR-7.4, FR-7.5, FR-7.6, FR-8.1, FR-8.3, FR-11.2, FR-11.4, FR-11.5
**Mapped ACs**: AC-1, AC-3, AC-10, AC-11

### Alternative Flows

- **UC-2-A1: First-run before `.claude/rules/auto-release.md` is created** — sentinel absence triggers fallback to suggest-only
  1. Maintainer runs `/merge-ready` BEFORE the FR-7.2 sentinel file is created (e.g., during the iter-3 implementation slices, between Slice 2 and Slice 3)
  2. `release-engineer` reads `.claude/rules/auto-release.md` and detects ABSENCE per FR-9.4
  3. The agent falls back to byte-identical §6 suggest-only behavior per NFR-3
  4. The agent emits the §6 structured 10-section summary with `Commands to run` listing the same commands the executing-mode flow would have run, but does NOT invoke `Bash`
  5. AC-8 byte-identical-to-§6 contract is satisfied (verified by `diff` against captured §6 baseline excluding timestamp)

  **Mapped FR**: FR-7.3, FR-9.4, NFR-3
  **Mapped ACs**: AC-8

### Error Flows

- **UC-2-E1: Pre-push validation fails** (relevant when the SDLC core repo has gained a `## Commands` block, or when this UC is run on a downstream project)
  1. Flow proceeds through step 9 (local tag created)
  2. Step 10 pre-push validation invokes the project's typecheck or unit-test command; one exits non-zero
  3. The agent emits `pre-push validation failed: <command> exited <N>` per FR-8.2
  4. The agent SKIPS step 11 / step 12 push operations (Sensitive-tier deny semantics)
  5. The local CHANGELOG / release-notes / annotated-tag artifacts created in steps 4-9 are PRESERVED per FR-8.2
  6. The structured summary's `Tier breakdown` reports `<N> Sensitive (skipped)`; the `Warnings` section records the skip
  7. The Maintainer fixes the validation failure and re-runs `/merge-ready`; the prior tag is reused (tag creation is idempotent because `git tag -a <name>` exits non-zero on existing tag and the agent detects this)

  **Mapped FR**: FR-8.1, FR-8.2

### Edge Cases

- **UC-2-EC1: `[Unreleased]` is empty when `/merge-ready` runs** — per §6 FR-7.2 inherited contract: Gate 9 produces SKIPPED outcome (no rewrite, no tag, no push); structured summary reports `0 Trivial; 0 Moderate; 0 Sensitive; 0 Forbidden`. No state change.

### Data Requirements

- **Input**: `[Unreleased]` content from `CHANGELOG.md`; `.claude/rules/auto-release.md` (sentinel); `.claude/rules/changelog.md` (sentinel); `install.sh:22` `VERSION` value; `./CLAUDE.md` `## Commands` block (or absence)
- **Output**: Renamed `[3.0.0] - YYYY-MM-DD` CHANGELOG section + fresh `[Unreleased]`; new file `.claude/release-notes-3.0.0.md`; updated `install.sh:22` (and `:48`); commit `chore(release): 3.0.0`; new annotated tag `v3.0.0`; new GitHub Release page
- **Side Effects**: GH Actions workflow `sdlc-core-release.yml` fires; structured summary's `Tier breakdown` line emitted to stdout (grep-able per AC-11)

---

## UC-3: Downstream Developer `/merge-ready` Run Through Gate 9 (Standard Path)

**Actor**: Downstream Developer, `release-engineer` agent, GitHub Actions runner

**Preconditions**:
- Common preconditions hold
- Downstream project has run `bash install.sh --init-project` with auto-release opted-in per FR-7.3 (`.claude/rules/auto-release.md` is present at the project root, byte-identical to `templates/rules/auto-release.md`)
- `.claude/rules/changelog.md` is also present (changelog-writer is opted in)
- `./CLAUDE.md` at the project root has a `## Commands` block declaring `npm test`, `npm run typecheck`, `npm run lint` (or equivalent for the project's tech stack)
- `CHANGELOG.md` `[Unreleased]` is non-empty with `Added` and `Fixed` entries
- The Developer is on a feature branch (e.g., `feat/user-profile`) ready to merge
- All prior gates (Gates 0-8) have passed
- `AUTO_RELEASE` is UNSET (interactive mode)

**Trigger**: Developer runs `/merge-ready` from the project root; orchestrator dispatches Gate 9 to `release-engineer`

### Primary Flow (Happy Path)

1. `release-engineer` detects executing-mode (FR-7.3 sentinel present + FR-9.4 contract)
2. Agent computes version bump from `[Unreleased]` content per §6 FR-2: `Added` + `Fixed` → MINOR bump (e.g., `1.4.0 → 1.5.0`)
3. **Trivial-tier**: rewrite `[Unreleased]` → `[1.5.0] - 2026-04-25`; insert fresh `[Unreleased]`; write `.claude/release-notes-1.5.0.md` per FR-2.1; auto-execute
4. **Moderate-tier with prompts**: bump version-source (`package.json` via `npm version minor` per FR-1.3 (f) anchored regex `^npm version (patch|minor|major)$`); commit `chore(release): 1.5.0`; create local annotated tag `git tag -a v1.5.0 -F .claude/release-notes-1.5.0.md` — Developer approves each per-item prompt with `y`
5. **Pre-push validation** per FR-8.1: agent invokes `npm run typecheck`, then `npm test`, then `npm run lint`; all pass; agent proceeds
6. **Sensitive-tier with prompts**: `git push origin feat/user-profile` (matches FR-1.3 (e) `^git push origin (feat|fix|chore)/[a-z0-9-]+$`); Developer approves with `y`; push lands
7. **Sensitive-tier with prompts**: `git push origin v1.5.0` (matches FR-1.3 (d) `^git push origin (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+$`); FR-11.5 disambiguates (`tag prefix: v — will fire .github/workflows/release.yml` if the project shipped one); Developer approves with `y`; tag push lands
8. The downstream project's GH Actions release workflow (if provisioned per §6 FR-3.2 / template) fires on the `v*` tag push; consumes `body_path: .claude/release-notes-1.5.0.md` per FR-2.3; publishes the Release page
9. Agent emits structured 10-section summary with `Tier breakdown` reporting `1 Trivial; 3 Moderate; 2 Sensitive (auto-approved); 0 Sensitive (skipped); 0 Forbidden (refused)`

**Postconditions**:
- New annotated tag `v1.5.0` at `origin`; tag annotation matches `.claude/release-notes-1.5.0.md` per AC-1
- GitHub Release at `v1.5.0` with body matching tag annotation per AC-3
- `CHANGELOG.md` `[Unreleased]` is empty; `[1.5.0] - YYYY-MM-DD` is populated
- `package.json` `version` field is `1.5.0`
- The complete tier-dispatched run is captured in `Tier breakdown` for Plan Critic per AC-11

**Mapped FR**: FR-1.1 through FR-1.8, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-7.3, FR-8.1
**Mapped ACs**: AC-1, AC-2, AC-3, AC-11

### Alternative Flows

- **UC-3-A1: `[Unreleased]` only has `Removed` entries → MAJOR bump** — per §6 FR-2 inherited semantics
  1. CHANGELOG `[Unreleased]` contains only `### Removed` entries (no `Added` / `Fixed`)
  2. Agent computes version bump = MAJOR (e.g., `1.4.2 → 2.0.0`) per Keep-a-Changelog `Removed` ⇒ MAJOR convention
  3. Flow proceeds otherwise identically; final tag is `v2.0.0`

  **Mapped FR**: FR-1.2 (Trivial CHANGELOG rewrite), §6 FR-2 inherited

- **UC-3-A2: Pre-1.0 override (`Cargo.toml` major=0) demotes MAJOR to MINOR** — per §6 FR-2.x pre-1.0 carve-out
  1. Project's version-source `Cargo.toml:3` declares `version = "0.4.2"` (pre-1.0)
  2. CHANGELOG `[Unreleased]` has `Removed` entries that would normally trigger MAJOR
  3. Agent applies the pre-1.0 carve-out: MAJOR → MINOR (`0.4.2 → 0.5.0`)
  4. Flow proceeds; final tag is `v0.5.0`

  **Mapped FR**: FR-1.2 (Moderate version-source bump), §6 FR-2.x

### Error Flows

- **UC-3-E1: `gh` CLI not installed**
  1. Agent attempts to invoke `gh` (e.g., for the optional `gh release view <tag> --json body --jq .body` self-verification step at the end of the structured summary)
  2. The `gh` invocation exits 127 (`command not found`)
  3. Agent logs the literal warning `gh CLI not available; release published successfully but post-publish self-verification skipped`
  4. Agent does NOT fall back to suggest-only — `gh` is OPTIONAL; the release pipeline succeeds without it
  5. Gate 9 PASSES with a Warning (not FAIL) per the FR-1.4 graceful-degradation contract

  **Mapped FR**: FR-1.4 (graceful), NFR-3

- **UC-3-E2: GitHub authentication missing — `git push` fails with auth error**
  1. Flow proceeds through step 5 (pre-push validation passes); local tag created at step 4
  2. At step 6, `git push origin feat/user-profile` fails with `fatal: Authentication failed for 'https://github.com/...'`
  3. Agent detects the non-zero exit; emits stderr message `git push failed: authentication error; check gh auth status or SSH key`
  4. **Reversibility per FR-1.5**: agent emits the literal recovery hint `Reversibility: git tag -d v1.5.0 + git push origin --delete v1.5.0 (the latter is N/A since the tag was never pushed)`
  5. Agent SKIPS step 7 (tag push); local artifacts preserved
  6. Tier breakdown reports `<N> Sensitive (skipped)`
  7. Developer fixes auth and re-runs `/merge-ready`

  **Mapped FR**: FR-1.2 (Sensitive-tier reversibility), FR-1.5, FR-8.2

### Edge Cases

- **UC-3-EC1: Tag-format collision — project also uses `v*` tags for non-semver dates** (e.g., `v2024-Q4`)
  1. Agent computes the proposed tag `v1.5.0`
  2. Agent runs a pre-push dry-run check: `git tag -l 'v1.5.0'` and `git ls-remote --tags origin 'v1.5.0'` — both empty
  3. Agent ALSO checks the FR-1.3 (d) anchored regex `^git push origin (sdlc-knowledge-)?v[0-9]+\.[0-9]+\.[0-9]+$` matches the proposed command — YES
  4. Push proceeds; the project's non-semver `v2024-Q4` tags are unaffected (different tag values)
  5. **Note**: the FR-11.4 GitHub Actions tag-filter `v*` glob WILL match `v2024-Q4` AND `v1.5.0` — if the project's `release.yml` workflow assumes semver tags only, the project's workflow must filter further. This is documented in §6 / project-specific scope, not the auto-release feature

  **Mapped FR**: FR-1.3 (anchored-regex whitelist), FR-11.4

### Data Requirements

- **Input**: `[Unreleased]` CHANGELOG content; `.claude/rules/auto-release.md`; `./CLAUDE.md` `## Commands` block; project's version-source file (`package.json` / `Cargo.toml` / `pyproject.toml` / `VERSION`); git authentication state
- **Output**: Renamed CHANGELOG section + fresh `[Unreleased]`; new release-notes file; updated version-source file; commit; local + remote annotated tag; GitHub Release page
- **Side Effects**: GH Actions release workflow fires; pre-push validation invocation logs

---

## UC-4: CI Bot Runs `/merge-ready` with `AUTO_RELEASE=1` (Headless Mode)

**Actor**: CI bot, `release-engineer` agent

**Preconditions**:
- Common preconditions hold
- The CI bot environment has `AUTO_RELEASE=1` set per FR-1.4 / FR-9.1
- `.claude/rules/auto-release.md` is present per FR-7.3 / FR-9.4 (BOTH the env var AND the sentinel must be present for headless executing-mode)
- `.claude/rules/changelog.md` is present
- `./CLAUDE.md` has a `## Commands` block declaring typecheck / test / lint commands
- `CHANGELOG.md` `[Unreleased]` is non-empty
- No interactive TTY is available (the CI bot has no stdin)
- The CI environment does NOT set `CI=true` / `GITHUB_ACTIONS=true` as a substitute for `AUTO_RELEASE=1` per FR-9.3 (these env vars MUST NOT auto-activate headless mode; explicit opt-in via `AUTO_RELEASE=1` only)

**Trigger**: CI bot invokes `/merge-ready` as part of its automated pipeline

### Primary Flow (Happy Path)

1. `release-engineer` detects sentinel + `AUTO_RELEASE=1` → executing-mode + headless contract per FR-9.4
2. **Trivial-tier** (CHANGELOG rewrite, release-notes file write, workflow-file provision-if-absent): auto-execute without prompt per FR-1.4
3. **Moderate-tier** (version-source bump, commit, local tag): auto-execute WITHOUT per-item prompt per FR-1.4 (the env var is the implicit batch approval signal); each operation must still match the FR-1.3 anchored-regex whitelist
4. **Pre-push validation** per FR-8.1: invoke the `## Commands` block typecheck/test/lint; all pass; agent proceeds
5. **Sensitive-tier** (`git push origin <branch>`): REFUSED per FR-1.4 with literal stderr line `aborted-headless-sensitive: git push origin <branch> requires interactive approval; rerun without AUTO_RELEASE=1`; the `Warnings` section records the skip per FR-9.2
6. **Sensitive-tier** (`git push origin <tag>`): REFUSED per FR-1.4 with literal stderr line `aborted-headless-sensitive: git push origin <tag> requires interactive approval; rerun without AUTO_RELEASE=1`; the `Warnings` section records the skip
7. **Forbidden-tier**: nothing in this run hits Forbidden (CI bot does not invoke `npm publish` etc.); count is 0
8. Agent exits 0 (NOT 1 — headless skip is not an error per FR-1.4 / AC-7)
9. Structured summary's `Commands to run` section per FR-9.2 lists the un-executed Sensitive-tier commands so a downstream human run can pick them up
10. `Tier breakdown` line per FR-1.8 reports `<N> Trivial; <N> Moderate; 0 Sensitive (auto-approved); 2 Sensitive (skipped); 0 Forbidden (refused)` per AC-7 (e)

**Postconditions**:
- Local CHANGELOG / release-notes / annotated-tag artifacts EXIST per AC-7 (a)
- NO `git push` invocation occurred per AC-7 (b) — `git ls-remote --tags origin <tag>` returns empty for the new tag
- Literal stderr line `aborted-headless-sensitive: ...` per AC-7 (c) (grep-able)
- Exit code 0 per AC-7 (d)
- `Tier breakdown` line `<N> Sensitive (skipped)` per AC-7 (e)
- The `Warnings` section explicitly lists the skipped operations so a human follow-up run completes them

**Mapped FR**: FR-1.4, FR-9.1, FR-9.2, FR-9.3, FR-1.8
**Mapped ACs**: AC-7

### Alternative Flows

(none — the headless path is deterministic; either the env var is set and the path above runs, or it is unset and UC-3 path runs)

### Edge Cases

- **UC-4-EC1: Headless mode invoked when `.claude/rules/auto-release.md` is ABSENT** — sentinel takes priority over env var per FR-9.4
  1. CI bot has `AUTO_RELEASE=1` set
  2. `.claude/rules/auto-release.md` does NOT exist in the project
  3. Agent falls back to byte-identical §6 suggest-only behavior per FR-9.4 / NFR-3
  4. The structured summary is the §6 baseline; no Bash invocation; no tag creation
  5. AC-8 contract holds (the env var alone does NOT activate executing-mode)

  **Mapped FR**: FR-9.4
  **Mapped ACs**: AC-8

### Data Requirements

- **Input**: `AUTO_RELEASE=1` env var; `.claude/rules/auto-release.md` (sentinel); `[Unreleased]` content; `./CLAUDE.md` `## Commands` block
- **Output**: Local CHANGELOG / release-notes / tag artifacts (Trivial + Moderate executed); structured summary with `Warnings` listing un-executed Sensitive operations; literal `aborted-headless-sensitive` stderr lines
- **Side Effects**: NO remote mutation; no GitHub Actions workflow fires

---

## UC-5: `install.sh` on darwin-arm64 Downloads Prebuilt Binary (Replaces Cargo Source-Build Path)

**Actor**: `install.sh` user, `install.sh` script, GitHub Releases service

**Preconditions**:
- Common preconditions hold
- Host machine runs darwin-arm64 (Apple Silicon Mac); `uname -ms` returns `Darwin arm64`
- Network connectivity to `https://github.com/codefather-labs/claude-code-sdlc/releases/...` is available
- The FIRST `sdlc-knowledge-v0.2.0` tag has been cut per UC-1; the GitHub Release page exists with all six assets per AC-4
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does NOT yet exist (or exists but at a different version per the FR-4.5 idempotency check)
- `install.sh:22` declares `VERSION="3.0.0"`; `install.sh:23` declares `KNOWLEDGE_VERSION="0.2.0"` (the version pointed-at version, matching the released tag)
- `install.sh:25` `REPO_URL="https://github.com/codefather-labs/claude-code-sdlc.git"` per FR-5.1

**Trigger**: User runs `bash install.sh --yes` from a fresh clone (or from anywhere, via the curl piping path)

### Primary Flow (Happy Path)

1. `install.sh` detects `uname -ms` returns `Darwin arm64`; the `case` at lines 354-363 matches `"Darwin arm64") platform="darwin-arm64" ;;`
2. The owner-derivation at line 367 computes `owner_repo="codefather-labs/claude-code-sdlc"` per FR-5.1
3. The asset URL at line 368 constructs `https://github.com/codefather-labs/claude-code-sdlc/releases/download/sdlc-knowledge-v0.2.0/sdlc-knowledge-darwin-arm64` per FR-4.2; for darwin-arm64, the platform suffix is appended without `.exe` per FR-4.3
4. `install.sh` invokes the `download_release_binary` helper (precedent shape from `install_pdfium_binary` per §12 FR-3): `curl --proto '=https' --tlsv1.2 -fsSL --max-redirs 5 --max-time 120 -o <tmpfile> <url>` per the precedent at `install.sh:489-613`
5. Download completes; the binary is placed at a temporary staging path
6. `install.sh` runs `--version` smoke test on the staged binary per `install.sh:396-401`; `sdlc-knowledge --version` returns `sdlc-knowledge 0.2.0` matching `KNOWLEDGE_VERSION="0.2.0"`; smoke test passes
7. `install.sh` `mv`s the staged binary to `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` and applies `chmod +x` per existing iter-1 conventions
8. Total elapsed time (download + smoke + mv + chmod) is ≤ 60 s per NFR-2 / AC-5
9. The install summary at script-end reports `tools/sdlc-knowledge/sdlc-knowledge (darwin-arm64 — sdlc-knowledge-v0.2.0 prebuilt)` per FR-4.6
10. Re-running `bash install.sh --yes` is a no-op per FR-4.5 (the version-check at lines 343-350 detects the already-installed version)

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists, is executable, returns `sdlc-knowledge 0.2.0` from `--version` per AC-5
- The install summary references `darwin-arm64` and `sdlc-knowledge-v0.2.0 prebuilt` per FR-4.6
- The `~/.claude/settings.json` Bash allowlist includes the §11 entry for `sdlc-knowledge *` and the FR-10.1 entries for the release-engineer regexes per FR-10.2
- `cargo_source_build_fallback` was NOT invoked (no `cargo build --release` ran)
- No `Koroqe` references appear in any install.sh log output per AC-9 / FR-5.3

**Mapped FR**: FR-4.1, FR-4.2, FR-4.5, FR-4.6, FR-5.1
**Mapped ACs**: AC-5, AC-9

### Alternative Flows

- **UC-5-A1: Re-run on a host with the binary already at the expected version** — idempotent no-op per FR-4.5
  1. User re-runs `bash install.sh --yes` after a prior successful install
  2. `install.sh` runs the version-check at lines 343-350; detects `sdlc-knowledge --version` returns `sdlc-knowledge 0.2.0` (matches `KNOWLEDGE_VERSION="0.2.0"`)
  3. Skips download; logs `sdlc-knowledge already at sdlc-knowledge-v0.2.0; skipping`
  4. Total elapsed time ≤ 5 s

  **Mapped FR**: FR-4.5

### Error Flows

(none specific to darwin-arm64 happy path; see UC-10 / UC-11 for fallback paths)

### Data Requirements

- **Input**: `uname -ms` returns `Darwin arm64`; network reachable; FIRST `sdlc-knowledge-v0.2.0` Release exists
- **Output**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` executable file
- **Side Effects**: One TLS HTTPS GET to `github.com`; install summary line referencing platform + version

---

## UC-6: `install.sh` on linux-x64 Downloads Prebuilt Binary

**Actor**: `install.sh` user, `install.sh` script, GitHub Releases service

**Preconditions**:
- Common preconditions hold
- Host machine runs linux-x64 (e.g., Ubuntu 22.04 on x86_64); `uname -ms` returns `Linux x86_64`
- Network connectivity available; FIRST tag cut per UC-1
- glibc version on host is compatible with the `ubuntu-latest` (glibc 2.35) build per R-5; if not, the smoke-test fails and falls back per FR-4.4

**Trigger**: User runs `bash install.sh --yes` on a Linux x64 machine

### Primary Flow (Happy Path)

1. `uname -ms` returns `Linux x86_64`; case branch matches `"Linux x86_64") platform="linux-x64" ;;`
2. Asset URL: `https://github.com/codefather-labs/claude-code-sdlc/releases/download/sdlc-knowledge-v0.2.0/sdlc-knowledge-linux-x64` (no `.exe` suffix per FR-4.3)
3. Download + smoke test + place at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` per UC-5 steps 4-7
4. Total ≤ 60 s per NFR-2
5. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (linux-x64 — sdlc-knowledge-v0.2.0 prebuilt)`

**Postconditions**: As UC-5 with `linux-x64` substituted

**Mapped FR**: FR-4.1, FR-4.2, FR-4.6
**Mapped ACs**: AC-5

### Error Flows

- **UC-6-E1: glibc version mismatch on host** (host has glibc 2.31, binary built against 2.35)
  1. Download succeeds; smoke test `sdlc-knowledge --version` fails with dynamic-link error (`/lib/x86_64-linux-gnu/libc.so.6: version GLIBC_2.34 not found`)
  2. Per FR-4.4 (c), `install.sh` falls through to `cargo_source_build_fallback` at line 411
  3. The fallback runs `cargo build --release` and produces a binary linked against the host's local glibc
  4. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (built from source)` per FR-4.6 fallback case
  5. Total elapsed: ≤ 5 min (cargo build dominates) — exceeds NFR-2 60s budget but the fallback is the safety net per R-5

  **Mapped FR**: FR-4.4, R-5

### Data Requirements

As UC-5 with linux-x64 substituted

---

## UC-7: `install.sh` on linux-arm64 Downloads Prebuilt Binary

**Actor**: `install.sh` user, `install.sh` script

**Preconditions**:
- Common preconditions hold
- Host runs linux-arm64 (e.g., Raspberry Pi 4, AWS Graviton); `uname -ms` returns `Linux aarch64`
- Network reachable; FIRST tag cut

**Trigger**: User runs `bash install.sh --yes`

### Primary Flow (Happy Path)

1. `uname -ms` returns `Linux aarch64`; case branch matches `"Linux aarch64") platform="linux-arm64" ;;`
2. Asset URL: `https://github.com/codefather-labs/claude-code-sdlc/releases/download/sdlc-knowledge-v0.2.0/sdlc-knowledge-linux-arm64`
3. Download + smoke test + place per UC-5
4. Total ≤ 60 s per NFR-2
5. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (linux-arm64 — sdlc-knowledge-v0.2.0 prebuilt)`

**Postconditions**: As UC-5 with `linux-arm64` substituted

**Mapped FR**: FR-4.1, FR-4.2, FR-4.6
**Mapped ACs**: AC-5

### Data Requirements

As UC-5 with linux-arm64 substituted

---

## UC-8: `install.sh` on darwin-x64 Downloads Prebuilt Binary

**Actor**: `install.sh` user, `install.sh` script

**Preconditions**:
- Common preconditions hold
- Host runs darwin-x64 (Intel Mac); `uname -ms` returns `Darwin x86_64`
- Network reachable; FIRST tag cut

**Trigger**: User runs `bash install.sh --yes`

### Primary Flow (Happy Path)

1. `uname -ms` returns `Darwin x86_64`; case branch matches `"Darwin x86_64") platform="darwin-x64" ;;`
2. Asset URL: `https://github.com/codefather-labs/claude-code-sdlc/releases/download/sdlc-knowledge-v0.2.0/sdlc-knowledge-darwin-x64`
3. Download + smoke test + place per UC-5
4. Total ≤ 60 s
5. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (darwin-x64 — sdlc-knowledge-v0.2.0 prebuilt)`

**Postconditions**: As UC-5 with `darwin-x64` substituted

**Mapped FR**: FR-4.1, FR-4.2, FR-4.6
**Mapped ACs**: AC-5

### Data Requirements

As UC-5 with darwin-x64 substituted

---

## UC-9: `install.sh` on windows-x64 Downloads Prebuilt Binary (NEW iter-3 Platform)

**Actor**: `install.sh` user, `install.sh` script (run under Git Bash for Windows), GitHub Releases service

**Preconditions**:
- Common preconditions hold
- Host runs Windows x64 (Windows 10 / 11); user has Git for Windows installed (provides `bash`, `curl`, `tar`, `find`, `chmod`, `mv`)
- `uname -ms` (under Git Bash) returns a string matching `MINGW64_NT-10.0-* x86_64` per FR-4.1 (verified: no — assumption; see External Contracts)
- Network reachable; FIRST `sdlc-knowledge-v0.2.0` tag cut per UC-1; the windows-x64 binary asset `sdlc-knowledge-windows-x64.exe` is available on the Release page per AC-4

**Trigger**: User runs `bash install.sh --yes` from a Git Bash shell on Windows

### Primary Flow (Happy Path)

1. `uname -ms` returns (e.g.) `MINGW64_NT-10.0-22631 x86_64`; case branch matches `"MINGW64_NT-* x86_64") platform="windows-x64" ;;` per FR-4.1
2. The `if [ "$platform" = "windows-x64" ]; then suffix=".exe"; else suffix=""; fi` block per FR-4.3 sets `suffix=".exe"`
3. Asset URL: `https://github.com/codefather-labs/claude-code-sdlc/releases/download/sdlc-knowledge-v0.2.0/sdlc-knowledge-windows-x64.exe`
4. Download + smoke test + place at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge.exe` (or equivalent path; the exact target file name may include `.exe` per the Windows convention — TBD by architect per FR-4.3 implementation note)
5. Smoke test: `sdlc-knowledge.exe --version` returns `sdlc-knowledge 0.2.0`; passes
6. Total elapsed ≤ 60 s per NFR-2 (Windows is in the same budget per AC-5)
7. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (windows-x64 — sdlc-knowledge-v0.2.0 prebuilt)`

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge.exe` exists, is executable, returns `sdlc-knowledge 0.2.0` per AC-5
- Install summary references `windows-x64` per FR-4.6
- The Windows binary asset is sized ≤ 12 MB per NFR-6 (looser budget than Linux/macOS 10 MB due to MSVC runtime overhead)

**Mapped FR**: FR-3.1, FR-3.5, FR-3.6, FR-4.1, FR-4.3, FR-4.6
**Mapped ACs**: AC-4, AC-5

### Alternative Flows

- **UC-9-A1: User runs `install.sh` outside Git Bash (e.g., PowerShell)** — `uname -ms` is not available; `install.sh` is a bash script and would not run at all under PowerShell. **Expected behavior**: documented as out-of-scope; the install path on Windows REQUIRES Git Bash. The README.md and `MIGRATION.md` document this requirement.

### Error Flows

- **UC-9-E1: `windows-latest` runner timeout (>15 min) during the original release build** — affects the upstream release pipeline, not the install path
  1. The `.github/workflows/sdlc-knowledge-release.yml` matrix is running for a NEW tag (e.g., `sdlc-knowledge-v0.3.0`)
  2. The Windows MSVC build job exceeds the GH Actions step timeout or the NFR-5 15-min wall-clock budget
  3. The Windows job fails; matrix `fail-fast: false` allows the other four jobs to complete
  4. The Release page is published with FOUR binaries (no Windows asset)
  5. Subsequent `bash install.sh --yes` invocations on Windows hosts fall through to FR-4.4 (cargo source-build fallback) since the asset URL `sdlc-knowledge-windows-x64.exe` returns 404
  6. The `install.sh` log line is `prebuilt windows-x64 binary not available; falling back to cargo source-build`
  7. Maintainer follow-up: re-run the release workflow (manual `gh workflow run` rerun) or cut a `sdlc-knowledge-v0.3.1` patch with the Windows fix

  **Mapped FR**: FR-4.4, NFR-5

### Edge Cases

- **UC-9-EC1: `uname -ms` shape on Git Bash differs from the FR-4.1 assumption** — e.g., the runner reports `MSYS_NT-10.0-* x86_64` instead of `MINGW64_NT-10.0-* x86_64`
  1. Architect Step 3 verifies the actual `uname -ms` shape on a `windows-latest` runner before Slice 4 ships per Open Question #5
  2. If the shape differs, FR-4.1's case-pattern is widened to a glob like `"*NT-* x86_64") platform="windows-x64" ;;` covering both forms
  3. The use-case flow is otherwise identical

  **Mapped FR**: FR-4.1; resolution path per Open Question #5

### Data Requirements

- **Input**: Git Bash for Windows installed; `uname -ms` Windows shape; network; FIRST tag cut with windows-x64 asset
- **Output**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge.exe`
- **Side Effects**: One TLS GET; install summary line

---

## UC-10: `install.sh` on Unsupported Platform (FreeBSD) — Falls Back to Cargo Source-Build

**Actor**: `install.sh` user, `install.sh` script

**Preconditions**:
- Common preconditions hold
- Host runs an unsupported platform (e.g., FreeBSD x64, NetBSD, OpenBSD, Alpine musl-libc, Linux ARMv7); `uname -ms` returns a value NOT matching any of the five FR-4.1 case branches
- The host has `cargo` available locally (the `cargo_source_build_fallback` precondition; if cargo is also missing, the user is on a triple-fallback path documented in iter-1 §11 UC-3)
- Network reachable for `cargo` to fetch crate dependencies from `crates.io`

**Trigger**: User runs `bash install.sh --yes` on an unsupported platform

### Primary Flow (Happy Path)

1. `install.sh` evaluates `case "$(uname -ms)"` and matches the default `*) platform="" ;;` (or equivalent unmatched case) per FR-4.1
2. With `platform` empty, the prebuilt-binary URL branch is skipped per FR-4.4 (b)
3. `install.sh` falls through to `cargo_source_build_fallback` at line 411 per FR-4.4 (BYTE-UNCHANGED from iter-1)
4. The fallback logs `host platform <uname-ms> not in prebuilt-binary allowlist; building from source via cargo`
5. `cargo install --path tools/sdlc-knowledge --locked` runs (or equivalent invocation per the existing fallback shape)
6. After ≤ 5 min wall-clock (build time on the host), the binary is placed at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`
7. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (built from source)` per FR-4.6 fallback case (UNCHANGED from iter-1)

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists, returns `sdlc-knowledge 0.2.0` per `--version`
- The fallback path was invoked; install summary reflects `(built from source)` not `<platform> prebuilt`
- The iter-1 contract is preserved byte-for-byte per FR-4.4 / AC-6

**Mapped FR**: FR-4.4
**Mapped ACs**: AC-6

### Alternative Flows

- **UC-10-A1: Cargo also missing** — the fallback fails per iter-1 contract; `install.sh` exits with a clear error per §11 UC-3

### Edge Cases

- **UC-10-EC1: `uname -ms` returns a value with leading/trailing whitespace or unexpected characters** — the bash `case` matching is byte-precise; an unexpected shape falls through the default branch and triggers cargo fallback. **Expected behavior**: graceful — even malformed `uname -ms` output leads to fallback, never to an unhandled exit.

### Data Requirements

- **Input**: Unsupported `uname -ms` value; cargo available; network reachable
- **Output**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` built from source
- **Side Effects**: `cargo build` runs (≤ 5 min); install summary `(built from source)`

---

## UC-11: `install.sh` When GH Releases Unreachable — Falls Back to Cargo Build

**Actor**: `install.sh` user, `install.sh` script

**Preconditions**:
- Common preconditions hold
- Host runs ANY of the five supported platforms (this UC is platform-agnostic)
- Network is partially or fully unavailable: `https://github.com/...` returns timeout, DNS error, or HTTP 404/500
- `cargo` is available locally; `crates.io` IS reachable (only `github.com` is blocked, e.g., behind a corporate firewall that allows `crates.io` but blocks `github.com` Releases)

**Trigger**: User runs `bash install.sh --yes`

### Primary Flow (Happy Path)

1. `install.sh` matches the platform per FR-4.1 (e.g., `linux-x64`)
2. `install.sh` constructs the asset URL per FR-4.2
3. `curl --proto '=https' --tlsv1.2 -fsSL --max-redirs 5 --max-time 120 ...` exits non-zero (timeout, DNS error, or 404)
4. Per FR-4.4 (a), the prebuilt-binary download failure triggers cargo fallback
5. `install.sh` logs `prebuilt sdlc-knowledge-v0.2.0 binary download failed (curl exit 6); falling back to cargo source-build`
6. `cargo_source_build_fallback` runs per UC-10 steps 5-7
7. Install summary: `tools/sdlc-knowledge/sdlc-knowledge (built from source)` per FR-4.6 fallback case

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists, built from source per AC-6
- The graceful-degradation contract holds: network failure on the GitHub-Releases-asset URL does NOT prevent installation, provided cargo + crates.io are reachable

**Mapped FR**: FR-4.4, R-5
**Mapped ACs**: AC-6

### Alternative Flows

(none — the cargo fallback is the universal safety net for network failures targeting `github.com/releases/`)

### Error Flows

- **UC-11-E1: Both `github.com` AND `crates.io` unreachable** — total network failure
  1. Curl fails on the asset URL
  2. Cargo fallback attempted; cargo fails to fetch `pdfium-render` and other crate deps from crates.io
  3. `install.sh` exits with a clear error: `unable to install sdlc-knowledge: prebuilt download failed AND cargo source-build failed; check network connectivity`
  4. No partial state — no half-installed binary at `~/.claude/tools/sdlc-knowledge/`

  **Mapped FR**: FR-4.4

### Data Requirements

- **Input**: Network state (asset URL unreachable; crates.io reachable); cargo available
- **Output**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` built from source
- **Side Effects**: Failed curl invocation logged; cargo build runs

---

## UC-12: Maintainer Fixes `install.sh:25` `REPO_URL` Koroqe → codefather-labs (FR-5 Backward-Compat)

**Actor**: Maintainer, `install.sh` script (both old and new versions), `install.sh` user (existing user with old script)

**Preconditions**:
- Common preconditions hold
- Pre-fix state: `install.sh:25` declares `REPO_URL="https://github.com/Koroqe/claude-code-sdlc.git"` (the bug)
- Pre-fix state: any user who ran `bash install.sh --yes` on the old script has constructed asset URLs at `https://github.com/Koroqe/claude-code-sdlc/releases/...` which 404 (the Koroqe repo does not exist)
- Pre-fix state: the cargo-source-build fallback was the silent universal path for everyone

**Trigger**: Maintainer runs Slice 5 of the iter-3 implementation, applying the FR-5 fix

### Primary Flow (Happy Path)

1. Maintainer (or `test-writer` agent in TDD slice) edits `install.sh:25` from `Koroqe` to `codefather-labs` per FR-5.1
2. `install.sh:12` Quick-install URL comment updated per FR-5.2: `curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash`
3. `grep -r 'Koroqe' .` is run from the repo root per FR-5.3; verifies ZERO matches across all files
4. README.md badges, Quick install instructions, and any other top-level documentation referencing the old GitHub owner are updated per FR-5.5; README.md taglines at lines 5 and 35 are BYTE-UNCHANGED per FR-12.4
5. `MIGRATION.md` at the repo root documents the change for users with pre-fix checkouts per FR-5.4
6. The fix is committed as part of the iter-3 implementation slice
7. After merge: new `bash install.sh --yes` invocations construct asset URLs at the correct `codefather-labs` owner
8. Existing users running the OLD install.sh continue to hit 404 + cargo fallback per FR-4.4 (the bug-compatible fallback path); `install.sh` log line for old users includes `Koroqe/claude-code-sdlc` (the old REPO_URL is still in their local copy)

**Postconditions**:
- `grep -r 'Koroqe' .` from the repo root returns zero matches per AC-9 / FR-5.3
- The Quick install URL in `install.sh:12` resolves to a real `raw.githubusercontent.com` path returning HTTP 200 per AC-9
- The install summary on new install runs references `codefather-labs/claude-code-sdlc` consistently per AC-9
- README.md taglines at lines 5 and 35 are BYTE-UNCHANGED per FR-12.4 / AC-13

**Mapped FR**: FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-4.4 (for old-user fallback), FR-12.4
**Mapped ACs**: AC-9, AC-13

### Alternative Flows

- **UC-12-A1: User has a fork or local checkout with the old REPO_URL** — per FR-5.4 backward-compat note
  1. User has cloned the repo before the FR-5 fix shipped; their local `install.sh:25` still says `Koroqe`
  2. User runs `bash install.sh --yes` from their local copy
  3. Curl fails on `https://github.com/Koroqe/claude-code-sdlc/releases/download/sdlc-knowledge-v0.2.0/sdlc-knowledge-...` with 404
  4. `install.sh` falls through to cargo source-build per FR-4.4 (a); install completes via cargo
  5. User experience is degraded (cargo build vs fast prebuilt binary download) but functional
  6. `MIGRATION.md` instructs the user to `git pull` the latest `install.sh` to restore prebuilt path

  **Mapped FR**: FR-5.4, FR-4.4

### Error Flows

(none — the FR-5 fix itself is a deterministic edit; failure modes are user-side stale-checkout issues handled by FR-4.4 fallback)

### Edge Cases

- **UC-12-EC1: A hidden file references `Koroqe` (e.g., `.github/CODEOWNERS`, `tools/sdlc-knowledge/RELEASING.md`)** — FR-5.3's mandate `grep -r 'Koroqe' .` MUST return zero matches across ALL files including hidden ones (the `-r` flag traverses dotfiles)
  1. Slice 5 runs `grep -r 'Koroqe' .` and finds a stale reference in (e.g.) `tools/sdlc-knowledge/RELEASING.md`
  2. The implementer fixes the stale reference
  3. Re-runs grep; verifies zero matches
  4. AC-9 contract is satisfied

  **Mapped FR**: FR-5.3, AC-9

### Data Requirements

- **Input**: Pre-fix `install.sh:25`, `install.sh:12`, README.md, any other files; current owner string `codefather-labs`
- **Output**: Post-fix `install.sh:25` = `https://github.com/codefather-labs/claude-code-sdlc.git`; `install.sh:12` updated; README.md updated (taglines preserved); `MIGRATION.md` created
- **Side Effects**: `grep -r 'Koroqe' .` returns empty (load-bearing for AC-9)

---

## UC-13: Multilingual Project — Russian-Language CHANGELOG → Tag Annotation in Russian → GH Release Body in Russian (UTF-8 Byte-Perfect Roundtrip)

**Actor**: Downstream Developer (multilingual project), `release-engineer` agent, `git tag -a -F` plumbing, `softprops/action-gh-release@v2`

**Preconditions**:
- Common preconditions hold
- Downstream project has `.claude/rules/auto-release.md` opted-in
- The project's `.claude/rules/changelog.md` (or the project's locale convention) authorizes Russian-language CHANGELOG entries
- `CHANGELOG.md` `[Unreleased]` contains entries authored in Russian, e.g.:
  ```
  ## [Unreleased]

  ### Добавлено
  - Поддержка автоматического выпуска релизов
  - Кросс-платформенная сборка (5 платформ)

  ### Исправлено
  - Опечатка в URL репозитория
  ```
- The host environment uses UTF-8 locale (`LANG=en_US.UTF-8` or similar)
- `git` is configured to read commit/tag messages as UTF-8 (default on modern git ≥ 2.0)

**Trigger**: Developer runs `/merge-ready` from the project root; orchestrator dispatches Gate 9

### Primary Flow (Happy Path)

1. `release-engineer` reads `CHANGELOG.md` byte-by-byte (no re-encoding) per NFR-7
2. **Trivial-tier**: agent renames `[Unreleased]` → `[X.Y.Z] - 2026-04-25`; the rename operation preserves the Russian Cyrillic content byte-for-byte (only the heading literal changes; no content re-encoding)
3. **Trivial-tier**: agent writes `.claude/release-notes-X.Y.Z.md` containing the body of the freshly renamed `[X.Y.Z]` section verbatim per FR-2.1; the Russian Cyrillic UTF-8 byte sequences are written byte-for-byte without re-encoding
4. **Moderate-tier with prompts**: version-source bump, commit, local tag — Developer approves
5. The annotated tag created via `git tag -a vX.Y.Z -F .claude/release-notes-X.Y.Z.md` per FR-2.2 reads the file as UTF-8 bytes verbatim per the `git-tag(1) -F <file>` contract; the tag annotation contains the Cyrillic content byte-for-byte
6. **Sensitive-tier with prompts**: `git push origin vX.Y.Z` — Developer approves; tag pushes to remote
7. The GH Actions release workflow fires; `softprops/action-gh-release@v2` consumes `body_path: .claude/release-notes-X.Y.Z.md` per FR-2.3
8. The GitHub Release page body matches the source Cyrillic bytes verbatim (verified via `gh release view <tag> --json body --jq .body | od -c | grep -A 1 'D0 94'` showing the `Д` byte pair `D0 94` round-tripped)

**Postconditions**:
- The annotated tag's message contains the source Russian Cyrillic bytes verbatim per AC-12
- The GitHub Release body matches the tag annotation byte-for-byte per NFR-7 / NFR-8
- `gh release view <tag> --json body --jq .body` returns the source Cyrillic bytes per AC-12
- `od -c` of the round-tripped content matches `od -c` of the source CHANGELOG section (modulo trailing-newline normalization)

**Mapped FR**: FR-2.1, FR-2.2, FR-2.3, NFR-7, NFR-8
**Mapped ACs**: AC-12

### Alternative Flows

- **UC-13-A1: Other non-ASCII scripts (CJK, Arabic, Hebrew)** — same UTF-8 byte-preservation contract applies
  1. CHANGELOG section contains (e.g.) Japanese: `### 追加\n- 自動リリースのサポート`
  2. Same flow; UTF-8 bytes round-trip through release-notes file → tag annotation → GH Release body
  3. Verified via `gh release view <tag> --json body --jq .body | grep '追加'` returning a match

  **Mapped FR**: NFR-7

### Error Flows

- **UC-13-E1: Mixed-language CHANGELOG (some entries in Russian, some in English)** — release-engineer copies verbatim into release body (no translation, just UTF-8 preservation)
  1. CHANGELOG `[Unreleased]` contains:
     ```
     ### Added
     - Support for automatic releases
     ### Добавлено
     - Кросс-платформенная сборка
     ```
  2. Agent rewrites verbatim; the resulting release-notes file contains both English and Russian sections byte-identically
  3. Tag annotation and GH Release body match byte-for-byte
  4. NO translation step occurs — UTF-8 byte preservation is the explicit contract per 13.7 item 4 (CHANGELOG i18n / auto-translation OUT OF SCOPE)

  **Mapped FR**: NFR-7, 13.7 item 4 (translation OOS)

### Edge Cases

- **UC-13-EC1: Locale mismatch — host is `LANG=C` (POSIX locale)** — `git tag -a -F <file>` still reads the file as bytes per `git-tag(1)`; the locale only affects display, not storage
  1. Host runs in POSIX locale; the file `.claude/release-notes-X.Y.Z.md` contains Cyrillic UTF-8 bytes
  2. `git tag -a -F` reads the bytes verbatim into the tag object
  3. Display via `git show <tag>` may show garbled characters (locale display issue, not storage corruption)
  4. The remote tag-object content is byte-identical to the file; `gh release view <tag>` (which displays via UTF-8) shows the correct Cyrillic
  5. AC-12 contract holds (storage byte-perfect; display is locale-dependent)

  **Mapped FR**: NFR-7

### Data Requirements

- **Input**: Russian-language CHANGELOG entries (UTF-8 bytes); UTF-8 host locale (or `LANG=C` per UC-13-EC1)
- **Output**: Release-notes file with UTF-8 Cyrillic bytes; tag annotation with same bytes; GH Release page body with same bytes
- **Side Effects**: NO translation; NO re-encoding; the entire pipeline is byte-pass-through

---

## UC-14: Tier-Based Authority — Sensitive Operation Halts and Prompts (`git push origin main`)

**Actor**: Maintainer, `release-engineer` agent

**Preconditions**:
- Common preconditions hold
- `.claude/rules/auto-release.md` is opted in
- `AUTO_RELEASE` is UNSET (interactive mode)
- The project's release flow happens to call `git push origin main` (e.g., a project that releases by pushing the main branch directly with the version tag)

**Trigger**: Agent reaches the FR-1.2 row 12 operation `git push origin main`

### Primary Flow (Happy Path — Approved)

1. The agent has computed its FR-1.2 row 12 sequence: `git push origin main` is the Sensitive-tier operation about to run
2. The FR-1.3 anchored-regex whitelist validates the literal command. Note: FR-1.3 (e) is `^git push origin (feat|fix|chore)/[a-z0-9-]+$` which does NOT match `git push origin main`. The whitelist for direct-to-default-branch push is row 12 of FR-1.2 (Sensitive-tier; explicit approval) — the agent matches it via the FR-1.2 tier table classification, not via FR-1.3 regex (the regex set is the OUTER allowlist; the tier table is the INNER classifier)
3. The agent emits the FR-1.5 prompt:
   ```
   [Sensitive — release-engineer] About to execute: git push origin main
     Tier rationale: Direct-to-default-branch push; explicit user approval; refused under headless mode (FR-1.2 row 12)
     Reversibility: non-reversible without remote support (the push lands a commit on the default branch)
   Approve? [y/N]:
   ```
4. Maintainer responds with literal lowercase `y` followed by newline
5. The agent invokes `Bash` with the verbatim command `git push origin main`; push succeeds
6. Tier breakdown reports `1 Sensitive (auto-approved)` for this operation (or N depending on aggregate run)

**Postconditions**:
- The remote `main` branch has the new commit; `git ls-remote origin main` returns the new SHA
- The Sensitive-tier prompt was emitted with the FR-1.5 byte-stable shape (grep-able for Plan Critic)
- The Tier breakdown line includes the auto-approved count

**Mapped FR**: FR-1.2 (row 12), FR-1.4, FR-1.5
**Mapped ACs**: AC-11

### Alternative Flows

(none — the prompt-and-approve path is deterministic; deny path is UC-14-E1)

### Error Flows

- **UC-14-E1: User declines the Sensitive operation**
  1. Steps 1-3 of UC-14 primary flow proceed
  2. Maintainer responds with `n`, empty newline, `N`, or any string other than literal lowercase `y` + newline
  3. The agent treats the response as DENY per FR-1.5
  4. The agent reports `aborted-sensitive: git push origin main` per FR-1.4 (mirrors `aborted-headless-sensitive` literal but for interactive denial; the literal label is `aborted-sensitive` per the resource-architect iter-2 enum extension cited in the user's task description)
  5. The push is SKIPPED; local state is preserved (any prior local tag/commit remains)
  6. Tier breakdown reports `1 Sensitive (skipped)` for this operation
  7. The structured summary's `Warnings` section records the user-declined operation
  8. Exit 0 (interactive deny is not an error per FR-1.5 deny semantics)

  **Mapped FR**: FR-1.4, FR-1.5
  **Mapped ACs**: AC-11

### Edge Cases

- **UC-14-EC1: User responds with `Y` (uppercase)** — per FR-1.5, ONLY literal lowercase `y` + newline is APPROVE; anything else (including `Y`, `yes`, `Yes`, `YES`) is DENY
  1. Maintainer responds `Y\n`
  2. Agent treats as DENY (the spec is byte-strict)
  3. Operation skipped; same path as UC-14-E1

  **Mapped FR**: FR-1.5

### Data Requirements

- **Input**: User TTY input (literal `y\n` to approve, anything else to deny); FR-1.2 row 12 operation context
- **Output**: Either the remote push lands (approve path) OR the local state is preserved (deny path); `Tier breakdown` line; `Warnings` section
- **Side Effects**: Either remote `main` branch updated OR no-op

---

## UC-15: Forbidden Tier Blocks `npm publish` / `cargo publish` / `gh release create` (Out of Scope iter-3)

**Actor**: Maintainer or unintended user, `release-engineer` agent

**Preconditions**:
- Common preconditions hold
- The activation sentinel is present (executing-mode enabled)
- Some upstream prompt or future iter-4 spec accidentally instructs the agent to invoke `npm publish` (or `cargo publish` / `gem push` / `pypi upload` / `twine upload`) OR `gh release create` directly

**Trigger**: Agent's planning step proposes an FR-1.2 row 9 / row 10 / row 11 operation

### Primary Flow (Happy Path — Refused)

1. Agent's tier-classification step inspects the proposed command against the FR-1.2 12-row table
2. The proposed command matches row 9 (`gh release create`), row 10 (`npm publish` / `cargo publish` / `gem push` / `pypi upload` / `twine upload`), or row 11 (force-push variants `git push --force` / `git push -f` / `git push +<ref>`)
3. The most-restrictive-applicable-tier rule per `resource-architect.md:222` classifies the operation as Forbidden
4. The agent REFUSES the operation unconditionally per FR-1.4 (Forbidden refusal is independent of headless state)
5. The agent emits the literal stderr line `aborted-forbidden: <operation> never executed` per FR-1.4
6. The structured summary's `Warnings` section records the refused operation; the `Tier breakdown` line includes `1 Forbidden (refused)`
7. The agent points the user toward iter-4 scope per 13.7 item 1: `Note: registry publishing (npm/cargo/PyPI/gem) is OUT OF SCOPE for iter-3; future iter-4 PRD section may lift specific publishers into a Sensitive-tier flow with credential management`
8. Exit 0 (the refusal is by-design, not an error; the rest of the pipeline can continue if other operations remain)

**Postconditions**:
- NO `npm publish` / `cargo publish` / `gh release create` invocation occurred (verified by inspecting registry: package version is unchanged at `npm view <package> versions`)
- The literal stderr line `aborted-forbidden: ...` was emitted (grep-able)
- `Tier breakdown` reports `<N> Forbidden (refused)` per AC-11
- The user is informed of the iter-4 deferral path

**Mapped FR**: FR-1.2 (rows 9-11), FR-1.4 (Forbidden), FR-1.7 (NEVER List shrinkage), 13.7 item 1
**Mapped ACs**: AC-11

### Alternative Flows

(none — Forbidden refusal is unconditional; there is no approval path for iter-3)

### Error Flows

- **UC-15-E1: Forbidden command obfuscated to evade detection** (e.g., `bash -c 'cargo publish'` or `eval "cargo publish"`)
  1. The proposed command contains shell metacharacters (`bash -c`, `eval`, `;`, `&&`, etc.)
  2. The FR-1.3 anchored-regex whitelist REFUSES any command containing shell metacharacters unconditionally per FR-1.3 final paragraph
  3. The literal stderr line `error: command not in release-engineer whitelist: <command>` is emitted
  4. The run aborts; no Bash invocation occurs
  5. This is a defense-in-depth gate that prevents Forbidden operations from being smuggled past the tier classifier

  **Mapped FR**: FR-1.3 (anchored-regex + metacharacter rejection)

### Edge Cases

- **UC-15-EC1: User attempts to manually approve a Forbidden operation** — there is no approval path; user input is ignored
  1. The agent presents no prompt for Forbidden operations (FR-1.5 prompt format applies to Sensitive-tier only)
  2. Even if the user types `y\n` somewhere in the conversation, the agent has no slot for Forbidden approval
  3. Refusal is structural per FR-1.4

  **Mapped FR**: FR-1.4 (Forbidden)

### Data Requirements

- **Input**: A proposed command matching FR-1.2 row 9 / 10 / 11
- **Output**: Literal stderr `aborted-forbidden: ...`; `Tier breakdown` Forbidden count
- **Side Effects**: NONE (no remote mutation; no registry mutation; no GH API call)

---

## UC-16: Backward Compat — Project With No `.claude/rules/auto-release.md` Receives §6 Suggest-Only Behavior Byte-for-Byte

**Actor**: Downstream Developer (project NOT opted into auto-release), `release-engineer` agent

**Preconditions**:
- Common preconditions hold
- Downstream project does NOT have `.claude/rules/auto-release.md` (the FR-7.3 sentinel is ABSENT)
- Project may or may not have `.claude/rules/changelog.md` (independent feature; not gating auto-release)
- `CHANGELOG.md` exists with `[Unreleased]` content (otherwise nothing for §6 to do anyway)

**Trigger**: Developer runs `/merge-ready`; orchestrator dispatches Gate 9

### Primary Flow (Happy Path — Suggest-Only)

1. `release-engineer` reads `.claude/rules/auto-release.md` per FR-9.4; detects ABSENCE
2. Agent falls back to byte-identical §6 suggest-only behavior per NFR-3 / FR-9.4
3. Agent does NOT invoke `Bash` (even though `Bash` is in its `tools:` frontmatter per FR-1.1; the agent self-restricts in suggest-only mode)
4. Agent computes version bump per §6 FR-2 (informationally, not as an executed action)
5. Agent emits the §6 structured 10-section summary:
   - `Detected version source`
   - `Computed version bump`
   - `CHANGELOG rewrite preview`
   - `Release-notes file preview`
   - `Workflow-file provision plan`
   - `Commands to run` (the user copies-and-pastes these manually)
   - `Warnings`
   - `Risks`
   - `Open Questions`
   - `Verification checklist`
6. There is NO `Tier breakdown` section in suggest-only output (the section is added only in executing-mode per FR-1.8)
7. NO file mutations; NO commit; NO tag; NO push

**Postconditions**:
- The structured 10-section summary is byte-identical to a §6 reference run on the same `[Unreleased]` content (excluding timestamps) per AC-8
- NO mutations to working tree, no commits, no tags, no remote operations
- Verified via `diff <(release-engineer-pre-iter3-baseline.txt) <(current-run-output.txt)` returning empty (modulo timestamp lines)

**Mapped FR**: FR-7.3, FR-9.4, NFR-3
**Mapped ACs**: AC-8

### Alternative Flows

- **UC-16-A1: Project has `.claude/rules/changelog.md` but NOT `.claude/rules/auto-release.md`** — auto-release stays opt-out; changelog-writer behavior is independent (the changelog rule activates only the changelog-writer agent, not the release-engineer agent)
  1. Same flow as UC-16 primary; `release-engineer` falls back to §6 suggest-only
  2. The presence of `.claude/rules/changelog.md` does NOT activate executing-mode

  **Mapped FR**: FR-7.3, FR-9.4

### Error Flows

(none — the suggest-only path is deterministic; the §6 contract is well-defined)

### Edge Cases

- **UC-16-EC1: `.claude/rules/auto-release.md` exists but is byte-corrupted (zero-byte or missing required content)** — the activation sentinel is the FILE EXISTENCE, not its content per FR-9.4 / Section 3 precedent
  1. The empty file at `.claude/rules/auto-release.md` activates executing-mode per the sentinel-existence rule
  2. The agent attempts executing-mode operations; if the rule file's content is needed at runtime (FR-7.2 specifies the rule's contents), the agent may fail with a clear error
  3. **Recommendation**: code-reviewer at merge-ready pass should grep the `.claude/rules/auto-release.md` file for FR-7.2 mandated sections (FR-1.2 tier table, FR-1.3 whitelist, FR-1.4 headless contract, FR-1.5 prompt format) and warn if missing

  **Mapped FR**: FR-7.3, FR-9.4

### Data Requirements

- **Input**: Absence of `.claude/rules/auto-release.md`; `[Unreleased]` content
- **Output**: Structured 10-section summary identical to §6 baseline (modulo timestamp)
- **Side Effects**: NONE — pure suggest-only output

---

## UC-17: Concurrent `/merge-ready` in Two Repo Clones — Tag Collision Detection and Recovery

**Actor**: Two Downstream Developers (or one Developer in two clones), `release-engineer` agent (×2 instances)

**Preconditions**:
- Common preconditions hold
- Two clones of the same downstream project, both with `.claude/rules/auto-release.md` opted-in
- Both clones have IDENTICAL `[Unreleased]` content at the time `/merge-ready` is invoked
- Both clones compute the same next version (e.g., `1.5.0` from `1.4.2 + Added entries`)
- Both Developers approve the Sensitive-tier prompts in their respective interactive sessions
- The two `git push origin v1.5.0` invocations occur within seconds of each other (true race condition)

**Trigger**: Both Developers run `/merge-ready` simultaneously

### Primary Flow (Happy Path — First Clone Wins, Second Detects Collision)

1. Clone-A: `release-engineer` proceeds through Trivial → Moderate → pre-push validation → Sensitive `git push origin <branch>` → Sensitive `git push origin v1.5.0`
2. Clone-A's tag push lands at remote first (race winner); workflow `release.yml` fires
3. Clone-B: `release-engineer` proceeds through the same sequence; reaches the Sensitive `git push origin v1.5.0`
4. Clone-B's `release-engineer` runs a pre-push dry-run: `git ls-remote --tags origin v1.5.0` returns a non-empty result (Clone-A's push has landed)
5. Clone-B's agent detects the collision; emits stderr message `tag collision: v1.5.0 already exists at remote (likely concurrent /merge-ready run); skipping push`
6. Clone-B's agent does NOT invoke `git push origin v1.5.0` (Sensitive-tier deny semantics applied to a detected race condition)
7. Clone-B's local tag is preserved per FR-8.2 reversibility note
8. Clone-B's structured summary's `Warnings` records the collision; `Tier breakdown` reports `1 Sensitive (skipped)` for the tag push
9. Clone-B exits 0 with a clear escalation hint per UC-17-E1

**Postconditions**:
- ONE remote tag `v1.5.0` exists at `origin` (Clone-A's), one workflow run was triggered
- Clone-A's pipeline succeeded; Clone-A's GitHub Release exists
- Clone-B's local tag exists but is unpushed; Clone-B's working tree is clean
- The race condition is detected and handled gracefully without producing two conflicting Release pages

**Mapped FR**: R-6
**Mapped ACs**: (no direct AC; behavioral race-condition recovery)

### Alternative Flows

- **UC-17-A1: Both pushes attempted without dry-run check** — second push fails atomically per git's tag-collision contract
  1. Both clones reach the Sensitive `git push origin v1.5.0` simultaneously
  2. One push lands; the other returns `! [rejected] (already exists)` per the standard git semantics
  3. The losing clone's `release-engineer` parses the non-zero exit; emits the same stderr message as UC-17 step 5
  4. Same recovery path

  **Mapped FR**: R-6

### Error Flows

- **UC-17-E1: Tag collision after retry — escalate to user with specific resolution path**
  1. Clone-B detects the collision per UC-17 primary
  2. Clone-B emits the literal recovery hint:
     ```
     Tag collision detected: v1.5.0 already exists at remote.
     This is likely a concurrent /merge-ready run.
     Resolution:
       1. git fetch origin --tags
       2. git tag -d v1.5.0      # delete local tag
       3. Re-run /merge-ready    # the next version will be computed from the current [Unreleased] state
     If [Unreleased] is now empty (Clone-A consumed it), Gate 9 will SKIP per §6 FR-7.2.
     ```
  3. Clone-B exits 0; Developer follows the resolution path

  **Mapped FR**: R-6

### Edge Cases

- **UC-17-EC1: Both clones have DIVERGED `[Unreleased]` content** — they would compute different version bumps; collision is impossible
  1. Clone-A has `[Unreleased]` with `Added` entries → bumps to `1.5.0`
  2. Clone-B has `[Unreleased]` with `Removed` entries → bumps to `2.0.0`
  3. Both pushes succeed (different tag values); two separate Releases exist
  4. This is NOT a race condition; it is a legitimate parallel-development pattern

  **Mapped FR**: (none; legitimate behavior)

### Data Requirements

- **Input**: Two clones with identical `[Unreleased]` content; near-simultaneous `/merge-ready` invocations
- **Output**: One landed tag (winner); one preserved-local tag (loser)
- **Side Effects**: One workflow run; one GH Release; loser's local state preserved for retry

---

## Cross-Cutting Use Cases

## UC-CC-1: Tier-Based Authority Dispatch Matches resource-architect iter-2 Contract Verbatim

**Actor**: `release-engineer` agent (under tier-dispatch test invocation)

**Preconditions**:
- Common preconditions hold
- The `release-engineer.md` rewrite per FR-1 is complete
- A test fixture `tests/fixtures/tier-dispatch-cases.json` enumerates representative operations covering all 12 FR-1.2 rows plus boundary cases (most-restrictive-applicable, metacharacter rejection, headless deny, Forbidden refusal)
- A reference `resource-architect.md:185-260` capture exists for byte-for-byte comparison of the tier-dispatch contract shape

**Trigger**: Slice 1 / Slice 2 of iter-3 (release-engineer rewrite + tier-dispatch unit tests)

### Primary Flow (Happy Path)

1. The release-engineer's tier-dispatch logic is exercised against each of 12 FR-1.2 rows; classifications match the table verbatim
2. The most-restrictive-applicable-tier rule is exercised: an operation matching multiple rows is classified as the most-restrictive (e.g., a hypothetical operation that matches both Moderate row 5 and Sensitive row 7 → classified Sensitive)
3. The FR-1.3 anchored-regex whitelist is exercised: each of 8 regexes accepts a positive sample and rejects a negative sample (including metacharacter-injection attempts)
4. The FR-1.4 headless contract is exercised under both `AUTO_RELEASE` unset (Sensitive prompts shown) and `AUTO_RELEASE=1` (Sensitive refused with `aborted-headless-sensitive`)
5. A side-by-side diff against `resource-architect.md:185-260` shows the same most-restrictive-applicable-tier rule, the same anchored-regex whitelist pattern, the same headless-contract semantics — only the tier table ROWS differ (release operations vs dependency operations) per Assumption #1
6. Plan Critic enforcement (per NFR-4 / §7 FR-2.5) flags malformed tier strings as MAJOR; verified by emitting an artificially malformed `Tier breakdown` line in a fixture and observing the Plan Critic catch

**Postconditions**:
- Tier dispatch behavior is contract-equivalent to resource-architect iter-2 per NFR-4
- The tier-dispatch unit tests in `tests/release-engineer/tier-dispatch.test.ts` (or equivalent test file) PASS
- The Plan Critic regex for `Tier breakdown` matches both the resource-architect's `Resource breakdown` and the release-engineer's `Tier breakdown`

**Mapped FR**: FR-1.2, FR-1.3, FR-1.4, NFR-4
**Mapped ACs**: AC-11

### Data Requirements

- **Input**: Test fixtures (12 row cases + boundary cases); reference `resource-architect.md:185-260` capture
- **Output**: Test pass/fail; Plan Critic regex validation
- **Side Effects**: NONE (test invocation only)

---

## UC-CC-2: Multilingual CHANGELOG Roundtrip — UTF-8 Preserved End-to-End

**Actor**: `release-engineer` agent, `git tag -a -F` plumbing, `softprops/action-gh-release@v2`

**Preconditions**:
- Common preconditions hold
- A test fixture CHANGELOG with non-ASCII content (Russian Cyrillic, Japanese kana/kanji, Arabic RTL, mixed) exists
- Host environment is UTF-8 locale

**Trigger**: Slice 7 / Slice 8 of iter-3 (multilingual round-trip integration test)

### Primary Flow (Happy Path)

1. The release-engineer reads the CHANGELOG; renames `[Unreleased]` byte-for-byte preserving non-ASCII
2. The release-notes file is written byte-identically
3. The annotated tag is created via `git tag -a -F <file>`; the tag-object content matches the file byte-for-byte (verified by `git cat-file tag <name> | tail -n +N`)
4. The tag is pushed; the GH Actions workflow consumes `body_path:` and the action publishes the Release page
5. The Release page body retrieved via `gh release view <tag> --json body --jq .body` matches the source bytes byte-for-byte (verified via `od -c` comparison)
6. NO translation occurs at any step (per 13.7 item 4 OOS)
7. NO re-encoding occurs at any step (per NFR-7)

**Postconditions**:
- Source CHANGELOG bytes ≡ release-notes file bytes ≡ tag-object body bytes ≡ GH Release page body bytes (modulo trailing-newline normalization)

**Mapped FR**: FR-2.1, FR-2.2, FR-2.3, NFR-7, NFR-8
**Mapped ACs**: AC-12

### Data Requirements

- **Input**: Multilingual CHANGELOG fixture; UTF-8 locale
- **Output**: Round-trip-validated byte-identical content at each pipeline stage
- **Side Effects**: One test tag pushed and Release published; cleaned up after test (the test scaffolding deletes the tag and Release post-verification)

---

## UC-CC-3: Cross-Platform Install Matrix — 5 Platforms (Windows Added)

**Actor**: GitHub Actions runner (per-platform), `install.sh` script

**Preconditions**:
- Common preconditions hold
- The five-platform matrix at `sdlc-knowledge-release.yml:64-75` is in effect per FR-3.1
- The FIRST `sdlc-knowledge-v0.2.0` tag has been cut per UC-1; six assets (5 binaries + source tarball) exist on the Release page

**Trigger**: A maintenance test that exercises `bash install.sh --yes` on all five platforms

### Primary Flow (Happy Path)

1. On `macos-14` (darwin-arm64): UC-5 happy path completes
2. On `macos-13` (darwin-x64): UC-8 happy path completes
3. On `ubuntu-latest` (linux-x64): UC-6 happy path completes
4. On `ubuntu-22.04-arm` (linux-arm64): UC-7 happy path completes
5. On `windows-latest` (windows-x64): UC-9 happy path completes
6. All five `~/.claude/tools/sdlc-knowledge/sdlc-knowledge(.exe)` binaries return `sdlc-knowledge 0.2.0` from `--version`
7. Install summary on each runner references the correct platform per FR-4.6
8. Total wall-clock for the five matrix runs (parallel) is ≤ 15 min per NFR-5

**Postconditions**:
- All five platforms install the prebuilt binary in ≤ 60 s each per AC-5 / NFR-2
- The Windows binary is ≤ 12 MB per NFR-6; the four other binaries are ≤ 10 MB per inherited §11 NFR
- The 17-agent / 10-gate / 5-executor invariants hold across all platforms (per FR-12.1 / FR-12.2 / FR-12.3)

**Mapped FR**: FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5, FR-3.6, FR-3.7, FR-4.1, FR-4.6, NFR-5, NFR-6
**Mapped ACs**: AC-4, AC-5

### Data Requirements

- **Input**: Five GH Actions runners; FIRST tag with 6 assets
- **Output**: Five working binaries, each platform-specific
- **Side Effects**: Five install runs across the matrix

---

## UC-CC-4: Invariants — 17 Agents UNCHANGED, 10 Gates UNCHANGED, 5 Executors UNCHANGED, README Taglines UNCHANGED

**Actor**: Plan Critic, code-reviewer agent (verifying invariants at merge-ready Gate 8)

**Preconditions**:
- Common preconditions hold
- The iter-3 implementation is at the merge-ready stage; all slices have committed; the working tree is clean
- A pre-iter3 baseline of `src/agents/*.md` and README.md is captured as `<commit-hash-before-iter3>` for `git diff` comparison

**Trigger**: Plan Critic / code-reviewer pass at merge-ready Gate 8

### Primary Flow (Happy Path)

1. `ls src/agents/*.md | wc -l` returns `17` per FR-12.1 / AC-13
2. `grep -Fxc "10 quality gates" README.md` returns ≥ `1` per FR-12.2 / AC-13
3. `diff <(git show <pre-iter3-hash>:src/agents/test-writer.md) <(cat src/agents/test-writer.md)` returns empty (`test-writer.md` BYTE-UNCHANGED per FR-12.3)
4. Same for `build-runner.md`, `e2e-runner.md`, `doc-updater.md`, `changelog-writer.md` — all five executor agents BYTE-UNCHANGED per FR-12.3 / AC-13
5. `diff <(git show <pre-iter3-hash>:README.md | sed -n '5p;35p') <(sed -n '5p;35p' README.md)` returns empty (taglines BYTE-UNCHANGED per FR-12.4 / AC-13)
6. The cognitive-self-check rule `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED per FR-12.6
7. The 16 non-release-engineer agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`) are BYTE-UNCHANGED per FR-12.1
8. Only `release-engineer.md` is REWRITTEN per FR-1; its frontmatter `name:` field is BYTE-UNCHANGED (only the body and `tools:` line change)

**Postconditions**:
- All FR-12 invariants hold; AC-13 verifies via the diffs above
- Plan Critic / code-reviewer pass succeeds; Gate 8 PASSES

**Mapped FR**: FR-12.1, FR-12.2, FR-12.3, FR-12.4, FR-12.6, FR-12.7
**Mapped ACs**: AC-13

### Data Requirements

- **Input**: Pre-iter3 commit hash (baseline); current main branch
- **Output**: Diff-empty results for the listed invariants; Plan Critic PASS
- **Side Effects**: NONE (read-only verification)

---

## UC-CC-5: SDLC Core Dogfooding — `.claude/rules/changelog.md` ADDED, `CHANGELOG.md` ADDED, Templates Invariant Relaxed Intentionally

**Actor**: Maintainer (slice author), code-reviewer at merge-ready Gate 8

**Preconditions**:
- Common preconditions hold
- The iter-3 implementation has shipped FR-7.1 (`.claude/rules/changelog.md` created), FR-7.2 (`.claude/rules/auto-release.md` created), FR-7.3 (`templates/rules/auto-release.md` created), FR-7.4 (`CHANGELOG.md` created), FR-8.5 (`templates/hooks/pre-push` created)
- The pre-iter3 baseline did NOT contain `.claude/rules/changelog.md`, `.claude/rules/auto-release.md`, `templates/rules/auto-release.md`, `templates/hooks/pre-push`, or `CHANGELOG.md`

**Trigger**: code-reviewer at merge-ready Gate 8 verifying FR-7 / FR-12.5 / FR-12.8

### Primary Flow (Happy Path)

1. `test -f .claude/rules/changelog.md` returns 0 (file exists); content matches `templates/rules/changelog.md` byte-for-byte per FR-7.1 (verified via `diff`)
2. `test -f .claude/rules/auto-release.md` returns 0 (file exists); content codifies FR-1.2 tier table + FR-1.3 anchored-regex whitelist + FR-1.4 headless contract + FR-1.5 prompt format per FR-7.2 (verified via grep for the key section headings)
3. `test -f templates/rules/auto-release.md` returns 0; content is byte-identical to `.claude/rules/auto-release.md` per FR-7.3 (verified via `diff`)
4. `test -f templates/hooks/pre-push` returns 0; content is the thin wrapper over project's typecheck/test/lint per FR-8.5
5. `test -f CHANGELOG.md` returns 0 at the SDLC core repo root per FR-7.4 / FR-12.8
6. `grep -F '## [Unreleased]' CHANGELOG.md` returns ≥ 1 match
7. `grep -F '## [3.0.0] - 2026-04-26 — Auto-Release Pipeline' CHANGELOG.md` returns ≥ 1 match per AC-10
8. The `[3.0.0]` body summarizes FR-1 through FR-12 in user-facing language consistent with `templates/rules/changelog.md` audience rules (line 5: product owners and end users) per AC-10
9. The Plan Critic does NOT flag `templates/rules/auto-release.md` or `templates/hooks/pre-push` as new-files-violating-templates-invariant; the FR-12.5 explicit relaxation statement is the dispositive source per R-9
10. The Plan Critic does NOT flag the new `CHANGELOG.md` as a files-not-listed-in-affected-files gap per FR-12.8 (the file is enumerated explicitly in 13.8 New Files table)

**Postconditions**:
- All five new files exist with correct content
- AC-10 holds: CHANGELOG.md presence + dated section + user-facing body
- The `templates/` invariant relaxation is intentional and accepted by Plan Critic per R-9

**Mapped FR**: FR-7.1, FR-7.2, FR-7.3, FR-7.4, FR-8.5, FR-12.5, FR-12.8
**Mapped ACs**: AC-10

### Data Requirements

- **Input**: Iter-3 working tree post-implementation; `templates/rules/changelog.md` content for byte-comparison
- **Output**: All file-existence + content-match checks PASS
- **Side Effects**: NONE (read-only verification)

---

## UC-CC-6: Backward Compat — Opt-Out Byte-for-Byte Preservation (Downstream Project Without Sentinel Has Zero Behavioral Change)

**Actor**: Downstream Developer (any project NOT opted into auto-release), `release-engineer` agent

**Preconditions**:
- Common preconditions hold
- A downstream project that has NOT created `.claude/rules/auto-release.md` (e.g., a project from before iter-3 shipped, or a project that explicitly chose not to opt in)
- A pre-iter3 captured `release-engineer` Gate 9 output for the SAME `[Unreleased]` content (the §6 baseline)

**Trigger**: Downstream Developer runs `/merge-ready` on the downstream project

### Primary Flow (Happy Path — Byte-Identical to §6)

1. `release-engineer` detects sentinel ABSENCE per FR-9.4
2. Agent falls back to byte-identical §6 suggest-only behavior per NFR-3
3. Agent emits the §6 structured 10-section summary with NO `Tier breakdown` section, NO Bash invocation, NO mutation
4. The output is captured as `current-run-output.txt`
5. `diff <(grep -v '^Date:' baseline.txt) <(grep -v '^Date:' current-run-output.txt)` returns EMPTY (modulo timestamp lines per AC-8 explicit caveat)
6. AC-8 contract holds verbatim

**Postconditions**:
- The diff against the §6 baseline is empty (excluding timestamp)
- AC-8 byte-identical-to-§6 contract holds across the entire population of opt-out projects
- The headline backward-compat invariant of iter-3 is preserved

**Mapped FR**: FR-7.3, FR-9.4, NFR-3
**Mapped ACs**: AC-8

### Data Requirements

- **Input**: Captured §6 baseline output; current run output from a non-opted-in project
- **Output**: Empty diff (excluding timestamp)
- **Side Effects**: NONE — the entire UC is read-only verification

---

## Facts

### Verified facts

- The PRD Section 13 spans `docs/PRD.md` lines 2974-3459 — verified by `grep -n '^### 13\.'` in this session showing 13.1-13.8 subsections at lines 2983, 3016, 3028, 3243, 3263, 3291, 3325, 3347; the section header is at line 2974 and the `## Facts` block at line 3405 ends at line 3459.
- PRD §13 contains 8 subsections (13.1 through 13.8) plus the trailing `## Facts` block — verified by Read in this session.
- The 12 functional requirement groups (FR-1 through FR-12), 9 non-functional requirements (NFR-1 through NFR-9), 13 acceptance criteria (AC-1 through AC-13), 10 risks (R-1 through R-10), and 6 dependencies are at PRD §13.3-§13.6 lines 3028-3323 — verified by Read in this session.
- The FR-1.2 12-row tier table maps each release operation to one of `Trivial | Moderate | Sensitive | Forbidden` and is at PRD lines 3038-3052 — verified by Read in this session.
- The FR-1.3 anchored-regex whitelist contains exactly 8 regexes (a-h) and is at PRD line 3055 — verified by Read in this session.
- The FR-1.4 headless contract literal `aborted-headless-sensitive: <operation> requires interactive approval; rerun without AUTO_RELEASE=1` is at PRD line 3060; the Forbidden literal `aborted-forbidden: <operation> never executed` is at PRD line 3061 — verified by Read in this session.
- The FR-1.5 Sensitive prompt format with five literal lines (`[Sensitive — release-engineer] About to execute: <verbatim-command>` / `Tier rationale:` / `Reversibility:` / `Approve? [y/N]:`) is at PRD lines 3066-3071 — verified by Read in this session.
- The FR-3.1 five-platform matrix entry `platform: windows-x64`, `runs-on: windows-latest`, `target: x86_64-pc-windows-msvc` is at PRD line 3096; the four existing entries are BYTE-UNCHANGED per the same FR — verified by Read in this session.
- The FR-4.1 fifth case branch literal `"MINGW64_NT-* x86_64") platform="windows-x64" ;;` is at PRD line 3114 — verified by Read in this session.
- The FR-5.1 REPO_URL fix from `https://github.com/Koroqe/claude-code-sdlc.git` to `https://github.com/codefather-labs/claude-code-sdlc.git` at `install.sh:25` is at PRD line 3130 — verified by Read in this session.
- The FR-6.4 bootstrap warning literal `[BOOTSTRAP] this is a one-time first-release operation; subsequent releases use /merge-ready Gate 9 with release-engineer in executing mode (FR-1)` is at PRD line 3150 — verified by Read in this session.
- The FR-6.5 bootstrap prompt literal `[BOOTSTRAP] About to execute: git push origin sdlc-knowledge-v<X.Y.Z> — this fires the GH Actions release workflow at .github/workflows/sdlc-knowledge-release.yml. Approve? [y/N]:` is at PRD line 3152 — verified by Read in this session.
- The FR-7.5 SDLC core MAJOR bump from `VERSION="2.1.0"` to `VERSION="3.0.0"` and the `print_help` heredoc update to `Claude Code SDLC Installer v3.0.0` are at PRD line 3166 — verified by Read in this session.
- The FR-8.3 pre-push validation literal log line `pre-push validation skipped: no Commands block in ./CLAUDE.md` is at PRD line 3178 — verified by Read in this session.
- The FR-9.3 contract that headless mode MUST NOT auto-detect `CI=true` / `GITHUB_ACTIONS=true` / `GITLAB_CI=true` and is gated explicitly by `AUTO_RELEASE=1` only is at PRD line 3192 — verified by Read in this session.
- The FR-11.4 GitHub Actions tag-filter glob disjointness contract (`sdlc-knowledge-v*` does not match `v*`; `v*` is a literal-prefix glob) is at PRD line 3219 — verified by Read in this session.
- The FR-12.5 INTENTIONAL templates-invariant RELAXATION (adds `templates/rules/auto-release.md` and `templates/hooks/pre-push`) is at PRD line 3235 — verified by Read in this session.
- The FR-12.8 INTENTIONAL new file `CHANGELOG.md` at the repo root is at PRD line 3241 — verified by Read in this session.
- The NFR-2 ≤ 60 s prebuilt-binary download budget on each of the five supported platforms (windows-x64 included) is at PRD line 3247 — verified by Read in this session.
- The NFR-5 ≤ 15 min cross-platform CI matrix wall-clock budget is at PRD line 3253 — verified by Read in this session.
- The NFR-6 Windows binary size budget ≤ 12 MB (LOOSER than the 10 MB Linux/macOS budget) is at PRD line 3255 — verified by Read in this session.
- The AC-7 headless contract checklist (a) local artifacts created, (b) NO `git push`, (c) literal `aborted-headless-sensitive: ...`, (d) exit 0, (e) Tier breakdown line is at PRD line 3277 — verified by Read in this session.
- The AC-11 Tier breakdown line literal format `1 Trivial; 2 Moderate; 2 Sensitive (auto-approved); 0 Sensitive (skipped); 0 Forbidden (refused)` is at PRD line 3285 — verified by Read in this session.
- The AC-12 multilingual round-trip test fixture `### Добавлено\n- Поддержка автоматического выпуска релизов` is at PRD line 3287 — verified by Read in this session.
- The AC-13 invariants check (`ls src/agents/*.md | wc -l` returns 17, `grep -Fxc "10 quality gates" README.md` returns ≥ 1, executor-agents diff empty, README taglines lines 5 and 35 BYTE-UNCHANGED) is at PRD line 3289 — verified by Read in this session.
- The R-6 tag-collision risk and mitigation (atomic `git push origin <tag>` failure semantics + `concurrency:` group + bump-version-and-retry recovery) is at PRD line 3303 — verified by Read in this session.
- The 13.7 OOS list contains 8 deferrals (npm/cargo/PyPI/gem registry publishing, sha256 sigstore signature verification, additional platforms FreeBSD/musl/linux-arm32, CHANGELOG i18n, auto-revert, GH Releases rich rendering, gate coupling, pre-push hook on opt-out projects) — verified by Read of lines 3325-3345 in this session.
- The 13.8 New Files table enumerates 9 new files (`.claude/rules/auto-release.md`, `.claude/rules/changelog.md`, `templates/rules/auto-release.md`, `templates/hooks/pre-push`, `CHANGELOG.md`, `.claude/release-notes-3.0.0.md`, `.claude/release-notes-0.2.0.md`, `.github/workflows/sdlc-core-release.yml`, `MIGRATION.md`) — verified by Read of lines 3363-3373 in this session.
- The format precedent files are `docs/use-cases/local-knowledge-base_use_cases.md` (110152 bytes) and `docs/use-cases/pdfium-pdf-extraction_use_cases.md` (87912 bytes, 1203 lines) — verified by `ls -la` and `wc -l` in this session.
- This is a NEW use-case file (CREATE, not UPDATE) — verified via `ls /Users/aleksandra/Documents/claude-code-sdlc/docs/use-cases/` in this session: 11 existing files cover prior features (changelog-release-packaging, cognitive-self-check, execution-waves, local-knowledge-base, pdfium-pdf-extraction, pipeline-hardening, product-changelog, resource-architect, resource-architect-auto-install, role-planner, role-planner-reuse-teardown); none cover the iter-3 auto-release pipeline domain.
- Knowledge-base status at task start: `doc_count: 28`, `chunk_count: 51542`, `db_path: /Users/aleksandra/Documents/claude-code-sdlc/.claude/knowledge/index.db` — verified via `sdlc-knowledge status --json` in this session.
- The knowledge base contains BOTH English and Russian content — verified via `sdlc-knowledge list --json` in this session showing 18 English-titled PDFs (e.g., `Practical MLOps`, `Building AI Agents With LLMs RAG`, `Hands-On Machine Learning with Pytorch`) and 10 Russian-titled PDFs (e.g., `Бейер_Б_,_Джоунс_К_,_Петофф_Д_,_Мёрфи_Н_Site_Reliability_Engineering.pdf`, `Скотт_Д_,_Гамов_В_,_Клейн_Д_Kafka_в_действии_2022.pdf`, `Хаос_инжиниринг_2021_Кейси_Розенталь,_Нора_Джонс.pdf`, `841031560_Современная_программная_инженерия_2023.pdf`).

### External contracts

- **`softprops/action-gh-release@v2` GitHub Action** — symbol: `inputs.tag_name`, `inputs.body_path`, `inputs.files`, `inputs.fail_on_unmatched_files`, `inputs.draft`, `inputs.prerelease` — source: PRD §13 `## Facts → ### External contracts` entry at PRD line 3427 (which cites `.github/workflows/sdlc-knowledge-release.yml:201-213` consumed in the existing iter-1 / iter-2 release workflow) — verified: yes (PRD-cite chain). Risk: action upgrade `@v2 → @v3` could change `inputs.body_path` semantics; iter-3 pins `@v2` per FR-2.3 / FR-11.2 unchanged from §11.
- **GitHub Actions runner image `windows-latest`** — symbol: runner-label string used in `runs-on:` field; preinstalls Visual Studio 2022 Build Tools (`cl.exe`), Git for Windows (`git`, `bash`, `curl`, `tar`, `find`) — source: PRD §13 `## Facts` block at PRD line 3428 — verified: **no — assumption** (inherited from PRD where it was already labeled `verified: no — assumption`). Risk: GitHub-managed-runner-image tooling could change between releases; verification path is architect Step 3 + Slice 4 first Windows matrix run.
- **Cargo cross-compile target `x86_64-pc-windows-msvc`** — symbol: rustup target name; requires MSVC linker (`link.exe`); produces `.exe` suffix on output binaries — source: PRD §13 `## Facts` block at PRD line 3429 — verified: **no — assumption** (inherited from PRD). Risk: target name precision (MSVC vs GNU variant); the MSVC variant is correct for `windows-latest` per industry convention; verification path is Slice 4 done-condition + architect Step 3.
- **`bblanchon/pdfium-binaries` Windows asset filename `pdfium-win-x64.tgz`** — symbol: asset filename in GitHub Releases for the `chromium/<version>` tag scheme — source: PRD §13 `## Facts` block at PRD line 3430 — verified: **no — assumption** (inherited from PRD). Risk: actual asset name could differ (`pdfium-windows-x64.tgz` or `pdfium-win-x64.zip`); verification path is architect Step 3 opens the GitHub Releases page for `chromium/7802` and pins the exact filename + format before Slice 4 ships.
- **Windows DLL naming convention `pdfium.dll` (no `lib` prefix)** — symbol: filename of the dynamic library on Windows differs from `libpdfium.dylib` (macOS) and `libpdfium.so` (Linux) — source: PRD §13 `## Facts` block at PRD line 3431 — verified: **no — assumption** (inherited from PRD). Risk: the `find -name 'libpdfium*'` glob in `sdlc-knowledge-release.yml:115` may MISS Windows `pdfium.dll`; FR-3.3 explicitly widens the glob; verification path is Slice 4 first Windows matrix run.
- **`uname -ms` shape on Git Bash for Windows runners** — symbol: typically `MINGW64_NT-10.0-22631 x86_64` or similar — source: PRD §13 `## Facts` block at PRD line 3432 — verified: **no — assumption** (inherited from PRD). Risk: actual shape on `windows-latest` runner could differ; verification path is architect Step 3 runs `uname -ms` on a Windows runner before Slice 4 ships.
- **`git tag -a -F <file>` UTF-8 byte-preservation** — symbol: `git-tag(1)` `-F <file>` flag reads message file verbatim as UTF-8 bytes — source: PRD §13 `## Facts` block at PRD line 3433 — verified: **no — assumption** (well-documented industry contract; inherited from PRD). Risk: locale-dependent re-encoding on rare systems; verification path is AC-12 multilingual round-trip test exercises Cyrillic content end-to-end.
- **GitHub Actions tag-filter glob semantics** — symbol: `on.push.tags` accepts glob patterns where `*` matches any character sequence; `sdlc-knowledge-v*` is a literal-prefix glob that does NOT match plain `v*` — source: PRD §13 `## Facts` block at PRD line 3434 — verified: **no — assumption** (inherited from PRD; heavily relied on by iter-1 release workflow). Risk: tag-filter cross-firing; FR-11.4 documents disjointness; verification path is Slice 8 dual-tag run.
- **`git archive --format=tar.gz --prefix=<name>/ -o <file> HEAD`** — symbol: `git-archive(1)` flags producing a deterministic source tarball — source: PRD §13 `## Facts` block at PRD line 3435 — verified: **no — assumption** (standard git plumbing; inherited from PRD).
- **`resource-architect.md:185-260` four-tier authority gradation** — symbol: `Trivial | Moderate | Sensitive | Forbidden` with most-restrictive-applicable-tier rule (line 222) and 18-row decision table (lines 201-220) — source: PRD §13 `## Facts → ### Verified facts` entry at PRD line 3416 — verified: yes (PRD-cite chain via `grep -n "Trivial\|Moderate\|Sensitive\|Forbidden" src/agents/resource-architect.md` in PRD authoring session).
- **`templates/rules/changelog.md:37-39` activation sentinel rule** — symbol: literal text "the presence of this file at `.claude/rules/changelog.md` is the sole signal the `changelog-writer` agent uses to decide whether to run; absence equals opt-out" — source: PRD §13 `## Facts` block at PRD line 3417 — verified: yes (PRD-cite chain via Read of the entire 43-line file in PRD authoring session).
- **`.github/workflows/sdlc-knowledge-release.yml`** — symbol: tag trigger `tags: 'sdlc-knowledge-v*'` at lines 13-16; four-platform matrix at lines 64-75; `Determine pdfium asset name` step at lines 91-101; `Download pdfium dynamic library` step at lines 103-116; `softprops/action-gh-release@v2` at line 202; `files:` list at lines 208-213 — source: PRD §13 `## Facts` block at PRD lines 3418-3420 — verified: yes (PRD-cite chain via Read of the entire 213-line file in PRD authoring session).
- **`install.sh` line references** — symbol: `:22` VERSION declaration, `:23` KNOWLEDGE_VERSION, `:24` KNOWLEDGE_PDFIUM_VERSION, `:25` REPO_URL, `:332-406` install_knowledge_binary, `:354-363` platform case, `:368` asset URL, `:411-442` cargo_source_build_fallback, `:447-484` register_bash_allowlist, `:489-613` install_pdfium_binary — source: PRD §13 `## Facts` block at PRD lines 3410-3413 — verified: yes (PRD-cite chain via Read in PRD authoring session).
- **`src/agents/release-engineer.md:67-84`** — symbol: 13-line NEVER List in fenced code block enumerating `git push`, `git push origin <anything>`, `git tag`, `git tag -a vX.Y.Z`, `gh release create`, `npm publish`, `yarn publish`, `pnpm publish`, `cargo publish`, `pypi upload`, `twine upload`, `poetry publish`, `gem push` — source: PRD §13 `## Facts` block at PRD line 3415 — verified: yes (PRD-cite chain via Read in PRD authoring session).
- **`knowledge-base` CLI for §13 use-case authoring** — symbol: `sdlc-knowledge status --json`, `sdlc-knowledge list --json`, `sdlc-knowledge search "<query>" --top-k 5 --json` — source: live invocation in this session per the multilingual knowledge-base mandate at `~/.claude/rules/knowledge-base-tool.md` — verified: yes. Multilingual-mandate compliance: status returned 28 docs / 51542 chunks; English probe `continuous deployment release pipeline` returned 0 hits; English probe `semantic versioning major minor patch` returned 0 hits; English probe `GitHub release tag workflow` returned 0 hits; English probe `rollback release strategy canary` returned 0 hits; English probe `cross-platform binary distribution prebuilt` returned 0 hits; English probe `release engineering pipeline tag push` returned 0 hits; English probe `blue green canary deployment` returned 5 hits in `Practical MLOps` (chunks 534, 1875, 1865) and `dokumen_pub_building_applications_with_ai_agents_designing_and_implementing.pdf` (chunks 9186, 9181); Russian probe `тегирование релиз непрерывная интеграция` returned 0 hits; Russian probe `автоматизация развертывание откат` returned 1 hit in `Бейер_Б_,_Джоунс_К_,_Петофф_Д_,_Мёрфи_Н_Site_Reliability_Engineering.pdf` (chunk 36938 — the SRE book on rollback automation); Russian probe `непрерывная интеграция автоматизация` returned 0 hits; Russian probe `канареечный релиз` returned 0 hits; Russian probe `версионирование релиза` returned 0 hits. Two load-bearing citations follow because they specifically informed the UC-CC-1 / R-6 design (canary/blue-green as deployment-strategy precedent and SRE rollback automation as the underlying release-safety pattern):
- knowledge-base: Practical MLOps_ Operationalizing Machine Learning Models.pdf:534 — query: "blue green canary deployment" — BM25: 30.156734883545273 — verified: yes
- knowledge-base: Бейер_Б_,_Джоунс_К_,_Петофф_Д_,_Мёрфи_Н_Site_Reliability_Engineering.pdf:36938 — query: "автоматизация развертывание откат" — BM25: 21.733548455318264 — verified: yes

### Assumptions

- **The four-tier authority gradation lifted from `resource-architect.md` is a clean fit for release operations.** Risk: the `resource-architect` tier table targets dependency / MCP / cloud-credential operations; release operations (`git tag`, `git push`, `gh release`) have different blast-radii. The most-restrictive-applicable-tier rule is the same; only the row set differs. How to verify: architect Step 3 reviews the FR-1.2 12-row table against `resource-architect.md:201-220` 18-row table and reconciles classification logic before Slice 1 ships. (Inherited from PRD §13 `## Facts → ### Assumptions`.)
- **`AUTO_RELEASE=1` is the right env-var name (not `RELEASE_HEADLESS=1` or `CI_RELEASE=1`).** Risk: low — the name is local to this section and consistent with §7 FR-5.5's `AUTO_INSTALL=1`. How to verify: architect Step 3 grep-confirms the §7 env-var name and aligns FR-1.4 accordingly. (Inherited from PRD §13.)
- **The bootstrap one-shot `bash install.sh --bootstrap-release 0.2.0` is acceptable as a dedicated install.sh code path rather than a separate script (`bootstrap_release.sh`).** Risk: install.sh becomes a kitchen-sink utility. How to verify: architect Step 3 picks one approach with cited rationale; FR-6 documents the choice. (Inherited from PRD §13.)
- **Pre-existing `install.sh` cleanup of `Koroqe` is contained — no other scripts in the repo hardcode the value.** Risk: README, `tools/sdlc-knowledge/RELEASING.md`, or hidden CI files could reference the old owner. How to verify: FR-5.3 mandates `grep -r 'Koroqe' .` returning zero matches before Slice 5 done-condition.
- **The CHANGELOG `[3.0.0]` body for the SDLC core's first release is authored manually in the bootstrap step.** Risk: a hand-authored stub may drift from the FR-1 through FR-12 list. How to verify: AC-10 verifies presence and date-stamp; the body content is checked manually by the maintainer at Slice 9 done-condition.
- **The byte-strict approval semantics of FR-1.5 (only literal lowercase `y` + newline approves; `Y`, `yes`, `Yes`, `YES` all DENY) are retained verbatim from the resource-architect iter-2 contract.** Risk: usability friction if users expect "yes" to work. How to verify: Slice 1 test fixture includes a `Y\n` input case asserting DENY semantics; architect Step 3 confirms with resource-architect cross-reference.
- **The `aborted-sensitive` literal label (used in UC-14-E1) is the resource-architect iter-2 enum extension referenced in the user task description; it complements the `aborted-headless-sensitive` literal from FR-1.4.** Risk: if the resource-architect iter-2 enum has slightly different wording (`aborted-sensitive` vs `sensitive-denied` vs other), the release-engineer's interactive-deny stderr line may need to align verbatim. How to verify: architect Step 3 opens `src/agents/resource-architect.md` and confirms the enum literal.
- **The `concurrency:` group difference between `sdlc-knowledge-release.yml` (`sdlc-knowledge-release-${{ github.ref }}`) and `sdlc-core-release.yml` (`sdlc-core-release-${{ github.ref }}`) successfully prevents cross-cancellation per FR-11.3.** Risk: GitHub Actions concurrency-group semantics could differ from the assumption (e.g., empty group treated as no concurrency control). How to verify: Slice 8 test exercises a tool release and a core release in the same time window and verifies both complete.
- **The pre-push validation (FR-8.1) running typecheck + unit-test + lint (NOT E2E) per the `## Commands` block in `./CLAUDE.md` is sufficient defense for the Sensitive `git push` operations.** Risk: the project's `## Commands` block could omit a critical command (e.g., security scan). How to verify: code-reviewer at merge-ready Gate 8 audits the project's `## Commands` block for completeness; security-auditor reviews for sensitive-tier blast-radius.
- **The `templates/` invariant relaxation per FR-12.5 does not break any downstream consumer that grep's the templates dir for a fixed file count.** Risk: a downstream project's pre-existing CI step `[ "$(ls templates/ | wc -l)" -eq <prev-count> ]` would fail. How to verify: not load-bearing — `templates/` is a one-way scaffold; downstream consumers do not import the templates programmatically. Documented in PRD §13 R-9.
- **The list of pre-existing use-case files in `docs/use-cases/` was enumerated via `ls` in this session — no existing file covers the auto-release-pipeline domain, confirming this is a CREATE (not UPDATE).** Risk: a future overlap could emerge if a separate "release-engineering" feature lands. How to verify: any future feature touching auto-release reads this file first per the user-task convention.

### Open questions

- **Knowledge-base topical searches on most release-engineering concepts returned ZERO hits across the 28-book corpus.** Per the multilingual knowledge-base mandate this is a documented negative result. The English MLOps and AI-Agents books cover blue-green/canary deployment patterns generically; the Russian SRE book (Beyer/Jones/Petoff/Murphy) covers rollback automation; NEITHER side directly covers `git tag` / `gh release create` / `softprops/action-gh-release` / SemVer / CHANGELOG semantics. Action: consider adding a release-engineering reference (e.g., the `git-tag(1)` manpage, the GitHub Actions release-management docs, the Keep a Changelog spec, the SemVer spec) to the `<project>/.claude/knowledge/sources/` corpus if iter-4 work continues. No action required for iter-3 — the source-of-truth is the existing release-engineer agent prompt, the existing workflow file, and the resource-architect tier-model precedent.
- **Open Question #1 — Frontmatter `tools:` of `release-engineer.md` already includes `Bash`?** The PRD §13 `## Facts → ### Verified facts` (PRD line 3414) notes a documented frontmatter-vs-body contract drift: `release-engineer.md:4` was Read showing `tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]` but the prompt body at lines 12, 16, 30, and 63 contradicts this with "no Bash tool" claims and "via tool removal" enforcement claims. RESOLUTION: architect Step 3 verifies the actual frontmatter byte content in the working tree before Slice 1 ships. If `Bash` is already present, FR-1.1 is a documentation accuracy fix; if absent, FR-1.1 adds it. Either path satisfies the FR contract.
- **Open Question #2 — Exact `bblanchon/pdfium-binaries` Windows asset filename and archive format.** Could be `pdfium-win-x64.tgz`, `pdfium-windows-x64.tgz`, or `pdfium-win-x64.zip`. RESOLUTION: architect Step 3 opens the GitHub Releases page for `chromium/7802` and pins the exact filename and format before Slice 4 ships. If ZIP, FR-3.3's `tar -xzf` invocation widens to a format-detection branch.
- **Open Question #3 — `softprops/action-gh-release@v2` `body_path:` field accepts a release-notes file outside the workflow's checkout dir?** RESOLVED in PRD: `body_path:` is relative to the GH Actions workspace; the file `.claude/release-notes-<X.Y.Z>.md` is committed in the repo and present in the checkout, so the path resolves. FR-2.3 requires the file to be committed alongside the CHANGELOG rewrite per FR-1.2 row 5. Edge: if the tag is pushed without the release-notes file being committed, the action fails with a clear error; this is a Slice 7 done-condition.
- **Open Question #4 — sha256 / sigstore signature verification of release binaries.** RESOLVED — DEFERRED to iter-4 per PRD §13.7 item 2 (mirrors §11 iter-1 / §12 iter-2 deferrals).
- **Open Question #5 — Auto-publish to npm/cargo/PyPI.** RESOLVED — OUT OF SCOPE per PRD §13.7 item 1 (Forbidden tier in iter-3). Future iter-4 PRD section may lift specific publishers (e.g., `cargo publish` for the `sdlc-knowledge` crate) into a Sensitive-tier flow with credential management.
- **Open Question #6 — Whether to backfill historical CHANGELOG sections for SDLC core Features 1-12.** RESOLVED — start clean from `[3.0.0]` per PRD §13 R-4; backfill is deferred to iter-4 if requested.
- **Open Question #7 — Auto-revert on regression detection.** RESOLVED — OUT OF SCOPE per PRD §13.7 item 5; manual mitigation per R-8 (maintainer cuts patch release).
- **Open Question #8 — Git Bash `uname -ms` exact shape on `windows-latest` runner.** RESOLUTION: architect Step 3 runs `uname -ms` on a Windows runner before Slice 4 ships; FR-4.1 case pattern is widened to a glob if needed (e.g., `*NT-* x86_64`).
