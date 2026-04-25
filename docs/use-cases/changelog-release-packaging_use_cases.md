# Use Cases: Changelog Release Packaging -- Iteration 2 of Feature #3

> Based on [PRD](../PRD.md) -- Section 6: Changelog Release Packaging -- Iteration 2 of Feature #3

This document is the blueprint for E2E testing of the new `release-engineer` agent and its pipeline integration as Gate 9 in `/merge-ready`. Every use case is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`) are referenced by QA test cases and E2E tests.

The novel pattern across every scenario is the **conditional, suggest-only Gate 9**: `release-engineer` is a mandatory 17th agent that runs once per merge cycle, but performs work CONDITIONALLY based on `[Unreleased]` content. It mutates only local files (`CHANGELOG.md`, `.claude/release-notes-X.Y.Z.md`, possibly `.github/workflows/release.yml`) and emits a structured-summary command block for the developer to execute. The agent NEVER runs `git`, `gh`, `npm`, `cargo`, or any push/publish command -- defense-in-depth via the `tools` frontmatter exclusion of `Bash`, `WebFetch`, `WebSearch`, and `NotebookEdit` mechanically prevents any such action. This pattern is exercised across all UCs and most prominently in UC-1, UC-2, UC-3, UC-6, UC-7.

The interaction with Section 3 iteration 1 (`changelog-writer`) is also novel: `release-engineer` consumes the `[Unreleased]` section that `changelog-writer` maintains, but is INDEPENDENTLY configured -- a project may have a populated `[Unreleased]` and Gate 9 will package it even when `changelog-writer` is opted out (no `.claude/rules/changelog.md`). This independence is exercised in UC-2 (no `package.json`, first-ever release) and UC-16 (SDLC repo self-skip).

---

## UC-1: Empty `[Unreleased]` Skips Gate 9

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- The downstream project's `CHANGELOG.md` exists at the project root
- The `[Unreleased]` heading is present at the top of the file (e.g., `## [Unreleased]`) but the body is empty -- either no category subheadings (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), OR category subheadings present but with no entries underneath any of them
- The pre-flight `changelog-writer` sync from Section 3 FR-4.4 has run and either returned `no-op: not configured` or `no-op: already in sync` (the merge-ready output may include a non-blocking notice but proceeds to Gate 0)
- All earlier gates (Gate 0 through Gate 8) have completed (PASS or FAIL is irrelevant -- Gate 9 runs regardless of earlier gate status per FR-7.6)
- The agent file `src/agents/release-engineer.md` is installed at `~/.claude/agents/release-engineer.md` (per FR-8.6 / AC-15)
- The agent's `tools` frontmatter field is exactly `["Read", "Write", "Edit", "Glob", "Grep"]` (per FR-1.1 / AC-1) and excludes `Bash`, `WebFetch`, `WebSearch`, `NotebookEdit`

**Trigger**: `/merge-ready` reaches the end of the existing gate sequence (post-Gate 8) and delegates to `release-engineer` for Gate 9 per FR-7.1

### Primary Flow (Happy Path)

1. The `release-engineer` agent starts and performs its self-check first step per FR-1.3: it reads `CHANGELOG.md` at the project root using the `Read` tool
2. The agent parses the `[Unreleased]` section by locating the heading line `## [Unreleased]` (or equivalent) and reading until the next `## [` heading or end-of-file
3. The agent enumerates the six Keep a Changelog categories (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) and verifies that each is either absent OR present with no entries beneath it
4. The agent confirms the section is empty across all six categories
5. The agent returns the EXACT string `no-op: no unreleased changes` (per FR-1.3 and FR-6.7) and STOPS -- it does NOT compute a semver bump, does NOT touch `CHANGELOG.md`, does NOT touch `.claude/release-notes-*.md`, does NOT touch `.github/workflows/`, does NOT read any version-source file (per FR-1.3 explicit prohibition)
6. The agent does NOT invoke shell commands (per FR-1.1 `tools` frontmatter exclusion of `Bash`), does NOT make any network call (per NFR-6 / design decision 10), does NOT modify any other agent's prompt file (per design decision 10 NEVER list)
7. The agent returns control to the `/merge-ready` orchestrator
8. Per FR-7.2, `/merge-ready` reports Gate 9 as `SKIPPED` in the gate output table (NOT `PASS`, NOT `FAIL`) and surfaces the agent's `no-op: no unreleased changes` string as the gate detail
9. `/merge-ready` emits its final verdict including all 10 gates (with Gate 9 as `SKIPPED`) per AC-4

**Postconditions**:
- `CHANGELOG.md` is byte-for-byte unchanged (no rename of `[Unreleased]`, no fresh `[Unreleased]` insertion)
- No file at `.claude/release-notes-*.md` was created or modified
- `.github/workflows/release.yml` is byte-for-byte unchanged (or remains absent if it was absent)
- No version-source file was opened (per FR-1.3 explicit prohibition on FR-3 work in the no-op case)
- `/merge-ready` final verdict reports Gate 9 as `SKIPPED`
- Re-running `/merge-ready` immediately produces the same `SKIPPED` verdict (idempotent no-op)

**Related FR/AC**: FR-1.3, FR-6.7, FR-7.2, FR-7.5, NFR-6, NFR-9, AC-5

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-1-A1: `[Unreleased]` heading present with all six categories listed but every category empty** -- Some downstream projects keep skeleton category headings under `[Unreleased]` for hand-editing convenience
  1. Steps 1-2 proceed as in the primary flow
  2. At step 3 the agent finds all six category subheadings (`### Added`, `### Changed`, etc.) but each is followed by zero entries before the next `###` heading or the next `## [` section heading
  3. The agent treats this as semantically empty per FR-1.3 (the FR specifies "empty across all six Keep a Changelog categories" -- presence of an empty category subheading is not "non-empty")
  4. Steps 4-9 proceed unchanged, returning `no-op: no unreleased changes`

**Postconditions (UC-1-A1)**:
- Gate 9 reports `SKIPPED` despite the visual presence of all category headings
- `CHANGELOG.md` retains the empty skeleton category headings byte-for-byte

