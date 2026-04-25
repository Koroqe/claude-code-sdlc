# Claude Code SDLC

**Turn Claude Code into a full software development team.**

17 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.1.0-green.svg)]()

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
- **10 quality gates** — git hygiene, docs completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy, UI/UX
- **Release packaging** — Gate 9 of `/merge-ready` computes the semver bump from `[Unreleased]` content, date-stamps the CHANGELOG section, writes a release-notes file, and provisions the GitHub Actions release workflow. Suggest-only: emits the exact `git add` / `git commit` / `git tag` / `git push` commands you run yourself; never executes them.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash
```

Or locally:

```bash
git clone https://github.com/Koroqe/claude-code-sdlc.git
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
| `release-engineer` | Packages releases at `/merge-ready` Gate 9 — semver bump, CHANGELOG date-stamp, release-notes file, GitHub Actions workflow provisioning. Suggest-only: never runs `git push` / `git tag` / `gh release create` / `npm publish`. |

---

## Commands

| Command | What It Does |
|---------|-------------|
| `/develop-feature` | Full autonomous pipeline — request to merge-ready |
| `/bootstrap-feature` | Documentation phases only — PRD, use cases, architecture, QA, plan |
| `/implement-slice` | Next TDD slice — tests first, implement, verify, commit |
| `/merge-ready` | All 10 quality gates |
| `/context-refresh` | Rebuild session context from scratchpad |

```
> Add user authentication with Google OAuth

Claude automatically:
1. Plans -> explores codebase -> critic review
2. Bootstraps -> PRD, use cases, architecture, QA, executable plan
3. Implements -> TDD slices in parallel waves (independent slices run simultaneously)
4. Verifies -> 10 quality gates including release packaging
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

---

## Customization

- **Edit agents** — each is a standalone `.md` file in `~/.claude/agents/`
- **Add agents** — create a new `.md` with YAML frontmatter (`name`, `description`, `tools`, `model`)
- **Change models** — set `model: opus`, `sonnet`, or `haiku` per agent in frontmatter
- **Fork and reinstall** — edit in `src/agents/`, run `bash install.sh --local --yes`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
