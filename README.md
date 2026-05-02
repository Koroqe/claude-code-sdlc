# Claude Code SDLC

**Turn Claude Code into a full software development team.**

17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.0.0-green.svg)]()

---

## Why

Claude Code out of the box:

- Writes code before understanding requirements
- Skips tests or writes them as an afterthought
- Reports success when the code doesn't compile — "bytes hit disk" is its success metric
- Silently loses context at ~167K tokens, then edits against stale memory
- Misses references during renames — grep is text matching, not an AST
- Truncates file reads at 2,000 lines and search results at ~50K chars without warning

## What This Fixes

- **Documentation-first** — PRD, use cases, test cases documented before any code
- **TDD enforcement** — tests written before implementation, every slice verified
- **Goal-backward verification** — checks features are actually wired together, not just that code compiles (file existence, stub detection, wiring, data flow)
- **Graduated error recovery** — auto-fix typos (free), auto-add validation (free), auto-resolve dependencies (costs retry), escalate architecture decisions (stop)
- **Executable plans** — each slice has `Files:`, `Changes:`, `Verify:`, `Done when:` fields — no interpretation drift
- **Scope reduction detection** — Plan Critic flags hedging language ("v1", "placeholder", "for now") against PRD requirements
- **Context integrity** — mandatory re-read before edit, scratchpad persistence, chunked reads for large files
- **Rename safety** — 7-step protocol covering barrel files, dynamic imports, re-exports, typecheck verification
- **Mid-slice typecheck** — runs after every 3 file edits when a slice touches 4+ files
- **Parallel execution waves** — independent slices execute simultaneously via wave-based parallelism, cutting wall-clock implementation time
- **9 quality gates** — git hygiene, docs completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy, UI/UX
- **Release packaging** — extracted to the standalone `/release` slash command (NOT a quality gate). User invokes `/release` after `/merge-ready` reports MERGE READY when ready to publish. The `release-engineer` agent computes the semver bump from `[Unreleased]` content, date-stamps the CHANGELOG section, writes a release-notes file, and provisions the GitHub Actions release workflow. **Two modes:** suggest-only by default (emits the exact `git add` / `git commit` / `git tag` / `git push` commands you run yourself; never executes them) — and an opt-in **executing mode** that activates when `<project>/.claude/rules/auto-release.md` is present. In executing mode `/release` runs whitelisted git commands itself with 4-tier authority (Trivial/Moderate auto-execute, Sensitive `git push origin <tag>` prompts default-deny `[y/N]` or auto-confirms with `AUTO_RELEASE=1`, Forbidden `npm publish` / `cargo publish` / `gh release create` / `--force` always refused). Anchored-regex bash whitelist with metacharacter pre-rejection. Sentinel-absent behavior is byte-identical to suggest-only.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/codefather-labs/claude-code-sdlc/main/install.sh | bash
```

Or locally:

```bash
git clone https://github.com/codefather-labs/claude-code-sdlc.git
cd claude-code-sdlc
bash install.sh --yes
```

Scaffold a new project:

```bash
cd your-project && bash install.sh --init-project
```

---

## How It Works

```
Feature Request
     |
     v
PLAN MODE -----> Explore codebase, design approach, Plan Critic review
     |
     v
/bootstrap-feature
  - PRD Writer ........... documents requirements
  - Business Analyst ..... writes use cases
  - Architect ............ reviews design
  - QA Lead .............. documents test cases
  - Tech Lead ............ creates executable plan (5-9 slices)
     |
     v
/develop-feature Phase 2 (wave-aware)
  - Single-slice wave: TDD as before
  - Multi-slice wave: spawn parallel subagents (one per slice)
  - Wait for wave completion -> next wave
  - Each slice: re-read files, TDD, verify, commit
     |
     v
/merge-ready
  - Code Review + Security Audit + Build
  - E2E Tests + Goal-Backward Verification + Doc Check
     |
     v
