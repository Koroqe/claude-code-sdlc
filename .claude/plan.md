# Plan: Product Changelog Maintenance — Iteration 1 (Content Sync)


## Prerequisites verified

- **PRD section:** `docs/PRD.md` — Section 3 "Product Changelog Maintenance — Iteration 1: Content Sync" (lines 345–560) — 30 FRs, 8 NFRs, 17 ACs, 11 affected files
- **Use cases:** `docs/use-cases/product-changelog_use_cases.md` — 42 scenarios across UC-1 through UC-11
- **QA test cases:** `docs/qa/product-changelog_test_cases.md` — 84 TCs across 11 categories
- **Architecture review:** PASS with 5 [STRUCTURAL] authorizations (install.sh 13→14 scope expansion; PRD `Changelog:` field placement; commit-to-PRD mapping function; SDLC self-skip verification; agent structured summary format)

## Structural decisions (pinned by Tech Lead)

1. **PRD `Changelog:` field placement** — Separate line **below** the contiguous `Status:`/`Date:`/`Priority:`/`Related:` header block, with one blank line of separation. Rationale: user-facing descriptions can be long single-line sentences; keeping the short-value metadata block tight improves parseability. The `prd-writer` critic rejects any placement inside the header block.
2. **Commit-to-PRD-section mapping** — Conventional-commit **scope** (the parenthesized token in `feat|fix|test|chore(<scope>): …`) matches a **slugified PRD section title keyword**. A commit maps to a PRD section if its scope appears as a whitespace-separated token in the lowercased, punctuation-stripped PRD section title (e.g., `feat(changelog): add agent` maps to PRD section "Product Changelog Maintenance"). Rationale: every SDLC commit already has a scope per `.claude/rules/git.md`; no new commit trailer convention is introduced.
3. **Agent structured output format** — **Markdown** with five stable `## <token>` headers: `## Self-check`, `## Source counts`, `## Entries per category`, `## Action taken`, `## Warnings`. Rationale: matches the existing agent-output convention across the codebase; no downstream parser exists that would benefit from JSON/YAML.

## Deliverables checklist

- [x] PRD section in `docs/PRD.md` (Section 3)
- [x] Use cases in `docs/use-cases/product-changelog_use_cases.md` (42 scenarios)
- [x] Architecture review verdict (PASS with 5 [STRUCTURAL] items)
- [x] QA test cases in `docs/qa/product-changelog_test_cases.md` (84 test cases)
- [ ] Implementation slices (this document, below)

## Feature scope

Add automated `CHANGELOG.md` maintenance in downstream projects. Introduce a new `changelog-writer` agent that syncs the `[Unreleased]` section by reading PRD, scratchpad, and `git log`. The agent is silently scoped to downstream projects only — the SDLC repo itself never acquires a `CHANGELOG.md` because the sentinel file `.claude/rules/changelog.md` is installed only by `install.sh --init-project`. Extend `prd-writer` with a `Changelog:` field, wire the agent into four pipeline hook points, update the agent count from 13 to 14 across `README.md`, `src/claude.md`, and `install.sh`, and add a dead-metadata `Version source:` placeholder to `templates/CLAUDE.md` for iteration 2.

---

## Implementation plan (8 slices)

### Slice 1: Changelog rule file scoped to downstream projects

