# Claude Code SDLC

**Turn Claude Code into a full software development team.**

15 specialized AI agents. Documentation-first. TDD. Quality gates. Hardened against Claude Code's known limitations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-4.8.0-green.svg)]()

---

## Quick start

```bash
# once per machine
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash -s -- --yes
```

Then confirm it landed:

```bash
claude plugin list   # expect claude-code-sdlc — Scope: user, Status: ✔ enabled
```

Open a new session in any project and the harness is active — user-scope enablement loads the
plugin everywhere (measured on Claude Code 2.1.237: all 15 agents resolve and hooks fire in a
fresh directory with no per-project setup).

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
- **Parallel execution waves** — independent slices execute simultaneously via wave-based parallelism, cutting wall-clock implementation time, with each slice's outcome read from its own transcript rather than taken from its self-report
- **Automatic triage** — a typo does not pay for a PRD: every request is routed to a fast, quick or full tier before any edit, ambiguity always resolving upward, escalation one-way
- **9 quality gates** — git hygiene, docs completeness, code review, security audit, build, E2E, goal-backward verification, doc accuracy, UI/UX
- **Cross-session learning** — corrections, repeated deviation-rule fires, and gate auto-fixes graduate into a project-scoped instinct store (`.claude/instincts.md`) that's injected into future sessions and attached to matching plan slices, so the same mistake isn't relearned every feature

---

## Install

**One command, once per machine:**

```bash
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash -s -- --yes
```

**Verify:**

```bash
claude plugin list
```

Expect an entry for `claude-code-sdlc@claude-code-sdlc` with `Scope: user` and
`Status: ✔ enabled`.