MERGE READY
```

---

## The 17 Agents

| Agent | Role |
|-------|------|
| `prd-writer` | Feature requirements in `docs/PRD.md` |
| `ba-analyst` | Use cases and scenarios in `docs/use-cases/` |
| `architect` | Architecture review, module boundaries, `[STRUCTURAL]` fix authorizations |
| `resource-architect` | Recommends external resources at bootstrap Step 3.5 and auto-installs Trivial/Moderate items after user approval (MCP, dev dependencies); Sensitive items escalate via Rule 4 |
| `role-planner` | Recommend project-specific on-demand roles (mobile dev, compliance officer, etc.) at bootstrap Step 3.75 — suggest-only |
| `qa-planner` | Test cases in `docs/qa/` before any code |
| `planner` | Breaks features into 5-9 executable slices with verification commands |
| `security-auditor` | Vulnerability audit, auth boundaries |
| `test-writer` | TDD — tests before implementation |
| `e2e-runner` | End-to-end tests from use-case scenarios |
| `code-reviewer` | Quality, security, architecture compliance |
| `build-runner` | Typecheck, tests, build verification |
| `verifier` | Goal-backward checks: file existence, stubs, wiring, data flow |
| `doc-updater` | Keeps documentation accurate after changes |
| `refactor-cleaner` | Post-implementation cleanup with rename safety |
| `changelog-writer` | Maintain `[Unreleased]` of downstream `CHANGELOG.md` from PRD + scratchpad + git log |
| `release-engineer` | Packages releases on user-invoked `/release` (NOT in /merge-ready) — semver bump, CHANGELOG date-stamp, release-notes file, GitHub Actions workflow provisioning. Suggest-only by default; opt-in executing mode (`.claude/rules/auto-release.md`) runs whitelisted git commands itself per the §7 4-tier authority dispatch — `npm publish` / `cargo publish` / `gh release create` / `--force` always refused. |

---

## Commands

| Command | What It Does |
|---------|-------------|
| `/develop-feature` | Full autonomous pipeline — request to merge-ready |
| `/bootstrap-feature [--with-resources]` | Documentation phases only — PRD, use cases, architecture, QA, plan. Pass `--with-resources` to force-run resource-architect (otherwise auto-detected from PRD/use-cases keywords). |
| `/implement-slice` | Next TDD slice — tests first, implement, verify, commit |
| `/merge-ready` | All 9 quality gates (release packaging is NOT a gate — see `/release`) |
| `/release` | User-invoked release packaging — semver bump, CHANGELOG date stamp, release-notes file, GHA release workflow. Run after `/merge-ready` when ready to publish. |
| `/knowledge-ingest` | Ingest a folder/file into the per-project knowledge base |
| `/context-refresh` | Rebuild session context from scratchpad |

```
> Add user authentication with Google OAuth