- **Wave:** 1
- **Use cases:** UC-1 (precondition), UC-5 (SDLC self-skip sentinel), UC-5-EC1 (empty rule file valid), UC-11-EC1 (SDLC self-skip from implement-slice)
- **Files:** `templates/rules/changelog.md` [new]
- **Changes:**
  - Create `templates/rules/changelog.md` (placement under `templates/rules/` — verified this directory exists, it contains `architecture.md`, `security.md`, `testing.md`). The file MUST contain:
    - An "Audience" section stating the file is for **product owners and end users, NOT developers**.
    - A "Format" section specifying Keep a Changelog (with a link to `https://keepachangelog.com/`) and listing all six categories verbatim: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
    - An "`[Unreleased]` convention" section stating that an `[Unreleased]` heading always exists above versioned sections.
    - An "Inclusion rule" section stating entries come only from PRD sections whose `Changelog:` field is a user-facing description (not `skip — internal`).
    - An "Exclusion rule" section naming the internal work categories that are never recorded: refactors, test infrastructure, type cleanup, logging, metrics, CI.
    - A "Sentinel" section stating: **"The presence of this file at `.claude/rules/changelog.md` is the sole signal the `changelog-writer` agent uses to decide whether to run. Absence equals opt-out."**
    - A "No lazy skip" section stating that `skip — internal` MUST NOT be used as a default for user-facing features (per FR-3.5).
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "product owners" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "Added" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "Changed" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "Deprecated" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "Removed" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "Fixed" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "Security" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -q "\[Unreleased\]" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -qi "sentinel\|presence" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md && grep -qi "skip.*internal" /Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md`
- **Done when:** The file exists at `templates/rules/changelog.md`, is NOT present at `src/rules/changelog.md` (verified via `test ! -f src/rules/changelog.md`), and all greps in the Verify command succeed.
- **Pre-review:** none
- **Satisfies AC:** AC-1
- **Satisfies FR:** FR-1.1, FR-1.2, FR-1.4, FR-3.5 (exclusion-policy cross-reference)
- **Covers TCs:** TC-1.1, TC-1.2, TC-1.3

---

### Slice 2: `changelog-writer` agent with self-check, commit mapping, idempotent diff, and markdown structured output

- **Wave:** 1
- **Use cases:** UC-1 (first-ever create), UC-1-A1 (append to existing), UC-1-EC1 (no eligible entries), UC-2 (continuous sync), UC-2-A1 (mid-feature PRD edit), UC-2-A2 (skip→user-facing), UC-2-A3 (user-facing→skip), UC-2-E1 (merge-base failure), UC-2-E2 (malformed markup), UC-2-EC1 (scratchpad/commits mismatch), UC-3 (parallel wave inputs), UC-4 (skip exclusion), UC-4-EC1 (all-internal branch), UC-5 (self-skip), UC-5-EC1 (empty sentinel), UC-6 (missing Changelog field tolerance), UC-6-E1 (never corrected), UC-6-EC1 (empty value), UC-6-EC2 (non-literal value), UC-7 (double invocation idempotency), UC-7-A1 (whitespace-only diff), UC-7-EC1 (rapid invocations), UC-8 (manual rename), UC-8-A1 (developer pre-created unreleased), UC-8-EC1 (duplicate commit warning), UC-9 (empty `[Unreleased]` valid), UC-9-EC1 (empty subheadings equivalence), UC-10 (large git log), UC-10-A1 (within limits), UC-10-E1 (truncation undetectable), UC-10-EC1 (compact format fallback)
- **Files:** `src/agents/changelog-writer.md` [new]
- **Changes:**
  - Create `src/agents/changelog-writer.md` modeled after the existing agent format (verified frontmatter pattern in `src/agents/planner.md` and `src/agents/verifier.md`). File MUST contain:
    - YAML frontmatter: `name: changelog-writer`, `description: Maintain the [Unreleased] section of downstream project CHANGELOG.md in sync with PRD, scratchpad, and git log.`, `tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]`, `model: opus`.
    - **# Release Scribe — CHANGELOG Maintainer** title heading.
    - **## Step 1 — Self-check (first action, always)**: attempt to read `.claude/rules/changelog.md` in the project CWD. If the file does not exist or is unreadable (any read error), return the exact string `no-op: not configured`, perform no writes, create no `CHANGELOG.md`, and do not fail the caller. An empty (zero-byte) rule file still counts as "present" and the agent proceeds.
    - **## Step 2 — Read inputs in fixed order**: (a) `docs/PRD.md`, (b) `.claude/scratchpad.md`, (c) `git log <merge-base>..HEAD` where `<merge-base> = git merge-base main HEAD` — on merge-base failure fall back to full `git log HEAD` and annotate output with `degraded mode: merge-base unresolved; using full branch log`, (d) `CHANGELOG.md` if it exists.
    - **## Step 3 — Large-log handling**: if `git log` output approaches the 50,000-character tool-limitation threshold, re-read using `git log --pretty=format:'%H|%s|%b'` compact form; if still near threshold, chunk the range in halves via `git rev-list --count` midpoint and merge results. Cross-check count against `git rev-list --count <merge-base>..HEAD` and report both counts in the output. Never silently report incomplete findings.
    - **## Step 4 — Parse PRD sections for `Changelog:` field**: locate each PRD section header block and the `Changelog:` field on the line immediately below the `Status:`/`Date:`/`Priority:`/`Related:` block (pinned placement — structural decision 1). Classify each section as (a) user-facing description, (b) literal `skip — internal`, (c) absent field (treat as `skip — internal` per NFR-2 with warning), (d) empty value (treat as `skip — internal` with warning distinguishing "empty" from "missing"), (e) non-literal value like `TODO`/`N/A`/`FIXME` (treat conservatively as user-facing shape (a) with a "suspicious value" warning per UC-6-EC2).
    - **## Step 5 — Map commits to PRD sections (pinned mechanism)**: extract conventional-commit scope from each commit subject. Slugify each PRD section title (lowercase, strip punctuation, split on whitespace) into candidate keyword set. A commit maps to the PRD section whose keyword set contains the commit's scope as a whole token. If the scope matches multiple PRD sections, pick the section whose `Changelog:` field is user-facing over `skip — internal`; if still tied, pick the numerically-lower section number and emit a disambiguation warning. Commits with no scope or no match are reported in the output summary as "unmapped".
    - **## Step 6 — Compute eligible entries**: only commits mapped to non-skip PRD sections are eligible. Group eligible entries by the PRD section's nature into the six Keep a Changelog categories (new feature → `Added`, modification → `Changed`, deprecation → `Deprecated`, removal → `Removed`, bug fix → `Fixed`, security fix → `Security`). When nature is ambiguous, default to `Added` for new features, `Changed` for modifications; record the choice in the `## Warnings` output section.
    - **## Step 7 — Idempotent diff**: if no eligible entries exist AND `CHANGELOG.md` does not exist, return `no-op: no eligible entries` and do NOT create the file (per FR-2.8). Otherwise compute the intended `[Unreleased]` section markdown. Normalize both computed and current content by collapsing runs of whitespace, stripping trailing spaces on each line, and stripping trailing blank lines; compare the normalized forms. If equivalent, return `no-op: already in sync` and perform no write. Equivalent representations of an empty `[Unreleased]` (zero subheadings vs. six empty subheadings) are treated as equivalent — never rewrite solely to change shape.
    - **## Step 8 — Rewrite ONLY `[Unreleased]`**: when content differs, parse `CHANGELOG.md` to locate the `[Unreleased]` section bounds (between `## [Unreleased]` and the next `## [` heading, or EOF). Replace only those bytes. All prior versioned sections MUST remain byte-for-byte identical. If `[Unreleased]` is missing entirely, insert a fresh `[Unreleased]` section immediately under the header paragraphs, above the first versioned section; do not delete, reorder, or edit any other content. If `CHANGELOG.md` does not exist and eligible entries exist, create it with header paragraphs (title `# Changelog`, link to keepachangelog.com, semver note) followed by `## [Unreleased]` containing the entries.
    - **## Step 9 — Post-release-rename handling**: if `[Unreleased]` is absent but the file begins with a versioned section like `[X.Y.Z]`, insert an empty `[Unreleased]` above it per FR-2.8. Never rename or touch the versioned section. If a commit in `<merge-base>..HEAD` is also represented in a prior versioned section body, emit a warning in the output acknowledging the known iteration-1 duplication limitation (UC-8-EC1).
    - **## Step 10 — Never modify other files**: the agent MUST NOT write to `docs/PRD.md`, `.claude/scratchpad.md`, or any file other than `CHANGELOG.md` at the project root. The agent MUST NOT create git commits; writes piggyback on the surrounding slice commit.
    - **## Step 11 — Output format (pinned markdown schema — structural decision 3)**: return a single markdown block with exactly these five top-level headers in this order:
      ```
      ## Self-check
      configured | not-configured

      ## Source counts
      - commits read: N
      - commits eligible: M
      - commits skipped as internal: K
      - commits unmapped: U
      - PRD sections read: P

      ## Entries per category
      - Added: [list]
      - Changed: [list]
      - Deprecated: [list]
      - Removed: [list]
      - Fixed: [list]
      - Security: [list]

      ## Action taken
      no-op: not configured | no-op: already in sync | no-op: no eligible entries | action taken: created | action taken: rewrote | action taken: inserted empty [Unreleased]

      ## Warnings
      - [each warning on its own bullet, or "none"]
      ```
      The "Action taken" value MUST be one of the six canonical tokens exactly — these are the canonical strings for TC-11.3.
    - **## No-network constraint**: the agent MUST NOT access the network. All inputs are local files and local `git` invocations.
    - **## Performance targets**: no-op invocations should complete in under 5 seconds; rewrite invocations in under 15 seconds (NFR-8 soft targets). These are **aspirational** targets — iteration 1 does NOT include an automated performance-verification gate; they guide implementation choices (e.g., prefer bounded `git log` ranges, skip network, cache PRD parse) but failing them does not fail the slice.
    - **## No iteration 2 scope**: this agent MUST NOT perform semver computation, MUST NOT rename `[Unreleased]` to `[X.Y.Z]`, MUST NOT create release-notes files, MUST NOT run `git tag`, MUST NOT run `gh release create`, and MUST NOT consume the `Version source:` field in `templates/CLAUDE.md`.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && head -20 /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md | grep -q "name: changelog-writer" && head -20 /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md | grep -q "model: opus" && grep -q "no-op: not configured" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -q "no-op: already in sync" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -q "action taken: created" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -q "action taken: rewrote" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -q "no-op: no eligible entries" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -qE "Self-check" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -qE "Source counts" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -qE "Entries per category" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -qE "Action taken" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -qE "Warnings" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -q "merge-base" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && grep -qi "keepachangelog" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && ! grep -q "gh release" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && ! grep -qE "^[[:space:]]*git tag" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md`
- **Done when:** The file exists at `src/agents/changelog-writer.md` with valid frontmatter (`name: changelog-writer`, `model: opus`, non-empty `description`, non-empty `tools`), the self-check is the first documented step, the exact string `no-op: not configured` appears in the body, all six canonical action-taken tokens are present, all five markdown output headers (`## Self-check`, `## Source counts`, `## Entries per category`, `## Action taken`, `## Warnings`) are documented, the commit-to-PRD mapping function (conventional-commit scope vs. slugified PRD section title) is explicitly documented, degraded-mode merge-base fallback is documented, and zero matches for `gh release` or `git tag` exist.
- **Pre-review:** architect + security
- **Satisfies AC:** AC-4, AC-5, AC-6, AC-15, AC-16, AC-17
- **Satisfies FR:** FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7, FR-2.8, FR-2.9, FR-2.10, NFR-2, NFR-4, NFR-6, NFR-7, NFR-8
- **Covers TCs:** TC-3.1, TC-3.3, TC-3.4, TC-3.5, TC-4.1, TC-4.2, TC-4.3, TC-4.4, TC-4.5, TC-5.13, TC-7.1, TC-7.2, TC-7.3, TC-7.5, TC-7.6, TC-7.7, TC-7.8, TC-7.9, TC-8.1, TC-8.2, TC-8.3, TC-8.4, TC-8.5, TC-8.6, TC-8.7, TC-8.8, TC-8.9, TC-8.10, TC-8.13, TC-8.14, TC-8.15, TC-9.3, TC-9.8, TC-10.1, TC-10.2, TC-10.3, TC-10.4, TC-10.5, TC-10.6, TC-10.8, TC-11.1, TC-11.2, TC-11.3

