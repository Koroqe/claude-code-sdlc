# Claude Code SDLC

**Turn Claude Code into a full software development team.**

15 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-4.0.0-green.svg)]()

---

## Quick start — both steps are required

```bash
# 1. once per machine
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash -s -- --yes

# 2. once per project — without this, nothing loads
cd your-project && claude plugin install claude-code-sdlc@claude-code-sdlc --scope project
```

Then open a **new** session and run `/agents`. You should see 15 agents prefixed
`claude-code-sdlc:`. If you see none, you skipped step 2 — see [Install](#install).

> **Step 2 is not optional and is easy to miss.** On Claude Code 2.1.x a plugin enabled at user
> scope silently does not load: `claude plugin enable` reports success, writes the setting, and
> still resolves **0 of 15 agents**. Enabled at project scope it resolves **all 15**. Step 1 alone
> leaves you with an install that looks complete and does nothing.

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
- **Cross-session learning** — corrections, repeated deviation-rule fires, and gate auto-fixes graduate into a project-scoped instinct store (`.claude/instincts.md`) that's injected into future sessions and attached to matching plan slices, so the same mistake isn't relearned every feature

---

## Install

**Step 1 — one command, once per machine:**

```bash
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash -s -- --yes
```

**Step 2 — REQUIRED, once per project you use it in:**

```bash
cd your-project && claude plugin install claude-code-sdlc@claude-code-sdlc --scope project
```

> Skipping step 2 is the single most likely way to end up with a harness that appears installed and
> does nothing. Step 1 installs the plugin; step 2 is what makes it load. You must repeat step 2 in
> **every** project — the memory layer from step 1 is global, the plugin activation is not.

**Verify — open a new session** (the agent list is fixed at session start, so your current session
will not show them) **and run `/agents`.** Expect 15 entries prefixed `claude-code-sdlc:`. Seeing
none means step 2 has not taken effect in this directory.

Starting a new project? `bash install.sh --init-project` performs step 2 for you, along with
scaffolding `.claude/`, `docs/` and `CHANGELOG.md`.

### Why step 2 exists

On Claude Code **2.1.x**, enabling a plugin at user scope does not work. `claude plugin enable`
reports success and writes `enabledPlugins` into `~/.claude/settings.json`, but the plugin still does
not load — measured on 2.1.9, **0 of 15 agents resolve**. The identical plugin enabled at *project*
scope loads **all 15**. Step 2 is that project-scope enable. It writes `.claude/settings.json`,
merging with whatever is already there rather than replacing it.

Step 1 still performs the user-scope install, so when a future version honours it, step 2 becomes
redundant rather than wrong.

### Alternatives to step 1

From inside a session:

```
/plugin marketplace add Koroqe/claude-code-sdlc
/plugin install claude-code-sdlc@claude-code-sdlc
```

Or clone and install locally — same result as the curl one-liner:

```bash
git clone https://github.com/Koroqe/claude-code-sdlc.git
cd claude-code-sdlc && bash install.sh --yes
```

Either of these gives you the plugin but **not** the memory layer. See below for what that costs.

### Two layers, and why they install differently

| Layer | What it holds | How it installs |
|---|---|---|
| Plugin | 15 agents, 7 skills, hooks | `claude plugin install` |
| Memory | `~/.claude/claude.md`, `~/.claude/rules/*.md` | copied by `install.sh` |

Claude Code loads `~/.claude/claude.md` and `~/.claude/rules/*.md` as **user memory** on every
session. That is the only channel an always-on instruction can travel through, and the plugin
manifest has no `instructions`, `memory`, or `context` field — so the memory layer cannot ship inside
the plugin. That limit is Claude Code's, not a shortcut this project took.

It does not have to mean two things for *you* to run, though: `claude plugin ...` are ordinary CLI
subcommands, so `install.sh` drives them itself after copying the memory layer. That is what makes
step 1 a single command.

**Plugin without the memory layer** is a legitimate way to use this — the agents and skills are fully
invocable. What you lose is automatic engagement: the pipeline no longer starts from a plain English
feature request, so you call `/develop-feature` explicitly every time.

`install.sh` is fail-open about all of this. If `claude` is not on your PATH it still installs the
memory layer and prints the commands to finish with later. Pass `--no-plugin` to skip the plugin step
deliberately.

### Agents are namespaced

Plugin agents resolve as `claude-code-sdlc:<name>` — `claude-code-sdlc:planner`,
`claude-code-sdlc:verifier`, and so on. Skills work the same way, though the bare form
(`/develop-feature`) resolves too as long as no other installed plugin defines that name.

### If it isn't working

| Symptom | Cause | Fix |
|---|---|---|
| `/agents` shows no `claude-code-sdlc:` agents | step 2 not run in this project | `claude plugin install claude-code-sdlc@claude-code-sdlc --scope project`, then open a new session |
| Agents appear in one project but not another | step 2 is per-project | run step 2 in the other project too |
| `claude plugin list` says `enabled`, agents still missing | you are in a different directory than the one enabled, or the session predates the change | check `.claude/settings.json` exists there; open a new session |
| Agents load, but a plain English request doesn't start the pipeline | memory layer missing (plugin installed on its own) | run step 1 |
| `claude: command not found` during step 1 | Claude Code not on `PATH` | install Claude Code, then rerun step 1 |

A quick check that step 2 landed:

```bash
cat .claude/settings.json   # expect an "enabledPlugins" entry
```

### Uninstall

```bash
bash install.sh --dry-run --uninstall   # review first
bash install.sh --uninstall
claude plugin uninstall claude-code-sdlc@claude-code-sdlc
```

Removal is manifest-driven — it deletes only files this harness installed, never a glob, so your own
agents in `~/.claude/agents/` survive. A timestamped backup is taken first, and
`bash install.sh --restore <backup-dir>` puts it back — verified to round-trip byte-for-byte with
`diff -r`.

Backups are pruned to the **5 most recent** on each install, since every install, uninstall and
restore takes one and they are full copies of the memory layer. Only this installer's own
`backup-YYYYMMDD-HHMMSS` directories are ever removed; anything else under `~/.claude/` that happens
to start with `backup-` is left alone. Set `SDLC_KEEP_BACKUPS` to change the count, or `0` to disable
pruning.

---

## How It Works

The commands below are plugin skills. Written in full they resolve as `/claude-code-sdlc:<name>` (e.g. `/claude-code-sdlc:bootstrap-feature`); the shorter bare form shown throughout this document (e.g. `/bootstrap-feature`) resolves automatically as long as no other installed plugin defines a skill by the same name — if one does, use the namespaced form to disambiguate.

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

## The 15 Agents

| Agent | Role |
|-------|------|
| `prd-writer` | Feature requirements in `docs/PRD.md` |
| `ba-analyst` | Use cases and scenarios in `docs/use-cases/` |
| `architect` | Architecture review, module boundaries, `[STRUCTURAL]` fix authorizations |
| `qa-planner` | Test cases in `docs/qa/` before any code |
| `planner` | Breaks features into 5-9 executable slices with verification commands |
| `plan-critic` | Adversarially critiques the plan before implementation — hedging, wave assignment, file-path verification |
| `security-auditor` | Vulnerability audit, auth boundaries |
| `test-writer` | TDD — tests before implementation |
| `e2e-runner` | End-to-end tests from use-case scenarios |
| `code-reviewer` | Quality, security, architecture compliance |
| `build-runner` | Typecheck, tests, build verification |
| `verifier` | Goal-backward checks: file existence, stubs, wiring, data flow |
| `doc-updater` | Keeps documentation accurate after changes |
| `refactor-cleaner` | Post-implementation cleanup with rename safety |
| `debugger` | Scientific-method bug hunt with persistent state — auto-invoked on a repeated gate or slice-verify failure, before the retry budget is spent |

---

## Commands

7 skills ship in the plugin. Five are the primary, autonomous pipeline; two (`/sdlc-fast`, `/sdlc-quick`) are override-only entry points a developer types explicitly to overrule the pipeline's own triage verdict — never invoked by the pipeline itself, and never required for a run to complete.

| Command | What It Does |
|---------|-------------|
| `/develop-feature` | Full autonomous pipeline — request to merge-ready |
| `/bootstrap-feature` | Documentation phases only — PRD, use cases, architecture, QA, plan |
| `/implement-slice` | Next TDD slice — tests first, implement, verify, commit |
| `/merge-ready` | All 9 quality gates |
| `/context-refresh` | Rebuild session context from scratchpad |
| `/sdlc-fast <description>` | Override-only — bypass triage, run fast-tier execution directly |
| `/sdlc-quick <description>` | Override-only — bypass triage, run quick-tier execution directly |

### Changelog Automation

Every completed unit of work appends an entry to a project-root `CHANGELOG.md`.

Each entry records four fields:

- **Date+time** — captured live in **UTC** (retrieved at write time, never guessed)
- **Name** — the feature or fix name
- **Summary** — a short, non-technical description of what changed
- **Details** — a more specific description of the change (≤500 characters)

Projects that want an engineering-leadership view can add an optional **Technical details** line, written at CTO level — screens, endpoints, components, and architecture/deployment changes, never file or function names.

Entries are grouped by UTC day, with the newest day first.

There are two trigger points:

- `/merge-ready` writes the entry after all quality gates pass — for features and gated fixes.
- A standalone `/implement-slice` writes the entry for standalone fixes that do not go through merge-ready.

### Example

```
> Add user authentication with Google OAuth

Claude automatically:
1. Plans -> explores codebase -> critic review
2. Bootstraps -> PRD, use cases, architecture, QA, executable plan
3. Implements -> TDD slices in parallel waves (independent slices run simultaneously)
4. Verifies -> 9 quality gates including goal-backward verification
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

## Hooks

The plugin registers three hooks. None of them blocks: every one exits 0
whatever happens, so a malfunctioning hook cannot halt an unattended run.

One honest limitation. That guarantee covers the hook *deciding* anything and
every asynchronous failure — a throw, a rejected promise, a missing handler, a
Node too old, an unserialisable result. It cannot cover a handler that blocks
the thread synchronously, because a JavaScript timer cannot interrupt
synchronous code. The backstop for that case is the `timeout` on each entry in
`hooks/hooks.json`, which Claude Code enforces by killing the process from
outside.

| Hook | Fires | Does |
|------|-------|------|
| `session:start:spine` | Session start | Injects the current feature, branch, wave and slice from the scratchpad, so a resumed or compacted session re-enters the loop at the right point instead of asking. Reports memory-layer version drift. |
| `post:edit:accumulate` | After each Edit/Write | Records the edited path. |
| `stop:typecheck-format` | End of a response | Runs the project's declared format and typecheck commands **once** over everything edited, instead of once per edit. |

Cost is about 21 ms per tool call, of which ~1.5 ms is the hook itself — the
rest is Node process startup. See
[docs/implementation-records/hook-infrastructure_latency.md](docs/implementation-records/hook-infrastructure_latency.md).

### Running project commands is opt-in, per project

`stop:typecheck-format` executes a command declared in your project's
`CLAUDE.md`. That execution is spawned by the hook engine, so the permission
system never sees it — which means cloning a repository and letting one
response finish would otherwise be enough to run a command of its choosing.

So it only runs in projects you have explicitly registered:

```bash
bash install.sh --trust-project          # trust the current directory
bash install.sh --trust-project /path    # or a specific one
```

The registry lives at `~/.claude/sdlc-trusted-projects`, deliberately outside
any repository — a marker file inside a project would be worthless, since a
hostile repo would simply commit one. In an unregistered project the hook
reports what it *would* have run and executes nothing. It never prompts, in
either direction.

### Controls

```bash
SDLC_HOOKS_ENABLED=0                       # disable every hook
SDLC_DISABLED_HOOKS=session:start:spine    # disable specific ids, comma-separated
SDLC_HOOK_PROFILE=minimal                  # minimal | standard | strict
SDLC_SESSION_CONTEXT_MAX_CHARS=4000        # cap on injected session context
SDLC_EXEC_PROJECT_COMMANDS=0               # never run project-declared commands
```

`minimal` keeps only the session spine — it observes state and never executes a
project-declared command. An unrecognised profile falls back to `standard`
rather than failing, so a typo cannot silently change what is enforced.

**Never copy `hooks/hooks.json` into `settings.json`.** Plugin hooks load
automatically; duplicating them there makes every hook fire twice.

To check whether hooks are registered, run `claude plugin validate .` — and in
a project with a scratchpad, a session start that injects no state is the
symptom of a plugin that isn't installed.

## Customization

Agents and skills are packaged as a Claude Code plugin (`agents/*.md`, `skills/*/SKILL.md` in this repo) and come **only** from there. `install.sh` installs the memory layer and nothing else: `~/.claude/claude.md` and `~/.claude/rules/*.md`.

It has to work this way. Claude Code resolves subagents by precedence — a user-level `~/.claude/agents/planner.md` outranks a plugin's `planner`, and unlike skills, **plugin subagents are not namespaced**, so a shadowed one is unreachable by any name. If `install.sh` also wrote the agents into `~/.claude/agents/`, those copies would win permanently and every future agent update shipped in the plugin would silently do nothing. Skills do not have this problem: `/claude-code-sdlc:develop-feature` coexists with any same-named skill from another source.

For the same reason, upgrading from v3.x **removes** the 13 agent files and 5 command files that older versions installed into `~/.claude/`. Left in place they would shadow their plugin replacements. Removal is scoped to a manifest, never a wildcard, so your own agents in `~/.claude/agents/` are untouched — and everything removed is captured in a timestamped backup first.

**What an `install.sh`-only setup gets** (plugin never installed): the memory layer is active, so the mandatory pipeline instruction and all five process rules load on every session and Claude follows the documented workflow. But there are no specialist subagents to delegate to, so the phases run inline rather than through `prd-writer`, `architect`, `qa-planner` and the rest. Install the plugin for the full agency.

- **Edit agents** — each is a standalone `.md` file in `agents/`, shipped via the plugin. Do not copy them to `~/.claude/agents/`: user-level agents shadow plugin agents permanently, so a local copy freezes that agent at the version you copied.
- **Add agents** — create a new `.md` with YAML frontmatter (`name`, `description`, `tools`, `model`)
- **Change models** — set `model: opus`, `sonnet`, or `haiku` per agent in frontmatter
- **Fork and reinstall** — edit in `agents/`, run `bash install.sh --local --yes` and reinstall the plugin

### Model Tiers

Agents are tiered by task complexity to reduce cost:

| Tier | Agents | Rationale |
|------|--------|-----------|
| `opus` | `architect`, `planner`, `plan-critic`, `security-auditor` | Output cascades through the pipeline; mistakes aren't catchable by automated verification |
| `sonnet` | all other 11 agents | Structured/mechanical work with well-defined output formats; downstream gates catch any quality issues |

This static split is what shipped as the `quality` profile below. It is no longer meant to be changed by hand-editing frontmatter — see **Model Profiles** for the supported way.

### Model Profiles

`agents/*.md`'s `model:` field is a rewrite target, not a hand-edit target: `install.sh --local --profile <name>` atomically rewrites the `model:` frontmatter line of all 15 agent files at once, to one of four profiles.

| Role | `quality` | `balanced` | `budget` | `inherit` |
|---|---|---|---|---|
| `architect` | opus | opus | sonnet | inherit |
| `plan-critic` | opus | sonnet | sonnet | inherit |
| `planner` | opus | opus | sonnet | inherit |
| `security-auditor` | opus | opus | opus | inherit |
| `ba-analyst` | sonnet | sonnet | sonnet | inherit |
| `build-runner` | sonnet | haiku | haiku | inherit |
| `code-reviewer` | sonnet | sonnet | sonnet | inherit |
| `debugger` | sonnet | sonnet | sonnet | inherit |
| `doc-updater` | sonnet | haiku | haiku | inherit |
| `e2e-runner` | sonnet | sonnet | sonnet | inherit |
| `prd-writer` | sonnet | haiku | haiku | inherit |
| `qa-planner` | sonnet | sonnet | sonnet | inherit |
| `refactor-cleaner` | sonnet | sonnet | haiku | inherit |
| `test-writer` | sonnet | sonnet | haiku | inherit |
| `verifier` | sonnet | sonnet | sonnet | inherit |

`quality` is the shipped baseline — identical, role for role, to the Model Tiers table above. `security-auditor` stays `opus` under every profile: no downstream gate catches a missed vulnerability the way `plan-critic`'s adversarial review and Gate 6's replan loop now catch a bad `architect`/`planner` call, so it never gets the same discount.

```bash
bash install.sh --local --profile quality    # explicit shipped baseline
bash install.sh --local --profile balanced   # a middle ground
bash install.sh --local --profile budget     # cheapest roles that already have a backstop
bash install.sh --local --profile inherit    # every agent inherits the host's default model
bash install.sh --local --profile budget --dry-run   # preview only — changes nothing
```

`--profile` rewrites the `model:` line of all 15 agent files in place. It refuses to run when
`agents/` has uncommitted changes, since a clean checkout can undo the rewrite with
`git checkout -- agents/` and a dirty one cannot. `--dry-run` previews regardless, and
`SDLC_ALLOW_DIRTY_PROFILE=1` overrides deliberately.


`--profile` requires `--local` — it rewrites the plugin-source checkout `/plugin marketplace add <path>` points at, and a non-`--local` run's source is a temporary clone deleted before the process exits, so the rewrite would be silently discarded there. It cannot be combined with `--uninstall`, `--restore`, `--init-project`, or `--trust-project`.

The rewrite touches only the `model:` line — `name`, `description`, `tools`, `effort:`, and the rest of every file are byte-identical before and after. It is two-phase: all 15 files are validated before any of them is written, so a malformed file leaves the whole tree unchanged rather than 14-of-15 rewritten.

**Receipt:** each run writes `.sdlc-model-profile` at the repo root — one line naming the profile just applied — only after all 15 files are rewritten. It is gitignored: it records *your* local checkout's state, not something to commit, and CI's own drift check (`scripts/ci/validate-model-profile.js`) treats its absence as `quality`, and rejects a committed receipt outright under `--assert-baseline`.

**Does a running session pick this up?** Undetermined. Whether an already-open Claude Code session re-reads `agents/*.md` live, or instead snapshots agent definitions at plugin load, could not be confirmed in the environment this was built in — there was no marketplace-installed copy of this plugin to test against, and restarting a session to observe reload behavior directly wasn't something that build task could do. Until someone settles it: treat a new session, or a `/plugin` reinstall, as required after `--profile` runs for the new values to take effect. See `install.sh`'s own header comment for the full finding and what would settle it.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
