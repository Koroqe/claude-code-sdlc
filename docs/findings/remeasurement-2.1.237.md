# Re-measurement of four stale findings — Claude Code 2.1.237

Date: 2026-08-20. All four findings flagged in `compaction-probe.md` §7 as "measured on 2.1.9,
possibly stale" were re-measured on the native arm64 **2.1.237** build. Three are fixed, one is a
new capability. Methods and raw results below; every claim here was observed, not read off docs.

## 1. User-scope plugin enablement — FIXED

**Method:** fresh empty directory (no `.claude/`, no project-scope install, no `enabledPlugins`
entry anywhere but user settings), `claude -p --output-format stream-json --verbose`, inspect the
`init` event.

**Result:** the init event's `agents` array lists **all 15** `claude-code-sdlc:*` agents, and the
model confirmed the `[sdlc:session-spine]` block was injected — i.e. plugin **hooks fire** under
user-scope enablement, headless, in a directory never touched by a project-scope install.

**Consequences applied:** README's per-project "step 2" and all its emphasis deleted (per the
standing instruction: deleted, not softened). The upstream bug was **not** filed — the defect does
not reproduce on the current version, and Anthropic's template requires confirming the latest
version. `install.sh`'s closing "ONE STEP LEFT — required, per project" banner still prints the
obsolete instruction — recorded here as a follow-up code change (install.sh is a sensitive path;
it goes through the pipeline, not a doc edit).

## 2. settings.json hooks under `claude -p` — FIXED

**Method:** temporary `SessionStart` + `SubagentStop` capture hooks appended to
`~/.claude/settings.json` (backed up, restored after), headless `claude -p` run that spawned one
subagent.

**Result:** **both hooks fired** and wrote their stdin payloads. The 2.1.9 finding ("settings.json
hooks never execute headless") no longer holds.

## 3. `SubagentStop` payload — NOW CARRIES `agent_type`

**Method:** same capture run as #2.

**Result:** payload contains `agent_type: "general-purpose"`, `agent_id`, `agent_transcript_path`,
`prompt_id`, `permission_mode`, `effort: {level}`, `stop_hook_active` — see the annotated capture in
`subagent-stop-payload.md`. `last_assistant_message` is still absent.

**Follow-up (not yet implemented):** `stop:gate-evidence` can now attribute per-gate instead of
asserting only "no subagent ran at all"; `subagent:stop:wave-record` can record the agent type
instead of an opaque id; `develop-feature`'s step-1a text ("SubagentStop carries no agent_type")
is now version-stale. All three are one coordinated feature through the pipeline.

## 4. `/agents` — no longer terminal-only

**Method:** init event's command classification on 2.1.237.

**Result:** `agents` appears in `slash_commands`; the `terminal_slash_commands` list is just
`['doctor', 'color']`. The README's "terminal-only wizard" caveat was deleted with the step-2
rewrite.

## 5. Addendum (2026-08-20, planning measurements for PRD §13)

Two further measurements taken while planning the post-live-run reconciliation feature, each
settling a plan-critic dispute:

**Stop / SubagentStop session identity.** Temporary capture hooks on both events, one headless
`claude -p` run spawning one subagent: the `Stop` payload and the `SubagentStop` payload carried
the **identical `session_id` UUID** (`81ea7ae9-…` on both). Same-session equality is measured fact
on 2.1.237 — the basis for wave-record session filtering (PRD §13 FR-4.5/FR-5.3). The 2.1.9
capture also carried `session_id`, so the field's presence is not version-gated.

**gitignore pattern anchoring semantics.** Per gitignore(5) and measured with
`git check-ignore --no-index -v` against a tracked fixture at depth
(`tests/fixtures/agents/debugger/.../.claude/debug/some-feature.md`):
- unanchored `.claude/debug/` (middle separator → root-relative): **exit 1, no match** — it does
  NOT shadow nested fixture paths;
- separator-free `debug/`: **exit 0, matches at any depth** — this is the shape that genuinely
  shadows.
Consequence: anchoring `/.claude/debug/` is an explicitness/precedent choice, not fixture
protection, and `check-ignore` needs `--no-index` to be a real assertion on tracked paths (the
default consults the index and never reports tracked files).

## Still unknown

`PreCompact` payload shape — `pre:compact:probe` has still never fired on any version. Unchanged.