---

### Slice 3: `install.sh` — copy rule file in `--init-project` path, copy agent globally, update all "13" banners to "14"

- **Wave:** 1
- **Use cases:** UC-1 (precondition setup via `--init-project`), UC-5 (SDLC self-skip verification), UC-11 (implement-slice standalone CWD context)
- **Files:** `install.sh`
- **Changes:**
  - **Note to implementer:** line numbers below are guidance at plan-time and may drift after earlier edits. Locate each banner by content (`grep -n "13 specialized\|13 AI agents\|(13 files" install.sh`) rather than trusting fixed line numbers.
  - **Header comment** (around line 8): change `13 specialized AI` → `14 specialized AI`.
  - **`print_help` function** (around line 49): change `Turn Claude Code into a full dev team with 13 specialized AI agents.` → `Turn Claude Code into a full dev team with 14 specialized AI agents.`
  - **`print_help` function** (around line 62): change `agents/          13 specialized agent prompts` → `agents/          14 specialized agent prompts`.
  - **`install_user_config` banner** (around line 178): change `13 AI agents | Documentation-first | TDD` → `14 AI agents | Documentation-first | TDD`.
  - **`install_user_config` banner** (around line 182): change `agents/  (13 files — specialized agent prompts)` → `agents/  (14 files — specialized agent prompts)`.
  - **`scaffold_project` function**: After the existing `cp` calls for `architecture.md`, `security.md`, `testing.md`, add a new copy: `cp "$SCRIPT_DIR/templates/rules/changelog.md" ".claude/rules/changelog.md"` followed by a matching `log_ok ".claude/rules/changelog.md (template)"`. Place this block immediately after the `testing.md` copy for consistent ordering. (The global agents loop at line 202 `for agent in "$SCRIPT_DIR"/src/agents/*.md` already picks up `changelog-writer.md` automatically — no change needed to that block, but the banner text above reflects the new count.)
  - **SDLC self-skip — static structural verification** (architect [STRUCTURAL] item 4 — pinned): the new `cp "$SCRIPT_DIR/templates/rules/changelog.md"` line MUST appear INSIDE the `scaffold_project()` function body and MUST NOT appear inside `install_user_config()`. This is verified in the slice's Verify command by extracting each function body with `awk '/^scaffold_project\(\) \{/,/^\}/'` (and similarly for `install_user_config`) and grep'ing within. The Verify runs NO installer — no destructive side effects on `$HOME/.claude/`, no user-config overwrite, no backup-dir spam. Runtime E2E verification (actually executing `install.sh --init-project` in a fresh tempdir and asserting file presence) is deferred to the `/merge-ready` E2E gate.
- **Verify:** `bash -n /Users/aleksandra/Documents/claude-code-sdlc/install.sh && grep -c "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh | grep -q "^[1-9]" && ! grep -q "13 specialized" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && grep -c "14 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh | grep -q "^[1-9]" && ! grep -q "13 AI agents" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && grep -qE "\(14 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && ! grep -qE "\(13 files" /Users/aleksandra/Documents/claude-code-sdlc/install.sh && grep -q 'templates/rules/changelog.md' /Users/aleksandra/Documents/claude-code-sdlc/install.sh && awk '/^scaffold_project\(\) \{/,/^\}/' /Users/aleksandra/Documents/claude-code-sdlc/install.sh | grep -q 'templates/rules/changelog.md' && ! (awk '/^install_user_config\(\) \{/,/^\}/' /Users/aleksandra/Documents/claude-code-sdlc/install.sh | grep -q 'templates/rules/changelog.md')`
- **Done when:** `bash -n install.sh` succeeds (syntax valid); all five banner strings (`14 specialized`, `14 AI agents`, `(14 files`) are present and their `13`-counterparts are absent; the `scaffold_project()` function body contains a `cp "$SCRIPT_DIR/templates/rules/changelog.md"` line (proven by the awk-extracted-body grep); the `install_user_config()` function body does NOT contain that line (proven by the negated awk-extracted-body grep — this is the structural SDLC self-skip proof per architect item 4); the Verify command runs entirely statically with no invocation of `install.sh` and no writes outside this slice's commit.
- **Pre-review:** architect + security
- **Satisfies AC:** AC-2, AC-3, AC-13 (install.sh portion)
- **Satisfies FR:** FR-1.3, FR-5.2 (install.sh portion), NFR-1, NFR-3, NFR-5
- **Covers TCs:** TC-1.4, TC-1.5, TC-1.6, TC-1.7, TC-1.8, TC-1.9

---

### Slice 4: `prd-writer` agent — add `Changelog:` field requirement, documented value shapes, authoring constraints

- **Wave:** 1
- **Use cases:** UC-1 (precondition — PRD contains Changelog field), UC-4 (Changelog: skip — internal shape), UC-6 (runtime tolerance for missing field), UC-6-EC1 (empty value), UC-6-EC2 (non-literal value)
- **Files:** `src/agents/prd-writer.md`
- **Changes:**
  - Extend the existing `## Output Format` section to add a new bullet after `**UI changes**: Pages, components, or flows affected`:
    - `**Changelog entry**: One line immediately BELOW the Status/Date/Priority/Related header block, using the exact field name `Changelog:` followed by EXACTLY ONE of these two value shapes:`
      - `(a) A single-line user-facing description phrased for end users. Example: `Changelog: Users can sign in with Google OAuth``
      - `(b) The exact literal string `skip — internal`. Example: `Changelog: skip — internal``
    - Authoring rule: the `Changelog:` line goes on its own line after a blank line following the `Related:` line (or whichever is the last line of the contiguous header block). This placement is canonical — the `changelog-writer` agent expects it there.
  - Add a new `## Changelog Field Authoring Constraints` subsection immediately AFTER the `## Output Format` section and BEFORE the `## Constraints` section (pinned placement — do NOT extend the existing Constraints section, do NOT place inside Output Format). This keeps Output Format a pure field list and Constraints reserved for cross-cutting invariants. Content:
    - The `Changelog:` field is REQUIRED in every new PRD section. Missing the field is an authoring error — the Plan Critic MUST flag any PRD section missing this field.
    - **User-facing shape (a)** MUST be phrased for product owners and end users:
      - No internal jargon: avoid words like "refactor", "agent", "slice", "wave", "middleware", "hook", "guard".
      - No implementation details: no file paths, no function names, no class names, no module names.
      - No version numbers or dates in the value (those are added during release packaging in iteration 2).
      - Describe user-visible behavior or outcomes, not engineering work.
    - **Skip shape (b)** MUST be the literal string `skip — internal` exactly. Any other text (`N/A`, `TODO`, `skip`, `internal`, `none`) is INVALID.
    - The `skip — internal` shape MUST be used for purely internal work: refactors, test infrastructure, CI changes, typecheck cleanup, logging, metrics. It MUST NOT be used as a lazy default for user-facing features.
    - At least one example of each shape MUST appear in this agent's Output Format section.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md && grep -q "Changelog:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md && grep -q "skip — internal" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md && grep -qE "Users can" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md && grep -qi "missing.*Changelog\|Changelog.*missing\|authoring error" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md && grep -qi "no internal jargon\|internal jargon\|refactor.*slice.*wave\|avoid.*implementation" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md && grep -qi "below.*header\|below the.*block\|on its own line" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md`