Claude automatically:
1. Plans -> explores codebase -> critic review
2. Bootstraps -> PRD, use cases, architecture, QA, executable plan
3. Implements -> TDD slices in parallel waves (independent slices run simultaneously)
4. Verifies -> 9 quality gates
5. (User-invoked) Run /release to cut a versioned release from CHANGELOG [Unreleased]
```

---

## Hardening Against Claude Code Internals

| Failure Mode | Our Fix |
|-------------|---------|
| False success reports (bytes hit disk != working code) | Mandatory typecheck after edits; mid-slice typecheck every 3 files |
| Context death spiral (~167K token compaction) | Re-read-before-edit rule; scratchpad persistence; auto-archiving at 100+ lines |
| Silent file truncation (2,000-line read cap) | Chunked reads with offset/limit for files >500 LOC |
| Search truncation (50K char cap, silent) | Re-run with narrower scope when results look small |
| Grep misses references (text matching, not AST) | 7-step rename protocol: whole-word, barrel files, dynamic imports, tests, config, typecheck |
| Simplicity bias blocks structural fixes | Architect `[STRUCTURAL]` action items authorize fixes beyond minimal-diff |
| No pre-refactor cleanup | Step 0: remove dead code first, commit separately, then refactor |
| Flat "retry 3x" error recovery | 4-tier deviation rules: auto-fix, auto-add, auto-resolve, escalate |
| Vague plans cause implementation drift | Executable format: `Files:`, `Changes:`, `Verify:`, `Done when:` per slice |
| Code compiles but feature is disconnected | 4-level goal-backward verification: existence, stubs, wiring, data flow |
| Agents silently downgrade scope | Plan Critic scans for hedging language against PRD requirements |
| Sequential execution wastes time on independent slices | Wave-based parallelism: planner groups slices by file overlap, develop-feature spawns parallel subagents per wave |
| Decisions built on memory or conjecture, not verified state | Cognitive self-check rule + mandatory `## Facts` block (verified facts / external contracts / assumptions / open questions); Plan Critic flags missing or hallucinated entries on file-based artifacts |
| Agents lack project-specific domain knowledge | Local FTS5 knowledge base via `sdlc-knowledge` CLI; agents query before authoring; cite hits in `## Facts` |
| PDF extraction | `pdfium-render` handles all PDFs (CID fonts, calibre conversions, scanned-with-text-layer, multi-column) |
| Plan-mode plans lost to global cache | Auto-persist rule: Claude `Write`s the full plan body to `<project>/.claude/plan.md` before `ExitPlanMode`; `/bootstrap-feature` Step 0 aborts when the file is missing or empty |

Plan-mode plans are now auto-saved to `<project>/.claude/plan.md` whenever Claude exits plan mode. The persistence sequence (`git rev-parse` → `mkdir -p .claude` → `Write plan.md` → `ExitPlanMode`) is mandated by the `### Plan-Mode Persistence (MANDATORY)` rule in `src/claude.md`. Downstream, `/bootstrap-feature` Step 0 checks `[ -s .claude/plan.md ]` and aborts with a clear error message if the file is missing or empty — no agent runs until the plan is persisted. The planner agent at Step 5 reads this file as authoritative input and refines it in place rather than regenerating from scratch.

---

## Project Setup

```bash
cd your-project && bash install.sh --init-project
```

Creates:

- `.claude/CLAUDE.md` — your tech stack, structure, commands (fill in TODOs)
- `.claude/scratchpad.md` — session state persistence
- `.claude/settings.json` — permissions config
- `.claude/rules/` — architecture, security, testing constraints
- `docs/PRD.md` — product requirements
- `docs/qa/` and `docs/use-cases/` — test case and use case directories

---

## Automated CHANGELOG for downstream projects