Then **open a new session** — plugin assets are resolved at session start, so a session that was
already open when you installed keeps running without it, silently. See
[If it isn't working](#if-it-isnt-working).

Starting a new project? `bash install.sh --init-project` scaffolds `.claude/`, `docs/` and
`CHANGELOG.md`.

> If you installed under an older README's per-project step: those project-scope installs still
> update independently, and the session-start hook now warns when one goes stale. Measurement record:
> `docs/findings/remeasurement-2.1.237.md`.

### Alternatives to the one-liner

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
the install a single command.

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
| `claude plugin list` shows nothing | install did not complete | rerun the install one-liner, then open a new session |
| Plugin listed and enabled, but no agents, skills or guards work | the session was open before you installed it | close it and open a new one — assets resolve at session start and are never retrofitted |
| Plugin listed with an old version and a `failed to load` line | a stale install of a version with a known load defect (4.0.0–4.3.0) | `claude plugin update claude-code-sdlc@claude-code-sdlc`, then open a new session |
| Agents appear in one project but not another | a stale project-scope install shadowing the user-scope one — the session-start warning names the fix | `claude plugin update claude-code-sdlc@claude-code-sdlc --scope project` in that project |
| Agents load, but a plain English request doesn't start the pipeline | memory layer missing (plugin installed on its own) | run the install one-liner |
| `claude: command not found` during install | Claude Code not on `PATH` | install Claude Code, then rerun |

### Updating

```bash
claude plugin marketplace update claude-code-sdlc
claude plugin update claude-code-sdlc@claude-code-sdlc                    # user scope
cd your-project && claude plugin update claude-code-sdlc@claude-code-sdlc --scope project
curl -fsSL https://raw.githubusercontent.com/Koroqe/claude-code-sdlc/main/install.sh | bash -s -- --yes
```

Then **restart your session.** `claude plugin update` says so itself.

Three things make this less obvious than it looks, all measured on 2.1.9:

- **Scopes update independently.** A plain `claude plugin update` updates the *user*-scope copy only.
  Every project enabled at project scope needs its own `--scope project` run, and `claude plugin
  list` will show them sitting at the old version until you do.
- **The version number is what gates delivery.** `claude plugin update` compares the version the
  marketplace advertises, not the commit behind it. A release that ships code without bumping that
  number reports *"already at the latest version"* and installs nothing.
- **Restarting is not optional.** Plugin assets — agents, skills and every hook — are resolved when a
  session starts. An open session keeps running the old copy, or no copy, with no error and no
  missing-agent symptom.

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

### Not every change gets the full pipeline

A one-line fix should not need a PRD. When the harness has only one gear, developers bypass it — and
bypassing is how autonomy actually dies. So every request is triaged first, automatically, and the
tier and the reason are stated before any file is touched.

| Tier | When | What runs |
|---|---|---|
| `fast` | One file, and a typo, comment, copy string, single literal or version bump | Direct edit, no subagents, no documents. Still verifies, commits, and writes a changelog entry. |
| `quick` | 1–3 files, one bounded and already-understood change | One planner pass, one slice, TDD, a reduced gate set. No PRD, use cases or QA. |
| `full` | Everything else | The complete pipeline above. |

Two rules keep this honest:

- **Ambiguity resolves upward.** Anything that does not clearly qualify as `fast` or `quick` is
  `full`. `full` is the default, never a positive verdict.
- **Escalation is one-way.** A `fast` change that turns out to touch more files, or any file under a
  sensitive path (`auth`, `payment`, `billing`, `secret`, `migration`, workflows, installer),
  re-routes upward mid-run and says so. It never routes back down.

`/sdlc-fast` and `/sdlc-quick` override the verdict. They activate only on the literal command — a
request that merely *says* "quick" or "trivial" is still triaged normally.

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
| `verifier` | Goal-backward checks: file existence, stubs, wiring, data flow — reporting `VERIFIED`, `PRESENT_BEHAVIOR_UNVERIFIED`, `FAILED` or `UNCERTAIN`, so "wired" is never rounded up to "works" |
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
| A subagent grades its own homework | `subagent:stop:wave-record` reads the subagent's transcript; where record and self-report disagree, the record wins |
| Process rules are prose a model may ignore | 6 blocking guards mechanize them: branch protection, AI attribution, read-before-edit, config weakening, curated-state truncation, subagent write isolation |
| The same mistake is relearned every feature | Corrections and repeated failures graduate into a project instinct store, injected at session start and attached to matching plan slices |
| One gear, so small fixes bypass the pipeline entirely | Automatic triage into fast / quick / full, ambiguity resolving upward |

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

The plugin registers **12 hooks across 13 registrations** (`pre:edit:read-guard` listens on two
events). That is the ceiling — a thirteenth hook has to be paid for by retiring one. They split into
two kinds, and the difference matters.

**Observers never block.** They watch, record, and inject.

| Hook | Fires | Does |
|------|-------|------|
| `session:start:spine` | Session start | Injects the current feature, branch, wave and slice from the scratchpad, plus active prevention rules, so a resumed or compacted session re-enters the loop at the right point instead of asking. Reports memory-layer version drift, and warns when a stale project-scope install shadows the loaded plugin (`claude plugin update claude-code-sdlc@claude-code-sdlc --scope project` fixes it). |
| `post:edit:accumulate` | After each Edit/Write | Records the edited path. |
| `stop:typecheck-format` | End of a response | Runs the project's declared format and typecheck commands **once** over everything edited, instead of once per edit. |
| `subagent:stop:wave-record` | A parallel-wave subagent finishes | Reads that subagent's **own transcript** and records what it actually ran, what errored, and what it wrote. |
| `pre:compact:probe` | Before compaction | Records the `PreCompact` payload and nothing else. A diagnostic, not a mechanism — see below. |

**Guards block by decision.** Each mechanizes a rule that used to be prose in a prompt, and each
carries a named escape.

| Guard | Fires on | Refuses | Escape |
|---|---|---|---|
| `pre:bash:git-guard` | `Bash` | Commits on `main`/`master`, `--no-verify`, AI attribution in the message, non-conforming commit type/scope, unrequested `push` | `SDLC_ALLOW_GIT_GUARD=1` |
| `pre:edit:read-guard` | `Edit`/`Write` | Editing a file with no same-session freshness — a `Read` **or** a successful `Write` of the file this session both count; the rule most likely to lapse silently after compaction | `SDLC_ALLOW_UNREAD_EDIT=1` |
| `pre:write:shrink-guard` | `Write` | Whole-file writes that collapse curated state (scratchpad, PRD, use cases, QA, changelog, instincts) below 40% of its length | `SDLC_ALLOW_SHRINK=1` |
| `pre:edit:config-protection` | `Edit`/`Write` | Weakening tsconfig/eslint/biome/prettier/jest configs, `@ts-nocheck`, blanket `eslint-disable` — the usual way an unattended run turns a red build green dishonestly | `SDLC_ALLOW_CONFIG_EDIT=1` |
| `pre:agent:isolation-guard` | `Edit`/`Write` inside a subagent | Parallel-wave subagents writing the scratchpad, changelog or instinct store | `SDLC_ALLOW_SUBAGENT_WRITE=1` |
| `stop:changelog-guard` | End of a response | A changelog edit with a malformed entry, or a duplicate name under today's date | `SDLC_ALLOW_CHANGELOG_SHAPE=1` |
| `stop:gate-evidence` | End of a response | A **MERGE READY** verdict in a session where no subagent ever ran | `SDLC_ALLOW_UNEVIDENCED_GATES=1` |

### The one guard that fires on what *didn't* happen

Every other check here fires on an **action taken** — an attempted commit, an attempted edit, a
changed file. None of them can fire on a step that was **skipped**, because an omission produces no
tool call to intercept. That leaves the most expensive unattended failure invisible: a run that
reports `Gate 3: Security Audit — PASS` having never invoked `security-auditor`, and closes green.

`stop:gate-evidence` polices the claim instead of the call. Its evidence is the session transcript
itself — records carry `isSidechain: true` when they belong to a subagent, so an invocation is
observable as a byproduct of happening, and cannot be forged by claiming harder. Anything the model
writes about its own work would just be another self-report.

It is deliberately narrow: it blocks a MERGE READY verdict when **no subagent ran at all**.
`/merge-ready` delegates to six agents, so zero invocations is not a borderline reading. It does not
match individual `Gate N: PASS` lines to individual agents for the blocking decision — a guard that
fires wrongly on honest work gets switched off and then protects nothing. Alongside the unchanged
decision it emits an advisory `systemMessage` naming which gate agents were observed in same-session
wave-records and which had no same-session wave-record found — advisory only, because wave-records
are model-writable self-reports; the block itself still rests solely on the transcript.

A refusal is never a dead end. It returns a concrete remedy, which the 4-tier deviation rules
classify and act on — auto-fix, auto-add, auto-resolve, or escalate. The escape is printed in the
refusal message itself, deliberately, so a stuck run can resolve itself without waiting for a human.

### Wave results are verified, not trusted

Parallel slices used to report their own outcome: whether the `Verify:` command passed, which
deviation rules fired, whether they stayed inside their declared files. That is the same agent
grading its own work, and a subagent that never ran its verify command has no way to know it didn't.

`subagent:stop:wave-record` reads the subagent's transcript from disk and records what actually
happened. `/develop-feature` cross-checks every self-report against it. **Where the record and the
self-report disagree, the record wins.**

### Compaction is probed, not handled

`pre:compact:probe` records what `PreCompact` actually carries and does nothing else — no decision,
no injected context, no message.

It deliberately does **not** block compaction, though the API allows it. Refusing to compact does not
save a long run; it exhausts the context window instead, turning a recoverable summarisation into a
dead end.

Until a real session compacts with the plugin loaded, the event's schema is unverified and nothing is
built on it. See [docs/findings/compaction-probe.md](docs/findings/compaction-probe.md) for what was
measured and what is still unknown.

### Fail-open, and the one honest limitation

A hook may block only by *deciding* to. A malfunctioning one exits 0 — a throw, a rejected promise, a
missing handler, a Node too old, an unserialisable result all leave the tool call untouched.

That guarantee cannot cover a handler that blocks the thread synchronously, because a JavaScript
timer cannot interrupt synchronous code. The backstop for that case is the `timeout` on each entry in
`hooks/hooks.json`, which Claude Code enforces by killing the process from outside.

Cost is about 21 ms per tool call, of which ~1.5 ms is the hook itself — the rest is Node process
startup. See
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

Per-guard escapes (`SDLC_ALLOW_GIT_GUARD`, `SDLC_ALLOW_UNREAD_EDIT`, `SDLC_ALLOW_SHRINK`,
`SDLC_ALLOW_CONFIG_EDIT`, `SDLC_ALLOW_SUBAGENT_WRITE`, `SDLC_ALLOW_CHANGELOG_SHAPE`,
`SDLC_ALLOW_UNEVIDENCED_GATES`) are listed in
the guard table above. A bypass is always reported rather than applied silently — a guard you cannot
tell fired is worse than no guard.

**Never copy `hooks/hooks.json` into `settings.json`.** Plugin hooks load
automatically; duplicating them there makes every hook fire twice.

### Checking the hooks are actually live

Open a **new** session in a project that has a `.claude/scratchpad.md` and look for an injected
`[sdlc:session-spine]` block. From a shell:

```bash
claude -p "Does your context contain a block beginning [sdlc:session-spine]? Answer yes or no."
```

Two traps worth knowing:

- **`claude plugin validate .` is not this check.** It validates the *marketplace manifest* and
  passes whether or not a single hook is registered.
- **Enabling the plugin does not affect sessions that are already open.** Hooks are loaded at session
  start. A session opened before step 2 ran keeps running with no hooks at all, and nothing warns
  you. Open a new session after enabling.

## How the harness checks itself

A harness that enforces quality has to be held to it. This repo ships **17 CI validators** and
**24 hook test files**, run by GitHub Actions across four jobs on every push.

The rule that matters: **every validator must fail on a deliberately broken asset, not merely pass on
a good one.** Each has seeded fixtures pinned to an exact expected problem count, so a check cannot
quietly stop checking. That rule exists because the opposite kept happening here — `claude plugin
validate .` was documented as verifying the plugin manifest when it reads the marketplace one, and a
"passing" install test turned out to be running a near-neighbour of the documented command.

What the validators cover: agent, skill and hook frontmatter; the plugin manifest's real accepted
shape; no personal paths in shipped files; unicode safety; version-string consistency; model-profile
drift from hand-edited frontmatter; instinct-store arithmetic; the fixture manifest behind every QA
document; that documented README commands actually exist and work; and that no agent is instructed to
do something the tools it was granted cannot do.

---

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