**Related FR/AC**: FR-1.3, FR-7.2

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-1-E1: `CHANGELOG.md` does not exist at all** -- The downstream project has no `CHANGELOG.md` (e.g., a project that has not deployed Section 3 iteration 1 or has not yet hit `changelog-writer`'s create-on-first-content invocation)
  1. The agent runs the self-check and attempts to read `CHANGELOG.md` at the project root using `Read`
  2. `Read` fails with a "file not found" / `ENOENT` equivalent
  3. The agent treats the missing file as semantically equivalent to an empty `[Unreleased]` per FR-1.3 ("If the section is missing entirely... the agent MUST return the exact string `no-op: no unreleased changes`")
  4. The agent returns the EXACT string `no-op: no unreleased changes` (skipped: nothing to release)
  5. The agent does NOT create `CHANGELOG.md` (creation is `changelog-writer`'s responsibility per Section 3 FR-2.8, not `release-engineer`'s)
  6. The agent does NOT proceed to FR-3 version detection, FR-4 bump computation, FR-5 CI/CD provisioning, or FR-6 structured summary
  7. `/merge-ready` reports Gate 9 as `SKIPPED` per FR-7.2

**Postconditions (UC-1-E1)**:
- `CHANGELOG.md` was NOT created -- it remains absent
- No release-notes file at `.claude/release-notes-*.md` was created
- `.github/workflows/release.yml` is unchanged (or remains absent)
- Gate 9 reports `SKIPPED` -- the SDLC repo's own `/merge-ready` runs hit this path per Dependency 19

**Related FR/AC**: FR-1.3, FR-7.2, AC-5, Dependency 19

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-1-EC1: `[Unreleased]` body has whitespace-only content** -- The body has a few blank lines between the heading and the next `## [` section, simulating prior content that was deleted but the heading retained
  1. The agent reads `CHANGELOG.md` and locates `## [Unreleased]`
  2. Between `## [Unreleased]` and the next section heading, the agent reads only whitespace (blank lines, possibly a trailing space)
  3. The agent treats the section as empty per FR-1.3
  4. Returns `no-op: no unreleased changes`

**Related FR/AC**: FR-1.3

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` at the project root (read-only, may be absent)
- **Output**: A single-line string `no-op: no unreleased changes` returned to the `/merge-ready` orchestrator
- **Side Effects**: Zero file mutations. No network. No Bash. No version-source-file reads. No `.github/workflows/` reads (the no-op short-circuits before FR-5 work).

---

## UC-2: First-Ever Release (Greenfield Project, No `package.json`, No Tags)

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` exists at the project root with the standard Keep a Changelog header (created earlier by `changelog-writer` per Section 3 FR-2.8) and a populated `[Unreleased]` section -- e.g., `### Added` with two entries describing the project's initial features
- The project has no prior versioned sections in `CHANGELOG.md` (only `[Unreleased]` exists -- no `[0.x.x]`, no `[1.x.x]`)
- No `package.json`, no `pyproject.toml`, no `Cargo.toml`, no `VERSION` file at the project root
- No git tags matching `v*.*.*` (verifiable via `Glob` over `.git/refs/tags/v*.*.*` returning zero matches)
- No `Version source:` line in `./CLAUDE.md` or `.claude/CLAUDE.md`
- `.github/workflows/` directory does not exist (or exists but contains no tag-triggered release workflow)
- All earlier gates have completed; pre-flight `changelog-writer` sync ran successfully

**Trigger**: `/merge-ready` reaches Gate 9 and invokes `release-engineer`

### Primary Flow (Happy Path)

1. The agent runs the self-check (FR-1.3): reads `CHANGELOG.md`, parses `[Unreleased]`, finds non-empty `Added` category -- self-check passes (the no-op path is NOT taken)
2. The agent proceeds to FR-3 version detection in the priority order: (a) checks `package.json` -- absent; (b) checks `pyproject.toml` -- absent; (c) checks `Cargo.toml` -- absent; (d) checks `VERSION` -- absent; (e) `Glob`s `.git/refs/tags/v*.*.*` -- zero matches
3. The agent checks the FR-3.2 override: reads `./CLAUDE.md` and `.claude/CLAUDE.md` for a `Version source:` line -- neither exists or neither contains the line
4. The agent applies the FR-3.3 fallback: current version = `0.1.0`, source = `(none -- fallback 0.1.0)`
5. The agent proceeds to FR-4 bump computation: enumerates `[Unreleased]` categories -- only `Added` is non-empty, no `breaking` token, no `Removed`. Per FR-4.1(b), bump type = **minor**
6. The agent applies the FR-4.2 pre-1.0 override check: current MAJOR is `0`, but the rule applied (minor) is already minor, so no coercion is needed. The override is noted in the bump explanation: "current version 0.1.0 is pre-1.0; minor bump produced 0.2.0; pre-1.0 override would have applied if rule had been major"
7. The agent computes new version = `0.2.0` (current `0.1.0` minor bump increments MINOR and zeros PATCH)
8. The agent proceeds to FR-2 CHANGELOG manipulation: reads `CHANGELOG.md`, locates the `## [Unreleased]` heading line, and rewrites the file as follows: (a) renames the heading to `## [0.2.0] - 2026-04-25` (today's date in ISO 8601 per FR-2.1(b)); (b) inserts a fresh empty `## [Unreleased]` heading immediately above the renamed heading per FR-2.1(c); (c) leaves all other content (header, prior versions if any -- none in this scenario) byte-for-byte unchanged per FR-2.2 and FR-2.3
9. The agent proceeds to FR-2.4: writes a new file at `.claude/release-notes-0.2.0.md` containing the body of the freshly renamed `[0.2.0] - 2026-04-25` section -- that is, the `### Added` subheading and its two entries, but NOT the `## [0.2.0] - 2026-04-25` heading itself
10. The agent proceeds to FR-5 CI/CD provisioning: inspects `.github/workflows/` -- the directory does not exist. Per FR-5.1, the agent treats this as the ABSENT case and proceeds to FR-5.2
11. The agent writes `.github/workflows/release.yml` with the FR-5.2 template, including: (a) the HTML comment `<!-- generated by claude-code-sdlc release-engineer at 2026-04-25 -->` on line 1; (b) `name: Release`; (c) `on: push: tags: ['v*.*.*']`; (d) `permissions: contents: write`; (e) the `softprops/action-gh-release@v2` step with `body_path` referencing `.claude/release-notes-${GITHUB_REF_NAME#v}.md` (or a small `run` step that strips the `v` prefix to produce the correct path) per FR-5.2 explicit note about prefix mismatch
12. The agent proceeds to FR-6 structured summary: emits a markdown block with the ten labeled sections in order:
    - **Detected version source**: `(none -- fallback 0.1.0)`
    - **Current version**: `0.1.0`
    - **Computed bump type**: `minor`
    - **New version**: `0.2.0`
    - **Path to renamed CHANGELOG section**: `CHANGELOG.md [0.2.0] - 2026-04-25`
    - **Path to release-notes file**: `.claude/release-notes-0.2.0.md`
    - **CI/CD status**: `provisioned new`
    - **Commands to run**: fenced shell block per FR-6.5 with `X.Y.Z` substituted as `0.2.0` and the version-source placeholder line preserved (developer must initialize a version source)
    - **Warnings**: includes the FR-3.3 fallback notice (no version source detected) -- "(1) no version source detected, using fallback 0.1.0; recommend the developer initialize a `package.json`, `VERSION`, or equivalent before subsequent releases"
    - **Bump computation explanation**: "[Unreleased] had non-empty Added (2 entries), no Removed, no breaking token. FR-4.1(b) → minor. Pre-1.0 override (FR-4.2) was checked but did not change the result (minor was already non-major)."
13. The agent does NOT execute any of the commands in the structured summary (per FR-2.7 and design decision 10 NEVER list)
14. The agent does NOT modify any version-source file (per FR-3.4 -- there is no version-source file to modify in this scenario, but the prohibition holds)
15. `/merge-ready` reports Gate 9 as `PASS` per FR-7.2 and surfaces the structured summary in the gate output

**Postconditions**:
- `CHANGELOG.md` has been rewritten: the original `[Unreleased]` heading was renamed to `[0.2.0] - 2026-04-25`, and a fresh empty `[Unreleased]` heading was inserted above it. All entries that were under the original `[Unreleased]` are now under `[0.2.0] - 2026-04-25`. The Keep a Changelog header is preserved byte-for-byte
- `.claude/release-notes-0.2.0.md` exists, containing the body of the `[0.2.0]` section (category subheadings + entries) without the `## [0.2.0]` heading
- `.github/workflows/release.yml` exists and starts with the agent's traceability HTML comment
- `/merge-ready` reports Gate 9 as `PASS`
- The developer reads the structured summary, manually creates a version source (e.g., runs `npm init` to create a `package.json` with `version: "0.2.0"`), and executes the commands in the summary
- After the developer commits and pushes the tag `v0.2.0`, the GitHub Actions workflow created in step 11 fires and creates a GitHub Release with the body sourced from `.claude/release-notes-0.2.0.md`
- Re-running `/merge-ready` immediately after Gate 9 produced this summary (and before the developer commits) results in Gate 9 reporting `SKIPPED` per FR-7.5 because `[Unreleased]` is now empty

**Related FR/AC**: FR-1.3, FR-1.5, FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-3.1, FR-3.3, FR-4.1, FR-4.2, FR-5.1, FR-5.2, FR-6.1 through FR-6.6, FR-7.2, FR-7.5, NFR-6, AC-6, AC-10, AC-11, AC-18

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-2-A1: `package.json` is present but has no `version` field** -- Some scaffolds emit a partial `package.json` without a `version` key
  1. Step 1 proceeds; self-check passes
  2. At step 2 the agent reads `package.json` and parses it as JSON, looks for the top-level `version` key -- it is absent
  3. Per FR-3.1 priority order, the agent treats this as "no version detected from `package.json`" and falls through to (b) `pyproject.toml` (absent), (c) `Cargo.toml` (absent), (d) `VERSION` (absent), (e) git tags (zero matches)
  4. The agent applies the FR-3.3 fallback: current version = `0.1.0`, source = `(none -- fallback 0.1.0)`
  5. The structured summary's "Warnings" section notes: "package.json present but lacks `version` field; falling through to next priority"
  6. Steps 5-15 proceed as in the primary flow with the same `0.2.0` outcome

**Postconditions (UC-2-A1)**:
- `package.json` is byte-for-byte unchanged (the agent reads but never writes per FR-3.4)
- The structured summary surfaces the missing-version-field warning to the developer
- The result is the same as the primary flow

**Related FR/AC**: FR-3.1, FR-3.3, FR-3.4, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-2-E1: `[Unreleased]` section malformed -- no closing heading found** -- `CHANGELOG.md` has a `## [Unreleased]` heading but the file ends abruptly inside the section, OR the next heading uses an unexpected level (e.g., `# [0.1.0]` with single `#` instead of `## [0.1.0]`) so the agent's parser cannot find the section boundary
  1. The agent runs the self-check and reads `CHANGELOG.md`
  2. The agent locates `## [Unreleased]` but searching for the next `## [` heading or end-of-file produces an ambiguous result (e.g., a heading at a different level interrupts the section)
  3. The agent emits a structured failure: `Gate 9 FAIL: cannot parse [Unreleased] section -- malformed CHANGELOG.md (no closing heading detected)`
  4. The agent does NOT proceed to FR-3, FR-4, FR-5, or FR-6 -- partial work prohibited per FR-1.5 ("If any step fails, the agent MUST report the failure and MUST NOT proceed to subsequent steps")
  5. NO file mutations occur: `CHANGELOG.md` is byte-for-byte unchanged, no `.claude/release-notes-*.md` is written, no `.github/workflows/release.yml` is written
  6. `/merge-ready` reports Gate 9 as `FAIL` per FR-7.2 with the failure message
  7. Per FR-7.6, the FAIL does NOT cause Gates 0-9 to be re-evaluated

**Postconditions (UC-2-E1)**:
- `CHANGELOG.md` is byte-for-byte unchanged
- No release-notes file was written
- `.github/workflows/release.yml` is unchanged (or remains absent)
- `/merge-ready` final verdict reports Gate 9 as `FAIL`; the developer must manually fix the malformed CHANGELOG and re-run `/merge-ready`

**Related FR/AC**: FR-1.5, FR-7.2, FR-7.6

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-2-EC1: `.github/workflows/` exists but contains only unrelated workflows (e.g., `ci.yml`, `lint.yml`)** -- The directory has files but none match the FR-5.1 detection regex
  1. Steps 1-9 proceed as in the primary flow
  2. At step 10 the agent uses `Glob` and `Grep` to find files matching the FR-5.1 regex -- no file in the directory contains a `on: push: tags: v*.*.*`-style trigger
  3. The agent treats this as the ABSENT case per FR-5.1
  4. Step 11 writes `.github/workflows/release.yml` alongside the existing `ci.yml` and `lint.yml` -- the existing files are NOT touched per FR-5.6
  5. Steps 12-15 proceed unchanged

**Postconditions (UC-2-EC1)**:
- `.github/workflows/release.yml` is created
- `.github/workflows/ci.yml`, `lint.yml`, and any other unrelated workflow files are byte-for-byte unchanged

**Related FR/AC**: FR-5.1, FR-5.2, FR-5.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` (with populated `[Unreleased]`); version-source priority files (none present); `./CLAUDE.md` and `.claude/CLAUDE.md` (no override line); `.github/workflows/` directory contents (none or unrelated)
- **Output**: Modified `CHANGELOG.md`; new `.claude/release-notes-0.2.0.md`; new `.github/workflows/release.yml`; structured markdown summary returned to `/merge-ready`
- **Side Effects**: Three file writes (`CHANGELOG.md`, `.claude/release-notes-0.2.0.md`, `.github/workflows/release.yml`). No network. No Bash. No git execution. No version-source-file edits. No modification of any other agent file or Claude Code configuration.

---

## UC-3: Subsequent Release with `package.json` Version Source

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` exists with at least one prior versioned section (e.g., `[1.4.2] - 2026-03-15`) and a populated `[Unreleased]` containing `### Added` entries (one or more) AND `### Fixed` entries (one or more), with no `Removed` and no `breaking` tokens
- `package.json` exists at the project root with `"version": "1.4.2"`
- `.github/workflows/release.yml` already exists, was previously generated by `release-engineer` (or hand-authored to follow the same pattern), uses the `softprops/action-gh-release@v2` action, and has `body_path: .claude/release-notes-${{ ... }}.md` referencing the FR-2.4 file naming convention
- No `Version source:` line in `./CLAUDE.md` or `.claude/CLAUDE.md`
- All earlier gates have completed; pre-flight `changelog-writer` sync ran successfully

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. The agent runs the self-check (FR-1.3): non-empty `[Unreleased]` -- self-check passes
2. The agent runs FR-3 version detection: (a) `package.json` is present -- the agent reads it via `Read`, parses as JSON, and finds `"version": "1.4.2"`. Priority (a) wins -- the agent stops at this priority and does NOT continue to (b)-(e)
3. The agent checks FR-3.2 override: no `Version source:` line in either `./CLAUDE.md` or `.claude/CLAUDE.md`. Auto-detection priority result stands
4. The agent applies FR-3.5: the version string `1.4.2` has no pre-release suffix and no build metadata. No stripping needed
5. The agent proceeds to FR-4: enumerates `[Unreleased]` categories -- `Added` non-empty AND `Fixed` non-empty, `Removed` empty, no `breaking` token. Per FR-4.1: rule (a) does not fire (no breaking, no Removed); rule (b) fires (Added is non-empty) → **minor** bump
6. The agent applies FR-4.2 pre-1.0 override check: current MAJOR = `1` (post-1.0). Override does NOT apply
7. The agent computes new version: `1.4.2` minor bump → `1.5.0` (MINOR increments, PATCH zeros)
8. The agent proceeds to FR-2: rewrites `CHANGELOG.md` -- renames `## [Unreleased]` to `## [1.5.0] - 2026-04-25`, inserts fresh empty `## [Unreleased]` above it; the prior `## [1.4.2] - 2026-03-15` section is byte-for-byte preserved per FR-2.2
9. The agent writes `.claude/release-notes-1.5.0.md` with the body of the `[1.5.0]` section (both `### Added` and `### Fixed` subheadings with their entries) per FR-2.4
10. The agent proceeds to FR-5: inspects `.github/workflows/` and finds `release.yml`. Uses `Read` and `Grep` to verify the file contains the FR-5.1 detection regex (a `on: push: tags: ['v*.*.*']`-style trigger) AND the body source is `body_path: .claude/release-notes-${{ ... }}.md` per FR-5.3. Both checks pass. The agent reports `present-and-correct` and makes NO changes to `.github/workflows/release.yml`
11. The agent emits the FR-6 structured summary:
    - **Detected version source**: `package.json`
    - **Current version**: `1.4.2`
    - **Computed bump type**: `minor`
    - **New version**: `1.5.0`
    - **Path to renamed CHANGELOG section**: `CHANGELOG.md [1.5.0] - 2026-04-25`
    - **Path to release-notes file**: `.claude/release-notes-1.5.0.md`
    - **CI/CD status**: `present-and-correct`
    - **Commands to run**: per FR-6.5 with `X.Y.Z` = `1.5.0`. Because CI/CD status is `present-and-correct`, the `git add` line OMITS `.github/workflows/release.yml` (the agent did not modify it) per FR-6.5. The version-source placeholder line is `<update version-source if needed per project tooling>` -- developer is expected to run `npm version 1.5.0` to bump `package.json`
    - **Warnings**: `(none)`
    - **Bump computation explanation**: "[Unreleased] had non-empty Added and Fixed, no Removed, no breaking token. FR-4.1(b) → minor. Post-1.0 -- override (FR-4.2) does not apply."
12. `/merge-ready` reports Gate 9 as `PASS`

**Postconditions**:
- `CHANGELOG.md` modified: new `[1.5.0] - 2026-04-25` section, fresh `[Unreleased]` heading above; `[1.4.2] - 2026-03-15` and earlier sections byte-for-byte unchanged
- `.claude/release-notes-1.5.0.md` exists with category-and-entries body
- `.github/workflows/release.yml` is byte-for-byte unchanged
- `package.json` is byte-for-byte unchanged (developer will bump separately via `npm version 1.5.0`)
- `/merge-ready` reports Gate 9 as `PASS`
- After the developer runs `npm version 1.5.0`, commits, and pushes `git push origin v1.5.0`, the existing GitHub Actions workflow fires and creates the release with body sourced from `.claude/release-notes-1.5.0.md`

**Related FR/AC**: FR-1.5, FR-2.1, FR-2.2, FR-2.4, FR-3.1, FR-3.4, FR-3.5, FR-4.1, FR-4.2, FR-4.5, FR-5.3, FR-5.5, FR-6.1, FR-6.5, FR-7.2, AC-6, AC-7

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-3-A1: `pyproject.toml` priority (no `package.json`, has `pyproject.toml`)** -- Python project using Poetry or PEP 621
  1. Step 1 proceeds; self-check passes
  2. At step 2 the agent checks (a) `package.json` -- absent. Then checks (b) `pyproject.toml` -- present. Reads it via `Read`, locates `[tool.poetry] version = "1.4.2"` (Poetry case) OR `[project] version = "1.4.2"` (PEP 621 case). Per FR-3.1, the first present value wins. The agent stops at priority (b) and does NOT continue to (c)-(e)
  3. Steps 3-12 proceed as in the primary flow with current version `1.4.2`, new version `1.5.0`
  4. The structured summary's "Detected version source" line reports `pyproject.toml`
  5. The version-source placeholder line in the commands block is `<update version-source if needed per project tooling>` -- developer is expected to run `poetry version 1.5.0` (Poetry) or hand-edit (PEP 621 projects without a CLI tool)

**Postconditions (UC-3-A1)**:
- Same as primary flow except "Detected version source" = `pyproject.toml`
- `pyproject.toml` is byte-for-byte unchanged

**Related FR/AC**: FR-3.1, FR-3.4, FR-6.2

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-3-A2: `Cargo.toml` priority (no `package.json`, no `pyproject.toml`, has `Cargo.toml`)** -- Rust project
  1. The agent checks (a) `package.json` -- absent, (b) `pyproject.toml` -- absent, (c) `Cargo.toml` -- present. Reads it, locates `[package] version = "1.4.2"`. Stops at priority (c)
  2. Steps proceed as in the primary flow
  3. The structured summary's "Detected version source" = `Cargo.toml`
  4. The version-source placeholder line is `<update version-source if needed per project tooling>` -- developer runs `cargo set-version 1.5.0` or hand-edits

**Postconditions (UC-3-A2)**:
- Same as primary flow except "Detected version source" = `Cargo.toml`
- `Cargo.toml` is byte-for-byte unchanged

**Related FR/AC**: FR-3.1, FR-3.4, FR-6.2

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-3-A3: `VERSION` plain file priority (no `package.json`, no `pyproject.toml`, no `Cargo.toml`, has `VERSION`)** -- Project that tracks version in a plain file
  1. The agent checks (a)-(c) -- all absent. Then (d) `VERSION` -- present. Reads it, strips whitespace per FR-3.1(d), gets `1.4.2`. Stops at priority (d)
  2. Steps proceed as in the primary flow
  3. The structured summary's "Detected version source" = `VERSION`
  4. The version-source placeholder line is `<update version-source if needed per project tooling>` -- developer hand-edits `VERSION` to contain `1.5.0`

**Postconditions (UC-3-A3)**:
- Same as primary flow except "Detected version source" = `VERSION`
- `VERSION` is byte-for-byte unchanged

**Related FR/AC**: FR-3.1, FR-3.4, FR-6.2

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-3-A4: Latest git tag priority (no source file, has `v1.4.2` git tag)** -- Project that tracks version exclusively via git tags
  1. The agent checks (a)-(d) -- all absent. Then (e) `Glob` over `.git/refs/tags/v*.*.*` -- finds files including `v1.0.0`, `v1.4.2`, `v0.9.0`. The agent identifies the latest by parsing semver components from each filename: `1.4.2` is the highest. Stops at priority (e)
  2. Steps proceed as in the primary flow
  3. The structured summary's "Detected version source" = `git tag v1.4.2` (or equivalent disambiguating string showing the agent read the tag, not a file)
  4. The version-source placeholder line is `<update version-source if needed per project tooling>` -- but in this scenario, since version is tracked only via git tags, the placeholder may be replaced with `# version source is git tag (created later by 'git tag -a v1.5.0' in the commands below)` per the developer's discretion. The agent does NOT auto-customize this line based on the source -- the placeholder remains as written in FR-6.5

**Postconditions (UC-3-A4)**:
- Same as primary flow except "Detected version source" = `git tag v1.4.2`
- `.git/refs/tags/` is byte-for-byte unchanged (the agent reads but never writes -- the new tag will be created by the developer's `git tag` command per the structured summary)

**Related FR/AC**: FR-3.1(e), FR-3.4, FR-6.2

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-3-E1: Cannot determine version source from any priority (no source file, no override, no git tags)** -- This is the FR-3.3 fallback path; functionally the same as UC-2 but worth distinguishing as an explicit error-path documentation entry
  1. The agent checks (a)-(e) per FR-3.1 -- all empty
  2. The agent checks FR-3.2 override -- absent
  3. The agent applies FR-3.3 fallback: current version = `0.1.0`
  4. The agent emits a warning: "no version source detected; using fallback 0.1.0"
  5. The agent proceeds with bump computation using `0.1.0` as the current version
  6. The structured summary's "Detected version source" = `(none -- fallback 0.1.0)` and the "Warnings" section includes the no-source warning

**Postconditions (UC-3-E1)**:
- The agent succeeds (the missing version source is degraded mode, not a hard failure -- FR-3.3 explicitly defines fallback)
- The structured summary surfaces the warning so the developer can correct by initializing a version source before publishing

**Related FR/AC**: FR-3.3, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-3-EC1: Multiple version sources present (`package.json` AND `VERSION` both exist with different values)** -- A project in transition between version-tracking conventions
  1. At step 2 the agent finds `package.json` with `"version": "1.4.2"` -- priority (a) wins immediately
  2. The agent does NOT read `VERSION` for version detection (priority order short-circuits at first present source)
  3. However, the agent emits a warning per FR-3.1: "multiple version sources detected (package.json, VERSION); package.json wins per priority order; recommend the developer reconcile to a single source"
  4. The structured summary's "Warnings" section includes the multiple-sources warning

**Postconditions (UC-3-EC1)**:
- The detection result is `package.json` with version `1.4.2`
- `VERSION` file is byte-for-byte unchanged
- The developer is alerted to the inconsistency

**Related FR/AC**: FR-3.1, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` (populated `[Unreleased]`); `package.json` (read-only); `./CLAUDE.md` and `.claude/CLAUDE.md` (no override line); `.github/workflows/release.yml` (read-only -- already present and correct)
- **Output**: Modified `CHANGELOG.md`; new `.claude/release-notes-1.5.0.md`; structured markdown summary
- **Side Effects**: Two file writes (`CHANGELOG.md`, `.claude/release-notes-1.5.0.md`). The agent does NOT write `.github/workflows/release.yml` because it is already present-and-correct per FR-5.3 / FR-5.5. No version-source-file edits. No git execution.

---

## UC-4: Pre-1.0 Project With Breaking Change in `[Unreleased]`

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` exists with `[Unreleased]` containing `### Removed` with at least one entry (e.g., "Removed deprecated `oldEndpoint` API")
- `package.json` `"version": "0.7.3"`
- `.github/workflows/release.yml` exists and is `present-and-correct`
- All other preconditions per UC-3

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Self-check passes (non-empty `[Unreleased]`)
2. FR-3 detection: `package.json` priority (a) wins, current version = `0.7.3`
3. FR-4 bump: `Removed` is non-empty per FR-4.1(a) → would produce **major**
4. FR-4.2 pre-1.0 override check: current MAJOR = `0` → the major rule MUST be coerced to **minor**. The override fires
5. The agent computes new version: `0.7.3` minor bump → `0.8.0`
6. FR-2 CHANGELOG manipulation: renames `[Unreleased]` to `[0.8.0] - 2026-04-25`, inserts fresh `[Unreleased]` above
7. FR-2.4: writes `.claude/release-notes-0.8.0.md` with the `### Removed` body
8. FR-5 CI/CD: `release.yml` is `present-and-correct`, no changes
9. FR-6 structured summary:
    - **Detected version source**: `package.json`
    - **Current version**: `0.7.3`
    - **Computed bump type**: `minor`
    - **New version**: `0.8.0`
    - **CI/CD status**: `present-and-correct`
    - **Warnings**: `(1) pre-1.0 override applied -- the [Unreleased] Removed category would normally produce a major bump; per FR-4.2 pre-1.0 projects (current MAJOR = 0) coerce major to minor to preserve SemVer 2.0 conventions for 0.x series`
    - **Bump computation explanation**: "[Unreleased] had non-empty Removed (1 entry), no breaking token. FR-4.1(a) → major. Pre-1.0 override (FR-4.2) coerced major → minor. Result: 0.7.3 → 0.8.0."
10. `/merge-ready` reports Gate 9 as `PASS`

**Postconditions**:
- `CHANGELOG.md` shows `[0.8.0] - 2026-04-25` (NOT `[1.0.0]`) -- the pre-1.0 override prevented a premature 1.0 release
- The structured summary explicitly informs the developer about the pre-1.0 coercion so they can manually bump to `1.0.0` if they actually intend a stable major release

**Related FR/AC**: FR-4.1(a), FR-4.2, FR-6.4, FR-6.6, AC-7(d)

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-4-EC1: Pre-1.0 with `breaking:` token in entry text** -- e.g., `### Added` contains an entry like `- breaking: renamed config field foo to bar`
  1. FR-4.1(a) checks for `breaking` token (case-insensitive, word-boundary match) -- finds it
  2. Rule (a) fires → would produce **major**
  3. FR-4.2 pre-1.0 override fires → coerces to **minor**
  4. Result and structured summary are equivalent to UC-4 primary flow but the bump explanation cites the `breaking` token rather than `Removed`

**Related FR/AC**: FR-4.1(a), FR-4.2

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` with `[Unreleased]` containing `### Removed` (or `breaking` token); `package.json` with pre-1.0 version
- **Output**: Modified `CHANGELOG.md` with `[0.X.0]` heading (NOT `[1.0.0]`); release-notes file; structured summary annotating the override
- **Side Effects**: Same as UC-3 (two file writes when CI is present-and-correct).

---

## UC-5: `Version source:` Override in `CLAUDE.md`

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` has populated `[Unreleased]`
- `package.json` exists at the project root with `"version": "1.0.0"` (would normally win priority (a))
- `VERSION` file exists at the project root with content `2.3.1` (priority (d), would lose to package.json under FR-3.1)
- `.claude/CLAUDE.md` contains a line `Version source: VERSION` (matching the FR-3.2 regex `^Version source:\s*(.+)$`)
- All other preconditions per UC-3

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Self-check passes
2. FR-3.1 priority detection BEGINS (the agent always reads version-source candidates in some implementation order)
3. FR-3.2 override check: the agent reads `./CLAUDE.md` -- absent. Then reads `.claude/CLAUDE.md` -- present. Locates the line `Version source: VERSION` per the FR-3.2 regex. The override is captured: path = `VERSION`
4. The agent verifies the override path resolves to an existing file: `VERSION` exists at the project root. The override wins OVER FR-3.1's priority (a) (which would have selected `package.json`)
5. The agent reads `VERSION`, strips whitespace, gets `2.3.1`
6. FR-3.5: no pre-release suffix, no stripping
7. FR-4 bump: based on the actual `[Unreleased]` content. For this scenario, assume `### Added` non-empty, no `Removed`, no `breaking` token → minor. Current `2.3.1` → new `2.4.0`
8. FR-4.2 pre-1.0 check: MAJOR = `2`, override does not apply
9. FR-2 manipulation: renames to `[2.4.0] - 2026-04-25`, fresh `[Unreleased]` above
10. FR-2.4: writes `.claude/release-notes-2.4.0.md`
11. FR-5: assume `release.yml` present-and-correct
12. FR-6 structured summary:
    - **Detected version source**: `CLAUDE.md Version source: VERSION` (per FR-6.2 -- the override origin is reported, not just the resolved path)
    - **Current version**: `2.3.1`
    - **Computed bump type**: `minor`
    - **New version**: `2.4.0`
    - **CI/CD status**: `present-and-correct`
    - **Warnings**: `(1) Version source: override active -- using VERSION instead of package.json. Note that package.json contains a different version (1.0.0); recommend the developer reconcile if package.json is also intended to track the project version`
    - **Bump computation explanation**: standard

**Postconditions**:
- The override won over priority (a) `package.json`
- `package.json` is byte-for-byte unchanged (the agent did NOT bump it -- the agent never writes version-source files per FR-3.4, and `package.json` is not even the active version source in this run)
- `VERSION` is byte-for-byte unchanged (the agent reads but never writes per FR-3.4)
- The structured summary alerts the developer to the discrepancy between `package.json` (1.0.0) and `VERSION` (2.3.1) so they can fix the inconsistency

**Related FR/AC**: FR-3.1, FR-3.2, FR-3.4, FR-6.2, FR-6.6, AC-9

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-5-A1: `Version source:` points to non-existent file** -- e.g., `Version source: VERSION` but `VERSION` does not exist
  1. Step 3 captures the override path `VERSION`
  2. Step 4 attempts to verify the path -- the file does not exist
  3. Per FR-3.2, the agent emits a warning and falls back to FR-3.1 priority order
  4. The agent then runs FR-3.1: `package.json` priority (a) wins -- version `1.0.0`
  5. The structured summary's "Detected version source" = `package.json` and "Warnings" includes: "Version source: override path 'VERSION' does not exist; falling back to auto-detection (package.json wins)"
  6. Bump computation proceeds with `1.0.0` as current version

**Postconditions (UC-5-A1)**:
- The agent succeeded by falling back; no hard failure
- The developer is alerted to fix the invalid override

**Related FR/AC**: FR-3.2, FR-3.1, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-5-A2: `Version source:` matches what the priority detection would also choose -- idempotent override** -- e.g., `Version source: package.json` and `package.json` exists with `"version": "1.4.2"`
  1. Step 3 captures override path = `package.json`
  2. Step 4 verifies `package.json` exists
  3. The override wins, but the resolved source is the same as priority (a) would have produced
  4. The agent does NOT emit a warning (no priority disagreement)
  5. The structured summary's "Detected version source" = `CLAUDE.md Version source: package.json` (the override is still surfaced, even though the result matches auto-detection -- this transparency helps the developer audit the configuration)

**Postconditions (UC-5-A2)**:
- Same outcome as auto-detection would have produced
- Developer sees the override is configured and active (even if redundant)

**Related FR/AC**: FR-3.2, FR-6.2

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-5-E1: `Version source:` line present in CLAUDE.md but the file is unreadable** -- e.g., the override path resolves to a file with read permission denied, or to a directory rather than a file
  1. Step 3 captures override path
  2. Step 4 attempts to read the resolved path -- read fails with permission error or "is a directory"
  3. Per FR-3.2's "fall back to the priority order in FR-3.1" provision, the agent emits a degraded-mode warning: "Version source: override path '<path>' is unreadable (<reason>); falling back to auto-detection"
  4. The agent runs FR-3.1 priority order
  5. The structured summary surfaces the degraded-mode warning
  6. If FR-3.1 also fails (no source file present), the agent applies FR-3.3 fallback to `0.1.0`

**Postconditions (UC-5-E1)**:
- The agent succeeded via fallback; no hard failure
- Developer sees the unreadable override warning

**Related FR/AC**: FR-3.2, FR-3.1, FR-3.3, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md`; `./CLAUDE.md` and `.claude/CLAUDE.md` (override line in one of them); the override-target file (read-only); the priority-order files (potentially also read in UC-5-A1 fallback)
- **Output**: Modified `CHANGELOG.md`; release-notes file; structured summary with the override-aware "Detected version source"
- **Side Effects**: Two file writes (CHANGELOG and release-notes). No version-source-file writes. No CLAUDE.md writes (the agent reads but does not modify the override line).

---

## UC-6: CI/CD Workflow Already Present and Correct

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- All preconditions per UC-3 (populated `[Unreleased]`, `package.json` present, etc.)
- `.github/workflows/release.yml` exists with the following pertinent lines: `on: push: tags: ['v*.*.*']` AND `body_path: .claude/release-notes-...md` (the exact path may use `${GITHUB_REF_NAME#v}` or equivalent shell expansion to derive the filename from the tag)
- The workflow may or may not contain the agent's traceability HTML comment from FR-5.2; the body-source check is the authoritative criterion per FR-5.5

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Self-check passes
2. FR-3 detection succeeds (e.g., `package.json` 1.4.2)
3. FR-4 computes new version (e.g., 1.5.0)
4. FR-2 rewrites CHANGELOG and writes release-notes file
5. FR-5 CI/CD inspection:
   - The agent uses `Glob` over `.github/workflows/*.yml` and `*.yaml` to enumerate workflow files
   - For each candidate, uses `Read` and `Grep` to check for the FR-5.1 detection regex (a `on: push: tags: v*.*.*`-style trigger)
   - For files matching the trigger regex, the agent then checks whether `body_path:` references a path under `.claude/release-notes-*.md` OR whether the workflow extracts a version section from `CHANGELOG.md` directly via a `run:` step
   - `release.yml` matches both checks (trigger + body source)
   - The agent reports `present-and-correct` per FR-5.3
6. FR-6 structured summary: "CI/CD status: `present-and-correct`"; the commands block omits `.github/workflows/release.yml` from the `git add` line per FR-6.5
7. `/merge-ready` reports Gate 9 as `PASS`

**Postconditions**:
- `.github/workflows/release.yml` is byte-for-byte unchanged
- `.github/workflows/` contains exactly the files it contained before -- no new file, no deleted file
- The agent's traceability HTML comment status (present or absent in the existing file) is irrelevant to the outcome -- the body-source check is authoritative per FR-5.5

**Related FR/AC**: FR-5.1, FR-5.3, FR-5.5, FR-6.3, FR-6.5, AC-10

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: existing `.github/workflows/release.yml` (read-only)
- **Output**: structured summary reporting `present-and-correct`; CHANGELOG and release-notes mutations as in UC-3
- **Side Effects**: Zero writes to `.github/workflows/`. Two writes total (CHANGELOG, release-notes).

---

## UC-7: CI/CD Workflow Present But Body Source Is Not CHANGELOG-Derived

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- All preconditions per UC-3 (populated `[Unreleased]`, version source present)
- `.github/workflows/release.yml` exists with `on: push: tags: ['v*.*.*']` BUT uses GitHub auto-generated release notes -- e.g., contains `generate_release_notes: true` or has hardcoded body text or extracts from a different file (e.g., a custom `RELEASE_BODY.md`)

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Self-check passes
2. FR-3 detection succeeds
3. FR-4 computes new version
4. FR-2 rewrites CHANGELOG and writes release-notes file
5. FR-5 CI/CD inspection:
   - The agent identifies `.github/workflows/release.yml` as having a tag-triggered release workflow per FR-5.1
   - Body-source check: the file does NOT contain `body_path:` referencing a `.claude/release-notes-*.md` file, AND does NOT contain a `run:` step extracting from `CHANGELOG.md`. Instead, the agent finds `generate_release_notes: true` (or hardcoded body text)
   - Per FR-5.4, the agent emits a warning identifying the workflow file (`.github/workflows/release.yml`) and the body source it found (`generate_release_notes: true` -- commit-log-derived auto-generated notes)
   - The agent does NOT modify the existing workflow per FR-5.4 ("respecting an existing CI/CD configuration is more important than enforcing the SDLC's preferred body source")
6. FR-6 structured summary:
   - **CI/CD status**: `present-but-warning: workflow uses GitHub auto-generated release notes (generate_release_notes: true) instead of CHANGELOG.md-derived body. The agent did not modify the workflow. To consume .claude/release-notes-X.Y.Z.md as the release body, the developer can update .github/workflows/release.yml to use 'softprops/action-gh-release@v2' with 'body_path: .claude/release-notes-${GITHUB_REF_NAME#v}.md'`
   - **Warnings**: includes the same CI/CD body-source warning
   - **Commands to run**: per FR-6.5; the `git add` line OMITS `.github/workflows/release.yml` (the agent did not modify it)
7. `/merge-ready` reports Gate 9 as `PASS` (the warning does NOT cause Gate 9 to FAIL -- warnings are informational)

**Postconditions**:
- `.github/workflows/release.yml` is byte-for-byte unchanged
- The developer reads the warning and decides whether to migrate the workflow manually
- If the developer pushes the tag without migrating, the GitHub Release will be created with auto-generated body (commit-log-derived) -- the `.claude/release-notes-X.Y.Z.md` file will exist on disk and committed but the GitHub Release won't reference it. This is the documented degraded mode

**Related FR/AC**: FR-5.1, FR-5.4, FR-6.3, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-7-A1: Workflow file is syntactically valid YAML but unrelated (not release-on-tag)** -- e.g., `.github/workflows/release.yml` contains a `on: workflow_dispatch:` trigger (manual dispatch) for some other purpose, with no `on: push: tags:`
  1. The agent uses `Glob` and finds `release.yml`
  2. The agent uses `Grep` for the FR-5.1 detection regex `on: push: tags: v*.*.*`
  3. No match -- the file is NOT a tag-triggered release workflow
  4. The agent treats this as the ABSENT case per FR-5.1 (no tag-triggered release workflow detected, regardless of file naming)
  5. The agent proceeds to FR-5.2 ABSENT case... BUT `.github/workflows/release.yml` already exists. Writing `release.yml` would OVERWRITE the unrelated workflow
  6. To prevent overwrite, the agent applies the FR-5.6 prohibition ("MUST NOT modify `.github/workflows/` files OTHER THAN `release.yml`") -- but the FR-5.6 wording protects OTHER files, not `release.yml` itself. The agent must reconcile: the existing `release.yml` is unrelated to release packaging
  7. Per the FR-5.4 spirit ("respecting an existing CI/CD configuration"), the agent emits `present-but-different-purpose` (a CI/CD status variant per the agent's prompt -- or the agent maps it to `present-but-warning: existing release.yml file does not match release-on-tag pattern; agent did not overwrite to avoid clobbering unrelated workflow`), and does NOT write `release.yml`
  8. The structured summary surfaces the warning and recommends the developer either rename the existing file or migrate it to a release-on-tag pattern
  9. `/merge-ready` reports Gate 9 as `PASS` with the warning surfaced

**Postconditions (UC-7-A1)**:
- `.github/workflows/release.yml` is byte-for-byte unchanged
- The developer is alerted that no tag-triggered release workflow was provisioned because a file at the target path already exists for an unrelated purpose

**Related FR/AC**: FR-5.1, FR-5.2, FR-5.4, FR-5.6, FR-6.3, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: existing `.github/workflows/release.yml` (read-only) with non-CHANGELOG-derived body source
- **Output**: structured summary with `present-but-warning` CI/CD status and explanatory warning text; CHANGELOG and release-notes mutations
- **Side Effects**: Two writes (CHANGELOG, release-notes). Zero writes to `.github/workflows/`.

---

## UC-8: Patch Bump (Only `Fixed` Entries in `[Unreleased]`)

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` `[Unreleased]` has ONLY `### Fixed` entries (no `Added`, no `Changed`, no `Removed`, no `Deprecated`, no `Security`, no `breaking` tokens anywhere)
- `package.json` `"version": "1.4.2"`
- All other preconditions per UC-3

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Self-check passes (`Fixed` is non-empty)
2. FR-3 detection: `package.json` → `1.4.2`
3. FR-4 bump: rule (a) does not fire (no breaking, no Removed); rule (b) does not fire (no Added, no Changed); rule (c) fires (only Fixed is non-empty) → **patch**
4. FR-4.2 pre-1.0 check: MAJOR = 1, override does not apply
5. New version: `1.4.2` patch bump → `1.4.3` (PATCH increments)
6. FR-2 manipulation: renames to `[1.4.3] - 2026-04-25`, fresh `[Unreleased]` above
7. FR-2.4: writes `.claude/release-notes-1.4.3.md`
8. FR-5: present-and-correct (assumed)
9. FR-6 structured summary:
    - **Computed bump type**: `patch`
    - **New version**: `1.4.3`
    - **Bump computation explanation**: "[Unreleased] had only Fixed (N entries), no Added, no Changed, no Removed, no breaking token, no Deprecated, no Security. FR-4.1(c) → patch."

**Postconditions**:
- New version is `1.4.3` (PATCH bump, NOT minor)
- The structured summary correctly reports the conservative patch classification

**Related FR/AC**: FR-4.1(c), FR-4.5, AC-7(a)

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-8-E1: `Removed` AND `Fixed` both present, agent must choose conservative bump** -- a corner case in classification heuristic where the entries straddle major and patch
  1. `[Unreleased]` has BOTH `### Removed` (one entry) AND `### Fixed` (one entry), no `Added`, no `Changed`, no `breaking`
  2. FR-4.1 evaluation: rule (a) checks for breaking OR non-empty Removed -- Removed is non-empty → rule (a) FIRES → **major** (or **minor** under pre-1.0 override per FR-4.2)
  3. The agent does NOT downgrade to patch despite the presence of Fixed entries -- the conservative interpretation is that Removed is the dominant category for bump purposes per FR-4.1's evaluation order (a → b → c)
  4. The structured summary's "Bump computation explanation" notes both categories: "[Unreleased] had non-empty Removed (1 entry) AND non-empty Fixed (1 entry). FR-4.1(a) fires on Removed → major (or minor with pre-1.0 override). Fixed entries are still recorded in the renamed [X.Y.Z] section but do NOT downgrade the bump."

**Postconditions (UC-8-E1)**:
- The bump is MAJOR (or MINOR pre-1.0), not PATCH -- the conservative interpretation favors the larger bump
- Both `Removed` and `Fixed` entries are recorded in the renamed `[X.Y.Z]` section per FR-2.1 (the agent does not filter entries -- it computes bump from category presence)

**Related FR/AC**: FR-4.1, FR-4.2

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` with `[Unreleased]` containing only `### Fixed` entries; `package.json`
- **Output**: PATCH-bumped CHANGELOG; release-notes; structured summary
- **Side Effects**: Two writes (CHANGELOG, release-notes), per UC-3.

---

## UC-9: Major Bump (Post-1.0 With `Removed` or `breaking` Token)

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` `[Unreleased]` has `### Removed` entries OR an entry text containing the `breaking` word-boundary token
- `package.json` `"version": "2.3.1"` (post-1.0)
- All other preconditions per UC-3

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Self-check passes
2. FR-3 detection: `package.json` → `2.3.1`
3. FR-4 bump: rule (a) fires (breaking token OR non-empty Removed) → **major**
4. FR-4.2 pre-1.0 check: MAJOR = 2, override does NOT apply
5. New version: `2.3.1` major bump → `3.0.0` (MAJOR increments, MINOR and PATCH zero)
6. FR-2 manipulation: renames to `[3.0.0] - 2026-04-25`, fresh `[Unreleased]` above
7. FR-2.4: writes `.claude/release-notes-3.0.0.md`
8. FR-5: present-and-correct
9. FR-6 structured summary:
    - **Computed bump type**: `major`
    - **New version**: `3.0.0`
    - **Bump computation explanation**: "[Unreleased] had non-empty Removed (or breaking token), per FR-4.1(a) → major. Post-1.0 -- override (FR-4.2) does not apply."

**Postconditions**:
- New version is `3.0.0` (MAJOR bump as the developer intended)

**Related FR/AC**: FR-4.1(a), FR-4.2, FR-4.5, AC-7(c)

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` with `[Unreleased]` containing `Removed` or `breaking` token; `package.json` post-1.0
- **Output**: MAJOR-bumped CHANGELOG; release-notes; structured summary
- **Side Effects**: Two writes.

---

## UC-10: Idempotency -- Re-Run on Already-Released Branch

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9 on a SECOND consecutive run after a prior run produced a structured summary
**Preconditions**:
- A prior `/merge-ready` invocation reached Gate 9, the agent ran the full sequence, rewrote `CHANGELOG.md` (renamed `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, inserted fresh empty `[Unreleased]`), wrote `.claude/release-notes-X.Y.Z.md`, and either provisioned `.github/workflows/release.yml` or reported it `present-and-correct`
- The developer has NOT yet executed the structured summary commands (no version-source bump, no commit, no tag, no push) -- OR has only partially executed (e.g., committed but not yet tagged/pushed)
- `[Unreleased]` is now empty (the entries were renamed to `[X.Y.Z]` in the prior run)
- `/merge-ready` is invoked again

**Trigger**: `/merge-ready` reaches Gate 9 for the second time

### Primary Flow (Happy Path)

1. The agent runs the self-check per FR-1.3
2. The agent reads `CHANGELOG.md`, locates `[Unreleased]` -- empty across all six categories (the prior run renamed the populated content to `[X.Y.Z]`)
3. The agent returns `no-op: no unreleased changes` per FR-1.3
4. `/merge-ready` reports Gate 9 as `SKIPPED` per FR-7.2
5. NO file mutations occur on this second run

**Postconditions**:
- `CHANGELOG.md` is byte-for-byte unchanged from the state left by the first run
- `.claude/release-notes-X.Y.Z.md` is byte-for-byte unchanged (the agent does NOT delete the prior run's release-notes file per FR-2.6)
- `.github/workflows/release.yml` is byte-for-byte unchanged
- `/merge-ready` reports Gate 9 as `SKIPPED` -- this is the natural idempotency boundary per FR-7.5

**Related FR/AC**: FR-1.3, FR-2.6, FR-7.5, AC-18

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` with empty `[Unreleased]` (and a populated `[X.Y.Z]` from the prior run)
- **Output**: `no-op: no unreleased changes`
- **Side Effects**: Zero file mutations on the second run.

---

## UC-11: Two `[Unreleased]` Sections (Corruption)

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` exists but contains TWO `## [Unreleased]` headings (corruption from a hand-edit, a merge conflict resolution mistake, or a buggy upstream tool). For example, the file has `## [Unreleased]` near the top with one set of entries, and another `## [Unreleased]` further down with different entries
- All other preconditions per UC-3

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path -- Error Path)

1. The agent reads `CHANGELOG.md`
2. The agent searches for `## [Unreleased]` headings via parsing -- finds two
3. The agent emits a structured failure: `Gate 9 FAIL: CHANGELOG.md contains multiple [Unreleased] sections (N=2 detected). Manual reconciliation required before release packaging can proceed.`
4. Per FR-1.5, the agent does NOT proceed to FR-3, FR-4, FR-5, or FR-6
5. NO file mutations occur
6. `/merge-ready` reports Gate 9 as `FAIL` per FR-7.2 with the failure message
7. Per FR-7.6, Gates 0-9 are NOT re-evaluated

**Postconditions**:
- `CHANGELOG.md` is byte-for-byte unchanged
- No release-notes file written
- `.github/workflows/release.yml` unchanged (or remains absent)
- `/merge-ready` final verdict reports Gate 9 as `FAIL`; the developer fixes the corruption and re-runs

**Related FR/AC**: FR-1.5, FR-7.2, FR-7.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: malformed `CHANGELOG.md` with duplicate `[Unreleased]` headings
- **Output**: failure message
- **Side Effects**: Zero mutations.

---

## UC-12: CI/CD Workflow Uses Deprecated Release Action

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- All preconditions per UC-3
- `.github/workflows/release.yml` exists with `on: push: tags: ['v*.*.*']` AND uses the deprecated `actions/create-release@v1` action (rather than `softprops/action-gh-release@v2`)
- The deprecated action does NOT support `body_path` -- the workflow either has hardcoded `body:` text or pulls the body from a non-CHANGELOG source

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path)

1. Steps 1-5 proceed as in UC-3 (CHANGELOG and release-notes mutations succeed)
2. FR-5 CI/CD inspection:
   - The agent finds `release.yml` matches the FR-5.1 trigger regex
   - Body-source check: the workflow contains `actions/create-release@v1` AND does NOT have `body_path:` referencing `.claude/release-notes-*.md`
   - Per FR-5.4, the agent emits `present-but-warning` and does NOT modify the workflow
3. FR-6 structured summary:
   - **CI/CD status**: `present-but-warning: workflow uses deprecated actions/create-release@v1 (archived August 2022) and does not derive release body from CHANGELOG.md. The agent did not modify the workflow. Recommended migration: replace with 'softprops/action-gh-release@v2' and add 'body_path: .claude/release-notes-${GITHUB_REF_NAME#v}.md'`
   - **Warnings**: includes the deprecation warning AND the body-source warning
4. `/merge-ready` reports Gate 9 as `PASS` with warnings surfaced

**Postconditions**:
- `.github/workflows/release.yml` is byte-for-byte unchanged
- The developer is informed of the deprecation and given specific migration guidance
- The release tag push will still trigger the deprecated action -- the GitHub Release will be created but the body will not be CHANGELOG-derived

**Related FR/AC**: FR-5.4, FR-6.3, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: existing `.github/workflows/release.yml` using `actions/create-release@v1`
- **Output**: structured summary with `present-but-warning` and migration suggestion
- **Side Effects**: Two writes (CHANGELOG, release-notes).

---

## UC-13: Project Has Packed Git Refs

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` populated `[Unreleased]`
- No `package.json`, no `pyproject.toml`, no `Cargo.toml`, no `VERSION` file (no FR-3.1 priority (a)-(d) source)
- Git tags ARE present in the repo (e.g., `v1.4.2`, `v1.0.0`, etc.) -- HOWEVER, the tags are stored in `.git/packed-refs` rather than as individual files under `.git/refs/tags/`. The directory `.git/refs/tags/` may be empty or contain only refs that have NOT been packed yet
- No `Version source:` line in `CLAUDE.md`

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path -- Degraded Detection)

1. Self-check passes
2. FR-3 detection: (a)-(d) all absent
3. FR-3.1(e): the agent uses `Glob` over `.git/refs/tags/v*.*.*`
4. The `Glob` returns ZERO matches because the tags are in `.git/packed-refs`, not in individual files under `.git/refs/tags/` (Git uses packed-refs as a performance optimization for repos with many tags)
5. The agent does NOT have `Bash` (per FR-1.1) so cannot invoke `git tag` to enumerate tags from `packed-refs`
6. The agent could attempt to `Read` `.git/packed-refs` directly and parse the lines matching `<sha> refs/tags/v*.*.*` -- the FR-3.1(e) wording says "read via `git tag` parsing -- but see footnote: the agent itself cannot run `git`; it reads `.git/refs/tags/` directly via the `Glob` tool, or reads a `git tag` output dump if the orchestrator passes one as context". The agent's prompt SHOULD include reading `.git/packed-refs` as a degraded-mode fallback (the PRD does not explicitly require this, but it is the natural extension of FR-3.1(e))
7. **Documented expected behavior**: the agent prompt MAY include packed-refs parsing OR MAY treat packed-refs as a known limitation. If parsing is implemented: the agent reads `.git/packed-refs`, extracts `v*.*.*` tag names, picks the highest semver, and uses it as the current version. If parsing is NOT implemented: the agent falls through to FR-3.3 fallback `0.1.0` and emits a warning: "git tags appear to be packed (.git/packed-refs); agent cannot enumerate packed tags without Bash; falling back to 0.1.0"
8. Either way, the agent succeeds via fallback; bump computation proceeds with the determined current version
9. The structured summary surfaces either the parsed tag (success path) or the packed-refs warning (degraded path)

**Postconditions**:
- The agent succeeds without hard failure
- The developer is alerted in the degraded path so they can pass the version explicitly (e.g., add a `Version source:` override pointing to a `VERSION` file they create) or unpack the refs

**Related FR/AC**: FR-3.1(e), FR-3.3, FR-6.6, Risk 6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `.git/refs/tags/` (possibly empty); `.git/packed-refs` (containing tags)
- **Output**: structured summary with detected version OR `(none -- fallback 0.1.0)` per the agent's degraded-mode handling
- **Side Effects**: No git executions. No `.git/` writes.

---

## UC-14: `breaking` Keyword False-Positive Avoidance

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` `[Unreleased]` contains an entry text such as `- Fixed breaking news widget rendering on mobile` (the word "breaking" appears as a substring of "breaking news" -- a legitimate user-facing feature reference, NOT an indicator of a breaking change)
- No `Removed` entries; only `Fixed` (or `Added` -- the scenario is the false-positive risk for the `breaking` token)
- `package.json` `"version": "1.4.2"`

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path -- Word-Boundary Match)

1. Self-check passes
2. FR-3 detection: `package.json` → `1.4.2`
3. FR-4 bump: per FR-4.1(a), the agent searches for the `breaking` token using **case-insensitive, word-boundary match** (per FR-4.1 explicit specification "literal token `breaking` (case-insensitive, word-boundary match)")
4. The phrase "breaking news" -- the word "breaking" stands as a complete word with non-word characters on both sides (space before, space after). Word-boundary regex DOES match here. This is a TRUE POSITIVE under strict word-boundary semantics, but the developer's intent was "breaking news" (a feature topic), not "breaking change"
5. **Documented expected behavior**: the FR-4.1 word-boundary rule is intentionally permissive in this corner case. The agent treats the entry as triggering the breaking-change rule (rule (a) fires → major bump, possibly coerced by FR-4.2 pre-1.0 override). The "Bump computation explanation" surfaces the matched entry text so the developer can audit: "matched 'breaking' token in entry: 'Fixed breaking news widget rendering on mobile'. If this entry is not actually a breaking change, the developer should rephrase the entry (e.g., 'Fixed news widget rendering on mobile') and re-run."
6. The agent does NOT attempt natural-language understanding to disambiguate "breaking news" from "breaking change" -- the deterministic word-boundary match per FR-4.5 is preserved
7. Result: the agent computes a major (or minor pre-1.0) bump and the developer reviews the structured summary
8. The developer either accepts the bump (and the misleading version), OR rephrases the entry and re-runs `/merge-ready` (which will re-execute Gate 9 because the prior run rewrote `[Unreleased]` -- wait, this is a tricky workflow: the developer must restore `[Unreleased]` content first, since the prior run renamed it. In practice the developer aborts before committing, hand-edits `CHANGELOG.md` to restore the original `[Unreleased]` with the rephrased entry, and re-runs)

**Postconditions**:
- The bump is major (or minor pre-1.0), per the strict word-boundary rule
- The developer is informed via the bump-computation explanation and can correct by editing the entry phrasing

**Related FR/AC**: FR-4.1(a), FR-4.5, FR-6.4, Risk 2

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-14-EC1: `breaking` token as part of longer word (e.g., "earthbreaking")** -- The word-boundary match would NOT fire because there is no word boundary between `earth` and `breaking`. The agent does NOT treat the entry as a breaking change

**Related FR/AC**: FR-4.1(a)

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` with `breaking` token in entry text (with various surrounding contexts)
- **Output**: deterministic bump per word-boundary rule; structured summary surfaces the matched text
- **Side Effects**: Same as UC-3.

---

## UC-15: User Has Manually Pre-Bumped Version Source

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9
**Preconditions**:
- `CHANGELOG.md` `[Unreleased]` populated with `### Added` entries (would normally produce minor bump)
- `package.json` `"version": "1.5.0"` -- BUT the most recent `[X.Y.Z]` section in `CHANGELOG.md` is `[1.4.2]`. The developer manually ran `npm version 1.5.0` BEFORE running `/merge-ready` (out of order)
- All other preconditions per UC-3

**Trigger**: `/merge-ready` reaches Gate 9

### Primary Flow (Happy Path -- User-Bumped Version)

1. Self-check passes
2. FR-3 detection: `package.json` → current version `1.5.0` (the user's manually-bumped value)
3. FR-4 bump: `[Unreleased]` has `Added` non-empty, no breaking, no Removed → minor per rule (b)
4. The agent computes new version: `1.5.0` minor bump → `1.6.0`
5. **Discrepancy detection**: the agent compares the most recent `[X.Y.Z]` section in `CHANGELOG.md` (which is `[1.4.2]`) against the current version (`1.5.0`). There is a gap: the version source is at `1.5.0` but no `[1.5.0]` section exists in CHANGELOG. The agent emits a warning: "current version 1.5.0 does not match the most recent CHANGELOG section [1.4.2] -- the version source may have been pre-bumped manually. Computed bump 1.5.0 → 1.6.0 based on [Unreleased] content."
6. **Alternative behavior consideration**: the PRD does not explicitly require this discrepancy detection (it is a defensive enhancement). The minimum-required behavior per FR-4.5 is deterministic computation from the current version (1.5.0) and `[Unreleased]` content (Added). The new version is `1.6.0`. The structured summary's bump explanation should at minimum surface the source version `1.5.0` so the developer can audit
7. FR-2 manipulation: renames `[Unreleased]` to `[1.6.0] - 2026-04-25`
8. The developer reads the summary and decides whether to proceed (use 1.6.0) or abort and reset `package.json` back to 1.4.2 to "redo" properly

**Postconditions**:
- The agent uses the user-set `1.5.0` and bumps to `1.6.0` (NOT to `1.5.0` -- the agent does not "use" the user's pre-bumped version as the new version; it bumps from it)
- If the agent's prompt includes the discrepancy detection enhancement, the developer sees the warning
- If the developer wanted `[1.5.0]` to be the released version (matching their pre-bump), they must abort, reset `package.json` to `1.4.2`, and re-run

**Related FR/AC**: FR-3.1, FR-4.1, FR-6.4, FR-6.6

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `package.json` with version that does not match the latest `[X.Y.Z]` section in CHANGELOG
- **Output**: structured summary showing source version, computed bump, and (if implemented) the discrepancy warning
- **Side Effects**: Two writes (CHANGELOG, release-notes), per UC-3.

---

## UC-16: SDLC Repo Self-Skip

**Actor**: `release-engineer` agent, invoked by the `/merge-ready` orchestrator at Gate 9 -- WHEN `/merge-ready` is run inside the `claude-code-sdlc` repo itself (not a downstream project)
**Preconditions**:
- The current working directory is the `claude-code-sdlc` repo root
- Per Section 3 design decision 1, the SDLC repo deliberately does NOT maintain its own `CHANGELOG.md` -- the file does not exist
- `.claude/rules/changelog.md` does NOT exist in the SDLC repo (per Section 3 FR-1.2 -- the rule is only installed by `--init-project` into downstream projects)
- The pre-flight `changelog-writer` sync (Section 3 FR-4.4) returns `no-op: not configured` because the rule file is absent
- Per Section 6 Dependency 19, this is expected behavior, not a bug

**Trigger**: `/merge-ready` reaches Gate 9 inside the SDLC repo's own development workflow

### Primary Flow (Happy Path -- Same as UC-1-E1)

1. The agent runs the self-check per FR-1.3
2. The agent attempts to read `CHANGELOG.md` -- the file does not exist
3. Per FR-1.3 ("If the section is missing entirely... return `no-op: no unreleased changes`"), the agent returns `no-op: no unreleased changes`
4. The agent does NOT create `CHANGELOG.md`. The agent does NOT touch `.github/workflows/`. The agent does NOT read any version-source file
5. `/merge-ready` reports Gate 9 as `SKIPPED` per FR-7.2
6. This matches Dependency 19's stated expected behavior: "the SDLC repo's own CHANGELOG.md is not maintained, so Gate 9 of /merge-ready in the SDLC repo's own development MUST report SKIPPED"

**Postconditions**:
- `CHANGELOG.md` does NOT exist (the SDLC repo continues to opt out)
- No `.claude/release-notes-*.md` files are created
- `.github/workflows/release.yml` is unchanged (note: the SDLC repo's `.github/workflows/` may contain CI workflows but no release.yml -- the agent does NOT provision one because the no-op short-circuits before FR-5)
- Gate 9 reports `SKIPPED`
- The 17-agent count is verified across documentation per AC-12, AC-13, AC-14 BUT no actual release packaging work is performed in the SDLC repo

**Related FR/AC**: FR-1.3, FR-7.2, AC-5, Dependency 19

**Related test case**: TC-TBD -- qa-planner will assign

### Data Requirements

- **Input**: `CHANGELOG.md` (absent)
- **Output**: `no-op: no unreleased changes`
- **Side Effects**: Zero mutations. The SDLC repo's self-skip behavior is identical to UC-1-E1 in mechanism but distinct in significance: it confirms the global agent design correctly handles its own host repository without ever activating release packaging there.

---

## Cross-Cutting: Agent Count and Gate Count Propagation

The following acceptance criteria are NOT use-case-driven but ARE testable post-implementation and form part of the E2E verification surface for this feature:

- **AC-12**: After running `bash install.sh`, the file `~/.claude/agents/release-engineer.md` exists. `src/claude.md` contains a `release-engineer` row in the Agency Roles table at the end. All "16 agents" prose references in `src/claude.md` are updated to "17 agents".
- **AC-13**: `README.md` tagline says "17 specialized AI agents" (or the verified updated wording); `## The 17 Agents` (or verified equivalent) heading; `release-engineer` row in agent table at end; new feature section describing release packaging.
- **AC-14**: All five `install.sh` banner strings containing "16" are updated to "17".
- **AC-15**: `install.sh` glob over `src/agents/*.md` covers `src/agents/release-engineer.md` -- verify by inspecting the install glob and confirming it does not exclude the new file.
- **AC-16**: `templates/CLAUDE.md` `Version source:` placeholder documentation no longer contains "no runtime effect" language; instead describes runtime consumption by `release-engineer` per FR-8.7 wording.
- **AC-17**: Cross-reference integrity: `src/claude.md` mentions `release-engineer`; `src/agents/release-engineer.md` exists; `src/commands/merge-ready.md` references `release-engineer` by exact name; the release-notes file path used in the structured summary template matches the `body_path` in the GitHub Actions workflow template (with the `v`-prefix-strip handling per FR-5.2).

These are gate-count and agent-count audit checks across the repository's documentation. They are exercised by `qa-planner`'s test cases and `code-reviewer` / `verifier` / `doc-updater` quality gates, not by `release-engineer` itself.

**Related test cases**: TC-TBD -- qa-planner will assign one or more cross-cutting test cases for the propagation audit.

---

## Coverage Map

The following table maps each PRD FR to the use cases that exercise it. Any FR not represented in a use case is flagged for `qa-planner` to either derive a test case directly from the FR text OR for the parent agent to confirm with `prd-writer` that no use case is needed.

| FR | UCs | Notes |
|----|-----|-------|
| FR-1.1 (`tools` frontmatter exclusion of `Bash`) | UC-1, all UCs (precondition) | Defense-in-depth verification is a static check on the agent file, exercised in every UC's preconditions |
| FR-1.2 (input order: CHANGELOG, version source, CLAUDE.md, .github/workflows/) | UC-1, UC-2, UC-3 | Implicitly exercised whenever the agent succeeds |
| FR-1.3 (self-check returns `no-op: no unreleased changes` on empty/missing `[Unreleased]`) | UC-1, UC-1-E1, UC-1-EC1, UC-10, UC-16 | |
| FR-1.4 (independent of `.claude/rules/changelog.md`) | UC-2 (greenfield without changelog-writer setup), UC-16 (rule absent in SDLC) | |
| FR-1.5 (six-step sequence; failure halts, partial preserved) | UC-2-E1, UC-11 | |
| FR-1.6 (no arguments beyond CWD) | implicit in all UCs | |
| FR-2.1 (rename `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`; insert fresh `[Unreleased]`) | UC-2, UC-3, UC-4, UC-8, UC-9 | |
| FR-2.2 (prior `[X.Y.Z]` sections preserved byte-for-byte) | UC-3 (has prior `[1.4.2]`) | |
| FR-2.3 (CHANGELOG header preserved) | UC-3 | |
| FR-2.4 (`.claude/release-notes-X.Y.Z.md` written with body) | UC-2, UC-3, UC-4, UC-8, UC-9 | |
| FR-2.5 (overwrite existing release-notes file without prompting) | UC-15 (re-run scenario could surface this; explicit test case TBD) | |
| FR-2.6 (release-notes file NOT deleted after writing) | UC-10 (idempotency preserves prior release-notes file) | |
| FR-2.7 (no commits by agent) | implicit in all UCs | |
| FR-3.1 (priority order a-e) | UC-2 (e: tags), UC-2-A1 (a fallthrough), UC-3 (a wins), UC-3-A1 (b: pyproject), UC-3-A2 (c: cargo), UC-3-A3 (d: VERSION), UC-3-A4 (e: tags), UC-3-EC1 (multiple sources) | |
| FR-3.2 (`Version source:` override) | UC-5 (override active), UC-5-A1 (override path missing), UC-5-A2 (idempotent), UC-5-E1 (unreadable) | |
| FR-3.3 (fallback `0.1.0`) | UC-2, UC-3-E1, UC-13 (degraded mode) | |
| FR-3.4 (READ ONLY on version-source files) | UC-3, UC-5 (package.json untouched), UC-15 (user-bumped version preserved) | |
| FR-3.5 (strip pre-release suffix; emit clean X.Y.Z) | not exercised in primary UCs -- flagged for qa-planner: derive a test case from FR-3.5 text directly (e.g., current `0.3.7-beta.1` → strip → `0.3.7` → bump → `0.4.0` and surface a warning) |
| FR-4.1 (semver bump rules a/b/c) | UC-2 (b: minor), UC-3 (b: minor), UC-4 (a: major→minor pre-1.0), UC-8 (c: patch), UC-8-E1 (a fires when both Removed and Fixed), UC-9 (a: major), UC-14 (a: breaking token), UC-14-EC1 (no false-positive on substring) | |
| FR-4.2 (pre-1.0 override) | UC-2, UC-4, UC-4-EC1 | |
| FR-4.3 (uncategorized entries treated as Changed) | not exercised in primary UCs -- flagged for qa-planner: derive a test case (e.g., entry under no category subheading → treated as Changed → minor bump + warning) |
| FR-4.4 (Deprecated/Security only → patch) | not exercised in primary UCs -- flagged for qa-planner: derive a test case (e.g., only `### Security` non-empty → patch) |
| FR-4.5 (deterministic bump with worked examples) | UC-2 (0.1.0 + Added → 0.2.0), UC-3 (1.4.2 + Added/Fixed → 1.5.0), UC-4 (0.7.3 + Removed → 0.8.0 pre-1.0), UC-8 (1.4.2 + Fixed-only → 1.4.3), UC-9 (2.3.1 + Removed → 3.0.0). PRD-required worked examples: `0.3.7 + Fixed-only → 0.3.8`, `0.3.7 + Added → 0.4.0`, `1.2.3 + Removed → 2.0.0`, `0.9.9 + Removed → 0.10.0` -- the qa-planner SHOULD derive an explicit test case for the four PRD-pinned examples even though our UCs use slightly different version numbers |
| FR-5.1 (workflow detection regex) | UC-2 (no workflow), UC-2-EC1 (unrelated workflows), UC-3 (present), UC-6 (present-and-correct), UC-7 (present-but-warning), UC-7-A1 (different purpose), UC-12 (deprecated action) | |
| FR-5.2 (write `release.yml` with HTML comment, action, body_path) | UC-2 | |
| FR-5.3 (`present-and-correct`) | UC-3, UC-6 | |
| FR-5.4 (`present-but-warning`) | UC-7, UC-7-A1, UC-12 | |
| FR-5.5 (idempotency on agent-provisioned workflow) | UC-6 (re-run produces present-and-correct) | |
| FR-5.6 (don't touch other workflow files) | UC-2-EC1 | |
| FR-5.7 (no GitHub Actions secrets / settings changes) | implicit in all UCs (the agent has no Bash and no network) | |
| FR-6.1 (10 labeled sections in order) | UC-2, UC-3 | |
| FR-6.2 ("Detected version source" line) | UC-2 (fallback string), UC-3 (package.json), UC-3-A1/A2/A3/A4, UC-5 (override origin) | |
| FR-6.3 ("CI/CD status" three values) | UC-2 (provisioned new), UC-6 (present-and-correct), UC-7 (present-but-warning) | |
| FR-6.4 ("Bump computation explanation") | UC-2, UC-4, UC-8-E1 (multi-category), UC-9, UC-14 (token match audit) | |
| FR-6.5 ("Commands to run" fenced block) | UC-2 (with workflow add), UC-3 (without workflow add), UC-6 (without workflow add) | |
| FR-6.6 ("Warnings" aggregation) | UC-2 (fallback), UC-2-A1 (missing version field), UC-3-EC1 (multiple sources), UC-4 (pre-1.0 coercion), UC-5 (override discrepancy), UC-5-A1 (missing override file), UC-7 (CI/CD warning), UC-12 (deprecated action), UC-13 (packed-refs), UC-15 (pre-bumped) | |
| FR-6.7 (single-line output in no-op case) | UC-1, UC-1-E1, UC-10, UC-16 | |
| FR-7.1 (Gate 9 placement after Gate 9) | exercised by every UC's gate-output expectation; integration-tested via `/merge-ready` itself |
| FR-7.2 (PASS / SKIPPED / FAIL semantics) | UC-1 (SKIPPED), UC-2 (PASS), UC-2-E1 (FAIL), UC-11 (FAIL), UC-16 (SKIPPED) | |
| FR-7.3 (pre-flight sync runs BEFORE Gate 9) | exercised by every UC -- preconditions reference the pre-flight sync having run |
| FR-7.4 (gate-count documentation update) | cross-cutting AC-4; not a UC | |
| FR-7.5 (idempotency: re-run after release packaging produces SKIPPED) | UC-10 | |
| FR-7.6 (Gate 9 FAIL does not retroactively re-evaluate Gates 0-9) | UC-2-E1, UC-11 | |
| FR-8.1 -- FR-8.8 (agency table, agent count, README, install.sh, templates/CLAUDE.md, plan critic) | cross-cutting (see Cross-Cutting section) -- not exercised by `release-engineer` itself but verified post-install | |

---

## Data Requirements -- Summary Across All UCs

- **Inputs read by `release-engineer`** (always read-only):
  - `CHANGELOG.md` at the project root
  - Version-source candidates: `package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`, files matching `.git/refs/tags/v*.*.*` (and possibly `.git/packed-refs` per UC-13)
  - Project `CLAUDE.md`: `./CLAUDE.md` and/or `.claude/CLAUDE.md`
  - Override-target file (if `Version source:` present)
  - `.github/workflows/*.yml` and `*.yaml`
- **Outputs written by `release-engineer`** (only on the success path with non-empty `[Unreleased]`):
  - Modified `CHANGELOG.md` (rename + fresh `[Unreleased]`)
  - New `.claude/release-notes-X.Y.Z.md`
  - New `.github/workflows/release.yml` (only in ABSENT case)
  - Structured markdown summary returned to `/merge-ready`
- **Forbidden writes** (per design decision 10 NEVER list and FR-1.1 `tools` exclusion):
  - Any version-source file (`package.json`, `pyproject.toml`, `Cargo.toml`, `VERSION`)
  - Any other `.github/workflows/*.yml` file (only `release.yml` may be written, and only in the ABSENT case)
  - Any other `[X.Y.Z]` section in `CHANGELOG.md` (only the freshly-renamed one and the fresh `[Unreleased]` heading are mutated)
  - The `CHANGELOG.md` Keep a Changelog header (preserved byte-for-byte)
  - `~/.claude/settings.json` or any other Claude Code configuration file
  - Any other agent's prompt file under `src/agents/` or `~/.claude/agents/`
  - Any other Claude Code rule file
- **Forbidden actions** (per design decision 10 NEVER list, FR-1.1 `tools` exclusion, NFR-6):
  - `Bash` shell invocation (mechanically prevented by `tools` frontmatter)
  - `git` commands (`git add`, `git commit`, `git push`, `git tag`, etc.) -- emitted in the structured summary for the developer to execute, never executed by the agent
  - `gh` CLI commands (`gh release create`, etc.) -- never executed
  - Package-manager publish commands (`npm publish`, `cargo publish`, `pypi upload`, etc.) -- never executed and not even mentioned in the structured summary (developer's separate responsibility outside Gate 9's scope)
  - Network calls (`WebFetch`, `WebSearch` excluded from `tools`)
  - Notebook edits (`NotebookEdit` excluded from `tools`)