Downstream projects scaffolded with `bash install.sh --init-project` get a `CHANGELOG.md` file maintained automatically in the [Keep a Changelog](https://keepachangelog.com/) format. The `changelog-writer` agent keeps the `[Unreleased]` section in sync with the PRD, scratchpad, and git log at four lifecycle points: post-bootstrap (after `/bootstrap-feature` completes), post-commit in standalone `/implement-slice` mode, post-wave in `/develop-feature` (once per wave, not per slice), and pre-flight in `/merge-ready`.

The SDLC repo itself opts out automatically: because `bash install.sh` does not install the sentinel rule file `.claude/rules/changelog.md` onto the SDLC repo, the `changelog-writer` agent detects the missing sentinel and returns `no-op: not configured` without performing any writes when invoked inside this repository.

See `templates/rules/changelog.md` for the full policy, including Keep-a-Changelog category mapping, idempotency rules, and the commit-hash marker strategy used to avoid duplicate entries.

---

## Resource recommendation at bootstrap

The `resource-architect` agent runs at Step 3.5 of `/bootstrap-feature`, immediately after the architecture review passes, and produces structured recommendations across six categories: MCP servers, cloud/compute, external APIs, third-party services, libraries/frameworks, and hardware. Each recommendation includes Category, Why, Install/activate, Cost/complexity, and Reversibility fields so downstream humans or agents can evaluate tradeoffs without re-researching. When no external resources are needed, the agent still emits all six category headings with `(none)` so downstream readers can distinguish "not needed" from "not considered". The planner inlines the recommendations as a top-level `## Recommended Resources` section at the top of `.claude/plan.md` and deletes the temporary `.claude/resources-pending.md` handoff file.

### Iteration 2: scoped auto-install

Iteration 2 extends `resource-architect` from suggest-only to scoped auto-install while preserving every iter-1 contract. Each recommendation is now classified into a **4-tier authority gradation** — **Trivial** (idempotent, fully reversible: MCP server adds via `claude mcp add`, browser engine downloads via `npx playwright install`), **Moderate** (local but persistent: dev-only npm/pip dependencies installed via the detected package manager), **Sensitive** (credentialed or paid: cloud-credential setup, API keys for paid services, paid-service signup, writes to credential stores like `~/.aws/`/`~/.config/gcloud/`/`~/.config/gh/`/`~/.netrc` or real-credential `.env` files), and **Forbidden** (destructive or out-of-scope: `rm`/`mv`/`cp` outside CWD, modifying SDLC core or agent prompts, `git push`/`git tag`/`git commit -a`/`git rebase`/`git reset --hard`, `sudo`/`su`/`runas`, network calls beyond Trivial-tier installs, shell metacharacter chaining). The agent applies the most-restrictive applicable tier and emits a per-tier summary alongside the existing `## Recommended Resources` block.

The **approval flow** runs as a single ephemeral prompt after the recommendations are presented: Trivial items are grouped per category and approved with one yes/no per category (bulk approval), Moderate items require an explicit yes/no per item, and Sensitive items are escalated via Rule 4 of the deviation rules — the agent halts auto-install for those items and surfaces them to the user for manual decision. Forbidden items are never auto-installed and are either rewritten as a Trivial/Moderate alternative or emitted with `Tier: Forbidden` plus the literal `user must perform manually outside the SDLC pipeline` in the `Why` field.

A **Bash whitelist** acts as defense-in-depth on top of the per-tier approvals: every command the agent executes must match one of a conservative set of anchored regex patterns (no shell metacharacters, no runtime expansion, no `&&`/`||`/`;`/backticks/`$()`), and a redundant deny-list explicitly rejects `rm`, `mv`, `cp`, `curl`, `wget`, `ssh`, `sudo`, `git push`, `npm publish`, `aws configure`, and similar destructive prefixes. Any command that fails to match the whitelist halts the install phase with `aborted-whitelist-violation`. The agent's own `tools:` frontmatter is restricted to `Read`, `Write`, `Bash`, `Glob`, `Grep` — `Edit`, `WebFetch`, `WebSearch`, and `NotebookEdit` are not granted.

**Backward compatibility** is preserved exactly: replying "no to all" at the approval prompt — or running in a non-interactive context where `process.stdin.isTTY === false` — bypasses every install action and leaves the iter-1 **suggest-only** behavior fully intact, including the `## Recommended Resources` block byte-for-byte. When auto-install runs, results are appended as a separate `## Auto-Install Results` section after `## Recommended Resources`, never mutating the suggestion block.

---

## On-demand role recommendations at bootstrap

The 17 agents shipped by this repo are the **core team**: they are mandatory, permanent, and re-used across every feature in every project. The `role-planner` agent runs at Step 3.75 of `/bootstrap-feature` (immediately after `resource-architect` and before `qa-planner`) and adds a second, **on-demand** layer on top of that core team — project-specific roles that are recommended for a single feature when the core 17 are not sufficient. On-demand roles are optional, one-off, and never replace or modify the core 17. The agent is strictly **suggest-only**: it writes recommendations and prompt files, but never installs anything, never edits core agent prompts, never modifies pipeline steps, and never makes network calls.

Generated prompt files use the `ondemand-<slug>.md` filename convention and live in `~/.claude/agents/` alongside the core agents. Each generated file carries a YAML frontmatter line `scope: on-demand` so audits and tooling can distinguish the dynamic layer from the permanent core team. The slug must not collide with any of the 17 core agent names (`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`, `security-auditor`, `test-writer`, `code-reviewer`, `build-runner`, `e2e-runner`, `verifier`, `doc-updater`, `refactor-cleaner`, `changelog-writer`, `resource-architect`, `role-planner`, `release-engineer`); the Plan Critic flags collisions as MAJOR.

Because on-demand subagent types are not registered with Claude Code at session start, they cannot be invoked via `subagent_type: ondemand-<slug>`. Instead, the bootstrap pipeline reads the prompt body from `~/.claude/agents/ondemand-<slug>.md`, strips the frontmatter, and spawns the role using the **general-purpose** subagent type with the body passed verbatim as the prompt. This frontmatter-extraction-and-invocation contract is documented in detail in `src/commands/bootstrap-feature.md` (see the `### On-Demand Role Invocation` section). The `tools:` frontmatter field is not runtime-enforced for general-purpose subagents — the prompt body itself must self-restrict authority and tool usage.

Concrete examples of on-demand roles `role-planner` may suggest:

- **`mobile-dev`** — mobile-specific implementation guidance (iOS/Android platform conventions, app-store review concerns, native bridge patterns) when a feature targets a mobile client and no core agent covers that surface.
- **`compliance-officer`** — feature-level compliance review (GDPR, HIPAA, PCI, SOC2, regional data-residency rules) when a feature touches regulated data and the standard `security-auditor` audit is not sufficient.
- **`information-researcher`** — focused background research (competitor analysis, prior-art survey, regulatory context, domain-specific terminology) for features whose PRD requires external context the core team cannot generate from local files alone.

When `role-planner` determines no additional roles are needed, it explicitly emits "No additional roles required" rather than silently skipping — making the suggest-only decision auditable.

### Iteration 2: cross-feature reuse and automatic teardown

Iteration 2 extends the on-demand layer with **cross-feature reuse** and **post-merge teardown** — without changing the suggest-only contract or the core team count. **No new agents** are introduced (the count stays at 17). Teardown runs as **Step 11** of `/merge-ready` after Gate 8, which is a STEP — not a gate.

**3-stage matching at bootstrap.** When `role-planner` recommends an on-demand role, the bootstrap pipeline performs a **three-stage** match against existing files in `~/.claude/agents/ondemand-*.md` before deciding what to do:

1. **Stage 1 — exact-slug match → automatic reuse.** If a file already exists at `~/.claude/agents/ondemand-<slug>.md` whose slug matches the recommendation exactly, the bootstrap pipeline reuses it automatically with no user prompt. This is the fast path for repeated features that need the same role.
2. **Stage 2 — purpose match → user prompt with default-deny.** If no exact-slug file exists but one or more files have a similar role purpose (judged via the existing file's `description:` frontmatter field plus body text), the orchestrator prompts the user to confirm reuse. The reply is parsed against an explicit token grammar (see below). **Ambiguous replies are treated as NEGATIVE** (default-deny) — when in doubt, the pipeline creates a new file rather than silently overwriting or merging into an unrelated role.
3. **Stage 3 — no match → create new (iter-1 behavior preserved).** If neither Stage 1 nor Stage 2 matches, the pipeline falls through to the original iter-1 behavior: write a new `ondemand-<slug>.md` file with the recommended prompt. Iter-1's suggest-only flow is preserved byte-for-byte for unmatched recommendations.

**Affirmative/negative token grammar with default-deny.** Stage-2 user replies are parsed against an explicit, lower-cased token list:

- **Affirmative** (reuse the existing file): `yes`, `y`, `approve`, `ok`, `agreed`, `please do`, `go ahead`.
- **Negative** (create a new file instead): `no`, `n`, `decline`, `skip`, `not now`.
- **Ambiguous** (anything not on either list, including empty replies, multi-token mixes, or unrecognized words): treated as **NEGATIVE** under default-deny.

This grammar is enforced at the orchestrator layer so reuse decisions are deterministic and auditable rather than depending on natural-language interpretation.

**Per-file `features:` manifest.** Every iter-2-managed on-demand file carries a `features:` array in its YAML frontmatter:

```
features: ["<project-name>:<feature-slug>", ...]
```

The array tracks **which features own each on-demand role**. The `<project-name>` prefix disambiguates entries across multiple projects that share the user's global `~/.claude/agents/` directory — the same feature slug can appear in two projects without collision because the project-name prefix scopes the ownership claim. Stage-1 reuse and Stage-2 confirmed reuse both **append** the current feature's `<project-name>:<feature-slug>` entry to the `features:` array, so the orchestrator can later answer "which features still need this role?" deterministically.

**Post-merge teardown at /merge-ready Step 11.** After Gate 8 of `/merge-ready` completes (regardless of PASS/FAIL/WARN), the orchestrator runs **Step 11 — on-demand teardown**:

- For every file in `~/.claude/agents/ondemand-*.md`, remove the merged feature's `<project-name>:<feature-slug>` entry from the `features:` array.
- If the array empties as a result, **delete the file**. If the array still contains entries from other features, **leave the file in place** — another feature still owns it.
- **Refuses to run from non-feature branches** (e.g., directly on `main`) and **refuses to run from un-merged feature branches**. Defense-in-depth uses `git merge-base --is-ancestor` to confirm the feature branch's tip is actually an ancestor of `main` before any deletion happens — if the merge-ancestry check fails, teardown aborts without touching any file.
- **Never deletes core-agent files.** Teardown only operates on files matching `~/.claude/agents/ondemand-*.md` — files lacking the `ondemand-` prefix (i.e., the 17 core agents) are out of scope and cannot be removed by Step 11. Files outside `~/.claude/agents/` are also out of scope.

**Legacy file migration.** Files created under iter-1 lack the `features:` array entirely. These legacy files are migrated **opportunistically**: when a current feature's recommendation matches a legacy file (Stage 1 or Stage 2), the `role-planner` agent adds the `features:` array to that file as part of the reuse step, claiming ownership for the current feature. Legacy files **not matched** by any current recommendation are **left unchanged** — iter-2 does not perform a global sweep or rewrite of pre-existing files.

**Headless-default-create.** Non-interactive contexts (CI/CD pipelines, automated runs, any environment where `process.stdin.isTTY === false`) cannot prompt for Stage-2 confirmation. In **headless** mode, the orchestrator **skips the Stage-2 prompt** and defaults to **creating a new file** (Stage-3 behavior) rather than blocking on user input. **Stage-1 automatic reuse still runs** in headless mode because it requires no user input — exact-slug matches are always safe to reuse. This preserves iter-1's existing non-interactive contract while adding the safe portion of iter-2's reuse path.

---

## Customization

- **Edit agents** — each is a standalone `.md` file in `~/.claude/agents/`
- **Add agents** — create a new `.md` with YAML frontmatter (`name`, `description`, `tools`, `model`)
- **Change models** — set `model: opus`, `sonnet`, or `haiku` per agent in frontmatter
- **Fork and reinstall** — edit in `src/agents/`, run `bash install.sh --local --yes`

### Default model tiers (token-cost optimization)

| Tier | Model | Agents | Why |
|------|-------|--------|-----|
| Critical thinking | `opus` | `architect`, `security-auditor`, `code-reviewer`, `verifier`, `release-engineer`, `resource-architect`, `role-planner` | structural decisions, threat modeling, must-not-miss checks |
| Standard reasoning | `sonnet` | `prd-writer`, `ba-analyst`, `planner`, `refactor-cleaner` | requirements, use-cases, slice breakdown — Sonnet fits |
| Mechanical execution | `haiku` | `qa-planner`, `test-writer`, `build-runner`, `e2e-runner`, `doc-updater`, `changelog-writer` | UC→TC mapping, TDD spec exec, typecheck, Keep-a-Changelog mapping — formalized I/O |

Override per agent by editing its `model:` frontmatter field. If your project has unusual quality demands you can promote any tier to `opus` (or demote to `haiku` for token-cost reduction). Original tier assignment is the project default — it strikes a balance between cost and quality suitable for general SDLC work.

---

## Cognitive self-check at authoring time

Thinking agents in the SDLC pipeline can build verdicts on memory of similar systems instead of evidence about the actual system in front of them — hallucinated API field names, fabricated status enums, "remembered" PRD requirements that drifted, file behavior recalled from earlier in the conversation. The cognitive-self-check rule (`src/rules/cognitive-self-check.md`) forces a fact-vs-assumption discipline before output.

Every thinking agent runs a 4-question protocol — what is this claim based on? did I verify it in this session? what am I assuming without proof? if it's an assumption, is it labelled? — and emits a mandatory `## Facts` block with four subsections: `### Verified facts`, `### External contracts`, `### Assumptions`, `### Open questions`. The block makes evidence auditable: a downstream agent or human reviewer can challenge any claim against its cited source. Memory of training-data is explicitly NOT a valid source.

The rule applies to **12 thinking agents** (prd-writer, ba-analyst, architect, qa-planner, planner, security-auditor, code-reviewer, verifier, refactor-cleaner, resource-architect, role-planner, release-engineer). The **5 executor agents** (test-writer, build-runner, e2e-runner, doc-updater, changelog-writer) are exempt — they execute deterministic specs and don't make discretionary claims that need fact-checking.

**Enforcement split:** Plan Critic mechanically enforces the rule on **file-based artifacts** (PRD sections, use-case files, QA test-case files, plan.md, resources-pending.md, roles-pending.md, release-notes files) — missing block is a MAJOR finding, vague external-contract citation is a MINOR finding. **Stdout-only agents** (architect, security-auditor, code-reviewer, verifier, refactor-cleaner) emit `## Facts` to stdout via their own prompt instructions, since Plan Critic cannot read transcript content.

**Backward compatibility:** the rule applies to artifacts produced on or after the rule's merge date. Pre-existing PRD sections, use-case files, and plans authored before that date are EXEMPT — there is no retroactive backfill. See `src/rules/cognitive-self-check.md` `## Backward Compatibility` for the date-guard mechanics.

---

## Local knowledge base

Each downstream project can maintain a local, file-based knowledge base from arbitrary domain sources (books, articles, regulatory PDFs) that all 12 thinking agents consult before authoring. The retrieval tool itself lives globally in `~/.claude/tools/sdlc-knowledge/sdlc-knowledge` (also invokable as `claudeknows` from any directory on PATH after `install.sh` registers the global alias); the data lives per-project in `<project>/.claude/knowledge/sources/` (raw documents) and `<project>/.claude/knowledge/index.db` (SQLite FTS5 index).

The CLI exposes 5 subcommands — `ingest`, `search`, `list`, `status`, `delete` — backed by BM25 ranking over an FTS5 virtual table. No vector embeddings; deterministic and lexical. Populate the base via the `/knowledge-ingest <path>` slash command (or `claudeknows ingest <path>` from the shell). Once `<project>/.claude/knowledge/index.db` exists, all 12 thinking agents query before authoring domain-bearing content and cite hits in `## Facts → ### External contracts` per the cognitive-self-check rule.

Activation is opt-in: without `index.db`, every agent prompt behaves identically to current `main`. Without the binary, install.sh degrades gracefully (cargo source-build fallback when cargo is on PATH). See `src/rules/knowledge-base.md` for the full CLI contract and citation discipline.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