- **Done when:** The file contains the exact field name `Changelog:` in the Output Format section; both valid value shapes are documented with at least one example each (one user-facing description containing "Users can" and one `skip — internal` literal); a constraint stating missing `Changelog:` is an authoring error is present; language prohibiting internal jargon and implementation details is present; the pinned placement ("below the header block" / "on its own line") is documented.
- **Pre-review:** none
- **Satisfies AC:** AC-7
- **Satisfies FR:** FR-3.1, FR-3.2, FR-3.3, FR-3.4, FR-3.5
- **Covers TCs:** TC-2.1, TC-2.2, TC-2.3, TC-2.4, TC-2.5, TC-2.6, TC-2.7

---

### Slice 5: Pipeline hooks — wire `changelog-writer` into four command files with parallel-safety guard

- **Wave:** 1
- **Use cases:** UC-2 (all four hook points), UC-2-A1 (mid-feature PRD edit via merge-ready pre-flight), UC-3 (orchestrator-only invocation), UC-3-A1 (mixed-eligibility wave), UC-3-A2 (single-slice wave dispatch), UC-3-E1 (post-wave sync failure), UC-3-EC1 (all-wave-fail), UC-4-A1 (internal→user-facing caught by pre-flight), UC-6-E1 (non-blocking), UC-11 (standalone `/implement-slice`), UC-11-A1 (internal slice post-commit), UC-11-E1 (post-commit failure), UC-11-EC1 (SDLC self-skip)
- **Files:** `src/commands/bootstrap-feature.md`, `src/commands/implement-slice.md`, `src/commands/develop-feature.md`, `src/commands/merge-ready.md`
- **Changes:**
  - **`src/commands/bootstrap-feature.md`** — after the existing `### Step 5: Tech Lead — Implementation Planning` block (ending around the delegation to `planner`) and BEFORE the existing `### Step 6: Git Setup`, insert a new step:
    ```
    ### Step 5.5: Release Scribe — Initial Changelog Stub
    Delegate to `changelog-writer` agent with no arguments beyond the project CWD context (per FR-4.6). This is the first lifecycle hook — it produces an initial `[Unreleased]` stub (or, more commonly, returns `no-op: already in sync` / `no-op: no eligible entries` when the branch has no prior eligible commits). A `no-op: not configured` response is expected when running inside the SDLC repo itself and is treated as success. This hook is non-blocking per FR-4.5: if the agent fails, log the error and continue to Step 6.
    ```
    Keep the existing `### Step 6: Git Setup` and `### Step 7: Initialize Scratchpad` numbering intact.
  - **`src/commands/implement-slice.md`** — modify `### 5. Commit` to add a new subsection at its end (before `### 6. Update Scratchpad`):
    ```
    ### 5.5. Changelog Sync (standalone mode only)

    **When running as a parallel subagent** (wave context provided in spawn prompt): SKIP this step entirely. The orchestrator handles post-wave changelog sync per FR-4.3 in `/develop-feature`. Invoking `changelog-writer` from a subagent risks a double-write race on `CHANGELOG.md` (PRD 3.9 Risk 3) and is explicitly prohibited.

    **When running standalone** (no wave context): immediately after the commit in Step 5 succeeds, delegate to `changelog-writer` with no arguments beyond CWD. A `no-op: not configured` response is expected when running inside the SDLC repo and is treated as success. If the agent fails (crash, timeout, Rule 3 retry exhaustion), log the error and proceed to Step 6 — per FR-4.5 the pipeline MUST continue; the next hook invocation will reconcile state (NFR-6 eventual consistency).
    ```
  - **`src/commands/develop-feature.md`** — in `### Phase 2: Implement All Slices (Wave-Aware)`, within the "After all subagents complete" block (currently steps 1 "Collect results", 2 "Update scratchpad", 3 "Handle failures"), insert a new numbered step between "Update scratchpad" and "Handle failures":
    ```
    3. **Changelog sync (orchestrator-only, once per wave)** — delegate to `changelog-writer` ONCE after all subagents in this wave have completed and the scratchpad is updated, BEFORE proceeding to the next wave. **This applies to ALL waves regardless of size — single-slice waves included.** The agent is idempotent per FR-2.6 and NFR-6, so redundant invocations are cheap (no-op on second call). Uniform dispatch eliminates the dispatch-contradiction risk where a single-slice subagent would receive wave context (causing `implement-slice.md` Step 5.5 to SKIP) while the orchestrator also skipped — leaving the wave without a sync. The agent is invoked with no arguments beyond CWD (per FR-4.6). Subagents within the wave (single or multi-slice) do NOT invoke the agent themselves — this is the structural prevention of the PRD 3.9 Risk 3 double-write race (per FR-4.2). A `no-op: not configured` response inside the SDLC repo is expected and treated as success. If the agent fails, log the error and proceed to the next wave — per FR-4.5 this hook is non-blocking; NFR-6 idempotency ensures the next hook invocation reconciles state.
    ```
    Renumber the subsequent "Handle failures" step to 4.
  - **`src/commands/merge-ready.md`** — insert a new section BEFORE the existing `## Gate 0: Git Hygiene` heading:
    ```
    ## Pre-flight: Changelog Sync (safety net — NOT a gate)

    Before Gate 0 runs, delegate to `changelog-writer` with no arguments beyond CWD as a silent safety-net sync (per FR-4.4). This is NOT a new quality gate — it has no pass/fail verdict, does not appear in the Gate count, and does NOT block merge readiness. The gate list (Gate 0 through Gate 8) is UNCHANGED; no `Gate 10` exists in iteration 1 per PRD 3.8 item 7 and AC-11.

    Behavior:
    - If the agent returns `no-op: not configured` (SDLC repo) or `no-op: already in sync` (common case — previous hooks kept content in sync), proceed silently to Gate 0 with no extra output.
    - If the agent returns `action taken: rewrote` (uncommon — e.g., PRD edited since last sync), surface the diff summary in the merge-ready output before proceeding to Gate 0.
    - If the agent fails for any reason, log the error and proceed to Gate 0 per FR-4.5. The pre-flight sync cannot fail `/merge-ready`.
    ```
    Do NOT add a new Gate entry anywhere. Do NOT modify the Gate 0 through Gate 8 content. Do NOT add an entry to the output-format table beyond what already exists.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && test -f /Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md && test -f /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md && test -f /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md && grep -q "changelog-writer" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && grep -q "changelog-writer" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md && grep -q "changelog-writer" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md && grep -q "changelog-writer" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md && grep -qi "standalone" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md && grep -qi "wave context.*skip\|skip.*wave context\|parallel subagent.*skip\|SKIP this step" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md && grep -qi "orchestrator.*once\|once per wave\|orchestrator-only" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md && grep -qi "all waves regardless of size\|single-slice waves included\|applies to ALL waves" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md && grep -qi "not a gate\|non-blocking\|safety net" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md && ! grep -qE "^## Gate 10" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md && [ "$(grep -cE "^## Gate [0-9]+:" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md)" = "9" ]`
- **Done when:** All four command files contain at least one reference to the exact string `changelog-writer`; `bootstrap-feature.md` has a post-Step-5 delegation; `implement-slice.md` has an explicit standalone-mode guard with "SKIP" instruction for parallel-subagent mode; `develop-feature.md` documents orchestrator-only once-per-wave invocation AND contains explicit language that the orchestrator invokes for ALL waves regardless of size (single-slice waves included — closing the single-slice-wave dispatch hole where both subagent and orchestrator would otherwise skip); `merge-ready.md` contains a pre-flight sync section before Gate 0 with "not a gate" / "non-blocking" / "safety net" language; zero `## Gate 10` headings exist; the count of `## Gate [0-9]+:` headings in `merge-ready.md` is exactly 9 (Gate 0 through Gate 8, anchored colon-terminated to avoid Gate 10+ prefix-matching ambiguity).
- **Pre-review:** architect
- **Satisfies AC:** AC-8, AC-9, AC-10, AC-11, AC-17 (partial — all four command files reference the registered agent name)
- **Satisfies FR:** FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.5, FR-4.6
- **Covers TCs:** TC-5.1, TC-5.2, TC-5.3, TC-5.4, TC-5.5, TC-5.6, TC-5.7, TC-5.8, TC-5.9, TC-5.10, TC-5.11, TC-5.12, TC-6.1, TC-6.2, TC-6.3, TC-6.4, TC-6.5, TC-6.6, TC-6.7, TC-9.2, TC-10.7

---

### Slice 6: `src/claude.md` — add `changelog-writer` row to Agency Roles, update "13"→"14"

- **Wave:** 1
- **Use cases:** UC-1 (precondition — agent registered with exact name used by hooks), UC-5 (SDLC docs reflect new agent count)
- **Files:** `src/claude.md`
- **Changes:**
  - Insert a new row into the Agency Roles table after the existing `| Senior Developer | refactor-cleaner | Post-implementation cleanup |` row:
    ```
    | Release Scribe | `changelog-writer` | Maintain the `[Unreleased]` section of downstream project `CHANGELOG.md` in sync with PRD, scratchpad, and git log |
    ```
  - Scan for any `13 agents` or `13 specialized` references and update to `14 agents` / `14 specialized` respectively. (Per current contents of `src/claude.md`, the body does not reference a specific number in prose, but the verification guards against regression if any appear.)
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -q "changelog-writer" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -qE "Release Scribe" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -qE "CHANGELOG.md" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && grep -qE "\[Unreleased\]" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md && ! grep -qE "13 agents|13 specialized" /Users/aleksandra/Documents/claude-code-sdlc/src/claude.md`
- **Done when:** A table row containing `changelog-writer` exists in the Agency Roles table with three populated columns (Role = "Release Scribe", Agent = `` `changelog-writer` ``, Responsibility mentioning both `CHANGELOG.md` and `[Unreleased]`); zero matches for `13 agents` or `13 specialized` in the file.
- **Pre-review:** none
- **Satisfies AC:** AC-12, AC-17 (partial — registration matches filename stem)
- **Satisfies FR:** FR-5.1, FR-5.2 (src/claude.md portion), NFR-5
- **Covers TCs:** TC-1.11, TC-9.1, TC-9.8

---

### Slice 7: `README.md` — update agent count, add agent row, add downstream CHANGELOG feature section

- **Wave:** 1
- **Use cases:** UC-1 (precondition — downstream users discover the feature via README), UC-5 (README explains SDLC self-skip)
- **Files:** `README.md`
- **Changes:**
  - Update the tagline at line 5 (verified via Read): `13 specialized AI agents. Documentation-first. TDD. Quality gates.` → `14 specialized AI agents. Documentation-first. TDD. Quality gates.`
  - Update the section heading at line 95: `## The 13 Agents` → `## The 14 Agents`.
  - Add a new row to the Agents table at the end of the existing 13-row table (after the `refactor-cleaner` row at line 111):
    ```
    | `changelog-writer` | Maintain `[Unreleased]` of downstream `CHANGELOG.md` from PRD + scratchpad + git log |
    ```
  - Add a new subsection about the downstream CHANGELOG feature. Place it after the existing `## Project Setup` section and before the next major section (verify placement during implementation via Read). The subsection MUST contain:
    - A `### Automated CHANGELOG for downstream projects` heading (or equivalent product-facing title).
    - A paragraph explaining that downstream projects scaffolded with `bash install.sh --init-project` get a `CHANGELOG.md` maintained automatically in the Keep a Changelog format, with `[Unreleased]` synced from PRD + git log at four lifecycle points (post-bootstrap, post-commit in standalone mode, post-wave in develop-feature, and pre-flight in merge-ready).
    - A sentence stating the SDLC repo itself opts out automatically by virtue of not installing the sentinel rule file `.claude/rules/changelog.md` on itself — the `changelog-writer` agent returns `no-op: not configured` and performs no writes when invoked inside the SDLC repo.
    - A sentence pointing to `templates/rules/changelog.md` for the policy details.
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qE "14 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md && ! grep -qE "13 specialized" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qE "^## The 14 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md && ! grep -qE "^## The 13 Agents" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -q "changelog-writer" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qi "CHANGELOG" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qi "downstream" /Users/aleksandra/Documents/claude-code-sdlc/README.md && grep -qi "opts out\|opt-out\|self-skip\|not configured" /Users/aleksandra/Documents/claude-code-sdlc/README.md`
- **Done when:** Line 5 tagline reads "14 specialized AI agents"; the `## The 14 Agents` heading exists and `## The 13 Agents` does NOT; the Agents table contains a row with `changelog-writer`; a new feature section mentions both "CHANGELOG" and "downstream" and explicitly documents the SDLC self-skip; zero matches for `13 specialized` or `## The 13 Agents` remain.
- **Pre-review:** none
- **Satisfies AC:** AC-13
- **Satisfies FR:** FR-5.2 (README portion), FR-5.3, FR-5.4
- **Covers TCs:** TC-1.10, TC-9.5, TC-9.6

---

### Slice 8: `templates/CLAUDE.md` — add dead-metadata `Version source:` placeholder for iteration 2

- **Wave:** 1
- **Use cases:** (deployment-only concern — no runtime use case in iteration 1; covered by AC-14 direct verification)
- **Files:** `templates/CLAUDE.md`
- **Changes:**
  - After the `# Project: TODO_PROJECT_NAME` heading and the one-line description placeholder (before the `## Tech Stack` section), insert a new `## Project Metadata` subsection containing:
    ```
    ## Project Metadata

    <!-- Iteration 1: the following field is reserved for future semver automation (iteration 2). In iteration 1 it is informational only and has NO runtime effect. Leave as-is or fill in if known. -->

    - **Version source:** TODO (e.g., `package.json`, `pyproject.toml`, `templates/CLAUDE.md` itself — reserved for iteration 2)
    ```
    The field MUST be documented as reserved for iteration 2 and marked as having no runtime effect in iteration 1. The `changelog-writer` agent MUST NOT read this field (verified by TC-10.8 which greps the agent and all four command files for consumption logic).
- **Verify:** `test -f /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md && grep -q "Version source:" /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md && grep -qi "iteration 2\|reserved for.*iteration\|no runtime effect\|informational only" /Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md && ! grep -q "Version source:" /Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md && ! grep -q "Version source:" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md && ! grep -q "Version source:" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md && ! grep -q "Version source:" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md && ! grep -q "Version source:" /Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md`
- **Done when:** `templates/CLAUDE.md` contains the exact string `Version source:` in a documented placeholder; the placement is accompanied by language stating it is reserved for iteration 2 / informational only / no runtime effect; NO consumption of this field exists anywhere (`changelog-writer.md` and all four command files have zero matches for `Version source:`).
- **Pre-review:** none
- **Satisfies AC:** AC-14
- **Satisfies FR:** FR-5.5
- **Covers TCs:** TC-9.4, TC-10.8

---

## Acceptance criteria (all must pass)

- [ ] **AC-1** — `templates/rules/changelog.md` exists with Keep a Changelog spec, six categories, audience statement, inclusion rule, exclusion rule (Slice 1)
- [ ] **AC-2** — `.claude/rules/changelog.md` does NOT exist in the SDLC repo after `bash install.sh` (no `--init-project`) (Slice 3 Verify)
- [ ] **AC-3** — `.claude/rules/changelog.md` EXISTS in a fresh directory after `bash install.sh --init-project` (Slice 3 verify via TC-1.4)
- [ ] **AC-4** — `src/agents/changelog-writer.md` has valid frontmatter (`name: changelog-writer`, `description`, `tools`, `model: opus`) and first documented step is the self-check (Slice 2)
- [ ] **AC-5** — Invoking `changelog-writer` in SDLC repo returns exact string `no-op: not configured` and creates no `CHANGELOG.md` (Slice 2)
- [ ] **AC-6** — Double invocation in a configured downstream with no intervening changes: second invocation returns `no-op: already in sync`, file byte-identical (Slice 2)
- [ ] **AC-7** — `prd-writer.md` Output Format documents `Changelog:` field with both shapes and examples (Slice 4)
- [ ] **AC-8** — `bootstrap-feature.md` contains post-Step-5 delegation to `changelog-writer` (Slice 5)
- [ ] **AC-9** — `implement-slice.md` Step 5 contains post-commit delegation guarded by standalone-mode check with explicit skip for parallel subagent mode (Slice 5)
- [ ] **AC-10** — `develop-feature.md` contains post-wave orchestrator-only delegation (Slice 5)
- [ ] **AC-11** — `merge-ready.md` contains pre-flight sync BEFORE Gate 0 explicitly marked non-blocking and NOT a gate; Gate count is unchanged (9 total: Gate 0 through Gate 8); no `## Gate 10` exists (Slice 5)
- [ ] **AC-12** — `src/claude.md` Agency Roles table has a `changelog-writer` row; all "13 agents" references updated to "14 agents" (Slice 6)
- [ ] **AC-13** — `README.md` includes `changelog-writer` in agent table; "13 specialized AI agents" updated to "14 specialized AI agents" (Slices 3 and 7)
- [ ] **AC-14** — `templates/CLAUDE.md` contains optional `Version source:` placeholder documented as reserved for iteration 2 (Slice 8)
- [ ] **AC-15** — In a configured downstream with no `CHANGELOG.md` and at least one eligible commit, the agent creates `CHANGELOG.md` with Keep a Changelog header and populated `[Unreleased]` (Slice 2)
- [ ] **AC-16** — PRD section `Changelog: skip — internal` excludes its commits from `[Unreleased]` even after shipping (Slice 2)
- [ ] **AC-17** — Cross-references valid: `src/claude.md` registration matches `src/agents/changelog-writer.md` filename; all four command files reference the exact registered name `changelog-writer`; no phantom paths (Slices 2, 5, 6)

## Files to modify

**New files (2):**
- `/Users/aleksandra/Documents/claude-code-sdlc/templates/rules/changelog.md` (Slice 1)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/changelog-writer.md` (Slice 2)

**Modified files (9):**
- `/Users/aleksandra/Documents/claude-code-sdlc/install.sh` (Slice 3)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/agents/prd-writer.md` (Slice 4)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/bootstrap-feature.md` (Slice 5)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/implement-slice.md` (Slice 5)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/develop-feature.md` (Slice 5)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/commands/merge-ready.md` (Slice 5)
- `/Users/aleksandra/Documents/claude-code-sdlc/src/claude.md` (Slice 6)
- `/Users/aleksandra/Documents/claude-code-sdlc/README.md` (Slice 7)
- `/Users/aleksandra/Documents/claude-code-sdlc/templates/CLAUDE.md` (Slice 8)

## Risk assessment

- **Data sensitivity:** None — all artifacts are markdown prompt and rule files, no PII, no secrets, no financial data.
- **Auth impact:** None — no authentication surface touched.
- **Persistence changes:** None to runtime data stores. The feature adds a new on-disk file (`CHANGELOG.md`) in downstream projects only; it is a documentation artifact, not application state.
- **External calls:** None at runtime. The `changelog-writer` agent explicitly MUST NOT access the network per NFR-7. It uses only local `git` CLI invocations.
- **Parallel-execution safety:** HIGH-RISK without Slice 5's guard. Without the `wave context → SKIP` branch in `implement-slice.md` and the orchestrator-only delegation in `develop-feature.md`, parallel subagents would race on `CHANGELOG.md` writes (PRD 3.9 Risk 3). Slice 5 is the structural prevention of this race and is flagged for architect pre-review.
- **SDLC self-install risk:** HIGH if Slice 3's `scaffold_project` block is accidentally hoisted into `install_user_config`. Mitigation (pinned by architect [STRUCTURAL] item 4): Slice 3's Verify command uses **static structural analysis** — it extracts each function body via `awk '/^funcname\(\) \{/,/^\}/'` and asserts the new `cp "$SCRIPT_DIR/templates/rules/changelog.md"` line is present inside `scaffold_project()` AND absent from `install_user_config()`. No `install.sh` invocation happens during verification (earlier draft of this plan had a destructive verify that overwrote `$HOME/.claude/` — corrected per Plan Critic CRITICAL findings 1–3). Runtime E2E of `install.sh --init-project` is deferred to the `/merge-ready` E2E gate, executed in an isolated tempdir.
- **Agent-count drift:** LOW. Three separate files contain "13" banners (`install.sh` in five locations, `src/claude.md`, `README.md`). Slices 3, 6, 7 each update their own file; a stale banner in any of them would fail the slice's own Verify command. No cross-slice dependency on a shared count string.
- **Idempotency:** MEDIUM risk of spurious rewrites from whitespace drift. PRD 3.9 Risk 2 mitigated in Slice 2 by whitespace-insensitive diff explicitly documented in the agent body (Step 7). TC-8.2 verifies whitespace-only changes do not trigger a rewrite.
- **Tool-limitation truncation:** MEDIUM risk on large git logs. PRD 3.9 Risk 8 + project rule `tool-limitations.md` mitigated in Slice 2 by Step 3 (compact format fallback, range chunking, cross-check against `git rev-list --count`).
- **Rollback strategy:** each slice is an atomic commit per `.claude/rules/git.md` ("1 slice = 1 commit"). If any slice turns out broken post-merge (e.g., `install.sh` banner regex breaks for an edge case, hook wiring misfires in a niche branch), the corresponding commit can be reverted via `git revert <slice-commit-hash>` without affecting sibling slices. Because all 8 slices touch disjoint files, reverts are non-overlapping and can be stacked in any order.

## Dependencies

- **Libraries / services:** None new. The agent uses `git` CLI (already required), standard Unix text processing via the agent's `Bash` tool, and markdown parsing via the agent's `Read` tool.
- **External state:** None. Agent is stateless and purely derives output from local disk.
- **Upstream PRD sections:** Section 1 FR-3 (Executable Plan Format) — SHIPPED — is the structural-field pattern reused by the `Changelog:` field. Section 2 FR-2 (Wave-Aware Orchestration) — DRAFT with the parallel-safety pattern established — is the blueprint for orchestrator-only writes in Slice 5. Both dependencies are already in place in the codebase at the files Slice 5 modifies (`develop-feature.md` has the wave loop; `implement-slice.md` has the wave-context check).
- **Downstream migration:** Existing downstream projects on SDLC v3.1.0 will NOT auto-receive `templates/rules/changelog.md` — they must re-run `bash install.sh --init-project`. NFR-2 guarantees backward compatibility: projects that do NOT re-run continue to work without changelog maintenance (the agent returns `no-op: not configured`).

## Wave assignment

All eight slices touch disjoint files. Logical dependencies were evaluated:

- **Slice 5 references the agent name** (string literal `changelog-writer`) but does NOT read or import the agent file — the name is pinned in the plan itself and in Slice 2's filename. Safe to run in the same wave as Slice 2.
- **Slice 6 and Slice 7 reference the agent name** in prose (agency table row, agents table row) — same reasoning, name is pinned, no runtime import.
- **Slice 3 banner text "14 specialized AI agents"** is known from the PRD (agent count rises 13→14) — no dependency on any other slice's output.
- **Slice 8 adds a `Version source:` placeholder** that is explicitly dead metadata in iteration 1 (no consumer). Independent of all other slices.

All eight slices can execute in Wave 1 simultaneously.

| Wave | Slices | Rationale |
|------|--------|-----------|
| 1    | 1, 2, 3, 4, 5, 6, 7, 8 | All eight slices operate on disjoint files; logical dependencies (agent-name string literals in Slices 5, 6, 7 referring to Slice 2's filename) are satisfied by the name being pinned in the plan itself — no slice reads another slice's file output at runtime. Fully parallelizable per architect's unusually-parallelizable flag. |

---

## Return summary

- **Path to plan file:** `/Users/aleksandra/Documents/claude-code-sdlc/.claude/plan.md` (planner agent is read-only; this content is returned as text for the calling command to persist)
- **Slice count (8):**
  1. `templates/rules/changelog.md` — downstream-scoped policy + sentinel doc
  2. `src/agents/changelog-writer.md` — new agent (self-check, pinned commit-mapping, idempotent diff, pinned markdown output schema)
  3. `install.sh` — add rule-file copy in `--init-project`, update 5 "13" banners to "14", verify SDLC self-skip
  4. `src/agents/prd-writer.md` — `Changelog:` field requirement, both value shapes with examples, authoring constraints
  5. Four command files — hook `changelog-writer` into bootstrap, implement-slice (with parallel-safety SKIP guard), develop-feature (orchestrator-only once per wave), merge-ready (pre-flight, not a gate)
  6. `src/claude.md` — Agency Roles row for `changelog-writer`, any "13" references updated to "14"
  7. `README.md` — 13→14 tagline and heading, new agents-table row, new downstream CHANGELOG feature section documenting SDLC self-skip
  8. `templates/CLAUDE.md` — dead-metadata `Version source:` placeholder for iteration 2

- **Wave assignments:**

  | Wave | Slices | Rationale |
  |------|--------|-----------|
  | 1    | 1, 2, 3, 4, 5, 6, 7, 8 | Disjoint files; all logical dependencies resolved at plan time (agent name is a plan-level pinned string, not a runtime import) — fully parallel |

- **[STRUCTURAL] decisions pinned:**
  1. **PRD `Changelog:` field placement** → separate line BELOW the `Status:`/`Date:`/`Priority:`/`Related:` header block (after one blank line). Locked in Slice 4; TC-2.6 reference updated to assert the below-block placement as canonical and treat inline-with-block as invalid (caught by prd-writer critic).
  2. **Commit-to-PRD-section mapping** → conventional-commit **scope** matches the slugified PRD section title keyword set (whole-token match, with tie-break preferring user-facing sections then lower section number; disambiguation warning emitted on ties). Locked in Slice 2 Step 5; TC-7.3 becomes the canonical test and TC-7.4 (explicit trailer mechanism) is rejected. Chose scope-matching because every SDLC commit already has a scope per `.claude/rules/git.md` — no new trailer convention is introduced and no migration required for any prior commit.
  3. **SDLC self-skip verification** → Slice 3 Verify uses **static structural analysis**: `awk '/^scaffold_project\(\) \{/,/^\}/' install.sh | grep -q 'templates/rules/changelog.md'` (MUST be present) AND `! (awk '/^install_user_config\(\) \{/,/^\}/' install.sh | grep -q 'templates/rules/changelog.md')` (MUST be absent). No `install.sh` invocation, no destructive side effects. This proves structurally that only `--init-project` installs the rule file. Corrected from earlier plan version which ran `install.sh --yes --local` destructively (overwriting `$HOME/.claude/`) — Plan Critic CRITICAL findings 1–3.
  4. **Agent structured output format** → **Markdown** with exactly five stable `## <token>` headers (`## Self-check`, `## Source counts`, `## Entries per category`, `## Action taken`, `## Warnings`). The `## Action taken` value is one of six canonical tokens: `no-op: not configured`, `no-op: already in sync`, `no-op: no eligible entries`, `action taken: created`, `action taken: rewrote`, `action taken: inserted empty [Unreleased]`. Locked in Slice 2 Step 11; TC-11.1 asserts all five headers present; TC-11.3 asserts the six canonical tokens.
  5. **install.sh 13→14 scope expansion** → Slice 3 covers banners at lines 8, 49, 62, 178, 182 (five locations, not two). Locked in Slice 3 Changes and Verify.

- **Risk factors for Plan Critic to watch:**
  1. **Slice 2 size** — Steps 1 through 11 of the agent spec are content-heavy. While the file itself is markdown prose (not production code), the critic should verify no step is vague ("works correctly") and that the Verify command asserts all six canonical action-taken tokens, all five output headers, the degraded-mode merge-base fallback, and zero matches for iteration-2-forbidden strings (`gh release`, `git tag`). The done condition explicitly enumerates each.
  2. **Slice 5 touches 4 command files** — approaching the mid-slice-verification threshold (4+ files per error-recovery rule). The implementer must run a grep-based typecheck after every 3 file edits. Slice 5 does not cross the "production code lines" threshold because each change is an inserted block of markdown prose (~10–20 lines per file).
  3. **Full Wave 1 parallelism** — all 8 slices run simultaneously. The critic should verify that no two slices share a file path. Cross-checked: {`templates/rules/changelog.md`}, {`src/agents/changelog-writer.md`}, {`install.sh`}, {`src/agents/prd-writer.md`}, {`src/commands/bootstrap-feature.md`, `src/commands/implement-slice.md`, `src/commands/develop-feature.md`, `src/commands/merge-ready.md`}, {`src/claude.md`}, {`README.md`}, {`templates/CLAUDE.md`} — nine disjoint sets across 8 slices; no intersection.
  4. **Hedging-language trap** — Slice 8's field is deliberately "dead metadata" / "iteration 2" — these terms legitimately describe PRD-deferred scope per section 3.10 and must NOT be flagged as hedging. The `Version source:` placeholder being "informational only" is the explicit PRD-5.5 requirement, not a scope reduction.
  5. **Parallel-safety guard phrasing in Slice 5** — the critic should verify `implement-slice.md` clearly states `SKIP this step entirely` in parallel-subagent mode, not something softer like "may skip" or "consider skipping". The Verify command greps for `SKIP this step` to enforce this.
  6. **Single-slice wave dispatch** — TC-6.5 flagged this as TBD. Slice 5 pins it: **the orchestrator ALWAYS invokes `changelog-writer` post-wave regardless of wave size (single-slice waves included)**, and subagents in all waves (single or multi) SKIP Step 5.5. Earlier plan version had an orchestrator-skip-for-single-slice branch that created a dispatch contradiction (Plan Critic MAJOR finding 7: subagent sees wave context → SKIP, orchestrator also skips → no sync ever). Corrected: idempotent agent makes redundant invocations cheap (no-op on second call), so uniform dispatch is safe and eliminates the hole.

- **AC / UC mapping completeness:**
  - **All 17 ACs mapped:** AC-1 → Slice 1; AC-2, AC-3 → Slice 3; AC-4, AC-5, AC-6, AC-15, AC-16, AC-17(partial) → Slice 2; AC-7 → Slice 4; AC-8, AC-9, AC-10, AC-11 → Slice 5; AC-12 → Slice 6; AC-13 → Slices 3 + 7; AC-14 → Slice 8; AC-17(partial) → Slices 2, 5, 6.
  - **All 42 UCs mapped:** UC-1, UC-1-A1, UC-1-EC1 → Slices 1, 2; UC-2 (all four hooks) → Slices 2, 5; UC-2-A1/A2/A3, UC-2-E1/E2, UC-2-EC1 → Slice 2; UC-3, UC-3-A1/A2, UC-3-E1, UC-3-EC1 → Slices 2, 5; UC-4, UC-4-A1, UC-4-EC1 → Slice 2; UC-5, UC-5-A1, UC-5-EC1 → Slices 1, 2, 3; UC-6, UC-6-E1, UC-6-EC1/EC2 → Slices 2, 4, 5; UC-7, UC-7-A1, UC-7-EC1 → Slice 2; UC-8, UC-8-A1, UC-8-EC1 → Slice 2; UC-9, UC-9-EC1 → Slice 2; UC-10, UC-10-A1/E1/EC1 → Slice 2; UC-11, UC-11-A1, UC-11-E1, UC-11-EC1 → Slices 2, 3, 5.
  - **Zero unmapped ACs. Zero unmapped UCs.**

- **TC coverage check:** 84 test cases map across the 8 slices. Slice coverage totals exceed 84 because several TCs are covered by multiple slices (e.g., TC-1.5 is covered by Slice 3's Verify which also exercises Slice 1's rule-file placement and Slice 2's self-check). No test case is unmapped.

---

## Review Notes

### Critic Findings
- **Total:** 14 findings (3 critical, 5 major, 6 minor)
- **All CRITICAL/MAJOR addressed:** Yes

### Changes Made

**CRITICAL 1 — Slice 3 wave dependency:** Fixed by Finding 2's resolution. The earlier Verify command depended on `src/agents/changelog-writer.md` existing on disk (to assert `ls $HOME/.claude/agents/*.md | wc -l == 14`), which would race against Slice 2 in Wave 1. Replaced with pure static analysis that does not touch `$HOME/.claude/` and does not require Slice 2's output at verify time. All 8 slices remain in Wave 1 safely.

**CRITICAL 2 — Slice 3 destructive Verify:** Removed the `bash install.sh --yes --local` invocation from Verify. The verify now runs entirely statically: `bash -n` for syntax, `grep` for banner counts, and `awk '/^funcname\(\) \{/,/^\}/'` function-body extraction for structural containment checks. No overwrite of `$HOME/.claude/`, no backup-dir spam.

**CRITICAL 3 — Tautological self-skip assertion:** Replaced `test ! -f ./.claude/rules/changelog.md` (which passes trivially because `.claude/rules/` does not exist in the SDLC repo at all) with structural function-body containment: the `cp ".claude/rules/changelog.md"` line MUST appear inside `scaffold_project()` AND MUST NOT appear inside `install_user_config()`. This proves structurally that only `--init-project` installs the sentinel.

**MAJOR 4 — Slice 5 Gate regex ambiguity:** Tightened `^## Gate [0-9]` to `^## Gate [0-9]+:` (colon-terminated). Current gate headings have format `## Gate N: Title`, so the colon anchor is precise and avoids the `Gate 1` matching `Gate 10` prefix issue.

**MAJOR 5 — Slice 3 line numbers brittle:** Added "Note to implementer" at top of Slice 3 Changes: locate banners via `grep -n "13 specialized\|13 AI agents\|(13 files"` rather than trusting fixed line numbers. Line references in the Changes bullets retained as "around line N" guidance.

**MAJOR 6 — Slice 2 monolithic (11 steps):** Kept as single slice. Rationale: the 11 steps are semantically cohesive — self-check gates everything else; steps 2–4 produce the input model; steps 5–6 derive eligible entries; steps 7–9 implement the idempotent write. Splitting would force arbitrary seams (e.g., 2a with "scaffold + self-check only, no actual sync logic") that leave half an agent on disk. Mid-slice typecheck rule does not apply (1 file, not 4+). Blast radius is mitigated by the exhaustive Verify command which enumerates every canonical token, every output header, every iteration-2 forbidden string, and the degraded-mode fallback.

**MAJOR 7 — Single-slice wave dispatch contradiction:** Fixed. Changed `develop-feature.md` hook to invoke `changelog-writer` for ALL waves regardless of size (single-slice included). The earlier plan had the orchestrator SKIP its invocation for single-slice waves and rely on `implement-slice.md` Step 5.5 to cover it — but the subagent spawned by `develop-feature` still receives wave context, causing Step 5.5 to also SKIP, leaving zero sync. Uniform dispatch is safe because the agent is idempotent per FR-2.6/NFR-6.

**MAJOR 8 — Case-insensitive filesystem (`src/claude.md` vs `src/CLAUDE.md`):** Acknowledged. The physical file is `src/claude.md` (lowercase per `ls`); macOS APFS default allows both case-names to resolve to the same inode. No other slice targets this file, so no within-wave conflict. Standardized on lowercase `src/claude.md` throughout the plan — consistent with `ls` output and with install.sh line 199 (`cp "$SCRIPT_DIR/src/claude.md"`).

### Acknowledged Minor Issues

**MINOR 9 — Slice 2 tools list (`Read, Write, Edit, Bash, Glob, Grep`):** Kept both `Write` and `Edit`. Rationale: `Write` is needed for first-time `CHANGELOG.md` creation (full-file write); `Edit` is the correct tool for subsequent targeted `[Unreleased]`-only rewrites that preserve prior versioned sections byte-for-byte (Step 8 invariant). Removing either breaks one path. Minor principle-of-least-privilege tradeoff accepted.

**MINOR 10 — Slice 4 placement ambiguity:** Fixed. Pinned "immediately AFTER Output Format, BEFORE Constraints" — not "under Output Format (or extend Constraints)".

**MINOR 11 — Slice 2 NFR-8 performance not verified:** Fixed by adding explicit "aspirational" annotation to Performance targets. No automated performance gate in iteration 1.

**MINOR 12 — Slice 7 line numbers (README):** Line 5 tagline, line 95 heading, line 111 row — verified current content at planning time; implementer can use `grep -n` defensively as noted in MAJOR 5 pattern.

**MINOR 13 — No rollback strategy:** Fixed. Added Rollback paragraph to Risk assessment explaining per-slice atomic commits + `git revert` works non-overlapping because all 8 slices touch disjoint files.

**MINOR 14 — `rules/` count banner unchanged (stays at 4):** Not an issue. `src/rules/` (user-level rules) keeps its 4 files; only `templates/rules/` (per-project rules) gains a 4th file (`changelog.md`). Installer banner at user-level install refers to `src/rules/` count — no change needed.
