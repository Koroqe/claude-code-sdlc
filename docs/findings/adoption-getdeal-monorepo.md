# Adopting v4.0 into a live project: what breaks

Pre-flight measurement against `getdeal-platform-monorepo`, the first real codebase this harness
would run on. Everything below was **executed** against the installed plugin with that repo as `cwd`,
not inferred from reading code.

The headline: this harness has only ever run on itself. Pointed at a live production repo with an
established working style, **four of its mechanisms collide with how that team actually works.** None
of the four is a bug. All four are the harness enforcing something the project already does
differently, which is exactly the failure mode the autonomy contract's third rule exists to catch.

## The project

| | |
|---|---|
| Shape | npm monorepo, three apps (backend, dashboard, website), Prisma, PM2 |
| Branch discipline | **commits go straight to `main`** — the scratchpad says so explicitly |
| Scratchpad | 2,316 lines, Ukrainian, an operational log — deploy recipes, incident notes, PR history |
| CHANGELOG | 398 KB, its own house format |
| Local rules | `.claude/rules/{architecture,changelog,security,testing}.md` |
| Custom hook | `scratchpad-after-commit.js` on `PostToolUse`/`Bash` |
| CI | GitHub Actions **blocked on billing**; deploys are manual |
| Plugin | not enabled |
| Trust registry | not registered |

## Collision 1 — the git guard refuses their normal commit

```
pre:bash:git-guard → deny
"Refusing to commit on main. Work happens on a feature branch…"
```

They commit to `main` by choice. The guard denies every one of those calls. It is overridable
per-call with `SDLC_ALLOW_GIT_GUARD=1` and it names the fix, so it cannot dead-end a run — but a
guard that fires on every commit is not a guard, it is friction, and friction is what makes people
disable the harness.

**This is the decision that has to be made before anything is installed**, and it is not ours: either
the project moves to feature branches, or `pre:bash:git-guard` is disabled there via
`SDLC_DISABLED_HOOKS`. Quietly shipping the guard and letting them discover it is the worst of the
three options.

## Collision 2 — the changelog guard blocks their entry format

Reproduced in a scratch repo seeded with their real changelog header and a new entry in their style:

```
stop:changelog-guard → block
"the newest entry has no `**Summary:**` line"
```

Their format is a plain-language paragraph followed by `**Technical details:**`. Ours requires
`**Summary:**` and `**Details:**` (≤500 chars). Both are reasonable; they are not compatible.

## Collision 3 — two changelog rulebooks, both loaded, contradicting

`~/.claude/rules/changelog.md` (ours, global, arrives with step 1) and
`.claude/rules/changelog.md` (theirs, project-local) both load as memory and specify **different
entry formats**. Whichever the model follows, a guard or a reviewer objects to the other.

## Collision 4 — the session spine injects state that is wrong

```
feature: unparseable
branch:  feat/mnda-real-document
status:  unrecognized
slice:   1 of 17
```

Actual branch: `main`. The spine matched a `## Branch:` line ~1,586 lines into the scratchpad,
belonging to a feature marked `COMPLETE` days earlier. `slice: 1 of 17` is a false parse of unrelated
prose.

The injection is honestly framed — it opens with *"untrusted data … verify against git before acting
on it"* — and that framing is doing real work here. But every session would open with a stale branch
name presented as current state. The spine's parser assumes its own scratchpad schema; a project that
keeps a genuine operational log in that file gets confident nonsense.

**Not a case for rewriting their scratchpad.** 2,316 lines of deploy recipes and incident history are
worth more than our schema. The fix belongs on our side: recognise a non-conforming scratchpad and
report `no parseable state` instead of guessing.

## Two more, lower severity

- **Not trust-registered**, so `stop:typecheck-format` reports what it would run and runs nothing.
  Fixed by `install.sh --trust-project`. This project is the whole reason that hook exists — it has
  real `typecheck:*`, `build:*` and `test:*` scripts, where this repo has none.
- **Actions blocked on billing**, so any gate that leans on CI is unavailable and deploys are manual.

## What this changes about the plan

Adoption is not "run install.sh and enable the plugin." It is a reconciliation with at least three
decisions that belong to the project owner, not to us:

1. feature branches, or `pre:bash:git-guard` off in that repo
2. one changelog format — theirs, ours, or ours relaxed to accept both
3. what happens to a 2,316-line scratchpad our own rules say to archive at 100

And one fix that is unambiguously ours: **the spine must degrade to "no parseable state" rather than
report a stale branch as current.**

## Blocker on running the pipeline here

None of the 15 agents resolve in the session this was measured from — it predates the plugin's
enablement, so no plugin assets loaded. See `compaction-probe.md` §6. The bootstrap phases
(`prd-writer`, `ba-analyst`, `architect`, `qa-planner`, `planner`) cannot be delegated until a session
is started **after** enablement.
