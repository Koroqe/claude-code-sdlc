# Use Cases: Local Knowledge Base for SDLC Agents

> Based on [PRD](../PRD.md) — Section 11: Local Knowledge Base for SDLC Agents

This document is the blueprint for E2E and integration testing of the Local Knowledge Base feature introduced in PRD Section 11. The feature is meta-SDLC infrastructure: a Rust CLI binary (`sdlc-knowledge`) shipped globally under `~/.claude/tools/sdlc-knowledge/` plus per-project data under `<project>/.claude/knowledge/`, queried by the 12 in-scope thinking agents BEFORE authoring domain-bearing content. There is NO new agent and NO new `/merge-ready` gate in iter-1. The "actors" in every use case below are the developer (human user), the `install.sh` script, the `sdlc-knowledge` CLI binary, the 12 thinking agents themselves, and the `/knowledge-ingest` slash command.

Every use case below is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`, `UC-CC-N`) are referenced by QA test cases and E2E tests.

**Common preconditions across all use cases** (stated once here, referenced as "common preconditions" below):

- The SDLC repo at `claude-code-sdlc` ships exactly 17 agent prompts under `src/agents/` and exactly 6 commands under `src/commands/` (was 5 before this feature; `knowledge-ingest` is the 6th per FR-6.4 / AC-12)
- The 12 in-scope thinking-agent prompt files (`src/agents/{prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, code-reviewer, verifier, refactor-cleaner, resource-architect, role-planner, release-engineer}.md`) each contain a `## Knowledge Base (when present)` section appended at the end per FR-5.1 / FR-5.3
- The 5 exempt executor agent prompt files (`src/agents/{test-writer, build-runner, e2e-runner, doc-updater, changelog-writer}.md`) are byte-unchanged per FR-5.4 / FR-12.3
- The rule file `src/rules/knowledge-base.md` exists and is distributed to `~/.claude/rules/knowledge-base.md` by the existing `src/rules/*` copy logic in `install.sh` per FR-7.2
- The cognitive-self-check rule file `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED per FR-10.4 / FR-12.5 (the `knowledge-base:` source prefix is an additive citation convention only)
- The activation sentinel for agent behavior is the existence of the file `<project>/.claude/knowledge/index.db` per FR-10.1
- The Bash allowlist entry registered in `~/.claude/settings.json` is exactly `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` per FR-8.3 / NFR-1.9 / AC-2
- The `sdlc-knowledge` binary canonicalizes `--project-root` (resolves symlinks, normalizes `..`) and rejects paths that resolve outside the process's current working directory with exit 2 and the literal stderr message `error: project-root must resolve under current working directory` per FR-1.5 / AC-6
- Supported iter-1 platforms are darwin-arm64, darwin-x64, linux-x64, linux-arm64; Windows is OUT OF SCOPE for iter-1 per NFR-1.4 / 11.7
- Supported iter-1 input formats are Markdown (`.md`), plain text (`.txt`), and PDF (`.pdf`) per FR-2.1
- The 17-agent and 10-gate count invariants per FR-12.1 / FR-12.2 / AC-11 hold; the README taglines at lines 5 and 35 are BYTE-UNCHANGED
- All use cases below assume the maintainer has already cut the FIRST `sdlc-knowledge-v0.1.0` tag per FR-11.3 / AC-13 UNLESS the use case explicitly tests the pre-first-release fallback path

## Actors

| Actor | Description |
|-------|-------------|
| Developer | The human user running `bash install.sh`, `bash install.sh --init-project`, `/knowledge-ingest`, or invoking `/bootstrap-feature` / `/develop-feature` that internally activates the knowledge base |
| Maintainer | The project owner who cuts the first `sdlc-knowledge-v0.1.0` GitHub release tag manually per `tools/sdlc-knowledge/RELEASING.md` (FR-11.3) before the SDLC release that introduces this feature merges |
| `install.sh` script | The bootstrap script in the SDLC repo root that detects the host platform, downloads the matching binary, registers the Bash allowlist entry, scaffolds project directories, and falls back to `cargo build --release` when the release binary is unavailable (FR-8) |
| `sdlc-knowledge` CLI binary | The Rust binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge`. Exposes five subcommands (`ingest`, `search`, `list`, `status`, `delete`) plus `--version` (FR-1.2) |
| `/knowledge-ingest` slash command | The new SDLC slash command at `src/commands/knowledge-ingest.md` that runs `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest <path> --json` and streams progress (FR-6) |
| In-scope thinking agent | One of the 12 agents (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer`) whose prompt has been appended with the `## Knowledge Base (when present)` activation block per FR-5.1 |
| Exempt executor agent | One of the 5 agents (`test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer`) whose prompt is byte-unchanged per FR-5.4 / FR-12.3; does NOT query the knowledge base |
| `/bootstrap-feature` orchestrator | Runs the documentation phase; in-scope thinking agents activated within it consult the knowledge base when the activation sentinel is present |
| `/develop-feature` orchestrator | Runs full pipeline (bootstrap + slice loop + merge-ready); same agent activation rules apply |

---

## Use Case Coverage

| UC ID | Scenario | PRD FRs | PRD ACs |
|-------|----------|---------|---------|
| UC-1 | First-time install on darwin-arm64 (release binary path) | FR-8.1, FR-8.2, FR-8.3, FR-1.1 | AC-1, AC-2 |
| UC-1-E1 | Network failure during binary download → cargo fallback | FR-8.4, FR-8.5 | AC-13 |
| UC-2 | First-time install before any GitHub release exists → cargo source-build fallback | FR-8.4 | AC-13 |
| UC-3 | First-time install when neither release nor cargo available → graceful skip | FR-8.5 | AC-13 |
| UC-4 | Project scaffold extension (`bash install.sh --init-project`) | FR-8.6, FR-9.1 | AC-3 |
| UC-5 | Developer runs `/knowledge-ingest <path>` slash command on PDFs | FR-6.1, FR-6.2, FR-2.1 through FR-2.7 | AC-4 |
| UC-5-E1 | Path does not exist | FR-1.6, FR-2.6 | (gap; per-file error) |
| UC-5-E2 | Path traversal `--project-root ../../../etc` rejection | FR-1.5 | AC-6 |
| UC-5-E3 | Symlink escape outside project root rejection | FR-1.5 | AC-6 |
| UC-5-E4 | Corrupt PDF in batch → per-file error, batch continues | FR-2.6 | AC-4 |
| UC-6 | Direct shell invocation `sdlc-knowledge ingest <path>` | FR-1.2, FR-1.3 | AC-4 |
| UC-7 | `sdlc-knowledge search <query> --top-k 5 --json` BM25-ranked results | FR-3.1 through FR-3.4, FR-1.4 | AC-5 |
| UC-7-E1 | Corrupt `index.db` (truncated to 100 bytes) | FR-1.6, FR-3.1 | AC-7 |
| UC-7-E2 | Empty `index.db` (no documents ingested) | FR-3.4 | AC-5 |
| UC-7-E3 | FTS5 query syntax error → exit 1, no panic | FR-1.6 | AC-7 |
| UC-8 | `sdlc-knowledge list / status / delete` subcommands | FR-1.2, FR-1.4, FR-2.4 | (no direct AC) |
| UC-9 | Re-ingesting unchanged file → idempotent no-op | FR-2.4, FR-2.5, NFR-1.7 | AC-4 |
| UC-9-E1 | Concurrent ingest + search via WAL | FR-2.7, NFR-1.6 | (no direct AC) |
| UC-10 | Re-ingesting changed file → re-chunk + FTS5 trigger updates | FR-2.5, FR-4.2 | AC-4 |
| UC-11 | 12 thinking agents detect activation sentinel and query before authoring | FR-5.1 through FR-5.5, FR-7.1 | AC-10 |
| UC-11-E1 | Agent attempts to query but binary missing → fall back to UC-14 path | FR-5.5, FR-10.2 | AC-9 |
| UC-12 | Agent cites BM25 hits in `## Facts → ### External contracts` per cognitive-self-check format | FR-7.1, FR-7.3, FR-10.4 | AC-10 |
| UC-13 | Backward compat — without `index.db`, agents skip silently and produce identical output | FR-10.1, FR-10.3 | AC-8 |
| UC-14 | Backward compat — without binary, agents log skip line and proceed | FR-10.2, FR-5.5 | AC-9 |
| UC-15 | Bash allowlist registered idempotently in `~/.claude/settings.json` | FR-8.3, NFR-1.9 | AC-2 |
| UC-15-E1 | install.sh JSON merge preserves prior allowlist entries | FR-8.3 | AC-2 |
| UC-CC-1 | Cross-platform install verification (4 platforms) | FR-8.1, NFR-1.4, FR-11.1 | AC-1 |
| UC-CC-2 | Invariant preservation — 17 agents, 10 gates, 5 executors, README taglines | FR-12.1 through FR-12.5 | AC-11 |
| UC-CC-3 | Commands count goes from 5 to 6 | FR-6.4 | AC-12 |
| UC-CC-4 | PDF + Markdown + Plain text formats supported | FR-2.1, FR-2.2 | AC-4 |
| UC-CC-5 | First-release maintainer bootstrap (`sdlc-knowledge-v0.1.0` manual tag) | FR-11.3 | AC-13 |

---

## UC-1: First-Time Install of the Binary on a Supported Architecture (Release Binary Path)

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Common preconditions hold
- The host machine runs darwin-arm64 (Apple Silicon Mac)
- Network connectivity to `https://github.com/.../releases/...` is available
- The maintainer has already cut a `sdlc-knowledge-v0.1.0` (or newer) tag and the GitHub Actions release workflow has uploaded the four-platform binary artifacts per FR-11.1 / FR-11.2
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does NOT yet exist on the developer's machine

**Trigger**: Developer runs `bash install.sh --yes` from the SDLC repo root

### Primary Flow (Happy Path)

1. `install.sh` detects the host platform via `uname -ms` and identifies the matching release artifact (darwin-arm64) per FR-8.1
2. `install.sh` downloads the binary release artifact from the GitHub Releases page that matches the detected platform
3. `install.sh` places the binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` and applies executable mode via `chmod +x` per FR-8.2
4. `install.sh` registers exactly ONE Bash allowlist entry whose value is the literal string `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` in `~/.claude/settings.json` per FR-8.3 / NFR-1.9
5. The script proceeds with its existing config-copy logic (rule files, agent files, command files) and project-scaffolding helpers per pre-existing behavior
6. After install completes, `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exits 0 and prints a semver-shaped version string within 60 seconds total elapsed (download + chmod + verify) per AC-1
7. Re-running `bash install.sh --yes` is idempotent — when the binary at the expected version is already present, it is a no-op per FR-8.2; the allowlist merge does NOT duplicate the entry per FR-8.3

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is executable (`test -x` returns 0)
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exits 0
- `~/.claude/settings.json` contains exactly one allowlist entry matching the literal `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *`
- `install.sh`'s `VERSION` constant is unchanged in this commit per FR-8.7

**Mapped FR**: FR-8.1, FR-8.2, FR-8.3, FR-1.1, NFR-1.9
**Mapped ACs**: AC-1, AC-2

### Alternative Flows

- **UC-1-A1: Re-running install on a host with the binary already at the expected version** — Idempotent no-op per FR-8.2
  1. Developer runs `bash install.sh --yes` again on the same machine
  2. `install.sh` detects the binary at the expected version and skips download
  3. The allowlist registration step verifies the entry already exists and does NOT add a duplicate
  4. Total elapsed time is bounded by version-check + scaffold helpers, well under 60 s

  **Mapped FR**: FR-8.2, FR-8.3
  **Mapped ACs**: AC-1, AC-2

- **UC-1-A2: Install on darwin-x64 / linux-x64 / linux-arm64** — Same flow, different binary artifact
  1. `uname -ms` returns one of `Darwin x86_64` / `Linux x86_64` / `Linux aarch64`
  2. `install.sh` selects the matching artifact from GitHub Releases
  3. Remainder of flow identical to UC-1 primary

  **Mapped FR**: FR-8.1, NFR-1.4
  **Mapped ACs**: AC-1

### Error Flows

- **UC-1-E1: Network failure during binary download → cargo fallback path** — Connection refused / timeout / 404 on the release artifact URL
  1. `install.sh` attempts the download per FR-8.1 and fails (curl/wget non-zero exit)
  2. `install.sh` checks whether `cargo` is on `PATH` per FR-8.4
  3. If `cargo` IS on PATH AND a local checkout of `tools/sdlc-knowledge/` is present (e.g., the user invoked install from a cloned repo), the script runs `cargo build --release -p sdlc-knowledge` from the local checkout per FR-8.4
  4. The cargo-built artifact is copied to `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` with executable mode set
  5. The Bash allowlist registration proceeds normally
  6. Subsequent steps in UC-1 primary flow complete; the binary is functional
  7. If `cargo` is NOT on PATH, the flow degrades to UC-3 (graceful skip)

  **Mapped FR**: FR-8.4, FR-8.5
  **Mapped ACs**: AC-13

- **UC-1-E2: `chmod +x` fails (permission denied)** — Filesystem-level permission failure
  1. `install.sh` downloads the binary successfully but `chmod +x` fails
  2. `install.sh` reports the chmod failure with a clear error message
  3. The binary file is left at the target path but is non-executable
  4. The script emits a remediation hint (e.g., "run with sudo or fix permissions on `~/.claude/tools/sdlc-knowledge/`")
  5. AC-1 (`--version` exit 0 within 60 s) FAILS; the developer must fix permissions and re-run

  **Mapped FR**: FR-8.2
  **Mapped ACs**: AC-1 (negative path)

### Edge Cases

- **UC-1-EC1: Host architecture not in the four-platform matrix (e.g., FreeBSD or Windows)** — Unsupported platform
  1. `uname -ms` returns a value not matching any of the four supported tuples
  2. `install.sh` logs the literal warning `binary unavailable; install cargo or wait for first release` per FR-8.5
  3. The script continues with the rest of the install (config files, scaffolding) per FR-8.5 graceful-degradation requirement
  4. `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent; subsequent activation falls back per UC-14

  **Mapped FR**: FR-8.5, NFR-1.4
  **Mapped ACs**: AC-13 (warning path), AC-9 (downstream backward-compat)

### Data Requirements

- **Input**: Host `uname -ms` output, GitHub release artifact URL, prior `~/.claude/settings.json` content (may exist from previous install or be empty)
- **Output**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (executable), `~/.claude/settings.json` (with allowlist entry merged)
- **Side Effects**: One network download (≤10 MB per NFR-1.1), one filesystem write to the binary path, one JSON merge into `~/.claude/settings.json`. NFR-1.8 (no network at runtime) is preserved — network access is `install.sh`-only

---

## UC-2: First-Time Install When No GitHub Release Exists Yet (Cargo Source-Build Fallback)

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Common preconditions hold
- The maintainer has NOT yet cut the first `sdlc-knowledge-v0.1.0` tag (or the release has not finished publishing artifacts)
- The developer has cloned the SDLC repo locally; `tools/sdlc-knowledge/Cargo.toml` and the source crate are present in the checkout
- `cargo` is on `PATH` (verified by `command -v cargo` returning 0)
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does NOT yet exist

**Trigger**: Developer runs `bash install.sh --yes` from the cloned repo root

### Primary Flow (Happy Path)

1. `install.sh` attempts the binary download per FR-8.1; the GitHub Releases API returns 404 (no release matching `sdlc-knowledge-v*` exists yet) or returns an asset list with no matching platform artifact
2. `install.sh` invokes the `cargo_source_build_fallback` codepath per FR-8.4
3. The script runs `cargo build --release -p sdlc-knowledge` from the local checkout
4. The compiled artifact is copied from `tools/sdlc-knowledge/target/release/sdlc-knowledge` to `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` with executable mode set per FR-8.4
5. The Bash allowlist registration proceeds per FR-8.3
6. Subsequent install steps complete
7. `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exits 0; the binary is functional

**Postconditions**:
- The binary is built from source and installed at the global path
- The binary's behavior is identical to a release-binary install (same source code, same compiler flags `strip = true`, `lto = true`, `codegen-units = 1` per FR-11.2)

**Mapped FR**: FR-8.4
**Mapped ACs**: AC-13

### Alternative Flows

- **UC-2-A1: Local checkout NOT present (user ran piped `curl | bash`) but `cargo` is on PATH** — Cannot build from source without source files
  1. `install.sh` detects the script is running outside a checkout (no `tools/sdlc-knowledge/Cargo.toml` adjacent to the script)
  2. Per FR-8.5, the script logs `binary unavailable; install cargo or wait for first release` and continues without the binary
  3. Flow degrades to UC-3

  **Mapped FR**: FR-8.5
  **Mapped ACs**: AC-13

### Error Flows

- **UC-2-E1: `cargo build --release` fails (e.g., transient compiler error, missing system dependency)** — Build failure during fallback
  1. `install.sh` runs `cargo build --release -p sdlc-knowledge` and the command exits non-zero
  2. The script captures stderr and reports the failure with the cargo output appended
  3. Per FR-8.5 graceful-degradation pattern, the script does NOT abort the rest of the install; it warns and continues
  4. `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent; downstream UC-14 fallback applies

  **Mapped FR**: FR-8.4, FR-8.5
  **Mapped ACs**: AC-13

### Edge Cases

- **UC-2-EC1: Build succeeds but the artifact size exceeds NFR-1.1's 10 MB budget** — Size violation only verifiable post-build
  1. `cargo build --release` completes; the compiled artifact at `tools/sdlc-knowledge/target/release/sdlc-knowledge` is >10 MB
  2. `install.sh` does NOT enforce NFR-1.1 at install time (NFR-1.1 is a build-time CI gate per Risk #3)
  3. The binary is copied as-is; functionality is unaffected
  4. The size violation surfaces at the next CI release dry-run, not at user install

  **Mapped FR**: FR-8.4, NFR-1.1
  **Mapped ACs**: (build-time gate, not user-facing AC)

### Data Requirements

- **Input**: Local checkout containing `tools/sdlc-knowledge/Cargo.toml` and `src/`, `cargo` toolchain
- **Output**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` built from local source
- **Side Effects**: `cargo` may write to `tools/sdlc-knowledge/target/` (build artifacts, ignored by git per the existing root `.gitignore`); the global binary path is created

---

## UC-3: First-Time Install When Neither Release Binary Nor Cargo Are Available (Graceful Skip)

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Common preconditions hold
- The maintainer has NOT yet cut the first `sdlc-knowledge-v0.1.0` tag, OR the release artifact for the host platform does not exist
- `cargo` is NOT on `PATH` (`command -v cargo` returns non-zero)
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` does NOT yet exist

**Trigger**: Developer runs `bash install.sh --yes`

### Primary Flow (Happy Path)

1. `install.sh` attempts the binary download per FR-8.1 and fails (no matching release artifact)
2. `install.sh` checks for `cargo` on PATH per FR-8.4 and finds it absent
3. `install.sh` logs the literal warning `binary unavailable; install cargo or wait for first release` per FR-8.5
4. `install.sh` continues with the rest of the install (config-copy, scaffolding helpers); does NOT abort per FR-8.5 graceful-degradation requirement
5. The Bash allowlist registration step still runs (FR-8.3 idempotent merge — registering the allowlist entry for a binary that doesn't yet exist is harmless; the entry takes effect when the binary is later installed)
6. Install completes with exit 0; the developer sees the warning in the script's stdout
7. The developer can later install `cargo` and re-run, or wait for the maintainer's first release tag and re-run; UC-1 or UC-2 then succeeds

**Postconditions**:
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent
- `~/.claude/settings.json` may have the allowlist entry (idempotent — present whether or not the binary is installed); this is acceptable per FR-8.3
- All other install side-effects (rules copy, agent prompts copy, command copy) completed normally per the pre-existing install.sh behavior
- Downstream agent activation falls back per UC-14 ("knowledge-base: tool not installed; skipping")

**Mapped FR**: FR-8.5
**Mapped ACs**: AC-13

### Alternative Flows

- **UC-3-A1: Developer later installs `cargo` and re-runs `bash install.sh --yes`** — Recovery path
  1. After installing `cargo` (e.g., via `rustup`), the developer re-runs `install.sh`
  2. `install.sh` detects no binary, retries download (still 404), then invokes the cargo fallback per FR-8.4
  3. Flow now matches UC-2 primary; binary is built and installed

  **Mapped FR**: FR-8.4, FR-8.5
  **Mapped ACs**: AC-13

- **UC-3-A2: Developer waits for maintainer's first release** — Recovery path
  1. After the maintainer cuts `sdlc-knowledge-v0.1.0` per FR-11.3 / UC-CC-5, the developer re-runs `install.sh`
  2. `install.sh` detects the new release and downloads the binary per UC-1 primary

  **Mapped FR**: FR-11.3
  **Mapped ACs**: AC-13

### Error Flows

- **UC-3-E1: install.sh aborts when binary unavailable (regression of FR-8.5)** — A regression where the script exits non-zero on missing binary
  1. The script aborts mid-install; downstream config-copy steps do NOT run
  2. This violates FR-8.5; AC-13 verification fails
  3. The QA test for AC-13 catches this as a regression

  **Mapped FR**: FR-8.5
  **Mapped ACs**: AC-13 (negative path)

### Edge Cases

- **UC-3-EC1: First-release window between SDLC merge and first binary tag** — Per Risk #8
  1. The SDLC release containing this feature has merged but the maintainer has not yet cut the `sdlc-knowledge-v0.1.0` tag
  2. New users running `install.sh` hit UC-3 unless they have `cargo`
  3. Per FR-11.3 / Risk #8, the maintainer's bootstrap step is documented in `tools/sdlc-knowledge/RELEASING.md` to minimize this window
  4. After the maintainer cuts the tag, subsequent users hit UC-1

  **Mapped FR**: FR-11.3
  **Mapped ACs**: AC-13

### Data Requirements

- **Input**: Host platform info, no local checkout, no cargo
- **Output**: `install.sh` exit 0 with warning logged; binary absent
- **Side Effects**: Pre-existing config-copy still runs; the allowlist entry may or may not be registered idempotently

---

## UC-4: Project Scaffold Extension (`bash install.sh --init-project`)

**Actor**: Developer, `install.sh` script

**Preconditions**:
- Common preconditions hold
- The developer has navigated (`cd`) into a project directory; the project may or may not already have a `.claude/` subdirectory from a prior `--init-project` run
- The SDLC repo's `templates/knowledge/.gitignore` and `templates/knowledge/.gitkeep` files exist per FR-9.1
- `templates/knowledge/.gitignore` contains exactly the four lines `sources/`, `index.db`, `index.db-shm`, `index.db-wal` (one per line) per FR-9.1 / AC-3

**Trigger**: Developer runs `bash install.sh --init-project` from the project directory

### Primary Flow (Happy Path)

1. `install.sh` runs its existing project-scaffolding logic (creates `.claude/`, copies templates, creates `docs/PRD.md`, `docs/qa/`, `docs/use-cases/`)
2. Per FR-8.6, `install.sh` extends the scaffold by copying `templates/knowledge/.gitignore` to `<cwd>/.claude/knowledge/.gitignore`
3. `install.sh` creates the `<cwd>/.claude/knowledge/sources/` subdirectory containing a `.gitkeep` placeholder per FR-8.6
4. The four pre-existing template surfaces (`templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/`) are UNCHANGED by this section per FR-9.2
5. After `--init-project` completes, the developer's project tree contains:
   ```
   <project>/.claude/knowledge/
   ├── .gitignore          (byte-identical to templates/knowledge/.gitignore)
   └── sources/
       └── .gitkeep
   ```
6. `<project>/.claude/knowledge/index.db` does NOT yet exist (it is created by the first `ingest` invocation per UC-5)

**Postconditions**:
- `<cwd>/.claude/knowledge/.gitignore` exists with byte-identical content to `templates/knowledge/.gitignore` per AC-3 (verifiable via `diff <cwd>/.claude/knowledge/.gitignore templates/knowledge/.gitignore` returning empty)
- `<cwd>/.claude/knowledge/sources/` directory exists and contains `.gitkeep`
- The activation sentinel `<cwd>/.claude/knowledge/index.db` is absent (UC-13 backward-compat applies until first ingest)

**Mapped FR**: FR-8.6, FR-9.1, FR-9.2
**Mapped ACs**: AC-3

### Alternative Flows

- **UC-4-A1: Re-running `--init-project` on a project that already has `.claude/knowledge/`** — Idempotent
  1. The script detects the existing `.claude/knowledge/.gitignore` and `sources/` directory
  2. The copy step is idempotent — files are overwritten with byte-identical content from the template (or skipped if a checksum match is detected)
  3. Existing user-supplied source files in `sources/` are NOT touched
  4. Existing `index.db` (if present from a prior ingest) is NOT touched

  **Mapped FR**: FR-8.6
  **Mapped ACs**: AC-3

- **UC-4-A2: User has customized their `.claude/knowledge/.gitignore`** — User edits should not be silently clobbered
  1. The script detects the file content differs from the template
  2. Per pre-existing template-copy convention, the script may skip overwriting modified files OR overwrite them with a warning
  3. Implementation-time decision (the pre-existing scaffold helpers in `install.sh` follow the convention; this feature does not change that convention)

  **Mapped FR**: FR-8.6
  **Mapped ACs**: AC-3 (with caveat for user-modified files)

### Error Flows

- **UC-4-E1: Filesystem permission denied on `<cwd>/.claude/knowledge/`** — Cannot create or write
  1. `install.sh` attempts to create the directory or copy the file and fails with EPERM
  2. The script reports the permission error with a clear remediation hint
  3. Subsequent scaffold steps continue or abort per the pre-existing scaffold helper's behavior

  **Mapped FR**: FR-8.6
  **Mapped ACs**: AC-3 (negative path)

### Edge Cases

- **UC-4-EC1: `templates/knowledge/.gitignore` line endings (CRLF vs LF)** — Cross-platform line-ending discipline
  1. The template MUST ship with LF line endings (Unix convention) so the byte-for-byte AC-3 verification passes on all four supported platforms
  2. If the template were checked in with CRLF on Windows (out of scope per 11.7), `diff` could fail; iter-1 supports only Unix-family platforms so this is moot

  **Mapped FR**: FR-9.1
  **Mapped ACs**: AC-3

- **UC-4-EC2: User adds documents to `sources/` BEFORE `index.db` is created** — Common first-run flow
  1. Developer runs `--init-project`, then drops PDFs into `<cwd>/.claude/knowledge/sources/`
  2. No `index.db` exists yet; activation sentinel is absent; UC-13 backward-compat applies
  3. Developer then runs `/knowledge-ingest .claude/knowledge/sources` per UC-5; the binary creates `index.db` on first ingest

  **Mapped FR**: FR-8.6, FR-2.1
  **Mapped ACs**: AC-3, AC-4

### Data Requirements

- **Input**: `templates/knowledge/.gitignore` (4 lines), `templates/knowledge/.gitkeep`
- **Output**: `<cwd>/.claude/knowledge/.gitignore`, `<cwd>/.claude/knowledge/sources/.gitkeep`
- **Side Effects**: Two file writes, one directory creation. No network. No DB writes (DB is created lazily at first ingest)

---

## UC-5: Developer Runs `/knowledge-ingest <path>` Slash Command on a Folder of PDFs

**Actor**: Developer, `/knowledge-ingest` slash command, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists and is executable (UC-1 has succeeded)
- `<project>/.claude/knowledge/sources/` exists (UC-4 has succeeded) and contains one or more `.pdf`, `.md`, or `.txt` files
- The Bash allowlist entry per FR-8.3 / NFR-1.9 is registered
- The slash command file `src/commands/knowledge-ingest.md` exists per FR-6.1 and is distributed to `~/.claude/commands/knowledge-ingest.md`

**Trigger**: Developer types `/knowledge-ingest .claude/knowledge/sources` in chat

### Primary Flow (Happy Path)

1. The orchestrator parses the slash command and runs the literal Bash command `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest .claude/knowledge/sources --json` per FR-6.1
2. The binary canonicalizes `--project-root` (defaulted to `pwd`) per FR-1.3 / FR-1.5; the canonicalized path resolves under cwd; no rejection
3. The binary opens (or creates) `<project>/.claude/knowledge/index.db` per FR-4.1; SQLite WAL mode is enabled at init per FR-2.7 / NFR-1.6
4. If the schema version is below the current version, the v1 migration runs per FR-4.4
5. The binary recursively walks the input directory and processes every supported-extension file (`.md`, `.txt`, `.pdf`) per FR-2.1
6. For each file:
   a. The binary computes `sha256` and reads `mtime` per FR-2.4
   b. The binary checks the `documents` table for a row with the same `(source_path, mtime, sha256)` triple; if found, logs `unchanged: <path>` and skips per FR-2.5 (idempotent no-op — see UC-9)
   c. If new or changed, the binary extracts text per FR-2.2 (UTF-8 read for `.md`/`.txt`; PDF crate `pdf-extract` for `.pdf` per Open Question #1 default)
   d. The binary chunks the text using a sliding window of ~500 characters with ~100-character overlap per FR-2.3 (deterministic — same input → same chunks)
   e. The binary writes the rows transactionally per-document via `BEGIN IMMEDIATE` per FR-2.6 / NFR-1.7: one row in `documents`, multiple rows in `chunks`. FTS5 triggers on `chunks_fts` fire automatically per FR-4.2
7. Per FR-6.2, the slash command streams the binary's per-file JSON output to chat as ingestion progresses
8. After all files complete, the binary emits a final summary line with the total chunk count and source count per FR-6.2
9. The slash command displays the summary
10. AC-4 is satisfied: a 5 MB PDF completes in ≤60 s, writes ≥1 row to `documents`, ≥100 rows to `chunks`

**Postconditions**:
- `<project>/.claude/knowledge/index.db` exists and contains the ingested rows
- `index.db-shm` and `index.db-wal` sidecar files may also exist (managed by SQLite's WAL mode per FR-4.1)
- Re-running `/knowledge-ingest` on the same path is idempotent (UC-9)
- The activation sentinel `<project>/.claude/knowledge/index.db` is now present, enabling UC-11 / UC-12 agent activation on subsequent agent invocations

**Mapped FR**: FR-6.1, FR-6.2, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-4.1, FR-4.2, FR-4.4, NFR-1.6, NFR-1.7
**Mapped ACs**: AC-4

### Alternative Flows

- **UC-5-A1: Single-file ingest** — `<path>` is a file, not a directory
  1. Per FR-2.1, `ingest <path>` accepts either a single file or a directory
  2. The binary processes the one file; recursive walk is a no-op
  3. Same per-file flow as primary

  **Mapped FR**: FR-2.1
  **Mapped ACs**: AC-4

- **UC-5-A2: Mixed-format directory (`.md`, `.txt`, `.pdf` all present)** — Heterogeneous batch
  1. The binary processes each file with the format-appropriate reader per FR-2.2
  2. Each format produces rows in the same `documents` and `chunks` tables; FTS5 indexing is uniform across formats
  3. Final summary line totals across all formats

  **Mapped FR**: FR-2.1, FR-2.2
  **Mapped ACs**: AC-4

- **UC-5-A3: Binary absent at command invocation** — Pre-install scenario
  1. Per FR-6.3, when the binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent, the slash command reports a clear actionable message including the literal text `bash install.sh --yes` and exits without error
  2. No DB write occurs; no chat error trace

  **Mapped FR**: FR-6.3
  **Mapped ACs**: AC-9 (related backward-compat)

### Error Flows

- **UC-5-E1: User passes a path that does not exist** — `<path>` resolves to no filesystem entry
  1. The binary attempts to canonicalize the path; canonicalization fails with ENOENT
  2. The binary exits 1 with a clear stderr error of the form `error: path does not exist: <path>` (or the equivalent OS-level message captured in a typed error)
  3. No rows are written to `documents` or `chunks`; the `index.db` schema is unchanged
  4. No partial state — the binary opens `index.db` only after path validation succeeds OR opens it but performs no writes
  5. The binary MUST NOT panic — `panicked at` MUST NOT appear in stderr per FR-1.6

  **Mapped FR**: FR-1.6, FR-2.6
  **Mapped ACs**: AC-7 (no-panic invariant applies broadly to malformed input)

- **UC-5-E2: Path traversal — `--project-root ../../../etc`** — Project-root escape attempt
  1. Developer (or attacker via crafted CLI args under the allowlist scope) invokes `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest ./books --project-root ../../../etc`
  2. The binary canonicalizes `--project-root` per FR-1.5 (resolves symlinks, normalizes `..`) and detects the canonicalized path resolves OUTSIDE the process's current working directory
  3. The binary exits 2 with the literal stderr message `error: project-root must resolve under current working directory` per FR-1.5 / AC-6
  4. No filesystem read or write outside cwd occurs
  5. The Bash allowlist scope (`~/.claude/tools/sdlc-knowledge/sdlc-knowledge *`) is defense-in-depth — the binary itself enforces the project-root sandbox per NFR-1.9

  **Mapped FR**: FR-1.5
  **Mapped ACs**: AC-6

- **UC-5-E3: Symlink escape outside project root** — `--project-root <symlink-to-/etc>`
  1. Developer creates a symlink under cwd that points to `/etc`; passes the symlink as `--project-root`
  2. The binary canonicalizes the path per FR-1.5 (resolves symlinks)
  3. The canonicalized target is `/etc`, which does NOT resolve under cwd
  4. Same rejection as UC-5-E2: exit 2 with the literal message `error: project-root must resolve under current working directory`

  **Mapped FR**: FR-1.5
  **Mapped ACs**: AC-6

- **UC-5-E4: Corrupt PDF in batch — per-file error, batch continues** — Malformed input
  1. The batch contains 10 PDFs; one is truncated mid-stream
  2. The binary attempts to extract text from the corrupt PDF; the PDF crate returns an extraction error
  3. Per FR-2.6, the binary reports a clear per-file error to stderr (e.g., `error: failed to extract text from <path>: <crate-error>`) and emits a JSON error record per FR-6.2 stream
  4. The transaction for THAT document is rolled back (per-document `BEGIN IMMEDIATE` boundary per FR-2.5 / FR-2.6)
  5. The binary continues processing the remaining 9 PDFs
  6. Final summary line reports `<succeeded-count>` files ingested and `<failed-count>` files skipped
  7. The binary MUST NOT panic per FR-1.6

  **Mapped FR**: FR-2.6, FR-6.2, FR-1.6
  **Mapped ACs**: AC-4 (transactional per-document)

- **UC-5-E5: Disk space exhausted mid-ingest** — Filesystem-level failure
  1. The binary writes rows during ingest; SQLite returns SQLITE_FULL
  2. The current document's transaction is rolled back per `BEGIN IMMEDIATE` semantics
  3. The binary reports the disk-space error and exits non-zero
  4. Already-committed prior documents remain in the index (transactional per-document, NOT per-batch per FR-2.6)

  **Mapped FR**: FR-2.6
  **Mapped ACs**: AC-4 (transactional per-document)

### Edge Cases

- **UC-5-EC1: Empty directory** — `<path>` exists but contains no supported files
  1. The recursive walk finds zero `.md`/`.txt`/`.pdf` files
  2. The binary writes no rows; the summary line reports 0 files / 0 chunks
  3. Exit 0 (no-results is not an error per the FR-3.4 spirit; ingest of empty input is also not an error)

  **Mapped FR**: FR-2.1
  **Mapped ACs**: AC-4

- **UC-5-EC2: File with unsupported extension (`.docx`)** — Skipped silently
  1. The recursive walk encounters `.docx` files; per FR-2.1, only `.md`/`.txt`/`.pdf` are processed in iter-1
  2. The `.docx` is skipped without error
  3. The summary may or may not surface a "skipped: <path> (unsupported extension)" log line — implementation-time decision

  **Mapped FR**: FR-2.1
  **Mapped ACs**: AC-4

- **UC-5-EC3: Very large PDF (50 MB)** — Beyond NFR-1.3's 5 MB benchmark
  1. The binary processes the PDF; throughput scales roughly linearly per NFR-1.3
  2. Total elapsed time exceeds NFR-1.3's 60 s budget for 5 MB but is acceptable for the larger size
  3. NFR-1.3 is a benchmark for 5 MB, not a hard ceiling on total file size

  **Mapped FR**: FR-2.1, NFR-1.3
  **Mapped ACs**: AC-4 (benchmark only)

- **UC-5-EC4: Filename with spaces or non-ASCII characters** — UTF-8 path handling
  1. The binary's path handling is UTF-8 throughout (Rust strings are UTF-8 by construction)
  2. Filenames like `Risk Assessment 2026.pdf` or `финансы.md` are processed identically to ASCII filenames
  3. The `documents.source_path` column stores the UTF-8 representation

  **Mapped FR**: FR-2.2, FR-2.4
  **Mapped ACs**: AC-4

### Data Requirements

- **Input**: `<path>` (file or directory under cwd), supported-extension files therein
- **Output**: Rows in `documents` and `chunks` tables of `<project>/.claude/knowledge/index.db`; FTS5 `chunks_fts` populated via triggers
- **Side Effects**: SQLite WAL sidecar files (`index.db-shm`, `index.db-wal`) may be created/updated; chat-stream of per-file JSON progress; final summary line. Zero network calls per NFR-1.8

---

## UC-6: User Invokes `sdlc-knowledge ingest <path>` Directly via Shell

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is executable
- `<project>/.claude/knowledge/sources/` exists with at least one supported-extension file
- The developer is in a shell with `cwd` at the project root

**Trigger**: Developer runs `~/.claude/tools/sdlc-knowledge/sdlc-knowledge ingest .claude/knowledge/sources` directly (no `/knowledge-ingest` slash command, no agent involvement)

### Primary Flow (Happy Path)

1. The binary is invoked with the `ingest` subcommand and a path argument; no `--project-root` flag, so it defaults to `pwd` per FR-1.3
2. Without `--json`, the binary uses human-readable text output (default mode per FR-1.4)
3. The binary executes the same ingestion flow as UC-5 (canonicalize → open DB → walk → chunk → write transactionally per-document)
4. Per-file progress is printed as human-readable text (e.g., `ingested: <path> — <chunk-count> chunks` per file)
5. Final summary printed as `total: <source-count> sources, <chunk-count> chunks`
6. Exit 0

**Postconditions**:
- Same as UC-5 postconditions (DB populated, sentinel present)
- Output is human-readable (default), not JSON

**Mapped FR**: FR-1.2, FR-1.3, FR-1.4, FR-2.1 through FR-2.7
**Mapped ACs**: AC-4

### Alternative Flows

- **UC-6-A1: Direct invocation with `--json`** — Machine-readable output
  1. Same as primary; output is JSON per FR-1.4 / FR-3.3 (analogous shape for `ingest` per-file progress records)
  2. Useful for shell scripting / piping to `jq`

  **Mapped FR**: FR-1.4
  **Mapped ACs**: AC-4

- **UC-6-A2: Explicit `--project-root <dir>` pointing to a sibling project** — Cross-project ingest
  1. Developer invokes `sdlc-knowledge ingest ./other-project/sources --project-root ./other-project` from a parent directory
  2. The canonicalized `--project-root` resolves under cwd (it is a subdirectory); accepted
  3. The binary writes to `./other-project/.claude/knowledge/index.db` per FR-1.3
  4. Per FR-1.3, the binary NEVER touches global state outside `<project-root>/.claude/knowledge/`

  **Mapped FR**: FR-1.3, FR-1.5
  **Mapped ACs**: (no direct AC)

### Error Flows

- **UC-6-E1: Same as UC-5 error flows** — Direct invocation does not bypass any error handling
  1. UC-5-E1 (path-does-not-exist), UC-5-E2/E3 (project-root traversal), UC-5-E4 (corrupt PDF), UC-5-E5 (disk space) apply identically
  2. Direct invocation has the same FR-1.6 no-panic guarantee

  **Mapped FR**: FR-1.5, FR-1.6, FR-2.6
  **Mapped ACs**: AC-6, AC-7

### Edge Cases

- **UC-6-EC1: Direct invocation outside any project directory (`cwd` is `/tmp`)** — No `.claude/` adjacent
  1. The binary defaults `--project-root` to `/tmp` per FR-1.3
  2. The binary attempts to create `/tmp/.claude/knowledge/index.db`; this works on Unix systems where `/tmp` is writable
  3. The DB is created at `/tmp/.claude/knowledge/index.db`; the developer has effectively created a "project" at `/tmp`
  4. This is an unusual but supported flow; the binary's contract per FR-1.3 is unconditional ("ALWAYS read and write under `<project-root>/.claude/knowledge/`")

  **Mapped FR**: FR-1.3
  **Mapped ACs**: (no direct AC)

### Data Requirements

- **Input**: Same as UC-5 input
- **Output**: Same as UC-5 output; default text format unless `--json`
- **Side Effects**: Same as UC-5

---

## UC-7: Developer / Agent Invokes `sdlc-knowledge search <query> --top-k 5 --json` and Consumes BM25 Results

**Actor**: Developer (interactive use) OR in-scope thinking agent (UC-11), `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The binary is installed
- `<project>/.claude/knowledge/index.db` exists and contains at least one ingested document (UC-5 has succeeded at least once)
- The developer or agent is in a shell with `cwd` at the project root

**Trigger**: `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "credit risk hedging" --top-k 5 --json`

### Primary Flow (Happy Path)

1. The binary parses CLI args; `--top-k` is clamped to ≤100 per FR-3.2 (here: 5)
2. The binary opens `<project>/.claude/knowledge/index.db` (read-only or shared-read mode; SQLite WAL mode allows concurrent reads per NFR-1.6)
3. The binary calls `validate_schema()` per FR-1.6 / Slice 3 to confirm the index file's schema is intact; on failure, see UC-7-E1
4. The binary issues an FTS5 query: `SELECT chunks.source_path, chunks.id, chunks.ord, bm25(chunks_fts) AS score, snippet(...) FROM chunks_fts JOIN chunks ... WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts) ASC LIMIT ?` per FR-3.1
5. The binary serializes results as JSON per FR-3.3: an array where each element has the literal shape `{"source": "<source_path>", "chunk_id": <int>, "ord": <int>, "score": <float>, "snippet": "<string>"}`
6. The array length is ≤ `--top-k` per FR-3.3
7. Results are ordered by BM25 score (note: SQLite's `bm25()` returns LOWER scores for BETTER matches by convention; ordering is implementation-defined as long as best-first is preserved) — the ordering convention is documented in `src/rules/knowledge-base.md`
8. Latency ≤500 ms over a 10 000-chunk database per NFR-1.2 / AC-5
9. Exit 0

**Postconditions**:
- Stdout contains a valid JSON array of ≤5 chunks ordered best-first
- No DB writes occur (search is read-only)
- WAL mode allows other concurrent readers / a parallel ingest writer per UC-9-E1

**Mapped FR**: FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-1.4, NFR-1.2, NFR-1.6
**Mapped ACs**: AC-5

### Alternative Flows

- **UC-7-A1: Default `--top-k` (no flag specified)** — Defaults to 5 per FR-3.2
  1. Same as primary; `--top-k` defaults to 5
  2. Result array length ≤ 5

  **Mapped FR**: FR-3.2
  **Mapped ACs**: AC-5

- **UC-7-A2: Default text output (no `--json` flag)** — Human-readable
  1. The binary emits human-readable formatted text per FR-1.4: e.g., one chunk per stanza with score, source, snippet
  2. Used by developer interactive sessions

  **Mapped FR**: FR-1.4
  **Mapped ACs**: AC-5

- **UC-7-A3: `--top-k 100` (upper-bound clamp)** — Maximum allowed
  1. `--top-k 100` is accepted per FR-3.2
  2. Result array length ≤ 100

  **Mapped FR**: FR-3.2
  **Mapped ACs**: AC-5

- **UC-7-A4: `--top-k 500` (above clamp)** — Clamped to 100 per FR-3.2
  1. Per FR-3.2, the upper bound is ≤100; values above are clamped to 100
  2. Implementation-time decision: silently clamp vs reject. Per FR-3.2 wording ("MUST be clamped"), the binary clamps silently (or warns); does NOT reject

  **Mapped FR**: FR-3.2
  **Mapped ACs**: AC-5

### Error Flows

- **UC-7-E1: Corrupt `index.db` (truncated to 100 bytes)** — Schema validation fails
  1. The developer truncates `index.db` to 100 bytes (or it is corrupted by an external process)
  2. The binary opens the file and runs `validate_schema()` per FR-1.6
  3. Validation fails (file header is invalid or required tables are missing)
  4. The binary exits 1 with the literal stderr message `error: index database invalid; re-ingest required` per FR-1.6 / AC-7
  5. The binary MUST NOT panic — `panicked at` MUST NOT appear in stderr per AC-7
  6. Recovery: developer runs `/knowledge-ingest <path>` again to rebuild the index

  **Mapped FR**: FR-1.6
  **Mapped ACs**: AC-7

- **UC-7-E2: Empty `index.db` (no documents ingested yet)** — Valid but empty
  1. The binary opens the index; schema is valid but `chunks` table is empty
  2. The FTS5 MATCH query returns zero rows
  3. Per FR-3.4, the binary exits 0 with an empty JSON array `[]` (or "no results" message in default output mode)
  4. No-results is NOT an error condition per FR-3.4

  **Mapped FR**: FR-3.4
  **Mapped ACs**: AC-5

- **UC-7-E3: FTS5 query syntax error** — Special characters in query break MATCH parsing
  1. Developer runs `sdlc-knowledge search '"unbalanced quote' --top-k 5 --json`
  2. SQLite returns an FTS5 syntax error
  3. The binary catches the error and exits 1 with a clear stderr message of the form `error: invalid search query: <fts5-error>`
  4. The binary MUST NOT panic per FR-1.6

  **Mapped FR**: FR-1.6, FR-3.1
  **Mapped ACs**: AC-7 (no-panic invariant)

- **UC-7-E4: Index file absent (no ingest has run yet)** — Activation sentinel itself absent
  1. Developer runs `search` against a project where `<project>/.claude/knowledge/index.db` does not exist
  2. The binary attempts to open the file; SQLite returns "unable to open database file"
  3. The binary exits 1 with a clear message of the form `error: index not found at <path>; run sdlc-knowledge ingest <source-dir> first`
  4. Implementation-time decision: distinct from UC-7-E1 (corrupt) — absence is recoverable by ingest, corruption is recoverable only by re-ingest

  **Mapped FR**: FR-1.6
  **Mapped ACs**: AC-5 (negative path)

### Edge Cases

- **UC-7-EC1: Query with multi-word phrase** — Standard FTS5 behavior
  1. `search "credit risk hedging"` is interpreted by FTS5 as three terms (default operator)
  2. BM25 ranks chunks containing all three terms higher than chunks containing fewer
  3. Standard FTS5 behavior; no special handling

  **Mapped FR**: FR-3.1
  **Mapped ACs**: AC-5

- **UC-7-EC2: Query in non-English language** — Tokenization
  1. FTS5's default tokenizer is `unicode61` (case-folding, diacritics-stripping, Unicode-aware)
  2. Russian, Chinese, etc. tokens are matched per the tokenizer's behavior
  3. Implementation-time decision: tokenizer choice (default `unicode61` is reasonable for iter-1)

  **Mapped FR**: FR-3.1
  **Mapped ACs**: (no direct AC)

- **UC-7-EC3: Two equally-ranked chunks** — Tie-breaking
  1. BM25 score may tie; the SQL `ORDER BY` clause adds a deterministic secondary key (e.g., `chunks.id ASC`) for stable ordering
  2. Result order is reproducible across runs

  **Mapped FR**: FR-3.1
  **Mapped ACs**: AC-5

### Data Requirements

- **Input**: A non-empty `index.db`, query string, `--top-k` flag (default 5)
- **Output**: JSON array of ≤`top-k` chunks ordered by BM25 best-first (or empty array if no matches)
- **Side Effects**: None — search is read-only. WAL mode permits concurrent readers / writers. Zero network per NFR-1.8

---

## UC-8: Developer Invokes `sdlc-knowledge list / status / delete` Subcommands

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- The binary is installed
- `<project>/.claude/knowledge/index.db` exists with at least one ingested document

**Trigger**: Developer runs one of:
- `sdlc-knowledge list --json`
- `sdlc-knowledge status --json`
- `sdlc-knowledge delete <source-id>`

### Primary Flow (Happy Path) — `list`

1. The binary opens `index.db` read-only and runs `validate_schema()`
2. Per Slice 3 done-condition, the binary queries the `documents` table and emits a JSON array of records `{source_path, chunk_count, ingested_at}`, one element per document
3. Exit 0

### Primary Flow (Happy Path) — `status`

1. The binary opens `index.db` read-only and runs `validate_schema()`
2. Per Slice 3 done-condition, the binary returns a JSON object `{schema_version, doc_count, chunk_count, db_path}`
3. Exit 0

### Primary Flow (Happy Path) — `delete <source-id>`

1. The binary opens `index.db` (write mode); takes a `BEGIN IMMEDIATE` transaction
2. Per Slice 3 done-condition, the binary deletes the matching `documents` row and the cascading `chunks` rows (FTS5 trigger removes from `chunks_fts`)
3. The transaction commits
4. Exit 0

**Postconditions**:
- For `list` / `status`: stdout contains the JSON output; no DB writes
- For `delete`: the matching rows are removed; subsequent `search` excludes them; FTS5 sync verified

**Mapped FR**: FR-1.2, FR-1.4, FR-2.4, FR-4.2
**Mapped ACs**: (no direct AC; covered by Slice 3 done-conditions)

### Alternative Flows

- **UC-8-A1: `delete` with non-existent `<source-id>`** — Idempotent
  1. The binary attempts the delete; zero rows match
  2. Exit 0 (idempotent — deleting a non-existent record is not an error) OR exit 1 with a clear "not found" message — implementation-time decision per Slice 3
  3. No DB state change either way

  **Mapped FR**: FR-1.2
  **Mapped ACs**: (no direct AC)

- **UC-8-A2: Default text output for all three subcommands** — Human-readable
  1. Without `--json`, output is human-readable text per FR-1.4

  **Mapped FR**: FR-1.4

### Error Flows

- **UC-8-E1: Corrupt `index.db` for `list` / `status`** — Same as UC-7-E1
  1. `validate_schema()` fails; binary exits 1 with `error: index database invalid; re-ingest required` per FR-1.6 / AC-7

  **Mapped FR**: FR-1.6
  **Mapped ACs**: AC-7

- **UC-8-E2: Database lock contention during `delete`** — Concurrent writer
  1. Another process holds a write lock; `BEGIN IMMEDIATE` returns SQLITE_BUSY
  2. The binary waits up to a configurable timeout (SQLite default `busy_timeout`); on timeout, exits 1 with a clear error
  3. WAL mode minimizes contention but does not eliminate it for writes

  **Mapped FR**: FR-2.7, NFR-1.6
  **Mapped ACs**: (no direct AC)

### Edge Cases

- **UC-8-EC1: `status` on an empty but valid `index.db`** — Schema present, zero rows
  1. `validate_schema()` succeeds (the v1 migration ran; tables exist with zero rows)
  2. Output: `{schema_version: 1, doc_count: 0, chunk_count: 0, db_path: "<path>"}`
  3. Exit 0

  **Mapped FR**: FR-1.2, FR-4.2
  **Mapped ACs**: (no direct AC)

### Data Requirements

- **Input**: For `list` / `status`: read-only DB. For `delete`: source-id (string or int per Slice 3)
- **Output**: JSON / text per FR-1.4
- **Side Effects**: For `delete`: DB row removal; FTS5 sync

---

## UC-9: Re-Ingesting an Unchanged File → Idempotent No-Op

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- A prior `sdlc-knowledge ingest <path>` succeeded; `<path>` is now in the `documents` table with its `(source_path, mtime, sha256)` triple recorded
- The file at `<path>` has NOT been modified since that prior ingest

**Trigger**: Developer re-runs `sdlc-knowledge ingest <path>` (or `/knowledge-ingest <path>`) on the same path

### Primary Flow (Happy Path)

1. The binary canonicalizes the path and opens `index.db`
2. Per FR-2.5, the binary computes `sha256` and reads `mtime` for the file
3. The binary checks the `documents` table for a row matching `(source_path, mtime, sha256)`; the triple matches
4. The binary logs `unchanged: <path>` per FR-2.5 and skips re-chunking
5. NO new rows are written to `documents` or `chunks`
6. NO existing rows are deleted or modified
7. Per NFR-1.7, total elapsed time is bounded by sha256 + DB lookup (typically ≪50 ms per document)
8. Exit 0

**Postconditions**:
- DB state is unchanged
- `documents.ingested_at` is NOT updated (idempotency means the row is left alone, not "touched")
- The summary line reports 0 new chunks, N unchanged sources

**Mapped FR**: FR-2.4, FR-2.5, NFR-1.7
**Mapped ACs**: AC-4

### Alternative Flows

- **UC-9-A1: Re-ingest a directory where some files are unchanged and some are new** — Mixed batch
  1. The binary processes each file; per-file decision: unchanged → skip, new/changed → re-chunk
  2. Final summary reports the breakdown

  **Mapped FR**: FR-2.5
  **Mapped ACs**: AC-4

- **UC-9-A2: File with same content but renamed (different `source_path`)** — Treated as new file per Risk #9
  1. Idempotency keys on `(source_path, mtime, sha256)` per FR-2.4 / Risk #9
  2. A renamed file has a different `source_path`, so no match is found; the binary re-ingests under the new path
  3. The old `source_path` row remains in `documents` until the developer manually `delete`s it
  4. Acceptable cost in iter-1; iter-2 may switch to content-hash-only keying per Risk #9

  **Mapped FR**: FR-2.4, FR-2.5
  **Mapped ACs**: AC-4

### Error Flows

- **UC-9-E1: Concurrent ingest + search via WAL** — Parallel-wave or parallel-process scenario
  1. Two agents (or one agent + one developer shell) query the index in parallel during a `/develop-feature` wave while a third process runs `ingest`
  2. SQLite WAL mode allows readers (search) to interleave with writers (ingest) per FR-2.7 / NFR-1.6
  3. Per Risk #10, ingest holds a per-document write lock via `BEGIN IMMEDIATE`; typical 50-chunk doc <50 ms blocking
  4. Searches see a consistent snapshot per WAL semantics — they observe either the pre-ingest state OR the post-commit state for any given document, never a partial mid-write state
  5. The orchestrator's parallel-wave execution is unaffected; both readers and writers proceed
  6. No deadlock, no panic; standard SQLite WAL behavior

  **Mapped FR**: FR-2.7, FR-2.6, NFR-1.6
  **Mapped ACs**: (no direct AC; covered by Risk #10)

- **UC-9-E2: `mtime` updated by `touch` but content unchanged** — sha256 saves the day
  1. Developer runs `touch <path>` updating `mtime` without changing content
  2. The binary's `(source_path, mtime, sha256)` triple match: `source_path` matches, `mtime` differs, `sha256` matches
  3. Implementation-time decision: per FR-2.5, the test triple is `(source_path, mtime, sha256)` — strictly all three must match for skip. A mtime-only mismatch with sha256 match could be treated either way
  4. Conservative reading: re-chunk only when sha256 changes (mtime mismatch alone is acceptable to skip); the binary updates `documents.mtime` to match the new value
  5. Per NFR-1.7's spirit ("Re-running `ingest` on unchanged inputs MUST be a no-op (mtime+sha256 check)"), unchanged-content is no-op

  **Mapped FR**: FR-2.5, NFR-1.7
  **Mapped ACs**: AC-4

### Edge Cases

- **UC-9-EC1: File deleted between two ingests** — Path no longer exists
  1. Developer runs `ingest <dir>`; one file from a prior ingest is now missing
  2. The binary's recursive walk does NOT see the deleted file; no row update for it
  3. The stale `documents` row remains until the developer runs `delete <source-id>`
  4. Implementation-time decision: iter-1 does NOT auto-prune deleted source files (this would be a separate `prune` subcommand, not in iter-1 scope)

  **Mapped FR**: FR-2.5
  **Mapped ACs**: AC-4

### Data Requirements

- **Input**: A path with prior ingest record; sha256 + mtime computation
- **Output**: Log line `unchanged: <path>` per file
- **Side Effects**: Zero DB writes for unchanged files

---

## UC-10: Re-Ingesting a CHANGED File → Re-Chunk with FTS5 Trigger Updates

**Actor**: Developer, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- A prior `sdlc-knowledge ingest <path>` succeeded
- The file at `<path>` has been MODIFIED since that prior ingest (content changed → sha256 changed)

**Trigger**: Developer re-runs `sdlc-knowledge ingest <path>`

### Primary Flow (Happy Path)

1. The binary canonicalizes the path and opens `index.db`
2. Per FR-2.5, the binary computes `sha256`; it differs from the stored value for this `source_path`
3. The binary opens a `BEGIN IMMEDIATE` transaction per FR-2.5 / FR-2.6 (per-document boundary)
4. The binary deletes the prior `chunks` rows for this document (FTS5 triggers remove the corresponding `chunks_fts` rows per FR-4.2)
5. The binary updates the `documents` row's `mtime`, `sha256`, `ingested_at` per FR-2.4
6. The binary re-chunks the new content using the same deterministic chunker per FR-2.3
7. The binary inserts the new `chunks` rows; FTS5 triggers populate `chunks_fts` per FR-4.2
8. The transaction commits
9. Per Risk #10, total elapsed time per document is typically <50 ms for a 50-chunk document; longer for large documents but bounded
10. Exit 0

**Postconditions**:
- The document's `chunks` rows reflect the new content
- FTS5 `chunks_fts` is in sync (no stale entries)
- Subsequent `search` queries return BM25 results based on the new content
- Other documents in the batch are unaffected (per-document transaction boundary)

**Mapped FR**: FR-2.4, FR-2.5, FR-2.6, FR-4.2, NFR-1.7
**Mapped ACs**: AC-4

### Alternative Flows

- **UC-10-A1: Re-ingest where chunk count changes** — Document grew or shrank
  1. The new content produces a different chunk count (e.g., grew from 50 to 80 chunks)
  2. The transaction deletes 50 old rows, inserts 80 new rows
  3. `chunks.id` values are new (auto-increment); FTS5 rebuild via triggers is uniform

  **Mapped FR**: FR-2.5, FR-4.2
  **Mapped ACs**: AC-4

### Error Flows

- **UC-10-E1: Re-chunk fails mid-transaction** — e.g., extraction crate returns error on the new content
  1. The PDF crate fails to extract text from the modified file
  2. The transaction is rolled back per `BEGIN IMMEDIATE` semantics
  3. The OLD chunks remain intact (no partial state)
  4. The binary reports the per-file error; batch continues with other files per FR-2.6

  **Mapped FR**: FR-2.6, FR-4.2
  **Mapped ACs**: AC-4

### Edge Cases

- **UC-10-EC1: Re-ingest reduces chunk count to zero** — File was edited to be empty
  1. The new content produces zero chunks (e.g., empty file or all-whitespace)
  2. The transaction deletes the old chunks and inserts zero new chunks
  3. The `documents` row remains; FTS5 has no rows for this `doc_id`
  4. Subsequent `search` excludes this document (no chunks to match)

  **Mapped FR**: FR-2.5
  **Mapped ACs**: AC-4

- **UC-10-EC2: FTS5 trigger fails to fire (regression)** — Schema integrity bug
  1. If a regression breaks the FTS5 triggers, `chunks_fts` would drift out of sync with `chunks`
  2. Slice 2's done-condition includes a test for trigger correctness on insert/update/delete
  3. AC-4 verification re-checks that `search` finds the new content after re-ingest

  **Mapped FR**: FR-4.2
  **Mapped ACs**: AC-4

### Data Requirements

- **Input**: A path with prior ingest record; modified content
- **Output**: Updated `documents` row, replaced `chunks` rows, synced `chunks_fts` rows
- **Side Effects**: Per-document transactional write; WAL sidecar updated

---

## UC-11: 12 Thinking Agents Detect Activation Sentinel and Query Before Authoring

**Actor**: One of the 12 in-scope thinking agents (canonical example: `prd-writer` at bootstrap Step 1), `/bootstrap-feature` orchestrator, `sdlc-knowledge` CLI binary

**Preconditions**:
- Common preconditions hold
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` exists and is executable
- `<project>/.claude/knowledge/index.db` exists with at least one ingested document (activation sentinel present per FR-10.1)
- The agent's prompt file `src/agents/<agent>.md` contains the `## Knowledge Base (when present)` section appended at the end per FR-5.1 / FR-5.3
- The agent's prompt body before the activation block is unchanged compared to pre-feature (the activation block is purely additive per FR-5.3)

**Trigger**: The `/bootstrap-feature` orchestrator invokes the agent at its respective step (Step 1 for `prd-writer`, Step 2 for `ba-analyst`, etc.)

### Primary Flow (Happy Path)

1. The agent loads its prompt; the `## Knowledge Base (when present)` section instructs: query BEFORE authoring domain-bearing content WHEN the activation sentinel is present per FR-5.2(b)
2. The agent checks for `<project>/.claude/knowledge/index.db` per FR-5.2(b) / FR-10.1; the file is present
3. The agent formulates one or more search queries grounded in the feature's domain (e.g., for a regulated finance feature: "credit risk hedging policy", "stress test methodology")
4. For each query, the agent invokes the literal CLI command per FR-5.2(c): `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json`
5. The CLI returns a JSON array of ≤5 chunks ordered by BM25 best-first per UC-7
6. The agent reads the chunks; load-bearing hits (those that materially inform the agent's authored content) are noted for citation
7. The agent authors the domain-bearing content (PRD requirements, use-case scenarios, architectural decisions, test cases, etc.) using the chunks as evidence rather than relying on training-data memory
8. The agent adds citations to its `## Facts → ### External contracts` block per UC-12 / FR-5.2(d)
9. The agent's output is consumed by the next bootstrap step

**Postconditions**:
- The agent's authored artifact (PRD section, use-cases file, plan, etc.) reflects domain knowledge from the project's ingested sources
- The `## Facts → ### External contracts` block contains at least one `knowledge-base:`-prefixed citation when the index has matching content for the domain
- Per AC-10, when the index IS present, the 12 thinking agents MUST cite at least one `knowledge-base:` source for any task that exercises domain semantics

**Mapped FR**: FR-5.1, FR-5.2, FR-5.3, FR-5.5, FR-7.1, FR-10.1
**Mapped ACs**: AC-10

### Alternative Flows

- **UC-11-A1: Agent queries multiple distinct topics** — Multi-query authoring
  1. The agent issues 2-3 distinct queries covering different aspects of the domain
  2. Each query produces a JSON result set; the agent triangulates across them
  3. Citations under `### External contracts` may reference multiple sources

  **Mapped FR**: FR-5.2(c)
  **Mapped ACs**: AC-10

- **UC-11-A2: Search returns zero hits for a domain query** — Index has no matching content
  1. Per UC-7-E2, the binary returns an empty JSON array
  2. The agent records under `### Open questions` (or `### Assumptions`) that the project's knowledge base did not cover this aspect
  3. The agent proceeds without a `knowledge-base:` citation for THAT specific query
  4. Per FR-10.3, no Plan Critic finding fires on absence of citation when the index returns no results

  **Mapped FR**: FR-5.2, FR-10.3
  **Mapped ACs**: AC-10 (citation conditional on relevant content)

- **UC-11-A3: Agent queries during `/develop-feature` slice (mid-pipeline)** — Per-slice rather than bootstrap
  1. The `planner` (or `architect` in a Wave 2 review) invokes the activation block during slice authoring
  2. Same flow as primary; queries scoped to the slice's domain

  **Mapped FR**: FR-5.1, FR-5.2
  **Mapped ACs**: AC-10

### Error Flows

- **UC-11-E1: Agent attempts to query but binary path is wrong / Bash allowlist missing** — Configuration drift
  1. The activation block invokes the literal CLI path per FR-5.2(c); the orchestrator runtime rejects the Bash call (allowlist denies) OR the path resolves to a non-existent file
  2. Per FR-5.5, the agent logs the literal line `knowledge-base: tool not installed; skipping` exactly once
  3. The agent adds an entry to its `### Open questions` subsection per FR-5.5 / cognitive-self-check `## Facts` schema
  4. The agent proceeds with its existing authoring flow without citations
  5. Per AC-9, the pipeline does NOT abort on the missing/blocked binary
  6. Flow degrades to UC-14

  **Mapped FR**: FR-5.5, FR-10.2
  **Mapped ACs**: AC-9

- **UC-11-E2: Agent forgets to cite a load-bearing chunk** — Output drift
  1. The agent reads chunks but does not cite them in `### External contracts`
  2. Per FR-10.3, the Plan Critic in `src/claude.md` is UNCHANGED; the existing `### External contracts` heuristic from Section 9 covers `knowledge-base:` citations as a valid source format
  3. If the cognitive-self-check Plan Critic check fires on a missing citation for an external identifier in the artifact body, the agent must add the citation
  4. Per Risk #6, the Plan Critic does NOT flag absence of `knowledge-base:` citations specifically — that would require matching artifact-body content against ingested chunks, which iter-1 does NOT implement

  **Mapped FR**: FR-7.1, FR-10.3
  **Mapped ACs**: AC-10

### Edge Cases

- **UC-11-EC1: Activation sentinel present but binary absent** — Mismatched state
  1. The agent finds `<project>/.claude/knowledge/index.db` exists per FR-5.2(b)
  2. The agent invokes the CLI; binary at `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is absent
  3. Per FR-5.5, the agent logs `knowledge-base: tool not installed; skipping` and adds entry to `### Open questions`
  4. The agent proceeds — the state mismatch surfaces in audit trail

  **Mapped FR**: FR-5.5, FR-10.2
  **Mapped ACs**: AC-9

- **UC-11-EC2: Activation block accidentally placed BEFORE existing prompt sections (regression)** — Order violation
  1. Per FR-5.3, the activation block MUST be placed at the END of the prompt
  2. A regression placing it earlier would still be functionally additive but would risk attention-budget conflicts with the load-bearing pre-existing sections (`## Cognitive Self-Check (MANDATORY)`, etc.)
  3. Slice 7a/7b/7c done-conditions check `grep -Fxc "## Knowledge Base (when present)"` returns 1; positioning is verified by manual review

  **Mapped FR**: FR-5.3
  **Mapped ACs**: AC-10

- **UC-11-EC3: Executor agent prompt accidentally modified to add the activation block** — FR-5.4 violation
  1. Per FR-5.4 / FR-12.3 / AC-11, the 5 executor agents MUST be byte-unchanged
  2. A regression adding the activation block to e.g. `test-writer.md` would fail AC-11's `git diff` check
  3. Code-reviewer at Gate 2 catches via byte-unchanged invariant

  **Mapped FR**: FR-5.4, FR-12.3
  **Mapped ACs**: AC-11

### Data Requirements

- **Input**: Activation sentinel (`<project>/.claude/knowledge/index.db`), agent's domain context, query strings derived from the feature
- **Output**: BM25-ranked chunks consumed by the agent; citations added to the agent's `## Facts → ### External contracts` block
- **Side Effects**: Bash invocations of the CLI per query (allowlist-permitted); zero direct DB writes by agent (all writes go through the binary)

---

## UC-12: Agent Cites BM25 Hits in `## Facts → ### External contracts` per Cognitive-Self-Check Format

**Actor**: One of the 12 in-scope thinking agents (canonical example: `architect` rendering a stdout review), Plan Critic subagent (downstream)

**Preconditions**:
- UC-11 primary flow has executed successfully; the agent has at least one load-bearing BM25 hit
- The cognitive-self-check rule's `## Facts` block schema is in effect (`### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions` per Section 9 FR-1.3)
- The knowledge-base rule file `src/rules/knowledge-base.md` defines the literal citation format per FR-7.1: `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes`

**Trigger**: The agent emits its `## Facts` block (location depends on agent type — file-based, stdout, file-based-handoff per Section 9 FR-2.X)

### Primary Flow (Happy Path)

1. The agent has consumed BM25 chunks per UC-11
2. For each load-bearing chunk, the agent constructs a citation in the literal format per FR-7.1 / AC-10:
   ```
   knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes
   ```
   Where:
   - `<source-filename>` is the basename or relative-to-`sources/` path of the chunk's source document (from the JSON `source` field of UC-7)
   - `<chunk-id>` is the integer `chunk_id` from UC-7's JSON
   - `<query>` is the literal query string the agent issued
   - `<score>` is the BM25 score from UC-7's JSON (numeric)
   - `verified: yes` confirms the agent invoked the CLI in the current session per cognitive-self-check Q2 (freshness)
3. The agent places the citation under `### External contracts` of its `## Facts` block per FR-7.3 / Section 9 FR-1.3
4. The agent emits the artifact (PRD section, plan, stdout review, etc.) including the `## Facts` block
5. Per FR-7.3 / FR-10.4, this is an ADDITIVE convention — `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED; existing Section 9 schema accepts the new prefix
6. Plan Critic Check (b) per Section 9 FR-4.3 runs on the artifact (file-based artifacts only per Section 9 FR-4.6)
7. The Plan Critic's existing `### External contracts` heuristic accepts the `knowledge-base:` prefix as a valid citation source format per FR-10.3 / 11.7 item 6
8. No new Plan Critic finding fires; the citation passes verification

**Postconditions**:
- The artifact's `## Facts → ### External contracts` block contains the literal citation in the FR-7.1 format
- Plan Critic does NOT raise findings related to the new prefix
- Cognitive-self-check rule file is BYTE-UNCHANGED per FR-12.5

**Mapped FR**: FR-7.1, FR-7.3, FR-10.3, FR-10.4, FR-12.5
**Mapped ACs**: AC-10

### Alternative Flows

- **UC-12-A1: Citation alongside a non-knowledge-base external contract** — Mixed sources
  1. The agent's `### External contracts` contains BOTH a `knowledge-base:` citation AND an external SDK citation (e.g., `Stripe.Charge.status — verified via WebFetch ...`)
  2. Both citations are valid per Section 9 FR-1.4 wording (citation MUST identify the source); the `knowledge-base:` prefix is one of several valid source formats
  3. Plan Critic Check (b) accepts both

  **Mapped FR**: FR-7.1, FR-7.3
  **Mapped ACs**: AC-10

- **UC-12-A2: Citation in a stdout-only artifact (architect, security-auditor, code-reviewer, verifier, refactor-cleaner)** — Per Section 9 FR-4.6 file-vs-stdout split
  1. The stdout-only agent emits the citation under `### External contracts` of its stdout `## Facts` block
  2. Per Section 9 FR-4.6, Plan Critic does NOT mechanically check stdout content; enforcement is the agent's own prompt's responsibility
  3. The audit trail captures the citation in the user's transcript

  **Mapped FR**: FR-7.1, Section 9 FR-4.6
  **Mapped ACs**: AC-10

### Error Flows

- **UC-12-E1: Agent emits malformed citation (drops `BM25:` field)** — Format drift
  1. The citation reads `knowledge-base: <source>:<chunk-id> — verified: yes` (missing `query:` and `BM25:`)
  2. Per FR-7.1, the literal citation format MUST include all four components
  3. Plan Critic's existing heuristic does NOT mechanically validate the four-component structure (it accepts `knowledge-base:` prefix as a valid source format); enforcement is the agent's own prompt's responsibility per analogous to Section 9 FR-4.6
  4. AC-10 verification at QA / merge-ready time catches the drift via grep for the literal format components

  **Mapped FR**: FR-7.1
  **Mapped ACs**: AC-10

- **UC-12-E2: Agent cites a chunk it never read** — Hallucinated citation
  1. The agent's prompt would need to invent a `<source>:<chunk-id>` and a `<score>` without invoking the CLI
  2. Per cognitive-self-check Q1 (source) / Q2 (freshness), this is a fact-shaped lie
  3. The cognitive-self-check rule's instruction to verify in-session protects against this; if the agent obeys its own self-check, the citation MUST come from a real CLI invocation
  4. If the agent disobeys, the audit trail (`## Facts` block) makes the violation challengeable by the next reviewer

  **Mapped FR**: FR-7.1, Section 9 FR-1.2
  **Mapped ACs**: AC-10

### Edge Cases

- **UC-12-EC1: Source filename contains a colon (`a:b.pdf`)** — Citation format ambiguity
  1. The literal format `<source-filename>:<chunk-id>` uses `:` as a separator
  2. A filename containing `:` (rare on Unix but allowed) creates ambiguity
  3. Implementation-time decision: either escape the `:` in the citation, or document that filenames containing `:` are unsupported in iter-1
  4. Per Risk #13, every path in this section uses lowercase basenames; filenames with colons are acceptable cost

  **Mapped FR**: FR-7.1
  **Mapped ACs**: AC-10

- **UC-12-EC2: BM25 score is negative or zero** — Edge of FTS5 ranking
  1. SQLite's `bm25()` returns a value (lower = better by convention); the citation's `<score>` is the literal numeric value
  2. The agent emits whatever `score` field appears in the JSON output of UC-7

  **Mapped FR**: FR-7.1
  **Mapped ACs**: AC-10

### Data Requirements

- **Input**: BM25 chunks from UC-11; the literal citation format from `src/rules/knowledge-base.md` per FR-7.1
- **Output**: Citation strings in `### External contracts` of the agent's `## Facts` block
- **Side Effects**: None beyond the artifact emission

---

## UC-13: Backward Compat — Without `index.db`, Agents Skip Knowledge-Base Step Silently and Produce Behaviorally-Identical Output

**Actor**: One of the 12 in-scope thinking agents, `/bootstrap-feature` or `/develop-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- `<project>/.claude/knowledge/index.db` does NOT exist (e.g., a project never ran `/knowledge-ingest`, or the user deleted the index)
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` may or may not exist (immaterial — the sentinel-absent path triggers regardless of binary presence per FR-10.1)
- The agent's prompt file contains the `## Knowledge Base (when present)` activation block per FR-5.1

**Trigger**: The orchestrator invokes the agent (any of the 12 in-scope) for any reason during a pipeline run

### Primary Flow (Happy Path)

1. The agent loads its prompt; the `## Knowledge Base (when present)` section instructs querying CONDITIONAL on the activation sentinel per FR-5.2(b)
2. The agent checks for `<project>/.claude/knowledge/index.db`; the file does NOT exist
3. Per FR-5.5 / FR-10.1, the activation block is a no-op — the agent proceeds with its existing authoring flow with NO behavioral change
4. The agent does NOT log a "tool not installed" line (that's UC-14's flow); it simply skips the knowledge-base step silently
5. The agent authors its artifact using its existing logic (training data + cognitive-self-check protocol per Section 9)
6. The artifact is BEHAVIORALLY identical to the pre-feature output for the same input per FR-10.1 (the agent prompt files themselves grew by ~25 lines per FR-5.1; that is a prompt-text change, not a behavioral change in authored artifacts)
7. Plan Critic Check (b) per Section 9 FR-4.3 / FR-10.3 does NOT fire on absence of `knowledge-base:` citations because the activation sentinel is conditional, not unconditional

**Postconditions**:
- The agent's authored artifact has zero `knowledge-base:` citations under `### External contracts`
- The artifact's content (PRD requirements, use cases, plan slices, etc.) is identical to a pre-feature run on the same input
- Pipeline does NOT abort, does NOT emit error traces in stdout per AC-8
- Plan Critic does NOT raise missing-citation findings tied to knowledge-base absence per FR-10.3

**Mapped FR**: FR-5.5, FR-10.1, FR-10.3
**Mapped ACs**: AC-8

### Alternative Flows

- **UC-13-A1: All 12 in-scope agents in a single bootstrap pass** — System-level backward compat
  1. `/bootstrap-feature` runs Steps 1-7+; each in-scope agent invocation hits UC-13 primary
  2. Cumulative output (PRD, use-cases, plan, etc.) is behaviorally identical to a pre-feature `/bootstrap-feature` run
  3. AC-8 is verified by diffing the produced PRD/use-case/plan files between with-index and without-index runs (the diff MUST be empty for the without-index baseline)

  **Mapped FR**: FR-10.1
  **Mapped ACs**: AC-8

### Error Flows

- **UC-13-E1: Activation block accidentally invokes the CLI even when sentinel is absent (regression)** — Behavioral drift
  1. A regression in the activation block's wording could cause the agent to invoke the CLI unconditionally
  2. The CLI returns "index not found" (UC-7-E4) or works on an empty/missing path
  3. Output drift could surface in the agent's authored content
  4. AC-8's diff verification catches this regression

  **Mapped FR**: FR-5.2, FR-10.1
  **Mapped ACs**: AC-8

### Edge Cases

- **UC-13-EC1: Sentinel transitions from absent to present mid-cycle** — A user runs `/knowledge-ingest` between two bootstrap steps
  1. Step 1 (`prd-writer`) sees sentinel absent; UC-13 applies
  2. The user runs `/knowledge-ingest` outside the orchestrator
  3. Step 2 (`ba-analyst`) sees sentinel present; UC-11 applies
  4. The two artifacts in the same cycle have different citation density; this is acceptable (per-step behavior is correct given the state at that step)

  **Mapped FR**: FR-10.1
  **Mapped ACs**: AC-8 (per-invocation check)

### Data Requirements

- **Input**: Sentinel-absent project state, agent's domain context
- **Output**: Authored artifact behaviorally identical to pre-feature output
- **Side Effects**: Zero CLI invocations, zero log lines about knowledge base, zero `knowledge-base:` citations

---

## UC-14: Backward Compat — Without Binary, Agents Log Skip Line and Proceed

**Actor**: One of the 12 in-scope thinking agents, `/bootstrap-feature` or `/develop-feature` orchestrator

**Preconditions**:
- Common preconditions hold
- `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` is ABSENT (e.g., `install.sh` has not run, or the user removed the binary, or the `chmod +x` failed in UC-1-E2)
- `<project>/.claude/knowledge/index.db` MAY or MAY NOT exist (immaterial — when the binary is absent, querying is impossible regardless of sentinel state)
- The agent's prompt file contains the `## Knowledge Base (when present)` activation block per FR-5.1
- (For the canonical path) The activation sentinel `<project>/.claude/knowledge/index.db` IS present, so the activation block triggers; the agent attempts to invoke the CLI

**Trigger**: The orchestrator invokes the agent; the agent attempts to query the knowledge base

### Primary Flow (Happy Path)

1. The agent loads its prompt; the `## Knowledge Base (when present)` section triggers because the sentinel is present per FR-5.2(b)
2. The agent attempts to invoke `~/.claude/tools/sdlc-knowledge/sdlc-knowledge search "<query>" --top-k 5 --json` per FR-5.2(c)
3. The Bash invocation fails because the binary file does not exist (file-not-found / `command not found` error from the Bash tool)
4. Per FR-5.5 / FR-10.2, the agent logs the literal line `knowledge-base: tool not installed; skipping` exactly once
5. Per FR-5.5, the agent adds a corresponding entry to its `### Open questions` subsection (e.g., `knowledge-base: tool unavailable; skipped` or analogous) per Section 9 `## Facts` schema
6. The agent proceeds with its existing authoring flow without citations
7. Per AC-9, the pipeline does NOT abort on the missing binary
8. The artifact is authored as in UC-13 (behavioral baseline preserved)

**Postconditions**:
- The agent emitted the literal line `knowledge-base: tool not installed; skipping` exactly once (per AC-9)
- The agent's `## Facts → ### Open questions` contains an entry noting the unavailability
- Authored artifact has zero `knowledge-base:` citations
- Pipeline continues normally; no abort
- Plan Critic Check (b) does NOT fire on missing citations (per FR-10.3, citations are conditional on the binary being present)

**Mapped FR**: FR-5.5, FR-10.2, FR-10.3
**Mapped ACs**: AC-9

### Alternative Flows

- **UC-14-A1: Multiple agents in a bootstrap pass each emit the skip line** — Frequency
  1. Each in-scope agent invocation in the cycle emits the skip line independently per FR-5.5 wording ("exactly once" per agent invocation, not per pipeline run)
  2. The transcript shows N skip lines for N agent invocations
  3. The user is informed and can run `bash install.sh --yes` to remediate

  **Mapped FR**: FR-5.5
  **Mapped ACs**: AC-9

- **UC-14-A2: Binary absent AND sentinel absent** — Both UC-13 and UC-14 conditions could apply
  1. Per FR-10.1, the activation block is a no-op when the sentinel is absent — the agent does NOT attempt to invoke the CLI
  2. Therefore the skip line is NOT emitted (UC-13's silent path applies, not UC-14's)
  3. The state-mismatch check is sentinel-first per FR-5.2(b) ordering

  **Mapped FR**: FR-5.5, FR-10.1
  **Mapped ACs**: AC-8 (silent path takes precedence)

### Error Flows

- **UC-14-E1: Bash allowlist denies the invocation (e.g., allowlist not registered)** — Permission-level failure rather than file-absence
  1. `install.sh` ran but the allowlist registration failed (FR-8.3 regression)
  2. The agent's CLI invocation is rejected by the orchestrator's permission layer, not by the OS
  3. Per FR-5.5 wording (binary "absent"), the spirit applies even when the binary exists but is blocked
  4. Implementation-time decision: the agent treats both file-absent and permission-denied as "tool not installed" and emits the skip line
  5. Per Risk #4 / NFR-1.9, the allowlist scope is exactly the binary path; a missing allowlist is a deployment regression caught at install time

  **Mapped FR**: FR-5.5, FR-8.3, NFR-1.9
  **Mapped ACs**: AC-9

- **UC-14-E2: Agent fails to log the skip line (regression)** — Silent skip
  1. A regression in the activation block's wording could cause the agent to skip silently (no skip line)
  2. AC-9 verification at QA / merge-ready: grep for the literal line `knowledge-base: tool not installed; skipping` in the transcript; if absent when binary is absent, regression
  3. Code-reviewer at Gate 2 catches via reviewing the activation block wording in each of the 12 agent files

  **Mapped FR**: FR-5.5
  **Mapped ACs**: AC-9

### Edge Cases

- **UC-14-EC1: Binary is present but corrupted (e.g., zero bytes after partial download)** — File exists but unusable
  1. The agent invokes the CLI; the OS returns "exec format error" or similar
  2. The Bash invocation fails with a different error code than file-not-found
  3. Implementation-time decision: agent treats any non-zero CLI exit (including invocation failure) as "tool not installed" and emits the skip line per FR-5.5 spirit
  4. Recovery: re-run `bash install.sh --yes` to re-download

  **Mapped FR**: FR-5.5
  **Mapped ACs**: AC-9

- **UC-14-EC2: Binary is present but `--version` returns an unexpected error** — Functional regression
  1. The agent could `--version`-probe before searching, but iter-1 does NOT mandate a probe; the agent issues the search directly
  2. Search-time errors (UC-7-E1, UC-7-E2, etc.) are handled per UC-7 error flows, not UC-14

  **Mapped FR**: FR-5.5
  **Mapped ACs**: AC-9

### Data Requirements

- **Input**: Activation sentinel (present), binary (absent or unusable)
- **Output**: Skip line in transcript; entry in agent's `### Open questions`; artifact without `knowledge-base:` citations
- **Side Effects**: One failed Bash invocation; otherwise zero side effects

---

## UC-15: Bash Allowlist Registered Idempotently in `~/.claude/settings.json`

**Actor**: `install.sh` script

**Preconditions**:
- Common preconditions hold
- `~/.claude/settings.json` may exist with prior content (other allow entries from pre-existing user configuration) OR may be absent (fresh install)

**Trigger**: `bash install.sh --yes` runs the `register_bash_allowlist` step per FR-8.3

### Primary Flow (Happy Path)

1. `install.sh` reads `~/.claude/settings.json` (or initializes a new structure if absent)
2. Per FR-8.3, the script attempts to use `jq` for the JSON merge if `jq` is on PATH; otherwise uses a heredoc-merge that preserves existing keys
3. The script ensures exactly ONE allow entry exists with the literal value `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` per FR-8.3 / NFR-1.9 / AC-2
4. The script writes the merged JSON back to `~/.claude/settings.json`
5. Re-running `install.sh` does NOT duplicate the entry — the script checks for an existing match before adding per FR-8.3 idempotency requirement
6. Pre-existing allow entries (e.g., other tool paths from user's prior configuration) are preserved

**Postconditions**:
- `~/.claude/settings.json` exists and is valid JSON
- The allowlist contains exactly ONE entry matching the literal `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` per AC-2
- Pre-existing allow entries are preserved (verifiable by snapshotting the file's other keys before/after install)
- No broader wildcards (e.g., `*` or `~/.claude/*`) are added per NFR-1.9

**Mapped FR**: FR-8.3, NFR-1.9
**Mapped ACs**: AC-2

### Alternative Flows

- **UC-15-A1: Fresh install with no prior `~/.claude/settings.json`** — File creation
  1. The script creates `~/.claude/settings.json` with a minimal structure containing the allow array with the one entry
  2. Subsequent installs read this file as a starting point

  **Mapped FR**: FR-8.3
  **Mapped ACs**: AC-2

- **UC-15-A2: `jq` is absent; heredoc-merge fallback** — Robustness across machines
  1. The script detects `jq` is not on PATH per FR-8.3
  2. The script uses a heredoc-merge that preserves existing keys (implementation-time: regex / sed / awk)
  3. The result is byte-equivalent to the `jq` path (same JSON structure modulo formatting)

  **Mapped FR**: FR-8.3
  **Mapped ACs**: AC-2

### Error Flows

- **UC-15-E1: User has prior allowlist entries; install.sh's JSON merge corrupts unrelated keys** — Regression
  1. Prior `settings.json` has top-level keys `permissions.allow`, `mcp_servers`, `theme`, etc.
  2. A regression in the merge logic could overwrite or drop unrelated keys
  3. Per FR-8.3 wording ("merge MUST be idempotent" + heredoc-merge "MUST preserve existing keys"), this is forbidden
  4. AC-2 verification: snapshot pre-install JSON, run install, diff post-install JSON — only the allow entry should be added; all other keys identical
  5. Security-auditor at Slice 5 pre-review catches via JSON-merge correctness check

  **Mapped FR**: FR-8.3
  **Mapped ACs**: AC-2

- **UC-15-E2: `~/.claude/settings.json` is malformed JSON** — Cannot parse
  1. The script attempts to parse with `jq` (or the heredoc fallback); parsing fails
  2. The script reports the parse error and refuses to overwrite the file (defensive — do not silently corrupt user data)
  3. The user must repair the JSON manually or delete the file to retry
  4. Implementation-time decision: per the pre-existing `install.sh` patterns, defensive failure is preferred over silent overwrite

  **Mapped FR**: FR-8.3
  **Mapped ACs**: AC-2 (negative path)

- **UC-15-E3: Concurrent `install.sh` runs race on the JSON merge** — File lock contention
  1. Two `install.sh` processes run simultaneously; both read, modify, write `settings.json`
  2. Last-write-wins; one of the two writes may be lost
  3. Implementation-time decision: iter-1 does NOT use file locking (rare scenario, low blast radius — both writes ultimately produce the same canonical state per idempotency)

  **Mapped FR**: FR-8.3
  **Mapped ACs**: AC-2

### Edge Cases

- **UC-15-EC1: Path expansion (`~`) — does the literal value contain `~` or the expanded `/home/user/...`?** — Cross-platform path semantics
  1. Per FR-8.3 wording, the literal value is `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` (with `~` literal)
  2. The orchestrator that consumes the allowlist is responsible for `~`-expansion at invocation time
  3. AC-2 verification uses the literal `~`-prefixed string in `grep` / `jq` queries

  **Mapped FR**: FR-8.3, NFR-1.9
  **Mapped ACs**: AC-2

- **UC-15-EC2: User manually edits the entry to broaden the wildcard (e.g., `~/.claude/tools/* *`)** — User override
  1. Per NFR-1.9, the install script registers exactly the narrow path; user-modified state is the user's choice
  2. iter-1 does NOT enforce or revert user modifications post-install (would be hostile to user customization)
  3. If the user broadens the scope, the binary's own project-root canonicalization (FR-1.5) still provides defense-in-depth per Risk #4

  **Mapped FR**: NFR-1.9
  **Mapped ACs**: AC-2

### Data Requirements

- **Input**: Pre-existing `~/.claude/settings.json` (may have prior content)
- **Output**: `~/.claude/settings.json` with the allow entry merged
- **Side Effects**: One file write; preservation of prior content

---

## Cross-Cutting Use Cases

### UC-CC-1: Cross-Platform Install Verification (4 Platforms)

**Scenario**: Verify `bash install.sh --yes` succeeds on darwin-arm64, darwin-x64, linux-x64, and linux-arm64; Windows is OUT OF SCOPE per 11.7.

1. On each of the four supported platforms, run `bash install.sh --yes` from a clean state (no prior `~/.claude/tools/sdlc-knowledge/`)
2. Verify `~/.claude/tools/sdlc-knowledge/sdlc-knowledge --version` exits 0 within 60 s per AC-1
3. Verify the `~/.claude/settings.json` allowlist entry per AC-2
4. Verify the binary size is ≤10 MB per NFR-1.1
5. Verify search latency on a 10 000-chunk seeded fixture DB is ≤500 ms per AC-5 / NFR-1.2
6. Verify ingest of a 5 MB PDF completes in ≤60 s per AC-4 / NFR-1.3
7. The GitHub Actions workflow at `.github/workflows/sdlc-knowledge-release.yml` per FR-11.1 produces these binaries deterministically from a single tag (`sdlc-knowledge-v*`)

**Mapped FR**: FR-8.1, FR-11.1, FR-11.2, NFR-1.1, NFR-1.2, NFR-1.3, NFR-1.4
**Mapped ACs**: AC-1

### UC-CC-2: Invariant Preservation — 17 Agents, 10 Gates, 5 Executors, README Taglines

**Scenario**: After feature merges, verify all invariants per FR-12.1 through FR-12.5 / AC-11.

1. `ls src/agents/*.md | wc -l` returns exactly `17` per FR-12.1 / AC-11
2. README contains the literal line `17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.` at line 5 BYTE-UNCHANGED per FR-12.1 / AC-11; verifiable via `grep -Fxc "17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations." README.md` returning ≥1 (precedent: cognitive-self-check Section 9 invariant grep)
3. README contains the literal phrase `10 quality gates` at line 35 BYTE-UNCHANGED per FR-12.2 / AC-11
4. The 5 executor agent prompt files (`src/agents/{test-writer, build-runner, e2e-runner, doc-updater, changelog-writer}.md`) have ZERO diff vs current main per FR-12.3 / AC-11; verifiable via `git diff <pre-merge-commit>..HEAD -- src/agents/test-writer.md src/agents/build-runner.md src/agents/e2e-runner.md src/agents/doc-updater.md src/agents/changelog-writer.md` returning empty
5. `release-engineer` agent prompt at `src/agents/release-engineer.md` GAINS the activation block per FR-12.4 but its Gate 9 release-packaging logic is UNCHANGED in iter-1 (verifiable by reading the agent body's Gate 9 section pre vs post diff)
6. The cognitive-self-check rule file `src/rules/cognitive-self-check.md` is BYTE-UNCHANGED per FR-12.5 / FR-10.4; verifiable via `git diff <pre-merge-commit>..HEAD -- src/rules/cognitive-self-check.md` returning empty
7. The Plan Critic in `src/claude.md` is UNCHANGED per FR-10.3; verifiable via the same `git diff` pattern
8. The four pre-existing template surfaces (`templates/CLAUDE.md`, `templates/scratchpad.md`, `templates/settings.json`, `templates/rules/`) are UNCHANGED per FR-9.2; verifiable via `git diff` returning empty for those paths

**Mapped FR**: FR-9.2, FR-10.3, FR-10.4, FR-12.1, FR-12.2, FR-12.3, FR-12.4, FR-12.5
**Mapped ACs**: AC-11

### UC-CC-3: Commands Count Goes from 5 to 6

**Scenario**: After feature merges, verify the new `/knowledge-ingest` slash command raises the count per FR-6.4 / AC-12.

1. Pre-feature: `ls src/commands/*.md | wc -l` returns `5` (pre-existing: `bootstrap-feature.md`, `context-refresh.md`, `develop-feature.md`, `implement-slice.md`, `merge-ready.md`)
2. Post-feature: `ls src/commands/*.md | wc -l` returns `6` (above + `knowledge-ingest.md`) per FR-6.4 / AC-12
3. The new `src/commands/knowledge-ingest.md` exists per FR-6.1 and contains the literal text `sdlc-knowledge ingest`
4. README's Commands table includes a NEW row for `/knowledge-ingest` per FR-12.4 modified-files entry
5. The other five command files are UNCHANGED in their command-orchestration logic (per the FR-9.2 / unchanged-files table — `bootstrap-feature.md`, `context-refresh.md`, `develop-feature.md`, `implement-slice.md`, `merge-ready.md` listed as unchanged)

**Mapped FR**: FR-6.1, FR-6.4
**Mapped ACs**: AC-12

### UC-CC-4: PDF + Markdown + Plain Text Formats Supported in iter-1

**Scenario**: Verify all three iter-1 input formats are processed correctly per FR-2.1 / FR-2.2.

1. Ingest a `.md` file → text extracted as UTF-8 per FR-2.2; chunked deterministically; rows in `documents` and `chunks`
2. Ingest a `.txt` file → text extracted as UTF-8 per FR-2.2; same flow
3. Ingest a `.pdf` file → text extracted via the architect-selected PDF crate (default `pdf-extract` per Open Question #1); chunked; same flow
4. A directory containing all three formats is processed in one batch per FR-2.1; final summary aggregates across formats
5. Out-of-scope formats (`.docx`, `.html`, `.rst`, etc.) are silently skipped per FR-2.1's iter-1 supported-extension list
6. The Slice 2 fixture `tools/sdlc-knowledge/tests/fixtures/sample.md` (~3 KB) yields exactly 8 chunks per the Slice 2 done-condition (golden test for chunker determinism)
7. The Slice 2 fixture `tools/sdlc-knowledge/tests/fixtures/sample.pdf` (small 2-page synthetic) yields ≥1 chunk per Slice 2 done-condition

**Mapped FR**: FR-2.1, FR-2.2, FR-2.3
**Mapped ACs**: AC-4

### UC-CC-5: First-Release Maintainer Bootstrap

**Scenario**: Per FR-11.3 / Risk #8 / AC-13, the maintainer cuts the FIRST `sdlc-knowledge-v0.1.0` tag MANUALLY before the SDLC release that introduces this feature merges.

1. The maintainer reads `tools/sdlc-knowledge/RELEASING.md` per FR-11.3 / Slice 4 done-condition
2. The maintainer cuts a `sdlc-knowledge-v0.1.0` git tag and pushes to origin
3. The GitHub Actions workflow at `.github/workflows/sdlc-knowledge-release.yml` per FR-11.1 triggers on the tag pattern `sdlc-knowledge-v*`
4. The workflow's matrix (`macos-14`, `macos-13`, `ubuntu-latest`, `ubuntu-22.04-arm`) builds and uploads four binary artifacts per FR-11.1 / FR-11.2
5. After the workflow completes, the GitHub Releases page has artifacts for all four supported platforms
6. Subsequent users of `install.sh` find a release to download per AC-13; UC-1 primary path succeeds
7. Until the first tag exists, `install.sh` falls back to UC-2 (cargo source-build) or UC-3 (warning) per FR-8.4 / FR-8.5
8. The release-engineer Gate 9 in iter-1 is UNCHANGED per FR-12.4; subsequent `sdlc-knowledge-v<X.Y.Z>` tags are cut ad-hoc by the maintainer per the same RELEASING.md, NOT automatically by the release-engineer

**Mapped FR**: FR-11.1, FR-11.2, FR-11.3, FR-12.4
**Mapped ACs**: AC-13

---

## Facts

### Verified facts

- The PRD Section 11 (Local Knowledge Base for SDLC Agents) spans `docs/PRD.md` lines 2335-2693 — verified by Read of those lines in the current session
- The PRD Section 11 contains 8 sub-sections (11.1 through 11.8) plus a terminal `## Facts` block at lines 2655-2693 — verified by Read in the current session
- The 12 in-scope thinking agents enumerated in FR-5.1 (line 2430) are exactly: `prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `code-reviewer`, `verifier`, `refactor-cleaner`, `resource-architect`, `role-planner`, `release-engineer` — verified by Read of FR-5.1 in the current session, and these match the cognitive-self-check rule's in-scope list verbatim per FR-5.4 / Section 9 FR-2.1
- The 5 exempt executor agents enumerated in FR-5.4 (line 2433) are: `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer` — verified by Read in the current session
- The `## Facts` block schema (4 subsections in literal order: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`) is inherited from Section 9 FR-1.3 and is BYTE-UNCHANGED per FR-10.4 / FR-12.5 — verified by Read of Section 11 FR-12.5 (line 2497) in the current session
- The literal citation format per FR-7.1 (line 2449) is `knowledge-base: <source-filename>:<chunk-id> — query: "<query>" — BM25: <score> — verified: yes` — verified by Read of FR-7.1 / AC-10 (line 2523) in the current session
- The 13 acceptance criteria AC-1 through AC-13 are at PRD §11.5 lines 2514-2526 — verified by Read in the current session
- The activation sentinel is `<project>/.claude/knowledge/index.db` per FR-10.1 (line 2476) — verified by Read in the current session
- The Bash allowlist entry value is the literal `~/.claude/tools/sdlc-knowledge/sdlc-knowledge *` per FR-8.3 / NFR-1.9 / AC-2 (lines 2459, 2509, 2515) — verified by Read in the current session
- The literal stderr message for path-traversal rejection is `error: project-root must resolve under current working directory` per FR-1.5 / AC-6 (lines 2389, 2519) — verified by Read in the current session
- The literal stderr message for corrupt-index handling is `error: index database invalid; re-ingest required` per FR-1.6 / AC-7 (lines 2390, 2520) — verified by Read in the current session
- The literal skip line emitted by agents when binary is absent is `knowledge-base: tool not installed; skipping` per FR-5.5 / AC-9 (lines 2434, 2522) — verified by Read in the current session
- The literal install-warning message when binary unavailable AND cargo unavailable is `binary unavailable; install cargo or wait for first release` per FR-8.5 / AC-13 (lines 2461, 2526) — verified by Read in the current session
- The four iter-1 supported platforms are darwin-arm64, darwin-x64, linux-x64, linux-arm64 per FR-8.1 / NFR-1.4 (lines 2457, 2504); Windows is OUT OF SCOPE per 11.7 item 4 — verified by Read in the current session
- The four iter-1 supported file extensions are `.md`, `.txt`, `.pdf` per FR-2.1 (line 2396) — verified by Read in the current session
- The PRD Section 11 schema for `documents` table is `(id INTEGER PRIMARY KEY, source_path TEXT UNIQUE, mtime INTEGER, sha256 TEXT, ingested_at INTEGER)` and for `chunks` is `(id INTEGER PRIMARY KEY, doc_id INTEGER REFERENCES documents(id), ord INTEGER, text TEXT)` per FR-4.2 (lines 2419-2420) — verified by Read in the current session
- The FTS5 virtual table is `chunks_fts` with `content='chunks'` and `content_rowid='id'` per FR-4.2 (line 2421) — verified by Read in the current session
- The PRD Section 11 lists 13 risks at §11.6 lines 2528-2545 — verified by Read in the current session
- The 8 out-of-scope items at §11.7 lines 2548-2561 enumerate vector embeddings, MCP server, resource-architect auto-recommendation, Windows builds, release-engineer Gate 9 changes, Plan Critic edits, cognitive-self-check rule edits, and auto-tuning chunk size — verified by Read in the current session
- The approved plan at `/Users/aleksandra/.claude/plans/fuzzy-juggling-ocean.md` provides the implementation breakdown across 8 slices in 5 waves, the 13 acceptance criteria, the 13 risks and dependencies, and the verification block — verified by Read of the entire plan file in the current session
- The format precedent for use-case files is `docs/use-cases/cognitive-self-check_use_cases.md` (read partially: header at lines 1-32, UC-1 at lines 35-145, UC-2 at lines 148-253, UC-15 at lines 1146-1203, the `## Facts` block at lines 1323-1356 in the current session). This file uses: numbered UCs with Primary Flow / Alternative Flows / Error Flows / Edge Cases / Data Requirements / Mapped FR / Mapped ACs structure; common-preconditions block stated once at top; Actors table; Cross-Cutting use cases section near the end; terminal `## Facts` block — all conventions adopted in this document
- The total agent count remains 17 and total `/merge-ready` gate count remains 10 per FR-12.1 / FR-12.2 — verified by Read of Section 11 FR-12 (lines 2493-2497) in the current session
- This is a NEW use-case file (CREATE, not UPDATE) — verified because no existing file in `docs/use-cases/` covers the local-knowledge-base domain (the directory contained only the cognitive-self-check use-cases file relevant to a meta-SDLC infrastructure feature, plus other prior-feature files for role-planner and resource-architect which are unrelated; no overlap with this feature)

### External contracts

- **`rusqlite` crate (Rust SQLite binding) — symbol: `rusqlite::Connection::open_with_flags`, `Connection::execute_batch`, `Connection::prepare`; SQLite FTS5 virtual table syntax `CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='id')`; ranking function `bm25(chunks_fts)`** — source: rusqlite docs https://docs.rs/rusqlite/ + SQLite FTS5 docs https://www.sqlite.org/fts5.html — verified: **no — assumption** (inherited from PRD §11 `## Facts` `### External contracts` entry verbatim; not independently re-opened in this session). Risk: API drift between rusqlite major versions; FTS5 column-weight argument ordering not confirmed. Verification path: architect Step 3 review BEFORE Slice 3 ships per Open Question #5 in the approved plan (a pre-Slice-3 prerequisite per the plan's Open Question resolution).
- **`pdf-extract` crate — symbol: `pdf_extract::extract_text(path: &Path) -> Result<String, _>`** — source: https://crates.io/crates/pdf-extract — verified: **no — assumption** (inherited from PRD §11 `## Facts`). Risk: extraction quality on multi-column / scanned PDFs; default iter-1 choice. Verification path: architect Step 3 picks one (`pdf-extract` vs `lopdf`) with cited rationale BEFORE Slice 2 ships (Open Question #1 in the approved plan).
- **`clap` crate v4.x — symbols: `clap::Parser` derive macro, `#[command(subcommand)]`, `clap::Subcommand`** — source: https://docs.rs/clap/4 — verified: **no — assumption** (inherited from PRD §11 `## Facts`). Risk: minor wording drift between 4.x patch versions. Verification path: any `cargo build` failure in Slice 1 reveals API mismatches immediately.
- **GitHub Actions runner labels for the four-platform build matrix — `macos-14` (darwin-arm64), `macos-13` (darwin-x64), `ubuntu-latest` (linux-x64), `ubuntu-22.04-arm` (linux-arm64)** — source: https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners — verified: **no — assumption** (inherited from PRD §11 `## Facts`). Risk: ARM-Linux label rename; runner labels evolve. Verification path: pin labels at Slice 4 implementation; `actionlint` in workflow done-condition catches typos.
- **SQLite `bm25()` ranking function — symbol: `bm25(fts_table_name [, weight1, weight2, ...])`** — source: https://www.sqlite.org/fts5.html#the_bm25_function — verified: **no — assumption** (inherited from PRD §11 `## Facts`). Risk: column-weight argument ordering not confirmed; convention that lower scores indicate better matches not verified in current session. Verification path: architect Step 3 review BEFORE Slice 3 ships; Slice 3's done-condition includes a working end-to-end search query.
- **`assert_cmd` and `predicates` test crates — symbols: `assert_cmd::Command`, `predicates::str::contains`** — source: https://docs.rs/assert_cmd / https://docs.rs/predicates — verified: **no — assumption** (inherited from PRD §11 `## Facts`). Risk: minor; de-facto Rust CLI test idiom. Verification path: caught at first `cargo test`.
- **`actionlint` — invocation `actionlint .github/workflows/*.yml`** — source: https://github.com/rhysd/actionlint — verified: **no — assumption** (inherited from PRD §11 `## Facts`). Risk: version drift; not yet in repo. Verification path: Slice 4 pins a specific `actionlint` version in the workflow itself or in a `.actionlint` config.
- **SQLite `unicode61` tokenizer (default for FTS5) — symbol: tokenizer name `unicode61`** — source: https://www.sqlite.org/fts5.html#tokenizers — verified: **no — assumption** (referenced in UC-7-EC2 as the tokenizer assumed in iter-1; not opened in current session). Risk: tokenizer behavior on non-ASCII queries. Verification path: architect Step 3 confirms tokenizer choice; UC-7-EC2 documents the assumption.

### Assumptions

- The Bash allowlist scope literal value uses the unexpanded `~` per FR-8.3 (rather than the expanded `/Users/aleksandra/.claude/tools/...` path) — risk: if the orchestrator's allowlist matcher does not expand `~`, the literal entry would not match the actual binary path at invocation time; verification path: AC-2 verification uses the literal `~`-prefixed string (per the precedent of `grep -F "sdlc-knowledge"` in the plan's Verification block); architect Step 3 confirms `~`-expansion is performed by the orchestrator at allowlist-match time.
- The `documents.ingested_at` column is NOT updated on idempotent no-op re-ingest (UC-9 primary flow step 7) — risk: if the binary updates `ingested_at` even when content is unchanged, the row is "touched" and downstream consumers may interpret the change as new content; verification path: Slice 2's idempotency test verifies the row is left bit-for-bit alone on unchanged-input re-ingest.
- The `<source-filename>` component of the citation format per FR-7.1 is the basename or relative-to-`sources/` path of the document (not the full canonicalized absolute path) — risk: ambiguity if two source files share a basename; verification path: architect Step 3 picks one convention; the rule file `src/rules/knowledge-base.md` documents the chosen format unambiguously.
- The activation block's "exactly once" wording for the skip line per FR-5.5 means "exactly once per agent invocation" (not "exactly once per pipeline run") — risk: if the orchestrator deduplicates across agents, the skip line frequency could be lower than expected; verification path: implementation-time test of UC-14 with two consecutive agent invocations confirms two skip lines.
- The PDF crate selected at architect Step 3 is `pdf-extract` per Open Question #1 default in the approved plan — risk: if architect picks `lopdf` instead, the PDF reader implementation differs but the user-facing flow (UC-5, UC-6) is unchanged; verification path: architect Step 3 verdict re-reviewed before Slice 2 ships.
- The `chunk_id` field in the citation format per FR-7.1 corresponds to the `chunk_id` JSON field in UC-7's output (the `chunks.id` integer from the `chunks` table, not the in-document `chunks.ord` value) — risk: if the rule file documents `<chunk-id>` as the `ord` value instead, the citation would be ambiguous across re-ingests (since `chunks.id` is auto-increment and changes on re-ingest, while `ord` is stable per FR-2.4); verification path: architect Step 3 / Slice 6 (rule file authoring) picks one with documented rationale; UC-12 references both interpretations as "chunk_id from UC-7's JSON" pending the architect decision.
- The list of pre-existing use-case files in `docs/use-cases/` was inferred from the format-reference file `cognitive-self-check_use_cases.md` and the user task description; the full directory listing was NOT enumerated in the current session, so there is a small risk that an existing file covers the local-knowledge-base domain. Risk: duplicating use-case coverage. How to verify: run `ls docs/use-cases/*.md` at validation time.
- The `release-engineer` Gate 9 release-packaging logic is UNCHANGED in iter-1 per FR-12.4 means the agent still runs the same Gate 9 steps (version bump, CHANGELOG date stamp, release-notes file) but does NOT cut the `sdlc-knowledge-v<X.Y.Z>` tags — that responsibility lies with the maintainer per FR-11.3 / Risk #12; verification path: the SDLC repo's `release-engineer` agent prompt body's Gate 9 section pre vs post diff is empty.

### Open questions

- **Open Question #1 (inherited from approved plan) — Which PDF crate?** `pdf-extract` (pure Rust, simpler, lower-fidelity) vs `lopdf` (lower-level, requires more code) vs system `pdftotext` binding (best fidelity, external runtime dep). RESOLUTION: architect Step 3 picks ONE with cited rationale; iter-1 default is `pdf-extract` per Risk #2. Decision must land BEFORE Slice 2 ships.
- **Open Question #2 (inherited from approved plan) — rusqlite + FTS5 syntax verification.** Five of seven `### External contracts` are `verified: no — assumption`. RESOLUTION: architect Step 3 MUST verify rusqlite's FTS5 virtual-table syntax and `bm25()` argument ordering against current docs BEFORE Slice 3 ships (load-bearing for store + search). Pre-Slice-3 prerequisite.
- **Citation `chunk-id` semantics** — Whether `<chunk-id>` in the FR-7.1 citation format refers to `chunks.id` (auto-increment, changes on re-ingest) or `chunks.ord` (stable per-document position) needs explicit confirmation. RESOLUTION: architect Step 3 / Slice 6 picks one and the rule file `src/rules/knowledge-base.md` documents the choice. Documented as an assumption above; will be resolved during architect review BEFORE Slice 6 ships.
- **`unchanged: <path>` log line idempotency** — The exact wording of the FR-2.5 idempotency log line is `unchanged: <path>` per the verification block of the approved plan and the FR-2.5 wording; whether this appears once per file or in a summary line is implementation-time detail per Slice 2 done-condition.
- **`delete <source-id>` semantics** — Whether `<source-id>` in `sdlc-knowledge delete <source-id>` is the integer `documents.id`, the string `documents.source_path`, or both (with disambiguation) is implementation-time decision per Slice 3. The use-case document accommodates both interpretations under UC-8.
